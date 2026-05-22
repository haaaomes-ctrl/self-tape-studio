import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Read-only public shell over the current safe report payload subset.
// It deliberately ignores scores, component scores, role-fit modifiers,
// technique-authority fields, comparison fields and internal QA artefacts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PublicReport = any;

const UNSAFE_PUBLIC_TEXT_RE =
  /\b(overall score|category score|readiness score|score value|score_value|castability|castable|bookability|bookable|marketability|marketable|employability|role fit|recall likelihood|booking prediction|comparison winner|winner|recommendation: choose|public_technique_authority|technique authority|stanislavski|meisner|laban|uta hagen|chekhov|alexander technique|linklater|estill)\b/i;

const INTERNAL_TRACE_RE =
  /\b(raw_prompt|raw_response|signed url|signed_url|playback url|playback_url|storage path|storage key|evidence_anchor|truth_state|model_run_trace|score_trace|technique_observation_trace|runtime_verification_trace|public_claim_trace|claim_candidate_trace|analysis_evidence_state|step1observableevidence)\b/i;

const INTERNAL_ID_RE =
  /\b(?:run|take|comparison)-[0-9a-f]{8,}(?:-[0-9a-f]{4,}){1,}\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/https?:\/\//i.test(trimmed)) return null;
  if (UNSAFE_PUBLIC_TEXT_RE.test(trimmed)) return null;
  if (INTERNAL_TRACE_RE.test(trimmed)) return null;
  if (INTERNAL_ID_RE.test(trimmed)) return null;
  return trimmed;
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function reportData(report: PublicReport): Record<string, unknown> {
  if (isRecord(report?.report_data)) return report.report_data;
  return isRecord(report) ? report : {};
}

function firstSafeText(values: unknown[]): string | null {
  for (const value of values) {
    const text = safeStr(value);
    if (text) return text;
  }
  return null;
}

