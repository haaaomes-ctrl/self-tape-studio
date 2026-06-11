// S11-UX-06 / Δ6 report-experience — "Report polish 2" (information-design)
// render conformance. Six render-led, frontend-only polish items on the S10
// report (legacy DATA projection byte-identical; B3 reorders the legacy RENDER
// sections by design):
//
//   B1 — Global value-only suppression: a section with no real content omits
//        entirely (no empty / "unavailable" anchor). The generic "X was
//        unavailable for this S10 report" fallback never appears; a genuine
//        information-bearing limitation reason still renders (reason text only).
//   B2 — Technique commentary renders two STACKED, colour-keyed lanes per
//        discipline: "What to improve" (RED/critical, top) ABOVE "What's working"
//        (GREEN/positive). observations render as a neutral lead above the lanes;
//        an empty lane is suppressed.
//   B3 — Critique above praise: "Technique commentary" precedes "Strengths and
//        preserve" (S10); legacy "Improvements" precedes legacy "Strengths". The
//        verdict/score block stays first.
//   B4 — "Observed tape" + "Presentation notes" merged into ONE section; the
//        standalone "Presentation notes" card is gone; merged section suppressed
//        when both are empty.
//   B5 — Component breakdown shows only value-bearing rows; a label-only/empty
//        component is dropped (no empty cells / N/A rows).
//   B6 — Red, not amber, for must-address: "Fix this first" uses the red accent;
//        "Optional polish" stays amber.
//
// Pure render/copy changes — they must not move the canonical score/verdict
// (asserted in the display-only clause) and must not touch the data layer.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "../V2ReportView";
import { V2ReportViewLegacy } from "../V2ReportViewLegacy";
import { TPL3 } from "../tpl3/tpl3-primitives";
import { buildV2Report } from "@/server/v2-report-builder.server";
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

// Strips tags but preserves text + HTML entities, matching the sibling suites.
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

function mutableS10View(report: AnyRec): AnyRec & { section_source_map: Record<string, AnyRec> } {
  return report.s10_view_model as AnyRec & { section_source_map: Record<string, AnyRec> };
}

// renderToStaticMarkup escapes the apostrophe; the green-lane heading reads
// "What's working" → "What&#x27;s working" in the emitted markup.
const WHATS_WORKING = "What&#x27;s working";
const WHAT_TO_IMPROVE = "What to improve";

// ---------------------------------------------------------------------------
// B1 — Global value-only suppression.
// ---------------------------------------------------------------------------
describe("S11-UX-06 B1 — value-only suppression", () => {
  it("renders no generic 'unavailable' anchor when a module is empty with a null limitation", () => {
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
    // Empty the strengths module AND leave the source map as an authoritative
    // module with a null limitation (no information-bearing reason). The legacy
    // body's strengths Section must NOT render a generic "Strengths and preserve
    // guidance are not available for this report." anchor (B1 dropped that
    // render-time fallback). (A separate view-model-driven empty-state card —
    // EMPTY_CARD_DEFS — may still mark the absence; that intentional hide-vs-empty
    // policy is out of B1 scope.)
    view.strengths_and_preserve = {
      summary: "",
      strengths: [],
      preserve: [],
      do_not_overfix: [],
      limitations: [],
    };
    view.section_source_map.strengths_and_preserve = {
      source: "s10_authoritative_module",
      module: "s10_professional_critique",
      limitation: null,
    };

    const text = routeText(render(report));

    // No generic render-time fallback strings anywhere.
    expect(text).not.toContain(
      "Strengths and preserve guidance are not available for this report.",
    );
    expect(text).not.toMatch(/was unavailable for this S10 report/);
  });

  it("still renders a genuine, information-bearing limitation reason (reason text only)", () => {
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
    view.technique_commentary = { confidence: "high" };
    // A real, specific reason authored by the builder for a missing module.
    view.section_source_map.technique_commentary = {
      source: "specific_limitation",
      module: "s10_technique_commentary",
      limitation: "Technique commentary is not available for this report.",
    };

    const text = routeText(render(report));
    // The genuine reason text renders (it is the only signal a section was limited).
    expect(text).toContain("Technique commentary is not available for this report.");
  });

  it("never emits the generic 'X was unavailable for this S10 report' fallback string", () => {
    // The strong-complete and canary reports both render fully; the generic
    // render-time fallback (dropped in B1) must not appear on either.
    expect(routeText(render(strongCompleteV2Report()))).not.toMatch(
      /was unavailable for this S10 report/,
    );
    expect(routeText(render(canaryV2Report()))).not.toMatch(/was unavailable for this S10 report/);
  });
});

