import { assertSafeSegment, buildQAAcceptanceMetrics, DEFAULT_ROOT, emitInternalQAArtifactManifest, resolveQADeploymentProvenance } from './qa-artifacts.server';
import { writeQAArtifact } from './qa-artifact-sink.server';

function mergeQAWarnings(...warnings: Array<string | null | undefined>): string | null {
  const present = warnings.filter((warning): warning is string => Boolean(warning && warning.trim()));
  return present.length > 0 ? present.join('; ') : null;
}

function getQAWriteWarning(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const warning = (result as { warning?: unknown }).warning;
  const sinkWarning = (result as { sink_warning?: unknown }).sink_warning;
  return mergeQAWarnings(
    typeof warning === 'string' ? warning : null,
    typeof sinkWarning === 'string' ? sinkWarning : null,
  );
}

export interface QARuntimeMetadata { run_id: string; fixture_id?: string; submission_id?: string; take_ids?: string[]; take_id?: string; compared_take_ids?: string[]; comparison_run_id?: string; analysis_run_id?: string; mux_playback_ids?: Record<string, string>; route_module?: string; commit_sha?: string; branch_name?: string; internal_qa_emit?: boolean; root_dir?: string; source_scope_file?: string; emitted_artefact_ids?: string[]; emitted_blocked_artefact_ids?: string[]; deferred_artefact_ids?: string[]; not_applicable_artefact_ids?: string[]; runtime_evidence_accepted_by_id?: string[]; runtime_evidence_blocked_by_id?: string[]; artefact_source_classification_by_id?: Record<string, string>; artefact_level2_spine_satisfaction_by_id?: Record<string, boolean>; legacy_adapter_artefact_ids?: string[]; real_v3_spine_artefact_ids?: string[]; defect_risk_ids?: string[]; public_claim_trace_summary?: { claim_count?: number; unsupported_claim_count?: number; legacy_untraced_claim_count?: number; unsafe_or_overclaim_count?: number; rewrite_required_count?: number; }; technique_observation_trace_summary?: { legacy_adapter: number; report_snapshot: number; real_runtime_v3: number; input_artifact: number; resolver_truth_state: number; }; score_trace_summary?: { score_count: number; overall_count: number; discipline_attribute_count: number; component_score_count: number; component_weight_count: number; brief_adherence_subscore_count: number; assessment_confidence_count: number; calibration_modifier_count: number; calibration_metadata_count: number; source_family_summary: { legacy_adapter: number; report_snapshot: number; real_runtime_v3: number; input_artifact: number; resolver_truth_state: number; }; overall_readiness_public_score_status: 'blocked'; discipline_attribute_score_trace_status: 'internal_trace_only'; score_trace_gate_status: 'insufficient'; score_trace_gate_reason: 'legacy_report_snapshot_not_real_runtime_score_trace'; }; }
export interface RawReportEmitterInput { run_id: string; take_id: string; take_index?: number; submission_id?: string; fixture_id?: string; mux_playback_id?: string; report_data: Record<string, unknown>; source_stage: string; source_module: string; route_or_model_marker?: string; commit_sha?: string; branch_name?: string; root_dir?: string; internal_qa_emit?: boolean; }
export interface ComparisonRawEmitterInput { run_id: string; comparison_data: Record<string, unknown>; comparison_id?: string; submission_id?: string; take_ids?: string[]; take_indices?: number[]; mux_playback_ids?: Record<string, string>; fixture_id?: string; source_stage: string; source_module: string; route_or_model_marker?: string; commit_sha?: string; branch_name?: string; root_dir?: string; internal_qa_emit?: boolean; }
export interface TraceEmitterInput { run_id: string; artefact_id: string; relative_path: string; trace_data: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean; }
export interface EvidenceAnchorsEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string;
  take_id: string;
  comparison_run_id?: string | null;
  source_module: string;
  source_stage: string;
  raw_report_data?: Record<string, unknown> | null;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface PublicClaimTraceEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string;
  take_id: string;
  comparison_run_id?: string | null;
  source_module: string;
  source_stage: string;
  raw_report_data?: Record<string, unknown> | null;
  evidence_anchors_data?: { anchors?: Array<{ evidence_anchor_id?: string; source_path?: string; evidence_text?: string; source_family?: string }> } | null;
  truth_state_map_data?: Record<string, unknown> | null;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface TechniqueObservationTraceEmitterInput extends PublicClaimTraceEmitterInput {
  public_claim_trace_data?: { claims?: Array<Record<string, unknown>> } | null;
}

export interface ScoreTraceEmitterInput extends TechniqueObservationTraceEmitterInput {}
export interface ComparisonRuntimeArtifactsInput { run_id: string; comparison_run_id?: string; comparison_id?: string; compared_take_ids?: string[]; comparison_raw_data?: Record<string, unknown>; suppression_trace?: Record<string, unknown>; same_video_repeatability_trace?: Record<string, unknown>; route_variance_trace?: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean; }
export interface AnalysisInputArtefactEmitterInput {
  run_id: string; analysis_run_id?: string; submission_id?: string; take_id: string; compared_take_ids?: string[]; comparison_run_id?: string; source_module: string; source_stage: string; analysis_route?: string; route_or_model_marker?: string; audition_type?: string | null; selected_level?: string | null; brief_presence?: 'supplied' | 'absent' | 'unknown'; brief_presence_source?: 'audition.brief' | 'audition.extracted_brief_cached' | 'audition.brief+audition.extracted_brief_cached' | 'none_loaded' | 'unavailable' | 'not_loaded' | 'audition.brief+audition.extracted_brief_cached_empty'; material_presence?: 'supplied' | 'absent' | 'unknown'; material_presence_source?: 'loaded_runtime_field' | 'not_loaded' | 'unavailable'; mux_playback_id?: string | null; mux_asset_or_upload_id_present?: boolean | null; submission_created_at?: string | null; submission_updated_at?: string | null; take_created_at?: string | null; take_updated_at?: string | null; take_index?: number | null; take_index_source?: 'loaded_take_index' | 'computed_from_loaded_submission_takes_order' | 'unavailable'; component_or_task_declaration?: string[] | null; component_or_task_declaration_status?: 'unknown' | 'known_empty' | 'supplied'; component_or_task_declaration_source?: 'not_loaded' | 'loaded_runtime_field'; media_readiness_state?: string | null; safe_submission_refs?: string[]; safe_mux_playback_ref?: string | null; unavailable_fields?: string[]; root_dir?: string; internal_qa_emit?: boolean;
}
export interface ResolverTruthStateEmitterInput extends AnalysisInputArtefactEmitterInput {}
type PresenceValue = 'supplied' | 'absent' | 'unknown';
function normalisePresenceTruthState(value: PresenceValue | null | undefined, source: string | null | undefined): { value: PresenceValue; source: string; status: 'known' | 'unknown' | 'unavailable' } {
  const normalizedValue: PresenceValue = value === 'supplied' || value === 'absent' || value === 'unknown' ? value : 'unknown';
  const normalizedSource = source ?? 'unavailable';
  if (normalizedSource === 'unavailable' || normalizedSource === 'not_loaded' || normalizedSource === 'none_loaded') return { value: normalizedValue, source: normalizedSource, status: normalizedValue === 'unknown' ? 'unknown' : 'unavailable' };
  if (normalizedValue === 'unknown') return { value: normalizedValue, source: normalizedSource, status: 'unknown' };
  return { value: normalizedValue, source: normalizedSource, status: 'known' };
}
function assignPresenceTruthBucket(field: string, state: { value: PresenceValue; status: 'known' | 'unknown' | 'unavailable' }, known_truths: Record<string, unknown>, unavailable_truths: Record<string, unknown>) {
  if (state.status === 'known') known_truths[field] = state.value;
  else unavailable_truths[field] = state.value;
}

