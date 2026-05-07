// SERVER-ONLY. Phase 3A v2 component-report JSON builder (dark-launch only).
//
// Pure function. Produces a `schema_version: "v2-component"` JSON object from
// an already-finalised v1 legacy report plus the validated future-dimensions
// component structure. Used in dark launch only — must NEVER be persisted to
// `takes.report`, `takes.score_breakdown`, or any client-visible payload in
// Phase 3A. Phase 3B will introduce the renderer branch and a staged
// persistence gate.
//
// The builder takes public `scores` verbatim from the legacy report. It does
// NOT consume or surface shadow scores, QA counters, raw evidence prose, or
// per-dimension confidences.

import type { FutureDimensionsResult, FutureComponent } from "./dimensions";

/** Public structural component item. No anchors, no per-dimension claims. */
export interface V2Component {
  type: string;
  subtype: string | null;
  style: string | null;
  form: string | null;
  start: string | null;
  end: string | null;
  assessability: FutureComponent["assessability"];
}

export interface V2Report {
  schema_version: "v2-component";
  mode: "brief" | "baseline";
  audition_type: string | null;
  headline: string | null;
  verdict: string | null;
  overall_readiness: number | null;
  scores: Record<string, number> | null;
  reliability: string | null;
  confidence: number | null;
  components: V2Component[];
  public_categories: readonly string[];
  strengths: unknown[];
  improvements: unknown[];
  fix_first: unknown;
  timestamped_notes: unknown[];
  next_take_plan: unknown;
  risk_flags: unknown[];
  presentation_notes: unknown;
  role_fit?: unknown;
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
  /** Final v1 report object that is (or would be) persisted to `takes.report`. */
  legacyReport: Record<string, unknown> | null | undefined;
  /** Validated future dimensions (Phase 1 output). May be null when flag off. */
  futureDimensions: FutureDimensionsResult | null | undefined;
  /** Audition type from the evidence pass / production scoring. */
  auditionType: string | null | undefined;
  /** "brief" or "baseline" — server-known truth, not from the model. */
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

function asScores(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object") return null;
  const out: Record<string, number> = {};
  for (const key of PUBLIC_CATEGORIES) {
    const raw = (v as Record<string, unknown>)[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function projectComponent(c: FutureComponent): V2Component {
  return {
    type: c.type,
    subtype: c.subtype ?? null,
    style: c.style ?? null,
    form: c.form ?? null,
    start: c.start,
    end: c.end,
    assessability: c.assessability,
  };
}

/**
 * Pure v2 report builder. Does not mutate any input.
 *
 * Privacy contract:
 *   - never reads from shadow scores, QA counters or evidence prose;
 *   - never surfaces `evidence_anchors`, `dimensions`, `dimension_confidence`,
 *     `future_*`, `internal_*`, `qa_*`, `scrub_counters`, `components_summary`,
 *     `dimensions_summary` or `take_qa_traces`.
 */
export function buildV2Report(args: BuildV2ReportArgs): V2Report {
  const r = (args.legacyReport ?? {}) as Record<string, unknown>;
  const overall =
    asNum(r.overall_score_final) ??
    asNum(r.overall_score) ??
    asNum(r.overall_readiness);

  const components: V2Component[] = (args.futureDimensions?.components ?? []).map(
    projectComponent,
  );

  const v2: V2Report = {
    schema_version: "v2-component",
    mode: args.mode,
    audition_type: args.auditionType ?? asStr(r.audition_type),
    headline: asStr(r.headline),
    verdict: asStr(r.verdict),
    overall_readiness: overall,
    scores: asScores(r.scores),
    reliability:
      asStr(r.feedback_reliability) ?? asStr(r.reliability),
    confidence: asNum(r.confidence),
    components,
    public_categories: PUBLIC_CATEGORIES,
    strengths: asArray(r.strengths),
    improvements: asArray(r.improvements),
    fix_first: r.fix_first ?? null,
    timestamped_notes: asArray(r.timestamped_notes),
    next_take_plan: r.next_take_plan ?? null,
    risk_flags: asArray(r.risk_flags),
    presentation_notes: r.presentation_notes ?? null,
  };

  if (args.mode === "brief" && r.role_fit !== undefined) {
    v2.role_fit = r.role_fit;
  }

  return v2;
}
