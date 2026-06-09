// SERVER-ONLY. S10.10 authenticated performer report view-model builder.
//
// This is route-surface sanitisation, not public/private payload gating. The
// authenticated report keeps useful S10 brief, score, technique and timestamp
// detail while removing raw prompts, raw model internals and diagnostic traces.

import {
  S10_PERFORMER_REPORT_VIEW_MODEL_VERSION,
  S10_REPORT_SOURCE_MODE,
  S10_ROUTE_REQUIRED_SECTION_KEYS,
  isUsableS10PerformerReportViewModel,
  validateS10RouteSectionSourceEntry,
  canonicalVerdictDecision,
  performerSafeVerdictReason,
} from "@/lib/audition-rules";
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
  S10RouteSectionKey,
  S10RouteSectionSource,
  CanonicalVerdictDecision,
  VerdictLabel,
} from "@/lib/audition-rules";
import type {
  ComponentVerification,
  MediaObservationSummary,
  ObservedTapeSequence,
} from "./evidence-pass.server";
import {
  buildS10ScoringContext,
  inferS10ScoringMode,
  type S10ScoringContext,
} from "./s10-scoring-context.server";
import {
  buildS10RoleMaterialContext,
  validateS10RoleMaterialContext,
  type S10RoleMaterialContext,
} from "./s10-role-material-context.server";
import type { S10ObservationContextSourceKind } from "./s10-observation-context.server";
import { applyS10FixHierarchyNextAction } from "./s10-fix-hierarchy-next-action.server";
import { normaliseS10ProfessionalCritique } from "./s10-strengths-preserve-professional-critique.server";
import { normaliseS10TechniqueCommentary } from "./s10-technique-library-commentary.server";
import { normaliseS10TimestampedCommentary } from "./s10-timestamped-commentary.server";

export type S10SectionSource = S10RouteSectionSource;

export type S10ReportSectionKey = S10RouteSectionKey;

export type S10SectionSourceEntry = {
  source: S10SectionSource;
  module: string | null;
  limitation: string | null;
  source_kind?: S10ObservationContextSourceKind | null;
};

export type S10PerformerReportViewModel = {
  report_version: typeof S10_PERFORMER_REPORT_VIEW_MODEL_VERSION;
  source_mode: typeof S10_REPORT_SOURCE_MODE;
  section_source_map: Record<S10ReportSectionKey, S10SectionSourceEntry>;
  recommendation: {
    decision: ReadinessAndScoreJudgement["decision"];
    headline: string;
    rationale: string[];
    score_explanation: string;
    confidence: ReadinessAndScoreJudgement["confidence"];
  } | null;
  selected_level_calibration: ReadinessAndScoreJudgement["selected_level_calibration"] | null;
  score_summary: {
    overall_submission_readiness_score: number | null;
    performance_quality_score: number | null;
    brief_completion_score: number | null;
    score_band_label: string | null;
    category_scores: ReadinessAndScoreJudgement["category_scores"];
    component_scores: ReadinessAndScoreJudgement["component_scores"];
  };
  /**
   * Δ6 canonical deterministic value D (= takes.overall_score / overall_score_final,
   * canonical after the N4a min removal). The performer-visible headline renders from
   * THIS field; score_summary.overall_submission_readiness_score stays = A (the AI
   * judgement) and continues to feed narration, gating and suppression.
   */
  canonical_overall_score: number | null;
  /**
   * Δ6 Slice 2 canonical VERDICT (render decision vocabulary), derived deterministically from
   * the persisted submission_verdict (label + capped + blocked) via canonicalVerdictDecision.
   * The performer-visible verdict renders from THIS field; recommendation.decision stays = A.
   * `reason` carries the deterministic submission_verdict.reason (tone-honest).
   */
  canonical_verdict: { decision: CanonicalVerdictDecision; reason: string | null } | null;
  /**
   * Δ6 Slice 3 canonical CATEGORY scores. A's category rows (readiness.category_scores),
   * preserving narration, with each row's SCORE replaced by the deterministic
   * report.scores[category_id] (matrix-capped for brief_adherence via capNumberField).
   * The performer-visible category card renders from THIS field; score_summary.category_scores
   * stays = A. Guarantees the displayed categories are exactly the deterministic marks that fed D
   * (no category↔overall drift), even where A and report.scores were authored independently.
   */
  canonical_category_scores: ReadinessAndScoreJudgement["category_scores"];
  /**
   * Δ6 Slice 3 canonical MATERIAL_COMPLIANCE (the brief-completion sub-surface), from the
   * deterministic report.brief_adherence_breakdown.material_compliance (matrix-capped via
   * capNumberField). The performer-visible material_compliance renders from THIS field;
   * score_summary.brief_completion_score stays = A. Null-safe; gated to the EXISTING
   * brief_completion authority (present iff A's brief_completion_score is present) so the
   * withhold seam is identical.
   */
  canonical_material_compliance: number | null;
  scoring_context: S10ScoringContext;
  role_material_context: S10RoleMaterialContext;
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
  roleMaterialContext?: S10RoleMaterialContext | Record<string, unknown> | null;
};

export const S10_LIMITED_REPORT_MESSAGE =
  "TapeCoach could not assemble the full S10 report model for this take. No legacy report was used as a substitute.";

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
  "matching_signal_names",
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

/**
 * Δ6 Slice 2: derive the canonical verdict from the persisted deterministic submission_verdict
 * ({label, reason, blocked, capped} — canonical after Slice 1's N4a). Returns the render decision
 * vocabulary + the deterministic reason. Null when no verdict was persisted. The A-side
 * recommendation.decision is never consulted here.
 */
function canonicalVerdictFromReport(
  report: Record<string, unknown>,
): { decision: CanonicalVerdictDecision; reason: string | null } | null {
  const sv = isRecord(report.submission_verdict) ? report.submission_verdict : null;
  if (!sv) return null;
  return {
    decision: canonicalVerdictDecision({
      label: (asText(sv.label) ?? "") as VerdictLabel | string,
      capped: sv.capped === true,
      blocked: sv.blocked === true,
    }),
    // Δ6: sanitise the deterministic reason so the field is performer-safe by construction.
    // The raw blocked reason ("Blocked: …") is performer-forbidden; reuse the existing
    // performer-safe block_reasons (skipping any "Blocked:"-prefixed entry).
    //
    // WHERE THIS RUNS (verified from source): canonicalVerdictFromReport runs where the
    // canonical_verdict snapshot is BUILT — at PROCESS time, not render time. Chain:
    // process-take → buildRouteReportForPersistence (process-take.server.ts:6737) → buildV2Report
    // (v2-report-builder.server.ts:569/293) → buildS10PerformerReportViewModel → here. At that point
    // report.submission_verdict (set process-take:5748) and report.block_reasons (set :5930, the
    // IN-MEMORY array — distinct from the V2Report's PROJECTED block_reasons at v2-report-builder:480)
    // are both present in memory. The performer surface then reads the PERSISTED snapshot
    // (report.s10_view_model — V2ReportView.tsx:661 / V2ReportViewLegacy.tsx:371, rendered at
    // audition.$auditionId.tsx). submission_verdict is NOT on the persisted JSONB, so this is a
    // process-time / FORWARD-ONLY sanitisation: pre-existing snapshots retain the raw reason and need
    // re-analysis before any future slice renders it. (composeS10AuthenticatedReportModel is uncalled.)
    reason: performerSafeVerdictReason({
      reason: asText(sv.reason),
      blocked: sv.blocked === true,
      blockReasons: report.block_reasons,
    }),
  };
}

/**
 * Δ6 Slice 3 — canonical category scores. Returns A's category rows (narration preserved) with
 * each row's SCORE re-pointed to the deterministic report.scores[category_id] (matrix-capped for
 * brief_adherence via capNumberField at semantics time). Where report.scores lacks a category
 * (e.g. movement / mt_package, which are not keys in the flat scores map), the A row — including
 * its score — is preserved unchanged (null-safe fallback). report.scores is the deterministic
 * mark set that fed the canonical overall D, so the displayed categories cannot drift from it.
 */
function canonicalCategoryScoresFromReport(
  readiness: ReadinessAndScoreJudgement | null,
  report: Record<string, unknown>,
): ReadinessAndScoreJudgement["category_scores"] {
  const rows = readiness?.category_scores ?? [];
  const reportScores = isRecord(report.scores) ? report.scores : {};
  return rows.map((row) => {
    const canonical = asNumber(reportScores[row.category_id]);
    return canonical != null ? { ...row, score: canonical } : row;
  });
}

type RouteObservationConstraint = {
  requirement_id: string;
  label: string;
  component_type: ObservedTapeSequence["component_type"];
  observed_status: ComponentVerification["observed_status"];
  completion_status: ComponentVerification["completion_status"];
  evidence_summary: string;
  assessability_notes: string;
  confidence: ComponentVerification["confidence"];
};

type MatrixRequirementResult = BriefAchievementMatrix["requirement_results"][number];

function appendRouteNote(existing: string | undefined, note: string): string {
  const base = typeof existing === "string" ? existing.trim() : "";
  if (!base) return note;
  if (base.includes(note)) return base;
  return `${base}; ${note}`;
}

function hasRestrictiveObservedTapeStatus(item: ObservedTapeSequence): boolean {
  return item.present_status !== "present" || item.completion_status !== "complete";
}

function claimsCompletePresence(input: {
  observed_status?: string | null;
  completion_status?: string | null;
}): boolean {
  return input.observed_status === "present" || input.completion_status === "complete";
}

function claimsCompleteRouteText(value: string): boolean {
  return /\b(present and complete|complete(?:\s+\w+){0,3}\s+package|complete side|complete song|verified|achieved package|all required material|final export contains|side\s*1 and song)\b/i.test(
    value,
  );
}

