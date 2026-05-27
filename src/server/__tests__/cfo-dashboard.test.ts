import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CFO_CHATGPT_CODEX_MONTHLY_COST_GBP,
  CFO_LOVABLE_MONTHLY_COST_GBP,
  CFO_PAID_PACK_MARGIN_GUARDRAIL,
  CFO_PLANNING_FIXED_MONTHLY_BURN_GBP,
  CFO_PLANNING_USD_TO_GBP_RATE,
  CFO_REVENUE_MILESTONES_GBP,
  classifyMarginGuardrail,
  getCfoPlanningConstants,
  normaliseCfoMoney,
  normaliseCfoRate,
} from "../cfo-dashboard.server";

describe("CFO dashboard foundations", () => {
  it("keeps the DS-17 planning constants visible and stable", () => {
    expect(CFO_CHATGPT_CODEX_MONTHLY_COST_GBP).toBe(200);
    expect(CFO_LOVABLE_MONTHLY_COST_GBP).toBe(22);
    expect(CFO_PLANNING_FIXED_MONTHLY_BURN_GBP).toBe(275);
    expect(CFO_PAID_PACK_MARGIN_GUARDRAIL).toBe(0.7);
    expect(CFO_PLANNING_USD_TO_GBP_RATE).toBe(0.8);
    expect(CFO_REVENUE_MILESTONES_GBP).toEqual([100, 300, 1000, 2500]);
    expect(getCfoPlanningConstants()).toMatchObject({
      chatgpt_codex_monthly_cost_gbp: 200,
      lovable_monthly_cost_gbp: 22,
      fixed_monthly_burn_gbp: 275,
      paid_pack_margin_guardrail: 0.7,
    });
  });

  it("normalises money and margin rates without inventing missing revenue", () => {
    expect(normaliseCfoMoney(12.345)).toBe(12.35);
    expect(normaliseCfoMoney(null)).toBe(0);
    expect(normaliseCfoRate(0.70321)).toBe(0.7032);
    expect(normaliseCfoRate(undefined)).toBeNull();
    expect(classifyMarginGuardrail(null)).toBe("revenue_not_recorded");
    expect(classifyMarginGuardrail(0.69)).toBe("below_70_percent_guardrail");
    expect(classifyMarginGuardrail(0.7)).toBe("meets_70_percent_guardrail");
  });

  it("creates private finance views for every DS-17 dashboard requirement", () => {
    const sql = readFileSync(
      "supabase/migrations/20260527150600_cfo_margin_dashboards.sql",
      "utf8",
    );

    expect(sql).toContain("CREATE OR REPLACE VIEW public.cfo_report_funding_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.cfo_report_cost_by_report_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.cfo_revenue_ledger_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.cfo_partner_margin_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.cfo_free_report_subsidy_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.cfo_paid_credit_liability_summary");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.cfo_monthly_burn_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.cfo_revenue_milestone_dashboard");
    expect(sql).toContain("200.00::NUMERIC(10, 2) AS chatgpt_codex_monthly_cost_gbp");
    expect(sql).toContain("22.00::NUMERIC(10, 2) AS lovable_monthly_cost_gbp");
    expect(sql).toContain("275.00::NUMERIC(10, 2) AS planning_fixed_monthly_burn_gbp");
    expect(sql).toContain("0.7000::NUMERIC(5, 4) AS paid_pack_margin_guardrail");
    expect(sql).toContain("VALUES (100), (300), (1000), (2500)");
    expect(sql).toContain("partner_revenue_source");
    expect(sql).toContain("liability_pricing_status");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.cfo_partner_margin_dashboard FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.cfo_report_cost_by_report_dashboard TO service_role",
    );
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.cfo_monthly_burn_dashboard TO service_role",
    );
    expect(sql).not.toMatch(/raw_prompt|raw_model_response|signed_url|mux_mp4/i);
  });
});
