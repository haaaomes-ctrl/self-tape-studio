// SERVER-ONLY. S10.8 technique-library commentary validation.
//
// The AI authors technique commentary. Code validates it against normalised
// S10.3/S10.4/S10.7 evidence, rejects legacy trace false positives, and
// projects only safe subsets into legacy-compatible report fields.

import type {
  BriefAchievementMatrix,
  ReadinessAndScoreJudgement,
  S10FixHierarchy,
  S10NextActionPlan,
  S10ProfessionalCritique,
  S10TechniqueArea,
  S10TechniqueCommentary,
  S10TechniqueComponentStatus,
  S10TechniqueObservation,
  S10TechniqueSection,
  S10TechniqueSectionStatus,
  S10TechniqueWarning,
} from "@/lib/audition-rules";
import type { ComponentVerification, MediaObservationSummary } from "./evidence-pass.server";

type Confidence = "low" | "medium" | "high";

const TECHNIQUE_AREAS: S10TechniqueArea[] = [
  "acting",
  "vocal_singing",
  "movement_dance",
  "musical_theatre_package",
  "self_tape_presentation",
  "commercial_screen_task",
];

const SECTION_STATUSES: S10TechniqueSectionStatus[] = [
  "assessable",
  "partially_assessable",
  "not_assessable",
  "not_applicable",
];

const COMPONENT_STATUSES: S10TechniqueComponentStatus[] = [
  "present",
  "partially_present",
  "absent",
  "not_assessable",
  "uncertain",
  "not_applicable",
];

export const S10_FORBIDDEN_TECHNIQUE_COMMENTARY_PHRASES = [
  "Naturalistic acting with good pace",
  "Strong contemporary legit vocal with clear storytelling",
  "Excellent technique",
  "Professional technique",
  "Bookable",
  "Castable",
  "Callback-ready",
  "Healthy voice",
  "Vocal damage",
  "Vocal pathology",
  "Just keep doing what you are doing",
  "Continue refining your technique",
  "Complete song package",
  "Complete package",
];

const CASTING_OUTCOME_RE =
  /\b(bookable|castable|callback[-\s]?ready|recall[-\s]?ready|booking|booked|hire|hired|job|employment|will get cast|guaranteed)\b/i;
const MEDICAL_RE =
  /\b(healthy voice|vocal damage|vocal pathology|nodules?|medical|diagnos(?:e|is)|injur(?:y|ed)|strain|vocal health|pathology)\b/i;
const BODY_OR_PROTECTED_RE =
  /\b(body|appearance|weight|thin|heavy|attractive|pretty|handsome|age|race|ethnicity|gender|class|disability|mobility aid|medical device)\b/i;
const UNSUPPORTED_CERTAINTY_RE =
  /\b(always|guaranteed|perfect technique|flawless technique|will definitely)\b/i;

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