function buildRouteObservationConstraints(
  observedTapeSequence: ObservedTapeSequence[],
): Map<string, RouteObservationConstraint> {
  const constraints = new Map<string, RouteObservationConstraint>();
  for (const item of observedTapeSequence) {
    if (!hasRestrictiveObservedTapeStatus(item)) continue;
    for (const requirementId of item.linked_requirement_ids ?? []) {
      if (!requirementId) continue;
      constraints.set(requirementId, {
        requirement_id: requirementId,
        label: item.label,
        component_type: item.component_type,
        observed_status: item.present_status,
        completion_status: item.completion_status,
        evidence_summary: item.evidence_summary,
        assessability_notes: item.assessability_notes,
        confidence: item.confidence,
      });
    }
  }
  return constraints;
}

function routeConstraintSummary(constraint: RouteObservationConstraint): string {
  return `${constraint.label || "Requirement"} is observed as ${constraint.observed_status} / ${constraint.completion_status}.`;
}

function textIncludesRouteDependency(
  value: string,
  constraint: RouteObservationConstraint,
): boolean {
  const mentionsPackageDependency =
    /\b(package|continuous|one final|final file|all required material|full package|side\s*1 and song|acting scene and (the )?song)\b/i.test(
      value,
    );
  if (!mentionsPackageDependency) return false;
  if (constraint.component_type === "acting_scene") {
    return /\b(side\s*1|acting scene|scene|all required material|package|continuous|final file)\b/i.test(
      value,
    );
  }
  if (constraint.component_type === "song") {
    return /\b(song|all required material|package|continuous|final file)\b/i.test(value);
  }
  return false;
}

function dependentConstraintForText(
  value: string,
  constraints: Map<string, RouteObservationConstraint>,
): RouteObservationConstraint | null {
  for (const constraint of constraints.values()) {
    if (textIncludesRouteDependency(value, constraint)) return constraint;
  }
  return null;
}

function expandRouteObservationConstraints(
  constraints: Map<string, RouteObservationConstraint>,
  matrix: BriefAchievementMatrix | null,
  componentVerifications: ComponentVerification[],
): Map<string, RouteObservationConstraint> {
  if (constraints.size === 0) return constraints;
  const expanded = new Map(constraints);
  const addDependentConstraint = (requirementId: string, label: string, textValue: string) => {
    if (!requirementId || expanded.has(requirementId)) return;
    if (/\b(file naming|filename)\b/i.test(`${label} ${textValue}`)) return;
    const dependency = dependentConstraintForText(textValue, constraints);
    if (!dependency) return;
    expanded.set(requirementId, {
      ...dependency,
      requirement_id: requirementId,
      label,
      evidence_summary: `This package/final-file result depends on ${routeConstraintSummary(dependency)}`,
      assessability_notes:
        "S10 route reconciled this package/final-file row with a stricter required-component observation before rendering.",
    });
  };

  for (const row of matrix?.requirement_results ?? []) {
    addDependentConstraint(
      row.requirement_id,
      row.requirement_summary,
      `${row.requirement_summary} ${row.evidence_summary} ${row.recommended_action}`,
    );
  }
  for (const verification of componentVerifications) {
    addDependentConstraint(
      verification.requirement_id,
      verification.requirement_summary,
      `${verification.requirement_summary} ${verification.evidence_summary} ${verification.assessability_notes ?? ""}`,
    );
  }
  return expanded;
}

function reconcileComponentVerificationsWithObservedTape(
  verifications: ComponentVerification[],
  constraints: Map<string, RouteObservationConstraint>,
): ComponentVerification[] {
  return verifications.map((verification) => {
    const constraint = constraints.get(verification.requirement_id);
    if (
      !constraint ||
      (!claimsCompletePresence({
        observed_status: verification.observed_status,
        completion_status: verification.completion_status,
      }) &&
        !claimsCompleteRouteText(
          `${verification.requirement_summary} ${verification.evidence_summary} ${verification.assessability_notes ?? ""}`,
        ))
    ) {
      return verification;
    }
    return {
      ...verification,
      observed_status: constraint.observed_status,
      completion_status: constraint.completion_status,
      evidence_summary: constraint.evidence_summary || verification.evidence_summary,
      confidence: constraint.confidence,
      assessability_notes: appendRouteNote(
        verification.assessability_notes,
        "S10 route reconciled this row with stricter observed-tape evidence before rendering.",
      ),
    };
  });
}

function achievementForConstraint(
  constraint: RouteObservationConstraint,
): BriefAchievementMatrix["requirement_results"][number]["achievement_status"] {
  if (constraint.observed_status === "absent") return "not_achieved";
  if (constraint.observed_status === "not_assessable" || constraint.observed_status === "uncertain")
    return "not_assessable";
  if (constraint.observed_status === "partially_present") return "partly_achieved";
  if (constraint.completion_status === "incomplete" || constraint.completion_status === "cut_off")
    return "partly_achieved";
  if (constraint.completion_status === "uncertain") return "not_assessable";
  return "partly_achieved";
}

function isMaterialOrPackageRequirement(row: MatrixRequirementResult): boolean {
  const text = `${row.requirement_summary} ${row.evidence_summary} ${row.recommended_action}`;
  return (
    row.category === "material" ||
    row.category === "performance" ||
    /\b(package|continuous|required material|complete package|song|side|acting scene)\b/i.test(text)
  );
}

function submissionImpactForConstraint(
  row: MatrixRequirementResult,
  constraint: RouteObservationConstraint,
): MatrixRequirementResult["submission_impact"] {
  if (row.importance !== "mandatory" || !isMaterialOrPackageRequirement(row)) {
    return row.submission_impact === "supports_submission"
      ? "not_assessable"
      : row.submission_impact;
  }
  if (constraint.observed_status === "absent") return "submission_blocker";
  return "material_gap";
}

function fixCategoryForConstraint(
  row: MatrixRequirementResult,
  constraint: RouteObservationConstraint,
): MatrixRequirementResult["fix_category"] {
  if (
    row.importance === "mandatory" &&
    isMaterialOrPackageRequirement(row) &&
    constraint.observed_status !== "present"
  ) {
    return "must_fix";
  }
  return row.fix_category;
}

function reconcileBriefAchievementMatrixWithObservedTape(
  matrix: BriefAchievementMatrix | null,
  constraints: Map<string, RouteObservationConstraint>,
): BriefAchievementMatrix | null {
  if (!matrix || !Array.isArray(matrix.requirement_results) || constraints.size === 0) {
    return matrix;
  }
  const downgradedIds = new Set<string>();
  const requirement_results = matrix.requirement_results.map((row) => {
    const constraint = constraints.get(row.requirement_id);
    if (
      !constraint ||
      (!claimsCompletePresence({
        observed_status: row.observed_status,
        completion_status: row.completion_status,
      }) &&
        !claimsCompleteRouteText(
          `${row.requirement_summary} ${row.evidence_summary} ${row.recommended_action}`,
        ))
    ) {
      return row;
    }
    downgradedIds.add(row.requirement_id);
    const achievement_status = achievementForConstraint(constraint);
    return {
      ...row,
      observed_status: constraint.observed_status,
      completion_status: constraint.completion_status,
      achievement_status,
      evidence_summary: constraint.evidence_summary || row.evidence_summary,
      submission_impact: submissionImpactForConstraint(row, constraint),
      fix_category: fixCategoryForConstraint(row, constraint),
      recommended_action:
        row.recommended_action &&
        !/\b(preserve|complete|present|submit-ready|supports submission)\b/i.test(
          row.recommended_action,
        )
          ? row.recommended_action
          : `Resolve this requirement before relying on submit guidance: ${routeConstraintSummary(constraint)}`,
      confidence: constraint.confidence,
    };
  });
  if (downgradedIds.size === 0) return matrix;

  const notAssessable = new Set(matrix.not_assessable_requirements ?? []);
  const missing = new Set(matrix.missing_or_incomplete_requirements ?? []);
  for (const row of requirement_results) {
    if (!downgradedIds.has(row.requirement_id)) continue;
    if (row.achievement_status === "not_assessable") notAssessable.add(row.requirement_id);
    else missing.add(row.requirement_id);
  }
  return {
    ...matrix,
    overall_status:
      matrix.overall_status === "achieved" || matrix.overall_status === "mostly_achieved"
        ? "partly_achieved"
        : matrix.overall_status,
    mandatory_status: matrix.mandatory_status === "clear" ? "some_gaps" : matrix.mandatory_status,
    readiness_impact:
      matrix.readiness_impact === "supports_submission" ? "material_gap" : matrix.readiness_impact,
    summary: `S10 route reconciled the brief achievement result with stricter observed-tape evidence before rendering: ${[
      ...downgradedIds,
    ]
      .map((id) => constraints.get(id))
      .filter((item): item is RouteObservationConstraint => Boolean(item))
      .map(routeConstraintSummary)
      .join(" ")}`,
    achieved_requirements: (matrix.achieved_requirements ?? []).filter(
      (id) => !downgradedIds.has(id),
    ),
    missing_or_incomplete_requirements: [...missing],
    not_assessable_requirements: [...notAssessable],
    requirement_results,
  };
}

function constrainedMaterialRows(
  matrix: BriefAchievementMatrix | null,
  constraints: Map<string, RouteObservationConstraint>,
): MatrixRequirementResult[] {
  if (!matrix) return [];
  return matrix.requirement_results.filter(
    (row) =>
      constraints.has(row.requirement_id) &&
      row.importance === "mandatory" &&
      isMaterialOrPackageRequirement(row),
  );
}

function categoryContradictsConstraint(
  categoryId: unknown,
  constraints: Map<string, RouteObservationConstraint>,
): boolean {
  const id = asText(categoryId);
  if (!id) return false;
  const componentTypes = new Set([...constraints.values()].map((item) => item.component_type));
  if (id === "brief_adherence") return constraints.size > 0;
  if (id === "acting") return componentTypes.has("acting_scene");
  if (id === "vocal") return componentTypes.has("song");
  if (id === "technical") return componentTypes.has("technical");
  return false;
}

