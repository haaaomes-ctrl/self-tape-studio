// SERVER-ONLY. Canonical S10 full/authenticated report model composition.
//
// FullReportModel preserves the AI-populated modules and QA/admin identity
// hooks. AuthenticatedReportModel is the performer-facing composition surface:
// it keeps useful S10 detail while relying on the route view model for narrow
// red-line filtering and source-map validation.

import {
  S10_PERFORMER_LEVELS,
  S10_REPORT_SOURCE_MODE,
  toS10PerformerLevel,
  type BriefAchievementMatrix,
  type BriefContext,
  type BriefRequirement,
  type S10ComparisonDisplayMode,
  type S10ComparisonTruth,
  type S10FixHierarchy,
  type S10NextActionPlan,
  type S10OperatorAssumptionCheckpoint,
  type S10OperatorAssumptionComparison,
  type S10PerformerLevel,
  type S10PerformerLevelCalibration,
  type S10SameVideoEvidence,
  type S10TechniqueCommentary,
  type S10TimestampedCommentary,
} from "@/lib/audition-rules";
import type {
  ComponentVerification,
  MediaObservationSummary,
  ObservedTapeSequence,
} from "./evidence-pass.server";
import {
  buildS10PerformerReportViewModel,
  validateAuthenticatedS10RouteSurface,
  type S10PerformerReportViewModel,
  type S10ViewModelContext,
} from "./s10-report-view-model.server";
import {
  buildS10ScoringContext,
  inferS10ScoringMode,
  type S10ScoringContext,
  type S10ScoringMode,
} from "./s10-scoring-context.server";
import {
  buildS10RoleMaterialContext,
  cloneS10RoleMaterialContext,
  type S10RoleMaterialContext,
} from "./s10-role-material-context.server";

export const S10_FULL_REPORT_MODEL_VERSION = "s10-full-report-model-v1" as const;
export const S10_AUTHENTICATED_REPORT_MODEL_VERSION = "s10-authenticated-report-model-v1" as const;

export const S10_FULL_REPORT_MODEL_REQUIRED_SECTIONS = [
  "take_lifecycle",
  "scoring_context",
  "level_calibration",
  "role_material_context",
  "recommendation",
  "brief",
  "observed_tape",
  "scores",
  "professional_competitive_calibration",
  "comparison",
  "fix_hierarchy",
  "strengths",
  "technique",
  "timestamped_commentary",
  "next_action",
  "limitations",
  "red_line_filter",
  "operator_assumptions",
] as const;

export type S10FullReportModelSection = (typeof S10_FULL_REPORT_MODEL_REQUIRED_SECTIONS)[number];

export type BriefScoringContext = S10ScoringContext;

export type RoleMaterialContext = S10RoleMaterialContext;

export type S10TakeLifecycleContext = {
  audition_id: string | null;
  take_id: string | null;
  take_slot: number | null;
  take_label: string | null;
  active_take_version_id: string | null;
  replaces_take_id: string | null;
  comparison_run_id: string | null;
  compared_take_version_ids: string[];
  same_video_status: S10SameVideoEvidence["status"] | null;
};

export type AnalysisInputContext = {
  selected_performer_level: S10PerformerLevel | null;
  scoring_mode: S10ScoringMode;
  brief_context: BriefContext | null;
  brief_requirements: BriefRequirement[];
  observed_tape_sequence: ObservedTapeSequence[];
  component_verifications: ComponentVerification[];
  media_observation_summary: MediaObservationSummary | null;
  role_material_context: RoleMaterialContext;
  take_lifecycle: S10TakeLifecycleContext;
  comparison_context: {
    same_video_status: S10SameVideoEvidence | null;
    comparison_truth: S10ComparisonTruth | null;
    comparison_display_mode: S10ComparisonDisplayMode;
  };
};

export type ProfessionalCompetitiveCalibration = {
  applies: boolean;
  score_zone: "90-91" | "92-93" | "94-95" | "96-97" | "98-100" | null;
  competitive_meaning: string | null;
  why_this_zone: string | null;
  holds_below_next_zone: string | null;
  retake_strategy: string | null;
  preserve: unknown[];
  limitation: string | null;
};

