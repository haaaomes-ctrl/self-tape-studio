import { describe, expect, it } from "vitest";
import {
  alertThresholdsCrossed,
  assertPartnerPoolCanAllocate,
  buildPartnerCreditPoolDraft,
  buildPartnerCodeDraft,
  defaultPartnerCreditPoolPolicy,
  PARTNER_ALLOWANCE_EXHAUSTED_MESSAGE,
  summarisePartnerPoolUsage,
} from "@/lib/partner-program";

describe("partner credit pool foundation", () => {
  it("defines DS-06 default per-user cap policy by partner type", () => {
    expect(defaultPartnerCreditPoolPolicy("school")).toEqual({
      period_type: "term",
      default_per_user_cap: 12,
      minimum_per_user_cap: 12,
      maximum_per_user_cap: 12,
    });
    expect(defaultPartnerCreditPoolPolicy("coach")).toEqual({
      period_type: "monthly",
      default_per_user_cap: 6,
      minimum_per_user_cap: 6,
      maximum_per_user_cap: 12,
    });
    expect(defaultPartnerCreditPoolPolicy("agent")).toEqual({
      period_type: "monthly",
      default_per_user_cap: 3,
      minimum_per_user_cap: 3,
      maximum_per_user_cap: 6,
    });
    expect(PARTNER_ALLOWANCE_EXHAUSTED_MESSAGE).toMatch(/partner-funded/i);
  });

  it("builds school pool drafts with term cadence and fixed 12-credit caps", () => {
    expect(
      buildPartnerCreditPoolDraft({
        partner_id: "partner-1",
        partner_type: "school",
        name: "  Autumn term  ",
        total_credits: 300,
        period_start: "2026-09-01T00:00:00.000Z",
        period_end: "2026-12-20T00:00:00.000Z",
      }),
    ).toMatchObject({
      partner_id: "partner-1",
      name: "Autumn term",
      period_type: "term",
      status: "active",
      total_credits: 300,
      allocated_credits: 0,
      consumed_credits: 0,
      per_user_cap: 12,
      overage_allowed: false,
      overage_price_pence: null,
      currency: "GBP",
    });
  });

  it("allows coach and agent caps only inside their DS-06 ranges", () => {
    expect(
      buildPartnerCreditPoolDraft({
        partner_id: "partner-1",
        partner_type: "coach",
        name: "Studio May",
        total_credits: 60,
        per_user_cap: 10,
        period_start: "2026-05-01T00:00:00.000Z",
        period_end: "2026-06-01T00:00:00.000Z",
      }).per_user_cap,
    ).toBe(10);

    expect(() =>
      buildPartnerCreditPoolDraft({
        partner_id: "partner-1",
        partner_type: "agent",
        name: "Agency May",
        total_credits: 60,
        per_user_cap: 7,
        period_start: "2026-05-01T00:00:00.000Z",
        period_end: "2026-06-01T00:00:00.000Z",
      }),
    ).toThrow(/above the partner default range/i);

    expect(() =>
      buildPartnerCreditPoolDraft({
        partner_id: "partner-1",
        partner_type: "school",
        name: "Autumn term",
        total_credits: 300,
        per_user_cap: 11,
        period_start: "2026-09-01T00:00:00.000Z",
        period_end: "2026-12-20T00:00:00.000Z",
      }),
    ).toThrow(/below the partner default range/i);
  });

  it("fails closed on malformed pool totals, dates, overage and currency", () => {
    expect(() =>
      buildPartnerCreditPoolDraft({
        partner_id: "partner-1",
        partner_type: "coach",
        name: " ",
        total_credits: 60,
        period_start: "2026-05-01T00:00:00.000Z",
        period_end: "2026-06-01T00:00:00.000Z",
      }),
    ).toThrow(/name is required/i);

    expect(() =>
      buildPartnerCreditPoolDraft({
        partner_id: "partner-1",
        partner_type: "coach",
        name: "Studio May",
        total_credits: 60,
        allocated_credits: 61,
        period_start: "2026-05-01T00:00:00.000Z",
        period_end: "2026-06-01T00:00:00.000Z",
      }),
    ).toThrow(/allocated_credits cannot exceed total_credits/i);

    expect(() =>
      buildPartnerCreditPoolDraft({
        partner_id: "partner-1",
        partner_type: "coach",
        name: "Studio May",
        total_credits: 60,
        overage_price_pence: 250,
        period_start: "2026-05-01T00:00:00.000Z",
        period_end: "2026-06-01T00:00:00.000Z",
      }),
    ).toThrow(/requires overage_allowed/i);
  });

  it("blocks exhausted pool and per-user cap allocations unless explicitly overridden", () => {
    expect(() =>
      assertPartnerPoolCanAllocate({
        total_credits: 60,
        allocated_credits: 59,
        per_user_cap: 12,
        user_allocated_credits: 0,
        credit_amount: 2,
      }),
    ).toThrow(/pool exhausted/i);

    expect(() =>
      assertPartnerPoolCanAllocate({
        total_credits: 60,
        allocated_credits: 10,
        per_user_cap: 12,
        user_allocated_credits: 10,
        credit_amount: 3,
      }),
    ).toThrow(/per-user cap exceeded/i);

    expect(() =>
      assertPartnerPoolCanAllocate({
        total_credits: 60,
        allocated_credits: 10,
        per_user_cap: 12,
        user_allocated_credits: 10,
        credit_amount: 3,
        cap_override: true,
      }),
    ).not.toThrow();
  });

  it("summarises partner pool usage and crossed alert thresholds", () => {
    expect(alertThresholdsCrossed(0, 150, 300)).toEqual([50]);
    expect(alertThresholdsCrossed(230, 250, 300)).toEqual([80]);
    expect(alertThresholdsCrossed(290, 300, 300)).toEqual([100]);

    expect(
      summarisePartnerPoolUsage({
        total_credits: 300,
        allocated_credits: 230,
        next_credit_amount: 20,
      }),
    ).toEqual({
      allocated_credits: 250,
      total_credits: 300,
      remaining_credits: 50,
      usage_percent: 83.33,
      crossed_alert_thresholds: [80],
    });
  });

  it("links partner codes to pools without replacing DS-05 code controls", () => {
    expect(
      buildPartnerCodeDraft({
        partner_id: "partner-1",
        partner_credit_pool_id: "pool-1",
        code_hash: "a".repeat(64),
        code_display_hint: "POOL...2026",
        allowance_credits: 12,
      }),
    ).toMatchObject({
      partner_id: "partner-1",
      partner_credit_pool_id: "pool-1",
      allowance_credits: 12,
      version: 1,
      status: "active",
    });
  });
});
