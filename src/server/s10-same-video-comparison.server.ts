import type {
  S10ComparedTakeSummary,
  S10ComparisonDisplayMode,
  S10ComparisonRecommendationPolicy,
  S10ComparisonTruth,
  S10MediaIdentitySignal,
  S10MediaIdentitySignalConfidenceRole,
  S10MediaIdentitySignalName,
  S10SameVideoChangedContext,
  S10SameVideoConfidence,
  S10SameVideoEvidence,
  S10SameVideoStatus,
} from "@/lib/audition-rules";
import { extractUploadIdentitySignals } from "./v3/media-identity-upload-signals.server";

type S10SameVideoScope =
  | "same_user_same_audition"
  | "same_user_same_submission"
  | "operator_confirmed_scope"
  | "broader_scope_explicitly_supported"
  | "unknown";

export type S10SameVideoOperatorConfirmation =
  | "intentional_retest"
  | "accidental_duplicate"
  | "same_video_changed_brief"
  | "same_video_changed_level"
  | "same_video_changed_report_version"
  | "none"
  | "unknown";

export type S10SameVideoTakeIdentityInput = {
  take_id: string;
  label?: string | null;
  user_id?: string | null;
  audition_id?: string | null;
  submission_id?: string | null;
  original_upload_file_hash?: string | null;
  file_size_bytes?: number | string | null;
  video_duration_ms?: number | string | null;
  video_duration_seconds?: number | string | null;
  metadata_file_name?: string | null;
  original_file_name?: string | null;
  mux_asset_id?: string | null;
  mux_playback_id?: string | null;
  mux_upload_id?: string | null;
  safe_media_fingerprint?: string | null;
  opening_video_sample_hash?: string | null;
  closing_video_sample_hash?: string | null;
  opening_audio_profile_hash?: string | null;
  closing_audio_profile_hash?: string | null;
  signals?: unknown;
  checklist?: unknown;
  muxDurationSeconds?: unknown;
};

export type S10SameVideoComparisonInput = {
  current_take_id: string;
  compared_takes: readonly S10SameVideoTakeIdentityInput[];
  scope?: S10SameVideoScope | null;
  operator_confirmation?: S10SameVideoOperatorConfirmation | null;
  brief_changed?: boolean;
  level_changed?: boolean;
  report_version_changed?: boolean;
  comparison_present?: boolean;
};

export type S10SameVideoClassificationResult = {
  evidence: S10SameVideoEvidence;
  comparison_truth: S10ComparisonTruth;
  comparison_display_mode: S10ComparisonDisplayMode;
};

type NormalisedTake = {
  take_id: string;
  label: string;
  user_id: string | null;
  audition_id: string | null;
  submission_id: string | null;
  values: Record<S10MediaIdentitySignalName, string | number | null>;
};

const SIGNAL_ROLES: Record<S10MediaIdentitySignalName, S10MediaIdentitySignalConfidenceRole> = {
  original_upload_file_hash: "decisive",
  file_size_bytes: "medium",
  video_duration_ms: "medium",
  metadata_file_name: "weak",
  original_file_name: "weak",
  mux_asset_id: "medium",
  mux_playback_id: "medium",
  safe_media_fingerprint: "strong",
  opening_video_sample_hash: "strong",
  closing_video_sample_hash: "strong",
  opening_audio_profile_hash: "strong",
  closing_audio_profile_hash: "strong",
};

const SIGNALS = Object.keys(SIGNAL_ROLES) as S10MediaIdentitySignalName[];

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normaliseHash(value: unknown): string | null {
  const text = asText(value)?.toLowerCase();
  if (!text) return null;
  const match = text.match(/^(?:sha256:)?([a-f0-9]{64})$/);
  return match ? `sha256:${match[1]}` : null;
}

function normaliseFileName(value: unknown): string | null {
  const text = asText(value);
  return text ? text.toLowerCase() : null;
}

