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
    expect(v2.s10_view_model?.section_source_map.same_video_status.source).toBe("not_applicable");
  });

  it("does not treat matching hashes as decisive when same-user/same-audition scope IDs are missing", () => {
    const result = classifyS10SameVideoComparison({
      current_take_id: "take-a",
      scope: "same_user_same_audition",
      comparison_present: true,
      compared_takes: [
        {
          take_id: "take-a",
          label: "Take 1",
          original_upload_file_hash: `sha256:${"c".repeat(64)}`,
          file_size_bytes: 111,
          video_duration_ms: 90000,
        },
        {
          take_id: "take-b",
          label: "Take 2",
          original_upload_file_hash: `sha256:${"c".repeat(64)}`,
          file_size_bytes: 111,
          video_duration_ms: 90000,
        },
      ],
    });

    expect(result.evidence.confidence).not.toBe("decisive");
    expect(result.evidence.status).toBe("uncertain");
    expect(result.evidence.limitations.join(" ")).toMatch(/scope IDs are incomplete/i);
    expect(result.comparison_truth.recommendation_policy).toBe("operator_confirmation_required");
  });

  it("records mixed duplicate/distinct comparisons without making the whole comparison a duplicate", () => {
    const result = classifyS10SameVideoComparison({
      current_take_id: "take-a",
      scope: "same_user_same_audition",
      comparison_present: true,
      compared_takes: [
        {
          take_id: "take-a",
          label: "Take 1",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"d".repeat(64)}`,
        },
        {
          take_id: "take-b",
          label: "Take 2 duplicate",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"d".repeat(64)}`,
        },
        {
          take_id: "take-c",
          label: "Take 3 distinct",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"e".repeat(64)}`,
        },
      ],
    });

    expect(result.comparison_truth.comparison_mode).toBe("mixed_same_video_and_distinct_takes");
    expect(result.comparison_truth.recommendation_policy).toBe("compare_distinct_performances");
    expect(result.evidence.status).toBe("possible_duplicate");
    expect(result.evidence.confidence).not.toBe("decisive");
    expect(result.comparison_truth.duplicate_subsets).toEqual([["Take 1", "Take 2 duplicate"]]);
    expect(result.comparison_truth.pairwise_matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ take_b_label: "Take 2 duplicate", relationship: "same_media" }),
        expect.objectContaining({
          take_b_label: "Take 3 distinct",
          relationship: "distinct_media",
        }),
      ]),
    );
  });

  it("detects duplicate subsets that do not include the current take", () => {
    const result = classifyS10SameVideoComparison({
      current_take_id: "take-a",
      scope: "same_user_same_audition",
      comparison_present: true,
      compared_takes: [
        {
          take_id: "take-a",
          label: "Take 1 distinct",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"a".repeat(64)}`,
        },
        {
          take_id: "take-b",
          label: "Take 2 duplicate",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"b".repeat(64)}`,
        },
        {
          take_id: "take-c",
          label: "Take 3 duplicate",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"b".repeat(64)}`,
        },
      ],
    });

    expect(result.comparison_truth.comparison_mode).toBe("mixed_same_video_and_distinct_takes");
    expect(result.comparison_truth.recommendation_policy).toBe("compare_distinct_performances");
    expect(result.comparison_truth.duplicate_subsets).toEqual([
      ["Take 2 duplicate", "Take 3 duplicate"],
    ]);
    expect(result.evidence.matching_take_ids).toEqual([]);
    expect(result.comparison_truth.pairwise_matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          take_a_label: "Take 2 duplicate",
          take_b_label: "Take 3 duplicate",
          relationship: "same_media",
        }),
        expect.objectContaining({
          take_a_label: "Take 1 distinct",
          take_b_label: "Take 2 duplicate",
          relationship: "distinct_media",
        }),
      ]),
    );
    expect(result.comparison_truth.compared_take_summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Take 1 distinct",
          media_identity_summary: "Media identity relationship is not confirmed.",
        }),
        expect.objectContaining({
          label: "Take 2 duplicate",
          media_identity_summary:
            "Appears to share the same underlying video with another compared take.",
        }),
      ]),
    );
  });

  it("does not collapse distinct takes that share the same display label", () => {
    const result = classifyS10SameVideoComparison({
      current_take_id: "take-a",
      scope: "same_user_same_audition",
      comparison_present: true,
      compared_takes: [
        {
          take_id: "take-a",
          label: "Take 1",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"1".repeat(64)}`,
        },
        {
          take_id: "take-b",
          label: "Take 2",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"2".repeat(64)}`,
        },
        {
          take_id: "take-c",
          label: "Take 2",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"3".repeat(64)}`,
        },
      ],
    });

    expect(result.comparison_truth.comparison_mode).toBe("distinct_takes");
    expect(result.comparison_truth.duplicate_subsets).toEqual([]);
    expect(JSON.stringify(result.comparison_truth.pairwise_matches)).not.toContain("take_a_id");
    expect(JSON.stringify(result.comparison_truth.pairwise_matches)).not.toContain("take_b_id");
  });

  it("keeps duplicate subset membership on stable IDs when display labels repeat", () => {
    const result = classifyS10SameVideoComparison({
      current_take_id: "take-a",
      scope: "same_user_same_audition",
      comparison_present: true,
      compared_takes: [
        {
          take_id: "take-a",
          label: "Take 1",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"4".repeat(64)}`,
        },
        {
          take_id: "take-b",
          label: "Take 2",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"4".repeat(64)}`,
        },
        {
          take_id: "take-c",
          label: "Take 2",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"5".repeat(64)}`,
        },
      ],
    });

    expect(result.comparison_truth.comparison_mode).toBe("mixed_same_video_and_distinct_takes");
    expect(result.comparison_truth.duplicate_subsets).toEqual([["Take 1", "Take 2"]]);
    expect(result.comparison_truth.compared_take_summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          take_id: "take-b",
          label: "Take 2",
          media_identity_summary:
            "Appears to share the same underlying video with another compared take.",
        }),
        expect.objectContaining({
          take_id: "take-c",
          label: "Take 2",
          media_identity_summary: "Media identity relationship is not confirmed.",
        }),
      ]),
    );
    expect(JSON.stringify(result.comparison_truth)).not.toContain("sha256:");
  });

  it("uses fallback stable IDs before projecting duplicate subset labels", () => {
    const result = classifyS10SameVideoComparison({
      current_take_id: "analysis-a",
      scope: "same_user_same_audition",
      comparison_present: true,
      compared_takes: [
        {
          analysis_run_id: "analysis-a",
          label: "Take 1",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"6".repeat(64)}`,
        },
        {
          comparison_take_id: "comparison-b",
          label: "Take 2",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"6".repeat(64)}`,
        },
        {
          fixture_stable_id: "fixture-c",
          label: "Take 2",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"7".repeat(64)}`,
        },
      ],
    });

    expect(result.comparison_truth.comparison_mode).toBe("mixed_same_video_and_distinct_takes");
    expect(result.evidence.current_take_id).toBe("analysis-a");
    expect(result.comparison_truth.duplicate_subsets).toEqual([["Take 1", "Take 2"]]);
    expect(result.comparison_truth.compared_take_summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          take_id: "comparison-b",
          label: "Take 2",
          media_identity_summary:
            "Appears to share the same underlying video with another compared take.",
        }),
        expect.objectContaining({
          take_id: "fixture-c",
          label: "Take 2",
          media_identity_summary: "Media identity relationship is not confirmed.",
        }),
      ]),
    );
    expect(JSON.stringify(result.comparison_truth)).not.toContain("sha256:");
  });

  it("keeps whole-comparison no-winner policy only when all compared media match", () => {
    const result = classifyS10SameVideoComparison({
      current_take_id: "take-a",
      scope: "same_user_same_audition",
      comparison_present: true,
      compared_takes: [
        {
          take_id: "take-a",
          label: "Take 1",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"f".repeat(64)}`,
        },
        {
          take_id: "take-b",
          label: "Take 2",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"f".repeat(64)}`,
        },
        {
          take_id: "take-c",
          label: "Take 3",
          user_id: "user-1",
          audition_id: "audition-1",
          original_upload_file_hash: `sha256:${"f".repeat(64)}`,
        },
      ],
    });

    expect(result.evidence.confidence).toBe("decisive");
    expect(result.comparison_truth.comparison_mode).toBe("same_video_duplicate");
    expect(result.comparison_truth.recommendation_policy).toBe("do_not_pick_winner");
    expect(result.comparison_truth.duplicate_subsets).toEqual([["Take 1", "Take 2", "Take 3"]]);
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
