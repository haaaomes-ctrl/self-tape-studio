import type {
  PartnerCodeInput,
  PartnerCreditPoolInput,
  PartnerVisibilityScope,
} from "@/lib/partner-program";

export const SCHOOL_PARTNER_PACKAGE_DISPLAY_CONTEXT = "school_mt_college_pilot" as const;

export type SchoolPartnerPackageSource = "config" | "default";
export type SchoolPartnerPackageTier = "pilot" | "growth";

export type SchoolPartnerPackagePreset = {
  sku: string;
  name: string;
  description: string;
  package_tier: SchoolPartnerPackageTier;
  partner_type: "school";
  display_context: typeof SCHOOL_PARTNER_PACKAGE_DISPLAY_CONTEXT;
  billing_period: "term";
  currency: "GBP";
  unit_amount_pence: number;
  display_price: string;
  included_seats: number;
  credits_per_member: number;
  total_credits: number;
  per_user_cap: 12;
  pool_period_type: "term";
  progress_visibility_scope: Extract<PartnerVisibilityScope, "named_progress">;
  active: boolean;
  display_order: number;
  source: SchoolPartnerPackageSource;
};

export type SchoolPartnerPackageCatalogue = {
  packages: SchoolPartnerPackagePreset[];
  source: SchoolPartnerPackageSource;
  visibility_notice: string;
  sales_points: string[];
  onboarding_checklist: string[];
  renewal_report_sections: string[];
};

export type SchoolPartnerPackagePresetInput = {
  sku: string;
  name: string;
  description: string;
  package_tier: SchoolPartnerPackageTier;
  unit_amount_pence: number;
  included_seats: number;
  credits_per_member: number;
  total_credits: number;
  active?: boolean;
  display_order?: number;
};

