import { describe, expect, it } from "vitest";
import {
  buildAccountComplianceRecord,
  defaultAccountRouteFormState,
  isAccountComplianceComplete,
  validateAccountRouteFormState,
} from "@/lib/account-compliance";

describe("account compliance", () => {
  it("requires all policy acceptances", () => {
    expect(validateAccountRouteFormState(defaultAccountRouteFormState)).toMatch(
      /Terms, Privacy Policy and AI report disclaimer/,
    );
  });

  it("stores a self-service 13+ route without DOB or parent attestation", () => {
    const record = buildAccountComplianceRecord(
      "user-1",
      {
        ...defaultAccountRouteFormState,
        termsAccepted: true,
        privacyAccepted: true,
        aiDisclaimerAccepted: true,
      },
      "2026-05-27T10:00:00.000Z",
    );

    expect(record.account_route).toBe("self_service_13_plus");
    expect(record.age_band_declaration).toBe("13_plus");
    expect(record.parent_managed).toBe(false);
    expect(record.parent_guardian_attested_at).toBeNull();
    expect(JSON.stringify(record)).not.toMatch(/dob|birth|passport|id_verification/i);
    expect(isAccountComplianceComplete(record)).toBe(true);
  });

  it("blocks under-13 standalone continuation without parent attestation", () => {
    expect(
      validateAccountRouteFormState({
        ...defaultAccountRouteFormState,
        accountRoute: "under_13",
        termsAccepted: true,
        privacyAccepted: true,
        aiDisclaimerAccepted: true,
      }),
    ).toMatch(/Parent\/guardian attestation/);
  });

  it("stores under-13 use as parent-managed with attestation", () => {
    const record = buildAccountComplianceRecord(
      "user-1",
      {
        ...defaultAccountRouteFormState,
        accountRoute: "under_13",
        parentGuardianAttested: true,
        termsAccepted: true,
        privacyAccepted: true,
        aiDisclaimerAccepted: true,
      },
      "2026-05-27T10:00:00.000Z",
    );

    expect(record.account_type).toBe("parent_guardian_managed");
    expect(record.age_band_declaration).toBe("under_13");
    expect(record.parent_managed).toBe(true);
    expect(record.parent_guardian_attested).toBe(true);
    expect(isAccountComplianceComplete(record)).toBe(true);
  });
});
