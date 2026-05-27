import { describe, expect, it } from "vitest";
import {
  AGENT_PARTNER_DASHBOARD_FIELDS,
  AGENT_PARTNER_PACKAGES,
  AGENT_PARTNER_REPORT_SHARE_TRACKING_FIELDS,
  AGENT_PARTNER_USAGE_ALERTS,
  AGENT_PARTNER_VISIBILITY_NOTICE,
  buildAgentPartnerCodeTemplate,
  buildAgentPartnerPackagePatch,
  buildAgentPartnerPoolInput,
  defaultAgentPartnerPackageCatalogue,
  formatAgentPackagePrice,
  normaliseAgentPartnerPackagePreset,
  sortAgentPartnerPackages,
} from "@/lib/agent-partner-packages";

describe("agent partner package presets", () => {
  it("defines Agent Trial and Agent Growth launch packages", () => {
    expect(
      AGENT_PARTNER_PACKAGES.map((preset) => ({
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
        sku: "agent-trial-monthly-gbp-49",
        pence: 4900,
        seats: 25,
        creditsPerMember: 3,
        totalCredits: 75,
        cap: 3,
        scope: "limited_usage_readiness",
      },
      {
        sku: "agent-growth-monthly-gbp-99",
        pence: 9900,
        seats: 29,
        creditsPerMember: 6,
        totalCredits: 175,
        cap: 6,
        scope: "limited_usage_readiness",
      },
    ]);
    expect(formatAgentPackagePrice(4900)).toBe("GBP 49.00");
    expect(formatAgentPackagePrice(9900)).toBe("GBP 99.00");
  });

  it("normalises configured agent packages without exposing named progress by default", () => {
    expect(
      normaliseAgentPartnerPackagePreset(
        {
          sku: "agent-trial-monthly-gbp-49",
          name: "Agent Trial",
          description: "Trial",
          package_tier: "trial",
          unit_amount_pence: 4900,
          included_seats: 25,
          credits_per_member: 3,
          total_credits: 75,
          per_user_cap: 3,
          active: true,
          display_order: 10,
        },
        "config",
      ),
    ).toMatchObject({
      sku: "agent-trial-monthly-gbp-49",
      package_tier: "trial",
      partner_type: "agent",
      billing_period: "monthly",
      currency: "GBP",
      display_price: "GBP 49.00",
      included_seats: 25,
      credits_per_member: 3,
      total_credits: 75,
      per_user_cap: 3,
      pool_period_type: "monthly",
      progress_visibility_scope: "limited_usage_readiness",
      source: "config",
    });
  });

  it("fails closed when an agent preset breaks tier, cap, allowance or capacity rules", () => {
    expect(() =>
      buildAgentPartnerPackagePatch({
        sku: "agent-bad",
        name: "Bad",
        description: "Bad",
        package_tier: "trial",
        unit_amount_pence: 4900,
        included_seats: 25,
        credits_per_member: 4,
        total_credits: 100,
        per_user_cap: 4,
      }),
    ).toThrow(/3 or 6 credit/i);

    expect(() =>
      buildAgentPartnerPackagePatch({
        sku: "agent-bad",
        name: "Bad",
        description: "Bad",
        package_tier: "growth",
        unit_amount_pence: 9900,
        included_seats: 30,
        credits_per_member: 6,
        total_credits: 175,
        per_user_cap: 6,
      }),
    ).toThrow(/included performer capacity/i);
  });

  it("builds agent pool inputs from the selected package", () => {
    expect(
      buildAgentPartnerPoolInput({
        preset: AGENT_PARTNER_PACKAGES[0],
        partner_id: "partner-1",
        period_start: "2026-06-01T00:00:00.000Z",
        period_end: "2026-07-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      partner_id: "partner-1",
      partner_type: "agent",
      name: "Agent Trial pool",
      period_type: "monthly",
      total_credits: 75,
      per_user_cap: 3,
      overage_allowed: false,
      currency: "GBP",
      metadata: { agent_package_sku: "agent-trial-monthly-gbp-49" },
    });
  });

  it("builds agent invite code templates that require explicit report sharing", () => {
    expect(
      buildAgentPartnerCodeTemplate({
        preset: AGENT_PARTNER_PACKAGES[1],
        partner_id: "partner-1",
        partner_credit_pool_id: "pool-1",
        valid_from: "2026-06-01T00:00:00.000Z",
        expires_at: "2026-07-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      partner_id: "partner-1",
      partner_credit_pool_id: "pool-1",
      allowance_credits: 6,
      max_activations: 29,
      metadata: {
        agent_package_sku: "agent-growth-monthly-gbp-99",
        agent_package_tier: "growth",
        agent_visibility_notice_version: "agent-visibility-2026-05-27",
        performer_share_required_for_full_report: true,
      },
    });
  });

  it("packages agent restricted visibility, share tracking and renewal content", () => {
    const catalogue = defaultAgentPartnerPackageCatalogue();
    expect(catalogue.packages.map((preset) => preset.sku)).toEqual([
      "agent-trial-monthly-gbp-49",
      "agent-growth-monthly-gbp-99",
    ]);
    expect(AGENT_PARTNER_VISIBILITY_NOTICE).toMatch(/Full reports require explicit performer/i);
    expect(AGENT_PARTNER_DASHBOARD_FIELDS).toContain("full report share status");
    expect(AGENT_PARTNER_DASHBOARD_FIELDS).not.toContain("latest score");
    expect(AGENT_PARTNER_REPORT_SHARE_TRACKING_FIELDS).toContain("full_report_shared_at");
    expect(AGENT_PARTNER_USAGE_ALERTS[80]).toMatch(/renewal or growth-package/i);
    expect(catalogue.invite_flow_checklist).toContain(
      "Track report-share status separately from default limited visibility.",
    );
    expect(catalogue.renewal_report_sections).toContain("renewal interest signals");
    expect(
      sortAgentPartnerPackages([
        { ...AGENT_PARTNER_PACKAGES[1], display_order: 20 },
        { ...AGENT_PARTNER_PACKAGES[0], display_order: 10 },
      ]).map((preset) => preset.sku),
    ).toEqual(["agent-trial-monthly-gbp-49", "agent-growth-monthly-gbp-99"]);
  });
});
