import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ANALYSING_ORPHAN_MS, FINALISING_ORPHAN_MS } from "@/server/finalising-recovery.server";
import {
  claimAnalysisRunForTake,
  runProcessTake,
  type AnalysisRunClaimResult,
  type RunProcessTakeOptions,
  type RunProcessTakeResult,
} from "@/server/process-take.server";
import { getRequestEnv } from "@/worker-entry";

type InternalAnalysisRunEnv = {
  ANALYSIS_RUN_SECRET?: string;
};

export type InternalAnalysisRunTrigger =
  | "mux_webhook"
  | "manual"
  | "retry"
  | "reconciler"
  | "operator_test";

type InternalAnalysisRunBody = {
  take_id: string;
  audition_id?: string | null;
  submission_id?: string | null;
  trigger: InternalAnalysisRunTrigger;
  reason?: string;
};

export type InternalAnalysisRunTakeContext = {
  id: string;
  audition_id: string | null;
  status: string | null;
  processing_phase: string | null;
  updated_at: string | null;
};

type ContextLoadResult =
  | { kind: "ok"; take: InternalAnalysisRunTakeContext }
  | { kind: "missing" }
  | { kind: "error" };

type AuditionLoadResult = { kind: "ok" } | { kind: "missing" } | { kind: "error" };

type SafeSupabaseLookupError = {
  code?: string;
  message?: string;
};

type InternalAnalysisTakeLookupClient = {
  from: (table: typeof INTERNAL_ANALYSIS_TAKE_TABLE) => {
    select: (columns: typeof INTERNAL_ANALYSIS_TAKE_SELECT) => {
      eq: (
        column: typeof INTERNAL_ANALYSIS_TAKE_ID_COLUMN,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Partial<InternalAnalysisRunTakeContext> | null;
          error: SafeSupabaseLookupError | null;
        }>;
      };
    };
  };
};

type InternalAnalysisRunDeps = {
  env?: InternalAnalysisRunEnv | null;
  loadTakeContext?: (takeId: string) => Promise<ContextLoadResult>;
  loadAuditionContext?: (auditionId: string) => Promise<AuditionLoadResult>;
  claimAnalysisRun?: (takeId: string) => Promise<AnalysisRunClaimResult>;
  now?: () => number;
  runProcessTake?: (
    takeId: string,
    options?: RunProcessTakeOptions,
  ) => Promise<RunProcessTakeResult>;
};

type SafeErrorCode =
  | "unauthorised"
  | "analysis_run_secret_not_configured"
  | "invalid_json"
  | "invalid_request"
  | "take_not_found"
  | "audition_context_missing"
  | "audition_context_mismatch"
  | "audition_not_found"
  | "analysis_context_unavailable"
  | "analysis_already_processing"
  | "analysis_stale_processing_reconciler_required"
  | "analysis_run_failed"
  | "analysis_run_timeout"
  | "analysis_run_exception";

