import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { metric } from "@/server/metrics.server";
import {
  getRequestCtx,
  getRequestEnv,
  scheduleBackground,
} from "@/worker-entry";

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

type AnalysisDispatchDeps = {
  env?: AnalysisQueueEnv | null;
  hasRequestContext?: () => boolean;
  scheduleBackground?: (promise: Promise<unknown>, label?: string) => void;
  runProcessTake?: (takeId: string) => Promise<unknown>;
};

export type AnalysisDispatchResult = {
  ok: boolean;
  method: "queue" | "wait_until_fallback" | "none";
  failureCode?: "analysis_queue_unavailable" | "analysis_queue_send_failed" | "analysis_dispatch_unavailable";
};

function getAnalysisQueue(deps: AnalysisDispatchDeps = {}): AnalysisQueueBinding | null {
  const env = deps.env === undefined ? getRequestEnv<AnalysisQueueEnv>() : deps.env;
  return env?.ANALYSIS_QUEUE ?? null;
}

async function runAnalysisFallback(params: {
  takeId: string;
  reason: AnalysisJobReason;
}, deps: AnalysisDispatchDeps = {}): Promise<AnalysisDispatchResult> {
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

export async function dispatchAnalysisJob(params: {
  takeId: string;
  reason: AnalysisJobReason;
}, deps: AnalysisDispatchDeps = {}): Promise<AnalysisDispatchResult> {
  const queue = getAnalysisQueue(deps);
  if (!queue) {
    console.warn("[analysis-queue] ANALYSIS_QUEUE binding unavailable; using waitUntil fallback", {
      take_id: params.takeId,
      reason: params.reason,
    });
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
      error_message:
        `[failure_code:${failureCode}] We couldn't start report analysis. Please try again.`,
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
    return;
  }
  metric("analysis_failed", {
    take_id: params.takeId,
    reason: params.reason,
    failure_code: failureCode,
  });
}

export async function enqueueAnalysisJobOrMarkFailed(params: {
  takeId: string;
  reason: AnalysisJobReason;
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
