import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildMuxHighestMp4Url, getMux, normaliseMuxMp4Url } from "@/server/mux.server";
import { metric } from "@/server/metrics.server";
import { enqueueAnalysisJobOrMarkFailed } from "@/server/analysis-job-queue.server";
import { FINALISING_ORPHAN_MS, recoverFinalisingTake } from "@/server/finalising-recovery.server";
import {
  ReportCreditRequiredError,
  releaseReportCreditForTake,
  reserveReportCreditForTake,
} from "@/server/credit-ledger.server";
import { blockTakeForVideoDurationHardCap } from "@/server/video-duration-hard-cap.server";

const STATIC_RENDITION_HEARTBEAT_STALE_MS = 120_000;

export function classifyStaticRenditionReadyTake(input: {
  status?: string | null;
  processing_phase?: string | null;
  stale_heartbeat_ms: number;
}):
  | "skip_terminal"
  | "skip_fresh_inflight"
  | "recover_stale_analysing"
  | "recover_stale_finalising"
  | "continue" {
  const staleHeartbeatMs = Number.isFinite(input.stale_heartbeat_ms)
    ? input.stale_heartbeat_ms
    : Number.POSITIVE_INFINITY;
  if (input.status === "complete" || input.status === "error") return "skip_terminal";
  if (input.processing_phase === "finalising" && staleHeartbeatMs >= FINALISING_ORPHAN_MS) {
    return "recover_stale_finalising";
  }
  if (input.processing_phase === "finalising") return "skip_fresh_inflight";
  if (
    input.processing_phase === "analysing" &&
    staleHeartbeatMs < STATIC_RENDITION_HEARTBEAT_STALE_MS
  ) {
    return "skip_fresh_inflight";
  }
  if (
    input.processing_phase === "analysing" &&
    staleHeartbeatMs >= STATIC_RENDITION_HEARTBEAT_STALE_MS
  ) {
    return "recover_stale_analysing";
  }
  return "continue";
}

function summariseMuxWebhookBody(rawBody: string): Record<string, unknown> {
  try {
    const payload = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      object?: { id?: string; type?: string };
      data?: Record<string, unknown>;
      created_at?: string;
    };
    const data = (payload.data ?? {}) as {
      id?: string;
      asset_id?: string;
      upload_id?: string;
      status?: string;
      passthrough?: string;
      new_asset_settings?: { passthrough?: string };
      width?: number;
      height?: number;
      duration?: number;
      resolution?: string;
      resolution_tier?: string;
      static_renditions?: {
        files?: Array<{ status?: string; resolution?: string; name?: string }>;
      };
      playback_ids?: Array<{ id?: string; policy?: string }>;
    };
    return {
      parse_status: "ok",
      event_id: payload.id ?? null,
      event_type: payload.type ?? null,
      object_type: payload.object?.type ?? null,
      object_id: payload.object?.id ?? null,
      data_id: data.id ?? null,
      asset_id: data.asset_id ?? null,
      upload_id: data.upload_id ?? null,
      status: data.status ?? null,
      passthrough: data.passthrough ?? data.new_asset_settings?.passthrough ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      duration: data.duration ?? null,
      resolution: data.resolution ?? null,
      resolution_tier: data.resolution_tier ?? null,
      static_rendition_files:
        data.static_renditions?.files?.map((file) => ({
          status: file.status ?? null,
          resolution: file.resolution ?? null,
          name: file.name ?? null,
        })) ?? null,
      playback_ids:
        data.playback_ids?.map((playback) => ({
          id: playback.id ?? null,
          policy: playback.policy ?? null,
        })) ?? null,
      created_at: payload.created_at ?? null,
    };
  } catch {
    return { parse_status: "invalid_json" };
  }
}

