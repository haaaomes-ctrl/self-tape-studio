import type { AnalyticsAttributionMetadata } from "@/lib/analytics-attribution";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-policies";

export const B2B_INTEREST_VERSION = "s10-1-ds-20-2026-05-28" as const;

export const B2B_INTEREST_PARTNER_TYPES = ["school", "coach", "agent", "other"] as const;
export const B2B_INTEREST_COHORT_SIZES = [
  "1-10",
  "11-25",
  "26-60",
  "61-150",
  "150+",
  "unknown",
] as const;

export type B2BInterestPartnerType = (typeof B2B_INTEREST_PARTNER_TYPES)[number];
export type B2BInterestCohortSize = (typeof B2B_INTEREST_COHORT_SIZES)[number];

export type B2BInterestSubmissionInput = {
  partnerType?: unknown;
  organisation?: unknown;
  contactName?: unknown;
  contactRole?: unknown;
  email?: unknown;
  cohortSize?: unknown;
  message?: unknown;
  contactConsent?: unknown;
  website?: unknown;
  sourcePath?: unknown;
  analyticsConsentState?: unknown;
  analyticsAttribution?: Record<string, unknown> | null;
};

export type B2BInterestLeadDraft = {
  schema_version: typeof B2B_INTEREST_VERSION;
  partner_type: B2BInterestPartnerType;
  lead_type: B2BInterestPartnerType;
  organisation: string;
  contact_name: string;
  contact_role: string | null;
  email: string;
  cohort_size: B2BInterestCohortSize;
  message: string | null;
  contact_consent: true;
  source_path: string | null;
  analytics_consent_state: string;
  analytics_attribution: Partial<AnalyticsAttributionMetadata> | null;
  submitted_at: string;
};

export class B2BInterestValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("B2B interest submission is invalid");
    this.name = "B2BInterestValidationError";
  }
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalised = value
    .replace(/\0/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return normalised || null;
}

function email(value: unknown): string | null {
  const normalised = text(value, 160)?.toLowerCase() ?? null;
  if (!normalised || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) return null;
  return normalised;
}

function partnerType(value: unknown): B2BInterestPartnerType | null {
  const normalised = text(value, 40)?.toLowerCase();
  return B2B_INTEREST_PARTNER_TYPES.includes(normalised as B2BInterestPartnerType)
    ? (normalised as B2BInterestPartnerType)
    : null;
}

function cohortSize(value: unknown): B2BInterestCohortSize {
  const normalised = text(value, 40);
  return B2B_INTEREST_COHORT_SIZES.includes(normalised as B2BInterestCohortSize)
    ? (normalised as B2BInterestCohortSize)
    : "unknown";
}

function safeAnalyticsText(value: unknown, maxLength = 120): string | null {
  return (
    text(value, maxLength)
      ?.replace(/https?:\/\S+/gi, "")
      .trim() || null
  );
}

function sanitiseAttribution(
  value: Record<string, unknown> | null | undefined,
): Partial<AnalyticsAttributionMetadata> | null {
  if (!value || typeof value !== "object") return null;
  return {
    schema_version:
      value.schema_version === "tapecoach_analytics_attribution_v1"
        ? value.schema_version
        : "tapecoach_analytics_attribution_v1",
    attribution_available: value.attribution_available === true,
    consent_state:
      value.consent_state === "analytics_granted" ||
      value.consent_state === "analytics_denied" ||
      value.consent_state === "essential_only" ||
      value.consent_state === "unknown"
        ? value.consent_state
        : "unknown",
    attribution_key: safeAnalyticsText(value.attribution_key, 80),
    utm_source: safeAnalyticsText(value.utm_source, 80),
    utm_medium: safeAnalyticsText(value.utm_medium, 80),
    utm_campaign: safeAnalyticsText(value.utm_campaign, 120),
    utm_term: safeAnalyticsText(value.utm_term, 120),
    utm_content: safeAnalyticsText(value.utm_content, 120),
    creator_code: safeAnalyticsText(value.creator_code, 80),
    partner_code_hint: safeAnalyticsText(value.partner_code_hint, 80),
    landing_path: safeAnalyticsText(value.landing_path, 160),
    referrer_host: safeAnalyticsText(value.referrer_host, 120),
    first_seen_at: safeAnalyticsText(value.first_seen_at, 40),
    last_seen_at: safeAnalyticsText(value.last_seen_at, 40),
  };
}

