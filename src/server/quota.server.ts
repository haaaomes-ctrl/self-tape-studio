// SERVER-ONLY: shared quota helper.
//
// Single source of truth for "how many analyses is this caller allowed?".
// Used by:
//   - createMuxDirectUpload (before issuing an upload URL)
//   - retryProcessTake      (before re-running AI on an existing asset)
//   - mux-webhook handler   (before triggering AI from asset.ready)
//
// Race-safety: this helper is the FIRST line of defence. The DB-level
// trigger `enforce_daily_takes_cap` is the second line — it catches the
// race window between two near-simultaneous inserts.
import { startOfDay } from "date-fns";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getResolvedConfig, SAFE_DEFAULTS } from "./app-config.server";
import {
  isUnlimitedAdminCreditEntitlement,
  logCreditEntitlement,
  resolveCreditEntitlementForUser,
} from "./credit-entitlement.server";
import { ensureAdminQuotaExemptionRow } from "./quota-exemption.server";

// Anon lifetime cap is intentionally hard-coded (out of scope for app_config).
export const ANON_LIFETIME_CAP = 2;
// Re-exported for any legacy import sites; the runtime value comes from config.
export const USER_DAILY_CAP_DEFAULT = SAFE_DEFAULTS.daily_submission_cap;

/**
 * Thrown when a quota check fails. Server functions / route handlers
 * should translate this into HTTP 429.
 */
export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED";
  readonly status = 429;
  readonly scope: "user_daily" | "anon_lifetime";
  readonly cap: number;
  readonly count: number;
  readonly identityKind: "user" | "anon";
  readonly identityId: string;

  constructor(args: {
    scope: "user_daily" | "anon_lifetime";
    cap: number;
    count: number;
    identityKind: "user" | "anon";
    identityId: string;
    message: string;
  }) {
    super(args.message);
    this.scope = args.scope;
    this.cap = args.cap;
    this.count = args.count;
    this.identityKind = args.identityKind;
    this.identityId = args.identityId;
  }
}

export type QuotaIdentity = { kind: "user"; userId: string } | { kind: "anon"; anonId: string };

// Paid/funded credit-grant sources that exempt a user from the FREE-tier
// daily cap. Deliberately excludes free_signup and free_monthly (free tiers
// must stay capped) and admin_grant (admin accounts are exempted solely via
// quota_exempt_users). MUST stay in sync with the source list in the
// enforce_daily_takes_cap trigger (supabase/migrations/20260605090000).
export const PAID_QUOTA_EXEMPT_CREDIT_SOURCES = [
  "user_paid",
  "school_funded",
  "coach_funded",
  "agent_funded",
  "platform_funded",
  "sponsor_campaign",
] as const;

