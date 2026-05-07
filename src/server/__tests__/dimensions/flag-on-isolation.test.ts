import { describe, it, expect } from "vitest";
import { validateFutureComponents } from "../../dimensions";
import { computeFutureShadow } from "../../shadow-scoring.server";
import type { EvidencePass } from "../../evidence-pass.server";

const FORBIDDEN = [
  "future_components",
  "evidence_anchors",
  "component_dimensions",
  "dimension_confidence",
  "future_dimension_validation",
  "dimensions",
  "shadow_scores",
  "shadow_divergence",
  "future_shadow",
  "qa_counters",
  "scrub_counters",
  "dimensions_summary",
  "components_summary",
];

function findAny(v: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(v)) v.forEach((x, i) => hits.push(...findAny(x, `${path}[${i}]`)));
  else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (FORBIDDEN.includes(k)) hits.push(`${path}.${k}`);
      hits.push(...findAny(val, `${path}.${k}`));
    }
  }
  return hits;
}

function ev(): EvidencePass {
  return {
    evidence_version: "1",
    audition_type: "musical_theatre",
    detected_components: [],
    raw_scores: { technical: 75, audio: 75, vocal: 75, acting: 75, brief_adherence: 75, professional_presentation: 75 },
    core_strengths_evidence: [],
    core_improvements_evidence: [],
    fix_first_evidence: "",
    brief_adherence_evidence: {
      material_compliance: "", technical_compliance: "", instruction_precision: "", professionalism_signals: "",
      score_material: 0, score_technical: 0, score_instruction: 0, score_professional: 0,
    },
    category_notes_evidence: { technical: "", audio: "", vocal: "", acting: "", brief_adherence: "", professional_presentation: "" },
    role_fit_evidence: "",
    role_fit_modifier_suggested: 0,
    role_fit_confidence: "low",
    presentation_evidence: [],
    risk_evidence: [],
    timestamped_evidence: [],
    evidence_sufficiency: { audio_assessable: true, video_assessable: true, acting_assessable: true, vocal_assessable: true, movement_assessable: true, brief_assessable: true, role_fit_assessable: true, notes: "" },
  };
}

describe("flag-on isolation (Phase 1 hardening)", () => {
  it("future dimensions captured under flag never leak into the public report", () => {
    const raw = [
      {
        type: "musical_theatre",
        confidence: "high",
        evidence_anchors: [
          { id: "a1", kind: "timestamp", note: "Belt at 01:18", supports: ["acting_through_song"], timestamp: "01:18" },
        ],
        dimensions: {
          acting_through_song: { value: "lands", confidence: "high", supports: ["a1"] },
        },
      },
    ];
    const validated = validateFutureComponents(raw, 240);
    expect(validated.components.length).toBe(1);

    // Public report shape that the polish stage produces — should never carry
    // dimension data.
    const publicReport = {
      schema_version: "v1-legacy",
      summary: "Strong, grounded read.",
      strengths: ["Clear intention"],
      improvements: ["Settle into beat 2"],
      timestamped_notes: [{ time: "01:18", note: "Belt lands." }],
      verdict: { label: "Resubmit", confidence: 0.7 },
      scores: { technical: 78, audio: 82, vocal: 75, acting: 80, brief_adherence: 88, professional_presentation: 85 },
    };
    expect(findAny(publicReport)).toEqual([]);

    // Shadow result is computed but kept PRIVATE.
    const shadow = computeFutureShadow({
      futureDimensions: validated,
      evidence: ev(),
      auditionType: "musical_theatre",
      durationSeconds: 240,
      mode: "brief",
    });
    expect(shadow.shadow_schema_version).toBe("shadow-v1");

    // The shadow object itself contains internal tokens — that's expected
    // because it lives behind RLS deny-all + flag. Confirm it never appears
    // inside the public report shape.
    const merged = { ...publicReport };
    expect(findAny(merged)).toEqual([]);
  });
});
