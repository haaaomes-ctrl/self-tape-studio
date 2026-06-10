// S11-CAL-01 (item 6) — positivity-ratio honesty guard.
//
// A deterministic, post-report diagnostic that flags a NOT-READY report carrying
// more positive surface (strengths / preserve / do-not-overfix) than critical
// surface (fix hierarchy + block_reasons). It mirrors the P5 valence-reconciliation
// emit pattern: a small count over the finalised canonical verdict. It is internal-
// only (never performer-facing) and MUST be score-inert — it reads the report and
// emits a metric; it never writes any score/verdict/cap field.
//
// The verdict-guard / score-inert clauses are asserted here; the function does not
// yet exist, so they FAIL-first against current code.

import { describe, expect, it, vi } from "vitest";
import { evaluateReportPositivityBalance } from "@/server/report-polish.server";

type AnyRec = Record<string, unknown>;

function strength(id: string): AnyRec {
  return { id, title: `Strength ${id}`, detail: `Observed strength ${id}.` };
}
function fix(id: string): AnyRec {
  return { id, title: `Fix ${id}`, issue: `Issue ${id}.`, exact_action: `Do ${id}.` };
}

// A not-ready report whose POSITIVE surfaces (5) outnumber its CRITICAL surfaces (1).
function notReadyPositivityHeavyReport(): AnyRec {
  return {
    overall_score: 10,
    overall_score_final: 10,
    verdict_final: "Not ready yet",
    submission_verdict: { label: "Not ready yet", blocked: true },
    block_reasons: ["No audio was detected, so the performance cannot be assessed."],
    readiness_score_judgement: {
      overall_submission_readiness_score: 10,
      score_band_label: "not_submission_ready",
    },
    s10_fix_hierarchy: {
      fix_first: null,
      priority_fixes: [],
      must_fix_before_submitting: [],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [],
    },
    s10_professional_critique: {
      performance_strengths: [strength("p1"), strength("p2")],
      brief_package_strengths: [],
      technical_presentation_strengths: [strength("t1")],
      vocal_or_singing_strengths: [],
      acting_strengths: [],
      movement_or_physical_strengths: [],
      professional_presentation_notes: [strength("n1")],
      preserve: [strength("pr1")],
      do_not_overfix: [],
    },
  };
}

// A not-ready report whose CRITICAL surfaces outnumber its positive surfaces.
function notReadyCriticalHeavyReport(): AnyRec {
  return {
    overall_score: 40,
    overall_score_final: 40,
    verdict_final: "Worth another take",
    submission_verdict: { label: "Worth another take", blocked: false },
    block_reasons: ["The required Side 1 acting scene is missing."],
    readiness_score_judgement: {
      overall_submission_readiness_score: 40,
      score_band_label: "retake_required_if_possible",
    },
    s10_fix_hierarchy: {
      fix_first: fix("ff"),
      priority_fixes: [fix("pf1"), fix("pf2")],
      must_fix_before_submitting: [fix("mf1")],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [],
    },
    s10_professional_critique: {
      performance_strengths: [strength("p1")],
      brief_package_strengths: [],
      technical_presentation_strengths: [],
      vocal_or_singing_strengths: [],
      acting_strengths: [],
      movement_or_physical_strengths: [],
      professional_presentation_notes: [],
      preserve: [],
      do_not_overfix: [],
    },
  };
}

// A submit-ready report (positive verdict) — the guard must NOT fire here, however
// many strengths exist (proportionate praise is allowed at the top).
function submitReadyReport(): AnyRec {
  const base = notReadyPositivityHeavyReport();
  base.overall_score = 92;
  base.overall_score_final = 92;
  base.verdict_final = "Strong for this level";
  base.submission_verdict = { label: "Strong for this level", blocked: false };
  base.block_reasons = [];
  (base.readiness_score_judgement as AnyRec).overall_submission_readiness_score = 92;
  (base.readiness_score_judgement as AnyRec).score_band_label = "submit_strong_submission";
  return base;
}

describe("S11-CAL-01 — evaluateReportPositivityBalance", () => {
  it("flags a NOT-READY report with more positive than critical surface (emits the metric)", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = notReadyPositivityHeavyReport();
      const result = evaluateReportPositivityBalance(report, "take-pos-1");
      expect(result.notReady).toBe(true);
      expect(result.positiveSurfaceCount).toBeGreaterThan(result.criticalSurfaceCount);
      expect(result.flagged).toBe(true);
      const emitted = logSpy.mock.calls.some((call) =>
        String(call[0]).includes("s10_positivity_ratio_guard_flagged"),
      );
      expect(emitted).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("does NOT flag a NOT-READY report whose critical surface dominates", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = notReadyCriticalHeavyReport();
      const result = evaluateReportPositivityBalance(report, "take-pos-2");
      expect(result.notReady).toBe(true);
      expect(result.flagged).toBe(false);
      const emitted = logSpy.mock.calls.some((call) =>
        String(call[0]).includes("s10_positivity_ratio_guard_flagged"),
      );
      expect(emitted).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("does NOT flag a submit-ready (positive-verdict) report, however many strengths", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = submitReadyReport();
      const result = evaluateReportPositivityBalance(report, "take-pos-3");
      expect(result.notReady).toBe(false);
      expect(result.flagged).toBe(false);
      const emitted = logSpy.mock.calls.some((call) =>
        String(call[0]).includes("s10_positivity_ratio_guard_flagged"),
      );
      expect(emitted).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("is score-inert: the report's score/verdict fields are byte-identical before and after", () => {
    const report = notReadyPositivityHeavyReport();
    const before = JSON.stringify(report);
    evaluateReportPositivityBalance(report, "take-pos-4");
    expect(JSON.stringify(report)).toBe(before);
  });
});
