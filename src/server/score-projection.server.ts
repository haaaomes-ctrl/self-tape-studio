// SERVER-ONLY. Δ4-S1 — single source of truth for the flat dimension-score
// projection ("L1") AND the finalising overall resolution (recompute + S10/legacy
// gating + audio cap).
//
// The performer-visible flat dimension scores (the six PUBLIC_CATEGORIES) are a
// DETERMINISTIC PROJECTION of the authoritative marked category scores ("L2"):
// `report.readiness_score_judgement.category_scores` (surfaced via the S10 view
// model as `score_summary.category_scores`). The model's own flat `scores`
// object is NOT authoritative — it arrives as a zeroed/null skeleton on every
// take and must never feed the deterministic overall.
//
// This module OWNS the single derivation so both the persistence projection
// (`v2-report-builder.server.ts`) and the finalising recompute
// (`process-take.server.ts`) consume byte-identical values. It also owns
// PUBLIC_CATEGORIES and the score clamp so there is one place to change them.
//
// Import-cycle note: this module depends ONLY on the leaf module
// `@/lib/audition-rules` (types + the pure `recomputeOverall`/`applyAudioCap`
// helpers). `v2-report-builder.server.ts` and `process-take.server.ts` import
// FROM here; nothing here imports back, so no cycle is introduced.
// `PUBLIC_CATEGORIES` is re-exported from `v2-report-builder.server.ts` so
// existing importers keep working.

import {
  applyAudioCap,
  recomputeOverall,
  type CategoryScore,
  type CategoryScores,
  type CategoryWeights,
} from "@/lib/audition-rules";

/** Fixed list mirroring the six production score fields. */
export const PUBLIC_CATEGORIES = [
  "technical",
  "audio",
  "vocal",
  "acting",
  "brief_adherence",
  "professional_presentation",
] as const;

export type PublicCategory = (typeof PUBLIC_CATEGORIES)[number];

/**
 * Clamp a raw score to an integer in [0, 100]. Returns null for non-finite /
 * non-numeric input so callers can OMIT (never invent zeros for) missing rows.
 *
 * Intentionally a DISTINCT contract from `clampScoreWithFallback` (which
 * substitutes a numeric fallback) and from the third, max-bounded `clampScore`
 * variant in s10-brief-achievement-matrix.server.ts (signature
 * `(value, max) -> [0, max]`, falling back to `max` for non-finite input).
 * Do not consolidate these — the null return here is load-bearing for the
 * projection's "omit missing" semantics, and the matrix variant's max-bounded
 * fallback is load-bearing for its own [0, max] contract.
 */
