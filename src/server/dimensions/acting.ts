// SERVER-ONLY. Phase 1 acting dimensions.
import { validateComponent, type FutureComponent } from "./shared";

export const ACTING_DIMENSIONS = [
  "objective_action",
  "stakes",
  "beat_shift",
  "listening_response",
  "reader_relationship",
  "eyeline_camera_task",
  "speech_delivery",
  "thought_process",
  "text_form",
  "screen_or_stage_scale",
  "no_brief_restraint",
  "assessability",
] as const;
export const ACTING_KEYS: ReadonlySet<string> = new Set(ACTING_DIMENSIONS);

export const ACTING_PROMPT = `
acting_scene dimensions: ${ACTING_DIMENSIONS.join(", ")}.
- speech_delivery is acting evidence, not singing evidence.
- reader access/quality is process support, not talent evidence.
- in no-brief mode, do not invent role/world.
`.trim();

export function validateActingComponent(
  raw: unknown,
  durationSeconds?: number | null,
): FutureComponent | null {
  return validateComponent(raw, ACTING_KEYS, durationSeconds);
}
