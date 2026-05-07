// SERVER-ONLY. Phase 2 dance shadow rules.
import type { FutureComponent } from "../dimensions/shared";
import {
  clamp,
  densityFromComponent,
  findComponent,
  meanOfDimensions,
  type DisciplineShadowResult,
} from "./shared";

const MOVEMENT_DIMS = [
  "technique_control",
  "alignment_placement_posture",
  "coordination",
  "line_shape",
];
const MUSICALITY_DIMS = ["rhythm_timing", "musicality"];

export function deriveDanceShadow(
  components: readonly FutureComponent[],
): DisciplineShadowResult {
  const dance = findComponent(components, "dance");
  const movement = meanOfDimensions(dance, MOVEMENT_DIMS);
  const musicality = meanOfDimensions(dance, MUSICALITY_DIMS);

  const shadow: DisciplineShadowResult["shadowScores"] = {};
  if (movement != null) {
    const bonus = musicality != null ? (musicality - 70) * 0.15 : 0;
    // Movement performance proxy maps onto the existing "acting" public field.
    // Never published as Vocal.
    shadow.acting = clamp(movement + bonus);
  }
  const visibility = dance?.assessability?.visibility;
  const warnings: string[] = [];
  if (visibility === "low") warnings.push("dance_visibility_low");

  return {
    branch: "dance",
    shadowScores: shadow,
    density: { dance: densityFromComponent(dance) },
    warnings,
  };
}
