export const CRM_MESSAGE_CATEGORIES = ["service", "lifecycle", "marketing"] as const;

export type CrmMessageCategory = (typeof CRM_MESSAGE_CATEGORIES)[number];

export const CRM_MESSAGE_KEYS = [
  "verify_email",
  "welcome",
  "free_report_available",
  "monthly_free_report",
  "no_report_started",
  "report_started",
  "report_ready",
  "failed_report_credit_restored",
  "credits_added",
  "b2b_follow_up",
] as const;

export type CrmMessageKey = (typeof CRM_MESSAGE_KEYS)[number];

export type CrmUserSegment =
  | "performer"
  | "parent_guardian"
  | "b2b_lead"
  | "partner_admin"
  | "unknown";

export type CrmRecipientRole = "performer" | "parent_guardian" | "partner_admin" | "unknown";

export type CrmAccountContext = {
  account_route?: string | null;
  account_type?: string | null;
  parent_managed?: boolean | null;
};

export type CrmMessageDefinition = {
  key: CrmMessageKey;
  category: CrmMessageCategory;
  subject: string;
  previewText: string;
  label: string;
};

export type CrmMessageDraft = {
  message_key: CrmMessageKey;
  message_category: CrmMessageCategory;
  subject: string;
  preview_text: string;
  html: string;
  text: string;
  label: string;
  purpose: "transactional" | "marketing";
  template_data: Record<string, unknown>;
};

const UNSAFE_TEMPLATE_KEYS = new Set([
  "authorization",
  "brief",
  "cookie",
  "full_brief",
  "playback_url",
  "prompt",
  "raw_prompt",
  "raw_report",
  "raw_response",
  "report",
  "response_text",
  "secret",
  "session",
  "signed_url",
  "system_prompt",
  "token",
  "user_prompt",
  "video_url",
]);

export const CRM_MESSAGE_DEFINITIONS: Record<CrmMessageKey, CrmMessageDefinition> = {
  verify_email: {
    key: "verify_email",
    category: "service",
    subject: "Confirm your TapeCoach email",
    previewText: "Confirm your email address to keep your TapeCoach account secure.",
    label: "verify_email",
  },
  welcome: {
    key: "welcome",
    category: "lifecycle",
    subject: "Welcome to TapeCoach",
    previewText: "Your TapeCoach account is ready when you want to start a self-tape report.",
    label: "welcome",
  },
  free_report_available: {
    key: "free_report_available",
    category: "service",
    subject: "Your free TapeCoach report is available",
    previewText: "A free TapeCoach report credit is available on your account.",
    label: "free_report_available",
  },
  monthly_free_report: {
    key: "monthly_free_report",
    category: "lifecycle",
    subject: "Your monthly TapeCoach report credit is available",
    previewText: "Your monthly free TapeCoach report credit is ready to use.",
    label: "monthly_free_report",
  },
  no_report_started: {
    key: "no_report_started",
    category: "lifecycle",
    subject: "Start your first TapeCoach report",
    previewText: "Your account is ready if you want to upload a self-tape for feedback.",
    label: "no_report_started",
  },
  report_started: {
    key: "report_started",
    category: "service",
    subject: "TapeCoach is preparing your report",
    previewText: "Your self-tape report has started processing.",
    label: "report_started",
  },
  report_ready: {
    key: "report_ready",
    category: "service",
    subject: "Your TapeCoach report is ready",
    previewText: "Your self-tape report is ready to review.",
    label: "report_ready",
  },
  failed_report_credit_restored: {
    key: "failed_report_credit_restored",
    category: "service",
    subject: "Your TapeCoach credit has been restored",
    previewText: "Your credit was returned because the report did not complete.",
    label: "failed_report_credit_restored",
  },
  credits_added: {
    key: "credits_added",
    category: "service",
    subject: "TapeCoach credits added",
    previewText: "New TapeCoach report credits have been added to your account.",
    label: "credits_added",
  },
  b2b_follow_up: {
    key: "b2b_follow_up",
    category: "marketing",
    subject: "TapeCoach partnership follow-up",
    previewText: "A short follow-up for your TapeCoach school, coach or agency interest.",
    label: "b2b_follow_up",
  },
};

export function isCrmMessageKey(value: unknown): value is CrmMessageKey {
  return typeof value === "string" && CRM_MESSAGE_KEYS.includes(value as CrmMessageKey);
}

export function crmCategoryRequiresMarketingConsent(category: CrmMessageCategory): boolean {
  return category === "lifecycle" || category === "marketing";
}

export function normaliseCrmEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalised = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) return null;
  return normalised;
}

export function resolveCrmRecipientRole(context: CrmAccountContext): CrmRecipientRole {
  if (
    context.parent_managed === true ||
    context.account_route === "under_13" ||
    context.account_route === "parent_guardian" ||
    context.account_type === "parent_guardian_managed"
  ) {
    return "parent_guardian";
  }
  if (context.account_type === "self_service_performer") return "performer";
  return "unknown";
}

export function resolveCrmUserSegment(context: CrmAccountContext): CrmUserSegment {
  const role = resolveCrmRecipientRole(context);
  if (role === "parent_guardian") return "parent_guardian";
  if (role === "performer") return "performer";
  if (role === "partner_admin") return "partner_admin";
  return "unknown";
}

function isSafeScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function sanitiseCrmTemplateData(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();
    if (UNSAFE_TEMPLATE_KEYS.has(lowerKey)) continue;
    if (isSafeScalar(value)) {
      safe[key] = typeof value === "string" ? value.slice(0, 500) : value;
    } else if (Array.isArray(value)) {
      safe[key] = value.filter(isSafeScalar).slice(0, 20);
    } else if (value && typeof value === "object") {
      safe[key] = sanitiseCrmTemplateData(value);
    }
  }
  return safe;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeDataText(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 180) : null;
}

export function buildCrmMessageDraft(input: {
  messageKey: CrmMessageKey;
  templateData?: Record<string, unknown>;
}): CrmMessageDraft {
  const definition = CRM_MESSAGE_DEFINITIONS[input.messageKey];
  const templateData = sanitiseCrmTemplateData(input.templateData ?? {});
  const accountLabel = safeDataText(templateData, "account_label");
  const actionLabel = safeDataText(templateData, "action_label");
  const contextLine = safeDataText(templateData, "context_line") ?? definition.previewText;
  const supportLine = "Need help? Email support@tapecoach.co.uk.";
  const heading = accountLabel ? `${definition.subject}: ${accountLabel}` : definition.subject;

  const html = [
    `<p><strong>${escapeHtml(heading)}</strong></p>`,
    `<p>${escapeHtml(contextLine)}</p>`,
    actionLabel ? `<p>${escapeHtml(actionLabel)}</p>` : null,
    `<p>${escapeHtml(supportLine)}</p>`,
  ]
    .filter((part): part is string => Boolean(part))
    .join("");

  const text = [heading, contextLine, actionLabel, supportLine]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

  return {
    message_key: definition.key,
    message_category: definition.category,
    subject: heading,
    preview_text: definition.previewText,
    html,
    text,
    label: definition.label,
    purpose: definition.category === "service" ? "transactional" : "marketing",
    template_data: templateData,
  };
}
