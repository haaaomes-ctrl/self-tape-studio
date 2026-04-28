import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMux } from "./mux.server";

// Create a Mux Direct Upload for a take. Returns the upload URL the browser
// will PUT/PATCH the raw file to (via tus). We pass the takeId as the
// `passthrough` so the webhook can find the right row when the asset is ready.
export const createMuxUpload = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ takeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { takeId } = data;

    // Verify take exists.
    const { data: take, error } = await supabaseAdmin
      .from("takes")
      .select("id, user_id")
      .eq("id", takeId)
      .single();
    if (error || !take) throw new Error("Take not found");

    const mux = getMux();

    // smart encoding tier with capped 1080p keeps cost predictable while still
    // giving us a clean high-rendition copy for AI analysis.
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
        mp4_support: "standard",
        max_resolution_tier: "1080p",
        encoding_tier: "smart",
        passthrough: takeId,
      },
    });

    await supabaseAdmin
      .from("takes")
      .update({
        mux_upload_id: upload.id,
        mux_status: "uploading",
      })
      .eq("id", takeId);

    return { uploadUrl: upload.url, uploadId: upload.id };
  });

// Mark the take as upload-complete from the client side. The Mux webhook
// will subsequently flip mux_status to 'ready' and kick off processing.
export const markMuxUploaded = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ takeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("takes")
      .update({ mux_status: "transcoding", status: "pending" })
      .eq("id", data.takeId);
    return { ok: true };
  });
