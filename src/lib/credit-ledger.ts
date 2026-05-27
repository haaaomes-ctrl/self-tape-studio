export const CREDIT_SOURCES = [
  "free_signup",
  "free_monthly",
  "school_funded",
  "coach_funded",
  "agent_funded",
  "platform_funded",
  "sponsor_campaign",
  "user_paid",
  "admin_grant",
] as const;

export const CREDIT_LEDGER_ENTRY_TYPES = [
  "grant",
  "consume",
  "admin_adjustment",
  "expiry_adjustment",
] as const;

export const CREDIT_ROLLOVER_POLICIES = ["rollover", "no_rollover", "funding_period"] as const;
export const CREDIT_GRANT_STATUSES = ["active", "exhausted", "expired", "revoked"] as const;

export const FREE_MONTHLY_CREDIT_VALIDITY_DAYS = 31;

export type CreditSource = (typeof CREDIT_SOURCES)[number];
export type CreditLedgerEntryType = (typeof CREDIT_LEDGER_ENTRY_TYPES)[number];
export type CreditRolloverPolicy = (typeof CREDIT_ROLLOVER_POLICIES)[number];
export type CreditGrantStatus = (typeof CREDIT_GRANT_STATUSES)[number];

export type CreditGrantInput = {
  user_id: string;
  source: CreditSource;
  credit_amount: number;
  granted_at?: string | Date;
  expires_at?: string | Date | null;
  source_reference_type?: string | null;
  source_reference_id?: string | null;
  source_label?: string | null;
  granted_by_user_id?: string | null;
  admin_reason?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type CreditGrantDraft = {
  user_id: string;
  source: CreditSource;
  original_credits: number;
  remaining_credits: number;
  rollover_policy: CreditRolloverPolicy;
  expires_at: string | null;
  source_reference_type: string | null;
  source_reference_id: string | null;
  source_label: string | null;
  granted_by_user_id: string | null;
  admin_reason: string | null;
  metadata: Record<string, unknown>;
  granted_at: string;
};

export type CreditGrantBalance = {
  id: string;
  source: CreditSource;
  remaining_credits: number;
  expires_at: string | null;
  granted_at: string;
  status: CreditGrantStatus;
};

export type CreditConsumptionAllocation = {
  credit_grant_id: string;
  source: CreditSource;
  credit_delta: number;
  expires_at: string | null;
};

export type CreditLedgerEntrySummary = {
  source: CreditSource;
  entry_type: CreditLedgerEntryType;
  credit_delta: number;
};

export type CreditSourceFinanceSummary = {
  source: CreditSource;
  granted_credits: number;
  consumed_credits: number;
  admin_adjustment_credits: number;
  expired_credits: number;
  net_credits: number;
  entry_count: number;
};

const CREDIT_SOURCE_SET = new Set<string>(CREDIT_SOURCES);

function toDate(value: string | Date | undefined, fallback: Date): Date {
  if (!value) return new Date(fallback.getTime());
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("credit date must be a valid ISO date");
  }
  return date;
}

function toIsoOrNull(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return toDate(value, new Date()).toISOString();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalisePositiveCreditAmount(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("credit_amount must be a positive integer");
  }
  return value;
}

function normaliseLedgerDelta(value: number): number {
  if (!Number.isInteger(value) || value === 0) {
    throw new Error("credit_delta must be a non-zero integer");
  }
  return value;
}

function normaliseMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {};
  if (Array.isArray(value)) {
    throw new Error("credit metadata must be an object");
  }
  return value;
}

export function isCreditSource(value: unknown): value is CreditSource {
  return typeof value === "string" && CREDIT_SOURCE_SET.has(value);
}

export function assertCreditSource(value: unknown): CreditSource {
  if (isCreditSource(value)) return value;
  throw new Error("unknown credit source");
}

export function resolveCreditGrantPolicy(
  source: CreditSource,
  grantedAt: string | Date = new Date(),
  requestedExpiresAt?: string | Date | null,
): Pick<CreditGrantDraft, "rollover_policy" | "expires_at" | "granted_at"> {
  const grantedAtDate = toDate(grantedAt, new Date());
  const grantedAtIso = grantedAtDate.toISOString();

  if (source === "free_monthly") {
    return {
      rollover_policy: "no_rollover",
      expires_at: addDays(grantedAtDate, FREE_MONTHLY_CREDIT_VALIDITY_DAYS).toISOString(),
      granted_at: grantedAtIso,
    };
  }

  if (source === "user_paid") {
    return {
      rollover_policy: "rollover",
      expires_at: null,
      granted_at: grantedAtIso,
    };
  }

  const expiresAt = toIsoOrNull(requestedExpiresAt);
  return {
    rollover_policy: expiresAt ? "funding_period" : "rollover",
    expires_at: expiresAt,
    granted_at: grantedAtIso,
  };
}

