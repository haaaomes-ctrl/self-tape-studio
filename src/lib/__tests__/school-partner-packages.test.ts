import { describe, expect, it } from "vitest";
import {
  buildSchoolPartnerCodeTemplate,
  buildSchoolPartnerPackagePatch,
  buildSchoolPartnerPoolInput,
  defaultSchoolPartnerPackageCatalogue,
  formatSchoolPackagePrice,
  normaliseSchoolPartnerPackagePreset,
  SCHOOL_PARTNER_PACKAGES,
  SCHOOL_PARTNER_VISIBILITY_NOTICE,
  sortSchoolPartnerPackages,
} from "@/lib/school-partner-packages";

describe("school partner package presets", () => {
  it("defines School Pilot and School Growth launch packages", () => {
    expect(
      SCHOOL_PARTNER_PACKAGES.map((preset) => ({
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
        sku: "school-pilot-term-gbp-500",
        pence: 50000,
        seats: 25,
        creditsPerMember: 12,
        totalCredits: 300,
        cap: 12,
        scope: "named_progress",
      },
      {
        sku: "school-growth-term-gbp-1000",
        pence: 100000,
        seats: 60,
        creditsPerMember: 12,
        totalCredits: 720,
        cap: 12,
        scope: "named_progress",
      },
    ]);
    expect(formatSchoolPackagePrice(50000)).toBe("GBP 500.00");
    expect(formatSchoolPackagePrice(100000)).toBe("GBP 1000.00");
  });

  it("normalises configured school packages without changing school economics", () => {
    expect(
      normaliseSchoolPartnerPackagePreset(
        {
          sku: "school-pilot-term-gbp-500",
          name: "School Pilot",
          description: "Pilot",
          package_tier: "pilot",
          unit_amount_pence: 50000,
          included_seats: 25,
          credits_per_member: 12,
          total_credits: 300,
          active: true,
          display_order: 10,
        },
        "config",
      ),
    ).toMatchObject({
      sku: "school-pilot-term-gbp-500",
      package_tier: "pilot",
      partner_type: "school",
      billing_period: "term",
      currency: "GBP",
      display_price: "GBP 500.00",
      included_seats: 25,
      credits_per_member: 12,
      total_credits: 300,
      per_user_cap: 12,
      pool_period_type: "term",
      progress_visibility_scope: "named_progress",
      source: "config",
    });
  });

  it("fails closed when a school preset breaks seats, credits or cap maths", () => {
    expect(() =>
      buildSchoolPartnerPackagePatch({
        sku: "school-bad",
        name: "Bad",
        description: "Bad",
        package_tier: "pilot",
        unit_amount_pence: 50000,
        included_seats: 25,
        credits_per_member: 10,
        total_credits: 250,
      }),
    ).toThrow(/12 credits per student/i);

    expect(() =>
      buildSchoolPartnerPackagePatch({
        sku: "school-bad",
        name: "Bad",
        description: "Bad",
        package_tier: "pilot",
        unit_amount_pence: 50000,
        included_seats: 25,
        credits_per_member: 12,
        total_credits: 301,
      }),
    ).toThrow(/seats times credits/i);
  });

  it("builds school pool inputs from the selected package", () => {
    expect(
      buildSchoolPartnerPoolInput({
        preset: SCHOOL_PARTNER_PACKAGES[0],
        partner_id: "partner-1",
        period_start: "2026-09-01T00:00:00.000Z",
        period_end: "2026-12-20T00:00:00.000Z",
      }),
    ).toMatchObject({
      partner_id: "partner-1",
      partner_type: "school",
      name: "School Pilot pool",
      period_type: "term",
      total_credits: 300,
      per_user_cap: 12,
      overage_allowed: false,
      currency: "GBP",
      metadata: { school_package_sku: "school-pilot-term-gbp-500" },
    });
  });

  it("builds school code templates that grant 12 credits and cap activations by seats", () => {
    expect(
      buildSchoolPartnerCodeTemplate({
        preset: SCHOOL_PARTNER_PACKAGES[1],
        partner_id: "partner-1",
        partner_credit_pool_id: "pool-1",
        valid_from: "2026-09-01T00:00:00.000Z",
        expires_at: "2026-12-20T00:00:00.000Z",
        allowed_email_domains: ["college.example"],
      }),
    ).toMatchObject({
      partner_id: "partner-1",
      partner_credit_pool_id: "pool-1",
      allowance_credits: 12,
      max_activations: 60,
      allowed_email_domains: ["college.example"],
      metadata: {
        school_package_sku: "school-growth-term-gbp-1000",
        school_package_tier: "growth",
        school_visibility_notice_version: "school-visibility-2026-05-27",
      },
    });
  });

  it("packages school launch copy as reusable structured content", () => {
    const catalogue = defaultSchoolPartnerPackageCatalogue();
    expect(catalogue.packages.map((preset) => preset.sku)).toEqual([
      "school-pilot-term-gbp-500",
      "school-growth-term-gbp-1000",
    ]);
    expect(SCHOOL_PARTNER_VISIBILITY_NOTICE).toMatch(
      /Full reports, uploaded video and supplied brief stay private/i,
    );
    expect(catalogue.onboarding_checklist).toContain("Create one school code linked to that pool.");
    expect(catalogue.renewal_report_sections).toContain("common fix-first categories");
    expect(
      sortSchoolPartnerPackages([
        { ...SCHOOL_PARTNER_PACKAGES[1], display_order: 20 },
        { ...SCHOOL_PARTNER_PACKAGES[0], display_order: 10 },
      ]).map((preset) => preset.sku),
    ).toEqual(["school-pilot-term-gbp-500", "school-growth-term-gbp-1000"]);
  });
});
