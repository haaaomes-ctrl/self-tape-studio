import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/admin/storage-downloads")({
  head: () => ({
    meta: [
      { title: "Admin Storage Downloads" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StorageDownloadsPage,
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

type ClientAuthState = {
  loading: boolean;
  hasSession: boolean;
  rawEmail: string | null;
  normalizedEmail: string;
  isAdmin: boolean;
  error: string | null;
};

function useClientAuth(): ClientAuthState {
  const [state, setState] = useState<ClientAuthState>({
    loading: true,
    hasSession: false,
    rawEmail: null,
    normalizedEmail: "",
    isAdmin: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      const email = data?.user?.email ?? null;
      const normalized = normalizeEmail(email);
      setState({
        loading: false,
        hasSession: !!data?.user,
        rawEmail: email,
        normalizedEmail: normalized,
        isAdmin: normalized === ADMIN_EMAIL,
        error: error?.message ?? null,
      });
    };
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

function StorageDownloadsPage() {
  const clientAuth = useClientAuth();
  const list = useServerFn(listAllArtifacts);
  const sign = useServerFn(signArtifactDownload);
  const whoAmI = useServerFn(whoAmIAdmin);

  const whoAmIQ = useQuery({
    queryKey: ["admin", "whoami"],
    queryFn: () => whoAmI(),
    enabled: !clientAuth.loading && clientAuth.hasSession,
    retry: false,
  });

  const serverIsAdmin = whoAmIQ.data?.isAdmin === true;

  const filesQ = useQuery({
    queryKey: ["admin", "qa-artifacts"],
    queryFn: () => list(),
    enabled: serverIsAdmin,
    retry: false,
  });

  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{
    running: boolean;
    done: number;
    total: number;
    current: string | null;
    failed: { path: string; error: string }[];
  }>({ running: false, done: 0, total: 0, current: null, failed: [] });

  async function downloadOne(entry: ArtifactEntry) {
    setBusyPath(entry.path);
    try {
      const { signedUrl } = await sign({ data: { path: entry.path } });
      triggerDownload(signedUrl, entry.path.split("/").pop() || "download");
    } catch (e) {
      console.error("download failed", e);
      alert(`Download failed: ${(e as Error).message}`);
    } finally {
      setBusyPath(null);
    }
  }

  async function downloadAll() {
    const data = filesQ.data;
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
        failed.push({ path: entry.path, error: (e as Error).message });
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

  const data = filesQ.data;

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
        <div className="font-semibold mb-2">Auth diagnostics</div>
        <dl className="grid grid-cols-[200px_1fr] gap-y-1 font-mono text-xs">
          <dt>pathname</dt>
          <dd>{typeof window !== "undefined" ? window.location.pathname : "(ssr)"}</dd>
          <dt>component loaded</dt>
          <dd>yes</dd>
          <dt>client.loading</dt>
          <dd>{String(clientAuth.loading)}</dd>
          <dt>client.hasSession</dt>
          <dd>{String(clientAuth.hasSession)}</dd>
          <dt>client.rawEmail</dt>
          <dd>{JSON.stringify(clientAuth.rawEmail)}</dd>
          <dt>client.normalizedEmail</dt>
          <dd>{JSON.stringify(clientAuth.normalizedEmail)}</dd>
          <dt>expectedAdminEmail</dt>
          <dd>{JSON.stringify(ADMIN_EMAIL)}</dd>
          <dt>client.isAdmin</dt>
          <dd>{String(clientAuth.isAdmin)}</dd>
          <dt>client.error</dt>
          <dd>{JSON.stringify(clientAuth.error)}</dd>
          <dt>server.status</dt>
          <dd>
            {whoAmIQ.isLoading
              ? "loading"
              : whoAmIQ.error
                ? `error: ${(whoAmIQ.error as Error).message}`
                : whoAmIQ.data
                  ? "ok"
                  : "idle"}
          </dd>
          <dt>server.rawEmail</dt>
          <dd>{JSON.stringify(whoAmIQ.data?.rawEmail ?? null)}</dd>
          <dt>server.normalizedEmail</dt>
          <dd>{JSON.stringify(whoAmIQ.data?.normalizedEmail ?? null)}</dd>
          <dt>server.userId</dt>
          <dd>{JSON.stringify(whoAmIQ.data?.userId ?? null)}</dd>
          <dt>server.isAdmin</dt>
          <dd>{String(serverIsAdmin)}</dd>
        </dl>
      </div>

      {!serverIsAdmin ? (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Storage listing is hidden until the server confirms admin email.
          {clientAuth.loading
            ? " Waiting for session to hydrate…"
            : !clientAuth.hasSession
              ? " You are not signed in."
              : ""}
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3">
            <Button
              onClick={() => filesQ.refetch()}
              variant="outline"
              disabled={filesQ.isLoading}
            >
              Refresh
            </Button>
            <Button
              onClick={downloadAll}
              disabled={!data || data.length === 0 || bulk.running}
            >
              {bulk.running ? "Downloading…" : "Download all"}
            </Button>
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
                    {" "}
                    — <span className="font-mono text-xs">{bulk.current}</span>
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
            {filesQ.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : filesQ.error ? (
              <div className="p-6 text-sm text-destructive">
                Error: {(filesQ.error as Error).message}
              </div>
            ) : !data || data.length === 0 ? (
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
                  {data.map((f) => (
                    <tr key={f.path} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{f.path}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatBytes(f.size)}
                      </td>
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
            {data ? (
              <div className="border-t border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {data.length} file{data.length === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
