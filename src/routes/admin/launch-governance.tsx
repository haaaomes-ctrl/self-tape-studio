import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, LogOut, Megaphone, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { whoAmIAdmin } from "@/lib/admin-storage.functions";
import { signOut, useAuth } from "@/lib/auth";
import {
  LAUNCH_APPROVAL_WORKFLOWS,
  LAUNCH_GOVERNANCE_VERSION,
  LAUNCH_NON_GOALS,
  LAUNCH_READINESS_GATES,
  LAUNCH_ROLLBACK_CONDITIONS,
  LAUNCH_WEEKLY_REVIEW_TEMPLATE,
  createCompleteLaunchGateRecord,
  evaluateLaunchReadiness,
  type LaunchChannel,
  type LaunchGateCompletion,
  type LaunchGateId,
} from "@/lib/launch-governance";

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
      <h1 className="font-display text-2xl font-bold text-foreground">Launch governance error</h1>
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

export const Route = createFileRoute("/admin/launch-governance")({
  head: () => ({
    meta: [{ title: "Launch Governance" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: LaunchGovernancePage,
  errorComponent: RouteErrorComponent,
});

function LaunchGovernancePage() {
  const { user, loading } = useAuth();
  const whoAmI = useServerFn(whoAmIAdmin);
  const [whoState, setWhoState] = useState<{
    loading: boolean;
    data: WhoAmI | null;
    error: ServerError;
  }>({ loading: false, data: null, error: null });
  const [completed, setCompleted] = useState<LaunchGateCompletion>({});

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
  const evaluation = useMemo(() => evaluateLaunchReadiness(completed), [completed]);

  const setGate = (gateId: LaunchGateId, value: boolean) => {
    setCompleted((current) => ({ ...current, [gateId]: value }));
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Launch Governance</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            S10.1 gates, non-goals, review template and rollback controls for launch decisions.
          </p>
        </div>
        <AdminNav />
      </div>

      <Diagnostics loading={loading} hasUser={Boolean(user)} whoState={whoState} />

      {loading ? (
        <Panel>Checking your app login session...</Panel>
      ) : !user ? (
        <Panel>
          <p>You must sign in with the authorised admin account to access launch governance.</p>
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
          <p>This account is not authorised for launch governance.</p>
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
      ) : (
        <main className="space-y-8 pt-6">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Readiness Controls
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Default state is blocked until a founder/operator confirms every gate.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setCompleted({})}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button onClick={() => setCompleted(createCompleteLaunchGateRecord())}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Mark all confirmed
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <StatusTile
                label="Checklist"
                active={evaluation.checklist_complete}
                activeText="Complete"
                blockedText={`${evaluation.incomplete_gate_ids.length} open`}
              />
              <StatusTile
                label="Paid traffic"
                active={evaluation.paid_traffic_allowed}
                activeText="Allowed"
                blockedText="Blocked"
              />
              <StatusTile
                label="Creator outreach"
                active={evaluation.creator_outreach_allowed}
                activeText="Allowed"
                blockedText="Blocked"
              />
              <StatusTile
                label="B2B pilots"
                active={evaluation.b2b_pilot_allowed}
                activeText="Allowed"
                blockedText="Blocked"
              />
            </div>
          </section>

          <section className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-3">Set</th>
                  <th className="px-4 py-3">Gate</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Blocks</th>
                  <th className="px-4 py-3">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {LAUNCH_READINESS_GATES.map((gate) => (
                  <tr key={gate.id}>
                    <td className="px-4 py-4 align-top">
                      <Checkbox
                        checked={completed[gate.id] === true}
                        onCheckedChange={(checked) => setGate(gate.id, checked === true)}
                        aria-label={`Confirm ${gate.title}`}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-foreground">{gate.title}</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {gate.blocks_when_missing}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top capitalize">{gate.owner}</td>
                    <td className="px-4 py-4 align-top">
                      <ChannelList channels={gate.required_for} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <ul className="space-y-1">
                        {gate.evidence.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {LAUNCH_APPROVAL_WORKFLOWS.map((workflow) => (
              <article key={workflow.id} className="rounded-md border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <Megaphone className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {workflow.title}
                  </h2>
                </div>
                <div className="mt-3">
                  <ChannelList channels={workflow.required_before} />
                </div>
                <ListBlock title="Required evidence" items={workflow.required_evidence} />
                <ListBlock title="Reject if" items={workflow.rejection_conditions} tone="warn" />
              </article>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <article className="rounded-md border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-warning" />
                <h2 className="font-display text-lg font-bold text-foreground">No-goals</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {LAUNCH_NON_GOALS.map((goal) => (
                  <div key={goal.id} className="rounded-md border border-border p-3">
                    <div className="font-semibold text-foreground">{goal.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{goal.reason}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-md border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold text-foreground">
                  Weekly Review Template
                </h2>
              </div>
              <ol className="mt-4 space-y-2 text-sm">
                {LAUNCH_WEEKLY_REVIEW_TEMPLATE.map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </article>
          </section>

          <section className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 text-destructive" />
              <h2 className="font-display text-lg font-bold text-foreground">
                Rollback Conditions
              </h2>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {LAUNCH_ROLLBACK_CONDITIONS.map((condition) => (
                <article key={condition.id} className="rounded-md border border-border p-4">
                  <div className="font-semibold text-foreground">{condition.trigger}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{condition.action}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

function AdminNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link to="/admin">Operations</Link>
      </Button>
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
    </div>
  );
}

function Diagnostics({
  loading,
  hasUser,
  whoState,
}: {
  loading: boolean;
  hasUser: boolean;
  whoState: { loading: boolean; data: WhoAmI | null; error: ServerError };
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
        <dt>governance.version</dt>
        <dd>{LAUNCH_GOVERNANCE_VERSION}</dd>
        <dt>server.error</dt>
        <dd>{whoState.error ? `${whoState.error.status ?? ""} ${whoState.error.message}` : "-"}</dd>
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

function Panel({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      className={
        "mt-6 rounded-md border p-4 text-sm " +
        (tone === "warn" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card")
      }
    >
      {children}
    </div>
  );
}

function StatusTile({
  label,
  active,
  activeText,
  blockedText,
}: {
  label: string;
  active: boolean;
  activeText: string;
  blockedText: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-2">
        <Badge variant={active ? "success" : "warning"}>{active ? activeText : blockedText}</Badge>
      </div>
    </div>
  );
}

function ChannelList({ channels }: { channels: LaunchChannel[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {channels.map((channel) => (
        <Badge key={channel} variant="outline">
          {channel.replaceAll("_", " ")}
        </Badge>
      ))}
    </div>
  );
}

function ListBlock({
  title,
  items,
  tone = "info",
}: {
  title: string;
  items: string[];
  tone?: "info" | "warn";
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className={tone === "warn" ? "text-destructive" : undefined}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
