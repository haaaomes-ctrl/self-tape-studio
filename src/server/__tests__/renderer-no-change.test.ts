import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Phase 3B: the audition route now branches to V2ReportView when the
// persisted report carries schema_version "v2-component". Forbidden internal
// tokens must never leak into the route renderer.
//
// S11-AUDIO-01: the brief-blind pre-upload checklist view (Step 1 surface) was
// retired, so the schema-agnostic checklist guards it carried no longer apply —
// the component no longer exists. The route-level guards below still hold.
describe("renderer surface (Phase 3B)", () => {
  const ROUTE = readFileSync(resolve(__dirname, "../../routes/audition.$auditionId.tsx"), "utf8");

  it("audition route branches via readReportSchemaVersion only", () => {
    expect(ROUTE).toContain("readReportSchemaVersion");
    expect(ROUTE).toContain("V2ReportView");
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
    }
  });
});
