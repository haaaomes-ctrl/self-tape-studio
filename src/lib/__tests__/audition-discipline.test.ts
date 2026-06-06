// ARCH-Δ2: user-selected audition discipline drives the analysis.
//
// Pins: the 5-value discipline enum and its UK labels; the total mapping to
// the analysis AuditionType (never "unknown" — the whole point); the EXACT
// injected prompt lines (operator-reviewed copy); the de-hardcoded Step 1
// normalisation; the load-bearing wiring order (upload gate before credit
// reservation; analysis guard before reservation; authoritative stamp before
// weighting); and that the five disciplines produce distinct weight
// profiles, i.e. the dead code is alive.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDITION_DISCIPLINES,
  AUDITION_DISCIPLINE_LABELS,
  buildAuditionDisciplinePromptLine,
  disciplineToAuditionType,
  isAuditionDiscipline,
  recomputeOverall,
  weightsForType,
  type AuditionDiscipline,
} from "@/lib/audition-rules";
import { normaliseCompactStep1EvidenceForEvidencePass } from "@/server/evidence-pass.server";
import { describeUploadError } from "@/lib/upload-errors";

describe("discipline enum + labels", () => {
  it("has exactly the five product disciplines in picker order", () => {
    expect(AUDITION_DISCIPLINES).toEqual([
      "acting",
      "musical_theatre",
      "singing_voice",
      "dance",
      "commercial",
    ]);
  });

  it("pins the UK-English labels (Musical Theatre is ONE composite discipline)", () => {
    expect(AUDITION_DISCIPLINE_LABELS).toEqual({
      acting: "Acting",
      musical_theatre: "Musical Theatre",
      singing_voice: "Singing / Voice",
      dance: "Dance",
      commercial: "Commercial",
    });
  });

  it("isAuditionDiscipline accepts only the five values", () => {
    for (const value of AUDITION_DISCIPLINES) {
      expect(isAuditionDiscipline(value)).toBe(true);
    }
    expect(isAuditionDiscipline("unknown")).toBe(false);
    expect(isAuditionDiscipline("hybrid")).toBe(false);
    expect(isAuditionDiscipline("voice")).toBe(false);
    expect(isAuditionDiscipline(null)).toBe(false);
    expect(isAuditionDiscipline("")).toBe(false);
  });
});

describe("disciplineToAuditionType (total, never unknown)", () => {
  it("maps every discipline to the weighted analysis type", () => {
    expect(disciplineToAuditionType("acting")).toBe("acting_scene");
    expect(disciplineToAuditionType("musical_theatre")).toBe("musical_theatre");
    // singing_voice maps to "song" (NOT the label-only "voice" value):
    // "voice" has no weightsForType entry, so "song" is required for the
    // vocal-forward weights to activate.
    expect(disciplineToAuditionType("singing_voice")).toBe("song");
    expect(disciplineToAuditionType("dance")).toBe("dance");
    expect(disciplineToAuditionType("commercial")).toBe("commercial");
  });

  it("never produces unknown/hybrid/monologue", () => {
    for (const discipline of AUDITION_DISCIPLINES) {
      expect(["unknown", "hybrid", "monologue"]).not.toContain(
        disciplineToAuditionType(discipline),
      );
    }
  });

  it("activates a DIFFERENT weight profile than the historic unknown default for every discipline except none", () => {
    const unknownWeights = weightsForType("unknown");
    const distinctFromUnknown = AUDITION_DISCIPLINES.filter(
      (discipline) =>
        JSON.stringify(weightsForType(disciplineToAuditionType(discipline))) !==
        JSON.stringify(unknownWeights),
    );
    // Every discipline's weights must differ from the generic default —
    // otherwise the selection changes nothing.
    expect(distinctFromUnknown).toEqual([...AUDITION_DISCIPLINES]);
  });

  it("same category scores re-weight differently across disciplines (the dead code is alive)", () => {
    const scores = { acting: 90, vocal: 50, audio: 70, technical: 70, brief_adherence: 70 };
    const overallByDiscipline = new Map<AuditionDiscipline, number | null>();
    for (const discipline of AUDITION_DISCIPLINES) {
      const weights = weightsForType(disciplineToAuditionType(discipline));
      overallByDiscipline.set(discipline, recomputeOverall(scores, weights).overall);
    }
    // Acting-forward vs vocal-forward must diverge on an acting-strong tape.
    expect(overallByDiscipline.get("acting")).not.toBe(overallByDiscipline.get("singing_voice"));
    expect(overallByDiscipline.get("commercial")).not.toBe(overallByDiscipline.get("dance"));
  });
});

