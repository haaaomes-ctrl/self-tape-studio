// Admin-only diagnostic bundle fetch (PR-3). Mirrors the proven
// listAllArtifacts/signArtifactDownload shape in
// src/lib/admin-storage.functions.ts: auth middleware, then
// assertAdminClaims FIRST — unreachable by performers.
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminClaims } from "@/lib/admin-storage.functions";

const InputSchema = z.object({ takeId: z.string().uuid() });

export const getReportDiagnosticBundle = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ context, data }) => {
    assertAdminClaims((context as { claims?: { email?: string | null } }).claims);
    try {
      setResponseHeader("Cache-Control", "no-store");
    } catch {
      // header is best-effort outside a request context (tests)
    }
    const { buildReportDiagnosticBundle } = await import("@/server/report-diagnostics.server");
    return buildReportDiagnosticBundle(data.takeId);
  });
