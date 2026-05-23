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

    expect(
      classifyStaticRenditionReadyTake({
        status: "error",
        processing_phase: "error",
        error_message:
          "[failure_code:media_url_provider_rejected] The video file was not ready yet.",
        stale_heartbeat_ms: 5_000,
      }),
    ).toBe("recover_media_url_rejection");
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

  it("does not retry Gemini 400s by rebuilding the same Mux URL", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    expect(source).not.toContain("AI gateway rejected URL; retrying once with fresh Mux URL");
    expect(source).not.toContain("muxUrlRecoveryAttempted");
    expect(source).toContain("media_url_provider_rejected");
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
