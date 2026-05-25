import { describe, expect, it } from "vitest";
import type {
  BriefAchievementMatrix,
  BriefRequirement,
  ReadinessAndScoreJudgement,
  S10FixItem,
} from "@/lib/audition-rules";
import type { ComponentVerification, ObservedTapeSequence } from "@/server/evidence-pass.server";
import { normaliseBriefAchievementMatrix } from "@/server/s10-brief-achievement-matrix.server";
import { applyS10FixHierarchyNextAction } from "@/server/s10-fix-hierarchy-next-action.server";

function requirement(
  id: string,
  summary: string,
  category: BriefRequirement["category"],
  importance: BriefRequirement["importance"] = "mandatory",
): BriefRequirement {
  return {
    id,
    brief_text: summary,
    summary,
    category,
    importance,
    expected_evidence_in_tape: `Media evidence for ${summary}`,
    achievement_test: `Check whether ${summary} is observed and complete.`,
    submission_impact_if_missing:
      importance === "mandatory" ? "Blocks readiness." : "Optional polish.",
    report_destination: "s10_fix_hierarchy",
    confidence: "high",
  };
}

function verification(
  requirementId: string,
  requirementSummary: string,
  observed_status: ComponentVerification["observed_status"],
  completion_status: ComponentVerification["completion_status"],
  evidence_summary: string,
): ComponentVerification {
  return {
    requirement_id: requirementId,
    requirement_summary: requirementSummary,
    observed_status,
    completion_status,
    evidence_summary,
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    timestamp_refs: [],
    confidence: "high",
    cannot_infer_from_brief_only: true,
    assessability_notes: "",
  };
}

function fixItem(overrides: Partial<S10FixItem>): S10FixItem {
  return {
    id: "fix",
    title: "Fix",
    issue: "Issue",
    why_it_matters: "Why it matters.",
    exact_action: "Take this action.",
    source_category: "performance",
    urgency: "medium",
    submission_impact: "review_carefully",
    linked_requirement_ids: [],
    linked_matrix_result_ids: [],
    linked_component_verification_ids: [],
    linked_readiness_reason_ids: [],
    evidence_summary: "Evidence.",
    confidence: "medium",
    is_fix_first_candidate: false,
    is_generic_fallback: false,
    source_authority: "s10_ai_authored",
    legacy_source_used: false,
    legacy_source_path: null,
    ...overrides,
  };
}

const canaryRequirements = [
  requirement("req_side_1", "Side 1 acting scene", "material"),
  requirement("req_song", "Contemporary legit MT song", "material"),
  requirement("req_package", "One continuous video containing the full package", "technical"),
  requirement("req_one_file", "One final upload file", "admin_process"),
  requirement("req_landscape", "Landscape head-and-shoulders framing", "technical"),
];

const canarySequence: ObservedTapeSequence[] = [
  {
    id: "section_song",
    label: "Partial song section",
    component_type: "song",
    linked_requirement_ids: ["req_song"],
    start_time: "00:09",
    end_time: "01:42",
    present_status: "partially_present",
    completion_status: "cut_off",
    evidence_summary: "The song begins after the intro and cuts off.",
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    confidence: "high",
    assessability_notes: "",
  },
];

function canaryMatrix(): BriefAchievementMatrix {
  return normaliseBriefAchievementMatrix({
    matrix: {
      requirement_results: [
        {
          requirement_id: "req_one_file",
          observed_status: "not_assessable",
          completion_status: "uncertain",
          achievement_status: "partly_achieved",
          submission_impact: "final_check",
          fix_category: "final_check",
          recommended_action:
            "Export/upload one final checked file if the brief requires one file.",
          evidence_summary: "Final upload state cannot be confirmed from media alone.",
        },
      ],
    },
    briefRequirements: canaryRequirements,
    componentVerifications: [
      verification(
        "req_side_1",
        "Side 1 acting scene",
        "absent",
        "not_applicable",
        "No acting scene is observed before the song or before the media ends.",
      ),
      verification(
        "req_song",
        "Contemporary legit MT song",
        "partially_present",
        "cut_off",
        "The performer is heard singing, but the song cuts off before completion.",
      ),
      verification(
        "req_package",
        "One continuous video containing the full package",
        "partially_present",
        "incomplete",
        "The clip may be continuous, but the required package is incomplete.",
      ),
      verification(
        "req_landscape",
        "Landscape head-and-shoulders framing",
        "present",
        "complete",
        "The frame is stable and assessable.",
      ),
    ],
    observedTapeSequence: canarySequence,
  });
}

