import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "@/components/report/V2ReportView";
import { compareS10OperatorAssumptions } from "@/server/s10-operator-assumption-checkpoints.server";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { classifyS10SameVideoComparison } from "@/server/s10-same-video-comparison.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
  s10CanaryAOperatorAssumptionCheckpoint,
  s10CanaryAOperatorExpectation,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
  s10StrongCompleteProfessionalOperatorAssumptionCheckpoint,
  s10StrongCompleteProfessionalOperatorExpectation,
} from "@/test-fixtures/s10-strong-complete-professional";
import {
  buildS10SameVideoBaseReportInput,
  buildS10SameVideoBaseViewContext,
  s10SameVideoComparisonFixtures,
} from "@/test-fixtures/s10-same-video-comparison";

function render(report: Record<string, unknown>) {
  return renderToStaticMarkup(
    React.createElement(V2ReportView, {
      report,
      takeNumber: 1,
      auditionType: "musical_theatre",
    }),
  );
}

function canaryReport() {
  const report = buildS10CanaryAReportInput();
  const v2 = buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  });
  return { report, v2, html: render(v2 as unknown as Record<string, unknown>) };
}

function strongReport() {
  const report = buildS10StrongCompleteProfessionalReportInput();
  const v2 = buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
  return { report, v2, html: render(v2 as unknown as Record<string, unknown>) };
}

function sameVideoDuplicateReport() {
  const classification = classifyS10SameVideoComparison(
    s10SameVideoComparisonFixtures.accidentalDuplicate.input,
  );
  const report = buildS10SameVideoBaseReportInput();
  const v2 = buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: {
      ...buildS10SameVideoBaseViewContext(),
      sameVideoEvidence: classification.evidence,
      comparisonTruth: classification.comparison_truth,
      comparisonDisplayMode: classification.comparison_display_mode,
    } as never,
  });
  return { report, v2, classification, html: render(v2 as unknown as Record<string, unknown>) };
}

