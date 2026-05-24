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

  const s10 = safeObj(report.s10_view_model);
  const s10Recommendation = safeObj(s10?.recommendation);
  const s10ScoreSummary = safeObj(s10?.score_summary);
  const s10Matrix = safeObj(s10?.brief_achievement_matrix);
  const s10FixHierarchy = safeObj(s10?.fix_hierarchy);
  const s10NextActionPlan = safeObj(s10?.next_action_plan);
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
  const overall =
    safeNum(s10ScoreSummary?.overall_submission_readiness_score) ??
    safeNum(report.overall_readiness);
  const headline = safeStr(s10Recommendation?.headline) ?? safeStr(report.headline);
  const insight =
    safeStr(s10Recommendation?.score_explanation) ??
    safeStr(s10Matrix?.summary) ??
    safeStr(report.insight);
  const verdict =
    safeStr(s10Recommendation?.decision)?.replace(/_/g, " ") ?? safeStr(report.verdict);
  const reliability = safeStr(report.reliability);
  const reliabilityReason = safeStr(report.reliability_reason);
  const fixFirst = safeStr(report.fix_first);
  const blockers = safeArr<string>(report.block_reasons).filter(
    (b): b is string => typeof b === "string",
  );
  const strengths = safeArr(report.strengths);
  const improvements = safeArr(report.improvements);
  const tsNotes = safeArr<{ timestamp?: string; note?: string }>(report.timestamped_notes);
  const presentation = safeArr<string>(report.presentation_notes).filter(
    (s): s is string => typeof s === "string",
  );
  const riskFlags = safeArr<{ severity?: string; flag?: string }>(report.risk_flags);
  const components = safeArr<{
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
  const scores =
    report.scores && typeof report.scores === "object"
      ? (report.scores as Record<string, number | null>)
      : null;
  const categoryNotes =
    report.category_notes && typeof report.category_notes === "object"
      ? (report.category_notes as Record<string, string>)
      : null;
  const nextPlan = safeArr<string>(
    (report.next_take_plan && (report.next_take_plan as { steps?: unknown }).steps) ?? [],
  ).filter((s): s is string => typeof s === "string");
  const roleFit =
    report.role_fit && typeof report.role_fit === "object"
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
              {s10 && (
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
              {blockers.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-warning">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.at_risk && blockers.length === 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
            <p>
              This tape is flagged <strong>at risk</strong> — a brief requirement appears to be
              missing.
            </p>
          </div>
        )}
      </div>

      {s10 &&
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

      {s10 && (
        <>
          {(() => {
            const reqs = safeArr<Record<string, unknown>>(s10.brief_requirements);
            const rows = safeArr<Record<string, unknown>>(s10Matrix?.requirement_results);
            if (!s10Matrix && reqs.length === 0) return null;
            return (
              <Section
                title="Brief achievement"
                hint="What the brief asked for, checked against the submitted tape."
              >
                {safeStr(s10Matrix?.summary) && (
                  <p className="text-sm">{safeStr(s10Matrix?.summary)}</p>
                )}
                {s10Matrix && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {["overall_status", "mandatory_status", "readiness_impact"].map((key) => (
                      <Badge key={key} variant="outline" className="capitalize">
                        {key.replace(/_/g, " ")}: {labelize(s10Matrix[key])}
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
                      {rows.map((r, i) => (
                        <li key={safeStr(r.requirement_id) ?? i}>
                          <span className="font-medium">
                            {safeStr(r.requirement_summary) ?? "Requirement"}
                          </span>
                          {" — "}
                          <span className="capitalize">{labelize(r.achievement_status)}</span>
                          {safeStr(r.recommended_action) && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {safeStr(r.recommended_action)}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            );
          })()}

          {(() => {
            const sequence = safeArr<Record<string, unknown>>(
              safeObj(s10.observed_tape)?.observed_tape_sequence,
            );
            const verifications = safeArr<Record<string, unknown>>(
              safeObj(s10.observed_tape)?.component_verifications,
            );
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
                        <span className="font-medium">{safeStr(item.label) ?? "Section"}</span>
                        {" — "}
                        <span className="capitalize">{labelize(item.present_status)}</span>
                        {safeStr(item.completion_status) && (
                          <span className="text-muted-foreground">
                            {" "}
                            / {labelize(item.completion_status)}
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
                          {safeStr(item.requirement_summary) ?? "Component"}
                        </span>
                        {" — "}
                        <span className="capitalize">{labelize(item.observed_status)}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          / {labelize(item.completion_status)}
                        </span>
                        {safeStr(item.evidence_summary) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {safeStr(item.evidence_summary)}
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
        if (s10FixHierarchy) {
          const fixFirst = safeObj(s10FixHierarchy.fix_first);
          const must = safeArr(s10FixHierarchy.must_fix_before_submitting);
          const should = safeArr(s10FixHierarchy.should_improve_if_retaking);
          const optional = safeArr(s10FixHierarchy.optional_polish);
          const preserve = safeArr(s10FixHierarchy.preserve);
          if (!fixFirst && must.length === 0 && should.length === 0 && optional.length === 0) {
            return null;
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
        if (fixFirst) {
          return (
            <Section title="Fix this first">
              <p className="font-display text-lg font-semibold leading-snug">{fixFirst}</p>
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
      {scores && (
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
      )}

      {/* Components */}
      {components.length > 0 && (
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
                    if (safeStr(c.key_evidence)) detailRows.push(["Key evidence", c.key_evidence!]);
                    if (safeStr(c.score_driver)) detailRows.push(["Score driver", c.score_driver!]);
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
      )}

      {s10StrengthsAndPreserve && (
        <Section title="Strengths and preserve">
          {safeStr(s10StrengthsAndPreserve.summary) && (
            <p className="text-sm">{safeStr(s10StrengthsAndPreserve.summary)}</p>
          )}
          {safeArr(s10StrengthsAndPreserve.strengths).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Strengths
              </p>
              <div className="mt-2">
                <SimpleList items={safeArr(s10StrengthsAndPreserve.strengths)} marker="✓" />
              </div>
            </div>
          )}
          {safeArr(s10StrengthsAndPreserve.preserve).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preserve
              </p>
              <div className="mt-2">
                <SimpleList items={safeArr(s10StrengthsAndPreserve.preserve)} marker="✓" />
              </div>
            </div>
          )}
          {safeArr(s10StrengthsAndPreserve.do_not_overfix).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Do not overfix
              </p>
              <div className="mt-2">
                <SimpleList items={safeArr(s10StrengthsAndPreserve.do_not_overfix)} marker="•" />
              </div>
            </div>
          )}
          {safeArr<string>(s10StrengthsAndPreserve.limitations).length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              <SimpleList items={safeArr(s10StrengthsAndPreserve.limitations)} />
            </div>
          )}
        </Section>
      )}

      {!s10 && strengths.length > 0 && (
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

      {!s10 && improvements.length > 0 && (
        <Section title="Improvements">
          <ul className="space-y-2 text-sm">
            {improvements.map((s, i) => (
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
              const observations = safeArr(section.observations);
              const working = safeArr(section.what_is_working);
              const improve = safeArr(section.what_could_improve);
              const actions = safeArr(section.practical_actions);
              const hasContent =
                safeStr(section.headline) ||
                observations.length > 0 ||
                working.length > 0 ||
                improve.length > 0 ||
                actions.length > 0 ||
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
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {s10Timestamped && (
        <Section
          title="Timestamped and time-banded notes"
          hint="Exact times appear only when the timing source supports them."
        >
          {safeStr(s10Timestamped.summary) && (
            <p className="text-sm">{safeStr(s10Timestamped.summary)}</p>
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {safeArr<Record<string, unknown>>(s10Timestamped.notes).map((n, i) => (
              <li key={safeStr(n.id) ?? i} className="flex gap-3">
                <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {safeStr(n.display_label) ?? safeStr(n.timecode) ?? "Timing unavailable"}
                </span>
                <span>
                  <span className="font-medium">{safeStr(n.title) ?? labelize(n.section)}</span>
                  {safeStr(n.detail) && <> — {safeStr(n.detail)}</>}
                  {safeStr(n.action) && (
                    <span className="block text-xs text-muted-foreground">
                      Action: {safeStr(n.action)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {safeArr<string>(s10Timestamped.timestamp_limitations).length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              <SimpleList items={safeArr(s10Timestamped.timestamp_limitations)} />
            </div>
          )}
        </Section>
      )}

      {!s10 && tsNotes.length > 0 && (
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

      {s10NextActionPlan && (
        <Section title="Next action plan">
          {safeArr(s10NextActionPlan.retake_plan).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Retake plan
              </p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
                {safeArr(s10NextActionPlan.retake_plan).map((s, i) => (
                  <li key={i}>{String(s)}</li>
                ))}
              </ol>
            </div>
          )}
          {safeArr(s10NextActionPlan.playback_checks).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Playback checks
              </p>
              <div className="mt-2">
                <SimpleList items={safeArr(s10NextActionPlan.playback_checks)} />
              </div>
            </div>
          )}
          {safeArr(s10NextActionPlan.final_checks).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Final checks
              </p>
              <div className="mt-2">
                <SimpleList items={safeArr(s10NextActionPlan.final_checks)} />
              </div>
            </div>
          )}
          {safeArr(s10NextActionPlan.submit_checklist).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Submit checklist
              </p>
              <div className="mt-2">
                <SimpleList items={safeArr(s10NextActionPlan.submit_checklist)} />
              </div>
            </div>
          )}
          {safeStr(s10NextActionPlan.no_retake_needed_reason) && (
            <p className="mt-3 text-sm">{safeStr(s10NextActionPlan.no_retake_needed_reason)}</p>
          )}
        </Section>
      )}

      {!s10 && nextPlan.length > 0 && (
        <Section title="Next steps">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {nextPlan.map((s, i) => (
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
