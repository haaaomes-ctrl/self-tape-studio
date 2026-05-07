import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SAFE_DEFAULTS } from "../app-config.server";
import { readReportSchemaVersion } from "../../lib/report-schema";

const ROOT = path.resolve(__dirname, "../../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("Phase 0 posture — no behaviour change", () => {
  it("future_* feature flags default to false in SAFE_DEFAULTS", () => {
    expect(SAFE_DEFAULTS.future_evidence_enabled).toBe(false);
    expect(SAFE_DEFAULTS.future_report_enabled).toBe(false);
    expect(SAFE_DEFAULTS.future_qa_trace_enabled).toBe(false);
  });

  it("schema_version stamping does not escalate to v2", () => {
    expect(readReportSchemaVersion({ schema_version: "v1-legacy" })).toBe("v1-legacy");
    expect(readReportSchemaVersion({})).toBe("v1-legacy");
    expect(readReportSchemaVersion(null)).toBe("v1-legacy");
  });

  it("renderers do not branch on schema_version or v2-component yet", () => {
    const renderers = [
      "src/routes/audition.$auditionId.tsx",
      "src/components/checklist-view.tsx",
    ];
    for (const f of renderers) {
      const src = read(f);
      expect(src, `${f} must not reference schema_version in Phase 0`).not.toMatch(
        /schema_version/,
      );
      expect(src, `${f} must not reference v2-component in Phase 0`).not.toMatch(
        /v2-component/,
      );
    }
  });

  it("public score-field set is preserved in audition-rules", () => {
    const src = read("src/lib/audition-rules.ts");
    for (const field of [
      "technical",
      "audio",
      "vocal",
      "acting",
      "brief_adherence",
      "professional_presentation",
    ]) {
      expect(src, `audition-rules.ts must reference '${field}'`).toMatch(field);
    }
  });
});
