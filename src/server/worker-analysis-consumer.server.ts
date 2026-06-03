// SERVER-ONLY. Cloudflare Worker queue-consumer logic for analysis jobs.
// Do not import this module from client/browser code.
//
// Slice 5: the Worker queue consumer can run analysis in one of two modes,
// selected by ANALYSIS_EXECUTION_MODE and defaulting to the safe compatibility
// path:
//   - current_worker (default): preserve the existing behaviour — call
//     runProcessTake(takeId) (which builds the Lovable provider) inside the
//     Worker runtime env.
//   - direct_openrouter: map the Cloudflare env (Slice 2), build an OpenRouter
//     provider (Slice 1), and call runAnalysisJob (Slice 4) directly. The take's
//     atomic claim and finalisation are owned by runAnalysisJob internally via
//     the (ALS-wrapped) supabaseAdmin against owned Supabase — this module does
//     NOT pre-claim and does NOT pass preClaimed.
//
// The queue handler in worker-entry.ts is responsible for wrapping the call in
// runtimeStorage.run({ ctx, env }) so supabaseAdmin resolves owned Supabase.
import { OpenRouterChatProvider, type AnalysisAiProvider } from "./analysis-ai-provider.server";
import {
  mapCloudflareEnvToAnalysisRuntimeEnvInput,
  resolveAnalysisRuntimeEnv,
  type AnalysisRuntimeEnvInput,
} from "./analysis-runtime-env.server";
import type { RunAnalysisJobParams, RunProcessTakeResult } from "./process-take.server";

export type AnalysisExecutionMode = "current_worker" | "direct_openrouter";
export const DEFAULT_ANALYSIS_EXECUTION_MODE: AnalysisExecutionMode = "current_worker";

/**
 * Resolves the execution mode from the (raw Cloudflare) env. Anything other than
 * the explicit "direct_openrouter" opt-in resolves to the safe current_worker
 * default.
 */
export function resolveAnalysisExecutionMode(
  env: Record<string, unknown> | null | undefined,
): AnalysisExecutionMode {
  return env?.ANALYSIS_EXECUTION_MODE === "direct_openrouter"
    ? "direct_openrouter"
    : DEFAULT_ANALYSIS_EXECUTION_MODE;
}

export type WorkerAnalysisReadiness = {
  execution_mode: AnalysisExecutionMode;
  queue_binding_available: boolean;
  supabase_env_present: boolean;
  openrouter_key_present: boolean;
  mux_env_present: boolean;
  qa_bucket_configured: boolean;
};

/**
 * Safe, boolean-only readiness snapshot for the Worker analysis runtime. Never
 * returns secret values or key prefixes. Built from the Slice 2 diagnostics
 * (which only expose presence booleans and a safe Supabase host).
 */
export function describeWorkerAnalysisReadiness(
  env: Record<string, unknown> | null | undefined,
): WorkerAnalysisReadiness {
  const raw = (env ?? {}) as Record<string, unknown>;
  const resolved = resolveAnalysisRuntimeEnv(mapCloudflareEnvToAnalysisRuntimeEnvInput(raw));
  const d = resolved.diagnostics;
  return {
    execution_mode: resolveAnalysisExecutionMode(raw),
    queue_binding_available: Boolean(raw.ANALYSIS_QUEUE),
    supabase_env_present: d.supabase_url_configured && d.supabase_service_role_key_configured,
    openrouter_key_present: d.openrouter_api_key_configured,
    mux_env_present: d.mux_token_id_present && d.mux_token_secret_present,
    qa_bucket_configured: d.qa_artifact_storage_bucket_present,
  };
}

/**
 * Whether direct-mode dispatch should be allowed to enqueue a job. Requires the
 * owned Supabase pair (so the consumer can mark the take terminal), the
 * OpenRouter key (so analysis can run), Mux env (to fetch/sign media) and the QA
 * bucket. If false, /dispatch must NOT enqueue and should map to the existing
 * safe dispatch-failure path instead of leaving the take stuck.
 */
export function isDirectAnalysisDispatchReady(
  env: Record<string, unknown> | null | undefined,
): boolean {
  const r = describeWorkerAnalysisReadiness(env);
  return (
    r.queue_binding_available &&
    r.supabase_env_present &&
    r.openrouter_key_present &&
    r.mux_env_present &&
    r.qa_bucket_configured
  );
}

function extractStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as { status?: unknown; statusCode?: unknown };
  const value = typeof record.status === "number" ? record.status : record.statusCode;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Classifies a thrown error into a queue ack/retry decision. Retry only
 * classified-transient failures (429, 5xx, network/timeout/abort). Ack
 * classified non-retryable failures (validation/config/auth). Unknown errors
 * default to retry, bounded by the queue's max_retries so they cannot loop
 * forever.
 */
