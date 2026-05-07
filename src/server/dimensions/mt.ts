// SERVER-ONLY. Phase 1 musical theatre dimensions.
import { validateComponent, type FutureComponent } from "./shared";

export const MT_DIMENSIONS = [
  "acting_scene_objective",
  "reader_relationship",
  "beat_shift",
  "scene_to_song_transition",
  "acting_through_song",
  "lyric_intention",
  "phrase_action",
  "vocal_technique_serves_story",
  "style_requirement",
  "integration",
  "movement_in_service_of_story",
  "brief_material_fit",
  "assessability",
] as const;
export const MT_KEYS: ReadonlySet<string> = new Set(MT_DIMENSIONS);

export const MT_PROMPT = `
musical_theatre dimensions: ${MT_DIMENSIONS.join(", ")}.
- MT is NOT generic acting + generic singing. acting_through_song is its own dimension.
- separate vocal_technique_serves_story from lyric/story communication.
- where both components exist, capture scene_to_song_transition.
- movement_in_service_of_story only when visible.
`.trim();

export function validateMtComponent(
  raw: unknown,
  durationSeconds?: number | null,
): FutureComponent | null {
  return validateComponent(raw, MT_KEYS, durationSeconds);
}
