import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { metric } from "@/server/metrics.server";
import { getRequestEnv } from "@/worker-entry";

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

function getAnalysisQueue(): AnalysisQueueBinding | null {
  const env = getRequestEnv<AnalysisQueueEnv>();
  return env?.ANALYSIS_QUEUE ?? null;
}

export async function enqueueAnalysisJob(params: {
  takeId: string;
  reason: AnalysisJobReason;
}): Promise<boolean> {
  const queue = getAnalysisQueue();
  if (!queue) {
    console.error("[analysis-queue] ANALYSIS_QUEUE binding unavailable", {
      take_id: params.takeId,
      reason: params.reason,
    });
    metric("analysis_enqueue_failed", {
      take_id: params.takeId,
      reason: params.reason,
      failure_code: "analysis_queue_unavailable",
    });
    return false;
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
    });
    return true;
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
    return false;
  }
}

export async function markAnalysisQueueDispatchFailure(params: {
  takeId: string;
  reason: AnalysisJobReason;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("takes")
    .update({
      status: "error",
      processing_phase: "error",
      error_message:
        "[failure_code:analysis_queue_unavailable] We couldn't start report analysis. Please try again.",
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
    failure_code: "analysis_queue_unavailable",
  });
}

export async function enqueueAnalysisJobOrMarkFailed(params: {
  takeId: string;
  reason: AnalysisJobReason;
}): Promise<boolean> {
  const queued = await enqueueAnalysisJob(params);
  if (!queued) {
    await markAnalysisQueueDispatchFailure(params);
  }
  return queued;
}
