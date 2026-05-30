// SERVER-ONLY. S10.5 readiness / score semantics validation.
//
// The AI authors readiness and score judgement. Code validates it against the
// S10.4 brief achievement matrix, requests repair by classification where
// practical, and caps only effective downstream fields to prevent false
// submission-readiness positives.

import type {
  BriefAchievementMatrix,
  ComponentScore,
  ReadinessAndScoreJudgement,
  ReadinessDecision,
  ReadinessScoreBandLabel,
  S10PerformerLevelCalibration,
  ScoreContradictionWarning,
} from "@/lib/audition-rules";
import { getS10PerformerLevelStandard, toS10PerformerLevel } from "@/lib/audition-rules";

type Confidence = "low" | "medium" | "high";

const DECISIONS: ReadinessDecision[] = [
  "submit",
  "submit_if_deadline_is_close",
  "review_carefully",
  "retake_required_if_possible",
];

const BAND_LABELS: ReadinessScoreBandLabel[] = [
  "not_submission_ready",
  "retake_required_if_possible",
  "review_carefully",
  "submit_if_deadline_is_close",
  "submit_strong_submission",
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

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, 12);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function confidence(value: unknown, fallback: "low" | "medium" | "high" = "low") {
  return oneOf(value, ["low", "medium", "high"], fallback);
}

function clampScore(value: unknown, fallback = 0): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function readinessBandLabel(score: number): ReadinessScoreBandLabel {
  if (score <= 39) return "not_submission_ready";
  if (score <= 54) return "retake_required_if_possible";
  if (score <= 69) return "review_carefully";
  if (score <= 84) return "submit_if_deadline_is_close";
  return "submit_strong_submission";
}

function scoreForDecision(decision: ReadinessDecision): number {
  if (decision === "retake_required_if_possible") return 54;
  if (decision === "review_carefully") return 69;
  if (decision === "submit_if_deadline_is_close") return 84;
  return 100;
}

function addWarning(warnings: ScoreContradictionWarning[], warning: ScoreContradictionWarning) {
  const key = `${warning.affected_field}:${warning.source}:${warning.original_value}:${warning.capped_value}`;
  if (
    warnings.some(
      (item) =>
        `${item.affected_field}:${item.source}:${item.original_value}:${item.capped_value}` === key,
    )
  ) {
    return;
  }
  warnings.push(warning);
}

function requirementText(item: BriefAchievementMatrix["requirement_results"][number]): string {
  return `${item.requirement_summary} ${item.evidence_summary}`.toLowerCase();
}

function isPackageLikeRequirement(
  item: BriefAchievementMatrix["requirement_results"][number],
): boolean {
  if (item.fix_category === "final_check") return false;
  return /\b(package|continuous|one continuous|full package|required material|complete package|song|side|acting scene)\b/i.test(
    requirementText(item),
  );
}

function isMandatoryMaterialOrPackageBlocker(
  item: BriefAchievementMatrix["requirement_results"][number],
): boolean {
  if (item.importance !== "mandatory") return false;
  if (
    item.submission_impact !== "submission_blocker" &&
    item.submission_impact !== "material_gap"
  ) {
    return false;
  }
  if (item.category === "material" || item.category === "performance") return true;
  return isPackageLikeRequirement(item);
}

function isHardMandatoryBlocker(item: BriefAchievementMatrix["requirement_results"][number]) {
  return (
    isMandatoryMaterialOrPackageBlocker(item) &&
    (item.achievement_status === "not_achieved" || item.submission_impact === "submission_blocker")
  );
}

function isMandatoryGap(item: BriefAchievementMatrix["requirement_results"][number]) {
  return (
    isMandatoryMaterialOrPackageBlocker(item) &&
    !isHardMandatoryBlocker(item) &&
    (item.achievement_status === "partly_achieved" ||
      item.completion_status === "incomplete" ||
      item.completion_status === "cut_off" ||
      item.submission_impact === "material_gap")
  );
}

function matrixHasClearMandatoryMaterial(matrix: BriefAchievementMatrix): boolean {
  return !matrix.requirement_results.some(isMandatoryMaterialOrPackageBlocker);
}

