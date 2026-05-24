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

  // Audio only HARD-blocks when fair assessment is genuinely impossible.
  // Softened from <45 to <35 — 35–49 is handled as a verdict cap (Worth
  // another take), not an automatic Not-ready blocker.
  if (audio != null && audio < 35) {
    blockers.push({
      code: "audio_low",
      message: "audio is too unclear to fairly judge the performance",
    });
  }
  // Technical only blocks when assessment is genuinely impaired (was <45).
  // Modest setups, plain backgrounds and home environments must NOT block.
  if (tech != null && tech < 35) {
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
  // Stacked-issues guard: stacking two minor weaknesses must NOT trigger a
  // Not-ready blocker. Only treat as a blocker when at least two categories
  // are genuinely weak (<50) AND one of them is a fundamental (acting,
  // vocal, or brief_adherence). Pure presentation/technical/audio stacking
  // is handled as a verdict cap, not a blocker.
  const fundamentals: WeightedCategory[] = ["acting", "vocal", "brief_adherence"];
  const weakEntries = (
    Object.entries(input.scores) as Array<[string, number | null | undefined]>
  ).filter(([, s]) => typeof s === "number" && (s as number) < 50);
  const hasWeakFundamental = weakEntries.some(([k]) =>
    fundamentals.includes(k as WeightedCategory),
  );
  if (weakEntries.length >= 2 && hasWeakFundamental) {
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

  // Tiered audio caps:
  //   - <35  → hard blocker (handled in computeBlockers); cap at 60 here as belt-and-braces.
  //   - 35–49 → cap at "Worth another take" (≤62 in level bands typically).
  //   - 50–59 → soft cap at 75; surfaces a risk flag elsewhere but allows
  //             "Ready to submit" if the rest of the tape is strong.
  const audio = input.scores.audio ?? null;
  if (audio != null && audio < 35 && overall > 60) {
    overall = 60;
    capped = true;
    reason = "audio is too unclear to fairly judge the performance";
  } else if (audio != null && audio < 50 && overall > 62) {
    overall = 62;
    capped = true;
    reason = "audio clarity needs lifting before this is sendable";
  } else if (audio != null && audio < 60 && overall > 75) {
    overall = 75;
    capped = true;
    reason = "audio is workable but a clearer take would land harder";
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

export type BriefRequirementCategory =
  | "material"
  | "performance"
  | "technical"
  | "admin_process"
  | "deadline"
  | "logistics"
  | "role_context";

export type BriefRequirementImportance = "mandatory" | "preferred" | "optional" | "ambiguous";

export type BriefRequirement = {
  id: string;
  brief_text: string;
  summary: string;
  category: BriefRequirementCategory;
  importance: BriefRequirementImportance;
  expected_evidence_in_tape: string;
  achievement_test: string;
  submission_impact_if_missing: string;
  report_destination: string;
  confidence: "low" | "medium" | "high";
};

export type BriefAchievementStatus =
  | "achieved"
  | "mostly_achieved"
  | "partly_achieved"
  | "not_achieved"
  | "not_assessable"
  | "not_applicable";

export type BriefAchievementOverallStatus =
  | "achieved"
  | "mostly_achieved"
  | "partly_achieved"
  | "not_achieved"
  | "not_assessable";

export type BriefAchievementMandatoryStatus = "clear" | "some_gaps" | "blocked" | "not_assessable";

export type BriefAchievementReadinessImpact =
  | "supports_submission"
  | "review_carefully"
  | "material_gap"
  | "submission_blocker"
  | "not_assessable";

export type BriefAchievementSubmissionImpact =
  | "supports_submission"
  | "material_gap"
  | "submission_blocker"
  | "optional_polish"
  | "final_check"
  | "not_assessable";

export type BriefAchievementFixCategory =
  | "must_fix"
  | "should_improve"
  | "optional_polish"
  | "preserve"
  | "final_check"
  | "none";

export type RequirementAchievementResult = {
  requirement_id: string;
  requirement_summary: string;
  category: BriefRequirementCategory;
  importance: BriefRequirementImportance;
  observed_status: "present" | "partially_present" | "absent" | "not_assessable" | "uncertain";
  completion_status: "complete" | "incomplete" | "cut_off" | "not_applicable" | "uncertain";
  achievement_status: BriefAchievementStatus;
  evidence_summary: string;
  submission_impact: BriefAchievementSubmissionImpact;
  fix_category: BriefAchievementFixCategory;
  recommended_action: string;
  confidence: "low" | "medium" | "high";
  linked_observed_sequence_ids: string[];
  linked_component_verification_ids: string[];
  cannot_infer_from_brief_only: true;
};

export type BriefAchievementMatrix = {
  overall_status: BriefAchievementOverallStatus;
  mandatory_status: BriefAchievementMandatoryStatus;
  readiness_impact: BriefAchievementReadinessImpact;
  summary: string;
  achieved_requirements: string[];
  missing_or_incomplete_requirements: string[];
  not_assessable_requirements: string[];
  final_check_requirements: string[];
  requirement_results: RequirementAchievementResult[];
};

export type ReadinessDecision =
  | "submit"
  | "submit_if_deadline_is_close"
  | "review_carefully"
  | "retake_required_if_possible";

export type ReadinessScoreBandLabel =
  | "not_submission_ready"
  | "retake_required_if_possible"
  | "review_carefully"
  | "submit_if_deadline_is_close"
  | "submit_strong_submission";

export type S10CategoryScoreId =
  | "acting"
  | "vocal"
  | "movement"
  | "dance"
  | "audio"
  | "technical"
  | "brief_adherence"
  | "professional_presentation"
  | "self_tape_presentation"
  | "mt_package"
  | "other";

export type S10ComponentScoreType =
  | "acting_scene"
  | "song"
  | "dance"
  | "slate"
  | "package"
  | "technical"
  | "other";

export type CategoryScore = {
  category_id: S10CategoryScoreId;
  score: number | null;
  score_basis: string;
  what_works: string;
  why_not_full_score: string;
  close_gap: string;
  confidence: "low" | "medium" | "high";
  blocked_or_not_assessable_reason: string | null;
};

export type ComponentScore = {
  component_type: S10ComponentScoreType;
  linked_requirement_ids: string[];
  observed_status: "present" | "partially_present" | "absent" | "not_assessable" | "uncertain";
  completion_status: "complete" | "incomplete" | "cut_off" | "not_applicable" | "uncertain";
  score: number | null;
  score_basis: string;
  confidence: "low" | "medium" | "high";
  cannot_score_reason: string | null;
};

export type ScoreContradictionWarning = {
  affected_field: string;
  original_value: string | number | boolean | null;
  capped_value: string | number | boolean | null;
  matrix_reason: string;
  source:
    | "s10_ai_judgement"
    | "legacy_raw_report"
    | "score_trace"
    | "detected_components"
    | "prior_prose";
};

export type ReadinessAndScoreJudgement = {
  decision: ReadinessDecision;
  headline: string;
  rationale: string[];
  confidence: "low" | "medium" | "high";
  performance_quality_score: number | null;
  brief_completion_score: number | null;
  overall_submission_readiness_score: number;
  score_band_label: ReadinessScoreBandLabel;
  score_explanation: string;
  brief_blocker_override: boolean;
  performance_quality_summary: string;
  brief_completion_summary: string;
  technical_assessability_summary: string;
  selected_level_calibration_summary: string;
  professional_nuance_summary: string;
  category_scores: CategoryScore[];
  category_rationale: Record<string, unknown>;
  component_scores: ComponentScore[];
  component_score_notes: string[];
  score_contradiction_warnings: ScoreContradictionWarning[];
  repair_prompt_status: "not_needed" | "classified_contradictory";
};

export type S10FixSourceCategory =
  | "brief"
  | "performance"
  | "technical"
  | "admin_process"
  | "score_semantics"
  | "polish"
  | "limitation";

export type S10FixUrgency = "critical_gap" | "high" | "medium" | "low" | "optional";

export type S10FixSubmissionImpact =
  | "submission_blocker"
  | "material_gap"
  | "review_carefully"
  | "optional_polish"
  | "final_check"
  | "supports_submission";

export type S10ActionSourceAuthority =
  | "s10_ai_authored"
  | "s10_normalised"
  | "legacy_diagnostic_reauthored"
  | "limitation";

export type S10ActionContradictionWarning = {
  affected_field: string;
  original_value: string | number | boolean | null;
  corrected_value: string | number | boolean | null;
  reason: string;
  source:
    | "s10_ai_judgement"
    | "legacy_raw_report"
    | "legacy_improvements"
    | "legacy_next_take_plan"
    | "legacy_coaching_drills"
    | "prior_prose"
    | "s10_normaliser";
  internal_only: true;
};

export type S10FixItem = {
  id: string;
  title: string;
  issue: string;
  why_it_matters: string;
  exact_action: string;
  source_category: S10FixSourceCategory;
  urgency: S10FixUrgency;
  submission_impact: S10FixSubmissionImpact;
  linked_requirement_ids: string[];
  linked_matrix_result_ids: string[];
  linked_component_verification_ids: string[];
  linked_readiness_reason_ids: string[];
  evidence_summary: string;
  confidence: "low" | "medium" | "high";
  is_fix_first_candidate: boolean;
  is_generic_fallback: false;
  source_authority: S10ActionSourceAuthority;
  legacy_source_used: boolean;
  legacy_source_path?: string | null;
};

export type S10FixHierarchy = {
  fix_first: S10FixItem | null;
  priority_fixes: S10FixItem[];
  must_fix_before_submitting: S10FixItem[];
  should_improve_if_retaking: S10FixItem[];
  optional_polish: S10FixItem[];
  preserve: S10FixItem[];
  do_not_overfix: S10FixItem[];
  action_contradiction_warnings: S10ActionContradictionWarning[];
};

export type S10NextActionPlan = {
  submit_checklist: string[];
  retake_plan: string[];
  final_checks: string[];
  playback_checks: string[];
  do_not_overfix: string[];
  if_time_is_short_guidance: string[];
  no_retake_needed_reason: string | null;
  confidence: "low" | "medium" | "high";
};

export type BriefContext = {
  project_name?: string | null;
  role_name?: string | null;
  discipline?: string | null;
  audition_type?: string | null;
  material_package_summary?: string | null;
  role_description_summary?: string | null;
  deadline_summary?: string | null;
  upload_summary?: string | null;
  file_naming_summary?: string | null;
};

export type ExtractedBrief = {
  audition_type: AuditionType;
  role_name?: string | null;
  show_or_project?: string | null;
  brief_context?: BriefContext | null;
  brief_requirements?: BriefRequirement[];
  brief_intelligence_prompt_version?: string | null;
  character_descriptors?: string[];
  tone_or_world?: string | null;
  performance_style?: string | null;
  accent_or_dialect_required?: string | null;
  // Proportionality controls for accent assessment.
  accent_required?: "yes" | "no" | "unknown";
  accent_importance?: "central" | "preferred" | "unspecified";
  vocal_style_required?: string | null;
  movement_or_dance_required?: string | null;
  reader_required?: "yes" | "no" | "unspecified";
  slate_required?: "yes" | "no" | "unspecified";
  orientation_required?: "portrait" | "landscape" | "either" | null;
  framing_required?: string | null;
  time_limit_seconds?: number | null;
  // "explicit" only when the brief literally states a numeric duration.
  // "none" otherwise — bar-cut references, song length, audition type, and
  // app upload limits MUST NOT set this to "explicit".
  time_limit_source?: "explicit" | "none";
  explicit_instructions?: string[];
  material_requested?: string | null;
  // Deterministic policy derived from the raw brief + material_requested.
  // - "fixed"  → brief requires specific named material; never suggest alternatives.
  // - "choice" → brief allows performer choice; repertoire suggestions allowed.
  // - "none"   → no material specified.
  material_policy?: MaterialPolicy;
  recall_dates?: string | null;
  confidentiality_notes?: string | null;
};

export type MaterialPolicy = "fixed" | "choice" | "none";

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
    out = out.replace(re, rep);
  }
  // Callback → Recall (preserve case heuristic).
  out = out
    .replace(/\bCALLBACKS?\b/g, "RECALLS")
    .replace(/\bCallbacks?\b/g, "Recalls")
    .replace(/\bcallbacks?\b/g, "recalls")
    .replace(/\bRECALLSS\b/g, "RECALLS");
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
