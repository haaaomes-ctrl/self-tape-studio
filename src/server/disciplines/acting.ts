// SERVER-ONLY. Phase 2 acting / monologue shadow rules.
import type { FutureComponent } from "../dimensions/shared";
import {
  clamp,
  densityFromComponent,
  findComponent,
  meanOfDimensions,
  type DisciplineShadowResult,
} from "./shared";

const ACTING_CORE = [
  "objective_action",
  "stakes",
  "beat_shift",
  "listening_response",
  "thought_process",
];
const RELATIONSHIP_DIMS = ["reader_relationship", "eyeline_camera_task"];
const SPEECH_DIMS = ["speech_delivery"];

export function deriveActingShadow(
  components: readonly FutureComponent[],
): DisciplineShadowResult {
  const acting = findComponent(components, "acting_scene", "monologue");
  const core = meanOfDimensions(acting, ACTING_CORE);
  const relationship = meanOfDimensions(acting, RELATIONSHIP_DIMS);
  const speech = meanOfDimensions(acting, SPEECH_DIMS);

  const shadow: DisciplineShadowResult["shadowScores"] = {};
  if (core != null) {
    const relBonus = relationship != null ? (relationship - 70) * 0.1 : 0;
    const speechBonus = speech != null ? (speech - 70) * 0.05 : 0;
    shadow.acting = clamp(core + relBonus + speechBonus);
  }

  const warnings: string[] = [];
  const noBriefRestraint = acting?.dimensions?.no_brief_restraint;
  if (noBriefRestraint && noBriefRestraint.value === false) {
    warnings.push("acting_no_brief_restraint_violation");
  }

  return {
    branch: "acting",
    shadowScores: shadow,
    density: { acting: densityFromComponent(acting) },
    warnings,
  };
}
