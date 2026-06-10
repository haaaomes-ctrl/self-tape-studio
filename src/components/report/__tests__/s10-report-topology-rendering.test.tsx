// Δ6 P3b — report-experience topology (render-only) conformance.
//
// arch-report-derivation-architecture / Δ6 P3 report-experience topology.
//
// Two render-only changes, scoped to the primary S10 tpl3 path ONLY:
//   (1) Promote the "Category scores" and "Prioritised fixes" cards to the TOP of
//       the card grid — directly beneath the score-ring/verdict headline block,
//       above every other section. Legacy (isS10 === false) keeps its existing
//       mid-sequence order, byte-identical.
//   (2) Enrich each S10 Category-scores row with the fuller per-category rationale
//       read from s10.canonical_category_scores (what_works / score_basis /
//       why_not_full_score / close_gap), each presence-gated. Legacy keeps the
//       single category_notes line, byte-identical.
//
// No score/verdict/cap/builder/AI-schema/view-model change — V2ReportView render
// path only. These assertions pin the topology and the branch isolation.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "../V2ReportView";
import { buildV2Report } from "@/server/v2-report-builder.server";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

type AnyRec = Record<string, unknown>;

function renderV2(report: AnyRec, props: Partial<React.ComponentProps<typeof V2ReportView>> = {}) {
  return renderToStaticMarkup(
    <V2ReportView report={report} takeNumber={1} auditionType="musical_theatre" {...props} />,
  );
}

function routeText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function strongCompleteS10Report(): AnyRec {
  return buildV2Report({
    legacyReport: buildS10StrongCompleteProfessionalReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  }) as unknown as AnyRec;
}

// A non-S10 report rendered through Template 3 (the kill-switch stays open, so
// V2ReportView renders the tpl3 grid, NOT the legacy component). isS10 is false:
// no s10_view_model, source_mode !== "s10_ai_report_model", and none of the seven
// S10 module objects are present. The legacy Category-scores + Prioritised-fixes
// branches read report.scores / report.category_notes / report.priority_fixes.
function legacyDataReport(): AnyRec {
  return {
    source_mode: "legacy_report_model",
    overall_readiness: 78,
    scores: {
      acting: 80,
      audio: 76,
      technical: 74,
    },
    category_notes: {
      acting: "LEGACY_ACTING_NOTE single-line rationale.",
      audio: "LEGACY_AUDIO_NOTE single-line rationale.",
      technical: "LEGACY_TECHNICAL_NOTE single-line rationale.",
    },
    priority_fixes: [
      {
        headline: "Tighten the final beat of the scene.",
        rationale: "LEGACY_FIX_RATIONALE keeps the read crisp.",
      },
    ],
    strengths: ["Clear scene-partner focus throughout."],
    components: [
      {
        type: "acting",
        score: 80,
        note: "The acting side reads clearly.",
      },
    ],
  };
}

describe("Δ6 P3b — report topology: card promotion (S10 path)", () => {
  // Clause 1 — Order (S10 path). arch-report-derivation-architecture / Δ6 P3
  // report-experience topology. On the S10 path, "Category scores" and
  // "Prioritised fixes" must render BEFORE the brief/observed-tape sections and
  // before Component breakdown / Strengths / Technique commentary / Timestamped
  // notes. (Pre-implementation these sit mid-sequence — after Observed tape — so
  // this fails against the current order.)
  //
  // S11-UX-05 / Δ6 — "Next action plan" was relocated OUT of the grid to a
  // standalone full-width block beneath the Director's-perspective block, so it now
  // precedes the promoted grid cards rather than following them (asserted below).
  it("renders Category scores and Prioritised fixes at the TOP of the grid", () => {
    const html = renderV2(strongCompleteS10Report());

    const categoryIdx = html.indexOf("Category scores");
    const prioritisedIdx = html.indexOf("Prioritised fixes");
    expect(categoryIdx).toBeGreaterThanOrEqual(0);
    expect(prioritisedIdx).toBeGreaterThanOrEqual(0);

    // Both promoted cards precede every other grid section present on this fixture.
    const laterSections = [
      "Observed tape",
      "Brief achievement",
      "Component breakdown",
      "Strengths",
      "Technique commentary",
      "Timestamped and time-banded notes",
    ];
    for (const heading of laterSections) {
      const headingIdx = html.indexOf(heading);
      expect(headingIdx, `${heading} should appear in the S10 render`).toBeGreaterThanOrEqual(0);
      expect(categoryIdx, `"Category scores" should precede "${heading}"`).toBeLessThan(headingIdx);
      expect(prioritisedIdx, `"Prioritised fixes" should precede "${heading}"`).toBeLessThan(
        headingIdx,
      );
    }

    // S11-UX-05 / Δ6 — the relocated "Next action plan" block now precedes the
    // promoted grid cards (it sits beneath Director's perspective, above the grid).
    const nextActionIdx = html.indexOf("Next action plan");
    expect(nextActionIdx).toBeGreaterThanOrEqual(0);
    expect(nextActionIdx).toBeLessThan(categoryIdx);

    // Promoted order: Category scores first, then Prioritised fixes.
    expect(categoryIdx).toBeLessThan(prioritisedIdx);

    // The promoted cards sit beneath the score/verdict headline block, not above it.
    const verdictIdx = html.indexOf("Overall readiness");
    expect(verdictIdx).toBeGreaterThanOrEqual(0);
    expect(categoryIdx).toBeGreaterThan(verdictIdx);

    // Each promoted card is rendered exactly once (computed once, rendered once).
    expect(html.split("Category scores").length - 1).toBe(1);
    expect(html.split("Prioritised fixes").length - 1).toBe(1);
  });
});

