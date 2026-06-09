// SERVER-ONLY. S10.9 timestamped/time-banded commentary validation.
//
// The AI authors timestamped commentary. Code validates source authority and
// component status, then projects only safe notes into legacy timestamped_notes.

import type {
  BriefAchievementMatrix,
  ReadinessAndScoreJudgement,
  S10FixHierarchy,
  S10NextActionPlan,
  S10NoteCategory,
  S10ProfessionalCritique,
  S10TechniqueCommentary,
  S10TimestampedCommentary,
  S10TimestampedComponentStatus,
  S10TimestampedComponentType,
  S10TimestampedNote,
  S10TimestampedSection,
  S10TimestampedWarning,
  S10TimestampPrecision,
  S10TimestampSourceAuthority,
  S10ComponentTimeRange,
  S10TimestampProjectionNote,
} from "@/lib/audition-rules";
import {
  isValidTimestamp,
  type ComponentVerification,
  type EvidencePass,
  type ObservedTapeSequence,
} from "./evidence-pass.server";
import { metric } from "./metrics.server";

type Confidence = "low" | "medium" | "high";

const COMPONENT_TYPES: S10TimestampedComponentType[] = [
  "ident",
  "acting_scene",
  "song",
  "dance",
  "movement",
  "transition",
  "technical",
  "unknown",
  "not_applicable",
];

const COMPONENT_STATUSES: S10TimestampedComponentStatus[] = [
  "present",
  "partially_present",
  "absent",
  "not_assessable",
  "uncertain",
  "not_applicable",
];

const TIMESTAMP_PRECISIONS: S10TimestampPrecision[] = [
  "exact",
  "approximate",
  "time_banded",
  "order_only",
  "unavailable",
];

// Δ6 P5 (DISPLAY-ONLY) — per-note valence and linked scoring category. These
// never feed any score/cap/verdict/gate computation; they only colour and label
// the note in the report UI.
const VALENCES = ["strength", "neutral", "improvement"] as const;
const NOTE_CATEGORIES = [
  "technical",
  "audio",
  "vocal",
  "acting",
  "brief_adherence",
  "professional_presentation",
] as const;

// Absence or any invalid value → null → no category tag (no default category).
function normaliseNoteCategory(value: unknown): S10NoteCategory | null {
  return typeof value === "string" && (NOTE_CATEGORIES as readonly string[]).includes(value)
    ? (value as S10NoteCategory)
    : null;
}

const SECTIONS: S10TimestampedSection[] = [
  "brief_requirement",
  "observed_component",
  "strength",
  "fix",
  "technique",
  "technical",
  "limitation",
  "next_action",
  "missing_component",
];

const SOURCE_AUTHORITIES: S10TimestampSourceAuthority[] = [
  "s10_ai_authored",
  "s10_normalised",
  "step1_timestamped_evidence",
  "evidence_anchor",
  "provider_output",
  "legacy_diagnostic_reauthored",
  "limitation",
];

export const S10_FORBIDDEN_TIMESTAMPED_COMMENTARY_PHRASES = [
  "00:05 Strong start to the scene",
  "00:25 Good use of eyeline",
  "00:55 transition into the song",
  "01:35 Excellent vocal control on the sustained notes",
  "Strong start to the scene",
  "Good use of eyeline",
  "scene partner",
  "Excellent vocal control on the sustained notes",
  "Complete song package",
  "Complete package",
  "Perfectly suits the brief",
  "Just keep doing what you are doing",
  "Continue refining",
  "Useful moment",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
}

function scalar(value: unknown): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value == null
  ) {
    return value ?? null;
  }
  try {
    return JSON.stringify(value).slice(0, 180);
  } catch {
    return String(value).slice(0, 180);
  }
}

function stringList(value: unknown, limit = 24): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, limit);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function normaliseKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9:]+/g, " ")
    .trim();
}

function hasForbiddenTimestampedPhrase(value: string): boolean {
  const key = normaliseKey(value);
  if (!key) return false;
  return S10_FORBIDDEN_TIMESTAMPED_COMMENTARY_PHRASES.some((phrase) =>
    key.includes(normaliseKey(phrase)),
  );
}

