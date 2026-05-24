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
    const complete = structuredClone(canaryV2Report());
    complete.overall_readiness = 91;
    complete.headline = "Submit: complete, specific professional package.";
    const s10 = complete.s10_view_model as Record<string, unknown>;
    s10.recommendation = {
      decision: "submit",
      headline: "Submit: complete, specific professional package.",
      rationale: ["Mandatory requirements are achieved."],
      score_explanation: "The package is brief-complete and strong for the selected level.",
      confidence: "high",
    };
    s10.score_summary = {
      overall_submission_readiness_score: 91,
      performance_quality_score: 92,
      brief_completion_score: 95,
      score_band_label: "submit_strong_submission",
      category_scores: [],
      component_scores: [],
    };
    (s10.brief_achievement_matrix as Record<string, unknown>).summary =
      "Mandatory requirements are achieved.";
    (s10.fix_hierarchy as Record<string, unknown>).fix_first = null;
    (s10.fix_hierarchy as Record<string, unknown>).must_fix_before_submitting = [];
    s10.next_action_plan = {
      submit_checklist: ["Confirm filename, deadline and final playback before upload."],
      retake_plan: [],
      final_checks: ["Final playback check."],
      playback_checks: ["Check the full file plays through."],
    };
    s10.strengths_and_preserve = {
      summary: "The package reads clearly and should be preserved.",
      strengths: [
        {
          title: "Specific acting-through-song choices.",
          detail: "The work is clear and repeatable.",
        },
      ],
      preserve: [
        { title: "Preserve the direct camera readability.", detail: "It supports the brief." },
      ],
      do_not_overfix: [
        {
          title: "Do not retake without a concrete polish reason.",
          detail: "The package is already complete.",
        },
      ],
      limitations: [],
    };
    (s10.technique_commentary as Record<string, unknown>).acting = {
      status: "assessable",
      headline: "Acting objective and listening are clear.",
      observations: [
        { title: "Specific scene partner focus.", detail: "The side has playable stakes." },
      ],
      what_is_working: [],
      what_could_improve: [],
      practical_actions: ["Keep the turn into the final beat precise."],
    };
    (s10.timestamped_commentary as Record<string, unknown>).notes = [
      {
        id: "note-acting",
        display_label: "Opening section",
        title: "The first beat establishes the given circumstances.",
        detail: "Keep this clarity.",
        section: "technique",
      },
    ];

    const html = render(complete);
    expect(html).toContain("Submit: complete, specific professional package");
    expect(html).toContain("Specific acting-through-song choices");
    expect(html).toContain("Confirm filename, deadline and final playback");
    expect(html).toContain("Acting objective and listening are clear");
    expect(html).toContain("Opening section");
    expect(html).not.toContain("No single public-safe priority fix was available");
  });
});
