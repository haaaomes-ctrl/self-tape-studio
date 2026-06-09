import { describe, expect, it } from "vitest";
import { recomputeOverall, weightsForType } from "@/lib/audition-rules";
import { deriveDimensionScoresFromCategoryScores } from "@/server/score-projection.server";
import type { CategoryScore } from "@/lib/audition-rules";

// Δ4-S1 — these tests reproduce the finalising-recompute contract that
// process-take.server.ts now enforces, WITHOUT booting the full async pipeline:
//
//   1. The model's own flat `scores` arrive as a zeroed/null skeleton.
//   2. The authoritative marks live in readiness_score_judgement.category_scores.
//   3. process-take projects (2) onto report.scores via
//      deriveDimensionScoresFromCategoryScores BEFORE the recompute, so the
//      recompute, the audio cap and the persisted column all see real values.
//   4. The deterministic overall D is used directly; the model's holistic A
//      (overall_score) NEVER substitutes for D on the S10 path.

function row(category_id: CategoryScore["category_id"], score: number | null): CategoryScore {
  return {
    category_id,
    score,
    score_basis: "",
    what_works: "",
    why_not_full_score: "",
    close_gap: "",
    confidence: "high",
    blocked_or_not_assessable_reason: null,
  };
}

// The Hannah-case shape: rich, real category_scores; a zeroed model flat skeleton.
const richCategoryScores: CategoryScore[] = [
  row("acting", 91),
  row("vocal", 92),
  row("audio", 90),
  row("technical", 89),
  row("brief_adherence", 94),
  row("professional_presentation", 88),
];
const zeroedModelSkeleton = {
  technical: 0,
  audio: 0,
  vocal: null,
  acting: 0,
  brief_adherence: 0,
  professional_presentation: 0,
} as Record<string, number | null>;

// Mirror of the process-take S10 finalising-recompute block.
function finaliseOverall(input: {
  categoryScores: CategoryScore[];
  modelFlatScores: Record<string, number | null>;
  modelOverallA: number;
  auditionType: string;
}): { overall: number; usedModelFallback: boolean; audioCapApplied: boolean } {
  const weights = weightsForType(input.auditionType as never);
  const derived = deriveDimensionScoresFromCategoryScores(input.categoryScores);
  const isS10ScorePath = Object.keys(derived).length > 0;
  // §2.2: overwrite working scores with the L2 projection on the S10 path only.
  const scores = isS10ScorePath ? derived : input.modelFlatScores;
  const recomputed = recomputeOverall(scores as never, weights);

  let overall: number;
  let usedModelFallback = false;
  if (isS10ScorePath) {
    // §2.3: D used directly; A never substitutes on the S10 path.
    overall =
      Number.isFinite(recomputed.overall) && recomputed.overall > 0 ? recomputed.overall : 0;
  } else {
    overall = recomputed.overall || input.modelOverallA || 0;
    usedModelFallback = recomputed.overall === 0 && input.modelOverallA > 0;
  }

  // §2.4: audio cap reads the (now real) audio score.
  const audioScore = (scores as Record<string, number | null>).audio ?? 100;
  let audioCapApplied = false;
  if (audioScore < 35 && overall > 60) {
    overall = 60;
    audioCapApplied = true;
  } else if (audioScore < 50 && overall > 62) {
    overall = 62;
    audioCapApplied = true;
  } else if (audioScore < 60 && overall > 75) {
    overall = 75;
    audioCapApplied = true;
  }
  return { overall, usedModelFallback, audioCapApplied };
}

describe("Δ4-S1 finalising recompute consumes L2-derived flat scores", () => {
  it("Hannah case: zeroed model flat scores still yield the high deterministic D", () => {
    // Pre-fix behaviour: recompute over the zeroed skeleton is ~0, the A=60
    // model overall substituted, and the zeroed audio tripped the <35 cap → 60.
    const preFix = recomputeOverall(
      zeroedModelSkeleton as never,
      weightsForType("musical_theatre"),
    );
    expect(preFix.overall).toBe(0);

    // Post-fix: project L2 onto the working scores → high deterministic D, no
    // model fallback, no spurious audio cap.
    const result = finaliseOverall({
      categoryScores: richCategoryScores,
      modelFlatScores: zeroedModelSkeleton,
      modelOverallA: 60,
      auditionType: "musical_theatre",
    });
    expect(result.overall).toBeGreaterThan(85);
    expect(result.usedModelFallback).toBe(false);
    expect(result.audioCapApplied).toBe(false);
  });

  it("equals recomputeOverall over the L2-derived map exactly (no A substitution)", () => {
    const derived = deriveDimensionScoresFromCategoryScores(richCategoryScores);
    const expectedD = recomputeOverall(derived as never, weightsForType("musical_theatre")).overall;
    const result = finaliseOverall({
      categoryScores: richCategoryScores,
      modelFlatScores: zeroedModelSkeleton,
      modelOverallA: 60,
      auditionType: "musical_theatre",
    });
    expect(result.overall).toBe(expectedD);
  });

  it("low audio mark legitimately trips the audio cap once real audio is present", () => {
    const lowAudio = richCategoryScores.map((r) =>
      r.category_id === "audio" ? row("audio", 20) : r,
    );
    const result = finaliseOverall({
      categoryScores: lowAudio,
      modelFlatScores: zeroedModelSkeleton,
      modelOverallA: 60,
      auditionType: "musical_theatre",
    });
    expect(result.audioCapApplied).toBe(true);
    expect(result.overall).toBe(60);
  });

  it("legacy/non-S10 (no category_scores): overall unchanged; model overall stands", () => {
    // No usable per-category scores at all → recompute totalW == 0 → overall 0,
    // and audio defaults to 100 (no cap fires). This isolates the fallback path.
    const legacyFlat = {} as Record<string, number | null>;
    const result = finaliseOverall({
      categoryScores: [], // no L2 rows → not the S10 score path
      modelFlatScores: legacyFlat,
      modelOverallA: 73,
      auditionType: "acting_scene",
    });
    // With no usable category scores the recompute is 0, so the legacy overall
    // value legitimately stands — the strict no-fallback is scoped to S10 only.
    expect(result.overall).toBe(73);
    expect(result.usedModelFallback).toBe(true);
  });
});
