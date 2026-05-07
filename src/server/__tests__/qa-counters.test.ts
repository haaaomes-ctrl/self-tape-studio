import { describe, it, expect } from "vitest";
import { computeFutureShadow } from "../shadow-scoring.server";
import type { EvidencePass } from "../evidence-pass.server";
import type { FutureDimensionsResult } from "../dimensions";

function baseEvidence(overrides: Partial<EvidencePass> = {}): EvidencePass {
  return {
    evidence_version: "1",
    audition_type: "musical_theatre",
    detected_components: [],
    raw_scores: {
      technical: 75,
      audio: 75,
      vocal: 75,
      acting: 75,
      brief_adherence: 75,
      professional_presentation: 75,
    },
    core_strengths_evidence: [],
    core_improvements_evidence: [],
    fix_first_evidence: "",
    brief_adherence_evidence: {
      material_compliance: "",
      technical_compliance: "",
      instruction_precision: "",
      professionalism_signals: "",
      score_material: 0,
      score_technical: 0,
      score_instruction: 0,
      score_professional: 0,
    },
    category_notes_evidence: {
      technical: "",
      audio: "",
      vocal: "",
      acting: "",
      brief_adherence: "",
      professional_presentation: "",
    },
    role_fit_evidence: "",
    role_fit_modifier_suggested: 0,
    role_fit_confidence: "low",
    presentation_evidence: [],
    risk_evidence: [],
    timestamped_evidence: [],
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
    ...overrides,
  };
}

function emptyDims(): FutureDimensionsResult {
  return { components: [], dropped: 0, malformed: false };
}

function shadow(ev: EvidencePass, durationSeconds = 60) {
  return computeFutureShadow({
    futureDimensions: emptyDims(),
    evidence: ev,
    auditionType: "musical_theatre",
    durationSeconds,
    mode: "brief",
  });
}

describe("QA counters (Phase 2)", () => {
  it("clean control yields zero critical counters", () => {
    const ev = baseEvidence({
      core_strengths_evidence: [
        { area: "acting", evidence: "Specific beat at 00:42 lands the betrayal." },
        { area: "vocal", evidence: "Belt at 01:18 is supported and on pitch." },
      ],
      timestamped_evidence: [
        { timestamp: "00:42", observation: "x", why_it_matters: "y", linked_category: "acting" },
        { timestamp: "01:18", observation: "x", why_it_matters: "y", linked_category: "vocal" },
        { timestamp: "02:01", observation: "x", why_it_matters: "y", linked_category: "audio" },
        { timestamp: "02:30", observation: "x", why_it_matters: "y", linked_category: "technical" },
        { timestamp: "03:00", observation: "x", why_it_matters: "y", linked_category: "acting" },
      ],
    });
    const r = shadow(ev, 240);
    expect(r.qa_counters.role_fit_overclaim).toBe(0);
    expect(r.qa_counters.marketability_or_look_hit).toBe(0);
    expect(r.qa_counters.frame_break_coaching).toBe(0);
    expect(r.qa_counters.timestamp_underproduction).toBe(0);
  });

  it("generic praise increments the generic counter", () => {
    const ev = baseEvidence({
      core_strengths_evidence: [
        { area: "vocal", evidence: "Strong vocals throughout. Lovely energy. Great presence." },
      ],
    });
    const r = shadow(ev);
    expect(r.qa_counters.generic_praise_hits).toBeGreaterThanOrEqual(3);
  });

  it("role-fit overclaim increments role_fit_overclaim and castability", () => {
    const ev = baseEvidence({
      role_fit_evidence:
        "Highly castable for this role — would get a recall. Callback-ready, perfect fit.",
    });
    const r = shadow(ev);
    expect(r.qa_counters.role_fit_overclaim).toBeGreaterThanOrEqual(2);
    expect(r.qa_counters.castability_overclaim).toBeGreaterThanOrEqual(1);
  });

  it("presentation drift / marketability increments both counters", () => {
    const ev = baseEvidence({
      presentation_evidence: [
        "Consider a more commercial look — softer makeup, brighter top.",
      ],
    });
    const r = shadow(ev);
    expect(r.qa_counters.marketability_or_look_hit).toBeGreaterThanOrEqual(1);
    expect(r.qa_counters.presentation_polish_drift).toBeGreaterThanOrEqual(1);
  });

  it("frame-break coaching increments frame_break_coaching", () => {
    const ev = baseEvidence({
      core_improvements_evidence: [
        { area: "acting", evidence: "Try walking around the room. Use a prop. Hold the script." },
      ],
    });
    const r = shadow(ev);
    expect(r.qa_counters.frame_break_coaching).toBeGreaterThanOrEqual(3);
  });

  it("timestamp underproduction fires for ≥3min tape with <5 timestamps", () => {
    const ev = baseEvidence({
      timestamped_evidence: [
        { timestamp: "00:30", observation: "", why_it_matters: "", linked_category: "vocal" },
        { timestamp: "01:00", observation: "", why_it_matters: "", linked_category: "vocal" },
      ],
    });
    const r = shadow(ev, 240);
    expect(r.qa_counters.timestamp_underproduction).toBe(1);
  });

  it("vocal-health and resource-merit drift counters fire on diagnostic prose", () => {
    const ev = baseEvidence({
      category_notes_evidence: {
        technical: "Studio capture is clean.",
        audio: "Paid accompanist helps balance.",
        vocal: "Possible vocal health issue, sounds hoarse from belting.",
        acting: "",
        brief_adherence: "",
        professional_presentation: "",
      },
    });
    const r = shadow(ev);
    expect(r.qa_counters.vocal_health_diagnosis_risk).toBeGreaterThanOrEqual(1);
    expect(r.qa_counters.resource_merit_drift).toBeGreaterThanOrEqual(2);
  });
});
