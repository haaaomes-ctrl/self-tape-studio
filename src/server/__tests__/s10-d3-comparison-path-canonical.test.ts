// Δ6 P3a — D3 comparison-path-from-canonical + behaviour-neutrality CONFORMANCE.
//
// Conformance clause: arch-report-derivation-architecture §D3 (and §9) — "deprecate the
// redundant in-payload v2-JSON copy, PRESERVE the comparison data path." The comparison /
// dashboard surfaces (CompareView, admin) read the DENORMALISED `takes` columns
// (`takes.scores`, `takes.overall_score`), which are persisted from the CANONICAL derived
// values — `report.scores` (set at process-take.server.ts:5347 to derivedDimensionScores,
// Δ4-S1) and the finalised canonical overall (round of the value finalised at :5492). They
// are NOT the deprecated in-payload `V2Report.scores` / `V2Report.brief_adherence_breakdown`
// JSON copy (v2-report-builder.server.ts:414/420), which is derived from the AI judgement A
// (score_summary.category_scores) and has no comparison consumer.
//
// These are GUARD / CONFORMANCE tests, not fail-first defect tests: there is NO behaviour
// change in the Δ6 P3a annotation slice (comments/JSDoc only; nothing is removed), so they
// PASS immediately. They pin two properties forward:
//   (1) the values that WOULD be denormalised into takes.scores / takes.overall_score equal
//       the canonical category-score map / canonical overall — i.e. the comparison columns
//       derive from CANONICAL, not from the deprecated in-payload copy; and
//   (2) the built v2 payload's deprecated-copy fields AND the denormalised column tuple are
//       byte-identical to their known values (the annotation slice alters no runtime output).
//
// If test (1) ever FAILS, the comparison path is NOT canonical — STOP and report, do NOT
// "fix" it by changing any scoring. (Same fixtures + harness as
// s10-canonical-score-invariant / s10-canonical-subsurfaces-invariant.)

import { describe, expect, it } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";

type AnyRec = Record<string, unknown>;

function strongV2(report: AnyRec = buildS10StrongCompleteProfessionalReportInput()) {
  return buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
}
function canaryV2(report: AnyRec = buildS10CanaryAReportInput()) {
  return buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  });
}

// The view-model chokepoint canonical surfaces (the source the canonical render reads, and the
// shape the denormalised takes.scores / takes.overall_score columns track).
function canonicalCategoryRows(v2: unknown): AnyRec[] {
  const vm = (v2 as AnyRec).s10_view_model as AnyRec | null | undefined;
  const rows = vm?.canonical_category_scores;
  return Array.isArray(rows) ? (rows as AnyRec[]) : [];
}
function canonicalOverall(v2: unknown): number | null | undefined {
  const vm = (v2 as AnyRec).s10_view_model as AnyRec | null | undefined;
  return vm?.canonical_overall_score as number | null | undefined;
}

// The value that WOULD be denormalised into the takes columns at persist:
//   takes.scores       <- report.scores                       (process-take.server.ts:7097/5347)
//   takes.overall_score<- round(overall); overall === D (= report.overall_score_final/overall_score
//                         after the canonical chain finalised at :5492; the fixture pins both equal)
function denormScores(report: AnyRec): Record<string, number | null> {
  return (report.scores ?? {}) as Record<string, number | null>;
}
function denormOverall(report: AnyRec): number | null {
  // canonical_overall_score = report.overall_score_final ?? report.overall_score (view-model
  // :1682). In the live pipeline takes.overall_score = round(overall) where overall is the same
  // canonical D; in the fixtures overall_score_final === overall_score so the analogue is exact.
  const v = (report.overall_score_final ?? report.overall_score) as number | null | undefined;
  return typeof v === "number" ? Math.round(v) : null;
}

