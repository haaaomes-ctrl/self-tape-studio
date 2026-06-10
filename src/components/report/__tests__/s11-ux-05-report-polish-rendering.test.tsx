// S11-UX-05 / Δ6 report-experience — "Report polish 1" render conformance.
//
// Six render-led polish items on the S10 report, all gated behind the isS10 /
// S10-data path (legacy is byte-identical and asserted untouched):
//
//   A1 — Timestamped notes: time leads, valence cue leads the note, the rail is
//        thicker (border-l-4), and linked_category is demoted to a trailing tag.
//   A2 — "Director's perspective" (renamed from "A practitioner's perspective"),
//        the "One subjective view…" sub-note removed, and the "Next action plan"
//        block relocated to a standalone full-width block directly beneath it
//        (above the promoted grid cards).
//   A3 — "Take context" sub-block removed from the web report.
//   A4 — Scoring-basis summary + the "Scoring basis: <mode>" chip removed; the
//        constructive limitations + score-visibility explanation are kept.
//   A5 — Brief status pills ("Overall/Mandatory/Readiness impact") and the
//        "Requirement classification" count block removed; the per-requirement
//        table + VerdictPill kept.
//   A6 — Defect: a SUBMIT verdict with a positive rationale and an authoritative
//        submission_risk source no longer renders the positive rationale under
//        "Why this isn't ready" (it renders under "Why this recommendation").
//
// These are pure render/copy changes — they must not move the canonical score or
// verdict (asserted in the display-only clause).

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "../V2ReportView";
import { V2ReportViewLegacy } from "../V2ReportViewLegacy";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { enforcePractitionerVoiceModule } from "@/server/report-polish.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

type AnyRec = Record<string, unknown>;

function render(report: AnyRec, props: Partial<React.ComponentProps<typeof V2ReportView>> = {}) {
  return renderToStaticMarkup(
    <V2ReportView report={report} takeNumber={1} auditionType="musical_theatre" {...props} />,
  );
}

// Keeps tags out but preserves text + HTML entities, matching the other suites.
function routeText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function strongCompleteV2Report(): AnyRec {
  return buildV2Report({
    legacyReport: buildS10StrongCompleteProfessionalReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  }) as unknown as AnyRec;
}

function canaryV2Report(): AnyRec {
  return buildV2Report({
    legacyReport: buildS10CanaryAReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  }) as unknown as AnyRec;
}

// Strong-complete report carrying the persisted practitioner-voice module (the base
// fixture does not include it; the MD-voice module is enforced like the P2 suite).
function strongCompleteWithVoiceReport(): AnyRec {
  const input = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
  input.s10_practitioner_voice = {
    note: "There is a real specificity in the closing image that I would protect.",
  };
  enforcePractitionerVoiceModule(input);
  return buildV2Report({
    legacyReport: input,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: {
      ...buildS10StrongCompleteProfessionalViewContext(),
      mdVoiceEnabled: true,
    } as never,
  }) as unknown as AnyRec;
}

function mutableS10View(report: AnyRec): AnyRec & { section_source_map: Record<string, AnyRec> } {
  return report.s10_view_model as AnyRec & { section_source_map: Record<string, AnyRec> };
}

function setTimestampedNotes(report: AnyRec, notes: AnyRec[]) {
  const view = report.s10_view_model as AnyRec;
  const commentary = view.timestamped_commentary as AnyRec;
  commentary.notes = notes;
}

const baseNote: AnyRec = {
  id: "n",
  timecode: "00:10",
  start_time: "00:10",
  display_label: "00:10",
  timestamp_precision: "exact",
  section: "observed_component",
  title: "An observed moment",
  detail: "A specific observed beat with useful evidence.",
  action: null,
  evidence_summary: "Supported by observed component evidence.",
  component_type: "technical",
  component_status: "present",
  confidence: "high",
  valence: "neutral",
  linked_category: null,
};