async function resolveTakeIdForMuxEvent(data: {
  asset_id?: string;
  passthrough?: string;
  new_asset_settings?: { passthrough?: string };
}): Promise<string | null> {
  const directTakeId = data.passthrough ?? data.new_asset_settings?.passthrough;
  if (directTakeId) return directTakeId;
  if (!data.asset_id) return null;

  const { data: take, error } = await supabaseAdmin
    .from("takes")
    .select("id")
    .eq("mux_asset_id", data.asset_id)
    .maybeSingle();

  if (error) {
    console.error("MUX WEBHOOK failed to resolve take by mux_asset_id", {
      mux_asset_id: data.asset_id,
      error,
    });
    return null;
  }

  return take?.id ?? null;
}

async function reserveReportCreditBeforeAnalysis(params: {
  takeId: string;
  trigger: string;
}): Promise<boolean> {
  try {
    const reservation = await reserveReportCreditForTake({
      take_id: params.takeId,
      metadata: {
        trigger: params.trigger,
        report_credit_amount: 1,
        same_video_credit_policy: "consume_only_if_report_generated",
        commercial_metrics_excluded: false,
      },
    });
    if (reservation.requires_credit_reservation) {
      metric("report_credit_reserved", {
        take_id: params.takeId,
        reason: params.trigger,
      });
    }
    return true;
  } catch (err) {
    if (err instanceof ReportCreditRequiredError) {
      metric("report_credit_rejected", {
        take_id: params.takeId,
        reason: `${params.trigger}_no_funded_credit`,
      });
      await supabaseAdmin
        .from("takes")
        .update({
          status: "error",
          processing_phase: "error",
          error_message: err.message,
        })
        .eq("id", params.takeId);
      return false;
    }
    throw err;
  }
}

