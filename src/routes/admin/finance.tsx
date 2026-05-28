import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth, signOut } from "@/lib/auth";
import { getAdminFinanceDashboard } from "@/lib/admin-finance.functions";
import { whoAmIAdmin } from "@/lib/admin-storage.functions";
import type {
  CfoDashboardSnapshot,
  CfoMonthlyBurnRow,
  CfoPaidCreditLiabilityRow,
  CfoReportCostByReportRow,
} from "@/server/cfo-dashboard.server";

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
      <h1 className="font-display text-2xl font-bold text-foreground">
        CFO finance dashboard error
      </h1>
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

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [{ title: "Admin Finance Dashboard" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminFinancePage,
  errorComponent: RouteErrorComponent,
});

function AdminFinancePage() {
  const { user, loading } = useAuth();
  const whoAmI = useServerFn(whoAmIAdmin);
  const financeDashboard = useServerFn(getAdminFinanceDashboard);

  const [whoState, setWhoState] = useState<{
    loading: boolean;
    data: WhoAmI | null;
    error: ServerError;
  }>({ loading: false, data: null, error: null });

  const [dashboardState, setDashboardState] = useState<{
    loading: boolean;
    data: CfoDashboardSnapshot | null;
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
      const data = (await financeDashboard()) as CfoDashboardSnapshot;
      setDashboardState({ loading: false, data, error: null });
    } catch (e) {
      setDashboardState({ loading: false, data: null, error: await toServerError(e) });
    }
  }, [financeDashboard]);

  useEffect(() => {
    if (serverIsAdmin) loadDashboard();
  }, [serverIsAdmin, loadDashboard]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">CFO Finance Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Private admin view for S10.1 revenue, margin, subsidy and burn tracking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/crm">CRM dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/analytics">Analytics dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/storage-downloads">Storage downloads</Link>
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
          <p>You must sign in with the authorised admin account to access finance data.</p>
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
          <p>This account is not authorised for finance dashboards.</p>
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
        <Panel>Loading finance dashboard...</Panel>
      ) : dashboardState.error ? (
        <Panel tone="warn">
          <p>Finance dashboard query failed.</p>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {dashboardState.error.status ?? ""} {dashboardState.error.message}
          </pre>
        </Panel>
      ) : dashboardState.data ? (
        <FinanceDashboard snapshot={dashboardState.data} />
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
  dashboardState: { loading: boolean; data: CfoDashboardSnapshot | null; error: ServerError };
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
        <dt>finance.loading</dt>
        <dd>{String(dashboardState.loading)}</dd>
        <dt>finance.version</dt>
        <dd>{dashboardState.data?.version ?? "-"}</dd>
        <dt>finance.error</dt>
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

function FinanceDashboard({ snapshot }: { snapshot: CfoDashboardSnapshot }) {
  const latestMonth = snapshot.monthly_burn[0] ?? null;
  const paidLiability = useMemo(
    () =>
      snapshot.paid_credit_liability.reduce(
        (total, row) => total + numeric(row.estimated_unused_paid_credit_liability_gbp),
        0,
      ),
    [snapshot.paid_credit_liability],
  );
  const partnerMarginWatchCount = snapshot.partner_margins.filter(
    (row) => row.gross_margin_guardrail_status !== "meets_70_percent_guardrail",
  ).length;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Current month net revenue"
          value={formatGbp(latestMonth?.net_revenue_gbp)}
          detail={formatMonth(latestMonth?.month_start)}
        />
        <Stat
          label="Current month burn"
          value={formatGbp(latestMonth?.total_monthly_burn_gbp)}
          detail={`Fixed ${formatGbp(snapshot.planning.fixed_monthly_burn_gbp)}`}
        />
        <Stat
          label="Break-even gap"
          value={formatGbp(latestMonth?.break_even_gap_gbp)}
          detail={`Reports ${formatInteger(latestMonth?.report_count)}`}
        />
        <Stat
          label="Unused paid credit liability"
          value={formatGbp(paidLiability)}
          detail={`${formatInteger(totalUnusedCredits(snapshot.paid_credit_liability))} credits`}
        />
      </div>

      <Panel>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Revenue Milestones</h2>
            <p className="text-xs text-muted-foreground">
              Current month generated{" "}
              {formatGbp(snapshot.revenue_milestones[0]?.current_month_net_revenue_gbp)}.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Generated {formatDateTime(snapshot.generated_at)}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {snapshot.revenue_milestones.map((row) => (
            <div
              key={row.milestone_gbp ?? "milestone"}
              className="rounded-md border border-border p-3"
            >
              <div className="flex items-center justify-between gap-3 text-sm font-medium">
                <span>{formatGbp(row.milestone_gbp)}</span>
                <span className={row.reached ? "text-emerald-700" : "text-muted-foreground"}>
                  {row.reached ? "Reached" : `${formatGbp(row.remaining_gbp)} left`}
                </span>
              </div>
              <Progress className="mt-3" value={Math.round(numeric(row.progress_rate) * 100)} />
            </div>
          ))}
        </div>
      </Panel>

      <FinanceTable
        title="Monthly Burn"
        rows={snapshot.monthly_burn}
        columns={[
          ["Month", (row: CfoMonthlyBurnRow) => formatMonth(row.month_start)],
          ["Reports", (row) => formatInteger(row.report_count)],
          ["Free", (row) => formatInteger(row.free_report_count)],
          ["Partner", (row) => formatInteger(row.partner_funded_report_count)],
          ["User-paid", (row) => formatInteger(row.user_paid_report_count)],
          ["Revenue", (row) => formatGbp(row.net_revenue_gbp)],
          ["AI cost", (row) => formatGbp(row.ai_variable_cost_gbp)],
          ["Burn", (row) => formatGbp(row.total_monthly_burn_gbp)],
          ["Gap", (row) => formatGbp(row.break_even_gap_gbp)],
        ]}
      />

      <FinanceTable
        title={`Partner Margins (${partnerMarginWatchCount} to watch)`}
        rows={snapshot.partner_margins}
        columns={[
          ["Partner", (row) => row.partner_name ?? "-"],
          ["Type", (row) => row.partner_type ?? "-"],
          ["Reports", (row) => formatInteger(row.partner_funded_report_count)],
          ["Revenue", (row) => formatGbp(row.partner_revenue_gbp)],
          ["Cost", (row) => formatGbp(row.estimated_ai_cost_gbp)],
          ["Margin", (row) => formatGbp(row.gross_margin_gbp)],
          ["Rate", (row) => formatPercent(row.gross_margin_rate)],
          ["Guardrail", (row) => <StatusBadge value={row.gross_margin_guardrail_status} />],
          ["Source", (row) => row.partner_revenue_source ?? "-"],
        ]}
      />

      <FinanceTable
        title="Report Funding"
        rows={snapshot.report_funding}
        columns={[
          ["Month", (row) => formatMonth(row.month_start)],
          ["Bucket", (row) => row.funding_bucket ?? "-"],
          ["Source", (row) => row.credit_source ?? "-"],
          ["Partner", (row) => row.partner_name ?? "-"],
          ["Duration", (row) => row.duration_status ?? "-"],
          ["Reports", (row) => formatInteger(row.report_count)],
          ["Cost", (row) => formatGbp(row.estimated_ai_cost_gbp)],
          ["Excluded", (row) => String(row.commercial_metrics_excluded === true)],
        ]}
      />

      <FinanceTable
        title="Cost by Report"
        rows={snapshot.report_costs_by_report}
        columns={[
          ["Take", (row: CfoReportCostByReportRow) => formatShortId(row.take_id)],
          ["Month", (row) => formatMonth(row.month_start)],
          ["Funding", (row) => row.funding_bucket ?? "-"],
          ["Source", (row) => row.credit_source ?? "-"],
          ["Partner", (row) => row.partner_name ?? "-"],
          ["Cost", (row) => formatGbp(row.estimated_ai_cost_gbp)],
          ["AI calls", (row) => formatInteger(row.ai_call_count)],
          ["Duration", (row) => row.duration_status ?? "-"],
          ["Excluded", (row) => String(row.commercial_metrics_excluded === true)],
        ]}
      />

      <FinanceTable
        title="Free Report Subsidy"
        rows={snapshot.free_report_subsidy}
        columns={[
          ["Month", (row) => formatMonth(row.month_start)],
          ["Source", (row) => row.credit_source ?? "-"],
          ["Duration", (row) => row.duration_status ?? "-"],
          ["Reports", (row) => formatInteger(row.free_report_count)],
          ["Subsidy", (row) => formatGbp(row.estimated_subsidy_cost_gbp)],
          ["Avg cost", (row) => formatGbp(row.average_free_report_cost_gbp)],
        ]}
      />

      <FinanceTable
        title="Revenue Ledger"
        rows={snapshot.revenue_ledger}
        columns={[
          ["Month", (row) => formatMonth(row.month_start)],
          ["Stream", (row) => row.revenue_stream ?? "-"],
          ["Partner", (row) => row.partner_name ?? "-"],
          ["Gross", (row) => formatPence(row.gross_revenue_pence)],
          ["Refunds", (row) => formatPence(row.refunds_or_disputes_pence)],
          ["Net", (row) => formatPence(row.net_revenue_pence)],
          ["Count", (row) => formatInteger(row.transaction_count)],
          ["Source", (row) => row.revenue_source ?? "-"],
        ]}
      />

      <FinanceTable
        title="Unused Paid Credit Liability"
        rows={snapshot.paid_credit_liability}
        columns={[
          ["Product", (row) => row.product_sku ?? "-"],
          ["Grants", (row) => formatInteger(row.paid_credit_grant_count)],
          ["Original credits", (row) => formatInteger(row.original_paid_credits)],
          ["Unused credits", (row) => formatInteger(row.unused_paid_credits)],
          ["Liability", (row) => formatGbp(row.estimated_unused_paid_credit_liability_gbp)],
          ["Pricing", (row) => row.liability_pricing_status ?? "-"],
        ]}
      />

      <FinanceTable
        title="Partner Revenue Sources"
        rows={snapshot.partner_revenue_sources}
        columns={[
          ["Month", (row) => formatMonth(row.revenue_month)],
          ["Partner", (row) => row.partner_name ?? "-"],
          ["Pool", (row) => row.pool_name ?? "-"],
          ["Revenue", (row) => formatGbp(row.partner_revenue_gbp)],
          ["Source", (row) => row.partner_revenue_source ?? "-"],
          ["Package", (row) => row.package_sku ?? "-"],
          ["Credits", (row) => formatInteger(row.total_credits)],
          ["Consumed", (row) => formatInteger(row.consumed_credits)],
        ]}
      />
    </div>
  );
}

