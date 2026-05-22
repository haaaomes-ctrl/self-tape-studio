import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { ReadinessFirstReportShell } from "../ReadinessFirstReportShell";

function render(report: unknown): string {
  return renderToStaticMarkup(
    <ReadinessFirstReportShell report={report} takeNumber={2} />,
  );
}

function expectInOrder(html: string, labels: string[]) {
  let previous = -1;
  for (const label of labels) {
    const index = html.indexOf(label);
    expect(index, `${label} should render`).toBeGreaterThan(-1);
    expect(index, `${label} should render after previous section`).toBeGreaterThan(previous);
    previous = index;
  }
}

describe("readiness-first locked-down report shell", () => {
  it("normalises the permitted public-safe fields in readiness-first order", () => {
    const html = render({
      report_data: {
        schema_version: "tapecoach_public_report_v1",
        submission_verdict: {
          label: "Retake before submitting",
          reason: "Audio is usable, but the ending needs a clearer landing.",
          brief_achievement_summary: "The central brief is partly achieved.",
          missing_requirements: ["Clarify the final button."],
        },
        fix_first: { action: "Land the final thought before cutting." },
        priority_fixes: [
          { headline: "Hold the final beat", rationale: "It currently cuts off the story." },
          "",
          { action: "Keep the eyeline steady", reason: "It helps the reader relationship." },
          { text: "Clean the first consonant" },
          { headline: "Fourth item should not render" },
        ],
        brief_requirements: {
          status: "available",
          summary: "Brief checks are limited to public-safe requirements.",
          items: [
            { label: "Slate requirement", status: "observed", note: "Ident is present." },
            {
              label: "Accent requirement",
              status: "not_assessable",
              note: "Not enough public-safe evidence.",
            },
          ],
        },
        strengths: {
          items: [
            "The opening intention is clear.",
            { point: "The reader relationship is easy to follow." },
            "Good job",
          ],
        },
        next_take_plan: {
          steps: ["Run the ending twice."],
          groups: [{ steps: ["Record one complete pass without stopping."] }],
        },
        feedback_reliability: {
          label: "Medium",
          reason: "Video and audio are assessable enough for direction.",
          limitations: ["Fine facial detail is not fully assessable."],
        },
      },
    });

    expectInOrder(html, [
      "Readiness",
      "Fix first",
      "Priority fixes",
      "Brief requirements",
      "Keep / preserve",
      "Next take plan",
      "Reliability / limitations",
    ]);
    expect(html).toContain("Retake before submitting");
    expect(html).toContain("Land the final thought before cutting.");
    expect(html).toContain("Hold the final beat");
    expect(html).toContain("Keep the eyeline steady");
    expect(html).toContain("Clean the first consonant");
    expect(html).toContain("Brief checks are limited to public-safe requirements.");
    expect(html).toContain("Slate requirement");
    expect(html).toContain("Observed");
    expect(html).toContain("Accent requirement");
    expect(html).toContain("Not assessable");
    expect(html).toContain("The opening intention is clear.");
    expect(html).toContain("Run the ending twice.");
    expect(html).toContain("Fine facial detail is not fully assessable.");
    expect(html).not.toContain("Fourth item should not render");
    expect(html).not.toContain("Good job");
    expect(html).not.toContain("Brief achievement");
    expect(html).not.toContain("central brief is partly achieved");
    expect(html).not.toContain("Clarify the final button");
  });

  it("uses safe fallbacks without inventing report content", () => {
    const html = render({
      report_data: {
        submission_verdict: { label: "Worth another take" },
        priority_fixes: ["", null, { headline: "" }],
        strengths: [],
        next_take_plan: null,
        feedback_reliability: null,
        brief_requirements: {
          status: "unavailable",
          summary: "Brief checking is not available from this report.",
          items: [],
        },
      },
    });

    expect(html).toContain("Worth another take");
    expect(html).toContain("Brief checking is not available from this report.");
    expect(html).toContain("This report does not include a single fix-first item.");
    expect(html).toContain("This report does not include a priority-fix list.");
    expect(html).toContain("This report does not include preserve guidance.");
    expect(html).toContain("This report does not include next-take steps.");
    expect(html).toContain("This report does not include a feedback reliability note.");
    expect(html).toContain("No specific limitations were included.");
  });

  it("supports string and malformed allowed fields without crashing", () => {
    const html = render({
      report_data: {
        submission_verdict: "Submit after one more clean pass",
        fix_first: "Keep the opening thought active.",
        priority_fixes: "Sharpen the last line.",
        strengths: "The story is easy to follow.",
        next_take_plan: "Record one complete pass without stopping.",
        feedback_reliability: "Partial",
      },
    });

    expect(html).toContain("Submit after one more clean pass");
    expect(html).toContain("Keep the opening thought active.");
    expect(html).toContain("Sharpen the last line.");
    expect(html).toContain("The story is easy to follow.");
    expect(html).toContain("Record one complete pass without stopping.");
    expect(html).toContain("Partial");
  });

  it("does not render blocked scores, authority, comparison, role-fit or internal artefact data", () => {
    const html = render({
      report_data: {
        submission_verdict: {
          label: "Submit after one more polish pass",
          reason: "This safe reason should render.",
        },
        fix_first: "This safe first fix should render.",
        priority_fixes: [
          { headline: "Avoid Stanislavski technique language" },
          { headline: "Acting: 91" },
          { headline: "Keep the button clearer" },
        ],
        brief_requirements: {
          status: "available",
          summary: "GateTrace confirms missing evidence.",
          items: [
            {
              label: "Score 91 requirement",
              status: "passed",
              note: "truth_state:brief_requirement_001 must not render",
            },
            {
              label: "Slate requirement",
              status: "observed",
              note: "Ident is visible.",
            },
          ],
        },
        strengths: [
          "Clear public-safe choice.",
          "Evidence anchor take-12345678-1234-1234-1234-123456789abc must not render.",
        ],
        next_take_plan: {
          steps: [
            "Record the full pass.",
            "Use signed URL https://example.com/video.mp4",
            "Readiness 92",
          ],
        },
        feedback_reliability: {
          label: "High",
          limitations: ["truth_state:performance_observable_001 must not render"],
        },
        overall_readiness: 92,
        scores: { acting: 91 },
        category_scores: { acting: 91 },
        score_breakdown: { category_scores: { acting: 91 } },
        role_fit: { notes: "Role fit is excellent" },
        comparison: { winner: "take 2" },
        public_technique_authority: { details: true },
        raw_prompt: "private prompt",
        storage_path: "qa-artifacts/run/a.json",
      },
      raw_report: {
        casting_headline: "Raw report only headline",
      },
    });

    expect(html).toContain("This safe reason should render.");
    expect(html).toContain("This safe first fix should render.");
    expect(html).toContain("Keep the button clearer");
    expect(html).toContain("Clear public-safe choice.");
    expect(html).toContain("Record the full pass.");
    expect(html).toContain("Slate requirement");
    expect(html).toContain("Ident is visible.");

    const lower = html.toLowerCase();
    expect(lower).not.toContain("overall readiness");
    expect(lower).not.toContain("acting: 91");
    expect(lower).not.toContain("readiness 92");
    expect(lower).not.toContain("category score");
    expect(lower).not.toContain("stanislavski");
    expect(lower).not.toContain("role fit");
    expect(lower).not.toContain("winner");
    expect(lower).not.toContain("public_technique_authority");
    expect(lower).not.toContain("raw_prompt");
    expect(lower).not.toContain("storage_path");
    expect(lower).not.toContain("signed url");
    expect(lower).not.toContain("https://example.com");
    expect(lower).not.toContain("evidence anchor");
    expect(lower).not.toContain("truth_state");
    expect(lower).not.toContain("score 91 requirement");
    expect(lower).not.toContain("gatetrace");
    expect(lower).not.toContain("passed");
    expect(lower).not.toContain("raw report only headline");
  });

  it("keeps the legacy report fallback available behind the shell route guard", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/routes/audition.$auditionId.tsx"),
      "utf8",
    );

    expect(source).toContain("VITE_READINESS_FIRST_REPORT_SHELL_ENABLED");
    expect(source).toContain("ReadinessFirstReportShell");
    expect(source).toContain("V2ReportView");
    expect(source).toContain("Supporting category scores");
  });
});
