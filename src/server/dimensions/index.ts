// SERVER-ONLY. Phase 1 dimension registry.
//
// Internal-only. Never serialised into public `takes.report`.

import {
  SHARED_PROMPT_FRAGMENT,
  type FutureComponent,
} from "./shared";
import { ACTING_PROMPT, validateActingComponent } from "./acting";
import { MONOLOGUE_PROMPT, validateMonologueComponent } from "./monologue";
import { SONG_PROMPT, validateSongComponent } from "./song";
import { VOICE_PROMPT, validateVoiceComponent } from "./voice";
import { MT_PROMPT, validateMtComponent } from "./mt";
import { DANCE_PROMPT, validateDanceComponent } from "./dance";
import { COMMERCIAL_PROMPT, validateCommercialComponent } from "./commercial";
import { SLATE_PROMPT, validateSlateComponent } from "./slate";

export type ComponentType =
  | "acting_scene"
  | "monologue"
  | "song"
  | "voice"
  | "musical_theatre"
  | "dance"
  | "commercial"
  | "slate"
  | string;

const VALIDATORS: Record<
  string,
  (raw: unknown, dur?: number | null) => FutureComponent | null
> = {
  acting_scene: validateActingComponent,
  monologue: validateMonologueComponent,
  song: validateSongComponent,
  voice: validateVoiceComponent,
  musical_theatre: validateMtComponent,
  mt: validateMtComponent,
  dance: validateDanceComponent,
  commercial: validateCommercialComponent,
  slate: validateSlateComponent,
};

/** Build the additive Step 1 prompt fragment (only when the flag is on). */
export function buildDimensionsPromptFragment(): string {
  return [
    SHARED_PROMPT_FRAGMENT,
    ACTING_PROMPT,
    MONOLOGUE_PROMPT,
    SONG_PROMPT,
    VOICE_PROMPT,
    MT_PROMPT,
    DANCE_PROMPT,
    COMMERCIAL_PROMPT,
    SLATE_PROMPT,
  ].join("\n\n");
}

export interface FutureDimensionsResult {
  components: FutureComponent[];
  dropped: number;
  malformed: boolean;
}

/** Validate the model-emitted future_components array. Drops malformed safely. */
export function validateFutureComponents(
  raw: unknown,
  durationSeconds?: number | null,
): FutureDimensionsResult {
  if (!Array.isArray(raw)) {
    return { components: [], dropped: 0, malformed: raw != null };
  }
  let dropped = 0;
  const components: FutureComponent[] = [];
  for (const entry of raw) {
    const type =
      entry && typeof entry === "object"
        ? (entry as { type?: unknown }).type
        : null;
    const validator =
      typeof type === "string" && VALIDATORS[type]
        ? VALIDATORS[type]
        : null;
    if (!validator) {
      dropped += 1;
      continue;
    }
    const validated = validator(entry, durationSeconds);
    if (validated) components.push(validated);
    else dropped += 1;
  }
  return { components, dropped, malformed: false };
}

/** Optional tool-schema fragment Step 1 can advertise when flag is on. */
export const FUTURE_COMPONENTS_SCHEMA = {
  type: "array",
  description:
    "Optional Phase 1 internal future_components. Each item: { type, start|null, end|null, confidence, assessability, subtype?, style?, form?, dimensions: { <key>: { value|null, confidence, supports:[anchor_id] } }, evidence_anchors:[ { id, kind, timestamp?, note, supports:[dimension_key] } ] }. Anchors required for any populated claim.",
  items: { type: "object" },
} as const;

export type { FutureComponent };
