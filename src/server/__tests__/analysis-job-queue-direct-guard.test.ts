import { describe, expect, it, vi } from "vitest";

import { dispatchAnalysisJob } from "../analysis-job-queue.server";

function readyDirectEnv(queue: { send: ReturnType<typeof vi.fn> }) {
  return {
    ANALYSIS_EXECUTION_MODE: "direct_openrouter",
    ANALYSIS_QUEUE: queue,
    TAPECOACH_SUPABASE_URL: "https://owned.supabase.co",
    TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "svc",
    OPENROUTER_API_KEY: "or-key",
    MUX_TOKEN_ID: "mux-id",
    MUX_TOKEN_SECRET: "mux-secret",
    QA_ARTIFACT_STORAGE_BUCKET: "qa-artifacts",
    QA_ARTIFACT_SINK: "storage",
  } as Record<string, unknown>;
}

describe("dispatch direct-mode readiness guard", () => {
  it("refuses to enqueue (safe failure, no send) when direct mode is configured but not ready", async () => {
    const send = vi.fn(async (_msg: unknown) => undefined);
    const env = readyDirectEnv({ send });
    delete env.OPENROUTER_API_KEY; // direct mode not ready

    const result = await dispatchAnalysisJob(
      { takeId: "take-1", reason: "mux_asset_ready" },
      { env },
    );

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_direct_mode_not_ready",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("fails safe (does not fall back to waitUntil) when direct mode is set but the queue binding is missing", async () => {
    // No ANALYSIS_QUEUE binding: must return analysis_direct_mode_not_ready BEFORE
    // the no-queue waitUntil fallback, so it never silently runs runProcessTake.
    const runProcessTake = vi.fn(async () => ({ ok: true }) as const);
    const env: Record<string, unknown> = {
      ANALYSIS_EXECUTION_MODE: "direct_openrouter",
      TAPECOACH_SUPABASE_URL: "https://owned.supabase.co",
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "svc",
      OPENROUTER_API_KEY: "or-key",
      MUX_TOKEN_ID: "mux-id",
      MUX_TOKEN_SECRET: "mux-secret",
      QA_ARTIFACT_STORAGE_BUCKET: "qa-artifacts",
      QA_ARTIFACT_SINK: "storage",
    };

    const result = await dispatchAnalysisJob(
      { takeId: "take-1", reason: "mux_asset_ready" },
      { env, runProcessTake, hasRequestContext: () => true },
    );

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_direct_mode_not_ready",
    });
    expect(runProcessTake).not.toHaveBeenCalled();
  });

  it("enqueues normally when direct mode is fully ready", async () => {
    const send = vi.fn(async (_msg: unknown) => undefined);
    const result = await dispatchAnalysisJob(
      { takeId: "take-1", reason: "mux_asset_ready" },
      { env: readyDirectEnv({ send }) },
    );
    expect(result).toEqual({ ok: true, method: "queue" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ takeId: "take-1", reason: "mux_asset_ready" });
  });

  it("direct mode takes precedence over the legacy external bridge (enqueues to the in-Worker queue)", async () => {
    const send = vi.fn(async (_msg: unknown) => undefined);
    const externalFetch = vi.fn(async () => new Response("{}"));
    const env = readyDirectEnv({ send });
    // Cutover env still has the legacy external dispatch configured.
    env.ANALYSIS_DISPATCH_URL = "https://legacy-worker.example/api/internal/run-analysis";
    env.ANALYSIS_DISPATCH_SECRET = "legacy-secret";

    const result = await dispatchAnalysisJob(
      { takeId: "take-1", reason: "mux_asset_ready" },
      { env, fetch: externalFetch as unknown as typeof fetch },
    );

    expect(result).toEqual({ ok: true, method: "queue" });
    expect(send).toHaveBeenCalledTimes(1);
    // The legacy external bridge must NOT be called in direct mode.
    expect(externalFetch).not.toHaveBeenCalled();
  });

  it("does not apply the direct guard in current_worker mode (enqueues even without OpenRouter)", async () => {
    const send = vi.fn(async (_msg: unknown) => undefined);
    const env = readyDirectEnv({ send });
    env.ANALYSIS_EXECUTION_MODE = "current_worker";
    delete env.OPENROUTER_API_KEY;

    const result = await dispatchAnalysisJob(
      { takeId: "take-1", reason: "mux_asset_ready" },
      { env },
    );
    expect(result).toEqual({ ok: true, method: "queue" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
