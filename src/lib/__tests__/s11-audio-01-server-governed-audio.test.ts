// S11-AUDIO-01 Step-2 — server-governed audio + removal of the brief-blind
// pre-upload checklist (Fork A).
//
// Proven root cause: a skipped >80 MB browser audio probe persisted
// signals.audio_peak=0 / audio_rms=0; process-take.server.ts:signalsBlock
// injected those zeros into the model userText, so the model parroted
// "completely silent (RMS 0, Peak 0)". The model genuinely hears file_url
// audio, so the fix is to STOP feeding browser perceptual numbers and let the
// model's hearing govern. These tests pin the CODE-level behaviour (the live
// re-run is the architect's post-merge check — see Fork A refinement 4).
//
// Clause coverage:
//  1. De-contamination — deterministicCompliance no longer emits
//     audio_low_signal for any audio_peak (the branch is gone).
//  2. signalsBlock clean — the serialised TECHNICAL SIGNALS block contains no
//     browser perceptual key/value (audio_peak/audio_rms/brightness) and no
//     checklist object, even when those linger on an old persisted take.
//  3. Deterministic DIMENSION-SOURCED orientation (LOAD-BEARING) — orientation
//     is derived from DISPLAY DIMENSIONS (width > height ⇒ landscape) and that
//     value drives the orientation_mismatch gate end-to-end. The gate is NOT
//     sourced from the prose regex or a browser perceptual signal. A guard test
//     pins the server wiring so a re-point back to either would fail.
//  4. No ChecklistView pre-upload — the upload routes no longer render the
//     pre-upload ChecklistView / brief-blind QC.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveOrientationFromDimensions,
  deterministicCompliance,
  type ExtractedBrief,
} from "@/lib/audition-rules";

function portraitBrief(): ExtractedBrief {
  return {
    audition_type: "acting_scene",
    orientation_required: "portrait",
    time_limit_seconds: 60,
    time_limit_source: "explicit",
  };
}

describe("S11-AUDIO-01 — clause 1: de-contamination (no audio_low_signal branch)", () => {
  // The pre-fix signature read input.signals.audio_peak and pushed
  // audio_low_signal for any value < 0.05. These call the OLD shape on
  // purpose: pre-fix the branch fires (assertion fails — fail-first witness);
  // post-fix the signals param is gone, so audio_peak is inert and no audio
  // flag can ever be produced. The legacy-shape cast goes through the function
  // type (no `any`) so the dead browser-signals path is exercised intentionally.
  type LegacyCompliance = (input: {
    extracted: ExtractedBrief | null;
    signals?: { orientation?: string; duration?: number; audio_peak?: number } | null;
  }) => Array<{ code: string }>;
  const callLegacyShape = (audioPeak: number) =>
    (deterministicCompliance as unknown as LegacyCompliance)({
      extracted: portraitBrief(),
      signals: { orientation: "portrait", duration: 30, audio_peak: audioPeak },
    });

  it("does NOT emit audio_low_signal for an audio_peak of 0 (the false-silent branch is gone)", () => {
    expect(callLegacyShape(0).some((f: { code: string }) => f.code === "audio_low_signal")).toBe(
      false,
    );
  });

  it("emits no audio flag even for a very low audio_peak (audio is the model's job now)", () => {
    expect(
      callLegacyShape(0.001).some((f: { code: string }) => f.code === "audio_low_signal"),
    ).toBe(false);
  });
});

