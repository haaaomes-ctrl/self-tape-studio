// SERVER-ONLY. Phase 2 internal discipline rule helpers.
//
// Pure, deterministic helpers used by per-discipline shadow derivation and
// QA-counter probes. Nothing here is rendered or persisted to public surfaces.

import type {
  DimensionClaim,
  DimensionConfidence,
  FutureComponent,
} from "../dimensions/shared";

export type LegacyScoreField =
  | "technical"
  | "audio"
  | "vocal"
  | "acting"
  | "brief_adherence"
  | "professional_presentation";

export const LEGACY_SCORE_FIELDS: readonly LegacyScoreField[] = [
  "technical",
  "audio",
  "vocal",
  "acting",
  "brief_adherence",
  "professional_presentation",
];

export type ShadowScores = Partial<Record<LegacyScoreField, number>>;
export type DensityLabel = "low" | "medium" | "high";

export interface QaCounters {
  generic_praise_hits: number;
  timestamp_underproduction: number;
  timestamp_component_imbalance: number;
  no_brief_invention: number;
  role_fit_overclaim: number;
  castability_overclaim: number;
  marketability_or_look_hit: number;
  live_room_overclaim: number;
  frame_break_coaching: number;
  presentation_polish_drift: number;
  access_deficit_risk: number;
  speech_accent_voice_deficit_risk: number;
  vocal_health_diagnosis_risk: number;
  resource_merit_drift: number;
  field_label_leakage_risk: number;
  dimension_density_low: number;
  malformed_dimension_drop_count: number;
}

export function emptyCounters(): QaCounters {
  return {
    generic_praise_hits: 0,
    timestamp_underproduction: 0,
    timestamp_component_imbalance: 0,
    no_brief_invention: 0,
    role_fit_overclaim: 0,
    castability_overclaim: 0,
    marketability_or_look_hit: 0,
    live_room_overclaim: 0,
    frame_break_coaching: 0,
    presentation_polish_drift: 0,
    access_deficit_risk: 0,
    speech_accent_voice_deficit_risk: 0,
    vocal_health_diagnosis_risk: 0,
    resource_merit_drift: 0,
    field_label_leakage_risk: 0,
    dimension_density_low: 0,
    malformed_dimension_drop_count: 0,
  };
}

export function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

const CONF_VALUE: Record<DimensionConfidence, number> = {
  low: 55,
  medium: 72,
  high: 86,
};

export function claimToScore(claim: DimensionClaim | null | undefined): number | null {
  if (!claim || claim.value == null) return null;
  if (claim.supports.length === 0) return null;
  return CONF_VALUE[claim.confidence];
}

/** Mean of populated dimension scores; returns null when no anchored data. */
export function meanOfDimensions(
  comp: FutureComponent | undefined | null,
  keys: readonly string[],
): number | null {
  if (!comp) return null;
  const vals: number[] = [];
  for (const k of keys) {
    const s = claimToScore(comp.dimensions[k]);
    if (s != null) vals.push(s);
  }
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function densityFromComponent(comp: FutureComponent | undefined | null): DensityLabel {
  if (!comp) return "low";
  const total = Object.keys(comp.dimensions).length || 1;
  const populated = Object.values(comp.dimensions).filter(
    (c) => c && c.value != null && c.supports.length > 0,
  ).length;
  const ratio = populated / total;
  if (ratio >= 0.6) return "high";
  if (ratio >= 0.3) return "medium";
  return "low";
}

export function findComponent(
  comps: readonly FutureComponent[],
  ...types: string[]
): FutureComponent | undefined {
  return comps.find((c) => types.includes(c.type));
}

const GENERIC_TERMS = [
  "great presence",
  "lovely energy",
  "strong presence",
  "natural",
  "confident throughout",
  "good energy",
  "great vibes",
  "vocally secure",
  "beautiful tone",
  "great range",
  "strong vocals",
  "amazing voice",
];

export function countGenericPraise(text: string | undefined | null): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let n = 0;
  for (const t of GENERIC_TERMS) if (lower.includes(t)) n += 1;
  return n;
}

const ROLE_FIT_OVERCLAIM_TERMS = [
  "highly castable",
  "would get a recall",
  "callback-ready",
  "perfect fit",
  "exactly what they're looking for",
  "exactly what they are looking for",
  "strong contender",
];
const CASTABILITY_TERMS = ["castable", "bookable", "buyer fit"];
const MARKETABILITY_TERMS = [
  "marketable",
  "commercial look",
  "softer makeup",
  "brighter top",
  "appearance",
  "social profile",
];
const LIVE_ROOM_TERMS = [
  "in the room",
  "live room",
  "stamina",
  "pickup",
  "redirect on the day",
];
const FRAME_BREAK_TERMS = [
  "walk around the room",
  "use a prop",
  "hold the script",
  "step out of frame",
  "stand up",
  "move around",
];
const VOCAL_HEALTH_TERMS = ["vocal health", "nodules", "strain damage", "hoarse from"];
const RESOURCE_DRIFT_TERMS = [
  "studio capture",
  "paid accompanist",
  "professional accompaniment",
  "ring light",
  "boom mic",
];
const ACCESS_DEFICIT_TERMS = [
  "lack of resources",
  "needs better lighting",
  "needs better mic",
  "should invest in",
];
const SPEECH_DEFICIT_TERMS = [
  "accent is distracting",
  "speech impediment",
  "trans voice",
  "non-binary voice",
];

function countTerms(text: string | undefined | null, terms: readonly string[]): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let n = 0;
  for (const t of terms) if (lower.includes(t)) n += 1;
  return n;
}

export function countRoleFitOverclaim(text: string | undefined | null): number {
  return countTerms(text, ROLE_FIT_OVERCLAIM_TERMS);
}
export function countCastability(text: string | undefined | null): number {
  return countTerms(text, CASTABILITY_TERMS);
}
export function countMarketability(text: string | undefined | null): number {
  return countTerms(text, MARKETABILITY_TERMS);
}
export function countLiveRoom(text: string | undefined | null): number {
  return countTerms(text, LIVE_ROOM_TERMS);
}
export function countFrameBreak(text: string | undefined | null): number {
  return countTerms(text, FRAME_BREAK_TERMS);
}
export function countVocalHealth(text: string | undefined | null): number {
  return countTerms(text, VOCAL_HEALTH_TERMS);
}
export function countResourceDrift(text: string | undefined | null): number {
  return countTerms(text, RESOURCE_DRIFT_TERMS);
}
export function countAccessDeficit(text: string | undefined | null): number {
  return countTerms(text, ACCESS_DEFICIT_TERMS);
}
export function countSpeechDeficit(text: string | undefined | null): number {
  return countTerms(text, SPEECH_DEFICIT_TERMS);
}

export interface DisciplineShadowResult {
  branch: string;
  shadowScores: ShadowScores;
  density: Record<string, DensityLabel>;
  warnings: string[];
}