function normaliseTake(take: S10SameVideoTakeIdentityInput): NormalisedTake {
  const uploadIdentity = extractUploadIdentitySignals({
    signals: take.signals,
    checklist: take.checklist,
    muxDurationSeconds: take.muxDurationSeconds,
  });
  const videoDurationMs =
    asNumber(take.video_duration_ms) ??
    (asNumber(take.video_duration_seconds) != null
      ? Math.round((asNumber(take.video_duration_seconds) ?? 0) * 1000)
      : null) ??
    uploadIdentity.video_duration_ms;

  return {
    take_id: take.take_id,
    label: asText(take.label) ?? take.take_id,
    user_id: asText(take.user_id),
    audition_id: asText(take.audition_id),
    submission_id: asText(take.submission_id),
    values: {
      original_upload_file_hash:
        normaliseHash(take.original_upload_file_hash) ?? uploadIdentity.original_upload_file_hash,
      file_size_bytes: asNumber(take.file_size_bytes) ?? uploadIdentity.file_size_bytes,
      video_duration_ms: videoDurationMs,
      metadata_file_name: normaliseFileName(
        take.metadata_file_name ?? uploadIdentity.metadata_file_name,
      ),
      original_file_name: normaliseFileName(
        take.original_file_name ?? uploadIdentity.original_file_name,
      ),
      mux_asset_id: asText(take.mux_asset_id),
      mux_playback_id: asText(take.mux_playback_id),
      safe_media_fingerprint: asText(take.safe_media_fingerprint),
      opening_video_sample_hash: asText(take.opening_video_sample_hash),
      closing_video_sample_hash: asText(take.closing_video_sample_hash),
      opening_audio_profile_hash: asText(take.opening_audio_profile_hash),
      closing_audio_profile_hash: asText(take.closing_audio_profile_hash),
    },
  };
}

function signalSummary(signal: S10MediaIdentitySignalName, matched: boolean): string {
  switch (signal) {
    case "original_upload_file_hash":
      return matched ? "Matched original upload file hash." : "Original upload file hash differs.";
    case "file_size_bytes":
      return matched ? "File sizes match." : "File sizes differ.";
    case "video_duration_ms":
      return matched ? "Video durations match." : "Video durations differ.";
    case "metadata_file_name":
      return matched ? "Metadata filenames match." : "Metadata filenames differ.";
    case "original_file_name":
      return matched ? "Original filenames match." : "Original filenames differ.";
    case "mux_asset_id":
      return matched ? "Mux asset IDs match." : "Mux asset IDs differ.";
    case "mux_playback_id":
      return matched ? "Mux playback IDs match." : "Mux playback IDs differ.";
    default:
      return matched ? "Media fingerprint signal matches." : "Media fingerprint signal differs.";
  }
}

function compareSignal(
  signal: S10MediaIdentitySignalName,
  current: NormalisedTake,
  others: NormalisedTake[],
): S10MediaIdentitySignal {
  const currentValue = current.values[signal];
  const comparedValues = others.map((take) => take.values[signal]).filter((value) => value != null);
  if (currentValue == null && comparedValues.length === 0) {
    return {
      signal_name: signal,
      status: "unavailable",
      confidence_role: SIGNAL_ROLES[signal],
      safe_value_summary: null,
      value_hash: null,
      source: "upload_identity_or_media_metadata",
      limitation: `${signal} unavailable for this comparison.`,
    };
  }
  if (currentValue == null || comparedValues.length !== others.length) {
    return {
      signal_name: signal,
      status: "inconclusive",
      confidence_role: SIGNAL_ROLES[signal],
      safe_value_summary: null,
      value_hash: null,
      source: "upload_identity_or_media_metadata",
      limitation: `${signal} is only partially available.`,
    };
  }
  const matched = comparedValues.some((value) => value === currentValue);
  return {
    signal_name: signal,
    status: matched ? "matched" : "mismatched",
    confidence_role: SIGNAL_ROLES[signal],
    safe_value_summary: signalSummary(signal, matched),
    value_hash: null,
    source: "upload_identity_or_media_metadata",
    limitation: null,
  };
}

