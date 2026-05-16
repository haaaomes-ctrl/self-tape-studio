import { assertSafeSegment, buildQAAcceptanceMetrics, DEFAULT_ROOT, emitInternalQAArtifactManifest, resolveQADeploymentProvenance } from './qa-artifacts.server';
import { readQAArtifactText, writeQAArtifact } from './qa-artifact-sink.server';

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



const COMPARISON_ARTEFACT_IDS = ['comparison_raw','comparison_report_internal','same_video_repeatability_trace','comparison_suppression_trace','route_variance_trace'] as const;
type ComparisonArtefactId = typeof COMPARISON_ARTEFACT_IDS[number];
const COMPARISON_BLOCKER_BY_ID: Record<ComparisonArtefactId,string> = {
  comparison_raw: 'comparison_JSON_missing',
  comparison_report_internal: 'comparison_report_unavailable',
  same_video_repeatability_trace: 'same_video_repeatability_trace_missing',
  comparison_suppression_trace: 'comparison_suppression_trace_missing',
  route_variance_trace: 'route_variance_trace_missing',
};
const COMPARISON_SOURCE_BY_ID: Record<ComparisonArtefactId,string> = {
  comparison_raw: 'internal_comparison_runtime',
  comparison_report_internal: 'internal_comparison_report',
  same_video_repeatability_trace: 'internal_comparison_trace',
  comparison_suppression_trace: 'internal_comparison_trace',
  route_variance_trace: 'internal_comparison_trace',
};
function isComparisonArtefactId(value: unknown): value is ComparisonArtefactId {
  return typeof value === 'string' && (COMPARISON_ARTEFACT_IDS as readonly string[]).includes(value);
}

