import type { CreditSource, CreditGrantInput } from "@/lib/credit-ledger";

export const PARTNER_TYPES = ["school", "coach", "agent", "sponsor", "platform"] as const;
export const PARTNER_STATUSES = ["active", "paused", "archived"] as const;
export const PARTNER_CODE_STATUSES = ["active", "paused", "revoked", "rotated", "expired"] as const;
export const PARTNER_MEMBERSHIP_STATUSES = ["active", "revoked", "expired"] as const;

export type PartnerType = (typeof PARTNER_TYPES)[number];
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export type PartnerCodeStatus = (typeof PARTNER_CODE_STATUSES)[number];
export type PartnerMembershipStatus = (typeof PARTNER_MEMBERSHIP_STATUSES)[number];

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

const PARTNER_TYPE_SET = new Set<string>(PARTNER_TYPES);
const PARTNER_STATUS_SET = new Set<string>(PARTNER_STATUSES);
const PARTNER_CODE_STATUS_SET = new Set<string>(PARTNER_CODE_STATUSES);
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
