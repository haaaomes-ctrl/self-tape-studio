import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import {
  ADMIN_OPERATIONS_VERSION,
  buildAdminCreditGrantDraft,
  deriveAdminOperationsCoverage,
  type AdminCreditGrantFormInput,
  type AdminOperationsCoverage,
} from "@/lib/admin-operations";

export type AdminAuditLogRow = Tables<"admin_audit_log">;
export type AdminCreditGrantRow = Pick<
  Tables<"credit_grants">,
  | "id"
  | "user_id"
  | "source"
  | "original_credits"
  | "remaining_credits"
  | "status"
  | "expires_at"
  | "source_label"
  | "admin_reason"
  | "granted_at"
  | "created_at"
>;
export type AdminCreditLedgerRow = Pick<
  Tables<"credit_ledger_entries">,
  | "id"
  | "user_id"
  | "source"
  | "entry_type"
  | "credit_delta"
  | "credit_grant_id"
  | "take_id"
  | "audition_id"
  | "admin_actor_user_id"
  | "admin_reason"
  | "created_at"
>;
export type AdminPartnerMembershipRow = Pick<
  Tables<"partner_memberships">,
  | "id"
  | "user_id"
  | "partner_id"
  | "partner_type"
  | "status"
  | "allowance_credits"
  | "credit_grant_id"
  | "credit_source"
  | "expires_at"
  | "activated_at"
>;
export type AdminPartnerPoolRow = Pick<
  Tables<"partner_credit_pools">,
  | "id"
  | "partner_id"
  | "name"
  | "period_type"
  | "status"
  | "total_credits"
  | "allocated_credits"
  | "consumed_credits"
  | "per_user_cap"
  | "period_start"
  | "period_end"
  | "overage_allowed"
  | "overage_price_pence"
>;
export type AdminPartnerRow = Pick<Tables<"partners">, "id" | "name" | "type" | "status">;
export type AdminTakeRow = Pick<
  Tables<"takes">,
  | "id"
  | "user_id"
  | "audition_id"
  | "take_number"
  | "status"
  | "processing_phase"
  | "mux_status"
  | "credit_lifecycle_status"
  | "credit_reservation_id"
  | "credit_is_synthetic_usage"
  | "error_message"
  | "overall_score"
  | "created_at"
  | "updated_at"
>;
export type AdminReservationRow = Pick<
  Tables<"report_credit_reservations">,
  | "id"
  | "user_id"
  | "audition_id"
  | "take_id"
  | "source"
  | "status"
  | "synthetic_usage"
  | "failure_code"
  | "release_reason"
  | "reserved_at"
  | "consumed_at"
  | "released_at"
  | "refunded_at"
>;
export type AdminPaymentRow = Pick<
  Tables<"consumer_credit_payments">,
  | "id"
  | "user_id"
  | "product_sku"
  | "credit_amount"
  | "amount_total_pence"
  | "currency"
  | "status"
  | "credit_grant_id"
  | "failure_code"
  | "stripe_checkout_session_id"
  | "stripe_payment_intent_id"
  | "created_at"
  | "updated_at"
>;
export type AdminConsentRow = Pick<
  Tables<"account_compliance">,
  | "user_id"
  | "account_route"
  | "account_type"
  | "age_band_declaration"
  | "parent_managed"
  | "parent_guardian_attested"
  | "terms_version"
  | "terms_accepted_at"
  | "privacy_version"
  | "privacy_accepted_at"
  | "ai_disclaimer_version"
  | "ai_disclaimer_accepted_at"
  | "marketing_consent"
  | "marketing_consent_at"
  | "updated_at"
>;
export type AdminCostEstimateRow = Pick<
  Tables<"take_ai_report_costs">,
  | "take_id"
  | "audition_id"
  | "user_id"
  | "take_status"
  | "overall_score"
  | "ai_call_count"
  | "failed_call_count"
  | "report_estimated_cost_usd"
  | "report_cost_source"
  | "credit_source"
  | "partner_name"
  | "duration_status"
  | "last_ai_usage_at"
>;

