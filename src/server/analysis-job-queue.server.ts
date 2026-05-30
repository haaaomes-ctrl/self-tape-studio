import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { metric } from "@/server/metrics.server";
import { releaseReportCreditForTake } from "@/server/credit-ledger.server";
import { getRequestCtx, getRequestEnv, scheduleBackground } from "@/worker-entry";

export type AnalysisJobReason =
  | "mux_asset_ready"
  | "static_rendition_ready"
  | "static_rendition_stale_analysing"
  | "reconciler_stale_pending"
  | "reconciler_stale_analysing";

export type AnalysisJobMessage = {
  takeId: string;
  reason: AnalysisJobReason;
  enqueuedAt: string;
};

type AnalysisQueueBinding = {
  send(message: AnalysisJobMessage): Promise<void>;
};

type AnalysisQueueEnv = {
  ANALYSIS_QUEUE?: AnalysisQueueBinding;
};

type AnalysisDispatchEnv = AnalysisQueueEnv & {
  ANALYSIS_DISPATCH_URL?: string;
  ANALYSIS_DISPATCH_SECRET?: string;
};

export type AnalysisDispatchTrigger =
  | "mux_webhook"
  | "manual"
  | "retry"
  | "reconciler"
  | "operator_test";

type AnalysisDispatchParams = {
  takeId: string;
  reason: AnalysisJobReason;
  auditionId?: string | null;
  submissionId?: string | null;
  trigger?: AnalysisDispatchTrigger;
};

type AnalysisDispatchDeps = {
  env?: AnalysisDispatchEnv | null;
  fetch?: typeof fetch;
  hasRequestContext?: () => boolean;
  scheduleBackground?: (promise: Promise<unknown>, label?: string) => void;
  runProcessTake?: (takeId: string) => Promise<unknown>;
};

export type AnalysisDispatchResult = {
  ok: boolean;
  method: "queue" | "wait_until_fallback" | "none";
  failureCode?:
    | "analysis_external_dispatch_secret_missing"
    | "analysis_external_dispatch_unauthorised"
    | "analysis_external_queue_unavailable"
    | "analysis_external_dispatch_failed"
    | "analysis_external_dispatch_invalid_response"
    | "analysis_external_dispatch_take_lookup_failed"
    | "analysis_queue_unavailable"
    | "analysis_queue_send_failed"
    | "analysis_dispatch_unavailable";
};

function getRuntimeEnv(deps: AnalysisDispatchDeps = {}): AnalysisDispatchEnv | null {
  if (deps.env !== undefined) return deps.env;
  const requestEnv = getRequestEnv<AnalysisDispatchEnv>() ?? {};
  return {
    ...requestEnv,
    ANALYSIS_DISPATCH_URL: requestEnv.ANALYSIS_DISPATCH_URL ?? process.env.ANALYSIS_DISPATCH_URL,
    ANALYSIS_DISPATCH_SECRET:
      requestEnv.ANALYSIS_DISPATCH_SECRET ?? process.env.ANALYSIS_DISPATCH_SECRET,
  };
}

function getAnalysisQueue(env: AnalysisDispatchEnv | null): AnalysisQueueBinding | null {
  return env?.ANALYSIS_QUEUE ?? null;
}

function cleanEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function triggerForReason(reason: AnalysisJobReason): AnalysisDispatchTrigger {
  if (reason === "reconciler_stale_pending" || reason === "reconciler_stale_analysing") {
    return "reconciler";
  }
  return "mux_webhook";
}

function safeDispatchUrlLabel(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[invalid-url]";
  }
}

function isQueueUnavailablePayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return (
    record.dispatch_method === "queue_unavailable" ||
    record.error === "queue_unavailable" ||
    record.failure_code === "queue_unavailable" ||
    record.code === "queue_unavailable" ||
    record.queue_unavailable === true
  );
}

function isExternalQueueSuccess(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return record.ok === true && record.dispatch_method === "queue" && record.queued === true;
}