export function resolveInternalQAEmitEnabled(input?: { internal_qa_emit?: boolean; env?: NodeJS.ProcessEnv }) { if (input?.internal_qa_emit === true) return true; const env = input?.env ?? process.env; return env.V3_QA_ARTIFACTS_ENABLED === 'true' || env.INTERNAL_QA_EMIT === 'true'; }

async function writeInternalJson(root: string, run_id: string, relPath: string, payload: unknown, artefact_id?: string, fixture_id?: string) {
  return writeQAArtifact({ root_dir: root, run_id, relative_path: relPath, payload, artefact_id, fixture_id });
}
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function unwrapRawReportData(raw: unknown): Record<string, unknown> {
  const wrapper = isRecord(raw) ? raw : {};
  const nested = isRecord(wrapper.report_data) ? wrapper.report_data : null;
  return nested ?? wrapper;
}
function getTimestampedNoteText(row: Record<string, unknown>): string | null {
  const note = typeof row.note === 'string' ? row.note.trim() : '';
  const text = typeof row.text === 'string' ? row.text.trim() : '';
  return note || text || null;
}
function getTimestampedNoteTextField(row: Record<string, unknown>): 'note' | 'text' | null {
  if (typeof row.note === 'string' && row.note.trim()) return 'note';
  if (typeof row.text === 'string' && row.text.trim()) return 'text';
  return null;
}
function normaliseTraceText(value: unknown): string { return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase(); }

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
    ...((input.report_data.fix_first != null) ? ['legacy_fix_first_field_present'] : []),
    ...((input.report_data.next_take_plan != null) ? ['legacy_next_take_plan_field_present'] : []),
    ...((!Array.isArray(input.report_data.priority_fixes) || input.report_data.priority_fixes.length === 0) ? ['priority_fixes_missing'] : []),
    ...((Array.isArray(input.report_data.priority_fixes) && input.report_data.priority_fixes.length > 0 && input.report_data.priority_fixes.length < 2) ? ['priority_fixes_too_thin'] : []),
    ...((input.report_data.action_plan == null) ? ['action_plan_missing'] : []),
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
    ...resolveQADeploymentProvenance(),
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


function buildTakeAnalysisRelativePath(input: { take_id?: string; analysis_run_id?: string; run_id: string; leaf: string }): string {
  const takeId = input.take_id ?? (input.run_id.startsWith('take-') ? input.run_id.slice(5) : null);
  if (!takeId) return input.leaf;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  return `takes/take-${takeId}/analysis-${analysisRunId}/${input.leaf}`;
}

