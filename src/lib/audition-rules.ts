// Deterministic rules for the self-tape evaluator.
//
// Pure functions only — no I/O, no side effects. Imported from BOTH the
// server pipeline (process-take.server.ts) and the client UI (audition page),
// so it must stay framework-agnostic.

export type AuditionLevel = "learning" | "amateur" | "emerging" | "professional";

export const S10_PERFORMER_REPORT_VIEW_MODEL_VERSION =
  "s10_performer_report_view_model_v1" as const;

export const S10_REPORT_SOURCE_MODE = "s10_ai_report_model" as const;

export const S10_ROUTE_REQUIRED_SECTION_KEYS = [
  "readiness_header",
  "submission_guidance",
  "selected_level_calibration",
  "score_summary",
  "scoring_context",
  "category_scores",
  "category_rationale",
  "brief_adherence_material_compliance",
  "brief_context",
  "brief_requirements",
  "role_material_context",
  "brief_achievement",
  "observed_tape",
  "component_breakdown",
  "fix_hierarchy",
  "next_action_plan",
  "strengths_and_preserve",
  "professional_critique",
  "technique_commentary",
  "timestamped_commentary",
  "presentation_notes",
  "submission_risk",
  "limitations",
  "same_video_status",
  "comparison_truth",
  "diagnostic_chips",
] as const;

export type S10RouteSectionKey = (typeof S10_ROUTE_REQUIRED_SECTION_KEYS)[number];

export type S10RouteSectionSource =
  | "s10_authoritative_module"
  | "s10_compatibility_projection"
  | "specific_limitation"
  | "not_applicable";

type S10RouteSectionSourceRule = {
  sources: readonly S10RouteSectionSource[];
  modules?: readonly RegExp[];
};

export const S10_ROUTE_SECTION_SOURCE_RULES: Record<S10RouteSectionKey, S10RouteSectionSourceRule> =
  {
    readiness_header: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^readiness_score_judgement$/],
    },
    submission_guidance: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^readiness_score_judgement$/],
    },
    selected_level_calibration: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^readiness_score_judgement\.selected_level_calibration$/],
    },
    score_summary: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^readiness_score_judgement$/],
    },
    scoring_context: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^scoring_context$/],
    },
    category_scores: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^readiness_score_judgement\.category_scores$/],
    },
    category_rationale: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^readiness_score_judgement\.category_rationale$/],
    },
    brief_adherence_material_compliance: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^readiness_score_judgement\.brief_completion_score$/],
    },
    brief_context: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^brief_context$/],
    },
    brief_requirements: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^brief_requirements$/],
    },
    role_material_context: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^role_material_context$/],
    },
    brief_achievement: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^brief_achievement_matrix$/],
    },
    observed_tape: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^observed_tape_sequence\/component_verifications$/],
    },
    component_breakdown: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^component_verifications$/],
    },
    fix_hierarchy: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^s10_fix_hierarchy$/],
    },
    next_action_plan: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^s10_next_action_plan$/],
    },
    strengths_and_preserve: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^s10_professional_critique$/],
    },
    professional_critique: {
      sources: ["s10_authoritative_module", "specific_limitation"],
      modules: [/^s10_professional_critique$/],
    },
    technique_commentary: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^s10_technique_commentary$/],
    },
    timestamped_commentary: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^s10_timestamped_commentary$/],
    },
    presentation_notes: {
      sources: [
        "s10_authoritative_module",
        "s10_compatibility_projection",
        "specific_limitation",
        "not_applicable",
      ],
      modules: [
        /^s10_professional_critique\/s10_technique_commentary$/,
        /^s10_professional_critique$/,
        /^s10_technique_commentary$/,
      ],
    },
    submission_risk: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [
        /^readiness_score_judgement\/brief_achievement_matrix\/s10_fix_hierarchy$/,
        /^readiness_score_judgement$/,
        /^brief_achievement_matrix$/,
        /^s10_fix_hierarchy$/,
      ],
    },
    limitations: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^s10_view_model$/],
    },
    same_video_status: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^s10_same_video_evidence$/],
    },
    comparison_truth: {
      sources: ["s10_authoritative_module", "specific_limitation", "not_applicable"],
      modules: [/^s10_comparison_truth$/],
    },
    diagnostic_chips: {
      sources: ["not_applicable"],
    },
  };

