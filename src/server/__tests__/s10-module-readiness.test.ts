import { describe, expect, it } from "vitest";
import type { S10ObservationContext } from "@/server/s10-observation-context.server";
import {
  evaluateS10ModuleReadiness,
  getS10DegradableBlockers,
  getS10ModuleReadinessStatus,
  summariseS10ModuleReadinessForPersistence,
} from "@/server/s10-module-readiness.server";
import type { BriefRequirement } from "@/lib/audition-rules";

const mediaObservationSummary = {
  audio_assessable: true,
  video_assessable: true,
  framing_assessable: true,
  continuity_assessable: true,
  abrupt_cutoff_detected: false,
  one_continuous_video_observed: true,
  duration_summary: "The tape runs for just over three minutes and is assessable.",
  uncertainties: [],
};

const requirement: BriefRequirement = {
  id: "req-side-1",
  brief_text: "Please submit Side 1 as one continuous self-tape.",
  summary: "Side 1 acting scene",
  category: "material",
  importance: "mandatory",
  expected_evidence_in_tape: "The Side 1 acting scene appears in the recording.",
  achievement_test: "The acting scene is visible and audible through the required material.",
  submission_impact_if_missing: "Missing Side 1 blocks normal submission readiness.",
  report_destination: "brief_achievement",
  confidence: "high",
};

const completeObservationContext: S10ObservationContext = {
  source_kind: "two_step_s10_observation",
  observed_tape_sequence: [
    {
      id: "section_1",
      label: "Side 1 acting scene",
      component_type: "acting_scene",
      linked_requirement_ids: ["req-side-1"],
      start_time: "00:05",
      end_time: "02:48",
      present_status: "present",
      completion_status: "complete",
      evidence_summary: "The acting scene is visible and audible from 00:05 to 02:48.",
      observed_from_media: true,
      evidence_basis: "observed_audio_video",
      confidence: "high",
      assessability_notes: "",
    },
  ],
  component_verifications: [
    {
      requirement_id: "req-side-1",
      requirement_summary: "Side 1 acting scene",
      observed_status: "present",
      completion_status: "complete",
      evidence_summary: "The requested acting scene is visible and audible through completion.",
      observed_from_media: true,
      evidence_basis: "observed_audio_video",
      timestamp_refs: ["00:05-02:48"],
      confidence: "high",
      cannot_infer_from_brief_only: true,
      assessability_notes: "",
    },
  ],
  media_observation_summary: mediaObservationSummary,
  limitations: [],
  contradiction_warnings: [],
};

const unavailableObservationContext: S10ObservationContext = {
  source_kind: "unavailable",
  observed_tape_sequence: [],
  component_verifications: [],
  media_observation_summary: mediaObservationSummary,
  limitations: ["Component verification was unavailable for this S10 report."],
  contradiction_warnings: [],
};

