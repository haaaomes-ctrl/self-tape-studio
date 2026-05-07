import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Step 2 isolation — Phase 1 dimension data must NEVER reach the polish
 * model. `buildEvidenceBlock()` in report-polish.server.ts is a private
 * helper, so we assert via source inspection that it does not reference
 * any future-component / dimension keys.
 */
describe("phase 1 step 2 isolation", () => {
  const polishSrc = fs.readFileSync(
    path.join(process.cwd(), "src/server/report-polish.server.ts"),
    "utf8",
  );

  for (const forbidden of [
    "future_components",
    "future_dimensions",
    "futureDimensions",
    "evidence_dimensions",
    "internal_dimensions",
    "dimension_traces",
    "components_summary",
    "dimensions_summary",
  ]) {
    it(`buildEvidenceBlock / polish source does not reference "${forbidden}"`, () => {
      expect(polishSrc).not.toContain(forbidden);
    });
  }
});