export type RedLineFilterSummary = {
  policy: "narrow_high_risk_only";
  broad_public_safe_restrictions_applied: false;
  performer_surface_internal_keys_removed: string[];
  suppressed_or_rewritten_categories: string[];
};

export type OperatorAssumptionLog = {
  checkpoints: S10OperatorAssumptionCheckpoint[];
  comparisons: S10OperatorAssumptionComparison[];
  unresolved_assumptions: string[];
  confirmation_state: "confirmed" | "partially_confirmed" | "uncertain" | "none";
};

export type QaAdminProofSupport = {
  supported: true;
  performer_surface_includes_qa_internals: false;
  proof_scopes: string[];
  source_map_sections: string[];
};

export type FullReportModel = {
  model_version: typeof S10_FULL_REPORT_MODEL_VERSION;
  source_mode: typeof S10_REPORT_SOURCE_MODE;
  required_sections: readonly S10FullReportModelSection[];
  analysis_input_context: AnalysisInputContext;
  take_lifecycle: S10TakeLifecycleContext;
  scoring_context: BriefScoringContext;
  level_calibration: S10PerformerLevelCalibration | null;
  role_material_context: RoleMaterialContext;
  recommendation: S10PerformerReportViewModel["recommendation"];
  brief: {
    context: BriefContext | null;
    requirements: BriefRequirement[];
    achievement_matrix: BriefAchievementMatrix | null;
  };
  observed_tape: S10PerformerReportViewModel["observed_tape"];
  scores: S10PerformerReportViewModel["score_summary"];
  professional_competitive_calibration: ProfessionalCompetitiveCalibration;
  comparison: {
    same_video_status: S10SameVideoEvidence | null;
    comparison_truth: S10ComparisonTruth | null;
    comparison_display_mode: S10ComparisonDisplayMode;
    comparison_summary: string | null;
    comparison_limitations: string[];
  };
  fix_hierarchy: S10FixHierarchy | null;
  strengths: S10PerformerReportViewModel["strengths_and_preserve"];
  technique: S10TechniqueCommentary | null;
  timestamped_commentary: S10TimestampedCommentary | null;
  next_action: S10NextActionPlan | null;
  limitations: string[];
  red_line_filter: RedLineFilterSummary;
  operator_assumptions: OperatorAssumptionLog;
  qa_admin_proof: QaAdminProofSupport;
};

export type AuthenticatedReportModel = {
  model_version: typeof S10_AUTHENTICATED_REPORT_MODEL_VERSION;
  source_mode: typeof S10_REPORT_SOURCE_MODE;
  audience: "authenticated_performer";
  take_lifecycle: S10TakeLifecycleContext;
  scoring_context: BriefScoringContext;
  level_calibration: S10PerformerLevelCalibration | null;
  role_material_context: RoleMaterialContext;
  performer_view_model: S10PerformerReportViewModel;
  red_line_filter: RedLineFilterSummary;
  operator_assumption_summary: {
    confirmation_state: OperatorAssumptionLog["confirmation_state"];
    unresolved_assumptions: string[];
  };
  qa_admin_proof_summary: QaAdminProofSupport;
};

export type S10ReportModelComposition = {
  full_report_model: FullReportModel;
  authenticated_report_model: AuthenticatedReportModel;
};

