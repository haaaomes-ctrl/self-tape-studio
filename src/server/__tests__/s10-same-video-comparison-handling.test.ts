import { describe, expect, it } from "vitest";
import { buildV2Report, validateV2PublicBoundary } from "@/server/v2-report-builder.server";
import { classifyS10SameVideoComparison } from "@/server/s10-same-video-comparison.server";
import {
  s10SameVideoComparisonFixtures,
  buildS10SameVideoBaseReportInput,
  buildS10SameVideoBaseViewContext,
} from "@/test-fixtures/s10-same-video-comparison";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

function classify(key: keyof typeof s10SameVideoComparisonFixtures) {
  return classifyS10SameVideoComparison(s10SameVideoComparisonFixtures[key].input);
}

function buildSameVideoV2(key: keyof typeof s10SameVideoComparisonFixtures) {
  const result = classify(key);
  return buildV2Report({
    legacyReport: buildS10SameVideoBaseReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: {
      ...buildS10SameVideoBaseViewContext(),
      sameVideoEvidence: result.evidence,
      comparisonTruth: result.comparison_truth,
      comparisonDisplayMode: result.comparison_display_mode,
    } as never,
  });
}

describe("S10.13 same-video and comparison handling", () => {
  it("treats matching upload hash as decisive same-media evidence within scope", () => {
    const result = classify("accidentalDuplicate");

    expect(result.evidence.status).toBe("duplicate_in_comparison");
    expect(result.evidence.confidence).toBe("decisive");
    expect(result.evidence.matching_take_ids).toContain("take-duplicate-b");
    expect(result.evidence.should_compare_as_distinct_performances).toBe(false);
    expect(result.comparison_truth.recommendation_policy).toBe("do_not_pick_winner");
    expect(result.comparison_truth.comparison_mode).toBe("same_video_duplicate");
    expect(result.evidence.performer_facing_summary).toContain("same underlying video");
  });

  it("keeps weak identity signals below decisive confirmation", () => {
    const result = classify("uncertainWeakSignals");

    expect(result.evidence.status).toBe("possible_duplicate");
    expect(result.evidence.confidence).not.toBe("decisive");
    expect(result.comparison_truth.recommendation_policy).toBe("operator_confirmation_required");
    expect(result.evidence.should_compare_as_distinct_performances).toBe(false);
    expect(result.evidence.limitations.join(" ")).toMatch(/hash is unavailable/i);
  });

  it("labels retest and changed-context same-media reruns without claiming performance changes", () => {
    const retest = classify("intentionalRetest");
    const changedBrief = classify("changedBrief");
    const changedLevel = classify("changedLevel");
    const changedReport = classify("changedReportVersion");

    expect(retest.evidence.status).toBe("intentional_retest");
    expect(retest.comparison_truth.recommendation_policy).toBe("compare_contextual_outputs");
    expect(retest.evidence.comparison_warning).toMatch(/report or analysis-context/i);

    expect(changedBrief.evidence.status).toBe("same_video_changed_brief");
    expect(changedBrief.evidence.performer_facing_summary).toContain("changed brief");
    expect(changedBrief.evidence.comparison_warning).toMatch(/brief achievement/i);

    expect(changedLevel.evidence.status).toBe("same_video_changed_level");
    expect(changedLevel.evidence.performer_facing_summary).toContain("changed performer level");
    expect(changedLevel.evidence.comparison_warning).toMatch(/level calibration/i);

    expect(changedReport.evidence.status).toBe("same_video_changed_report_version");
    expect(changedReport.evidence.performer_facing_summary).toContain("report version change");
    expect(changedReport.evidence.comparison_warning).toMatch(/report output differences/i);
  });

  it("allows distinct-performance comparison only for distinct media evidence", () => {
    const result = classify("distinctMedia");

    expect(result.evidence.status).toBe("new_media");
    expect(result.evidence.should_compare_as_distinct_performances).toBe(true);
    expect(result.comparison_truth.recommendation_policy).toBe("compare_distinct_performances");
  });

  it("does not let raw report comparison prose or legacy fields override S10 truth", () => {
    const legacy = {
      ...buildS10SameVideoBaseReportInput(),
      comparison_summary: "Take 2 is the stronger performance. Use Take 2.",
      raw_report: {
        comparison_summary: "Take 2 is the stronger performance. Use Take 2.",
      },
    };
    const snapshot = JSON.stringify(legacy);
    const result = classify("accidentalDuplicate");
    const v2 = buildV2Report({
      legacyReport: legacy,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: {
        ...buildS10SameVideoBaseViewContext(),
        sameVideoEvidence: result.evidence,
        comparisonTruth: result.comparison_truth,
        comparisonDisplayMode: result.comparison_display_mode,
      } as never,
    });

    expect(JSON.stringify(legacy)).toBe(snapshot);
    expect(v2.s10_view_model?.comparison_truth?.recommendation_policy).toBe("do_not_pick_winner");
    expect(JSON.stringify(v2)).not.toContain("Take 2 is the stronger performance");
    expect(JSON.stringify(v2)).not.toContain("Use Take 2");
  });

  it("routes same-video and comparison truth through the S10 view-model source map", () => {
    const v2 = buildSameVideoV2("accidentalDuplicate");

    expect(v2.s10_view_model?.section_source_map.same_video_status.source).toBe(
      "s10_authoritative_module",
    );
    expect(v2.s10_view_model?.section_source_map.comparison_truth.source).toBe(
      "s10_authoritative_module",
    );
    expect(v2.s10_view_model?.section_source_map.same_video_status.module).not.toMatch(
      /raw_report/i,
    );
    expect(v2.s10_view_model?.section_source_map.comparison_truth.module).not.toMatch(
      /raw_report/i,
    );
    expect(JSON.stringify(v2)).not.toContain("sha256:");
    expect(JSON.stringify(v2)).not.toContain("value_hash");
    expect(validateV2PublicBoundary(v2, buildS10SameVideoBaseReportInput()).ok).toBe(true);
  });

  it("keeps ordinary single-take reports free of same-video comparison messaging", () => {
    const v2 = buildV2Report({
      legacyReport: buildS10StrongCompleteProfessionalReportInput(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
    });

    expect(v2.s10_view_model?.comparison_display_mode).toBe("hidden");
    expect(v2.s10_view_model?.same_video_status).toBeNull();
    expect(v2.s10_view_model?.comparison_truth).toBeNull();
    expect(v2.s10_view_model?.section_source_map.same_video_status.source).toBe("unsupported");
  });

  it("preserves Canary A and strong-complete fixture polarity", () => {
    const canary = buildV2Report({
      legacyReport: buildS10CanaryAReportInput(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    const strong = buildV2Report({
      legacyReport: buildS10StrongCompleteProfessionalReportInput(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
    });
    const duplicate = buildSameVideoV2("accidentalDuplicate");

    expect(canary.s10_view_model?.recommendation?.decision).toBe("retake_required_if_possible");
    expect(strong.s10_view_model?.recommendation?.decision).toBe("submit");
    expect(duplicate.s10_view_model?.recommendation?.decision).toBe("submit");
    expect(duplicate.s10_view_model?.comparison_truth?.recommendation_policy).toBe(
      "do_not_pick_winner",
    );
  });
});
