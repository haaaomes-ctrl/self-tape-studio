import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const loopPath = path.join(process.cwd(), "docs/tapecoach/v3/r10/r10-6-usefulness-loop.md");
const templatePath = path.join(process.cwd(), "docs/tapecoach/v3/r10/r10-6-review-template.md");

function readDoc(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

const loopDoc = readDoc(loopPath);
const templateDoc = readDoc(templatePath);
const combined = `${loopDoc}\n${templateDoc}`;

describe("R10.6 usefulness review pack", () => {
  it("preserves README as the controlling source and keeps review scoped", () => {
    expect(loopDoc).toContain("`README.md` remains");
    expect(loopDoc).toContain("must not override README");
    expect(loopDoc).toContain("without redesigning it during review");
    expect(templateDoc).toContain("Do not redesign the report during this review");
  });

  it("contains the fixed usefulness rubric questions", () => {
    const requiredQuestions = [
      "identify the submission recommendation within 60 seconds",
      "explain why the recommendation was reached using report text only",
      "identify the single most important fix before submission",
      "all meaningful priority fixes visible",
      "distinguish must-fix, should-improve and optional-polish guidance",
      "brief requirement checklist look correct",
      "whether the brief was achieved, mostly achieved, partly achieved, not achieved, not assessable or not applicable",
      "not-assessable feel fair and separate from criticism",
      "next-take plan tell the performer exactly what to do next",
      "every must-fix and should-improve item have an action or a fair unavailable reason",
      "identify what to preserve",
      "do-not-over-fix section prevent unnecessary retakes",
      "generic, padded or vague",
      "overconfident",
      "anything invented: requirement, fix, timestamp, role/material context, technique claim or achievement",
      "blocked public content or private/internal field leak",
      "change the performer’s next take",
      "practical agent, casting-aware or coach-style guidance",
    ];

    for (const question of requiredQuestions) {
      expect(combined).toContain(question);
    }
    for (let index = 1; index <= 18; index += 1) {
      expect(templateDoc).toContain(`R10.6-Q${String(index).padStart(2, "0")}`);
    }
  });

  it("captures reviewer, fixture, version and reviewed-surface metadata", () => {
    const requiredFields = [
      "Reviewer role",
      "Relevant expertise",
      "Discipline / audition type approved for review",
      "Conflict-of-interest declaration",
      "Fixture ID",
      "Run ID",
      "Take ID",
      "Selected level",
      "Audition type",
      "Brief supplied",
      "Material fixed",
      "Report surface reviewed",
      "Branch",
      "Commit SHA",
      "Artefact root or report reference",
    ];

    for (const field of requiredFields) {
      expect(templateDoc).toContain(field);
    }
  });

  it("records live runtime, dev-server and canary status without requiring them", () => {
    expect(templateDoc).toContain("Live runtime used: yes / no / not run / not supplied");
    expect(templateDoc).toContain(
      "Dev-server verification used: yes / no / not run / not supplied",
    );
    expect(templateDoc).toContain("Canary used: yes / no / not run / not supplied");
    expect(loopDoc).toContain(
      "If live runtime or canary output is absent, mark it `not run / not supplied`",
    );
    expect(loopDoc).toContain("Do not run live runtime verification");
    expect(loopDoc).toContain("R10.7 remains the batched canary checkpoint");
  });

  it("defines usefulness metrics and acceptance thresholds", () => {
    const requiredMetrics = [
      "submit/retake clarity",
      "reason clarity",
      "fix-first clarity",
      "useful priority-fix coverage",
      "brief understanding",
      "brief achievement trust",
      "actionability",
      "preserve / do-not-over-fix usefulness",
      "anti-endless-retake behaviour",
      "professional usefulness",
      "safety",
      "report quality",
      "UK English",
    ];

    for (const metric of requiredMetrics) {
      expect(loopDoc).toContain(metric);
    }
    expect(loopDoc).toContain("within 60 seconds");
    expect(loopDoc).toContain("using report text only");
    expect(loopDoc).toContain("zero blocked public leakage");
  });

  it("defines P0/P1/P2/P3 severity handling and separates design preferences", () => {
    for (const severity of ["### P0", "### P1", "### P2", "### P3 / Design Preference"]) {
      expect(loopDoc).toContain(severity);
    }
    expect(loopDoc).toContain("P0/P1: fix immediately or convert into a direct follow-up patch");
    expect(loopDoc).toContain("P3/design preference: log as future work");
    expect(loopDoc).toContain(
      "request for public scoring, named technique authority, comparison recommendation",
    );
    expect(templateDoc).toContain("P3/design preference: log for future work");
  });

  it("keeps blocked public/private content and public gates blocked", () => {
    const blockedReminders = [
      "public scores",
      "category scores",
      "public named technique authority",
      "public comparison winner or recommendation",
      "raw report as public output",
      "internal QA artefacts as public output",
      "signed URLs",
      "raw prompts",
      "raw responses",
      "secrets or environment values",
    ];
    for (const reminder of blockedReminders) {
      expect(loopDoc).toContain(reminder);
    }

    const releaseDisclaimers = [
      "customer release",
      "production-safe status",
      "Level 2 acceptance",
      "public scoring",
      "public named technique authority",
      "public comparison recommendation",
    ];
    for (const disclaimer of releaseDisclaimers) {
      expect(loopDoc).toContain(disclaimer);
    }

    expect(combined).not.toMatch(
      /\b(?:customer release|production-safe|level 2|public scoring|public named technique authority|public comparison)\s+(?:is\s+)?(?:approved|accepted|passed)\b/i,
    );
    expect(combined).not.toMatch(
      /\b(?:highly castable for|bookable for the role|marketable performer with commercial look|role-fit approved|will get a recall|guaranteed job offer)\b/i,
    );
    expect(combined).not.toMatch(/https?:\/\/|signature=|x-amz-|secret-token/i);
  });

  it("preserves historical S9 runtime caution and UK English wording", () => {
    expect(loopDoc).toContain(
      "Historical S9 runtime JSONs are stale examples or regression evidence only",
    );
    expect(templateDoc).toContain(
      "Historical S9 runtime JSONs are examples or regression evidence only",
    );
    expect(combined).toContain("behaviour");
    expect(combined).not.toMatch(/\bbehavior\b/i);
  });
});
