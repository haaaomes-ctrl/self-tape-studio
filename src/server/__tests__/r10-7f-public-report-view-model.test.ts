import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "@/components/report/V2ReportView";
import type { EvidencePass } from "@/server/evidence-pass.server";
import {
  buildPublicReportViewModel,
  PUBLIC_REPORT_SECTION_ROUTES,
} from "@/server/public-report-view-model.server";

const testOneBrief = [
  "Tape Side 1, pages 85-87.",
  "Tape a contemporary legit MT song of the performer's own choice.",
  "Record Side 1 + song only for the initial self-tape.",
  "Edit ident and song into one continuous video.",
  "Do not upload more than one file.",
  "Landscape, close-up head-and-shoulders.",
].join(" ");

function testOneEvidence(): EvidencePass {
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
        summary: "Audio is assessable and does not block review.",
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

function testOneEvidenceWithUnconfirmedSongCompletion(): EvidencePass {
  const base = testOneEvidence();
  return {
    ...base,
    step1_observations: [
      {
        family: "material_specific_performance",
        kind: "intro_present",
        summary: "The submitted tape starts with a performer introduction.",
        source_basis: "observed_video",
        confidence: "high",
      },
      {
        family: "audio_observable",
        kind: "audio_source_microphone",
        summary: "Audio is assessable and does not block review.",
        source_basis: "observed_audio",
        confidence: "high",
      },
    ],
    brief_adherence_evidence: {
      material_compliance:
        "The required Side 1 is not present, and the final package is incomplete.",
      technical_compliance: "The one-continuous-video package cannot be confirmed as complete.",
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
      brief_adherence: "Side 1 is missing and the package completion could not be confirmed.",
      professional_presentation: "",
    },
    evidence_sufficiency: {
      ...base.evidence_sufficiency,
      notes:
        "Audio and video are assessable; required material is incomplete and package completion is unconfirmed.",
    },
  };
}

function strongBriefCompleteEvidence(): EvidencePass {
  const base = testOneEvidence();
  return {
    ...base,
    step1_observations: [
      {
        family: "material_specific_performance",
        kind: "side_1_scene_present",
        summary: "The tape includes the requested Side 1 acting scene.",
        source_basis: "observed_video",
        confidence: "high",
      },
      {
        family: "material_specific_performance",
        kind: "song_section_complete",
        summary: "The tape includes a complete song section after the acting scene.",
        source_basis: "observed_audio",
        confidence: "high",
      },
      {
        family: "video_observable",
        kind: "landscape_close_up",
        summary: "The video is landscape and framed close-up/head-and-shoulders.",
        source_basis: "observed_video",
        confidence: "high",
      },
      {
        family: "audio_observable",
        kind: "audio_assessable",
        summary: "Audio is clear enough to assess spoken and sung material.",
        source_basis: "observed_audio",
        confidence: "high",
      },
    ],
    detected_components: [
      { type: "acting_scene", weight: 0.55, score: 88, note: "Side 1 acting scene is present." },
      { type: "song", weight: 0.45, score: 90, note: "Song section is present and complete." },
    ],
    raw_scores: {
      technical: 88,
      audio: 90,
      vocal: 90,
      acting: 89,
      brief_adherence: 92,
      professional_presentation: 91,
    },
    core_strengths_evidence: [
      {
        area: "brief",
        evidence: "The tape includes Side 1 and the song in a complete package.",
      },
      {
        area: "performance",
        evidence: "The opening beat is clear and the song storytelling stays connected.",
      },
      {
        area: "presentation",
        evidence: "Landscape close-up framing is stable and readable.",
      },
    ],
    core_improvements_evidence: [
      {
        area: "polish",
        evidence: "Let the final button settle for a breath before ending the recording.",
      },
    ],
    fix_first_evidence: "",
    brief_adherence_evidence: {
      material_compliance: "Side 1 and the song are both present.",
      technical_compliance: "The material appears edited into one continuous package.",
      instruction_precision: "The required components are represented in the observed tape.",
      professionalism_signals: "The package is ready for a final playback check.",
      score_material: 92,
      score_technical: 90,
      score_instruction: 92,
      score_professional: 91,
    },
    category_notes_evidence: {
      technical: "The framing is stable and follows the landscape close-up instruction.",
      audio: "Audio is assessable.",
      vocal: "The song section is audible and complete.",
      acting: "The requested acting scene is present.",
      brief_adherence: "The required Side 1, song and one continuous package are present.",
      professional_presentation: "Presentation is submission-ready with only optional polish.",
    },
    evidence_sufficiency: {
      audio_assessable: true,
      video_assessable: true,
      acting_assessable: true,
      vocal_assessable: true,
      movement_assessable: true,
      brief_assessable: true,
      role_fit_assessable: true,
      notes: "Audio/video are assessable and the supplied brief components are present.",
    },
  };
}

describe("R10.7F canonical public report view model", () => {
  it("routes Test 1 Step 1 evidence into missing Side 1 and incomplete song sections", () => {
    const result = buildPublicReportViewModel({
      candidateReport: {
        schema_version: "v1-legacy",
        source_family: "legacy_adapter",
        fix_first: "No single public-safe priority fix was available from the evidence pass.",
        next_take_plan: ["Not ready to send — work the priority fix and shoot a fresh take."],
        priority_fixes: [],
        defect_risk_ids: [
          "legacy_report_used_as_v3_spine_proxy",
          "legacy_numeric_score_snapshot",
          "priority_fixes_missing",
          "action_plan_missing",
        ],
      },
      evidence: testOneEvidence(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      briefText: testOneBrief,
      extractedBrief: {
        audition_type: "musical_theatre",
        material_requested: "Side 1 plus contemporary legit MT song",
      },
    });

    const model = result.model;
    const text = JSON.stringify(model);

    expect(result.source_kind).toBe("public_report_view_model_limited");
    expect(model.submission_verdict).toMatchObject({
      decision: "retake_required_if_possible",
    });
    expect(model.fix_first).toMatch(/Side 1 acting scene/i);
    expect(model.priority_fixes.map((fix) => JSON.stringify(fix)).join(" ")).toMatch(/song/i);
    expect(model.must_fix_before_submitting.join(" ")).toMatch(/Side 1 acting scene/i);
    expect(model.must_fix_before_submitting).toEqual(
      expect.arrayContaining([
        "Complete the song section or confirm the song runs through to the end before uploading.",
        "Check that the song and Side 1 are both present in the final continuous video.",
      ]),
    );
    expect(JSON.stringify(model.next_take_plan)).toMatch(/Side 1 acting scene/i);
    expect((model.next_take_plan as { steps: string[] }).steps).toEqual(
      expect.arrayContaining([
        "Complete the song section or confirm the song runs through to the end before uploading.",
        "Check that the song and Side 1 are both present in the final continuous video.",
        "Do a quick playback check before uploading to catch any cut-off.",
      ]),
    );
    expect(model.do_not_overfix.join(" ")).toMatch(/missing required material/i);
    expect(text).not.toMatch(
      /No single public-safe priority fix|Not ready to send|poor_audio|muddy_audio|audio is too unclear|"ok"|major casting brief instruction/i,
    );
  });

  it("routes a cautious song/package completion action when song completion is unconfirmed", () => {
    const result = buildPublicReportViewModel({
      candidateReport: {
        schema_version: "v1-legacy",
        source_family: "legacy_adapter",
        priority_fixes: [],
        defect_risk_ids: ["legacy_report_used_as_v3_spine_proxy"],
      },
      evidence: testOneEvidenceWithUnconfirmedSongCompletion(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      briefText: testOneBrief,
      extractedBrief: {
        audition_type: "musical_theatre",
        material_requested: "Side 1 plus contemporary legit MT song",
      },
    });

    const publicText = JSON.stringify(result.model);

    expect(result.model.fix_first).toMatch(/Side 1 acting scene/i);
    expect(result.model.must_fix_before_submitting).toContain(
      "Complete the song section or confirm the song runs through to the end before uploading.",
    );
    expect((result.model.next_take_plan as { steps: string[] }).steps).toEqual(
      expect.arrayContaining([
        "Complete the song section or confirm the song runs through to the end before uploading.",
        "Check that the song and Side 1 are both present in the final continuous video.",
      ]),
    );
    expect(publicText).toMatch(/song\/package completion could not be fully confirmed/i);
    expect(publicText).not.toMatch(/does not identify a song section|no song section|song absent/i);
  });

  it("renders the final PublicReportViewModel surface instead of a limited fallback surface", () => {
    const result = buildPublicReportViewModel({
      candidateReport: {
        schema_version: "v1-legacy",
        source_family: "legacy_adapter",
        priority_fixes: [],
        defect_risk_ids: ["legacy_report_used_as_v3_spine_proxy"],
      },
      evidence: testOneEvidence(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      briefText: testOneBrief,
      extractedBrief: {
        audition_type: "musical_theatre",
        material_requested: "Side 1 plus contemporary legit MT song",
      },
    });

    const html = renderToStaticMarkup(
      createElement(V2ReportView, { report: result.model, takeNumber: 1 }),
    );

    expect(html).toMatch(/Side 1 acting scene/i);
    expect(html).toMatch(/Complete the song section/i);
    expect(html).not.toMatch(/No single public-safe priority fix/i);
    expect(html).not.toMatch(/This report could not generate a reliable fix-first item/i);
  });

  it("restores performer-facing value for a strong brief-complete professional take", () => {
    const result = buildPublicReportViewModel({
      candidateReport: {
        schema_version: "v1-legacy",
        source_family: "legacy_adapter",
        strengths: [
          "The opening scene has clear intention and readable eyeline shifts.",
          "The song storytelling stays connected through the final phrase.",
          "Highly castable and 98 overall score.", // red-line legacy wording must not leak
        ],
        improvements: ["Let the final button settle for one breath before ending the recording."],
        priority_fixes: [
          {
            headline: "Use one final playback check for the continuous edit.",
            rationale:
              "This protects the already-complete package without inventing a retake blocker.",
          },
        ],
        raw_response: "internal raw response should never appear",
        scores: { overall: 98 },
        defect_risk_ids: ["legacy_report_used_as_v3_spine_proxy"],
      },
      evidence: strongBriefCompleteEvidence(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      briefText: testOneBrief,
      extractedBrief: {
        audition_type: "musical_theatre",
        material_requested: "Side 1 plus contemporary legit MT song",
        framing_required: "Landscape, close-up head-and-shoulders",
      },
    });

    const model = result.model;
    const text = JSON.stringify(model);

    expect(model.submission_verdict).toMatchObject({
      decision: "submit_if_deadline_is_close",
      blocked: false,
    });
    expect(model.brief_achievement).toMatchObject({
      overall_status: "achieved",
      mandatory_status: "clear",
      readiness_impact: "supports_submission",
    });
    expect(model.fix_first).toBeNull();
    expect(model.priority_fixes).toEqual([]);
    expect(model.brief_requirements.map((item) => JSON.stringify(item)).join(" ")).toMatch(
      /Side 1.*song.*continuous video.*Landscape/i,
    );
    expect(model.preserve.join(" ")).toMatch(/opening scene|song storytelling|framing/i);
    expect(model.optional_polish.join(" ")).toMatch(/final button|playback check/i);
    expect(model.do_not_overfix.join(" ")).toMatch(/brief package is complete|marginal polish/i);
    expect(text).not.toMatch(
      /No single public-safe priority fix|Review carefully|highly castable|overall score|raw response|98|category score|poor_audio|muddy_audio/i,
    );
  });

  it("preserves supplied brief detail while suppressing explicit red-line content", () => {
    const result = buildPublicReportViewModel({
      candidateReport: {
        schema_version: "v1-legacy",
        source_family: "legacy_adapter",
        defect_risk_ids: ["legacy_report_used_as_v3_spine_proxy"],
      },
      evidence: strongBriefCompleteEvidence(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      briefText: [
        "Tape Side 1, pages 85-87.",
        "Tape a contemporary legit MT song.",
        "Upload via https://storage.example.com/private.mp4?token=secret-signature.",
        "Landscape, close-up head-and-shoulders.",
      ].join(" "),
      extractedBrief: {
        audition_type: "musical_theatre",
        material_requested: "Side 1 plus contemporary legit MT song",
      },
    });

    const text = JSON.stringify(result.model);

    expect(text).toMatch(/Side 1|contemporary legit MT song|Landscape/i);
    expect(text).not.toMatch(/storage\.example|token=|secret-signature|signed url|raw prompt/i);
  });

  it("quarantines legacy raw report fields when no Step 1 evidence is available", () => {
    const result = buildPublicReportViewModel({
      candidateReport: {
        schema_version: "v1-legacy",
        source_family: "legacy_adapter",
        fix_first: "Raw legacy fix first.",
        improvements: ["Raw legacy improvement."],
        block_reasons: ["Raw legacy block reason."],
        next_take_plan: ["Raw legacy plan."],
        overall_score_final: 95,
        defect_risk_ids: ["legacy_report_used_as_v3_spine_proxy"],
      },
      evidence: null,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });

    const text = JSON.stringify(result.model);
    expect(result.source_kind).toBe("public_report_view_model_limited");
    expect(text).not.toMatch(/Raw legacy|overall_score|95/);
  });

  it("documents explicit section routing boundaries", () => {
    expect(PUBLIC_REPORT_SECTION_ROUTES.map((route) => route.section)).toEqual([
      "submission",
      "brief",
      "fix_hierarchy",
      "next_take_plan",
      "reliability",
      "preserve",
    ]);
    expect(
      PUBLIC_REPORT_SECTION_ROUTES.find((route) => route.section === "fix_hierarchy")
        ?.blocked_input_families,
    ).toEqual(expect.arrayContaining(["raw_report.fix_first", "raw_report.improvements"]));
  });

  it("renders a safe limited state instead of rescuing legacy v1 UI content", () => {
    const html = renderToStaticMarkup(
      createElement(V2ReportView, {
        report: {
          schema_version: "v1-legacy",
          fix_first: "No single public-safe priority fix was available from the evidence pass.",
          improvements: ["Blocked: a major casting brief instruction wasn't followed."],
        },
      }),
    );

    expect(html).toContain("Not assessable");
    expect(html).toContain("This report could not generate a reliable fix-first item");
    expect(html).not.toContain("major casting brief instruction");
    expect(html).not.toContain("No single public-safe priority fix");
  });
});
