import { describe, expect, it } from "vitest";
import type {
  BriefAchievementMatrix,
  ReadinessAndScoreJudgement,
  S10FixHierarchy,
  S10NextActionPlan,
  S10ProfessionalCritique,
  S10TechniqueCommentary,
  S10TimestampedCommentary,
  S10TimestampedNote,
} from "@/lib/audition-rules";
import type {
  ComponentVerification,
  EvidencePass,
  ObservedTapeSequence,
} from "@/server/evidence-pass.server";
import {
  applyS10TimestampedCommentary,
  normaliseS10TimestampedCommentary,
  scrubS10TimestampedCommentaryProjection,
} from "@/server/s10-timestamped-commentary.server";

function matrix(overrides: Partial<BriefAchievementMatrix> = {}): BriefAchievementMatrix {
  return {
    overall_status: "partly_achieved",
    mandatory_status: "blocked",
    readiness_impact: "submission_blocker",
    summary: "Required package is incomplete.",
    achieved_requirements: ["Landscape framing"],
    missing_or_incomplete_requirements: ["Side 1 acting scene", "Contemporary legit MT song"],
    not_assessable_requirements: [],
    final_check_requirements: ["One final upload file"],
    requirement_results: [
      {
        requirement_id: "req_side_1",
        requirement_summary: "Side 1 acting scene",
        category: "material",
        importance: "mandatory",
        observed_status: "absent",
        completion_status: "not_applicable",
        achievement_status: "not_achieved",
        evidence_summary: "No acting scene is observed in the submitted tape.",
        submission_impact: "submission_blocker",
        fix_category: "must_fix",
        recommended_action: "Record/include the required Side 1 acting scene.",
        confidence: "high",
        linked_observed_sequence_ids: [],
        linked_component_verification_ids: ["req_side_1"],
        cannot_infer_from_brief_only: true,
      },
      {
        requirement_id: "req_song",
        requirement_summary: "Contemporary legit MT song",
        category: "material",
        importance: "mandatory",
        observed_status: "partially_present",
        completion_status: "cut_off",
        achievement_status: "partly_achieved",
        evidence_summary: "The song is observed only in part and the ending is uncertain.",
        submission_impact: "material_gap",
        fix_category: "must_fix",
        recommended_action: "Confirm the song runs through to the end.",
        confidence: "medium",
        linked_observed_sequence_ids: ["seq_song"],
        linked_component_verification_ids: ["req_song"],
        cannot_infer_from_brief_only: true,
      },
      {
        requirement_id: "req_package",
        requirement_summary: "One continuous video containing Side 1 and song",
        category: "technical",
        importance: "mandatory",
        observed_status: "partially_present",
        completion_status: "incomplete",
        achievement_status: "partly_achieved",
        evidence_summary:
          "The clip may be continuous but the required material package is incomplete.",
        submission_impact: "material_gap",
        fix_category: "must_fix",
        recommended_action: "Check Side 1 and song are both in the final continuous video.",
        confidence: "high",
        linked_observed_sequence_ids: ["seq_song"],
        linked_component_verification_ids: ["req_package"],
        cannot_infer_from_brief_only: true,
      },
    ],
    ...overrides,
  };
}

const readiness: ReadinessAndScoreJudgement = {
  decision: "retake_required_if_possible",
  headline: "Retake required because required material is missing.",
  rationale: ["The required Side 1 is absent."],
  confidence: "high",
  performance_quality_score: 82,
  brief_completion_score: 35,
  overall_submission_readiness_score: 45,
  score_band_label: "retake_required_if_possible",
  score_explanation: "Visible material does not override missing mandatory material.",
  brief_blocker_override: true,
  performance_quality_summary: "Some observed performance evidence may be useful.",
  brief_completion_summary: "The package is incomplete.",
  technical_assessability_summary: "Audio/video are assessable.",
  selected_level_calibration_summary: "Professional submission readiness is blocked.",
  professional_nuance_summary: "Strengths can only apply to observed material.",
  category_scores: [],
  category_rationale: {},
  component_scores: [],
  component_score_notes: [],
  score_contradiction_warnings: [],
  repair_prompt_status: "not_needed",
};

