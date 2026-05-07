// SERVER-ONLY. Phase 1 voice dimensions (mirrors song; voice-only context).
import { validateComponent, type FutureComponent } from "./shared";
import { SONG_DIMENSIONS } from "./song";

export const VOICE_DIMENSIONS = SONG_DIMENSIONS;
export const VOICE_KEYS: ReadonlySet<string> = new Set(VOICE_DIMENSIONS);

export const VOICE_PROMPT = `
voice dimensions: ${VOICE_DIMENSIONS.join(", ")}.
- vocal health diagnosis is forbidden.
- voice-only outputs must not become acting-scene feedback.
`.trim();

export function validateVoiceComponent(
  raw: unknown,
  durationSeconds?: number | null,
): FutureComponent | null {
  return validateComponent(raw, VOICE_KEYS, durationSeconds);
}
