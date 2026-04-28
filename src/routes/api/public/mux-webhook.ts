import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMux, muxMp4Url } from "@/server/mux.server";
import { processTake } from "@/server/process-take.functions";

// Mux webhook receiver. Configure in Mux dashboard:
//   URL:     https://<project>.lovable.app/api/public/mux-webhook
//   Secret:  store as MUX_WEBHOOK_SECRET in Lovable secrets
//
// We verify the Mux-Signature header against MUX_WEBHOOK_SECRET, then react
// to two events:
//   - video.asset.ready    → MP4 renditions are usable, kick off analysis
//   - video.asset.errored  → mark the take as errored so the user can retry
export const Route = createFileRoute("/api/public/mux-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MUX_WEBHOOK_SECRET;
        const rawBody = await request.text();

        // Signature verification — skipped only if no secret is configured yet.
        if (secret) {
          const sigHeader = request.headers.get("mux-signature") ?? "";
          try {
            const mux = getMux();
            // Throws if invalid.
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
          passthrough?: string;
          playback_ids?: Array<{ id: string; policy: string }>;
          errors?: { messages?: string[] };
        };
        const takeId = data.passthrough;
        if (!takeId) {
          // Could be an event for an asset we don't own — ignore quietly.
          return new Response("ok", { status: 200 });
        }

        if (type === "video.asset.ready") {
          const playbackId = data.playback_ids?.find((p) => p.policy === "public")?.id;
          if (!playbackId) {
            console.error("Mux asset.ready without a public playback id", data);
            return new Response("ok", { status: 200 });
          }
          const mp4Standard = muxMp4Url(playbackId, "medium"); // ~720p
          const mp4High = muxMp4Url(playbackId, "high"); // ~1080p

          await supabaseAdmin
            .from("takes")
            .update({
              mux_asset_id: data.id ?? null,
              mux_playback_id: playbackId,
              mux_mp4_standard_url: mp4Standard,
              mux_mp4_high_url: mp4High,
              mux_status: "ready",
              status: "pending",
            })
            .eq("id", takeId);

          // Fire-and-forget: kick off Gemini analysis.
          processTake({ data: { takeId } }).catch((e) => {
            console.error("processTake from webhook failed", e);
          });
          return new Response("ok", { status: 200 });
        }

        if (type === "video.asset.errored") {
          const msg =
            data.errors?.messages?.join("; ") ?? "Mux failed to transcode the upload.";
          await supabaseAdmin
            .from("takes")
            .update({
              mux_status: "errored",
              status: "error",
              error_message: `Transcoding failed: ${msg}`,
            })
            .eq("id", takeId);
          return new Response("ok", { status: 200 });
        }

        // Other events (created, updated, etc.) — ignore.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
