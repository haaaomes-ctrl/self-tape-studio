import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { V2ReportView } from "@/components/report/V2ReportView";
import {
  buildS10LimitedPerformerReportViewModel,
  buildS10PerformerReportViewModel,
  validateAuthenticatedS10RouteSurface,
} from "@/server/s10-report-view-model.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

function strongView(
  report: Record<string, unknown> = buildS10StrongCompleteProfessionalReportInput(),
) {
  const view = buildS10PerformerReportViewModel({
    report,
    context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
  if (!view) throw new Error("expected strong S10 view model");
  return view;
}

function canaryView(report: Record<string, unknown> = buildS10CanaryAReportInput()) {
  const view = buildS10PerformerReportViewModel({
    report,
    context: buildS10CanaryAViewContext() as never,
  });
  if (!view) throw new Error("expected canary S10 view model");
  return view;
}

function renderS10View(view: ReturnType<typeof strongView>) {
  return renderToStaticMarkup(
    React.createElement(V2ReportView, {
      report: {
        schema_version: "v2-component",
        mode: "brief",
        source_mode: "s10_ai_report_model",
        s10_view_model: view,
      },
      takeNumber: 1,
      auditionType: "musical_theatre",
    }),
  );
}

describe("S10.P1e source-map validation", () => {
  it("marks score_summary as a limitation when the visible S10 score is absent", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    delete (report.readiness_score_judgement as Record<string, unknown>)
      .overall_submission_readiness_score;
    const view = strongView(report);

    expect(view.score_summary.overall_submission_readiness_score).toBeNull();
    expect(view.section_source_map.score_summary).toMatchObject({
      source: "specific_limitation",
      module: "readiness_score_judgement",
    });
    expect(view.limitations).toContain("S10 score summary was unavailable for this report.");
    expect(renderS10View(view)).toContain("S10 score summary was unavailable for this report.");
    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });

  it("keeps score_summary authoritative when the visible S10 score exists", () => {
    const view = strongView();

    expect(view.score_summary.overall_submission_readiness_score).toBe(91);
    expect(view.section_source_map.score_summary).toMatchObject({
      source: "s10_authoritative_module",
      module: "readiness_score_judgement",
    });
    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });

  it("rejects S10 view models that are missing required source-map entries", () => {
    const view = strongView();
    delete (view.section_source_map as Record<string, unknown>).comparison_truth;

    const result = validateAuthenticatedS10RouteSurface(view);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("s10_view_model_incomplete_shape");
  });

  it("maps missing readiness to the readiness limitation when score summary is also unavailable", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    delete report.readiness_score_judgement;
    const view = strongView(report);

    expect(view.section_source_map.readiness_header).toMatchObject({
      source: "specific_limitation",
      module: "readiness_score_judgement",
      limitation: "Readiness judgement is not available for this report.",
    });
    expect(view.section_source_map.score_summary).toMatchObject({
      source: "specific_limitation",
      module: "readiness_score_judgement",
      limitation: "S10 score summary was unavailable for this report.",
    });
  });

  it("adds performer-facing limitations for empty S10 modules", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    report.s10_fix_hierarchy = {
      fix_first: {},
      priority_fixes: [],
      must_fix_before_submitting: [],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [],
    };
    report.s10_next_action_plan = {
      submit_checklist: [],
      retake_plan: [],
      final_checks: [],
      playback_checks: [],
      no_retake_needed_reason: null,
    };
    report.s10_professional_critique = { confidence: "high" };
    report.s10_technique_commentary = { confidence: "high" };
    report.s10_timestamped_commentary = {
      summary: "",
      notes: [],
      timestamp_limitations: [],
    };
    const view = strongView(report);

    expect(view.limitations).toContain("Fix hierarchy was unavailable for this S10 report.");
    expect(view.limitations).toContain("Next action plan was unavailable for this S10 report.");
    expect(view.limitations).toContain("Professional critique is not available for this report.");
    expect(view.limitations).toContain("Technique commentary is not available for this report.");
    expect(view.limitations).toContain(
      "Timestamped or time-banded commentary is not available for this report.",
    );
    expect(view.section_source_map.fix_hierarchy.source).toBe("specific_limitation");
    expect(view.section_source_map.next_action_plan.source).toBe("specific_limitation");
  });

  it.each([
    [
      "readiness_header",
      (view: ReturnType<typeof strongView>) => {
        view.limitations = ["A non-header limitation keeps the view-model shape usable."];
        view.recommendation = {
          decision: "" as never,
          headline: "",
          rationale: [{} as never],
          score_explanation: "",
          confidence: "high",
        };
      },
    ],
    [
      "brief_context",
      (view: ReturnType<typeof strongView>) => {
        view.brief_context = {};
      },
    ],
    [
      "brief_requirements",
      (view: ReturnType<typeof strongView>) => {
        view.brief_requirements = [{} as never];
      },
    ],
    [
      "brief_requirements",
      (view: ReturnType<typeof strongView>) => {
        view.brief_requirements = [{ report_destination: "brief_achievement" } as never];
      },
    ],
    [
      "brief_achievement",
      (view: ReturnType<typeof strongView>) => {
        view.brief_achievement_matrix = {} as never;
      },
    ],
    [
      "brief_achievement",
      (view: ReturnType<typeof strongView>) => {
        view.brief_achievement_matrix = {
          requirement_results: [{ fix_category: "must_fix" } as never],
        } as never;
      },
    ],
    [
      "brief_achievement",
      (view: ReturnType<typeof strongView>) => {
        view.brief_achievement_matrix = {
          requirement_results: [{ requirement_summary: "Side 1 acting scene" } as never],
        } as never;
      },
    ],
    [
      "observed_tape",
      (view: ReturnType<typeof strongView>) => {
        view.observed_tape = {
          observed_tape_sequence: [{} as never],
          component_verifications: [{} as never],
          media_observation_summary: null,
        };
      },
    ],
    [
      "observed_tape",
      (view: ReturnType<typeof strongView>) => {
        view.observed_tape = {
          observed_tape_sequence: [{ label: "Song" } as never],
          component_verifications: [{ requirement_summary: "Song" } as never],
          media_observation_summary: null,
        };
      },
    ],
    [
      "score_summary",
      (view: ReturnType<typeof strongView>) => {
        view.score_summary.overall_submission_readiness_score = null;
      },
    ],
    [
      "category_scores",
      (view: ReturnType<typeof strongView>) => {
        view.score_summary.category_scores = [];
      },
    ],
    [
      "category_scores",
      (view: ReturnType<typeof strongView>) => {
        view.score_summary.category_scores = [{ category_id: "acting" } as never];
      },
    ],
    [
      "category_scores",
      (view: ReturnType<typeof strongView>) => {
        view.score_summary.category_scores = [{ category_id: "movement", score: 88 } as never];
      },
    ],
    [
      "component_breakdown",
      (view: ReturnType<typeof strongView>) => {
        view.component_breakdown = [];
        view.observed_tape.component_verifications = [];
      },
    ],
    [
      "component_breakdown",
      (view: ReturnType<typeof strongView>) => {
        view.component_breakdown = [{} as never];
      },
    ],
    [
      "component_breakdown",
      (view: ReturnType<typeof strongView>) => {
        view.component_breakdown = [{ requirement_id: "req_side_1" } as never];
      },
    ],
    [
      "component_breakdown",
      (view: ReturnType<typeof strongView>) => {
        view.component_breakdown = [{ requirement_summary: "Side 1" } as never];
      },
    ],
    [
      "fix_hierarchy",
      (view: ReturnType<typeof strongView>) => {
        view.fix_hierarchy = {
          fix_first: null,
          priority_fixes: [],
          must_fix_before_submitting: [],
          should_improve_if_retaking: [],
          optional_polish: [],
          preserve: [],
          do_not_overfix: [],
          action_contradiction_warnings: [],
        };
      },
    ],
    [
      "fix_hierarchy",
      (view: ReturnType<typeof strongView>) => {
        view.fix_hierarchy = {
          fix_first: {},
          priority_fixes: [],
          must_fix_before_submitting: [],
          should_improve_if_retaking: [],
          optional_polish: [],
          preserve: [],
          do_not_overfix: [],
          action_contradiction_warnings: [],
        } as never;
      },
    ],
    [
      "next_action_plan",
      (view: ReturnType<typeof strongView>) => {
        view.next_action_plan = {
          submit_checklist: [],
          retake_plan: [],
          final_checks: [],
          playback_checks: [],
          do_not_overfix: [],
          if_time_is_short_guidance: [],
          no_retake_needed_reason: null,
          confidence: "high",
        };
      },
    ],
    [
      "professional_critique",
      (view: ReturnType<typeof strongView>) => {
        view.professional_critique = { confidence: "high" } as never;
      },
    ],
    [
      "professional_critique",
      (view: ReturnType<typeof strongView>) => {
        view.professional_critique = {
          performance_strengths: [{ confidence: "high" }],
          contradiction_warnings: ["metadata only"],
        } as never;
      },
    ],
    [
      "technique_commentary",
      (view: ReturnType<typeof strongView>) => {
        view.technique_commentary = { confidence: "high" } as never;
      },
    ],
    [
      "technique_commentary",
      (view: ReturnType<typeof strongView>) => {
        view.technique_commentary = {
          acting: {
            status: "assessable",
            what_is_working: [{ confidence: "high" }],
          },
        } as never;
      },
    ],
    [
      "presentation_notes",
      (view: ReturnType<typeof strongView>) => {
        if (view.technique_commentary?.self_tape_presentation) {
          view.technique_commentary.self_tape_presentation.what_is_working = [];
        }
        if (view.professional_critique)
          view.professional_critique.professional_presentation_notes = [];
      },
    ],
    [
      "timestamped_commentary",
      (view: ReturnType<typeof strongView>) => {
        view.timestamped_commentary = {
          summary: "",
          notes: [{} as never],
          component_ranges: [],
          missing_or_unobserved_components: [],
          timestamp_limitations: [],
          projection_notes: [],
          legacy_projection_blocked_count: 0,
          exact_timestamp_supported_count: 0,
          time_banded_note_count: 0,
          order_only_note_count: 0,
          missing_component_note_count: 0,
        } as never;
      },
    ],
    [
      "same_video_status",
      (view: ReturnType<typeof strongView>) => {
        view.same_video_status = {} as never;
        view.section_source_map.same_video_status = {
          source: "s10_authoritative_module",
          module: "s10_same_video_evidence",
          limitation: null,
        };
      },
    ],
    [
      "same_video_status",
      (view: ReturnType<typeof strongView>) => {
        view.same_video_status = { status: "same_video_confirmed" } as never;
        view.section_source_map.same_video_status = {
          source: "s10_authoritative_module",
          module: "s10_same_video_evidence",
          limitation: null,
        };
      },
    ],
    [
      "same_video_status",
      (view: ReturnType<typeof strongView>) => {
        view.same_video_status = {
          report_implication: "Do not compare these as separate takes.",
        } as never;
        view.section_source_map.same_video_status = {
          source: "s10_authoritative_module",
          module: "s10_same_video_evidence",
          limitation: null,
        };
      },
    ],
    [
      "comparison_truth",
      (view: ReturnType<typeof strongView>) => {
        view.comparison_truth = {} as never;
        view.section_source_map.comparison_truth = {
          source: "s10_authoritative_module",
          module: "s10_comparison_truth",
          limitation: null,
        };
      },
    ],
    [
      "comparison_truth",
      (view: ReturnType<typeof strongView>) => {
        view.comparison_truth = { comparison_mode: "same_video_duplicate" } as never;
        view.section_source_map.comparison_truth = {
          source: "s10_authoritative_module",
          module: "s10_comparison_truth",
          limitation: null,
        };
      },
    ],
    [
      "comparison_truth",
      (view: ReturnType<typeof strongView>) => {
        view.comparison_truth = { recommendation_policy: "do_not_pick_winner" } as never;
        view.section_source_map.comparison_truth = {
          source: "s10_authoritative_module",
          module: "s10_comparison_truth",
          limitation: null,
        };
      },
    ],
    [
      "comparison_truth",
      (view: ReturnType<typeof strongView>) => {
        view.comparison_display_mode = "comparison_caution";
        view.comparison_truth = {
          same_video_status: {
            performer_facing_summary: "Nested same-video text only.",
          },
        } as never;
        view.section_source_map.comparison_truth = {
          source: "s10_authoritative_module",
          module: "s10_comparison_truth",
          limitation: null,
        };
      },
    ],
    [
      "limitations",
      (view: ReturnType<typeof strongView>) => {
        view.limitations = [{} as never];
        view.section_source_map.limitations.module = "s10_view_model";
      },
    ],
    [
      "limitations",
      (view: ReturnType<typeof strongView>) => {
        view.limitations = ["  "];
        view.section_source_map.limitations.module = "s10_view_model";
      },
    ],
  ] as const)("rejects authoritative %s without visible route payload", (section, mutate) => {
    const view = strongView();
    mutate(view);
    view.section_source_map[section].source = "s10_authoritative_module";

    const result = validateAuthenticatedS10RouteSurface(view);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(`missing_visible_payload:${section}`);
  });

  it("does not render empty S10 fix-first or metadata-only technique list shells", () => {
    const view = strongView();
    view.fix_hierarchy = {
      fix_first: {},
      priority_fixes: [],
      must_fix_before_submitting: [],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [],
      action_contradiction_warnings: [],
    } as never;
    view.technique_commentary = {
      acting: {
        status: "assessable",
        what_is_working: [{ confidence: "high" }],
      },
    } as never;

    const html = renderS10View(view);
    expect(html).not.toContain("Fix first");
    expect(html).not.toContain("What is working");
    expect(html).not.toContain("[object Object]");
  });

  it("does not render blank S10 brief, observed-tape, component, or timestamp shells", () => {
    const view = strongView();
    view.brief_context = {};
    view.brief_requirements = [{} as never];
    view.brief_achievement_matrix = {} as never;
    view.observed_tape = {
      observed_tape_sequence: [{} as never],
      component_verifications: [{} as never],
      media_observation_summary: null,
    };
    view.component_breakdown = [{ requirement_id: "req_side_1" } as never];
    view.timestamped_commentary = {
      summary: "",
      notes: [{} as never],
      component_ranges: [],
      missing_or_unobserved_components: [],
      timestamp_limitations: [],
      projection_notes: [],
      legacy_projection_blocked_count: 0,
      exact_timestamp_supported_count: 0,
      time_banded_note_count: 0,
      order_only_note_count: 0,
      missing_component_note_count: 0,
    } as never;

    const html = renderS10View(view);
    expect(html).not.toContain("Requirement result");
    expect(html).not.toContain("Observed item");
    expect(html).not.toContain("Observed component");
    expect(html).not.toContain("Component 1");
    expect(html).not.toContain("Timing unavailable");
  });

  it("accepts route-visible same-video, comparison, and limitation text", () => {
    const view = strongView();
    view.comparison_display_mode = "comparison_caution";
    view.same_video_status = {
      performer_facing_summary: "These uploads appear to be the same underlying tape.",
      comparison_warning: null,
      limitations: [],
    } as never;
    view.comparison_truth = {
      performer_facing_summary: "Comparison should focus on report context rather than a winner.",
      limitations: [],
      same_video_status: view.same_video_status,
    } as never;
    view.limitations = ["Timestamped notes were not available for this report."];
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
    view.section_source_map.limitations = {
      source: "s10_authoritative_module",
      module: "s10_view_model",
      limitation: null,
    };

    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });

  it("marks hidden same-video and comparison payloads as not applicable", () => {
    const view = buildS10PerformerReportViewModel({
      report: buildS10StrongCompleteProfessionalReportInput(),
      context: {
        ...buildS10StrongCompleteProfessionalViewContext(),
        sameVideoEvidence: {
          performer_facing_summary: "These uploads appear to be the same underlying tape.",
          comparison_warning: null,
          limitations: [],
        } as never,
        comparisonTruth: {
          performer_facing_summary:
            "Comparison should focus on report context rather than a winner.",
          limitations: [],
        } as never,
        comparisonDisplayMode: "hidden",
      } as never,
    });
    if (!view) throw new Error("expected S10 view");

    expect(view.section_source_map.same_video_status.source).toBe("not_applicable");
    expect(view.section_source_map.comparison_truth.source).toBe("not_applicable");
    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });

  it("does not treat positive submit-ready rationale as submission risk payload", () => {
    const view = strongView();
    expect(view.recommendation?.decision).toBe("submit");
    expect(view.recommendation?.rationale.length).toBeGreaterThan(0);
    view.section_source_map.submission_risk = {
      source: "s10_authoritative_module",
      module: "readiness_score_judgement",
      limitation: null,
    };

    const result = validateAuthenticatedS10RouteSurface(view);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_visible_payload:submission_risk");
  });

  it("does not treat metadata-only fix fields as submission risk payload", () => {
    const view = strongView();
    view.fix_hierarchy = {
      fix_first: {},
      priority_fixes: [],
      must_fix_before_submitting: [{}],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [],
      action_contradiction_warnings: [],
    } as never;
    view.section_source_map.fix_hierarchy = {
      source: "specific_limitation",
      module: "s10_fix_hierarchy",
      limitation: "Fix hierarchy was unavailable for this S10 report.",
    };
    view.section_source_map.submission_risk = {
      source: "s10_authoritative_module",
      module: "s10_fix_hierarchy",
      limitation: null,
    };

    const result = validateAuthenticatedS10RouteSurface(view);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_visible_payload:submission_risk");
  });

  it("validates and renders object-shaped S10 recommendation rationale", () => {
    const view = strongView();
    view.recommendation = {
      decision: "submit",
      headline: "",
      rationale: [
        {
          title: "The complete package supports submission.",
          detail: "All required material is present and assessable.",
        } as never,
      ],
      score_explanation: "",
      confidence: "high",
    };
    view.section_source_map.readiness_header.source = "s10_authoritative_module";

    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
    const html = renderS10View(view);
    expect(html).toContain("Why this recommendation");
    expect(html).toContain("The complete package supports submission.");
    expect(html).not.toContain("[object Object]");
  });

  it("validates and renders populated S10 brief context, observed tape, and timestamp notes", () => {
    const view = strongView();
    view.brief_context = {
      project_name: "Spring showcase",
      role_name: "Mina",
      material_package_summary: "Side 1 plus a contemporary legit MT song.",
    };
    view.brief_requirements = [
      {
        id: "req_side_1",
        brief_text: "Prepare Side 1.",
        summary: "Side 1 acting scene",
        category: "material",
        importance: "mandatory",
        expected_evidence_in_tape: "A complete acting side.",
        achievement_test: "Side is present and assessable.",
        submission_impact_if_missing: "Missing side blocks submission.",
        report_destination: "brief_achievement",
        confidence: "high",
      },
    ];
    view.observed_tape = {
      observed_tape_sequence: [
        {
          label: "Song excerpt",
          present_status: "partially_present",
          completion_status: "cut_off",
          evidence_summary: "The song starts but cuts off before the ending.",
        } as never,
      ],
      component_verifications: [
        {
          requirement_summary: "Side 1 acting scene",
          observed_status: "absent",
          completion_status: "not_applicable",
          evidence_summary: "No acting side is visible in the submitted tape.",
        } as never,
      ],
      media_observation_summary: null,
    };
    view.timestamped_commentary = {
      summary: "",
      notes: [
        {
          display_label: "Not observed",
          title: "Side 1 is missing",
          detail: "The acting side requested in the brief is not present.",
          action: "Record the missing side before submitting.",
        } as never,
      ],
      component_ranges: [],
      missing_or_unobserved_components: [],
      timestamp_limitations: [],
      projection_notes: [],
      legacy_projection_blocked_count: 0,
      exact_timestamp_supported_count: 0,
      time_banded_note_count: 0,
      order_only_note_count: 0,
      missing_component_note_count: 0,
    } as never;

    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
    const html = renderS10View(view);
    expect(html).toContain("Spring showcase");
    expect(html).toContain("Side 1 acting scene");
    expect(html).toContain("Song excerpt");
    expect(html).toContain("No acting side is visible");
    expect(html).toContain("Side 1 is missing");
  });

  it("validates and renders technique what-is-working content counted as visible", () => {
    const view = strongView();
    view.technique_commentary = {
      summary: null,
      acting: {
        status: "assessable",
        headline: null,
        observations: [],
        what_is_working: [
          {
            title: "The opening beat is playable and clear.",
            detail: "The objective reads before the dialogue starts.",
          },
        ],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        limitations: [],
      },
    } as never;
    view.section_source_map.technique_commentary.source = "s10_authoritative_module";

    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
    const html = renderS10View(view);
    expect(html).toContain("What is working");
    expect(html).toContain("The opening beat is playable and clear.");
    expect(html).not.toContain("[object Object]");
  });

  it("validates and renders technique what-could-improve content counted as visible", () => {
    const view = strongView();
    view.technique_commentary = {
      summary: null,
      vocal_singing: {
        status: "assessable",
        headline: null,
        observations: [],
        what_is_working: [],
        what_could_improve: [
          {
            title: "Let the final phrase release cleanly.",
            detail: "It will make the cut-off feel intentional rather than clipped.",
          },
        ],
        practical_actions: [],
        preserve: [],
        limitations: [],
      },
    } as never;
    view.section_source_map.technique_commentary.source = "s10_authoritative_module";

    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
    const html = renderS10View(view);
    expect(html).toContain("What could improve");
    expect(html).toContain("Let the final phrase release cleanly.");
    expect(html).not.toContain("[object Object]");
  });

  it("validates and renders top-level technique limitations counted as visible", () => {
    const view = strongView();
    view.technique_commentary = {
      summary: null,
      acting: {
        status: "not_applicable",
        headline: "",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        not_assessable_reason: null,
        confidence: "low",
      },
      vocal_singing: {
        status: "not_applicable",
        headline: "",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        not_assessable_reason: null,
        confidence: "low",
      },
      movement_dance: {
        status: "not_applicable",
        headline: "",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        not_assessable_reason: null,
        confidence: "low",
      },
      musical_theatre_package: {
        status: "not_applicable",
        headline: "",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        not_assessable_reason: null,
        confidence: "low",
      },
      self_tape_presentation: {
        status: "not_applicable",
        headline: "",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        not_assessable_reason: null,
        confidence: "low",
      },
      commercial_screen_task: {
        status: "not_applicable",
        headline: "",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        not_assessable_reason: null,
        confidence: "low",
      },
      limitations: ["Technique commentary was limited to verified components."],
    } as never;
    view.section_source_map.technique_commentary.source = "s10_authoritative_module";

    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
    expect(renderS10View(view)).toContain(
      "Technique commentary was limited to verified components.",
    );
  });

  it("validates and renders S10 priority fixes when they are the only fix hierarchy content", () => {
    const view = strongView();
    view.fix_hierarchy = {
      fix_first: null,
      priority_fixes: [
        {
          title: "Keep the song ending in frame.",
          exact_action: "Hold the final moment until the cut.",
        },
      ],
      must_fix_before_submitting: [],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [],
    } as never;
    view.section_source_map.fix_hierarchy.source = "s10_authoritative_module";

    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
    const html = renderS10View(view);
    expect(html).toContain("Priority fixes");
    expect(html).toContain("Keep the song ending in frame.");
  });

  it("validates and renders S10 do-not-overfix guidance when it is the only fix content", () => {
    const view = strongView();
    view.fix_hierarchy = {
      fix_first: null,
      priority_fixes: [],
      must_fix_before_submitting: [],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [
        {
          title: "Do not sand down the spontaneous laugh.",
          detail: "It is part of the take's professional warmth.",
        },
      ],
    } as never;
    view.section_source_map.fix_hierarchy.source = "s10_authoritative_module";

    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
    const html = renderS10View(view);
    expect(html).toContain("Do not over-fix");
    expect(html).toContain("Do not sand down the spontaneous laugh.");
  });

  it.each([
    ["score_summary", "raw_report", "overall_score"],
    ["component_breakdown", "legacy_diagnostic_fallback", "detected_components"],
    ["fix_hierarchy", "s10_authoritative_module", "legacy_fix_first"],
    ["presentation_notes", "s10_authoritative_module", "legacy_presentation_notes"],
    ["submission_risk", "s10_authoritative_module", "legacy_risk_flags"],
  ] as const)("rejects invalid source-map entry for %s", (section, source, module) => {
    const view = strongView();
    view.section_source_map[section] = {
      source: source as never,
      module,
      limitation: null,
    };

    const result = validateAuthenticatedS10RouteSurface(view);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(new RegExp(section));
  });

  it("validates Canary A and strong-complete source maps", () => {
    expect(validateAuthenticatedS10RouteSurface(canaryView()).ok).toBe(true);
    expect(validateAuthenticatedS10RouteSurface(strongView()).ok).toBe(true);
  });

  it("uses not_applicable for intentionally absent same-video and diagnostic sections", () => {
    const view = strongView();

    expect(view.section_source_map.same_video_status.source).toBe("not_applicable");
    expect(view.section_source_map.comparison_truth.source).toBe("not_applicable");
    expect(view.section_source_map.diagnostic_chips.source).toBe("not_applicable");
    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });

  it("validates the limited S10 view model with explicit limitations", () => {
    const view = buildS10LimitedPerformerReportViewModel();

    expect(view.section_source_map.score_summary.source).toBe("specific_limitation");
    expect(view.section_source_map.presentation_notes.source).toBe("not_applicable");
    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });
});
