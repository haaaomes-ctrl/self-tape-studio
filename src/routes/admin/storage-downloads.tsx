import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/lib/auth";
import {
  canDeletePaths,
  canZipPaths,
  filterAndSortArtifacts,
} from "@/lib/admin-storage-view-model";
import {
  listAllArtifacts,
  signArtifactDownload,
  whoAmIAdmin,
  zipSelectedArtifacts,
  deleteSelectedArtifacts,
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
  const zipSelected = useServerFn(zipSelectedArtifacts);
  const deleteSelected = useServerFn(deleteSelectedArtifacts);

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
          <dt>client.matches</dt>
          <dd>{String(clientEmailMatches)}</dd>
          <dt>server.loading</dt>
          <dd>{String(whoState.loading)}</dd>
          <dt>server.isAdmin</dt>
          <dd>{String(serverIsAdmin)}</dd>
          <dt>server.error</dt>
          <dd>
            {whoState.error
              ? `${whoState.error.status ?? ""} ${whoState.error.message}`
              : "—"}
          </dd>
          <dt>files.count</dt>
          <dd>{filesState.data?.length ?? 0}</dd>
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
          zipSelected={zipSelected}
          deleteSelected={deleteSelected}
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

function FilesUI({ state, reload, downloadOne, zipSelected, deleteSelected, busyPath, bulk }: any) {
  const [sortMode, setSortMode] = useState("newest");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);
  const data = state.data ?? [];
  const sorted = useMemo(() => filterAndSortArtifacts(data, filter, sortMode as any), [data, filter, sortMode]);
  const selectedPaths = sorted.filter((f: ArtifactEntry) => selected[f.path]).map((f: ArtifactEntry) => f.path);
  const selectedSize = sorted.filter((f: ArtifactEntry) => selected[f.path]).reduce((n: number, f: ArtifactEntry) => n + f.size, 0);
  const visibleZipGuard = canZipPaths(sorted.map((f: ArtifactEntry) => f.path));
  const selectedZipGuard = canZipPaths(selectedPaths);
  const deleteGuard = canDeletePaths(selectedPaths);

  return <>
    <div className="mt-6 flex flex-wrap gap-2">
      <Button onClick={reload} variant="outline">Refresh</Button>
      <Button onClick={async ()=>{if(!visibleZipGuard.ok) return; const r=await zipSelected({data:{paths:sorted.map((f:ArtifactEntry)=>f.path)}}); triggerDownload(r.signedUrl, r.filename);}} disabled={!visibleZipGuard.ok}>Download all visible</Button>
      <Button onClick={async ()=>{if(!selectedZipGuard.ok) return; const r=await zipSelected({data:{paths:selectedPaths}}); triggerDownload(r.signedUrl, r.filename);}} disabled={!selectedZipGuard.ok}>Download selected zip</Button>
      <Button
        variant="destructive"
        onClick={async () => {
          if (!deleteGuard.ok) return;
          setDeleteError(null);
          setDeleteSummary(null);
          if (
            !confirm(
              `You are deleting private QA artefact files only. This does not delete the take, report, submission or media.\n\nDelete ${selectedPaths.length} files?\n${selectedPaths.slice(0, 3).join("\n")}`,
            )
          )
            return;
          try {
            const result = await deleteSelected({ data: { paths: selectedPaths } });
            const rows = (result?.results ?? []) as Array<{ ok: boolean }>;
            const failed = rows.filter((r) => !r.ok).length;
            setDeleteSummary(`Deleted ${rows.length - failed} of ${rows.length} selected files.`);
            if (failed > 0) {
              setDeleteError(`Delete failed for ${failed} file(s).`);
            } else {
              await reload();
              setSelected({});
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setDeleteError(`Delete failed: ${message}`);
          }
        }}
        disabled={!deleteGuard.ok}
      >
        Delete selected
      </Button>
      <input className="border rounded px-2 py-1 text-sm" placeholder="Filter take_id / analysis / path / type / ext" value={filter} onChange={(e)=>setFilter(e.target.value)} />
      <select className="border rounded px-2 py-1 text-sm" value={sortMode} onChange={(e)=>setSortMode(e.target.value)}>
        <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name_asc">Path A–Z</option><option value="name_desc">Path Z–A</option><option value="size_asc">Size small→large</option><option value="size_desc">Size large→small</option><option value="type">Artefact type</option><option value="take">take_id</option><option value="analysis">analysis_run_id</option><option value="comparison">comparison_run_id</option>
      </select>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Selected: {selectedPaths.length} · {formatBytes(selectedSize)}</p>
    {!visibleZipGuard.ok ? <p className="text-xs text-amber-600">{visibleZipGuard.reason}</p> : null}
    {selectedPaths.length > 0 && !selectedZipGuard.ok ? <p className="text-xs text-amber-600">Too many selected files to zip at once. Narrow the filter or select up to 500 files.</p> : null}
    {selectedPaths.length > 0 && !deleteGuard.ok ? <p className="text-xs text-amber-600">Too many selected files to delete at once. Select up to 500 files.</p> : null}
    {deleteSummary ? <p className="text-xs text-emerald-700">{deleteSummary}</p> : null}
    {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
    <div className="mt-4 overflow-x-auto rounded-md border border-border">
      {state.loading ? <div className="p-6 text-sm text-muted-foreground">Loading files…</div> : state.error ? <div className="p-6 text-sm text-destructive">Error loading files: {state.error.message}</div> : !sorted.length ? <div className="p-6 text-sm text-muted-foreground">No files found.</div> : <table className="w-full text-sm"><thead className="bg-muted"><tr><th className="px-2"><input type="checkbox" checked={sorted.length>0 && selectedPaths.length===sorted.length} onChange={(e)=>setSelected(e.target.checked?Object.fromEntries(sorted.map((f:ArtifactEntry)=>[f.path,true])):{})} /></th><th>Path</th><th>Display</th><th>Type</th><th>take_id</th><th>analysis_run_id</th><th>comparison_run_id</th><th>Size</th><th>Last modified</th><th>Content-Type</th><th/></tr></thead><tbody>{sorted.map((f:ArtifactEntry)=><tr key={f.path} className="border-t"><td className="px-2"><input type="checkbox" checked={!!selected[f.path]} onChange={(e)=>setSelected((s:any)=>({...s,[f.path]:e.target.checked}))}/></td><td className="font-mono text-xs">{f.path}</td><td>{f.displayName}</td><td>{f.artifactType}</td><td>{f.takeId??"—"}</td><td>{f.analysisRunId??"—"}</td><td>{f.comparisonRunId??"—"}</td><td>{formatBytes(f.size)}</td><td>{f.lastModified?new Date(f.lastModified).toLocaleString():"—"}</td><td>{f.contentType??"—"}</td><td className="space-x-2"><Button size="sm" variant="outline" onClick={()=>downloadOne(f)} disabled={busyPath===f.path||bulk.running}>Download</Button><Button size="sm" variant="destructive" onClick={async()=>{ if(!confirm(`You are deleting private QA artefact files only. This does not delete the take, report, submission or media.\n\nDelete 1 file?\n${f.path}`)) return; await deleteSelected({data:{paths:[f.path]}}); await reload();}}>Delete</Button></td></tr>)}</tbody></table>}
    </div>
  </>
}
