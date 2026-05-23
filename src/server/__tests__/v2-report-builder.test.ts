import { describe, it, expect } from "vitest";
import { buildV2Report, validateV2PublicBoundary } from "@/server/v2-report-builder.server";
import type { FutureDimensionsResult } from "@/server/dimensions";

const futureDimensions: FutureDimensionsResult = {
  components: [
    {
      type: "musical_theatre",
      start: "00:00",
      end: "02:14",
      confidence: "high",
      assessability: {
        component_assessable: true,
        visibility: "high",
        audio_balance: "medium",
        evidence_density: "high",
      },
      subtype: "ballad",
      style: "golden_age",
      form: "32_bar",
      dimensions: {},
      evidence_anchors: [
        {
          id: "a1",
          kind: "timestamp",
          note: "lift",
          supports: ["acting_through_song"],
          timestamp: "00:42",
        },
      ],
    },
  ],
  dropped: 0,
  malformed: false,
};

const legacyReport = {
  audition_type: "musical_theatre",
  verdict: "Worth another take",
  submission_verdict: {
    label: "Worth another take",
    reason: "The opening is readable, but the acting beat needs a cleaner turn before submission.",
    blocked: false,
  },
  confidence: 74,
  feedback_reliability: "medium",
  feedback_reliability_reason: "Audio is clear, but the brief detail is partial.",
  scores: {
    technical: 75,
    audio: 70,
    vocal: 68,
    acting: 74,
    brief_adherence: 72,
    professional_presentation: 80,
  },
  overall_score: 72,
  overall_score_final: 70,
  strengths: ["The opening intention is clear.", "The final button lands cleanly."],
  improvements: ["Make the second beat more active.", "Let the breath reset before the song."],
  fix_first: "This independent legacy fix should not survive when priority_fixes exists.",
  priority_fixes: [
    {
      headline: "Clarify the second beat",
      rationale: "The thought turn currently arrives late.",
      kind: "critical_gap",
    },
    {
      headline: "Hold the breath reset",
      rationale: "It will make the song start cleaner.",
      kind: "quick_win",
    },
  ],
  optional_polish: ["Tidy the final pause if time allows."],
  brief_requirements: [
    {
      requirement_id: "brief-1",
      source_text: "Submit the acting scene and song.",
      category: "material",
      obligation: "mandatory",
      public_summary: "Submit the acting scene and song.",
      achievement_status: "partially_achieved",
      readiness_impact: "material_gap",
      public_evidence_summary: "The scene is present, but the song cut is missing.",
      evidence_anchor_ids: ["private-anchor"],
      truth_state_entry_ids: ["private-truth"],
      assessability_limits: [],
    },
    {
      source_text: "Include full-body movement.",
      achievement_status: "not_assessable",
      readiness_impact: "not_assessable",
      assessability_limits: ["Framing does not show the movement pathway."],
    },
  ],
  next_take_plan: { steps: ["Run the scene once for the beat turn.", "Record one cleaner pass."] },
  role_fit_notes: "Private role-fit text must not appear.",
  comparison: { winner: "take-2" },
  raw_prompt: "private prompt",
};

