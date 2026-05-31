import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "@/components/report/V2ReportView";
import { S10_ROUTE_REQUIRED_SECTION_KEYS } from "@/lib/audition-rules";
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

  it("renders the S10 limitation surface for invalid S10 view-model shapes", () => {
    for (const s10_view_model of [
      {},
      {
        report_version: "s10_performer_report_view_model_v0",
        source_mode: "s10_ai_report_model",
      },
      {
        report_version: "s10_performer_report_view_model_v1",
        source_mode: "s10_ai_report_model",
      },
      {
        report_version: "s10_performer_report_view_model_v1",
        source_mode: "s10_ai_report_model",
        section_source_map: {},
        score_summary: {},
        recommendation: {
          decision: "submit",
        },
        limitations: [],
      },
      {
        report_version: "s10_performer_report_view_model_v1",
        source_mode: "s10_ai_report_model",
        section_source_map: {},
        score_summary: {},
        recommendation: {},
        limitations: [],
      },
      {
        report_version: "s10_performer_report_view_model_v1",
        source_mode: "s10_ai_report_model",
        section_source_map: {},
        score_summary: {},
        recommendation: null,
        limitations: [{}],
      },
      {
        report_version: "s10_performer_report_view_model_v1",
        source_mode: "s10_ai_report_model",
        section_source_map: {},
        score_summary: {},
        recommendation: null,
        limitations: ["  "],
      },
      {
        report_version: "s10_performer_report_view_model_v1",
        source_mode: "s10_ai_report_model",
        section_source_map: Object.fromEntries(
          S10_ROUTE_REQUIRED_SECTION_KEYS.map((section) => [section, {}]),
        ),
        score_summary: {},
        recommendation: {
          decision: "submit",
        },
        limitations: [],
      },
    ]) {
      const html = render({
        schema_version: "v2-component",
        source_mode: "s10_ai_report_model",
        s10_view_model,
        overall_readiness: 93,
        headline: "Strong for this level",
        reliability: "high",
        role_fit: {
          notes: "Legacy role fit should not render.",
        },
        components: [{ type: "legacy acting scene", note: "Naturalistic acting with good pace" }],
        scores: { acting: 93 },
        fix_first: "Correct the file naming convention",
        category_notes: { acting: "Correct material, orientation, and framing" },
        presentation_notes: ["Single-file submission as requested"],
        risk_flags: [{ severity: "low", flag: "LOW File naming convention not followed" }],
      });

      expect(html).toContain("S10 report assembly limitation");
      expect(html).toContain("No legacy report was used as a substitute.");
      expect(html).not.toContain("Strong for this level");
      expect(html).not.toContain("Reliability");
      expect(html).not.toContain("Legacy role fit should not render");
      expect(html).not.toContain("Naturalistic acting with good pace");
      expect(html).not.toContain("Correct material, orientation, and framing");
      expect(html).not.toContain("Single-file submission as requested");
      expect(html).not.toContain("LOW File naming convention not followed");
      expect(html).not.toContain("Correct the file naming convention");
    }
  });

  it("renders the S10 limitation surface for decision-only view models with valid source maps", () => {
    const limited = buildS10LimitedV2Report({ auditionType: "musical_theatre", mode: "brief" });
    const s10_view_model = {
      ...(limited.s10_view_model as Record<string, unknown>),
      recommendation: { decision: "submit" },
      limitations: [],
    };

    const html = render({
      schema_version: "v2-component",
      source_mode: "s10_ai_report_model",
      s10_view_model,
      overall_readiness: 93,
      headline: "Strong for this level",
      fix_first: "Correct the file naming convention",
      presentation_notes: ["Single-file submission as requested"],
    });

    expect(html).toContain("S10 report assembly limitation");
    expect(html).toContain("No legacy report was used as a substitute.");
    expect(html).not.toContain("Strong for this level");
    expect(html).not.toContain("Correct the file naming convention");
    expect(html).not.toContain("Single-file submission as requested");
  });

  it("does not render S10 recommendation fields when readiness is source-mapped as a limitation", () => {
    const limited = buildS10LimitedV2Report({ auditionType: "musical_theatre", mode: "brief" });
    const s10_view_model = {
      ...(limited.s10_view_model as Record<string, unknown>),
      recommendation: {
        decision: "submit",
        headline: "Submit: unsupported recommendation",
        score_explanation: "Unsupported score explanation should not render.",
        rationale: ["Unsupported positive rationale should not render."],
      },
      limitations: ["Readiness judgement is not available for this report."],
    };

    const html = render({
      schema_version: "v2-component",
      source_mode: "s10_ai_report_model",
      s10_view_model,
      overall_readiness: 93,
      headline: "Strong for this level",
      insight: "Legacy insight should not render.",
      verdict: "Legacy submit verdict",
      fix_first: "Correct the file naming convention",
      presentation_notes: ["Single-file submission as requested"],
    });

    expect(html).toContain("Readiness judgement is not available for this report.");
    expect(html).not.toContain("Verdict:");
    expect(html).not.toContain("submit");
    expect(html).not.toContain("Submit: unsupported recommendation");
    expect(html).not.toContain("Unsupported score explanation should not render.");
    expect(html).not.toContain("Unsupported positive rationale should not render.");
    expect(html).not.toContain("Why this recommendation");
    expect(html).not.toContain("Strong for this level");
    expect(html).not.toContain("Legacy insight should not render");
    expect(html).not.toContain("Legacy submit verdict");
    expect(html).not.toContain("Correct the file naming convention");
    expect(html).not.toContain("Single-file submission as requested");
  });

  it("renders valid limited S10 V2 reports as the limited surface only", () => {
    const limited = buildS10LimitedV2Report({ auditionType: "musical_theatre", mode: "brief" });

    const html = render(limited as unknown as Record<string, unknown>);

    expect(html).toContain("S10 report assembly limitation");
    expect(html).toContain("No legacy report was used as a substitute.");
    expect(html).not.toContain("Verdict:");
    expect(html).not.toContain("Why this recommendation");
  });

  it.each([
    [
      "disallowed readiness source",
      "readiness_header",
      {
        source: "not_applicable",
        module: null,
        limitation: "Readiness is not applicable.",
      },
    ],
    [
      "missing authoritative score module",
      "score_summary",
      {
        source: "s10_authoritative_module",
        module: null,
        limitation: null,
      },
    ],
    [
      "legacy fix module token",
      "fix_hierarchy",
      {
        source: "s10_authoritative_module",
        module: "legacy_fix_first",
        limitation: null,
      },
    ],
  ] as const)("renders the S10 limitation surface for %s", (_label, section, entry) => {
    const report = buildStrong() as unknown as Record<string, unknown>;
    const s10 = report.s10_view_model as Record<string, unknown>;
    const sourceMap = s10.section_source_map as Record<string, unknown>;
    sourceMap[section] = entry;

    const html = render(report);

    expect(html).toContain("S10 report assembly limitation");
    expect(html).toContain("No legacy report was used as a substitute.");
    expect(html).not.toContain("Submit: strong complete professional package");
    expect(html).not.toContain(">91<");
    expect(html).not.toContain("Legacy");
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

  it("persists the full S10 route model after sanitising sub-90 Professional 90+ language", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    const readiness = report.readiness_score_judgement as Record<string, unknown>;
    const calibration = readiness.selected_level_calibration as Record<string, unknown>;
    readiness.overall_submission_readiness_score = 82;
    readiness.score_explanation =
      "The visible readiness score is 82, so the report should not claim a higher competitive zone.";
    calibration.score_meaning =
      "The performance itself is in the competitive zone (90+), but the overall readiness is lower.";

    const result = buildRouteReportForPersistence({
      legacyReport: report,
      futureDimensions: { components: [] } as never,
      auditionType: "musical_theatre",
      mode: "brief",
      futureReportEnabled: true,
      s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
    });

    expect(result.outcome).toBe("v2_persisted");
    if (result.outcome !== "v2_persisted") throw new Error("expected full v2");
    expect(validateV2PublicBoundary(result.reportToPersist, report).ok).toBe(true);
    expect(JSON.stringify(result.reportToPersist)).not.toContain("competitive zone (90+)");
    expect(result.reportToPersist.s10_view_model?.report_version).toBe(
      "s10_performer_report_view_model_v1",
    );
    expect(result.reportToPersist.report_status).not.toBe("limited");
    expect(result.reportToPersist.components.length).toBeGreaterThan(0);
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

  it("persists a limited S10 V2 report when source-mode-only S10 input build throws", () => {
    const result = buildRouteReportForPersistence({
      legacyReport: {
        source_mode: "s10_ai_report_model",
        headline: "Legacy headline should not survive",
        overall_score: 93,
      },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      futureReportEnabled: true,
      buildV2: (() => {
        throw new Error("simulated source-mode-only S10 build failure");
      }) as (args: BuildV2ReportArgs) => never,
    });

    expect(result.outcome).toBe("s10_limited_v2_persisted");
    if (result.outcome !== "s10_limited_v2_persisted") throw new Error("expected limited v2");
    expect(result.reportToPersist.source_mode).toBe("s10_ai_report_model");
    expect(result.reportToPersist.report_status).toBe("limited");
    expect(JSON.stringify(result.reportToPersist)).not.toContain(
      "Legacy headline should not survive",
    );
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
