import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_POLICY_VERSIONS } from "@/lib/account-compliance";

const maybeSingleMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() =>
  vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: maybeSingleMock,
      })),
    })),
    upsert: upsertMock,
  })),
);

// The runtime-env ALS helpers + Supabase resolver side-effects now live in this
// TanStack-free module (extracted from @/worker-entry); mock it to a null env.
vi.mock("@/server/runtime-env-als.server", () => ({
  getRequestEnv: () => null,
}));

vi.mock("@/integrations/supabase/client.server", () => {
  class SupabaseAdminRuntimeConfigError extends Error {}
  return {
    SupabaseAdminRuntimeConfigError,
    resolveSupabaseAdminRuntimeConfig: () => ({
      diagnostics: {
        supabase_url_configured: true,
        supabase_url_host: "owned.supabase.co",
        supabase_service_role_key_configured: true,
      },
    }),
    supabaseAdmin: {
      from: fromMock,
    },
  };
});

describe("account compliance cutover repair", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    upsertMock.mockReset();
    fromMock.mockClear();
    upsertMock.mockResolvedValue({ error: null });
  });

  it("derives a complete compliance form only from current auth metadata policy versions", async () => {
    const { accountRouteFormStateFromAuthMetadata } =
      await import("@/server/account-compliance.server");

    expect(
      accountRouteFormStateFromAuthMetadata({
        account_route: "self_service_13_plus",
        marketing_consent: true,
        policy_versions: ACCOUNT_POLICY_VERSIONS,
      }),
    ).toEqual({
      accountRoute: "self_service_13_plus",
      parentGuardianAttested: false,
      termsAccepted: true,
      privacyAccepted: true,
      aiDisclaimerAccepted: true,
      marketingConsent: true,
    });

    expect(
      accountRouteFormStateFromAuthMetadata({
        account_route: "self_service_13_plus",
        policy_versions: { ...ACCOUNT_POLICY_VERSIONS, terms: "old" },
      }),
    ).toBeNull();
  });

  it("upserts account_compliance for the authenticated user", async () => {
    const { upsertAccountComplianceForUser } = await import("@/server/account-compliance.server");

    const record = await upsertAccountComplianceForUser({
      userId: "user-1",
      state: {
        accountRoute: "self_service_13_plus",
        parentGuardianAttested: false,
        termsAccepted: true,
        privacyAccepted: true,
        aiDisclaimerAccepted: true,
        marketingConsent: false,
      },
    });

    expect(fromMock).toHaveBeenCalledWith("account_compliance");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        account_route: "self_service_13_plus",
        terms_version: ACCOUNT_POLICY_VERSIONS.terms,
      }),
      { onConflict: "user_id" },
    );
    expect(record.user_id).toBe("user-1");
  });

  it("repairs a missing account_compliance row from authenticated metadata", async () => {
    const { assertAccountComplianceForReport } = await import("@/server/account-compliance.server");
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      assertAccountComplianceForReport("user-1", {
        user_metadata: {
          account_route: "self_service_13_plus",
          policy_versions: ACCOUNT_POLICY_VERSIONS,
          marketing_consent: false,
        },
      }),
    ).resolves.toBeUndefined();

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1" }), {
      onConflict: "user_id",
    });
  });
});
