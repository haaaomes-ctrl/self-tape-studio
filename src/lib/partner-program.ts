import type { CreditSource, CreditGrantInput } from "@/lib/credit-ledger";

export const PARTNER_TYPES = ["school", "coach", "agent", "sponsor", "platform"] as const;
export const PARTNER_STATUSES = ["active", "paused", "archived"] as const;
export const PARTNER_CODE_STATUSES = ["active", "paused", "revoked", "rotated", "expired"] as const;
export const PARTNER_MEMBERSHIP_STATUSES = ["active", "revoked", "expired"] as const;
export const PARTNER_CREDIT_POOL_PERIOD_TYPES = [
  "monthly",
  "term",
  "annual",
  "fixed_campaign",
] as const;
export const PARTNER_CREDIT_POOL_STATUSES = [
  "active",
  "paused",
  "exhausted",
  "expired",
  "archived",
] as const;
export const PARTNER_USAGE_ALERT_THRESHOLDS = [50, 80, 100] as const;
export const PARTNER_ALLOWANCE_EXHAUSTED_MESSAGE =
  "Your partner-funded TapeCoach allowance is exhausted. Ask your school, coach or agent for more credits, or use another available credit balance.";

export type PartnerType = (typeof PARTNER_TYPES)[number];
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export type PartnerCodeStatus = (typeof PARTNER_CODE_STATUSES)[number];
export type PartnerMembershipStatus = (typeof PARTNER_MEMBERSHIP_STATUSES)[number];
export type PartnerCreditPoolPeriodType = (typeof PARTNER_CREDIT_POOL_PERIOD_TYPES)[number];
export type PartnerCreditPoolStatus = (typeof PARTNER_CREDIT_POOL_STATUSES)[number];
export type PartnerUsageAlertThreshold = (typeof PARTNER_USAGE_ALERT_THRESHOLDS)[number];

export const PARTNER_TYPE_CREDIT_SOURCE: Record<PartnerType, CreditSource> = {
  school: "school_funded",
  coach: "coach_funded",
  agent: "agent_funded",
  sponsor: "sponsor_campaign",
  platform: "platform_funded",
};

export const PARTNER_CODE_MIN_LENGTH = 6;
export const PARTNER_CODE_MAX_LENGTH = 64;

export type PartnerInput = {
  type: PartnerType;
  name: string;
  slug?: string | null;
  status?: PartnerStatus;
  primary_contact_email?: string | null;
  allowed_email_domains?: string[] | null;
  metadata?: Record<string, unknown>;
  created_by_user_id?: string | null;
};

export type PartnerDraft = {
  type: PartnerType;
  name: string;
  slug: string;
  status: PartnerStatus;
  primary_contact_email: string | null;
  allowed_email_domains: string[];
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
};

