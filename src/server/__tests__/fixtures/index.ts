// Fixture loader for the future-state regression harness.
//
// Keeps fixture I/O out of test files so the harness can be exercised from
// scripts as well as Vitest. Phase 0 only ships the loader and the directory
// scaffolding; later phases will add real artefacts and snapshot assertions.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Branch = "mt" | "acting" | "dance" | "voice" | "commercial";

export type FailureMode =
  | "generic_praise"
  | "acting_through_song_weak"
  | "broad_vocal_praise"
  | "timestamp_underproduction"
  | "role_fit_overclaim"
  | "presentation_polish_drift"
  | "frame_break_coaching"
  | "clean_control";

export interface LegacyFixture {
  id: string;
  branch: Branch;
  source: "real" | "staged";
  brief: unknown;
  evidence_pass: unknown;
  expected_report: unknown;
}

export interface FailureFixture {
  id: string;
  branch: Branch;
  source: "real" | "staged" | "synthetic";
  failure_mode: FailureMode;
  brief: unknown;
  evidence_pass: unknown;
  current_report: unknown;
  phase2_expectations?: {
    scrub_counters?: Record<string, number>;
  };
}

function readJsonFiles<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as T);
}

export function loadLegacyFixtures(branch?: Branch): LegacyFixture[] {
  const root = path.join(__dirname, "legacy");
  const branches: Branch[] = branch
    ? [branch]
    : ["mt", "acting", "dance", "voice", "commercial"];
  return branches.flatMap((b) =>
    readJsonFiles<LegacyFixture>(path.join(root, b)),
  );
}

export function loadFailureFixtures(): FailureFixture[] {
  return readJsonFiles<FailureFixture>(path.join(__dirname, "failures"));
}
