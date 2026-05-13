import path from 'node:path';
import { writeQAArtifact } from './qa-artifact-sink.server';

export type ArtefactStatus = 'emitted' | 'emitted_blocked' | 'missing' | 'deferred' | 'not_applicable';

export interface QARequiredArtefact {
  artefact_id: string;
  name: string;
  expected_path: string;
  category: 'analysis_run' | 'comparison_run' | 'export_no_export' | 'qa_summary';
  owner_surface?: string;
  required_for_level: 'L2';
  status: ArtefactStatus;
  blocker_code?: string;
  reason?: string;
  linked_artifacts: string[];
}

export interface QAArtifactEmitterOptions {
  internal_qa_emit?: boolean;
  run_id: string;
  fixture_id?: string;
  root_dir?: string;
  generated_at?: string;
  commit_sha?: string;
  branch_name?: string;
  mux_playback_ids?: Record<string, string>;
  fixture_refs?: string[];
  input_refs?: string[];
  take_refs?: string[];
  source_scope_file?: string;
  emitter_version?: string;
  schema_version?: string;
  emitted_artefact_ids?: string[];
  emitted_blocked_artefact_ids?: string[];
  analysis_run_id?: string;
  comparison_run_id?: string;
  submission_id?: string;
  take_id?: string;
  compared_take_ids?: string[];
  deferred_artefact_ids?: string[];
  not_applicable_artefact_ids?: string[];
  runtime_evidence_accepted_by_id?: string[];
  runtime_evidence_blocked_by_id?: string[];
}

export const DEFAULT_ROOT = 'qa-artifacts';
const DEFAULT_SCHEMA_VERSION = 'tapecoach_v3_internal_qa_manifest_v1';
const DEFAULT_EMITTER_VERSION = '0.2.0';
const RELEASE_STATE = 'planning_dark_mode_internal_only';
const BLOCKED_STATUS = 'blocked';
const P0_CODE = 'same_video_false_winner_active_P0';

const REQUIRED: Omit<QARequiredArtefact, 'status' | 'blocker_code' | 'reason'>[] = [
  { artefact_id: 'analysis_input_record', name: 'input record', expected_path: 'inputs/input_record.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'analysis_submission', name: 'submission', expected_path: 'inputs/submission.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'analysis_take', name: 'take', expected_path: 'inputs/take.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'resolver_output', name: 'resolver output', expected_path: 'resolver/resolver_output.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'truth_state_map', name: 'TruthStateMap', expected_path: 'resolver/TruthStateMap.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'evidence_anchors', name: 'EvidenceAnchors', expected_path: 'traces/EvidenceAnchors.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'public_claim_trace', name: 'PublicClaimTrace', expected_path: 'traces/PublicClaimTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'technique_observation_trace', name: 'TechniqueObservationTrace', expected_path: 'traces/TechniqueObservationTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'score_trace', name: 'ScoreTrace', expected_path: 'traces/ScoreTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'validator_trace', name: 'ValidatorTrace', expected_path: 'traces/validator_trace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'gate_trace', name: 'GateTrace', expected_path: 'traces/gate_trace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'model_run_trace', name: 'ModelRunTrace', expected_path: 'traces/ModelRunTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'raw_report', name: 'raw report', expected_path: 'reports/take_1.raw_report.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'comparison_raw', name: 'comparison raw', expected_path: 'comparison/comparison.raw.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'comparison_report_internal', name: 'comparison report internal', expected_path: 'comparison/comparison.report.internal.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'same_video_repeatability_trace', name: 'same video repeatability trace', expected_path: 'comparison_traces/same_video_repeatability_trace.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'comparison_suppression_trace', name: 'comparison suppression trace', expected_path: 'comparison_traces/comparison_suppression_trace.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'route_variance_trace', name: 'route variance trace', expected_path: 'comparison_traces/route_variance_trace.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'parity_report', name: 'report parity', expected_path: 'parity/report_parity_result.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'parity_comparison', name: 'comparison parity', expected_path: 'parity/comparison_parity.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'no_export_proof', name: 'no export proof', expected_path: 'export_or_no_export/no_export_proof.json', category: 'export_no_export', required_for_level: 'L2', linked_artifacts: ['no_export_source_proof', 'no_export_config_proof', 'no_export_ui_proof', 'no_export_log_proof'] },
  { artefact_id: 'no_export_source_proof', name: 'no export source proof', expected_path: 'export_or_no_export/no_export_source_proof.json', category: 'export_no_export', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'no_export_config_proof', name: 'no export config proof', expected_path: 'export_or_no_export/no_export_config_proof.json', category: 'export_no_export', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'no_export_ui_proof', name: 'no export ui proof', expected_path: 'export_or_no_export/no_export_ui_proof.json', category: 'export_no_export', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'no_export_log_proof', name: 'no export log proof', expected_path: 'export_or_no_export/no_export_log_proof.json', category: 'export_no_export', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'qa_acceptance_metrics', name: 'acceptance metrics', expected_path: 'qa/acceptance_metrics.json', category: 'qa_summary', required_for_level: 'L2', linked_artifacts: [] },
];

