// SERVER-ONLY. R10 locked-down decision-support report JSON builder + public
// boundary validator.
//
// Pure functions. The builder projects an already-finalised legacy report into
// the minimum public-safe report surface allowed while public scoring, public
// technique authority, comparison recommendation, role-fit and production
// release gates remain blocked.
//
// This projection deliberately does NOT surface scores, category scores,
// component scores, named technique authority, comparison output, role-fit,
// raw report data, QA artefacts, evidence IDs or storage/provenance fields.
//
// `validateV2PublicBoundary` is the gate run before persisting v2 to
// `takes.report`. If it fails the pipeline falls back to v1.

import type { FutureDimensionsResult } from "./dimensions";

export interface V2Report {
  schema_version: "v2-component";
  mode: "brief" | "baseline";
  audition_type: string | null;
  submission_verdict: PublicSubmissionVerdict;
  why_this_verdict: VerdictRationale;
  feedback_reliability: FeedbackReliability;
  brief_requirements: BriefRequirementPublic[];
  brief_achievement: BriefAchievementPublic;
  strengths: unknown[];
  preserve: string[];
  improvements: unknown[];
  fix_first: string | null;
  priority_fixes: PriorityFixPublic[];
  must_fix_before_submitting: string[];
  should_improve_if_retaking: string[];
  optional_polish: string[];
  do_not_overfix: string[];
  next_take_plan: unknown;
  not_assessable: string[];
  verdict: string | null;
  reliability: string | null;
}

export type SubmissionDecision =
  | "submit"
  | "submit_if_deadline_is_close"
  | "review_carefully"
  | "retake_recommended"
  | "retake_required_if_possible"
  | "not_assessable";

export interface PublicSubmissionVerdict {
  decision: SubmissionDecision;
  label: string;
  reason: string;
  blocked: boolean;
}

export interface VerdictRationale {
  summary: string;
  main_reasons: string[];
  limitations: string[];
}

export interface FeedbackReliability {
  level: "high" | "medium" | "low";
  summary: string;
}

export interface PriorityFixPublic {
  headline: string;
  rationale?: string;
  kind?: string;
  category?: string;
}

export interface BriefRequirementPublic {
  requirement_id?: string;
  source_text: string;
  public_summary: string;
  category: BriefRequirementCategory;
  obligation?: BriefRequirementObligation;
  requirement_type?: BriefRequirementType;
  achievement_status: BriefAchievementStatus;
  readiness_impact?: BriefReadinessImpact;
  public_evidence_summary?: string;
  assessability_limits: string[];
  next_take_action?: string;
}

export type BriefRequirementCategory =
  | "mandatory"
  | "preferred"
  | "optional"
  | "style_context"
  | "material_instruction"
  | "video_audio_setup"
  | "admin_process"
  | "ambiguous";

export type BriefRequirementObligation = "mandatory" | "preferred" | "optional" | "ambiguous";

export type BriefRequirementType =
  | "technique"
  | "skill"
  | "song"
  | "dance"
  | "scene"
  | "monologue"
  | "copy"
  | "role_context"
  | "show_number"
  | "format"
  | "duration"
  | "framing"
  | "submission_process"
  | "other";

export type BriefAchievementStatus =
  | "achieved"
  | "mostly_achieved"
  | "partly_achieved"
  | "not_achieved"
  | "not_assessable"
  | "not_applicable";

export type BriefReadinessImpact =
  | "supports_submission"
  | "minor_gap"
  | "material_gap"
  | "retake_recommended"
  | "submission_blocker"
  | "not_assessable"
  | "not_applicable";

export interface BriefAchievementPublic {
  overall_status: BriefAchievementStatus;
  summary: string;
  mandatory_requirements_status: string;
  readiness_impact: BriefReadinessImpact;
  mandatory_status?: "clear" | "some_gaps" | "blocked" | "not_assessable" | "not_applicable";
  readiness_effect?: string;
  not_assessable_summary?: string;
}

export interface BuildV2ReportArgs {
  legacyReport: Record<string, unknown> | null | undefined;
  futureDimensions: FutureDimensionsResult | null | undefined;
  auditionType: string | null | undefined;
  mode: "brief" | "baseline";
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const DECISION_LABELS: Record<SubmissionDecision, string> = {
  submit: "Submit",
  submit_if_deadline_is_close: "Submit if deadline is close",
  review_carefully: "Review carefully",
  retake_recommended: "Retake recommended",
  retake_required_if_possible: "Retake required if possible",
  not_assessable: "Not assessable",
};

const DECISION_VALUES = new Set(Object.keys(DECISION_LABELS));

const BLOCKED_PUBLIC_TEXT =
  /\b(?:castability|castable|bookability|bookable|marketability|marketable|role[-\s]?fit|employability|commercial\s+look|callback|recall[-\s]?ready|recall\s+worthy|would\s+(?:get|be)\s+(?:a\s+)?recall|guaranteed|guarantees|winner|best\s+take|selected\s+take|overall\s+score|category\s+score|score\s+of\s+\d+|Meisner|Stanislavski|Uta\s+Hagen|Chekhov|Laban|Viewpoints|Suzuki)\b/i;

function publicText(raw: unknown, maxLength = 420): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (BLOCKED_PUBLIC_TEXT.test(text)) return null;
  return text.slice(0, maxLength).trim();
}

