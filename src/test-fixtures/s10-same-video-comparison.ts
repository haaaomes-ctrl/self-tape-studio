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
