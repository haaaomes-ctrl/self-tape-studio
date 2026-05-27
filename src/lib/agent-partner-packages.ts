import {
  PARTNER_USAGE_ALERT_THRESHOLDS,
  type PartnerCodeInput,
  type PartnerCreditPoolInput,
  type PartnerUsageAlertThreshold,
  type PartnerVisibilityScope,
} from "@/lib/partner-program";

export const AGENT_PARTNER_PACKAGE_DISPLAY_CONTEXT = "agent_trial" as const;

export type AgentPartnerPackageSource = "config" | "default";
export type AgentPartnerPackageTier = "trial" | "growth";
export type AgentPartnerPackageCap = 3 | 6;

export type AgentPartnerPackagePreset = {
  sku: string;
  name: string;
  description: string;
  package_tier: AgentPartnerPackageTier;
  partner_type: "agent";
  display_context: typeof AGENT_PARTNER_PACKAGE_DISPLAY_CONTEXT;
  billing_period: "monthly";
  currency: "GBP";
  unit_amount_pence: number;
  display_price: string;
  included_seats: number;
  credits_per_member: AgentPartnerPackageCap;
  total_credits: number;
  per_user_cap: AgentPartnerPackageCap;
  pool_period_type: "monthly";
  progress_visibility_scope: Extract<PartnerVisibilityScope, "limited_usage_readiness">;
  active: boolean;
  display_order: number;
  source: AgentPartnerPackageSource;
};

export type AgentPartnerPackageCatalogue = {
  packages: AgentPartnerPackagePreset[];
  source: AgentPartnerPackageSource;
  visibility_notice: string;
  dashboard_fields: string[];
  report_share_tracking_fields: string[];
  usage_alerts: Record<PartnerUsageAlertThreshold, string>;
  sales_points: string[];
  invite_flow_checklist: string[];
  renewal_report_sections: string[];
};

export type AgentPartnerPackagePresetInput = {
  sku: string;
  name: string;
  description: string;
  package_tier: AgentPartnerPackageTier;
  unit_amount_pence: number;
  included_seats: number;
  credits_per_member: number;
  total_credits: number;
  per_user_cap: number;
  active?: boolean;
  display_order?: number;
};

