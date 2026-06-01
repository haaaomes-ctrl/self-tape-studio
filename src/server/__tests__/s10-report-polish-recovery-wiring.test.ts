import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("S10 report polish recovery wiring", () => {
  it("retries recoverable HTTP 200 response-shape failures before fallback", () => {
    const source = read("src/server/process-take.server.ts");

    expect(source).toContain("REPORT_POLISH_JSON_OBJECT_RETRY_INSTRUCTION");
    expect(source).toContain("report_polish_retry_started");
    expect(source).toContain("report_polish_retry_completed");
    expect(source).toContain("report_polish_retry_failed");
    expect(source).toContain("const initialPolishResult = polishResult");
    expect(source).toContain("isRecoverableReportPolishResponseShapeError(initialPolishResult)");
  });

  it("persists evidence-backed fallback separately from ordinary polish completion", () => {
    const source = read("src/server/process-take.server.ts");

    expect(source).toContain("buildS10ReportPolishFallback");
    expect(source).toContain("report_polish_fallback_started");
    expect(source).toContain("report_polish_fallback_persisted");
    expect(source).toContain("report_polish_fallback_failed");
    expect(source).toContain("Do not emit report_polish_completed");
    expect(source).toContain("report_polish_fallback_used");
    expect(source).toContain("polish_fallback_reason");
    expect(source).toContain("polish_retry_attempted");
    expect(source).toContain("polish_retry_succeeded");
  });

  it("keeps module-quality recovery separate from parser fallback recovery", () => {
    const processTakeSource = read("src/server/process-take.server.ts");
    const fallbackSource = read("src/server/s10-report-polish-fallback.server.ts");
    const polishSource = read("src/server/report-polish.server.ts");

    expect(polishSource).toContain("buildS10ModuleRepairRetryInstruction");
    expect(processTakeSource).toContain("buildS10ModuleQualityRecoveryReport");
    expect(processTakeSource).toContain("s10_module_repair_retry_started");
    expect(processTakeSource).toContain("s10_module_repair_retry_completed");
    expect(processTakeSource).toContain("s10_module_repair_retry_failed");
    expect(processTakeSource).toContain("s10_module_quality_recovery_started");
    expect(processTakeSource).toContain("s10_module_quality_recovery_persisted");
    expect(processTakeSource).toContain("s10_module_quality_recovery_failed");
    expect(processTakeSource).toContain("s10_module_quality_residual_limitations_applied");
    expect(processTakeSource).toContain("s10_residual_level_calibration_applied");
    expect(processTakeSource).toContain("s10_residual_technique_commentary_applied");
    expect(processTakeSource).toContain("s10_module_quality_recovery_used");
    expect(processTakeSource).toContain("module_repair_retry_attempted");
    expect(processTakeSource).toContain("module_repair_retry_succeeded");
    expect(processTakeSource).toContain("module_quality_recovery_reason");
    expect(processTakeSource).toContain("residual_module_recovery_used");
    expect(processTakeSource).toContain("residual_modules_recovered");
    expect(processTakeSource).toContain("applyS10ResidualModuleRecovery");
    // Module-repair retry has JSON-object salvage parity with the main polish call.
    expect(processTakeSource).toContain("s10_module_repair_retry_json_salvage_started");
    expect(processTakeSource).toContain("REPORT_POLISH_JSON_OBJECT_RETRY_INSTRUCTION");
    // Non-decision-critical-only remaining blockers degrade-render instead of failing.
    expect(processTakeSource).toContain("s10_module_degraded_render");
    expect(processTakeSource).toContain("decision_critical");
    // The decision-critical hard-fail names the blocking modules before throwing
    // so a re-run is diagnosable from the queryable metric stream.
    expect(processTakeSource).toContain("s10_decision_critical_blocked");
    expect(processTakeSource).toContain("blocked_modules");
    // The persist UPDATE coerces the integer columns so a string/odd confidence
    // degrades to null instead of throwing analysis_persist_failed at the DB.
    expect(processTakeSource).toContain("confidenceForPersist");
    expect(processTakeSource).toContain("overallScoreForPersist");
    expect(processTakeSource).toContain("overall_score: overallScoreForPersist");
    expect(processTakeSource).toContain("confidence: confidenceForPersist");
    expect(fallbackSource).toContain(
      'type S10EvidenceRecoveryKind = "polish_parser" | "module_quality"',
    );
    expect(fallbackSource).toContain(
      'report_polish_fallback_used: recoveryKind === "polish_parser"',
    );
    expect(fallbackSource).toContain(
      's10_module_quality_recovery_used: recoveryKind === "module_quality"',
    );
  });
});
