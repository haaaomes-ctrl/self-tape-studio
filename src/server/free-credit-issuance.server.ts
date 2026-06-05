// SERVER-ONLY: lazy free-credit issuance (free_signup + free_monthly).
//
// Credits are the sole usage governor (ADR-0005). This module wires the free
// on-ramp: one free_signup credit per account, plus a monthly ALLOWANCE
// (free_monthly: at most one per rolling 31 days — not a balance top-up).
//
// Issuance is deliberately APP-SIDE because the CRM emails live in the TS
// wrapper: grantFundedCredits() renders and enqueues free_report_available /
// monthly_free_report (fire-and-forget, consent-gated). A SQL-level grant
// (trigger/cron/migration) cannot send those emails, and the lazy hooks fire
// at the only moments a credit can be spent (dashboard load, report attempt),
// so a DB-side path would add risk without adding capability.
//
// Concurrency: grant_funded_credits is idempotent on p_idempotency_key
// (partial UNIQUE index on credit_ledger_entries.idempotency_key collapses
// races — the loser sees a duplicate-key error, downgraded to info here).
// In-process per-user coalescing serializes the common dashboard+upload
// double-fire; a true pg_advisory_xact_lock is not usable across PostgREST
// calls without moving issuance into SQL (and losing the emails), so the
// idempotency keys remain the cross-instance guarantee. Residual accepted
// race: a month-boundary-midnight pair of calls with a >31-day-old prior
// grant could double-issue once — milliseconds wide, worst case one extra
// free credit.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getResolvedConfig } from "./app-config.server";
import {
  type CreditEntitlement,
  isUnlimitedAdminCreditEntitlement,
  resolveCreditEntitlementForUser,
} from "./credit-entitlement.server";
import { grantFundedCredits } from "./credit-ledger.server";

// Funded sources whose ACTIVE credits suppress the monthly allowance when
// app_config.free_monthly_includes_funded_users is false. Deliberately
// excludes free_signup, free_monthly and admin_grant (ADR-0005).
export const FUNDED_MONTHLY_SUPPRESSION_SOURCES = [
  "user_paid",
  "school_funded",
  "coach_funded",
  "agent_funded",
  "platform_funded",
  "sponsor_campaign",
] as const;

export const FREE_MONTHLY_ALLOWANCE_WINDOW_DAYS = 31;

export type FreeCreditReconcileResult = {
  ok: boolean;
  signup_granted: boolean;
  monthly_granted: boolean;
};

type GrantRow = {
  source: string;
  status: string;
  remaining_credits: number;
  expires_at: string | null;
  granted_at: string;
};

function isDuplicateKeyError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /duplicate key|23505|unique/i.test(message);
}

// Issue one grant through the email-bearing TS wrapper; idempotency-race
// losses are success (the winning call already issued the grant).
async function grantOnce(
  userId: string,
  source: "free_signup" | "free_monthly",
  idempotencyKey: string,
): Promise<boolean> {
  try {
    await grantFundedCredits({
      user_id: userId,
      source,
      credit_amount: 1,
      idempotency_key: idempotencyKey,
    });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      console.info("[free-credit] grant_idempotency_race_collapsed", {
        user_id: userId,
        source,
      });
      return false;
    }
    console.error("[free-credit] grant_failed_non_blocking", {
      user_id: userId,
      source,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function utcCalendarMonthKey(now: Date): string {
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

async function doReconcile(
  userId: string,
  opts?: { email?: string | null; entitlement?: CreditEntitlement },
): Promise<FreeCreditReconcileResult> {
  const none: FreeCreditReconcileResult = {
    ok: true,
    signup_granted: false,
    monthly_granted: false,
  };
  try {
    // Admin accounts are unconstrained (unlimited_admin) — never seeded with
    // free credits.
    const entitlement =
      opts?.entitlement ??
      (await resolveCreditEntitlementForUser({ userId, email: opts?.email ?? null }));
    if (isUnlimitedAdminCreditEntitlement(entitlement)) {
      return none;
    }

    const { data, error } = await supabaseAdmin
      .from("credit_grants")
      .select("source, status, remaining_credits, expires_at, granted_at")
      .eq("user_id", userId);
    if (error) {
      console.warn("[free-credit] grants_read_failed_non_blocking", {
        user_id: userId,
        error: error.message,
      });
      return { ...none, ok: false };
    }
    const grants = (data ?? []) as GrantRow[];
    const now = new Date();

    // free_signup: exactly one per account, ever (any status — a consumed
    // signup credit must not re-issue).
    let signupGranted = false;
    const hasSignupGrant = grants.some((g) => g.source === "free_signup");
    if (!hasSignupGrant) {
      signupGranted = await grantOnce(userId, "free_signup", `free_signup:${userId}`);
    }

    // free_monthly allowance: at most one per rolling 31 days. The rolling
    // read below is the authoritative gate; the calendar-month idempotency
    // key only collapses concurrent same-period calls on the unique index.
    let monthlyGranted = false;
    const windowStartMs = now.getTime() - FREE_MONTHLY_ALLOWANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const hasRecentMonthly = grants.some(
      (g) => g.source === "free_monthly" && new Date(g.granted_at).getTime() > windowStartMs,
    );
    if (!hasRecentMonthly) {
      const cfg = await getResolvedConfig();
      // status is not time-swept: an expired grant still reads
      // status='active', so the expires_at AND remaining checks are
      // load-bearing here.
      const fundedSources: ReadonlySet<string> = new Set(FUNDED_MONTHLY_SUPPRESSION_SOURCES);
      const hasActiveFundedCredit = grants.some(
        (g) =>
          fundedSources.has(g.source) &&
          g.status === "active" &&
          g.remaining_credits > 0 &&
          (g.expires_at === null || new Date(g.expires_at).getTime() > now.getTime()),
      );
      if (cfg.free_monthly_includes_funded_users || !hasActiveFundedCredit) {
        monthlyGranted = await grantOnce(
          userId,
          "free_monthly",
          `free_monthly:${userId}:${utcCalendarMonthKey(now)}`,
        );
      }
    }

    return { ok: true, signup_granted: signupGranted, monthly_granted: monthlyGranted };
  } catch (err) {
    // This helper must NEVER block its caller (dashboard load, report
    // reservation, cron batch).
    console.error("[free-credit] reconcile_failed_non_blocking", {
      user_id: userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, signup_granted: false, monthly_granted: false };
  }
}

// Per-user in-process coalescing: concurrent callers for the same user share
// one reconcile run (serialises the dashboard+upload double-fire and cuts
// idempotency-race noise within an instance).
const inFlight = new Map<string, Promise<FreeCreditReconcileResult>>();

/**
 * Idempotently ensure the user's free credits are issued. Safe to call from
 * any hot path: never throws, coalesces concurrent calls per user, and every
 * grant goes through grantFundedCredits (so CRM emails fire exactly once per
 * grant via their own idempotency keys).
 */
export async function reconcileFreeCreditsForUser(
  userId: string,
  opts?: { email?: string | null; entitlement?: CreditEntitlement },
): Promise<FreeCreditReconcileResult> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const run = doReconcile(userId, opts).finally(() => {
    inFlight.delete(userId);
  });
  inFlight.set(userId, run);
  return run;
}