const fixHierarchy: S10FixHierarchy = {
  fix_first: null,
  priority_fixes: [],
  must_fix_before_submitting: [],
  should_improve_if_retaking: [],
  optional_polish: [],
  preserve: [],
  do_not_overfix: [],
  action_contradiction_warnings: [],
};

const nextActionPlan: S10NextActionPlan = {
  submit_checklist: [],
  retake_plan: ["Record/include the required Side 1 acting scene."],
  final_checks: ["Check Side 1 and song are both present in the final file."],
  playback_checks: ["Playback-check the end of the song for cut-off."],
  do_not_overfix: [],
  if_time_is_short_guidance: [],
  no_retake_needed_reason: null,
  confidence: "high",
};

const critique: S10ProfessionalCritique = {
  summary: "Only verified evidence is used.",
  performance_strengths: [],
  brief_package_strengths: [],
  technical_presentation_strengths: [],
  vocal_or_singing_strengths: [],
  acting_strengths: [],
  movement_or_physical_strengths: [],
  professional_presentation_notes: [],
  preserve: [],
  do_not_overfix: [],
  critique_limitations: ["Acting-scene strengths cannot be assessed because Side 1 is missing."],
  contradiction_warnings: [],
};

const technique: S10TechniqueCommentary = {
  summary: "Technique is limited to verified components.",
  acting: {
    status: "not_assessable",
    headline: "Acting scene not assessable.",
    observations: [],
    what_is_working: [],
    what_could_improve: [],
    practical_actions: [],
    preserve: [],
    not_assessable_reason: "Required Side 1 is missing.",
    confidence: "high",
  },
  vocal_singing: {
    status: "partially_assessable",
    headline: "Observed song portion can be discussed.",
    observations: [],
    what_is_working: [],
    what_could_improve: [],
    practical_actions: [],
    preserve: [],
    not_assessable_reason: null,
    confidence: "medium",
  },
  movement_dance: {
    status: "not_applicable",
    headline: "Movement not required.",
    observations: [],
    what_is_working: [],
    what_could_improve: [],
    practical_actions: [],
    preserve: [],
    not_assessable_reason: null,
    confidence: "low",
  },
  musical_theatre_package: {
    status: "partially_assessable",
    headline: "Package incomplete.",
    observations: [],
    what_is_working: [],
    what_could_improve: [],
    practical_actions: [],
    preserve: [],
    not_assessable_reason: null,
    confidence: "high",
  },
  self_tape_presentation: {
    status: "assessable",
    headline: "Presentation is assessable.",
    observations: [],
    what_is_working: ["Audio and framing are usable where observed."],
    what_could_improve: [],
    practical_actions: [],
    preserve: [],
    not_assessable_reason: null,
    confidence: "high",
  },
  commercial_screen_task: {
    status: "not_applicable",
    headline: "Commercial task not applicable.",
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
};

function note(overrides: Partial<S10TimestampedNote>): S10TimestampedNote {
  return {
    id: "note",
    timecode: "00:10",
    start_time: "00:10",
    end_time: null,
    time_band_label: null,
    display_label: "00:10",
    timestamp_precision: "exact",
    section: "observed_component",
    title: "Observed moment",
    detail: "A specific observed moment.",
    action: null,
    evidence_summary: "Supported by observed component evidence.",
    linked_requirement_ids: [],
    linked_observed_sequence_ids: [],
    linked_component_verification_ids: [],
    linked_matrix_result_ids: [],
    linked_fix_ids: [],
    linked_strength_ids: [],
    linked_technique_observation_ids: [],
    component_type: "technical",
    component_status: "present",
    applies_to_observed_portion_only: false,
    is_exact_timestamp_supported: true,
    is_legacy_timestamp_projection: false,
    note_source_authority: "s10_ai_authored",
    legacy_source_used: false,
    legacy_source_path: null,
    is_missing_component_note: false,
    is_projection_safe: true,
    projection_block_reason: null,
    confidence: "high",
    is_generic_fallback: false,
    ...overrides,
  };
}

const observedTapeSequence: ObservedTapeSequence[] = [
  {
    id: "seq_song",
    label: "Observed song section",
    component_type: "song",
    linked_requirement_ids: ["req_song"],
    start_time: "00:55",
    end_time: "01:35",
    present_status: "partially_present",
    completion_status: "cut_off",
    evidence_summary: "Song is observed, but its completion is uncertain.",
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    confidence: "medium",
    assessability_notes: "",
  },
];

const verifications: ComponentVerification[] = [
  {
    requirement_id: "req_side_1",
    requirement_summary: "Side 1 acting scene",
    observed_status: "absent",
    completion_status: "not_applicable",
    evidence_summary: "No acting scene is observed.",
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    timestamp_refs: [],
    confidence: "high",
    cannot_infer_from_brief_only: true,
  },
  {
    requirement_id: "req_song",
    requirement_summary: "Contemporary legit MT song",
    observed_status: "partially_present",
    completion_status: "cut_off",
    evidence_summary: "Song is observed only in part.",
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    timestamp_refs: ["00:55"],
    confidence: "medium",
    cannot_infer_from_brief_only: true,
  },
];

const timestampedEvidence: EvidencePass["timestamped_evidence"] = [
  {
    timestamp: "00:55",
    observation: "Observed song section begins.",
    why_it_matters: "This is the only verified performance component.",
    linked_category: "vocal",
  },
];

function commentary(notes: S10TimestampedNote[]): S10TimestampedCommentary {
  return {
    summary: "Timestamped notes are evidence-bound.",
    notes,
    component_ranges: [],
    missing_or_unobserved_components: [],
    timestamp_limitations: [],
    projection_notes: [],
    legacy_projection_blocked_count: 0,
    exact_timestamp_supported_count: 0,
    time_banded_note_count: 0,
    order_only_note_count: 0,
    missing_component_note_count: 0,
    contradiction_warnings: [],
  };
}

describe("S10.9 timestamped and time-banded commentary", () => {
  it("blocks Canary A acting-scene timestamped strengths and exact legacy text", () => {
    const report: Record<string, unknown> = {
      timestamped_notes: [
        { timestamp: "00:05", note: "Strong start to the scene" },
        { timestamp: "00:25", note: "Good use of eyeline" },
      ],
      s10_timestamped_commentary: commentary([
        note({
          id: "legacy_scene_start",
          timecode: "00:05",
          start_time: "00:05",
          title: "Strong start to the scene",
          detail: "00:05 Strong start to the scene",
          component_type: "acting_scene",
          component_status: "present",
          is_exact_timestamp_supported: true,
          legacy_source_used: true,
          legacy_source_path: "raw_report.timestamped_notes[0]",
        }),
        note({
          id: "legacy_eyeline",
          timecode: "00:25",
          start_time: "00:25",
          title: "Eyeline",
          detail: "00:25 Good use of eyeline",
          component_type: "acting_scene",
          component_status: "present",
          is_exact_timestamp_supported: true,
          legacy_source_used: true,
          legacy_source_path: "raw_report.timestamped_notes[1]",
        }),
        note({
          id: "legacy_transition",
          timecode: "00:55",
          start_time: "00:55",
          title: "Transition",
          detail: "00:55 transition into the song",
          component_type: "transition",
          component_status: "present",
          is_exact_timestamp_supported: true,
          legacy_source_used: true,
          legacy_source_path: "raw_report.timestamped_notes[2]",
        }),
        note({
          id: "legacy_sustained",
          timecode: "01:35",
          start_time: "01:35",
          title: "Sustained note",
          detail: "01:35 Excellent vocal control on the sustained notes",
          component_type: "song",
          component_status: "present",
          linked_component_verification_ids: ["req_song"],
          is_exact_timestamp_supported: true,
          legacy_source_used: true,
          legacy_source_path: "raw_report.timestamped_notes[3]",
        }),
      ]),
    };

    const result = applyS10TimestampedCommentary({
      report,
      matrix: matrix(),
      readiness,
      fixHierarchy,
      nextActionPlan,
      professionalCritique: critique,
      techniqueCommentary: technique,
      observedTapeSequence,
      componentVerifications: verifications,
      timestampedEvidence,
    });

    const json = JSON.stringify(result.commentary);
    expect(json).not.toContain("Strong start to the scene");
    expect(json).not.toContain("Good use of eyeline");
    expect(json).not.toContain("transition into the song");
    expect(json).not.toContain("Excellent vocal control on the sustained notes");
    expect(result.commentary.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component_type: "acting_scene",
          display_label: "Not observed",
          timestamp_precision: "unavailable",
          is_missing_component_note: true,
          is_projection_safe: false,
        }),
      ]),
    );
    expect(report.timestamped_notes).toEqual([]);
  });

  it("keeps partial song notes only as observed-portion-only and adds playback check", () => {
    const result = normaliseS10TimestampedCommentary({
      commentary: commentary([
        note({
          id: "song_observed",
          timecode: "01:05",
          start_time: "01:05",
          timestamp_precision: "exact",
          is_exact_timestamp_supported: false,
          display_label: "01:05",
          title: "Observed song tone",
          detail: "The tone is clear in the observed song phrase.",
          component_type: "song",
          component_status: "partially_present",
          linked_component_verification_ids: ["req_song"],
        }),
      ]),
      matrix: matrix(),
      readiness,
      fixHierarchy,
      nextActionPlan,
      professionalCritique: critique,
      techniqueCommentary: technique,
      observedTapeSequence,
      componentVerifications: verifications,
      timestampedEvidence,
    });

    expect(result.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "song_observed",
          timestamp_precision: "approximate",
          display_label: "Approx. 01:05",
          applies_to_observed_portion_only: true,
        }),
        expect.objectContaining({
          id: "s10_ts_song_playback_cutoff_check",
          section: "next_action",
          timestamp_precision: "order_only",
          applies_to_observed_portion_only: true,
        }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("complete song");
    expect(result.projection_notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timestamp: "01:05",
          source_note_id: "song_observed",
          timestamp_precision: "approximate",
        }),
      ]),
    );
  });

  it("does not let timestamped commentary prove component presence", () => {
    const result = normaliseS10TimestampedCommentary({
      commentary: commentary([
        note({
          id: "brief_only_scene",
          timecode: "00:10",
          start_time: "00:10",
          title: "Acting scene beat",
          detail: "A naturalistic acting beat appears here.",
          component_type: "acting_scene",
          component_status: "present",
          is_exact_timestamp_supported: true,
        }),
      ]),
      matrix: matrix(),
      readiness,
      fixHierarchy,
      nextActionPlan,
      professionalCritique: critique,
      techniqueCommentary: technique,
      observedTapeSequence,
      componentVerifications: verifications,
      timestampedEvidence,
    });

    expect(result.notes.some((item) => item.id === "brief_only_scene")).toBe(false);
    expect(result.notes.some((item) => item.is_missing_component_note)).toBe(true);
  });

  it("preserves verified strong-complete timestamped/time-banded notes without inventing missing components", () => {
    const completeMatrix = matrix({
      overall_status: "achieved",
      mandatory_status: "clear",
      readiness_impact: "supports_submission",
      missing_or_incomplete_requirements: [],
      requirement_results: [
        {
          ...matrix().requirement_results[0],
          observed_status: "present",
          completion_status: "complete",
          achievement_status: "achieved",
          submission_impact: "supports_submission",
          linked_observed_sequence_ids: ["seq_scene"],
        },
        {
          ...matrix().requirement_results[1],
          observed_status: "present",
          completion_status: "complete",
          achievement_status: "achieved",
          submission_impact: "supports_submission",
        },
      ],
    });
    const completeVerifications: ComponentVerification[] = [
      {
        ...verifications[0],
        observed_status: "present",
        completion_status: "complete",
        evidence_summary: "The required Side 1 acting scene is observed from media.",
      },
      {
        ...verifications[1],
        observed_status: "present",
        completion_status: "complete",
        evidence_summary: "The full song is observed from media.",
      },
    ];
    const result = normaliseS10TimestampedCommentary({
      commentary: commentary([
        note({
          id: "scene_note",
          timecode: "00:12",
          start_time: "00:12",
          title: "Scene objective lands",
          detail: "The acting beat is specific in the observed scene.",
          component_type: "acting_scene",
          linked_component_verification_ids: ["req_side_1"],
          is_exact_timestamp_supported: true,
        }),
        note({
          id: "song_note",
          timecode: "01:10",
          start_time: "01:10",
          title: "Song phrase works",
          detail: "The observed full song phrase has clear storytelling.",
          component_type: "song",
          linked_component_verification_ids: ["req_song"],
          is_exact_timestamp_supported: true,
        }),
      ]),
      matrix: completeMatrix,
      readiness: { ...readiness, decision: "submit", brief_blocker_override: false },
      fixHierarchy,
      nextActionPlan,
      professionalCritique: critique,
      techniqueCommentary: technique,
      observedTapeSequence: [
        {
          ...observedTapeSequence[0],
          id: "seq_scene",
          label: "Observed acting scene",
          component_type: "acting_scene",
          start_time: "00:00",
          end_time: "00:45",
          present_status: "present",
          completion_status: "complete",
        },
        { ...observedTapeSequence[0], completion_status: "complete", present_status: "present" },
      ],
      componentVerifications: completeVerifications,
      timestampedEvidence,
    });

    expect(result.notes.map((item) => item.id)).toEqual(
      expect.arrayContaining(["scene_note", "song_note"]),
    );
    expect(result.notes.some((item) => item.is_missing_component_note)).toBe(false);
    expect(result.projection_notes.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the Step 1 lock and projects S10.9 notes only after normalisation", () => {
    const report: Record<string, unknown> = {
      timestamped_notes: [
        { timestamp: "00:05", note: "Direct Step 2 bypass note should not survive." },
      ],
      s10_timestamped_commentary: commentary([
        note({
          id: "safe_projection",
          timecode: "01:05",
          start_time: "01:05",
          timestamp_precision: "exact",
          is_exact_timestamp_supported: false,
          title: "Observed song section",
          detail: "The observed song portion is clear enough to locate.",
          component_type: "song",
          component_status: "partially_present",
          linked_component_verification_ids: ["req_song"],
        }),
      ]),
    };

    applyS10TimestampedCommentary({
      report,
      matrix: matrix(),
      readiness,
      fixHierarchy,
      nextActionPlan,
      professionalCritique: critique,
      techniqueCommentary: technique,
      observedTapeSequence,
      componentVerifications: verifications,
      timestampedEvidence,
    });

    expect(report.timestamped_notes).toEqual([
      expect.objectContaining({
        timestamp: "01:05",
        note: expect.stringContaining("Observed song section"),
      }),
    ]);
    expect(JSON.stringify(report.timestamped_notes)).not.toContain("Direct Step 2 bypass");
  });

  it("scrubs generic timestamp filler from projection fields", () => {
    const report: Record<string, unknown> = {
      s10_timestamped_commentary: {
        notes: [{ detail: "Useful moment" }],
      },
      timestamped_notes: [{ timestamp: "00:10", note: "Useful moment" }],
    };

    const scrub = scrubS10TimestampedCommentaryProjection(report);

    expect(scrub.removed).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toContain("Useful moment");
  });
});
