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
    expect(model.must_fix_before_submitting.join(" ")).toMatch(/song/i);
    expect(JSON.stringify(model.next_take_plan)).toMatch(/Side 1 acting scene/i);
    expect(JSON.stringify(model.next_take_plan)).toMatch(/song/i);
    expect(model.do_not_overfix.join(" ")).toMatch(/missing required material/i);
    expect(text).not.toMatch(
      /No single public-safe priority fix|Not ready to send|poor_audio|muddy_audio|audio is too unclear|"ok"|major casting brief instruction/i,
    );
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
