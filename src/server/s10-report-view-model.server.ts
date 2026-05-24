// SERVER-ONLY. S10.10 authenticated performer report view-model builder.
//
// This is route-surface sanitisation, not public/private payload gating. The
// authenticated report keeps useful S10 brief, score, technique and timestamp
// detail while removing raw prompts, raw model internals and diagnostic traces.

import type {
  BriefAchievementMatrix,
  BriefContext,
  BriefRequirement,
  ReadinessAndScoreJudgement,
  S10FixHierarchy,
  S10NextActionPlan,
  S10ProfessionalCritique,
  S10ComparisonDisplayMode,
  S10ComparisonTruth,
  S10SameVideoEvidence,
  S10TechniqueCommentary,
  S10TimestampedCommentary,
} from "@/lib/audition-rules";
import type {
  ComponentVerification,
  MediaObservationSummary,
  ObservedTapeSequence,
} from "./evidence-pass.server";
import type { S10ObservationContextSourceKind } from "./s10-observation-context.server";

export type S10SectionSource =
  | "s10_authoritative_module"
  | "s10_compatibility_projection"
  | "specific_limitation"
  | "legacy_diagnostic_fallback"
  | "unsupported";

export type S10ReportSectionKey =
  | "readiness_header"
  | "submission_guidance"
  | "score_summary"
  | "category_scores"
  | "category_rationale"
  | "brief_adherence_material_compliance"
  | "brief_context"
  | "brief_requirements"
  | "brief_achievement"
  | "observed_tape"
  | "component_breakdown"
  | "fix_hierarchy"
  | "next_action_plan"
  | "strengths_and_preserve"
  | "professional_critique"
  | "technique_commentary"
  | "timestamped_commentary"
  | "limitations"
  | "same_video_status"
  | "comparison_truth"
  | "diagnostic_chips";

export type S10SectionSourceEntry = {
  source: S10SectionSource;
  module: string | null;
  limitation: string | null;
  source_kind?: S10ObservationContextSourceKind | null;
};

export type S10PerformerReportViewModel = {
  report_version: "s10_performer_report_view_model_v1";
  source_mode: "s10_ai_report_model";
  section_source_map: Record<S10ReportSectionKey, S10SectionSourceEntry>;
  recommendation: {
    decision: ReadinessAndScoreJudgement["decision"];
    headline: string;
    rationale: string[];
    score_explanation: string;
    confidence: ReadinessAndScoreJudgement["confidence"];
  } | null;
  score_summary: {
    overall_submission_readiness_score: number | null;
    performance_quality_score: number | null;
    brief_completion_score: number | null;
    score_band_label: string | null;
    category_scores: ReadinessAndScoreJudgement["category_scores"];
    component_scores: ReadinessAndScoreJudgement["component_scores"];
  };
  brief_context: BriefContext | null;
  brief_requirements: BriefRequirement[];
  brief_achievement_matrix: BriefAchievementMatrix | null;
  observed_tape: {
    observed_tape_sequence: ObservedTapeSequence[];
    component_verifications: ComponentVerification[];
    media_observation_summary: MediaObservationSummary | null;
  };
  component_breakdown: ComponentVerification[];
  fix_hierarchy: S10FixHierarchy | null;
  next_action_plan: S10NextActionPlan | null;
  strengths_and_preserve: {
    summary: string | null;
    strengths: unknown[];
    preserve: unknown[];
    do_not_overfix: unknown[];
    limitations: string[];
  };
  professional_critique: S10ProfessionalCritique | null;
  technique_commentary: S10TechniqueCommentary | null;
  timestamped_commentary: S10TimestampedCommentary | null;
  limitations: string[];
  same_video_status: S10SameVideoEvidence | null;
  comparison_truth: S10ComparisonTruth | null;
  comparison_summary: string | null;
  comparison_limitations: string[];
  comparison_display_mode: S10ComparisonDisplayMode;
  diagnostic_chips: unknown[];
};

export type S10ViewModelContext = {
  briefContext?: BriefContext | null;
  briefRequirements?: BriefRequirement[] | null;
  observedTapeSequence?: ObservedTapeSequence[] | null;
  componentVerifications?: ComponentVerification[] | null;
  mediaObservationSummary?: MediaObservationSummary | null;
  sameVideoEvidence?: S10SameVideoEvidence | null;
  comparisonTruth?: S10ComparisonTruth | null;
  comparisonDisplayMode?: S10ComparisonDisplayMode | null;
  observationSourceKind?: S10ObservationContextSourceKind | null;
};

