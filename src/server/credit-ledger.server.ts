import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  allocateCreditsForConsumption,
  assertCreditSource,
  buildAdminAdjustmentEntry,
  buildCreditGrantDraft,
  summariseCreditEntriesBySource,
  type CreditGrantBalance,
  type CreditGrantInput,
  type CreditLedgerEntrySummary,
  type CreditSourceFinanceSummary,
} from "@/lib/credit-ledger";

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

function throwCreditLedgerError(operation: string, error: { message?: string }): never {
  console.error(`[credit-ledger] ${operation}_failed`, { error: error.message });
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
