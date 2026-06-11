// Unit tests for the canonical lossless report view-model (tc_report_vm_v1).
//
// The shim is exercised against the same golden fixtures the route rendering
// tests use (built through buildV2Report so the input is the real persisted
// shape), including the MANDATORY no-readiness case: currently persisted
// reports carry no s10_module_readiness block, and state resolution must
// degrade to presence-derived states without claiming readiness grounding.

import { describe, expect, it } from "vitest";
import {
  buildReportViewModel,
  containsProfessional90PlusClaim,
  estimateReportModuleCosts,
  professionalCompetitiveScoreZone,
  REPORT_MODULE_KEYS,
  REPORT_MODULE_PROVENANCE,
  scoreTone,
  statusChipDisplay,
  observedStatusChipDisplay,
  verdictDisplay,
  type FixHierarchyDisplay,
  type RecommendationDisplay,
  type ReportModuleKey,
  type ReportViewModel,
  type BriefAchievementDisplay,
  type ScoreSummaryDisplay,
  type SelectedLevelCalibrationDisplay,
} from "@/lib/report-view-model";
import { S10_ROUTE_REQUIRED_SECTION_KEYS } from "@/lib/audition-rules";
import { S10_REPORT_MODULE_COVERAGE } from "@/server/s10-report-prompt-map.server";
import { buildV2Report } from "@/server/v2-report-builder.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

function canaryV2Report() {
  return buildV2Report({
    legacyReport: buildS10CanaryAReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  }) as unknown as Record<string, unknown>;
}

function strongCompleteV2Report() {
  return buildV2Report({
    legacyReport: buildS10StrongCompleteProfessionalReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  }) as unknown as Record<string, unknown>;
}

function vm(report: Record<string, unknown>): ReportViewModel {
  const result = buildReportViewModel(report, { takeNumber: 1 });
  expect(result).not.toBeNull();
  return result as ReportViewModel;
}

describe("display mappers", () => {
  it("maps every live readiness decision to a design verdict", () => {
    expect(verdictDisplay("submit")).toMatchObject({ key: "submit", tone: "success" });
    expect(verdictDisplay("submit_if_deadline_is_close")).toMatchObject({
      key: "submit_if_close",
      tone: "royal",
    });
    expect(verdictDisplay("review_carefully")).toMatchObject({
      key: "review_carefully",
      tone: "warning",
    });
    expect(verdictDisplay("retake_required_if_possible")).toMatchObject({
      key: "retake",
      tone: "danger",
    });
    expect(verdictDisplay(null)).toBeNull();
    // Unknown decisions degrade to a visible review chip, never disappear.
    expect(verdictDisplay("future_decision_value")?.key).toBe("review_carefully");
  });

  it("keeps not_assessable and not_applicable as DISTINCT muted chips", () => {
    const notAssessable = statusChipDisplay("not_assessable");
    const notApplicable = statusChipDisplay("not_applicable");
    expect(notAssessable).toMatchObject({ kind: "not_assessable", tone: "muted" });
    expect(notApplicable).toMatchObject({ kind: "not_applicable", tone: "muted" });
    expect(notAssessable?.kind).not.toBe("missing");
    expect(notApplicable?.kind).not.toBe("missing");
    expect(notAssessable?.label).not.toBe(notApplicable?.label);
    // The achievement collapse keeps Missing for not_achieved only.
    expect(statusChipDisplay("not_achieved")).toMatchObject({ kind: "missing", tone: "danger" });
    expect(statusChipDisplay("mostly_achieved")?.kind).toBe("partial");
    expect(statusChipDisplay("partly_achieved")?.kind).toBe("partial");
    expect(statusChipDisplay("achieved")?.kind).toBe("achieved");
  });

  it("keeps observed-status uncertainty distinct from absence", () => {
    expect(observedStatusChipDisplay("absent")?.kind).toBe("missing");
    expect(observedStatusChipDisplay("not_assessable")?.kind).toBe("not_assessable");
    expect(observedStatusChipDisplay("uncertain")?.kind).toBe("not_assessable");
    expect(observedStatusChipDisplay("not_applicable")?.kind).toBe("not_applicable");
  });

  it("pins the agreed performer-facing copy (verdict chips + core brief labels)", () => {
    // Operator-approved wording (PR #199 review, 2026-06-06). If this test
    // fails, the copy drifted — that is a product decision, not a refactor.
    expect(verdictDisplay("submit")?.chipWord).toBe("Ready to submit");
    expect(verdictDisplay("submit_if_deadline_is_close")?.chipWord).toBe(
      "Submit only if you're out of time",
    );
    expect(verdictDisplay("review_carefully")?.chipWord).toBe("Check the report before you submit");
    expect(verdictDisplay("retake_required_if_possible")?.chipWord).toBe(
      "Retake before submitting",
    );

    expect(statusChipDisplay("achieved")?.label).toBe("Met");
    expect(statusChipDisplay("mostly_achieved")?.label).toBe("Mostly there");
    expect(statusChipDisplay("partly_achieved")?.label).toBe("Partly there");
    expect(statusChipDisplay("not_achieved")?.label).toBe("Not met");
    expect(statusChipDisplay("not_assessable")?.label).toBe("Missing from your tape");
  });

  it("applies the design score tone thresholds", () => {
    expect(scoreTone(80)).toBe("success");
    expect(scoreTone(79)).toBe("royal");
    expect(scoreTone(70)).toBe("royal");
    expect(scoreTone(69)).toBe("warning");
    expect(scoreTone(55)).toBe("warning");
    expect(scoreTone(54)).toBe("danger");
  });
});

