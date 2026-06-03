// Custom Cloudflare Worker entry for the TanStack Start APP Worker. It wraps the
// TanStack Start handler in the per-request AsyncLocalStorage store so server
// route handlers can read the Cloudflare env / ExecutionContext.
//
// The ALS mechanism itself lives in the TanStack-free `runtime-env-als.server`
// module so the dedicated analysis Worker (analysis-worker/) can reuse it
// without pulling TanStack Start into its bundle. The getRequestEnv/
// getRequestCtx/scheduleBackground helpers are re-exported here for existing
// app-side importers.
//
// This is the file referenced by wrangler.jsonc → "main".
import startEntry from "@tanstack/react-start/server-entry";
import {
  getRequestCtx,
  getRequestEnv,
  runWithRuntimeContext,
  scheduleBackground,
  type RequestExecutionContext,
} from "@/server/runtime-env-als.server";

export { getRequestCtx, getRequestEnv, scheduleBackground };
export type { RequestExecutionContext };

type QueueMessage<T = unknown> = {
  body: T;
};

type QueueBatch<T = unknown> = {
  messages: Array<QueueMessage<T>>;
};

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: RequestExecutionContext,
  ): Promise<Response> {
    return runWithRuntimeContext({ ctx, env }, () =>
      (startEntry as { fetch: (req: Request) => Promise<Response> }).fetch(request),
    );
  },

  // TRANSITIONAL / DEAD: this queue handler is retained only so this entry stays
  // a drop-in if ever needed. Under the current topology the durable analysis
  // runtime is the dedicated worker (analysis-worker/index.ts), and the root
  // wrangler.jsonc declares NO consumer binding — so this handler is NOT attached
  // to tapecoach-analysis-jobs and does not run. Retire it in the cleanup slice
  // once the dedicated worker is proven (see docs/architecture ADR-0003).
  async queue(
    batch: QueueBatch,
    env: Record<string, unknown>,
    ctx: RequestExecutionContext,
  ): Promise<void> {
    const { runQueuedAnalysisJob } = await import("@/server/worker-analysis-consumer.server");
    for (const message of batch.messages) {
      const body = message.body as { takeId?: unknown; reason?: unknown; enqueuedAt?: unknown };
      if (typeof body.takeId !== "string" || body.takeId.trim().length === 0) {
        console.error("[analysis-queue] invalid message body", { body });
        continue;
      }
      const takeId = body.takeId;
      const reason = typeof body.reason === "string" ? body.reason : null;
      console.log("[analysis-queue] job started", {
        take_id: takeId,
        reason,
        enqueued_at: typeof body.enqueuedAt === "string" ? body.enqueuedAt : null,
      });
      // Wrap in runtimeStorage.run so server modules (supabaseAdmin) resolve the
      // Worker runtime env, just like the fetch handler. Without this, in-Worker
      // analysis cannot reach owned Supabase.
      const outcome = await runWithRuntimeContext({ ctx, env }, () =>
        runQueuedAnalysisJob({ takeId, reason, env }),
      );
      console.log("[analysis-queue] job completed", { take_id: takeId, reason, outcome });
      // Cloudflare Queues: throwing retries the batch (max_batch_size is 1, so it
      // retries this single message). Returning acks it.
      if (outcome.outcome === "retry") {
        throw new Error(`[analysis-queue] retry requested for take ${takeId}: ${outcome.detail}`);
      }
    }
  },
};
