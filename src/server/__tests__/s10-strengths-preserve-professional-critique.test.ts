import { describe, expect, it } from "vitest";
import type {
  BriefAchievementMatrix,
  BriefRequirement,
  ReadinessAndScoreJudgement,
  S10FixHierarchy,
  S10NextActionPlan,
  S10PreserveItem,
  S10StrengthItem,
} from "@/lib/audition-rules";
import type { ComponentVerification } from "@/server/evidence-pass.server";
import { normaliseBriefAchievementMatrix } from "@/server/s10-brief-achievement-matrix.server";
import {
  applyS10ProfessionalCritique,
  scrubS10ProfessionalCritiqueProjection,
} from "@/server/s10-strengths-preserve-professional-critique.server";

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
    report_destination: "s10_professional_critique",
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

function strength(overrides: Partial<S10StrengthItem>): S10StrengthItem {
  return {
    id: "strength",
    title: "Specific strength",
    detail: "A specific verified strength.",
    why_it_matters: "It gives the performer something concrete to preserve.",
    evidence_summary: "Verified from observed media.",
    source_category: "performance",
    linked_requirement_ids: [],
    linked_component_verification_ids: [],
    linked_matrix_result_ids: [],
    linked_readiness_reason_ids: [],
    linked_fix_ids: [],
    confidence: "high",
    is_component_verified: true,
    component_status: "present",
    applies_to_observed_portion_only: false,
    is_generic_fallback: false,
    ...overrides,
  };
}

function preserve(overrides: Partial<S10PreserveItem>): S10PreserveItem {
  return {
    id: "preserve",
    title: "Preserve specific choice",
    detail: "Keep the specific verified choice.",
    evidence_summary: "Verified from observed media.",
    why_to_preserve: "It supports the take without causing a retake loop.",
    linked_component_verification_ids: [],
    confidence: "high",
    is_generic_fallback: false,
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
          recommended_action: "Export/upload one final checked file.",
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
        "The clip may be continuous, but required material is incomplete.",
      ),
      verification(
        "req_landscape",
        "Landscape head-and-shoulders framing",
        "present",
        "complete",
        "The frame is stable and assessable.",
      ),
    ],
    observedTapeSequence: [],
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

const canaryFixHierarchy: S10FixHierarchy = {
  fix_first: null,
  priority_fixes: [],
  must_fix_before_submitting: [
    {
      id: "side_1",
      title: "Record/include Side 1",
      issue: "Side 1 is missing.",
      why_it_matters: "Mandatory material is missing.",
      exact_action: "Record/include the full required Side 1 acting scene.",
      source_category: "brief",
      urgency: "critical_gap",
      submission_impact: "submission_blocker",
      linked_requirement_ids: ["req_side_1"],
      linked_matrix_result_ids: ["req_side_1"],
      linked_component_verification_ids: ["req_side_1"],
      linked_readiness_reason_ids: [],
      evidence_summary: "Side 1 was not observed.",
      confidence: "high",
      is_fix_first_candidate: true,
      is_generic_fallback: false,
      source_authority: "s10_normalised",
      legacy_source_used: false,
      legacy_source_path: null,
    },
  ],
  should_improve_if_retaking: [],
  optional_polish: [],
  preserve: [],
  do_not_overfix: [],
  action_contradiction_warnings: [],
};

const emptyPlan: S10NextActionPlan = {
  submit_checklist: [],
  retake_plan: ["Record/include the full required Side 1 acting scene."],
  final_checks: ["Confirm the final file contains all required material."],
  playback_checks: ["Playback-check the final file from start to finish."],
  do_not_overfix: [],
  if_time_is_short_guidance: [],
  no_retake_needed_reason: null,
  confidence: "high",
};

