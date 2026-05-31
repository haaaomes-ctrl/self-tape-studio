import fs from "node:fs";
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

type RenderProps = Partial<React.ComponentProps<typeof V2ReportView>>;

function render(report: Record<string, unknown>, props: RenderProps = {}) {
  return renderToStaticMarkup(
    <V2ReportView report={report} takeNumber={1} auditionType="musical_theatre" {...props} />,
  );
}

function routeText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type MutableS10View = Record<string, unknown> & {
  section_source_map: Record<string, Record<string, unknown>>;
};

function mutableS10View(report: Record<string, unknown>): MutableS10View {
  return report.s10_view_model as MutableS10View;
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

function noBriefBaselineV2Report() {
  const input = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
  delete input.brief_context;
  delete input.brief_requirements;
  delete input.brief_achievement_matrix;
  input.mode = "baseline";
  input.scoring_mode = "no_brief_baseline";
  input.readiness_score_judgement = {
    ...(input.readiness_score_judgement as Record<string, unknown>),
    headline: "Strong baseline tape for the selected level",
    score_explanation:
      "This is a baseline assessment of observable performance and setup because no casting brief was supplied.",
    brief_completion_score: null,
    brief_completion_summary: "Brief achievement is not assessed without a supplied brief.",
  };

  const context = buildS10StrongCompleteProfessionalViewContext() as Record<string, unknown>;
  delete context.briefContext;
  delete context.briefRequirements;

  return buildV2Report({
    legacyReport: input,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "baseline",
    s10Context: context as never,
  }) as unknown as Record<string, unknown>;
}

function partialBriefV2Report() {
  const input = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
  delete input.brief_requirements;
  delete input.brief_achievement_matrix;
  input.scoring_mode = "partial_brief_supplied";
  input.readiness_score_judgement = {
    ...(input.readiness_score_judgement as Record<string, unknown>),
    headline: "Review with partial brief context",
    score_explanation:
      "The supplied role and project context are useful, but formal requirements are incomplete.",
    brief_completion_score: null,
    brief_completion_summary: "Formal brief completion is not scored from partial context.",
  };

  const context = buildS10StrongCompleteProfessionalViewContext() as Record<string, unknown>;
  delete context.briefRequirements;

  return buildV2Report({
    legacyReport: input,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: context as never,
  }) as unknown as Record<string, unknown>;
}

function knownRoleV2Report() {
  const input = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
  input.role_material_context = {
    applies: true,
    project_name: "Wicked",
    role_name: "Elphaba",
    material_package_summary: "Side and song package for a known musical-theatre role.",
    source_basis: ["brief_supplied", "official_source_researched"],
    primary_standard: "supplied_brief",
    source_summary: [
      {
        source_type: "brief",
        source_label: "Supplied casting brief",
        truth_state: "brief_supplied",
        confidence: "high",
        public_usable: true,
      },
      {
        source_type: "official_source",
        source_label: "Official production synopsis",
        truth_state: "official_source_researched",
        confidence: "medium",
        public_usable: true,
      },
    ],
    secondary_context:
      "Known-material context suggests moral conviction and outsider pressure, but the supplied brief remains the primary standard.",
    demands: [
      {
        id: "known-elphaba-conviction",
        label: "Moral conviction under pressure",
        description:
          "Use only as secondary role/material nuance where the observed tape supports it.",
        source_truth_state: "official_source_researched",
        importance: "known_material_context_only",
        observable_evidence_needed: ["Story-led vocal or acting choices are visible/audible."],
        scoring_use: "can_nuance_score",
        unsafe_if_used_for: ["mandatory blocker", "appearance/type judgement"],
      },
    ],
    blocked_inferences: ["Personal attributes and casting outcomes are not assessed."],
    confidence: "medium",
    uncertainty_notes: ["Known-material context is secondary to the supplied brief."],
  };

  return buildV2Report({
    legacyReport: input,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  }) as unknown as Record<string, unknown>;
}

function ambiguousRoleV2Report() {
  const input = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
  input.role_material_context = {
    applies: true,
    project_name: "Untitled workshop scene",
    role_name: "Alex",
    source_basis: ["model_inferred_low_confidence"],
    primary_standard: "selected_level_observed_tape",
    source_summary: [
      {
        source_type: "model_inferred_low_confidence",
        source_label: "Ambiguous role name from partial context",
        truth_state: "model_inferred_low_confidence",
        confidence: "low",
        public_usable: true,
      },
    ],
    secondary_context: null,
    demands: [],
    blocked_inferences: [
      "Role-specific fit is not assessed because the role/material identity is ambiguous.",
    ],
    confidence: "low",
    uncertainty_notes: [
      "The role/material identity is ambiguous, so known-material demands are not applied.",
    ],
  };

  return buildV2Report({
    legacyReport: input,
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

  it("renders supplied brief details and requirement classifications for Canary A", () => {
    const text = routeText(render(canaryV2Report()));

    expect(text).toContain("Supplied brief details");
    expect(text).toContain("Project: Canary A MT package");
    expect(text).toContain(
      "Material: Professional MT self-tape package requiring Side 1 plus a contemporary legit song.",
    );
    expect(text).toContain("Upload: Upload one file only.");
    expect(text).toContain("File naming: Use LASTNAME_FIRSTNAME_CANARYA.mp4.");

    expect(text).toContain("Requirement classification");
    expect(text).toContain("Mandatory: 6");
    expect(text).toContain("Ambiguous: 1");
    expect(text).toContain("Material: 2");
    expect(text).toContain("Admin process: 3");
    expect(text).toContain("Technical: 1");
    expect(text).toContain("Role context: 1");

    expect(text).toContain("Required Side 1 acting scene");
    expect(text).toContain("Contemporary legit MT song");
    expect(text).toContain("One continuous video containing the full package");
    expect(text).toContain("One final checked file");
    expect(text).toContain(
      "Achievement check: Side 1 is present and complete in the submitted tape.",
    );
    expect(text).toContain("If missing: Mandatory acting material is missing.");
  });

  it("renders a strong complete report with useful S10 density", () => {
    const html = render(strongCompleteV2Report());

    for (const allowed of s10StrongCompleteProfessionalExpectedViewModel.allowed_route_content) {
      expect(html).toContain(allowed);
    }
    expect(html).toContain("Selected-level calibration");
    expect(routeText(html)).toContain("Judged against: Professional");
    expect(html).toContain("Meets this level");
    expect(html).toContain("Falls short at this level");
    expect(html).toContain("Submit checklist");
    expect(html).toContain("Optional polish");
    expect(html).toContain("Technique commentary");
    expect(html).toContain("Timestamped and time-banded notes");
    expect(html).toContain("Professional competitive calibration");
    expect(html).toContain("Score zone:");
    expect(html).toContain("90-91");
    expect(html).toContain("Retake strategy:");

    for (const forbidden of s10StrongCompleteProfessionalExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/retake required/i);
  });

  it("renders scoring basis and diagnostic score visibility for brief-supplied reports", () => {
    const text = routeText(render(strongCompleteV2Report()));

    expect(text).toContain("Scoring basis: Brief supplied");
    expect(text).toContain("Score language may include supplied brief achievement");
    expect(text).toContain("Score visibility:");
    expect(text).toContain("not public customer score-release approval");
  });

  it("renders browser-print PDF affordance without public share or stored export language", () => {
    const html = render(strongCompleteV2Report());
    const styles = fs.readFileSync(new URL("../../../styles.css", import.meta.url), "utf8");

    expect(html).toContain("Print / Save as PDF");
    expect(html).toContain("tc-print-action");
    expect(styles).toContain("@media print");
    expect(styles).toContain(".tc-report-print-surface");
    expect(styles).toContain(".tc-report-print-section");
    expect(styles).toContain(".tc-print-exclude");
    expect(styles).toContain('section[aria-labelledby="page-header-title"]');
    expect(html).not.toMatch(/public share|share link|stored export|download PDF/i);
  });

  it("does not render Professional 90+ score-zone language for sub-90 reports", () => {
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
    view.score_summary = {
      ...(view.score_summary as Record<string, unknown>),
      overall_submission_readiness_score: 82,
    };
    report.overall_readiness = 82;
    view.selected_level_calibration = {
      ...(view.selected_level_calibration as Record<string, unknown>),
      score_meaning:
        "The performance itself is in the competitive zone (90+), but the overall readiness is lower.",
    };

    const text = routeText(render(report));

    expect(text).toContain("overall readiness score is 82");
    expect(text).toContain(
      "Score-zone calibration appears only for Professional reports scoring 90",
    );
    expect(text).not.toContain("The performance itself is in the competitive zone (90+)");
    expect(text).not.toContain("Professional competitive calibration");
  });

  it("reconciles route-visible requirement rows with stricter observed-tape evidence", () => {
    const report = buildS10StrongCompleteProfessionalReportInput();
    const context = buildS10StrongCompleteProfessionalViewContext() as Record<string, unknown>;
    context.observedTapeSequence = (
      context.observedTapeSequence as Array<Record<string, unknown>>
    ).map((item) =>
      item.id === "seq-side-1"
        ? {
            ...item,
            present_status: "uncertain",
            completion_status: "uncertain",
            evidence_summary: "The required Side 1 acting scene is not confirmed from the tape.",
            assessability_notes: "Observed tape evidence is stricter than the requirement result.",
          }
        : item,
    );
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: context as never,
    }) as unknown as Record<string, unknown>;
    const text = routeText(render(v2));

    expect(text).toContain(
      "Required Side 1 acting scene — not assessable / observed uncertain / completion uncertain",
    );
    expect(text).toContain("S10 route reconciled this row with stricter observed-tape evidence");
    expect(text).toContain("Overall readiness —");
    expect(text).toContain("Record/include the full required Side 1 acting scene");
    expect(text).not.toContain("Required Side 1 acting scene — present / complete");
    expect(text).not.toContain("Preserve the complete Side 1 plus song package");
    expect(text).not.toContain("Acting objective and scene partner focus are clear");
  });

  it("renders active take-version context without exposing raw take IDs", () => {
    const text = routeText(
      render(strongCompleteV2Report(), {
        takeNumber: 2,
        takeSlot: 2,
        takeVersionNumber: 3,
        takeVersionStatus: "active",
        replacesTakeId: "raw-replaced-take-id",
        sameVideoStatus: "same_video_confirmed",
      }),
    );

    expect(text).toContain("Take context");
    expect(text).toContain("Take: Take 2");
    expect(text).toContain("Active version: Version 3");
    expect(text).toContain("Version status: Active");
    expect(text).toContain("Replacement version; prior take proof is retained separately.");
    expect(text).toContain("Same-video status: Same video confirmed");
    expect(text).not.toContain("raw-replaced-take-id");
  });

  it("renders no-brief baseline scoring limits without claiming brief achievement", () => {
    const text = routeText(render(noBriefBaselineV2Report()));

    expect(text).toContain("Scoring basis: No brief baseline");
    expect(text).toContain("No casting brief was supplied");
    expect(text).toContain("baseline assessment of the observable tape");
    expect(text).not.toContain("What the brief asked for");
    expect(text).not.toContain("Upload one file only");
    expect(text).not.toContain("File naming:");
  });

  it("renders partial-brief scoring limits without full-compliance language", () => {
    const text = routeText(render(partialBriefV2Report()));

    expect(text).toContain("Scoring basis: Partial brief supplied");
    expect(text).toContain("Formal brief requirements are incomplete");
    expect(text).toContain("Supplied brief details");
    expect(text).not.toContain("Requirement classification");
  });

  it("renders role/material source basis as secondary context without castability claims", () => {
    const text = routeText(render(knownRoleV2Report()));

    expect(text).toContain("Role / material context");
    expect(text).toContain("Role / character: Elphaba");
    expect(text).toContain("Source basis");
    expect(text).toContain("Official production synopsis");
    expect(text).toContain("Official source researched");
    expect(text).toContain("Known material context only");
    expect(text.toLowerCase()).toContain("supplied brief remains the primary standard");
    expect(text).toContain("Not assessed");
    expect(text).not.toMatch(/\bright for the role\b/i);
    expect(text).not.toMatch(/\bcastability\b/i);
    expect(text).not.toMatch(/\bcallback likelihood\b/i);
  });

  it("renders ambiguous role/material context as uncertain without applying demands", () => {
    const text = routeText(render(ambiguousRoleV2Report()));

    expect(text).toContain("Role / material context");
    expect(text).toContain("Confidence: Low");
    expect(text).toContain("Model inferred low confidence");
    expect(text).toContain("The role/material identity is ambiguous");
    expect(text).not.toContain("Task demands");
    expect(text).not.toContain("Mandatory from brief");
  });

  it("renders the same observed tape differently when the selected level changes", () => {
    const professionalHtml = render(strongCompleteV2Report());
    const learningInput = buildS10StrongCompleteProfessionalReportInput() as Record<
      string,
      unknown
    >;
    const learningReadiness = learningInput.readiness_score_judgement as Record<string, unknown>;
    learningInput.readiness_score_judgement = {
      ...learningReadiness,
      selected_level_calibration_summary:
        "At Learning / School level, the same observed complete package is excellent for the selected level without implying Professional readiness.",
      selected_level_calibration: {
        selected_level: "learning_school",
        selected_level_label: "Learning / School",
        standard_applied:
          "Basic task understanding, preparation, intelligibility and early craft evidence.",
        evidence_threshold:
          "The tape should be clear enough to assess preparation, task response and early technique.",
        readiness_standard:
          "Ready at this level means prepared, understandable and complete enough for the assignment or audition context.",
        score_meaning:
          "The score means excellent evidence for Learning / School level, not automatic Professional readiness.",
        what_meets_level: ["The same observed Side 1 and song package is complete and assessable."],
        what_falls_short: [
          "Professional competitiveness is not claimed because the selected standard is Learning / School.",
        ],
        recommendation_impact:
          "The recommendation is strong at Learning / School level while keeping the Professional claim separate.",
        comparison_to_other_levels:
          "Observed evidence is unchanged; only the selected assessment standard changes.",
        confidence: "high",
      },
    };
    const learningReport = buildV2Report({
      legacyReport: learningInput,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
    }) as unknown as Record<string, unknown>;
    const learningHtml = render(learningReport);

    const professionalText = routeText(professionalHtml);
    const learningText = routeText(learningHtml);

    expect(professionalText).toContain("Judged against: Professional");
    expect(learningText).toContain("Judged against: Learning / School");
    expect(learningHtml).toContain("The same observed Side 1 and song package is complete");
    expect(learningHtml).toContain("Observed evidence is unchanged");
    expect(learningText).not.toContain("Judged against: Professional");
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
    const view = mutableS10View(report);
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
    const view = mutableS10View(report);
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
    expect(html).not.toContain("Review the S10 report before submitting");
    expect(html).not.toContain(
      "Confirm the final file contains all required material before upload.",
    );
    expect(html).not.toContain(
      "Check filename, deadline and upload instructions against the brief.",
    );
    expect(html).not.toContain("[object Object]");
  });

  it("does not use S10 requirement IDs as visible component labels", () => {
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
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
    const view = mutableS10View(report);
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
    const view = mutableS10View(report);
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
    const view = mutableS10View(report);
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
    const view = mutableS10View(report);
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
    const view = mutableS10View(report);
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
