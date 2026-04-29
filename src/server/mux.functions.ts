import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { getMux } from "./mux.server";
import {
  assertWithinAnalysisQuota,
  QuotaExceededError,
  quotaErrorToResponse,
} from "./quota.server";

// Create a Mux Direct Upload URL. The browser PUTs the file straight to Mux.
// Mux fires a `video.upload.asset_created` webhook with the resulting asset id,
// then `video.asset.ready` once renditions exist.
//
// Quota: this is the first server-side gate — we refuse to mint an upload URL
// if the caller is already at their cap. The webhook handler re-checks before
// triggering AI, and a DB trigger catches any race.
export const createMuxDirectUpload = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        takeId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { takeId } = data;
    const { userId } = context;

    try {
      await assertWithinAnalysisQuota({ kind: "user", userId }, "createMuxDirectUpload");
    } catch (err) {
      if (err instanceof QuotaExceededError) throw quotaErrorToResponse(err);
      throw err;
    }

    // Make sure the take belongs to the caller.
    const { data: take, error: takeErr } = await supabaseAdmin
      .from("takes")
      .select("id, user_id, mux_upload_id, mux_status")
      .eq("id", takeId)
      .single();
    if (takeErr || !take) throw new Error("Take not found");
    if (take.user_id !== userId) throw new Error("Forbidden");

    // Idempotency: if we've already created an upload for this take, return it
    // (but only if it hasn't progressed to an asset yet).
    if (take.mux_upload_id && take.mux_status === "uploading") {
      const mux = getMux();
      try {
        const existing = await mux.video.uploads.retrieve(take.mux_upload_id);
        if (existing.url && existing.status === "waiting") {
          return { uploadUrl: existing.url, uploadId: existing.id };
        }
      } catch {
        // fall through to create a fresh one
      }
    }

    const mux = getMux();
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policies: ["public"],
        max_resolution_tier: "1080p",
        video_quality: "basic",
        // CRITICAL: enable static MP4 renditions so the URLs we hand to Gemini
        // (medium.mp4 / high.mp4) actually exist. "standard" is deprecated and
        // not supported with video_quality:"basic"; use "capped-1080p" which
        // is the current Mux value compatible with the basic tier.
        mp4_support: "capped-1080p",
        passthrough: takeId,
      },
    });

    await supabaseAdmin
      .from("takes")
      .update({
        mux_upload_id: upload.id,
        mux_status: "uploading",
        processing_phase: "uploading",
        status: "pending",
      })
      .eq("id", takeId);

    return { uploadUrl: upload.url, uploadId: upload.id };
  });
