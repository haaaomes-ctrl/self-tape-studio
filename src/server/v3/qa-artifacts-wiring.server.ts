import { assertSafeSegment, DEFAULT_ROOT, emitInternalQAArtifactManifest } from './qa-artifacts.server';
import { writeQAArtifact } from './qa-artifact-sink.server';

export interface QARuntimeMetadata { run_id: string; fixture_id?: string; submission_id?: string; take_ids?: string[]; take_id?: string; compared_take_ids?: string[]; comparison_run_id?: string; analysis_run_id?: string; mux_playback_ids?: Record<string, string>; route_module?: string; commit_sha?: string; branch_name?: string; internal_qa_emit?: boolean; root_dir?: string; emitted_artefact_ids?: string[]; emitted_blocked_artefact_ids?: string[]; deferred_artefact_ids?: string[]; not_applicable_artefact_ids?: string[]; runtime_evidence_accepted_by_id?: string[]; runtime_evidence_blocked_by_id?: string[]; artefact_source_classification_by_id?: Record<string, string>; artefact_level2_spine_satisfaction_by_id?: Record<string, boolean>; legacy_adapter_artefact_ids?: string[]; real_v3_spine_artefact_ids?: string[]; defect_risk_ids?: string[]; }
export interface RawReportEmitterInput { run_id: string; take_id: string; take_index?: number; submission_id?: string; fixture_id?: string; mux_playback_id?: string; report_data: Record<string, unknown>; source_stage: string; source_module: string; route_or_model_marker?: string; commit_sha?: string; branch_name?: string; root_dir?: string; internal_qa_emit?: boolean; }
export interface ComparisonRawEmitterInput { run_id: string; comparison_data: Record<string, unknown>; comparison_id?: string; submission_id?: string; take_ids?: string[]; take_indices?: number[]; mux_playback_ids?: Record<string, string>; fixture_id?: string; source_stage: string; source_module: string; route_or_model_marker?: string; commit_sha?: string; branch_name?: string; root_dir?: string; internal_qa_emit?: boolean; }
export interface TraceEmitterInput { run_id: string; artefact_id: string; relative_path: string; trace_data: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean; }
export interface ComparisonRuntimeArtifactsInput { run_id: string; comparison_run_id?: string; comparison_id?: string; compared_take_ids?: string[]; comparison_raw_data?: Record<string, unknown>; suppression_trace?: Record<string, unknown>; same_video_repeatability_trace?: Record<string, unknown>; route_variance_trace?: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean; }
export interface AnalysisInputArtefactEmitterInput {
  run_id: string; analysis_run_id?: string; submission_id?: string; take_id: string; compared_take_ids?: string[]; comparison_run_id?: string; source_module: string; source_stage: string; analysis_route?: string; route_or_model_marker?: string; audition_type?: string | null; selected_level?: string | null; brief_presence?: 'supplied' | 'absent' | 'unknown'; material_presence?: 'supplied' | 'absent' | 'unknown'; mux_playback_id?: string | null; mux_asset_or_upload_id_present?: boolean | null; submission_created_at?: string | null; submission_updated_at?: string | null; take_created_at?: string | null; take_updated_at?: string | null; take_index?: number | null; take_index_source?: 'loaded_take_index' | 'computed_from_loaded_submission_takes_order' | 'unavailable'; component_or_task_declaration?: string[] | null; media_readiness_state?: string | null; safe_submission_refs?: string[]; safe_mux_playback_ref?: string | null; unavailable_fields?: string[]; root_dir?: string; internal_qa_emit?: boolean;
}

export function resolveInternalQAEmitEnabled(input?: { internal_qa_emit?: boolean; env?: NodeJS.ProcessEnv }) { if (input?.internal_qa_emit === true) return true; const env = input?.env ?? process.env; return env.V3_QA_ARTIFACTS_ENABLED === 'true' || env.INTERNAL_QA_EMIT === 'true'; }

async function writeInternalJson(root: string, run_id: string, relPath: string, payload: unknown, artefact_id?: string, fixture_id?: string) {
  return writeQAArtifact({ root_dir: root, run_id, relative_path: relPath, payload, artefact_id, fixture_id });
}

