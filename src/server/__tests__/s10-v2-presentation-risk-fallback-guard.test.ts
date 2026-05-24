import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "@/components/report/V2ReportView";
import { buildV2Report } from "@/server/v2-report-builder.server";
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

function removeS10Presentation(report: Record<string, unknown>) {
  const technique = report.s10_technique_commentary as Record<string, unknown>;
  const presentation = technique.self_tape_presentation as Record<string, unknown>;
  presentation.what_is_working = [];
  presentation.what_could_improve = [];
  presentation.practical_actions = [];
  presentation.preserve = [];
  const critique = report.s10_professional_critique as Record<string, unknown>;
  critique.professional_presentation_notes = [];
}

describe("S10.P1d V2 presentation/risk fallback guard", () => {
  it("renders valid S10 presentation notes and excludes legacy presentation text", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    report.presentation_notes = ["The frame is clean and easy to read"];
    const v2 = buildStrong(report);
    const html = render(v2 as unknown as Record<string, unknown>);
    const output = `${JSON.stringify(v2)} ${html}`;

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.presentation_notes).toEqual(
      expect.arrayContaining([
        "Audio and framing are assessable.",
        "Professional nuance: final upload discipline.",
      ]),
    );
    expect(html).toContain("Presentation notes");
    expect(html).toContain("Audio and framing are assessable.");
    expect(v2.s10_view_model?.section_source_map.presentation_notes).toMatchObject({
      source: "s10_authoritative_module",
    });
    expect(output).not.toContain("The frame is clean and easy to read");
  });

  it("omits presentation notes instead of recovering legacy presentation copy", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    report.presentation_notes = [
      "Single-file submission as requested",
      "Correct material, orientation, and framing",
      "The frame is clean and easy to read",
    ];
    removeS10Presentation(report);
    const before = structuredClone(report);

    const v2 = buildCanary(report);
    const html = render(v2 as unknown as Record<string, unknown>);
    const output = `${JSON.stringify(v2)} ${html}`;

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.presentation_notes).toEqual([]);
    expect(v2.s10_view_model?.section_source_map.presentation_notes).toMatchObject({
      source: "not_applicable",
    });
    expect(html).not.toContain("Presentation notes");
    expect(output).not.toContain("Single-file submission as requested");
    expect(output).not.toContain("Correct material, orientation, and framing");
    expect(output).not.toContain("The frame is clean and easy to read");
    expect(report).toEqual(before);
  });

  it("does not render stale legacy risk or at-risk warning for submit-ready S10 reports", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    report.at_risk = true;
    report.risk_flags = [{ severity: "low", flag: "LOW File naming convention not followed" }];
    report.submission_risk_flags = [
      { severity: "high", flag: "Stale missing-brief warning from legacy report" },
    ];
    report.block_reasons = ["Legacy missing brief blocker"];

    const v2 = buildStrong(report);
    const html = render(v2 as unknown as Record<string, unknown>);
    const output = `${JSON.stringify(v2)} ${html}`;

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.at_risk).toBe(false);
    expect(v2.risk_flags).toEqual([]);
    expect(v2.block_reasons).toEqual([]);
    expect(v2.s10_view_model?.section_source_map.submission_risk).toMatchObject({
      source: "not_applicable",
    });
    expect(output).not.toContain("This tape is flagged");
    expect(output).not.toContain("LOW File naming convention not followed");
    expect(output).not.toContain("Stale missing-brief warning from legacy report");
    expect(output).not.toContain("Legacy missing brief blocker");
  });

  it("keeps Canary A missing-material blocker sourced from S10 modules", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    report.risk_flags = [{ severity: "low", flag: "LOW File naming convention not followed" }];
    report.block_reasons = ["Legacy file-naming risk"];

    const v2 = buildCanary(report);
    const html = render(v2 as unknown as Record<string, unknown>);
    const output = `${JSON.stringify(v2)} ${html}`;

    expect(v2.block_reasons.join(" ")).toMatch(/Side 1|song|package/i);
    expect(html).toContain("Why this isn");
    expect(html).toMatch(/Side 1|song|package/i);
    expect(v2.s10_view_model?.section_source_map.submission_risk).toMatchObject({
      source: "s10_authoritative_module",
    });
    expect(output).not.toContain("LOW File naming convention not followed");
    expect(output).not.toContain("Legacy file-naming risk");
    expect(output).not.toContain("Single-file submission as requested");
  });

  it("preserves non-S10 legacy presentation and risk rendering", () => {
    const legacyReport = {
      presentation_notes: ["Legacy presentation note."],
      risk_flags: [{ severity: "low", flag: "Legacy risk flag." }],
      at_risk: true,
    };

    const v2 = buildV2Report({
      legacyReport,
      futureDimensions: null,
      auditionType: "acting_scene",
      mode: "brief",
    });
    const html = render(v2 as unknown as Record<string, unknown>);

    expect(v2.source_mode).toBe("legacy_projection");
    expect(v2.presentation_notes).toEqual(["Legacy presentation note."]);
    expect(v2.risk_flags).toEqual([{ severity: "low", flag: "Legacy risk flag." }]);
    expect(v2.at_risk).toBe(true);
    expect(html).toContain("Legacy presentation note.");
    expect(html).toContain("Legacy risk flag.");
    expect(html).toContain("This tape is flagged");
  });
});
