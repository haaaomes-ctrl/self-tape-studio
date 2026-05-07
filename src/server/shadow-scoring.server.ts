// SERVER-ONLY. Phase 2 shadow scoring.
//
// Pure, in-memory dimension-derived shadow score computation. Output is
// PRIVATE: never returned from any user-facing surface, never written to
// `takes.report` or `takes.score_breakdown`. May be optionally persisted into
// `take_qa_traces` (RLS deny-all) when `future_qa_trace_enabled` is true.

import type { EvidencePass } from "./evidence-pass.server";
import type { FutureDimensionsResult } from "./dimensions";
import type { FutureComponent } from "./dimensions/shared";
import {
  deriveShadowForBranch,
  resolveBranch,
  type Branch,
} from "./disciplines";
import {
  countAccessDeficit,
  countCastability,
  countFrameBreak,
  countGenericPraise,
  countLiveRoom,
  countMarketability,
  countResourceDrift,
  countRoleFitOverclaim,
  countSpeechDeficit,
  countVocalHealth,
  densityFromComponent,
  emptyCounters,
  LEGACY_SCORE_FIELDS,
  type DensityLabel,
  type LegacyScoreField,
  type QaCounters,
  type ShadowScores,
} from "./disciplines/shared";

export const SHADOW_SCHEMA_VERSION = "shadow-v1" as const;

export interface FutureShadowResult {
  shadow_schema_version: typeof SHADOW_SCHEMA_VERSION;
  branch: Branch;
  components_summary: Array<{
    type: string;
    confidence: string;
    assessable: boolean;
  }>;
  dimensions_summary: Record<
    string,
    { populated: number; null_or_unknown: number; total: number }
  >;
  shadow_scores: ShadowScores;
  shadow_divergence: ShadowScores;
  evidence_density: Record<string, DensityLabel>;
  sufficiency: EvidencePass["evidence_sufficiency"];
  qa_counters: QaCounters;
  warnings: string[];
}

function summariseComponents(comps: readonly FutureComponent[]) {
  return comps.map((c) => ({
    type: c.type,
    confidence: c.confidence,
    assessable: c.assessability?.component_assessable !== false,
  }));
}

function summariseDimensions(comps: readonly FutureComponent[]) {
  const out: FutureShadowResult["dimensions_summary"] = {};
  for (const c of comps) {
    const total = Object.keys(c.dimensions).length;
    let populated = 0;
    for (const claim of Object.values(c.dimensions)) {
      if (claim && claim.value != null && claim.supports.length > 0) populated += 1;
    }
    out[c.type] = {
      populated,
      null_or_unknown: total - populated,
      total,
    };
  }
  return out;
}

export interface ComputeFutureShadowArgs {
  futureDimensions: FutureDimensionsResult;
  evidence: EvidencePass;
  auditionType: string;
  durationSeconds: number | null;
  mode: "brief" | "baseline";
  reportText?: string;
}

