import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_POLICY_VERSIONS } from "@/lib/account-compliance";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => {
  class SupabaseAdminRuntimeConfigError extends Error {}
  return {
    SupabaseAdminRuntimeConfigError,
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table !== "account_compliance") throw new Error(`unexpected table: ${table}`);
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })),
          })),
          upsert: mocks.upsert,
        };
      }),
    },
  };
});

vi.mock("@/server/cutover-diagnostics.server", () => ({
  safeCutoverLog: vi.fn(),
}));

const CURRENT_METADATA = {
  policy_versions: {
    terms: ACCOUNT_POLICY_VERSIONS.terms,
    privacy: ACCOUNT_POLICY_VERSIONS.privacy,
    aiDisclaimer: ACCOUNT_POLICY_VERSIONS.aiDisclaimer,
  },
  account_route: "self_service_13_plus",
  age_band_declaration: "13_plus",
  parent_managed: false,
  marketing_consent: true,
};

const claimsWith = (userMetadata: unknown) => ({ sub: "user-1", user_metadata: userMetadata });

const EXISTING_ROW = { user_id: "user-1", account_route: "self_service_13_plus" };

describe("getAccountComplianceForUser (self-healing read)", () => {
  beforeEach(() => {
    mocks.maybeSingle.mockReset();
    mocks.upsert.mockReset();
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it("returns an existing row untouched — no repair, even with claims present", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: EXISTING_ROW, error: null });
    const { getAccountComplianceForUser } = await import("@/server/account-compliance.server");

    const row = await getAccountComplianceForUser("user-1", claimsWith(CURRENT_METADATA));
    expect(row).toEqual(EXISTING_ROW);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("repairs a MISSING row from current-version metadata claims (idempotent upsert)", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { getAccountComplianceForUser } = await import("@/server/account-compliance.server");

    const row = await getAccountComplianceForUser("user-1", claimsWith(CURRENT_METADATA));
    expect(row).toMatchObject({
      user_id: "user-1",
      account_route: "self_service_13_plus",
      terms_version: ACCOUNT_POLICY_VERSIONS.terms,
      marketing_consent: true,
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    // Concurrent-safe: conflict target is the user_id primary key, so a
    // simultaneous dashboard-load + upload-time repair cannot error.
    expect(mocks.upsert.mock.calls[0][1]).toEqual({ onConflict: "user_id" });
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ user_id: "user-1" });
  });

  it("declines to repair when metadata policy versions are STALE — re-prompt stands", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { getAccountComplianceForUser } = await import("@/server/account-compliance.server");

    const stale = {
      ...CURRENT_METADATA,
      policy_versions: { terms: "1999-01-01", privacy: "1999-01-01", aiDisclaimer: "1999-01-01" },
    };
    const row = await getAccountComplianceForUser("user-1", claimsWith(stale));
    expect(row).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("returns null without repair when no claims metadata is available", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { getAccountComplianceForUser } = await import("@/server/account-compliance.server");

    expect(await getAccountComplianceForUser("user-1")).toBeNull();
    expect(await getAccountComplianceForUser("user-1", claimsWith(null))).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("fails soft (null) when the lookup errors", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { getAccountComplianceForUser } = await import("@/server/account-compliance.server");

    const row = await getAccountComplianceForUser("user-1", claimsWith(CURRENT_METADATA));
    expect(row).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("self-heal wiring", () => {
  it("server fn is self-scoped to the caller and the hook uses it instead of a direct table read", async () => {
    const fnSource = await readFile(
      path.join(process.cwd(), "src/server-fns/account-compliance.functions.ts"),
      "utf8",
    );
    const clientSource = await readFile(
      path.join(process.cwd(), "src/lib/account-compliance-client.ts"),
      "utf8",
    );
    const serverSource = await readFile(
      path.join(process.cwd(), "src/server/account-compliance.server.ts"),
      "utf8",
    );

    // Self-scoped: the GET fn takes NO input and resolves identity solely
    // from the session middleware.
    expect(fnSource).toMatch(
      /getCurrentUserAccountCompliance = createServerFn\(\{ method: "GET" \}\)\s*\n\s*\.middleware\(\[attachSupabaseAuth, requireSupabaseAuth\]\)\s*\n\s*\.handler/,
    );
    expect(fnSource).toContain("getAccountComplianceForUser(context.userId, context.claims)");

    // Hook reads via the self-healing server fn, not a direct client query.
    expect(clientSource).toContain("getCurrentUserAccountCompliance()");
    expect(clientSource).not.toContain('from("account_compliance")');

    // Defence in depth: the upload-time repair call stays in place.
    expect(serverSource).toMatch(
      /assertAccountComplianceForReport[\s\S]*?repairMissingAccountComplianceFromClaims\(userId, claims\)/,
    );
  });
});
