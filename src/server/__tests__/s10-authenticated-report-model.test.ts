import { describe, expect, it } from "vitest";
import {
  S10_FULL_REPORT_MODEL_REQUIRED_SECTIONS,
  composeS10AuthenticatedReportModel,
  validateS10AuthenticatedReportModel,
  validateS10FullReportModel,
} from "@/server/s10-authenticated-report-model.server";
import { classifyS10SameVideoComparison } from "@/server/s10-same-video-comparison.server";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
  s10StrongCompleteProfessionalOperatorAssumptionCheckpoint,
} from "@/test-fixtures/s10-strong-complete-professional";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import { s10SameVideoComparisonFixtures } from "@/test-fixtures/s10-same-video-comparison";

function composeStrong() {
  const composition = composeS10AuthenticatedReportModel({
    report: buildS10StrongCompleteProfessionalReportInput(),
    context: buildS10StrongCompleteProfessionalViewContext() as never,
    analysisInputContext: {
      take_lifecycle: {
        audition_id: "audition-s10-05",
        take_id: "take-s10-05",
        take_slot: 1,
        take_label: "Take 1",
        active_take_version_id: "take-version-s10-05",
        replaces_take_id: null,
        comparison_run_id: null,
        compared_take_version_ids: [],
        same_video_status: null,
      },
    },
    operatorAssumptionLog: {
      checkpoints: [s10StrongCompleteProfessionalOperatorAssumptionCheckpoint],
    },
  });
  if (!composition) throw new Error("expected S10 report model composition");
  return composition;
}

