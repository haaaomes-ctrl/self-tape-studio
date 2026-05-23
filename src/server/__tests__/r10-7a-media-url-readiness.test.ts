import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isMuxStaticRenditionReady } from "@/server/mux-static-rendition.server";
import {
  classifyStaticRenditionReadyTake,
  redactMuxWebhookBodyForLog,
  shouldPreserveAssetReadyProcessingPhase,
} from "@/routes/api/public/mux-webhook";

describe("R10.7A media URL readiness and provider 400 recovery", () => {
  it("treats asset readiness separately from static MP4 readiness", () => {
    expect(isMuxStaticRenditionReady(undefined)).toBe(false);
    expect(isMuxStaticRenditionReady({ status: "preparing" })).toBe(false);
    expect(isMuxStaticRenditionReady({ status: "ready" })).toBe(true);
    expect(
      isMuxStaticRenditionReady({
        files: [{ name: "highest.mp4", resolution: "highest", status: "ready" }],
      }),
    ).toBe(true);
    expect(
      isMuxStaticRenditionReady({
        files: [{ name: "highest.mp4", resolution: "highest", status: "preparing" }],
      }),
    ).toBe(false);
  });

  it("does not hand an unfetchable static MP4 URL to the provider", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );

    const headGateIndex = source.indexOf("!selectedMediaUrlConfirmedFetchable");
    const analysingFlipIndex = source.indexOf('processing_phase: "analysing"');
    const evidencePassIndex = source.indexOf("runEvidencePass({");

    expect(source).toContain("isProviderFetchableHeadStatus(courtesyHeadStatus)");
    expect(source).toContain("courtesyHeadStatus === 404");
    expect(source).toContain('"mux_static_rendition_waiting"');
    expect(headGateIndex).toBeGreaterThan(0);
    expect(analysingFlipIndex).toBeGreaterThan(headGateIndex);
    expect(evidencePassIndex).toBeGreaterThan(headGateIndex);
  });

  it("keeps asset.ready from scheduling analysis before static_rendition.ready", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/routes/api/public/mux-webhook.ts"),
      "utf8",
    );
    const assetReadyStart = source.indexOf('if (type === "video.asset.ready")');
    const staticReadyStart = source.indexOf('if (type === "video.asset.static_rendition.ready")');
    const assetReadyBlock = source.slice(assetReadyStart, staticReadyStart);

    expect(assetReadyBlock).toContain("asset.ready waiting for static_rendition.ready");
    expect(assetReadyBlock).toContain("mux_status:");
    expect(assetReadyBlock).toContain('"transcoding"');
    expect(assetReadyBlock).not.toContain("runProcessTake(takeId)");
    expect(assetReadyBlock).not.toContain('mux_status: "ready"');
  });

  it("preserves active processing phases when duplicate asset.ready events arrive", () => {
    expect(
      shouldPreserveAssetReadyProcessingPhase({
        status: "pending",
        processing_phase: "analysis_pending",
      }),
    ).toBe(true);
    expect(
      shouldPreserveAssetReadyProcessingPhase({
        status: "processing",
        processing_phase: "analysing",
      }),
    ).toBe(true);
    expect(
      shouldPreserveAssetReadyProcessingPhase({
        status: "processing",
        processing_phase: "transcoding",
      }),
    ).toBe(false);
  });

  it("allows late static_rendition.ready to recover a media URL rejection only", () => {
    expect(
      classifyStaticRenditionReadyTake({
        status: "error",
        processing_phase: "error",
        error_message:
          "[failure_code:media_url_provider_rejected] The video file was not ready yet.",
        stale_heartbeat_ms: 1_000,
      }),
    ).toBe("recover_media_url_rejection");

    expect(
      classifyStaticRenditionReadyTake({
        status: "error",
        processing_phase: "error",
        error_message: "[failure_code:ai_non_retryable_4xx] AI gateway error (400).",
        stale_heartbeat_ms: 1_000,
      }),
    ).toBe("skip_terminal");
  });

  it("keeps confirmed provider 400s terminal and recoverable media 400s distinct", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );
    const mediaRejectedIndex = source.indexOf('"media_url_provider_rejected"');
    const nonRetryableIndex = source.indexOf('failureCode = "ai_non_retryable_4xx"');

    expect(mediaRejectedIndex).toBeGreaterThan(0);
    expect(nonRetryableIndex).toBeGreaterThan(mediaRejectedIndex);
    expect(source).toContain('providerError?.failureCode === "media_url_provider_rejected"');
    expect(source).toContain("mediaUrlConfirmedFetchable: selectedMediaUrlConfirmedFetchable");
  });

  it("redacts raw Mux webhook bodies before logging", () => {
    const rawBody = JSON.stringify({
      type: "video.upload.created",
      data: {
        upload_url: "https://storage.example.test/upload?token=secret-token",
        url: "https://stream.mux.com/public-id/highest.mp4?token=secret-token",
        nested: { signature: "abc123", bearerToken: "secret" },
      },
    });

    const redacted = redactMuxWebhookBodyForLog(rawBody);
    expect(redacted).toContain("[query-redacted]");
    expect(redacted).toContain('"signature":"[redacted]"');
    expect(redacted).not.toContain("secret-token");
    expect(redacted).not.toContain("abc123");
  });

  it("keeps the reconciler from marking asset.ready as static MP4 readiness", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/routes/api/public/reconcile-stale-takes.ts"),
      "utf8",
    );

    expect(source).toContain("!isMuxStaticRenditionReady(asset.static_renditions)");
    expect(source).toContain('"static_rendition_not_ready"');
    expect(source).toContain('"mux_static_rendition_waiting"');
  });
});
