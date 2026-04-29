// Deterministic rules for the self-tape evaluator.
//
// Pure functions only — no I/O, no side effects. Imported from BOTH the
// server pipeline (process-take.server.ts) and the client UI (audition page),
// so it must stay framework-agnostic.

export type AuditionLevel = "learning" | "amateur" | "emerging" | "professional";

export type AuditionType =
  | "acting_scene"
  | "monologue"
  | "song"
  | "musical_theatre"
  | "dance"
  | "commercial"
  | "hybrid"
  | "unknown";

export const AUDITION_LEVEL_LABELS: Record<AuditionLevel, string> = {
  learning: "Learning / School",
  amateur: "Amateur / Community",
  emerging: "Emerging / Training",
  professional: "Professional",
};

// -------------------- Audition-type weighting --------------------
// Weights are applied to the model's per-category scores.
// `vocal` falls back to `acting` for non-singing tapes (caller decides).

export type WeightedCategory =
  | "acting"
  | "vocal"
  | "audio"
  | "technical"
  | "brief_adherence"
  | "professional_presentation";

export type CategoryWeights = Partial<Record<WeightedCategory, number>>;

export function weightsForType(type: AuditionType): CategoryWeights {
  switch (type) {
    case "acting_scene":
    case "monologue":
      return {
        acting: 0.45,
        vocal: 0.2, // "Voice / Speech delivery" — re-uses vocal category for spoken delivery
        brief_adherence: 0.15,
        technical: 0.1,
        audio: 0.1,
      };
    case "song":
      return {
        vocal: 0.45,
        acting: 0.15, // storytelling within the song
        // Musicality lives inside vocal in the existing schema.
        audio: 0.1,
        brief_adherence: 0.1,
        technical: 0.2, // catch-all for setup quality
      };
    case "musical_theatre":
      return {
        acting: 0.3,
        vocal: 0.3,
        brief_adherence: 0.15,
        technical: 0.15,
        audio: 0.1,
      };
    case "dance":
      return {
        acting: 0.25, // performance
        vocal: 0.35, // technique proxy (closest schema slot)
        brief_adherence: 0.1,
        technical: 0.25,
        audio: 0.05,
      };
    case "commercial":
      return {
        acting: 0.6, // presence + naturalism combined
        brief_adherence: 0.2,
        technical: 0.15,
        audio: 0.05,
      };
    case "hybrid":
    case "unknown":
    default:
      return {
        acting: 0.35,
        vocal: 0.25,
        brief_adherence: 0.15,
        technical: 0.15,
        audio: 0.1,
      };
  }
}

// -------------------- Level-aware thresholds --------------------

export type VerdictBand = {
  strong: number;
  ready: number;
  worth: number;
};

export function bandsForLevel(level: AuditionLevel): VerdictBand {
  switch (level) {
    case "learning":
      return { strong: 80, ready: 70, worth: 58 };
    case "amateur":
      return { strong: 83, ready: 73, worth: 60 };
    case "emerging":
      return { strong: 86, ready: 76, worth: 63 };
    case "professional":
      return { strong: 89, ready: 80, worth: 68 };
  }
}

export type VerdictLabel =
  | "Strong for this level"
  | "Ready to submit"
  | "Worth another take"
  | "Not ready yet";

export function labelForScore(score: number, level: AuditionLevel): VerdictLabel {
  const b = bandsForLevel(level);
  if (score >= b.strong) return "Strong for this level";
  if (score >= b.ready) return "Ready to submit";
  if (score >= b.worth) return "Worth another take";
  return "Not ready yet";
}

// -------------------- Server-side score recomputation --------------------

export type CategoryScores = Partial<Record<WeightedCategory, number | null | undefined>>;

export function recomputeOverall(
  scores: CategoryScores,
  weights: CategoryWeights,
): { overall: number; usedWeights: CategoryWeights } {
  // Drop categories where the score is missing; renormalise remaining weights.
  const usable: Array<[WeightedCategory, number, number]> = [];
  let totalW = 0;
  (Object.keys(weights) as WeightedCategory[]).forEach((k) => {
    const w = weights[k] ?? 0;
    const s = scores[k];
    if (w > 0 && typeof s === "number" && Number.isFinite(s)) {
      usable.push([k, s, w]);
      totalW += w;
    }
  });
  if (totalW === 0) return { overall: 0, usedWeights: {} };
  let acc = 0;
  const used: CategoryWeights = {};
  for (const [k, s, w] of usable) {
    const norm = w / totalW;
    used[k] = norm;
    acc += s * norm;
  }
  return { overall: Math.round(acc), usedWeights: used };
}