export function buildCreditGrantDraft(input: CreditGrantInput): CreditGrantDraft {
  const creditAmount = normalisePositiveCreditAmount(input.credit_amount);
  const source = assertCreditSource(input.source);
  const policy = resolveCreditGrantPolicy(source, input.granted_at, input.expires_at);

  return {
    user_id: input.user_id,
    source,
    original_credits: creditAmount,
    remaining_credits: creditAmount,
    rollover_policy: policy.rollover_policy,
    expires_at: policy.expires_at,
    source_reference_type: input.source_reference_type ?? null,
    source_reference_id: input.source_reference_id ?? null,
    source_label: input.source_label ?? null,
    granted_by_user_id: input.granted_by_user_id ?? null,
    admin_reason: input.admin_reason ?? null,
    metadata: normaliseMetadata(input.metadata),
    granted_at: policy.granted_at,
  };
}

function grantSortValue(grant: CreditGrantBalance): number {
  return grant.expires_at ? new Date(grant.expires_at).getTime() : Number.POSITIVE_INFINITY;
}

function isGrantUsable(grant: CreditGrantBalance, at: Date): boolean {
  if (grant.status !== "active") return false;
  if (grant.remaining_credits <= 0) return false;
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= at.getTime()) return false;
  return true;
}

export function allocateCreditsForConsumption(
  grants: CreditGrantBalance[],
  creditAmount: number,
  at: string | Date = new Date(),
): CreditConsumptionAllocation[] {
  const needed = normalisePositiveCreditAmount(creditAmount);
  const atDate = toDate(at, new Date());
  let remaining = needed;

  const usable = grants
    .filter((grant) => isGrantUsable(grant, atDate))
    .sort((left, right) => {
      const expiryDiff = grantSortValue(left) - grantSortValue(right);
      if (expiryDiff !== 0) return expiryDiff;
      return new Date(left.granted_at).getTime() - new Date(right.granted_at).getTime();
    });

  const allocations: CreditConsumptionAllocation[] = [];
  for (const grant of usable) {
    if (remaining === 0) break;
    const amount = Math.min(grant.remaining_credits, remaining);
    allocations.push({
      credit_grant_id: grant.id,
      source: grant.source,
      credit_delta: -amount,
      expires_at: grant.expires_at,
    });
    remaining -= amount;
  }

  if (remaining > 0) {
    throw new Error("insufficient funded credits");
  }

  return allocations;
}

export function buildAdminAdjustmentEntry(input: {
  user_id: string;
  source: CreditSource;
  credit_delta: number;
  credit_grant_id?: string | null;
  admin_actor_user_id?: string | null;
  admin_reason: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    user_id: input.user_id,
    source: assertCreditSource(input.source),
    entry_type: "admin_adjustment" as const,
    credit_delta: normaliseLedgerDelta(input.credit_delta),
    credit_grant_id: input.credit_grant_id ?? null,
    admin_actor_user_id: input.admin_actor_user_id ?? null,
    admin_reason: input.admin_reason.trim(),
    metadata: normaliseMetadata(input.metadata),
  };
}

export function summariseCreditEntriesBySource(
  entries: CreditLedgerEntrySummary[],
): CreditSourceFinanceSummary[] {
  const bySource = new Map<CreditSource, CreditSourceFinanceSummary>();

  for (const source of CREDIT_SOURCES) {
    bySource.set(source, {
      source,
      granted_credits: 0,
      consumed_credits: 0,
      admin_adjustment_credits: 0,
      expired_credits: 0,
      net_credits: 0,
      entry_count: 0,
    });
  }

  for (const entry of entries) {
    const source = assertCreditSource(entry.source);
    const summary = bySource.get(source);
    if (!summary) continue;

    summary.entry_count += 1;
    summary.net_credits += entry.credit_delta;

    if (entry.entry_type === "grant") {
      summary.granted_credits += Math.max(entry.credit_delta, 0);
    } else if (entry.entry_type === "consume") {
      summary.consumed_credits += Math.abs(Math.min(entry.credit_delta, 0));
    } else if (entry.entry_type === "admin_adjustment") {
      summary.admin_adjustment_credits += entry.credit_delta;
    } else if (entry.entry_type === "expiry_adjustment") {
      summary.expired_credits += Math.abs(Math.min(entry.credit_delta, 0));
    }
  }

  return [...bySource.values()].filter(
    (summary) =>
      summary.entry_count > 0 ||
      summary.granted_credits > 0 ||
      summary.consumed_credits > 0 ||
      summary.admin_adjustment_credits !== 0 ||
      summary.expired_credits > 0,
  );
}
