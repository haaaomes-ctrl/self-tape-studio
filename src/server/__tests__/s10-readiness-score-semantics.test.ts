import { describe, expect, it } from "vitest";
import type { BriefAchievementMatrix, BriefRequirement } from "@/lib/audition-rules";
import type { ComponentVerification, ObservedTapeSequence } from "@/server/evidence-pass.server";
import { normaliseBriefAchievementMatrix } from "@/server/s10-brief-achievement-matrix.server";
import {
  applyReadinessScoreSemantics,
  deriveReadinessConstraint,
  normaliseReadinessScoreJudgement,
} from "@/server/s10-readiness-score-semantics.server";

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
    report_destination: "readiness_score_judgement",
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
    matrix: {},
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
        "The submitted clip appears continuous, but the required package is incomplete.",
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

describe("S10.5 readiness recommendation and score semantics", () => {
  it("forces Canary A to retake-required readiness while preserving truthful category strengths", () => {
    const matrix = canaryMatrix();
    const rawReport = {
      overall_score: 93,
      brief_adherence_breakdown: { material_compliance: 100 },
      detected_components: [{ type: "acting_scene" }, { type: "song" }],
    };
    const report: Record<string, unknown> = {
      raw_report: rawReport,
      casting_headline: "Strong for this level",
      detected_components: [
        { type: "acting_scene", weight: 0.5, score: 95, note: "Legacy false positive." },
        { type: "song", weight: 0.5, score: 94, note: "Strong observed singing." },
      ],
      scores: { audio: 96, technical: 92, vocal: 91, acting: 93, brief_adherence: 100 },
      brief_adherence_breakdown: { material_compliance: 100, note: "Correct material." },
      readiness_score_judgement: {
        decision: "submit",
        headline: "Strong for this level",
        rationale: ["Legacy prose says this is ready."],
        confidence: "high",
        performance_quality_score: 92,
        brief_completion_score: 100,
        overall_submission_readiness_score: 93,
        score_band_label: "submit_strong_submission",
        score_explanation: "Strong complete package.",
        brief_blocker_override: false,
        performance_quality_summary: "Visible song quality is strong.",
        brief_completion_summary: "Legacy material complete.",
        technical_assessability_summary: "Audio and frame are assessable.",
        selected_level_calibration_summary: "Professional.",
        professional_nuance_summary: "Needs nuance.",
        component_scores: [
          {
            component_type: "acting_scene",
            linked_requirement_ids: ["req_side_1"],
            observed_status: "present",
            completion_status: "complete",
            score: 95,
            score_basis: "Legacy detected acting scene.",
            confidence: "high",
            cannot_score_reason: null,
          },
          {
            component_type: "song",
            linked_requirement_ids: ["req_song"],
            observed_status: "partially_present",
            completion_status: "cut_off",
            score: 91,
            score_basis: "Observed portion has vocal strengths.",
            confidence: "medium",
            cannot_score_reason: null,
          },
        ],
        category_scores: [
          {
            category_id: "audio",
            score: 96,
            score_basis: "Audio assessable.",
            what_works: "Clear audio.",
            why_not_full_score: "",
            close_gap: "",
            confidence: "high",
            blocked_or_not_assessable_reason: null,
          },
        ],
        category_rationale: {},
        component_score_notes: ["Song score is only for observed portion."],
        score_contradiction_warnings: [],
        repair_prompt_status: "not_needed",
      },
    };

    const rawSnapshot = JSON.stringify(rawReport);
    const result = applyReadinessScoreSemantics({
      report,
      matrix,
      currentOverallScore: 93,
      selectedLevel: "professional",
    });
    const judgement = report.readiness_score_judgement as Record<string, unknown>;
    const componentScores = judgement.component_scores as Array<Record<string, unknown>>;

    expect(result.overall).toBeLessThanOrEqual(54);
    expect(judgement.decision).toBe("retake_required_if_possible");
    expect(judgement.overall_submission_readiness_score).not.toBe(93);
    expect(judgement.brief_blocker_override).toBe(true);
    expect((report.scores as Record<string, unknown>).audio).toBe(96);
    expect((report.scores as Record<string, unknown>).technical).toBe(92);
    expect((report.scores as Record<string, unknown>).brief_adherence).toBeLessThan(100);
    expect(
      (report.brief_adherence_breakdown as Record<string, unknown>).material_compliance,
    ).toBeLessThan(100);
    expect(
      (report.detected_components as Array<Record<string, unknown>>).some(
        (c) => c.type === "acting_scene",
      ),
    ).toBe(false);
    expect(
      (report.detected_components as Array<Record<string, unknown>>).find((c) => c.type === "song")
        ?.score,
    ).toBeLessThanOrEqual(84);
    expect(componentScores.find((item) => item.component_type === "acting_scene")).toMatchObject({
      score: null,
      cannot_score_reason: expect.stringContaining("not scoreable"),
    });
    expect(
      componentScores.find((item) => item.component_type === "song")?.score,
    ).toBeLessThanOrEqual(84);
    expect(result.warnings.length).toBeGreaterThanOrEqual(5);
    expect(result.warnings.map((warning) => warning.source)).toEqual(
      expect.arrayContaining(["s10_ai_judgement", "legacy_raw_report", "detected_components"]),
    );
    expect(JSON.stringify(rawReport)).toBe(rawSnapshot);
  });

  it("does not hard-cap preferred, optional or final-check-only gaps", () => {
    const requirements = [
      requirement("req_scene", "Full acting scene", "material"),
      requirement("req_optional", "Optional eyeline polish", "performance", "optional"),
      requirement("req_filename", "Check final filename", "admin_process"),
    ];
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        overall_status: "mostly_achieved",
        mandatory_status: "some_gaps",
        readiness_impact: "review_carefully",
        requirement_results: [
          {
            requirement_id: "req_optional",
            observed_status: "uncertain",
            completion_status: "uncertain",
            achievement_status: "not_assessable",
            submission_impact: "optional_polish",
            fix_category: "optional_polish",
            evidence_summary: "Optional eyeline polish could improve.",
          },
          {
            requirement_id: "req_filename",
            observed_status: "not_assessable",
            completion_status: "uncertain",
            achievement_status: "partly_achieved",
            submission_impact: "final_check",
            fix_category: "final_check",
            evidence_summary: "Filename needs final upload check.",
          },
        ],
      },
      briefRequirements: requirements,
      componentVerifications: [
        verification(
          "req_scene",
          "Full acting scene",
          "present",
          "complete",
          "The complete acting scene is observed.",
        ),
      ],
      observedTapeSequence: [],
    });

    const constraint = deriveReadinessConstraint(matrix);
    const report: Record<string, unknown> = {
      scores: { acting: 91, brief_adherence: 88 },
      brief_adherence_breakdown: { material_compliance: 88, note: "Complete." },
      readiness_score_judgement: {
        decision: "submit",
        overall_submission_readiness_score: 90,
        score_band_label: "submit_strong_submission",
        rationale: ["Mandatory performed material is complete."],
      },
    };
    const result = applyReadinessScoreSemantics({
      report,
      matrix,
      currentOverallScore: 90,
      selectedLevel: "professional",
    });

    expect(constraint.cap).toBeNull();
    expect(result.overall).toBe(90);
    expect((report.scores as Record<string, unknown>).brief_adherence).toBe(88);
    expect(result.warnings).toHaveLength(0);
  });

  it("removes stale missing-package readiness when compound package evidence is verified", () => {
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        requirement_results: [
          {
            requirement_id: "req004",
            observed_status: "partially_present",
            completion_status: "incomplete",
            achievement_status: "partly_achieved",
            evidence_summary: "Legacy/raw report said mandatory package evidence is incomplete.",
            submission_impact: "material_gap",
            fix_category: "must_fix",
          },
        ],
      },
      briefRequirements: [
        requirement("req002", "Record Side 1 acting scene", "material"),
        requirement("req003", "Record the contemporary legit MT song", "material"),
        requirement("req004", "Only record Side 1 and the song for the initial self-tape", "material"),
        requirement("req005", "Upload as one continuous final video", "technical"),
      ],
      componentVerifications: [
        verification("req002", "Record Side 1 acting scene", "present", "complete", "Side 1 is complete."),
        verification("req003", "Record the contemporary legit MT song", "present", "complete", "Song is complete."),
        verification("req005", "Upload as one continuous final video", "present", "complete", "One continuous video is complete."),
      ],
      observedTapeSequence: [],
      mediaObservationSummary: {
        audio_assessable: true,
        video_assessable: true,
        framing_assessable: true,
        continuity_assessable: true,
        abrupt_cutoff_detected: false,
        one_continuous_video_observed: true,
        duration_summary: "One continuous package.",
        uncertainties: [],
      },
    });
    const judgement = normaliseReadinessScoreJudgement({
      judgement: {
        decision: "review_carefully",
        headline: "Mandatory required material or package evidence is incomplete.",
        rationale: ["Record/include Side 1 before submitting."],
        overall_submission_readiness_score: 69,
        score_band_label: "review_carefully",
        score_explanation: "Mandatory package evidence is incomplete.",
      },
      matrix,
      currentOverallScore: 88,
      currentScores: { acting: 90, vocal: 90, brief_adherence: 90 },
      selectedLevel: "professional",
    });

    expect(matrix.missing_or_incomplete_requirements).not.toContain("req004");
    expect(["submit", "submit_if_deadline_is_close"]).toContain(judgement.decision);
    expect(judgement.overall_submission_readiness_score).toBeGreaterThanOrEqual(70);
    expect(judgement.score_contradiction_warnings[0]?.matrix_reason).toMatch(
      /reconciled matrix verifies mandatory package/i,
    );
  });

  it("allows strong complete professional scores with nuance and no invented blocker", () => {
    const requirements = [
      requirement("req_scene", "Full acting scene", "material"),
      requirement("req_song", "Full song", "material"),
    ];
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        overall_status: "achieved",
        mandatory_status: "clear",
        readiness_impact: "supports_submission",
      },
      briefRequirements: requirements,
      componentVerifications: [
        verification(
          "req_scene",
          "Full acting scene",
          "present",
          "complete",
          "Full scene observed.",
        ),
        verification("req_song", "Full song", "present", "complete", "Full song observed."),
      ],
      observedTapeSequence: [],
    });
    const judgement = normaliseReadinessScoreJudgement({
      judgement: {
        decision: "submit",
        performance_quality_score: 94,
        brief_completion_score: 93,
        overall_submission_readiness_score: 92,
        score_band_label: "submit_strong_submission",
        professional_nuance_summary:
          "At professional level, the score reflects specific brief precision, vocal storytelling and camera readability rather than generic excellence.",
        rationale: ["Brief-complete and professionally nuanced."],
      },
      matrix,
      currentOverallScore: 92,
      currentScores: { acting: 94, vocal: 93, brief_adherence: 92 },
      selectedLevel: "professional",
    });

    expect(judgement.decision).toBe("submit");
    expect(judgement.overall_submission_readiness_score).toBe(92);
    expect(judgement.brief_blocker_override).toBe(false);
    expect(judgement.professional_nuance_summary).toContain("professional level");
    expect(judgement.score_contradiction_warnings).toHaveLength(0);
  });

  it("classifies contradictory AI output for repair when it conflicts with S10.4", () => {
    const matrix = canaryMatrix();
    const judgement = normaliseReadinessScoreJudgement({
      judgement: {
        decision: "submit_if_deadline_is_close",
        overall_submission_readiness_score: 82,
        score_band_label: "submit_if_deadline_is_close",
        rationale: ["Deadline is close."],
      },
      matrix,
      currentOverallScore: 82,
      currentScores: { brief_adherence: 82 },
      selectedLevel: "professional",
    });

    expect(judgement.decision).toBe("retake_required_if_possible");
    expect(judgement.overall_submission_readiness_score).toBeLessThanOrEqual(54);
    expect(judgement.repair_prompt_status).toBe("classified_contradictory");
    expect(judgement.score_contradiction_warnings.length).toBeGreaterThan(0);
  });
});
