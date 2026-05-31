import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "@/components/report/V2ReportView";
import { compareS10OperatorAssumptions } from "@/server/s10-operator-assumption-checkpoints.server";
import { classifyS10SameVideoComparison } from "@/server/s10-same-video-comparison.server";
import { buildV2Report, type V2Report } from "@/server/v2-report-builder.server";
import {
  assertS10RouteContentAcceptance,
  type S10RouteContentAcceptanceResult,
} from "@/test-utils/s10-route-content-acceptance";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
  s10CanaryAExpectedViewModel,
  s10CanaryAOperatorAssumptionCheckpoint,
  s10CanaryAOperatorExpectation,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10SameVideoBaseReportInput,
  buildS10SameVideoBaseViewContext,
  s10SameVideoComparisonFixtures,
} from "@/test-fixtures/s10-same-video-comparison";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
  s10StrongCompleteProfessionalExpectedViewModel,
  s10StrongCompleteProfessionalOperatorAssumptionCheckpoint,
  s10StrongCompleteProfessionalOperatorExpectation,
} from "@/test-fixtures/s10-strong-complete-professional";

function render(report: Record<string, unknown>) {
  return renderToStaticMarkup(
    React.createElement(V2ReportView, {
      report,
      takeNumber: 1,
      auditionType: "musical_theatre",
    }),
  );
}

function expectAccepted(result: S10RouteContentAcceptanceResult) {
  expect(result.failures).toEqual([]);
  expect(result.ok).toBe(true);
}

function buildCanaryV2() {
  const report = buildS10CanaryAReportInput();
  const v2 = buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  });
  const html = render(v2 as unknown as Record<string, unknown>);
  const operatorComparison = compareS10OperatorAssumptions({
    checkpoint: s10CanaryAOperatorAssumptionCheckpoint,
    expectation: s10CanaryAOperatorExpectation,
    reportModules: report,
    viewModel: v2.s10_view_model as never,
    renderedText: html,
  });
  return { report, v2, html, operatorComparison };
}

function buildStrongV2() {
  const report = buildS10StrongCompleteProfessionalReportInput();
  const v2 = buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
  const html = render(v2 as unknown as Record<string, unknown>);
  const operatorComparison = compareS10OperatorAssumptions({
    checkpoint: s10StrongCompleteProfessionalOperatorAssumptionCheckpoint,
    expectation: s10StrongCompleteProfessionalOperatorExpectation,
    reportModules: report,
    viewModel: v2.s10_view_model as never,
    renderedText: html,
  });
  return { report, v2, html, operatorComparison };
}

