import { describe, it, expect } from "vitest";
import { deriveMtShadow } from "../disciplines/mt";
import { deriveDanceShadow } from "../disciplines/dance";
import { deriveActingShadow } from "../disciplines/acting";
import { deriveVoiceShadow } from "../disciplines/voice";
import { deriveCommercialShadow } from "../disciplines/commercial";
import { resolveBranch } from "../disciplines";
import type { FutureComponent } from "../dimensions/shared";

function comp(type: string, dims: Record<string, { value: unknown; confidence?: "low" | "medium" | "high"; supports?: string[] } | null>, anchorIds: string[] = ["a1"]): FutureComponent {
  const dimensions: FutureComponent["dimensions"] = {};
  for (const [k, v] of Object.entries(dims)) {
    if (v == null) {
      dimensions[k] = null;
    } else {
      dimensions[k] = {
        value: v.value,
        confidence: v.confidence ?? "medium",
        supports: v.supports ?? anchorIds,
      };
    }
  }
  return {
    type,
    start: null,
    end: null,
    confidence: "medium",
    assessability: { component_assessable: true, visibility: "high" },
    subtype: null,
    style: null,
    form: null,
    evidence_anchors: anchorIds.map((id) => ({
      id,
      kind: "timestamp",
      note: "x",
      supports: Object.keys(dims),
      timestamp: null,
    })),
    dimensions,
  };
}

describe("discipline modules (Phase 2)", () => {
  it("MT maps acting/vocal/integration into shadow.acting + shadow.vocal", () => {
    const r = deriveMtShadow([
      comp("musical_theatre", {
        acting_through_song: { value: "lands", confidence: "high" },
        lyric_intention: { value: "specific", confidence: "high" },
        vocal_technique_serves_story: { value: "yes", confidence: "medium" },
        integration: { value: "smooth", confidence: "medium" },
      }),
    ]);
    expect(r.branch).toBe("mt");
    expect(typeof r.shadowScores.acting).toBe("number");
    expect(typeof r.shadowScores.vocal).toBe("number");
  });

  it("Dance maps movement into shadow.acting only (never vocal)", () => {
    const r = deriveDanceShadow([
      comp("dance", {
        technique_control: { value: "clean", confidence: "high" },
        rhythm_timing: { value: "on", confidence: "medium" },
      }),
    ]);
    expect(r.branch).toBe("dance");
    expect(r.shadowScores.acting).toBeDefined();
    expect(r.shadowScores.vocal).toBeUndefined();
  });

  it("Acting derives shadow.acting from objective/stakes/listening", () => {
    const r = deriveActingShadow([
      comp("acting_scene", {
        objective_action: { value: "clear", confidence: "high" },
        stakes: { value: "high", confidence: "medium" },
        listening_response: { value: "alive", confidence: "high" },
      }),
    ]);
    expect(r.shadowScores.acting).toBeDefined();
  });

  it("Voice splits technique into vocal and communication into acting", () => {
    const r = deriveVoiceShadow([
      comp("song", {
        pitch_rhythm_accuracy: { value: "good", confidence: "high" },
        tone_resonance: { value: "warm", confidence: "medium" },
        lyric_intention: { value: "specific", confidence: "high" },
      }),
    ]);
    expect(r.shadowScores.vocal).toBeDefined();
    expect(r.shadowScores.acting).toBeDefined();
  });

  it("Commercial without brief flags invention if grounding present", () => {
    const r = deriveCommercialShadow(
      [
        comp("commercial", {
          copy_handling: { value: "natural", confidence: "high" },
          product_brand_situation_grounding: { value: "specific", confidence: "high" },
        }),
      ],
      false,
    );
    expect(r.warnings).toContain("commercial_no_brief_invention_risk");
  });

  it("Empty / missing-anchor components produce no shadow score", () => {
    const r = deriveMtShadow([comp("musical_theatre", {}, [])]);
    expect(r.shadowScores.acting).toBeUndefined();
    expect(r.shadowScores.vocal).toBeUndefined();
  });

  it("resolveBranch dispatches by audition type and component shape", () => {
    expect(resolveBranch("musical_theatre", [])).toBe("mt");
    expect(resolveBranch("dance", [])).toBe("dance");
    expect(resolveBranch("commercial", [])).toBe("commercial");
    expect(resolveBranch("song", [])).toBe("voice");
    expect(resolveBranch("monologue", [])).toBe("acting");
    expect(resolveBranch("unknown", [comp("dance", {})])).toBe("dance");
  });
});
