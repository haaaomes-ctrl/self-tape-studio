import { describe, expect, it } from "vitest";
import {
  buildV2Report,
  hasS10AuthoritativeModules,
  validateV2PublicBoundary,
} from "@/server/v2-report-builder.server";
import { buildS10PerformerReportViewModel } from "@/server/s10-report-view-model.server";
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
    expect(v2.overall_readiness).toBe(54); // Δ6 canonical D (was A = 42)
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

  it("routes strong-complete positive sections from S10 authoritative modules", () => {
    const legacy = buildS10StrongCompleteProfessionalReportInput();
    const snapshot = JSON.stringify(legacy);
    const v2 = buildV2Report({
      legacyReport: legacy,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
    });

    expect(hasS10AuthoritativeModules(legacy)).toBe(true);
    expect(JSON.stringify(legacy)).toBe(snapshot);
    expect(v2.source_mode).toBe("s10_ai_report_model");
    expect(v2.s10_view_model?.recommendation?.decision).toBe("submit");
    expect(
      v2.s10_view_model?.score_summary.overall_submission_readiness_score,
    ).toBeGreaterThanOrEqual(85);
    for (const section of s10StrongCompleteProfessionalExpectedViewModel.required_authoritative_sections) {
      expect(v2.s10_view_model?.section_source_map[section].source).toBe(
        "s10_authoritative_module",
      );
      expect(v2.s10_view_model?.section_source_map[section].module).not.toMatch(/raw_report/i);
    }
    const output = JSON.stringify(v2);
    for (const forbidden of s10StrongCompleteProfessionalExpectedViewModel.forbidden_route_content) {
      expect(output).not.toContain(forbidden);
    }
    expect(validateV2PublicBoundary(v2, legacy).ok).toBe(true);
  });

  // Δ6 P1 — verdict↔content coherence. The performer-visible "Why this isn't ready" rationale
  // must derive from the deterministic, verdict-coherent report.block_reasons whenever the
  // canonical verdict is non-positive, so it structurally carries the real shortfalls and can
  // never render all-positive under a not-ready/retake/review verdict. A minimal authoritative
  // report (one S10 module object + a visible readiness payload) is built directly via
  // buildS10PerformerReportViewModel.
  describe("Δ6 P1 verdict↔content rationale coherence", () => {
    function buildCoherenceReport(overrides: {
      submission_verdict: Record<string, unknown>;
      block_reasons?: unknown[];
      aiRationale: string[];
    }): Record<string, unknown> {
      return {
        // readiness_score_judgement is one of the S10 authoritative module keys, so its presence
        // as an object satisfies hasActualS10AuthoritativeModuleObjects, and its headline+rationale
        // satisfy hasVisibleRecommendationPayload so the recommendation object is built.
        readiness_score_judgement: {
          decision: "retake_required_if_possible",
          headline: "Readiness judgement",
          rationale: overrides.aiRationale,
          score_explanation: "Explanation of the score.",
          confidence: "medium",
        },
        submission_verdict: overrides.submission_verdict,
        ...(overrides.block_reasons !== undefined
          ? { block_reasons: overrides.block_reasons }
          : {}),
      };
    }

    // README §7.2 #13 — "what falls short must carry shortfalls"; README §1.1 — code detects and
    // repairs contradictory modules. Under a non-positive canonical verdict the rationale must be
    // the performer-safe deterministic block_reasons, never the (deliberately all-positive) AI
    // rationale.
    it("replaces the AI rationale with deterministic block_reasons under a non-positive verdict", () => {
      const report = buildCoherenceReport({
        submission_verdict: { label: "Not ready yet", blocked: true },
        block_reasons: [
          "a major casting brief instruction wasn't followed",
          "two or more areas need work",
        ],
        aiRationale: ["Lovely energy", "Strong, confident choices"],
      });
      const vm = buildS10PerformerReportViewModel({ report });
      expect(vm?.canonical_verdict?.decision).toBe("retake_required_if_possible");
      expect(vm?.recommendation?.rationale).toEqual([
        "a major casting brief instruction wasn't followed",
        "two or more areas need work",
      ]);
      expect(vm?.recommendation?.rationale).not.toEqual([
        "Lovely energy",
        "Strong, confident choices",
      ]);
    });

    // ADR-0008 — the canonical authority owns the visible value; the "Blocked:" token is
    // performer-forbidden on this minors-facing product. No surfaced rationale line may begin
    // "Blocked:", and the non-prefixed shortfall must still surface.
    it("drops a Blocked:-prefixed block reason but keeps the safe shortfall", () => {
      const report = buildCoherenceReport({
        submission_verdict: { label: "Not ready yet", blocked: true },
        block_reasons: [
          "Blocked: a major casting brief instruction wasn't followed",
          "two or more areas need work",
        ],
        aiRationale: ["Lovely energy", "Strong, confident choices"],
      });
      const vm = buildS10PerformerReportViewModel({ report });
      const rationale = vm?.recommendation?.rationale ?? [];
      for (const line of rationale) {
        expect(line).not.toMatch(/^blocked\s*:/i);
      }
      expect(rationale).toContain("two or more areas need work");
    });

    // Positive (submit) verdict keeps the AI rationale unchanged.
    it("keeps the AI rationale under a positive (submit) verdict", () => {
      const report = buildCoherenceReport({
        submission_verdict: { label: "Ready to submit", capped: false },
        block_reasons: [],
        aiRationale: ["Lovely energy", "Strong, confident choices"],
      });
      const vm = buildS10PerformerReportViewModel({ report });
      expect(vm?.canonical_verdict?.decision).toBe("submit");
      expect(vm?.recommendation?.rationale).toEqual(["Lovely energy", "Strong, confident choices"]);
    });
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
