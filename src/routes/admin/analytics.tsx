import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth, signOut } from "@/lib/auth";
import { getAdminAnalyticsDashboard } from "@/lib/admin-analytics.functions";
import { whoAmIAdmin } from "@/lib/admin-storage.functions";
import type {
  AnalyticsAttributionRow,
  AnalyticsB2BLeadRow,
  AnalyticsDashboardSnapshot,
  AnalyticsFunnelRow,
  AnalyticsHabitRow,
  AnalyticsReportCompletionRow,
} from "@/server/analytics-dashboard.server";

type WhoAmI = {
  claimsEmail: string | null;
  normalizedEmail: string;
  isAdmin: boolean;
};

type ServerError = { status: number | null; message: string } | null;

async function toServerError(e: unknown): Promise<ServerError> {
  if (e instanceof Response) {
    const text = await e.text().catch(() => e.statusText);
    return { status: e.status, message: text || e.statusText };
  }
  if (e instanceof Error) return { status: null, message: e.message };
  return { status: null, message: String(e) };
}

function RouteErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const status = (error as unknown as { status?: number }).status;
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-2xl font-bold text-foreground">Analytics dashboard error</h1>
      <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-1 rounded-md border border-border bg-card p-4 font-mono text-xs">
        <dt>name</dt>
        <dd>{error?.name ?? "Error"}</dd>
        <dt>status</dt>
        <dd>{status ?? "-"}</dd>
        <dt>message</dt>
        <dd className="break-all">{error?.message ?? String(error)}</dd>
      </dl>
      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [{ title: "Admin Analytics Dashboard" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminAnalyticsPage,
  errorComponent: RouteErrorComponent,
});

