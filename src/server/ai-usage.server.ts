// SERVER-ONLY. Metadata-only AI usage recorder for DS-16 unit economics.
//
// This module intentionally records call metadata only: step/model/provider,
// token counts when exposed by the provider, latency, status and duration/cost
// bands. It must never persist prompts, raw model responses, video URLs, signed
// URLs, brief text, or performer-facing report prose.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  extractTakeDurationReporting,
  type VideoDurationStatus,
} from "@/lib/video-duration-policy";
import type { Json } from "@/integrations/supabase/types";

export const AI_USAGE_COST_BASELINE_VERSION = "s10-1-ds-16";

export const AI_USAGE_COST_BASELINE = {
  minUsd: 0.08,
  maxUsd: 0.2,
  sixToSevenMinuteLowUsd: 0.12,
  sixToSevenMinuteHighUsd: 0.15,
  p50WatchThresholdUsd: 0.15,
  p95WatchThresholdUsd: 0.2,
} as const;

export type AiUsageStep =
  | "brief_extraction"
  | "evidence_pass"
  | "single_pass_report"
  | "report_polish"
  | "fallback"
  | "repair";

export type AiUsageStatus = "success" | "failure" | "timeout" | "cancelled";

export type AiUsageCostSource = "planning_baseline" | "duration_baseline" | "token_usage_available";

export type AiTokenUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type TakeAiUsageContext = {
  takeId?: string | null;
  auditionId?: string | null;
  userId?: string | null;
  muxDurationSeconds?: number | null;
  signals?: unknown;
  checklist?: unknown;
};

export type TakeAiUsageInput = TakeAiUsageContext & {
  step: AiUsageStep;
  provider?: string;
  model: string;
  promptVersion?: string | null;
  providerContract?: string | null;
  status: AiUsageStatus;
  httpStatus?: number | null;
  failureReason?: string | null;
  latencyMs: number;
  tokenUsage?: AiTokenUsage | null;
  estimatedCostUsd?: number | null;
  costSource?: AiUsageCostSource | null;
  fallbackUsed?: boolean;
  repairAttempt?: boolean;
  metadata?: Record<string, unknown>;
};

export type TakeAiUsageInsert = {
  take_id: string | null;
  audition_id: string | null;
  user_id: string | null;
  step: AiUsageStep;
  provider: string;
  model: string;
  prompt_version: string | null;
  provider_contract: string | null;
  status: AiUsageStatus;
  success: boolean;
  http_status: number | null;
  failure_reason: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number;
  estimated_cost_usd: number;
  cost_source: AiUsageCostSource;
  video_duration_seconds: number | null;
  duration_status: VideoDurationStatus | "unknown" | null;
  fallback_used: boolean;
  repair_attempt: boolean;
  metadata: Json;
};

const STEP_COST_SHARE: Record<AiUsageStep, number> = {
  brief_extraction: 0.08,
  evidence_pass: 0.62,
  single_pass_report: 1,
  report_polish: 0.3,
  fallback: 1,
  repair: 0.15,
};

const BANNED_METADATA_KEY_PATTERNS = [
  /prompt/i,
  /raw/i,
  /response/i,
  /report/i,
  /brief/i,
  /video/i,
  /url/i,
  /signed/i,
  /mp4/i,
  /token_value/i,
  /secret/i,
  /authorization/i,
];

const BANNED_METADATA_STRING_PATTERNS = [
  /https?:\/\//i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /-----BEGIN [A-Z ]+-----/,
  /\braw\s+(prompt|response|model)\b/i,
];

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function finiteNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function finitePositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function clampLatencyMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

function clampHttpStatus(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 100 || value > 599) return null;
  return value;
}

function safeString(value: string | null | undefined, max = 180): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function sanitiseJson(value: unknown, depth = 0): Json {
  if (depth > 4) return "[truncated]";
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.slice(0, 240);
    return BANNED_METADATA_STRING_PATTERNS.some((pattern) => pattern.test(trimmed))
      ? "[redacted]"
      : trimmed;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitiseJson(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (BANNED_METADATA_KEY_PATTERNS.some((pattern) => pattern.test(key))) continue;
      out[key.slice(0, 80)] = sanitiseJson(child, depth + 1);
    }
    return out;
  }
  return null;
}