function shouldUseExpandedManifestPaths(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.QA_ARTIFACT_SINK ?? 'file') === 'storage';
}
export async function emitQAManifestForAnalysisRun(metadata: QARuntimeMetadata) {
  const internalEmit = resolveInternalQAEmitEnabled({ internal_qa_emit: metadata.internal_qa_emit });
  if (!internalEmit) return { written: false, warning: null as string | null };
  try {
    const initialEmitted = [...(metadata.emitted_artefact_ids ?? [])].filter((id) => id !== 'qa_acceptance_metrics');
    const baseOptions = { internal_qa_emit: true, run_id: metadata.run_id, analysis_run_id: metadata.analysis_run_id ?? metadata.run_id, comparison_run_id: metadata.comparison_run_id, take_id: metadata.take_id ?? metadata.take_ids?.[0], submission_id: metadata.submission_id, compared_take_ids: metadata.compared_take_ids ?? metadata.take_ids ?? [], fixture_id: metadata.fixture_id, commit_sha: metadata.commit_sha, branch_name: metadata.branch_name, root_dir: metadata.root_dir, ...(metadata.source_scope_file ? { source_scope_file: metadata.source_scope_file } : {}), input_refs: metadata.submission_id ? [`submission:${metadata.submission_id}`] : [], take_refs: metadata.take_ids ?? [], mux_playback_ids: metadata.mux_playback_ids, fixture_refs: metadata.route_module ? [`route:${metadata.route_module}`] : [], emitted_artefact_ids: initialEmitted, emitted_blocked_artefact_ids: metadata.emitted_blocked_artefact_ids ?? [], deferred_artefact_ids: metadata.deferred_artefact_ids ?? [], not_applicable_artefact_ids: metadata.not_applicable_artefact_ids ?? [], runtime_evidence_accepted_by_id: metadata.runtime_evidence_accepted_by_id, runtime_evidence_blocked_by_id: metadata.runtime_evidence_blocked_by_id, artefact_source_classification_by_id: metadata.artefact_source_classification_by_id, artefact_level2_spine_satisfaction_by_id: metadata.artefact_level2_spine_satisfaction_by_id, legacy_adapter_artefact_ids: metadata.legacy_adapter_artefact_ids, real_v3_spine_artefact_ids: metadata.real_v3_spine_artefact_ids, defect_risk_ids: metadata.defect_risk_ids, public_claim_trace_summary: metadata.public_claim_trace_summary, technique_observation_trace_summary: metadata.technique_observation_trace_summary, score_trace_summary: metadata.score_trace_summary };
    const manifestRelativePath = shouldUseExpandedManifestPaths()
      ? buildTakeAnalysisRelativePath({ run_id: metadata.run_id, take_id: baseOptions.take_id, analysis_run_id: baseOptions.analysis_run_id, leaf: 'manifest.json' })
      : 'manifest.json';
    const metricsRelativePath = shouldUseExpandedManifestPaths()
      ? buildTakeAnalysisRelativePath({ run_id: metadata.run_id, take_id: baseOptions.take_id, analysis_run_id: baseOptions.analysis_run_id, leaf: 'qa/acceptance_metrics.json' })
      : 'qa/acceptance_metrics.json';

    console.info('[internal-qa] manifest_write_attempt', { event: 'manifest_write_attempt', run_id: metadata.run_id, analysis_run_id: baseOptions.analysis_run_id, take_id: baseOptions.take_id ?? null, artefact_id: 'manifest', relative_path: manifestRelativePath, resolved_storage_path: null, sink: process.env.QA_ARTIFACT_SINK ?? 'file', bucket: process.env.QA_ARTIFACTS_BUCKET ?? null, emitted_artefact_ids: initialEmitted, timestamp: new Date().toISOString() });
    const out = await emitInternalQAArtifactManifest({ ...baseOptions, manifest_relative_path: manifestRelativePath });
    console.info('[internal-qa] manifest_write_result', { event: 'manifest_write_result',
      run_id: metadata.run_id,
      take_id: baseOptions.take_id ?? null,
      manifest_path: (out as { manifest_path?: string }).manifest_path ?? null,
      written: Boolean(out.written),
      warning: getQAWriteWarning(out),
    });
    if (!out.written || !('manifest' in out)) {
      const initialWarning = mergeQAWarnings(
        getQAWriteWarning(out),
        'internal_qa_manifest_sink_write_failed',
      );
      return { written: false, warning: initialWarning, manifest_path: (out as { manifest_path?: string }).manifest_path };
    }
    const metrics = { ...buildQAAcceptanceMetrics((out as any).manifest), ...resolveQADeploymentProvenance() };
    const qaWrite = await writeQAArtifact({ root_dir: metadata.root_dir ?? DEFAULT_ROOT, run_id: metadata.run_id, relative_path: metricsRelativePath, payload: metrics, artefact_id: 'qa_acceptance_metrics', fixture_id: metadata.fixture_id });
    console.info('[internal-qa] acceptance_metrics_write_attempt', { event: 'acceptance_metrics_write_attempt',
      run_id: metadata.run_id,
      take_id: baseOptions.take_id ?? null,
      metrics_path: qaWrite.path ?? qaWrite.storage_path ?? null,
      written: Boolean(qaWrite.written),
      warning: getQAWriteWarning(qaWrite),
    });
    console.info('[internal-qa] acceptance_metrics_write_result', { event: 'acceptance_metrics_write_result', written: Boolean(qaWrite.written), warning: getQAWriteWarning(qaWrite), sink_warning: (qaWrite as any)?.sink_warning ?? null, resolved_storage_path: qaWrite.storage_path ?? qaWrite.path ?? null });
    if (qaWrite.written) {
      const finalOut = await emitInternalQAArtifactManifest({ ...baseOptions, manifest_relative_path: manifestRelativePath, emitted_artefact_ids: [...initialEmitted, 'qa_acceptance_metrics'], runtime_evidence_accepted_by_id: [...new Set([...(metadata.runtime_evidence_accepted_by_id ?? initialEmitted), 'qa_acceptance_metrics'])] });
      let finalMetricsWrite: Awaited<ReturnType<typeof writeQAArtifact>> | null = null;
      if (finalOut.written && 'manifest' in (finalOut as any)) {
        const finalMetrics = { ...buildQAAcceptanceMetrics((finalOut as any).manifest), ...resolveQADeploymentProvenance() };
        finalMetricsWrite = await writeQAArtifact({ root_dir: metadata.root_dir ?? DEFAULT_ROOT, run_id: metadata.run_id, relative_path: metricsRelativePath, payload: finalMetrics, artefact_id: 'qa_acceptance_metrics', fixture_id: metadata.fixture_id });
      }
      const finalWarning = mergeQAWarnings(
        qaWrite.warning,
        getQAWriteWarning(finalOut),
        getQAWriteWarning(finalMetricsWrite),
        finalOut.written ? null : 'final QA manifest write failed after qa_acceptance_metrics emission',
        finalOut.written && finalMetricsWrite && !finalMetricsWrite.written ? 'final qa_acceptance_metrics rewrite failed after final manifest emission' : null,
      );
      return { written: finalOut.written, warning: finalWarning, manifest_path: (finalOut as { manifest_path?: string }).manifest_path };
    }
    const qaWriteWarning = mergeQAWarnings(getQAWriteWarning(qaWrite), 'qa_acceptance_metrics_not_written');
    return { written: false, warning: qaWriteWarning, manifest_path: (out as { manifest_path?: string }).manifest_path };
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

export async function emitEvidenceAnchorsFirstPass(input: EvidenceAnchorsEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted: false as const, emitted_artefact_ids: [] as string[], source_classification: 'missing' as const, level2_satisfies: false as const };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const reportData = unwrapRawReportData(input.raw_report_data);
  const timestampedNotes = Array.isArray(reportData.timestamped_notes) ? reportData.timestamped_notes : [];
  const anchors: Array<Record<string, unknown>> = [];
  timestampedNotes.forEach((item, originalIndex) => {
      if (!item || typeof item !== 'object') return;
      const row = item as Record<string, unknown>;
      const ts = typeof row.timestamp === 'string' ? row.timestamp : (typeof row.time === 'string' ? row.time : null);
      const note = getTimestampedNoteText(row);
      const textField = getTimestampedNoteTextField(row);
      if (!note || !textField) return;
      anchors.push({
        evidence_anchor_id: `ea-${input.take_id}-${anchors.length + 1}`,
        source_family: 'legacy_adapter',
        source_artefact_id: 'raw_report',
        source_path: `report_data.timestamped_notes[${originalIndex}].${textField}`,
        source_index: originalIndex,
        source_stage: input.source_stage,
        evidence_status: 'derived_from_legacy_report_snapshot',
        timestamp: ts,
        timestamp_source: ts ? 'raw_report_timestamped_note' : 'unavailable',
        component_id: null,
        claim_supported: false,
        evidence_text: note,
        confidence_or_strength: null,
        assessability_limitations: ['legacy_report_snapshot_not_v3_multimodal'],
        public_safe: true,
        cannot_satisfy_v3_gate: true,
        blocker_codes: ['legacy_snapshot_insufficient_for_v3_evidence_anchor_gate'],
      });
    });
  if (anchors.length === 0) return { written: false as const, emitted: false as const, emitted_artefact_ids: [] as string[], source_classification: 'missing' as const, level2_satisfies: false as const, anchors: [] as Array<Record<string, unknown>> };
  const payload = {
    schema_version: 'tapecoach_v3_evidence_anchors_first_pass_v1',
    artefact_type: 'evidence_anchors',
    internal_only: true,
    privacy_classification: 'internal_private',
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: new Date().toISOString(),
    anchor_count: anchors.length,
    anchors,
    legacy_adapter_anchor_count: anchors.length,
    report_snapshot_anchor_count: anchors.length,
    real_runtime_anchor_count: 0,
    timestamped_anchor_count: anchors.filter((a) => typeof a.timestamp === 'string' && a.timestamp.length > 0).length,
    cannot_satisfy_v3_evidence_anchor_gate: true,
    gate_satisfaction_reason: 'legacy_report_snapshot_only',
    blocker_codes: ['legacy_snapshot_insufficient_for_v3_evidence_anchor_gate'],
    redaction_notes: ['Internal-only trace; no secrets/tokens/session credentials emitted'],
    ...resolveQADeploymentProvenance(),
  };
  assertSafeSegment(input.take_id, 'take_id');
  const rel = `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/EvidenceAnchors.json`;
  const result = await writeInternalJson(root, input.run_id, rel, payload, 'evidence_anchors');
  return {
    written: result.written as boolean,
    emitted: result.written as boolean,
    emitted_artefact_ids: result.written ? ['evidence_anchors'] : [],
    source_classification: result.written ? ('legacy_adapter' as const) : ('missing' as const),
    level2_satisfies: false as const,
    warning: result.warning ?? null,
    anchors,
  };
}

const OVERCLAIM_PATTERN = /(perfect match|fits the brief perfectly|perfectly suits|professional standard|strong internal life|send with confidence|well aligned)/i;
const GENERIC_PRAISE_PATTERN = /\b(strong energy|good movement|high-energy movement|strong vocal control|vocal resonance|grounded acting|natural|believable|professional|technically strong|strong presence|strong acting|clear technique|strong technique|nice musicality|polished|expressive|dynamic|confident|good storytelling|nice warmth|strong voice|great energy)\b/i;
function findLinkedEvidenceAnchorForClaim(args: { claimText: string; sourcePath: string; timestamp?: string | null; anchors: Array<Record<string, unknown>>; }) {
  const anchors = args.anchors;
  const exactPathMatches = anchors.filter((anchor) => anchor.source_path === args.sourcePath);
  if (exactPathMatches.length === 1) return exactPathMatches[0];
  const normalisedClaim = normaliseTraceText(args.claimText);
  const timestampMatches = anchors.filter((anchor) => args.timestamp && anchor.timestamp === args.timestamp && normaliseTraceText(anchor.evidence_text) === normalisedClaim);
  if (timestampMatches.length === 1) return timestampMatches[0];
  const textMatches = anchors.filter((anchor) => normaliseTraceText(anchor.evidence_text) === normalisedClaim);
  if (textMatches.length === 1) return textMatches[0];
  const broadMatches = anchors.filter((anchor) => anchor.source_path === 'report_data.timestamped_notes' && args.sourcePath.startsWith('report_data.timestamped_notes['));
  if (broadMatches.length === 1) return broadMatches[0];
  return null;
}
function isExplicitScoreClaim(args: { claimType: string; sourcePath: string; claimText: string }): boolean {
  if (args.claimType === 'score_or_verdict') return true;
  const p = args.sourcePath;
  if (
    p === 'report_data.overall_score'
    || p === 'report_data.overall_score_final'
    || p === 'report_data.overall_score_model'
    || p === 'report_data.scores'
    || p.startsWith('report_data.scores.')
    || p.includes('.score')
    || p.startsWith('scores_or_readiness_fields')
  ) return true;
  const t = normaliseTraceText(args.claimText);
  return /(overall score|final score|model score|readiness score|rating|scored?\s+\d+|score[:\s]+\d+|\b\d+\s*\/\s*100\b)/i.test(t);
}
function classifyNumericOrScoreClaim(args: { claimType: string; sourcePath: string; claimText: string }) {
  const p = args.sourcePath;
  const t = normaliseTraceText(args.claimText);
  const overallPaths = new Set(['report_data.overall_score', 'report_data.overall_score_final', 'report_data.overall_score_model', 'report_data.overall_readiness', 'report_data.overall_readiness_score', 'report_data.readiness_score', 'scores_or_readiness_fields.overall_score', 'scores_or_readiness_fields.overall_score_final', 'scores_or_readiness_fields.overall_readiness']);
  if (overallPaths.has(p)) return { score_scope: 'overall_readiness', is_public_overall_readiness_score_risk: true, is_score_claim: true } as const;
  if (p.startsWith('report_data.scores.') || p.startsWith('scores_or_readiness_fields.')) return { score_scope: 'discipline_attribute', is_public_overall_readiness_score_risk: false, is_score_claim: true } as const;
  if (p.includes('.score')) return { score_scope: 'component_score', is_public_overall_readiness_score_risk: false, is_score_claim: true } as const;
  if (/(overall readiness|overall score|readiness score|final score|model score)/i.test(t)) return { score_scope: 'overall_readiness', is_public_overall_readiness_score_risk: true, is_score_claim: true } as const;
  if (isExplicitScoreClaim(args)) return { score_scope: 'explicit_score_wording', is_public_overall_readiness_score_risk: false, is_score_claim: true } as const;
  return { score_scope: 'not_score', is_public_overall_readiness_score_risk: false, is_score_claim: false } as const;
}

export async function emitPublicClaimTraceFirstPass(input: PublicClaimTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const reportData = unwrapRawReportData(input.raw_report_data);
  const claims: Array<Record<string, unknown>> = [];
  const addClaim = (claimText: string, sourcePath: string, claimType: string, timestamp?: string | null) => {
    const scoreMeta = classifyNumericOrScoreClaim({ claimType, sourcePath, claimText });
    const isScoreLike = scoreMeta.is_score_claim;
    const isOverclaim = OVERCLAIM_PATTERN.test(claimText);
    const isGeneric = GENERIC_PRAISE_PATTERN.test(claimText);
    const linked = findLinkedEvidenceAnchorForClaim({ claimText, sourcePath, timestamp, anchors: (input.evidence_anchors_data?.anchors ?? []) as Array<Record<string, unknown>> });
    const linkedId = linked?.evidence_anchor_id ? [linked.evidence_anchor_id] : [];
    const hasLegacyLinkOnly = linkedId.length > 0 && linked?.source_family !== 'real_runtime_v3';
    const supportStatus = isScoreLike ? 'blocked' : (hasLegacyLinkOnly ? 'legacy_untraced_claim' : (linkedId.length > 0 ? 'supported_by_evidence_anchor' : 'missing_evidence'));
    const safetyStatus = scoreMeta.is_public_overall_readiness_score_risk ? 'blocked' : (isOverclaim ? 'unsafe_or_overclaim' : (isGeneric ? 'internal_only' : (isScoreLike ? 'internal_only' : 'needs_rewrite')));
    claims.push({
      claim_id: `pc-${input.take_id}-${claims.length + 1}`,
      claim_text: claimText,
      source_family: 'legacy_adapter',
      source_artefact_id: 'raw_report',
      source_path: sourcePath,
      claim_type: isScoreLike ? 'score_or_verdict' : claimType,
      score_scope: scoreMeta.score_scope,
      linked_evidence_anchor_ids: linkedId,
      linked_truth_state_ids: [],
      support_status: supportStatus,
      public_safety_status: safetyStatus,
      rewrite_required: supportStatus !== 'supported_by_evidence_anchor' || safetyStatus !== 'public_safe_descriptor',
      blocker_codes: [
        ...(scoreMeta.is_public_overall_readiness_score_risk ? ['public_scoring_blocked'] : []),
        ...((isGeneric && linkedId.length === 0) ? ['generic_phrase_unanchored'] : []),
        ...(isOverclaim ? ['unsupported_overclaim_requires_rewrite'] : []),
        ...(linkedId.length === 0 ? ['missing_evidence_anchor_support'] : []),
      ],
      notes: hasLegacyLinkOnly ? 'linked anchor is legacy-only and cannot satisfy v3 gate' : 'legacy report snapshot trace',
    });
  };
  const fields: Array<[string, unknown, string]> = [
    ['submission_verdict.label', (reportData.submission_verdict as Record<string, unknown> | undefined)?.label, 'score_or_verdict'],
    ['submission_verdict.reason', (reportData.submission_verdict as Record<string, unknown> | undefined)?.reason, 'readiness'],
    ['verdict_final', reportData.verdict_final, 'score_or_verdict'],
    ['casting_insight', reportData.casting_insight, 'role_or_brief_fit'],
    ['casting_headline', reportData.casting_headline, 'role_or_brief_fit'],
    ['fix_first', reportData.fix_first, 'technical_or_assessability'],
    ['presentation_notes', reportData.presentation_notes, 'performance_quality'],
  ];
  for (const [pathKey, value, type] of fields) if (typeof value === 'string' && value.trim()) addClaim(value.trim(), `report_data.${pathKey}`, type);
  for (const key of ['overall_score', 'overall_score_final', 'overall_score_model'] as const) {
    const v = reportData[key];
    if (typeof v === 'number' || typeof v === 'string') addClaim(String(v), `report_data.${key}`, 'score_or_verdict');
  }
  if (isRecord(reportData.scores)) {
    for (const [k, v] of Object.entries(reportData.scores)) {
      if (typeof v === 'number' || typeof v === 'string') addClaim(`${k}: ${String(v)}`, `report_data.scores.${k}`, 'score_or_verdict');
    }
  }
  for (const [pathKey, arr, type] of [['strengths', reportData.strengths, 'performance_quality'], ['improvements', reportData.improvements, 'technical_or_assessability'], ['category_notes', reportData.category_notes, 'performance_quality'], ['category_rationale', reportData.category_rationale, 'readiness']] as const) {
    if (Array.isArray(arr)) for (const item of arr) if (typeof item === 'string' && item.trim()) addClaim(item.trim(), `report_data.${pathKey}`, type);
  }
  if (Array.isArray(reportData.timestamped_notes)) for (const [index, item] of reportData.timestamped_notes.entries()) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const text = getTimestampedNoteText(row);
    const field = getTimestampedNoteTextField(row);
    const ts = typeof row.timestamp === 'string' ? row.timestamp : (typeof row.time === 'string' ? row.time : null);
    if (text && field) addClaim(text, `report_data.timestamped_notes[${index}].${field}`, 'performance_quality', ts);
  }
  if (claims.length === 0) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const payload = {
    schema_version: 'tapecoach_v3_public_claim_trace_first_pass_v1',
    artefact_type: 'public_claim_trace',
    internal_only: true,
    privacy_classification: 'internal_private',
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: new Date().toISOString(),
    claim_count: claims.length,
    claims,
    unsupported_claim_count: claims.filter((c) => ['unsupported', 'missing_evidence', 'legacy_untraced_claim'].includes(String(c.support_status))).length,
    legacy_untraced_claim_count: claims.filter((c) => c.support_status === 'legacy_untraced_claim').length,
    unsafe_or_overclaim_count: claims.filter((c) => c.public_safety_status === 'unsafe_or_overclaim').length,
    public_safe_claim_count: claims.filter((c) => c.public_safety_status === 'public_safe_descriptor').length,
    rewrite_required_count: claims.filter((c) => c.rewrite_required === true).length,
    cannot_satisfy_public_claim_gate: true,
    gate_satisfaction_reason: 'legacy_report_snapshot_only_or_unsupported_claims',
    blocker_codes: ['public_claim_trace_legacy_or_unsupported'],
    redaction_notes: ['Internal-only trace; no secrets or token/session credentials included'],
  };
  assertSafeSegment(input.take_id, 'take_id');
  const result = await writeInternalJson(root, input.run_id, `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/PublicClaimTrace.json`, payload, 'public_claim_trace');
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ['public_claim_trace'] : [],
    claims: result.written ? claims : [],
    summary: {
      claim_count: payload.claim_count,
      unsupported_claim_count: payload.unsupported_claim_count,
      legacy_untraced_claim_count: payload.legacy_untraced_claim_count,
      unsafe_or_overclaim_count: payload.unsafe_or_overclaim_count,
      rewrite_required_count: payload.rewrite_required_count,
    },
  };
}