function dedupe(items: string[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const text = publicText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function publicTextArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  const mapped = value
    .map((item) => {
      if (typeof item === "string") return item;
      const obj = asObj(item);
      return (
        asStr(obj?.text) ??
        asStr(obj?.title) ??
        asStr(obj?.headline) ??
        asStr(obj?.point) ??
        asStr(obj?.note) ??
        asStr(obj?.summary)
      );
    })
    .filter((item): item is string => typeof item === "string");
  return dedupe(mapped, max);
}

function fixFirstText(raw: unknown): string | null {
  if (typeof raw === "string") return publicText(raw, 220);
  const obj = asObj(raw);
  return (
    publicText(obj?.headline, 220) ?? publicText(obj?.title, 220) ?? publicText(obj?.point, 220)
  );
}

function priorityFixFromValue(value: unknown): PriorityFixPublic | null {
  if (typeof value === "string") {
    const headline = publicText(value, 200);
    return headline ? { headline } : null;
  }
  const obj = asObj(value);
  if (!obj) return null;
  const headline =
    publicText(obj.headline, 200) ??
    publicText(obj.title, 200) ??
    publicText(obj.action, 200) ??
    publicText(obj.what_to_change, 200);
  if (!headline) return null;
  const rationale =
    publicText(obj.rationale, 320) ??
    publicText(obj.why_it_matters, 320) ??
    publicText(obj.reason, 320);
  const kind = publicText(obj.kind, 60) ?? publicText(obj.type, 60) ?? undefined;
  const category = publicText(obj.category, 80) ?? undefined;
  return {
    headline,
    ...(rationale ? { rationale } : {}),
    ...(kind ? { kind } : {}),
    ...(category ? { category } : {}),
  };
}

function normalisePriorityFixes(r: Record<string, unknown>): PriorityFixPublic[] {
  const fixes = asArray(r.priority_fixes)
    .map(priorityFixFromValue)
    .filter((item): item is PriorityFixPublic => item !== null);
  if (fixes.length > 0) return fixes.slice(0, 8);
  const fallback = fixFirstText(r.fix_first);
  return fallback ? [{ headline: fallback }] : [];
}

function isMustFix(fix: PriorityFixPublic): boolean {
  const kind = (fix.kind ?? "").toLowerCase();
  return (
    kind.includes("urgent") ||
    kind.includes("critical") ||
    kind.includes("blocker") ||
    kind.includes("retake")
  );
}

function normalisePlan(value: unknown, drills: unknown): unknown {
  const plan = asObj(value);
  if (plan) {
    const steps = publicTextArray(plan.steps, 15);
    const groups = safePlanGroups(plan.groups);
    return {
      ...(steps.length > 0 ? { steps } : {}),
      ...(groups.length > 0 ? { groups } : {}),
    };
  }
  const arr = publicTextArray(value, 15);
  if (arr.length > 0) return { steps: arr };
  const drillSteps = publicTextArray(drills, 15);
  return drillSteps.length > 0 ? { steps: drillSteps } : { steps: [] };
}

function safePlanGroups(value: unknown): Array<{ label: string; items: string[] }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const obj = asObj(entry);
      const label = publicText(obj?.label, 80);
      const items = publicTextArray(obj?.items, 10);
      return label && items.length > 0 ? { label, items } : null;
    })
    .filter((entry): entry is { label: string; items: string[] } => entry !== null)
    .slice(0, 6);
}

function normaliseReliability(r: Record<string, unknown>): FeedbackReliability {
  const raw =
    asStr(r.feedback_reliability_override) ?? asStr(r.feedback_reliability) ?? asStr(r.reliability);
  const level: FeedbackReliability["level"] =
    raw === "high" || raw === "medium" || raw === "low" ? raw : "medium";
  const reason =
    publicText(r.feedback_reliability_reason, 260) ??
    publicText(r.feedback_reliability_reason_code, 260) ??
    publicText(r.confidence_reason, 260);
  const summary =
    reason ??
    (level === "high"
      ? "The tape provides enough clear information for practical feedback."
      : level === "low"
        ? "Some parts of the tape may limit how firmly the feedback can be judged."
        : "Use the feedback as a practical guide and check any brief-specific details yourself.");
  return { level, summary };
}

