import { describe, it, expect } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { V2ReportView } from "@/components/report/V2ReportView";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("R10 locked report component suppression", () => {
  it("does not project component scores or private component keys into the public report", () => {
    const v2 = buildV2Report({
      legacyReport: {
        detected_components: [
          {
            type: "musical_theatre",
            label: "Acting Scene + Song",
            weight: 0.6,
            score: 84,
            note: "Strong scene-to-song lift.",
            what_it_shows: "Acting through song with lyric specificity.",
            what_is_assessable: "Vocal technique, story, transition.",
            key_evidence: "Lift on 'go' at 01:42.",
            score_driver: "Acting-through-song clarity.",
            close_gap: "Sharpen consonant on 'go'.",
            style_or_task_confidence: "high",
            evidence_anchors: [{ id: "a1" }],
            supports: ["x"],
          },
        ],
      },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });
    const json = JSON.stringify(v2);
    expect(json).not.toContain("components");
    expect(json).not.toContain("detected_components");
    expect(json).not.toContain("score_driver");
    expect(json).not.toContain("score");
    expect(json).not.toContain("evidence_anchors");
    expect(json).not.toContain("supports");
    expect(json).not.toContain("anchor_id");
  });

  it("renderer source omits component-score detail labels while locked down", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/report/V2ReportView.tsx"),
      "utf8",
    );
    expect(src).not.toContain("Score driver");
    expect(src).not.toContain("style/task confidence");
    expect(src).toContain("Why this verdict");
    expect(src).toContain("What the brief asked for");
    expect(src).toContain("Do not over-fix");
  });

  it("renders public-safe brief achievement and itemised requirement detail", () => {
    const report = buildV2Report({
      legacyReport: {
        submission_verdict: {
          decision: "review_carefully",
          reason: "A mandatory brief item needs review before submission.",
        },
        brief_requirements: [
          {
            source_text: "Include the requested song cut.",
            public_summary: "Include the requested song cut.",
            category: "material_instruction",
            obligation: "mandatory",
            requirement_type: "song",
            achievement_status: "not_achieved",
            readiness_impact: "submission_blocker",
            public_evidence_summary: "The available tape does not include the requested song cut.",
            next_take_action: "Record the requested song cut before submitting.",
            evidence_anchor_ids: ["private-anchor"],
          },
          {
            source_text: "Show full movement.",
            public_summary: "Show full movement.",
            category: "video_audio_setup",
            requirement_type: "framing",
            achievement_status: "not_assessable",
            readiness_impact: "not_assessable",
            assessability_limits: ["Framing does not show the full movement pathway."],
          },
        ],
      },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });
    const html = renderToStaticMarkup(createElement(V2ReportView, { report }));

    expect(html).toContain("Brief achievement");
    expect(html).toContain("What the brief asked for");
    expect(html).toContain("Include the requested song cut");
    expect(html).toContain("material instruction");
    expect(html).toContain("submission blocker");
    expect(html).toContain("Not assessable: Framing does not show the full movement pathway.");
    expect(html).not.toContain("private-anchor");
  });

  it("renders the full priority-fix hierarchy with the fix-first marker and action", () => {
    const report = buildV2Report({
      legacyReport: {
        priority_fixes: [
          {
            headline: "Clarify the first reaction",
            rationale: "It materially affects submission readiness.",
            action: "Record one pass that lands the first reaction before moving on.",
            kind: "critical_gap",
          },
          {
            headline: "Hold the final beat",
            rationale: "The ending can land more cleanly if retaking.",
            action: "Let the final thought settle before stopping the recording.",
            kind: "quick_win",
          },
          {
            headline: "Sharpen the eyeline shift",
            rationale: "The relationship turn will read more clearly.",
            action: "Set the eyeline before the relationship turn.",
            kind: "quick_win",
          },
          {
            headline: "Reset the breath before the second line",
            rationale: "The breath reset will make the second line cleaner.",
            action: "Take one silent breath reset before the second line.",
            kind: "low_effort_high_impact",
          },
        ],
      },
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
    });
    const html = renderToStaticMarkup(createElement(V2ReportView, { report }));

    expect(html).toContain("Fix first");
    expect(html).toContain("Clarify the first reaction");
    expect(html).toContain("Hold the final beat");
    expect(html).toContain("Sharpen the eyeline shift");
    expect(html).toContain("Reset the breath before the second line");
    expect(html).toContain(
      "Action: Record one pass that lands the first reaction before moving on.",
    );
  });
});
