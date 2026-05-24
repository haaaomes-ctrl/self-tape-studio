import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "../V2ReportView";
import { buildV2Report } from "@/server/v2-report-builder.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
  s10CanaryAExpectedViewModel,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
  s10StrongCompleteProfessionalExpectedViewModel,
} from "@/test-fixtures/s10-strong-complete-professional";

function render(report: Record<string, unknown>) {
  return renderToStaticMarkup(
    <V2ReportView report={report} takeNumber={1} auditionType="musical_theatre" />,
  );
}

function canaryV2Report() {
  return buildV2Report({
    legacyReport: buildS10CanaryAReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  }) as unknown as Record<string, unknown>;
}

function strongCompleteV2Report() {
  return buildV2Report({
    legacyReport: buildS10StrongCompleteProfessionalReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  }) as unknown as Record<string, unknown>;
}

describe("S10 report view rendering", () => {
  it("renders Canary A from S10 modules and not legacy false positives", () => {
    const html = render(canaryV2Report());

    for (const allowed of s10CanaryAExpectedViewModel.allowed_route_content) {
      expect(html).toContain(allowed);
    }
    expect(html).toContain("42");
    expect(html).toContain("Record/include the full required Side 1 acting scene");
    expect(html).toContain("Playback-check the end of the song");
    expect(html).toContain("Not observed");

    for (const forbidden of s10CanaryAExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/\bcomplete package\b/i);
    expect(html).not.toContain("93");
  });

  it("renders a strong complete report with useful S10 density", () => {
    const html = render(strongCompleteV2Report());

    for (const allowed of s10StrongCompleteProfessionalExpectedViewModel.allowed_route_content) {
      expect(html).toContain(allowed);
    }
    expect(html).toContain("Submit checklist");
    expect(html).toContain("Optional polish");
    expect(html).toContain("Technique commentary");
    expect(html).toContain("Timestamped and time-banded notes");

    for (const forbidden of s10StrongCompleteProfessionalExpectedViewModel.forbidden_route_content) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/retake required/i);
  });

  it("keeps Canary A and strong complete on opposite report outcomes", () => {
    const canary = canaryV2Report();
    const strong = strongCompleteV2Report();
    const canaryS10 = canary.s10_view_model as {
      recommendation: { decision: string };
      brief_achievement_matrix: { mandatory_status: string };
    };
    const strongS10 = strong.s10_view_model as {
      recommendation: { decision: string };
      brief_achievement_matrix: { mandatory_status: string };
    };

    expect(canaryS10.recommendation.decision).toBe("retake_required_if_possible");
    expect(canaryS10.brief_achievement_matrix.mandatory_status).not.toBe("clear");
    expect(canary.fix_first).toMatch(/Side 1/i);

    expect(strongS10.recommendation.decision).toBe("submit");
    expect(strongS10.brief_achievement_matrix.mandatory_status).toBe("clear");
    expect(strong.fix_first).toBeNull();
  });
});