function scopeIsSupported(input: S10SameVideoComparisonInput, takes: NormalisedTake[]): boolean {
  const scope = input.scope ?? "unknown";
  if (scope === "broader_scope_explicitly_supported" || scope === "operator_confirmed_scope") {
    return true;
  }
  if (scope === "same_user_same_submission") {
    const submissionIds = new Set(takes.map((take) => take.submission_id).filter(Boolean));
    const userIds = new Set(takes.map((take) => take.user_id).filter(Boolean));
    return submissionIds.size <= 1 && userIds.size <= 1;
  }
  if (scope === "same_user_same_audition") {
    const auditionIds = new Set(takes.map((take) => take.audition_id).filter(Boolean));
    const userIds = new Set(takes.map((take) => take.user_id).filter(Boolean));
    return auditionIds.size <= 1 && userIds.size <= 1;
  }
  return false;
}

function changedContext(input: S10SameVideoComparisonInput): S10SameVideoChangedContext[] {
  return [
    input.brief_changed ? "changed_brief" : "same_brief",
    input.level_changed ? "changed_level" : "same_level",
    input.report_version_changed ? "changed_report_version" : "same_report_version",
  ];
}

function statusForSameMedia(input: S10SameVideoComparisonInput): S10SameVideoStatus {
  if (input.operator_confirmation === "intentional_retest") return "intentional_retest";
  if (input.operator_confirmation === "same_video_changed_brief" || input.brief_changed) {
    return "same_video_changed_brief";
  }
  if (input.operator_confirmation === "same_video_changed_level" || input.level_changed) {
    return "same_video_changed_level";
  }
  if (
    input.operator_confirmation === "same_video_changed_report_version" ||
    input.report_version_changed
  ) {
    return "same_video_changed_report_version";
  }
  return input.comparison_present === false ? "same_video_confirmed" : "duplicate_in_comparison";
}

function evidenceText(
  status: S10SameVideoStatus,
): Pick<
  S10SameVideoEvidence,
  "performer_facing_summary" | "comparison_warning" | "report_implication"
> {
  switch (status) {
    case "duplicate_in_comparison":
    case "same_video_confirmed":
    case "probable_duplicate":
      return {
        performer_facing_summary: "These takes appear to use the same underlying video.",
        comparison_warning: "Do not treat this as a comparison of different performances.",
        report_implication:
          "Comparison may show report/context differences, but it must not claim a performance winner.",
      };
    case "possible_duplicate":
    case "uncertain":
      return {
        performer_facing_summary:
          "Same-video status is uncertain; comparison should be reviewed carefully.",
        comparison_warning: "Do not make a confident performance-winner recommendation.",
        report_implication:
          "Weak or unavailable media identity signals prevent a confident distinct-performance comparison.",
      };
    case "intentional_retest":
      return {
        performer_facing_summary: "This appears to be a same video retest.",
        comparison_warning: "Treat differences as report or analysis-context differences.",
        report_implication:
          "The rerun is allowed, but the report should not imply the performer changed the take.",
      };
    case "same_video_changed_brief":
      return {
        performer_facing_summary: "Same video judged against a changed brief.",
        comparison_warning: "Compare brief achievement, not performance difference.",
        report_implication:
          "The same media can score differently because the brief context changed.",
      };
    case "same_video_changed_level":
      return {
        performer_facing_summary: "Same video judged at a changed performer level.",
        comparison_warning: "Compare level calibration, not performance difference.",
        report_implication:
          "The same media can receive different level-relative language because the selected level changed.",
      };
    case "same_video_changed_report_version":
      return {
        performer_facing_summary: "Same video rerun after a report version change.",
        comparison_warning: "Compare report output differences only in operator/test context.",
        report_implication:
          "The media and context are unchanged; differences reflect report-version or analysis changes.",
      };
    case "new_media":
      return {
        performer_facing_summary: "These takes appear to use different underlying videos.",
        comparison_warning: null,
        report_implication:
          "Distinct-performance comparison language may be used where otherwise supported.",
      };
  }
}