function addWarning(
  warnings: S10TechniqueWarning[],
  warning: Omit<S10TechniqueWarning, "internal_only">,
) {
  const originalValue =
    typeof warning.original_value === "string" &&
    hasForbiddenTechniqueCommentaryPhrase(warning.original_value)
      ? "removed_unsafe_technique_prose"
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

export function hasForbiddenTechniqueCommentaryPhrase(value: string): boolean {
  const key = normaliseKey(value);
  if (!key) return false;
  return (
    S10_FORBIDDEN_TECHNIQUE_COMMENTARY_PHRASES.some((phrase) =>
      key.includes(normaliseKey(phrase)),
    ) ||
    CASTING_OUTCOME_RE.test(value) ||
    MEDICAL_RE.test(value) ||
    BODY_OR_PROTECTED_RE.test(value) ||
    UNSUPPORTED_CERTAINTY_RE.test(value)
  );
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

function isMovementRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\bdance|movement|choreo|physical\b/i.test(requirementText(item));
}

function isPackageRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\b(package|continuous|one file|single file|final file|upload|acting scene and the song|side 1.*song)\b/i.test(
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

function actingRequired(matrix: BriefAchievementMatrix): boolean {
  return matrix.requirement_results.some(isActingRequirement);
}

function actingVerified(componentVerifications: ComponentVerification[] = []): boolean {
  return componentVerifications.some(
    (item) =>
      /\b(side\s*1|acting scene|scene|monologue|acting)\b/i.test(
        `${item.requirement_summary} ${item.evidence_summary}`,
      ) &&
      item.observed_from_media === true &&
      item.evidence_basis === "observed_audio_video" &&
      (item.observed_status === "present" || item.observed_status === "partially_present"),
  );
}

function requiredActingMissing(
  matrix: BriefAchievementMatrix,
  componentVerifications: ComponentVerification[] = [],
): boolean {
  return (
    actingRequired(matrix) &&
    (!actingVerified(componentVerifications) ||
      matrix.requirement_results.some(
        (item) => isActingRequirement(item) && isBlockedOrAbsent(item),
      ))
  );
}

function songPartialOrIncomplete(matrix: BriefAchievementMatrix): boolean {
  return matrix.requirement_results.some(
    (item) => isSongRequirement(item) && isPartialOrIncomplete(item),
  );
}

function songVerified(componentVerifications: ComponentVerification[] = []): boolean {
  return componentVerifications.some(
    (item) =>
      /\bsong|singing|vocal|musical theatre|mt song\b/i.test(
        `${item.requirement_summary} ${item.evidence_summary}`,
      ) &&
      item.observed_from_media === true &&
      item.evidence_basis === "observed_audio_video" &&
      (item.observed_status === "present" || item.observed_status === "partially_present"),
  );
}

function packageIncomplete(matrix: BriefAchievementMatrix): boolean {
  if (matrix.overall_status === "achieved" && matrix.mandatory_status === "clear") return false;
  return matrix.requirement_results.some(
    (item) =>
      (isPackageRequirement(item) || isActingRequirement(item) || isSongRequirement(item)) &&
      (isBlockedOrAbsent(item) || isPartialOrIncomplete(item)),
  );
}

function movementRequired(matrix: BriefAchievementMatrix): boolean {
  return matrix.requirement_results.some(isMovementRequirement);
}

function movementVerified(componentVerifications: ComponentVerification[] = []): boolean {
  return componentVerifications.some(
    (item) =>
      /\bdance|movement|choreo|physical\b/i.test(
        `${item.requirement_summary} ${item.evidence_summary}`,
      ) &&
      item.observed_from_media === true &&
      item.evidence_basis === "observed_audio_video" &&
      (item.observed_status === "present" || item.observed_status === "partially_present"),
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

function observedPortionText(value: string): string {
  if (!value) return value;
  if (/\bobserved portion|heard portion|visible portion|available portion\b/i.test(value)) {
    return value;
  }
  return `Observed portion only: ${value}`;
}

function safeString(value: string): string {
  return hasForbiddenTechniqueCommentaryPhrase(value) ? "" : value;
}

function scrubStringArray(values: string[], limit = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values.map((item) => text(item)).filter(Boolean)) {
    if (hasForbiddenTechniqueCommentaryPhrase(raw)) continue;
    const key = normaliseKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= limit) break;
  }
  return out;
}

function blankTechniqueSection(
  status: S10TechniqueSectionStatus,
  headline: string,
  notAssessableReason: string | null,
): S10TechniqueSection {
  return {
    status,
    headline,
    observations: [],
    what_is_working: [],
    what_could_improve: [],
    practical_actions: [],
    preserve: [],
    not_assessable_reason: notAssessableReason,
    confidence: status === "not_applicable" ? "high" : "low",
  };
}

function normaliseObservation(
  value: unknown,
  fallbackId: string,
  area: S10TechniqueArea,
  warnings: S10TechniqueWarning[],
  fieldPath: string,
  context: {
    actingMissing: boolean;
    songPartial: boolean;
    incompletePackage: boolean;
  },
): S10TechniqueObservation | null {
  if (!isRecord(value)) return null;
  const observation: S10TechniqueObservation = {
    id: text(value.id, fallbackId),
    technique_area: oneOf(value.technique_area, TECHNIQUE_AREAS, area),
    title: text(value.title),
    detail: text(value.detail),
    evidence_summary: text(value.evidence_summary),
    linked_requirement_ids: stringList(value.linked_requirement_ids),
    linked_component_verification_ids: stringList(value.linked_component_verification_ids),
    linked_matrix_result_ids: stringList(value.linked_matrix_result_ids),
    linked_readiness_reason_ids: stringList(value.linked_readiness_reason_ids),
    linked_strength_ids: stringList(value.linked_strength_ids),
    linked_fix_ids: stringList(value.linked_fix_ids),
    linked_timestamp_refs: stringList(value.linked_timestamp_refs),
    component_status: oneOf(value.component_status, COMPONENT_STATUSES, "uncertain"),
    applies_to_observed_portion_only: Boolean(value.applies_to_observed_portion_only),
    confidence: oneOf(value.confidence, ["low", "medium", "high"], "low") as Confidence,
    is_named_authority_claim: Boolean(value.is_named_authority_claim),
    is_medical_or_health_claim: Boolean(value.is_medical_or_health_claim),
    is_body_or_appearance_claim: Boolean(value.is_body_or_appearance_claim),
    is_casting_outcome_claim: Boolean(value.is_casting_outcome_claim),
    is_generic_fallback: false,
  };
  const combined = `${observation.title} ${observation.detail} ${observation.evidence_summary}`;
  const unsafe =
    !observation.title ||
    !observation.detail ||
    hasForbiddenTechniqueCommentaryPhrase(combined) ||
    observation.is_medical_or_health_claim ||
    observation.is_body_or_appearance_claim ||
    observation.is_casting_outcome_claim ||
    observation.is_generic_fallback;
  if (unsafe) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined || value),
      corrected_value: null,
      reason: "S10.8 rejected generic, unsupported or high-risk technique prose.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  if (context.actingMissing && area === "acting") {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined),
      corrected_value: "acting_not_assessable",
      reason:
        "The required acting scene is missing, so acting-scene technique commentary cannot be projected.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  if (
    observation.component_status === "absent" ||
    observation.component_status === "not_assessable"
  ) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined),
      corrected_value: null,
      reason: "S10.8 rejected technique commentary for an absent or not-assessable component.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  if (context.songPartial && area === "vocal_singing") {
    observation.applies_to_observed_portion_only = true;
    observation.title = observedPortionText(observation.title);
    observation.detail = observedPortionText(observation.detail);
    observation.evidence_summary = observedPortionText(observation.evidence_summary);
  }
  if (context.incompletePackage && area === "musical_theatre_package") {
    const packageClaim =
      /\bcomplete package|complete song|integrated package|all required material|ready package\b/i.test(
        combined,
      );
    if (packageClaim) {
      addWarning(warnings, {
        affected_field: fieldPath,
        original_value: scalar(combined),
        corrected_value: "package_incomplete_limitation",
        reason: "S10.8 rejected complete-package technique language for an incomplete package.",
        source: "s10_ai_judgement",
      });
      return null;
    }
  }
  return observation;
}

