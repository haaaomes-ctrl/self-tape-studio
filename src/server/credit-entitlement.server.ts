import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_UNLIMITED_CREDIT_EMAIL = "o.halawi90@gmail.com";

export type CreditMode = "standard" | "unlimited_admin";

export type CreditEntitlement = {
  user_id: string | null;
  credit_mode: CreditMode;
  canAnalyse: boolean;
  requiresCreditReservation: boolean;
  shouldDecrementCredit: boolean;
  reason: "standard_credit_lifecycle" | "admin_test_account";
};

export function normaliseCreditEntitlementEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

export function resolveCreditEntitlementFromEmail(input: {
  userId?: string | null;
  email?: string | null;
}): CreditEntitlement {
  const normalisedEmail = normaliseCreditEntitlementEmail(input.email);
  if (normalisedEmail === ADMIN_UNLIMITED_CREDIT_EMAIL) {
    return {
      user_id: input.userId ?? null,
      credit_mode: "unlimited_admin",
      canAnalyse: true,
      requiresCreditReservation: false,
      shouldDecrementCredit: false,
      reason: "admin_test_account",
    };
  }

  return {
    user_id: input.userId ?? null,
    credit_mode: "standard",
    canAnalyse: true,
    requiresCreditReservation: true,
    shouldDecrementCredit: true,
    reason: "standard_credit_lifecycle",
  };
}

async function readAuthUserEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) {
      console.warn("[credit-entitlement] auth_user_lookup_failed", {
        user_id: userId,
        reason: "admin_credit_entitlement_lookup",
      });
      return null;
    }
    return typeof data.user?.email === "string" ? data.user.email : null;
  } catch {
    console.warn("[credit-entitlement] auth_user_lookup_threw", {
      user_id: userId,
      reason: "admin_credit_entitlement_lookup",
    });
    return null;
  }
}

export async function resolveCreditEntitlementForUser(input: {
  userId?: string | null;
  email?: string | null;
}): Promise<CreditEntitlement> {
  const directEmail = normaliseCreditEntitlementEmail(input.email);
  if (directEmail) {
    return resolveCreditEntitlementFromEmail({ userId: input.userId, email: directEmail });
  }
  if (!input.userId) {
    return resolveCreditEntitlementFromEmail({ userId: null, email: null });
  }

  const resolvedEmail = await readAuthUserEmail(input.userId);
  return resolveCreditEntitlementFromEmail({ userId: input.userId, email: resolvedEmail });
}

export function isUnlimitedAdminCreditEntitlement(entitlement: CreditEntitlement): boolean {
  return entitlement.credit_mode === "unlimited_admin";
}

export function logCreditEntitlement(entitlement: CreditEntitlement, surface: string): void {
  if (!isUnlimitedAdminCreditEntitlement(entitlement)) return;
  console.info("[credit-entitlement] unlimited_admin_credit", {
    user_id: entitlement.user_id,
    credit_mode: entitlement.credit_mode,
    reason: entitlement.reason,
    surface,
  });
}
