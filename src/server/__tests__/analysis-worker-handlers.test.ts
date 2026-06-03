import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Partial-mock the consumer so handleQueueMessage's delegation is observable,
// while handleDispatchRequest still uses the real readiness helpers.
const runQueuedAnalysisJobMock = vi.hoisted(() => vi.fn(async () => ({ outcome: "ack" }) as const));
vi.mock("@/server/worker-analysis-consumer.server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, runQueuedAnalysisJob: runQueuedAnalysisJobMock };
});

import {
  buildHealthResponse,
  handleDispatchRequest,
  handleQueueMessage,
} from "../analysis-worker-handlers.server";

const SECRET = "dispatch-secret";

function readyEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const send = vi.fn(async (_m: unknown) => undefined);
  return {
    ANALYSIS_EXECUTION_MODE: "direct_openrouter",
    ANALYSIS_DISPATCH_SECRET: SECRET,
    ANALYSIS_QUEUE: { send },
    TAPECOACH_SUPABASE_URL: "https://owned.supabase.co",
    TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "svc",
    OPENROUTER_API_KEY: "or-key",
    MUX_TOKEN_ID: "mux-id",
    MUX_TOKEN_SECRET: "mux-secret",
    QA_ARTIFACT_STORAGE_BUCKET: "qa-artifacts",
    QA_ARTIFACT_SINK: "storage",
    ...overrides,
  };
}

function dispatchRequest(body: unknown, auth = `Bearer ${SECRET}`): Request {
  return new Request("https://w/dispatch-analysis", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("analysis worker handlers", () => {
  afterEach(() => {
    runQueuedAnalysisJobMock.mockClear();
    runQueuedAnalysisJobMock.mockResolvedValue({ outcome: "ack" } as never);
  });

  describe("POST /dispatch-analysis", () => {
    it("rejects a missing/wrong bearer secret with 401 (no enqueue)", async () => {
      const env = readyEnv();
      const send = (env.ANALYSIS_QUEUE as { send: ReturnType<typeof vi.fn> }).send;
      expect(
        (await handleDispatchRequest(dispatchRequest({ take_id: "t" }, "Bearer nope"), env)).status,
      ).toBe(401);
      expect((await handleDispatchRequest(dispatchRequest({ take_id: "t" }, ""), env)).status).toBe(
        401,
      );
      expect(send).not.toHaveBeenCalled();
    });

    it("rejects invalid JSON / missing take_id with 400", async () => {
      const env = readyEnv();
      expect(
        (await handleDispatchRequest(dispatchRequest("{not json", `Bearer ${SECRET}`), env)).status,
      ).toBe(400);
      expect((await handleDispatchRequest(dispatchRequest({ reason: "x" }), env)).status).toBe(400);
    });

    it("enqueues on success and returns the app-expected queue shape", async () => {
      const env = readyEnv();
      const send = (env.ANALYSIS_QUEUE as { send: ReturnType<typeof vi.fn> }).send;
      const res = await handleDispatchRequest(
        dispatchRequest({ take_id: "take-1", reason: "mux_asset_ready" }),
        env,
        { now: () => "2026-06-03T00:00:00.000Z" },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        ok: true,
        dispatch_method: "queue",
        queued: true,
        take_id: "take-1",
      });
      expect(send).toHaveBeenCalledWith({
        takeId: "take-1",
        reason: "mux_asset_ready",
        enqueuedAt: "2026-06-03T00:00:00.000Z",
      });
    });

    it("refuses with 503 analysis_direct_mode_not_ready when direct config is missing (no enqueue)", async () => {
      const env = readyEnv({ OPENROUTER_API_KEY: undefined });
      const send = (env.ANALYSIS_QUEUE as { send: ReturnType<typeof vi.fn> }).send;
      const res = await handleDispatchRequest(dispatchRequest({ take_id: "t" }), env);
      expect(res.status).toBe(503);
      await expect(res.json()).resolves.toMatchObject({
        ok: false,
        error: "analysis_direct_mode_not_ready",
      });
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("GET /health", () => {
    it("returns safe readiness booleans and no secret values", async () => {
      const env = readyEnv();
      const res = buildHealthResponse(env);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json).toMatchObject({
        ok: true,
        execution_mode: "direct_openrouter",
        queue_binding_available: true,
        supabase_env_present: true,
        openrouter_key_present: true,
      });
      expect(JSON.stringify(json)).not.toContain("svc");
      expect(JSON.stringify(json)).not.toContain("or-key");
    });
  });

  describe("queue", () => {
    it("acks an invalid message without delegating", async () => {
      const out = await handleQueueMessage({ takeId: 123 }, readyEnv());
      expect(out).toEqual({ outcome: "ack", detail: "invalid_message" });
      expect(runQueuedAnalysisJobMock).not.toHaveBeenCalled();
    });

    it("delegates a valid message to runQueuedAnalysisJob", async () => {
      runQueuedAnalysisJobMock.mockResolvedValueOnce({
        outcome: "ack",
        mode: "direct_openrouter",
        takeId: "take-1",
        detail: "completed",
      } as never);
      const env = readyEnv();
      const out = await handleQueueMessage({ takeId: "take-1", reason: "mux_asset_ready" }, env);
      expect(out).toMatchObject({ outcome: "ack", detail: "completed" });
      expect(runQueuedAnalysisJobMock).toHaveBeenCalledWith({
        takeId: "take-1",
        reason: "mux_asset_ready",
        env,
      });
    });
  });

  describe("bundleability guard (TanStack-free)", () => {
    const forbidden = [
      '"@/worker-entry"',
      "@tanstack/react-start",
      "@tanstack/react-router",
      'from "react"',
      'from "react-dom"',
      "routeTree",
      "@/routes",
      "src/components",
      "V2ReportView",
      "createServerFn",
    ];

    it("the analysis worker entry + handlers + ALS module import nothing TanStack/UI-bound", async () => {
      const files = [
        "analysis-worker/index.ts",
        "src/server/analysis-worker-handlers.server.ts",
        "src/server/runtime-env-als.server.ts",
      ];
      for (const file of files) {
        const raw = await readFile(path.join(process.cwd(), file), "utf8");
        // Strip block + line comments so the doc comments (which intentionally
        // list the forbidden modules) don't trip the guard — only real code counts.
        const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
        for (const needle of forbidden) {
          expect(code, `${file} must not reference ${needle}`).not.toContain(needle);
        }
      }
    });
  });
});
