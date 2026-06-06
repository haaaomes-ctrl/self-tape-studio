// Admin-only backend config endpoint.
//
// Mirrors the existing reconciler pattern: lives under /api/public/ but is
// gated by a shared secret header (`x-reconciler-secret` matching the
// `RECONCILER_SECRET` env var). There is no user-facing UI for this — the
// configuration is intended to be edited cloud-side via curl/HTTP.
//
// GET  → returns current resolved config (with `source: config|default`)
// POST → updates one or more fields, then returns the new resolved config
//
// Security:
//   - 503 if RECONCILER_SECRET is not configured (fail-closed)
//   - 401 if header missing or mismatched
//   - All field validation happens server-side. Negative/zero/non-integer
//     values are rejected with 400.
//   - Only the documented fields can be written. No model keys,
//     prompts, scoring weights, or other tuning is editable here.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getResolvedConfig } from "@/server/app-config.server";

const UpdateSchema = z
  .object({
    quota_enabled: z.boolean().optional(),
    daily_submission_cap: z.number().int().positive().max(10_000).optional(),
    max_takes_per_audition: z.number().int().positive().max(1_000).optional(),
    free_monthly_includes_funded_users: z.boolean().optional(),
    // Template 3 report-view kill-switch (false = legacy V2 view). Read by
    // a narrow fail-open query, NOT getResolvedConfig() — see
    // src/server/report-view-config.server.ts for why.
    tpl3_report_view_enabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.quota_enabled !== undefined ||
      v.daily_submission_cap !== undefined ||
      v.max_takes_per_audition !== undefined ||
      v.free_monthly_includes_funded_users !== undefined ||
      v.tpl3_report_view_enabled !== undefined,
    { message: "At least one field must be provided" },
  );

function authorise(request: Request): Response | null {
  const secret = process.env.RECONCILER_SECRET;
  if (!secret) {
    console.error("[admin-config] RECONCILER_SECRET not configured");
    return new Response("not configured", { status: 503 });
  }
  const provided = request.headers.get("x-reconciler-secret");
  if (provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/admin-config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorise(request);
        if (denied) return denied;
        const cfg = await getResolvedConfig();
        const { getTpl3ReportViewEnabled } = await import("@/server/report-view-config.server");
        return Response.json({
          ...cfg,
          tpl3_report_view_enabled: await getTpl3ReportViewEnabled(),
        });
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
        const parsed = UpdateSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "invalid_body", issues: parsed.error.issues },
            { status: 400 },
          );
        }

        const update = parsed.data;
        const { error: upErr } = await supabaseAdmin
          .from("app_config")
          .update(update)
          .eq("id", "singleton");
        if (upErr) {
          console.error("[admin-config] update_failed", upErr);
          return new Response("update failed", { status: 500 });
        }

        // Log the change (no PII).
        console.log(`[admin-config] updated ${JSON.stringify({ fields: Object.keys(update) })}`);

        const cfg = await getResolvedConfig();
        const { getTpl3ReportViewEnabled } = await import("@/server/report-view-config.server");
        return Response.json({
          ...cfg,
          tpl3_report_view_enabled: await getTpl3ReportViewEnabled(),
        });
      },
    },
  },
});
