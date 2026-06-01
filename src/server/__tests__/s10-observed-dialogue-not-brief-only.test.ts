import { describe, expect, it } from "vitest";
import {
  normaliseS10ComponentVerifications,
  normaliseS10ObservedTapeSequence,
} from "@/server/evidence-pass.server";

// Operator-confirmed fixture from the live "DON'T FORGET" Young Tam take
// (audition 518463ae-…). The 4:06 self-tape meets the brief: it contains Side 1
// performed verbatim plus a song. Step 1 observed the acting scene from media
// (observed_from_media + observed_audio_video) but described it as "Dialogue
// matches the requested Side 1 text from '…' to '…'". A prose keyword heuristic
// (summaryLooksBriefOnly) misread that as a brief-only restatement and forced
// the scene to uncertain — which suppressed the score, invented a "missing
// Side 1" fix-first, and contradicted the report's own "meets this level"
// section.
//
// Fix: trust the model's two explicit structured signals (observed_from_media
// AND evidence_basis === "observed_audio_video") across ALL disciplines instead
// of second-guessing them from prose. Genuine non-observation rows stay
// downgraded structurally via evidence_basis ("brief_text_only" etc.).

function observedRow(evidenceSummary: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "section",
    label: "Component",
    component_type: "acting_scene",
    linked_requirement_ids: ["req"],
    start_time: "00:12",
    end_time: "02:40",
    present_status: "present",
    completion_status: "complete",
    evidence_summary: evidenceSummary,
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    confidence: "high",
    assessability_notes: "",
    ...overrides,
  };
}

const SIDE_1_SUMMARY =
  "Dialogue matches the requested Side 1 text from 'Did you see...' to '...quick swig.'";

// Natural per-discipline phrasings the evidence pass produces. Before the
// generalised fix, every one of these (except those that happened to contain a
// whitelisted word) was wrongly downgraded to uncertain.
const DISCIPLINE_SUMMARIES: Array<[string, string]> = [
  ["acting/dialogue", SIDE_1_SUMMARY],
  ["acting (acts out)", "The performer acts out the requested scene with clear intention."],
  ["generic material", "Performs the required material in full."],
  ["dance choreography", "Performs the requested choreography from the brief."],
  ["dance routine", "Executes the required dance routine across the floor."],
  ["movement", "Moves through the required physical sequence."],
  ["screen/intention", "Conveys the required emotional beat asked for in the brief."],
  ["commercial copy", "Delivers the requested copy to camera."],
  ["MT song", "Sings the requested contemporary song in full."],
];

describe("S10 trusts structured observation signals across disciplines", () => {
  it.each(DISCIPLINE_SUMMARIES)(
    "keeps a media-observed component present/complete: %s",
    (_label, summary) => {
      const [row] = normaliseS10ObservedTapeSequence([observedRow(summary)]);
      expect(row).toBeDefined();
      expect(row.present_status).toBe("present");
      expect(row.completion_status).toBe("complete");
      expect(row.assessability_notes).not.toMatch(/S10 downgraded/i);
    },
  );

  it("keeps the matching component verification achieved, not uncertain", () => {
    const [verification] = normaliseS10ComponentVerifications([
      {
        requirement_id: "req_side_1",
        requirement_summary: "Perform Side 1, pages 85-87",
        observed_status: "present",
        completion_status: "complete",
        evidence_summary: SIDE_1_SUMMARY,
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        confidence: "high",
        assessability_notes: "",
      },
    ]);

    expect(verification).toBeDefined();
    expect(verification.observed_status).toBe("present");
    expect(verification.completion_status).toBe("complete");
  });

  // Structured downgrade protection is preserved: the model declares
  // non-observation rows through evidence_basis / observed_from_media, not prose.
  it("still downgrades a row the model marks brief_text_only", () => {
    const [row] = normaliseS10ObservedTapeSequence([
      observedRow("Side 1 is required by the supplied brief.", {
        evidence_basis: "brief_text_only",
      }),
    ]);
    expect(row.present_status).toBe("uncertain");
    expect(row.completion_status).toBe("uncertain");
  });

  it("still downgrades a row not observed from media", () => {
    const [row] = normaliseS10ObservedTapeSequence([
      observedRow("Performs the required material in full.", {
        observed_from_media: false,
      }),
    ]);
    expect(row.present_status).toBe("uncertain");
    expect(row.completion_status).toBe("uncertain");
  });

  it("still downgrades a row with deterministic_metadata basis claiming presence", () => {
    const [row] = normaliseS10ObservedTapeSequence([
      observedRow("Filename metadata references Side 1.", {
        evidence_basis: "deterministic_metadata",
      }),
    ]);
    expect(row.present_status).toBe("uncertain");
    expect(row.completion_status).toBe("uncertain");
  });
});
