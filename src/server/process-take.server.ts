// SERVER-ONLY module. Vite's import-protection blocks any client bundle from
// importing this file. It must NEVER be imported from a component, route
// loader, or any *.functions.ts client-callable surface other than via a
// thin authenticated wrapper that performs ownership checks.
//
// Callers (trusted server code only):
//   - src/routes/api/public/mux-webhook.ts (after Mux signature verification)
//   - src/server/process-take.functions.ts -> retryProcessTake (after auth + ownership)
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildMuxHighestMp4Url, isValidMuxMp4Url, normaliseMuxMp4Url } from "./mux.server";
import { deriveS10BriefRuntimeFacts, extractBriefFromText } from "./extract-brief.server";
import { metric, TEN_MINUTES_MS } from "./metrics.server";
import { isCircuitOpen, recordAiFailure } from "./ai-circuit-breaker.server";
import { extractAiTokenUsage, recordTakeAiUsage, type TakeAiUsageContext } from "./ai-usage.server";
import {
  runEvidencePass,
  filterRunEvidencePassForStep1,
  summariseEvidence,
  type EvidencePass,
} from "./evidence-pass.server";
import {
  runReportPolish,
  enforceLockedFields,
  enforceUnsupportedClaims,
  enforceScoreAlignment,
  isRecoverableReportPolishResponseShapeError,
  buildS10ModuleRepairRetryInstruction,
  REPORT_POLISH_JSON_OBJECT_RETRY_INSTRUCTION,
  type VerdictLabel,
} from "./report-polish.server";
import {
  applyS10ResidualModuleRecovery,
  buildS10ModuleQualityRecoveryReport,
  buildS10ReportPolishFallback,
} from "./s10-report-polish-fallback.server";
import { cleanupMuxAssetForCompletedTake } from "./mux-cleanup.server";
import {
  emitAnalysisEvidenceStatePrerequisite,
  emitAnalysisInputArtefacts,
  emitClaimCandidateTrace,
  emitEvidenceAnchorsFirstPass,
  emitModelRunTraceFirstPass,
  emitNoExportProofBundle,
  emitPublicClaimTraceFirstPass,
  emitQAManifestForAnalysisRun,
  emitRawReportArtefact,
  emitResolverOutputAndTruthStateMap,
  emitScoreTraceFirstPass,
  emitTechniqueObservationTraceFirstPass,
} from "./v3/qa-artifacts-wiring.server";
async function safeEmitRawReportForQA(input: Parameters<typeof emitRawReportArtefact>[0]) {
  try {
    return await emitRawReportArtefact(input);
  } catch (error) {
    console.warn("[take-pipeline] internal_qa_raw_report_emit_warning", {
      warning: error instanceof Error ? error.message : "unknown",
    });
    return { written: false as const };
  }
}
import {
  scrubReportQuality,
  normaliseTimestampedNotes,
  computeConsistencyWarning,
  timestampTargetMin,
} from "./report-quality.server";
import {
  enforcePublicReportOutputQuality,
  detectFramingFixed,
} from "./report-output-enforcement.server";
import {
  safeIsoTimestamp,
  timestampNormalisationWarnings,
} from "./v3/qa-safe-normalisation.server";
import {
  evaluateStep1EvidenceForStep2,
  hasValidResolverOutputForStep2,
  hasValidTruthStateMapForStep2,
} from "./v3/qa-step2-dependency.server";
import { extractUploadIdentitySignals } from "./v3/media-identity-upload-signals.server";
import {
  consumeReportCreditReservation,
  releaseReportCreditForTake,
  ReportCreditRequiredError,
  reserveReportCreditForTake,
} from "./credit-ledger.server";
import { VIDEO_DURATION_HARD_CAP_COPY } from "@/lib/video-duration-policy";
import { blockTakeForVideoDurationHardCap } from "./video-duration-hard-cap.server";
import {
  recordSecondReportEventIfNeeded,
  recordServerAnalyticsEvent,
} from "./analytics-events.server";
import { safeEnqueueCrmEmailForUser } from "./crm-messaging.server";
import type { CreditMode } from "./credit-entitlement.server";
import { ANALYSING_ORPHAN_MS, FINALISING_ORPHAN_MS } from "./finalising-recovery.server";
import { buildS10TakeAnalysisRunId } from "@/lib/take-lifecycle";
import {
  S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
  S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION,
  S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION,
  S10_OBSERVATION_PROMPT_VERSION,
  S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
  S10_PROFESSIONAL_JUDGEMENT_SYSTEM_PROMPT,
  S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION,
  S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION,
  S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION,
  S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION,
} from "./s10-report-prompt-map.server";
import {
  applyBriefAchievementCompatibilityCaps,
  normaliseBriefAchievementMatrix,
  type S10TechnicalMediaSignals,
} from "./s10-brief-achievement-matrix.server";
import { applyReadinessScoreSemantics } from "./s10-readiness-score-semantics.server";
import { applyS10FixHierarchyNextAction } from "./s10-fix-hierarchy-next-action.server";
import {
  applyS10ProfessionalCritique,
  scrubS10ProfessionalCritiqueProjection,
} from "./s10-strengths-preserve-professional-critique.server";
import {
  applyS10TechniqueLibraryCommentary,
  scrubS10TechniqueCommentaryProjection,
} from "./s10-technique-library-commentary.server";
import {
  applyS10TimestampedCommentary,
  scrubS10TimestampedCommentaryProjection,
} from "./s10-timestamped-commentary.server";
import { resolveS10ObservationContext } from "./s10-observation-context.server";
import {
  evaluateS10ModuleReadiness,
  summariseS10ModuleReadinessForPersistence,
} from "./s10-module-readiness.server";
import {
  classifyS10SameVideoComparison,
  type S10SameVideoClassificationResult,
} from "./s10-same-video-comparison.server";
import {
  buildPlainJsonReportInstruction,
  buildProviderToolForModel,
  classifyAiGatewayProviderError,
  parseProviderJsonObjectContent,
  selectReportProviderContract,
  shouldRetryWithFreshMuxUrl,
  type ReportProviderContract,
} from "./provider-tool-schema.server";

// Two-step pipeline feature flag (safe default: OFF unless explicitly "true").
function isTwoStepEnabled(): boolean {
  return process.env.TWO_STEP_ANALYSIS_ENABLED === "true";
}

function isRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function runtimeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function runtimeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nestedRuntimeValue(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!isRuntimeRecord(current)) return null;
    current = current[key];
  }
  return current;
}

function firstRuntimeNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = runtimeNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function firstRuntimeString(...values: unknown[]): string | null {
  for (const value of values) {
    const parsed = runtimeString(value);
    if (parsed) return parsed;
  }
  return null;
}

function mediaEvidenceSummariesFromContext(input: {
  observedTapeSequence?: Array<{ evidence_summary?: string; component_type?: string }>;
  componentVerifications?: Array<{ evidence_summary?: string; requirement_summary?: string }>;
  mediaObservationSummary?: { duration_summary?: string; uncertainties?: string[] } | null;
}): string[] {
  return [
    ...(input.observedTapeSequence ?? []).flatMap((item) => [
      item.evidence_summary,
      item.component_type,
    ]),
    ...(input.componentVerifications ?? []).flatMap((item) => [
      item.requirement_summary,
      item.evidence_summary,
    ]),
    input.mediaObservationSummary?.duration_summary,
    ...(input.mediaObservationSummary?.uncertainties ?? []),
  ]
    .map((item) => runtimeString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 40);
}

function buildTechnicalMediaSignals(input: {
  signals: unknown;
  checklist: unknown;
  mediaObservationSummary: {
    audio_assessable?: boolean | null;
    video_assessable?: boolean | null;
    framing_assessable?: boolean | null;
    one_continuous_video_observed?: boolean | null;
    duration_summary?: string;
    uncertainties?: string[];
  } | null;
  observedTapeSequence?: Array<{ evidence_summary?: string; component_type?: string }>;
  componentVerifications?: Array<{ evidence_summary?: string; requirement_summary?: string }>;
}): S10TechnicalMediaSignals {
  const signals = isRuntimeRecord(input.signals) ? input.signals : {};
  const checklist = isRuntimeRecord(input.checklist) ? input.checklist : {};
  const width = firstRuntimeNumber(
    signals.width,
    signals.video_width,
    signals.resolution_width,
    nestedRuntimeValue(signals, ["resolution", "width"]),
    nestedRuntimeValue(signals, ["video", "width"]),
    checklist.width,
    nestedRuntimeValue(checklist, ["resolution", "width"]),
  );
  const height = firstRuntimeNumber(
    signals.height,
    signals.video_height,
    signals.resolution_height,
    nestedRuntimeValue(signals, ["resolution", "height"]),
    nestedRuntimeValue(signals, ["video", "height"]),
    checklist.height,
    nestedRuntimeValue(checklist, ["resolution", "height"]),
  );
  const orientation = firstRuntimeString(
    signals.orientation,
    nestedRuntimeValue(signals, ["orientation", "value"]),
    checklist.orientation,
    nestedRuntimeValue(checklist, ["orientation", "value"]),
  )?.toLowerCase();
  const evidenceSummaries = mediaEvidenceSummariesFromContext({
    observedTapeSequence: input.observedTapeSequence,
    componentVerifications: input.componentVerifications,
    mediaObservationSummary: input.mediaObservationSummary,
  });
  const evidenceText = evidenceSummaries.join(" ");
  const headAndShouldersObserved =
    /\b(head[-\s]?and[-\s]?shoulders|head\s*&\s*shoulders|head and shoulders|shoulders|upper body|close[-\s]?up)\b/i.test(
      evidenceText,
    );
  const landscapeObserved =
    /\b(landscape frame|landscape orientation|landscape video|landscape shot|1280\s*x\s*720|16\s*:\s*9)\b/i.test(
      evidenceText,
    );
  return {
    width,
    height,
    orientation,
    landscape:
      orientation === "landscape" ||
      (width != null && height != null && width > height) ||
      landscapeObserved,
    audioAssessable: input.mediaObservationSummary?.audio_assessable ?? null,
    videoAssessable: input.mediaObservationSummary?.video_assessable ?? null,
    framingAssessable: input.mediaObservationSummary?.framing_assessable ?? null,
    headAndShouldersObserved,
    oneContinuousVideoObserved:
      input.mediaObservationSummary?.one_continuous_video_observed ?? null,
    safeFileMetadataPresent: Boolean(
      nestedRuntimeValue(signals, ["safe_upload_identity"]) ||
      nestedRuntimeValue(signals, ["upload_identity"]) ||
      signals.file_size_bytes ||
      signals.metadata_file_name_safe_basename,
    ),
    evidenceSummaries,
  };
}

async function classifyLiveSameVideoContext(input: {
  take: {
    id: string;
    user_id: string | null;
    audition_id: string | null;
    signals?: unknown;
    checklist?: unknown;
    mux_duration_seconds?: number | null;
  };
}): Promise<S10SameVideoClassificationResult | null> {
  if (!input.take.user_id || !input.take.audition_id) return null;

  const currentIdentity = extractUploadIdentitySignals({
    signals: input.take.signals,
    checklist: input.take.checklist,
    muxDurationSeconds: input.take.mux_duration_seconds,
  });
  if (!currentIdentity.original_upload_file_hash || currentIdentity.file_size_bytes == null) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("takes")
      .select("id, user_id, audition_id, signals, checklist, mux_duration_seconds, created_at")
      .eq("user_id", input.take.user_id)
      .eq("audition_id", input.take.audition_id)
      .neq("id", input.take.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      console.warn("[take-pipeline] same_video_lookup_failed", {
        take_id: input.take.id,
        error: String(error.message ?? error),
      });
      return null;
    }

    const compared = (data ?? []).filter((row) => {
      const identity = extractUploadIdentitySignals({
        signals: row.signals,
        checklist: row.checklist,
        muxDurationSeconds: row.mux_duration_seconds,
      });
      return (
        identity.original_upload_file_hash === currentIdentity.original_upload_file_hash &&
        identity.file_size_bytes != null &&
        identity.file_size_bytes === currentIdentity.file_size_bytes
      );
    });
    if (compared.length === 0) return null;

    return classifyS10SameVideoComparison({
      current_take_id: input.take.id,
      scope: "same_user_same_audition",
      comparison_present: false,
      operator_confirmation: "none",
      compared_takes: [
        {
          take_id: input.take.id,
          label: "Current take",
          user_id: input.take.user_id,
          audition_id: input.take.audition_id,
          original_upload_file_hash: currentIdentity.original_upload_file_hash,
          file_size_bytes: currentIdentity.file_size_bytes,
          video_duration_ms: currentIdentity.video_duration_ms,
          metadata_file_name: currentIdentity.metadata_file_name,
          original_file_name: currentIdentity.original_file_name,
        },
        ...compared.map((row, index) => {
          const identity = extractUploadIdentitySignals({
            signals: row.signals,
            checklist: row.checklist,
            muxDurationSeconds: row.mux_duration_seconds,
          });
          return {
            take_id: row.id,
            label: `Earlier take ${index + 1}`,
            user_id: row.user_id,
            audition_id: row.audition_id,
            original_upload_file_hash: identity.original_upload_file_hash,
            file_size_bytes: identity.file_size_bytes,
            video_duration_ms: identity.video_duration_ms,
            metadata_file_name: identity.metadata_file_name,
            original_file_name: identity.original_file_name,
          };
        }),
      ],
    });
  } catch (error) {
    console.warn("[take-pipeline] same_video_classification_failed", {
      take_id: input.take.id,
      error: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return null;
  }
}

function runtimeRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isRuntimeRecord(item))
    : [];
}

const S10_OBSERVED_TAPE_SEQUENCE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    component_type: {
      type: "string",
      enum: [
        "ident",
        "acting_scene",
        "song",
        "dance",
        "movement",
        "transition",
        "technical",
        "unknown",
      ],
    },
    linked_requirement_ids: { type: "array", items: { type: "string" } },
    start_time: { type: ["string", "null"] },
    end_time: { type: ["string", "null"] },
    present_status: {
      type: "string",
      enum: ["present", "partially_present", "absent", "not_assessable", "uncertain"],
    },
    completion_status: {
      type: "string",
      enum: ["complete", "incomplete", "cut_off", "not_applicable", "uncertain"],
    },
    evidence_summary: { type: "string" },
    observed_from_media: { type: "boolean" },
    evidence_basis: {
      type: "string",
      enum: ["observed_audio_video", "deterministic_metadata", "brief_text_only", "uncertainty"],
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    assessability_notes: { type: "string" },
  },
  required: [
    "id",
    "label",
    "component_type",
    "linked_requirement_ids",
    "start_time",
    "end_time",
    "present_status",
    "completion_status",
    "evidence_summary",
    "observed_from_media",
    "evidence_basis",
    "confidence",
    "assessability_notes",
  ],
};

const S10_COMPONENT_VERIFICATION_SCHEMA = {
  type: "object",
  properties: {
    requirement_id: { type: "string" },
    requirement_summary: { type: "string" },
    observed_status: {
      type: "string",
      enum: ["present", "partially_present", "absent", "not_assessable", "uncertain"],
    },
    completion_status: {
      type: "string",
      enum: ["complete", "incomplete", "cut_off", "not_applicable", "uncertain"],
    },
    evidence_summary: { type: "string" },
    observed_from_media: { type: "boolean" },
    evidence_basis: {
      type: "string",
      enum: ["observed_audio_video", "deterministic_metadata", "brief_text_only", "uncertainty"],
    },
    timestamp_refs: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    cannot_infer_from_brief_only: { type: "boolean", enum: [true] },
    assessability_notes: { type: "string" },
  },
  required: [
    "requirement_id",
    "requirement_summary",
    "observed_status",
    "completion_status",
    "evidence_summary",
    "observed_from_media",
    "evidence_basis",
    "timestamp_refs",
    "confidence",
    "cannot_infer_from_brief_only",
    "assessability_notes",
  ],
};

const S10_MEDIA_OBSERVATION_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    audio_assessable: { type: ["boolean", "null"] },
    video_assessable: { type: ["boolean", "null"] },
    framing_assessable: { type: ["boolean", "null"] },
    continuity_assessable: { type: ["boolean", "null"] },
    abrupt_cutoff_detected: { type: ["boolean", "null"] },
    one_continuous_video_observed: { type: ["boolean", "null"] },
    duration_summary: { type: "string" },
    uncertainties: { type: "array", items: { type: "string" } },
  },
  required: [
    "audio_assessable",
    "video_assessable",
    "framing_assessable",
    "continuity_assessable",
    "abrupt_cutoff_detected",
    "one_continuous_video_observed",
    "duration_summary",
    "uncertainties",
  ],
};

const S10_ACTION_WARNING_SCHEMA = {
  type: "object",
  properties: {
    affected_field: { type: "string" },
    original_value: { type: ["string", "number", "boolean", "null"] },
    corrected_value: { type: ["string", "number", "boolean", "null"] },
    reason: { type: "string" },
    source: {
      type: "string",
      enum: [
        "s10_ai_judgement",
        "legacy_raw_report",
        "legacy_improvements",
        "legacy_next_take_plan",
        "legacy_coaching_drills",
        "prior_prose",
        "s10_normaliser",
      ],
    },
    internal_only: { type: "boolean", enum: [true] },
  },
  required: [
    "affected_field",
    "original_value",
    "corrected_value",
    "reason",
    "source",
    "internal_only",
  ],
};

const S10_FIX_ITEM_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    issue: { type: "string" },
    why_it_matters: { type: "string" },
    exact_action: { type: "string" },
    source_category: {
      type: "string",
      enum: [
        "brief",
        "performance",
        "technical",
        "admin_process",
        "score_semantics",
        "polish",
        "limitation",
      ],
    },
    urgency: {
      type: "string",
      enum: ["critical_gap", "high", "medium", "low", "optional"],
    },
    submission_impact: {
      type: "string",
      enum: [
        "submission_blocker",
        "material_gap",
        "review_carefully",
        "optional_polish",
        "final_check",
        "supports_submission",
      ],
    },
    linked_requirement_ids: { type: "array", items: { type: "string" } },
    linked_matrix_result_ids: { type: "array", items: { type: "string" } },
    linked_component_verification_ids: { type: "array", items: { type: "string" } },
    linked_readiness_reason_ids: { type: "array", items: { type: "string" } },
    evidence_summary: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    is_fix_first_candidate: { type: "boolean" },
    is_generic_fallback: { type: "boolean", enum: [false] },
    source_authority: {
      type: "string",
      enum: ["s10_ai_authored", "s10_normalised", "legacy_diagnostic_reauthored", "limitation"],
    },
    legacy_source_used: { type: "boolean" },
    legacy_source_path: { type: ["string", "null"] },
  },
  required: [
    "id",
    "title",
    "issue",
    "why_it_matters",
    "exact_action",
    "source_category",
    "urgency",
    "submission_impact",
    "linked_requirement_ids",
    "linked_matrix_result_ids",
    "linked_component_verification_ids",
    "linked_readiness_reason_ids",
    "evidence_summary",
    "confidence",
    "is_fix_first_candidate",
    "is_generic_fallback",
    "source_authority",
    "legacy_source_used",
  ],
};

const S10_PROFESSIONAL_CRITIQUE_WARNING_SCHEMA = {
  type: "object",
  properties: {
    affected_field: { type: "string" },
    original_value: { type: ["string", "number", "boolean", "null"] },
    corrected_value: { type: ["string", "number", "boolean", "null"] },
    reason: { type: "string" },
    source: {
      type: "string",
      enum: [
        "s10_ai_judgement",
        "legacy_raw_report",
        "legacy_category_rationale",
        "legacy_category_notes",
        "legacy_coaching_drills",
        "legacy_technique_trace",
        "prior_prose",
        "s10_normaliser",
      ],
    },
    internal_only: { type: "boolean", enum: [true] },
  },
  required: [
    "affected_field",
    "original_value",
    "corrected_value",
    "reason",
    "source",
    "internal_only",
  ],
};

const S10_STRENGTH_ITEM_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    detail: { type: "string" },
    why_it_matters: { type: "string" },
    evidence_summary: { type: "string" },
    source_category: {
      type: "string",
      enum: [
        "brief",
        "performance",
        "acting",
        "vocal",
        "movement",
        "technical",
        "presentation",
        "package",
        "limitation",
      ],
    },
    linked_requirement_ids: { type: "array", items: { type: "string" } },
    linked_component_verification_ids: { type: "array", items: { type: "string" } },
    linked_matrix_result_ids: { type: "array", items: { type: "string" } },
    linked_readiness_reason_ids: { type: "array", items: { type: "string" } },
    linked_fix_ids: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    is_component_verified: { type: "boolean" },
    component_status: {
      type: "string",
      enum: [
        "present",
        "partially_present",
        "absent",
        "not_assessable",
        "uncertain",
        "not_applicable",
      ],
    },
    applies_to_observed_portion_only: { type: "boolean" },
    is_generic_fallback: { type: "boolean", enum: [false] },
  },
  required: [
    "id",
    "title",
    "detail",
    "why_it_matters",
    "evidence_summary",
    "source_category",
    "linked_requirement_ids",
    "linked_component_verification_ids",
    "linked_matrix_result_ids",
    "linked_readiness_reason_ids",
    "linked_fix_ids",
    "confidence",
    "is_component_verified",
    "component_status",
    "applies_to_observed_portion_only",
    "is_generic_fallback",
  ],
};

const S10_PRESERVE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    detail: { type: "string" },
    evidence_summary: { type: "string" },
    why_to_preserve: { type: "string" },
    linked_component_verification_ids: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    is_generic_fallback: { type: "boolean", enum: [false] },
  },
  required: [
    "id",
    "title",
    "detail",
    "evidence_summary",
    "why_to_preserve",
    "linked_component_verification_ids",
    "confidence",
    "is_generic_fallback",
  ],
};

const S10_TECHNIQUE_WARNING_SCHEMA = {
  type: "object",
  properties: {
    affected_field: { type: "string" },
    original_value: { type: ["string", "number", "boolean", "null"] },
    corrected_value: { type: ["string", "number", "boolean", "null"] },
    reason: { type: "string" },
    source: {
      type: "string",
      enum: [
        "s10_ai_judgement",
        "legacy_raw_report",
        "legacy_category_rationale",
        "legacy_category_notes",
        "legacy_coaching_drills",
        "legacy_technique_trace",
        "prior_prose",
        "s10_normaliser",
        "public_technique_authority_gate",
      ],
    },
    internal_only: { type: "boolean", enum: [true] },
  },
  required: [
    "affected_field",
    "original_value",
    "corrected_value",
    "reason",
    "source",
    "internal_only",
  ],
};

const S10_TECHNIQUE_OBSERVATION_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    technique_area: {
      type: "string",
      enum: [
        "acting",
        "vocal_singing",
        "movement_dance",
        "musical_theatre_package",
        "self_tape_presentation",
        "commercial_screen_task",
      ],
    },
    title: { type: "string" },
    detail: { type: "string" },
    evidence_summary: { type: "string" },
    linked_requirement_ids: { type: "array", items: { type: "string" } },
    linked_component_verification_ids: { type: "array", items: { type: "string" } },
    linked_matrix_result_ids: { type: "array", items: { type: "string" } },
    linked_readiness_reason_ids: { type: "array", items: { type: "string" } },
    linked_strength_ids: { type: "array", items: { type: "string" } },
    linked_fix_ids: { type: "array", items: { type: "string" } },
    linked_timestamp_refs: { type: "array", items: { type: "string" } },
    component_status: {
      type: "string",
      enum: [
        "present",
        "partially_present",
        "absent",
        "not_assessable",
        "uncertain",
        "not_applicable",
      ],
    },
    applies_to_observed_portion_only: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    is_named_authority_claim: { type: "boolean" },
    is_medical_or_health_claim: { type: "boolean" },
    is_body_or_appearance_claim: { type: "boolean" },
    is_casting_outcome_claim: { type: "boolean" },
    is_generic_fallback: { type: "boolean", enum: [false] },
  },
  required: [
    "id",
    "technique_area",
    "title",
    "detail",
    "evidence_summary",
    "linked_requirement_ids",
    "linked_component_verification_ids",
    "linked_matrix_result_ids",
    "linked_readiness_reason_ids",
    "linked_strength_ids",
    "linked_fix_ids",
    "linked_timestamp_refs",
    "component_status",
    "applies_to_observed_portion_only",
    "confidence",
    "is_named_authority_claim",
    "is_medical_or_health_claim",
    "is_body_or_appearance_claim",
    "is_casting_outcome_claim",
    "is_generic_fallback",
  ],
};

const S10_TECHNIQUE_SECTION_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["assessable", "partially_assessable", "not_assessable", "not_applicable"],
    },
    headline: { type: "string" },
    observations: { type: "array", items: S10_TECHNIQUE_OBSERVATION_SCHEMA, maxItems: 8 },
    what_is_working: { type: "array", items: { type: "string" }, maxItems: 8 },
    what_could_improve: { type: "array", items: { type: "string" }, maxItems: 8 },
    practical_actions: { type: "array", items: { type: "string" }, maxItems: 8 },
    preserve: { type: "array", items: { type: "string" }, maxItems: 8 },
    not_assessable_reason: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: [
    "status",
    "headline",
    "observations",
    "what_is_working",
    "what_could_improve",
    "practical_actions",
    "preserve",
    "not_assessable_reason",
    "confidence",
  ],
};

const S10_TIMESTAMPED_WARNING_SCHEMA = {
  type: "object",
  properties: {
    affected_field: { type: "string" },
    original_value: { type: ["string", "number", "boolean", "null"] },
    corrected_value: { type: ["string", "number", "boolean", "null"] },
    reason: { type: "string" },
    source: {
      type: "string",
      enum: [
        "s10_ai_judgement",
        "legacy_raw_report",
        "legacy_timestamped_notes",
        "prior_prose",
        "step1_timestamped_evidence",
        "evidence_anchor",
        "provider_output",
        "s10_normaliser",
      ],
    },
    internal_only: { type: "boolean", enum: [true] },
  },
  required: [
    "affected_field",
    "original_value",
    "corrected_value",
    "reason",
    "source",
    "internal_only",
  ],
};

const S10_TIMESTAMPED_NOTE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    timecode: { type: ["string", "null"], description: "MM:SS when supported, otherwise null." },
    start_time: { type: ["string", "null"] },
    end_time: { type: ["string", "null"] },
    time_band_label: { type: ["string", "null"] },
    display_label: { type: "string" },
    timestamp_precision: {
      type: "string",
      enum: ["exact", "approximate", "time_banded", "order_only", "unavailable"],
    },
    section: {
      type: "string",
      enum: [
        "brief_requirement",
        "observed_component",
        "strength",
        "fix",
        "technique",
        "technical",
        "limitation",
        "next_action",
        "missing_component",
      ],
    },
    title: { type: "string" },
    detail: { type: "string" },
    action: { type: ["string", "null"] },
    evidence_summary: { type: "string" },
    linked_requirement_ids: { type: "array", items: { type: "string" } },
    linked_observed_sequence_ids: { type: "array", items: { type: "string" } },
    linked_component_verification_ids: { type: "array", items: { type: "string" } },
    linked_matrix_result_ids: { type: "array", items: { type: "string" } },
    linked_fix_ids: { type: "array", items: { type: "string" } },
    linked_strength_ids: { type: "array", items: { type: "string" } },
    linked_technique_observation_ids: { type: "array", items: { type: "string" } },
    component_type: {
      type: "string",
      enum: [
        "ident",
        "acting_scene",
        "song",
        "dance",
        "movement",
        "transition",
        "technical",
        "unknown",
        "not_applicable",
      ],
    },
    component_status: {
      type: "string",
      enum: [
        "present",
        "partially_present",
        "absent",
        "not_assessable",
        "uncertain",
        "not_applicable",
      ],
    },
    applies_to_observed_portion_only: { type: "boolean" },
    is_exact_timestamp_supported: { type: "boolean" },
    is_legacy_timestamp_projection: { type: "boolean" },
    note_source_authority: {
      type: "string",
      enum: [
        "s10_ai_authored",
        "s10_normalised",
        "step1_timestamped_evidence",
        "evidence_anchor",
        "provider_output",
        "legacy_diagnostic_reauthored",
        "limitation",
      ],
    },
    legacy_source_used: { type: "boolean" },
    legacy_source_path: { type: ["string", "null"] },
    is_missing_component_note: { type: "boolean" },
    is_projection_safe: { type: "boolean" },
    projection_block_reason: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    is_generic_fallback: { type: "boolean", enum: [false] },
  },
  required: [
    "id",
    "timecode",
    "start_time",
    "end_time",
    "time_band_label",
    "display_label",
    "timestamp_precision",
    "section",
    "title",
    "detail",
    "action",
    "evidence_summary",
    "linked_requirement_ids",
    "linked_observed_sequence_ids",
    "linked_component_verification_ids",
    "linked_matrix_result_ids",
    "linked_fix_ids",
    "linked_strength_ids",
    "linked_technique_observation_ids",
    "component_type",
    "component_status",
    "applies_to_observed_portion_only",
    "is_exact_timestamp_supported",
    "is_legacy_timestamp_projection",
    "note_source_authority",
    "legacy_source_used",
    "legacy_source_path",
    "is_missing_component_note",
    "is_projection_safe",
    "projection_block_reason",
    "confidence",
    "is_generic_fallback",
  ],
};

