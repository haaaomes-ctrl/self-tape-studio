import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("renderer / comparison no-change (Phase 3A)", () => {
  const ROUTE = readFileSync(
    resolve(__dirname, "../../routes/audition.$auditionId.tsx"),
    "utf8",
  );
  const CHECKLIST = readFileSync(
    resolve(__dirname, "../../components/checklist-view.tsx"),
    "utf8",
  );

  it("audition route does not branch on schema_version v2-component", () => {
    expect(ROUTE).not.toContain("v2-component");
    expect(ROUTE).not.toContain("schema_version");
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
    ]) {
      expect(ROUTE).not.toContain(tok);
      expect(CHECKLIST).not.toContain(tok);
    }
  });
});
