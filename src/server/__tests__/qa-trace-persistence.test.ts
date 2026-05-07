import { describe, it, expect } from "vitest";
import { toQaTracePayload, computeFutureShadow } from "../shadow-scoring.server";
import type { EvidencePass } from "../evidence-pass.server";
import type { FutureDimensionsResult } from "../dimensions";

function ev(): EvidencePass {
  return {
    evidence_version: "1",
    audition_type: "musical_theatre",
    detected_components: [],
    raw_scores: { technical: 70, audio: 70, vocal: 70, acting: 70, brief_adherence: 70, professional_presentation: 70 },
    core_strengths_evidence: [{ area: "vocal", evidence: "Belt at 01:00." }],
    core_improvements_evidence: [{ area: "acting", evidence: "Settle into beat 2." }],
    fix_first_evidence: "Land the button.",
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

function dims(): FutureDimensionsResult {
  return {
    components: [
      {
        type: "musical_theatre",
        start: null, end: null, confidence: "medium",
        assessability: { component_assessable: true },
        subtype: null, style: null, form: null,
        evidence_anchors: [{ id: "a1", kind: "timestamp", note: "n", supports: ["acting_through_song"], timestamp: null }],
        dimensions: { acting_through_song: { value: "lands", confidence: "high", supports: ["a1"] } },
      },
    ],
    dropped: 0,
    malformed: false,
  };
}

describe("qa-trace persistence boundary (Phase 2)", () => {
  it("toQaTracePayload contains no prose, quotes, or evidence keys", () => {
    const r = computeFutureShadow({
      futureDimensions: dims(),
      evidence: ev(),
      auditionType: "musical_theatre",
      durationSeconds: 60,
      mode: "brief",
    });
    const payload = toQaTracePayload(r);
    const json = JSON.stringify(payload).toLowerCase();
    // structural-only — none of these substrings should appear in keys.
    const keys = collectKeys(payload);
    for (const banned of ["evidence", "observation", "why_it_matters", "fix_first", "role_fit_evidence", "presentation_evidence"]) {
      expect(keys, banned).not.toContain(banned);
    }
    // body must not echo source prose verbatim.
    expect(json).not.toContain("belt at 01:00");
    expect(json).not.toContain("settle into beat 2");
    expect(json).not.toContain("land the button");
  });

  it("client take row never carries qa-trace payload (defence in depth)", () => {
    const fakeRow = { id: "x", report: { summary: "ok" }, score_breakdown: { two_step: { ms: 1 } } };
    const flat = JSON.stringify(fakeRow);
    for (const banned of ["future_shadow", "shadow_scores", "shadow_divergence", "qa_counters", "scrub_counters", "dimensions_summary"]) {
      expect(flat).not.toContain(banned);
    }
  });
});

function collectKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((i) => collectKeys(i, out));
  else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out.add(k);
      collectKeys(val, out);
    }
  }
  return out;
}
