import { describe, expect, it } from "vitest";
import {
  buildVideoDurationDecision,
  buildVideoDurationSignals,
  classifyVideoDuration,
  extractTakeDurationReporting,
  summariseVideoDurationBands,
  VIDEO_DURATION_HARD_CAP_COPY,
  VIDEO_DURATION_SOFT_WARNING_COPY,
  VIDEO_DURATION_SUPPORT_EMAIL,
} from "@/lib/video-duration-policy";

describe("video duration policy", () => {
  it("classifies target, soft-guidance, and hard-cap durations at DS-15 boundaries", () => {
    expect(classifyVideoDuration(300)).toBe("within_target");
    expect(classifyVideoDuration(301)).toBe("over_soft_guidance");
    expect(classifyVideoDuration(600)).toBe("over_soft_guidance");
    expect(classifyVideoDuration(601)).toBe("over_hard_cap");
  });

  it("uses the approved DS-15 performer copy and support contact", () => {
    expect(buildVideoDurationDecision(301)).toMatchObject({
      status: "over_soft_guidance",
      canUpload: true,
      requiresAcknowledgement: true,
      message: VIDEO_DURATION_SOFT_WARNING_COPY,
    });
    expect(buildVideoDurationDecision(601)).toMatchObject({
      status: "over_hard_cap",
      canUpload: false,
      requiresAcknowledgement: false,
      message: VIDEO_DURATION_HARD_CAP_COPY,
    });
    expect(VIDEO_DURATION_SUPPORT_EMAIL).toBe("support@tapecoach.co.uk");
  });

  it("builds reportable take signal metadata without changing credit semantics", () => {
    expect(buildVideoDurationSignals(299.555)).toMatchObject({
      duration_seconds: 299.56,
      duration_status: "within_target",
      duration_band: "0_5_minutes",
      duration_cost_band: "standard_analysis",
      duration_cost_reporting_units: 1,
      duration_source: "browser_metadata",
    });
    expect(buildVideoDurationSignals(420)).toMatchObject({
      duration_status: "over_soft_guidance",
      duration_band: "5_10_minutes",
      duration_cost_band: "longer_analysis",
      duration_cost_reporting_units: 2,
    });
  });

  it("prefers authoritative Mux duration for admin duration band reporting", () => {
    const row = extractTakeDurationReporting({
      mux_duration_seconds: 420,
      signals: { duration_seconds: 120 },
      checklist: { duration: { seconds: 90 } },
    });

    expect(row).toMatchObject({
      duration_seconds: 420,
      duration_status: "over_soft_guidance",
      source: "mux_metadata",
    });
  });

  it("summarises duration bands and cost reporting units for admin views", () => {
    const summary = summariseVideoDurationBands([
      { signals: { duration_seconds: 120 } },
      { signals: { duration_seconds: 420 } },
      { checklist: { duration: { seconds: 601 } } },
      {},
    ]);

    expect(summary.statusCounts).toEqual({
      within_target: 1,
      over_soft_guidance: 1,
      over_hard_cap: 1,
    });
    expect(summary.bandCounts).toEqual({
      "0_5_minutes": 1,
      "5_10_minutes": 1,
      over_10_minutes: 1,
    });
    expect(summary.totalCostReportingUnits).toBe(3);
    expect(summary.unavailableCount).toBe(1);
  });
});
