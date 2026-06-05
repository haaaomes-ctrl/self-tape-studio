// SERVER-ONLY: quota exemption seeding for the tier-aware daily quota.
//
// public.quota_exempt_users is the DB-trigger-side exemption list for the
// daily submission cap. It is service-role-only (RLS deny-all, client grants
// revoked) so it can never be written from the client. Rows are keyed on the
// auth user UUID — the admin email lives only in the credit-entitlement
// system (ADMIN_UNLIMITED_CREDIT_EMAIL) and is never stored in SQL.
//
// Seeding is an idempotent reconcile: resolve the user's entitlement via the
// existing credit-entitlement system, and only upsert the exemption row when
// the entitlement is unlimited_admin. Re-running is always safe.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  isUnlimitedAdminCreditEntitlement,
  logCreditEntitlement,
  resolveCreditEntitlementForUser,
} from "./credit-entitlement.server";

export const ADMIN_QUOTA_EXEMPTION_REASON = "admin_test_account";

export type AdminQuotaExemptionReconcileResult =
  | { ok: true; exempt: true; user_id: string }
  | { ok: true; exempt: false; user_id: string }
  | { ok: false; error: string; user_id: string };

/**
 * Idempotently upsert the exemption row for a user the caller has ALREADY
 * established as unlimited_admin. Never call this without an entitlement
 * check — use reconcileAdminQuotaExemption when in doubt.
 */
export async function ensureAdminQuotaExemptionRow(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin
    .from("quota_exempt_users")
    .upsert(
      { user_id: userId, reason: ADMIN_QUOTA_EXEMPTION_REASON },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[quota-exemption] admin_seed_upsert_failed", {
      user_id: userId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Idempotently upsert the quota exemption row for a user IF (and only if)
 * the credit-entitlement system resolves them to unlimited_admin. Non-admin
 * users are never seeded — the call is a no-op for them.
 */
export async function reconcileAdminQuotaExemption(
  userId: string,
  email?: string | null,
): Promise<AdminQuotaExemptionReconcileResult> {
  const entitlement = await resolveCreditEntitlementForUser({ userId, email });
  if (!isUnlimitedAdminCreditEntitlement(entitlement)) {
    return { ok: true, exempt: false, user_id: userId };
  }
  logCreditEntitlement(entitlement, "quota_exemption_reconcile");

  const seeded = await ensureAdminQuotaExemptionRow(userId);
  if (!seeded.ok) {
    return { ok: false, error: seeded.error, user_id: userId };
  }
  return { ok: true, exempt: true, user_id: userId };
}

/**
 * List the current exemption rows (verification surface for the rollout's
 * "verify the admin is exempt before flipping quota_enabled" step).
 */
export async function listQuotaExemptUsers(): Promise<
  | { ok: true; rows: Array<{ user_id: string; reason: string | null; created_at: string }> }
  | { ok: false; error: string }
> {
  const { data, error } = await supabaseAdmin
    .from("quota_exempt_users")
    .select("user_id, reason, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, rows: data ?? [] };
}