export type AdminUserOperationsRow = {
  user_id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  total_remaining_credits: number;
  active_credit_grants: number;
  lifetime_credit_delta: number;
  partner_memberships: number;
  latest_report_status: string | null;
  latest_report_failure_reason: string | null;
  payment_events: number;
  consent_recorded: boolean;
  marketing_consent: boolean | null;
};

export type AdminReportStatusRow = {
  take_id: string;
  user_id: string | null;
  audition_id: string;
  take_number: number;
  status: string;
  processing_phase: string;
  mux_status: string;
  credit_lifecycle_status: string | null;
  reservation_status: string | null;
  failure_reason: string | null;
  overall_score: number | null;
  estimated_cost_usd: number | null;
  cost_source: string | null;
  updated_at: string;
};

export type AdminOperationsSnapshot = {
  version: typeof ADMIN_OPERATIONS_VERSION;
  generated_at: string;
  coverage: AdminOperationsCoverage;
  counts: {
    users: number;
    credit_history: number;
    partner_memberships: number;
    partner_pools: number;
    reports: number;
    failures: number;
    payment_events: number;
    consent_records: number;
    cost_estimates: number;
    audit_log: number;
  };
  users: AdminUserOperationsRow[];
  credit_history: AdminCreditLedgerRow[];
  partner_memberships: Array<
    AdminPartnerMembershipRow & {
      partner_name: string | null;
      remaining_credits: number | null;
    }
  >;
  partner_pools: Array<
    AdminPartnerPoolRow & {
      partner_name: string | null;
      partner_type: string | null;
      remaining_pool_credits: number;
      usage_percent: number;
    }
  >;
  reports: AdminReportStatusRow[];
  payments: AdminPaymentRow[];
  consent_records: AdminConsentRow[];
  cost_estimates: AdminCostEstimateRow[];
  audit_log: AdminAuditLogRow[];
};

export type AdminCreditGrantResult = {
  credit_grant_id: string;
  audit_log_id: string;
};

type SupabaseError = { message?: string };
type AdminGrantUserCreditsRpc = {
  rpc(
    fn: "admin_grant_user_credits",
    args: Database["public"]["Functions"]["admin_grant_user_credits"]["Args"],
  ): Promise<{
    data: Database["public"]["Functions"]["admin_grant_user_credits"]["Returns"] | null;
    error: SupabaseError | null;
  }>;
};

function throwAdminOperationsError(operation: string, error: SupabaseError): never {
  console.error(`[admin-operations] ${operation}_failed`, { error: error.message });
  throw new Error(`${operation} failed`);
}

function metadataAsJson(metadata: Record<string, unknown>): Json {
  return metadata as Json;
}

function relationMap<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function latestByUser<
  T extends { user_id: string | null; updated_at?: string; created_at?: string },
>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!row.user_id) continue;
    const current = map.get(row.user_id);
    const rowMs = Date.parse(row.updated_at ?? row.created_at ?? "");
    const currentMs = current ? Date.parse(current.updated_at ?? current.created_at ?? "") : -1;
    if (!current || rowMs > currentMs) map.set(row.user_id, row);
  }
  return map;
}

function activeRemainingCredits(grants: AdminCreditGrantRow[], userId: string): number {
  const nowMs = Date.now();
  return grants
    .filter((grant) => {
      if (grant.user_id !== userId || grant.status !== "active" || grant.remaining_credits <= 0) {
        return false;
      }
      if (!grant.expires_at) return true;
      return Date.parse(grant.expires_at) > nowMs;
    })
    .reduce((total, grant) => total + grant.remaining_credits, 0);
}

function activeGrantCount(grants: AdminCreditGrantRow[], userId: string): number {
  return grants.filter(
    (grant) => grant.user_id === userId && grant.status === "active" && grant.remaining_credits > 0,
  ).length;
}

function lifetimeCreditDelta(entries: AdminCreditLedgerRow[], userId: string): number {
  return entries
    .filter((entry) => entry.user_id === userId)
    .reduce((total, entry) => total + entry.credit_delta, 0);
}

