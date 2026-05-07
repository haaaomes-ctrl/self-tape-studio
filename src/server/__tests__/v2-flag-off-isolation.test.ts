import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SAFE_DEFAULTS } from "@/server/app-config.server";
import { readReportSchemaVersion } from "@/lib/report-schema";

describe("v2 flag-off isolation (Phase 3A)", () => {
  it("future_report_enabled defaults false", () => {
    expect(SAFE_DEFAULTS.future_report_enabled).toBe(false);
  });

  it("readReportSchemaVersion still defaults missing/garbage to v1-legacy", () => {
    expect(readReportSchemaVersion(undefined)).toBe("v1-legacy");
    expect(readReportSchemaVersion(null)).toBe("v1-legacy");
    expect(readReportSchemaVersion({})).toBe("v1-legacy");
    expect(readReportSchemaVersion({ schema_version: "garbage" })).toBe("v1-legacy");
    expect(readReportSchemaVersion({ schema_version: "v1-legacy" })).toBe("v1-legacy");
    expect(readReportSchemaVersion({ schema_version: "v2-component" })).toBe("v2-component");
  });

  it("pipeline only invokes the v2 builder behind the flag", () => {
    const src = readFileSync(
      resolve(__dirname, "../process-take.server.ts"),
      "utf8",
    );
    expect(src).toContain("cfg3a.future_report_enabled");
    expect(src).toContain("buildV2Report");
    expect(src).toContain("v2_report_constructed");
    // The builder result must not be persisted: the only `report` written to
    // `takes` must remain the v1 `twoStepReport`/legacy object.
    expect(src).not.toMatch(/update\(\{[^}]*report:\s*v2/);
    expect(src).not.toMatch(/score_breakdown:\s*v2/);
  });

  it("v2 builder is not imported at module top level (pure dynamic import)", () => {
    const src = readFileSync(
      resolve(__dirname, "../process-take.server.ts"),
      "utf8",
    );
    // Static import of the builder would defeat dark-launch isolation.
    expect(src).not.toMatch(/^import .*v2-report-builder/m);
  });
});