function mentionsStaleMandatoryPackageGap(value: string): boolean {
  return (
    /\b(mandatory|required|package|material|side\s*1|side one|acting scene)\b/i.test(value) &&
    /\b(missing|incomplete|not observed|not identified|record|include|fix[-\s]?first|not ready)\b/i.test(
      value,
    )
  );
}

export function deriveReadinessConstraint(matrix: BriefAchievementMatrix | null | undefined): {
  cap: number | null;
  decision: ReadinessDecision | null;
  reason: string | null;
  blockerRequirementIds: string[];
} {
  const results = matrix?.requirement_results ?? [];
  const hard = results.filter(isHardMandatoryBlocker);
  if (hard.length > 0) {
    return {
      cap: 54,
      decision: "retake_required_if_possible",
      reason: `Mandatory required material is missing: ${hard.map((item) => item.requirement_summary).join(", ")}.`,
      blockerRequirementIds: hard.map((item) => item.requirement_id),
    };
  }
  const gaps = results.filter(isMandatoryGap);
  if (gaps.length > 0) {
    return {
      cap: 69,
      decision: "review_carefully",
      reason: `Mandatory required material or package evidence is incomplete: ${gaps.map((item) => item.requirement_summary).join(", ")}.`,
      blockerRequirementIds: gaps.map((item) => item.requirement_id),
    };
  }
  return { cap: null, decision: null, reason: null, blockerRequirementIds: [] };
}

function normaliseComponentScores(
  value: unknown,
  matrix: BriefAchievementMatrix,
  warnings: ScoreContradictionWarning[],
): ComponentScore[] {
  const rows = Array.isArray(value) ? value : [];
  const requirementsById = new Map(
    matrix.requirement_results.map((item) => [item.requirement_id, item]),
  );
  return rows.filter(isRecord).map((row): ComponentScore => {
    const linkedRequirementIds = Array.isArray(row.linked_requirement_ids)
      ? row.linked_requirement_ids
          .map((item) => text(item))
          .filter(Boolean)
          .slice(0, 12)
      : [];
    const linkedRows = linkedRequirementIds
      .map((id) => requirementsById.get(id))
      .filter((item): item is BriefAchievementMatrix["requirement_results"][number] =>
        Boolean(item),
      );
    const absentOrBlocked = linkedRows.some(
      (item) =>
        item.observed_status === "absent" ||
        item.achievement_status === "not_achieved" ||
        item.submission_impact === "submission_blocker",
    );
    const partial = linkedRows.some(
      (item) =>
        item.observed_status === "partially_present" ||
        item.completion_status === "incomplete" ||
        item.completion_status === "cut_off",
    );
    const componentType = oneOf(
      row.component_type,
      ["acting_scene", "song", "dance", "slate", "package", "technical", "other"],
      "other",
    );
    let score: number | null =
      typeof row.score === "number" && Number.isFinite(row.score) ? clampScore(row.score) : null;
    let cannotScoreReason = text(row.cannot_score_reason) || null;
    let scoreBasis = text(row.score_basis);
    if (
      absentOrBlocked ||
      (componentType === "acting_scene" &&
        linkedRows.some((item) => item.observed_status === "absent"))
    ) {
      if (score != null) {
        addWarning(warnings, {
          affected_field: `readiness_score_judgement.component_scores.${componentType}.score`,
          original_value: score,
          capped_value: null,
          matrix_reason:
            "S10.4 matrix says the linked required component is absent or blocks submission readiness.",
          source: "s10_ai_judgement",
        });
      }
      score = null;
      cannotScoreReason =
        cannotScoreReason ??
        "This component is not scoreable because the linked required material was not observed.";
      scoreBasis = scoreBasis || cannotScoreReason;
    } else if (partial && typeof score === "number" && score > 84) {
      addWarning(warnings, {
        affected_field: `readiness_score_judgement.component_scores.${componentType}.score`,
        original_value: score,
        capped_value: 84,
        matrix_reason: "S10.4 matrix says the linked component is partial, incomplete or cut off.",
        source: "s10_ai_judgement",
      });
      score = 84;
      scoreBasis =
        scoreBasis ||
        "Score is limited to the observed portion because the component is partial, incomplete or cut off.";
    }
    return {
      component_type: componentType,
      linked_requirement_ids: linkedRequirementIds,
      observed_status: oneOf(
        row.observed_status,
        ["present", "partially_present", "absent", "not_assessable", "uncertain"],
        linkedRows[0]?.observed_status ?? "not_assessable",
      ),
      completion_status: oneOf(
        row.completion_status,
        ["complete", "incomplete", "cut_off", "not_applicable", "uncertain"],
        linkedRows[0]?.completion_status ?? "uncertain",
      ),
      score,
      score_basis: scoreBasis,
      confidence: oneOf(row.confidence, ["low", "medium", "high"], "low"),
      cannot_score_reason: cannotScoreReason,
    };
  });
}

