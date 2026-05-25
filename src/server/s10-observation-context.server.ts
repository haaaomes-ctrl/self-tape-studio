// SERVER-ONLY. S10 observation context resolver.
//
// This keeps S10.3 observed component evidence available to downstream S10
// modules in both two-step and single-pass runtime paths. It never promotes
// legacy detected_components, raw_report prose, score traces or brief text into
// component evidence.

import type {
  ComponentVerification,
  EvidencePass,
  MediaObservationSummary,
  ObservedTapeSequence,
} from "./evidence-pass.server";
import {
  normaliseS10ComponentVerifications,
  normaliseS10MediaObservationSummary,
  normaliseS10ObservedTapeSequence,
} from "./evidence-pass.server";

export type S10ObservationContextSourceKind =
  | "two_step_s10_observation"
  | "single_pass_s10_observation"
  | "report_embedded_s10_observation"
  | "unavailable";

export type S10ObservationContextWarning = {
  source_kind: Exclude<S10ObservationContextSourceKind, "unavailable">;
  field: string;
  reason: string;
  internal_only: true;
};

export type S10ObservationContext = {
  observed_tape_sequence: ObservedTapeSequence[];
  component_verifications: ComponentVerification[];
  media_observation_summary: MediaObservationSummary;
  source_kind: S10ObservationContextSourceKind;
  limitations: string[];
  contradiction_warnings: S10ObservationContextWarning[];
};

