import type { CreditSource } from "@/lib/credit-ledger";
import {
  REPORT_CREDIT_REPLACEMENT_COPY,
  REPORT_CREDIT_RESTORED_MESSAGE,
} from "@/lib/credit-ledger";

export const REPORT_CREDIT_UNIT_COPY = "1 TapeCoach credit = 1 self-tape report.";
export const FAILED_REPORT_CREDIT_RESTORED_COPY = REPORT_CREDIT_RESTORED_MESSAGE;
export const REPLACEMENT_REPORT_CREDIT_COPY = REPORT_CREDIT_REPLACEMENT_COPY;

export const FREE_CREDIT_SOURCES = ["free_signup", "free_monthly"] as const;
export const PARTNER_FUNDED_CREDIT_SOURCES = [
  "school_funded",
  "coach_funded",
  "agent_funded",
  "platform_funded",
  "sponsor_campaign",
] as const;
export const PAID_CREDIT_SOURCES = ["user_paid"] as const;

export type CreditBalanceGrantInput = {
  id: string;
  source: CreditSource;
  original_credits: number;
  remaining_credits: number;
  expires_at: string | null;
  source_label: string | null;
  status: "active" | "exhausted" | "expired" | "revoked";
  granted_at: string;
  created_at?: string | null;
};

export type CreditBalancePartnerMembershipInput = {
  id: string;
  partner_name: string | null;
  partner_type: "school" | "coach" | "agent" | "sponsor" | "platform";
  credit_source: CreditSource;
  allowance_credits: number;
  remaining_credits: number;
  expires_at: string | null;
  status: "active" | "revoked" | "expired";
  activated_at: string;
};

export type FreeMonthlyCreditStatus =
  | "available"
  | "used_this_period"
  | "expired_or_unavailable"
  | "not_recorded";

export type CreditBalanceSourceSummary = {
  source: CreditSource;
  label: string;
  remaining_credits: number;
  expires_at: string | null;
  status: CreditBalanceGrantInput["status"];
};

export type PartnerAllowanceSummary = {
  id: string;
  partner_name: string;
  partner_type: CreditBalancePartnerMembershipInput["partner_type"];
  allowance_credits: number;
  remaining_credits: number;
  expires_at: string | null;
  status: CreditBalancePartnerMembershipInput["status"];
};

export type CreditBalanceSnapshot = {
  total_available_credits: number;
  free_credit_balance: number;
  free_monthly: {
    status: FreeMonthlyCreditStatus;
    available_credits: number;
    next_refresh_at: string | null;
    status_label: string;
  };
  partner_funded_balance: number;
  partner_allowances: PartnerAllowanceSummary[];
  paid_credit_balance: number;
  source_breakdown: CreditBalanceSourceSummary[];
  copy: {
    unit: typeof REPORT_CREDIT_UNIT_COPY;
    replacement: typeof REPLACEMENT_REPORT_CREDIT_COPY;
    failed_report_restored: typeof FAILED_REPORT_CREDIT_RESTORED_COPY;
  };
};

const FREE_SOURCE_SET = new Set<CreditSource>(FREE_CREDIT_SOURCES);
const PARTNER_SOURCE_SET = new Set<CreditSource>(PARTNER_FUNDED_CREDIT_SOURCES);
const PAID_SOURCE_SET = new Set<CreditSource>(PAID_CREDIT_SOURCES);

export function creditSourceLabel(source: CreditSource): string {
  switch (source) {
    case "free_signup":
      return "Free signup credit";
    case "free_monthly":
      return "Free monthly credit";
    case "school_funded":
      return "School-funded allowance";
    case "coach_funded":
      return "Coach-funded allowance";
    case "agent_funded":
      return "Agent-funded allowance";
    case "platform_funded":
      return "Platform-funded allowance";
    case "sponsor_campaign":
      return "Sponsor-funded allowance";
    case "user_paid":
      return "Paid top-up credits";
    case "admin_grant":
      return "Admin-granted credits";
  }
}

function dateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function grantSortMs(grant: CreditBalanceGrantInput): number {
  return dateMs(grant.granted_at) ?? dateMs(grant.created_at) ?? 0;
}

