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
    expect(html).toContain("54"); // Δ6: the visible headline is canonical D (54), not A (42)
    expect(html).toContain("Record/include the full required Side 1 acting scene");
    expect(html).toContain("Playback-check the end of the song");
    expect(html).toContain("Not observed");

    for (const forbidden of s10CanaryAExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/\bcomplete package\b/i);
    expect(html).not.toContain("93"); // the old false-positive D never renders
  });

  it("renders supplied brief details and the consolidated requirement table for Canary A", () => {
    const text = routeText(render(canaryV2Report()));

    expect(text).toContain("Supplied brief details");
    expect(text).toContain("Project: Canary A MT package");
    expect(text).toContain(
      "Material: Professional MT self-tape package requiring Side 1 plus a contemporary legit song.",
    );
    expect(text).toContain("Upload: Upload one file only.");
    // Δ6 P4 — the file-naming context row is relabelled to make the required
    // convention explicit; the value (which carries the convention) is unchanged.
    expect(text).toContain("Required filename: Use LASTNAME_FIRSTNAME_CANARYA.mp4.");

    // S11-UX-05 / Δ6 — the "Requirement classification" count pills and the
    // Overall/Mandatory/Readiness-impact status pills are removed; the constructive
    // per-requirement table is what surfaces classification now.
    expect(text).not.toContain("Requirement classification");
    expect(text).not.toContain("Mandatory: 6");

    // Δ6 P4 — the per-requirement listing is consolidated into ONE table. Each
    // requirement summary still appears, with its evidence / submission impact /
    // next action (no separate "What the brief asked for" + "Requirement result"
    // pair). achievement_test / submission_impact_if_missing from the supplied
    // list no longer render for matrix-covered rows; their result is the table.
    expect(text).toContain("Required Side 1 acting scene");
    expect(text).toContain("Contemporary legit MT song");
    expect(text).toContain("One continuous video containing the full package");
    expect(text).toContain("One final checked file");
    expect(text).toContain("Brief requirements checked");
    expect(text).toContain(
      "The required Side 1 acting scene was not identified in the submitted tape.",
    );
    expect(text).toContain("Record and include the full required Side 1 acting scene.");
    expect(text).not.toContain("Requirement result");
    expect(text).not.toContain("Achievement check:");
    expect(text).not.toContain("If missing:");
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
    // Δ6: the zone follows the canonical headline D (93 → "92-93"); pre-Δ6 it tracked A (91).
    expect(html).toContain("92-93");
    expect(html).toContain("Retake strategy:");

    for (const forbidden of s10StrongCompleteProfessionalExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/retake required/i);
  });

  it("renders diagnostic score visibility without the scoring-basis chip or summary", () => {
    const text = routeText(render(strongCompleteV2Report()));

    // S11-UX-05 / Δ6 — the "Scoring basis: <mode>" header chip and the scoring-basis
    // summary line are removed; the constructive score-visibility explanation stays.
    // (brief_supplied has no required_limitations, so only score-visibility remains.)
    expect(text).not.toContain("Scoring basis: Brief supplied");
    expect(text).not.toContain("Score language may include supplied brief achievement");
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
    // Δ6: the visible headline (ScoreRing) reads the canonical field, so the sub-90 scenario
    // must set it; score_summary/A is no longer what drives the rendered overall.
    view.canonical_overall_score = 82;
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

    // Δ6 P4 — the reconciled row now reads in the consolidated table as a
    // "Status not assessable" attention row (the matrix achievement_status the
    // reconciler downgraded to). The old dash-joined "achievement / observed /
    // completion" string is retired with the dual listing.
    expect(text).toContain("Required Side 1 acting scene Status not assessable");
    expect(text).toContain(
      "Evidence The required Side 1 acting scene is not confirmed from the tape.",
    );
    expect(text).toContain("S10 route reconciled this row with stricter observed-tape evidence");
    expect(text).toContain("Overall readiness —");
    expect(text).toContain("Record/include the full required Side 1 acting scene");
    // The stale "present / complete" status echo no longer renders anywhere.
    expect(text).not.toContain("Required Side 1 acting scene — present / complete");
    expect(text).not.toContain("Required Side 1 acting scene Status achieved");
    expect(text).not.toContain("Preserve the complete Side 1 plus song package");
    expect(text).not.toContain("Acting objective and scene partner focus are clear");
  });

  it("omits the Take context block from the web report and never exposes raw take IDs", () => {
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

    // S11-UX-05 / Δ6 — the "Take context" sub-block is removed from the web
    // report (it is intentionally retained for the PDF path, S11-PDF-01). None of
    // its rows render here, and the raw replaced-take ID is still never exposed.
    expect(text).not.toContain("Take context");
    expect(text).not.toContain("Active version: Version 3");
    expect(text).not.toContain("Replacement version; prior take proof is retained separately.");
    expect(text).not.toContain("Same-video status: Same video confirmed");
    expect(text).not.toContain("raw-replaced-take-id");
  });

  it("renders no-brief baseline scoring limits without claiming brief achievement", () => {
    const text = routeText(render(noBriefBaselineV2Report()));

    // S11-UX-05 / Δ6 — the "Scoring basis: <mode>" chip is removed, but the
    // no-brief required limitations still render under the "Scoring basis" card.
    expect(text).not.toContain("Scoring basis: No brief baseline");
    expect(text).toContain("No casting brief was supplied");
    expect(text).toContain("baseline assessment of the observable tape");
    expect(text).not.toContain("What the brief asked for");
    expect(text).not.toContain("Upload one file only");
    expect(text).not.toContain("File naming:");
  });

  it("renders partial-brief scoring limits without full-compliance language", () => {
    const text = routeText(render(partialBriefV2Report()));

    // S11-UX-05 / Δ6 — the chip is removed; the partial-brief required limitation
    // still renders, and the "Requirement classification" pills are gone for good.
    expect(text).not.toContain("Scoring basis: Partial brief supplied");
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

  // Δ6 P4 / S11-UX-03 — Brief de-dup + better brief-achievement table.
  // Slice the rendered route to JUST the "Brief achievement" Section so the
  // de-dup assertions are not confused by the same summary echoed in the
  // separate "Observed tape" / fix / technique sections.
  function briefAchievementSection(html: string): string {
    const start = html.indexOf("Brief achievement");
    const end = html.indexOf("Observed tape");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return html.slice(start, end);
  }
  function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
  }

  // Clause 1 — Single per-requirement table. A requirement summary that the
  // matrix carries must appear EXACTLY ONCE inside the Brief-achievement
  // Section (the one consolidated table), not duplicated across a separate
  // "What the brief asked for" list AND a "Requirement result" list. Fails
  // first against the pre-P4 double-listing (count 2).
  it("renders a single consolidated per-requirement table, not two listings", () => {
    const section = briefAchievementSection(routeText(render(strongCompleteV2Report())));

    // The two pre-P4 per-requirement sub-headings are retired. ("What the
    // brief asked for" survives ONCE in the Section hint sentence, so assert
    // it no longer appears a second time as a standalone sub-block heading;
    // pre-P4 it appeared twice — hint + sub-heading.)
    expect(countOccurrences(section, "What the brief asked for")).toBe(1);
    expect(section).not.toContain("Requirement result");
    // Exactly one consolidated table.
    expect(countOccurrences(section, "Brief requirements checked")).toBe(1);

    // Each requirement summary the matrix carries appears once in the table.
    for (const summary of [
      "Required Side 1 acting scene",
      "Contemporary legit MT song",
      "One continuous video containing the full package",
      "One final checked file",
    ]) {
      expect(
        countOccurrences(section, summary),
        `"${summary}" should appear exactly once in the Brief-achievement table`,
      ).toBe(1);
    }
  });

  // Clause 1 (cont.) — A brief_requirements row NOT represented in the matrix
  // (the orphan "Role context"/ctx-role, matched by id↔requirement_id then
  // summary↔requirement_summary) is folded into the same table so no required
  // brief information is dropped — appearing once, still under one Section.
  it("folds an orphan brief requirement into the consolidated table without dropping it", () => {
    const section = briefAchievementSection(routeText(render(canaryV2Report())));

    // ctx-role has no matrix requirement_result, so it must be appended as a row.
    expect(countOccurrences(section, "Role context")).toBeGreaterThanOrEqual(1);
    // The orphan carries its brief evidence/impact, not a fabricated status.
    expect(section).toContain(
      "Role context informs judgement but is not separate required material.",
    );
    // No standalone "What the brief asked for" sub-block (only the hint remains).
    expect(countOccurrences(section, "What the brief asked for")).toBe(1);
    expect(section).not.toContain("Requirement result");
  });

  // Clause 2 — De-dup status. The per-item present/observed status lines no
  // longer re-state in "Observed tape"; achievement status lives only in the
  // matrix table. Observed tape keeps each item's evidence + assessability.
  it("removes per-item status re-statement from Observed tape, keeping evidence", () => {
    const html = render(strongCompleteV2Report());
    const observedStart = html.indexOf("Observed tape");
    expect(observedStart).toBeGreaterThanOrEqual(0);
    const observed = html.slice(observedStart);

    // The old "label — Present / Complete" status echo is gone from Observed tape.
    expect(observed).not.toMatch(/Required Side 1 acting scene[\s\S]{0,40}—[\s\S]{0,40}Present/i);
    expect(observed).not.toContain(" / Complete");

    // The tape's physical-content evidence and assessability notes still render.
    const observedText = routeText(observed);
    expect(observedText).toContain("Side 1 and song appear in one continuous final video.");

    // Achievement status still appears, but in the Brief-achievement table.
    const section = routeText(briefAchievementSection(routeText(html)));
    expect(section.toLowerCase()).toContain("achieved");
  });

  // Clause 3 — Collapse achieved rows behind a native <details>. Attention
  // rows (blocker / not_achieved / partly_achieved / not_assessable) render
  // expanded; achieved/mostly/not_applicable non-blocker rows sit behind a
  // "Show N achieved requirements" expander that is collapsed by default.
  it("collapses achieved requirements behind a default-collapsed expander", () => {
    const html = render(canaryV2Report());
    const section = briefAchievementSection(html);

    // A <details> summary advertises the collapsed achieved count (canary has
    // exactly one achieved row, so the label is singular).
    expect(section).toMatch(/Show \d+ achieved requirements?/);
    // Collapsed by default — no `open` attribute on the <details>.
    expect(section).toMatch(
      /<details(?![^>]*\bopen\b)[^>]*>[\s\S]*Show \d+ achieved requirements?/,
    );

    // The only achieved row in canary (Landscape framing) lives INSIDE <details>.
    const detailsStart = section.indexOf("<details");
    const detailsEnd = section.indexOf("</details>");
    expect(detailsStart).toBeGreaterThanOrEqual(0);
    expect(detailsEnd).toBeGreaterThan(detailsStart);
    const collapsed = section.slice(detailsStart, detailsEnd);
    expect(routeText(collapsed)).toContain("Landscape close-up/head-and-shoulders framing");

    // An attention row (the blocker) renders OUTSIDE / BEFORE the expander.
    const beforeDetails = section.slice(0, detailsStart);
    expect(routeText(beforeDetails)).toContain("Required Side 1 acting scene");
  });

  // Clause 3 (cont.) — A fixture with no collapsible (achieved) rows renders no
  // expander. The strong-complete fixture is all-achieved/final-check, so the
  // attention set is empty and the expander instead holds the whole table; the
  // negative case is exercised by forcing every row into the attention set.
  it("renders no achieved-expander when there are no collapsible rows", () => {
    const report = canaryV2Report();
    const view = mutableS10View(report);
    const matrix = view.brief_achievement_matrix as Record<string, unknown>;
    // Force every requirement_result into the attention set (all not_achieved).
    matrix.requirement_results = (matrix.requirement_results as Array<Record<string, unknown>>).map(
      (r) => ({ ...r, achievement_status: "not_achieved", submission_impact: "material_gap" }),
    );

    const section = briefAchievementSection(render(report));
    expect(section).not.toMatch(/Show \d+ achieved requirements/);
    expect(section).not.toContain("<details");
  });

  // Clause 4 — Submission impact. A submission_blocker requirement is flagged
  // clearly (a destructive/warning badge), distinct from a plain impact label.
  it("flags a submission_blocker requirement clearly in the table", () => {
    const html = render(canaryV2Report());
    const section = briefAchievementSection(html);

    // The blocker row carries a visually distinct indicator (destructive badge).
    expect(section).toMatch(/bg-destructive|text-destructive|border-destructive/);
    // And it still surfaces the readable impact label (labelize lower-cases it).
    expect(routeText(section)).toContain("submission blocker");
  });

  // Clause 5 — Guardrails. No-brief must not invent achievements: the Section
  // returns null and the empty/limitation state covers the gap; no requirement
  // rows are fabricated.
  it("invents no requirement rows on a no-brief report", () => {
    const html = render(noBriefBaselineV2Report());
    const text = routeText(html);

    // The whole brief Section is absent (brief_achievement_matrix deleted), so
    // no consolidated brief table / requirement listing is fabricated. (The
    // observed-tape + component-breakdown modules still legitimately mention
    // "Required Side 1 acting scene" — that is observed evidence, not a brief
    // claim — so the guard targets the brief-table chrome specifically.)
    expect(text).not.toContain("What the brief asked for");
    expect(text).not.toContain("Brief requirements checked");
    expect(text).not.toContain("Supplied brief details");
    expect(text).not.toContain("Requirement classification");
    expect(text).not.toMatch(/Show \d+ achieved requirements?/);
  });

  // Clause 5 (cont.) — A not_assessable requirement surfaces as a limitation in
  // the attention/lead set, never silently as achieved or failed. Canary's
  // file-naming row is achievement_status === "not_assessable".
  it("surfaces a not_assessable requirement in the lead set, not as achieved", () => {
    const html = render(canaryV2Report());
    const section = briefAchievementSection(html);

    const detailsStart = section.indexOf("<details");
    const lead = detailsStart >= 0 ? section.slice(0, detailsStart) : section;
    // File naming (not_assessable) is in the lead/attention set, above any expander.
    expect(routeText(lead)).toContain("File naming instruction");
    // Its status reads as not assessable (labelize lower-cases it) — not "achieved".
    expect(routeText(lead)).toMatch(/File naming instruction Status not assessable/);
  });

  // Clause 6 — Legacy isolation. The whole Brief-achievement Section (and its
  // new consolidated table / achieved-expander) is gated behind `isS10`. A
  // non-S10 report never reaches that JSX, so none of its strings appear. The
  // S10 table only renders within the isS10 block, proving the de-dup is
  // S10-scoped and the legacy/limited surfaces are untouched. (Byte-identity of
  // V2ReportViewLegacy.tsx is additionally enforced by the diff check.)
  it("never renders the S10 brief-achievement table on a non-S10 report", () => {
    // A report with no s10_view_model / S10 modules / source_mode is non-S10.
    const nonS10Report = {
      version: 2,
      template_id: "v2-component",
      audition_type: "musical_theatre",
      overall_readiness: 72,
    } as Record<string, unknown>;

    const html = render(nonS10Report);

    // None of the S10 brief-table chrome appears on the non-S10 path.
    expect(html).not.toContain("What the brief asked for");
    expect(html).not.toContain("Requirement result");
    expect(html).not.toContain("Brief requirements checked");
    expect(html).not.toMatch(/Show \d+ achieved requirements/);
    // No requirement summary rows are fabricated on the non-S10 path.
    expect(html).not.toContain("Required Side 1 acting scene");
  });
});
