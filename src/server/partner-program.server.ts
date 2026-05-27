import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  buildPartnerCodeDraft,
  buildPartnerDraft,
  normaliseAllowedEmailDomains,
  normalisePartnerCode,
  partnerCodeDisplayHint,
  type PartnerCodeInput,
  type PartnerCodeStatus,
  type PartnerInput,
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
