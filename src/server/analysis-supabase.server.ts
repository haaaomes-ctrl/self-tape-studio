// SERVER-ONLY. Supabase analysis adapter for TapeCoach.
// Do not import this module from client/browser code.
//
// A thin, runtime-neutral data layer over the owned Supabase project, built on
// the Slice 2 AnalysisRuntimeEnv contract and the existing service-role admin
// client. It re-expresses the exact take-lifecycle predicates and report/QA
// columns the current pipeline uses, but is injectable by env (and a mock
// client) so the same operations can run in the Lovable runtime today and in a
// Cloudflare Worker later. This slice (Slice 3) provides the capability only;
// it does NOT rewire process-take/runProcessTake, the queue consumer, prompts,
// schemas, scoring, UI, canaries or report output.
//
// Key invariants preserved from process-take.server.ts:
// - claimTakeForAnalysis is the atomic ownership boundary; its WHERE predicate
//   only matches pending/error rows, so an active `processing` row is never
//   reset or re-claimed by this adapter. It mirrors the existing claim predicate
//   exactly — user-cancellation and active-version pre-checks are RUNNER
//   PREFLIGHT responsibilities (Slice 4/5), as documented on the function.
// - markTakeComplete is the normal finalisation path: it writes the final
//   report columns AND the complete state together in ONE guarded update.
// - saveReport is optional/intermediate only and never flips status.
// - markTakeError writes the safe `[failure_code:CODE] message` format.
// - saveReport, markTakeComplete and markTakeError additionally guard on the
//   caller-supplied analysisRunId, so a stale delivery cannot overwrite a take a
//   newer run has reclaimed (returns stale_run). This is a deliberate, safe
//   strengthening over the existing low-level UPDATEs, justified because this
//   adapter is Worker-facing and takes the run id as caller input.
import { createSupabaseAdminClientForRuntimeEnv } from "@/integrations/supabase/client.server";
import {
  DEFAULT_QA_ARTIFACT_STORAGE_BUCKET,
  resolveQAArtifactStorageBucket,
} from "@/lib/qa-artifact-storage-bucket";
import {
  resolveAnalysisRuntimeEnv,
  type AnalysisRuntimeEnvInput,
} from "./analysis-runtime-env.server";

export type AnalysisSupabaseClient = ReturnType<typeof createSupabaseAdminClientForRuntimeEnv>;

export type AnalysisSupabaseConfigDiagnostics = {
  supabase_url_configured: boolean;
  supabase_url_host: string | null;
  supabase_service_role_key_configured: boolean;
};

type ServerMisconfigured = {
  kind: "server_misconfigured";
  code: "server_misconfigured";
  diagnostics: AnalysisSupabaseConfigDiagnostics;
};

export type AnalysisSupabaseDeps = {
  /** Inject a pre-built (or mock) client; otherwise one is created from env. */
  client?: AnalysisSupabaseClient;
};

/** Mirror of the takes columns the analysis runner needs (raw read only). */
export type AnalysisTakeContextRow = {
  id: string;
  user_id: string | null;
  audition_id: string;
  signals: unknown;
  checklist: unknown;
  status: string;
  processing_phase: string;
  attempt_count: number;
  mux_status: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  mux_mp4_standard_url: string | null;
  mux_mp4_high_url: string | null;
  mux_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  credit_reservation_id: string | null;
  credit_lifecycle_status: string | null;
  credit_is_synthetic_usage: boolean | null;
};

export type AnalysisAuditionContextRow = {
  id: string;
  brief: unknown;
  brief_source: unknown;
  mode: unknown;
  title: unknown;
  audition_level: unknown;
  extracted_brief: unknown;
};

/** Final report columns, mapped to the takes report/scoring columns. */
export type AnalysisReportColumns = {
  report: unknown;
  scores: unknown;
  overallScore: number | null;
  confidence: number | null;
  complianceFlags: unknown;
  scoreBreakdown: unknown;
};

export type AnalysisCompletePayload = AnalysisReportColumns & {
  analysisRunId: string;
};

const TAKE_CONTEXT_SELECT =
  "id, user_id, audition_id, signals, checklist, status, processing_phase, attempt_count, mux_status, mux_asset_id, mux_playback_id, mux_mp4_standard_url, mux_mp4_high_url, mux_duration_seconds, created_at, updated_at, error_message, credit_reservation_id, credit_lifecycle_status, credit_is_synthetic_usage";

