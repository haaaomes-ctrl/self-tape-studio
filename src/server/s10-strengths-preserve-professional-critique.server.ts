// SERVER-ONLY. S10.7 strengths / preserve / professional critique validation.
//
// The AI authors strengths and professional notes. Code validates them against
// normalized S10.3/S10.4/S10.5/S10.6 output, rejects legacy false positives,
// and projects only the safe subset into legacy-compatible report fields.

import type {
  BriefAchievementMatrix,
  ReadinessAndScoreJudgement,
  S10FixHierarchy,
  S10NextActionPlan,
  S10PreserveItem,
  S10ProfessionalCritique,
  S10ProfessionalCritiqueComponentStatus,
  S10ProfessionalCritiqueSourceCategory,
  S10ProfessionalCritiqueWarning,
  S10StrengthItem,
} from "@/lib/audition-rules";
import type { ComponentVerification, MediaObservationSummary } from "./evidence-pass.server";

type Confidence = "low" | "medium" | "high";

const SOURCE_CATEGORIES: S10ProfessionalCritiqueSourceCategory[] = [
  "brief",
  "performance",
  "acting",
  "vocal",
  "movement",
  "technical",
  "presentation",
  "package",
  "limitation",
];

const COMPONENT_STATUSES: S10ProfessionalCritiqueComponentStatus[] = [
  "present",
  "partially_present",
  "absent",
  "not_assessable",
  "uncertain",
  "not_applicable",
];

export const S10_FORBIDDEN_PROFESSIONAL_CRITIQUE_PHRASES = [
  "This affects readability, not talent.",
  "Preserve the clearest choices already captured.",
  "The strongest choices are worth keeping.",
  "Continue refining the performance.",
  "Good effort.",
  "Strong choices.",
  "Keep doing what works.",
  "Professional presentation",
  "Naturalistic acting",
  "Correct material",
  "Single-file submission as requested",
  "complete song package",
  "perfectly suits the brief",
  "strong storytelling through the song",
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

function stringList(value: unknown, limit = 12): string[] {
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
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function hasForbiddenProfessionalCritiquePhrase(value: string): boolean {
  const key = normaliseKey(value);
  return S10_FORBIDDEN_PROFESSIONAL_CRITIQUE_PHRASES.some((phrase) =>
    key.includes(normaliseKey(phrase)),
  );
}

function addWarning(
  warnings: S10ProfessionalCritiqueWarning[],
  warning: Omit<S10ProfessionalCritiqueWarning, "internal_only">,
) {
  const key = `${warning.affected_field}:${warning.source}:${warning.original_value}:${warning.corrected_value}`;
  if (
    warnings.some(
      (item) =>
        `${item.affected_field}:${item.source}:${item.original_value}:${item.corrected_value}` ===
        key,
    )
  ) {
    return;
  }
  warnings.push({ ...warning, internal_only: true });
}

function requirementText(item: BriefAchievementMatrix["requirement_results"][number]): string {
  return `${item.requirement_summary} ${item.evidence_summary} ${item.recommended_action}`.toLowerCase();
}

function isSideActingRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\b(side\s*1|acting scene|requested scene|side)\b/i.test(requirementText(item));
}

function isSongRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\bsong|mt song|musical theatre|vocal\b/i.test(requirementText(item));
}

function isPackageRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\b(package|continuous|one file|single file|final file|upload|correct material|full package)\b/i.test(
    requirementText(item),
  );
}

function isBlockedOrAbsent(item: BriefAchievementMatrix["requirement_results"][number]) {
  return (
    item.observed_status === "absent" ||
    item.achievement_status === "not_achieved" ||
    item.submission_impact === "submission_blocker"
  );
}

function isPartialOrIncomplete(item: BriefAchievementMatrix["requirement_results"][number]) {
  return (
    item.observed_status === "partially_present" ||
    item.achievement_status === "partly_achieved" ||
    item.completion_status === "incomplete" ||
    item.completion_status === "cut_off" ||
    item.completion_status === "uncertain" ||
    item.submission_impact === "material_gap"
  );
}

function sideActingAbsent(matrix: BriefAchievementMatrix): boolean {
  return matrix.requirement_results.some(
    (item) => isSideActingRequirement(item) && isBlockedOrAbsent(item),
  );
}

function songPartialOrIncomplete(matrix: BriefAchievementMatrix): boolean {
  return matrix.requirement_results.some(
    (item) => isSongRequirement(item) && isPartialOrIncomplete(item),
  );
}