function recommendationPolicy(status: S10SameVideoStatus): S10ComparisonRecommendationPolicy {
  if (status === "new_media") return "compare_distinct_performances";
  if (
    status === "same_video_changed_brief" ||
    status === "same_video_changed_level" ||
    status === "same_video_changed_report_version" ||
    status === "intentional_retest"
  ) {
    return "compare_contextual_outputs";
  }
  if (status === "possible_duplicate" || status === "uncertain") {
    return "operator_confirmation_required";
  }
  return "do_not_pick_winner";
}

function comparisonMode(status: S10SameVideoStatus): S10ComparisonTruth["comparison_mode"] {
  if (status === "new_media") return "distinct_takes";
  if (status === "intentional_retest") return "same_video_retest";
  if (
    status === "same_video_changed_brief" ||
    status === "same_video_changed_level" ||
    status === "same_video_changed_report_version"
  ) {
    return "same_video_changed_context";
  }
  if (status === "uncertain" || status === "possible_duplicate") return "uncertain";
  return "same_video_duplicate";
}

function displayMode(status: S10SameVideoStatus): S10ComparisonDisplayMode {
  if (status === "new_media") return "single_take";
  if (status === "possible_duplicate" || status === "uncertain") return "comparison_caution";
  if (
    status === "same_video_changed_brief" ||
    status === "same_video_changed_level" ||
    status === "same_video_changed_report_version" ||
    status === "intentional_retest"
  ) {
    return "contextual_comparison";
  }
  return "same_video_notice";
}

function confidenceForStatus(
  status: S10SameVideoStatus,
  hashMatched: boolean,
): S10SameVideoConfidence {
  if (hashMatched) return "decisive";
  if (status === "new_media") return "high";
  if (status === "possible_duplicate") return "medium";
  return "uncertain";
}

function matchingIds(
  signal: S10MediaIdentitySignalName,
  current: NormalisedTake,
  others: NormalisedTake[],
) {
  const currentValue = current.values[signal];
  if (currentValue == null) return [];
  return others.filter((take) => take.values[signal] === currentValue).map((take) => take.take_id);
}

