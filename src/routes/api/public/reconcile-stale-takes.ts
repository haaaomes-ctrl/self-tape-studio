import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildMuxHighestMp4Url,
  getMux,
  normaliseMuxMp4Url,
} from "@/server/mux.server";
import { runProcessTake } from "@/server/process-take.server";
import { scheduleBackground } from "@/worker-entry";
import { metric } from "@/server/metrics.server";

// Stale-analysis reconciler.
//
// Called by pg_cron every minute. Authenticated with a shared secret in the
// `x-reconciler-secret` header (matches RECONCILER_SECRET env var) so it
// cannot be triggered by anonymous traffic even though it lives under
// /api/public/.
//
// Recovery rules:
//   - processing_phase = "analysis_pending" AND updated_at < now - 2 min:
//     webhook scheduled work but the Worker died before runProcessTake
//     actually started. Re-schedule.
//   - processing_phase = "analysing" AND updated_at < now - 8 min:
//     analysis started but never finished (Worker killed mid-flight, AI
//     gateway hung, etc.). Mark as analysis_pending and re-schedule.
//
// Idempotency is preserved by runProcessTake itself: it only flips a take
// into "analysing"/"processing" once, and refuses to re-enter if the row
// already shows active processing.
// Tightened to match the ~1 min target for fast handoff. The in-handler
// poll loop now owns the long wait (up to 10 min); the reconciler only
// catches takes whose Worker died before runProcessTake started, or
// whose analysing phase truly stalled.
const STALE_PENDING_SECONDS = 15;
const STALE_ANALYSING_MINUTES = 11; // > in-handler 10-min ceiling
const MAX_BATCH = 25;
// Hard cap on how many times the reconciler will retry a single take.
// Past this, the take is parked in `error`.
const MAX_ATTEMPTS = 5;
// Hard wall-clock ceiling — matches the in-handler 10-min preparation budget.
const MAX_TOTAL_AGE_SECONDS = 600;
// Transcoding orphan thresholds — handle the gap between Mux upload and
// `video.asset.ready` webhook delivery.
const STALE_TRANSCODING_MINUTES = 5;
const TRANSCODING_HARD_FAIL_MINUTES = 15;
// Uploading-phase orphan threshold. Takes that sit in "uploading" longer than
// this had their browser tab closed, lost their network, or their direct
// upload aborted before any Mux webhook fired. The UI shows them as
// "Uploading your tape…" indefinitely otherwise.
const STALE_UPLOADING_MINUTES = 15;
// Finalising-orphan window: a take in processing_phase="finalising" whose
// updated_at hasn't moved for this many minutes is assumed to have died
// during deterministic post-AI processing or final persistence. We force it
// to error rather than reschedule, so the UI never sits on "Finalising
// results" indefinitely. Note: long-running AI calls remain in the
// "analysing" phase and are NOT force-errored at this threshold — they fall
// under the longer STALE_ANALYSING_MINUTES reschedule policy instead.
const FINALISING_ORPHAN_MINUTES = 5;

type MuxAssetLike = {
  id?: string;
  status?: string;
  duration?: number;
  playback_ids?: Array<{ id: string; policy: string }>;
  static_renditions?: { status?: string };
  errors?: unknown;
};

async function attemptTranscodingRecovery(take: {
  id: string;
  mux_asset_id: string | null;
  mux_upload_id: string | null;
  mux_status: string | null;
  processing_phase: string | null;
  ageSeconds: number;
}): Promise<
  | { kind: "recovered" }
  | { kind: "not_ready"; reason: string; muxAssetStatus?: string; muxUploadStatus?: string }
  | { kind: "terminal"; reason: string; muxAssetStatus?: string; muxUploadStatus?: string }
  | { kind: "unrecoverable"; reason: string; muxUploadStatus?: string }