const INTERNAL_KEYS = new Set([
  "raw_report",
  "raw_model_response",
  "raw_prompt",
  "prompt",
  "prompts",
  "system_prompt",
  "model_response",
  "qa_trace",
  "gate_trace",
  "validator_trace",
  "trace",
  "traces",
  "score_trace",
  "technique_observation_trace",
  "contradiction_warnings",
  "action_contradiction_warnings",
  "score_contradiction_warnings",
  "internal_only",
  "privacy_classification",
  "source_authority",
  "note_source_authority",
  "legacy_source_used",
  "legacy_source_path",
  "value_hash",
  "is_legacy_timestamp_projection",
  "is_projection_safe",
  "projection_block_reason",
  "evidence_signals",
  "compared_take_ids",
  "current_take_id",
  "matching_take_ids",
  "compared_take_summaries",
  "take_id",
  "audition_id",
  "submission_id",
  "run_id",
  "analysis_run_id",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneForRouteSurface<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneForRouteSurface(item)) as T;
  }
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (INTERNAL_KEYS.has(key)) continue;
    if (/^(qa|gate|validator|provenance|artefact|artifact)_/i.test(key)) continue;
    out[key] = cloneForRouteSurface(item);
  }
  return out as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (cloneForRouteSurface(value) as T[]) : [];
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function source(available: boolean, module: string, limitation: string): S10SectionSourceEntry {
  return available
    ? { source: "s10_authoritative_module", module, limitation: null }
    : { source: "specific_limitation", module, limitation };
}

function observationSource(
  available: boolean,
  module: string,
  limitation: string,
  sourceKind?: S10ObservationContextSourceKind | null,
): S10SectionSourceEntry {
  return available
    ? {
        source: "s10_authoritative_module",
        module,
        limitation: null,
        source_kind: sourceKind ?? "report_embedded_s10_observation",
      }
    : {
        source: "specific_limitation",
        module,
        limitation,
        source_kind: "unavailable",
      };
}

function comparisonDisplayModeFor(
  comparisonTruth: S10ComparisonTruth | null,
): S10ComparisonDisplayMode {
  switch (comparisonTruth?.comparison_mode) {
    case "same_video_duplicate":
      return "same_video_notice";
    case "same_video_retest":
    case "same_video_changed_context":
      return "contextual_comparison";
    case "uncertain":
      return "comparison_caution";
    case "distinct_takes":
    case "single_take":
    default:
      return "hidden";
  }
}

export function hasS10AuthoritativeModules(report: unknown): boolean {
  const r = asRecord(report);
  if (!r) return false;
  return [
    "brief_achievement_matrix",
    "readiness_score_judgement",
    "s10_fix_hierarchy",
    "s10_next_action_plan",
    "s10_professional_critique",
    "s10_technique_commentary",
    "s10_timestamped_commentary",
  ].some((key) => isRecord(r[key]));
}

