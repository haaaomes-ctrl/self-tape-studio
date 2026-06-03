import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { OpenRouterChatProvider } from "../analysis-ai-provider.server";
import type { AnalysisAiProvider } from "../analysis-ai-provider.server";
import type { RunAnalysisJobParams, RunProcessTakeResult } from "../process-take.server";
import {
  classifyThrownError,
  describeWorkerAnalysisReadiness,
  isDirectAnalysisDispatchReady,
  resolveAnalysisExecutionMode,
  runQueuedAnalysisJob,
} from "../worker-analysis-consumer.server";

const SECRETS = {
  serviceRole: "owned-service-role-secret",
  openRouter: "or-secret-key",
  muxId: "mux-id-secret",
  muxSecret: "mux-token-secret",
} as const;

function directEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ANALYSIS_EXECUTION_MODE: "direct_openrouter",
    ANALYSIS_QUEUE: { send: () => undefined },
    TAPECOACH_SUPABASE_URL: "https://owned.supabase.co",
    TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRETS.serviceRole,
    OPENROUTER_API_KEY: SECRETS.openRouter,
    MUX_TOKEN_ID: SECRETS.muxId,
    MUX_TOKEN_SECRET: SECRETS.muxSecret,
    QA_ARTIFACT_STORAGE_BUCKET: "qa-artifacts",
    QA_ARTIFACT_SINK: "storage",
    ...overrides,
  };
}

const OK: RunProcessTakeResult = { ok: true };

