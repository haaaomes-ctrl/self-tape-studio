// Dedicated Cloudflare ANALYSIS Worker entry (durable analysis runtime).
//
// This is a SEPARATE worker from the TanStack/Lovable app. It must remain
// TanStack-free so plain wrangler/esbuild can bundle it (no TanStack virtual
// modules): it must NOT import @/worker-entry, src/routes, routeTree,
// @tanstack/react-start, @tanstack/react-router, react, src/components or
// V2ReportView. All logic lives in TanStack-free @/server modules.
//
// Responsibilities:
//   - POST /dispatch-analysis : authenticated enqueue to ANALYSIS_QUEUE
//   - GET  /health            : safe readiness booleans
//   - queue consumer          : direct OpenRouter runAnalysisJob against owned Supabase
import {
  runWithRuntimeContext,
  type RequestExecutionContext,
} from "@/server/runtime-env-als.server";
import {
  buildHealthResponse,
  handleDispatchRequest,
  handleQueueMessage,
} from "@/server/analysis-worker-handlers.server";

type QueueMessage<T = unknown> = { body: T };
type QueueBatch<T = unknown> = { messages: Array<QueueMessage<T>> };

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: RequestExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    // Wrap so supabaseAdmin / getRequestEnv resolve the Cloudflare env binding.
    return runWithRuntimeContext({ ctx, env }, async () => {
      if (request.method === "POST" && url.pathname === "/dispatch-analysis") {
        return handleDispatchRequest(request, env);
      }
      if (request.method === "GET" && url.pathname === "/health") {
        return buildHealthResponse(env);
      }
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    });
  },

  async queue(
    batch: QueueBatch,
    env: Record<string, unknown>,
    ctx: RequestExecutionContext,
  ): Promise<void> {
    for (const message of batch.messages) {
      const body = message.body as { takeId?: unknown; reason?: unknown; enqueuedAt?: unknown };
      const takeId = typeof body.takeId === "string" ? body.takeId : null;
      console.log("[analysis-worker] job started", {
        take_id: takeId,
        reason: typeof body.reason === "string" ? body.reason : null,
        enqueued_at: typeof body.enqueuedAt === "string" ? body.enqueuedAt : null,
      });
      const outcome = await runWithRuntimeContext({ ctx, env }, () =>
        handleQueueMessage(body, env),
      );
      console.log("[analysis-worker] job completed", { take_id: takeId, outcome });
      // Cloudflare Queues: throw to retry (max_batch_size is 1 → retries this message);
      // return to ack.
      if (outcome.outcome === "retry") {
        throw new Error(
          `[analysis-worker] retry requested for take ${takeId ?? "unknown"}: ${outcome.detail}`,
        );
      }
    }
  },
};