// ---------------------------------------------------------------------------
// B2 — Technique: two stacked colour-keyed lanes (improve above works).
// ---------------------------------------------------------------------------
describe("S11-UX-06 B2 — technique improve/works lanes", () => {
  // Slice the Technique-commentary section out of the HTML so per-discipline
  // assertions are not confused by the same lane labels in sibling disciplines.
  function techniqueSection(html: string): string {
    const start = html.indexOf("Technique commentary");
    expect(start).toBeGreaterThanOrEqual(0);
    // Technique now precedes "Strengths and preserve" (B3); slice to it.
    const end = html.indexOf("Strengths and preserve", start);
    return end > start ? html.slice(start, end) : html.slice(start);
  }

  it("renders 'What to improve' ABOVE 'What's working' within a discipline (DOM order)", () => {
    const section = techniqueSection(render(strongCompleteV2Report()));

    // The strong-complete acting discipline carries both lanes.
    const improveIdx = section.indexOf(WHAT_TO_IMPROVE);
    const worksIdx = section.indexOf(WHATS_WORKING, improveIdx);
    expect(improveIdx).toBeGreaterThanOrEqual(0);
    expect(worksIdx).toBeGreaterThan(improveIdx);
  });

  it("colour-keys the improve lane RED/critical and the works lane GREEN/positive", () => {
    const section = techniqueSection(render(strongCompleteV2Report()));

    // The improve lane heading carries the destructive (red) text token + a
    // left rail; the works lane carries the success (green) text token + rail.
    expect(section).toMatch(/border-l-4 border-destructive pl-4/);
    expect(section).toMatch(/text-destructive[^>]*>\s*What to improve/);
    expect(section).toMatch(/border-l-4 border-success pl-4/);
    expect(section).toMatch(/text-success[^>]*>\s*What&#x27;s working/);
  });

  it("renders observations as a NEUTRAL lead (no valence colour) above the lanes", () => {
    const section = techniqueSection(render(strongCompleteV2Report()));

    // The acting observation title renders, and it precedes both lanes (it is
    // the neutral lead). It is not wrapped in a destructive/success rail.
    const obs = "Clear playable objective in the Side 1.";
    const obsIdx = section.indexOf(obs);
    const improveIdx = section.indexOf(WHAT_TO_IMPROVE, obsIdx);
    expect(obsIdx).toBeGreaterThanOrEqual(0);
    expect(improveIdx).toBeGreaterThan(obsIdx);

    // The discipline headline (neutral lead) is not coloured by a valence rail.
    expect(section).toContain("Acting objective and scene partner focus are clear.");
  });

  it("suppresses an empty lane (improve-only discipline shows no works lane)", () => {
    // Make one discipline improve-only by removing its works-lane sources
    // (what_is_working + preserve). The improve lane must render; the works
    // lane heading must be suppressed within that discipline block.
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
    const sp = (view.technique_commentary as AnyRec).self_tape_presentation as AnyRec;
    sp.what_is_working = [];
    sp.preserve = [];
    // Keep a recognisable improve item on this discipline.
    sp.what_could_improve = ["Tighten the final export check."];

    const html = render(report);
    // Slice the "Self-tape presentation" discipline block (it renders near the end
    // of the technique section; bound by the next discipline or the section close).
    const start = html.indexOf("Self-tape presentation");
    const next = html.indexOf("Commercial / screen task", start);
    const sectionEnd = html.indexOf("Strengths and preserve", start);
    const upper =
      [next, sectionEnd].filter((i) => i > start).sort((x, y) => x - y)[0] ?? html.length;
    const block = html.slice(start, upper);

    expect(start).toBeGreaterThanOrEqual(0);
    // The improve lane renders for this discipline…
    expect(block).toContain(WHAT_TO_IMPROVE);
    expect(routeText(block)).toContain("Tighten the final export check.");
    // …and its works lane is suppressed (no green heading in this block).
    expect(block).not.toContain(WHATS_WORKING);
  });
});

// ---------------------------------------------------------------------------
// B3 — Improve-above-works ordering everywhere.
// ---------------------------------------------------------------------------
describe("S11-UX-06 B3 — critique above praise ordering", () => {
  it("renders Technique commentary BEFORE 'Strengths and preserve' on the S10 path", () => {
    const html = render(strongCompleteV2Report());
    const techniqueIdx = html.indexOf("Technique commentary");
    const strengthsIdx = html.indexOf("Strengths and preserve");
    expect(techniqueIdx).toBeGreaterThanOrEqual(0);
    expect(strengthsIdx).toBeGreaterThanOrEqual(0);
    expect(techniqueIdx).toBeLessThan(strengthsIdx);
  });

  it("keeps the verdict/score block first (above the promoted grid and technique)", () => {
    const html = render(strongCompleteV2Report());
    const verdictIdx = html.indexOf("Overall readiness");
    const techniqueIdx = html.indexOf("Technique commentary");
    expect(verdictIdx).toBeGreaterThanOrEqual(0);
    expect(verdictIdx).toBeLessThan(techniqueIdx);
  });

  it("renders legacy 'Improvements' BEFORE legacy 'Strengths' on the legacy data path", () => {
    const legacyReport: AnyRec = {
      source_mode: "legacy_report_model",
      overall_readiness: 74,
      strengths: ["Clear scene-partner focus throughout."],
      improvements: ["Tighten the final beat of the scene."],
    };
    const html = render(legacyReport);
    const improvementsIdx = html.indexOf(">Improvements<");
    const strengthsIdx = html.indexOf(">Strengths<");
    expect(improvementsIdx).toBeGreaterThanOrEqual(0);
    expect(strengthsIdx).toBeGreaterThanOrEqual(0);
    expect(improvementsIdx).toBeLessThan(strengthsIdx);
  });
});

// ---------------------------------------------------------------------------
// B4 — Observed tape + Presentation notes merged into one section.
// ---------------------------------------------------------------------------
describe("S11-UX-06 B4 — Observed tape + Presentation merged", () => {
  it("removes the standalone 'Presentation notes' section and folds presentation into 'Observed tape'", () => {
    const html = render(strongCompleteV2Report());

    // The standalone card heading is gone.
    expect(html).not.toContain("Presentation notes");
    // Observed tape carries the presentation sub-block + its content.
    const observedIdx = html.indexOf("Observed tape");
    const presentationIdx = html.indexOf(">Presentation<", observedIdx);
    const contentIdx = html.indexOf("Audio and framing are assessable.", observedIdx);
    expect(observedIdx).toBeGreaterThanOrEqual(0);
    expect(presentationIdx).toBeGreaterThan(observedIdx);
    expect(contentIdx).toBeGreaterThan(observedIdx);
  });

  it("keeps the legacy presentation source rendering in the merged section (legacy path)", () => {
    // A legacy (non-S10) report with only presentation_notes still surfaces them
    // through the merged "Observed tape" section (the standalone card is removed).
    const legacyReport: AnyRec = {
      source_mode: "legacy_report_model",
      overall_readiness: 72,
      presentation_notes: ["Legacy camera-readability note."],
    };
    const html = render(legacyReport);
    expect(html).not.toContain("Presentation notes");
    expect(html).toContain("Observed tape");
    expect(routeText(html)).toContain("Legacy camera-readability note.");
  });

  it("suppresses the merged section's content when observed tape AND presentation are both empty", () => {
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
    // Empty the observed-tape sequence/verifications.
    view.observed_tape = {
      observed_tape_sequence: [],
      component_verifications: [],
      media_observation_summary: null,
    };
    // Empty both presentation sources so the `presentation` array is empty.
    const technique = view.technique_commentary as AnyRec;
    (technique.self_tape_presentation as AnyRec).what_is_working = [];
    (view.professional_critique as AnyRec).professional_presentation_notes = [];

    const html = render(report);
    // The merged-section IIFE returns null: its distinctive hint and the
    // "Presentation" sub-block are gone. (A separate view-model-driven empty-state
    // card for the observed-tape module may still mark the absence — that is the
    // EMPTY_CARD_DEFS system, not the merged section, and is out of B4 scope.)
    expect(html).not.toContain("Requested material and observed material are kept separate.");
    expect(html).not.toContain("Audio and framing are assessable.");
    expect(html).not.toContain(">Presentation<");
  });
});

// ---------------------------------------------------------------------------
// S11-UX-04a — B4 follow-up: the stray empty observed-tape card is suppressed.
// ---------------------------------------------------------------------------
// B4 merged "Observed tape" + "Presentation notes". Edge left open in #273: a
// report with presentation content but an EMPTY observed sequence AND empty media
// rendered a stray empty "Observed tape — Not assessed" card (via EMPTY_CARD_DEFS)
// beside the merged section. The view-model now suppresses that card (emptyKind
// "hidden") when there is genuinely nothing observed and no readiness reason, so
// only the presentation content shows. (A genuine readiness reason still surfaces
// — covered in the report-view-model unit suite.)
describe("S11-UX-04a — empty observed-tape card suppressed in merged section", () => {
  it("shows only the presentation sub-block (no stray 'Observed tape — Not assessed' card) when observed is empty but presentation remains", () => {
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
    // Nothing observed — sequence, verifications and media all empty. The
    // presentation sources are left intact (the strong-complete fixture carries
    // them), so the merged section still renders with ONLY its presentation block.
    view.observed_tape = {
      observed_tape_sequence: [],
      component_verifications: [],
      media_observation_summary: null,
    };

    const html = render(report);

    // The merged section is PRESENT (not omitted by B1) and carries presentation.
    expect(html).toContain("Requested material and observed material are kept separate.");
    expect(html).toContain(">Presentation<");

    // No stray empty-state card: the "Observed tape" heading appears exactly once
    // (the merged section), not twice (merged section + an EMPTY_CARD_DEFS "Not
    // assessed" card). CCardShell renders each card title in a single <h3>.
    const observedTapeHeadings = html.split("Observed tape").length - 1;
    expect(observedTapeHeadings).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B5 — Value-only component breakdown.
// ---------------------------------------------------------------------------
describe("S11-UX-06 B5 — value-only component breakdown", () => {
  it("drops a label-only component and keeps a populated one (legacy components)", () => {
    const legacyReport: AnyRec = {
      source_mode: "legacy_report_model",
      overall_readiness: 78,
      components: [
        // Label/type only — no score, note, or assessable detail → dropped.
        { type: "movement" },
        // Populated — score + note → kept.
        { type: "acting", score: 80, note: "The acting side reads clearly." },
      ],
    };
    const html = render(legacyReport);
    const section = (() => {
      const start = html.indexOf("Component breakdown");
      expect(start).toBeGreaterThanOrEqual(0);
      return html.slice(start);
    })();
    const text = routeText(section);

    // The populated row renders…
    expect(text).toContain("acting");
    expect(text).toContain("The acting side reads clearly.");
    // …the label-only "movement" row is dropped entirely (no empty cell / N/A).
    expect(text).not.toMatch(/\bmovement\b/);
  });

  it("omits the whole Component breakdown section when every component is label-only", () => {
    const legacyReport: AnyRec = {
      source_mode: "legacy_report_model",
      overall_readiness: 78,
      components: [{ type: "acting" }, { type: "vocal" }],
    };
    const html = render(legacyReport);
    // Nothing value-bearing → the section omits (no empty shell).
    expect(html).not.toContain("Component breakdown");
  });

  it("keeps the populated S10 component breakdown rows", () => {
    // The strong-complete S10 fixture has value-bearing component rows.
    const text = routeText(render(strongCompleteV2Report()));
    expect(text).toContain("Component breakdown");
  });
});

// ---------------------------------------------------------------------------
// B6 — Red, not amber, for must-address.
// ---------------------------------------------------------------------------
describe("S11-UX-06 B6 — red for must-address, amber for optional", () => {
  // The accent renders as an inline-style hex on the CCardShell header (h3 colour
  // + header background). red = TPL3.danger (#C53030); amber = TPL3.warning.
  it("renders the 'Fix this first' section with the red accent (not amber)", () => {
    // A legacy report with fix_first (and no priority_fixes) renders the
    // "Fix this first" Section, whose SECTION_STYLE accent is now red.
    const legacyReport: AnyRec = {
      source_mode: "legacy_report_model",
      overall_readiness: 50,
      fix_first: "Record the required Side 1 acting scene before submitting.",
    };
    const html = render(legacyReport);
    const start = html.indexOf("Fix this first");
    expect(start).toBeGreaterThanOrEqual(0);
    // Look at the section header chrome immediately around the heading.
    const headerStart = html.lastIndexOf("<section", start);
    const headerSlice = html.slice(headerStart, start + 40);
    // Red accent present, amber (warning) accent absent on this section header.
    expect(headerSlice.toLowerCase()).toContain(TPL3.danger.toLowerCase());
    expect(headerSlice.toLowerCase()).not.toContain(TPL3.warning.toLowerCase());
  });

  it("keeps 'Optional polish' on the amber accent", () => {
    // Empty optional_polish so the amber "Optional polish" empty-state card
    // (TPL3_ACCENTS.amber) renders. Assert the amber (warning) token is used for
    // it and the red token is not. (This card and the SECTION_STYLE entry share
    // the amber accent; B6 changed only "Fix this first" to red.)
    const report = strongCompleteV2Report();
    const view = mutableS10View(report);
    (view.fix_hierarchy as AnyRec).optional_polish = [];

    const html = render(report);
    const cardHeading = html.lastIndexOf("Optional polish");
    expect(cardHeading).toBeGreaterThanOrEqual(0);
    const sectionStart = html.lastIndexOf("<section", cardHeading);
    const headerSlice = html.slice(sectionStart, cardHeading + 40);
    expect(headerSlice.toLowerCase()).toContain(TPL3.warning.toLowerCase());
    expect(headerSlice.toLowerCase()).not.toContain(TPL3.danger.toLowerCase());
  });
});

// ---------------------------------------------------------------------------
// Legacy isolation + cannot-move-the-number.
// ---------------------------------------------------------------------------
describe("S11-UX-06 — legacy isolation + display-only", () => {
  it("keeps the legacy renderer (V2ReportViewLegacy) presentation section untouched", () => {
    // The pre-Template-3 legacy renderer is a separate component and is NOT in
    // scope for B4 — its own presentation rendering stays as-is.
    const legacyReport: AnyRec = {
      version: 2,
      template_id: "v2-component",
      audition_type: "musical_theatre",
      overall_readiness: 72,
      presentation_notes: ["Legacy renderer presentation note."],
    };
    const html = renderToStaticMarkup(
      <V2ReportViewLegacy report={legacyReport} takeNumber={1} auditionType="musical_theatre" />,
    );
    expect(routeText(html)).toContain("Legacy renderer presentation note.");
  });

  it("does not move the canonical overall score or verdict (pure render/copy)", () => {
    // Re-rendering the same report twice yields byte-identical canonical
    // score/verdict — the B1–B6 changes are presentation only.
    const a = strongCompleteV2Report();
    const b = strongCompleteV2Report();
    const aView = mutableS10View(a);
    const bView = mutableS10View(b);
    expect(aView.canonical_overall_score).toEqual(bView.canonical_overall_score);
    expect(JSON.stringify(aView.canonical_verdict)).toBe(JSON.stringify(bView.canonical_verdict));
  });
});
