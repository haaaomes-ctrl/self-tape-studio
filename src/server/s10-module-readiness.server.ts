// SERVER-ONLY. S10 module-readiness validation and repair trigger plumbing.
//
// This is the shared post-AI contract for S10-09. It does not invent report
// prose. It classifies AI-authored modules, records repair instructions, and
// keeps two-step and single-pass outputs subject to the same checks.

import type { BriefContext, BriefRequirement, S10PerformerLevel } from "@/lib/audition-rules";
import {
  S10_MODULE_REPAIR_PROMPT_VERSION,
  S10_MODULE_REPAIR_TRIGGER_STATUSES,
  S10_MODULE_REPAIR_PROMPTS,
  S10_REPORT_MODULE_COVERAGE,
  type S10ModuleCompletenessStatus,
} from "./s10-report-prompt-map.server";
import type { S10ObservationContext } from "./s10-observation-context.server";

export const S10_MODULE_READINESS_VERSION = "s10_module_readiness_v1" as const;

export type S10ModuleReadinessSourceStage = "two_step" | "single_pass";

export type S10ModuleReadinessResult = {
  report_module: string;
  structured_output_field: string;
  status: S10ModuleCompletenessStatus;
  reason: string;
  affected_route_sections: string[];
  repair_triggered: boolean;
  blocks_report_value: boolean;
  // Decision-critical modules determine submit/retake/review or a truthful fix
  // hierarchy; if still blocked after repair/recovery they force terminal failure.
  // Non-decision-critical modules (e.g. technique nuance, timestamped notes) may
  // render as evidence_limited/module_error instead of failing the whole report.
  decision_critical: boolean;
};

export type S10ModuleRepairAction = {
  report_module: string;
  structured_output_field: string;
  status: Exclude<S10ModuleCompletenessStatus, "complete" | "not_assessable">;
  reason: string;
  repair_prompt_version: typeof S10_MODULE_REPAIR_PROMPT_VERSION;
  repair_prompt: string;
};

export type S10ModuleReadinessSummary = {
  version: typeof S10_MODULE_READINESS_VERSION;
  source_stage: S10ModuleReadinessSourceStage;
  module_ready: boolean;
  thin_shell_blocked: boolean;
  // True when at least one still-blocked module is decision-critical. The pipeline
  // only treats this as a terminal report-assembly failure; remaining blockers that
  // are not decision-critical are rendered as honest evidence-limited sections.
  decision_critical_blocked: boolean;
  repair_action_count: number;
  results: S10ModuleReadinessResult[];
  repair_actions: S10ModuleRepairAction[];
};

export type S10PersistedModuleRepairAction = Omit<S10ModuleRepairAction, "repair_prompt"> & {
  repair_prompt_omitted: true;
};

export type S10PersistedModuleReadinessSummary = Omit<
  S10ModuleReadinessSummary,
  "repair_actions"
> & {
  repair_actions: S10PersistedModuleRepairAction[];
};

type ModuleCheck = {
  reportModule: string;
  critical: boolean;
  // Decision-critical modules force terminal failure if still blocked after
  // repair/recovery. Non-decision-critical modules may degrade to an honest
  // evidence-limited section instead. Defaults to `critical` when unset.
  decisionCritical?: boolean;
  classify: (
    input: EvaluateS10ModuleReadinessInput,
  ) => Pick<S10ModuleReadinessResult, "status" | "reason">;
};

export type EvaluateS10ModuleReadinessInput = {
  report: Record<string, unknown>;
  observationContext: S10ObservationContext;
  briefContext?: BriefContext | Record<string, unknown> | null;
  briefRequirements?: BriefRequirement[] | null;
  selectedLevel?: S10PerformerLevel | string | null;
  sourceStage: S10ModuleReadinessSourceStage;
};

const GENERIC_FALLBACK_PATTERNS = [
  /\bno single public-safe priority fix was available\b/i,
  /\bpreserve the clearest choices already captured\b/i,
  /\bthis affects readability, not talent\b/i,
  /\breport polish unavailable\b/i,
  /\bperformance captured for review\b/i,
  /\bcontinue refining\b/i,
  /\bgood job\b/i,
  /\bstrengthen blocked material\b/i,
  /\bno specific (strength|fix|action|note)s? (was|were) available\b/i,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) return null;
    return current[key];
  }, source);
}