describe("S10.14 operator assumption checkpoints", () => {
  it("matches Canary A assumptions against S10 modules and view model", () => {
    const { report, v2, html } = canaryReport();
    const comparison = compareS10OperatorAssumptions({
      checkpoint: s10CanaryAOperatorAssumptionCheckpoint,
      expectation: s10CanaryAOperatorExpectation,
      reportModules: report,
      viewModel: v2.s10_view_model as never,
      renderedText: html,
    });

    expect(comparison.comparison_status).toBe("matches_operator_expectation");
    expect(comparison.mismatches).toEqual([]);
    expect(comparison.matched_expectations).toContain("expected recommendation");
    expect(comparison.matched_expectations).toContain("missing requirement:req-side-1");
    expect(comparison.matched_expectations).toContain("expected fix first");
    expect(v2.s10_view_model?.recommendation?.decision).toBe("retake_required_if_possible");
  });

  it("matches strong-complete assumptions without collapsing positive report value", () => {
    const { report, v2, html } = strongReport();
    const comparison = compareS10OperatorAssumptions({
      checkpoint: s10StrongCompleteProfessionalOperatorAssumptionCheckpoint,
      expectation: s10StrongCompleteProfessionalOperatorExpectation,
      reportModules: report,
      viewModel: v2.s10_view_model as never,
      renderedText: html,
    });

    expect(comparison.comparison_status).toBe("matches_operator_expectation");
    expect(comparison.mismatches).toEqual([]);
    expect(comparison.matched_expectations).toContain("expected recommendation");
    expect(comparison.matched_expectations).toContain("expected no mandatory fix first");
    expect(v2.s10_view_model?.recommendation?.decision).toBe("submit");
  });

  it("matches same-video duplicate assumptions against S10ComparisonTruth", () => {
    const { report, v2, classification, html } = sameVideoDuplicateReport();
    const comparison = compareS10OperatorAssumptions({
      checkpoint: s10SameVideoComparisonFixtures.accidentalDuplicate.checkpoint,
      expectation: s10SameVideoComparisonFixtures.accidentalDuplicate.expectation,
      reportModules: report,
      viewModel: v2.s10_view_model as never,
      comparisonTruth: classification.comparison_truth,
      renderedText: html,
    });

    expect(comparison.comparison_status).toBe("matches_operator_expectation");
    expect(comparison.mismatches).toEqual([]);
    expect(comparison.matched_expectations).toContain("expected same-video status");
    expect(comparison.matched_expectations).toContain("expected comparison policy");
    expect(v2.s10_view_model?.comparison_truth?.recommendation_policy).toBe("do_not_pick_winner");
  });

  it("returns assumption_missing rather than passing when checkpoint data is absent", () => {
    const comparison = compareS10OperatorAssumptions({
      checkpoint: null,
      expectation: s10CanaryAOperatorExpectation,
      reportModules: buildS10CanaryAReportInput(),
    });

    expect(comparison.comparison_status).toBe("assumption_missing");
    expect(comparison.recommended_next_step).toBe("ask_operator");
    expect(comparison.mismatches[0]?.mismatch_type).toBe("operator_assumption_missing");
  });

  it("returns assumption_uncertain rather than passing for uncertain operator assumptions", () => {
    const comparison = compareS10OperatorAssumptions({
      checkpoint: { ...s10CanaryAOperatorAssumptionCheckpoint, confidence: "uncertain" },
      expectation: s10CanaryAOperatorExpectation,
      reportModules: buildS10CanaryAReportInput(),
    });

    expect(comparison.comparison_status).toBe("assumption_uncertain");
    expect(comparison.recommended_next_step).toBe("ask_operator");
    expect(comparison.mismatches[0]?.mismatch_type).toBe("operator_assumption_uncertain");
  });

  it("classifies confirmed mismatches by S10 module area without correcting output", () => {
    const { report, v2 } = canaryReport();
    const before = structuredClone(report);
    const comparison = compareS10OperatorAssumptions({
      checkpoint: s10CanaryAOperatorAssumptionCheckpoint,
      expectation: { ...s10CanaryAOperatorExpectation, expected_recommendation: "submit" },
      reportModules: report,
      viewModel: v2.s10_view_model as never,
    });

    expect(comparison.comparison_status).toBe("contradicts_operator_expectation");
    expect(comparison.mismatches[0]?.mismatch_type).toBe("readiness_score_mismatch");
    expect(comparison.recommended_next_step).toBe("review_prompt_contract");
    expect(report).toEqual(before);
    expect(v2.s10_view_model?.recommendation?.decision).toBe("retake_required_if_possible");
  });

  it("fails route projection when expected S10 sections are not sourced authoritatively", () => {
    const { report, v2 } = canaryReport();
    const badView = structuredClone(v2.s10_view_model) as Record<string, unknown>;
    const sourceMap = badView.section_source_map as Record<
      string,
      { source: string; module: string }
    >;
    sourceMap.fix_hierarchy = {
      source: "legacy_diagnostic_fallback",
      module: "raw_report.fix_first",
    };
    const comparison = compareS10OperatorAssumptions({
      checkpoint: s10CanaryAOperatorAssumptionCheckpoint,
      expectation: s10CanaryAOperatorExpectation,
      reportModules: report,
      viewModel: badView,
    });

    expect(comparison.comparison_status).toBe("contradicts_operator_expectation");
    expect(comparison.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mismatch_type: "route_projection_mismatch",
          field: "section_source_map.fix_hierarchy",
        }),
      ]),
    );
  });

  it("keeps operator assumptions and runtime provenance internals out of performer rendering", () => {
    const { v2, html } = canaryReport();
    expect(html).not.toContain("checkpoint_id");
    expect(html).not.toContain("operator_notes");
    expect(html).not.toContain("s10-canary-a-operator-checkpoint");
    expect(html).not.toContain("analysis_run_id");
    expect(html).not.toContain("GateTrace");
    expect(html).not.toContain("ValidatorTrace");
    expect(JSON.stringify(v2)).not.toContain("RuntimeVerificationTrace");
  });
});