export function extractAiTokenUsage(payload: unknown): AiTokenUsage | null {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const usage =
    root?.usage && typeof root.usage === "object" ? (root.usage as Record<string, unknown>) : null;
  if (!usage) return null;

  const promptTokens =
    finiteNonNegativeInteger(usage.prompt_tokens) ??
    finiteNonNegativeInteger(usage.input_tokens) ??
    finiteNonNegativeInteger(usage.promptTokens) ??
    finiteNonNegativeInteger(usage.inputTokens);
  const completionTokens =
    finiteNonNegativeInteger(usage.completion_tokens) ??
    finiteNonNegativeInteger(usage.output_tokens) ??
    finiteNonNegativeInteger(usage.completionTokens) ??
    finiteNonNegativeInteger(usage.outputTokens);
  const totalTokens =
    finiteNonNegativeInteger(usage.total_tokens) ??
    finiteNonNegativeInteger(usage.totalTokens) ??
    (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);

  if (promptTokens == null && completionTokens == null && totalTokens == null) return null;
  return { promptTokens, completionTokens, totalTokens };
}

export function estimateAiReportCostBaselineUsd(durationSeconds?: number | null): number {
  const duration =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : null;
  if (duration == null) return 0.12;
  if (duration <= 300) return roundUsd(0.08 + (duration / 300) * 0.04);
  if (duration <= 420) return roundUsd(0.12 + ((duration - 300) / 120) * 0.03);
  if (duration <= 600) return roundUsd(0.15 + ((duration - 420) / 180) * 0.05);
  return 0.2;
}

export function estimateAiCallCostUsd(input: {
  step: AiUsageStep;
  durationSeconds?: number | null;
}): number {
  return roundUsd(
    estimateAiReportCostBaselineUsd(input.durationSeconds) * (STEP_COST_SHARE[input.step] ?? 0.1),
  );
}

export function buildTakeAiUsageInsert(input: TakeAiUsageInput): TakeAiUsageInsert {
  const durationReporting = extractTakeDurationReporting({
    mux_duration_seconds: input.muxDurationSeconds ?? null,
    signals: input.signals,
    checklist: input.checklist,
  });
  const tokenUsage = input.tokenUsage ?? null;
  const hasTokenUsage =
    tokenUsage?.promptTokens != null ||
    tokenUsage?.completionTokens != null ||
    tokenUsage?.totalTokens != null;
  const durationSeconds =
    durationReporting?.duration_seconds ?? finitePositiveNumber(input.muxDurationSeconds);
  const estimatedCostUsd =
    typeof input.estimatedCostUsd === "number" &&
    Number.isFinite(input.estimatedCostUsd) &&
    input.estimatedCostUsd >= 0
      ? roundUsd(input.estimatedCostUsd)
      : estimateAiCallCostUsd({ step: input.step, durationSeconds });
  const costSource =
    input.costSource ??
    (hasTokenUsage
      ? "token_usage_available"
      : durationSeconds != null
        ? "duration_baseline"
        : "planning_baseline");

  return {
    take_id: input.takeId ?? null,
    audition_id: input.auditionId ?? null,
    user_id: input.userId ?? null,
    step: input.step,
    provider: safeString(input.provider, 80) ?? "lovable_ai_gateway",
    model: safeString(input.model, 160) ?? "unknown_model",
    prompt_version: safeString(input.promptVersion, 160),
    provider_contract: safeString(input.providerContract, 120),
    status: input.status,
    success: input.status === "success",
    http_status: clampHttpStatus(input.httpStatus),
    failure_reason: safeString(input.failureReason, 240),
    prompt_tokens: tokenUsage?.promptTokens ?? null,
    completion_tokens: tokenUsage?.completionTokens ?? null,
    total_tokens: tokenUsage?.totalTokens ?? null,
    latency_ms: clampLatencyMs(input.latencyMs),
    estimated_cost_usd: estimatedCostUsd,
    cost_source: costSource,
    video_duration_seconds:
      durationSeconds != null ? Math.round(durationSeconds * 100) / 100 : null,
    duration_status:
      durationReporting?.duration_status ?? (durationSeconds != null ? "unknown" : null),
    fallback_used: input.fallbackUsed === true || input.step === "fallback",
    repair_attempt: input.repairAttempt === true || input.step === "repair",
    metadata: sanitiseJson({
      ...(input.metadata ?? {}),
      ai_usage_cost_baseline_version: AI_USAGE_COST_BASELINE_VERSION,
    }),
  };
}

export async function recordTakeAiUsage(input: TakeAiUsageInput): Promise<void> {
  const row = buildTakeAiUsageInsert(input);
  try {
    const { error } = await supabaseAdmin.from("take_ai_usage").insert(row);
    if (error) {
      console.warn("[ai-usage] record_failed", {
        take_id: row.take_id,
        step: row.step,
        model: row.model,
        status: row.status,
        error: error.message,
      });
    }
  } catch (err) {
    console.warn("[ai-usage] record_threw", {
      take_id: row.take_id,
      step: row.step,
      model: row.model,
      status: row.status,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