export type AgentPartnerCodeTemplateInput = {
  preset: AgentPartnerPackagePreset;
  partner_id: string;
  partner_credit_pool_id: string;
  valid_from?: string | Date;
  expires_at?: string | Date | null;
  allowed_email_domains?: string[] | null;
  created_by_user_id?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export const AGENT_PARTNER_VISIBILITY_NOTICE =
  "Agents can see limited usage and readiness data after a performer activates the agent code and accepts the visibility notice. Full reports require explicit performer sharing; uploaded video and supplied brief stay private by default.";

export const AGENT_PARTNER_DASHBOARD_FIELDS = [
  "credits used",
  "latest readiness band",
  "latest report date",
  "visibility acceptance status",
  "full report share status",
  "shared reports count",
  "renewal interest signal",
] as const;

export const AGENT_PARTNER_REPORT_SHARE_TRACKING_FIELDS = [
  "performer_share_required",
  "full_report_shared_at",
  "full_report_share_revoked_at",
  "shared_report_count",
  "share_source",
] as const;

export const AGENT_PARTNER_USAGE_ALERTS = {
  50: "Review managed-performer usage before inviting more performers into the trial.",
  80: "Start the renewal or growth-package conversation before the monthly pool is exhausted.",
  100: "Pause new agent-funded report guidance until the pool is topped up or renewed.",
} as const satisfies Record<PartnerUsageAlertThreshold, string>;

export const AGENT_PARTNER_SALES_POINTS = [
  "Trial limited TapeCoach usage with a controlled monthly cap.",
  "Reduce repetitive self-tape feedback workload without seeing private reports by default.",
  "Use readiness bands to spot who may need a follow-up conversation.",
  "Ask performers to share full reports only when that is useful and explicit.",
] as const;

export const AGENT_PARTNER_INVITE_FLOW_CHECKLIST = [
  "Create the agent partner record.",
  "Create the monthly agent credit pool from the selected package.",
  "Create an agent invite code linked to that pool.",
  "Share the code and restricted visibility notice with managed performers.",
  "Ask performers to activate the code before uploading agent-funded tapes.",
  "Track report-share status separately from default limited visibility.",
  "Review usage at 50%, 80% and 100% pool thresholds.",
] as const;

export const AGENT_PARTNER_RENEWAL_REPORT_SECTIONS = [
  "active managed performers",
  "credits used",
  "reports completed",
  "latest readiness band mix",
  "reports explicitly shared with agent",
  "renewal interest signals",
  "remaining pool credits",
] as const;

export const AGENT_PARTNER_PACKAGES: AgentPartnerPackagePreset[] = [
  {
    sku: "agent-trial-monthly-gbp-49",
    name: "Agent Trial",
    description: "Monthly agent trial with 75 TapeCoach credits and a 3-credit performer cap.",
    package_tier: "trial",
    partner_type: "agent",
    display_context: AGENT_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "monthly",
    currency: "GBP",
    unit_amount_pence: 4900,
    display_price: "GBP 49.00",
    included_seats: 25,
    credits_per_member: 3,
    total_credits: 75,
    per_user_cap: 3,
    pool_period_type: "monthly",
    progress_visibility_scope: "limited_usage_readiness",
    active: true,
    display_order: 10,
    source: "default",
  },
  {
    sku: "agent-growth-monthly-gbp-99",
    name: "Agent Growth",
    description:
      "Monthly agent growth package with 175 TapeCoach credits and a 6-credit performer cap.",
    package_tier: "growth",
    partner_type: "agent",
    display_context: AGENT_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "monthly",
    currency: "GBP",
    unit_amount_pence: 9900,
    display_price: "GBP 99.00",
    included_seats: 29,
    credits_per_member: 6,
    total_credits: 175,
    per_user_cap: 6,
    pool_period_type: "monthly",
    progress_visibility_scope: "limited_usage_readiness",
    active: true,
    display_order: 20,
    source: "default",
  },
];

type AgentPartnerPackageRecord = Record<string, unknown>;

const SKU_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/;

export function formatAgentPackagePrice(unitAmountPence: number): string {
  return `GBP ${(unitAmountPence / 100).toFixed(2)}`;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function readString(row: AgentPartnerPackageRecord, key: string, fallback: string): string {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readInteger(row: AgentPartnerPackageRecord, key: string, fallback: number): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(row: AgentPartnerPackageRecord, key: string, fallback: boolean): boolean {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}

function normaliseAgentTier(value: unknown, fallback: AgentPartnerPackageTier) {
  return value === "trial" || value === "growth" ? value : fallback;
}

function normaliseAgentCap(
  value: number,
  fallback: AgentPartnerPackageCap,
): AgentPartnerPackageCap {
  return value === 3 || value === 6 ? value : fallback;
}

export function sortAgentPartnerPackages(
  packages: AgentPartnerPackagePreset[],
): AgentPartnerPackagePreset[] {
  return [...packages].sort(
    (left, right) => left.display_order - right.display_order || left.sku.localeCompare(right.sku),
  );
}

export function normaliseAgentPartnerPackagePreset(
  row: AgentPartnerPackageRecord,
  source: AgentPartnerPackageSource,
): AgentPartnerPackagePreset {
  const fallback =
    AGENT_PARTNER_PACKAGES.find((item) => item.sku === row.sku) ?? AGENT_PARTNER_PACKAGES[0];
  const includedSeats = readInteger(row, "included_seats", fallback.included_seats);
  const perUserCap = normaliseAgentCap(
    readInteger(row, "per_user_cap", fallback.per_user_cap),
    fallback.per_user_cap,
  );
  const creditsPerMember = normaliseAgentCap(
    readInteger(row, "credits_per_member", perUserCap),
    perUserCap,
  );
  const totalCredits = readInteger(row, "total_credits", fallback.total_credits);
  const unitAmountPence = readInteger(row, "unit_amount_pence", fallback.unit_amount_pence);

  return {
    sku: readString(row, "sku", fallback.sku),
    name: readString(row, "name", fallback.name),
    description: readString(row, "description", fallback.description),
    package_tier: normaliseAgentTier(row.package_tier, fallback.package_tier),
    partner_type: "agent",
    display_context: AGENT_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "monthly",
    currency: "GBP",
    unit_amount_pence: unitAmountPence,
    display_price: formatAgentPackagePrice(unitAmountPence),
    included_seats: includedSeats,
    credits_per_member: creditsPerMember,
    total_credits: totalCredits,
    per_user_cap: perUserCap,
    pool_period_type: "monthly",
    progress_visibility_scope: "limited_usage_readiness",
    active: readBoolean(row, "active", fallback.active),
    display_order: readInteger(row, "display_order", fallback.display_order),
    source,
  };
}

export function buildAgentPartnerPackagePatch(input: AgentPartnerPackagePresetInput) {
  const sku = input.sku.trim();
  const name = input.name.trim();
  const description = input.description.trim();
  if (!SKU_PATTERN.test(sku)) {
    throw new Error("agent package sku must be lowercase kebab-case");
  }
  if (!name || !description) {
    throw new Error("agent packages require name and description");
  }
  if (input.package_tier !== "trial" && input.package_tier !== "growth") {
    throw new Error("agent package tier must be trial or growth");
  }

  const includedSeats = positiveInteger(input.included_seats, "included_seats");
  const creditsPerMember = positiveInteger(input.credits_per_member, "credits_per_member");
  const totalCredits = positiveInteger(input.total_credits, "total_credits");
  const perUserCap = positiveInteger(input.per_user_cap, "per_user_cap");

  if (perUserCap !== 3 && perUserCap !== 6) {
    throw new Error("agent packages must use a 3 or 6 credit performer monthly cap");
  }
  if (creditsPerMember !== perUserCap) {
    throw new Error("agent package code allowance must match the performer monthly cap");
  }
  if (totalCredits < includedSeats * creditsPerMember) {
    throw new Error(
      "agent package included performer capacity cannot exceed full-cap pool capacity",
    );
  }

  return {
    sku,
    name,
    description,
    package_tier: input.package_tier,
    partner_type: "agent" as const,
    display_context: AGENT_PARTNER_PACKAGE_DISPLAY_CONTEXT,
    billing_period: "monthly" as const,
    currency: "GBP" as const,
    unit_amount_pence: positiveInteger(input.unit_amount_pence, "unit_amount_pence"),
    included_seats: includedSeats,
    credits_per_member: creditsPerMember,
    total_credits: totalCredits,
    per_user_cap: perUserCap,
    pool_period_type: "monthly" as const,
    progress_visibility_scope: "limited_usage_readiness" as const,
    active: input.active ?? true,
    display_order: input.display_order ?? 100,
  };
}

export function buildAgentPartnerPoolInput(input: {
  preset: AgentPartnerPackagePreset;
  partner_id: string;
  period_start: string | Date;
  period_end: string | Date;
  created_by_user_id?: string | null;
}): PartnerCreditPoolInput {
  return {
    partner_id: input.partner_id,
    partner_type: "agent",
    name: `${input.preset.name} pool`,
    period_type: "monthly",
    total_credits: input.preset.total_credits,
    per_user_cap: input.preset.per_user_cap,
    period_start: input.period_start,
    period_end: input.period_end,
    overage_allowed: false,
    currency: "GBP",
    metadata: { agent_package_sku: input.preset.sku },
    created_by_user_id: input.created_by_user_id ?? null,
  };
}

export function buildAgentPartnerCodeTemplate(
  input: AgentPartnerCodeTemplateInput,
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
      agent_package_sku: input.preset.sku,
      agent_package_tier: input.preset.package_tier,
      agent_visibility_notice_version: "agent-visibility-2026-05-27",
      performer_share_required_for_full_report: true,
    },
    idempotency_key: input.idempotency_key ?? null,
  };
}

export function defaultAgentPartnerPackageCatalogue(): AgentPartnerPackageCatalogue {
  return {
    packages: sortAgentPartnerPackages(AGENT_PARTNER_PACKAGES),
    source: "default",
    visibility_notice: AGENT_PARTNER_VISIBILITY_NOTICE,
    dashboard_fields: [...AGENT_PARTNER_DASHBOARD_FIELDS],
    report_share_tracking_fields: [...AGENT_PARTNER_REPORT_SHARE_TRACKING_FIELDS],
    usage_alerts: PARTNER_USAGE_ALERT_THRESHOLDS.reduce(
      (alerts, threshold) => ({ ...alerts, [threshold]: AGENT_PARTNER_USAGE_ALERTS[threshold] }),
      {} as Record<PartnerUsageAlertThreshold, string>,
    ),
    sales_points: [...AGENT_PARTNER_SALES_POINTS],
    invite_flow_checklist: [...AGENT_PARTNER_INVITE_FLOW_CHECKLIST],
    renewal_report_sections: [...AGENT_PARTNER_RENEWAL_REPORT_SECTIONS],
  };
}