export function buildS10PerformerReportViewModel(input: {
  report: Record<string, unknown> | null | undefined;
  context?: S10ViewModelContext | null;
}): S10PerformerReportViewModel | null {
  const report = asRecord(input.report);
  if (!report || !hasS10AuthoritativeModules(report)) return null;

  const readiness = cloneForRouteSurface(
    report.readiness_score_judgement,
  ) as ReadinessAndScoreJudgement | null;
  const matrix = cloneForRouteSurface(
    report.brief_achievement_matrix,
  ) as BriefAchievementMatrix | null;
  const fixHierarchy = cloneForRouteSurface(report.s10_fix_hierarchy) as S10FixHierarchy | null;
  const nextActionPlan = cloneForRouteSurface(
    report.s10_next_action_plan,
  ) as S10NextActionPlan | null;
  const professionalCritique = cloneForRouteSurface(
    report.s10_professional_critique,
  ) as S10ProfessionalCritique | null;
  const techniqueCommentary = cloneForRouteSurface(
    report.s10_technique_commentary,
  ) as S10TechniqueCommentary | null;
  const timestampedCommentary = cloneForRouteSurface(
    report.s10_timestamped_commentary,
  ) as S10TimestampedCommentary | null;
  const sameVideoEvidence = cloneForRouteSurface(
    input.context?.sameVideoEvidence ??
      report.s10_same_video_evidence ??
      report.same_video_status ??
      null,
  ) as S10SameVideoEvidence | null;
  const comparisonTruth = cloneForRouteSurface(
    input.context?.comparisonTruth ??
      report.s10_comparison_truth ??
      report.comparison_truth ??
      null,
  ) as S10ComparisonTruth | null;
  const comparisonDisplayMode =
    input.context?.comparisonDisplayMode ??
    (typeof report.comparison_display_mode === "string"
      ? (report.comparison_display_mode as S10ComparisonDisplayMode)
      : null) ??
    comparisonDisplayModeFor(comparisonTruth);

  const context = input.context ?? {};
  const observationSourceKind = context.observationSourceKind ?? "report_embedded_s10_observation";
  const briefContext = cloneForRouteSurface(
    context.briefContext ?? report.brief_context ?? null,
  ) as BriefContext | null;
  const briefRequirements = asArray<BriefRequirement>(
    context.briefRequirements ?? report.brief_requirements,
  );
  const observedTapeSequence = asArray<ObservedTapeSequence>(
    context.observedTapeSequence ?? report.observed_tape_sequence,
  );
  const componentVerifications = asArray<ComponentVerification>(
    context.componentVerifications ?? report.component_verifications,
  );
  const mediaObservationSummary = cloneForRouteSurface(
    context.mediaObservationSummary ?? report.media_observation_summary ?? null,
  ) as MediaObservationSummary | null;

  const limitations = [
    ...(matrix ? [] : ["Brief achievement details are not available for this report."]),
    ...(readiness ? [] : ["Readiness judgement is not available for this report."]),
    ...(componentVerifications.length > 0
      ? []
      : ["Observed component verification is not available for this report."]),
    ...(fixHierarchy ? [] : ["Fix hierarchy is not available for this report."]),
    ...(techniqueCommentary ? [] : ["Technique commentary is not available for this report."]),
    ...(timestampedCommentary
      ? []
      : ["Timestamped or time-banded commentary is not available for this report."]),
  ];

  const section_source_map: S10PerformerReportViewModel["section_source_map"] = {
    readiness_header: source(!!readiness, "readiness_score_judgement", limitations[1] ?? ""),
    submission_guidance: source(
      !!readiness,
      "readiness_score_judgement",
      "Submission guidance is not available for this report.",
    ),
    score_summary: source(
      !!readiness,
      "readiness_score_judgement",
      "S10 score semantics are not available for this report.",
    ),
    category_scores: source(
      (readiness?.category_scores?.length ?? 0) > 0,
      "readiness_score_judgement.category_scores",
      "S10 category score semantics are not available for this report.",
    ),
    category_rationale: source(
      Object.keys(readiness?.category_rationale ?? {}).length > 0,
      "readiness_score_judgement.category_rationale",
      "S10 category rationale is not available for this report.",
    ),
    brief_adherence_material_compliance: source(
      typeof readiness?.brief_completion_score === "number",
      "readiness_score_judgement.brief_completion_score",
      "S10 brief-completion score is not available for this report.",
    ),
    brief_context: source(
      !!briefContext,
      "brief_context",
      "Brief context is not available for this report.",
    ),
    brief_requirements: source(
      briefRequirements.length > 0,
      "brief_requirements",
      "Brief requirements are not available for this report.",
    ),
    brief_achievement: source(
      !!matrix,
      "brief_achievement_matrix",
      "Brief achievement matrix is not available for this report.",
    ),
    observed_tape: source(
      observedTapeSequence.length > 0 || componentVerifications.length > 0,
      "observed_tape_sequence/component_verifications",
      "Observed tape sequence is not available for this report.",
    ),
    component_breakdown: observationSource(
      componentVerifications.length > 0,
      "component_verifications",
      "Component verification was unavailable for this S10 report.",
      observationSourceKind,
    ),
    fix_hierarchy: source(
      !!fixHierarchy,
      "s10_fix_hierarchy",
      "Fix hierarchy is not available for this report.",
    ),
    next_action_plan: source(
      !!nextActionPlan,
      "s10_next_action_plan",
      "Next action plan is not available for this report.",
    ),
    strengths_and_preserve: source(
      !!professionalCritique,
      "s10_professional_critique",
      "Strengths and preserve guidance are not available for this report.",
    ),
    professional_critique: source(
      !!professionalCritique,
      "s10_professional_critique",
      "Professional critique is not available for this report.",
    ),
    technique_commentary: source(
      !!techniqueCommentary,
      "s10_technique_commentary",
      "Technique commentary is not available for this report.",
    ),
    timestamped_commentary: source(
      !!timestampedCommentary,
      "s10_timestamped_commentary",
      "Timestamped commentary is not available for this report.",
    ),
    limitations: { source: "s10_authoritative_module", module: "s10_view_model", limitation: null },
    same_video_status: {
      source: sameVideoEvidence ? "s10_authoritative_module" : "unsupported",
      module: sameVideoEvidence ? "s10_same_video_evidence" : null,
      limitation: sameVideoEvidence
        ? null
        : "Same-video status is not available in this report model.",
    },
    comparison_truth: {
      source: comparisonTruth ? "s10_authoritative_module" : "unsupported",
      module: comparisonTruth ? "s10_comparison_truth" : null,
      limitation: comparisonTruth
        ? null
        : "Comparison truth is not available or not relevant for this report.",
    },
    diagnostic_chips: {
      source: "unsupported",
      module: null,
      limitation: "No diagnostic chips are rendered in this performer report.",
    },
  };

  return {
    report_version: "s10_performer_report_view_model_v1",
    source_mode: "s10_ai_report_model",
    section_source_map,
    recommendation: readiness
      ? {
          decision: readiness.decision,
          headline: readiness.headline,
          rationale: Array.isArray(readiness.rationale) ? readiness.rationale : [],
          score_explanation: readiness.score_explanation,
          confidence: readiness.confidence,
        }
      : null,
    score_summary: {
      overall_submission_readiness_score:
        asNumber(
          (readiness as Record<string, unknown> | null)?.overall_submission_readiness_score,
        ) ?? null,
      performance_quality_score:
        asNumber((readiness as Record<string, unknown> | null)?.performance_quality_score) ?? null,
      brief_completion_score:
        asNumber((readiness as Record<string, unknown> | null)?.brief_completion_score) ?? null,
      score_band_label: asText((readiness as Record<string, unknown> | null)?.score_band_label),
      category_scores: readiness?.category_scores ?? [],
      component_scores: readiness?.component_scores ?? [],
    },
    brief_context: briefContext,
    brief_requirements: briefRequirements,
    brief_achievement_matrix: matrix,
    observed_tape: {
      observed_tape_sequence: observedTapeSequence,
      component_verifications: componentVerifications,
      media_observation_summary: mediaObservationSummary,
    },
    component_breakdown: componentVerifications,
    fix_hierarchy: fixHierarchy,
    next_action_plan: nextActionPlan,
    strengths_and_preserve: {
      summary: professionalCritique?.summary ?? null,
      strengths: [
        ...(professionalCritique?.performance_strengths ?? []),
        ...(professionalCritique?.brief_package_strengths ?? []),
        ...(professionalCritique?.technical_presentation_strengths ?? []),
        ...(professionalCritique?.vocal_or_singing_strengths ?? []),
        ...(professionalCritique?.acting_strengths ?? []),
        ...(professionalCritique?.movement_or_physical_strengths ?? []),
        ...(professionalCritique?.professional_presentation_notes ?? []),
      ],
      preserve: professionalCritique?.preserve ?? [],
      do_not_overfix: professionalCritique?.do_not_overfix ?? [],
      limitations: professionalCritique?.critique_limitations ?? [],
    },
    professional_critique: professionalCritique,
    technique_commentary: techniqueCommentary,
    timestamped_commentary: timestampedCommentary,
    limitations,
    same_video_status: sameVideoEvidence,
    comparison_truth: comparisonTruth,
    comparison_summary:
      comparisonTruth?.performer_facing_summary ??
      sameVideoEvidence?.performer_facing_summary ??
      null,
    comparison_limitations: [
      ...(comparisonTruth?.limitations ?? []),
      ...(sameVideoEvidence?.limitations ?? []),
    ].filter((value, index, array) => value && array.indexOf(value) === index),
    comparison_display_mode: comparisonDisplayMode,
    diagnostic_chips: [],
  };
}

