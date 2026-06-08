import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "./s10-strong-complete-professional";

/**
 * Δ6 Repro-B — audio-capped deterministic D below a HIGH AI judgement A.
 *
 * This is the ONLY fixture that exercises the canonical-headline fix in the
 * INFLATION direction. In the strong and canary fixtures the AI judgement A is
 * *below* the deterministic value, so removing `min(.,A)` RAISES the headline.
 * Here A is high (94) while the deterministic chain is pulled DOWN to 60 by the
 * `<35` audio cap, so the canonical headline must FALL 94 → 60. Without this
 * fixture the headline fix is not demonstrated in the inflation direction
 * (see ADR-0008 addendum and arch-d6-canonical-score-computation-spec).
 *
 * Derivation from source — NOT hand-picked:
 *   scores = { acting 93, vocal 94, brief_adherence 96, technical 91, audio 30 }
 *   recomputeOverall(scores, weightsForType("musical_theatre"))           // audition-rules.ts:707
 *     = .3*93 + .3*94 + .15*96 + .15*91 + .1*30
 *     = 27.9 + 28.2 + 14.4 + 13.65 + 3.0 = 87.15 → 87
 *   audio 30 < 35 and 87 > 60 → audio cap → 60                            // process-take.server.ts:5246/:5331
 *                                                                         //   (mirrored: applyCapsAndLabel audition-rules.ts:824)
 *   complete package, no mandatory blocker → matrix cap = null           // deriveReadinessConstraint
 *   N4a (min removed): overall = 60.  Canonical D = 60.
 *   Today persisted = min(60, 94) = 60; today's report HEADLINE reads A = 94.
 *   After Δ6 every surface (headline included) reads canonical D = 60.
 *
 * The derivation is asserted live in s10-canonical-score-invariant.test.ts.
 */
export const S10_REPRO_B_AI_JUDGEMENT_A = 94;
export const S10_REPRO_B_CANONICAL_D = 60;
export const S10_REPRO_B_RECOMPUTE_PRE_CAP = 87;
export const S10_REPRO_B_AUDIO_SCORE = 30;

export function buildS10ReproBAudioCappedReportInput() {
  const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;

  // D-side: the persisted deterministic value AFTER the audio cap (= today's
  // min(60, 94) = 60). This is the canonical number every surface must show.
  report.overall_score = S10_REPRO_B_CANONICAL_D;
  report.overall_score_final = S10_REPRO_B_CANONICAL_D;

  // Poor audio capture is BOTH the cap trigger and the recompute input.
  report.scores = { ...(report.scores as Record<string, number>), audio: S10_REPRO_B_AUDIO_SCORE };

  // Δ6 Slice 2: override the inherited strong-fixture verdict. The <35 audio is a hard blocker
  // (computeBlockers audio_low), so the deterministic verdict is retake — coherent with the
  // audio-capped D=60. This makes Repro-B the inflation case on BOTH axes: A would show a high
  // score + submit; canonical shows D=60 + retake.
  report.submission_verdict = {
    label: "Not ready yet",
    reason:
      "Audio is too unclear to judge the tape fairly — re-record with clearer sound before submitting.",
    blocked: true,
    capped: true,
  };

  // The AI judgement A stays HIGH and inflated relative to the capped
  // deterministic value — this is exactly the contamination the headline fix
  // removes (the AI under-penalised the poor audio; the matrix/audio chain
  // did not).
  const readiness = report.readiness_score_judgement as Record<string, unknown>;
  readiness.overall_submission_readiness_score = S10_REPRO_B_AI_JUDGEMENT_A;
  // Keep the per-dimension audio mark consistent with the poor capture so the
  // fixture is internally honest (does not affect the Slice-1 headline number).
  if (Array.isArray(readiness.category_scores)) {
    readiness.category_scores = (readiness.category_scores as Array<Record<string, unknown>>).map(
      (row) =>
        row.category_id === "audio"
          ? {
              ...row,
              score: S10_REPRO_B_AUDIO_SCORE,
              score_basis: "Audio capture is too unclear to fairly judge across the package.",
              what_works: "",
              why_not_full_score: "Audio clarity caps the deterministic readiness value.",
            }
          : row,
    );
  }
  return report;
}

export function buildS10ReproBAudioCappedViewContext() {
  return buildS10StrongCompleteProfessionalViewContext();
}