function completeReport() {
  return {
    mode: "brief",
    brief_achievement_matrix: {
      summary: "The mandatory Side 1 material is present and complete in the observed tape.",
      overall_status: "achieved",
      mandatory_status: "clear",
      readiness_impact: "submission_supporting",
      requirement_results: [
        {
          requirement_id: "req-side-1",
          achievement_status: "achieved",
          evidence_summary: "Side 1 is observed from 00:05 to 02:48.",
          cannot_infer_from_brief_only: true,
        },
      ],
    },
    readiness_score_judgement: {
      decision: "submit",
      headline: "Submit: the required acting scene is complete and assessable.",
      rationale: [
        "The tape completes the requested Side 1 and is judged against the Professional standard.",
      ],
      score_explanation:
        "The score reflects complete required material, assessable audio/video and professional-level clarity.",
      performance_quality_score: 88,
      brief_completion_score: 100,
      overall_submission_readiness_score: 88,
      selected_level_calibration: {
        selected_level: "professional",
        selected_level_label: "Professional",
        standard_applied:
          "Judged as a job-facing professional self-tape where clarity and specificity need to hold without explanation.",
        evidence_threshold:
          "The report needs visible and audible evidence of the required scene before praising acting choices.",
        readiness_standard:
          "A Professional submit recommendation requires complete material and competitive, specific acting choices.",
        score_meaning:
          "The score means the tape is submission-supporting against the selected Professional level.",
        what_meets_level:
          "The completed Side 1 is clear, audible and specific enough to support a Professional submission.",
        what_falls_short:
          "The remaining gap is refinement of the final beat rather than missing material.",
        recommendation_impact:
          "Because the mandatory material is complete, level calibration does not override the submit recommendation.",
        comparison_to_other_levels:
          "At lower levels the same evidence would read more comfortably above standard; at Professional it remains submit-ready with refinement.",
        confidence: "high",
      },
    },
    s10_fix_hierarchy: {
      fix_first: {
        title: "Sharpen the final turn before export.",
        action:
          "Retain the take if deadline is close; if retaking, clarify the final thought shift.",
        why_it_matters:
          "The required scene is complete, so the useful improvement is precision in the last beat.",
      },
      priority_fixes: [
        {
          title: "Clarify the last thought shift.",
          action: "Mark the change in objective before the final line.",
          submission_impact: "This would lift the tape from solid to more competitive.",
        },
      ],
    },
    s10_next_action_plan: {
      steps: [
        {
          title: "Watch the final beat once before upload.",
          action: "Check that the last thought shift is visible without adding extra movement.",
          reason: "This preserves the complete take while improving precision.",
        },
      ],
    },
    s10_professional_critique: {
      summary: "The performance is specific, controlled and complete enough to support submission.",
      performance_strengths: [
        {
          title: "Clear objective through the scene.",
          evidence: "The performer sustains the acting scene through the requested material.",
        },
      ],
      preserve: [
        {
          title: "Keep the stillness in the central beat.",
          reason: "It lets the thought shift read cleanly on camera.",
        },
      ],
      do_not_overfix: [
        {
          title: "Do not add larger movement.",
          reason: "The frame already supports the scene and the brief asks for self-tape clarity.",
        },
      ],
      critique_limitations: [],
    },
    s10_technique_commentary: {
      acting: {
        status: "assessable",
        observations: [
          {
            title: "Objective tracking is readable.",
            evidence: "The performer keeps the scene active through the observed Side 1.",
          },
        ],
        actionable_notes: [
          {
            title: "Define the final turn.",
            action: "Let the last beat land before the final line.",
          },
        ],
      },
      vocal_singing: {
        status: "not_applicable",
        limitations: ["No song was requested for this acting-only fixture."],
      },
    },
    s10_timestamped_commentary: {
      notes: [
        {
          time_label: "02:30-02:48",
          note: "The final turn is the useful refinement point before export.",
        },
      ],
    },
  };
}

