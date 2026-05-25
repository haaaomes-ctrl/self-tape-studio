// V2 component-report renderer (Phase 3B).
//
// Read-only consumer of the public-safe `v2-component` schema. Never reads
// private/internal keys — those are stripped at the server boundary.
//
// Visual treatment is intentionally simple in Phase 3B: hidden-production
// QA prioritises correctness, label semantics, and privacy over polish.

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import {
  getCategoryLabel,
  shouldShowVocal,
  type AuditionTypeForLabels,
  type PublicCategoryKey,
} from "@/lib/discipline-labels";
import { isUsableS10PerformerReportViewModel } from "@/lib/audition-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type V2 = any;

const CATEGORY_KEYS: PublicCategoryKey[] = [
  "acting",
  "vocal",
  "audio",
  "technical",
  "brief_adherence",
  "professional_presentation",
];

function safeStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function safeNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function safeArr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function safeObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function labelize(value: unknown): string {
  const raw = safeStr(value) ?? "";
  return raw.replace(/_/g, " ");
}

function itemTitle(item: unknown): string | null {
  if (typeof item === "string") return item;
  const o = safeObj(item);
  if (!o) return null;
  return safeStr(o.title) ?? safeStr(o.headline) ?? safeStr(o.point) ?? safeStr(o.summary);
}

function itemDetail(item: unknown): string | null {
  if (typeof item === "string") return null;
  const o = safeObj(item);
  if (!o) return null;
  return (
    safeStr(o.detail) ??
    safeStr(o.exact_action) ??
    safeStr(o.evidence_summary) ??
    safeStr(o.why_it_matters) ??
    safeStr(o.why_to_preserve) ??
    null
  );
}

function hasRenderableItem(item: unknown): boolean {
  return itemTitle(item) != null || itemDetail(item) != null;
}

function ScoreBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SimpleList({ items, marker = "•" }: { items: unknown[]; marker?: string }) {
  const rows = items
    .map((item) => ({ title: itemTitle(item), detail: itemDetail(item) }))
    .filter((item) => item.title || item.detail);
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((item, index) => (
        <li key={index} className="flex gap-2">
          <span className="text-muted-foreground">{marker}</span>
          <span>
            {item.title && <span className="font-medium">{item.title}</span>}
            {item.title && item.detail ? " — " : ""}
            {item.detail && <span>{item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function displayStrings(value: unknown): string[] {
  return safeArr(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      return itemTitle(item) ?? itemDetail(item) ?? "";
    })
    .filter((item): item is string => item.trim().length > 0);
}

function itemDedupeKey(item: unknown): string | null {
  const title = itemTitle(item);
  const detail = itemDetail(item);
  const key = [title, detail].filter(Boolean).join(" — ").trim().toLowerCase();
  return key || null;
}

function uniqueListItems(items: unknown[], seen: Set<string>): unknown[] {
  return items.filter((item) => {
    const key = itemDedupeKey(item);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderableListItems(items: unknown[]): unknown[] {
  return items.filter(hasRenderableItem);
}

function isRouteCategoryKey(value: unknown): value is PublicCategoryKey {
  return typeof value === "string" && CATEGORY_KEYS.includes(value as PublicCategoryKey);
}

function hasRenderableComponentRow(value: unknown): boolean {
  const row = safeObj(value);
  if (!row) return false;
  return [
    row.observed_status,
    row.completion_status,
    row.evidence_summary,
    row.assessability_notes,
  ].some((candidate) => !!safeStr(candidate));
}

function hasRenderableBriefContext(value: unknown): boolean {
  const context = safeObj(value);
  if (!context) return false;
  return [
    context.project_name,
    context.role_name,
    context.discipline,
    context.audition_type,
    context.material_package_summary,
    context.role_description_summary,
    context.deadline_summary,
    context.upload_summary,
    context.file_naming_summary,
  ].some((candidate) => !!safeStr(candidate));
}

function briefContextRows(value: unknown): Array<[string, string]> {
  const context = safeObj(value);
  if (!context) return [];
  return [
    ["Project", context.project_name],
    ["Role", context.role_name],
    ["Discipline", context.discipline],
    ["Audition type", context.audition_type],
    ["Material", context.material_package_summary],
    ["Role context", context.role_description_summary],
    ["Deadline", context.deadline_summary],
    ["Upload", context.upload_summary],
    ["File naming", context.file_naming_summary],
  ].flatMap(([label, raw]) => {
    const value = safeStr(raw);
    return value ? ([[label as string, value]] as Array<[string, string]>) : [];
  });
}

function hasRenderableBriefRequirement(value: unknown): boolean {
  const row = safeObj(value);
  if (!row) return false;
  return [
    row.summary,
    row.brief_text,
    row.expected_evidence_in_tape,
    row.achievement_test,
    row.submission_impact_if_missing,
  ].some((candidate) => !!safeStr(candidate));
}

function hasRenderableBriefAchievementRow(value: unknown): boolean {
  const row = safeObj(value);
  if (!row) return false;
  return [
    row.requirement_summary,
    row.observed_status,
    row.completion_status,
    row.achievement_status,
    row.evidence_summary,
    row.submission_impact,
    row.recommended_action,
  ].some((candidate) => !!safeStr(candidate));
}

function hasRenderableObservedTapeSequenceRow(value: unknown): boolean {
  const row = safeObj(value);
  if (!row) return false;
  return [
    row.present_status,
    row.completion_status,
    row.evidence_summary,
    row.assessability_notes,
  ].some((candidate) => !!safeStr(candidate));
}

function hasRenderableTimestampedNote(value: unknown): boolean {
  const note = safeObj(value);
  if (!note) return false;
  return [note.title, note.detail, note.action, note.evidence_summary].some(
    (candidate) => !!safeStr(candidate),
  );
}

function sourceLimitation(
  sourceMap: Record<string, unknown> | null,
  section: string,
  fallback: string,
): string | null {
  const entry = safeObj(sourceMap?.[section]);
  return safeStr(entry?.source) === "specific_limitation"
    ? (safeStr(entry?.limitation) ?? fallback)
    : null;
}

const S10_LIMITED_ROUTE_MESSAGE =
  "TapeCoach could not assemble the full S10 report model for this take. No legacy report was used as a substitute.";

const S10_MODULE_KEYS = [
  "brief_achievement_matrix",
  "readiness_score_judgement",
  "s10_fix_hierarchy",
  "s10_next_action_plan",
  "s10_professional_critique",
  "s10_technique_commentary",
  "s10_timestamped_commentary",
] as const;

function hasS10ModuleObject(report: V2): boolean {
  return S10_MODULE_KEYS.some((key) => safeObj(report[key]) !== null);
}

export function V2ReportView({
  report,
  takeNumber,
  auditionType,
}: {
  report: V2;
  takeNumber?: number;
  auditionType?: AuditionTypeForLabels;
}) {
  if (!report || typeof report !== "object") return null;

  const rawS10View = report.s10_view_model;
  const usableS10View = isUsableS10PerformerReportViewModel(rawS10View);
  const isS10 =
    safeStr(report.source_mode) === "s10_ai_report_model" ||
    rawS10View != null ||
    hasS10ModuleObject(report);
  if (isS10 && !usableS10View) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            {typeof takeNumber === "number" && (
              <Badge variant="outline" className="font-medium">
                Take {takeNumber}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              S10 AI report model
            </Badge>
          </div>
          <p className="mt-3 font-display text-xl font-semibold leading-snug">
            S10 report assembly limitation
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{S10_LIMITED_ROUTE_MESSAGE}</p>
        </div>
      </div>
    );
  }
  const s10 = usableS10View ? safeObj(rawS10View) : null;
  const s10SectionSourceMap = safeObj(s10?.section_source_map);
  const s10Recommendation = safeObj(s10?.recommendation);
  const s10ScoreSummary = safeObj(s10?.score_summary);
  const s10BriefContext = safeObj(s10?.brief_context);
  const s10Matrix = safeObj(s10?.brief_achievement_matrix);
  const s10FixHierarchy = safeObj(s10?.fix_hierarchy);
  const s10NextActionPlan = safeObj(s10?.next_action_plan);
  const s10ProfessionalCritique = safeObj(s10?.professional_critique);
  const s10FixHierarchyLimitation = sourceLimitation(
    s10SectionSourceMap,
    "fix_hierarchy",
    "Fix hierarchy was unavailable for this S10 report.",
  );
  const s10NextActionLimitation = sourceLimitation(
    s10SectionSourceMap,
    "next_action_plan",
    "Next action plan was unavailable for this S10 report.",
  );
  const s10CategoryScoresLimitation = sourceLimitation(
    s10SectionSourceMap,
    "category_scores",
    "S10 category score semantics are not available for this report.",
  );
  const s10ComponentBreakdownLimitation = sourceLimitation(
    s10SectionSourceMap,
    "component_breakdown",
    "Component verification was unavailable for this S10 report.",
  );
  const s10StrengthsLimitation = sourceLimitation(
    s10SectionSourceMap,
    "strengths_and_preserve",
    "Strengths and preserve guidance are not available for this report.",
  );
  const s10StrengthsAndPreserve = safeObj(s10?.strengths_and_preserve);
  const s10Technique = safeObj(s10?.technique_commentary);
  const s10Timestamped = safeObj(s10?.timestamped_commentary);
  const s10SameVideo = safeObj(s10?.same_video_status);
  const s10Comparison = safeObj(s10?.comparison_truth);
  const s10ComparisonDisplayMode = safeStr(s10?.comparison_display_mode);
  const s10ComparisonSummary =
    safeStr(s10?.comparison_summary) ??
    safeStr(s10Comparison?.performer_facing_summary) ??
    safeStr(s10SameVideo?.performer_facing_summary);
  const s10ComparisonWarning =
    safeStr(s10SameVideo?.comparison_warning) ?? safeStr(s10Comparison?.comparison_warning);
  const s10ComparisonLimitations = safeArr<string>(s10?.comparison_limitations).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  const s10Limitations = safeArr<string>(s10?.limitations).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  const t: AuditionTypeForLabels = auditionType ?? safeStr(report.audition_type);
  const overall = isS10
    ? safeNum(s10ScoreSummary?.overall_submission_readiness_score)
    : safeNum(report.overall_readiness);
  const headline = isS10 ? safeStr(s10Recommendation?.headline) : safeStr(report.headline);
  const insight = isS10
    ? (safeStr(s10Recommendation?.score_explanation) ?? safeStr(s10Matrix?.summary))
    : safeStr(report.insight);
  const verdict = isS10
    ? safeStr(s10Recommendation?.decision)?.replace(/_/g, " ")
    : safeStr(report.verdict);
  const reliability = isS10 ? null : safeStr(report.reliability);
  const reliabilityReason = isS10 ? null : safeStr(report.reliability_reason);
  const legacyFixFirst = safeStr(report.fix_first);
  const s10Decision = safeStr(s10Recommendation?.decision);
  const s10HasBlockingDecision =
    !!s10Decision && !["submit", "submit_if_deadline_is_close"].includes(s10Decision);
  const s10SubmissionRiskSource = safeObj(s10SectionSourceMap?.submission_risk);
  const s10HasRiskSource = safeStr(s10SubmissionRiskSource?.source) === "s10_authoritative_module";
  const s10Rationale = renderableListItems(safeArr(s10Recommendation?.rationale));
  const blockers = (
    isS10 && (s10HasBlockingDecision || s10HasRiskSource)
      ? s10Rationale
      : !isS10
        ? safeArr<string>(report.block_reasons)
        : []
  ).filter(hasRenderableItem);
  const recommendationRationale =
    isS10 && !s10HasBlockingDecision && !s10HasRiskSource ? s10Rationale : [];
  const strengths = safeArr(report.strengths);
  const legacyImprovements = safeArr(report.improvements);
  const tsNotes = safeArr<{ timestamp?: string; note?: string }>(report.timestamped_notes);
  const s10SelfTapePresentation = safeObj(s10Technique?.self_tape_presentation);
  const presentation = isS10
    ? [
        ...displayStrings(s10SelfTapePresentation?.what_is_working),
        ...displayStrings(s10ProfessionalCritique?.professional_presentation_notes),
      ].slice(0, 6)
    : safeArr<string>(report.presentation_notes).filter((s): s is string => typeof s === "string");
  const riskFlags = isS10 ? [] : safeArr<{ severity?: string; flag?: string }>(report.risk_flags);
  const s10CategoryRows = safeArr<Record<string, unknown>>(s10ScoreSummary?.category_scores).filter(
    (row) => isRouteCategoryKey(safeStr(row.category_id)),
  );
  const s10ComponentScores = safeArr<Record<string, unknown>>(s10ScoreSummary?.component_scores);
  const s10ComponentBreakdown = safeArr<Record<string, unknown>>(s10?.component_breakdown).filter(
    hasRenderableComponentRow,
  );
  const components = isS10
    ? s10ComponentBreakdown.map((c, index) => {
        const requirementId = safeStr(c.requirement_id);
        const scoreRow = s10ComponentScores.find((row) =>
          safeArr<string>(row.linked_requirement_ids).includes(requirementId ?? ""),
        );
        const observedStatus = safeStr(c.observed_status);
        const completionStatus = safeStr(c.completion_status);
        const evidenceSummary = safeStr(c.evidence_summary);
        const assessabilityNotes = safeStr(c.assessability_notes);
        const statusSummary = [observedStatus, completionStatus]
          .map(labelize)
          .filter(Boolean)
          .join(" / ");
        const label =
          safeStr(c.requirement_summary) ??
          observedStatus ??
          evidenceSummary ??
          `Component ${index + 1}`;
        return {
          type: label,
          component_type: safeStr(c.requirement_summary) ?? observedStatus,
          label,
          weight: null,
          score: safeNum(scoreRow?.score),
          note: evidenceSummary,
          subtype: null,
          style: null,
          form: null,
          start: safeArr<string>(c.timestamp_refs)[0] ?? null,
          end: null,
          what_it_shows: c.observed_from_media
            ? "Observed from submitted media."
            : "Not verified from submitted media.",
          what_is_assessable: statusSummary || assessabilityNotes,
          key_evidence: evidenceSummary ?? assessabilityNotes,
          score_driver: safeStr(scoreRow?.score_basis),
          close_gap: safeStr(scoreRow?.cannot_score_reason),
          style_or_task_confidence: safeStr(c.confidence),
        };
      })
    : safeArr<{
        type?: string;
        component_type?: string | null;
        label?: string | null;
        weight?: number | null;
        score?: number | null;
        note?: string | null;
        subtype?: string | null;
        style?: string | null;
        form?: string | null;
        start?: string | null;
        end?: string | null;
        what_it_shows?: string | null;
        what_is_assessable?: string | null;
        key_evidence?: string | null;
        score_driver?: string | null;
        close_gap?: string | null;
        style_or_task_confidence?: string | null;
      }>(report.components);
  const scores = (() => {
    if (!isS10) {
      return report.scores && typeof report.scores === "object"
        ? (report.scores as Record<string, number | null>)
        : null;
    }
    const rows = s10CategoryRows.reduce<Record<string, number | null>>((acc, row) => {
      const category = safeStr(row.category_id);
      const score = safeNum(row.score);
      if (category && score != null) acc[category] = score;
      return acc;
    }, {});
    return Object.keys(rows).length > 0 ? rows : null;
  })();
  const categoryNotes = (() => {
    if (!isS10) {
      return report.category_notes && typeof report.category_notes === "object"
        ? (report.category_notes as Record<string, string>)
        : null;
    }
    const rows = s10CategoryRows.reduce<Record<string, string>>((acc, row) => {
      const category = safeStr(row.category_id);
      const note =
        safeStr(row.score_basis) ?? safeStr(row.why_not_full_score) ?? safeStr(row.close_gap);
      if (category && note) acc[category] = note;
      return acc;
    }, {});
    return Object.keys(rows).length > 0 ? rows : null;
  })();
  const legacyNextPlan = safeArr<string>(
    (report.next_take_plan && (report.next_take_plan as { steps?: unknown }).steps) ?? [],
  ).filter((s): s is string => typeof s === "string");
  const roleFit =
    !isS10 && report.role_fit && typeof report.role_fit === "object"
      ? (report.role_fit as {
          notes?: string | null;
          modifier?: number | null;
          confidence?: string | null;
        })
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-6 sm:flex-nowrap">
          <div className="flex shrink-0 flex-col items-center rounded-xl border border-border bg-card/70 px-6 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Overall readiness
            </p>
            <p className="mt-1 font-display text-7xl font-bold leading-none text-primary tabular-nums">
              {overall ?? "—"}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {typeof takeNumber === "number" && (
                <Badge variant="outline" className="font-medium">
                  Take {takeNumber}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                Component report
              </Badge>
              {isS10 && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  S10 AI report model
                </Badge>
              )}
            </div>
            {headline && (
              <p className="mt-2 font-display text-xl font-semibold leading-snug">{headline}</p>
            )}
            {insight && <p className="mt-2 text-sm text-muted-foreground">{insight}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {verdict && (
                <span>
                  <span className="font-medium text-foreground">Verdict:</span> {verdict}
                </span>
              )}
              {reliability && (
                <span>
                  <span className="font-medium text-foreground">Reliability:</span> {reliability}
                  {reliabilityReason ? ` (${reliabilityReason})` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {blockers.length > 0 && (
          <div className="mt-5 rounded-md border border-warning/40 bg-warning/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-warning">
              Why this isn't ready
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {blockers.map((b, i) => {
                const title = itemTitle(b);
                const detail = itemDetail(b);
                return (
                  <li key={i} className="flex gap-2">
                    <span className="text-warning">•</span>
                    <span>
                      {title && <span className="font-medium">{title}</span>}
                      {title && detail ? " — " : ""}
                      {detail && <span>{detail}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {recommendationRationale.length > 0 && (
          <div className="mt-5 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why this recommendation
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {recommendationRationale.map((item, i) => {
                const title = itemTitle(item);
                const detail = itemDetail(item);
                return (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>
                      {title && <span className="font-medium">{title}</span>}
                      {title && detail ? " — " : ""}
                      {detail && <span>{detail}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {!isS10 && report.at_risk && blockers.length === 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
            <p>
              This tape is flagged <strong>at risk</strong> — a brief requirement appears to be
              missing.
            </p>
          </div>
        )}
      </div>

      {isS10 &&
        s10ComparisonDisplayMode &&
        !["hidden", "single_take"].includes(s10ComparisonDisplayMode) &&
        (s10ComparisonSummary || s10ComparisonWarning || s10ComparisonLimitations.length > 0) && (
          <Section
            title="Same-video comparison"
            hint="Media identity is kept separate from performance and report comparison."
          >
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {safeStr(s10SameVideo?.status) && (
                  <Badge variant="outline" className="capitalize">
                    {labelize(s10SameVideo?.status)}
                  </Badge>
                )}
                {safeStr(s10Comparison?.recommendation_policy) && (
                  <Badge variant="secondary" className="capitalize">
                    {labelize(s10Comparison?.recommendation_policy)}
                  </Badge>
                )}
              </div>
              {s10ComparisonSummary && <p>{s10ComparisonSummary}</p>}
              {s10ComparisonWarning && <p className="font-medium">{s10ComparisonWarning}</p>}
              {s10ComparisonLimitations.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {s10ComparisonLimitations.map((limitation, index) => (
                    <li key={index}>{limitation}</li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        )}

      {isS10 && (
        <>
          {(() => {
            const contextRows = briefContextRows(s10BriefContext);
            const reqs = safeArr<Record<string, unknown>>(s10?.brief_requirements).filter(
              hasRenderableBriefRequirement,
            );
            const rows = safeArr<Record<string, unknown>>(s10Matrix?.requirement_results).filter(
              hasRenderableBriefAchievementRow,
            );
            const matrixStatusRows = [
              ["Overall", s10Matrix?.overall_status],
              ["Mandatory", s10Matrix?.mandatory_status],
              ["Readiness impact", s10Matrix?.readiness_impact],
            ].flatMap(([label, raw]) => {
              const value = safeStr(raw);
              return value ? ([[label as string, value]] as Array<[string, string]>) : [];
            });
            const hasMatrixSummary = !!safeStr(s10Matrix?.summary);
            if (
              contextRows.length === 0 &&
              !hasMatrixSummary &&
              matrixStatusRows.length === 0 &&
              reqs.length === 0 &&
              rows.length === 0
            )
              return null;
            return (
              <Section
                title="Brief achievement"
                hint="What the brief asked for, checked against the submitted tape."
              >
                {contextRows.length > 0 && (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {contextRows.map(([label, value]) => (
                      <p key={label}>
                        <span className="font-medium">{label}:</span>{" "}
                        <span className="text-muted-foreground">{value}</span>
                      </p>
                    ))}
                  </div>
                )}
                {safeStr(s10Matrix?.summary) && (
                  <p className={cn("text-sm", contextRows.length > 0 && "mt-3")}>
                    {safeStr(s10Matrix?.summary)}
                  </p>
                )}
                {matrixStatusRows.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {matrixStatusRows.map(([label, value]) => (
                      <Badge key={label} variant="outline" className="capitalize">
                        {label}: {labelize(value)}
                      </Badge>
                    ))}
                  </div>
                )}
                {reqs.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      What the brief asked for
                    </p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {reqs.map((r, i) => (
                        <li
                          key={safeStr(r.id) ?? i}
                          className="rounded-md border border-border p-3"
                        >
                          <p className="font-medium">
                            {safeStr(r.summary) ?? safeStr(r.brief_text)}
                          </p>
                          {safeStr(r.brief_text) &&
                            safeStr(r.brief_text) !== safeStr(r.summary) && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {safeStr(r.brief_text)}
                              </p>
                            )}
                          {safeStr(r.expected_evidence_in_tape) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Evidence expected: {safeStr(r.expected_evidence_in_tape)}
                            </p>
                          )}
                          {safeStr(r.achievement_test) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Achievement check: {safeStr(r.achievement_test)}
                            </p>
                          )}
                          {safeStr(r.submission_impact_if_missing) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              If missing: {safeStr(r.submission_impact_if_missing)}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                            {labelize(r.importance)} · {labelize(r.category)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {rows.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Requirement result
                    </p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {rows.map((r, i) => {
                        const statusParts = [
                          safeStr(r.achievement_status) ? labelize(r.achievement_status) : null,
                          safeStr(r.observed_status)
                            ? `observed ${labelize(r.observed_status)}`
                            : null,
                          safeStr(r.completion_status)
                            ? `completion ${labelize(r.completion_status)}`
                            : null,
                        ].filter((part): part is string => Boolean(part));
                        return (
                          <li key={safeStr(r.requirement_id) ?? i}>
                            <span className="font-medium">
                              {safeStr(r.requirement_summary) ?? "Requirement result"}
                            </span>
                            {" — "}
                            <span className="capitalize">
                              {statusParts.length > 0
                                ? statusParts.join(" / ")
                                : "status unavailable"}
                            </span>
                            {safeStr(r.evidence_summary) && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Evidence: {safeStr(r.evidence_summary)}
                              </p>
                            )}
                            {safeStr(r.submission_impact) && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Submission impact: {labelize(r.submission_impact)}
                              </p>
                            )}
                            {safeStr(r.recommended_action) && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {safeStr(r.recommended_action)}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </Section>
            );
          })()}

          {(() => {
            const sequence = safeArr<Record<string, unknown>>(
              safeObj(s10?.observed_tape)?.observed_tape_sequence,
            ).filter(hasRenderableObservedTapeSequenceRow);
            const verifications = safeArr<Record<string, unknown>>(
              safeObj(s10?.observed_tape)?.component_verifications,
            ).filter(hasRenderableComponentRow);
            if (sequence.length === 0 && verifications.length === 0) return null;
            return (
              <Section
                title="Observed tape"
                hint="Requested material and observed material are kept separate."
              >
                {sequence.length > 0 && (
                  <div className="space-y-2 text-sm">
                    {sequence.map((item, i) => (
                      <p key={safeStr(item.id) ?? i}>
                        <span className="font-medium">
                          {safeStr(item.label) ?? safeStr(item.evidence_summary) ?? "Observed item"}
                        </span>
                        {safeStr(item.present_status) && (
                          <>
                            {" — "}
                            <span className="capitalize">{labelize(item.present_status)}</span>
                          </>
                        )}
                        {safeStr(item.completion_status) && (
                          <span className="text-muted-foreground">
                            {" "}
                            / {labelize(item.completion_status)}
                          </span>
                        )}
                        {safeStr(item.evidence_summary) && safeStr(item.label) && (
                          <span className="block text-xs text-muted-foreground">
                            {safeStr(item.evidence_summary)}
                          </span>
                        )}
                        {safeStr(item.assessability_notes) && (
                          <span className="block text-xs text-muted-foreground">
                            {safeStr(item.assessability_notes)}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                )}
                {verifications.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm">
                    {verifications.map((item, i) => (
                      <li key={safeStr(item.requirement_id) ?? i}>
                        <span className="font-medium">
                          {safeStr(item.requirement_summary) ??
                            safeStr(item.evidence_summary) ??
                            "Observed component"}
                        </span>
                        {safeStr(item.observed_status) && (
                          <>
                            {" — "}
                            <span className="capitalize">{labelize(item.observed_status)}</span>
                          </>
                        )}
                        {safeStr(item.completion_status) && (
                          <span className="text-muted-foreground">
                            {" "}
                            / {labelize(item.completion_status)}
                          </span>
                        )}
                        {safeStr(item.evidence_summary) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {safeStr(item.evidence_summary)}
                          </p>
                        )}
                        {safeStr(item.assessability_notes) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {safeStr(item.assessability_notes)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            );
          })()}
        </>
      )}

      {(() => {
        if (s10) {
          if (!s10FixHierarchy) {
            return s10FixHierarchyLimitation ? (
              <Section title="Prioritised fixes">
                <p className="text-sm text-muted-foreground">{s10FixHierarchyLimitation}</p>
              </Section>
            ) : null;
          }
          const rawFixFirst = safeObj(s10FixHierarchy.fix_first);
          const fixFirst = rawFixFirst && itemDedupeKey(rawFixFirst) ? rawFixFirst : null;
          const seenFixItems = new Set<string>();
          if (fixFirst) {
            const key = itemDedupeKey(fixFirst);
            if (key) seenFixItems.add(key);
          }
          const priority = uniqueListItems(safeArr(s10FixHierarchy.priority_fixes), seenFixItems);
          const must = uniqueListItems(
            safeArr(s10FixHierarchy.must_fix_before_submitting),
            seenFixItems,
          );
          const should = uniqueListItems(
            safeArr(s10FixHierarchy.should_improve_if_retaking),
            seenFixItems,
          );
          const optional = uniqueListItems(safeArr(s10FixHierarchy.optional_polish), seenFixItems);
          const preserve = uniqueListItems(safeArr(s10FixHierarchy.preserve), seenFixItems);
          const doNotOverfix = uniqueListItems(
            safeArr(s10FixHierarchy.do_not_overfix),
            seenFixItems,
          );
          if (
            !fixFirst &&
            priority.length === 0 &&
            must.length === 0 &&
            should.length === 0 &&
            optional.length === 0 &&
            preserve.length === 0 &&
            doNotOverfix.length === 0
          ) {
            return s10FixHierarchyLimitation ? (
              <Section title="Prioritised fixes">
                <p className="text-sm text-muted-foreground">{s10FixHierarchyLimitation}</p>
              </Section>
            ) : null;
          }
          return (
            <Section
              title="Prioritised fixes"
              hint="Ordered from verified brief/package blockers through optional polish."
            >
              {fixFirst && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-warning">
                    Fix first
                  </p>
                  <p className="mt-1 font-display text-base font-semibold">
                    {safeStr(fixFirst.title) ?? safeStr(fixFirst.exact_action)}
                  </p>
                  {safeStr(fixFirst.exact_action) && (
                    <p className="mt-1 text-sm">{safeStr(fixFirst.exact_action)}</p>
                  )}
                </div>
              )}
              {priority.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Priority fixes
                  </p>
                  <div className="mt-2">
                    <SimpleList items={priority} marker="→" />
                  </div>
                </div>
              )}
              {must.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Must fix before submitting
                  </p>
                  <div className="mt-2">
                    <SimpleList items={must} marker="→" />
                  </div>
                </div>
              )}
              {should.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Should improve if retaking
                  </p>
                  <div className="mt-2">
                    <SimpleList items={should} marker="→" />
                  </div>
                </div>
              )}
              {optional.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Optional polish
                  </p>
                  <div className="mt-2">
                    <SimpleList items={optional} marker="•" />
                  </div>
                </div>
              )}
              {preserve.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Preserve
                  </p>
                  <div className="mt-2">
                    <SimpleList items={preserve} marker="✓" />
                  </div>
                </div>
              )}
              {doNotOverfix.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Do not over-fix
                  </p>
                  <div className="mt-2">
                    <SimpleList items={doNotOverfix} marker="•" />
                  </div>
                </div>
              )}
            </Section>
          );
        }
        const priorityFixes = safeArr<{ headline?: string; rationale?: string; kind?: string }>(
          report.priority_fixes,
        );
        if (priorityFixes.length > 0) {
          return (
            <Section title="Prioritised fixes">
              <ul className="space-y-3 text-sm">
                {priorityFixes.map((p, i) => (
                  <li key={i}>
                    <p className="font-display text-base font-semibold leading-snug">
                      {safeStr(p?.headline) ?? ""}
                    </p>
                    {safeStr(p?.rationale) && (
                      <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          );
        }
        if (legacyFixFirst) {
          return (
            <Section title="Fix this first">
              <p className="font-display text-lg font-semibold leading-snug">{legacyFixFirst}</p>
            </Section>
          );
        }
        return null;
      })()}

      {(() => {
        if (s10) return null;
        const cr =
          report.category_rationale && typeof report.category_rationale === "object"
            ? (report.category_rationale as Record<
                string,
                {
                  what_works?: string;
                  why_not_full_score?: string;
                  close_gap?: string;
                  standout_delta?: string;
                }
              >)
            : null;
        if (!cr) return null;
        const entries = CATEGORY_KEYS.map((k) => [k, cr[k]] as const).filter(
          ([, v]) => v && (v.why_not_full_score || v.close_gap || v.standout_delta || v.what_works),
        );
        if (entries.length === 0) return null;
        return (
          <Section
            title="Why this score"
            hint="What works, why it isn't 100, and what would close the gap."
          >
            <div className="space-y-4 text-sm">
              {entries.map(([key, v]) => (
                <div key={key}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getCategoryLabel(t, key)}
                  </p>
                  {v?.what_works && (
                    <p className="mt-1">
                      <span className="font-medium">Works:</span> {v.what_works}
                    </p>
                  )}
                  {v?.why_not_full_score && (
                    <p className="mt-1">
                      <span className="font-medium">Why not full score:</span>{" "}
                      {v.why_not_full_score}
                    </p>
                  )}
                  {v?.close_gap && (
                    <p className="mt-1">
                      <span className="font-medium">Close the gap:</span> {v.close_gap}
                    </p>
                  )}
                  {v?.standout_delta && (
                    <p className="mt-1">
                      <span className="font-medium">Standout delta:</span> {v.standout_delta}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* Categories */}
      {(() => {
        if (scores) {
          return (
            <Section
              title="Category scores"
              hint="Discipline-aware labels. Backend score keys are unchanged."
            >
              <div className="space-y-3">
                {CATEGORY_KEYS.map((key) => {
                  const value = scores[key];
                  if (typeof value !== "number") return null;
                  if (key === "vocal" && !shouldShowVocal(t, scores)) return null;
                  return (
                    <div key={key}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium">{getCategoryLabel(t, key)}</span>
                        <span className="text-sm font-semibold tabular-nums">{value}</span>
                      </div>
                      <ScoreBar value={value} />
                      {categoryNotes?.[key] && (
                        <p className="mt-1 text-xs text-muted-foreground">{categoryNotes[key]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        }
        if (s10 && s10CategoryScoresLimitation) {
          return (
            <Section title="Category scores">
              <p className="text-sm text-muted-foreground">{s10CategoryScoresLimitation}</p>
            </Section>
          );
        }
        return null;
      })()}

      {/* Components */}
      {(() => {
        if (components.length > 0) {
          return (
            <Section
              title="Component breakdown"
              hint="Each performance component is assessed separately."
            >
              <div className="space-y-4">
                {components.map((c, i) => {
                  const type = safeStr(c.type) ?? "component";
                  const score = safeNum(c.score);
                  const weight = safeNum(c.weight);
                  const meta = [c.subtype, c.style, c.form]
                    .filter((s): s is string => typeof s === "string" && !!s)
                    .join(" · ");
                  return (
                    <div key={i}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium capitalize">
                          {type.replace(/_/g, " ")}
                          {weight != null && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              weight {Math.round(weight * 100)}%
                            </span>
                          )}
                        </span>
                        {score != null && (
                          <span className="font-display text-lg font-semibold tabular-nums">
                            {score}
                          </span>
                        )}
                      </div>
                      {score != null && <ScoreBar value={score} />}
                      {meta && <p className="mt-1 text-xs text-muted-foreground">{meta}</p>}
                      {c.start && c.end && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {c.start} – {c.end}
                        </p>
                      )}
                      {c.note && <p className="mt-1.5 text-xs text-muted-foreground">{c.note}</p>}
                      {(() => {
                        const detailRows: Array<[string, string]> = [];
                        if (safeStr(c.what_it_shows))
                          detailRows.push(["What it shows", c.what_it_shows!]);
                        if (safeStr(c.what_is_assessable))
                          detailRows.push(["What's assessable", c.what_is_assessable!]);
                        if (safeStr(c.key_evidence))
                          detailRows.push(["Key evidence", c.key_evidence!]);
                        if (safeStr(c.score_driver))
                          detailRows.push(["Score driver", c.score_driver!]);
                        if (safeStr(c.close_gap)) detailRows.push(["Close the gap", c.close_gap!]);
                        if (detailRows.length === 0 && !c.style_or_task_confidence) return null;
                        return (
                          <div className="mt-2 space-y-1.5 text-xs">
                            {detailRows.map(([label, value]) => (
                              <p key={label}>
                                <span className="font-medium text-foreground">{label}:</span>{" "}
                                <span className="text-muted-foreground">{value}</span>
                              </p>
                            ))}
                            {c.style_or_task_confidence && (
                              <p className="text-[11px] text-muted-foreground">
                                style/task confidence: {c.style_or_task_confidence}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        }
        if (s10 && s10ComponentBreakdownLimitation) {
          return (
            <Section title="Component breakdown">
              <p className="text-sm text-muted-foreground">{s10ComponentBreakdownLimitation}</p>
            </Section>
          );
        }
        return null;
      })()}

      {(() => {
        if (!s10StrengthsAndPreserve) {
          return s10StrengthsLimitation ? (
            <Section title="Strengths and preserve">
              <p className="text-sm text-muted-foreground">{s10StrengthsLimitation}</p>
            </Section>
          ) : null;
        }
        const strengthItems = renderableListItems(safeArr(s10StrengthsAndPreserve.strengths));
        const preserveItems = renderableListItems(safeArr(s10StrengthsAndPreserve.preserve));
        const doNotOverfixItems = renderableListItems(
          safeArr(s10StrengthsAndPreserve.do_not_overfix),
        );
        const limitationItems = renderableListItems(safeArr(s10StrengthsAndPreserve.limitations));
        if (
          !safeStr(s10StrengthsAndPreserve.summary) &&
          strengthItems.length === 0 &&
          preserveItems.length === 0 &&
          doNotOverfixItems.length === 0 &&
          limitationItems.length === 0
        ) {
          return s10StrengthsLimitation ? (
            <Section title="Strengths and preserve">
              <p className="text-sm text-muted-foreground">{s10StrengthsLimitation}</p>
            </Section>
          ) : null;
        }
        return (
          <Section title="Strengths and preserve">
            {safeStr(s10StrengthsAndPreserve.summary) && (
              <p className="text-sm">{safeStr(s10StrengthsAndPreserve.summary)}</p>
            )}
            {strengthItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Strengths
                </p>
                <div className="mt-2">
                  <SimpleList items={strengthItems} marker="✓" />
                </div>
              </div>
            )}
            {preserveItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preserve
                </p>
                <div className="mt-2">
                  <SimpleList items={preserveItems} marker="✓" />
                </div>
              </div>
            )}
            {doNotOverfixItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Do not overfix
                </p>
                <div className="mt-2">
                  <SimpleList items={doNotOverfixItems} marker="•" />
                </div>
              </div>
            )}
            {limitationItems.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground">
                <SimpleList items={limitationItems} />
              </div>
            )}
          </Section>
        );
      })()}

      {!isS10 && strengths.length > 0 && (
        <Section title="Strengths">
          <ul className="space-y-2 text-sm">
            {strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-success">✓</span>
                <span>
                  {typeof s === "string" ? s : (safeStr((s as { point?: unknown })?.point) ?? "")}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!isS10 && legacyImprovements.length > 0 && (
        <Section title="Improvements">
          <ul className="space-y-2 text-sm">
            {legacyImprovements.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-warning">→</span>
                <span>
                  {typeof s === "string" ? s : (safeStr((s as { point?: unknown })?.point) ?? "")}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {s10Technique && (
        <Section
          title="Technique commentary"
          hint="Technique notes are shown only where verified tape evidence supports them."
        >
          {safeStr(s10Technique.summary) && (
            <p className="text-sm">{safeStr(s10Technique.summary)}</p>
          )}
          {renderableListItems(safeArr(s10Technique.limitations)).length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              <SimpleList items={renderableListItems(safeArr(s10Technique.limitations))} />
            </div>
          )}
          <div className="mt-3 space-y-4 text-sm">
            {[
              ["Acting", s10Technique.acting],
              ["Vocal / singing", s10Technique.vocal_singing],
              ["Movement / dance", s10Technique.movement_dance],
              ["Musical-theatre package", s10Technique.musical_theatre_package],
              ["Self-tape presentation", s10Technique.self_tape_presentation],
              ["Commercial / screen task", s10Technique.commercial_screen_task],
            ].map(([label, raw]) => {
              const section = safeObj(raw);
              if (!section) return null;
              const observations = renderableListItems(safeArr(section.observations));
              const working = renderableListItems(safeArr(section.what_is_working));
              const improve = renderableListItems(safeArr(section.what_could_improve));
              const actions = renderableListItems(safeArr(section.practical_actions));
              const preserve = renderableListItems(safeArr(section.preserve));
              const limitations = renderableListItems(safeArr(section.limitations));
              const hasContent =
                safeStr(section.headline) ||
                observations.length > 0 ||
                working.length > 0 ||
                improve.length > 0 ||
                actions.length > 0 ||
                preserve.length > 0 ||
                limitations.length > 0 ||
                safeStr(section.not_assessable_reason);
              if (!hasContent) return null;
              return (
                <div key={label as string}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{label as string}</p>
                    <Badge variant="outline" className="capitalize">
                      {labelize(section.status)}
                    </Badge>
                  </div>
                  {safeStr(section.headline) && (
                    <p className="mt-1 text-muted-foreground">{safeStr(section.headline)}</p>
                  )}
                  {safeStr(section.not_assessable_reason) && (
                    <p className="mt-1 text-muted-foreground">
                      {safeStr(section.not_assessable_reason)}
                    </p>
                  )}
                  {observations.length > 0 && (
                    <div className="mt-2">
                      <SimpleList items={observations} marker="•" />
                    </div>
                  )}
                  {working.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        What is working
                      </p>
                      <div className="mt-1">
                        <SimpleList items={working} marker="✓" />
                      </div>
                    </div>
                  )}
                  {improve.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        What could improve
                      </p>
                      <div className="mt-1">
                        <SimpleList items={improve} marker="→" />
                      </div>
                    </div>
                  )}
                  {actions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Practical action
                      </p>
                      <div className="mt-1">
                        <SimpleList items={actions} marker="→" />
                      </div>
                    </div>
                  )}
                  {preserve.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Preserve
                      </p>
                      <div className="mt-1">
                        <SimpleList items={preserve} marker="✓" />
                      </div>
                    </div>
                  )}
                  {limitations.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Limitations
                      </p>
                      <div className="mt-1">
                        <SimpleList items={limitations} marker="•" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {(() => {
        if (!s10Timestamped) return null;
        const notes = safeArr<Record<string, unknown>>(s10Timestamped.notes).filter(
          hasRenderableTimestampedNote,
        );
        const timestampLimitations = renderableListItems(
          safeArr(s10Timestamped.timestamp_limitations),
        );
        if (
          !safeStr(s10Timestamped.summary) &&
          notes.length === 0 &&
          timestampLimitations.length === 0
        )
          return null;
        return (
          <Section
            title="Timestamped and time-banded notes"
            hint="Exact times appear only when the timing source supports them."
          >
            {safeStr(s10Timestamped.summary) && (
              <p className="text-sm">{safeStr(s10Timestamped.summary)}</p>
            )}
            {notes.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {notes.map((n, i) => (
                  <li key={safeStr(n.id) ?? i} className="flex gap-3">
                    <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {safeStr(n.display_label) ?? safeStr(n.timecode) ?? "Timing unavailable"}
                    </span>
                    <span>
                      {(safeStr(n.title) ?? safeStr(n.detail)) && (
                        <span className="font-medium">{safeStr(n.title) ?? safeStr(n.detail)}</span>
                      )}
                      {safeStr(n.title) && safeStr(n.detail) && <> — {safeStr(n.detail)}</>}
                      {safeStr(n.action) && (
                        <span className="block text-xs text-muted-foreground">
                          Action: {safeStr(n.action)}
                        </span>
                      )}
                      {safeStr(n.evidence_summary) && (
                        <span className="block text-xs text-muted-foreground">
                          {safeStr(n.evidence_summary)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {timestampLimitations.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground">
                <SimpleList items={timestampLimitations} />
              </div>
            )}
          </Section>
        );
      })()}

      {!isS10 && tsNotes.length > 0 && (
        <Section title="Timestamped notes">
          <ul className="space-y-2 text-sm">
            {tsNotes.slice(0, 36).map((n, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {safeStr(n?.timestamp) ?? "--:--"}
                </span>
                <span>{safeStr(n?.note) ?? ""}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(() => {
        if (!s10NextActionPlan) {
          return isS10 && s10NextActionLimitation ? (
            <Section title="Next action plan">
              <p className="text-sm text-muted-foreground">{s10NextActionLimitation}</p>
            </Section>
          ) : null;
        }
        const retakePlan = renderableListItems(safeArr(s10NextActionPlan.retake_plan));
        const playbackChecks = renderableListItems(safeArr(s10NextActionPlan.playback_checks));
        const finalChecks = renderableListItems(safeArr(s10NextActionPlan.final_checks));
        const submitChecklist = renderableListItems(safeArr(s10NextActionPlan.submit_checklist));
        const noRetakeReason = safeStr(s10NextActionPlan.no_retake_needed_reason);
        if (
          retakePlan.length === 0 &&
          playbackChecks.length === 0 &&
          finalChecks.length === 0 &&
          submitChecklist.length === 0 &&
          !noRetakeReason
        ) {
          return s10NextActionLimitation ? (
            <Section title="Next action plan">
              <p className="text-sm text-muted-foreground">{s10NextActionLimitation}</p>
            </Section>
          ) : null;
        }
        return (
          <Section title="Next action plan">
            {retakePlan.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Retake plan
                </p>
                <div className="mt-2">
                  <SimpleList items={retakePlan} />
                </div>
              </div>
            )}
            {playbackChecks.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Playback checks
                </p>
                <div className="mt-2">
                  <SimpleList items={playbackChecks} />
                </div>
              </div>
            )}
            {finalChecks.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Final checks
                </p>
                <div className="mt-2">
                  <SimpleList items={finalChecks} />
                </div>
              </div>
            )}
            {submitChecklist.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Submit checklist
                </p>
                <div className="mt-2">
                  <SimpleList items={submitChecklist} />
                </div>
              </div>
            )}
            {noRetakeReason && <p className="mt-3 text-sm">{noRetakeReason}</p>}
          </Section>
        );
      })()}

      {!isS10 && legacyNextPlan.length > 0 && (
        <Section title="Next steps">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {legacyNextPlan.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </Section>
      )}

      {s10Limitations.length > 0 && (
        <Section title="Limitations">
          <SimpleList items={s10Limitations} />
        </Section>
      )}

      {riskFlags.length > 0 && (
        <Section
          title="Submission risk"
          hint="Casting-compliance issues that could cause rejection."
        >
          <ul className="space-y-2 text-sm">
            {riskFlags.map((f, i) => {
              const sev = safeStr(f?.severity) ?? "low";
              const flag = safeStr(f?.flag) ?? "";
              return (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
                      sev === "high"
                        ? "bg-destructive"
                        : sev === "medium"
                          ? "bg-warning"
                          : "bg-muted-foreground",
                    )}
                  />
                  <span>
                    <span className="mr-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {sev}
                    </span>
                    {flag}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {roleFit && safeStr(roleFit.notes) && (
        <Section
          title="Role fit"
          hint="Alignment with the role's function and tone — never likeness or appearance."
        >
          <p className="text-sm">{roleFit.notes}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {typeof roleFit.modifier === "number" && roleFit.modifier !== 0 && (
              <span>
                {roleFit.modifier > 0 ? "+" : ""}
                {roleFit.modifier} to overall
              </span>
            )}
            {roleFit.confidence && <span>confidence: {roleFit.confidence}</span>}
          </div>
        </Section>
      )}

      {presentation.length > 0 && (
        <Section
          title="Presentation notes"
          hint="Practical camera-readability tips. These do not affect your score."
        >
          <ul className="space-y-2 text-sm">
            {presentation.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
