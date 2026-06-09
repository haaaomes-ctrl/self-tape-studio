import { describe, expect, it } from "vitest";
import {
  PUBLIC_CATEGORIES,
  checkSupportedByAnchors,
  clampScore,
  deriveDimensionScoresFromCategoryScores,
} from "@/server/score-projection.server";
import type { CategoryScore } from "@/lib/audition-rules";

// Minimal helper to build a marked L2 category row with sensible defaults so
// each test can vary only the field under test.
function row(partial: Partial<CategoryScore>): CategoryScore {
  return {
    category_id: "acting",
    score: 80,
    score_basis: "",
    what_works: "",
    why_not_full_score: "",
    close_gap: "",
    confidence: "medium",
    blocked_or_not_assessable_reason: null,
    supported_by: [],
    ...partial,
  } as CategoryScore;
}

describe("Δ4-S1 score-projection helper", () => {
  it("PUBLIC_CATEGORIES is the six production dimensions in order", () => {
    expect([...PUBLIC_CATEGORIES]).toEqual([
      "technical",
      "audio",
      "vocal",
      "acting",
      "brief_adherence",
      "professional_presentation",
    ]);
  });

  it("clampScore rounds and clamps to [0,100]; null for non-finite", () => {
    expect(clampScore(89.4)).toBe(89);
    expect(clampScore(89.6)).toBe(90);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(null)).toBeNull();
    expect(clampScore(undefined)).toBeNull();
    expect(clampScore(NaN)).toBeNull();
    expect(clampScore("90")).toBeNull();
  });

  it("projects marked category_scores into the flat L1 map", () => {
    const out = deriveDimensionScoresFromCategoryScores([
      row({ category_id: "acting", score: 91 }),
      row({ category_id: "vocal", score: 92 }),
      row({ category_id: "audio", score: 90 }),
      row({ category_id: "technical", score: 89 }),
      row({ category_id: "brief_adherence", score: 94 }),
      row({ category_id: "professional_presentation", score: 88 }),
    ]);
    expect(out).toEqual({
      acting: 91,
      vocal: 92,
      audio: 90,
      technical: 89,
      brief_adherence: 94,
      professional_presentation: 88,
    });
  });

  it("restricts to PUBLIC_CATEGORIES — non-public ids are omitted", () => {
    const out = deriveDimensionScoresFromCategoryScores([
      row({ category_id: "acting", score: 91 }),
      row({ category_id: "movement", score: 70 }),
      row({ category_id: "mt_package", score: 80 }),
      row({ category_id: "other", score: 60 }),
    ]);
    expect(out).toEqual({ acting: 91 });
    expect(out).not.toHaveProperty("movement");
    expect(out).not.toHaveProperty("mt_package");
    expect(out).not.toHaveProperty("other");
  });

  it("OMITS missing/invalid rows — never invents zeros", () => {
    const out = deriveDimensionScoresFromCategoryScores([
      row({ category_id: "acting", score: 91 }),
      row({ category_id: "vocal", score: null }), // nullable vocal omitted
      row({ category_id: "audio", score: NaN as unknown as number }),
      row({ category_id: "technical", score: undefined as unknown as number }),
    ]);
    expect(out).toEqual({ acting: 91 });
    // Crucially NOT zeroed.
    expect(out.vocal).toBeUndefined();
    expect(out.audio).toBeUndefined();
    expect(out.technical).toBeUndefined();
  });

  it("clamps and rounds the projected integer scores", () => {
    const out = deriveDimensionScoresFromCategoryScores([
      row({ category_id: "acting", score: 89.6 }),
      row({ category_id: "audio", score: -3 }),
      row({ category_id: "vocal", score: 130 }),
    ]);
    expect(out).toEqual({ acting: 90, audio: 0, vocal: 100 });
  });

  it("returns an empty object for null/empty input (no zeros invented)", () => {
    expect(deriveDimensionScoresFromCategoryScores(null)).toEqual({});
    expect(deriveDimensionScoresFromCategoryScores(undefined)).toEqual({});
    expect(deriveDimensionScoresFromCategoryScores([])).toEqual({});
  });

  it("the zeroed-skeleton-model case yields the real high marks (Hannah shape)", () => {
    // The model's own flat scores arrive zeroed; the marked L2 rows carry the
    // real values. Deriving from L2 gives a high, real map regardless of the
    // skeleton — the root-cause fix.
    const marked = [
      row({ category_id: "acting", score: 91 }),
      row({ category_id: "vocal", score: 92 }),
      row({ category_id: "audio", score: 90 }),
      row({ category_id: "technical", score: 89 }),
      row({ category_id: "brief_adherence", score: 94 }),
      row({ category_id: "professional_presentation", score: 88 }),
    ];
    const derived = deriveDimensionScoresFromCategoryScores(marked);
    // Every dimension is the real mark, none is 0.
    for (const value of Object.values(derived)) {
      expect(value).toBeGreaterThan(60);
    }
  });
});

