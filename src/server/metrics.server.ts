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
  | "mux_static_rendition_waiting"
  | "mux_static_rendition_ready"
  | "mux_static_rendition_timeout"
  | "mux_static_rendition_errored"
  | "mux_static_rendition_skipped"
  | "static_rendition_recovered_stale_analysing"
  | "static_rendition_recovered_stale_finalising"
  | "mux_recovery_attempt"
  | "mux_recovery_success"
  | "mux_recovery_failure"
  | "analysis_job_enqueued"
  | "analysis_enqueue_failed"
  // Preparation
  | "preparation_started"
  | "preparation_completed"
  | "preparation_timeout"
  | "preparation_deferred"
  | "transcoding_to_analysis_pending"
  // Gemini / AI
  | "gemini_started"
  | "gemini_retry"
  | "gemini_completed"
  | "gemini_failed"
  | "ai_fallback_selected"
  | "ai_circuit_opened"
  | "ai_circuit_closed"
  | "ai_circuit_fallback_selected"
  // Parse / persist
  | "analysis_parse_started"
  | "analysis_parse_completed"
  | "analysis_parse_failed"
  | "analysis_persist_started"
  | "analysis_persist_completed"
  | "analysis_persist_failed"
  | "resolver_truth_qa_persistence_failed_but_payload_valid"
  | "qa_persistence_failed_but_step1_evidence_valid"
  | "qa_persistence_failed_but_analysis_evidence_payload_used_for_runtime_traces"
  | "report_polish_blocked"
  | "s10_step2_qa_dependency_warning"
  // Sweeper
  | "analysis_sweeper_scanned"
  | "analysis_stale_timeout"
  | "analysis_sweeper_failed_count"
  | "reconciler_recovered_count"
  | "reconciler_forced_error_count"
  // End-to-end
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "analysis_total_duration"
  // State health
  | "stuck_transcoding"
  | "stuck_analysis_pending"
  | "stuck_uploading"
  | "phase_transition_failure"
  | "analysis_pending_to_analysing"
  // Reconciler
  | "reconciler_run"
  | "reconciler_recovered"
  | "reconciler_forced_error"
  | "reconciler_recovered_complete"
  | "already_running_skip"
  | "result_discarded_state_changed"
  // User behaviour
  | "cancel"
  | "analysis_abandoned"
  | "analysis_terminal"
  // Quota
  | "quota_rejection"
  | "quota_check"
  // Report credit lifecycle
  | "report_credit_reserved"
  | "report_credit_consumed"
  | "report_credit_released"
  | "report_credit_rejected"
  // Upload duration policy
  | "video_duration_warning_shown"
  | "video_duration_warning_accepted"
  | "video_duration_hard_cap_blocked"
  // Consumer Stripe checkout
  | "consumer_checkout_created"
  | "consumer_checkout_failed"
  | "consumer_payment_succeeded"
  | "consumer_payment_failed"
  | "consumer_payment_reversed"
  // Two-step pipeline
  | "evidence_pass_started"
  | "evidence_pass_completed"
  | "evidence_pass_failed"
  | "report_polish_started"
  | "report_polish_completed"
  | "report_polish_retry_started"
  | "report_polish_retry_completed"
  | "report_polish_retry_failed"
  | "report_polish_fallback_started"
  | "report_polish_fallback_persisted"
  | "report_polish_fallback_failed"
  | "report_polish_failed"
  | "s10_module_repair_retry_started"
  | "s10_module_repair_retry_completed"
  | "s10_module_repair_retry_failed"
  | "s10_module_repair_retry_json_salvage_started"
  | "s10_module_degraded_render"
  | "s10_decision_critical_blocked"
  | "evidence_binding_gate_applied"
  | "s10_step1_evidence_projected_for_polish"
  | "s10_module_quality_recovery_started"
  | "s10_module_quality_recovery_persisted"
  | "s10_module_quality_recovery_failed"
  | "s10_module_quality_residual_limitations_applied"
  | "s10_residual_level_calibration_applied"
  | "s10_residual_technique_commentary_applied"
  | "two_step_fallback_used"
  | "two_step_total_ai_duration_ms"
  // Δ5-S1 observation-ID integrity guard (deterministic; fires only when ≥1
  // blank/duplicate observation ID was replaced with a stable fallback).
  | "s10_observation_id_guard_applied"
  // Δ4-S1 single-source-of-truth dimension projection: fires only on the
  // anomalous S10 path where marked category_scores exist (so a projection was
  // produced) yet the deterministic overall D came back 0/NaN. A contract
  // anomaly — the model's holistic overall A is NOT substituted.
  | "s10_deterministic_overall_missing";

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
