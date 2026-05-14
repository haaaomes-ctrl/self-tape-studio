import { assertSafeSegment, buildQAAcceptanceMetrics, DEFAULT_ROOT, emitInternalQAArtifactManifest } from './qa-artifacts.server';
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

export interface QARuntimeMetadata { run_id: string; fixture_id?: string; submission_id?: string; take_ids?: string[]; take_id?: string; compared_take_ids?: string[]; comparison_run_id?: string; analysis_run_id?: string; mux_playback_ids?: Record<string, string>; route_module?: string; commit_sha?: string; branch_name?: string; internal_qa_emit?: boolean; root_dir?: string; emitted_artefact_ids?: string[]; emitted_blocked_artefact_ids?: string[]; deferred_artefact_ids?: string[]; not_applicable_artefact_ids?: string[]; runtime_evidence_accepted_by_id?: string[]; runtime_evidence_blocked_by_id?: string[]; artefact_source_classification_by_id?: Record<string, string>; artefact_level2_spine_satisfaction_by_id?: Record<string, boolean>; legacy_adapter_artefact_ids?: string[]; real_v3_spine_artefact_ids?: string[]; defect_risk_ids?: string[]; public_claim_trace_summary?: { claim_count?: number; unsupported_claim_count?: number; legacy_untraced_claim_count?: number; unsafe_or_overclaim_count?: number; rewrite_required_count?: number; }; }
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
    const initialEmitted = [...(metadata.emitted_artefact_ids ?? [])].filter((id) => id !== 'qa_acceptance_metrics');
    const baseOptions = { internal_qa_emit: true, run_id: metadata.run_id, analysis_run_id: metadata.analysis_run_id ?? metadata.run_id, comparison_run_id: metadata.comparison_run_id, take_id: metadata.take_id ?? metadata.take_ids?.[0], submission_id: metadata.submission_id, compared_take_ids: metadata.compared_take_ids ?? metadata.take_ids ?? [], fixture_id: metadata.fixture_id, commit_sha: metadata.commit_sha, branch_name: metadata.branch_name, root_dir: metadata.root_dir, source_scope_file: 'README.md', input_refs: metadata.submission_id ? [`submission:${metadata.submission_id}`] : [], take_refs: metadata.take_ids ?? [], mux_playback_ids: metadata.mux_playback_ids, fixture_refs: metadata.route_module ? [`route:${metadata.route_module}`] : [], emitted_artefact_ids: initialEmitted, emitted_blocked_artefact_ids: metadata.emitted_blocked_artefact_ids ?? [], deferred_artefact_ids: metadata.deferred_artefact_ids ?? [], not_applicable_artefact_ids: metadata.not_applicable_artefact_ids ?? [], runtime_evidence_accepted_by_id: metadata.runtime_evidence_accepted_by_id, runtime_evidence_blocked_by_id: metadata.runtime_evidence_blocked_by_id, artefact_source_classification_by_id: metadata.artefact_source_classification_by_id, artefact_level2_spine_satisfaction_by_id: metadata.artefact_level2_spine_satisfaction_by_id, legacy_adapter_artefact_ids: metadata.legacy_adapter_artefact_ids, real_v3_spine_artefact_ids: metadata.real_v3_spine_artefact_ids, defect_risk_ids: metadata.defect_risk_ids, public_claim_trace_summary: metadata.public_claim_trace_summary };
    const out = await emitInternalQAArtifactManifest(baseOptions);
    if (!out.written || !('manifest' in out)) {
      const initialWarning = mergeQAWarnings(
        getQAWriteWarning(out),
        'internal_qa_manifest_sink_write_failed',
      );
      return { written: false, warning: initialWarning, manifest_path: (out as { manifest_path?: string }).manifest_path };
    }
    const metrics = buildQAAcceptanceMetrics((out as any).manifest);
    const qaWrite = await writeQAArtifact({ root_dir: metadata.root_dir ?? DEFAULT_ROOT, run_id: metadata.run_id, relative_path: 'qa/acceptance_metrics.json', payload: metrics, artefact_id: 'qa_acceptance_metrics', fixture_id: metadata.fixture_id });
    if (qaWrite.written) {
      const finalOut = await emitInternalQAArtifactManifest({ ...baseOptions, emitted_artefact_ids: [...initialEmitted, 'qa_acceptance_metrics'], runtime_evidence_accepted_by_id: [...new Set([...(metadata.runtime_evidence_accepted_by_id ?? initialEmitted), 'qa_acceptance_metrics'])] });
      let finalMetricsWrite: Awaited<ReturnType<typeof writeQAArtifact>> | null = null;
      if (finalOut.written && 'manifest' in (finalOut as any)) {
        const finalMetrics = buildQAAcceptanceMetrics((finalOut as any).manifest);
        finalMetricsWrite = await writeQAArtifact({ root_dir: metadata.root_dir ?? DEFAULT_ROOT, run_id: metadata.run_id, relative_path: 'qa/acceptance_metrics.json', payload: finalMetrics, artefact_id: 'qa_acceptance_metrics', fixture_id: metadata.fixture_id });
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
    summary: {
      claim_count: payload.claim_count,
      unsupported_claim_count: payload.unsupported_claim_count,
      legacy_untraced_claim_count: payload.legacy_untraced_claim_count,
      unsafe_or_overclaim_count: payload.unsafe_or_overclaim_count,
      rewrite_required_count: payload.rewrite_required_count,
    },
  };
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
  const unavailableCommon = [...new Set(input.unavailable_fields ?? [])] as string[];
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
    audition_type: input.audition_type ?? null, selected_level: input.selected_level ?? null, brief_presence: input.brief_presence ?? 'unknown', brief_presence_source: input.brief_presence_source ?? 'unavailable', material_presence: input.material_presence ?? 'unknown',
    media_reference_state: { mux_playback_id_present: Boolean(input.mux_playback_id), mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? 'unknown' },
    qa_emit_enabled_state: { V3_QA_ARTIFACTS_ENABLED: boolFromEnvOrUnknown('V3_QA_ARTIFACTS_ENABLED'), INTERNAL_QA_EMIT: boolFromEnvOrUnknown('INTERNAL_QA_EMIT') },
    unavailable_fields: unavailableCommon, redaction_notes,
  };
  const submissionSnapshot = {
    schema_version: 'tapecoach_v3_analysis_submission_v1', artefact_type: 'analysis_submission', internal_only: true, privacy_classification: 'internal_private',
    run_id: input.run_id, analysis_run_id: analysisRunId, submission_id: input.submission_id ?? null, take_id: input.take_id, source_module: input.source_module, source_stage: input.source_stage, generated_at: generatedAt,
    audition_type: input.audition_type ?? null, selected_level: input.selected_level ?? null, brief_presence: input.brief_presence ?? 'unknown', brief_presence_source: input.brief_presence_source ?? 'unavailable', material_presence: input.material_presence ?? 'unknown',
    submission_created_at: input.submission_created_at ?? null, submission_updated_at: input.submission_updated_at ?? null, component_or_task_declaration: input.component_or_task_declaration ?? null, component_or_task_declaration_status: input.component_or_task_declaration_status ?? (input.component_or_task_declaration == null ? 'unknown' : (input.component_or_task_declaration.length === 0 ? 'known_empty' : 'supplied')), component_or_task_declaration_source: input.component_or_task_declaration_source ?? (input.component_or_task_declaration == null ? 'not_loaded' : 'loaded_runtime_field'),
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

export async function emitResolverOutputAndTruthStateMap(input: ResolverTruthStateEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const generatedAt = new Date().toISOString();
  const unresolved_inputs: string[] = [];
  const unavailable_fields = [...new Set(input.unavailable_fields ?? [])];
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