function reconcileReadinessWithObservedTape(
  readiness: ReadinessAndScoreJudgement | null,
  matrix: BriefAchievementMatrix | null,
  constraints: Map<string, RouteObservationConstraint>,
): ReadinessAndScoreJudgement | null {
  if (!readiness || constraints.size === 0) return readiness;
  const materialRows = constrainedMaterialRows(matrix, constraints);
  if (materialRows.length === 0) return readiness;
  const alreadyBlocking =
    readiness.decision === "review_carefully" ||
    readiness.decision === "retake_required_if_possible";
  const visibleScore = readiness.overall_submission_readiness_score;
  const scoreAlreadyBlocking = typeof visibleScore === "number" && visibleScore < 70;
  if (
    alreadyBlocking &&
    scoreAlreadyBlocking &&
    !containsProfessional90PlusClaim(readiness.selected_level_calibration?.score_meaning)
  ) {
    return readiness;
  }
  const primary = materialRows[0];
  const primaryConstraint = constraints.get(primary.requirement_id);
  const routeReason = primaryConstraint
    ? `${primary.requirement_summary}: ${routeConstraintSummary(primaryConstraint)}`
    : `${primary.requirement_summary} has stricter observed-tape evidence than the score result.`;
  const requiresRetake = materialRows.some((row) => {
    const constraint = constraints.get(row.requirement_id);
    return (
      constraint?.observed_status === "absent" ||
      constraint?.completion_status === "incomplete" ||
      constraint?.completion_status === "cut_off"
    );
  });
  const decision: ReadinessAndScoreJudgement["decision"] = requiresRetake
    ? "retake_required_if_possible"
    : "review_carefully";
  const explanation =
    "Numeric readiness and submit guidance were not rendered because the observed-tape evidence is stricter than the report's achievement/score language.";
  return {
    ...readiness,
    decision,
    headline: requiresRetake
      ? "Retake or repair required before relying on this report."
      : "Review before submitting: observed evidence needs reconciliation.",
    rationale: [
      routeReason,
      "S10 withheld conflicting submit-ready score language until the report is regenerated or the component evidence is confirmed.",
    ],
    confidence: "low",
    performance_quality_score: null,
    brief_completion_score: null,
    overall_submission_readiness_score: null,
    score_band_label: null,
    score_explanation: explanation,
    brief_blocker_override: true,
    brief_completion_summary: routeReason,
    selected_level_calibration: {
      ...readiness.selected_level_calibration,
      score_meaning: explanation,
      what_meets_level: (readiness.selected_level_calibration?.what_meets_level ?? []).filter(
        (item) =>
          !/\b(present|complete|verified|submit-ready|submission-ready|scene-to-song|package reads|professional audition unit)\b/i.test(
            item,
          ),
      ),
      what_falls_short: [
        routeReason,
        ...(readiness.selected_level_calibration?.what_falls_short ?? []),
      ].filter((item) => !/\bnot a retake blocker|not required for readiness\b/i.test(item)),
      recommendation_impact:
        "The selected-level judgement is provisional until the observed material contradiction is resolved.",
      confidence: "low",
    },
    category_scores: (readiness.category_scores ?? []).map((row) =>
      categoryContradictsConstraint(row.category_id, constraints)
        ? {
            ...row,
            score: null,
            score_basis: explanation,
            what_works: "",
            why_not_full_score: routeReason,
            close_gap:
              "Regenerate the report or confirm the final export evidence before scoring this category.",
            confidence: "low",
            blocked_or_not_assessable_reason: routeReason,
          }
        : row,
    ),
    component_scores: (readiness.component_scores ?? []).map((row) => {
      const linked = row.linked_requirement_ids.find((id) => constraints.has(id));
      const constraint = linked ? constraints.get(linked) : null;
      return constraint
        ? {
            ...row,
            observed_status: constraint.observed_status,
            completion_status: constraint.completion_status,
            score: null,
            score_basis: explanation,
            confidence: "low",
            cannot_score_reason: routeConstraintSummary(constraint),
          }
        : row;
    }),
    component_score_notes: [
      "S10 route withheld component scores that contradicted stricter observed-tape evidence.",
    ],
    score_contradiction_warnings: [
      ...(readiness.score_contradiction_warnings ?? []),
      {
        affected_field: "readiness_score_judgement",
        original_value: readiness.overall_submission_readiness_score,
        capped_value: null,
        matrix_reason: routeReason,
        source: "s10_ai_judgement",
      },
    ],
    repair_prompt_status: "classified_contradictory",
  };
}

function routeConstraintReferenceIds(
  constraints: Map<string, RouteObservationConstraint>,
): Set<string> {
  const ids = new Set<string>();
  for (const id of constraints.keys()) {
    ids.add(id);
    ids.add(`cv-${id.replace(/^req-/, "")}`);
  }
  return ids;
}

function itemReferencesRouteConstraint(
  item: unknown,
  constraints: Map<string, RouteObservationConstraint>,
): boolean {
  const record = asRecord(item);
  if (!record) return false;
  const ids = routeConstraintReferenceIds(constraints);
  const linked = [
    ...asArray<string>(record.linked_requirement_ids),
    ...asArray<string>(record.linked_matrix_result_ids),
    ...asArray<string>(record.linked_component_verification_ids),
  ];
  return linked.some((id) => ids.has(id));
}

function routePositiveClaimText(value: string): boolean {
  if (
    /\b(incomplete|missing|not confirmed|not observed|not assessable|partial|cut[-\s]?off)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  return /\b(present and complete|complete(?:\s+\w+){0,3}\s+package|complete side|complete song|verified side|verified complete|submit-ready|submission-ready|supports submission|submission is strong|no mandatory blocker|no mandatory fix|achieved package|preserve the complete|scene-to-song|professional audition unit|package reads)\b/i.test(
    value,
  );
}

function itemVisibleText(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return "";
  return [
    record.title,
    record.headline,
    record.point,
    record.summary,
    record.detail,
    record.exact_action,
    record.evidence_summary,
    record.why_it_matters,
    record.why_to_preserve,
    record.recommended_action,
  ]
    .map((item) => asText(item))
    .filter(Boolean)
    .join(" ");
}

function correctiveActionText(value: unknown): boolean {
  return /\b(record|include|resolve|re-check|regenerate|confirm|before relying|before submitting|not confirmed|not observed|missing|required)\b/i.test(
    itemVisibleText(value),
  );
}

function actionItemAllowedAfterConstraint(
  item: unknown,
  constraints: Map<string, RouteObservationConstraint>,
  keepCorrective: boolean,
): boolean {
  if (!itemReferencesRouteConstraint(item, constraints)) {
    return constraints.size === 0 || !routePositiveClaimText(itemVisibleText(item));
  }
  return keepCorrective && correctiveActionText(item);
}

function routeConstraintLimitation(constraints: Map<string, RouteObservationConstraint>): string {
  const summaries = [...constraints.values()].map(routeConstraintSummary).join(" ");
  return `S10 route withheld report sections that claimed completion where stricter observed evidence exists. ${summaries}`;
}

function restrictFixHierarchyWithObservedTape(
  hierarchy: S10FixHierarchy | null,
  constraints: Map<string, RouteObservationConstraint>,
): S10FixHierarchy | null {
  if (!hierarchy || constraints.size === 0) return hierarchy;
  const keepCorrective = (item: unknown) =>
    actionItemAllowedAfterConstraint(item, constraints, true);
  const keepNonCorrective = (item: unknown) =>
    actionItemAllowedAfterConstraint(item, constraints, false);
  return {
    ...hierarchy,
    fix_first: keepCorrective(hierarchy.fix_first) ? hierarchy.fix_first : null,
    priority_fixes: (hierarchy.priority_fixes ?? []).filter(keepCorrective),
    must_fix_before_submitting: (hierarchy.must_fix_before_submitting ?? []).filter(keepCorrective),
    should_improve_if_retaking: (hierarchy.should_improve_if_retaking ?? []).filter(
      keepNonCorrective,
    ),
    optional_polish: (hierarchy.optional_polish ?? []).filter(keepNonCorrective),
    preserve: (hierarchy.preserve ?? []).filter(keepNonCorrective),
    do_not_overfix: (hierarchy.do_not_overfix ?? []).filter(keepNonCorrective),
  };
}

function restrictNextActionPlanWithObservedTape(
  plan: S10NextActionPlan | null,
  constraints: Map<string, RouteObservationConstraint>,
): S10NextActionPlan | null {
  if (!plan || constraints.size === 0) return plan;
  const keepText = (item: string) => !routePositiveClaimText(item) || correctiveActionText(item);
  return {
    ...plan,
    submit_checklist: (plan.submit_checklist ?? []).filter(keepText),
    final_checks: (plan.final_checks ?? []).filter(keepText),
    playback_checks: plan.playback_checks ?? [],
    retake_plan: plan.retake_plan ?? [],
    do_not_overfix: (plan.do_not_overfix ?? []).filter(keepText),
    if_time_is_short_guidance: (plan.if_time_is_short_guidance ?? []).filter(keepText),
    no_retake_needed_reason: null,
  };
}

function restrictProfessionalCritiqueWithObservedTape(
  critique: S10ProfessionalCritique | null,
  constraints: Map<string, RouteObservationConstraint>,
): S10ProfessionalCritique | null {
  if (!critique || constraints.size === 0) return critique;
  const keepStrength = (item: unknown) =>
    !itemReferencesRouteConstraint(item, constraints) &&
    !routePositiveClaimText(itemVisibleText(item));
  const keepPreserve = (item: unknown) =>
    !itemReferencesRouteConstraint(item, constraints) &&
    !routePositiveClaimText(itemVisibleText(item));
  const limitations = [
    ...(critique.critique_limitations ?? []),
    routeConstraintLimitation(constraints),
  ];
  return {
    ...critique,
    summary: routePositiveClaimText(critique.summary)
      ? "S10 route rendered only strengths supported after observed-evidence reconciliation."
      : critique.summary,
    performance_strengths: (critique.performance_strengths ?? []).filter(keepStrength),
    brief_package_strengths: (critique.brief_package_strengths ?? []).filter(keepStrength),
    technical_presentation_strengths: (critique.technical_presentation_strengths ?? []).filter(
      keepStrength,
    ),
    vocal_or_singing_strengths: (critique.vocal_or_singing_strengths ?? []).filter(keepStrength),
    acting_strengths: (critique.acting_strengths ?? []).filter(keepStrength),
    movement_or_physical_strengths: (critique.movement_or_physical_strengths ?? []).filter(
      keepStrength,
    ),
    professional_presentation_notes: (critique.professional_presentation_notes ?? []).filter(
      keepStrength,
    ),
    preserve: (critique.preserve ?? []).filter(keepPreserve),
    do_not_overfix: (critique.do_not_overfix ?? []).filter(keepPreserve),
    critique_limitations: limitations.filter(
      (item, index, array) => item && array.indexOf(item) === index,
    ),
  };
}

function constrainedComponentTypes(
  constraints: Map<string, RouteObservationConstraint>,
): Set<ObservedTapeSequence["component_type"]> {
  return new Set([...constraints.values()].map((item) => item.component_type));
}

function routeLimitedTechniqueSection(
  status: "partially_assessable" | "not_assessable",
  headline: string,
  reason: string,
): S10TechniqueCommentary["acting"] {
  return {
    status,
    headline,
    observations: [],
    what_is_working: [],
    what_could_improve: [],
    practical_actions: [],
    preserve: [],
    not_assessable_reason: reason,
    confidence: "low",
  };
}

function restrictTechniqueCommentaryWithObservedTape(
  commentary: S10TechniqueCommentary | null,
  constraints: Map<string, RouteObservationConstraint>,
): S10TechniqueCommentary | null {
  if (!commentary || constraints.size === 0) return commentary;
  const componentTypes = constrainedComponentTypes(constraints);
  const limitations = [...(commentary.limitations ?? []), routeConstraintLimitation(constraints)];
  const next = {
    ...commentary,
    summary: routePositiveClaimText(commentary.summary)
      ? "Technique commentary was limited to evidence that survived observed-evidence reconciliation."
      : commentary.summary,
    limitations: limitations.filter((item, index, array) => item && array.indexOf(item) === index),
  };
  if (componentTypes.has("acting_scene")) {
    next.acting = routeLimitedTechniqueSection(
      "not_assessable",
      "Acting scene not assessable from the reconciled evidence.",
      "The required Side 1 acting scene is not confirmed by the stricter observed-tape evidence.",
    );
  }
  if (componentTypes.has("song")) {
    next.vocal_singing = {
      ...next.vocal_singing,
      status: "partially_assessable",
      headline: "Vocal/singing technique is limited to the confirmed observed portion.",
      not_assessable_reason:
        next.vocal_singing.not_assessable_reason ??
        "The required song is partial, cut off or not confirmed complete.",
      what_is_working: (next.vocal_singing.what_is_working ?? []).filter(
        (item) => !routePositiveClaimText(item),
      ),
      preserve: (next.vocal_singing.preserve ?? []).filter((item) => !routePositiveClaimText(item)),
    };
  }
  if (componentTypes.has("acting_scene") || componentTypes.has("song")) {
    next.musical_theatre_package = routeLimitedTechniqueSection(
      "partially_assessable",
      "MT package commentary is limited because the required package is not fully confirmed.",
      "A required package component is absent, partial or not confirmed complete in the stricter observed-tape evidence.",
    );
  }
  if (componentTypes.has("technical")) {
    next.self_tape_presentation = routeLimitedTechniqueSection(
      "not_assessable",
      "Self-tape presentation is not assessable from the reconciled technical evidence.",
      "The technical presentation row is not confirmed by stricter observed-tape evidence.",
    );
  }
  return next;
}

function timestampNoteIsCorrective(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record?.is_missing_component_note === true ||
    /\b(not observed|missing|required|record|include|cut[-\s]?off|playback|incomplete)\b/i.test(
      itemVisibleText(value),
    )
  );
}

