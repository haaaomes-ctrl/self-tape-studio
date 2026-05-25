import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "@/components/report/V2ReportView";
import {
  buildRouteReportForPersistence,
  buildV2Report,
  type BuildV2ReportArgs,
} from "@/server/v2-report-builder.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

function render(report: Record<string, unknown>) {
  return renderToStaticMarkup(
    React.createElement(V2ReportView, {
      report,
      takeNumber: 1,
      auditionType: "musical_theatre",
    }),
  );
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

describe("S10.P1e hard V2 route boundary", () => {
  it("persists a limited S10 V2 report instead of falling back to v1 when S10 build throws", () => {
    const legacyReport = buildS10CanaryAReportInput();
    const result = buildRouteReportForPersistence({
      legacyReport,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      futureReportEnabled: true,
      s10Context: buildS10CanaryAViewContext() as never,
      buildV2: (() => {
        throw new Error("simulated S10 V2 build failure");
      }) as (args: BuildV2ReportArgs) => never,
    });

    expect(result.outcome).toBe("s10_limited_v2_persisted");
    if (result.outcome !== "s10_limited_v2_persisted") throw new Error("expected limited v2");
    expect(result.reportToPersist.schema_version).toBe("v2-component");
    expect(result.reportToPersist.source_mode).toBe("s10_ai_report_model");
    expect(result.reportToPersist.report_status).toBe("limited");
    expect(JSON.stringify(result.reportToPersist)).toContain(
      "No legacy report was used as a substitute.",
    );
    expect(JSON.stringify(result.reportToPersist)).not.toContain("Take 1 · 93");
    expect(JSON.stringify(result.reportToPersist)).not.toContain("Correct material");
  });

  it("persists a limited S10 V2 report instead of falling back to v1 when validation fails", () => {
    const result = buildRouteReportForPersistence({
      legacyReport: buildS10CanaryAReportInput(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      futureReportEnabled: true,
      s10Context: buildS10CanaryAViewContext() as never,
      validateV2: (v2) => {
        const report = v2 as Record<string, unknown>;
        return report.report_status === "limited"
          ? { ok: true }
          : { ok: false, reason: "simulated_validation_failure" };
      },
    });

    expect(result.outcome).toBe("s10_limited_v2_persisted");
    if (result.outcome !== "s10_limited_v2_persisted") throw new Error("expected limited v2");
    expect(result.reportToPersist.source_mode).toBe("s10_ai_report_model");
    expect(result.reportToPersist.report_status).toBe("limited");
  });

  it("keeps non-S10 legacy passthrough when V2 build fails", () => {
    const legacyReport = {
      overall_score: 88,
      headline: "Legacy headline",
      components: [{ type: "scene", note: "Legacy component." }],
    };
    const result = buildRouteReportForPersistence({
      legacyReport,
      futureDimensions: null,
      auditionType: "acting_scene",
      mode: "brief",
      futureReportEnabled: true,
      buildV2: (() => {
        throw new Error("legacy build failure");
      }) as (args: BuildV2ReportArgs) => never,
    });

    expect(result.outcome).toBe("legacy_passthrough");
    expect(result.reportToPersist).toBe(legacyReport);
  });

  it("does not read legacy header fields when an S10 view model exists", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    const v2 = buildStrong(report) as unknown as Record<string, unknown>;
    v2.overall_readiness = 12;
    v2.headline = "Strong for this level";
    v2.insight = "Legacy insight should not render.";
    v2.verdict = "Legacy verdict";
    const html = render(v2);

    expect(html).toContain("Submit: strong complete professional package");
    expect(html).toContain("91");
    expect(html).not.toContain("Strong for this level");
    expect(html).not.toContain("Legacy insight should not render");
    expect(html).not.toContain("Legacy verdict");
  });

  it("does not read compatibility component/category payload fields in S10 mode", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    }) as unknown as Record<string, unknown>;

    const s10 = v2.s10_view_model as Record<string, unknown>;
    s10.component_breakdown = [];
    (s10.score_summary as Record<string, unknown>).category_scores = [];
    const sourceMap = s10.section_source_map as Record<string, Record<string, unknown>>;
    sourceMap.component_breakdown = {
      source: "specific_limitation",
      module: "component_verifications",
      limitation: "Component verification was unavailable for this S10 report.",
    };
    sourceMap.category_scores = {
      source: "specific_limitation",
      module: "readiness_score_judgement.category_scores",
      limitation: "S10 category score semantics are not available for this report.",
    };
    v2.components = [{ type: "legacy acting scene", note: "Naturalistic acting with good pace" }];
    v2.scores = { acting: 93, vocal: 94, brief_adherence: 100 };
    v2.category_notes = { acting: "Correct material, orientation, and framing" };

    const html = render(v2);

    expect(html).toContain("Component verification was unavailable for this S10 report.");
    expect(html).toContain("S10 category score semantics are not available for this report.");
    expect(html).not.toContain("Naturalistic acting with good pace");
    expect(html).not.toContain("Correct material, orientation, and framing");
    expect(html).not.toContain(">93<");
  });
});
