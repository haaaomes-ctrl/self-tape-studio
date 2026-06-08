// Δ6 Slice 3 — canonical sub-surfaces invariant (category scores + material_compliance),
// END-TO-END.
//
// Conformance per ADR-0008 + arch-d6-canonical-score-computation-spec (§Surface bindings
// rows for "category scores" and "material_compliance"): the performer-VISIBLE category
// scores and material_compliance equal the canonical deterministic sub-surfaces
// (report.scores[category_id] — matrix-capped for brief_adherence — and
// report.brief_adherence_breakdown.material_compliance), NOT the AI judgement A
// (score_summary.category_scores[*].score / score_summary.brief_completion_score). The
// visible surface is the view-model chokepoint (buildS10PerformerReportViewModel → distinct
// canonical_category_scores / canonical_material_compliance fields), read by the PDF model
// (buildReportViewModel → modules.scoreSummary.display) and the V2ReportView category card,
// gated by the EXISTING provenance seams (scoreAuthorized for the PDF category card; the
// brief_completion authority for material_compliance). score_summary.* STAYS = A (narration).
//
// These tests FAIL against current code (which renders A) and pass once the slice lands.
// Numbers are derived from source/fixtures and the real semantics (capNumberField), not
// hand-pinned — see the "derived from source" describe at the end.

import { describe, expect, it } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { buildReportViewModel, type ScoreSummaryDisplay } from "@/lib/report-view-model";
import { applyReadinessScoreSemantics } from "@/server/s10-readiness-score-semantics.server";
import { recomputeOverall, weightsForType } from "@/lib/audition-rules";
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

// The view-model chokepoint fields (accessed via Record casts so this file compiles against
// current code; they are undefined until the slice adds them).
function viewModel(v2: unknown): AnyRec | null {
  const vm = (v2 as AnyRec).s10_view_model as AnyRec | null | undefined;
  return vm ?? null;
}
function canonicalCategoryRows(v2: unknown): AnyRec[] {
  const rows = viewModel(v2)?.canonical_category_scores;
  return Array.isArray(rows) ? (rows as AnyRec[]) : [];
}
function canonicalCategoryScore(v2: unknown, categoryId: string): number | null | undefined {
  const row = canonicalCategoryRows(v2).find((r) => r.category_id === categoryId);
  return row ? (row.score as number | null) : undefined;
}
function aCategoryScore(v2: unknown, categoryId: string): number | null | undefined {
  const ss = viewModel(v2)?.score_summary as AnyRec | undefined;
  const rows = Array.isArray(ss?.category_scores) ? (ss!.category_scores as AnyRec[]) : [];
  const row = rows.find((r) => r.category_id === categoryId);
  return row ? (row.score as number | null) : undefined;
}
function canonicalMaterialCompliance(v2: unknown): number | null | undefined {
  return viewModel(v2)?.canonical_material_compliance as number | null | undefined;
}
function aBriefCompletion(v2: unknown): number | null | undefined {
  const ss = viewModel(v2)?.score_summary as AnyRec | undefined;
  return ss?.brief_completion_score as number | null | undefined;
}

// The performer-visible PDF score-summary display.
function visibleScoreSummary(v2: unknown): ScoreSummaryDisplay | null {
  const model = buildReportViewModel(v2 as unknown as AnyRec, { takeNumber: 1 });
  expect(model).not.toBeNull();
  return (model!.modules.scoreSummary.display as ScoreSummaryDisplay | null) ?? null;
}
function visibleCategoryScore(v2: unknown, categoryId: string): number | null | undefined {
  const display = visibleScoreSummary(v2);
  const row = display?.categories.find((r) => r.categoryId === categoryId);
  return row ? row.score : undefined;
}
function visibleBriefCompletion(v2: unknown): number | null | undefined {
  return visibleScoreSummary(v2)?.briefCompletion;
}

