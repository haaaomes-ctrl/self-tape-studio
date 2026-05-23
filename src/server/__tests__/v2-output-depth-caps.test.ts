// Phase 3C/R10 — assert legacy v2-hostile caps are gone end-to-end and the
// public-safe decision-support fields flow.
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
    expect(processSrc).toMatch(/strengths:\s*\{[\s\S]*?maxItems:\s*12/);
    expect(processSrc).toMatch(/improvements:\s*\{[\s\S]*?maxItems:\s*15/);
    expect(processSrc).toMatch(/coaching_drills:\s*\{[\s\S]*?maxItems:\s*15/);
    expect(processSrc).toMatch(/timestamped_notes:[\s\S]*?maxItems:\s*36/);
    expect(processSrc).not.toMatch(/strengths:\s*\{[\s\S]{0,200}?maxItems:\s*3\b/);
    expect(processSrc).not.toMatch(/improvements:\s*\{[\s\S]{0,200}?maxItems:\s*3\b/);
  });

  it("REPORT_TOOL declares priority_fixes and R10.4 brief-first decision-support fields", () => {
    expect(processSrc).toContain("priority_fixes");
    expect(processSrc).toContain("why_this_verdict");
    expect(processSrc).toContain("must_fix_before_submitting");
    expect(processSrc).toContain("should_improve_if_retaking");
    expect(processSrc).toContain("optional_polish");
    expect(processSrc).toContain("do_not_overfix");
    expect(processSrc).toContain("brief_achievement");
    expect(processSrc).toContain("public_summary");
    expect(processSrc).toContain("requirement_type");
    expect(processSrc).toContain("mandatory_status");
    expect(processSrc).toContain("not_applicable");
    expect(processSrc).toContain("not_assessable");
  });

  it("polish prompt no longer enforces legacy caps", () => {
    expect(polishSrc).not.toMatch(/strengths\s*≤\s*3/);
    expect(polishSrc).not.toMatch(/improvements\s*≤\s*3/);
    expect(polishSrc).not.toMatch(/timestamped_notes\s*≤\s*8/);
    expect(polishSrc).toContain("priority_fixes");
    expect(polishSrc).toContain("must_fix_before_submitting");
    expect(polishSrc).toContain("do_not_overfix");
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
    expect(viewSrc).toContain('title="Next take plan"');
    expect(viewSrc).toContain('title="Do not over-fix"');
    expect(viewSrc).toContain('title="What the brief asked for"');
    expect(viewSrc).not.toContain('title="Category scores"');
  });

  it("system prompt requests duration-scaled timestamps + category rationale + discipline depth", () => {
    expect(processSrc).toContain("18–36");
    expect(processSrc).toContain("why_this_verdict");
    expect(processSrc).toContain("acting-through-song");
    expect(processSrc).toContain("rhythm/timing");
  });
});

describe("v2 builder surfaces new public fields", () => {
  it("priority_fixes from legacy report passes through; fix_first is derived from the first priority", () => {
    const v2a = buildV2Report({
      legacyReport: {
        scores: {
          technical: 80,
          audio: 80,
          vocal: 80,
          acting: 80,
          brief_adherence: 80,
          professional_presentation: 80,
        },
        priority_fixes: [
          {
            headline: "Open the second verse",
            rationale: "Currently flatlines",
            kind: "quick_win",
          },
        ],
        fix_first: "Do not use this contradictory legacy fix.",
      },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });
    expect(v2a.priority_fixes).toHaveLength(1);
    expect(v2a.fix_first).toBe("Open the second verse");

    const v2b = buildV2Report({
      legacyReport: { fix_first: "Land the consonant on 'go'." },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });
    expect(v2b.priority_fixes).toEqual([{ headline: "Land the consonant on 'go'." }]);
    expect(v2b.fix_first).toBe("Land the consonant on 'go'.");
  });

  it("decision-support fields are projected without scores", () => {
    const v2 = buildV2Report({
      legacyReport: {
        priority_fixes: [{ headline: "Clarify the first beat", kind: "critical_gap" }],
        improvements: ["Hold the breath reset."],
        strengths: ["The text is clear."],
        overall_score: 91,
        scores: { acting: 90 },
      },
      futureDimensions: null,
      auditionType: null,
      mode: "baseline",
    });
    expect(v2.must_fix_before_submitting).toEqual(["Clarify the first beat"]);
    expect(v2.should_improve_if_retaking).toEqual(["Hold the breath reset."]);
    expect(v2.preserve).toEqual(["The text is clear."]);
    expect(JSON.stringify(v2)).not.toMatch(/overall_score|scores/);
  });
});
