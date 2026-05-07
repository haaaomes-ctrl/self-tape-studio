import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Phase 3B: the audition route now branches to V2ReportView when the
// persisted report carries schema_version "v2-component". The checklist
// view (Step 1 surface) MUST stay schema-agnostic and never branch on
// report schema. Forbidden internal tokens must never leak into either.
describe("renderer surface (Phase 3B)", () => {
  const ROUTE = readFileSync(
    resolve(__dirname, "../../routes/audition.$auditionId.tsx"),
    "utf8",
  );
  const CHECKLIST = readFileSync(
    resolve(__dirname, "../../components/checklist-view.tsx"),
    "utf8",
  );

  it("audition route branches via readReportSchemaVersion only", () => {
    expect(ROUTE).toContain("readReportSchemaVersion");
    expect(ROUTE).toContain("V2ReportView");
  });

  it("checklist view does not branch on schema_version v2-component", () => {
    expect(CHECKLIST).not.toContain("v2-component");
    expect(CHECKLIST).not.toContain("schema_version");
  });

  it("no v2 forbidden tokens are referenced by renderers", () => {
    for (const tok of [
      "shadow_scores",
      "shadow_divergence",
      "future_shadow",
      "qa_counters",
      "future_components",
      "evidence_anchors",
      "dimensions_summary",
      "components_summary",
      "internal_dimensions",
      "qa_trace",
    ]) {
      expect(ROUTE).not.toContain(tok);
      expect(CHECKLIST).not.toContain(tok);
    }
  });
});
