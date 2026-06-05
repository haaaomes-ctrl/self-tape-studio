import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: mocks.rpc,
    from: mocks.from,
    auth: {
      admin: {
        getUserById: mocks.getUserById,
      },
    },
  },
}));

function fromMaybeSingle(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn(async () => ({ data, error }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(full)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("admin unlimited credit entitlement", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.getUserById.mockReset();
  });

  it("normalises the admin email case-insensitively", async () => {
    const { resolveCreditEntitlementFromEmail } =
      await import("@/server/credit-entitlement.server");

    expect(
      resolveCreditEntitlementFromEmail({
        userId: "admin-user",
        email: "  O.HALAWI90@GMAIL.COM ",
      }),
    ).toMatchObject({
      user_id: "admin-user",
      credit_mode: "unlimited_admin",
      canAnalyse: true,
      requiresCreditReservation: false,
      shouldDecrementCredit: false,
      reason: "admin_test_account",
    });
  });

  it("does not grant unauthenticated or non-admin users the override", async () => {
    const { resolveCreditEntitlementFromEmail } =
      await import("@/server/credit-entitlement.server");

    expect(resolveCreditEntitlementFromEmail({ userId: null, email: null })).toMatchObject({
      credit_mode: "standard",
      requiresCreditReservation: true,
      shouldDecrementCredit: true,
    });
    expect(
      resolveCreditEntitlementFromEmail({
        userId: "normal-user",
        email: "performer@example.com",
      }),
    ).toMatchObject({
      credit_mode: "standard",
      requiresCreditReservation: true,
      shouldDecrementCredit: true,
    });
  });

  it("lets the admin start analysis with zero credits without reserving a credit", async () => {
    const { reserveReportCreditForTake } = await import("@/server/credit-ledger.server");

    const result = await reserveReportCreditForTake({
      take_id: "take-admin-zero-credit",
      requested_by_user_id: "admin-user",
      requested_by_user_email: "O.HALAWI90@GMAIL.COM",
      metadata: { trigger: "create_mux_direct_upload" },
    });

    expect(result).toEqual({
      credit_reservation_id: null,
      synthetic_usage: false,
      credit_mode: "unlimited_admin",
      requires_credit_reservation: false,
      should_decrement_credit: false,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("allows external-worker dispatch gates to resolve admin entitlement from the take owner", async () => {
    const { reserveReportCreditForTake } = await import("@/server/credit-ledger.server");
    mocks.from.mockReturnValueOnce(fromMaybeSingle({ user_id: "admin-user" }));
    mocks.getUserById.mockResolvedValueOnce({
      data: { user: { email: "o.halawi90@gmail.com" } },
      error: null,
    });

    const result = await reserveReportCreditForTake({
      take_id: "take-admin-webhook",
      metadata: { trigger: "mux_webhook_asset_ready" },
    });

    expect(result.credit_mode).toBe("unlimited_admin");
    expect(result.requires_credit_reservation).toBe(false);
    expect(result.should_decrement_credit).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps normal users with zero credits blocked by the existing credit lifecycle", async () => {
    const { ReportCreditRequiredError, reserveReportCreditForTake } =
      await import("@/server/credit-ledger.server");
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "CREDIT_REQUIRED: You need 1 TapeCoach credit to generate a self-tape report.",
      },
    });

    await expect(
      reserveReportCreditForTake({
        take_id: "take-normal-zero-credit",
        requested_by_user_id: "normal-user",
        requested_by_user_email: "performer@example.com",
      }),
    ).rejects.toBeInstanceOf(ReportCreditRequiredError);
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_report_credit_for_take", expect.any(Object));
  });

  it("keeps normal reserve and consume behaviour unchanged for funded users", async () => {
    const { consumeReportCreditReservation, reserveReportCreditForTake } =
      await import("@/server/credit-ledger.server");
    mocks.rpc
      .mockResolvedValueOnce({ data: "reservation-1", error: null })
      .mockResolvedValueOnce({ data: "ledger-entry-1", error: null });
    mocks.from.mockReturnValueOnce(fromMaybeSingle({ synthetic_usage: false }));

    await expect(
      reserveReportCreditForTake({
        take_id: "take-normal-funded",
        requested_by_user_id: "normal-user",
        requested_by_user_email: "performer@example.com",
      }),
    ).resolves.toEqual({
      credit_reservation_id: "reservation-1",
      synthetic_usage: false,
      credit_mode: "standard",
      requires_credit_reservation: true,
      should_decrement_credit: true,
    });

    await expect(
      consumeReportCreditReservation({
        credit_reservation_id: "reservation-1",
        take_id: "take-normal-funded",
      }),
    ).resolves.toEqual({ credit_ledger_entry_id: "ledger-entry-1" });

    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "reserve_report_credit_for_take",
      expect.any(Object),
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      "consume_report_credit_reservation",
      expect.any(Object),
    );
  });

  it("wires upload, retry and runProcessTake through the entitlement-aware resolver", async () => {
    const muxSource = await readFile(
      path.join(process.cwd(), "src/server-fns/mux.functions.ts"),
      "utf8",
    );
    const retrySource = await readFile(
      path.join(process.cwd(), "src/server-fns/process-take.functions.ts"),
      "utf8",
    );
    const processTakeSource = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    const muxWebhookSource = await readFile(
      path.join(process.cwd(), "src/routes/api/public/mux-webhook.ts"),
      "utf8",
    );

    expect(muxSource).toContain("requested_by_user_email");
    expect(muxSource).toContain("reservation.requires_credit_reservation");
    expect(retrySource).toContain("requested_by_user_email");
    expect(retrySource).toContain("reservation.requires_credit_reservation");
    expect(muxWebhookSource).toContain("reservation.requires_credit_reservation");
    expect(processTakeSource).toContain("activeReportCreditShouldDecrement");
    expect(processTakeSource).toContain("report_credit_consume_skipped");
    expect(processTakeSource).toContain("consumeReportCreditReservation");
  });

  it("wires the daily quota gate through the entitlement-aware resolver", async () => {
    const quotaSource = await readFile(
      path.join(process.cwd(), "src/server/quota.server.ts"),
      "utf8",
    );
    const muxUploadSource = await readFile(
      path.join(process.cwd(), "src/server-fns/mux-upload.impl.server.ts"),
      "utf8",
    );
    const retrySource = await readFile(
      path.join(process.cwd(), "src/server-fns/process-take.functions.ts"),
      "utf8",
    );

    // The gate resolves admin entitlement and the paid-grant exemption.
    expect(quotaSource).toContain("resolveCreditEntitlementForUser");
    expect(quotaSource).toContain("isUnlimitedAdminCreditEntitlement");
    expect(quotaSource).toContain("ensureAdminQuotaExemptionRow");
    expect(quotaSource).toContain("PAID_QUOTA_EXEMPT_CREDIT_SOURCES");
    // Free tiers and admin_grant must never appear in the paid-exempt set.
    expect(quotaSource).not.toContain('"free_signup"');
    expect(quotaSource).not.toContain('"free_monthly"');
    expect(quotaSource).not.toContain('"admin_grant"');

    // Both call sites thread the verified-claims email into the gate so the
    // admin path needs no extra auth admin round-trip.
    expect(muxUploadSource).toMatch(
      /assertWithinAnalysisQuota\([^;]*\{\s*email: claimEmail\(claims\),?\s*\}/,
    );
    expect(retrySource).toMatch(
      /assertWithinAnalysisQuota\([^;]*\{ email: claimEmail\(context\.claims\) \}/,
    );
  });

  it("does not import the server-only entitlement helper from client or public code", async () => {
    const checkedDirs = ["src/routes", "src/components", "src/lib", "src/server-fns"];
    const offenders: string[] = [];

    for (const dir of checkedDirs) {
      const files = await listSourceFiles(path.join(process.cwd(), dir));
      for (const file of files) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        const source = await readFile(file, "utf8");
        if (source.includes("credit-entitlement.server")) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
