// SERVER-ONLY. Phase 1 monologue dimensions.
import { validateComponent, type FutureComponent } from "./shared";

export const MONOLOGUE_DIMENSIONS = [
  "objective_action",
  "given_circumstances",
  "stakes",
  "beat_shift",
  "direct_address_or_inner_life",
  "text_form",
  "speech_delivery",
  "pacing",
  "camera_or_space_relationship",
  "no_brief_restraint",
  "assessability",
] as const;
export const MONOLOGUE_KEYS: ReadonlySet<string> = new Set(MONOLOGUE_DIMENSIONS);

export const MONOLOGUE_PROMPT = `
monologue dimensions: ${MONOLOGUE_DIMENSIONS.join(", ")}.
- do not require a specific acting method.
- in no-brief mode, do not invent unseen character or production requirements.
`.trim();

export function validateMonologueComponent(
  raw: unknown,
  durationSeconds?: number | null,
): FutureComponent | null {
  return validateComponent(raw, MONOLOGUE_KEYS, durationSeconds);
}