// True when the user holds an active, unexpired paid/funded grant with
// credits remaining. Fails CLOSED to the normal cap path on read errors —
// a lookup failure must never widen the quota.
async function hasActivePaidCreditGrant(userId: string, op: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("credit_grants")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("remaining_credits", 0)
    .in("source", [...PAID_QUOTA_EXEMPT_CREDIT_SOURCES])
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    console.warn(`[quota] ${op} paid_grant_lookup_failed — falling through to cap`, {
      user_id: userId,
      error: error.message,
    });
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Throws QuotaExceededError if the identity is at or over its cap.
 * Logs every rejection (and a debug line for every check).
 *
 * Tier-aware: the daily cap is a FREE-tier control. Admin accounts
 * (unlimited_admin entitlement) and users with an active paid/funded credit
 * grant are exempt. Pass `opts.email` (from verified JWT claims) where
 * available to avoid an auth admin lookup on the admin path.
 */
export async function assertWithinAnalysisQuota(
  identity: QuotaIdentity,
  op: string,
  opts?: { email?: string | null },
): Promise<void> {
  if (identity.kind === "user") {
    // Resolve admin-managed config (with safe defaults). When quota is
    // disabled, bypass the per-day check entirely — the anon path below
    // is unaffected and remains hard-coded.
    const cfg = await getResolvedConfig();
    if (!cfg.quota_enabled) {
      return;
    }
    const cap = cfg.daily_submission_cap;

    // Tier exemption (a): admin/test accounts via the existing
    // credit-entitlement system. Also reconciles the DB-trigger-side
    // exemption row (idempotent; non-fatal if the upsert fails).
    const entitlement = await resolveCreditEntitlementForUser({
      userId: identity.userId,
      email: opts?.email ?? null,
    });
    if (isUnlimitedAdminCreditEntitlement(entitlement)) {
      logCreditEntitlement(entitlement, `quota:${op}`);
      // Self-healing: keep the DB-trigger-side exemption row present.
      // Failure is logged inside and the app-layer exemption still stands.
      await ensureAdminQuotaExemptionRow(identity.userId).catch(() => {});
      return;
    }

    // Tier exemption (b): active paid/funded credit grant.
    if (await hasActivePaidCreditGrant(identity.userId, op)) {
      return;
    }

    const since = startOfDay(new Date()).toISOString();
    const { count, error } = await supabaseAdmin
      .from("takes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", identity.userId)
      .gte("created_at", since);

    if (error) {
      console.error(`[quota] ${op} failed to read user usage`, error);
      throw new Error("Could not check usage");
    }

    const used = count ?? 0;
    if (used >= cap) {
      console.warn(`[quota] REJECTED ${op} — used=${used} cap=${cap} scope=user_daily`);
      throw new QuotaExceededError({
        scope: "user_daily",
        cap,
        count: used,
        identityKind: "user",
        identityId: identity.userId,
        message: `Daily submission limit reached (${cap}/day). Please try again tomorrow.`,
      });
    }
    return;
  }

  // anon
  const { count, error } = await supabaseAdmin
    .from("takes")
    .select("id", { count: "exact", head: true })
    .eq("anon_id", identity.anonId);

  if (error) {
    console.error(`[quota] ${op} failed to read anon usage`, error);
    throw new Error("Could not check usage");
  }

  const used = count ?? 0;
  if (used >= ANON_LIFETIME_CAP) {
    console.warn(
      `[quota] REJECTED ${op} — anon=${identity.anonId} used=${used} cap=${ANON_LIFETIME_CAP} scope=anon_lifetime`,
    );
    throw new QuotaExceededError({
      scope: "anon_lifetime",
      cap: ANON_LIFETIME_CAP,
      count: used,
      identityKind: "anon",
      identityId: identity.anonId,
      message: `Free trial limit reached (${ANON_LIFETIME_CAP} analyses). Sign up to keep going.`,
    });
  }
}

/**
 * Convert a QuotaExceededError into a 429 Response. Pass-through for
 * non-quota errors. Use inside server function / route handlers:
 *
 *   try { ... } catch (err) { throw quotaErrorToResponse(err); }
 */
export function quotaErrorToResponse(err: unknown): Response | unknown {
  if (err instanceof QuotaExceededError) {
    return new Response(
      JSON.stringify({
        error: err.message,
        code: err.code,
        scope: err.scope,
        cap: err.cap,
        promptSignup: err.identityKind === "anon",
      }),
      {
        status: 429,
        headers: { "content-type": "application/json" },
      },
    );
  }
  return err;
}

/**
 * Resolve the take's identity (user OR anon). Used by the webhook path
 * which has no caller context — the trust comes from the verified Mux
 * signature, and the take row tells us who owns the upload.
 */
export async function resolveTakeIdentity(takeId: string): Promise<QuotaIdentity | null> {
  const { data, error } = await supabaseAdmin
    .from("takes")
    .select("user_id, anon_id")
    .eq("id", takeId)
    .single();
  if (error || !data) return null;
  if (data.user_id) return { kind: "user", userId: data.user_id };
  if (data.anon_id) return { kind: "anon", anonId: data.anon_id };
  return null;
}