function mapDecisionFromLabel(
  label: string | null,
  blocked: boolean,
  reliability: FeedbackReliability,
): SubmissionDecision {
  const lower = (label ?? "").toLowerCase();
  if (lower.includes("not assessable") || (reliability.level === "low" && !label)) {
    return "not_assessable";
  }
  if (blocked || lower.includes("not ready")) return "retake_required_if_possible";
  if (lower.includes("worth another") || lower.includes("another take"))
    return "retake_recommended";
  if (lower.includes("ready") || lower.includes("strong")) return "submit";
  return "review_carefully";
}

function normaliseSubmissionVerdict(
  r: Record<string, unknown>,
  reliability: FeedbackReliability,
): PublicSubmissionVerdict {
  const source = asObj(r.submission_verdict);
  const rawDecision = asStr(source?.decision) ?? asStr(source?.state);
  const blocked = asBool(source?.blocked) === true || asBool(r.at_risk) === true;
  const label =
    publicText(source?.label, 120) ??
    publicText(r.verdict_final, 120) ??
    publicText(r.verdict, 120);
  const decision: SubmissionDecision =
    rawDecision && DECISION_VALUES.has(rawDecision)
      ? (rawDecision as SubmissionDecision)
      : mapDecisionFromLabel(label, blocked, reliability);
  const reason =
    publicText(source?.reason, 320) ??
    (decision === "submit"
      ? "The report found no must-fix blocker in the current public-safe fields."
      : decision === "not_assessable"
        ? "The available report data is not sufficient for a firm submit or retake judgement."
        : "Review the priority fixes before deciding whether to submit this take.");
  return {
    decision,
    label: DECISION_LABELS[decision],
    reason,
    blocked,
  };
}

function normaliseWhyThisVerdict(
  r: Record<string, unknown>,
  verdict: PublicSubmissionVerdict,
  mustFix: string[],
  shouldImprove: string[],
  notAssessable: string[],
): VerdictRationale {
  const raw = r.why_this_verdict;
  const rawObj = asObj(raw);
  const summary =
    publicText(raw, 420) ??
    publicText(rawObj?.summary, 420) ??
    publicText(rawObj?.reason, 420) ??
    verdict.reason;
  const rawReasons = publicTextArray(rawObj?.main_reasons ?? rawObj?.reasons, 5);
  const mainReasons =
    rawReasons.length > 0
      ? rawReasons
      : dedupe([mustFix[0], shouldImprove[0], verdict.reason].filter(Boolean) as string[], 3);
  return {
    summary,
    main_reasons: mainReasons,
    limitations: notAssessable.slice(0, 5),
  };
}

function normaliseAchievementStatus(raw: unknown): BriefAchievementStatus {
  const status = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (status === "achieved") return "achieved";
  if (status === "mostly_achieved") return "mostly_achieved";
  if (status === "partly_achieved" || status === "partially_achieved") return "partly_achieved";
  if (status === "not_achieved") return "not_achieved";
  if (status === "not_assessable") return "not_assessable";
  if (status === "not_applicable") return "not_applicable";
  return "not_assessable";
}

function normaliseReadinessImpact(raw: unknown): BriefReadinessImpact | undefined {
  const impact = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (
    impact === "supports_submission" ||
    impact === "minor_gap" ||
    impact === "material_gap" ||
    impact === "retake_recommended" ||
    impact === "submission_blocker" ||
    impact === "not_assessable" ||
    impact === "not_applicable"
  ) {
    return impact;
  }
  return undefined;
}

function normaliseRequirementObligation(raw: unknown): BriefRequirementObligation | undefined {
  const text =
    typeof raw === "string"
      ? raw
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      : "";
  if (text === "mandatory" || text === "required" || text === "must") return "mandatory";
  if (text === "preferred" || text === "nice_to_have") return "preferred";
  if (text === "optional") return "optional";
  if (text === "ambiguous" || text === "unclear") return "ambiguous";
  return undefined;
}

