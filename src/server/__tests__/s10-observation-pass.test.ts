// Δ5-S1 — level-invariant Step-1 observation pass.
//
// BINDING GATE (observation invariance): for the SAME tape input, the two-step
// Step-1 evidence context assembled at two DIFFERENT performer levels must be
// BYTE-IDENTICAL. This is the precondition for per-dimension evidence anchors
// (Δ5-S2): anchors must reference level-blind located evidence, otherwise the
// same tape at two levels produces different "evidence."
//
// This is a DETERMINISTIC, code-side gate. It does NOT compare model output
// across levels (that is Δ5-S4). It proves the assembled CONTEXT we feed the
// Step-1 provider call is level-invariant.

import { describe, expect, it } from "vitest";
import {
  applyObservationIdIntegrityGuard,
  buildTwoStepEvidenceContext,
} from "@/server/s10-observation-pass.server";
import { buildS10PerformerLevelPromptBlock } from "@/lib/audition-rules";
import type { ComponentVerification, ObservedTapeSequence } from "@/server/evidence-pass.server";

// A single fixed "tape input": the discipline / brief / extracted / signals /
// tier blocks are all level-independent in the production pipeline, so the only
// thing that varies across runs of the SAME tape at different selected levels
// is the (now-removed) performer-level block.
const FIXED_BLOCKS = {
  auditionTitle: "Hannah Willars — contemporary MT side + legit song",
  disciplineBlock: "AUDITION DISCIPLINE: musical_theatre.",
  briefBlock:
    "BRIEF (supplied):\nSide 1 acting scene, one contemporary legit MT song, one continuous video.",
  extractedBlock:
    'STRUCTURED BRIEF (parsed):\n{"brief_requirements":[{"id":"req-side-1"},{"id":"req-song"}]}',
  signalsBlock:
    'TECHNICAL SIGNALS (modifiers, not primary):\n{"signals":{"audio_ok":true},"checklist":{}}',
  tier: "standard",
} as const;

describe("Δ5-S1 level-invariant Step-1 observation pass", () => {
  it("assembles a BYTE-IDENTICAL Step-1 evidence context across two different performer levels", () => {
    // Sanity: the performer-level block itself genuinely DIFFERS across levels,
    // so an identical evidence context can only mean the level is excluded.
    const learningLevelBlock = buildS10PerformerLevelPromptBlock("learning_school");
    const professionalLevelBlock = buildS10PerformerLevelPromptBlock("professional");
    expect(learningLevelBlock).not.toBe(professionalLevelBlock);

    // The same tape input, "assembled" at two different selected levels. The
    // helper takes no level input by design, so the level can never leak in.
    const contextAtLearning = buildTwoStepEvidenceContext({ ...FIXED_BLOCKS });
    const contextAtProfessional = buildTwoStepEvidenceContext({ ...FIXED_BLOCKS });

    expect(contextAtLearning).toBe(contextAtProfessional);
    // And neither context contains any performer-level framing.
    expect(contextAtLearning).not.toContain("SELECTED PERFORMER LEVEL");
    expect(contextAtLearning).not.toContain("assessment standard");
  });

  it("preserves the non-level blocks verbatim and in order (behaviour-preserving extraction)", () => {
    const context = buildTwoStepEvidenceContext({ ...FIXED_BLOCKS });
    expect(context).toBe(
      [
        `Audition title: ${FIXED_BLOCKS.auditionTitle}`,
        FIXED_BLOCKS.disciplineBlock,
        FIXED_BLOCKS.briefBlock,
        FIXED_BLOCKS.extractedBlock,
        FIXED_BLOCKS.signalsBlock,
        `Analysis tier: ${FIXED_BLOCKS.tier} rendition.`,
      ].join("\n\n"),
    );
  });
});

// ── Δ5-S1 observation-ID integrity guard ───────────────────────────────────
//
// Scaffolding for Δ5-S2 anchoring: the model-filled observation IDs must be
// non-empty and (for the sequence) unique so anchors can reference them. The
// guard rewrites ONLY blank/duplicate IDs and reports a fallback count — the
// production call site fires the s10_observation_id_guard_applied metric ONLY
// when that count is > 0.

function sequenceEntry(overrides: Partial<ObservedTapeSequence> = {}): ObservedTapeSequence {
  return {
    id: "seq-intro",
    label: "Intro / slate",
    component_type: "ident",
    linked_requirement_ids: [],
    start_time: "00:00",
    end_time: "00:05",
    present_status: "present",
    completion_status: "complete",
    evidence_summary: "Slate is present.",
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    confidence: "high",
    assessability_notes: "",
    ...overrides,
  };
}

function verification(overrides: Partial<ComponentVerification> = {}): ComponentVerification {
  return {
    requirement_id: "req-acting-scene",
    requirement_summary: "Required acting scene",
    observed_status: "present",
    completion_status: "complete",
    evidence_summary: "The acting scene is present.",
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    timestamp_refs: [],
    confidence: "high",
    cannot_infer_from_brief_only: true,
    ...overrides,
  };
}

