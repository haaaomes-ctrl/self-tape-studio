// SERVER-ONLY. Phase 1 commercial dimensions.
import { validateComponent, type FutureComponent } from "./shared";

export const COMMERCIAL_DIMENSIONS = [
  "commercial_task_type",
  "copy_handling",
  "tone_calibration",
  "camera_addressee",
  "direct_to_camera",
  "reader_scene_mediation",
  "product_brand_situation_grounding",
  "believable_scale",
  "no_dialogue_storytelling",
  "voiceover_condition",
  "no_brief_restraint",
  "assessability",
] as const;
export const COMMERCIAL_KEYS: ReadonlySet<string> = new Set(COMMERCIAL_DIMENSIONS);

export const COMMERCIAL_PROMPT = `
commercial dimensions: ${COMMERCIAL_DIMENSIONS.join(", ")}.
- commercial is not theatre acting or generic screen acting.
- copy/tone/product/brand claims require supplied or directly observable context.
- in no-brief mode, do not invent brand, product, target audience, buyer fit, look or casting fit.
- never capture marketability, bookability, appearance, charm, look or social profile as evidence.
- voiceover, UGC/social, presenter-led product and corporate/industrial are conditional unless explicitly supplied.
`.trim();

export function validateCommercialComponent(
  raw: unknown,
  durationSeconds?: number | null,
): FutureComponent | null {
  return validateComponent(raw, COMMERCIAL_KEYS, durationSeconds);
}