describe("injected prompt lines (operator-reviewed copy — exact)", () => {
  it("pins the Musical Theatre composite line", () => {
    expect(buildAuditionDisciplinePromptLine("musical_theatre")).toBe(
      "AUDITION DISCIPLINE: Musical Theatre (musical_theatre) — single composite discipline: assess singing, acting and their integration as one package.",
    );
  });

  it("pins the standard line for the other disciplines", () => {
    expect(buildAuditionDisciplinePromptLine("dance")).toBe(
      "AUDITION DISCIPLINE: Dance (dance) — selected by the performer; assess against this discipline's demands.",
    );
    expect(buildAuditionDisciplinePromptLine("acting")).toBe(
      "AUDITION DISCIPLINE: Acting (acting) — selected by the performer; assess against this discipline's demands.",
    );
  });
});

describe("Step 1 de-hardcode", () => {
  const compact = {
    schema_version: "1",
    observations: [],
  } as never;

  it("stamps the provided auditionType onto the evidence", () => {
    expect(
      normaliseCompactStep1EvidenceForEvidencePass(compact, "musical_theatre").audition_type,
    ).toBe("musical_theatre");
    expect(normaliseCompactStep1EvidenceForEvidencePass(compact, "song").audition_type).toBe(
      "song",
    );
  });

  it("falls back to the historic unknown ONLY when no type is provided (legacy callers)", () => {
    expect(normaliseCompactStep1EvidenceForEvidencePass(compact).audition_type).toBe("unknown");
  });
});

describe("upload error mapping", () => {
  it("maps DISCIPLINE_REQUIRED to a dedicated kind with the clean message", () => {
    const info = describeUploadError(
      new Error("DISCIPLINE_REQUIRED: Choose the discipline for this audition before uploading."),
    );
    expect(info.kind).toBe("discipline_required");
    expect(info.message).toBe("Choose the discipline for this audition before uploading.");
  });
});

describe("wiring order (source-text assertions)", () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

  it("upload gate: DISCIPLINE_REQUIRED is checked BEFORE the credit reservation", () => {
    const source = read("../../server-fns/mux-upload.impl.server.ts");
    const gate = source.indexOf("DISCIPLINE_REQUIRED:");
    const reservation = source.indexOf("reserveReportCreditForTake(");
    expect(gate).toBeGreaterThan(-1);
    expect(reservation).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(reservation);
  });

  it("analysis entry: fetches discipline, guards before the run reservation, stamps before weighting", () => {
    const source = read("../../server/process-take.server.ts");
    expect(source).toContain(
      '.select("id, brief, brief_source, mode, title, audition_level, discipline, extracted_brief")',
    );
    const guard = source.indexOf("Discipline missing for this audition.");
    const runReservation = source.indexOf('trigger: "run_process_take"');
    expect(guard).toBeGreaterThan(-1);
    expect(runReservation).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(runReservation);
    // Authoritative stamp on BOTH paths before the weighted recompute.
    expect(source).toContain("report.audition_type = resolvedAuditionType;");
    // Step 1 receives the resolved type; Step 2 receives the context line.
    expect(source).toContain("auditionType: resolvedAuditionType,");
    expect(source.match(/disciplineBlock,/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("never silently defaults: the discipline guard fails the run with credit refund", () => {
    const source = read("../../server/process-take.server.ts");
    const guardIndex = source.indexOf("Discipline missing for this audition.");
    expect(guardIndex).toBeGreaterThan(-1);
    const around = source.slice(guardIndex - 400, guardIndex + 400);
    expect(around).toContain("markTerminalFailure");
    expect(around).toContain("Select a discipline on the audition and retry the analysis.");
  });
});
