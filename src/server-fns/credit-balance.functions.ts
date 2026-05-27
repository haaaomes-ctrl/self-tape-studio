import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  activatePartnerCodeForUser,
  getUserCreditBalanceSnapshot,
  PartnerCodeActivationError,
} from "@/server/credit-balance.server";

function claimEmail(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const email = (claims as { email?: unknown }).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

export const getCreditBalance = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => getUserCreditBalanceSnapshot(context.userId));

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
      return await activatePartnerCodeForUser({
        userId: context.userId,
        rawCode: data.code,
        userEmail: claimEmail(context.claims),
      });
    } catch (err) {
      if (err instanceof PartnerCodeActivationError) {
        throw new Error(err.message);
      }
      throw err;
    }
  });