describe("Δ5-S1 observation-ID integrity guard", () => {
  it("preserves already-valid, unique IDs unchanged and applies no fallback (no metric)", () => {
    const input = {
      observed_tape_sequence: [
        sequenceEntry({ id: "seq-intro" }),
        sequenceEntry({ id: "seq-song" }),
      ],
      component_verifications: [
        verification({ requirement_id: "req-side-1" }),
        verification({ requirement_id: "req-song" }),
      ],
    };
    const result = applyObservationIdIntegrityGuard(input);

    expect(result.fallbacks_applied).toBe(0);
    expect(result.observed_tape_sequence.map((e) => e.id)).toEqual(["seq-intro", "seq-song"]);
    expect(result.component_verifications.map((e) => e.requirement_id)).toEqual([
      "req-side-1",
      "req-song",
    ]);
    // Untouched entries are returned by reference (no needless cloning).
    expect(result.observed_tape_sequence[0]).toBe(input.observed_tape_sequence[0]);
    expect(result.component_verifications[0]).toBe(input.component_verifications[0]);
  });

  it("assigns a deterministic non-empty unique id when a sequence id is missing/empty", () => {
    const input = {
      observed_tape_sequence: [
        sequenceEntry({ id: "seq-intro" }),
        sequenceEntry({ id: "   " }), // blank/whitespace
        sequenceEntry({ id: "" }), // empty
      ],
      component_verifications: [],
    };
    const result = applyObservationIdIntegrityGuard(input);

    const ids = result.observed_tape_sequence.map((e) => e.id);
    expect(ids).toEqual(["seq-intro", "ots-1", "ots-2"]);
    expect(new Set(ids).size).toBe(ids.length); // unique
    expect(ids.every((id) => id.trim().length > 0)).toBe(true); // non-empty
    expect(result.fallbacks_applied).toBe(2);
  });

  it("de-duplicates a duplicate sequence id while preserving the first occurrence", () => {
    const input = {
      observed_tape_sequence: [
        sequenceEntry({ id: "dup" }),
        sequenceEntry({ id: "dup" }), // duplicate of index 0
        sequenceEntry({ id: "unique" }),
      ],
      component_verifications: [],
    };
    const result = applyObservationIdIntegrityGuard(input);

    const ids = result.observed_tape_sequence.map((e) => e.id);
    expect(ids[0]).toBe("dup"); // first occurrence preserved
    expect(ids[2]).toBe("unique"); // unrelated valid id preserved
    expect(new Set(ids).size).toBe(ids.length); // all unique now
    expect(ids.every((id) => id.trim().length > 0)).toBe(true);
    expect(result.fallbacks_applied).toBe(1);
  });

  it("backfills a non-empty requirement_id with cv-<index> when blank (and counts it)", () => {
    const input = {
      observed_tape_sequence: [],
      component_verifications: [
        verification({ requirement_id: "req-side-1" }),
        verification({ requirement_id: "" }), // blank
        verification({ requirement_id: "   " }), // whitespace
      ],
    };
    const result = applyObservationIdIntegrityGuard(input);

    expect(result.component_verifications.map((e) => e.requirement_id)).toEqual([
      "req-side-1",
      "cv-1",
      "cv-2",
    ]);
    expect(result.component_verifications.every((e) => e.requirement_id.trim().length > 0)).toBe(
      true,
    );
    expect(result.fallbacks_applied).toBe(2);
  });

  it("changes ONLY the IDs — every other observation field is preserved", () => {
    const original = sequenceEntry({
      id: "",
      label: "A distinctive label",
      present_status: "partially_present",
      completion_status: "cut_off",
      evidence_summary: "Specific evidence text.",
      confidence: "low",
    });
    const originalCv = verification({
      requirement_id: "",
      observed_status: "absent",
      evidence_summary: "Absent requirement text.",
    });
    const result = applyObservationIdIntegrityGuard({
      observed_tape_sequence: [original],
      component_verifications: [originalCv],
    });

    expect(result.observed_tape_sequence[0]).toEqual({ ...original, id: "ots-0" });
    expect(result.component_verifications[0]).toEqual({ ...originalCv, requirement_id: "cv-0" });
  });

  it("is idempotent: running on its own output applies zero further fallbacks (metric does not refire)", () => {
    const input = {
      observed_tape_sequence: [
        sequenceEntry({ id: "" }),
        sequenceEntry({ id: "dup" }),
        sequenceEntry({ id: "dup" }),
      ],
      component_verifications: [verification({ requirement_id: "" })],
    };
    const once = applyObservationIdIntegrityGuard(input);
    expect(once.fallbacks_applied).toBeGreaterThan(0);

    const twice = applyObservationIdIntegrityGuard({
      observed_tape_sequence: once.observed_tape_sequence,
      component_verifications: once.component_verifications,
    });
    expect(twice.fallbacks_applied).toBe(0);
    expect(twice.observed_tape_sequence.map((e) => e.id)).toEqual(
      once.observed_tape_sequence.map((e) => e.id),
    );
    expect(twice.component_verifications.map((e) => e.requirement_id)).toEqual(
      once.component_verifications.map((e) => e.requirement_id),
    );
  });
});
