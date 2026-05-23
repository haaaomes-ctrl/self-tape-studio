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

function appendUniqueText(base: string[], additions: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...base, ...additions]) {
    const text = item.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

const RED_LINE_PERFORMER_TEXT =
  /\b(?:system\s+secret|environment\s+value|env\s+var|signed\s+url|private\s+storage\s+url|raw\s+prompt|raw\s+model\s+response|raw\s+response|internal\s+qa|evidence\s+id|truth\s+id|run\s+id|analysis\s+run\s+id|protected\s+characteristic|medical\s+diagnosis|vocal\s+health\s+diagnosis|guaranteed\s+(?:casting|booking|recall|job|employment)|guarantees?|castability|bookability|marketability|role[-\s]?fit|employability|overall\s+score|category\s+score|score\s+of\s+\d+|Meisner|Stanislavski|Uta\s+Hagen|Chekhov|Laban|Viewpoints|Suzuki)\b/i;

const TOKEN_OR_PRIVATE_URL_TEXT =
  /(?:https?:\/\/(?:[^/\s?#]+)?(?:supabase|storage|mux|cloudflare|r2|s3|amazonaws)[^\s]*|[?&](?:token|signature|expires|X-Amz|Policy|Key-Pair-Id)=|(?:secret|api[_-]?key|access[_-]?token)\s*[:=])/i;

const DEPRECATED_GENERIC_FALLBACK_TEXT =
  /\b(?:No single public-safe priority fix was available|Not ready to send — work the priority fix|Continue refining the take|Re-run the take with sharper choices|Performance captured for review|Preserve the clearest choices already captured)\b/i;

function safePerformerText(raw: unknown, maxLength = 420): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (/^ok[.!?]?$/i.test(text)) return null;
  if (RED_LINE_PERFORMER_TEXT.test(text)) return null;
  if (TOKEN_OR_PRIVATE_URL_TEXT.test(text)) return null;
  if (DEPRECATED_GENERIC_FALLBACK_TEXT.test(text)) return null;
  return text.slice(0, maxLength).trim();
}

function safePerformerArray(value: unknown, max = 12): string[] {
  const items = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  return items
    .map((item) => {
      if (typeof item === "string") return safePerformerText(item);
      const obj = isRecord(item) ? item : null;
      return (
        safePerformerText(obj?.headline) ??
        safePerformerText(obj?.action) ??
        safePerformerText(obj?.text) ??
        safePerformerText(obj?.title) ??
        safePerformerText(obj?.point) ??
        safePerformerText(obj?.note) ??
        safePerformerText(obj?.summary)
      );
    })
    .filter((item): item is string => item !== null)
    .slice(0, max);
}

type SafePriorityFix = {
  headline: string;
  rationale?: string;
  action?: string;
  kind?: string;
  category?: string;
};

function safePriorityFixes(value: unknown): SafePriorityFix[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const headline = safePerformerText(item, 220);
        return headline ? { headline } : null;
      }
      if (!isRecord(item)) return null;
      const headline =
        safePerformerText(item.headline, 220) ??
        safePerformerText(item.action, 220) ??
        safePerformerText(item.title, 220);
      if (!headline) return null;
      const rationale =
        safePerformerText(item.rationale, 320) ??
        safePerformerText(item.why_it_matters, 320) ??
        safePerformerText(item.reason, 320);
      const action =
        safePerformerText(item.action, 260) ??
        safePerformerText(item.next_take_action, 260) ??
        safePerformerText(item.how_to_fix, 260);
      return {
        headline,
        ...(rationale ? { rationale } : {}),
        ...(action && action.toLowerCase() !== headline.toLowerCase() ? { action } : {}),
        ...(safePerformerText(item.kind, 80) ? { kind: safePerformerText(item.kind, 80)! } : {}),
        ...(safePerformerText(item.category, 80)
          ? { category: safePerformerText(item.category, 80)! }
          : {}),
      };
    })
    .filter((item): item is SafePriorityFix => item !== null)
    .slice(0, 8);
}

