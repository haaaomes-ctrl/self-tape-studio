// SERVER-ONLY. Runtime env / ExecutionContext access via AsyncLocalStorage.
//
// This module is intentionally TanStack-free (no `@tanstack/react-start`, no
// routes, no React) so it can be imported by BOTH:
//   - the TanStack Start app Worker entry (src/worker-entry.ts), and
//   - the dedicated Cloudflare analysis Worker (analysis-worker/), which is
//     bundled by plain wrangler/esbuild and must not pull TanStack virtual
//     modules into its graph.
//
// It owns the per-request AsyncLocalStorage store and wires the Supabase
// admin/public runtime-env resolvers to it, so `supabaseAdmin` resolves the
// Cloudflare `env` binding inside any handler wrapped with runWithRuntimeContext.
import { AsyncLocalStorage } from "node:async_hooks";
import { setSupabaseAdminRuntimeEnvResolver } from "@/integrations/supabase/client.server";
import { setSupabasePublicRuntimeEnvResolver } from "@/integrations/supabase/public-runtime";

export interface RequestExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
}

export type RuntimeStore = {
  ctx: RequestExecutionContext;
  env: Record<string, unknown>;
};

const runtimeStorage = new AsyncLocalStorage<RuntimeStore>();

// Registered once at module load. Both Workers import this module, so the
// resolvers are wired in either runtime.
setSupabaseAdminRuntimeEnvResolver(() => runtimeStorage.getStore()?.env ?? null);
setSupabasePublicRuntimeEnvResolver(() => runtimeStorage.getStore()?.env ?? null);

/**
 * Runs `fn` within a runtime store so getRequestEnv/getRequestCtx and the
 * Supabase admin/public clients resolve the Cloudflare `env` binding. Both the
 * app `fetch`/`queue` handlers and the analysis Worker wrap their work in this.
 */
export function runWithRuntimeContext<T>(store: RuntimeStore, fn: () => T): T {
  return runtimeStorage.run(store, fn);
}

/**
 * Returns the current request's Cloudflare ExecutionContext, or `null` if
 * called outside of a wrapped Worker invocation (e.g. dev SSR on Node).
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