const BLOCKERS: Record<string, string> = {
  raw_report: 'raw_JSON_missing', comparison_raw: 'comparison_JSON_missing', evidence_anchors: 'EvidenceAnchor_trace_missing', public_claim_trace: 'PublicClaimTrace_missing',
  technique_observation_trace: 'TechniqueObservation_trace_missing', score_trace: 'ScoreTrace_missing', model_run_trace: 'ModelRunTrace_missing', truth_state_map: 'TruthStateMap_missing',
  resolver_output: 'resolver_output_missing', same_video_repeatability_trace: 'same_video_repeatability_trace_missing', route_variance_trace: 'route_variance_trace_missing',
  comparison_suppression_trace: 'comparison_suppression_trace_missing', no_export_proof: 'no_export_proof_missing', parity_report: 'parity_artefacts_missing', parity_comparison: 'parity_artefacts_missing',
  validator_trace: 'validator_trace_missing', gate_trace: 'gate_trace_missing',
  comparison_report_internal: 'comparison_report_unavailable',
};

export function assertSafeSegment(value: string, field: string) {
  if (!/^[A-Za-z0-9._/-]+$/.test(value) || value.includes('..') || path.isAbsolute(value)) throw new Error(`${field}_invalid_path`);
}

export function stableStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val))
    ? Object.keys(val as Record<string, unknown>).sort().reduce<Record<string, unknown>>((a, k) => ({ ...a, [k]: (val as Record<string, unknown>)[k] }), {}) : val, 2);
}

export function resolveRunDir(root: string, run_id: string, mode: 'take' | 'comparison', take_id?: string, analysis_run_id?: string, comparison_run_id?: string) {
  assertSafeSegment(run_id, 'run_id');
  if (mode === 'comparison') {
    const cid = comparison_run_id ?? run_id;
    return path.join(root, 'comparisons', `comparison-${cid}`);
  }
  const tid = take_id ?? 'take-unknown';
  const aid = analysis_run_id ?? run_id;
  return path.join(root, 'takes', `take-${tid}`, `analysis-${aid}`);
}

