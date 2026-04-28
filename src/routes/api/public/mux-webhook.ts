import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMux, muxMp4Url } from "@/server/mux.server";
import { processTake } from "@/server/process-take.functions";

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
        const secret = process.env.MUX_WEBHOOK_SECRET;
        const rawBody = await request.text();

        if (secret) {
          const sigHeader = request.headers.get("mux-signature") ?? "";
          try {
            const mux = getMux();
            mux.webhooks.verifySignature(rawBody, { "mux-signature": sigHeader }, secret);
          } catch (err) {
            console.error("Mux webhook signature failed", err);
            return new Response("invalid signature", { status: 401 });
          }
        } else {
          console.warn("MUX_WEBHOOK_SECRET not set — accepting webhook unverified");
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
          await supabaseAdmin
            .from("takes")
            .update({
              mux_asset_id: assetId,
              mux_status: "transcoding",
              processing_phase: "transcoding",
            })
            .eq("id", takeId);
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
            .select("status, processing_phase")
            .eq("id", takeId)
            .single();

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

          if (
            existing?.status === "complete" ||
            existing?.processing_phase === "analysing"
          ) {
            return new Response("ok", { status: 200 });
          }

          await supabaseAdmin
            .from("takes")
            .update({ status: "pending", processing_phase: "analysing" })
            .eq("id", takeId);

          // Fire-and-forget: kick off Gemini analysis.
          processTake({ data: { takeId } }).catch((e) => {
            console.error("processTake from webhook failed", e);
          });
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