describe("v2-report-builder R10.2B", () => {
  it("emits a locked-down decision-support schema", () => {
    const v2 = buildV2Report({
      legacyReport,
      futureDimensions,
      auditionType: "musical_theatre",
      mode: "brief",
    });

    expect(v2.schema_version).toBe("v2-component");
    expect(v2.submission_verdict).toEqual({
      decision: "retake_recommended",
      label: "Retake recommended",
      reason:
        "The opening is readable, but the acting beat needs a cleaner turn before submission.",
      blocked: false,
    });
    expect(v2.why_this_verdict.summary).toBe(
      "The opening is readable, but the acting beat needs a cleaner turn before submission.",
    );
    expect(v2.fix_first).toBe("Address the brief requirement: Submit the acting scene and song.");
    expect(v2.priority_fixes.map((fix) => fix.headline)).toEqual([
      "Address the brief requirement: Submit the acting scene and song.",
      "Clarify the second beat",
      "Hold the breath reset",
    ]);
  });

  it("keeps must-fix, retake improvement and optional polish separate", () => {
    const v2 = buildV2Report({
      legacyReport,
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });

    expect(v2.must_fix_before_submitting).toEqual([
      "Address the brief requirement: Submit the acting scene and song.",
      "Clarify the second beat",
    ]);
    expect(v2.should_improve_if_retaking).toEqual([
      "Hold the breath reset",
      "Make the second beat more active.",
      "Let the breath reset before the song.",
    ]);
    expect(v2.optional_polish).toEqual(["Tidy the final pause if time allows."]);
  });

  it("derives preserve and do-not-over-fix from public-safe strengths when explicit values are absent", () => {
    const v2 = buildV2Report({
      legacyReport,
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });

    expect(v2.preserve).toEqual([
      "The opening intention is clear.",
      "The final button lands cleanly.",
    ]);
    expect(v2.do_not_overfix[0]).toContain("Preserve this: The opening intention is clear.");
  });

  it("summarises brief achievement without exposing private evidence IDs", () => {
    const v2 = buildV2Report({
      legacyReport,
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });
    const json = JSON.stringify(v2);

    expect(v2.brief_achievement.overall_status).toBe("not_assessable");
    expect(v2.brief_achievement.mandatory_status).toBe("some_gaps");
    expect(v2.brief_achievement.readiness_impact).toBe("material_gap");
    expect(v2.brief_requirements).toEqual([
      {
        requirement_id: "brief-1",
        source_text: "Submit the acting scene and song.",
        public_summary: "Submit the acting scene and song.",
        category: "material_instruction",
        obligation: "mandatory",
        requirement_type: "song",
        achievement_status: "partly_achieved",
        readiness_impact: "material_gap",
        public_evidence_summary: "The scene is present, but the song cut is missing.",
        assessability_limits: [],
      },
      {
        source_text: "Include full-body movement.",
        public_summary: "Include full-body movement.",
        category: "ambiguous",
        requirement_type: "dance",
        achievement_status: "not_assessable",
        readiness_impact: "not_assessable",
        assessability_limits: ["Framing does not show the movement pathway."],
      },
    ]);
    expect(v2.not_assessable).toEqual([
      "Include full-body movement: Framing does not show the movement pathway.",
    ]);
    expect(json).not.toContain("private-anchor");
    expect(json).not.toContain("private-truth");
  });

  it("suppresses public scores, components, role-fit, comparison and raw/internal fields", () => {
    const v2 = buildV2Report({
      legacyReport,
      futureDimensions,
      auditionType: "musical_theatre",
      mode: "brief",
    });
    const json = JSON.stringify(v2);

    expect(json).not.toMatch(
      /overall_score|overall_readiness|scores|category_scores|component_score|role_fit|winner|comparison|raw_prompt|evidence_anchor|truth_state/,
    );
    expect(validateV2PublicBoundary(v2, legacyReport)).toEqual({ ok: true });
  });

  it("fails the public boundary when blocked public claims are injected", () => {
    const v2 = buildV2Report({
      legacyReport,
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });
    const leaky = {
      ...v2,
      priority_fixes: [{ headline: "This is callback-ready and has a 95 score." }],
    };

    expect(validateV2PublicBoundary(leaky, legacyReport)).toEqual({
      ok: false,
      reason: "blocked_public_claim",
    });
  });

  it("uses safe fallback copy when upstream data is incomplete", () => {
    const v2 = buildV2Report({
      legacyReport: {},
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });

    expect(v2.submission_verdict.decision).toBe("review_carefully");
    expect(v2.why_this_verdict.summary).toBe(
      "Review the priority fixes before deciding whether to submit this take.",
    );
    expect(v2.brief_achievement.overall_status).toBe("not_assessable");
    expect(v2.next_take_plan).toEqual({ steps: [] });
    expect(v2.fix_first).toBeNull();
  });

  it("does not invent brief requirements when no brief data is supplied", () => {
    const v2 = buildV2Report({
      legacyReport: {},
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });

    expect(v2.brief_requirements).toEqual([]);
    expect(v2.brief_achievement).toMatchObject({
      overall_status: "not_applicable",
      mandatory_status: "not_applicable",
      summary: "No supplied brief was available to assess.",
    });
    expect(JSON.stringify(v2)).not.toMatch(/role|song|scene|technique requirement/i);
  });

  it("lets an assessable missing mandatory brief requirement drive readiness and next-take priorities", () => {
    const v2 = buildV2Report({
      legacyReport: {
        submission_verdict: {
          decision: "submit",
          reason: "The tape otherwise has no public-safe blocker.",
        },
        brief_requirements: [
          {
            source_text: "Include the requested song cut.",
            public_summary: "Include the requested song cut.",
            category: "material_instruction",
            obligation: "mandatory",
            requirement_type: "song",
            achievement_status: "not_achieved",
            readiness_impact: "submission_blocker",
            public_evidence_summary: "The available tape does not include the requested song cut.",
            next_take_action: "Record the requested song cut before submitting.",
          },
        ],
        next_take_plan: { steps: ["Check the slate once."] },
      },
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });

    expect(v2.submission_verdict).toMatchObject({
      decision: "retake_required_if_possible",
      blocked: true,
    });
    expect(v2.why_this_verdict.main_reasons.join(" ")).toContain("mandatory brief requirement");
    expect(v2.fix_first).toBe("Record the requested song cut before submitting.");
    expect(v2.priority_fixes[0]).toMatchObject({
      headline: "Record the requested song cut before submitting.",
      category: "brief_adherence",
    });
    expect(v2.must_fix_before_submitting).toContain(
      "Record the requested song cut before submitting.",
    );
    expect(v2.next_take_plan).toEqual({
      steps: ["Record the requested song cut before submitting.", "Check the slate once."],
    });
  });

  it("keeps preferred and optional brief gaps out of submission blockers", () => {
    const v2 = buildV2Report({
      legacyReport: {
        submission_verdict: {
          decision: "submit",
          reason: "No mandatory blocker is present.",
        },
        brief_requirements: [
          {
            source_text: "Preferred: use a lighter comic pace.",
            public_summary: "Use a lighter comic pace if retaking.",
            category: "preferred",
            obligation: "preferred",
            achievement_status: "partly_achieved",
            readiness_impact: "minor_gap",
            next_take_action: "Lift the comic pace if you choose to retake.",
          },
          {
            source_text: "Optional: include a short slate.",
            public_summary: "Include a short slate if time allows.",
            category: "optional",
            obligation: "optional",
            achievement_status: "partly_achieved",
            readiness_impact: "minor_gap",
            next_take_action: "Add the short slate only if it does not distract from the take.",
          },
        ],
      },
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });

    expect(v2.submission_verdict.decision).toBe("submit");
    expect(v2.must_fix_before_submitting).toEqual([]);
    expect(v2.should_improve_if_retaking).toContain("Lift the comic pace if you choose to retake.");
    expect(v2.optional_polish).toContain(
      "Add the short slate only if it does not distract from the take.",
    );
    expect(v2.fix_first).toBeNull();
  });

  it("preserves ambiguous and not-assessable brief states without treating them as failure", () => {
    const v2 = buildV2Report({
      legacyReport: {
        submission_verdict: {
          decision: "submit",
          reason: "The tape otherwise has no public-safe blocker.",
        },
        brief_requirements: [
          {
            source_text: "Prepare it how you think best.",
            achievement_status: "not_assessable",
            readiness_impact: "not_assessable",
            assessability_limits: ["The brief wording is ambiguous."],
          },
        ],
      },
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });

    expect(v2.brief_requirements[0]).toMatchObject({
      category: "ambiguous",
      achievement_status: "not_assessable",
      readiness_impact: "not_assessable",
    });
    expect(v2.brief_requirements[0].achievement_status).not.toBe("not_achieved");
    expect(v2.submission_verdict.decision).toBe("submit");
    expect(v2.not_assessable).toEqual([
      "Prepare it how you think best: The brief wording is ambiguous.",
    ]);
  });
});