function normaliseSection(
  value: unknown,
  area: S10TechniqueArea,
  warnings: S10TechniqueWarning[],
  context: {
    actingMissing: boolean;
    songPartial: boolean;
    incompletePackage: boolean;
  },
): S10TechniqueSection {
  const raw = isRecord(value) ? value : {};
  const observations: S10TechniqueObservation[] = [];
  const seen = new Set<string>();
  for (const [index, item] of (Array.isArray(raw.observations) ? raw.observations : []).entries()) {
    const observation = normaliseObservation(
      item,
      `${area}_${index + 1}`,
      area,
      warnings,
      `s10_technique_commentary.${area}.observations[${index}]`,
      context,
    );
    if (!observation) continue;
    const key = normaliseKey(`${observation.title} ${observation.detail}`);
    if (seen.has(key)) continue;
    seen.add(key);
    observations.push(observation);
  }

  const section: S10TechniqueSection = {
    status: oneOf(
      raw.status,
      SECTION_STATUSES,
      observations.length > 0 ? "assessable" : "not_assessable",
    ),
    headline: safeString(text(raw.headline)),
    observations,
    what_is_working: scrubStringArray(stringList(raw.what_is_working, 8)),
    what_could_improve: scrubStringArray(stringList(raw.what_could_improve, 8)),
    practical_actions: scrubStringArray(stringList(raw.practical_actions, 8)),
    preserve: scrubStringArray(stringList(raw.preserve, 8)),
    not_assessable_reason: text(raw.not_assessable_reason) || null,
    confidence: oneOf(
      raw.confidence,
      ["low", "medium", "high"],
      observations.length ? "medium" : "low",
    ),
  };

  if (!section.headline) {
    section.headline =
      section.status === "not_applicable"
        ? "Not applicable to this brief/tape."
        : section.status === "not_assessable"
          ? "Technique not assessable from the verified evidence."
          : "Technique commentary from verified evidence.";
  }
  return section;
}

