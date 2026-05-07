import { describe, it, expect } from "vitest";
import {
  enforcePublicReportOutputQuality,
  detectFramingFixed,
  pickComparisonHeadline,
} from "@/server/report-output-enforcement.server";

const baseCtx = {
  mode: "brief" as const,
  auditionType: "musical_theatre",
  framingFixed: true,
  materialPolicy: "fixed" as const,
};

function withHeadline(h: string) {
  return { casting_headline: h, scores: { acting: 70 }, overall_score: 70, verdict_final: "ready_with_notes" };
}

describe("castability / callback / workshop overclaim suppression", () => {
  // Phase 3C P2 — soft overclaims are REWRITTEN to safer wording.
  const rewritten: Array<[string, RegExp]> = [
    ["Highly castable for musical theatre development.", /well aligned with the supplied brief/i],
    ["Highly castable for contemporary legit musical theatre.", /well aligned with the supplied brief/i],
    ["Strong contender for a workshop environment.", /a strong tape for the stated task/i],
    ["Recall-worthy take.", /ready to submit/i],
    ["Callback-ready performance.", /ready to submit/i],
    ["Strong callback potential here.", /^$/], // sentence-drop (hard overclaim)
  ];
  for (const [p, re] of rewritten) {
    it(`rewrites or drops: ${p}`, () => {
      const out = enforcePublicReportOutputQuality(withHeadline(p), baseCtx);
      const headline = (out.report.casting_headline as string) ?? "";
      if (re.source === "^$") {
        expect(headline).toBe("");
        expect(out.counters.castability_removed).toBeGreaterThan(0);
      } else {
        expect(headline).toMatch(re);
        expect(out.counters.castability_rewritten).toBeGreaterThan(0);
      }
    });
  }

  // Hard overclaims still drop entirely (no safe rewrite available).
  const dropped = [
    "Highly castable for development workshops.",
    "Bookable for the role.",
    "Marketable singer with commercial look.",
    "Would get a recall on this material.",
  ];
  for (const p of dropped) {
    it(`drops: ${p}`, () => {
      const out = enforcePublicReportOutputQuality(withHeadline(p), baseCtx);
      const headline = (out.report.casting_headline as string) ?? "";
      // Either dropped entirely, or rewritten then dropped on residual hard token.
      const stillUnsafe = /\b(?:bookable|marketable|commercial look|would get a recall)\b/i.test(headline);
      expect(stillUnsafe).toBe(false);
    });
  }

  it("preserves neutral 'development workshop' brief reference when no overclaim", () => {
    const r = withHeadline(
      "The submitted tape was prepared for a development workshop project.",
    );
    const out = enforcePublicReportOutputQuality(r, baseCtx);
    expect(out.report.casting_headline).toMatch(/development workshop/i);
  });

  it("does not change scores, overall_score, verdict, role_fit_modifier", () => {
    const r = {
      casting_headline: "Highly castable.",
      scores: { acting: 70, vocal: 65, technical: 80, audio: 70, brief_adherence: 75, professional_presentation: 72 },
      overall_score: 73,
      verdict_final: "ready",
      role_fit_modifier: 2,
      score_breakdown: { foo: "bar" },
    };
    const snap = JSON.stringify(r);
    const out = enforcePublicReportOutputQuality(r, baseCtx);
    expect(JSON.stringify(r)).toBe(snap); // input untouched
    expect(out.report.scores).toEqual(r.scores);
    expect(out.report.overall_score).toBe(73);
    expect(out.report.verdict_final).toBe("ready");
    expect(out.report.role_fit_modifier).toBe(2);
    expect(out.report.score_breakdown).toEqual({ foo: "bar" });
  });
});