describe("red-line guards", () => {
  it("only produces a professional competitive zone at 90+", () => {
    expect(professionalCompetitiveScoreZone(89)).toBeNull();
    expect(professionalCompetitiveScoreZone(null)).toBeNull();
    expect(professionalCompetitiveScoreZone(90)).toContain("90-91");
    expect(professionalCompetitiveScoreZone(98)).toContain("98-100");
  });

  it("detects unsupported 90+ claims", () => {
    expect(containsProfessional90PlusClaim("sits in the 90+ competitive zone")).toBe(true);
    expect(containsProfessional90PlusClaim("a solid 90 for this level")).toBe(true);
    expect(containsProfessional90PlusClaim("strong work at 85")).toBe(false);
    expect(containsProfessional90PlusClaim(null)).toBe(false);
  });

  it("suppresses an unsupported 90+ score meaning when overall is below 90", () => {
    const report = canaryV2Report();
    const view = report.s10_view_model as Record<string, unknown>;
    const calibration = view.selected_level_calibration as Record<string, unknown>;
    calibration.score_meaning = "This take sits in the 90+ competitive zone.";

    const model = vm(report);
    const display = model.modules.selectedLevelCalibration
      .display as SelectedLevelCalibrationDisplay;
    expect(display.scoreMeaning).toBeNull();
    expect(display.scoreMeaningSuppressed).toBe(true);
  });
});

// S11-UX-04a — B4 follow-up: when nothing was observed, the observed-tape module
// must not leave a stray "Not assessed" empty card beside the merged
// Observed+Presentation section. The empty card is governed by the module's
// emptyKind: "hidden" suppresses it; "not_assessed" keeps it visible. A genuine
// readiness reason must still surface (never suppress real information).
describe("S11-UX-04a — observed-tape empty card suppression (B4 follow-up)", () => {
  function emptyObservedReport(): Record<string, unknown> {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, unknown>;
    // Nothing observed: no sequence, no component verifications, no media.
    view.observed_tape = {
      observed_tape_sequence: [],
      component_verifications: [],
      media_observation_summary: null,
    };
    return report;
  }

  it("hides the empty card when nothing was observed and there is no readiness reason", () => {
    const report = emptyObservedReport();
    expect(report.s10_module_readiness).toBeUndefined();

    const observed = vm(report).modules.observedTape;
    expect(observed.state).toBe("empty");
    // "hidden" → renderEmptyStateCards skips it (no stray "Not assessed" card).
    expect(observed.emptyKind).toBe("hidden");
    expect(observed.reason).toBeNull();
  });

  it("still surfaces a not-assessed card when a genuine readiness reason exists", () => {
    const report = emptyObservedReport();
    report.s10_module_readiness = {
      results: [
        {
          report_module: "observed tape",
          status: "missing",
          reason: "The observed-tape pass produced no usable evidence for this run.",
          repair_triggered: true,
          blocks_report_value: false,
          decision_critical: false,
        },
      ],
    };

    const observed = vm(report).modules.observedTape;
    expect(observed.state).toBe("empty");
    // A real readiness reason must remain visible — never suppressed.
    expect(observed.emptyKind).toBe("not_assessed");
    expect(observed.reason).toContain("no usable evidence");
  });

  it("leaves the populated observed-tape case unchanged", () => {
    const observed = vm(strongCompleteV2Report()).modules.observedTape;
    expect(observed.state).toBe("populated");
    expect(observed.emptyKind).toBeNull();
  });
});

