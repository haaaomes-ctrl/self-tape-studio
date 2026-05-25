import { describe, expect, it } from "vitest";
import { normaliseBriefAchievementMatrix } from "@/server/s10-brief-achievement-matrix.server";
import { applyS10TechniqueLibraryCommentary } from "@/server/s10-technique-library-commentary.server";
import { applyS10TimestampedCommentary } from "@/server/s10-timestamped-commentary.server";
import { resolveS10ObservationContext } from "@/server/s10-observation-context.server";
import { buildV2Report } from "@/server/v2-report-builder.server";
import {
  buildS10CanaryAReportInput,
  s10CanaryAExpectedReportModules,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  s10StrongCompleteProfessionalExpectedReportModules,
} from "@/test-fixtures/s10-strong-complete-professional";

function s10ContextFromResolution(
  report: Record<string, unknown>,
  resolved = resolveS10ObservationContext({ singlePassOutput: report }),
) {
  return {
    briefContext: report.brief_context,
    briefRequirements: report.brief_requirements,
    observedTapeSequence: resolved.observed_tape_sequence,
    componentVerifications: resolved.component_verifications,
    mediaObservationSummary: resolved.media_observation_summary,
    observationSourceKind: resolved.source_kind,
  };
}

describe("S10.P1 single-pass component evidence preservation", () => {
  it("preserves strong-complete S10 component verification when two-step evidence is absent", () => {
    const previous = process.env.TWO_STEP_ANALYSIS_ENABLED;
    process.env.TWO_STEP_ANALYSIS_ENABLED = "false";
    try {
      const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
      const resolved = resolveS10ObservationContext({
        twoStepEvidence: null,
        singlePassOutput: report,
      });

      expect(resolved.source_kind).toBe("single_pass_s10_observation");
      expect(resolved.component_verifications.map((item) => item.requirement_id)).toEqual(
        s10StrongCompleteProfessionalExpectedReportModules.component_verifications.map(
          (item) => item.requirement_id,
        ),
      );
      expect(resolved.component_verifications[0]).toMatchObject({
        requirement_summary: "Required Side 1 acting scene",
        observed_status: "present",
        completion_status: "complete",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
      });

      const technique = applyS10TechniqueLibraryCommentary({
        report,
        matrix: report.brief_achievement_matrix as never,
        readiness: report.readiness_score_judgement as never,
        fixHierarchy: report.s10_fix_hierarchy as never,
        nextActionPlan: report.s10_next_action_plan as never,
        professionalCritique: report.s10_professional_critique as never,
        componentVerifications: resolved.component_verifications,
        mediaObservationSummary: resolved.media_observation_summary,
      });
      expect(technique.commentary.acting.status).toBe("assessable");
      expect(technique.commentary.vocal_singing.status).toBe("assessable");

      const timestamped = applyS10TimestampedCommentary({
        report,
        matrix: report.brief_achievement_matrix as never,
        readiness: report.readiness_score_judgement as never,
        fixHierarchy: report.s10_fix_hierarchy as never,
        nextActionPlan: report.s10_next_action_plan as never,
        professionalCritique: report.s10_professional_critique as never,
        techniqueCommentary: technique.commentary,
        observedTapeSequence: resolved.observed_tape_sequence,
        componentVerifications: resolved.component_verifications,
        timestampedEvidence: [],
      });
      expect(timestamped.commentary.notes.length).toBeGreaterThan(0);

      const v2 = buildV2Report({
        legacyReport: report,
        futureDimensions: null,
        auditionType: "musical_theatre",
        mode: "brief",
        s10Context: s10ContextFromResolution(report, resolved) as never,
      });
      expect(v2.components.length).toBeGreaterThan(0);
      expect(v2.components.map((component) => component.label).join(" ")).toContain("Side 1");
      expect(v2.s10_view_model?.section_source_map.component_breakdown.source).toBe(
        "s10_authoritative_module",
      );
      expect(v2.s10_view_model?.section_source_map.component_breakdown.source_kind).toBe(
        "single_pass_s10_observation",
      );
    } finally {
      if (previous == null) delete process.env.TWO_STEP_ANALYSIS_ENABLED;
      else process.env.TWO_STEP_ANALYSIS_ENABLED = previous;
    }
  });

  it("keeps Canary A missing Side 1 truth from single-pass S10 component verification", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    const resolved = resolveS10ObservationContext({ singlePassOutput: report });
    report.brief_achievement_matrix = normaliseBriefAchievementMatrix({
      matrix: report.brief_achievement_matrix,
      briefRequirements: report.brief_requirements as never,
      componentVerifications: resolved.component_verifications,
      observedTapeSequence: resolved.observed_tape_sequence,
      mediaObservationSummary: resolved.media_observation_summary,
    });

    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: s10ContextFromResolution(report, resolved) as never,
    });
    const rendered = JSON.stringify(v2);

    expect(resolved.source_kind).toBe("single_pass_s10_observation");
    expect(report.brief_achievement_matrix).toMatchObject({
      overall_status: "not_achieved",
      mandatory_status: "blocked",
    });
    expect(rendered).toContain("Required Side 1 acting scene");
    expect(rendered).not.toContain("Naturalistic acting with good pace");
    expect(rendered).not.toContain("Correct material, orientation, and framing");
  });

  it("renders a component-verification limitation instead of legacy detected components when S10 evidence is missing", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    delete report.observed_tape_sequence;
    delete report.component_verifications;
    delete report.media_observation_summary;

    const resolved = resolveS10ObservationContext({ singlePassOutput: report });
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: s10ContextFromResolution(report, resolved) as never,
    });

    expect(resolved.source_kind).toBe("unavailable");
    expect(v2.components).toEqual([]);
    expect(v2.s10_view_model?.section_source_map.component_breakdown).toMatchObject({
      source: "specific_limitation",
      source_kind: "unavailable",
      limitation: "Component verification was unavailable for this S10 report.",
    });
    expect(JSON.stringify(v2)).not.toContain("Strong choices.");
  });

  it("prefers two-step S10 observation over contradictory report-embedded observation", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    report.component_verifications =
      s10StrongCompleteProfessionalExpectedReportModules.component_verifications;
    report.observed_tape_sequence =
      s10StrongCompleteProfessionalExpectedReportModules.observed_tape_sequence;
    report.media_observation_summary =
      s10StrongCompleteProfessionalExpectedReportModules.media_observation_summary;

    const resolved = resolveS10ObservationContext({
      twoStepEvidence: {
        observed_tape_sequence: s10CanaryAExpectedReportModules.observed_tape_sequence,
        component_verifications: s10CanaryAExpectedReportModules.component_verifications,
        media_observation_summary: s10CanaryAExpectedReportModules.media_observation_summary,
      } as never,
      singlePassOutput: report,
    });

    expect(resolved.source_kind).toBe("two_step_s10_observation");
    expect(
      resolved.component_verifications.find((item) =>
        /Side 1 acting scene/i.test(item.requirement_summary),
      )?.observed_status,
    ).toBe("absent");
  });

  it("does not let media-only two-step context block valid single-pass component verification", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    const resolved = resolveS10ObservationContext({
      twoStepEvidence: {
        observed_tape_sequence: [],
        component_verifications: [],
        media_observation_summary:
          s10StrongCompleteProfessionalExpectedReportModules.media_observation_summary,
      } as never,
      singlePassOutput: report,
    });

    expect(resolved.source_kind).toBe("single_pass_s10_observation");
    expect(
      resolved.component_verifications.find((item) =>
        /Side 1 acting scene/i.test(item.requirement_summary),
      )?.observed_status,
    ).toBe("present");
  });

  it("downgrades or rejects report-embedded component evidence that is not S10 media-grounded", () => {
    const deterministicMetadataReport = {
      component_verifications: [
        {
          requirement_id: "req-side-1",
          requirement_summary: "Required Side 1 acting scene",
          observed_status: "present",
          completion_status: "complete",
          evidence_summary: "Metadata suggests the requested side exists.",
          observed_from_media: false,
          evidence_basis: "deterministic_metadata",
          timestamp_refs: [],
          confidence: "high",
          cannot_infer_from_brief_only: true,
          assessability_notes: "",
        },
      ],
    };
    const downgraded = resolveS10ObservationContext({
      singlePassOutput: deterministicMetadataReport,
    });
    expect(downgraded.component_verifications[0]).toMatchObject({
      observed_status: "uncertain",
      completion_status: "uncertain",
    });

    const missingCannotInferReport = {
      component_verifications: [
        {
          requirement_id: "req-side-1",
          requirement_summary: "Required Side 1 acting scene",
          observed_status: "present",
          completion_status: "complete",
          evidence_summary: "Brief text asks for Side 1.",
          observed_from_media: true,
          evidence_basis: "observed_audio_video",
          timestamp_refs: [],
          confidence: "high",
          assessability_notes: "",
        },
      ],
    };
    const rejected = resolveS10ObservationContext({
      singlePassOutput: missingCannotInferReport,
    });
    expect(rejected.component_verifications).toEqual([]);
    expect(rejected.source_kind).toBe("unavailable");
  });

  it("preserves legacy detected_components fallback for non-S10 reports only", () => {
    const legacyReport = {
      detected_components: [{ type: "acting_scene", score: 88, note: "Legacy component." }],
      scores: { acting: 88 },
      overall_score: 88,
    };

    const v2 = buildV2Report({
      legacyReport,
      futureDimensions: null,
      auditionType: "acting_scene",
      mode: "brief",
    });

    expect(v2.source_mode).toBe("legacy_projection");
    expect(v2.components).toHaveLength(1);
    expect(v2.components[0]?.note).toBe("Legacy component.");
  });
});
