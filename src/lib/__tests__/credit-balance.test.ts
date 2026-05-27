import { describe, expect, it } from "vitest";
import {
  deriveCreditBalanceSnapshot,
  FAILED_REPORT_CREDIT_RESTORED_COPY,
  REPLACEMENT_REPORT_CREDIT_COPY,
  REPORT_CREDIT_UNIT_COPY,
} from "@/lib/credit-balance";

describe("credit balance view model", () => {
  it("keeps DS-14 performer credit copy explicit", () => {
    expect(REPORT_CREDIT_UNIT_COPY).toBe("1 TapeCoach credit = 1 self-tape report.");
    expect(REPLACEMENT_REPORT_CREDIT_COPY).toMatch(
      /Replacing a take uses another TapeCoach credit/i,
    );
    expect(FAILED_REPORT_CREDIT_RESTORED_COPY).toMatch(/returned automatically/i);
  });

  it("summarises free, partner-funded and paid credits separately", () => {
    const snapshot = deriveCreditBalanceSnapshot({
      now: "2026-05-27T12:00:00.000Z",
      grants: [
        {
          id: "free-monthly",
          source: "free_monthly",
          original_credits: 1,
          remaining_credits: 1,
          expires_at: "2026-06-27T12:00:00.000Z",
          source_label: null,
          status: "active",
          granted_at: "2026-05-27T12:00:00.000Z",
        },
        {
          id: "school",
          source: "school_funded",
          original_credits: 6,
          remaining_credits: 4,
          expires_at: "2026-07-01T12:00:00.000Z",
          source_label: "Royal MT College code v1",
          status: "active",
          granted_at: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "paid",
          source: "user_paid",
          original_credits: 10,
          remaining_credits: 9,
          expires_at: null,
          source_label: null,
          status: "active",
          granted_at: "2026-05-21T12:00:00.000Z",
        },
      ],
      partner_memberships: [
        {
          id: "membership",
          partner_name: "Royal MT College",
          partner_type: "school",
          credit_source: "school_funded",
          allowance_credits: 6,
          remaining_credits: 4,
          expires_at: "2026-07-01T12:00:00.000Z",
          status: "active",
          activated_at: "2026-05-20T12:00:00.000Z",
        },
      ],
    });

    expect(snapshot.total_available_credits).toBe(14);
    expect(snapshot.free_credit_balance).toBe(1);
    expect(snapshot.free_monthly.status).toBe("available");
    expect(snapshot.partner_funded_balance).toBe(4);
    expect(snapshot.partner_allowances).toEqual([
      {
        id: "membership",
        partner_name: "Royal MT College",
        partner_type: "school",
        allowance_credits: 6,
        remaining_credits: 4,
        expires_at: "2026-07-01T12:00:00.000Z",
        status: "active",
      },
    ]);
    expect(snapshot.paid_credit_balance).toBe(9);
    expect(snapshot.source_breakdown.map((entry) => entry.label)).toContain(
      "Royal MT College code v1",
    );
  });

  it("shows used monthly status without inventing a new free grant", () => {
    const snapshot = deriveCreditBalanceSnapshot({
      now: "2026-05-27T12:00:00.000Z",
      grants: [
        {
          id: "free-monthly",
          source: "free_monthly",
          original_credits: 1,
          remaining_credits: 0,
          expires_at: "2026-06-01T12:00:00.000Z",
          source_label: null,
          status: "exhausted",
          granted_at: "2026-05-01T12:00:00.000Z",
        },
      ],
    });

    expect(snapshot.total_available_credits).toBe(0);
    expect(snapshot.free_monthly).toMatchObject({
      status: "used_this_period",
      available_credits: 0,
      next_refresh_at: "2026-06-01T12:00:00.000Z",
    });
  });
});