export async function emitInternalQAArtifactManifest(options: QAArtifactEmitterOptions) {
  const internal_qa_emit = options.internal_qa_emit ?? false;
  if (!internal_qa_emit) return { written: false };
  const root = options.root_dir ?? DEFAULT_ROOT;
  const mode = options.comparison_run_id ? 'comparison' : 'take';
  const runDir = resolveRunDir(root, options.run_id, mode, options.take_id, options.analysis_run_id, options.comparison_run_id);
  const emittedIds = new Set(options.emitted_artefact_ids ?? []);
  const emittedBlockedIds = new Set(options.emitted_blocked_artefact_ids ?? []);
  const deferredIds = new Set(options.deferred_artefact_ids ?? []);
  const notApplicableIds = new Set(options.not_applicable_artefact_ids ?? []);
  const required_artifacts: QARequiredArtefact[] = REQUIRED.map((r) => {
    const emitted = emittedIds.has(r.artefact_id);
    const emittedBlocked = emittedBlockedIds.has(r.artefact_id);
    const deferred = deferredIds.has(r.artefact_id);
    const notApplicable = notApplicableIds.has(r.artefact_id);
    const status: ArtefactStatus = emitted ? 'emitted' : (emittedBlocked ? 'emitted_blocked' : (deferred ? 'deferred' : (notApplicable ? 'not_applicable' : 'missing')));
    return { ...r, status, blocker_code: emitted ? undefined : BLOCKERS[r.artefact_id], reason: emitted ? 'Emitted in current run' : (emittedBlocked ? 'Emitted with blocked/not_executed runtime evidence' : (deferred ? 'Intentionally deferred' : (notApplicable ? 'Not applicable for this run shape' : 'Not emitted by current pipeline stage'))) };
  });
  const missing_artifacts = required_artifacts.filter((a) => a.status === 'missing').map((a) => a.artefact_id);
  const emitted_artifacts = required_artifacts.filter((a) => a.status === 'emitted').map((a) => a.artefact_id);
  const emitted_blocked_artefact_ids = required_artifacts.filter((a) => a.status === 'emitted_blocked').map((a) => a.artefact_id);
  const deferred_artifact_ids = required_artifacts.filter((a) => a.status === 'deferred').map((a) => a.artefact_id);
  const not_applicable_artifact_ids = required_artifacts.filter((a) => a.status === 'not_applicable').map((a) => a.artefact_id);
  const blocker_codes = [...new Set(required_artifacts.map((a) => a.blocker_code).filter(Boolean) as string[])];
  const artefact_status_by_id = Object.fromEntries(required_artifacts.map((a) => [a.artefact_id, a.status]));
  const manifest = {
    schema_version: options.schema_version ?? DEFAULT_SCHEMA_VERSION, emitter_version: options.emitter_version ?? DEFAULT_EMITTER_VERSION, run_id: options.run_id, analysis_run_id: options.analysis_run_id ?? options.run_id, comparison_run_id: options.comparison_run_id ?? null, submission_id: options.submission_id ?? null, take_id: options.take_id ?? null, compared_take_ids: options.compared_take_ids ?? [], fixture_id: options.fixture_id ?? null,
    generated_at: options.generated_at ?? new Date().toISOString(), commit_sha: options.commit_sha ?? 'unknown', branch_name: options.branch_name ?? null, release_state: RELEASE_STATE, internal_qa_emit,
    qa_artifact_root: runDir, source_scope_file: options.source_scope_file ?? 'docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md', fixture_refs: options.fixture_refs ?? [], input_refs: options.input_refs ?? [], take_refs: options.take_refs ?? [], mux_playback_ids: options.mux_playback_ids ?? {}, public_output_unchanged: true, user_experience_unchanged: true,
    required_artifacts, emitted_artifacts, emitted_blocked_artefact_ids, missing_artifacts, deferred_artifact_ids, not_applicable_artifact_ids, artefact_status_by_id, blocker_codes,
    runtime_evidence_accepted_by_id: options.runtime_evidence_accepted_by_id ?? emitted_artifacts,
    runtime_evidence_blocked_by_id: options.runtime_evidence_blocked_by_id ?? emitted_blocked_artefact_ids,
    qa_acceptance_metrics: { gf01_rt15_status: 'blocked', level2_status: 'not_accepted', blocker_codes },
    gate_statuses: [{ gate: 'GF-01_same_video_false_winner', status: 'blocked', blocker_code: P0_CODE }, { gate: 'same_video_forced_winner_still_present', status: 'blocked', blocker_code: P0_CODE }],
    warnings: ['Rendered PDFs/page-prints are manual-render evidence only'], privacy_notes: ['Internal-only dark mode artefact manifest; no public output changes'], redaction_notes: ['Private traces must not be exposed publicly'],
    no_export_status: 'no_export_proof_missing', production_safe_status: BLOCKED_STATUS, public_technique_authority_status: BLOCKED_STATUS, public_scoring_status: BLOCKED_STATUS, export_share_enabled: BLOCKED_STATUS,
    fixture_observations: options.fixture_id === 'GF-01 / RT-15 / MT-same-video-20260511' ? { take_scores: [91, 94, 91], comparison_recommendation: 'Take 2', same_video_operator_confirmation: true } : undefined,
    level2_qa_acceptance: 'not_accepted',
  };
  const sink = await writeQAArtifact({ run_id: options.run_id, root_dir: root, relative_path: 'manifest.json', payload: manifest, artefact_id: 'manifest', fixture_id: options.fixture_id });
  return { written: sink.written, manifest_path: sink.path ?? sink.storage_path, sink_mode: sink.sink_mode, sink_write_status: sink.sink_write_status, storage_bucket: sink.storage_bucket, storage_path: sink.storage_path, sink_warning: sink.warning ?? null, log_fallback_emitted: sink.log_fallback_emitted, manifest };
}
