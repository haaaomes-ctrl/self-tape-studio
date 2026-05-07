// Phase 0 fixture harness — only asserts that the fixture suites load and
// are well-formed. Detection assertions are added in Phase 2; legacy
// preservation snapshots are added as real artefacts arrive.

import { describe, it, expect } from "vitest";
import {
  loadFailureFixtures,
  loadLegacyFixtures,
  type FailureMode,
} from "./fixtures";

const REQUIRED_FAILURE_MODES: FailureMode[] = [
  "clean_control",
  "generic_praise",
  "acting_through_song_weak",
  "broad_vocal_praise",
  "timestamp_underproduction",
  "role_fit_overclaim",
  "presentation_polish_drift",
  "frame_break_coaching",
];

describe("future-state fixture harness (Phase 0)", () => {
  it("loads failure fixtures covering every known failure mode", () => {
    const fixtures = loadFailureFixtures();
    const modes = new Set(fixtures.map((f) => f.failure_mode));
    for (const required of REQUIRED_FAILURE_MODES) {
      expect(modes.has(required), `missing failure fixture: ${required}`).toBe(
        true,
      );
    }
  });

  it("failure fixtures all carry the required shape", () => {
    for (const f of loadFailureFixtures()) {
      expect(f.id).toBeTruthy();
      expect(f.branch).toBeTruthy();
      expect(["real", "staged", "synthetic"]).toContain(f.source);
      expect(f.brief).toBeDefined();
      expect(f.evidence_pass).toBeDefined();
      expect(f.current_report).toBeDefined();
    }
  });

  it("legacy fixture loader returns an array (artefacts added incrementally)", () => {
    expect(Array.isArray(loadLegacyFixtures())).toBe(true);
  });
});
