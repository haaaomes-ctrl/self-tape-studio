import type { Tables } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  deriveCreditBalanceSnapshot,
  type CreditBalanceGrantInput,
  type CreditBalancePartnerMembershipInput,
  type CreditBalanceSnapshot,
} from "@/lib/credit-balance";
import { hashPartnerCode } from "@/server/partner-program.server";

type CreditGrantRow = Pick<
  Tables<"credit_grants">,
  | "id"
  | "source"
  | "original_credits"
  | "remaining_credits"
  | "expires_at"
  | "source_label"
  | "status"
  | "granted_at"
  | "created_at"
>;

type PartnerMembershipQueryRow = Pick<
  Tables<"partner_memberships">,
  | "id"
  | "partner_type"
  | "credit_source"
  | "allowance_credits"
  | "expires_at"
  | "status"
  | "activated_at"
  | "credit_grant_id"
> & {
  partners?: { name?: string | null } | { name?: string | null }[] | null;
  credit_grants?:
    | { remaining_credits?: number | null; status?: string | null; expires_at?: string | null }
    | { remaining_credits?: number | null; status?: string | null; expires_at?: string | null }[]
    | null;
};

export class PartnerCodeActivationError extends Error {
  readonly code = "PARTNER_CODE_ACTIVATION_FAILED";
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toGrantInput(row: CreditGrantRow): CreditBalanceGrantInput {
  return {
    id: row.id,
    source: row.source,
    original_credits: row.original_credits,
    remaining_credits: row.remaining_credits,
    expires_at: row.expires_at,
    source_label: row.source_label,
    status: row.status,
    granted_at: row.granted_at,
    created_at: row.created_at,
  };
}

function toPartnerMembershipInput(
  row: PartnerMembershipQueryRow,
): CreditBalancePartnerMembershipInput {
  const partner = firstRelation(row.partners);
  const grant = firstRelation(row.credit_grants);
  const grantExpiry = grant?.expires_at ?? row.expires_at;
  return {
    id: row.id,
    partner_name: partner?.name ?? null,
    partner_type: row.partner_type,
    credit_source: row.credit_source,
    allowance_credits: row.allowance_credits,
    remaining_credits:
      typeof grant?.remaining_credits === "number"
        ? grant.remaining_credits
        : row.allowance_credits,
    expires_at: grantExpiry ?? null,
    status: row.status,
    activated_at: row.activated_at,
  };
}

function activationMessage(message: string | undefined): string {
  const text = message ?? "";
  if (/not found/i.test(text)) return "We could not find that partner code.";
  if (/not active yet/i.test(text)) return "That partner code is not active yet.";
  if (/not active/i.test(text)) return "That partner code is not active.";
  if (/expired/i.test(text)) return "That partner code has expired.";
  if (/max activations/i.test(text)) return "That partner code has reached its activation limit.";
  if (/email domain/i.test(text)) return "That partner code is not valid for this account email.";
  if (/6-64|partner code/i.test(text)) return text;
  return "Partner code could not be activated. Check the code and try again.";
}

async function readCreditGrantRows(userId: string): Promise<CreditBalanceGrantInput[]> {
  const { data, error } = await supabaseAdmin
    .from("credit_grants")
    .select(
      "id, source, original_credits, remaining_credits, expires_at, source_label, status, granted_at, created_at",
    )
    .eq("user_id", userId)
    .in("status", ["active", "exhausted", "expired"])
    .order("granted_at", { ascending: false });

  if (error) {
    console.error("[credit-balance] read_credit_grants_failed", { error: error.message });
    throw new Error("Credit balance could not be loaded.");
  }

  return ((data ?? []) as CreditGrantRow[]).map(toGrantInput);
}

async function readPartnerMembershipRows(
  userId: string,
): Promise<CreditBalancePartnerMembershipInput[]> {
  const { data, error } = await supabaseAdmin
    .from("partner_memberships")
    .select(
      "id, partner_type, credit_source, allowance_credits, expires_at, status, activated_at, credit_grant_id, partners(name), credit_grants(remaining_credits, status, expires_at)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("activated_at", { ascending: false });

  if (error) {
    console.error("[credit-balance] read_partner_memberships_failed", { error: error.message });
    throw new Error("Partner allowance could not be loaded.");
  }

  return ((data ?? []) as PartnerMembershipQueryRow[]).map(toPartnerMembershipInput);
}

export async function getUserCreditBalanceSnapshot(userId: string): Promise<CreditBalanceSnapshot> {
  const [grants, partnerMemberships] = await Promise.all([
    readCreditGrantRows(userId),
    readPartnerMembershipRows(userId),
  ]);
  return deriveCreditBalanceSnapshot({
    grants,
    partner_memberships: partnerMemberships,
  });
}

export async function activatePartnerCodeForUser(input: {
  userId: string;
  rawCode: string;
  userEmail?: string | null;
}): Promise<CreditBalanceSnapshot> {
  let codeHash: string;
  try {
    codeHash = hashPartnerCode(input.rawCode);
  } catch (err) {
    throw new PartnerCodeActivationError(
      activationMessage(err instanceof Error ? err.message : undefined),
    );
  }

  const { error } = await supabaseAdmin.rpc("activate_partner_code", {
    p_user_id: input.userId,
    p_code_hash: codeHash,
    p_user_email: input.userEmail ?? undefined,
    p_activated_at: new Date().toISOString(),
    p_metadata: {
      source: "performer_credit_balance_ui",
      activation_surface: "credits",
    },
    p_idempotency_key: `partner-code-activation:${input.userId}:${codeHash}`,
  });

  if (error) {
    console.warn("[credit-balance] partner_code_activation_failed", {
      reason: error.message,
    });
    throw new PartnerCodeActivationError(activationMessage(error.message));
  }

  return getUserCreditBalanceSnapshot(input.userId);
}
