import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "@/components/report/V2ReportView";
import {
  buildV2Report,
  hasS10AuthoritativeModules,
  validateV2PublicBoundary,
} from "@/server/v2-report-builder.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
  s10CanaryAComponentVerifications,
  s10CanaryAExpectedReportModules,
  s10CanaryAExpectedViewModel,
  s10CanaryALegacyFalsePositiveRawReport,
  s10CanaryAOperatorFacts,
} from "@/test-fixtures/s10-canary-a-incomplete-package";

function buildCanaryV2() {
  const report = buildS10CanaryAReportInput();
  return {
    report,
    v2: buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    }),
  };
}

function render(report: Record<string, unknown>) {
  return renderToStaticMarkup(
    React.createElement(V2ReportView, {
      report,
      takeNumber: 1,
      auditionType: "musical_theatre",
    }),
  );
}

describe("S10.11 Canary A incomplete mandatory package fixture", () => {
  it("is a deterministic source-level fixture and cannot become strong-complete", () => {
    expect(s10CanaryAOperatorFacts.selected_level).toBe("professional");
    expect(s10CanaryAOperatorFacts.operator_observed_tape_facts.side_1).toBe("absent");
    expect(s10CanaryAExpectedReportModules.readiness_score_judgement.decision).toBe(
      "retake_required_if_possible",
    );
    expect(s10CanaryAExpectedReportModules.brief_achievement_matrix.overall_status).not.toBe(
      "achieved",
    );
    expect(s10CanaryAExpectedReportModules.brief_achievement_matrix.mandatory_status).not.toBe(
      "clear",
    );
    const side1 = s10CanaryAComponentVerifications.find(
      (item) => item.requirement_id === "req-side-1",
    );
    expect(side1?.observed_status).toBe("absent");
    expect(side1?.completion_status).not.toBe("complete");
  });

  it("keeps the legacy false-positive raw report unchanged and diagnostic only", () => {
    const { report, v2 } = buildCanaryV2();
    const historicalSnapshot = JSON.stringify(s10CanaryALegacyFalsePositiveRawReport);

    expect(JSON.stringify(s10CanaryALegacyFalsePositiveRawReport)).toBe(historicalSnapshot);
    expect(report.overall_score).toBe(93);
    expect(report.brief_adherence_breakdown).toMatchObject({ material_compliance: 100 });
    expect(JSON.stringify(report)).toContain("Naturalistic acting with good pace");
    expect(JSON.stringify(report)).toContain("00:05");

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.overall_readiness).toBe(42);
    expect(v2.brief_adherence_breakdown).toMatchObject({ material_compliance: 25 });
    expect(v2.fix_first).toMatch(/Side 1/i);
    expect(JSON.stringify(v2)).not.toContain("Naturalistic acting with good pace");
    expect(JSON.stringify(v2)).not.toContain("Correct material");
    expect(JSON.stringify(v2)).not.toContain("00:05");
  });

  it("uses S10 modules as source of truth for model/view routing", () => {
    const { report, v2 } = buildCanaryV2();
    expect(hasS10AuthoritativeModules(report)).toBe(true);
    expect(validateV2PublicBoundary(v2, report).ok).toBe(true);
    expect(v2.s10_view_model?.source_mode).toBe("s10_ai_report_model");
    for (const section of s10CanaryAExpectedViewModel.required_authoritative_sections) {
      const entry = v2.s10_view_model?.section_source_map[section];
      expect(entry?.source).toBe("s10_authoritative_module");
      expect(`${entry?.module ?? ""} ${entry?.limitation ?? ""}`).not.toMatch(/raw_report/i);
    }
    expect(v2.s10_view_model?.recommendation?.decision).toBe("retake_required_if_possible");
    expect(v2.s10_view_model?.brief_achievement_matrix?.requirement_results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirement_id: "req-side-1",
          observed_status: "absent",
          achievement_status: "not_achieved",
        }),
        expect.objectContaining({
          requirement_id: "req-song",
          observed_status: "partially_present",
          completion_status: "cut_off",
        }),
      ]),
    );
    expect(v2.s10_view_model?.fix_hierarchy?.fix_first?.title).toMatch(/Side 1/i);
    expect(v2.s10_view_model?.technique_commentary?.acting.status).toBe("not_assessable");
    expect(v2.s10_view_model?.timestamped_commentary?.notes[0]?.display_label).toBe("Not observed");
  });

  it("prevents legacy fields from overriding component, score, fix and timestamp semantics", () => {
    const { v2 } = buildCanaryV2();
    const output = JSON.stringify(v2);

    expect(v2.components.some((component) => component.component_type === "acting_scene")).toBe(
      false,
    );
    expect(v2.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Required Side 1 acting scene",
          what_is_assessable: "absent; incomplete",
          score: null,
        }),
      ]),
    );
    expect(v2.overall_readiness).not.toBe(93);
    expect(v2.verdict).not.toBe("Strong for this level");
    expect(v2.timestamped_notes).toEqual([]);
    expect(output).not.toContain('material_compliance":100');
    expect(output).not.toContain("Correct the file naming convention");
    expect(output).not.toContain("No single public-safe priority fix was available");
  });

  it("renders the corrected S10 route report and rejects old PDF false positives", () => {
    const { v2 } = buildCanaryV2();
    const html = render(v2 as unknown as Record<string, unknown>);

    for (const allowed of s10CanaryAExpectedViewModel.allowed_route_content) {
      expect(html).toContain(allowed);
    }
    expect(html).toContain("42");
    expect(html).toContain("Record/include the full required Side 1 acting scene");
    expect(html).toContain("Playback-check the end of the song");
    expect(html).toContain("Not observed");
    expect(html).not.toContain("93");

    for (const forbidden of s10CanaryAExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/\bcomplete package\b/i);
  });
});
