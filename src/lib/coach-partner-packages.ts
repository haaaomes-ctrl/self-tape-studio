import {
  PARTNER_USAGE_ALERT_THRESHOLDS,
  type PartnerCodeInput,
  type PartnerCreditPoolInput,
  type PartnerUsageAlertThreshold,
  type PartnerVisibilityScope,
} from "@/lib/partner-program";

export const COACH_PARTNER_PACKAGE_DISPLAY_CONTEXT = "coach_pilot" as const;

export type CoachPartnerPackageSource = "config" | "default";
export type CoachPartnerPackageTier = "starter" | "studio";
export type CoachPartnerPackageCap = 6 | 10;

export type CoachPartnerPackagePreset = {
  sku: string;
  name: string;
  description: string;
  package_tier: CoachPartnerPackageTier;
  partner_type: "coach";
  display_context: typeof COACH_PARTNER_PACKAGE_DISPLAY_CONTEXT;
  billing_period: "monthly";
  currency: "GBP";
  unit_amount_pence: number;
  display_price: string;
  included_seats: number;
  credits_per_member: CoachPartnerPackageCap;
  total_credits: number;
  per_user_cap: CoachPartnerPackageCap;
  pool_period_type: "monthly";
  progress_visibility_scope: Extract<PartnerVisibilityScope, "named_progress">;
  active: boolean;
  display_order: number;
  source: CoachPartnerPackageSource;
};

export type CoachPartnerPackageCatalogue = {
  packages: CoachPartnerPackagePreset[];
  source: CoachPartnerPackageSource;
  visibility_notice: string;
  dashboard_fields: string[];
  usage_alerts: Record<PartnerUsageAlertThreshold, string>;
  sales_points: string[];
  invite_flow_checklist: string[];
  renewal_report_sections: string[];
};

export type CoachPartnerPackagePresetInput = {
  sku: string;
  name: string;
  description: string;
  package_tier: CoachPartnerPackageTier;
  unit_amount_pence: number;
  included_seats: number;
  credits_per_member: number;
  total_credits: number;
  per_user_cap: number;
  active?: boolean;
  display_order?: number;
};