function flattenText(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => flattenText(item, depth + 1));
  if (isRecord(value)) return Object.values(value).flatMap((item) => flattenText(item, depth + 1));
  return [];
}

function hasGenericFallback(value: unknown): boolean {
  return flattenText(value).some((item) => GENERIC_FALLBACK_PATTERNS.some((re) => re.test(item)));
}

function hasSpecificText(value: unknown): boolean {
  return flattenText(value).some((item) => {
    if (GENERIC_FALLBACK_PATTERNS.some((re) => re.test(item))) return false;
    const words = item.split(/\s+/).filter(Boolean);
    return item.length >= 28 && words.length >= 5;
  });
}

function hasRenderableItems(value: unknown): boolean {
  return asArray(value).some((item) => hasSpecificText(item));
}

function coverageFor(reportModule: string) {
  return S10_REPORT_MODULE_COVERAGE.find((entry) => entry.reportModule === reportModule);
}

function isRepairTriggerStatus(
  status: S10ModuleCompletenessStatus,
): status is Exclude<S10ModuleCompletenessStatus, "complete" | "not_assessable"> {
  return (S10_MODULE_REPAIR_TRIGGER_STATUSES as readonly string[]).includes(status);
}

function hasBriefRequirements(input: EvaluateS10ModuleReadinessInput): boolean {
  return (input.briefRequirements ?? []).length > 0;
}

function hasVerifiedComponentEvidence(input: EvaluateS10ModuleReadinessInput): boolean {
  return (
    input.observationContext.component_verifications.length > 0 ||
    input.observationContext.observed_tape_sequence.length > 0
  );
}

function hasPresentObservedComponent(input: EvaluateS10ModuleReadinessInput): boolean {
  return input.observationContext.component_verifications.some(
    (row) =>
      row.observed_from_media === true &&
      row.evidence_basis === "observed_audio_video" &&
      (row.observed_status === "present" || row.observed_status === "partially_present"),
  );
}

function classifyObservedTape(input: EvaluateS10ModuleReadinessInput) {
  if (hasVerifiedComponentEvidence(input)) {
    return { status: "complete" as const, reason: "S10 component evidence is available." };
  }
  return {
    status: "missing" as const,
    reason: "No S10 observed tape sequence or component verification survived validation.",
  };
}

function classifyBriefAchievement(input: EvaluateS10ModuleReadinessInput) {
  const matrix = asRecord(input.report.brief_achievement_matrix);
  if (!hasBriefRequirements(input)) {
    return matrix && hasSpecificText(matrix)
      ? { status: "complete" as const, reason: "No supplied-brief matrix repair required." }
      : {
          status: "not_assessable" as const,
          reason:
            "No S10 brief requirements were supplied, so brief achievement is not assessable.",
        };
  }
  if (!matrix) {
    return {
      status: "missing" as const,
      reason: "Supplied-brief run has no brief_achievement_matrix.",
    };
  }
  if (hasGenericFallback(matrix)) {
    return {
      status: "generic" as const,
      reason: "Brief achievement matrix contains generic fallback wording.",
    };
  }
  const rows = asArray(matrix.requirement_results);
  if (rows.length === 0) {
    return {
      status: "missing" as const,
      reason: "Brief achievement matrix has no requirement_results.",
    };
  }
  if (rows.length < (input.briefRequirements ?? []).length) {
    return {
      status: "thin" as const,
      reason: "Brief achievement matrix does not cover every S10 brief requirement.",
    };
  }
  return {
    status: "complete" as const,
    reason: "Brief achievement matrix covers supplied S10 requirements.",
  };
}

function classifyReadiness(input: EvaluateS10ModuleReadinessInput) {
  const readiness = asRecord(input.report.readiness_score_judgement);
  if (!readiness) {
    return { status: "missing" as const, reason: "readiness_score_judgement is missing." };
  }
  if (hasGenericFallback(readiness)) {
    return {
      status: "generic" as const,
      reason: "Readiness judgement contains generic fallback wording.",
    };
  }
  const decision = text(readiness.decision);
  const headline = text(readiness.headline);
  const explanation = text(readiness.score_explanation);
  const rationale = asArray(readiness.rationale);
  if (!decision || (!headline && !explanation && rationale.length === 0)) {
    return {
      status: "thin" as const,
      reason: "Readiness judgement lacks a decision with performer-facing rationale.",
    };
  }
  return { status: "complete" as const, reason: "Readiness judgement is populated." };
}

