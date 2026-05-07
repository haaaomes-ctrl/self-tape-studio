// SERVER-ONLY. Phase 1 slate dimensions — process/clarity only.
import { validateComponent, type FutureComponent } from "./shared";

export const SLATE_DIMENSIONS = [
  "slate_clarity",
  "instruction_compliance",
  "assessability",
] as const;
export const SLATE_KEYS: ReadonlySet<string> = new Set(SLATE_DIMENSIONS);

export const SLATE_PROMPT = `
slate dimensions: ${SLATE_DIMENSIONS.join(", ")}.
- slate/admin/file requirements are process or brief-compliance evidence ONLY.
- they are not talent evidence.
`.trim();

export function validateSlateComponent(
  raw: unknown,
  durationSeconds?: number | null,
): FutureComponent | null {
  return validateComponent(raw, SLATE_KEYS, durationSeconds);
}