export function computeFutureShadow(
  args: ComputeFutureShadowArgs,
): FutureShadowResult {
  const comps = args.futureDimensions.components;
  const branch = resolveBranch(args.auditionType, comps);
  const hasBrief = args.mode === "brief";
  const disc = deriveShadowForBranch(branch, comps, hasBrief);

  // Divergence = shadow - legacy. Legacy values come from raw_scores. Read
  // only — never mutate the input EvidencePass.
  const legacy = args.evidence.raw_scores;
  const divergence: ShadowScores = {};
  for (const f of LEGACY_SCORE_FIELDS) {
    const s = disc.shadowScores[f];
    const l = (legacy as Record<string, number | null>)[f];
    if (s != null && typeof l === "number") {
      divergence[f] = s - l;
    }
  }

  // QA counters — language-pattern probes over evidence prose plus structural
  // checks. Counters are diagnostic only; they never block or rewrite output.
  const counters = emptyCounters();
  if (args.futureDimensions.dropped > 0) {
    counters.malformed_dimension_drop_count += args.futureDimensions.dropped;
  }

  const proseBuckets: string[] = [
    args.evidence.fix_first_evidence ?? "",
    args.evidence.role_fit_evidence ?? "",
    ...(args.evidence.presentation_evidence ?? []),
    ...args.evidence.core_strengths_evidence.map((e) => e.evidence ?? ""),
    ...args.evidence.core_improvements_evidence.map((e) => e.evidence ?? ""),
    ...Object.values(args.evidence.category_notes_evidence ?? {}),
    args.reportText ?? "",
  ];
  const prose = proseBuckets.join(" \n ");

  counters.generic_praise_hits += countGenericPraise(prose);
  counters.role_fit_overclaim += countRoleFitOverclaim(prose);
  counters.castability_overclaim += countCastability(prose);
  counters.marketability_or_look_hit += countMarketability(prose);
  counters.live_room_overclaim += countLiveRoom(prose);
  counters.frame_break_coaching += countFrameBreak(prose);
  if (counters.marketability_or_look_hit > 0) {
    counters.presentation_polish_drift += counters.marketability_or_look_hit;
  }
  counters.vocal_health_diagnosis_risk += countVocalHealth(prose);
  counters.resource_merit_drift += countResourceDrift(prose);
  counters.access_deficit_risk += countAccessDeficit(prose);
  counters.speech_accent_voice_deficit_risk += countSpeechDeficit(prose);

  // Timestamp underproduction: ≥3min tape with <5 timestamps when assessable.
  const tsCount = args.evidence.timestamped_evidence?.length ?? 0;
  const dur = args.durationSeconds ?? 0;
  const assessable =
    args.evidence.evidence_sufficiency?.video_assessable !== false &&
    args.evidence.evidence_sufficiency?.audio_assessable !== false;
  if (assessable && dur >= 180 && tsCount < 5) {
    counters.timestamp_underproduction += 1;
  }

  // Component imbalance — multi-component but timestamps clustered to one.
  if (comps.length >= 2 && tsCount > 0) {
    const linked = new Set(
      args.evidence.timestamped_evidence.map((t) => t.linked_category),
    );
    if (linked.size <= 1) counters.timestamp_component_imbalance += 1;
  }

  // No-brief invention warning fires from discipline derivation.
  if (disc.warnings.includes("commercial_no_brief_invention_risk")) {
    counters.no_brief_invention += 1;
  }

  // Density rollup — any low-density component bumps the counter.
  const density: Record<string, DensityLabel> = { ...disc.density };
  for (const c of comps) {
    const d = densityFromComponent(c);
    density[c.type] = d;
    if (d === "low") counters.dimension_density_low += 1;
  }

  return {
    shadow_schema_version: SHADOW_SCHEMA_VERSION,
    branch,
    components_summary: summariseComponents(comps),
    dimensions_summary: summariseDimensions(comps),
    shadow_scores: disc.shadowScores,
    shadow_divergence: divergence,
    evidence_density: density,
    sufficiency: args.evidence.evidence_sufficiency,
    qa_counters: counters,
    warnings: disc.warnings,
  };
}

/** Strip everything except structural counts/summaries. Defensive. */
export function toQaTracePayload(s: FutureShadowResult): {
  schema_version: string;
  branch: string;
  components_summary: FutureShadowResult["components_summary"];
  dimensions_summary: FutureShadowResult["dimensions_summary"];
  sufficiency: FutureShadowResult["sufficiency"];
  scrub_counters: QaCounters;
  shadow_divergence: ShadowScores;
} {
  return {
    schema_version: s.shadow_schema_version,
    branch: s.branch,
    components_summary: s.components_summary,
    dimensions_summary: s.dimensions_summary,
    sufficiency: s.sufficiency,
    scrub_counters: s.qa_counters,
    shadow_divergence: s.shadow_divergence,
  };
}

export type { LegacyScoreField, ShadowScores, QaCounters };
