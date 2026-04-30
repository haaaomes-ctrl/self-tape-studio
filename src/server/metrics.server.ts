// Lightweight observability helper for the audition analysis pipeline.
//
// Goal: emit one structured log line per metric event so a downstream log
// pipeline (Logflare, Cloudflare logs, Logpush) can derive counts, durations,
// rates, and percentiles WITHOUT a database schema change.
//
// All metric lines are prefixed `[take-pipeline] metric` followed by a JSON
// payload with a stable shape:
//   {
//     metric: "<snake_case_name>",
//     take_id?: string,
//     processing_phase?: string,
//     duration_ms?: number,
//     value?: number,            // counter increment, default 1
//     reason?: string,           // for failures / rejections
//     ts: ISO timestamp
//   }
//
// Constraints (per pilot observability spec):
// - No PII, no video URLs, no brief text, no AI output.
// - Non-blocking: pure console.log calls.
// - Safe to call from any server code path.

export type MetricName =
  // Upload
  | "upload_url_requested"
  | "upload_url_success"
  | "upload_url_failure"
  // Mux pipeline
  | "mux_upload_created"
  | "mux_asset_ready"
  | "static_mp4_ready"
  | "mux_asset_error"
  | "mux_upload_error"
  | "mux_static_rendition_failed"
  | "mux_recovery_attempt"
  | "mux_recovery_success"
  | "mux_recovery_failure"
  // Preparation
  | "preparation_started"
  | "preparation_completed"
  | "preparation_timeout"
  | "transcoding_to_analysis_pending"
  // Gemini / AI
  | "gemini_started"
  | "gemini_retry"
  | "gemini_completed"
  | "gemini_failed"
  // End-to-end
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "analysis_total_duration"
  // State health
  | "stuck_transcoding"
  | "stuck_analysis_pending"
  | "phase_transition_failure"
  | "analysis_pending_to_analysing"
  // Reconciler
  | "reconciler_run"
  | "reconciler_recovered"
  | "reconciler_forced_error"
  | "already_running_skip"
  | "result_discarded_state_changed"
  // User behaviour
  | "cancel"
  | "analysis_abandoned"
  // Quota
  | "quota_rejection"
  | "quota_check";

export interface MetricFields {
  take_id?: string | null;
  processing_phase?: string | null;
  duration_ms?: number;
  value?: number;
  reason?: string;
  http_status?: number | null;
  attempt?: number;
  retry_count?: number;
  tier?: string;
  // Free-form extras allowed for derived KPIs (e.g. within_10min: boolean).
  [k: string]: unknown;
}

/**
 * Emit a structured metric event. One line per call.
 *
 * Sample log line:
 *   [take-pipeline] metric {"metric":"gemini_completed","take_id":"abc","duration_ms":42100,"ts":"2026-04-30T..."}
 */
export function metric(name: MetricName, fields: MetricFields = {}): void {
  // Strip any accidental large/PII fields defensively before serialising.
  const safe: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
  for (const banned of ["brief", "report", "video_url", "mp4_url", "prompt"]) {
    delete safe[banned];
  }

  const payload = {
    metric: name,
    value: typeof fields.value === "number" ? fields.value : 1,
    ts: new Date().toISOString(),
    ...safe,
  };

  // Single-line JSON makes log search + aggregation trivial.
  console.log(`[take-pipeline] metric ${JSON.stringify(payload)}`);
}

/**
 * KPI helper: tag analysis_completed events with within_10min so the primary
 * KPI (percentage_of_analyses_completed_within_10_minutes) can be derived as
 *   sum(within_10min=true) / count(analysis_completed)
 * directly from the metric stream.
 */
export const TEN_MINUTES_MS = 10 * 60_000;