function packageIncomplete(matrix: BriefAchievementMatrix): boolean {
  if (matrix.overall_status === "achieved" && matrix.mandatory_status === "clear") return false;
  return matrix.requirement_results.some(
    (item) =>
      (isPackageRequirement(item) || isSideActingRequirement(item) || isSongRequirement(item)) &&
      (isBlockedOrAbsent(item) || isPartialOrIncomplete(item)),
  );
}

function isStrongComplete(matrix: BriefAchievementMatrix, readiness: ReadinessAndScoreJudgement) {
  return (
    (matrix.overall_status === "achieved" || matrix.overall_status === "mostly_achieved") &&
    matrix.mandatory_status === "clear" &&
    readiness.brief_blocker_override !== true &&
    (readiness.decision === "submit" || readiness.decision === "submit_if_deadline_is_close")
  );
}

function isActingLike(
  item: Pick<S10StrengthItem, "source_category" | "title" | "detail" | "evidence_summary">,
) {
  return (
    item.source_category === "acting" ||
    /\b(acting|scene|side|character|naturalistic|pace|warmth|wit|objective|text)\b/i.test(
      `${item.title} ${item.detail} ${item.evidence_summary}`,
    )
  );
}

function isSongLike(
  item: Pick<S10StrengthItem, "source_category" | "title" | "detail" | "evidence_summary">,
) {
  return (
    item.source_category === "vocal" ||
    /\b(song|singing|vocal|lyric|legit|mt|musical theatre)\b/i.test(
      `${item.title} ${item.detail} ${item.evidence_summary}`,
    )
  );
}

function isPackageClaim(value: string): boolean {
  return /\b(correct material|complete package|full package|single[- ]file submission|one file as requested|all required material|as requested)\b/i.test(
    value,
  );
}

function observedPortionText(value: string): string {
  if (/\bobserved portion|heard portion|visible portion|available portion\b/i.test(value))
    return value;
  return `For the observed portion only: ${value}`;
}

function normaliseStrengthItem(
  value: unknown,
  fallbackId: string,
  warnings: S10ProfessionalCritiqueWarning[],
  fieldPath: string,
  context: {
    sideAbsent: boolean;
    songPartial: boolean;
    packageIncomplete: boolean;
  },
): S10StrengthItem | null {
  if (!isRecord(value)) return null;
  const item: S10StrengthItem = {
    id: text(value.id, fallbackId),
    title: text(value.title),
    detail: text(value.detail),
    why_it_matters: text(value.why_it_matters),
    evidence_summary: text(value.evidence_summary),
    source_category: oneOf(value.source_category, SOURCE_CATEGORIES, "limitation"),
    linked_requirement_ids: stringList(value.linked_requirement_ids),
    linked_component_verification_ids: stringList(value.linked_component_verification_ids),
    linked_matrix_result_ids: stringList(value.linked_matrix_result_ids),
    linked_readiness_reason_ids: stringList(value.linked_readiness_reason_ids),
    linked_fix_ids: stringList(value.linked_fix_ids),
    confidence: oneOf(value.confidence, ["low", "medium", "high"], "low") as Confidence,
    is_component_verified: Boolean(value.is_component_verified),
    component_status: oneOf(value.component_status, COMPONENT_STATUSES, "uncertain"),
    applies_to_observed_portion_only: Boolean(value.applies_to_observed_portion_only),
    is_generic_fallback: false,
  };
  const combined = `${item.title} ${item.detail} ${item.why_it_matters} ${item.evidence_summary}`;
  if (!item.title || !item.detail || hasForbiddenProfessionalCritiquePhrase(combined)) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined || value),
      corrected_value: null,
      reason: "S10.7 rejected missing, generic or unsafe strength prose.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  if (
    item.component_status === "absent" ||
    (item.component_status === "not_assessable" && item.source_category !== "limitation") ||
    (!item.is_component_verified &&
      item.source_category !== "technical" &&
      item.source_category !== "presentation" &&
      item.source_category !== "limitation")
  ) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined),
      corrected_value: null,
      reason: "S10.7 rejected praise for an absent or unverified component.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  if (context.sideAbsent && isActingLike(item)) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined),
      corrected_value: "acting-scene limitation",
      reason:
        "The required Side 1 acting scene is absent, so acting strengths cannot be projected.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  if (context.packageIncomplete && isPackageClaim(combined)) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined),
      corrected_value: null,
      reason:
        "The required material package is incomplete, so complete-package strengths are unsafe.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  if (context.songPartial && isSongLike(item)) {
    item.applies_to_observed_portion_only = true;
    item.title = observedPortionText(item.title);
    item.detail = observedPortionText(item.detail);
    item.why_it_matters = observedPortionText(item.why_it_matters || item.detail);
    item.evidence_summary = observedPortionText(item.evidence_summary || item.detail);
  }
  return item;
}