const S10_COMPONENT_TIME_RANGE_SCHEMA = {
  type: "object",
  properties: {
    component_type: {
      type: "string",
      enum: [
        "ident",
        "acting_scene",
        "song",
        "dance",
        "movement",
        "transition",
        "technical",
        "unknown",
        "not_applicable",
      ],
    },
    label: { type: "string" },
    start_time: { type: ["string", "null"] },
    end_time: { type: ["string", "null"] },
    timestamp_precision: {
      type: "string",
      enum: ["exact", "approximate", "time_banded", "order_only", "unavailable"],
    },
    observed_status: {
      type: "string",
      enum: ["present", "partially_present", "absent", "not_assessable", "uncertain"],
    },
    completion_status: {
      type: "string",
      enum: ["complete", "incomplete", "cut_off", "not_applicable", "uncertain"],
    },
    linked_requirement_ids: { type: "array", items: { type: "string" } },
    evidence_summary: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: [
    "component_type",
    "label",
    "start_time",
    "end_time",
    "timestamp_precision",
    "observed_status",
    "completion_status",
    "linked_requirement_ids",
    "evidence_summary",
    "confidence",
  ],
};

const S10_TIMESTAMP_PROJECTION_NOTE_SCHEMA = {
  type: "object",
  properties: {
    timestamp: { type: "string" },
    note: { type: "string" },
    source_note_id: { type: "string" },
    timestamp_precision: {
      type: "string",
      enum: ["exact", "approximate", "time_banded", "order_only", "unavailable"],
    },
  },
  required: ["timestamp", "note", "source_note_id", "timestamp_precision"],
};

function addUniqueId(ids: string[], id: string) {
  if (!ids.includes(id)) ids.push(id);
}

// ---- Model routing (env-overridable) ----
// Primary = Gemini 3 Flash Preview. Fallback = Gemini 2.5 Flash (more
// stable today). Brief extraction stays on 2.5 Flash inside extract-brief.
const ANALYSIS_MODEL_PRIMARY =
  process.env.ANALYSIS_MODEL_PRIMARY ?? "google/gemini-3-flash-preview";
const ANALYSIS_MODEL_FALLBACK = process.env.ANALYSIS_MODEL_FALLBACK ?? "google/gemini-2.5-flash";
import {
  applyCapsAndLabel,
  bandsForLevel,
  buildS10PerformerLevelPromptBlock,
  computeBlockers,
  deterministicCompliance,
  recomputeOverall,
  toUKTerms,
  ukifyDeep,
  weightsForType,
  type AuditionLevel,
  type AuditionType,
  type ExtractedBrief,
} from "@/lib/audition-rules";

// Scoring v2 — multi-component aware, split brief adherence, submission risk flags.
export const REPORT_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_audition_report",
    description: "Submit the structured audition feedback report.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["brief", "baseline"] },
        audition_type: {
          type: "string",
          description:
            "Inferred type: acting_scene, song, musical_theatre, dance, commercial, hybrid, or unknown",
        },
        detected_components: {
          type: "array",
          description:
            "Performance components detected in the tape. For MT tapes with song + scene, include both.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "acting_scene",
                  "song",
                  "monologue",
                  "dance",
                  "commercial",
                  "slate",
                  "other",
                ],
              },
              weight: {
                type: "number",
                description:
                  "Relative weight of this component 0–1; weights across components should sum ~1.",
              },
              score: { type: "integer", minimum: 0, maximum: 100 },
              note: { type: "string" },
            },
            required: ["type", "weight", "score", "note"],
          },
        },
        observed_tape_sequence: {
          type: "array",
          description:
            "S10.3 observed tape sequence. Required S10 component truth for single-pass output; requested brief material, legacy detected_components and raw_report prose cannot prove observed material.",
          items: S10_OBSERVED_TAPE_SEQUENCE_SCHEMA,
          maxItems: 30,
        },
        component_verifications: {
          type: "array",
          description:
            "S10.3 component verification for every brief requirement. Presence/completion claims must come from observed media evidence, not brief text, scores, metadata-only evidence, raw_report or legacy detected_components.",
          items: S10_COMPONENT_VERIFICATION_SCHEMA,
          maxItems: 40,
        },
        media_observation_summary: {
          ...S10_MEDIA_OBSERVATION_SUMMARY_SCHEMA,
          description:
            "S10.3 media observation summary. Technical assessability can support confidence but cannot prove required component completion.",
        },
        consistency_modifier: {
          type: "integer",
          minimum: -10,
          maximum: 10,
          description:
            "Emotional/tonal continuity between components (-10 bad mismatch, +10 excellent continuity). 0 if single-component.",
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        confidence_reason: { type: "string" },
        overall_score: { type: "integer", minimum: 0, maximum: 100 },
        casting_headline: {
          type: "string",
          description:
            "One plain-language sentence at the top of the report, e.g. 'This tape is strongest for voice.' or 'This tape is most weakened by unclear audio.'",
        },
        casting_insight: {
          type: "string",
          description:
            "A one-line interpretive read of the tape's castability, e.g. 'Highly castable commercially, less suited for dramatic roles.'",
        },
        scores: {
          type: "object",
          properties: {
            technical: { type: "integer", minimum: 0, maximum: 100 },
            audio: { type: "integer", minimum: 0, maximum: 100 },
            vocal: { type: ["integer", "null"], minimum: 0, maximum: 100 },
            acting: { type: "integer", minimum: 0, maximum: 100 },
            brief_adherence: { type: "integer", minimum: 0, maximum: 100 },
            professional_presentation: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: [
            "technical",
            "audio",
            "acting",
            "brief_adherence",
            "professional_presentation",
          ],
        },
        brief_adherence_breakdown: {
          type: "object",
          description:
            "Split of Brief Adherence into its four sub-components (each 0–100). In baseline mode, treat these as professional-standards equivalents.",
          properties: {
            material_compliance: { type: "integer", minimum: 0, maximum: 100 },
            technical_compliance: { type: "integer", minimum: 0, maximum: 100 },
            instruction_precision: { type: "integer", minimum: 0, maximum: 100 },
            professionalism_signals: { type: "integer", minimum: 0, maximum: 100 },
            note: { type: "string" },
          },
          required: [
            "material_compliance",
            "technical_compliance",
            "instruction_precision",
            "professionalism_signals",
            "note",
          ],
        },
        brief_achievement_matrix: {
          type: "object",
          description:
            "S10 requirement-by-requirement brief achievement matrix. This must be produced before scores, verdict or readiness language, by comparing BriefRequirement[] against observed ComponentVerification[]/media evidence. Legacy detected_components, raw_report prose and material_compliance cannot prove achievement.",
          properties: {
            overall_status: {
              type: "string",
              enum: [
                "achieved",
                "mostly_achieved",
                "partly_achieved",
                "not_achieved",
                "not_assessable",
              ],
            },
            mandatory_status: {
              type: "string",
              enum: ["clear", "some_gaps", "blocked", "not_assessable"],
            },
            readiness_impact: {
              type: "string",
              enum: [
                "supports_submission",
                "review_carefully",
                "material_gap",
                "submission_blocker",
                "not_assessable",
              ],
            },
            summary: { type: "string" },
            achieved_requirements: { type: "array", items: { type: "string" } },
            missing_or_incomplete_requirements: {
              type: "array",
              items: { type: "string" },
            },
            not_assessable_requirements: { type: "array", items: { type: "string" } },
            final_check_requirements: { type: "array", items: { type: "string" } },
            requirement_results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  requirement_id: { type: "string" },
                  requirement_summary: { type: "string" },
                  category: {
                    type: "string",
                    enum: [
                      "material",
                      "performance",
                      "technical",
                      "admin_process",
                      "deadline",
                      "logistics",
                      "role_context",
                    ],
                  },
                  importance: {
                    type: "string",
                    enum: ["mandatory", "preferred", "optional", "ambiguous"],
                  },
                  observed_status: {
                    type: "string",
                    enum: ["present", "partially_present", "absent", "not_assessable", "uncertain"],
                  },
                  completion_status: {
                    type: "string",
                    enum: ["complete", "incomplete", "cut_off", "not_applicable", "uncertain"],
                  },
                  achievement_status: {
                    type: "string",
                    enum: [
                      "achieved",
                      "mostly_achieved",
                      "partly_achieved",
                      "not_achieved",
                      "not_assessable",
                      "not_applicable",
                    ],
                  },
                  evidence_summary: { type: "string" },
                  submission_impact: {
                    type: "string",
                    enum: [
                      "supports_submission",
                      "material_gap",
                      "submission_blocker",
                      "optional_polish",
                      "final_check",
                      "not_assessable",
                    ],
                  },
                  fix_category: {
                    type: "string",
                    enum: [
                      "must_fix",
                      "should_improve",
                      "optional_polish",
                      "preserve",
                      "final_check",
                      "none",
                    ],
                  },
                  recommended_action: { type: "string" },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                  linked_observed_sequence_ids: { type: "array", items: { type: "string" } },
                  linked_component_verification_ids: {
                    type: "array",
                    items: { type: "string" },
                  },
                  cannot_infer_from_brief_only: { type: "boolean", enum: [true] },
                },
                required: [
                  "requirement_id",
                  "requirement_summary",
                  "category",
                  "importance",
                  "observed_status",
                  "completion_status",
                  "achievement_status",
                  "evidence_summary",
                  "submission_impact",
                  "fix_category",
                  "recommended_action",
                  "confidence",
                  "linked_observed_sequence_ids",
                  "linked_component_verification_ids",
                  "cannot_infer_from_brief_only",
                ],
              },
            },
          },
          required: [
            "overall_status",
            "mandatory_status",
            "readiness_impact",
            "summary",
            "achieved_requirements",
            "missing_or_incomplete_requirements",
            "not_assessable_requirements",
            "final_check_requirements",
            "requirement_results",
          ],
        },
        readiness_score_judgement: {
          type: "object",
          description:
            "S10 readiness and score semantics. Produce after brief_achievement_matrix. Separate performance quality, brief completion and overall submission readiness; legacy scores are diagnostic only.",
          properties: {
            decision: {
              type: "string",
              enum: [
                "submit",
                "submit_if_deadline_is_close",
                "review_carefully",
                "retake_required_if_possible",
              ],
            },
            headline: { type: "string" },
            rationale: { type: "array", items: { type: "string" } },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            performance_quality_score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
            brief_completion_score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
            overall_submission_readiness_score: { type: "integer", minimum: 0, maximum: 100 },
            score_band_label: {
              type: "string",
              enum: [
                "not_submission_ready",
                "retake_required_if_possible",
                "review_carefully",
                "submit_if_deadline_is_close",
                "submit_strong_submission",
              ],
            },
            score_explanation: { type: "string" },
            brief_blocker_override: { type: "boolean" },
            performance_quality_summary: { type: "string" },
            brief_completion_summary: { type: "string" },
            technical_assessability_summary: { type: "string" },
            selected_level_calibration_summary: { type: "string" },
            selected_level_calibration: {
              type: "object",
              description:
                "S10 selected performer-level calibration. The selected level is the assessment standard, not tone. State what meets the level, what falls short, score meaning at this level and whether the level changes the recommendation.",
              properties: {
                selected_level: {
                  type: "string",
                  enum: [
                    "learning_school",
                    "amateur_community",
                    "emerging_training",
                    "professional",
                  ],
                },
                selected_level_label: { type: "string" },
                standard_applied: { type: "string" },
                evidence_threshold: { type: "string" },
                readiness_standard: { type: "string" },
                score_meaning: { type: "string" },
                what_meets_level: { type: "array", items: { type: "string" }, maxItems: 8 },
                what_falls_short: { type: "array", items: { type: "string" }, maxItems: 8 },
                recommendation_impact: { type: "string" },
                comparison_to_other_levels: {
                  type: "string",
                  description:
                    "Optional level-relative comparison, or an empty string if no comparison is useful.",
                },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
              },
              required: [
                "selected_level",
                "selected_level_label",
                "standard_applied",
                "evidence_threshold",
                "readiness_standard",
                "score_meaning",
                "what_meets_level",
                "what_falls_short",
                "recommendation_impact",
                "comparison_to_other_levels",
                "confidence",
              ],
            },
            professional_nuance_summary: { type: "string" },
            category_scores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category_id: {
                    type: "string",
                    enum: [
                      "acting",
                      "vocal",
                      "movement",
                      "dance",
                      "audio",
                      "technical",
                      "brief_adherence",
                      "professional_presentation",
                      "self_tape_presentation",
                      "mt_package",
                      "other",
                    ],
                  },
                  score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
                  score_basis: { type: "string" },
                  what_works: { type: "string" },
                  why_not_full_score: { type: "string" },
                  close_gap: { type: "string" },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                  blocked_or_not_assessable_reason: { type: ["string", "null"] },
                },
                required: [
                  "category_id",
                  "score",
                  "score_basis",
                  "what_works",
                  "why_not_full_score",
                  "close_gap",
                  "confidence",
                  "blocked_or_not_assessable_reason",
                ],
              },
            },
            category_rationale: { type: "object" },
            component_scores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  component_type: {
                    type: "string",
                    enum: [
                      "acting_scene",
                      "song",
                      "dance",
                      "slate",
                      "package",
                      "technical",
                      "other",
                    ],
                  },
                  linked_requirement_ids: { type: "array", items: { type: "string" } },
                  observed_status: {
                    type: "string",
                    enum: ["present", "partially_present", "absent", "not_assessable", "uncertain"],
                  },
                  completion_status: {
                    type: "string",
                    enum: ["complete", "incomplete", "cut_off", "not_applicable", "uncertain"],
                  },
                  score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
                  score_basis: { type: "string" },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                  cannot_score_reason: { type: ["string", "null"] },
                },
                required: [
                  "component_type",
                  "linked_requirement_ids",
                  "observed_status",
                  "completion_status",
                  "score",
                  "score_basis",
                  "confidence",
                  "cannot_score_reason",
                ],
              },
            },
            component_score_notes: { type: "array", items: { type: "string" } },
            score_contradiction_warnings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  affected_field: { type: "string" },
                  original_value: { type: ["string", "number", "boolean", "null"] },
                  capped_value: { type: ["string", "number", "boolean", "null"] },
                  matrix_reason: { type: "string" },
                  source: {
                    type: "string",
                    enum: [
                      "s10_ai_judgement",
                      "legacy_raw_report",
                      "score_trace",
                      "detected_components",
                      "prior_prose",
                    ],
                  },
                },
                required: [
                  "affected_field",
                  "original_value",
                  "capped_value",
                  "matrix_reason",
                  "source",
                ],
              },
            },
            repair_prompt_status: {
              type: "string",
              enum: ["not_needed", "classified_contradictory"],
            },
          },
          required: [
            "decision",
            "headline",
            "rationale",
            "confidence",
            "performance_quality_score",
            "brief_completion_score",
            "overall_submission_readiness_score",
            "score_band_label",
            "score_explanation",
            "brief_blocker_override",
            "performance_quality_summary",
            "brief_completion_summary",
            "technical_assessability_summary",
            "selected_level_calibration_summary",
            "selected_level_calibration",
            "professional_nuance_summary",
            "category_scores",
            "category_rationale",
            "component_scores",
            "component_score_notes",
            "score_contradiction_warnings",
            "repair_prompt_status",
          ],
        },
        s10_fix_hierarchy: {
          type: "object",
          description:
            "S10 authoritative fix hierarchy. Produce after brief_achievement_matrix and readiness_score_judgement. Mandatory material/package blockers outrank polish, file naming, diction, character detail and admin-only checks. Legacy action fields are diagnostic only.",
          properties: {
            fix_first: {
              type: ["object", "null"],
              properties: S10_FIX_ITEM_SCHEMA.properties,
              required: S10_FIX_ITEM_SCHEMA.required,
            },
            priority_fixes: { type: "array", items: S10_FIX_ITEM_SCHEMA, maxItems: 8 },
            must_fix_before_submitting: { type: "array", items: S10_FIX_ITEM_SCHEMA, maxItems: 8 },
            should_improve_if_retaking: {
              type: "array",
              items: S10_FIX_ITEM_SCHEMA,
              maxItems: 10,
            },
            optional_polish: { type: "array", items: S10_FIX_ITEM_SCHEMA, maxItems: 8 },
            preserve: { type: "array", items: S10_FIX_ITEM_SCHEMA, maxItems: 8 },
            do_not_overfix: { type: "array", items: S10_FIX_ITEM_SCHEMA, maxItems: 8 },
            action_contradiction_warnings: {
              type: "array",
              items: S10_ACTION_WARNING_SCHEMA,
            },
          },
          required: [
            "fix_first",
            "priority_fixes",
            "must_fix_before_submitting",
            "should_improve_if_retaking",
            "optional_polish",
            "preserve",
            "do_not_overfix",
            "action_contradiction_warnings",
          ],
        },
        s10_next_action_plan: {
          type: "object",
          description:
            "S10 authoritative finite next-action plan. Use retake_plan when readiness requires retake/review; use submit_checklist when no retake is needed. Include final checks and playback/cut-off checks where relevant.",
          properties: {
            submit_checklist: { type: "array", items: { type: "string" }, maxItems: 10 },
            retake_plan: { type: "array", items: { type: "string" }, maxItems: 12 },
            final_checks: { type: "array", items: { type: "string" }, maxItems: 10 },
            playback_checks: { type: "array", items: { type: "string" }, maxItems: 8 },
            do_not_overfix: { type: "array", items: { type: "string" }, maxItems: 8 },
            if_time_is_short_guidance: {
              type: "array",
              items: { type: "string" },
              maxItems: 6,
            },
            no_retake_needed_reason: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: [
            "submit_checklist",
            "retake_plan",
            "final_checks",
            "playback_checks",
            "do_not_overfix",
            "if_time_is_short_guidance",
            "no_retake_needed_reason",
            "confidence",
          ],
        },
        s10_professional_critique: {
          type: "object",
          description:
            "S10 authoritative strengths, preserve guidance and broad professional critique. Produce after s10_fix_hierarchy/s10_next_action_plan. Strengths must be grounded in verified S10 component evidence; absent or unverified components produce limitations, not praise. Detailed technique-library commentary is S10.8.",
          properties: {
            summary: { type: "string" },
            performance_strengths: {
              type: "array",
              items: S10_STRENGTH_ITEM_SCHEMA,
              maxItems: 8,
            },
            brief_package_strengths: {
              type: "array",
              items: S10_STRENGTH_ITEM_SCHEMA,
              maxItems: 8,
            },
            technical_presentation_strengths: {
              type: "array",
              items: S10_STRENGTH_ITEM_SCHEMA,
              maxItems: 8,
            },
            vocal_or_singing_strengths: {
              type: "array",
              items: S10_STRENGTH_ITEM_SCHEMA,
              maxItems: 8,
            },
            acting_strengths: {
              type: "array",
              items: S10_STRENGTH_ITEM_SCHEMA,
              maxItems: 8,
            },
            movement_or_physical_strengths: {
              type: "array",
              items: S10_STRENGTH_ITEM_SCHEMA,
              maxItems: 8,
            },
            professional_presentation_notes: {
              type: "array",
              items: S10_STRENGTH_ITEM_SCHEMA,
              maxItems: 8,
            },
            preserve: { type: "array", items: S10_PRESERVE_ITEM_SCHEMA, maxItems: 8 },
            do_not_overfix: { type: "array", items: S10_PRESERVE_ITEM_SCHEMA, maxItems: 8 },
            critique_limitations: { type: "array", items: { type: "string" }, maxItems: 12 },
            contradiction_warnings: {
              type: "array",
              items: S10_PROFESSIONAL_CRITIQUE_WARNING_SCHEMA,
            },
          },
          required: [
            "summary",
            "performance_strengths",
            "brief_package_strengths",
            "technical_presentation_strengths",
            "vocal_or_singing_strengths",
            "acting_strengths",
            "movement_or_physical_strengths",
            "professional_presentation_notes",
            "preserve",
            "do_not_overfix",
            "critique_limitations",
            "contradiction_warnings",
          ],
        },
        s10_technique_commentary: {
          type: "object",
          description:
            "S10 authoritative technique-library commentary. Produce after s10_professional_critique. Verified component evidence before technique commentary is mandatory. Required-but-missing components are not_assessable or limited; present-but-incomplete components are partially_assessable and observed-portion-only. Legacy technique traces and public technique-authority gates are diagnostic only.",
          properties: {
            summary: { type: "string" },
            acting: S10_TECHNIQUE_SECTION_SCHEMA,
            vocal_singing: S10_TECHNIQUE_SECTION_SCHEMA,
            movement_dance: S10_TECHNIQUE_SECTION_SCHEMA,
            musical_theatre_package: S10_TECHNIQUE_SECTION_SCHEMA,
            self_tape_presentation: S10_TECHNIQUE_SECTION_SCHEMA,
            commercial_screen_task: S10_TECHNIQUE_SECTION_SCHEMA,
            limitations: { type: "array", items: { type: "string" }, maxItems: 16 },
            contradiction_warnings: {
              type: "array",
              items: S10_TECHNIQUE_WARNING_SCHEMA,
            },
          },
          required: [
            "summary",
            "acting",
            "vocal_singing",
            "movement_dance",
            "musical_theatre_package",
            "self_tape_presentation",
            "commercial_screen_task",
            "limitations",
            "contradiction_warnings",
          ],
        },
        s10_timestamped_commentary: {
          type: "object",
          description:
            "S10 authoritative timestamped/time-banded commentary. Produce after s10_technique_commentary. Verified component evidence before timestamped commentary is mandatory. Timestamped commentary cannot prove component presence. Exact timestamps require trusted timing support; use approximate/time-banded/order-only commentary when exact timestamps are unavailable. raw_report.timestamped_notes are diagnostic only.",
          properties: {
            summary: { type: "string" },
            notes: { type: "array", items: S10_TIMESTAMPED_NOTE_SCHEMA, maxItems: 36 },
            component_ranges: {
              type: "array",
              items: S10_COMPONENT_TIME_RANGE_SCHEMA,
              maxItems: 24,
            },
            missing_or_unobserved_components: {
              type: "array",
              items: { type: "string" },
              maxItems: 16,
            },
            timestamp_limitations: { type: "array", items: { type: "string" }, maxItems: 16 },
            projection_notes: {
              type: "array",
              items: S10_TIMESTAMP_PROJECTION_NOTE_SCHEMA,
              maxItems: 36,
            },
            legacy_projection_blocked_count: { type: "integer", minimum: 0 },
            exact_timestamp_supported_count: { type: "integer", minimum: 0 },
            time_banded_note_count: { type: "integer", minimum: 0 },
            order_only_note_count: { type: "integer", minimum: 0 },
            missing_component_note_count: { type: "integer", minimum: 0 },
            contradiction_warnings: {
              type: "array",
              items: S10_TIMESTAMPED_WARNING_SCHEMA,
            },
          },
          required: [
            "summary",
            "notes",
            "component_ranges",
            "missing_or_unobserved_components",
            "timestamp_limitations",
            "projection_notes",
            "legacy_projection_blocked_count",
            "exact_timestamp_supported_count",
            "time_banded_note_count",
            "order_only_note_count",
            "missing_component_note_count",
            "contradiction_warnings",
          ],
        },
        category_notes: {
          type: "object",
          properties: {
            technical: { type: "string" },
            audio: { type: "string" },
            vocal: { type: "string" },
            acting: { type: "string" },
            brief_adherence: { type: "string" },
            professional_presentation: { type: "string" },
          },
          required: [
            "technical",
            "audio",
            "acting",
            "brief_adherence",
            "professional_presentation",
          ],
        },
        strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 },
        improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 15 },
        fix_first: { type: "string" },
        priority_fixes: {
          type: "array",
          description:
            "Prioritised fixes for the next take. 2–5 items typical. Each item is the most useful thing to address now, anchored in evidence. Do not duplicate `improvements` verbatim unless that is the clearest formulation. kind: urgent | quick_win | critical_gap | assessability_blocker | low_effort_high_impact.",
          items: {
            type: "object",
            properties: {
              headline: { type: "string", maxLength: 200 },
              rationale: { type: "string", maxLength: 320 },
              kind: {
                type: "string",
                enum: [
                  "urgent",
                  "quick_win",
                  "critical_gap",
                  "assessability_blocker",
                  "low_effort_high_impact",
                ],
              },
              category: {
                type: "string",
                enum: [
                  "technical",
                  "audio",
                  "vocal",
                  "acting",
                  "brief_adherence",
                  "professional_presentation",
                ],
              },
            },
            required: ["headline"],
          },
          maxItems: 8,
        },
        category_rationale: {
          type: "object",
          description:
            "For every public category whose score is < 100, explain what works, why it is not 100, and what would close the gap. For scores >= 90, also include `standout_delta` — the marginal improvement that separates strong from standout. Discipline-specific language; never generic praise.",
          properties: Object.fromEntries(
            [
              "technical",
              "audio",
              "vocal",
              "acting",
              "brief_adherence",
              "professional_presentation",
            ].map((k) => [
              k,
              {
                type: "object",
                properties: {
                  what_works: { type: "string", maxLength: 320 },
                  why_not_full_score: { type: "string", maxLength: 320 },
                  close_gap: { type: "string", maxLength: 320 },
                  standout_delta: { type: "string", maxLength: 320 },
                },
              },
            ]),
          ),
        },
        timestamped_notes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string", description: "MM:SS format" },
              note: { type: "string" },
            },
            required: ["timestamp", "note"],
          },
          maxItems: 36,
        },
        coaching_drills: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 15 },
        next_take_plan: {
          type: "object",
          description:
            "Exhaustive next-steps / action plan. Include all identified actionable improvements. Use `groups` when the items naturally split (retake-critical, quick wins, craft refinements, rehearsal drills, recording setup); otherwise use a flat `steps` list. Avoid generic advice, expensive-equipment / paid-coaching advice, and unsupported foot-cropping advice. For fixed-frame briefs, recorded-take items must preserve the required frame. Rehearsal-only items must be labelled and paired with a recorded-take-safe alternative.",
          properties: {
            steps: {
              type: "array",
              items: { type: "string" },
              maxItems: 15,
            },
            groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: {
                    type: "string",
                    enum: [
                      "retake_critical",
                      "quick_wins",
                      "craft_refinements",
                      "rehearsal_drills",
                      "recording_setup",
                    ],
                  },
                  items: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 10,
                  },
                },
                required: ["label", "items"],
              },
              maxItems: 6,
            },
          },
        },
        submission_risk_flags: {
          type: "array",
          description:
            "Specific casting-compliance risks that could cause rejection (e.g. 'Uploaded as portrait but brief required landscape', 'Song not performed within the requested bar count').",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["low", "medium", "high"] },
              flag: { type: "string" },
            },
            required: ["severity", "flag"],
          },
        },
        casting_risk_explanations: {
          type: "array",
          description:
            "For each material risk in submission_risk_flags, a one-line plain-English explanation of the casting impact and whether it is likely to affect recall (callback) likelihood. Same order as submission_risk_flags where possible.",
          items: {
            type: "object",
            properties: {
              flag: { type: "string", description: "Short reference to the related risk." },
              casting_impact: {
                type: "string",
                description: "What this means for casting — concrete and non-technical.",
              },
              recall_impact: {
                type: "string",
                enum: ["unlikely_to_affect", "may_reduce", "likely_to_block"],
                description:
                  "Plain mapping of recall likelihood. unlikely_to_affect = cosmetic; may_reduce = noticeable; likely_to_block = will probably get filtered out.",
              },
            },
            required: ["flag", "casting_impact", "recall_impact"],
          },
        },
        role_material_context: {
          type: "object",
          description:
            "S10 role/material bridge. Use when role, character, production, scene, song, copy, routine or known material context is supplied or confidently resolved. Supplied brief is primary; known-material or official-source context is secondary nuance only. Never invent hidden mandatory requirements, appearance/type/castability/marketability language, callback/recall likelihood or booking/employment predictions.",
          properties: {
            applies: { type: "boolean" },
            project_name: { type: ["string", "null"] },
            role_name: { type: ["string", "null"] },
            discipline: { type: ["string", "null"] },
            audition_type: { type: ["string", "null"] },
            material_package_summary: { type: ["string", "null"] },
            role_description_summary: { type: ["string", "null"] },
            source_basis: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "brief_supplied",
                  "uploaded_material_extracted",
                  "user_supplied",
                  "official_source_researched",
                  "known_material_profile",
                  "model_inferred_low_confidence",
                  "observed_in_tape",
                  "not_available",
                  "contradicted_or_unreliable",
                ],
              },
            },
            primary_standard: {
              type: "string",
              enum: [
                "supplied_brief",
                "uploaded_material",
                "user_supplied_context",
                "selected_level_observed_tape",
                "observed_tape_only",
              ],
            },
            source_summary: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source_type: {
                    type: "string",
                    enum: [
                      "brief",
                      "uploaded_material",
                      "user_supplied",
                      "official_source",
                      "reputable_reference",
                      "internal_known_material_profile",
                      "model_inferred_low_confidence",
                      "not_available",
                    ],
                  },
                  source_label: { type: "string" },
                  truth_state: {
                    type: "string",
                    enum: [
                      "brief_supplied",
                      "uploaded_material_extracted",
                      "user_supplied",
                      "official_source_researched",
                      "known_material_profile",
                      "model_inferred_low_confidence",
                      "observed_in_tape",
                      "not_available",
                      "contradicted_or_unreliable",
                    ],
                  },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                  public_usable: { type: "boolean" },
                },
                required: [
                  "source_type",
                  "source_label",
                  "truth_state",
                  "confidence",
                  "public_usable",
                ],
              },
            },
            secondary_context: { type: ["string", "null"] },
            demands: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  description: { type: "string" },
                  source_truth_state: {
                    type: "string",
                    enum: [
                      "brief_supplied",
                      "uploaded_material_extracted",
                      "user_supplied",
                      "official_source_researched",
                      "known_material_profile",
                      "model_inferred_low_confidence",
                      "observed_in_tape",
                      "not_available",
                      "contradicted_or_unreliable",
                    ],
                  },
                  importance: {
                    type: "string",
                    enum: [
                      "mandatory_from_brief",
                      "preferred_from_brief",
                      "optional_from_brief",
                      "known_material_context_only",
                      "ambiguous",
                    ],
                  },
                  observable_evidence_needed: { type: "array", items: { type: "string" } },
                  scoring_use: {
                    type: "string",
                    enum: [
                      "can_drive_brief_achievement",
                      "can_nuance_score",
                      "report_context_only",
                      "not_for_scoring",
                    ],
                  },
                  unsafe_if_used_for: { type: "array", items: { type: "string" } },
                },
                required: [
                  "id",
                  "label",
                  "description",
                  "source_truth_state",
                  "importance",
                  "observable_evidence_needed",
                  "scoring_use",
                  "unsafe_if_used_for",
                ],
              },
            },
            blocked_inferences: { type: "array", items: { type: "string" } },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            uncertainty_notes: { type: "array", items: { type: "string" } },
            s14_deferred_maturity: { type: "array", items: { type: "string" } },
          },
        },
        role_fit_notes: {
          type: "string",
          description:
            "ONE short paragraph on how the performance aligns with the role's function, tone, energy, and emotional demands as described in the structured brief. Judge alignment with the role only — never likeness, appearance, race, body, age, or imitation. Empty string in BASELINE mode (no brief).",
        },
        role_fit_modifier: {
          type: "integer",
          minimum: -10,
          maximum: 5,
          description:
            "Bounded role-fit nudge applied to the overall score after recompute. MUST be 0 in BASELINE mode. Positive only when the performance clearly serves the role's function and tone (max +5). Negative when it works against the role's intent (max -10). Never use for likeness, appearance, or imitation.",
        },
        role_fit_confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description:
            "Your confidence that the structured brief gave you enough to judge role-fit. Use 'low' when the brief is thin or the role function is unclear.",
        },
        presentation_notes: {
          type: "array",
          description:
            "OPTIONAL practical, non-personal observations about visible presentation that materially affect the tape (e.g. 'Top blends into the background — a contrasting colour would read better on camera', 'Hair drifts across one eye on close-ups'). NEVER comment on body, attractiveness, weight, race, gender presentation, class markers, disability, mobility aids, medical devices, or personal style. Empty array if there is nothing material to say. These notes do NOT affect the score unless they relate to a brief requirement or a visibility issue already reflected in technical/brief categories.",
          items: { type: "string" },
          maxItems: 6,
        },
        at_risk: { type: "boolean" },
      },
      required: [
        "mode",
        "audition_type",
        "detected_components",
        "consistency_modifier",
        "confidence",
        "overall_score",
        "casting_headline",
        "casting_insight",
        "scores",
        "brief_adherence_breakdown",
        "observed_tape_sequence",
        "component_verifications",
        "media_observation_summary",
        "brief_achievement_matrix",
        "readiness_score_judgement",
        "s10_fix_hierarchy",
        "s10_next_action_plan",
        "s10_professional_critique",
        "s10_technique_commentary",
        "s10_timestamped_commentary",
        "category_notes",
        "strengths",
        "improvements",
        "fix_first",
        "timestamped_notes",
        "coaching_drills",
        "submission_risk_flags",
        "casting_risk_explanations",
        "role_fit_notes",
        "role_fit_modifier",
        "role_fit_confidence",
        "presentation_notes",
        "at_risk",
      ],
    },
  },
};

export function buildReportToolForProvider(model?: string | null): typeof REPORT_TOOL {
  return buildProviderToolForModel(REPORT_TOOL, model);
}

