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
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
  s10StrongCompleteProfessionalComponentVerifications,
  s10StrongCompleteProfessionalExpectedReportModules,
  s10StrongCompleteProfessionalExpectedViewModel,
  s10StrongCompleteProfessionalLegacySnapshot,
  s10StrongCompleteProfessionalOperatorFacts,
} from "@/test-fixtures/s10-strong-complete-professional";

function buildStrongCompleteV2() {
  const report = buildS10StrongCompleteProfessionalReportInput();
  return {
    report,
    v2: buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
    }),
  };
}

function buildCanaryV2() {
  const report = buildS10CanaryAReportInput();
  return buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  });
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

function expectNoRawReportSource(v2: ReturnType<typeof buildV2Report>) {
  for (const section of s10StrongCompleteProfessionalExpectedViewModel.required_authoritative_sections) {
    const entry = v2.s10_view_model?.section_source_map[section];
    expect(entry?.source).toBe("s10_authoritative_module");
    expect(`${entry?.module ?? ""} ${entry?.limitation ?? ""}`).not.toMatch(/raw_report/i);
  }
}

describe("S10.12 strong complete professional fixture", () => {
  it("is deterministic and stays in the strong-complete polarity", () => {
    expect(s10StrongCompleteProfessionalOperatorFacts.selected_level).toBe("professional");
    expect(s10StrongCompleteProfessionalOperatorFacts.operator_observed_tape_facts.side_1).toBe(
      "present",
    );
    expect(s10StrongCompleteProfessionalOperatorFacts.operator_observed_tape_facts.song).toBe(
      "present",
    );
    expect(s10StrongCompleteProfessionalOperatorFacts.operator_observed_tape_facts.package).toBe(
      "complete",
    );
    expect(
      s10StrongCompleteProfessionalExpectedReportModules.readiness_score_judgement.decision,
    ).toBe("submit");
    expect(
      s10StrongCompleteProfessionalExpectedReportModules.brief_achievement_matrix.overall_status,
    ).toMatch(/achieved/);
    expect(
      s10StrongCompleteProfessionalExpectedReportModules.brief_achievement_matrix.mandatory_status,
    ).toBe("clear");
    for (const id of ["req-side-1", "req-song", "req-continuous-video"]) {
      const component = s10StrongCompleteProfessionalComponentVerifications.find(
        (item) => item.requirement_id === id,
      );
      expect(component?.observed_status).toBe("present");
      expect(component?.completion_status).toBe("complete");
    }
  });

  it("keeps legacy generic positive prose diagnostic while S10 supplies richer output", () => {
    const { report, v2 } = buildStrongCompleteV2();
    const historicalSnapshot = JSON.stringify(s10StrongCompleteProfessionalLegacySnapshot);

    expect(JSON.stringify(s10StrongCompleteProfessionalLegacySnapshot)).toBe(historicalSnapshot);
    expect(JSON.stringify(report)).toContain("Strong choices.");
    expect(report.overall_score).toBe(96);

    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.overall_readiness).toBeGreaterThanOrEqual(85);
    expect(v2.overall_readiness).toBeLessThanOrEqual(100);
    expect(v2.fix_first).toBeNull();
    expect(JSON.stringify(v2)).not.toContain("Strong choices.");
    expect(JSON.stringify(v2)).not.toContain("This affects readability, not talent");
    expect(JSON.stringify(v2)).toContain("Specific acting-through-song package integration");
    expect(JSON.stringify(v2)).toContain("Do not rework the achieved package");
  });

  it("uses S10 modules as source of truth for the positive route model", () => {
    const { report, v2 } = buildStrongCompleteV2();
    expect(hasS10AuthoritativeModules(report)).toBe(true);
    expect(validateV2PublicBoundary(v2, report).ok).toBe(true);
    expect(v2.s10_view_model?.source_mode).toBe("s10_ai_report_model");
    expectNoRawReportSource(v2);

    expect(v2.s10_view_model?.recommendation?.decision).toBe("submit");
    expect(
      v2.s10_view_model?.score_summary.overall_submission_readiness_score,
    ).toBeGreaterThanOrEqual(85);
    expect(v2.s10_view_model?.brief_achievement_matrix?.mandatory_status).toBe("clear");
    expect(v2.s10_view_model?.fix_hierarchy?.fix_first).toBeNull();
    expect(v2.s10_view_model?.fix_hierarchy?.must_fix_before_submitting).toEqual([]);
    expect(v2.s10_view_model?.next_action_plan?.submit_checklist.length).toBeGreaterThan(0);
    expect(v2.s10_view_model?.strengths_and_preserve.strengths.length).toBeGreaterThan(0);
    expect(v2.s10_view_model?.strengths_and_preserve.preserve.length).toBeGreaterThan(0);
    expect(v2.s10_view_model?.strengths_and_preserve.do_not_overfix.length).toBeGreaterThan(0);
    expect(v2.s10_view_model?.technique_commentary?.acting.status).toBe("assessable");
    expect(v2.s10_view_model?.technique_commentary?.vocal_singing.status).toBe("assessable");
    expect(v2.s10_view_model?.timestamped_commentary?.notes.length).toBeGreaterThan(0);
  });

  it("keeps no mandatory fix separate from no feedback", () => {
    const { v2 } = buildStrongCompleteV2();
    const s10 = v2.s10_view_model;
    expect(s10?.fix_hierarchy?.fix_first).toBeNull();
    expect(s10?.fix_hierarchy?.must_fix_before_submitting).toHaveLength(0);
    expect(s10?.fix_hierarchy?.optional_polish.length).toBeGreaterThan(0);
    expect(s10?.next_action_plan?.submit_checklist.length).toBeGreaterThan(0);
    expect(s10?.next_action_plan?.retake_plan).toEqual([]);
    expect(s10?.next_action_plan?.no_retake_needed_reason).toMatch(/No mandatory fix/i);
    expect(s10?.professional_critique?.professional_presentation_notes.length).toBeGreaterThan(0);
  });

  it("renders rich positive content and rejects thin-shell filler", () => {
    const { v2 } = buildStrongCompleteV2();
    const html = render(v2 as unknown as Record<string, unknown>);

    for (const allowed of s10StrongCompleteProfessionalExpectedViewModel.allowed_route_content) {
      expect(html).toContain(allowed);
    }
    expect(html).toMatch(/Overall readiness[\s\S]*9[0-9]/);
    expect(html).toContain("Submit checklist");
    expect(html).toContain("Optional polish");
    expect(html).toContain("Technique commentary");
    expect(html).toContain("Timestamped and time-banded notes");

    for (const forbidden of s10StrongCompleteProfessionalExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/retake required/i);
    expect(html).not.toMatch(/invented mandatory blocker/i);
  });

  it("preserves opposite outcomes for Canary A and the strong-complete fixture", () => {
    const canary = buildCanaryV2();
    const strong = buildStrongCompleteV2().v2;

    expect(canary.s10_view_model?.recommendation?.decision).toBe("retake_required_if_possible");
    expect(canary.s10_view_model?.brief_achievement_matrix?.mandatory_status).not.toBe("clear");
    expect(canary.fix_first).toMatch(/Side 1/i);

    expect(strong.s10_view_model?.recommendation?.decision).toBe("submit");
    expect(strong.s10_view_model?.brief_achievement_matrix?.mandatory_status).toBe("clear");
    expect(strong.fix_first).toBeNull();
    expect(canary.s10_view_model?.recommendation?.decision).not.toBe(
      strong.s10_view_model?.recommendation?.decision,
    );
  });
});
