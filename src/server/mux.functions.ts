import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { getMux } from "./mux.server";
import {
  assertWithinAnalysisQuota,
  QuotaExceededError,
} from "./quota.server";
import { metric } from "./metrics.server";

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
//   TAKE_NOT_FOUND / FORBIDDEN / TAKE_LOOKUP_FAILED
// Throwing a Response across the createServerFn boundary loses the body, so
// we deliberately use plain Errors here.
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
      throw new Error(
        "MUX_CONFIG: Video service is not configured. Please contact support.",
      );
    }

    // 3. Take lookup + ownership
    const { data: take, error: takeErr } = await supabaseAdmin
      .from("takes")
      .select("id, user_id, mux_upload_id, mux_status")
      .eq("id", takeId)
      .single();
    if (takeErr || !take) {
      console.error("[mux-upload] take_lookup_failed", {
        take_id: takeId,
        user_id: userId,
        error: takeErr?.message,
      });
      throw new Error("TAKE_NOT_FOUND: We couldn't find this take. Please refresh and try again.");
    }
    if (take.user_id !== userId) {
      console.warn("[mux-upload] forbidden", { take_id: takeId, user_id: userId });
      throw new Error("FORBIDDEN: You don't have access to this take.");
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
      throw new Error(
        `MUX_API_${status}: ${e?.message ?? "Mux rejected the upload request."}`,
      );
    }

    if (!upload?.url) {
      console.error("[mux-upload] mux_returned_no_url", {
        take_id: takeId,
        mux_upload_id: upload?.id,
      });
      throw new Error("MUX_API_500: Mux did not return an upload URL.");
    }

    await supabaseAdmin
      .from("takes")
      .update({
        mux_upload_id: upload.id,
        mux_status: "uploading",
        processing_phase: "uploading",
        status: "pending",
      })
      .eq("id", takeId);

    console.log("[mux-upload] upload_created", {
      take_id: takeId,
      user_id: userId,
      mux_upload_id: upload.id,
      static_renditions_accepted: true,
      passthrough_present: true,
    });

    return { uploadUrl: upload.url, uploadId: upload.id };
  });
