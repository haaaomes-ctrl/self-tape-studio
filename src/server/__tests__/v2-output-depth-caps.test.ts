// Phase 3C P1 — assert legacy v2-hostile caps are gone end-to-end and the
// new public-safe v2 fields (priority_fixes, category_rationale) flow.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildV2Report } from "@/server/v2-report-builder.server";

function read(p: string): string {
  return fs.readFileSync(path.join(process.cwd(), p), "utf8");
}

describe("v2 output-depth caps removed", () => {
  const processSrc = read("src/server/process-take.server.ts");
  const polishSrc = read("src/server/report-polish.server.ts");
  const evidenceSrc = read("src/server/evidence-pass.server.ts");
  const viewSrc = read("src/components/report/V2ReportView.tsx");

  it("REPORT_TOOL strengths/improvements/coaching_drills/timestamped_notes maxima are raised", () => {
    expect(processSrc).toMatch(/strengths:\s*\{[^}]*maxItems:\s*12/);
    expect(processSrc).toMatch(/improvements:\s*\{[^}]*maxItems:\s*15/);
    expect(processSrc).toMatch(/coaching_drills:\s*\{[^}]*maxItems:\s*15/);
    expect(processSrc).toMatch(/timestamped_notes:[^]*?maxItems:\s*36/);
    // legacy values must be gone for these specific fields
    expect(processSrc).not.toMatch(/strengths:\s*\{[^}]*maxItems:\s*3\b/);
    expect(processSrc).not.toMatch(/improvements:\s*\{[^}]*maxItems:\s*3\b/);
  });

  it("REPORT_TOOL declares priority_fixes and category_rationale", () => {
    expect(processSrc).toContain("priority_fixes");
    expect(processSrc).toContain("category_rationale");
    expect(processSrc).toContain("why_not_full_score");
    expect(processSrc).toContain("close_gap");
    expect(processSrc).toContain("standout_delta");
  });

  it("polish prompt no longer enforces legacy caps", () => {
    expect(polishSrc).not.toMatch(/strengths\s*≤\s*3/);
    expect(polishSrc).not.toMatch(/improvements\s*≤\s*3/);
    expect(polishSrc).not.toMatch(/timestamped_notes\s*≤\s*8/);
    expect(polishSrc).toContain("priority_fixes");
    expect(polishSrc).toContain("category_rationale");
  });

  it("evidence-pass schema uses raised maxima (12/15/8/10/36)", () => {
    expect(evidenceSrc).toMatch(/timestamped_evidence[^]*?maxItems:\s*36/);
    expect(evidenceSrc).not.toMatch(/Maximum 8\./);
    expect(evidenceSrc).not.toMatch(/absolute maximum:\s*8/);
  });

  it("V2ReportView no longer slices v2 lists at 3/8/5", () => {
    expect(viewSrc).not.toContain("strengths.slice(0, 3)");
    expect(viewSrc).not.toContain("improvements.slice(0, 3)");
    expect(viewSrc).not.toContain("tsNotes.slice(0, 8)");
    expect(viewSrc).not.toContain("nextPlan.slice(0, 5)");
    expect(viewSrc).not.toContain("presentation.slice(0, 3)");
    // Renamed section
    expect(viewSrc).toContain('title="Next steps"');
  });

  it("system prompt requests duration-scaled timestamps + category rationale + discipline depth", () => {
    expect(processSrc).toContain("18–36");
    expect(processSrc).toContain("category_rationale");
    expect(processSrc).toContain("acting-through-song");
    expect(processSrc).toContain("rhythm/timing");
  });
});

describe("v2 builder surfaces new public fields", () => {
  it("priority_fixes from legacy report passes through; falls back to fix_first", () => {
    const v2a = buildV2Report({
      legacyReport: {
        scores: { technical: 80, audio: 80, vocal: 80, acting: 80, brief_adherence: 80, professional_presentation: 80 },
        priority_fixes: [
          { headline: "Open the second verse", rationale: "Currently flatlines", kind: "quick_win" },
        ],
      },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });
    expect(v2a.priority_fixes).toHaveLength(1);

    const v2b = buildV2Report({
      legacyReport: { fix_first: "Land the consonant on 'go'." },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });
    expect(v2b.priority_fixes).toEqual([{ headline: "Land the consonant on 'go'." }]);
  });

  it("category_rationale from legacy report passes through verbatim", () => {
    const v2 = buildV2Report({
      legacyReport: {
        category_rationale: {
          acting: { what_works: "x", why_not_full_score: "y", close_gap: "z", standout_delta: "w" },
        },
      },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });
    expect(v2.category_rationale).toEqual({
      acting: { what_works: "x", why_not_full_score: "y", close_gap: "z", standout_delta: "w" },
    });
  });
});
