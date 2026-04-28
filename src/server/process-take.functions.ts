import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { startOfDay } from "date-fns";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { runProcessTake } from "./process-take.server";

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

async function assertTakeOwnership(takeId: string, userId: string, op: string) {
  const { data, error } = await supabaseAdmin
    .from("takes")
    .select("user_id")
    .eq("id", takeId)
    .single();
  if (error || !data) {
    console.warn(`[auth] ${op} denied — take ${takeId} not found for user ${userId}`);
    throw new Response("Not found", { status: 404 });
  }
  if (data.user_id !== userId) {
    console.warn(
      `[auth] ${op} forbidden — user ${userId} attempted to access take ${takeId} owned by ${data.user_id}`,
    );
    throw new Response("Forbidden", { status: 403 });
  }
  console.log(`[auth] ${op} authorized — user ${userId} on take ${takeId}`);
}

// User-facing retry: gated by auth + ownership check, then delegates to the
// internal pipeline. This is the ONLY client-callable surface for triggering
// analysis. The webhook calls runProcessTake directly (server-only import).
export const retryProcessTake = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        takeId: z.string().uuid(),
        allowOriginal: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertTakeOwnership(data.takeId, context.userId, "retryProcessTake");
    await assertUnderDailyCap(context.userId);
    return runProcessTake(data.takeId, data.allowOriginal);
  });

// Reset a take so the user can re-upload a new video to Mux directly.
export const resetTakeForReupload = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        takeId: z.string().uuid(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signals: z.any().optional(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        checklist: z.any().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { takeId, signals, checklist } = data;
    await assertTakeOwnership(takeId, context.userId, "resetTakeForReupload");
    await supabaseAdmin
      .from("takes")
      .update({
        status: "pending",
        processing_phase: "uploading",
        error_message: null,
        report: null,
        scores: null,
        overall_score: null,
        confidence: null,
        signals: signals ?? null,
        checklist: checklist ?? null,
        attempt_count: 0,
        analysis_tier: null,
        mux_status: "none",
        mux_upload_id: null,
        mux_asset_id: null,
        mux_playback_id: null,
        mux_mp4_standard_url: null,
        mux_mp4_high_url: null,
        mux_duration_seconds: null,
        video_path: null,
      })
      .eq("id", takeId);
    return { ok: true };
  });

// Cancel a stuck/errored take.
export const resetTake = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ takeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertTakeOwnership(data.takeId, context.userId, "resetTake");
    await supabaseAdmin
      .from("takes")
      .update({
        status: "error",
        processing_phase: "error",
        error_message: "Cancelled by user — upload a new take to retry.",
      })
      .eq("id", data.takeId);
    return { ok: true };
  });