export function reconcileComparisonManifestState(input: {
  manifest: Record<string, any>;
  comparison_write_success_by_id: Partial<Record<ComparisonArtefactId, boolean>>;
}) {
  const manifest = JSON.parse(JSON.stringify(input.manifest ?? {}));
  const succ = input.comparison_write_success_by_id ?? {};
  const emittedSet = new Set<string>(manifest.emitted_artifacts ?? []);
  const missingSet = new Set<string>((manifest.missing_artifacts ?? []).filter((id:string)=>!isComparisonArtefactId(id)));
  const blockerSet = new Set<string>((manifest.blocker_codes ?? []).filter((b:string)=> b !== 'comparison_report_internal_missing'));
  const acceptedSet = new Set<string>((manifest.runtime_evidence_accepted_by_id ?? []).filter((id:string)=>!isComparisonArtefactId(id)));
  const blockedSet = new Set<string>((manifest.runtime_evidence_blocked_by_id ?? []).filter((id:string)=>!isComparisonArtefactId(id)));
  const statusById = { ...(manifest.artefact_status_by_id ?? {}) };
  const srcById = { ...(manifest.artefact_source_classification_by_id ?? {}) };
  const l2ById = { ...(manifest.artefact_level2_spine_satisfaction_by_id ?? {}) };
  for (const id of COMPARISON_ARTEFACT_IDS) {
    const ok = Boolean(succ[id]);
    if (ok) {
      emittedSet.add(id); missingSet.delete(id); blockerSet.delete(COMPARISON_BLOCKER_BY_ID[id]);
      acceptedSet.add(id); blockedSet.delete(id);
      statusById[id] = 'emitted'; srcById[id] = COMPARISON_SOURCE_BY_ID[id]; l2ById[id] = false;
    } else {
      emittedSet.delete(id); missingSet.add(id); blockerSet.add(COMPARISON_BLOCKER_BY_ID[id]);
      acceptedSet.delete(id); blockedSet.add(id);
      statusById[id] = 'missing'; delete srcById[id]; delete l2ById[id];
    }
  }
  const req = Array.isArray(manifest.required_artifacts) ? manifest.required_artifacts.map((a:any)=>{
    if (!isComparisonArtefactId(a?.artefact_id)) return a;
    const id=a.artefact_id as ComparisonArtefactId;
    const ok = Boolean(succ[id]);
    return { ...a, status: ok ? 'emitted' : 'missing', blocker_code: ok ? undefined : COMPARISON_BLOCKER_BY_ID[id] };
  }) : manifest.required_artifacts;
  delete manifest.comparison_report_internal_missing;
  return {
    ...manifest,
    required_artifacts: req,
    emitted_artifacts: [...emittedSet],
    missing_artifacts: [...missingSet],
    blocker_codes: [...blockerSet],
    runtime_evidence_accepted_by_id: [...acceptedSet],
    runtime_evidence_blocked_by_id: [...blockedSet],
    artefact_status_by_id: statusById,
    artefact_source_classification_by_id: srcById,
    artefact_level2_spine_satisfaction_by_id: l2ById,
  };
}
export interface QARuntimeMetadata { run_id: string; fixture_id?: string; submission_id?: string; take_ids?: string[]; take_id?: string; compared_take_ids?: string[]; comparison_run_id?: string; analysis_run_id?: string; mux_playback_ids?: Record<string, string>; route_module?: string; commit_sha?: string; branch_name?: string; internal_qa_emit?: boolean; root_dir?: string; source_scope_file?: string; emitted_artefact_ids?: string[]; emitted_blocked_artefact_ids?: string[]; deferred_artefact_ids?: string[]; not_applicable_artefact_ids?: string[]; runtime_evidence_accepted_by_id?: string[]; runtime_evidence_blocked_by_id?: string[]; artefact_source_classification_by_id?: Record<string, string>; artefact_level2_spine_satisfaction_by_id?: Record<string, boolean>; legacy_adapter_artefact_ids?: string[]; real_v3_spine_artefact_ids?: string[]; defect_risk_ids?: string[]; public_claim_trace_summary?: { claim_count?: number; unsupported_claim_count?: number; legacy_untraced_claim_count?: number; unsafe_or_overclaim_count?: number; rewrite_required_count?: number; }; technique_observation_trace_summary?: { legacy_adapter: number; report_snapshot: number; real_runtime_v3: number; input_artifact: number; resolver_truth_state: number; }; score_trace_summary?: { score_count: number; overall_count: number; discipline_attribute_count: number; component_score_count: number; component_weight_count: number; brief_adherence_subscore_count: number; assessment_confidence_count: number; calibration_modifier_count: number; calibration_metadata_count: number; source_family_summary: { legacy_adapter: number; report_snapshot: number; real_runtime_v3: number; input_artifact: number; resolver_truth_state: number; }; overall_readiness_public_score_status: 'blocked'; discipline_attribute_score_trace_status: 'internal_trace_only'; score_trace_gate_status: 'insufficient'; score_trace_gate_reason: 'legacy_report_snapshot_not_real_runtime_score_trace'; }; model_run_trace_summary?: Record<string, unknown>; }
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
export interface ModelRunTraceEntryInput {
  model_run_id?: string;
  model_provider?: string;
  model_name?: string;
  model_role?: 'primary' | 'fallback' | 'parser' | 'unknown';
  source_stage?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  timeout_ms?: number;
  timed_out?: boolean;
  retry_count?: number;
  attempt_index?: number;
  http_status?: number;
  circuit_open?: boolean;
  fallback_used?: boolean;
  analysis_tier?: string;
  request_status?: 'started' | 'completed' | 'failed' | 'timed_out' | 'unknown';
  parse_status?: 'completed' | 'failed' | 'skipped' | 'unknown';
  safe_error_category?: string;
}
export interface ModelRunTraceEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  source_module: string;
  source_stage: string;
  analysis_route?: string;
  model_run_entries?: ModelRunTraceEntryInput[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface ComparisonRuntimeArtifactsInput { run_id: string; analysis_run_id?: string; take_id?: string | null; comparison_run_id?: string; comparison_id?: string; compared_take_ids?: string[]; comparison_raw_data?: Record<string, unknown>; suppression_trace?: Record<string, unknown>; same_video_repeatability_trace?: Record<string, unknown>; route_variance_trace?: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean; source_module?: string; source_stage?: string; }
export interface InternalComparisonTakeInput {
  take_id: string;
  analysis_run_id: string;
  analysis_route?: string | null;
  model_provider_family?: string | null;
  mux_playback_ref?: string | null;
  safe_media_fingerprint?: string | null;
  artefact_summaries?: Record<string, unknown>;
}
export interface InternalComparisonRuntimeSourceInput {
  run_id: string;
  root_take_id: string;
  root_analysis_run_id?: string;
  compared_takes: InternalComparisonTakeInput[];
  manifest_reconciliation_mode?: 'none' | 'required';
  comparison_run_id?: string;
  source_module: string;
  source_stage: string;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface InternalComparisonOperatorTriggerInput {
  root_take_id: string;
  compared_take_ids: string[];
  compared_analysis_run_ids?: string[];
  comparison_run_id?: string;
  source_module: string;
  source_stage: string;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface CompletedTakeComparisonSource extends InternalComparisonTakeInput {
  completed?: boolean;
}
export interface InternalComparisonOperatorTriggerResult {
  ok: boolean;
  written: boolean;
  comparison_run_id: string | null;
  root_take_id: string;
  root_analysis_run_id: string | null;
  compared_take_ids: string[];
  compared_analysis_run_ids: string[];
  emitted_artefact_ids: string[];
  warning?: string | null;
  blocker_codes?: string[];
}

export interface CanonicalComparisonReconciliationIdentity {
  source_run_id: string;
  canonical_qa_run_id: string;
  canonical_take_id: string;
  canonical_analysis_run_id: string;
  manifest_relative_path: 'manifest.json';
  metrics_relative_path: 'qa/acceptance_metrics.json';
  comparison_relative_paths: {
    comparison_raw: 'comparison/comparison.raw.json';
    comparison_report_internal: 'comparison/comparison.report.internal.json';
    same_video_repeatability_trace: 'comparison_traces/same_video_repeatability_trace.json';
    comparison_suppression_trace: 'comparison_traces/comparison_suppression_trace.json';
    route_variance_trace: 'comparison_traces/route_variance_trace.json';
  };
  canonical_manifest_storage_key: string;
  canonical_metrics_storage_key: string;
  canonical_comparison_root: string;
  identity_status: 'resolved' | 'comparison_reconciliation_manifest_identity_mismatch';
  blocker_code?: 'comparison_reconciliation_manifest_identity_mismatch';
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function resolveCanonicalComparisonReconciliationIdentity(input: {
  run_id: string;
  take_id?: string | null;
  root_take_id?: string | null;
  analysis_run_id?: string;
  compared_take_ids?: string[];
}): CanonicalComparisonReconciliationIdentity {
  const sourceRunId = String(input.run_id ?? '').trim();
  const takeIdRaw = (input.root_take_id ?? input.take_id ?? '').trim();
  const compared = (input.compared_take_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
  const safeMismatch = (): CanonicalComparisonReconciliationIdentity => ({
    source_run_id: sourceRunId,
    canonical_qa_run_id: '',
    canonical_take_id: '',
    canonical_analysis_run_id: '',
    manifest_relative_path: 'manifest.json',
    metrics_relative_path: 'qa/acceptance_metrics.json',
    comparison_relative_paths: {
      comparison_raw: 'comparison/comparison.raw.json',
      comparison_report_internal: 'comparison/comparison.report.internal.json',
      same_video_repeatability_trace: 'comparison_traces/same_video_repeatability_trace.json',
      comparison_suppression_trace: 'comparison_traces/comparison_suppression_trace.json',
      route_variance_trace: 'comparison_traces/route_variance_trace.json',
    },
    canonical_manifest_storage_key: '',
    canonical_metrics_storage_key: '',
    canonical_comparison_root: '',
    identity_status: 'comparison_reconciliation_manifest_identity_mismatch',
    blocker_code: 'comparison_reconciliation_manifest_identity_mismatch',
  });
  if (!takeIdRaw) return safeMismatch();
  try { assertSafeSegment(takeIdRaw, 'take_id'); } catch { return safeMismatch(); }
  if (compared.length > 0 && !compared.includes(takeIdRaw)) return safeMismatch();
  const takeRunMatch = /^take-(.+)$/.exec(sourceRunId);
  if (takeRunMatch && takeRunMatch[1] !== takeIdRaw) return safeMismatch();
  if (sourceRunId && !takeRunMatch && sourceRunId !== `take-${takeIdRaw}` && !isUuidLike(sourceRunId)) {
    try { assertSafeSegment(sourceRunId, 'run_id'); } catch { return safeMismatch(); }
  }
  const canonicalQaRunId = `take-${takeIdRaw}`;
  const canonicalAnalysisRunId = canonicalQaRunId;
  const analysisInput = (input.analysis_run_id ?? '').trim();
  if (analysisInput && analysisInput !== canonicalAnalysisRunId) return safeMismatch();
  const canonicalComparisonRoot = `takes/take-${takeIdRaw}/analysis-${canonicalAnalysisRunId}`;
  const manifestRelativePath = 'manifest.json' as const;
  const metricsRelativePath = 'qa/acceptance_metrics.json' as const;
  return {
    source_run_id: sourceRunId,
    canonical_qa_run_id: canonicalQaRunId,
    canonical_take_id: takeIdRaw,
    canonical_analysis_run_id: canonicalAnalysisRunId,
    manifest_relative_path: manifestRelativePath,
    metrics_relative_path: metricsRelativePath,
    comparison_relative_paths: {
      comparison_raw: 'comparison/comparison.raw.json',
      comparison_report_internal: 'comparison/comparison.report.internal.json',
      same_video_repeatability_trace: 'comparison_traces/same_video_repeatability_trace.json',
      comparison_suppression_trace: 'comparison_traces/comparison_suppression_trace.json',
      route_variance_trace: 'comparison_traces/route_variance_trace.json',
    },
    canonical_manifest_storage_key: `${canonicalQaRunId}/analysis-${canonicalAnalysisRunId}/${manifestRelativePath}`,
    canonical_metrics_storage_key: `${canonicalQaRunId}/analysis-${canonicalAnalysisRunId}/${metricsRelativePath}`,
    canonical_comparison_root: canonicalComparisonRoot,
    identity_status: 'resolved',
  };
}

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

function resolveTakeIdForFirstPassTraces(options: { take_id?: string | null; run_id?: string | null }): string | null {
  if (typeof options.take_id === 'string' && options.take_id.trim().length > 0) {
    const explicit = options.take_id.trim();
    assertSafeSegment(explicit, 'take_id');
    return explicit;
  }
  const runId = typeof options.run_id === 'string' ? options.run_id.trim() : '';
  const match = /^take-(.+)$/.exec(runId);
  if (!match) return null;
  const inferred = match[1]?.trim() ?? '';
  if (!inferred) return null;
  try {
    assertSafeSegment(inferred, 'take_id');
    return inferred;
  } catch {
    return null;
  }
}
function stripForbiddenFieldsDeep(value: unknown): unknown {
  const forbidden = new Set(['raw_prompt', 'prompt', 'system_prompt', 'user_prompt', 'request_body', 'raw_response', 'response_text', 'model_output', 'candidates', 'completion_text', 'headers', 'authorization', 'api_key', 'token', 'secret', 'cookie', 'session', 'signed_url', 'playback_url', 'video_url']);
  if (Array.isArray(value)) return value.map((v) => stripForbiddenFieldsDeep(v));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.has(k.toLowerCase())) continue;
    out[k] = stripForbiddenFieldsDeep(v);
  }
  return out;
}
function hasDuplicateNonEmptyString(values: unknown[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) return true;
    seen.add(trimmed);
  }
  return false;
}
function computeDeterministicComparisonRunId(comparedTakeIds: string[], comparedAnalysisRunIds: string[]): string {
  const base = [...comparedTakeIds.map((s) => s.trim()), ...comparedAnalysisRunIds.map((s) => s.trim())].filter(Boolean).sort().join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `comparison-${base.slice(0, 48) || 'unknown'}`;
}
function stripTakePrefix(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('take-')) return trimmed;
  const core = trimmed.slice(5);
  if (!core || core.startsWith('take-')) return '';
  return core;
}
function toCanonicalTakeRunId(value: string): string {
  const core = stripTakePrefix(value);
  if (!core) return '';
  assertSafeSegment(core, 'take_id');
  return `take-${core}`;
}
export async function runInternalComparisonOperatorTrigger(
  input: InternalComparisonOperatorTriggerInput,
  resolveCompletedTakeAnalysis: (takeId: string) => Promise<CompletedTakeComparisonSource | null>,
): Promise<InternalComparisonOperatorTriggerResult> {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: input.compared_take_ids ?? [], compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'internal_qa_emit_disabled', blocker_codes: ['qa_flags_disabled'] };
  }
  const rootTakeIdCore = stripTakePrefix(input.root_take_id);
  try { assertSafeSegment(rootTakeIdCore, 'root_take_id'); } catch { return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: input.compared_take_ids ?? [], compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'unsafe_root_take_id', blocker_codes: ['unsafe_root_take_id'] }; }
  const canonicalRootTakeRunId = toCanonicalTakeRunId(rootTakeIdCore);
  const rawIds = (input.compared_take_ids ?? []).map((id) => typeof id === 'string' ? id.trim() : '').filter(Boolean);
  const ids: string[] = [];
  const seenInputTakeIds = new Set<string>();
  for (const id of rawIds) {
    const core = stripTakePrefix(id);
    try { assertSafeSegment(core, 'compared_take_id'); } catch { return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: rawIds, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'unsafe_compared_take_id', blocker_codes: ['unsafe_compared_take_id'] }; }
    if (seenInputTakeIds.has(core)) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: rawIds, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'duplicate_compared_take_id', blocker_codes: ['duplicate_compared_take_id'] };
    seenInputTakeIds.add(core);
    ids.push(core);
  }
  if (ids.length < 2) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'comparison_requires_two_or_more_takes', blocker_codes: ['insufficient_compared_takes'] };
  if (!ids.includes(rootTakeIdCore)) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'root_take_id_must_be_in_compared_take_ids', blocker_codes: ['root_take_missing'] };
  if (input.compared_analysis_run_ids && input.compared_analysis_run_ids.length !== ids.length) {
    return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'compared_analysis_run_ids_length_mismatch', blocker_codes: ['analysis_run_id_cardinality_mismatch'] };
  }
  if (input.comparison_run_id !== undefined) {
    const explicitComparisonRunId = String(input.comparison_run_id);
    if (!explicitComparisonRunId.trim()) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'comparison_run_id_invalid_path', blocker_codes: ['comparison_run_id_invalid'] };
    try { assertSafeSegment(explicitComparisonRunId, 'comparison_run_id'); } catch { return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'comparison_run_id_invalid_path', blocker_codes: ['comparison_run_id_invalid'] }; }
  }
  const resolvedRows: CompletedTakeComparisonSource[] = [];
  const seenResolvedTakeIds = new Set<string>();
  for (const requestedTakeIdCore of ids) {
    let resolved: CompletedTakeComparisonSource | null = null;
    try {
      resolved = await resolveCompletedTakeAnalysis(requestedTakeIdCore);
    } catch {
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: 'take_resolution_failed',
        blocker_codes: ['take_resolution_failed'],
      };
    }
    if (!resolved) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'take_not_resolved', blocker_codes: ['take_not_resolved'] };
    const resolvedTakeCore = stripTakePrefix(resolved.take_id);
    if (typeof resolved.take_id !== 'string' || !resolved.take_id.trim() || resolvedTakeCore !== requestedTakeIdCore) {
      return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'resolver_take_id_mismatch', blocker_codes: ['resolver_take_id_mismatch'] };
    }
    if (seenResolvedTakeIds.has(resolvedTakeCore)) {
      return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'duplicate_resolved_take_id', blocker_codes: ['duplicate_resolved_take_id'] };
    }
    seenResolvedTakeIds.add(resolvedTakeCore);
    resolvedRows.push({ ...resolved, take_id: resolvedTakeCore });
  }
  const byTake = new Map(resolvedRows.map((row) => [row.take_id, row]));
  const compared_takes: InternalComparisonTakeInput[] = [];
  for (let i = 0; i < ids.length; i++) {
    const takeId = ids[i]!;
    const row = byTake.get(takeId);
    if (!row) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'take_not_resolved', blocker_codes: ['take_not_resolved'] };
    if (row.completed !== true || !row.analysis_run_id) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'take_analysis_not_completed', blocker_codes: ['take_not_completed'] };
    if (/[\\/\s]/.test(row.analysis_run_id)) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'analysis_run_id_invalid_path', blocker_codes: ['analysis_run_id_invalid_path'] };
    try {
      assertSafeSegment(row.analysis_run_id, 'analysis_run_id');
    } catch {
      return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'analysis_run_id_invalid_path', blocker_codes: ['analysis_run_id_invalid_path'] };
    }
    const explicit = input.compared_analysis_run_ids?.[i];
    if (explicit !== undefined) {
      if (typeof explicit !== 'string' || !explicit.trim()) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'explicit_analysis_run_id_mismatch', blocker_codes: ['analysis_run_id_mismatch'] };
      if (/[\\/\s]/.test(explicit)) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'analysis_run_id_invalid_path', blocker_codes: ['analysis_run_id_invalid_path'] };
      try { assertSafeSegment(explicit, 'compared_analysis_run_id'); } catch { return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'analysis_run_id_invalid_path', blocker_codes: ['analysis_run_id_invalid_path'] }; }
    }
    if (explicit && explicit !== row.analysis_run_id) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'explicit_analysis_run_id_mismatch', blocker_codes: ['analysis_run_id_mismatch'] };
    compared_takes.push({ ...row, take_id: row.take_id, analysis_run_id: row.analysis_run_id });
  }
  const root = byTake.get(rootTakeIdCore);
  if (!root) return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: ids, compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'take_not_resolved', blocker_codes: ['take_not_resolved'] };
  const out = await runInternalComparisonForTakes({
    run_id: canonicalRootTakeRunId,
    root_take_id: rootTakeIdCore,
    root_analysis_run_id: root.analysis_run_id,
    compared_takes,
    manifest_reconciliation_mode: 'required',
    comparison_run_id: input.comparison_run_id,
    source_module: input.source_module,
    source_stage: input.source_stage,
    root_dir: input.root_dir,
    internal_qa_emit: input.internal_qa_emit,
  });
  return {
    ok: out.written === true,
    written: out.written === true,
    comparison_run_id: out.comparison_run_id ?? null,
    root_take_id: input.root_take_id,
    root_analysis_run_id: canonicalRootTakeRunId || null,
    compared_take_ids: ids,
    compared_analysis_run_ids: compared_takes.map((t) => t.analysis_run_id),
    emitted_artefact_ids: out.emitted_artefact_ids ?? [],
    warning: out.warning ?? null,
    blocker_codes: out.written ? [] : ['comparison_not_emitted'],
  };
}
export async function runInternalComparisonForTakes(input: InternalComparisonRuntimeSourceInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(input.root_take_id, 'root_take_id');
  const rootTake = input.compared_takes.find((t) => t.take_id === input.root_take_id);
  if (!rootTake) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const rootAnalysisRunId = input.root_analysis_run_id ?? rootTake.analysis_run_id;
  if (!rootAnalysisRunId) return { written: false as const, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(rootAnalysisRunId, 'analysis_run_id');
  if (input.root_analysis_run_id && input.root_analysis_run_id !== rootTake.analysis_run_id) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const comparedTakeIdsRaw = input.compared_takes.map((t) => t.take_id).filter(Boolean);
  const comparedAnalysisRunIdsRaw = input.compared_takes.map((t) => t.analysis_run_id).filter(Boolean);
  const comparedTakeIds = [...new Set(comparedTakeIdsRaw)];
  const comparedAnalysisRunIds = [...new Set(comparedAnalysisRunIdsRaw)];
  if (comparedTakeIds.length < 2 || comparedAnalysisRunIds.length < 2) return { written: false as const, emitted_artefact_ids: [] as string[] };
  comparedTakeIds.forEach((id) => assertSafeSegment(id, 'compared_take_id'));
  comparedAnalysisRunIds.forEach((id) => assertSafeSegment(id, 'compared_analysis_run_id'));
  const comparison_run_id = input.comparison_run_id ?? computeDeterministicComparisonRunId(comparedTakeIds, comparedAnalysisRunIds);
  assertSafeSegment(comparison_run_id, 'comparison_run_id');
  const sameTake = hasDuplicateNonEmptyString(comparedTakeIdsRaw);
  const sameAnalysis = hasDuplicateNonEmptyString(comparedAnalysisRunIdsRaw);
  const sameMux = hasDuplicateNonEmptyString(input.compared_takes.map((t) => t.mux_playback_ref));
  const sameFingerprint = hasDuplicateNonEmptyString(input.compared_takes.map((t) => t.safe_media_fingerprint));
  const sameVideoDetected = sameTake || sameAnalysis || sameMux || sameFingerprint;
  const routes = input.compared_takes.map((t) => `${t.analysis_route ?? 'unknown'}|${t.model_provider_family ?? 'unknown'}`);
  const routeVarianceDetected = new Set(routes).size > 1;
  const suppressionRequired = sameVideoDetected || routeVarianceDetected;
  const suppressionDecision = suppressionRequired ? 'suppressed' : 'allowed_internal_only';
  const suppressionReasons = [...(sameVideoDetected ? ['same_video_or_repeated_input'] : []), ...(routeVarianceDetected ? ['unresolved_route_variance'] : [])];
  const suppressionReason = suppressionReasons[0] ?? null;
  const recommendationSuppressed = suppressionRequired;
  const comparisonDecisionStatus = sameVideoDetected ? 'suppressed_same_video' : (routeVarianceDetected ? 'suppressed_route_variance' : 'internal_preference');
  const selectedTakeId = suppressionRequired ? null : comparedTakeIds[0];
  const comparison_raw_data = stripForbiddenFieldsDeep({
    comparison_run_id,
    compared_take_ids: comparedTakeIds,
    compared_analysis_run_ids: comparedAnalysisRunIds,
    comparison_execution_status: 'executed',
    comparison_run_executed: true,
    comparison_decision_status: comparisonDecisionStatus,
    recommendation_suppressed: recommendationSuppressed,
    suppression_reason: suppressionReason,
    suppression_reasons: suppressionReasons,
    suppression_decision: suppressionDecision,
    comparison_source_kind: 'internal_runtime_comparison',
    comparison_runtime_source_module: input.source_module,
    comparison_runtime_source_stage: input.source_stage,
    selected_take_id_internal_only: selectedTakeId,
    rejected_public_winner_reason: suppressionRequired ? 'public_comparison_forbidden_or_insufficient' : null,
    comparison_result_summary: { selected_take_id_internal_only: selectedTakeId, basis: 'internal_runtime_input_summaries' },
    redaction_policy: 'exclude prompts/raw responses/request bodies/headers/secrets/tokens/cookies/signed URLs/video URLs',
    redacted_fields: ['raw_prompt', 'prompt', 'system_prompt', 'user_prompt', 'request_body', 'raw_response', 'response_text', 'model_output', 'candidates', 'completion_text', 'headers', 'authorization', 'api_key', 'token', 'secret', 'cookie', 'session', 'signed_url', 'playback_url', 'video_url'],
    forbidden_fields_absent: true,
    public_output_unchanged: true,
  }) as Record<string, unknown>;
  const same_video_repeatability_trace = {
    same_take_id: sameTake, same_analysis_run_id: sameAnalysis, same_mux_playback_ref: sameMux, same_video_detected: sameVideoDetected, repeated_input_detected: sameVideoDetected, forced_winner_risk: sameVideoDetected, false_winner_risk: sameVideoDetected, suppression_required: suppressionRequired, suppression_applied: suppressionRequired, diagnostic_entries: [{ compared_take_ids: comparedTakeIds, compared_analysis_run_ids: comparedAnalysisRunIds }], same_video_repeatability_trace_summary: { same_video_detected: sameVideoDetected },
  };
  const suppression_trace = {
    suppression_decision: suppressionDecision, suppression_reason: suppressionReason, suppression_reasons: suppressionReasons, recommendation_suppressed: recommendationSuppressed, affected_public_surfaces: ['public_output_unchanged_internal_only'], false_winner_prevention_status: suppressionRequired ? 'active' : 'not_required', same_video_suppression_status: sameVideoDetected ? 'suppressed' : 'not_applicable', route_variance_suppression_status: routeVarianceDetected ? 'suppressed' : 'not_applicable', decision_source_refs: comparedAnalysisRunIds, comparison_suppression_trace_summary: { suppression_decision: suppressionDecision }, public_output_unchanged: true,
  };
  const route_variance_trace = {
    route_variance_status: routeVarianceDetected ? 'detected' : 'not_detected', compared_run_routes: routes, route_mismatch_detected: routeVarianceDetected, route_variance_detected: routeVarianceDetected, route_variance_risk: routeVarianceDetected, route_variance_mitigation_status: routeVarianceDetected ? 'unresolved_blocked' : 'not_required', route_variance_trace_summary: { route_variance_detected: routeVarianceDetected },
  };
  if (input.manifest_reconciliation_mode === 'required') {
    return emitComparisonRuntimeArtifactsWithManifestReconciliation({ run_id: input.run_id, root_take_id: input.root_take_id, take_id: input.root_take_id, analysis_run_id: `take-${input.root_take_id}`, comparison_run_id, compared_take_ids: comparedTakeIds, comparison_raw_data, same_video_repeatability_trace, suppression_trace, route_variance_trace, source_module: input.source_module, source_stage: input.source_stage, root_dir: input.root_dir, internal_qa_emit: input.internal_qa_emit });
  }
  return emitComparisonRuntimeArtifacts({ run_id: input.run_id, take_id: input.root_take_id, analysis_run_id: rootAnalysisRunId, comparison_run_id, compared_take_ids: comparedTakeIds, comparison_raw_data, same_video_repeatability_trace, suppression_trace, route_variance_trace, source_module: input.source_module, source_stage: input.source_stage, root_dir: input.root_dir, internal_qa_emit: input.internal_qa_emit });
}
export async function emitQAManifestForAnalysisRun(metadata: QARuntimeMetadata) {
  const internalEmit = resolveInternalQAEmitEnabled({ internal_qa_emit: metadata.internal_qa_emit });
  if (!internalEmit) return { written: false, warning: null as string | null };
  try {
    const initialEmitted = [...(metadata.emitted_artefact_ids ?? [])].filter((id) => id !== 'qa_acceptance_metrics');
    const baseOptions = { internal_qa_emit: true, run_id: metadata.run_id, analysis_run_id: metadata.analysis_run_id ?? metadata.run_id, comparison_run_id: metadata.comparison_run_id, take_id: metadata.take_id ?? metadata.take_ids?.[0], submission_id: metadata.submission_id, compared_take_ids: metadata.compared_take_ids ?? metadata.take_ids ?? [], fixture_id: metadata.fixture_id, commit_sha: metadata.commit_sha, branch_name: metadata.branch_name, root_dir: metadata.root_dir, ...(metadata.source_scope_file ? { source_scope_file: metadata.source_scope_file } : {}), input_refs: metadata.submission_id ? [`submission:${metadata.submission_id}`] : [], take_refs: metadata.take_ids ?? [], mux_playback_ids: metadata.mux_playback_ids, fixture_refs: metadata.route_module ? [`route:${metadata.route_module}`] : [], emitted_artefact_ids: initialEmitted, emitted_blocked_artefact_ids: metadata.emitted_blocked_artefact_ids ?? [], deferred_artefact_ids: metadata.deferred_artefact_ids ?? [], not_applicable_artefact_ids: metadata.not_applicable_artefact_ids ?? [], runtime_evidence_accepted_by_id: metadata.runtime_evidence_accepted_by_id, runtime_evidence_blocked_by_id: metadata.runtime_evidence_blocked_by_id, artefact_source_classification_by_id: metadata.artefact_source_classification_by_id, artefact_level2_spine_satisfaction_by_id: metadata.artefact_level2_spine_satisfaction_by_id, legacy_adapter_artefact_ids: metadata.legacy_adapter_artefact_ids, real_v3_spine_artefact_ids: metadata.real_v3_spine_artefact_ids, defect_risk_ids: metadata.defect_risk_ids, public_claim_trace_summary: metadata.public_claim_trace_summary, technique_observation_trace_summary: metadata.technique_observation_trace_summary, score_trace_summary: metadata.score_trace_summary, model_run_trace_summary: metadata.model_run_trace_summary };
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
    const preFinalManifest = (out as any).manifest;
    const preFinalMetrics = { ...buildQAAcceptanceMetrics(preFinalManifest), ...resolveQADeploymentProvenance() };
    const intendedSameFinalisationArtefactIds = ['validator_trace', 'gate_trace'];
    let emittedWithInternalTraces = [...new Set(initialEmitted)];
    let artefactSourceClassificationById = { ...(metadata.artefact_source_classification_by_id ?? {}) };
    let artefactLevel2ById = { ...(metadata.artefact_level2_spine_satisfaction_by_id ?? {}) };
    let validatorTraceSummary: Record<string, unknown> | undefined;
    let gateTraceSummary: Record<string, unknown> | undefined;
    let takeIdForFirstPassTraces: string | null = null;
    try {
      takeIdForFirstPassTraces = resolveTakeIdForFirstPassTraces({ take_id: baseOptions.take_id, run_id: baseOptions.run_id });
    } catch {
      takeIdForFirstPassTraces = null;
    }
    const canEmitTakeScopedFirstPassTraces = shouldUseExpandedManifestPaths() && takeIdForFirstPassTraces !== null;
    if (canEmitTakeScopedFirstPassTraces) {
    const validatorWrite = await emitValidatorTraceFirstPass({
      run_id: metadata.run_id, analysis_run_id: baseOptions.analysis_run_id, take_id: takeIdForFirstPassTraces,
      source_module: 'src/server/v3/qa-artifacts-wiring.server.ts', source_stage: 'emitQAManifestForAnalysisRun.pre_finalisation',
      manifest_snapshot: preFinalManifest, acceptance_metrics_snapshot: preFinalMetrics, emitted_artefact_ids: emittedWithInternalTraces,
      artefact_source_classification_by_id: artefactSourceClassificationById, artefact_level2_spine_satisfaction_by_id: artefactLevel2ById,
      public_claim_trace_summary: metadata.public_claim_trace_summary, technique_observation_trace_summary: metadata.technique_observation_trace_summary,
      score_trace_summary: metadata.score_trace_summary, model_run_trace_summary: metadata.model_run_trace_summary, root_dir: metadata.root_dir, internal_qa_emit: true, intended_same_finalisation_artefact_ids: intendedSameFinalisationArtefactIds,
    });
    if (validatorWrite.written) {
      emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, 'validator_trace'])];
      artefactSourceClassificationById.validator_trace = 'internal_validator';
      artefactLevel2ById.validator_trace = false;
      validatorTraceSummary = validatorWrite.validator_trace_summary;
    }
    const gateWrite = await emitGateTraceFirstPass({
      run_id: metadata.run_id, analysis_run_id: baseOptions.analysis_run_id, take_id: takeIdForFirstPassTraces,
      source_module: 'src/server/v3/qa-artifacts-wiring.server.ts', source_stage: 'emitQAManifestForAnalysisRun.pre_finalisation',
      manifest_snapshot: preFinalManifest, acceptance_metrics_snapshot: preFinalMetrics, emitted_artefact_ids: emittedWithInternalTraces,
      missing_artefact_ids: (preFinalManifest?.missing_artifacts ?? []) as string[], blocker_codes: (preFinalManifest?.blocker_codes ?? []) as string[],
      validator_trace_summary: validatorTraceSummary, root_dir: metadata.root_dir, internal_qa_emit: true, intended_same_finalisation_artefact_ids: intendedSameFinalisationArtefactIds,
    });
    if (gateWrite.written) {
      emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, 'gate_trace'])];
      artefactSourceClassificationById.gate_trace = 'internal_gate_trace';
      artefactLevel2ById.gate_trace = false;
      gateTraceSummary = gateWrite.gate_trace_summary;
    }}
    const metrics = preFinalMetrics;
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
      const finalOut = await emitInternalQAArtifactManifest({ ...baseOptions, manifest_relative_path: manifestRelativePath, emitted_artefact_ids: [...new Set([...emittedWithInternalTraces, 'qa_acceptance_metrics'])], runtime_evidence_accepted_by_id: [...new Set([...(metadata.runtime_evidence_accepted_by_id ?? emittedWithInternalTraces), 'qa_acceptance_metrics'])], artefact_source_classification_by_id: artefactSourceClassificationById, artefact_level2_spine_satisfaction_by_id: artefactLevel2ById, validator_trace_summary: validatorTraceSummary, gate_trace_summary: gateTraceSummary });
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
  const payload = { schema_version:'tapecoach_v3_score_trace_first_pass_v1', artefact_type:'score_trace', internal_only:true, privacy_classification:'internal_private', run_id:input.run_id, analysis_run_id:analysisRunId, take_id:input.take_id, generated_at:new Date().toISOString(), source_module:input.source_module ?? 'qa-artifacts-wiring.server', source_stage:input.source_stage ?? 'process_take_success', trace_mode:'first_pass_legacy_report_snapshot', score_count:entries.length, score_entries:entries, source_family_summary, overall_readiness_public_score_status:'blocked', discipline_attribute_score_trace_status:'internal_trace_only', cannot_satisfy_score_gate:true, gate_satisfaction_reason:'legacy_report_snapshot_not_real_runtime_score_trace', blocker_codes:['ScoreTrace_legacy_only'], linked_public_claim_trace_summary:{ claim_count: claims.length }, score_trace_summary: { ...summary, skipped_component_weight_out_of_range }, ...resolveQADeploymentProvenance() };
  assertSafeSegment(input.take_id, 'take_id');
  assertSafeSegment(analysisRunId, 'analysis_run_id');
  const result = await writeInternalJson(root, input.run_id, `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ScoreTrace.json`, payload, 'score_trace');
  return { written: result.written as boolean, emitted_artefact_ids: result.written ? ['score_trace'] : [], source_classification: 'legacy_adapter' as const, level2_satisfies: false as const, score_entries: entries, score_trace_summary: { ...summary, skipped_component_weight_out_of_range } };
}