function addWarning(
  warnings: S10TimestampedWarning[],
  warning: Omit<S10TimestampedWarning, "internal_only">,
) {
  const originalValue =
    typeof warning.original_value === "string" &&
    hasForbiddenTimestampedPhrase(warning.original_value)
      ? "removed_unsafe_timestamped_prose"
      : warning.original_value;
  const key = `${warning.affected_field}:${warning.source}:${originalValue}:${warning.corrected_value}`;
  if (
    warnings.some(
      (item) =>
        `${item.affected_field}:${item.source}:${item.original_value}:${item.corrected_value}` ===
        key,
    )
  ) {
    return;
  }
  warnings.push({ ...warning, original_value: originalValue, internal_only: true });
}

function requirementText(item: BriefAchievementMatrix["requirement_results"][number]): string {
  return `${item.requirement_summary} ${item.evidence_summary} ${item.recommended_action}`.toLowerCase();
}

function isActingRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\b(side\s*1|acting scene|requested scene|side|monologue|scene)\b/i.test(
    requirementText(item),
  );
}

function isSongRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\bsong|singing|vocal|mt song|musical theatre\b/i.test(requirementText(item));
}

function isMissingOrPartial(item: BriefAchievementMatrix["requirement_results"][number]) {
  return (
    item.observed_status === "absent" ||
    item.observed_status === "partially_present" ||
    item.observed_status === "uncertain" ||
    item.achievement_status === "not_achieved" ||
    item.achievement_status === "partly_achieved" ||
    item.completion_status === "incomplete" ||
    item.completion_status === "cut_off" ||
    item.completion_status === "uncertain"
  );
}

function requiredActingMissing(matrix: BriefAchievementMatrix): boolean {
  const actingRows = matrix.requirement_results.filter(
    (item) => item.importance === "mandatory" && isActingRequirement(item),
  );
  return actingRows.length > 0 && actingRows.some(isMissingOrPartial);
}

function songPartialOrIncomplete(matrix: BriefAchievementMatrix): boolean {
  return matrix.requirement_results.some(
    (item) =>
      item.importance === "mandatory" && isSongRequirement(item) && isMissingOrPartial(item),
  );
}

function componentVerified(
  note: Pick<S10TimestampedNote, "component_type" | "linked_component_verification_ids">,
  componentVerifications: ComponentVerification[],
): boolean {
  if (note.component_type === "not_applicable" || note.component_type === "unknown") return true;
  if (note.component_type === "technical" || note.component_type === "transition") return true;
  const linked = new Set(note.linked_component_verification_ids.filter(Boolean));
  const candidates = linked.size
    ? componentVerifications.filter((item) => {
        const derivedVerificationId = `cv-${item.requirement_id.replace(/^req-/, "")}`;
        return linked.has(item.requirement_id) || linked.has(derivedVerificationId);
      })
    : componentVerifications;
  return candidates.some((item) => {
    const combined = `${item.requirement_summary} ${item.evidence_summary}`;
    const typeMatch =
      note.component_type === "acting_scene"
        ? /\b(side\s*1|acting scene|scene|monologue|acting)\b/i.test(combined)
        : note.component_type === "song"
          ? /\bsong|singing|vocal|mt song|musical theatre\b/i.test(combined)
          : note.component_type === "dance"
            ? /\bdance|choreo|movement\b/i.test(combined)
            : true;
    return (
      typeMatch &&
      item.observed_from_media === true &&
      item.evidence_basis === "observed_audio_video" &&
      (item.observed_status === "present" || item.observed_status === "partially_present")
    );
  });
}

function extractTimecode(value: unknown): string | null {
  const candidate = text(value);
  return candidate && isValidTimestamp(candidate) ? candidate : null;
}

function firstValidTimestamp(...values: unknown[]): string | null {
  for (const value of values) {
    const timestamp = extractTimecode(value);
    if (timestamp) return timestamp;
  }
  return null;
}

function timeSortValue(timestamp: string): number {
  const [minutes, seconds] = timestamp.split(":").map((part) => Number.parseInt(part, 10));
  return (Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? seconds : 0);
}

