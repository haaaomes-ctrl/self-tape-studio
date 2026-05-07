import { describe, it, expect } from "vitest";
import { buildV2Report, PUBLIC_CATEGORIES } from "@/server/v2-report-builder.server";
import type { FutureDimensionsResult } from "@/server/dimensions";

const legacyReport = {
  audition_type: "musical_theatre",
  headline: "Confident take with clear story choices.",
  verdict: "ready_with_notes",
  overall_score: 72,
  overall_score_final: 70,
  confidence: 4,
  feedback_reliability: "high",
  scores: {
    technical: 75,
    audio: 70,
    vocal: 68,
    acting: 74,
    brief_adherence: 72,
    professional_presentation: 80,
  },
  strengths: [{ point: "Steady frame.", evidence: "00:00–01:30" }],
  improvements: [{ point: "Vary phrase shape.", evidence: "01:10" }],
  fix_first: { headline: "Open the second verse.", why_now: "It currently flatlines." },
  timestamped_notes: [{ timestamp: "00:42", note: "Land the consonant." }],
  next_take_plan: { steps: ["Slower intake.", "Lift the eyeline."] },
  risk_flags: ["audio_balance_low"],
  presentation_notes: { framing: "mid", lighting: "even" },
  role_fit: { score: 62, range: [55, 70] },
};

const futureDimensions: FutureDimensionsResult = {
  components: [
    {
      type: "musical_theatre",
      start: "00:00",
      end: "02:14",
      confidence: "high",
      assessability: "fully_assessable",
      subtype: "ballad",
      style: "golden_age",
      form: "32_bar",
      dimensions: {},
      evidence_anchors: [
        { id: "a1", kind: "timestamp", note: "lift", supports: ["acting_through_song"], timestamp: "00:42" },
      ],
    },
  ],
  dropped: 0,
  malformed: false,
};

describe("v2-report-builder (Phase 3A)", () => {
  it("emits schema_version v2-component", () => {
    const v2 = buildV2Report({ legacyReport, futureDimensions, auditionType: "musical_theatre", mode: "brief" });
    expect(v2.schema_version).toBe("v2-component");
  });

  it("public scores come verbatim from legacy production scoring", () => {
    const v2 = buildV2Report({ legacyReport, futureDimensions, auditionType: "musical_theatre", mode: "baseline" });
    expect(v2.scores).toEqual(legacyReport.scores);
    for (const k of PUBLIC_CATEGORIES) {
      expect(v2.scores![k]).toBe((legacyReport.scores as Record<string, number>)[k]);
    }
  });

  it("public_categories mirrors the six existing fields", () => {
    const v2 = buildV2Report({ legacyReport, futureDimensions, auditionType: "musical_theatre", mode: "baseline" });
    expect([...v2.public_categories]).toEqual([
      "technical",
      "audio",
      "vocal",
      "acting",
      "brief_adherence",
      "professional_presentation",
    ]);
  });

  it("verdict, headline, overall_readiness, reliability, confidence preserved", () => {
    const v2 = buildV2Report({ legacyReport, futureDimensions, auditionType: "musical_theatre", mode: "baseline" });
    expect(v2.verdict).toBe("ready_with_notes");
    expect(v2.headline).toBe(legacyReport.headline);
    expect(v2.overall_readiness).toBe(70); // overall_score_final preferred
    expect(v2.reliability).toBe("high");
    expect(v2.confidence).toBe(4);
  });

  it("components[] surfaces only structural fields (no anchors/dimensions)", () => {
    const v2 = buildV2Report({ legacyReport, futureDimensions, auditionType: "musical_theatre", mode: "baseline" });
    expect(v2.components).toHaveLength(1);
    const c = v2.components[0] as Record<string, unknown>;
    expect(Object.keys(c).sort()).toEqual([
      "assessability",
      "end",
      "form",
      "start",
      "style",
      "subtype",
      "type",
    ]);
    expect("evidence_anchors" in c).toBe(false);
    expect("dimensions" in c).toBe(false);
    expect("dimension_confidence" in c).toBe(false);
  });

  it("role_fit only present in brief mode", () => {
    const brief = buildV2Report({ legacyReport, futureDimensions, auditionType: "musical_theatre", mode: "brief" });
    const baseline = buildV2Report({ legacyReport, futureDimensions, auditionType: "musical_theatre", mode: "baseline" });
    expect(brief.role_fit).toEqual(legacyReport.role_fit);
    expect("role_fit" in baseline).toBe(false);
  });

  it("does not mutate inputs", () => {
    const snapshot = JSON.stringify(legacyReport);
    buildV2Report({ legacyReport, futureDimensions, auditionType: "musical_theatre", mode: "brief" });
    expect(JSON.stringify(legacyReport)).toBe(snapshot);
  });

  it("handles empty/null futureDimensions safely", () => {
    const v2 = buildV2Report({ legacyReport, futureDimensions: null, auditionType: null, mode: "baseline" });
    expect(v2.components).toEqual([]);
    expect(v2.schema_version).toBe("v2-component");
  });
});