const S10_ROUTE_INVALID_SOURCE_TOKENS = [
  "raw_report",
  "legacy_report",
  "legacy_diagnostic_fallback",
  "unsupported",
  "score_trace",
  "detected_components",
  "category_notes",
  "legacy_fix_first",
  "legacy_next_take_plan",
  "legacy_presentation_notes",
  "legacy_risk_flags",
  "legacy_at_risk",
  "legacy_block_reasons",
];

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function validateS10RouteSectionSourceEntry(
  section: S10RouteSectionKey,
  entry: unknown,
): string | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return `missing_section_source:${section}`;
  }

  const record = entry as Record<string, unknown>;
  const rule = S10_ROUTE_SECTION_SOURCE_RULES[section];
  const sourceValue = asNonEmptyString(record.source);
  const moduleValue = asNonEmptyString(record.module);

  if (!sourceValue) return `invalid_section_source:${section}:missing_source`;
  if (!rule.sources.includes(sourceValue as S10RouteSectionSource)) {
    return `invalid_section_source:${section}:${sourceValue}`;
  }

  const searchable = `${sourceValue} ${moduleValue ?? ""}`;
  const invalid = S10_ROUTE_INVALID_SOURCE_TOKENS.find((token) =>
    searchable.toLowerCase().includes(token.toLowerCase()),
  );
  if (invalid) return `invalid_section_source:${section}:${invalid}`;

  if (
    (sourceValue === "s10_authoritative_module" ||
      sourceValue === "s10_compatibility_projection") &&
    !moduleValue
  ) {
    return `invalid_section_module:${section}:missing_module`;
  }

  if (moduleValue && rule.modules && !rule.modules.some((pattern) => pattern.test(moduleValue))) {
    return `invalid_section_module:${section}:${moduleValue}`;
  }

  if (sourceValue === "specific_limitation" && !asNonEmptyString(record.limitation)) {
    return `invalid_section_limitation:${section}:missing_limitation`;
  }

  return null;
}

export function isUsableS10PerformerReportViewModel(value: unknown): value is {
  report_version: typeof S10_PERFORMER_REPORT_VIEW_MODEL_VERSION;
  source_mode: typeof S10_REPORT_SOURCE_MODE;
} {
  const record =
    Boolean(value) && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const sectionSourceMap = record?.section_source_map;
  const scoreSummary = record?.score_summary;
  const recommendation = record?.recommendation;
  const limitations = record?.limitations;
  const recommendationRecord =
    recommendation && typeof recommendation === "object" && !Array.isArray(recommendation)
      ? (recommendation as Record<string, unknown>)
      : null;
  const hasRenderableItemText = (item: unknown): boolean => {
    if (typeof item === "string" && item.trim().length > 0) return true;
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return [
      record.title,
      record.headline,
      record.point,
      record.summary,
      record.detail,
      record.exact_action,
      record.evidence_summary,
      record.why_it_matters,
      record.recommended_action,
    ].some((value) => typeof value === "string" && value.trim().length > 0);
  };
  const hasVisibleRecommendation =
    !!recommendationRecord &&
    [recommendationRecord.headline, recommendationRecord.score_explanation].some(
      (item) => typeof item === "string" && item.trim().length > 0,
    );
  const hasVisibleRecommendationRationale =
    !!recommendationRecord &&
    Array.isArray(recommendationRecord.rationale) &&
    recommendationRecord.rationale.some((item) => hasRenderableItemText(item));
  const hasVisibleLimitation =
    Array.isArray(limitations) &&
    limitations.some((item) => typeof item === "string" && item.trim().length > 0);
  const hasRequiredSourceMapEntries =
    Boolean(sectionSourceMap) &&
    typeof sectionSourceMap === "object" &&
    !Array.isArray(sectionSourceMap) &&
    S10_ROUTE_REQUIRED_SECTION_KEYS.every(
      (section) =>
        validateS10RouteSectionSourceEntry(
          section,
          (sectionSourceMap as Record<string, unknown>)[section],
        ) === null,
    );
  return (
    !!record &&
    record.report_version === S10_PERFORMER_REPORT_VIEW_MODEL_VERSION &&
    record.source_mode === S10_REPORT_SOURCE_MODE &&
    hasRequiredSourceMapEntries &&
    Boolean(scoreSummary) &&
    typeof scoreSummary === "object" &&
    !Array.isArray(scoreSummary) &&
    Array.isArray(limitations) &&
    (hasVisibleRecommendation || hasVisibleRecommendationRationale || hasVisibleLimitation)
  );
}

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

// ── ARCH-Δ2: user-selected audition discipline ─────────────────────────────
//
// The discipline is a MANDATORY pre-upload selection persisted on the
// audition row (auditions.discipline) — one discipline per submission; all
// takes inherit it. It is the primary source of the analysis AuditionType
// (the user's selection always wins over brief inference, which remains
// secondary brief intelligence). Musical Theatre is ONE composite
// discipline (singing + acting dimensions + integration), not two.

export type AuditionDiscipline =
  | "acting"
  | "musical_theatre"
  | "singing_voice"
  | "dance"
  | "commercial";

export const AUDITION_DISCIPLINES = [
  "acting",
  "musical_theatre",
  "singing_voice",
  "dance",
  "commercial",
] as const satisfies readonly AuditionDiscipline[];

export const AUDITION_DISCIPLINE_LABELS: Record<AuditionDiscipline, string> = {
  acting: "Acting",
  musical_theatre: "Musical Theatre",
  singing_voice: "Singing / Voice",
  dance: "Dance",
  commercial: "Commercial",
};

export function isAuditionDiscipline(value: unknown): value is AuditionDiscipline {
  return typeof value === "string" && (AUDITION_DISCIPLINES as readonly string[]).includes(value);
}

/**
 * Maps the user-facing discipline to the analysis AuditionType that drives
 * weightsForType, category labels and vocal-row policy.
 *
 * singing_voice maps to "song" (NOT the label-only "voice" value): "voice"
 * has label entries but NO weightsForType entry, so "song" is required for
 * the vocal-forward weights to activate. "monologue"/"hybrid" remain enum
 * values for legacy/brief-extraction use; new runs never produce them at
 * the top level, and "unknown" becomes impossible on new runs.
 */
