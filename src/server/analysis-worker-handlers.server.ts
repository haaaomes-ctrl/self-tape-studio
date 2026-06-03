// SERVER-ONLY. Request/queue handlers for the dedicated Cloudflare analysis
// Worker (analysis-worker/index.ts). Kept here (under src/server) so it is
// type-checked, linted and unit-tested with the rest of the server code, while
// remaining TanStack-free: it must NOT import @/worker-entry, src/routes,
// routeTree, @tanstack/*, react, src/components or V2ReportView.
import {
  describeWorkerAnalysisReadiness,
  isDirectAnalysisDispatchReady,
  runQueuedAnalysisJob,
  type QueuedAnalysisOutcome,
  type WorkerAnalysisReadiness,
} from "@/server/worker-analysis-consumer.server";

export type AnalysisQueueMessageBody = {
  takeId: string;
  reason: string | null;
  enqueuedAt: string;
};

type AnalysisQueueBinding = {
  send(message: AnalysisQueueMessageBody): Promise<void>;
};

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bearerToken(request: Request): string | null {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ?? null
  );
}

export type DispatchDeps = {
  /** Override the enqueue timestamp (tests); defaults to new Date().toISOString(). */
  now?: () => string;
};

/**
 * Handles POST /dispatch-analysis: authenticates with Bearer ANALYSIS_DISPATCH_SECRET,
 * validates the body, refuses when direct-mode runtime config is missing, then
 * enqueues to ANALYSIS_QUEUE. The success/failure JSON shapes match what the app's
 * existing external-dispatch path (analysis-job-queue.server.ts) expects:
 * success => { ok:true, dispatch_method:"queue", queued:true }.
 */
export async function handleDispatchRequest(
  request: Request,
  env: Record<string, unknown>,
  deps: DispatchDeps = {},
): Promise<Response> {
  const secret = cleanString(env.ANALYSIS_DISPATCH_SECRET);
  if (!secret || bearerToken(request) !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { take_id?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as { take_id?: unknown; reason?: unknown };
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const takeId = cleanString(body.take_id);
  if (!takeId) {
    return Response.json({ ok: false, error: "missing_take_id" }, { status: 400 });
  }

  // Direct-mode readiness: do not enqueue jobs the consumer could not run or
  // mark terminal. Surfaced as a non-2xx failure so the app routes it through
  // its existing mark-failed + credit-release dispatch-failure path.
  if (!isDirectAnalysisDispatchReady(env)) {
    return Response.json(
      {
        ok: false,
        error: "analysis_direct_mode_not_ready",
        readiness: describeWorkerAnalysisReadiness(env),
      },
      { status: 503 },
    );
  }

  const queue = env.ANALYSIS_QUEUE as AnalysisQueueBinding | undefined;
  if (!queue || typeof queue.send !== "function") {
    // queue_unavailable shape the app recognises (isQueueUnavailablePayload).
    return Response.json(
      { ok: false, error: "queue_unavailable", queue_unavailable: true },
      { status: 503 },
    );
  }

  const reason = cleanString(body.reason) ?? "mux_asset_ready";
  const enqueuedAt = (deps.now ?? (() => new Date().toISOString()))();
  try {
    await queue.send({ takeId, reason, enqueuedAt });
  } catch (error) {
    console.error("[analysis-worker] enqueue failed", {
      take_id: takeId,
      reason,
      error: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({ ok: false, error: "enqueue_failed" }, { status: 502 });
  }

  return Response.json({ ok: true, dispatch_method: "queue", queued: true, take_id: takeId });
}

/** GET /health: safe boolean-only readiness snapshot (no secrets). */
export function buildHealthResponse(env: Record<string, unknown>): Response {
  const readiness: WorkerAnalysisReadiness = describeWorkerAnalysisReadiness(env);
  return Response.json({ ok: true, ...readiness }, { headers: { "cache-control": "no-store" } });
}

/**
 * Runs a single queued analysis message via the Slice 5 consumer (direct mode in
 * this worker). Returns the ack/retry outcome; the entry maps "retry" to a throw
 * so the Cloudflare queue redelivers (batch size 1).
 */
export async function handleQueueMessage(
  body: { takeId?: unknown; reason?: unknown },
  env: Record<string, unknown>,
): Promise<QueuedAnalysisOutcome | { outcome: "ack"; detail: "invalid_message" }> {
  const takeId = cleanString(body.takeId);
  if (!takeId) {
    console.error("[analysis-worker] invalid message body", { body });
    return { outcome: "ack", detail: "invalid_message" };
  }
  const reason = typeof body.reason === "string" ? body.reason : null;
  return runQueuedAnalysisJob({ takeId, reason, env });
}