function normaliseRequirementCategory(
  rawCategory: unknown,
  rawObligation: unknown,
  sourceText: string,
): BriefRequirementCategory {
  const category = (typeof rawCategory === "string" ? rawCategory : "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const obligation = normaliseRequirementObligation(rawObligation);
  if (category === "mandatory" || category === "required") return "mandatory";
  if (category === "preferred") return "preferred";
  if (category === "optional") return "optional";
  if (category === "style" || category === "style_context") return "style_context";
  if (
    category === "material" ||
    category === "material_instruction" ||
    category === "material_requirement"
  )
    return "material_instruction";
  if (
    category === "video_audio_setup" ||
    category === "technical_setup" ||
    category === "setup" ||
    category === "technical" ||
    category === "audio" ||
    category === "video" ||
    category === "framing"
  )
    return "video_audio_setup";
  if (category === "admin" || category === "process" || category === "admin_process")
    return "admin_process";
  if (category === "ambiguous" || category === "unclear") return "ambiguous";

  const lower = sourceText.toLowerCase();
  if (/\b(frame|framing|audio|video|landscape|portrait|slate|reader|lighting)\b/.test(lower))
    return "video_audio_setup";
  if (/\b(scene|song|monologue|dance|copy|material|sides|cut)\b/.test(lower))
    return "material_instruction";
  if (/\b(upload|submit|deadline|file|label|name|form|link)\b/.test(lower)) return "admin_process";
  if (/\b(style|tone|accent|period|genre)\b/.test(lower)) return "style_context";
  return obligation ?? "ambiguous";
}

function normaliseRequirementType(
  raw: unknown,
  sourceText: string,
): BriefRequirementType | undefined {
  const text =
    typeof raw === "string"
      ? raw
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      : "";
  const allowed: BriefRequirementType[] = [
    "technique",
    "skill",
    "song",
    "dance",
    "scene",
    "monologue",
    "copy",
    "role_context",
    "show_number",
    "format",
    "duration",
    "framing",
    "submission_process",
    "other",
  ];
  if (allowed.includes(text as BriefRequirementType)) return text as BriefRequirementType;
  const lower = sourceText.toLowerCase();
  if (/\bsong|cut|number\b/.test(lower)) return "song";
  if (/\bdance|movement\b/.test(lower)) return "dance";
  if (/\bscene|sides\b/.test(lower)) return "scene";
  if (/\bmonologue\b/.test(lower)) return "monologue";
  if (/\bcopy|commercial copy\b/.test(lower)) return "copy";
  if (/\bformat|file|label|upload|submit|deadline\b/.test(lower)) return "submission_process";
  if (/\bduration|seconds|minutes|mins\b/.test(lower)) return "duration";
  if (/\bframe|framing|full[-\s]?body|landscape|portrait\b/.test(lower)) return "framing";
  return undefined;
}

function normaliseBriefRequirement(value: unknown): BriefRequirementPublic | null {
  const obj = asObj(value);
  if (!obj) return null;
  const sourceText =
    publicText(obj.source_text, 300) ??
    publicText(obj.requirement, 300) ??
    publicText(obj.text, 300) ??
    publicText(obj.public_summary, 300);
  if (!sourceText) return null;
  const publicSummary = publicText(obj.public_summary, 260) ?? sourceText;
  const category = normaliseRequirementCategory(
    obj.category ?? obj.requirement_category,
    obj.obligation,
    sourceText,
  );
  const obligation = normaliseRequirementObligation(obj.obligation ?? obj.category);
  const requirementType = normaliseRequirementType(obj.requirement_type ?? obj.type, sourceText);
  const achievement_status = normaliseAchievementStatus(
    asStr(obj.achievement_status) ?? obj.status,
  );
  const readinessImpact =
    normaliseReadinessImpact(obj.readiness_impact) ??
    (achievement_status === "not_assessable" ? "not_assessable" : undefined);
  const publicEvidenceSummary =
    publicText(obj.public_evidence_summary, 260) ??
    publicText(obj.evidence_summary, 260) ??
    undefined;
  const nextTakeAction =
    publicText(obj.next_take_action, 220) ?? publicText(obj.action, 220) ?? undefined;
  return {
    ...(publicText(obj.requirement_id, 120)
      ? { requirement_id: publicText(obj.requirement_id, 120)! }
      : {}),
    source_text: sourceText,
    public_summary: publicSummary,
    category,
    ...(obligation ? { obligation } : {}),
    ...(requirementType ? { requirement_type: requirementType } : {}),
    achievement_status,
    ...(readinessImpact ? { readiness_impact: readinessImpact } : {}),
    ...(publicEvidenceSummary ? { public_evidence_summary: publicEvidenceSummary } : {}),
    assessability_limits: publicTextArray(obj.assessability_limits, 5),
    ...(nextTakeAction ? { next_take_action: nextTakeAction } : {}),
  };
}

function normaliseBriefRequirements(value: unknown): BriefRequirementPublic[] {
  return asArray(value)
    .map(normaliseBriefRequirement)
    .filter((item): item is BriefRequirementPublic => item !== null)
    .slice(0, 20);
}

function isMandatoryBriefRequirement(item: BriefRequirementPublic): boolean {
  return item.obligation === "mandatory" || item.category === "mandatory";
}

function isAssessableBriefGap(item: BriefRequirementPublic): boolean {
  return (
    item.achievement_status === "not_achieved" ||
    item.achievement_status === "partly_achieved" ||
    item.achievement_status === "mostly_achieved"
  );
}

function briefRequirementAction(item: BriefRequirementPublic): string {
  const summary = sentenceFragment(item.public_summary);
  return (
    item.next_take_action ??
    (item.category === "video_audio_setup"
      ? `Fix the setup requirement before submitting: ${summary}.`
      : item.category === "admin_process"
        ? `Resolve the admin/process instruction before submitting: ${summary}.`
        : `Address the brief requirement: ${summary}.`)
  );
}

function sentenceFragment(value: string): string {
  return value.replace(/[.!?]+$/g, "").trim();
}

function briefPriorityFixes(requirements: BriefRequirementPublic[]): PriorityFixPublic[] {
  return requirements
    .filter(
      (item) =>
        isMandatoryBriefRequirement(item) &&
        isAssessableBriefGap(item) &&
        (item.readiness_impact === "submission_blocker" ||
          item.readiness_impact === "material_gap" ||
          item.readiness_impact === "retake_recommended"),
    )
    .map((item) => ({
      headline: briefRequirementAction(item),
      rationale:
        item.public_evidence_summary ??
        `This is a ${item.obligation ?? item.category} supplied brief requirement.`,
      kind:
        item.readiness_impact === "submission_blocker" ? "critical_gap" : "low_effort_high_impact",
      category: "brief_adherence",
    }))
    .slice(0, 4);
}

function dedupePriorityFixes(fixes: PriorityFixPublic[]): PriorityFixPublic[] {
  const seen = new Set<string>();
  const out: PriorityFixPublic[] = [];
  for (const fix of fixes) {
    const key = fix.headline.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fix);
    if (out.length >= 8) break;
  }
  return out;
}

