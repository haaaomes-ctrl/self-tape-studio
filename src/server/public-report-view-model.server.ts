// SERVER-ONLY. R10 public report source-of-truth composer.
//
// Legacy report artefacts may remain available for QA, but this module is the
// only path that is allowed to turn report/evidence inputs into the public
// report view model consumed by render payloads, public payloads and the UI.

import {
  createLimitedPublicReportViewModel,
  projectPublicReportViewModel,
  type PublicReportSourceKind,
  type PublicReportViewModel,
} from "@/lib/public-report-view-model";
import type { EvidencePass } from "./evidence-pass.server";
import { renderFallbackReport } from "./report-polish.server";
import { buildV2Report, validateV2PublicBoundary, type V2Report } from "./v2-report-builder.server";
import type { FutureDimensionsResult } from "./dimensions";

export type PublicReportSection =
  | "submission"
  | "brief"
  | "fix_hierarchy"
  | "next_take_plan"
  | "reliability"
  | "preserve";

export interface PublicReportSectionRoute {
  section: PublicReportSection;
  allowed_input_families: string[];
  blocked_input_families: string[];
}

export const PUBLIC_REPORT_SECTION_ROUTES: PublicReportSectionRoute[] = [
  {
    section: "submission",
    allowed_input_families: [
      "r10_public_safe_builder_output",
      "brief_achievement_summary",
      "fix_hierarchy_summary",
      "safe_report_generation_limit",
    ],
    blocked_input_families: [
      "raw_report.block_reasons",
      "raw_report.casting_headline",
      "raw_report.casting_insight",
      "legacy_score_band_language",
      "generic_legacy_verdict_text",
      "unsupported_casting_or_role_fit_claim",
    ],
  },
  {
    section: "brief",
    allowed_input_families: [
      "extracted_brief",
      "resolver_brief_facts",
      "step1_brief_material_evidence",
      "r10_brief_requirement_normaliser",
      "safe_fallback_classification",
    ],
    blocked_input_families: [
      "raw_report.brief_requirements_without_r10_mapping",
      "legacy_detected_components_as_truth",
      "raw_model_prose_without_structured_provenance",
      "invented_requirements",
      "unsupported_mandatory_promotion",
    ],
  },
  {
    section: "fix_hierarchy",
    allowed_input_families: [
      "r10_priority_fix_builder",
      "public_safe_brief_requirement_outcomes",
      "evidence_supported_assessability_blockers",
      "safe_fallback_builder",
    ],
    blocked_input_families: [
      "raw_report.fix_first",
      "raw_report.block_reasons",
      "raw_report.improvements",
      "legacy_action_plan",
      "legacy_next_take_plan",
      "generic_legacy_not_ready_copy",
      "unsupported_audio_blocker_copy",
    ],
  },
  {
    section: "next_take_plan",
    allowed_input_families: [
      "must_fix_before_submitting",
      "should_improve_if_retaking",
      "brief_next_take_action",
      "priority_fix_actions",
      "r10_action_synthesis",
    ],
    blocked_input_families: [
      "raw_report.coaching_drills",
      "raw_report.next_take_plan",
      "raw_report.improvements",
      "generic_continue_refining_copy",
      "generic_sharper_choices_copy",
    ],
  },
  {
    section: "reliability",
    allowed_input_families: [
      "public_safe_assessability_limits",
      "report_generation_limitation_status",
      "evidence_sufficiency_status",
    ],
    blocked_input_families: [
      "internal_ok_reason_code",
      "unsupported_poor_audio",
      "unsupported_muddy_audio",
      "internal_qa_only_labels",
      "take_index_unavailable_as_performance_criticism",
      "component_or_task_declaration_unavailable_as_performance_criticism",
    ],
  },
  {
    section: "preserve",
    allowed_input_families: [
      "r10_strengths_preserve_builder",
      "public_safe_evidence_supported_strengths",
      "anti_overcorrection_rules",
    ],
    blocked_input_families: [
      "generic_unanchored_praise",
      "raw_report_strengths_without_r10_mapping",
    ],
  },
];

