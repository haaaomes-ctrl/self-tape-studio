// Δ6 Slice 1 — canonical-score invariant (R = D), END-TO-END.
//
// Conformance per ADR-0008 + arch-d6-canonical-score-computation-spec (render-locus
// corrected): the performer-VISIBLE headline equals the canonical deterministic value
// D, NOT the AI judgement A. The visible surface is the view-model chokepoint
// (buildS10PerformerReportViewModel → a distinct `canonical_overall_score`), read by
// the PDF model (buildReportViewModel → modules.scoreSummary.display.overall) and the
// V2ReportView ScoreRing, gated by the existing `s10ScoreAuthorized` provenance
// predicate. `score_summary.overall_submission_readiness_score` STAYS = A.
//
// These tests FAIL against current code (which renders A: strong 91, canary 42,
// Repro-B 94) and pass once the slice lands. Numbers are derived from source, not
// hand-picked (see the derivation block at the end).

import { describe, expect, it } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { buildReportViewModel, type ScoreSummaryDisplay } from "@/lib/report-view-model";
import { applyReadinessScoreSemantics } from "@/server/s10-readiness-score-semantics.server";
import { recomputeOverall, weightsForType, applyCapsAndLabel } from "@/lib/audition-rules";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10ReproBAudioCappedReportInput,
  buildS10ReproBAudioCappedViewContext,
  S10_REPRO_B_AI_JUDGEMENT_A,
  S10_REPRO_B_CANONICAL_D,
  S10_REPRO_B_RECOMPUTE_PRE_CAP,
} from "@/test-fixtures/s10-repro-b-audio-capped";

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
function reproBV2(report: AnyRec = buildS10ReproBAudioCappedReportInput()) {
  return buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10ReproBAudioCappedViewContext() as never,
  });
}

// The performer-visible PDF headline number.
function visibleHeadline(v2: unknown): number | null {
  const model = buildReportViewModel(v2 as unknown as AnyRec, { takeNumber: 1 });
  expect(model).not.toBeNull();
  const display = model!.modules.scoreSummary.display as ScoreSummaryDisplay | null;
  return display ? display.overall : null;
}

// The distinct canonical field on the view-model chokepoint (accessed via a Record
// cast so this file compiles against current code; it is undefined until the slice
// adds the field).
function canonicalField(v2: unknown): unknown {
  const vm = (v2 as AnyRec).s10_view_model as AnyRec | null | undefined;
  return vm ? vm.canonical_overall_score : undefined;
}

describe("Δ6 Slice 1 — visible headline === canonical deterministic D (R = D)", () => {
  it("strong: visible headline + canonical field are D (93), not the AI judgement A (91)", () => {
    const v2 = strongV2();
    expect(canonicalField(v2)).toBe(93); // view-model chokepoint field
    expect(visibleHeadline(v2)).toBe(93); // performer-visible PDF surface
    expect(visibleHeadline(v2)).not.toBe(91); // A is no longer the number
  });

  it("repro-b (INFLATION direction): visible headline is the audio-capped D (60), not the inflated A (94)", () => {
    const v2 = reproBV2();
    expect(canonicalField(v2)).toBe(S10_REPRO_B_CANONICAL_D); // 60
    expect(visibleHeadline(v2)).toBe(S10_REPRO_B_CANONICAL_D); // 60
    expect(visibleHeadline(v2)).not.toBe(S10_REPRO_B_AI_JUDGEMENT_A); // not 94
  });

  it("canary (harsh direction): visible headline is D (54), not the AI judgement A (42)", () => {
    const v2 = canaryV2();
    expect(canonicalField(v2)).toBe(54);
    expect(visibleHeadline(v2)).toBe(54);
    expect(visibleHeadline(v2)).not.toBe(42);
  });

  it("withhold: render suppresses via the existing s10ScoreAuthorized gate even though the field carries D", () => {
    const report = buildS10CanaryAReportInput() as AnyRec;
    delete report.readiness_score_judgement; // missing-readiness → score_summary unauthorised
    const v2 = canaryV2(report);
    expect(v2.source_mode).toBe("s10_ai_report_model");
    // The visible headline stays null (the withhold seam is the UNCHANGED provenance
    // predicate, not a new predicate keyed on the canonical field's presence).
    expect(visibleHeadline(v2)).toBeNull();
  });

  it("cross-surface consistency: canonical field === payload overall_readiness === aggregate overall_score === D", () => {
    for (const [label, input, expected] of [
      ["strong", buildS10StrongCompleteProfessionalReportInput(), 93],
      ["canary", buildS10CanaryAReportInput(), 54],
      ["repro-b", buildS10ReproBAudioCappedReportInput(), 60],
    ] as const) {
      const v2 =
        label === "strong"
          ? strongV2(input as AnyRec)
          : label === "canary"
            ? canaryV2(input as AnyRec)
            : reproBV2(input as AnyRec);
      const aggregate = (input as AnyRec).overall_score; // takes.overall_score analogue
      expect(aggregate, `${label} fixture aggregate`).toBe(expected);
      expect(canonicalField(v2), `${label} canonical field`).toBe(expected);
      expect(v2.overall_readiness, `${label} payload`).toBe(expected);
      expect(visibleHeadline(v2), `${label} visible headline`).toBe(expected);
    }
  });
});

describe("Δ6 Slice 1 — canonical D is derived from source, not hand-picked", () => {
  it("canary: recompute(honest scores) = 66 → hard-blocker matrix cap = 54 (no min(.,A))", () => {
    const report = buildS10CanaryAReportInput() as AnyRec;
    const recompute = recomputeOverall(
      report.scores as never,
      weightsForType("musical_theatre"),
    ).overall;
    expect(recompute).toBe(66);
    const semantics = applyReadinessScoreSemantics({
      report,
      matrix: report.brief_achievement_matrix as never,
      currentOverallScore: recompute,
      selectedLevel: "professional",
    });
    expect(semantics.overall).toBe(54); // matrix decision cap; A (42) no longer pulls it down
  });

  it("repro-b: recompute = 87 → <35 audio cap = 60 (deterministic below the high A)", () => {
    const report = buildS10ReproBAudioCappedReportInput() as AnyRec;
    const recompute = recomputeOverall(
      report.scores as never,
      weightsForType("musical_theatre"),
    ).overall;
    expect(recompute).toBe(S10_REPRO_B_RECOMPUTE_PRE_CAP); // 87
    const capped = applyCapsAndLabel({
      overall: recompute,
      scores: report.scores as never,
      briefAdherence: 96,
      mode: "brief",
      level: "professional",
      blockers: [],
    }).overall;
    expect(capped).toBe(S10_REPRO_B_CANONICAL_D); // 60
  });
});