export function clampScore(value: unknown): number | null {
  const n = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (n == null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Reduce the marked L2 `category_scores` into the flat L1 dimension map,
 * restricted to PUBLIC_CATEGORIES and clamped to integers in [0, 100].
 *
 * - Only present PUBLIC_CATEGORIES keys are returned.
 * - Missing / invalid / non-finite rows (including a null `vocal`) are OMITTED,
 *   never zeroed — recompute renormalises over the present categories.
 *
 * This is the EXACT logic previously inlined in v2-report-builder.server.ts
 * (the `s10Scores` reduce), lifted here so there is a single source of truth.
 */
export function deriveDimensionScoresFromCategoryScores(
  categoryScores: ReadonlyArray<Pick<CategoryScore, "category_id" | "score">> | null | undefined,
): Record<string, number> {
  const rows = categoryScores ?? [];
  return rows.reduce<Record<string, number>>((acc, row) => {
    const score = clampScore(row.score);
    if (score != null && (PUBLIC_CATEGORIES as readonly string[]).includes(row.category_id)) {
      acc[row.category_id] = score;
    }
    return acc;
  }, {});
}

/**
 * Clamp a raw score to an integer in [0, 100], substituting `fallback` for
 * non-finite / non-numeric input. Shared by s10-readiness-score-semantics and
 * s10-report-polish-fallback (previously byte-identical local copies). DISTINCT
 * from the null-returning `clampScore` above and the max-bounded variant in
 * s10-brief-achievement-matrix.server.ts — those keep their own contracts.
 */
export function clampScoreWithFallback(value: unknown, fallback = 0): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Δ4-S1 — resolve the finalising overall score deterministically.
 *
 * Extracts the recompute + S10/legacy gating + audio cap that the finalising
 * block in process-take.server.ts previously inlined. PURE: no logging, no
 * metrics, no I/O. Side effects (the recompute-completed log, the
 * s10_deterministic_overall_missing warn + metric) stay in the pipeline, driven
 * off the returned flags.
 *
 *  - S10 path: the deterministic recompute D is the sole source of truth; the
 *    model's holistic overall A (modelOverall) is NEVER substituted. If marks
 *    were present (isS10ScorePath) yet D is 0/NaN, `deterministicMissing` flags
 *    the contract anomaly for the caller to surface.
 *  - Legacy path: recompute may legitimately be 0; modelOverall stands in.
 *  - The audio cap (applyAudioCap) is applied on BOTH paths. Absent audio
 *    (modelScores.audio == null) never caps — behaviourally identical to the
 *    prior `?? 100` default, but without the magic sentinel.
 */
export function resolveFinalisedOverall(input: {
  modelScores: Record<string, number | null>;
  weights: CategoryWeights;
  isS10ScorePath: boolean;
  modelOverall: number | null;
}): {
  overall: number;
  deterministicMissing: boolean;
  usedLegacyModel: boolean;
  audioCapApplied: boolean;
  audioCapReason?: string;
  // The renormalised weights the recompute actually used — surfaced for the
  // pipeline's score-breakdown diagnostics (previously read off `recomputed`).
  usedWeights: CategoryWeights;
} {
  const recomputed = recomputeOverall(input.modelScores as CategoryScores, input.weights);

  let base: number;
  let deterministicMissing = false;
  let usedLegacyModel = false;
  if (input.isS10ScorePath) {
    if (Number.isFinite(recomputed.overall) && recomputed.overall > 0) {
      base = recomputed.overall;
    } else {
      base = recomputed.overall || 0;
      deterministicMissing = true;
    }
  } else {
    base = recomputed.overall || input.modelOverall || 0;
    usedLegacyModel = !recomputed.overall && (input.modelOverall ?? 0) > 0;
  }

  const capped = applyAudioCap(base, input.modelScores.audio ?? null);
  return {
    overall: capped.overall,
    deterministicMissing,
    usedLegacyModel,
    audioCapApplied: capped.capped,
    audioCapReason: capped.reason,
    usedWeights: recomputed.usedWeights,
  };
}

/** Result of the Δ5-S2 per-dimension evidence-anchor orphan-check. */
export type SupportedByAnchorCheckResult = {
  /**
   * The input category scores with each `supported_by` filtered to valid
   * (guarded) Step-1 observation IDs. ONLY `supported_by` is touched — `score`
   * and every other field are preserved, so the Δ4-S1 flat-score projection
   * (which reads only `category_id`/`score`) is unaffected.
   */
  categoryScores: CategoryScore[];
  /** Total orphan IDs (citing no guarded Step-1 observation) dropped. */
  orphansDropped: number;
  /**
   * Count of NON-exempt marks (scored AND not blocked) that ended with no valid
   * anchor. Exempt = score == null OR blocked_or_not_assessable_reason set.
   */
  missingForScoredDimension: number;
  /** category_ids of the non-exempt marks flagged as missing an anchor. */
  missingCategoryIds: string[];
};

/**
 * Δ5-S2 — deterministic per-dimension evidence-anchor orphan-check.
 *
 * For each marked category score:
 *  - filter `supported_by` to IDs present in the GUARDED Step-1 observation ID
 *    set (built via `buildGuardedObservationIdSet` AFTER the integrity guard);
 *    drop any orphan (no matching observation) and count it;
 *  - a mark is EXEMPT from needing an anchor iff `score == null` OR
 *    `blocked_or_not_assessable_reason` is a non-empty string;
 *  - a NON-exempt mark whose filtered `supported_by` is empty is FLAGGED.
 *
 * PURE: no logging, metrics or I/O. The pipeline emits metrics off the returned
 * counts. Returns the cleaned category scores so persisted/derived surfaces
 * carry only valid anchors. Mutates ONLY `supported_by` — never `score` or any
 * other field — so it cannot disturb the Δ4-S1 dimension projection.
 */
export function checkSupportedByAnchors(
  categoryScores: ReadonlyArray<CategoryScore> | null | undefined,
  guardedObservationIds: ReadonlySet<string>,
): SupportedByAnchorCheckResult {
  const rows = categoryScores ?? [];
  let orphansDropped = 0;
  let missingForScoredDimension = 0;
  const missingCategoryIds: string[] = [];

  const cleaned = rows.map((row) => {
    const wasArray = Array.isArray(row.supported_by);
    const original = wasArray ? row.supported_by : [];
    const filtered = original.filter((id) => guardedObservationIds.has(id));
    orphansDropped += original.length - filtered.length;

    const exempt =
      row.score == null ||
      (typeof row.blocked_or_not_assessable_reason === "string" &&
        row.blocked_or_not_assessable_reason.trim().length > 0);
    if (!exempt && filtered.length === 0) {
      missingForScoredDimension += 1;
      missingCategoryIds.push(row.category_id);
    }

    // Touch supported_by only; preserve the row by reference when nothing
    // changed AND it was already a proper array (so the output always carries a
    // real string[]). Defensive: a row whose supported_by was absent/non-array
    // is normalised to [].
    return wasArray && filtered.length === original.length
      ? row
      : { ...row, supported_by: filtered };
  });

  return {
    categoryScores: cleaned,
    orphansDropped,
    missingForScoredDimension,
    missingCategoryIds,
  };
}