export function buildB2BInterestLeadDraft(
  input: B2BInterestSubmissionInput,
  nowIso = new Date().toISOString(),
): B2BInterestLeadDraft | null {
  if (text(input.website, 120)) return null;

  const fieldErrors: Record<string, string> = {};
  const resolvedPartnerType = partnerType(input.partnerType);
  const resolvedOrganisation = text(input.organisation, 160);
  const resolvedContactName = text(input.contactName, 120);
  const resolvedEmail = email(input.email);
  const resolvedConsent = input.contactConsent === true;

  if (!resolvedPartnerType) fieldErrors.partnerType = "Choose a school, coach, agent or other.";
  if (!resolvedOrganisation) fieldErrors.organisation = "Add the organisation or studio name.";
  if (!resolvedContactName) fieldErrors.contactName = "Add a contact name.";
  if (!resolvedEmail) fieldErrors.email = "Add a valid email address.";
  if (!resolvedConsent) {
    fieldErrors.contactConsent = "Confirm TapeCoach can contact you about this enquiry.";
  }

  if (
    !resolvedPartnerType ||
    !resolvedOrganisation ||
    !resolvedContactName ||
    !resolvedEmail ||
    !resolvedConsent
  ) {
    throw new B2BInterestValidationError(fieldErrors);
  }

  const attribution = sanitiseAttribution(input.analyticsAttribution);
  const analyticsConsentState =
    text(input.analyticsConsentState, 40) ?? attribution?.consent_state ?? "unknown";

  return {
    schema_version: B2B_INTEREST_VERSION,
    partner_type: resolvedPartnerType,
    lead_type: resolvedPartnerType,
    organisation: resolvedOrganisation,
    contact_name: resolvedContactName,
    contact_role: text(input.contactRole, 120),
    email: resolvedEmail,
    cohort_size: cohortSize(input.cohortSize),
    message: text(input.message, 900),
    contact_consent: true,
    source_path: text(input.sourcePath, 160),
    analytics_consent_state: analyticsConsentState,
    analytics_attribution: attribution,
    submitted_at: nowIso,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildB2BInterestEmailDraft(draft: B2BInterestLeadDraft): {
  to: typeof LEGAL_CONTACT_EMAIL;
  subject: string;
  html: string;
  text: string;
} {
  const lines = [
    `Partner type: ${draft.partner_type}`,
    `Organisation: ${draft.organisation}`,
    `Contact: ${draft.contact_name}`,
    draft.contact_role ? `Role: ${draft.contact_role}` : null,
    `Email: ${draft.email}`,
    `Cohort size: ${draft.cohort_size}`,
    draft.source_path ? `Source path: ${draft.source_path}` : null,
    draft.analytics_attribution?.utm_source
      ? `UTM source: ${draft.analytics_attribution.utm_source}`
      : null,
    draft.analytics_attribution?.utm_campaign
      ? `UTM campaign: ${draft.analytics_attribution.utm_campaign}`
      : null,
    draft.message ? `Message: ${draft.message}` : null,
  ].filter((line): line is string => Boolean(line));

  return {
    to: LEGAL_CONTACT_EMAIL,
    subject: `TapeCoach B2B interest: ${draft.organisation}`,
    html: [
      "<p><strong>New TapeCoach B2B interest enquiry</strong></p>",
      "<ul>",
      ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
      "</ul>",
    ].join(""),
    text: ["New TapeCoach B2B interest enquiry", ...lines].join("\n"),
  };
}

export function buildB2BInterestAnalyticsProperties(
  draft: B2BInterestLeadDraft,
): Record<string, string | boolean | null> {
  return {
    schema_version: draft.schema_version,
    lead_type: draft.lead_type,
    partner_type: draft.partner_type,
    cohort_size: draft.cohort_size,
    source_path: draft.source_path,
    contact_consent: draft.contact_consent,
    has_message: Boolean(draft.message),
    has_utm_source: Boolean(draft.analytics_attribution?.utm_source),
    has_creator_code: Boolean(draft.analytics_attribution?.creator_code),
    has_partner_code_hint: Boolean(draft.analytics_attribution?.partner_code_hint),
  };
}
