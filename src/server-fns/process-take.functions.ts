import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { runProcessTake } from "@/server/process-take.server";
import { replaceReuploadUploadIdentitySignals } from "@/lib/mux-upload";
import type { Json } from "@/integrations/supabase/types";
import {
  assertWithinAnalysisQuota,
  QuotaExceededError,
  quotaErrorToResponse,
} from "@/server/quota.server";
import { metric } from "@/server/metrics.server";
import { assertAccountComplianceForReport } from "@/server/account-compliance.server";
import {
  ReportCreditRequiredError,
  releaseReportCreditForTake,
  reserveReportCreditForTake,
} from "@/server/credit-ledger.server";

function claimEmail(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const email = (claims as { email?: unknown }).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
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
    await assertAccountComplianceForReport(context.userId);
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
        { email: claimEmail(context.claims) },
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
    try {
      const reservation = await reserveReportCreditForTake({
        take_id: data.takeId,
        requested_by_user_id: context.userId,
        requested_by_user_email: claimEmail(context.claims),
        metadata: {
          trigger: "retry_process_take",
          report_credit_amount: 1,
          same_video_credit_policy: "consume_only_if_report_generated",
          commercial_metrics_excluded: false,
        },
      });
      if (reservation.requires_credit_reservation) {
        metric("report_credit_reserved", {
          take_id: data.takeId,
          reason: "retry_process_take",
        });
      }
    } catch (err) {
      if (err instanceof ReportCreditRequiredError) {
        metric("report_credit_rejected", {
          take_id: data.takeId,
          reason: "retry_no_funded_credit",
        });
        throw new Response(
          JSON.stringify({ error: err.message, code: err.code, promptTopUp: true }),
          {
            status: 402,
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw err;
    }
    return runProcessTake(data.takeId, data.allowOriginal, { includeErrorRetry: true });
  });

// Reset a take so the user can re-upload a new video to Mux directly.
export const resetTakeForReupload = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        takeId: z.string().uuid(),
        signals: z.any().optional(),
        checklist: z.any().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { takeId, signals, checklist } = data;
    await assertTakeOwnership(takeId, context.userId, "resetTakeForReupload");
    await releaseReportCreditForTake({
      take_id: takeId,
      release_status: "released",
      release_reason: "take_replaced_before_report_generated",
      metadata: {
        trigger: "reset_take_for_reupload",
        report_credit_restored_message:
          "A reserved TapeCoach credit was returned before the replacement upload.",
      },
    }).catch((err) => {
      console.warn("[credit-ledger] reset_take_for_reupload_release_failed", {
        take_id: takeId,
        error: err instanceof Error ? err.message : "unknown",
      });
    });
    const replacementSignals = replaceReuploadUploadIdentitySignals(signals);
    const { data: replacementTakeId, error } = await supabaseAdmin.rpc(
      "create_replacement_take_version",
      {
        p_take_id: takeId,
        p_user_id: context.userId,
        p_signals: replacementSignals as Json,
        p_checklist: (checklist ?? null) as Json,
        p_replacement_reason: "user_replaced",
      },
    );
    if (error || !replacementTakeId) {
      console.error("[take-lifecycle] replacement_take_version_failed", {
        take_id: takeId,
        error: error?.message ?? "missing_replacement_take_id",
      });
      throw new Error("Could not prepare a replacement take. Please refresh and try again.");
    }
    return { ok: true, replacementTakeId };
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
    await releaseReportCreditForTake({
      take_id: data.takeId,
      release_status: "released",
      release_reason: "user_cancelled_before_report_generated",
      metadata: {
        trigger: "reset_take",
        report_credit_restored_message:
          "A reserved TapeCoach credit was returned because the report was cancelled before completion.",
      },
    }).catch((err) => {
      console.warn("[credit-ledger] reset_take_release_failed", {
        take_id: data.takeId,
        error: err instanceof Error ? err.message : "unknown",
      });
    });
    await supabaseAdmin
      .from("takes")
      .update({
        status: "error",
        processing_phase: "error",
        error_message: "Cancelled by user — upload a new take to retry.",
        credit_lifecycle_status: "released",
      })
      .eq("id", data.takeId);
    metric("cancel", {
      take_id: data.takeId,
      processing_phase: pre?.processing_phase ?? null,
      duration_ms: pre?.created_at ? Date.now() - new Date(pre.created_at).getTime() : undefined,
      reason: "user_initiated",
    });
    return { ok: true };
  });