describe("S10-05 authenticated report model composition", () => {
  it("composes a full report model with every required README section", () => {
    const { full_report_model, authenticated_report_model } = composeStrong();

    for (const section of S10_FULL_REPORT_MODEL_REQUIRED_SECTIONS) {
      expect(full_report_model).toHaveProperty(section);
    }
    expect(validateS10FullReportModel(full_report_model)).toEqual({ ok: true });
    expect(validateS10AuthenticatedReportModel(authenticated_report_model)).toEqual({ ok: true });
    expect(full_report_model.required_sections).toEqual(S10_FULL_REPORT_MODEL_REQUIRED_SECTIONS);
    expect(full_report_model.brief.requirements.length).toBeGreaterThan(0);
    expect(full_report_model.observed_tape.component_verifications.length).toBeGreaterThan(0);
    expect(full_report_model.take_lifecycle).toMatchObject({
      take_slot: 1,
      active_take_version_id: "take-version-s10-05",
    });
  });

  it("preserves useful S10 AI modules without broad public-safe suppression", () => {
    const { full_report_model, authenticated_report_model } = composeStrong();

    expect(full_report_model.scoring_context.scoring_mode).toBe("brief_supplied");
    expect(full_report_model.level_calibration?.selected_level).toBe("professional");
    expect(full_report_model.professional_competitive_calibration).toMatchObject({
      applies: true,
      score_zone: "90-91",
    });
    expect(full_report_model.strengths.strengths.length).toBeGreaterThan(0);
    expect(full_report_model.technique?.acting.observations.length).toBeGreaterThan(0);
    expect(full_report_model.timestamped_commentary?.notes.length).toBeGreaterThan(0);
    expect(authenticated_report_model.red_line_filter).toMatchObject({
      policy: "narrow_high_risk_only",
      broad_public_safe_restrictions_applied: false,
    });
  });

  it("keeps operator QA proof in the full model without making it performer prose", () => {
    const secretCheckpoint = {
      ...s10StrongCompleteProfessionalOperatorAssumptionCheckpoint,
      checkpoint_id: "operator-secret-checkpoint",
      take_id: "operator-secret-take-id",
      audition_id: "operator-secret-audition-id",
    };
    const composition = composeS10AuthenticatedReportModel({
      report: buildS10StrongCompleteProfessionalReportInput(),
      context: buildS10StrongCompleteProfessionalViewContext() as never,
      operatorAssumptionLog: {
        checkpoints: [secretCheckpoint],
      },
    });
    if (!composition) throw new Error("expected S10 report model composition");

    expect(JSON.stringify(composition.full_report_model.operator_assumptions)).toContain(
      "operator-secret-take-id",
    );
    expect(JSON.stringify(composition.authenticated_report_model)).not.toContain(
      "operator-secret-take-id",
    );
    expect(composition.authenticated_report_model.qa_admin_proof_summary).toMatchObject({
      supported: true,
      performer_surface_includes_qa_internals: false,
    });
  });

  it("models no-brief baseline scoring as useful but not brief-complete", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    delete report.brief_context;
    delete report.brief_requirements;
    delete report.brief_achievement_matrix;
    report.scoring_mode = "no_brief_baseline";
    report.mode = "baseline";

    const context = buildS10StrongCompleteProfessionalViewContext() as Record<string, unknown>;
    delete context.briefContext;
    delete context.briefRequirements;
    const composition = composeS10AuthenticatedReportModel({
      report,
      context: context as never,
    });
    if (!composition) throw new Error("expected no-brief S10 report model composition");

    expect(composition.full_report_model.scoring_context).toMatchObject({
      scoring_mode: "no_brief_baseline",
      brief_status: "no_brief_available",
      can_assess_brief_achievement: false,
      score_meaning_label: "no_brief_baseline_quality",
      score_visibility: {
        public_customer_score_release_approved: false,
        performer_report_must_remain_useful_without_numeric_scores: true,
      },
    });
    expect(composition.full_report_model.scoring_context.forbidden_claims).toContain(
      "brief achievement",
    );
    expect(composition.full_report_model.brief.requirements).toEqual([]);
  });

  it("carries same-video and comparison identity without inventing a winner", () => {
    const classification = classifyS10SameVideoComparison(
      s10SameVideoComparisonFixtures.accidentalDuplicate.input,
    );
    const context = {
      ...buildS10StrongCompleteProfessionalViewContext(),
      sameVideoEvidence: classification.evidence,
      comparisonTruth: classification.comparison_truth,
      comparisonDisplayMode: classification.comparison_display_mode,
    };
    const composition = composeS10AuthenticatedReportModel({
      report: buildS10StrongCompleteProfessionalReportInput(),
      context: context as never,
      analysisInputContext: {
        take_lifecycle: {
          audition_id: "audition-same-video",
          take_id: "take-duplicate-a",
          take_slot: 1,
          take_label: "Take 1",
          active_take_version_id: "take-version-duplicate-a",
          replaces_take_id: null,
          comparison_run_id: "comparison-same-video",
          compared_take_version_ids: ["take-duplicate-a", "take-duplicate-b"],
          same_video_status: classification.evidence.status,
        },
      },
    });
    if (!composition) throw new Error("expected same-video S10 report model composition");

    expect(composition.full_report_model.comparison.comparison_truth).toMatchObject({
      recommendation_policy: "do_not_pick_winner",
    });
    expect(composition.full_report_model.take_lifecycle).toMatchObject({
      comparison_run_id: "comparison-same-video",
      compared_take_version_ids: ["take-duplicate-a", "take-duplicate-b"],
      same_video_status: "duplicate_in_comparison",
    });
    expect(composition.authenticated_report_model.performer_view_model.comparison_summary).toMatch(
      /same underlying video/i,
    );
  });

  it("preserves the Canary A mandatory blocker in the full/authenticated model", () => {
    const composition = composeS10AuthenticatedReportModel({
      report: buildS10CanaryAReportInput(),
      context: buildS10CanaryAViewContext() as never,
    });
    if (!composition) throw new Error("expected Canary A S10 report model composition");

    expect(composition.full_report_model.recommendation?.decision).toBe(
      "retake_required_if_possible",
    );
    expect(composition.full_report_model.brief.achievement_matrix?.mandatory_status).toBe(
      "blocked",
    );
    expect(composition.full_report_model.fix_hierarchy?.fix_first?.title).toMatch(/Side 1/i);
    expect(validateS10AuthenticatedReportModel(composition.authenticated_report_model)).toEqual({
      ok: true,
    });
  });
});
