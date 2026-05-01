// SERVER-ONLY. Deterministic, post-Step-2 quality-control scrubs.
//
// This module is the safety net that runs AFTER Step 2 (or after the legacy
// single-pass) and BEFORE persistence. It does NOT change scores, verdicts,
// caps, level thresholds, weights, rubric meanings, or material-policy logic.
// It only rewrites or removes user-facing text fields when they:
//   1) introduce visual details (e.g. clothing colour) not locked in Step 1
//   2) invent page/line/script/"side" references the system never had
//   3) recommend frame-breaking on-camera movement against a static brief
//   4) use unclear "side" jargon where "scene" reads better
// It also normalises the chronological order / validity of timestamped_notes
// and surfaces a consistency-warning log when this take's score diverges
// from a prior comparable take of the same audition.
//
// All behaviour is deterministic. No LLM calls. No PII in logs.

import type { EvidencePass } from "./evidence-pass.server";
import { isValidTimestamp } from "./evidence-pass.server";

// ---------- Shared helpers ----------

const TS_RE = /^([0-5]?\d):([0-5]\d)$/;

function tsToSeconds(ts: string): number {
  const m = TS_RE.exec(ts);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// ---------- 1) Unsupported visual-detail (colour) scrub ----------

const COLOUR_WORDS = [
  "blue",
  "pink",
  "red",
  "green",
  "yellow",
  "orange",
  "purple",
  "violet",
  "black",
  "white",
  "grey",
  "gray",
  "brown",
  "beige",
  "cream",
  "tan",
  "navy",
  "maroon",
  "burgundy",
  "turquoise",
  "teal",
] as const;

const COLOUR_RE = new RegExp(`\\b(${COLOUR_WORDS.join("|")})\\b`, "i");
const COLOUR_RE_GLOBAL = new RegExp(
  `\\b(${COLOUR_WORDS.join("|")})\\b`,
  "gi",
);

/** Build the set of colour words actually present in locked Step 1 evidence. */
function colourWordsLockedInEvidence(ev: EvidencePass | null): Set<string> {
  const out = new Set<string>();
  if (!ev) return out;
  const lines: string[] = [
    ...(ev.presentation_evidence ?? []),
    ...(ev.core_strengths_evidence ?? []).map((s) => s.evidence ?? ""),
    ...(ev.core_improvements_evidence ?? []).map((s) => s.evidence ?? ""),
    ...(ev.timestamped_evidence ?? []).map(
      (t) => `${t.observation ?? ""} ${t.why_it_matters ?? ""}`,
    ),
  ];
  for (const raw of lines) {
    if (typeof raw !== "string" || !raw) continue;
    const lower = raw.toLowerCase();
    for (const c of COLOUR_WORDS) {
      if (new RegExp(`\\b${c}\\b`).test(lower)) out.add(c);
    }
  }
  return out;
}

const COLOUR_NEUTRAL_REWRITES = [
  "The performer separates clearly from the background.",
  "The framing is clean and easy to read.",
];

// Clothing / wardrobe nouns that, once stripped of an unsupported colour,
// leave a half-edited clothing-specific sentence (e.g. "The top reads well
// on camera."). When any of these survive the colour strip we discard the
// remainder and let the caller substitute a fully neutral camera-readability
// line instead.
const CLOTHING_NOUN_RE =
  /\b(top|tops|shirt|shirts|t[-\s]?shirt|tee|blouse|jumper|sweater|hoodie|jacket|coat|dress|skirt|trousers|pants|jeans|shorts|shoes|trainers|sneakers|boots|hat|cap|scarf|tie|outfit|clothing|clothes|wardrobe|garment|attire)\b/i;

function rewriteColourInString(
  input: string,
  locked: Set<string>,
): { value: string; removed: boolean } {
  if (typeof input !== "string" || input.length === 0) {
    return { value: input, removed: false };
  }
  if (!COLOUR_RE.test(input)) return { value: input, removed: false };
  // If every colour word in the string is locked by evidence, leave it alone.
  const hits = input.toLowerCase().match(COLOUR_RE_GLOBAL) ?? [];
  const unsupported = hits.filter((h) => !locked.has(h.toLowerCase()));
  if (unsupported.length === 0) return { value: input, removed: false };
  // Strip unsupported colour words and clean up "the  top" -> "the top".
  let out = input;
  for (const c of unsupported) {
    out = out.replace(
      new RegExp(`\\b${c}\\b\\s*`, "gi"),
      "",
    );
  }
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  // If a clothing-specific noun survives, the sentence is still wardrobe
  // wording without grounding — drop it entirely so the caller can drop in
  // a fully neutral camera-readability line.
  if (CLOTHING_NOUN_RE.test(out)) return { value: "", removed: true };
  // If the sentence collapsed to almost nothing useful, drop it.
  if (out.length < 12) return { value: "", removed: true };
  return { value: out, removed: true };
}

// ---------- 2) Unsupported source-reference scrub (+ "side" -> "scene") ----------

// Two distinct rewrite categories:
//   - PAGE_REWRITES: page/line/script/book references. Banned when the brief
//     does NOT carry source metadata. When the brief DOES carry source
//     metadata (e.g. "Side 1, pages 85–87"), they may pass through but we
//     still prefer rewriting them to a moment description / timestamp where
//     possible. Rewrites here are logged as `source_reference_rewritten_to_timestamp`.
//   - SIDE_REWRITES: unclear "side" jargon. Always rewritten to clearer
//     wording for the end-user. Logged as `unclear_industry_language_rewritten`.
type Rewrite = { re: RegExp; replacement: string };

const PAGE_REWRITES: Rewrite[] = [
  // page X, on page X, at page X
  { re: /\b(?:on\s+|at\s+)?page\s+\d+\b/gi, replacement: "in the scene" },
  // line X / lines X-Y
  {
    re: /\bline[s]?\s+\d+(?:\s*[-–]\s*\d+)?\b/gi,
    replacement: "in that section",
  },
  // "in the script" / "in the book" / "on the page"
  { re: /\bin\s+the\s+script\b/gi, replacement: "in the scene" },
  { re: /\bin\s+the\s+book\b/gi, replacement: "in the scene" },
  { re: /\bon\s+the\s+page\b/gi, replacement: "in the scene" },
  { re: /\bscript\s+page\b/gi, replacement: "scene section" },
  { re: /\bbook\s+page\b/gi, replacement: "scene section" },
];

const SIDE_REWRITES: Rewrite[] = [
  // "the requested side(s)" -> clearer wording
  {
    re: /\bthe\s+requested\s+sides?\b/gi,
    replacement: "the requested acting scene",
  },
  // "in the side(s)" / "record the side(s)"
  { re: /\bin\s+the\s+sides?\b/gi, replacement: "in the acting section" },
  {
    re: /\brecord\s+the\s+sides?\b/gi,
    replacement: "record the acting scene",
  },
  // "the side and the song" / "the sides"
  { re: /\bthe\s+sides\b/gi, replacement: "the acting scenes" },
  { re: /\bthe\s+side\b/gi, replacement: "the acting scene" },
];

/** Did the brief or extracted brief actually carry source metadata? */
export function briefHasSourceMetadata(opts: {
  briefText: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractedBrief: any | null;
}): boolean {
  const eb = opts.extractedBrief ?? {};
  if (
    typeof eb.sides_url === "string" ||
    typeof eb.sides_text === "string" ||
    typeof eb.script_url === "string" ||
    typeof eb.script_text === "string" ||
    eb.has_sides === true ||
    eb.has_script === true
  ) {
    return true;
  }
  const t = (opts.briefText ?? "").toLowerCase();
  // Conservative: only treat the brief as having source metadata if it
  // explicitly references pages/sides itself.
  return /\bpage\s+\d+\b|\bline\s+\d+\b|\bsides?\b/.test(t);
}

function rewriteSourceRefsInString(
  input: string,
  hasSourceMetadata: boolean,
): { value: string; removed: boolean } {
  if (typeof input !== "string" || input.length === 0) {
    return { value: input, removed: false };
  }
  let out = input;
  let changed = false;
  // Always rewrite "side" -> "scene" (rule 5), regardless of metadata.
  for (const rw of SOURCE_REWRITES) {
    if (
      hasSourceMetadata &&
      // page/line patterns only banned when no metadata
      (rw.re.source.includes("page") || rw.re.source.includes("line"))
    ) {
      continue;
    }
    if (rw.re.test(out)) {
      changed = true;
      out = out.replace(rw.re, rw.replacement);
    }
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  return { value: out, removed: changed };
}

// ---------- 3) Brief-incompatible coaching rewrite ----------

const STATIC_FRAMING_HINTS_RE =
  /\b(head[-\s]?and[-\s]?shoulders|head\s*and\s*shoulders|close[-\s]?up|medium\s+close[-\s]?up|fixed\s+frame|static\s+frame|static\s+framing|self[-\s]?tape\s+framing|camera[-\s]?led)\b/i;

/** Does the brief require a static/head-and-shoulders frame? */
export function briefRequiresStaticFraming(opts: {
  briefText: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractedBrief: any | null;
}): boolean {
  const eb = opts.extractedBrief ?? {};
  const fr = typeof eb.framing_required === "string" ? eb.framing_required : "";
  if (fr && STATIC_FRAMING_HINTS_RE.test(fr)) return true;
  const t = opts.briefText ?? "";
  if (t && STATIC_FRAMING_HINTS_RE.test(t)) return true;
  return false;
}

const FRAME_BREAKING_PATTERNS: RegExp[] = [
  /\bwalk(?:ing)?\s+around\s+the\s+room\b/i,
  /\bmove(?:ing)?\s+around\s+the\s+room\b/i,
  /\bmove(?:ing)?\s+(?:around|about)\b/i,
  /\bcross(?:ing)?\s+the\s+room\b/i,
  /\bpack(?:ing)?\s+a?\s*bag\b/i,
  /\busing\s+props?\b/i,
  /\badd(?:ing)?\s+props?\b/i,
  /\bphysical\s+task\b/i,
  /\brecord(?:ing)?\s+(?:while|whilst)\s+(?:moving|walking)\b/i,
  /\badd(?:ing)?\s+staging\b/i,
  /\bmove\s+out\s+of\s+frame\b/i,
  /\bstep\s+out\s+of\s+frame\b/i,
  /\bleave\s+frame\b/i,
  /\bfull[-\s]?body\s+movement\b/i,
];

const REHEARSAL_LABEL_RE =
  /\b(?:as\s+(?:an?\s+)?off[-\s]?camera\s+rehearsal|rehearsal\s+only|rehearsal[-\s]?only|in\s+rehearsal|off[-\s]?camera\s+drill)\b/i;

const FRAME_SAFE_REWRITES = [
  "Use breath, stillness and eyeline changes inside the frame rather than adding movement.",
  "Find the change of intention through the eyes and the upper body inside the required frame.",
  "Sharpen the moment with a clear thought-shift, keeping the head-and-shoulders frame still.",
];

function rewriteFrameBreakingInString(
  input: string,
  idx: number,
): { value: string; removed: boolean } {
  if (typeof input !== "string" || input.length === 0) {
    return { value: input, removed: false };
  }
  const hasMovement = FRAME_BREAKING_PATTERNS.some((re) => re.test(input));
  if (!hasMovement) return { value: input, removed: false };
  // If the line is already clearly labelled rehearsal-only, leave it.
  if (REHEARSAL_LABEL_RE.test(input)) return { value: input, removed: false };
  // Replace with a frame-safe equivalent.
  const replacement =
    FRAME_SAFE_REWRITES[idx % FRAME_SAFE_REWRITES.length];
  return { value: replacement, removed: true };
}

// ---------- Generic per-field walker for text scrubs ----------

type ScrubCounters = {
  visual: Record<string, number>;
  source: Record<string, number>;
  framing: Record<string, number>;
};

function scrubString(
  field: string,
  s: string,
  ctx: {
    lockedColours: Set<string>;
    hasSourceMetadata: boolean;
    requiresStaticFrame: boolean;
    counters: ScrubCounters;
    framingIdx: { n: number };
  },
): string {
  let out = s;
  // 1) colour
  const c = rewriteColourInString(out, ctx.lockedColours);
  if (c.removed) {
    ctx.counters.visual[field] = (ctx.counters.visual[field] ?? 0) + 1;
    out = c.value;
    if (!out) {
      // Replace empty with a neutral rewrite for visible fields, blank for notes.
      if (field === "presentation_notes") out = COLOUR_NEUTRAL_REWRITES[0];
      else out = "";
    }
  }
  // 2) source / "side"
  const sr = rewriteSourceRefsInString(out, ctx.hasSourceMetadata);
  if (sr.removed) {
    ctx.counters.source[field] = (ctx.counters.source[field] ?? 0) + 1;
    out = sr.value;
  }
  // 3) frame-breaking coaching (only if brief requires static)
  if (ctx.requiresStaticFrame) {
    const fr = rewriteFrameBreakingInString(out, ctx.framingIdx.n);
    if (fr.removed) {
      ctx.counters.framing[field] = (ctx.counters.framing[field] ?? 0) + 1;
      ctx.framingIdx.n += 1;
      out = fr.value;
    }
  }
  return out;
}

function scrubArrayField(
  field: string,
  arr: unknown,
  ctx: Parameters<typeof scrubString>[2],
): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const x of arr) {
    if (typeof x !== "string") continue;
    const v = scrubString(field, x, ctx);
    if (v && v.trim().length > 0) out.push(v.trim());
  }
  return out;
}

