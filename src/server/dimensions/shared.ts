// SERVER-ONLY. Phase 1 internal evidence dimensions.
//
// Shared anchor + assessability model and validators. No public exposure:
// nothing here is written to `takes.report`, `take_qa_traces`, the
// renderer, or any user-visible surface. Discarded after the Step 1 log.

import { isValidTimestamp } from "../evidence-pass.server";

export type DimensionConfidence = "low" | "medium" | "high";

export type AnchorKind =
  | "timestamp"
  | "component_note"
  | "brief"
  | "audio_observation"
  | "visual_observation"
  | "movement_observation"
  | "copy_observation"
  | "lyric_observation"
  | "reader_observation"
  | "camera_observation";

const ANCHOR_KINDS: ReadonlySet<AnchorKind> = new Set([
  "timestamp",
  "component_note",
  "brief",
  "audio_observation",
  "visual_observation",
  "movement_observation",
  "copy_observation",
  "lyric_observation",
  "reader_observation",
  "camera_observation",
]);

const CONFIDENCES: ReadonlySet<DimensionConfidence> = new Set([
  "low",
  "medium",
  "high",
]);

export interface EvidenceAnchor {
  id: string;
  timestamp?: string | null;
  kind: AnchorKind;
  note: string;
  supports: string[];
}

export interface DimensionClaim {
  value: unknown | null;
  confidence: DimensionConfidence;
  supports: string[]; // anchor ids
}

export interface ComponentAssessability {
  video_assessable?: boolean;
  audio_assessable?: boolean;
  brief_assessable?: boolean;
  component_assessable?: boolean;
  visibility?: "low" | "medium" | "high";
  audio_balance?: "low" | "medium" | "high";
  evidence_density?: "low" | "medium" | "high";
  notes?: string;
}

export interface FutureComponent {
  type: string;
  start: string | null;
  end: string | null;
  confidence: DimensionConfidence;
  assessability: ComponentAssessability;
  subtype?: string | null;
  style?: string | null;
  form?: string | null;
  dimensions: Record<string, DimensionClaim | null>;
  evidence_anchors: EvidenceAnchor[];
}

const NOTE_MAX = 240;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Validate a single anchor against the discipline's allowed dimension keys. */
export function validateAnchor(
  raw: unknown,
  allowedDimensionKeys: ReadonlySet<string>,
  durationSeconds?: number | null,
): EvidenceAnchor | null {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : null;
  const kind = typeof raw.kind === "string" ? (raw.kind as AnchorKind) : null;
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  const supports = Array.isArray(raw.supports)
    ? raw.supports.filter(
        (k): k is string => typeof k === "string" && allowedDimensionKeys.has(k),
      )
    : [];
  if (!id || !kind || !ANCHOR_KINDS.has(kind)) return null;
  if (!note || note.length > NOTE_MAX) return null;
  if (supports.length === 0) return null;
  let timestamp: string | null = null;
  if (raw.timestamp == null) {
    timestamp = null;
  } else if (
    typeof raw.timestamp === "string" &&
    isValidTimestamp(raw.timestamp, durationSeconds)
  ) {
    timestamp = raw.timestamp;
  } else if (typeof raw.timestamp === "string") {
    return null; // bad timestamp → drop the anchor
  }
  return { id, kind, note, supports, timestamp };
}

/** Validate a single dimension claim. Returns null when malformed/unsupported. */
export function validateClaim(
  raw: unknown,
  anchorIds: ReadonlySet<string>,
): DimensionClaim | null {
  if (raw === null) return null;
  if (!isObj(raw)) return null;
  const confidence =
    typeof raw.confidence === "string" &&
    CONFIDENCES.has(raw.confidence as DimensionConfidence)
      ? (raw.confidence as DimensionConfidence)
      : "low";
  const supports = Array.isArray(raw.supports)
    ? raw.supports.filter(
        (id): id is string => typeof id === "string" && anchorIds.has(id),
      )
    : [];
  // value === null with no supports is permitted (unknown/not-assessable).
  if (raw.value == null) {
    return { value: null, confidence, supports };
  }
  // populated claim MUST have at least one supporting anchor
  if (supports.length === 0) return null;
  return { value: raw.value, confidence, supports };
}

/** Validate one component against a discipline definition. Returns null to drop. */
export function validateComponent(
  raw: unknown,
  allowedDimensionKeys: ReadonlySet<string>,
  durationSeconds?: number | null,
): FutureComponent | null {
  if (!isObj(raw)) return null;
  const type = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim() : null;
  if (!type) return null;
  const confidence =
    typeof raw.confidence === "string" &&
    CONFIDENCES.has(raw.confidence as DimensionConfidence)
      ? (raw.confidence as DimensionConfidence)
      : "low";

  const start =
    typeof raw.start === "string" && isValidTimestamp(raw.start, durationSeconds)
      ? raw.start
      : null;
  const end =
    typeof raw.end === "string" && isValidTimestamp(raw.end, durationSeconds)
      ? raw.end
      : null;

  const anchorsRaw = Array.isArray(raw.evidence_anchors) ? raw.evidence_anchors : [];
  const evidence_anchors = anchorsRaw
    .map((a) => validateAnchor(a, allowedDimensionKeys, durationSeconds))
    .filter((a): a is EvidenceAnchor => !!a);
  const anchorIds = new Set(evidence_anchors.map((a) => a.id));

  const dimsRaw = isObj(raw.dimensions) ? raw.dimensions : {};
  const dimensions: Record<string, DimensionClaim | null> = {};
  for (const key of allowedDimensionKeys) {
    if (!(key in dimsRaw)) continue;
    dimensions[key] = validateClaim(dimsRaw[key], anchorIds);
  }

  const assessability: ComponentAssessability = isObj(raw.assessability)
    ? (raw.assessability as ComponentAssessability)
    : {};

  return {
    type,
    start,
    end,
    confidence,
    assessability,
    subtype:
      typeof raw.subtype === "string" || raw.subtype === null
        ? (raw.subtype as string | null)
        : null,
    style:
      typeof raw.style === "string" || raw.style === null
        ? (raw.style as string | null)
        : null,
    form:
      typeof raw.form === "string" || raw.form === null
        ? (raw.form as string | null)
        : null,
    dimensions,
    evidence_anchors,
  };
}

/** Shared prompt fragment header — applied once when flag is on. */
export const SHARED_PROMPT_FRAGMENT = `
FUTURE COMPONENT EVIDENCE (internal, observation-only):
- For each detected component, you MAY emit a future_component entry with discipline-specific dimensions.
- Every populated dimension claim MUST cite at least one supporting evidence_anchor by id. Anchors carry a kind, an optional MM:SS timestamp within the tape, and a short observation-only note.
- Use null / unknown for any dimension you cannot anchor in the tape. Do NOT guess.
- Do NOT infer hidden intent, diagnosis, response to direction, recall readiness, live-room flexibility, marketability, bookability, appearance, social profile, or access/resource deficits.
- Do NOT invent role, world, brand, product, audience, or buyer fit when no brief is supplied.
- Do NOT comment on protected traits.
- Style/subtype labels are optional; prefer null over a guess.
- This block is INTERNAL. It does not affect public scores or wording.
`.trim();
