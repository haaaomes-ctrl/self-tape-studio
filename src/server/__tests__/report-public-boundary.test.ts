import { describe, it, expect } from "vitest";

/**
 * R1 Public/Private boundary enforcement.
 *
 * `takes.report` is the user-facing JSON. It must NEVER carry internal
 * QA, shadow scoring, divergence, scrub counters, or dimension trace data.
 * Those fields belong in `takes.score_breakdown.future_shadow` (private)
 * or in the `take_qa_traces` table (admin-only).
 *
 * This test guards Phase 0 by asserting that representative report shapes
 * contain none of the forbidden keys at any depth.
 */

const FORBIDDEN_KEYS = [
  // Phase 0 forbidden keys.
  "shadow_scores",
  "shadow_score",
  "shadow_divergence",
  "future_shadow",
  "qa_counters",
  "scrub_counters",
  "dimensions_summary",
  "components_summary",
  "dimension_traces",
  "evidence_dimensions",
  "internal_dimensions",
  "internal_qa",
  "take_qa_traces",
  "future_evidence",
  "future_dimensions",
  "qa_trace",
  // Phase 1 closure follow-up: internal-only dimension capture tokens.
  "future_components",
  "evidence_anchors",
  "component_dimensions",
  "dimension_confidence",
  "future_dimension_validation",
  "dimensions",
] as const;

function findForbidden(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findForbidden(v, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_KEYS as readonly string[]).includes(k)) {
        hits.push(`${path}.${k}`);
      }
      hits.push(...findForbidden(v, `${path}.${k}`));
    }
  }
  return hits;
}

describe("public report boundary (R1)", () => {
  it("a representative v1 report contains no forbidden internal keys", () => {
    const report = {
      schema_version: "v1-legacy",
      summary: "Strong, grounded read.",
      strengths: ["Clear intention", "Confident specificity", "Good listening"],
      improvements: ["Vary pace in beat 2", "Land final consonants", "Settle into frame"],
      timestamped_notes: [
        { time: "00:12", note: "Strong opening eye-line." },
        { time: "00:48", note: "Pace dips—push the thought." },
      ],
      verdict: { label: "Resubmit", confidence: 0.74 },
      scores: {
        technical: 78,
        audio: 82,
        vocal: 75,
        acting: 80,
        brief_adherence: 88,
        professional_presentation: 85,
      },
    };
    expect(findForbidden(report)).toEqual([]);
  });

  it("regression guard: synthetic leak is detected", () => {
    const leaky = {
      schema_version: "v1-legacy",
      summary: "ok",
      shadow_scores: { acting: 70 },
    };
    expect(findForbidden(leaky)).toContain("$.shadow_scores");
  });

  it("nested forbidden keys are detected", () => {
    const nested = {
      summary: "ok",
      meta: { internal: { qa_trace: { hits: 1 } } },
    };
    expect(findForbidden(nested)).toContain("$.meta.internal.qa_trace");
  });
});