export async function emitTechniqueObservationTraceFirstPass(input: TechniqueObservationTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const reportData = unwrapRawReportData(input.raw_report_data);
  const anchors = (input.evidence_anchors_data?.anchors ?? []) as Array<Record<string, unknown>>;
  const claims = (input.public_claim_trace_data?.claims ?? []) as Array<Record<string, unknown>>;
  const observations: Array<Record<string, unknown>> = [];
  const extractTimestampedNoteIndex = (value: unknown): number | null => {
    if (typeof value !== 'string') return null;
    const match = value.match(/^report_data\.timestamped_notes\[(\d+)\](?:\.(note|text))?$/);
    if (!match) return null;
    const idx = Number(match[1]);
    return Number.isInteger(idx) ? idx : null;
  };
  const getTraceSourcePathFamily = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value.startsWith('report_data.')) return null;
    if (value.startsWith('report_data.timestamped_notes[')) return 'report_data.timestamped_notes';
    const knownPrefixes = [
      'report_data.strengths', 'report_data.improvements', 'report_data.priority_fixes', 'report_data.fix_first',
      'report_data.category_notes', 'report_data.category_rationale', 'report_data.detected_components',
      'report_data.coaching_drills', 'report_data.scores', 'report_data.submission_verdict', 'report_data.verdict_final',
      'report_data.overall_score', 'report_data.brief_adherence_breakdown', 'report_data.next_take_plan',
    ];
    const found = knownPrefixes.find((p) => value === p || value.startsWith(`${p}[`) || value.startsWith(`${p}.`));
    return found ?? null;
  };
  const mkLinks = (text: string, sourcePath: string, timestamp?: string | null) => {
    const n = normaliseTraceText(text);
    const observationIndex = extractTimestampedNoteIndex(sourcePath);
    const linkedEvidence = anchors.filter((a) => {
      const pathMatch = a.source_path === sourcePath;
      const contentMatch = normaliseTraceText(a.evidence_text) === n;
      const anchorIndex = extractTimestampedNoteIndex(a.source_path);
      if (observationIndex != null && anchorIndex != null && observationIndex !== anchorIndex) return false;
      const indexMatch = observationIndex != null && anchorIndex != null && observationIndex === anchorIndex;
      const timestampMatch = Boolean(timestamp && a.timestamp === timestamp);
      const safeTimestampMatch = timestampMatch && (pathMatch || contentMatch || indexMatch);
      return pathMatch || contentMatch || safeTimestampMatch;
    }).map((a) => String(a.evidence_anchor_id ?? '')).filter(Boolean);
    const linkedClaims = claims.filter((c) => {
      const pathMatch = c.source_path === sourcePath;
      const contentMatch = normaliseTraceText(c.claim_text) === n;
      const claimIndex = extractTimestampedNoteIndex(c.source_path);
      if (observationIndex != null && claimIndex != null && observationIndex !== claimIndex) return false;
      const indexMatch = observationIndex != null && claimIndex != null && observationIndex === claimIndex;
      if (pathMatch || indexMatch) return true;
      if (!contentMatch) return false;
      if (observationIndex != null || claimIndex != null) return false;
      const obsFamily = getTraceSourcePathFamily(sourcePath);
      const claimFamily = getTraceSourcePathFamily(c.source_path);
      if ((obsFamily && !claimFamily) || (!obsFamily && claimFamily)) return false;
      if (obsFamily && claimFamily && obsFamily !== claimFamily) return false;
      if (obsFamily === 'report_data.scores' || claimFamily === 'report_data.scores') return obsFamily === claimFamily;
      return true;
    }).map((c) => String(c.claim_id ?? '')).filter(Boolean);
    const linkedClaimCandidates = claims.filter((c) => linkedClaims.includes(String(c.claim_id ?? '')));
    const pathOrIndexMatches = linkedClaimCandidates.filter((c) => c.source_path === sourcePath || (() => {
      const claimIndex = extractTimestampedNoteIndex(c.source_path);
      return observationIndex != null && claimIndex != null && observationIndex === claimIndex;
    })());
    const uniqueContentMatches = linkedClaimCandidates.filter((c) => normaliseTraceText(c.claim_text) === n && !pathOrIndexMatches.includes(c));
    const contentOnlyIds = uniqueContentMatches.length === 1 ? [String(uniqueContentMatches[0].claim_id ?? '')] : [];
    const deterministicClaimIds = [...new Set([...pathOrIndexMatches.map((c) => String(c.claim_id ?? '')).filter(Boolean), ...contentOnlyIds])];
    return { linkedEvidence: [...new Set(linkedEvidence)], linkedClaims: deterministicClaimIds };
  };
  const addObs = (text: string, sourcePath: string, sourceFamily: 'legacy_adapter' | 'report_snapshot', timestamp?: string | null, index?: number) => {
    const clean = text.trim();
    if (!clean) return;
    const { linkedEvidence, linkedClaims } = mkLinks(clean, sourcePath, timestamp);
    observations.push({
      technique_observation_id: `to-${input.take_id}-${observations.length + 1}`,
      observation_type: 'other',
      observation_text_safe_summary: clean,
      observable_basis: 'legacy_report_snapshot',
      source_family: sourceFamily,
      source_artefact_id: 'raw_report',
      source_path: sourcePath,
      source_index: Number.isInteger(index) ? index : null,
      timestamp_refs: timestamp ? [timestamp] : [],
      linked_evidence_anchor_ids: linkedEvidence,
      linked_public_claim_ids: linkedClaims,
      linked_truth_state_ids: [],
      public_technique_authority_status: 'blocked',
      evidence_status: linkedEvidence.length > 0 ? 'legacy_untraced_claim' : 'missing_evidence',
      cannot_satisfy_v3_gate: true,
      blocker_codes: ['legacy_report_snapshot_not_real_runtime_technique_evidence', 'public_authority_unapproved'],
      notes: ['descriptor_only', 'public_authority_unapproved', 'insufficient_for_public_technique_authority'],
    });
  };
  const addIfString = (value: unknown, sourcePath: string, family: 'legacy_adapter' | 'report_snapshot', timestamp?: string | null, index?: number) => {
    if (typeof value === 'string' && value.trim()) addObs(value, sourcePath, family, timestamp, index);
  };
  for (const key of ['detected_components', 'category_notes', 'category_rationale', 'strengths', 'improvements', 'priority_fixes'] as const) {
    const arr = reportData[key];
    if (!Array.isArray(arr)) continue;
    arr.forEach((item, idx) => {
      if (typeof item === 'string') addObs(item, `report_data.${key}[${idx}]`, 'legacy_adapter', null, idx);
      else if (isRecord(item)) {
        const text = [item.note, item.text, item.label, item.summary].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
        if (text) addObs(text, `report_data.${key}[${idx}]`, 'legacy_adapter', typeof item.timestamp === 'string' ? item.timestamp : null, idx);
      }
    });
  }
  if (isRecord(reportData.category_notes)) {
    for (const [k, v] of Object.entries(reportData.category_notes)) addIfString(v, `report_data.category_notes.${k}`, 'report_snapshot');
  }
  if (isRecord(reportData.category_rationale)) {
    for (const [k, v] of Object.entries(reportData.category_rationale)) {
      if (typeof v === 'string') addIfString(v, `report_data.category_rationale.${k}`, 'report_snapshot');
      else if (isRecord(v)) for (const field of ['what_works', 'why_not_full_score', 'close_gap', 'standout_delta']) addIfString(v[field], `report_data.category_rationale.${k}.${field}`, 'report_snapshot');
    }
  }
  addIfString(reportData.fix_first, 'report_data.fix_first', 'report_snapshot');
  if (isRecord(reportData.brief_adherence_breakdown)) addIfString(reportData.brief_adherence_breakdown.note, 'report_data.brief_adherence_breakdown.note', 'report_snapshot');
  if (isRecord(reportData.next_take_plan) && Array.isArray((reportData.next_take_plan as Record<string, unknown>).groups)) {
    ((reportData.next_take_plan as Record<string, unknown>).groups as unknown[]).forEach((g, gi) => {
      if (!isRecord(g) || !Array.isArray(g.items)) return;
      g.items.forEach((item, ii) => addIfString(item, `report_data.next_take_plan.groups[${gi}].items[${ii}]`, 'report_snapshot', null, ii));
    });
  }
  if (Array.isArray(reportData.timestamped_notes)) reportData.timestamped_notes.forEach((item, idx) => {
    if (!isRecord(item)) return;
    const text = getTimestampedNoteText(item);
    const field = getTimestampedNoteTextField(item);
    const ts = typeof item.timestamp === 'string' ? item.timestamp : (typeof item.time === 'string' ? item.time : null);
    if (text && field) addObs(text, `report_data.timestamped_notes[${idx}].${field}`, 'report_snapshot', ts, idx);
  });
  if (observations.length === 0) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const sourceFamilySummary = observations.reduce<Record<string, number>>((acc, obs) => {
    const key = String(obs.source_family);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, { legacy_adapter: 0, report_snapshot: 0, real_runtime_v3: 0, input_artifact: 0, resolver_truth_state: 0 });
  const derivedSourceClassification = sourceFamilySummary.report_snapshot > 0 && sourceFamilySummary.legacy_adapter === 0 ? 'report_snapshot' : 'legacy_adapter';
  const payload = {
    schema_version: 'tapecoach_v3_technique_observation_trace_v1', artefact_type: 'technique_observation_trace', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, comparison_run_id: input.comparison_run_id ?? null, compared_take_ids: [],
    source_module: input.source_module, source_stage: input.source_stage, generated_at: new Date().toISOString(),
    observation_count: observations.length, observations, source_family_summary: sourceFamilySummary,
    cannot_satisfy_technique_observation_gate: true,
    gate_satisfaction_reason: 'legacy_report_snapshot_not_real_runtime_technique_evidence',
    blocker_codes: ['TechniqueObservation_legacy_only'], redaction_notes: ['Internal-only trace; no public technique authority satisfaction'],
    ...resolveQADeploymentProvenance(),
  };
  assertSafeSegment(input.take_id, 'take_id');
  const result = await writeInternalJson(root, input.run_id, `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/TechniqueObservationTrace.json`, payload, 'technique_observation_trace');
  return { written: result.written as boolean, emitted_artefact_ids: result.written ? ['technique_observation_trace'] : [], source_classification: derivedSourceClassification as 'legacy_adapter' | 'report_snapshot', source_family_summary: sourceFamilySummary as { legacy_adapter: number; report_snapshot: number; real_runtime_v3: number; input_artifact: number; resolver_truth_state: number }, level2_satisfies: false as const };
}

