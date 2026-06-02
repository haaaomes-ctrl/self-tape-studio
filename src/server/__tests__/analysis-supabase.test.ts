import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimTakeForAnalysis,
  createAnalysisSupabaseClient,
  heartbeatTake,
  loadTakeContext,
  markTakeComplete,
  markTakeError,
  saveQaArtifact,
  saveReport,
  type AnalysisSupabaseClient,
} from "../analysis-supabase.server";

const TAKE_ID = "take-123";
const AUDITION_ID = "aud-789";
const PENDING_CLAIM_FILTER =
  "and(status.eq.pending,processing_phase.in.(analysis_pending,queued,pending))";

type QueueItem = { data?: unknown; error?: unknown };

// A chainable, thenable mock of the Supabase query builder. Awaited update/markError
// chains consume the next queued result via `then`; `maybeSingle()` consumes via its
// own promise. Storage uploads consume via `upload`. Results are a FIFO queue loaded
// per-test in call order.
function makeClient(queue: QueueItem[]) {
  const calls = {
    from: [] as unknown[][],
    update: [] as unknown[][],
    select: [] as unknown[][],
    eq: [] as unknown[][],
    or: [] as unknown[][],
    in: [] as unknown[][],
    maybeSingle: 0,
    storageFrom: [] as unknown[][],
    upload: [] as unknown[][],
  };
  const next = (): QueueItem =>
    queue.length ? (queue.shift() as QueueItem) : { data: null, error: null };

  const builder: Record<string, unknown> = {};
  const record =
    (name: keyof typeof calls) =>
    (...args: unknown[]) => {
      (calls[name] as unknown[][]).push(args);
      return builder;
    };
  builder.update = record("update");
  builder.select = record("select");
  builder.eq = record("eq");
  builder.or = record("or");
  builder.in = record("in");
  builder.maybeSingle = () => {
    calls.maybeSingle += 1;
    return Promise.resolve(next());
  };
  builder.then = (onF: (v: QueueItem) => unknown, onR?: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(onF, onR);

  const storageBuilder = {
    upload: (...args: unknown[]) => {
      calls.upload.push(args);
      return Promise.resolve(next());
    },
  };

  const client = {
    from: (...args: unknown[]) => {
      calls.from.push(args);
      return builder;
    },
    storage: {
      from: (...args: unknown[]) => {
        calls.storageFrom.push(args);
        return storageBuilder;
      },
    },
  } as unknown as AnalysisSupabaseClient;

  return { client, calls };
}

const reportPayload = {
  analysisRunId: "run-1",
  report: { verdict: "submit" },
  scores: { overall: 82 },
  overallScore: 82,
  confidence: 70,
  complianceFlags: { ok: true },
  scoreBreakdown: { acting: 80 },
};

describe("analysis supabase adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims a runnable take once with the exact atomic predicate", async () => {
    const { client, calls } = makeClient([{ data: [{ id: TAKE_ID }], error: null }]);

    const result = await claimTakeForAnalysis(
      TAKE_ID,
      { analysisRunId: "run-1", now: 1_700_000_000_000 },
      null,
      { client },
    );

    expect(result).toEqual({ kind: "claimed", analysisRunId: "run-1" });
    expect(calls.from[0]).toEqual(["takes"]);
    expect(calls.update[0][0]).toEqual({
      status: "processing",
      processing_phase: "analysing",
      error_message: null,
      analysis_run_id: "run-1",
      report_model_status: "pending",
      updated_at: new Date(1_700_000_000_000).toISOString(),
    });
    expect(calls.eq[0]).toEqual(["id", TAKE_ID]);
    expect(calls.or[0]).toEqual([PENDING_CLAIM_FILTER]);
    expect(calls.select[0]).toEqual(["id"]);
    // No readback when the claim wins the row.
    expect(calls.maybeSingle).toBe(0);
  });

  it("no-ops on duplicate delivery to an active processing take (does not reset it)", async () => {
    const { client, calls } = makeClient([
      { data: [], error: null }, // claim updated 0 rows (active row not matched by predicate)
      {
        data: {
          status: "processing",
          processing_phase: "analysing",
          updated_at: "2026-06-02T00:00:00.000Z",
        },
        error: null,
      },
    ]);

    const result = await claimTakeForAnalysis(TAKE_ID, { analysisRunId: "run-1" }, null, {
      client,
    });

    expect(result).toEqual({
      kind: "already_processing",
      processingPhase: "analysing",
      updatedAt: "2026-06-02T00:00:00.000Z",
    });
    // The claim predicate only targets pending/error rows, never processing.
    expect(calls.or[0]).toEqual([PENDING_CLAIM_FILTER]);
    expect(calls.maybeSingle).toBe(1);
  });

  it("no-ops on a take that is already complete", async () => {
    const { client } = makeClient([
      { data: [], error: null },
      { data: { status: "complete", processing_phase: "complete", updated_at: null }, error: null },
    ]);

    const result = await claimTakeForAnalysis(TAKE_ID, { analysisRunId: "run-1" }, null, {
      client,
    });
    expect(result).toEqual({ kind: "already_complete" });
  });

  it("heartbeat updates only updated_at for allowed active phases", async () => {
    const { client, calls } = makeClient([{ data: [{ id: TAKE_ID }], error: null }]);

    const result = await heartbeatTake(TAKE_ID, null, { client });

    expect(result).toEqual({ kind: "updated" });
    // Only updated_at is written.
    expect(Object.keys(calls.update[0][0] as object)).toEqual(["updated_at"]);
    expect(calls.eq[0]).toEqual(["id", TAKE_ID]);
    expect(calls.in).toEqual([
      ["status", ["pending", "processing"]],
      ["processing_phase", ["analysis_pending", "analysing", "finalising"]],
    ]);
  });

  it("loadTakeContext returns raw take + audition rows", async () => {
    const takeRow = { id: TAKE_ID, audition_id: AUDITION_ID, status: "processing" };
    const auditionRow = { id: AUDITION_ID, audition_level: "professional" };
    const { client, calls } = makeClient([
      { data: takeRow, error: null },
      { data: auditionRow, error: null },
    ]);

    const result = await loadTakeContext(TAKE_ID, null, { client });

    expect(result).toMatchObject({ kind: "loaded", take: takeRow, audition: auditionRow });
    expect(calls.from).toEqual([["takes"], ["auditions"]]);
    expect(calls.eq).toEqual([
      ["id", TAKE_ID],
      ["id", AUDITION_ID],
    ]);
    expect(calls.maybeSingle).toBe(2);
  });

  it("loadTakeContext reports take_not_found", async () => {
    const { client } = makeClient([{ data: null, error: null }]);
    const result = await loadTakeContext(TAKE_ID, null, { client });
    expect(result).toEqual({ kind: "take_not_found" });
  });

  it("saveReport writes report columns without flipping status, guarded by run id", async () => {
    const { client, calls } = makeClient([{ data: [{ id: TAKE_ID }], error: null }]);

    const result = await saveReport(TAKE_ID, reportPayload, null, { client });

    expect(result).toEqual({ kind: "saved" });
    const payload = calls.update[0][0] as Record<string, unknown>;
    // Must NOT mark complete.
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("processing_phase");
    expect(payload.report_model_status).toBe("rendered");
    expect(payload.report).toEqual(reportPayload.report);
    // Guarded by active processing state AND the caller-supplied run id.
    expect(calls.eq).toEqual([
      ["id", TAKE_ID],
      ["status", "processing"],
      ["analysis_run_id", "run-1"],
    ]);
    expect(calls.in).toEqual([["processing_phase", ["analysing", "finalising"]]]);
  });

  it("markTakeComplete atomically writes report columns AND complete state in one guarded update", async () => {
    const { client, calls } = makeClient([{ data: [{ id: TAKE_ID }], error: null }]);

    const result = await markTakeComplete(TAKE_ID, reportPayload, null, { client });

    expect(result).toEqual({ kind: "completed" });
    expect(calls.update[0][0]).toEqual({
      status: "complete",
      processing_phase: "complete",
      analysis_run_id: "run-1",
      report_model_status: "rendered",
      report: reportPayload.report,
      scores: reportPayload.scores,
      overall_score: 82,
      confidence: 70,
      error_message: null,
      compliance_flags: reportPayload.complianceFlags,
      score_breakdown: reportPayload.scoreBreakdown,
    });
    // Existing pipeline completion guard PLUS the run-id ownership guard.
    expect(calls.eq).toEqual([
      ["id", TAKE_ID],
      ["status", "processing"],
      ["analysis_run_id", "run-1"],
    ]);
    expect(calls.in).toEqual([["processing_phase", ["analysing", "finalising"]]]);
  });

  it("markTakeComplete no-ops (not_active) when the run matches but the state is no longer active", async () => {
    const { client } = makeClient([
      { data: [], error: null }, // guarded update matched 0 rows
      {
        data: { status: "complete", processing_phase: "complete", analysis_run_id: "run-1" },
        error: null,
      },
    ]);
    const result = await markTakeComplete(TAKE_ID, reportPayload, null, { client });
    expect(result).toEqual({ kind: "not_active" });
  });

  it("markTakeError writes the safe [failure_code:...] format, guarded by run id", async () => {
    const { client, calls } = makeClient([{ data: [{ id: TAKE_ID }], error: null }]);

    const result = await markTakeError(
      TAKE_ID,
      "analysis_timeout",
      "Analysis exceeded the time budget",
      "run-9",
      null,
      { client },
    );

    expect(result).toEqual({ kind: "marked" });
    expect(calls.update[0][0]).toEqual({
      status: "error",
      processing_phase: "error",
      error_message: "[failure_code:analysis_timeout] Analysis exceeded the time budget",
      analysis_run_id: "run-9",
      report_model_status: "failed",
    });
    expect(calls.eq).toEqual([
      ["id", TAKE_ID],
      ["status", "processing"],
      ["analysis_run_id", "run-9"],
    ]);
    expect(calls.in).toEqual([["processing_phase", ["analysing", "finalising"]]]);
  });

  it("a stale run cannot saveReport / markTakeComplete / markTakeError over a reclaimed take", async () => {
    // For each helper: the guarded update matches 0 rows, then the readback shows
    // the row is owned by a NEWER analysis_run_id => stale_run safe no-op.
    const reclaimedReadback = {
      data: { status: "processing", processing_phase: "analysing", analysis_run_id: "newer-run" },
      error: null,
    };

    const save = makeClient([{ data: [], error: null }, reclaimedReadback]);
    expect(await saveReport(TAKE_ID, reportPayload, null, { client: save.client })).toEqual({
      kind: "stale_run",
    });

    const complete = makeClient([{ data: [], error: null }, reclaimedReadback]);
    expect(
      await markTakeComplete(TAKE_ID, reportPayload, null, { client: complete.client }),
    ).toEqual({ kind: "stale_run" });

    const err = makeClient([{ data: [], error: null }, reclaimedReadback]);
    expect(
      await markTakeError(TAKE_ID, "analysis_timeout", "late failure", "run-1", null, {
        client: err.client,
      }),
    ).toEqual({ kind: "stale_run" });
  });

  it("returns server_misconfigured (safe diagnostics) when the service-role key is absent", async () => {
    // No deps.client => the client is built from env, which lacks the service-role key.
    const result = await claimTakeForAnalysis(
      TAKE_ID,
      { analysisRunId: "run-1" },
      { TAPECOACH_SUPABASE_URL: "https://owned-project.supabase.co" },
    );

    expect(result).toMatchObject({
      kind: "server_misconfigured",
      code: "server_misconfigured",
      diagnostics: {
        supabase_url_configured: true,
        supabase_url_host: "owned-project.supabase.co",
        supabase_service_role_key_configured: false,
      },
    });
    // createAnalysisSupabaseClient surfaces the same safe failure, never throwing.
    const created = createAnalysisSupabaseClient({
      TAPECOACH_SUPABASE_URL: "https://owned-project.supabase.co",
    });
    expect(created).toEqual({
      ok: false,
      code: "server_misconfigured",
      diagnostics: {
        supabase_url_configured: true,
        supabase_url_host: "owned-project.supabase.co",
        supabase_service_role_key_configured: false,
      },
    });
  });

  it("returns server_misconfigured instead of throwing when the Supabase URL is malformed", () => {
    // Both values are present (pass the presence check) but the URL is invalid;
    // createClient throws on it. The adapter must catch and fail safe, not throw.
    const result = createAnalysisSupabaseClient({
      TAPECOACH_SUPABASE_URL: "not a valid url",
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "owned-service-role",
    });
    expect(result).toMatchObject({ ok: false, code: "server_misconfigured" });
  });

  it("writes QA artefacts to the configured bucket, defaulting to qa-artifacts", async () => {
    // Custom configured bucket.
    const custom = makeClient([{ error: null }]);
    const customResult = await saveQaArtifact(
      { storagePath: "take-abc/analysis-run-1/qa/manifest.json", body: '{"ok":true}' },
      { QA_ARTIFACT_STORAGE_BUCKET: "custom-bucket" },
      { client: custom.client },
    );
    expect(customResult).toMatchObject({
      kind: "written",
      bucket: "custom-bucket",
      storagePath: "take-abc/analysis-run-1/qa/manifest.json",
    });
    expect(custom.calls.storageFrom[0]).toEqual(["custom-bucket"]);
    expect(custom.calls.upload[0]).toEqual([
      "take-abc/analysis-run-1/qa/manifest.json",
      '{"ok":true}',
      { upsert: true, contentType: "application/json" },
    ]);

    // No configured bucket => default qa-artifacts. Pass an explicit empty env
    // (not null) so bucket resolution cannot pick up an ambient process.env value.
    const dflt = makeClient([{ error: null }]);
    const dfltResult = await saveQaArtifact(
      { storagePath: "p.json", body: "{}" },
      {},
      {
        client: dflt.client,
      },
    );
    expect(dfltResult).toMatchObject({ kind: "written", bucket: "qa-artifacts" });
  });

  it("returns a safe qa_write_failed when the storage upload fails", async () => {
    const { client } = makeClient([{ error: { message: "Bucket not found", code: "404" } }]);
    const result = await saveQaArtifact(
      { storagePath: "p.json", body: "{}" },
      { QA_ARTIFACT_STORAGE_BUCKET: "qa-artifacts" },
      { client },
    );
    expect(result).toMatchObject({
      kind: "qa_write_failed",
      bucket: "qa-artifacts",
      error: { code: "404", message: "Bucket not found" },
    });
  });

  it("keeps the adapter server-only and out of client-imported modules", async () => {
    const moduleSource = await readFile(
      path.join(process.cwd(), "src/server/analysis-supabase.server.ts"),
      "utf8",
    );
    expect(moduleSource).toContain("SERVER-ONLY");
    // Cancellation + active-version checks are documented as runner preflight (Slice 4/5).
    expect(moduleSource).toContain("RUNNER PREFLIGHT");
    expect(moduleSource).toContain("Cancelled by user");
    expect(moduleSource).toContain("take_version_status");

    const clientImportedModules = [
      "src/lib/admin-storage.functions.ts",
      "src/server-fns/account-compliance.functions.ts",
      "src/server-fns/credit-balance.functions.ts",
      "src/server-fns/mux.functions.ts",
      "src/integrations/supabase/client.ts",
    ];
    for (const modulePath of clientImportedModules) {
      const source = await readFile(path.join(process.cwd(), modulePath), "utf8");
      expect(source).not.toMatch(/from\s+["'][^"']*analysis-supabase\.server["']/);
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