function restrictTimestampedCommentaryWithObservedTape(
  commentary: S10TimestampedCommentary | null,
  constraints: Map<string, RouteObservationConstraint>,
): S10TimestampedCommentary | null {
  if (!commentary || constraints.size === 0) return commentary;
  const notes = (commentary.notes ?? []).filter(
    (note) => !itemReferencesRouteConstraint(note, constraints) || timestampNoteIsCorrective(note),
  );
  const timestampLimitations = [
    ...(commentary.timestamp_limitations ?? []),
    routeConstraintLimitation(constraints),
  ].filter((item, index, array) => item && array.indexOf(item) === index);
  return {
    ...commentary,
    summary: routePositiveClaimText(commentary.summary)
      ? "Timestamped notes were filtered against stricter observed evidence before rendering."
      : commentary.summary,
    notes,
    timestamp_limitations: timestampLimitations,
  };
}

function containsProfessional90PlusClaim(value: unknown): boolean {
  const text = asText(value);
  if (!text) return false;
  return /\b90\s*\+|\b90\b|competitive zone/i.test(text);
}

function removeSub90Professional90PlusLanguage(
  readiness: ReadinessAndScoreJudgement | null,
): ReadinessAndScoreJudgement | null {
  if (!readiness?.selected_level_calibration) return readiness;
  const score = asNumber((readiness as Record<string, unknown>).overall_submission_readiness_score);
  if (score != null && score >= 90) return readiness;
  if (!containsProfessional90PlusClaim(readiness.selected_level_calibration.score_meaning)) {
    return readiness;
  }

  return {
    ...readiness,
    selected_level_calibration: {
      ...readiness.selected_level_calibration,
      score_meaning:
        "Higher-score competitive calibration is not shown for this report; use the visible readiness score and rationale.",
      what_falls_short: [
        "The visible readiness score sits below the Professional competitive calibration range.",
        ...(readiness.selected_level_calibration.what_falls_short ?? []),
      ].filter((item, index, array) => item && array.indexOf(item) === index),
      recommendation_impact:
        "The recommendation should be read from the visible readiness score and evidence rationale, not from higher-score calibration language.",
    },
  };
}

function source(available: boolean, module: string, limitation: string): S10SectionSourceEntry {
  return available
    ? { source: "s10_authoritative_module", module, limitation: null }
    : { source: "specific_limitation", module, limitation };
}

function notApplicable(limitation: string): S10SectionSourceEntry {
  return { source: "not_applicable", module: null, limitation };
}

function limitation(module: string, message: string): S10SectionSourceEntry {
  return { source: "specific_limitation", module, limitation: message };
}

function sourceModule(module: string): S10SectionSourceEntry {
  return { source: "s10_authoritative_module", module, limitation: null };
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
    case "mixed_same_video_and_distinct_takes":
    case "uncertain":
      return "comparison_caution";
    case "distinct_takes":
    case "single_take":
    default:
      return "hidden";
  }
}

const S10_AUTHORITATIVE_MODULE_KEYS = [
  "brief_achievement_matrix",
  "readiness_score_judgement",
  "s10_fix_hierarchy",
  "s10_next_action_plan",
  "s10_professional_critique",
  "s10_technique_commentary",
  "s10_timestamped_commentary",
] as const;

function hasActualS10AuthoritativeModuleObjects(report: unknown): boolean {
  const r = asRecord(report);
  if (!r) return false;
  return S10_AUTHORITATIVE_MODULE_KEYS.some((key) => isRecord(r[key]));
}

export function hasS10AuthoritativeModules(report: unknown): boolean {
  const r = asRecord(report);
  if (!r) return false;
  return (
    r.source_mode === "s10_ai_report_model" ||
    isRecord(r.s10_view_model) ||
    hasActualS10AuthoritativeModuleObjects(r)
  );
}

