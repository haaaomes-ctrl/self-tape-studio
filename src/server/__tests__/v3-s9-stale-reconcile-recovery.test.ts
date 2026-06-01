import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyStaticRenditionReadyTake } from "@/routes/api/public/mux-webhook";
import { isAuthorisedReconcilerRequest } from "@/routes/api/public/reconcile-stale-takes";
import {
  ANALYSING_ORPHAN_MS,
  FINALISING_ORPHAN_MS,
  analysingOrphanCutoffIso,
  finalisingOrphanCutoffIso,
  isAnalysingHeartbeatStale,
  isFinalisingHeartbeatStale,
} from "@/server/finalising-recovery.server";
import { dispatchAnalysisJob } from "@/server/analysis-job-queue.server";
import { runReportPolish } from "@/server/report-polish.server";
import type { EvidencePass } from "@/server/evidence-pass.server";

describe("v3 s9 stale reconcile recovery guardrails", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("authorises the internal reconciler via custom or bearer secret only", () => {
    const env = { RECONCILER_SECRET: "expected-secret" };
    const customHeader = new Request("https://example.test/api/public/reconcile-stale-takes", {
      method: "POST",
      headers: { "x-reconciler-secret": "expected-secret" },
    });
    const bearerHeader = new Request("https://example.test/api/public/reconcile-stale-takes", {
      method: "POST",
      headers: { authorization: "Bearer expected-secret" },
    });
    const anonymous = new Request("https://example.test/api/public/reconcile-stale-takes", {
      method: "POST",
    });

    expect(isAuthorisedReconcilerRequest(customHeader, env)).toBe("authorised");
    expect(isAuthorisedReconcilerRequest(bearerHeader, env)).toBe("authorised");
    expect(isAuthorisedReconcilerRequest(anonymous, env)).toBe("unauthorised");
    expect(isAuthorisedReconcilerRequest(customHeader, {})).toBe("not_configured");
  });

  it("static rendition ready skips fresh in-flight work but recovers stale analysing/finalising takes", () => {
    expect(
      classifyStaticRenditionReadyTake({
        status: "processing",
        processing_phase: "analysing",
        stale_heartbeat_ms: 5_000,
      }),
    ).toBe("skip_fresh_inflight");

    expect(
      classifyStaticRenditionReadyTake({
        status: "processing",
        processing_phase: "analysing",
        stale_heartbeat_ms: 45_000,
      }),
    ).toBe("skip_fresh_inflight");

    expect(
      classifyStaticRenditionReadyTake({
        status: "processing",
        processing_phase: "analysing",
        stale_heartbeat_ms: 120_000,
      }),
    ).toBe("recover_stale_analysing");

    expect(
      classifyStaticRenditionReadyTake({
        status: "processing",
        processing_phase: "finalising",
        stale_heartbeat_ms: FINALISING_ORPHAN_MS - 1,
      }),
    ).toBe("skip_fresh_inflight");

    expect(
      classifyStaticRenditionReadyTake({
        status: "processing",
        processing_phase: "finalising",
        stale_heartbeat_ms: FINALISING_ORPHAN_MS,
      }),
    ).toBe("recover_stale_finalising");

    expect(
      classifyStaticRenditionReadyTake({
        status: "complete",
        processing_phase: "complete",
        stale_heartbeat_ms: 45_000,
      }),
    ).toBe("skip_terminal");
  });

  it("persists completion before optional QA artefact emission", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    const persistIndex = source.indexOf("analysis_persist_completed");
    const qaIndex = source.indexOf("emitQAManifestForAnalysisRun_start");
    expect(persistIndex).toBeGreaterThan(0);
    expect(qaIndex).toBeGreaterThan(0);
    expect(persistIndex).toBeLessThan(qaIndex);
    expect(source).toContain("} catch (qaErr) {");
    expect(source).toContain("internal_qa_emit_warning");
  });

  it("classifies provider contract failures without Mux URL retry loops and emits failure QA context", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    expect(source).toContain("provider_request_contract_error");
    expect(source).toContain("shouldRetryWithFreshMuxUrl");
    expect(source).toContain("didMuxUrlRecoveryRetry");
    expect(source).toContain("emitPreReportFailureManifest");
    expect(source).toContain("pre_report_failure_qa_manifest_emitted");
    expect(source).not.toContain("urlForCall === resolvedProbeUrl");
  });

  it("analysis claims move queued rows into the active analysing state", async () => {
    const processTake = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    const retryFn = await readFile(
      path.join(process.cwd(), "src/server-fns/process-take.functions.ts"),
      "utf8",
    );
    const claimStart = processTake.indexOf("export async function claimAnalysisRunForTake");
    const claimEnd = processTake.indexOf("export type SubmissionVerdict", claimStart);
    const claimHelper = processTake.slice(claimStart, claimEnd);

    expect(claimStart).toBeGreaterThan(0);
    expect(claimHelper).toContain('status: "processing"');
    expect(claimHelper).toContain('processing_phase: "analysing"');
    expect(claimHelper).not.toContain('processing_phase: "analysis_pending"');
    expect(processTake).toContain("ANALYSIS_PENDING_CLAIM_FILTER");
    expect(processTake).toContain("ANALYSIS_RETRY_ERROR_CLAIM_FILTER");
    expect(retryFn).toContain("includeErrorRetry: true");
  });

  it("stale pending reconciliation only resets queued pending rows", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/routes/api/public/reconcile-stale-takes.ts"),
      "utf8",
    );
    const pendingSelectStart = source.indexOf("const { data: stalePending");
    const pendingSelectEnd = source.indexOf("const { data: staleAnalysing", pendingSelectStart);
    const pendingSelect = source.slice(pendingSelectStart, pendingSelectEnd);
    const resetStart = source.indexOf("const { data: resetRow");
    const resetEnd = source.indexOf("if (updErr)", resetStart);
    const resetWrite = source.slice(resetStart, resetEnd);
    const giveUpStart = source.indexOf("const { data: failedRow");
    const giveUpEnd = source.indexOf("if (failErr)", giveUpStart);
    const giveUpWrite = source.slice(giveUpStart, giveUpEnd);

    expect(pendingSelect).toContain('.eq("status", "pending")');
    expect(pendingSelect).toContain('.eq("processing_phase", "analysis_pending")');
    expect(resetWrite).toContain('.eq("status", "pending")');
    expect(resetWrite).toContain(
      '.eq("processing_phase", take.processing_phase ?? "analysis_pending")',
    );
    expect(giveUpWrite).toContain('.eq("status", "pending")');
    expect(source).toContain("reschedule skipped because row was claimed");
    expect(source).toContain("give-up skipped because row was claimed");
  });

  it("reconciler enqueues stale analysing rows instead of running analysis in request waitUntil", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/routes/api/public/reconcile-stale-takes.ts"),
      "utf8",
    );
    expect(source).toContain('.eq("processing_phase", "analysing")');
    expect(source).toContain('status: "pending"');
    expect(source).toContain('processing_phase: "analysis_pending"');
    expect(source).toContain("enqueueAnalysisJobOrMarkFailed");
    expect(source).toContain("reconciler_stale_analysing");
    expect(source).not.toContain("scheduleBackground(");
    expect(source).not.toContain("runProcessTake(take.id)");
  });

  it("reconciler force-errors stale finalising rows and keeps the cron endpoint authenticated", async () => {
    const reconciler = await readFile(
      path.join(process.cwd(), "src/routes/api/public/reconcile-stale-takes.ts"),
      "utf8",
    );
    const recovery = await readFile(
      path.join(process.cwd(), "src/server/finalising-recovery.server.ts"),
      "utf8",
    );
    const source = `${reconciler}\n${recovery}`;
    expect(reconciler).toContain("FINALISING_ORPHAN_WINDOW_SECONDS");
    expect(reconciler).toContain("finalisingOrphanCutoffIso(now)");
    expect(reconciler).toContain('.eq("processing_phase", "finalising")');
    expect(reconciler).toContain("recoverFinalisingTake");
    expect(source).toContain("finalising_orphan_recovered_complete");
    expect(source).toContain('reason: "report_present"');
    expect(source).toContain("finalising_orphan_forced_error");
    expect(source).toContain("[failure_code:finalising_orphan]");
    expect(reconciler).toContain("x-reconciler-secret");
    expect(reconciler).toContain("Authorization: Bearer <secret>");
  });

  it("reconciler force-errors stale analysing rows and recovers complete analysing rows with reports", async () => {
    const reconciler = await readFile(
      path.join(process.cwd(), "src/routes/api/public/reconcile-stale-takes.ts"),
      "utf8",
    );
    const recovery = await readFile(
      path.join(process.cwd(), "src/server/finalising-recovery.server.ts"),
      "utf8",
    );
    const source = `${reconciler}\n${recovery}`;
    expect(reconciler).toContain("ANALYSING_ORPHAN_WINDOW_SECONDS");
    expect(reconciler).toContain("analysingOrphanCutoffIso(now)");
    expect(reconciler).toContain("staleAnalysingOrphans");
    expect(reconciler).toContain("recoverAnalysingTake");
    expect(reconciler).toContain("analysingForcedError");
    expect(reconciler).toContain("analysingRecoveredComplete");
    expect(source).toContain("analysing_orphan_recovered_complete");
    expect(source).toContain("analysing_orphan_forced_error");
    expect(source).toContain("[failure_code:analysing_orphan]");
  });

  it("finalising orphan threshold is short enough for polling recovery", () => {
    expect(isFinalisingHeartbeatStale(FINALISING_ORPHAN_MS - 1)).toBe(false);
    expect(isFinalisingHeartbeatStale(FINALISING_ORPHAN_MS)).toBe(true);
    expect(finalisingOrphanCutoffIso(100_000 + FINALISING_ORPHAN_MS)).toBe(
      new Date(100_000).toISOString(),
    );
  });

  it("analysing orphan threshold reaps dead AI workers after the polish window", () => {
    expect(isAnalysingHeartbeatStale(ANALYSING_ORPHAN_MS - 1)).toBe(false);
    expect(isAnalysingHeartbeatStale(ANALYSING_ORPHAN_MS)).toBe(true);
    expect(analysingOrphanCutoffIso(100_000 + ANALYSING_ORPHAN_MS)).toBe(
      new Date(100_000).toISOString(),
    );
  });

  it("report polish fetch has a bounded timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined;
            signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          }),
      ),
    );

    const resultPromise = runReportPolish({
      apiKey: "test-key",
      signal: new AbortController().signal,
      evidence: {
        evidence_version: "1",
        audition_type: "musical_theatre",
        detected_components: [],
        observed_tape_sequence: [],
        component_verifications: [],
        raw_scores: {
          technical: 0,
          audio: 0,
          vocal: null,
          acting: 0,
          brief_adherence: 0,
          professional_presentation: 0,
        },
        core_strengths_evidence: [],
        core_improvements_evidence: [],
        fix_first_evidence: "test",
        brief_adherence_evidence: {
          material_compliance: "test",
          technical_compliance: "test",
          instruction_precision: "test",
          professionalism_signals: "test",
          score_material: 0,
          score_technical: 0,
          score_instruction: 0,
          score_professional: 0,
        },
        category_notes_evidence: {
          technical: "test",
          audio: "test",
          vocal: "test",
          acting: "test",
          brief_adherence: "test",
          professional_presentation: "test",
        },
        role_fit_evidence: "test",
        role_fit_modifier_suggested: 0,
        role_fit_confidence: "low",
        presentation_evidence: [],
        risk_evidence: [],
        timestamped_evidence: [],
        evidence_sufficiency: {
          audio_assessable: true,
          video_assessable: true,
          acting_assessable: true,
          vocal_assessable: false,
          movement_assessable: false,
          brief_assessable: true,
          role_fit_assessable: false,
          notes: "test",
        },
      } satisfies EvidencePass,
      briefBlock: "Brief: test",
      extractedBlock: "Extracted brief: test",
      signalsBlock: "Signals: test",
      levelBlock: "Level: professional",
      auditionTitle: "Test audition",
      reportTool: {},
    });

    await vi.advanceTimersByTimeAsync(90_000);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("report_polish_timeout");
      expect(result.safe_error_category).toBe("provider_timeout");
    }
  });

  it("mux webhook enqueues analysis jobs instead of running analysis in waitUntil", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/routes/api/public/mux-webhook.ts"),
      "utf8",
    );
    const compactSource = source.replace(/\s+/g, " ");
    expect(source).toContain("enqueueAnalysisJobOrMarkFailed");
    expect(source).toContain('reason: "mux_asset_ready"');
    expect(compactSource).toContain(
      'reason: recoveryAction === "recover_stale_analysing" ? "static_rendition_stale_analysing" : "static_rendition_ready"',
    );
    expect(source).not.toContain("scheduleBackground(");
    expect(source).not.toContain("runProcessTake(takeId)");
  });

  it("worker queue consumer owns runProcessTake execution", async () => {
    const source = await readFile(path.join(process.cwd(), "src/worker-entry.ts"), "utf8");
    expect(source).toContain("async queue(");
    expect(source).toContain('await import("@/server/process-take.server")');
    expect(source).toContain("runProcessTake(body.takeId)");
  });

  it("wrangler binds the durable analysis queue producer and consumer", async () => {
    const source = await readFile(path.join(process.cwd(), "wrangler.jsonc"), "utf8");
    expect(source).toContain('"binding": "ANALYSIS_QUEUE"');
    expect(source).toContain('"queue": "tapecoach-analysis-jobs"');
    expect(source).toContain('"max_batch_size": 1');
  });

  it("wrangler raises the queue-consumer CPU budget for the two-step report build", async () => {
    const source = await readFile(path.join(process.cwd(), "wrangler.jsonc"), "utf8");
    // The two-step pipeline builds/re-validates large report objects multiple
    // times per take (polish + module-repair retry + readiness/enforcement) on
    // 10-min-max self-tapes. CPU time is active processing only (not the Gemini
    // I/O wait), but the 30s default ceiling is a real exhaustion risk → must be
    // raised to the 5-minute queue-consumer maximum (300000ms) so a healthy take
    // is not killed (`exceededCpu`) before it persists.
    expect(source).toContain('"cpu_ms": 300000');
  });

  it("analysis dispatch uses queue when the binding is available", async () => {
    const sent: unknown[] = [];
    const scheduled: Promise<unknown>[] = [];
    const result = await dispatchAnalysisJob(
      { takeId: "take-queue", reason: "mux_asset_ready" },
      {
        env: {
          ANALYSIS_QUEUE: {
            send: async (message) => {
              sent.push(message);
            },
          },
        },
        hasRequestContext: () => true,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => ({ ok: true }),
      },
    );

    expect(result).toEqual({ ok: true, method: "queue" });
    expect(sent).toHaveLength(1);
    expect(scheduled).toHaveLength(0);
  });

  it("analysis dispatch uses the external worker when configured", async () => {
    const sent: unknown[] = [];
    const scheduled: Promise<unknown>[] = [];
    let runCount = 0;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Response.json({ ok: true, dispatch_method: "queue", queued: true }),
    );

    const result = await dispatchAnalysisJob(
      {
        takeId: "take-external",
        reason: "mux_asset_ready",
        auditionId: "audition-external",
      },
      {
        env: {
          ANALYSIS_DISPATCH_URL: "https://analysis-worker.example/dispatch-analysis",
          ANALYSIS_DISPATCH_SECRET: "test-secret",
          ANALYSIS_QUEUE: {
            send: async (message) => {
              sent.push(message);
            },
          },
        },
        fetch: fetchMock as unknown as typeof fetch,
        hasRequestContext: () => true,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => {
          runCount += 1;
          return { ok: true };
        },
      },
    );

    expect(result).toEqual({ ok: true, method: "queue" });
    expect(sent).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
    expect(runCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://analysis-worker.example/dispatch-analysis");
    expect(init?.headers).toEqual({
      authorization: "Bearer test-secret",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      take_id: "take-external",
      audition_id: "audition-external",
      submission_id: "audition-external",
      trigger: "mux_webhook",
      reason: "mux_asset_ready",
    });
  });

  it("external analysis dispatch unauthorised response fails safely without waitUntil fallback", async () => {
    const scheduled: Promise<unknown>[] = [];
    let runCount = 0;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Response.json({ ok: false, error: "unauthorised" }, { status: 401 }),
    );

    const result = await dispatchAnalysisJob(
      {
        takeId: "take-unauthorised",
        reason: "static_rendition_ready",
        auditionId: "audition-unauthorised",
      },
      {
        env: {
          ANALYSIS_DISPATCH_URL: "https://analysis-worker.example/dispatch-analysis",
          ANALYSIS_DISPATCH_SECRET: "wrong-secret",
        },
        fetch: fetchMock as unknown as typeof fetch,
        hasRequestContext: () => true,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => {
          runCount += 1;
          return { ok: true };
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_external_dispatch_unauthorised",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(0);
    expect(runCount).toBe(0);
  });

  it("external analysis dispatch queue-unavailable response fails safely without waitUntil fallback", async () => {
    const scheduled: Promise<unknown>[] = [];
    let runCount = 0;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Response.json({ ok: false, dispatch_method: "queue_unavailable", queued: false }),
    );

    const result = await dispatchAnalysisJob(
      {
        takeId: "take-queue-unavailable",
        reason: "reconciler_stale_pending",
        auditionId: "audition-queue-unavailable",
      },
      {
        env: {
          ANALYSIS_DISPATCH_URL: "https://analysis-worker.example/dispatch-analysis",
          ANALYSIS_DISPATCH_SECRET: "test-secret",
        },
        fetch: fetchMock as unknown as typeof fetch,
        hasRequestContext: () => true,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => {
          runCount += 1;
          return { ok: true };
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_external_queue_unavailable",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(0);
    expect(runCount).toBe(0);
  });

  it("external analysis dispatch network failure does not silently use waitUntil fallback", async () => {
    const scheduled: Promise<unknown>[] = [];
    let runCount = 0;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
        throw new Error("network unavailable");
      },
    );

    const result = await dispatchAnalysisJob(
      {
        takeId: "take-network-failure",
        reason: "reconciler_stale_analysing",
        auditionId: "audition-network-failure",
      },
      {
        env: {
          ANALYSIS_DISPATCH_URL: "https://analysis-worker.example/dispatch-analysis",
          ANALYSIS_DISPATCH_SECRET: "test-secret",
        },
        fetch: fetchMock as unknown as typeof fetch,
        hasRequestContext: () => true,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => {
          runCount += 1;
          return { ok: true };
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_external_dispatch_failed",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(0);
    expect(runCount).toBe(0);
  });

  it("external analysis dispatch aborts hung worker requests without waitUntil fallback", async () => {
    vi.useFakeTimers();
    const scheduled: Promise<unknown>[] = [];
    let runCount = 0;
    let abortObserved = false;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            abortObserved = true;
            const error = new Error("aborted before start");
            error.name = "AbortError";
            reject(error);
            return;
          }
          signal?.addEventListener("abort", () => {
            abortObserved = true;
            const error = new Error("aborted by timeout");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );

    const resultPromise = dispatchAnalysisJob(
      {
        takeId: "take-hung-external-dispatch",
        reason: "mux_asset_ready",
        auditionId: "audition-hung-external-dispatch",
      },
      {
        env: {
          ANALYSIS_DISPATCH_URL: "https://analysis-worker.example/dispatch-analysis",
          ANALYSIS_DISPATCH_SECRET: "test-secret",
        },
        fetch: fetchMock as unknown as typeof fetch,
        hasRequestContext: () => true,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => {
          runCount += 1;
          return { ok: true };
        },
      },
    );

    await vi.advanceTimersByTimeAsync(15_000);
    const result = await resultPromise;

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_external_dispatch_timeout",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(abortObserved).toBe(true);
    expect(scheduled).toHaveLength(0);
    expect(runCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("external analysis dispatch requires a secret and does not make an unauthenticated request", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Response.json({ ok: true, dispatch_method: "queue", queued: true }),
    );

    const result = await dispatchAnalysisJob(
      {
        takeId: "take-missing-secret",
        reason: "mux_asset_ready",
        auditionId: "audition-missing-secret",
      },
      {
        env: {
          ANALYSIS_DISPATCH_URL: "https://analysis-worker.example/dispatch-analysis",
        },
        fetch: fetchMock as unknown as typeof fetch,
        hasRequestContext: () => true,
      },
    );

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_external_dispatch_secret_missing",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("analysis dispatch falls back to waitUntil when queue binding is missing", async () => {
    const scheduled: Promise<unknown>[] = [];
    let runCount = 0;
    const result = await dispatchAnalysisJob(
      { takeId: "take-fallback", reason: "mux_asset_ready" },
      {
        env: {},
        hasRequestContext: () => true,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => {
          runCount += 1;
          return { ok: true };
        },
      },
    );
    await Promise.all(scheduled);

    expect(result).toEqual({ ok: true, method: "wait_until_fallback" });
    expect(scheduled).toHaveLength(1);
    expect(runCount).toBe(1);
  });

  it("analysis dispatch falls back to waitUntil when queue send fails", async () => {
    const scheduled: Promise<unknown>[] = [];
    let runCount = 0;
    const result = await dispatchAnalysisJob(
      { takeId: "take-send-failure", reason: "static_rendition_ready" },
      {
        env: {
          ANALYSIS_QUEUE: {
            send: async () => {
              throw new Error("queue unavailable");
            },
          },
        },
        hasRequestContext: () => true,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => {
          runCount += 1;
          return { ok: true };
        },
      },
    );
    await Promise.all(scheduled);

    expect(result).toEqual({ ok: true, method: "wait_until_fallback" });
    expect(scheduled).toHaveLength(1);
    expect(runCount).toBe(1);
  });

  it("analysis dispatch fails only when queue and waitUntil fallback are unavailable", async () => {
    const scheduled: Promise<unknown>[] = [];
    const result = await dispatchAnalysisJob(
      { takeId: "take-no-dispatch", reason: "mux_asset_ready" },
      {
        env: {},
        hasRequestContext: () => false,
        scheduleBackground: (promise) => {
          scheduled.push(promise);
        },
        runProcessTake: async () => ({ ok: true }),
      },
    );

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_dispatch_unavailable",
    });
    expect(scheduled).toHaveLength(0);
  });

  it("analysis dispatch returns a safe failure when fallback scheduling throws", async () => {
    let runCount = 0;
    const result = await dispatchAnalysisJob(
      { takeId: "take-scheduler-failure", reason: "mux_asset_ready" },
      {
        env: {},
        hasRequestContext: () => true,
        scheduleBackground: () => {
          throw new Error("waitUntil unavailable");
        },
        runProcessTake: async () => {
          runCount += 1;
          return { ok: true };
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      method: "none",
      failureCode: "analysis_dispatch_unavailable",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runCount).toBe(0);
  });

  it("missing queue binding is not a performer-facing terminal failure by itself", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/analysis-job-queue.server.ts"),
      "utf8",
    );
    expect(source).toContain("ANALYSIS_QUEUE binding unavailable; using waitUntil fallback");
    expect(source).not.toContain("[failure_code:analysis_queue_unavailable] We couldn");
  });

  it("finalising terminal writes only mark ownership after the DB update succeeds", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    const helperStart = source.indexOf("const markTerminalFailure = async");
    const helperEnd = source.indexOf("// Carries a failure_code", helperStart);
    const helper = source.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helper).toContain('status: "error"');
    expect(helper).toContain('processing_phase: "error"');
    expect(helper.indexOf("if (writeErr) throw writeErr")).toBeGreaterThan(0);
    expect(helper.indexOf("terminalWritten = true")).toBeGreaterThan(
      helper.indexOf("if (writeErr) throw writeErr"),
    );
  });

  it("process take heartbeats before polish and terminals polish failures", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    expect(source).toContain("report_polish_heartbeat_failed");
    expect(source).toContain("updated_at: new Date().toISOString()");
    expect(source).toContain('"report_polish_timeout"');
    expect(source).toContain('"report_polish_failed"');
    expect(source).toContain("throw new AnalysisFailure(");
    expect(source).not.toContain("report_polish_failed; falling through to s10 single-pass");
  });

  it("mux webhook logs a safe body summary instead of signed raw upload URLs", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/routes/api/public/mux-webhook.ts"),
      "utf8",
    );
    expect(source).toContain("MUX WEBHOOK BODY SUMMARY");
    expect(source).not.toContain("MUX WEBHOOK RAW BODY");
    expect(source).not.toContain("body: rawBody");
  });

  it("cron migration targets the canonical production reconciler URL with the secret header", async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260525162500_reconcile_stale_takes_canonical_repair.sql",
      ),
      "utf8",
    );
    expect(source).toContain("https://tapecoach.co.uk/api/public/reconcile-stale-takes");
    expect(source).toContain("'x-reconciler-secret'");
    expect(source).toContain("vault.decrypted_secrets");
    expect(source).not.toContain("project--af0c387f-c90b-4efa-b943-dc325d1a44f5");
  });

  it("smoke cleanup migration removes stale reconciler cron URLs before rescheduling canonical production", async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260530152500_cleanup_smoke_test_tech_debt.sql",
      ),
      "utf8",
    );
    const scheduledCommand = source.slice(source.indexOf("SELECT cron.schedule"));

    expect(source).toContain("cron.unschedule(job.jobid)");
    expect(source).toContain(
      "project--af0c387f-c90b-4efa-b943-dc325d1a44f5.lovable.app/api/public/reconcile-stale-takes",
    );
    expect(source).toContain("selftape.lovable.app/api/public/reconcile-stale-takes");
    expect(scheduledCommand).toContain("https://tapecoach.co.uk/api/public/reconcile-stale-takes");
    expect(scheduledCommand).toContain("'x-reconciler-secret'");
    expect(scheduledCommand).toContain("vault.decrypted_secrets");
    expect(scheduledCommand).not.toContain("project--af0c387f-c90b-4efa-b943-dc325d1a44f5");
    expect(scheduledCommand).not.toContain("selftape.lovable.app");
  });

  it("email queue cleanup migration removes preview-token cron wiring before scheduling canonical production", async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260530215700_email_queue_canonical_runtime_wiring.sql",
      ),
      "utf8",
    );
    const scheduledCommand = source.slice(source.indexOf("SELECT cron.schedule"));

    expect(source).toContain("cron.unschedule(jobid)");
    expect(source).toContain("process-email-queue");
    expect(source).toContain("id-preview--%.lovable.app");
    expect(source).toContain("__lovable_token");
    expect(scheduledCommand).toContain("https://tapecoach.co.uk/lovable/email/queue/process");
    expect(scheduledCommand).toContain("'Authorization'");
    expect(scheduledCommand).toContain("email_queue_service_role_key");
    expect(scheduledCommand).toContain("dispatcher_mode");
    expect(scheduledCommand).toContain("'enabled'");
    expect(scheduledCommand).not.toContain("id-preview--");
    expect(scheduledCommand).not.toContain("__lovable_token");
    expect(scheduledCommand).not.toContain(".lovable.app/lovable/email/queue/process");
  });

  it("one-off migration clears the observed stuck analysing live take only if it is still stuck", async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260525171000_unblock_stuck_analysing_take.sql",
      ),
      "utf8",
    );
    expect(source).toContain("id = 'fce09a52-f266-4053-9421-ced2d892bc9a'");
    expect(source).toContain("[failure_code:analysing_orphan]");
    expect(source).toContain("status = 'processing'");
    expect(source).toContain("processing_phase = 'analysing'");
  });
});
