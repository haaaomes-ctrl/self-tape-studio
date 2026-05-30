import {
  VIDEO_DURATION_HARD_CAP_COPY,
  buildVideoDurationDecision,
} from "@/lib/video-duration-policy";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { releaseReportCreditForTake } from "@/server/credit-ledger.server";
import { metric } from "@/server/metrics.server";

export type VideoDurationHardCapBlockResult =
  | { blocked: false }
  | {
      blocked: true;
      updated: boolean;
      durationSeconds: number;
      error?: string;
    };

export async function blockTakeForVideoDurationHardCap(params: {
  takeId: string;
  durationSeconds: number;
  source: string;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
}): Promise<VideoDurationHardCapBlockResult> {
  const decision = buildVideoDurationDecision(params.durationSeconds);
  if (decision.canUpload) return { blocked: false };

  metric("video_duration_hard_cap_blocked", {
    take_id: params.takeId,
    source: params.source,
    duration_seconds: decision.durationSeconds,
  });

  try {
    const result = await releaseReportCreditForTake({
      take_id: params.takeId,
      release_status: "released",
      release_reason: "video_duration_hard_cap",
      failure_code: "video_duration_hard_cap",
      metadata: {
        trigger: params.source,
        report_credit_restored_message:
          "A reserved TapeCoach credit was returned because the uploaded video is over the 10-minute limit.",
        duration_seconds: decision.durationSeconds,
      },
    });
    metric("report_credit_released", {
      take_id: params.takeId,
      reason: "video_duration_hard_cap",
      released: result.released,
    });
  } catch (err) {
    console.warn("[video-duration] hard_cap_credit_release_failed", {
      take_id: params.takeId,
      source: params.source,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const { error } = await supabaseAdmin
    .from("takes")
    .update({
      status: "error",
      processing_phase: "error",
      error_message: `[failure_code:video_duration_hard_cap] ${VIDEO_DURATION_HARD_CAP_COPY}`,
      mux_asset_id: params.muxAssetId ?? undefined,
      mux_playback_id: params.muxPlaybackId ?? undefined,
      mux_duration_seconds: decision.durationSeconds,
      mux_status: "ready",
    })
    .eq("id", params.takeId);

  if (error) {
    console.error("[video-duration] hard_cap_take_update_failed", {
      take_id: params.takeId,
      source: params.source,
      duration_seconds: decision.durationSeconds,
      error: error.message,
    });
    metric("phase_transition_failure", {
      take_id: params.takeId,
      reason: "video_duration_hard_cap_update_failed",
    });
    return {
      blocked: true,
      updated: false,
      durationSeconds: decision.durationSeconds,
      error: error.message,
    };
  }

  return { blocked: true, updated: true, durationSeconds: decision.durationSeconds };
}