// The deterministic orientation source. deriveOrientationFromDimensions is the
// SAME helper the server feeds into deterministicCompliance (over signals.width
// / signals.height), so this exercises the real gating path — not a value
// hand-fed straight into deterministicCompliance (which would be a tautology).
describe("S11-AUDIO-01 — clause 3: orientation is deterministic from DISPLAY DIMENSIONS", () => {
  it("derives landscape from width > height (1280x720)", () => {
    expect(deriveOrientationFromDimensions(1280, 720)).toBe("landscape");
  });

  it("derives portrait from height > width (720x1280)", () => {
    expect(deriveOrientationFromDimensions(720, 1280)).toBe("portrait");
  });

  it("derives square from equal dimensions, and null when dimensions are absent", () => {
    expect(deriveOrientationFromDimensions(1000, 1000)).toBe("square");
    expect(deriveOrientationFromDimensions(null, 720)).toBeNull();
    expect(deriveOrientationFromDimensions(1280, null)).toBeNull();
    expect(deriveOrientationFromDimensions(0, 0)).toBeNull();
    expect(deriveOrientationFromDimensions(undefined, undefined)).toBeNull();
  });

  it("LOAD-BEARING: 1280x720 (landscape) against a portrait brief raises orientation_mismatch — driven by DIMENSIONS, with NO prose-regex match and NO browser orientation signal", () => {
    // Mirrors the server wiring exactly: dimensions → derive → gate. There is
    // no model-prose input here and no signals.orientation — the flag can ONLY
    // come from the width>height derivation. If orientation were re-pointed to
    // the prose regex (landscapeObserved) or a browser signal, this stays unlit
    // and the assertion fails: that is the anti-tautology / anti-regression pin.
    const orientation = deriveOrientationFromDimensions(1280, 720);
    expect(orientation).toBe("landscape");
    const flags = deterministicCompliance({
      extracted: portraitBrief(),
      orientation,
      durationSeconds: 30,
    });
    expect(flags.some((f) => f.code === "orientation_mismatch")).toBe(true);
  });

  it("720x1280 (portrait) against a portrait brief raises NO orientation_mismatch", () => {
    const orientation = deriveOrientationFromDimensions(720, 1280);
    expect(orientation).toBe("portrait");
    const flags = deterministicCompliance({
      extracted: portraitBrief(),
      orientation,
      durationSeconds: 30,
    });
    expect(flags.some((f) => f.code === "orientation_mismatch")).toBe(false);
  });

  it("unknown dimensions (null orientation) raise NO orientation_mismatch (no false positive)", () => {
    const orientation = deriveOrientationFromDimensions(null, null);
    expect(orientation).toBeNull();
    const flags = deterministicCompliance({
      extracted: portraitBrief(),
      orientation,
      durationSeconds: 30,
    });
    expect(flags.some((f) => f.code === "orientation_mismatch")).toBe(false);
  });

  it("computes duration_over from the (mux-sourced) durationSeconds", () => {
    const flags = deterministicCompliance({
      extracted: portraitBrief(),
      orientation: deriveOrientationFromDimensions(720, 1280),
      durationSeconds: 120, // >> 60 + 5
    });
    expect(flags.some((f) => f.code === "duration_over")).toBe(true);
  });

  it("computes duration_under from the (mux-sourced) durationSeconds", () => {
    const flags = deterministicCompliance({
      extracted: portraitBrief(),
      orientation: deriveOrientationFromDimensions(720, 1280),
      durationSeconds: 9, // < max(8, 60*0.4=24)
    });
    expect(flags.some((f) => f.code === "duration_under")).toBe(true);
  });
});

// Server-wiring guard (source-level): pins that the gate's orientation is the
// dimension derivation over signals.width/height, NOT technicalMediaSignals
// (whose .landscape OR's the prose regex) and NOT a browser orientation signal.
// This is what makes the clause-3 tests non-tautological: it would FAIL if
// someone re-pointed observedOrientation back to the prose-regex/browser source.
describe("S11-AUDIO-01 — clause 3: server sources orientation from dimensions, not prose", () => {
  const src = readFileSync(path.join(process.cwd(), "src/server/process-take.server.ts"), "utf8");

  it("derives the compliance orientation via deriveOrientationFromDimensions", () => {
    expect(src).toContain("const observedOrientation = deriveOrientationFromDimensions(");
  });

  it("no longer falls back to technicalMediaSignals.landscape for the gate", () => {
    // The pre-round-2 expression OR'd in the prose-regex-inclusive .landscape.
    expect(src).not.toContain("technicalMediaSignals.landscape === true");
  });

  it("feeds the dimension-derived orientation straight into deterministicCompliance", () => {
    const gateCall = src.slice(src.indexOf("const complianceFlags = deterministicCompliance({"));
    expect(gateCall).toContain("orientation: observedOrientation,");
  });
});