describe("canary A (incomplete mandatory package) through the shim", () => {
  it("builds a populated S10 view-model with the fixture's decision and level", () => {
    const model = vm(canaryV2Report());
    expect(model.version).toBe("tc_report_vm_v1");
    expect(model.sourceMode).toBe("s10");
    expect(model.reportStatus.isLimited).toBe(false);

    const rec = model.modules.recommendation;
    expect(rec.state).toBe("populated");
    const recDisplay = rec.display as RecommendationDisplay;
    expect(recDisplay.decisionRaw).toBe("retake_required_if_possible");
    expect(recDisplay.verdict?.key).toBe("retake");
    expect(recDisplay.verdict?.tone).toBe("danger");

    expect(model.meta.judgedAgainst).toBe("Professional");
    expect(model.scoringBasisLine).toContain("Judged against: Professional");
    expect(model.scoringBasisLine).toContain("Scoring basis:");
  });

  it("NO-readiness fixture: every module resolves with readiness null (presence-derived states)", () => {
    const report = canaryV2Report();
    expect(report.s10_module_readiness).toBeUndefined();
    expect(report.report_status).toBeFalsy();

    const model = vm(report);
    for (const key of REPORT_MODULE_KEYS) {
      const module = model.modules[key];
      expect(module, key).toBeDefined();
      expect(
        module.readiness,
        `${key} readiness must be null without a readiness block`,
      ).toBeNull();
      expect(["populated", "empty", "limited"]).toContain(module.state);
      if (module.state !== "populated" && module.state !== "limited") {
        expect(module.emptyKind, `${key} empty state needs an emptyKind`).not.toBeNull();
      }
    }
  });

  it("renders the fix hierarchy losslessly including optional polish and do-not-overfix", () => {
    const model = vm(canaryV2Report());
    const fixes = model.modules.fixHierarchy;
    expect(fixes.state).toBe("populated");
    const display = fixes.display as FixHierarchyDisplay;
    expect(display.fixFirst?.title).toBeTruthy();
    // The five-bucket surface exists even when a bucket is empty — the
    // renderer decides empty-state copy; the shim never drops the bucket.
    expect(display).toHaveProperty("optionalPolish");
    expect(display).toHaveProperty("doNotOverfix");
    expect(display).toHaveProperty("preserve");
    expect(Array.isArray(display.optionalPolish)).toBe(true);
    expect(Array.isArray(display.doNotOverfix)).toBe(true);
    // Lossless layer keeps the raw S10 hierarchy.
    expect(fixes.data).toBe(
      (model.rawFallback.s10_view_model as Record<string, unknown>).fix_hierarchy,
    );
  });

  it("keeps brief achievement statuses distinct in the matrix rows", () => {
    const model = vm(canaryV2Report());
    const achievement = model.modules.briefAchievement;
    expect(achievement.state).toBe("populated");
    const display = achievement.display as BriefAchievementDisplay;
    expect(display.requirements.length).toBeGreaterThan(0);
    expect(display.totalCount).toBe(display.requirements.length);
    const kinds = new Set(display.requirements.map((row) => row.chip?.kind));
    // Canary A has a missing mandatory side — the matrix must say so.
    expect(kinds.has("missing")).toBe(true);
  });

  it("hides not_applicable requirement rows but keeps not_assessable rows visible", () => {
    const report = canaryV2Report();
    const view = report.s10_view_model as Record<string, unknown>;
    const matrix = view.brief_achievement_matrix as Record<string, unknown>;
    const results = matrix.requirement_results as Array<Record<string, unknown>>;
    const template = { ...results[0] };
    results.push(
      {
        ...template,
        requirement_id: "req-not-applicable",
        requirement_summary: "Requirement that does not apply to this tape",
        achievement_status: "not_applicable",
      },
      {
        ...template,
        requirement_id: "req-not-assessable",
        requirement_summary: "Requirement the tape never shows",
        achievement_status: "not_assessable",
      },
    );

    const model = vm(report);
    const display = model.modules.briefAchievement.display as BriefAchievementDisplay;
    const ids = display.requirements.map((row) => row.requirementId);
    // not_applicable → NO row (hidden, same pattern as technique/comparison).
    expect(ids).not.toContain("req-not-applicable");
    // not_assessable → row STAYS visible as the scoring-relevant gap.
    const gapRow = display.requirements.find((row) => row.requirementId === "req-not-assessable");
    expect(gapRow).toBeDefined();
    expect(gapRow?.chip?.kind).toBe("not_assessable");
    expect(gapRow?.chip?.label).toBe("Missing from your tape");
    // The hidden row is also excluded from the visible total.
    expect(display.totalCount).toBe(display.requirements.length);
  });

  it("is lossless: rawFallback is the exact persisted report object", () => {
    const report = canaryV2Report();
    const model = vm(report);
    expect(model.rawFallback).toBe(report);
  });
});

