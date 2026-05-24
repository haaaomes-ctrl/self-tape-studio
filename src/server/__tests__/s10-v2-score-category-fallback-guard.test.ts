import { describe, expect, it } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

function buildCanary(report: Record<string, unknown> = buildS10CanaryAReportInput()) {
  return buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  });
}

function buildStrong(
  report: Record<string, unknown> = buildS10StrongCompleteProfessionalReportInput(),
) {
  return buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
}

describe("S10.P1b V2 score/category fallback guard", () => {
  it("renders valid S10 score and category data from readiness semantics", () => {
    const report = buildS10StrongCompleteProfessionalReportInput();
    const v2 = buildStrong(report);

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.overall_readiness).toBe(91);
    expect(v2.overall_readiness).not.toBe(report.overall_score);
    expect(v2.scores).toMatchObject({
      acting: 91,
      vocal: 92,
      brief_adherence: 94,
    });
    expect(v2.scores?.acting).not.toBe(report.scores.acting);
    expect(v2.category_notes?.acting).toContain("Side 1 is present");
    expect(v2.brief_adherence_breakdown).toMatchObject({ material_compliance: 94 });
    expect(v2.s10_view_model?.section_source_map.score_summary).toMatchObject({
      source: "s10_authoritative_module",
      module: "readiness_score_judgement",
    });
    expect(v2.s10_view_model?.section_source_map.category_scores).toMatchObject({
      source: "s10_authoritative_module",
      module: "readiness_score_judgement.category_scores",
    });
    expect(v2.s10_view_model?.section_source_map.brief_adherence_material_compliance).toMatchObject(
      {
        source: "s10_authoritative_module",
        module: "readiness_score_judgement.brief_completion_score",
      },
    );
  });

  it("does not recover legacy overall/category fields when S10 readiness is missing", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    delete report.readiness_score_judgement;
    const snapshot = JSON.stringify(report);

    const v2 = buildCanary(report);

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.overall_readiness).toBeNull();
    expect(v2.headline).not.toBe("Strong for this level");
    expect(v2.verdict).toBeNull();
    expect(v2.scores).toBeNull();
    expect(v2.category_notes).toBeNull();
    expect(v2.category_rationale).toBeNull();
    expect(v2.brief_adherence_breakdown).toMatchObject({ material_compliance: null });
    expect(JSON.stringify(v2)).not.toContain('"overall_readiness":93');
    expect(JSON.stringify(v2)).not.toContain("Correct material, orientation, and framing");
    expect(v2.s10_view_model?.section_source_map.score_summary).toMatchObject({
      source: "specific_limitation",
      module: "readiness_score_judgement",
    });
    expect(v2.s10_view_model?.section_source_map.category_scores).toMatchObject({
      source: "specific_limitation",
      module: "readiness_score_judgement.category_scores",
    });
    expect(v2.s10_view_model?.section_source_map.brief_adherence_material_compliance).toMatchObject(
      {
        source: "specific_limitation",
        module: "readiness_score_judgement.brief_completion_score",
      },
    );
    expect(JSON.stringify(report)).toBe(snapshot);
  });

  it("does not use legacy categories when only S10 category rows are missing", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    const readiness = report.readiness_score_judgement as Record<string, unknown>;
    readiness.category_scores = [];
    readiness.category_rationale = {};
    readiness.brief_completion_score = null;

    const v2 = buildCanary(report);

    expect(v2.overall_readiness).toBe(42);
    expect(v2.scores).toBeNull();
    expect(v2.category_notes).toBeNull();
    expect(v2.category_rationale).toBeNull();
    expect(v2.brief_adherence_breakdown).toMatchObject({ material_compliance: null });
    expect(JSON.stringify(v2)).not.toContain('"material_compliance":100');
    expect(JSON.stringify(v2)).not.toContain("Naturalistic acting with good pace");
    expect(JSON.stringify(v2)).not.toContain("Correct material, orientation, and framing");
    expect(v2.s10_view_model?.section_source_map.score_summary.source).toBe(
      "s10_authoritative_module",
    );
    expect(v2.s10_view_model?.section_source_map.category_scores.source).toBe(
      "specific_limitation",
    );
    expect(v2.s10_view_model?.section_source_map.category_rationale.source).toBe(
      "specific_limitation",
    );
    expect(v2.s10_view_model?.section_source_map.brief_adherence_material_compliance.source).toBe(
      "specific_limitation",
    );
  });

  it("keeps Canary A on S10 score truth despite false-positive legacy scores", () => {
    const report = buildS10CanaryAReportInput();
    const v2 = buildCanary(report);
    const output = JSON.stringify(v2);

    expect(v2.overall_readiness).toBe(42);
    expect(v2.scores).toMatchObject({ brief_adherence: 25, audio: 86, technical: 82 });
    expect(v2.scores?.brief_adherence).not.toBe(report.scores.brief_adherence);
    expect(v2.brief_adherence_breakdown).toMatchObject({ material_compliance: 25 });
    expect(output).not.toContain('"overall_readiness":93');
    expect(output).not.toContain('"material_compliance":100');
    expect(output).not.toContain("Correct material");
    expect(output).not.toContain("Single-file submission as requested");
    expect(output).not.toContain("Naturalistic acting with good pace");
  });

  it("preserves non-S10 legacy score and category fallback behavior", () => {
    const legacyReport = {
      overall_score: 93,
      overall_score_final: 91,
      scores: { acting: 88, vocal: 89, audio: 82 },
      category_notes: { acting: "Legacy acting note." },
      category_rationale: { acting: { what_works: "Legacy rationale." } },
      brief_adherence_breakdown: { material_compliance: 100 },
    };

    const v2 = buildV2Report({
      legacyReport,
      futureDimensions: null,
      auditionType: "acting_scene",
      mode: "brief",
    });

    expect(v2.source_mode).toBe("legacy_projection");
    expect(v2.overall_readiness).toBe(91);
    expect(v2.scores).toMatchObject({ acting: 88, vocal: 89, audio: 82 });
    expect(v2.category_notes).toEqual({ acting: "Legacy acting note." });
    expect(v2.category_rationale).toEqual({ acting: { what_works: "Legacy rationale." } });
    expect(v2.brief_adherence_breakdown).toEqual({ material_compliance: 100 });
  });
});