export function buildS10PerformerReportViewModel(input: {
  report: Record<string, unknown> | null | undefined;
  context?: S10ViewModelContext | null;
}): S10PerformerReportViewModel | null {
  const report = asRecord(input.report);
  if (!report || !hasActualS10AuthoritativeModuleObjects(report)) return null;

  let readiness = cloneForRouteSurface(
    report.readiness_score_judgement,
  ) as ReadinessAndScoreJudgement | null;
  let matrix = cloneForRouteSurface(
    report.brief_achievement_matrix,
  ) as BriefAchievementMatrix | null;
  let fixHierarchy = cloneForRouteSurface(report.s10_fix_hierarchy) as S10FixHierarchy | null;
  let nextActionPlan = cloneForRouteSurface(
    report.s10_next_action_plan,
  ) as S10NextActionPlan | null;
  let professionalCritique = cloneForRouteSurface(
    report.s10_professional_critique,
  ) as S10ProfessionalCritique | null;
  let techniqueCommentary = cloneForRouteSurface(
    report.s10_technique_commentary,
  ) as S10TechniqueCommentary | null;
  let timestampedCommentary = cloneForRouteSurface(
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
  const rendersComparisonSection =
    comparisonDisplayMode !== "hidden" && comparisonDisplayMode !== "single_take";

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
  let componentVerifications = asArray<ComponentVerification>(
    context.componentVerifications ?? report.component_verifications,
  );
  const observedConstraints = expandRouteObservationConstraints(
    buildRouteObservationConstraints(observedTapeSequence),
    matrix,
    componentVerifications,
  );
  componentVerifications = reconcileComponentVerificationsWithObservedTape(
    componentVerifications,
    observedConstraints,
  );
  matrix = reconcileBriefAchievementMatrixWithObservedTape(matrix, observedConstraints);
  readiness = reconcileReadinessWithObservedTape(readiness, matrix, observedConstraints);
  readiness = removeSub90Professional90PlusLanguage(readiness);
  const mediaObservationSummary = cloneForRouteSurface(
    context.mediaObservationSummary ?? report.media_observation_summary ?? null,
  ) as MediaObservationSummary | null;

  if (observedConstraints.size > 0 && readiness && matrix) {
    const hadFixHierarchy = fixHierarchy != null;
    const hadNextActionPlan = nextActionPlan != null;
    const hadProfessionalCritique = professionalCritique != null;
    const hadTechniqueCommentary = techniqueCommentary != null;
    const hadTimestampedCommentary = timestampedCommentary != null;
    const actionReport = {
      ...report,
      s10_fix_hierarchy: fixHierarchy,
      s10_next_action_plan: nextActionPlan,
    };
    const actionModules = applyS10FixHierarchyNextAction({
      report: actionReport,
      matrix,
      readiness,
    });
    const normalisedFixHierarchy = actionModules.hierarchy;
    const normalisedNextActionPlan = actionModules.nextActionPlan;
    fixHierarchy = hadFixHierarchy ? normalisedFixHierarchy : null;
    nextActionPlan = hadNextActionPlan ? normalisedNextActionPlan : null;
    professionalCritique = hadProfessionalCritique
      ? normaliseS10ProfessionalCritique({
          critique: professionalCritique,
          matrix,
          readiness,
          fixHierarchy: normalisedFixHierarchy,
          nextActionPlan: normalisedNextActionPlan,
          componentVerifications,
          mediaObservationSummary,
          report,
        })
      : null;
    techniqueCommentary = hadTechniqueCommentary
      ? normaliseS10TechniqueCommentary({
          commentary: techniqueCommentary,
          matrix,
          readiness,
          fixHierarchy: normalisedFixHierarchy,
          nextActionPlan: normalisedNextActionPlan,
          professionalCritique:
            professionalCritique ??
            normaliseS10ProfessionalCritique({
              critique: null,
              matrix,
              readiness,
              fixHierarchy: normalisedFixHierarchy,
              nextActionPlan: normalisedNextActionPlan,
              componentVerifications,
              mediaObservationSummary,
              report,
            }),
          componentVerifications,
          mediaObservationSummary,
          report,
        })
      : null;
    timestampedCommentary = hadTimestampedCommentary
      ? normaliseS10TimestampedCommentary({
          commentary: timestampedCommentary,
          matrix,
          readiness,
          fixHierarchy: normalisedFixHierarchy,
          nextActionPlan: normalisedNextActionPlan,
          professionalCritique:
            professionalCritique ??
            normaliseS10ProfessionalCritique({
              critique: null,
              matrix,
              readiness,
              fixHierarchy: normalisedFixHierarchy,
              nextActionPlan: normalisedNextActionPlan,
              componentVerifications,
              mediaObservationSummary,
              report,
            }),
          techniqueCommentary:
            techniqueCommentary ??
            normaliseS10TechniqueCommentary({
              commentary: null,
              matrix,
              readiness,
              fixHierarchy: normalisedFixHierarchy,
              nextActionPlan: normalisedNextActionPlan,
              professionalCritique:
                professionalCritique ??
                normaliseS10ProfessionalCritique({
                  critique: null,
                  matrix,
                  readiness,
                  fixHierarchy: normalisedFixHierarchy,
                  nextActionPlan: normalisedNextActionPlan,
                  componentVerifications,
                  mediaObservationSummary,
                  report,
                }),
              componentVerifications,
              mediaObservationSummary,
              report,
            }),
          observedTapeSequence,
          componentVerifications,
          report,
        })
      : null;
    fixHierarchy = restrictFixHierarchyWithObservedTape(fixHierarchy, observedConstraints);
    nextActionPlan = restrictNextActionPlanWithObservedTape(nextActionPlan, observedConstraints);
    professionalCritique = restrictProfessionalCritiqueWithObservedTape(
      professionalCritique,
      observedConstraints,
    );
    techniqueCommentary = restrictTechniqueCommentaryWithObservedTape(
      techniqueCommentary,
      observedConstraints,
    );
    timestampedCommentary = restrictTimestampedCommentaryWithObservedTape(
      timestampedCommentary,
      observedConstraints,
    );
  }

  fixHierarchy = cloneForRouteSurface(fixHierarchy) as S10FixHierarchy | null;
  nextActionPlan = cloneForRouteSurface(nextActionPlan) as S10NextActionPlan | null;
  professionalCritique = cloneForRouteSurface(
    professionalCritique,
  ) as S10ProfessionalCritique | null;
  techniqueCommentary = cloneForRouteSurface(techniqueCommentary) as S10TechniqueCommentary | null;
  timestampedCommentary = cloneForRouteSurface(
    timestampedCommentary,
  ) as S10TimestampedCommentary | null;

  const scoringMode = inferS10ScoringMode({
    report,
    briefContext,
    briefRequirements,
    matrix,
  });
  const scoringContext = buildS10ScoringContext({
    scoringMode,
    briefContext,
    briefRequirements,
    matrix,
    observedTapeSequence,
    componentVerifications,
    mediaObservationSummary,
    selectedLevel: readiness?.selected_level_calibration?.selected_level ?? null,
    numericScoresVisible:
      asNumber((readiness as Record<string, unknown> | null)?.overall_submission_readiness_score) !=
      null,
  });
  const roleMaterialContext = buildS10RoleMaterialContext({
    report,
    briefContext,
    briefRequirements,
    override: context.roleMaterialContext,
  });
  const roleMaterialContextValidation = validateS10RoleMaterialContext(roleMaterialContext);
  const hasVisibleRoleMaterialContext =
    roleMaterialContextValidation.ok && hasVisibleRoleMaterialContextPayload(roleMaterialContext);
  const hasS10PresentationNotes =
    arrayHasRenderableItems(
      (techniqueCommentary?.self_tape_presentation as { what_is_working?: unknown } | null)
        ?.what_is_working,
    ) || arrayHasRenderableItems(professionalCritique?.professional_presentation_notes);
  const hasBlockingReadiness =
    !!readiness?.decision &&
    readiness.decision !== "submit" &&
    readiness.decision !== "submit_if_deadline_is_close";
  const hasS10SubmissionRisk =
    hasBlockingReadiness ||
    matrix?.readiness_impact === "material_gap" ||
    matrix?.readiness_impact === "submission_blocker" ||
    hasRenderableItemText(fixHierarchy?.fix_first) ||
    arrayHasRenderableItems(fixHierarchy?.must_fix_before_submitting);
  const visibleS10Score =
    asNumber((readiness as Record<string, unknown> | null)?.overall_submission_readiness_score) ??
    null;
  const hasVisibleReadiness = hasVisibleRecommendationPayload(readiness);
  const hasVisibleSelectedLevelCalibration = hasVisibleSelectedLevelCalibrationPayload(
    readiness?.selected_level_calibration,
  );
  const hasVisibleBriefAchievement = hasVisibleBriefAchievementPayload(matrix);
  const hasVisibleComponentVerification =
    hasVisibleComponentVerificationRows(componentVerifications);
  const hasVisibleFixHierarchy = hasFixHierarchyPayload(fixHierarchy);
  const hasVisibleNextActionPlan = hasNextActionPayload(nextActionPlan);
  const hasVisibleProfessionalCritique =
    hasVisibleProfessionalCritiquePayload(professionalCritique);
  const hasVisibleTechniqueCommentary = hasVisibleTechniquePayload(techniqueCommentary);
  const hasVisibleTimestampedCommentary = hasVisibleTimestampedPayload(timestampedCommentary);

  const limitations = [
    ...(hasVisibleBriefAchievement
      ? []
      : ["Brief achievement details are not available for this report."]),
    ...(hasVisibleReadiness ? [] : ["Readiness judgement is not available for this report."]),
    ...(hasVisibleSelectedLevelCalibration
      ? []
      : ["Selected-level calibration is not available for this report."]),
    ...(visibleS10Score != null ? [] : ["S10 score summary was unavailable for this report."]),
    ...(hasVisibleComponentVerification
      ? []
      : ["Observed component verification is not available for this report."]),
    ...(hasVisibleFixHierarchy ? [] : ["Fix hierarchy was unavailable for this S10 report."]),
    ...(hasVisibleNextActionPlan ? [] : ["Next action plan was unavailable for this S10 report."]),
    ...(hasVisibleProfessionalCritique
      ? []
      : ["Professional critique is not available for this report."]),
    ...(hasVisibleTechniqueCommentary
      ? []
      : ["Technique commentary is not available for this report."]),
    ...(hasVisibleTimestampedCommentary
      ? []
      : ["Timestamped or time-banded commentary is not available for this report."]),
  ];

  const section_source_map: S10PerformerReportViewModel["section_source_map"] = {
    readiness_header: source(
      hasVisibleReadiness,
      "readiness_score_judgement",
      "Readiness judgement is not available for this report.",
    ),
    submission_guidance: source(
      hasVisibleReadiness,
      "readiness_score_judgement",
      "Submission guidance is not available for this report.",
    ),
    selected_level_calibration: source(
      hasVisibleSelectedLevelCalibration,
      "readiness_score_judgement.selected_level_calibration",
      "Selected-level calibration is not available for this report.",
    ),
    score_summary: source(
      visibleS10Score != null,
      "readiness_score_judgement",
      "S10 score summary was unavailable for this report.",
    ),
    scoring_context: source(
      hasVisibleScoringContextPayload(scoringContext),
      "scoring_context",
      "S10 scoring context is not available for this report.",
    ),
    category_scores: source(
      hasVisibleCategoryScoreRows(readiness?.category_scores),
      "readiness_score_judgement.category_scores",
      "S10 category score semantics are not available for this report.",
    ),
    category_rationale: source(
      hasScoreRowRationale(readiness?.category_scores),
      "readiness_score_judgement.category_rationale",
      "S10 category rationale is not available for this report.",
    ),
    brief_adherence_material_compliance: source(
      typeof readiness?.brief_completion_score === "number",
      "readiness_score_judgement.brief_completion_score",
      "S10 brief-completion score is not available for this report.",
    ),
    brief_context: source(
      hasVisibleBriefContextPayload(briefContext),
      "brief_context",
      "Brief context is not available for this report.",
    ),
    brief_requirements: source(
      hasVisibleBriefRequirementRows(briefRequirements),
      "brief_requirements",
      "Brief requirements are not available for this report.",
    ),
    role_material_context: hasVisibleRoleMaterialContext
      ? sourceModule("role_material_context")
      : roleMaterialContextValidation.ok
        ? notApplicable("No supplied or confidently resolved role/material context is rendered.")
        : limitation(
            "role_material_context",
            `Role/material context is unavailable: ${roleMaterialContextValidation.reason}.`,
          ),
    brief_achievement: source(
      hasVisibleBriefAchievement,
      "brief_achievement_matrix",
      "Brief achievement matrix is not available for this report.",
    ),
    observed_tape: source(
      hasVisibleObservedTapeSequenceRows(observedTapeSequence) ||
        hasVisibleComponentVerificationRows(componentVerifications),
      "observed_tape_sequence/component_verifications",
      "Observed tape sequence is not available for this report.",
    ),
    component_breakdown: observationSource(
      hasVisibleComponentVerification,
      "component_verifications",
      "Component verification was unavailable for this S10 report.",
      observationSourceKind,
    ),
    fix_hierarchy: source(
      hasVisibleFixHierarchy,
      "s10_fix_hierarchy",
      "Fix hierarchy was unavailable for this S10 report.",
    ),
    next_action_plan: source(
      hasVisibleNextActionPlan,
      "s10_next_action_plan",
      "Next action plan was unavailable for this S10 report.",
    ),
    strengths_and_preserve: source(
      hasVisibleProfessionalCritique,
      "s10_professional_critique",
      "Strengths and preserve guidance are not available for this report.",
    ),
    professional_critique: source(
      hasVisibleProfessionalCritique,
      "s10_professional_critique",
      "Professional critique is not available for this report.",
    ),
    technique_commentary: source(
      hasVisibleTechniqueCommentary,
      "s10_technique_commentary",
      "Technique commentary is not available for this report.",
    ),
    timestamped_commentary: source(
      hasVisibleTimestampedCommentary,
      "s10_timestamped_commentary",
      "Timestamped commentary is not available for this report.",
    ),
    presentation_notes: hasS10PresentationNotes
      ? {
          source: "s10_authoritative_module",
          module: "s10_professional_critique/s10_technique_commentary",
          limitation: null,
        }
      : notApplicable("No S10 presentation notes are rendered for this report."),
    submission_risk: hasS10SubmissionRisk
      ? {
          source: "s10_authoritative_module",
          module: "readiness_score_judgement/brief_achievement_matrix/s10_fix_hierarchy",
          limitation: null,
        }
      : notApplicable("No S10 submission-risk section is rendered for this report."),
    limitations:
      limitations.length > 0
        ? sourceModule("s10_view_model")
        : notApplicable("No S10 limitations are rendered for this report."),
    same_video_status: {
      source:
        rendersComparisonSection && hasVisibleSameVideoPayload(sameVideoEvidence)
          ? "s10_authoritative_module"
          : "not_applicable",
      module:
        rendersComparisonSection && hasVisibleSameVideoPayload(sameVideoEvidence)
          ? "s10_same_video_evidence"
          : null,
      limitation:
        rendersComparisonSection && hasVisibleSameVideoPayload(sameVideoEvidence)
          ? null
          : "Same-video status is not available in this report model.",
    },
    comparison_truth: {
      source:
        rendersComparisonSection && hasVisibleComparisonTruthPayload(comparisonTruth)
          ? "s10_authoritative_module"
          : "not_applicable",
      module:
        rendersComparisonSection && hasVisibleComparisonTruthPayload(comparisonTruth)
          ? "s10_comparison_truth"
          : null,
      limitation:
        rendersComparisonSection && hasVisibleComparisonTruthPayload(comparisonTruth)
          ? null
          : "Comparison truth is not available or not relevant for this report.",
    },
    diagnostic_chips: {
      source: "not_applicable",
      module: null,
      limitation: "No diagnostic chips are rendered in this performer report.",
    },
  };

  // Δ6 P1 — verdict↔content coherence. Whenever the canonical verdict is non-positive the
  // performer-visible rationale must derive from the deterministic, verdict-coherent
  // report.block_reasons (already performer-safe at assembly, with a hard fallback so a
  // non-positive verdict always carries a real line), never the AI rationale — so it
  // structurally carries the real shortfalls and can never render all-positive (or name a
  // blocker the deterministic system didn't raise). Performer-forbidden "Blocked:"-prefixed
  // lines are dropped here; the canonical reason (itself performer-safe) backstops an empty set.
  const canonicalVerdict = canonicalVerdictFromReport(report);
  const deterministicRationale = (() => {
    const safe = (
      Array.isArray((report as Record<string, unknown>).block_reasons)
        ? ((report as Record<string, unknown>).block_reasons as unknown[])
        : []
    )
      .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
      .map((r) => r.trim())
      .filter((r) => !/^blocked\s*:/i.test(r));
    if (safe.length > 0) return safe;
    return canonicalVerdict?.reason ? [canonicalVerdict.reason] : [];
  })();

  return {
    report_version: S10_PERFORMER_REPORT_VIEW_MODEL_VERSION,
    source_mode: S10_REPORT_SOURCE_MODE,
    section_source_map,
    recommendation:
      hasVisibleReadiness && readiness
        ? {
            decision: readiness.decision,
            headline: readiness.headline,
            // Positive (submit) keeps the AI rationale; every non-positive verdict replaces it
            // with the deterministic shortfalls (REPLACE, not merge — mixing risks re-introducing
            // the incoherent positive lines P1 removes).
            rationale:
              canonicalVerdict?.decision === "submit"
                ? Array.isArray(readiness.rationale)
                  ? readiness.rationale
                  : []
                : deterministicRationale,
            score_explanation: readiness.score_explanation,
            confidence: readiness.confidence,
          }
        : null,
    selected_level_calibration: readiness?.selected_level_calibration ?? null,
    score_summary: {
      overall_submission_readiness_score: visibleS10Score,
      performance_quality_score:
        asNumber((readiness as Record<string, unknown> | null)?.performance_quality_score) ?? null,
      brief_completion_score:
        asNumber((readiness as Record<string, unknown> | null)?.brief_completion_score) ?? null,
      score_band_label: asText((readiness as Record<string, unknown> | null)?.score_band_label),
      category_scores: readiness?.category_scores ?? [],
      component_scores: readiness?.component_scores ?? [],
    },
    // Δ6: canonical deterministic D (persisted as takes.overall_score /
    // report.overall_score_final after N4a). Distinct from score_summary (= A).
    canonical_overall_score:
      asNumber(report.overall_score_final) ?? asNumber(report.overall_score) ?? null,
    // Δ6 Slice 2: canonical verdict from the persisted deterministic submission_verdict
    // (label+capped+blocked → render decision). Distinct from recommendation.decision (= A).
    // P1: reuse the value hoisted above (computed once).
    canonical_verdict: canonicalVerdict,
    // Δ6 Slice 3: canonical category scores (A rows with score = report.scores[category_id],
    // matrix-capped for brief_adherence). Distinct from score_summary.category_scores (= A).
    canonical_category_scores: canonicalCategoryScoresFromReport(readiness, report),
    // Δ6 Slice 3: canonical material_compliance (matrix-capped report.brief_adherence_breakdown).
    // Gated to the EXISTING brief_completion authority — present iff A's brief_completion_score is
    // present — so the withhold seam is identical. Distinct from score_summary.brief_completion_score (= A).
    canonical_material_compliance:
      asNumber((readiness as Record<string, unknown> | null)?.brief_completion_score) != null
        ? (asNumber(
            (isRecord(report.brief_adherence_breakdown) ? report.brief_adherence_breakdown : null)
              ?.material_compliance,
          ) ?? null)
        : null,
    scoring_context: scoringContext,
    role_material_context: roleMaterialContext,
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

export function buildS10LimitedPerformerReportViewModel(
  message = S10_LIMITED_REPORT_MESSAGE,
): S10PerformerReportViewModel {
  const section_source_map: S10PerformerReportViewModel["section_source_map"] = {
    readiness_header: limitation("readiness_score_judgement", message),
    submission_guidance: limitation("readiness_score_judgement", message),
    selected_level_calibration: limitation(
      "readiness_score_judgement.selected_level_calibration",
      message,
    ),
    score_summary: limitation("readiness_score_judgement", message),
    scoring_context: limitation("scoring_context", message),
    category_scores: limitation("readiness_score_judgement.category_scores", message),
    category_rationale: limitation("readiness_score_judgement.category_rationale", message),
    brief_adherence_material_compliance: limitation(
      "readiness_score_judgement.brief_completion_score",
      message,
    ),
    brief_context: limitation("brief_context", message),
    brief_requirements: limitation("brief_requirements", message),
    role_material_context: notApplicable(
      "No supplied or confidently resolved role/material context is rendered.",
    ),
    brief_achievement: limitation("brief_achievement_matrix", message),
    observed_tape: limitation("observed_tape_sequence/component_verifications", message),
    component_breakdown: {
      ...limitation("component_verifications", message),
      source_kind: "unavailable",
    },
    fix_hierarchy: limitation("s10_fix_hierarchy", message),
    next_action_plan: limitation("s10_next_action_plan", message),
    strengths_and_preserve: limitation("s10_professional_critique", message),
    professional_critique: limitation("s10_professional_critique", message),
    technique_commentary: limitation("s10_technique_commentary", message),
    timestamped_commentary: limitation("s10_timestamped_commentary", message),
    presentation_notes: notApplicable("No S10 presentation notes are rendered for this report."),
    submission_risk: notApplicable("No S10 submission-risk section is rendered for this report."),
    limitations: sourceModule("s10_view_model"),
    same_video_status: notApplicable("Same-video status is not available in this report model."),
    comparison_truth: notApplicable(
      "Comparison truth is not available or not relevant for this report.",
    ),
    diagnostic_chips: notApplicable("No diagnostic chips are rendered in this performer report."),
  };

  return {
    report_version: S10_PERFORMER_REPORT_VIEW_MODEL_VERSION,
    source_mode: S10_REPORT_SOURCE_MODE,
    section_source_map,
    recommendation: {
      decision: "review_carefully",
      headline: "S10 report assembly limitation",
      rationale: [message],
      score_explanation: message,
      confidence: "low",
    },
    selected_level_calibration: null,
    score_summary: {
      overall_submission_readiness_score: null,
      performance_quality_score: null,
      brief_completion_score: null,
      score_band_label: null,
      category_scores: [],
      component_scores: [],
    },
    canonical_overall_score: null,
    canonical_verdict: null,
    canonical_category_scores: [],
    canonical_material_compliance: null,
    scoring_context: buildS10ScoringContext({
      scoringMode: "brief_uncertain",
      briefContext: null,
      briefRequirements: [],
      matrix: null,
      observedTapeSequence: [],
      componentVerifications: [],
      mediaObservationSummary: null,
      selectedLevel: null,
      numericScoresVisible: false,
    }),
    role_material_context: buildS10RoleMaterialContext({
      report: {},
      briefContext: null,
      briefRequirements: [],
    }),
    brief_context: null,
    brief_requirements: [],
    brief_achievement_matrix: null,
    observed_tape: {
      observed_tape_sequence: [],
      component_verifications: [],
      media_observation_summary: null,
    },
    component_breakdown: [],
    fix_hierarchy: null,
    next_action_plan: null,
    strengths_and_preserve: {
      summary: null,
      strengths: [],
      preserve: [],
      do_not_overfix: [],
      limitations: [message],
    },
    professional_critique: null,
    technique_commentary: null,
    timestamped_commentary: null,
    limitations: [message],
    same_video_status: null,
    comparison_truth: null,
    comparison_summary: null,
    comparison_limitations: [],
    comparison_display_mode: "hidden",
    diagnostic_chips: [],
  };
}

function arrayHasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

const ROUTE_RENDERED_CATEGORY_IDS = new Set([
  "acting",
  "vocal",
  "audio",
  "technical",
  "brief_adherence",
  "professional_presentation",
]);

function isRouteRenderedCategoryId(value: unknown): boolean {
  const categoryId = asText(value);
  return !!categoryId && ROUTE_RENDERED_CATEGORY_IDS.has(categoryId);
}

function hasRenderableItemText(value: unknown): boolean {
  if (asText(value)) return true;
  const record = asRecord(value);
  if (!record) return false;
  return [
    record.title,
    record.headline,
    record.point,
    record.summary,
    record.detail,
    record.exact_action,
    record.evidence_summary,
    record.why_it_matters,
    record.why_to_preserve,
    record.recommended_action,
  ].some((candidate) => !!asText(candidate));
}

function arrayHasRenderableItems(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => hasRenderableItemText(item));
}

function arrayHasRenderableStrings(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => !!asText(item));
}

function hasVisibleRecommendationPayload(value: unknown): boolean {
  const recommendation = asRecord(value);
  if (!recommendation) return false;
  return (
    !!asText(recommendation.headline) ||
    !!asText(recommendation.score_explanation) ||
    arrayHasRenderableItems(recommendation.rationale)
  );
}

function hasVisibleSelectedLevelCalibrationPayload(value: unknown): boolean {
  const calibration = asRecord(value);
  if (!calibration) return false;
  return (
    !!asText(calibration.selected_level_label) ||
    !!asText(calibration.standard_applied) ||
    !!asText(calibration.readiness_standard) ||
    !!asText(calibration.score_meaning) ||
    !!asText(calibration.recommendation_impact) ||
    arrayHasRenderableStrings(calibration.what_meets_level) ||
    arrayHasRenderableStrings(calibration.what_falls_short)
  );
}

function hasVisibleBriefContextPayload(value: unknown): boolean {
  const context = asRecord(value);
  if (!context) return false;
  return [
    context.project_name,
    context.role_name,
    context.discipline,
    context.audition_type,
    context.material_package_summary,
    context.role_description_summary,
    context.deadline_summary,
    context.upload_summary,
    context.file_naming_summary,
  ].some((candidate) => !!asText(candidate));
}

function hasVisibleRoleMaterialContextPayload(value: unknown): boolean {
  const context = asRecord(value);
  if (!context || context.applies !== true) return false;
  return (
    [
      context.project_name,
      context.role_name,
      context.discipline,
      context.audition_type,
      context.material_package_summary,
      context.role_description_summary,
      context.secondary_context,
    ].some((candidate) => !!asText(candidate)) ||
    arrayHasRenderableItems(context.source_summary) ||
    arrayHasRenderableItems(context.demands) ||
    arrayHasRenderableStrings(context.uncertainty_notes)
  );
}

function hasVisibleScoringContextPayload(value: unknown): boolean {
  const context = asRecord(value);
  if (!context) return false;
  return (
    !!asText(context.scoring_mode) ||
    !!asText(context.scoring_basis_label) ||
    !!asText(context.scoring_basis_summary) ||
    arrayHasRenderableStrings(context.required_limitations)
  );
}

function hasVisibleBriefRequirementRow(value: unknown): boolean {
  const row = asRecord(value);
  if (!row) return false;
  return [
    row.summary,
    row.brief_text,
    row.expected_evidence_in_tape,
    row.achievement_test,
    row.submission_impact_if_missing,
  ].some((candidate) => !!asText(candidate));
}

function hasVisibleBriefRequirementRows(value: unknown): boolean {
  return Array.isArray(value) && value.some((row) => hasVisibleBriefRequirementRow(row));
}

function hasVisibleBriefAchievementRow(value: unknown): boolean {
  const row = asRecord(value);
  if (!row) return false;
  return [
    row.observed_status,
    row.completion_status,
    row.achievement_status,
    row.evidence_summary,
    row.submission_impact,
    row.recommended_action,
  ].some((candidate) => !!asText(candidate));
}

function hasVisibleBriefAchievementPayload(value: unknown): boolean {
  const matrix = asRecord(value);
  if (!matrix) return false;
  return (
    !!asText(matrix.summary) ||
    !!asText(matrix.overall_status) ||
    !!asText(matrix.mandatory_status) ||
    !!asText(matrix.readiness_impact) ||
    (Array.isArray(matrix.requirement_results) &&
      matrix.requirement_results.some((row) => hasVisibleBriefAchievementRow(row)))
  );
}

function hasVisibleObservedTapeSequenceRow(value: unknown): boolean {
  const row = asRecord(value);
  if (!row) return false;
  return [
    row.present_status,
    row.completion_status,
    row.evidence_summary,
    row.assessability_notes,
  ].some((candidate) => !!asText(candidate));
}

function hasVisibleObservedTapeSequenceRows(value: unknown): boolean {
  return Array.isArray(value) && value.some((row) => hasVisibleObservedTapeSequenceRow(row));
}

function hasVisibleComponentVerificationRow(value: unknown): boolean {
  const row = asRecord(value);
  if (!row) return false;
  return [
    row.observed_status,
    row.completion_status,
    row.evidence_summary,
    row.assessability_notes,
  ].some((candidate) => !!asText(candidate));
}

function hasVisibleComponentVerificationRows(value: unknown): boolean {
  return Array.isArray(value) && value.some((row) => hasVisibleComponentVerificationRow(row));
}

function hasVisibleCategoryScoreRows(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((row) => {
    const record = asRecord(row);
    return (
      !!record && isRouteRenderedCategoryId(record.category_id) && asNumber(record.score) != null
    );
  });
}

function hasScoreRowRationale(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((row) => {
    const record = asRecord(row);
    return (
      !!record &&
      isRouteRenderedCategoryId(record.category_id) &&
      Boolean(
        asText(record.score_basis) ?? asText(record.why_not_full_score) ?? asText(record.close_gap),
      )
    );
  });
}

function hasVisibleComponentBreakdownRows(value: unknown): boolean {
  return hasVisibleComponentVerificationRows(value);
}

function hasFixHierarchyPayload(value: unknown): boolean {
  const hierarchy = asRecord(value);
  if (!hierarchy) return false;
  return (
    hasRenderableItemText(hierarchy.fix_first) ||
    arrayHasRenderableItems(hierarchy.priority_fixes) ||
    arrayHasRenderableItems(hierarchy.must_fix_before_submitting) ||
    arrayHasRenderableItems(hierarchy.should_improve_if_retaking) ||
    arrayHasRenderableItems(hierarchy.optional_polish) ||
    arrayHasRenderableItems(hierarchy.preserve) ||
    arrayHasRenderableItems(hierarchy.do_not_overfix)
  );
}

function hasNextActionPayload(value: unknown): boolean {
  const plan = asRecord(value);
  if (!plan) return false;
  return (
    arrayHasRenderableItems(plan.submit_checklist) ||
    arrayHasRenderableItems(plan.retake_plan) ||
    arrayHasRenderableItems(plan.final_checks) ||
    arrayHasRenderableItems(plan.playback_checks) ||
    !!asText(plan.no_retake_needed_reason)
  );
}

function hasStrengthPayload(value: unknown): boolean {
  const critique = asRecord(value);
  if (!critique) return false;
  return (
    arrayHasRenderableItems(critique.strengths) ||
    arrayHasRenderableItems(critique.preserve) ||
    arrayHasRenderableItems(critique.do_not_overfix)
  );
}

function hasVisibleProfessionalCritiquePayload(value: unknown): boolean {
  const critique = asRecord(value);
  if (!critique) return false;
  return (
    arrayHasRenderableItems(critique.performance_strengths) ||
    arrayHasRenderableItems(critique.brief_package_strengths) ||
    arrayHasRenderableItems(critique.technical_presentation_strengths) ||
    arrayHasRenderableItems(critique.vocal_or_singing_strengths) ||
    arrayHasRenderableItems(critique.acting_strengths) ||
    arrayHasRenderableItems(critique.movement_or_physical_strengths) ||
    arrayHasRenderableItems(critique.professional_presentation_notes) ||
    arrayHasRenderableItems(critique.preserve) ||
    arrayHasRenderableItems(critique.do_not_overfix) ||
    arrayHasRenderableItems(critique.critique_limitations)
  );
}

function hasVisibleTechniqueSectionPayload(value: unknown): boolean {
  const section = asRecord(value);
  if (!section) return false;
  return (
    !!asText(section.headline) ||
    !!asText(section.not_assessable_reason) ||
    arrayHasRenderableItems(section.observations) ||
    arrayHasRenderableItems(section.what_is_working) ||
    arrayHasRenderableItems(section.what_could_improve) ||
    arrayHasRenderableItems(section.practical_actions) ||
    arrayHasRenderableItems(section.preserve) ||
    arrayHasRenderableItems(section.limitations)
  );
}

function hasVisibleTechniquePayload(value: unknown): boolean {
  const commentary = asRecord(value);
  if (!commentary) return false;
  return [
    "acting",
    "vocal_singing",
    "movement_dance",
    "musical_theatre_package",
    "self_tape_presentation",
    "commercial_screen_task",
  ].some((key) => hasVisibleTechniqueSectionPayload(commentary[key]));
}

function hasPresentationPayload(view: Record<string, unknown>): boolean {
  const technique = asRecord(view.technique_commentary);
  const selfTape = asRecord(technique?.self_tape_presentation);
  const critique = asRecord(view.professional_critique);
  return (
    arrayHasRenderableItems(selfTape?.what_is_working) ||
    arrayHasRenderableItems(critique?.professional_presentation_notes)
  );
}

function hasSubmissionRiskPayload(view: Record<string, unknown>): boolean {
  const recommendation = asRecord(view.recommendation);
  const matrix = asRecord(view.brief_achievement_matrix);
  const fixHierarchy = asRecord(view.fix_hierarchy);
  const decision = asText(recommendation?.decision);
  return (
    (!!decision && decision !== "submit" && decision !== "submit_if_deadline_is_close") ||
    asText(matrix?.readiness_impact) === "material_gap" ||
    asText(matrix?.readiness_impact) === "submission_blocker" ||
    hasRenderableItemText(fixHierarchy?.fix_first) ||
    arrayHasRenderableItems(fixHierarchy?.must_fix_before_submitting)
  );
}

function hasVisibleTimestampedNote(value: unknown): boolean {
  const note = asRecord(value);
  if (!note) return false;
  return [note.title, note.detail, note.action, note.evidence_summary].some(
    (candidate) => !!asText(candidate),
  );
}

function hasVisibleTimestampedNotes(value: unknown): boolean {
  return Array.isArray(value) && value.some((note) => hasVisibleTimestampedNote(note));
}

function hasVisibleTimestampLimitations(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => hasRenderableItemText(item));
}

