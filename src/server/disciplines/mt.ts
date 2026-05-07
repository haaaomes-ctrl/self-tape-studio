// SERVER-ONLY. Phase 2 MT shadow rules.
import type { FutureComponent } from "../dimensions/shared";
import {
  clamp,
  densityFromComponent,
  findComponent,
  meanOfDimensions,
  type DisciplineShadowResult,
} from "./shared";

const ACTING_DIMS = [
  "acting_scene_objective",
  "beat_shift",
  "acting_through_song",
  "lyric_intention",
  "phrase_action",
  "reader_relationship",
];
const VOCAL_DIMS = ["vocal_technique_serves_story", "style_requirement"];
const INTEGRATION_DIMS = ["integration", "scene_to_song_transition"];

export function deriveMtShadow(
  components: readonly FutureComponent[],
): DisciplineShadowResult {
  const mt = findComponent(components, "musical_theatre", "mt");
  const song = findComponent(components, "song");
  const acting = findComponent(components, "acting_scene", "monologue");
  const primary = mt ?? song ?? acting;

  const actingMean = meanOfDimensions(mt, ACTING_DIMS) ?? meanOfDimensions(acting, [
    "objective_action",
    "beat_shift",
    "listening_response",
  ]);
  const vocalMean = meanOfDimensions(mt, VOCAL_DIMS) ?? meanOfDimensions(song, [
    "pitch_rhythm_accuracy",
    "tone_resonance",
    "phrasing_musicality",
  ]);
  const integrationMean = meanOfDimensions(mt, INTEGRATION_DIMS);

  const shadow: DisciplineShadowResult["shadowScores"] = {};
  if (actingMean != null) {
    const bonus = integrationMean != null ? (integrationMean - 70) * 0.1 : 0;
    shadow.acting = clamp(actingMean + bonus);
  }
  if (vocalMean != null) shadow.vocal = clamp(vocalMean);

  const warnings: string[] = [];
  if (mt && (meanOfDimensions(mt, ["acting_through_song"]) ?? 0) < 60) {
    warnings.push("mt_acting_through_song_low");
  }

  return {
    branch: "mt",
    shadowScores: shadow,
    density: {
      mt: densityFromComponent(mt ?? primary),
    },
    warnings,
  };
}
