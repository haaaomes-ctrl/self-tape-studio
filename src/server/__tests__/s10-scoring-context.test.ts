import { describe, expect, it } from "vitest";
import { buildS10ScoringContext, inferS10ScoringMode } from "@/server/s10-scoring-context.server";
import {
  s10CanaryABriefContext,
  s10CanaryABriefRequirements,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import { s10StrongCompleteProfessionalBriefContext } from "@/test-fixtures/s10-strong-complete-professional";

describe("S10 scoring context", () => {
  it("infers brief-supplied mode when requirements and matrix are available", () => {
    const mode = inferS10ScoringMode({
      report: {},
      briefContext: s10CanaryABriefContext,
      briefRequirements: [...s10CanaryABriefRequirements],
      matrix: {
        overall_status: "partly_achieved",
        mandatory_status: "blocked",
        readiness_impact: "submission_blocker",
        summary: "Required Side 1 is missing.",
        achieved_requirements: [],
        missing_or_incomplete_requirements: ["Required Side 1 acting scene"],
        not_assessable_requirements: [],
        final_check_requirements: [],
        requirement_results: [],
      },
    });

    expect(mode).toBe("brief_supplied");
  });

  it("renders no-brief baseline as observable-only scoring with forbidden brief claims", () => {
    const context = buildS10ScoringContext({
      scoringMode: "no_brief_baseline",
      briefContext: null,
      briefRequirements: [],
      matrix: null,
      observedTapeSequence: [{ label: "Acting tape", present_status: "present" } as never],
      componentVerifications: [],
      mediaObservationSummary: null,
      selectedLevel: "professional",
      numericScoresVisible: true,
    });

    expect(context).toMatchObject({
      scoring_mode: "no_brief_baseline",
      scoring_basis_label: "No brief baseline",
      brief_status: "no_brief_available",
      can_assess_brief_achievement: false,
      score_meaning_label: "no_brief_baseline_quality",
    });
    expect(context.allowed_score_claims).toContain("observable performance quality");
    expect(context.forbidden_claims).toEqual(
      expect.arrayContaining([
        "brief achievement",
        "mandatory requirement completion",
        "deadline compliance",
        "upload compliance",
      ]),
    );
    expect(context.required_limitations.join(" ")).toContain("No casting brief was supplied");
    expect(context.score_visibility).toMatchObject({
      public_customer_score_release_approved: false,
      performer_report_must_remain_useful_without_numeric_scores: true,
    });
  });

  it("keeps partial brief context separate from full brief compliance", () => {
    const mode = inferS10ScoringMode({
      report: {},
      briefContext: s10StrongCompleteProfessionalBriefContext,
      briefRequirements: [],
      matrix: null,
    });
    const context = buildS10ScoringContext({
      scoringMode: mode,
      briefContext: s10StrongCompleteProfessionalBriefContext,
      briefRequirements: [],
      matrix: null,
      observedTapeSequence: [],
      componentVerifications: [],
      mediaObservationSummary: null,
      selectedLevel: "professional",
      numericScoresVisible: false,
    });

    expect(context.scoring_mode).toBe("partial_brief_supplied");
    expect(context.can_assess_brief_achievement).toBe(false);
    expect(context.forbidden_claims).toContain("full brief compliance");
    expect(context.required_limitations.join(" ")).toContain("Formal brief requirements");
  });

  it("honours explicit uncertain scoring mode over available brief-shaped data", () => {
    const mode = inferS10ScoringMode({
      report: { scoring_context: { scoring_mode: "brief_uncertain" } },
      briefContext: s10CanaryABriefContext,
      briefRequirements: [...s10CanaryABriefRequirements],
      matrix: null,
    });

    expect(mode).toBe("brief_uncertain");
  });
});