export function validateAuthenticatedS10RouteSurface(viewModel: unknown):
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    } {
  const view = asRecord(viewModel);
  if (!view) return { ok: false, reason: "s10_view_model_not_object" };
  if (view.report_version !== "s10_performer_report_view_model_v1") {
    return { ok: false, reason: "s10_view_model_wrong_version" };
  }
  if (view.source_mode !== "s10_ai_report_model") {
    return { ok: false, reason: "s10_view_model_wrong_source_mode" };
  }
  const sourceMap = asRecord(view.section_source_map);
  if (!sourceMap) return { ok: false, reason: "missing_section_source_map" };
  const requiredSections: S10ReportSectionKey[] = [
    "readiness_header",
    "submission_guidance",
    "score_summary",
    "category_scores",
    "category_rationale",
    "brief_adherence_material_compliance",
    "brief_context",
    "brief_requirements",
    "brief_achievement",
    "observed_tape",
    "component_breakdown",
    "fix_hierarchy",
    "next_action_plan",
    "strengths_and_preserve",
    "professional_critique",
    "technique_commentary",
    "timestamped_commentary",
    "limitations",
    "same_video_status",
    "comparison_truth",
    "diagnostic_chips",
  ];
  for (const section of requiredSections) {
    if (!asRecord(sourceMap[section])) {
      return { ok: false, reason: `missing_section_source:${section}` };
    }
  }
  const json = JSON.stringify(view);
  for (const key of INTERNAL_KEYS) {
    if (json.includes(`"${key}"`)) return { ok: false, reason: `internal_key:${key}` };
  }
  return { ok: true };
}
