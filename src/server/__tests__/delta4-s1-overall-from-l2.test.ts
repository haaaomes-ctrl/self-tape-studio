import { describe, expect, it } from "vitest";
import { applyAudioCap, recomputeOverall, weightsForType } from "@/lib/audition-rules";
import {
  deriveDimensionScoresFromCategoryScores,
  resolveFinalisedOverall,
} from "@/server/score-projection.server";
import type { CategoryScore } from "@/lib/audition-rules";

// Δ4-S1 — these tests exercise the REAL finalising-overall resolution
// (resolveFinalisedOverall) that process-take.server.ts now calls, without
// booting the full async pipeline:
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

// Mirror the process-take wiring: project L2 → flat scores, decide the S10 path,
// then call the REAL resolveFinalisedOverall the pipeline uses.
function finalise(input: {
  categoryScores: CategoryScore[];
  modelFlatScores: Record<string, number | null>;
  modelOverallA: number | null;
  auditionType: string;
}): ReturnType<typeof resolveFinalisedOverall> {
  const weights = weightsForType(input.auditionType as never);
  const derived = deriveDimensionScoresFromCategoryScores(input.categoryScores);
  const isS10ScorePath = Object.keys(derived).length > 0;
  // process-take overwrites report.scores with the L2 projection on the S10 path.
  const modelScores = isS10ScorePath ? derived : input.modelFlatScores;
  return resolveFinalisedOverall({
    modelScores,
    weights,
    isS10ScorePath,
    modelOverall: input.modelOverallA,
  });
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
    const result = finalise({
      categoryScores: richCategoryScores,
      modelFlatScores: zeroedModelSkeleton,
      modelOverallA: 60,
      auditionType: "musical_theatre",
    });
    expect(result.overall).toBeGreaterThan(85);
    expect(result.usedLegacyModel).toBe(false);
    expect(result.audioCapApplied).toBe(false);
    expect(result.deterministicMissing).toBe(false);
  });

  it("equals recomputeOverall over the L2-derived map exactly (no A substitution)", () => {
    const derived = deriveDimensionScoresFromCategoryScores(richCategoryScores);
    const expectedD = recomputeOverall(derived as never, weightsForType("musical_theatre")).overall;
    const result = finalise({
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
    const result = finalise({
      categoryScores: lowAudio,
      modelFlatScores: zeroedModelSkeleton,
      modelOverallA: 60,
      auditionType: "musical_theatre",
    });
    expect(result.audioCapApplied).toBe(true);
    expect(result.overall).toBe(60);
  });

  it("legacy/non-S10 (no category_scores): overall = model overall; usedLegacyModel true", () => {
    // No usable per-category scores at all → recompute totalW == 0 → overall 0,
    // so the legacy model overall legitimately stands. Audio is absent (null) so
    // no cap fires. This isolates the fallback path.
    const legacyFlat = {} as Record<string, number | null>;
    const result = finalise({
      categoryScores: [], // no L2 rows → not the S10 score path
      modelFlatScores: legacyFlat,
      modelOverallA: 73,
      auditionType: "acting_scene",
    });
    expect(result.overall).toBe(73);
    expect(result.usedLegacyModel).toBe(true);
    expect(result.deterministicMissing).toBe(false);
  });
});

describe("Δ4-S1 applyAudioCap tiers", () => {
  it("audio < 35 caps overall to 60 (with reason)", () => {
    const r = applyAudioCap(90, 20);
    expect(r.overall).toBe(60);
    expect(r.capped).toBe(true);
    expect(r.reason).toBe("audio is too unclear to fairly judge the performance");
  });

  it("audio in [35,50) caps overall to 62 (with reason)", () => {
    const r = applyAudioCap(90, 40);
    expect(r.overall).toBe(62);
    expect(r.capped).toBe(true);
    expect(r.reason).toBe("audio clarity needs lifting before this is sendable");
  });

  it("audio in [50,60) caps overall to 75 (with reason)", () => {
    const r = applyAudioCap(90, 55);
    expect(r.overall).toBe(75);
    expect(r.capped).toBe(true);
    expect(r.reason).toBe("audio is workable but a clearer take would land harder");
  });

  it("audio >= 60 leaves overall unchanged, uncapped", () => {
    const r = applyAudioCap(90, 80);
    expect(r.overall).toBe(90);
    expect(r.capped).toBe(false);
    expect(r.reason).toBeUndefined();
  });

  it("absent audio (null) never caps — identical to the prior `?? 100` default", () => {
    const r = applyAudioCap(90, null);
    expect(r.overall).toBe(90);
    expect(r.capped).toBe(false);
    expect(r.reason).toBeUndefined();
  });

  it("does not raise an already-low overall (only caps downward)", () => {
    // overall below the tier ceiling: the guard `overall > X` keeps it untouched.
    const r = applyAudioCap(40, 20);
    expect(r.overall).toBe(40);
    expect(r.capped).toBe(false);
  });
});
