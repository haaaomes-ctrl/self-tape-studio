import { describe, it, expect } from "vitest";
import { enforcePublicReportOutputQuality } from "@/server/report-output-enforcement.server";

const ctx = { mode: "brief" as const, auditionType: "musical_theatre", framingFixed: false, materialPolicy: "fixed" as const };

describe("category_rationale scrub", () => {
  it("drops entry when score<100 and both why_not_full_score & close_gap empty", () => {
    const out = enforcePublicReportOutputQuality(
      {
        scores: { acting: 88 },
        category_rationale: { acting: { what_works: "x", why_not_full_score: "", close_gap: "" } },
      },
      ctx,
    );
    expect(out.report.category_rationale).toBeUndefined();
    expect(out.counters.category_rationale_dropped).toBeGreaterThan(0);
  });

  it("counts missing standout_delta for score>=90", () => {
    const out = enforcePublicReportOutputQuality(
      {
        scores: { acting: 95 },
        category_rationale: { acting: { what_works: "w", why_not_full_score: "y", close_gap: "z" } },
      },
      ctx,
    );
    expect((out.report.category_rationale as Record<string, unknown>).acting).toBeDefined();
    expect(out.counters.category_rationale_missing_delta).toBeGreaterThan(0);
  });

  it("strips private keys and overclaim wording from rationale", () => {
    const out = enforcePublicReportOutputQuality(
      {
        scores: { acting: 92 },
        category_rationale: {
          acting: {
            what_works: "Specific reader response at 00:42.",
            why_not_full_score: "Pickups slightly slow.",
            close_gap: "Sharpen the pickup at 01:10.",
            standout_delta: "All requirements met perfectly.",
            supports: ["a1"],
            anchor_id: "x",
            shadow_score: 99,
          },
        },
      },
      ctx,
    );
    const acting = (out.report.category_rationale as Record<string, Record<string, unknown>>).acting;
    expect(acting.standout_delta).toBe("");
    expect(acting.supports).toBeUndefined();
    expect(acting.anchor_id).toBeUndefined();
    expect(acting.shadow_score).toBeUndefined();
  });

  it("removes non-public category keys", () => {
    const out = enforcePublicReportOutputQuality(
      {
        scores: { acting: 80 },
        category_rationale: {
          acting: { what_works: "ok", why_not_full_score: "y", close_gap: "z" },
          shadow: { what_works: "leak" },
        },
      },
      ctx,
    );
    const cr = out.report.category_rationale as Record<string, unknown>;
    expect("shadow" in cr).toBe(false);
  });
});
