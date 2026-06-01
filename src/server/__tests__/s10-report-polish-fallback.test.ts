import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BriefRequirement } from "@/lib/audition-rules";
import { V2ReportView } from "@/components/report/V2ReportView";
import type { EvidencePass } from "@/server/evidence-pass.server";
import { evaluateS10ModuleReadiness } from "@/server/s10-module-readiness.server";
import {
  applyS10ResidualModuleRecovery,
  buildS10ModuleQualityRecoveryReport,
  buildS10ReportPolishFallback,
} from "@/server/s10-report-polish-fallback.server";
import {
  buildRouteReportForPersistence,
  hasS10AuthoritativeModules,
} from "@/server/v2-report-builder.server";

const briefRequirements: BriefRequirement[] = [
  {
    id: "req-side-1",
    brief_text: "Please submit Side 1.",
    summary: "Side 1 acting scene",
    category: "material",
    importance: "mandatory",
    expected_evidence_in_tape: "The uploaded tape contains the Side 1 acting scene.",
    achievement_test: "Side 1 is visible/audible and runs to completion.",
    submission_impact_if_missing: "Missing Side 1 blocks submission readiness.",
    report_destination: "brief_achievement",
    confidence: "high",
  },
  {
    id: "req-song",
    brief_text: "Include one contemporary MT song.",
    summary: "Contemporary MT song",
    category: "material",
    importance: "mandatory",
    expected_evidence_in_tape: "The uploaded tape contains the song.",
    achievement_test: "Song is audible and complete enough to assess.",
    submission_impact_if_missing: "Missing or cut-off song blocks package completion.",
    report_destination: "brief_achievement",
    confidence: "high",
  },
];

function buildEvidence(overrides: Partial<EvidencePass> = {}): EvidencePass {
  return {
    evidence_version: "1",
    audition_type: "musical_theatre",
    observed_tape_sequence: [
      {
        id: "seq-side-1",
        label: "Side 1 acting scene",
        component_type: "acting_scene",
        linked_requirement_ids: ["req-side-1"],
        start_time: "00:03",
        end_time: "00:58",
        present_status: "present",
        completion_status: "complete",
        evidence_summary: "The performer completes the requested Side 1 scene.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        confidence: "high",
        assessability_notes: "",
      },
      {
        id: "seq-song",
        label: "Contemporary MT song",
        component_type: "song",
        linked_requirement_ids: ["req-song"],
        start_time: "01:02",
        end_time: "02:15",
        present_status: "present",
        completion_status: "complete",
        evidence_summary: "The performer sings the requested song after the scene.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        confidence: "high",
        assessability_notes: "",
      },
    ],
    component_verifications: [
      {
        requirement_id: "req-side-1",
        requirement_summary: "Side 1 acting scene",
        observed_status: "present",
        completion_status: "complete",
        evidence_summary: "Side 1 is observed and runs to a clear end.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        timestamp_refs: ["00:03", "00:58"],
        confidence: "high",
        cannot_infer_from_brief_only: true,
        assessability_notes: "",
      },
      {
        requirement_id: "req-song",
        requirement_summary: "Contemporary MT song",
        observed_status: "present",
        completion_status: "complete",
        evidence_summary: "Song is observed and does not cut off in the evidence pass.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        timestamp_refs: ["01:02", "02:15"],
        confidence: "high",
        cannot_infer_from_brief_only: true,
        assessability_notes: "",
      },
    ],
    media_observation_summary: {
      audio_assessable: true,
      video_assessable: true,
      framing_assessable: true,
      continuity_assessable: true,
      abrupt_cutoff_detected: false,
      one_continuous_video_observed: true,
      duration_summary: "Audio and video are assessable across the required package.",
      uncertainties: [],
    },
    detected_components: [
      { type: "acting_scene", weight: 0.5, score: 84, note: "Side 1 observed." },
      { type: "song", weight: 0.5, score: 86, note: "Song observed." },
    ],
    candidate_technique_evidence: [
      {
        label: "Acting clarity",
        safe_evidence_summary: "The scene has clear objective and responsive listening.",
        timestamp: "00:24",
      },
      {
        label: "Vocal steadiness",
        safe_evidence_summary: "The song stays audible with a consistent line.",
        timestamp: "01:28",
      },
    ],
    raw_scores: {
      technical: 86,
      audio: 88,
      vocal: 84,
      acting: 85,
      brief_adherence: 92,
      professional_presentation: 83,
    },
    core_strengths_evidence: [
      { area: "acting", evidence: "The Side 1 scene has clear listening and intention." },
      { area: "vocal", evidence: "The song is audible and presented with a consistent line." },
    ],
    core_improvements_evidence: [
      {
        area: "acting",
        evidence: "Tighten the opening beat so the first objective is clear immediately.",
      },
    ],
    fix_first_evidence: "Keep the full package intact and sharpen the first acting beat.",
    brief_adherence_evidence: {
      material_compliance: "Both required materials are observed.",
      technical_compliance: "The media is assessable.",
      instruction_precision: "The package follows the observed order.",
      professionalism_signals: "The file is reviewable.",
      score_material: 92,
      score_technical: 86,
      score_instruction: 88,
      score_professional: 83,
    },
    category_notes_evidence: {
      technical: "Video is assessable.",
      audio: "Audio is assessable.",
      vocal: "Song is assessable.",
      acting: "Scene is assessable.",
      brief_adherence: "Required components are observed.",
      professional_presentation: "Presentation is clean enough to review.",
    },
    role_fit_evidence: "",
    role_fit_modifier_suggested: 0,
    role_fit_confidence: "medium",
    presentation_evidence: ["The continuous package can be reviewed without a visible cutoff."],
    risk_evidence: [],
    timestamped_evidence: [
      {
        timestamp: "00:24",
        observation: "Acting objective is visible in the Side 1 scene.",
        why_it_matters: "This is the clearest moment to preserve in a retake.",
        linked_category: "acting",
      },
      {
        timestamp: "01:28",
        observation: "Song line remains audible and steady.",
        why_it_matters: "This supports the song component evidence.",
        linked_category: "vocal",
      },
    ],
    evidence_sufficiency: {
      audio_assessable: true,
      video_assessable: true,
      acting_assessable: true,
      vocal_assessable: true,
      movement_assessable: false,
      brief_assessable: true,
      role_fit_assessable: false,
      notes: "Step 1 has enough evidence for an evidence-bound fallback.",
    },
    ...overrides,
  };
}

