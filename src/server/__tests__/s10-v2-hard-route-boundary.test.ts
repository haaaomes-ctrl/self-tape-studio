import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "@/components/report/V2ReportView";
import {
  buildS10LimitedV2Report,
  buildRouteReportForPersistence,
  buildV2Report,
  type BuildV2ReportArgs,
  validateV2PublicBoundary,
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
  it("rejects S10 source-mode payloads without a view model", () => {
    const malformed = {
      schema_version: "v2-component",
      source_mode: "s10_ai_report_model",
      overall_readiness: 93,
      headline: "Strong for this level",
    };

    expect(validateV2PublicBoundary(malformed).ok).toBe(false);
  });

  it("renders only the S10 limitation surface for malformed S10 route payloads", () => {
    const html = render({
      schema_version: "v2-component",
      source_mode: "s10_ai_report_model",
      overall_readiness: 93,
      headline: "Strong for this level",
      insight: "Legacy insight should not render.",
      verdict: "Legacy verdict",
      reliability: "high",
      components: [{ type: "legacy acting scene", note: "Naturalistic acting with good pace" }],
      scores: { acting: 93 },
      fix_first: "Correct the file naming convention",
      priority_fixes: [{ headline: "Legacy fix should not render." }],
    });

    expect(html).toContain("S10 report assembly limitation");
    expect(html).toContain("No legacy report was used as a substitute.");
    expect(html).not.toContain("Strong for this level");
    expect(html).not.toContain("Legacy insight should not render");
    expect(html).not.toContain("Legacy verdict");
    expect(html).not.toContain("Reliability");
    expect(html).not.toContain("Naturalistic acting with good pace");
    expect(html).not.toContain("Correct the file naming convention");
  });

  it("builds a valid limited S10 V2 report with a limited view model", () => {
    const limited = buildS10LimitedV2Report({
      auditionType: "musical_theatre",
      mode: "brief",
    });

    expect(limited.source_mode).toBe("s10_ai_report_model");
    expect(limited.report_status).toBe("limited");
    expect(limited.s10_view_model?.source_mode).toBe("s10_ai_report_model");
    expect(limited.s10_view_model?.section_source_map.score_summary.source).toBe(
      "specific_limitation",
    );
    expect(validateV2PublicBoundary(limited).ok).toBe(true);
  });

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

  it("converts malformed S10 V2 without a view model into a limited S10 report", () => {
    const result = buildRouteReportForPersistence({
      legacyReport: buildS10CanaryAReportInput(),
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      futureReportEnabled: true,
      s10Context: buildS10CanaryAViewContext() as never,
      buildV2: (() =>
        ({
          schema_version: "v2-component",
          source_mode: "s10_ai_report_model",
          overall_readiness: 93,
          headline: "Strong for this level",
        }) as never) as (args: BuildV2ReportArgs) => never,
    });

    expect(result.outcome).toBe("s10_limited_v2_persisted");
    if (result.outcome !== "s10_limited_v2_persisted") throw new Error("expected limited v2");
    expect(result.reportToPersist.s10_view_model).toBeTruthy();
    expect(result.reportToPersist.report_status).toBe("limited");
    expect(JSON.stringify(result.reportToPersist)).not.toContain("Strong for this level");
  });

  it("does not return legacy passthrough when a non-S10 build produces a malformed S10 candidate", () => {
    const legacyReport = {
      overall_score: 88,
      headline: "Legacy headline",
    };
    const result = buildRouteReportForPersistence({
      legacyReport,
      futureDimensions: null,
      auditionType: "acting_scene",
      mode: "brief",
      futureReportEnabled: true,
      buildV2: (() =>
        ({
          schema_version: "v2-component",
          source_mode: "s10_ai_report_model",
          overall_readiness: 93,
          headline: "Strong for this level",
        }) as never) as (args: BuildV2ReportArgs) => never,
    });

    expect(result.outcome).toBe("s10_limited_v2_persisted");
    if (result.outcome !== "s10_limited_v2_persisted") throw new Error("expected limited v2");
    expect(result.reason).toContain("missing_s10_view_model");
    expect(result.reportToPersist.source_mode).toBe("s10_ai_report_model");
    expect(result.reportToPersist.s10_view_model).toBeTruthy();
    expect(JSON.stringify(result.reportToPersist)).not.toContain("Legacy headline");
  });

  it("treats incoming S10 source mode without modules as S10 instead of rebuilding legacy", () => {
    const result = buildRouteReportForPersistence({
      legacyReport: {
        source_mode: "s10_ai_report_model",
        overall_score: 93,
        headline: "Strong for this level",
        scores: { acting: 93 },
      },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      futureReportEnabled: true,
    });

    expect(result.outcome).toBe("s10_limited_v2_persisted");
    if (result.outcome !== "s10_limited_v2_persisted") throw new Error("expected limited v2");
    expect(result.reportToPersist.source_mode).toBe("s10_ai_report_model");
    expect(JSON.stringify(result.reportToPersist)).not.toContain("Strong for this level");
    expect(JSON.stringify(result.reportToPersist)).not.toContain('"acting":93');
  });

  it("rejects a S10 view model when top-level source mode is missing or legacy", () => {
    const limited = buildS10LimitedV2Report({
      auditionType: "musical_theatre",
      mode: "brief",
    });

    expect(validateV2PublicBoundary({ ...limited, source_mode: "legacy_projection" }).ok).toBe(
      false,
    );
    const withoutSource = { ...limited } as Record<string, unknown>;
    delete withoutSource.source_mode;
    expect(validateV2PublicBoundary(withoutSource).ok).toBe(false);
  });

  it("rejects top-level S10 module objects without S10 source mode and view model", () => {
    const malformed = {
      schema_version: "v2-component",
      mode: "brief",
      source_mode: "legacy_projection",
      headline: "Legacy header",
      s10_fix_hierarchy: {
        fix_first: {
          title: "S10-shaped fix should not make this legacy",
        },
      },
    };

    expect(validateV2PublicBoundary(malformed).ok).toBe(false);
    expect(validateV2PublicBoundary(malformed)).toEqual({
      ok: false,
      reason: "s10_module_source_mode_mismatch",
    });
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
    v2.reliability = "high";
    v2.reliability_reason = "ok";
    v2.role_fit = {
      notes: "Legacy role-fit should not render.",
      modifier: 6,
      confidence: "high",
    };
    const html = render(v2);

    expect(html).toContain("Submit: strong complete professional package");
    expect(html).toContain("91");
    expect(html).toContain("Why this recommendation");
    expect(html).not.toContain("Why this isn&#x27;t ready");
    expect(html).not.toContain("Why this isn't ready");
    expect(html).not.toContain("Strong for this level");
    expect(html).not.toContain("Legacy insight should not render");
    expect(html).not.toContain("Legacy verdict");
    expect(html).not.toContain("Reliability");
    expect(html).not.toContain("Legacy role-fit should not render");
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

  it("keeps non-S10 reliability and role-fit rendering unchanged", () => {
    const html = render({
      schema_version: "v2-component",
      mode: "brief",
      source_mode: "legacy_projection",
      overall_readiness: 88,
      headline: "Legacy headline",
      reliability: "high",
      reliability_reason: "ok",
      role_fit: {
        notes: "Legacy role fit remains visible.",
        modifier: 3,
        confidence: "medium",
      },
    });

    expect(html).toContain("Reliability:");
    expect(html).toContain("high");
    expect(html).toContain("Legacy role fit remains visible.");
  });
});