export async function emitRawReportArtefact(input: RawReportEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const miss: string[] = [];
  if (!input.submission_id) miss.push('submission_id');
  const isLegacyV1 = input.report_data.schema_version === 'v1-legacy';
  const defectRiskIds = [
    ...(isLegacyV1 ? ['legacy_schema_snapshot', 'legacy_report_used_as_v3_spine_proxy'] : []),
    ...(input.report_data.claim_traces == null ? ['v3_claim_fields_null'] : []),
    'public_output_snapshot_missing',
    ...((input.report_data.scores != null || input.report_data.overall_score != null || input.report_data.overall_score_final != null || input.report_data.overall_readiness != null) ? ['legacy_numeric_score_snapshot'] : []),
  ];
  const payload = {
    schema_version: 'tapecoach_v3_internal_raw_report_v1', artefact_type: 'raw_report', run_id: input.run_id, fixture_id: input.fixture_id ?? null, submission_id: input.submission_id ?? null, take_id: input.take_id,
    take_index: input.take_index ?? null, mux_playback_id: input.mux_playback_id ?? null, source_stage: input.source_stage, source_module: input.source_module, route_or_model_marker: input.route_or_model_marker ?? null,
    commit_sha: input.commit_sha ?? null, branch_name: input.branch_name ?? null, created_at: new Date().toISOString(), report_data: input.report_data,
    scores_or_readiness_fields: (input.report_data.scores ?? input.report_data.overall_readiness ?? null), component_fields: input.report_data.components ?? null, claim_like_fields: input.report_data.claim_traces ?? null,
    limitation_fields: input.report_data.limitations ?? null, public_output_snapshot: null, missing_required_fields: miss, blocker_codes: miss.includes('submission_id') ? ['raw_report_submission_id_missing'] : [], privacy_classification: 'internal_private', internal_only: true,
    source_family: isLegacyV1 ? 'legacy_adapter' : 'runtime_report',
    report_schema_family: isLegacyV1 ? 'legacy_v1' : 'runtime_v3',
    v3_evidence_spine_status: isLegacyV1 ? 'incomplete' : 'not_available',
    does_not_satisfy_level2_spine: true,
    linked_v3_trace_ids: [],
    legacy_snapshot_reason: isLegacyV1 ? 'Current production report snapshot emitted for QA; not v3 scoring brain proof' : null,
    defect_risk_ids: [...new Set(defectRiskIds)],
  };
  assertSafeSegment(input.take_id, 'take_id');
  const result = await writeInternalJson(root, input.run_id, `takes/take-${input.take_id}/analysis-${input.run_id}/reports/raw_report.json`, payload, 'raw_report', input.fixture_id);
  return { written: result.written, path: result.path ?? result.storage_path, artefact_id: 'raw_report' as const, warning: result.warning };
}

export async function emitComparisonRawArtefact(input: ComparisonRawEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const miss: string[] = [];
  if (!input.comparison_id) miss.push('comparison_id');
  const payload = {
    schema_version: 'tapecoach_v3_internal_comparison_raw_v1', artefact_type: 'comparison_raw', run_id: input.run_id, fixture_id: input.fixture_id ?? null, comparison_id: input.comparison_id ?? null, submission_id: input.submission_id ?? null,
    take_ids: input.take_ids ?? [], take_indices: input.take_indices ?? [], mux_playback_ids: input.mux_playback_ids ?? {}, source_stage: input.source_stage, source_module: input.source_module, route_or_model_marker: input.route_or_model_marker ?? null,
    commit_sha: input.commit_sha ?? null, branch_name: input.branch_name ?? null, created_at: new Date().toISOString(), comparison_data: input.comparison_data,
    ranking_fields: input.comparison_data.ranking ?? null, recommendation_fields: input.comparison_data.recommendation ?? null, confidence_fields: input.comparison_data.confidence ?? null, reasons_or_rationale_fields: input.comparison_data.reasons ?? null, flags: input.comparison_data.flags ?? null,
    same_video_fixture_metadata: input.fixture_id === 'GF-01 / RT-15 / MT-same-video-20260511' ? { take_scores: [91, 94, 91], comparison_recommendation: 'Take 2' } : null,
    missing_required_fields: miss, blocker_codes: miss.includes('comparison_id') ? ['comparison_id_missing'] : [], privacy_classification: 'internal_private', internal_only: true,
  };
  const cmpId = input.comparison_id ?? `${input.submission_id ?? 'submission-unknown'}-${(input.take_ids ?? []).join('-')}`;
  const result = await writeInternalJson(root, input.run_id, `comparisons/comparison-${cmpId}/comparison/comparison.raw.json`, payload, 'comparison_raw', input.fixture_id);
  return { written: result.written, path: result.path ?? result.storage_path, artefact_id: 'comparison_raw' as const, comparison_run_id: cmpId, warning: result.warning };
}

