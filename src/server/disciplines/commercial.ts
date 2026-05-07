// SERVER-ONLY. Phase 2 commercial shadow rules.
import type { FutureComponent } from "../dimensions/shared";
import {
  clamp,
  densityFromComponent,
  findComponent,
  meanOfDimensions,
  type DisciplineShadowResult,
} from "./shared";

const PERFORMANCE = ["copy_handling", "tone_calibration", "camera_addressee"];
const BRIEF_DIMS = ["product_brand_situation_grounding", "believable_scale"];

export function deriveCommercialShadow(
  components: readonly FutureComponent[],
  hasBrief: boolean,
): DisciplineShadowResult {
  const com = findComponent(components, "commercial");
  const perf = meanOfDimensions(com, PERFORMANCE);
  const brief = hasBrief ? meanOfDimensions(com, BRIEF_DIMS) : null;

  const shadow: DisciplineShadowResult["shadowScores"] = {};
  if (perf != null) shadow.acting = clamp(perf);
  if (brief != null) shadow.brief_adherence = clamp(brief);

  const warnings: string[] = [];
  if (!hasBrief) {
    const grounding = com?.dimensions?.product_brand_situation_grounding;
    if (grounding && grounding.value != null) {
      warnings.push("commercial_no_brief_invention_risk");
    }
  }

  return {
    branch: "commercial",
    shadowScores: shadow,
    density: { commercial: densityFromComponent(com) },
    warnings,
  };
}
