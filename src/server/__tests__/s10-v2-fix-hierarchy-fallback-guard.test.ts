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

describe("S10.P1c V2 fix/action fallback guard", () => {
  it("renders valid S10 fix hierarchy from S10FixHierarchy", () => {
    const report = buildS10CanaryAReportInput();
    const v2 = buildCanary(report);
    const html = render(v2 as unknown as Record<string, unknown>);

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.fix_first).toMatch(/Side 1/i);
    expect(v2.fix_first).not.toBe(report.fix_first);
    expect(v2.priority_fixes.map((item) => JSON.stringify(item)).join(" ")).toMatch(/Side 1/i);
    expect(html).toContain("Prioritised fixes");
    expect(html).toContain("Side 1");
    expect(v2.s10_view_model?.section_source_map.fix_hierarchy).toMatchObject({
      source: "s10_authoritative_module",
      module: "s10_fix_hierarchy",
    });
    expect(v2.s10_view_model?.section_source_map.next_action_plan).toMatchObject({
      source: "s10_authoritative_module",
      module: "s10_next_action_plan",
    });
  });

  it("renders a fix limitation instead of legacy fix-first and priority fixes for partial S10 reports", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    report.fix_first = "Correct the file naming convention";
    report.priority_fixes = [
      { headline: "Correct the file naming convention" },
      { headline: "Ensure the file is named 'WILLARS, HANNAH'" },
    ];
    report.improvements = [{ point: "Correct the file naming convention" }];
    delete report.s10_fix_hierarchy;
    const before = structuredClone(report);

    const v2 = buildCanary(report);
    const html = render(v2 as unknown as Record<string, unknown>);
    const output = `${JSON.stringify(v2)} ${html}`;

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.fix_first).toBeNull();
    expect(v2.priority_fixes).toEqual([]);
    expect(v2.improvements).toEqual([]);
    expect(v2.s10_view_model?.section_source_map.fix_hierarchy).toMatchObject({
      source: "specific_limitation",
      module: "s10_fix_hierarchy",
    });
    expect(html).toContain("Fix hierarchy was unavailable for this S10 report.");
    expect(output).not.toContain("Correct the file naming convention");
    expect(output).not.toContain("Ensure the file is named 'WILLARS, HANNAH'");
    expect(output).not.toContain("No single public-safe priority fix was available");
    expect(report).toEqual(before);
  });

  it("renders a next-action limitation instead of legacy next_take_plan and coaching drills", () => {
    const report = buildS10CanaryAReportInput() as Record<string, unknown>;
    report.next_take_plan = {
      steps: ["Retake option: if recording again, use one pass to strengthen blocked material."],
    };
    report.coaching_drills = ["No single public-safe priority fix was available"];
    delete report.s10_next_action_plan;

    const v2 = buildCanary(report);
    const html = render(v2 as unknown as Record<string, unknown>);
    const output = `${JSON.stringify(v2)} ${html}`;

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.next_take_plan).toBeNull();
    expect(v2.s10_view_model?.section_source_map.next_action_plan).toMatchObject({
      source: "specific_limitation",
      module: "s10_next_action_plan",
    });
    expect(html).toContain("Next action plan was unavailable for this S10 report.");
    expect(output).not.toContain(
      "Retake option: if recording again, use one pass to strengthen blocked material.",
    );
    expect(output).not.toContain("No single public-safe priority fix was available");
  });

  it("keeps Canary A fix-first on missing Side 1 and blocks old generic action copy", () => {
    const v2 = buildCanary();
    const html = render(v2 as unknown as Record<string, unknown>);
    const output = `${JSON.stringify(v2)} ${html}`;

    expect(v2.fix_first).toMatch(/Side 1/i);
    expect(v2.fix_first).not.toMatch(/file naming/i);
    expect(output).not.toContain("Correct the file naming convention");
    expect(output).not.toContain("Ensure the file is named 'WILLARS, HANNAH'");
    expect(output).not.toContain("Blocked: a major casting brief instruction wasn't followed");
    expect(output).not.toContain(
      "Retake option: if recording again, use one pass to strengthen blocked",
    );
    expect(output).not.toContain("No single public-safe priority fix was available");
  });

  it("preserves strong-complete S10 no-mandatory-fix and submit checklist content", () => {
    const v2 = buildStrong();
    const html = render(v2 as unknown as Record<string, unknown>);

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.fix_first).toBeNull();
    expect(v2.priority_fixes.length).toBeGreaterThan(0);
    expect(v2.s10_view_model?.fix_hierarchy?.fix_first).toBeNull();
    expect(v2.s10_view_model?.next_action_plan?.submit_checklist.length).toBeGreaterThan(0);
    expect(html).toContain("No mandatory fix");
    expect(html).toContain("Submit checklist");
    expect(html).not.toContain("Fix hierarchy was unavailable for this S10 report.");
    expect(html).not.toContain("Next action plan was unavailable for this S10 report.");
  });

  it("preserves non-S10 legacy fix/action rendering", () => {
    const legacyReport = {
      fix_first: "Legacy file naming fix",
      priority_fixes: [{ headline: "Legacy priority fix", rationale: "Legacy reason." }],
      next_take_plan: { steps: ["Legacy next step."] },
      coaching_drills: ["Legacy coaching drill."],
    };

    const v2 = buildV2Report({
      legacyReport,
      futureDimensions: null,
      auditionType: "acting_scene",
      mode: "brief",
    });
    const html = render(v2 as unknown as Record<string, unknown>);

    expect(v2.source_mode).toBe("legacy_projection");
    expect(v2.fix_first).toBe("Legacy file naming fix");
    expect(v2.priority_fixes).toEqual(legacyReport.priority_fixes);
    expect(v2.next_take_plan).toEqual(legacyReport.next_take_plan);
    expect(html).toContain("Legacy priority fix");
    expect(html).toContain("Legacy next step.");
  });
});