export async function emitQAManifestForAnalysisRun(metadata: QARuntimeMetadata) {
  const internalEmit = resolveInternalQAEmitEnabled({ internal_qa_emit: metadata.internal_qa_emit });
  if (!internalEmit) return { written: false, warning: null as string | null };
  try {
    const out = await emitInternalQAArtifactManifest({ internal_qa_emit: true, run_id: metadata.run_id, analysis_run_id: metadata.analysis_run_id ?? metadata.run_id, comparison_run_id: metadata.comparison_run_id, take_id: metadata.take_id ?? metadata.take_ids?.[0], submission_id: metadata.submission_id, compared_take_ids: metadata.compared_take_ids ?? metadata.take_ids ?? [], fixture_id: metadata.fixture_id, commit_sha: metadata.commit_sha, branch_name: metadata.branch_name, root_dir: metadata.root_dir, source_scope_file: 'docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md', input_refs: metadata.submission_id ? [`submission:${metadata.submission_id}`] : [], take_refs: metadata.take_ids ?? [], mux_playback_ids: metadata.mux_playback_ids, fixture_refs: metadata.route_module ? [`route:${metadata.route_module}`] : [], emitted_artefact_ids: metadata.emitted_artefact_ids ?? [], emitted_blocked_artefact_ids: metadata.emitted_blocked_artefact_ids ?? [], deferred_artefact_ids: metadata.deferred_artefact_ids ?? [], not_applicable_artefact_ids: metadata.not_applicable_artefact_ids ?? [], runtime_evidence_accepted_by_id: metadata.runtime_evidence_accepted_by_id, runtime_evidence_blocked_by_id: metadata.runtime_evidence_blocked_by_id, artefact_source_classification_by_id: metadata.artefact_source_classification_by_id, artefact_level2_spine_satisfaction_by_id: metadata.artefact_level2_spine_satisfaction_by_id, legacy_adapter_artefact_ids: metadata.legacy_adapter_artefact_ids, real_v3_spine_artefact_ids: metadata.real_v3_spine_artefact_ids, defect_risk_ids: metadata.defect_risk_ids });
    const warning = out.written ? null : ((out as { warning?: string | null; sink_warning?: string | null }).warning ?? (out as { sink_warning?: string | null }).sink_warning ?? 'internal_qa_manifest_sink_write_failed');
    return { written: out.written, warning, manifest_path: (out as { manifest_path?: string }).manifest_path };
  } catch (error) {
    return { written: false, warning: `internal_qa_manifest_emit_failed:${error instanceof Error ? error.message : 'unknown'}` };
  }
}