function Panel({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      className={
        "rounded-md border p-4 text-sm " +
        (tone === "warn" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card")
      }
    >
      {children}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function FinanceTable<T>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[];
  columns: Array<[string, (row: T) => React.ReactNode]>;
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{formatInteger(rows.length)} rows</span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border border-border">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No rows yet.</div>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                {columns.map(([label]) => (
                  <th key={label} className="px-3 py-2 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-border">
                  {columns.map(([label, render]) => (
                    <td key={label} className="px-3 py-2 align-top">
                      {render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

function StatusBadge({ value }: { value: string | null | undefined }) {
  const label = value ?? "unknown";
  const tone =
    label === "meets_70_percent_guardrail"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : label === "below_70_percent_guardrail"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${tone}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function numeric(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatGbp(value: number | null | undefined): string {
  return `GBP ${numeric(value).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPence(value: number | null | undefined): string {
  return formatGbp(numeric(value) / 100);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatInteger(value: number | null | undefined): string {
  return Math.round(numeric(value)).toLocaleString("en-GB");
}

function formatMonth(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatShortId(value: string | null | undefined): string {
  if (!value) return "-";
  return value.length > 8 ? value.slice(0, 8) : value;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB");
}

function totalUnusedCredits(rows: CfoPaidCreditLiabilityRow[]): number {
  return rows.reduce((total, row) => total + numeric(row.unused_paid_credits), 0);
}
