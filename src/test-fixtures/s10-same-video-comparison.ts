import type {
  S10ComparisonRecommendationPolicy,
  S10OperatorAssumptionCheckpoint,
  S10OperatorDeclaredFixtureType,
  S10OperatorExpectation,
  S10OperatorRerunIntent,
  S10OperatorSameMediaIdentity,
  S10SameVideoStatus,
} from "@/lib/audition-rules";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "./s10-strong-complete-professional";

const SAME_HASH = `sha256:${"a".repeat(64)}`;
const OTHER_HASH = `sha256:${"b".repeat(64)}`;

const baseTake = {
  user_id: "user-s10-same-video",
  audition_id: "audition-s10-same-video",
  submission_id: "submission-s10-same-video",
  file_size_bytes: 12345678,
  video_duration_ms: 135000,
  metadata_file_name: "LASTNAME_FIRSTNAME_STRONG.mp4",
  original_file_name: "LASTNAME_FIRSTNAME_STRONG.mp4",
} as const;

function checkpoint(input: {
  id: string;
  fixtureType: S10OperatorDeclaredFixtureType;
  sameMediaIdentity: S10OperatorSameMediaIdentity;
  rerunIntent: S10OperatorRerunIntent;
  expectedOutcome: string;
  comparisonContext: string;
  changedBrief?: boolean;
  changedLevel?: boolean;
  changedReportVersion?: boolean;
  confidence?: S10OperatorAssumptionCheckpoint["confidence"];
}): S10OperatorAssumptionCheckpoint {
  return {
    checkpoint_id: `s10-same-video-${input.id}-checkpoint`,
    fixture_id: `s10-same-video-${input.id}`,
    take_id: null,
    audition_id: "audition-s10-same-video",
    report_context: "S10 deterministic same-video comparison fixture",
    declared_fixture_type: input.fixtureType,
    declared_expected_outcome: input.expectedOutcome,
    same_brief_confirmed: input.changedBrief ? false : true,
    same_video_confirmed: input.sameMediaIdentity === "confirmed",
    same_media_identity: input.sameMediaIdentity,
    rerun_intent: input.rerunIntent,
    strong_complete_take_confirmed: null,
    incomplete_mandatory_package_confirmed: null,
    expected_primary_blocker: null,
    expected_secondary_notes: [],
    score_chips_intentionally_visible: true,
    comparison_chips_intentionally_visible: true,
    comparison_context: input.comparisonContext,
    changed_brief_confirmed: input.changedBrief ?? false,
    changed_level_confirmed: input.changedLevel ?? false,
    changed_report_version_confirmed: input.changedReportVersion ?? false,
    operator_notes: [
      "Same-video fixture separates media identity from rerun reason and report comparison.",
    ],
    created_by_role: "test",
    created_at: "2026-05-24T00:00:00.000Z",
    confidence: input.confidence ?? "confirmed",
    scope: "deterministic_fixture",
  };
}

function expectation(input: {
  status: S10SameVideoStatus;
  policy: S10ComparisonRecommendationPolicy;
  required: string;
}): S10OperatorExpectation {
  return {
    expected_recommendation: null,
    expected_brief_achievement_status: null,
    expected_missing_requirements: [],
    expected_present_requirements: [],
    expected_not_assessable_areas: [],
    expected_fix_first: null,
    expected_score_band: null,
    expected_same_video_status: input.status,
    expected_comparison_policy: input.policy,
    expected_forbidden_phrases: [
      "Take 1 is the stronger performance",
      "Take 2 is the stronger performance",
      "Use Take 1",
      "Use Take 2",
      "clear winner",
      "better performance",
    ],
    expected_required_phrases: [input.required],
  };
}

