import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/lib/auth";
import {
  listAllArtifacts,
  signArtifactDownload,
  whoAmIAdmin,
  type ArtifactEntry,
} from "@/lib/admin-storage.functions";

const ADMIN_EMAIL = "o.halawi90@gmail.com";

function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

function RouteErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const status = (error as unknown as { status?: number }).status;
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Storage downloads — error
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something failed inside the admin storage page. Details below.
      </p>
      <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-1 rounded-md border border-border bg-card p-4 font-mono text-xs">
        <dt>name</dt>
        <dd>{error?.name ?? "Error"}</dd>
        <dt>status</dt>
        <dd>{status ?? "—"}</dd>
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
          Retry
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin/storage-downloads")({
  head: () => ({
    meta: [
      { title: "Admin Storage Downloads" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StorageDownloadsPage,
  errorComponent: RouteErrorComponent,
});

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type WhoAmI = {
  claimsEmail: string | null;
  normalizedEmail: string;
  expectedEmail: string;
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

function StorageDownloadsPage() {
  const { user, loading } = useAuth();
  const list = useServerFn(listAllArtifacts);
  const sign = useServerFn(signArtifactDownload);
  const whoAmI = useServerFn(whoAmIAdmin);

  const clientEmail = user?.email ?? null;
  const clientNormalized = normalizeEmail(clientEmail);
  const clientEmailMatches = clientNormalized === ADMIN_EMAIL;

  const [whoState, setWhoState] = useState<{
    loading: boolean;
    data: WhoAmI | null;
    error: ServerError;
  }>({ loading: false, data: null, error: null });

  const [filesState, setFilesState] = useState<{
    loading: boolean;
    data: ArtifactEntry[] | null;
    error: ServerError;
  }>({ loading: false, data: null, error: null });

  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{
    running: boolean;
    done: number;
    total: number;
    current: string | null;
    failed: { path: string; error: string }[];
  }>({ running: false, done: 0, total: 0, current: null, failed: [] });

  // Verify admin server-side only when client is signed in as the expected email.
  useEffect(() => {
    if (loading || !user || !clientEmailMatches) return;
    let cancelled = false;
    setWhoState({ loading: true, data: null, error: null });
    whoAmI()
      .then(async (data) => {
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
  }, [loading, user, clientEmailMatches, whoAmI]);

  const serverIsAdmin = whoState.data?.isAdmin === true;

  const loadFiles = useCallback(async () => {
    setFilesState({ loading: true, data: null, error: null });
    try {
      const data = (await list()) as ArtifactEntry[];
      setFilesState({ loading: false, data, error: null });
    } catch (e) {
      setFilesState({ loading: false, data: null, error: await toServerError(e) });
    }
  }, [list]);

  useEffect(() => {
    if (serverIsAdmin) loadFiles();
  }, [serverIsAdmin, loadFiles]);

  async function downloadOne(entry: ArtifactEntry) {
    setBusyPath(entry.path);
    try {
      const { signedUrl } = await sign({ data: { path: entry.path } });
      triggerDownload(signedUrl, entry.path.split("/").pop() || "download");
    } catch (e) {
      const err = await toServerError(e);
      alert(`Download failed: ${err?.message ?? "unknown"}`);
    } finally {
      setBusyPath(null);
    }
  }

  async function downloadAll() {
    const data = filesState.data;
    if (!data || data.length === 0) return;
    setBulk({ running: true, done: 0, total: data.length, current: null, failed: [] });
    const failed: { path: string; error: string }[] = [];
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      setBulk((b) => ({ ...b, current: entry.path, done: i }));
      try {
        const { signedUrl } = await sign({ data: { path: entry.path } });
        triggerDownload(signedUrl, entry.path.split("/").pop() || "download");
      } catch (e) {
        const err = await toServerError(e);
        failed.push({ path: entry.path, error: err?.message ?? "unknown" });
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    setBulk({
      running: false,
      done: data.length,
      total: data.length,
      current: null,
      failed,
    });
  }

  // ---- Render ----

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground">
        Admin Storage Downloads
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Private bucket: <code>qa-artifacts</code>. Signed URLs expire in 1 hour.
      </p>

      {/* Diagnostics */}
      <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
        <div className="font-semibold mb-2">Diagnostics</div>
        <dl className="grid grid-cols-[220px_1fr] gap-y-1 font-mono text-xs">
          <dt>pathname</dt>
          <dd>{typeof window !== "undefined" ? window.location.pathname : "(ssr)"}</dd>
          <dt>client.loading</dt>
          <dd>{String(loading)}</dd>
          <dt>client.hasSession</dt>
          <dd>{String(!!user)}</dd>
          <dt>client.rawEmail</dt>
          <dd>{JSON.stringify(clientEmail)}</dd>
          <dt>client.normalizedEmail</dt>
          <dd>{JSON.stringify(clientNormalized)}</dd>
          <dt>expectedAdminEmail</dt>
          <dd>{JSON.stringify(ADMIN_EMAIL)}</dd>
          <dt>client.matches</dt>
          <dd>{String(clientEmailMatches)}</dd>
          <dt>server.loading</dt>
          <dd>{String(whoState.loading)}</dd>
          <dt>server.claimsEmail</dt>
          <dd>{JSON.stringify(whoState.data?.claimsEmail ?? null)}</dd>
          <dt>server.normalizedEmail</dt>
          <dd>{JSON.stringify(whoState.data?.normalizedEmail ?? null)}</dd>
          <dt>server.isAdmin</dt>
          <dd>{String(serverIsAdmin)}</dd>
          <dt>server.error</dt>
          <dd>
            {whoState.error
              ? `${whoState.error.status ?? ""} ${whoState.error.message}`
              : "—"}
          </dd>
          <dt>files.error</dt>
          <dd>
            {filesState.error
              ? `${filesState.error.status ?? ""} ${filesState.error.message}`
              : "—"}
          </dd>
        </dl>
      </div>

      {/* State machine */}
      {loading ? (
        <Panel>Checking your app login session…</Panel>
      ) : !user ? (
        <Panel>
          <p>
            You must sign in to the app as <code>{ADMIN_EMAIL}</code> to access
            storage downloads.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link to="/login">Sign in to continue</Link>
            </Button>
          </div>
        </Panel>
      ) : !clientEmailMatches ? (
        <Panel tone="warn">
          <p>This account is not authorized for storage downloads.</p>
          <ul className="mt-2 font-mono text-xs">
            <li>current: {clientEmail ?? "(none)"}</li>
            <li>normalized: {clientNormalized || "(none)"}</li>
            <li>expected: {ADMIN_EMAIL}</li>
          </ul>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </Panel>
      ) : whoState.loading ? (
        <Panel>Verifying admin access with the server…</Panel>
      ) : whoState.error ? (
        <Panel tone="warn">
          <p>Server could not verify admin access.</p>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {whoState.error.status ?? ""} {whoState.error.message}
          </pre>
        </Panel>
      ) : !serverIsAdmin ? (
        <Panel tone="warn">
          <p>Server rejected admin access.</p>
          <ul className="mt-2 font-mono text-xs">
            <li>server email: {whoState.data?.claimsEmail ?? "(none)"}</li>
            <li>server normalized: {whoState.data?.normalizedEmail ?? "(none)"}</li>
            <li>expected: {ADMIN_EMAIL}</li>
          </ul>
        </Panel>
      ) : (
        <FilesUI
          state={filesState}
          reload={loadFiles}
          downloadOne={downloadOne}
          downloadAll={downloadAll}
          busyPath={busyPath}
          bulk={bulk}
        />
      )}
    </div>
  );
}

function Panel({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn";
}) {
  return (
    <div
      className={
        "mt-6 rounded-md border p-4 text-sm " +
        (tone === "warn"
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card")
      }
    >
      {children}
    </div>
  );
}

function FilesUI({
  state,
  reload,
  downloadOne,
  downloadAll,
  busyPath,
  bulk,
}: {
  state: { loading: boolean; data: ArtifactEntry[] | null; error: ServerError };
  reload: () => void;
  downloadOne: (e: ArtifactEntry) => void;
  downloadAll: () => void;
  busyPath: string | null;
  bulk: {
    running: boolean;
    done: number;
    total: number;
    current: string | null;
    failed: { path: string; error: string }[];
  };
}) {
  const data = state.data;
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "path">("newest");

  const sorted = (() => {
    if (!data) return null;
    const arr = [...data];
    if (sortMode === "path") {
      arr.sort((a, b) => a.path.localeCompare(b.path));
    } else {
      arr.sort((a, b) => {
        const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
        const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
        return sortMode === "newest" ? tb - ta : ta - tb;
      });
    }
    return arr;
  })();

  const grouped = (() => {
    if (!sorted || sortMode === "path") return null;
    const groups = new Map<string, ArtifactEntry[]>();
    for (const f of sorted) {
      const key = f.updated_at
        ? new Date(f.updated_at).toISOString().slice(0, 10)
        : "unknown date";
      const list = groups.get(key) ?? [];
      list.push(f);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  })();

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={reload} variant="outline" disabled={state.loading}>
          Refresh
        </Button>
        <Button
          onClick={downloadAll}
          disabled={!sorted || sorted.length === 0 || bulk.running}
        >
          {bulk.running ? "Downloading…" : "Download all"}
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sort by</span>
          {(["newest", "oldest", "path"] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={sortMode === m ? "default" : "outline"}
              onClick={() => setSortMode(m)}
            >
              {m === "newest" ? "Newest first" : m === "oldest" ? "Oldest first" : "Path A→Z"}
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Your browser may block multiple automatic downloads — allow them when prompted.
      </p>

      {bulk.running || bulk.done > 0 ? (
        <div className="mt-4 rounded-md border border-border bg-card p-4">
          <div className="text-sm">
            {bulk.done} of {bulk.total} downloaded
            {bulk.current ? (
              <>
                {" "}— <span className="font-mono text-xs">{bulk.current}</span>
              </>
            ) : null}
          </div>
          <Progress
            value={bulk.total ? (bulk.done / bulk.total) * 100 : 0}
            className="mt-2"
          />
          {bulk.failed.length > 0 ? (
            <div className="mt-3 text-sm text-destructive">
              <div className="font-semibold">Failed ({bulk.failed.length}):</div>
              <ul className="mt-1 list-disc pl-5">
                {bulk.failed.map((f) => (
                  <li key={f.path} className="font-mono text-xs">
                    {f.path}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-md border border-border">
        {state.loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : state.error ? (
          <div className="p-6 text-sm text-destructive">
            Error: {state.error.status ?? ""} {state.error.message}
          </div>
        ) : !sorted || sorted.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No files found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Modified</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {grouped
                ? grouped.flatMap(([day, files]) => [
                    <tr key={`group-${day}`} className="border-t border-border bg-muted/40">
                      <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                        {day} · {files.length} file{files.length === 1 ? "" : "s"}
                      </td>
                    </tr>,
                    ...files.map((f) => (
                      <tr key={f.path} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">{f.path}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatBytes(f.size)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {f.updated_at ? new Date(f.updated_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadOne(f)}
                            disabled={busyPath === f.path || bulk.running}
                          >
                            {busyPath === f.path ? "…" : "Download"}
                          </Button>
                        </td>
                      </tr>
                    )),
                  ])
                : sorted.map((f) => (
                    <tr key={f.path} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{f.path}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatBytes(f.size)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {f.updated_at ? new Date(f.updated_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadOne(f)}
                          disabled={busyPath === f.path || bulk.running}
                        >
                          {busyPath === f.path ? "…" : "Download"}
                        </Button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
        {sorted ? (
          <div className="border-t border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {sorted.length} file{sorted.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </>
  );
}
