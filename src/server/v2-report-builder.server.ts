// SERVER-ONLY. Phase 3B v2 component-report JSON builder + public boundary
// validator.
//
// Pure functions. The builder produces a `schema_version: "v2-component"`
// JSON object from an already-finalised v1 legacy report plus an OPTIONAL
// validated future-dimensions component structure. When future dimensions
// are not available, the builder falls back to legacy `detected_components`
// from the v1 report so v2 can still render in hidden production.
//
// The builder takes public `scores` verbatim from the legacy report. It does
// NOT consume or surface shadow scores, QA counters, raw evidence prose, or
// per-dimension confidences.
//
// `validateV2PublicBoundary` is the gate we run before persisting v2 to
// `takes.report` in Phase 3B. If it fails we fall back to v1.

import type { FutureDimensionsResult, FutureComponent } from "./dimensions";

/** Public structural component item. No anchors, no per-dimension claims. */
export interface V2Component {
  type: string;
  subtype: string | null;
  style: string | null;
  form: string | null;
  start: string | null;
  end: string | null;
  weight: number | null;
  score: number | null;
  note: string | null;
  assessability: FutureComponent["assessability"] | null;
}

export interface V2Report {
  schema_version: "v2-component";
  mode: "brief" | "baseline";
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
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
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

function projectFutureComponent(c: FutureComponent): V2Component {
  return {
    type: c.type,
    subtype: c.subtype ?? null,
    style: c.style ?? null,
    form: c.form ?? null,
    start: c.start,
    end: c.end,
    weight: null,
    score: null,
    note: null,
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
    subtype: null,
    style: null,
    form: null,
    start: null,
    end: null,
    weight: asNum(o.weight),
    score: asNum(o.score),
    // Public legacy notes are user-facing and safe. Cap defensively.
    note: note ? note.slice(0, 1000) : null,
    assessability: null,
  };
}

function buildComponents(args: BuildV2ReportArgs): V2Component[] {
  const future = args.futureDimensions?.components ?? [];
  if (future.length > 0) return future.map(projectFutureComponent);
  const legacy = asArray((args.legacyReport ?? {})["detected_components"]);
  return legacy
    .map(projectLegacyComponent)
    .filter((c): c is V2Component => c !== null);
}

/**
 * Pure v2 report builder. Does not mutate any input.
 */
export function buildV2Report(args: BuildV2ReportArgs): V2Report {
  const r = (args.legacyReport ?? {}) as Record<string, unknown>;

  const overall =
    asNum(r.overall_score_final) ??
    asNum(r.overall_score) ??
    asNum(r.overall_readiness);

  const headline = asStr(r.casting_headline) ?? asStr(r.headline);
  const insight = asStr(r.casting_insight) ?? asStr(r.insight);

  const verdictFromObj = asObj(r.submission_verdict);
  const verdict =
    asStr(r.verdict_final) ??
    asStr(r.verdict) ??
    (verdictFromObj ? asStr(verdictFromObj.label) : null);

  // next_take_plan precedence: explicit v2 field, then a structured legacy
  // object, then derive from `coaching_drills` so re-record steps survive.
  const drills = asArray(r.coaching_drills).filter(
    (d): d is string => typeof d === "string",
  );
  const nextPlanFromLegacy = asObj(r.next_take_plan);
  const nextTakePlan: unknown =
    nextPlanFromLegacy ??
    (drills.length > 0 ? { steps: drills } : null);

  const v2: V2Report = {
    schema_version: "v2-component",
    mode: args.mode,
    audition_type: args.auditionType ?? asStr(r.audition_type),
    headline,
    insight,
    verdict,
    overall_readiness: overall,
    scores: asScores(r.scores),
    category_notes: asCategoryNotes(r.category_notes),
    brief_adherence_breakdown: asObj(r.brief_adherence_breakdown) ?? null,
    reliability:
      asStr(r.feedback_reliability_override) ??
      asStr(r.feedback_reliability) ??
      asStr(r.reliability),
    reliability_reason:
      asStr(r.feedback_reliability_reason_code) ??
      asStr(r.confidence_reason) ??
      null,
    confidence: asNum(r.confidence),
    components: buildComponents(args),
    consistency_modifier: asNum(r.consistency_modifier),
    public_categories: PUBLIC_CATEGORIES,
    strengths: asArray(r.strengths),
    improvements: asArray(r.improvements),
    fix_first: r.fix_first ?? null,
    timestamped_notes: asArray(r.timestamped_notes),
    next_take_plan: nextTakePlan,
    risk_flags: asArray(r.submission_risk_flags ?? r.risk_flags),
    risk_explanations: asArray(r.casting_risk_explanations),
    presentation_notes: asArray(r.presentation_notes),
    block_reasons: asArray(r.block_reasons),
    at_risk: asBool(r.at_risk),
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

// ---------------------------------------------------------------------------
// Public boundary validator
// ---------------------------------------------------------------------------

/**
 * Forbidden internal/private keys at any depth in a v2 report.
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

export type V2ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateV2PublicBoundary(
  v2: unknown,
  legacyReport?: Record<string, unknown> | null,
): V2ValidationResult {
  const o = asObj(v2);
  if (!o) return { ok: false, reason: "not_object" };
  if (o.schema_version !== "v2-component")
    return { ok: false, reason: "wrong_schema_version" };

  const forbidden = findForbiddenKey(o);
  if (forbidden) return { ok: false, reason: `forbidden_key:${forbidden}` };

  // Production scores must round-trip when legacy had any.
  const legacyScores = asScores(legacyReport?.scores);
  if (legacyScores) {
    const v2scores = asScores(o.scores);
    if (!v2scores) return { ok: false, reason: "missing_scores" };
    for (const [k, v] of Object.entries(legacyScores)) {
      if (v2scores[k] !== v)
        return { ok: false, reason: `score_mismatch:${k}` };
    }
  }

  // Overall readiness must be present when legacy had any overall score.
  const legacyOverall =
    asNum(legacyReport?.overall_score_final) ??
    asNum(legacyReport?.overall_score);
  if (legacyOverall != null && asNum(o.overall_readiness) == null) {
    return { ok: false, reason: "missing_overall_readiness" };
  }

  return { ok: true };
}