function applyBriefVerdictInfluence(
  verdict: PublicSubmissionVerdict,
  requirements: BriefRequirementPublic[],
): PublicSubmissionVerdict {
  const submissionBlocker = requirements.find(
    (item) =>
      isMandatoryBriefRequirement(item) &&
      isAssessableBriefGap(item) &&
      item.readiness_impact === "submission_blocker",
  );
  if (submissionBlocker) {
    return {
      decision: "retake_required_if_possible",
      label: DECISION_LABELS.retake_required_if_possible,
      reason: `An assessable mandatory brief requirement is not achieved: ${submissionBlocker.public_summary}.`,
      blocked: true,
    };
  }

  const materialGap = requirements.find(
    (item) =>
      isMandatoryBriefRequirement(item) &&
      isAssessableBriefGap(item) &&
      (item.readiness_impact === "material_gap" || item.readiness_impact === "retake_recommended"),
  );
  if (
    materialGap &&
    (verdict.decision === "submit" ||
      verdict.decision === "submit_if_deadline_is_close" ||
      verdict.decision === "review_carefully")
  ) {
    return {
      decision: "retake_recommended",
      label: DECISION_LABELS.retake_recommended,
      reason: `A mandatory brief requirement needs attention before this is a stronger submission: ${materialGap.public_summary}.`,
      blocked: verdict.blocked,
    };
  }

  const notAssessableMandatory = requirements.find(
    (item) => isMandatoryBriefRequirement(item) && item.achievement_status === "not_assessable",
  );
  if (
    notAssessableMandatory &&
    (verdict.decision === "submit" || verdict.decision === "submit_if_deadline_is_close")
  ) {
    return {
      decision: "review_carefully",
      label: DECISION_LABELS.review_carefully,
      reason: `A mandatory brief item could not be assessed reliably: ${notAssessableMandatory.public_summary}.`,
      blocked: verdict.blocked,
    };
  }

  return verdict;
}

function appendUnique(items: string[], additions: string[], max: number): string[] {
  return dedupe([...items, ...additions], max);
}

function normaliseMandatoryStatus(
  raw: unknown,
): BriefAchievementPublic["mandatory_status"] | undefined {
  const status =
    typeof raw === "string"
      ? raw
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      : "";
  if (
    status === "clear" ||
    status === "some_gaps" ||
    status === "blocked" ||
    status === "not_assessable" ||
    status === "not_applicable"
  ) {
    return status;
  }
  return undefined;
}

function briefRequirementLimit(item: BriefRequirementPublic): string {
  const summary = sentenceFragment(item.public_summary);
  return item.assessability_limits[0]
    ? `${summary}: ${item.assessability_limits[0]}`
    : `This requirement could not be assessed reliably from the available tape: ${summary}.`;
}

function briefActionPlanSteps(requirements: BriefRequirementPublic[]): string[] {
  return requirements
    .filter(
      (item) =>
        isMandatoryBriefRequirement(item) &&
        isAssessableBriefGap(item) &&
        (item.readiness_impact === "submission_blocker" ||
          item.readiness_impact === "material_gap" ||
          item.readiness_impact === "retake_recommended"),
    )
    .map(briefRequirementAction)
    .slice(0, 4);
}

function mergeBriefStepsIntoPlan(plan: unknown, briefSteps: string[]): unknown {
  if (briefSteps.length === 0) return plan;
  const existing = asObj(plan);
  const currentSteps = existing ? publicTextArray(existing.steps, 15) : [];
  const groups = existing ? safePlanGroups(existing.groups) : [];
  return {
    steps: appendUnique(briefSteps, currentSteps, 15),
    ...(groups.length > 0 ? { groups } : {}),
  };
}

