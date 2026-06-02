import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function claimEmail(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const email = (claims as { email?: unknown }).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

export const getCreditBalance = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { getUserCreditBalanceSnapshot } = await import("@/server/credit-balance.server");
      return await getUserCreditBalanceSnapshot(context.userId);
    } catch (error) {
      const { safeCutoverLog } = await import("@/server/cutover-diagnostics.server");
      safeCutoverLog("error", "[credit-balance] server_fn_failed", {
        operation: "dashboard_credit_balance_load",
        code:
          error instanceof Error && error.name === "SupabaseAdminRuntimeConfigError"
            ? "server_supabase_misconfigured"
            : "credit_balance_unavailable",
        user_id: context.userId,
        table: "credit_grants,partner_memberships",
        action: "select",
        error,
      });
      throw new Error("CREDIT_BALANCE_UNAVAILABLE: Credit balance could not be loaded.");
    }
  });

export const activateCurrentUserPartnerCode = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().trim().min(6).max(64),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      const { activatePartnerCodeForUser } = await import("@/server/credit-balance.server");
      return await activatePartnerCodeForUser({
        userId: context.userId,
        rawCode: data.code,
        userEmail: claimEmail(context.claims),
      });
    } catch (err) {
      const { PartnerCodeActivationError } = await import("@/server/credit-balance.server");
      if (err instanceof PartnerCodeActivationError) {
        throw new Error(err.message);
      }
      throw err;
    }
  });
