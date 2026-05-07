import { describe, it, expect } from "vitest";

/**
 * Phase 2 Hardening — ordinary client-shaped take payload boundary.
 *
 * `audition.$auditionId.tsx` selects `*` from `takes`, so any take row column
 * sent over PostgREST may be visible to the authenticated owner. This test
 * fails if any candidate client-shaped payload contains internal Phase 1+
 * tokens at any depth. Specifically guards `score_breakdown.future_shadow`,
 * which must NOT be used as a private storage location while `select("*")`
 * remains in place client-side.
 */

const FORBIDDEN_KEYS = [
  // Phase 0 + Phase 1 hardening forbidden tokens.
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

// Mirrors the columns the audition route currently materialises from
// `from("takes").select("*")`. Any new column the pipeline adds should also
// pass this sweep.
function representativeTakeRow() {
  return {
    id: "t1",
    audition_id: "a1",
    user_id: "u1",
    take_number: 1,
    status: "complete",
    confidence: 80,
    overall_score: 78,
    scores: {
      technical: 78,
      audio: 82,
      vocal: 75,
      acting: 80,
      brief_adherence: 88,
      professional_presentation: 85,
    },
    report: {
      schema_version: "v1-legacy",
      summary: "Strong, grounded read.",
      strengths: ["Clear intention", "Confident specificity", "Good listening"],
      improvements: ["Vary pace", "Land final consonants"],
      timestamped_notes: [{ time: "00:12", note: "Strong opening." }],
      verdict: { label: "Resubmit", confidence: 0.74 },
      scores: {
        technical: 78,
        audio: 82,
        vocal: 75,
        acting: 80,
        brief_adherence: 88,
        professional_presentation: 85,
      },
    },
    signals: { has_audio: true, has_video: true },
    checklist: {
      items: [
        { id: "framing", status: "pass" },
        { id: "audio", status: "pass" },
      ],
    },
    score_breakdown: {
      // Only the existing internal-but-non-sensitive two_step summary lives here.
      two_step: { evidence_pass_ms: 1200, polish_pass_ms: 800 },
    },
    compliance_flags: { material: "ok", presentation: "ok" },
  };
}

describe("client take-payload boundary (Phase 2 hardening)", () => {
  it("a representative client take row has no forbidden internal keys at any depth", () => {
    expect(findForbidden(representativeTakeRow())).toEqual([]);
  });

  it("synthetic future_shadow on score_breakdown is detected", () => {
    const row = representativeTakeRow() as Record<string, unknown>;
    (row.score_breakdown as Record<string, unknown>).future_shadow = {
      shadow_scores: { acting: 70 },
    };
    const hits = findForbidden(row);
    expect(hits).toContain("$.score_breakdown.future_shadow");
    expect(hits.some((h) => h.endsWith(".shadow_scores"))).toBe(true);
  });

  it("synthetic dimensions leak inside report is detected", () => {
    const row = representativeTakeRow() as Record<string, unknown>;
    (row.report as Record<string, unknown>).dimensions = { acting: { score: 80 } };
    expect(findForbidden(row)).toContain("$.report.dimensions");
  });

  it("synthetic qa_counters leak on score_breakdown is detected", () => {
    const row = representativeTakeRow() as Record<string, unknown>;
    (row.score_breakdown as Record<string, unknown>).qa_counters = { generic_praise_hits: 1 };
    expect(findForbidden(row)).toContain("$.score_breakdown.qa_counters");
  });
});
