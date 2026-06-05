import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUserById: vi.fn(),
  getResolvedConfig: vi.fn(),
  grantFundedCredits: vi.fn(),
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
    future_evidence_enabled: false,
    future_report_enabled: false,
    future_qa_trace_enabled: false,
    free_monthly_includes_funded_users: true,
  },
}));

vi.mock("@/server/credit-ledger.server", () => ({
  grantFundedCredits: mocks.grantFundedCredits,
}));

type GrantRow = {
  source: string;
  status: string;
  remaining_credits: number;
  expires_at: string | null;
  granted_at: string;
};

function grantsTable(rows: GrantRow[], error: unknown = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  for (const method of ["select", "eq"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: error ? null : rows, error }).then(resolve, reject);
  mocks.from.mockImplementation((table: string) => {
    if (table !== "credit_grants") throw new Error(`unexpected table in test: ${table}`);
    return builder;
  });
  return builder;
}

const ADMIN_EMAIL = "o.halawi90@gmail.com";
const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();
const daysAhead = (n: number) => new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

const SIGNUP_ROW: GrantRow = {
  source: "free_signup",
  status: "exhausted",
  remaining_credits: 0,
  expires_at: null,
  granted_at: daysAgo(200),
};

function configWithToggle(includeFunded: boolean) {
  mocks.getResolvedConfig.mockResolvedValue({
    quota_enabled: false,
    daily_submission_cap: 5,
    max_takes_per_audition: 3,
    future_evidence_enabled: false,
    future_report_enabled: false,
    future_qa_trace_enabled: false,
    free_monthly_includes_funded_users: includeFunded,
    source: "config",
  });
}

async function reconcile(userId: string, email: string | null = "performer@example.com") {
  const { reconcileFreeCreditsForUser } = await import("@/server/free-credit-issuance.server");
  return reconcileFreeCreditsForUser(userId, { email });
}

