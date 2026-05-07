// SERVER-ONLY. Phase 2 discipline dispatcher.
import type { FutureComponent } from "../dimensions/shared";
import { deriveActingShadow } from "./acting";
import { deriveCommercialShadow } from "./commercial";
import { deriveDanceShadow } from "./dance";
import { deriveMtShadow } from "./mt";
import { deriveVoiceShadow } from "./voice";
import type { DisciplineShadowResult } from "./shared";

export type Branch =
  | "mt"
  | "dance"
  | "acting"
  | "voice"
  | "commercial"
  | "hybrid"
  | "unknown";

export function resolveBranch(
  auditionType: string,
  components: readonly FutureComponent[],
): Branch {
  const types = new Set(components.map((c) => c.type));
  switch (auditionType) {
    case "musical_theatre":
      return "mt";
    case "dance":
      return "dance";
    case "commercial":
      return "commercial";
    case "song":
      return "voice";
    case "monologue":
    case "acting_scene":
      return "acting";
    case "hybrid":
      if (types.has("musical_theatre") || (types.has("song") && types.has("acting_scene")))
        return "mt";
      return "hybrid";
    default:
      if (types.has("musical_theatre")) return "mt";
      if (types.has("dance")) return "dance";
      if (types.has("commercial")) return "commercial";
      if (types.has("song") || types.has("voice")) return "voice";
      if (types.has("acting_scene") || types.has("monologue")) return "acting";
      return "unknown";
  }
}

export function deriveShadowForBranch(
  branch: Branch,
  components: readonly FutureComponent[],
  hasBrief: boolean,
): DisciplineShadowResult {
  switch (branch) {
    case "mt":
      return deriveMtShadow(components);
    case "dance":
      return deriveDanceShadow(components);
    case "acting":
      return deriveActingShadow(components);
    case "voice":
      return deriveVoiceShadow(components);
    case "commercial":
      return deriveCommercialShadow(components, hasBrief);
    case "hybrid":
    case "unknown":
    default:
      return {
        branch,
        shadowScores: {},
        density: {},
        warnings: ["branch_unresolved"],
      };
  }
}
