import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUserById: vi.fn(),
  getResolvedConfig: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: mocks.from,
    auth: {
      admin: {
        getUserById: mocks.getUserById,
      },
    },
  },
}));

vi.mock("@/server/app-config.server", () => ({
  getResolvedConfig: mocks.getResolvedConfig,
  SAFE_DEFAULTS: {
    quota_enabled: true,
    daily_submission_cap: 5,
    max_takes_per_audition: 3,
  },
}));

type BuilderResult = { count?: number | null; data?: unknown; error?: unknown };

// Thenable query builder: every chained method returns the builder, awaiting
// it resolves to the configured result. Mirrors the supabase-js fluent API
// closely enough for the chains used in quota.server.ts.
function makeBuilder(result: BuilderResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  for (const method of ["select", "eq", "gte", "gt", "in", "or", "order", "upsert", "single"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ count: null, data: null, error: null, ...result }).then(resolve, reject);
  return builder;
}

function tableRouter(builders: Record<string, ReturnType<typeof makeBuilder>>) {
  mocks.from.mockImplementation((table: string) => {
    const builder = builders[table];
    if (!builder) throw new Error(`unexpected table in test: ${table}`);
    return builder;
  });
}

const ADMIN_EMAIL = "o.halawi90@gmail.com";

describe("assertWithinAnalysisQuota (tier-aware)", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.getUserById.mockReset();
    mocks.getResolvedConfig.mockReset();
    mocks.getResolvedConfig.mockResolvedValue({
      quota_enabled: true,
      daily_submission_cap: 5,
      max_takes_per_audition: 3,
    });
  });

  it("bypasses entirely when quota is disabled (no DB or entitlement lookups)", async () => {
    const { assertWithinAnalysisQuota } = await import("@/server/quota.server");
    mocks.getResolvedConfig.mockResolvedValue({
      quota_enabled: false,
      daily_submission_cap: 5,
      max_takes_per_audition: 3,
    });

    await expect(
      assertWithinAnalysisQuota({ kind: "user", userId: "user-1" }, "test_op"),
    ).resolves.toBeUndefined();

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("exempts the admin entitlement without any takes count query and seeds the exemption row", async () => {
    const { assertWithinAnalysisQuota } = await import("@/server/quota.server");
    const exemptUpsert = makeBuilder({});
    tableRouter({ quota_exempt_users: exemptUpsert });

    await expect(
      assertWithinAnalysisQuota({ kind: "user", userId: "admin-user" }, "test_op", {
        email: ADMIN_EMAIL.toUpperCase(),
      }),
    ).resolves.toBeUndefined();

    // No daily count, no paid-grant lookup, no auth admin round-trip
    // (email came from verified claims).
    expect(mocks.from).not.toHaveBeenCalledWith("takes");
    expect(mocks.from).not.toHaveBeenCalledWith("credit_grants");
    expect(mocks.getUserById).not.toHaveBeenCalled();
    // DB-trigger-side exemption row reconciled idempotently.
    expect(mocks.from).toHaveBeenCalledWith("quota_exempt_users");
    expect(exemptUpsert.upsert).toHaveBeenCalledWith(
      { user_id: "admin-user", reason: "admin_test_account" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  });

  it("exempts a user with an active paid credit grant without a takes count query", async () => {
    const { assertWithinAnalysisQuota } = await import("@/server/quota.server");
    const grants = makeBuilder({ count: 1 });
    tableRouter({ credit_grants: grants });

    await expect(
      assertWithinAnalysisQuota({ kind: "user", userId: "paid-user" }, "test_op", {
        email: "performer@example.com",
      }),
    ).resolves.toBeUndefined();

    expect(mocks.from).toHaveBeenCalledWith("credit_grants");
    expect(mocks.from).not.toHaveBeenCalledWith("takes");
    // The paid set excludes free and admin-grant sources.
    expect(grants.in).toHaveBeenCalledWith("source", [
      "user_paid",
      "school_funded",
      "coach_funded",
      "agent_funded",
      "platform_funded",
      "sponsor_campaign",
    ]);
  });

  it("throws a 429 QuotaExceededError for a free user at the daily cap", async () => {
    const { assertWithinAnalysisQuota, QuotaExceededError } = await import("@/server/quota.server");
    tableRouter({
      credit_grants: makeBuilder({ count: 0 }),
      takes: makeBuilder({ count: 5 }),
    });

    const attempt = assertWithinAnalysisQuota({ kind: "user", userId: "free-user" }, "test_op", {
      email: "performer@example.com",
    });
    await expect(attempt).rejects.toBeInstanceOf(QuotaExceededError);
    await attempt.catch((err: InstanceType<typeof QuotaExceededError>) => {
      expect(err.status).toBe(429);
      expect(err.scope).toBe("user_daily");
      expect(err.cap).toBe(5);
      expect(err.count).toBe(5);
    });
  });

  it("lets a free user under the daily cap through", async () => {
    const { assertWithinAnalysisQuota } = await import("@/server/quota.server");
    tableRouter({
      credit_grants: makeBuilder({ count: 0 }),
      takes: makeBuilder({ count: 2 }),
    });

    await expect(
      assertWithinAnalysisQuota({ kind: "user", userId: "free-user" }, "test_op", {
        email: "performer@example.com",
      }),
    ).resolves.toBeUndefined();
  });

  it("fails CLOSED to the normal cap when the paid-grant lookup errors", async () => {
    const { assertWithinAnalysisQuota, QuotaExceededError } = await import("@/server/quota.server");
    tableRouter({
      credit_grants: makeBuilder({ error: { message: "boom" } }),
      takes: makeBuilder({ count: 5 }),
    });

    await expect(
      assertWithinAnalysisQuota({ kind: "user", userId: "free-user" }, "test_op", {
        email: "performer@example.com",
      }),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("keeps the anon lifetime cap unchanged (no config or entitlement involvement)", async () => {
    const { assertWithinAnalysisQuota, QuotaExceededError, ANON_LIFETIME_CAP } =
      await import("@/server/quota.server");
    tableRouter({ takes: makeBuilder({ count: ANON_LIFETIME_CAP }) });

    const attempt = assertWithinAnalysisQuota({ kind: "anon", anonId: "anon-1" }, "test_op");
    await expect(attempt).rejects.toBeInstanceOf(QuotaExceededError);
    await attempt.catch((err: InstanceType<typeof QuotaExceededError>) => {
      expect(err.scope).toBe("anon_lifetime");
      expect(err.cap).toBe(ANON_LIFETIME_CAP);
    });
    expect(mocks.getResolvedConfig).not.toHaveBeenCalled();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });
});

describe("reconcileAdminQuotaExemption", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.getUserById.mockReset();
  });

  it("refuses to seed a non-admin user", async () => {
    const { reconcileAdminQuotaExemption } = await import("@/server/quota-exemption.server");

    const result = await reconcileAdminQuotaExemption("normal-user", "performer@example.com");
    expect(result).toEqual({ ok: true, exempt: false, user_id: "normal-user" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("seeds the admin by UUID, resolving the email via the entitlement system", async () => {
    const { reconcileAdminQuotaExemption } = await import("@/server/quota-exemption.server");
    mocks.getUserById.mockResolvedValueOnce({
      data: { user: { email: ADMIN_EMAIL } },
      error: null,
    });
    const exemptUpsert = makeBuilder({});
    tableRouter({ quota_exempt_users: exemptUpsert });

    const result = await reconcileAdminQuotaExemption("admin-user");
    expect(result).toEqual({ ok: true, exempt: true, user_id: "admin-user" });
    expect(mocks.getUserById).toHaveBeenCalledWith("admin-user");
    expect(exemptUpsert.upsert).toHaveBeenCalledWith(
      { user_id: "admin-user", reason: "admin_test_account" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  });

  it("reports an upsert failure without throwing", async () => {
    const { reconcileAdminQuotaExemption } = await import("@/server/quota-exemption.server");
    mocks.getUserById.mockResolvedValueOnce({
      data: { user: { email: ADMIN_EMAIL } },
      error: null,
    });
    tableRouter({ quota_exempt_users: makeBuilder({ error: { message: "rls" } }) });

    const result = await reconcileAdminQuotaExemption("admin-user");
    expect(result).toEqual({ ok: false, error: "rls", user_id: "admin-user" });
  });
});
