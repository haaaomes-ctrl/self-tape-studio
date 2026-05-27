import { describe, expect, it } from "vitest";
import {
  allocateCreditsForConsumption,
  buildAdminAdjustmentEntry,
  buildCreditGrantDraft,
  CREDIT_SOURCES,
  formatReportCreditRequiredError,
  FREE_MONTHLY_CREDIT_VALIDITY_DAYS,
  REPORT_CREDIT_AMOUNT,
  REPORT_CREDIT_REPLACEMENT_COPY,
  REPORT_CREDIT_REQUIRED_MESSAGE,
  REPORT_CREDIT_RESERVATION_STATUSES,
  REPORT_CREDIT_RESTORED_MESSAGE,
  resolveCreditGrantPolicy,
  resolveReportCreditTerminalAction,
  reportCreditLifecycleStatusFor,
  summariseCreditEntriesBySource,
} from "@/lib/credit-ledger";

describe("credit ledger foundation", () => {
  it("defines every S10.1 DS-04 credit source", () => {
    expect(CREDIT_SOURCES).toEqual([
      "free_signup",
      "free_monthly",
      "school_funded",
      "coach_funded",
      "agent_funded",
      "platform_funded",
      "sponsor_campaign",
      "user_paid",
      "admin_grant",
    ]);
  });

  it("makes free monthly credits no-rollover and valid for 31 days", () => {
    const grantedAt = "2026-05-01T10:00:00.000Z";
    const policy = resolveCreditGrantPolicy("free_monthly", grantedAt);

    expect(policy.rollover_policy).toBe("no_rollover");
    expect(policy.expires_at).toBe("2026-06-01T10:00:00.000Z");
    expect(FREE_MONTHLY_CREDIT_VALIDITY_DAYS).toBe(31);
  });

  it("makes user-paid credits roll over without an expiry", () => {
    const policy = resolveCreditGrantPolicy("user_paid", "2026-05-01T10:00:00.000Z", null);

    expect(policy.rollover_policy).toBe("rollover");
    expect(policy.expires_at).toBeNull();
  });

  it("builds funded grant drafts with source attribution", () => {
    expect(
      buildCreditGrantDraft({
        user_id: "user-1",
        source: "school_funded",
        credit_amount: 12,
        granted_at: "2026-05-01T10:00:00.000Z",
        expires_at: "2026-08-01T10:00:00.000Z",
        source_reference_type: "partner_membership",
        source_reference_id: "membership-1",
        source_label: "MT college pilot",
      }),
    ).toMatchObject({
      user_id: "user-1",
      source: "school_funded",
      original_credits: 12,
      remaining_credits: 12,
      rollover_policy: "funding_period",
      expires_at: "2026-08-01T10:00:00.000Z",
      source_reference_type: "partner_membership",
      source_reference_id: "membership-1",
      source_label: "MT college pilot",
    });
  });

  it("allocates consumption from earliest-expiring funded credits first", () => {
    expect(
      allocateCreditsForConsumption(
        [
          {
            id: "paid",
            source: "user_paid",
            remaining_credits: 10,
            expires_at: null,
            granted_at: "2026-05-01T10:00:00.000Z",
            status: "active",
          },
          {
            id: "monthly",
            source: "free_monthly",
            remaining_credits: 1,
            expires_at: "2026-05-20T10:00:00.000Z",
            granted_at: "2026-05-01T10:00:00.000Z",
            status: "active",
          },
          {
            id: "school",
            source: "school_funded",
            remaining_credits: 2,
            expires_at: "2026-06-01T10:00:00.000Z",
            granted_at: "2026-05-02T10:00:00.000Z",
            status: "active",
          },
        ],
        3,
        "2026-05-10T10:00:00.000Z",
      ),
    ).toEqual([
      {
        credit_grant_id: "monthly",
        source: "free_monthly",
        credit_delta: -1,
        expires_at: "2026-05-20T10:00:00.000Z",
      },
      {
        credit_grant_id: "school",
        source: "school_funded",
        credit_delta: -2,
        expires_at: "2026-06-01T10:00:00.000Z",
      },
    ]);
  });

  it("fails closed when consumption does not have enough active funded credits", () => {
    expect(() =>
      allocateCreditsForConsumption(
        [
          {
            id: "expired",
            source: "free_monthly",
            remaining_credits: 1,
            expires_at: "2026-05-01T10:00:00.000Z",
            granted_at: "2026-04-01T10:00:00.000Z",
            status: "active",
          },
        ],
        1,
        "2026-05-10T10:00:00.000Z",
      ),
    ).toThrow(/insufficient funded credits/i);
  });

  it("records admin adjustments as ledger entries instead of generic filler credits", () => {
    expect(
      buildAdminAdjustmentEntry({
        user_id: "user-1",
        source: "admin_grant",
        credit_delta: -1,
        admin_actor_user_id: "admin-1",
        admin_reason: "Correction after duplicate manual grant",
      }),
    ).toMatchObject({
      entry_type: "admin_adjustment",
      source: "admin_grant",
      credit_delta: -1,
      admin_actor_user_id: "admin-1",
      admin_reason: "Correction after duplicate manual grant",
    });
  });

  it("summarises finance exposure by credit source", () => {
    expect(
      summariseCreditEntriesBySource([
        { source: "free_monthly", entry_type: "grant", credit_delta: 1 },
        { source: "free_monthly", entry_type: "consume", credit_delta: -1 },
        { source: "user_paid", entry_type: "grant", credit_delta: 10 },
        { source: "user_paid", entry_type: "admin_adjustment", credit_delta: -2 },
      ]),
    ).toEqual([
      {
        source: "free_monthly",
        granted_credits: 1,
        consumed_credits: 1,
        admin_adjustment_credits: 0,
        expired_credits: 0,
        net_credits: 0,
        entry_count: 2,
      },
      {
        source: "user_paid",
        granted_credits: 10,
        consumed_credits: 0,
        admin_adjustment_credits: -2,
        expired_credits: 0,
        net_credits: 8,
        entry_count: 2,
      },
    ]);
  });

  it("defines DS-12 one-credit report lifecycle statuses and copy", () => {
    expect(REPORT_CREDIT_AMOUNT).toBe(1);
    expect(REPORT_CREDIT_RESERVATION_STATUSES).toEqual([
      "reserved",
      "consumed",
      "released",
      "refunded",
    ]);
    expect(formatReportCreditRequiredError()).toBe(
      `CREDIT_REQUIRED: ${REPORT_CREDIT_REQUIRED_MESSAGE}`,
    );
    expect(REPORT_CREDIT_RESTORED_MESSAGE).toMatch(/returned automatically/i);
    expect(REPORT_CREDIT_REPLACEMENT_COPY).toMatch(
      /Replacing a take uses another TapeCoach credit/i,
    );
  });

  it("maps report terminal states to consume, release or refund", () => {
    expect(resolveReportCreditTerminalAction({ reportPersisted: true })).toBe("consume");
    expect(
      resolveReportCreditTerminalAction({
        reportPersisted: false,
        cancelledBeforeAnalysis: true,
      }),
    ).toBe("release");
    expect(
      resolveReportCreditTerminalAction({
        reportPersisted: false,
        failureCode: "analysis_parse_failed",
      }),
    ).toBe("refund");
    expect(resolveReportCreditTerminalAction({ reportPersisted: false })).toBe("none");
  });

  it("keeps synthetic admin/test usage separate from commercial lifecycle labels", () => {
    expect(reportCreditLifecycleStatusFor("reserved")).toBe("reserved");
    expect(reportCreditLifecycleStatusFor("reserved", true)).toBe("synthetic_reserved");
    expect(reportCreditLifecycleStatusFor("consumed", true)).toBe("synthetic_consumed");
  });
});