// -------------------- Gating, caps, blockers --------------------

export type Blocker = {
  code:
    | "audio_low"
    | "technical_low"
    | "brief_miss_major"
    | "two_weak_categories"
    | "high_risk_flag";
  message: string;
};

export function computeBlockers(input: {
  scores: CategoryScores;
  briefAdherence: number | null;
  mode: "brief" | "baseline";
  riskFlags: Array<{ severity: "low" | "medium" | "high"; flag: string }>;
}): Blocker[] {
  const blockers: Blocker[] = [];
  const audio = input.scores.audio ?? null;
  const tech = input.scores.technical ?? null;

  if (audio != null && audio < 45) {
    blockers.push({
      code: "audio_low",
      message: "audio is too unclear to fairly judge the performance",
    });
  }
  if (tech != null && tech < 45) {
    blockers.push({
      code: "technical_low",
      message: "framing or setup makes it hard to evaluate the take properly",
    });
  }
  if (input.mode === "brief" && input.briefAdherence != null && input.briefAdherence < 45) {
    blockers.push({
      code: "brief_miss_major",
      message: "a major casting brief instruction wasn't followed",
    });
  }
  // 2+ weak categories
  const weakCount = (Object.values(input.scores) as Array<number | null | undefined>).filter(
    (s) => typeof s === "number" && s < 55,
  ).length;
  if (weakCount >= 2) {
    blockers.push({
      code: "two_weak_categories",
      message: "two or more areas need work before this is ready",
    });
  }
  if (input.riskFlags.some((f) => f.severity === "high")) {
    blockers.push({
      code: "high_risk_flag",
      message: "a high-severity submission risk was flagged",
    });
  }
  return blockers;
}

// Apply caps to overall + verdict label given blockers and brief adherence.
export function applyCapsAndLabel(input: {
  overall: number;
  scores: CategoryScores;
  briefAdherence: number | null;
  mode: "brief" | "baseline";
  level: AuditionLevel;
  blockers: Blocker[];
}): { overall: number; label: VerdictLabel; capped: boolean; reason?: string } {
  let { overall } = input;
  let capped = false;
  let reason: string | undefined;

  // Audio < 50 caps overall at 65 (preserve existing behaviour, slightly softer
  // than the hard 45 blocker).
  const audio = input.scores.audio ?? null;
  if (audio != null && audio < 50 && overall > 65) {
    overall = 65;
    capped = true;
    reason = "audio clarity caps the overall";
  }

  let label = labelForScore(overall, input.level);

  // Strong-for-this-level requires no blocker + brief_adherence ≥ 60 + no
  // category < 70.
  const anyCategoryBelow70 = (Object.values(input.scores) as Array<number | null | undefined>).some(
    (s) => typeof s === "number" && s < 70,
  );
  const briefOK = input.mode !== "brief" || (input.briefAdherence ?? 100) >= 60;
  if (label === "Strong for this level") {
    if (input.blockers.length > 0 || !briefOK || anyCategoryBelow70) {
      label = "Ready to submit";
      capped = true;
      reason = reason ?? "doesn't quite clear the bar for 'strong'";
    }
  }

  // Hard blocker: never higher than "Worth another take".
  if (input.blockers.length > 0) {
    if (label === "Strong for this level" || label === "Ready to submit") {
      label = "Worth another take";
      capped = true;
      reason = input.blockers[0].message;
    }
  }

  // Brief adherence < 45 → Not ready
  if (input.mode === "brief" && (input.briefAdherence ?? 100) < 45) {
    label = "Not ready yet";
    capped = true;
    reason = "the casting brief wasn't followed closely enough";
  }
  // Brief adherence < 60 cannot be Strong
  if (
    input.mode === "brief" &&
    (input.briefAdherence ?? 100) < 60 &&
    label === "Strong for this level"
  ) {
    label = "Ready to submit";
    capped = true;
  }

  return { overall, label, capped, reason };
}