export async function emitModelRunTraceArtefact(input: Omit<TraceEmitterInput, 'artefact_id'|'relative_path'>) {
  return emitTraceArtefact({ ...input, artefact_id: 'model_run_trace', relative_path: 'traces/ModelRunTrace.json' });
}
export async function emitModelRunTraceFirstPass(input: ModelRunTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const takeId = resolveTakeIdForFirstPassTraces({ take_id: input.take_id, run_id: input.run_id });
  if (!takeId) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  assertSafeSegment(takeId, 'take_id');
  assertSafeSegment(analysisRunId, 'analysis_run_id');
  const safeEntries = (input.model_run_entries ?? []).filter((entry) => entry && typeof entry === 'object').map((entry, idx) => ({
    model_run_id: entry.model_run_id ?? `model-run-${takeId}-${idx + 1}`,
    model_provider: entry.model_provider ?? null,
    model_name: entry.model_name ?? null,
    model_role: entry.model_role ?? 'unknown',
    source_stage: entry.source_stage ?? input.source_stage,
    started_at: entry.started_at ?? null,
    completed_at: entry.completed_at ?? null,
    duration_ms: Number.isFinite(entry.duration_ms) ? entry.duration_ms : null,
    timeout_ms: Number.isFinite(entry.timeout_ms) && Number(entry.timeout_ms) >= 0 ? Number(entry.timeout_ms) : null,
    timed_out: Boolean(entry.timed_out),
    retry_count: Number.isFinite(entry.retry_count) ? entry.retry_count : 0,
    attempt_index: Number.isFinite(entry.attempt_index) ? entry.attempt_index : (idx + 1),
    http_status: Number.isFinite(entry.http_status) ? entry.http_status : null,
    circuit_open: typeof entry.circuit_open === 'boolean' ? entry.circuit_open : null,
    fallback_used: Boolean(entry.fallback_used),
    analysis_tier: entry.analysis_tier ?? null,
    request_status: entry.request_status ?? 'unknown',
    parse_status: entry.parse_status ?? 'unknown',
    safe_error_category: entry.safe_error_category ?? null,
    input_artifact_refs: ['inputs/input_record.json'],
    output_artifact_refs: ['reports/raw_report.json'],
    blocker_codes: ['ModelRunTrace_internal_only'],
  }));
  if (safeEntries.length === 0) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const summary = {
    model_run_count: safeEntries.length,
    model_run_completed_count: safeEntries.filter((x) => x.request_status === 'completed').length,
    model_run_failed_count: safeEntries.filter((x) => x.request_status === 'failed').length,
    model_run_timeout_count: safeEntries.filter((x) => x.request_status === 'timed_out' || x.timed_out).length,
    model_run_fallback_count: safeEntries.filter((x) => x.fallback_used).length,
    model_run_trace_gate_status: 'insufficient' as const,
    model_run_trace_gate_reason: 'runtime_metadata_without_independent_model_proof_chain' as const,
  };
  const payload = {
    schema_version: 'tapecoach_v3_model_run_trace_first_pass_v1',
    artefact_type: 'model_run_trace',
    internal_only: true,
    privacy_classification: 'internal_private',
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: takeId,
    generated_at: new Date().toISOString(),
    source_module: input.source_module,
    source_stage: input.source_stage,
    analysis_route: input.analysis_route ?? 'runProcessTake',
    trace_mode: 'first_pass_runtime_model_metadata',
    model_run_count: safeEntries.length,
    model_run_entries: safeEntries,
    model_run_trace_summary: summary,
    redaction_policy: 'Exclude prompts/raw model output/request+response bodies/headers/secrets/tokens/session identifiers/signed URLs.',
    redacted_fields: ['prompt', 'raw_prompt', 'system_prompt', 'user_prompt', 'request_body', 'raw_response', 'response_text', 'authorization', 'api_key', 'token', 'cookie', 'session', 'signed_url'],
    forbidden_fields_absent: true,
    cannot_satisfy_model_run_gate: true,
    gate_satisfaction_reason: 'runtime_metadata_without_independent_model_proof_chain',
    blocker_codes: ['ModelRunTrace_internal_only'],
    public_output_unchanged: true,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    ...resolveQADeploymentProvenance(),
  };
  const result = await writeInternalJson(root, input.run_id, `takes/take-${takeId}/analysis-${analysisRunId}/traces/ModelRunTrace.json`, payload, 'model_run_trace');
  return { written: result.written as boolean, emitted_artefact_ids: result.written ? ['model_run_trace'] : [], model_run_trace_summary: result.written ? summary : undefined };
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
    ?? (input.comparison_raw_data?.comparison_id as string | undefined);
  if (!comparisonRunId) return { written: false as const, emitted_artefact_ids, emitted_blocked_artefact_ids: [] as string[] };
  const comparedTakeIds = input.compared_take_ids ?? (input.comparison_raw_data?.compared_take_ids as string[] | undefined) ?? [];
  const hasComparisonDecision = Boolean(input.comparison_raw_data && (input.comparison_raw_data.comparison_result_summary || input.comparison_raw_data.raw_comparison_decision_snapshot || input.comparison_raw_data.comparison_execution_status === 'executed'));
  if (comparedTakeIds.length < 2 || !hasComparisonDecision) return { written: false as const, emitted_artefact_ids, emitted_blocked_artefact_ids: [] as string[] };
  assertSafeSegment(comparisonRunId, 'comparison_run_id');
  const takeId = resolveTakeIdForFirstPassTraces({ take_id: input.take_id, run_id: input.run_id });
  if (!takeId) return { written: false as const, emitted_artefact_ids, emitted_blocked_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  assertSafeSegment(analysisRunId, 'analysis_run_id');
  const comparisonRoot = `takes/take-${takeId}/analysis-${analysisRunId}`;
  if (input.comparison_raw_data) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison/comparison.raw.json`, { ...input.comparison_raw_data, schema_version: 'tapecoach_v3_comparison_raw_first_pass_v1', artefact_type: 'comparison_raw', internal_only: true, privacy_classification: 'internal_private', source_module: input.source_module ?? 'src/server/v3/qa-artifacts-wiring.server.ts', source_stage: input.source_stage ?? 'emitComparisonRuntimeArtifacts', comparison_run_id: comparisonRunId, compared_take_ids: comparedTakeIds, cannot_satisfy_level2_comparison_gate: true, forbidden_fields_absent: true, public_output_unchanged: true }, 'comparison_raw');
    if (w.written) emitted_artefact_ids.push('comparison_raw'); else hadFailure = true;
    const report = {
      schema_version: 'tapecoach_v3_comparison_report_internal_first_pass_v1',
      artefact_type: 'comparison_report_internal',
      internal_only: true,
      privacy_classification: 'internal_private',
      run_id: input.run_id,
      comparison_run_id: comparisonRunId,
      compared_take_ids: comparedTakeIds,
      recommendation_suppressed: Boolean(input.comparison_raw_data.recommendation_suppressed ?? input.comparison_raw_data.duplicate_or_near_duplicate_detected),
      suppression_reason: input.comparison_raw_data.suppression_reason ?? (input.comparison_raw_data.duplicate_or_near_duplicate_detected ? 'public_recommendation_suppressed_same_video_or_near_duplicate' : null),
      public_output_unchanged: true,
      user_experience_unchanged: true,
      cannot_satisfy_level2_comparison_gate: true,
      forbidden_fields_absent: true,
    };
    const rw = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison/comparison.report.internal.json`, report, 'comparison_report_internal');
    if (rw.written) emitted_artefact_ids.push('comparison_report_internal'); else hadFailure = true;
  }
  if (input.route_variance_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/route_variance_trace.json`, { ...input.route_variance_trace, cannot_satisfy_level2_comparison_gate: true, forbidden_fields_absent: true, public_output_unchanged: true }, 'route_variance_trace');
    if (w.written) emitted_artefact_ids.push('route_variance_trace'); else hadFailure = true;
  }
  if (input.suppression_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/comparison_suppression_trace.json`, { ...input.suppression_trace, cannot_satisfy_level2_comparison_gate: true, forbidden_fields_absent: true, public_output_unchanged: true }, 'comparison_suppression_trace');
    if (w.written) emitted_artefact_ids.push('comparison_suppression_trace'); else hadFailure = true;
  }
  if (input.same_video_repeatability_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison_traces/same_video_repeatability_trace.json`, { ...input.same_video_repeatability_trace, cannot_satisfy_level2_comparison_gate: true, forbidden_fields_absent: true, public_output_unchanged: true }, 'same_video_repeatability_trace');
    if (w.written) emitted_artefact_ids.push('same_video_repeatability_trace'); else hadFailure = true;
  }
  const emitted_blocked_artefact_ids: string[] = [];
  return { written: !hadFailure, comparison_run_id: comparisonRunId, emitted_artefact_ids, emitted_blocked_artefact_ids };
}

export async function emitComparisonRuntimeArtifactsWithManifestReconciliation(input: ComparisonRuntimeArtifactsInput & { root_take_id?: string | null }) {
  const root = input.root_dir ?? DEFAULT_ROOT;
  const sourceRunId = input.run_id;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const comparedTakeIds = input.compared_take_ids ?? (input.comparison_raw_data?.compared_take_ids as string[] | undefined) ?? [];
  const identity = resolveCanonicalComparisonReconciliationIdentity({
    run_id: sourceRunId,
    take_id: input.take_id ?? null,
    root_take_id: input.root_take_id ?? input.take_id ?? null,
    analysis_run_id: analysisRunId,
    compared_take_ids: comparedTakeIds,
  });
  const baseResult = {
    source_run_id: sourceRunId,
    canonical_qa_run_id: identity.canonical_qa_run_id,
    canonical_take_id: identity.canonical_take_id,
    canonical_analysis_run_id: identity.canonical_analysis_run_id,
    reconciliation_identity_status: identity.identity_status,
    manifest_preflight_read_path: identity.canonical_manifest_storage_key,
    manifest_rewrite_path: identity.canonical_manifest_storage_key,
    metrics_rewrite_path: identity.canonical_metrics_storage_key,
    comparison_artefact_write_root: identity.canonical_comparison_root,
  };
  if (identity.identity_status !== 'resolved') {
    return { written: false as const, emitted_artefact_ids: [] as string[], emitted_blocked_artefact_ids: [] as string[], ...baseResult, read_write_root_match: false, comparison_artefact_root_match: false, reconciliation_written: false, comparison_artefacts_written: false, blocker_codes: ['comparison_reconciliation_manifest_identity_mismatch'] };
  }
  const preflight = await readQAArtifactText({ root_dir: root, run_id: identity.canonical_qa_run_id, relative_path: identity.manifest_relative_path });
  if (preflight.status !== 'ok') {
    return { written: false as const, emitted_artefact_ids: [] as string[], emitted_blocked_artefact_ids: [] as string[], ...baseResult, read_write_root_match: false, comparison_artefact_root_match: false, reconciliation_written: false, comparison_artefacts_written: false, blocker_codes: [preflight.warning ?? 'comparison_reconciliation_failed'], manifest_preflight_read_status: preflight.status };
  }
  let manifestObj: Record<string, any> | null = null;
  try { manifestObj = JSON.parse(preflight.text ?? ''); } catch { manifestObj = null; }
  if (!manifestObj || typeof manifestObj !== 'object' || Array.isArray(manifestObj)) {
    return { written: false as const, emitted_artefact_ids: [] as string[], emitted_blocked_artefact_ids: [] as string[], ...baseResult, read_write_root_match: false, comparison_artefact_root_match: false, reconciliation_written: false, comparison_artefacts_written: false, blocker_codes: ['comparison_reconciliation_manifest_unreadable'] };
  }
  const emitOut = await emitComparisonRuntimeArtifacts({ ...input, run_id: identity.canonical_qa_run_id, take_id: identity.canonical_take_id, analysis_run_id: identity.canonical_analysis_run_id });
  const emittedIds = emitOut.emitted_artefact_ids ?? [];
  const reconciledManifest = reconcileComparisonManifestState({
    manifest: manifestObj,
    comparison_write_success_by_id: {
      comparison_raw: emittedIds.includes('comparison_raw'),
      comparison_report_internal: emittedIds.includes('comparison_report_internal'),
      same_video_repeatability_trace: emittedIds.includes('same_video_repeatability_trace'),
      comparison_suppression_trace: emittedIds.includes('comparison_suppression_trace'),
      route_variance_trace: emittedIds.includes('route_variance_trace'),
    },
  });
  const mw = await writeQAArtifact({ root_dir: root, run_id: identity.canonical_qa_run_id, relative_path: identity.manifest_relative_path, payload: reconciledManifest, artefact_id: 'manifest' });
  const metrics = { ...buildQAAcceptanceMetrics(reconciledManifest), ...resolveQADeploymentProvenance() };
  const qw = await writeQAArtifact({ root_dir: root, run_id: identity.canonical_qa_run_id, relative_path: identity.metrics_relative_path, payload: metrics, artefact_id: 'qa_acceptance_metrics' });
  const reconciliation_written = Boolean(mw.written && qw.written);
  const comparison_artefacts_written = emittedIds.length > 0;
  const comparison_artefact_root_match = Boolean(identity.canonical_comparison_root === `takes/take-${identity.canonical_take_id}/analysis-${identity.canonical_analysis_run_id}`);
  const read_write_root_match = Boolean(identity.canonical_manifest_storage_key.startsWith(`${identity.canonical_qa_run_id}/`) && identity.canonical_metrics_storage_key.startsWith(`${identity.canonical_qa_run_id}/`));
  return {
    ...emitOut,
    ...baseResult,
    written: Boolean(emitOut.written && reconciliation_written),
    reconciliation_written,
    comparison_artefacts_written,
    comparison_artefact_root_match,
    read_write_root_match,
    blocker_codes: emitOut.written && reconciliation_written ? [] : ['comparison_reconciliation_failed'],
  };
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

export async function emitValidatorTraceFirstPass(input: any) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false, emitted_artefact_ids: [] as string[] };
  if (!input.manifest_snapshot || !input.acceptance_metrics_snapshot) return { written: false, emitted_artefact_ids: [] as string[] };
  const analysisRunId = typeof input.analysis_run_id === 'string' && input.analysis_run_id.trim().length
    ? input.analysis_run_id.trim()
    : String(input.run_id ?? '').trim();
  if (!analysisRunId) return { written: false, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(input.take_id, 'take_id');
  assertSafeSegment(analysisRunId, 'analysis_run_id');
  const entries = [
    { validation_id: 'level2_status_agreement', validation_area: 'manifest_metrics_agreement', subject: 'level2_status', status: input.manifest_snapshot.level2_qa_acceptance === input.acceptance_metrics_snapshot.level2_status ? 'pass' : 'warn', expected: input.acceptance_metrics_snapshot.level2_status, observed: input.manifest_snapshot.level2_qa_acceptance, source_path: 'manifest.level2_qa_acceptance', related_artefact_ids: ['qa_acceptance_metrics'], blocker_codes: [], notes: null },
    { validation_id: 'public_scoring_status_agreement', validation_area: 'manifest_metrics_agreement', subject: 'public_scoring_status', status: input.manifest_snapshot.public_scoring_status === input.acceptance_metrics_snapshot.public_scoring_status ? 'pass' : 'warn', expected: input.acceptance_metrics_snapshot.public_scoring_status, observed: input.manifest_snapshot.public_scoring_status, source_path: 'manifest.public_scoring_status', related_artefact_ids: ['qa_acceptance_metrics'], blocker_codes: [], notes: null },
  ];
  const summary = { validation_count: entries.length, pass_count: entries.filter((e) => e.status === 'pass').length, warning_count: entries.filter((e) => e.status === 'warn').length, fail_count: 0, blocked_count: 0 };
  const payload = { schema_version: 'tapecoach_v3_validator_trace_first_pass_v1', artefact_type: 'validator_trace', internal_only: true, privacy_classification: 'internal_private', run_id: input.run_id, analysis_run_id: analysisRunId, take_id: input.take_id, generated_at: new Date().toISOString(), source_module: input.source_module, source_stage: input.source_stage, trace_mode: 'first_pass_internal_bundle_validator', validated_snapshot_stage: 'pre_finalisation_snapshot', final_manifest_rewrite_expected: true, self_inclusion_validated: false, intended_same_finalisation_artefact_ids: input.intended_same_finalisation_artefact_ids ?? ['validator_trace', 'gate_trace'], ...summary, validation_entries: entries, validator_trace_summary: summary, cannot_satisfy_level2_validator_gate: true, gate_satisfaction_reason: 'internal_bundle_validator_not_independent_runtime_v3_proof', blocker_codes: ['ValidatorTrace_internal_only'], public_output_unchanged: true, production_safe_status: 'blocked', public_scoring_status: 'blocked', public_technique_authority_status: 'blocked', ...resolveQADeploymentProvenance() };
  const relPath = `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ValidatorTrace.json`;
  const w = await writeInternalJson(input.root_dir ?? DEFAULT_ROOT, input.run_id, relPath, payload, 'validator_trace');
  if (!w.written) return { written: false, emitted_artefact_ids: [] as string[] };
  return { written: true, emitted_artefact_ids: ['validator_trace'], path: w.path ?? w.storage_path, validator_trace_summary: summary };
}

export async function emitGateTraceFirstPass(input: any) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false, emitted_artefact_ids: [] as string[] };
  if (!input.manifest_snapshot || !input.acceptance_metrics_snapshot) return { written: false, emitted_artefact_ids: [] as string[] };
  const analysisRunId = typeof input.analysis_run_id === 'string' && input.analysis_run_id.trim().length
    ? input.analysis_run_id.trim()
    : String(input.run_id ?? '').trim();
  if (!analysisRunId) return { written: false, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(input.take_id, 'take_id');
  assertSafeSegment(analysisRunId, 'analysis_run_id');
  const gate_entries = [
    { gate_id: 'level2_acceptance', gate_name: 'level2_acceptance', gate_family: 'level2', status: 'blocked', required_for_level: 'L2', current_state: 'not_accepted', expected_state_for_acceptance: 'accepted', observed_evidence: ['manifest.level2_qa_acceptance=not_accepted'], blocker_codes: ['level2_not_accepted'], dependent_artefact_ids: ['validator_trace', 'gate_trace'], source_paths: ['manifest.json', 'qa/acceptance_metrics.json'], public_effect: 'none_internal_only', notes: null },
    { gate_id: 'validator_trace_gate', gate_name: 'validator_trace_gate', gate_family: 'trace', status: input.emitted_artefact_ids?.includes('validator_trace') ? 'insufficient' : 'missing', required_for_level: 'L2', current_state: input.emitted_artefact_ids?.includes('validator_trace') ? 'emitted_internal_only' : 'missing', expected_state_for_acceptance: 'independent_runtime_v3', observed_evidence: [], blocker_codes: ['ValidatorTrace_internal_only'], dependent_artefact_ids: ['validator_trace'], source_paths: ['traces/ValidatorTrace.json'], public_effect: 'none_internal_only', notes: null },
  ];
  const summary = { gate_count: gate_entries.length, passed_gate_count: 0, blocked_gate_count: gate_entries.filter((g) => g.status === 'blocked').length, insufficient_gate_count: gate_entries.filter((g) => g.status === 'insufficient').length, missing_gate_count: gate_entries.filter((g) => g.status === 'missing').length, not_applicable_gate_count: 0 };
  const payload = { schema_version: 'tapecoach_v3_gate_trace_first_pass_v1', artefact_type: 'gate_trace', internal_only: true, privacy_classification: 'internal_private', run_id: input.run_id, analysis_run_id: analysisRunId, take_id: input.take_id, generated_at: new Date().toISOString(), source_module: input.source_module, source_stage: input.source_stage, trace_mode: 'first_pass_internal_gate_snapshot', validated_snapshot_stage: 'pre_finalisation_snapshot', final_manifest_rewrite_expected: true, self_inclusion_validated: false, intended_same_finalisation_artefact_ids: input.intended_same_finalisation_artefact_ids ?? ['validator_trace', 'gate_trace'], ...summary, gate_entries, gate_trace_summary: summary, cannot_satisfy_level2_gate_trace_gate: true, gate_satisfaction_reason: 'internal_gate_snapshot_not_independent_runtime_v3_proof', blocker_codes: ['GateTrace_internal_only'], level2_status: 'not_accepted', production_safe_status: 'blocked', public_scoring_status: 'blocked', public_technique_authority_status: 'blocked', public_output_unchanged: true, ...resolveQADeploymentProvenance() };
  const relPath = `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/GateTrace.json`;
  const w = await writeInternalJson(input.root_dir ?? DEFAULT_ROOT, input.run_id, relPath, payload, 'gate_trace');
  if (!w.written) return { written: false, emitted_artefact_ids: [] as string[] };
  return { written: true, emitted_artefact_ids: ['gate_trace'], path: w.path ?? w.storage_path, gate_trace_summary: summary };
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