function normaliseSelectedLevelCalibration(input: {
  value: unknown;
  selectedLevel?: string | null;
  legacySummary: string;
}): S10PerformerLevelCalibration {
  const raw = isRecord(input.value) ? input.value : {};
  const selectedLevel = input.selectedLevel ?? text(raw.selected_level) ?? text(raw.level);
  const standard = getS10PerformerLevelStandard(selectedLevel);
  const rawLevelMatchesSelected =
    !!text(raw.selected_level) &&
    toS10PerformerLevel(raw.selected_level) === standard.selected_level;
  return {
    selected_level: toS10PerformerLevel(selectedLevel),
    selected_level_label: standard.label,
    standard_applied: standard.standard_applied,
    evidence_threshold: standard.evidence_threshold,
    readiness_standard: standard.readiness_standard,
    score_meaning:
      (rawLevelMatchesSelected
        ? text(raw.score_meaning) || text(raw.score_meaning_at_level)
        : null) || standard.score_meaning,
    what_meets_level: stringList(raw.what_meets_level),
    what_falls_short: stringList(raw.what_falls_short),
    recommendation_impact:
      text(raw.recommendation_impact) ||
      text(raw.how_level_affects_recommendation) ||
      input.legacySummary,
    comparison_to_other_levels: text(raw.comparison_to_other_levels) || null,
    confidence: confidence(raw.confidence),
  };
}

