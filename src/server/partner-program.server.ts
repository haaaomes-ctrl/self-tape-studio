import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  buildPartnerCodeDraft,
  buildPartnerCreditPoolDraft,
  buildPartnerDraft,
  buildPartnerVisibilityAcceptanceDraft,
  normaliseAllowedEmailDomains,
  normalisePartnerCode,
  partnerCodeDisplayHint,
  type PartnerCodeInput,
  type PartnerCodeStatus,
  type PartnerCreditPoolInput,
  type PartnerInput,
  type PartnerVisibilityAcceptanceInput,
} from "@/lib/partner-program";

export type CreatePartnerCodeInput = Omit<PartnerCodeInput, "code_hash" | "code_display_hint"> & {
  raw_code: string;
};

export type RotatePartnerCodeInput = {
  existing_code_id: string;
  raw_code: string;
  allowance_credits?: number | null;
  expires_at?: string | Date | null;
  max_activations?: number | null;
  allowed_email_domains?: string[] | null;
  admin_actor_user_id?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type ActivatePartnerCodeInput = {
  user_id: string;
  raw_code: string;
  user_email?: string | null;
  activated_at?: string | Date;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type PartnerCodeAdminStatusInput = {
  partner_code_id: string;
  status: Exclude<PartnerCodeStatus, "rotated">;
  admin_actor_user_id?: string | null;
  reason?: string | null;
  changed_at?: string | Date;
};

export type FlagPartnerCodeAbuseInput = {
  partner_code_id: string;
  admin_actor_user_id?: string | null;
  reason?: string | null;
  flagged_at?: string | Date;
};

export type AdminTopUpPartnerCreditPoolInput = {
  partner_credit_pool_id: string;
  credit_amount: number;
  admin_actor_user_id?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type AdminTopUpPartnerMembershipInput = {
  partner_membership_id: string;
  credit_amount: number;
  admin_actor_user_id?: string | null;
  reason?: string | null;
  cap_override?: boolean;
  cap_override_reason?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export type AcceptPartnerVisibilityInput = PartnerVisibilityAcceptanceInput;

export type RevokePartnerVisibilityAcceptanceInput = {
  partner_visibility_acceptance_id: string;
  revoked_by_user_id?: string | null;
  revocation_reason?: string | null;
  revoked_at?: string | Date;
};

export type PartnerProgressDashboardRow = Tables<"partner_progress_dashboard_summary">;
export type PartnerAggregateDashboardRow = Tables<"partner_aggregate_dashboard_summary">;

function throwPartnerProgramError(operation: string, error: { message?: string }): never {
  console.error(`[partner-program] ${operation}_failed`, { error: error.message });
  throw new Error(`${operation} failed`);
}

function metadataAsJson(metadata: Record<string, unknown> | undefined): Json {
  return (metadata ?? {}) as Json;
}

function optionalIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("partner date must be a valid ISO date");
  }
  return date.toISOString();
}

function isoOrNow(value: string | Date | undefined): string {
  return optionalIso(value) ?? new Date().toISOString();
}

export function hashPartnerCode(rawCode: string): string {
  return createHash("sha256").update(normalisePartnerCode(rawCode)).digest("hex");
}

export function buildPartnerCodeSecretFields(rawCode: string) {
  return {
    code_hash: hashPartnerCode(rawCode),
    code_display_hint: partnerCodeDisplayHint(rawCode),
  };
}

export async function createPartner(input: PartnerInput) {
  const draft = buildPartnerDraft(input);
  const { data, error } = await supabaseAdmin
    .from("partners")
    .insert({ ...draft, metadata: metadataAsJson(draft.metadata) })
    .select("id")
    .single();

  if (error || !data) throwPartnerProgramError("create_partner", error ?? {});
  return { partner_id: data.id };
}

export async function createPartnerCode(input: CreatePartnerCodeInput) {
  const secretFields = buildPartnerCodeSecretFields(input.raw_code);
  const draft = buildPartnerCodeDraft({
    ...input,
    ...secretFields,
  });

  const { data, error } = await supabaseAdmin
    .from("partner_codes")
    .insert({ ...draft, metadata: metadataAsJson(draft.metadata) })
    .select("id")
    .single();

  if (error || !data) throwPartnerProgramError("create_partner_code", error ?? {});
  return { partner_code_id: data.id };
}

export async function createPartnerCreditPool(input: PartnerCreditPoolInput) {
  const draft = buildPartnerCreditPoolDraft(input);
  const { data, error } = await supabaseAdmin
    .from("partner_credit_pools")
    .insert({ ...draft, metadata: metadataAsJson(draft.metadata) })
    .select("id")
    .single();

  if (error || !data) throwPartnerProgramError("create_partner_credit_pool", error ?? {});
  return { partner_credit_pool_id: data.id };
}

export async function rotatePartnerCode(input: RotatePartnerCodeInput) {
  const secretFields = buildPartnerCodeSecretFields(input.raw_code);
  const { data, error } = await supabaseAdmin.rpc("rotate_partner_code", {
    p_existing_code_id: input.existing_code_id,
    p_new_code_hash: secretFields.code_hash,
    p_new_code_display_hint: secretFields.code_display_hint,
    p_allowance_credits: input.allowance_credits ?? null,
    p_expires_at: optionalIso(input.expires_at),
    p_max_activations: input.max_activations ?? null,
    p_allowed_email_domains:
      input.allowed_email_domains === undefined
        ? null
        : normaliseAllowedEmailDomains(input.allowed_email_domains),
    p_admin_actor_user_id: input.admin_actor_user_id ?? null,
    p_metadata: metadataAsJson(input.metadata),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error || !data) throwPartnerProgramError("rotate_partner_code", error ?? {});
  return { partner_code_id: data };
}

export async function setPartnerCodeStatus(input: PartnerCodeAdminStatusInput) {
  const { data, error } = await supabaseAdmin.rpc("set_partner_code_status", {
    p_partner_code_id: input.partner_code_id,
    p_status: input.status,
    p_admin_actor_user_id: input.admin_actor_user_id ?? null,
    p_reason: input.reason ?? null,
    p_now: isoOrNow(input.changed_at),
  });

  if (error || !data) throwPartnerProgramError("set_partner_code_status", error ?? {});
  return { partner_code_id: data };
}

export async function expirePartnerCodes(expiredAt: string | Date = new Date()) {
  const { data, error } = await supabaseAdmin.rpc("expire_partner_codes", {
    p_now: isoOrNow(expiredAt),
  });

  if (error || data === null) throwPartnerProgramError("expire_partner_codes", error ?? {});
  return { expired_count: data };
}

export async function flagPartnerCodeAbuse(input: FlagPartnerCodeAbuseInput) {
  const { data, error } = await supabaseAdmin.rpc("flag_partner_code_abuse", {
    p_partner_code_id: input.partner_code_id,
    p_admin_actor_user_id: input.admin_actor_user_id ?? null,
    p_reason: input.reason ?? null,
    p_now: isoOrNow(input.flagged_at),
  });

  if (error || !data) throwPartnerProgramError("flag_partner_code_abuse", error ?? {});
  return { partner_code_id: data };
}

export async function activatePartnerCode(input: ActivatePartnerCodeInput) {
  const { data, error } = await supabaseAdmin.rpc("activate_partner_code", {
    p_user_id: input.user_id,
    p_code_hash: hashPartnerCode(input.raw_code),
    p_user_email: input.user_email ?? null,
    p_activated_at: isoOrNow(input.activated_at),
    p_metadata: metadataAsJson(input.metadata),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error || !data) throwPartnerProgramError("activate_partner_code", error ?? {});
  return { partner_membership_id: data };
}

export async function adminTopUpPartnerCreditPool(input: AdminTopUpPartnerCreditPoolInput) {
  const { data, error } = await supabaseAdmin.rpc("admin_top_up_partner_credit_pool", {
    p_partner_credit_pool_id: input.partner_credit_pool_id,
    p_credit_amount: input.credit_amount,
    p_admin_actor_user_id: input.admin_actor_user_id ?? null,
    p_reason: input.reason ?? null,
    p_metadata: metadataAsJson(input.metadata),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error || !data) throwPartnerProgramError("admin_top_up_partner_credit_pool", error ?? {});
  return { partner_credit_pool_event_id: data };
}

export async function adminTopUpPartnerMembership(input: AdminTopUpPartnerMembershipInput) {
  const { data, error } = await supabaseAdmin.rpc("admin_top_up_partner_membership", {
    p_partner_membership_id: input.partner_membership_id,
    p_credit_amount: input.credit_amount,
    p_admin_actor_user_id: input.admin_actor_user_id ?? null,
    p_reason: input.reason ?? null,
    p_cap_override: input.cap_override ?? false,
    p_cap_override_reason: input.cap_override_reason ?? null,
    p_metadata: metadataAsJson(input.metadata),
    p_idempotency_key: input.idempotency_key ?? null,
  });

  if (error || !data) throwPartnerProgramError("admin_top_up_partner_membership", error ?? {});
  return { credit_grant_id: data };
}

export async function acceptPartnerVisibility(input: AcceptPartnerVisibilityInput) {
  const draft = buildPartnerVisibilityAcceptanceDraft(input);
  const { data, error } = await supabaseAdmin.rpc("accept_partner_visibility", {
    p_partner_membership_id: draft.partner_membership_id,
    p_user_id: draft.user_id,
    p_visibility_scope: draft.visibility_scope,
    p_parent_guardian_confirmed: draft.parent_guardian_confirmed,
    p_full_report_sharing_enabled: draft.full_report_sharing_enabled,
    p_uploaded_media_sharing_enabled: draft.uploaded_media_sharing_enabled,
    p_brief_sharing_enabled: draft.brief_sharing_enabled,
    p_accepted_at: draft.accepted_at,
    p_metadata: metadataAsJson(draft.metadata),
    p_idempotency_key: draft.idempotency_key,
  });

  if (error || !data) throwPartnerProgramError("accept_partner_visibility", error ?? {});
  return { partner_visibility_acceptance_id: data };
}

export async function revokePartnerVisibilityAcceptance(
  input: RevokePartnerVisibilityAcceptanceInput,
) {
  const { data, error } = await supabaseAdmin.rpc("revoke_partner_visibility_acceptance", {
    p_partner_visibility_acceptance_id: input.partner_visibility_acceptance_id,
    p_revoked_by_user_id: input.revoked_by_user_id ?? null,
    p_revocation_reason: input.revocation_reason ?? null,
    p_revoked_at: isoOrNow(input.revoked_at),
  });

  if (error || !data) {
    throwPartnerProgramError("revoke_partner_visibility_acceptance", error ?? {});
  }
  return { partner_visibility_acceptance_id: data };
}

export async function listPartnerProgressDashboardRows(partnerId: string) {
  const { data, error } = await supabaseAdmin
    .from("partner_progress_dashboard_summary")
    .select("*")
    .eq("partner_id", partnerId)
    .order("latest_report_at", { ascending: false, nullsFirst: false });

  if (error) throwPartnerProgramError("list_partner_progress_dashboard_rows", error);
  return (data ?? []) as PartnerProgressDashboardRow[];
}

export async function listPartnerAggregateDashboardRows(partnerId?: string | null) {
  let query = supabaseAdmin
    .from("partner_aggregate_dashboard_summary")
    .select("*")
    .order("partner_name", { ascending: true });

  if (partnerId) {
    query = query.eq("partner_id", partnerId);
  }

  const { data, error } = await query;
  if (error) throwPartnerProgramError("list_partner_aggregate_dashboard_rows", error);
  return (data ?? []) as PartnerAggregateDashboardRow[];
}