// -------------------- Deterministic compliance vs signals --------------------

export type ComplianceFlag = {
  code:
    | "orientation_mismatch"
    | "duration_over"
    | "duration_under"
    | "audio_low_signal"
    | "slate_unknown";
  severity: "low" | "medium" | "high";
  message: string;
};

export function deterministicCompliance(input: {
  extracted: ExtractedBrief | null;
  signals: {
    orientation?: "portrait" | "landscape" | "square" | string;
    duration?: number; // seconds
    audio_peak?: number;
  } | null;
}): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const e = input.extracted;
  const s = input.signals;
  if (!e || !s) return flags;

  if (e.orientation_required && s.orientation && e.orientation_required !== "either") {
    if (s.orientation !== e.orientation_required) {
      flags.push({
        code: "orientation_mismatch",
        severity: "high",
        message: `Casting brief asks for ${e.orientation_required}; tape is ${s.orientation}.`,
      });
    }
  }

  if (e.time_limit_seconds && s.duration) {
    if (s.duration > e.time_limit_seconds + 5) {
      flags.push({
        code: "duration_over",
        severity: "medium",
        message: `Tape runs ${Math.round(s.duration)}s; brief asks for under ${e.time_limit_seconds}s.`,
      });
    } else if (s.duration < Math.max(8, e.time_limit_seconds * 0.4)) {
      flags.push({
        code: "duration_under",
        severity: "low",
        message: `Tape is short (${Math.round(s.duration)}s) versus the brief's expected length.`,
      });
    }
  }

  if (s.audio_peak != null && s.audio_peak < 0.05) {
    flags.push({
      code: "audio_low_signal",
      severity: "medium",
      message: "Audio peak is very low — voice may be hard to hear.",
    });
  }

  return flags;
}

// -------------------- Extracted brief schema --------------------

export type ExtractedBrief = {
  audition_type: AuditionType;
  role_name?: string | null;
  show_or_project?: string | null;
  character_descriptors?: string[];
  tone_or_world?: string | null;
  performance_style?: string | null;
  accent_or_dialect_required?: string | null;
  vocal_style_required?: string | null;
  movement_or_dance_required?: string | null;
  reader_required?: "yes" | "no" | "unspecified";
  slate_required?: "yes" | "no" | "unspecified";
  orientation_required?: "portrait" | "landscape" | "either" | null;
  framing_required?: string | null;
  time_limit_seconds?: number | null;
  explicit_instructions?: string[];
  material_requested?: string | null;
  recall_dates?: string | null;
  confidentiality_notes?: string | null;
};

// -------------------- UK terminology pass --------------------

const UK_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\banalyz(e|ed|ing|er|ation)\b/gi, "analys$1"],
  [/\bprioritiz(e|ed|ing|ation)\b/gi, "prioritis$1"],
  [/\bbehavior\b/gi, "behaviour"],
  [/\bcenter(s|ed|ing)?\b/gi, "centre$1"],
  [/\bcolor(s|ed|ing|ful)?\b/gi, "colour$1"],
  [/\bfavor(s|ed|ing|ite|ites)?\b/gi, "favour$1"],
  [/\borganiz(e|ed|ing|ation|ations)\b/gi, "organis$1"],
  [/\brealiz(e|ed|ing|ation)\b/gi, "realis$1"],
  [/\brecogniz(e|ed|ing|able)\b/gi, "recognis$1"],
  [/\bemphasiz(e|ed|ing)\b/gi, "emphasis$1"],
];

export function toUKTerms(input: string | null | undefined): string {
  if (!input) return "";
  let out = input;
  for (const [re, rep] of UK_REPLACEMENTS) {
    if (typeof rep === "string") out = out.replace(re, rep);
    else out = out.replace(re, rep as never);
  }
  // Callback → Recall (preserve case heuristic).
  out = out.replace(/\bCallback\b/g, "Recall").replace(/\bcallback\b/g, "recall");
  return out;
}

// Walk a JSON value and apply UK terminology to all string leaves.
export function ukifyDeep<T>(value: T): T {
  if (typeof value === "string") return toUKTerms(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => ukifyDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = ukifyDeep(v);
    }
    return out as T;
  }
  return value;
}