export function normaliseReadinessScoreJudgement(input: {
  judgement: unknown;
  matrix: BriefAchievementMatrix;
  currentOverallScore: number;
  currentScores?: Record<string, unknown> | null;
  selectedLevel?: string | null;
}): ReadinessAndScoreJudgement {
  const raw = isRecord(input.judgement) ? input.judgement : {};
  const constraint = deriveReadinessConstraint(input.matrix);
  const warnings: ScoreContradictionWarning[] = [];
  const originalReadiness =
    typeof raw.overall_submission_readiness_score === "number" &&
    Number.isFinite(raw.overall_submission_readiness_score)
      ? clampScore(raw.overall_submission_readiness_score)
      : null;
  let readinessScore = originalReadiness;
  if (constraint.cap != null && readinessScore != null && readinessScore > constraint.cap) {
    addWarning(warnings, {
      affected_field: "readiness_score_judgement.overall_submission_readiness_score",
      original_value: originalReadiness,
      capped_value: constraint.cap,
      matrix_reason: constraint.reason ?? "S10.4 matrix requires readiness downshift.",
      source: "s10_ai_judgement",
    });
    readinessScore = constraint.cap;
  }

  let decision = optionalOneOf(raw.decision, DECISIONS) ?? constraint.decision;
  if (constraint.decision) {
    const maxAllowed = scoreForDecision(constraint.decision);
    if (decision && scoreForDecision(decision) > maxAllowed) {
      addWarning(warnings, {
        affected_field: "readiness_score_judgement.decision",
        original_value: decision,
        capped_value: constraint.decision,
        matrix_reason: constraint.reason ?? "S10.4 matrix requires readiness decision downshift.",
        source: "s10_ai_judgement",
      });
      decision = constraint.decision;
    }
  }

  const stalePackageGapText = [
    raw.headline,
    raw.score_explanation,
    raw.brief_completion_summary,
    raw.technical_assessability_summary,
    ...stringList(raw.rationale),
  ]
    .map((item) => text(item))
    .filter(Boolean)
    .join(" ");
  if (
    !constraint.decision &&
    matrixHasClearMandatoryMaterial(input.matrix) &&
    (decision === "review_carefully" || decision === "retake_required_if_possible") &&
    mentionsStaleMandatoryPackageGap(stalePackageGapText)
  ) {
    const correctedDecision =
      Math.max(readinessScore ?? input.currentOverallScore, input.currentOverallScore) >= 85
        ? "submit"
        : "submit_if_deadline_is_close";
    addWarning(warnings, {
      affected_field: "readiness_score_judgement.decision",
      original_value: decision,
      capped_value: correctedDecision,
      matrix_reason:
        "S10.4 reconciled matrix verifies mandatory package material, so stale missing-package readiness language was removed.",
      source: "s10_ai_judgement",
    });
    decision = correctedDecision;
    const minimumScore = correctedDecision === "submit" ? 85 : 70;
    readinessScore = Math.max(readinessScore ?? input.currentOverallScore, minimumScore);
  }

  const bandFromScore = readinessScore != null ? readinessBandLabel(readinessScore) : null;
  const rawBand = optionalOneOf(raw.score_band_label, BAND_LABELS);
  const scoreBandLabel = bandFromScore ?? rawBand;
  if (bandFromScore && rawBand && rawBand !== bandFromScore) {
    addWarning(warnings, {
      affected_field: "readiness_score_judgement.score_band_label",
      original_value: rawBand,
      capped_value: bandFromScore,
      matrix_reason: "Score band must align with overall submission readiness score.",
      source: "s10_ai_judgement",
    });
  }

  const rawWarnings = Array.isArray(raw.score_contradiction_warnings)
    ? raw.score_contradiction_warnings.filter(isRecord)
    : [];
  for (const item of rawWarnings) {
    addWarning(warnings, {
      affected_field: text(item.affected_field, "unknown"),
      original_value: scalar(item.original_value),
      capped_value: scalar(item.capped_value),
      matrix_reason: text(item.matrix_reason, "AI reported a score contradiction."),
      source: oneOf(
        item.source,
        [
          "s10_ai_judgement",
          "legacy_raw_report",
          "score_trace",
          "detected_components",
          "prior_prose",
        ],
        "s10_ai_judgement",
      ),
    });
  }

  const rawRationale = stringList(raw.rationale);
  const rationale =
    rawRationale.length > 0 ? rawRationale : constraint.reason ? [constraint.reason] : [];

  const repairStatus =
    warnings.length > 0 ||
    raw.repair_prompt_status === "classified_contradictory" ||
    (constraint.cap != null && originalReadiness != null && originalReadiness > constraint.cap)
      ? "classified_contradictory"
      : "not_needed";

  const categoryScores = Array.isArray(raw.category_scores)
    ? raw.category_scores.filter(isRecord).map((item) => ({
        category_id: oneOf(
          item.category_id,
          [
            "acting",
            "vocal",
            "movement",
            "dance",
            "audio",
            "technical",
            "brief_adherence",
            "professional_presentation",
            "self_tape_presentation",
            "mt_package",
            "other",
          ],
          "other",
        ),
        score:
          typeof item.score === "number" && Number.isFinite(item.score)
            ? clampScore(item.score)
            : null,
        score_basis: text(item.score_basis),
        what_works: text(item.what_works),
        why_not_full_score: text(item.why_not_full_score),
        close_gap: text(item.close_gap),
        confidence: oneOf(item.confidence, ["low", "medium", "high"], "low") as Confidence,
        blocked_or_not_assessable_reason: text(item.blocked_or_not_assessable_reason) || null,
      }))
    : [];

  const selectedLevelSummary = text(raw.selected_level_calibration_summary);
  const selectedLevelCalibration = normaliseSelectedLevelCalibration({
    value: raw.selected_level_calibration,
    selectedLevel: input.selectedLevel,
    legacySummary: selectedLevelSummary,
  });

  return {
    decision,
    headline: text(raw.headline) || (constraint.reason ?? ""),
    rationale,
    confidence: oneOf(raw.confidence, ["low", "medium", "high"], "low"),
    performance_quality_score:
      typeof raw.performance_quality_score === "number"
        ? clampScore(raw.performance_quality_score)
        : null,
    brief_completion_score:
      typeof raw.brief_completion_score === "number"
        ? clampScore(raw.brief_completion_score)
        : null,
    overall_submission_readiness_score: readinessScore,
    score_band_label: scoreBandLabel,
    score_explanation:
      text(raw.score_explanation) ||
      (constraint.reason
        ? `${constraint.reason} Visible performance strengths may still be recognised separately from submission readiness.`
        : ""),
    brief_blocker_override: Boolean(raw.brief_blocker_override) || constraint.cap != null,
    performance_quality_summary: text(raw.performance_quality_summary),
    brief_completion_summary: text(raw.brief_completion_summary) || input.matrix.summary,
    technical_assessability_summary: text(raw.technical_assessability_summary),
    selected_level_calibration_summary:
      selectedLevelSummary ||
      selectedLevelCalibration.recommendation_impact ||
      selectedLevelCalibration.standard_applied,
    selected_level_calibration: selectedLevelCalibration,
    professional_nuance_summary: text(raw.professional_nuance_summary),
    category_scores: categoryScores,
    category_rationale: isRecord(raw.category_rationale) ? raw.category_rationale : {},
    component_scores: normaliseComponentScores(raw.component_scores, input.matrix, warnings),
    component_score_notes: stringList(raw.component_score_notes),
    score_contradiction_warnings: warnings,
    repair_prompt_status: repairStatus,
  };
}

