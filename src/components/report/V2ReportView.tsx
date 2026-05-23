// R10 locked-down decision-support report renderer.
//
// Read-only consumer of the public-safe `v2-component` schema. It renders the
// professional submit/retake decision model and deliberately avoids scores,
// category scores, named technique authority, comparison recommendations,
// role-fit, raw report data and internal QA artefacts.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type V2 = any;

function safeStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function safeArr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function safeObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
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

function textList(value: unknown): string[] {
  return safeArr(value)
    .map((item) => {
      if (typeof item === "string") return item;
      const obj = safeObj(item);
      return (
        safeStr(obj?.headline) ??
        safeStr(obj?.title) ??
        safeStr(obj?.text) ??
        safeStr(obj?.point) ??
        safeStr(obj?.summary)
      );
    })
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function priorityFixes(
  value: unknown,
): Array<{ headline: string; rationale?: string; kind?: string }> {
  return safeArr(value)
    .map((item) => {
      if (typeof item === "string") return { headline: item };
      const obj = safeObj(item);
      const headline = safeStr(obj?.headline) ?? safeStr(obj?.title);
      if (!headline) return null;
      return {
        headline,
        ...(safeStr(obj?.rationale) ? { rationale: safeStr(obj?.rationale)! } : {}),
        ...(safeStr(obj?.kind) ? { kind: safeStr(obj?.kind)! } : {}),
      };
    })
    .filter(
      (item): item is { headline: string; rationale?: string; kind?: string } => item !== null,
    );
}

function planSteps(value: unknown): Array<{ label?: string; items: string[] }> {
  const obj = safeObj(value);
  if (!obj) {
    const items = textList(value);
    return items.length > 0 ? [{ items }] : [];
  }
  const groups = safeArr(obj.groups)
    .map((group) => {
      const g = safeObj(group);
      const label = safeStr(g?.label)?.replace(/_/g, " ");
      const items = textList(g?.items);
      return items.length > 0 ? { ...(label ? { label } : {}), items } : null;
    })
    .filter((group): group is { label?: string; items: string[] } => group !== null);
  const steps = textList(obj.steps);
  return [...(steps.length > 0 ? [{ items: steps }] : []), ...groups];
}

function verdictTone(decision: string | null | undefined): string {
  switch (decision) {
    case "submit":
      return "text-success";
    case "submit_if_deadline_is_close":
    case "review_carefully":
    case "retake_recommended":
      return "text-warning";
    case "retake_required_if_possible":
    case "not_assessable":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}

function reliabilityTone(level: string | null): string {
  if (level === "high") return "text-success";
  if (level === "low") return "text-warning";
  return "text-foreground";
}

function tokenLabel(value: unknown): string | null {
  return safeStr(value)?.replace(/_/g, " ") ?? null;
}

function metaParts(...values: Array<string | null | undefined>): string {
  return values.filter(Boolean).join(" · ");
}

function BriefAchievement({ achievement }: { achievement: Record<string, unknown> | null }) {
  if (!achievement) return null;
  const overall = tokenLabel(achievement.overall_status) ?? "not assessable";
  const mandatory = tokenLabel(achievement.mandatory_status);
  const impact = tokenLabel(achievement.readiness_impact);
  const summary = safeStr(achievement.summary);
  const mandatorySummary = safeStr(achievement.mandatory_requirements_status);
  const readinessEffect = safeStr(achievement.readiness_effect);
  const notAssessableSummary = safeStr(achievement.not_assessable_summary);

  return (
    <Section title="Brief achievement">
      <p className="text-sm font-medium capitalize">{overall}</p>
      {(mandatory || impact) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {metaParts(mandatory ? `mandatory: ${mandatory}` : null, impact)}
        </p>
      )}
      {summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
      {mandatorySummary && <p className="mt-2 text-xs text-muted-foreground">{mandatorySummary}</p>}
      {readinessEffect && <p className="mt-2 text-xs text-muted-foreground">{readinessEffect}</p>}
      {notAssessableSummary && (
        <p className="mt-2 text-xs text-muted-foreground">Not assessable: {notAssessableSummary}</p>
      )}
    </Section>
  );
}

function BriefRequirements({ requirements }: { requirements: unknown }) {
  const rows = safeArr<Record<string, unknown>>(requirements).filter(
    (row) => safeStr(row?.public_summary) || safeStr(row?.source_text),
  );
  if (rows.length === 0) return null;
  return (
    <Section title="What the brief asked for">
      <ul className="space-y-3 text-sm">
        {rows.map((row, i) => {
          const summary = safeStr(row.public_summary) ?? safeStr(row.source_text);
          const source = safeStr(row.source_text);
          const category = tokenLabel(row.category);
          const obligation = tokenLabel(row.obligation);
          const requirementType = tokenLabel(row.requirement_type);
          const status = tokenLabel(row.achievement_status) ?? "not assessable";
          const impact = tokenLabel(row.readiness_impact);
          const evidence = safeStr(row.public_evidence_summary);
          const nextAction = safeStr(row.next_take_action);
          const limits = textList(row.assessability_limits);
          return (
            <li key={i} className="rounded-md border border-border bg-secondary/20 p-3">
              <p className="font-medium">{summary}</p>
              {source && source !== summary && (
                <p className="mt-1 text-xs text-muted-foreground">Brief text: {source}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {metaParts(category, obligation, requirementType, status, impact)}
              </p>
              {evidence && <p className="mt-2 text-xs text-muted-foreground">{evidence}</p>}
              {limits.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Not assessable: {limits.join("; ")}
                </p>
              )}
              {nextAction && (
                <p className="mt-2 text-xs text-muted-foreground">Next take: {nextAction}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function TextList({ items, marker }: { items: string[]; marker?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          {marker && <span className="text-muted-foreground">{marker}</span>}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function V2ReportView({
  report,
  takeNumber,
}: {
  report: V2;
  takeNumber?: number;
  auditionType?: unknown;
}) {
  if (!report || typeof report !== "object") return null;

  const verdict = safeObj(report.submission_verdict);
  const decision = safeStr(verdict?.decision);
  const verdictLabel = safeStr(verdict?.label) ?? safeStr(report.verdict) ?? "Review carefully";
  const verdictReason = safeStr(verdict?.reason);
  const why = safeObj(report.why_this_verdict);
  const whySummary = safeStr(why?.summary) ?? verdictReason;
  const whyReasons = textList(why?.main_reasons);
  const limitations = textList(why?.limitations);
  const reliability = safeObj(report.feedback_reliability);
  const reliabilityLevel = safeStr(reliability?.level) ?? safeStr(report.reliability);
  const reliabilitySummary = safeStr(reliability?.summary);
  const fixes = priorityFixes(report.priority_fixes);
  const mustFix = textList(report.must_fix_before_submitting);
  const shouldImprove = textList(report.should_improve_if_retaking);
  const optionalPolish = textList(report.optional_polish);
  const preserve =
    textList(report.preserve).length > 0 ? textList(report.preserve) : textList(report.strengths);
  const doNotOverfix = textList(report.do_not_overfix);
  const notAssessable = textList(report.not_assessable);
  const plan = planSteps(report.next_take_plan);
  const briefAchievement = safeObj(report.brief_achievement);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {typeof takeNumber === "number" && (
                <Badge variant="outline" className="font-medium">
                  Take {takeNumber}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                Locked report
              </Badge>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Submission guidance
            </p>
            <p
              className={cn(
                "mt-1 font-display text-3xl font-semibold leading-tight",
                verdictTone(decision),
              )}
            >
              {verdictLabel}
            </p>
            {whySummary && (
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{whySummary}</p>
            )}
          </div>

          {reliabilityLevel && (
            <div className="min-w-44 rounded-md border border-border bg-secondary/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Review reliability
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-semibold capitalize",
                  reliabilityTone(reliabilityLevel),
                )}
              >
                {reliabilityLevel}
              </p>
              {reliabilitySummary && (
                <p className="mt-1 text-xs text-muted-foreground">{reliabilitySummary}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {(whyReasons.length > 0 || limitations.length > 0) && (
        <Section title="Why this verdict">
          <TextList items={whyReasons} marker="•" />
          {limitations.length > 0 && (
            <div className="mt-3 rounded-md border border-border bg-secondary/20 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Could not assess
              </p>
              <TextList items={limitations} marker="•" />
            </div>
          )}
        </Section>
      )}

      <BriefAchievement achievement={briefAchievement} />

      <BriefRequirements requirements={report.brief_requirements} />

      {fixes.length > 0 && (
        <Section title="Prioritised fixes">
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            {fixes.map((fix, i) => (
              <li key={i}>
                <p className="font-display text-base font-semibold leading-snug">{fix.headline}</p>
                {fix.rationale && (
                  <p className="mt-1 text-xs text-muted-foreground">{fix.rationale}</p>
                )}
                {fix.kind && (
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {fix.kind}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {mustFix.length > 0 && (
          <Section title="Must fix before submitting">
            <TextList items={mustFix} marker="•" />
          </Section>
        )}
        {shouldImprove.length > 0 && (
          <Section title="Should improve if retaking">
            <TextList items={shouldImprove} marker="•" />
          </Section>
        )}
        {optionalPolish.length > 0 && (
          <Section title="Optional polish">
            <TextList items={optionalPolish} marker="•" />
          </Section>
        )}
      </div>

      {preserve.length > 0 && (
        <Section title="Strengths to preserve">
          <TextList items={preserve} marker="+" />
        </Section>
      )}

      {plan.length > 0 && (
        <Section title="Next take plan">
          <div className="space-y-4 text-sm">
            {plan.map((group, i) => (
              <div key={i}>
                {group.label && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                )}
                <ol className="list-decimal space-y-1.5 pl-5">
                  {group.items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Section>
      )}

      {doNotOverfix.length > 0 && (
        <Section title="Do not over-fix">
          <TextList items={doNotOverfix} marker="•" />
        </Section>
      )}

      {notAssessable.length > 0 && (
        <Section title="Not assessable">
          <TextList items={notAssessable} marker="•" />
        </Section>
      )}
    </div>
  );
}