const UuidSchema = z.string().uuid();
const INTERNAL_ANALYSIS_TAKE_TABLE = "takes";
const INTERNAL_ANALYSIS_TAKE_ID_COLUMN = "id";
const INTERNAL_ANALYSIS_TAKE_SELECT = "id, audition_id, status, processing_phase, updated_at";
const InternalAnalysisRunBodySchema = z
  .object({
    take_id: UuidSchema,
    audition_id: UuidSchema.nullish(),
    submission_id: UuidSchema.nullish(),
    trigger: z.enum(["mux_webhook", "manual", "retry", "reconciler", "operator_test"]),
    reason: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

function getRuntimeEnv(deps: InternalAnalysisRunDeps): InternalAnalysisRunEnv | null {
  if (deps.env !== undefined) return deps.env;
  const requestEnv = getRequestEnv<InternalAnalysisRunEnv>() ?? {};
  return {
    ...requestEnv,
    ANALYSIS_RUN_SECRET: requestEnv.ANALYSIS_RUN_SECRET ?? process.env.ANALYSIS_RUN_SECRET,
  };
}

function cleanEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanUnknownEnvValue(value: unknown): string | null {
  return typeof value === "string" ? cleanEnvValue(value) : null;
}

function serverSupabaseEnvDiagnostics(): Record<string, boolean> {
  const requestEnv = getRequestEnv<Record<string, unknown>>() ?? {};
  return {
    supabase_url_configured: Boolean(
      cleanUnknownEnvValue(requestEnv.SUPABASE_URL) ?? cleanEnvValue(process.env.SUPABASE_URL),
    ),
    supabase_service_role_key_configured: Boolean(
      cleanUnknownEnvValue(requestEnv.SUPABASE_SERVICE_ROLE_KEY) ??
      cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ),
  };
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return Response.json(
    {
      mark_complete: false,
      ...payload,
    },
    {
      status,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function safeErrorResponse(params: {
  status?: number;
  code: SafeErrorCode;
  retryable: boolean;
  takeId?: string;
}): Response {
  return jsonResponse(
    {
      ok: false,
      error: params.code,
      retryable: params.retryable,
      ...(params.takeId ? { take_id: params.takeId } : {}),
    },
    params.status ?? 200,
  );
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
}

function isAuthorised(request: Request, secret: string): boolean {
  return getBearerToken(request) === secret;
}

async function defaultLoadTakeContext(takeId: string): Promise<ContextLoadResult> {
  return loadTakeContextForInternalAnalysis(
    takeId,
    supabaseAdmin as unknown as InternalAnalysisTakeLookupClient,
  );
}

async function loadTakeContextForInternalAnalysis(
  takeId: string,
  client: InternalAnalysisTakeLookupClient,
): Promise<ContextLoadResult> {
  try {
    const { data, error } = await client
      .from(INTERNAL_ANALYSIS_TAKE_TABLE)
      .select(INTERNAL_ANALYSIS_TAKE_SELECT)
      .eq(INTERNAL_ANALYSIS_TAKE_ID_COLUMN, takeId)
      .maybeSingle();

    if (error) {
      console.error("[internal-analysis-runner] take context lookup failed", {
        take_id: takeId,
        client_source: "supabaseAdmin_service_role",
        table: INTERNAL_ANALYSIS_TAKE_TABLE,
        column: INTERNAL_ANALYSIS_TAKE_ID_COLUMN,
        lookup_returned_zero_rows: false,
        ...serverSupabaseEnvDiagnostics(),
        error_code: error.code ?? null,
        error_message: error.message?.slice(0, 160) ?? "unknown",
      });
      return { kind: "error" };
    }
    if (!data) {
      console.warn("[internal-analysis-runner] take context lookup returned no rows", {
        take_id: takeId,
        client_source: "supabaseAdmin_service_role",
        table: INTERNAL_ANALYSIS_TAKE_TABLE,
        column: INTERNAL_ANALYSIS_TAKE_ID_COLUMN,
        lookup_returned_zero_rows: true,
        ...serverSupabaseEnvDiagnostics(),
      });
      return { kind: "missing" };
    }

    const row = data as InternalAnalysisRunTakeContext;
    return {
      kind: "ok",
      take: {
        id: row.id,
        audition_id: row.audition_id ?? null,
        status: row.status ?? null,
        processing_phase: row.processing_phase ?? null,
        updated_at: row.updated_at ?? null,
      },
    };
  } catch {
    console.error("[internal-analysis-runner] take context lookup threw", {
      take_id: takeId,
      client_source: "supabaseAdmin_service_role",
      table: INTERNAL_ANALYSIS_TAKE_TABLE,
      column: INTERNAL_ANALYSIS_TAKE_ID_COLUMN,
      lookup_returned_zero_rows: false,
      ...serverSupabaseEnvDiagnostics(),
    });
    return { kind: "error" };
  }
}

export async function canResolveTakeForInternalAnalysis(
  takeId: string,
  deps: { client?: InternalAnalysisTakeLookupClient } = {},
): Promise<boolean> {
  const result = await loadTakeContextForInternalAnalysis(
    takeId,
    deps.client ?? (supabaseAdmin as unknown as InternalAnalysisTakeLookupClient),
  );
  return result.kind === "ok";
}

async function defaultLoadAuditionContext(auditionId: string): Promise<AuditionLoadResult> {
  try {
    const { data, error } = await supabaseAdmin
      .from("auditions")
      .select("id")
      .eq("id", auditionId)
      .maybeSingle();

    if (error) {
      console.error("[internal-analysis-runner] audition context lookup failed", {
        audition_id: auditionId,
      });
      return { kind: "error" };
    }
    return data ? { kind: "ok" } : { kind: "missing" };
  } catch {
    console.error("[internal-analysis-runner] audition context lookup threw", {
      audition_id: auditionId,
    });
    return { kind: "error" };
  }
}

function classifyActiveProcessing(
  take: InternalAnalysisRunTakeContext,
  now: number,
): "runnable" | "already_complete" | "already_processing" | "stale_processing" {
  if (take.status === "complete") return "already_complete";
  const phase = take.processing_phase;
  if (take.status !== "processing") return "runnable";
  if (phase !== "analysis_pending" && phase !== "analysing" && phase !== "finalising") {
    return "runnable";
  }

  const updatedAtMs = take.updated_at ? Date.parse(take.updated_at) : Number.NaN;
  const idleMs = Number.isFinite(updatedAtMs)
    ? Math.max(0, now - updatedAtMs)
    : Number.POSITIVE_INFINITY;
  const staleMs = phase === "finalising" ? FINALISING_ORPHAN_MS : ANALYSING_ORPHAN_MS;
  return idleMs < staleMs ? "already_processing" : "stale_processing";
}

function normaliseRunnerException(error: unknown): SafeErrorCode {
  const value =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : String(error).toLowerCase();
  return value.includes("timeout") ? "analysis_run_timeout" : "analysis_run_exception";
}

async function parseBody(
  request: Request,
): Promise<{ ok: true; body: InternalAnalysisRunBody } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: safeErrorResponse({
        status: 400,
        code: "invalid_json",
        retryable: false,
      }),
    };
  }

  const parsed = InternalAnalysisRunBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: safeErrorResponse({
        status: 400,
        code: "invalid_request",
        retryable: false,
      }),
    };
  }

  return { ok: true, body: parsed.data };
}