describe("worker analysis consumer", () => {
  describe("resolveAnalysisExecutionMode", () => {
    it("defaults to current_worker for absent/unknown values", () => {
      expect(resolveAnalysisExecutionMode(undefined)).toBe("current_worker");
      expect(resolveAnalysisExecutionMode({})).toBe("current_worker");
      expect(resolveAnalysisExecutionMode({ ANALYSIS_EXECUTION_MODE: "bridge" })).toBe(
        "current_worker",
      );
    });
    it("resolves direct_openrouter only on the explicit opt-in", () => {
      expect(resolveAnalysisExecutionMode({ ANALYSIS_EXECUTION_MODE: "direct_openrouter" })).toBe(
        "direct_openrouter",
      );
    });
  });

  describe("readiness", () => {
    it("reports safe boolean-only readiness with no secret values", () => {
      const r = describeWorkerAnalysisReadiness(directEnv());
      expect(r).toEqual({
        execution_mode: "direct_openrouter",
        queue_binding_available: true,
        supabase_env_present: true,
        openrouter_key_present: true,
        mux_env_present: true,
        qa_bucket_configured: true,
      });
      const serialised = JSON.stringify(r);
      for (const secret of Object.values(SECRETS)) {
        expect(serialised).not.toContain(secret);
      }
    });

    it("isDirectAnalysisDispatchReady is false when any required input is missing", () => {
      expect(isDirectAnalysisDispatchReady(directEnv())).toBe(true);
      expect(isDirectAnalysisDispatchReady(directEnv({ OPENROUTER_API_KEY: undefined }))).toBe(
        false,
      );
      expect(isDirectAnalysisDispatchReady(directEnv({ TAPECOACH_SUPABASE_URL: undefined }))).toBe(
        false,
      );
      expect(isDirectAnalysisDispatchReady(directEnv({ MUX_TOKEN_ID: undefined }))).toBe(false);
      expect(isDirectAnalysisDispatchReady(directEnv({ ANALYSIS_QUEUE: undefined }))).toBe(false);
    });
  });

  describe("classifyThrownError", () => {
    it("retries transient failures", () => {
      expect(classifyThrownError({ status: 429 })).toBe("retry");
      expect(classifyThrownError({ status: 503 })).toBe("retry");
      expect(classifyThrownError(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(
        "retry",
      );
      expect(classifyThrownError(new Error("network timeout while fetching"))).toBe("retry");
    });
    it("acks classified non-retryable failures", () => {
      expect(classifyThrownError(new Error("OPENROUTER_API_KEY is not configured"))).toBe("ack");
      expect(classifyThrownError(new Error("validation failed: invalid body"))).toBe("ack");
      expect(classifyThrownError({ status: 401 })).toBe("ack");
    });
    it("defaults unknown errors to retry (bounded by max_retries)", () => {
      expect(classifyThrownError(new Error("something weird happened"))).toBe("retry");
    });
  });

  describe("current_worker mode", () => {
    it("calls runProcessTake (not runAnalysisJob) and acks ok:true", async () => {
      const runProcessTake = vi.fn(async () => OK);
      const runAnalysisJob = vi.fn(async () => OK);
      const out = await runQueuedAnalysisJob({
        takeId: "take-1",
        env: { ANALYSIS_QUEUE: {} },
        deps: { runProcessTake, runAnalysisJob },
      });
      expect(out).toMatchObject({ outcome: "ack", mode: "current_worker", takeId: "take-1" });
      expect(runProcessTake).toHaveBeenCalledWith("take-1");
      expect(runAnalysisJob).not.toHaveBeenCalled();
    });
    it("retries a transient throw", async () => {
      const runProcessTake = vi.fn(async () => {
        throw Object.assign(new Error("upstream 502"), { status: 502 });
      });
      const out = await runQueuedAnalysisJob({
        takeId: "take-1",
        env: {},
        deps: { runProcessTake },
      });
      expect(out.outcome).toBe("retry");
    });
  });

  describe("direct_openrouter mode", () => {
    it("maps CF env, builds an OpenRouter provider, and calls runAnalysisJob (not runProcessTake)", async () => {
      let captured: RunAnalysisJobParams | null = null;
      const runAnalysisJob = vi.fn(async (params: RunAnalysisJobParams) => {
        captured = params;
        return OK;
      });
      const runProcessTake = vi.fn(async () => OK);

      const out = await runQueuedAnalysisJob({
        takeId: "take-9",
        reason: "mux_asset_ready",
        env: directEnv(),
        // No createOpenRouterProvider dep => the default builds a real OpenRouterChatProvider.
        deps: { runAnalysisJob, runProcessTake },
      });

      expect(out).toMatchObject({ outcome: "ack", mode: "direct_openrouter", takeId: "take-9" });
      expect(runProcessTake).not.toHaveBeenCalled();
      expect(runAnalysisJob).toHaveBeenCalledTimes(1);

      const params = captured as unknown as RunAnalysisJobParams;
      expect(params.takeId).toBe("take-9");
      expect(params.reason).toBe("mux_asset_ready");
      // Mapped runtime env is passed (owned Supabase + OpenRouter keys present).
      expect(params.env?.TAPECOACH_SUPABASE_URL).toBe("https://owned.supabase.co");
      expect(params.env?.OPENROUTER_API_KEY).toBe(SECRETS.openRouter);
      // Default provider is a real OpenRouter provider.
      expect(params.aiProvider).toBeInstanceOf(OpenRouterChatProvider);
      expect(params.aiProvider.id).toBe("openrouter");
      // No pre-claim: preClaimed must not be set.
      expect(params.preClaimed).toBeUndefined();
    });

    it("acks a controlled ok:false (runAnalysisJob wrote terminal state)", async () => {
      const runAnalysisJob = vi.fn(
        async (): Promise<RunProcessTakeResult> => ({ ok: false, error: "analysis_failed" }),
      );
      const out = await runQueuedAnalysisJob({
        takeId: "t",
        env: directEnv(),
        deps: { runAnalysisJob, createOpenRouterProvider: () => fakeProvider() },
      });
      expect(out).toMatchObject({ outcome: "ack", detail: "controlled_error" });
    });

    it("marks the take failed + acks when OpenRouter key is missing (Supabase reachable)", async () => {
      const runAnalysisJob = vi.fn(async () => OK);
      const markDispatchFailure = vi.fn(async () => undefined);
      const out = await runQueuedAnalysisJob({
        takeId: "t",
        reason: "mux_asset_ready",
        env: directEnv({ OPENROUTER_API_KEY: undefined }),
        deps: { runAnalysisJob, markDispatchFailure },
      });
      expect(out).toMatchObject({ outcome: "ack", detail: "server_misconfigured_openrouter" });
      expect(runAnalysisJob).not.toHaveBeenCalled();
      // Supabase IS reachable, so the take is marked terminal + credit released.
      expect(markDispatchFailure).toHaveBeenCalledWith({
        takeId: "t",
        reason: "mux_asset_ready",
        failureCode: "analysis_direct_mode_not_ready",
      });
    });

    it("acks WITHOUT marking when owned Supabase env is missing (cannot mark)", async () => {
      const runAnalysisJob = vi.fn(async () => OK);
      const markDispatchFailure = vi.fn(async () => undefined);
      const out = await runQueuedAnalysisJob({
        takeId: "t",
        env: directEnv({ TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: undefined }),
        deps: { runAnalysisJob, markDispatchFailure },
      });
      expect(out).toMatchObject({ outcome: "ack", detail: "server_misconfigured_supabase" });
      expect(runAnalysisJob).not.toHaveBeenCalled();
      // Supabase unreachable => cannot mark the take terminal.
      expect(markDispatchFailure).not.toHaveBeenCalled();
    });

    it("retries a transient provider failure", async () => {
      const runAnalysisJob = vi.fn(async () => {
        throw Object.assign(new Error("provider 429"), { status: 429 });
      });
      const out = await runQueuedAnalysisJob({
        takeId: "t",
        env: directEnv(),
        deps: { runAnalysisJob, createOpenRouterProvider: () => fakeProvider() },
      });
      expect(out.outcome).toBe("retry");
    });

    it("acks a classified non-retryable failure", async () => {
      const runAnalysisJob = vi.fn(async () => {
        throw new Error("validation failed: bad request");
      });
      const out = await runQueuedAnalysisJob({
        takeId: "t",
        env: directEnv(),
        deps: { runAnalysisJob, createOpenRouterProvider: () => fakeProvider() },
      });
      expect(out.outcome).toBe("ack");
    });
  });

  it("the queue handler wraps execution in runtimeStorage.run and delegates to the consumer", async () => {
    const src = await readFile(path.join(process.cwd(), "src/worker-entry.ts"), "utf8");
    expect(src).toContain("runQueuedAnalysisJob");
    expect(src).toMatch(/runtimeStorage\.run\(\{\s*ctx,\s*env\s*\}/);
    // The queue handler no longer imports runProcessTake directly.
    expect(src).not.toMatch(/const \{ runProcessTake \} = await import/);
  });
});

function fakeProvider(): AnalysisAiProvider {
  return {
    id: "openrouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    isConfigured: () => true,
    missingConfigMessage: () => "",
    resolveModel: (_role, fallback) => fallback,
    chatCompletions: async () => new Response("{}"),
    requestJson: async () => ({ ok: true, provider: "openrouter", status: 200, body: {} }),
  };
}
