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
//   2. applyObservationIdIntegrityGuard — guarantees the EXISTING model-filled
//      observation IDs (observed_tape_sequence[].id,
//      component_verifications[].requirement_id) are non-empty and (for the
//      sequence) unique, assigning deterministic fallbacks for blank/duplicate
//      values. This is scaffolding for Δ5-S2 anchoring, which references these
//      IDs. It is pure and changes ONLY blank/duplicate IDs — never a mark,
//      verdict, score, or any other observation content.
//
// Pure, deterministic, no I/O.

import type { ComponentVerification, ObservedTapeSequence } from "./evidence-pass.server";

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

/** The arrays the integrity guard reads and (only on blank/duplicate IDs) rewrites. */
export type ObservationIdGuardInput = {
  observed_tape_sequence: ObservedTapeSequence[];
  component_verifications: ComponentVerification[];
};

export type ObservationIdGuardResult = {
  observed_tape_sequence: ObservedTapeSequence[];
  component_verifications: ComponentVerification[];
  /** Number of IDs that were blank/duplicate and received a deterministic fallback. */
  fallbacks_applied: number;
};

function isNonEmptyId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Pick a unique id for a sequence entry: keep the original when it is a
 * non-empty string not already taken; otherwise assign the deterministic
 * `ots-<index>` (0-based). If that fallback slug is itself already taken
 * (a real id earlier in the array literally equalled it), append `-<index>`
 * suffixes until free so the result is always unique and deterministic.
 */
function resolveUniqueSequenceId(original: unknown, index: number, used: Set<string>): string {
  if (isNonEmptyId(original) && !used.has(original)) return original;
  let candidate = `ots-${index}`;
  let suffix = index;
  while (used.has(candidate)) {
    candidate = `ots-${index}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Deterministic observation-ID integrity guard (Δ5-S1 scaffolding for Δ5-S2
 * anchoring). The model fills `observed_tape_sequence[].id` and
 * `component_verifications[].requirement_id`, but they can arrive blank or
 * duplicated. After this guard:
 *   - every observed_tape_sequence[].id is non-empty and unique (blank/dup ->
 *     deterministic `ots-<index>`, 0-based);
 *   - every component_verifications[].requirement_id is non-empty (blank ->
 *     `cv-<index>`, 0-based);
 *   - already-valid, unique IDs are preserved byte-for-byte.
 *
 * Pure and idempotent: running it on its own output applies zero further
 * fallbacks. It mutates ONLY the id / requirement_id fields — never a mark,
 * verdict, score, status, or any other observation content. Returns the count
 * of fallbacks applied so the caller can emit a metric only when > 0.
 */
export function applyObservationIdIntegrityGuard(
  input: ObservationIdGuardInput,
): ObservationIdGuardResult {
  let fallbacks = 0;

  const usedSequenceIds = new Set<string>();
  const observed_tape_sequence = input.observed_tape_sequence.map((entry, index) => {
    const resolvedId = resolveUniqueSequenceId(entry.id, index, usedSequenceIds);
    usedSequenceIds.add(resolvedId);
    if (resolvedId !== entry.id) {
      fallbacks += 1;
      return { ...entry, id: resolvedId };
    }
    return entry;
  });

  const component_verifications = input.component_verifications.map((entry, index) => {
    if (isNonEmptyId(entry.requirement_id)) return entry;
    fallbacks += 1;
    return { ...entry, requirement_id: `cv-${index}` };
  });

  return { observed_tape_sequence, component_verifications, fallbacks_applied: fallbacks };
}
