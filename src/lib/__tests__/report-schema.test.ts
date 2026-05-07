import { describe, it, expect } from "vitest";
import { readReportSchemaVersion } from "../report-schema";

describe("readReportSchemaVersion", () => {
  it("treats null/undefined as v1-legacy", () => {
    expect(readReportSchemaVersion(null)).toBe("v1-legacy");
    expect(readReportSchemaVersion(undefined)).toBe("v1-legacy");
  });

  it("treats missing schema_version as v1-legacy", () => {
    expect(readReportSchemaVersion({ summary: "x" })).toBe("v1-legacy");
  });

  it("treats unknown values as v1-legacy", () => {
    expect(readReportSchemaVersion({ schema_version: "v3-future" })).toBe("v1-legacy");
    expect(readReportSchemaVersion({ schema_version: 7 })).toBe("v1-legacy");
  });

  it("returns v1-legacy for explicit v1-legacy", () => {
    expect(readReportSchemaVersion({ schema_version: "v1-legacy" })).toBe("v1-legacy");
  });

  it("returns v2-component for explicit v2-component", () => {
    expect(readReportSchemaVersion({ schema_version: "v2-component" })).toBe("v2-component");
  });
});