export function disciplineToAuditionType(discipline: AuditionDiscipline): AuditionType {
  switch (discipline) {
    case "acting":
      return "acting_scene";
    case "musical_theatre":
      return "musical_theatre";
    case "singing_voice":
      return "song";
    case "dance":
      return "dance";
    case "commercial":
      return "commercial";
  }
}

/**
 * Deterministic discipline context line injected into the Step 1 and
 * Step 2 prompts (level-block precedent: a deterministic input block, not a
 * module-map change; no prompt-map version bump).
 */
export function buildAuditionDisciplinePromptLine(discipline: AuditionDiscipline): string {
  const label = AUDITION_DISCIPLINE_LABELS[discipline];
  if (discipline === "musical_theatre") {
    return `AUDITION DISCIPLINE: ${label} (${discipline}) — single composite discipline: assess singing, acting and their integration as one package.`;
  }
  return `AUDITION DISCIPLINE: ${label} (${discipline}) — selected by the performer; assess against this discipline's demands.`;
}

export type S10PerformerLevel =
  | "learning_school"
  | "amateur_community"
  | "emerging_training"
  | "professional";

export const S10_PERFORMER_LEVELS = [
  "learning_school",
  "amateur_community",
  "emerging_training",
  "professional",
] as const satisfies readonly S10PerformerLevel[];

export type S10PerformerLevelStandard = {
  selected_level: S10PerformerLevel;
  audition_level: AuditionLevel;
  label: string;
  standard_applied: string;
  evidence_threshold: string;
  readiness_standard: string;
  score_meaning: string;
  ai_judgement_questions: readonly string[];
  professional_90_note: string;
};

export const S10_PERFORMER_LEVEL_STANDARDS: Record<S10PerformerLevel, S10PerformerLevelStandard> = {
  learning_school: {
    selected_level: "learning_school",
    audition_level: "learning",
    label: "Learning / School",
    standard_applied:
      "Basic task understanding, preparation, intelligibility and early craft evidence.",
    evidence_threshold:
      "The tape should be clear enough to assess preparation, task response and early technique without implying professional readiness.",
    readiness_standard:
      "Ready at this level means prepared, understandable and complete enough for the assignment or audition context.",
    score_meaning:
      "A high score means excellent evidence for Learning / School level, not automatic Professional readiness.",
    ai_judgement_questions: [
      "Is the task basically understood?",
      "Is the performer prepared enough for this context?",
      "Is speech, song or movement intelligible and assessable?",
      "What is the most useful next correction at this level?",
    ],
    professional_90_note:
      "Do not describe Learning / School excellence as Professional-standard unless independent Professional evidence is visible.",
  },
  amateur_community: {
    selected_level: "amateur_community",
    audition_level: "amateur",
    label: "Amateur / Community",
    standard_applied:
      "Clear, prepared, task-relevant work that communicates reliably in a lower-stakes audition context.",
    evidence_threshold:
      "The tape should be understandable, prepared and aligned with the task, with fixes focused on confidence, clarity and task fit.",
    readiness_standard:
      "Ready at this level means usable and reliable for Amateur / Community submission conditions.",
    score_meaning:
      "A high score means strong for Amateur / Community level without claiming Professional competitiveness.",
    ai_judgement_questions: [
      "Is the tape clear, prepared and task-relevant?",
      "Does the performance communicate reliably in a lower-stakes audition context?",
      "Are required brief components present where a brief exists?",
      "What would most improve readability, confidence or task fit?",
    ],
    professional_90_note:
      "If Professional gaps are relevant, name them as a gap to Professional rather than downgrading Amateur / Community success.",
  },
  emerging_training: {
    selected_level: "emerging_training",
    audition_level: "emerging",
    label: "Emerging / Training",
    standard_applied:
      "Credible craft, specificity, consistency and clear development direction under training or early-career scrutiny.",
    evidence_threshold:
      "The tape should show choices beyond basic preparation and enough technical assessability to identify development priorities.",
    readiness_standard:
      "Ready at this level means credible, specific and useful for training, early-career or semi-professional review.",
    score_meaning:
      "A high score means strong Emerging / Training evidence, with any Professional gap named separately where useful.",
    ai_judgement_questions: [
      "Is there credible craft beyond basic preparation?",
      "Are the choices specific rather than general?",
      "Does the performer sustain the scene, song, copy or movement task?",
      "What is the gap to Professional, if useful?",
    ],
    professional_90_note:
      "Developmental feedback should stay specific and should not soften mandatory brief or assessability blockers.",
  },
  professional: {
    selected_level: "professional",
    audition_level: "professional",
    label: "Professional",
    standard_applied:
      "Discipline-specific, evidence-rich, brief-precise and technically assessable work under casting-facing conditions.",
    evidence_threshold:
      "The tape must distinguish competent from competitive work and expose any mandatory blocker, assessability issue or specialist precision gap.",
    readiness_standard:
      "Ready at this level means submit-ready under professional casting conditions, not merely clean or competent.",
    score_meaning:
      "A high score means strong Professional evidence; scores above 90 require competitive-zone nuance where no blocker dominates.",
    ai_judgement_questions: [
      "Does this meet the brief at Professional submission standard?",
      "Is the work competitive, not merely competent?",
      "What meets Professional standard and what is exposed by that standard?",
      "Is this submit-ready, standout, or still carrying a casting-facing risk?",
    ],
    professional_90_note:
      "Professional 90+ must distinguish viable, solid, strong, standout and exceptional zones without guaranteeing outcomes.",
  },
};