describe("Δ6 P3a — D3: the comparison columns derive from CANONICAL (arch §D3, preserve the data path)", () => {
  for (const [label, buildReport, buildV2OfReport] of [
    ["strong-complete", buildS10StrongCompleteProfessionalReportInput, strongV2],
    ["canary-A", buildS10CanaryAReportInput, canaryV2],
  ] as const) {
    it(`${label}: takes.scores analogue (report.scores) === canonical category-score map`, () => {
      const report = buildReport() as AnyRec;
      const v2 = buildV2OfReport(report as never);
      const scores = denormScores(report);
      const canonRows = canonicalCategoryRows(v2);
      expect(canonRows.length).toBeGreaterThan(0);

      // Every canonical category row's score equals the value that feeds takes.scores
      // (report.scores[category_id]) — the comparison column tracks the canonical mark, not A.
      for (const row of canonRows) {
        const categoryId = row.category_id as string;
        // canonicalCategoryScoresFromReport only overrides the row score where report.scores has
        // the key; every readiness category in these fixtures has a matching report.scores key.
        expect(scores).toHaveProperty(categoryId);
        expect(
          row.score,
          `${label} canonical[${categoryId}] === report.scores[${categoryId}]`,
        ).toBe(scores[categoryId]);
      }
    });

    it(`${label}: takes.overall_score analogue === canonical overall (D), not A`, () => {
      const report = buildReport() as AnyRec;
      const v2 = buildV2OfReport(report as never);
      expect(denormOverall(report)).toBe(canonicalOverall(v2));
    });
  }

  it("strong-complete: the comparison column is the CANONICAL marks, NOT the deprecated in-payload copy", () => {
    // The deprecated in-payload V2Report.scores is derived from the AI judgement A
    // (score_summary.category_scores) and DIVERGES from report.scores where A and the canonical
    // marks differ with no cap. report.scores (→ takes.scores) tracks the canonical surface.
    const report = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
    const v2 = strongV2(report as never);
    const deprecatedInPayload = v2.scores as Record<string, number | null>;
    const comparisonColumn = denormScores(report); // == report.scores

    // acting/vocal/technical/brief_adherence diverge between A (deprecated copy) and canonical.
    expect(deprecatedInPayload.acting).toBe(91); // A
    expect(comparisonColumn.acting).toBe(93); // canonical (→ takes.scores)
    expect(comparisonColumn.acting).not.toBe(deprecatedInPayload.acting);
    expect(comparisonColumn.vocal).not.toBe(deprecatedInPayload.vocal); // 94 vs 92
    expect(comparisonColumn.technical).not.toBe(deprecatedInPayload.technical); // 91 vs 89
    expect(comparisonColumn.brief_adherence).not.toBe(deprecatedInPayload.brief_adherence); // 96 vs 94

    // And the canonical surface the render reads agrees with the comparison column, not the copy.
    const canon = Object.fromEntries(
      canonicalCategoryRows(v2).map((r) => [r.category_id as string, r.score as number | null]),
    );
    expect(canon.acting).toBe(comparisonColumn.acting);
    expect(canon.vocal).toBe(comparisonColumn.vocal);
    expect(canon.technical).toBe(comparisonColumn.technical);
    expect(canon.brief_adherence).toBe(comparisonColumn.brief_adherence);
  });
});

describe("Δ6 P3a — D3: behaviour-neutrality (the annotation slice alters NO runtime output)", () => {
  // Byte-identity pins of the exact surfaces the P3a annotations touch (the deprecated in-payload
  // copy and the denormalised comparison-column tuple). The slice is comments/JSDoc only and
  // removes nothing, so these are the pre-annotation values — any future runtime drift fails here.

  it("strong-complete: deprecated in-payload copy + denorm column tuple are byte-identical", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
    const v2 = strongV2(report as never);

    // Deprecated in-payload V2Report copy (NOT performer-visible; NOT the comparison path).
    expect(v2.scores).toEqual({
      brief_adherence: 94,
      acting: 91,
      vocal: 92,
      audio: 90,
      technical: 89,
    });
    expect(v2.brief_adherence_breakdown).toEqual({
      summary:
        "Brief mostly achieved: Side 1, song, package continuity and framing are verified; filename/upload remain final admin checks.",
      material_compliance: 94,
      readiness_impact: "supports_submission",
    });

    // Denormalised comparison-column tuple (the PRESERVED canonical path → takes.*).
    expect({ scores: denormScores(report), overall_score: denormOverall(report) }).toEqual({
      scores: {
        technical: 91,
        audio: 90,
        vocal: 94,
        acting: 93,
        brief_adherence: 96,
        professional_presentation: 92,
      },
      overall_score: 93,
    });
  });

  it("canary-A: deprecated in-payload copy + denorm column tuple are byte-identical", () => {
    const report = buildS10CanaryAReportInput() as AnyRec;
    const v2 = canaryV2(report as never);

    expect(v2.scores).toEqual({ brief_adherence: 25, audio: 86, technical: 82 });
    expect(v2.brief_adherence_breakdown).toEqual({
      summary:
        "S10 route reconciled the brief achievement result with stricter observed-tape evidence before rendering: One continuous video containing the full package is observed as partially_present / cut_off. One final checked file is observed as partially_present / cut_off.",
      material_compliance: 25,
      readiness_impact: "submission_blocker",
    });

    expect({ scores: denormScores(report), overall_score: denormOverall(report) }).toEqual({
      scores: { vocal: 72, brief_adherence: 25, technical: 82, audio: 86 },
      overall_score: 54,
    });
  });

  it("buildV2Report is a pure function: identical inputs → deep-equal payloads (no hidden state)", () => {
    expect(JSON.stringify(strongV2())).toBe(JSON.stringify(strongV2()));
    expect(JSON.stringify(canaryV2())).toBe(JSON.stringify(canaryV2()));
  });
});
