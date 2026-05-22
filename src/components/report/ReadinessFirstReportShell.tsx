import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Read-only public shell over the current safe report payload subset.
// It deliberately ignores scores, component scores, role-fit modifiers,
// technique-authority fields, comparison fields and internal QA artefacts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PublicReport = any;

type PublicReportData = {
  submission_verdict?: unknown;
  fix_first?: unknown;
  priority_fixes?: unknown;
  strengths?: unknown;
  next_take_plan?: unknown;
  feedback_reliability?: unknown;
  brief_requirements?: unknown;
};

type TextItem = {
  headline: string;
  detail: string | null;
};

type BriefRequirementStatus =
  | "observed"
  | "not_observed"
  | "not_assessable"
  | "not_applicable";

type BriefRequirementItem = {
  label: string;
  status: BriefRequirementStatus;
  note: string | null;
};

const UNSAFE_PUBLIC_TEXT_RE =
  /\b(overall score|category score|readiness score|score value|score_value|category_scores|score_breakdown|castability|castable|bookability|bookable|marketability|marketable|employability|role fit|role-fit|recall likelihood|booking prediction|comparison winner|winner|recommendation:\s*choose|choose take|public_technique_authority|technique authority|stanislavski|meisner|laban|uta hagen|chekhov|alexander technique|linklater|estill)\b/i;

const SCORE_VALUE_RE =
  /\b(?:score|readiness|acting|technical|vocal|audio|brief adherence|presentation)\s*[:=]?\s*\d{1,3}\b|\b\d{1,3}\s*(?:\/100|out of 100|%)\b/i;

const INTERNAL_TRACE_RE =
  /\b(raw_report|raw_prompt|raw_response|signed url|signed_url|playback url|playback_url|storage path|storage key|branch name|branch_name|run_id|model trace|evidence_anchor|truth_state|truth linkage|model_run_trace|score_trace|technique_observation_trace|runtime_verification_trace|public_claim_trace|claim_candidate_trace|analysis_evidence_state|step1observableevidence|gate trace|gatetrace|validator trace|validatortrace|blocker code|blocker_codes|blocker|candidate_technique)\b/i;

const INTERNAL_ID_RE =
  /\b(?:run|take|comparison)-[0-9a-f]{8,}(?:-[0-9a-f]{4,}){1,}\b/i;

const GENERIC_PUBLIC_TEXT_RE =
  /^(good job|great job|nice work|be more confident|work on your acting|try harder|good performance|strong performance|great performance|excellent performance)$/i;