const AUDITION_CONTEXT_SELECT =
  "id, brief, brief_source, mode, title, audition_level, extracted_brief";

// Mirror process-take.server.ts: runnable pending phases and the active phases
// in which report writes / heartbeats are accepted.
const ANALYSIS_RUNNABLE_PROCESSING_PHASES = ["analysis_pending", "queued", "pending"] as const;
const ANALYSIS_ACTIVE_PROCESSING_PHASES = ["analysis_pending", "analysing", "finalising"] as const;
const REPORT_WRITABLE_PROCESSING_PHASES = ["analysing", "finalising"] as const;
const ANALYSIS_PENDING_CLAIM_FILTER = `and(status.eq.pending,processing_phase.in.(${ANALYSIS_RUNNABLE_PROCESSING_PHASES.join(
  ",",
)}))`;
const ANALYSIS_RETRY_ERROR_CLAIM_FILTER = "and(status.eq.error,processing_phase.eq.error)";

function safeErrorSummary(error: unknown): { code: string | null; message: string | null } {
  if (!error) return { code: null, message: null };
  if (typeof error === "object") {
    const record = error as { code?: unknown; message?: unknown; name?: unknown };
    return {
      code: typeof record.code === "string" ? record.code.slice(0, 80) : null,
      message:
        typeof record.message === "string"
          ? record.message.replace(/\s+/g, " ").slice(0, 180)
          : typeof record.name === "string"
            ? record.name.slice(0, 80)
            : null,
    };
  }
  return { code: null, message: String(error).replace(/\s+/g, " ").slice(0, 180) };
}

/**
 * Coerces a score for the integer takes.overall_score / takes.confidence columns:
 * rounds finite numbers and maps non-finite/non-number to null — mirrors the
 * existing persistence guard in process-take.server.ts. Without this, a fractional
 * AI-derived value would be rejected by the integer column and fail the write.
 */