> {
  const baseLog = {
    take_id: take.id,
    mux_status: take.mux_status,
    processing_phase: take.processing_phase,
    age_seconds: Math.round(take.ageSeconds),
    has_mux_asset_id: Boolean(take.mux_asset_id),
    has_upload_id: Boolean(take.mux_upload_id),
  };

  const mux = (() => {
    try {
      return getMux();
    } catch (err) {
      console.error("transcoding_orphan_checked mux client unavailable", { ...baseLog, err: String(err) });
      return null;
    }
  })();
  if (!mux) {
    return { kind: "not_ready", reason: "mux_client_unavailable" };
  }

  let assetId = take.mux_asset_id;
  let muxUploadStatus: string | undefined;

  if (!assetId) {
    if (!take.mux_upload_id) {
      console.warn("unrecoverable_transcoding_orphan", { ...baseLog, reason: "no_asset_no_upload" });
      return { kind: "unrecoverable", reason: "no_asset_no_upload" };
    }
    try {
      const upload = await mux.video.uploads.retrieve(take.mux_upload_id);
      muxUploadStatus = upload?.status;
      if (upload?.asset_id) {
        assetId = upload.asset_id;
      } else {
        console.warn("mux_upload_missing", {
          ...baseLog,
          mux_upload_status: muxUploadStatus,
          reason: "upload_has_no_asset",
        });
        if (upload?.status === "errored" || upload?.status === "cancelled") {
          return { kind: "terminal", reason: `upload_${upload.status}`, muxUploadStatus };
        }
        return { kind: "not_ready", reason: "upload_no_asset_yet", muxUploadStatus };
      }
    } catch (err) {
      console.error("mux_upload_missing fetch failed", { ...baseLog, err: String(err) });
      return { kind: "not_ready", reason: "upload_fetch_failed" };
    }
  }

  let asset: MuxAssetLike;
  try {
    asset = (await mux.video.assets.retrieve(assetId!)) as MuxAssetLike;
  } catch (err) {
    console.error("mux_asset_missing", { ...baseLog, asset_id_known: assetId, err: String(err) });
    return { kind: "not_ready", reason: "asset_fetch_failed", muxUploadStatus };
  }

  const muxAssetStatus = asset.status;

  if (muxAssetStatus === "errored") {
    console.warn("mux_asset_not_ready", { ...baseLog, mux_asset_status: muxAssetStatus, terminal: true });
    return { kind: "terminal", reason: "asset_errored", muxAssetStatus, muxUploadStatus };
  }

  if (muxAssetStatus !== "ready") {
    console.log("mux_asset_not_ready", { ...baseLog, mux_asset_status: muxAssetStatus });
    return { kind: "not_ready", reason: "asset_not_ready", muxAssetStatus, muxUploadStatus };
  }

  const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
  const duration = typeof asset.duration === "number" ? asset.duration : null;
  if (!playbackId || !duration || duration <= 0) {
    console.log("mux_asset_not_ready", {
      ...baseLog,
      mux_asset_status: muxAssetStatus,
      reason: "missing_playback_or_duration",
    });
    return { kind: "not_ready", reason: "missing_playback_or_duration", muxAssetStatus, muxUploadStatus };
  }

  const renditionStatus = asset.static_renditions?.status;
  if (renditionStatus === "errored") {
    console.warn("mux_static_rendition_failed", {
      ...baseLog,
      mux_asset_status: muxAssetStatus,
      static_rendition_status: renditionStatus,
    });
    // Still recoverable for streaming-based analysis; don't terminate.
  }

  const mp4Standard = normaliseMuxMp4Url(buildMuxHighestMp4Url(playbackId));

  const { error: backfillErr } = await supabaseAdmin
    .from("takes")
    .update({
      mux_asset_id: assetId,
      mux_playback_id: playbackId,
      mux_mp4_standard_url: mp4Standard,
      mux_mp4_high_url: null,
      mux_duration_seconds: duration,
      mux_status: "ready",
      processing_phase: "analysis_pending",
      status: "pending",
      error_message: null,
    })
    .eq("id", take.id);

  if (backfillErr) {
    console.error("mux_backfill_success update failed", { ...baseLog, err: backfillErr });
    return { kind: "not_ready", reason: "backfill_update_failed", muxAssetStatus, muxUploadStatus };
  }

  console.log("mux_backfill_success", { ...baseLog, mux_asset_status: muxAssetStatus });
  console.log("transcoding_orphan_recovered", { ...baseLog, mux_asset_status: muxAssetStatus });
  return { kind: "recovered" };
}

