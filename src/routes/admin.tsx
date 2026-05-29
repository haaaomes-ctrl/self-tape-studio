import { createFileRoute, Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Coins,
  CreditCard,
  FileWarning,
  Handshake,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminOperationsDashboard,
  grantAdminUserCredits,
} from "@/lib/admin-operations.functions";
import { whoAmIAdmin } from "@/lib/admin-storage.functions";
import { signOut, useAuth } from "@/lib/auth";
import { summarizeCoverage } from "@/lib/admin-operations";
import type { AdminOperationsSnapshot } from "@/server/admin-operations.server";

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
      <h1 className="font-display text-2xl font-bold text-foreground">Admin operations error</h1>
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

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Operations Console" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminRouteShell,
  errorComponent: RouteErrorComponent,
});

function AdminRouteShell() {
  const location = useLocation();
  if (location.pathname !== "/admin") return <Outlet />;
  return <AdminOperationsPage />;
}

function AdminOperationsPage() {
  const { user, loading } = useAuth();
  const whoAmI = useServerFn(whoAmIAdmin);
  const operationsDashboard = useServerFn(getAdminOperationsDashboard);

  const [whoState, setWhoState] = useState<{
    loading: boolean;
    data: WhoAmI | null;
    error: ServerError;
  }>({ loading: false, data: null, error: null });

  const [dashboardState, setDashboardState] = useState<{
    loading: boolean;
    data: AdminOperationsSnapshot | null;
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
      const data = (await operationsDashboard()) as AdminOperationsSnapshot;
      setDashboardState({ loading: false, data, error: null });
    } catch (e) {
      setDashboardState({ loading: false, data: null, error: await toServerError(e) });
    }
  }, [operationsDashboard]);

  useEffect(() => {
    if (serverIsAdmin) loadDashboard();
  }, [serverIsAdmin, loadDashboard]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Admin Operations Console
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Private founder/support view for users, credits, partners, reports, payments, consent
            and cost diagnostics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/finance">Finance</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/crm">CRM</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/analytics">Analytics</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/storage-downloads">QA storage</Link>
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
          <p>You must sign in with the authorised admin account to access operations data.</p>
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
          <p>This account is not authorised for operations dashboards.</p>
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
        <Panel>Loading operations dashboard...</Panel>
      ) : dashboardState.error ? (
        <Panel tone="warn">
          <p>Operations dashboard query failed.</p>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {dashboardState.error.status ?? ""} {dashboardState.error.message}
          </pre>
        </Panel>
      ) : dashboardState.data ? (
        <OperationsDashboard snapshot={dashboardState.data} onRefresh={loadDashboard} />
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
  dashboardState: {
    loading: boolean;
    data: AdminOperationsSnapshot | null;
    error: ServerError;
  };
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
        <dt>operations.loading</dt>
        <dd>{String(dashboardState.loading)}</dd>
        <dt>operations.version</dt>
        <dd>{dashboardState.data?.version ?? "-"}</dd>
        <dt>operations.error</dt>
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

function OperationsDashboard({
  snapshot,
  onRefresh,
}: {
  snapshot: AdminOperationsSnapshot;
  onRefresh: () => Promise<void>;
}) {
  const coverage = useMemo(() => summarizeCoverage(snapshot.coverage), [snapshot.coverage]);
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Stat icon={<Users className="h-4 w-4" />} label="Users" value={snapshot.counts.users} />
        <Stat
          icon={<Coins className="h-4 w-4" />}
          label="Credit entries"
          value={snapshot.counts.credit_history}
        />
        <Stat
          icon={<Handshake className="h-4 w-4" />}
          label="Partner pools"
          value={snapshot.counts.partner_pools}
        />
        <Stat
          icon={<FileWarning className="h-4 w-4" />}
          label="Report failures"
          value={snapshot.counts.failures}
        />
        <Stat
          icon={<CreditCard className="h-4 w-4" />}
          label="Payments"
          value={snapshot.counts.payment_events}
        />
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Operations coverage</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(snapshot.coverage).map(([section, ready]) => (
            <span
              key={section}
              className={`rounded-sm border px-2 py-1 text-xs font-medium ${
                ready
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {section.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        {!coverage.ready ? (
          <p className="mt-3 text-sm text-destructive">Missing: {coverage.missing.join(", ")}</p>
        ) : null}
      </div>

      <CreditAdjustmentPanel onRefresh={onRefresh} />

      <DataTable
        title="Users and credits"
        rows={snapshot.users}
        columns={[
          ["User", (row) => row.email ?? shortId(row.user_id)],
          ["Available", (row) => formatInteger(row.total_remaining_credits)],
          ["Active grants", (row) => formatInteger(row.active_credit_grants)],
          ["Lifetime delta", (row) => formatInteger(row.lifetime_credit_delta)],
          ["Memberships", (row) => formatInteger(row.partner_memberships)],
          ["Latest report", (row) => row.latest_report_status ?? "-"],
          ["Failure", (row) => row.latest_report_failure_reason ?? "-"],
          ["Consent", (row) => (row.consent_recorded ? consentLabel(row.marketing_consent) : "-")],
        ]}
      />

      <DataTable
        title="Report status and cost estimates"
        rows={snapshot.reports}
        columns={[
          ["Take", (row) => shortId(row.take_id)],
          ["User", (row) => shortId(row.user_id)],
          ["Take slot", (row) => formatInteger(row.take_number)],
          ["Status", (row) => row.status],
          ["Phase", (row) => row.processing_phase],
          ["Credit", (row) => row.credit_lifecycle_status ?? row.reservation_status ?? "-"],
          ["Failure", (row) => row.failure_reason ?? "-"],
          ["Score", (row) => formatNullableNumber(row.overall_score)],
          ["Cost", (row) => formatUsd(row.estimated_cost_usd)],
        ]}
      />

      <DataTable
        title="Partner pools"
        rows={snapshot.partner_pools}
        columns={[
          ["Partner", (row) => row.partner_name ?? shortId(row.partner_id)],
          ["Type", (row) => row.partner_type ?? "-"],
          ["Pool", (row) => row.name],
          ["Status", (row) => row.status],
          ["Total", (row) => formatInteger(row.total_credits)],
          ["Allocated", (row) => formatInteger(row.allocated_credits)],
          ["Consumed", (row) => formatInteger(row.consumed_credits)],
          ["Remaining", (row) => formatInteger(row.remaining_pool_credits)],
          ["Usage", (row) => `${row.usage_percent}%`],
        ]}
      />

      <DataTable
        title="Partner memberships"
        rows={snapshot.partner_memberships}
        columns={[
          ["Membership", (row) => shortId(row.id)],
          ["User", (row) => shortId(row.user_id)],
          ["Partner", (row) => row.partner_name ?? shortId(row.partner_id)],
          ["Type", (row) => row.partner_type],
          ["Status", (row) => row.status],
          ["Allowance", (row) => formatInteger(row.allowance_credits)],
          ["Remaining", (row) => formatNullableNumber(row.remaining_credits)],
          ["Source", (row) => row.credit_source],
        ]}
      />

      <DataTable
        title="Credit history"
        rows={snapshot.credit_history}
        columns={[
          ["Entry", (row) => shortId(row.id)],
          ["User", (row) => shortId(row.user_id)],
          ["Type", (row) => row.entry_type],
          ["Source", (row) => row.source],
          ["Delta", (row) => formatInteger(row.credit_delta)],
          ["Take", (row) => shortId(row.take_id)],
          ["Reason", (row) => row.admin_reason ?? "-"],
          ["Created", (row) => formatDate(row.created_at)],
        ]}
      />

      <DataTable
        title="Payment events"
        rows={snapshot.payments}
        columns={[
          ["Payment", (row) => shortId(row.id)],
          ["User", (row) => shortId(row.user_id)],
          ["Product", (row) => row.product_sku],
          ["Credits", (row) => formatInteger(row.credit_amount)],
          ["Amount", (row) => formatPence(row.amount_total_pence, row.currency)],
          ["Status", (row) => row.status],
          ["Failure", (row) => row.failure_code ?? "-"],
          ["Updated", (row) => formatDate(row.updated_at)],
        ]}
      />

      <DataTable
        title="Consent records"
        rows={snapshot.consent_records}
        columns={[
          ["User", (row) => shortId(row.user_id)],
          ["Route", (row) => row.account_route],
          ["Type", (row) => row.account_type],
          ["Age band", (row) => row.age_band_declaration],
          ["Parent managed", (row) => String(row.parent_managed)],
          ["Terms", (row) => `${row.terms_version} ${formatDate(row.terms_accepted_at)}`],
          ["Privacy", (row) => `${row.privacy_version} ${formatDate(row.privacy_accepted_at)}`],
          ["AI disclaimer", (row) => row.ai_disclaimer_version],
          ["Marketing", (row) => consentLabel(row.marketing_consent)],
        ]}
      />

      <DataTable
        title="Admin audit log"
        rows={snapshot.audit_log}
        columns={[
          ["Action", (row) => row.action_type],
          ["Actor", (row) => row.actor_email ?? shortId(row.actor_user_id)],
          ["Target", (row) => `${row.target_type}:${shortId(row.target_id)}`],
          ["Reason", (row) => row.reason ?? "-"],
          ["Created", (row) => formatDate(row.created_at)],
        ]}
      />
    </div>
  );
}

function CreditAdjustmentPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const grantCredits = useServerFn(grantAdminUserCredits);
  const [userId, setUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Admin credit adjustment");
  const [status, setStatus] = useState<{ tone: "ok" | "warn"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const result = await grantCredits({
        data: {
          user_id: userId.trim(),
          credit_amount: Number(creditAmount),
          admin_reason: reason.trim(),
          source_label: sourceLabel.trim() || null,
          idempotency_key: `admin-credit:${userId.trim()}:${Date.now()}`,
        },
      });
      setStatus({
        tone: "ok",
        message: `Granted credits. Grant ${shortId(result.credit_grant_id)}, audit ${shortId(
          result.audit_log_id,
        )}.`,
      });
      setReason("");
      await onRefresh();
    } catch (error) {
      const serverError = await toServerError(error);
      setStatus({
        tone: "warn",
        message: serverError?.message ?? "Credit adjustment failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="font-display text-lg font-bold text-foreground">Add admin credits</h2>
      <form className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.5fr_1fr_auto]" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="admin-credit-user">User ID</Label>
          <Input
            id="admin-credit-user"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            required
          />
        </div>
        <div>
          <Label htmlFor="admin-credit-amount">Credits</Label>
          <Input
            id="admin-credit-amount"
            min={1}
            max={1000}
            type="number"
            value={creditAmount}
            onChange={(event) => setCreditAmount(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="admin-credit-label">Source label</Label>
          <Input
            id="admin-credit-label"
            value={sourceLabel}
            onChange={(event) => setSourceLabel(event.target.value)}
            maxLength={120}
          />
        </div>
        <div className="flex items-end">
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Grant"}
          </Button>
        </div>
        <div className="lg:col-span-4">
          <Label htmlFor="admin-credit-reason">Reason</Label>
          <Textarea
            id="admin-credit-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={12}
            maxLength={500}
            required
          />
        </div>
      </form>
      {status ? (
        <p
          className={`mt-3 rounded-md border p-3 text-sm ${
            status.tone === "ok"
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {status.message}
        </p>
      ) : null}
    </section>
  );
}

function DataTable<T>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[];
  columns: Array<[string, (row: T) => string]>;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        <span className="text-xs font-medium text-muted-foreground">{rows.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed text-left text-sm">
          <thead className="bg-secondary/45 text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map(([label]) => (
                <th key={label} className="w-40 px-4 py-2 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted-foreground" colSpan={columns.length}>
                  No rows.
                </td>
              </tr>
            ) : (
              rows.slice(0, 30).map((row, index) => (
                <tr key={index} className="align-top">
                  {columns.map(([label, render]) => (
                    <td key={label} className="px-4 py-3">
                      <span className="line-clamp-3 break-words">{render(row)}</span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Panel({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" }) {
  return (
    <div
      className={`mt-6 rounded-md border p-4 text-sm ${
        tone === "warn"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-card"
      }`}
    >
      {children}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-foreground">{formatInteger(value)}</p>
    </div>
  );
}

function shortId(value: string | null | undefined): string {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function formatNullableNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
}

function formatUsd(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function formatPence(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value / 100);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function consentLabel(value: boolean | null): string {
  if (value === null) return "not recorded";
  return value ? "marketing yes" : "marketing no";
}
