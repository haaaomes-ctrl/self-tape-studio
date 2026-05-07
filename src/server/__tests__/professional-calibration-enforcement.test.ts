// Phase 3C P2 — calibration rewrite map.
import { describe, it, expect } from "vitest";
import { enforcePublicReportOutputQuality } from "@/server/report-output-enforcement.server";

const ctx = { mode: "brief" as const, auditionType: "musical_theatre", framingFixed: false, materialPolicy: "fixed" as const };

describe("calibration rewrites", () => {
  const cases: Array<[string, RegExp]> = [
    ["Highly castable for the role.", /well aligned with the supplied brief/i],
    ["A strong contender for the show.", /a strong tape for the stated task/i],
    ["Callback-ready right now.", /ready to submit/i],
    ["Recall-worthy delivery.", /ready to submit/i],
    ["Workshop-ready submission.", /ready to submit/i],
    ["Perfectly captures the character.", /clearly supports/i],
    ["Exactly what the team is looking for.", /matches the stated style\/task requirements/i],
    ["A perfect fit for the brief.", /a strong fit for the stated task/i],
  ];
  for (const [input, re] of cases) {
    it(`rewrites: ${input}`, () => {
      const out = enforcePublicReportOutputQuality({ role_fit_notes: input }, ctx);
      expect(out.report.role_fit_notes).toMatch(re);
      expect(out.counters.castability_rewritten).toBeGreaterThan(0);
    });
  }

  it("is idempotent — rewritten text matches no triggers on second pass", () => {
    const a = enforcePublicReportOutputQuality({ role_fit_notes: "Highly castable. Perfectly captures the role. Callback-ready." }, ctx).report;
    const b = enforcePublicReportOutputQuality(a, ctx);
    expect(b.counters.castability_rewritten).toBe(0);
  });

  it("hard overclaims still drop", () => {
    const out = enforcePublicReportOutputQuality({ casting_headline: "Bookable and marketable." }, ctx);
    expect(out.report.casting_headline).toBe("");
  });
});
