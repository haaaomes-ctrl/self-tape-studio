// Admin-only quota exemption seed + verify endpoint (WS1 rollout steps 2-3).
//
// Mirrors the admin-config pattern: lives under /api/public/ but is gated by
// the shared `x-reconciler-secret` header (`RECONCILER_SECRET` env var).
// There is no user-facing UI for this — it is operated cloud-side via curl.
//
// GET  → list current quota_exempt_users rows (the "verify the admin is
//        exempt" step before quota_enabled is flipped back on)
// POST → body { user_id: "<uuid>" }. Resolves the user's entitlement via the
//        existing credit-entitlement system and seeds the exemption row ONLY
//        if it resolves to unlimited_admin. Idempotent — safe to re-run.
//        The admin email is never accepted as input and never stored.
//
// Security:
//   - 503 if RECONCILER_SECRET is not configured (fail-closed)
//   - 401 if header missing or mismatched
//   - 403 if the supplied UUID does not resolve to unlimited_admin (a
//     non-admin user can never be seeded through this endpoint)
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  listQuotaExemptUsers,
  reconcileAdminQuotaExemption,
} from "@/server/quota-exemption.server";

const SeedSchema = z.object({ user_id: z.string().uuid() }).strict();

function authorise(request: Request): Response | null {
  const secret = process.env.RECONCILER_SECRET;
  if (!secret) {
    console.error("[admin-quota-exemption] RECONCILER_SECRET not configured");
    return new Response("not configured", { status: 503 });
  }
  const provided = request.headers.get("x-reconciler-secret");
  if (provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/admin-quota-exemption")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorise(request);
        if (denied) return denied;
        const result = await listQuotaExemptUsers();
        if (!result.ok) {
          console.error("[admin-quota-exemption] list_failed", { error: result.error });
          return new Response("list failed", { status: 500 });
        }
        return Response.json({ rows: result.rows });
      },
      POST: async ({ request }) => {
        const denied = authorise(request);
        if (denied) return denied;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const parsed = SeedSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "invalid_body", issues: parsed.error.issues },
            { status: 400 },
          );
        }

        const result = await reconcileAdminQuotaExemption(parsed.data.user_id);
        if (!result.ok) {
          console.error("[admin-quota-exemption] seed_failed", {
            user_id: result.user_id,
            error: result.error,
          });
          return new Response("seed failed", { status: 500 });
        }
        if (!result.exempt) {
          // The UUID does not resolve to the admin entitlement — refuse.
          console.warn("[admin-quota-exemption] seed_refused_not_admin", {
            user_id: result.user_id,
          });
          return Response.json(
            { error: "not_admin_entitlement", user_id: result.user_id },
            { status: 403 },
          );
        }

        console.log("[admin-quota-exemption] seeded", { user_id: result.user_id });
        return Response.json({ ok: true, user_id: result.user_id, exempt: true });
      },
    },
  },
});