describe("reconcileFreeCreditsForUser", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.getUserById.mockReset();
    mocks.getResolvedConfig.mockReset();
    mocks.grantFundedCredits.mockReset();
    mocks.grantFundedCredits.mockResolvedValue({ credit_grant_id: "grant-1" });
    configWithToggle(true);
  });

  it("grants exactly one free_signup credit to a fresh user (stable idempotency key)", async () => {
    grantsTable([]);
    const result = await reconcile("user-fresh-1");
    expect(result.signup_granted).toBe(true);
    expect(mocks.grantFundedCredits).toHaveBeenCalledWith({
      user_id: "user-fresh-1",
      source: "free_signup",
      credit_amount: 1,
      idempotency_key: "free_signup:user-fresh-1",
    });
  });

  it("never re-grants free_signup when any row exists, even exhausted", async () => {
    grantsTable([SIGNUP_ROW]);
    const result = await reconcile("user-existing-1");
    expect(result.signup_granted).toBe(false);
    const signupCalls = mocks.grantFundedCredits.mock.calls.filter(
      (c) => c[0].source === "free_signup",
    );
    expect(signupCalls).toHaveLength(0);
  });

  it("grants free_monthly with a UTC calendar-month idempotency key when eligible", async () => {
    grantsTable([SIGNUP_ROW]);
    const result = await reconcile("user-monthly-1");
    expect(result.monthly_granted).toBe(true);
    const now = new Date();
    const key = `free_monthly:user-monthly-1:${now.getUTCFullYear()}-${`${now.getUTCMonth() + 1}`.padStart(2, "0")}`;
    expect(mocks.grantFundedCredits).toHaveBeenCalledWith({
      user_id: "user-monthly-1",
      source: "free_monthly",
      credit_amount: 1,
      idempotency_key: key,
    });
    // Expiry/rollover are applied by the RPC; the caller must not set them.
    const monthlyCall = mocks.grantFundedCredits.mock.calls.find(
      (c) => c[0].source === "free_monthly",
    );
    expect(monthlyCall?.[0]).not.toHaveProperty("expires_at");
  });

  it("refuses a second free_monthly inside the rolling 31-day window", async () => {
    grantsTable([
      SIGNUP_ROW,
      {
        source: "free_monthly",
        status: "exhausted",
        remaining_credits: 0,
        expires_at: daysAhead(1),
        granted_at: daysAgo(30),
      },
    ]);
    const result = await reconcile("user-monthly-2");
    expect(result.monthly_granted).toBe(false);
  });

  it("grants free_monthly again once the last grant is older than 31 days", async () => {
    grantsTable([
      SIGNUP_ROW,
      {
        source: "free_monthly",
        status: "active",
        remaining_credits: 1,
        expires_at: daysAgo(1),
        granted_at: daysAgo(32),
      },
    ]);
    const result = await reconcile("user-monthly-3");
    expect(result.monthly_granted).toBe(true);
  });

  it("toggle FALSE: an ACTIVE funded credit suppresses the monthly grant", async () => {
    configWithToggle(false);
    grantsTable([
      SIGNUP_ROW,
      {
        source: "school_funded",
        status: "active",
        remaining_credits: 3,
        expires_at: daysAhead(20),
        granted_at: daysAgo(5),
      },
    ]);
    const result = await reconcile("user-funded-1");
    expect(result.monthly_granted).toBe(false);
  });

  it("toggle FALSE: an EXPIRED funded grant still marked status=active does NOT suppress (status is not time-swept)", async () => {
    configWithToggle(false);
    grantsTable([
      SIGNUP_ROW,
      {
        source: "coach_funded",
        status: "active",
        remaining_credits: 2,
        expires_at: daysAgo(3),
        granted_at: daysAgo(60),
      },
    ]);
    const result = await reconcile("user-funded-2");
    expect(result.monthly_granted).toBe(true);
  });

  it("toggle FALSE: an exhausted funded grant does not suppress", async () => {
    configWithToggle(false);
    grantsTable([
      SIGNUP_ROW,
      {
        source: "user_paid",
        status: "exhausted",
        remaining_credits: 0,
        expires_at: null,
        granted_at: daysAgo(10),
      },
    ]);
    const result = await reconcile("user-funded-3");
    expect(result.monthly_granted).toBe(true);
  });

  it("toggle FALSE: admin_grant / free sources never count as funded suppression", async () => {
    configWithToggle(false);
    grantsTable([
      SIGNUP_ROW,
      {
        source: "admin_grant",
        status: "active",
        remaining_credits: 5,
        expires_at: null,
        granted_at: daysAgo(2),
      },
    ]);
    const result = await reconcile("user-funded-4");
    expect(result.monthly_granted).toBe(true);
  });

  it("toggle TRUE: a funded/paying user still receives the monthly credit", async () => {
    configWithToggle(true);
    grantsTable([
      SIGNUP_ROW,
      {
        source: "user_paid",
        status: "active",
        remaining_credits: 10,
        expires_at: null,
        granted_at: daysAgo(2),
      },
    ]);
    const result = await reconcile("user-funded-5");
    expect(result.monthly_granted).toBe(true);
  });

  it("skips the admin entitlement entirely (no reads, no grants)", async () => {
    grantsTable([]);
    const result = await reconcile("admin-user", ADMIN_EMAIL.toUpperCase());
    expect(result).toEqual({ ok: true, signup_granted: false, monthly_granted: false });
    expect(mocks.grantFundedCredits).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("downgrades an idempotency-race duplicate-key failure without throwing", async () => {
    grantsTable([]);
    mocks.grantFundedCredits.mockRejectedValue(
      new Error(
        'duplicate key value violates unique constraint "credit_ledger_entries_idempotency_key_idx"',
      ),
    );
    const result = await reconcile("user-race-1");
    expect(result.ok).toBe(true);
    expect(result.signup_granted).toBe(false);
  });

  it("never throws when the grants read fails", async () => {
    grantsTable([], { message: "boom" });
    const result = await reconcile("user-err-1");
    expect(result.ok).toBe(false);
    expect(mocks.grantFundedCredits).not.toHaveBeenCalled();
  });

  it("pins the funded suppression set to the six ADR-0005 paid sources", async () => {
    const { FUNDED_MONTHLY_SUPPRESSION_SOURCES } =
      await import("@/server/free-credit-issuance.server");
    expect([...FUNDED_MONTHLY_SUPPRESSION_SOURCES]).toEqual([
      "user_paid",
      "school_funded",
      "coach_funded",
      "agent_funded",
      "platform_funded",
      "sponsor_campaign",
    ]);
    expect(FUNDED_MONTHLY_SUPPRESSION_SOURCES).not.toContain("free_signup");
    expect(FUNDED_MONTHLY_SUPPRESSION_SOURCES).not.toContain("free_monthly");
    expect(FUNDED_MONTHLY_SUPPRESSION_SOURCES).not.toContain("admin_grant");
  });
});

describe("free-credit issuance wiring", () => {
  it("hooks the dashboard balance fn and the reservation choke point (null-guarded)", async () => {
    const balanceSource = await readFile(
      path.join(process.cwd(), "src/server-fns/credit-balance.functions.ts"),
      "utf8",
    );
    const ledgerSource = await readFile(
      path.join(process.cwd(), "src/server/credit-ledger.server.ts"),
      "utf8",
    );
    const endpointSource = await readFile(
      path.join(process.cwd(), "src/routes/api/public/free-credit-reconcile.ts"),
      "utf8",
    );

    expect(balanceSource).toContain("reconcileFreeCreditsForUser(context.userId");
    // Reservation hook must be guarded on a resolved user id and reuse the
    // already-resolved entitlement.
    expect(ledgerSource).toMatch(
      /if \(entitlementUserId\) \{[\s\S]*?reconcileFreeCreditsForUser\(entitlementUserId, \{[\s\S]*?entitlement,/,
    );
    // The batch endpoint selects DUE candidates via the service-role helper.
    expect(endpointSource).toContain('rpc("list_free_credit_due_users"');
    expect(endpointSource).toContain("x-reconciler-secret");
  });
});