export interface BuildPublicReportViewModelArgs {
  candidateReport: Record<string, unknown> | null | undefined;
  evidence: EvidencePass | null | undefined;
  futureDimensions: FutureDimensionsResult | null | undefined;
  auditionType: string | null | undefined;
  mode: "brief" | "baseline";
  briefText?: string | null;
  extractedBrief?: Record<string, unknown> | null;
}

export interface BuildPublicReportViewModelResult {
  model: PublicReportViewModel;
  source_kind: PublicReportSourceKind;
  route_map: PublicReportSectionRoute[];
  fallback_reason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function reportLooksLikeLegacyAdapter(report: Record<string, unknown>): boolean {
  const schema = typeof report.schema_version === "string" ? report.schema_version : "";
  const sourceFamily = typeof report.source_family === "string" ? report.source_family : "";
  const risks = textList(report.defect_risk_ids);
  return (
    schema === "v1-legacy" ||
    /legacy/i.test(sourceFamily) ||
    risks.some((risk) =>
      /legacy_report_used_as_v3_spine_proxy|legacy_numeric_score_snapshot|priority_fixes_missing|action_plan_missing/i.test(
        risk,
      ),
    )
  );
}

function reportHasPublicReportSpine(report: Record<string, unknown>): boolean {
  return (
    Array.isArray(report.priority_fixes) &&
    report.priority_fixes.length > 0 &&
    Array.isArray(report.brief_requirements)
  );
}

function chooseSectionRoutedSource(args: BuildPublicReportViewModelArgs): {
  source: Record<string, unknown>;
  fallback_reason?: string;
} {
  const candidate = isRecord(args.candidateReport) ? args.candidateReport : {};
  const projected = projectPublicReportViewModel(candidate);
  if (projected) return { source: projected as unknown as Record<string, unknown> };

  const shouldUseStep1Fallback =
    Boolean(args.evidence) &&
    (reportLooksLikeLegacyAdapter(candidate) || !reportHasPublicReportSpine(candidate));

  if (shouldUseStep1Fallback && args.evidence) {
    return {
      source: renderFallbackReport(args.evidence, args.mode, {
        briefText: args.briefText ?? null,
        extractedBrief: args.extractedBrief ?? null,
      }) as Record<string, unknown>,
      fallback_reason: "step1_section_router_fallback",
    };
  }

  if (reportLooksLikeLegacyAdapter(candidate)) {
    return { source: {}, fallback_reason: "legacy_report_quarantined" };
  }

  return { source: candidate, fallback_reason: "candidate_report_direct_mapping" };
}

function validateModel(
  model: V2Report,
  source: Record<string, unknown>,
): PublicReportViewModel | null {
  const boundary = validateV2PublicBoundary(model, source);
  if (!boundary.ok) return null;
  return projectPublicReportViewModel(model);
}

export function buildPublicReportViewModel(
  args: BuildPublicReportViewModelArgs,
): BuildPublicReportViewModelResult {
  const routed = chooseSectionRoutedSource(args);
  const built = buildV2Report({
    legacyReport: routed.source,
    futureDimensions: args.futureDimensions,
    auditionType: args.auditionType,
    mode: args.mode,
  });
  const model = validateModel(built, routed.source);
  if (model) {
    return {
      model,
      source_kind: routed.fallback_reason
        ? "public_report_view_model_limited"
        : "public_report_view_model",
      route_map: PUBLIC_REPORT_SECTION_ROUTES,
      ...(routed.fallback_reason ? { fallback_reason: routed.fallback_reason } : {}),
    };
  }

  return {
    model: createLimitedPublicReportViewModel({
      mode: args.mode,
      auditionType: args.auditionType ?? null,
      reason:
        "This report could not generate a reliable fix-first item from the available evidence.",
    }),
    source_kind: "public_report_view_model_limited",
    route_map: PUBLIC_REPORT_SECTION_ROUTES,
    fallback_reason: "public_report_view_model_validation_failed",
  };
}