function normaliseStrengthArray(
  value: unknown,
  warnings: S10ProfessionalCritiqueWarning[],
  fieldPath: string,
  context: {
    sideAbsent: boolean;
    songPartial: boolean;
    packageIncomplete: boolean;
  },
  limit = 8,
): S10StrengthItem[] {
  if (!Array.isArray(value)) return [];
  const out: S10StrengthItem[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const item = normaliseStrengthItem(
      raw,
      `${fieldPath}_${index + 1}`,
      warnings,
      `${fieldPath}[${index}]`,
      context,
    );
    if (!item) continue;
    const key = normaliseKey(`${item.title} ${item.detail}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function normalisePreserveItem(
  value: unknown,
  fallbackId: string,
  warnings: S10ProfessionalCritiqueWarning[],
  fieldPath: string,
  context: { sideAbsent: boolean; packageIncomplete: boolean },
): S10PreserveItem | null {
  if (!isRecord(value)) return null;
  const item: S10PreserveItem = {
    id: text(value.id, fallbackId),
    title: text(value.title),
    detail: text(value.detail),
    evidence_summary: text(value.evidence_summary),
    why_to_preserve: text(value.why_to_preserve),
    linked_component_verification_ids: stringList(value.linked_component_verification_ids),
    confidence: oneOf(value.confidence, ["low", "medium", "high"], "low") as Confidence,
    is_generic_fallback: false,
  };
  const combined = `${item.title} ${item.detail} ${item.evidence_summary} ${item.why_to_preserve}`;
  if (!item.title || !item.detail || hasForbiddenProfessionalCritiquePhrase(combined)) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined || value),
      corrected_value: null,
      reason: "S10.7 rejected missing or generic preserve prose.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  if (
    (context.sideAbsent && /\b(acting scene|side|naturalistic acting)\b/i.test(combined)) ||
    (context.packageIncomplete && isPackageClaim(combined))
  ) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined),
      corrected_value: null,
      reason: "S10.7 rejected preserve guidance that contradicts the S10 blocker state.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  return item;
}

function normalisePreserveArray(
  value: unknown,
  warnings: S10ProfessionalCritiqueWarning[],
  fieldPath: string,
  context: { sideAbsent: boolean; packageIncomplete: boolean },
  limit = 8,
): S10PreserveItem[] {
  if (!Array.isArray(value)) return [];
  const out: S10PreserveItem[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const item = normalisePreserveItem(
      raw,
      `${fieldPath}_${index + 1}`,
      warnings,
      `${fieldPath}[${index}]`,
      context,
    );
    if (!item) continue;
    const key = normaliseKey(`${item.title} ${item.detail}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function addLegacyWarnings(args: {
  report?: Record<string, unknown>;
  warnings: S10ProfessionalCritiqueWarning[];
  sideAbsent: boolean;
  packageIncomplete: boolean;
}) {
  const raw = args.report && isRecord(args.report.raw_report) ? args.report.raw_report : null;
  const legacyFields: Array<[string, unknown, S10ProfessionalCritiqueWarning["source"]]> = [
    ["raw_report.strengths", raw?.strengths, "legacy_raw_report"],
    ["raw_report.category_rationale", raw?.category_rationale, "legacy_category_rationale"],
    ["raw_report.category_notes", raw?.category_notes, "legacy_category_notes"],
    ["raw_report.presentation_notes", raw?.presentation_notes, "legacy_raw_report"],
    ["raw_report.coaching_drills", raw?.coaching_drills, "legacy_coaching_drills"],
    ["raw_report.detected_components", raw?.detected_components, "legacy_raw_report"],
    [
      "technique_observation_trace",
      args.report?.technique_observation_trace,
      "legacy_technique_trace",
    ],
  ];
  for (const [field, value, source] of legacyFields) {
    const rendered = isRecord(value) || Array.isArray(value) ? JSON.stringify(value) : text(value);
    if (!rendered) continue;
    const unsafe =
      field === "technique_observation_trace" ||
      hasForbiddenProfessionalCritiquePhrase(rendered) ||
      (args.sideAbsent && /\b(acting|scene|naturalistic|warmth|wit|pace)\b/i.test(rendered)) ||
      (args.packageIncomplete && isPackageClaim(rendered));
    if (!unsafe) continue;
    addWarning(args.warnings, {
      affected_field: field,
      original_value: scalar(value),
      corrected_value: "diagnostic_only",
      reason:
        "Legacy strengths/prose are diagnostic only and cannot create S10 professional critique.",
      source,
    });
  }
}

function dedupeStrings(values: string[], limit = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values.map((item) => text(item)).filter(Boolean)) {
    if (hasForbiddenProfessionalCritiquePhrase(value)) continue;
    const key = normaliseKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function allStrengthItems(critique: S10ProfessionalCritique): S10StrengthItem[] {
  return [
    ...critique.performance_strengths,
    ...critique.brief_package_strengths,
    ...critique.technical_presentation_strengths,
    ...critique.vocal_or_singing_strengths,
    ...critique.acting_strengths,
    ...critique.movement_or_physical_strengths,
    ...critique.professional_presentation_notes,
  ];
}

function strengthProjection(item: S10StrengthItem): string {
  const prefix = item.applies_to_observed_portion_only ? "Observed portion only: " : "";
  return `${prefix}${item.title}: ${item.detail}`;
}

function preserveProjection(item: S10PreserveItem): string {
  return `${item.title}: ${item.detail}`;
}

function ensureLimitation(limitations: string[], value: string) {
  if (!limitations.some((item) => normaliseKey(item) === normaliseKey(value))) {
    limitations.push(value);
  }
}

function mediaSupportsFraming(summary: MediaObservationSummary | null | undefined) {
  return Boolean(summary?.framing_assessable || summary?.video_assessable);
}

export function normaliseS10ProfessionalCritique(input: {
  critique: unknown;
  matrix: BriefAchievementMatrix;
  readiness: ReadinessAndScoreJudgement;
  fixHierarchy: S10FixHierarchy;
  nextActionPlan?: S10NextActionPlan | null;
  componentVerifications?: ComponentVerification[];
  mediaObservationSummary?: MediaObservationSummary | null;
  report?: Record<string, unknown>;
}): S10ProfessionalCritique {
  const raw = isRecord(input.critique) ? input.critique : {};
  const warnings: S10ProfessionalCritiqueWarning[] = [];
  const sideAbsent = sideActingAbsent(input.matrix);
  const songPartial = songPartialOrIncomplete(input.matrix);
  const incompletePackage = packageIncomplete(input.matrix);
  const context = {
    sideAbsent,
    songPartial,
    packageIncomplete: incompletePackage,
  };
  const preserveContext = {
    sideAbsent,
    packageIncomplete: incompletePackage,
  };
  const critique: S10ProfessionalCritique = {
    summary: text(raw.summary),
    performance_strengths: normaliseStrengthArray(
      raw.performance_strengths,
      warnings,
      "s10_professional_critique.performance_strengths",
      context,
    ),
    brief_package_strengths: normaliseStrengthArray(
      raw.brief_package_strengths,
      warnings,
      "s10_professional_critique.brief_package_strengths",
      context,
    ),
    technical_presentation_strengths: normaliseStrengthArray(
      raw.technical_presentation_strengths,
      warnings,
      "s10_professional_critique.technical_presentation_strengths",
      context,
    ),
    vocal_or_singing_strengths: normaliseStrengthArray(
      raw.vocal_or_singing_strengths,
      warnings,
      "s10_professional_critique.vocal_or_singing_strengths",
      context,
    ),
    acting_strengths: normaliseStrengthArray(
      raw.acting_strengths,
      warnings,
      "s10_professional_critique.acting_strengths",
      context,
    ),
    movement_or_physical_strengths: normaliseStrengthArray(
      raw.movement_or_physical_strengths,
      warnings,
      "s10_professional_critique.movement_or_physical_strengths",
      context,
    ),
    professional_presentation_notes: normaliseStrengthArray(
      raw.professional_presentation_notes,
      warnings,
      "s10_professional_critique.professional_presentation_notes",
      context,
    ),
    preserve: normalisePreserveArray(
      raw.preserve,
      warnings,
      "s10_professional_critique.preserve",
      preserveContext,
    ),
    do_not_overfix: normalisePreserveArray(
      raw.do_not_overfix,
      warnings,
      "s10_professional_critique.do_not_overfix",
      preserveContext,
    ),
    critique_limitations: stringList(raw.critique_limitations, 12).filter(
      (item) => !hasForbiddenProfessionalCritiquePhrase(item),
    ),
    contradiction_warnings: [],
  };

  if (sideAbsent) {
    ensureLimitation(
      critique.critique_limitations,
      "The required Side 1 acting scene was not identified, so acting-scene strengths cannot be assessed from this tape.",
    );
  }
  if (songPartial) {
    ensureLimitation(
      critique.critique_limitations,
      "Song and vocal strengths can only apply to the observed portion because completion is partial, cut off or uncertain.",
    );
  }
  if (incompletePackage) {
    ensureLimitation(
      critique.critique_limitations,
      "Package strengths cannot be treated as complete until all mandatory required material is present in the final file.",
    );
  }

  const strongComplete = isStrongComplete(input.matrix, input.readiness);
  if (strongComplete) {
    if (allStrengthItems(critique).length === 0) {
      ensureLimitation(
        critique.critique_limitations,
        "The S10 professional critique did not supply a specific strength despite the completed package; rerun for fuller positive guidance.",
      );
      addWarning(warnings, {
        affected_field: "s10_professional_critique",
        original_value: null,
        corrected_value: "strong_complete_specific_strength_limitation",
        reason: "Strong-complete reports need specific positive value, not an empty shell.",
        source: "s10_normaliser",
      });
    }
    if (critique.preserve.length === 0) {
      ensureLimitation(
        critique.critique_limitations,
        "The S10 professional critique did not supply a specific preserve item for the completed package.",
      );
    }
    if (critique.do_not_overfix.length === 0) {
      ensureLimitation(
        critique.critique_limitations,
        "The S10 professional critique did not supply a specific do-not-overfix note.",
      );
    }
    if (!text(input.readiness.professional_nuance_summary)) {
      ensureLimitation(
        critique.critique_limitations,
        "The readiness judgement did not include professional nuance beyond the score.",
      );
    }
  }

  addLegacyWarnings({
    report: input.report,
    warnings,
    sideAbsent,
    packageIncomplete: incompletePackage,
  });

  critique.contradiction_warnings = warnings;
  return critique;
}

function projectCategoryNotes(args: {
  report: Record<string, unknown>;
  critique: S10ProfessionalCritique;
  matrix: BriefAchievementMatrix;
  mediaObservationSummary?: MediaObservationSummary | null;
}) {
  const notes = isRecord(args.report.category_notes)
    ? { ...(args.report.category_notes as Record<string, unknown>) }
    : {};
  const sideAbsent = sideActingAbsent(args.matrix);
  const songPartial = songPartialOrIncomplete(args.matrix);
  const technical = args.critique.technical_presentation_strengths[0];
  const vocal = args.critique.vocal_or_singing_strengths[0];
  const presentation = args.critique.professional_presentation_notes[0];
  if (sideAbsent) {
    notes.acting =
      "The required Side 1 acting scene was not identified, so acting-scene strengths cannot be assessed from this tape.";
  }
  if (songPartial && vocal) {
    notes.vocal = `Observed portion only: ${vocal.detail}`;
  }
  if (technical && mediaSupportsFraming(args.mediaObservationSummary)) {
    notes.technical = technical.detail;
  }
  if (presentation) {
    notes.professional_presentation = presentation.detail;
  } else if (typeof notes.professional_presentation === "string") {
    notes.professional_presentation = hasForbiddenProfessionalCritiquePhrase(
      notes.professional_presentation,
    )
      ? ""
      : notes.professional_presentation;
  }
  args.report.category_notes = scrubObjectStrings(notes);
}

function projectCategoryRationale(args: {
  report: Record<string, unknown>;
  matrix: BriefAchievementMatrix;
}) {
  const rationale = isRecord(args.report.category_rationale)
    ? { ...(args.report.category_rationale as Record<string, unknown>) }
    : {};
  if (sideActingAbsent(args.matrix)) {
    rationale.acting = {
      what_works: "",
      why_not_full_score:
        "The required Side 1 acting scene was not identified, so acting-scene strengths cannot be assessed from this tape.",
      close_gap: "Record/include the required Side 1 acting scene before submitting.",
      standout_delta: "",
    };
  }
  if (packageIncomplete(args.matrix)) {
    rationale.brief_adherence = {
      what_works: "",
      why_not_full_score:
        "The required material package is incomplete, so legacy correct-material or single-file strengths cannot be used.",
      close_gap:
        "Check the final file contains all mandatory material, including the required acting scene and complete song where applicable.",
      standout_delta: "",
    };
  }
  args.report.category_rationale = scrubObjectStrings(rationale);
}

function scrubString(value: string): string | null {
  return hasForbiddenProfessionalCritiquePhrase(value) ? null : value;
}

function scrubArrayStrings(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return dedupeStrings(
    value
      .map((item) => text(item))
      .filter(Boolean)
      .filter((item) => !hasForbiddenProfessionalCritiquePhrase(item)),
    limit,
  );
}

function scrubObjectStrings(value: unknown): unknown {
  if (typeof value === "string") return scrubString(value) ?? "";
  if (Array.isArray(value)) return value.map(scrubObjectStrings).filter((item) => item !== "");
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = scrubObjectStrings(child);
    }
    return out;
  }
  return value;
}

export function scrubS10ProfessionalCritiqueProjection(report: Record<string, unknown>): {
  removed: number;
} {
  let removed = 0;
  const scrubFieldArray = (field: string, limit: number) => {
    const before = Array.isArray(report[field]) ? (report[field] as unknown[]).length : 0;
    report[field] = scrubArrayStrings(report[field], limit);
    removed += before - ((report[field] as unknown[])?.length ?? 0);
  };
  scrubFieldArray("strengths", 12);
  scrubFieldArray("presentation_notes", 6);
  scrubFieldArray("coaching_drills", 15);
  if (report.category_notes) report.category_notes = scrubObjectStrings(report.category_notes);
  if (report.category_rationale) {
    report.category_rationale = scrubObjectStrings(report.category_rationale);
  }
  if (report.s10_professional_critique) {
    report.s10_professional_critique = scrubObjectStrings(report.s10_professional_critique);
  }
  return { removed };
}

export function applyS10ProfessionalCritique(input: {
  report: Record<string, unknown>;
  matrix: BriefAchievementMatrix;
  readiness: ReadinessAndScoreJudgement;
  fixHierarchy: S10FixHierarchy;
  nextActionPlan?: S10NextActionPlan | null;
  componentVerifications?: ComponentVerification[];
  mediaObservationSummary?: MediaObservationSummary | null;
}): {
  critique: S10ProfessionalCritique;
  warnings: S10ProfessionalCritiqueWarning[];
} {
  const critique = normaliseS10ProfessionalCritique({
    critique: input.report.s10_professional_critique,
    matrix: input.matrix,
    readiness: input.readiness,
    fixHierarchy: input.fixHierarchy,
    nextActionPlan: input.nextActionPlan,
    componentVerifications: input.componentVerifications,
    mediaObservationSummary: input.mediaObservationSummary,
    report: input.report,
  });
  input.report.s10_professional_critique = critique;
  const projectedStrengths = allStrengthItems(critique).map(strengthProjection);
  input.report.strengths =
    projectedStrengths.length > 0
      ? dedupeStrings(projectedStrengths, 12)
      : dedupeStrings(critique.critique_limitations, 6);
  projectCategoryNotes({
    report: input.report,
    critique,
    matrix: input.matrix,
    mediaObservationSummary: input.mediaObservationSummary,
  });
  projectCategoryRationale({ report: input.report, matrix: input.matrix });
  input.report.presentation_notes = dedupeStrings(
    [
      ...critique.professional_presentation_notes.map(strengthProjection),
      ...critique.technical_presentation_strengths.map(strengthProjection),
      ...scrubArrayStrings(input.report.presentation_notes, 6),
    ],
    6,
  );
  input.report.coaching_drills = scrubArrayStrings(input.report.coaching_drills, 15);
  const existingNextPlan = isRecord(input.report.next_take_plan)
    ? { ...(input.report.next_take_plan as Record<string, unknown>) }
    : {};
  existingNextPlan.do_not_overfix = dedupeStrings(
    [
      ...critique.do_not_overfix.map(preserveProjection),
      ...critique.preserve.map((item) => `Preserve: ${preserveProjection(item)}`),
      ...stringList(existingNextPlan.do_not_overfix, 8),
    ],
    8,
  );
  input.report.next_take_plan = existingNextPlan;
  scrubS10ProfessionalCritiqueProjection(input.report);
  return {
    critique,
    warnings: critique.contradiction_warnings,
  };
}
