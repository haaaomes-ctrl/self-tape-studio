// Custom Cloudflare Worker entry that wraps TanStack Start's default handler
// in order to capture the per-request ExecutionContext (with `waitUntil`) into
// AsyncLocalStorage so server route handlers can schedule background work that
// outlives the response.
//
// This is the file referenced by wrangler.jsonc → "main".
import { AsyncLocalStorage } from "node:async_hooks";
import startEntry from "@tanstack/react-start/server-entry";

export interface RequestExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
}

const ctxStorage = new AsyncLocalStorage<RequestExecutionContext>();

/**
 * Returns the current request's Cloudflare ExecutionContext, or `null` if
 * called outside of a Worker request (e.g. dev SSR on Node, prerender).
 *
 * Use `getRequestCtx()?.waitUntil(promise)` to extend the request lifetime
 * with background work that must not be cancelled when the response returns.
 */
export function getRequestCtx(): RequestExecutionContext | null {
  return ctxStorage.getStore() ?? null;
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
  async fetch(request: Request, env: unknown, ctx: RequestExecutionContext): Promise<Response> {
    return ctxStorage.run(ctx, () => startEntry.fetch(request, env, ctx));
  },
};
