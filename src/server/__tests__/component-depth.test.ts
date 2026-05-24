import { describe, it, expect } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import fs from "node:fs";
import path from "node:path";

describe("component-breakdown depth", () => {
  it("legacy projection maps the public-safe extras and never copies private keys", () => {
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
    expect(v2.components).toHaveLength(1);
    const c = v2.components[0];
    expect(c.what_it_shows).toMatch(/lyric specificity/);
    expect(c.key_evidence).toMatch(/01:42/);
    expect(c.style_or_task_confidence).toBe("high");
    const json = JSON.stringify(c);
    expect(json).not.toContain("evidence_anchors");
    expect(json).not.toContain("supports");
    expect(json).not.toContain("anchor_id");
  });

  it("renderer source includes the new component-detail labels", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/report/V2ReportView.tsx"),
      "utf8",
    );
    expect(src).toContain("What it shows");
    expect(src).toContain("What's assessable");
    expect(src).toContain("Key evidence");
    expect(src).toContain("Score driver");
    expect(src).toContain("Close the gap");
    expect(src).toContain("style/task confidence");
  });
});