export const Route = createFileRoute("/api/public/reconcile-stale-takes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RECONCILER_SECRET;
        if (!secret) {
          console.error("RECONCILER_SECRET not configured");
          return new Response("not configured", { status: 503 });
        }
        const provided = request.headers.get("x-reconciler-secret");
        if (provided !== secret) {
          return new Response("unauthorized", { status: 401 });
        }

        const now = Date.now();
        metric("reconciler_run", { reason: "cron_tick" });
        const pendingCutoff = new Date(now - STALE_PENDING_SECONDS * 1_000).toISOString();
        const analysingCutoff = new Date(now - STALE_ANALYSING_MINUTES * 60_000).toISOString();

        // Pull stale candidates in both buckets. We also need created_at to
        // enforce the overall wall-clock ceiling.
        const { data: stalePending, error: pErr } = await supabaseAdmin
          .from("takes")
          .select("id, updated_at, created_at, processing_phase, attempt_count")
          .eq("processing_phase", "analysis_pending")
          .lt("updated_at", pendingCutoff)
          .limit(MAX_BATCH);

        const { data: staleAnalysing, error: aErr } = await supabaseAdmin
          .from("takes")
          .select("id, updated_at, created_at, processing_phase, attempt_count")
          .eq("processing_phase", "analysing")
          .lt("updated_at", analysingCutoff)
          .limit(MAX_BATCH);

        const transcodingCutoff = new Date(now - STALE_TRANSCODING_MINUTES * 60_000).toISOString();
        const { data: staleTranscoding, error: tErr } = await supabaseAdmin
          .from("takes")
          .select(
            "id, updated_at, created_at, processing_phase, attempt_count, mux_status, mux_asset_id, mux_upload_id, status",
          )
          .eq("processing_phase", "transcoding")
          .in("status", ["pending", "processing"])
          .lt("updated_at", transcodingCutoff)
          .limit(MAX_BATCH);

        // Uploading-phase orphans: rows whose direct upload never fired any
        // Mux webhook (tab closed, network died, createMuxDirectUpload failed
        // before persisting mux_upload_id). Without this scan, the UI shows
        // "Uploading your tape…" forever.
        const uploadingCutoff = new Date(now - STALE_UPLOADING_MINUTES * 60_000).toISOString();
        const { data: staleUploading, error: uErr } = await supabaseAdmin
          .from("takes")
          .select(
            "id, updated_at, created_at, processing_phase, attempt_count, mux_status, mux_asset_id, mux_upload_id, status",
          )
          .eq("processing_phase", "uploading")
          .in("status", ["pending", "processing"])
          .lt("updated_at", uploadingCutoff)
          .limit(MAX_BATCH);

        if (pErr || aErr || tErr || uErr) {
          console.error("reconcile-stale-takes select failed", { pErr, aErr, tErr, uErr });
          return new Response("db error", { status: 500 });
        }

        const candidates = [...(stalePending ?? []), ...(staleAnalysing ?? [])];
        const reconciled: string[] = [];
        const giveUp: string[] = [];
        const transcodingRecovered: string[] = [];
        const transcodingForcedError: string[] = [];
        const uploadingRecovered: string[] = [];
        const uploadingForcedError: string[] = [];

        // Uploading-phase orphan recovery. Two cases:
        //   (a) row has a mux_upload_id or mux_asset_id → defer to the same
        //       Mux-aware recovery used for transcoding orphans (it can
        //       backfill if the asset is actually ready).
        //   (b) row has neither → upload was abandoned, mark terminal so the
        //       UI stops spinning.
        for (const take of staleUploading ?? []) {
          const ageSeconds = (now - new Date(take.created_at).getTime()) / 1000;
          const baseLog = {
            take_id: take.id,
            mux_status: take.mux_status,
            processing_phase: take.processing_phase,
            age_seconds: Math.round(ageSeconds),
            has_mux_asset_id: Boolean(take.mux_asset_id),
            has_upload_id: Boolean(take.mux_upload_id),
          };
          console.log("uploading_orphan_checked", baseLog);
          metric("stuck_uploading", {
            take_id: take.id,
            processing_phase: "uploading",
            duration_ms: Math.round(ageSeconds * 1000),
          });

          if (take.mux_asset_id || take.mux_upload_id) {
            // Defer to the Mux-aware recovery path used for transcoding orphans.
            const recovery = await attemptTranscodingRecovery({
              id: take.id,
              mux_asset_id: take.mux_asset_id ?? null,
              mux_upload_id: take.mux_upload_id ?? null,
              mux_status: take.mux_status ?? null,
              processing_phase: take.processing_phase ?? null,
              ageSeconds,
            });
            if (recovery.kind === "recovered") {
              metric("mux_recovery_success", { take_id: take.id, source: "uploading_orphan" });
              uploadingRecovered.push(take.id);
              continue;
            }
            // Fall through to terminal failure if Mux says it's truly gone or
            // the row is past the hard cap.
            const hardCap = ageSeconds >= TRANSCODING_HARD_FAIL_MINUTES * 60;
            if (!(recovery.kind === "terminal" || hardCap)) {
              continue;
            }
          }

          // Terminal: abandoned upload OR Mux says it's gone.
          const { error: failErr } = await supabaseAdmin
            .from("takes")
            .update({
              status: "error",
              processing_phase: "error",
              error_message:
                "[failure_code:upload_abandoned] Your upload didn't finish. Please try again.",
            })
            .eq("id", take.id);
          if (failErr) {
            console.error("uploading_orphan_forced_error update failed", { ...baseLog, failErr });
            metric("phase_transition_failure", {
              take_id: take.id,
              reason: "uploading_force_error_db_failed",
            });
            continue;
          }
          console.warn("uploading_orphan_forced_error", {
            ...baseLog,
            failure_code: "upload_abandoned",
          });
          metric("analysis_stale_timeout", {
            take_id: take.id,
            processing_phase: "uploading",
            failure_code: "upload_abandoned",
            age_seconds: Math.round(ageSeconds),
          });
          metric("reconciler_forced_error_count", {
            take_id: take.id,
            processing_phase: "uploading",
            failure_code: "upload_abandoned",
          });
          uploadingForcedError.push(take.id);
        }


        // Transcoding orphan recovery: separate loop because the recovery
        // path talks to Mux and may backfill rather than re-run analysis.
        for (const take of staleTranscoding ?? []) {
          const ageSeconds = (now - new Date(take.created_at).getTime()) / 1000;
          const baseLog = {
            take_id: take.id,
            mux_status: take.mux_status,
            processing_phase: take.processing_phase,
            age_seconds: Math.round(ageSeconds),
            has_mux_asset_id: Boolean(take.mux_asset_id),
            has_upload_id: Boolean(take.mux_upload_id),
          };
          console.log("transcoding_orphan_checked", baseLog);
          metric("stuck_transcoding", {
            take_id: take.id,
            processing_phase: "transcoding",
            duration_ms: Math.round(ageSeconds * 1000),
          });
          metric("mux_recovery_attempt", { take_id: take.id });

          const recovery = await attemptTranscodingRecovery({
            id: take.id,
            mux_asset_id: take.mux_asset_id ?? null,
            mux_upload_id: take.mux_upload_id ?? null,
            mux_status: take.mux_status ?? null,
            processing_phase: take.processing_phase ?? null,
            ageSeconds,
          });

          if (recovery.kind === "recovered") {
            metric("mux_recovery_success", { take_id: take.id });
            metric("reconciler_recovered", {
              take_id: take.id,
              processing_phase: "transcoding",
            });
            transcodingRecovered.push(take.id);
            continue;
          }

          metric("mux_recovery_failure", {
            take_id: take.id,
            reason: recovery.kind,
          });

          const hardCap = ageSeconds >= TRANSCODING_HARD_FAIL_MINUTES * 60;
          const shouldForceError =
            recovery.kind === "terminal" ||
            (hardCap && (recovery.kind === "unrecoverable" || recovery.kind === "not_ready"));

          if (!shouldForceError) {
            continue; // Leave it for another reconciler pass.
          }

          const { error: failErr } = await supabaseAdmin
            .from("takes")
            .update({
              status: "error",
              processing_phase: "error",
              error_message:
                "[failure_code:stale_timeout] This analysis took too long and was stopped. Please try again.",
            })
            .eq("id", take.id);
          if (failErr) {
            console.error("transcoding_orphan_forced_error update failed", { ...baseLog, failErr });
            metric("phase_transition_failure", {
              take_id: take.id,
              reason: "transcoding_force_error_db_failed",
            });
            continue;
          }
          console.warn("transcoding_orphan_forced_error", {
            ...baseLog,
            reason: recovery.kind,
            failure_code: "stale_timeout",
            detail: "reason" in recovery ? recovery.reason : undefined,
            mux_asset_status: "muxAssetStatus" in recovery ? recovery.muxAssetStatus : undefined,
            mux_upload_status: "muxUploadStatus" in recovery ? recovery.muxUploadStatus : undefined,
          });
          metric("analysis_stale_timeout", {
            take_id: take.id,
            processing_phase: "transcoding",
            failure_code: "stale_timeout",
            age_seconds: Math.round(ageSeconds),
          });
          metric("reconciler_forced_error", {
            take_id: take.id,
            processing_phase: "transcoding",
            reason: recovery.kind,
            failure_code: "stale_timeout",
          });
          metric("reconciler_forced_error_count", {
            take_id: take.id,
            processing_phase: "transcoding",
            failure_code: "stale_timeout",
          });
          metric("analysis_failed", {
            take_id: take.id,
            processing_phase: "transcoding",
            reason: "transcoding_orphan_unrecoverable",
            failure_code: "stale_timeout",
          });
          transcodingForcedError.push(take.id);
        }

        for (const take of candidates) {
          const attempts = take.attempt_count ?? 0;
          const ageSeconds = (now - new Date(take.created_at).getTime()) / 1000;
          const exceededAttempts = attempts >= MAX_ATTEMPTS;
          const exceededClock = ageSeconds >= MAX_TOTAL_AGE_SECONDS;

          // Stuck-state metric: emit once per pass, attributed to the actual
          // phase the take is wedged in.
          if (take.processing_phase === "analysis_pending") {
            metric("stuck_analysis_pending", {
              take_id: take.id,
              processing_phase: "analysis_pending",
              duration_ms: Math.round(ageSeconds * 1000),
            });
          }

          // Cost / wall-clock guard: park in `error` once either limit is hit.
          if (exceededAttempts || exceededClock) {
            const { error: failErr } = await supabaseAdmin
              .from("takes")
              .update({
                status: "error",
                processing_phase: "error",
                error_message:
                  "[failure_code:stale_timeout] This analysis took too long and was stopped. Please try again.",
              })
              .eq("id", take.id);
            if (failErr) {
              console.error("reconcile-stale-takes give-up update failed", { takeId: take.id, failErr });
              metric("phase_transition_failure", {
                take_id: take.id,
                reason: "give_up_update_failed",
              });
            } else {
              console.warn("reconcile-stale-takes giving up on take", {
                takeId: take.id,
                attempts,
                ageSeconds: Math.round(ageSeconds),
                reason: exceededClock ? "wall-clock" : "attempts",
                failure_code: "stale_timeout",
              });
              metric("analysis_stale_timeout", {
                take_id: take.id,
                processing_phase: take.processing_phase,
                failure_code: "stale_timeout",
                age_seconds: Math.round(ageSeconds),
                reason: exceededClock ? "wall_clock" : "attempts",
              });
              metric("reconciler_forced_error", {
                take_id: take.id,
                processing_phase: take.processing_phase,
                reason: exceededClock ? "wall_clock" : "attempts",
                attempt: attempts,
                failure_code: "stale_timeout",
              });
              metric("reconciler_forced_error_count", {
                take_id: take.id,
                processing_phase: take.processing_phase,
                failure_code: "stale_timeout",
              });
              metric("analysis_failed", {
                take_id: take.id,
                processing_phase: take.processing_phase,
                reason: "reconciler_give_up",
                failure_code: "stale_timeout",
              });
              giveUp.push(take.id);
            }
            continue;
          }

          // Finalising-orphan guard: a take stuck in `analysing` whose
          // updated_at hasn't moved for FINALISING_ORPHAN_MINUTES is almost
          // certainly a worker that died after the AI returned (during
          // post-processing or final persistence). Force-error it so the
          // UI never spins on "Finalising results" indefinitely.
          if (take.processing_phase === "analysing") {
            const idleSeconds =
              (now - new Date(take.updated_at).getTime()) / 1000;
            if (idleSeconds >= FINALISING_ORPHAN_MINUTES * 60) {
              const { error: failErr } = await supabaseAdmin
                .from("takes")
                .update({
                  status: "error",
                  processing_phase: "error",
                  error_message:
                    "We couldn’t finish your report this time. Please try again.",
                })
                .eq("id", take.id)
                .eq("processing_phase", "analysing")
                .eq("status", "processing");
              if (failErr) {
                console.error("finalising_orphan_force_error_failed", {
                  takeId: take.id,
                  failErr,
                });
                metric("phase_transition_failure", {
                  take_id: take.id,
                  reason: "finalising_orphan_force_error_failed",
                });
                continue;
              }
              console.warn("[take-pipeline] finalising_orphan_forced_error", {
                take_id: take.id,
                age_seconds: Math.round(ageSeconds),
                idle_seconds: Math.round(idleSeconds),
                processing_phase: "analysing",
              });
              metric("reconciler_forced_error", {
                take_id: take.id,
                processing_phase: "analysing",
                reason: "finalising_orphan",
                failure_code: "finalising_orphan",
              });
              metric("reconciler_forced_error_count", {
                take_id: take.id,
                processing_phase: "analysing",
                failure_code: "finalising_orphan",
              });
              metric("analysis_failed", {
                take_id: take.id,
                processing_phase: "analysing",
                reason: "finalising_orphan",
                failure_code: "finalising_orphan",
              });
              giveUp.push(take.id);
              continue;
            }
          }

          // Reset back to analysis_pending so runProcessTake will pick it up
          // (its idempotency check skips takes that are actively analysing,
          // so we MUST clear the analysing flag before rescheduling).
          const { error: updErr } = await supabaseAdmin
            .from("takes")
            .update({
              status: "pending",
              processing_phase: "analysis_pending",
              error_message: null,
            })
            .eq("id", take.id);

          if (updErr) {
            console.error("reconcile-stale-takes update failed", { takeId: take.id, updErr });
            metric("phase_transition_failure", {
              take_id: take.id,
              reason: "reschedule_update_failed",
            });
            continue;
          }

          console.log("reconcile-stale-takes rescheduling take", {
            takeId: take.id,
            wasPhase: take.processing_phase,
            staleSinceMs: now - new Date(take.updated_at).getTime(),
          });
          metric("reconciler_recovered", {
            take_id: take.id,
            processing_phase: take.processing_phase,
            duration_ms: now - new Date(take.updated_at).getTime(),
            reason: "rescheduled",
          });
          scheduleBackground(
            (async () => {
              const result = await runProcessTake(take.id);
              console.log("reconcile-stale-takes runProcessTake completed", {
                takeId: take.id,
                result,
              });
              return result;
            })(),
            `reconcile:${take.id}`,
          );
          reconciled.push(take.id);
        }

        return Response.json({
          ok: true,
          stalePending: stalePending?.length ?? 0,
          staleAnalysing: staleAnalysing?.length ?? 0,
          staleTranscoding: staleTranscoding?.length ?? 0,
          staleUploading: staleUploading?.length ?? 0,
          reconciled,
          giveUp,
          transcodingRecovered,
          transcodingForcedError,
          uploadingRecovered,
          uploadingForcedError,
        });
      },
    },
  },
});