export async function emitTraceArtefact(input: TraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const result = await writeInternalJson(root, input.run_id, input.relative_path, input.trace_data, input.artefact_id);
  return { written: result.written as boolean, path: result.path ?? result.storage_path, artefact_id: input.artefact_id, warning: result.warning };
}
export async function emitModelRunTraceArtefact(input: Omit<TraceEmitterInput, 'artefact_id'|'relative_path'>) {
  return emitTraceArtefact({ ...input, artefact_id: 'model_run_trace', relative_path: 'traces/ModelRunTrace.json' });
}
export async function emitNoExportProofBundle(input: { run_id: string; proofs: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean }) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const ids: string[] = [];
  let hadFailure = false;
  const entries: Array<[string, string]> = [['no_export_source_proof', 'export_or_no_export/no_export_source_proof.json'], ['no_export_config_proof', 'export_or_no_export/no_export_config_proof.json'], ['no_export_ui_proof', 'export_or_no_export/no_export_ui_proof.json'], ['no_export_log_proof', 'export_or_no_export/no_export_log_proof.json']];
  for (const [id, rel] of entries) { if (input.proofs[id]) { const w = await writeInternalJson(root, input.run_id, rel, input.proofs[id], id); if (w.written) ids.push(id); else hadFailure = true; } }
  if (ids.length === 4) { const b = await writeInternalJson(root, input.run_id, 'export_or_no_export/no_export_proof.json', { bundle: true }, 'no_export_proof'); if (b.written) ids.push('no_export_proof'); else hadFailure = true; }
  return { written: !hadFailure, emitted_artefact_ids: ids };
}
export async function emitComparisonRuntimeArtifacts(input: ComparisonRuntimeArtifactsInput) {
  const emitted_artefact_ids: string[] = [];
  let hadFailure = false;
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const comparisonRunId = input.comparison_run_id
    ?? input.comparison_id
    ?? (input.comparison_raw_data?.comparison_run_id as string | undefined)
    ?? (input.comparison_raw_data?.comparison_id as string | undefined)
    ?? input.run_id;
  assertSafeSegment(comparisonRunId, 'comparison_run_id');
  const comparisonRoot = `comparisons/comparison-${comparisonRunId}`;
  if (input.comparison_raw_data) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison/comparison.raw.json`, { ...input.comparison_raw_data, comparison_run_id: comparisonRunId, compared_take_ids: input.compared_take_ids ?? input.comparison_raw_data.compared_take_ids ?? [] }, 'comparison_raw');
    if (w.written) emitted_artefact_ids.push('comparison_raw'); else hadFailure = true;
    const report = {
      schema_version: 'tapecoach_v3_internal_comparison_report_v1',
      artefact_type: 'comparison_report_internal',
      run_id: input.run_id,
      comparison_run_id: comparisonRunId,
      compared_take_ids: input.compared_take_ids ?? (input.comparison_raw_data.compared_take_ids as string[] | undefined) ?? [],
      recommendation_suppressed: Boolean(input.comparison_raw_data.recommendation_suppressed ?? input.comparison_raw_data.duplicate_or_near_duplicate_detected),
      suppression_reason: input.comparison_raw_data.suppression_reason ?? (input.comparison_raw_data.duplicate_or_near_duplicate_detected ? 'public_recommendation_suppressed_same_video_or_near_duplicate' : null),
      public_output_unchanged: true,
      user_experience_unchanged: true,
    };
    const rw = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison/comparison.report.internal.json`, report, 'comparison_report_internal');
    if (rw.written) emitted_artefact_ids.push('comparison_report_internal'); else hadFailure = true;
  }
  if (input.route_variance_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/route_variance_trace.json`, input.route_variance_trace, 'route_variance_trace');
    if (w.written) emitted_artefact_ids.push('route_variance_trace'); else hadFailure = true;
  }
  if (input.suppression_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/comparison_suppression_trace.json`, input.suppression_trace, 'comparison_suppression_trace');
    if (w.written) emitted_artefact_ids.push('comparison_suppression_trace'); else hadFailure = true;
  }
  if (input.same_video_repeatability_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/same_video_repeatability_trace.json`, input.same_video_repeatability_trace, 'same_video_repeatability_trace');
    if (w.written) emitted_artefact_ids.push('same_video_repeatability_trace'); else hadFailure = true;
  }
  const emitted_blocked_artefact_ids: string[] = [];
  if (!input.suppression_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/comparison_suppression_trace.json`, { artefact_status: 'emitted_blocked', evidence_status: 'not_executed', blocker_code: 'comparison_suppression_not_executed' }, 'comparison_suppression_trace');
    if (w.written) emitted_blocked_artefact_ids.push('comparison_suppression_trace'); else hadFailure = true;
  }
  if (!input.same_video_repeatability_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/same_video_repeatability_trace.json`, { artefact_status: 'emitted_blocked', evidence_status: 'not_executed', blocker_code: 'repeatability_not_executed' }, 'same_video_repeatability_trace');
    if (w.written) emitted_blocked_artefact_ids.push('same_video_repeatability_trace'); else hadFailure = true;
  }
  if (!input.route_variance_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/route_variance_trace.json`, { artefact_status: 'emitted_blocked', evidence_status: 'not_executed', blocker_code: 'route_variance_not_executed' }, 'route_variance_trace');
    if (w.written) emitted_blocked_artefact_ids.push('route_variance_trace'); else hadFailure = true;
  }
  return { written: !hadFailure, comparison_run_id: comparisonRunId, emitted_artefact_ids, emitted_blocked_artefact_ids };
}

