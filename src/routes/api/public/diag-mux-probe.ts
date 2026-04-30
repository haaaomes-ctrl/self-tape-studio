// Temporary diagnostic endpoint: runs the same probe sequence used by
// runProcessTake from inside the deployed Worker runtime, and returns the
// raw HEAD / Range GET / browser GET statuses + selected method.
//
// SAFE: read-only fetches against a caller-supplied stream.mux.com URL.
// Restricted to https://stream.mux.com/* paths; nothing else is fetched.
import { createFileRoute } from "@tanstack/react-router";

const NO_CACHE = {
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};
const BROWSER_LIKE = {
  ...NO_CACHE,
  Accept: "video/mp4,video/*,*/*",
  "User-Agent": "Mozilla/5.0",
};

function snapshot(res: Response | null) {
  if (!res) return null;
  return {
    contentType: res.headers.get("content-type"),
    contentLength: res.headers.get("content-length"),
    acceptRanges: res.headers.get("accept-ranges"),
    cacheControl: res.headers.get("cache-control"),
    via: res.headers.get("via"),
    xCache: res.headers.get("x-cache"),
    cfRay: res.headers.get("cf-ray"),
    server: res.headers.get("server"),
  };
}

async function dispose(res: Response | null) {
  try {
    await res?.body?.cancel();
  } catch {
    /* ignore */
  }
}

export const Route = createFileRoute("/api/public/diag-mux-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const target = u.searchParams.get("url");
        if (!target || !/^https:\/\/stream\.mux\.com\/[^/]+\/(highest|high)\.mp4$/.test(target)) {
          return new Response(
            JSON.stringify({ error: "invalid url; must match https://stream.mux.com/<id>/(highest|high).mp4" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        let headStatus: number | null = null;
        let rangeStatus: number | null = null;
        let getStatus: number | null = null;
        let headSnap: ReturnType<typeof snapshot> = null;
        let rangeSnap: ReturnType<typeof snapshot> = null;
        let getSnap: ReturnType<typeof snapshot> = null;
        let headErr: string | null = null;
        let rangeErr: string | null = null;
        let getErr: string | null = null;

        const t0 = Date.now();
        let r: Response | null = null;
        try {
          r = await fetch(target, { method: "HEAD", headers: NO_CACHE, cache: "no-store" });
          headStatus = r.status;
          headSnap = snapshot(r);
        } catch (e) {
          headErr = e instanceof Error ? e.message : String(e);
        } finally {
          await dispose(r);
        }

        r = null;
        try {
          r = await fetch(target, {
            method: "GET",
            headers: { ...BROWSER_LIKE, Range: "bytes=0-0" },
            cache: "no-store",
          });
          rangeStatus = r.status;
          rangeSnap = snapshot(r);
        } catch (e) {
          rangeErr = e instanceof Error ? e.message : String(e);
        } finally {
          await dispose(r);
        }

        r = null;
        try {
          r = await fetch(target, { method: "GET", headers: BROWSER_LIKE, cache: "no-store" });
          getStatus = r.status;
          getSnap = snapshot(r);
        } catch (e) {
          getErr = e instanceof Error ? e.message : String(e);
        } finally {
          await dispose(r);
        }

        const ok2xx = (s: number | null) => s !== null && s >= 200 && s < 300;
        let selected: "head" | "range_get" | "browser_get" | null = null;
        if (ok2xx(headStatus)) selected = "head";
        else if (ok2xx(rangeStatus)) selected = "range_get";
        else if (ok2xx(getStatus)) selected = "browser_get";

        const body = {
          target,
          duration_ms: Date.now() - t0,
          head: { status: headStatus, error: headErr, headers: headSnap },
          range_get: { status: rangeStatus, error: rangeErr, headers: rangeSnap },
          browser_get: { status: getStatus, error: getErr, headers: getSnap },
          selected_probe_method: selected,
          probe_ok: selected !== null,
        };
        console.log("diag_mux_probe", body);
        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
