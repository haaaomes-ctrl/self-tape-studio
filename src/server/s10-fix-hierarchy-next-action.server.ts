// SERVER-ONLY. S10.6 fix hierarchy / next-action validation.
//
// The AI authors action judgement. Code validates it against normalized S10.4
// and S10.5 output, rejects generic fallback phrases, and projects corrected
// S10 action fields into legacy-compatible report fields for the current UI.

import type {
  BriefAchievementMatrix,
  ReadinessAndScoreJudgement,
  S10ActionContradictionWarning,
  S10ActionSourceAuthority,
  S10FixHierarchy,
  S10FixItem,
  S10FixSourceCategory,
  S10FixSubmissionImpact,
  S10FixUrgency,
  S10NextActionPlan,
} from "@/lib/audition-rules";

type Confidence = "low" | "medium" | "high";

const SOURCE_CATEGORIES: S10FixSourceCategory[] = [
  "brief",
  "performance",
  "technical",
  "admin_process",
  "score_semantics",
  "polish",
  "limitation",
];

const URGENCIES: S10FixUrgency[] = ["critical_gap", "high", "medium", "low", "optional"];

const SUBMISSION_IMPACTS: S10FixSubmissionImpact[] = [
  "submission_blocker",
  "material_gap",
  "review_carefully",
  "optional_polish",
  "final_check",
  "supports_submission",
];

const SOURCE_AUTHORITIES: S10ActionSourceAuthority[] = [
  "s10_ai_authored",
  "s10_normalised",
  "legacy_diagnostic_reauthored",
  "limitation",
];

export const S10_FORBIDDEN_ACTION_PHRASES = [
  "Blocked: a major casting brief instruction wasn’t followed.",
  "Blocked: a major casting brief instruction wasn't followed.",
  "Retake option: if recording again, use one pass to strengthen blocked",
  "Be more confident.",
  "Add more energy.",
  "Keep refining the take.",
  "No single public-safe priority fix was available.",
  "Preserve the clearest choices already captured.",
  "This affects readability, not talent.",
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

function hasForbiddenActionPhrase(value: string): boolean {
  const key = normaliseKey(value);
  return S10_FORBIDDEN_ACTION_PHRASES.some((phrase) => key.includes(normaliseKey(phrase)));
}

function actionKey(item: Pick<S10FixItem, "title" | "exact_action">): string {
  return normaliseKey(`${item.title} ${item.exact_action}`);
}

function addWarning(
  warnings: S10ActionContradictionWarning[],
  warning: Omit<S10ActionContradictionWarning, "internal_only">,
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

function isMandatoryMaterialOrPackageGap(
  item: BriefAchievementMatrix["requirement_results"][number],
): boolean {
  if (item.importance !== "mandatory") return false;
  if (item.fix_category === "final_check") return false;
  const materialOrPackage =
    item.category === "material" ||
    item.category === "performance" ||
    /\b(package|continuous|required material|complete package|song|side|acting scene)\b/i.test(
      requirementText(item),
    );
  if (!materialOrPackage) return false;
  return (
    item.submission_impact === "submission_blocker" ||
    item.submission_impact === "material_gap" ||
    item.achievement_status === "not_achieved" ||
    item.achievement_status === "partly_achieved" ||
    item.completion_status === "incomplete" ||
    item.completion_status === "cut_off"
  );
}

function isSideActingRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\b(side\s*1|acting scene|requested scene|side)\b/i.test(requirementText(item));
}

function isSongRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\bsong|mt song|musical theatre\b/i.test(requirementText(item));
}

function isPackageRequirement(item: BriefAchievementMatrix["requirement_results"][number]) {
  return /\b(package|continuous|one file|final file|upload|full package)\b/i.test(
    requirementText(item),
  );
}

function isFileNamingOnly(value: string): boolean {
  const key = normaliseKey(value);
  return /\b(file naming|filename|naming convention|correct the file naming convention)\b/i.test(
    key,
  );
}

