// SERVER-ONLY. Phase 1 song dimensions.
import { validateComponent, type FutureComponent } from "./shared";

export const SONG_DIMENSIONS = [
  "pitch_rhythm_accuracy",
  "breath_support",
  "diction_lyric_intelligibility",
  "tone_resonance",
  "register_range_handling",
  "phrasing_musicality",
  "lyric_intention",
  "communication",
  "acting_through_song",
  "style_fit",
  "accompaniment_balance",
  "assessability",
] as const;
export const SONG_KEYS: ReadonlySet<string> = new Set(SONG_DIMENSIONS);

export const SONG_PROMPT = `
song dimensions: ${SONG_DIMENSIONS.join(", ")}.
- vocal health diagnosis is forbidden. strain/fatigue may only be captured as cautious observable sound quality.
- song-only outputs must not become acting-scene feedback.
- vocal evidence here means sung-vocal evidence.
`.trim();

export function validateSongComponent(
  raw: unknown,
  durationSeconds?: number | null,
): FutureComponent | null {
  return validateComponent(raw, SONG_KEYS, durationSeconds);
}