export function buildSinglePassReportRequestBodyForProvider(input: {
  model: string;
  systemPrompt: string;
  userText: string;
  videoUrl: string;
  reportTool?: typeof REPORT_TOOL;
  providerContract?: ReportProviderContract;
}): Record<string, unknown> {
  const providerContract = input.providerContract ?? selectReportProviderContract(input.model);
  const userContent = [
    { type: "text", text: input.userText },
    { type: "file_url", file_url: { url: input.videoUrl } },
  ];
  const base = {
    model: input.model,
    // Deterministic generation settings for the S10 single-pass recovery
    // path. Step 2 fallback must not regress to high-stochasticity output.
    temperature: 0.2,
    top_p: 1,
    messages: [
      {
        role: "system",
        content:
          providerContract === "plain_json_report"
            ? `${input.systemPrompt}\n\n${buildPlainJsonReportInstruction()}`
            : input.systemPrompt,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    // Match the two-step polish cap, sized for the 10-minute product maximum
    // across all disciplines (not the ~4-minute test fixture): a full-brief
    // report overruns small caps and truncates the JSON. gemini-3-flash supports
    // a far larger window; the analysis timeout still bounds latency.
    max_tokens: Number(process.env.REPORT_OUTPUT_MAX_TOKENS ?? 49152),
  };

  if (providerContract === "plain_json_report") return base;

  return {
    ...base,
    tools: [buildProviderToolForModel(input.reportTool ?? REPORT_TOOL, input.model)],
    tool_choice: { type: "function", function: { name: "submit_audition_report" } },
  };
}

function buildSystemPrompt(): string {
  return `${S10_PROFESSIONAL_JUDGEMENT_SYSTEM_PROMPT}

You will receive the video itself, selected performer level, optional casting brief, extracted brief, lightweight technical signals and upload checklist context.

Single-pass S10 recovery rules:
- Active prompt version is "${S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION}".
- Active embedded brief-achievement prompt version is "${S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION}".
- Active embedded readiness/score prompt version is "${S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION}".
- Active embedded fix hierarchy / next-action prompt version is "${S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION}".
- Active embedded strengths / preserve / professional critique prompt version is "${S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION}".
- Active embedded technique-library commentary prompt version is "${S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION}".
- Active embedded timestamped/time-banded commentary prompt version is "${S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION}".
- Watch and listen to the full tape before deciding detected_components, scores, verdict or readiness.
- First identify the required brief components and then verify whether each is present, absent, partially_present, cut_off, uncertain or not_assessable.
- Produce observed_tape_sequence, component_verifications and media_observation_summary before brief_achievement_matrix. These S10.3 fields are the component evidence source for single-pass reports. Do not infer component presence from brief text, detected_components, raw_report, scores, category prose, material_compliance or prior report text.
- Produce brief_achievement_matrix before any score, verdict, chip or readiness language. Compare BriefRequirement[] against observed media evidence. Brief text, legacy detected_components, material_compliance, score traces and previous report prose cannot prove achievement.
- Produce readiness_score_judgement after brief_achievement_matrix. Separate performance_quality_score, brief_completion_score and overall_submission_readiness_score. The visible overall readiness score must represent submission readiness, not talent alone.
- In readiness_score_judgement, populate selected_level_calibration with the selected-level standard, what meets it, what falls short, score meaning at this level and recommendation impact. Treat selected level as the assessment standard, not tone.
- Produce s10_fix_hierarchy and s10_next_action_plan after readiness_score_judgement. matrix-before-fixes and readiness-before-action-plan are mandatory. Missing mandatory material/package blockers outrank polish, file naming, diction, character detail and admin-only checks.
- Produce s10_professional_critique after s10_fix_hierarchy and s10_next_action_plan. Component verification before strengths is mandatory: absent or unverified components get limitations, not praise; partial/cut-off song strengths must say observed portion only.
- Produce s10_technique_commentary after s10_professional_critique. verified component evidence before technique commentary is mandatory. Attempt technique commentary where verified evidence exists. If the brief requires an acting scene and S10.3 does not verify it, acting is not_assessable or limited, not not_applicable. If a song is present but incomplete, cut off or uncertain, vocal/singing is partially_assessable and all notes apply only to the observed portion. public_technique_authority_status and public_technique_authority_blocked must not suppress ordinary authenticated technique commentary.
- Produce s10_timestamped_commentary after s10_technique_commentary. verified component evidence before timestamped commentary is mandatory. Timestamped commentary cannot prove component presence: it may annotate verified, partial, uncertain or missing components, but it must not create observed material. Exact timestamps require trusted timing support from ObservedTapeSequence, media-observed timestamped_evidence, EvidenceAnchors or provider output tied to verified component evidence. If exact timing is unavailable, use time-banded, order-only or not-observed notes; never invent fake timestamps. raw_report.timestamped_notes and prior prose are diagnostic only.
- Keep continuous-video technical evidence separate from complete required-material package evidence: a technically continuous clip is not a complete package if mandatory material is absent, partial or cut off.
- For Canary A style packages, explicitly check Side 1, song completion, one continuous video, one final file/package readiness and abrupt cut-off.
- Populate detected_components only from media evidence, never from brief requests alone.
- If mandatory material is missing or incomplete, retake/submission readiness must reflect that even when performance quality or audio is strong.
- Treat s10_fix_hierarchy and s10_next_action_plan as authoritative. Existing fix_first, priority_fixes, improvements, next_take_plan and coaching_drills are compatibility projections only. raw_report and legacy action fields are diagnostic only unless re-authored through S10 evidence with source tracking.
- Treat s10_professional_critique as authoritative for strengths, preserve and broad professional notes. Existing strengths, category_notes, category_rationale, presentation_notes and coaching_drills are lossy compatibility projections. Legacy technique traces/prose are diagnostic only.
- Treat s10_technique_commentary as authoritative for technique-library commentary. Existing category_notes, category_rationale, presentation_notes, coaching_drills and technique-related improvements are compatibility projections only. Legacy TechniqueObservationTrace, raw_report category prose, detected_components and coaching_drills are diagnostic only unless re-authored through S10 observed evidence. S10.8 may link timestamp refs where available, but S10.9 owns first-class timestamped/time-banded commentary.
- Treat s10_timestamped_commentary as authoritative for timestamped/time-banded commentary. Existing timestamped_notes is a compatibility projection only. Do not directly repopulate timestamped_notes from raw_report.timestamped_notes or legacy prose. Missing components may receive "Not observed" notes without fake timecodes; partial song notes must say observed portion only.
- Fill the existing submit_audition_report fields with AI-authored module answers: overall readiness, score/chip, verdict, prioritised fixes, why this score/category_rationale, category scores, component breakdown, strengths, improvements, timestamped notes, submission risk, role fit, presentation notes and next action.
- Use category_rationale for every visible category whose score is below 100, including what_works, why_not_full_score, close_gap and standout_delta when useful.
- Preserve discipline depth: musical theatre needs acting-through-song where supported; dance/movement needs rhythm/timing, control, pathway, dynamics and performance intention where visible.
- Never fill missing modules with generic fallback copy. If a module is unavailable, say exactly what is not assessable and what the performer should record/check next.

Output via the submit_audition_report tool. The casting_headline is one plain sentence pinpointing the single most important thing the user should know. casting_insight must explain submission readiness without castability, bookability, marketability or guaranteed outcome claims.`;
}

type Tier = "standard" | "high" | "original";

function ensureValidMuxMp4Url(params: {
  url: string | null;
  playbackId: string | null;
  kind: "primary" | "selected" | "gemini";
}): string {
  const normalisedUrl = params.url ? normaliseMuxMp4Url(params.url) : null;
  if (normalisedUrl && isValidMuxMp4Url(normalisedUrl)) {
    return normalisedUrl;
  }

  if (params.playbackId) {
    const rebuilt = buildMuxHighestMp4Url(params.playbackId);
    if (isValidMuxMp4Url(rebuilt)) {
      return rebuilt;
    }
  }

  throw new Error(
    "[failure_code:mux_invalid_mp4_url] Invalid Mux MP4 URL generated. Please try again.",
  );
}

const MUX_NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

async function pickAnalysisSource(
  take: {
    id: string;
    attempt_count: number | null;
    mux_mp4_standard_url: string | null;
    mux_mp4_high_url: string | null;
    mux_playback_id: string | null;
    mux_status: string | null;
  },
  allowOriginal: boolean,
): Promise<{ url: string; tier: Tier }> {
  if (take.mux_status !== "ready") {
    throw new Error("Video is still being optimised — please try again in a moment.");
  }
  if (!take.mux_playback_id) {
    throw new Error("Missing Mux playback id — cannot build analysis URL.");
  }

  // Single canonical source: highest.mp4 built from playback_id. No legacy
  // high.mp4 fallback. The `allowOriginal` flag is preserved as a tier label
  // for downstream metrics, but the URL itself is identical.
  return {
    url: ensureValidMuxMp4Url({
      url: buildMuxHighestMp4Url(take.mux_playback_id),
      playbackId: take.mux_playback_id,
      kind: "primary",
    }),
    tier: allowOriginal ? "original" : "standard",
  };
}

export type RunProcessTakeResult =
  | { ok: true; tier?: Tier; alreadyDone?: boolean; alreadyRunning?: boolean }
  | { ok: false; error: string };

export type RunProcessTakeOptions = {
  preClaimed?: boolean;
  includeErrorRetry?: boolean;
};

type AnalysisRunClaimPhase = "analysis_pending" | "analysing" | "finalising";

export type AnalysisRunClaimResult =
  | { kind: "claimed" }
  | { kind: "already_complete" }
  | { kind: "already_processing"; processingPhase: string | null }
  | { kind: "stale_processing"; processingPhase: string | null }
  | { kind: "not_runnable"; status: string | null; processingPhase: string | null }
  | { kind: "missing" }
  | { kind: "error"; error: string };

const ANALYSIS_RUNNABLE_PROCESSING_PHASES = ["analysis_pending", "queued", "pending"] as const;
const ANALYSIS_ACTIVE_PROCESSING_PHASES: readonly AnalysisRunClaimPhase[] = [
  "analysis_pending",
  "analysing",
  "finalising",
];
const ANALYSIS_PENDING_CLAIM_FILTER = `and(status.eq.pending,processing_phase.in.(${ANALYSIS_RUNNABLE_PROCESSING_PHASES.join(
  ",",
)}))`;
const ANALYSIS_RETRY_ERROR_CLAIM_FILTER = "and(status.eq.error,processing_phase.eq.error)";

function isAnalysisActiveProcessingPhase(phase: string | null): phase is AnalysisRunClaimPhase {
  return ANALYSIS_ACTIVE_PROCESSING_PHASES.includes(phase as AnalysisRunClaimPhase);
}

function classifyAnalysisRunClaimRow(
  row: {
    status: string | null;
    processing_phase: string | null;
    updated_at: string | null;
  },
  now: number,
): Exclude<AnalysisRunClaimResult, { kind: "claimed" | "missing" | "error" }> {
  if (row.status === "complete") return { kind: "already_complete" };

  if (row.status === "processing" && isAnalysisActiveProcessingPhase(row.processing_phase)) {
    const updatedAtMs = row.updated_at ? Date.parse(row.updated_at) : Number.NaN;
    const idleMs = Number.isFinite(updatedAtMs)
      ? Math.max(0, now - updatedAtMs)
      : Number.POSITIVE_INFINITY;
    const staleMs =
      row.processing_phase === "finalising" ? FINALISING_ORPHAN_MS : ANALYSING_ORPHAN_MS;

    if (idleMs < staleMs) {
      return { kind: "already_processing", processingPhase: row.processing_phase };
    }
    return { kind: "stale_processing", processingPhase: row.processing_phase };
  }

  return {
    kind: "not_runnable",
    status: row.status,
    processingPhase: row.processing_phase,
  };
}

/**
 * Atomically claims one runnable analysis row before expensive AI/report work.
 * The conditional update is the ownership boundary: duplicate queue deliveries
 * may all reach this helper, but only the caller that updates the row continues.
 * Manual retry callers may opt into non-cancelled error/error rows; cancelled
 * rows return before this helper is called.
 */
export async function claimAnalysisRunForTake(
  takeId: string,
  now = Date.now(),
  options: { includeErrorRetry?: boolean } = {},
): Promise<AnalysisRunClaimResult> {
  const claimedAt = new Date(now).toISOString();
  const claimFilter = options.includeErrorRetry
    ? `${ANALYSIS_PENDING_CLAIM_FILTER},${ANALYSIS_RETRY_ERROR_CLAIM_FILTER}`
    : ANALYSIS_PENDING_CLAIM_FILTER;
  const { data: claimedRows, error: claimErr } = await supabaseAdmin
    .from("takes")
    .update({
      status: "processing",
      processing_phase: "analysing",
      error_message: null,
      analysis_run_id: buildS10TakeAnalysisRunId(takeId),
      report_model_status: "pending",
      updated_at: claimedAt,
    })
    .eq("id", takeId)
    .or(claimFilter)
    .select("id");

  if (claimErr) {
    console.error("[take-pipeline] analysis claim failed", {
      take_id: takeId,
      error: claimErr.message,
    });
    metric("phase_transition_failure", {
      take_id: takeId,
      reason: "analysis_claim_failed",
    });
    return { kind: "error", error: "analysis_claim_failed" };
  }

  if (Array.isArray(claimedRows) && claimedRows.length > 0) {
    return { kind: "claimed" };
  }

  const { data: current, error: readErr } = await supabaseAdmin
    .from("takes")
    .select("status, processing_phase, updated_at")
    .eq("id", takeId)
    .maybeSingle();

  if (readErr) {
    console.error("[take-pipeline] analysis claim reread failed", {
      take_id: takeId,
      error: readErr.message,
    });
    return { kind: "error", error: "analysis_claim_reread_failed" };
  }
  if (!current) return { kind: "missing" };

  return classifyAnalysisRunClaimRow(
    {
      status: current.status ?? null,
      processing_phase: current.processing_phase ?? null,
      updated_at: current.updated_at ?? null,
    },
    now,
  );
}

export type SubmissionVerdict = {
  // Plain-language label shown directly to the user. Canonical set — keep in
  // sync with VerdictLabel in src/lib/audition-rules.ts.
  label: "Strong for this level" | "Ready to submit" | "Worth another take" | "Not ready yet";
  // One short sentence explaining the verdict. Never empty.
  reason: string;
  // True when a hard blocker forced the verdict below what the score alone would suggest.
  blocked: boolean;
};

/**
 * Deterministic submission verdict — LEVEL-AWARE.
 *
 * Bands come from bandsForLevel(level). Hard blockers cap at "Worth another
 * take" (or worse). Strong-for-this-level additionally requires no category
 * < 70 and brief_adherence ≥ 60 in BRIEF mode.
 */
export function computeSubmissionVerdict(input: {
  overall: number;
  audioScore: number | null;
  technicalScore: number | null;
  briefAdherence: number | null;
  mode: "brief" | "baseline";
  atRisk: boolean;
  riskFlags: Array<{ severity: "low" | "medium" | "high"; flag: string }>;
  level?: AuditionLevel;
  scores?: Record<string, number | null | undefined>;
}): SubmissionVerdict {
  const level: AuditionLevel = input.level ?? "emerging";
  const scoresForGating = {
    audio: input.audioScore ?? undefined,
    technical: input.technicalScore ?? undefined,
    ...(input.scores ?? {}),
  };
  const blockers = computeBlockers({
    scores: scoresForGating,
    briefAdherence: input.briefAdherence,
    mode: input.mode,
    riskFlags: input.atRisk
      ? [...input.riskFlags, { severity: "high" as const, flag: "Model flagged at_risk" }]
      : input.riskFlags,
  });

  const { label, capped, reason } = applyCapsAndLabel({
    overall: input.overall,
    scores: scoresForGating,
    briefAdherence: input.briefAdherence,
    mode: input.mode,
    level,
    blockers,
  });

  // Use canonical labels everywhere — no legacy "Strong submit".
  const finalLabel: SubmissionVerdict["label"] = label;
  const isBlocked = blockers.length > 0;

  let verdictReason: string;
  if (isBlocked) {
    // Blocked → reason MUST reference the main block_reason.
    verdictReason = `Blocked: ${blockers[0].message}.`;
  } else if (capped && reason) {
    verdictReason = `Score sits high, but ${reason} — fix that before sending it out.`;
  } else if (finalLabel === "Strong for this level") {
    verdictReason = "Lands strongly at your level — send with confidence.";
  } else if (finalLabel === "Ready to submit") {
    verdictReason = "Solid, castable tape — safe to send as-is.";
  } else if (finalLabel === "Worth another take") {
    verdictReason = "Close, but a focused retake will lift this above the submission bar.";
  } else {
    verdictReason = "Not ready to send — work the priority fix and shoot a fresh take.";
  }

  // Defensive: never allow an empty reason to escape.
  if (!verdictReason || !verdictReason.trim()) {
    verdictReason =
      finalLabel === "Strong for this level" || finalLabel === "Ready to submit"
        ? `${finalLabel}.`
        : "Needs another take before submitting.";
  }

  return {
    label: finalLabel,
    reason: toUKTerms(verdictReason),
    blocked: isBlocked,
  };
}

/**
 * Internal Gemini analysis pipeline. NOT auth-gated — the caller is
 * responsible for authorisation (webhook signature verification, or
 * authenticated server function with ownership check).
 */
export async function runProcessTake(
  takeId: string,
  allowOriginal = false,
  options: RunProcessTakeOptions = {},
): Promise<RunProcessTakeResult> {
  const runStartedAt = Date.now();
  const { data: take, error: takeErr } = await supabaseAdmin
    .from("takes")
    .select(
      "id, user_id, audition_id, signals, checklist, status, processing_phase, attempt_count, mux_status, mux_asset_id, mux_playback_id, mux_mp4_standard_url, mux_mp4_high_url, mux_duration_seconds, created_at, updated_at, error_message, credit_reservation_id, credit_lifecycle_status, credit_is_synthetic_usage",
    )
    .eq("id", takeId)
    .single();

  if (takeErr || !take) {
    return { ok: false, error: "Take not found" };
  }
  const analysisRunId = buildS10TakeAnalysisRunId(takeId);
  if (take.status === "complete") {
    return { ok: true, alreadyDone: true };
  }
  // Cancellation guard: if the user cancelled while the webhook was in flight,
  // do not proceed. resetTake marks the row as errored with a "Cancelled by
  // user" message — treat that as a terminal stop so a delayed webhook /
  // reconciler can't restart analysis on a cancelled take.
  if (
    take.status === "error" &&
    typeof take.error_message === "string" &&
    take.error_message.toLowerCase().includes("cancelled")
  ) {
    console.log("runProcessTake: take cancelled by user, skipping", { takeId });
    metric("cancel", {
      take_id: takeId,
      processing_phase: take.processing_phase,
      reason: "already_cancelled_at_entry",
    });
    return { ok: true, alreadyDone: true };
  }

  if (take.mux_duration_seconds != null && Number.isFinite(Number(take.mux_duration_seconds))) {
    const hardCapBlock = await blockTakeForVideoDurationHardCap({
      takeId,
      durationSeconds: Number(take.mux_duration_seconds),
      source: "run_process_take_entry",
      muxAssetId: take.mux_asset_id ?? null,
      muxPlaybackId: take.mux_playback_id ?? null,
    });
    if (hardCapBlock.blocked) {
      console.warn("runProcessTake: over-hard-cap video blocked before analysis", {
        takeId,
        duration_seconds: hardCapBlock.durationSeconds,
        update_persisted: hardCapBlock.updated,
      });
      return { ok: false, error: VIDEO_DURATION_HARD_CAP_COPY };
    }
  }

  if (!options.preClaimed) {
    const claim = await claimAnalysisRunForTake(takeId, Date.now(), {
      includeErrorRetry: options.includeErrorRetry === true,
    });
    if (claim.kind !== "claimed") {
      if (claim.kind === "already_complete") {
        return { ok: true, alreadyDone: true };
      }
      if (claim.kind === "already_processing" || claim.kind === "stale_processing") {
        console.log("already_running_skip", {
          take_id: takeId,
          processing_phase: claim.processingPhase,
          attempt_count: take.attempt_count ?? 0,
          claim_state: claim.kind,
        });
        metric("already_running_skip", {
          take_id: takeId,
          processing_phase: claim.processingPhase,
          attempt: take.attempt_count ?? 0,
          reason: claim.kind,
        });
        return { ok: true, alreadyRunning: true };
      }
      if (claim.kind === "missing") {
        return { ok: false, error: "Take not found" };
      }
      if (claim.kind === "error") {
        return { ok: false, error: "Could not claim analysis run" };
      }

      console.log("analysis_not_runnable_skip", {
        take_id: takeId,
        status: claim.status,
        processing_phase: claim.processingPhase,
      });
      metric("already_running_skip", {
        take_id: takeId,
        processing_phase: claim.processingPhase,
        attempt: take.attempt_count ?? 0,
        reason: "analysis_not_runnable",
      });
      return { ok: true, alreadyRunning: true };
    }
  }

  // Idempotency: if a pipeline is already running for this take (claimed work
  // in `analysing`, deterministic finalisation, or a legacy active
  // `analysis_pending` row), bail out early. Prevents duplicate Gemini
  // requests and duplicate poll loops when retry is clicked mid-flight or when
  // the webhook + reconciler race each other.
  if (
    !options.preClaimed &&
    take.status === "processing" &&
    (take.processing_phase === "analysing" ||
      take.processing_phase === "analysis_pending" ||
      take.processing_phase === "finalising")
  ) {
    console.log("already_running_skip", {
      take_id: takeId,
      processing_phase: take.processing_phase,
      attempt_count: take.attempt_count ?? 0,
    });
    metric("already_running_skip", {
      take_id: takeId,
      processing_phase: take.processing_phase,
      attempt: take.attempt_count ?? 0,
    });
    return { ok: true, alreadyRunning: true };
  }

  const elapsedSinceCreatedMs = () => Date.now() - new Date(take.created_at).getTime();
  const baseLog = {
    take_id: takeId,
    audition_id: take.audition_id,
    mux_asset_id: take.mux_asset_id ?? null,
    mux_playback_id: take.mux_playback_id ?? null,
    attempt_count: take.attempt_count ?? 0,
  };
  console.log("[take-pipeline] runProcessTake started", {
    ...baseLog,
    processing_phase: take.processing_phase,
    elapsed_ms_since_upload: elapsedSinceCreatedMs(),
  });
  metric("analysis_started", {
    take_id: takeId,
    processing_phase: take.processing_phase,
    attempt: take.attempt_count ?? 0,
  });

  const { data: audition, error: audErr } = await supabaseAdmin
    .from("auditions")
    .select("id, brief, brief_source, mode, title, audition_level, extracted_brief")
    .eq("id", take.audition_id)
    .single();

  if (audErr || !audition) {
    return { ok: false, error: "Audition not found" };
  }

  const auditionLevel = ((audition as { audition_level?: string }).audition_level ??
    "emerging") as AuditionLevel;
  const aiUsageContext: TakeAiUsageContext = {
    takeId,
    auditionId: audition.id,
    userId: take.user_id ?? null,
    muxDurationSeconds: take.mux_duration_seconds ?? null,
    signals: take.signals ?? null,
    checklist: take.checklist ?? null,
  };

  // Structured brief extraction (cached on the audition row). Skip in baseline
  // mode (no brief) or when we've already extracted previously.
  //
  // Cache reuse rules:
  //   - Reuse only when _source !== "fallback" (i.e. real AI-sourced brief).
  //   - Treat as cache miss if _source === "fallback", OR if the cached brief
  //     looks like a degraded fallback (low confidence + audition_type unknown).
  //   - On re-extract: AI success overwrites the cached fallback. AI failure
  //     uses fallback for THIS run only and does NOT overwrite an existing
  //     AI-sourced cache. If there is no cache at all, fallback is persisted
  //     with _source="fallback" so it is never treated as permanent.
  type CachedBrief = ExtractedBrief & {
    _extraction_confidence?: "low" | "medium" | "high";
    _source?: "ai" | "fallback";
  };
  const rawCached = ((audition as { extracted_brief?: CachedBrief | null }).extracted_brief ??
    null) as CachedBrief | null;
  const suppliedBriefText = typeof audition.brief === "string" ? audition.brief.trim() : "";
  const cachedSource = rawCached?._source;
  const cachedConfidence = rawCached?._extraction_confidence;
  const looksLikeDegradedFallback =
    rawCached != null && cachedConfidence === "low" && rawCached.audition_type === "unknown";
  const cachedHasS10BriefRequirements =
    rawCached?.brief_intelligence_prompt_version === S10_BRIEF_INTELLIGENCE_PROMPT_VERSION &&
    Array.isArray(rawCached.brief_requirements) &&
    rawCached.brief_requirements.length > 0;
  const cacheReusable =
    rawCached != null &&
    cachedSource !== "fallback" &&
    !looksLikeDegradedFallback &&
    (suppliedBriefText.length <= 5 || cachedHasS10BriefRequirements);

  let extractedBrief: ExtractedBrief | null = cacheReusable ? rawCached : null;
  let extractionConfidence: "low" | "medium" | "high" | "unknown" = cacheReusable
    ? (cachedConfidence ?? "unknown")
    : "unknown";

  if (cacheReusable) {
    console.info("[take-pipeline] brief_extraction_cache_hit_ai", {
      audition_id: audition.id,
      extraction_confidence: cachedConfidence ?? "unknown",
    });
  } else if (rawCached != null) {
    console.info("[take-pipeline] brief_extraction_cache_miss_fallback", {
      audition_id: audition.id,
      cached_source: cachedSource ?? "legacy",
      cached_confidence: cachedConfidence ?? "unknown",
    });
  }

  // Keep claimed work in the active analysing phase while prerequisites are
  // resolved. `analysis_pending` is reserved for queued-but-not-yet-claimed
  // rows so the stale-pending reconciler cannot undo an active claim.
  await supabaseAdmin
    .from("takes")
    .update({
      status: "processing",
      processing_phase: "analysing",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", takeId);

  // ---- Hard timeout / retry-cap finaliser scaffolding ----
  // Defaults are intentionally aggressive to prevent the 10-minute wall-clock
  // bug where a stuck Gemini call burns the entire E2E budget. Override via
  // env if a workspace needs different bounds.
  const ANALYSIS_GEMINI_TIMEOUT_MS = Number(process.env.ANALYSIS_GEMINI_TIMEOUT_MS ?? 90_000);
  const ANALYSIS_TOTAL_TIMEOUT_MS = Number(process.env.ANALYSIS_TOTAL_TIMEOUT_MS ?? 540_000);
  const ANALYSIS_MAX_RETRIES = Number(process.env.ANALYSIS_MAX_RETRIES ?? 1);

  type FailureCode =
    | "gemini_timeout"
    | "gemini_429"
    | "gemini_5xx"
    | "ai_network_error"
    | "ai_credits_exhausted"
    | "ai_non_retryable_4xx"
    | "provider_request_contract_error"
    | "report_polish_failed"
    | "report_polish_timeout"
    | "analysis_total_timeout"
    | "analysis_parse_failed"
    | "analysis_persist_failed"
    | "brief_intelligence_unavailable"
    | "analysis_no_terminal_state"
    | "mux_invalid_mp4_url"
    | "mux_static_rendition_timeout"
    | "mux_static_rendition_errored"
    | "mux_static_rendition_skipped"
    | "stale_timeout"
    | "report_credit_unavailable";

  // Terminal-state tracking: any path that writes status=error/complete must
  // flip this to true so the finally-block fallback doesn't double-write.
  let terminalWritten = false;
  // Intentional non-terminal exit (e.g. media prerequisite not yet ready). When
  // true, the finally-block safety net MUST NOT mark the take as failed.
  let deferredPending = false;
  // Hoisted so the outer catch can attribute failures to the finalising
  // substage. 0 = AI hasn't returned yet; >0 = post-AI work in progress.
  let finaliseStartedAt = 0;
  const preReportQaArtefactIds: string[] = [];
  const preReportQaBlockedArtefactIds: string[] = [];
  let preReportFailureManifestEmitted = false;
  let activeReportCreditReservationId: string | null =
    (take as { credit_reservation_id?: string | null }).credit_reservation_id ?? null;
  let activeReportCreditSyntheticUsage =
    (take as { credit_is_synthetic_usage?: boolean | null }).credit_is_synthetic_usage === true;
  let activeReportCreditMode: CreditMode = "standard";
  let activeReportCreditShouldDecrement = true;

  const refundActiveReportCredit = async (failureCode: string, message: string): Promise<void> => {
    if (!activeReportCreditReservationId) return;
    try {
      await releaseReportCreditForTake({
        take_id: takeId,
        release_status: "refunded",
        release_reason: "report_generation_failed",
        failure_code: failureCode,
        metadata: {
          trigger: "run_process_take_failure",
          failure_code: failureCode,
          safe_error_message: message.slice(0, 180),
          report_credit_restored_message:
            "Your TapeCoach credit was returned automatically because the report did not complete.",
          synthetic_usage: activeReportCreditSyntheticUsage,
        },
      });
      metric("report_credit_released", {
        take_id: takeId,
        reason: failureCode,
        release_status: "refunded",
        synthetic_usage: activeReportCreditSyntheticUsage,
      });
      void safeEnqueueCrmEmailForUser({
        userId: take.user_id,
        messageKey: "failed_report_credit_restored",
        idempotencyKey: `crm:failed_report_credit_restored:${take.user_id}:take:${takeId}:${
          activeReportCreditReservationId ?? "unknown"
        }`,
        templateData: {
          object_type: "take",
          object_id: takeId,
          audition_id: audition.id,
          failure_code: failureCode,
          context_line:
            "Your TapeCoach credit was returned automatically because the report did not complete.",
        },
      });
      activeReportCreditReservationId = null;
    } catch (creditErr) {
      console.error("[take-pipeline] report_credit_refund_failed", {
        take_id: takeId,
        failure_code: failureCode,
        error: creditErr instanceof Error ? creditErr.message : "unknown",
      });
    }
  };

  const rememberPreReportQa = (result: {
    emitted_artefact_ids?: string[];
    emitted_blocked_artefact_ids?: string[];
  }) => {
    for (const id of result.emitted_artefact_ids ?? []) {
      if (!preReportQaArtefactIds.includes(id)) preReportQaArtefactIds.push(id);
    }
    for (const id of result.emitted_blocked_artefact_ids ?? []) {
      if (!preReportQaBlockedArtefactIds.includes(id)) preReportQaBlockedArtefactIds.push(id);
    }
  };

  const emitPreReportFailureManifest = async (
    code: FailureCode,
    message: string,
  ): Promise<void> => {
    if (preReportFailureManifestEmitted) return;
    if (preReportQaArtefactIds.length === 0 && preReportQaBlockedArtefactIds.length === 0) return;
    preReportFailureManifestEmitted = true;
    try {
      const deferredArtefacts = [
        "raw_report",
        "evidence_anchors",
        "public_claim_trace",
        "claim_candidate_trace",
        "technique_observation_trace",
        "score_trace",
        "model_run_trace",
        "no_export_proof",
        "parity_report",
      ];
      const out = await emitQAManifestForAnalysisRun({
        run_id: `take-${takeId}`,
        submission_id: audition.id,
        take_ids: [takeId],
        route_module: "runProcessTake",
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
        mux_playback_ids: take.mux_playback_id
          ? { take_1_mux_playback_id: take.mux_playback_id }
          : {},
        commit_sha: process.env.GIT_COMMIT_SHA,
        branch_name: process.env.GIT_BRANCH_NAME,
        emitted_artefact_ids: preReportQaArtefactIds,
        emitted_blocked_artefact_ids: preReportQaBlockedArtefactIds,
        deferred_artefact_ids: deferredArtefacts,
        defect_risk_ids: [`analysis_generation_failed:${code}`],
        model_run_trace_summary: {
          model_run_trace_gate_status: "insufficient",
          failed_stage: "analysis_step_2_judgement_or_report_generation",
          failure_code: code,
          safe_error_message: message.slice(0, 180),
        },
      });
      console.warn("[take-pipeline] pre_report_failure_qa_manifest_emitted", {
        take_id: takeId,
        failure_code: code,
        written: out.written,
        emitted_artefact_ids: preReportQaArtefactIds,
        deferred_artefact_ids: deferredArtefacts,
      });
    } catch (qaErr) {
      console.warn("[take-pipeline] pre_report_failure_qa_manifest_failed", {
        take_id: takeId,
        failure_code: code,
        warning: qaErr instanceof Error ? qaErr.message : "unknown",
      });
    }
  };

  const markTerminalFailure = async (
    code: FailureCode,
    message: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> => {
    if (terminalWritten) return;
    await refundActiveReportCredit(code, message);
    const errorMessage = `[failure_code:${code}] ${message}`;
    try {
      const { error: writeErr } = await supabaseAdmin
        .from("takes")
        .update({
          status: "error",
          processing_phase: "error",
          error_message: errorMessage,
          analysis_run_id: analysisRunId,
          report_model_status: "failed",
        })
        .eq("id", takeId);
      if (writeErr) throw writeErr;
      terminalWritten = true;
    } catch (writeErr) {
      console.error("[take-pipeline] markTerminalFailure write error", writeErr);
      return;
    }
    metric("analysis_terminal", {
      take_id: takeId,
      reason: code,
      failure_code: code,
      duration_ms: Date.now() - runStartedAt,
      ...extra,
    });
    console.warn("[take-pipeline] analysis_terminal", {
      take_id: takeId,
      failure_code: code,
      message,
      ...extra,
    });
  };

  // Carries a failure_code on errors thrown from the Gemini retry loop so the
  // outer catch can route them through markTerminalFailure with the right tag.
  class AnalysisFailure extends Error {
    failureCode: FailureCode;
    constructor(code: FailureCode, message: string) {
      super(message);
      this.failureCode = code;
    }
  }

  try {
    try {
      const reservation = await reserveReportCreditForTake({
        take_id: takeId,
        requested_by_user_id: take.user_id,
        metadata: {
          trigger: "run_process_take",
          report_credit_amount: 1,
          same_video_credit_policy: "consume_only_if_report_generated",
          commercial_metrics_excluded: false,
        },
      });
      activeReportCreditReservationId = reservation.credit_reservation_id;
      activeReportCreditSyntheticUsage = reservation.synthetic_usage;
      activeReportCreditMode = reservation.credit_mode;
      activeReportCreditShouldDecrement = reservation.should_decrement_credit;
      if (reservation.requires_credit_reservation) {
        metric("report_credit_reserved", {
          take_id: takeId,
          reason: "run_process_take",
          synthetic_usage: reservation.synthetic_usage,
        });
      }
      void recordServerAnalyticsEvent({
        eventName: "report_started",
        userId: take.user_id,
        objectType: "take",
        objectId: takeId,
        auditionId: take.audition_id,
        takeId,
        properties: {
          processing_phase: take.processing_phase,
          credit_mode: reservation.credit_mode,
          synthetic_usage: reservation.synthetic_usage,
        },
      });
      void safeEnqueueCrmEmailForUser({
        userId: take.user_id,
        messageKey: "report_started",
        idempotencyKey: `crm:report_started:${take.user_id}:take:${takeId}:${
          reservation.credit_reservation_id ?? reservation.credit_mode
        }`,
        templateData: {
          object_type: "take",
          object_id: takeId,
          audition_id: take.audition_id,
          processing_phase: take.processing_phase,
          credit_mode: reservation.credit_mode,
          synthetic_usage: reservation.synthetic_usage,
          context_line: "Your self-tape report has started processing.",
        },
      });
    } catch (creditErr) {
      if (creditErr instanceof ReportCreditRequiredError) {
        metric("report_credit_rejected", {
          take_id: takeId,
          reason: "run_process_take_no_funded_credit",
        });
        throw new AnalysisFailure("report_credit_unavailable", creditErr.message);
      }
      throw creditErr;
    }

    if (!extractedBrief && suppliedBriefText.length > 5) {
      const result = await extractBriefFromText(suppliedBriefText, aiUsageContext);
      if (result) {
        extractedBrief = result.brief;
        extractionConfidence = result.extraction_confidence;

        const hasExistingAiCache = rawCached != null && cachedSource === "ai";
        const shouldPersist =
          result.source === "ai"
            ? true // AI success: always persist (overwrites any fallback cache)
            : !hasExistingAiCache; // fallback: persist only if no AI cache exists

        if (shouldPersist) {
          await supabaseAdmin
            .from("auditions")
            .update({
              extracted_brief: {
                ...result.brief,
                _extraction_confidence: result.extraction_confidence,
                _source: result.source,
              } as never,
            })
            .eq("id", audition.id);
          if (result.source === "ai") {
            console.info("[take-pipeline] brief_extraction_ai_cached", {
              audition_id: audition.id,
              extraction_confidence: result.extraction_confidence,
            });
          }
        }

        if (result.source === "fallback") {
          console.info("[take-pipeline] brief_extraction_fallback_used", {
            audition_id: audition.id,
            persisted: shouldPersist,
            had_existing_ai_cache: hasExistingAiCache,
          });
        }
      }
    }

    const s10BriefRuntimeFacts = deriveS10BriefRuntimeFacts(extractedBrief);
    const s10BriefRequirementsReady =
      suppliedBriefText.length <= 5 ||
      (extractedBrief?.brief_intelligence_prompt_version ===
        S10_BRIEF_INTELLIGENCE_PROMPT_VERSION &&
        Array.isArray(extractedBrief.brief_requirements) &&
        extractedBrief.brief_requirements.length > 0);

    if (!s10BriefRequirementsReady) {
      console.warn("[take-pipeline] s10_brief_requirements_missing_before_analysis", {
        take_id: takeId,
        audition_id: audition.id,
        prompt_version: extractedBrief?.brief_intelligence_prompt_version ?? null,
        requirement_count: extractedBrief?.brief_requirements?.length ?? 0,
        extraction_confidence: extractionConfidence,
      });
      throw new AnalysisFailure(
        "brief_intelligence_unavailable",
        "We couldn’t read the casting brief clearly enough to check the required material. Please try again.",
      );
    }

    const { tier } = await pickAnalysisSource(take, allowOriginal);

    // ---- Deterministic Mux readiness gate ----
    //
    // Trust `video.asset.static_rendition.ready` (the webhook that brought us
    // here, or the reconciler's Mux API check) as the authoritative readiness
    // signal. We do NOT re-run a multi-method probe loop here — that path was
    // unreliable against Mux's Varnish layer and caused indefinite
    // "Preparing analysis" loops on transient 404s.
    //
    // Rules:
    //   - mux_status MUST be "ready" and mux_playback_id MUST be present.
    //   - The MP4 URL is built canonically from mux_playback_id.
    //     Stored URL fields are ignored on the active path.
    //   - One short HEAD courtesy check (3s timeout) is performed for
    //     observability only — its result does NOT gate analysis. If Mux
    //     said the rendition is ready, we proceed.
    //   - No legacy high.mp4. No range/browser GET fallbacks. No deferral
    //     loop. The reconciler's wall-clock cap remains the only safety net.
    const probeStartedWallclock = Date.now();

    if (take.mux_status !== "ready" || !take.mux_playback_id) {
      // Mux not ready yet. Keep the claimed row active; static-rendition
      // webhooks and the active stale-analysis recovery path own any later
      // recovery. Do NOT fail terminally here unless we've blown the
      // wall-clock cap.
      const PREPARE_HARD_TIMEOUT_MS = 10 * 60_000;
      const ageMs = elapsedSinceCreatedMs() ?? 0;
      if (ageMs >= PREPARE_HARD_TIMEOUT_MS) {
        await markTerminalFailure(
          "mux_static_rendition_timeout",
          "We couldn't prepare your video in time. Please try again.",
          { age_ms: ageMs },
        );
        return {
          ok: false,
          error: "We couldn't prepare your video in time. Please try again.",
        };
      }
      console.log("mux_not_ready_yet_deferring", {
        ...baseLog,
        mux_status: take.mux_status,
        has_playback_id: Boolean(take.mux_playback_id),
        age_ms: ageMs,
        deferred_reason: "mux_not_ready",
      });
      metric("preparation_deferred", {
        take_id: takeId,
        processing_phase: "analysing",
        age_ms: ageMs,
        reason: "mux_not_ready",
      });
      deferredPending = true;
      return { ok: true, alreadyDone: false };
    }

    let resolvedProbeUrl: string;
    try {
      resolvedProbeUrl = ensureValidMuxMp4Url({
        url: buildMuxHighestMp4Url(take.mux_playback_id),
        playbackId: take.mux_playback_id,
        kind: "primary",
      });
    } catch {
      await markTerminalFailure(
        "mux_invalid_mp4_url",
        "Invalid Mux MP4 URL generated. Please try again.",
      );
      return {
        ok: false,
        error: "Invalid Mux MP4 URL generated. Please try again.",
      };
    }

    // Courtesy HEAD probe — observability only. Never blocks analysis.
    let courtesyHeadStatus: number | null = null;
    let courtesyHeadError: string | null = null;
    {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3_000);
      let r: Response | null = null;
      try {
        r = await fetch(resolvedProbeUrl, {
          method: "HEAD",
          headers: MUX_NO_CACHE_HEADERS,
          cache: "no-store",
          signal: ctrl.signal,
        });
        courtesyHeadStatus = r.status;
      } catch (err) {
        courtesyHeadError = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(t);
        try {
          await r?.body?.cancel();
        } catch {
          /* ignore */
        }
      }
    }
    console.log("mux_prepare_ready", {
      ...baseLog,
      canonical_url: resolvedProbeUrl,
      courtesy_head_status: courtesyHeadStatus,
      courtesy_head_error: courtesyHeadError,
      selected_url: resolvedProbeUrl,
      selected_probe_method: "static_rendition_ready",
    });
    metric("static_mp4_ready", {
      take_id: takeId,
      duration_ms: Date.now() - probeStartedWallclock,
      attempt: 1,
      tier,
    });

    // Re-check cancellation immediately before the analysing flip.
    const { data: postPoll } = await supabaseAdmin
      .from("takes")
      .select("status, error_message")
      .eq("id", takeId)
      .single();
    if (
      postPoll?.status === "error" &&
      typeof postPoll.error_message === "string" &&
      postPoll.error_message.toLowerCase().includes("cancelled")
    ) {
      console.log("[take-pipeline] cancelled before analysing flip, aborting", baseLog);
      metric("cancel", {
        take_id: takeId,
        processing_phase: "analysis_pending",
        duration_ms: Date.now() - probeStartedWallclock,
        reason: "after_preparation",
      });
      metric("analysis_abandoned", { take_id: takeId, processing_phase: "analysis_pending" });
      return { ok: true, alreadyDone: true };
    }

    const preparationDurationMs = Date.now() - probeStartedWallclock;
    console.log("[take-pipeline] mux ready, transitioning to analysing", {
      ...baseLog,
      analysis_tier: tier,
      elapsed_ms_since_upload: elapsedSinceCreatedMs(),
      selected_url: resolvedProbeUrl,
    });
    metric("preparation_completed", {
      take_id: takeId,
      duration_ms: preparationDurationMs,
      tier,
    });
    metric("analysis_pending_to_analysing", {
      take_id: takeId,
      duration_ms: preparationDurationMs,
    });

    // NOW flip into the active analysing phase — Gemini call is next.
    await supabaseAdmin
      .from("takes")
      .update({
        status: "processing",
        processing_phase: "analysing",
        error_message: null,
        attempt_count: (take.attempt_count ?? 0) + 1,
        analysis_tier: tier,
      })
      .eq("id", takeId);

    const briefBlock = audition.brief
      ? `CASTING BRIEF (${audition.brief_source}):\n${audition.brief}`
      : `NO CASTING BRIEF PROVIDED — apply BASELINE rubric (treat as professional standards). Do not invent constraints.`;

    const extractedBlock = extractedBrief
      ? `STRUCTURED BRIEF (parsed):\n${JSON.stringify(extractedBrief, null, 2)}`
      : "STRUCTURED BRIEF: none.";

    const signalsBlock = `TECHNICAL SIGNALS (modifiers, not primary):\n${JSON.stringify(
      { signals: take.signals, checklist: take.checklist },
      null,
      2,
    )}`;

    const levelBlock = buildS10PerformerLevelPromptBlock(auditionLevel);

    const userText = [
      `Audition title: ${audition.title}`,
      levelBlock,
      briefBlock,
      extractedBlock,
      signalsBlock,
      `Analysis tier: ${tier} rendition (the user's original performance is intact — only technical encoding was standardised).`,
      "Watch and listen to the attached self-tape, structure it (detect components), and submit a structured report via the submit_audition_report tool. Use British English throughout (recall not callback, casting brief, self-tape, analysing, prioritised, behaviour, centre). Be specific, prioritised, and constructive.",
    ].join("\n\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    // POST_AI_FINALISE_TIMEOUT_MS bounds parse + scrubs + score recompute +
    // persist combined as a wall-clock deadline from the start of finalising.
    // Default is 90s — long enough for normal post-processing + persistence,
    // short enough that we never leave a take stuck on "Finalising results".
    const POST_AI_FINALISE_TIMEOUT_MS = Number(process.env.POST_AI_FINALISE_TIMEOUT_MS ?? 90_000);
    const finaliseExceeded = () =>
      finaliseStartedAt > 0 && Date.now() - finaliseStartedAt > POST_AI_FINALISE_TIMEOUT_MS;
    const finaliseElapsedMs = () => (finaliseStartedAt > 0 ? Date.now() - finaliseStartedAt : 0);
    // Emit a finalising_timeout marker + throw a tagged failure so the
    // outer catch parks the take in `error` with a recoverable message.
    const throwFinaliseTimeout = (substage: string): never => {
      const elapsed = finaliseElapsedMs();
      console.warn("[take-pipeline] finalising_timeout", {
        take_id: takeId,
        substage,
        finalising_duration_ms: elapsed,
        two_step_enabled: isTwoStepEnabled(),
      });
      metric("analysis_persist_failed", {
        take_id: takeId,
        reason: `finalising_timeout:${substage}`,
        duration_ms: elapsed,
      });
      throw new AnalysisFailure(
        "analysis_persist_failed",
        "We couldn’t finish your report this time. Please try again.",
      );
    };

    // ---- Two-step pipeline (feature-flagged) ----
    // When TWO_STEP_ANALYSIS_ENABLED === "true", run Step 1 (multimodal
    // evidence pass) then Step 2 (text-only polish using REPORT_TOOL). Step 1
    // evidence stays in memory; only a compact non-sensitive summary is
    // persisted into score_breakdown.two_step. If either step fails entirely,
    // fall back to a deterministic renderer derived from Step 1 evidence.
    // When the flag is unset/false, the existing single-pass code path runs
    // unchanged.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let twoStepReport: any = null;
    let twoStepEvidence: EvidencePass | null = null;
    // Phase 3B — captured future dimensions (Phase 1 internal output) so the
    // v2 report builder can use them at the persist site. Stays null when
    // future_evidence_enabled is off; the v2 builder then falls back to
    // legacy `detected_components`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedFutureDimensions: any = null;
    const twoStepEnforcement = {
      locked_field_overwrites: 0,
      unsupported_claims_removed: 0,
      unsupported_claims_rewritten: 0,
    };
    let twoStepTimestampsDropped = 0;
    let evidencePassDurationMs = 0;
    let reportPolishDurationMs = 0;
    let reportPolishStartedAtIso: string | null = null;
    let reportPolishCompletedAtIso: string | null = null;
    let reportPolishModel: string | null = null;
    let reportPolishHttpStatus: number | null = null;
    let reportPolishRequestStatus: "completed" | "failed" | "timed_out" | null = null;
    let reportPolishParseStatus: "completed" | "unknown" = "unknown";
    let twoStepFallbackUsed = false;
    let twoStepFallbackReason: string | null = null;
    let polishRetryAttempted = false;
    let polishRetrySucceeded = false;
    let reportPolishFallbackPersisted = false;
    let moduleRepairRetryAttempted = false;
    let moduleRepairRetrySucceeded = false;
    let s10ModuleQualityRecoveryUsed = false;
    let moduleQualityRecoveryReason: string | null = null;
    let s10ModuleQualityRecoveryPersisted = false;
    let residualModuleRecoveryUsed = false;
    let residualModulesRecovered: string[] = [];
    const hasSufficientStep1EvidenceForModuleRecovery = (evidence: EvidencePass | null) => {
      if (!evidence) return false;
      const hasObservation =
        (evidence.observed_tape_sequence?.length ?? 0) > 0 ||
        (evidence.component_verifications?.length ?? 0) > 0 ||
        (evidence.timestamped_evidence?.length ?? 0) > 0 ||
        evidence.core_strengths_evidence.length > 0 ||
        evidence.core_improvements_evidence.length > 0 ||
        (evidence.candidate_technique_evidence?.length ?? 0) > 0;
      const sufficiency = evidence.evidence_sufficiency;
      const hasAssessableSignal =
        sufficiency.audio_assessable ||
        sufficiency.video_assessable ||
        sufficiency.acting_assessable ||
        sufficiency.vocal_assessable ||
        sufficiency.movement_assessable ||
        sufficiency.brief_assessable;
      return hasObservation && hasAssessableSignal;
    };
    let evidencePassStartedAtIso: string | null = null;
    let evidencePassCompletedAtIso: string | null = null;
    let evidencePassModel: string | null = null;
    let evidencePassHttpStatus: number | null = null;
    let evidencePassRequestStatus: "completed" | "failed" | "timed_out" | null = null;
    let evidencePassParseStatus: "completed" | "unknown" = "unknown";
    let evidencePassSafeErrorCategory: string | null = null;
    let preStep2InputArtefacts: Awaited<ReturnType<typeof emitAnalysisInputArtefacts>> | null =
      null;
    let preStep2ResolverTruth: Awaited<
      ReturnType<typeof emitResolverOutputAndTruthStateMap>
    > | null = null;
    let preStep2AnalysisEvidenceState: Awaited<
      ReturnType<typeof emitAnalysisEvidenceStatePrerequisite>
    > | null = null;

    const hasMeaningfulBriefValue = (value: unknown): boolean => {
      if (value == null) return false;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed || trimmed === "null" || trimmed === "{}" || trimmed === "[]") return false;
        try {
          return hasMeaningfulBriefValue(JSON.parse(trimmed));
        } catch {
          return trimmed.length > 0;
        }
      }
      if (Array.isArray(value)) return value.some((item) => hasMeaningfulBriefValue(item));
      if (typeof value === "object")
        return Object.values(value as Record<string, unknown>).some((v) =>
          hasMeaningfulBriefValue(v),
        );
      return true;
    };
    const buildQaStep1RuntimeContext = () => {
      const hasBrief = hasMeaningfulBriefValue(audition.brief);
      const hasExtractedBrief = hasMeaningfulBriefValue(audition.extracted_brief);
      const briefPresence: "supplied" | "absent" =
        hasBrief || hasExtractedBrief ? "supplied" : "absent";
      const briefPresenceSource:
        | "audition.brief"
        | "audition.extracted_brief_cached"
        | "audition.brief+audition.extracted_brief_cached"
        | "none_loaded" =
        hasBrief && hasExtractedBrief
          ? "audition.brief+audition.extracted_brief_cached"
          : hasBrief
            ? "audition.brief"
            : hasExtractedBrief
              ? "audition.extracted_brief_cached"
              : "none_loaded";
      const takeCreatedAt = safeIsoTimestamp(take.created_at);
      const takeUpdatedAt = safeIsoTimestamp(take.updated_at);
      const timestampWarnings = timestampNormalisationWarnings({
        take_created_at: take.created_at,
        take_updated_at: take.updated_at,
      });
      const unavailableInputFields = [
        "audition_type",
        "submission_created_at",
        "submission_updated_at",
        "take_index",
      ];
      if (s10BriefRuntimeFacts.material_presence === "unknown") {
        unavailableInputFields.push("material_presence_source");
      }
      if (s10BriefRuntimeFacts.component_or_task_declaration_status === "unknown") {
        unavailableInputFields.push("component_or_task_declaration");
      }
      if (!takeCreatedAt) unavailableInputFields.push("take_created_at");
      if (!takeUpdatedAt) unavailableInputFields.push("take_updated_at");
      const takeDurationSeconds = Number(
        (take as Record<string, unknown>).mux_duration_seconds ?? 0,
      );
      const durationKnown = Number.isFinite(takeDurationSeconds) && takeDurationSeconds > 0;
      const uploadIdentity = extractUploadIdentitySignals({
        signals: take.signals,
        checklist: take.checklist,
        muxDurationSeconds: take.mux_duration_seconds,
      });
      return {
        briefPresence,
        briefPresenceSource,
        takeCreatedAt,
        takeUpdatedAt,
        timestampWarnings,
        unavailableInputFields,
        takeDurationSeconds: durationKnown ? takeDurationSeconds : null,
        durationConfidence: durationKnown ? ("known" as const) : ("unknown" as const),
        uploadIdentity,
      };
    };

    if (isTwoStepEnabled()) {
      const twoStepStartedAt = Date.now();
      const evidenceContext = [
        `Audition title: ${audition.title}`,
        levelBlock,
        briefBlock,
        extractedBlock,
        signalsBlock,
        `Analysis tier: ${tier} rendition.`,
      ].join("\n\n");

      console.log("[take-pipeline] evidence_pass_started", {
        ...baseLog,
        analysis_tier: tier,
      });
      metric("evidence_pass_started", { take_id: takeId, tier });

      const evidenceUrl = ensureValidMuxMp4Url({
        url: resolvedProbeUrl,
        playbackId: take.mux_playback_id,
        kind: "gemini",
      });
      const evAc = new AbortController();
      const evTimer = setTimeout(() => evAc.abort(), ANALYSIS_GEMINI_TIMEOUT_MS);
      // Phase 1 — flag-gated internal dimension capture. Off by default.
      // Resolved per-take so admins can toggle without redeploy. Failure to
      // read config falls through to legacy behaviour.
      let withFutureDimensions = false;
      try {
        const { getResolvedConfig } = await import("./app-config.server");
        const cfg = await getResolvedConfig();
        withFutureDimensions = !!cfg.future_evidence_enabled;
      } catch {
        withFutureDimensions = false;
      }
      const evidencePassAttemptStart = Date.now();
      evidencePassStartedAtIso = new Date(evidencePassAttemptStart).toISOString();
      const evResult = await runEvidencePass({
        videoUrl: evidenceUrl,
        apiKey,
        signal: evAc.signal,
        contextText: evidenceContext,
        durationSeconds: take.mux_duration_seconds ?? null,
        withFutureDimensions,
        usageContext: aiUsageContext,
      }).finally(() => clearTimeout(evTimer));
      evidencePassCompletedAtIso = new Date().toISOString();
      evidencePassDurationMs = evResult.durationMs;
      evidencePassModel = evResult.model;
      evidencePassHttpStatus = evResult.httpStatus;
      evidencePassRequestStatus = evAc.signal.aborted
        ? "timed_out"
        : evResult.ok
          ? "completed"
          : "failed";
      evidencePassParseStatus = evResult.ok ? "completed" : "unknown";
      evidencePassSafeErrorCategory = evResult.ok ? null : evResult.safe_error_category;

      if (!evResult.ok) {
        // Step 1 failure → fall back to single-pass for this run. Don't
        // throw: we still want a usable report.
        console.warn("[take-pipeline] evidence_pass_failed; falling back to single-pass", {
          ...baseLog,
          http_status: evResult.httpStatus,
          safe_error_category: evResult.safe_error_category,
          duration_ms: evResult.durationMs,
        });
        metric("evidence_pass_failed", {
          take_id: takeId,
          http_status: evResult.httpStatus,
          duration_ms: evResult.durationMs,
        });
      } else {
        twoStepEvidence = evResult.evidence;
        twoStepTimestampsDropped = evResult.timestamps_dropped;
        const evSummary = summariseEvidence(twoStepEvidence);
        console.log("[take-pipeline] evidence_pass_completed", {
          ...baseLog,
          duration_ms: evResult.durationMs,
          timestamps_count: evSummary.timestamped_evidence_count,
          sufficiency: evSummary.evidence_sufficiency,
        });
        metric("evidence_pass_completed", {
          take_id: takeId,
          duration_ms: evResult.durationMs,
          timestamps_count: evSummary.timestamped_evidence_count,
        });
        // Phase 1 — log internal dimension counts only. The dimension data
        // itself is NOT persisted, NOT passed to Step 2, NOT rendered.
        if (evResult.futureDimensions) {
          capturedFutureDimensions = evResult.futureDimensions;
          console.log("[take-pipeline] future_dimensions_captured", {
            take_id: takeId,
            components: evResult.futureDimensions.components.length,
            dropped: evResult.futureDimensions.dropped,
            malformed: evResult.futureDimensions.malformed,
          });
          // Phase 2 — internal shadow scoring + QA counters. Wrapped to never
          // disrupt the user-facing pipeline. Output is PRIVATE: never written
          // to `report` or `score_breakdown`. Persisted to `take_qa_traces`
          // (RLS deny-all) only when `future_qa_trace_enabled` is true.
          try {
            const { computeFutureShadow } = await import("./shadow-scoring.server");
            const shadow = computeFutureShadow({
              futureDimensions: evResult.futureDimensions,
              evidence: twoStepEvidence,
              auditionType: twoStepEvidence.audition_type,
              durationSeconds: take.mux_duration_seconds ?? null,
              mode: audition?.mode === "brief" ? "brief" : "baseline",
            });
            console.log("[take-pipeline] shadow_scoring_completed", {
              take_id: takeId,
              branch: shadow.branch,
              components: shadow.components_summary.length,
              shadow_fields: Object.keys(shadow.shadow_scores).length,
              critical_counters:
                shadow.qa_counters.role_fit_overclaim +
                shadow.qa_counters.marketability_or_look_hit +
                shadow.qa_counters.frame_break_coaching,
            });
            const { getResolvedConfig } = await import("./app-config.server");
            const cfg2 = await getResolvedConfig();
            if (cfg2.future_qa_trace_enabled) {
              const { writeQaTrace } = await import("./qa-trace.server");
              const w = await writeQaTrace({ takeId, shadow });
              if (!w.ok) {
                console.warn("[take-pipeline] qa_trace_write_failed", {
                  take_id: takeId,
                  error: w.error.slice(0, 200),
                });
              }
            }
          } catch (err) {
            console.warn("[take-pipeline] shadow_scoring_failed", {
              take_id: takeId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (twoStepTimestampsDropped > 0) {
          console.log("[take-pipeline] timestamp_evidence_dropped", {
            take_id: takeId,
            count: twoStepTimestampsDropped,
          });
        }

        const qaStep1Context = buildQaStep1RuntimeContext();
        const internalQaEmit = process.env.V3_QA_ARTIFACTS_ENABLED === "true";
        preStep2InputArtefacts = await emitAnalysisInputArtefacts({
          run_id: `take-${takeId}`,
          analysis_run_id: `take-${takeId}`,
          submission_id: audition.id,
          take_id: takeId,
          compared_take_ids: [takeId],
          source_stage: "analysis_step_1_evidence_mapping",
          source_module: "process-take.server",
          analysis_route: "runProcessTake",
          route_or_model_marker: "runEvidencePass",
          audition_type: twoStepEvidence.audition_type ?? null,
          selected_level: audition.audition_level ?? null,
          brief_presence: qaStep1Context.briefPresence,
          brief_presence_source: qaStep1Context.briefPresenceSource,
          material_presence: s10BriefRuntimeFacts.material_presence,
          mux_playback_id: take.mux_playback_id ?? null,
          mux_asset_or_upload_id_present: Boolean(
            take.mux_asset_id || (take as { mux_upload_id?: string | null }).mux_upload_id,
          ),
          original_upload_file_hash: qaStep1Context.uploadIdentity.original_upload_file_hash,
          original_upload_file_hash_source_stage:
            qaStep1Context.uploadIdentity.original_upload_file_hash_source_stage,
          original_file_name: qaStep1Context.uploadIdentity.original_file_name,
          metadata_file_name: qaStep1Context.uploadIdentity.metadata_file_name,
          file_size_bytes: qaStep1Context.uploadIdentity.file_size_bytes,
          mime_type_safe_summary: qaStep1Context.uploadIdentity.mime_type_safe_summary,
          last_modified_ms: qaStep1Context.uploadIdentity.last_modified_ms,
          upload_metadata_source: qaStep1Context.uploadIdentity.upload_metadata_source,
          upload_identity_metadata: qaStep1Context.uploadIdentity.upload_identity_metadata,
          upload_identity_capture_status:
            qaStep1Context.uploadIdentity.upload_identity_capture_status,
          upload_identity_capture_reason:
            qaStep1Context.uploadIdentity.upload_identity_capture_reason,
          upload_identity_merge_status: qaStep1Context.uploadIdentity.upload_identity_merge_status,
          video_duration_seconds: qaStep1Context.takeDurationSeconds,
          submission_created_at: null,
          submission_updated_at: null,
          take_created_at: qaStep1Context.takeCreatedAt,
          take_updated_at: qaStep1Context.takeUpdatedAt,
          take_index: null,
          take_index_source: "unavailable",
          component_or_task_declaration: s10BriefRuntimeFacts.component_or_task_declaration,
          component_or_task_declaration_status:
            s10BriefRuntimeFacts.component_or_task_declaration_status,
          component_or_task_declaration_source:
            s10BriefRuntimeFacts.component_or_task_declaration_source,
          media_readiness_state: take.status ?? null,
          unavailable_fields: qaStep1Context.unavailableInputFields,
          internal_qa_emit: internalQaEmit,
        });
        rememberPreReportQa(preStep2InputArtefacts);
        const filteredStep1Evidence = filterRunEvidencePassForStep1(twoStepEvidence, {
          model: evResult.model,
          durationSeconds: take.mux_duration_seconds ?? null,
        });
        preStep2ResolverTruth = await emitResolverOutputAndTruthStateMap({
          run_id: `take-${takeId}`,
          analysis_run_id: `take-${takeId}`,
          submission_id: audition.id,
          take_id: takeId,
          compared_take_ids: [takeId],
          source_stage: "analysis_step_1_evidence_mapping",
          source_module: "process-take.server",
          analysis_route: "runProcessTake",
          route_or_model_marker: "runEvidencePass",
          audition_type: twoStepEvidence.audition_type ?? null,
          selected_level: audition.audition_level ?? null,
          brief_presence: qaStep1Context.briefPresence,
          brief_presence_source: qaStep1Context.briefPresenceSource,
          material_presence: s10BriefRuntimeFacts.material_presence,
          material_presence_source: s10BriefRuntimeFacts.material_presence_source,
          mux_playback_id: take.mux_playback_id ?? null,
          mux_asset_or_upload_id_present: Boolean(
            take.mux_asset_id || (take as { mux_upload_id?: string | null }).mux_upload_id,
          ),
          original_upload_file_hash: qaStep1Context.uploadIdentity.original_upload_file_hash,
          original_upload_file_hash_source_stage:
            qaStep1Context.uploadIdentity.original_upload_file_hash_source_stage,
          original_file_name: qaStep1Context.uploadIdentity.original_file_name,
          metadata_file_name: qaStep1Context.uploadIdentity.metadata_file_name,
          file_size_bytes: qaStep1Context.uploadIdentity.file_size_bytes,
          mime_type_safe_summary: qaStep1Context.uploadIdentity.mime_type_safe_summary,
          last_modified_ms: qaStep1Context.uploadIdentity.last_modified_ms,
          upload_metadata_source: qaStep1Context.uploadIdentity.upload_metadata_source,
          upload_identity_metadata: qaStep1Context.uploadIdentity.upload_identity_metadata,
          upload_identity_capture_status:
            qaStep1Context.uploadIdentity.upload_identity_capture_status,
          upload_identity_capture_reason:
            qaStep1Context.uploadIdentity.upload_identity_capture_reason,
          upload_identity_merge_status: qaStep1Context.uploadIdentity.upload_identity_merge_status,
          video_duration_seconds: qaStep1Context.takeDurationSeconds,
          take_created_at: qaStep1Context.takeCreatedAt,
          take_updated_at: qaStep1Context.takeUpdatedAt,
          take_index: null,
          take_index_source: "unavailable",
          component_or_task_declaration: s10BriefRuntimeFacts.component_or_task_declaration,
          component_or_task_declaration_status:
            s10BriefRuntimeFacts.component_or_task_declaration_status,
          component_or_task_declaration_source:
            s10BriefRuntimeFacts.component_or_task_declaration_source,
          media_readiness_state: take.status ?? null,
          filtered_run_evidence_pass_step1: filteredStep1Evidence,
          unavailable_fields: qaStep1Context.unavailableInputFields,
          internal_qa_emit: internalQaEmit,
        });
        rememberPreReportQa(preStep2ResolverTruth);
        const preStep2ResolverTruthIdentity = {
          expectedRunId: `take-${takeId}`,
          expectedAnalysisRunId: `take-${takeId}`,
          takeId,
        };
        const preStep2ResolverOutputPayload = (
          preStep2ResolverTruth as { resolver_output?: unknown }
        ).resolver_output;
        const preStep2TruthStateMapPayload = (
          preStep2ResolverTruth as { truth_state_map?: unknown }
        ).truth_state_map;
        const preStep2ResolverOutputAvailable = hasValidResolverOutputForStep2(
          preStep2ResolverOutputPayload,
          preStep2ResolverTruthIdentity,
        );
        const preStep2TruthStateMapAvailable = hasValidTruthStateMapForStep2(
          preStep2TruthStateMapPayload,
          preStep2ResolverTruthIdentity,
        );
        if (
          internalQaEmit &&
          (preStep2ResolverOutputAvailable || preStep2TruthStateMapAvailable) &&
          preStep2ResolverTruth.written === false
        ) {
          console.warn("[take-pipeline] resolver_truth_qa_persistence_failed_but_payload_valid", {
            take_id: takeId,
            resolver_output_available: preStep2ResolverOutputAvailable,
            truth_state_map_available: preStep2TruthStateMapAvailable,
          });
          metric("resolver_truth_qa_persistence_failed_but_payload_valid", {
            take_id: takeId,
          });
        }
        preStep2AnalysisEvidenceState = await emitAnalysisEvidenceStatePrerequisite({
          run_id: `take-${takeId}`,
          analysis_run_id: `take-${takeId}`,
          submission_id: audition.id,
          take_id: takeId,
          compared_take_ids: [takeId],
          source_stage: "analysis_step_1_evidence_mapping",
          source_module: "process-take.server",
          analysis_route: "runProcessTake",
          route_or_model_marker: "runEvidencePass",
          audition_type: twoStepEvidence.audition_type ?? null,
          selected_level: audition.audition_level ?? null,
          brief_presence: qaStep1Context.briefPresence,
          brief_presence_source: qaStep1Context.briefPresenceSource,
          material_presence: s10BriefRuntimeFacts.material_presence,
          material_presence_source: s10BriefRuntimeFacts.material_presence_source,
          mux_playback_id: take.mux_playback_id ?? null,
          mux_asset_or_upload_id_present: Boolean(
            take.mux_asset_id || (take as { mux_upload_id?: string | null }).mux_upload_id,
          ),
          original_upload_file_hash: qaStep1Context.uploadIdentity.original_upload_file_hash,
          original_upload_file_hash_source_stage:
            qaStep1Context.uploadIdentity.original_upload_file_hash_source_stage,
          original_file_name: qaStep1Context.uploadIdentity.original_file_name,
          metadata_file_name: qaStep1Context.uploadIdentity.metadata_file_name,
          file_size_bytes: qaStep1Context.uploadIdentity.file_size_bytes,
          mime_type_safe_summary: qaStep1Context.uploadIdentity.mime_type_safe_summary,
          last_modified_ms: qaStep1Context.uploadIdentity.last_modified_ms,
          upload_metadata_source: qaStep1Context.uploadIdentity.upload_metadata_source,
          upload_identity_metadata: qaStep1Context.uploadIdentity.upload_identity_metadata,
          upload_identity_capture_status:
            qaStep1Context.uploadIdentity.upload_identity_capture_status,
          upload_identity_capture_reason:
            qaStep1Context.uploadIdentity.upload_identity_capture_reason,
          upload_identity_merge_status: qaStep1Context.uploadIdentity.upload_identity_merge_status,
          take_created_at: qaStep1Context.takeCreatedAt,
          take_updated_at: qaStep1Context.takeUpdatedAt,
          take_index: null,
          take_index_source: "unavailable",
          component_or_task_declaration: s10BriefRuntimeFacts.component_or_task_declaration,
          component_or_task_declaration_status:
            s10BriefRuntimeFacts.component_or_task_declaration_status,
          component_or_task_declaration_source:
            s10BriefRuntimeFacts.component_or_task_declaration_source,
          media_readiness_state: take.status ?? null,
          media_duration_seconds: qaStep1Context.takeDurationSeconds,
          duration_confidence: qaStep1Context.durationConfidence,
          resolver_output_available: preStep2ResolverOutputAvailable,
          truth_state_map_available: preStep2TruthStateMapAvailable,
          filtered_run_evidence_pass_step1: filteredStep1Evidence,
          timestamp_normalisation_warnings: qaStep1Context.timestampWarnings,
          unavailable_fields: qaStep1Context.unavailableInputFields,
          internal_qa_emit: internalQaEmit,
        });
        rememberPreReportQa(preStep2AnalysisEvidenceState);
        const step1Dependency = evaluateStep1EvidenceForStep2({
          analysisEvidenceState: preStep2AnalysisEvidenceState,
          expectedRunId: `take-${takeId}`,
          expectedAnalysisRunId: `take-${takeId}`,
          takeId,
          internalQaEmit,
        });
        if (
          step1Dependency.step1EvidenceValidForStep2 &&
          step1Dependency.step1QaPersistenceStatus === "failed_emission"
        ) {
          // S9 source guardrail: step1QaPersistenceStatus === 'failed_emission'
          console.warn("[take-pipeline] qa_persistence_failed_but_step1_evidence_valid", {
            take_id: takeId,
            step2_dependency_status: step1Dependency.step2DependencyStatus,
            qa_persistence_status: step1Dependency.step1QaPersistenceStatus,
          });
          metric("qa_persistence_failed_but_step1_evidence_valid", {
            take_id: takeId,
            artefact_id: "analysis_evidence_state",
          });
        }
        if (
          (twoStepEvidence as EvidencePass & Record<string, unknown>).step1_provider_contract ===
          "plain_json_observations"
        ) {
          console.info("[take-pipeline] s10_step2_allows_plain_json_observation_pass", {
            take_id: takeId,
            step1_provider_contract: (twoStepEvidence as EvidencePass & Record<string, unknown>)
              .step1_provider_contract,
          });
        }
        if (internalQaEmit && step1Dependency.step2DependencyBlocked) {
          console.warn("[take-pipeline] s10_step2_continues_despite_qa_dependency_block", {
            take_id: takeId,
            written: preStep2AnalysisEvidenceState.written,
            step2_dependency_status: step1Dependency.step2DependencyStatus,
            blocker_codes: step1Dependency.blockerCodes,
          });
          metric("s10_step2_qa_dependency_warning", {
            take_id: takeId,
            reason: "qa_dependency_not_blocking_s10_content_path",
          });
        }
        const step2Evidence = {
          ...twoStepEvidence,
          analysis_evidence_state_ref: step1Dependency.analysisEvidenceStateRef,
          analysis_evidence_state_ref_status: step1Dependency.analysisEvidenceStateRefStatus,
          analysis_evidence_state_persistence_status: step1Dependency.step1QaPersistenceStatus,
          analysis_evidence_state_status:
            preStep2AnalysisEvidenceState.payload?.evidence_state_status ?? "missing",
          analysis_evidence_state_step2_dependency_status: step1Dependency.step2DependencyStatus,
          analysis_evidence_state_dependency_blocker_codes: step1Dependency.blockerCodes,
          analysis_evidence_state_qa_warning_codes: step1Dependency.warningCodes,
        } as EvidencePass & Record<string, unknown>;

        // ---- Step 2: text-only polish ----
        console.log("[take-pipeline] report_polish_started", baseLog);
        metric("report_polish_started", { take_id: takeId });
        const writeAnalysingHeartbeat = async (label: string) => {
          const { error: heartbeatErr } = await supabaseAdmin
            .from("takes")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", takeId)
            .in("status", ["pending", "processing"])
            .in("processing_phase", ["analysis_pending", "analysing"]);
          if (heartbeatErr) {
            console.warn("[take-pipeline] report_polish_heartbeat_failed", {
              take_id: takeId,
              label,
              error: heartbeatErr.message,
            });
            metric("phase_transition_failure", {
              take_id: takeId,
              reason: "report_polish_heartbeat_failed",
            });
          }
        };
        await writeAnalysingHeartbeat("polish_start");
        // Periodic heartbeat keeps the row's updated_at fresh so the
        // analysing-orphan reconciler (idle >180s) does not force-error an
        // in-flight analysis when Step 2 runs longer than the reconciler
        // window. Cleared in the .finally() once polish settles.
        const polishHeartbeatInterval = setInterval(() => {
          void writeAnalysingHeartbeat("polish_tick");
        }, 60_000);
        const polishAc = new AbortController();
        const polishTimer = setTimeout(() => polishAc.abort(), ANALYSIS_GEMINI_TIMEOUT_MS);
        const polishAttemptStartedAt = Date.now();
        reportPolishStartedAtIso = new Date(polishAttemptStartedAt).toISOString();
        const polishArgs = {
          apiKey,
          signal: polishAc.signal,
          evidence: step2Evidence,
          briefBlock,
          extractedBlock,
          briefContext: extractedBrief?.brief_context ?? null,
          briefRequirements: extractedBrief?.brief_requirements ?? [],
          signalsBlock,
          levelBlock,
          auditionTitle: audition.title,
          reportTool: REPORT_TOOL,
          usageContext: aiUsageContext,
        };
        let polishResult = await runReportPolish(polishArgs);
        let reportPolishTotalDurationMs = polishResult.durationMs;
        const initialPolishResult = polishResult;
        if (isRecoverableReportPolishResponseShapeError(polishResult) && !polishAc.signal.aborted) {
          polishRetryAttempted = true;
          console.warn("[take-pipeline] report_polish_retry_started", {
            ...baseLog,
            http_status: polishResult.httpStatus,
            safe_error_category: polishResult.safe_error_category,
            error: polishResult.error.slice(0, 120),
          });
          metric("report_polish_retry_started", {
            take_id: takeId,
            http_status: polishResult.httpStatus,
            safe_error_category: polishResult.safe_error_category,
          });
          const retryResult = await runReportPolish({
            ...polishArgs,
            recoveryInstruction: REPORT_POLISH_JSON_OBJECT_RETRY_INSTRUCTION,
          });
          reportPolishTotalDurationMs += retryResult.durationMs;
          if (retryResult.ok) {
            polishRetrySucceeded = true;
          } else {
            console.warn("[take-pipeline] report_polish_retry_failed", {
              ...baseLog,
              http_status: retryResult.httpStatus,
              safe_error_category: retryResult.safe_error_category,
              error: retryResult.error.slice(0, 120),
              duration_ms: retryResult.durationMs,
            });
            metric("report_polish_retry_failed", {
              take_id: takeId,
              http_status: retryResult.httpStatus,
              duration_ms: retryResult.durationMs,
              safe_error_category: retryResult.safe_error_category,
            });
          }
          polishResult = retryResult;
        }
        clearTimeout(polishTimer);
        clearInterval(polishHeartbeatInterval);
        reportPolishCompletedAtIso = new Date().toISOString();
        reportPolishModel = polishResult.model;
        reportPolishHttpStatus = polishResult.httpStatus;
        reportPolishRequestStatus = polishAc.signal.aborted
          ? "timed_out"
          : polishResult.ok
            ? "completed"
            : "failed";
        reportPolishParseStatus = polishResult.ok ? "completed" : "unknown";

        if (!polishResult.ok) {
          const canFallbackFromPolishParserFailure =
            isRecoverableReportPolishResponseShapeError(polishResult) &&
            isRecoverableReportPolishResponseShapeError(initialPolishResult);
          if (polishResult.safe_error_category === "provider_request_contract_error") {
            console.error("[take-pipeline] report_polish_provider_contract_failed", {
              ...baseLog,
              http_status: polishResult.httpStatus,
              error: polishResult.error.slice(0, 900),
              duration_ms: polishResult.durationMs,
            });
            metric("report_polish_failed", {
              take_id: takeId,
              http_status: polishResult.httpStatus,
              duration_ms: polishResult.durationMs,
              failure_code: "provider_request_contract_error",
            });
            throw new AnalysisFailure(
              "provider_request_contract_error",
              "The AI provider rejected the structured report contract. Please try again.",
            );
          }
          if (canFallbackFromPolishParserFailure) {
            twoStepFallbackReason = polishResult.error.includes("provider_content_not_json_object")
              ? "provider_content_not_json_object"
              : "report_polish_response_shape_error";
            console.warn("[take-pipeline] report_polish_fallback_started", {
              ...baseLog,
              reason: twoStepFallbackReason,
              retry_attempted: polishRetryAttempted,
              retry_succeeded: polishRetrySucceeded,
            });
            metric("report_polish_fallback_started", {
              take_id: takeId,
              reason: twoStepFallbackReason,
              retry_attempted: polishRetryAttempted,
            });
            const fallback = buildS10ReportPolishFallback({
              evidence: step2Evidence,
              briefContext: extractedBrief?.brief_context ?? null,
              briefRequirements: extractedBrief?.brief_requirements ?? [],
              auditionTitle: audition.title,
              selectedLevel: auditionLevel,
              mode: audition.brief ? "brief" : "baseline",
              reason: twoStepFallbackReason,
              retryAttempted: polishRetryAttempted,
              retrySucceeded: polishRetrySucceeded,
            });
            if (fallback.ok) {
              twoStepFallbackUsed = true;
              reportPolishDurationMs = reportPolishTotalDurationMs;
              twoStepReport = fallback.report;
              reportPolishRequestStatus = "completed";
              reportPolishParseStatus = "completed";
              reportPolishHttpStatus = polishResult.httpStatus;
              console.warn("[take-pipeline] report_polish_fallback_built", {
                ...baseLog,
                reason: twoStepFallbackReason,
                limitation_count: fallback.limitationCount,
              });
            } else {
              console.warn("[take-pipeline] report_polish_fallback_failed", {
                ...baseLog,
                reason: fallback.reason,
              });
              metric("report_polish_fallback_failed", {
                take_id: takeId,
                reason: fallback.reason,
              });
            }
          }
          if (twoStepFallbackUsed && twoStepReport) {
            // Continue to deterministic finalising with the evidence-backed
            // fallback. Do not emit report_polish_completed: the polish model
            // did not complete successfully.
          } else {
            const polishFailureCode: FailureCode =
              polishResult.error === "report_polish_timeout" ||
              polishResult.safe_error_category === "provider_timeout" ||
              reportPolishRequestStatus === "timed_out"
                ? "report_polish_timeout"
                : "report_polish_failed";
            console.warn("[take-pipeline] report_polish_failed", {
              ...baseLog,
              http_status: polishResult.httpStatus,
              error: polishResult.error.slice(0, 200),
              duration_ms: polishResult.durationMs,
              failure_code: polishFailureCode,
            });
            metric("report_polish_failed", {
              take_id: takeId,
              http_status: polishResult.httpStatus,
              duration_ms: polishResult.durationMs,
              failure_code: polishFailureCode,
            });
            throw new AnalysisFailure(
              polishFailureCode,
              polishFailureCode === "report_polish_timeout"
                ? "The AI report polish step timed out. Please try again."
                : "The AI report polish step failed. Please try again.",
            );
          }
        } else {
          reportPolishDurationMs = reportPolishTotalDurationMs;
          twoStepReport = polishResult.report;
          // Force mode from server-known truth (not from the polish model).
          twoStepReport.mode = audition.brief ? "brief" : "baseline";
          // Locked-field enforcement (PRIMARY safeguard).
          const locked = enforceLockedFields(twoStepReport, step2Evidence);
          twoStepEnforcement.locked_field_overwrites = locked.overwrites;
          if (locked.overwrites > 0) {
            console.log("[take-pipeline] report_polish_locked_field_overwritten", {
              ...baseLog,
              count: locked.overwrites,
            });
          }
          // Conservative unsupported-claim handling.
          const claims = enforceUnsupportedClaims(twoStepReport, step2Evidence);
          twoStepEnforcement.unsupported_claims_removed = claims.removed;
          twoStepEnforcement.unsupported_claims_rewritten = claims.rewritten;
          for (const [field, count] of Object.entries(claims.per_field_removed)) {
            if (count > 0) {
              console.log("[take-pipeline] report_polish_unsupported_claim_removed", {
                take_id: takeId,
                field,
                count,
              });
            }
          }
          const polishCompletedEvent = polishRetryAttempted
            ? "report_polish_retry_completed"
            : "report_polish_completed";
          console.log(`[take-pipeline] ${polishCompletedEvent}`, {
            ...baseLog,
            duration_ms: reportPolishTotalDurationMs,
            locked_overwrites: locked.overwrites,
            claims_removed: claims.removed,
            claims_rewritten: claims.rewritten,
          });
          metric(polishCompletedEvent, {
            take_id: takeId,
            duration_ms: reportPolishTotalDurationMs,
            locked_overwrites: locked.overwrites,
            claims_removed: claims.removed,
            claims_rewritten: claims.rewritten,
          });
        }
      }

      const totalAi = Date.now() - twoStepStartedAt;
      console.log("[take-pipeline] two_step_total_ai_duration_ms", {
        ...baseLog,
        duration_ms: totalAi,
        evidence_ms: evidencePassDurationMs,
        polish_ms: reportPolishDurationMs,
        fallback_used: twoStepFallbackUsed,
      });
      metric("two_step_total_ai_duration_ms", {
        take_id: takeId,
        duration_ms: totalAi,
      });
      if (totalAi > 90_000) {
        console.warn("[take-pipeline] two_step_latency_warning", {
          take_id: takeId,
          two_step_total_ai_duration_ms: totalAi,
          evidence_pass_duration_ms: evidencePassDurationMs,
          report_polish_duration_ms: reportPolishDurationMs,
        });
      }
    }

    const callAI = (videoUrl: string, signal: AbortSignal, model: string) => {
      return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildSinglePassReportRequestBodyForProvider({
            model,
            systemPrompt: buildSystemPrompt(),
            userText,
            // CRITICAL: video MP4s must be sent as `file_url`, NOT `image_url`.
            // Gemini via the Lovable AI Gateway rejects `image_url` for video/mp4.
            videoUrl,
          }),
        ),
        signal,
      });
    };

    // ---- Strict Gemini retry policy ----
    // Attempt 1 = primary model. On retryable failure (timeout / 429 / 500 /
    // 503 / 504 / network), retry ONCE with the fallback model. Total
    // attempts = 1 + ANALYSIS_MAX_RETRIES (default 1 → 2 attempts max).
    // Never retry on: parse errors, 4xx other than 429, 402 (credits).
    // If the AI circuit breaker is OPEN, attempt 1 routes directly to the
    // fallback model (no primary attempt).
    const RETRYABLE_HTTP = new Set([429, 500, 503, 504]);
    const GEMINI_BACKOFF_MS = [10_000, 30_000];

    const circuitOpenAtStart = isCircuitOpen();
    const initialModel = circuitOpenAtStart ? ANALYSIS_MODEL_FALLBACK : ANALYSIS_MODEL_PRIMARY;
    if (circuitOpenAtStart) {
      console.warn("[take-pipeline] ai_circuit_fallback_selected", {
        take_id: takeId,
        model: ANALYSIS_MODEL_FALLBACK,
      });
      metric("ai_circuit_fallback_selected", {
        take_id: takeId,
        model: ANALYSIS_MODEL_FALLBACK,
      });
    }
    let currentModel = initialModel;
    const isSinglePassFallbackAttempt = (model: string): boolean =>
      model === ANALYSIS_MODEL_FALLBACK || circuitOpenAtStart;
    const singlePassUsageStep = (model: string) =>
      isSinglePassFallbackAttempt(model) ? "fallback" : "single_pass_report";

    const isCancelled = async (): Promise<boolean> => {
      const { data } = await supabaseAdmin
        .from("takes")
        .select("status, error_message")
        .eq("id", takeId)
        .single();
      return (
        data?.status === "error" &&
        typeof data.error_message === "string" &&
        data.error_message.toLowerCase().includes("cancelled")
      );
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let report: any = null;
    let aiResp: Response | null = null;
    let geminiAttempt = 0;
    let geminiRetryCount = 0;
    let lastAttemptStartedAtIso: string | null = null;
    let lastAttemptCompletedAtIso: string | null = null;
    let lastAttemptDurationMs: number | null = null;
    let lastAttemptTimeoutMs: number | null = null;
    let lastAttemptTimedOut: boolean | null = null;
    let lastAttemptHttpStatus: number | null = null;
    if (twoStepReport) {
      // Two-step pipeline produced a report. Skip the single-pass Gemini call
      // and parse stages entirely.
      report = twoStepReport;
      const twoStepReportRecord = report as Record<string, unknown>;
      twoStepReportRecord.polish_retry_attempted = polishRetryAttempted;
      twoStepReportRecord.polish_retry_succeeded = polishRetrySucceeded;
      twoStepReportRecord.report_polish_fallback_used = twoStepFallbackUsed;
      if (twoStepFallbackUsed) {
        twoStepReportRecord.polish_fallback_reason = twoStepFallbackReason;
      }
    } else {
      const geminiStartedAt = Date.now();
      console.info("[take-pipeline] ai_model_selected", {
        take_id: takeId,
        model: currentModel,
        primary: ANALYSIS_MODEL_PRIMARY,
        fallback: ANALYSIS_MODEL_FALLBACK,
        circuit_open: circuitOpenAtStart,
      });
      console.log("[take-pipeline] gemini request started", {
        ...baseLog,
        analysis_tier: tier,
        processing_phase: "analysing",
        elapsed_ms_since_upload: elapsedSinceCreatedMs(),
        model: currentModel,
        gemini_timeout_ms: ANALYSIS_GEMINI_TIMEOUT_MS,
        total_timeout_ms: ANALYSIS_TOTAL_TIMEOUT_MS,
        max_retries: ANALYSIS_MAX_RETRIES,
      });
      metric("gemini_started", {
        take_id: takeId,
        processing_phase: "analysing",
        tier,
        model: currentModel,
        gemini_timeout_ms: ANALYSIS_GEMINI_TIMEOUT_MS,
        total_timeout_ms: ANALYSIS_TOTAL_TIMEOUT_MS,
        max_retries: ANALYSIS_MAX_RETRIES,
      });

      let urlForCall = ensureValidMuxMp4Url({
        url: resolvedProbeUrl,
        playbackId: take.mux_playback_id,
        kind: "gemini",
      });
      let didMuxUrlRecoveryRetry = false;
      while (true) {
        // Total-budget guard BEFORE each attempt — prevents starting an attempt
        // we know we can't complete inside the wall-clock budget.
        const elapsedRunMs = Date.now() - runStartedAt;
        if (elapsedRunMs >= ANALYSIS_TOTAL_TIMEOUT_MS) {
          metric("gemini_failed", {
            take_id: takeId,
            retry_count: geminiRetryCount,
            duration_ms: Date.now() - geminiStartedAt,
            reason: "analysis_total_timeout",
            failure_code: "analysis_total_timeout",
          });
          throw new AnalysisFailure(
            "analysis_total_timeout",
            "The analysis exceeded its total time budget. Please try again.",
          );
        }

        geminiAttempt += 1;
        const attemptStart = Date.now();
        lastAttemptStartedAtIso = new Date(attemptStart).toISOString();
        // Per-attempt deadline is the smaller of the per-attempt cap and the
        // remaining total budget — never start a long attempt we can't finish.
        const remainingBudgetMs = ANALYSIS_TOTAL_TIMEOUT_MS - elapsedRunMs;
        const attemptTimeoutMs = Math.max(
          1_000,
          Math.min(ANALYSIS_GEMINI_TIMEOUT_MS, remainingBudgetMs),
        );
        lastAttemptTimeoutMs =
          Number.isFinite(attemptTimeoutMs) && attemptTimeoutMs >= 0 ? attemptTimeoutMs : null;
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), attemptTimeoutMs);

        let thrown: unknown = null;
        let timedOut = false;
        try {
          aiResp = await callAI(urlForCall, ac.signal, currentModel);
        } catch (callErr) {
          thrown = callErr;
          aiResp = null;
          // AbortError shape varies between runtimes — detect by name.
          const name = (callErr as { name?: string } | undefined)?.name;
          if (ac.signal.aborted || name === "AbortError" || name === "TimeoutError") {
            timedOut = true;
          }
        } finally {
          clearTimeout(timer);
        }

        const status = aiResp?.status ?? null;
        lastAttemptCompletedAtIso = new Date().toISOString();
        lastAttemptDurationMs = Date.now() - attemptStart;
        lastAttemptTimedOut = timedOut;
        lastAttemptHttpStatus = status;
        console.log("[take-pipeline] gemini response received", {
          ...baseLog,
          analysis_tier: tier,
          http_status: status,
          gemini_attempt: geminiAttempt,
          gemini_duration_ms: Date.now() - attemptStart,
          elapsed_ms_since_upload: elapsedSinceCreatedMs(),
          timed_out: timedOut,
          model: currentModel,
        });

        // Success.
        if (aiResp && aiResp.ok) break;

        const aiErrorBody = aiResp ? await aiResp.text().catch(() => "") : "";
        const providerErrorCategory = classifyAiGatewayProviderError(status, aiErrorBody);

        // One-shot stale-URL recovery for real media URL rejections only.
        // Gemini tool/function schema errors are provider request-contract
        // failures and retrying with the same Mux URL cannot repair them.
        // Does NOT count against the retry budget.
        if (
          shouldRetryWithFreshMuxUrl({
            httpStatus: status,
            body: aiErrorBody,
            didMuxUrlRecoveryRetry,
            hasPlaybackId: Boolean(take.mux_playback_id),
          })
        ) {
          console.warn(
            "AI gateway rejected URL; retrying once with fresh Mux URL",
            aiErrorBody.slice(0, 200),
          );
          didMuxUrlRecoveryRetry = true;
          urlForCall = ensureValidMuxMp4Url({
            url: buildMuxHighestMp4Url(take.mux_playback_id),
            playbackId: take.mux_playback_id,
            kind: "gemini",
          });
          await recordTakeAiUsage({
            ...aiUsageContext,
            step: singlePassUsageStep(currentModel),
            model: currentModel,
            promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
            providerContract: selectReportProviderContract(currentModel),
            status: "failure",
            httpStatus: status,
            failureReason: "mux_url_recovery_retry",
            latencyMs: Date.now() - attemptStart,
            fallbackUsed: isSinglePassFallbackAttempt(currentModel),
            metadata: {
              source_stage: "single_pass_report_generation",
              gemini_attempt: geminiAttempt,
              retry_count: geminiRetryCount,
              analysis_tier: tier,
              stale_url_recovery: true,
            },
          });
          // Roll back the attempt counter so this doesn't consume a retry slot.
          geminiAttempt -= 1;
          continue;
        }

        // Hard, non-retryable: 402 (credits).
        if (aiResp && aiResp.status === 402) {
          await recordTakeAiUsage({
            ...aiUsageContext,
            step: singlePassUsageStep(currentModel),
            model: currentModel,
            promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
            providerContract: selectReportProviderContract(currentModel),
            status: "failure",
            httpStatus: 402,
            failureReason: "ai_credits_exhausted",
            latencyMs: Date.now() - attemptStart,
            fallbackUsed: isSinglePassFallbackAttempt(currentModel),
            metadata: {
              source_stage: "single_pass_report_generation",
              gemini_attempt: geminiAttempt,
              retry_count: geminiRetryCount,
              analysis_tier: tier,
            },
          });
          metric("gemini_failed", {
            take_id: takeId,
            retry_count: geminiRetryCount,
            http_status: 402,
            duration_ms: Date.now() - geminiStartedAt,
            reason: "credits_exhausted",
            model: currentModel,
            failure_code: "ai_credits_exhausted",
          });
          throw new AnalysisFailure(
            "ai_credits_exhausted",
            "AI credits exhausted on this workspace. Add funds to continue.",
          );
        }

        // Determine retryability per strict policy.
        const httpRetryable = aiResp !== null && status !== null && RETRYABLE_HTTP.has(status);
        const networkThrow = aiResp === null && !timedOut && thrown !== null;
        const transient = timedOut || httpRetryable || networkThrow;

        // Pick a failure_code for whatever we'd terminate with if no retry left.
        let failureCode: FailureCode;
        if (timedOut) failureCode = "gemini_timeout";
        else if (status === 429) failureCode = "gemini_429";
        else if (status !== null && status >= 500 && status < 600) failureCode = "gemini_5xx";
        else if (networkThrow) failureCode = "ai_network_error";
        else if (providerErrorCategory === "provider_request_contract_error")
          failureCode = "provider_request_contract_error";
        else if (status !== null && status >= 400 && status < 500)
          failureCode = "ai_non_retryable_4xx";
        else failureCode = "ai_network_error";

        await recordTakeAiUsage({
          ...aiUsageContext,
          step: singlePassUsageStep(currentModel),
          model: currentModel,
          promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
          providerContract: selectReportProviderContract(currentModel),
          status: timedOut ? "timeout" : "failure",
          httpStatus: status,
          failureReason: failureCode,
          latencyMs: Date.now() - attemptStart,
          fallbackUsed: isSinglePassFallbackAttempt(currentModel),
          metadata: {
            source_stage: "single_pass_report_generation",
            gemini_attempt: geminiAttempt,
            retry_count: geminiRetryCount,
            analysis_tier: tier,
            provider_error_category: providerErrorCategory,
            transient,
          },
        });

        // Non-retryable (parse/validation/4xx other than 429): terminate now.
        if (!transient) {
          console.error("AI gateway hard error", status, aiErrorBody.slice(0, 900));
          metric("gemini_failed", {
            take_id: takeId,
            retry_count: geminiRetryCount,
            http_status: status,
            duration_ms: Date.now() - geminiStartedAt,
            reason: "non_retryable",
            model: currentModel,
            failure_code: failureCode,
          });
          throw new AnalysisFailure(
            failureCode,
            `AI gateway error (${status ?? "network"}). Please try again.`,
          );
        }

        // Transient — retry if budget allows. We allow exactly ONE fallback
        // retry per spec: attempt 1 = primary, attempt 2 = fallback.
        if (geminiRetryCount >= ANALYSIS_MAX_RETRIES) {
          // Out of retries: emit gemini_failed and surface a typed terminal error.
          // Record this terminal transient failure into the circuit breaker.
          if (
            failureCode === "gemini_timeout" ||
            failureCode === "gemini_5xx" ||
            failureCode === "ai_network_error"
          ) {
            recordAiFailure(failureCode);
          }
          console.warn("gemini_retry_exhausted", {
            ...baseLog,
            retry_count: geminiRetryCount,
            http_status: status,
            timed_out: timedOut,
            elapsed_ms: Date.now() - geminiStartedAt,
            failure_code: failureCode,
            model: currentModel,
          });
          metric("gemini_failed", {
            take_id: takeId,
            retry_count: geminiRetryCount,
            http_status: status,
            duration_ms: Date.now() - geminiStartedAt,
            reason: "retry_exhausted",
            failure_code: failureCode,
            timed_out: timedOut,
            model: currentModel,
          });
          const msg =
            failureCode === "gemini_timeout"
              ? "The analysis took too long. Please try again."
              : failureCode === "gemini_429"
                ? "AI gateway is rate-limited. Please try again shortly."
                : failureCode === "ai_network_error"
                  ? "AI gateway network error. Please try again."
                  : "AI gateway is temporarily unavailable. Please try again.";
          throw new AnalysisFailure(failureCode, msg);
        }

        if (await isCancelled()) {
          console.log("[take-pipeline] cancelled before gemini retry", baseLog);
          metric("cancel", {
            take_id: takeId,
            processing_phase: "analysing",
            duration_ms: Date.now() - geminiStartedAt,
            reason: "before_gemini_retry",
          });
          metric("analysis_abandoned", { take_id: takeId, processing_phase: "analysing" });
          terminalWritten = true; // cancellation is its own terminal state
          return { ok: true, alreadyDone: true };
        }

        geminiRetryCount += 1;
        // Switch to fallback model for the retry (unless we already started on
        // the fallback because the circuit was open).
        const previousModel = currentModel;
        if (currentModel === ANALYSIS_MODEL_PRIMARY) {
          currentModel = ANALYSIS_MODEL_FALLBACK;
          console.warn("[take-pipeline] ai_fallback_selected", {
            take_id: takeId,
            from_model: previousModel,
            to_model: currentModel,
            reason: failureCode,
          });
          metric("ai_fallback_selected", {
            take_id: takeId,
            from_model: previousModel,
            model: currentModel,
            reason: failureCode,
            http_status: status,
            timed_out: timedOut,
          });
        }
        console.log("gemini_retry_started", {
          ...baseLog,
          retry_count: geminiRetryCount,
          http_status: status,
          attempt_count: geminiAttempt,
          elapsed_ms: Date.now() - geminiStartedAt,
          timed_out: timedOut,
          model: currentModel,
        });
        metric("gemini_retry", {
          take_id: takeId,
          retry_count: geminiRetryCount,
          http_status: status,
          attempt: geminiAttempt,
          timed_out: timedOut,
          failure_code: failureCode,
          model: currentModel,
        });
        const backoff = GEMINI_BACKOFF_MS[geminiRetryCount - 1] ?? 30_000;
        await new Promise((r) => setTimeout(r, backoff));
        // Loop continues — total-budget guard at the top will catch overruns.
      }

      if (!aiResp || !aiResp.ok) {
        throw new AnalysisFailure(
          "analysis_no_terminal_state",
          "We couldn't complete the analysis this time. Please try again.",
        );
      }
      metric("gemini_completed", {
        take_id: takeId,
        duration_ms: Date.now() - geminiStartedAt,
        retry_count: geminiRetryCount,
        tier,
      });
      if (geminiRetryCount > 0) {
        console.log("gemini_retry_succeeded", {
          ...baseLog,
          retry_count: geminiRetryCount,
          elapsed_ms: Date.now() - geminiStartedAt,
        });
      }
      metric("gemini_completed", {
        take_id: takeId,
        duration_ms: Date.now() - geminiStartedAt,
        retry_count: geminiRetryCount,
        tier,
      });
      if (geminiRetryCount > 0) {
        console.log("gemini_retry_succeeded", {
          ...baseLog,
          retry_count: geminiRetryCount,
          elapsed_ms: Date.now() - geminiStartedAt,
        });
      }

      // ---- Parse stage (timed, tagged) ----

      if (finaliseStartedAt === 0) finaliseStartedAt = Date.now();
      const parseStartedAt = Date.now();
      metric("analysis_parse_started", { take_id: takeId, model: currentModel });
      console.log("[take-pipeline] analysis_parse_started", {
        ...baseLog,
        model: currentModel,
      });

      // (report variable is hoisted above; assigned here for the single-pass path)
      let singlePassTokenUsagePayload: unknown = null;
      try {
        const json = await aiResp.json();
        singlePassTokenUsagePayload = json;
        const choice = json.choices?.[0];
        if (selectReportProviderContract(currentModel) === "plain_json_report") {
          report = parseProviderJsonObjectContent(choice?.message?.content);
          if (finaliseExceeded()) {
            throw new AnalysisFailure(
              "analysis_parse_failed",
              "Parsing the AI response took too long. Please try again.",
            );
          }
        } else {
          const toolCall = choice?.message?.tool_calls?.[0];
          if (!toolCall?.function?.arguments) {
            throw new AnalysisFailure(
              "analysis_parse_failed",
              "AI did not return a structured report. Please try again.",
            );
          }
          try {
            report = JSON.parse(toolCall.function.arguments);
          } catch (parseErr) {
            if (choice?.finish_reason === "length") {
              throw new AnalysisFailure(
                "analysis_parse_failed",
                "The AI response was cut off before it finished writing the report. Please retry.",
              );
            }
            console.error(
              "AI JSON parse failed",
              parseErr,
              (toolCall.function.arguments as string | undefined)?.slice(-300),
            );
            throw new AnalysisFailure(
              "analysis_parse_failed",
              "The AI returned an incomplete report. Please retry.",
            );
          }
          if (finaliseExceeded()) {
            throw new AnalysisFailure(
              "analysis_parse_failed",
              "Parsing the AI response took too long. Please try again.",
            );
          }
        }
        await recordTakeAiUsage({
          ...aiUsageContext,
          step: singlePassUsageStep(currentModel),
          model: currentModel,
          promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
          providerContract: selectReportProviderContract(currentModel),
          status: "success",
          httpStatus: lastAttemptHttpStatus,
          latencyMs: lastAttemptDurationMs ?? Date.now() - geminiStartedAt,
          tokenUsage: extractAiTokenUsage(singlePassTokenUsagePayload),
          fallbackUsed: isSinglePassFallbackAttempt(currentModel),
          metadata: {
            source_stage: "single_pass_report_generation",
            gemini_attempt: geminiAttempt,
            retry_count: geminiRetryCount,
            analysis_tier: tier,
          },
        });
      } catch (parseOuter) {
        await recordTakeAiUsage({
          ...aiUsageContext,
          step: singlePassUsageStep(currentModel),
          model: currentModel,
          promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
          providerContract: selectReportProviderContract(currentModel),
          status: "failure",
          httpStatus: lastAttemptHttpStatus,
          failureReason: "analysis_parse_failed",
          latencyMs: lastAttemptDurationMs ?? Date.now() - geminiStartedAt,
          tokenUsage: extractAiTokenUsage(singlePassTokenUsagePayload),
          fallbackUsed: isSinglePassFallbackAttempt(currentModel),
          metadata: {
            source_stage: "single_pass_report_generation",
            gemini_attempt: geminiAttempt,
            retry_count: geminiRetryCount,
            analysis_tier: tier,
            parse_error_name: parseOuter instanceof Error ? parseOuter.name : "unknown",
          },
        });
        metric("analysis_parse_failed", {
          take_id: takeId,
          duration_ms: Date.now() - parseStartedAt,
          reason: parseOuter instanceof Error ? parseOuter.message.slice(0, 120) : "parse_error",
        });
        console.warn("[take-pipeline] analysis_parse_failed", {
          ...baseLog,
          duration_ms: Date.now() - parseStartedAt,
        });
        throw parseOuter;
      }
      metric("analysis_parse_completed", {
        take_id: takeId,
        duration_ms: Date.now() - parseStartedAt,
      });
      console.log("[take-pipeline] analysis_parse_completed", {
        ...baseLog,
        duration_ms: Date.now() - parseStartedAt,
      });
    } // end of single-pass else branch

    // ====================================================================
    //  FINALISING STAGE — deterministic post-processing + persistence.
    //  Bounded by POST_AI_FINALISE_TIMEOUT_MS. Each substage is logged so
    //  hangs can be attributed in production logs.
    // ====================================================================
    if (finaliseStartedAt === 0) finaliseStartedAt = Date.now();
    const finalisingStartedAt = finaliseStartedAt;
    console.log("[take-pipeline] finalising_started", {
      take_id: takeId,
      processing_phase: "analysing",
      two_step_enabled: isTwoStepEnabled(),
      fallback_used: twoStepFallbackUsed,
    });

    // Transition to the dedicated `finalising` phase before any deterministic
    // post-processing begins (validation, UK terminology pass, score
    // recomputation, scrubs, verdict/cap logic, final persistence). This lets
    // the reconciler distinguish a still-running AI call (`analysing`) from a
    // dead worker mid-finalisation (`finalising`) and apply the right timeout
    // policy. Conditional on the row still being status=processing AND
    // phase=analysing so we don't clobber a cancellation/reset that landed
    // while Gemini was running.
    {
      const { data: phaseRows, error: phaseErr } = await supabaseAdmin
        .from("takes")
        .update({ processing_phase: "finalising" })
        .eq("id", takeId)
        .eq("status", "processing")
        .eq("processing_phase", "analysing")
        .select("id");
      if (phaseErr) {
        console.warn("[take-pipeline] finalising_phase_set_failed", {
          take_id: takeId,
          error: String(phaseErr.message ?? phaseErr),
        });
        // Non-fatal: subsequent persistence guard will detect state drift.
      } else if (!phaseRows || phaseRows.length === 0) {
        console.log("[take-pipeline] finalising_phase_set_skipped", {
          take_id: takeId,
          reason: "state_changed_pre_finalising",
        });
        // Row no longer in (processing, analysing) — likely cancelled/reset.
        // Let the existing pre-write guard discard the result cleanly.
      } else {
        console.log("[take-pipeline] finalising_phase_set", {
          take_id: takeId,
          processing_phase: "finalising",
        });
      }
    }

    // ---- Validate two-step report shape before deterministic scrubs ----
    // A malformed Step-2 report (missing scores/category fields) can wedge
    // downstream regex walks. Detect early; fall back or fail cleanly.
    if (isTwoStepEnabled()) {
      const requiredFields = ["scores", "audition_type"] as const;
      const missing: string[] = [];
      const malformed: string[] = [];
      for (const f of requiredFields) {
        const v = (report as Record<string, unknown>)[f];
        if (v === undefined || v === null) missing.push(f);
        else if (f === "scores" && (typeof v !== "object" || Array.isArray(v))) {
          malformed.push(f);
        }
      }
      if (missing.length > 0 || malformed.length > 0) {
        console.warn("[take-pipeline] report_validation_failed", {
          take_id: takeId,
          missing_field_count: missing.length,
          malformed_field_count: malformed.length,
          fallback_used: twoStepFallbackUsed,
        });
        // If S10 fell back from Step 2 and the recovery report is still
        // malformed, fail cleanly rather than running scrubs on garbage.
        if (twoStepFallbackUsed) {
          throw new AnalysisFailure(
            "analysis_parse_failed",
            "We couldn’t finish your report this time. Please try again.",
          );
        }
        // Otherwise, leave it — single-pass branch already produced
        // structured output, and downstream code defensively coerces.
      }
    }

    if (finaliseExceeded()) throwFinaliseTimeout("after_validation");

    console.log("[take-pipeline] finalising_postprocess_started", {
      take_id: takeId,
    });

    // ---- UK terminology pass on all string output ----
    report = ukifyDeep(report);

    // ---- S10.3 observation context ----
    // Two-step output wins when present, but single-pass reports also carry
    // top-level S10 observation fields. Never recover this context from
    // raw_report or legacy detected_components.
    const s10ObservationContext = resolveS10ObservationContext({
      twoStepEvidence,
      singlePassOutput: report as Record<string, unknown>,
      report: report as Record<string, unknown>,
    });
    report.observed_tape_sequence = s10ObservationContext.observed_tape_sequence;
    report.component_verifications = s10ObservationContext.component_verifications;
    report.media_observation_summary = s10ObservationContext.media_observation_summary;
    report.s10_observation_context_source_kind = s10ObservationContext.source_kind;
    report.s10_observation_context_limitations = s10ObservationContext.limitations;
    report.s10_observation_context_warnings = s10ObservationContext.contradiction_warnings;
    if (s10ObservationContext.source_kind === "unavailable") {
      console.warn("[take-pipeline] s10_observation_context_unavailable", {
        take_id: takeId,
        limitations: s10ObservationContext.limitations,
      });
    }

    // ---- S10.4 brief achievement matrix ----
    // The AI authors the matrix; code validates against S10.2 requirements
    // and S10.3 observed component verification before legacy score fields
    // can influence verdict/readiness semantics.
    const technicalMediaSignals = buildTechnicalMediaSignals({
      signals: take.signals,
      checklist: take.checklist,
      mediaObservationSummary: s10ObservationContext.media_observation_summary,
      observedTapeSequence: s10ObservationContext.observed_tape_sequence,
      componentVerifications: s10ObservationContext.component_verifications,
    });
    report.brief_achievement_matrix = normaliseBriefAchievementMatrix({
      matrix: (report as Record<string, unknown>).brief_achievement_matrix,
      briefRequirements: extractedBrief?.brief_requirements ?? [],
      componentVerifications: s10ObservationContext.component_verifications,
      observedTapeSequence: s10ObservationContext.observed_tape_sequence,
      mediaObservationSummary: s10ObservationContext.media_observation_summary,
      technicalMediaSignals,
    });
    const s10BriefAchievementCap = applyBriefAchievementCompatibilityCaps(
      report as Record<string, unknown>,
      report.brief_achievement_matrix,
    );
    if (s10BriefAchievementCap.capped) {
      console.log("[take-pipeline] s10_brief_achievement_legacy_cap_applied", {
        take_id: takeId,
        cap: s10BriefAchievementCap.cap,
        readiness_impact: report.brief_achievement_matrix.readiness_impact,
        mandatory_status: report.brief_achievement_matrix.mandatory_status,
      });
    }

    // Capture the model's raw overall before any server recomputation.
    const overallScoreModel =
      typeof report.overall_score === "number" ? report.overall_score : null;

    // ---- Deterministic compliance vs signals (orientation/duration/audio) ----
    const signalsForCompliance = (take.signals ?? null) as {
      orientation?: string;
      duration?: number;
      audio_peak?: number;
    } | null;
    const complianceFlags = deterministicCompliance({
      extracted: extractedBrief,
      signals: signalsForCompliance,
    });

    // Compliance severity normalisation:
    // - Deterministic flags take priority over model-generated ones.
    // - Any deterministic high-severity flag participates in gating via the
    //   risk-flag pipeline below, so applyCapsAndLabel will trigger.
    // De-dupe: drop any model risk flag whose text duplicates a deterministic
    // compliance message (case-insensitive substring match either direction).
    const modelRiskFlagsRaw: Array<{ severity: "low" | "medium" | "high"; flag: string }> =
      Array.isArray(report.submission_risk_flags) ? report.submission_risk_flags : [];
    const complianceMessages = complianceFlags.map((c) => c.message.toLowerCase());
    const filteredModelRiskFlags = modelRiskFlagsRaw.filter((mf) => {
      const text = (mf.flag ?? "").toLowerCase();
      if (!text) return false;
      return !complianceMessages.some(
        (cm) => cm.includes(text) || text.includes(cm.slice(0, Math.min(40, cm.length))),
      );
    });
    // Deterministic flags ALWAYS go in first (priority order).
    const mergedRiskFlags: Array<{ severity: "low" | "medium" | "high"; flag: string }> = [
      ...complianceFlags.map((c) => ({ severity: c.severity, flag: c.message })),
      ...filteredModelRiskFlags,
    ];
    report.submission_risk_flags = mergedRiskFlags;

    // ---- Server-side overall score recomputation ----
    // Trust the model's per-category scores; recompute the weighted overall
    // deterministically using audition-type weights, then apply caps.
    if (finaliseExceeded()) throwFinaliseTimeout("before_score_recompute");
    const scoreRecomputeStartedAt = Date.now();
    console.log("[take-pipeline] finalising_score_recompute_started", {
      take_id: takeId,
    });
    const auditionType = (report.audition_type ?? "unknown") as AuditionType;
    const weights = weightsForType(auditionType);
    const modelScores = (report.scores ?? {}) as Record<string, number | null>;
    const recomputed = recomputeOverall(modelScores, weights);
    let overall = recomputed.overall || (report.overall_score as number) || 0;
    console.log("[take-pipeline] finalising_score_recompute_completed", {
      take_id: takeId,
      duration_ms: Date.now() - scoreRecomputeStartedAt,
    });

    const audioScore = modelScores.audio ?? 100;
    // Tiered audio caps mirror applyCapsAndLabel:
    //   <35 → 60, <50 → 62, <60 → 75
    if (audioScore < 35 && overall > 60) overall = 60;
    else if (audioScore < 50 && overall > 62) overall = 62;
    else if (audioScore < 60 && overall > 75) overall = 75;

    // Track safety-validator rewrites for downstream debugging/audit.
    let safetyRewriteApplied = false;

    // ---- Forbidden-language guard (shared across role-fit + presentation) ----
    // Catches identity, mobility, medical, class, and physicality-proxy terms.
    const FORBIDDEN_PATTERNS: RegExp[] = [
      // Identity
      /\battractive(ness)?\b/i,
      /\bweight\b/i,
      /\bbody\s*(shape|type)?\b/i,
      /\bskinny\b/i,
      /\bfat\b/i,
      /\b(over|under)weight\b/i,
      /\brace\b/i,
      /\bethnic(ity)?\b/i,
      /\bclass\b/i,
      /\bgender\s+(presentation|identity)\b/i,
      /\bmasculine\b/i,
      /\bfeminine\b/i,
      /\bage(d|ing)?\b/i,
      /\b(too )?old\b/i,
      /\b(too )?young\b/i,
      // Disability / mobility / medical
      /\bdisab(led|ility|ilities)\b/i,
      /\bwheelchair\b/i,
      /\bcrutch(es)?\b/i,
      /\bprosthe(tic|sis|ses)\b/i,
      /\bmobility\s+aid\b/i,
      /\bmedical\s+device\b/i,
      /\bassistive\s+(device|equipment)\b/i,
      /\bneurodivergen(t|ce)\b/i,
      /\bautis(tic|m)\b/i,
      // Physicality proxies (accessibility-safe rule)
      /\blimited\s+movement\b/i,
      /\brestricted\b/i,
      /\bconstrained\b/i,
      /\binsufficient\s+kinetic\s+range\b/i,
      /\bphysicality\s+underdeliver(ed|s)?\b/i,
      /\bmovement\s+limitation\b/i,
      /\brestricted\s+physicality\b/i,
      /\brange\s+of\s+motion\b/i,
      // Presentation proxies for medical/period devices
      /\bmodern\s+intrusion\b/i,
      /\bworld[-\s]?breaker\b/i,
      /\bperiod[-\s]?breaking\s+item\b/i,
      /\bdevice\s+visible\b/i,
      // Class / socioeconomic / appearance
      /\blook\s+the\s+part\b/i,
      /\blook(s|ed)?\s+right\b/i,
      /\bvisual\s+fit\b/i,
      /\bposh\b/i,
      /\bcommon\s+(accent|sounding)\b/i,
      /\buneducated\b/i,
      /\bcheap[-\s]?looking\b/i,
    ];
    const containsForbidden = (s: string): boolean =>
      typeof s === "string" && FORBIDDEN_PATTERNS.some((re) => re.test(s));

    // ---- Bounded role-fit modifier ----
    // Clamp to [-10, +5]. Force 0 in BASELINE mode. Apply AFTER the audio cap
    // so a strong role-fit nudge can't lift a tape past the audio ceiling.
    const overallBeforeRoleFit = overall;
    let roleFitModifier = 0;
    if (typeof report.role_fit_modifier === "number" && Number.isFinite(report.role_fit_modifier)) {
      roleFitModifier = Math.max(-10, Math.min(5, Math.round(report.role_fit_modifier)));
    }
    if (report.mode !== "brief") {
      roleFitModifier = 0;
    }
    if (typeof report.role_fit_notes !== "string") report.role_fit_notes = "";
    // Safety: if role_fit_notes contains forbidden language, strip the note
    // entirely AND zero the modifier — we won't apply an opaque/appearance-
    // based nudge to the score.
    if (report.role_fit_notes && containsForbidden(report.role_fit_notes)) {
      report.role_fit_notes = "";
      roleFitModifier = 0;
      safetyRewriteApplied = true;
    }
    // Re-apply audio cap after role-fit so role-fit cannot bypass it.
    const postRoleFit = overall + roleFitModifier;
    overall = Math.max(0, Math.min(100, postRoleFit));
    if (audioScore < 35 && overall > 60) overall = 60;
    else if (audioScore < 50 && overall > 62) overall = 62;
    else if (audioScore < 60 && overall > 75) overall = 75;
    report.role_fit_modifier = roleFitModifier;
    if (
      report.role_fit_confidence !== "low" &&
      report.role_fit_confidence !== "medium" &&
      report.role_fit_confidence !== "high"
    ) {
      report.role_fit_confidence = report.mode === "brief" ? "low" : "low";
    }
    if (report.mode !== "brief") {
      // BASELINE: blank role-fit notes — we have nothing to fit against.
      report.role_fit_notes = "";
      report.role_fit_confidence = "low";
    }

    // ---- S10.5 readiness / score semantics ----
    // AI-authored judgement is preserved, but effective report fields are
    // matrix-constrained so high performance/audio scores cannot hide missing
    // mandatory brief material.
    const readinessSemantics = applyReadinessScoreSemantics({
      report: report as Record<string, unknown>,
      matrix: report.brief_achievement_matrix,
      currentOverallScore: overall,
      selectedLevel: auditionLevel,
    });
    overall = readinessSemantics.overall;
    if (readinessSemantics.capped) {
      console.log("[take-pipeline] s10_readiness_score_semantics_applied", {
        take_id: takeId,
        overall_submission_readiness_score:
          readinessSemantics.judgement.overall_submission_readiness_score,
        decision: readinessSemantics.judgement.decision,
        repair_prompt_status: readinessSemantics.judgement.repair_prompt_status,
        warning_count: readinessSemantics.warnings.length,
      });
    }

    // ---- S10.6 fix hierarchy / next action ----
    // Normalisation order is intentional: S10.4 matrix, then S10.5
    // readiness, then S10.6 actions. Legacy fix/action fields are
    // compatibility projections, not the source of truth.
    const fixActionSemantics = applyS10FixHierarchyNextAction({
      report: report as Record<string, unknown>,
      matrix: report.brief_achievement_matrix,
      readiness: readinessSemantics.judgement,
    });
    if (fixActionSemantics.warnings.length > 0) {
      console.log("[take-pipeline] s10_fix_hierarchy_next_action_applied", {
        take_id: takeId,
        fix_first: fixActionSemantics.hierarchy.fix_first?.title ?? null,
        must_fix_count: fixActionSemantics.hierarchy.must_fix_before_submitting.length,
        warning_count: fixActionSemantics.warnings.length,
      });
    }

    // ---- S10.7 strengths / preserve / professional critique ----
    // Normalisation order remains S10.4 matrix, S10.5 readiness, S10.6
    // actions, then S10.7 critique. Legacy prose is diagnostic only; projected
    // fields are a lossy compatibility surface until S10.10 rendering.
    const professionalCritiqueSemantics = applyS10ProfessionalCritique({
      report: report as Record<string, unknown>,
      matrix: report.brief_achievement_matrix,
      readiness: readinessSemantics.judgement,
      fixHierarchy: fixActionSemantics.hierarchy,
      nextActionPlan: fixActionSemantics.nextActionPlan,
      componentVerifications: s10ObservationContext.component_verifications,
      mediaObservationSummary: s10ObservationContext.media_observation_summary,
    });
    if (professionalCritiqueSemantics.warnings.length > 0) {
      console.log("[take-pipeline] s10_strengths_professional_critique_applied", {
        take_id: takeId,
        strength_count: Array.isArray(report.strengths) ? report.strengths.length : 0,
        limitation_count: professionalCritiqueSemantics.critique.critique_limitations.length,
        warning_count: professionalCritiqueSemantics.warnings.length,
      });
    }

    // ---- S10.8 technique-library commentary ----
    // Normalisation order remains S10.3 component verification, S10.4 matrix,
    // S10.7 professional critique, then S10.8 technique. Legacy technique
    // traces and public technique-authority gate state are diagnostic only.
    const techniqueCommentarySemantics = applyS10TechniqueLibraryCommentary({
      report: report as Record<string, unknown>,
      matrix: report.brief_achievement_matrix,
      readiness: readinessSemantics.judgement,
      fixHierarchy: fixActionSemantics.hierarchy,
      nextActionPlan: fixActionSemantics.nextActionPlan,
      professionalCritique: professionalCritiqueSemantics.critique,
      componentVerifications: s10ObservationContext.component_verifications,
      mediaObservationSummary: s10ObservationContext.media_observation_summary,
    });
    if (techniqueCommentarySemantics.warnings.length > 0) {
      console.log("[take-pipeline] s10_technique_library_commentary_applied", {
        take_id: takeId,
        acting_status: techniqueCommentarySemantics.commentary.acting.status,
        vocal_status: techniqueCommentarySemantics.commentary.vocal_singing.status,
        warning_count: techniqueCommentarySemantics.warnings.length,
      });
    }

    // ---- S10.9 timestamped / time-banded commentary ----
    // Preserve the Step 1 legacy timestamped_notes lock, then let S10.9
    // validate the richer structured module and project only safe notes back
    // into the legacy field. raw_report timestamp prose never becomes source
    // of truth here.
    const timestampedCommentarySemantics = applyS10TimestampedCommentary({
      report: report as Record<string, unknown>,
      matrix: report.brief_achievement_matrix,
      readiness: readinessSemantics.judgement,
      fixHierarchy: fixActionSemantics.hierarchy,
      nextActionPlan: fixActionSemantics.nextActionPlan,
      professionalCritique: professionalCritiqueSemantics.critique,
      techniqueCommentary: techniqueCommentarySemantics.commentary,
      observedTapeSequence: s10ObservationContext.observed_tape_sequence,
      componentVerifications: s10ObservationContext.component_verifications,
      timestampedEvidence: twoStepEvidence?.timestamped_evidence ?? [],
    });
    if (
      timestampedCommentarySemantics.warnings.length > 0 ||
      timestampedCommentarySemantics.projectedCount > 0
    ) {
      console.log("[take-pipeline] s10_timestamped_commentary_applied", {
        take_id: takeId,
        note_count: timestampedCommentarySemantics.commentary.notes.length,
        projected_count: timestampedCommentarySemantics.projectedCount,
        missing_component_note_count:
          timestampedCommentarySemantics.commentary.missing_component_note_count,
        warning_count: timestampedCommentarySemantics.warnings.length,
      });
    }

    // ---- Presentation notes — safety filter ----
    const presentationNotes: string[] = Array.isArray(report.presentation_notes)
      ? report.presentation_notes
          .filter(
            (n: unknown): n is string =>
              typeof n === "string" && n.trim().length > 0 && !containsForbidden(n),
          )
          .slice(0, 6)
      : [];
    if (
      Array.isArray(report.presentation_notes) &&
      presentationNotes.length < (report.presentation_notes as unknown[]).length
    ) {
      safetyRewriteApplied = true;
    }
    report.presentation_notes = presentationNotes;
    // Standard disclaimer surfaced alongside notes in the UI layer.
    report.presentation_notes_disclaimer =
      "These do not affect your score unless they make the tape difficult to see or break a specific brief instruction.";

    if (finaliseExceeded()) throwFinaliseTimeout("before_scrubs");
    const scrubsStartedAt = Date.now();
    console.log("[take-pipeline] finalising_scrubs_started", {
      take_id: takeId,
    });

    // ---- Strengths / improvements / fix_first / drills — safety scrub ----
    const scrubArray = (arr: unknown): string[] => {
      if (!Array.isArray(arr)) return [];
      const cleaned = arr.filter(
        (s: unknown): s is string =>
          typeof s === "string" && s.trim().length > 0 && !containsForbidden(s),
      );
      if (cleaned.length < arr.length) safetyRewriteApplied = true;
      return cleaned;
    };
    if (Array.isArray(report.strengths)) report.strengths = scrubArray(report.strengths);
    if (Array.isArray(report.improvements)) report.improvements = scrubArray(report.improvements);
    if (Array.isArray(report.coaching_drills))
      report.coaching_drills = scrubArray(report.coaching_drills);
    if (typeof report.fix_first === "string" && containsForbidden(report.fix_first)) {
      report.fix_first = "";
      safetyRewriteApplied = true;
    }

    // ---- Alternative-material scrub ----
    // Only activates when the brief's material_policy is "fixed" — i.e. the
    // brief requires specific named material. In "choice" / "none" mode,
    // repertoire suggestions are allowed and we leave the report untouched.
    // Falls back to material_requested presence when material_policy is
    // missing (legacy briefs extracted before the helper landed).
    const extractedAny = (extractedBrief ?? {}) as {
      material_requested?: string | null;
      material_policy?: "fixed" | "choice" | "none";
    };
    const materialRequested = (extractedAny.material_requested ?? "").trim();
    const materialPolicy: "fixed" | "choice" | "none" =
      extractedAny.material_policy ?? (materialRequested.length > 0 ? "fixed" : "none");

    // Patterns covering both direct alternatives and SOFT replacement
    // suggestions ("not the best choice", "another piece could showcase you
    // better", "different choice", etc.). Each pattern matches a phrase plus
    // surrounding sentence boundary so the rewrite reads cleanly.
    const ALT_MATERIAL_PATTERNS: RegExp[] = [
      /\b(choose|pick|select|use|try|consider)\s+(an?\s+)?(different|another|alternative)\s+(song|monologue|scene|piece|dance|routine|number|material)\b[^.!?]*[.!?]?/gi,
      /\b(change|switch)\s+(to\s+)?(the\s+|a\s+|an\s+)?(song|monologue|scene|piece|dance|routine|number|material)\b[^.!?]*[.!?]?/gi,
      /\b(?:may|might|would|could)?\s*not\s+(?:be\s+)?the\s+best\s+choice\b[^.!?]*[.!?]?/gi,
      /\b(better|more)\s+suited\b[^.!?]*[.!?]?/gi,
      /\b(could|would|might)\s+showcase\s+you\s+better\b[^.!?]*[.!?]?/gi,
      /\banother\s+(song|monologue|scene|piece|dance|routine|number|material)\b[^.!?]*[.!?]?/gi,
      /\bdifferent\s+(song|monologue|scene|piece|dance|routine|number|material|choice)\b[^.!?]*[.!?]?/gi,
      /\bchoose\s+something\s+else\b[^.!?]*[.!?]?/gi,
      /\bswitch\s+material\b[^.!?]*[.!?]?/gi,
      /\bpick\s+another\b[^.!?]*[.!?]?/gi,
    ];

    const containsMaterialReplacementSuggestion = (s: unknown): boolean =>
      typeof s === "string" && ALT_MATERIAL_PATTERNS.some((re) => re.test(s));

    const rewriteMaterialSuggestion = (s: string): string => {
      let out = s;
      for (const re of ALT_MATERIAL_PATTERNS) {
        out = out.replace(re, "Focus on strengthening the submitted material.");
      }
      return out.replace(/\s{2,}/g, " ").trim();
    };

    let materialScrubTriggered = false;

    if (materialPolicy === "fixed") {
      const stripAlt = (s: string): string => {
        if (!containsMaterialReplacementSuggestion(s)) return s;
        materialScrubTriggered = true;
        return rewriteMaterialSuggestion(s);
      };
      const stripAltArray = (arr: unknown): string[] => {
        if (!Array.isArray(arr)) return [];
        return (arr as unknown[])
          .map((x) => (typeof x === "string" ? stripAlt(x) : ""))
          .filter((s) => s.trim().length > 0);
      };
      if (Array.isArray(report.strengths)) report.strengths = stripAltArray(report.strengths);
      if (Array.isArray(report.improvements))
        report.improvements = stripAltArray(report.improvements);
      if (Array.isArray(report.coaching_drills))
        report.coaching_drills = stripAltArray(report.coaching_drills);
      if (typeof report.fix_first === "string") report.fix_first = stripAlt(report.fix_first);
      if (typeof report.casting_headline === "string")
        report.casting_headline = stripAlt(report.casting_headline);
      if (typeof report.casting_insight === "string")
        report.casting_insight = stripAlt(report.casting_insight);
      if (report.category_notes && typeof report.category_notes === "object") {
        const notes = report.category_notes as Record<string, unknown>;
        for (const k of Object.keys(notes)) {
          if (typeof notes[k] === "string") notes[k] = stripAlt(notes[k] as string);
        }
      }

      // Final server-side invariant: walk the entire report once more and
      // catch anything that slipped past the targeted field-level scrub.
      const assertNoMaterialSuggestions = (
        value: unknown,
      ): { value: unknown; violation: boolean } => {
        if (typeof value === "string") {
          if (containsMaterialReplacementSuggestion(value)) {
            return { value: rewriteMaterialSuggestion(value), violation: true };
          }
          return { value, violation: false };
        }
        if (Array.isArray(value)) {
          let v = false;
          const out = value.map((child) => {
            const r = assertNoMaterialSuggestions(child);
            if (r.violation) v = true;
            return r.value;
          });
          return { value: out, violation: v };
        }
        if (value && typeof value === "object") {
          let v = false;
          const out: Record<string, unknown> = {};
          for (const [k, child] of Object.entries(value as Record<string, unknown>)) {
            const r = assertNoMaterialSuggestions(child);
            if (r.violation) v = true;
            out[k] = r.value;
          }
          return { value: out, violation: v };
        }
        return { value, violation: false };
      };

      const invariant = assertNoMaterialSuggestions(report);
      if (invariant.violation) {
        report = invariant.value as typeof report;
        materialScrubTriggered = true;
        console.warn(
          "[material-fidelity] assertNoMaterialSuggestions caught residual phrasing on a fixed-material report",
          { takeId },
        );
      }

      if (materialScrubTriggered) safetyRewriteApplied = true;
    }

    // Lightweight non-PII safety/invariant summary for downstream debugging.
    const durationOverridden =
      extractedBrief?.time_limit_source === "none" &&
      typeof (extractedBrief as { time_limit_seconds?: number | null } | null)
        ?.time_limit_seconds !== "number";
    console.info("[process-take] safety/invariant summary", {
      takeId,
      material_policy: materialPolicy,
      material_scrub_triggered: materialScrubTriggered,
      duration_overridden: Boolean(durationOverridden),
      safety_rewrite_applied: safetyRewriteApplied,
    });

    // ---- Casting risk explanations — keep aligned with risk flags ----
    if (!Array.isArray(report.casting_risk_explanations)) {
      report.casting_risk_explanations = [];
    }
    // If the model produced explanations but the merged risk flags now include
    // deterministic flags it didn't see, top-up with a neutral default.
    const haveExplanations = new Set(
      (report.casting_risk_explanations as Array<{ flag?: string }>)
        .map((e) => (e.flag ?? "").toLowerCase().trim())
        .filter(Boolean),
    );
    for (const cf of complianceFlags) {
      const key = cf.message.toLowerCase().trim();
      if (haveExplanations.has(key)) continue;
      report.casting_risk_explanations.push({
        flag: cf.message,
        casting_impact:
          cf.severity === "high"
            ? "Casting will likely filter this out before recall — fix before sending."
            : cf.severity === "medium"
              ? "Casting will notice this. It can dent recall chances if other tapes are clean."
              : "Cosmetic — unlikely to affect recall on its own.",
        recall_impact:
          cf.severity === "high"
            ? "likely_to_block"
            : cf.severity === "medium"
              ? "may_reduce"
              : "unlikely_to_affect",
      });
    }

    // ---- Reconcile recall_impact ↔ flag severity ----
    // Authoritative direction: recall_impact wins.
    //  - likely_to_block  → upgrade matching flag to "high" (gates verdict).
    //  - unlikely_to_affect → downgrade matching flag to "low" so it cannot block.
    //  - may_reduce → keep at "medium" unless already higher (don't downgrade
    //    a deterministic high-severity compliance flag).
    const explanations = report.casting_risk_explanations as Array<{
      flag?: string;
      recall_impact?: "unlikely_to_affect" | "may_reduce" | "likely_to_block";
    }>;
    for (const exp of explanations) {
      const expText = (exp.flag ?? "").toLowerCase().trim();
      if (!expText) continue;
      const target = mergedRiskFlags.find((f) => {
        const ft = (f.flag ?? "").toLowerCase();
        return ft === expText || ft.includes(expText) || expText.includes(ft.slice(0, 40));
      });
      if (!target) continue;
      // Don't ever downgrade a deterministic compliance flag.
      const isDeterministic = complianceFlags.some(
        (cf) => cf.message.toLowerCase() === (target.flag ?? "").toLowerCase(),
      );
      if (exp.recall_impact === "likely_to_block") {
        target.severity = "high";
      } else if (exp.recall_impact === "unlikely_to_affect" && !isDeterministic) {
        target.severity = "low";
      } else if (
        exp.recall_impact === "may_reduce" &&
        target.severity === "low" &&
        !isDeterministic
      ) {
        target.severity = "medium";
      }
    }
    report.submission_risk_flags = mergedRiskFlags;

    // ---- Score sanity guard ----
    // If the model's overall and the recomputed overall diverge by more than
    // 15 points, the model's number is unreliable for display. We've already
    // switched to the recomputed value; record the discrepancy for debugging.
    let scoreDiscrepancy: { delta: number; ignoredModel: boolean } | null = null;
    if (overallScoreModel != null) {
      const delta = Math.abs(overallScoreModel - overall);
      if (delta > 15) {
        scoreDiscrepancy = { delta, ignoredModel: true };
        console.warn("runProcessTake: large model/recomputed score delta", {
          takeId,
          model: overallScoreModel,
          recomputed: overall,
          delta,
        });
      }
    }

    // Safety maximum only — do not truncate paid-service feedback at 3.
    if (Array.isArray(report.improvements) && report.improvements.length > 15) {
      report.improvements = report.improvements.slice(0, 15);
    }

    // Deterministic, level-aware submission verdict (the canonical verdict).
    const verdict = computeSubmissionVerdict({
      overall,
      audioScore: modelScores.audio ?? null,
      technicalScore: modelScores.technical ?? null,
      briefAdherence: modelScores.brief_adherence ?? null,
      mode: report.mode,
      atRisk: report.at_risk === true,
      riskFlags: mergedRiskFlags,
      level: auditionLevel,
      scores: modelScores,
    });
    report.submission_verdict = verdict;

    // ---- Block reasons (user-facing, plain language) ----
    // Always populate when the verdict was capped/blocked, or when any
    // deterministic high-severity compliance flag is present.
    const blockReasons: string[] = [];
    const seenReasons = new Set<string>();
    const pushReason = (msg: string) => {
      const m = toUKTerms(msg).trim();
      if (!m) return;
      const key = m.toLowerCase();
      if (seenReasons.has(key)) return;
      seenReasons.add(key);
      blockReasons.push(m);
    };
    // Deterministic compliance flags first (priority).
    for (const cf of complianceFlags) {
      if (cf.severity === "high" || cf.severity === "medium") pushReason(cf.message);
    }
    // Then verdict-derived reasons (covers audio cap, brief adherence, weak categories).
    if (
      verdict.blocked ||
      verdict.label === "Worth another take" ||
      verdict.label === "Not ready yet"
    ) {
      const reason = verdict.reason;
      if (reason) pushReason(reason);
    }
    const readinessJudgement = report.readiness_score_judgement as
      | { rationale?: unknown; brief_blocker_override?: unknown }
      | undefined;
    if (
      readinessJudgement?.brief_blocker_override === true &&
      Array.isArray(readinessJudgement.rationale)
    ) {
      const firstReadinessReason = readinessJudgement.rationale.find(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );
      if (firstReadinessReason) pushReason(firstReadinessReason);
    }
    // Hard fallback: if verdict is non-positive but no reason, add a generic line.
    if (
      blockReasons.length === 0 &&
      (verdict.label === "Worth another take" || verdict.label === "Not ready yet")
    ) {
      pushReason("This take needs another pass before it's ready to send.");
    }

    // ---- Score–feedback alignment (defensive) ----
    // For "Not ready yet" and any blocked verdict, ensure fix_first references
    // a real issue. If improvements is empty but we're not ready, seed it from
    // block reasons so the user always sees something to act on.
    if (
      (verdict.label === "Not ready yet" || verdict.blocked) &&
      (!Array.isArray(report.improvements) || report.improvements.length === 0) &&
      blockReasons.length > 0
    ) {
      report.improvements = blockReasons.slice(0, 6);
    }
    if (
      (verdict.label === "Not ready yet" || verdict.blocked) &&
      (!report.fix_first || typeof report.fix_first !== "string") &&
      blockReasons.length > 0
    ) {
      report.fix_first = blockReasons[0];
    }

    // ---- Deterministic post-Step-2 quality scrubs ----
    // Runs for BOTH two-step and single-pass paths (single sync point).
    // Does NOT alter scores, verdict, caps, weights, thresholds, or
    // material-policy logic. Only rewrites/removes user-facing text that:
    //   - introduces clothing colour not locked in Step 1 evidence
    //   - invents page/line/script/"side" references the system never had
    //   - recommends frame-breaking on-camera movement against a static brief
    // Also rewrites "the side" -> "the scene" for user clarity.
    const qualityScrubResult = scrubReportQuality({
      report,
      evidence: twoStepEvidence,
      briefText: audition.brief ?? null,
      extractedBrief: extractedBrief ?? null,
    });
    for (const [field, count] of Object.entries(qualityScrubResult.visual_removed_per_field)) {
      if (count > 0) {
        console.log("[take-pipeline] unsupported_visual_detail_removed", {
          take_id: takeId,
          field,
          count,
        });
      }
    }
    for (const [field, count] of Object.entries(qualityScrubResult.page_rewritten_per_field)) {
      if ((count as number) > 0) {
        console.log("[take-pipeline] source_reference_rewritten_to_timestamp", {
          take_id: takeId,
          field,
          count,
        });
      }
    }
    for (const [field, count] of Object.entries(qualityScrubResult.side_rewritten_per_field)) {
      if ((count as number) > 0) {
        console.log("[take-pipeline] unclear_industry_language_rewritten", {
          take_id: takeId,
          field,
          count,
        });
      }
    }
    for (const [field, count] of Object.entries(qualityScrubResult.framing_rewritten_per_field)) {
      if (count > 0) {
        console.log("[take-pipeline] brief_incompatible_coaching_rewritten", {
          take_id: takeId,
          field,
          count,
        });
      }
    }

    // ---- Timestamp normalisation: validate, dedupe, sort, cap ----
    const tsNorm = normaliseTimestampedNotes(
      report,
      typeof take.mux_duration_seconds === "number" ? take.mux_duration_seconds : null,
    );
    if (tsNorm.reordered) {
      console.log("[take-pipeline] timestamp_order_normalised", {
        take_id: takeId,
        timestamped_evidence_count: tsNorm.finalCount,
      });
    }
    // Below-target observability for 3–5 minute tapes.
    {
      const dur = typeof take.mux_duration_seconds === "number" ? take.mux_duration_seconds : null;
      if (dur != null && dur >= 180 && dur <= 300) {
        const targetMin = timestampTargetMin(dur);
        if (tsNorm.finalCount < targetMin) {
          const ev = twoStepEvidence;
          const evCount = ev?.timestamped_evidence?.length ?? 0;
          const suff = ev?.evidence_sufficiency;
          const notAssessable =
            !!suff && (!suff.audio_assessable || !suff.video_assessable || !suff.acting_assessable);
          let stage_where_count_was_lost:
            | "step1_underproduced"
            | "step2_dropped"
            | "validation_removed"
            | "not_assessable"
            | "unknown" = "unknown";
          if (notAssessable) {
            stage_where_count_was_lost = "not_assessable";
          } else if (evCount < targetMin) {
            stage_where_count_was_lost = "step1_underproduced";
          } else if (tsNorm.finalCount < evCount) {
            stage_where_count_was_lost = "validation_removed";
          } else {
            // Step1 had enough but final has fewer and validation didn't drop
            // them — implies the polish/locked-field path lost them.
            stage_where_count_was_lost = "step2_dropped";
          }
          console.log("[take-pipeline] timestamp_evidence_below_target", {
            take_id: takeId,
            video_duration_seconds: dur,
            timestamped_evidence_count: tsNorm.finalCount,
            target_min: targetMin,
            stage_where_count_was_lost,
            evidence_sufficiency: ev
              ? {
                  audio_assessable: !!ev.evidence_sufficiency.audio_assessable,
                  video_assessable: !!ev.evidence_sufficiency.video_assessable,
                  acting_assessable: !!ev.evidence_sufficiency.acting_assessable,
                  vocal_assessable: !!ev.evidence_sufficiency.vocal_assessable,
                  movement_assessable: !!ev.evidence_sufficiency.movement_assessable,
                  brief_assessable: !!ev.evidence_sufficiency.brief_assessable,
                  role_fit_assessable: !!ev.evidence_sufficiency.role_fit_assessable,
                }
              : null,
          });
        }
      }
    }

    report.overall_score_model = overallScoreModel;
    report.overall_score_final = overall;
    report.verdict_final = verdict.label;
    report.block_reasons = blockReasons;
    report.extraction_confidence = extractionConfidence;
    report.safety_rewrite_applied = safetyRewriteApplied;
    // Persist the recomputed overall back onto the report so UI is consistent.
    report.overall_score = overall;

    // ---- Feedback reliability correction (user-facing) ----
    // The UI computes a friendly Feedback reliability label from confidence +
    // a few signals. Previously it could downgrade to "Medium" with the reason
    // "the performance is short or partial" even when the tape contained the
    // required components and the internal confidence was high (the UI was
    // using a missing client-side signals.duration). Compute a server-side
    // override so the UI never shows that mismatch.
    {
      const dur =
        typeof take.mux_duration_seconds === "number" && Number.isFinite(take.mux_duration_seconds)
          ? take.mux_duration_seconds
          : null;
      const conf = typeof report.confidence === "number" ? report.confidence : 0;
      const audioScore = typeof report.scores?.audio === "number" ? report.scores.audio : null;
      const techScore =
        typeof report.scores?.technical === "number" ? report.scores.technical : null;
      const components = Array.isArray(report.detected_components)
        ? report.detected_components
        : [];
      const hasBrief = report.mode === "brief";
      const suff = twoStepEvidence?.evidence_sufficiency;
      const suffOk =
        !!suff && suff.audio_assessable && suff.video_assessable && suff.acting_assessable;
      const hasFullPerformance = (dur ?? 0) >= 60 && components.length > 0;

      // Reasons that legitimately downgrade reliability:
      const groundedConcerns: string[] = [];
      if (!hasBrief) groundedConcerns.push("no_brief");
      if (audioScore != null && audioScore < 50) groundedConcerns.push("poor_audio");
      else if (audioScore != null && audioScore < 75) groundedConcerns.push("muddy_audio");
      if (techScore != null && techScore < 50) groundedConcerns.push("poor_video");
      if (!hasFullPerformance) groundedConcerns.push("short_or_partial");
      if (suff && !suff.audio_assessable) groundedConcerns.push("audio_not_assessable");
      if (suff && !suff.video_assessable) groundedConcerns.push("video_not_assessable");
      if (suff && hasBrief && !suff.brief_assessable)
        groundedConcerns.push("brief_extraction_failed");

      let target: "high" | "medium" | "low";
      if (conf >= 85 && groundedConcerns.length === 0) target = "high";
      else if (conf >= 65 && groundedConcerns.length <= 1) target = "medium";
      else target = "low";

      // Detect mismatch: high confidence + good sufficiency + valid duration
      // but the UI would currently show Medium/Low only because the spurious
      // "short or partial" concern fires for a long, complete tape.
      const wouldShowSpuriousShortPartial =
        conf >= 85 && (dur ?? 0) >= 60 && components.length > 0 && suffOk;

      if (wouldShowSpuriousShortPartial && target !== "high") {
        const previous: "low" | "medium" = target;
        target = "high";
        // Persist hint for the UI.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).feedback_reliability_override = "high";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).feedback_reliability_reason_code = "confidence_high_full_tape";
        console.log("[take-pipeline] feedback_reliability_corrected", {
          take_id: takeId,
          previous_label: `Feedback reliability: ${previous === "medium" ? "Medium" : "Low"}`,
          corrected_label: "Feedback reliability: High",
          reason_code: "confidence_high_full_tape",
        });
      } else {
        // Persist the grounded label hint so the UI can prefer it over the
        // legacy client-side computation.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).feedback_reliability_override = target;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).feedback_reliability_reason_code = groundedConcerns[0] ?? "ok";
      }
    }

    // ---- Same-video score-stability monitoring (observability only) ----
    // Compare against the most recent completed prior take of the same
    // audition that uses the same Mux asset (same video). Logs a warning
    // when the final score moves >3 or the verdict flips. Never auto-corrects.
    try {
      const { data: priorTakes } = await supabaseAdmin
        .from("takes")
        .select("id, overall_score, scores, report, score_breakdown, mux_asset_id, mux_playback_id")
        .eq("audition_id", take.audition_id)
        .eq("status", "complete")
        .neq("id", takeId)
        .order("created_at", { ascending: false })
        .limit(5);
      const prior = (priorTakes ?? []).find((p) => {
        if (!p) return false;
        if (take.mux_asset_id && p.mux_asset_id && p.mux_asset_id === take.mux_asset_id)
          return true;
        if (take.mux_playback_id && p.mux_playback_id && p.mux_playback_id === take.mux_playback_id)
          return true;
        return false;
      });
      if (prior) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pr = (prior.report ?? {}) as any;
        const prevVerdict =
          (pr.verdict_final as string | undefined) ??
          (pr.submission_verdict?.label as string | undefined) ??
          "";
        const warn = computeConsistencyWarning({
          currentTakeId: takeId,
          currentOverall: overall,
          currentVerdict: verdict.label,
          currentScores: modelScores,
          currentRoleFitModifier: roleFitModifier,
          currentTimestampCount: Array.isArray(report.timestamped_notes)
            ? report.timestamped_notes.length
            : 0,
          previous: {
            take_id: prior.id,
            overall: Number(prior.overall_score ?? 0),
            verdict: prevVerdict,
            scores: (prior.scores ?? {}) as Record<string, number | null>,
            role_fit_modifier: typeof pr.role_fit_modifier === "number" ? pr.role_fit_modifier : 0,
            timestamp_count: Array.isArray(pr.timestamped_notes) ? pr.timestamped_notes.length : 0,
          },
        });
        if (warn.emit || warn.role_fit_modifier_delta > 2) {
          console.warn("[take-pipeline] analysis_consistency_warning", {
            take_id: takeId,
            previous_take_id: prior.id,
            final_score_delta: warn.final_score_delta,
            verdict_changed: warn.verdict_changed,
            category_delta_summary: warn.category_delta_summary,
            timestamp_count_delta: warn.timestamp_count_delta,
            role_fit_modifier_delta: warn.role_fit_modifier_delta,
          });
        }
      }
    } catch (cmpErr) {
      // Never fail the pipeline on a comparison miss.
      console.info("[take-pipeline] consistency_compare_skipped", {
        take_id: takeId,
        reason: cmpErr instanceof Error ? cmpErr.message.slice(0, 120) : "unknown",
      });
    }

    // ---- Score / verdict alignment (text-only) ----
    // Only adjusts wording (headline/insight) when it conflicts with the
    // locked verdict. Never changes scores or the verdict itself.
    const alignment = enforceScoreAlignment(report, verdict.label as VerdictLabel);
    if (alignment.adjusted) {
      console.log("[take-pipeline] report_score_alignment_adjusted", {
        take_id: takeId,
        verdict_final: verdict.label,
        final_score: overall,
      });
    }

    // ---- Defensive final array safety maxima (technical only; not product caps) ----
    // v2 reports must not be artificially thinned to 3/3/8. These are runaway
    // safeguards, not product caps. Soft targets are guided by Step 2 prompt.
    if (Array.isArray(report.strengths) && report.strengths.length > 12) {
      report.strengths = report.strengths.slice(0, 12);
    }
    if (Array.isArray(report.improvements) && report.improvements.length > 15) {
      report.improvements = report.improvements.slice(0, 15);
    }
    if (Array.isArray(report.presentation_notes) && report.presentation_notes.length > 6) {
      report.presentation_notes = report.presentation_notes.slice(0, 6);
    }
    if (Array.isArray(report.timestamped_notes) && report.timestamped_notes.length > 36) {
      report.timestamped_notes = report.timestamped_notes.slice(0, 36);
    }

    // ---- Phase 3C P0 — deterministic public output enforcement ----
    // Cleans user-facing prose only. Never touches scores, overall, verdict,
    // role-fit modifier, score_breakdown or schema_version. Both v1 and v2
    // persistence paths consume the cleaned `report` below.
    try {
      const framingFixed = detectFramingFixed(
        (extractedBrief as { framing_required?: string | null } | null)?.framing_required ?? null,
      );
      const enforcement = enforcePublicReportOutputQuality(
        report as unknown as Record<string, unknown>,
        {
          mode: audition.brief ? "brief" : "baseline",
          auditionType,
          framingFixed,
          materialPolicy,
        },
      );
      // Re-assign cleaned fields back onto the report (keeps reference stable).
      Object.assign(report, enforcement.report);
      const s10CritiqueScrub = scrubS10ProfessionalCritiqueProjection(
        report as unknown as Record<string, unknown>,
      );
      const s10TechniqueScrub = scrubS10TechniqueCommentaryProjection(
        report as unknown as Record<string, unknown>,
      );
      const s10TimestampedScrub = scrubS10TimestampedCommentaryProjection(
        report as unknown as Record<string, unknown>,
      );
      if (
        s10CritiqueScrub.removed > 0 ||
        s10TechniqueScrub.removed > 0 ||
        s10TimestampedScrub.removed > 0
      ) {
        safetyRewriteApplied = true;
      }
      console.log("[take-pipeline] output_enforcement_applied", {
        take_id: takeId,
        framing_fixed: framingFixed,
        s10_professional_critique_projection_removed: s10CritiqueScrub.removed,
        s10_technique_commentary_projection_removed: s10TechniqueScrub.removed,
        s10_timestamped_commentary_projection_removed: s10TimestampedScrub.removed,
        ...enforcement.counters,
      });
    } catch (enfErr) {
      console.warn("[take-pipeline] output_enforcement_skipped", {
        take_id: takeId,
        reason: enfErr instanceof Error ? enfErr.message.slice(0, 200) : "unknown",
      });
    }

    // ---- S10.9 AI module readiness / repair hooks ----
    // Two-step and single-pass outputs share this module-readiness gate. It
    // records repair triggers for missing/thin/generic/contradictory/
    // unsupported AI modules without replacing missing professional judgement
    // with static fallback prose.
    let s10ModuleReadiness = evaluateS10ModuleReadiness({
      report: report as Record<string, unknown>,
      observationContext: s10ObservationContext,
      briefContext: extractedBrief?.brief_context ?? null,
      briefRequirements: extractedBrief?.brief_requirements ?? [],
      selectedLevel: auditionLevel,
      sourceStage: isTwoStepEnabled() ? "two_step" : "single_pass",
    });
    let persistedS10ModuleReadiness = summariseS10ModuleReadinessForPersistence(s10ModuleReadiness);
    report.s10_module_readiness = persistedS10ModuleReadiness;
    report.s10_module_repair_actions = persistedS10ModuleReadiness.repair_actions;
    if (s10ModuleReadiness.repair_action_count > 0 || s10ModuleReadiness.thin_shell_blocked) {
      console.warn("[take-pipeline] s10_module_repair_triggered", {
        take_id: takeId,
        source_stage: s10ModuleReadiness.source_stage,
        repair_action_count: s10ModuleReadiness.repair_action_count,
        thin_shell_blocked: s10ModuleReadiness.thin_shell_blocked,
        modules: s10ModuleReadiness.repair_actions
          .map((action) => action.report_module)
          .slice(0, 12),
      });
    }
    const moduleQualityBlockers = () =>
      s10ModuleReadiness.results.filter((result) => result.blocks_report_value);
    const residualRecoverableModules = new Set([
      "performer level calibration",
      "technique commentary",
    ]);
    const canApplyResidualModuleRecovery = (
      blockers: Array<{ report_module: string; blocks_report_value: boolean }>,
    ) =>
      blockers.length > 0 &&
      blockers.every((result) => residualRecoverableModules.has(result.report_module));
    const canRecoverModuleQuality =
      isTwoStepEnabled() &&
      hasSufficientStep1EvidenceForModuleRecovery(twoStepEvidence) &&
      moduleQualityBlockers().length > 0;
    if (canRecoverModuleQuality && twoStepEvidence) {
      moduleQualityRecoveryReason = s10ModuleReadiness.thin_shell_blocked
        ? "thin_shell_blocked"
        : "critical_s10_modules_unavailable";

      const runModuleReadiness = (candidate: Record<string, unknown>) =>
        evaluateS10ModuleReadiness({
          report: candidate,
          observationContext: s10ObservationContext,
          briefContext: extractedBrief?.brief_context ?? null,
          briefRequirements: extractedBrief?.brief_requirements ?? [],
          selectedLevel: auditionLevel,
          sourceStage: "two_step",
        });

      const moduleRepairAc = new AbortController();
      const moduleRepairTimer = setTimeout(
        () => moduleRepairAc.abort("s10_module_repair_timeout"),
        Math.min(ANALYSIS_GEMINI_TIMEOUT_MS, 45_000),
      );
      moduleRepairRetryAttempted = true;
      console.warn("[take-pipeline] s10_module_repair_retry_started", {
        ...baseLog,
        reason: moduleQualityRecoveryReason,
        blocker_count: moduleQualityBlockers().length,
        modules: moduleQualityBlockers()
          .map((result) => result.report_module)
          .slice(0, 12),
      });
      metric("s10_module_repair_retry_started", {
        take_id: takeId,
        reason: moduleQualityRecoveryReason,
        blocker_count: moduleQualityBlockers().length,
      });
      try {
        const moduleRepairInstruction = buildS10ModuleRepairRetryInstruction({
          repairActions: s10ModuleReadiness.repair_actions,
        });
        let retryResult = await runReportPolish({
          apiKey,
          signal: moduleRepairAc.signal,
          evidence: twoStepEvidence,
          briefBlock,
          extractedBlock,
          briefContext: extractedBrief?.brief_context ?? null,
          briefRequirements: extractedBrief?.brief_requirements ?? [],
          signalsBlock,
          levelBlock,
          auditionTitle: audition.title,
          reportTool: REPORT_TOOL,
          usageContext: aiUsageContext,
          recoveryInstruction: moduleRepairInstruction,
        });
        // JSON-object salvage parity with the main polish call: a single recoverable
        // HTTP-200 response-shape/parse failure must not burn the only repair attempt.
        if (
          isRecoverableReportPolishResponseShapeError(retryResult) &&
          !moduleRepairAc.signal.aborted
        ) {
          console.warn("[take-pipeline] s10_module_repair_retry_json_salvage_started", {
            ...baseLog,
            http_status: retryResult.httpStatus,
            safe_error_category: retryResult.safe_error_category,
            error: retryResult.error.slice(0, 120),
          });
          metric("s10_module_repair_retry_json_salvage_started", {
            take_id: takeId,
            http_status: retryResult.httpStatus,
            safe_error_category: retryResult.safe_error_category,
          });
          const salvage = await runReportPolish({
            apiKey,
            signal: moduleRepairAc.signal,
            evidence: twoStepEvidence,
            briefBlock,
            extractedBlock,
            briefContext: extractedBrief?.brief_context ?? null,
            briefRequirements: extractedBrief?.brief_requirements ?? [],
            signalsBlock,
            levelBlock,
            auditionTitle: audition.title,
            reportTool: REPORT_TOOL,
            usageContext: aiUsageContext,
            recoveryInstruction: `${moduleRepairInstruction}\n\n${REPORT_POLISH_JSON_OBJECT_RETRY_INSTRUCTION}`,
          });
          retryResult = {
            ...salvage,
            durationMs: retryResult.durationMs + salvage.durationMs,
          };
        }
        if (retryResult.ok) {
          const candidate = retryResult.report as Record<string, unknown>;
          candidate.mode = audition.brief ? "brief" : "baseline";
          const locked = enforceLockedFields(candidate, twoStepEvidence);
          twoStepEnforcement.locked_field_overwrites += locked.overwrites;
          const claims = enforceUnsupportedClaims(candidate, twoStepEvidence);
          twoStepEnforcement.unsupported_claims_removed += claims.removed;
          twoStepEnforcement.unsupported_claims_rewritten += claims.rewritten;
          const retryReadiness = runModuleReadiness(candidate);
          const retryBlockers = retryReadiness.results.filter(
            (result) => result.blocks_report_value,
          );
          if (retryBlockers.length === 0) {
            moduleRepairRetrySucceeded = true;
            report = candidate;
            s10ModuleReadiness = retryReadiness;
            persistedS10ModuleReadiness =
              summariseS10ModuleReadinessForPersistence(s10ModuleReadiness);
            console.log("[take-pipeline] s10_module_repair_retry_completed", {
              ...baseLog,
              duration_ms: retryResult.durationMs,
              locked_overwrites: locked.overwrites,
              claims_removed: claims.removed,
              claims_rewritten: claims.rewritten,
            });
            metric("s10_module_repair_retry_completed", {
              take_id: takeId,
              duration_ms: retryResult.durationMs,
              locked_overwrites: locked.overwrites,
              claims_removed: claims.removed,
              claims_rewritten: claims.rewritten,
            });
          } else {
            console.warn("[take-pipeline] s10_module_repair_retry_failed", {
              ...baseLog,
              reason: "critical_modules_still_blocked",
              duration_ms: retryResult.durationMs,
              blocker_count: retryBlockers.length,
              modules: retryBlockers.map((result) => result.report_module).slice(0, 12),
            });
            metric("s10_module_repair_retry_failed", {
              take_id: takeId,
              reason: "critical_modules_still_blocked",
              duration_ms: retryResult.durationMs,
              blocker_count: retryBlockers.length,
            });
          }
        } else {
          console.warn("[take-pipeline] s10_module_repair_retry_failed", {
            ...baseLog,
            reason: retryResult.error.slice(0, 120),
            http_status: retryResult.httpStatus,
            safe_error_category: retryResult.safe_error_category,
            duration_ms: retryResult.durationMs,
          });
          metric("s10_module_repair_retry_failed", {
            take_id: takeId,
            reason: retryResult.error.slice(0, 120),
            http_status: retryResult.httpStatus,
            safe_error_category: retryResult.safe_error_category,
            duration_ms: retryResult.durationMs,
          });
        }
      } finally {
        clearTimeout(moduleRepairTimer);
      }

      if (!moduleRepairRetrySucceeded && moduleQualityBlockers().length > 0) {
        console.warn("[take-pipeline] s10_module_quality_recovery_started", {
          ...baseLog,
          reason: moduleQualityRecoveryReason,
          blocker_count: moduleQualityBlockers().length,
          modules: moduleQualityBlockers()
            .map((result) => result.report_module)
            .slice(0, 12),
        });
        metric("s10_module_quality_recovery_started", {
          take_id: takeId,
          reason: moduleQualityRecoveryReason,
          blocker_count: moduleQualityBlockers().length,
        });
        const recovery = buildS10ModuleQualityRecoveryReport({
          evidence: twoStepEvidence,
          briefContext: extractedBrief?.brief_context ?? null,
          briefRequirements: extractedBrief?.brief_requirements ?? [],
          auditionTitle: audition.title,
          selectedLevel: auditionLevel,
          mode: audition.brief ? "brief" : "baseline",
          reason: moduleQualityRecoveryReason,
          retryAttempted: moduleRepairRetryAttempted,
          retrySucceeded: moduleRepairRetrySucceeded,
        });
        if (recovery.ok) {
          const recoveredReport = ukifyDeep(recovery.report) as Record<string, unknown>;
          const recoveryReadiness = runModuleReadiness(recoveredReport);
          let recoveryReadinessCurrent = recoveryReadiness;
          let recoveryBlockers = recoveryReadinessCurrent.results.filter(
            (result) => result.blocks_report_value,
          );
          if (canApplyResidualModuleRecovery(recoveryBlockers)) {
            const residual = applyS10ResidualModuleRecovery({
              report: recoveredReport,
              evidence: twoStepEvidence,
              briefRequirements: extractedBrief?.brief_requirements ?? [],
              selectedLevel: auditionLevel,
              mode: audition.brief ? "brief" : "baseline",
              residualModules: recoveryBlockers.map((result) => result.report_module),
            });
            residualModuleRecoveryUsed = residual.recoveredModules.length > 0;
            residualModulesRecovered = residual.recoveredModules;
            if (residualModuleRecoveryUsed) {
              console.warn("[take-pipeline] s10_module_quality_residual_limitations_applied", {
                ...baseLog,
                reason: moduleQualityRecoveryReason,
                modules: residualModulesRecovered,
              });
              metric("s10_module_quality_residual_limitations_applied", {
                take_id: takeId,
                reason: moduleQualityRecoveryReason,
                modules: residualModulesRecovered.join(","),
              });
              if (residualModulesRecovered.includes("performer level calibration")) {
                metric("s10_residual_level_calibration_applied", {
                  take_id: takeId,
                  reason: moduleQualityRecoveryReason,
                });
              }
              if (residualModulesRecovered.includes("technique commentary")) {
                metric("s10_residual_technique_commentary_applied", {
                  take_id: takeId,
                  reason: moduleQualityRecoveryReason,
                });
              }
              recoveryReadinessCurrent = runModuleReadiness(recoveredReport);
              recoveryBlockers = recoveryReadinessCurrent.results.filter(
                (result) => result.blocks_report_value,
              );
            }
          }
          const recoveryDecisionCriticalBlockers = recoveryBlockers.filter(
            (result) => result.decision_critical,
          );
          if (recoveryDecisionCriticalBlockers.length === 0) {
            // Adopt the evidence-bound recovered report once no decision-critical
            // module is blocked. Any remaining blockers are non-decision-critical
            // and render as honest evidence-limited sections (handled at the gate).
            report = recoveredReport;
            s10ModuleQualityRecoveryUsed = true;
            s10ModuleReadiness = recoveryReadinessCurrent;
            persistedS10ModuleReadiness =
              summariseS10ModuleReadinessForPersistence(s10ModuleReadiness);
            console.warn("[take-pipeline] s10_module_quality_recovery_built", {
              ...baseLog,
              reason: moduleQualityRecoveryReason,
              limitation_count: recovery.limitationCount,
              residual_module_recovery_used: residualModuleRecoveryUsed,
              residual_modules_recovered: residualModulesRecovered,
              degradable_modules_remaining: recoveryBlockers
                .map((result) => result.report_module)
                .slice(0, 12),
            });
          } else {
            console.warn("[take-pipeline] s10_module_quality_recovery_failed", {
              ...baseLog,
              reason: "critical_modules_still_blocked",
              blocker_count: recoveryDecisionCriticalBlockers.length,
              modules: recoveryDecisionCriticalBlockers
                .map((result) => result.report_module)
                .slice(0, 12),
            });
            metric("s10_module_quality_recovery_failed", {
              take_id: takeId,
              reason: "critical_modules_still_blocked",
              blocker_count: recoveryDecisionCriticalBlockers.length,
            });
          }
        } else {
          console.warn("[take-pipeline] s10_module_quality_recovery_failed", {
            ...baseLog,
            reason: recovery.reason,
          });
          metric("s10_module_quality_recovery_failed", {
            take_id: takeId,
            reason: recovery.reason,
          });
        }
      }

      const remainingBlockers = moduleQualityBlockers();
      const decisionCriticalBlockers = remainingBlockers.filter(
        (result) => result.decision_critical,
      );
      if (decisionCriticalBlockers.length > 0) {
        // A useful, honest report cannot be produced: a decision-critical module
        // (submit/retake/review judgement, brief achievement, or a truthful fix
        // hierarchy) is still blocked after repair and evidence-bound recovery.
        //
        // Emit the blocked module names + statuses BEFORE throwing. The generic
        // performer-facing message must not leak module internals, but the
        // metric/log stream (which stays queryable when raw server logs are
        // not) needs to name exactly which decision-critical module blocked so
        // a re-run is self-diagnosing rather than an opaque parse failure.
        const blockedModules = decisionCriticalBlockers.map((result) => result.report_module);
        console.warn("[take-pipeline] s10_decision_critical_blocked", {
          ...baseLog,
          reason: moduleQualityRecoveryReason,
          module_repair_retry_attempted: moduleRepairRetryAttempted,
          module_repair_retry_succeeded: moduleRepairRetrySucceeded,
          module_quality_recovery_used: s10ModuleQualityRecoveryUsed,
          residual_module_recovery_used: residualModuleRecoveryUsed,
          blocked_modules: decisionCriticalBlockers
            .map((result) => `${result.report_module}:${result.status}`)
            .slice(0, 12),
        });
        metric("s10_decision_critical_blocked", {
          take_id: takeId,
          reason: moduleQualityRecoveryReason ?? "decision_critical_modules_blocked",
          modules: blockedModules.join(","),
          module_repair_retry_attempted: moduleRepairRetryAttempted,
          module_quality_recovery_used: s10ModuleQualityRecoveryUsed,
        });
        throw new AnalysisFailure(
          "analysis_parse_failed",
          "TapeCoach could not assemble the full S10 report model for this take. Please try again.",
        );
      }
      if (remainingBlockers.length > 0) {
        // Evidence-bound graceful degradation: only non-decision-critical modules
        // remain blocked, so render the report with those sections marked as
        // evidence-limited rather than failing the whole take.
        const degradedModules = remainingBlockers.map((result) => result.report_module);
        console.warn("[take-pipeline] s10_module_degraded_render", {
          ...baseLog,
          reason: moduleQualityRecoveryReason,
          modules: degradedModules.slice(0, 12),
        });
        metric("s10_module_degraded_render", {
          take_id: takeId,
          reason: moduleQualityRecoveryReason ?? "non_decision_critical_modules_blocked",
          modules: degradedModules.join(","),
        });
        report.s10_degraded_render_used = true;
        report.s10_degraded_modules = degradedModules;
      }

      report.s10_module_readiness = persistedS10ModuleReadiness;
      report.s10_module_repair_actions = persistedS10ModuleReadiness.repair_actions;
      report.s10_module_quality_recovery_used = s10ModuleQualityRecoveryUsed;
      report.module_repair_retry_attempted = moduleRepairRetryAttempted;
      report.module_repair_retry_succeeded = moduleRepairRetrySucceeded;
      report.module_quality_recovery_reason = moduleQualityRecoveryReason;
      report.residual_module_recovery_used = residualModuleRecoveryUsed;
      report.residual_module_recovery_reason = residualModuleRecoveryUsed
        ? "performer_level_calibration_and_or_technique_commentary"
        : null;
      report.residual_modules_recovered = residualModulesRecovered;
    }

    const scoreBreakdown = {
      audition_type: auditionType,
      level: auditionLevel,
      weights: recomputed.usedWeights,
      thresholds: bandsForLevel(auditionLevel),
      overall_score_model: overallScoreModel,
      overall_before_role_fit: overallBeforeRoleFit,
      role_fit_modifier: roleFitModifier,
      role_fit_modifier_explanation:
        roleFitModifier === 0
          ? "No role-fit adjustment applied."
          : `Role fit adjusted the score by ${roleFitModifier > 0 ? "+" : ""}${roleFitModifier} based on alignment with the brief's tone, energy, and intent.`,
      role_fit_confidence: report.role_fit_confidence,
      overall_score_final: overall,
      verdict_final: verdict.label,
      block_reasons: blockReasons,
      extraction_confidence: extractionConfidence,
      score_discrepancy: scoreDiscrepancy,
      readiness_score_judgement: report.readiness_score_judgement ?? null,
      s10_fix_hierarchy: report.s10_fix_hierarchy ?? null,
      s10_next_action_plan: report.s10_next_action_plan ?? null,
      s10_professional_critique: report.s10_professional_critique ?? null,
      s10_technique_commentary: report.s10_technique_commentary ?? null,
      s10_timestamped_commentary: report.s10_timestamped_commentary ?? null,
      s10_module_readiness: {
        version: s10ModuleReadiness.version,
        source_stage: s10ModuleReadiness.source_stage,
        module_ready: s10ModuleReadiness.module_ready,
        thin_shell_blocked: s10ModuleReadiness.thin_shell_blocked,
        decision_critical_blocked: s10ModuleReadiness.decision_critical_blocked,
        repair_action_count: s10ModuleReadiness.repair_action_count,
        results: s10ModuleReadiness.results.map((result) => ({
          report_module: result.report_module,
          status: result.status,
          reason: result.reason,
          repair_triggered: result.repair_triggered,
          blocks_report_value: result.blocks_report_value,
          decision_critical: result.decision_critical,
        })),
      },
      compliance_flags: complianceFlags,
      presentation_notes_count: presentationNotes.length,
      safety_rewrite_applied: safetyRewriteApplied,
      material_policy: materialPolicy,
      material_scrub_triggered: materialScrubTriggered,
      // Compact, non-sensitive two-step pipeline summary. No raw evidence
      // text or model output. Only present when the two-step pipeline ran.
      two_step: isTwoStepEnabled()
        ? {
            enabled: true,
            evidence_version: "1",
            evidence_pass_duration_ms: evidencePassDurationMs,
            report_polish_duration_ms: reportPolishDurationMs,
            two_step_total_ai_duration_ms: evidencePassDurationMs + reportPolishDurationMs,
            timestamped_evidence_count: twoStepEvidence?.timestamped_evidence.length ?? 0,
            timestamped_evidence_dropped_count: twoStepTimestampsDropped,
            fallback_used: twoStepFallbackUsed,
            polish_fallback_reason: twoStepFallbackReason,
            polish_retry_attempted: polishRetryAttempted,
            polish_retry_succeeded: polishRetrySucceeded,
            report_polish_fallback_used: twoStepFallbackUsed,
            module_repair_retry_attempted: moduleRepairRetryAttempted,
            module_repair_retry_succeeded: moduleRepairRetrySucceeded,
            s10_module_quality_recovery_used: s10ModuleQualityRecoveryUsed,
            module_quality_recovery_reason: moduleQualityRecoveryReason,
            residual_module_recovery_used: residualModuleRecoveryUsed,
            residual_modules_recovered: residualModulesRecovered,
            locked_field_overwrite_count: twoStepEnforcement.locked_field_overwrites,
            unsupported_claims_removed_count: twoStepEnforcement.unsupported_claims_removed,
            unsupported_claims_rewritten_count: twoStepEnforcement.unsupported_claims_rewritten,
            evidence_sufficiency: twoStepEvidence
              ? {
                  audio_assessable: !!twoStepEvidence.evidence_sufficiency.audio_assessable,
                  video_assessable: !!twoStepEvidence.evidence_sufficiency.video_assessable,
                  acting_assessable: !!twoStepEvidence.evidence_sufficiency.acting_assessable,
                  vocal_assessable: !!twoStepEvidence.evidence_sufficiency.vocal_assessable,
                  movement_assessable: !!twoStepEvidence.evidence_sufficiency.movement_assessable,
                  brief_assessable: !!twoStepEvidence.evidence_sufficiency.brief_assessable,
                  role_fit_assessable: !!twoStepEvidence.evidence_sufficiency.role_fit_assessable,
                }
              : null,
          }
        : { enabled: false },
    };

    // ---- Report schema version stamp (Phase 0 foundation) ----
    // Every persisted report carries a schema_version. Renderers read this
    // to choose layout. Legacy stays "v1-legacy"; future component-first
    // reports will write "v2-component" once the future_report_enabled flag
    // is flipped on. Never change the value of an already-persisted report.
    if (typeof (report as Record<string, unknown>).schema_version !== "string") {
      (report as Record<string, unknown>).schema_version = "v1-legacy";
    }

    const liveSameVideoContext = await classifyLiveSameVideoContext({
      take: {
        id: take.id,
        user_id: take.user_id,
        audition_id: take.audition_id,
        signals: take.signals,
        checklist: take.checklist,
        mux_duration_seconds: take.mux_duration_seconds,
      },
    });
    if (liveSameVideoContext) {
      report.s10_same_video_evidence = liveSameVideoContext.evidence;
      report.s10_comparison_truth = liveSameVideoContext.comparison_truth;
      report.comparison_display_mode = liveSameVideoContext.comparison_display_mode;
      console.log("[take-pipeline] s10_same_video_classified", {
        take_id: takeId,
        status: liveSameVideoContext.evidence.status,
        confidence: liveSameVideoContext.evidence.confidence,
        comparison_display_mode: liveSameVideoContext.comparison_display_mode,
      });
    }

    // ---- S10.10 / Phase 3B — v2 persistence selection ----
    // S10 reports use the authenticated S10 view model as the route source.
    // If S10 route assembly fails, persist a validated S10 limitation report or
    // fail generation explicitly; never substitute the legacy v1 report.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let reportToPersist: any = report;
    const reportRecordForV2 = report as Record<string, unknown>;
    let v2HasS10ReportModel =
      reportRecordForV2.source_mode === "s10_ai_report_model" ||
      reportRecordForV2.s10_view_model != null ||
      [
        "brief_achievement_matrix",
        "readiness_score_judgement",
        "s10_fix_hierarchy",
        "s10_next_action_plan",
        "s10_professional_critique",
        "s10_technique_commentary",
        "s10_timestamped_commentary",
      ].some((key) => Boolean(reportRecordForV2[key]));
    try {
      const { getResolvedConfig: getCfg3b } = await import("./app-config.server");
      const cfg3b = await getCfg3b();
      const { buildRouteReportForPersistence, hasS10AuthoritativeModules } =
        await import("./v2-report-builder.server");
      const hasS10ReportModel = hasS10AuthoritativeModules(report as Record<string, unknown>);
      v2HasS10ReportModel = hasS10ReportModel;
      const persistence = buildRouteReportForPersistence({
        legacyReport: report as Record<string, unknown>,
        futureDimensions: capturedFutureDimensions ?? null,
        auditionType: (report.audition_type as string | null) ?? null,
        mode: audition.brief ? "brief" : "baseline",
        futureReportEnabled: cfg3b.future_report_enabled,
        s10Context: hasS10ReportModel
          ? {
              briefContext: extractedBrief?.brief_context ?? null,
              briefRequirements: extractedBrief?.brief_requirements ?? [],
              observedTapeSequence: s10ObservationContext.observed_tape_sequence,
              componentVerifications: s10ObservationContext.component_verifications,
              mediaObservationSummary: s10ObservationContext.media_observation_summary,
              sameVideoEvidence: liveSameVideoContext?.evidence ?? null,
              comparisonTruth: liveSameVideoContext?.comparison_truth ?? null,
              comparisonDisplayMode: liveSameVideoContext?.comparison_display_mode ?? null,
              observationSourceKind: s10ObservationContext.source_kind,
            }
          : null,
      });
      if (persistence.outcome === "s10_unrecoverable") {
        throw new AnalysisFailure(
          "analysis_parse_failed",
          "TapeCoach could not assemble the S10 report surface. Please try again.",
        );
      }
      if (
        persistence.outcome === "v2_persisted" ||
        persistence.outcome === "s10_limited_v2_persisted"
      ) {
        reportToPersist = persistence.reportToPersist;
        console.log("[take-pipeline] v2_report_persisted", {
          take_id: takeId,
          schema_version: persistence.reportToPersist.schema_version,
          outcome: persistence.outcome,
          components: persistence.reportToPersist.components.length,
          from_future_dimensions: !!capturedFutureDimensions,
          reason:
            persistence.outcome === "s10_limited_v2_persisted" ? persistence.reason : undefined,
        });
      }
    } catch (err) {
      console.warn("[take-pipeline] v2_report_build_failed", {
        take_id: takeId,
        reason: "build_threw",
        error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      });
      if (err instanceof AnalysisFailure) throw err;
      if (v2HasS10ReportModel) {
        try {
          const { buildS10LimitedV2Report, validateV2PublicBoundary } =
            await import("./v2-report-builder.server");
          const limited = buildS10LimitedV2Report({
            auditionType: (report.audition_type as string | null) ?? null,
            mode: audition.brief ? "brief" : "baseline",
          });
          const limitedCheck = validateV2PublicBoundary(limited, null);
          if (limitedCheck.ok) {
            reportToPersist = limited;
            console.log("[take-pipeline] v2_report_persisted", {
              take_id: takeId,
              schema_version: limited.schema_version,
              outcome: "s10_limited_v2_persisted",
              components: limited.components.length,
              from_future_dimensions: false,
            });
          } else {
            throw new AnalysisFailure(
              "analysis_parse_failed",
              "TapeCoach could not assemble the S10 report surface. Please try again.",
            );
          }
        } catch (limitedErr) {
          if (limitedErr instanceof AnalysisFailure) throw limitedErr;
          throw new AnalysisFailure(
            "analysis_parse_failed",
            "TapeCoach could not assemble the S10 report surface. Please try again.",
          );
        }
      } else {
        reportToPersist = report;
      }
    }

    console.log("[take-pipeline] finalising_scrubs_completed", {
      take_id: takeId,
      duration_ms: Date.now() - scrubsStartedAt,
    });
    console.log("[take-pipeline] finalising_postprocess_completed", {
      take_id: takeId,
      duration_ms: Date.now() - finalisingStartedAt,
    });

    // ---- Persist stage (timed, tagged, conditional) ----
    if (finaliseExceeded()) throwFinaliseTimeout("before_persist");
    const persistStartedAt = Date.now();
    metric("analysis_persist_started", { take_id: takeId });
    console.log("[take-pipeline] analysis_persist_started", baseLog);
    console.log("[take-pipeline] finalising_persist_started", {
      take_id: takeId,
    });

    if (finaliseExceeded()) {
      metric("analysis_persist_failed", {
        take_id: takeId,
        duration_ms: Date.now() - persistStartedAt,
        reason: "post_ai_finalise_timeout",
      });
      throw new AnalysisFailure(
        "analysis_persist_failed",
        "Saving the report took too long. Please try again.",
      );
    }

    // Final cancellation guard: if the user cancelled while Gemini was
    // running, do NOT overwrite the cancelled state with a completed report.
    const { data: preWrite } = await supabaseAdmin
      .from("takes")
      .select("status, processing_phase, attempt_count, error_message")
      .eq("id", takeId)
      .single();
    if (
      !preWrite ||
      preWrite.status !== "processing" ||
      (preWrite.processing_phase !== "finalising" && preWrite.processing_phase !== "analysing")
    ) {
      console.log("result_discarded_state_changed", {
        take_id: takeId,
        processing_phase: preWrite?.processing_phase ?? null,
        attempt_count: preWrite?.attempt_count ?? 0,
      });
      metric("result_discarded_state_changed", {
        take_id: takeId,
        processing_phase: preWrite?.processing_phase ?? null,
        reason: "state_changed_pre_write",
      });
      terminalWritten = true; // another path owns the terminal state
      return { ok: true, alreadyDone: true };
    }

    // The takes.overall_score and takes.confidence columns are INTEGER. The
    // report-level confidence can be a string enum ("low"/"medium"/"high") on
    // some AI paths — the duration-override block above already guards for
    // report.confidence not being a number — and a raw string (or non-finite
    // value) written to an integer column makes the persist UPDATE throw,
    // dead-ending an otherwise-complete take as analysis_persist_failed. Coerce
    // to integer-or-null at the write boundary so an unknown/odd value degrades
    // to null (evidence-bound graceful degradation) rather than failing the
    // whole report.
    const overallScoreForPersist =
      typeof overall === "number" && Number.isFinite(overall) ? Math.round(overall) : null;
    const confidenceForPersist =
      typeof report.confidence === "number" && Number.isFinite(report.confidence)
        ? Math.round(report.confidence)
        : null;

    // Conditional update: only persist if the row is still in the exact
    // pre-write state (status=processing AND processing_phase=analysing).
    // If state changed (cancel, retry, reset, error) between the read above
    // and this write, the update affects 0 rows and we discard silently.
    let updatedRows: { id: string }[] | null = null;
    try {
      const updateRes = await supabaseAdmin
        .from("takes")
        .update({
          status: "complete",
          processing_phase: "complete",
          analysis_run_id: analysisRunId,
          report_model_status: "rendered",
          report: reportToPersist,
          scores: report.scores,
          overall_score: overallScoreForPersist,
          confidence: confidenceForPersist,
          error_message: null,
          compliance_flags: complianceFlags as never,
          score_breakdown: scoreBreakdown as never,
        })
        .eq("id", takeId)
        .eq("status", "processing")
        .in("processing_phase", ["finalising", "analysing"])
        .select("id");
      if (updateRes.error) throw updateRes.error;
      updatedRows = updateRes.data ?? null;
      if (finaliseExceeded()) {
        metric("analysis_persist_failed", {
          take_id: takeId,
          duration_ms: Date.now() - persistStartedAt,
          reason: "post_ai_finalise_timeout_after_write",
        });
        throw new AnalysisFailure(
          "analysis_persist_failed",
          "Saving the report took too long. Please try again.",
        );
      }
    } catch (writeErr) {
      if (writeErr instanceof AnalysisFailure) throw writeErr;
      metric("analysis_persist_failed", {
        take_id: takeId,
        duration_ms: Date.now() - persistStartedAt,
        reason: writeErr instanceof Error ? writeErr.message.slice(0, 120) : "persist_error",
      });
      console.error("[take-pipeline] analysis_persist_failed", writeErr);
      console.error("[take-pipeline] finalising_persist_failed", {
        take_id: takeId,
        duration_ms: Date.now() - persistStartedAt,
        finalising_duration_ms: finaliseElapsedMs(),
        reason: writeErr instanceof Error ? writeErr.message.slice(0, 120) : "persist_error",
      });
      throw new AnalysisFailure(
        "analysis_persist_failed",
        "We couldn't save the report. Please try again.",
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.log("result_discarded_state_changed", {
        take_id: takeId,
        processing_phase: preWrite.processing_phase,
        attempt_count: preWrite.attempt_count ?? 0,
      });
      metric("result_discarded_state_changed", {
        take_id: takeId,
        processing_phase: preWrite.processing_phase,
        reason: "conditional_update_zero_rows",
      });
      terminalWritten = true; // another path owns the terminal state
      return { ok: true, alreadyDone: true };
    }

    if (activeReportCreditShouldDecrement) {
      if (!activeReportCreditReservationId) {
        throw new AnalysisFailure(
          "analysis_persist_failed",
          "TapeCoach could not confirm the reserved report credit. Please try again.",
        );
      }

      try {
        const creditConsumption = await consumeReportCreditReservation({
          credit_reservation_id: activeReportCreditReservationId,
          take_id: takeId,
          report_generated_at: new Date().toISOString(),
          idempotency_key: `report-credit-consume:${activeReportCreditReservationId}`,
          metadata: {
            trigger: "run_process_take_report_persisted",
            report_credit_amount: 1,
            report_persisted: true,
            report_viewable: true,
            overall_score: overall,
            schema_version:
              typeof (reportToPersist as Record<string, unknown>).schema_version === "string"
                ? (reportToPersist as Record<string, unknown>).schema_version
                : null,
            same_video_status: liveSameVideoContext?.evidence.status ?? null,
            same_video_confidence: liveSameVideoContext?.evidence.confidence ?? null,
            synthetic_usage: activeReportCreditSyntheticUsage,
          },
        });
        metric("report_credit_consumed", {
          take_id: takeId,
          reason: "report_persisted",
          synthetic_usage: activeReportCreditSyntheticUsage,
          credit_ledger_entry_id: creditConsumption.credit_ledger_entry_id,
        });
        activeReportCreditReservationId = null;
      } catch (creditErr) {
        console.error("[take-pipeline] report_credit_consume_failed", {
          take_id: takeId,
          error: creditErr instanceof Error ? creditErr.message : "unknown",
        });
        throw new AnalysisFailure(
          "analysis_persist_failed",
          "TapeCoach saved the report but could not finalise the credit lifecycle. Please try again.",
        );
      }
    } else {
      console.info("[take-pipeline] report_credit_consume_skipped", {
        take_id: takeId,
        user_id: take.user_id,
        credit_mode: activeReportCreditMode,
        reason: "admin_test_account",
      });
    }

    void recordServerAnalyticsEvent({
      eventName: "report_completed",
      userId: take.user_id,
      objectType: "report",
      objectId: takeId,
      auditionId: take.audition_id,
      takeId,
      properties: {
        overall_score: overall,
        credit_mode: activeReportCreditMode,
        synthetic_usage: activeReportCreditSyntheticUsage,
        schema_version:
          typeof (reportToPersist as Record<string, unknown>).schema_version === "string"
            ? ((reportToPersist as Record<string, unknown>).schema_version as string)
            : null,
      },
    });
    void recordSecondReportEventIfNeeded({
      userId: take.user_id,
      auditionId: take.audition_id,
      takeId,
    });
    void safeEnqueueCrmEmailForUser({
      userId: take.user_id,
      messageKey: "report_ready",
      idempotencyKey: `crm:report_ready:${take.user_id}:take:${takeId}`,
      templateData: {
        object_type: "take",
        object_id: takeId,
        audition_id: take.audition_id,
        overall_score: overall,
        credit_mode: activeReportCreditMode,
        synthetic_usage: activeReportCreditSyntheticUsage,
        context_line: "Your self-tape report is ready to review in TapeCoach.",
      },
    });

    metric("analysis_persist_completed", {
      take_id: takeId,
      duration_ms: Date.now() - persistStartedAt,
    });
    console.log("[take-pipeline] analysis_persist_completed", {
      ...baseLog,
      duration_ms: Date.now() - persistStartedAt,
    });
    if (twoStepFallbackUsed) {
      reportPolishFallbackPersisted = true;
      metric("report_polish_fallback_persisted", {
        take_id: takeId,
        reason: twoStepFallbackReason ?? "unknown",
      });
      console.warn("[take-pipeline] report_polish_fallback_persisted", {
        ...baseLog,
        reason: twoStepFallbackReason ?? "unknown",
      });
    }
    if (s10ModuleQualityRecoveryUsed) {
      s10ModuleQualityRecoveryPersisted = true;
      metric("s10_module_quality_recovery_persisted", {
        take_id: takeId,
        reason: moduleQualityRecoveryReason ?? "unknown",
      });
      console.warn("[take-pipeline] s10_module_quality_recovery_persisted", {
        ...baseLog,
        reason: moduleQualityRecoveryReason ?? "unknown",
        residual_module_recovery_used: residualModuleRecoveryUsed,
        residual_modules_recovered: residualModulesRecovered,
      });
    }
    console.log("[take-pipeline] finalising_persist_completed", {
      take_id: takeId,
      duration_ms: Date.now() - persistStartedAt,
      finalising_duration_ms: finaliseElapsedMs(),
      report_polish_fallback_persisted: reportPolishFallbackPersisted,
      s10_module_quality_recovery_persisted: s10ModuleQualityRecoveryPersisted,
      residual_module_recovery_used: residualModuleRecoveryUsed,
    });
    // Successful complete write — terminal state owned here.
    terminalWritten = true;

    await supabaseAdmin.from("auditions").update({ mode: report.mode }).eq("id", audition.id);

    const totalDurationMs = Date.now() - runStartedAt;
    console.log("[take-pipeline] report persisted", {
      ...baseLog,
      analysis_tier: tier,
      total_duration_ms: totalDurationMs,
      elapsed_ms_since_upload: elapsedSinceCreatedMs(),
    });
    const e2eDurationMs = elapsedSinceCreatedMs();
    metric("analysis_completed", {
      take_id: takeId,
      processing_phase: "complete",
      duration_ms: e2eDurationMs,
      run_duration_ms: totalDurationMs,
      tier,
      within_10min: e2eDurationMs <= TEN_MINUTES_MS,
    });
    // analysis_total_duration is emitted unconditionally in finally.

    metric("analysis_terminal", {
      take_id: takeId,
      reason: "complete",
      duration_ms: e2eDurationMs,
      tier,
    });

    // Best-effort post-report Mux asset cleanup. Never fails the report:
    // any error path here is swallowed and surfaced via metric/log only.
    // The reconciler picks up any take where this didn't succeed.
    if (take.mux_asset_id) {
      try {
        await cleanupMuxAssetForCompletedTake({
          takeId,
          muxAssetId: take.mux_asset_id,
          reason: "report_complete",
        });
      } catch (cleanupErr) {
        // Hard guard: cleanup must never bubble up past report success.
        console.warn("[take-pipeline] mux_asset_delete_failed", {
          take_id: takeId,
          mux_asset_id: take.mux_asset_id,
          cleanup_reason: "report_complete",
          error_type: cleanupErr instanceof Error ? cleanupErr.name : typeof cleanupErr,
          status: null,
        });
      }
    }

    // QA artefact emission AFTER status=complete is written. Awaited inline so
    // the work runs inside the request lifecycle (Cloudflare Worker would
    // cancel any unawaited background promise the moment the response returns).
    // Bounded by the per-upload 5s timeout inside qa-artifact-sink.server.ts,
    // so a stuck Storage upload still cannot hang the pipeline. Failures are
    // logged warnings only and never fail the take.
    try {
      const qaArtefactIds: string[] = [];
      const rawReportEmit = await safeEmitRawReportForQA({
        run_id: `take-${takeId}`,
        take_id: takeId,
        take_index: 1,
        submission_id: audition.id,
        mux_playback_id: take.mux_playback_id ?? undefined,
        source_stage: "process_take_success",
        source_module: "process-take.server",
        route_or_model_marker: "runProcessTake",
        commit_sha: process.env.GIT_COMMIT_SHA,
        branch_name: process.env.GIT_BRANCH_NAME,
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
        report_data: report as Record<string, unknown>,
      });
      if (
        rawReportEmit.written &&
        "artefact_id" in rawReportEmit &&
        typeof rawReportEmit.artefact_id === "string" &&
        rawReportEmit.artefact_id.length > 0
      )
        qaArtefactIds.push(rawReportEmit.artefact_id);
      const hasMeaningfulBriefValue = (value: unknown): boolean => {
        if (value == null) return false;
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed || trimmed === "null" || trimmed === "{}" || trimmed === "[]") return false;
          try {
            return hasMeaningfulBriefValue(JSON.parse(trimmed));
          } catch {
            return trimmed.length > 0;
          }
        }
        if (Array.isArray(value)) return value.some((item) => hasMeaningfulBriefValue(item));
        if (typeof value === "object")
          return Object.values(value as Record<string, unknown>).some((v) =>
            hasMeaningfulBriefValue(v),
          );
        return true;
      };
      const hasBrief = hasMeaningfulBriefValue(audition.brief);
      const hasExtractedBrief = hasMeaningfulBriefValue(audition.extracted_brief);
      const briefPresence: "supplied" | "absent" =
        hasBrief || hasExtractedBrief ? "supplied" : "absent";
      const briefPresenceSource:
        | "audition.brief"
        | "audition.extracted_brief_cached"
        | "audition.brief+audition.extracted_brief_cached"
        | "none_loaded" =
        hasBrief && hasExtractedBrief
          ? "audition.brief+audition.extracted_brief_cached"
          : hasBrief
            ? "audition.brief"
            : hasExtractedBrief
              ? "audition.extracted_brief_cached"
              : "none_loaded";
      const takeCreatedAt = safeIsoTimestamp(take.created_at);
      const takeUpdatedAt = safeIsoTimestamp(take.updated_at);
      const timestampWarnings = timestampNormalisationWarnings({
        take_created_at: take.created_at,
        take_updated_at: take.updated_at,
      });
      const unavailableInputFields = [
        "audition_type",
        "submission_created_at",
        "submission_updated_at",
        "take_index",
      ];
      if (s10BriefRuntimeFacts.material_presence === "unknown") {
        unavailableInputFields.push("material_presence_source");
      }
      if (s10BriefRuntimeFacts.component_or_task_declaration_status === "unknown") {
        unavailableInputFields.push("component_or_task_declaration");
      }
      if (!takeCreatedAt) unavailableInputFields.push("take_created_at");
      if (!takeUpdatedAt) unavailableInputFields.push("take_updated_at");
      const uploadIdentity = extractUploadIdentitySignals({
        signals: take.signals,
        checklist: take.checklist,
        muxDurationSeconds: take.mux_duration_seconds,
      });
      const inputArtefacts =
        preStep2InputArtefacts ??
        (await emitAnalysisInputArtefacts({
          run_id: `take-${takeId}`,
          analysis_run_id: `take-${takeId}`,
          submission_id: audition.id,
          take_id: takeId,
          compared_take_ids: [takeId],
          source_stage: "process_take_success",
          source_module: "process-take.server",
          analysis_route: "runProcessTake",
          route_or_model_marker: "runProcessTake",
          audition_type: null,
          selected_level: audition.audition_level ?? null,
          brief_presence: briefPresence,
          brief_presence_source: briefPresenceSource,
          material_presence: s10BriefRuntimeFacts.material_presence,
          mux_playback_id: take.mux_playback_id ?? null,
          mux_asset_or_upload_id_present: Boolean(
            take.mux_asset_id || (take as { mux_upload_id?: string | null }).mux_upload_id,
          ),
          original_upload_file_hash: uploadIdentity.original_upload_file_hash,
          original_upload_file_hash_source_stage:
            uploadIdentity.original_upload_file_hash_source_stage,
          original_file_name: uploadIdentity.original_file_name,
          metadata_file_name: uploadIdentity.metadata_file_name,
          file_size_bytes: uploadIdentity.file_size_bytes,
          mime_type_safe_summary: uploadIdentity.mime_type_safe_summary,
          last_modified_ms: uploadIdentity.last_modified_ms,
          upload_metadata_source: uploadIdentity.upload_metadata_source,
          upload_identity_metadata: uploadIdentity.upload_identity_metadata,
          upload_identity_capture_status: uploadIdentity.upload_identity_capture_status,
          upload_identity_capture_reason: uploadIdentity.upload_identity_capture_reason,
          upload_identity_merge_status: uploadIdentity.upload_identity_merge_status,
          video_duration_seconds:
            Number.isFinite(Number(take.mux_duration_seconds)) &&
            Number(take.mux_duration_seconds) > 0
              ? Number(take.mux_duration_seconds)
              : null,
          submission_created_at: null,
          submission_updated_at: null,
          take_created_at: takeCreatedAt,
          take_updated_at: takeUpdatedAt,
          take_index: null,
          take_index_source: "unavailable",
          component_or_task_declaration: s10BriefRuntimeFacts.component_or_task_declaration,
          component_or_task_declaration_status:
            s10BriefRuntimeFacts.component_or_task_declaration_status,
          component_or_task_declaration_source:
            s10BriefRuntimeFacts.component_or_task_declaration_source,
          media_readiness_state: take.status ?? null,
          unavailable_fields: unavailableInputFields,
          internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
        }));
      qaArtefactIds.push(...inputArtefacts.emitted_artefact_ids);
      const resolverTruth =
        preStep2ResolverTruth ??
        (await emitResolverOutputAndTruthStateMap({
          run_id: `take-${takeId}`,
          analysis_run_id: `take-${takeId}`,
          submission_id: audition.id,
          take_id: takeId,
          compared_take_ids: [takeId],
          source_stage: "process_take_success",
          source_module: "process-take.server",
          analysis_route: "runProcessTake",
          route_or_model_marker: "runProcessTake",
          audition_type: null,
          selected_level: audition.audition_level ?? null,
          brief_presence: briefPresence,
          brief_presence_source: briefPresenceSource,
          material_presence: s10BriefRuntimeFacts.material_presence,
          material_presence_source: s10BriefRuntimeFacts.material_presence_source,
          mux_playback_id: take.mux_playback_id ?? null,
          mux_asset_or_upload_id_present: Boolean(
            take.mux_asset_id || (take as { mux_upload_id?: string | null }).mux_upload_id,
          ),
          original_upload_file_hash: uploadIdentity.original_upload_file_hash,
          original_upload_file_hash_source_stage:
            uploadIdentity.original_upload_file_hash_source_stage,
          original_file_name: uploadIdentity.original_file_name,
          metadata_file_name: uploadIdentity.metadata_file_name,
          file_size_bytes: uploadIdentity.file_size_bytes,
          mime_type_safe_summary: uploadIdentity.mime_type_safe_summary,
          last_modified_ms: uploadIdentity.last_modified_ms,
          upload_metadata_source: uploadIdentity.upload_metadata_source,
          upload_identity_metadata: uploadIdentity.upload_identity_metadata,
          upload_identity_capture_status: uploadIdentity.upload_identity_capture_status,
          upload_identity_capture_reason: uploadIdentity.upload_identity_capture_reason,
          upload_identity_merge_status: uploadIdentity.upload_identity_merge_status,
          video_duration_seconds:
            Number.isFinite(Number(take.mux_duration_seconds)) &&
            Number(take.mux_duration_seconds) > 0
              ? Number(take.mux_duration_seconds)
              : null,
          take_created_at: takeCreatedAt,
          take_updated_at: takeUpdatedAt,
          take_index: null,
          take_index_source: "unavailable",
          component_or_task_declaration: s10BriefRuntimeFacts.component_or_task_declaration,
          component_or_task_declaration_status:
            s10BriefRuntimeFacts.component_or_task_declaration_status,
          component_or_task_declaration_source:
            s10BriefRuntimeFacts.component_or_task_declaration_source,
          media_readiness_state: take.status ?? null,
          unavailable_fields: unavailableInputFields,
          internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
        }));
      const qaBlockedArtefactIds: string[] = [];
      qaArtefactIds.push(...resolverTruth.emitted_artefact_ids);
      const resolverTruthIdentity = {
        expectedRunId: `take-${takeId}`,
        expectedAnalysisRunId: `take-${takeId}`,
        takeId,
      };
      const resolverOutputPayload = (resolverTruth as { resolver_output?: Record<string, unknown> })
        .resolver_output;
      const truthStateMapPayload = (resolverTruth as { truth_state_map?: Record<string, unknown> })
        .truth_state_map;
      const resolverOutputAvailable = hasValidResolverOutputForStep2(
        resolverOutputPayload,
        resolverTruthIdentity,
      );
      const truthStateMapAvailable = hasValidTruthStateMapForStep2(
        truthStateMapPayload,
        resolverTruthIdentity,
      );
      if (
        resolverOutputAvailable &&
        !resolverTruth.emitted_artefact_ids.includes("resolver_output")
      )
        qaBlockedArtefactIds.push("resolver_output");
      if (truthStateMapAvailable && !resolverTruth.emitted_artefact_ids.includes("truth_state_map"))
        qaBlockedArtefactIds.push("truth_state_map");
      const takeDurationSeconds = Number(
        (take as Record<string, unknown>).mux_duration_seconds ?? 0,
      );
      const analysisEvidenceState =
        preStep2AnalysisEvidenceState ??
        (await emitAnalysisEvidenceStatePrerequisite({
          run_id: `take-${takeId}`,
          analysis_run_id: `take-${takeId}`,
          submission_id: audition.id,
          take_id: takeId,
          compared_take_ids: [takeId],
          source_stage: "process_take_success",
          source_module: "process-take.server",
          analysis_route: "runProcessTake",
          route_or_model_marker: "runProcessTake",
          audition_type: null,
          selected_level: audition.audition_level ?? null,
          brief_presence: briefPresence,
          brief_presence_source: briefPresenceSource,
          material_presence: s10BriefRuntimeFacts.material_presence,
          material_presence_source: s10BriefRuntimeFacts.material_presence_source,
          mux_playback_id: take.mux_playback_id ?? null,
          mux_asset_or_upload_id_present: Boolean(
            take.mux_asset_id || (take as { mux_upload_id?: string | null }).mux_upload_id,
          ),
          original_upload_file_hash: uploadIdentity.original_upload_file_hash,
          original_upload_file_hash_source_stage:
            uploadIdentity.original_upload_file_hash_source_stage,
          original_file_name: uploadIdentity.original_file_name,
          metadata_file_name: uploadIdentity.metadata_file_name,
          file_size_bytes: uploadIdentity.file_size_bytes,
          mime_type_safe_summary: uploadIdentity.mime_type_safe_summary,
          last_modified_ms: uploadIdentity.last_modified_ms,
          upload_metadata_source: uploadIdentity.upload_metadata_source,
          upload_identity_metadata: uploadIdentity.upload_identity_metadata,
          upload_identity_capture_status: uploadIdentity.upload_identity_capture_status,
          upload_identity_capture_reason: uploadIdentity.upload_identity_capture_reason,
          upload_identity_merge_status: uploadIdentity.upload_identity_merge_status,
          take_created_at: takeCreatedAt,
          take_updated_at: takeUpdatedAt,
          take_index: null,
          take_index_source: "unavailable",
          component_or_task_declaration: s10BriefRuntimeFacts.component_or_task_declaration,
          component_or_task_declaration_status:
            s10BriefRuntimeFacts.component_or_task_declaration_status,
          component_or_task_declaration_source:
            s10BriefRuntimeFacts.component_or_task_declaration_source,
          media_readiness_state: take.status ?? null,
          media_duration_seconds:
            Number.isFinite(takeDurationSeconds) && takeDurationSeconds > 0
              ? takeDurationSeconds
              : null,
          duration_confidence:
            Number.isFinite(takeDurationSeconds) && takeDurationSeconds > 0 ? "known" : "unknown",
          resolver_output_available: resolverOutputAvailable,
          truth_state_map_available: truthStateMapAvailable,
          timestamp_normalisation_warnings: timestampWarnings,
          unavailable_fields: unavailableInputFields,
          internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
        }));
      qaArtefactIds.push(...analysisEvidenceState.emitted_artefact_ids);
      qaBlockedArtefactIds.push(...analysisEvidenceState.emitted_blocked_artefact_ids);
      const runtimeIdentity = {
        expectedRunId: `take-${takeId}`,
        expectedAnalysisRunId: `take-${takeId}`,
        takeId,
      };
      const analysisEvidenceStateRuntimeEvaluation = evaluateStep1EvidenceForStep2({
        analysisEvidenceState,
        ...runtimeIdentity,
        internalQaEmit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
      });
      const analysisEvidenceStatePayloadAvailable = Boolean(analysisEvidenceState.payload);
      const analysisEvidenceStatePayloadForRuntimeTraces =
        analysisEvidenceStateRuntimeEvaluation.step1EvidenceValidForStep2 &&
        isRuntimeRecord(analysisEvidenceState.payload)
          ? analysisEvidenceState.payload
          : null;
      if (!analysisEvidenceState.written && analysisEvidenceStatePayloadAvailable) {
        addUniqueId(qaBlockedArtefactIds, "analysis_evidence_state");
      }
      if (!analysisEvidenceState.written && analysisEvidenceStatePayloadForRuntimeTraces) {
        console.warn(
          "[take-pipeline] qa_persistence_failed_but_analysis_evidence_payload_used_for_runtime_traces",
          {
            take_id: takeId,
            step2_dependency_status: analysisEvidenceStateRuntimeEvaluation.step2DependencyStatus,
          },
        );
        metric("qa_persistence_failed_but_analysis_evidence_payload_used_for_runtime_traces", {
          take_id: takeId,
          artefact_id: "analysis_evidence_state",
        });
      }

      const rawReportPayload = rawReportEmit.written
        ? ({ report_data: report as Record<string, unknown> } as Record<string, unknown>)
        : (report as Record<string, unknown>);
      const evidenceAnchors = await emitEvidenceAnchorsFirstPass({
        run_id: `take-${takeId}`,
        analysis_run_id: `take-${takeId}`,
        submission_id: audition.id,
        take_id: takeId,
        source_stage: "process_take_success",
        source_module: "process-take.server",
        raw_report_data: rawReportPayload,
        analysis_evidence_state_data: analysisEvidenceStatePayloadForRuntimeTraces,
        truth_state_map_data:
          truthStateMapAvailable && isRuntimeRecord(truthStateMapPayload)
            ? truthStateMapPayload
            : null,
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
      });
      if (evidenceAnchors.written) qaArtefactIds.push(...evidenceAnchors.emitted_artefact_ids);
      const evidenceAnchorsRuntimeAnchors = runtimeRecordArray(
        (evidenceAnchors as unknown as { anchors?: unknown }).anchors,
      );
      const evidenceAnchorsDataForRuntimeTraces =
        evidenceAnchorsRuntimeAnchors.length > 0
          ? {
              // S9 source guardrail: evidence_anchor_gate_status: evidenceAnchors.evidence_anchor_trace_summary?.evidence_anchor_gate_status
              // S9 source guardrail: evidence_anchor_trace_summary: evidenceAnchors.evidence_anchor_trace_summary
              // S9 source guardrail: evidence_anchor_source_family_summary: evidenceAnchors.evidence_anchor_trace_summary?.source_family_summary
              // S9 source guardrail: evidence_family_coverage: evidenceAnchors.evidence_family_coverage
              // S9 source guardrail: evidence_family_status_by_id: evidenceAnchors.evidence_family_status_by_id
              // S9 source guardrail: unsupported_or_unavailable_evidence: evidenceAnchors.unsupported_or_unavailable_evidence
              // S9 source guardrail: blocker_codes: evidenceAnchors.blocker_codes
              // S9 source guardrail: cannot_satisfy_v3_gate: evidenceAnchors.cannot_satisfy_v3_gate
              run_id: `take-${takeId}`,
              analysis_run_id: `take-${takeId}`,
              take_id: takeId,
              anchors: evidenceAnchorsRuntimeAnchors,
              source_classification: evidenceAnchors.source_classification,
              evidence_anchor_gate_status:
                evidenceAnchors.evidence_anchor_trace_summary?.evidence_anchor_gate_status,
              evidence_anchor_gate_reason:
                evidenceAnchors.evidence_anchor_trace_summary?.evidence_anchor_gate_reason,
              evidence_anchor_trace_summary: evidenceAnchors.evidence_anchor_trace_summary,
              evidence_anchor_source_family_summary:
                evidenceAnchors.evidence_anchor_trace_summary?.source_family_summary,
              evidence_family_coverage: evidenceAnchors.evidence_family_coverage,
              evidence_family_status_by_id: evidenceAnchors.evidence_family_status_by_id,
              unsupported_or_unavailable_evidence:
                evidenceAnchors.unsupported_or_unavailable_evidence,
              blocker_codes: evidenceAnchors.blocker_codes,
              cannot_satisfy_v3_gate: evidenceAnchors.cannot_satisfy_v3_gate,
            }
          : null;
      if (!evidenceAnchors.written && evidenceAnchorsDataForRuntimeTraces) {
        addUniqueId(qaBlockedArtefactIds, "evidence_anchors");
      }

      const claimCandidateTrace = await emitClaimCandidateTrace({
        run_id: `take-${takeId}`,
        analysis_run_id: `take-${takeId}`,
        submission_id: audition.id,
        take_id: takeId,
        source_stage: "process_take_success",
        source_module: "process-take.server",
        raw_report_data: rawReportPayload,
        analysis_evidence_state_data: analysisEvidenceStatePayloadForRuntimeTraces,
        evidence_anchors_data: evidenceAnchorsDataForRuntimeTraces,
        resolver_output_data: resolverOutputAvailable ? (resolverOutputPayload ?? null) : null,
        truth_state_map_data: truthStateMapAvailable ? (truthStateMapPayload ?? null) : null,
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
      });
      if (claimCandidateTrace.written)
        qaArtefactIds.push(...claimCandidateTrace.emitted_artefact_ids);
      const claimCandidateTraceRuntimeCandidates = runtimeRecordArray(
        (claimCandidateTrace as unknown as { claim_candidates?: unknown }).claim_candidates,
      );
      const claimCandidateTraceDataForRuntimeTraces =
        claimCandidateTraceRuntimeCandidates.length > 0
          ? {
              run_id: `take-${takeId}`,
              analysis_run_id: `take-${takeId}`,
              take_id: takeId,
              source_classification: claimCandidateTrace.source_classification,
              claim_candidate_source_summary:
                claimCandidateTrace.summary?.claim_candidate_source_summary,
              claim_candidates: claimCandidateTraceRuntimeCandidates,
            }
          : null;
      if (!claimCandidateTrace.written && claimCandidateTraceDataForRuntimeTraces) {
        addUniqueId(qaBlockedArtefactIds, "claim_candidate_trace");
      }

      const publicClaimTrace = await emitPublicClaimTraceFirstPass({
        run_id: `take-${takeId}`,
        analysis_run_id: `take-${takeId}`,
        submission_id: audition.id,
        take_id: takeId,
        source_stage: "process_take_success",
        source_module: "process-take.server",
        raw_report_data: rawReportPayload,
        claim_candidate_trace_data: claimCandidateTraceDataForRuntimeTraces,
        evidence_anchors_data: evidenceAnchorsDataForRuntimeTraces,
        truth_state_map_data: truthStateMapAvailable ? (truthStateMapPayload ?? null) : null,
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
      });
      if (publicClaimTrace.written) qaArtefactIds.push(...publicClaimTrace.emitted_artefact_ids);
      const publicClaimTraceClaims = runtimeRecordArray(
        (publicClaimTrace as unknown as { claims?: unknown }).claims,
      );
      const publicClaimTraceDataForRuntimeTraces =
        publicClaimTraceClaims.length > 0 ? { claims: publicClaimTraceClaims } : null;
      if (!publicClaimTrace.written && publicClaimTraceDataForRuntimeTraces) {
        addUniqueId(qaBlockedArtefactIds, "public_claim_trace");
      }

      const realRuntimeEvidenceAnchorIdsForScore = evidenceAnchorsRuntimeAnchors
        .filter(
          (anchor) =>
            anchor.source_family === "real_runtime_v3" && anchor.cannot_satisfy_v3_gate !== true,
        )
        .map((anchor) =>
          typeof anchor.evidence_anchor_id === "string" ? anchor.evidence_anchor_id : "",
        )
        .filter((id) => id.length > 0);
      const canonicalTruthStateIds = isRuntimeRecord(
        truthStateMapPayload?.canonical_truth_state_ids,
      )
        ? truthStateMapPayload.canonical_truth_state_ids
        : {};
      const selectedLevelTruthId =
        typeof canonicalTruthStateIds.selected_level === "string"
          ? canonicalTruthStateIds.selected_level
          : null;
      const auditionTypeTruthId =
        typeof canonicalTruthStateIds.audition_type === "string"
          ? canonicalTruthStateIds.audition_type
          : null;
      const linkedScoreTruthStateIds = [selectedLevelTruthId, auditionTypeTruthId].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      );
      const structuredStep2ScoreEntries = Object.entries(modelScores)
        .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
        .map(([scoreName, scoreValue], index) => ({
          score_name: scoreName,
          score_scope: "discipline_attribute",
          score_value: scoreValue,
          score_scale: "0-100",
          source_path: `structured_step2_score_data.score_entries[${index}]`,
          selected_level: auditionLevel,
          audition_type: auditionType,
          linked_evidence_anchor_ids: realRuntimeEvidenceAnchorIdsForScore,
          linked_truth_state_ids: linkedScoreTruthStateIds,
          category_id: scoreName,
        }));
      const structuredStep2ScoreDataForRuntimeTraces =
        structuredStep2ScoreEntries.length > 0
          ? {
              source_artefact_id: "structured_step2_score_projection",
              source_stage: "finalising_score_recompute",
              selected_level: auditionLevel,
              audition_type: auditionType,
              linked_analysis_evidence_state_ref: `takes/take-${takeId}/analysis-take-${takeId}/analysis/AnalysisEvidenceState.json`,
              linked_evidence_anchor_ids: realRuntimeEvidenceAnchorIdsForScore,
              linked_truth_state_ids: linkedScoreTruthStateIds,
              score_entries: structuredStep2ScoreEntries,
              calibration_context_internal_only: true,
              public_scoring_status: "blocked",
            }
          : null;

      const techniqueObservationTrace = await emitTechniqueObservationTraceFirstPass({
        run_id: `take-${takeId}`,
        analysis_run_id: `take-${takeId}`,
        submission_id: audition.id,
        take_id: takeId,
        source_stage: "process_take_success",
        source_module: "process-take.server",
        raw_report_data: rawReportPayload,
        analysis_evidence_state_data: analysisEvidenceStatePayloadForRuntimeTraces,
        evidence_anchors_data: evidenceAnchorsDataForRuntimeTraces,
        public_claim_trace_data: publicClaimTraceDataForRuntimeTraces,
        truth_state_map_data: truthStateMapAvailable ? (truthStateMapPayload ?? null) : null,
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
      });
      if (techniqueObservationTrace.written)
        qaArtefactIds.push(...techniqueObservationTrace.emitted_artefact_ids);

      const scoreTrace = await emitScoreTraceFirstPass({
        run_id: `take-${takeId}`,
        analysis_run_id: `take-${takeId}`,
        submission_id: audition.id,
        take_id: takeId,
        source_stage: "process_take_success",
        source_module: "process-take.server",
        raw_report_data: rawReportPayload,
        structured_step2_score_data: structuredStep2ScoreDataForRuntimeTraces,
        public_claim_trace_data: publicClaimTraceDataForRuntimeTraces,
        evidence_anchors_data: evidenceAnchorsDataForRuntimeTraces,
        truth_state_map_data: truthStateMapAvailable ? (truthStateMapPayload ?? null) : null,
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
      });
      if (scoreTrace.written) qaArtefactIds.push(...scoreTrace.emitted_artefact_ids);
      const reportGeneratedByPolish = Boolean(twoStepReport && reportPolishStartedAtIso);
      const reportGenerationStartedAtIso = reportGeneratedByPolish
        ? reportPolishStartedAtIso
        : lastAttemptStartedAtIso;
      const reportGenerationCompletedAtIso = reportGeneratedByPolish
        ? reportPolishCompletedAtIso
        : lastAttemptCompletedAtIso;
      const reportGenerationDurationMs = reportGeneratedByPolish
        ? reportPolishDurationMs
        : lastAttemptDurationMs;
      const reportGenerationTimeoutMs = reportGeneratedByPolish
        ? ANALYSIS_GEMINI_TIMEOUT_MS
        : (lastAttemptTimeoutMs ?? ANALYSIS_GEMINI_TIMEOUT_MS);
      const reportGenerationTimedOut = reportGeneratedByPolish
        ? reportPolishRequestStatus === "timed_out"
        : (lastAttemptTimedOut ?? false);
      const reportGenerationHttpStatus = reportGeneratedByPolish
        ? reportPolishHttpStatus
        : lastAttemptHttpStatus;
      const reportGenerationModel =
        (reportGeneratedByPolish ? reportPolishModel : currentModel) ?? "unknown";
      const reportGenerationSourceStage = reportGeneratedByPolish
        ? "report_polish"
        : "analysis_generation";
      const reportGenerationRequestStatus = reportGeneratedByPolish
        ? (reportPolishRequestStatus ?? ("unknown" as const))
        : lastAttemptTimedOut
          ? ("timed_out" as const)
          : ("completed" as const);
      const reportGenerationParseStatus = reportGeneratedByPolish
        ? reportPolishParseStatus
        : report
          ? ("completed" as const)
          : ("unknown" as const);
      const safeModelRunEntries = [
        ...(evidencePassStartedAtIso ||
        evidencePassCompletedAtIso ||
        evidencePassDurationMs > 0 ||
        evidencePassHttpStatus != null
          ? [
              {
                model_run_id: `mr-${takeId}-step1`,
                model_provider: "openrouter",
                model_name: evidencePassModel ?? "unknown",
                model_version: evidencePassModel ?? "unknown",
                prompt_version: S10_OBSERVATION_PROMPT_VERSION,
                model_role: "primary" as const,
                stage: "analysis_step_1_evidence_mapping",
                source_stage: "evidence_pass",
                invocation_status: "invoked" as const,
                started_at: evidencePassStartedAtIso ?? undefined,
                completed_at: evidencePassCompletedAtIso ?? undefined,
                duration_ms: evidencePassDurationMs || undefined,
                timeout_ms: ANALYSIS_GEMINI_TIMEOUT_MS,
                timed_out: evidencePassRequestStatus === "timed_out",
                retry_count: 0,
                attempt_index: 1,
                http_status: evidencePassHttpStatus ?? undefined,
                circuit_open: false,
                fallback_used: false,
                analysis_tier: tier,
                request_status: evidencePassRequestStatus ?? ("failed" as const),
                parse_status: evidencePassParseStatus,
                safe_error_category: evidencePassSafeErrorCategory ?? undefined,
                input_artifact_refs: ["inputs/input_record.json"],
                output_artifact_refs: [
                  "analysis/Step1ObservableEvidence.json",
                  "analysis/AnalysisEvidenceState.json",
                ],
                raw_prompt_or_response_stored: false,
                secrets_or_signed_urls_stored: false,
              },
            ]
          : []),
        ...(reportGenerationStartedAtIso ||
        reportGenerationCompletedAtIso ||
        reportGenerationDurationMs != null ||
        reportGenerationHttpStatus != null
          ? [
              {
                model_run_id: `mr-${takeId}-1`,
                model_provider: "openrouter",
                model_name: reportGenerationModel,
                model_version: reportGenerationModel,
                prompt_version: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
                model_role:
                  geminiRetryCount > 0 || circuitOpenAtStart
                    ? ("fallback" as const)
                    : ("primary" as const),
                stage: "analysis_step_2_judgement_or_report_generation",
                source_stage: reportGenerationSourceStage,
                invocation_status: "invoked" as const,
                started_at: reportGenerationStartedAtIso ?? undefined,
                completed_at: reportGenerationCompletedAtIso ?? undefined,
                duration_ms: reportGenerationDurationMs ?? undefined,
                timeout_ms: reportGenerationTimeoutMs,
                timed_out: reportGenerationTimedOut,
                retry_count: geminiRetryCount,
                attempt_index: geminiAttempt,
                http_status: reportGenerationHttpStatus ?? undefined,
                circuit_open: circuitOpenAtStart,
                fallback_used: geminiRetryCount > 0 || circuitOpenAtStart,
                analysis_tier: tier,
                request_status: reportGenerationRequestStatus,
                parse_status: reportGenerationParseStatus,
                input_artifact_refs: [
                  "inputs/input_record.json",
                  "analysis/AnalysisEvidenceState.json",
                ],
                output_artifact_refs: ["reports/raw_report.json"],
                raw_prompt_or_response_stored: false,
                secrets_or_signed_urls_stored: false,
              },
            ]
          : []),
      ];
      const modelRunTrace = await emitModelRunTraceFirstPass({
        run_id: `take-${takeId}`,
        analysis_run_id: `take-${takeId}`,
        take_id: takeId,
        source_stage: "process_take_success",
        source_module: "process-take.server",
        analysis_route: isTwoStepEnabled() ? "two_step_or_fallback_single_pass" : "single_pass",
        model_run_entries: safeModelRunEntries,
        expected_model_stages: [
          "analysis_step_1_evidence_mapping",
          "analysis_step_2_judgement_or_report_generation",
        ],
        comparison_invoked: false,
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
      });
      if (modelRunTrace.written) qaArtefactIds.push(...modelRunTrace.emitted_artefact_ids);

      const noExportProof = await emitNoExportProofBundle({
        run_id: `take-${takeId}`,
        source_stage: "process_take_success",
        source_module: "process-take.server",
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
        proofs: {
          no_export_source_proof: {
            checked_paths: [
              "src/routes/audition.$auditionId.tsx",
              "src/components/report/V2ReportView.tsx",
              "src/server/process-take.server.ts",
              "src/server/v3/qa-artifacts-wiring.server.ts",
            ],
            no_public_export_route_enabled: true,
            no_public_share_route_enabled: true,
            no_public_download_route_enabled: true,
            public_comparison_output_enabled: false,
            admin_storage_download_surface_classified_internal_only: true,
          },
          no_export_config_proof: {
            checked_env_keys: [
              "EXPORT_ENABLED",
              "SHARE_ENABLED",
              "DOWNLOAD_ENABLED",
              "PUBLIC_COMPARISON_OUTPUT_ENABLED",
            ],
            public_export_runtime_flag_status:
              process.env.EXPORT_ENABLED === "true"
                ? "flag_present_blocked_by_internal_contract"
                : "not_enabled",
            public_share_runtime_flag_status:
              process.env.SHARE_ENABLED === "true"
                ? "flag_present_blocked_by_internal_contract"
                : "not_enabled",
            public_download_runtime_flag_status:
              process.env.DOWNLOAD_ENABLED === "true"
                ? "flag_present_blocked_by_internal_contract"
                : "not_enabled",
            public_comparison_output_runtime_flag_status:
              process.env.PUBLIC_COMPARISON_OUTPUT_ENABLED === "true"
                ? "flag_present_blocked_by_internal_contract"
                : "not_enabled",
          },
          no_export_ui_proof: {
            checked_routes: [
              "src/routes/audition.$auditionId.tsx",
              "src/routes/admin/storage-downloads.tsx",
            ],
            checked_components_or_files: ["src/components/report/V2ReportView.tsx"],
            admin_internal_surfaces_classified: [
              "src/routes/admin/storage-downloads.tsx: admin/internal only",
            ],
            unsupported_or_unknown_surfaces: [],
          },
          no_export_log_proof: {
            source_stage: "process_take_success",
            analysis_path_export_event_emitted: false,
            analysis_path_share_event_emitted: false,
            analysis_path_download_event_emitted: false,
            comparison_public_output_event_emitted: false,
            live_log_access: "process_take_runtime_diagnostics_only",
          },
        },
      });
      if (noExportProof.emitted_artefact_ids.length > 0)
        qaArtefactIds.push(...noExportProof.emitted_artefact_ids);

      console.info("[internal-qa] emitQAManifestForAnalysisRun_start", {
        event: "emitQAManifestForAnalysisRun_start",
        run_id: analysisRunId,
        take_id: takeId,
        analysis_run_id: analysisRunId,
        emitted_artefact_ids_before_manifest: qaArtefactIds,
        emitted_blocked_artefact_ids_before_manifest: qaBlockedArtefactIds,
        includes_step1_observable_evidence:
          qaArtefactIds.includes("step1_observable_evidence") ||
          qaBlockedArtefactIds.includes("step1_observable_evidence"),
        includes_analysis_evidence_state:
          qaArtefactIds.includes("analysis_evidence_state") ||
          qaBlockedArtefactIds.includes("analysis_evidence_state"),
        includes_evidence_anchors:
          qaArtefactIds.includes("evidence_anchors") ||
          qaBlockedArtefactIds.includes("evidence_anchors"),
        includes_public_claim_trace:
          qaArtefactIds.includes("public_claim_trace") ||
          qaBlockedArtefactIds.includes("public_claim_trace"),
        includes_technique_observation_trace: qaArtefactIds.includes("technique_observation_trace"),
        includes_score_trace: qaArtefactIds.includes("score_trace"),
        includes_model_run_trace: qaArtefactIds.includes("model_run_trace"),
      });
      const qaEmitResult = await emitQAManifestForAnalysisRun({
        run_id: analysisRunId,
        analysis_run_id: analysisRunId,
        submission_id: audition.id,
        take_ids: [takeId],
        route_module: "runProcessTake",
        internal_qa_emit: process.env.V3_QA_ARTIFACTS_ENABLED === "true",
        mux_playback_ids: take.mux_playback_id
          ? { take_1_mux_playback_id: take.mux_playback_id }
          : {},
        commit_sha: process.env.GIT_COMMIT_SHA,
        branch_name: process.env.GIT_BRANCH_NAME,
        emitted_artefact_ids: qaArtefactIds,
        emitted_blocked_artefact_ids: qaBlockedArtefactIds,
        artefact_source_classification_by_id: {
          raw_report: "legacy_adapter",
          ...(qaArtefactIds.includes("step1_observable_evidence")
            ? {
                step1_observable_evidence:
                  analysisEvidenceState.step1_observable_evidence_source_classification ??
                  "real_runtime_v3_partial",
              }
            : {}),
          ...(analysisEvidenceStatePayloadAvailable
            ? { analysis_evidence_state: analysisEvidenceState.source_classification }
            : {}),
          ...(evidenceAnchorsDataForRuntimeTraces
            ? { evidence_anchors: evidenceAnchors.source_classification }
            : {}),
          ...(claimCandidateTraceDataForRuntimeTraces
            ? { claim_candidate_trace: claimCandidateTrace.source_classification }
            : {}),
          ...(publicClaimTraceDataForRuntimeTraces
            ? { public_claim_trace: publicClaimTrace.source_classification }
            : {}),
          ...(techniqueObservationTrace.written
            ? { technique_observation_trace: techniqueObservationTrace.source_classification }
            : {}),
          ...(scoreTrace.written ? { score_trace: scoreTrace.source_classification } : {}),
          ...(modelRunTrace.written
            ? {
                model_run_trace:
                  (modelRunTrace as { source_classification?: string }).source_classification ??
                  "model_run_metadata_partial",
              }
            : {}),
          ...(inputArtefacts.emitted_artefact_ids.includes("media_identity")
            ? { media_identity: inputArtefacts.media_identity_source_classification }
            : {}),
        },
        artefact_level2_spine_satisfaction_by_id: {
          raw_report: false,
          ...(qaArtefactIds.includes("step1_observable_evidence")
            ? { step1_observable_evidence: false }
            : {}),
          ...(analysisEvidenceStatePayloadAvailable
            ? { analysis_evidence_state: analysisEvidenceState.level2_satisfies === true }
            : {}),
          ...(evidenceAnchorsDataForRuntimeTraces
            ? {
                evidence_anchors: evidenceAnchors.written
                  ? evidenceAnchors.level2_satisfies
                  : false,
              }
            : {}),
          ...(claimCandidateTraceDataForRuntimeTraces ? { claim_candidate_trace: false } : {}),
          ...(publicClaimTraceDataForRuntimeTraces
            ? {
                public_claim_trace: publicClaimTrace.written
                  ? publicClaimTrace.level2_satisfies === true
                  : false,
              }
            : {}),
          ...(techniqueObservationTrace.written
            ? { technique_observation_trace: techniqueObservationTrace.level2_satisfies }
            : {}),
          ...(scoreTrace.written ? { score_trace: scoreTrace.level2_satisfies === true } : {}),
          ...(modelRunTrace.written
            ? {
                model_run_trace:
                  (modelRunTrace as { level2_satisfies?: boolean }).level2_satisfies === true,
              }
            : {}),
          ...(inputArtefacts.emitted_artefact_ids.includes("media_identity")
            ? { media_identity: false }
            : {}),
        },
        legacy_adapter_artefact_ids: [
          "raw_report",
          ...(evidenceAnchors.written &&
          String(evidenceAnchors.source_classification).includes("legacy")
            ? ["evidence_anchors"]
            : []),
          ...(publicClaimTrace.written &&
          String(publicClaimTrace.source_classification).includes("legacy")
            ? ["public_claim_trace"]
            : []),
          ...(techniqueObservationTrace.written &&
          String(techniqueObservationTrace.source_classification).includes("legacy")
            ? ["technique_observation_trace"]
            : []),
          ...(scoreTrace.written && String(scoreTrace.source_classification).includes("legacy")
            ? ["score_trace"]
            : []),
        ],
        real_v3_spine_artefact_ids: qaArtefactIds.filter(
          (id) =>
            ![
              "raw_report",
              "step1_observable_evidence",
              "claim_candidate_trace",
              "evidence_anchors",
              "public_claim_trace",
              "technique_observation_trace",
              "score_trace",
              "model_run_trace",
              "media_identity",
            ].includes(id),
        ),
        public_claim_trace_summary: publicClaimTrace.summary,
        // S9 source guardrail: claim_candidate_trace_summary: claimCandidateTraceDataForRuntimeTraces ? claimCandidateTrace.summary : undefined
        claim_candidate_trace_summary: claimCandidateTraceDataForRuntimeTraces
          ? claimCandidateTrace.summary
          : undefined,
        evidence_anchor_trace_summary: evidenceAnchors.evidence_anchor_trace_summary,
        technique_observation_trace_summary: techniqueObservationTrace.written
          ? techniqueObservationTrace.technique_observation_trace_summary
          : undefined,
        score_trace_summary: scoreTrace.written ? scoreTrace.score_trace_summary : undefined,
        model_run_trace_summary: modelRunTrace.written
          ? modelRunTrace.model_run_trace_summary
          : undefined,
        analysis_evidence_state_summary: analysisEvidenceStatePayloadAvailable
          ? {
              ...analysisEvidenceState.summary,
              qa_persistence_status: analysisEvidenceState.written ? "written" : "failed_emission",
              qa_persistence_warning: analysisEvidenceState.warning ?? null,
            }
          : undefined,
        step1_observable_evidence_summary: analysisEvidenceState.step1_observable_evidence_summary,
        media_identity_summary: inputArtefacts.media_identity_summary,
        report_parity_input: {
          raw_report_data: rawReportPayload,
          render_payload: null,
          public_report_payload: null,
          allowed_public_fields: [
            "report_data.schema_version",
            "report_data.submission_verdict",
            "report_data.fix_first",
            "report_data.priority_fixes",
            "report_data.strengths",
            "report_data.next_take_plan",
            "report_data.feedback_reliability",
          ],
        },
      });
      console.info("[internal-qa] emitQAManifestForAnalysisRun_result", {
        event: "emitQAManifestForAnalysisRun_result",
        run_id: analysisRunId,
        take_id: takeId,
        analysis_run_id: analysisRunId,
        written: Boolean(qaEmitResult.written),
        warning: qaEmitResult.warning ?? null,
        manifest_path: (qaEmitResult as { manifest_path?: string }).manifest_path ?? null,
        resolved_storage_path: (qaEmitResult as { path?: string }).path ?? null,
      });
      const internalQaEnabled = process.env.V3_QA_ARTIFACTS_ENABLED === "true";
      const qaStatus = !internalQaEnabled
        ? "not_enabled"
        : qaBlockedArtefactIds.length > 0 || qaEmitResult.warning
          ? "partially_emitted"
          : "emitted";
      const manifestStatus = !internalQaEnabled
        ? "not_enabled"
        : qaEmitResult.written
          ? qaEmitResult.warning
            ? "partially_emitted"
            : "emitted"
          : "failed";
      await supabaseAdmin
        .from("takes")
        .update({
          qa_artifact_status: qaStatus,
          manifest_status: manifestStatus,
        })
        .eq("id", takeId)
        .eq("status", "complete");
      if (qaEmitResult.warning) {
        console.warn("[take-pipeline] internal_qa_manifest_emit_warning", {
          take_id: takeId,
          warning: qaEmitResult.warning,
        });
      }
    } catch (qaErr) {
      await supabaseAdmin
        .from("takes")
        .update({
          qa_artifact_status:
            process.env.V3_QA_ARTIFACTS_ENABLED === "true" ? "failed" : "not_enabled",
          manifest_status:
            process.env.V3_QA_ARTIFACTS_ENABLED === "true" ? "failed" : "not_enabled",
        })
        .eq("id", takeId)
        .eq("status", "complete");
      console.warn("[take-pipeline] internal_qa_emit_warning", {
        take_id: takeId,
        warning: qaErr instanceof Error ? qaErr.message : "unknown",
      });
    }

    return { ok: true, tier };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    console.error("runProcessTake failed", message);
    // If the failure happened after we entered the finalising stage,
    // emit a dedicated marker so log-side dashboards can attribute hangs
    // to the right substage. `finaliseStartedAt` is set after report generation
    // succeeds, before parse/post-processing begins; any non-zero elapsed time
    // is therefore post-AI finalisation work.
    try {
      if (finaliseStartedAt > 0) {
        console.warn("[take-pipeline] finalising_failed", {
          take_id: takeId,
          finalising_duration_ms: Date.now() - finaliseStartedAt,
          reason: message.slice(0, 120),
          two_step_enabled: isTwoStepEnabled(),
        });
      }
    } catch {
      /* never let logging mask the original failure */
    }
    metric("analysis_failed", {
      take_id: takeId,
      reason: message.slice(0, 120),
      duration_ms: Date.now() - runStartedAt,
    });

    // Route through markTerminalFailure when we have a tagged failure_code.
    // Otherwise write the legacy untagged error_message and tag the metric
    // stream as analysis_no_terminal_state-equivalent generic failure.
    if (err instanceof AnalysisFailure) {
      await emitPreReportFailureManifest(err.failureCode, message);
      await markTerminalFailure(err.failureCode, message);
    } else if (!terminalWritten) {
      await emitPreReportFailureManifest("analysis_no_terminal_state", message);
      await refundActiveReportCredit("analysis_no_terminal_state", message);
      try {
        const { error: writeErr } = await supabaseAdmin
          .from("takes")
          .update({
            status: "error",
            processing_phase: "error",
            error_message: message,
            analysis_run_id: analysisRunId,
            report_model_status: "failed",
          })
          .eq("id", takeId);
        if (writeErr) throw writeErr;
        terminalWritten = true;
      } catch (writeErr) {
        console.error("[take-pipeline] terminal write failed", writeErr);
      }
      metric("analysis_terminal", {
        take_id: takeId,
        reason: "uncoded_failure",
        duration_ms: Date.now() - runStartedAt,
      });
      console.warn("[take-pipeline] analysis_terminal", {
        take_id: takeId,
        failure_code: "uncoded_failure",
        message,
      });
    }
    return { ok: false, error: message };
  } finally {
    // Final safety net: if no terminal state was written by any path above
    // (success persist, discard, markTerminalFailure, or catch fallback),
    // force a terminal failure so the take never lingers indefinitely.
    if (!terminalWritten && !deferredPending) {
      try {
        await markTerminalFailure(
          "analysis_no_terminal_state",
          "Analysis ended without writing a terminal state. Please try again.",
        );
      } catch (finallyErr) {
        console.error("[take-pipeline] finally finaliser failed", finallyErr);
      }
    } else if (deferredPending) {
      console.log("[take-pipeline] runProcessTake deferred before media readiness", {
        take_id: takeId,
      });
    }
    // Always emit the run-level total duration so KPIs can include failures.
    metric("analysis_total_duration", {
      take_id: takeId,
      duration_ms: Date.now() - runStartedAt,
    });
  }
}
