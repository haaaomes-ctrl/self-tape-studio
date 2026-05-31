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
});