async function resolveExternalDispatchContext(
  params: AnalysisDispatchParams,
): Promise<{ auditionId: string | null; submissionId: string | null } | null> {
  if (params.auditionId) {
    return {
      auditionId: params.auditionId,
      submissionId: params.submissionId ?? params.auditionId,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("takes")
    .select("audition_id")
    .eq("id", params.takeId)
    .maybeSingle();

  if (error) {
    console.error("[analysis-queue] external dispatch context lookup failed", {
      take_id: params.takeId,
      reason: params.reason,
      error: error.message,
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_external_dispatch_take_lookup_failed",
    });
    return null;
  }

  const auditionId = data?.audition_id ?? null;
  return {
    auditionId,
    submissionId: params.submissionId ?? auditionId,
  };
}

async function dispatchAnalysisJobExternally(
  params: AnalysisDispatchParams,
  dispatchUrl: string,
  dispatchSecret: string,
  deps: AnalysisDispatchDeps = {},
): Promise<AnalysisDispatchResult> {
  const context = await resolveExternalDispatchContext(params);
  if (!context) {
    return {
      ok: false,
      method: "none",
      failureCode: "analysis_external_dispatch_take_lookup_failed",
    };
  }

  const trigger = params.trigger ?? triggerForReason(params.reason);
  const fetchImpl = deps.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(dispatchUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${dispatchSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        take_id: params.takeId,
        audition_id: context.auditionId,
        submission_id: context.submissionId,
        trigger,
        reason: params.reason,
      }),
    });
  } catch (error) {
    console.error("[analysis-queue] external dispatch request failed", {
      take_id: params.takeId,
      reason: params.reason,
      dispatch_url: safeDispatchUrlLabel(dispatchUrl),
      error: error instanceof Error ? error.message : String(error),
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_external_dispatch_failed",
      dispatch_source: "external_worker",
    });
    return { ok: false, method: "none", failureCode: "analysis_external_dispatch_failed" };
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (response.status === 401 || response.status === 403) {
    console.error("[analysis-queue] external dispatch unauthorised", {
      take_id: params.takeId,
      reason: params.reason,
      http_status: response.status,
      dispatch_url: safeDispatchUrlLabel(dispatchUrl),
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_external_dispatch_unauthorised",
      http_status: response.status,
      dispatch_source: "external_worker",
    });
    return { ok: false, method: "none", failureCode: "analysis_external_dispatch_unauthorised" };
  }

  if (!response.ok || isQueueUnavailablePayload(payload)) {
    const failureCode = isQueueUnavailablePayload(payload)
      ? "analysis_external_queue_unavailable"
      : "analysis_external_dispatch_failed";
    console.error("[analysis-queue] external dispatch failed", {
      take_id: params.takeId,
      reason: params.reason,
      http_status: response.status,
      dispatch_url: safeDispatchUrlLabel(dispatchUrl),
      failure_code: failureCode,
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: failureCode,
      http_status: response.status,
      dispatch_source: "external_worker",
    });
    return { ok: false, method: "none", failureCode };
  }

  if (!isExternalQueueSuccess(payload)) {
    console.error("[analysis-queue] external dispatch invalid response", {
      take_id: params.takeId,
      reason: params.reason,
      http_status: response.status,
      dispatch_url: safeDispatchUrlLabel(dispatchUrl),
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_external_dispatch_invalid_response",
      http_status: response.status,
      dispatch_source: "external_worker",
    });
    return {
      ok: false,
      method: "none",
      failureCode: "analysis_external_dispatch_invalid_response",
    };
  }

  console.log("[analysis-queue] external worker queued job", {
    take_id: params.takeId,
    audition_id: context.auditionId,
    submission_id: context.submissionId,
    trigger,
    reason: params.reason,
    dispatch_method: "queue",
  });
  metric("analysis_job_enqueued", {
    take_id: params.takeId,
    reason: params.reason,
    dispatch_method: "queue",
    dispatch_source: "external_worker",
  });
  return { ok: true, method: "queue" };
}

async function runAnalysisFallback(
  params: AnalysisDispatchParams,
  deps: AnalysisDispatchDeps = {},
): Promise<AnalysisDispatchResult> {
  const hasRequestContext = deps.hasRequestContext ?? (() => Boolean(getRequestCtx()));
  if (!hasRequestContext()) {
    console.error("[analysis-queue] waitUntil fallback unavailable", {
      take_id: params.takeId,
      reason: params.reason,
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_dispatch_unavailable",
    });
    return {
      ok: false,
      method: "none",
      failureCode: "analysis_dispatch_unavailable",
    };
  }

  const schedule = deps.scheduleBackground ?? scheduleBackground;
  const run =
    deps.runProcessTake ??
    (async (takeId: string) => {
      const mod = await import("@/server/process-take.server");
      return mod.runProcessTake(takeId);
    });

  let fallbackScheduled = false;
  const fallbackTask = Promise.resolve().then(async () => {
    if (!fallbackScheduled) return { skipped: true };
    const result = await run(params.takeId);
    console.log("[analysis-queue] waitUntil fallback completed", {
      take_id: params.takeId,
      reason: params.reason,
      result,
    });
    return result;
  });

  try {
    schedule(fallbackTask, `analysis-fallback:${params.reason}:${params.takeId}`);
    fallbackScheduled = true;
  } catch (error) {
    fallbackTask.catch((err) => {
      console.error("[analysis-queue] waitUntil fallback task failed after scheduler rejection", {
        take_id: params.takeId,
        reason: params.reason,
        error: err,
      });
    });
    console.error("[analysis-queue] waitUntil fallback scheduling failed", {
      take_id: params.takeId,
      reason: params.reason,
      error,
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_dispatch_unavailable",
    });
    return {
      ok: false,
      method: "none",
      failureCode: "analysis_dispatch_unavailable",
    };
  }
  console.warn("[analysis-queue] waitUntil fallback scheduled", {
    take_id: params.takeId,
    reason: params.reason,
  });
  metric("analysis_job_enqueued", {
    take_id: params.takeId,
    reason: params.reason,
    dispatch_method: "wait_until_fallback",
    degraded: true,
  });
  return { ok: true, method: "wait_until_fallback" };
}