function parseNote(value: unknown, index: number): S10TimestampedNote | null {
  if (!isRecord(value)) return null;
  const precision = oneOf(value.timestamp_precision, TIMESTAMP_PRECISIONS, "unavailable");
  const timecode = firstValidTimestamp(value.timecode, value.timestamp);
  const startTime = firstValidTimestamp(value.start_time, timecode);
  const endTime = firstValidTimestamp(value.end_time);
  const title = text(value.title, `Time-based note ${index + 1}`);
  const detail = text(value.detail, text(value.note));
  const section = oneOf(value.section, SECTIONS, "observed_component");
  const componentType = oneOf(value.component_type, COMPONENT_TYPES, "unknown");
  const componentStatus = oneOf(value.component_status, COMPONENT_STATUSES, "uncertain");
  // Hoisted (needed by the Δ6 P5 reconciliation guard below before the return).
  const linkedFixIds = stringList(value.linked_fix_ids);
  const linkedStrengthIds = stringList(value.linked_strength_ids);
  const isMissingComponentNote = value.is_missing_component_note === true;
  // Δ6 P5 (DISPLAY-ONLY): per-note valence + deterministic reconciliation guard.
  // A note authored "strength" that is actually a fix or a missing-component note,
  // with no strength link, is self-contradicting → correct it to "improvement".
  // A note linked to BOTH a strength and a fix is genuinely mixed → leave it.
  let valence = oneOf(value.valence, VALENCES, "neutral");
  if (
    valence === "strength" &&
    (isMissingComponentNote || linkedFixIds.length > 0) &&
    linkedStrengthIds.length === 0
  ) {
    valence = "improvement";
    metric("s10_valence_reconciled_to_improvement", {
      reason: "strength_valence_on_fix_or_missing_note",
    });
  }
  const linkedCategory = normaliseNoteCategory(value.linked_category);
  return {
    id: text(value.id, `s10_ts_${index + 1}`),
    timecode,
    start_time: startTime,
    end_time: endTime,
    time_band_label: text(value.time_band_label) || null,
    display_label: text(value.display_label, timecode ?? startTime ?? "Timing unavailable"),
    timestamp_precision: precision,
    section,
    title,
    detail,
    action: text(value.action) || null,
    evidence_summary: text(value.evidence_summary),
    linked_requirement_ids: stringList(value.linked_requirement_ids),
    linked_observed_sequence_ids: stringList(value.linked_observed_sequence_ids),
    linked_component_verification_ids: stringList(value.linked_component_verification_ids),
    linked_matrix_result_ids: stringList(value.linked_matrix_result_ids),
    linked_fix_ids: linkedFixIds,
    linked_strength_ids: linkedStrengthIds,
    linked_technique_observation_ids: stringList(value.linked_technique_observation_ids),
    component_type: componentType,
    component_status: componentStatus,
    applies_to_observed_portion_only: value.applies_to_observed_portion_only === true,
    is_exact_timestamp_supported: value.is_exact_timestamp_supported === true,
    is_legacy_timestamp_projection: value.is_legacy_timestamp_projection === true,
    note_source_authority: oneOf(
      value.note_source_authority,
      SOURCE_AUTHORITIES,
      "s10_ai_authored",
    ),
    legacy_source_used: value.legacy_source_used === true,
    legacy_source_path: text(value.legacy_source_path) || null,
    is_missing_component_note: isMissingComponentNote,
    is_projection_safe: value.is_projection_safe === true,
    projection_block_reason: text(value.projection_block_reason) || null,
    confidence: oneOf(value.confidence, ["high", "medium", "low"] as const, "medium"),
    valence,
    linked_category: linkedCategory,
    is_generic_fallback: false,
  };
}

