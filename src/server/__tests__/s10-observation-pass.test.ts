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
import { buildTwoStepEvidenceContext } from "@/server/s10-observation-pass.server";
import { buildS10PerformerLevelPromptBlock } from "@/lib/audition-rules";

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
