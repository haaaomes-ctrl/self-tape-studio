import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMux } from "./mux.server";

// Create a Mux Asset by giving Mux a temporary signed URL of the file we
// already uploaded to Supabase storage. Mux ingests it server-to-server,
// transcodes it into a smart-tier MP4 set (low/medium/high) capped at 1080p,
// and fires the `video.asset.ready` webhook when renditions are usable.
//
// We pass takeId as `passthrough` so the webhook can locate the take.
export const ingestTakeToMux = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ takeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { takeId } = data;

    const { data: take, error: takeErr } = await supabaseAdmin
      .from("takes")
      .select("id, video_path, mux_status")
      .eq("id", takeId)
      .single();
    if (takeErr || !take) throw new Error("Take not found");

    if (take.mux_status === "ready" || take.mux_status === "transcoding") {
      return { ok: true, alreadyIngested: true };
    }

    // Long-lived signed URL so Mux has time to download even very large files.
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("audition-videos")
      .createSignedUrl(take.video_path, 60 * 60 * 6); // 6h
    if (signErr || !signed) throw new Error("Could not create signed URL");

    const mux = getMux();
    const asset = await mux.video.assets.create({
      inputs: [{ url: signed.signedUrl }],
      playback_policies: ["public"],
      mp4_support: "standard",
      max_resolution_tier: "1080p",
      video_quality: "basic",
      passthrough: takeId,
    });

    await supabaseAdmin
      .from("takes")
      .update({
        mux_asset_id: asset.id,
        mux_status: "transcoding",
      })
      .eq("id", takeId);

    return { ok: true, assetId: asset.id };
  });
