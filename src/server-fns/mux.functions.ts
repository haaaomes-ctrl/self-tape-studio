import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { getMux } from "@/server/mux.server";
import { assertWithinAnalysisQuota, QuotaExceededError } from "@/server/quota.server";
import { getResolvedConfig } from "@/server/app-config.server";
import { metric } from "@/server/metrics.server";
import { assertAccountComplianceForReport } from "@/server/account-compliance.server";
import {
  ReportCreditRequiredError,
  releaseReportCreditForTake,
  reserveReportCreditForTake,
} from "@/server/credit-ledger.server";

// Create a Mux Direct Upload URL. The browser PUTs the file straight to Mux.
// Mux fires a `video.upload.asset_created` webhook with the resulting asset id,
// then `video.asset.ready` once renditions exist.
//
// Quota: this is the first server-side gate — we refuse to mint an upload URL
// if the caller is already at their cap. The webhook handler re-checks before
// triggering AI, and a DB trigger catches any race.
//
// Error contract: failures throw a plain `Error` whose `.message` starts with
// a stable code prefix the client parses to surface the right UX:
//   QUOTA_EXCEEDED:   <human message>
//   MUX_CONFIG:       <human message>
//   MUX_API_<status>: <human message>
//   TAKE_NOT_FOUND / FORBIDDEN / TAKE_LOOKUP_FAILED / TAKE_UPDATE_FAILED
// Throwing a Response across the createServerFn boundary loses the body, so
// we deliberately use plain Errors here.

