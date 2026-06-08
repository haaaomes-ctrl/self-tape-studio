// SERVER-ONLY (worker-shared, TanStack-free). Δ5-S1 observation-pass helpers.
//
// Δ5 makes Step 1 a pure, LEVEL-BLIND observation pass: the model LOCATES what
// is on the tape, and only Step 2 MARKS dimensions against the performer level.
// (Plan of record: knowledge/20-decisions-context/plan-d5-evidence-anchors.md
// §6 slice S1; design decision D5.3.)
//
// This module holds the deterministic, dependency-light pieces of that pass so
// they are unit-testable without instantiating the full pipeline:
//
//   1. buildTwoStepEvidenceContext — assembles the Step-1 evidence-pass context
//      string from already-built prompt blocks. It deliberately does NOT accept
//      a performer-level block, so the assembled context is invariant to the
//      selected level by construction (the observation-invariance gate).
//
// Pure, deterministic, no I/O.

/**
 * Inputs to the Step-1 (two-step evidence/observation) context assembly.
 *
 * These are the same already-built blocks the single-pass `userText` uses,
 * MINUS the performer-level block: Step 1 must be level-blind so that the same
 * tape yields the same located evidence regardless of the selected level. Level
 * enters only at Step-2 marking.
 */
export type TwoStepEvidenceContextBlocks = {
  auditionTitle: string;
  disciplineBlock: string;
  briefBlock: string;
  extractedBlock: string;
  signalsBlock: string;
  tier: string;
};

/**
 * Assemble the Step-1 evidence-pass context string.
 *
 * Behaviour-preserving extraction of the previous inline `evidenceContext`
 * array in process-take.server.ts, with the performer-level block removed
 * (Δ5-S1 / D5.3). The output is byte-identical to the prior production string
 * minus the `levelBlock` entry, and is invariant to the selected performer
 * level because no level input is accepted.
 */
export function buildTwoStepEvidenceContext(blocks: TwoStepEvidenceContextBlocks): string {
  return [
    `Audition title: ${blocks.auditionTitle}`,
    blocks.disciplineBlock,
    blocks.briefBlock,
    blocks.extractedBlock,
    blocks.signalsBlock,
    `Analysis tier: ${blocks.tier} rendition.`,
  ].join("\n\n");
}
