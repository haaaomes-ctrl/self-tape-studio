import { describe, expect, it } from "vitest";
import {
  PUBLIC_CATEGORIES,
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