function createMissingActingNote(matrix: BriefAchievementMatrix): S10TimestampedNote {
  const actingRow = matrix.requirement_results.find(
    (item) => item.importance === "mandatory" && isActingRequirement(item),
  );
  return {
    id: "s10_ts_missing_required_acting_scene",
    timecode: null,
    start_time: null,
    end_time: null,
    time_band_label: null,
    display_label: "Not observed",
    timestamp_precision: "unavailable",
    section: "missing_component",
    title: "Required Side 1 not observed",
    detail:
      "The required Side 1 acting scene was not identified in the submitted tape, so no acting-scene timestamp can be assigned.",
    action: "Record or include the required Side 1 before treating this as a complete package.",
    evidence_summary:
      actingRow?.evidence_summary ??
      "S10 component verification does not identify the required acting scene.",
    linked_requirement_ids: actingRow ? [actingRow.requirement_id] : [],
    linked_observed_sequence_ids: [],
    linked_component_verification_ids: actingRow?.linked_component_verification_ids ?? [],
    linked_matrix_result_ids: actingRow ? [actingRow.requirement_id] : [],
    linked_fix_ids: [],
    linked_strength_ids: [],
    linked_technique_observation_ids: [],
    component_type: "acting_scene",
    component_status: "absent",
    applies_to_observed_portion_only: false,
    is_exact_timestamp_supported: false,
    is_legacy_timestamp_projection: false,
    note_source_authority: "limitation",
    legacy_source_used: false,
    legacy_source_path: null,
    is_missing_component_note: true,
    is_projection_safe: false,
    projection_block_reason: "missing component notes must not be projected with fake timestamps",
    confidence: "high",
    // Δ6 P5 (DISPLAY-ONLY): a missing-component note is an area to work on.
    valence: "improvement",
    linked_category: null,
    is_generic_fallback: false,
  };
}

function createPlaybackCheckNote(matrix: BriefAchievementMatrix): S10TimestampedNote {
  const songRow = matrix.requirement_results.find(
    (item) => item.importance === "mandatory" && isSongRequirement(item),
  );
  return {
    id: "s10_ts_song_playback_cutoff_check",
    timecode: null,
    start_time: null,
    end_time: null,
    time_band_label: "End of observed song section",
    display_label: "End of observed song section",
    timestamp_precision: "order_only",
    section: "next_action",
    title: "Playback-check the song ending",
    detail:
      "Because the song appears incomplete, cut off or uncertain, check playback through the end of the observed song section before exporting the final file.",
    action:
      "Confirm the song runs through to its intended end and is included with the required Side 1.",
    evidence_summary:
      songRow?.evidence_summary ?? "S10 matrix marks the song/package as incomplete or uncertain.",
    linked_requirement_ids: songRow ? [songRow.requirement_id] : [],
    linked_observed_sequence_ids: [],
    linked_component_verification_ids: songRow?.linked_component_verification_ids ?? [],
    linked_matrix_result_ids: songRow ? [songRow.requirement_id] : [],
    linked_fix_ids: [],
    linked_strength_ids: [],
    linked_technique_observation_ids: [],
    component_type: "song",
    component_status: "partially_present",
    applies_to_observed_portion_only: true,
    is_exact_timestamp_supported: false,
    is_legacy_timestamp_projection: false,
    note_source_authority: "s10_normalised",
    legacy_source_used: false,
    legacy_source_path: null,
    is_missing_component_note: false,
    is_projection_safe: false,
    projection_block_reason: "order-only playback check has no safe legacy timestamp",
    confidence: "medium",
    // Δ6 P5 (DISPLAY-ONLY): a plain process/playback check — a neutral observation.
    valence: "neutral",
    linked_category: null,
    is_generic_fallback: false,
  };
}

function normaliseComponentRanges(
  observedTapeSequence: ObservedTapeSequence[] = [],
): S10ComponentTimeRange[] {
  return observedTapeSequence
    .map((item, index) => {
      const start = extractTimecode(item.start_time);
      const end = extractTimecode(item.end_time);
      const precision: S10TimestampPrecision =
        start || end
          ? "approximate"
          : item.start_time || item.end_time
            ? "time_banded"
            : "order_only";
      return {
        component_type: oneOf(item.component_type, COMPONENT_TYPES, "unknown"),
        label: text(item.label, `Observed section ${index + 1}`),
        start_time: start ?? text(item.start_time) ?? null,
        end_time: end ?? text(item.end_time) ?? null,
        timestamp_precision: precision,
        observed_status: item.present_status,
        completion_status: item.completion_status,
        linked_requirement_ids: item.linked_requirement_ids ?? [],
        evidence_summary: text(item.evidence_summary),
        confidence: item.confidence,
      };
    })
    .slice(0, 24);
}