function capNumberField(args: {
  target: Record<string, unknown>;
  field: string;
  cap: number;
  source: ScoreContradictionWarning["source"];
  matrixReason: string;
  warnings: ScoreContradictionWarning[];
}) {
  const original = args.target[args.field];
  if (typeof original !== "number" || !Number.isFinite(original) || original <= args.cap) return;
  args.target[args.field] = args.cap;
  addWarning(args.warnings, {
    affected_field: args.field,
    original_value: original,
    capped_value: args.cap,
    matrix_reason: args.matrixReason,
    source: args.source,
  });
}

function filterDetectedComponents(
  value: unknown,
  matrix: BriefAchievementMatrix,
  warnings: ScoreContradictionWarning[],
): unknown {
  if (!Array.isArray(value)) return value;
  const absentActing = matrix.requirement_results.some(
    (item) =>
      item.importance === "mandatory" &&
      item.observed_status === "absent" &&
      /\b(side|acting scene|scene)\b/i.test(requirementText(item)),
  );
  const partialSong = matrix.requirement_results.some(
    (item) =>
      item.importance === "mandatory" &&
      (item.observed_status === "partially_present" ||
        item.completion_status === "incomplete" ||
        item.completion_status === "cut_off") &&
      /\bsong\b/i.test(requirementText(item)),
  );
  return value
    .filter((item) => {
      if (!isRecord(item)) return false;
      if (absentActing && item.type === "acting_scene") {
        addWarning(warnings, {
          affected_field: "detected_components[].acting_scene",
          original_value: "acting_scene",
          capped_value: null,
          matrix_reason: "S10.4 matrix says the required acting scene was absent.",
          source: "detected_components",
        });
        return false;
      }
      return true;
    })
    .map((item) => {
      if (!isRecord(item)) return item;
      if (
        partialSong &&
        item.type === "song" &&
        typeof item.score === "number" &&
        item.score > 84
      ) {
        addWarning(warnings, {
          affected_field: "detected_components[].song.score",
          original_value: item.score,
          capped_value: 84,
          matrix_reason: "S10.4 matrix says the song was partial, incomplete or cut off.",
          source: "detected_components",
        });
        return {
          ...item,
          score: 84,
          note: text(item.note)
            ? `${text(item.note)} Score limited to the observed partial song.`
            : "Score limited to the observed partial song.",
        };
      }
      return item;
    });
}