export type S10ReportModelCompositionInput = {
  report: Record<string, unknown> | null | undefined;
  context?: S10ViewModelContext | null;
  analysisInputContext?: Partial<AnalysisInputContext> | null;
  operatorAssumptionLog?: Partial<OperatorAssumptionLog> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (value == null) return value;
  return structuredClone(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? clone(value as T[]) : [];
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function maybePerformerLevel(value: unknown): S10PerformerLevel | null {
  if (typeof value !== "string") return null;
  if ((S10_PERFORMER_LEVELS as readonly string[]).includes(value))
    return value as S10PerformerLevel;
  if (
    value === "learning" ||
    value === "amateur" ||
    value === "emerging" ||
    value === "professional"
  ) {
    return toS10PerformerLevel(value);
  }
  return null;
}

function inferSelectedLevel(
  report: Record<string, unknown>,
  view: S10PerformerReportViewModel,
): S10PerformerLevel | null {
  return (
    maybePerformerLevel(view.selected_level_calibration?.selected_level) ??
    maybePerformerLevel(report.selected_performer_level) ??
    maybePerformerLevel(report.selected_level) ??
    maybePerformerLevel(report.performer_level) ??
    maybePerformerLevel(report.audition_level)
  );
}

function buildTakeLifecycle(
  report: Record<string, unknown>,
  view: S10PerformerReportViewModel,
  override?: Partial<S10TakeLifecycleContext> | null,
): S10TakeLifecycleContext {
  const comparedFromTruth =
    view.comparison_truth?.compared_take_summaries?.map((take) => take.take_id).filter(Boolean) ??
    [];
  const comparedFromReport = asArray<string>(report.compared_take_version_ids);
  const comparedTakeVersionIds =
    override?.compared_take_version_ids ??
    (comparedFromReport.length > 0 ? comparedFromReport : comparedFromTruth);
  return {
    audition_id: override?.audition_id ?? asText(report.audition_id),
    take_id: override?.take_id ?? asText(report.take_id),
    take_slot:
      override?.take_slot ??
      asNumber(report.take_slot) ??
      asNumber(asRecord(report.take_lifecycle)?.take_slot),
    take_label:
      override?.take_label ??
      asText(report.take_label) ??
      (typeof report.take_slot === "number" ? `Take ${report.take_slot}` : null),
    active_take_version_id:
      override?.active_take_version_id ??
      asText(report.active_take_version_id) ??
      asText(report.take_version_id),
    replaces_take_id: override?.replaces_take_id ?? asText(report.replaces_take_id),
    comparison_run_id: override?.comparison_run_id ?? asText(report.comparison_run_id),
    compared_take_version_ids: comparedTakeVersionIds,
    same_video_status: override?.same_video_status ?? view.same_video_status?.status ?? null,
  };
}

function professionalZone(score: number | null): ProfessionalCompetitiveCalibration["score_zone"] {
  if (score == null || score < 90) return null;
  if (score <= 91) return "90-91";
  if (score <= 93) return "92-93";
  if (score <= 95) return "94-95";
  if (score <= 97) return "96-97";
  return "98-100";
}

function buildProfessionalCompetitiveCalibration(
  view: S10PerformerReportViewModel,
  level: S10PerformerLevel | null,
): ProfessionalCompetitiveCalibration {
  const score = view.score_summary.overall_submission_readiness_score;
  const zone = professionalZone(score);
  const applies = level === "professional" && zone != null;
  return {
    applies,
    score_zone: applies ? zone : null,
    competitive_meaning: applies ? (view.selected_level_calibration?.score_meaning ?? null) : null,
    why_this_zone: applies ? (view.recommendation?.score_explanation ?? null) : null,
    holds_below_next_zone: applies
      ? view.selected_level_calibration?.what_falls_short?.join(" ") || null
      : null,
    retake_strategy: applies
      ? (view.next_action_plan?.no_retake_needed_reason ??
        view.next_action_plan?.retake_plan?.join(" ") ??
        null)
      : null,
    preserve: applies ? view.strengths_and_preserve.preserve : [],
    limitation: applies
      ? null
      : "Professional 90+ calibration is not applicable unless the selected level is Professional and the visible score is 90 or above.",
  };
}

function buildOperatorAssumptionLog(
  input?: Partial<OperatorAssumptionLog> | null,
): OperatorAssumptionLog {
  const checkpoints = asArray<S10OperatorAssumptionCheckpoint>(input?.checkpoints);
  const comparisons = asArray<S10OperatorAssumptionComparison>(input?.comparisons);
  const unresolved = textArray(input?.unresolved_assumptions);
  const explicitState = input?.confirmation_state;
  return {
    checkpoints,
    comparisons,
    unresolved_assumptions: unresolved,
    confirmation_state:
      explicitState ??
      (unresolved.length > 0
        ? "uncertain"
        : checkpoints.length > 0 || comparisons.length > 0
          ? "confirmed"
          : "none"),
  };
}

const RED_LINE_FILTER: RedLineFilterSummary = {
  policy: "narrow_high_risk_only",
  broad_public_safe_restrictions_applied: false,
  performer_surface_internal_keys_removed: [
    "raw_prompt",
    "raw_model_response",
    "system_prompt",
    "qa_trace",
    "score_trace",
    "run_id",
    "analysis_run_id",
    "signed_urls",
  ],
  suppressed_or_rewritten_categories: [
    "system secrets",
    "signed/private URLs",
    "raw prompts",
    "raw model responses",
    "internal QA internals in performer prose",
    "protected-characteristic inference",
    "body or appearance judgement",
    "medical or vocal-health diagnosis",
    "guaranteed casting or employment outcomes",
    "unsupported certainty",
  ],
};

function qaAdminProof(view: S10PerformerReportViewModel): QaAdminProofSupport {
  return {
    supported: true,
    performer_surface_includes_qa_internals: false,
    proof_scopes: [
      "route section source map",
      "brief scoring context",
      "operator assumptions",
      "take/comparison identity",
      "model composition validation",
    ],
    source_map_sections: Object.keys(view.section_source_map),
  };
}

export function composeS10AuthenticatedReportModel(
  input: S10ReportModelCompositionInput,
): S10ReportModelComposition | null {
  const report = asRecord(input.report);
  if (!report) return null;
  const performerView = buildS10PerformerReportViewModel({
    report,
    context: input.context,
  });
  if (!performerView) return null;

  const matrix = performerView.brief_achievement_matrix;
  const level = inferSelectedLevel(report, performerView);
  const scoringMode =
    input.analysisInputContext?.scoring_mode ??
    inferS10ScoringMode({
      report,
      briefContext: performerView.brief_context,
      briefRequirements: performerView.brief_requirements,
      matrix,
    });
  const roleMaterialContext = buildS10RoleMaterialContext({
    report,
    briefContext: performerView.brief_context,
    briefRequirements: performerView.brief_requirements,
    override: input.analysisInputContext?.role_material_context,
  });
  const takeLifecycle = buildTakeLifecycle(
    report,
    performerView,
    input.analysisInputContext?.take_lifecycle,
  );
  const briefScoringContext = buildS10ScoringContext({
    scoringMode,
    briefContext: performerView.brief_context,
    briefRequirements: performerView.brief_requirements,
    matrix,
    observedTapeSequence: performerView.observed_tape.observed_tape_sequence,
    componentVerifications: performerView.observed_tape.component_verifications,
    mediaObservationSummary: performerView.observed_tape.media_observation_summary,
    selectedLevel: level,
    numericScoresVisible: performerView.score_summary.overall_submission_readiness_score != null,
  });
  const analysisInputContext: AnalysisInputContext = {
    selected_performer_level: input.analysisInputContext?.selected_performer_level ?? level,
    scoring_mode: scoringMode,
    brief_context: clone(performerView.brief_context),
    brief_requirements: clone(performerView.brief_requirements),
    observed_tape_sequence: clone(performerView.observed_tape.observed_tape_sequence),
    component_verifications: clone(performerView.observed_tape.component_verifications),
    media_observation_summary: clone(performerView.observed_tape.media_observation_summary),
    role_material_context: cloneS10RoleMaterialContext(roleMaterialContext),
    take_lifecycle: takeLifecycle,
    comparison_context: {
      same_video_status: clone(performerView.same_video_status),
      comparison_truth: clone(performerView.comparison_truth),
      comparison_display_mode: performerView.comparison_display_mode,
    },
  };
  const operatorAssumptions = buildOperatorAssumptionLog(input.operatorAssumptionLog);
  const proof = qaAdminProof(performerView);
  const fullReportModel: FullReportModel = {
    model_version: S10_FULL_REPORT_MODEL_VERSION,
    source_mode: S10_REPORT_SOURCE_MODE,
    required_sections: S10_FULL_REPORT_MODEL_REQUIRED_SECTIONS,
    analysis_input_context: analysisInputContext,
    take_lifecycle: takeLifecycle,
    scoring_context: briefScoringContext,
    level_calibration: clone(performerView.selected_level_calibration),
    role_material_context: cloneS10RoleMaterialContext(roleMaterialContext),
    recommendation: clone(performerView.recommendation),
    brief: {
      context: clone(performerView.brief_context),
      requirements: clone(performerView.brief_requirements),
      achievement_matrix: clone(matrix),
    },
    observed_tape: clone(performerView.observed_tape),
    scores: clone(performerView.score_summary),
    professional_competitive_calibration: buildProfessionalCompetitiveCalibration(
      performerView,
      level,
    ),
    comparison: {
      same_video_status: clone(performerView.same_video_status),
      comparison_truth: clone(performerView.comparison_truth),
      comparison_display_mode: performerView.comparison_display_mode,
      comparison_summary: performerView.comparison_summary,
      comparison_limitations: clone(performerView.comparison_limitations),
    },
    fix_hierarchy: clone(performerView.fix_hierarchy),
    strengths: clone(performerView.strengths_and_preserve),
    technique: clone(performerView.technique_commentary),
    timestamped_commentary: clone(performerView.timestamped_commentary),
    next_action: clone(performerView.next_action_plan),
    limitations: clone(performerView.limitations),
    red_line_filter: clone(RED_LINE_FILTER),
    operator_assumptions: operatorAssumptions,
    qa_admin_proof: proof,
  };
  const authenticatedReportModel: AuthenticatedReportModel = {
    model_version: S10_AUTHENTICATED_REPORT_MODEL_VERSION,
    source_mode: S10_REPORT_SOURCE_MODE,
    audience: "authenticated_performer",
    take_lifecycle: takeLifecycle,
    scoring_context: briefScoringContext,
    level_calibration: clone(performerView.selected_level_calibration),
    role_material_context: cloneS10RoleMaterialContext(roleMaterialContext),
    performer_view_model: performerView,
    red_line_filter: clone(RED_LINE_FILTER),
    operator_assumption_summary: {
      confirmation_state: operatorAssumptions.confirmation_state,
      unresolved_assumptions: clone(operatorAssumptions.unresolved_assumptions),
    },
    qa_admin_proof_summary: proof,
  };
  return {
    full_report_model: fullReportModel,
    authenticated_report_model: authenticatedReportModel,
  };
}

export function validateS10AuthenticatedReportModel(
  model: unknown,
): { ok: true } | { ok: false; reason: string } {
  const record = asRecord(model);
  if (!record) return { ok: false, reason: "model_not_object" };
  if (record.model_version !== S10_AUTHENTICATED_REPORT_MODEL_VERSION) {
    return { ok: false, reason: "wrong_authenticated_model_version" };
  }
  if (record.source_mode !== S10_REPORT_SOURCE_MODE) {
    return { ok: false, reason: "wrong_source_mode" };
  }
  const viewCheck = validateAuthenticatedS10RouteSurface(record.performer_view_model);
  if (!viewCheck.ok) return { ok: false, reason: viewCheck.reason };
  const redLine = asRecord(record.red_line_filter);
  if (redLine?.policy !== "narrow_high_risk_only") {
    return { ok: false, reason: "wrong_red_line_policy" };
  }
  if (redLine.broad_public_safe_restrictions_applied !== false) {
    return { ok: false, reason: "broad_public_safe_restriction" };
  }
  return { ok: true };
}

export function validateS10FullReportModel(
  model: unknown,
): { ok: true } | { ok: false; reason: string } {
  const record = asRecord(model);
  if (!record) return { ok: false, reason: "model_not_object" };
  if (record.model_version !== S10_FULL_REPORT_MODEL_VERSION) {
    return { ok: false, reason: "wrong_full_model_version" };
  }
  for (const section of S10_FULL_REPORT_MODEL_REQUIRED_SECTIONS) {
    if (!(section in record)) return { ok: false, reason: `missing_section:${section}` };
  }
  const redLine = asRecord(record.red_line_filter);
  if (redLine?.policy !== "narrow_high_risk_only") {
    return { ok: false, reason: "wrong_red_line_policy" };
  }
  if (redLine.broad_public_safe_restrictions_applied !== false) {
    return { ok: false, reason: "broad_public_safe_restriction" };
  }
  return { ok: true };
}