describe("generic phrase anchoring", () => {
  it("removes unanchored 'strong vocal performance'", () => {
    const out = enforcePublicReportOutputQuality(
      withHeadline("Strong vocal performance throughout."),
      baseCtx,
    );
    expect(out.report.casting_headline).toBe("");
    expect(out.counters.generic_unanchored_removed).toBeGreaterThan(0);
  });

  it("keeps anchored timestamped 'strong legit tone at 02:45'", () => {
    const out = enforcePublicReportOutputQuality(
      withHeadline("Strong legit tone and clear diction at 02:45."),
      baseCtx,
    );
    expect(out.report.casting_headline).toMatch(/02:45/);
  });

  it("keeps 'reader response at 00:42 shows warmth'", () => {
    const out = enforcePublicReportOutputQuality(
      withHeadline("Reader response at 00:42 shows warmth."),
      baseCtx,
    );
    expect(out.report.casting_headline).toMatch(/00:42/);
  });

  it("removes unanchored 'grounded acting'", () => {
    const out = enforcePublicReportOutputQuality(
      withHeadline("Grounded acting throughout."),
      baseCtx,
    );
    expect(out.report.casting_headline).toBe("");
  });
});

describe("brief-adherence overconfidence cleanup", () => {
  it("strips 'all specific brief requirements were met precisely'", () => {
    const r = {
      casting_insight: "All specific brief requirements were met precisely.",
      scores: { brief_adherence: 80 },
    };
    const out = enforcePublicReportOutputQuality(r, baseCtx);
    expect(out.report.casting_insight).not.toMatch(/precisely/i);
    expect(out.counters.brief_overconfidence_rewritten).toBeGreaterThan(0);
    expect((out.report.scores as Record<string, number>).brief_adherence).toBe(80);
  });

  it("strips flawless adherence and full marks for adherence", () => {
    const out = enforcePublicReportOutputQuality(
      { casting_insight: "Flawless adherence. Full marks for adherence." },
      baseCtx,
    );
    expect(out.report.casting_insight).not.toMatch(/flawless|full marks/i);
  });

  it("inserts safe replacement when category_notes.brief_adherence becomes empty", () => {
    const out = enforcePublicReportOutputQuality(
      { category_notes: { brief_adherence: "Spot on." } },
      baseCtx,
    );
    expect((out.report.category_notes as Record<string, string>).brief_adherence).toMatch(
      /consistent with the supplied brief/i,
    );
  });
});

describe("professional_presentation anti-polish cleanup", () => {
  it("removes 'highly professional tape' and 'technically polished'", () => {
    const out = enforcePublicReportOutputQuality(
      {
        category_notes: {
          professional_presentation:
            "Highly professional tape. Technically polished.",
        },
      },
      baseCtx,
    );
    const note = (out.report.category_notes as Record<string, string>)
      .professional_presentation;
    expect(note).not.toMatch(/highly professional tape|technically polished/i);
    expect(out.counters.presentation_polish_removed).toBeGreaterThan(0);
  });

  it("removes 'well-lit', 'neutral background', 'no distractions'", () => {
    const out = enforcePublicReportOutputQuality(
      {
        category_notes: {
          professional_presentation:
            "Well-lit against a neutral background ensuring no distractions.",
        },
      },
      baseCtx,
    );
    const note = (out.report.category_notes as Record<string, string>)
      .professional_presentation;
    expect(note).not.toMatch(/well-lit|neutral background|no distractions/i);
  });

  it("removes wardrobe/clothing language ('solid colour of your top')", () => {
    const out = enforcePublicReportOutputQuality(
      { presentation_notes: ["The solid colour of your top reads cleanly."] },
      baseCtx,
    );
    expect(out.report.presentation_notes).toEqual([]);
  });

  it("preserves assessability wording like 'head-and-shoulders framing'", () => {
    const out = enforcePublicReportOutputQuality(
      {
        category_notes: {
          professional_presentation:
            "Head-and-shoulders framing maintained throughout.",
        },
      },
      baseCtx,
    );
    expect(
      (out.report.category_notes as Record<string, string>).professional_presentation,
    ).toMatch(/head-and-shoulders/i);
  });
});

