import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyFinalReportProviderError,
  isFallbackModelEligibleForFinalReportProviderError,
} from "@/server/final-report-provider-errors.server";

describe("R10.7C final report completion and Gemini 400 hardening", () => {
  it("classifies confirmed Gemini 400s without treating them as media readiness failures", () => {
    const confirmed = classifyFinalReportProviderError({
      status: 400,
      body: "Request contains an invalid argument.",
      mediaUrlConfirmedFetchable: true,
    });

    expect(confirmed.category).toBe("provider_invalid_argument_unknown");
    expect(confirmed.failureCode).toBe("final_report_provider_invalid_argument");

    const unconfirmed = classifyFinalReportProviderError({
      status: 400,
      body: "Request contains an invalid argument.",
      mediaUrlConfirmedFetchable: false,
    });

    expect(unconfirmed.category).toBe("media_url_unfetchable_or_rejected");
    expect(unconfirmed.failureCode).toBe("media_url_provider_rejected");
  });

  it("separates request-shape and schema errors and marks fallback-model eligible cases", () => {
    const toolShape = classifyFinalReportProviderError({
      status: 400,
      body: "Unsupported tool_choice for this model.",
      mediaUrlConfirmedFetchable: true,
    });
    const schemaShape = classifyFinalReportProviderError({
      status: 400,
      body: "Invalid response schema JSON mode.",
      mediaUrlConfirmedFetchable: true,
    });
    const safety = classifyFinalReportProviderError({
      status: 400,
      body: "Content rejected by safety policy.",
      mediaUrlConfirmedFetchable: true,
    });

    expect(toolShape.failureCode).toBe("final_report_model_request_shape_unsupported");
    expect(schemaShape.failureCode).toBe("final_report_provider_request_invalid");
    expect(isFallbackModelEligibleForFinalReportProviderError(toolShape.category)).toBe(true);
    expect(isFallbackModelEligibleForFinalReportProviderError(schemaShape.category)).toBe(true);
    expect(isFallbackModelEligibleForFinalReportProviderError(safety.category)).toBe(false);
  });

  it("uses the locked Step 1 fallback report instead of legacy single-pass after observation-only evidence", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    const observationBranchStart = source.indexOf("if (observationOnlyStep1Contract)");
    const dependencyBranchStart = source.indexOf(
      "} else if (internalQaEmit && step1Dependency.step2DependencyBlocked)",
      observationBranchStart,
    );
    const observationBranch = source.slice(observationBranchStart, dependencyBranchStart);

    expect(observationBranch).toContain("using locked-down Step 1 fallback report");
    expect(observationBranch).toContain("twoStepReport = renderFallbackReport(step2Evidence, mode");
    expect(observationBranch).toContain('"two_step_fallback_used"');
    expect(observationBranch).not.toContain("falling back to single-pass");
  });

  it("does not fall back to legacy single-pass when Step 1 QA dependency blocks polish", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    const dependencyBranchStart = source.indexOf(
      "} else if (internalQaEmit && step1Dependency.step2DependencyBlocked)",
    );
    const polishBranchStart = source.indexOf("} else {", dependencyBranchStart);
    const dependencyBranch = source.slice(dependencyBranchStart, polishBranchStart);

    expect(dependencyBranch).toContain("analysis_evidence_state_invalid_for_step2");
    expect(dependencyBranch).toContain("twoStepReport = renderFallbackReport(step2Evidence, mode");
    expect(dependencyBranch).toContain('"two_step_fallback_used"');
  });

  it("records safe final AI diagnostics without raw prompts, raw responses or full URLs", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );

    expect(source).toContain("final_ai_request_attempt");
    expect(source).toContain("content_part_summary");
    expect(source).toContain("selected_url_kind");
    expect(source).toContain("provider_error_body_bytes");
    expect(source).toContain("retry_with_configured_fallback_model");
    expect(source).not.toContain("AI gateway hard error");
  });

  it("does not include raw provider response snippets in report polish failures", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/report-polish.server.ts"),
      "utf8",
    );

    expect(source).toContain("safeErrorCategory");
    expect(source).not.toContain("body.slice");
    expect(source).not.toContain("${body.slice");
  });
});