function normaliseProjectionNotes(notes: S10TimestampedNote[]): S10TimestampProjectionNote[] {
  const out: S10TimestampProjectionNote[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    if (!note.is_projection_safe) continue;
    const timestamp = firstValidTimestamp(note.timecode, note.start_time);
    if (!timestamp) continue;
    const textParts = [note.title, note.detail, note.action ?? ""].filter(Boolean);
    const publicNote = textParts.join(" - ").trim();
    if (!publicNote) continue;
    const key = `${timestamp}:${normaliseKey(publicNote)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      timestamp,
      note: publicNote,
      source_note_id: note.id,
      timestamp_precision: note.timestamp_precision,
    });
  }
  return out.sort((a, b) => timeSortValue(a.timestamp) - timeSortValue(b.timestamp)).slice(0, 36);
}

function noteContainsActingSceneClaim(note: {
  title: string;
  detail: string;
  action: string | null;
}) {
  return /\b(acting scene|side\s*1|scene partner|eyeline|eye[-\s]?line|start to the scene|scene)\b/i.test(
    `${note.title} ${note.detail} ${note.action ?? ""}`,
  );
}

function noteContainsCompleteSongClaim(note: {
  title: string;
  detail: string;
  action: string | null;
}) {
  return /\b(complete song|complete package|song package|runs? through|through to the end|full song|perfectly suits|sustained notes?)\b/i.test(
    `${note.title} ${note.detail} ${note.action ?? ""}`,
  );
}

function markProjectionSafety(note: S10TimestampedNote, reason: string | null): S10TimestampedNote {
  if (reason) {
    return { ...note, is_projection_safe: false, projection_block_reason: reason };
  }
  const timestamp = firstValidTimestamp(note.timecode, note.start_time);
  const safePrecision =
    note.timestamp_precision === "exact" || note.timestamp_precision === "approximate";
  if (!timestamp || !safePrecision || note.is_missing_component_note) {
    return {
      ...note,
      is_projection_safe: false,
      projection_block_reason:
        note.projection_block_reason ?? "note does not have a safe exact/approximate timestamp",
    };
  }
  return { ...note, is_projection_safe: true, projection_block_reason: null };
}

function normaliseNote(
  note: S10TimestampedNote,
  index: number,
  context: {
    matrix: BriefAchievementMatrix;
    componentVerifications: ComponentVerification[];
    requiredActingMissing: boolean;
    songPartialOrIncomplete: boolean;
    warnings: S10TimestampedWarning[];
  },
): S10TimestampedNote | null {
  const combined = `${note.display_label} ${note.title} ${note.detail} ${note.action ?? ""}`;
  if (!note.detail && !note.title) {
    addWarning(context.warnings, {
      affected_field: `s10_timestamped_commentary.notes[${index}]`,
      original_value: "missing timestamped detail",
      corrected_value: "removed",
      reason: "timestamped commentary must contain a specific note",
      source: "s10_normaliser",
    });
    return null;
  }
  if (hasForbiddenTimestampedPhrase(combined)) {
    addWarning(context.warnings, {
      affected_field: `s10_timestamped_commentary.notes[${index}]`,
      original_value: combined,
      corrected_value: "removed",
      reason: "legacy or generic timestamped prose is not S10 evidence",
      source: note.legacy_source_used ? "legacy_timestamped_notes" : "s10_ai_judgement",
    });
    return null;
  }

  let out = { ...note };

  if (
    !context.requiredActingMissing &&
    out.is_missing_component_note &&
    (out.component_type === "acting_scene" || noteContainsActingSceneClaim(out))
  ) {
    addWarning(context.warnings, {
      affected_field: `s10_timestamped_commentary.notes[${index}]`,
      original_value: combined,
      corrected_value: "removed",
      reason:
        "S10 component verification confirms the required acting scene, so stale missing-Side-1 notes must not render.",
      source: out.legacy_source_used ? "legacy_timestamped_notes" : "s10_ai_judgement",
    });
    return null;
  }

  if (
    context.requiredActingMissing &&
    out.component_type === "acting_scene" &&
    !out.is_missing_component_note
  ) {
    addWarning(context.warnings, {
      affected_field: `s10_timestamped_commentary.notes[${index}]`,
      original_value: combined,
      corrected_value: "removed",
      reason: "required acting scene is absent, so acting-scene timestamps cannot be kept",
      source: out.legacy_source_used ? "legacy_timestamped_notes" : "s10_ai_judgement",
    });
    return null;
  }

  if (
    context.requiredActingMissing &&
    noteContainsActingSceneClaim(out) &&
    !out.is_missing_component_note
  ) {
    addWarning(context.warnings, {
      affected_field: `s10_timestamped_commentary.notes[${index}]`,
      original_value: combined,
      corrected_value: "removed",
      reason: "timestamped note implies an acting scene that S10.3 did not verify",
      source: out.legacy_source_used ? "legacy_timestamped_notes" : "s10_ai_judgement",
    });
    return null;
  }

  const verified = componentVerified(out, context.componentVerifications);
  if (
    !verified &&
    out.component_type !== "technical" &&
    out.component_type !== "unknown" &&
    out.component_type !== "not_applicable" &&
    !out.is_missing_component_note
  ) {
    addWarning(context.warnings, {
      affected_field: `s10_timestamped_commentary.notes[${index}]`,
      original_value: combined,
      corrected_value: "removed",
      reason: "timestamped commentary cannot prove component presence",
      source: out.legacy_source_used ? "legacy_timestamped_notes" : "s10_ai_judgement",
    });
    return null;
  }

  if (context.songPartialOrIncomplete && out.component_type === "song") {
    if (noteContainsCompleteSongClaim(out)) {
      addWarning(context.warnings, {
        affected_field: `s10_timestamped_commentary.notes[${index}]`,
        original_value: combined,
        corrected_value: "observed portion only",
        reason: "song completion is partial, cut off or uncertain",
        source: out.legacy_source_used ? "legacy_timestamped_notes" : "s10_ai_judgement",
      });
      if (out.legacy_source_used || out.is_legacy_timestamp_projection) return null;
    }
    if (!out.applies_to_observed_portion_only) {
      out = {
        ...out,
        applies_to_observed_portion_only: true,
        detail: `${out.detail} This applies only to the observed portion.`.trim(),
      };
    }
  }

  if (out.timestamp_precision === "exact" && !out.is_exact_timestamp_supported) {
    addWarning(context.warnings, {
      affected_field: `s10_timestamped_commentary.notes[${index}].timestamp_precision`,
      original_value: "exact",
      corrected_value: out.timecode || out.start_time ? "approximate" : "order_only",
      reason: "exact timestamps require trusted timing support",
      source: "s10_normaliser",
    });
    out = {
      ...out,
      timestamp_precision: out.timecode || out.start_time ? "approximate" : "order_only",
      display_label:
        out.timecode || out.start_time
          ? `Approx. ${out.timecode ?? out.start_time}`
          : out.display_label,
    };
  }

  if (out.timestamp_precision === "unavailable") {
    out = {
      ...out,
      timecode: null,
      start_time: null,
      end_time: null,
      display_label: out.is_missing_component_note ? "Not observed" : "Timing unavailable",
    };
  }

  return markProjectionSafety(out, null);
}

export function normaliseS10TimestampedCommentary(input: {
  commentary: unknown;
  matrix: BriefAchievementMatrix;
  readiness: ReadinessAndScoreJudgement;
  fixHierarchy: S10FixHierarchy;
  nextActionPlan?: S10NextActionPlan | null;
  professionalCritique: S10ProfessionalCritique;
  techniqueCommentary: S10TechniqueCommentary;
  observedTapeSequence?: ObservedTapeSequence[];
  componentVerifications?: ComponentVerification[];
  timestampedEvidence?: EvidencePass["timestamped_evidence"];
  report?: Record<string, unknown>;
}): S10TimestampedCommentary {
  const record = isRecord(input.commentary) ? input.commentary : {};
  const warnings: S10TimestampedWarning[] = Array.isArray(record.contradiction_warnings)
    ? (record.contradiction_warnings as S10TimestampedWarning[]).filter(
        (item) => isRecord(item) && item.internal_only === true,
      )
    : [];
  const componentVerifications = input.componentVerifications ?? [];
  const actingMissing = requiredActingMissing(input.matrix);
  const songPartial = songPartialOrIncomplete(input.matrix);

  const parsedNotes = Array.isArray(record.notes)
    ? record.notes.map(parseNote).filter((item): item is S10TimestampedNote => item !== null)
    : [];

  let notes = parsedNotes
    .map((note, index) =>
      normaliseNote(note, index, {
        matrix: input.matrix,
        componentVerifications,
        requiredActingMissing: actingMissing,
        songPartialOrIncomplete: songPartial,
        warnings,
      }),
    )
    .filter((item): item is S10TimestampedNote => item !== null);

  if (
    actingMissing &&
    !notes.some((note) => note.is_missing_component_note && note.component_type === "acting_scene")
  ) {
    notes.push(createMissingActingNote(input.matrix));
  }
  if (
    songPartial &&
    !notes.some((note) =>
      /\b(playback|cut[-\s]?off|ending|runs? through)\b/i.test(
        `${note.title} ${note.detail} ${note.action ?? ""}`,
      ),
    )
  ) {
    notes.push(createPlaybackCheckNote(input.matrix));
  }

  notes = notes.slice(0, 36);
  const componentRanges = normaliseComponentRanges(input.observedTapeSequence ?? []);
  const projectionNotes = normaliseProjectionNotes(notes);
  const legacyProjectionBlockedCount = notes.filter(
    (note) => note.legacy_source_used && !note.is_projection_safe,
  ).length;
  const missingComponentNoteCount = notes.filter((note) => note.is_missing_component_note).length;
  const timeBandedNoteCount = notes.filter(
    (note) => note.timestamp_precision === "time_banded",
  ).length;
  const orderOnlyNoteCount = notes.filter(
    (note) => note.timestamp_precision === "order_only",
  ).length;
  const exactTimestampSupportedCount = notes.filter(
    (note) =>
      note.timestamp_precision === "exact" &&
      note.is_exact_timestamp_supported &&
      Boolean(firstValidTimestamp(note.timecode, note.start_time)),
  ).length;

  const missingComponents = stringList(record.missing_or_unobserved_components, 16);
  if (
    actingMissing &&
    !missingComponents.some((item) => /\b(side\s*1|acting scene)\b/i.test(item))
  ) {
    missingComponents.push("Required Side 1 acting scene was not observed.");
  }

  const limitations = stringList(record.timestamp_limitations, 16);
  if (notes.length === 0) {
    limitations.push(
      "No timestamped or time-banded commentary could be safely supported by verified S10 evidence.",
    );
  }

  return {
    summary: text(record.summary),
    notes,
    component_ranges: componentRanges,
    missing_or_unobserved_components: missingComponents,
    timestamp_limitations: limitations,
    projection_notes: projectionNotes,
    legacy_projection_blocked_count: legacyProjectionBlockedCount,
    exact_timestamp_supported_count: exactTimestampSupportedCount,
    time_banded_note_count: timeBandedNoteCount,
    order_only_note_count: orderOnlyNoteCount,
    missing_component_note_count: missingComponentNoteCount,
    contradiction_warnings: warnings,
  };
}

function legacyNoteText(item: unknown): string {
  if (!isRecord(item)) return "";
  return text(item.note) || text(item.text);
}

function legacyNoteTimestamp(item: unknown): string | null {
  if (!isRecord(item)) return null;
  return firstValidTimestamp(item.timestamp, item.timecode, item.time);
}

function safeLockedTimestampedNotes(input: {
  existing: unknown;
  timestampedEvidence?: EvidencePass["timestamped_evidence"];
  actingMissing: boolean;
  songPartial: boolean;
}): Array<{ timestamp: string; note: string }> {
  const evidenceTimestamps = new Set(
    (input.timestampedEvidence ?? [])
      .map((item) => item.timestamp)
      .filter((timestamp): timestamp is string => isValidTimestamp(timestamp)),
  );
  if (!Array.isArray(input.existing) || evidenceTimestamps.size === 0) return [];
  const out: Array<{ timestamp: string; note: string }> = [];
  const seen = new Set<string>();
  for (const item of input.existing) {
    const timestamp = legacyNoteTimestamp(item);
    const note = legacyNoteText(item);
    if (!timestamp || !note || !evidenceTimestamps.has(timestamp)) continue;
    if (hasForbiddenTimestampedPhrase(`${timestamp} ${note}`)) continue;
    if (
      input.actingMissing &&
      /\b(scene|eyeline|eye[-\s]?line|scene partner|side\s*1)\b/i.test(note)
    ) {
      continue;
    }
    if (
      input.songPartial &&
      /\b(complete song|complete package|through to the end|sustained notes?)\b/i.test(note)
    ) {
      continue;
    }
    const key = `${timestamp}:${normaliseKey(note)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ timestamp, note });
  }
  return out.sort((a, b) => timeSortValue(a.timestamp) - timeSortValue(b.timestamp));
}