function hasActionableBriefGap(source: Record<string, unknown>): boolean {
  return Array.isArray(source.brief_requirements)
    ? source.brief_requirements.some((item) => {
        if (!isRecord(item)) return false;
        return (
          item.achievement_status === "not_achieved" ||
          item.achievement_status === "partly_achieved" ||
          item.readiness_impact === "submission_blocker" ||
          item.readiness_impact === "material_gap" ||
          item.readiness_impact === "retake_recommended"
        );
      })
    : false;
}

function mapLegacyUserFacingContentIntoR10Source(
  fallback: Record<string, unknown>,
  candidate: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...fallback };
  const actionableBriefGap = hasActionableBriefGap(result);
  const candidateStrengths = appendUniqueText(
    safePerformerArray(candidate.strengths, 12),
    safePerformerArray(candidate.category_notes, 12),
    12,
  );
  const candidatePreserve = appendUniqueText(
    safePerformerArray(candidate.preserve, 12),
    candidateStrengths,
    12,
  );
  const candidateImprovements = appendUniqueText(
    safePerformerArray(candidate.should_improve_if_retaking, 12),
    safePerformerArray(candidate.improvements, 12),
    12,
  );
  const candidateOptionalPolish = appendUniqueText(
    safePerformerArray(candidate.optional_polish, 8),
    safePerformerArray(candidate.presentation_notes, 8),
    8,
  );
  const candidatePriorityFixes = safePriorityFixes(candidate.priority_fixes);
  const fallbackStrengths = safePerformerArray(result.strengths, 12);
  result.strengths = appendUniqueText(fallbackStrengths, candidateStrengths, 12);
  result.preserve = appendUniqueText(
    safePerformerArray(result.preserve, 12),
    candidatePreserve,
    12,
  );
  if (actionableBriefGap) {
    result.priority_fixes = [
      ...(Array.isArray(result.priority_fixes) ? result.priority_fixes : []),
      ...candidatePriorityFixes,
    ].slice(0, 8);
    result.should_improve_if_retaking = appendUniqueText(
      safePerformerArray(result.should_improve_if_retaking, 12),
      candidateImprovements,
      12,
    );
  } else {
    result.fix_first = null;
    result.priority_fixes = [];
    result.should_improve_if_retaking = appendUniqueText(
      safePerformerArray(result.should_improve_if_retaking, 12),
      [],
      12,
    );
    result.optional_polish = appendUniqueText(
      safePerformerArray(result.optional_polish, 8),
      [
        ...candidateOptionalPolish,
        ...candidateImprovements,
        ...candidatePriorityFixes.map((fix) => fix.headline),
      ],
      8,
    );
    if (!isRecord(result.submission_verdict)) {
      result.submission_verdict = {
        decision: "submit_if_deadline_is_close",
        label: "Submit if deadline is close",
        reason:
          "The supplied brief appears complete from the available evidence, with no must-fix blocker identified.",
        blocked: false,
      };
    }
  }
  const candidateDoNotOverfix = safePerformerArray(candidate.do_not_overfix, 4);
  result.do_not_overfix =
    candidateDoNotOverfix.length > 0 ? candidateDoNotOverfix : result.do_not_overfix;
  const why = isRecord(result.why_this_verdict) ? { ...result.why_this_verdict } : {};
  const candidateWhy =
    safePerformerText(candidate.why_this_verdict) ??
    safePerformerText(
      isRecord(candidate.why_this_verdict) ? candidate.why_this_verdict.summary : null,
    );
  if (candidateWhy && !actionableBriefGap) {
    why.summary = candidateWhy;
  }
  result.why_this_verdict = why;
  return result;
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
    const fallback = renderFallbackReport(args.evidence, args.mode, {
      briefText: args.briefText ?? null,
      extractedBrief: args.extractedBrief ?? null,
    }) as Record<string, unknown>;
    return {
      source: mapLegacyUserFacingContentIntoR10Source(fallback, candidate),
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