function isPolishOnly(value: string): boolean {
  const key = normaliseKey(value);
  return /\b(diction|character detail|energy|confidence|polish|refine|refining)\b/i.test(key);
}

function itemFromMatrixResult(
  item: BriefAchievementMatrix["requirement_results"][number],
  index: number,
): S10FixItem {
  const exactAction = isSideActingRequirement(item)
    ? "Record/include the full required Side 1 acting scene before submitting."
    : isSongRequirement(item)
      ? "Complete or confirm the required song runs through to the end before submitting."
      : isPackageRequirement(item)
        ? "Check the required material is complete in one continuous final video before upload."
        : text(item.recommended_action) ||
          `Resolve the required item before submitting: ${item.requirement_summary}.`;
  return {
    id: `s10_matrix_fix_${item.requirement_id || index}`,
    title: isSideActingRequirement(item)
      ? "Record/include the required Side 1 acting scene"
      : isSongRequirement(item)
        ? "Complete the required song package"
        : isPackageRequirement(item)
          ? "Check the complete final package"
          : item.requirement_summary,
    issue: item.requirement_summary,
    why_it_matters:
      item.submission_impact === "submission_blocker"
        ? "This mandatory requirement blocks normal submission readiness."
        : "This mandatory requirement leaves a material/package gap.",
    exact_action: exactAction,
    source_category:
      item.category === "admin_process" || item.fix_category === "final_check"
        ? "admin_process"
        : item.category === "technical"
          ? "technical"
          : "brief",
    urgency: item.submission_impact === "submission_blocker" ? "critical_gap" : "high",
    submission_impact:
      item.submission_impact === "submission_blocker" ? "submission_blocker" : "material_gap",
    linked_requirement_ids: [item.requirement_id].filter(Boolean),
    linked_matrix_result_ids: [item.requirement_id].filter(Boolean),
    linked_component_verification_ids: item.linked_component_verification_ids ?? [],
    linked_readiness_reason_ids: [],
    evidence_summary: item.evidence_summary,
    confidence: item.confidence,
    is_fix_first_candidate: item.fix_category === "must_fix" || isSideActingRequirement(item),
    is_generic_fallback: false,
    source_authority: "s10_normalised",
    legacy_source_used: false,
    legacy_source_path: null,
  };
}

function normaliseFixItem(
  value: unknown,
  fallbackId: string,
  warnings: S10ActionContradictionWarning[],
  fieldPath: string,
): S10FixItem | null {
  if (!isRecord(value)) return null;
  const title = text(value.title);
  const exactAction = text(value.exact_action);
  const issue = text(value.issue) || title;
  const combined = `${title} ${exactAction} ${issue}`;
  if (!title || !exactAction || hasForbiddenActionPhrase(combined)) {
    addWarning(warnings, {
      affected_field: fieldPath,
      original_value: scalar(combined || value),
      corrected_value: null,
      reason: "S10.6 rejected missing or generic fallback action copy.",
      source: "s10_ai_judgement",
    });
    return null;
  }
  return {
    id: text(value.id, fallbackId),
    title,
    issue,
    why_it_matters: text(value.why_it_matters),
    exact_action: exactAction,
    source_category: oneOf(value.source_category, SOURCE_CATEGORIES, "limitation"),
    urgency: oneOf(value.urgency, URGENCIES, "medium"),
    submission_impact: oneOf(value.submission_impact, SUBMISSION_IMPACTS, "review_carefully"),
    linked_requirement_ids: stringList(value.linked_requirement_ids),
    linked_matrix_result_ids: stringList(value.linked_matrix_result_ids),
    linked_component_verification_ids: stringList(value.linked_component_verification_ids),
    linked_readiness_reason_ids: stringList(value.linked_readiness_reason_ids),
    evidence_summary: text(value.evidence_summary),
    confidence: oneOf(value.confidence, ["low", "medium", "high"], "low") as Confidence,
    is_fix_first_candidate: Boolean(value.is_fix_first_candidate),
    is_generic_fallback: false,
    source_authority: oneOf(value.source_authority, SOURCE_AUTHORITIES, "s10_ai_authored"),
    legacy_source_used: Boolean(value.legacy_source_used),
    legacy_source_path: text(value.legacy_source_path) || null,
  };
}