describe("Δ6 P3b — report topology: per-category rationale (S10 path)", () => {
  // Clause 2 — a category whose canonical row carries populated rationale fields
  // renders them (multi-line, presence-gated) WITHIN the Category-scores card.
  it("renders the fuller per-category rationale within the Category-scores card", () => {
    const text = routeText(renderV2(strongCompleteS10Report()));

    // The strong-complete fixture's acting row carries all four fields.
    expect(text).toContain("Works: Scene partner focus and beat structure read clearly.");
    expect(text).toContain(
      "Score basis: Side 1 is present with clear objective and playable stakes.",
    );
    expect(text).toContain(
      "Why not full score: Keep the final turn precise rather than adding extra emphasis.",
    );
    expect(text).toContain("Close the gap: Sharpen the last beat only if retaking for polish.");
  });

  // Clause 2 (cont.) — a row whose four rationale fields are all empty renders the
  // score bar only (no rationale lines, no doubled single-note line). Empty/
  // whitespace fields are omitted (not-assessable discipline).
  it("renders the score bar only when a row has no rationale fields", () => {
    const report = strongCompleteS10Report();
    const view = report.s10_view_model as AnyRec;
    const rows = view.canonical_category_scores as AnyRec[];
    // Blank out every rationale field on the acting row; keep the score so the row renders.
    const actingRow = rows.find((r) => r.category_id === "acting") as AnyRec;
    actingRow.what_works = "";
    actingRow.score_basis = "   ";
    actingRow.why_not_full_score = "";
    actingRow.close_gap = "  ";

    const text = routeText(renderV2(report));

    // No rationale text from the now-empty acting row appears.
    expect(text).not.toContain("Scene partner focus and beat structure read clearly.");
    expect(text).not.toContain("Side 1 is present with clear objective and playable stakes.");
    // Sibling rows (e.g. vocal) keep their rationale, proving the card still renders.
    expect(text).toContain("Works: The lyric shape and final phrase are clear.");
    // The acting label and score still render (the score bar row survives).
    expect(text).toContain("91");
  });

  // Clause 2 (cont.) — the S10 path must NOT also render the single legacy
  // categoryNotes line (no double-show); the enriched fields supersede it.
  it("does not double-render the single category_notes line on the S10 path", () => {
    const html = renderV2(strongCompleteS10Report());
    // categoryNotes for S10 derives note = score_basis ?? why_not_full_score ?? close_gap.
    // For the acting row that note text is the score_basis string, which now appears
    // ONLY behind the "Score basis:" label — never as a standalone unlabelled line.
    const labelled = html.indexOf(
      "Score basis:</span> Side 1 is present with clear objective and playable stakes.",
    );
    // The same sentence must not appear a second time as a bare categoryNotes paragraph.
    const occurrences =
      html.split("Side 1 is present with clear objective and playable stakes.").length - 1;
    expect(occurrences).toBe(1);
    expect(labelled).toBeGreaterThanOrEqual(0);
  });
});

describe("Δ6 P3b — report topology: branch isolation (legacy/limited untouched)", () => {
  // Clause 3 — a non-S10 (isS10 === false) report rendered through Template 3 keeps
  // its existing section order: Category scores / Prioritised fixes are NOT promoted
  // to the top; they stay AFTER the earlier sections, exactly as today. This proves
  // the reorder is scoped to the S10 path only.
  it("does not promote the cards on the legacy-data path", () => {
    const html = renderV2(legacyDataReport());

    const categoryIdx = html.indexOf("Category scores");
    const prioritisedIdx = html.indexOf("Prioritised fixes");
    const componentIdx = html.indexOf("Component breakdown");
    expect(categoryIdx).toBeGreaterThanOrEqual(0);
    expect(prioritisedIdx).toBeGreaterThanOrEqual(0);
    expect(componentIdx).toBeGreaterThanOrEqual(0);

    // Legacy order is unchanged: Prioritised fixes precede Category scores, which
    // precede Component breakdown (the mid-sequence order from the source).
    expect(prioritisedIdx).toBeLessThan(categoryIdx);
    expect(categoryIdx).toBeLessThan(componentIdx);

    // Each card still appears exactly once (not duplicated at the top).
    expect(html.split("Category scores").length - 1).toBe(1);
    expect(html.split("Prioritised fixes").length - 1).toBe(1);
  });

  // Clause 3 (cont.) — the legacy per-category note still renders via category_notes,
  // byte-identical (the enrichment is S10-only).
  it("keeps the legacy per-category note rendering via category_notes", () => {
    const text = routeText(renderV2(legacyDataReport()));

    expect(text).toContain("LEGACY_ACTING_NOTE single-line rationale.");
    expect(text).toContain("LEGACY_AUDIO_NOTE single-line rationale.");
    expect(text).toContain("LEGACY_TECHNICAL_NOTE single-line rationale.");
    // The enriched-rationale labels must NOT appear on the legacy path.
    expect(text).not.toContain("Score basis:");
    expect(text).not.toContain("Why not full score:");
    expect(text).not.toContain("Close the gap:");
  });

  // Clause 3 (cont.) — the legacy Prioritised-fixes content still renders from
  // report.priority_fixes, unchanged.
  it("keeps the legacy Prioritised-fixes content rendering from priority_fixes", () => {
    const text = routeText(renderV2(legacyDataReport()));

    expect(text).toContain("Tighten the final beat of the scene.");
    expect(text).toContain("LEGACY_FIX_RATIONALE keeps the read crisp.");
  });
});