// ---------------------------------------------------------------------------
// A1 — Timestamped notes: time leads, cue leads, thicker rail, trailing category.
// ---------------------------------------------------------------------------
describe("S11-UX-05 A1 — timestamped-note layout", () => {
  it("leads with the timecode, then the valence cue, with a thicker (border-l-4) rail", () => {
    const report = strongCompleteV2Report();
    setTimestampedNotes(report, [
      {
        ...baseNote,
        id: "n-strength",
        display_label: "01:23",
        title: "Clean opening focus",
        valence: "strength",
        linked_category: null,
      },
    ]);
    const html = render(report);

    // The rail is thickened to border-l-4 (the pre-polish rail was border-l-2).
    expect(html).toContain("border-l-4");
    expect(html).not.toContain("flex gap-3 border-l-2 pl-3");

    // Within a single note <li>, the timecode appears before the valence cue,
    // which appears before the note title — time → cue → text.
    const text = routeText(html);
    const timeIdx = text.indexOf("01:23");
    const cueIdx = text.indexOf("Strength", timeIdx);
    const titleIdx = text.indexOf("Clean opening focus", cueIdx);
    expect(timeIdx).toBeGreaterThanOrEqual(0);
    expect(cueIdx).toBeGreaterThan(timeIdx);
    expect(titleIdx).toBeGreaterThan(cueIdx);
  });

  it("renders linked_category as a trailing tag AFTER the note text, not in the leading header", () => {
    const report = strongCompleteV2Report();
    setTimestampedNotes(report, [
      {
        ...baseNote,
        id: "n-cat",
        display_label: "00:42",
        title: "Audio dips briefly",
        detail: "A short level drop mid-phrase.",
        valence: "improvement",
        linked_category: "audio", // musical_theatre → "Audio clarity"
      },
    ]);
    const text = routeText(render(report));

    // The category tag is demoted: the cue and the note text both precede it.
    const cueIdx = text.indexOf("Work on");
    const titleIdx = text.indexOf("Audio dips briefly", cueIdx);
    const categoryIdx = text.indexOf("Audio clarity", titleIdx);
    expect(cueIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeGreaterThan(cueIdx);
    // Category trails the note text (it no longer sits beside the cue in the header).
    expect(categoryIdx).toBeGreaterThan(titleIdx);
    // The cue still leads the note text.
    expect(cueIdx).toBeLessThan(titleIdx);
  });

  it("omits the category tag when linked_category is null", () => {
    const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;
    const report = strongCompleteV2Report();
    setTimestampedNotes(report, [
      { ...baseNote, id: "n-nocat", title: "A plain observation", linked_category: null },
    ]);
    // "Audio clarity" still appears once via the category-scores row; the null note adds none.
    const baseline = occurrences(routeText(render(strongCompleteV2Report())), "Audio clarity");
    expect(occurrences(routeText(render(report)), "Audio clarity")).toBe(baseline);
  });
});

// ---------------------------------------------------------------------------
// A2 — Director's perspective + relocated Next action plan.
// ---------------------------------------------------------------------------
describe("S11-UX-05 A2 — Director's perspective + Next action plan position", () => {
  it("renames the heading to Director's perspective and removes the sub-note", () => {
    const html = render(strongCompleteWithVoiceReport());
    // Apostrophe-free fragments (renderToStaticMarkup escapes the apostrophe).
    expect(html).toContain("Director");
    expect(html).toContain("perspective");
    expect(html).not.toContain("A practitioner");
    expect(html).not.toContain("One subjective view");
  });

  it("renders the Next action plan BENEATH Director's perspective and ABOVE the grid cards", () => {
    const html = render(strongCompleteWithVoiceReport());

    const directorIdx = html.indexOf("Director");
    const nextActionIdx = html.indexOf("Next action plan");
    const categoryIdx = html.indexOf("Category scores");

    expect(directorIdx).toBeGreaterThanOrEqual(0);
    expect(nextActionIdx).toBeGreaterThanOrEqual(0);
    expect(categoryIdx).toBeGreaterThanOrEqual(0);

    // DOM order: Director's perspective → Next action plan → grid's Category scores.
    expect(directorIdx).toBeLessThan(nextActionIdx);
    expect(nextActionIdx).toBeLessThan(categoryIdx);
  });
});

// ---------------------------------------------------------------------------
// A3/A4/A5 — removals on the web report, with the constructive content kept.
// ---------------------------------------------------------------------------
describe("S11-UX-05 A3/A4/A5 — Context-card + brief-pill removals", () => {
  it("removes Take context from the web report (A3)", () => {
    const text = routeText(
      render(strongCompleteV2Report(), {
        takeNumber: 2,
        takeSlot: 2,
        takeVersionNumber: 3,
        takeVersionStatus: "active",
        replacesTakeId: "raw-replaced-take-id",
        sameVideoStatus: "same_video_confirmed",
      }),
    );
    expect(text).not.toContain("Take context");
    expect(text).not.toContain("Active version: Version 3");
    expect(text).not.toContain("raw-replaced-take-id");
  });

  it("removes the scoring-basis summary + chip but keeps a scoring limitation when present (A4)", () => {
    // The strong-complete (brief_supplied) report has no required_limitations, so the
    // no-brief report is used to prove a constructive limitation still renders.
    const briefSupplied = routeText(render(strongCompleteV2Report()));
    expect(briefSupplied).not.toContain("Scoring basis: Brief supplied");
    expect(briefSupplied).not.toContain("Score language may include supplied brief achievement");
    // The constructive score-visibility line stays.
    expect(briefSupplied).toContain("Score visibility:");

    const noBriefInput = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
    delete noBriefInput.brief_context;
    delete noBriefInput.brief_requirements;
    delete noBriefInput.brief_achievement_matrix;
    noBriefInput.mode = "baseline";
    noBriefInput.scoring_mode = "no_brief_baseline";
    const noBriefContext = buildS10StrongCompleteProfessionalViewContext() as AnyRec;
    delete noBriefContext.briefContext;
    delete noBriefContext.briefRequirements;
    const noBrief = routeText(
      render(
        buildV2Report({
          legacyReport: noBriefInput,
          futureDimensions: null,
          auditionType: "musical_theatre",
          mode: "baseline",
          s10Context: noBriefContext as never,
        }) as unknown as AnyRec,
      ),
    );
    // The chip is gone, but the no-brief required limitation still renders under the card.
    expect(noBrief).not.toContain("Scoring basis: No brief baseline");
    expect(noBrief).toContain("Scoring basis"); // the card heading remains
    expect(noBrief).toContain("No casting brief was supplied");
  });

  it("removes the brief status + classification pills but keeps the table and VerdictPill (A5)", () => {
    const text = routeText(render(canaryV2Report()));

    // The status pills and the classification count block are gone.
    expect(text).not.toContain("Requirement classification");
    expect(text).not.toContain("Mandatory: 6");
    expect(text).not.toMatch(/Overall:\s/);
    expect(text).not.toMatch(/Readiness impact:/);

    // The per-requirement table and its rows are kept.
    expect(text).toContain("Brief requirements checked");
    expect(text).toContain("Required Side 1 acting scene");
    // The VerdictPill / recommendation still surfaces.
    expect(text).toContain("Retake required if possible");
  });
});

// ---------------------------------------------------------------------------
// A6 — the defect (FAIL-FIRST against pre-fix code).
// ---------------------------------------------------------------------------
describe("S11-UX-05 A6 — 'Why this isn't ready' must not list positives", () => {
  // Slice the rendered HTML into the "Why this isn't ready" region (the blockers
  // card) vs the "Why this recommendation" region (the rationale card).
  function blockersRegion(html: string): string {
    const start = html.indexOf("Why this isn&#x27;t ready");
    if (start < 0) return "";
    const end = html.indexOf("Why this recommendation", start);
    return end > start ? html.slice(start, end) : html.slice(start);
  }
  function rationaleRegion(html: string): string {
    const start = html.indexOf("Why this recommendation");
    return start >= 0 ? html.slice(start) : "";
  }

  // FAIL-FIRST: a SUBMIT verdict whose recommendation rationale is positive, with an
  // authoritative submission_risk source. Pre-fix, the blockers gate fired on the
  // risk source and rendered the positive rationale under "Why this isn't ready".
  // The submission_risk entry uses a schema-valid module so the view model stays
  // usable (the strict view-model validator rejects unknown source-map entries).
  it("renders a positive submit rationale under 'Why this recommendation', not 'Why this isn't ready'", () => {
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
    // An authoritative submission-risk source (the trigger the pre-fix gate used).
    view.section_source_map.submission_risk = {
      source: "s10_authoritative_module",
      module: "readiness_score_judgement",
      limitation: null,
    };

    const html = render(report);
    const POSITIVE = "The required Side 1 and song are present and complete.";

    // The positive rationale must NOT appear under "Why this isn't ready".
    expect(blockersRegion(html)).not.toContain(POSITIVE);
    // It renders under "Why this recommendation" instead.
    expect(rationaleRegion(html)).toContain(POSITIVE);
  });

  // A blocking verdict still shows its deterministic shortfalls under "Why this
  // isn't ready" (the fix is complementary, not a removal of the blockers card).
  it("still shows a blocking verdict's shortfalls under 'Why this isn't ready'", () => {
    const html = render(canaryV2Report());
    // The canonical recommendation.rationale for the canary blocking verdict.
    const SHORTFALL =
      "The required Side 1 acting scene is missing — record it and shoot a fresh take before submitting.";
    expect(blockersRegion(html)).toContain(SHORTFALL);
    // A blocking verdict does not use the "Why this recommendation" card for its rationale.
    expect(rationaleRegion(html)).not.toContain(SHORTFALL);
  });
});

// ---------------------------------------------------------------------------
// Legacy isolation + cannot-move-the-number.
// ---------------------------------------------------------------------------
describe("S11-UX-05 — legacy isolation + display-only", () => {
  it("does not apply any S11-UX-05 S10 polish to a non-S10 report", () => {
    const nonS10Report: AnyRec = {
      version: 2,
      template_id: "v2-component",
      audition_type: "musical_theatre",
      overall_readiness: 72,
    };
    const html = render(nonS10Report);

    // None of the S10-only chrome appears on the non-S10 path.
    expect(html).not.toContain("Director");
    expect(html).not.toContain("Requirement classification");
    expect(html).not.toContain("Brief requirements checked");
  });

  it("keeps the legacy practitioner heading + sub-note byte-identical (V2ReportViewLegacy)", () => {
    const input = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
    input.s10_practitioner_voice = { note: "A legacy-rendered subjective note." };
    enforcePractitionerVoiceModule(input);
    const report = buildV2Report({
      legacyReport: input,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: {
        ...buildS10StrongCompleteProfessionalViewContext(),
        mdVoiceEnabled: true,
      } as never,
    }) as unknown as AnyRec;

    const html = renderToStaticMarkup(
      <V2ReportViewLegacy report={report} takeNumber={1} auditionType="musical_theatre" />,
    );
    // Legacy is untouched: original heading + sub-note, no rename.
    expect(html).toContain("A practitioner");
    expect(html).toContain("One subjective view");
    expect(html).not.toContain("Director");
  });

  it("does not move the canonical overall score or verdict (pure render/copy)", () => {
    // The A6 submission_risk mutation is display-only: the canonical score/verdict
    // are byte-identical with vs without it.
    const withoutReport = strongCompleteV2Report();
    const withoutView = mutableS10View(withoutReport);

    const withReport = strongCompleteV2Report();
    const withView = mutableS10View(withReport);
    withView.section_source_map.submission_risk = {
      source: "s10_authoritative_module",
      module: "readiness_score_judgement",
      limitation: null,
    };

    expect(withView.canonical_overall_score).toEqual(withoutView.canonical_overall_score);
    expect(JSON.stringify(withView.canonical_verdict)).toBe(
      JSON.stringify(withoutView.canonical_verdict),
    );
  });
});