export type CoachPartnerCodeTemplateInput = {
  preset: CoachPartnerPackagePreset;
  partner_id: string;
  partner_credit_pool_id: string;
  valid_from?: string | Date;
  expires_at?: string | Date | null;
  allowed_email_domains?: string[] | null;
  created_by_user_id?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export const COACH_PARTNER_VISIBILITY_NOTICE =
  "Coaches can see named progress data after a performer activates the coach code and accepts the visibility notice. Full reports, uploaded video and supplied brief stay private unless the performer explicitly shares them.";

export const COACH_PARTNER_DASHBOARD_FIELDS = [
  "performer name",
  "credits used",
  "latest score",
  "score trend",
  "readiness band",
  "fix-first category",
  "report dates",
  "visibility acceptance status",
  "full report sharing status",
] as const;

export const COACH_PARTNER_USAGE_ALERTS = {
  50: "Review performer usage and remaining monthly capacity before adding more invitees.",
  80: "Consider a top-up or Studio upgrade before the next coached recording cycle.",
  100: "Pause new report-start guidance until the coach pool is topped up or renewed.",
} as const satisfies Record<PartnerUsageAlertThreshold, string>;

export const COACH_PARTNER_SALES_POINTS = [
  "Fund TapeCoach reports for performers between coaching sessions.",
  "Use monthly caps to keep one performer from consuming the whole coach allowance.",
  "See permitted progress signals without seeing full reports, videos or briefs by default.",
  "Use readiness bands and fix-first categories to focus the next coaching session.",
] as const;

export const COACH_PARTNER_INVITE_FLOW_CHECKLIST = [
  "Create the coach partner record.",
  "Create the monthly coach credit pool from the selected package.",
  "Create a coach invite code linked to that pool.",
  "Share the code and visibility notice with invited performers.",
  "Ask performers to activate the code before uploading coach-funded tapes.",
  "Review usage at 50%, 80% and 100% pool thresholds.",
] as const;

export const COACH_PARTNER_RENEWAL_REPORT_SECTIONS = [
  "active performers",
  "credits used",
  "reports completed",
  "latest readiness bands",
  "common fix-first categories",
  "remaining pool credits",
  "upgrade or renewal recommendation",
] as const;

export const COACH_PARTNER_PACKAGES: CoachPartnerPackagePreset[] = [
  {
    sku: "coach-starter-monthly-gbp-29",
    name: "Coach Starter",
    description: "Monthly coach package with 40 TapeCoach credits and a 6-credit performer cap.",
    package_tier: "starter",
    partner_type: "coach",
    display_context: COACH_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "monthly",
    currency: "GBP",
    unit_amount_pence: 2900,
    display_price: "GBP 29.00",
    included_seats: 6,
    credits_per_member: 6,
    total_credits: 40,
    per_user_cap: 6,
    pool_period_type: "monthly",
    progress_visibility_scope: "named_progress",
    active: true,
    display_order: 10,
    source: "default",
  },
  {
    sku: "coach-studio-monthly-gbp-79",
    name: "Coach Studio",
    description: "Monthly coach package with 150 TapeCoach credits and a 10-credit performer cap.",
    package_tier: "studio",
    partner_type: "coach",
    display_context: COACH_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "monthly",
    currency: "GBP",
    unit_amount_pence: 7900,
    display_price: "GBP 79.00",
    included_seats: 15,
    credits_per_member: 10,
    total_credits: 150,
    per_user_cap: 10,
    pool_period_type: "monthly",
    progress_visibility_scope: "named_progress",
    active: true,
    display_order: 20,
    source: "default",
  },
];

type CoachPartnerPackageRecord = Record<string, unknown>;

const SKU_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/;

export function formatCoachPackagePrice(unitAmountPence: number): string {
  return `GBP ${(unitAmountPence / 100).toFixed(2)}`;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function readString(row: CoachPartnerPackageRecord, key: string, fallback: string): string {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readInteger(row: CoachPartnerPackageRecord, key: string, fallback: number): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(row: CoachPartnerPackageRecord, key: string, fallback: boolean): boolean {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}

function normaliseCoachTier(value: unknown, fallback: CoachPartnerPackageTier) {
  return value === "starter" || value === "studio" ? value : fallback;
}

function normaliseCoachCap(
  value: number,
  fallback: CoachPartnerPackageCap,
): CoachPartnerPackageCap {
  return value === 6 || value === 10 ? value : fallback;
}

export function sortCoachPartnerPackages(
  packages: CoachPartnerPackagePreset[],
): CoachPartnerPackagePreset[] {
  return [...packages].sort(
    (left, right) => left.display_order - right.display_order || left.sku.localeCompare(right.sku),
  );
}

export function normaliseCoachPartnerPackagePreset(
  row: CoachPartnerPackageRecord,
  source: CoachPartnerPackageSource,
): CoachPartnerPackagePreset {
  const fallback =
    COACH_PARTNER_PACKAGES.find((item) => item.sku === row.sku) ?? COACH_PARTNER_PACKAGES[0];
  const includedSeats = readInteger(row, "included_seats", fallback.included_seats);
  const perUserCap = normaliseCoachCap(
    readInteger(row, "per_user_cap", fallback.per_user_cap),
    fallback.per_user_cap,
  );
  const creditsPerMember = normaliseCoachCap(
    readInteger(row, "credits_per_member", perUserCap),
    perUserCap,
  );
  const totalCredits = readInteger(row, "total_credits", fallback.total_credits);
  const unitAmountPence = readInteger(row, "unit_amount_pence", fallback.unit_amount_pence);

  return {
    sku: readString(row, "sku", fallback.sku),
    name: readString(row, "name", fallback.name),
    description: readString(row, "description", fallback.description),
    package_tier: normaliseCoachTier(row.package_tier, fallback.package_tier),
    partner_type: "coach",
    display_context: COACH_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "monthly",
    currency: "GBP",
    unit_amount_pence: unitAmountPence,
    display_price: formatCoachPackagePrice(unitAmountPence),
    included_seats: includedSeats,
    credits_per_member: creditsPerMember,
    total_credits: totalCredits,
    per_user_cap: perUserCap,
    pool_period_type: "monthly",
    progress_visibility_scope: "named_progress",
    active: readBoolean(row, "active", fallback.active),
    display_order: readInteger(row, "display_order", fallback.display_order),
    source,
  };
}

export function buildCoachPartnerPackagePatch(input: CoachPartnerPackagePresetInput) {
  const sku = input.sku.trim();
  const name = input.name.trim();
  const description = input.description.trim();
  if (!SKU_PATTERN.test(sku)) {
    throw new Error("coach package sku must be lowercase kebab-case");
  }
  if (!name || !description) {
    throw new Error("coach packages require name and description");
  }

  const includedSeats = positiveInteger(input.included_seats, "included_seats");
  const creditsPerMember = positiveInteger(input.credits_per_member, "credits_per_member");
  const totalCredits = positiveInteger(input.total_credits, "total_credits");
  const perUserCap = positiveInteger(input.per_user_cap, "per_user_cap");

  if (perUserCap !== 6 && perUserCap !== 10) {
    throw new Error("coach packages must use a 6 or 10 credit performer monthly cap");
  }
  if (creditsPerMember !== perUserCap) {
    throw new Error("coach package code allowance must match the performer monthly cap");
  }
  if (totalCredits < includedSeats * creditsPerMember) {
    throw new Error(
      "coach package included performer capacity cannot exceed full-cap pool capacity",
    );
  }

  return {
    sku,
    name,
    description,
    package_tier: input.package_tier,
    partner_type: "coach" as const,
    display_context: COACH_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "monthly" as const,
    currency: "GBP" as const,
    unit_amount_pence: positiveInteger(input.unit_amount_pence, "unit_amount_pence"),
    included_seats: includedSeats,
    credits_per_member: creditsPerMember,
    total_credits: totalCredits,
    per_user_cap: perUserCap,
    pool_period_type: "monthly" as const,
    progress_visibility_scope: "named_progress" as const,
    active: input.active ?? true,
    display_order: input.display_order ?? 100,
  };
}

export function buildCoachPartnerPoolInput(input: {
  preset: CoachPartnerPackagePreset;
  partner_id: string;
  period_start: string | Date;
  period_end: string | Date;
  created_by_user_id?: string | null;
}): PartnerCreditPoolInput {
  return {
    partner_id: input.partner_id,
    partner_type: "coach",
    name: `${input.preset.name} pool`,
    period_type: "monthly",
    total_credits: input.preset.total_credits,
    per_user_cap: input.preset.per_user_cap,
    period_start: input.period_start,
    period_end: input.period_end,
    overage_allowed: false,
    currency: "GBP",
    metadata: { coach_package_sku: input.preset.sku },
    created_by_user_id: input.created_by_user_id ?? null,
  };
}

export function buildCoachPartnerCodeTemplate(
  input: CoachPartnerCodeTemplateInput,
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
      coach_package_sku: input.preset.sku,
      coach_package_tier: input.preset.package_tier,
      coach_visibility_notice_version: "coach-visibility-2026-05-27",
    },
    idempotency_key: input.idempotency_key ?? null,
  };
}

export function defaultCoachPartnerPackageCatalogue(): CoachPartnerPackageCatalogue {
  return {
    packages: sortCoachPartnerPackages(COACH_PARTNER_PACKAGES),
    source: "default",
    visibility_notice: COACH_PARTNER_VISIBILITY_NOTICE,
    dashboard_fields: [...COACH_PARTNER_DASHBOARD_FIELDS],
    usage_alerts: PARTNER_USAGE_ALERT_THRESHOLDS.reduce(
      (alerts, threshold) => ({ ...alerts, [threshold]: COACH_PARTNER_USAGE_ALERTS[threshold] }),
      {} as Record<PartnerUsageAlertThreshold, string>,
    ),
    sales_points: [...COACH_PARTNER_SALES_POINTS],
    invite_flow_checklist: [...COACH_PARTNER_INVITE_FLOW_CHECKLIST],
    renewal_report_sections: [...COACH_PARTNER_RENEWAL_REPORT_SECTIONS],
  };
}