export function applyReadinessScoreSemantics(input: {
  report: Record<string, unknown>;
  matrix: BriefAchievementMatrix;
  currentOverallScore: number;
  selectedLevel?: string | null;
}): {
  overall: number;
  judgement: ReadinessAndScoreJudgement;
  warnings: ScoreContradictionWarning[];
  capped: boolean;
} {
  const report = input.report;
  const scores = isRecord(report.scores) ? report.scores : {};
  if (!isRecord(report.scores)) report.scores = scores;
  const judgement = normaliseReadinessScoreJudgement({
    judgement: report.readiness_score_judgement,
    matrix: input.matrix,
    currentOverallScore: input.currentOverallScore,
    currentScores: scores,
    selectedLevel: input.selectedLevel,
  });
  const warnings = [...judgement.score_contradiction_warnings];
  const constraint = deriveReadinessConstraint(input.matrix);
  let overall =
    judgement.overall_submission_readiness_score != null
      ? Math.min(input.currentOverallScore, judgement.overall_submission_readiness_score)
      : input.currentOverallScore;

  if (constraint.cap != null && overall > constraint.cap) {
    addWarning(warnings, {
      affected_field: "overall_score_final",
      original_value: overall,
      capped_value: constraint.cap,
      matrix_reason: constraint.reason ?? "S10.4 matrix requires readiness downshift.",
      source: "s10_ai_judgement",
    });
    overall = constraint.cap;
  }

  if (constraint.cap != null) {
    capNumberField({
      target: scores,
      field: "brief_adherence",
      cap: constraint.cap,
      source: "s10_ai_judgement",
      matrixReason: constraint.reason ?? "S10.4 matrix requires brief adherence downshift.",
      warnings,
    });
    if (!isRecord(report.brief_adherence_breakdown)) report.brief_adherence_breakdown = {};
    capNumberField({
      target: report.brief_adherence_breakdown as Record<string, unknown>,
      field: "material_compliance",
      cap: constraint.cap,
      source: "s10_ai_judgement",
      matrixReason: constraint.reason ?? "S10.4 matrix requires material compliance downshift.",
      warnings,
    });
  }

  const rawReport = isRecord(report.raw_report) ? report.raw_report : null;
  if (constraint.cap != null && rawReport) {
    if (typeof rawReport.overall_score === "number" && rawReport.overall_score > constraint.cap) {
      addWarning(warnings, {
        affected_field: "raw_report.overall_score",
        original_value: rawReport.overall_score,
        capped_value: constraint.cap,
        matrix_reason: constraint.reason ?? "S10.4 matrix contradicts legacy raw score.",
        source: "legacy_raw_report",
      });
    }
    const rawBreakdown = isRecord(rawReport.brief_adherence_breakdown)
      ? rawReport.brief_adherence_breakdown
      : null;
    if (
      rawBreakdown &&
      typeof rawBreakdown.material_compliance === "number" &&
      rawBreakdown.material_compliance > constraint.cap
    ) {
      addWarning(warnings, {
        affected_field: "raw_report.brief_adherence_breakdown.material_compliance",
        original_value: rawBreakdown.material_compliance,
        capped_value: constraint.cap,
        matrix_reason: constraint.reason ?? "S10.4 matrix contradicts legacy material compliance.",
        source: "legacy_raw_report",
      });
    }
  }

  report.detected_components = filterDetectedComponents(
    report.detected_components,
    input.matrix,
    warnings,
  );
  judgement.score_contradiction_warnings = warnings;
  judgement.repair_prompt_status =
    warnings.length > 0 ? "classified_contradictory" : judgement.repair_prompt_status;
  report.readiness_score_judgement = judgement;

  return {
    overall,
    judgement,
    warnings,
    capped: overall !== input.currentOverallScore || warnings.length > 0,
  };
}
