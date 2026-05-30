import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ANALYSING_ORPHAN_MS } from "@/server/finalising-recovery.server";
import {
  handleInternalAnalysisRunRequest,
  type InternalAnalysisRunTakeContext,
} from "@/server/internal-analysis-runner.server";

const SECRET = "expected-analysis-run-secret";
const TAKE_ID = "11111111-1111-4111-8111-111111111111";
const AUDITION_ID = "22222222-2222-4222-8222-222222222222";
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333";
const NOW = Date.parse("2026-05-30T10:00:00.000Z");

function baseTake(
  overrides: Partial<InternalAnalysisRunTakeContext> = {},
): InternalAnalysisRunTakeContext {
  return {
    id: TAKE_ID,
    audition_id: AUDITION_ID,
    status: "pending",
    processing_phase: "analysis_pending",
    updated_at: new Date(NOW - 1_000).toISOString(),
    ...overrides,
  };
}

function requestFor(body: unknown, token: string | null = SECRET): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("https://tapecoach.test/api/internal/run-analysis", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    take_id: TAKE_ID,
    audition_id: AUDITION_ID,
    submission_id: SUBMISSION_ID,
    trigger: "mux_webhook",
    reason: "mux_asset_ready",
    ...overrides,
  };
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("internal analysis runner endpoint", () => {
  it("returns 401 when auth is missing", async () => {
    const runner = vi.fn(async () => ({ ok: true as const }));
    const response = await handleInternalAnalysisRunRequest(requestFor(validBody(), null), {
      env: { ANALYSIS_RUN_SECRET: SECRET },
      runProcessTake: runner,
    });

    expect(response.status).toBe(401);
    expect(await responseJson(response)).toEqual({
      mark_complete: false,
      ok: false,
      error: "unauthorised",
      retryable: false,
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is wrong", async () => {
    const runner = vi.fn(async () => ({ ok: true as const }));
    const response = await handleInternalAnalysisRunRequest(requestFor(validBody(), "wrong"), {
      env: { ANALYSIS_RUN_SECRET: SECRET },
      runProcessTake: runner,
    });

    expect(response.status).toBe(401);
    expect((await responseJson(response)).error).toBe("unauthorised");
    expect(runner).not.toHaveBeenCalled();
  });

  it("returns a safe 400 for invalid take_id", async () => {
    const runner = vi.fn(async () => ({ ok: true as const }));
    const response = await handleInternalAnalysisRunRequest(
      requestFor(validBody({ take_id: "not-a-uuid" })),
      {
        env: { ANALYSIS_RUN_SECRET: SECRET },
        runProcessTake: runner,
      },
    );

    expect(response.status).toBe(400);
    expect(await responseJson(response)).toEqual({
      mark_complete: false,
      ok: false,
      error: "invalid_request",
      retryable: false,
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it("valid auth and take_id call the real runner once", async () => {
    const runner = vi.fn(async () => ({ ok: true as const }));
    const loadTakeContext = vi.fn(async () => ({ kind: "ok" as const, take: baseTake() }));
    const loadAuditionContext = vi.fn(async () => ({ kind: "ok" as const }));

    const response = await handleInternalAnalysisRunRequest(requestFor(validBody()), {
      env: { ANALYSIS_RUN_SECRET: SECRET },
      loadTakeContext,
      loadAuditionContext,
      now: () => NOW,
      runProcessTake: runner,
    });

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      mark_complete: false,
      ok: true,
      take_id: TAKE_ID,
    });
    expect(loadTakeContext).toHaveBeenCalledWith(TAKE_ID);
    expect(loadAuditionContext).toHaveBeenCalledWith(AUDITION_ID);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(TAKE_ID);
  });

  it("complete takes no-op without calling the runner", async () => {
    const runner = vi.fn(async () => ({ ok: true as const }));
    const response = await handleInternalAnalysisRunRequest(requestFor(validBody()), {
      env: { ANALYSIS_RUN_SECRET: SECRET },
      loadTakeContext: async () => ({
        kind: "ok",
        take: baseTake({ status: "complete", processing_phase: "complete" }),
      }),
      loadAuditionContext: async () => ({ kind: "ok" }),
      now: () => NOW,
      runProcessTake: runner,
    });

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      mark_complete: false,
      ok: true,
      take_id: TAKE_ID,
      already_complete: true,
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it.each(["analysing", "finalising"] as const)(
    "recent %s takes no-op without duplicate analysis",
    async (phase) => {
      const runner = vi.fn(async () => ({ ok: true as const }));
      const response = await handleInternalAnalysisRunRequest(requestFor(validBody()), {
        env: { ANALYSIS_RUN_SECRET: SECRET },
        loadTakeContext: async () => ({
          kind: "ok",
          take: baseTake({
            status: "processing",
            processing_phase: phase,
            updated_at: new Date(NOW - 1_000).toISOString(),
          }),
        }),
        loadAuditionContext: async () => ({ kind: "ok" }),
        now: () => NOW,
        runProcessTake: runner,
      });

      expect(response.status).toBe(200);
      expect(await responseJson(response)).toEqual({
        mark_complete: false,
        ok: false,
        error: "analysis_already_processing",
        retryable: false,
        take_id: TAKE_ID,
      });
      expect(runner).not.toHaveBeenCalled();
    },
  );

  it("stale active processing is left for the reconciler", async () => {
    const runner = vi.fn(async () => ({ ok: true as const }));
    const response = await handleInternalAnalysisRunRequest(requestFor(validBody()), {
      env: { ANALYSIS_RUN_SECRET: SECRET },
      loadTakeContext: async () => ({
        kind: "ok",
        take: baseTake({
          status: "processing",
          processing_phase: "analysing",
          updated_at: new Date(NOW - ANALYSING_ORPHAN_MS - 1).toISOString(),
        }),
      }),
      loadAuditionContext: async () => ({ kind: "ok" }),
      now: () => NOW,
      runProcessTake: runner,
    });

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({
      mark_complete: false,
      ok: false,
      error: "analysis_stale_processing_reconciler_required",
      retryable: false,
      take_id: TAKE_ID,
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it("audition context mismatch fails safely without calling the runner", async () => {
    const runner = vi.fn(async () => ({ ok: true as const }));
    const response = await handleInternalAnalysisRunRequest(
      requestFor(validBody({ audition_id: "44444444-4444-4444-8444-444444444444" })),
      {
        env: { ANALYSIS_RUN_SECRET: SECRET },
        loadTakeContext: async () => ({ kind: "ok", take: baseTake() }),
        loadAuditionContext: async () => ({ kind: "ok" }),
        now: () => NOW,
        runProcessTake: runner,
      },
    );

    expect(response.status).toBe(409);
    expect((await responseJson(response)).error).toBe("audition_context_mismatch");
    expect(runner).not.toHaveBeenCalled();
  });

  it("controlled runner failures are non-retryable and do not expose raw details", async () => {
    const rawMessage =
      "raw prompt signed https://private.example/signed-url secret model response hash";
    const runner = vi.fn(async () => ({ ok: false as const, error: rawMessage }));

    const response = await handleInternalAnalysisRunRequest(requestFor(validBody()), {
      env: { ANALYSIS_RUN_SECRET: SECRET },
      loadTakeContext: async () => ({ kind: "ok", take: baseTake() }),
      loadAuditionContext: async () => ({ kind: "ok" }),
      now: () => NOW,
      runProcessTake: runner,
    });
    const payload = await responseJson(response);
    const serialised = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      mark_complete: false,
      ok: false,
      error: "analysis_run_failed",
      retryable: false,
      take_id: TAKE_ID,
    });
    expect(serialised).not.toContain("raw prompt");
    expect(serialised).not.toContain("signed-url");
    expect(serialised).not.toContain("model response");
    expect(serialised).not.toContain("hash");
  });

  it("unexpected runner exceptions are retryable and do not expose raw details", async () => {
    const runner = vi.fn(async () => {
      throw new Error("raw prompt signed https://private.example/signed-url secret");
    });

    const response = await handleInternalAnalysisRunRequest(requestFor(validBody()), {
      env: { ANALYSIS_RUN_SECRET: SECRET },
      loadTakeContext: async () => ({ kind: "ok", take: baseTake() }),
      loadAuditionContext: async () => ({ kind: "ok" }),
      now: () => NOW,
      runProcessTake: runner,
    });
    const payload = await responseJson(response);
    const serialised = JSON.stringify(payload);

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      mark_complete: false,
      ok: false,
      error: "analysis_run_exception",
      retryable: true,
      take_id: TAKE_ID,
    });
    expect(serialised).not.toContain("raw prompt");
    expect(serialised).not.toContain("signed-url");
    expect(serialised).not.toContain("secret");
  });

  it("runner timeout exceptions use a retryable timeout code", async () => {
    const runner = vi.fn(async () => {
      throw new Error("Timeout exceeded");
    });

    const response = await handleInternalAnalysisRunRequest(requestFor(validBody()), {
      env: { ANALYSIS_RUN_SECRET: SECRET },
      loadTakeContext: async () => ({ kind: "ok", take: baseTake() }),
      loadAuditionContext: async () => ({ kind: "ok" }),
      now: () => NOW,
      runProcessTake: runner,
    });

    expect(response.status).toBe(500);
    expect((await responseJson(response)).error).toBe("analysis_run_timeout");
  });

  it("does not redispatch or enqueue itself", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/internal-analysis-runner.server.ts"),
      "utf8",
    );
    const route = await readFile(
      path.join(process.cwd(), "src/routes/api/internal/run-analysis.ts"),
      "utf8",
    );
    const combined = `${source}\n${route}`;

    expect(route).toContain('createFileRoute("/api/internal/run-analysis")');
    expect(combined).toContain("runProcessTake");
    expect(combined).not.toContain("dispatchAnalysisJob");
    expect(combined).not.toContain("enqueueAnalysisJob");
    expect(combined).not.toContain("enqueueAnalysisJobOrMarkFailed");
    expect(combined).not.toContain("waitUntil");
    expect(combined).not.toContain("scheduleBackground");
  });
});
