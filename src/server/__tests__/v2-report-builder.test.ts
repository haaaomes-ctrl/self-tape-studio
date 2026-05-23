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
    expect(v2.should_improve_if_retaking).toEqual(["Hold the breath reset"]);
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

  it("keeps fix-first derived from the ranked priority list and exposes all meaningful fixes", () => {
    const v2 = buildV2Report({
      legacyReport: {
        fix_first: "This contradictory standalone fix should not survive.",
        priority_fixes: [
          {
            headline: "Clarify the first reaction",
            rationale: "It is the first moment that affects readiness.",
            action: "Record one pass that lands the first reaction before moving on.",
            kind: "critical_gap",
          },
          {
            headline: "Hold the final beat",
            rationale: "The ending currently cuts away too quickly.",
            action: "Let the final thought settle before stopping the recording.",
            kind: "quick_win",
          },
          {
            headline: "Reset the breath before the second line",
            rationale: "The breath reset will make the second line cleaner.",
            action: "Take one silent breath reset before the second line.",
            kind: "low_effort_high_impact",
          },
          {
            headline: "Sharpen the eyeline shift",
            rationale: "The relationship turn will read more clearly.",
            action: "Set the eyeline before the relationship turn.",
            kind: "quick_win",
          },
        ],
      },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });

    expect(v2.fix_first).toBe("Clarify the first reaction");
    expect(v2.priority_fixes.map((fix) => fix.headline)).toEqual([
      "Clarify the first reaction",
      "Hold the final beat",
      "Reset the breath before the second line",
      "Sharpen the eyeline shift",
    ]);
  });

  it("synthesises a finite next-take plan covering must-fix and should-improve items", () => {
    const v2 = buildV2Report({
      legacyReport: {
        priority_fixes: [
          {
            headline: "Clarify the first reaction",
            rationale: "It materially affects submission readiness.",
            action: "Record one pass that lands the first reaction before moving on.",
            kind: "critical_gap",
          },
          {
            headline: "Hold the final beat",
            rationale: "The ending can land more cleanly if retaking.",
            action: "Let the final thought settle before stopping the recording.",
            kind: "quick_win",
          },
          {
            headline: "Reset the breath before the second line.",
            rationale: "The breath reset will make the second line cleaner.",
            kind: "quick_win",
          },
        ],
        next_take_plan: { steps: ["Check the reader volume once before recording."] },
      },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });
    const steps = (v2.next_take_plan as { steps: string[] }).steps;

    expect(v2.must_fix_before_submitting).toEqual(["Clarify the first reaction"]);
    expect(v2.should_improve_if_retaking).toEqual([
      "Hold the final beat",
      "Reset the breath before the second line.",
    ]);
    expect(steps).toEqual([
      "Record one pass that lands the first reaction before moving on.",
      "Let the final thought settle before stopping the recording.",
      "Retake option: if recording again, use one pass to strengthen reset the breath before the second line.",
      "Check the reader volume once before recording.",
    ]);
    expect(steps).not.toContain("Clarify the first reaction");
  });

  it("drops generic filler and unsafe resource advice from fixes and actions", () => {
    const v2 = buildV2Report({
      legacyReport: {
        priority_fixes: [
          "Be more confident.",
          {
            headline: "Make the opening eyeline land before the first line",
            rationale: "The opening relationship is currently late.",
            action: "Set the eyeline before the first line starts.",
            kind: "quick_win",
          },
        ],
        improvements: [
          "Add more energy.",
          "Use an expensive microphone.",
          "Reset the breath before the final phrase.",
        ],
        should_improve_if_retaking: [
          "Add more energy.",
          "Use an expensive microphone.",
          "Reset the breath before the final phrase.",
        ],
        next_take_plan: {
          steps: ["Hire a paid coach.", "Run the breath reset once before recording."],
        },
      },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });
    const serialised = JSON.stringify(v2);

    expect(v2.priority_fixes.map((fix) => fix.headline)).toEqual([
      "Make the opening eyeline land before the first line",
    ]);
    expect(v2.should_improve_if_retaking).toEqual(["Reset the breath before the final phrase."]);
    expect((v2.next_take_plan as { steps: string[] }).steps).toContain(
      "Run the breath reset once before recording.",
    );
    expect(serialised).not.toMatch(
      /be more confident|add more energy|expensive microphone|paid coach/i,
    );
  });

  it("only lets setup become fix-first when it materially blocks assessment or submission", () => {
    const minorSetup = buildV2Report({
      legacyReport: {
        brief_requirements: [
          {
            source_text: "Keep the camera landscape.",
            public_summary: "Keep the camera landscape.",
            category: "video_audio_setup",
            obligation: "mandatory",
            achievement_status: "partly_achieved",
            readiness_impact: "minor_gap",
            next_take_action: "Keep the camera landscape if recording again.",
          },
        ],
      },
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });
    const blockingSetup = buildV2Report({
      legacyReport: {
        brief_requirements: [
          {
            source_text: "Use full-body framing for the movement phrase.",
            public_summary: "Use full-body framing for the movement phrase.",
            category: "video_audio_setup",
            obligation: "mandatory",
            achievement_status: "not_achieved",
            readiness_impact: "submission_blocker",
            next_take_action: "Re-record with full-body framing for the movement phrase.",
          },
        ],
      },
      futureDimensions: null,
      auditionType: null,
      mode: "brief",
    });

    expect(minorSetup.fix_first).toBeNull();
    expect(minorSetup.should_improve_if_retaking).toContain(
      "Keep the camera landscape if recording again.",
    );
    expect(blockingSetup.fix_first).toBe(
      "Re-record with full-body framing for the movement phrase.",
    );
    expect(blockingSetup.must_fix_before_submitting).toContain(
      "Re-record with full-body framing for the movement phrase.",
    );
  });

  it("treats a detected partial song as incomplete rather than absent", () => {
    const v2 = buildV2Report({
      legacyReport: {
        detected_components: [
          {
            type: "song",
            note: "Song section identified from locked observation evidence.",
          },
        ],
        category_notes: {
          brief_adherence: "The song cuts off abruptly before completion.",
        },
        brief_requirements: [
          {
            source_text: "Tape Side 1, pages 85-87.",
            public_summary: "Include the required Side 1 acting scene.",
            category: "mandatory",
            obligation: "mandatory",
            requirement_type: "scene",
            achievement_status: "not_achieved",
            readiness_impact: "submission_blocker",
            public_evidence_summary:
              "The supplied brief asks for Side 1, but the available evidence does not identify the required acting scene.",
            next_take_action: "Record and include the full required Side 1 acting scene.",
          },
          {
            source_text: "Tape a contemporary legit MT song of your own choice.",
            public_summary: "Include the required song section.",
            category: "mandatory",
            obligation: "mandatory",
            requirement_type: "song",
            achievement_status: "not_achieved",
            readiness_impact: "material_gap",
            public_evidence_summary:
              "The supplied brief asks for a song, but the available evidence does not identify a song section in the submitted tape.",
            next_take_action: "Record and include the required song section.",
          },
        ],
      },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });

    expect(v2.fix_first).toBe("Record and include the full required Side 1 acting scene.");
    expect(v2.brief_requirements[1]).toMatchObject({
      public_summary: "Complete the required song section.",
      achievement_status: "partly_achieved",
      readiness_impact: "material_gap",
      public_evidence_summary:
        "A song section is present, but the tape cuts off before the song/package is complete.",
      next_take_action:
        "Record the song through to completion and check the final edit does not cut off.",
    });
    expect(JSON.stringify(v2)).not.toMatch(/does not identify a song section|no song section/i);
    expect(v2.must_fix_before_submitting).toContain(
      "Record the song through to completion and check the final edit does not cut off.",
    );
    expect((v2.next_take_plan as { steps: string[] }).steps).toEqual(
      expect.arrayContaining([
        "Record and include the full required Side 1 acting scene.",
        "Record the song through to completion and check the final edit does not cut off.",
      ]),
    );
  });

  it("does not backfill public should-improve from legacy improvements or render ok placeholders", () => {
    const v2 = buildV2Report({
      legacyReport: {
        feedback_reliability_override: "low",
        feedback_reliability_reason_code: "ok",
        confidence_reason: "Generated from evidence pass (polish step unavailable).",
        improvements: ["Blocked: a major casting brief instruction wasn't followed."],
        should_improve_if_retaking: [],
        not_assessable: [],
      },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });

    expect(v2.should_improve_if_retaking).toEqual([]);
    expect(v2.not_assessable).toEqual([]);
    expect(v2.why_this_verdict.limitations).toEqual([]);
    expect(v2.feedback_reliability).toEqual({
      level: "low",
      summary:
        "Review reliability is limited because the report was generated from locked observation evidence while report polish was unavailable.",
    });
    expect(
      JSON.stringify({
        should_improve_if_retaking: v2.should_improve_if_retaking,
        not_assessable: v2.not_assessable,
        why_this_verdict: v2.why_this_verdict,
        feedback_reliability: v2.feedback_reliability,
      }),
    ).not.toMatch(/"ok"|major casting brief instruction wasn't followed/i);
  });
});