// Construct a take where the AI marked brief_adherence / material HIGH (80) but a hard
// mandatory blocker (the canary matrix) caps the canonical sub-surfaces to 54. The cap is
// applied by the REAL semantics (capNumberField), NOT hand-pinned — this is the only regime
// where brief_adherence practically diverges from A through a matrix cap.
function cappedBriefAdherenceReport(): { report: AnyRec; cap: number } {
  const report = buildS10CanaryAReportInput() as AnyRec;
  const scores = report.scores as Record<string, number | null>;
  scores.brief_adherence = 80; // AI mark, pre-cap
  (report.brief_adherence_breakdown as AnyRec).material_compliance = 80; // pre-cap
  const rj = report.readiness_score_judgement as AnyRec;
  rj.brief_completion_score = 80; // A's brief completion
  const cats = rj.category_scores as AnyRec[];
  cats.find((c) => c.category_id === "brief_adherence")!.score = 80; // A's category mark
  const recompute = recomputeOverall(scores as never, weightsForType("musical_theatre")).overall;
  const sem = applyReadinessScoreSemantics({
    report,
    matrix: report.brief_achievement_matrix as never,
    currentOverallScore: recompute,
    selectedLevel: "professional",
  });
  // Real semantics caps report.scores.brief_adherence + brief_adherence_breakdown.material_compliance
  // to the hard-blocker cap; the AI judgement A (readiness.category_scores / brief_completion_score)
  // is untouched and stays 80.
  report.readiness_score_judgement = sem.judgement;
  report.overall_score = sem.overall;
  report.overall_score_final = sem.overall;
  return { report, cap: sem.overall };
}

describe("Δ6 Slice 3 — visible category scores === canonical report.scores (matrix-capped brief_adherence)", () => {
  it("capped brief_adherence: visible + canonical field are the capped 54, not the AI mark 80", () => {
    const { report, cap } = cappedBriefAdherenceReport();
    expect(cap).toBe(54); // hard-blocker matrix cap, derived from the canary matrix
    const v2 = canaryV2(report);

    // view-model chokepoint
    expect(canonicalCategoryScore(v2, "brief_adherence")).toBe(54); // canonical (report.scores, capped)
    expect(aCategoryScore(v2, "brief_adherence")).toBe(80); // A is unchanged
    // performer-visible PDF surface
    expect(visibleCategoryScore(v2, "brief_adherence")).toBe(54);
    expect(visibleCategoryScore(v2, "brief_adherence")).not.toBe(80);
  });

  it("narration preserved: the canonical brief_adherence row keeps A's prose, only the score is canonical", () => {
    const { report } = cappedBriefAdherenceReport();
    const v2 = canaryV2(report);
    const canonicalRow = canonicalCategoryRows(v2).find((r) => r.category_id === "brief_adherence");
    expect(canonicalRow).toBeDefined();
    // narration is A's domain (the canary fixture's brief_adherence prose), unchanged
    expect(canonicalRow!.why_not_full_score).toBe("Mandatory material is incomplete.");
    expect(canonicalRow!.close_gap).toBe("Record Side 1 and complete the song/final package.");
    expect(canonicalRow!.score_basis).toContain("Required Side 1");
    // but the score is the canonical capped value
    expect(canonicalRow!.score).toBe(54);
  });

  it("non-brief categories: visible score is report.scores (canonical), even where A diverges with no cap", () => {
    // The strong fixture authors report.scores and readiness.category_scores INDEPENDENTLY,
    // so they diverge with NO matrix cap: report.scores {acting 93, vocal 94, technical 91,
    // brief_adherence 96} vs A {acting 91, vocal 92, technical 89, brief_adherence 94}. Option A
    // shows the canonical (the deterministic marks that fed D) — a flagged visible behaviour change.
    const v2 = strongV2();
    for (const [categoryId, canonical, a] of [
      ["acting", 93, 91],
      ["vocal", 94, 92],
      ["technical", 91, 89],
      ["brief_adherence", 96, 94],
    ] as const) {
      expect(canonicalCategoryScore(v2, categoryId), `${categoryId} canonical field`).toBe(
        canonical,
      );
      expect(aCategoryScore(v2, categoryId), `${categoryId} A field`).toBe(a);
      expect(visibleCategoryScore(v2, categoryId), `${categoryId} visible`).toBe(canonical);
      expect(visibleCategoryScore(v2, categoryId), `${categoryId} not A`).not.toBe(a);
    }
  });
});

