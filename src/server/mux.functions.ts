import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { startOfDay } from "date-fns";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getMux } from "./mux.server";

// Daily analysis cap per user. Counts takes created today.
const DAILY_ANALYSIS_CAP = 5;

async function assertUnderDailyCap(userId: string): Promise<void> {
  const since = startOfDay(new Date()).toISOString();
  const { count, error } = await supabaseAdmin
    .from("takes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw new Error("Could not check daily usage");
  if ((count ?? 0) >= DAILY_ANALYSIS_CAP) {
    throw new Error(
      `Daily analysis limit reached (${DAILY_ANALYSIS_CAP}/day). Try again tomorrow.`,
    );
  }
}

// Create a Mux Direct Upload URL. The browser PUTs the file straight to Mux.
// Mux fires a `video.upload.asset_created` webhook with the resulting asset id,
// then `video.asset.ready` once renditions exist.
//
// We pass `passthrough=takeId` so the webhook can locate our take row.
export const createMuxDirectUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    await assertUnderDailyCap(userId);

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
        mp4_support: "standard",
        max_resolution_tier: "1080p",
        video_quality: "basic",
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
