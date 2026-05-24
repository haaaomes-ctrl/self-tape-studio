import { describe, expect, it } from "vitest";
import {
  buildV2Report,
  hasS10AuthoritativeModules,
  validateV2PublicBoundary,
} from "@/server/v2-report-builder.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
  s10CanaryAExpectedViewModel,
} from "@/test-fixtures/s10-canary-a-incomplete-package";

describe("S10 report view-model routing", () => {
  it("builds an authoritative S10 view model and blocks raw-report authority", () => {
    const legacy = buildS10CanaryAReportInput();
    const snapshot = JSON.stringify(legacy);
    const v2 = buildV2Report({
      legacyReport: legacy,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });

    expect(hasS10AuthoritativeModules(legacy)).toBe(true);
    expect(JSON.stringify(legacy)).toBe(snapshot);
    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.s10_view_model?.source_mode).toBe("s10_ai_report_model");
    for (const section of s10CanaryAExpectedViewModel.required_authoritative_sections) {
      expect(v2.s10_view_model?.section_source_map[section].source).toBe(
        "s10_authoritative_module",
      );
      expect(v2.s10_view_model?.section_source_map[section].module).not.toMatch(/raw_report/i);
    }
    expect(v2.s10_view_model?.section_source_map.component_breakdown.module).toContain(
      "component_verifications",
    );
    expect(v2.overall_readiness).toBe(42);
    expect(v2.headline).toMatch(/Retake required/i);
    expect(v2.fix_first).toMatch(/Side 1/i);
    const output = JSON.stringify(v2);
    for (const forbidden of s10CanaryAExpectedViewModel.forbidden_route_content) {
      expect(output).not.toContain(forbidden);
    }
    expect(validateV2PublicBoundary(v2, legacy).ok).toBe(true);
  });

  it("renders specific limitations when an S10-covered module is missing", () => {
    const legacy = buildS10CanaryAReportInput();
    delete (legacy as Record<string, unknown>).s10_technique_commentary;
    const v2 = buildV2Report({
      legacyReport: legacy,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    expect(v2.s10_view_model?.section_source_map.technique_commentary.source).toBe(
      "specific_limitation",
    );
    expect(v2.s10_view_model?.limitations).toContain(
      "Technique commentary is not available for this report.",
    );
  });

  it("does not force non-S10 legacy reports into S10 source mode", () => {
    const v2 = buildV2Report({
      legacyReport: { overall_score_final: 70, scores: { audio: 70 } },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });
    expect(v2.source_mode).toBe("legacy_projection");
    expect(v2.s10_view_model).toBeUndefined();
  });
});