async function releaseReservedCreditAfterMuxTerminalFailure(params: {
  takeId: string;
  trigger: string;
  failureCode: string;
  message: string;
}) {
  try {
    const result = await releaseReportCreditForTake({
      take_id: params.takeId,
      release_status: "released",
      release_reason: params.failureCode,
      failure_code: params.failureCode,
      metadata: {
        trigger: params.trigger,
        report_credit_restored_message:
          "A reserved TapeCoach credit was returned because the video could not be prepared for analysis.",
        safe_error_message: params.message.slice(0, 240),
      },
    });
    metric("report_credit_released", {
      take_id: params.takeId,
      reason: params.failureCode,
      release_status: "released",
      released: result.released,
    });
  } catch (err) {
    console.warn("MUX WEBHOOK report credit release after terminal failure failed", {
      takeId: params.takeId,
      trigger: params.trigger,
      failure_code: params.failureCode,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function scheduleTakeFromStaticRenditionReady(params: {
  assetId: string;
  receivedAt: string;
  takeId: string;
}): Promise<Response> {
  const { assetId, receivedAt, takeId } = params;
  const { data: existing } = await supabaseAdmin
    .from("takes")
    .select(
      "status, processing_phase, created_at, updated_at, audition_id, mux_playback_id, mux_duration_seconds, report, scores",
    )
    .eq("id", takeId)
    .single();

  if (!existing) {
    console.warn("MUX WEBHOOK static_rendition.ready take missing", { takeId, assetId });
    return new Response("ok", { status: 200 });
  }

  let playbackId = existing.mux_playback_id ?? null;
  let duration = Number(existing.mux_duration_seconds ?? 0) || null;

  if (!playbackId || !duration || duration <= 0) {
    try {
      const mux = getMux();
      const asset = (await mux.video.assets.retrieve(assetId)) as {
        duration?: number;
        playback_ids?: Array<{ id: string; policy: string }>;
      };
      playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id ?? null;
      duration = typeof asset.duration === "number" ? asset.duration : null;
    } catch (err) {
      console.error("MUX WEBHOOK static_rendition.ready asset lookup failed", {
        takeId,
        assetId,
        err,
      });
      return new Response("ok", { status: 200 });
    }
  }

  if (!playbackId || !duration || duration <= 0) {
    console.warn("MUX WEBHOOK static_rendition.ready missing playback/duration", {
      takeId,
      assetId,
      playbackId,
      duration,
    });
    return new Response("ok", { status: 200 });
  }

  await supabaseAdmin
    .from("takes")
    .update({
      mux_asset_id: assetId,
      mux_playback_id: playbackId,
      mux_mp4_standard_url: normaliseMuxMp4Url(buildMuxHighestMp4Url(playbackId)),
      mux_mp4_high_url: null,
      mux_duration_seconds: duration,
      mux_status: "ready",
    })
    .eq("id", takeId);

  const staleHeartbeatMs = existing.updated_at
    ? Date.now() - new Date(existing.updated_at).getTime()
    : Number.POSITIVE_INFINITY;

  console.log("MUX WEBHOOK static_rendition.ready", {
    take_id: takeId,
    audition_id: existing.audition_id ?? null,
    mux_asset_id: assetId,
    mux_playback_id: playbackId,
    video_duration_seconds: duration,
    stale_heartbeat_ms: staleHeartbeatMs,
    timestamp: receivedAt,
  });

  const recoveryAction = classifyStaticRenditionReadyTake({
    status: existing.status,
    processing_phase: existing.processing_phase,
    stale_heartbeat_ms: staleHeartbeatMs,
  });
  if (recoveryAction === "skip_terminal") {
    console.log("MUX WEBHOOK static_rendition.ready skipping terminal/inflight take", {
      takeId,
      status: existing.status,
      processing_phase: existing.processing_phase,
      recovery_action: recoveryAction,
    });
    return new Response("ok", { status: 200 });
  }

  const hardCapBlock = await blockTakeForVideoDurationHardCap({
    takeId,
    durationSeconds: duration,
    source: "mux_webhook_static_rendition_ready",
    muxAssetId: assetId,
    muxPlaybackId: playbackId,
  });
  if (hardCapBlock.blocked) {
    console.warn("MUX WEBHOOK static_rendition.ready blocked over-hard-cap video", {
      takeId,
      duration_seconds: hardCapBlock.durationSeconds,
      update_persisted: hardCapBlock.updated,
    });
    return new Response("ok", { status: 200 });
  }

  if (recoveryAction === "skip_fresh_inflight") {
    console.log("MUX WEBHOOK static_rendition.ready skipping terminal/inflight take", {
      takeId,
      status: existing.status,
      processing_phase: existing.processing_phase,
      recovery_action: recoveryAction,
    });
    return new Response("ok", { status: 200 });
  }
  if (recoveryAction === "recover_stale_finalising") {
    const result = await recoverFinalisingTake({
      takeId,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
      report: (existing as { report?: unknown }).report,
      scores: (existing as { scores?: unknown }).scores,
      source: "static_rendition.ready",
    });
    console.warn("MUX WEBHOOK static_rendition.ready recovered stale finalising take", {
      takeId,
      status: existing.status,
      processing_phase: existing.processing_phase,
      stale_heartbeat_ms: staleHeartbeatMs,
      result,
    });
    metric("static_rendition_recovered_stale_finalising", {
      take_id: takeId,
      stale_heartbeat_ms: staleHeartbeatMs,
      result,
    });
    return new Response("ok", { status: 200 });
  }
  if (recoveryAction === "recover_stale_analysing") {
    console.warn("MUX WEBHOOK static_rendition.ready recovering stale analysing take", {
      takeId,
      status: existing.status,
      processing_phase: existing.processing_phase,
      stale_heartbeat_ms: staleHeartbeatMs,
    });
    metric("static_rendition_recovered_stale_analysing", {
      take_id: takeId,
      stale_heartbeat_ms: staleHeartbeatMs,
    });
  }

  if (
    existing.processing_phase === "analysis_pending" &&
    staleHeartbeatMs < STATIC_RENDITION_HEARTBEAT_STALE_MS
  ) {
    console.log("MUX WEBHOOK static_rendition.ready observed active prepare loop", {
      takeId,
      stale_heartbeat_ms: staleHeartbeatMs,
    });
    return new Response("ok", { status: 200 });
  }

  const creditReserved = await reserveReportCreditBeforeAnalysis({
    takeId,
    trigger: "mux_webhook_static_rendition_ready",
  });
  if (!creditReserved) {
    return new Response("ok", { status: 200 });
  }

  await supabaseAdmin
    .from("takes")
    .update({ status: "pending", processing_phase: "analysis_pending", error_message: null })
    .eq("id", takeId);

  console.log("MUX WEBHOOK enqueueing analysis from static_rendition.ready", {
    takeId,
    stale_heartbeat_ms: staleHeartbeatMs,
    timestamp: new Date().toISOString(),
  });
  await enqueueAnalysisJobOrMarkFailed({
    takeId,
    reason:
      recoveryAction === "recover_stale_analysing"
        ? "static_rendition_stale_analysing"
        : "static_rendition_ready",
  });

  return new Response("ok", { status: 200 });
}

// Mux webhook receiver. Configure in Mux dashboard:
//   URL:     https://tapecoach.co.uk/api/public/mux-webhook
//   Secret:  store as MUX_WEBHOOK_SECRET in Lovable secrets
//
// We handle:
//   - video.upload.asset_created         → link the new asset to our take row
//   - video.asset.ready                  → renditions usable; gate on duration + URLs, then analyse
//   - video.asset.static_rendition.ready → recover stalled prepare loops once highest.mp4 exists
//   - video.asset.errored                → mark the take errored
//
// Idempotency: takes.mux_asset_id has a UNIQUE index. Duplicate webhook
// deliveries set status to the same values they already have, and we skip
// re-triggering analysis if the take is already past the analysing phase.
export const Route = createFileRoute("/api/public/mux-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const receivedAt = new Date().toISOString();
        // Sanitised headers: drop signature/auth values, keep names + safe metadata.
        const sanitisedHeaders: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          const lower = key.toLowerCase();
          if (lower === "mux-signature" || lower === "authorization" || lower === "cookie") {
            sanitisedHeaders[key] = "[redacted]";
          } else {
            sanitisedHeaders[key] = value;
          }
        });
        console.log("MUX WEBHOOK RECEIVED", {
          timestamp: receivedAt,
          method: request.method,
          url: request.url,
          headers: sanitisedHeaders,
        });

        const secret = process.env.MUX_WEBHOOK_SECRET;
        if (!secret) {
          console.error("MUX_WEBHOOK_SECRET is not configured — rejecting webhook");
          return new Response("webhook secret not configured", { status: 401 });
        }

        const sigHeader = request.headers.get("mux-signature");
        if (!sigHeader) {
          console.warn("Mux webhook missing mux-signature header", { timestamp: receivedAt });
          return new Response("missing signature", { status: 401 });
        }

        const rawBody = await request.text();
        console.log("MUX WEBHOOK BODY SUMMARY", {
          timestamp: receivedAt,
          length: rawBody.length,
          ...summariseMuxWebhookBody(rawBody),
        });

        // Surface event.type as early as possible (pre-verification peek for logging only).
        try {
          const peek = JSON.parse(rawBody) as { type?: string };
          console.log("MUX WEBHOOK EVENT TYPE (pre-verify)", {
            timestamp: receivedAt,
            type: peek?.type ?? "(unknown)",
          });
        } catch {
          console.warn("MUX WEBHOOK body is not valid JSON (pre-verify)", {
            timestamp: receivedAt,
          });
        }

        console.log("MUX WEBHOOK verifying signature…", { timestamp: receivedAt });
        try {
          const mux = getMux();
          mux.webhooks.verifySignature(rawBody, { "mux-signature": sigHeader }, secret);
          console.log("MUX WEBHOOK signature verified ✓", { timestamp: receivedAt });
        } catch (err) {
          console.error("Mux webhook signature verification failed", err);
          return new Response("invalid signature", { status: 401 });
        }

        let payload: { type?: string; data?: Record<string, unknown> };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const type = payload.type ?? "";
        const data = (payload.data ?? {}) as {
          id?: string;
          asset_id?: string;
          passthrough?: string;
          new_asset_settings?: { passthrough?: string };
          playback_ids?: Array<{ id: string; policy: string }>;
          duration?: number;
          errors?: { messages?: string[] };
        };

        // takeId may live on the asset (passthrough), the upload's
        // new_asset_settings.passthrough (for video.upload.* events), or must
        // be recovered via mux_asset_id for static-rendition events.
        const takeId = await resolveTakeIdForMuxEvent(data);
        if (!takeId) return new Response("ok", { status: 200 });

        if (type === "video.upload.asset_created") {
          const assetId = (data.asset_id as string | undefined) ?? null;
          if (!assetId) return new Response("ok", { status: 200 });
          console.log("[take-pipeline] mux upload.asset_created", {
            take_id: takeId,
            mux_asset_id: assetId,
            timestamp: receivedAt,
          });
          await supabaseAdmin
            .from("takes")
            .update({
              mux_asset_id: assetId,
              mux_status: "transcoding",
              processing_phase: "transcoding",
            })
            .eq("id", takeId);
          metric("mux_upload_created", {
            take_id: takeId,
            processing_phase: "transcoding",
          });
          return new Response("ok", { status: 200 });
        }

        if (type === "video.asset.ready") {
          const playbackId = data.playback_ids?.find((p) => p.policy === "public")?.id;
          const duration = typeof data.duration === "number" ? data.duration : null;

          // Readiness gate: require playback id AND a positive duration.
          if (!playbackId || !duration || duration <= 0) {
            console.warn("asset.ready missing playback_id or duration; skipping", { takeId });
            return new Response("ok", { status: 200 });
          }

          const mp4Standard = normaliseMuxMp4Url(buildMuxHighestMp4Url(playbackId));

          // Idempotency: only flip into the analysing phase if we haven't
          // already kicked off (or completed) analysis for this take.
          const { data: existing } = await supabaseAdmin
            .from("takes")
            .select("status, processing_phase, created_at, audition_id")
            .eq("id", takeId)
            .single();

          const elapsedSinceUpload = existing?.created_at
            ? Date.now() - new Date(existing.created_at).getTime()
            : null;

          console.log("[take-pipeline] mux video.asset.ready", {
            take_id: takeId,
            audition_id: existing?.audition_id ?? null,
            mux_asset_id: data.id ?? null,
            mux_playback_id: playbackId,
            video_duration_seconds: duration,
            elapsed_ms_since_upload: elapsedSinceUpload,
            timestamp: new Date().toISOString(),
          });
          metric("mux_asset_ready", {
            take_id: takeId,
            duration_ms: elapsedSinceUpload ?? undefined,
            processing_phase: "transcoding",
          });
          metric("transcoding_to_analysis_pending", {
            take_id: takeId,
            duration_ms: elapsedSinceUpload ?? undefined,
          });

          await supabaseAdmin
            .from("takes")
            .update({
              mux_asset_id: data.id ?? null,
              mux_playback_id: playbackId,
              mux_mp4_standard_url: mp4Standard,
              mux_mp4_high_url: null,
              mux_duration_seconds: duration,
              mux_status: "ready",
            })
            .eq("id", takeId);

          if (existing?.status !== "complete") {
            const hardCapBlock = await blockTakeForVideoDurationHardCap({
              takeId,
              durationSeconds: duration,
              source: "mux_webhook_asset_ready",
              muxAssetId: data.id ?? null,
              muxPlaybackId: playbackId,
            });
            if (hardCapBlock.blocked) {
              console.warn("MUX WEBHOOK asset.ready blocked over-hard-cap video", {
                takeId,
                duration_seconds: hardCapBlock.durationSeconds,
                update_persisted: hardCapBlock.updated,
              });
              return new Response("ok", { status: 200 });
            }
          }

          // Idempotency: skip if this take is already complete or has an
          // analysis in flight (analysis_pending = scheduled but not started,
          // analysing = currently running). The stale-analysis cron job is
          // responsible for retrying anything that gets stuck in either state.
          if (
            existing?.status === "complete" ||
            existing?.processing_phase === "analysing" ||
            existing?.processing_phase === "analysis_pending" ||
            existing?.processing_phase === "finalising"
          ) {
            console.log("MUX WEBHOOK skipping — analysis already underway", {
              takeId,
              status: existing?.status,
              processing_phase: existing?.processing_phase,
            });
            metric("already_running_skip", {
              take_id: takeId,
              processing_phase: existing?.processing_phase ?? null,
              reason: "webhook_asset_ready",
            });
            return new Response("ok", { status: 200 });
          }

          // Funded-credit gate before triggering AI. This covers legacy rows,
          // webhook races and retry paths where the upload URL was minted
          // before DS-12 reservation existed.
          const creditReserved = await reserveReportCreditBeforeAnalysis({
            takeId,
            trigger: "mux_webhook_asset_ready",
          });
          if (!creditReserved) {
            return new Response("ok", { status: 200 });
          }

          // Mark the take as queued — runProcessTake itself will flip the
          // phase to "analysing" once it actually begins work. This lets the
          // stale-analysis reconciler distinguish "scheduled but never
          // picked up" from "started but never finished".
          await supabaseAdmin
            .from("takes")
            .update({ status: "pending", processing_phase: "analysis_pending" })
            .eq("id", takeId);

          // Enqueue the AI analysis into Cloudflare Queues. The webhook must
          // not run the full model + final persistence lifecycle in
          // ctx.waitUntil; live runs can exceed that background lifetime.
          console.log("MUX WEBHOOK enqueueing analysis job", {
            takeId,
            timestamp: new Date().toISOString(),
          });
          await enqueueAnalysisJobOrMarkFailed({ takeId, reason: "mux_asset_ready" });
          return new Response("ok", { status: 200 });
        }

        if (type === "video.asset.static_rendition.ready") {
          const assetId = data.asset_id ?? null;
          if (!assetId) {
            console.warn("static_rendition.ready missing asset_id", { takeId });
            return new Response("ok", { status: 200 });
          }

          return scheduleTakeFromStaticRenditionReady({
            assetId,
            receivedAt,
            takeId,
          });
        }

        if (type === "video.asset.errored" || type === "video.upload.errored") {
          const msg = data.errors?.messages?.join("; ") ?? "Mux failed to transcode the upload.";
          const { error: updateError } = await supabaseAdmin
            .from("takes")
            .update({
              mux_status: "errored",
              status: "error",
              processing_phase: "error",
              error_message: `Transcoding failed: ${msg}`,
            })
            .eq("id", takeId);
          if (updateError) {
            console.error("MUX WEBHOOK terminal failure update failed", {
              takeId,
              type,
              error: updateError.message,
            });
          }
          await releaseReservedCreditAfterMuxTerminalFailure({
            takeId,
            trigger: type,
            failureCode: "mux_transcoding_error",
            message: msg,
          });
          if (type === "video.asset.errored") {
            metric("mux_asset_error", { take_id: takeId, reason: "video.asset.errored" });
          } else {
            metric("mux_upload_error", { take_id: takeId, reason: "video.upload.errored" });
          }
          metric("analysis_failed", {
            take_id: takeId,
            reason: "mux_transcoding_error",
            processing_phase: "transcoding",
          });
          return new Response("ok", { status: 200 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