describe("Δ6 Slice 3 — visible material_compliance === canonical brief_adherence_breakdown", () => {
  it("capped: visible + canonical material_compliance are the capped 54, not the AI brief_completion 80", () => {
    const { report } = cappedBriefAdherenceReport();
    const v2 = canaryV2(report);
    expect(canonicalMaterialCompliance(v2)).toBe(54); // canonical (breakdown, capped)
    expect(aBriefCompletion(v2)).toBe(80); // A is unchanged
    expect(visibleBriefCompletion(v2)).toBe(54);
    expect(visibleBriefCompletion(v2)).not.toBe(80);
  });

  it("strong (no cap, independent authoring): visible material_compliance is the canonical 100, not A's 94", () => {
    const v2 = strongV2();
    expect(canonicalMaterialCompliance(v2)).toBe(100); // report.brief_adherence_breakdown.material_compliance
    expect(aBriefCompletion(v2)).toBe(94); // score_summary.brief_completion_score = A
    expect(visibleBriefCompletion(v2)).toBe(100);
  });
});

describe("Δ6 Slice 3 — withhold preserved (existing provenance seam, no new predicate)", () => {
  it("missing readiness → score_summary unauthorised → canonical category + material withheld as today", () => {
    const report = buildS10CanaryAReportInput() as AnyRec;
    delete report.readiness_score_judgement; // → score_summary section unauthorised
    const v2 = canaryV2(report);
    expect(v2.source_mode).toBe("s10_ai_report_model");

    // view-model chokepoint: no readiness rows → empty / null canonical sub-surfaces
    expect(canonicalCategoryRows(v2)).toHaveLength(0);
    expect(canonicalMaterialCompliance(v2)).toBeNull();

    // performer-visible PDF surface: category card withheld (scoreAuthorized false), material null
    const display = visibleScoreSummary(v2);
    expect(display?.categories ?? []).toHaveLength(0);
    expect(display?.briefCompletion ?? null).toBeNull();
  });
});

describe("Δ6 Slice 3 — cross-slice coherence (all surfaces from the same deterministic source)", () => {
  it("a capped/blocked take: capped headline + retake verdict + capped brief_adherence + capped material all agree", () => {
    const { report, cap } = cappedBriefAdherenceReport();
    const v2 = canaryV2(report);
    const model = buildReportViewModel(v2 as unknown as AnyRec, { takeNumber: 1 });
    expect(model).not.toBeNull();

    // Slice 1: canonical headline === capped D
    const ss = model!.modules.scoreSummary.display as ScoreSummaryDisplay | null;
    expect(ss?.overall).toBe(cap); // 54
    // Slice 2: canonical verdict === retake (deterministic submission_verdict, capped + blocked)
    const vm = viewModel(v2);
    expect((vm?.canonical_verdict as AnyRec | null)?.decision).toBe("retake_required_if_possible");
    // Slice 3: canonical brief_adherence category + material === the same capped value
    expect(visibleCategoryScore(v2, "brief_adherence")).toBe(cap); // 54
    expect(visibleBriefCompletion(v2)).toBe(cap); // 54
  });
});

describe("Δ6 Slice 3 — canonical sub-surfaces are derived from source, not hand-picked", () => {
  it("the real semantics caps report.scores.brief_adherence and material_compliance to the hard-blocker cap", () => {
    const report = buildS10CanaryAReportInput() as AnyRec;
    const scores = report.scores as Record<string, number | null>;
    scores.brief_adherence = 80;
    (report.brief_adherence_breakdown as AnyRec).material_compliance = 80;
    const recompute = recomputeOverall(scores as never, weightsForType("musical_theatre")).overall;
    const sem = applyReadinessScoreSemantics({
      report,
      matrix: report.brief_achievement_matrix as never,
      currentOverallScore: recompute,
      selectedLevel: "professional",
    });
    expect(sem.overall).toBe(54); // hard-blocker matrix cap
    expect((report.scores as AnyRec).brief_adherence).toBe(54); // capNumberField lowered 80 → 54
    expect((report.brief_adherence_breakdown as AnyRec).material_compliance).toBe(54); // and the breakdown
  });
});