describe("S10 module readiness and repair triggers", () => {
  it("marks a complete two-step report module-ready without repair actions", () => {
    const summary = evaluateS10ModuleReadiness({
      report: completeReport(),
      observationContext: completeObservationContext,
      briefRequirements: [requirement],
      selectedLevel: "professional",
      sourceStage: "two_step",
    });

    expect(summary.module_ready).toBe(true);
    expect(summary.thin_shell_blocked).toBe(false);
    expect(summary.repair_actions).toEqual([]);
    expect(getS10ModuleReadinessStatus(summary, "observed tape")).toBe("complete");
    expect(getS10ModuleReadinessStatus(summary, "overall readiness")).toBe("complete");
    expect(getS10ModuleReadinessStatus(summary, "technique commentary")).toBe("complete");
  });

  it("triggers repair for missing observation evidence and generic judgement modules", () => {
    const report = {
      raw_report: {
        detected_components: ["Side 1"],
      },
      brief_achievement_matrix: {
        summary: "No single public-safe priority fix was available.",
        requirement_results: [],
      },
      readiness_score_judgement: {
        decision: "review_carefully",
        headline: "Performance captured for review.",
        rationale: ["Continue refining."],
        selected_level_calibration: {},
      },
      s10_fix_hierarchy: {
        fix_first: "No single public-safe priority fix was available.",
      },
      s10_next_action_plan: {
        steps: ["Continue refining."],
      },
      s10_professional_critique: {
        summary: "Preserve the clearest choices already captured.",
      },
    };

    const summary = evaluateS10ModuleReadiness({
      report,
      observationContext: unavailableObservationContext,
      briefRequirements: [requirement],
      selectedLevel: "professional",
      sourceStage: "single_pass",
    });

    expect(summary.module_ready).toBe(false);
    expect(summary.thin_shell_blocked).toBe(true);
    expect(summary.repair_actions.map((action) => action.report_module)).toEqual(
      expect.arrayContaining([
        "observed tape",
        "brief achievement",
        "overall readiness",
        "fix-first",
        "next action",
        "professional critique",
      ]),
    );
    for (const action of summary.repair_actions) {
      expect(action.repair_prompt).toContain("Reason for repair");
      expect(action.repair_prompt).not.toContain("raw_report as source of truth");
    }
  });

  it("treats no-brief missing brief achievement as not assessable rather than repair", () => {
    const report = completeReport();
    delete (report as Record<string, unknown>).brief_achievement_matrix;

    const summary = evaluateS10ModuleReadiness({
      report,
      observationContext: completeObservationContext,
      briefRequirements: [],
      selectedLevel: "professional",
      sourceStage: "two_step",
    });

    expect(getS10ModuleReadinessStatus(summary, "brief achievement")).toBe("not_assessable");
    expect(
      summary.repair_actions.some((action) => action.report_module === "brief achievement"),
    ).toBe(false);
  });

  it("uses the same critical readiness modules for two-step and single-pass paths", () => {
    const twoStep = evaluateS10ModuleReadiness({
      report: completeReport(),
      observationContext: completeObservationContext,
      briefRequirements: [requirement],
      selectedLevel: "professional",
      sourceStage: "two_step",
    });
    const singlePass = evaluateS10ModuleReadiness({
      report: completeReport(),
      observationContext: completeObservationContext,
      briefRequirements: [requirement],
      selectedLevel: "professional",
      sourceStage: "single_pass",
    });

    expect(twoStep.results.map((result) => result.report_module)).toEqual(
      singlePass.results.map((result) => result.report_module),
    );
    expect(singlePass.source_stage).toBe("single_pass");
  });

  it("treats technique commentary as a non-decision-critical degradable blocker", () => {
    const report = completeReport();
    // Remove only technique commentary: with a verified present component this
    // becomes a blocking module, but it must not be decision-critical.
    delete (report as Record<string, unknown>).s10_technique_commentary;

    const summary = evaluateS10ModuleReadiness({
      report,
      observationContext: completeObservationContext,
      briefRequirements: [requirement],
      selectedLevel: "professional",
      sourceStage: "two_step",
    });

    expect(summary.module_ready).toBe(false);
    expect(summary.decision_critical_blocked).toBe(false);
    const degradable = getS10DegradableBlockers(summary);
    expect(degradable.map((result) => result.report_module)).toEqual(["technique commentary"]);
    expect(
      summary.results.find((result) => result.report_module === "technique commentary")
        ?.decision_critical,
    ).toBe(false);
    expect(
      summary.results.find((result) => result.report_module === "fix-first")?.decision_critical,
    ).toBe(true);
  });

  it("flags decision-critical blocking when core judgement modules fail", () => {
    const summary = evaluateS10ModuleReadiness({
      report: {
        readiness_score_judgement: {
          decision: "review_carefully",
          headline: "Performance captured for review.",
          rationale: ["Continue refining."],
        },
      },
      observationContext: unavailableObservationContext,
      briefRequirements: [requirement],
      selectedLevel: "professional",
      sourceStage: "single_pass",
    });

    expect(summary.decision_critical_blocked).toBe(true);
  });

  it("omits repair prompt text from persisted module-readiness diagnostics", () => {
    const summary = evaluateS10ModuleReadiness({
      report: {
        readiness_score_judgement: {
          decision: "review_carefully",
          headline: "Performance captured for review.",
          rationale: ["Continue refining."],
        },
      },
      observationContext: unavailableObservationContext,
      briefRequirements: [requirement],
      selectedLevel: "professional",
      sourceStage: "single_pass",
    });

    expect(summary.repair_actions.length).toBeGreaterThan(0);
    expect(summary.repair_actions[0]).toHaveProperty("repair_prompt");

    const persisted = summariseS10ModuleReadinessForPersistence(summary);

    expect(persisted.repair_actions[0]).not.toHaveProperty("repair_prompt");
    expect(persisted.repair_actions[0]?.repair_prompt_omitted).toBe(true);
  });
});