async function releaseUploadReservationAfterFailure(params: {
  takeId: string;
  failureCode: string;
  message: string;
}) {
  try {
    const result = await releaseReportCreditForTake({
      take_id: params.takeId,
      release_status: "released",
      release_reason: params.failureCode,
      failure_code: params.failureCode,
      metadata: {
        trigger: "create_mux_direct_upload_failure",
        report_credit_restored_message:
          "A reserved TapeCoach credit was returned because the upload could not be started.",
        safe_error_message: params.message.slice(0, 240),
      },
    });
    metric("report_credit_released", {
      take_id: params.takeId,
      reason: params.failureCode,
      released: result.released,
    });
  } catch (err) {
    console.warn("[mux-upload] report_credit_release_after_failure_failed", {
      take_id: params.takeId,
      failure_code: params.failureCode,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function markUploadSetupFailed(params: {
  takeId: string;
  failureCode: string;
  message: string;
}) {
  const { error } = await supabaseAdmin
    .from("takes")
    .update({
      status: "error",
      processing_phase: "error",
      error_message: `[failure_code:${params.failureCode}] ${params.message}`,
    })
    .eq("id", params.takeId);

  if (error) {
    console.error("[mux-upload] mark_upload_setup_failed_update_failed", {
      take_id: params.takeId,
      failure_code: params.failureCode,
      error: error.message,
    });
  }
}

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
    metric("upload_url_requested", { take_id: takeId });

    await assertAccountComplianceForReport(userId);

    // 1. Quota gate
    try {
      await assertWithinAnalysisQuota({ kind: "user", userId }, "createMuxDirectUpload");
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        console.warn("[mux-upload] quota_rejected", {
          take_id: takeId,
          user_id: userId,
          scope: err.scope,
          cap: err.cap,
          count: err.count,
        });
        metric("quota_rejection", {
          take_id: takeId,
          reason: err.scope,
          cap: err.cap,
          count: err.count,
        });
        metric("upload_url_failure", { take_id: takeId, reason: "quota_exceeded" });
        throw new Error(`QUOTA_EXCEEDED: ${err.message}`);
      }
      throw err;
    }

    // 2. Env presence (do not log values)
    const muxConfig = {
      MUX_TOKEN_ID: Boolean(process.env.MUX_TOKEN_ID),
      MUX_TOKEN_SECRET: Boolean(process.env.MUX_TOKEN_SECRET),
      MUX_WEBHOOK_SECRET: Boolean(process.env.MUX_WEBHOOK_SECRET),
    };
    if (!muxConfig.MUX_TOKEN_ID || !muxConfig.MUX_TOKEN_SECRET) {
      console.error("[mux-upload] mux_config_missing", { take_id: takeId, ...muxConfig });
      metric("upload_url_failure", { take_id: takeId, reason: "mux_config_missing" });
      throw new Error("MUX_CONFIG: Video service is not configured. Please contact support.");
    }

    // 3. Take lookup + ownership
    const { data: take, error: takeErr } = await supabaseAdmin
      .from("takes")
      .select("id, user_id, audition_id, mux_upload_id, mux_status")
      .eq("id", takeId)
      .single();
    if (takeErr || !take) {
      console.error("[mux-upload] take_lookup_failed", {
        take_id: takeId,
        user_id: userId,
        error: takeErr?.message,
      });
      metric("upload_url_failure", { take_id: takeId, reason: "take_not_found" });
      throw new Error("TAKE_NOT_FOUND: We couldn't find this take. Please refresh and try again.");
    }
    if (take.user_id !== userId) {
      console.warn("[mux-upload] forbidden", { take_id: takeId, user_id: userId });
      metric("upload_url_failure", { take_id: takeId, reason: "forbidden" });
      throw new Error("FORBIDDEN: You don't have access to this take.");
    }

    // 3.5 Per-audition cap (admin-managed). Counts the just-created take row
    // (which the client inserted before calling this function), so we reject
    // when the row count exceeds the configured cap.
    {
      const cfg = await getResolvedConfig();
      const { count: takesInAudition, error: cntErr } = await supabaseAdmin
        .from("takes")
        .select("id", { count: "exact", head: true })
        .eq("audition_id", take.audition_id);
      if (cntErr) {
        console.error("[mux-upload] per_audition_count_failed", {
          take_id: takeId,
          error: cntErr.message,
        });
      } else if ((takesInAudition ?? 0) > cfg.max_takes_per_audition) {
        // Roll back the just-inserted take row so the count is consistent.
        await supabaseAdmin.from("takes").delete().eq("id", takeId);
        console.warn("[mux-upload] per_audition_cap_reached", {
          take_id: takeId,
          count: takesInAudition,
          cap: cfg.max_takes_per_audition,
        });
        metric("quota_rejection", {
          take_id: takeId,
          reason: "per_audition_cap",
          cap: cfg.max_takes_per_audition,
          count: takesInAudition ?? 0,
        });
        metric("upload_url_failure", { take_id: takeId, reason: "per_audition_cap" });
        throw new Error(
          `QUOTA_EXCEEDED: This audition already has the maximum of ${cfg.max_takes_per_audition} takes. Delete an existing take to add a new one.`,
        );
      }
    }

    // 3.6 Funded-credit reservation gate. This is the commercial source of
    // truth for report generation: no funded credit means no Mux upload URL
    // for a report-generating take. The reservation is consumed only after the
    // report is persisted; cancellation/failure releases it.
    try {
      await reserveReportCreditForTake({
        take_id: takeId,
        requested_by_user_id: userId,
        metadata: {
          trigger: "create_mux_direct_upload",
          report_credit_amount: 1,
          same_video_credit_policy: "consume_only_if_report_generated",
          commercial_metrics_excluded: false,
        },
      });
      metric("report_credit_reserved", {
        take_id: takeId,
        reason: "create_mux_direct_upload",
      });
    } catch (err) {
      if (err instanceof ReportCreditRequiredError) {
        console.warn("[mux-upload] report_credit_rejected", {
          take_id: takeId,
          user_id: userId,
        });
        metric("report_credit_rejected", {
          take_id: takeId,
          reason: "no_funded_credit",
        });
        metric("upload_url_failure", { take_id: takeId, reason: "credit_required" });
        await supabaseAdmin
          .from("takes")
          .update({
            status: "error",
            processing_phase: "error",
            error_message: err.message,
          })
          .eq("id", takeId);
        throw new Error(err.message);
      }
      throw err;
    }

    // 4. Idempotency: reuse an in-flight upload for this take if Mux still has it.
    if (take.mux_upload_id && take.mux_status === "uploading") {
      const mux = getMux();
      try {
        const existing = await mux.video.uploads.retrieve(take.mux_upload_id);
        if (existing.url && existing.status === "waiting") {
          console.log("[mux-upload] reused_existing_upload", {
            take_id: takeId,
            mux_upload_id: existing.id,
          });
          metric("upload_url_success", { take_id: takeId, reused: true });
          return { uploadUrl: existing.url, uploadId: existing.id };
        }
      } catch {
        // fall through to create a fresh one
      }
    }

    // 5. Create a fresh direct upload.
    const mux = getMux();
    let upload;
    try {
      upload = await mux.video.uploads.create({
        cors_origin: "*",
        new_asset_settings: {
          playback_policies: ["public"],
          max_resolution_tier: "1080p",
          video_quality: "basic",
          // CRITICAL: enable a downloadable MP4 rendition so we have a single
          // static URL (https://stream.mux.com/{playback_id}/highest.mp4) we
          // can hand to Gemini. The legacy `mp4_support` field is deprecated
          // and conflicts with `video_quality:"basic"` on newer accounts; the
          // current `static_renditions` API does not. "highest" produces one
          // MP4 capped at the asset's natural resolution (≤1080p here).
          static_renditions: [{ resolution: "highest" }],
          passthrough: takeId,
        },
      });
    } catch (err: unknown) {
      // Mux SDK errors expose status/type/message — log a safe summary and
      // surface a coded error to the client.
      const e = err as {
        status?: number;
        type?: string;
        message?: string;
        request?: { path?: string };
      };
      const status = e?.status ?? 500;
      console.error("[mux-upload] mux_api_error", {
        take_id: takeId,
        user_id: userId,
        http_status: status,
        error_type: e?.type ?? "UnknownError",
        error_message: e?.message ?? String(err),
        request_path: e?.request?.path ?? "/video/uploads",
        static_renditions_requested: true,
        passthrough_present: true,
      });
      metric("mux_upload_error", {
        take_id: takeId,
        http_status: status,
        reason: e?.type ?? "unknown",
      });
      metric("upload_url_failure", {
        take_id: takeId,
        reason: `mux_api_${status}`,
        http_status: status,
      });
      await releaseUploadReservationAfterFailure({
        takeId,
        failureCode: `mux_api_${status}`,
        message: e?.message ?? "Mux rejected the upload request.",
      });
      await markUploadSetupFailed({
        takeId,
        failureCode: `mux_api_${status}`,
        message: e?.message ?? "Mux rejected the upload request.",
      });
      throw new Error(`MUX_API_${status}: ${e?.message ?? "Mux rejected the upload request."}`);
    }

    if (!upload?.url) {
      console.error("[mux-upload] mux_returned_no_url", {
        take_id: takeId,
        mux_upload_id: upload?.id,
      });
      metric("upload_url_failure", { take_id: takeId, reason: "no_url_returned" });
      await releaseUploadReservationAfterFailure({
        takeId,
        failureCode: "mux_no_upload_url",
        message: "Mux did not return an upload URL.",
      });
      await markUploadSetupFailed({
        takeId,
        failureCode: "mux_no_upload_url",
        message: "Mux did not return an upload URL.",
      });
      throw new Error("MUX_API_500: Mux did not return an upload URL.");
    }

    const { error: updateErr } = await supabaseAdmin
      .from("takes")
      .update({
        mux_upload_id: upload.id,
        mux_status: "uploading",
        processing_phase: "uploading",
        status: "pending",
      })
      .eq("id", takeId);

    if (updateErr) {
      console.error("[mux-upload] take_update_failed_after_upload_created", {
        take_id: takeId,
        mux_upload_id: upload.id,
        error: updateErr.message,
      });
      metric("upload_url_failure", { take_id: takeId, reason: "take_update_failed" });
      await releaseUploadReservationAfterFailure({
        takeId,
        failureCode: "take_update_failed",
        message: "TapeCoach could not attach the Mux upload to this take.",
      });
      await markUploadSetupFailed({
        takeId,
        failureCode: "take_update_failed",
        message: "TapeCoach could not attach the Mux upload to this take. Please try again.",
      });
      throw new Error("TAKE_UPDATE_FAILED: We could not prepare this upload. Please try again.");
    }

    console.log("[mux-upload] upload_created", {
      take_id: takeId,
      user_id: userId,
      mux_upload_id: upload.id,
      static_renditions_accepted: true,
      passthrough_present: true,
    });
    metric("mux_upload_created", { take_id: takeId });
    metric("upload_url_success", { take_id: takeId, reused: false });

    return { uploadUrl: upload.url, uploadId: upload.id };
  });