describe("S10 report polish parser fallback", () => {
  it("builds a full evidence-backed S10 report instead of a limited shell", () => {
    const evidence = buildEvidence();
    const fallback = buildS10ReportPolishFallback({
      evidence,
      briefContext: { scoring_basis: "brief_supplied" },
      briefRequirements,
      auditionTitle: "Professional MT package",
      selectedLevel: "professional",
      mode: "brief",
      reason: "provider_content_not_json_object",
      retryAttempted: true,
      retrySucceeded: false,
    });

    expect(fallback.ok).toBe(true);
    if (!fallback.ok) return;
    expect(fallback.report).toMatchObject({
      source_mode: "s10_ai_report_model",
      report_polish_fallback_used: true,
      polish_fallback_reason: "provider_content_not_json_object",
      polish_retry_attempted: true,
      polish_retry_succeeded: false,
    });
    expect(hasS10AuthoritativeModules(fallback.report)).toBe(true);
    expect(JSON.stringify(fallback.report)).not.toMatch(/report polish unavailable/i);
    expect(JSON.stringify(fallback.report)).not.toMatch(/fix hierarchy was unavailable/i);
    expect(JSON.stringify(fallback.report)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    const readiness = evaluateS10ModuleReadiness({
      report: fallback.report,
      observationContext: {
        observed_tape_sequence: evidence.observed_tape_sequence ?? [],
        component_verifications: evidence.component_verifications ?? [],
        media_observation_summary: evidence.media_observation_summary!,
        source_kind: "two_step_s10_observation",
        limitations: [],
        contradiction_warnings: [],
      },
      briefContext: null,
      briefRequirements,
      selectedLevel: "professional",
      sourceStage: "two_step",
    });
    expect(readiness.thin_shell_blocked).toBe(false);
    expect(readiness.results.filter((result) => result.blocks_report_value)).toEqual([]);

    const persistence = buildRouteReportForPersistence({
      legacyReport: fallback.report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      futureReportEnabled: true,
      s10Context: {
        briefContext: null,
        briefRequirements,
        observedTapeSequence: evidence.observed_tape_sequence,
        componentVerifications: evidence.component_verifications,
        mediaObservationSummary: evidence.media_observation_summary,
        observationSourceKind: "report_embedded_s10_observation",
      },
    });

    expect(persistence.outcome).toBe("v2_persisted");
    if (persistence.outcome !== "v2_persisted") return;
    expect(persistence.reportToPersist.components.length).toBeGreaterThan(0);
    expect(JSON.stringify(persistence.reportToPersist)).not.toMatch(
      /S10 report assembly limitation/i,
    );
  });

  it("builds no-brief module-quality recovery with visible critical modules", () => {
    const evidence = buildEvidence({
      raw_scores: {
        technical: 78,
        audio: 80,
        vocal: null,
        acting: 79,
        brief_adherence: 74,
        professional_presentation: 77,
      },
      category_notes_evidence: {
        technical: "The setup is reviewable with manageable presentation risk.",
        audio: "The voice is audible enough for baseline review.",
        vocal: "",
        acting: "The acting evidence shows a clear playable objective.",
        brief_adherence: "No brief was supplied, so brief achievement is not assessed.",
        professional_presentation:
          "Presentation is suitable for a baseline Emerging / Training review.",
      },
      candidate_technique_evidence: [],
      evidence_sufficiency: {
        audio_assessable: true,
        video_assessable: true,
        acting_assessable: true,
        vocal_assessable: false,
        movement_assessable: false,
        brief_assessable: false,
        role_fit_assessable: false,
        notes: "No brief supplied; acting and setup evidence are assessable.",
      },
    });
    const recovery = buildS10ModuleQualityRecoveryReport({
      evidence,
      briefContext: null,
      briefRequirements: [],
      auditionTitle: "No brief baseline take",
      selectedLevel: "emerging_training",
      mode: "baseline",
      reason: "thin_shell_blocked",
      retryAttempted: true,
      retrySucceeded: false,
    });

    expect(recovery.ok).toBe(true);
    if (!recovery.ok) return;
    expect(recovery.report).toMatchObject({
      report_polish_fallback_used: false,
      s10_module_quality_recovery_used: true,
      module_quality_recovery_reason: "thin_shell_blocked",
      module_repair_retry_attempted: true,
      module_repair_retry_succeeded: false,
    });

    const readiness = evaluateS10ModuleReadiness({
      report: recovery.report,
      observationContext: {
        observed_tape_sequence: evidence.observed_tape_sequence ?? [],
        component_verifications: evidence.component_verifications ?? [],
        media_observation_summary: evidence.media_observation_summary!,
        source_kind: "two_step_s10_observation",
        limitations: [],
        contradiction_warnings: [],
      },
      briefContext: null,
      briefRequirements: [],
      selectedLevel: "emerging_training",
      sourceStage: "two_step",
    });
    expect(readiness.thin_shell_blocked).toBe(false);
    expect(readiness.results.filter((result) => result.blocks_report_value)).toEqual([]);

    const persistence = buildRouteReportForPersistence({
      legacyReport: recovery.report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "baseline",
      futureReportEnabled: true,
      s10Context: {
        briefContext: null,
        briefRequirements: [],
        observedTapeSequence: evidence.observed_tape_sequence,
        componentVerifications: evidence.component_verifications,
        mediaObservationSummary: evidence.media_observation_summary,
        observationSourceKind: "report_embedded_s10_observation",
      },
    });

    expect(persistence.outcome).toBe("v2_persisted");
    if (persistence.outcome !== "v2_persisted") return;
    expect(persistence.reportToPersist.components.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      React.createElement(V2ReportView, {
        report: persistence.reportToPersist,
        takeNumber: 1,
        auditionType: "musical_theatre",
      }),
    );
    expect(html).not.toMatch(/Fix hierarchy was unavailable/i);
    expect(html).not.toMatch(/S10 category score semantics are not available/i);
    expect(html).not.toMatch(/Strengths and preserve guidance are not available/i);
    expect(html).not.toMatch(/Next action plan was unavailable/i);
    expect(html).not.toMatch(/Readiness judgement is not available/i);
    expect(html).not.toMatch(/Professional critique is not available/i);
    expect(html).not.toMatch(/Technique commentary is not available/i);
    expect(html).not.toMatch(/Timestamped or time-banded commentary is not available/i);
    expect(html).not.toMatch(/TapeCoach could not assemble the full S10 report model/i);
    expect(html).not.toMatch(/Professional competitive calibration/i);
    expect(html).not.toMatch(/brief achieved|brief-complete/i);
  });

  it("recovers residual performer-level and technique blockers without weakening readiness", () => {
    const evidence = buildEvidence({
      candidate_technique_evidence: [],
      core_improvements_evidence: [],
      evidence_sufficiency: {
        audio_assessable: true,
        video_assessable: true,
        acting_assessable: true,
        vocal_assessable: false,
        movement_assessable: false,
        brief_assessable: false,
        role_fit_assessable: false,
        notes:
          "No brief supplied; component and media evidence are sufficient for baseline guidance.",
      },
    });
    const recovery = buildS10ModuleQualityRecoveryReport({
      evidence,
      briefContext: null,
      briefRequirements: [],
      auditionTitle: "Residual module recovery take",
      selectedLevel: "emerging_training",
      mode: "baseline",
      reason: "thin_shell_blocked",
      retryAttempted: true,
      retrySucceeded: false,
    });
    expect(recovery.ok).toBe(true);
    if (!recovery.ok) return;

    const report = recovery.report;
    const readinessRecord = report.readiness_score_judgement as Record<string, unknown>;
    readinessRecord.selected_level_calibration = {
      selected_level: "emerging_training",
      what_meets_level: [],
      what_falls_short: [],
      recommendation_impact: "",
    };
    delete report.s10_technique_commentary;

    const before = evaluateS10ModuleReadiness({
      report,
      observationContext: {
        observed_tape_sequence: evidence.observed_tape_sequence ?? [],
        component_verifications: evidence.component_verifications ?? [],
        media_observation_summary: evidence.media_observation_summary!,
        source_kind: "two_step_s10_observation",
        limitations: [],
        contradiction_warnings: [],
      },
      briefContext: null,
      briefRequirements: [],
      selectedLevel: "emerging_training",
      sourceStage: "two_step",
    });
    const residualBlockers = before.results
      .filter((result) => result.blocks_report_value)
      .map((result) => result.report_module);
    expect(residualBlockers.sort()).toEqual([
      "performer level calibration",
      "technique commentary",
    ]);

    const residual = applyS10ResidualModuleRecovery({
      report,
      evidence,
      briefRequirements: [],
      selectedLevel: "emerging_training",
      mode: "baseline",
      residualModules: residualBlockers,
    });
    expect(residual.recoveredModules.sort()).toEqual([
      "performer level calibration",
      "technique commentary",
    ]);
    expect(report).toMatchObject({
      residual_module_recovery_used: true,
      residual_module_recovery_reason: "performer_level_calibration_and_or_technique_commentary",
      residual_modules_recovered: ["performer level calibration", "technique commentary"],
    });

    const after = evaluateS10ModuleReadiness({
      report,
      observationContext: {
        observed_tape_sequence: evidence.observed_tape_sequence ?? [],
        component_verifications: evidence.component_verifications ?? [],
        media_observation_summary: evidence.media_observation_summary!,
        source_kind: "two_step_s10_observation",
        limitations: [],
        contradiction_warnings: [],
      },
      briefContext: null,
      briefRequirements: [],
      selectedLevel: "emerging_training",
      sourceStage: "two_step",
    });
    expect(after.thin_shell_blocked).toBe(false);
    expect(after.results.filter((result) => result.blocks_report_value)).toEqual([]);

    const persistence = buildRouteReportForPersistence({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "baseline",
      futureReportEnabled: true,
      s10Context: {
        briefContext: null,
        briefRequirements: [],
        observedTapeSequence: evidence.observed_tape_sequence,
        componentVerifications: evidence.component_verifications,
        mediaObservationSummary: evidence.media_observation_summary,
        observationSourceKind: "report_embedded_s10_observation",
      },
    });
    expect(persistence.outcome).toBe("v2_persisted");
    if (persistence.outcome !== "v2_persisted") return;
    expect(persistence.reportToPersist.components.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      React.createElement(V2ReportView, {
        report: persistence.reportToPersist,
        takeNumber: 1,
        auditionType: "musical_theatre",
      }),
    );
    expect(html).not.toMatch(/Fix hierarchy was unavailable/i);
    expect(html).not.toMatch(/S10 category score semantics are not available/i);
    expect(html).not.toMatch(/Strengths and preserve guidance are not available/i);
    expect(html).not.toMatch(/Next action plan was unavailable/i);
    expect(html).not.toMatch(/Readiness judgement is not available/i);
    expect(html).not.toMatch(/Professional critique is not available/i);
    expect(html).not.toMatch(/Technique commentary is not available/i);
    expect(html).not.toMatch(/Timestamped or time-banded commentary is not available/i);
    expect(html).not.toMatch(/TapeCoach could not assemble the full S10 report model/i);
    expect(html).not.toMatch(/Professional competitive calibration/i);
    expect(html).not.toMatch(/brief achieved|brief-complete/i);
  });

  it("does not fake a full report when Step 1 evidence is insufficient", () => {
    const fallback = buildS10ReportPolishFallback({
      evidence: buildEvidence({
        observed_tape_sequence: [],
        component_verifications: [],
        timestamped_evidence: [],
        core_strengths_evidence: [],
        core_improvements_evidence: [],
        candidate_technique_evidence: [],
        evidence_sufficiency: {
          audio_assessable: false,
          video_assessable: false,
          acting_assessable: false,
          vocal_assessable: false,
          movement_assessable: false,
          brief_assessable: false,
          role_fit_assessable: false,
          notes: "No usable Step 1 evidence.",
        },
      }),
      briefContext: null,
      briefRequirements,
      auditionTitle: "Insufficient evidence",
      selectedLevel: "professional",
      mode: "brief",
      reason: "provider_content_not_json_object",
      retryAttempted: true,
      retrySucceeded: false,
    });

    expect(fallback).toEqual({
      ok: false,
      reason: "missing_or_insufficient_step1_evidence",
    });
  });

  it("withholds the score and avoids a retake verdict when Step 1 returned no category scores", () => {
    // Step 1 under-produced: raw_scores absent/defaulted to 0 (the real failing
    // run). The brief is still supported by observed components, so the fallback
    // must not show 0 / "Retake required".
    const evidence = buildEvidence({
      raw_scores: {
        technical: 0,
        audio: 0,
        vocal: null,
        acting: 0,
        brief_adherence: 0,
        professional_presentation: 0,
      },
    });
    const recovery = buildS10ModuleQualityRecoveryReport({
      evidence,
      briefContext: null,
      briefRequirements,
      auditionTitle: "Step 1 under-produced scores",
      selectedLevel: "professional",
      mode: "brief",
      reason: "thin_shell_blocked",
      retryAttempted: true,
      retrySucceeded: false,
    });
    expect(recovery.ok).toBe(true);
    if (!recovery.ok) return;
    // Score withheld (renders as "—"), not a misleading 0.
    expect(recovery.report.overall_score).toBeNull();
    const readiness = recovery.report.readiness_score_judgement as Record<string, unknown>;
    expect(readiness.decision).not.toBe("retake_required_if_possible");
    expect(readiness.decision).toBe("review_carefully");
  });

  it("renders genuine category scores normally when Step 1 produced them", () => {
    const recovery = buildS10ModuleQualityRecoveryReport({
      evidence: buildEvidence(),
      briefContext: null,
      briefRequirements,
      auditionTitle: "Scored take",
      selectedLevel: "professional",
      mode: "brief",
      reason: "thin_shell_blocked",
      retryAttempted: true,
      retrySucceeded: false,
    });
    expect(recovery.ok).toBe(true);
    if (!recovery.ok) return;
    expect(typeof recovery.report.overall_score).toBe("number");
    expect(recovery.report.overall_score as number).toBeGreaterThan(0);
  });

  it("never leaks raw requirement ids into selected-level shortfall prose", () => {
    // Make the song requirement not assessable so the matrix's id-keyed arrays
    // are non-empty; the rendered shortfall must use the human summary, not the
    // raw requirement id.
    const evidence = buildEvidence({
      component_verifications: [
        {
          requirement_id: "req-side-1",
          requirement_summary: "Side 1 acting scene",
          observed_status: "present",
          completion_status: "complete",
          evidence_summary: "Side 1 is observed and runs to a clear end.",
          observed_from_media: true,
          evidence_basis: "observed_audio_video",
          timestamp_refs: ["00:03", "00:58"],
          confidence: "high",
          cannot_infer_from_brief_only: true,
          assessability_notes: "",
        },
        {
          requirement_id: "req-song",
          requirement_summary: "Contemporary MT song",
          observed_status: "uncertain",
          completion_status: "uncertain",
          evidence_summary: "The song section could not be confirmed from the observed media.",
          observed_from_media: false,
          evidence_basis: "uncertainty",
          timestamp_refs: [],
          confidence: "low",
          cannot_infer_from_brief_only: true,
          assessability_notes: "",
        },
      ],
    });
    const recovery = buildS10ModuleQualityRecoveryReport({
      evidence,
      briefContext: null,
      briefRequirements,
      auditionTitle: "Id leak guard",
      selectedLevel: "professional",
      mode: "brief",
      reason: "thin_shell_blocked",
      retryAttempted: true,
      retrySucceeded: false,
    });
    expect(recovery.ok).toBe(true);
    if (!recovery.ok) return;
    const readiness = recovery.report.readiness_score_judgement as Record<string, unknown>;
    const calibration = readiness.selected_level_calibration as Record<string, unknown>;
    const fallsShort = (calibration.what_falls_short as string[] | undefined) ?? [];
    for (const line of fallsShort) {
      expect(line).not.toMatch(/\breq[-_]\w+\b/);
      expect(line).not.toMatch(/^\s*br\d+\s*$/i);
    }
  });
});