describe("S11-AUDIO-01 — clause 2: signalsBlock de-contamination (source-level)", () => {
  const src = readFileSync(path.join(process.cwd(), "src/server/process-take.server.ts"), "utf8");

  it("builds the model signalsBlock via the dedicated de-contaminating helper", () => {
    // The single source of the model-facing TECHNICAL SIGNALS block must be
    // built from a sanitiser, not a raw JSON.stringify of take.signals +
    // take.checklist (which is how the browser zeros leaked to the model).
    expect(src).toContain("buildModelTechnicalSignalsBlock");
  });

  it("no longer serialises the raw { signals, checklist } pair into the model prompt", () => {
    // Defensive: the exact pre-fix expression must be gone.
    expect(src).not.toContain("{ signals: take.signals, checklist: take.checklist }");
  });
});

describe("S11-AUDIO-01 — clause 2: signalsBlock sanitiser drops perceptual keys + checklist", () => {
  it("strips audio_peak/audio_rms/brightness and the checklist even when present on an old take", async () => {
    const mod = await import("@/server/process-take.server");
    const build = (mod as Record<string, unknown>).buildModelTechnicalSignalsBlock as
      | ((input: { signals: unknown; checklist: unknown }) => string)
      | undefined;
    expect(typeof build).toBe("function");
    if (typeof build !== "function") return;
    const block = build({
      signals: {
        audio_peak: 0,
        audio_rms: 0,
        brightness: 0.42,
        orientation: "landscape",
        duration: 47,
        width: 1280,
        height: 720,
        upload_identity: { original_file_name_safe_basename: "tape.mp4" },
      },
      checklist: {
        audio: { peak: 0, rms: 0, note: "silent" },
        brightness: { value: 0.42 },
      },
    });
    // NONE of the browser perceptual keys/values may leak to the model.
    expect(block).not.toContain("audio_peak");
    expect(block).not.toContain("audio_rms");
    expect(block).not.toContain("brightness");
    expect(block).not.toContain("checklist");
    expect(block).not.toContain('"peak"');
    expect(block).not.toContain("RMS 0");
    // Non-perceptual context that legitimately helps the model is preserved.
    expect(block).toContain("tape.mp4");
  });
});

describe("S11-AUDIO-01 — clause 4: no pre-upload ChecklistView / brief-blind QC", () => {
  const newRoute = readFileSync(path.join(process.cwd(), "src/routes/new.tsx"), "utf8");
  const auditionRoute = readFileSync(
    path.join(process.cwd(), "src/routes/audition.$auditionId.tsx"),
    "utf8",
  );

  it("the new-audition route no longer renders ChecklistView or imports it", () => {
    expect(newRoute).not.toContain("ChecklistView");
  });

  it("the new-audition route no longer runs the browser perceptual probe (analyzeVideoFile)", () => {
    expect(newRoute).not.toContain("analyzeVideoFile");
  });

  it("the audition route no longer renders ChecklistView or imports it", () => {
    expect(auditionRoute).not.toContain("ChecklistView");
  });

  it("the audition route no longer runs the browser perceptual probe (analyzeVideoFile)", () => {
    expect(auditionRoute).not.toContain("analyzeVideoFile");
  });

  it("neither upload route writes browser perceptual audio/brightness into signals", () => {
    for (const src of [newRoute, auditionRoute]) {
      expect(src).not.toContain("audio_peak:");
      expect(src).not.toContain("audio_rms:");
      expect(src).not.toContain("brightness:");
    }
  });
});