function mandatoryStatus(
  requirements: BriefRequirementPublic[],
): BriefAchievementPublic["mandatory_status"] {
  const mandatory = requirements.filter(isMandatoryBriefRequirement);
  if (mandatory.length === 0) return "not_applicable";
  if (
    mandatory.some(
      (item) => isAssessableBriefGap(item) && item.readiness_impact === "submission_blocker",
    )
  )
    return "blocked";
  if (mandatory.some((item) => item.achievement_status === "not_assessable"))
    return "not_assessable";
  if (
    mandatory.some(
      (item) =>
        isAssessableBriefGap(item) &&
        (item.readiness_impact === "material_gap" ||
          item.readiness_impact === "retake_recommended" ||
          item.readiness_impact === "minor_gap"),
    )
  )
    return "some_gaps";
  return "clear";
}

function deriveBriefAchievement(
  r: Record<string, unknown>,
  mode: "brief" | "baseline",
  requirements: BriefRequirementPublic[],
): BriefAchievementPublic {
  const raw = asObj(r.brief_achievement);
  const rawStatus = asStr(raw?.overall_status) ?? asStr(raw?.status);
  const allowedStatus = new Set([
    "achieved",
    "mostly_achieved",
    "partly_achieved",
    "partially_achieved",
    "not_achieved",
    "not_assessable",
    "not_applicable",
  ]);
  if (raw && rawStatus && allowedStatus.has(rawStatus)) {
    const readinessImpact = asStr(raw.readiness_impact);
    const overallStatus = normaliseAchievementStatus(rawStatus);
    const notAssessableSummary =
      publicText(raw.not_assessable_summary, 260) ??
      requirements
        .filter((item) => item.achievement_status === "not_assessable")
        .map(briefRequirementLimit)[0];
    return {
      overall_status: overallStatus,
      summary:
        publicText(raw.summary, 420) ??
        "Brief achievement was supplied without further public-safe detail.",
      mandatory_requirements_status:
        publicText(raw.mandatory_requirements_status, 220) ??
        "No mandatory requirement summary was supplied.",
      readiness_impact: normaliseReadinessImpact(readinessImpact) ?? "not_assessable",
      mandatory_status:
        normaliseMandatoryStatus(raw.mandatory_status) ?? mandatoryStatus(requirements),
      ...(publicText(raw.readiness_effect, 260)
        ? { readiness_effect: publicText(raw.readiness_effect, 260)! }
        : {}),
      ...(notAssessableSummary ? { not_assessable_summary: notAssessableSummary } : {}),
    };
  }
  if (mode !== "brief") {
    return {
      overall_status: "not_applicable",
      summary: "No supplied brief was available to assess.",
      mandatory_requirements_status: "No mandatory brief requirements supplied.",
      readiness_impact: "supports_submission",
      mandatory_status: "not_applicable",
      readiness_effect:
        "The recommendation is based on general submission standards and observable tape evidence only.",
    };
  }
  if (requirements.length === 0) {
    return {
      overall_status: "not_assessable",
      summary: "No supplied brief requirement was available for this check.",
      mandatory_requirements_status:
        "Mandatory requirements could not be confirmed from the available public-safe data.",
      readiness_impact: "not_assessable",
      mandatory_status: "not_assessable",
      readiness_effect:
        "Use the report as general tape guidance until the brief requirements are available.",
    };
  }
  const statuses = requirements.map((item) => item.achievement_status);
  const overall_status: BriefAchievementStatus = statuses.every(
    (status) => status === "achieved" || status === "not_applicable",
  )
    ? "achieved"
    : statuses.some((status) => status === "not_assessable")
      ? "not_assessable"
      : statuses.some((status) => status === "not_achieved")
        ? "not_achieved"
        : statuses.some((status) => status === "partly_achieved")
          ? "partly_achieved"
          : "mostly_achieved";
  const blocker = requirements.find((item) => item.readiness_impact === "submission_blocker");
  const material = requirements.find((item) => item.readiness_impact === "material_gap");
  const mandatory = mandatoryStatus(requirements);
  const notAssessableSummary = requirements
    .filter((item) => item.achievement_status === "not_assessable")
    .map(briefRequirementLimit)[0];
  return {
    overall_status,
    summary: `The supplied brief is ${overall_status.replace(/_/g, " ")} based on the itemised requirements TapeCoach could assess.`,
    mandatory_requirements_status:
      mandatory === "blocked"
        ? "At least one assessable mandatory requirement is not achieved."
        : mandatory === "some_gaps"
          ? "At least one mandatory requirement has a gap to review."
          : mandatory === "not_assessable"
            ? "At least one mandatory requirement could not be assessed reliably."
            : mandatory === "not_applicable"
              ? "No mandatory brief requirements supplied."
              : blocker || material
                ? "At least one material requirement needs review."
                : "No mandatory blocker is present in the public-safe checklist.",
    readiness_impact:
      blocker?.readiness_impact ??
      material?.readiness_impact ??
      (overall_status === "not_assessable" ? "not_assessable" : "supports_submission"),
    mandatory_status: mandatory,
    readiness_effect:
      blocker || material
        ? "Brief gaps are included in the readiness recommendation and next-take priorities."
        : "No mandatory blocker is present in the public-safe checklist.",
    ...(notAssessableSummary ? { not_assessable_summary: notAssessableSummary } : {}),
  };
}

