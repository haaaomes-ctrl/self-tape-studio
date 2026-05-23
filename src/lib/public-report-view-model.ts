export const PUBLIC_REPORT_VIEW_MODEL_SCHEMA = "v2-component" as const;

export const ACCEPTED_PUBLIC_REPORT_SOURCE_KINDS = [
  "public_report_view_model",
  "public_report_view_model_limited",
] as const;

export const REJECTED_PUBLIC_REPORT_SOURCE_KINDS = [
  "sanitised_render_payload_shadow",
  "raw_report_report_data_shadow",
  "legacy_adapter",
  "legacy_report_used_as_v3_spine_proxy",
  "raw_report",
  "first_pass_internal",
] as const;

export type PublicReportSourceKind =
  | (typeof ACCEPTED_PUBLIC_REPORT_SOURCE_KINDS)[number]
  | (typeof REJECTED_PUBLIC_REPORT_SOURCE_KINDS)[number]
  | string;

export interface PublicReportViewModel {
  schema_version: typeof PUBLIC_REPORT_VIEW_MODEL_SCHEMA;
  submission_verdict: unknown;
  why_this_verdict: unknown;
  fix_first: string | null;
  priority_fixes: unknown[];
  must_fix_before_submitting: string[];
  should_improve_if_retaking: string[];
  optional_polish: string[];
  strengths: unknown[];
  preserve: string[];
  do_not_overfix: string[];
  next_take_plan: unknown;
  feedback_reliability: unknown;
  brief_requirements: unknown[];
  brief_achievement: unknown;
  not_assessable: string[];
  mode?: "brief" | "baseline";
  audition_type?: string | null;
}

export const PUBLIC_REPORT_VIEW_MODEL_FIELDS = [
  "schema_version",
  "submission_verdict",
  "why_this_verdict",
  "fix_first",
  "priority_fixes",
  "must_fix_before_submitting",
  "should_improve_if_retaking",
  "optional_polish",
  "strengths",
  "preserve",
  "do_not_overfix",
  "next_take_plan",
  "feedback_reliability",
  "brief_requirements",
  "brief_achievement",
  "not_assessable",
  "mode",
  "audition_type",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function isAcceptedPublicReportSourceKind(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (ACCEPTED_PUBLIC_REPORT_SOURCE_KINDS as readonly string[]).includes(value)
  );
}

export function isRejectedPublicReportSourceKind(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (REJECTED_PUBLIC_REPORT_SOURCE_KINDS as readonly string[]).includes(value)
  );
}

export function isPublicReportViewModel(value: unknown): value is PublicReportViewModel {
  if (!isRecord(value)) return false;
  if (value.schema_version !== PUBLIC_REPORT_VIEW_MODEL_SCHEMA) return false;
  if (!isRecord(value.submission_verdict)) return false;
  if (!isRecord(value.why_this_verdict)) return false;
  if (!isRecord(value.feedback_reliability)) return false;
  if (!Array.isArray(value.priority_fixes)) return false;
  if (!Array.isArray(value.must_fix_before_submitting)) return false;
  if (!Array.isArray(value.should_improve_if_retaking)) return false;
  if (!Array.isArray(value.optional_polish)) return false;
  if (!Array.isArray(value.preserve)) return false;
  if (!Array.isArray(value.do_not_overfix)) return false;
  if (!Array.isArray(value.brief_requirements)) return false;
  if (!isRecord(value.brief_achievement)) return false;
  if (!Array.isArray(value.not_assessable)) return false;
  return value.fix_first === null || typeof value.fix_first === "string";
}

export function projectPublicReportViewModel(value: unknown): PublicReportViewModel | null {
  if (!isPublicReportViewModel(value)) return null;
  const report = value as unknown as Record<string, unknown>;
  return {
    schema_version: PUBLIC_REPORT_VIEW_MODEL_SCHEMA,
    mode: report.mode === "brief" || report.mode === "baseline" ? report.mode : undefined,
    audition_type: typeof report.audition_type === "string" ? report.audition_type : null,
    submission_verdict: report.submission_verdict,
    why_this_verdict: report.why_this_verdict,
    fix_first: typeof report.fix_first === "string" ? report.fix_first : null,
    priority_fixes: Array.isArray(report.priority_fixes) ? report.priority_fixes : [],
    must_fix_before_submitting: textArray(report.must_fix_before_submitting),
    should_improve_if_retaking: textArray(report.should_improve_if_retaking),
    optional_polish: textArray(report.optional_polish),
    strengths: Array.isArray(report.strengths) ? report.strengths : [],
    preserve: textArray(report.preserve),
    do_not_overfix: textArray(report.do_not_overfix),
    next_take_plan: report.next_take_plan,
    feedback_reliability: report.feedback_reliability,
    brief_requirements: Array.isArray(report.brief_requirements) ? report.brief_requirements : [],
    brief_achievement: report.brief_achievement,
    not_assessable: textArray(report.not_assessable),
  };
}

export function createLimitedPublicReportViewModel(
  args: {
    mode?: "brief" | "baseline";
    auditionType?: string | null;
    reason?: string;
  } = {},
): PublicReportViewModel {
  const reason =
    args.reason ??
    "This report could not generate a reliable fix-first item from the available evidence.";
  return {
    schema_version: PUBLIC_REPORT_VIEW_MODEL_SCHEMA,
    mode: args.mode ?? "baseline",
    audition_type: args.auditionType ?? null,
    submission_verdict: {
      decision: "not_assessable",
      label: "Not assessable",
      reason,
      blocked: true,
    },
    why_this_verdict: {
      summary: reason,
      main_reasons: [reason],
      limitations: [
        "The report can only show a limited state because the R10 public report model was unavailable.",
      ],
    },
    fix_first: null,
    priority_fixes: [],
    must_fix_before_submitting: [],
    should_improve_if_retaking: [],
    optional_polish: [],
    strengths: [],
    preserve: [],
    do_not_overfix: [
      "Do not keep retaking just to chase polish while the report is in a limited state.",
    ],
    next_take_plan: {
      steps: ["Review the brief and tape manually before deciding whether to submit or re-record."],
    },
    feedback_reliability: {
      level: "low",
      summary:
        "Review reliability is limited because the full R10 public report model was unavailable.",
    },
    brief_requirements: [],
    brief_achievement: {
      overall_status: "not_assessable",
      summary: "Brief achievement could not be assessed from the available public report model.",
      mandatory_requirements_status:
        "Mandatory requirements could not be confirmed from the available public report model.",
      readiness_impact: "not_assessable",
      mandatory_status: "not_assessable",
      readiness_effect:
        "Use this as a limited report state until the R10 public report model is available.",
    },
    not_assessable: ["The R10 public report model was unavailable, so this report is limited."],
  };
}
