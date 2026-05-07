// SERVER-ONLY. Phase 2 voice / song shadow rules.
import type { FutureComponent } from "../dimensions/shared";
import {
  clamp,
  densityFromComponent,
  findComponent,
  meanOfDimensions,
  type DisciplineShadowResult,
} from "./shared";

const TECHNIQUE = [
  "pitch_rhythm_accuracy",
  "breath_support",
  "tone_resonance",
  "register_range_handling",
  "phrasing_musicality",
];
const COMMUNICATION = ["lyric_intention", "communication", "acting_through_song"];

export function deriveVoiceShadow(
  components: readonly FutureComponent[],
): DisciplineShadowResult {
  const voice = findComponent(components, "voice", "song");
  const technique = meanOfDimensions(voice, TECHNIQUE);
  const communication = meanOfDimensions(voice, COMMUNICATION);

  const shadow: DisciplineShadowResult["shadowScores"] = {};
  if (technique != null) shadow.vocal = clamp(technique);
  if (communication != null) {
    // Story communication folds into acting, not vocal.
    shadow.acting = clamp(communication);
  }
  const accompaniment = voice?.dimensions?.accompaniment_balance;
  if (accompaniment && typeof accompaniment.value === "number") {
    // Audio modifier only when a clean balance is anchored.
    shadow.audio = clamp(70 + (Number(accompaniment.value) - 70) * 0.2);
  }

  return {
    branch: "voice",
    shadowScores: shadow,
    density: { voice: densityFromComponent(voice) },
    warnings: [],
  };
}
