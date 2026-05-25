import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "../V2ReportView";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { classifyS10SameVideoComparison } from "@/server/s10-same-video-comparison.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
  s10CanaryAExpectedViewModel,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
  s10StrongCompleteProfessionalExpectedViewModel,
} from "@/test-fixtures/s10-strong-complete-professional";
import { s10SameVideoComparisonFixtures } from "@/test-fixtures/s10-same-video-comparison";

function render(report: Record<string, unknown>) {
  return renderToStaticMarkup(
    <V2ReportView report={report} takeNumber={1} auditionType="musical_theatre" />,
  );
}

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

function sameVideoDuplicateV2Report() {
  const result = classifyS10SameVideoComparison(
    s10SameVideoComparisonFixtures.accidentalDuplicate.input,
  );
  return buildV2Report({
    legacyReport: buildS10StrongCompleteProfessionalReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: {
      ...buildS10StrongCompleteProfessionalViewContext(),
      sameVideoEvidence: result.evidence,
      comparisonTruth: result.comparison_truth,
      comparisonDisplayMode: result.comparison_display_mode,
    } as never,
  }) as unknown as Record<string, unknown>;
}

describe("S10 report view rendering", () => {
  it("renders Canary A from S10 modules and not legacy false positives", () => {
    const html = render(canaryV2Report());

    for (const allowed of s10CanaryAExpectedViewModel.allowed_route_content) {
      expect(html).toContain(allowed);
    }
    expect(html).toContain("42");
    expect(html).toContain("Record/include the full required Side 1 acting scene");
    expect(html).toContain("Playback-check the end of the song");
    expect(html).toContain("Not observed");

    for (const forbidden of s10CanaryAExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/\bcomplete package\b/i);
    expect(html).not.toContain("93");
  });

  it("renders a strong complete report with useful S10 density", () => {
    const html = render(strongCompleteV2Report());

    for (const allowed of s10StrongCompleteProfessionalExpectedViewModel.allowed_route_content) {
      expect(html).toContain(allowed);
    }
    expect(html).toContain("Submit checklist");
    expect(html).toContain("Optional polish");
    expect(html).toContain("Technique commentary");
    expect(html).toContain("Timestamped and time-banded notes");

    for (const forbidden of s10StrongCompleteProfessionalExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/retake required/i);
  });

  it("keeps Canary A and strong complete on opposite report outcomes", () => {
    const canary = canaryV2Report();
    const strong = strongCompleteV2Report();
    const canaryS10 = canary.s10_view_model as {
      recommendation: { decision: string };
      brief_achievement_matrix: { mandatory_status: string };
    };
    const strongS10 = strong.s10_view_model as {
      recommendation: { decision: string };
      brief_achievement_matrix: { mandatory_status: string };
    };

    expect(canaryS10.recommendation.decision).toBe("retake_required_if_possible");
    expect(canaryS10.brief_achievement_matrix.mandatory_status).not.toBe("clear");
    expect(canary.fix_first).toMatch(/Side 1/i);

    expect(strongS10.recommendation.decision).toBe("submit");
    expect(strongS10.brief_achievement_matrix.mandatory_status).toBe("clear");
    expect(strong.fix_first).toBeNull();
  });

  it("renders duplicate same-video comparison truth without winner language", () => {
    const html = render(sameVideoDuplicateV2Report());

    expect(html).toContain("Same-video comparison");
    expect(html).toContain("These takes appear to use the same underlying video.");
    expect(html).toContain("Do not treat this as a comparison of different performances.");
    expect(html).not.toContain("Take 1 is the stronger performance");
    expect(html).not.toContain("Take 2 is the stronger performance");
    expect(html).not.toContain("Use Take 1");
    expect(html).not.toContain("Use Take 2");
    expect(html).not.toContain("clear winner");
    expect(html).not.toContain("better performance");
    expect(html).not.toContain("sha256:");
  });

  it("renders nested same-video comparison limitations when no summary or warning is present", () => {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, any>;
    view.comparison_display_mode = "comparison_caution";
    view.comparison_summary = null;
    view.comparison_limitations = [];
    view.same_video_status = {
      status: "uncertain",
      performer_facing_summary: null,
      comparison_warning: null,
      limitations: ["Same-user scope IDs were unavailable."],
    };
    view.comparison_truth = {
      comparison_mode: "uncertain",
      recommendation_policy: "operator_confirmation_required",
      performer_facing_summary: null,
      limitations: ["Comparison needs operator confirmation."],
      same_video_status: view.same_video_status,
    };
    view.section_source_map.same_video_status = {
      source: "s10_authoritative_module",
      module: "s10_same_video_evidence",
      limitation: null,
    };
    view.section_source_map.comparison_truth = {
      source: "s10_authoritative_module",
      module: "s10_comparison_truth",
      limitation: null,
    };

    const html = render(report);

    expect(html).toContain("Same-video comparison");
    expect(html).toContain("Same-user scope IDs were unavailable.");
    expect(html).toContain("Comparison needs operator confirmation.");
  });

  it("renders S10 section limitations instead of empty strengths, fix, or next-action shells", () => {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, any>;
    view.strengths_and_preserve = {
      summary: "",
      strengths: [],
      preserve: [],
      do_not_overfix: [],
      limitations: [],
    };
    view.fix_hierarchy = {
      fix_first: {},
      priority_fixes: [],
      must_fix_before_submitting: [],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [],
    };
    view.next_action_plan = {
      submit_checklist: [],
      retake_plan: [],
      final_checks: [],
      playback_checks: [],
      no_retake_needed_reason: null,
    };
    view.section_source_map.strengths_and_preserve = {
      source: "specific_limitation",
      module: "s10_professional_critique",
      limitation: "Strengths and preserve guidance are not available for this report.",
    };
    view.section_source_map.fix_hierarchy = {
      source: "specific_limitation",
      module: "s10_fix_hierarchy",
      limitation: "Fix hierarchy was unavailable for this S10 report.",
    };
    view.section_source_map.next_action_plan = {
      source: "specific_limitation",
      module: "s10_next_action_plan",
      limitation: "Next action plan was unavailable for this S10 report.",
    };

    const html = render(report);

    expect(html).toContain("Strengths and preserve guidance are not available for this report.");
    expect(html).toContain("Fix hierarchy was unavailable for this S10 report.");
    expect(html).toContain("Next action plan was unavailable for this S10 report.");
    expect(html).not.toContain("[object Object]");
  });

  it("does not use S10 requirement IDs as visible component labels", () => {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, any>;
    view.component_breakdown = [
      {
        requirement_id: "req_internal_side_1",
        observed_status: "present",
        evidence_summary: "The acting side is visible and assessable.",
      },
    ];
    view.section_source_map.component_breakdown = {
      source: "s10_authoritative_module",
      module: "component_verifications",
      limitation: null,
    };

    const html = render(report);

    expect(html).toContain("The acting side is visible and assessable.");
    expect(html).not.toContain("req_internal_side_1");
  });

  it("does not render summary-only S10 brief achievement rows as status unavailable", () => {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, any>;
    view.brief_achievement_matrix = {
      requirement_results: [{ requirement_summary: "Label-only requirement" }],
    };

    const html = render(report);

    expect(html).not.toContain("Label-only requirement");
    expect(html).not.toContain("Requirement result");
    expect(html).not.toContain("status unavailable");
  });

  it("renders evidence-only and action-only S10 brief achievement rows without fallback status copy", () => {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, any>;
    view.brief_achievement_matrix = {
      requirement_results: [
        {
          requirement_summary: "Side 1",
          evidence_summary: "The acting side is visible and assessable.",
        },
        {
          requirement_summary: "Song",
          recommended_action: "Keep the current song take in the package.",
        },
      ],
    };

    const html = render(report);

    expect(html).toContain("Side 1");
    expect(html).toContain("The acting side is visible and assessable.");
    expect(html).toContain("Song");
    expect(html).toContain("Keep the current song take in the package.");
    expect(html).not.toContain("status unavailable");
  });

  it("renders object-shaped S10 retake plan items without object-string output", () => {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, any>;
    view.next_action_plan = {
      submit_checklist: [],
      retake_plan: [
        {
          title: "Record the missing side first.",
          detail: "Keep the song take only after the full acting side is captured.",
        },
      ],
      final_checks: [],
      playback_checks: [],
      no_retake_needed_reason: null,
    };
    view.section_source_map.next_action_plan = {
      source: "s10_authoritative_module",
      module: "s10_next_action_plan",
      limitation: null,
    };

    const html = render(report);

    expect(html).toContain("Retake plan");
    expect(html).toContain("Record the missing side first.");
    expect(html).toContain("Keep the song take only after the full acting side is captured.");
    expect(html).not.toContain("[object Object]");
  });

  it("renders recommended-action-only S10 list items accepted by validation", () => {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, any>;
    view.next_action_plan = {
      submit_checklist: [],
      retake_plan: [
        {
          recommended_action: "Record the missing acting side before using this take.",
        },
      ],
      final_checks: [],
      playback_checks: [],
      no_retake_needed_reason: null,
    };
    view.section_source_map.next_action_plan = {
      source: "s10_authoritative_module",
      module: "s10_next_action_plan",
      limitation: null,
    };

    const html = render(report);

    expect(html).toContain("Record the missing acting side before using this take.");
    expect(html).not.toContain("[object Object]");
  });

  it("renders a technique limitation instead of a blank metadata-only technique shell", () => {
    const report = strongCompleteV2Report();
    const view = report.s10_view_model as Record<string, any>;
    view.technique_commentary = { confidence: "high" };
    view.section_source_map.technique_commentary = {
      source: "specific_limitation",
      module: "s10_technique_commentary",
      limitation: "Technique commentary is not available for this report.",
    };

    const html = render(report);

    expect(html).toContain("Technique commentary is not available for this report.");
    expect(html).not.toContain("[object Object]");
  });
});