function coerceScore(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

export type CreateAnalysisSupabaseClientResult =
  | { ok: true; client: AnalysisSupabaseClient }
  | { ok: false; code: "server_misconfigured"; diagnostics: AnalysisSupabaseConfigDiagnostics };

/**
 * Creates a service-role Supabase client for analysis using the Slice 2
 * AnalysisRuntimeEnv resolution (owned TAPECOACH pair; legacy names excluded on
 * the Cloudflare Worker path). Returns a safe `server_misconfigured` result
 * (boolean-only diagnostics, no secret values) when the Supabase pair is absent.
 * OpenRouter config is NOT required here — this is a DB/storage client only.
 */
export function createAnalysisSupabaseClient(
  env?: AnalysisRuntimeEnvInput | null,
): CreateAnalysisSupabaseClientResult {
  const resolved = resolveAnalysisRuntimeEnv(env);
  const diagnostics: AnalysisSupabaseConfigDiagnostics = {
    supabase_url_configured: resolved.diagnostics.supabase_url_configured,
    supabase_url_host: resolved.diagnostics.supabase_url_host,
    supabase_service_role_key_configured: resolved.diagnostics.supabase_service_role_key_configured,
  };
  if (!resolved.supabaseUrl || !resolved.supabaseServiceRoleKey) {
    return { ok: false, code: "server_misconfigured", diagnostics };
  }
  // The pair is present but may still be invalid (e.g. a malformed URL, which
  // createClient rejects by throwing). Treat any construction failure as a safe
  // config error so the adapter never throws on misconfiguration.
  try {
    const client = createSupabaseAdminClientForRuntimeEnv({
      TAPECOACH_SUPABASE_URL: resolved.supabaseUrl,
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: resolved.supabaseServiceRoleKey,
    });
    return { ok: true, client };
  } catch {
    return { ok: false, code: "server_misconfigured", diagnostics };
  }
}

function resolveClient(
  env: AnalysisRuntimeEnvInput | null | undefined,
  deps: AnalysisSupabaseDeps | undefined,
): { kind: "client"; client: AnalysisSupabaseClient } | ServerMisconfigured {
  if (deps?.client) return { kind: "client", client: deps.client };
  const created = createAnalysisSupabaseClient(env);
  if (!created.ok) {
    return {
      kind: "server_misconfigured",
      code: "server_misconfigured",
      diagnostics: created.diagnostics,
    };
  }
  return { kind: "client", client: created.client };
}

export type ClaimTakeForAnalysisInput = {
  /** Caller-supplied analysis run id (the adapter never derives it). */
  analysisRunId: string;
  /** Epoch ms used for the claim timestamp; defaults to Date.now(). */
  now?: number;
  /** Allow re-claiming a non-cancelled error/error row (manual retry). */
  includeErrorRetry?: boolean;
};

export type ClaimTakeForAnalysisResult =
  | { kind: "claimed"; analysisRunId: string }
  | { kind: "already_complete" }
  | { kind: "already_processing"; processingPhase: string | null; updatedAt: string | null }
  | { kind: "not_runnable"; status: string | null; processingPhase: string | null }
  | { kind: "missing" }
  | { kind: "claim_error"; error: { code: string | null; message: string | null } }
  | ServerMisconfigured;

/**
 * Atomically claims one runnable take for analysis. The conditional update is
 * the ownership boundary: duplicate deliveries may all reach this helper, but
 * only the caller whose update affects a row continues. The WHERE predicate
 * matches ONLY pending (runnable phases) or, optionally, error/error rows — so
 * an active `processing` row is never reset by this adapter. Staleness policy is
 * left to the caller (the active row's `updatedAt` is returned).
 *
 * This claim mirrors the existing process-take.server.ts predicate EXACTLY and
 * deliberately does not embed higher-level lifecycle checks. RUNNER PREFLIGHT
 * RESPONSIBILITIES (Slice 4/5), mirroring what runProcessTake performs today:
 *  - do NOT retry user-cancelled rows: resetTake marks cancellations as
 *    status='error'/processing_phase='error' with an error_message containing
 *    "Cancelled by user"; the runner must skip those before claiming, even with
 *    `includeErrorRetry` (which otherwise reclaims any error/error row);
 *  - do NOT analyse replaced take versions: the replacement RPC marks the prior
 *    version `take_version_status='replaced'`; the runner must confirm the take
 *    is the active version before claiming;
 *  - manual retry is the only path that may reclaim eligible non-cancelled
 *    error/error rows (`includeErrorRetry`).
 */
export async function claimTakeForAnalysis(
  takeId: string,
  input: ClaimTakeForAnalysisInput,
  env?: AnalysisRuntimeEnvInput | null,
  deps?: AnalysisSupabaseDeps,
): Promise<ClaimTakeForAnalysisResult> {
  const resolved = resolveClient(env, deps);
  if (resolved.kind === "server_misconfigured") return resolved;
  const client = resolved.client;

  const claimedAt = new Date(input.now ?? Date.now()).toISOString();
  const claimFilter = input.includeErrorRetry
    ? `${ANALYSIS_PENDING_CLAIM_FILTER},${ANALYSIS_RETRY_ERROR_CLAIM_FILTER}`
    : ANALYSIS_PENDING_CLAIM_FILTER;

  const { data: claimedRows, error: claimErr } = await client
    .from("takes")
    .update({
      status: "processing",
      processing_phase: "analysing",
      error_message: null,
      analysis_run_id: input.analysisRunId,
      report_model_status: "pending",
      updated_at: claimedAt,
    })
    .eq("id", takeId)
    .or(claimFilter)
    .select("id");

  if (claimErr) {
    return { kind: "claim_error", error: safeErrorSummary(claimErr) };
  }
  if (Array.isArray(claimedRows) && claimedRows.length > 0) {
    return { kind: "claimed", analysisRunId: input.analysisRunId };
  }

  const { data: current, error: readErr } = await client
    .from("takes")
    .select("status, processing_phase, updated_at")
    .eq("id", takeId)
    .maybeSingle();

  if (readErr) {
    return { kind: "claim_error", error: safeErrorSummary(readErr) };
  }
  if (!current) return { kind: "missing" };

  const status = current.status ?? null;
  const processingPhase = current.processing_phase ?? null;
  if (status === "complete") return { kind: "already_complete" };
  if (
    status === "processing" &&
    ANALYSIS_ACTIVE_PROCESSING_PHASES.includes(
      processingPhase as (typeof ANALYSIS_ACTIVE_PROCESSING_PHASES)[number],
    )
  ) {
    return {
      kind: "already_processing",
      processingPhase,
      updatedAt: current.updated_at ?? null,
    };
  }
  return { kind: "not_runnable", status, processingPhase };
}

export type HeartbeatTakeResult =
  | { kind: "updated" }
  | { kind: "not_active" }
  | { kind: "heartbeat_error"; error: { code: string | null; message: string | null } }
  | ServerMisconfigured;

/**
 * Refreshes a take's `updated_at` so the orphan reconciler does not force-error
 * a still-running take. Touches ONLY `updated_at`, and only for active phases —
 * mirrors writeProcessingHeartbeat in process-take.server.ts, plus the same
 * analysisRunId ownership guard as the other write helpers: a stale Worker that
 * no longer owns the take (reclaimed by a newer run) cannot keep its `updated_at`
 * fresh and must stop heartbeating (returns not_active). Returns not_active for a
 * miss (stale or no-longer-active) without a readback — heartbeat misses are benign.
 */
export async function heartbeatTake(
  takeId: string,
  analysisRunId: string,
  env?: AnalysisRuntimeEnvInput | null,
  deps?: AnalysisSupabaseDeps,
): Promise<HeartbeatTakeResult> {
  const resolved = resolveClient(env, deps);
  if (resolved.kind === "server_misconfigured") return resolved;

  const { data, error } = await resolved.client
    .from("takes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", takeId)
    .in("status", ["pending", "processing"])
    .in("processing_phase", ["analysis_pending", "analysing", "finalising"])
    .eq("analysis_run_id", analysisRunId)
    .select("id");

  if (error) return { kind: "heartbeat_error", error: safeErrorSummary(error) };
  return Array.isArray(data) && data.length > 0 ? { kind: "updated" } : { kind: "not_active" };
}

export type LoadTakeContextResult =
  | { kind: "loaded"; take: AnalysisTakeContextRow; audition: AnalysisAuditionContextRow | null }
  | { kind: "take_not_found" }
  | { kind: "load_error"; error: { code: string | null; message: string | null } }
  | ServerMisconfigured;

/**
 * Loads the raw take row and its audition row. RAW DB READS ONLY — no brief
 * extraction, AI calls, comparison assembly or any pipeline decision logic
 * (those belong to the pipeline / Slice 4).
 */
export async function loadTakeContext(
  takeId: string,
  env?: AnalysisRuntimeEnvInput | null,
  deps?: AnalysisSupabaseDeps,
): Promise<LoadTakeContextResult> {
  const resolved = resolveClient(env, deps);
  if (resolved.kind === "server_misconfigured") return resolved;
  const client = resolved.client;

  const { data: take, error: takeErr } = await client
    .from("takes")
    .select(TAKE_CONTEXT_SELECT)
    .eq("id", takeId)
    .maybeSingle();

  if (takeErr) return { kind: "load_error", error: safeErrorSummary(takeErr) };
  if (!take) return { kind: "take_not_found" };

  const takeRow = take as unknown as AnalysisTakeContextRow;

  const { data: audition, error: auditionErr } = await client
    .from("auditions")
    .select(AUDITION_CONTEXT_SELECT)
    .eq("id", takeRow.audition_id)
    .maybeSingle();

  if (auditionErr) return { kind: "load_error", error: safeErrorSummary(auditionErr) };

  return {
    kind: "loaded",
    take: takeRow,
    audition: (audition as unknown as AnalysisAuditionContextRow | null) ?? null,
  };
}

type WriteMiss =
  | { kind: "stale_run" }
  | { kind: "not_active" }
  | { kind: "missing" }
  | { kind: "readback_error"; error: { code: string | null; message: string | null } };

/**
 * Classifies why a run-id-guarded write matched no row. Because this adapter
 * takes a caller-supplied analysisRunId, a 0-row write can mean the row was
 * reclaimed by a newer run (stale_run — a safe no-op that must NOT overwrite the
 * newer run), left the active state (not_active), or was deleted (missing).
 */
async function classifyWriteMiss(
  client: AnalysisSupabaseClient,
  takeId: string,
  expectedRunId: string,
): Promise<WriteMiss> {
  const { data, error } = await client
    .from("takes")
    .select("status, processing_phase, analysis_run_id")
    .eq("id", takeId)
    .maybeSingle();
  if (error) return { kind: "readback_error", error: safeErrorSummary(error) };
  if (!data) return { kind: "missing" };
  if ((data.analysis_run_id ?? null) !== expectedRunId) return { kind: "stale_run" };
  return { kind: "not_active" };
}

export type SaveReportResult =
  | { kind: "saved" }
  | { kind: "stale_run" }
  | { kind: "not_active" }
  | { kind: "missing" }
  | { kind: "save_error"; error: { code: string | null; message: string | null } }
  | ServerMisconfigured;

/**
 * Intermediate/optional report persistence. Writes the report columns guarded
 * by the active processing state AND the caller-supplied analysisRunId, sets
 * report_model_status='rendered', but does NOT flip status. The run-id guard
 * means a stale run cannot overwrite a newer run's report (returns stale_run).
 * The normal finalisation path is markTakeComplete.
 */
export async function saveReport(
  takeId: string,
  payload: AnalysisCompletePayload,
  env?: AnalysisRuntimeEnvInput | null,
  deps?: AnalysisSupabaseDeps,
): Promise<SaveReportResult> {
  const resolved = resolveClient(env, deps);
  if (resolved.kind === "server_misconfigured") return resolved;

  const { data, error } = await resolved.client
    .from("takes")
    .update({
      report: payload.report as never,
      scores: payload.scores as never,
      overall_score: coerceScore(payload.overallScore),
      confidence: coerceScore(payload.confidence),
      compliance_flags: payload.complianceFlags as never,
      score_breakdown: payload.scoreBreakdown as never,
      report_model_status: "rendered",
    })
    .eq("id", takeId)
    .eq("status", "processing")
    .in("processing_phase", [...REPORT_WRITABLE_PROCESSING_PHASES])
    .eq("analysis_run_id", payload.analysisRunId)
    .select("id");

  if (error) return { kind: "save_error", error: safeErrorSummary(error) };
  if (Array.isArray(data) && data.length > 0) return { kind: "saved" };
  const miss = await classifyWriteMiss(resolved.client, takeId, payload.analysisRunId);
  if (miss.kind === "readback_error") return { kind: "save_error", error: miss.error };
  return miss;
}

export type MarkTakeCompleteResult =
  | { kind: "completed" }
  | { kind: "stale_run" }
  | { kind: "not_active" }
  | { kind: "missing" }
  | { kind: "complete_error"; error: { code: string | null; message: string | null } }
  | ServerMisconfigured;

/**
 * Normal finalisation path. Writes the final report columns AND the complete
 * state together in ONE guarded atomic update — mirrors the completion update
 * in process-take.server.ts, plus an analysisRunId ownership guard. Guarded by
 * `status='processing' AND processing_phase IN ('analysing','finalising') AND
 * analysis_run_id = payload.analysisRunId`, so it never overwrites an
 * already-complete/errored take, one that left the active state (not_active),
 * or one a newer run has reclaimed (stale_run).
 */
export async function markTakeComplete(
  takeId: string,
  payload: AnalysisCompletePayload,
  env?: AnalysisRuntimeEnvInput | null,
  deps?: AnalysisSupabaseDeps,
): Promise<MarkTakeCompleteResult> {
  const resolved = resolveClient(env, deps);
  if (resolved.kind === "server_misconfigured") return resolved;

  const { data, error } = await resolved.client
    .from("takes")
    .update({
      status: "complete",
      processing_phase: "complete",
      analysis_run_id: payload.analysisRunId,
      report_model_status: "rendered",
      report: payload.report as never,
      scores: payload.scores as never,
      overall_score: coerceScore(payload.overallScore),
      confidence: coerceScore(payload.confidence),
      error_message: null,
      compliance_flags: payload.complianceFlags as never,
      score_breakdown: payload.scoreBreakdown as never,
    })
    .eq("id", takeId)
    .eq("status", "processing")
    .in("processing_phase", [...REPORT_WRITABLE_PROCESSING_PHASES])
    .eq("analysis_run_id", payload.analysisRunId)
    .select("id");

  if (error) return { kind: "complete_error", error: safeErrorSummary(error) };
  if (Array.isArray(data) && data.length > 0) return { kind: "completed" };
  const miss = await classifyWriteMiss(resolved.client, takeId, payload.analysisRunId);
  if (miss.kind === "readback_error") return { kind: "complete_error", error: miss.error };
  return miss;
}

export type MarkTakeErrorResult =
  | { kind: "marked" }
  | { kind: "stale_run" }
  | { kind: "not_active" }
  | { kind: "missing" }
  | { kind: "mark_error_failed"; error: { code: string | null; message: string | null } }
  | ServerMisconfigured;

/**
 * Writes the terminal failure state with the safe `[failure_code:CODE] message`
 * format. Like the other write helpers, it is guarded by the active processing
 * state AND the caller-supplied analysisRunId — a deliberate, safe strengthening
 * over markTerminalFailure in process-take.server.ts (which updates by id only),
 * because this Worker-facing adapter takes a caller-supplied run id and must not
 * let a stale delivery error-out a take a newer run has reclaimed (stale_run).
 * `code` and `message` must be operator-safe (no secrets / signed URLs / raw
 * model output); the caller is responsible for using safe values.
 */
export async function markTakeError(
  takeId: string,
  code: string,
  message: string,
  analysisRunId: string,
  env?: AnalysisRuntimeEnvInput | null,
  deps?: AnalysisSupabaseDeps,
): Promise<MarkTakeErrorResult> {
  const resolved = resolveClient(env, deps);
  if (resolved.kind === "server_misconfigured") return resolved;

  const { data, error } = await resolved.client
    .from("takes")
    .update({
      status: "error",
      processing_phase: "error",
      error_message: `[failure_code:${code}] ${message}`,
      analysis_run_id: analysisRunId,
      report_model_status: "failed",
    })
    .eq("id", takeId)
    .eq("status", "processing")
    .in("processing_phase", [...REPORT_WRITABLE_PROCESSING_PHASES])
    .eq("analysis_run_id", analysisRunId)
    .select("id");

  if (error) return { kind: "mark_error_failed", error: safeErrorSummary(error) };
  if (Array.isArray(data) && data.length > 0) return { kind: "marked" };
  const miss = await classifyWriteMiss(resolved.client, takeId, analysisRunId);
  if (miss.kind === "readback_error") return { kind: "mark_error_failed", error: miss.error };
  return miss;
}

export type SaveQaArtifactInput = {
  /** Storage object path within the bucket (caller builds the canonical path). */
  storagePath: string;
  /** Serialised artefact body (e.g. JSON string). */
  body: string;
  /** Defaults to application/json. */
  contentType?: string;
};

export type SaveQaArtifactResult =
  | { kind: "written"; bucket: string; storagePath: string; warning: string | null }
  | {
      kind: "qa_write_failed";
      bucket: string;
      warning: string | null;
      error: { code: string | null; message: string | null };
    }
  | ServerMisconfigured;

/**
 * Uploads a QA artefact to the configured storage bucket (QA_ARTIFACT_STORAGE_BUCKET,
 * usually `qa-artifacts`), using the canonical bucket resolution (which defaults
 * blank/boolean-like values to `qa-artifacts`). Returns a safe error if the
 * upload fails (e.g. bucket missing) — no raw secret leakage.
 */
export async function saveQaArtifact(
  input: SaveQaArtifactInput,
  env?: AnalysisRuntimeEnvInput | null,
  deps?: AnalysisSupabaseDeps,
): Promise<SaveQaArtifactResult> {
  const resolved = resolveClient(env, deps);
  if (resolved.kind === "server_misconfigured") return resolved;

  const cleanedBucket = resolveAnalysisRuntimeEnv(env).qaArtifactStorageBucket;
  const { bucket, warning } = resolveQAArtifactStorageBucket({
    QA_ARTIFACT_STORAGE_BUCKET: cleanedBucket ?? undefined,
  } as NodeJS.ProcessEnv);

  const { error } = await resolved.client.storage
    .from(bucket)
    .upload(input.storagePath, input.body, {
      upsert: true,
      contentType: input.contentType ?? "application/json",
    });

  if (error) {
    return { kind: "qa_write_failed", bucket, warning, error: safeErrorSummary(error) };
  }
  return { kind: "written", bucket, storagePath: input.storagePath, warning };
}
