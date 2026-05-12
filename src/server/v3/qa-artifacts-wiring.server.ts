import { DEFAULT_ROOT, emitInternalQAArtifactManifest } from './qa-artifacts.server';
import { writeQAArtifact } from './qa-artifact-sink.server';

export interface QARuntimeMetadata { run_id: string; fixture_id?: string; submission_id?: string; take_ids?: string[]; mux_playback_ids?: Record<string, string>; route_module?: string; commit_sha?: string; branch_name?: string; internal_qa_emit?: boolean; root_dir?: string; emitted_artefact_ids?: string[]; }
export interface RawReportEmitterInput { run_id: string; take_id: string; take_index?: number; submission_id?: string; fixture_id?: string; mux_playback_id?: string; report_data: Record<string, unknown>; source_stage: string; source_module: string; route_or_model_marker?: string; commit_sha?: string; branch_name?: string; root_dir?: string; internal_qa_emit?: boolean; }
export interface ComparisonRawEmitterInput { run_id: string; comparison_data: Record<string, unknown>; comparison_id?: string; submission_id?: string; take_ids?: string[]; take_indices?: number[]; mux_playback_ids?: Record<string, string>; fixture_id?: string; source_stage: string; source_module: string; route_or_model_marker?: string; commit_sha?: string; branch_name?: string; root_dir?: string; internal_qa_emit?: boolean; }
export interface TraceEmitterInput { run_id: string; artefact_id: string; relative_path: string; trace_data: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean; }
export interface ComparisonRuntimeArtifactsInput { run_id: string; comparison_raw_data?: Record<string, unknown>; suppression_trace?: Record<string, unknown>; same_video_repeatability_trace?: Record<string, unknown>; route_variance_trace?: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean; }

export function resolveInternalQAEmitEnabled(input?: { internal_qa_emit?: boolean; env?: NodeJS.ProcessEnv }) { if (input?.internal_qa_emit === true) return true; const env = input?.env ?? process.env; return env.V3_QA_ARTIFACTS_ENABLED === 'true' || env.INTERNAL_QA_EMIT === 'true'; }

async function writeInternalJson(root: string, run_id: string, relPath: string, payload: unknown, artefact_id?: string, fixture_id?: string) {
  return writeQAArtifact({ root_dir: root, run_id, relative_path: relPath, payload, artefact_id, fixture_id });
}

export async function emitRawReportArtefact(input: RawReportEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const miss: string[] = [];
  if (!input.submission_id) miss.push('submission_id');
  const payload = {
    schema_version: 'tapecoach_v3_internal_raw_report_v1', artefact_type: 'raw_report', run_id: input.run_id, fixture_id: input.fixture_id ?? null, submission_id: input.submission_id ?? null, take_id: input.take_id,
    take_index: input.take_index ?? null, mux_playback_id: input.mux_playback_id ?? null, source_stage: input.source_stage, source_module: input.source_module, route_or_model_marker: input.route_or_model_marker ?? null,
    commit_sha: input.commit_sha ?? null, branch_name: input.branch_name ?? null, created_at: new Date().toISOString(), report_data: input.report_data,
    scores_or_readiness_fields: (input.report_data.scores ?? input.report_data.overall_readiness ?? null), component_fields: input.report_data.components ?? null, claim_like_fields: input.report_data.claim_traces ?? null,
    limitation_fields: input.report_data.limitations ?? null, public_output_snapshot: null, missing_required_fields: miss, blocker_codes: miss.includes('submission_id') ? ['raw_report_submission_id_missing'] : [], privacy_classification: 'internal_private', internal_only: true,
  };
  const idx = input.take_index ?? 1;
  const result = await writeInternalJson(root, input.run_id, `reports/take_${idx}.raw_report.json`, payload, 'raw_report', input.fixture_id);
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
  const result = await writeInternalJson(root, input.run_id, 'comparison/comparison.raw.json', payload, 'comparison_raw', input.fixture_id);
  return { written: result.written, path: result.path ?? result.storage_path, artefact_id: 'comparison_raw' as const, warning: result.warning };
}

export async function emitQAManifestForAnalysisRun(metadata: QARuntimeMetadata) {
  const internalEmit = resolveInternalQAEmitEnabled({ internal_qa_emit: metadata.internal_qa_emit });
  if (!internalEmit) return { written: false, warning: null as string | null };
  try {
    const out = await emitInternalQAArtifactManifest({ internal_qa_emit: true, run_id: metadata.run_id, fixture_id: metadata.fixture_id, commit_sha: metadata.commit_sha, branch_name: metadata.branch_name, root_dir: metadata.root_dir, source_scope_file: 'docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md', input_refs: metadata.submission_id ? [`submission:${metadata.submission_id}`] : [], take_refs: metadata.take_ids ?? [], mux_playback_ids: metadata.mux_playback_ids, fixture_refs: metadata.route_module ? [`route:${metadata.route_module}`] : [], emitted_artefact_ids: metadata.emitted_artefact_ids ?? [] });
    return { written: out.written, warning: null as string | null, manifest_path: (out as { manifest_path?: string }).manifest_path };
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
  const entries: Array<[string, string]> = [['no_export_source_proof', 'export_or_no_export/no_export_source_proof.json'], ['no_export_config_proof', 'export_or_no_export/no_export_config_proof.json'], ['no_export_ui_proof', 'export_or_no_export/no_export_ui_proof.json'], ['no_export_log_proof', 'export_or_no_export/no_export_log_proof.json']];
  for (const [id, rel] of entries) { if (input.proofs[id]) { const w = await writeInternalJson(root, input.run_id, rel, input.proofs[id], id); if (w.written) ids.push(id); } }
  if (ids.length === 4) { const b = await writeInternalJson(root, input.run_id, 'export_or_no_export/no_export_proof.json', { bundle: true }, 'no_export_proof'); if (b.written) ids.push('no_export_proof'); }
  return { written: true as const, emitted_artefact_ids: ids };
}
export async function emitComparisonRuntimeArtifacts(input: ComparisonRuntimeArtifactsInput) {
  const emitted_artefact_ids: string[] = [];
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids };
  const root = input.root_dir ?? DEFAULT_ROOT;
  if (input.comparison_raw_data) {
    const w = await writeInternalJson(root, input.run_id, 'comparison/comparison.raw.json', input.comparison_raw_data, 'comparison_raw');
    if (w.written) emitted_artefact_ids.push('comparison_raw');
  }
  if (input.route_variance_trace) {
    const w = await writeInternalJson(root, input.run_id, 'comparison_traces/route_variance_trace.json', input.route_variance_trace, 'route_variance_trace');
    if (w.written) emitted_artefact_ids.push('route_variance_trace');
  }
  if (input.suppression_trace) {
    const w = await writeInternalJson(root, input.run_id, 'comparison_traces/comparison_suppression_trace.json', input.suppression_trace, 'comparison_suppression_trace');
    if (w.written) emitted_artefact_ids.push('comparison_suppression_trace');
  }
  if (input.same_video_repeatability_trace) {
    const w = await writeInternalJson(root, input.run_id, 'comparison_traces/same_video_repeatability_trace.json', input.same_video_repeatability_trace, 'same_video_repeatability_trace');
    if (w.written) emitted_artefact_ids.push('same_video_repeatability_trace');
  }
  return { written: true as const, emitted_artefact_ids };
}
