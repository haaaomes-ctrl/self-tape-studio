// Delete operations for auditions and takes.
//
// Hard-delete is used here. The takes.audition_id FK is ON DELETE CASCADE,
// so removing an audition automatically removes its takes via the database.
// Mux assets are best-effort cleaned up; failures are logged, not surfaced
// to the user (the row is the source of truth for what they can see).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { getMux } from "./mux.server";

async function deleteMuxAssetSafe(assetId: string | null | undefined, label: string) {
  if (!assetId) return;
  try {
    const mux = getMux();
    await mux.video.assets.delete(assetId);
    console.log(`[delete] mux asset removed (${label})`, { assetId });
  } catch (err) {
    console.warn(`[delete] mux asset delete failed (${label}) — continuing`, {
      assetId,
      err: err instanceof Error ? err.message : err,
    });
  }
}

async function deleteStoredVideoSafe(path: string | null | undefined, label: string) {
  if (!path) return;
  try {
    const { error } = await supabaseAdmin.storage.from("audition-videos").remove([path]);
    if (error) throw error;
    console.log(`[delete] storage object removed (${label})`, { path });
  } catch (err) {
    console.warn(`[delete] storage delete failed (${label}) — continuing`, {
      path,
      err: err instanceof Error ? err.message : err,
    });
  }
}

export const deleteTake = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ takeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { takeId } = data;
    const { userId } = context;

    // Ownership check + grab cleanup metadata in one query.
    const { data: take, error } = await supabaseAdmin
      .from("takes")
      .select("user_id, mux_asset_id, video_path")
      .eq("id", takeId)
      .single();
    if (error || !take) {
      console.warn(`[delete] deleteTake — take not found`, { takeId, userId });
      throw new Response("Not found", { status: 404 });
    }
    if (take.user_id !== userId) {
      console.warn(`[delete] deleteTake forbidden`, {
        takeId,
        userId,
        ownerId: take.user_id,
      });
      throw new Response("Forbidden", { status: 403 });
    }

    // Best-effort external cleanup BEFORE the DB row goes away — once the row
    // is gone we no longer have the asset id.
    await deleteMuxAssetSafe(take.mux_asset_id, `take:${takeId}`);
    await deleteStoredVideoSafe(take.video_path, `take:${takeId}`);

    const { error: delErr } = await supabaseAdmin.from("takes").delete().eq("id", takeId);
    if (delErr) {
      console.error(`[delete] deleteTake DB delete failed`, { takeId, err: delErr });
      throw new Response("Could not delete take", { status: 500 });
    }
    console.log(`[delete] take deleted`, { takeId, userId });
    return { ok: true };
  });

export const deleteAudition = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ auditionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { auditionId } = data;
    const { userId } = context;

    const { data: aud, error: audErr } = await supabaseAdmin
      .from("auditions")
      .select("user_id")
      .eq("id", auditionId)
      .single();
    if (audErr || !aud) {
      throw new Response("Not found", { status: 404 });
    }
    if (aud.user_id !== userId) {
      console.warn(`[delete] deleteAudition forbidden`, {
        auditionId,
        userId,
        ownerId: aud.user_id,
      });
      throw new Response("Forbidden", { status: 403 });
    }

    // Pull every take's external cleanup metadata first.
    const { data: takes } = await supabaseAdmin
      .from("takes")
      .select("id, mux_asset_id, video_path")
      .eq("audition_id", auditionId);

    for (const t of takes ?? []) {
      await deleteMuxAssetSafe(t.mux_asset_id, `audition:${auditionId} take:${t.id}`);
      await deleteStoredVideoSafe(t.video_path, `audition:${auditionId} take:${t.id}`);
    }

    // takes.audition_id FK is ON DELETE CASCADE — deleting the audition
    // removes all takes atomically in the database.
    const { error: delErr } = await supabaseAdmin
      .from("auditions")
      .delete()
      .eq("id", auditionId);
    if (delErr) {
      console.error(`[delete] deleteAudition DB delete failed`, { auditionId, err: delErr });
      throw new Response("Could not delete audition", { status: 500 });
    }
    console.log(`[delete] audition deleted`, {
      auditionId,
      userId,
      takeCount: takes?.length ?? 0,
    });
    return { ok: true };
  });