describe("Δ5-S2 supported_by orphan-check (checkSupportedByAnchors)", () => {
  // Guarded Step-1 ID space (union of observed_tape_sequence[].id and
  // component_verifications[].requirement_id, post integrity guard).
  const guarded = new Set<string>(["ots-0", "ots-1", "cv-side-1", "cv-song"]);

  it("drops orphan IDs and counts them; keeps valid anchors", () => {
    const result = checkSupportedByAnchors(
      [row({ category_id: "acting", score: 80, supported_by: ["ots-0", "ghost-1", "ghost-2"] })],
      guarded,
    );
    expect(result.categoryScores[0].supported_by).toEqual(["ots-0"]);
    expect(result.orphansDropped).toBe(2);
    expect(result.missingForScoredDimension).toBe(0);
  });

  it("flags a non-exempt (scored, non-blocked) mark that ends with no valid anchor", () => {
    const result = checkSupportedByAnchors(
      [row({ category_id: "vocal", score: 72, supported_by: ["ghost-only"] })],
      guarded,
    );
    expect(result.categoryScores[0].supported_by).toEqual([]);
    expect(result.orphansDropped).toBe(1);
    expect(result.missingForScoredDimension).toBe(1);
    expect(result.missingCategoryIds).toEqual(["vocal"]);
  });

  it("does NOT flag an exempt mark with score null and empty supported_by", () => {
    const result = checkSupportedByAnchors(
      [row({ category_id: "acting", score: null, supported_by: [] })],
      guarded,
    );
    expect(result.missingForScoredDimension).toBe(0);
    expect(result.missingCategoryIds).toEqual([]);
  });

  it("does NOT flag an exempt mark with blocked_or_not_assessable_reason set and empty supported_by", () => {
    const result = checkSupportedByAnchors(
      [
        row({
          category_id: "brief_adherence",
          score: 25,
          blocked_or_not_assessable_reason: "Required Side 1 is missing.",
          supported_by: [],
        }),
      ],
      guarded,
    );
    expect(result.missingForScoredDimension).toBe(0);
  });

  it("treats whitespace-only blocked reason as NOT exempt (a scored mark needs an anchor)", () => {
    const result = checkSupportedByAnchors(
      [row({ category_id: "technical", score: 60, blocked_or_not_assessable_reason: "   " })],
      guarded,
    );
    expect(result.missingForScoredDimension).toBe(1);
  });

  it("preserves valid anchors untouched (no spurious drop, no flag)", () => {
    const result = checkSupportedByAnchors(
      [row({ category_id: "acting", score: 88, supported_by: ["ots-0", "cv-side-1"] })],
      guarded,
    );
    expect(result.categoryScores[0].supported_by).toEqual(["ots-0", "cv-side-1"]);
    expect(result.orphansDropped).toBe(0);
    expect(result.missingForScoredDimension).toBe(0);
  });

  it("canary-A 'incomplete package' shape: not-assessable dimensions yield zero missing-anchor flags", () => {
    // A blocked brief_adherence mark plus genuinely not-assessable (null) marks
    // — the S10 incomplete-package canary must produce no missing-anchor flags.
    const result = checkSupportedByAnchors(
      [
        row({
          category_id: "brief_adherence",
          score: 25,
          blocked_or_not_assessable_reason: "Mandatory Side 1 is missing.",
          supported_by: [],
        }),
        row({ category_id: "acting", score: null, supported_by: [] }),
        row({ category_id: "vocal", score: null, supported_by: [] }),
        row({ category_id: "audio", score: 86, supported_by: ["cv-song"] }),
      ],
      guarded,
    );
    expect(result.missingForScoredDimension).toBe(0);
    expect(result.orphansDropped).toBe(0);
  });

  it("round-trip: a fully-marked Hannah shape with valid anchors raises no flags and is unchanged", () => {
    const hannah: CategoryScore[] = [
      row({ category_id: "acting", score: 91, supported_by: ["ots-0"] }),
      row({ category_id: "vocal", score: 92, supported_by: ["ots-1"] }),
      row({ category_id: "audio", score: 90, supported_by: ["cv-song"] }),
      row({ category_id: "technical", score: 89, supported_by: ["ots-0", "ots-1"] }),
      row({ category_id: "brief_adherence", score: 94, supported_by: ["cv-side-1"] }),
      row({ category_id: "professional_presentation", score: 88, supported_by: ["ots-1"] }),
    ];
    const result = checkSupportedByAnchors(hannah, guarded);
    expect(result.orphansDropped).toBe(0);
    expect(result.missingForScoredDimension).toBe(0);
    // Cleaning never alters score or other fields — the Δ4-S1 projection stays
    // byte-identical whether or not the orphan-check ran.
    expect(deriveDimensionScoresFromCategoryScores(result.categoryScores)).toEqual(
      deriveDimensionScoresFromCategoryScores(hannah),
    );
    // Unchanged rows are returned by reference (no needless clone).
    expect(result.categoryScores[0]).toBe(hannah[0]);
  });

  it("handles null/empty input and a missing supported_by field defensively", () => {
    expect(checkSupportedByAnchors(null, guarded).categoryScores).toEqual([]);
    expect(checkSupportedByAnchors([], guarded).orphansDropped).toBe(0);
    // A scored row whose supported_by is absent (cast away) is treated as empty
    // -> non-exempt with no anchor -> flagged.
    const noField = { ...row({ category_id: "acting", score: 75 }) } as CategoryScore;
    delete (noField as { supported_by?: unknown }).supported_by;
    const result = checkSupportedByAnchors([noField], guarded);
    expect(result.categoryScores[0].supported_by).toEqual([]);
    expect(result.missingForScoredDimension).toBe(1);
  });
});
