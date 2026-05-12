import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { runProcessTake } from "@/server/process-take.server";
import {
  assertWithinAnalysisQuota,
  QuotaExceededError,
  quotaErrorToResponse,
} from "@/server/quota.server";
import { metric } from "@/server/metrics.server";

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
    // Pre-flight: never spawn a duplicate pipeline. If a poll loop or Gemini
    // call is already in flight for this take, return immediately so the UI
    // keeps polling the existing run instead of starting a second one.
    const { data: current } = await supabaseAdmin
      .from("takes")
      .select("status, processing_phase, attempt_count")
      .eq("id", data.takeId)
      .single();
    if (
      current &&
      current.status === "processing" &&
      (current.processing_phase === "analysing" ||
        current.processing_phase === "analysis_pending" ||
        current.processing_phase === "finalising")
    ) {
      console.log("already_running_skip", {
        take_id: data.takeId,
        processing_phase: current.processing_phase,
        attempt_count: current.attempt_count ?? 0,
      });
      metric("already_running_skip", {
        take_id: data.takeId,
        processing_phase: current.processing_phase,
        attempt: current.attempt_count ?? 0,
        reason: "user_retry",
      });
      return { ok: true as const, alreadyRunning: true as const };
    }
    try {
      await assertWithinAnalysisQuota(
        { kind: "user", userId: context.userId },
        "retryProcessTake",
      );
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        metric("quota_rejection", {
          take_id: data.takeId,
          reason: err.scope,
          cap: err.cap,
          count: err.count,
        });
        throw quotaErrorToResponse(err);
      }
      throw err;
    }
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
    // Snapshot the current phase so we can attribute the cancellation in
    // the metrics stream (cancel-during-uploading vs cancel-during-prepare
    // vs cancel-during-analysing).
    const { data: pre } = await supabaseAdmin
      .from("takes")
      .select("processing_phase, created_at")
      .eq("id", data.takeId)
      .single();
    await supabaseAdmin
      .from("takes")
      .update({
        status: "error",
        processing_phase: "error",
        error_message: "Cancelled by user — upload a new take to retry.",
      })
      .eq("id", data.takeId);
    metric("cancel", {
      take_id: data.takeId,
      processing_phase: pre?.processing_phase ?? null,
      duration_ms: pre?.created_at
        ? Date.now() - new Date(pre.created_at).getTime()
        : undefined,
      reason: "user_initiated",
    });
    return { ok: true };
  });
