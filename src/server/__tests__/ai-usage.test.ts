import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AI_USAGE_COST_BASELINE,
  AI_USAGE_COST_BASELINE_VERSION,
  buildTakeAiUsageInsert,
  estimateAiCallCostUsd,
  estimateAiReportCostBaselineUsd,
  extractAiTokenUsage,
} from "../ai-usage.server";

describe("AI usage cost baseline", () => {
  it("uses the DS-16 planning baseline across duration bands", () => {
    expect(AI_USAGE_COST_BASELINE).toMatchObject({
      minUsd: 0.08,
      maxUsd: 0.2,
      sixToSevenMinuteLowUsd: 0.12,
      sixToSevenMinuteHighUsd: 0.15,
      p50WatchThresholdUsd: 0.15,
      p95WatchThresholdUsd: 0.2,
    });

    expect(estimateAiReportCostBaselineUsd(null)).toBe(0.12);
    expect(estimateAiReportCostBaselineUsd(300)).toBe(0.12);
    expect(estimateAiReportCostBaselineUsd(420)).toBe(0.15);
    expect(estimateAiReportCostBaselineUsd(600)).toBe(0.2);
    expect(estimateAiReportCostBaselineUsd(900)).toBe(0.2);
    expect(estimateAiCallCostUsd({ step: "evidence_pass", durationSeconds: 420 })).toBe(0.093);
  });

  it("extracts token usage from common provider payload shapes", () => {
    expect(
      extractAiTokenUsage({
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      }),
    ).toEqual({ promptTokens: 12, completionTokens: 8, totalTokens: 20 });

    expect(
      extractAiTokenUsage({
        usage: { input_tokens: 15, output_tokens: 5, total_tokens: 25 },
      }),
    ).toEqual({ promptTokens: 15, completionTokens: 5, totalTokens: 25 });

    expect(extractAiTokenUsage({ choices: [] })).toBeNull();
  });

  it("builds metadata-only insert rows and strips unsafe metadata keys", () => {
    const row = buildTakeAiUsageInsert({
      takeId: "take-1",
      auditionId: "audition-1",
      userId: "user-1",
      muxDurationSeconds: 420,
      step: "evidence_pass",
      model: "google/gemini-3-flash-preview",
      providerContract: "plain_json_observations",
      status: "success",
      httpStatus: 200,
      latencyMs: 123.6,
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      metadata: {
        source_stage: "analysis_step_1_evidence_mapping",
        safe_note: "https://private.example/video.mp4",
        raw_prompt: "do not persist",
        signed_url: "https://private.example/video.mp4",
        nested: { response_body: "do not persist", safe_count: 2 },
      },
    });

    expect(row).toMatchObject({
      take_id: "take-1",
      audition_id: "audition-1",
      user_id: "user-1",
      step: "evidence_pass",
      success: true,
      http_status: 200,
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      latency_ms: 124,
      estimated_cost_usd: 0.093,
      cost_source: "token_usage_available",
      video_duration_seconds: 420,
      duration_status: "over_soft_guidance",
      fallback_used: false,
      repair_attempt: false,
    });

    const metadata = row.metadata as Record<string, unknown>;
    expect(metadata.source_stage).toBe("analysis_step_1_evidence_mapping");
    expect(metadata.ai_usage_cost_baseline_version).toBe(AI_USAGE_COST_BASELINE_VERSION);
    expect(metadata.safe_note).toBe("[redacted]");
    expect(metadata.raw_prompt).toBeUndefined();
    expect(metadata.signed_url).toBeUndefined();
    expect(metadata.nested).toEqual({ safe_count: 2 });
  });

  it("marks fallback and repair rows for dashboard rates", () => {
    const fallback = buildTakeAiUsageInsert({
      takeId: "take-1",
      muxDurationSeconds: -1,
      step: "fallback",
      model: "google/gemini-2.5-flash",
      status: "failure",
      latencyMs: -100,
    });
    const repair = buildTakeAiUsageInsert({
      takeId: "take-1",
      step: "repair",
      model: "google/gemini-2.5-flash",
      status: "success",
      latencyMs: 10,
    });

    expect(fallback).toMatchObject({
      success: false,
      fallback_used: true,
      repair_attempt: false,
      latency_ms: 0,
      cost_source: "planning_baseline",
      video_duration_seconds: null,
    });
    expect(repair).toMatchObject({
      success: true,
      fallback_used: false,
      repair_attempt: true,
      cost_source: "planning_baseline",
    });
  });

  it("keeps the SQL reporting surface private and CFO-oriented", () => {
    const sql = readFileSync(
      "supabase/migrations/20260527143800_ai_usage_cost_baseline.sql",
      "utf8",
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.take_ai_usage");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.take_ai_report_costs");
    expect(sql).toContain("p50_report_cost_usd");
    expect(sql).toContain("p95_report_cost_usd");
    expect(sql).toContain("fallback_rate");
    expect(sql).toContain("repair_rate");
    expect(sql).toContain("partner_name");
    expect(sql).toContain("credit_source_group");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.take_ai_usage FROM PUBLIC, anon, authenticated",
    );
    expect(sql).not.toMatch(/raw_prompt|raw_model_response|signed_url|mux_mp4/i);
  });
});
