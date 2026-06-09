// Δ6 P2 — MD-voice render conformance.
//
// "A practitioner's perspective" renders BELOW the score/verdict block and only
// when the persisted s10_view_model.practitioner_voice is present. When the flag is
// off (per-report gating) the section is absent. Carries tc-report-print-section so
// it appears in the PDF/print flow.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { V2ReportView } from "../V2ReportView";
import { V2ReportViewLegacy } from "../V2ReportViewLegacy";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { enforcePractitionerVoiceModule } from "@/server/report-polish.server";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

type AnyRec = Record<string, unknown>;

const VOICE_NOTE =
  "There's a real specificity in the closing image that I'd protect. The breath before the song is where I'd keep exploring.";

// renderToStaticMarkup HTML-escapes the apostrophe, so match on the unambiguous
// apostrophe-free fragments of the heading/sub-note rather than the literal copy.
const HEADING = "perspective";
const HEADING_LEAD = "A practitioner";
const SUBNOTE = "One subjective view";

function buildReport(opts: { withVoice: boolean; mdVoiceEnabled?: boolean }): AnyRec {
  const input = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
  if (opts.withVoice) {
    input.s10_practitioner_voice = { note: VOICE_NOTE };
    enforcePractitionerVoiceModule(input);
  }
  const context = {
    ...buildS10StrongCompleteProfessionalViewContext(),
    ...(opts.mdVoiceEnabled === undefined ? {} : { mdVoiceEnabled: opts.mdVoiceEnabled }),
  };
  return buildV2Report({
    legacyReport: input,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: context as never,
  }) as unknown as AnyRec;
}

function renderV2(report: AnyRec) {
  return renderToStaticMarkup(
    <V2ReportView report={report} takeNumber={1} auditionType="musical_theatre" />,
  );
}

function renderLegacy(report: AnyRec) {
  return renderToStaticMarkup(
    <V2ReportViewLegacy report={report} takeNumber={1} auditionType="musical_theatre" />,
  );
}

describe("Δ6 P2 — practitioner-voice render (V2ReportView)", () => {
  // Clause 1: renders below the score/verdict block.
  it("renders the section AFTER the score/verdict block when present", () => {
    const html = renderV2(buildReport({ withVoice: true, mdVoiceEnabled: true }));
    expect(html).toContain(HEADING);
    expect(html).toContain(HEADING_LEAD);
    expect(html).toContain(SUBNOTE);
    expect(html).toContain("closing image");
    // Heading appears after the verdict hero (Overall readiness ring label).
    const verdictIdx = html.indexOf("Overall readiness");
    const voiceIdx = html.indexOf(HEADING);
    expect(verdictIdx).toBeGreaterThanOrEqual(0);
    expect(voiceIdx).toBeGreaterThan(verdictIdx);
  });

  it("carries the print-section class so it appears in the PDF/print flow", () => {
    const html = renderV2(buildReport({ withVoice: true, mdVoiceEnabled: true }));
    const voiceIdx = html.indexOf(HEADING);
    // The nearest preceding tc-report-print-section wrapper exists before the heading.
    const printIdx = html.lastIndexOf("tc-report-print-section", voiceIdx);
    expect(printIdx).toBeGreaterThanOrEqual(0);
  });

  // Clause 2: suppressible — flag off → no section.
  it("renders NOTHING when the per-report gate is off", () => {
    const html = renderV2(buildReport({ withVoice: true, mdVoiceEnabled: false }));
    expect(html).not.toContain(HEADING);
  });

  // Clause 3: absent when the module is missing.
  it("renders NOTHING when the module is absent", () => {
    const html = renderV2(buildReport({ withVoice: false, mdVoiceEnabled: true }));
    expect(html).not.toContain(HEADING);
  });
});

describe("Δ6 P2 — practitioner-voice render (V2ReportViewLegacy)", () => {
  it("renders the section below the score/verdict block when present", () => {
    const html = renderLegacy(buildReport({ withVoice: true, mdVoiceEnabled: true }));
    expect(html).toContain(HEADING);
    expect(html).toContain(HEADING_LEAD);
    expect(html).toContain(SUBNOTE);
    const verdictIdx = html.indexOf("Overall readiness");
    const voiceIdx = html.indexOf(HEADING);
    expect(verdictIdx).toBeGreaterThanOrEqual(0);
    expect(voiceIdx).toBeGreaterThan(verdictIdx);
  });

  it("renders NOTHING when the per-report gate is off", () => {
    const html = renderLegacy(buildReport({ withVoice: true, mdVoiceEnabled: false }));
    expect(html).not.toContain(HEADING);
  });
});