describe("strong complete professional through the shim", () => {
  it("produces populated score summary with toned category rows", () => {
    const model = vm(strongCompleteV2Report());
    const scores = model.modules.scoreSummary;
    expect(scores.state).toBe("populated");
    const display = scores.display as ScoreSummaryDisplay;
    expect(display.overall).toBeGreaterThan(0);
    expect(display.categories.length).toBeGreaterThan(0);
    for (const row of display.categories) {
      if (row.score != null) expect(row.tone).not.toBeNull();
    }
  });

  it("hides comparison and same-video modules on a sole take (hide-vs-empty policy)", () => {
    const model = vm(strongCompleteV2Report());
    const comparison = model.modules.comparison;
    if (comparison.state !== "populated") {
      expect(comparison.emptyKind).toBe("hidden");
    }
    const sameVideo = model.modules.sameVideoStatus;
    if (sameVideo.state !== "populated") {
      expect(sameVideo.emptyKind).toBe("hidden");
    }
  });

  it("marks absent submission risk as POSITIVE empty (good news), never broken", () => {
    const model = vm(strongCompleteV2Report());
    const risk = model.modules.submissionRisk;
    if (risk.state === "empty") {
      expect(risk.emptyKind).toBe("positive");
    }
  });
});

// Δ6 Slice 2 residual: the submission-risk block keys off the CANONICAL verdict decision, whose
// type union is {submit | review_carefully | retake_required_if_possible} — the dropped A-side
// hedge submit_if_deadline_is_close can never occur (proven exhaustively in
// canonical-verdict-decision.test.ts), which is why its exclusion-array entry is dead code. With
// the authoritative submission_risk source forced off, the block is driven SOLELY by whether the
// canonical decision is blocking, so this pins the classification unchanged: submit and absent →
// not blocking; review_carefully and retake_required_if_possible → blocking.
describe("blocking-decision classification (canonical decision drives the submission-risk block)", () => {
  function reportWithCanonicalDecision(decision: string | null) {
    const report = canaryV2Report();
    const s10 = report.s10_view_model as Record<string, unknown>;
    // Isolate the decision: turn the authoritative submission_risk source off (to a valid
    // non-authoritative value that keeps the view-model usable) so only the canonical decision
    // can populate the block. The fixture already carries a non-empty recommendation.rationale,
    // which the block surfaces ONLY when the decision is blocking.
    const sourceMap = s10.section_source_map as Record<string, unknown>;
    sourceMap.submission_risk = { source: "not_applicable" };
    const canonicalVerdict = s10.canonical_verdict as Record<string, unknown>;
    canonicalVerdict.decision = decision;
    return report;
  }

  it("review_carefully and retake_required_if_possible are blocking", () => {
    for (const decision of ["review_carefully", "retake_required_if_possible"]) {
      const model = vm(reportWithCanonicalDecision(decision));
      expect(model.modules.submissionRisk.state, decision).toBe("populated");
    }
  });

  it("submit and an absent decision are not blocking", () => {
    for (const decision of ["submit", null]) {
      const model = vm(reportWithCanonicalDecision(decision));
      expect(model.modules.submissionRisk.state, decision ?? "null").toBe("empty");
    }
  });
});