function reportFailureReason(
  take: AdminTakeRow,
  reservation: AdminReservationRow | null,
): string | null {
  if (take.error_message) return take.error_message;
  if (reservation?.failure_code) return reservation.failure_code;
  if (reservation?.release_reason) return reservation.release_reason;
  if (take.credit_lifecycle_status === "blocked_no_credit") return "blocked_no_credit";
  return null;
}

async function listAuthUsers(): Promise<User[]> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  if (error) throwAdminOperationsError("list_auth_users", error);
  return data.users;
}

export async function getAdminOperationsSnapshot(): Promise<AdminOperationsSnapshot> {
  const [
    authUsers,
    creditGrantsResult,
    creditLedgerResult,
    partnerMembershipsResult,
    partnerPoolsResult,
    partnersResult,
    takesResult,
    reservationsResult,
    paymentsResult,
    consentResult,
    costsResult,
    auditResult,
  ] = await Promise.all([
    listAuthUsers(),
    supabaseAdmin
      .from("credit_grants")
      .select(
        "id, user_id, source, original_credits, remaining_credits, status, expires_at, source_label, admin_reason, granted_at, created_at",
      )
      .order("granted_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("credit_ledger_entries")
      .select(
        "id, user_id, source, entry_type, credit_delta, credit_grant_id, take_id, audition_id, admin_actor_user_id, admin_reason, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("partner_memberships")
      .select(
        "id, user_id, partner_id, partner_type, status, allowance_credits, credit_grant_id, credit_source, expires_at, activated_at",
      )
      .order("activated_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("partner_credit_pools")
      .select(
        "id, partner_id, name, period_type, status, total_credits, allocated_credits, consumed_credits, per_user_cap, period_start, period_end, overage_allowed, overage_price_pence",
      )
      .order("period_end", { ascending: false })
      .limit(250),
    supabaseAdmin.from("partners").select("id, name, type, status").order("name", {
      ascending: true,
    }),
    supabaseAdmin
      .from("takes")
      .select(
        "id, user_id, audition_id, take_number, status, processing_phase, mux_status, credit_lifecycle_status, credit_reservation_id, credit_is_synthetic_usage, error_message, overall_score, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(250),
    supabaseAdmin
      .from("report_credit_reservations")
      .select(
        "id, user_id, audition_id, take_id, source, status, synthetic_usage, failure_code, release_reason, reserved_at, consumed_at, released_at, refunded_at",
      )
      .order("reserved_at", { ascending: false })
      .limit(250),
    supabaseAdmin
      .from("consumer_credit_payments")
      .select(
        "id, user_id, product_sku, credit_amount, amount_total_pence, currency, status, credit_grant_id, failure_code, stripe_checkout_session_id, stripe_payment_intent_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(250),
    supabaseAdmin
      .from("account_compliance")
      .select(
        "user_id, account_route, account_type, age_band_declaration, parent_managed, parent_guardian_attested, terms_version, terms_accepted_at, privacy_version, privacy_accepted_at, ai_disclaimer_version, ai_disclaimer_accepted_at, marketing_consent, marketing_consent_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(250),
    supabaseAdmin
      .from("take_ai_report_costs")
      .select(
        "take_id, audition_id, user_id, take_status, overall_score, ai_call_count, failed_call_count, report_estimated_cost_usd, report_cost_source, credit_source, partner_name, duration_status, last_ai_usage_at",
      )
      .order("last_ai_usage_at", { ascending: false, nullsFirst: false })
      .limit(250),
    supabaseAdmin
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  if (creditGrantsResult.error) {
    throwAdminOperationsError("list_credit_grants", creditGrantsResult.error);
  }
  if (creditLedgerResult.error) {
    throwAdminOperationsError("list_credit_ledger", creditLedgerResult.error);
  }
  if (partnerMembershipsResult.error) {
    throwAdminOperationsError("list_partner_memberships", partnerMembershipsResult.error);
  }
  if (partnerPoolsResult.error) {
    throwAdminOperationsError("list_partner_pools", partnerPoolsResult.error);
  }
  if (partnersResult.error) throwAdminOperationsError("list_partners", partnersResult.error);
  if (takesResult.error) throwAdminOperationsError("list_takes", takesResult.error);
  if (reservationsResult.error) {
    throwAdminOperationsError("list_report_credit_reservations", reservationsResult.error);
  }
  if (paymentsResult.error) throwAdminOperationsError("list_payments", paymentsResult.error);
  if (consentResult.error) throwAdminOperationsError("list_consent_records", consentResult.error);
  if (costsResult.error) throwAdminOperationsError("list_cost_estimates", costsResult.error);
  if (auditResult.error) throwAdminOperationsError("list_admin_audit_log", auditResult.error);

  const creditGrants = (creditGrantsResult.data ?? []) as AdminCreditGrantRow[];
  const creditLedger = (creditLedgerResult.data ?? []) as AdminCreditLedgerRow[];
  const partnerMemberships = (partnerMembershipsResult.data ?? []) as AdminPartnerMembershipRow[];
  const partnerPools = (partnerPoolsResult.data ?? []) as AdminPartnerPoolRow[];
  const partners = (partnersResult.data ?? []) as AdminPartnerRow[];
  const takes = (takesResult.data ?? []) as AdminTakeRow[];
  const reservations = (reservationsResult.data ?? []) as AdminReservationRow[];
  const payments = (paymentsResult.data ?? []) as AdminPaymentRow[];
  const consentRecords = (consentResult.data ?? []) as AdminConsentRow[];
  const costs = (costsResult.data ?? []) as AdminCostEstimateRow[];
  const auditLog = (auditResult.data ?? []) as AdminAuditLogRow[];

  const partnersById = relationMap(partners);
  const grantsById = relationMap(creditGrants);
  const reservationsByTakeId = new Map(
    reservations.filter((row) => row.take_id).map((row) => [row.take_id as string, row]),
  );
  const costsByTakeId = new Map(
    costs.filter((row) => row.take_id).map((row) => [row.take_id as string, row]),
  );
  const latestReportByUser = latestByUser(takes);
  const consentByUser = new Map(consentRecords.map((row) => [row.user_id, row]));

  const knownUsers = new Map<
    string,
    {
      user_id: string;
      email: string | null;
      created_at: string | null;
      last_sign_in_at: string | null;
    }
  >();
  for (const user of authUsers) {
    knownUsers.set(user.id, {
      user_id: user.id,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    });
  }
  for (const row of [
    ...creditGrants,
    ...creditLedger,
    ...partnerMemberships,
    ...payments,
    ...consentRecords,
    ...takes,
    ...costs,
  ]) {
    const userId = row.user_id;
    if (userId && !knownUsers.has(userId)) {
      knownUsers.set(userId, {
        user_id: userId,
        email: null,
        created_at: null,
        last_sign_in_at: null,
      });
    }
  }

  const reports: AdminReportStatusRow[] = takes.map((take) => {
    const reservation = reservationsByTakeId.get(take.id) ?? null;
    const cost = costsByTakeId.get(take.id) ?? null;
    return {
      take_id: take.id,
      user_id: take.user_id,
      audition_id: take.audition_id,
      take_number: take.take_number,
      status: take.status,
      processing_phase: take.processing_phase,
      mux_status: take.mux_status,
      credit_lifecycle_status: take.credit_lifecycle_status,
      reservation_status: reservation?.status ?? null,
      failure_reason: reportFailureReason(take, reservation),
      overall_score: take.overall_score,
      estimated_cost_usd: cost?.report_estimated_cost_usd ?? null,
      cost_source: cost?.report_cost_source ?? null,
      updated_at: take.updated_at,
    };
  });

  const users = Array.from(knownUsers.values())
    .map((user): AdminUserOperationsRow => {
      const latestReport = latestReportByUser.get(user.user_id) ?? null;
      const latestReservation = latestReport
        ? (reservationsByTakeId.get(latestReport.id) ?? null)
        : null;
      const consent = consentByUser.get(user.user_id) ?? null;
      return {
        ...user,
        total_remaining_credits: activeRemainingCredits(creditGrants, user.user_id),
        active_credit_grants: activeGrantCount(creditGrants, user.user_id),
        lifetime_credit_delta: lifetimeCreditDelta(creditLedger, user.user_id),
        partner_memberships: partnerMemberships.filter((row) => row.user_id === user.user_id)
          .length,
        latest_report_status: latestReport?.status ?? null,
        latest_report_failure_reason: latestReport
          ? reportFailureReason(latestReport, latestReservation)
          : null,
        payment_events: payments.filter((row) => row.user_id === user.user_id).length,
        consent_recorded: Boolean(consent),
        marketing_consent: consent?.marketing_consent ?? null,
      };
    })
    .sort((left, right) => {
      if (right.total_remaining_credits !== left.total_remaining_credits) {
        return right.total_remaining_credits - left.total_remaining_credits;
      }
      return (left.email ?? left.user_id).localeCompare(right.email ?? right.user_id);
    });

  const partnerMembershipRows = partnerMemberships.map((membership) => {
    const partner = partnersById.get(membership.partner_id);
    const grant = membership.credit_grant_id ? grantsById.get(membership.credit_grant_id) : null;
    return {
      ...membership,
      partner_name: partner?.name ?? null,
      remaining_credits: grant?.remaining_credits ?? null,
    };
  });

  const partnerPoolRows = partnerPools.map((pool) => {
    const partner = partnersById.get(pool.partner_id);
    const remaining = Math.max(0, pool.total_credits - pool.consumed_credits);
    const usagePercent =
      pool.total_credits > 0
        ? Number(((pool.consumed_credits / pool.total_credits) * 100).toFixed(1))
        : 0;
    return {
      ...pool,
      partner_name: partner?.name ?? null,
      partner_type: partner?.type ?? null,
      remaining_pool_credits: remaining,
      usage_percent: usagePercent,
    };
  });

  const failureCount = reports.filter((report) => report.failure_reason).length;

  return {
    version: ADMIN_OPERATIONS_VERSION,
    generated_at: new Date().toISOString(),
    coverage: deriveAdminOperationsCoverage({
      userCount: users.length,
      creditHistoryCount: creditLedger.length,
      partnerMembershipCount: partnerMembershipRows.length,
      partnerPoolCount: partnerPoolRows.length,
      reportStatusCount: reports.length,
      reportFailureCount: failureCount,
      paymentEventCount: payments.length,
      consentRecordCount: consentRecords.length,
      costEstimateCount: costs.length,
      auditLogCount: auditLog.length,
    }),
    counts: {
      users: users.length,
      credit_history: creditLedger.length,
      partner_memberships: partnerMembershipRows.length,
      partner_pools: partnerPoolRows.length,
      reports: reports.length,
      failures: failureCount,
      payment_events: payments.length,
      consent_records: consentRecords.length,
      cost_estimates: costs.length,
      audit_log: auditLog.length,
    },
    users,
    credit_history: creditLedger,
    partner_memberships: partnerMembershipRows,
    partner_pools: partnerPoolRows,
    reports,
    payments,
    consent_records: consentRecords,
    cost_estimates: costs,
    audit_log: auditLog,
  };
}

export async function grantAdminCredits(input: {
  form: AdminCreditGrantFormInput;
  actor_user_id?: string | null;
  actor_email?: string | null;
}): Promise<AdminCreditGrantResult> {
  const draft = buildAdminCreditGrantDraft(input.form);
  const adminRpc = supabaseAdmin as unknown as AdminGrantUserCreditsRpc;
  const { data, error } = await adminRpc.rpc("admin_grant_user_credits", {
    p_user_id: draft.user_id,
    p_credit_amount: draft.credit_amount,
    p_admin_actor_user_id: input.actor_user_id ?? undefined,
    p_admin_actor_email: input.actor_email ?? undefined,
    p_admin_reason: draft.admin_reason,
    p_source_label: draft.source_label,
    p_metadata: metadataAsJson(draft.metadata),
    p_idempotency_key: draft.idempotency_key ?? undefined,
  });

  if (error) throwAdminOperationsError("admin_grant_user_credits", error);
  const row = data?.[0];
  if (!row) throwAdminOperationsError("admin_grant_user_credits", {});
  return row;
}