export const s10SameVideoComparisonFixtures = {
  accidentalDuplicate: {
    input: {
      current_take_id: "take-duplicate-a",
      scope: "same_user_same_audition",
      operator_confirmation: "none",
      comparison_present: true,
      compared_takes: [
        {
          ...baseTake,
          take_id: "take-duplicate-a",
          label: "Take 1",
          original_upload_file_hash: SAME_HASH,
        },
        {
          ...baseTake,
          take_id: "take-duplicate-b",
          label: "Take 2",
          original_upload_file_hash: SAME_HASH,
        },
      ],
    },
    expected: {
      status: "duplicate_in_comparison",
      policy: "do_not_pick_winner",
      summary: "These takes appear to use the same underlying video.",
    },
    checkpoint: checkpoint({
      id: "accidental-duplicate",
      fixtureType: "same_video_duplicate",
      sameMediaIdentity: "confirmed",
      rerunIntent: "accidental_duplicate",
      expectedOutcome: "Same media duplicate comparison with no performance winner.",
      comparisonContext: "accidental duplicate",
    }),
    expectation: expectation({
      status: "duplicate_in_comparison",
      policy: "do_not_pick_winner",
      required: "same underlying video|different performances",
    }),
  },
  intentionalRetest: {
    input: {
      current_take_id: "take-retest-a",
      scope: "same_user_same_audition",
      operator_confirmation: "intentional_retest",
      comparison_present: true,
      compared_takes: [
        {
          ...baseTake,
          take_id: "take-retest-a",
          label: "Canary rerun 1",
          original_upload_file_hash: SAME_HASH,
        },
        {
          ...baseTake,
          take_id: "take-retest-b",
          label: "Canary rerun 2",
          original_upload_file_hash: SAME_HASH,
        },
      ],
    },
    expected: {
      status: "intentional_retest",
      policy: "compare_contextual_outputs",
      summary: "This appears to be a same video retest.",
    },
    checkpoint: checkpoint({
      id: "intentional-retest",
      fixtureType: "same_video_retest",
      sameMediaIdentity: "confirmed",
      rerunIntent: "intentional_retest",
      expectedOutcome: "Intentional same-media retest compares report/context, not performance.",
      comparisonContext: "operator/test intentional retest",
    }),
    expectation: expectation({
      status: "intentional_retest",
      policy: "compare_contextual_outputs",
      required: "same video retest|report or analysis-context",
    }),
  },
  changedBrief: {
    input: {
      current_take_id: "take-brief-a",
      scope: "same_user_same_audition",
      operator_confirmation: "same_video_changed_brief",
      brief_changed: true,
      comparison_present: true,
      compared_takes: [
        {
          ...baseTake,
          take_id: "take-brief-a",
          label: "Original brief",
          original_upload_file_hash: SAME_HASH,
        },
        {
          ...baseTake,
          take_id: "take-brief-b",
          label: "Changed brief",
          original_upload_file_hash: SAME_HASH,
        },
      ],
    },
    expected: {
      status: "same_video_changed_brief",
      policy: "compare_contextual_outputs",
      summary: "Same video judged against a changed brief.",
    },
    checkpoint: checkpoint({
      id: "changed-brief",
      fixtureType: "same_video_changed_brief",
      sameMediaIdentity: "confirmed",
      rerunIntent: "changed_brief",
      expectedOutcome: "Same media judged against a changed brief.",
      comparisonContext: "changed brief",
      changedBrief: true,
    }),
    expectation: expectation({
      status: "same_video_changed_brief",
      policy: "compare_contextual_outputs",
      required: "changed brief|brief achievement",
    }),
  },
  changedLevel: {
    input: {
      current_take_id: "take-level-a",
      scope: "same_user_same_audition",
      operator_confirmation: "same_video_changed_level",
      level_changed: true,
      comparison_present: true,
      compared_takes: [
        {
          ...baseTake,
          take_id: "take-level-a",
          label: "Advanced level",
          original_upload_file_hash: SAME_HASH,
        },
        {
          ...baseTake,
          take_id: "take-level-b",
          label: "Professional level",
          original_upload_file_hash: SAME_HASH,
        },
      ],
    },
    expected: {
      status: "same_video_changed_level",
      policy: "compare_contextual_outputs",
      summary: "Same video judged at a changed performer level.",
    },
    checkpoint: checkpoint({
      id: "changed-level",
      fixtureType: "same_video_changed_level",
      sameMediaIdentity: "confirmed",
      rerunIntent: "changed_level",
      expectedOutcome: "Same media judged at a changed performer level.",
      comparisonContext: "changed level",
      changedLevel: true,
    }),
    expectation: expectation({
      status: "same_video_changed_level",
      policy: "compare_contextual_outputs",
      required: "changed performer level|level calibration",
    }),
  },
  changedReportVersion: {
    input: {
      current_take_id: "take-report-a",
      scope: "same_user_same_audition",
      operator_confirmation: "same_video_changed_report_version",
      report_version_changed: true,
      comparison_present: true,
      compared_takes: [
        {
          ...baseTake,
          take_id: "take-report-a",
          label: "S10.12 report",
          original_upload_file_hash: SAME_HASH,
        },
        {
          ...baseTake,
          take_id: "take-report-b",
          label: "S10.13 report",
          original_upload_file_hash: SAME_HASH,
        },
      ],
    },
    expected: {
      status: "same_video_changed_report_version",
      policy: "compare_contextual_outputs",
      summary: "Same video rerun after a report version change.",
    },
    checkpoint: checkpoint({
      id: "changed-report-version",
      fixtureType: "same_video_changed_report_version",
      sameMediaIdentity: "confirmed",
      rerunIntent: "changed_report_version",
      expectedOutcome: "Same media rerun after report version change.",
      comparisonContext: "changed report version",
      changedReportVersion: true,
    }),
    expectation: expectation({
      status: "same_video_changed_report_version",
      policy: "compare_contextual_outputs",
      required: "report version change|report output differences",
    }),
  },
  uncertainWeakSignals: {
    input: {
      current_take_id: "take-uncertain-a",
      scope: "same_user_same_audition",
      operator_confirmation: "unknown",
      comparison_present: true,
      compared_takes: [
        {
          ...baseTake,
          take_id: "take-uncertain-a",
          label: "Take 1",
          original_upload_file_hash: null,
        },
        {
          ...baseTake,
          take_id: "take-uncertain-b",
          label: "Take 2",
          original_upload_file_hash: null,
        },
      ],
    },
    expected: {
      status: "possible_duplicate",
      policy: "operator_confirmation_required",
      summary: "Same-video status is uncertain; comparison should be reviewed carefully.",
    },
    checkpoint: checkpoint({
      id: "uncertain-weak-signals",
      fixtureType: "same_video_uncertain",
      sameMediaIdentity: "possible",
      rerunIntent: "unknown",
      expectedOutcome: "Weak-signal possible duplicate remains uncertain.",
      comparisonContext: "uncertain possible duplicate",
      confidence: "likely",
    }),
    expectation: expectation({
      status: "possible_duplicate",
      policy: "operator_confirmation_required",
      required: "status is uncertain|reviewed carefully",
    }),
  },
  distinctMedia: {
    input: {
      current_take_id: "take-distinct-a",
      scope: "same_user_same_audition",
      operator_confirmation: "none",
      comparison_present: true,
      compared_takes: [
        {
          ...baseTake,
          take_id: "take-distinct-a",
          label: "Take 1",
          original_upload_file_hash: SAME_HASH,
        },
        {
          ...baseTake,
          take_id: "take-distinct-b",
          label: "Take 2",
          original_upload_file_hash: OTHER_HASH,
          file_size_bytes: 22345678,
          video_duration_ms: 142000,
        },
      ],
    },
    expected: {
      status: "new_media",
      policy: "compare_distinct_performances",
      summary: "These takes appear to use different underlying videos.",
    },
  },
} as const;

export function buildS10SameVideoBaseReportInput() {
  return buildS10StrongCompleteProfessionalReportInput();
}

export function buildS10SameVideoBaseViewContext() {
  return buildS10StrongCompleteProfessionalViewContext();
}
