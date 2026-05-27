import { describe, expect, it } from "vitest";
import {
  buildCoachPartnerCodeTemplate,
  buildCoachPartnerPackagePatch,
  buildCoachPartnerPoolInput,
  COACH_PARTNER_DASHBOARD_FIELDS,
  COACH_PARTNER_PACKAGES,
  COACH_PARTNER_USAGE_ALERTS,
  COACH_PARTNER_VISIBILITY_NOTICE,
  defaultCoachPartnerPackageCatalogue,
  formatCoachPackagePrice,
  normaliseCoachPartnerPackagePreset,
  sortCoachPartnerPackages,
} from "@/lib/coach-partner-packages";

describe("coach partner package presets", () => {
  it("defines Coach Starter and Coach Studio launch packages", () => {
    expect(
      COACH_PARTNER_PACKAGES.map((preset) => ({
        sku: preset.sku,
        pence: preset.unit_amount_pence,
        seats: preset.included_seats,
        creditsPerMember: preset.credits_per_member,
        totalCredits: preset.total_credits,
        cap: preset.per_user_cap,
        scope: preset.progress_visibility_scope,
      })),
    ).toEqual([
      {
        sku: "coach-starter-monthly-gbp-29",
        pence: 2900,
        seats: 6,
        creditsPerMember: 6,
        totalCredits: 40,
        cap: 6,
        scope: "named_progress",
      },
      {
        sku: "coach-studio-monthly-gbp-79",
        pence: 7900,
        seats: 15,
        creditsPerMember: 10,
        totalCredits: 150,
        cap: 10,
        scope: "named_progress",
      },
    ]);
    expect(formatCoachPackagePrice(2900)).toBe("GBP 29.00");
    expect(formatCoachPackagePrice(7900)).toBe("GBP 79.00");
  });

  it("normalises configured coach packages without weakening coach privacy defaults", () => {
    expect(
      normaliseCoachPartnerPackagePreset(
        {
          sku: "coach-starter-monthly-gbp-29",
          name: "Coach Starter",
          description: "Starter",
          package_tier: "starter",
          unit_amount_pence: 2900,
          included_seats: 6,
          credits_per_member: 6,
          total_credits: 40,
          per_user_cap: 6,
          active: true,
          display_order: 10,
        },
        "config",
      ),
    ).toMatchObject({
      sku: "coach-starter-monthly-gbp-29",
      package_tier: "starter",
      partner_type: "coach",
      billing_period: "monthly",
      currency: "GBP",
      display_price: "GBP 29.00",
      included_seats: 6,
      credits_per_member: 6,
      total_credits: 40,
      per_user_cap: 6,
      pool_period_type: "monthly",
      progress_visibility_scope: "named_progress",
      source: "config",
    });
  });

  it("fails closed when a coach preset breaks cap, allowance or capacity rules", () => {
    expect(() =>
      buildCoachPartnerPackagePatch({
        sku: "coach-bad",
        name: "Bad",
        description: "Bad",
        package_tier: "starter",
        unit_amount_pence: 2900,
        included_seats: 6,
        credits_per_member: 8,
        total_credits: 48,
        per_user_cap: 8,
      }),
    ).toThrow(/6 or 10 credit/i);

    expect(() =>
      buildCoachPartnerPackagePatch({
        sku: "coach-bad",
        name: "Bad",
        description: "Bad",
        package_tier: "starter",
        unit_amount_pence: 2900,
        included_seats: 6,
        credits_per_member: 6,
        total_credits: 30,
        per_user_cap: 6,
      }),
    ).toThrow(/included performer capacity/i);
  });

  it("builds coach pool inputs from the selected package", () => {
    expect(
      buildCoachPartnerPoolInput({
        preset: COACH_PARTNER_PACKAGES[0],
        partner_id: "partner-1",
        period_start: "2026-06-01T00:00:00.000Z",
        period_end: "2026-07-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      partner_id: "partner-1",
      partner_type: "coach",
      name: "Coach Starter pool",
      period_type: "monthly",
      total_credits: 40,
      per_user_cap: 6,
      overage_allowed: false,
      currency: "GBP",
      metadata: { coach_package_sku: "coach-starter-monthly-gbp-29" },
    });
  });

  it("builds coach invite code templates from monthly performer caps", () => {
    expect(
      buildCoachPartnerCodeTemplate({
        preset: COACH_PARTNER_PACKAGES[1],
        partner_id: "partner-1",
        partner_credit_pool_id: "pool-1",
        valid_from: "2026-06-01T00:00:00.000Z",
        expires_at: "2026-07-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      partner_id: "partner-1",
      partner_credit_pool_id: "pool-1",
      allowance_credits: 10,
      max_activations: 15,
      metadata: {
        coach_package_sku: "coach-studio-monthly-gbp-79",
        coach_package_tier: "studio",
        coach_visibility_notice_version: "coach-visibility-2026-05-27",
      },
    });
  });

  it("packages coach dashboard, alert, sales and renewal content safely", () => {
    const catalogue = defaultCoachPartnerPackageCatalogue();
    expect(catalogue.packages.map((preset) => preset.sku)).toEqual([
      "coach-starter-monthly-gbp-29",
      "coach-studio-monthly-gbp-79",
    ]);
    expect(COACH_PARTNER_VISIBILITY_NOTICE).toMatch(
      /Full reports, uploaded video and supplied brief stay private/i,
    );
    expect(COACH_PARTNER_DASHBOARD_FIELDS).toContain("visibility acceptance status");
    expect(COACH_PARTNER_USAGE_ALERTS[80]).toMatch(/top-up or Studio upgrade/i);
    expect(catalogue.invite_flow_checklist).toContain(
      "Create a coach invite code linked to that pool.",
    );
    expect(catalogue.renewal_report_sections).toContain("upgrade or renewal recommendation");
    expect(
      sortCoachPartnerPackages([
        { ...COACH_PARTNER_PACKAGES[1], display_order: 20 },
        { ...COACH_PARTNER_PACKAGES[0], display_order: 10 },
      ]).map((preset) => preset.sku),
    ).toEqual(["coach-starter-monthly-gbp-29", "coach-studio-monthly-gbp-79"]);
  });
});
