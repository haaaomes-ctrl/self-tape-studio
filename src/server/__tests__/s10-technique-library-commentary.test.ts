import { describe, expect, it } from "vitest";
import type {
  BriefAchievementMatrix,
  BriefRequirement,
  ReadinessAndScoreJudgement,
  S10FixHierarchy,
  S10NextActionPlan,
  S10ProfessionalCritique,
  S10TechniqueCommentary,
  S10TechniqueObservation,
} from "@/lib/audition-rules";
import type { ComponentVerification, MediaObservationSummary } from "@/server/evidence-pass.server";
import { normaliseBriefAchievementMatrix } from "@/server/s10-brief-achievement-matrix.server";
import {
  applyS10TechniqueLibraryCommentary,
  normaliseS10TechniqueCommentary,
  scrubS10TechniqueCommentaryProjection,
} from "@/server/s10-technique-library-commentary.server";

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
    report_destination: "s10_technique_commentary",
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

function observation(overrides: Partial<S10TechniqueObservation>): S10TechniqueObservation {
  return {
    id: "obs",
    technique_area: "self_tape_presentation",
    title: "Verified technique note",
    detail: "A concrete technique note supported by verified media evidence.",
    evidence_summary: "Verified from component evidence.",
    linked_requirement_ids: [],
    linked_component_verification_ids: [],
    linked_matrix_result_ids: [],
    linked_readiness_reason_ids: [],
    linked_strength_ids: [],
    linked_fix_ids: [],
    linked_timestamp_refs: [],
    component_status: "present",
    applies_to_observed_portion_only: false,
    confidence: "high",
    is_named_authority_claim: false,
    is_medical_or_health_claim: false,
    is_body_or_appearance_claim: false,
    is_casting_outcome_claim: false,
    is_generic_fallback: false,
    ...overrides,
  };
}

function section(
  observations: S10TechniqueObservation[] = [],
  overrides: Partial<S10TechniqueCommentary["acting"]> = {},
): S10TechniqueCommentary["acting"] {
  return {
    status: observations.length > 0 ? "assessable" : "not_assessable",
    headline: observations[0]?.title ?? "Technique not assessable.",
    observations,
    what_is_working: observations[0] ? [observations[0].detail] : [],
    what_could_improve: [],
    practical_actions: observations[0] ? ["Use the verified note as optional polish."] : [],
    preserve: [],
    not_assessable_reason: observations[0] ? null : "No verified evidence.",
    confidence: observations[0] ? "high" : "low",
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

function canaryVerifications(): ComponentVerification[] {
  return [
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
  ];
}

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
    componentVerifications: canaryVerifications(),
    observedTapeSequence: [],
  });
}

