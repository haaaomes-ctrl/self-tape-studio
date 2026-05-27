export const ACCOUNT_POLICY_VERSIONS = {
  terms: "terms-2026-05-27",
  privacy: "privacy-2026-05-27",
  aiDisclaimer: "ai-disclaimer-2026-05-27",
} as const;

export const ACCOUNT_ROUTES = ["self_service_13_plus", "parent_guardian", "under_13"] as const;

export type AccountRoute = (typeof ACCOUNT_ROUTES)[number];

export type AccountType = "self_service_performer" | "parent_guardian_managed";
export type AgeBandDeclaration = "13_plus" | "parent_guardian" | "under_13";

export interface AccountRouteFormState {
  accountRoute: AccountRoute;
  parentGuardianAttested: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  aiDisclaimerAccepted: boolean;
  marketingConsent: boolean;
}

export interface AccountComplianceRecord {
  user_id: string;
  account_route: AccountRoute;
  account_type: AccountType;
  age_band_declaration: AgeBandDeclaration;
  parent_managed: boolean;
  parent_guardian_attested: boolean;
  parent_guardian_attested_at: string | null;
  terms_version: string;
  terms_accepted_at: string;
  privacy_version: string;
  privacy_accepted_at: string;
  ai_disclaimer_version: string;
  ai_disclaimer_accepted_at: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
}

export const defaultAccountRouteFormState: AccountRouteFormState = {
  accountRoute: "self_service_13_plus",
  parentGuardianAttested: false,
  termsAccepted: false,
  privacyAccepted: false,
  aiDisclaimerAccepted: false,
  marketingConsent: false,
};

export function isParentManagedRoute(route: AccountRoute): boolean {
  return route === "parent_guardian" || route === "under_13";
}

export function getAccountType(route: AccountRoute): AccountType {
  return isParentManagedRoute(route) ? "parent_guardian_managed" : "self_service_performer";
}

export function getAgeBandDeclaration(route: AccountRoute): AgeBandDeclaration {
  if (route === "under_13") return "under_13";
  if (route === "parent_guardian") return "parent_guardian";
  return "13_plus";
}

export function validateAccountRouteFormState(state: AccountRouteFormState): string | null {
  if (!state.termsAccepted || !state.privacyAccepted || !state.aiDisclaimerAccepted) {
    return "Accept the required Terms, Privacy Policy and AI report disclaimer before continuing.";
  }
  if (isParentManagedRoute(state.accountRoute) && !state.parentGuardianAttested) {
    return "Parent/guardian attestation is required for this account route.";
  }
  return null;
}

export function buildAccountComplianceRecord(
  userId: string,
  state: AccountRouteFormState,
  acceptedAt = new Date().toISOString(),
): AccountComplianceRecord {
  const validationError = validateAccountRouteFormState(state);
  if (validationError) throw new Error(validationError);

  const parentManaged = isParentManagedRoute(state.accountRoute);

  return {
    user_id: userId,
    account_route: state.accountRoute,
    account_type: getAccountType(state.accountRoute),
    age_band_declaration: getAgeBandDeclaration(state.accountRoute),
    parent_managed: parentManaged,
    parent_guardian_attested: parentManaged,
    parent_guardian_attested_at: parentManaged ? acceptedAt : null,
    terms_version: ACCOUNT_POLICY_VERSIONS.terms,
    terms_accepted_at: acceptedAt,
    privacy_version: ACCOUNT_POLICY_VERSIONS.privacy,
    privacy_accepted_at: acceptedAt,
    ai_disclaimer_version: ACCOUNT_POLICY_VERSIONS.aiDisclaimer,
    ai_disclaimer_accepted_at: acceptedAt,
    marketing_consent: state.marketingConsent,
    marketing_consent_at: state.marketingConsent ? acceptedAt : null,
  };
}

export function buildAccountComplianceAuthMetadata(state: AccountRouteFormState) {
  return {
    account_route: state.accountRoute,
    account_type: getAccountType(state.accountRoute),
    age_band_declaration: getAgeBandDeclaration(state.accountRoute),
    parent_managed: isParentManagedRoute(state.accountRoute),
    policy_versions: ACCOUNT_POLICY_VERSIONS,
    marketing_consent: state.marketingConsent,
  };
}

export function isAccountComplianceComplete(
  row: Partial<AccountComplianceRecord> | null | undefined,
): boolean {
  if (!row) return false;
  if (!ACCOUNT_ROUTES.includes(row.account_route as AccountRoute)) return false;
  if (row.terms_version !== ACCOUNT_POLICY_VERSIONS.terms || !row.terms_accepted_at) return false;
  if (row.privacy_version !== ACCOUNT_POLICY_VERSIONS.privacy || !row.privacy_accepted_at)
    return false;
  if (
    row.ai_disclaimer_version !== ACCOUNT_POLICY_VERSIONS.aiDisclaimer ||
    !row.ai_disclaimer_accepted_at
  ) {
    return false;
  }

  if (isParentManagedRoute(row.account_route as AccountRoute)) {
    return (
      row.account_type === "parent_guardian_managed" &&
      row.parent_managed === true &&
      row.parent_guardian_attested === true &&
      Boolean(row.parent_guardian_attested_at)
    );
  }

  return (
    row.account_type === "self_service_performer" &&
    row.age_band_declaration === "13_plus" &&
    row.parent_managed === false &&
    row.parent_guardian_attested === false
  );
}