function ensureLimitation(limitations: string[], value: string) {
  if (!limitations.some((item) => normaliseKey(item) === normaliseKey(value))) {
    limitations.push(value);
  }
}

function addLegacyWarnings(
  report: Record<string, unknown> | undefined,
  warnings: S10TechniqueWarning[],
) {
  if (!report) return;
  const raw = isRecord(report.raw_report) ? report.raw_report : null;
  const fields: Array<[string, unknown, S10TechniqueWarning["source"]]> = [
    ["raw_report.category_rationale", raw?.category_rationale, "legacy_category_rationale"],
    ["raw_report.category_notes", raw?.category_notes, "legacy_category_notes"],
    ["raw_report.detected_components", raw?.detected_components, "legacy_raw_report"],
    ["raw_report.coaching_drills", raw?.coaching_drills, "legacy_coaching_drills"],
    ["raw_report.strengths", raw?.strengths, "legacy_raw_report"],
    ["technique_observation_trace", report.technique_observation_trace, "legacy_technique_trace"],
  ];
  for (const [field, value, source] of fields) {
    const rendered = isRecord(value) || Array.isArray(value) ? JSON.stringify(value) : text(value);
    if (!rendered) continue;
    const legacyTraceUnsafe =
      field === "technique_observation_trace" &&
      /\b(source_family["']?\s*:\s*["']?legacy_adapter|evidence_status["']?\s*:\s*["']?missing_evidence|legacy_adapter|missing_evidence)\b/i.test(
        rendered,
      );
    if (!legacyTraceUnsafe && !hasForbiddenTechniqueCommentaryPhrase(rendered)) continue;
    addWarning(warnings, {
      affected_field: field,
      original_value: scalar(value),
      corrected_value: "diagnostic_only",
      reason:
        "Legacy technique traces/raw report/coaching drills are diagnostic only and cannot populate S10 technique commentary.",
      source,
    });
  }

  if (
    report.public_technique_authority_status !== undefined ||
    report.public_technique_authority_blocked !== undefined
  ) {
    addWarning(warnings, {
      affected_field: "public_technique_authority_status",
      original_value: scalar(
        report.public_technique_authority_status ?? report.public_technique_authority_blocked,
      ),
      corrected_value: "ignored_for_authenticated_s10_technique_commentary",
      reason:
        "Public technique-authority status is diagnostic only and must not suppress ordinary authenticated S10.8 technique commentary.",
      source: "public_technique_authority_gate",
    });
  }
}

function forceObservedPortionOnVocal(section: S10TechniqueSection) {
  section.status = "partially_assessable";
  section.headline = observedPortionText(
    section.headline || "Vocal/singing commentary is limited to the observed portion.",
  );
  section.not_assessable_reason =
    section.not_assessable_reason ??
    "The song is present but incomplete, cut off or completion-uncertain, so vocal/singing commentary is limited to the observed portion.";
  section.observations = section.observations.map((item) => ({
    ...item,
    title: observedPortionText(item.title),
    detail: observedPortionText(item.detail),
    evidence_summary: observedPortionText(item.evidence_summary),
    applies_to_observed_portion_only: true,
  }));
  section.what_is_working = section.what_is_working.map(observedPortionText);
  section.what_could_improve = section.what_could_improve.map(observedPortionText);
  section.practical_actions = section.practical_actions.map(observedPortionText);
  section.preserve = section.preserve.map(observedPortionText);
}

function mediaSupportsPresentation(summary: MediaObservationSummary | null | undefined) {
  return Boolean(
    summary?.audio_assessable || summary?.video_assessable || summary?.framing_assessable,
  );
}

export function normaliseS10TechniqueCommentary(input: {
  commentary: unknown;
  matrix: BriefAchievementMatrix;
  readiness: ReadinessAndScoreJudgement;
  fixHierarchy: S10FixHierarchy;
  nextActionPlan?: S10NextActionPlan | null;
  professionalCritique: S10ProfessionalCritique;
  componentVerifications?: ComponentVerification[];
  mediaObservationSummary?: MediaObservationSummary | null;
  report?: Record<string, unknown>;
}): S10TechniqueCommentary {
  const raw = isRecord(input.commentary) ? input.commentary : {};
  const warnings: S10TechniqueWarning[] = [];
  const actingMissing = requiredActingMissing(input.matrix, input.componentVerifications ?? []);
  const songPartial = songPartialOrIncomplete(input.matrix);
  const incompletePackage = packageIncomplete(input.matrix);
  const context = { actingMissing, songPartial, incompletePackage };
  const commentary: S10TechniqueCommentary = {
    summary: safeString(text(raw.summary)),
    acting: normaliseSection(raw.acting, "acting", warnings, context),
    vocal_singing: normaliseSection(raw.vocal_singing, "vocal_singing", warnings, context),
    movement_dance: normaliseSection(raw.movement_dance, "movement_dance", warnings, context),
    musical_theatre_package: normaliseSection(
      raw.musical_theatre_package,
      "musical_theatre_package",
      warnings,
      context,
    ),
    self_tape_presentation: normaliseSection(
      raw.self_tape_presentation,
      "self_tape_presentation",
      warnings,
      context,
    ),
    commercial_screen_task: normaliseSection(
      raw.commercial_screen_task,
      "commercial_screen_task",
      warnings,
      context,
    ),
    limitations: scrubStringArray(stringList(raw.limitations, 16), 16),
    contradiction_warnings: [],
  };

  if (!commentary.summary) {
    commentary.summary = "Technique commentary is limited to verified S10 observed evidence.";
  }

  if (actingMissing) {
    commentary.acting = blankTechniqueSection(
      "not_assessable",
      "Acting-scene technique cannot be assessed from the missing required Side 1.",
      "The brief requires an acting scene, but S10 component verification did not identify that required Side 1 in the tape.",
    );
    ensureLimitation(
      commentary.limitations,
      "The required acting scene was not identified, so acting-scene technique cannot be assessed from this tape.",
    );
  }

  if (songPartial) {
    if (commentary.vocal_singing.status === "not_applicable") {
      commentary.vocal_singing.status = "partially_assessable";
    }
    forceObservedPortionOnVocal(commentary.vocal_singing);
    ensureLimitation(
      commentary.limitations,
      "Song/vocal technique notes apply only to the observed portion because song completion is partial, cut off or uncertain.",
    );
  } else if (!songVerified(input.componentVerifications ?? [])) {
    commentary.vocal_singing =
      commentary.vocal_singing.observations.length > 0
        ? commentary.vocal_singing
        : blankTechniqueSection(
            "not_assessable",
            "Vocal/singing technique is not assessable from the verified evidence.",
            "No verified song/vocal component was identified in S10 component verification.",
          );
  }

  if (incompletePackage) {
    commentary.musical_theatre_package.status =
      commentary.musical_theatre_package.status === "assessable"
        ? "partially_assessable"
        : commentary.musical_theatre_package.status;
    commentary.musical_theatre_package.headline =
      "MT package commentary is limited because the required package is incomplete.";
    commentary.musical_theatre_package.not_assessable_reason =
      commentary.musical_theatre_package.not_assessable_reason ??
      "The required package is incomplete because one or more mandatory components are absent, partial or not confirmed complete.";
    ensureLimitation(
      commentary.limitations,
      "Musical-theatre package technique is incomplete until the required acting scene and full song evidence are both present.",
    );
  }

  if (!movementRequired(input.matrix) && !movementVerified(input.componentVerifications ?? [])) {
    commentary.movement_dance = blankTechniqueSection(
      "not_applicable",
      "Movement/dance technique is not applicable to the verified brief and tape.",
      null,
    );
  } else if (
    movementRequired(input.matrix) &&
    !movementVerified(input.componentVerifications ?? [])
  ) {
    commentary.movement_dance = blankTechniqueSection(
      "not_assessable",
      "Movement/dance technique is not assessable from the verified evidence.",
      "The brief or tape indicates movement/dance relevance, but S10 component verification did not identify assessable movement/dance evidence.",
    );
  }

  if (!mediaSupportsPresentation(input.mediaObservationSummary)) {
    commentary.self_tape_presentation =
      commentary.self_tape_presentation.observations.length > 0
        ? commentary.self_tape_presentation
        : blankTechniqueSection(
            "not_assessable",
            "Self-tape presentation is not assessable from the verified media evidence.",
            "S10 media observation did not confirm audio, video or framing assessability.",
          );
  }

  if (commentary.commercial_screen_task.observations.length === 0) {
    commentary.commercial_screen_task = blankTechniqueSection(
      "not_applicable",
      "Commercial/screen task technique is not applicable to the verified brief and tape.",
      null,
    );
  }

  const strongComplete = isStrongComplete(input.matrix, input.readiness);
  if (strongComplete) {
    if (commentary.acting.status !== "assessable" || commentary.acting.observations.length === 0) {
      ensureLimitation(
        commentary.limitations,
        "The S10 technique commentary did not supply acting technique despite a verified complete acting component.",
      );
    }
    if (
      commentary.vocal_singing.status !== "assessable" ||
      commentary.vocal_singing.observations.length === 0
    ) {
      ensureLimitation(
        commentary.limitations,
        "The S10 technique commentary did not supply vocal/singing technique despite a verified complete song component.",
      );
    }
    if (
      commentary.self_tape_presentation.status !== "assessable" ||
      commentary.self_tape_presentation.observations.length === 0
    ) {
      ensureLimitation(
        commentary.limitations,
        "The S10 technique commentary did not supply self-tape presentation technique despite assessable media.",
      );
    }
    const hasPracticalPolish = [
      ...commentary.acting.practical_actions,
      ...commentary.vocal_singing.practical_actions,
      ...commentary.musical_theatre_package.practical_actions,
      ...commentary.self_tape_presentation.practical_actions,
    ].some(Boolean);
    if (!hasPracticalPolish) {
      ensureLimitation(
        commentary.limitations,
        "The S10 technique commentary did not supply a specific optional technique polish point.",
      );
    }
  }

  addLegacyWarnings(input.report, warnings);
  commentary.contradiction_warnings = warnings;
  return commentary;
}

function sectionPrimaryText(section: S10TechniqueSection): string | null {
  const observation = section.observations[0];
  if (observation) {
    return `${observation.applies_to_observed_portion_only ? "Observed portion only: " : ""}${observation.title}: ${observation.detail}`;
  }
  return section.not_assessable_reason || section.headline || null;
}

function scrubObjectStrings(value: unknown): unknown {
  if (typeof value === "string") return safeString(value);
  if (Array.isArray(value)) return value.map(scrubObjectStrings).filter((item) => item !== "");
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = scrubObjectStrings(item);
    }
    return out;
  }
  return value;
}