describe("S10.7 strengths, preserve and professional critique", () => {
  it("blocks Canary A legacy acting/package praise while preserving supported observed positives", () => {
    const report: Record<string, unknown> = {
      raw_report: {
        strengths: [
          "The easy-going warmth and wit are very present.",
          "Correct material, orientation, and framing.",
          "Single-file submission as requested.",
        ],
        category_rationale: {
          acting: { what_works: "Naturalistic acting with good pace." },
        },
        detected_components: [{ type: "acting_scene" }, { type: "song" }],
        coaching_drills: ["Practice the acting beats the legacy report assumed were present."],
      },
      technique_observation_trace: [
        {
          source_artefact_id: "raw_report",
          source_family: "legacy_adapter",
          claim_text: "Strong contemporary legit vocal with clear storytelling.",
        },
      ],
      s10_professional_critique: {
        summary: "The visible strengths are limited by the incomplete package.",
        acting_strengths: [
          strength({
            id: "bad_acting",
            title: "Naturalistic acting with good pace",
            detail: "The acting scene feels warm and witty.",
            source_category: "acting",
            linked_requirement_ids: ["req_side_1"],
            component_status: "absent",
            is_component_verified: false,
          }),
        ],
        brief_package_strengths: [
          strength({
            id: "bad_package",
            title: "Correct material",
            detail: "Single-file submission as requested.",
            source_category: "package",
          }),
        ],
        vocal_or_singing_strengths: [
          strength({
            id: "observed_song",
            title: "Clear vocal focus",
            detail: "The sung section has clear audio and focused pitch in the heard section.",
            source_category: "vocal",
            linked_requirement_ids: ["req_song"],
            linked_component_verification_ids: ["req_song"],
            component_status: "partially_present",
          }),
        ],
        technical_presentation_strengths: [
          strength({
            id: "assessable_audio",
            title: "Assessable audio",
            detail: "The audio is clear enough to judge the observed portion.",
            source_category: "technical",
          }),
        ],
        performance_strengths: [],
        movement_or_physical_strengths: [],
        professional_presentation_notes: [],
        preserve: [
          preserve({
            id: "preserve_audio",
            title: "Preserve the audio setup",
            detail: "Keep the audio setup if playback confirms it remains assessable.",
          }),
        ],
        do_not_overfix: [
          preserve({
            id: "dont_chase_audio",
            title: "Do not chase audio changes first",
            detail: "Prioritise recording the missing Side 1 before changing assessable audio.",
          }),
        ],
        critique_limitations: [],
        contradiction_warnings: [],
      },
    };
    const rawSnapshot = JSON.stringify(report.raw_report);

    const result = applyS10ProfessionalCritique({
      report,
      matrix: canaryMatrix(),
      readiness: canaryReadiness,
      fixHierarchy: canaryFixHierarchy,
      nextActionPlan: emptyPlan,
      mediaObservationSummary: {
        audio_assessable: true,
        video_assessable: true,
        framing_assessable: true,
        continuity_assessable: true,
        abrupt_cutoff_detected: true,
        one_continuous_video_observed: true,
        duration_summary: "About 01:42.",
        uncertainties: [],
      },
    });

    const projected = JSON.stringify({
      strengths: report.strengths,
      category_notes: report.category_notes,
      category_rationale: report.category_rationale,
      presentation_notes: report.presentation_notes,
      s10_professional_critique: report.s10_professional_critique,
    });
    expect(projected).not.toContain("Naturalistic acting");
    expect(projected).not.toContain("Correct material");
    expect(projected).not.toContain("Single-file submission as requested");
    expect(projected).toContain("Observed portion only");
    expect(projected).toContain("Assessable audio");
    expect(projected).toContain("acting-scene strengths cannot be assessed");
    expect(projected).toContain("missing Side 1");
    expect(result.critique.vocal_or_singing_strengths[0]?.applies_to_observed_portion_only).toBe(
      true,
    );
    expect(result.warnings.some((warning) => warning.source === "legacy_technique_trace")).toBe(
      true,
    );
    expect(result.warnings.every((warning) => warning.internal_only)).toBe(true);
    expect(JSON.stringify(report.raw_report)).toBe(rawSnapshot);
  });

  it("keeps strong complete reports specific instead of collapsing to a generic positive shell", () => {
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        overall_status: "achieved",
        mandatory_status: "clear",
        readiness_impact: "supports_submission",
      },
      briefRequirements: [
        requirement("req_scene", "Full acting scene", "material"),
        requirement("req_song", "Complete MT song", "material"),
      ],
      componentVerifications: [
        verification("req_scene", "Full acting scene", "present", "complete", "Scene is present."),
        verification("req_song", "Complete MT song", "present", "complete", "Song is complete."),
      ],
      observedTapeSequence: [],
    });
    const readiness: ReadinessAndScoreJudgement = {
      ...canaryReadiness,
      decision: "submit",
      brief_blocker_override: false,
      overall_submission_readiness_score: 92,
      score_band_label: "submit_strong_submission",
      rationale: ["The required package is complete."],
      professional_nuance_summary:
        "The score reflects brief precision, camera readability and performance specificity.",
    };
    const report: Record<string, unknown> = {
      s10_professional_critique: {
        summary: "Complete package with specific strengths.",
        performance_strengths: [
          strength({
            id: "perf",
            title: "Clear objective shifts",
            detail: "The scene tracks clear thought changes through the observed beat.",
            source_category: "performance",
            linked_requirement_ids: ["req_scene"],
            linked_component_verification_ids: ["req_scene"],
          }),
        ],
        brief_package_strengths: [
          strength({
            id: "package",
            title: "Complete package",
            detail: "The required scene and song are both present and complete.",
            source_category: "package",
            linked_requirement_ids: ["req_scene", "req_song"],
          }),
        ],
        technical_presentation_strengths: [],
        vocal_or_singing_strengths: [],
        acting_strengths: [],
        movement_or_physical_strengths: [],
        professional_presentation_notes: [],
        preserve: [
          preserve({
            id: "preserve_package",
            title: "Preserve the complete package flow",
            detail: "Keep the scene-to-song order and final playback check.",
          }),
        ],
        do_not_overfix: [
          preserve({
            id: "dont_retake_loop",
            title: "Avoid unnecessary retakes",
            detail: "Do not retake unless addressing one specific optional polish point.",
          }),
        ],
        critique_limitations: [],
        contradiction_warnings: [],
      },
    };

    const result = applyS10ProfessionalCritique({
      report,
      matrix,
      readiness,
      fixHierarchy: { ...canaryFixHierarchy, must_fix_before_submitting: [] },
      nextActionPlan: { ...emptyPlan, retake_plan: [], no_retake_needed_reason: "Ready." },
    });

    expect((report.strengths as string[]).join(" ")).toContain("Clear objective shifts");
    expect(JSON.stringify(report.next_take_plan)).toContain("Preserve");
    expect(JSON.stringify(report.next_take_plan)).toContain("Avoid unnecessary retakes");
    expect(result.critique.critique_limitations).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("This affects readability, not talent");
  });

  it("turns missing S10.7 AI output into a specific limitation and scrubs final generic projections", () => {
    const report: Record<string, unknown> = {
      category_notes: { professional_presentation: "This affects readability, not talent." },
      strengths: ["Preserve the clearest choices already captured."],
      s10_professional_critique: {},
    };

    const result = applyS10ProfessionalCritique({
      report,
      matrix: canaryMatrix(),
      readiness: canaryReadiness,
      fixHierarchy: canaryFixHierarchy,
      nextActionPlan: emptyPlan,
    });
    report.category_notes = { professional_presentation: "This affects readability, not talent." };
    const scrubbed = scrubS10ProfessionalCritiqueProjection(report);

    expect(result.critique.critique_limitations.join(" ")).toContain(
      "Side 1 acting scene was not identified",
    );
    expect(JSON.stringify(report)).not.toContain("This affects readability, not talent");
    expect(JSON.stringify(report)).not.toContain("Preserve the clearest choices");
    expect(scrubbed.removed).toBeGreaterThanOrEqual(0);
  });
});
