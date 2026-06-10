// Δ6 P2 — MD-voice module (`s10_practitioner_voice`) conformance.
//
// A new performer-visible module — "A practitioner's perspective" — carrying a
// short, developmental, ONE-subjective-view note rendered BELOW the score/verdict
// block. It is evidence-gated, FORBIDDEN from any submission/readiness verdict
// claim (so it can't contradict the canonical verdict), bounded to 2–3 sentences,
// suppressible (global kill-switch + per-report gating), and structurally unable to
// move the score (downstream prose; never an input to any score/verdict compute).
//
// These tests assert each clause; the verdict-guard + truncation tests FAIL against
// current code (the enforce function does not yet exist).

import { describe, expect, it, vi } from "vitest";
import { enforcePractitionerVoiceModule } from "@/server/report-polish.server";
import { buildS10PerformerReportViewModel } from "@/server/s10-report-view-model.server";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";
import { buildS10CanaryAReportInput } from "@/test-fixtures/s10-canary-a-incomplete-package";

type AnyRec = Record<string, unknown>;

function strongReportWithVoice(note: unknown): AnyRec {
  const report = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
  report.s10_practitioner_voice = { note };
  return report;
}

function viewWithContext(report: AnyRec, mdVoiceEnabled?: boolean) {
  const context = {
    ...buildS10StrongCompleteProfessionalViewContext(),
    ...(mdVoiceEnabled === undefined ? {} : { mdVoiceEnabled }),
  };
  return buildS10PerformerReportViewModel({ report, context: context as never });
}