export function classifyS10SameVideoComparison(
  input: S10SameVideoComparisonInput,
): S10SameVideoClassificationResult {
  const takes = input.compared_takes.map(normaliseTake);
  const current = takes.find((take) => take.take_id === input.current_take_id) ?? takes[0];
  const others = takes.filter((take) => take.take_id !== current.take_id);
  const comparedTakeIds = takes.map((take) => take.take_id);
  const limitations: string[] = [];

  if (!current || others.length === 0) {
    const evidence: S10SameVideoEvidence = {
      status: "uncertain",
      confidence: "uncertain",
      compared_take_ids: comparedTakeIds,
      current_take_id: input.current_take_id,
      matching_take_ids: [],
      evidence_signals: [],
      operator_confirmation: input.operator_confirmation ?? null,
      changed_context: ["unknown"],
      report_implication: "Same-video comparison requires at least two takes.",
      performer_facing_summary:
        "Same-video status is uncertain; comparison should be reviewed carefully.",
      comparison_warning: "Do not make a confident performance-winner recommendation.",
      should_compare_as_distinct_performances: false,
      should_reanalyse_against_context: false,
      limitations: ["Same-video comparison requires at least two take identity records."],
    };
    return {
      evidence,
      comparison_truth: {
        comparison_mode: "uncertain",
        compared_take_summaries: [],
        same_video_status: evidence,
        recommendation_policy: "operator_confirmation_required",
        performer_facing_summary: evidence.performer_facing_summary,
        limitations: evidence.limitations,
      },
      comparison_display_mode: "comparison_caution",
    };
  }

  const evidenceSignals = SIGNALS.map((signal) => compareSignal(signal, current, others));
  const supportedScope = scopeIsSupported(input, takes);
  if (!supportedScope) {
    limitations.push(
      "Same-video classification is limited because the comparison scope is not same-user/same-audition, same-user/same-submission, or explicitly supported.",
    );
  }

  const hashSignal = evidenceSignals.find(
    (signal) => signal.signal_name === "original_upload_file_hash",
  );
  const hashMatched = supportedScope && hashSignal?.status === "matched";
  const hashMismatched = supportedScope && hashSignal?.status === "mismatched";
  const weakMatchedCount = evidenceSignals.filter(
    (signal) =>
      signal.status === "matched" &&
      signal.signal_name !== "original_upload_file_hash" &&
      ["file_size_bytes", "video_duration_ms", "metadata_file_name", "original_file_name"].includes(
        signal.signal_name,
      ),
  ).length;
  const fingerprintUnavailable = evidenceSignals.filter(
    (signal) =>
      [
        "safe_media_fingerprint",
        "opening_video_sample_hash",
        "closing_video_sample_hash",
        "opening_audio_profile_hash",
        "closing_audio_profile_hash",
      ].includes(signal.signal_name) && signal.status === "unavailable",
  );
  if (fingerprintUnavailable.length > 0) {
    limitations.push("Opening/closing media fingerprints are unavailable for this comparison.");
  }
  if (hashSignal?.status === "unavailable") {
    limitations.push(
      "Original upload file hash is unavailable, so weak signals cannot confirm duplicate media.",
    );
  }

  let status: S10SameVideoStatus;
  if (!supportedScope) {
    status = "uncertain";
  } else if (hashMatched) {
    status = statusForSameMedia(input);
  } else if (hashMismatched) {
    status = "new_media";
  } else if (weakMatchedCount >= 2) {
    status = "possible_duplicate";
  } else {
    status = "uncertain";
  }

  const text = evidenceText(status);
  const confidence = confidenceForStatus(status, hashMatched);
  const policy = recommendationPolicy(status);
  const matchedIds = hashMatched
    ? matchingIds("original_upload_file_hash", current, others)
    : weakMatchedCount >= 2
      ? Array.from(
          new Set([
            ...matchingIds("file_size_bytes", current, others),
            ...matchingIds("video_duration_ms", current, others),
            ...matchingIds("metadata_file_name", current, others),
            ...matchingIds("original_file_name", current, others),
          ]),
        )
      : [];

  const evidence: S10SameVideoEvidence = {
    status,
    confidence,
    compared_take_ids: comparedTakeIds,
    current_take_id: current.take_id,
    matching_take_ids: matchedIds,
    evidence_signals: evidenceSignals,
    operator_confirmation: input.operator_confirmation ?? null,
    changed_context: changedContext(input),
    report_implication: text.report_implication,
    performer_facing_summary: text.performer_facing_summary,
    comparison_warning: text.comparison_warning,
    should_compare_as_distinct_performances: policy === "compare_distinct_performances",
    should_reanalyse_against_context: policy === "compare_contextual_outputs",
    limitations,
  };

  const takeSummaries: S10ComparedTakeSummary[] = takes.map((take) => ({
    take_id: take.take_id,
    label: take.label,
    media_identity_summary:
      status === "new_media"
        ? "Different media identity from the current take."
        : matchedIds.includes(take.take_id) || take.take_id === current.take_id
          ? "Appears to share the same underlying video."
          : "Media identity relationship is not confirmed.",
    report_context_summary: evidence.changed_context.join(", ").replace(/_/g, " "),
  }));

  const comparisonTruth: S10ComparisonTruth = {
    comparison_mode: comparisonMode(status),
    compared_take_summaries: takeSummaries,
    same_video_status: evidence,
    recommendation_policy: policy,
    performer_facing_summary: text.performer_facing_summary,
    limitations,
  };

  return {
    evidence,
    comparison_truth: comparisonTruth,
    comparison_display_mode: displayMode(status),
  };
}