export type S10PerformerLevelCalibration = {
  selected_level: S10PerformerLevel;
  selected_level_label: string;
  standard_applied: string;
  evidence_threshold: string;
  readiness_standard: string;
  score_meaning: string;
  what_meets_level: string[];
  what_falls_short: string[];
  recommendation_impact: string;
  comparison_to_other_levels: string | null;
  confidence: "low" | "medium" | "high";
};

export function toS10PerformerLevel(
  level: AuditionLevel | S10PerformerLevel | string | null | undefined,
): S10PerformerLevel {
  switch (level) {
    case "learning":
    case "learning_school":
      return "learning_school";
    case "amateur":
    case "amateur_community":
      return "amateur_community";
    case "professional":
      return "professional";
    case "emerging":
    case "emerging_training":
    default:
      return "emerging_training";
  }
}

export function auditionLevelFromS10PerformerLevel(level: S10PerformerLevel): AuditionLevel {
  return S10_PERFORMER_LEVEL_STANDARDS[level].audition_level;
}

export function getS10PerformerLevelStandard(
  level: AuditionLevel | S10PerformerLevel | string | null | undefined,
): S10PerformerLevelStandard {
  return S10_PERFORMER_LEVEL_STANDARDS[toS10PerformerLevel(level)];
}

export function buildS10PerformerLevelPromptBlock(
  level: AuditionLevel | S10PerformerLevel | string | null | undefined,
): string {
  const standard = getS10PerformerLevelStandard(level);
  return [
    `SELECTED PERFORMER LEVEL: ${standard.label} (${standard.selected_level})`,
    "Use this as the assessment standard, not as tone, encouragement level or score decoration.",
    `Standard applied: ${standard.standard_applied}`,
    `Evidence threshold: ${standard.evidence_threshold}`,
    `Readiness standard: ${standard.readiness_standard}`,
    `Score meaning: ${standard.score_meaning}`,
    `Level-specific questions: ${standard.ai_judgement_questions.join(" ")}`,
    standard.professional_90_note,
    "In readiness_score_judgement.selected_level_calibration, state what meets this selected level, what falls short, how the score should be interpreted at this level, and whether the recommendation changes because of the level.",
    "If a mandatory brief blocker or assessability blocker dominates, say that the blocker overrides level-based praise.",
  ].join("\n");
}

export function createS10PerformerLevelCalibration(
  level: AuditionLevel | S10PerformerLevel | string | null | undefined,
  overrides: Partial<S10PerformerLevelCalibration> = {},
): S10PerformerLevelCalibration {
  const standard = getS10PerformerLevelStandard(level);
  const base: S10PerformerLevelCalibration = {
    selected_level: standard.selected_level,
    selected_level_label: standard.label,
    standard_applied: standard.standard_applied,
    evidence_threshold: standard.evidence_threshold,
    readiness_standard: standard.readiness_standard,
    score_meaning: standard.score_meaning,
    what_meets_level: [],
    what_falls_short: [],
    recommendation_impact: "",
    comparison_to_other_levels: null,
    confidence: "low",
  };
  return {
    ...base,
    ...overrides,
    selected_level: standard.selected_level,
    selected_level_label: standard.label,
  };
}

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

/**
 * Δ6 Slice 2 — the canonical VERDICT decision (render vocabulary), derived deterministically
 * from the persisted SubmissionVerdict (label + capped + blocked, all canonical after Slice 1's
 * N4a made the number deterministic). The A-side recommendation.decision is NOT used — this
 * removes the last A-as-authority path on the visible verdict, mirroring how N4a removed it
 * from the number.
 *
 * Ratified mapping (operator decision, honesty principle):
 *   blocked                                          → retake_required_if_possible
 *   "Strong for this level" | "Ready to submit", !capped → submit
 *   "Strong for this level" | "Ready to submit",  capped → review_carefully
 *       (clears the bar but a cap/flag fired — "submittable, but check it")
 *   "Worth another take" | "Not ready yet" | unknown → retake_required_if_possible
 *       ("Worth another take" honestly says a focused retake will lift it above the bar —
 *        softening it to review_carefully would reintroduce the flattering-direction error.)
 *
 * submit_if_deadline_is_close is NEVER emitted: it is an A-side hedge the deterministic system
 * never makes (the AI cannot know the performer's deadline).
 */
export type CanonicalVerdictDecision =
  | "submit"
  | "review_carefully"
  | "retake_required_if_possible";

export function canonicalVerdictDecision(input: {
  label: VerdictLabel | string;
  capped: boolean;
  blocked: boolean;
}): CanonicalVerdictDecision {
  if (input.blocked) return "retake_required_if_possible";
  if (input.label === "Strong for this level" || input.label === "Ready to submit") {
    return input.capped ? "review_carefully" : "submit";
  }
  // "Worth another take", "Not ready yet", or any unrecognised label → honest retake.
  return "retake_required_if_possible";
}

