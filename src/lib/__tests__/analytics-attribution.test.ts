import { describe, expect, it } from "vitest";
import {
  buildAnalyticsAttributionMetadata,
  extractAnalyticsAttributionFromUrl,
  mergeAnalyticsAttribution,
  normaliseAttributionToken,
  safePartnerCodeHint,
  shouldEmitAnalyticsEvent,
} from "@/lib/analytics-attribution";

describe("analytics attribution helpers", () => {
  it("extracts UTM, creator and partner attribution from a safe URL", () => {
    const attribution = extractAnalyticsAttributionFromUrl(
      "https://tapecoach.co.uk/?utm_source=instagram&utm_medium=social&utm_campaign=launch&creator=coach_a&partner_code=SCHOOL-INVITE-123",
      "https://example.com/page",
      "2026-05-27T10:00:00.000Z",
    );

    expect(attribution).toMatchObject({
      consent_state: "analytics_granted",
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "launch",
      creator_code: "coach_a",
      partner_code_hint: "SCH...123",
      referrer_host: "example.com",
    });
    expect(attribution?.landing_path).toBe("/");
  });

  it("does not keep unsafe private attribution values", () => {
    expect(normaliseAttributionToken("https://signed.example/video?token=secret")).toBeNull();
    expect(normaliseAttributionToken("  Launch Campaign!  ")).toBe("Launch Campaign");
    expect(safePartnerCodeHint("SUPER-LONG-CODE-123456")).toBe("SUP...456");
  });

  it("keeps first-touch attribution while refreshing last seen", () => {
    const first = extractAnalyticsAttributionFromUrl(
      "https://tapecoach.co.uk/?utm_source=school&utm_campaign=term",
      null,
      "2026-05-01T10:00:00.000Z",
    );
    const second = extractAnalyticsAttributionFromUrl(
      "https://tapecoach.co.uk/?utm_source=agent&utm_campaign=later&creator=agent_a",
      null,
      "2026-05-10T10:00:00.000Z",
    );

    const merged = mergeAnalyticsAttribution(first, second, "2026-05-10T10:00:00.000Z");

    expect(merged?.utm_source).toBe("school");
    expect(merged?.utm_campaign).toBe("term");
    expect(merged?.creator_code).toBe("agent_a");
    expect(merged?.last_seen_at).toBe("2026-05-10T10:00:00.000Z");
  });

  it("consent-gates non-essential browser events only", () => {
    expect(shouldEmitAnalyticsEvent("landing_view", "unknown")).toBe(false);
    expect(shouldEmitAnalyticsEvent("return_30d", "essential_only")).toBe(false);
    expect(shouldEmitAnalyticsEvent("landing_view", "analytics_granted")).toBe(true);
    expect(shouldEmitAnalyticsEvent("upload", "essential_only")).toBe(true);
    expect(shouldEmitAnalyticsEvent("report_completed", "analytics_denied")).toBe(true);
  });

  it("marks persisted object metadata unavailable without analytics consent", () => {
    const metadata = buildAnalyticsAttributionMetadata(null);

    expect(metadata).toMatchObject({
      schema_version: "tapecoach_analytics_attribution_v1",
      attribution_available: false,
    });
  });
});