export async function emitScoreTraceFirstPass(input: ScoreTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const reportData = unwrapRawReportData(input.raw_report_data);
  const claims = (input.public_claim_trace_data?.claims ?? []) as Array<Record<string, unknown>>;
  const entries: Array<Record<string, unknown>> = [];
  const finiteNum = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
    return null;
  };
  const linkClaims = (sourcePath: string, scoreScope: string, scoreName: string, value: number) => claims
    .filter((c) => c?.source_path === sourcePath || (c?.source_path === sourcePath && Number(c?.claim_text) === value) || (Number(c?.claim_text) === value && c?.score_scope === scoreScope && String(c?.source_path ?? '').startsWith(sourcePath.split('.').slice(0,3).join('.')) && c?.score_name === scoreName))
    .map((c) => String(c.claim_id ?? '')).filter(Boolean);
  const push = (scope: string, name: string, value: unknown, sourcePath: string, extra: Record<string, unknown> = {}) => {
    const num = finiteNum(value);
    if (num == null) return;
    const scoreScale = scope === 'component_weight' ? '0-1' : (scope === 'calibration_modifier' ? 'modifier' : '0-100');
    entries.push({
      score_trace_id: `st-${input.take_id}-${entries.length + 1}`,
      score_scope: scope,
      score_name: name,
      score_value: num,
      score_scale: scoreScale,
      source_artefact_id: 'raw_report',
      source_family: 'legacy_adapter',
      source_path: sourcePath,
      public_scoring_status: scope === 'overall_readiness' ? 'blocked' : 'internal_trace_only',
      public_display_status: 'internal_only',
      linked_public_claim_ids: linkClaims(sourcePath, scope, name, num),
      linked_evidence_anchor_ids: [],
      linked_truth_state_ids: [],
      cannot_satisfy_v3_gate: true,
      notes: 'first-pass legacy/report-snapshot derived trace',
      blocker_codes: ['ScoreTrace_legacy_only'],
      ...extra,
    });
  };
  ['overall_score','overall_score_final','overall_score_model'].forEach((k)=>push('overall_readiness',k,reportData[k],`report_data.${k}`));
  if (isRecord(reportData.scores)) for (const [k,v] of Object.entries(reportData.scores)) push('discipline_attribute',k,v,`report_data.scores.${k}`);
  let skipped_component_weight_out_of_range = 0;
  if (Array.isArray(reportData.detected_components)) reportData.detected_components.forEach((c,i)=>{ if(!isRecord(c)) return; push('component_score','score',c.score,`report_data.detected_components[${i}].score`,{source_index:i,component_type:typeof c.type==='string'?c.type:null}); const weight = finiteNum(c.weight); if (weight == null) return; if (weight < 0 || weight > 1) { skipped_component_weight_out_of_range += 1; return; } push('component_weight','weight',weight,`report_data.detected_components[${i}].weight`,{source_index:i,component_type:typeof c.type==='string'?c.type:null,component_weight:weight,score_value_semantics:'component_weight_fraction'}); });
  if (isRecord(reportData.brief_adherence_breakdown)) ['instruction_precision','material_compliance','professionalism_signals','technical_compliance'].forEach((k)=>push('brief_adherence_subscore',k,(reportData.brief_adherence_breakdown as Record<string,unknown>)[k],`report_data.brief_adherence_breakdown.${k}`));
  push('assessment_confidence','confidence',reportData.confidence,'report_data.confidence');
  push('calibration_modifier','consistency_modifier',reportData.consistency_modifier,'report_data.consistency_modifier');
  if (!entries.length) return { written: false as const, emitted_artefact_ids: [] as string[], source_classification: 'missing' as const, level2_satisfies: false as const, score_entries: [] };
  const source_family_summary = { legacy_adapter: entries.length, report_snapshot: 0, real_runtime_v3: 0, input_artifact: 0, resolver_truth_state: 0 };
  const countScope = (scope: string) => entries.filter((x) => x.score_scope === scope).length;
  const summary = {
    score_count: entries.length,
    overall_count: countScope('overall_readiness'),
    discipline_attribute_count: countScope('discipline_attribute'),
    component_score_count: countScope('component_score'),
    component_weight_count: countScope('component_weight'),
    brief_adherence_subscore_count: countScope('brief_adherence_subscore'),
    assessment_confidence_count: countScope('assessment_confidence'),
    calibration_modifier_count: countScope('calibration_modifier'),
    calibration_metadata_count: countScope('assessment_confidence') + countScope('calibration_modifier'),
    source_family_summary,
    overall_readiness_public_score_status: 'blocked' as const,
    discipline_attribute_score_trace_status: 'internal_trace_only' as const,
    score_trace_gate_status: 'insufficient' as const,
    score_trace_gate_reason: 'legacy_report_snapshot_not_real_runtime_score_trace' as const,
  };
  const payload = { schema_version:'tapecoach_v3_score_trace_first_pass_v1', artefact_type:'score_trace', internal_only:true, privacy_classification:'internal_private', run_id:input.run_id, analysis_run_id:analysisRunId, take_id:input.take_id, generated_at:new Date().toISOString(), source_module:input.source_module ?? 'qa-artifacts-wiring.server', source_stage:input.source_stage ?? 'process_take_success', trace_mode:'first_pass_legacy_report_snapshot', score_count:entries.length, score_entries:entries, source_family_summary, overall_readiness_public_score_status:'blocked', discipline_attribute_score_status:'internal_trace_only', cannot_satisfy_score_gate:true, gate_satisfaction_reason:'legacy_report_snapshot_not_real_runtime_score_trace', blocker_codes:['ScoreTrace_legacy_only'], linked_public_claim_trace_summary:{ claim_count: claims.length }, score_trace_summary: { ...summary, skipped_component_weight_out_of_range }, ...resolveQADeploymentProvenance() };
  assertSafeSegment(input.take_id, 'take_id');
  assertSafeSegment(analysisRunId, 'analysis_run_id');
  const result = await writeInternalJson(root, input.run_id, `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ScoreTrace.json`, payload, 'score_trace');
  return { written: result.written as boolean, emitted_artefact_ids: result.written ? ['score_trace'] : [], source_classification: 'legacy_adapter' as const, level2_satisfies: false as const, score_entries: entries, score_trace_summary: { ...summary, skipped_component_weight_out_of_range } };
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
  const unavailableCommon = dedupePreservingOrder(input.unavailable_fields ?? []);
  if (!input.submission_id) unavailableCommon.push('submission_id');
  if (!input.audition_type) unavailableCommon.push('audition_type');
  if (!input.selected_level) unavailableCommon.push('selected_level');
  const unavailableCommonDedupe = dedupePreservingOrder(unavailableCommon);
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
    audition_type: input.audition_type ?? null, selected_level: input.selected_level ?? null, brief_presence: input.brief_presence ?? 'unknown', brief_presence_source: input.brief_presence_source ?? 'unavailable', material_presence: input.material_presence ?? 'unknown',
    media_reference_state: { mux_playback_id_present: Boolean(input.mux_playback_id), mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? 'unknown' },
    qa_emit_enabled_state: { V3_QA_ARTIFACTS_ENABLED: boolFromEnvOrUnknown('V3_QA_ARTIFACTS_ENABLED'), INTERNAL_QA_EMIT: boolFromEnvOrUnknown('INTERNAL_QA_EMIT') },
    unavailable_fields: unavailableCommonDedupe, redaction_notes,
  };
  const submissionSnapshot = {
    schema_version: 'tapecoach_v3_analysis_submission_v1', artefact_type: 'analysis_submission', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, source_module: input.source_module, source_stage: input.source_stage, generated_at: generatedAt,
    audition_type: input.audition_type ?? null, selected_level: input.selected_level ?? null, brief_presence: input.brief_presence ?? 'unknown', brief_presence_source: input.brief_presence_source ?? 'unavailable', material_presence: input.material_presence ?? 'unknown',
    submission_created_at: input.submission_created_at ?? null, submission_updated_at: input.submission_updated_at ?? null, component_or_task_declaration: input.component_or_task_declaration ?? null, component_or_task_declaration_status: input.component_or_task_declaration_status ?? (input.component_or_task_declaration == null ? 'unknown' : (input.component_or_task_declaration.length === 0 ? 'known_empty' : 'supplied')), component_or_task_declaration_source: input.component_or_task_declaration_source ?? (input.component_or_task_declaration == null ? 'not_loaded' : 'loaded_runtime_field'),
    safe_submission_refs: input.safe_submission_refs ?? (input.submission_id ? [`submission:${input.submission_id}`] : []),
    unavailable_fields: dedupePreservingOrder([...unavailableCommonDedupe, ...(input.submission_created_at ? [] : ['submission_created_at']), ...(input.submission_updated_at ? [] : ['submission_updated_at'])]), redaction_notes,
  };
  const takeSnapshot = {
    schema_version: 'tapecoach_v3_analysis_take_v1', artefact_type: 'analysis_take', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, source_module: input.source_module, source_stage: input.source_stage, generated_at: generatedAt,
    take_created_at: input.take_created_at ?? null, take_updated_at: input.take_updated_at ?? null, take_index: input.take_index ?? null,
    take_index_source: input.take_index_source ?? (input.take_index == null ? 'unavailable' : 'loaded_take_index'),
    stable_take_identity: { take_id: input.take_id, analysis_run_id: analysisRunId }, mux_playback_id_present: Boolean(input.mux_playback_id), safe_mux_playback_ref: input.safe_mux_playback_ref ?? input.mux_playback_id ?? null,
    media_readiness_state: input.media_readiness_state ?? null,
    unavailable_fields: dedupePreservingOrder([...unavailableCommonDedupe, ...(input.take_created_at ? [] : ['take_created_at']), ...(input.take_updated_at ? [] : ['take_updated_at'])]), redaction_notes,
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

export async function emitResolverOutputAndTruthStateMap(input: ResolverTruthStateEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const generatedAt = new Date().toISOString();
  const unresolved_inputs: string[] = [];
  const unavailable_fields = dedupePreservingOrder(input.unavailable_fields ?? []);
  const known_truths: Record<string, unknown> = { take_id: input.take_id, analysis_run_id: analysisRunId };
  const unavailable_truths: Record<string, unknown> = {};
  if (input.submission_id) known_truths.submission_id = input.submission_id;
  if (input.selected_level) known_truths.selected_level = input.selected_level;
  const briefPresenceState = normalisePresenceTruthState(input.brief_presence, input.brief_presence_source ?? 'unavailable');
  const materialPresenceState = normalisePresenceTruthState(input.material_presence, input.material_presence_source ?? 'unavailable');
  assignPresenceTruthBucket('brief_presence', briefPresenceState, known_truths, unavailable_truths);
  assignPresenceTruthBucket('material_presence', materialPresenceState, known_truths, unavailable_truths);
  known_truths.safe_media_reference_state = { mux_playback_id_present: Boolean(input.mux_playback_id), mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? 'unknown' };
  if (input.take_created_at) known_truths.take_created_at = input.take_created_at;
  if (input.take_updated_at) known_truths.take_updated_at = input.take_updated_at;
  if (input.take_index != null) known_truths.take_index = input.take_index;
  const inferred_truths: Record<string, unknown> = { comparison_run_id: input.comparison_run_id ?? null, compared_take_ids: input.compared_take_ids ?? [input.take_id] };
  unavailable_truths.role_fit = 'unavailable_without_brief_or_material_support';
  unavailable_truths.comparison_evidence = 'not_executed';
  unavailable_truths.evidence_anchors = 'not_emitted';
  unavailable_truths.public_claim_support = 'not_emitted';
  if ((input.component_or_task_declaration_status ?? 'unknown') === 'unknown') unavailable_truths.component_or_task_declaration = 'unknown_or_not_loaded';
  const unsafe_or_blocked_truths = { production_safe_status: 'blocked', public_scoring_status: 'blocked', public_technique_authority_status: 'blocked', gf01_rt15_status: 'blocked', same_video_comparison_status: 'not_executed_single_take' };
  const redaction_notes = ['No secret/token/session fields emitted; only safe booleans/refs included'];
  const resolver_output = {
    schema_version: 'tapecoach_v3_resolver_output_v1', artefact_type: 'resolver_output', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module, source_stage: input.source_stage, generated_at: generatedAt, analysis_route: input.analysis_route ?? null,
    input_artifact_refs: {
      analysis_input_record: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/input_record.json`,
      analysis_submission: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/submission.json`,
      analysis_take: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/take.json`,
    },
    audition_type: { value: input.audition_type ?? null, source: input.audition_type ? 'loaded_runtime_field' : 'unavailable', status: input.audition_type ? 'known' : 'unknown' },
    selected_level: { value: input.selected_level ?? null, source: input.selected_level ? 'loaded_runtime_field' : 'unavailable', status: input.selected_level ? 'known' : 'unknown' },
    brief_presence: briefPresenceState,
    material_presence: materialPresenceState,
    component_declaration_source: input.component_or_task_declaration_source ?? 'not_loaded',
    component_or_task_declaration_status: input.component_or_task_declaration_status ?? 'unknown',
    media_readiness_state: { value: input.media_readiness_state ?? null, source: input.media_readiness_state ? 'loaded_runtime_field' : 'unavailable', status: input.media_readiness_state ? 'known' : 'unknown' },
    safe_media_reference_state: { mux_playback_id_present: Boolean(input.mux_playback_id), mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? 'unknown' },
    take_identity: { take_id: input.take_id, analysis_run_id: analysisRunId, take_index: input.take_index ?? null, take_index_source: input.take_index_source ?? 'unavailable' },
    timestamps: { take_created_at: input.take_created_at ?? null, take_updated_at: input.take_updated_at ?? null, timestamp_source: (input.take_created_at || input.take_updated_at) ? 'loaded_take_row' : 'unavailable' },
    legacy_adapter_present: true,
    v3_spine_available: { input_artefacts_available: true, resolver_output_available: true, truth_state_map_available: true, evidence_anchors_available: false, public_claim_trace_available: false },
    unresolved_inputs, unavailable_fields, blocker_codes: ['gf01_rt15_blocked_no_comparison_runtime_evidence'], redaction_notes,
  };
  const truth_state_map = {
    schema_version: 'tapecoach_v3_truth_state_map_v1', artefact_type: 'truth_state_map', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module, source_stage: input.source_stage, generated_at: generatedAt,
    truth_state_scope: 'resolver_stage_snapshot',
    final_artefact_status_source: 'manifest.json',
    final_qa_acceptance_source: 'qa/acceptance_metrics.json',
    not_final_artefact_emission_state: true,
    known_truths, inferred_truths, unavailable_truths, unsafe_or_blocked_truths,
    brief_truths: { brief_presence: briefPresenceState.value, source: briefPresenceState.source, status: briefPresenceState.status },
    media_truths: { media_readiness_state: input.media_readiness_state ?? null, mux_playback_id_present: Boolean(input.mux_playback_id), mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? 'unknown' },
    component_truths: { declaration_source: input.component_or_task_declaration_source ?? 'not_loaded', declaration_status: input.component_or_task_declaration_status ?? 'unknown', legacy_report_detected_components: 'legacy_adapter_report_snapshot_not_v3_input_truth' },
    level_truths: { selected_level: input.selected_level ?? null, status: input.selected_level ? 'known' : 'unknown' },
    role_truths: { status: 'unavailable', reason: 'insufficient_reliable_brief_or_material_context' },
    comparison_truths: { comparison_run_executed: false, status: 'blocked_or_not_executed', compared_take_ids: input.compared_take_ids ?? [input.take_id] },
    public_authority_truths: { production_safe_status: 'blocked', public_scoring_status: 'blocked', public_technique_authority_status: 'blocked', raw_report_legacy_adapter_not_v3_proof: true },
    source_refs: resolver_output.input_artifact_refs, redaction_notes,
  };
  const base = `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver`;
  const emitted_artefact_ids: string[] = [];
  let hadFailure = false;
  for (const [id, rel, payload] of [['resolver_output', `${base}/resolver_output.json`, resolver_output], ['truth_state_map', `${base}/TruthStateMap.json`, truth_state_map]] as const) {
    const w = await writeInternalJson(root, input.run_id, rel, payload, id);
    if (w.written) emitted_artefact_ids.push(id); else hadFailure = true;
  }
  return { written: !hadFailure, emitted_artefact_ids };
}

export function dedupePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
