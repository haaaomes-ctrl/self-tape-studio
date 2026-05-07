// Phase 3C v2 — Dance visibility / cropping false-positive guard +
// soft-risk demotion. These exercise the deterministic clean-up layer in
// `report-output-enforcement.server.ts`.
import { describe, it, expect } from "vitest";
import { enforcePublicReportOutputQuality } from "../report-output-enforcement.server";

const baseCtx = {
  mode: "baseline" as const,
  auditionType: "dance",
  framingFixed: false,
  materialPolicy: "none" as const,
};

describe("Dance visibility / cropping guard", () => {
  it("removes unanchored 'feet are cut off' from improvements", () => {
    const { report, counters } = enforcePublicReportOutputQuality(
      {
        improvements: [
          "The feet are cut off and footwork is obscured throughout.",
          "Sharpen weight transfer into the change of direction at the chorus.",
        ],
        timestamped_notes: [
          { timestamp: "00:12", note: "Strong rhythmic accent on the back beat." },
        ],
      },
      baseCtx,
    );
    const imp = report.improvements as string[];
    expect(imp.some((s) => /feet are cut off|footwork is obscured/i.test(s))).toBe(false);
    expect(imp.length).toBeGreaterThan(0); // craft note retained
    expect(counters.dance_visibility_unanchored_removed).toBeGreaterThan(0);
  });

  it("keeps cropping claim when a timestamped note anchors it", () => {
    const { report } = enforcePublicReportOutputQuality(
      {
        improvements: ["Footwork is obscured for most of the routine."],
        timestamped_notes: [
          { timestamp: "00:18", note: "Frame cuts off the feet during the turn sequence." },
        ],
      },
      baseCtx,
    );
    const imp = report.improvements as string[];
    expect(imp.some((s) => /footwork is obscured/i.test(s))).toBe(true);
  });

  it("demotes 'Obscured Footwork' submission risk without anchored evidence", () => {
    const { report, counters } = enforcePublicReportOutputQuality(
      {
        submission_risk_flags: [
          { severity: "medium", flag: "Obscured Footwork" },
          { severity: "high", flag: "Brief Mismatch" },
        ],
        casting_risk_explanations: [
          { flag: "Obscured Footwork", casting_impact: "x", recall_impact: "y" },
          { flag: "Brief Mismatch", casting_impact: "x", recall_impact: "y" },
        ],
        timestamped_notes: [
          { timestamp: "00:05", note: "Strong opening." },
        ],
      },
      baseCtx,
    );
    const flags = report.submission_risk_flags as Array<{ flag: string }>;
    expect(flags.some((f) => /obscured\s+footwork/i.test(f.flag))).toBe(false);
    expect(flags.some((f) => /brief\s+mismatch/i.test(f.flag))).toBe(true);
    expect(counters.submission_risk_demoted).toBeGreaterThan(0);
    const explanations = report.casting_risk_explanations as Array<{ flag: string }>;
    expect(explanations.some((e) => /obscured\s+footwork/i.test(e.flag))).toBe(false);
  });

  it("demotes 'Low Lighting' risk when no anchored visibility note exists", () => {
    const { report } = enforcePublicReportOutputQuality(
      {
        submission_risk_flags: [{ severity: "medium", flag: "Low Lighting" }],
        timestamped_notes: [],
      },
      baseCtx,
    );
    expect((report.submission_risk_flags as unknown[]).length).toBe(0);
  });

  it("idempotent — second pass adds no further demotions", () => {
    const input = {
      improvements: ["Feet are cut off across the routine."],
      submission_risk_flags: [{ severity: "medium", flag: "Obscured Footwork" }],
      timestamped_notes: [],
    };
    const first = enforcePublicReportOutputQuality(input, baseCtx);
    const second = enforcePublicReportOutputQuality(first.report, baseCtx);
    expect(second.counters.dance_visibility_unanchored_removed).toBe(0);
    expect(second.counters.submission_risk_demoted).toBe(0);
  });
});