function isCurrentGrant(grant: CreditBalanceGrantInput, nowMs: number): boolean {
  const expiryMs = dateMs(grant.expires_at);
  return (
    grant.status === "active" &&
    grant.remaining_credits > 0 &&
    (expiryMs === null || expiryMs > nowMs)
  );
}

function sumCurrentCredits(
  grants: CreditBalanceGrantInput[],
  sources: ReadonlySet<CreditSource>,
  nowMs: number,
): number {
  return grants
    .filter((grant) => sources.has(grant.source) && isCurrentGrant(grant, nowMs))
    .reduce((total, grant) => total + grant.remaining_credits, 0);
}

function freeMonthlyStatus(
  grants: CreditBalanceGrantInput[],
  nowMs: number,
): CreditBalanceSnapshot["free_monthly"] {
  const monthly = grants
    .filter((grant) => grant.source === "free_monthly")
    .sort((left, right) => grantSortMs(right) - grantSortMs(left));
  const availableCredits = sumCurrentCredits(
    monthly,
    new Set<CreditSource>(["free_monthly"]),
    nowMs,
  );
  const latest = monthly[0] ?? null;
  const nextRefreshAt = latest?.expires_at ?? null;
  const latestExpiresInFuture = (dateMs(nextRefreshAt) ?? 0) > nowMs;

  if (availableCredits > 0) {
    return {
      status: "available",
      available_credits: availableCredits,
      next_refresh_at: nextRefreshAt,
      status_label: "Free monthly report available",
    };
  }
  if (latest && latestExpiresInFuture) {
    return {
      status: "used_this_period",
      available_credits: 0,
      next_refresh_at: nextRefreshAt,
      status_label: "Free monthly report used for this period",
    };
  }
  if (latest) {
    return {
      status: "expired_or_unavailable",
      available_credits: 0,
      next_refresh_at: nextRefreshAt,
      status_label: "No free monthly report available right now",
    };
  }
  return {
    status: "not_recorded",
    available_credits: 0,
    next_refresh_at: null,
    status_label: "No free monthly credit is currently recorded",
  };
}

export function deriveCreditBalanceSnapshot(input: {
  grants: CreditBalanceGrantInput[];
  partner_memberships?: CreditBalancePartnerMembershipInput[];
  now?: string | Date;
}): CreditBalanceSnapshot {
  const nowMs =
    input.now instanceof Date
      ? input.now.getTime()
      : input.now
        ? new Date(input.now).getTime()
        : Date.now();
  const effectiveNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const currentGrants = input.grants.filter((grant) => isCurrentGrant(grant, effectiveNowMs));

  const sourceBreakdown = currentGrants.map((grant) => ({
    source: grant.source,
    label: grant.source_label?.trim() || creditSourceLabel(grant.source),
    remaining_credits: grant.remaining_credits,
    expires_at: grant.expires_at,
    status: grant.status,
  }));

  const partnerAllowances = (input.partner_memberships ?? [])
    .filter((membership) => membership.status === "active")
    .map((membership) => ({
      id: membership.id,
      partner_name: membership.partner_name?.trim() || creditSourceLabel(membership.credit_source),
      partner_type: membership.partner_type,
      allowance_credits: membership.allowance_credits,
      remaining_credits: Math.max(0, membership.remaining_credits),
      expires_at: membership.expires_at,
      status: membership.status,
    }))
    .sort((left, right) => left.partner_name.localeCompare(right.partner_name));

  return {
    total_available_credits: currentGrants.reduce(
      (total, grant) => total + grant.remaining_credits,
      0,
    ),
    free_credit_balance: sumCurrentCredits(input.grants, FREE_SOURCE_SET, effectiveNowMs),
    free_monthly: freeMonthlyStatus(input.grants, effectiveNowMs),
    partner_funded_balance: sumCurrentCredits(input.grants, PARTNER_SOURCE_SET, effectiveNowMs),
    partner_allowances: partnerAllowances,
    paid_credit_balance: sumCurrentCredits(input.grants, PAID_SOURCE_SET, effectiveNowMs),
    source_breakdown: sourceBreakdown,
    copy: {
      unit: REPORT_CREDIT_UNIT_COPY,
      replacement: REPLACEMENT_REPORT_CREDIT_COPY,
      failed_report_restored: FAILED_REPORT_CREDIT_RESTORED_COPY,
    },
  };
}