describe("readiness-driven state resolution (newer pipeline runs)", () => {
  function withReadiness(
    report: Record<string, unknown>,
    results: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    report.s10_module_readiness = {
      version: 1,
      source_stage: "test",
      module_ready: false,
      thin_shell_blocked: false,
      decision_critical_blocked: false,
      repair_action_count: 0,
      results,
    };
    return report;
  }

  it("a thin module becomes limited with the readiness reason attached", () => {
    const report = withReadiness(canaryV2Report(), [
      {
        report_module: "technique commentary",
        status: "thin",
        reason: "Technique commentary was thin after repair.",
        repair_triggered: true,
        blocks_report_value: false,
        decision_critical: false,
      },
    ]);
    const model = vm(report);
    const technique = model.modules.techniqueCommentary;
    expect(technique.state).toBe("limited");
    expect(technique.reason).toBe("Technique commentary was thin after repair.");
    expect(technique.readiness).toMatchObject({ status: "thin", repair_triggered: true });
    // Data is still attached — limited is honesty, not suppression.
    expect(technique.data).not.toBeNull();
  });

  it("a missing module with no content becomes a visible not_assessed empty state", () => {
    const report = canaryV2Report();
    const view = report.s10_view_model as Record<string, unknown>;
    view.timestamped_commentary = null;
    withReadiness(report, [
      {
        report_module: "timestamped notes",
        status: "missing",
        reason: "No timestamped notes were generated.",
        repair_triggered: true,
        blocks_report_value: false,
        decision_critical: false,
      },
    ]);
    const model = vm(report);
    const timestamped = model.modules.timestampedCommentary;
    expect(timestamped.state).toBe("empty");
    expect(timestamped.emptyKind).toBe("not_assessed");
    expect(timestamped.reason).toBe("No timestamped notes were generated.");
  });

  it("modules without a readiness entry keep presence-derived states", () => {
    const report = withReadiness(canaryV2Report(), [
      {
        report_module: "technique commentary",
        status: "thin",
        reason: "thin",
        repair_triggered: false,
        blocks_report_value: false,
        decision_critical: false,
      },
    ]);
    const model = vm(report);
    expect(model.modules.recommendation.state).toBe("populated");
    expect(model.modules.recommendation.readiness).toBeNull();
  });
});

describe("limited / legacy / malformed reports", () => {
  it("flags a limited S10 report instead of faking content", () => {
    const report = canaryV2Report();
    report.report_status = "limited";
    report.limitation_reason = "s10_v2_build_or_validation_failed";
    const model = vm(report);
    expect(model.reportStatus.isLimited).toBe(true);
    expect(model.reportStatus.limitationReason).toBe("s10_v2_build_or_validation_failed");
  });

  it("maps a legacy (non-S10) report into the same envelopes", () => {
    const model = vm({
      schema_version: "v2-component",
      mode: "brief",
      audition_type: "screen_acting",
      headline: "Legacy headline",
      insight: "Legacy insight",
      verdict: "review",
      overall_readiness: 72,
      scores: { acting: 80, audio: 64 },
      category_notes: { acting: "Strong choices" },
      strengths: [{ title: "Truthful work", detail: "Specific and motivated" }],
      improvements: [{ title: "Fix the audio", detail: "Room tone jumps" }],
      fix_first: "Re-record both sides in one audio pass",
      timestamped_notes: [{ timestamp: "0:58", note: "Pause is rushed" }],
      next_take_plan: { steps: ["Record both sides back-to-back"] },
      presentation_notes: ["Clean framing"],
      risk_flags: [{ severity: "medium", flag: "audio_shift" }],
      at_risk: false,
    });
    expect(model.sourceMode).toBe("legacy");
    expect((model.modules.recommendation.display as RecommendationDisplay).headline).toBe(
      "Legacy headline",
    );
    const scores = model.modules.scoreSummary.display as ScoreSummaryDisplay;
    expect(scores.overall).toBe(72);
    expect(scores.categories.map((row) => row.categoryId).sort()).toEqual(["acting", "audio"]);
    const fixes = model.modules.fixHierarchy.display as FixHierarchyDisplay;
    expect(fixes.fixFirst?.title).toBe("Re-record both sides in one audio pass");
    expect(fixes.shouldImprove.length).toBe(1);
    expect(model.modules.timestampedCommentary.state).toBe("populated");
    expect(model.modules.submissionRisk.state).toBe("populated");
  });

  it("returns null for non-object input", () => {
    expect(buildReportViewModel(null)).toBeNull();
    expect(buildReportViewModel("nope")).toBeNull();
    expect(buildReportViewModel([])).toBeNull();
  });
});