type ObservationCandidate = {
  source_kind: Exclude<S10ObservationContextSourceKind, "unavailable">;
  observed_tape_sequence?: unknown;
  component_verifications?: unknown;
  media_observation_summary?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rawItems(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isPositivePresenceOrCompletion(value: Record<string, unknown>) {
  return (
    value.observed_status === "present" ||
    value.observed_status === "partially_present" ||
    value.present_status === "present" ||
    value.present_status === "partially_present" ||
    value.completion_status === "complete"
  );
}

function isLegacyOrBriefOnlyBasis(value: unknown) {
  return (
    value === "brief_text_only" ||
    value === "legacy_report" ||
    value === "raw_report" ||
    value === "score_trace" ||
    value === "prior_report_prose"
  );
}

function filterComponentVerificationRawItems(
  value: unknown,
  sourceKind: Exclude<S10ObservationContextSourceKind, "unavailable">,
  warnings: S10ObservationContextWarning[],
) {
  return rawItems(value).filter((item, index) => {
    if (item.cannot_infer_from_brief_only !== true) {
      warnings.push({
        source_kind: sourceKind,
        field: `component_verifications[${index}]`,
        reason:
          "S10 component verification missing cannot_infer_from_brief_only=true was rejected.",
        internal_only: true,
      });
      return false;
    }
    if (isLegacyOrBriefOnlyBasis(item.evidence_basis)) {
      warnings.push({
        source_kind: sourceKind,
        field: `component_verifications[${index}]`,
        reason: "S10 component verification sourced from brief/legacy/prose evidence was rejected.",
        internal_only: true,
      });
      return false;
    }
    return true;
  });
}

function normaliseCandidate(candidate: ObservationCandidate): S10ObservationContext {
  const warnings: S10ObservationContextWarning[] = [];
  const rawComponentItems = filterComponentVerificationRawItems(
    candidate.component_verifications,
    candidate.source_kind,
    warnings,
  );
  const rawSequenceItems = rawItems(candidate.observed_tape_sequence).filter((item, index) => {
    if (isLegacyOrBriefOnlyBasis(item.evidence_basis)) {
      warnings.push({
        source_kind: candidate.source_kind,
        field: `observed_tape_sequence[${index}]`,
        reason: "S10 observed tape sequence sourced from brief/legacy/prose evidence was rejected.",
        internal_only: true,
      });
      return false;
    }
    return true;
  });

  const observedTapeSequence = normaliseS10ObservedTapeSequence(rawSequenceItems);
  const componentVerifications = normaliseS10ComponentVerifications(rawComponentItems);
  const mediaObservationSummary = normaliseS10MediaObservationSummary(
    candidate.media_observation_summary,
  );

  const downgradedPositiveClaims = [
    ...rawComponentItems.filter((item) => isPositivePresenceOrCompletion(item)),
    ...rawSequenceItems.filter((item) => isPositivePresenceOrCompletion(item)),
  ].filter(
    (item) => item.observed_from_media !== true || item.evidence_basis !== "observed_audio_video",
  ).length;
  if (downgradedPositiveClaims > 0) {
    warnings.push({
      source_kind: candidate.source_kind,
      field: "s10_observation_context",
      reason:
        "Positive component presence/completion claims without observed audio/video evidence were downgraded by S10.3 normalisation.",
      internal_only: true,
    });
  }

  return {
    observed_tape_sequence: observedTapeSequence,
    component_verifications: componentVerifications,
    media_observation_summary: mediaObservationSummary,
    source_kind: candidate.source_kind,
    limitations:
      componentVerifications.length > 0 || observedTapeSequence.length > 0
        ? []
        : ["Component verification was unavailable for this S10 report."],
    contradiction_warnings: warnings,
  };
}

function hasComponentObservationData(context: S10ObservationContext) {
  return context.component_verifications.length > 0 || context.observed_tape_sequence.length > 0;
}

function hasMediaObservationSummary(context: S10ObservationContext) {
  return (
    context.media_observation_summary.duration_summary.length > 0 ||
    context.media_observation_summary.uncertainties.length > 0 ||
    context.media_observation_summary.audio_assessable != null ||
    context.media_observation_summary.video_assessable != null ||
    context.media_observation_summary.framing_assessable != null
  );
}

export function resolveS10ObservationContext(input: {
  twoStepEvidence?: EvidencePass | null;
  singlePassOutput?: Record<string, unknown> | null;
  report?: Record<string, unknown> | null;
}): S10ObservationContext {
  const candidates: ObservationCandidate[] = [];
  if (input.twoStepEvidence) {
    candidates.push({
      source_kind: "two_step_s10_observation",
      observed_tape_sequence: input.twoStepEvidence.observed_tape_sequence,
      component_verifications: input.twoStepEvidence.component_verifications,
      media_observation_summary: input.twoStepEvidence.media_observation_summary,
    });
  }
  if (input.singlePassOutput) {
    candidates.push({
      source_kind: "single_pass_s10_observation",
      observed_tape_sequence: input.singlePassOutput.observed_tape_sequence,
      component_verifications: input.singlePassOutput.component_verifications,
      media_observation_summary: input.singlePassOutput.media_observation_summary,
    });
  }
  if (input.report && input.report !== input.singlePassOutput) {
    candidates.push({
      source_kind: "report_embedded_s10_observation",
      observed_tape_sequence: input.report.observed_tape_sequence,
      component_verifications: input.report.component_verifications,
      media_observation_summary: input.report.media_observation_summary,
    });
  }

  const warnings: S10ObservationContextWarning[] = [];
  let firstMediaOnlyContext: S10ObservationContext | null = null;
  for (const candidate of candidates) {
    const context = normaliseCandidate(candidate);
    warnings.push(...context.contradiction_warnings);
    if (hasComponentObservationData(context)) {
      return { ...context, contradiction_warnings: warnings };
    }
    if (!firstMediaOnlyContext && hasMediaObservationSummary(context)) {
      firstMediaOnlyContext = context;
    }
  }

  if (firstMediaOnlyContext) {
    return {
      observed_tape_sequence: [],
      component_verifications: [],
      media_observation_summary: firstMediaOnlyContext.media_observation_summary,
      source_kind: "unavailable",
      limitations: ["Component verification was unavailable for this S10 report."],
      contradiction_warnings: warnings,
    };
  }

  return {
    observed_tape_sequence: [],
    component_verifications: [],
    media_observation_summary: normaliseS10MediaObservationSummary(null),
    source_kind: "unavailable",
    limitations: ["Component verification was unavailable for this S10 report."],
    contradiction_warnings: warnings,
  };
}
