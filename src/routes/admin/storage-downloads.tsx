import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllArtifacts,
  signArtifactDownload,
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
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || normalizeEmail(data.user.email) !== ADMIN_EMAIL) {
      throw redirect({ to: "/" });
    }
  },
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

function StorageDownloadsPage() {
  const list = useServerFn(listAllArtifacts);
  const sign = useServerFn(signArtifactDownload);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "qa-artifacts"],
    queryFn: () => list(),
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground">
        Admin Storage Downloads
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Private bucket: <code>qa-artifacts</code>. Signed URLs expire in 1 hour.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => refetch()} variant="outline" disabled={isLoading}>
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
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">
            Error: {(error as Error).message}
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
        {data ? (
          <div className="border-t border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {data.length} file{data.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