describe("provenance map consistency with S10_REPORT_MODULE_COVERAGE", () => {
  const coverageModules = new Set(S10_REPORT_MODULE_COVERAGE.map((entry) => entry.reportModule));
  const routeKeys = new Set<string>(S10_ROUTE_REQUIRED_SECTION_KEYS);

  it("every provenance reportModule name exists in the server coverage map", () => {
    for (const key of REPORT_MODULE_KEYS) {
      for (const name of REPORT_MODULE_PROVENANCE[key].reportModules) {
        expect(coverageModules.has(name), `${key} → "${name}" missing from coverage map`).toBe(
          true,
        );
      }
    }
  });

  it("every provenance route section key is a real S10 route section key", () => {
    for (const key of REPORT_MODULE_KEYS) {
      for (const section of REPORT_MODULE_PROVENANCE[key].routeSectionKeys) {
        expect(routeKeys.has(section), `${key} → "${section}" is not a route section key`).toBe(
          true,
        );
      }
    }
  });

  it("every performer-facing coverage module is owned by exactly one view-model module", () => {
    const owned = new Map<string, ReportModuleKey[]>();
    for (const key of REPORT_MODULE_KEYS) {
      for (const name of REPORT_MODULE_PROVENANCE[key].reportModules) {
        owned.set(name, [...(owned.get(name) ?? []), key]);
      }
    }
    for (const [name, owners] of owned) {
      expect(owners.length, `"${name}" owned by ${owners.join(", ")}`).toBe(1);
    }
    // Coverage entries deliberately NOT owned by a performer module:
    // take lifecycle/admin identity and QA diagnostics.
    const unowned = [...coverageModules].filter((name) => !owned.has(name));
    expect(unowned.sort()).toEqual(["diagnostic chips", "take slot/version context"]);
  });
});

describe("cost attribution (estimated split)", () => {
  it("reconciles per-module estimates back to the real row totals", () => {
    const model = vm(canaryV2Report());
    const usage = [
      { step: "evidence_pass", total_tokens: 30_000, estimated_cost_usd: 0.08 },
      { step: "report_polish", total_tokens: 20_000, estimated_cost_usd: 0.04 },
      { step: "brief_extraction", total_tokens: 2_000, estimated_cost_usd: 0.01 },
    ];
    const step1Evidence = {
      raw_scores: { acting: 70 },
      timestamped_evidence: [{ timestamp: "00:10", observation: "entry" }],
      core_strengths_evidence: [{ area: "acting", evidence: "specific" }],
    };
    const result = estimateReportModuleCosts(usage, model, step1Evidence);

    expect(result.totalCostUsd).toBeCloseTo(0.13, 10);
    expect(result.totalTokens).toBe(52_000);
    const attributed = result.perModule.reduce((acc, row) => acc + row.estCostUsd, 0);
    expect(attributed + result.overheadCostUsd).toBeCloseTo(result.totalCostUsd, 10);
    // brief_extraction is neither step1 nor step2 → lands in overhead.
    expect(result.overheadCostUsd).toBeGreaterThanOrEqual(0.01 - 1e-9);
    for (const row of result.perModule) {
      expect(row.basis).toBe("estimated");
      expect(row.estCostUsd).toBeGreaterThan(0);
    }
  });

  it("handles missing usage and missing evidence without inventing spend", () => {
    const model = vm(canaryV2Report());
    const empty = estimateReportModuleCosts([], model);
    expect(empty.totalCostUsd).toBe(0);
    expect(empty.perModule).toEqual([]);
    expect(empty.overheadCostUsd).toBe(0);

    const noEvidence = estimateReportModuleCosts(
      [{ step: "report_polish", total_tokens: 10_000, estimated_cost_usd: 0.05 }],
      model,
    );
    const attributed = noEvidence.perModule.reduce((acc, row) => acc + row.estCostUsd, 0);
    expect(attributed + noEvidence.overheadCostUsd).toBeCloseTo(0.05, 10);
  });
});
