// SERVER-ONLY. Phase 1 dance dimensions.
import { validateComponent, type FutureComponent } from "./shared";

export const DANCE_DIMENSIONS = [
  "style_family",
  "technique_control",
  "alignment_placement_posture",
  "coordination",
  "line_shape",
  "space_pathway",
  "rhythm_timing",
  "musicality",
  "dynamics_quality",
  "performance_expression",
  "visibility_movement_assessability",
  "adaptation_access_context",
] as const;
export const DANCE_KEYS: ReadonlySet<string> = new Set(DANCE_DIMENSIONS);

export const DANCE_PROMPT = `
dance dimensions: ${DANCE_DIMENSIONS.join(", ")}.
- do not use singing/voice terminology.
- when full-body or task-relevant visibility is missing, lower confidence before any performance criticism.
- mobility aids, seated work, reduced range, convalescence and adaptation are NOT deficits.
- do not infer choreography pickup, stamina across a call, or response to direction from a finished tape.
`.trim();

export function validateDanceComponent(
  raw: unknown,
  durationSeconds?: number | null,
): FutureComponent | null {
  return validateComponent(raw, DANCE_KEYS, durationSeconds);
}
