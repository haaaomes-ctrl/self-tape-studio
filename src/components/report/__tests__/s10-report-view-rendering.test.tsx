import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "../V2ReportView";

function render(report: Record<string, unknown>) {
  return renderToStaticMarkup(
    <V2ReportView report={report} takeNumber={1} auditionType="musical_theatre" />,
  );
}

const canaryReport = {
  schema_version: "v2-component",
  source_mode: "s10_ai_report_model",
  overall_readiness: 42,
  headline: "Retake required if possible: the required Side 1 is missing.",
  verdict: "retake_required_if_possible",
  strengths: [
    { point: "Correct material, orientation, and framing" },
    { point: "Single-file submission as requested" },
  ],
  priority_fixes: [{ headline: "Correct the file naming convention" }],
  timestamped_notes: [
    { timestamp: "00:05", note: "Strong start to the scene" },
    { timestamp: "00:25", note: "Good use of eyeline" },
  ],
  category_rationale: {
    acting: { what_works: "Naturalistic acting with good pace" },
    vocal: { what_works: "Strong contemporary legit vocal with clear storytelling" },
  },
  scores: { brief_adherence: 25, audio: 86 },
  components: [
    {
      type: "Required Side 1 acting scene",
      component_type: "Required Side 1 acting scene",
      label: "Required Side 1 acting scene",
      note: "No Side 1 acting scene was identified.",
      what_is_assessable: "absent; incomplete",
    },
  ],
  s10_view_model: {
    report_version: "s10_performer_report_view_model_v1",
    source_mode: "s10_ai_report_model",
    section_source_map: {
      readiness_header: {
        source: "s10_authoritative_module",
        module: "readiness_score_judgement",
        limitation: null,
      },
      submission_guidance: {
        source: "s10_authoritative_module",
        module: "readiness_score_judgement",
        limitation: null,
      },
      score_summary: {
        source: "s10_authoritative_module",
        module: "readiness_score_judgement",
        limitation: null,
      },
      brief_context: {
        source: "s10_authoritative_module",
        module: "brief_context",
        limitation: null,
      },
      brief_requirements: {
        source: "s10_authoritative_module",
        module: "brief_requirements",
        limitation: null,
      },
      brief_achievement: {
        source: "s10_authoritative_module",
        module: "brief_achievement_matrix",
        limitation: null,
      },
      observed_tape: {
        source: "s10_authoritative_module",
        module: "observed_tape",
        limitation: null,
      },
      component_breakdown: {
        source: "s10_authoritative_module",
        module: "component_verifications",
        limitation: null,
      },
      fix_hierarchy: {
        source: "s10_authoritative_module",
        module: "s10_fix_hierarchy",
        limitation: null,
      },
      next_action_plan: {
        source: "s10_authoritative_module",
        module: "s10_next_action_plan",
        limitation: null,
      },
      strengths_and_preserve: {
        source: "s10_authoritative_module",
        module: "s10_professional_critique",
        limitation: null,
      },
      professional_critique: {
        source: "s10_authoritative_module",
        module: "s10_professional_critique",
        limitation: null,
      },
      technique_commentary: {
        source: "s10_authoritative_module",
        module: "s10_technique_commentary",
        limitation: null,
      },
      timestamped_commentary: {
        source: "s10_authoritative_module",
        module: "s10_timestamped_commentary",
        limitation: null,
      },
      limitations: {
        source: "s10_authoritative_module",
        module: "s10_view_model",
        limitation: null,
      },
      same_video_status: { source: "unsupported", module: null, limitation: "Unavailable." },
      diagnostic_chips: { source: "unsupported", module: null, limitation: "Unavailable." },
    },
    recommendation: {
      decision: "retake_required_if_possible",
      headline: "Retake required if possible: the required Side 1 is missing.",
      rationale: ["The mandatory Side 1 acting scene was not observed."],
      score_explanation: "Missing Side 1 blocks submission readiness.",
      confidence: "high",
    },
    score_summary: {
      overall_submission_readiness_score: 42,
      performance_quality_score: 78,
      brief_completion_score: 25,
      score_band_label: "retake_required_if_possible",
      category_scores: [],
      component_scores: [],
    },
    brief_requirements: [
      {
        id: "req-side-1",
        summary: "Required Side 1 acting scene",
        brief_text: "Please prepare Side 1.",
        importance: "mandatory",
        category: "material",
      },
    ],
    brief_achievement_matrix: {
      overall_status: "not_achieved",
      mandatory_status: "blocked",
      readiness_impact: "submission_blocker",
      summary: "The required Side 1 was not observed and the song/package is incomplete.",
      requirement_results: [
        {
          requirement_id: "req-side-1",
          requirement_summary: "Required Side 1 acting scene",
          achievement_status: "not_achieved",
          recommended_action: "Record and include the full required Side 1 acting scene.",
        },
      ],
    },
    observed_tape: {
      observed_tape_sequence: [],
      component_verifications: [
        {
          requirement_id: "req-side-1",
          requirement_summary: "Required Side 1 acting scene",
          observed_status: "absent",
          completion_status: "incomplete",
          evidence_summary: "No Side 1 acting scene was identified.",
        },
      ],
    },
    component_breakdown: [],
    fix_hierarchy: {
      fix_first: {
        title: "Record/include the full required Side 1 acting scene.",
        exact_action: "Record the full Side 1 and include it in the final continuous video.",
      },
      must_fix_before_submitting: [
        {
          title: "Complete the required package.",
          exact_action: "Include Side 1 and confirm the song runs through.",
        },
      ],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
    },
    next_action_plan: {
      retake_plan: ["Record the full required Side 1 acting scene."],
      playback_checks: ["Playback-check the end of the song for cut-off before upload."],
      final_checks: ["Export one final checked file containing Side 1 and song."],
      submit_checklist: [],
    },
    strengths_and_preserve: {
      summary: "Keep supported technical positives while fixing the missing material.",
      strengths: [
        {
          title: "Audio is assessable.",
          detail: "Do not chase audio before fixing missing material.",
        },
      ],
      preserve: [],
      do_not_overfix: [
        { title: "Do not overfix audio/framing.", detail: "Prioritise missing Side 1." },
      ],
      limitations: ["Acting-scene strengths cannot be assessed because Side 1 is absent."],
    },
    technique_commentary: {
      summary: "Technique notes are limited by the missing required Side 1.",
      acting: {
        status: "not_assessable",
        headline: "Acting scene not assessable because required Side 1 is missing.",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: ["Record the required Side 1 before judging acting technique."],
        not_assessable_reason: "The required Side 1 was not identified in the tape.",
      },
      vocal_singing: {
        status: "partially_assessable",
        headline: "Song technique applies only to the observed portion.",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: ["Confirm the song runs through to the end."],
      },
      movement_dance: {
        status: "not_applicable",
        headline: "",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
      },
      musical_theatre_package: {
        status: "partially_assessable",
        headline: "The MT package is incomplete because Side 1 is missing.",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
      },
      self_tape_presentation: {
        status: "assessable",
        headline: "Audio/framing can be kept while fixing material.",
        observations: [],
        what_is_working: ["Audio is assessable."],
        what_could_improve: [],
        practical_actions: [],
      },
      commercial_screen_task: {
        status: "not_applicable",
        headline: "",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
      },
    },
    timestamped_commentary: {
      summary: "No acting-scene timestamp is available because Side 1 was not observed.",
      notes: [
        {
          id: "note-side-1",
          display_label: "Not observed",
          title: "Required Side 1 not observed.",
          detail: "The required acting scene was not identified in this tape.",
          action: "Record and include Side 1.",
          section: "missing_component",
        },
      ],
      timestamp_limitations: [
        "Exact acting-scene timestamps are unavailable because the scene was not observed.",
      ],
    },
    limitations: [],
  },
};