export type SchoolPartnerCodeTemplateInput = {
  preset: SchoolPartnerPackagePreset;
  partner_id: string;
  partner_credit_pool_id: string;
  valid_from?: string | Date;
  expires_at?: string | Date | null;
  allowed_email_domains?: string[] | null;
  created_by_user_id?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export const SCHOOL_PARTNER_VISIBILITY_NOTICE =
  "Schools and MT colleges can see named progress data after a student activates the school code and accepts the visibility notice. Full reports, uploaded video and supplied brief stay private unless a later explicit share control enables them.";

export const SCHOOL_PARTNER_SALES_POINTS = [
  "Give a cohort capped TapeCoach report access for one term.",
  "Use 12 credits per student as the default term allowance.",
  "Track usage, readiness bands and fix-first trends without exposing videos or briefs by default.",
  "Keep full performer reports private unless a future explicit share control is enabled.",
] as const;

export const SCHOOL_PARTNER_ONBOARDING_CHECKLIST = [
  "Create the school partner record.",
  "Create the term credit pool from the selected school package.",
  "Create one school code linked to that pool.",
  "Send the code and visibility notice to the course lead.",
  "Ask students to activate the code before uploading their first tape.",
  "Review usage at 50%, 80% and 100% pool thresholds.",
] as const;

export const SCHOOL_PARTNER_RENEWAL_REPORT_SECTIONS = [
  "active students",
  "credits used",
  "reports completed",
  "latest readiness bands",
  "common fix-first categories",
  "remaining pool credits",
] as const;

export const SCHOOL_PARTNER_PACKAGES: SchoolPartnerPackagePreset[] = [
  {
    sku: "school-pilot-term-gbp-500",
    name: "School Pilot",
    description: "Term pilot for up to 25 students, with 12 TapeCoach credits per student.",
    package_tier: "pilot",
    partner_type: "school",
    display_context: SCHOOL_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "term",
    currency: "GBP",
    unit_amount_pence: 50000,
    display_price: "GBP 500.00",
    included_seats: 25,
    credits_per_member: 12,
    total_credits: 300,
    per_user_cap: 12,
    pool_period_type: "term",
    progress_visibility_scope: "named_progress",
    active: true,
    display_order: 10,
    source: "default",
  },
  {
    sku: "school-growth-term-gbp-1000",
    name: "School Growth",
    description:
      "Term growth package for up to 60 students, with 12 TapeCoach credits per student.",
    package_tier: "growth",
    partner_type: "school",
    display_context: SCHOOL_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "term",
    currency: "GBP",
    unit_amount_pence: 100000,
    display_price: "GBP 1000.00",
    included_seats: 60,
    credits_per_member: 12,
    total_credits: 720,
    per_user_cap: 12,
    pool_period_type: "term",
    progress_visibility_scope: "named_progress",
    active: true,
    display_order: 20,
    source: "default",
  },
];

type SchoolPartnerPackageRecord = Record<string, unknown>;

const SKU_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/;

export function formatSchoolPackagePrice(unitAmountPence: number): string {
  return `GBP ${(unitAmountPence / 100).toFixed(2)}`;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function readString(row: SchoolPartnerPackageRecord, key: string, fallback: string): string {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readInteger(row: SchoolPartnerPackageRecord, key: string, fallback: number): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(row: SchoolPartnerPackageRecord, key: string, fallback: boolean): boolean {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}

function normaliseSchoolTier(value: unknown, fallback: SchoolPartnerPackageTier) {
  return value === "pilot" || value === "growth" ? value : fallback;
}

export function sortSchoolPartnerPackages(
  packages: SchoolPartnerPackagePreset[],
): SchoolPartnerPackagePreset[] {
  return [...packages].sort(
    (left, right) => left.display_order - right.display_order || left.sku.localeCompare(right.sku),
  );
}

export function normaliseSchoolPartnerPackagePreset(
  row: SchoolPartnerPackageRecord,
  source: SchoolPartnerPackageSource,
): SchoolPartnerPackagePreset {
  const fallback =
    SCHOOL_PARTNER_PACKAGES.find((item) => item.sku === row.sku) ?? SCHOOL_PARTNER_PACKAGES[0];
  const includedSeats = readInteger(row, "included_seats", fallback.included_seats);
  const creditsPerMember = readInteger(row, "credits_per_member", fallback.credits_per_member);
  const totalCredits = readInteger(row, "total_credits", includedSeats * creditsPerMember);
  const unitAmountPence = readInteger(row, "unit_amount_pence", fallback.unit_amount_pence);

  return {
    sku: readString(row, "sku", fallback.sku),
    name: readString(row, "name", fallback.name),
    description: readString(row, "description", fallback.description),
    package_tier: normaliseSchoolTier(row.package_tier, fallback.package_tier),
    partner_type: "school",
    display_context: SCHOOL_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "term",
    currency: "GBP",
    unit_amount_pence: unitAmountPence,
    display_price: formatSchoolPackagePrice(unitAmountPence),
    included_seats: includedSeats,
    credits_per_member: creditsPerMember,
    total_credits: totalCredits,
    per_user_cap: 12,
    pool_period_type: "term",
    progress_visibility_scope: "named_progress",
    active: readBoolean(row, "active", fallback.active),
    display_order: readInteger(row, "display_order", fallback.display_order),
    source,
  };
}

export function buildSchoolPartnerPackagePatch(input: SchoolPartnerPackagePresetInput) {
  const sku = input.sku.trim();
  const name = input.name.trim();
  const description = input.description.trim();
  if (!SKU_PATTERN.test(sku)) {
    throw new Error("school package sku must be lowercase kebab-case");
  }
  if (!name || !description) {
    throw new Error("school packages require name and description");
  }

  const includedSeats = positiveInteger(input.included_seats, "included_seats");
  const creditsPerMember = positiveInteger(input.credits_per_member, "credits_per_member");
  const totalCredits = positiveInteger(input.total_credits, "total_credits");
  if (creditsPerMember !== 12) {
    throw new Error("school packages must keep 12 credits per student");
  }
  if (totalCredits !== includedSeats * creditsPerMember) {
    throw new Error("school package total credits must equal seats times credits per student");
  }

  return {
    sku,
    name,
    description,
    package_tier: input.package_tier,
    partner_type: "school" as const,
    display_context: SCHOOL_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "term" as const,
    currency: "GBP" as const,
    unit_amount_pence: positiveInteger(input.unit_amount_pence, "unit_amount_pence"),
    included_seats: includedSeats,
    credits_per_member: creditsPerMember,
    total_credits: totalCredits,
    per_user_cap: 12,
    pool_period_type: "term" as const,
    progress_visibility_scope: "named_progress" as const,
    active: input.active ?? true,
    display_order: input.display_order ?? 100,
  };
}

export function buildSchoolPartnerPoolInput(input: {
  preset: SchoolPartnerPackagePreset;
  partner_id: string;
  period_start: string | Date;
  period_end: string | Date;
  created_by_user_id?: string | null;
}): PartnerCreditPoolInput {
  return {
    partner_id: input.partner_id,
    partner_type: "school",
    name: `${input.preset.name} pool`,
    period_type: "term",
    total_credits: input.preset.total_credits,
    per_user_cap: input.preset.per_user_cap,
    period_start: input.period_start,
    period_end: input.period_end,
    overage_allowed: false,
    currency: "GBP",
    metadata: { school_package_sku: input.preset.sku },
    created_by_user_id: input.created_by_user_id ?? null,
  };
}

export function buildSchoolPartnerCodeTemplate(
  input: SchoolPartnerCodeTemplateInput,
): Omit<PartnerCodeInput, "code_hash" | "code_display_hint"> {
  return {
    partner_id: input.partner_id,
    partner_credit_pool_id: input.partner_credit_pool_id,
    allowance_credits: input.preset.credits_per_member,
    max_activations: input.preset.included_seats,
    valid_from: input.valid_from,
    expires_at: input.expires_at,
    allowed_email_domains: input.allowed_email_domains,
    created_by_user_id: input.created_by_user_id ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      school_package_sku: input.preset.sku,
      school_package_tier: input.preset.package_tier,
      school_visibility_notice_version: "school-visibility-2026-05-27",
    },
    idempotency_key: input.idempotency_key ?? null,
  };
}

export function defaultSchoolPartnerPackageCatalogue(): SchoolPartnerPackageCatalogue {
  return {
    packages: sortSchoolPartnerPackages(SCHOOL_PARTNER_PACKAGES),
    source: "default",
    visibility_notice: SCHOOL_PARTNER_VISIBILITY_NOTICE,
    sales_points: [...SCHOOL_PARTNER_SALES_POINTS],
    onboarding_checklist: [...SCHOOL_PARTNER_ONBOARDING_CHECKLIST],
    renewal_report_sections: [...SCHOOL_PARTNER_RENEWAL_REPORT_SECTIONS],
  };
}