export function applyS10TimestampedCommentary(input: {
  report: Record<string, unknown>;
  matrix: BriefAchievementMatrix;
  readiness: ReadinessAndScoreJudgement;
  fixHierarchy: S10FixHierarchy;
  nextActionPlan?: S10NextActionPlan | null;
  professionalCritique: S10ProfessionalCritique;
  techniqueCommentary: S10TechniqueCommentary;
  observedTapeSequence?: ObservedTapeSequence[];
  componentVerifications?: ComponentVerification[];
  timestampedEvidence?: EvidencePass["timestamped_evidence"];
}): {
  commentary: S10TimestampedCommentary;
  warnings: S10TimestampedWarning[];
  projectedCount: number;
} {
  const commentary = normaliseS10TimestampedCommentary({
    commentary: input.report.s10_timestamped_commentary,
    matrix: input.matrix,
    readiness: input.readiness,
    fixHierarchy: input.fixHierarchy,
    nextActionPlan: input.nextActionPlan,
    professionalCritique: input.professionalCritique,
    techniqueCommentary: input.techniqueCommentary,
    observedTapeSequence: input.observedTapeSequence,
    componentVerifications: input.componentVerifications,
    timestampedEvidence: input.timestampedEvidence,
    report: input.report,
  });
  input.report.s10_timestamped_commentary = commentary;

  const locked = safeLockedTimestampedNotes({
    existing: input.report.timestamped_notes,
    timestampedEvidence: input.timestampedEvidence,
    actingMissing: requiredActingMissing(input.matrix),
    songPartial: songPartialOrIncomplete(input.matrix),
  });
  const projected = commentary.projection_notes.map((note) => ({
    timestamp: note.timestamp,
    note: note.note,
  }));
  const seen = new Set<string>();
  input.report.timestamped_notes = [...locked, ...projected]
    .filter((item) => {
      if (!isValidTimestamp(item.timestamp) || !item.note) return false;
      const key = `${item.timestamp}:${normaliseKey(item.note)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => timeSortValue(a.timestamp) - timeSortValue(b.timestamp))
    .slice(0, 36);

  return {
    commentary,
    warnings: commentary.contradiction_warnings,
    projectedCount: projected.length,
  };
}

export function scrubS10TimestampedCommentaryProjection(report: Record<string, unknown>): {
  removed: number;
} {
  let removed = 0;
  const scrub = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (hasForbiddenTimestampedPhrase(value)) {
        removed += 1;
        return "";
      }
      return value;
    }
    if (Array.isArray(value)) {
      const out = value.map(scrub).filter((item) => item !== "" && item !== null);
      removed += value.length - out.length;
      return out;
    }
    if (isRecord(value)) {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        out[key] = scrub(item);
      }
      return out;
    }
    return value;
  };
  for (const key of ["s10_timestamped_commentary", "timestamped_notes"]) {
    if (report[key] !== undefined) report[key] = scrub(report[key]);
  }
  return { removed };
}

export function isForbiddenS10TimestampedCommentaryText(value: string): boolean {
  return hasForbiddenTimestampedPhrase(value);
}
