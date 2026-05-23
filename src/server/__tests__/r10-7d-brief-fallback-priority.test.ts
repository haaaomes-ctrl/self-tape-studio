import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EvidencePass } from "@/server/evidence-pass.server";
import { renderFallbackReport } from "@/server/report-polish.server";
import { buildV2Report } from "@/server/v2-report-builder.server";

const testOneBrief = [
  "Tape Side 1, pages 85-87.",
  "Tape a contemporary legit MT song of the performer's own choice.",
  "Record Side 1 + song only for the initial self-tape.",
  "Edit ident and song into one continuous video.",
  "Do not upload more than one file.",
  "Landscape, close-up head-and-shoulders.",
].join(" ");

function partialSongOnlyEvidence(): EvidencePass {
  return {
    evidence_version: "1",
    step1_provider_contract: "plain_json_observations",
    step1_observations: [
      {
        family: "material_specific_performance",
        kind: "song_section_present",
        summary: "The tape contains a song section after the performer introduction.",
        source_basis: "observed_audio",
        confidence: "high",
      },
      {
        family: "material_specific_performance",
        kind: "song_cuts_off",
        summary: "The song section cuts off abruptly before it reaches a complete ending.",
        source_basis: "observed_audio",
        confidence: "high",
      },
      {
        family: "audio_observable",
        kind: "audio_source_microphone",
        summary: "The audio is captured from a microphone and remains assessable.",
        source_basis: "observed_audio",
        confidence: "high",
      },
    ],
    audition_type: "musical_theatre",
    detected_components: [],
    candidate_technique_evidence: [],
    raw_scores: {
      technical: 0,
      audio: 0,
      vocal: null,
      acting: 0,
      brief_adherence: 0,
      professional_presentation: 0,
    },
    core_strengths_evidence: [
      { area: "audio", evidence: "The microphone capture is clear enough to assess." },
    ],
    core_improvements_evidence: [],
    fix_first_evidence: "",
    brief_adherence_evidence: {
      material_compliance: "The submitted tape includes a partial song but no observed Side 1.",
      technical_compliance: "The submitted package cuts off before the song is complete.",
      instruction_precision: "The required acting side is not present in the observed material.",
      professionalism_signals: "The final edit needs a playback check before upload.",
      score_material: 0,
      score_technical: 0,
      score_instruction: 0,
      score_professional: 0,
    },
    category_notes_evidence: {
      technical: "",
      audio: "Audio is assessable.",
      vocal: "",
      acting: "No required acting side is observed.",
      brief_adherence: "Side 1 is missing and the song is incomplete.",
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
      notes: "Audio and video are assessable; required material is incomplete.",
    },
  };
}

describe("R10.7D brief-led fallback priority repair", () => {
  it("promotes a missing mandatory Side 1 above generic audio/setup fallback", () => {
    const fallback = renderFallbackReport(partialSongOnlyEvidence(), "brief", {
      briefText: testOneBrief,
      extractedBrief: {
        audition_type: "musical_theatre",
        material_requested: "Side 1 plus contemporary legit MT song",
        explicit_instructions: [
          "Edit ident and song into one continuous video.",
          "Do not upload more than one file.",
        ],
      },
    });
    const v2 = buildV2Report({
      legacyReport: fallback,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });

    expect(fallback.detected_components).toEqual([]);
    expect(fallback.should_improve_if_retaking).toEqual([]);
    expect(v2.submission_verdict.decision).toBe("retake_required_if_possible");
    expect(v2.fix_first).toBe(v2.priority_fixes[0]?.headline);
    expect(v2.fix_first).toMatch(/Side 1 acting scene/i);
    expect(v2.priority_fixes.map((fix) => fix.headline).join(" ")).toMatch(/song/i);
    expect(v2.must_fix_before_submitting.join(" ")).toMatch(/Side 1 acting scene/i);
    expect(v2.must_fix_before_submitting.join(" ")).toMatch(/song/i);
    expect(v2.why_this_verdict.summary).toMatch(/required material is missing or incomplete/i);
    expect(v2.brief_achievement.summary).toMatch(/Side 1 acting scene is missing/i);
    expect(v2.brief_achievement.summary).toMatch(/song package needs completion/i);
    expect((v2.next_take_plan as { steps: string[] }).steps).toEqual(
      expect.arrayContaining([
        "Record and include the full required Side 1 acting scene.",
        "Record the song through to completion without an abrupt cut-off.",
        "Check that the final edit contains the required material in one continuous video.",
        "Do a quick playback check before uploading.",
      ]),
    );
  });

  it("does not emit poor_audio or no-priority-fix fallback when audio is assessable", () => {
    const fallback = renderFallbackReport(partialSongOnlyEvidence(), "brief", {
      briefText: testOneBrief,
    });
    const v2 = buildV2Report({
      legacyReport: fallback,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });
    const publicText = JSON.stringify(v2);

    expect(publicText).not.toMatch(/poor_audio|audio is too unclear|too unclear to fairly judge/i);
    expect(publicText).not.toContain("No single public-safe priority fix was available");
    expect(v2.not_assessable.join(" ")).not.toMatch(/audio/i);
    expect(v2.do_not_overfix.join(" ")).toMatch(/prioritise the missing required material/i);
    expect("scores" in v2).toBe(false);
  });

  it("keeps reliability poor_audio gated by explicit audio limitation evidence", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );

    expect(source).toContain("audioLimitationSupported");
    expect(source).toContain('groundedConcerns.push("poor_audio")');
    expect(source.indexOf("audioLimitationSupported && audioScore")).toBeLessThan(
      source.indexOf('groundedConcerns.push("poor_audio")'),
    );
  });
});
