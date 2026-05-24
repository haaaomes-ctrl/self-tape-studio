import { describe, expect, it } from "vitest";
import {
  buildV2Report,
  hasS10AuthoritativeModules,
  validateV2PublicBoundary,
} from "@/server/v2-report-builder.server";

const canaryRequirements = [
  {
    id: "req-side-1",
    brief_text: "Please prepare Side 1.",
    summary: "Required Side 1 acting scene",
    category: "material",
    importance: "mandatory",
    expected_evidence_in_tape: "Side 1 acting scene is visible/audible.",
    achievement_test: "Tape contains the full Side 1 acting scene.",
    submission_impact_if_missing: "Submission package is incomplete.",
    report_destination: "brief_achievement",
    confidence: "high",
  },
  {
    id: "req-song",
    brief_text: "Include a contemporary legit MT song.",
    summary: "Contemporary legit MT song",
    category: "material",
    importance: "mandatory",
    expected_evidence_in_tape: "Song is present and runs through.",
    achievement_test: "Tape contains complete song.",
    submission_impact_if_missing: "Material package is incomplete.",
    report_destination: "brief_achievement",
    confidence: "high",
  },
] as const;

function canaryS10Report() {
  return {
    audition_type: "musical_theatre",
    overall_score: 93,
    overall_score_final: 42,
    headline: "Strong for this level",
    verdict: "Strong for this level",
    casting_insight: "well aligned with the supplied brief",
    scores: {
      technical: 82,
      audio: 86,
      vocal: 72,
      acting: 0,
      brief_adherence: 25,
      professional_presentation: 58,
    },
    detected_components: [
      { type: "acting_scene", score: 92, note: "Naturalistic acting with good pace" },
      { type: "song", score: 90, note: "Strong contemporary legit vocal with clear storytelling" },
    ],
    strengths: [
      { point: "Correct material, orientation, and framing" },
      { point: "Single-file submission as requested" },
    ],
    fix_first: "Correct the file naming convention",
    timestamped_notes: [
      { timestamp: "00:05", note: "Strong start to the scene" },
      { timestamp: "00:25", note: "Good use of eyeline" },
    ],
    brief_achievement_matrix: {
      overall_status: "not_achieved",
      mandatory_status: "blocked",
      readiness_impact: "submission_blocker",
      summary: "The required Side 1 was not observed and the song/package is incomplete.",
      achieved_requirements: [],
      missing_or_incomplete_requirements: ["Required Side 1 acting scene", "Song completion"],
      not_assessable_requirements: [],
      final_check_requirements: ["One final checked file"],
      requirement_results: [
        {
          requirement_id: "req-side-1",
          requirement_summary: "Required Side 1 acting scene",
          category: "material",
          importance: "mandatory",
          observed_status: "absent",
          completion_status: "incomplete",
          achievement_status: "not_achieved",
          evidence_summary: "No Side 1 acting scene was identified in the submitted tape.",
          submission_impact: "submission_blocker",
          fix_category: "must_fix",
          recommended_action: "Record and include the full required Side 1 acting scene.",
          confidence: "high",
          linked_observed_sequence_ids: [],
          linked_component_verification_ids: ["cv-side-1"],
          cannot_infer_from_brief_only: true,
        },
        {
          requirement_id: "req-song",
          requirement_summary: "Contemporary legit MT song",
          category: "material",
          importance: "mandatory",
          observed_status: "partially_present",
          completion_status: "cut_off",
          achievement_status: "partly_achieved",
          evidence_summary:
            "Only the observed song portion is available; completion is not confirmed.",
          submission_impact: "material_gap",
          fix_category: "must_fix",
          recommended_action: "Confirm the song runs through to the end in the final take.",
          confidence: "medium",
          linked_observed_sequence_ids: ["seq-song"],
          linked_component_verification_ids: ["cv-song"],
          cannot_infer_from_brief_only: true,
        },
      ],
    },
    readiness_score_judgement: {
      decision: "retake_required_if_possible",
      headline: "Retake required if possible: the required Side 1 is missing.",
      rationale: [
        "The mandatory Side 1 acting scene was not observed.",
        "The song/package is incomplete, so visible strengths do not make the submission ready.",
      ],
      confidence: "high",
      performance_quality_score: 78,
      brief_completion_score: 25,
      overall_submission_readiness_score: 42,
      score_band_label: "retake_required_if_possible",
      score_explanation:
        "The score reflects submission readiness, not talent: missing Side 1 blocks the package.",
      brief_blocker_override: true,
      performance_quality_summary: "Some observed song work may be useful.",
      brief_completion_summary: "Mandatory material is missing.",
      technical_assessability_summary: "Audio is assessable.",
      selected_level_calibration_summary: "Professional package must include required material.",
      professional_nuance_summary: "Prioritise package completion before polish.",
      category_scores: [
        {
          category_id: "brief_adherence",
          score: 25,
          score_basis: "Required Side 1 is missing.",
          what_works: "",
          why_not_full_score: "Mandatory material is incomplete.",
          close_gap: "Record Side 1 and complete the song/package.",
          confidence: "high",
          blocked_or_not_assessable_reason: null,
        },
        {
          category_id: "audio",
          score: 86,
          score_basis: "Audio is assessable.",
          what_works: "The observed audio is clear enough.",
          why_not_full_score: "",
          close_gap: "",
          confidence: "high",
          blocked_or_not_assessable_reason: null,
        },
      ],
      category_rationale: {},
      component_scores: [
        {
          component_type: "acting_scene",
          linked_requirement_ids: ["req-side-1"],
          observed_status: "absent",
          completion_status: "incomplete",
          score: null,
          score_basis: "Required Side 1 was not observed.",
          confidence: "high",
          cannot_score_reason:
            "Acting scene is not assessable because the required Side 1 is absent.",
        },
      ],
      component_score_notes: [],
      score_contradiction_warnings: [
        {
          affected_field: "overall_score",
          original_value: 93,
          capped_value: 42,
          matrix_reason: "Mandatory Side 1 missing.",
          source: "legacy_raw_report",
        },
      ],
      repair_prompt_status: "classified_contradictory",
    },
    s10_fix_hierarchy: {
      fix_first: {
        id: "fix-side-1",
        title: "Record/include the full required Side 1 acting scene.",
        issue: "Side 1 missing",
        why_it_matters: "It is mandatory material.",
        exact_action: "Record the full Side 1 and include it in the final continuous video.",
        source_category: "brief",
        urgency: "critical_gap",
        submission_impact: "submission_blocker",
        linked_requirement_ids: ["req-side-1"],
        linked_matrix_result_ids: ["req-side-1"],
        linked_component_verification_ids: ["cv-side-1"],
        linked_readiness_reason_ids: [],
        evidence_summary: "Side 1 was not observed.",
        confidence: "high",
        is_fix_first_candidate: true,
        is_generic_fallback: false,
        source_authority: "s10_ai_authored",
        legacy_source_used: false,
      },
      priority_fixes: [],
      must_fix_before_submitting: [],
      should_improve_if_retaking: [],
      optional_polish: [],
      preserve: [],
      do_not_overfix: [],
      action_contradiction_warnings: [],
    },
    s10_next_action_plan: {
      submit_checklist: [],
      retake_plan: ["Record the full required Side 1 acting scene."],
      final_checks: ["Export one final file containing Side 1 and song."],
      playback_checks: ["Playback-check the end of the song for cut-off before upload."],
      do_not_overfix: ["Do not chase audio changes before fixing the missing material."],
      if_time_is_short_guidance: [],
      no_retake_needed_reason: null,
      confidence: "high",
    },
    s10_professional_critique: {
      summary: "There may be useful observed song/audio evidence, but the package is incomplete.",
      performance_strengths: [],
      brief_package_strengths: [],
      technical_presentation_strengths: [
        {
          id: "strength-audio",
          title: "Audio is assessable.",
          detail: "Keep the current clarity while retaking the missing material.",
          why_it_matters: "It lets the panel hear the observed portion.",
          evidence_summary: "Audio assessability was supported.",
          source_category: "technical",
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
        },
      ],
      vocal_or_singing_strengths: [],
      acting_strengths: [],
      movement_or_physical_strengths: [],
      professional_presentation_notes: [],
      preserve: [],
      do_not_overfix: [],
      critique_limitations: ["Acting-scene strengths cannot be assessed because Side 1 is absent."],
      contradiction_warnings: [],
    },
    s10_technique_commentary: {
      summary: "Technique notes are limited by the missing required Side 1.",
      acting: {
        status: "not_assessable",
        headline: "Acting scene not assessable because required Side 1 is missing.",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: ["Record the required Side 1 before judging acting technique."],
        preserve: [],
        not_assessable_reason: "The required Side 1 was not identified in the tape.",
        confidence: "high",
      },
      vocal_singing: {
        status: "partially_assessable",
        headline: "Song technique can only be considered for the observed portion.",
        observations: [],
        what_is_working: ["Observed song portion is assessable."],
        what_could_improve: [],
        practical_actions: ["Confirm the song runs through to the end."],
        preserve: [],
        not_assessable_reason: null,
        confidence: "medium",
      },
      movement_dance: {
        status: "not_applicable",
        headline: "Movement/dance was not required or visible.",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        not_assessable_reason: null,
        confidence: "medium",
      },
      musical_theatre_package: {
        status: "partially_assessable",
        headline: "The MT package is incomplete because Side 1 is missing.",
        observations: [],
        what_is_working: [],
        what_could_improve: [],
        practical_actions: ["Complete Side 1 plus song in the final package."],
        preserve: [],
        not_assessable_reason: null,
        confidence: "high",
      },
      self_tape_presentation: {
        status: "assessable",
        headline: "Audio/framing can be kept while fixing material.",
        observations: [],
        what_is_working: ["Audio is assessable."],
        what_could_improve: [],
        practical_actions: [],
        preserve: [],
        not_assessable_reason: null,
        confidence: "high",
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
      limitations: [],
      contradiction_warnings: [],
    },
    s10_timestamped_commentary: {
      summary: "No acting-scene timestamp is available because Side 1 was not observed.",
      notes: [
        {
          id: "note-side-1-missing",
          timecode: null,
          start_time: null,
          end_time: null,
          time_band_label: null,
          display_label: "Not observed",
          timestamp_precision: "unavailable",
          section: "missing_component",
          title: "Required Side 1 not observed.",
          detail: "The required acting scene was not identified in this tape.",
          action: "Record and include Side 1.",
          evidence_summary: "Component verification marked Side 1 absent.",
          linked_requirement_ids: ["req-side-1"],
          linked_observed_sequence_ids: [],
          linked_component_verification_ids: ["cv-side-1"],
          linked_matrix_result_ids: ["req-side-1"],
          linked_fix_ids: ["fix-side-1"],
          linked_strength_ids: [],
          linked_technique_observation_ids: [],
          component_type: "acting_scene",
          component_status: "absent",
          applies_to_observed_portion_only: false,
          is_exact_timestamp_supported: false,
          is_legacy_timestamp_projection: false,
          note_source_authority: "s10_ai_authored",
          legacy_source_used: false,
          is_missing_component_note: true,
          is_projection_safe: false,
          confidence: "high",
          is_generic_fallback: false,
        },
      ],
      component_ranges: [],
      missing_or_unobserved_components: ["Required Side 1 acting scene"],
      timestamp_limitations: [
        "Exact acting-scene timestamps are unavailable because the scene was not observed.",
      ],
      projection_notes: [],
      legacy_projection_blocked_count: 2,
      exact_timestamp_supported_count: 0,
      time_banded_note_count: 0,
      order_only_note_count: 0,
      missing_component_note_count: 1,
      contradiction_warnings: [],
    },
  };
}

const s10Context = {
  briefContext: {
    project_name: "Canary A",
    role_name: "Role",
    discipline: "musical_theatre",
    audition_type: "self_tape",
    material_package_summary: "Side 1 plus contemporary legit MT song.",
    role_description_summary: null,
    deadline_summary: null,
    upload_summary: null,
    file_naming_summary: "Use the requested file naming convention.",
  },
  briefRequirements: canaryRequirements as never,
  observedTapeSequence: [
    {
      id: "seq-song",
      label: "Observed song section",
      component_type: "song",
      linked_requirement_ids: ["req-song"],
      start_time: null,
      end_time: null,
      present_status: "partially_present",
      completion_status: "cut_off",
      evidence_summary: "Song portion is observed but completion is uncertain.",
      observed_from_media: true,
      evidence_basis: "observed_audio_video",
      confidence: "medium",
      assessability_notes: "Audio assessable.",
    },
  ],
  componentVerifications: [
    {
      requirement_id: "req-side-1",
      requirement_summary: "Required Side 1 acting scene",
      observed_status: "absent",
      completion_status: "incomplete",
      evidence_summary: "No Side 1 acting scene was identified.",
      observed_from_media: false,
      evidence_basis: "uncertainty",
      timestamp_refs: [],
      confidence: "high",
      cannot_infer_from_brief_only: true,
    },
    {
      requirement_id: "req-song",
      requirement_summary: "Contemporary legit MT song",
      observed_status: "partially_present",
      completion_status: "cut_off",
      evidence_summary: "Only the observed song portion is available.",
      observed_from_media: true,
      evidence_basis: "observed_audio_video",
      timestamp_refs: [],
      confidence: "medium",
      cannot_infer_from_brief_only: true,
    },
  ],
  mediaObservationSummary: {
    audio_assessable: true,
    video_assessable: true,
    framing_assessable: true,
    continuity_assessable: true,
    abrupt_cutoff_detected: true,
    one_continuous_video_observed: true,
    duration_summary: "Short incomplete package.",
    uncertainties: [],
  },
};

describe("S10 report view-model routing", () => {
  it("builds an authoritative S10 view model and blocks raw-report authority", () => {
    const legacy = canaryS10Report();
    const snapshot = JSON.stringify(legacy);
    const v2 = buildV2Report({
      legacyReport: legacy,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: s10Context as never,
    });

    expect(hasS10AuthoritativeModules(legacy)).toBe(true);
    expect(JSON.stringify(legacy)).toBe(snapshot);
    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.s10_view_model?.source_mode).toBe("s10_ai_report_model");
    expect(v2.s10_view_model?.section_source_map.readiness_header.source).toBe(
      "s10_authoritative_module",
    );
    expect(v2.s10_view_model?.section_source_map.component_breakdown.module).toContain(
      "component_verifications",
    );
    expect(v2.overall_readiness).toBe(42);
    expect(v2.headline).toMatch(/Retake required/i);
    expect(v2.fix_first).toMatch(/Side 1/i);
    expect(JSON.stringify(v2)).not.toContain("Strong for this level");
    expect(JSON.stringify(v2)).not.toContain("Naturalistic acting with good pace");
    expect(JSON.stringify(v2)).not.toContain("Correct material, orientation, and framing");
    expect(JSON.stringify(v2)).not.toContain("00:05");
    expect(validateV2PublicBoundary(v2, legacy).ok).toBe(true);
  });

  it("renders specific limitations when an S10-covered module is missing", () => {
    const legacy = canaryS10Report();
    delete (legacy as Record<string, unknown>).s10_technique_commentary;
    const v2 = buildV2Report({
      legacyReport: legacy,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: s10Context as never,
    });
    expect(v2.s10_view_model?.section_source_map.technique_commentary.source).toBe(
      "specific_limitation",
    );
    expect(v2.s10_view_model?.limitations).toContain(
      "Technique commentary is not available for this report.",
    );
  });

  it("does not force non-S10 legacy reports into S10 source mode", () => {
    const v2 = buildV2Report({
      legacyReport: { overall_score_final: 70, scores: { audio: 70 } },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });
    expect(v2.source_mode).toBe("legacy_projection");
    expect(v2.s10_view_model).toBeUndefined();
  });
});