describe("S10 report view rendering", () => {
  it("renders Canary A from S10 modules and not legacy false positives", () => {
    const html = render(canaryReport);

    expect(html).toContain("Retake required if possible");
    expect(html).toContain("42");
    expect(html).toContain("Required Side 1 acting scene");
    expect(html).toContain("Record/include the full required Side 1 acting scene");
    expect(html).toContain("Playback-check the end of the song");
    expect(html).toContain("not assessable");
    expect(html).toContain("Not observed");

    expect(html).not.toContain("Take 1 · 93");
    expect(html).not.toContain("Strong for this level");
    expect(html).not.toContain("well aligned with the supplied brief");
    expect(html).not.toContain("Correct material, orientation, and framing");
    expect(html).not.toContain("Single-file submission as requested");
    expect(html).not.toContain("Naturalistic acting with good pace");
    expect(html).not.toContain("Strong contemporary legit vocal with clear storytelling");
    expect(html).not.toContain("00:05");
    expect(html).not.toContain("00:25");
  });

  it("renders a strong complete report with useful S10 density", () => {
    const complete = structuredClone(canaryReport);
    complete.overall_readiness = 91;
    complete.headline = "Submit: complete, specific professional package.";
    const s10 = complete.s10_view_model as Record<string, unknown>;
    s10.recommendation = {
      decision: "submit",
      headline: "Submit: complete, specific professional package.",
      rationale: ["Mandatory requirements are achieved."],
      score_explanation: "The package is brief-complete and strong for the selected level.",
      confidence: "high",
    };
    s10.score_summary = {
      overall_submission_readiness_score: 91,
      performance_quality_score: 92,
      brief_completion_score: 95,
      score_band_label: "submit_strong_submission",
      category_scores: [],
      component_scores: [],
    };
    (s10.brief_achievement_matrix as Record<string, unknown>).summary =
      "Mandatory requirements are achieved.";
    (s10.fix_hierarchy as Record<string, unknown>).fix_first = null;
    (s10.fix_hierarchy as Record<string, unknown>).must_fix_before_submitting = [];
    s10.next_action_plan = {
      submit_checklist: ["Confirm filename, deadline and final playback before upload."],
      retake_plan: [],
      final_checks: ["Final playback check."],
      playback_checks: ["Check the full file plays through."],
    };
    s10.strengths_and_preserve = {
      summary: "The package reads clearly and should be preserved.",
      strengths: [
        {
          title: "Specific acting-through-song choices.",
          detail: "The work is clear and repeatable.",
        },
      ],
      preserve: [
        { title: "Preserve the direct camera readability.", detail: "It supports the brief." },
      ],
      do_not_overfix: [
        {
          title: "Do not retake without a concrete polish reason.",
          detail: "The package is already complete.",
        },
      ],
      limitations: [],
    };
    (s10.technique_commentary as Record<string, unknown>).acting = {
      status: "assessable",
      headline: "Acting objective and listening are clear.",
      observations: [
        { title: "Specific scene partner focus.", detail: "The side has playable stakes." },
      ],
      what_is_working: [],
      what_could_improve: [],
      practical_actions: ["Keep the turn into the final beat precise."],
    };
    (s10.timestamped_commentary as Record<string, unknown>).notes = [
      {
        id: "note-acting",
        display_label: "Opening section",
        title: "The first beat establishes the given circumstances.",
        detail: "Keep this clarity.",
        section: "technique",
      },
    ];

    const html = render(complete);
    expect(html).toContain("Submit: complete, specific professional package");
    expect(html).toContain("Specific acting-through-song choices");
    expect(html).toContain("Confirm filename, deadline and final playback");
    expect(html).toContain("Acting objective and listening are clear");
    expect(html).toContain("Opening section");
    expect(html).not.toContain("No single public-safe priority fix was available");
  });
});
