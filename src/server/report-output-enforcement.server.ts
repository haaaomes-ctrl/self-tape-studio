// SERVER-ONLY. Phase 3C P0 deterministic output-quality enforcement.
//
// Runs after Step 2 / report-quality scrubs and before v1 persistence and
// the v2 builder. Cleans user-facing prose only. Never touches scores,
// overall score, verdict labels, role-fit modifier, score_breakdown,
// schema_version, or any private/internal field. Pure (clones the input).

export interface EnforcementContext {
  mode: "brief" | "baseline";
  auditionType: string | null | undefined;
  framingFixed: boolean;
  materialPolicy?: "fixed" | "choice" | "none";
}

export interface EnforcementCounters {
  castability_removed: number;
  castability_rewritten: number;
  generic_unanchored_removed: number;
  brief_overconfidence_rewritten: number;
  presentation_polish_removed: number;
  framing_rehearsal_rewritten: number;
  dance_visibility_unanchored_removed: number;
  submission_risk_demoted: number;
  category_rationale_scrubbed: number;
  category_rationale_dropped: number;
  category_rationale_missing_delta: number;
  next_take_plan_scrubbed: number;
  priority_fixes_scrubbed: number;
  component_fields_scrubbed: number;
}

// ---------------------------------------------------------------------------
// Phrase banks
// ---------------------------------------------------------------------------