/**
 * Δ6: harden a canonical verdict reason so it is performer-safe BY CONSTRUCTION. The
 * deterministic blocked reason is built as `Blocked: ${blocker message}.`
 * (computeSubmissionVerdict) — that raw "Blocked:" phrasing is performer-forbidden on this
 * minors-facing product. The operative signal is the "Blocked:" prefix, which a blocked
 * take's deterministic reason always carries (`blocked` is part of the contract and coincides
 * with it). Any reason WITHOUT the prefix — every tone-honest non-blocked reason, and any
 * already-safe reason — is returned unchanged.
 *
 * When the prefix is present, REUSE the existing performer-safe block_reasons rather than
 * inventing copy. Caveat handled: process-take pushes `verdict.reason` into block_reasons, so
 * block_reasons[0] can itself be the raw "Blocked: …" line — the first "Blocked:"-prefixed
 * entry is therefore skipped. If no performer-safe block reason exists, strip the token and
 * reframe to an action-honest sentence (no "Blocked:" survives).
 */
export function performerSafeVerdictReason(input: {
  reason: string | null;
  blocked: boolean;
  blockReasons: unknown;
}): string | null {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!/^blocked\s*:/i.test(reason)) return input.reason;
  const reused = (Array.isArray(input.blockReasons) ? input.blockReasons : [])
    .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    .map((r) => r.trim())
    .find((r) => !/^blocked\s*:/i.test(r));
  if (reused) return reused;
  const stripped = reason.replace(/^blocked\s*:\s*/i, "").replace(/\s*\.\s*$/, "");
  return stripped
    ? `Not ready to send — ${stripped}. Record a fresh take before submitting.`
    : "Not ready to send — record a fresh take before submitting.";
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

