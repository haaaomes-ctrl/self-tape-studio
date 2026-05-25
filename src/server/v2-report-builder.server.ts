// SERVER-ONLY. Phase 3B/S10 v2 component-report JSON builder + route-surface
// validator.
//
// Pure functions. The builder produces a `schema_version: "v2-component"`
// JSON object from an already-finalised v1 legacy report plus an OPTIONAL
// validated future-dimensions component structure. Non-S10 legacy reports may
// still fall back to legacy `detected_components`; S10 reports never use that
// field as component authority.
//
// The builder takes public `scores` verbatim from the legacy report. It does
// NOT consume or surface shadow scores, QA counters, raw evidence prose, or
// per-dimension confidences.
//
// `validateV2PublicBoundary` is the legacy-named route-surface check we run
// before persisting v2 to `takes.report`. It is not S10 public/private payload
// gating; authenticated S10 reports use a sanitised performer view model.

import type { FutureDimensionsResult, FutureComponent } from "./dimensions";
import {
  buildS10LimitedPerformerReportViewModel,
  buildS10PerformerReportViewModel,
  hasS10AuthoritativeModules,
  S10_LIMITED_REPORT_MESSAGE,
  validateAuthenticatedS10RouteSurface,
  type S10PerformerReportViewModel,
  type S10ViewModelContext,
} from "./s10-report-view-model.server";

/** Public structural component item. No anchors, no per-dimension claims. */
export interface V2Component {
  type: string;
  component_type: string | null;
  label: string | null;
  subtype: string | null;
  style: string | null;
  form: string | null;
  start: string | null;
  end: string | null;
  weight: number | null;
  score: number | null;
  note: string | null;
  what_it_shows: string | null;
  what_is_assessable: string | null;
  key_evidence: string | null;
  score_driver: string | null;
  close_gap: string | null;
  style_or_task_confidence: "low" | "medium" | "high" | null;
  assessability: FutureComponent["assessability"] | null;
}

export interface V2SectionSourceEntry {
  source:
    | "s10_authoritative_module"
    | "s10_compatibility_projection"
    | "specific_limitation"
    | "not_applicable";
  module: string | null;
  limitation: string | null;
  source_kind?: string | null;
}

export interface V2Report {
  schema_version: "v2-component";
  mode: "brief" | "baseline";
  source_mode?: "s10_ai_report_model" | "legacy_projection";
  report_status?: "limited" | null;
  limitation_reason?: "s10_v2_build_or_validation_failed" | null;
  s10_view_model?: S10PerformerReportViewModel;
  section_source_map?: Record<string, V2SectionSourceEntry>;
  audition_type: string | null;
  headline: string | null;
  insight: string | null;
  verdict: string | null;
  overall_readiness: number | null;
  scores: Record<string, number> | null;
  category_notes: Record<string, string> | null;
  brief_adherence_breakdown: unknown;
  reliability: string | null;
  reliability_reason: string | null;
  confidence: number | null;
  components: V2Component[];
  consistency_modifier: number | null;
  public_categories: readonly string[];
  strengths: unknown[];
  improvements: unknown[];
  fix_first: unknown;
  priority_fixes: unknown[];
  category_rationale: Record<string, unknown> | null;
  timestamped_notes: unknown[];
  next_take_plan: unknown;
  risk_flags: unknown[];
  risk_explanations: unknown[];
  presentation_notes: unknown[];
  block_reasons: unknown[];
  at_risk: boolean | null;
  role_fit?: {
    notes: string | null;
    modifier: number | null;
    confidence: string | null;
  };
}

/** Fixed list mirroring existing six production score fields. */
export const PUBLIC_CATEGORIES = [
  "technical",
  "audio",
  "vocal",
  "acting",
  "brief_adherence",
  "professional_presentation",
] as const;