export async function dispatchAnalysisJob(
  params: AnalysisDispatchParams,
  deps: AnalysisDispatchDeps = {},
): Promise<AnalysisDispatchResult> {
  const env = getRuntimeEnv(deps);
  const externalDispatchUrl = cleanEnvValue(env?.ANALYSIS_DISPATCH_URL);
  if (externalDispatchUrl) {
    const externalDispatchSecret = cleanEnvValue(env?.ANALYSIS_DISPATCH_SECRET);
    if (!externalDispatchSecret) {
      console.error("[analysis-queue] external dispatch configured without secret", {
        take_id: params.takeId,
        reason: params.reason,
        dispatch_url: safeDispatchUrlLabel(externalDispatchUrl),
      });
      metric("analysis_enqueue_failed", {
        take_id: params.takeId,
        reason: params.reason,
        failure_code: "analysis_external_dispatch_secret_missing",
        dispatch_source: "external_worker",
      });
      return {
        ok: false,
        method: "none",
        failureCode: "analysis_external_dispatch_secret_missing",
      };
    }
    return dispatchAnalysisJobExternally(params, externalDispatchUrl, externalDispatchSecret, deps);
  }

  const queue = getAnalysisQueue(env);
  if (!queue) {
    console.error(
      "[analysis-queue] ANALYSIS_QUEUE binding unavailable; using waitUntil fallback — analysis may be terminated mid-flight by the request worker. Verify the Cloudflare Queue 'tapecoach-analysis-jobs' is provisioned and the producer binding is attached.",
      {
        take_id: params.takeId,
        reason: params.reason,
      },
    );
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_queue_unavailable",
    });
    const fallback = await runAnalysisFallback(params, deps);
    return fallback.ok
      ? fallback
      : {
          ...fallback,
          failureCode: fallback.failureCode ?? "analysis_queue_unavailable",
        };
  }

  try {
    await queue.send({
      takeId: params.takeId,
      reason: params.reason,
      enqueuedAt: new Date().toISOString(),
    });
    console.log("[analysis-queue] job enqueued", {
      take_id: params.takeId,
      reason: params.reason,
    });
    metric("analysis_job_enqueued", {
      take_id: params.takeId,
      reason: params.reason,
      dispatch_method: "queue",
    });
    return { ok: true, method: "queue" };
  } catch (error) {
    console.error("[analysis-queue] enqueue failed", {
      take_id: params.takeId,
      reason: params.reason,
      error,
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_queue_send_failed",
    });
    const fallback = await runAnalysisFallback(params, deps);
    return fallback.ok
      ? fallback
      : {
          ...fallback,
          failureCode: fallback.failureCode ?? "analysis_queue_send_failed",
        };
  }
}

export async function enqueueAnalysisJob(params: {
  takeId: string;
  reason: AnalysisJobReason;
  auditionId?: string | null;
  submissionId?: string | null;
  trigger?: AnalysisDispatchTrigger;
}): Promise<boolean> {
  const result = await dispatchAnalysisJob(params);
  return result.ok;
}

export async function markAnalysisQueueDispatchFailure(params: {
  takeId: string;
  reason: AnalysisJobReason;
  failureCode?: AnalysisDispatchResult["failureCode"];
}): Promise<void> {
  const failureCode = params.failureCode ?? "analysis_dispatch_unavailable";
  const { error } = await supabaseAdmin
    .from("takes")
    .update({
      status: "error",
      processing_phase: "error",
      error_message: `[failure_code:${failureCode}] We couldn't start report analysis. Please try again.`,
    })
    .eq("id", params.takeId)
    .in("status", ["pending", "processing"]);
  if (error) {
    console.error("[analysis-queue] failed to mark dispatch failure", {
      take_id: params.takeId,
      reason: params.reason,
      error,
    });
    metric("phase_transition_failure", {
      take_id: params.takeId,
      reason: "analysis_queue_dispatch_failure_write_failed",
    });
  } else {
    metric("analysis_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: failureCode,
    });
  }
  try {
    const result = await releaseReportCreditForTake({
      take_id: params.takeId,
      release_status: "released",
      release_reason: failureCode,
      failure_code: failureCode,
      metadata: {
        trigger: "analysis_queue_dispatch_failure",
        analysis_job_reason: params.reason,
        report_credit_restored_message:
          "A reserved TapeCoach credit was returned because report analysis could not be started.",
      },
    });
    metric("report_credit_released", {
      take_id: params.takeId,
      reason: failureCode,
      release_status: "released",
      released: result.released,
    });
  } catch (err) {
    console.warn("[analysis-queue] dispatch_failure_credit_release_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: failureCode,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function enqueueAnalysisJobOrMarkFailed(params: {
  takeId: string;
  reason: AnalysisJobReason;
  auditionId?: string | null;
  submissionId?: string | null;
  trigger?: AnalysisDispatchTrigger;
}): Promise<boolean> {
  const result = await dispatchAnalysisJob(params);
  if (!result.ok) {
    await markAnalysisQueueDispatchFailure({
      ...params,
      failureCode: result.failureCode,
    });
  }
  return result.ok;
}
