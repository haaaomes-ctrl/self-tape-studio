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

function ScoreBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${clamped}%` }}
      />
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

  const t: AuditionTypeForLabels =
    auditionType ?? safeStr(report.audition_type);
  const overall = safeNum(report.overall_readiness);
  const headline = safeStr(report.headline);
  const insight = safeStr(report.insight);
  const verdict = safeStr(report.verdict);
  const reliability = safeStr(report.reliability);
  const reliabilityReason = safeStr(report.reliability_reason);
  const fixFirst = safeStr(report.fix_first);
  const blockers = safeArr<string>(report.block_reasons).filter(
    (b): b is string => typeof b === "string",
  );
  const strengths = safeArr(report.strengths);
  const improvements = safeArr(report.improvements);
  const tsNotes = safeArr<{ timestamp?: string; note?: string }>(
    report.timestamped_notes,
  );
  const presentation = safeArr<string>(report.presentation_notes).filter(
    (s): s is string => typeof s === "string",
  );
  const riskFlags = safeArr<{ severity?: string; flag?: string }>(
    report.risk_flags,
  );
  const components = safeArr<{
    type?: string;
    weight?: number | null;
    score?: number | null;
    note?: string | null;
    subtype?: string | null;
    style?: string | null;
    form?: string | null;
    start?: string | null;
    end?: string | null;
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
    (report.next_take_plan && (report.next_take_plan as { steps?: unknown }).steps) ??
      [],
  ).filter((s): s is string => typeof s === "string");
  const roleFit = report.role_fit && typeof report.role_fit === "object"
    ? (report.role_fit as { notes?: string | null; modifier?: number | null; confidence?: string | null })
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
            </div>
            {headline && (
              <p className="mt-2 font-display text-xl font-semibold leading-snug">
                {headline}
              </p>
            )}
            {insight && (
              <p className="mt-2 text-sm text-muted-foreground">{insight}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {verdict && (
                <span>
                  <span className="font-medium text-foreground">Verdict:</span>{" "}
                  {verdict}
                </span>
              )}
              {reliability && (
                <span>
                  <span className="font-medium text-foreground">Reliability:</span>{" "}
                  {reliability}
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
              This tape is flagged <strong>at risk</strong> — a brief requirement
              appears to be missing.
            </p>
          </div>
        )}
      </div>

      {fixFirst && (
        <Section title="Fix this first">
          <p className="font-display text-lg font-semibold leading-snug">
            {fixFirst}
          </p>
        </Section>
      )}

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
                    <span className="text-sm font-medium">
                      {getCategoryLabel(t, key)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {value}
                    </span>
                  </div>
                  <ScoreBar value={value} />
                  {categoryNotes?.[key] && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {categoryNotes[key]}
                    </p>
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
                  {meta && (
                    <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
                  )}
                  {c.start && c.end && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {c.start} – {c.end}
                    </p>
                  )}
                  {c.note && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {c.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {strengths.length > 0 && (
        <Section title="Strengths">
          <ul className="space-y-2 text-sm">
            {strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-success">✓</span>
                <span>
                  {typeof s === "string"
                    ? s
                    : safeStr((s as { point?: unknown })?.point) ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {improvements.length > 0 && (
        <Section title="Improvements">
          <ul className="space-y-2 text-sm">
            {improvements.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-warning">→</span>
                <span>
                  {typeof s === "string"
                    ? s
                    : safeStr((s as { point?: unknown })?.point) ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tsNotes.length > 0 && (
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

      {nextPlan.length > 0 && (
        <Section title="Next steps">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {nextPlan.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
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
