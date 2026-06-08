// Δ6 — material_compliance ceiling invariant (honesty guardrail). TEST-ONLY.
//
// Slice 3 (#245) made the performer-visible material_compliance read the canonical
// report.brief_adherence_breakdown.material_compliance, which CAN read HIGHER than A's
// score_summary.brief_completion_score (strong take: canonical 100 vs A 94). The operator
// signed that up-movement off ON THE BASIS that the matrix only ever caps DOWNWARD — so a high
// canonical value is structurally earned ("the matrix found nothing missing"), never AI
// generosity. That guarantee was true by reasoning but unenforced; this test converts it into a
// CI-enforced structural invariant, so a future change to the cap logic that broke it fails CI.
//
// THE INVARIANT (CONDITIONAL on the matrix), after applyReadinessScoreSemantics runs, with
// constraint = deriveReadinessConstraint(matrix):
//   • constraint.cap != null (matrix demands a downshift):
//       report.brief_adherence_breakdown.material_compliance <= constraint.cap
//       AND report.scores.brief_adherence <= constraint.cap   (same capNumberField site).
//   • constraint.cap == null (no downshift):
//       NO ceiling — a high value (incl. 100) is legitimate; the cap step is a no-op, so the
//       value is UNCHANGED (asserted), not merely bounded.
// The cap is obtained by CALLING deriveReadinessConstraint, never hard-coded — the test pins the
// RELATIONSHIP, not a magic number. Verified mechanism (s10-readiness-score-semantics.server.ts):
// capNumberField (:531) writes target[field] = cap ONLY when original > cap (it never RAISES);
// the brief_adherence (:656) and material_compliance (:665) cap calls are guarded by
// `if (constraint.cap != null)` (:655). So material_compliance is only ever capped, never raised.

import { describe, expect, it } from "vitest";
import {
  applyReadinessScoreSemantics,
  deriveReadinessConstraint,
} from "@/server/s10-readiness-score-semantics.server";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { recomputeOverall, weightsForType } from "@/lib/audition-rules";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import { buildS10StrongCompleteProfessionalReportInput } from "@/test-fixtures/s10-strong-complete-professional";

type AnyRec = Record<string, unknown>;

const MT = weightsForType("musical_theatre");

function materialOf(report: AnyRec): number {
  return (report.brief_adherence_breakdown as AnyRec).material_compliance as number;
}
function briefAdherenceOf(report: AnyRec): number {
  return (report.scores as AnyRec).brief_adherence as number;
}

// Run the REAL semantics on a report where the AI marked brief_adherence AND material_compliance
// at `rawValue`, under `matrix`. Mutates and returns the (post-cap) report.
function runSemantics(report: AnyRec, matrix: unknown, rawValue: number): AnyRec {
  const scores = report.scores as Record<string, number | null>;
  scores.brief_adherence = rawValue;
  if (!report.brief_adherence_breakdown || typeof report.brief_adherence_breakdown !== "object") {
    report.brief_adherence_breakdown = {};
  }
  (report.brief_adherence_breakdown as AnyRec).material_compliance = rawValue;
  const recompute = recomputeOverall(scores as never, MT).overall;
  applyReadinessScoreSemantics({
    report,
    matrix: matrix as never,
    currentOverallScore: recompute,
    selectedLevel: "professional",
  });
  return report;
}

// A clean (no-blocker) matrix → deriveReadinessConstraint(...).cap === null.
function cleanMatrix(): unknown {
  return (buildS10StrongCompleteProfessionalReportInput() as AnyRec).brief_achievement_matrix;
}
// The canary matrix → hard mandatory blocker (Side 1 not_achieved) → cap 54.
function hardBlockerMatrix(): unknown {
  return (buildS10CanaryAReportInput() as AnyRec).brief_achievement_matrix;
}
// A mandatory-GAP matrix (cap 69), derived from the canary matrix by softening the hard blocker
// (Side 1) into a partial/material_gap so NO hard blocker remains — only mandatory gaps.
function gapMatrix(): unknown {
  const matrix = (buildS10CanaryAReportInput() as AnyRec).brief_achievement_matrix as AnyRec;
  for (const r of matrix.requirement_results as AnyRec[]) {
    if (r.achievement_status === "not_achieved" || r.submission_impact === "submission_blocker") {
      r.achievement_status = "partly_achieved";
      r.completion_status = "incomplete";
      r.submission_impact = "material_gap";
    }
  }
  return matrix;
}