describe("Δ6 P2 — enforcePractitionerVoiceModule", () => {
  // Clause (b)+(c): evidence-gated (empty → null) and bounded (truncate to 3 sentences).
  it("evidence-gated: empty/whitespace note enforces to null", () => {
    for (const empty of ["", "   ", "\n\t "]) {
      const report = strongReportWithVoice(empty);
      const result = enforcePractitionerVoiceModule(report);
      expect(report.s10_practitioner_voice).toBeNull();
      expect(result.suppressed).toBe(true);
    }
  });

  it("evidence-gated: missing module is left null without throwing", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
    delete report.s10_practitioner_voice;
    const result = enforcePractitionerVoiceModule(report);
    expect(report.s10_practitioner_voice ?? null).toBeNull();
    expect(result.suppressed).toBe(true);
  });

  it("bounded: a 5-sentence note is truncated to exactly 3 sentences", () => {
    const note =
      "One thought about the tonal arc. A second observation about the breath. " +
      "A third note on the eyeline choices. A fourth idea worth exploring. " +
      "A fifth reflection too far.";
    const report = strongReportWithVoice(note);
    const result = enforcePractitionerVoiceModule(report);
    const out = (report.s10_practitioner_voice as { note: string }).note;
    // Exactly three sentence-terminators remain.
    const sentences = out.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    expect(sentences).toHaveLength(3);
    expect(out).toContain("eyeline");
    expect(out).not.toContain("fourth");
    expect(out).not.toContain("fifth");
    expect(result.truncated).toBe(true);
  });

  it("accepts a bare-string note (coerced, not just {note})", () => {
    const report = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
    report.s10_practitioner_voice = "A single developmental thought about the closing beat.";
    enforcePractitionerVoiceModule(report);
    expect((report.s10_practitioner_voice as { note: string }).note).toContain("closing beat");
  });

  // Clause (d): SYNC-AWARE divergence guard (S11-CAL-02). The Director's view summarising
  // or echoing the canonical verdict IN SYNC is desired and KEPT; only a verdict read that
  // DIVERGES from the canonical verdict (or cannot be proven in-sync) is nulled + flagged.
  const divergenceMetric = "md_voice_suppressed_verdict_divergence";

  function metricEmitted(logSpy: ReturnType<typeof vi.spyOn>): boolean {
    return logSpy.mock.calls.some((call: unknown[]) => String(call[0]).includes(divergenceMetric));
  }

  // IN-SYNC ALLOWED — a ready/strong report whose voice echoes "ready to submit" agrees with
  // the canonical positive verdict, so the note is RETAINED and NO divergence metric fires.
  // This case FAILS against the old blanket phrase-blocklist (which nulled on any verdict phrase).
  it("in-sync positive: 'ready to submit' on a ready report is KEPT, no divergence metric", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = strongReportWithVoice(
        "This is ready to submit on the evidence here. The instincts are alive and specific.",
      );
      const result = enforcePractitionerVoiceModule(report, "take-md-sync-pos");
      expect(report.s10_practitioner_voice).not.toBeNull();
      expect((report.s10_practitioner_voice as { note: string }).note).toContain("ready to submit");
      expect(result.suppressed).toBe(false);
      expect(metricEmitted(logSpy)).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  // IN-SYNC NEGATIVE — a not-ready/blocked report whose voice echoes "not ready" agrees with
  // the canonical negative verdict, so the note is RETAINED and NO divergence metric fires.
  it("in-sync negative: 'not ready' on a blocked report is KEPT, no divergence metric", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = buildS10CanaryAReportInput() as AnyRec;
      report.s10_practitioner_voice = {
        note: "Side 1 is missing, so this is not ready yet. Record the scene before another take.",
      };
      const result = enforcePractitionerVoiceModule(report, "take-md-sync-neg");
      expect(report.s10_practitioner_voice).not.toBeNull();
      expect((report.s10_practitioner_voice as { note: string }).note).toContain("not ready");
      expect(result.suppressed).toBe(false);
      expect(metricEmitted(logSpy)).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  // DIVERGENT (i) — positive voice on a negative canonical verdict → nulled + metric.
  it("divergent: 'ready to submit' on a blocked report is nulled and flags divergence", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = buildS10CanaryAReportInput() as AnyRec;
      report.s10_practitioner_voice = {
        note: "Honestly this is ready to submit to me. The instincts are alive.",
      };
      const result = enforcePractitionerVoiceModule(report, "take-md-div-1");
      expect(report.s10_practitioner_voice).toBeNull();
      expect(result.suppressed).toBe(true);
      expect(metricEmitted(logSpy)).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  // DIVERGENT (ii) — negative voice on a positive canonical verdict → nulled + metric.
  it("divergent: 'not ready' on a ready report is nulled and flags divergence", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = strongReportWithVoice(
        "Honestly this is not ready yet in my view. The arc needs another pass.",
      );
      const result = enforcePractitionerVoiceModule(report, "take-md-div-2");
      expect(report.s10_practitioner_voice).toBeNull();
      expect(result.suppressed).toBe(true);
      expect(metricEmitted(logSpy)).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  // INCOHERENT — a note asserting BOTH polarities can never be in sync → nulled + metric.
  it("incoherent: a note with both 'ready to submit' and 'not ready' is nulled and flags divergence", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = strongReportWithVoice(
        "Part of me says ready to submit, part of me says not ready. It is a genuinely close call.",
      );
      const result = enforcePractitionerVoiceModule(report, "take-md-incoherent");
      expect(report.s10_practitioner_voice).toBeNull();
      expect(result.suppressed).toBe(true);
      expect(metricEmitted(logSpy)).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  // INDETERMINATE canonical — verdict language can't be proven in-sync → safe default null + metric.
  it("indeterminate canonical: a verdict note with no canonical verdict is nulled and flags divergence", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const report = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
      // Strip the canonical verdict so polarity is indeterminate (no label, not blocked, no reasons).
      delete report.submission_verdict;
      delete report.verdict_final;
      delete report.block_reasons;
      report.s10_practitioner_voice = {
        note: "This is ready to submit from where the evidence sits. The choices are specific.",
      };
      const result = enforcePractitionerVoiceModule(report, "take-md-indeterminate");
      expect(report.s10_practitioner_voice).toBeNull();
      expect(result.suppressed).toBe(true);
      expect(metricEmitted(logSpy)).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("non-verdict prose: developmental prose with no verdict language is preserved", () => {
    const note =
      "The transition into the song carries real intention. I'd keep leaning into those quiet beats.";
    const report = strongReportWithVoice(note);
    const result = enforcePractitionerVoiceModule(report, "take-md-3");
    expect(report.s10_practitioner_voice).not.toBeNull();
    expect((report.s10_practitioner_voice as { note: string }).note).toContain("intention");
    expect(result.suppressed).toBe(false);
  });

  // Clause (e): never touches any score/verdict field.
  it("never mutates score/verdict fields", () => {
    const report = strongReportWithVoice(
      "A clean developmental note about the closing image and the breath.",
    );
    const beforeScore = report.overall_score;
    const beforeFinal = report.overall_score_final;
    const beforeReadiness = JSON.stringify(report.readiness_score_judgement);
    enforcePractitionerVoiceModule(report, "take-md-4");
    expect(report.overall_score).toBe(beforeScore);
    expect(report.overall_score_final).toBe(beforeFinal);
    expect(JSON.stringify(report.readiness_score_judgement)).toBe(beforeReadiness);
  });
});

describe("Δ6 P2 — view-model gating", () => {
  // Clause 1: module present + flag on → view-model exposes practitioner_voice.
  it("present: exposes practitioner_voice when the module is a non-empty note and flag is on", () => {
    const report = strongReportWithVoice(
      "The closing image lands with real specificity. There's room to deepen the second beat.",
    );
    enforcePractitionerVoiceModule(report);
    const view = viewWithContext(report, true);
    expect(view).not.toBeNull();
    expect((view as AnyRec).practitioner_voice).toEqual({
      note: expect.stringContaining("closing image"),
    });
    const sourceMap = (view as AnyRec).section_source_map as AnyRec;
    expect((sourceMap.practitioner_voice as AnyRec).source).toBe("s10_authoritative_module");
  });

  // Clause 2: suppressible via the kill-switch (mdVoiceEnabled: false) → null.
  it("suppressible: mdVoiceEnabled false → practitioner_voice is null", () => {
    const report = strongReportWithVoice("A developmental note that should be suppressed.");
    enforcePractitionerVoiceModule(report);
    const view = viewWithContext(report, false);
    expect((view as AnyRec).practitioner_voice).toBeNull();
  });

  // Clause 3: evidence-gated at the view-model too (enforced-null module → absent).
  it("evidence-gated: enforced-null module → practitioner_voice null even with flag on", () => {
    const report = strongReportWithVoice("   ");
    enforcePractitionerVoiceModule(report);
    const view = viewWithContext(report, true);
    expect((view as AnyRec).practitioner_voice).toBeNull();
  });

  // Default (no flag in context) treats the module as enabled (reader defaults true).
  it("defaults on: undefined mdVoiceEnabled still exposes a present module", () => {
    const report = strongReportWithVoice("A short, useful developmental note.");
    enforcePractitionerVoiceModule(report);
    const view = viewWithContext(report);
    expect((view as AnyRec).practitioner_voice).toEqual({
      note: expect.stringContaining("developmental"),
    });
  });
});

describe("Δ6 P2 — cannot move the number", () => {
  // ADR-0008 / Δ6 — "subjective practitioner voice must not move the number; bounded,
  // suppressible, rendered below the score". Build the view model WITH vs WITHOUT
  // s10_practitioner_voice and assert canonical_overall_score and canonical_verdict
  // are byte-identical across the two.
  it("canonical_overall_score and canonical_verdict are identical with vs without the module", () => {
    const withoutReport = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
    const withReport = strongReportWithVoice(
      "A practitioner's developmental reflection on the second beat. Worth exploring more breath there.",
    );
    enforcePractitionerVoiceModule(withReport);

    const withoutView = viewWithContext(withoutReport, true) as AnyRec;
    const withView = viewWithContext(withReport, true) as AnyRec;

    expect(withView.canonical_overall_score).toEqual(withoutView.canonical_overall_score);
    expect(JSON.stringify(withView.canonical_verdict)).toBe(
      JSON.stringify(withoutView.canonical_verdict),
    );
    // And the only difference is the new prose field.
    expect(withView.practitioner_voice).not.toBeNull();
    expect(withoutView.practitioner_voice).toBeNull();
  });
});