export type PartnerCodeInput = {
  partner_id: string;
  partner_credit_pool_id?: string | null;
  code_hash: string;
  code_display_hint: string;
  version?: number;
  status?: PartnerCodeStatus;
  allowance_credits: number;
  valid_from?: string | Date;
  expires_at?: string | Date | null;
  max_activations?: number | null;
  allowed_email_domains?: string[] | null;
  created_by_user_id?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type PartnerCodeDraft = {
  partner_id: string;
  partner_credit_pool_id: string | null;
  code_hash: string;
  code_display_hint: string;
  version: number;
  status: PartnerCodeStatus;
  allowance_credits: number;
  valid_from: string;
  expires_at: string | null;
  max_activations: number | null;
  allowed_email_domains: string[];
  created_by_user_id: string | null;
  metadata: Record<string, unknown>;
  idempotency_key: string | null;
};

export type PartnerCreditPoolCapPolicy = {
  period_type: PartnerCreditPoolPeriodType;
  default_per_user_cap: number;
  minimum_per_user_cap: number;
  maximum_per_user_cap: number | null;
};

export type PartnerCreditPoolInput = {
  partner_id: string;
  partner_type: PartnerType;
  name: string;
  period_type?: PartnerCreditPoolPeriodType;
  status?: PartnerCreditPoolStatus;
  total_credits: number;
  allocated_credits?: number;
  consumed_credits?: number;
  per_user_cap?: number;
  period_start: string | Date;
  period_end: string | Date;
  overage_allowed?: boolean;
  overage_price_pence?: number | null;
  currency?: "GBP";
  metadata?: Record<string, unknown>;
  created_by_user_id?: string | null;
};

export type PartnerCreditPoolDraft = {
  partner_id: string;
  name: string;
  period_type: PartnerCreditPoolPeriodType;
  status: PartnerCreditPoolStatus;
  total_credits: number;
  allocated_credits: number;
  consumed_credits: number;
  per_user_cap: number;
  period_start: string;
  period_end: string;
  overage_allowed: boolean;
  overage_price_pence: number | null;
  currency: "GBP";
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
};

export type PartnerPoolAllocationCheckInput = {
  total_credits: number;
  allocated_credits: number;
  per_user_cap: number;
  user_allocated_credits: number;
  credit_amount: number;
  overage_allowed?: boolean;
  cap_override?: boolean;
};

export type PartnerPoolUsageSummary = {
  allocated_credits: number;
  total_credits: number;
  remaining_credits: number;
  usage_percent: number;
  crossed_alert_thresholds: PartnerUsageAlertThreshold[];
};

const PARTNER_TYPE_SET = new Set<string>(PARTNER_TYPES);
const PARTNER_STATUS_SET = new Set<string>(PARTNER_STATUSES);
const PARTNER_CODE_STATUS_SET = new Set<string>(PARTNER_CODE_STATUSES);
const PARTNER_CREDIT_POOL_PERIOD_TYPE_SET = new Set<string>(PARTNER_CREDIT_POOL_PERIOD_TYPES);
const PARTNER_CREDIT_POOL_STATUS_SET = new Set<string>(PARTNER_CREDIT_POOL_STATUSES);
const CODE_HASH_PATTERN = /^[a-f0-9]{64}$/;
const EMAIL_DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function metadataObject(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {};
  if (Array.isArray(value)) {
    throw new Error("partner metadata must be an object");
  }
  return value;
}

function isoDate(value: string | Date | undefined, fallback: Date): string {
  const date = value instanceof Date ? value : value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) {
    throw new Error("partner date must be a valid ISO date");
  }
  return date.toISOString();
}

function isoDateOrNull(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return isoDate(value, new Date());
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

export function isPartnerType(value: unknown): value is PartnerType {
  return typeof value === "string" && PARTNER_TYPE_SET.has(value);
}

export function assertPartnerType(value: unknown): PartnerType {
  if (isPartnerType(value)) return value;
  throw new Error("unknown partner type");
}

export function isPartnerStatus(value: unknown): value is PartnerStatus {
  return typeof value === "string" && PARTNER_STATUS_SET.has(value);
}

export function assertPartnerStatus(value: unknown): PartnerStatus {
  if (isPartnerStatus(value)) return value;
  throw new Error("unknown partner status");
}

export function isPartnerCodeStatus(value: unknown): value is PartnerCodeStatus {
  return typeof value === "string" && PARTNER_CODE_STATUS_SET.has(value);
}

export function assertPartnerCodeStatus(value: unknown): PartnerCodeStatus {
  if (isPartnerCodeStatus(value)) return value;
  throw new Error("unknown partner code status");
}

export function isPartnerCreditPoolPeriodType(
  value: unknown,
): value is PartnerCreditPoolPeriodType {
  return typeof value === "string" && PARTNER_CREDIT_POOL_PERIOD_TYPE_SET.has(value);
}

export function assertPartnerCreditPoolPeriodType(value: unknown): PartnerCreditPoolPeriodType {
  if (isPartnerCreditPoolPeriodType(value)) return value;
  throw new Error("unknown partner credit pool period type");
}

export function isPartnerCreditPoolStatus(value: unknown): value is PartnerCreditPoolStatus {
  return typeof value === "string" && PARTNER_CREDIT_POOL_STATUS_SET.has(value);
}

export function assertPartnerCreditPoolStatus(value: unknown): PartnerCreditPoolStatus {
  if (isPartnerCreditPoolStatus(value)) return value;
  throw new Error("unknown partner credit pool status");
}

export function creditSourceForPartnerType(type: PartnerType): CreditSource {
  return PARTNER_TYPE_CREDIT_SOURCE[assertPartnerType(type)];
}

export function normalisePartnerCode(rawCode: unknown): string {
  if (typeof rawCode !== "string") {
    throw new Error("partner code must be a string");
  }

  const normalised = rawCode.replace(/[\s-]+/g, "").toUpperCase();
  if (
    normalised.length < PARTNER_CODE_MIN_LENGTH ||
    normalised.length > PARTNER_CODE_MAX_LENGTH ||
    !/^[A-Z0-9]+$/.test(normalised)
  ) {
    throw new Error("partner code must be 6-64 letters or numbers");
  }

  return normalised;
}

export function partnerCodeDisplayHint(rawCode: unknown): string {
  const code = normalisePartnerCode(rawCode);
  if (code.length <= 8) return `${code.slice(0, 2)}...${code.slice(-2)}`;
  return `${code.slice(0, 4)}...${code.slice(-4)}`;
}

export function assertPartnerCodeHash(value: unknown): string {
  if (typeof value === "string" && CODE_HASH_PATTERN.test(value)) return value;
  throw new Error("partner code hash must be a lowercase sha256 hex digest");
}

export function normaliseEmailDomain(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("email domain must be a string");
  }

  const domain = value.trim().replace(/^@/, "").toLowerCase();
  if (!EMAIL_DOMAIN_PATTERN.test(domain)) {
    throw new Error("email domain must be a valid domain");
  }
  return domain;
}