describe("Δ6 — canonical material_compliance can never exceed the matrix ceiling (honesty guardrail)", () => {
  it("(a) matrix caps (hard blocker): a high AI material_compliance is forced down to <= the DERIVED cap", () => {
    const matrix = hardBlockerMatrix();
    const constraint = deriveReadinessConstraint(matrix as never);
    expect(constraint.cap).not.toBeNull(); // the canary matrix DOES impose a downshift
    const cap = constraint.cap as number;

    const report = runSemantics(buildS10CanaryAReportInput() as AnyRec, matrix, 90);

    expect(materialOf(report)).toBeLessThanOrEqual(cap);
    expect(briefAdherenceOf(report)).toBeLessThanOrEqual(cap);
    // and the cap actually FIRED (90 was above it) — proves a non-vacuous pass, not a no-op
    expect(materialOf(report)).toBe(cap);
    expect(briefAdherenceOf(report)).toBe(cap);
  });

  it("(b) no matrix cap (clean): a high material_compliance (100) is PRESERVED, never forced down", () => {
    const matrix = cleanMatrix();
    const constraint = deriveReadinessConstraint(matrix as never);
    expect(constraint.cap).toBeNull(); // no downshift → there is no ceiling to breach

    const report = runSemantics(
      buildS10StrongCompleteProfessionalReportInput() as AnyRec,
      matrix,
      100,
    );

    expect(materialOf(report)).toBe(100); // unchanged — the high value is legitimately earned
    expect(briefAdherenceOf(report)).toBe(100);
  });

  it("(c) property sweep: material_compliance <= (cap ?? +Infinity) across matrices and raw values; no-cap arm is unchanged", () => {
    const arms = [
      {
        label: "hard-blocker",
        matrix: hardBlockerMatrix(),
        build: () => buildS10CanaryAReportInput() as AnyRec,
      },
      {
        label: "mandatory-gap",
        matrix: gapMatrix(),
        build: () => buildS10CanaryAReportInput() as AnyRec,
      },
      {
        label: "clean",
        matrix: cleanMatrix(),
        build: () => buildS10StrongCompleteProfessionalReportInput() as AnyRec,
      },
    ];
    // self-validate that the constructed matrices cover BOTH arms with the real cap values
    expect(deriveReadinessConstraint(arms[0].matrix as never).cap).toBe(54);
    expect(deriveReadinessConstraint(arms[1].matrix as never).cap).toBe(69);
    expect(deriveReadinessConstraint(arms[2].matrix as never).cap).toBeNull();

    for (const { label, matrix, build } of arms) {
      const cap = deriveReadinessConstraint(matrix as never).cap;
      const ceiling = cap ?? Number.POSITIVE_INFINITY;
      for (const rawValue of [30, 60, 90, 100]) {
        const report = runSemantics(build(), matrix, rawValue);
        const material = materialOf(report);
        const briefAdh = briefAdherenceOf(report);
        // universal invariant: never above the (possibly infinite) ceiling
        expect(material, `${label} raw=${rawValue} material`).toBeLessThanOrEqual(ceiling);
        expect(briefAdh, `${label} raw=${rawValue} brief_adherence`).toBeLessThanOrEqual(ceiling);
        if (cap == null) {
          // no-cap arm: the cap step is a no-op, so the value is UNCHANGED (not merely bounded)
          expect(material, `${label} raw=${rawValue} material unchanged`).toBe(rawValue);
          expect(briefAdh, `${label} raw=${rawValue} brief_adherence unchanged`).toBe(rawValue);
        }
      }
    }
  });

  it("(d) cross-check: the view-model canonical_material_compliance equals the post-semantics capped value", () => {
    const matrix = hardBlockerMatrix();
    const cap = deriveReadinessConstraint(matrix as never).cap as number;
    const report = runSemantics(buildS10CanaryAReportInput() as AnyRec, matrix, 90);
    const persisted = materialOf(report);
    expect(persisted).toBeLessThanOrEqual(cap);

    // The performer-visible canonical field surfaces exactly the post-semantics (capped) value,
    // so the ceiling guarantee carries through to what the performer sees.
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    }) as unknown as AnyRec;
    const vm = v2.s10_view_model as AnyRec;
    expect(vm.canonical_material_compliance).toBe(persisted);
    expect(vm.canonical_material_compliance as number).toBeLessThanOrEqual(cap);
  });
});
