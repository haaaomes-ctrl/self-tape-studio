import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runProcessTake } from "@/server/process-take.server";
import { scheduleBackground } from "@/worker-entry";

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
const STALE_PENDING_MINUTES = 2;
const STALE_ANALYSING_MINUTES = 8;
const MAX_BATCH = 25;

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
        const pendingCutoff = new Date(now - STALE_PENDING_MINUTES * 60_000).toISOString();
        const analysingCutoff = new Date(now - STALE_ANALYSING_MINUTES * 60_000).toISOString();

        // Pull stale candidates in both buckets.
        const { data: stalePending, error: pErr } = await supabaseAdmin
          .from("takes")
          .select("id, updated_at, processing_phase, attempt_count")
          .eq("processing_phase", "analysis_pending")
          .lt("updated_at", pendingCutoff)
          .limit(MAX_BATCH);

        const { data: staleAnalysing, error: aErr } = await supabaseAdmin
          .from("takes")
          .select("id, updated_at, processing_phase, attempt_count")
          .eq("processing_phase", "analysing")
          .lt("updated_at", analysingCutoff)
          .limit(MAX_BATCH);

        if (pErr || aErr) {
          console.error("reconcile-stale-takes select failed", { pErr, aErr });
          return new Response("db error", { status: 500 });
        }

        const candidates = [...(stalePending ?? []), ...(staleAnalysing ?? [])];
        const reconciled: string[] = [];

        for (const take of candidates) {
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
            continue;
          }

          console.log("reconcile-stale-takes rescheduling take", {
            takeId: take.id,
            wasPhase: take.processing_phase,
            staleSinceMs: now - new Date(take.updated_at).getTime(),
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
          reconciled,
        });
      },
    },
  },
});
