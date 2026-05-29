import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAdminCrmDashboard } from "@/lib/admin-crm.functions";
import { whoAmIAdmin } from "@/lib/admin-storage.functions";
import { signOut, useAuth } from "@/lib/auth";
import type {
  CrmB2BLeadsDashboardRow,
  CrmContactDashboardRow,
  CrmDashboardSnapshot,
  CrmEmailDeliveryDashboardRow,
  CrmLifecycleMessagingDashboardRow,
} from "@/server/crm-messaging.server";

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
      <h1 className="font-display text-2xl font-bold text-foreground">CRM dashboard error</h1>
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

export const Route = createFileRoute("/admin/crm")({
  head: () => ({
    meta: [{ title: "Admin CRM Dashboard" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminCrmPage,
  errorComponent: RouteErrorComponent,
});

function AdminCrmPage() {
  const { user, loading } = useAuth();
  const whoAmI = useServerFn(whoAmIAdmin);
  const crmDashboard = useServerFn(getAdminCrmDashboard);

  const [whoState, setWhoState] = useState<{
    loading: boolean;
    data: WhoAmI | null;
    error: ServerError;
  }>({ loading: false, data: null, error: null });

  const [dashboardState, setDashboardState] = useState<{
    loading: boolean;
    data: CrmDashboardSnapshot | null;
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
      const data = (await crmDashboard()) as CrmDashboardSnapshot;
      setDashboardState({ loading: false, data, error: null });
    } catch (e) {
      setDashboardState({ loading: false, data: null, error: await toServerError(e) });
    }
  }, [crmDashboard]);

  useEffect(() => {
    if (serverIsAdmin) loadDashboard();
  }, [serverIsAdmin, loadDashboard]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">CRM Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Private admin view for S10.1 Brevo contact sync, service messages and lifecycle
            delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin">Operations</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/analytics">Analytics dashboard</Link>
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
          <p>You must sign in with the authorised admin account to access CRM data.</p>
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
          <p>This account is not authorised for CRM dashboards.</p>
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
        <Panel>Loading CRM dashboard...</Panel>
      ) : dashboardState.error ? (
        <Panel tone="warn">
          <p>CRM dashboard query failed.</p>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {dashboardState.error.status ?? ""} {dashboardState.error.message}
          </pre>
        </Panel>
      ) : dashboardState.data ? (
        <CrmDashboard snapshot={dashboardState.data} />
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
  dashboardState: { loading: boolean; data: CrmDashboardSnapshot | null; error: ServerError };
}) {
  return (
    <dl className="my-5 grid gap-3 rounded-md border border-border bg-card p-4 text-xs text-muted-foreground sm:grid-cols-4">
      <div>
        <dt className="font-medium text-foreground">Client session</dt>
        <dd>{loading ? "checking" : hasUser ? "signed in" : "signed out"}</dd>
      </div>
      <div>
        <dt className="font-medium text-foreground">Server admin</dt>
        <dd>{whoState.loading ? "checking" : whoState.data?.isAdmin ? "yes" : "no"}</dd>
      </div>
      <div>
        <dt className="font-medium text-foreground">CRM data</dt>
        <dd>
          {dashboardState.loading ? "loading" : dashboardState.data ? "loaded" : "not loaded"}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-foreground">Build</dt>
        <dd>{dashboardState.data?.version ?? "unknown"}</dd>
      </div>
    </dl>
  );
}

function CrmDashboard({ snapshot }: { snapshot: CrmDashboardSnapshot }) {
  const totals = useMemo(
    () => ({
      contacts: sum(snapshot.contacts, (row) => row.contact_count),
      sent: sum(snapshot.email_delivery, (row) => row.sent_count),
      suppressed: sum(snapshot.email_delivery, (row) => row.suppressed_count),
      b2bLeads: sum(snapshot.b2b_leads, (row) => row.lead_count),
    }),
    [snapshot],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="CRM contacts" value={formatInteger(totals.contacts)} />
        <Stat label="Sent CRM emails" value={formatInteger(totals.sent)} />
        <Stat label="Suppressed" value={formatInteger(totals.suppressed)} />
        <Stat label="B2B leads" value={formatInteger(totals.b2bLeads)} />
      </section>

      <Panel>
        <h2 className="font-display text-lg font-semibold text-foreground">Delivery model</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <Definition label="Contact sync" value={snapshot.platform.contact_sync} />
          <Definition label="Dispatcher" value={snapshot.platform.transactional_dispatch} />
          <Definition label="Service consent" value={snapshot.platform.service_email_consent} />
          <Definition label="Lifecycle consent" value={snapshot.platform.lifecycle_email_consent} />
          <Definition label="Under-13 routing" value={snapshot.platform.under_13_routing} />
        </dl>
      </Panel>

      <DataTable
        title="Contact segments"
        rows={snapshot.contacts}
        empty="No CRM contacts are synced yet."
        columns={[
          ["Segment", (row) => row.user_segment ?? "-"],
          ["Recipient", (row) => row.recipient_role ?? "-"],
          ["Route", (row) => row.account_route ?? "-"],
          ["Consent", (row) => (row.marketing_consent ? "yes" : "no")],
          ["Brevo", (row) => row.brevo_sync_status ?? "-"],
          ["Contacts", (row) => formatInteger(row.contact_count)],
        ]}
      />

      <DataTable
        title="Email delivery"
        rows={snapshot.email_delivery}
        empty="No CRM email delivery events are logged yet."
        columns={[
          ["Day", (row) => formatDate(row.activity_day)],
          ["Message", (row) => row.message_key ?? "-"],
          ["Category", (row) => row.message_category ?? "-"],
          ["Status", (row) => row.status ?? "-"],
          ["Sent", (row) => formatInteger(row.sent_count)],
          ["Suppressed", (row) => formatInteger(row.suppressed_count)],
          ["Failed/DLQ", (row) => formatInteger((row.failed_count ?? 0) + (row.dlq_count ?? 0))],
        ]}
      />

      <DataTable
        title="Lifecycle messages"
        rows={snapshot.lifecycle_messages}
        empty="No lifecycle messages are logged yet."
        columns={[
          ["Category", (row) => row.message_category ?? "-"],
          ["Message", (row) => row.message_key ?? "-"],
          ["Total", (row) => formatInteger(row.total_count)],
          ["Pending", (row) => formatInteger(row.pending_count)],
          ["Sent", (row) => formatInteger(row.sent_count)],
          ["Suppressed", (row) => formatInteger(row.suppressed_count)],
          ["Last activity", (row) => formatDateTime(row.last_activity_at)],
        ]}
      />

      <DataTable
        title="B2B lead follow-up"
        rows={snapshot.b2b_leads}
        empty="No B2B lead events are logged yet."
        columns={[
          ["Day", (row) => formatDate(row.lead_day)],
          ["Lead type", (row) => row.lead_type ?? "-"],
          ["Source", (row) => row.utm_source ?? row.partner_code_hint ?? "direct_or_unknown"],
          ["Campaign", (row) => row.utm_campaign ?? "-"],
          ["Leads", (row) => formatInteger(row.lead_count)],
          ["Follow-up pending", (row) => formatInteger(row.follow_up_pending_count)],
          ["Follow-up sent", (row) => formatInteger(row.follow_up_sent_count)],
        ]}
      />
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
    <section
      className={`mt-5 rounded-md border p-5 text-sm ${
        tone === "warn"
          ? "border-destructive/40 bg-destructive/5 text-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}

function DataTable<T>({
  title,
  rows,
  empty,
  columns,
}: {
  title: string;
  rows: T[];
  empty: string;
  columns: [string, (row: T) => React.ReactNode][];
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                {columns.map(([label]) => (
                  <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {columns.map(([label, render]) => (
                    <td key={label} className="whitespace-nowrap px-3 py-2">
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

function sum<T>(rows: T[], pick: (row: T) => number | null | undefined): number {
  return rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
}

function formatInteger(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB");
}