function normaliseItemArray(
  value: unknown,
  warnings: S10ActionContradictionWarning[],
  fieldPath: string,
  limit = 12,
): S10FixItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: S10FixItem[] = [];
  for (const [index, raw] of value.entries()) {
    const item = normaliseFixItem(
      raw,
      `${fieldPath}_${index + 1}`,
      warnings,
      `${fieldPath}[${index}]`,
    );
    if (!item) continue;
    const key = actionKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function sortFixes(items: S10FixItem[]): S10FixItem[] {
  const urgencyRank: Record<S10FixUrgency, number> = {
    critical_gap: 0,
    high: 1,
    medium: 2,
    low: 3,
    optional: 4,
  };
  return [...items].sort((a, b) => {
    if (a.is_fix_first_candidate !== b.is_fix_first_candidate) {
      return a.is_fix_first_candidate ? -1 : 1;
    }
    return urgencyRank[a.urgency] - urgencyRank[b.urgency];
  });
}

function dedupeStrings(items: string[], limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items.map((s) => text(s)).filter(Boolean)) {
    const key = normaliseKey(item);
    if (!key || seen.has(key) || hasForbiddenActionPhrase(item)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function planContains(plan: string[], action: S10FixItem): boolean {
  const target = normaliseKey(`${action.title} ${action.exact_action} ${action.issue}`);
  return plan.some((step) => {
    const key = normaliseKey(step);
    return (
      key.includes(normaliseKey(action.title)) ||
      key.includes(normaliseKey(action.exact_action)) ||
      target.includes(key)
    );
  });
}

function addLegacyDiagnosticWarnings(args: {
  report: Record<string, unknown>;
  mustFixes: S10FixItem[];
  warnings: S10ActionContradictionWarning[];
}) {
  const raw = isRecord(args.report.raw_report) ? args.report.raw_report : null;
  if (!raw || args.mustFixes.length === 0) return;
  const mustFixText = normaliseKey(args.mustFixes.map((item) => item.title).join(" "));
  const legacyFields: Array<[string, unknown, S10ActionContradictionWarning["source"]]> = [
    ["raw_report.fix_first", raw.fix_first, "legacy_raw_report"],
    ["raw_report.improvements", raw.improvements, "legacy_improvements"],
    ["raw_report.next_take_plan", raw.next_take_plan, "legacy_next_take_plan"],
    ["raw_report.block_reasons", raw.block_reasons, "prior_prose"],
    ["raw_report.coaching_drills", raw.coaching_drills, "legacy_coaching_drills"],
  ];
  for (const [field, value, source] of legacyFields) {
    const valueText = Array.isArray(value)
      ? value.map((item) => text(item)).join(" ")
      : isRecord(value)
        ? JSON.stringify(value)
        : text(value);
    if (!valueText) continue;
    const key = normaliseKey(valueText);
    if (
      hasForbiddenActionPhrase(valueText) ||
      isFileNamingOnly(valueText) ||
      isPolishOnly(valueText)
    ) {
      addWarning(args.warnings, {
        affected_field: field,
        original_value: scalar(value),
        corrected_value: args.mustFixes[0]?.exact_action ?? null,
        reason:
          "Legacy action prose is diagnostic only and cannot outrank mandatory S10 material/package fixes.",
        source,
      });
      continue;
    }
    if (!key.includes("side") && !key.includes("song") && !key.includes("package") && mustFixText) {
      addWarning(args.warnings, {
        affected_field: field,
        original_value: scalar(value),
        corrected_value: args.mustFixes[0]?.exact_action ?? null,
        reason: "Legacy action prose did not address the S10 mandatory material/package blocker.",
        source,
      });
    }
  }
}

function normaliseNextActionPlan(input: {
  rawPlan: unknown;
  hierarchy: S10FixHierarchy;
  readiness: ReadinessAndScoreJudgement;
  warnings: S10ActionContradictionWarning[];
}): S10NextActionPlan {
  const raw = isRecord(input.rawPlan) ? input.rawPlan : {};
  const mustFixActions = input.hierarchy.must_fix_before_submitting.map(
    (item) => item.exact_action,
  );
  const shouldImproveActions = input.hierarchy.should_improve_if_retaking
    .filter((item) => item.urgency !== "optional")
    .map((item) => item.exact_action);
  const retakeNeeded =
    input.readiness.decision === "retake_required_if_possible" ||
    input.hierarchy.must_fix_before_submitting.length > 0;
  let retakePlan = dedupeStrings([...stringList(raw.retake_plan, 12), ...mustFixActions], 12);
  if (retakeNeeded) {
    for (const item of input.hierarchy.must_fix_before_submitting) {
      if (!planContains(retakePlan, item)) retakePlan.push(item.exact_action);
    }
    retakePlan = dedupeStrings([...retakePlan, ...shouldImproveActions], 12);
  } else {
    retakePlan = dedupeStrings(stringList(raw.retake_plan, 12), 12);
  }

  const finalChecks = dedupeStrings(
    [
      ...stringList(raw.final_checks, 10),
      ...input.hierarchy.must_fix_before_submitting
        .filter((item) => item.submission_impact === "final_check")
        .map((item) => item.exact_action),
    ],
    10,
  );
  const playbackChecks = dedupeStrings(
    [
      ...stringList(raw.playback_checks, 8),
      ...(input.hierarchy.must_fix_before_submitting.some((item) =>
        /\bcut off|song|package|continuous\b/i.test(`${item.title} ${item.exact_action}`),
      )
        ? ["Check the song/package does not cut off in the final export."]
        : []),
    ],
    8,
  );
  const submitChecklist = dedupeStrings([...stringList(raw.submit_checklist, 10)], 10);
  return {
    submit_checklist: retakeNeeded ? [] : submitChecklist,
    retake_plan: retakePlan,
    final_checks: finalChecks,
    playback_checks: playbackChecks,
    do_not_overfix: dedupeStrings(
      [
        ...stringList(raw.do_not_overfix, 8),
        ...input.hierarchy.do_not_overfix.map((item) => item.exact_action),
      ],
      8,
    ),
    if_time_is_short_guidance: dedupeStrings(stringList(raw.if_time_is_short_guidance, 6), 6),
    no_retake_needed_reason: retakeNeeded ? null : text(raw.no_retake_needed_reason) || null,
    confidence: oneOf(raw.confidence, ["low", "medium", "high"], "medium") as Confidence,
  };
}

function toPriorityFix(item: S10FixItem): {
  headline: string;
  rationale: string;
  kind: string;
  category: string;
} {
  const kind =
    item.urgency === "critical_gap"
      ? "critical_gap"
      : item.submission_impact === "final_check"
        ? "quick_win"
        : item.urgency === "high"
          ? "urgent"
          : "low_effort_high_impact";
  const category =
    item.source_category === "brief"
      ? "brief_adherence"
      : item.source_category === "admin_process"
        ? "brief_adherence"
        : item.source_category === "technical"
          ? "technical"
          : item.source_category === "performance"
            ? "acting"
            : "professional_presentation";
  return {
    headline: item.title,
    rationale: item.why_it_matters || item.evidence_summary || item.exact_action,
    kind,
    category,
  };
}

export function normaliseS10FixHierarchy(input: {
  hierarchy: unknown;
  matrix: BriefAchievementMatrix;
  readiness: ReadinessAndScoreJudgement;
  report?: Record<string, unknown>;
}): S10FixHierarchy {
  const raw = isRecord(input.hierarchy) ? input.hierarchy : {};
  const warnings: S10ActionContradictionWarning[] = [];
  const matrixMustFixes = input.matrix.requirement_results
    .filter(isMandatoryMaterialOrPackageGap)
    .map(itemFromMatrixResult);
  const mustFixes = [
    ...matrixMustFixes,
    ...normaliseItemArray(raw.must_fix_before_submitting, warnings, "s10_fix_hierarchy.must_fix"),
  ];
  const mustFixSeen = new Set<string>();
  const dedupedMustFixes = sortFixes(
    mustFixes.filter((item) => {
      const key = actionKey(item);
      if (mustFixSeen.has(key)) return false;
      mustFixSeen.add(key);
      return true;
    }),
  );
  const shouldImprove = normaliseItemArray(
    raw.should_improve_if_retaking,
    warnings,
    "s10_fix_hierarchy.should_improve_if_retaking",
  ).filter(
    (item) =>
      item.submission_impact !== "submission_blocker" &&
      !hasForbiddenActionPhrase(`${item.title} ${item.exact_action}`),
  );
  const optionalPolish = normaliseItemArray(
    raw.optional_polish,
    warnings,
    "s10_fix_hierarchy.optional_polish",
  ).filter((item) => item.submission_impact === "optional_polish" || item.urgency === "optional");
  const priorityFixes = sortFixes(
    [
      ...dedupedMustFixes,
      ...normaliseItemArray(raw.priority_fixes, warnings, "s10_fix_hierarchy.priority_fixes"),
    ].filter((item) => item.urgency !== "optional" && item.submission_impact !== "optional_polish"),
  ).slice(0, 8);
  let fixFirst = normaliseFixItem(
    raw.fix_first,
    "s10_fix_first",
    warnings,
    "s10_fix_hierarchy.fix_first",
  );
  if (dedupedMustFixes.length > 0) {
    const firstMustFix = dedupedMustFixes[0];
    if (
      !fixFirst ||
      fixFirst.submission_impact === "optional_polish" ||
      fixFirst.submission_impact === "final_check" ||
      isFileNamingOnly(`${fixFirst.title} ${fixFirst.exact_action}`) ||
      isPolishOnly(`${fixFirst.title} ${fixFirst.exact_action}`)
    ) {
      addWarning(warnings, {
        affected_field: "s10_fix_hierarchy.fix_first",
        original_value: fixFirst ? `${fixFirst.title}: ${fixFirst.exact_action}` : null,
        corrected_value: firstMustFix.exact_action,
        reason:
          "Missing mandatory material/package must outrank polish, file naming and admin-only checks.",
        source: fixFirst ? "s10_ai_judgement" : "s10_normaliser",
      });
      fixFirst = firstMustFix;
    }
  } else if (
    fixFirst &&
    (hasForbiddenActionPhrase(`${fixFirst.title} ${fixFirst.exact_action}`) ||
      fixFirst.submission_impact === "submission_blocker")
  ) {
    addWarning(warnings, {
      affected_field: "s10_fix_hierarchy.fix_first",
      original_value: `${fixFirst.title}: ${fixFirst.exact_action}`,
      corrected_value: null,
      reason: "Strong/complete action hierarchy cannot force a generic retake loop.",
      source: "s10_ai_judgement",
    });
    fixFirst = null;
  }
  const rawWarnings = Array.isArray(raw.action_contradiction_warnings)
    ? raw.action_contradiction_warnings.filter(isRecord)
    : [];
  for (const warning of rawWarnings) {
    addWarning(warnings, {
      affected_field: text(warning.affected_field, "s10_fix_hierarchy"),
      original_value: scalar(warning.original_value),
      corrected_value: scalar(warning.corrected_value),
      reason: text(warning.reason, "AI reported an action contradiction."),
      source: oneOf(
        warning.source,
        [
          "s10_ai_judgement",
          "legacy_raw_report",
          "legacy_improvements",
          "legacy_next_take_plan",
          "legacy_coaching_drills",
          "prior_prose",
          "s10_normaliser",
        ],
        "s10_ai_judgement",
      ),
    });
  }
  if (input.report) {
    addLegacyDiagnosticWarnings({ report: input.report, mustFixes: dedupedMustFixes, warnings });
  }
  return {
    fix_first: fixFirst,
    priority_fixes: priorityFixes,
    must_fix_before_submitting: dedupedMustFixes,
    should_improve_if_retaking: shouldImprove,
    optional_polish: optionalPolish,
    preserve: normaliseItemArray(raw.preserve, warnings, "s10_fix_hierarchy.preserve", 8),
    do_not_overfix: normaliseItemArray(
      raw.do_not_overfix,
      warnings,
      "s10_fix_hierarchy.do_not_overfix",
      8,
    ),
    action_contradiction_warnings: warnings,
  };
}

export function applyS10FixHierarchyNextAction(input: {
  report: Record<string, unknown>;
  matrix: BriefAchievementMatrix;
  readiness: ReadinessAndScoreJudgement;
}): {
  hierarchy: S10FixHierarchy;
  nextActionPlan: S10NextActionPlan;
  warnings: S10ActionContradictionWarning[];
} {
  const hierarchy = normaliseS10FixHierarchy({
    hierarchy: input.report.s10_fix_hierarchy,
    matrix: input.matrix,
    readiness: input.readiness,
    report: input.report,
  });
  const nextActionPlan = normaliseNextActionPlan({
    rawPlan: input.report.s10_next_action_plan,
    hierarchy,
    readiness: input.readiness,
    warnings: hierarchy.action_contradiction_warnings,
  });
  input.report.s10_fix_hierarchy = hierarchy;
  input.report.s10_next_action_plan = nextActionPlan;
  input.report.fix_first =
    hierarchy.fix_first?.exact_action ??
    (input.readiness.decision === "submit" ? "No mandatory fix before submission." : "");
  input.report.priority_fixes = hierarchy.priority_fixes.slice(0, 8).map(toPriorityFix);
  input.report.improvements = dedupeStrings(
    [
      ...hierarchy.must_fix_before_submitting.map((item) => item.exact_action),
      ...hierarchy.should_improve_if_retaking.map((item) => item.exact_action),
      ...((Array.isArray(input.report.improvements) ? input.report.improvements : []) as unknown[])
        .map((item) => text(item))
        .filter(Boolean)
        .filter((item) => !hasForbiddenActionPhrase(item)),
    ],
    15,
  );
  input.report.next_take_plan = {
    steps: dedupeStrings(
      [
        ...nextActionPlan.retake_plan,
        ...nextActionPlan.final_checks,
        ...nextActionPlan.playback_checks,
        ...nextActionPlan.submit_checklist,
      ],
      15,
    ),
    groups: [
      ...(nextActionPlan.retake_plan.length > 0
        ? [{ label: "retake_critical", items: nextActionPlan.retake_plan.slice(0, 10) }]
        : []),
      ...(nextActionPlan.final_checks.length > 0
        ? [{ label: "recording_setup", items: nextActionPlan.final_checks.slice(0, 10) }]
        : []),
      ...(nextActionPlan.submit_checklist.length > 0
        ? [{ label: "quick_wins", items: nextActionPlan.submit_checklist.slice(0, 10) }]
        : []),
    ],
  };
  input.report.coaching_drills = dedupeStrings(
    hierarchy.should_improve_if_retaking
      .filter((item) => item.source_category === "performance" || item.source_category === "polish")
      .filter((item) => item.submission_impact !== "submission_blocker")
      .map((item) => item.exact_action),
    15,
  );
  return {
    hierarchy,
    nextActionPlan,
    warnings: hierarchy.action_contradiction_warnings,
  };
}