const canaryReadiness: ReadinessAndScoreJudgement = {
  decision: "retake_required_if_possible",
  headline: "Retake required if possible.",
  rationale: ["The required Side 1 acting scene is missing."],
  confidence: "high",
  performance_quality_score: 88,
  brief_completion_score: 42,
  overall_submission_readiness_score: 54,
  score_band_label: "retake_required_if_possible",
  score_explanation: "The package is incomplete even if the observed song has strengths.",
  brief_blocker_override: true,
  performance_quality_summary: "Observed song quality may contain strengths.",
  brief_completion_summary: "Side 1 is missing and song completion is not confirmed.",
  technical_assessability_summary: "Audio and framing are assessable.",
  selected_level_calibration_summary: "Professional.",
  professional_nuance_summary:
    "Strong observed material cannot override missing required material.",
  category_scores: [],
  category_rationale: {},
  component_scores: [],
  component_score_notes: [],
  score_contradiction_warnings: [],
  repair_prompt_status: "not_needed",
};

describe("S10.6 fix hierarchy and next-action plan", () => {
  it("makes missing Side 1 the Canary A fix-first and projects a finite action plan", () => {
    const matrix = canaryMatrix();
    const rawReport = {
      fix_first: "Correct the file naming convention.",
      improvements: ["Improve diction.", "Add more character detail."],
      next_take_plan: {
        steps: ["Retake option: if recording again, use one pass to strengthen blocked..."],
      },
      coaching_drills: ["Practice the acting scene beats that the legacy report assumed existed."],
    };
    const report: Record<string, unknown> = {
      raw_report: rawReport,
      fix_first: "Correct the file naming convention.",
      improvements: ["Blocked: a major casting brief instruction wasn't followed."],
      coaching_drills: ["Keep refining the take."],
      s10_fix_hierarchy: {
        fix_first: fixItem({
          id: "bad_file_name",
          title: "Correct the file naming convention",
          exact_action: "Correct the file naming convention.",
          source_category: "admin_process",
          urgency: "low",
          submission_impact: "final_check",
        }),
        priority_fixes: [
          fixItem({
            id: "bad_polish",
            title: "Improve diction",
            exact_action: "Improve diction.",
            source_category: "polish",
            urgency: "medium",
            submission_impact: "optional_polish",
          }),
        ],
        must_fix_before_submitting: [],
        should_improve_if_retaking: [],
        optional_polish: [],
        preserve: [
          fixItem({
            id: "preserve_audio",
            title: "Preserve assessable audio",
            exact_action: "Keep the audio setup if it remains clear in the final checked file.",
            source_category: "technical",
            urgency: "low",
            submission_impact: "supports_submission",
          }),
        ],
        do_not_overfix: [
          fixItem({
            id: "dont_chase_audio",
            title: "Do not chase audio changes",
            exact_action:
              "Do not chase audio changes if playback confirms the audio stays assessable.",
            source_category: "technical",
            urgency: "low",
            submission_impact: "supports_submission",
          }),
        ],
        action_contradiction_warnings: [],
      },
      s10_next_action_plan: {
        retake_plan: [],
        submit_checklist: [],
        final_checks: [],
        playback_checks: [],
        do_not_overfix: [],
        if_time_is_short_guidance: [],
        no_retake_needed_reason: null,
        confidence: "medium",
      },
    };

    const rawSnapshot = JSON.stringify(rawReport);
    const result = applyS10FixHierarchyNextAction({
      report,
      matrix,
      readiness: canaryReadiness,
    });

    expect(result.hierarchy.fix_first?.exact_action).toContain("Side 1 acting scene");
    expect(report.fix_first).toContain("Side 1 acting scene");
    expect(report.fix_first).not.toContain("file naming");
    expect(result.hierarchy.must_fix_before_submitting.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Side 1"),
        expect.stringContaining("song"),
        expect.stringContaining("package"),
      ]),
    );
    expect(result.nextActionPlan.retake_plan.join(" ")).toContain("Side 1");
    expect(result.nextActionPlan.retake_plan.join(" ")).toContain("song");
    expect(result.nextActionPlan.final_checks.join(" ")).not.toContain("final file");
    expect(result.nextActionPlan.playback_checks.join(" ")).toContain("cut off");
    const performerFacingProjection = JSON.stringify({
      fix_first: report.fix_first,
      improvements: report.improvements,
      coaching_drills: report.coaching_drills,
      next_take_plan: report.next_take_plan,
      priority_fixes: report.priority_fixes,
    });
    expect(performerFacingProjection).not.toContain("Blocked: a major casting brief instruction");
    expect(performerFacingProjection).not.toContain("strengthen blocked");
    expect(performerFacingProjection).not.toContain("No single public-safe priority fix");
    expect((report.coaching_drills as string[]).join(" ")).not.toContain("legacy report assumed");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.every((warning) => warning.internal_only)).toBe(true);
    expect(JSON.stringify(rawReport)).toBe(rawSnapshot);
  });

  it("keeps a strong complete take on submit-checklist actions instead of inventing must-fixes", () => {
    const requirements = [
      requirement("req_scene", "Full acting scene", "material"),
      requirement("req_song", "Complete MT song", "material"),
      requirement("req_file", "One final upload file", "admin_process"),
    ];
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        overall_status: "achieved",
        mandatory_status: "clear",
        readiness_impact: "supports_submission",
      },
      briefRequirements: requirements,
      componentVerifications: [
        verification("req_scene", "Full acting scene", "present", "complete", "Scene is present."),
        verification("req_song", "Complete MT song", "present", "complete", "Song is complete."),
      ],
      observedTapeSequence: [],
    });
    const readiness: ReadinessAndScoreJudgement = {
      ...canaryReadiness,
      decision: "submit",
      overall_submission_readiness_score: 91,
      score_band_label: "submit_strong_submission",
      brief_blocker_override: false,
      rationale: ["Mandatory material is achieved."],
    };
    const report: Record<string, unknown> = {
      s10_fix_hierarchy: {
        fix_first: null,
        priority_fixes: [],
        must_fix_before_submitting: [],
        should_improve_if_retaking: [],
        optional_polish: [
          fixItem({
            id: "optional_polish",
            title: "Optional style polish",
            exact_action: "Only retake if you want to refine one concrete optional style point.",
            urgency: "optional",
            submission_impact: "optional_polish",
          }),
        ],
        preserve: [
          fixItem({
            id: "preserve_package",
            title: "Preserve achieved package",
            exact_action:
              "Do not rework the achieved package unless addressing a concrete optional point.",
            source_category: "brief",
            submission_impact: "supports_submission",
          }),
        ],
        do_not_overfix: [
          fixItem({
            id: "dont_retake_loop",
            title: "Avoid an unnecessary retake loop",
            exact_action:
              "Do not retake unless you are addressing one specific optional polish point.",
            submission_impact: "supports_submission",
          }),
        ],
        action_contradiction_warnings: [],
      },
      s10_next_action_plan: {
        submit_checklist: [],
        retake_plan: [],
        final_checks: [],
        playback_checks: [],
        do_not_overfix: [],
        if_time_is_short_guidance: [],
        no_retake_needed_reason: "Mandatory material is achieved.",
        confidence: "high",
      },
    };

    const result = applyS10FixHierarchyNextAction({ report, matrix, readiness });

    expect(result.hierarchy.must_fix_before_submitting).toEqual([]);
    expect(result.hierarchy.fix_first).toBeNull();
    expect(report.fix_first).toBe("No mandatory fix before submission.");
    expect(result.nextActionPlan.submit_checklist).toEqual([]);
    expect(result.nextActionPlan.no_retake_needed_reason).toBe("Mandatory material is achieved.");
    expect(result.nextActionPlan.retake_plan).toEqual([]);
    expect(result.hierarchy.optional_polish).toHaveLength(1);
    expect(result.hierarchy.preserve[0]?.exact_action).toContain("Do not rework");
    expect(result.hierarchy.do_not_overfix[0]?.exact_action).toContain("Do not retake");
  });

  it("turns missing S10.6 AI output into a specific limitation instead of generic filler", () => {
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        overall_status: "mostly_achieved",
        mandatory_status: "clear",
        readiness_impact: "review_carefully",
      },
      briefRequirements: [requirement("req_scene", "Full acting scene", "material")],
      componentVerifications: [
        verification("req_scene", "Full acting scene", "present", "complete", "Scene is present."),
      ],
      observedTapeSequence: [],
    });
    const readiness: ReadinessAndScoreJudgement = {
      ...canaryReadiness,
      decision: "review_carefully",
      brief_blocker_override: false,
      rationale: ["Review carefully."],
    };
    const report: Record<string, unknown> = {};

    const result = applyS10FixHierarchyNextAction({ report, matrix, readiness });

    expect(result.hierarchy.fix_first).toBeNull();
    expect(result.nextActionPlan.submit_checklist).toEqual([]);
    expect(result.nextActionPlan.final_checks).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("Keep refining the take");
    expect(JSON.stringify(report)).not.toContain("Retry the analysis");
    expect(result.warnings.every((warning) => warning.internal_only)).toBe(true);
  });
});