const UNSAFE_BRIEF_REQUIREMENT_TEXT_RE =
  /\b(failed the brief|bad brief match|not castable|passed|failed|achieved|excellent|weak|good|bad|score|scored)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function safeStr(value: unknown, maxLength = 220): string | null {
  if (typeof value !== "string") return null;
  const trimmed = compactWhitespace(value);
  if (!trimmed) return null;
  if (/https?:\/\//i.test(trimmed)) return null;
  if (UNSAFE_PUBLIC_TEXT_RE.test(trimmed)) return null;
  if (SCORE_VALUE_RE.test(trimmed)) return null;
  if (INTERNAL_TRACE_RE.test(trimmed)) return null;
  if (INTERNAL_ID_RE.test(trimmed)) return null;
  if (GENERIC_PUBLIC_TEXT_RE.test(trimmed.replace(/[.!?]+$/g, ""))) return null;
  return clampText(trimmed, maxLength);
}

function listInput(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

function objectListInput(value: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const list = listInput(value[key]);
    if (list.length > 0) return list;
  }
  return [];
}

function reportData(report: PublicReport): PublicReportData {
  const source = isRecord(report?.report_data)
    ? report.report_data
    : isRecord(report?.public_report_payload?.report_data)
      ? report.public_report_payload.report_data
      : isRecord(report?.render_payload?.report_data)
        ? report.render_payload.report_data
        : isRecord(report)
          ? report
          : {};

  return {
    submission_verdict: source.submission_verdict,
    fix_first: source.fix_first,
    priority_fixes: source.priority_fixes,
    strengths: source.strengths,
    next_take_plan: source.next_take_plan,
    feedback_reliability: source.feedback_reliability,
    brief_requirements: source.brief_requirements,
  };
}

function firstSafeText(values: unknown[], maxLength?: number): string | null {
  for (const value of values) {
    const text = safeStr(value, maxLength);
    if (text) return text;
  }
  return null;
}

function extractActionText(value: unknown, maxLength = 180): string | null {
  if (typeof value === "string") return safeStr(value, maxLength);
  if (!isRecord(value)) return null;
  return firstSafeText(
    [
      value.headline,
      value.title,
      value.fix,
      value.action,
      value.item,
      value.summary,
      value.point,
      value.text,
    ],
    maxLength,
  );
}

function extractVerdict(verdict: unknown): {
  readiness: string | null;
  reason: string | null;
} {
  const fallback = safeStr(verdict, 180);
  if (!isRecord(verdict)) {
    return { readiness: fallback, reason: null };
  }

  return {
    readiness: firstSafeText(
      [
        verdict.recommendation,
        verdict.submit_recommendation,
        verdict.label,
        verdict.status,
        verdict.verdict,
      ],
      180,
    ),
    reason: firstSafeText([verdict.reason, verdict.summary, verdict.rationale], 260),
  };
}

function extractPriorityFixes(value: unknown): TextItem[] {
  const items = isRecord(value)
    ? objectListInput(value, ["items", "fixes", "priority_fixes"])
    : listInput(value);

  return items
    .map((item) => {
      if (typeof item === "string") {
        const headline = safeStr(item, 150);
        return headline ? { headline, detail: null } : null;
      }
      if (!isRecord(item)) return null;
      const headline = firstSafeText(
        [item.headline, item.title, item.fix, item.action, item.point, item.text],
        150,
      );
      if (!headline) return null;
      return {
        headline,
        detail: firstSafeText([item.rationale, item.why_now, item.reason, item.detail], 180),
      };
    })
    .filter((item): item is TextItem => Boolean(item))
    .slice(0, 3);
}

function extractStrengths(value: unknown): string[] {
  const items = isRecord(value)
    ? objectListInput(value, ["items", "strengths", "preserve"])
    : listInput(value);

  return items
    .map((item) => {
      if (typeof item === "string") return safeStr(item, 160);
      if (!isRecord(item)) return null;
      return firstSafeText(
        [item.point, item.headline, item.strength, item.summary, item.text],
        160,
      );
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
}

function extractNextTakeSteps(value: unknown): string[] {
  if (typeof value === "string") {
    const step = safeStr(value, 180);
    return step ? [step] : [];
  }

  if (isRecord(value)) {
    const flat = objectListInput(value, ["steps", "items", "checklist"])
      .map((item) => extractActionText(item, 180))
      .filter((item): item is string => Boolean(item));
    const grouped = listInput(value.groups).flatMap((group) => {
      if (!isRecord(group)) return [];
      return listInput(group.steps)
        .map((item) => extractActionText(item, 180))
        .filter((item): item is string => Boolean(item));
    });
    return [...flat, ...grouped].slice(0, 6);
  }

  return listInput(value)
    .map((item) => extractActionText(item, 180))
    .filter((item): item is string => Boolean(item))
    .slice(0, 6);
}

function extractFeedbackReliability(value: unknown): {
  label: string | null;
  reason: string | null;
  limitations: string[];
} {
  const text = safeStr(value, 120);
  if (!isRecord(value)) {
    return { label: text, reason: null, limitations: [] };
  }
  return {
    label: firstSafeText([value.label, value.status, value.level, value.rating], 120),
    reason: firstSafeText([value.reason, value.summary, value.assessability_note, value.note], 220),
    limitations: listInput(value.limitations ?? value.not_assessable ?? value.unavailable)
      .map((item) => extractActionText(item, 180))
      .filter((item): item is string => Boolean(item))
      .slice(0, 4),
  };
}

function safeBriefText(value: unknown, maxLength = 180): string | null {
  const text = safeStr(value, maxLength);
  if (!text) return null;
  if (UNSAFE_BRIEF_REQUIREMENT_TEXT_RE.test(text)) return null;
  return text;
}

function firstSafeBriefText(values: unknown[], maxLength?: number): string | null {
  for (const value of values) {
    const text = safeBriefText(value, maxLength);
    if (text) return text;
  }
  return null;
}

function normaliseBriefRequirementStatus(value: unknown): BriefRequirementStatus {
  const text = safeStr(value, 80)?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (["observed", "seen", "present", "confirmed", "represented"].includes(text)) {
    return "observed";
  }
  if (["not_observed", "not_seen", "missing", "absent", "unconfirmed", "not_confirmed"].includes(text)) {
    return "not_observed";
  }
  if (["not_applicable", "na", "n_a"].includes(text)) {
    return "not_applicable";
  }
  return "not_assessable";
}

function briefStatusLabel(status: BriefRequirementStatus): string {
  if (status === "observed") return "Observed";
  if (status === "not_observed") return "Not observed";
  if (status === "not_applicable") return "Not applicable";
  return "Not assessable";
}

function extractBriefRequirementItem(value: unknown): BriefRequirementItem | null {
  if (typeof value === "string") {
    const label = safeBriefText(value, 120);
    return label ? { label, status: "not_assessable", note: null } : null;
  }
  if (!isRecord(value)) return null;
  const label = firstSafeBriefText(
    [value.label, value.requirement, value.title, value.item, value.text, value.name],
    120,
  );
  if (!label) return null;
  return {
    label,
    status: normaliseBriefRequirementStatus(value.status ?? value.state ?? value.outcome ?? value.result),
    note: firstSafeBriefText([value.note, value.summary, value.reason, value.detail], 180),
  };
}

function extractBriefRequirements(value: unknown): {
  shouldRender: boolean;
  status: "available" | "unavailable" | "not_applicable";
  summary: string | null;
  items: BriefRequirementItem[];
} {
  if (!isRecord(value)) {
    return { shouldRender: false, status: "unavailable", summary: null, items: [] };
  }
  const rawStatus = safeStr(value.status, 80)?.toLowerCase().replace(/[\s-]+/g, "_");
  const status =
    rawStatus === "available" || rawStatus === "unavailable" || rawStatus === "not_applicable"
      ? rawStatus
      : "available";
  const items = objectListInput(value, ["items", "requirements", "brief_requirements", "checklist"])
    .map((item) => extractBriefRequirementItem(item))
    .filter((item): item is BriefRequirementItem => Boolean(item))
    .slice(0, 8);
  const summary = firstSafeBriefText([value.summary, value.note, value.reason], 240);
  return {
    shouldRender: items.length > 0 || status === "unavailable" || status === "not_applicable" || Boolean(summary),
    status,
    summary,
    items,
  };
}

function isReadyText(value: string | null): boolean {
  return Boolean(
    value &&
      /(ready|submit|send)/i.test(value) &&
      !/(not ready|retake|re-record|rerecord|worth another|before submitting|after one more|needs|fix first)/i.test(
        value,
      ),
  );
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
  const fixFirst = extractActionText(data.fix_first);
  const priorityFixes = extractPriorityFixes(data.priority_fixes);
  const strengths = extractStrengths(data.strengths);
  const nextTakeSteps = extractNextTakeSteps(data.next_take_plan);
  const reliability = extractFeedbackReliability(data.feedback_reliability);
  const briefRequirements = extractBriefRequirements(data.brief_requirements);

  const readinessText =
    verdict.readiness ?? "Readiness guidance is not available in this report.";
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
          Readiness
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
          {fixFirst ?? "This report does not include a single fix-first item."}
        </p>
      </ShellSection>

      <ShellSection title="Priority fixes">
        {priorityFixes.length > 0 ? (
          <ol className="space-y-3 text-sm">
            {priorityFixes.map((fix, index) => (
              <li key={`${fix.headline}-${index}`} className="grid grid-cols-[1.75rem_1fr] gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-medium text-foreground">{fix.headline}</span>
                  {fix.detail && (
                    <span className="mt-1 block text-xs text-muted-foreground">{fix.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            This report does not include a priority-fix list.
          </p>
        )}
      </ShellSection>

      {briefRequirements.shouldRender && (
        <ShellSection title="Brief requirements">
          <p className="text-sm text-muted-foreground">
            {briefRequirements.summary ??
              (briefRequirements.status === "not_applicable"
                ? "Brief requirements do not apply to this report."
                : briefRequirements.status === "unavailable"
                  ? "Brief requirements are not available in this report."
                  : "Brief requirements are shown only where they can be stated safely.")}
          </p>
          {briefRequirements.items.length > 0 && (
            <ul className="mt-4 space-y-3 text-sm">
              {briefRequirements.items.map((item, index) => (
                <li key={`${item.label}-${index}`} className="rounded-md border border-border bg-background/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {briefStatusLabel(item.status)}
                    </Badge>
                  </div>
                  {item.note && (
                    <p className="mt-2 text-xs text-muted-foreground">{item.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ShellSection>
      )}

      <ShellSection title="Keep / preserve">
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
            This report does not include preserve guidance.
          </p>
        )}
      </ShellSection>

      <ShellSection title="Next take plan">
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
            This report does not include next-take steps.
          </p>
        )}
      </ShellSection>

      <ShellSection title="Reliability / limitations" tone="muted">
        <p className="text-sm">
          {reliability.label ?? "This report does not include a feedback reliability note."}
        </p>
        {reliability.reason && (
          <p className="mt-2 text-xs text-muted-foreground">{reliability.reason}</p>
        )}
        {reliability.limitations.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {reliability.limitations.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-2">
                <span className="text-muted-foreground">-</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            No specific limitations were included.
          </p>
        )}
      </ShellSection>
    </div>
  );
}
