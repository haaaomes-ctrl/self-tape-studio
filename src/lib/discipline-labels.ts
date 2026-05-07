// Discipline-aware display labels for the v2 component report.
//
// IMPORTANT: backend score keys never change. This module only chooses the
// public *label* shown to the user, based on audition_type and what scores
// are present. No score value is changed here.
//
// Contract:
//   - getCategoryLabel(auditionType, key)  → user-facing label string
//   - shouldShowVocal(auditionType, scores) → false suppresses the vocal row
//                                             (e.g. Dance, Commercial w/o VO)

export type PublicCategoryKey =
  | "technical"
  | "audio"
  | "vocal"
  | "acting"
  | "brief_adherence"
  | "professional_presentation";

export type AuditionTypeForLabels =
  | "musical_theatre"
  | "song"
  | "voice"
  | "monologue"
  | "acting_scene"
  | "dance"
  | "commercial"
  | "hybrid"
  | "unknown"
  | string
  | null
  | undefined;

const TECHNICAL = "Technical setup";
const AUDIO = "Audio clarity";
const BRIEF = "Brief adherence";
const PRES = "Professional presentation";

export function getCategoryLabel(
  auditionType: AuditionTypeForLabels,
  key: PublicCategoryKey,
): string {
  const t = (auditionType ?? "unknown") as string;
  switch (key) {
    case "technical":
      return TECHNICAL;
    case "audio":
      return AUDIO;
    case "brief_adherence":
      return BRIEF;
    case "professional_presentation":
      return PRES;
    case "vocal":
      switch (t) {
        case "musical_theatre":
        case "song":
        case "voice":
          return "Vocal performance";
        case "dance":
          return "Movement technique";
        case "monologue":
        case "acting_scene":
          return "Speech delivery";
        case "commercial":
          return "Voice delivery";
        default:
          return "Vocal performance";
      }
    case "acting":
      switch (t) {
        case "musical_theatre":
          return "Acting / performance";
        case "song":
        case "voice":
          return "Lyric & story communication";
        case "monologue":
        case "acting_scene":
          return "Acting / performance";
        case "dance":
          return "Performance & presence";
        case "commercial":
          return "Presence & naturalism";
        default:
          return "Acting / performance";
      }
  }
}

/**
 * Whether the vocal row should appear at all.
 * - Dance: never show "Vocal Performance" (the label flips to Movement,
 *   but if the score is null we still suppress the row entirely).
 * - Commercial: omit unless a vocal score is present (voiceover/jingle).
 * - Acting/Monologue: only show if a numeric vocal score exists (it gets
 *   the "Speech delivery" label).
 * - MT / Song / Voice: show whenever a numeric score exists.
 */
export function shouldShowVocal(
  auditionType: AuditionTypeForLabels,
  scores: { vocal?: number | null } | null | undefined,
): boolean {
  const has = typeof scores?.vocal === "number";
  const t = (auditionType ?? "unknown") as string;
  if (t === "dance") return false;
  if (t === "commercial") return has;
  return has;
}