function hasVisibleTimestampedPayload(value: unknown): boolean {
  const timestamped = asRecord(value);
  return !!timestamped && hasVisibleTimestampedNotes(timestamped.notes);
}

function hasVisibleSameVideoPayload(value: unknown): boolean {
  const evidence = asRecord(value);
  if (!evidence) return false;
  return (
    !!asText(evidence.performer_facing_summary) ||
    !!asText(evidence.comparison_warning) ||
    arrayHasRenderableStrings(evidence.limitations)
  );
}

function hasVisibleComparisonTruthPayload(value: unknown): boolean {
  const comparison = asRecord(value);
  if (!comparison) return false;
  return (
    !!asText(comparison.performer_facing_summary) ||
    !!asText(comparison.comparison_warning) ||
    arrayHasRenderableStrings(comparison.limitations)
  );
}

function hasRouteVisibleComparisonDisplayMode(value: unknown): boolean {
  const mode = asText(value);
  return !!mode && mode !== "hidden" && mode !== "single_take";
}

function validateSectionVisiblePayload(
  section: S10ReportSectionKey,
  entry: Record<string, unknown>,
  view: Record<string, unknown>,
): string | null {
  const sourceValue = asText(entry.source);
  if (
    sourceValue !== "s10_authoritative_module" &&
    sourceValue !== "s10_compatibility_projection"
  ) {
    return null;
  }

  const scoreSummary = asRecord(view.score_summary);
  const observedTape = asRecord(view.observed_tape);
  let hasVisiblePayload = true;
  switch (section) {
    case "readiness_header":
    case "submission_guidance": {
      hasVisiblePayload = hasVisibleRecommendationPayload(view.recommendation);
      break;
    }
    case "score_summary":
      hasVisiblePayload = asNumber(scoreSummary?.overall_submission_readiness_score) != null;
      break;
    case "scoring_context":
      hasVisiblePayload = hasVisibleScoringContextPayload(view.scoring_context);
      break;
    case "category_scores":
      hasVisiblePayload = hasVisibleCategoryScoreRows(scoreSummary?.category_scores);
      break;
    case "category_rationale":
      hasVisiblePayload = hasScoreRowRationale(scoreSummary?.category_scores);
      break;
    case "brief_adherence_material_compliance":
      hasVisiblePayload = asNumber(scoreSummary?.brief_completion_score) != null;
      break;
    case "brief_context":
      hasVisiblePayload = hasVisibleBriefContextPayload(view.brief_context);
      break;
    case "brief_requirements":
      hasVisiblePayload = hasVisibleBriefRequirementRows(view.brief_requirements);
      break;
    case "role_material_context":
      hasVisiblePayload = hasVisibleRoleMaterialContextPayload(view.role_material_context);
      break;
    case "brief_achievement":
      hasVisiblePayload = hasVisibleBriefAchievementPayload(view.brief_achievement_matrix);
      break;
    case "observed_tape":
      hasVisiblePayload =
        hasVisibleObservedTapeSequenceRows(observedTape?.observed_tape_sequence) ||
        hasVisibleComponentVerificationRows(observedTape?.component_verifications);
      break;
    case "component_breakdown":
      hasVisiblePayload = hasVisibleComponentBreakdownRows(view.component_breakdown);
      break;
    case "fix_hierarchy":
      hasVisiblePayload = hasFixHierarchyPayload(view.fix_hierarchy);
      break;
    case "next_action_plan":
      hasVisiblePayload = hasNextActionPayload(view.next_action_plan);
      break;
    case "strengths_and_preserve":
      hasVisiblePayload = hasStrengthPayload(view.strengths_and_preserve);
      break;
    case "professional_critique":
      hasVisiblePayload = hasVisibleProfessionalCritiquePayload(view.professional_critique);
      break;
    case "technique_commentary":
      hasVisiblePayload = hasVisibleTechniquePayload(view.technique_commentary);
      break;
    case "timestamped_commentary": {
      hasVisiblePayload = hasVisibleTimestampedPayload(view.timestamped_commentary);
      break;
    }
    case "presentation_notes":
      hasVisiblePayload = hasPresentationPayload(view);
      break;
    case "submission_risk":
      hasVisiblePayload = hasSubmissionRiskPayload(view);
      break;
    case "limitations":
      hasVisiblePayload = arrayHasRenderableStrings(view.limitations);
      break;
    case "same_video_status":
      hasVisiblePayload =
        hasRouteVisibleComparisonDisplayMode(view.comparison_display_mode) &&
        hasVisibleSameVideoPayload(view.same_video_status);
      break;
    case "comparison_truth":
      hasVisiblePayload =
        hasRouteVisibleComparisonDisplayMode(view.comparison_display_mode) &&
        hasVisibleComparisonTruthPayload(view.comparison_truth);
      break;
    case "diagnostic_chips":
      hasVisiblePayload = arrayHasItems(view.diagnostic_chips);
      break;
    default:
      hasVisiblePayload = true;
  }
  return hasVisiblePayload ? null : `missing_visible_payload:${section}`;
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
  if (view.report_version !== S10_PERFORMER_REPORT_VIEW_MODEL_VERSION) {
    return { ok: false, reason: "s10_view_model_wrong_version" };
  }
  if (view.source_mode !== S10_REPORT_SOURCE_MODE) {
    return { ok: false, reason: "s10_view_model_wrong_source_mode" };
  }
  if (!isRecord(view.score_summary) || !Array.isArray(view.limitations)) {
    return { ok: false, reason: "s10_view_model_incomplete_shape" };
  }
  const sourceMap = asRecord(view.section_source_map);
  if (!sourceMap) return { ok: false, reason: "missing_section_source_map" };
  const requiredSections = [...S10_ROUTE_REQUIRED_SECTION_KEYS] as S10ReportSectionKey[];
  for (const section of requiredSections) {
    const entry = asRecord(sourceMap[section]);
    if (!entry) {
      return { ok: false, reason: `missing_section_source:${section}` };
    }
    const invalidSource = validateS10RouteSectionSourceEntry(section, entry);
    if (invalidSource) return { ok: false, reason: invalidSource };
    const missingPayload = validateSectionVisiblePayload(section, entry, view);
    if (missingPayload) return { ok: false, reason: missingPayload };
  }
  if (!isUsableS10PerformerReportViewModel(viewModel)) {
    return { ok: false, reason: "s10_view_model_incomplete_shape" };
  }
  const score = asNumber(asRecord(view.score_summary)?.overall_submission_readiness_score);
  const levelCalibration = asRecord(view.selected_level_calibration);
  if (
    score != null &&
    score < 90 &&
    containsProfessional90PlusClaim(levelCalibration?.score_meaning)
  ) {
    return { ok: false, reason: "s10_score_language_90_plus_contradiction" };
  }
  const json = JSON.stringify(view);
  for (const key of INTERNAL_KEYS) {
    if (json.includes(`"${key}"`)) return { ok: false, reason: `internal_key:${key}` };
  }
  return { ok: true };
}