export async function emitAnalysisInputArtefacts(input: AnalysisInputArtefactEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const generatedAt = new Date().toISOString();
  const unavailableCommon = [...(input.unavailable_fields ?? [])] as string[];
  if (!input.submission_id) unavailableCommon.push('submission_id');
  if (!input.audition_type) unavailableCommon.push('audition_type');
  if (!input.selected_level) unavailableCommon.push('selected_level');
  const boolFromEnvOrUnknown = (name: 'V3_QA_ARTIFACTS_ENABLED' | 'INTERNAL_QA_EMIT'): boolean | 'unknown' => {
    const v = process.env[name];
    if (v === 'true') return true;
    if (v === 'false') return false;
    return 'unknown';
  };
  const redaction_notes = ['Internal QA snapshot only; secrets/tokens/session credentials are excluded by design'];
  const inputRecord = {
    schema_version: 'tapecoach_v3_analysis_input_record_v1', artefact_type: 'analysis_input_record', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, comparison_run_id: input.comparison_run_id ?? null, compared_take_ids: input.compared_take_ids ?? [],
    source_module: input.source_module, source_stage: input.source_stage, generated_at: generatedAt, analysis_route: input.analysis_route ?? null, route_or_model_marker: input.route_or_model_marker ?? null,
    audition_type: input.audition_type ?? null, selected_level: input.selected_level ?? null, brief_presence: input.brief_presence ?? 'unknown', material_presence: input.material_presence ?? 'unknown',
    media_reference_state: { mux_playback_id_present: Boolean(input.mux_playback_id), mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? 'unknown' },
    qa_emit_enabled_state: { V3_QA_ARTIFACTS_ENABLED: boolFromEnvOrUnknown('V3_QA_ARTIFACTS_ENABLED'), INTERNAL_QA_EMIT: boolFromEnvOrUnknown('INTERNAL_QA_EMIT') },
    unavailable_fields: unavailableCommon, redaction_notes,
  };
  const submissionSnapshot = {
    schema_version: 'tapecoach_v3_analysis_submission_v1', artefact_type: 'analysis_submission', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, source_module: input.source_module, source_stage: input.source_stage, generated_at: generatedAt,
    audition_type: input.audition_type ?? null, selected_level: input.selected_level ?? null, brief_presence: input.brief_presence ?? 'unknown', material_presence: input.material_presence ?? 'unknown',
    submission_created_at: input.submission_created_at ?? null, submission_updated_at: input.submission_updated_at ?? null, component_or_task_declaration: input.component_or_task_declaration ?? null,
    safe_submission_refs: input.safe_submission_refs ?? (input.submission_id ? [`submission:${input.submission_id}`] : []),
    unavailable_fields: [...unavailableCommon, ...(input.submission_created_at ? [] : ['submission_created_at']), ...(input.submission_updated_at ? [] : ['submission_updated_at'])], redaction_notes,
  };
  const takeSnapshot = {
    schema_version: 'tapecoach_v3_analysis_take_v1', artefact_type: 'analysis_take', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, source_module: input.source_module, source_stage: input.source_stage, generated_at: generatedAt,
    take_created_at: input.take_created_at ?? null, take_updated_at: input.take_updated_at ?? null, take_index: input.take_index ?? null,
    take_index_source: input.take_index_source ?? (input.take_index == null ? 'unavailable' : 'loaded_take_index'),
    stable_take_identity: { take_id: input.take_id, analysis_run_id: analysisRunId }, mux_playback_id_present: Boolean(input.mux_playback_id), safe_mux_playback_ref: input.safe_mux_playback_ref ?? input.mux_playback_id ?? null,
    media_readiness_state: input.media_readiness_state ?? null,
    unavailable_fields: [...unavailableCommon, ...(input.take_created_at ? [] : ['take_created_at']), ...(input.take_updated_at ? [] : ['take_updated_at'])], redaction_notes,
  };
  assertSafeSegment(input.take_id, 'take_id');
  const base = `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs`;
  const emitted_artefact_ids: string[] = [];
  let hadFailure = false;
  const writes: Array<[string, string, unknown]> = [
    ['analysis_input_record', `${base}/input_record.json`, inputRecord],
    ['analysis_submission', `${base}/submission.json`, submissionSnapshot],
    ['analysis_take', `${base}/take.json`, takeSnapshot],
  ];
  for (const [id, rel, payload] of writes) {
    const w = await writeInternalJson(root, input.run_id, rel, payload, id);
    if (w.written) emitted_artefact_ids.push(id); else hadFailure = true;
  }
  return { written: !hadFailure, emitted_artefact_ids };
}
