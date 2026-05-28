import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  allocateCreditsForConsumption,
  assertCreditSource,
  assertReportCreditReservationStatus,
  buildAdminAdjustmentEntry,
  buildCreditGrantDraft,
  formatReportCreditRequiredError,
  isReportCreditRequiredMessage,
  summariseCreditEntriesBySource,
  type CreditGrantBalance,
  type CreditGrantInput,
  type CreditLedgerEntrySummary,
  type CreditSourceFinanceSummary,
  type ReportCreditReservationStatus,
} from "@/lib/credit-ledger";
import { safeEnqueueCrmEmailForUser } from "@/server/crm-messaging.server";
import { recordServerAnalyticsEvent } from "@/server/analytics-events.server";

export type RecordCreditConsumptionInput = {
  user_id: string;
  credit_grant_id: string;
  credit_amount: number;
  take_id?: string | null;
  audition_id?: string | null;
  report_generated_at?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type RecordAdminCreditAdjustmentInput = {
  user_id: string;
  source: unknown;
  credit_delta: number;
  credit_grant_id?: string | null;
  admin_actor_user_id?: string | null;
  admin_reason: string;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type ReserveReportCreditInput = {
  take_id: string;
  requested_by_user_id?: string | null;
  synthetic_usage?: boolean;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type ConsumeReportCreditReservationInput = {
  credit_reservation_id: string;
  take_id?: string | null;
  report_generated_at?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type ReleaseReportCreditReservationInput = {
  credit_reservation_id: string;
  release_status: Extract<ReportCreditReservationStatus, "released" | "refunded">;
  release_reason?: string | null;
  failure_code?: string | null;
  metadata?: Record<string, unknown>;
};

export class ReportCreditRequiredError extends Error {
  readonly code = "CREDIT_REQUIRED";

  constructor(message = formatReportCreditRequiredError()) {
    super(message);
  }
}

function throwCreditLedgerError(operation: string, error: { message?: string }): never {
  console.error(`[credit-ledger] ${operation}_failed`, { error: error.message });
  throw new Error(`${operation} failed`);
}

function throwReportCreditLifecycleError(operation: string, error: { message?: string }): never {
  const message = error.message ?? "";
  if (isReportCreditRequiredMessage(message)) {
    throw new ReportCreditRequiredError(message);
  }
  if (message.startsWith("TAKE_NOT_FOUND:") || message.startsWith("FORBIDDEN:")) {
    throw new Error(message);
  }
  console.error(`[credit-ledger] ${operation}_failed`, { error: message });
  throw new Error(`${operation} failed`);
}

function metadataAsJson(metadata: Record<string, unknown>): Json {
  return metadata as Json;
}

export async function grantFundedCredits(input: CreditGrantInput) {
  const draft = buildCreditGrantDraft(input);
  const { data, error } = await supabaseAdmin.rpc("grant_funded_credits", {
    p_user_id: draft.user_id,
    p_source: draft.source,
    p_credit_amount: draft.original_credits,
    p_granted_at: draft.granted_at,
    p_expires_at: draft.expires_at,
    p_source_reference_type: draft.source_reference_type,
    p_source_reference_id: draft.source_reference_id,
    p_source_label: draft.source_label,
    p_admin_actor_user_id: draft.granted_by_user_id,
    p_admin_reason: draft.admin_reason,
    p_metadata: metadataAsJson(draft.metadata),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error || !data) throwCreditLedgerError("grant_funded_credits", error ?? {});
  if (draft.source === "free_signup" || draft.source === "free_monthly") {
    void recordServerAnalyticsEvent({
      eventName: "free_credit_grant",
      userId: draft.user_id,
      objectType: "credit_grant",
      objectId: data,
      properties: {
        credit_source: draft.source,
        credit_amount: draft.original_credits,
      },
    });
  }
  const crmMessageKey =
    draft.source === "free_signup"
      ? "free_report_available"
      : draft.source === "free_monthly"
        ? "monthly_free_report"
        : "credits_added";
  void safeEnqueueCrmEmailForUser({
    userId: draft.user_id,
    messageKey: crmMessageKey,
    idempotencyKey: `crm:${crmMessageKey}:${draft.user_id}:credit_grant:${data}`,
    templateData: {
      object_type: "credit_grant",
      object_id: data,
      credit_source: draft.source,
      credit_amount: draft.original_credits,
      account_label: draft.source_label ?? null,
      context_line:
        draft.source === "free_monthly"
          ? "Your monthly free TapeCoach report credit is available."
          : `${draft.original_credits} TapeCoach report credit${
              draft.original_credits === 1 ? "" : "s"
            } ${draft.original_credits === 1 ? "has" : "have"} been added to your account.`,
    },
  });
  return { credit_grant_id: data };
}

export async function planCreditConsumption(userId: string, creditAmount: number) {
  const { data, error } = await supabaseAdmin
    .from("credit_grants")
    .select("id, source, remaining_credits, expires_at, granted_at, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("remaining_credits", 0);

  if (error || !data) throwCreditLedgerError("plan_credit_consumption", error ?? {});
  return allocateCreditsForConsumption(data as CreditGrantBalance[], creditAmount);
}

export async function recordCreditConsumption(input: RecordCreditConsumptionInput) {
  const { data, error } = await supabaseAdmin.rpc("record_credit_consumption", {
    p_user_id: input.user_id,
    p_credit_grant_id: input.credit_grant_id,
    p_credit_amount: input.credit_amount,
    p_take_id: input.take_id ?? null,
    p_audition_id: input.audition_id ?? null,
    p_report_generated_at: input.report_generated_at ?? new Date().toISOString(),
    p_metadata: metadataAsJson(input.metadata ?? {}),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error || !data) throwCreditLedgerError("record_credit_consumption", error ?? {});
  return { credit_ledger_entry_id: data };
}

export async function recordAdminCreditAdjustment(input: RecordAdminCreditAdjustmentInput) {
  const adjustment = buildAdminAdjustmentEntry({
    ...input,
    source: assertCreditSource(input.source),
  });
  if (!adjustment.admin_reason) {
    throw new Error("admin credit adjustments require an admin_reason");
  }

  const { data, error } = await supabaseAdmin.rpc("record_admin_credit_adjustment", {
    p_user_id: adjustment.user_id,
    p_source: adjustment.source,
    p_credit_delta: adjustment.credit_delta,
    p_admin_actor_user_id: adjustment.admin_actor_user_id,
    p_admin_reason: adjustment.admin_reason,
    p_credit_grant_id: adjustment.credit_grant_id,
    p_metadata: metadataAsJson(adjustment.metadata),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error || !data) throwCreditLedgerError("record_admin_credit_adjustment", error ?? {});
  return { credit_ledger_entry_id: data };
}

export async function reserveReportCreditForTake(input: ReserveReportCreditInput) {
  const { data, error } = await supabaseAdmin.rpc("reserve_report_credit_for_take", {
    p_take_id: input.take_id,
    p_requested_by_user_id: input.requested_by_user_id ?? null,
    p_synthetic_usage: input.synthetic_usage ?? false,
    p_metadata: metadataAsJson(input.metadata ?? {}),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error || !data)
    throwReportCreditLifecycleError("reserve_report_credit_for_take", error ?? {});

  const { data: reservation, error: readError } = await supabaseAdmin
    .from("report_credit_reservations")
    .select("synthetic_usage")
    .eq("id", data)
    .maybeSingle();

  if (readError) throwReportCreditLifecycleError("read_report_credit_reservation", readError);

  return {
    credit_reservation_id: data,
    synthetic_usage: reservation?.synthetic_usage ?? input.synthetic_usage ?? false,
  };
}

export async function consumeReportCreditReservation(input: ConsumeReportCreditReservationInput) {
  const { data, error } = await supabaseAdmin.rpc("consume_report_credit_reservation", {
    p_reservation_id: input.credit_reservation_id,
    p_take_id: input.take_id ?? null,
    p_report_generated_at: input.report_generated_at ?? new Date().toISOString(),
    p_metadata: metadataAsJson(input.metadata ?? {}),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error) throwReportCreditLifecycleError("consume_report_credit_reservation", error);
  return { credit_ledger_entry_id: data ?? null };
}

export async function releaseReportCreditReservation(input: ReleaseReportCreditReservationInput) {
  const releaseStatus = assertReportCreditReservationStatus(input.release_status);
  if (releaseStatus !== "released" && releaseStatus !== "refunded") {
    throw new Error("report credit release status must be released or refunded");
  }

  const { data, error } = await supabaseAdmin.rpc("release_report_credit_reservation", {
    p_reservation_id: input.credit_reservation_id,
    p_release_status: releaseStatus,
    p_release_reason: input.release_reason ?? null,
    p_failure_code: input.failure_code ?? null,
    p_metadata: metadataAsJson(input.metadata ?? {}),
  });

  if (error || !data)
    throwReportCreditLifecycleError("release_report_credit_reservation", error ?? {});
  return { credit_reservation_id: data };
}

export async function releaseReportCreditForTake(input: {
  take_id: string;
  release_status: Extract<ReportCreditReservationStatus, "released" | "refunded">;
  release_reason?: string | null;
  failure_code?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("takes")
    .select("credit_reservation_id")
    .eq("id", input.take_id)
    .maybeSingle();

  if (error) throwReportCreditLifecycleError("read_take_credit_reservation", error);
  if (!data?.credit_reservation_id) {
    return { credit_reservation_id: null, released: false as const };
  }

  const released = await releaseReportCreditReservation({
    credit_reservation_id: data.credit_reservation_id,
    release_status: input.release_status,
    release_reason: input.release_reason,
    failure_code: input.failure_code,
    metadata: input.metadata,
  });

  return { ...released, released: true as const };
}

export async function getCreditSourceFinanceSummary(): Promise<CreditSourceFinanceSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("credit_source_finance_summary")
    .select(
      "source, granted_credits, consumed_credits, admin_adjustment_credits, expired_credits, net_credits, entry_count",
    );

  if (error || !data) throwCreditLedgerError("credit_source_finance_summary", error ?? {});
  return data.map((row) => ({
    source: assertCreditSource(row.source),
    granted_credits: row.granted_credits,
    consumed_credits: row.consumed_credits,
    admin_adjustment_credits: row.admin_adjustment_credits,
    expired_credits: row.expired_credits,
    net_credits: row.net_credits,
    entry_count: row.entry_count,
  }));
}

export async function getCreditSourceFinanceSummaryFromLedger(): Promise<
  CreditSourceFinanceSummary[]
> {
  const { data, error } = await supabaseAdmin
    .from("credit_ledger_entries")
    .select("source, entry_type, credit_delta");

  if (error || !data) throwCreditLedgerError("credit_ledger_entries_report", error ?? {});
  return summariseCreditEntriesBySource(data as CreditLedgerEntrySummary[]);
}
