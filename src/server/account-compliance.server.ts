import {
  supabaseAdmin,
  SupabaseAdminRuntimeConfigError,
} from "@/integrations/supabase/client.server";
import {
  ACCOUNT_POLICY_VERSIONS,
  ACCOUNT_ROUTES,
  buildAccountComplianceRecord,
  isAccountComplianceComplete,
  type AccountComplianceRecord,
  type AccountRoute,
  type AccountRouteFormState,
} from "@/lib/account-compliance";
import { safeCutoverLog } from "@/server/cutover-diagnostics.server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boolValue(value: unknown): boolean {
  return value === true;
}

function metadataFromClaims(claims: unknown): Record<string, unknown> | null {
  if (!isRecord(claims)) return null;
  const userMetadata = claims.user_metadata;
  return isRecord(userMetadata) ? userMetadata : null;
}

function hasCurrentPolicyVersions(metadata: Record<string, unknown>): boolean {
  const policyVersions = metadata.policy_versions;
  if (!isRecord(policyVersions)) return false;
  return (
    stringValue(policyVersions.terms) === ACCOUNT_POLICY_VERSIONS.terms &&
    stringValue(policyVersions.privacy) === ACCOUNT_POLICY_VERSIONS.privacy &&
    stringValue(policyVersions.aiDisclaimer) === ACCOUNT_POLICY_VERSIONS.aiDisclaimer
  );
}

export function accountRouteFormStateFromAuthMetadata(
  metadata: unknown,
): AccountRouteFormState | null {
  if (!isRecord(metadata) || !hasCurrentPolicyVersions(metadata)) return null;
  const route = stringValue(metadata.account_route);
  if (!route || !ACCOUNT_ROUTES.includes(route as AccountRoute)) return null;
  const parentManaged = route === "parent_guardian" || route === "under_13";
  return {
    accountRoute: route as AccountRoute,
    parentGuardianAttested: parentManaged,
    termsAccepted: true,
    privacyAccepted: true,
    aiDisclaimerAccepted: true,
    marketingConsent: boolValue(metadata.marketing_consent),
  };
}

export async function upsertAccountComplianceForUser(input: {
  userId: string;
  state: AccountRouteFormState;
  operation?: string;
}): Promise<AccountComplianceRecord> {
  const record = buildAccountComplianceRecord(input.userId, input.state);

  try {
    const { error } = await supabaseAdmin
      .from("account_compliance")
      .upsert(record, { onConflict: "user_id" });

    if (error) {
      safeCutoverLog("error", "[account-compliance] upsert_failed", {
        operation: input.operation ?? "account_compliance_upsert",
        code: "account_compliance_write_failed",
        user_id: input.userId,
        table: "account_compliance",
        action: "upsert",
        error,
      });
      throw new Error(
        "ACCOUNT_COMPLIANCE_WRITE_FAILED: Account route could not be saved. Please try again.",
      );
    }
  } catch (error) {
    if (error instanceof SupabaseAdminRuntimeConfigError) {
      safeCutoverLog("error", "[account-compliance] server_supabase_misconfigured", {
        operation: input.operation ?? "account_compliance_upsert",
        code: "server_supabase_misconfigured",
        user_id: input.userId,
        table: "account_compliance",
        action: "upsert",
        error,
      });
      throw new Error(
        "SERVER_SUPABASE_MISCONFIGURED: Account route could not be saved because the server is not connected to Supabase.",
      );
    }
    throw error;
  }

  return record;
}

async function repairMissingAccountComplianceFromClaims(
  userId: string,
  claims: unknown,
): Promise<AccountComplianceRecord | null> {
  const state = accountRouteFormStateFromAuthMetadata(metadataFromClaims(claims));
  if (!state) return null;
  return upsertAccountComplianceForUser({
    userId,
    state,
    operation: "account_compliance_repair_from_auth_metadata",
  });
}

export async function assertAccountComplianceForReport(
  userId: string,
  claims?: unknown,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("account_compliance")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    safeCutoverLog("error", "[account-compliance] gate_lookup_failed", {
      operation: "account_compliance_gate_lookup",
      code: "account_compliance_lookup_failed",
      user_id: userId,
      table: "account_compliance",
      action: "select",
      error,
    });
    throw new Error("POLICY_ACCEPTANCE_REQUIRED: Complete account route before analysis.");
  }

  let row = data as AccountComplianceRecord | null;
  if (!row && claims) {
    row = await repairMissingAccountComplianceFromClaims(userId, claims);
  }

  if (!isAccountComplianceComplete(row)) {
    throw new Error(
      "POLICY_ACCEPTANCE_REQUIRED: Complete account route and required policy acceptance before uploading for analysis.",
    );
  }
}