function classifyLevelCalibration(input: EvaluateS10ModuleReadinessInput) {
  const readiness = asRecord(input.report.readiness_score_judgement);
  const calibration = asRecord(readiness?.selected_level_calibration);
  if (!input.selectedLevel) {
    return {
      status: "not_assessable" as const,
      reason: "Selected level was unavailable for this module check.",
    };
  }
  if (!calibration) {
    return {
      status: "missing" as const,
      reason: "Selected-level calibration is missing from readiness_score_judgement.",
    };
  }
  const required = [
    "standard_applied",
    "evidence_threshold",
    "readiness_standard",
    "what_meets_level",
    "what_falls_short",
    "recommendation_impact",
  ];
  const missing = required.filter((key) => !hasSpecificText(calibration[key]));
  if (missing.length > 0) {
    return {
      status: "thin" as const,
      reason: `Selected-level calibration is missing useful detail for: ${missing.join(", ")}.`,
    };
  }
  return { status: "complete" as const, reason: "Selected-level calibration is populated." };
}

function classifyFixHierarchy(input: EvaluateS10ModuleReadinessInput) {
  const hierarchy = asRecord(input.report.s10_fix_hierarchy);
  if (!hierarchy) return { status: "missing" as const, reason: "s10_fix_hierarchy is missing." };
  if (hasGenericFallback(hierarchy)) {
    return { status: "generic" as const, reason: "Fix hierarchy contains fallback wording." };
  }
  const hasFixFirst = hasSpecificText(hierarchy.fix_first);
  const hasFixRows =
    hasRenderableItems(hierarchy.priority_fixes) ||
    hasRenderableItems(hierarchy.must_fix_before_submitting) ||
    hasRenderableItems(hierarchy.should_improve_if_retaking) ||
    hasRenderableItems(hierarchy.optional_polish);
  if (!hasFixFirst && !hasFixRows) {
    return {
      status: "thin" as const,
      reason: "Fix hierarchy has no specific fix-first or prioritised action rows.",
    };
  }
  return { status: "complete" as const, reason: "Fix hierarchy has specific action content." };
}

function classifyNextAction(input: EvaluateS10ModuleReadinessInput) {
  const plan = asRecord(input.report.s10_next_action_plan);
  if (!plan) return { status: "missing" as const, reason: "s10_next_action_plan is missing." };
  if (hasGenericFallback(plan)) {
    return { status: "generic" as const, reason: "Next action plan contains fallback wording." };
  }
  const groupsHaveItems = asArray(plan.groups).some((group) => {
    const record = asRecord(group);
    return Boolean(record && hasRenderableItems(record.items));
  });
  if (!hasRenderableItems(plan.steps) && !groupsHaveItems) {
    return {
      status: "thin" as const,
      reason: "Next action plan has no specific performer action steps.",
    };
  }
  return { status: "complete" as const, reason: "Next action plan has specific steps." };
}

function classifyProfessionalCritique(input: EvaluateS10ModuleReadinessInput) {
  const critique = asRecord(input.report.s10_professional_critique);
  if (!critique) {
    return { status: "missing" as const, reason: "s10_professional_critique is missing." };
  }
  if (hasGenericFallback(critique)) {
    return {
      status: "generic" as const,
      reason: "Professional critique contains generic fallback wording.",
    };
  }
  const strengthFields = [
    "performance_strengths",
    "brief_package_strengths",
    "technical_presentation_strengths",
    "vocal_or_singing_strengths",
    "acting_strengths",
    "movement_or_physical_strengths",
    "preserve",
    "do_not_overfix",
  ];
  const hasCritiquePayload =
    hasSpecificText(critique.summary) ||
    strengthFields.some((key) => hasRenderableItems(critique[key])) ||
    hasRenderableItems(critique.critique_limitations);
  if (!hasCritiquePayload) {
    return {
      status: "thin" as const,
      reason:
        "Professional critique has no specific strengths, preserve, do-not-overfix or limitation detail.",
    };
  }
  return { status: "complete" as const, reason: "Professional critique is populated." };
}

