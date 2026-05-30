import { describe, expect, it } from "vitest";
import {
  buildS10PerformerLevelPromptBlock,
  createS10PerformerLevelCalibration,
  labelForScore,
  toS10PerformerLevel,
  type BriefAchievementMatrix,
} from "@/lib/audition-rules";
import { normaliseReadinessScoreJudgement } from "@/server/s10-readiness-score-semantics.server";

const clearMatrix: BriefAchievementMatrix = {
  overall_status: "achieved",
  mandatory_status: "clear",
  readiness_impact: "supports_submission",
  summary: "Mandatory material is complete.",
  achieved_requirements: [],
  missing_or_incomplete_requirements: [],
  not_assessable_requirements: [],
  final_check_requirements: [],
  requirement_results: [],
};

describe("S10 level-relative performer calibration", () => {
  it("maps legacy audition levels to canonical S10 performer levels", () => {
    expect(toS10PerformerLevel("learning")).toBe("learning_school");
    expect(toS10PerformerLevel("amateur")).toBe("amateur_community");
    expect(toS10PerformerLevel("emerging")).toBe("emerging_training");
    expect(toS10PerformerLevel("professional")).toBe("professional");
  });

  it("builds prompts that make selected level the standard rather than tone", () => {
    const professional = buildS10PerformerLevelPromptBlock("professional");
    const learning = buildS10PerformerLevelPromptBlock("learning");

    expect(professional).toContain("SELECTED PERFORMER LEVEL: Professional");
    expect(professional).toContain("assessment standard, not as tone");
    expect(professional).toContain("competitive, not merely competent");
    expect(professional).toContain("Professional 90+");

    expect(learning).toContain("SELECTED PERFORMER LEVEL: Learning / School");
    expect(learning).toContain("not automatic Professional readiness");
  });

  it("keeps the same score language level-relative for the same observed tape", () => {
    expect(labelForScore(82, "learning")).toBe("Strong for this level");
    expect(labelForScore(82, "professional")).toBe("Ready to submit");
  });

  it("normalises selected-level calibration with deterministic selected level winning", () => {
    const judgement = normaliseReadinessScoreJudgement({
      matrix: clearMatrix,
      currentOverallScore: 88,
      selectedLevel: "professional",
      judgement: {
        decision: "submit",
        headline: "Submit-ready.",
        rationale: ["Mandatory material is complete."],
        confidence: "high",
        performance_quality_score: 88,
        brief_completion_score: 90,
        overall_submission_readiness_score: 88,
        score_band_label: "submit_strong_submission",
        score_explanation: "Strong for the selected level.",
        brief_blocker_override: false,
        performance_quality_summary: "Performance is specific.",
        brief_completion_summary: "Brief is complete.",
        technical_assessability_summary: "Audio/video are assessable.",
        selected_level_calibration_summary:
          "At Professional level, this is submit-ready but not yet a standout 90+ tape.",
        selected_level_calibration: createS10PerformerLevelCalibration("learning", {
          what_meets_level: ["The required material is complete."],
          what_falls_short: ["Not yet clearly standout in a competitive Professional field."],
          recommendation_impact:
            "The Professional standard keeps this as submit-ready rather than standout.",
          confidence: "high",
        }),
        professional_nuance_summary: "Below the Professional 90+ zone.",
        category_scores: [],
        category_rationale: {},
        component_scores: [],
        component_score_notes: [],
        score_contradiction_warnings: [],
        repair_prompt_status: "not_needed",
      },
    });

    expect(judgement.selected_level_calibration.selected_level).toBe("professional");
    expect(judgement.selected_level_calibration.selected_level_label).toBe("Professional");
    expect(judgement.selected_level_calibration.standard_applied).toContain(
      "casting-facing conditions",
    );
    expect(judgement.selected_level_calibration.what_meets_level).toContain(
      "The required material is complete.",
    );
    expect(judgement.selected_level_calibration.what_falls_short[0]).toContain("Professional");
    expect(judgement.selected_level_calibration_summary).toContain("Professional level");
  });
});
