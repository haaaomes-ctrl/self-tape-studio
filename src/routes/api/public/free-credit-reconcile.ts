// Free-credit reconcile endpoint (Monday 2969404421; ADR-0005).
//
// Batch-issues due free credits (free_signup once per account, free_monthly
// allowance per rolling 31 days) for users selected by the service-role-only
// list_free_credit_due_users helper — only users actually DUE issuance, so
// the batch limit is a safety cap, not a starvation risk.
//
// Issuance runs through the TS reconcile (grantFundedCredits) so the CRM
// emails fire correctly — this is why the daily pg_cron job targets this
// endpoint instead of granting in SQL. The first manual run after deploy is
// the one-time backfill + email pass for existing accounts. Idempotency keys
// make cron + lazy on-access issuance safe to run together (no double issue).
//
// Mirrors the admin-config pattern: gated by `x-reconciler-secret` matching
// the RECONCILER_SECRET env var (503 unset fail-closed, 401 mismatch).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reconcileFreeCreditsForUser } from "@/server/free-credit-issuance.server";

const BodySchema = z
  .object({
    limit: z.number().int().positive().max(1000).optional(),
  })
  .strict();

function authorise(request: Request): Response | null {
  const secret = process.env.RECONCILER_SECRET;
  if (!secret) {
    console.error("[free-credit-reconcile] RECONCILER_SECRET not configured");
    return new Response("not configured", { status: 503 });
  }
  const provided = request.headers.get("x-reconciler-secret");
  if (provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/free-credit-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = authorise(request);
        if (denied) return denied;

        let limit = 200;
        try {
          const raw = await request.text();
          if (raw.trim()) {
            const parsed = BodySchema.safeParse(JSON.parse(raw));
            if (!parsed.success) {
              return Response.json(
                { error: "invalid_body", issues: parsed.error.issues },
                { status: 400 },
              );
            }
            limit = parsed.data.limit ?? limit;
          }
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const { data, error } = await supabaseAdmin.rpc("list_free_credit_due_users", {
          p_limit: limit,
        });
        if (error) {
          console.error("[free-credit-reconcile] due_users_read_failed", {
            error: error.message,
          });
          return new Response("candidate read failed", { status: 500 });
        }

        const userIds = (data ?? []) as string[];
        let signupGranted = 0;
        let monthlyGranted = 0;
        let failed = 0;
        // Sequential on purpose: each user is one indexed read plus at most
        // two grant RPCs, and a slow steady pass beats hammering PostgREST.
        for (const userId of userIds) {
          const result = await reconcileFreeCreditsForUser(userId);
          if (!result.ok) failed += 1;
          if (result.signup_granted) signupGranted += 1;
          if (result.monthly_granted) monthlyGranted += 1;
        }

        const summary = {
          processed: userIds.length,
          signup_granted: signupGranted,
          monthly_granted: monthlyGranted,
          failed,
          limit,
        };
        console.log("[free-credit-reconcile] run_complete", summary);
        return Response.json(summary);
      },
    },
  },
});
