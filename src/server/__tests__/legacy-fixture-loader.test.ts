import { describe, it, expect } from "vitest";
import { loadLegacyFixtures, type Branch } from "./fixtures";

const FORBIDDEN_KEYS = new Set([
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
]);

function findForbidden(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findForbidden(v, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) hits.push(`${path}.${k}`);
      hits.push(...findForbidden(v, `${path}.${k}`));
    }
  }
  return hits;
}

describe("legacy fixture loader", () => {
  it("returns an array when called with no branch", () => {
    expect(Array.isArray(loadLegacyFixtures())).toBe(true);
  });

  it("tolerates empty branch directories without throwing", () => {
    const empty: Branch[] = ["dance", "voice", "commercial"];
    for (const b of empty) {
      expect(() => loadLegacyFixtures(b)).not.toThrow();
      expect(Array.isArray(loadLegacyFixtures(b))).toBe(true);
    }
  });

  it("tolerates mt and acting branches (may be empty in Phase 0)", () => {
    expect(() => loadLegacyFixtures("mt")).not.toThrow();
    expect(() => loadLegacyFixtures("acting")).not.toThrow();
  });

  it("no loaded legacy fixture's expected_report contains forbidden internal keys", () => {
    const fixtures = loadLegacyFixtures();
    for (const f of fixtures) {
      const hits = findForbidden(f.expected_report);
      expect(hits, `fixture ${f.id} leaked: ${hits.join(", ")}`).toEqual([]);
    }
  });
});
