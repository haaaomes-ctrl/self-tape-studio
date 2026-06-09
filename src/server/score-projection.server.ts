// SERVER-ONLY. Δ4-S1 — single source of truth for the flat dimension-score
// projection ("L1").
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
// Import-cycle note: this module depends ONLY on the leaf type module
// `@/lib/audition-rules` (type-only import). `v2-report-builder.server.ts` and
// `process-take.server.ts` import FROM here; nothing here imports back, so no
// cycle is introduced. `PUBLIC_CATEGORIES` is re-exported from
// `v2-report-builder.server.ts` so existing importers keep working.

import type { CategoryScore } from "@/lib/audition-rules";

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