function buildKnownRoleV2() {
  const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
  report.role_material_context = {
    applies: true,
    project_name: "Wicked",
    role_name: "Elphaba",
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
  const v2 = buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
  const html = render(v2 as unknown as Record<string, unknown>);
  return { report, v2, html };
}

function buildSameVideoV2(key: keyof typeof s10SameVideoComparisonFixtures) {
  const classification = classifyS10SameVideoComparison(s10SameVideoComparisonFixtures[key].input);
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
  const html = render(v2 as unknown as Record<string, unknown>);
  const fixture = s10SameVideoComparisonFixtures[key];
  const operatorComparison =
    "checkpoint" in fixture && "expectation" in fixture
      ? compareS10OperatorAssumptions({
          checkpoint: fixture.checkpoint,
          expectation: fixture.expectation,
          reportModules: report,
          viewModel: v2.s10_view_model as never,
          comparisonTruth: classification.comparison_truth,
          renderedText: html,
        })
      : null;
  return { report, v2, html, classification, operatorComparison, fixture };
}

describe("S10.15 route/PDF content acceptance harness", () => {
  it("accepts Canary A route/print content and rejects legacy false positives", () => {
    const { v2, html, operatorComparison } = buildCanaryV2();
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-canary-a",
      profile: "canary_a_incomplete_package",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      operator_comparison: operatorComparison,
      forbiddenExact: s10CanaryAExpectedViewModel.forbidden_route_content,
      requiredAllOf: [
        "Scoring basis",
        "Brief achievement",
        "Supplied brief details",
        "Requirement classification",
        "What the brief asked for",
        "Observed tape",
        "Prioritised fixes",
        "Next action plan",
        "Technique commentary",
        "Timestamped and time-banded notes",
        "Do not overfix",
      ],
      requiredAnyOf: [
        ["Retake required if possible"],
        ["required Side 1", "Side 1 not observed", "required acting side was not identified"],
        ["song completion", "completion is not confirmed", "partial"],
        ["Record/include the full required Side 1 acting scene", "record Side 1"],
        ["Playback-check", "playback check"],
        ["Acting scene not assessable", "acting scene could not be assessed"],
      ],
      expectedDecision: "retake_required_if_possible",
      expectedFixFirstIncludes: "Side 1",
    });

    expectAccepted(result);
  });

  it("accepts strong-complete route/print content without a thin positive shell", () => {
    const { v2, html, operatorComparison } = buildStrongV2();
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-strong-complete",
      profile: "strong_complete_professional",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      operator_comparison: operatorComparison,
      forbiddenExact: s10StrongCompleteProfessionalExpectedViewModel.forbidden_route_content,
      requiredAllOf: [
        "Scoring basis",
        "Brief achievement",
        "Supplied brief details",
        "Requirement classification",
        "Observed tape",
        "Strengths and preserve",
        "Technique commentary",
        "Timestamped and time-banded notes",
        "Professional competitive calibration",
        "Score zone",
        "Submit checklist",
        "Do not overfix",
      ],
      requiredAnyOf: [
        ["Submit: strong complete professional package", "Submit"],
        ["mostly achieved", "achieved"],
        ["Specific acting-through-song package integration"],
        ["Preserve the scene-to-song arc"],
        ["Optional polish", "No mandatory fix"],
        ["Do not rework the achieved package"],
      ],
      expectedDecision: ["submit", "submit_if_deadline_is_close"],
      expectedFixFirstIncludes: null,
    });

    expectAccepted(result);
  });

  it("accepts known role/material context only when source basis and boundaries render", () => {
    const { v2, html } = buildKnownRoleV2();
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-known-role-context",
      profile: "strong_complete_professional",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      forbiddenExact: [
        "This performer is right for the role.",
        "This performer is not right for the role.",
        "callback likelihood",
        "castability",
      ],
      requiredAllOf: [
        "Role / material context",
        "Source basis",
        "Official production synopsis",
        "Known material context only",
        "Supplied brief remains the primary standard",
        "Not assessed",
      ],
      requiredAnyOf: [["Elphaba"], ["Wicked"], ["Moral conviction under pressure"]],
      expectedDecision: ["submit", "submit_if_deadline_is_close"],
      expectedFixFirstIncludes: null,
      sourceExpectations: [
        {
          section: "role_material_context",
          expected_source: "s10_authoritative_module",
        },
      ],
    });

    expectAccepted(result);
  });

  it.each([
    ["accidentalDuplicate", "do_not_pick_winner"],
    ["intentionalRetest", "compare_contextual_outputs"],
    ["changedBrief", "compare_contextual_outputs"],
    ["changedLevel", "compare_contextual_outputs"],
    ["changedReportVersion", "compare_contextual_outputs"],
    ["uncertainWeakSignals", "operator_confirmation_required"],
  ] as const)(
    "accepts same-video V2 notice content for %s without performance-winner language",
    (key, policy) => {
      const { v2, html, operatorComparison, fixture } = buildSameVideoV2(key);
      const required =
        "expectation" in fixture ? fixture.expectation.expected_required_phrases : [];
      const result = assertS10RouteContentAcceptance({
        fixture_id: `s10-same-video-${key}`,
        profile: "same_video_notice",
        view_model: v2.s10_view_model,
        v2_report: v2 as unknown as Record<string, unknown>,
        rendered_route_html: html,
        operator_comparison: operatorComparison,
        forbiddenExact:
          "expectation" in fixture
            ? fixture.expectation.expected_forbidden_phrases
            : [
                "Take 1 is the stronger performance",
                "Take 2 is the stronger performance",
                "Use Take 1",
                "Use Take 2",
                "clear winner",
                "better performance",
              ],
        requiredAllOf: ["Same-video comparison"],
        requiredAnyOf: required.map((phrase) => phrase.split("|")),
        expectedDecision: "submit",
        expectedComparisonPolicy: policy,
      });

      expectAccepted(result);
    },
  );

  it("renders a technique limitation rather than legacy coaching drills when S10 technique is missing", () => {
    const report = buildS10CanaryAReportInput();
    delete (report as Record<string, unknown>).s10_technique_commentary;
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    const html = render(v2 as unknown as Record<string, unknown>);
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-canary-a-missing-technique",
      profile: "missing_module",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      forbiddenExact: [
        "Use one pass to strengthen blocked material.",
        "Naturalistic acting with good pace",
      ],
      requiredAllOf: ["Technique commentary is not available for this report."],
      sourceExpectations: [
        {
          section: "technique_commentary",
          expected_source: "specific_limitation",
        },
      ],
    });

    expectAccepted(result);
  });

  it("renders a timing limitation rather than legacy timestamp notes when S10 timestamps are missing", () => {
    const report = buildS10CanaryAReportInput();
    delete (report as Record<string, unknown>).s10_timestamped_commentary;
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    const html = render(v2 as unknown as Record<string, unknown>);
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-canary-a-missing-timestamps",
      profile: "missing_module",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      forbiddenExact: ["00:05 Strong start to the scene", "00:25 Good use of eyeline"],
      requiredAllOf: ["Timestamped or time-banded commentary is not available for this report."],
      sourceExpectations: [
        {
          section: "timestamped_commentary",
          expected_source: "specific_limitation",
        },
      ],
    });

    expectAccepted(result);
  });

  it("renders a fix limitation rather than legacy fix fields when S10 fix hierarchy is missing", () => {
    const report = buildS10CanaryAReportInput();
    report.fix_first = "Correct the file naming convention";
    report.priority_fixes = [{ headline: "Correct the file naming convention" }];
    delete (report as Record<string, unknown>).s10_fix_hierarchy;
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    const html = render(v2 as unknown as Record<string, unknown>);
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-canary-a-missing-fixes",
      profile: "missing_module",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      forbiddenExact: [
        "Correct the file naming convention",
        "No single public-safe priority fix was available",
      ],
      requiredAllOf: ["Fix hierarchy was unavailable for this S10 report."],
      sourceExpectations: [
        {
          section: "fix_hierarchy",
          expected_source: "specific_limitation",
        },
      ],
    });

    expectAccepted(result);
  });

  it("renders a next-action limitation rather than legacy next-take plan when S10 next action is missing", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    report.next_take_plan = {
      steps: ["Retake option: if recording again, use one pass to strengthen blocked material."],
    };
    report.coaching_drills = ["No single public-safe priority fix was available"];
    delete report.s10_next_action_plan;
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    const html = render(v2 as unknown as Record<string, unknown>);
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-canary-a-missing-next-action",
      profile: "missing_module",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      forbiddenExact: [
        "Retake option: if recording again, use one pass to strengthen blocked material.",
        "No single public-safe priority fix was available",
      ],
      requiredAllOf: ["Next action plan was unavailable for this S10 report."],
      sourceExpectations: [
        {
          section: "next_action_plan",
          expected_source: "specific_limitation",
        },
      ],
    });

    expectAccepted(result);
  });

  it("omits presentation notes rather than rendering legacy presentation copy when S10 presentation is absent", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    report.presentation_notes = [
      "Single-file submission as requested",
      "Correct material, orientation, and framing",
      "The frame is clean and easy to read",
    ];
    const technique = report.s10_technique_commentary as Record<string, unknown>;
    const presentation = technique.self_tape_presentation as Record<string, unknown>;
    presentation.what_is_working = [];
    presentation.what_could_improve = [];
    presentation.practical_actions = [];
    presentation.preserve = [];
    const critique = report.s10_professional_critique as Record<string, unknown>;
    critique.professional_presentation_notes = [];
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    const html = render(v2 as unknown as Record<string, unknown>);
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-canary-a-missing-presentation",
      profile: "missing_module",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      forbiddenExact: [
        "Single-file submission as requested",
        "Correct material, orientation, and framing",
        "The frame is clean and easy to read",
      ],
      sourceExpectations: [
        {
          section: "presentation_notes",
          expected_source: "not_applicable",
        },
      ],
    });

    expectAccepted(result);
  });

  it("omits stale legacy risk state when S10 readiness is submit-ready", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    report.at_risk = true;
    report.risk_flags = [{ severity: "low", flag: "LOW File naming convention not followed" }];
    report.submission_risk_flags = [
      { severity: "high", flag: "Stale missing-brief warning from legacy report" },
    ];
    report.block_reasons = ["Legacy missing brief blocker"];
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
    });
    const html = render(v2 as unknown as Record<string, unknown>);
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-strong-complete-stale-risk",
      profile: "missing_module",
      view_model: v2.s10_view_model,
      v2_report: v2 as unknown as Record<string, unknown>,
      rendered_route_html: html,
      forbiddenExact: [
        "LOW File naming convention not followed",
        "Stale missing-brief warning from legacy report",
        "Legacy missing brief blocker",
        "This tape is flagged",
      ],
      sourceExpectations: [
        {
          section: "submission_risk",
          expected_source: "not_applicable",
        },
      ],
    });

    expectAccepted(result);
  });

  it("reports actionable source-map failure details", () => {
    const { v2, html } = buildCanaryV2();
    const badView = structuredClone(v2.s10_view_model) as NonNullable<V2Report["s10_view_model"]>;
    badView.section_source_map.score_summary = {
      source: "legacy_diagnostic_fallback" as never,
      module: "raw_report.overall_score",
      limitation: null,
    };
    const result = assertS10RouteContentAcceptance({
      fixture_id: "s10-source-map-negative-control",
      profile: "canary_a_incomplete_package",
      view_model: badView,
      v2_report: { ...v2, s10_view_model: badView } as unknown as Record<string, unknown>,
      rendered_route_html: html,
      requiredAllOf: [],
      requiredAnyOf: [],
      forbiddenExact: [],
      densitySections: [],
      internalLeakTerms: [],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "source_map",
          section: "score_summary",
          expected_source: "s10_authoritative_module",
          actual_source: "legacy_diagnostic_fallback",
          actual_module: "raw_report.overall_score",
        }),
      ]),
    );
  });

  it("keeps fixture polarity distinct at the performer report surface", () => {
    const canary = buildCanaryV2();
    const strong = buildStrongV2();
    const duplicate = buildSameVideoV2("accidentalDuplicate");

    expect(canary.v2.s10_view_model?.recommendation?.decision).toBe("retake_required_if_possible");
    expect(canary.v2.fix_first).toMatch(/Side 1/i);
    expect(strong.v2.s10_view_model?.recommendation?.decision).toBe("submit");
    expect(strong.v2.fix_first).toBeNull();
    expect(duplicate.v2.s10_view_model?.comparison_truth?.recommendation_policy).toBe(
      "do_not_pick_winner",
    );
  });
});
