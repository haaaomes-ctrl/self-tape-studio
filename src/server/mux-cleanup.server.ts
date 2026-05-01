// Post-report Mux asset cleanup.
//
// Once a take has a successfully persisted report (status=complete,
// processing_phase=complete, report+overall_score present), the raw
// uploaded video has no further product use. We delete the Mux asset to
// keep stored asset count bounded.
//
// Design rules:
//   - NEVER block or fail report completion. All callers treat this as
//     best-effort.
//   - Treat 404 / missing asset as success (idempotent).
//   - Clear mux_* media fields on the row after a successful (or 404)
//     deletion so the reconciler backfill stops re-attempting and any UI
//     that checks `mux_playback_id` stops trying to play a dead asset.
//   - No PII / video URLs / report content in logs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMux } from "./mux.server";

export type CleanupReason =
  | "report_complete"
  | "reconciler_backfill";

export interface CleanupResult {
  ok: boolean;
  alreadyMissing?: boolean;
  reason?: string;
  status?: number;
}

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.status === "number") return e.status;
    if (typeof e.statusCode === "number") return e.statusCode as number;
    const resp = e.response as Record<string, unknown> | undefined;
    if (resp && typeof resp.status === "number") return resp.status as number;
  }
  return undefined;
}

function errorType(err: unknown): string {
  if (err instanceof Error) return err.name || "Error";
  return typeof err;
}

/**
 * Delete the Mux asset for a completed take and clear the take's mux media
 * pointers. Best-effort: never throws, always returns a result object.
 */
export async function cleanupMuxAssetForCompletedTake(args: {
  takeId: string;
  muxAssetId: string;
  reason: CleanupReason;
  client?: SupabaseClient;
}): Promise<CleanupResult> {
  const { takeId, muxAssetId, reason } = args;
  const db = args.client ?? supabaseAdmin;

  let deletionOk = false;
  let alreadyMissing = false;
  let lastStatus: number | undefined;
  let lastErr: unknown;

  try {
    const mux = getMux();
    await mux.video.assets.delete(muxAssetId);
    deletionOk = true;
  } catch (err) {
    lastErr = err;
    lastStatus = extractStatus(err);
    if (lastStatus === 404) {
      // Already gone — treat as success (idempotent).
      deletionOk = true;
      alreadyMissing = true;
    }
  }

  if (!deletionOk) {
    console.warn("[take-pipeline] mux_asset_delete_failed", {
      take_id: takeId,
      mux_asset_id: muxAssetId,
      cleanup_reason: reason,
      error_type: errorType(lastErr),
      status: lastStatus ?? null,
    });
    return {
      ok: false,
      reason: "delete_call_failed",
      status: lastStatus,
    };
  }

  // Clear mux media pointers so:
  //   1. The reconciler backfill loop stops re-attempting cleanup.
  //   2. Any future UI surface that checks mux_playback_id stops trying
  //      to load a deleted asset.
  // We intentionally keep mux_duration_seconds (useful metadata) and
  // mux_status (audit trail) untouched.
  const { error: updateErr } = await db
    .from("takes")
    .update({
      mux_asset_id: null,
      mux_playback_id: null,
      mux_mp4_standard_url: null,
      mux_mp4_high_url: null,
      mux_upload_id: null,
    })
    .eq("id", takeId)
    .eq("status", "complete")
    .eq("processing_phase", "complete");

  if (updateErr) {
    // The asset is gone but we couldn't clear the row. Log and surface a
    // soft failure so the reconciler can retry the row-clear next pass —
    // the Mux delete itself was idempotent so re-attempting is safe.
    console.warn("[take-pipeline] mux_asset_delete_failed", {
      take_id: takeId,
      mux_asset_id: muxAssetId,
      cleanup_reason: reason,
      error_type: "row_update_failed",
      status: null,
    });
    return { ok: false, reason: "row_update_failed" };
  }

  console.log("[take-pipeline] mux_asset_deleted_after_report", {
    take_id: takeId,
    mux_asset_id: muxAssetId,
    cleanup_reason: reason,
    already_missing: alreadyMissing,
  });
  return { ok: true, alreadyMissing };
}