// ---------- Timestamp normalisation ----------

export type TimestampNormaliseResult = {
  reordered: boolean;
  dropped: number;
  finalCount: number;
};

export function normaliseTimestampedNotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any,
  durationSeconds: number | null,
): TimestampNormaliseResult {
  if (!Array.isArray(report.timestamped_notes)) {
    report.timestamped_notes = [];
    return { reordered: false, dropped: 0, finalCount: 0 };
  }
  const before = report.timestamped_notes as Array<{
    timestamp?: unknown;
    note?: unknown;
  }>;
  const beforeCount = before.length;
  const seen = new Set<string>();
  const cleaned: Array<{ timestamp: string; note: string }> = [];
  for (const t of before) {
    if (!t || typeof t.timestamp !== "string" || typeof t.note !== "string") {
      continue;
    }
    const ts = t.timestamp.trim();
    const note = t.note.trim();
    if (!note) continue;
    if (!isValidTimestamp(ts, durationSeconds)) continue;
    const key = `${ts}|${note.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ timestamp: ts, note });
  }
  const wasOrder = cleaned.map((c) => c.timestamp);
  cleaned.sort((a, b) => tsToSeconds(a.timestamp) - tsToSeconds(b.timestamp));
  const afterOrder = cleaned.map((c) => c.timestamp);
  const reordered =
    wasOrder.length === afterOrder.length &&
    wasOrder.some((v, i) => v !== afterOrder[i]);
  const capped = cleaned.slice(0, 8);
  report.timestamped_notes = capped;
  return {
    reordered,
    dropped: Math.max(0, beforeCount - capped.length),
    finalCount: capped.length,
  };
}

// ---------- Top-level scrub entry point ----------

export type ReportQualityScrubResult = {
  visual_removed_per_field: Record<string, number>;
  source_removed_per_field: Record<string, number>;
  framing_rewritten_per_field: Record<string, number>;
  visual_total: number;
  source_total: number;
  framing_total: number;
};

/**
 * Run all deterministic post-Step-2 scrubs over the user-facing report
 * fields. Mutates `report` in place. Returns counts for logging.
 *
 * Does NOT touch: scores, overall_score, verdict_final, block_reasons,
 * audition_type, detected_components, raw scores, role_fit_modifier,
 * compliance_flags, score_breakdown.
 */
export function scrubReportQuality(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any;
  evidence: EvidencePass | null;
  briefText: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractedBrief: any | null;
}): ReportQualityScrubResult {
  const { report, evidence } = opts;

  const lockedColours = colourWordsLockedInEvidence(evidence);
  const hasSourceMetadata = briefHasSourceMetadata({
    briefText: opts.briefText,
    extractedBrief: opts.extractedBrief,
  });
  const requiresStaticFrame = briefRequiresStaticFraming({
    briefText: opts.briefText,
    extractedBrief: opts.extractedBrief,
  });

  const counters: ScrubCounters = { visual: {}, source: {}, framing: {} };
  const framingIdx = { n: 0 };
  const ctx = {
    lockedColours,
    hasSourceMetadata,
    requiresStaticFrame,
    counters,
    framingIdx,
  };

  // Scalar string fields
  for (const field of [
    "casting_headline",
    "casting_insight",
    "fix_first",
    "role_fit_notes",
  ] as const) {
    if (typeof report[field] === "string") {
      report[field] = scrubString(field, report[field], ctx);
    }
  }

  // Array-of-string fields
  for (const field of [
    "strengths",
    "improvements",
    "coaching_drills",
    "presentation_notes",
    "next_take_plan",
  ] as const) {
    if (Array.isArray(report[field])) {
      report[field] = scrubArrayField(field, report[field], ctx);
    }
  }

  // category_notes (object of strings)
  if (report.category_notes && typeof report.category_notes === "object") {
    const cn = report.category_notes as Record<string, unknown>;
    for (const key of Object.keys(cn)) {
      if (typeof cn[key] === "string") {
        cn[key] = scrubString(`category_notes.${key}`, cn[key] as string, ctx);
      }
    }
  }

  // brief_adherence_breakdown.note
  if (
    report.brief_adherence_breakdown &&
    typeof report.brief_adherence_breakdown === "object" &&
    typeof report.brief_adherence_breakdown.note === "string"
  ) {
    report.brief_adherence_breakdown.note = scrubString(
      "brief_adherence_breakdown.note",
      report.brief_adherence_breakdown.note,
      ctx,
    );
  }

  // timestamped_notes (only string scrubs; ordering is handled separately)
  if (Array.isArray(report.timestamped_notes)) {
    report.timestamped_notes = report.timestamped_notes
      .map((t: { timestamp?: unknown; note?: unknown }) => {
        if (!t || typeof t.note !== "string") return t;
        const v = scrubString("timestamped_notes", t.note, ctx);
        return { ...t, note: v };
      })
      .filter(
        (t: { note?: unknown }) =>
          typeof t?.note === "string" && (t.note as string).trim().length > 0,
      );
  }

  // submission_risk_flags (.flag) and casting_risk_explanations (.casting_impact)
  if (Array.isArray(report.submission_risk_flags)) {
    report.submission_risk_flags = report.submission_risk_flags.map(
      (rf: { severity?: string; flag?: unknown }) => {
        if (rf && typeof rf.flag === "string") {
          return { ...rf, flag: scrubString("submission_risk_flags", rf.flag, ctx) };
        }
        return rf;
      },
    );
  }
  if (Array.isArray(report.casting_risk_explanations)) {
    report.casting_risk_explanations = report.casting_risk_explanations.map(
      (e: { flag?: unknown; casting_impact?: unknown; recall_impact?: unknown }) => {
        const out = { ...e };
        if (typeof e.flag === "string") {
          out.flag = scrubString("casting_risk_explanations.flag", e.flag, ctx);
        }
        if (typeof e.casting_impact === "string") {
          out.casting_impact = scrubString(
            "casting_risk_explanations.casting_impact",
            e.casting_impact,
            ctx,
          );
        }
        return out;
      },
    );
  }

  const sumValues = (o: Record<string, number>) =>
    Object.values(o).reduce((a, b) => a + b, 0);

  return {
    visual_removed_per_field: counters.visual,
    source_removed_per_field: counters.source,
    framing_rewritten_per_field: counters.framing,
    visual_total: sumValues(counters.visual),
    source_total: sumValues(counters.source),
    framing_total: sumValues(counters.framing),
  };
}

// ---------- 6) Same-video score-stability comparison ----------

export type ConsistencyComparisonInput = {
  currentTakeId: string;
  currentOverall: number;
  currentVerdict: string;
  currentScores: Record<string, number | null | undefined>;
  currentRoleFitModifier: number;
  currentTimestampCount: number;
  previous: {
    take_id: string;
    overall: number;
    verdict: string;
    scores: Record<string, number | null | undefined>;
    role_fit_modifier: number;
    timestamp_count: number;
  } | null;
};

export type ConsistencyWarning = {
  emit: boolean;
  final_score_delta: number;
  verdict_changed: boolean;
  category_delta_summary: Record<string, number>;
  timestamp_count_delta: number;
  role_fit_modifier_delta: number;
};

/**
 * Compute deltas vs the previous comparable take, if any. Caller decides
 * whether to log analysis_consistency_warning. Does NOT mutate the report.
 */
export function computeConsistencyWarning(
  input: ConsistencyComparisonInput,
): ConsistencyWarning {
  const prev = input.previous;
  if (!prev) {
    return {
      emit: false,
      final_score_delta: 0,
      verdict_changed: false,
      category_delta_summary: {},
      timestamp_count_delta: 0,
      role_fit_modifier_delta: 0,
    };
  }
  const final_score_delta = Math.abs(input.currentOverall - prev.overall);
  const verdict_changed = input.currentVerdict !== prev.verdict;
  const category_delta_summary: Record<string, number> = {};
  const keys = new Set<string>([
    ...Object.keys(input.currentScores ?? {}),
    ...Object.keys(prev.scores ?? {}),
  ]);
  for (const k of keys) {
    const a = Number(input.currentScores?.[k] ?? NaN);
    const b = Number(prev.scores?.[k] ?? NaN);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      category_delta_summary[k] = Math.abs(a - b);
    }
  }
  const timestamp_count_delta =
    input.currentTimestampCount - prev.timestamp_count;
  const role_fit_modifier_delta = Math.abs(
    input.currentRoleFitModifier - prev.role_fit_modifier,
  );
  const emit = final_score_delta > 3 || verdict_changed;
  return {
    emit,
    final_score_delta,
    verdict_changed,
    category_delta_summary,
    timestamp_count_delta,
    role_fit_modifier_delta,
  };
}

// ---------- Timestamp evidence target by duration ----------

export function timestampTargetMin(
  durationSeconds: number | null | undefined,
): number {
  if (!durationSeconds || !Number.isFinite(durationSeconds)) return 0;
  if (durationSeconds < 60) return 3;
  if (durationSeconds <= 180) return 5;
  if (durationSeconds <= 300) return 5; // 3–5 min: minimum 5 if assessable
  return 5;
}