function classifyTechniqueCommentary(input: EvaluateS10ModuleReadinessInput) {
  const commentary = asRecord(input.report.s10_technique_commentary);
  if (!commentary) {
    return hasPresentObservedComponent(input)
      ? {
          status: "missing" as const,
          reason: "Verified component evidence exists but s10_technique_commentary is missing.",
        }
      : {
          status: "not_assessable" as const,
          reason: "Technique commentary cannot be assessed without verified component evidence.",
        };
  }
  if (hasGenericFallback(commentary)) {
    return {
      status: "generic" as const,
      reason: "Technique commentary contains generic fallback wording.",
    };
  }
  const hasTechniquePayload = Object.values(commentary).some((area) => {
    const record = asRecord(area);
    if (!record) return false;
    return (
      hasRenderableItems(record.observations) ||
      hasRenderableItems(record.actionable_notes) ||
      hasRenderableItems(record.limitations) ||
      hasSpecificText(record.summary)
    );
  });
  if (hasPresentObservedComponent(input) && !hasTechniquePayload) {
    return {
      status: "thin" as const,
      reason:
        "Technique commentary has no area-level observation, action or limitation despite verified evidence.",
    };
  }
  return hasTechniquePayload
    ? { status: "complete" as const, reason: "Technique commentary is populated." }
    : {
        status: "not_assessable" as const,
        reason: "No technique area had assessable evidence to render.",
      };
}

function classifyTimestampedCommentary(input: EvaluateS10ModuleReadinessInput) {
  const commentary = asRecord(input.report.s10_timestamped_commentary);
  if (!commentary) {
    return {
      status: "not_assessable" as const,
      reason:
        "Timestamped commentary is unavailable; route can render component-level commentary instead.",
    };
  }
  if (hasGenericFallback(commentary)) {
    return {
      status: "generic" as const,
      reason: "Timestamped commentary contains generic fallback wording.",
    };
  }
  return hasRenderableItems(commentary.notes) || hasRenderableItems(commentary.limitations)
    ? { status: "complete" as const, reason: "Timestamped commentary has notes or limitations." }
    : {
        status: "not_assessable" as const,
        reason: "Timestamped commentary has no safe timing-supported notes.",
      };
}

function classifyRoleMaterialContext(input: EvaluateS10ModuleReadinessInput) {
  const roleMaterialContext = asRecord(input.report.role_material_context);
  const briefRecord = asRecord(input.briefContext);
  const hasRoleRequirement = (input.briefRequirements ?? []).some(
    (requirement) => requirement.category === "role_context",
  );
  const roleSignals = [
    briefRecord?.role,
    briefRecord?.character,
    briefRecord?.production,
    briefRecord?.project,
    briefRecord?.material,
    briefRecord?.song,
    input.report.role,
    input.report.character,
    input.report.production,
    input.report.song,
  ];
  const expectsRoleContext =
    hasRoleRequirement || roleSignals.some((value) => flattenText(value).join(" ").length > 0);
  if (!expectsRoleContext) {
    return {
      status: "not_assessable" as const,
      reason: "No supplied or confidently resolved role/material context is available.",
    };
  }
  if (!roleMaterialContext) {
    return {
      status: "missing" as const,
      reason: "Role/material context is expected but role_material_context is missing.",
    };
  }
  if (hasGenericFallback(roleMaterialContext)) {
    return {
      status: "generic" as const,
      reason: "Role/material context contains generic fallback wording.",
    };
  }
  const hasSourceBasis =
    hasSpecificText(roleMaterialContext.source_summary) ||
    asArray(roleMaterialContext.source_basis).length > 0 ||
    hasRenderableItems(roleMaterialContext.demands);
  return hasSourceBasis
    ? { status: "complete" as const, reason: "Role/material context has source-basis detail." }
    : {
        status: "thin" as const,
        reason: "Role/material context lacks source basis, demands or uncertainty detail.",
      };
}

const MODULE_CHECKS: readonly ModuleCheck[] = [
  { reportModule: "observed tape", critical: true, classify: classifyObservedTape },
  { reportModule: "component breakdown", critical: true, classify: classifyObservedTape },
  { reportModule: "brief achievement", critical: true, classify: classifyBriefAchievement },
  { reportModule: "overall readiness", critical: true, classify: classifyReadiness },
  { reportModule: "verdict", critical: true, classify: classifyReadiness },
  {
    reportModule: "performer level calibration",
    critical: true,
    classify: classifyLevelCalibration,
  },
  { reportModule: "fix-first", critical: true, classify: classifyFixHierarchy },
  { reportModule: "prioritised fixes", critical: true, classify: classifyFixHierarchy },
  { reportModule: "next action", critical: true, classify: classifyNextAction },
  { reportModule: "strengths", critical: true, classify: classifyProfessionalCritique },
  {
    reportModule: "professional critique",
    critical: true,
    classify: classifyProfessionalCritique,
  },
  {
    reportModule: "technique commentary",
    critical: true,
    decisionCritical: false,
    classify: classifyTechniqueCommentary,
  },
  {
    reportModule: "timestamped notes",
    critical: false,
    decisionCritical: false,
    classify: classifyTimestampedCommentary,
  },
  {
    reportModule: "role/material context",
    critical: false,
    decisionCritical: false,
    classify: classifyRoleMaterialContext,
  },
];