export async function handleInternalAnalysisRunRequest(
  request: Request,
  deps: InternalAnalysisRunDeps = {},
): Promise<Response> {
  const env = getRuntimeEnv(deps);
  const secret = cleanEnvValue(env?.ANALYSIS_RUN_SECRET);
  if (!secret) {
    console.error("[internal-analysis-runner] ANALYSIS_RUN_SECRET is not configured");
    return safeErrorResponse({
      status: 503,
      code: "analysis_run_secret_not_configured",
      retryable: false,
    });
  }

  if (!isAuthorised(request, secret)) {
    return safeErrorResponse({
      status: 401,
      code: "unauthorised",
      retryable: false,
    });
  }

  const parsed = await parseBody(request);
  if (!parsed.ok) return parsed.response;

  const { take_id: takeId, audition_id: suppliedAuditionId, trigger } = parsed.body;
  const loadTakeContext = deps.loadTakeContext ?? defaultLoadTakeContext;
  const takeResult = await loadTakeContext(takeId);

  if (takeResult.kind === "error") {
    return safeErrorResponse({
      status: 503,
      code: "analysis_context_unavailable",
      retryable: true,
      takeId,
    });
  }
  if (takeResult.kind === "missing") {
    return safeErrorResponse({
      status: 404,
      code: "take_not_found",
      retryable: false,
      takeId,
    });
  }

  const take = takeResult.take;
  if (!take.audition_id) {
    return safeErrorResponse({
      status: 409,
      code: "audition_context_missing",
      retryable: false,
      takeId,
    });
  }

  if (suppliedAuditionId && suppliedAuditionId !== take.audition_id) {
    return safeErrorResponse({
      status: 409,
      code: "audition_context_mismatch",
      retryable: false,
      takeId,
    });
  }

  const activeState = classifyActiveProcessing(take, deps.now?.() ?? Date.now());
  if (activeState === "already_complete") {
    return jsonResponse({
      ok: true,
      take_id: takeId,
      already_complete: true,
    });
  }
  if (activeState === "already_processing") {
    return jsonResponse({
      ok: true,
      take_id: takeId,
      already_processing: true,
    });
  }
  if (activeState === "stale_processing") {
    return safeErrorResponse({
      code: "analysis_stale_processing_reconciler_required",
      retryable: false,
      takeId,
    });
  }

  const loadAuditionContext = deps.loadAuditionContext ?? defaultLoadAuditionContext;
  const auditionResult = await loadAuditionContext(take.audition_id);
  if (auditionResult.kind === "error") {
    return safeErrorResponse({
      status: 503,
      code: "analysis_context_unavailable",
      retryable: true,
      takeId,
    });
  }
  if (auditionResult.kind === "missing") {
    return safeErrorResponse({
      status: 404,
      code: "audition_not_found",
      retryable: false,
      takeId,
    });
  }

  const claimAnalysisRun = deps.claimAnalysisRun ?? claimAnalysisRunForTake;
  const claim = await claimAnalysisRun(takeId);
  if (claim.kind === "already_complete") {
    return jsonResponse({
      ok: true,
      take_id: takeId,
      already_complete: true,
    });
  }
  if (claim.kind === "already_processing") {
    return jsonResponse({
      ok: true,
      take_id: takeId,
      already_processing: true,
    });
  }
  if (claim.kind === "stale_processing") {
    return safeErrorResponse({
      code: "analysis_stale_processing_reconciler_required",
      retryable: false,
      takeId,
    });
  }
  if (claim.kind === "missing") {
    return safeErrorResponse({
      status: 404,
      code: "take_not_found",
      retryable: false,
      takeId,
    });
  }
  if (claim.kind === "error") {
    return safeErrorResponse({
      status: 503,
      code: "analysis_context_unavailable",
      retryable: true,
      takeId,
    });
  }
  if (claim.kind === "not_runnable") {
    return jsonResponse({
      ok: true,
      take_id: takeId,
      already_processing: true,
    });
  }

  const runner =
    deps.runProcessTake ??
    ((claimedTakeId: string, runnerOptions?: RunProcessTakeOptions) =>
      runProcessTake(claimedTakeId, false, runnerOptions));
  try {
    console.log("[internal-analysis-runner] starting analysis", {
      take_id: takeId,
      trigger,
    });
    const result = await runner(takeId, { preClaimed: true });
    if (result.ok) {
      return jsonResponse({
        ok: true,
        take_id: takeId,
      });
    }
    console.warn("[internal-analysis-runner] controlled analysis failure", {
      take_id: takeId,
      trigger,
    });
    return safeErrorResponse({
      code: "analysis_run_failed",
      retryable: false,
      takeId,
    });
  } catch (error) {
    const code = normaliseRunnerException(error);
    console.error("[internal-analysis-runner] analysis runner threw", {
      take_id: takeId,
      trigger,
      error_code: code,
      error_name: error instanceof Error ? error.name : typeof error,
    });
    return safeErrorResponse({
      status: 500,
      code,
      retryable: true,
      takeId,
    });
  }
}
