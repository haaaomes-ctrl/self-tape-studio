import { describe, it, expect } from "vitest";
import { computeFutureShadow, toQaTracePayload } from "../shadow-scoring.server";
import type { FutureDimensionsResult } from "../dimensions";
import type { EvidencePass } from "../evidence-pass.server";

function evidence(): EvidencePass {
  return {
    evidence_version: "1",
    audition_type: "musical_theatre",
    detected_components: [
      { type: "song", weight: 50, score: 75, note: "" },
      { type: "acting_through_song", weight: 50, score: 70, note: "" },
    ],
    raw_scores: {
      technical: 78,
      audio: 82,
      vocal: 75,
      acting: 70,
      brief_adherence: 88,
      professional_presentation: 85,
    },
    core_strengths_evidence: [{ area: "vocal", evidence: "Clear tone at 00:32." }],
    core_improvements_evidence: [{ area: "acting", evidence: "Beat shift at 01:10 lands late." }],
    fix_first_evidence: "Land beat 2.",
    brief_adherence_evidence: {
      material_compliance: "",
      technical_compliance: "",
      instruction_precision: "",
      professionalism_signals: "",
      score_material: 90,
      score_technical: 85,
      score_instruction: 88,
      score_professional: 90,
    },
    category_notes_evidence: {
      technical: "",
      audio: "",
      vocal: "",
      acting: "",
      brief_adherence: "",
      professional_presentation: "",
    },
    role_fit_evidence: "Strong contender.",
    role_fit_modifier_suggested: 2,
    role_fit_confidence: "medium",
    presentation_evidence: ["Clean framing."],
    risk_evidence: [],
    timestamped_evidence: [
      { timestamp: "00:32", observation: "Tone", why_it_matters: "x", linked_category: "vocal" },
      { timestamp: "01:10", observation: "Beat", why_it_matters: "x", linked_category: "acting" },
    ],
    evidence_sufficiency: {
      audio_assessable: true,
      video_assessable: true,
      acting_assessable: true,
      vocal_assessable: true,
      movement_assessable: true,
      brief_assessable: true,
      role_fit_assessable: true,
      notes: "",
    },
  };
}

function futureMt(): FutureDimensionsResult {
  return {
    components: [
      {
        type: "musical_theatre",
        start: "00:00",
        end: "03:30",
        confidence: "high",
        assessability: { component_assessable: true, evidence_density: "high" },
        subtype: null,
        style: null,
        form: null,
        evidence_anchors: [
          { id: "a1", kind: "timestamp", note: "Beat shift", supports: ["beat_shift"], timestamp: "01:10" },
          { id: "a2", kind: "lyric_observation", note: "Lyric intent", supports: ["lyric_intention", "acting_through_song"], timestamp: null },
        ],
        dimensions: {
          beat_shift: { value: "lands", confidence: "high", supports: ["a1"] },
          acting_through_song: { value: "consistent", confidence: "medium", supports: ["a2"] },
          lyric_intention: { value: "specific", confidence: "high", supports: ["a2"] },
          vocal_technique_serves_story: { value: "yes", confidence: "medium", supports: ["a2"] },
        },
      },
    ],
    dropped: 0,
    malformed: false,
  };
}

describe("shadow scoring (Phase 2)", () => {
  it("derives shadow scores for MT and computes divergence vs raw_scores", () => {
    const ev = evidence();
    const before = JSON.stringify(ev.raw_scores);
    const r = computeFutureShadow({
      futureDimensions: futureMt(),
      evidence: ev,
      auditionType: "musical_theatre",
      durationSeconds: 210,
      mode: "brief",
    });
    expect(r.shadow_schema_version).toBe("shadow-v1");
    expect(r.branch).toBe("mt");
    expect(typeof r.shadow_scores.acting).toBe("number");
    expect(typeof r.shadow_scores.vocal).toBe("number");
    expect(r.shadow_divergence.acting).toBeDefined();
    // Public input must not be mutated.
    expect(JSON.stringify(ev.raw_scores)).toBe(before);
  });

  it("toQaTracePayload returns only structural keys", () => {
    const ev = evidence();
    const r = computeFutureShadow({
      futureDimensions: futureMt(),
      evidence: ev,
      auditionType: "musical_theatre",
      durationSeconds: 210,
      mode: "brief",
    });
    const payload = toQaTracePayload(r);
    expect(Object.keys(payload).sort()).toEqual(
      [
        "branch",
        "components_summary",
        "dimensions_summary",
        "schema_version",
        "scrub_counters",
        "shadow_divergence",
        "sufficiency",
      ].sort(),
    );
    const json = JSON.stringify(payload);
    // No prose / quotes / observation text.
    for (const banned of ["evidence", "observation", "why_it_matters", "note", "quote", "prose"]) {
      expect(json.toLowerCase()).not.toContain(banned);
    }
  });

  it("malformed dropped counter feeds malformed_dimension_drop_count", () => {
    const ev = evidence();
    const r = computeFutureShadow({
      futureDimensions: { components: [], dropped: 3, malformed: true },
      evidence: ev,
      auditionType: "musical_theatre",
      durationSeconds: 60,
      mode: "baseline",
    });
    expect(r.qa_counters.malformed_dimension_drop_count).toBe(3);
  });
});