export function classifyThrownError(error: unknown): "ack" | "retry" {
  const status = extractStatus(error);
  if (status === 429 || (status !== null && status >= 500)) return "retry";
  // Other client errors (4xx, e.g. 400/401/403/404/422) are not retryable.
  if (status !== null && status >= 400 && status < 500) return "ack";
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError") return "retry";
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    /(timeout|timed out|abort|network|fetch failed|econn|socket hang|temporarily|rate limit|too many requests|503|502|504)/.test(
      message,
    )
  ) {
    return "retry";
  }
  if (
    /(misconfigured|not configured|invalid|validation|unauthori[sz]ed|forbidden|missing required|bad request|400|401|403|404|422)/.test(
      message,
    )
  ) {
    return "ack";
  }
  return "retry";
}

/** Safe error code for logs — never the full message (avoids leaking values). */
function safeErrorCode(error: unknown): { name: string | null; status: number | null } {
  return {
    name: error instanceof Error ? error.name.slice(0, 60) : null,
    status: extractStatus(error),
  };
}

export type QueuedAnalysisOutcome = {
  outcome: "ack" | "retry";
  mode: AnalysisExecutionMode;
  takeId: string;
  detail: string;
};

export type RunQueuedAnalysisDeps = {
  runProcessTake?: (takeId: string) => Promise<RunProcessTakeResult>;
  runAnalysisJob?: (params: RunAnalysisJobParams) => Promise<RunProcessTakeResult>;
  createOpenRouterProvider?: (env: AnalysisRuntimeEnvInput) => AnalysisAiProvider;
};

function defaultCreateOpenRouterProvider(env: AnalysisRuntimeEnvInput): AnalysisAiProvider {
  return new OpenRouterChatProvider({ env, fetchImpl: fetch });
}

/**
 * Runs one queued analysis job according to the resolved execution mode. Must be
 * invoked inside the Worker runtime env context (runtimeStorage.run) so
 * supabaseAdmin resolves owned Supabase. Returns an ack/retry outcome; the
 * caller maps it to the Cloudflare Queue ack/retry mechanism.
 */
export async function runQueuedAnalysisJob(input: {
  takeId: string;
  reason?: string | null;
  trigger?: string;
  env: Record<string, unknown>;
  deps?: RunQueuedAnalysisDeps;
}): Promise<QueuedAnalysisOutcome> {
  const { takeId, env } = input;
  const deps = input.deps ?? {};
  const reason = input.reason ?? undefined;
  const trigger = input.trigger ?? "cloudflare_queue";
  const mode = resolveAnalysisExecutionMode(env);

  if (mode === "direct_openrouter") {
    const mapped = mapCloudflareEnvToAnalysisRuntimeEnvInput(env);
    const resolved = resolveAnalysisRuntimeEnv(mapped);

    // Already-queued job arrives but direct config is missing: ack (do not loop)
    // with a safe diagnostic. New jobs are blocked earlier at dispatch.
    if (!resolved.supabaseUrl || !resolved.supabaseServiceRoleKey) {
      console.error("[analysis-queue] direct mode missing Supabase env — acking job", {
        take_id: takeId,
        supabase_url_configured: resolved.diagnostics.supabase_url_configured,
        supabase_service_role_key_configured:
          resolved.diagnostics.supabase_service_role_key_configured,
      });
      return { outcome: "ack", mode, takeId, detail: "server_misconfigured_supabase" };
    }
    if (!resolved.openRouterApiKey) {
      console.error("[analysis-queue] direct mode missing OpenRouter key — acking job", {
        take_id: takeId,
        openrouter_api_key_configured: resolved.diagnostics.openrouter_api_key_configured,
      });
      return { outcome: "ack", mode, takeId, detail: "server_misconfigured_openrouter" };
    }

    const createProvider = deps.createOpenRouterProvider ?? defaultCreateOpenRouterProvider;
    const aiProvider = createProvider(mapped);
    const runAnalysisJob =
      deps.runAnalysisJob ?? (await import("./process-take.server")).runAnalysisJob;

    try {
      // No claimTakeForAnalysis here and no preClaimed: runAnalysisJob owns the
      // atomic claim + finalisation internally via supabaseAdmin (owned Supabase).
      const result = await runAnalysisJob({ takeId, trigger, reason, env: mapped, aiProvider });
      return {
        outcome: "ack",
        mode,
        takeId,
        detail: result.ok ? "completed" : "controlled_error",
      };
    } catch (error) {
      const decision = classifyThrownError(error);
      console.error(`[analysis-queue] direct mode job threw — ${decision}`, {
        take_id: takeId,
        error: safeErrorCode(error),
      });
      return { outcome: decision, mode, takeId, detail: `thrown:${decision}` };
    }
  }

  // current_worker (compatibility): existing behaviour, runProcessTake(takeId).
  const runProcessTake =
    deps.runProcessTake ?? (await import("./process-take.server")).runProcessTake;
  try {
    const result = await runProcessTake(takeId);
    return {
      outcome: "ack",
      mode,
      takeId,
      detail: result.ok ? "completed" : "controlled_error",
    };
  } catch (error) {
    const decision = classifyThrownError(error);
    console.error(`[analysis-queue] current_worker job threw — ${decision}`, {
      take_id: takeId,
      error: safeErrorCode(error),
    });
    return { outcome: decision, mode, takeId, detail: `thrown:${decision}` };
  }
}