// Single source of truth for the tiered audio cap. Pure: given an overall and a
// (possibly absent) audio score, returns the capped overall plus whether/why it
// capped. Absent audio (null) NEVER caps. The thresholds and reason strings are
// the contract — kept verbatim from the original inline implementation here and
// in process-take.server.ts (which now both call this helper).
//   - audio < 35 && overall > 60 → 60
//   - audio < 50 && overall > 62 → 62
//   - audio < 60 && overall > 75 → 75
export function applyAudioCap(
  overall: number,
  audio: number | null,
): { overall: number; capped: boolean; reason?: string } {
  if (audio != null && audio < 35 && overall > 60) {
    return {
      overall: 60,
      capped: true,
      reason: "audio is too unclear to fairly judge the performance",
    };
  }
  if (audio != null && audio < 50 && overall > 62) {
    return {
      overall: 62,
      capped: true,
      reason: "audio clarity needs lifting before this is sendable",
    };
  }
  if (audio != null && audio < 60 && overall > 75) {
    return {
      overall: 75,
      capped: true,
      reason: "audio is workable but a clearer take would land harder",
    };
  }
  return { overall, capped: false };
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

  // Tiered audio caps (single source of truth: applyAudioCap):
  //   - <35  → hard blocker (handled in computeBlockers); cap at 60 here as belt-and-braces.
  //   - 35–49 → cap at "Worth another take" (≤62 in level bands typically).
  //   - 50–59 → soft cap at 75; surfaces a risk flag elsewhere but allows
  //             "Ready to submit" if the rest of the tape is strong.
  const audioCap = applyAudioCap(overall, input.scores.audio ?? null);
  overall = audioCap.overall;
  if (audioCap.capped) {
    capped = true;
    reason = audioCap.reason;
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
  decision: ReadinessDecision | null;
  headline: string;
  rationale: string[];
  confidence: "low" | "medium" | "high";
  performance_quality_score: number | null;
  brief_completion_score: number | null;
  overall_submission_readiness_score: number | null;
  score_band_label: ReadinessScoreBandLabel | null;
  score_explanation: string;
  brief_blocker_override: boolean;
  performance_quality_summary: string;
  brief_completion_summary: string;
  technical_assessability_summary: string;
  selected_level_calibration_summary: string;
  selected_level_calibration: S10PerformerLevelCalibration;
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

export type S10ProfessionalCritiqueSourceCategory =
  | "brief"
  | "performance"
  | "acting"
  | "vocal"
  | "movement"
  | "technical"
  | "presentation"
  | "package"
  | "limitation";

export type S10ProfessionalCritiqueComponentStatus =
  | "present"
  | "partially_present"
  | "absent"
  | "not_assessable"
  | "uncertain"
  | "not_applicable";

export type S10ProfessionalCritiqueWarning = {
  affected_field: string;
  original_value: string | number | boolean | null;
  corrected_value: string | number | boolean | null;
  reason: string;
  source:
    | "s10_ai_judgement"
    | "legacy_raw_report"
    | "legacy_category_rationale"
    | "legacy_category_notes"
    | "legacy_coaching_drills"
    | "legacy_technique_trace"
    | "prior_prose"
    | "s10_normaliser";
  internal_only: true;
};

export type S10StrengthItem = {
  id: string;
  title: string;
  detail: string;
  why_it_matters: string;
  evidence_summary: string;
  source_category: S10ProfessionalCritiqueSourceCategory;
  linked_requirement_ids: string[];
  linked_component_verification_ids: string[];
  linked_matrix_result_ids: string[];
  linked_readiness_reason_ids: string[];
  linked_fix_ids: string[];
  confidence: "low" | "medium" | "high";
  is_component_verified: boolean;
  component_status: S10ProfessionalCritiqueComponentStatus;
  applies_to_observed_portion_only: boolean;
  is_generic_fallback: false;
};

export type S10PreserveItem = {
  id: string;
  title: string;
  detail: string;
  evidence_summary: string;
  why_to_preserve: string;
  linked_component_verification_ids: string[];
  confidence: "low" | "medium" | "high";
  is_generic_fallback: false;
};

export type S10ProfessionalCritique = {
  summary: string;
  performance_strengths: S10StrengthItem[];
  brief_package_strengths: S10StrengthItem[];
  technical_presentation_strengths: S10StrengthItem[];
  vocal_or_singing_strengths: S10StrengthItem[];
  acting_strengths: S10StrengthItem[];
  movement_or_physical_strengths: S10StrengthItem[];
  professional_presentation_notes: S10StrengthItem[];
  preserve: S10PreserveItem[];
  do_not_overfix: S10PreserveItem[];
  critique_limitations: string[];
  contradiction_warnings: S10ProfessionalCritiqueWarning[];
};

export type S10TechniqueArea =
  | "acting"
  | "vocal_singing"
  | "movement_dance"
  | "musical_theatre_package"
  | "self_tape_presentation"
  | "commercial_screen_task";

export type S10TechniqueSectionStatus =
  | "assessable"
  | "partially_assessable"
  | "not_assessable"
  | "not_applicable";

export type S10TechniqueComponentStatus = S10ProfessionalCritiqueComponentStatus;

export type S10TechniqueWarning = {
  affected_field: string;
  original_value: string | number | boolean | null;
  corrected_value: string | number | boolean | null;
  reason: string;
  source:
    | "s10_ai_judgement"
    | "legacy_raw_report"
    | "legacy_category_rationale"
    | "legacy_category_notes"
    | "legacy_coaching_drills"
    | "legacy_technique_trace"
    | "prior_prose"
    | "s10_normaliser"
    | "public_technique_authority_gate";
  internal_only: true;
};

export type S10TechniqueObservation = {
  id: string;
  technique_area: S10TechniqueArea;
  title: string;
  detail: string;
  evidence_summary: string;
  linked_requirement_ids: string[];
  linked_component_verification_ids: string[];
  linked_matrix_result_ids: string[];
  linked_readiness_reason_ids: string[];
  linked_strength_ids: string[];
  linked_fix_ids: string[];
  linked_timestamp_refs: string[];
  component_status: S10TechniqueComponentStatus;
  applies_to_observed_portion_only: boolean;
  confidence: "low" | "medium" | "high";
  is_named_authority_claim: boolean;
  is_medical_or_health_claim: boolean;
  is_body_or_appearance_claim: boolean;
  is_casting_outcome_claim: boolean;
  is_generic_fallback: false;
};

export type S10TechniqueSection = {
  status: S10TechniqueSectionStatus;
  headline: string;
  observations: S10TechniqueObservation[];
  what_is_working: string[];
  what_could_improve: string[];
  practical_actions: string[];
  preserve: string[];
  not_assessable_reason: string | null;
  confidence: "low" | "medium" | "high";
};

export type S10TechniqueCommentary = {
  summary: string;
  acting: S10TechniqueSection;
  vocal_singing: S10TechniqueSection;
  movement_dance: S10TechniqueSection;
  musical_theatre_package: S10TechniqueSection;
  self_tape_presentation: S10TechniqueSection;
  commercial_screen_task: S10TechniqueSection;
  limitations: string[];
  contradiction_warnings: S10TechniqueWarning[];
};

export type S10TimestampPrecision =
  | "exact"
  | "approximate"
  | "time_banded"
  | "order_only"
  | "unavailable";

export type S10TimestampedSection =
  | "brief_requirement"
  | "observed_component"
  | "strength"
  | "fix"
  | "technique"
  | "technical"
  | "limitation"
  | "next_action"
  | "missing_component";

export type S10TimestampedComponentType =
  | "ident"
  | "acting_scene"
  | "song"
  | "dance"
  | "movement"
  | "transition"
  | "technical"
  | "unknown"
  | "not_applicable";

export type S10TimestampedComponentStatus = S10ProfessionalCritiqueComponentStatus;

export type S10TimestampSourceAuthority =
  | "s10_ai_authored"
  | "s10_normalised"
  | "step1_timestamped_evidence"
  | "evidence_anchor"
  | "provider_output"
  | "legacy_diagnostic_reauthored"
  | "limitation";

export type S10TimestampedWarning = {
  affected_field: string;
  original_value: string | number | boolean | null;
  corrected_value: string | number | boolean | null;
  reason: string;
  source:
    | "s10_ai_judgement"
    | "legacy_raw_report"
    | "legacy_timestamped_notes"
    | "prior_prose"
    | "step1_timestamped_evidence"
    | "evidence_anchor"
    | "provider_output"
    | "s10_normaliser";
  internal_only: true;
};

export type S10TimestampedNote = {
  id: string;
  timecode: string | null;
  start_time: string | null;
  end_time: string | null;
  time_band_label: string | null;
  display_label: string;
  timestamp_precision: S10TimestampPrecision;
  section: S10TimestampedSection;
  title: string;
  detail: string;
  action: string | null;
  evidence_summary: string;
  linked_requirement_ids: string[];
  linked_observed_sequence_ids: string[];
  linked_component_verification_ids: string[];
  linked_matrix_result_ids: string[];
  linked_fix_ids: string[];
  linked_strength_ids: string[];
  linked_technique_observation_ids: string[];
  component_type: S10TimestampedComponentType;
  component_status: S10TimestampedComponentStatus;
  applies_to_observed_portion_only: boolean;
  is_exact_timestamp_supported: boolean;
  is_legacy_timestamp_projection: boolean;
  note_source_authority: S10TimestampSourceAuthority;
  legacy_source_used: boolean;
  legacy_source_path?: string | null;
  is_missing_component_note: boolean;
  is_projection_safe: boolean;
  projection_block_reason?: string | null;
  confidence: "high" | "medium" | "low";
  is_generic_fallback: false;
};

export type S10ComponentTimeRange = {
  component_type: S10TimestampedComponentType;
  label: string;
  start_time: string | null;
  end_time: string | null;
  timestamp_precision: S10TimestampPrecision;
  observed_status: "present" | "partially_present" | "absent" | "not_assessable" | "uncertain";
  completion_status: "complete" | "incomplete" | "cut_off" | "not_applicable" | "uncertain";
  linked_requirement_ids: string[];
  evidence_summary: string;
  confidence: "high" | "medium" | "low";
};

export type S10TimestampProjectionNote = {
  timestamp: string;
  note: string;
  source_note_id: string;
  timestamp_precision: S10TimestampPrecision;
};

export type S10TimestampedCommentary = {
  summary: string;
  notes: S10TimestampedNote[];
  component_ranges: S10ComponentTimeRange[];
  missing_or_unobserved_components: string[];
  timestamp_limitations: string[];
  projection_notes: S10TimestampProjectionNote[];
  legacy_projection_blocked_count: number;
  exact_timestamp_supported_count: number;
  time_banded_note_count: number;
  order_only_note_count: number;
  missing_component_note_count: number;
  contradiction_warnings: S10TimestampedWarning[];
};

export type S10SameVideoStatus =
  | "new_media"
  | "same_video_confirmed"
  | "probable_duplicate"
  | "possible_duplicate"
  | "intentional_retest"
  | "same_video_changed_brief"
  | "same_video_changed_level"
  | "same_video_changed_report_version"
  | "duplicate_in_comparison"
  | "uncertain";

export type S10SameVideoConfidence = "decisive" | "high" | "medium" | "low" | "uncertain";

export type S10SameVideoChangedContext =
  | "same_brief"
  | "changed_brief"
  | "same_level"
  | "changed_level"
  | "same_report_version"
  | "changed_report_version"
  | "unknown";

export type S10MediaIdentitySignalName =
  | "original_upload_file_hash"
  | "file_size_bytes"
  | "video_duration_ms"
  | "metadata_file_name"
  | "original_file_name"
  | "mux_asset_id"
  | "mux_playback_id"
  | "safe_media_fingerprint"
  | "opening_video_sample_hash"
  | "closing_video_sample_hash"
  | "opening_audio_profile_hash"
  | "closing_audio_profile_hash";

export type S10MediaIdentitySignalStatus =
  | "available"
  | "unavailable"
  | "matched"
  | "mismatched"
  | "inconclusive";

export type S10MediaIdentitySignalConfidenceRole = "decisive" | "strong" | "medium" | "weak";

export type S10MediaIdentitySignal = {
  signal_name: S10MediaIdentitySignalName;
  status: S10MediaIdentitySignalStatus;
  confidence_role: S10MediaIdentitySignalConfidenceRole;
  safe_value_summary: string | null;
  value_hash: string | null;
  source: string | null;
  limitation: string | null;
};

export type S10SameVideoEvidence = {
  status: S10SameVideoStatus;
  confidence: S10SameVideoConfidence;
  compared_take_ids: string[];
  current_take_id: string;
  matching_take_ids: string[];
  evidence_signals: S10MediaIdentitySignal[];
  operator_confirmation: string | null;
  changed_context: S10SameVideoChangedContext[];
  report_implication: string;
  performer_facing_summary: string;
  comparison_warning: string | null;
  should_compare_as_distinct_performances: boolean;
  should_reanalyse_against_context: boolean;
  limitations: string[];
};

export type S10ComparisonMode =
  | "single_take"
  | "distinct_takes"
  | "same_video_duplicate"
  | "same_video_retest"
  | "same_video_changed_context"
  | "mixed_same_video_and_distinct_takes"
  | "uncertain";

export type S10ComparisonRecommendationPolicy =
  | "compare_distinct_performances"
  | "compare_contextual_outputs"
  | "do_not_pick_winner"
  | "operator_confirmation_required";

export type S10ComparisonDisplayMode =
  | "hidden"
  | "single_take"
  | "same_video_notice"
  | "comparison_caution"
  | "contextual_comparison";

export type S10ComparedTakeSummary = {
  take_id: string;
  label: string;
  media_identity_summary: string;
  report_context_summary: string | null;
};

export type S10PairwiseSameVideoRelationship =
  | "same_media"
  | "distinct_media"
  | "possible_duplicate"
  | "uncertain";

export type S10PairwiseSameVideoMatch = {
  take_a_label: string;
  take_b_label: string;
  relationship: S10PairwiseSameVideoRelationship;
  confidence: S10SameVideoConfidence;
  matching_signal_names: S10MediaIdentitySignalName[];
  limitations: string[];
};

export type S10ComparisonTruth = {
  comparison_mode: S10ComparisonMode;
  compared_take_summaries: S10ComparedTakeSummary[];
  same_video_status: S10SameVideoEvidence | null;
  recommendation_policy: S10ComparisonRecommendationPolicy;
  performer_facing_summary: string;
  limitations: string[];
  pairwise_matches?: S10PairwiseSameVideoMatch[];
  duplicate_subsets?: string[][];
};

export type S10OperatorDeclaredFixtureType =
  | "incomplete_mandatory_package"
  | "strong_complete_professional"
  | "same_video_duplicate"
  | "same_video_retest"
  | "same_video_changed_brief"
  | "same_video_changed_level"
  | "same_video_changed_report_version"
  | "same_video_uncertain"
  | "unknown";

export type S10OperatorCheckpointConfidence = "confirmed" | "likely" | "uncertain" | "contradicted";

export type S10OperatorCheckpointScope =
  | "deterministic_fixture"
  | "canary_review"
  | "operator_test"
  | "local_dev"
  | "unknown";

export type S10OperatorSameMediaIdentity =
  | "confirmed"
  | "probable"
  | "possible"
  | "distinct"
  | "uncertain"
  | "not_applicable";

export type S10OperatorRerunIntent =
  | "accidental_duplicate"
  | "intentional_retest"
  | "changed_brief"
  | "changed_level"
  | "changed_report_version"
  | "not_applicable"
  | "unknown";

export type S10OperatorAssumptionCheckpoint = {
  checkpoint_id: string;
  fixture_id: string;
  take_id: string | null;
  audition_id: string | null;
  report_context: string;
  declared_fixture_type: S10OperatorDeclaredFixtureType;
  declared_expected_outcome: string;
  same_brief_confirmed: boolean | null;
  same_video_confirmed: boolean | null;
  same_media_identity: S10OperatorSameMediaIdentity;
  rerun_intent: S10OperatorRerunIntent;
  strong_complete_take_confirmed: boolean | null;
  incomplete_mandatory_package_confirmed: boolean | null;
  expected_primary_blocker: string | null;
  expected_secondary_notes: string[];
  score_chips_intentionally_visible: boolean;
  comparison_chips_intentionally_visible: boolean;
  comparison_context: string | null;
  changed_brief_confirmed: boolean | null;
  changed_level_confirmed: boolean | null;
  changed_report_version_confirmed: boolean | null;
  operator_notes: string[];
  created_by_role: "operator" | "developer" | "test" | "system";
  created_at: string;
  confidence: S10OperatorCheckpointConfidence;
  scope: S10OperatorCheckpointScope;
};

export type S10OperatorExpectation = {
  expected_recommendation: ReadinessDecision | null;
  expected_brief_achievement_status: BriefAchievementOverallStatus | null;
  expected_missing_requirements: string[];
  expected_present_requirements: string[];
  expected_not_assessable_areas: string[];
  expected_fix_first: string | null;
  expected_score_band: ReadinessScoreBandLabel | null;
  expected_same_video_status: S10SameVideoStatus | null;
  expected_comparison_policy: S10ComparisonRecommendationPolicy | null;
  expected_forbidden_phrases: string[];
  expected_required_phrases: string[];
};

export type S10OperatorAssumptionMismatchType =
  | "brief_extraction_mismatch"
  | "component_observation_mismatch"
  | "brief_achievement_mismatch"
  | "readiness_score_mismatch"
  | "fix_hierarchy_mismatch"
  | "professional_critique_mismatch"
  | "technique_commentary_mismatch"
  | "timestamped_commentary_mismatch"
  | "route_projection_mismatch"
  | "same_video_classification_mismatch"
  | "fixture_expectation_mismatch"
  | "operator_assumption_missing"
  | "operator_assumption_uncertain";

export type S10OperatorAssumptionComparisonStatus =
  | "matches_operator_expectation"
  | "partially_matches_operator_expectation"
  | "contradicts_operator_expectation"
  | "assumption_missing"
  | "assumption_uncertain"
  | "not_applicable";

export type S10OperatorAssumptionNextStep =
  | "accept_fixture"
  | "review_ai_observation"
  | "review_prompt_contract"
  | "review_route_projection"
  | "ask_operator"
  | "not_applicable";

export type S10OperatorAssumptionMismatch = {
  mismatch_type: S10OperatorAssumptionMismatchType;
  field: string;
  expected: string | number | boolean | null;
  actual: string | number | boolean | null;
  message: string;
};

export type S10OperatorAssumptionComparison = {
  checkpoint_id: string | null;
  report_id_or_fixture_id: string | null;
  comparison_status: S10OperatorAssumptionComparisonStatus;
  mismatches: S10OperatorAssumptionMismatch[];
  matched_expectations: string[];
  unresolved_assumptions: string[];
  recommended_next_step: S10OperatorAssumptionNextStep;
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