/**
 * Pure v2 report builder. Does not mutate any input.
 */
export function buildV2Report(args: BuildV2ReportArgs): V2Report {
  const r = (args.legacyReport ?? {}) as Record<string, unknown>;

  const mode = args.mode;
  const briefRequirements = normaliseBriefRequirements(r.brief_requirements);
  const priorityFixes = dedupePriorityFixes([
    ...briefPriorityFixes(briefRequirements),
    ...normalisePriorityFixes(r),
  ]);
  const fixFirst = priorityFixes[0]?.headline ?? null;
  const reliability = normaliseReliability(r);
  const submissionVerdict = applyBriefVerdictInfluence(
    normaliseSubmissionVerdict(r, reliability),
    briefRequirements,
  );
  const blockReasons = publicTextArray(r.block_reasons, 8);
  const explicitMustFix = publicTextArray(r.must_fix_before_submitting, 8);
  const explicitShouldImprove = publicTextArray(r.should_improve_if_retaking, 10);
  const explicitOptionalPolish = publicTextArray(r.optional_polish, 6);
  const briefMustFixes = briefRequirements
    .filter(
      (item) =>
        isMandatoryBriefRequirement(item) &&
        isAssessableBriefGap(item) &&
        (item.readiness_impact === "submission_blocker" ||
          item.readiness_impact === "material_gap"),
    )
    .map(briefRequirementAction);
  const briefRetakeImprovements = briefRequirements
    .filter(
      (item) =>
        isAssessableBriefGap(item) &&
        !briefMustFixes.includes(briefRequirementAction(item)) &&
        item.obligation !== "optional" &&
        item.category !== "optional" &&
        (item.readiness_impact === "retake_recommended" ||
          item.readiness_impact === "minor_gap" ||
          item.obligation === "preferred" ||
          item.category === "preferred"),
    )
    .map(briefRequirementAction);
  const briefOptionalPolish = briefRequirements
    .filter(
      (item) =>
        isAssessableBriefGap(item) &&
        (item.obligation === "optional" || item.category === "optional") &&
        item.readiness_impact !== "submission_blocker" &&
        item.readiness_impact !== "material_gap",
    )
    .map(briefRequirementAction);
  const improvements = publicTextArray(r.improvements, 15);
  const strengths = publicTextArray(r.strengths, 12);
  const mustFix =
    explicitMustFix.length > 0
      ? appendUnique(explicitMustFix, briefMustFixes, 8)
      : dedupe(
          [
            ...briefMustFixes,
            ...blockReasons,
            ...priorityFixes.filter(isMustFix).map((fix) => fix.headline),
          ],
          8,
        );
  const shouldImprove =
    explicitShouldImprove.length > 0
      ? appendUnique(explicitShouldImprove, briefRetakeImprovements, 10)
      : dedupe(
          [
            ...briefRetakeImprovements,
            ...priorityFixes.filter((fix) => !isMustFix(fix)).map((fix) => fix.headline),
            ...improvements,
          ].filter((item) => !mustFix.some((must) => must.toLowerCase() === item.toLowerCase())),
          10,
        );
  const optionalPolish = appendUnique(explicitOptionalPolish, briefOptionalPolish, 6);
  const preserve = publicTextArray(r.preserve, 12);
  const preserveItems = preserve.length > 0 ? preserve : strengths;
  const explicitNotAssessable = publicTextArray(r.not_assessable, 8);
  const requirementLimits = briefRequirements
    .filter((item) => item.achievement_status === "not_assessable")
    .map(briefRequirementLimit);
  const notAssessable = dedupe(
    [
      ...explicitNotAssessable,
      ...requirementLimits,
      ...(reliability.level === "low" ? [reliability.summary] : []),
    ],
    8,
  );
  const whyThisVerdictBase = normaliseWhyThisVerdict(
    r,
    submissionVerdict,
    mustFix,
    shouldImprove,
    notAssessable,
  );
  const briefVerdictReason = submissionVerdict.reason.includes("brief requirement")
    ? submissionVerdict.reason
    : null;
  const whyThisVerdict: VerdictRationale = {
    ...whyThisVerdictBase,
    main_reasons: appendUnique(
      whyThisVerdictBase.main_reasons,
      briefVerdictReason ? [briefVerdictReason] : [],
      5,
    ),
  };
  const doNotOverfix = (() => {
    const explicit = publicTextArray(r.do_not_overfix, 4);
    if (explicit.length > 0) return explicit;
    if (preserveItems.length > 0) {
      return [
        `Preserve this: ${preserveItems[0]} Do not flatten it while you address the priority fixes.`,
      ];
    }
    return [
      "Do not keep retaking just to chase minor polish; only re-record for a clear must-fix or useful retake improvement.",
    ];
  })();
  const nextTakePlan = mergeBriefStepsIntoPlan(
    normalisePlan(r.next_take_plan, r.coaching_drills),
    briefActionPlanSteps(briefRequirements),
  );
  const briefAchievement = deriveBriefAchievement(r, mode, briefRequirements);

  const v2: V2Report = {
    schema_version: "v2-component",
    mode,
    audition_type: args.auditionType ?? asStr(r.audition_type),
    submission_verdict: submissionVerdict,
    why_this_verdict: whyThisVerdict,
    feedback_reliability: reliability,
    brief_requirements: briefRequirements,
    brief_achievement: briefAchievement,
    strengths,
    preserve: preserveItems,
    improvements,
    fix_first: fixFirst,
    priority_fixes: priorityFixes,
    must_fix_before_submitting: mustFix,
    should_improve_if_retaking: shouldImprove,
    optional_polish: optionalPolish,
    do_not_overfix: doNotOverfix,
    next_take_plan: nextTakePlan,
    not_assessable: notAssessable,
    verdict: submissionVerdict.label,
    reliability: reliability.level,
  };

  return v2;
}