export interface BuildV2ReportArgs {
  legacyReport: Record<string, unknown> | null | undefined;
  futureDimensions: FutureDimensionsResult | null | undefined;
  auditionType: string | null | undefined;
  mode: "brief" | "baseline";
  s10Context?: S10ViewModelContext | null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function asScores(v: unknown): Record<string, number> | null {
  const o = asObj(v);
  if (!o) return null;
  const out: Record<string, number> = {};
  for (const key of PUBLIC_CATEGORIES) {
    const raw = o[key];
    if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
  }
  return Object.keys(out).length > 0 ? out : null;
}
function asCategoryNotes(v: unknown): Record<string, string> | null {
  const o = asObj(v);
  if (!o) return null;
  const out: Record<string, string> = {};
  for (const key of PUBLIC_CATEGORIES) {
    const raw = o[key];
    if (typeof raw === "string" && raw.trim()) out[key] = raw;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function clampScore(value: unknown): number | null {
  const n = asNum(value);
  if (n == null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function sentenceList(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const o = asObj(item);
      if (!o) return "";
      return (
        asStr(o.title) ??
        asStr(o.headline) ??
        asStr(o.detail) ??
        asStr(o.exact_action) ??
        asStr(o.recommended_action) ??
        asStr(o.point) ??
        ""
      ).trim();
    })
    .filter(Boolean)
    .slice(0, limit);
}

function asConfidence(v: unknown): "low" | "medium" | "high" | null {
  return v === "low" || v === "medium" || v === "high" ? v : null;
}

function projectFutureComponent(c: FutureComponent): V2Component {
  // FutureComponent may carry optional public-safe extras at runtime; never
  // touch private/anchor fields.
  const ex = c as unknown as Record<string, unknown>;
  return {
    type: c.type,
    component_type: c.type,
    label: asStr(ex.label),
    subtype: c.subtype ?? null,
    style: c.style ?? null,
    form: c.form ?? null,
    start: c.start,
    end: c.end,
    weight: asNum(ex.weight),
    score: asNum(ex.score),
    note: asStr(ex.note),
    what_it_shows: asStr(ex.what_it_shows),
    what_is_assessable: asStr(ex.what_is_assessable),
    key_evidence: asStr(ex.key_evidence),
    score_driver: asStr(ex.score_driver),
    close_gap: asStr(ex.close_gap),
    style_or_task_confidence:
      asConfidence(ex.style_or_task_confidence) ?? asConfidence(ex.style_confidence),
    assessability: c.assessability ?? null,
  };
}

function projectLegacyComponent(raw: unknown): V2Component | null {
  const o = asObj(raw);
  if (!o) return null;
  const type = asStr(o.type);
  if (!type) return null;
  const note = asStr(o.note);
  return {
    type,
    component_type: type,
    label: asStr(o.label),
    subtype: asStr(o.subtype),
    style: asStr(o.style),
    form: asStr(o.form),
    start: asStr(o.start),
    end: asStr(o.end),
    weight: asNum(o.weight),
    score: asNum(o.score),
    // Public legacy notes are user-facing and safe. Cap defensively.
    note: note ? note.slice(0, 1000) : null,
    what_it_shows: asStr(o.what_it_shows),
    what_is_assessable: asStr(o.what_is_assessable),
    key_evidence: asStr(o.key_evidence),
    score_driver: asStr(o.score_driver),
    close_gap: asStr(o.close_gap),
    style_or_task_confidence:
      asConfidence(o.style_or_task_confidence) ?? asConfidence(o.style_confidence),
    assessability: null,
  };
}

function buildComponents(args: BuildV2ReportArgs): V2Component[] {
  const s10View = buildS10PerformerReportViewModel({
    report: args.legacyReport,
    context: args.s10Context,
  });
  const s10Components = s10View?.component_breakdown ?? [];
  if (s10View && s10Components.length > 0) {
    const componentScores = s10View.score_summary.component_scores ?? [];
    return s10Components.map((c, index) => {
      const scoreRow = componentScores.find((row) =>
        row.linked_requirement_ids?.some((id) => c.requirement_id === id),
      );
      const label =
        c.requirement_summary ?? c.requirement_id ?? c.observed_status ?? `Component ${index + 1}`;
      return {
        type: c.requirement_summary ? label : c.observed_status,
        component_type: c.requirement_summary ?? c.observed_status,
        label,
        subtype: null,
        style: null,
        form: null,
        start: Array.isArray(c.timestamp_refs) ? (c.timestamp_refs[0] ?? null) : null,
        end: null,
        weight: null,
        score: scoreRow ? clampScore(scoreRow.score) : null,
        note: c.evidence_summary,
        what_it_shows: c.observed_from_media
          ? "Observed from submitted media."
          : "Not verified from submitted media.",
        what_is_assessable: `${c.observed_status}; ${c.completion_status}`,
        key_evidence: c.evidence_summary,
        score_driver: scoreRow?.score_basis ?? null,
        close_gap: scoreRow?.cannot_score_reason ?? null,
        style_or_task_confidence: c.confidence ?? null,
        assessability: null,
      };
    });
  }
  if (s10View) return [];
  const future = args.futureDimensions?.components ?? [];
  if (future.length > 0) return future.map(projectFutureComponent);
  const legacy = asArray((args.legacyReport ?? {})["detected_components"]);
  return legacy.map(projectLegacyComponent).filter((c): c is V2Component => c !== null);
}

/**
 * Pure v2 report builder. Does not mutate any input.
 */
export function buildV2Report(args: BuildV2ReportArgs): V2Report {
  const r = (args.legacyReport ?? {}) as Record<string, unknown>;
  const s10View = buildS10PerformerReportViewModel({
    report: r,
    context: args.s10Context,
  });
  const readiness = s10View?.recommendation ?? null;
  const scoreSummary = s10View?.score_summary ?? null;
  const hasS10BlockingDecision =
    !!readiness?.decision &&
    readiness.decision !== "submit" &&
    readiness.decision !== "submit_if_deadline_is_close";

  const overall = s10View
    ? clampScore(scoreSummary?.overall_submission_readiness_score)
    : (asNum(r.overall_score_final) ?? asNum(r.overall_score) ?? asNum(r.overall_readiness));

  const headline = s10View
    ? (readiness?.headline ?? null)
    : (asStr(r.casting_headline) ?? asStr(r.headline));
  const insight = s10View
    ? (readiness?.score_explanation ?? s10View?.brief_achievement_matrix?.summary ?? null)
    : (asStr(r.casting_insight) ?? asStr(r.insight));

  const verdictFromObj = asObj(r.submission_verdict);
  const verdict = s10View
    ? (readiness?.decision ?? null)
    : (asStr(r.verdict_final) ??
      asStr(r.verdict) ??
      (verdictFromObj ? asStr(verdictFromObj.label) : null));

  // Non-S10 next_take_plan precedence: explicit v2 field, then a structured
  // legacy object, then derive from `coaching_drills` so re-record steps
  // survive. S10 reports project only S10NextActionPlan.
  const drills = asArray(r.coaching_drills).filter((d): d is string => typeof d === "string");
  const nextPlanFromLegacy = asObj(r.next_take_plan);
  const s10NextPlan = s10View?.next_action_plan
    ? {
        steps: [
          ...s10View.next_action_plan.retake_plan,
          ...s10View.next_action_plan.playback_checks,
          ...s10View.next_action_plan.final_checks,
          ...s10View.next_action_plan.submit_checklist,
        ].filter(Boolean),
      }
    : null;
  const nextTakePlan: unknown = s10View
    ? s10NextPlan
    : (nextPlanFromLegacy ?? (drills.length > 0 ? { steps: drills } : null));

  const s10Scores =
    scoreSummary?.category_scores && scoreSummary.category_scores.length > 0
      ? scoreSummary.category_scores.reduce<Record<string, number>>((acc, row) => {
          const score = clampScore(row.score);
          if (score != null && PUBLIC_CATEGORIES.includes(row.category_id as never)) {
            acc[row.category_id] = score;
          }
          return acc;
        }, {})
      : null;
  const s10CategoryNotes =
    scoreSummary?.category_scores && scoreSummary.category_scores.length > 0
      ? scoreSummary.category_scores.reduce<Record<string, string>>((acc, row) => {
          if (PUBLIC_CATEGORIES.includes(row.category_id as never)) {
            const note = row.score_basis || row.why_not_full_score || row.close_gap;
            if (note) acc[row.category_id] = note;
          }
          return acc;
        }, {})
      : null;
  const hasS10Scores = Object.keys(s10Scores ?? {}).length > 0;
  const hasS10CategoryNotes = Object.keys(s10CategoryNotes ?? {}).length > 0;

  const s10Fixes = s10View?.fix_hierarchy
    ? [
        ...(s10View.fix_hierarchy.fix_first ? [s10View.fix_hierarchy.fix_first] : []),
        ...s10View.fix_hierarchy.must_fix_before_submitting,
        ...s10View.fix_hierarchy.should_improve_if_retaking,
        ...s10View.fix_hierarchy.optional_polish,
      ]
    : [];
  const s10PriorityFixes = s10Fixes.map((item) => ({
    headline: item.title,
    rationale: item.why_it_matters || item.evidence_summary,
    kind: item.urgency,
  }));
  const s10Strengths = s10View?.strengths_and_preserve.strengths.map((item) => {
    const o = asObj(item);
    return {
      point: asStr(o?.title) ?? asStr(o?.detail) ?? "",
      evidence: asStr(o?.evidence_summary) ?? asStr(o?.why_it_matters) ?? "",
    };
  });
  const s10Improvements = s10Fixes.map((item) => ({
    point: item.exact_action || item.title,
    evidence: item.evidence_summary || item.why_it_matters,
  }));
  const s10PresentationNotes = [
    ...sentenceList(s10View?.technique_commentary?.self_tape_presentation?.what_is_working, 6),
    ...sentenceList(s10View?.professional_critique?.professional_presentation_notes, 6),
  ].slice(0, 6);
  const s10TimestampProjection =
    s10View?.timestamped_commentary?.projection_notes.map((note) => ({
      timestamp: note.timestamp,
      note: note.note,
    })) ?? [];

  const v2: V2Report = {
    schema_version: "v2-component",
    mode: args.mode,
    ...(s10View
      ? {
          source_mode: "s10_ai_report_model" as const,
          s10_view_model: s10View,
          section_source_map: s10View.section_source_map,
        }
      : { source_mode: "legacy_projection" as const }),
    audition_type: args.auditionType ?? asStr(r.audition_type),
    headline,
    insight,
    verdict,
    overall_readiness: overall,
    scores: s10View ? (hasS10Scores ? s10Scores : null) : asScores(r.scores),
    category_notes: s10View
      ? hasS10CategoryNotes
        ? s10CategoryNotes
        : null
      : asCategoryNotes(r.category_notes),
    brief_adherence_breakdown: s10View
      ? {
          summary: s10View.brief_achievement_matrix?.summary ?? null,
          material_compliance: s10View.score_summary.brief_completion_score,
          readiness_impact: s10View.brief_achievement_matrix?.readiness_impact ?? null,
        }
      : (asObj(r.brief_adherence_breakdown) ?? null),
    reliability:
      asStr(r.feedback_reliability_override) ??
      asStr(r.feedback_reliability) ??
      asStr(r.reliability),
    reliability_reason:
      asStr(r.feedback_reliability_reason_code) ?? asStr(r.confidence_reason) ?? null,
    confidence: asNum(r.confidence),
    components: buildComponents(args),
    consistency_modifier: asNum(r.consistency_modifier),
    public_categories: PUBLIC_CATEGORIES,
    strengths: s10View
      ? s10Strengths && s10Strengths.length > 0
        ? s10Strengths
        : []
      : asArray(r.strengths),
    improvements: s10View
      ? s10Improvements.length > 0
        ? s10Improvements
        : []
      : asArray(r.improvements),
    fix_first: s10View
      ? (s10View.fix_hierarchy?.fix_first?.title ??
        s10View.fix_hierarchy?.fix_first?.exact_action ??
        null)
      : (r.fix_first ?? null),
    priority_fixes: (() => {
      if (s10View) return s10PriorityFixes;
      if (s10PriorityFixes.length > 0) return s10PriorityFixes;
      const pf = asArray(r.priority_fixes);
      if (pf.length > 0) return pf;
      const ff = asStr(r.fix_first);
      return ff ? [{ headline: ff }] : [];
    })(),
    category_rationale: s10View ? null : asObj(r.category_rationale),
    timestamped_notes: s10View ? s10TimestampProjection : asArray(r.timestamped_notes),
    next_take_plan: nextTakePlan,
    risk_flags: s10View ? [] : asArray(r.submission_risk_flags ?? r.risk_flags),
    risk_explanations: s10View ? [] : asArray(r.casting_risk_explanations),
    presentation_notes: s10View
      ? s10PresentationNotes.length > 0
        ? s10PresentationNotes
        : []
      : asArray(r.presentation_notes),
    block_reasons: s10View
      ? hasS10BlockingDecision && readiness?.rationale && readiness.rationale.length > 0
        ? readiness.rationale
        : []
      : asArray(r.block_reasons),
    at_risk: s10View ? false : asBool(r.at_risk),
  };

  if (args.mode === "brief") {
    v2.role_fit = {
      notes: asStr(r.role_fit_notes),
      modifier: asNum(r.role_fit_modifier),
      confidence: asStr(r.role_fit_confidence),
    };
  }

  return v2;
}

export function buildS10LimitedV2Report(args: {
  auditionType: string | null | undefined;
  mode: "brief" | "baseline";
  message?: string | null;
}): V2Report {
  const message = args.message ?? S10_LIMITED_REPORT_MESSAGE;
  const s10View = buildS10LimitedPerformerReportViewModel(message);
  return {
    schema_version: "v2-component",
    mode: args.mode,
    source_mode: "s10_ai_report_model",
    report_status: "limited",
    limitation_reason: "s10_v2_build_or_validation_failed",
    s10_view_model: s10View,
    section_source_map: s10View.section_source_map,
    audition_type: args.auditionType ?? null,
    headline: s10View.recommendation?.headline ?? null,
    insight: message,
    verdict: s10View.recommendation?.decision ?? null,
    overall_readiness: null,
    scores: null,
    category_notes: null,
    brief_adherence_breakdown: {
      summary: message,
      material_compliance: null,
      readiness_impact: null,
    },
    reliability: null,
    reliability_reason: null,
    confidence: null,
    components: [],
    consistency_modifier: null,
    public_categories: PUBLIC_CATEGORIES,
    strengths: [],
    improvements: [],
    fix_first: null,
    priority_fixes: [],
    category_rationale: null,
    timestamped_notes: [],
    next_take_plan: null,
    risk_flags: [],
    risk_explanations: [],
    presentation_notes: [],
    block_reasons: [message],
    at_risk: false,
  };
}

export type RouteReportPersistenceResult =
  | { outcome: "legacy_passthrough"; reportToPersist: Record<string, unknown> | null | undefined }
  | { outcome: "v2_persisted"; reportToPersist: V2Report }
  | { outcome: "s10_limited_v2_persisted"; reportToPersist: V2Report; reason: string }
  | { outcome: "s10_unrecoverable"; reportToPersist: null; reason: string };

export function buildRouteReportForPersistence(
  args: BuildV2ReportArgs & {
    futureReportEnabled: boolean;
    buildV2?: (args: BuildV2ReportArgs) => V2Report;
    validateV2?: (v2: unknown, legacyReport?: Record<string, unknown> | null) => V2ValidationResult;
  },
): RouteReportPersistenceResult {
  const hasS10ReportModel = hasS10AuthoritativeModules(args.legacyReport);
  if (!args.futureReportEnabled && !hasS10ReportModel) {
    return { outcome: "legacy_passthrough", reportToPersist: args.legacyReport };
  }

  const build = args.buildV2 ?? buildV2Report;
  const validate = args.validateV2 ?? validateV2PublicBoundary;
  try {
    const v2Candidate = build({
      legacyReport: args.legacyReport,
      futureDimensions: args.futureDimensions,
      auditionType: args.auditionType,
      mode: args.mode,
      s10Context: args.s10Context,
    });
    const check = validate(v2Candidate, args.legacyReport as Record<string, unknown> | null);
    if (check.ok) {
      return { outcome: "v2_persisted", reportToPersist: v2Candidate };
    }
    if (!hasS10ReportModel) {
      return { outcome: "legacy_passthrough", reportToPersist: args.legacyReport };
    }
    const limited = buildS10LimitedV2Report({
      auditionType: args.auditionType,
      mode: args.mode,
      message: S10_LIMITED_REPORT_MESSAGE,
    });
    const limitedCheck = validate(limited, null);
    if (limitedCheck.ok) {
      return {
        outcome: "s10_limited_v2_persisted",
        reportToPersist: limited,
        reason: check.reason,
      };
    }
    return {
      outcome: "s10_unrecoverable",
      reportToPersist: null,
      reason: `limited_v2_invalid:${limitedCheck.reason}`,
    };
  } catch (error) {
    if (!hasS10ReportModel) {
      return { outcome: "legacy_passthrough", reportToPersist: args.legacyReport };
    }
    const limited = buildS10LimitedV2Report({
      auditionType: args.auditionType,
      mode: args.mode,
      message: S10_LIMITED_REPORT_MESSAGE,
    });
    const limitedCheck = validate(limited, null);
    if (limitedCheck.ok) {
      return {
        outcome: "s10_limited_v2_persisted",
        reportToPersist: limited,
        reason: error instanceof Error ? error.message.slice(0, 200) : "build_threw",
      };
    }
    return {
      outcome: "s10_unrecoverable",
      reportToPersist: null,
      reason: `limited_v2_invalid:${limitedCheck.reason}`,
    };
  }
}

export { hasS10AuthoritativeModules };

// ---------------------------------------------------------------------------
// Authenticated route-surface validator
// ---------------------------------------------------------------------------

/**
 * Forbidden internal/diagnostic keys at any depth in a v2 report.
 *
 * Note we deliberately do NOT ban normal user-facing keys such as `note`,
 * `timestamped_notes`, `presentation_notes`, `category_notes`,
 * `brief_adherence_breakdown`, `detected_components`. Those are valid public
 * report fields.
 */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  "shadow_scores",
  "shadow_score",
  "shadow_divergence",
  "future_shadow",
  "qa_counters",
  "scrub_counters",
  "components_summary",
  "dimensions_summary",
  "dimension_traces",
  "evidence_dimensions",
  "internal_dimensions",
  "internal_qa",
  "take_qa_traces",
  "future_evidence",
  "future_dimensions",
  "future_components",
  "evidence_anchors",
  "dimension_confidence",
  "future_dimension_validation",
  "qa_trace",
  "raw_evidence",
  "hidden_reasoning",
  "supports",
  "anchor_id",
  "anchor_ids",
  "legacy_scores",
  "dimensions",
  "raw_report",
  "raw_model_response",
  "raw_prompt",
  "system_prompt",
  "model_response",
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

function findForbiddenKey(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findForbiddenKey(v);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) return k;
      const hit = findForbiddenKey(v);
      if (hit) return hit;
    }
  }
  return null;
}

