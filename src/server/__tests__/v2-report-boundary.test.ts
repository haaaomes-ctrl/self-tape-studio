import { describe, it, expect } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import type { FutureDimensionsResult } from "@/server/dimensions";

const FORBIDDEN = [
  "shadow_scores",
  "shadow_score",
  "shadow_divergence",
  "future_shadow",
  "qa_counters",
  "scrub_counters",
  "components_summary",
  "dimensions_summary",
  "dimension_traces",
  "evidence_dimensions",
  "internal_dimensions",
  "internal_qa",
  "take_qa_traces",
  "future_evidence",
  "future_dimensions",
  "future_components",
  "evidence_anchors",
  "dimension_confidence",
  "future_dimension_validation",
  "qa_trace",
  "legacy_scores",
];

function findForbidden(node: unknown, path: string = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(node)) {
    node.forEach((v, i) => hits.push(...findForbidden(v, `${path}[${i}]`)));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (FORBIDDEN.includes(k)) hits.push(`${path}.${k}`);
      hits.push(...findForbidden(v, `${path}.${k}`));
    }
  }
  return hits;
}

const futureDimensions: FutureDimensionsResult = {
  components: [
    {
      type: "musical_theatre",
      start: "00:00",
      end: "02:14",
      confidence: "high",
      assessability: { component_assessable: true, visibility: "high", audio_balance: "medium", evidence_density: "high" },
      subtype: "ballad",
      style: "golden_age",
      form: "32_bar",
      dimensions: { acting_through_song: { value: "present", confidence: "high", supports: ["a1"] } },
      evidence_anchors: [
        { id: "a1", kind: "timestamp", note: "lift", supports: ["acting_through_song"], timestamp: "00:42" },
      ],
    },
  ],
  dropped: 0,
  malformed: false,
};

// Even if a leaky legacy report is passed, the v2 builder must not surface
// forbidden tokens. Public scores still come from `legacyReport.scores`.
const leakyLegacy = {
  audition_type: "musical_theatre",
  scores: { technical: 70, audio: 70, vocal: 70, acting: 70, brief_adherence: 70, professional_presentation: 70 },
  shadow_scores: { acting: 80 }, // attacker leak
  qa_counters: { generic_praise_hits: 3 }, // attacker leak
  future_dimensions: { components: [] }, // attacker leak
};

describe("v2-report-boundary (Phase 3A)", () => {
  it("v2 output contains no forbidden private tokens at any depth", () => {
    const v2 = buildV2Report({ legacyReport: leakyLegacy, futureDimensions, auditionType: "musical_theatre", mode: "baseline" });
    expect(findForbidden(v2)).toEqual([]);
  });

  it("synthetic public_categories alone is not a forbidden token", () => {
    const v2 = buildV2Report({ legacyReport: leakyLegacy, futureDimensions, auditionType: "musical_theatre", mode: "baseline" });
    expect("public_categories" in v2).toBe(true);
  });

  it("a synthetic takes row carrying v2 in `report` still fails when private keys are injected", () => {
    const v2 = buildV2Report({ legacyReport: leakyLegacy, futureDimensions, auditionType: "musical_theatre", mode: "baseline" });
    const row = { id: "t1", report: v2 };
    expect(findForbidden(row)).toEqual([]);
    // Synthetic injection — proves the scanner detects leaks.
    (row.report as unknown as Record<string, unknown>).future_shadow = { shadow_scores: { acting: 80 } };
    const hits = findForbidden(row);
    expect(hits.some((h) => h.endsWith(".future_shadow"))).toBe(true);
  });
});