function strongCompleteMatrix(): BriefAchievementMatrix {
  const requirements = [
    requirement("req_side_1", "Side 1 acting scene", "material"),
    requirement("req_song", "Contemporary legit MT song", "material"),
    requirement("req_package", "One continuous video containing the full MT package", "technical"),
  ];
  const verifications = [
    verification(
      "req_side_1",
      "Side 1 acting scene",
      "present",
      "complete",
      "The full acting scene is observed.",
    ),
    verification(
      "req_song",
      "Contemporary legit MT song",
      "present",
      "complete",
      "The full song is observed through the ending.",
    ),
    verification(
      "req_package",
      "One continuous video containing the full MT package",
      "present",
      "complete",
      "The package appears complete.",
    ),
  ];
  return normaliseBriefAchievementMatrix({
    matrix: {},
    briefRequirements: requirements,
    componentVerifications: verifications,
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

const strongReadiness: ReadinessAndScoreJudgement = {
  ...canaryReadiness,
  decision: "submit",
  headline: "Submit-ready.",
  rationale: ["Mandatory package is complete."],
  performance_quality_score: 93,
  brief_completion_score: 92,
  overall_submission_readiness_score: 91,
  score_band_label: "submit_strong_submission",
  score_explanation: "The package is complete and polished.",
  brief_blocker_override: false,
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

const professionalCritique: S10ProfessionalCritique = {
  summary: "S10 professional critique exists.",
  performance_strengths: [],
  brief_package_strengths: [],
  technical_presentation_strengths: [],
  vocal_or_singing_strengths: [],
  acting_strengths: [],
  movement_or_physical_strengths: [],
  professional_presentation_notes: [],
  preserve: [],
  do_not_overfix: [],
  critique_limitations: [],
  contradiction_warnings: [],
};

const mediaSummary: MediaObservationSummary = {
  audio_assessable: true,
  video_assessable: true,
  framing_assessable: true,
  continuity_assessable: true,
  abrupt_cutoff_detected: true,
  one_continuous_video_observed: false,
  duration_summary: "01:42",
  uncertainties: [],
};

describe("S10.8 technique-library commentary", () => {
  it("marks Canary A acting not assessable, keeps partial song observed-portion-only, and blocks legacy technique prose", () => {
    const report: Record<string, unknown> = {
      s10_technique_commentary: {
        summary: "Technique commentary.",
        acting: section([
          observation({
            id: "legacy_acting",
            technique_area: "acting",
            title: "Naturalistic acting with good pace",
            detail: "Naturalistic acting with good pace.",
            evidence_summary: "Legacy raw-report prose.",
            component_status: "absent",
          }),
        ]),
        vocal_singing: section([
          observation({
            id: "song_observed",
            technique_area: "vocal_singing",
            title: "Sustained vocal line",
            detail: "The heard phrase has a steady line.",
            evidence_summary: "The observed song portion is audible.",
            component_status: "partially_present",
            linked_component_verification_ids: ["req_song"],
          }),
        ]),
        movement_dance: section(),
        musical_theatre_package: section([
          observation({
            id: "bad_package",
            technique_area: "musical_theatre_package",
            title: "Complete package",
            detail: "Complete song package integration is secure.",
            evidence_summary: "Legacy prose.",
          }),
        ]),
        self_tape_presentation: section([
          observation({
            id: "presentation",
            technique_area: "self_tape_presentation",
            title: "Frame and audio read clearly",
            detail: "The verified media evidence supports readable framing and audio.",
            evidence_summary: "S10 media observation marks audio and framing assessable.",
          }),
        ]),
        commercial_screen_task: section(),
        limitations: [],
        contradiction_warnings: [],
      },
      raw_report: {
        category_rationale: {
          acting: { what_works: "Naturalistic acting with good pace." },
        },
        detected_components: [{ type: "acting_scene" }],
        coaching_drills: ["Work the legacy acting beats."],
      },
      technique_observation_trace: [
        {
          source_family: "legacy_adapter",
          evidence_status: "missing_evidence",
          summary: "Naturalistic acting with good pace",
        },
      ],
      public_technique_authority_status: "blocked",
      public_technique_authority_blocked: true,
    };

    const result = applyS10TechniqueLibraryCommentary({
      report,
      matrix: canaryMatrix(),
      readiness: canaryReadiness,
      fixHierarchy: canaryFixHierarchy,
      nextActionPlan: emptyPlan,
      professionalCritique,
      componentVerifications: canaryVerifications(),
      mediaObservationSummary: mediaSummary,
    });

    expect(result.commentary.acting.status).toBe("not_assessable");
    expect(result.commentary.acting.status).not.toBe("not_applicable");
    expect(JSON.stringify(result.commentary)).not.toContain("Naturalistic acting with good pace");
    expect(result.commentary.vocal_singing.status).toBe("partially_assessable");
    expect(result.commentary.vocal_singing.observations).toEqual(
      expect.arrayContaining([expect.objectContaining({ applies_to_observed_portion_only: true })]),
    );
    expect(JSON.stringify(result.commentary.vocal_singing)).toContain("Observed portion only");
    expect(JSON.stringify(result.commentary)).not.toMatch(/complete song package/i);
    expect(result.commentary.musical_theatre_package.headline).toMatch(/incomplete/i);
    expect(result.commentary.movement_dance.status).toBe("not_applicable");
    expect(result.commentary.self_tape_presentation.observations.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.commentary)).not.toMatch(/healthy voice|bookable|castable/i);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affected_field: "technique_observation_trace",
          source: "legacy_technique_trace",
          internal_only: true,
        }),
        expect.objectContaining({
          affected_field: "public_technique_authority_status",
          source: "public_technique_authority_gate",
          internal_only: true,
        }),
      ]),
    );
  });

  it("does not use public technique-authority blocked state to suppress valid authenticated commentary", () => {
    const report: Record<string, unknown> = {
      public_technique_authority_status: "blocked",
      public_technique_authority_blocked: true,
      s10_technique_commentary: {
        summary: "Useful technique commentary.",
        acting: section([
          observation({
            id: "acting",
            technique_area: "acting",
            title: "Playable objective changes",
            detail: "The scene has clear objective turns in the verified acting section.",
            evidence_summary: "S10 verification confirms the acting scene is present.",
          }),
        ]),
        vocal_singing: section(),
        movement_dance: section(),
        musical_theatre_package: section(),
        self_tape_presentation: section([
          observation({
            id: "presentation",
            technique_area: "self_tape_presentation",
            title: "Camera readability",
            detail: "The frame supports a readable self-tape.",
            evidence_summary: "Verified media evidence.",
          }),
        ]),
        commercial_screen_task: section(),
        limitations: [],
        contradiction_warnings: [],
      },
    };

    const result = applyS10TechniqueLibraryCommentary({
      report,
      matrix: strongCompleteMatrix(),
      readiness: strongReadiness,
      fixHierarchy: { ...canaryFixHierarchy, must_fix_before_submitting: [] },
      nextActionPlan: { ...emptyPlan, retake_plan: [], submit_checklist: ["Submit checklist."] },
      professionalCritique,
      componentVerifications: [
        verification(
          "req_side_1",
          "Side 1 acting scene",
          "present",
          "complete",
          "The full acting scene is observed.",
        ),
      ],
      mediaObservationSummary: mediaSummary,
    });

    expect(result.commentary.acting.status).toBe("assessable");
    expect(result.commentary.acting.observations[0]?.title).toContain("Playable objective");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "public_technique_authority_gate",
          corrected_value: "ignored_for_authenticated_s10_technique_commentary",
        }),
      ]),
    );
  });

  it("requires useful technique value for strong complete fixtures", () => {
    const commentary = normaliseS10TechniqueCommentary({
      commentary: {
        summary: "Technique is specific.",
        acting: section([
          observation({
            id: "acting",
            technique_area: "acting",
            title: "Objective turn",
            detail: "The verified scene shows a clear objective shift.",
            evidence_summary: "Acting scene verified complete.",
          }),
        ]),
        vocal_singing: section([
          observation({
            id: "song",
            technique_area: "vocal_singing",
            title: "Phrase shape",
            detail: "The full song has a clear phrase shape.",
            evidence_summary: "Song verified complete.",
          }),
        ]),
        movement_dance: section(),
        musical_theatre_package: section([
          observation({
            id: "mt",
            technique_area: "musical_theatre_package",
            title: "Integrated package",
            detail: "The acting scene and song sit in one coherent MT package.",
            evidence_summary: "Both required components are verified complete.",
          }),
        ]),
        self_tape_presentation: section([
          observation({
            id: "self_tape",
            technique_area: "self_tape_presentation",
            title: "Readable frame",
            detail: "The frame keeps the performance readable.",
            evidence_summary: "Audio and framing are assessable.",
          }),
        ]),
        commercial_screen_task: section(),
        limitations: [],
      },
      matrix: strongCompleteMatrix(),
      readiness: strongReadiness,
      fixHierarchy: { ...canaryFixHierarchy, must_fix_before_submitting: [] },
      nextActionPlan: { ...emptyPlan, retake_plan: [], submit_checklist: ["Submit checklist."] },
      professionalCritique,
      componentVerifications: [
        verification("req_side_1", "Side 1 acting scene", "present", "complete", "Verified."),
        verification("req_song", "Contemporary legit MT song", "present", "complete", "Verified."),
      ],
      mediaObservationSummary: mediaSummary,
    });

    expect(commentary.acting.observations.length).toBeGreaterThan(0);
    expect(commentary.vocal_singing.observations.length).toBeGreaterThan(0);
    expect(commentary.musical_theatre_package.observations.length).toBeGreaterThan(0);
    expect(commentary.self_tape_presentation.observations.length).toBeGreaterThan(0);
    expect(
      [
        ...commentary.acting.practical_actions,
        ...commentary.vocal_singing.practical_actions,
        ...commentary.musical_theatre_package.practical_actions,
        ...commentary.self_tape_presentation.practical_actions,
      ].length,
    ).toBeGreaterThan(0);
    expect(JSON.stringify(commentary)).not.toMatch(/forced retake|invented blocker/i);
  });

  it("scrubs unsafe projected technique prose from compatibility fields", () => {
    const report: Record<string, unknown> = {
      category_notes: { acting: "Naturalistic acting with good pace" },
      category_rationale: { vocal: { what_works: "Bookable professional technique." } },
      coaching_drills: ["Continue refining your technique"],
      improvements: ["Healthy voice and excellent technique."],
    };

    const scrub = scrubS10TechniqueCommentaryProjection(report);

    expect(scrub.removed).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toMatch(
      /Naturalistic acting with good pace|Bookable|Healthy voice|Continue refining/i,
    );
  });
});
