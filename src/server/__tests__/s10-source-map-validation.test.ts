import { describe, expect, it } from "vitest";
import {
  buildS10PerformerReportViewModel,
  validateAuthenticatedS10RouteSurface,
} from "@/server/s10-report-view-model.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

function strongView(
  report: Record<string, unknown> = buildS10StrongCompleteProfessionalReportInput(),
) {
  const view = buildS10PerformerReportViewModel({
    report,
    context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
  if (!view) throw new Error("expected strong S10 view model");
  return view;
}

function canaryView(report: Record<string, unknown> = buildS10CanaryAReportInput()) {
  const view = buildS10PerformerReportViewModel({
    report,
    context: buildS10CanaryAViewContext() as never,
  });
  if (!view) throw new Error("expected canary S10 view model");
  return view;
}

describe("S10.P1e source-map validation", () => {
  it("marks score_summary as a limitation when the visible S10 score is absent", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    delete (report.readiness_score_judgement as Record<string, unknown>)
      .overall_submission_readiness_score;
    const view = strongView(report);

    expect(view.score_summary.overall_submission_readiness_score).toBeNull();
    expect(view.section_source_map.score_summary).toMatchObject({
      source: "specific_limitation",
      module: "readiness_score_judgement",
    });
    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });

  it("keeps score_summary authoritative when the visible S10 score exists", () => {
    const view = strongView();

    expect(view.score_summary.overall_submission_readiness_score).toBe(91);
    expect(view.section_source_map.score_summary).toMatchObject({
      source: "s10_authoritative_module",
      module: "readiness_score_judgement",
    });
    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });

  it.each([
    ["score_summary", "raw_report", "overall_score"],
    ["component_breakdown", "legacy_diagnostic_fallback", "detected_components"],
    ["fix_hierarchy", "s10_authoritative_module", "legacy_fix_first"],
    ["presentation_notes", "s10_authoritative_module", "legacy_presentation_notes"],
    ["submission_risk", "s10_authoritative_module", "legacy_risk_flags"],
  ] as const)("rejects invalid source-map entry for %s", (section, source, module) => {
    const view = strongView();
    view.section_source_map[section] = {
      source: source as never,
      module,
      limitation: null,
    };

    const result = validateAuthenticatedS10RouteSurface(view);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(new RegExp(section));
  });

  it("validates Canary A and strong-complete source maps", () => {
    expect(validateAuthenticatedS10RouteSurface(canaryView()).ok).toBe(true);
    expect(validateAuthenticatedS10RouteSurface(strongView()).ok).toBe(true);
  });

  it("uses not_applicable for intentionally absent same-video and diagnostic sections", () => {
    const view = strongView();

    expect(view.section_source_map.same_video_status.source).toBe("not_applicable");
    expect(view.section_source_map.comparison_truth.source).toBe("not_applicable");
    expect(view.section_source_map.diagnostic_chips.source).toBe("not_applicable");
    expect(validateAuthenticatedS10RouteSurface(view).ok).toBe(true);
  });
});