export function normaliseAllowedEmailDomains(value: string[] | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const domains: string[] = [];

  for (const item of value) {
    const domain = normaliseEmailDomain(item);
    if (!seen.has(domain)) {
      seen.add(domain);
      domains.push(domain);
    }
  }

  return domains;
}

export function buildPartnerSlug(name: string, type: PartnerType): string {
  const base = `${assertPartnerType(type)}-${name}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (base.length < 3) {
    throw new Error("partner slug must have at least 3 characters");
  }

  return base.slice(0, 80);
}

export function buildPartnerDraft(input: PartnerInput): PartnerDraft {
  const type = assertPartnerType(input.type);
  const name = input.name.trim();
  if (!name) throw new Error("partner name is required");
  const primaryContactEmail = input.primary_contact_email?.trim().toLowerCase() || null;
  if (primaryContactEmail && !EMAIL_PATTERN.test(primaryContactEmail)) {
    throw new Error("primary_contact_email must be a valid email");
  }

  const slug = input.slug?.trim() || buildPartnerSlug(name, type);
  if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(slug)) {
    throw new Error("partner slug must be lowercase kebab-case");
  }

  return {
    type,
    name,
    slug,
    status: input.status ? assertPartnerStatus(input.status) : "active",
    primary_contact_email: primaryContactEmail,
    allowed_email_domains: normaliseAllowedEmailDomains(input.allowed_email_domains),
    metadata: metadataObject(input.metadata),
    created_by_user_id: input.created_by_user_id ?? null,
  };
}

export function buildPartnerCodeDraft(input: PartnerCodeInput): PartnerCodeDraft {
  const version = input.version ?? 1;
  const maxActivations = input.max_activations ?? null;
  const codeDisplayHint = input.code_display_hint.trim();

  if (!Number.isInteger(version) || version <= 0) {
    throw new Error("partner code version must be a positive integer");
  }
  if (maxActivations !== null) {
    positiveInteger(maxActivations, "max_activations");
  }
  if (!codeDisplayHint) {
    throw new Error("code_display_hint is required");
  }

  return {
    partner_id: input.partner_id,
    partner_credit_pool_id: input.partner_credit_pool_id ?? null,
    code_hash: assertPartnerCodeHash(input.code_hash),
    code_display_hint: codeDisplayHint,
    version,
    status: input.status ? assertPartnerCodeStatus(input.status) : "active",
    allowance_credits: positiveInteger(input.allowance_credits, "allowance_credits"),
    valid_from: isoDate(input.valid_from, new Date()),
    expires_at: isoDateOrNull(input.expires_at),
    max_activations: maxActivations,
    allowed_email_domains: normaliseAllowedEmailDomains(input.allowed_email_domains),
    created_by_user_id: input.created_by_user_id ?? null,
    metadata: metadataObject(input.metadata),
    idempotency_key: input.idempotency_key ?? null,
  };
}

export const PARTNER_CREDIT_POOL_CAP_POLICIES: Record<PartnerType, PartnerCreditPoolCapPolicy> = {
  school: {
    period_type: "term",
    default_per_user_cap: 12,
    minimum_per_user_cap: 12,
    maximum_per_user_cap: 12,
  },
  coach: {
    period_type: "monthly",
    default_per_user_cap: 6,
    minimum_per_user_cap: 6,
    maximum_per_user_cap: 12,
  },
  agent: {
    period_type: "monthly",
    default_per_user_cap: 3,
    minimum_per_user_cap: 3,
    maximum_per_user_cap: 6,
  },
  sponsor: {
    period_type: "fixed_campaign",
    default_per_user_cap: 1,
    minimum_per_user_cap: 1,
    maximum_per_user_cap: null,
  },
  platform: {
    period_type: "monthly",
    default_per_user_cap: 1,
    minimum_per_user_cap: 1,
    maximum_per_user_cap: null,
  },
};

export function defaultPartnerCreditPoolPolicy(type: PartnerType): PartnerCreditPoolCapPolicy {
  return PARTNER_CREDIT_POOL_CAP_POLICIES[assertPartnerType(type)];
}

export function assertPerUserCapForPartnerType(type: PartnerType, cap: number): number {
  const policy = defaultPartnerCreditPoolPolicy(type);
  const value = positiveInteger(cap, "per_user_cap");
  if (value < policy.minimum_per_user_cap) {
    throw new Error("per_user_cap is below the partner default range");
  }
  if (policy.maximum_per_user_cap !== null && value > policy.maximum_per_user_cap) {
    throw new Error("per_user_cap is above the partner default range");
  }
  return value;
}

export function buildPartnerCreditPoolDraft(input: PartnerCreditPoolInput): PartnerCreditPoolDraft {
  const partnerType = assertPartnerType(input.partner_type);
  const policy = defaultPartnerCreditPoolPolicy(partnerType);
  const name = input.name.trim();
  const periodStart = isoDate(input.period_start, new Date());
  const periodEnd = isoDate(input.period_end, new Date());
  const periodStartMs = new Date(periodStart).getTime();
  const periodEndMs = new Date(periodEnd).getTime();
  const overageAllowed = input.overage_allowed ?? false;
  const overagePricePence = input.overage_price_pence ?? null;
  const totalCredits = positiveInteger(input.total_credits, "total_credits");
  const allocatedCredits = nonNegativeInteger(input.allocated_credits ?? 0, "allocated_credits");
  const consumedCredits = nonNegativeInteger(input.consumed_credits ?? 0, "consumed_credits");

  if (!name) {
    throw new Error("partner credit pool name is required");
  }
  if (periodEndMs <= periodStartMs) {
    throw new Error("partner credit pool period_end must be after period_start");
  }
  if (consumedCredits > allocatedCredits) {
    throw new Error("consumed_credits cannot exceed allocated_credits");
  }
  if (!overageAllowed && allocatedCredits > totalCredits) {
    throw new Error("allocated_credits cannot exceed total_credits without overage");
  }
  if (overagePricePence !== null) {
    nonNegativeInteger(overagePricePence, "overage_price_pence");
  }
  if (!overageAllowed && overagePricePence !== null) {
    throw new Error("overage_price_pence requires overage_allowed");
  }
  if (input.currency !== undefined && input.currency !== "GBP") {
    throw new Error("partner credit pool currency must be GBP");
  }

  return {
    partner_id: input.partner_id,
    name,
    period_type: input.period_type
      ? assertPartnerCreditPoolPeriodType(input.period_type)
      : policy.period_type,
    status: input.status ? assertPartnerCreditPoolStatus(input.status) : "active",
    total_credits: totalCredits,
    allocated_credits: allocatedCredits,
    consumed_credits: consumedCredits,
    per_user_cap: assertPerUserCapForPartnerType(
      partnerType,
      input.per_user_cap ?? policy.default_per_user_cap,
    ),
    period_start: periodStart,
    period_end: periodEnd,
    overage_allowed: overageAllowed,
    overage_price_pence: overagePricePence,
    currency: input.currency ?? "GBP",
    metadata: metadataObject(input.metadata),
    created_by_user_id: input.created_by_user_id ?? null,
  };
}

export function alertThresholdsCrossed(
  previousAllocatedCredits: number,
  nextAllocatedCredits: number,
  totalCredits: number,
): PartnerUsageAlertThreshold[] {
  const total = positiveInteger(totalCredits, "total_credits");
  const previous = nonNegativeInteger(previousAllocatedCredits, "previous_allocated_credits");
  const next = nonNegativeInteger(nextAllocatedCredits, "next_allocated_credits");

  return PARTNER_USAGE_ALERT_THRESHOLDS.filter(
    (threshold) => previous * 100 < total * threshold && next * 100 >= total * threshold,
  );
}

export function assertPartnerPoolCanAllocate(input: PartnerPoolAllocationCheckInput): void {
  const totalCredits = positiveInteger(input.total_credits, "total_credits");
  const allocatedCredits = nonNegativeInteger(input.allocated_credits, "allocated_credits");
  const perUserCap = positiveInteger(input.per_user_cap, "per_user_cap");
  const userAllocatedCredits = nonNegativeInteger(
    input.user_allocated_credits,
    "user_allocated_credits",
  );
  const creditAmount = positiveInteger(input.credit_amount, "credit_amount");

  if (!input.cap_override && userAllocatedCredits + creditAmount > perUserCap) {
    throw new Error("partner per-user cap exceeded");
  }
  if (!input.overage_allowed && allocatedCredits + creditAmount > totalCredits) {
    throw new Error("partner credit pool exhausted");
  }
}

export function summarisePartnerPoolUsage(input: {
  total_credits: number;
  allocated_credits: number;
  next_credit_amount?: number;
}): PartnerPoolUsageSummary {
  const totalCredits = positiveInteger(input.total_credits, "total_credits");
  const allocatedCredits = nonNegativeInteger(input.allocated_credits, "allocated_credits");
  const nextCreditAmount = nonNegativeInteger(input.next_credit_amount ?? 0, "next_credit_amount");
  const nextAllocatedCredits = allocatedCredits + nextCreditAmount;

  return {
    allocated_credits: nextAllocatedCredits,
    total_credits: totalCredits,
    remaining_credits: Math.max(totalCredits - nextAllocatedCredits, 0),
    usage_percent: Number(((nextAllocatedCredits / totalCredits) * 100).toFixed(2)),
    crossed_alert_thresholds: alertThresholdsCrossed(
      allocatedCredits,
      nextAllocatedCredits,
      totalCredits,
    ),
  };
}

export function buildPartnerMembershipCreditGrantInput(input: {
  user_id: string;
  partner_type: PartnerType;
  partner_name: string;
  partner_membership_id: string;
  code_version: number;
  allowance_credits: number;
  activated_at?: string | Date;
  expires_at?: string | Date | null;
  metadata?: Record<string, unknown>;
}): CreditGrantInput {
  return {
    user_id: input.user_id,
    source: creditSourceForPartnerType(input.partner_type),
    credit_amount: positiveInteger(input.allowance_credits, "allowance_credits"),
    granted_at: input.activated_at,
    expires_at: input.expires_at,
    source_reference_type: "partner_membership",
    source_reference_id: input.partner_membership_id,
    source_label: `${input.partner_name.trim()} code v${positiveInteger(
      input.code_version,
      "code_version",
    )}`,
    metadata: metadataObject(input.metadata),
    idempotency_key: `partner-membership-credit:${input.partner_membership_id}`,
  };
}
