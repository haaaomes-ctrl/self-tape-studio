import type {
  S10ComparedTakeSummary,
  S10ComparisonDisplayMode,
  S10ComparisonRecommendationPolicy,
  S10ComparisonTruth,
  S10MediaIdentitySignal,
  S10MediaIdentitySignalConfidenceRole,
  S10MediaIdentitySignalName,
  S10PairwiseSameVideoMatch,
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

type InternalPairwiseSameVideoMatch = S10PairwiseSameVideoMatch & {
  take_a_id: string;
  take_b_id: string;
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
  const matchedCount = comparedValues.filter((value) => value === currentValue).length;
  if (matchedCount > 0 && matchedCount < comparedValues.length) {
    return {
      signal_name: signal,
      status: "inconclusive",
      confidence_role: SIGNAL_ROLES[signal],
      safe_value_summary: `${signal} matches only a subset of compared takes.`,
      value_hash: null,
      source: "upload_identity_or_media_metadata",
      limitation: `${signal} matches only a subset of compared takes.`,
    };
  }
  const matched = matchedCount === comparedValues.length;
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

function scopeSupport(
  input: S10SameVideoComparisonInput,
  takes: NormalisedTake[],
): { supported: boolean; limitation: string | null } {
  const scope = input.scope ?? "unknown";
  if (scope === "broader_scope_explicitly_supported" || scope === "operator_confirmed_scope") {
    return { supported: true, limitation: null };
  }
  if (scope === "same_user_same_submission") {
    const missing = takes.some((take) => !take.user_id || !take.submission_id);
    const submissionIds = new Set(takes.map((take) => take.submission_id));
    const userIds = new Set(takes.map((take) => take.user_id));
    const supported = !missing && submissionIds.size === 1 && userIds.size === 1;
    return {
      supported,
      limitation: supported
        ? null
        : missing
          ? "Same-video classification is limited because same-user/same-submission scope IDs are incomplete."
          : "Same-video classification is limited because the compared takes are not in one confirmed same-user/same-submission scope.",
    };
  }
  if (scope === "same_user_same_audition") {
    const missing = takes.some((take) => !take.user_id || !take.audition_id);
    const auditionIds = new Set(takes.map((take) => take.audition_id));
    const userIds = new Set(takes.map((take) => take.user_id));
    const supported = !missing && auditionIds.size === 1 && userIds.size === 1;
    return {
      supported,
      limitation: supported
        ? null
        : missing
          ? "Same-video classification is limited because same-user/same-audition scope IDs are incomplete."
          : "Same-video classification is limited because the compared takes are not in one confirmed same-user/same-audition scope.",
    };
  }
  return {
    supported: false,
    limitation:
      "Same-video classification is limited because the comparison scope is not same-user/same-audition, same-user/same-submission, or explicitly supported.",
  };
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

function pairwiseSignals(
  current: NormalisedTake,
  other: NormalisedTake,
): {
  relationship: S10PairwiseSameVideoMatch["relationship"];
  confidence: S10SameVideoConfidence;
  signals: S10MediaIdentitySignalName[];
  limitations: string[];
} {
  const currentHash = current.values.original_upload_file_hash;
  const otherHash = other.values.original_upload_file_hash;
  if (currentHash != null && otherHash != null) {
    return currentHash === otherHash
      ? {
          relationship: "same_media",
          confidence: "decisive",
          signals: ["original_upload_file_hash"],
          limitations: [],
        }
      : {
          relationship: "distinct_media",
          confidence: "high",
          signals: ["original_upload_file_hash"],
          limitations: [],
        };
  }

  const weakMatches = [
    "file_size_bytes",
    "video_duration_ms",
    "metadata_file_name",
    "original_file_name",
  ].filter((signal): signal is S10MediaIdentitySignalName => {
    const currentValue = current.values[signal as S10MediaIdentitySignalName];
    return (
      currentValue != null && currentValue === other.values[signal as S10MediaIdentitySignalName]
    );
  });

  if (weakMatches.length >= 2) {
    return {
      relationship: "possible_duplicate",
      confidence: "medium",
      signals: weakMatches,
      limitations: [
        "Only supporting media identity signals match; original upload hash is unavailable.",
      ],
    };
  }

  return {
    relationship: "uncertain",
    confidence: "uncertain",
    signals: weakMatches,
    limitations: ["Pairwise media identity is uncertain from the available signals."],
  };
}

function buildPairwiseMatches(
  takes: NormalisedTake[],
  supportedScope: boolean,
  scopeLimitation: string | null,
): InternalPairwiseSameVideoMatch[] {
  const matches: InternalPairwiseSameVideoMatch[] = [];
  for (let i = 0; i < takes.length; i += 1) {
    for (let j = i + 1; j < takes.length; j += 1) {
      const takeA = takes[i];
      const takeB = takes[j];
      if (!takeA || !takeB) continue;
      if (!supportedScope) {
        matches.push({
          take_a_id: takeA.take_id,
          take_b_id: takeB.take_id,
          take_a_label: takeA.label,
          take_b_label: takeB.label,
          relationship: "uncertain",
          confidence: "uncertain",
          matching_signal_names: [],
          limitations: [scopeLimitation ?? "Pairwise comparison scope is not confirmed."],
        });
        continue;
      }
      const result = pairwiseSignals(takeA, takeB);
      matches.push({
        take_a_id: takeA.take_id,
        take_b_id: takeB.take_id,
        take_a_label: takeA.label,
        take_b_label: takeB.label,
        relationship: result.relationship,
        confidence: result.confidence,
        matching_signal_names: result.signals,
        limitations: result.limitations,
      });
    }
  }
  return matches;
}

function duplicateSubsetsFromPairs(
  takes: NormalisedTake[],
  sameMediaPairs: InternalPairwiseSameVideoMatch[],
): string[][] {
  const ids = new Set(takes.map((take) => take.take_id));
  const labelsById = new Map(takes.map((take) => [take.take_id, take.label] as const));
  const parent = new Map<string, string>();
  for (const id of ids) parent.set(id, id);

  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return current;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (a: string, b: string) => {
    if (!ids.has(a) || !ids.has(b)) return;
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (const pair of sameMediaPairs) union(pair.take_a_id, pair.take_b_id);

  const components = new Map<string, string[]>();
  for (const take of takes) {
    const root = find(take.take_id);
    const group = components.get(root) ?? [];
    group.push(labelsById.get(take.take_id) ?? take.label);
    components.set(root, group);
  }

  return Array.from(components.values()).filter((group) => group.length > 1);
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
        pairwise_matches: [],
        duplicate_subsets: [],
      },
      comparison_display_mode: "comparison_caution",
    };
  }

  const evidenceSignals = SIGNALS.map((signal) => compareSignal(signal, current, others));
  const scope = scopeSupport(input, takes);
  const supportedScope = scope.supported;
  const pairwiseMatches = buildPairwiseMatches(takes, supportedScope, scope.limitation);
  const sameMediaPairs = pairwiseMatches.filter((match) => match.relationship === "same_media");
  const distinctMediaPairs = pairwiseMatches.filter(
    (match) => match.relationship === "distinct_media",
  );
  const duplicateSubsets = duplicateSubsetsFromPairs(takes, sameMediaPairs);
  const allComparedMediaMatches =
    takes.length > 1 && duplicateSubsets.some((subset) => subset.length === takes.length);
  const mixedSameAndDistinct = sameMediaPairs.length > 0 && distinctMediaPairs.length > 0;
  if (!supportedScope) {
    limitations.push(scope.limitation ?? "Same-video comparison scope is not confirmed.");
  }

  const hashSignal = evidenceSignals.find(
    (signal) => signal.signal_name === "original_upload_file_hash",
  );
  const hashMatched = supportedScope && hashSignal?.status === "matched" && allComparedMediaMatches;
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
  if (mixedSameAndDistinct) {
    status = "possible_duplicate";
    limitations.push(
      "Some compared takes appear to share the same media while at least one compared take appears distinct.",
    );
  } else if (!supportedScope) {
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

  const mixedText = mixedSameAndDistinct
    ? {
        performer_facing_summary:
          "Some compared takes appear to use the same underlying video, while at least one compared take appears to use different media.",
        comparison_warning: "Do not treat the duplicate subset as different performances.",
        report_implication:
          "Duplicate subsets should be labelled, but distinct media may still support distinct-performance comparison.",
      }
    : null;
  const text = mixedText ?? evidenceText(status);
  const confidence = confidenceForStatus(status, hashMatched);
  const policy = mixedSameAndDistinct
    ? "compare_distinct_performances"
    : recommendationPolicy(status);
  const matchedIds = hashMatched
    ? matchingIds("original_upload_file_hash", current, others)
    : sameMediaPairs.length > 0
      ? others
          .filter((take) =>
            sameMediaPairs.some(
              (match) =>
                (match.take_a_id === current.take_id && match.take_b_id === take.take_id) ||
                (match.take_b_id === current.take_id && match.take_a_id === take.take_id),
            ),
          )
          .map((take) => take.take_id)
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

  const takeSummaries: S10ComparedTakeSummary[] = takes.map((take) => {
    const duplicateSubset = duplicateSubsets.find((subset) => subset.includes(take.label));
    return {
      take_id: take.take_id,
      label: take.label,
      media_identity_summary:
        status === "new_media"
          ? "Different media identity from the current take."
          : duplicateSubset
            ? "Appears to share the same underlying video with another compared take."
            : "Media identity relationship is not confirmed.",
      report_context_summary: evidence.changed_context.join(", ").replace(/_/g, " "),
    };
  });

  const comparisonTruth: S10ComparisonTruth = {
    comparison_mode: mixedSameAndDistinct
      ? "mixed_same_video_and_distinct_takes"
      : comparisonMode(status),
    compared_take_summaries: takeSummaries,
    same_video_status: evidence,
    recommendation_policy: policy,
    performer_facing_summary: text.performer_facing_summary,
    limitations,
    pairwise_matches: pairwiseMatches.map(({ take_a_id, take_b_id, ...match }) => match),
    duplicate_subsets: duplicateSubsets,
  };

  return {
    evidence,
    comparison_truth: comparisonTruth,
    comparison_display_mode: mixedSameAndDistinct ? "comparison_caution" : displayMode(status),
  };
}