function extractVerdict(verdict: unknown): {
  label: string | null;
  recommendation: string | null;
  reason: string | null;
  briefSummary: string | null;
  missingRequirements: string[];
} {
  const fallback = safeStr(verdict);
  if (!isRecord(verdict)) {
    return {
      label: fallback,
      recommendation: fallback,
      reason: null,
      briefSummary: null,
      missingRequirements: [],
    };
  }

  return {
    label: firstSafeText([verdict.label, verdict.status, verdict.verdict]),
    recommendation: firstSafeText([
      verdict.recommendation,
      verdict.submit_recommendation,
      verdict.label,
      verdict.status,
    ]),
    reason: firstSafeText([verdict.reason, verdict.summary, verdict.rationale]),
    briefSummary: firstSafeText([
      verdict.brief_achievement_summary,
      verdict.brief_summary,
      verdict.brief_status,
    ]),
    missingRequirements: safeArray(
      verdict.missing_requirements ?? verdict.missing_brief_requirements,
    )
      .map((item) => safeStr(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 3),
  };
}

function extractPriorityFixes(value: unknown): Array<{ headline: string; rationale: string | null }> {
  return safeArray(value)
    .map((item) => {
      if (typeof item === "string") {
        const headline = safeStr(item);
        return headline ? { headline, rationale: null } : null;
      }
      if (!isRecord(item)) return null;
      const headline = firstSafeText([item.headline, item.title, item.fix, item.point]);
      if (!headline) return null;
      return {
        headline,
        rationale: firstSafeText([item.rationale, item.why_now, item.reason]),
      };
    })
    .filter((item): item is { headline: string; rationale: string | null } => Boolean(item))
    .slice(0, 3);
}

function extractStrengths(value: unknown): string[] {
  return safeArray(value)
    .map((item) => {
      if (typeof item === "string") return safeStr(item);
      if (!isRecord(item)) return null;
      return firstSafeText([item.point, item.headline, item.strength, item.summary]);
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
}

function extractNextTakeSteps(value: unknown): string[] {
  if (isRecord(value)) {
    const flat = safeArray(value.steps)
      .map((item) => safeStr(item))
      .filter((item): item is string => Boolean(item));
    const grouped = safeArray(value.groups).flatMap((group) => {
      if (!isRecord(group)) return [];
      return safeArray(group.steps)
        .map((item) => safeStr(item))
        .filter((item): item is string => Boolean(item));
    });
    return [...flat, ...grouped].slice(0, 6);
  }
  return safeArray(value)
    .map((item) => safeStr(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 6);
}

function extractFeedbackReliability(value: unknown): {
  label: string | null;
  reason: string | null;
  limitations: string[];
} {
  const text = safeStr(value);
  if (!isRecord(value)) {
    return { label: text, reason: null, limitations: [] };
  }
  return {
    label: firstSafeText([value.label, value.status, value.level, value.rating]),
    reason: firstSafeText([value.reason, value.summary, value.assessability_note]),
    limitations: safeArray(value.limitations ?? value.not_assessable ?? value.unavailable)
      .map((item) => safeStr(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 4),
  };
}

function isReadyText(value: string | null): boolean {
  return Boolean(value && /(ready|submit|send)/i.test(value) && !/(not ready|retake|re-record|rerecord)/i.test(value));
}

function ShellSection({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "primary" | "muted";
}) {
  return (
    <section
      className={cn(
        "rounded-lg border p-5 shadow-soft",
        tone === "primary"
          ? "border-primary/35 bg-primary/5"
          : tone === "muted"
            ? "border-border bg-secondary/20"
            : "border-border bg-card",
      )}
    >
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ReadinessFirstReportShell({
  report,
  takeNumber,
}: {
  report: PublicReport;
  takeNumber?: number;
}) {
  const data = reportData(report);
  const verdict = extractVerdict(data.submission_verdict);
  const fixFirst = safeStr(data.fix_first);
  const priorityFixes = extractPriorityFixes(data.priority_fixes);
  const strengths = extractStrengths(data.strengths);
  const nextTakeSteps = extractNextTakeSteps(data.next_take_plan);
  const reliability = extractFeedbackReliability(data.feedback_reliability);

  const readinessText =
    verdict.recommendation ??
    verdict.label ??
    "Readiness summary is not available in the locked-down public payload.";
  const ready = isReadyText(readinessText);

  return (
    <div className="space-y-5" data-report-shell="readiness-first-locked-down">
      <section
        className={cn(
          "rounded-lg border p-6 shadow-soft",
          ready ? "border-success/35 bg-success/5" : "border-warning/35 bg-warning/5",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {typeof takeNumber === "number" && (
            <Badge variant="outline" className="font-medium">
              Take {takeNumber}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
            Locked-down preview
          </Badge>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Should I submit this tape?
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold leading-tight">
          {readinessText}
        </h2>
        {verdict.reason && (
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{verdict.reason}</p>
        )}
      </section>

      <ShellSection title="Fix first" tone="primary">
        <p className="font-display text-xl font-semibold leading-snug">
          {fixFirst ?? "No single first fix is available in the locked-down public payload."}
        </p>
      </ShellSection>

      <ShellSection title="Top action items">
        {priorityFixes.length > 0 ? (
          <ol className="space-y-3 text-sm">
            {priorityFixes.map((fix, index) => (
              <li key={`${fix.headline}-${index}`} className="grid grid-cols-[1.75rem_1fr] gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-medium text-foreground">{fix.headline}</span>
                  {fix.rationale && (
                    <span className="mt-1 block text-xs text-muted-foreground">{fix.rationale}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            No priority-fix list is available; use the first fix and next-take plan if present.
          </p>
        )}
      </ShellSection>

      <ShellSection title="Brief achievement">
        {verdict.briefSummary || verdict.missingRequirements.length > 0 ? (
          <div className="space-y-3 text-sm">
            {verdict.briefSummary && <p>{verdict.briefSummary}</p>}
            {verdict.missingRequirements.length > 0 && (
              <ul className="space-y-1.5">
                {verdict.missingRequirements.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span className="text-warning">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Brief achievement detail is not available in this locked-down shell yet.
          </p>
        )}
      </ShellSection>

      <ShellSection title="Preserve this">
        {strengths.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {strengths.map((strength, index) => (
              <li key={`${strength}-${index}`} className="flex gap-2">
                <span className="text-success">+</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No preserve guidance is available in the locked-down public payload.
          </p>
        )}
      </ShellSection>

      <ShellSection title="Next-take checklist">
        {nextTakeSteps.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {nextTakeSteps.map((step, index) => (
              <li key={`${step}-${index}`} className="flex gap-2">
                <span className="text-primary">-&gt;</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No next-take steps are available in the locked-down public payload.
          </p>
        )}
      </ShellSection>

      <ShellSection title="Not assessable / limitations" tone="muted">
        {reliability.limitations.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {reliability.limitations.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-2">
                <span className="text-muted-foreground">-</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No specific not-assessable items were provided in the locked-down public payload.
          </p>
        )}
      </ShellSection>

      <ShellSection title="Feedback reliability" tone="muted">
        <p className="text-sm">
          {reliability.label ?? "Feedback reliability was not provided in the locked-down public payload."}
        </p>
        {reliability.reason && (
          <p className="mt-2 text-xs text-muted-foreground">{reliability.reason}</p>
        )}
      </ShellSection>
    </div>
  );
}