function AdminAnalyticsPage() {
  const { user, loading } = useAuth();
  const whoAmI = useServerFn(whoAmIAdmin);
  const analyticsDashboard = useServerFn(getAdminAnalyticsDashboard);

  const [whoState, setWhoState] = useState<{
    loading: boolean;
    data: WhoAmI | null;
    error: ServerError;
  }>({ loading: false, data: null, error: null });

  const [dashboardState, setDashboardState] = useState<{
    loading: boolean;
    data: AnalyticsDashboardSnapshot | null;
    error: ServerError;
  }>({ loading: false, data: null, error: null });

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    setWhoState({ loading: true, data: null, error: null });
    whoAmI()
      .then((data) => {
        if (cancelled) return;
        setWhoState({ loading: false, data: data as WhoAmI, error: null });
      })
      .catch(async (e) => {
        if (cancelled) return;
        setWhoState({ loading: false, data: null, error: await toServerError(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, whoAmI]);

  const serverIsAdmin = whoState.data?.isAdmin === true;

  const loadDashboard = useCallback(async () => {
    setDashboardState({ loading: true, data: null, error: null });
    try {
      const data = (await analyticsDashboard()) as AnalyticsDashboardSnapshot;
      setDashboardState({ loading: false, data, error: null });
    } catch (e) {
      setDashboardState({ loading: false, data: null, error: await toServerError(e) });
    }
  }, [analyticsDashboard]);

  useEffect(() => {
    if (serverIsAdmin) loadDashboard();
  }, [serverIsAdmin, loadDashboard]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Analytics & Habit Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Private admin view for S10.1 funnel attribution, report completion and repeat-use
            signals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin">Operations</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/crm">CRM dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/finance">Finance dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/launch-governance">Launch gates</Link>
          </Button>
          {serverIsAdmin ? (
            <Button onClick={loadDashboard} disabled={dashboardState.loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          ) : null}
        </div>
      </div>

      <Diagnostics
        loading={loading}
        hasUser={Boolean(user)}
        whoState={whoState}
        dashboardState={dashboardState}
      />

      {loading ? (
        <Panel>Checking your app login session...</Panel>
      ) : !user ? (
        <Panel>
          <p>You must sign in with the authorised admin account to access analytics data.</p>
          <div className="mt-4">
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </Panel>
      ) : whoState.loading ? (
        <Panel>Verifying admin access with the server...</Panel>
      ) : whoState.error ? (
        <Panel tone="warn">
          <p>Server could not verify admin access.</p>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {whoState.error.status ?? ""} {whoState.error.message}
          </pre>
        </Panel>
      ) : !serverIsAdmin ? (
        <Panel tone="warn">
          <p>This account is not authorised for analytics dashboards.</p>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </Panel>
      ) : dashboardState.loading ? (
        <Panel>Loading analytics dashboard...</Panel>
      ) : dashboardState.error ? (
        <Panel tone="warn">
          <p>Analytics dashboard query failed.</p>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {dashboardState.error.status ?? ""} {dashboardState.error.message}
          </pre>
        </Panel>
      ) : dashboardState.data ? (
        <AnalyticsDashboard snapshot={dashboardState.data} />
      ) : null}
    </div>
  );
}

function Diagnostics({
  loading,
  hasUser,
  whoState,
  dashboardState,
}: {
  loading: boolean;
  hasUser: boolean;
  whoState: { loading: boolean; data: WhoAmI | null; error: ServerError };
  dashboardState: { loading: boolean; data: AnalyticsDashboardSnapshot | null; error: ServerError };
}) {
  return (
    <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
      <div className="mb-2 font-semibold">Diagnostics</div>
      <dl className="grid gap-y-1 font-mono text-xs sm:grid-cols-[220px_1fr]">
        <dt>pathname</dt>
        <dd>
          <ClientPathname />
        </dd>
        <dt>client.loading</dt>
        <dd>{String(loading)}</dd>
        <dt>client.hasSession</dt>
        <dd>{String(hasUser)}</dd>
        <dt>server.loading</dt>
        <dd>{String(whoState.loading)}</dd>
        <dt>server.isAdmin</dt>
        <dd>{String(whoState.data?.isAdmin === true)}</dd>
        <dt>analytics.loading</dt>
        <dd>{String(dashboardState.loading)}</dd>
        <dt>analytics.version</dt>
        <dd>{dashboardState.data?.version ?? "-"}</dd>
        <dt>analytics.error</dt>
        <dd>
          {dashboardState.error
            ? `${dashboardState.error.status ?? ""} ${dashboardState.error.message}`
            : "-"}
        </dd>
      </dl>
    </div>
  );
}

function ClientPathname() {
  const [pathname, setPathname] = useState("(ssr)");
  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);
  return pathname;
}

function AnalyticsDashboard({ snapshot }: { snapshot: AnalyticsDashboardSnapshot }) {
  const latestReportMonth = snapshot.report_completion[0] ?? null;
  const latestHabitCohort = snapshot.habit[0] ?? null;
  const totals = useMemo(
    () => ({
      signups: sum(snapshot.attribution, (row) => row.signup_count),
      uploads: sum(snapshot.attribution, (row) => row.upload_count),
      reports: sum(snapshot.report_completion, (row) => row.report_completed_count),
      b2bLeads: sum(snapshot.b2b_leads, (row) => row.lead_count),
    }),
    [snapshot],
  );

  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Signups"
          value={formatInteger(totals.signups)}
          detail="Consent-attributed signup events"
        />
        <Metric label="Uploads" value={formatInteger(totals.uploads)} detail="Tracked uploads" />
        <Metric
          label="Completed reports"
          value={formatInteger(totals.reports)}
          detail={formatMonth(latestReportMonth?.month_start)}
        />
        <Metric
          label="B2B leads"
          value={formatInteger(totals.b2bLeads)}
          detail="Consent-attributed lead events"
        />
      </div>

      <div className="rounded-md border border-border bg-card p-4 text-sm">
        <div className="font-semibold">Consent model</div>
        <dl className="mt-3 grid gap-y-1 font-mono text-xs sm:grid-cols-[260px_1fr]">
          <dt>non-essential browser analytics</dt>
          <dd>{snapshot.consent_model.non_essential_browser_analytics}</dd>
          <dt>essential product events</dt>
          <dd>{snapshot.consent_model.essential_product_events}</dd>
          <dt>third-party analytics</dt>
          <dd>{snapshot.consent_model.third_party_analytics}</dd>
        </dl>
      </div>

      <DataTable
        title="Report Completion"
        rows={snapshot.report_completion}
        empty="No report completion rows yet."
        columns={[
          ["Month", (row: AnalyticsReportCompletionRow) => formatMonth(row.month_start)],
          ["Started", (row) => formatInteger(row.report_started_count)],
          ["Completed", (row) => formatInteger(row.report_completed_count)],
          ["Viewed", (row) => formatInteger(row.report_viewed_count)],
          ["Completion rate", (row) => formatPercent(row.report_completion_rate)],
        ]}
      />

      <DataTable
        title="Habit Cohorts"
        rows={snapshot.habit}
        empty="No habit rows yet."
        columns={[
          ["Cohort", (row: AnalyticsHabitRow) => formatMonth(row.cohort_month)],
          ["Users", (row) => formatInteger(row.users_with_auditions_count)],
          [">1 audition", (row) => formatInteger(row.users_with_more_than_one_audition_count)],
          ["Return 7d", (row) => formatInteger(row.users_returned_after_7_days_count)],
          ["Return 30d", (row) => formatInteger(row.users_returned_after_30_days_count)],
          ["Reports", (row) => formatInteger(row.completed_report_count)],
        ]}
      />

      <DataTable
        title="Attribution"
        rows={snapshot.attribution}
        empty="No attribution rows yet."
        columns={[
          ["Source", (row: AnalyticsAttributionRow) => row.attribution_source ?? "-"],
          ["Campaign", (row) => row.utm_campaign ?? "-"],
          ["Creator", (row) => row.creator_code ?? "-"],
          ["Partner", (row) => row.partner_code_hint ?? "-"],
          ["Signups", (row) => formatInteger(row.signup_count)],
          ["Uploads", (row) => formatInteger(row.upload_count)],
          ["Reports", (row) => formatInteger(row.report_completed_count)],
          ["Purchases", (row) => formatInteger(row.purchase_started_count)],
        ]}
      />

      <DataTable
        title="Funnel Events"
        rows={snapshot.funnel}
        empty="No funnel rows yet."
        columns={[
          ["Day", (row: AnalyticsFunnelRow) => formatDate(row.event_day)],
          ["Event", (row) => row.event_name ?? "-"],
          ["Source", (row) => row.attribution_source ?? "-"],
          ["Campaign", (row) => row.utm_campaign ?? "-"],
          ["Events", (row) => formatInteger(row.event_count)],
          ["Users", (row) => formatInteger(row.distinct_user_count)],
        ]}
      />

      <DataTable
        title="B2B Leads"
        rows={snapshot.b2b_leads}
        empty="No B2B lead rows yet."
        columns={[
          ["Day", (row: AnalyticsB2BLeadRow) => formatDate(row.lead_day)],
          ["Lead type", (row) => row.lead_type ?? "-"],
          ["Source", (row) => row.attribution_source ?? "-"],
          ["Campaign", (row) => row.utm_campaign ?? "-"],
          ["Leads", (row) => formatInteger(row.lead_count)],
          ["Users", (row) => formatInteger(row.distinct_user_count)],
        ]}
      />

      {latestHabitCohort ? (
        <p className="text-xs text-muted-foreground">
          Latest habit cohort: {formatMonth(latestHabitCohort.cohort_month)}.
        </p>
      ) : null}
    </div>
  );
}

function Panel({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={`mt-6 rounded-md border p-5 text-sm ${
        tone === "warn"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {children}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function DataTable<T>({
  title,
  rows,
  columns,
  empty,
}: {
  title: string;
  rows: T[];
  columns: Array<[string, (row: T) => React.ReactNode]>;
  empty: string;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                {columns.map(([label]) => (
                  <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {columns.map(([label, render]) => (
                    <td key={label} className="whitespace-nowrap px-4 py-3">
                      {render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function sum<T>(rows: T[], select: (row: T) => number | null | undefined): number {
  return rows.reduce((total, row) => total + (select(row) ?? 0), 0);
}

function formatInteger(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "0";
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}