function buildRepairAction(result: S10ModuleReadinessResult): S10ModuleRepairAction | null {
  if (!isRepairTriggerStatus(result.status)) return null;
  const coverage = coverageFor(result.report_module);
  const basePrompt = coverage?.repairPrompt ?? S10_MODULE_REPAIR_PROMPTS[result.status];
  return {
    report_module: result.report_module,
    structured_output_field: result.structured_output_field,
    status: result.status,
    reason: result.reason,
    repair_prompt_version: S10_MODULE_REPAIR_PROMPT_VERSION,
    repair_prompt: [
      basePrompt,
      `AI question: ${coverage?.aiQuestion ?? "Repair this S10 module."}`,
      `Structured output field: ${result.structured_output_field}.`,
      `Reason for repair: ${result.reason}`,
    ].join("\n"),
  };
}

export function evaluateS10ModuleReadiness(
  input: EvaluateS10ModuleReadinessInput,
): S10ModuleReadinessSummary {
  const results = MODULE_CHECKS.map((check) => {
    const coverage = coverageFor(check.reportModule);
    const classified = check.classify(input);
    const repairTriggered = isRepairTriggerStatus(classified.status);
    return {
      report_module: check.reportModule,
      structured_output_field: coverage?.structuredOutputField ?? check.reportModule,
      status: classified.status,
      reason: classified.reason,
      affected_route_sections: coverage?.routeSectionKeys ? [...coverage.routeSectionKeys] : [],
      repair_triggered: repairTriggered,
      blocks_report_value: check.critical && repairTriggered,
      decision_critical: check.decisionCritical ?? check.critical,
    } satisfies S10ModuleReadinessResult;
  });

  const repairActions = results
    .map(buildRepairAction)
    .filter((action): action is S10ModuleRepairAction => action != null);
  const blockingCoreResults = results.filter((result) => result.blocks_report_value);
  const thinShellBlocked =
    blockingCoreResults.length >= 3 ||
    (blockingCoreResults.some((result) => result.report_module === "observed tape") &&
      blockingCoreResults.some((result) => result.report_module === "overall readiness"));

  return {
    version: S10_MODULE_READINESS_VERSION,
    source_stage: input.sourceStage,
    module_ready: blockingCoreResults.length === 0,
    thin_shell_blocked: thinShellBlocked,
    decision_critical_blocked: blockingCoreResults.some((result) => result.decision_critical),
    repair_action_count: repairActions.length,
    results,
    repair_actions: repairActions,
  };
}

// Blockers that are not decision-critical may be rendered as honest
// evidence-limited/module-error sections rather than failing the whole report.
export function getS10DegradableBlockers(
  summary: S10ModuleReadinessSummary,
): S10ModuleReadinessResult[] {
  return summary.results.filter(
    (result) => result.blocks_report_value && !result.decision_critical,
  );
}

export function getS10ModuleReadinessStatus(
  summary: S10ModuleReadinessSummary,
  reportModule: string,
): S10ModuleCompletenessStatus | null {
  return summary.results.find((result) => result.report_module === reportModule)?.status ?? null;
}

export function getS10ModuleValue(source: Record<string, unknown>, structuredOutputField: string) {
  return structuredOutputField
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .map((field) => getPath(source, field))
    .find((value) => value != null);
}

export function summariseS10ModuleReadinessForPersistence(
  summary: S10ModuleReadinessSummary,
): S10PersistedModuleReadinessSummary {
  return {
    ...summary,
    repair_actions: summary.repair_actions.map(({ repair_prompt: _repairPrompt, ...action }) => ({
      ...action,
      repair_prompt_omitted: true as const,
    })),
  };
}
