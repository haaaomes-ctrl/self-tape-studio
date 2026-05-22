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
  it("renders the permitted public-safe fields in readiness-first order", () => {
    const html = render({
      report_data: {
        schema_version: "tapecoach_public_report_v1",
        submission_verdict: {
          label: "Retake before submitting",
          reason: "Audio is usable, but the ending needs a clearer landing.",
          brief_achievement_summary: "The central brief is partly achieved.",
          missing_requirements: ["Clarify the final button."],
        },
        fix_first: "Land the final thought before cutting.",
        priority_fixes: [
          { headline: "Hold the final beat", rationale: "It currently cuts off the story." },
          { headline: "Keep the eyeline steady", rationale: "It helps the reader relationship." },
          { headline: "Clean the first consonant", rationale: "It makes the opening easier to catch." },
          { headline: "Fourth item should not render" },
        ],
        strengths: [
          "The opening intention is clear.",
          { point: "The reader relationship is easy to follow." },
        ],
        next_take_plan: {
          steps: ["Run the ending twice.", "Record one complete pass without stopping."],
        },
        feedback_reliability: {
          label: "Medium",
          reason: "Video and audio are assessable enough for direction.",
          limitations: ["Fine facial detail is not fully assessable."],
        },
      },
    });

    expectInOrder(html, [
      "Should I submit this tape?",
      "Fix first",
      "Top action items",
      "Brief achievement",
      "Preserve this",
      "Next-take checklist",
      "Not assessable / limitations",
      "Feedback reliability",
    ]);
    expect(html).toContain("Retake before submitting");
    expect(html).toContain("Land the final thought before cutting.");
    expect(html).toContain("Hold the final beat");
    expect(html).toContain("The opening intention is clear.");
    expect(html).toContain("Run the ending twice.");
    expect(html).toContain("Fine facial detail is not fully assessable.");
    expect(html).not.toContain("Fourth item should not render");
  });

  it("uses safe fallbacks when optional public-safe fields are unavailable", () => {
    const html = render({
      report_data: {
        submission_verdict: { label: "Worth another take" },
      },
    });

    expect(html).toContain("Worth another take");
    expect(html).toContain("No single first fix is available");
    expect(html).toContain("No priority-fix list is available");
    expect(html).toContain("Brief achievement detail is not available");
    expect(html).toContain("No preserve guidance is available");
    expect(html).toContain("No next-take steps are available");
    expect(html).toContain("Feedback reliability was not provided");
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
          { headline: "Keep the button clearer" },
        ],
        strengths: [
          "Strong public-safe choice.",
          "Evidence anchor take-12345678-1234-1234-1234-123456789abc must not render.",
        ],
        next_take_plan: {
          steps: [
            "Record the full pass.",
            "Use signed URL https://example.com/video.mp4",
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
    expect(html).toContain("Strong public-safe choice.");
    expect(html).toContain("Record the full pass.");

    const lower = html.toLowerCase();
    expect(lower).not.toContain("overall readiness");
    expect(lower).not.toContain("acting: 91");
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
