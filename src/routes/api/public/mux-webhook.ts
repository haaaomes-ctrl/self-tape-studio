import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMux, muxMp4Url } from "@/server/mux.server";
import { runProcessTake } from "@/server/process-take.server";
import { scheduleBackground } from "@/worker-entry";
import {
  assertWithinAnalysisQuota,
  QuotaExceededError,
  resolveTakeIdentity,
} from "@/server/quota.server";
import { metric } from "@/server/metrics.server";

// Mux webhook receiver. Configure in Mux dashboard:
//   URL:     https://<project>.lovable.app/api/public/mux-webhook
//   Secret:  store as MUX_WEBHOOK_SECRET in Lovable secrets
//
// We handle:
//   - video.upload.asset_created → link the new asset to our take row
//   - video.asset.ready          → renditions usable; gate on duration + URLs, then analyse
//   - video.asset.errored        → mark the take errored
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
        console.log("MUX WEBHOOK RAW BODY", {
          timestamp: receivedAt,
          length: rawBody.length,
          body: rawBody,
        });

        // Surface event.type as early as possible (pre-verification peek for logging only).
        try {
          const peek = JSON.parse(rawBody) as { type?: string };
          console.log("MUX WEBHOOK EVENT TYPE (pre-verify)", {
            timestamp: receivedAt,
            type: peek?.type ?? "(unknown)",
          });
        } catch {
          console.warn("MUX WEBHOOK body is not valid JSON (pre-verify)", { timestamp: receivedAt });
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

        // takeId may live on the asset (passthrough) OR on the upload's
        // new_asset_settings.passthrough (for video.upload.* events).
        const takeId = data.passthrough ?? data.new_asset_settings?.passthrough;
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

          const mp4Standard = muxMp4Url(playbackId, "medium"); // ~720p
          const mp4High = muxMp4Url(playbackId, "high"); // ~1080p

          // Idempotency: only flip into the analysing phase if we haven't
          // already kicked off (or completed) analysis for this take.
          const { data: existing } = await supabaseAdmin
            .from("takes")
            .select("status, processing_phase, created_at, audition_id")
            .eq("id", takeId)
            .single();

          console.log("[take-pipeline] mux video.asset.ready", {
            take_id: takeId,
            audition_id: existing?.audition_id ?? null,
            mux_asset_id: data.id ?? null,
            mux_playback_id: playbackId,
            video_duration_seconds: duration,
            elapsed_ms_since_upload: existing?.created_at
              ? Date.now() - new Date(existing.created_at).getTime()
              : null,
            timestamp: new Date().toISOString(),
          });

          await supabaseAdmin
            .from("takes")
            .update({
              mux_asset_id: data.id ?? null,
              mux_playback_id: playbackId,
              mux_mp4_standard_url: mp4Standard,
              mux_mp4_high_url: mp4High,
              mux_duration_seconds: duration,
              mux_status: "ready",
            })
            .eq("id", takeId);

          // Idempotency: skip if this take is already complete or has an
          // analysis in flight (analysis_pending = scheduled but not started,
          // analysing = currently running). The stale-analysis cron job is
          // responsible for retrying anything that gets stuck in either state.
          if (
            existing?.status === "complete" ||
            existing?.processing_phase === "analysing" ||
            existing?.processing_phase === "analysis_pending"
          ) {
            console.log("MUX WEBHOOK skipping — analysis already underway", {
              takeId,
              status: existing?.status,
              processing_phase: existing?.processing_phase,
            });
            return new Response("ok", { status: 200 });
          }

          // Quota gate before triggering AI: covers the case where the row
          // was created before this cap existed, or where a race slipped
          // past createMuxDirectUpload. We mark the take as errored and
          // skip the AI call rather than burning credits.
          const identity = await resolveTakeIdentity(takeId);
          if (identity) {
            try {
              await assertWithinAnalysisQuota(identity, "mux-webhook:asset.ready");
            } catch (qerr) {
              if (qerr instanceof QuotaExceededError) {
                await supabaseAdmin
                  .from("takes")
                  .update({
                    status: "error",
                    processing_phase: "error",
                    error_message: qerr.message,
                  })
                  .eq("id", takeId);
                return new Response("ok", { status: 200 });
              }
              throw qerr;
            }
          }

          // Mark the take as queued — runProcessTake itself will flip the
          // phase to "analysing" once it actually begins work. This lets the
          // stale-analysis reconciler distinguish "scheduled but never
          // picked up" from "started but never finished".
          await supabaseAdmin
            .from("takes")
            .update({ status: "pending", processing_phase: "analysis_pending" })
            .eq("id", takeId);

          // Schedule the AI analysis as a background task that the Cloudflare
          // Worker runtime is required to keep alive past the response via
          // ctx.waitUntil. No un-awaited promise leak: scheduleBackground
          // wraps it in waitUntil when an ExecutionContext is available.
          console.log("MUX WEBHOOK scheduling runProcessTake (waitUntil) →", {
            takeId,
            timestamp: new Date().toISOString(),
          });
          scheduleBackground(
            (async () => {
              const result = await runProcessTake(takeId);
              console.log("MUX WEBHOOK runProcessTake completed", { takeId, result });
              return result;
            })(),
            `runProcessTake:${takeId}`,
          );
          return new Response("ok", { status: 200 });
        }

        if (type === "video.asset.errored" || type === "video.upload.errored") {
          const msg =
            data.errors?.messages?.join("; ") ?? "Mux failed to transcode the upload.";
          await supabaseAdmin
            .from("takes")
            .update({
              mux_status: "errored",
              status: "error",
              processing_phase: "error",
              error_message: `Transcoding failed: ${msg}`,
            })
            .eq("id", takeId);
          return new Response("ok", { status: 200 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
