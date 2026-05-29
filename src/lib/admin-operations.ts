export const ADMIN_OPERATIONS_VERSION = "s10-1-ds-21-2026-05-29" as const;

export const ADMIN_OPERATIONS_SECTIONS = [
  "user_credits",
  "credit_history",
  "partner_memberships",
  "partner_pools",
  "report_status",
  "failure_reason",
  "payment_events",
  "consent_records",
  "cost_estimates",
  "audit_log",
] as const;

export type AdminOperationsSection = (typeof ADMIN_OPERATIONS_SECTIONS)[number];

export type AdminOperationsCoverage = Record<AdminOperationsSection, boolean>;

export type AdminCreditGrantFormInput = {
  user_id: string;
  credit_amount: number;
  admin_reason: string;
  source_label?: string | null;
  idempotency_key?: string | null;
};

export type AdminCreditGrantDraft = {
  user_id: string;
  credit_amount: number;
  admin_reason: string;
  source_label: string;
  metadata: {
    operation_version: typeof ADMIN_OPERATIONS_VERSION;
    support_surface: "admin_operations_console";
  };
  idempotency_key: string | null;
};

export function createEmptyAdminOperationsCoverage(): AdminOperationsCoverage {
  return ADMIN_OPERATIONS_SECTIONS.reduce((coverage, section) => {
    coverage[section] = false;
    return coverage;
  }, {} as AdminOperationsCoverage);
}

export function deriveAdminOperationsCoverage(input: {
  userCount?: number;
  creditHistoryCount?: number;
  partnerMembershipCount?: number;
  partnerPoolCount?: number;
  reportStatusCount?: number;
  reportFailureCount?: number;
  paymentEventCount?: number;
  consentRecordCount?: number;
  costEstimateCount?: number;
  auditLogCount?: number;
}): AdminOperationsCoverage {
  const available = (value: number | undefined) => typeof value === "number" && value >= 0;
  return {
    user_credits: available(input.userCount),
    credit_history: available(input.creditHistoryCount),
    partner_memberships: available(input.partnerMembershipCount),
    partner_pools: available(input.partnerPoolCount),
    report_status: available(input.reportStatusCount),
    failure_reason: available(input.reportFailureCount),
    payment_events: available(input.paymentEventCount),
    consent_records: available(input.consentRecordCount),
    cost_estimates: available(input.costEstimateCount),
    audit_log: available(input.auditLogCount),
  };
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function assertUuidLike(value: string, field: string): string {
  const cleaned = cleanText(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) {
    throw new Error(`${field} must be a UUID`);
  }
  return cleaned;
}

export function buildAdminCreditGrantDraft(
  input: AdminCreditGrantFormInput,
): AdminCreditGrantDraft {
  const userId = assertUuidLike(input.user_id, "user_id");
  if (!Number.isInteger(input.credit_amount) || input.credit_amount <= 0) {
    throw new Error("credit_amount must be a positive integer");
  }
  if (input.credit_amount > 1000) {
    throw new Error("credit_amount must be 1000 or less");
  }

  const reason = cleanText(input.admin_reason);
  if (reason.length < 12) {
    throw new Error("admin_reason must be at least 12 characters");
  }
  if (reason.length > 500) {
    throw new Error("admin_reason must be 500 characters or fewer");
  }

  const sourceLabel = cleanText(input.source_label) || "Admin credit adjustment";
  if (sourceLabel.length > 120) {
    throw new Error("source_label must be 120 characters or fewer");
  }

  const idempotencyKey = cleanText(input.idempotency_key) || null;
  if (idempotencyKey && idempotencyKey.length > 160) {
    throw new Error("idempotency_key must be 160 characters or fewer");
  }

  return {
    user_id: userId,
    credit_amount: input.credit_amount,
    admin_reason: reason,
    source_label: sourceLabel,
    metadata: {
      operation_version: ADMIN_OPERATIONS_VERSION,
      support_surface: "admin_operations_console",
    },
    idempotency_key: idempotencyKey,
  };
}

export function summarizeCoverage(coverage: AdminOperationsCoverage): {
  ready: boolean;
  missing: AdminOperationsSection[];
} {
  const missing = ADMIN_OPERATIONS_SECTIONS.filter((section) => !coverage[section]);
  return {
    ready: missing.length === 0,
    missing,
  };
}