function dedupeAppend(existing: unknown, additions: string[], limit = 15): string[] {
  const base = Array.isArray(existing) ? existing.map((item) => text(item)).filter(Boolean) : [];
  return scrubStringArray([...base, ...additions], limit);
}

export function applyS10TechniqueLibraryCommentary(input: {
  report: Record<string, unknown>;
  matrix: BriefAchievementMatrix;
  readiness: ReadinessAndScoreJudgement;
  fixHierarchy: S10FixHierarchy;
  nextActionPlan?: S10NextActionPlan | null;
  professionalCritique: S10ProfessionalCritique;
  componentVerifications?: ComponentVerification[];
  mediaObservationSummary?: MediaObservationSummary | null;
}): { commentary: S10TechniqueCommentary; warnings: S10TechniqueWarning[] } {
  const commentary = normaliseS10TechniqueCommentary({
    commentary: input.report.s10_technique_commentary,
    matrix: input.matrix,
    readiness: input.readiness,
    fixHierarchy: input.fixHierarchy,
    nextActionPlan: input.nextActionPlan,
    professionalCritique: input.professionalCritique,
    componentVerifications: input.componentVerifications,
    mediaObservationSummary: input.mediaObservationSummary,
    report: input.report,
  });
  input.report.s10_technique_commentary = commentary;

  const notes = isRecord(input.report.category_notes)
    ? { ...(input.report.category_notes as Record<string, unknown>) }
    : {};
  const actingText = sectionPrimaryText(commentary.acting);
  const vocalText = sectionPrimaryText(commentary.vocal_singing);
  const presentationText = sectionPrimaryText(commentary.self_tape_presentation);
  if (actingText) notes.acting = actingText;
  if (vocalText) notes.vocal = vocalText;
  if (presentationText) notes.professional_presentation = presentationText;
  input.report.category_notes = scrubObjectStrings(notes);

  const rationale = isRecord(input.report.category_rationale)
    ? { ...(input.report.category_rationale as Record<string, unknown>) }
    : {};
  if (actingText) {
    rationale.acting = {
      what_works: commentary.acting.status === "assessable" ? actingText : "",
      why_not_full_score:
        commentary.acting.status === "not_assessable"
          ? commentary.acting.not_assessable_reason
          : (commentary.acting.what_could_improve[0] ?? ""),
      close_gap: commentary.acting.practical_actions[0] ?? "",
      standout_delta: "",
    };
  }
  if (vocalText) {
    rationale.vocal = {
      what_works: vocalText,
      why_not_full_score: commentary.vocal_singing.what_could_improve[0] ?? "",
      close_gap: commentary.vocal_singing.practical_actions[0] ?? "",
      standout_delta: "",
    };
  }
  input.report.category_rationale = scrubObjectStrings(rationale);

  const presentationAdditions = [
    ...commentary.self_tape_presentation.observations.map((item) => item.detail),
    ...commentary.self_tape_presentation.practical_actions,
  ];
  input.report.presentation_notes = dedupeAppend(
    input.report.presentation_notes,
    presentationAdditions,
    6,
  );

  const techniqueActions = [
    ...commentary.acting.practical_actions,
    ...commentary.vocal_singing.practical_actions,
    ...commentary.movement_dance.practical_actions,
    ...commentary.musical_theatre_package.practical_actions,
    ...commentary.self_tape_presentation.practical_actions,
  ];
  input.report.coaching_drills = dedupeAppend(input.report.coaching_drills, techniqueActions, 15);
  input.report.improvements = dedupeAppend(input.report.improvements, techniqueActions, 15);

  return { commentary, warnings: commentary.contradiction_warnings };
}

export function scrubS10TechniqueCommentaryProjection(report: Record<string, unknown>): {
  removed: number;
} {
  let removed = 0;
  const scrub = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (hasForbiddenTechniqueCommentaryPhrase(value)) {
        removed += 1;
        return "";
      }
      return value;
    }
    if (Array.isArray(value)) {
      const out = value.map(scrub).filter((item) => item !== "");
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
  for (const key of [
    "s10_technique_commentary",
    "category_notes",
    "category_rationale",
    "presentation_notes",
    "coaching_drills",
    "improvements",
  ]) {
    if (report[key] !== undefined) report[key] = scrub(report[key]);
  }
  return { removed };
}