// Phase 3C P2: phrase-level rewrite map applied BEFORE sentence-level
// castability filtering. Rewrites soft overclaims to neutral wording so
// information survives. Hard overclaims still drop via CASTABILITY_TRIGGERS.
const CALIBRATION_REWRITES: Array<[RegExp, string]> = [
  [/\bhighly\s+castable\b/gi, "well aligned with the supplied brief"],
  [/\bstrong\s+contender\b/gi, "a strong tape for the stated task"],
  [/\bcallback[-\s]?ready\b/gi, "ready to submit"],
  [/\brecall[-\s]?worthy\b/gi, "ready to submit"],
  [/\bworkshop[-\s]?ready\b/gi, "ready to submit"],
  [/\bperfectly\s+captures\b/gi, "clearly supports"],
  [
    /\bexactly\s+what\s+(?:they(?:'|’)?re|the\s+team\s+is|they\s+are)\s+looking\s+for\b/gi,
    "matches the stated style/task requirements",
  ],
  [/\bperfect\s+fit\b/gi, "a strong fit for the stated task"],
];

// Castability / callback / recall / workshop overclaim — sentences matching
// these (after rewrite) are dropped entirely.
const CASTABILITY_TRIGGERS = [
  /highly\s+castable/i,
  /\bcastable\s+for\b/i,
  /\bbookable\b/i,
  /\bbookability\b/i,
  /\bmarketable\b/i,
  /\bmarketability\b/i,
  /\bcommercial\s+look\b/i,
  /\bstrong\s+contender\b/i,
  /\bperfect\s+fit\b/i,
  /\bexactly\s+what\s+they(?:'|’)?re\s+looking\s+for\b/i,
  /\bcallback[-\s]?ready\b/i,
  /\brecall[-\s]?worthy\b/i,
  /\bwould\s+(?:get|be)\s+(?:a\s+)?recall\b/i,
  /\bstrong\s+callback\s+potential\b/i,
  /\bworkshop[-\s]?ready\b/i,
  /\bdevelopment[-\s]workshop\s+ready\b/i,
  /\blikely\s+to\s+(?:progress|be\s+recalled)\b/i,
  /\bwould\s+be\s+called\s+back\b/i,
  /\b(?:buyer|brand|market)\s+fit\b/i,
];

// Standout-delta wording that must never claim perfection.
const STANDOUT_OVERCLAIM_RE =
  /\b(?:perfect(?:ly)?|flawless(?:\s+adherence)?|all\s+requirements\s+met)\b/i;

// Generic / unanchored phrases (sentence kept ONLY if anchored).
const GENERIC_TRIGGERS = [
  /\bstrong\s+vocal(?:s|\s+performance|\s+control)?\b/i,
  /\bstrong\s+acting\b/i,
  /\bstrong\s+presence\b/i,
  /\bstrong\s+choices\b/i,
  /\bstrong\s+instincts\b/i,
  /\bgrounded(?:\s+acting)?\b/i,
  /\bnatural(?:istic\s+delivery)?\b/i,
  /\bbelievable\b/i,
  /\bauthentic\b/i,
  /\b(?:emotionally\s+)?connected\b/i,
  /\b(?:clear\s+)?character\s+warmth\b/i,
  /\bcaptures\s+warmth\s+and\s+wit\b/i,
  /\bgood\s+energy\b/i,
  /\btechnically\s+(?:excellent|polished)\b/i,
  /\bhighly\s+professional\b/i,
  /\bpolished\b/i,
  /\bprofessional\s+tape\b/i,
  /\b(?:excellent|good)\s+technique\b/i,
  /\b(?:lovely|clear)\s+tone\b/i,
  /\bvocal\s+range\b/i,
  /\b(?:good|excellent)\s+breath\s+control\b/i,
  /\btonal\s+consistency\b/i,
  /\bscreen[-\s]ready\b/i,
  /\bdevelopment[-\s]ready\b/i,
  /\bprofessional\s+poise\b/i,
];

// Anchor tokens that justify a generic sentence
const ANCHOR_RE =
  /\b\d{1,2}:\d{2}\b|\b(?:lyric|line|phrase|beat|verse|bridge|chorus|reader|reaction|breath|diction|register|transition|consonant|eyeline|thought\s+shift|intention)\b/i;

// Brief-adherence overconfidence
const BRIEF_OVERCONFIDENT_PATTERNS: Array<[RegExp, string]> = [
  [/\bperfect(?:ly)?\s+adherence\b[^.!?]*[.!?]?/gi, ""],
  [/\bperfectly\s+aligned\b[^.!?]*[.!?]?/gi, ""],
  [
    /\ball\s+(?:specific\s+)?brief\s+requirements?\s+(?:were|are)\s+met\s+(?:precisely|fully|exactly)\b[^.!?]*[.!?]?/gi,
    "",
  ],
  [/\bevery\s+instruction\s+was\s+met\b[^.!?]*[.!?]?/gi, ""],
  [/\bflawless\s+(?:adherence|compliance)\b[^.!?]*[.!?]?/gi, ""],
  [/\bstrict\s+adherence\s+to\s+all\b[^.!?]*[.!?]?/gi, ""],
  [/\bfull\s+marks\s+for\s+adherence\b[^.!?]*[.!?]?/gi, ""],
  [/\bspot\s+on\b[^.!?]*[.!?]?/gi, ""],
  [/\bexactly\s+what\s+was\s+requested\b[^.!?]*[.!?]?/gi, ""],
];
const BRIEF_REPLACEMENT =
  "The submitted material appears consistent with the supplied brief.";

// Presentation polish/wardrobe/equipment
const PRESENTATION_POLISH_TRIGGERS = [
  /\bhighly\s+professional\s+tape\b/i,
  /\bpolished\s+tape\b/i,
  /\btechnically\s+polished\b/i,
  /\bprofessional\s+standard\b/i,
  /\bhigh\s+production\s+value\b/i,
  /\bstudio[-\s]quality\b/i,
  /\bexpensive\s+equipment\b/i,
  /\bpaid\s+(?:reader|accompanist|coaching|coach|editor|editing)\b/i,
  /\bwell[-\s]lit\b/i,
  /\bneutral\s+background\b/i,
  /\bno\s+(?:visual\s+)?distractions?\b/i,
  /\bsolid\s+colour(?:\s+of\s+your\s+top)?\b/i,
  /\bclean\s+package\b/i,
  /\bprofessional\s+look\b/i,
];

// Frame-breaking recorded-take advice (only triggered when framingFixed)
const FRAME_BREAK_TRIGGERS = [
  /\bwalking\b/i,
  /\bstand(?:ing)?\s+to\s+record\b/i,
  /\b(?:moving|move|moves|walk|walks)\s+(?:around|across)\s+(?:the\s+)?room\b/i,
  /\bhold(?:ing)?\s+(?:a|an|the)\s+(?:instrument|prop|guitar|chair|script)\b/i,
  /\b(?:use|uses|using|work\s+with)\s+(?:a\s+)?props?\b/i,
  /\bphysical\s+business\b/i,
  /\b(?:cross|crosses|crossing)\s+the\s+room\b/i,
  /\bstep(?:ping)?\s+out\s+of\s+frame\b/i,
  /\badd(?:ing)?\s+(?:staging|blocking)\b/i,
  /\brecord(?:ing)?\s+while\s+moving\b/i,
  /\bsit(?:ting)?\s+on\s+(?:your|my|their)\s+hands\b/i,
  /\bwork\s+it\s+physically\b/i,
];

const REHEARSAL_SUFFIX =
  " For the recorded take, keep the head-and-shoulders frame and use breath, stillness, eyeline and thought shifts to carry the same intention.";

// Visibility / cropping claims (Dance + general). When these appear without a
// timestamp anchor in the same sentence, the claim is removed — it is too
// often hallucinated from generic self-tape framing heuristics.
const VISIBILITY_CLAIM_RE =
  /\b(?:feet\s+(?:are|appear)\s+(?:cut\s+off|cropped)|footwork\s+(?:is\s+)?(?:obscured|cropped|cut\s+off|not\s+visible)|full[-\s]body\s+(?:not|is\s+not)\s+visible|out\s+of\s+frame|cropped\s+at\s+(?:the\s+)?(?:waist|knee|ankle|feet)|frame\s+cuts\s+(?:off\s+)?(?:the\s+)?(?:feet|legs|footwork))\b/i;

// Risk flag labels that must NOT survive as submission risks unless the report
// also carries a timestamped, anchored visibility/lighting observation. These
// are craft notes, not casting-compliance failures.
const SOFT_RISK_LABEL_RE =
  /\b(?:obscured\s+footwork|footwork\s+visibility|low\s+lighting|underexposure|dim\s+lighting|frame\s+(?:too\s+)?(?:tight|wide))\b/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitSentences(text: string): string[] {
  // Keep terminators by capturing groups; fallback to whole string.
  const parts = text.match(/[^.!?]+[.!?]?/g);
  return parts ? parts.map((s) => s.trim()).filter((s) => s.length > 0) : [];
}

function isCastabilitySentence(s: string): boolean {
  return CASTABILITY_TRIGGERS.some((re) => re.test(s));
}

function isGenericSentence(s: string): boolean {
  return GENERIC_TRIGGERS.some((re) => re.test(s));
}

function isPolishSentence(s: string): boolean {
  return PRESENTATION_POLISH_TRIGGERS.some((re) => re.test(s));
}

function isFrameBreakSentence(s: string): boolean {
  return FRAME_BREAK_TRIGGERS.some((re) => re.test(s));
}

function hasAnchor(s: string): boolean {
  return ANCHOR_RE.test(s);
}

interface FieldResult {
  text: string;
  castabilityRemoved: number;
  genericRemoved: number;
  polishRemoved: number;
}

function cleanProse(
  text: string,
  opts: { allowGeneric?: boolean; presentationField?: boolean } = {},
): FieldResult {
  if (!text || typeof text !== "string") {
    return { text: "", castabilityRemoved: 0, genericRemoved: 0, polishRemoved: 0 };
  }
  let castabilityRemoved = 0;
  let genericRemoved = 0;
  let polishRemoved = 0;
  const sentences = splitSentences(text);
  const kept: string[] = [];
  for (const sRaw of sentences) {
    const s = sRaw;
    if (isCastabilitySentence(s)) {
      castabilityRemoved++;
      continue;
    }
    if (opts.presentationField && isPolishSentence(s)) {
      polishRemoved++;
      continue;
    }
    if (!opts.allowGeneric && isGenericSentence(s) && !hasAnchor(s)) {
      genericRemoved++;
      continue;
    }
    kept.push(s);
  }
  let out = kept.join(" ").replace(/\s{2,}/g, " ").trim();
  // Brief-adherence overconfidence rewrite (always runs across all prose).
  for (const [re] of BRIEF_OVERCONFIDENT_PATTERNS) {
    out = out.replace(re, "");
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  return { text: out, castabilityRemoved, genericRemoved, polishRemoved };
}

function rewriteFrameBreak(text: string): { text: string; rewrites: number } {
  if (!text || typeof text !== "string") return { text: "", rewrites: 0 };
  const sentences = splitSentences(text);
  let rewrites = 0;
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    // Idempotence: if this sentence already starts with "Rehearsal-only:",
    // it has been processed in a prior pass — leave the rewrite intact.
    if (/^Rehearsal-only:/i.test(s)) {
      out.push(s);
      continue;
    }
    if (isFrameBreakSentence(s)) {
      rewrites++;
      out.push(`Rehearsal-only: ${s}${REHEARSAL_SUFFIX}`);
    } else {
      out.push(s);
    }
  }
  return { text: out.join(" ").replace(/\s{2,}/g, " ").trim(), rewrites };
}

function countBriefRewrites(text: string): number {
  if (!text || typeof text !== "string") return 0;
  let n = 0;
  for (const [re] of BRIEF_OVERCONFIDENT_PATTERNS) {
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function enforcePublicReportOutputQuality(
  input: Record<string, unknown> | null | undefined,
  ctx: EnforcementContext,
): {
  report: Record<string, unknown>;
  counters: EnforcementCounters;
} {
  const counters: EnforcementCounters = {
    castability_removed: 0,
    generic_unanchored_removed: 0,
    brief_overconfidence_rewritten: 0,
    presentation_polish_removed: 0,
    framing_rehearsal_rewritten: 0,
    dance_visibility_unanchored_removed: 0,
    submission_risk_demoted: 0,
  };
  if (!input || typeof input !== "object") {
    return { report: (input ?? {}) as Record<string, unknown>, counters };
  }
  // Deep clone via structuredClone (Workers + Node 18+).
  const r = structuredClone(input) as Record<string, unknown>;

  const tally = (res: FieldResult, raw: string) => {
    counters.castability_removed += res.castabilityRemoved;
    counters.generic_unanchored_removed += res.genericRemoved;
    counters.presentation_polish_removed += res.polishRemoved;
    counters.brief_overconfidence_rewritten += countBriefRewrites(raw);
  };

  const cleanString = (
    raw: unknown,
    opts: { presentationField?: boolean } = {},
  ): string | null => {
    if (typeof raw !== "string") return null;
    const res = cleanProse(raw, opts);
    tally(res, raw);
    return res.text;
  };

  // Top-level prose fields
  for (const key of [
    "casting_headline",
    "headline",
    "casting_insight",
    "insight",
    "role_fit_notes",
    "role_fit",
  ]) {
    if (typeof r[key] === "string") {
      const cleaned = cleanString(r[key]);
      if (cleaned !== null) r[key] = cleaned;
    }
  }

  // Strengths / improvements / casting risk explanations / presentation_notes
  const cleanStringArr = (
    arr: unknown,
    opts: { presentationField?: boolean } = {},
  ): unknown[] => {
    if (!Array.isArray(arr)) return [];
    const out: unknown[] = [];
    for (const item of arr) {
      if (typeof item === "string") {
        const cleaned = cleanString(item, opts);
        if (cleaned && cleaned.trim().length > 0) out.push(cleaned);
      } else if (item && typeof item === "object") {
        const obj = { ...(item as Record<string, unknown>) };
        for (const k of ["point", "evidence", "note"]) {
          if (typeof obj[k] === "string") {
            const cleaned = cleanString(obj[k], opts);
            obj[k] = cleaned ?? "";
          }
        }
        const point = typeof obj.point === "string" ? obj.point.trim() : "";
        const note = typeof obj.note === "string" ? obj.note.trim() : "";
        if (point.length > 0 || note.length > 0) out.push(obj);
      }
    }
    return out;
  };

  if (Array.isArray(r.strengths)) r.strengths = cleanStringArr(r.strengths);
  if (Array.isArray(r.improvements)) r.improvements = cleanStringArr(r.improvements);
  if (Array.isArray(r.casting_risk_explanations))
    r.casting_risk_explanations = cleanStringArr(r.casting_risk_explanations);
  if (Array.isArray(r.presentation_notes))
    r.presentation_notes = cleanStringArr(r.presentation_notes, {
      presentationField: true,
    });

  // fix_first object
  if (r.fix_first && typeof r.fix_first === "object" && !Array.isArray(r.fix_first)) {
    const ff = { ...(r.fix_first as Record<string, unknown>) };
    for (const k of ["headline", "why_now"]) {
      if (typeof ff[k] === "string") {
        const cleaned = cleanString(ff[k]);
        ff[k] = cleaned ?? "";
      }
    }
    r.fix_first = ff;
  } else if (typeof r.fix_first === "string") {
    const cleaned = cleanString(r.fix_first);
    if (cleaned !== null) r.fix_first = cleaned;
  }

  // category_notes — special handling for professional_presentation
  if (r.category_notes && typeof r.category_notes === "object") {
    const cn = { ...(r.category_notes as Record<string, unknown>) };
    for (const [k, v] of Object.entries(cn)) {
      if (typeof v !== "string") continue;
      const isPresentation = k === "professional_presentation";
      const cleaned = cleanString(v, { presentationField: isPresentation });
      cn[k] = cleaned ?? "";
      if (isPresentation && (!cn[k] || (cn[k] as string).trim().length === 0)) {
        cn[k] = "This affects readability, not talent.";
      }
    }
    r.category_notes = cn;
  }

  // timestamped_notes[].note — preserve all (timestamps act as anchor)
  if (Array.isArray(r.timestamped_notes)) {
    r.timestamped_notes = (r.timestamped_notes as unknown[])
      .map((n) => {
        if (!n || typeof n !== "object") return n;
        const obj = { ...(n as Record<string, unknown>) };
        if (typeof obj.note === "string") {
          // Timestamped notes inherently have an anchor; allow generic phrasing
          // but still strip castability and brief-overconfidence.
          const res = cleanProse(obj.note, { allowGeneric: true });
          tally(res, obj.note);
          obj.note = res.text;
          if (ctx.framingFixed) {
            const fr = rewriteFrameBreak(obj.note as string);
            counters.framing_rehearsal_rewritten += fr.rewrites;
            obj.note = fr.text;
          }
        }
        return obj;
      })
      .filter((n) => {
        if (!n || typeof n !== "object") return false;
        const note = (n as Record<string, unknown>).note;
        return typeof note === "string" && note.trim().length > 0;
      });
  }

  // next_take_plan.steps[] and coaching_drills[]
  const cleanSteps = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const item of arr) {
      if (typeof item !== "string") continue;
      const cleaned = cleanString(item);
      let text = cleaned ?? "";
      if (ctx.framingFixed && text) {
        const fr = rewriteFrameBreak(text);
        counters.framing_rehearsal_rewritten += fr.rewrites;
        text = fr.text;
      }
      if (text.trim().length > 0) out.push(text);
    }
    return out;
  };

  if (r.next_take_plan && typeof r.next_take_plan === "object" && !Array.isArray(r.next_take_plan)) {
    const ntp = { ...(r.next_take_plan as Record<string, unknown>) };
    if (Array.isArray(ntp.steps)) ntp.steps = cleanSteps(ntp.steps);
    r.next_take_plan = ntp;
  }
  if (Array.isArray(r.coaching_drills)) r.coaching_drills = cleanSteps(r.coaching_drills);

  // Apply framing rewrite to improvements/strengths text fields too
  if (ctx.framingFixed) {
    const applyFraming = (arr: unknown): unknown => {
      if (!Array.isArray(arr)) return arr;
      return arr.map((item) => {
        if (typeof item === "string") {
          const fr = rewriteFrameBreak(item);
          counters.framing_rehearsal_rewritten += fr.rewrites;
          return fr.text;
        }
        if (item && typeof item === "object") {
          const obj = { ...(item as Record<string, unknown>) };
          for (const k of ["point", "note"]) {
            if (typeof obj[k] === "string") {
              const fr = rewriteFrameBreak(obj[k] as string);
              counters.framing_rehearsal_rewritten += fr.rewrites;
              obj[k] = fr.text;
            }
          }
          return obj;
        }
        return item;
      });
    };
    r.improvements = applyFraming(r.improvements);
    if (r.fix_first && typeof r.fix_first === "object") {
      const ff = { ...(r.fix_first as Record<string, unknown>) };
      for (const k of ["headline", "why_now"]) {
        if (typeof ff[k] === "string") {
          const fr = rewriteFrameBreak(ff[k] as string);
          counters.framing_rehearsal_rewritten += fr.rewrites;
          ff[k] = fr.text;
        }
      }
      r.fix_first = ff;
    }
  }

  // detected_components[].note
  if (Array.isArray(r.detected_components)) {
    r.detected_components = (r.detected_components as unknown[]).map((c) => {
      if (!c || typeof c !== "object") return c;
      const obj = { ...(c as Record<string, unknown>) };
      if (typeof obj.note === "string") {
        const cleaned = cleanString(obj.note);
        obj.note = cleaned ?? "";
      }
      return obj;
    });
  }

  // submission_verdict.reason
  if (r.submission_verdict && typeof r.submission_verdict === "object") {
    const sv = { ...(r.submission_verdict as Record<string, unknown>) };
    if (typeof sv.reason === "string") {
      const cleaned = cleanString(sv.reason);
      sv.reason = cleaned ?? "";
    }
    r.submission_verdict = sv;
  }

  // Apply BRIEF_REPLACEMENT once if brief overconfidence rewrites cleared
  // category_notes.brief_adherence completely.
  if (
    counters.brief_overconfidence_rewritten > 0 &&
    r.category_notes &&
    typeof r.category_notes === "object"
  ) {
    const cn = r.category_notes as Record<string, unknown>;
    if (
      typeof cn.brief_adherence === "string" &&
      cn.brief_adherence.trim().length === 0
    ) {
      cn.brief_adherence = BRIEF_REPLACEMENT;
    }
  }

  // -------------------------------------------------------------------------
  // Visibility / cropping claim guard.
  //
  // A claim like "feet are cut off" or "footwork is obscured" is only kept
  // when it is anchored to a real timestamped observation. If the report has
  // NO timestamped note that describes visibility/cropping/lighting, then
  // any unanchored cropping/visibility claim elsewhere in the report is
  // removed, and matching submission_risk_flags are demoted.
  // -------------------------------------------------------------------------
  const tsNotes = Array.isArray(r.timestamped_notes)
    ? (r.timestamped_notes as unknown[])
    : [];
  const anchoredVisibility = tsNotes.some((n) => {
    if (!n || typeof n !== "object") return false;
    const note = (n as Record<string, unknown>).note;
    return typeof note === "string" && VISIBILITY_CLAIM_RE.test(note);
  });

  if (!anchoredVisibility) {
    const stripVisibility = (text: unknown): { text: string; removed: number } => {
      if (typeof text !== "string" || !text) return { text: "", removed: 0 };
      const sentences = splitSentences(text);
      let removed = 0;
      const kept: string[] = [];
      for (const s of sentences) {
        if (VISIBILITY_CLAIM_RE.test(s)) {
          removed++;
          continue;
        }
        kept.push(s);
      }
      return {
        text: kept.join(" ").replace(/\s{2,}/g, " ").trim(),
        removed,
      };
    };
    const stripArr = (arr: unknown): unknown => {
      if (!Array.isArray(arr)) return arr;
      const out: unknown[] = [];
      for (const item of arr) {
        if (typeof item === "string") {
          const { text, removed } = stripVisibility(item);
          counters.dance_visibility_unanchored_removed += removed;
          if (text.trim().length > 0) out.push(text);
        } else if (item && typeof item === "object") {
          const obj = { ...(item as Record<string, unknown>) };
          for (const k of ["point", "note", "evidence"]) {
            if (typeof obj[k] === "string") {
              const { text, removed } = stripVisibility(obj[k]);
              counters.dance_visibility_unanchored_removed += removed;
              obj[k] = text;
            }
          }
          const point = typeof obj.point === "string" ? obj.point.trim() : "";
          const note = typeof obj.note === "string" ? obj.note.trim() : "";
          if (point.length > 0 || note.length > 0) out.push(obj);
        } else if (item != null) {
          out.push(item);
        }
      }
      return out;
    };
    r.strengths = stripArr(r.strengths);
    r.improvements = stripArr(r.improvements);
    r.presentation_notes = stripArr(r.presentation_notes);
    if (r.category_notes && typeof r.category_notes === "object") {
      const cn = { ...(r.category_notes as Record<string, unknown>) };
      for (const [k, v] of Object.entries(cn)) {
        if (typeof v === "string") {
          const { text, removed } = stripVisibility(v);
          counters.dance_visibility_unanchored_removed += removed;
          cn[k] = text;
        }
      }
      r.category_notes = cn;
    }
  }

  // -------------------------------------------------------------------------
  // Submission-risk scope: craft-level visibility/lighting items must not be
  // surfaced as casting-compliance risks unless they have anchored evidence.
  // We demote them out of submission_risk_flags / casting_risk_explanations
  // and let category notes/presentation notes carry the craft message.
  // -------------------------------------------------------------------------
  const isSoftRisk = (item: unknown): boolean => {
    if (!item || typeof item !== "object") return false;
    const obj = item as Record<string, unknown>;
    const flag = typeof obj.flag === "string" ? obj.flag : "";
    const sev = typeof obj.severity === "string" ? obj.severity.toLowerCase() : "";
    if (!SOFT_RISK_LABEL_RE.test(flag)) return false;
    // Keep only when severity is high AND we have anchored visibility.
    if (sev === "high" && anchoredVisibility) return false;
    return true;
  };
  if (Array.isArray(r.submission_risk_flags)) {
    const before = (r.submission_risk_flags as unknown[]).length;
    r.submission_risk_flags = (r.submission_risk_flags as unknown[]).filter(
      (f) => !isSoftRisk(f),
    );
    counters.submission_risk_demoted += before - (r.submission_risk_flags as unknown[]).length;
  }
  if (Array.isArray(r.casting_risk_explanations)) {
    r.casting_risk_explanations = (r.casting_risk_explanations as unknown[]).filter(
      (f) => {
        if (!f || typeof f !== "object") return true;
        const flag = (f as Record<string, unknown>).flag;
        if (typeof flag !== "string") return true;
        if (!SOFT_RISK_LABEL_RE.test(flag)) return true;
        return anchoredVisibility;
      },
    );
  }

  return { report: r, counters };
}

/**
 * Pure helper to detect "fixed framing" briefs — used by callers to decide
 * whether to flip `framingFixed` on the enforcement context.
 */
export function detectFramingFixed(
  framingText: string | null | undefined,
): boolean {
  if (!framingText || typeof framingText !== "string") return false;
  return /\b(?:head[-\s]and[-\s]shoulders|fixed|static|close[-\s]up|self[-\s]tape\s+camera[-\s]led)\b/i.test(
    framingText,
  );
}

/**
 * Public-safe headline picker for v1 + v2 reports. Used by comparison view.
 */
export function pickComparisonHeadline(
  report: Record<string, unknown> | null | undefined,
): string | null {
  if (!report || typeof report !== "object") return null;
  for (const k of ["casting_headline", "headline", "casting_insight", "insight"]) {
    const v = (report as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}