describe("fixed-frame / rehearsal-only rewrite", () => {
  it("rewrites walking advice as rehearsal-only", () => {
    const out = enforcePublicReportOutputQuality(
      { next_take_plan: { steps: ["Practice the bridge while walking."] } },
      baseCtx,
    );
    const step = (out.report.next_take_plan as { steps: string[] }).steps[0];
    expect(step.toLowerCase()).toContain("rehearsal-only");
    expect(step).toMatch(/head-and-shoulders/);
    expect(out.counters.framing_rehearsal_rewritten).toBeGreaterThan(0);
  });

  it.each([
    "Try standing to record this take.",
    "Hold the script and work it physically.",
    "Use props to anchor the moment.",
    "Move around the room to find more weight.",
  ])("rewrites: %s", (s) => {
    const out = enforcePublicReportOutputQuality(
      { coaching_drills: [s] },
      baseCtx,
    );
    expect((out.report.coaching_drills as string[])[0].toLowerCase()).toContain(
      "rehearsal-only",
    );
  });

  it("does not rewrite when framingFixed=false", () => {
    const out = enforcePublicReportOutputQuality(
      { next_take_plan: { steps: ["Try walking around the room."] } },
      { ...baseCtx, framingFixed: false },
    );
    expect(out.counters.framing_rehearsal_rewritten).toBe(0);
  });
});

describe("idempotence + privacy + caps", () => {
  const messy = {
    casting_headline: "Highly castable for musical theatre development.",
    casting_insight: "Strong vocal performance. Reader response at 00:42 shows warmth.",
    strengths: ["Polished.", "Diction clear at 02:45."],
    improvements: ["Walk around the room.", "Open the second verse."],
    category_notes: {
      professional_presentation: "Highly professional tape.",
      brief_adherence: "Flawless adherence.",
    },
    presentation_notes: ["Well-lit against neutral background."],
    next_take_plan: { steps: ["Hold the script."] },
    timestamped_notes: [
      { timestamp: "00:42", note: "Reader response warm." },
    ],
    scores: { acting: 70, vocal: 65 },
    overall_score: 70,
    verdict_final: "ready_with_notes",
  };

  it("is idempotent", () => {
    const a = enforcePublicReportOutputQuality(messy, baseCtx).report;
    const b = enforcePublicReportOutputQuality(a, baseCtx).report;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("does not introduce private/forbidden keys", () => {
    const out = enforcePublicReportOutputQuality(messy, baseCtx).report;
    const FORBIDDEN = [
      "shadow_scores",
      "shadow_score",
      "qa_counters",
      "future_dimensions",
      "evidence_anchors",
      "dimension_confidence",
      "legacy_scores",
    ];
    const json = JSON.stringify(out);
    for (const k of FORBIDDEN) expect(json).not.toContain(`"${k}"`);
  });

  it("preserves scores/overall/verdict exactly", () => {
    const out = enforcePublicReportOutputQuality(messy, baseCtx).report;
    expect(out.scores).toEqual(messy.scores);
    expect(out.overall_score).toBe(messy.overall_score);
    expect(out.verdict_final).toBe(messy.verdict_final);
  });

  it("does not add items to capped arrays", () => {
    const out = enforcePublicReportOutputQuality(messy, baseCtx).report;
    expect((out.strengths as unknown[]).length).toBeLessThanOrEqual(3);
    expect((out.improvements as unknown[]).length).toBeLessThanOrEqual(3);
    expect((out.timestamped_notes as unknown[]).length).toBeLessThanOrEqual(8);
  });
});

describe("detectFramingFixed", () => {
  it.each([
    "head-and-shoulders only",
    "Static, fixed framing",
    "close-up to camera",
    "self-tape camera-led",
  ])("detects: %s", (s) => {
    expect(detectFramingFixed(s)).toBe(true);
  });
  it("returns false for null/empty/loose framing", () => {
    expect(detectFramingFixed(null)).toBe(false);
    expect(detectFramingFixed("")).toBe(false);
    expect(detectFramingFixed("any framing welcome")).toBe(false);
  });
});

describe("pickComparisonHeadline", () => {
  it("prefers casting_headline", () => {
    expect(pickComparisonHeadline({ casting_headline: "v1", headline: "v2" })).toBe("v1");
  });
  it("falls back to v2 headline", () => {
    expect(pickComparisonHeadline({ headline: "v2 headline" })).toBe("v2 headline");
  });
  it("falls back to insight", () => {
    expect(pickComparisonHeadline({ insight: "ok" })).toBe("ok");
  });
  it("returns null for malformed/empty", () => {
    expect(pickComparisonHeadline(null)).toBeNull();
    expect(pickComparisonHeadline({})).toBeNull();
    expect(pickComparisonHeadline({ casting_headline: "   " })).toBeNull();
  });
});