export type V2ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateV2PublicBoundary(
  v2: unknown,
  legacyReport?: Record<string, unknown> | null,
): V2ValidationResult {
  const o = asObj(v2);
  if (!o) return { ok: false, reason: "not_object" };
  if (o.schema_version !== "v2-component") return { ok: false, reason: "wrong_schema_version" };

  const forbidden = findForbiddenKey(o);
  if (forbidden) return { ok: false, reason: `forbidden_key:${forbidden}` };

  if (o.s10_view_model !== undefined) {
    const s10Check = validateAuthenticatedS10RouteSurface(o.s10_view_model);
    if (!s10Check.ok) return { ok: false, reason: s10Check.reason };
  }

  // Production scores must round-trip when legacy had any.
  const s10Mode = o.source_mode === "s10_ai_report_model";
  const legacyScores = s10Mode ? null : asScores(legacyReport?.scores);
  if (legacyScores) {
    const v2scores = asScores(o.scores);
    if (!v2scores) return { ok: false, reason: "missing_scores" };
    for (const [k, v] of Object.entries(legacyScores)) {
      if (v2scores[k] !== v) return { ok: false, reason: `score_mismatch:${k}` };
    }
  }

  // Overall readiness must be present when legacy had any overall score.
  const legacyOverall = s10Mode
    ? asNum(
        (asObj(o.s10_view_model)?.score_summary as Record<string, unknown> | undefined)?.[
          "overall_submission_readiness_score"
        ],
      )
    : (asNum(legacyReport?.overall_score_final) ?? asNum(legacyReport?.overall_score));
  if (legacyOverall != null && asNum(o.overall_readiness) == null) {
    return { ok: false, reason: "missing_overall_readiness" };
  }

  return { ok: true };
}
