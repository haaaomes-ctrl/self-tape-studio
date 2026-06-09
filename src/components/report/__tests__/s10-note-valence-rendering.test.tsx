// Δ6 P5 — AI-authored per-note valence + module-link rendering.
//
// valence ("strength" | "neutral" | "improvement") and linked_category (one of the
// six Step-1 categories, or null) are DISPLAY-ONLY signals on each timestamped note.
// The S10 timestamped block colours each note by valence (success / warning / muted
// tokens) and carries a NON-colour text cue ("Strength" / "Work on" / "Note") plus an
// optional category tag — none of which may move the score or appear on the legacy path.

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

function render(report: Record<string, unknown>, auditionType = "musical_theatre") {
  return renderToStaticMarkup(
    <V2ReportView report={report} takeNumber={1} auditionType={auditionType} />,
  );
}

// Strip every class attribute so a cue that survives ONLY via a colour class is
// removed, proving the textual signal stands on its own (colour-blind / screen-reader).
function textWithoutClasses(html: string) {
  return html
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function strongCompleteV2Report() {
  return buildV2Report({
    legacyReport: buildS10StrongCompleteProfessionalReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  }) as unknown as Record<string, unknown>;
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

describe("Δ6 P5 — valence colour + text cue rendering (S10 block)", () => {
  it("renders a strength note with the success token and a 'Strength' cue", () => {
    const report = strongCompleteV2Report();
    setTimestampedNotes(report, [
      {
        ...baseNote,
        id: "n-strength",
        title: "Clean opening focus",
        valence: "strength",
        linked_category: null,
      },
    ]);
    const html = render(report);
    expect(html).toContain("Timestamped and time-banded notes");
    // Colour token present...
    expect(html).toMatch(/border-success|text-success/);
    // ...and the textual cue survives even with all colour classes stripped.
    expect(textWithoutClasses(html)).toContain("Strength");
  });

  it("renders an improvement note with the warning token and a 'Work on' cue", () => {
    const report = strongCompleteV2Report();
    setTimestampedNotes(report, [
      {
        ...baseNote,
        id: "n-improvement",
        title: "Audio dips briefly",
        valence: "improvement",
        linked_category: null,
      },
    ]);
    const html = render(report);
    expect(html).toMatch(/border-warning|text-warning/);
    expect(textWithoutClasses(html)).toContain("Work on");
    // Developmental framing only — never "weakness".
    expect(html).not.toMatch(/weakness/i);
  });

  it("renders a neutral note with a muted 'Note' cue", () => {
    const report = strongCompleteV2Report();
    setTimestampedNotes(report, [
      {
        ...baseNote,
        id: "n-neutral",
        title: "A plain observation",
        valence: "neutral",
        linked_category: null,
      },
    ]);
    const html = render(report);
    expect(textWithoutClasses(html)).toContain("Note");
  });

  it("renders linked_category as a tag via getCategoryLabel and omits it when null", () => {
    // "Audio clarity" already appears once in the fixture (the category-scores row),
    // so count occurrences: a note tagged audio adds exactly one more; a null note
    // adds none. This is precise without isolating the timestamped section.
    const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

    const noCategory = strongCompleteV2Report();
    setTimestampedNotes(noCategory, [
      {
        ...baseNote,
        id: "n-nocat",
        title: "A plain observation",
        valence: "neutral",
        linked_category: null,
      },
    ]);
    const baselineCount = occurrences(textWithoutClasses(render(noCategory)), "Audio clarity");

    const withCategory = strongCompleteV2Report();
    setTimestampedNotes(withCategory, [
      {
        ...baseNote,
        id: "n-cat",
        title: "Clean audio capture",
        valence: "strength",
        linked_category: "audio", // musical_theatre → "Audio clarity"
      },
    ]);
    const taggedCount = occurrences(textWithoutClasses(render(withCategory)), "Audio clarity");

    // The note tag adds exactly one extra "Audio clarity"; null adds none.
    expect(taggedCount).toBe(baselineCount + 1);
  });
});

describe("Δ6 P5 — cannot move the number (display-only)", () => {
  // valence/linked_category are display-only: the canonical overall score and verdict
  // must be byte-identical WITH vs WITHOUT them on the timestamped notes.
  it("canonical_overall_score and canonical_verdict are identical with vs without valence/linked_category", () => {
    const withoutReport = strongCompleteV2Report();
    const withoutView = withoutReport.s10_view_model as AnyRec;
    const withoutCommentary = withoutView.timestamped_commentary as AnyRec;
    const plainNotes = (withoutCommentary.notes as AnyRec[]).map((n) => {
      const copy = { ...n };
      delete copy.valence;
      delete copy.linked_category;
      return copy;
    });
    withoutCommentary.notes = plainNotes;

    const withReport = strongCompleteV2Report();
    const withView = withReport.s10_view_model as AnyRec;
    const withCommentary = withView.timestamped_commentary as AnyRec;
    withCommentary.notes = (withCommentary.notes as AnyRec[]).map((n, i) => ({
      ...n,
      valence: i % 2 === 0 ? "strength" : "improvement",
      linked_category: "audio",
    }));

    expect(withView.canonical_overall_score).toEqual(withoutView.canonical_overall_score);
    expect(JSON.stringify(withView.canonical_verdict)).toBe(
      JSON.stringify(withoutView.canonical_verdict),
    );
  });
});

describe("Δ6 P5 — legacy timestamped block isolation", () => {
  // The legacy (!isS10) timestamped block must not gain valence colour/cue/tag.
  it("does not apply valence cues on the legacy timestamped-notes path", () => {
    // A legacy (non-S10) report: no s10_view_model, plain timestamped_notes only.
    const legacyReport: AnyRec = {
      overall_score: 70,
      verdict: "Review carefully",
      timestamped_notes: [
        { timestamp: "00:05", note: "A plain legacy note." },
        { timestamp: "00:20", note: "Another legacy note." },
      ],
    };
    const html = render(legacyReport);
    expect(html).toContain("Timestamped notes");
    expect(html).toContain("A plain legacy note.");
    // None of the Δ6 P5 cue text is present on the legacy path.
    expect(html).not.toContain("Work on");
    expect(html).not.toMatch(/border-success|border-warning/);
  });
});
