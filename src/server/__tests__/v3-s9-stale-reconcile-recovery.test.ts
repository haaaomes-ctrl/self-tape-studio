import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyStaticRenditionReadyTake } from "@/routes/api/public/mux-webhook";
import { isAuthorisedReconcilerRequest } from "@/routes/api/public/reconcile-stale-takes";

describe("v3 s9 stale reconcile recovery guardrails", () => {
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

  it("static rendition ready skips fresh in-flight work but recovers stale analysing takes", () => {
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
    ).toBe("recover_stale_analysing");

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

  it("guards Gemini 400 Mux URL recovery as a one-shot path", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    const recoveryStart = source.indexOf("One-shot stale-URL recovery for 400");
    const hardErrorStart = source.indexOf("Hard, non-retryable: 402 (credits).");
    const recoveryBlock = source.slice(recoveryStart, hardErrorStart);

    expect(recoveryStart).toBeGreaterThan(0);
    expect(hardErrorStart).toBeGreaterThan(recoveryStart);
    expect(source).toContain("let muxUrlRecoveryAttempted = false;");
    expect(recoveryBlock).toContain("!muxUrlRecoveryAttempted");
    expect(recoveryBlock).toContain("muxUrlRecoveryAttempted = true;");
    expect(recoveryBlock).toContain("geminiAttempt -= 1;");
    expect(source.match(/muxUrlRecoveryAttempted = true;/g)).toHaveLength(1);
  });

  it("reconciler reschedules stale analysing rows instead of leaving them stranded", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/routes/api/public/reconcile-stale-takes.ts"),
      "utf8",
    );
    expect(source).toContain('.eq("processing_phase", "analysing")');
    expect(source).toContain('status: "pending"');
    expect(source).toContain('processing_phase: "analysis_pending"');
    expect(source).toContain("runProcessTake(take.id)");
  });
});
