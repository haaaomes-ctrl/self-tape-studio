// Custom Cloudflare Worker entry that wraps TanStack Start's default handler
// in order to capture the per-request ExecutionContext (with `waitUntil`) into
// AsyncLocalStorage so server route handlers can schedule background work that
// outlives the response.
//
// This is the file referenced by wrangler.jsonc → "main".
import { AsyncLocalStorage } from "node:async_hooks";
import startEntry from "@tanstack/react-start/server-entry";
import { setSupabaseAdminRuntimeEnvResolver } from "@/integrations/supabase/client.server";
import { setSupabasePublicRuntimeEnvResolver } from "@/integrations/supabase/public-runtime";

export interface RequestExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
}

type RuntimeStore = {
  ctx: RequestExecutionContext;
  env: Record<string, unknown>;
};

type QueueMessage<T = unknown> = {
  body: T;
};

type QueueBatch<T = unknown> = {
  messages: Array<QueueMessage<T>>;
};

const runtimeStorage = new AsyncLocalStorage<RuntimeStore>();

setSupabaseAdminRuntimeEnvResolver(() => runtimeStorage.getStore()?.env ?? null);
setSupabasePublicRuntimeEnvResolver(() => runtimeStorage.getStore()?.env ?? null);

/**
 * Returns the current request's Cloudflare ExecutionContext, or `null` if
 * called outside of a Worker request (e.g. dev SSR on Node, prerender).
 *
 * Use `getRequestCtx()?.waitUntil(promise)` to extend the request lifetime
 * with background work that must not be cancelled when the response returns.
 */
export function getRequestCtx(): RequestExecutionContext | null {
  return runtimeStorage.getStore()?.ctx ?? null;
}

export function getRequestEnv<
  T extends Record<string, unknown> = Record<string, unknown>,
>(): T | null {
  return (runtimeStorage.getStore()?.env as T | undefined) ?? null;
}

/**
 * Schedule background work that should keep running after the response is
 * sent. Falls back to a fire-and-forget promise on environments where
 * `ctx.waitUntil` is unavailable (with a console warning).
 */
export function scheduleBackground(promise: Promise<unknown>, label = "background-task"): void {
  const ctx = getRequestCtx();
  if (ctx) {
    ctx.waitUntil(
      promise.catch((err) => {
        console.error(`[scheduleBackground:${label}] failed`, err);
      }),
    );
    return;
  }
  console.warn(
    `[scheduleBackground:${label}] no ExecutionContext available — falling back to un-awaited promise (may be cancelled)`,
  );
  promise.catch((err) => {
    console.error(`[scheduleBackground:${label}] failed`, err);
  });
}

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: RequestExecutionContext,
  ): Promise<Response> {
    return runtimeStorage.run({ ctx, env }, () =>
      (startEntry as { fetch: (req: Request) => Promise<Response> }).fetch(request),
    );
  },

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
      const outcome = await runtimeStorage.run({ ctx, env }, () =>
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