// ---------------------------------------------------------------------------
// Public boundary validator
// ---------------------------------------------------------------------------

/**
 * Forbidden internal/private keys at any depth in a v2 report.
 *
 * Note we deliberately do NOT ban normal user-facing keys such as `note`,
 * `timestamped_notes`, `presentation_notes`, `category_notes`,
 * `brief_adherence_breakdown`, `detected_components`. Those are valid public
 * report fields.
 */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  "raw_report",
  "report_data",
  "overall_score",
  "overall_score_final",
  "overall_score_model",
  "overall_readiness",
  "overall_readiness_score",
  "readiness_score",
  "score",
  "scores",
  "category_scores",
  "discipline_scores",
  "attribute_scores",
  "score_breakdown",
  "public_score",
  "public_scores",
  "shadow_scores",
  "shadow_score",
  "shadow_divergence",
  "future_shadow",
  "qa_counters",
  "scrub_counters",
  "components_summary",
  "dimensions_summary",
  "dimension_traces",
  "evidence_dimensions",
  "internal_dimensions",
  "internal_qa",
  "take_qa_traces",
  "future_evidence",
  "future_dimensions",
  "future_components",
  "evidence_anchors",
  "dimension_confidence",
  "future_dimension_validation",
  "qa_trace",
  "raw_evidence",
  "hidden_reasoning",
  "supports",
  "anchor_id",
  "anchor_ids",
  "evidence_id",
  "evidence_ids",
  "evidence_anchor_id",
  "evidence_anchor_ids",
  "truth_id",
  "truth_ids",
  "truth_state_entry_id",
  "truth_state_entry_ids",
  "run_id",
  "analysis_run_id",
  "model_run_id",
  "storage_path",
  "signed_url",
  "signed_urls",
  "raw_prompt",
  "raw_prompts",
  "raw_response",
  "raw_responses",
  "raw_model_response",
  "raw_model_responses",
  "technique_authority",
  "public_technique_authority",
  "comparison",
  "comparison_raw",
  "winner",
  "selected_winner",
  "selected_take_id",
  "recommendation",
  "role_fit",
  "role_fit_notes",
  "role_fit_modifier",
  "role_fit_confidence",
  "castability",
  "bookability",
  "marketability",
  "legacy_scores",
  "dimensions",
]);

function findForbiddenKey(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findForbiddenKey(v);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) return k;
      const hit = findForbiddenKey(v);
      if (hit) return hit;
    }
  }
  return null;
}

export type V2ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateV2PublicBoundary(
  v2: unknown,
  legacyReport?: Record<string, unknown> | null,
): V2ValidationResult {
  const o = asObj(v2);
  if (!o) return { ok: false, reason: "not_object" };
  if (o.schema_version !== "v2-component") return { ok: false, reason: "wrong_schema_version" };

  const forbidden = findForbiddenKey(o);
  if (forbidden) return { ok: false, reason: `forbidden_key:${forbidden}` };

  const text = JSON.stringify(o);
  if (BLOCKED_PUBLIC_TEXT.test(text)) {
    return { ok: false, reason: "blocked_public_claim" };
  }

  return { ok: true };
}
