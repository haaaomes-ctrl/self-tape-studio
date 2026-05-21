import { createHash } from 'node:crypto';
import { assertSafeSegment, buildQAAcceptanceMetrics, DEFAULT_ROOT, emitInternalQAArtifactManifest, resolveQADeploymentProvenance, type QAArtifactEmitterOptions } from './qa-artifacts.server';
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



const COMPARISON_ARTEFACT_IDS = ['comparison_raw','comparison_report_internal','same_video_repeatability_trace','duplicate_detection_trace','comparison_suppression_trace','route_variance_trace'] as const;
type ComparisonArtefactId = typeof COMPARISON_ARTEFACT_IDS[number];
const COMPARISON_BLOCKER_BY_ID: Record<ComparisonArtefactId,string> = {
  comparison_raw: 'comparison_JSON_missing',
  comparison_report_internal: 'comparison_report_unavailable',
  same_video_repeatability_trace: 'same_video_repeatability_trace_missing',
  duplicate_detection_trace: 'duplicate_detection_trace_missing',
  comparison_suppression_trace: 'comparison_suppression_trace_missing',
  route_variance_trace: 'route_variance_trace_missing',
};
const COMPARISON_SOURCE_BY_ID: Record<ComparisonArtefactId,string> = {
  comparison_raw: 'internal_comparison_runtime',
  comparison_report_internal: 'internal_comparison_report',
  same_video_repeatability_trace: 'internal_comparison_trace',
  duplicate_detection_trace: 'internal_comparison_trace',
  comparison_suppression_trace: 'internal_comparison_trace',
  route_variance_trace: 'internal_comparison_trace',
};
function isComparisonArtefactId(value: unknown): value is ComparisonArtefactId {
  return typeof value === 'string' && (COMPARISON_ARTEFACT_IDS as readonly string[]).includes(value);
}

type ComparisonParityStatus = 'not_applicable' | 'passed' | 'failed' | 'insufficient';

function applyComparisonParityManifestState(input: {
  manifest: Record<string, any>;
  written: boolean;
  parity_status: ComparisonParityStatus;
}) {
  const manifest = JSON.parse(JSON.stringify(input.manifest ?? {}));
  const emittedSet = new Set<string>(manifest.emitted_artifacts ?? []);
  const emittedBlockedSet = new Set<string>(manifest.emitted_blocked_artefact_ids ?? []);
  const missingSet = new Set<string>(manifest.missing_artifacts ?? []);
  const deferredSet = new Set<string>(manifest.deferred_artifact_ids ?? []);
  const notApplicableSet = new Set<string>(manifest.not_applicable_artifact_ids ?? []);
  const blockerSet = new Set<string>(manifest.blocker_codes ?? []);
  const acceptedSet = new Set<string>(manifest.runtime_evidence_accepted_by_id ?? []);
  const blockedSet = new Set<string>(manifest.runtime_evidence_blocked_by_id ?? []);
  const statusById = { ...(manifest.artefact_status_by_id ?? {}) };
  const srcById = { ...(manifest.artefact_source_classification_by_id ?? {}) };
  const l2ById = { ...(manifest.artefact_level2_spine_satisfaction_by_id ?? {}) };
  const hasOtherParityBlocker = Array.isArray(manifest.required_artifacts)
    ? manifest.required_artifacts.some((artefact: any) => (
      artefact?.artefact_id !== 'parity_comparison'
      && artefact?.blocker_code === 'parity_artefacts_missing'
      && artefact?.status !== 'emitted'
      && artefact?.status !== 'not_applicable'
    ))
    : false;

  emittedSet.delete('parity_comparison');
  emittedBlockedSet.delete('parity_comparison');
  missingSet.delete('parity_comparison');
  deferredSet.delete('parity_comparison');
  notApplicableSet.delete('parity_comparison');
  acceptedSet.delete('parity_comparison');
  blockedSet.delete('parity_comparison');

  const status =
    input.parity_status === 'not_applicable'
      ? 'not_applicable'
      : (input.written && input.parity_status === 'passed'
        ? 'emitted'
        : (input.written ? 'emitted_blocked' : 'missing'));

  srcById.parity_comparison = 'internal_comparison_parity_proof';
  l2ById.parity_comparison = status === 'emitted';
  statusById.parity_comparison = status;

  if (status === 'emitted') {
    emittedSet.add('parity_comparison');
    acceptedSet.add('parity_comparison');
  } else if (status === 'emitted_blocked') {
    emittedBlockedSet.add('parity_comparison');
    blockedSet.add('parity_comparison');
    blockerSet.add('parity_artefacts_missing');
  } else if (status === 'missing') {
    missingSet.add('parity_comparison');
    blockedSet.add('parity_comparison');
    blockerSet.add('parity_artefacts_missing');
  } else {
    notApplicableSet.add('parity_comparison');
  }
  if ((status === 'emitted' || status === 'not_applicable') && !hasOtherParityBlocker) {
    blockerSet.delete('parity_artefacts_missing');
  }

  const reason =
    status === 'emitted'
      ? 'Emitted in current run'
      : (status === 'emitted_blocked'
        ? 'Emitted with blocked/not_executed runtime evidence'
        : (status === 'not_applicable' ? 'Not applicable for this run shape' : 'Not emitted by current pipeline stage'));
  const required_artifacts = Array.isArray(manifest.required_artifacts)
    ? manifest.required_artifacts.map((artefact: any) => {
      if (artefact?.artefact_id !== 'parity_comparison') return artefact;
      return {
        ...artefact,
        status,
        blocker_code: status === 'emitted' || status === 'not_applicable' ? undefined : 'parity_artefacts_missing',
        reason,
      };
    })
    : manifest.required_artifacts;

  return {
    ...manifest,
    required_artifacts,
    emitted_artifacts: [...emittedSet],
    emitted_blocked_artefact_ids: [...emittedBlockedSet],
    missing_artifacts: [...missingSet],
    deferred_artifact_ids: [...deferredSet],
    not_applicable_artifact_ids: [...notApplicableSet],
    blocker_codes: [...blockerSet],
    runtime_evidence_accepted_by_id: [...acceptedSet],
    runtime_evidence_blocked_by_id: [...blockedSet],
    artefact_status_by_id: statusById,
    artefact_source_classification_by_id: srcById,
    artefact_level2_spine_satisfaction_by_id: l2ById,
  };
}

export function reconcileComparisonManifestState(input: {
  manifest: Record<string, any>;
  comparison_write_success_by_id: Partial<Record<ComparisonArtefactId, boolean>>;
  comparison_run_id?: string | null;
  compared_take_ids?: string[];
}) {
  const manifest = JSON.parse(JSON.stringify(input.manifest ?? {}));
  const succ = input.comparison_write_success_by_id ?? {};
  const emittedSet = new Set<string>(manifest.emitted_artifacts ?? []);
  const emittedBlockedSet = new Set<string>((manifest.emitted_blocked_artefact_ids ?? []).filter((id:string)=>!isComparisonArtefactId(id)));
  const missingSet = new Set<string>((manifest.missing_artifacts ?? []).filter((id:string)=>!isComparisonArtefactId(id)));
  const deferredSet = new Set<string>((manifest.deferred_artifact_ids ?? []).filter((id:string)=>!isComparisonArtefactId(id)));
  const notApplicableSet = new Set<string>((manifest.not_applicable_artifact_ids ?? []).filter((id:string)=>!isComparisonArtefactId(id)));
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
      acceptedSet.delete(id); blockedSet.add(id);
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
    return {
      ...a,
      status: ok ? 'emitted' : 'missing',
      blocker_code: ok ? undefined : COMPARISON_BLOCKER_BY_ID[id],
      reason: ok ? 'Emitted in current run' : 'Not emitted by current pipeline stage',
    };
  }) : manifest.required_artifacts;
  delete manifest.comparison_report_internal_missing;
  const emittedComparisonArtefact = COMPARISON_ARTEFACT_IDS.some((id) => Boolean(succ[id]));
  return {
    ...manifest,
    comparison_run_id: emittedComparisonArtefact ? (input.comparison_run_id ?? manifest.comparison_run_id ?? null) : (manifest.comparison_run_id ?? null),
    compared_take_ids: emittedComparisonArtefact ? (input.compared_take_ids ?? manifest.compared_take_ids ?? []) : (manifest.compared_take_ids ?? []),
    required_artifacts: req,
    emitted_artifacts: [...emittedSet],
    emitted_blocked_artefact_ids: [...emittedBlockedSet],
    missing_artifacts: [...missingSet],
    deferred_artifact_ids: [...deferredSet],
    not_applicable_artifact_ids: [...notApplicableSet],
    blocker_codes: [...blockerSet],
    runtime_evidence_accepted_by_id: [...acceptedSet],
    runtime_evidence_blocked_by_id: [...blockedSet],
    artefact_status_by_id: statusById,
    artefact_source_classification_by_id: srcById,
    artefact_level2_spine_satisfaction_by_id: l2ById,
  };
}
type QAScoreTraceSummary = NonNullable<QAArtifactEmitterOptions['score_trace_summary']>;
export interface QARuntimeMetadata { run_id: string; fixture_id?: string; submission_id?: string; take_ids?: string[]; take_id?: string; compared_take_ids?: string[]; comparison_run_id?: string | null; analysis_run_id?: string; mux_playback_ids?: Record<string, string>; route_module?: string; commit_sha?: string; branch_name?: string; internal_qa_emit?: boolean; root_dir?: string; source_scope_file?: string; emitted_artefact_ids?: string[]; emitted_blocked_artefact_ids?: string[]; deferred_artefact_ids?: string[]; not_applicable_artefact_ids?: string[]; runtime_evidence_accepted_by_id?: string[]; runtime_evidence_blocked_by_id?: string[]; artefact_source_classification_by_id?: Record<string, string>; artefact_level2_spine_satisfaction_by_id?: Record<string, boolean>; legacy_adapter_artefact_ids?: string[]; real_v3_spine_artefact_ids?: string[]; defect_risk_ids?: string[]; public_claim_trace_summary?: QAArtifactEmitterOptions['public_claim_trace_summary']; claim_candidate_trace_summary?: QAArtifactEmitterOptions['claim_candidate_trace_summary']; evidence_anchor_trace_summary?: QAArtifactEmitterOptions['evidence_anchor_trace_summary']; technique_observation_trace_summary?: { legacy_adapter: number; report_snapshot: number; real_runtime_v3: number; input_artifact: number; resolver_truth_state: number; }; score_trace_summary?: QAScoreTraceSummary; model_run_trace_summary?: Record<string, unknown>; analysis_evidence_state_summary?: QAArtifactEmitterOptions['analysis_evidence_state_summary']; media_identity_summary?: QAArtifactEmitterOptions['media_identity_summary']; report_parity_input?: { raw_report_data?: Record<string, unknown> | null; render_payload?: Record<string, unknown> | null; public_report_payload?: Record<string, unknown> | null; allowed_public_fields?: string[]; blocked_field_paths?: string[]; blocked_score_field_paths?: string[]; }; comparison_parity_input?: { comparison_payloads?: unknown; public_comparison_surface_paths?: string[]; }; }

const COMPARISON_RISK_FIELDS = [
  'forced_winner_risk', 'false_winner_risk', 'false_winner_prevention_status',
  'same_video_unresolved_risk', 'same_video_detected', 'repeated_input_detected', 'no_material_difference', 'same_video_suppression_status', 'same_video_repeatability_status',
  'duplicate_detection_status', 'duplicate_detection_confidence', 'sufficient_upload_or_content_evidence', 'not_detected_evidence_sufficient', 'suppression_required',
  'route_variance_risk', 'route_mismatch_detected', 'route_variance_detected', 'route_variance_status', 'route_variance_mitigation_status', 'route_variance_suppression_status',
] as const;
const COMPARISON_RISK_FIELD_SET = new Set<string>(COMPARISON_RISK_FIELDS);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isSafeComparisonParitySegment(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (!trimmed) return false;
  if (trimmed === '.') return false;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return false;
  if (trimmed.includes('..')) return false;
  if (trimmed.startsWith('take-take-')) return false;
  return true;
}

function isSafeComparisonParityTakeIdSegment(value: unknown): value is string {
  return isSafeComparisonParitySegment(value) && !value.startsWith('take-');
}

function comparisonParityIdentityIsSafe(input: { run_id: string; analysis_run_id: string; take_id?: string | null; comparison_run_id?: string | null }): boolean {
  return isSafeComparisonParitySegment(input.run_id)
    && isSafeComparisonParitySegment(input.analysis_run_id)
    && (input.take_id === undefined || input.take_id === null || isSafeComparisonParityTakeIdSegment(input.take_id))
    && (input.comparison_run_id === undefined || input.comparison_run_id === null || isSafeComparisonParitySegment(input.comparison_run_id));
}

type ComparisonRiskSource = { source: string; value: Record<string, unknown> };
type ComparisonRiskFieldValue = string | number | boolean | null;
type ComparisonRiskFieldHit = { source: string; field: string; path: string; value?: ComparisonRiskFieldValue };
type ComparisonRiskSourceScanWarning = { source: string; path: string; warning: string };
type ComparisonRiskFieldDiagnostic = {
  source: string;
  field: string;
  path: string;
  value_type?: 'string' | 'number' | 'boolean' | 'null';
  value_summary?: string;
  value_hash?: string;
};

function comparisonRiskFieldValue(value: unknown): ComparisonRiskFieldValue | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return undefined;
}

function hashDiagnosticValue(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function comparisonRiskFieldDiagnostic(hit: ComparisonRiskFieldHit): ComparisonRiskFieldDiagnostic {
  if (hit.value === undefined) return { source: hit.source, field: hit.field, path: hit.path };
  if (hit.value === null) return { source: hit.source, field: hit.field, path: hit.path, value_type: 'null', value_summary: 'null' };
  if (typeof hit.value === 'boolean') {
    return { source: hit.source, field: hit.field, path: hit.path, value_type: 'boolean', value_summary: hit.value ? 'true' : 'false' };
  }
  if (typeof hit.value === 'number') {
    return { source: hit.source, field: hit.field, path: hit.path, value_type: 'number', value_summary: Number.isFinite(hit.value) ? 'finite_number' : 'non_finite_number' };
  }
  return {
    source: hit.source,
    field: hit.field,
    path: hit.path,
    value_type: 'string',
    value_summary: `string_length_${hit.value.length}`,
    value_hash: hashDiagnosticValue(hit.value),
  };
}

function collectDirectComparisonRiskFieldHits(source: string, value: Record<string, unknown>): ComparisonRiskFieldHit[] {
  return Object.keys(value)
    .map((key) => ({ original: key, normalised: key.trim().toLowerCase() }))
    .filter(({ normalised }) => COMPARISON_RISK_FIELD_SET.has(normalised))
    .map(({ original, normalised }) => ({ source, field: normalised, path: `${source}.${original}`, value: comparisonRiskFieldValue(value[original]) }));
}

function scanComparisonRiskFieldHits(source: string, value: unknown): { hits: ComparisonRiskFieldHit[]; warnings: ComparisonRiskSourceScanWarning[] } {
  const hits: ComparisonRiskFieldHit[] = [];
  const warnings: ComparisonRiskSourceScanWarning[] = [];
  const activeObjects = new WeakSet<object>();
  const maxDepth = 24;
  const markWarning = (path: string, warning: string) => warnings.push({ source, path, warning });
  const walk = (node: unknown, pathPrefix: string, depth = 0): void => {
    if (depth > maxDepth) {
      markWarning(pathPrefix, 'depth_limit_exceeded');
      return;
    }
    if (Array.isArray(node)) {
      if (activeObjects.has(node)) {
        markWarning(pathPrefix, 'cycle_detected');
        return;
      }
      activeObjects.add(node);
      node.forEach((entry, index) => walk(entry, `${pathPrefix}[${index}]`, depth + 1));
      activeObjects.delete(node);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (activeObjects.has(node)) {
      markWarning(pathPrefix, 'cycle_detected');
      return;
    }
    activeObjects.add(node);
    if (!isPlainRecord(node)) {
      markWarning(pathPrefix, 'uninspectable_object');
      activeObjects.delete(node);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const nextPath = `${pathPrefix}.${key}`;
      const normalisedKey = key.trim().toLowerCase();
      if (COMPARISON_RISK_FIELD_SET.has(normalisedKey)) hits.push({ source, field: normalisedKey, path: nextPath, value: comparisonRiskFieldValue(child) });
      walk(child, nextPath, depth + 1);
    }
    activeObjects.delete(node);
  };
  walk(value, source);
  return { hits, warnings };
}

function collectComparisonRiskSources(payloadsObject: Record<string, unknown> | null): {
  sources: ComparisonRiskSource[];
  fieldHits: ComparisonRiskFieldHit[];
  scanWarnings: ComparisonRiskSourceScanWarning[];
} {
  if (!payloadsObject) return { sources: [], fieldHits: [], scanWarnings: [] };
  const sources: ComparisonRiskSource[] = [];
  const fieldHits: ComparisonRiskFieldHit[] = [];
  const scanWarnings: ComparisonRiskSourceScanWarning[] = [];
  const topLevelHits = collectDirectComparisonRiskFieldHits('comparison_payloads', payloadsObject);
  if (topLevelHits.length > 0) {
    sources.push({ source: 'comparison_payloads', value: payloadsObject });
    fieldHits.push(...topLevelHits);
  }
  const addKnownTraceSource = (source: string, value: unknown) => {
    if (value === undefined) return;
    if (!value || typeof value !== 'object') {
      scanWarnings.push({ source, path: source, warning: 'uninspectable_source' });
      return;
    }
    if (isPlainRecord(value)) sources.push({ source, value });
    const scan = scanComparisonRiskFieldHits(source, value);
    fieldHits.push(...scan.hits);
    scanWarnings.push(...scan.warnings);
  };
  const addExplicitInternalSource = (source: string, value: unknown) => {
    if (value === undefined) return;
    if (!value || typeof value !== 'object') return;
    const scan = scanComparisonRiskFieldHits(source, value);
    if (scan.hits.length > 0 && isPlainRecord(value)) sources.push({ source, value });
    fieldHits.push(...scan.hits);
    scanWarnings.push(...scan.warnings);
  };
  addKnownTraceSource('same_video_repeatability_trace', payloadsObject.same_video_repeatability_trace);
  addKnownTraceSource('duplicate_detection_trace', payloadsObject.duplicate_detection_trace);
  addKnownTraceSource('route_variance_trace', payloadsObject.route_variance_trace);
  addKnownTraceSource('comparison_suppression_trace', payloadsObject.comparison_suppression_trace);
  addExplicitInternalSource('comparison_raw', payloadsObject.comparison_raw);
  addExplicitInternalSource('comparison_report_internal', payloadsObject.comparison_report_internal);
  return { sources, fieldHits, scanWarnings };
}

export async function emitComparisonParityProof(input: {
  run_id: string; analysis_run_id?: string; take_id?: string | null; submission_id?: string | null; comparison_run_id?: string | null; compared_take_ids?: string[]; root_dir?: string; internal_qa_emit?: boolean; comparison_invoked: boolean; comparison_evidence_status: Record<string, boolean>; comparison_payloads?: unknown; public_comparison_surface_paths?: string[];
}) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[], parity_status: 'not_applicable' as const };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const evidence = input.comparison_evidence_status;
  const requiredOk = Object.values(evidence).every(Boolean);
  const payloads = input.comparison_payloads;
  const payloadsObject = isPlainRecord(payloads) ? payloads : null;
  const extract = (obj: unknown, path: string): unknown => path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
  const publicSurfaces = [
    { key: 'public_comparison_payload', value: payloadsObject?.public_comparison_payload },
    { key: 'comparison_public_payload', value: payloadsObject?.comparison_public_payload },
    { key: 'public_output', value: payloadsObject?.public_output },
    { key: 'comparison_output_public', value: payloadsObject?.comparison_output_public },
    { key: 'render_payload.comparison', value: extract(payloadsObject, 'render_payload.comparison') },
    { key: 'public_report_payload.comparison', value: extract(payloadsObject, 'public_report_payload.comparison') },
    ...((input.public_comparison_surface_paths ?? []).map((surfacePath) => ({ key: surfacePath, value: extract(payloadsObject, surfacePath) }))),
  ].filter((x) => isPlainRecord(x.value) || Array.isArray(x.value));
  const hasPublicOutputAbsenceEvidence = Boolean(
    payloadsObject?.public_comparison_output_absent_or_unchanged === true
    || payloadsObject?.public_output_unchanged === true
    || payloadsObject?.comparison_public_output_absent === true
  );
  const publicSurfaceContextAvailable = publicSurfaces.length > 0 || hasPublicOutputAbsenceEvidence;
  const forbiddenPublicFields = new Set(['winner', 'public_winner', 'selected_winner', 'selected_take_id_public', 'recommendation', 'public_recommendation', 'comparison_recommendation', 'forced_winner', 'false_winner', 'castability', 'bookability', 'marketability', 'public_scoring', 'public_score', 'public_technique_authority', 'technique_authority']);
  const winnerFields = new Set(['winner', 'public_winner', 'selected_winner', 'selected_take_id_public']);
  const recommendationFields = new Set(['recommendation', 'public_recommendation', 'comparison_recommendation']);
  const forbiddenHits: Array<{ surface: string; field: string; path: string }> = [];
  const publicSurfaceScanIssues: Array<{ surface: string; path: string; issue: string }> = [];
  const activePublicSurfacePathObjects = new WeakSet<object>();
  const maxPublicSurfaceScanDepth = 24;
  const markPublicScanIssue = (surface: string, path: string, issue: string) => {
    publicSurfaceScanIssues.push({ surface, path, issue });
  };
  const walk = (value: unknown, pathPrefix: string, surface: string, depth = 0): void => {
    if (depth > maxPublicSurfaceScanDepth) {
      markPublicScanIssue(surface, pathPrefix, 'depth_limit_exceeded');
      return;
    }
    if (Array.isArray(value)) {
      if (activePublicSurfacePathObjects.has(value)) {
        markPublicScanIssue(surface, pathPrefix, 'cycle_detected');
        return;
      }
      activePublicSurfacePathObjects.add(value);
      value.forEach((entry, idx) => walk(entry, `${pathPrefix}[${idx}]`, surface, depth + 1));
      activePublicSurfacePathObjects.delete(value);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (activePublicSurfacePathObjects.has(value)) {
      markPublicScanIssue(surface, pathPrefix, 'cycle_detected');
      return;
    }
    activePublicSurfacePathObjects.add(value);
    if (!isPlainRecord(value)) {
      markPublicScanIssue(surface, pathPrefix, 'uninspectable_object');
      activePublicSurfacePathObjects.delete(value);
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = pathPrefix ? `${pathPrefix}.${k}` : k;
      const normalisedKey = k.trim().toLowerCase();
      if (forbiddenPublicFields.has(normalisedKey)) forbiddenHits.push({ surface, field: normalisedKey, path: nextPath });
      walk(v, nextPath, surface, depth + 1);
    }
    activePublicSurfacePathObjects.delete(value);
  };
  for (const surface of publicSurfaces) walk(surface.value, surface.key, surface.key);
  const publicSurfaceScanSafe = publicSurfaceScanIssues.length === 0;
  const publicWinnerAbsent = !forbiddenHits.some((x) => winnerFields.has(x.field));
  const publicRecommendationAbsent = !forbiddenHits.some((x) => recommendationFields.has(x.field));
  const riskSourceCollection = collectComparisonRiskSources(payloadsObject);
  const riskSources = riskSourceCollection.sources;
  const riskFieldHits = riskSourceCollection.fieldHits;
  const riskSourceScanSafe = riskSourceCollection.scanWarnings.length === 0;
  const acceptedMitigationStatuses = new Set(['not_required', 'mitigated', 'resolved', 'accepted', 'suppressed', 'applied', 'recommended']);
  const duplicateStatuses = new Set(['detected', 'likely_duplicate', 'possible_duplicate', 'insufficient_evidence', 'not_detected']);
  const normaliseRiskStatus = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : null);
  const isAcceptedComparisonMitigation = (value: unknown) => {
    const status = normaliseRiskStatus(value);
    return Boolean(status && acceptedMitigationStatuses.has(status));
  };
  const riskHitsFor = (field: string) => riskFieldHits.filter((hit) => hit.field === field);
  const riskHitValueIs = (hit: ComparisonRiskFieldHit, expected: boolean | string) => {
    if (typeof expected === 'string') return normaliseRiskStatus(hit.value) === expected;
    return hit.value === expected;
  };
  const hasRiskHit = (field: string, expected: boolean | string): boolean => riskHitsFor(field).some((hit) => riskHitValueIs(hit, expected));
  const parentRiskPath = (path: string): string => path.replace(/\.[^.]+$/, '');
  const mitigationAppliesToRiskHit = (riskHit: ComparisonRiskFieldHit, mitigationHit: ComparisonRiskFieldHit): boolean => {
    if (riskHit.source !== mitigationHit.source) return false;
    const mitigationParent = parentRiskPath(mitigationHit.path);
    return mitigationParent === riskHit.source || mitigationParent === parentRiskPath(riskHit.path);
  };
  const hasAcceptedRiskMitigationForHit = (riskHit: ComparisonRiskFieldHit, fields: string[]): boolean =>
    riskFieldHits.some((hit) => fields.includes(hit.field) && isAcceptedComparisonMitigation(hit.value) && mitigationAppliesToRiskHit(riskHit, hit));
  const hasUnmitigatedRiskHit = (flagField: string, mitigationFields: string[], expected: boolean | string = true): boolean =>
    riskHitsFor(flagField).some((hit) => riskHitValueIs(hit, expected) && !hasAcceptedRiskMitigationForHit(hit, mitigationFields));
  const noRiskStatusFields = new Set(['same_video_repeatability_status', 'route_variance_status']);
  const mitigationStatusFields = new Set(['same_video_suppression_status', 'route_variance_mitigation_status', 'route_variance_suppression_status', 'false_winner_prevention_status']);
  const riskContextValueInspectable = (hit: ComparisonRiskFieldHit): boolean => {
    if (typeof hit.value === 'boolean') return true;
    const status = normaliseRiskStatus(hit.value);
    if (!status) return false;
    if (hit.field === 'duplicate_detection_status') return duplicateStatuses.has(status);
    if (noRiskStatusFields.has(hit.field)) return status === 'not_detected';
    if (mitigationStatusFields.has(hit.field)) return acceptedMitigationStatuses.has(status);
    return false;
  };
  const hasRiskContext = (...fields: string[]): boolean =>
    riskFieldHits.some((hit) => fields.includes(hit.field) && riskContextValueInspectable(hit));
  const sourceKeysForRiskHits = (predicate: (hit: ComparisonRiskFieldHit) => boolean): string[] => [...new Set(riskFieldHits.filter(predicate).map((hit) => hit.source))];
  const sameVideoRiskContextAvailable = hasRiskContext('same_video_unresolved_risk', 'same_video_detected', 'repeated_input_detected', 'no_material_difference', 'same_video_suppression_status', 'same_video_repeatability_status');
  const routeVarianceRiskContextAvailable = hasRiskContext('route_variance_risk', 'route_mismatch_detected', 'route_variance_detected', 'route_variance_status', 'route_variance_mitigation_status', 'route_variance_suppression_status');
  const forcedFalseWinnerRiskContextAvailable = hasRiskContext('forced_winner_risk', 'false_winner_risk', 'false_winner_prevention_status');
  const duplicateTrace = payloadsObject && isPlainRecord(payloadsObject.duplicate_detection_trace)
    ? payloadsObject.duplicate_detection_trace
    : null;
  const duplicateDetectionStatus = normaliseRiskStatus(duplicateTrace?.duplicate_detection_status);
  const duplicateDetectionContextAvailable = Boolean(duplicateTrace && duplicateDetectionStatus && duplicateStatuses.has(duplicateDetectionStatus));
  const suppressionTrace = payloadsObject && isPlainRecord(payloadsObject.comparison_suppression_trace)
    ? payloadsObject.comparison_suppression_trace
    : null;
  const duplicateSuppressionApplied = Boolean(
    suppressionTrace?.recommendation_suppressed === true
    || isAcceptedComparisonMitigation(suppressionTrace?.same_video_suppression_status)
    || duplicateTrace?.suppression_applied === true
  );
  const decisiveEvidenceDelta = Boolean(
    duplicateTrace?.evidence_delta_material_difference_status === 'decisive'
    || duplicateTrace?.evidence_delta_trace_status === 'decisive_material_difference'
    || duplicateTrace?.no_material_difference === false
  );
  const duplicateDetectionBlocker = (() => {
    if (!duplicateTrace || !duplicateDetectionStatus || !duplicateStatuses.has(duplicateDetectionStatus)) return 'duplicate_detection_trace_missing';
    if (duplicateDetectionStatus === 'insufficient_evidence') return 'duplicate_detection_insufficient_evidence';
    if (duplicateDetectionStatus === 'possible_duplicate' && !decisiveEvidenceDelta) return 'duplicate_detection_possible_duplicate_unresolved';
    if ((duplicateDetectionStatus === 'detected' || duplicateDetectionStatus === 'likely_duplicate') && !duplicateSuppressionApplied) return 'duplicate_detection_without_suppression';
    if ((duplicateDetectionStatus === 'detected' || duplicateDetectionStatus === 'likely_duplicate') && !decisiveEvidenceDelta) return 'duplicate_detection_suppressed_without_evidence_delta';
    if (duplicateDetectionStatus === 'not_detected' && duplicateTrace.not_detected_evidence_sufficient !== true && duplicateTrace.sufficient_upload_or_content_evidence !== true) return 'duplicate_detection_not_detected_without_content_evidence';
    return null;
  })();
  const duplicateDetectionFailed = duplicateDetectionBlocker === 'duplicate_detection_without_suppression';
  const duplicateDetectionInsufficient = Boolean(duplicateDetectionBlocker && !duplicateDetectionFailed);
  const comparisonRiskContextAvailable = sameVideoRiskContextAvailable && routeVarianceRiskContextAvailable && forcedFalseWinnerRiskContextAvailable && duplicateDetectionContextAvailable;
  const forcedWinnerRiskAbsent = !hasRiskHit('forced_winner_risk', true);
  const falseWinnerRiskAbsent = !hasRiskHit('false_winner_risk', true);
  const routeVarianceRiskAbsent = !(
    hasRiskHit('route_variance_mitigation_status', 'unresolved_blocked')
    || hasUnmitigatedRiskHit('route_variance_risk', ['route_variance_mitigation_status', 'route_variance_suppression_status'])
    || hasUnmitigatedRiskHit('route_mismatch_detected', ['route_variance_mitigation_status', 'route_variance_suppression_status'])
    || hasUnmitigatedRiskHit('route_variance_detected', ['route_variance_mitigation_status', 'route_variance_suppression_status'])
  );
  const sameVideoRiskAbsent = !(
    hasUnmitigatedRiskHit('same_video_unresolved_risk', ['same_video_suppression_status'])
    || hasUnmitigatedRiskHit('same_video_detected', ['same_video_suppression_status'])
    || hasUnmitigatedRiskHit('repeated_input_detected', ['same_video_suppression_status'])
    || hasUnmitigatedRiskHit('no_material_difference', ['same_video_suppression_status'], false)
  );
  const comparisonPayloadsAvailable = Boolean(
    payloadsObject
    && (
      publicSurfaces.length > 0
      || hasPublicOutputAbsenceEvidence
      || riskSourceCollection.fieldHits.length > 0
    )
  );
  const forbiddenPublicComparisonFieldsAbsent = forbiddenHits.length === 0;
  const failedRiskOrLeakDetected = !forbiddenPublicComparisonFieldsAbsent || !forcedWinnerRiskAbsent || !falseWinnerRiskAbsent || !routeVarianceRiskAbsent || !sameVideoRiskAbsent || duplicateDetectionFailed;
  const mismatch: Array<Record<string, unknown>> = [];
  if (!requiredOk && input.comparison_invoked) mismatch.push({ mismatch_type: 'missing_required_comparison_evidence' });
  if (!comparisonPayloadsAvailable && input.comparison_invoked) mismatch.push({ mismatch_type: 'comparison_parity_payload_missing' });
  if (!publicSurfaceContextAvailable && input.comparison_invoked) mismatch.push({ mismatch_type: 'comparison_public_surface_context_missing' });
  if (!publicSurfaceScanSafe && input.comparison_invoked) mismatch.push({ mismatch_type: 'public_comparison_surface_uninspectable', issues: publicSurfaceScanIssues });
  if (!riskSourceScanSafe && input.comparison_invoked) mismatch.push({ mismatch_type: 'comparison_risk_source_uninspectable', warnings: riskSourceCollection.scanWarnings });
  if (duplicateDetectionBlocker && input.comparison_invoked) mismatch.push({ mismatch_type: duplicateDetectionBlocker, duplicate_detection_status: duplicateDetectionStatus ?? 'missing' });
  if (!comparisonRiskContextAvailable && input.comparison_invoked && !failedRiskOrLeakDetected) mismatch.push({
    mismatch_type: 'comparison_risk_context_missing',
    missing_contexts: [
      ...(!sameVideoRiskContextAvailable ? ['same_video'] : []),
      ...(!routeVarianceRiskContextAvailable ? ['route_variance'] : []),
      ...(!forcedFalseWinnerRiskContextAvailable ? ['forced_false_winner'] : []),
      ...(!duplicateDetectionContextAvailable ? ['duplicate_detection'] : []),
    ],
  });
  if (!forbiddenPublicComparisonFieldsAbsent) {
    for (const hit of forbiddenHits) {
      mismatch.push({ mismatch_type: 'forbidden_public_comparison_field_present', surface: hit.surface, field: hit.field, path: hit.path });
    }
  }
  if (!forcedWinnerRiskAbsent) mismatch.push({ mismatch_type: 'forced_winner_risk_detected', source_trace_keys: sourceKeysForRiskHits((hit) => hit.field === 'forced_winner_risk' && riskHitValueIs(hit, true)) });
  if (!falseWinnerRiskAbsent) mismatch.push({ mismatch_type: 'false_winner_risk_detected', source_trace_keys: sourceKeysForRiskHits((hit) => hit.field === 'false_winner_risk' && riskHitValueIs(hit, true)) });
  if (!routeVarianceRiskAbsent) mismatch.push({ mismatch_type: 'route_variance_unresolved', source_trace_keys: sourceKeysForRiskHits((hit) => (
    (hit.field === 'route_variance_risk' && riskHitValueIs(hit, true))
    || (hit.field === 'route_variance_mitigation_status' && riskHitValueIs(hit, 'unresolved_blocked'))
    || (hit.field === 'route_mismatch_detected' && riskHitValueIs(hit, true))
    || (hit.field === 'route_variance_detected' && riskHitValueIs(hit, true))
  )) });
  if (!sameVideoRiskAbsent) mismatch.push({ mismatch_type: 'same_video_unresolved_risk', source_trace_keys: sourceKeysForRiskHits((hit) => (
    (hit.field === 'same_video_unresolved_risk' && riskHitValueIs(hit, true))
    || (hit.field === 'same_video_detected' && riskHitValueIs(hit, true))
    || (hit.field === 'repeated_input_detected' && riskHitValueIs(hit, true))
    || (hit.field === 'no_material_difference' && riskHitValueIs(hit, false))
  )) });
  const parityStatus = !input.comparison_invoked
    ? 'not_applicable'
    : (
      failedRiskOrLeakDetected
        ? 'failed'
        : (!requiredOk || !comparisonPayloadsAvailable || !publicSurfaceContextAvailable || !publicSurfaceScanSafe || !riskSourceScanSafe || !comparisonRiskContextAvailable || duplicateDetectionInsufficient ? 'insufficient' : 'passed')
    );
  const blocker_codes = (parityStatus === 'passed' || parityStatus === 'not_applicable') ? [] : ['parity_artefacts_missing'];
  if (!input.comparison_invoked) return { written: false as const, emitted_artefact_ids: [] as string[], parity_status: 'not_applicable' as const, blocker_codes };
  const outPayload = {
    schema_version: 'tapecoach_v3_comparison_parity_v1', artefact_type: 'comparison_parity', run_id: input.run_id, analysis_run_id: analysisRunId, comparison_run_id: input.comparison_run_id ?? null, compared_take_ids: input.compared_take_ids ?? [], generated_at: new Date().toISOString(), internal_only: true, privacy_classification: 'internal_private', comparison_invoked: input.comparison_invoked, parity_status: parityStatus, public_output_unchanged: publicSurfaceContextAvailable, public_comparison_output_absent_or_unchanged: hasPublicOutputAbsenceEvidence || publicSurfaces.length > 0, comparison_public_output_absent: payloadsObject?.comparison_public_output_absent === true,
    comparison_raw_available: Boolean(evidence.comparison_raw), comparison_report_internal_available: Boolean(evidence.comparison_report_internal), same_video_repeatability_trace_available: Boolean(evidence.same_video_repeatability_trace), duplicate_detection_trace_available: Boolean(evidence.duplicate_detection_trace), comparison_suppression_trace_available: Boolean(evidence.comparison_suppression_trace), route_variance_trace_available: Boolean(evidence.route_variance_trace), duplicate_detection_status: duplicateDetectionStatus ?? 'missing', duplicate_detection_context_available: duplicateDetectionContextAvailable, duplicate_detection_blocker: duplicateDetectionBlocker, duplicate_detection_suppression_applied: duplicateSuppressionApplied, duplicate_detection_evidence_delta_decisive: decisiveEvidenceDelta, comparison_payloads_available: comparisonPayloadsAvailable, public_surface_context_available: publicSurfaceContextAvailable, public_output_absence_or_unchanged_evidence_available: hasPublicOutputAbsenceEvidence, public_surface_scan_safe: publicSurfaceScanSafe, public_surface_scan_issues: publicSurfaceScanIssues, risk_source_scan_safe: riskSourceScanSafe, risk_source_scan_warnings: riskSourceCollection.scanWarnings, comparison_risk_context_available: comparisonRiskContextAvailable, same_video_risk_context_available: sameVideoRiskContextAvailable, route_variance_risk_context_available: routeVarianceRiskContextAvailable, forced_false_winner_risk_context_available: forcedFalseWinnerRiskContextAvailable, false_winner_risk_absent: falseWinnerRiskAbsent, forced_winner_risk_absent: forcedWinnerRiskAbsent, public_winner_absent: publicWinnerAbsent, public_recommendation_absent: publicRecommendationAbsent, forbidden_public_comparison_fields_absent: forbiddenPublicComparisonFieldsAbsent, checked_comparison_surfaces: publicSurfaces.map((s) => s.key), checked_risk_sources: riskSources.map((s) => s.source), risk_source_count: riskSources.length, risk_trace_fields_checked: [...COMPARISON_RISK_FIELDS], risk_trace_field_hits: riskSourceCollection.fieldHits.map(comparisonRiskFieldDiagnostic), mismatch_count: mismatch.length, mismatches: mismatch, blocker_codes, gate_satisfaction_reason: parityStatus === 'passed' ? 'comparison_parity_passed' : (parityStatus === 'failed' ? 'forbidden_public_comparison_field_present_or_duplicate_without_suppression' : (duplicateDetectionBlocker ? duplicateDetectionBlocker : (!comparisonPayloadsAvailable ? 'comparison_parity_payload_missing' : (!publicSurfaceContextAvailable ? 'comparison_public_surface_context_missing' : (!publicSurfaceScanSafe ? 'comparison_public_surface_uninspectable' : (!riskSourceScanSafe ? 'comparison_risk_source_uninspectable' : (!comparisonRiskContextAvailable ? 'comparison_risk_context_missing' : 'comparison_evidence_missing_or_unresolved'))))))), production_safe_status: 'blocked', public_scoring_status: 'blocked', public_technique_authority_status: 'blocked', level2_satisfaction: parityStatus === 'passed' ? 'satisfied' : 'insufficient', submission_id: input.submission_id ?? null, take_id: input.take_id ?? null,
  };
  if (!comparisonParityIdentityIsSafe({
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id,
  })) {
    return {
      written: false as boolean,
      emitted_artefact_ids: [] as string[],
      parity_status: 'insufficient' as const,
      blocker_codes: ['parity_artefacts_missing'],
    };
  }
  const relative = input.take_id ? `takes/take-${input.take_id}/analysis-${analysisRunId}/parity/comparison_parity.json` : 'parity/comparison_parity.json';
  const result = await writeInternalJson(root, input.run_id, relative, outPayload, 'parity_comparison');
  return { written: Boolean(result.written), emitted_artefact_ids: result.written ? ['parity_comparison'] : [], parity_status: parityStatus, blocker_codes };
}
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
  analysis_evidence_state_data?: Record<string, unknown> | null;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
type EvidenceAnchorsSupportData = {
  anchors?: Array<Record<string, unknown>>;
  evidence_anchor_gate_status?: string;
  evidence_anchor_gate_reason?: string;
  evidence_anchor_trace_summary?: Record<string, unknown>;
  evidence_anchor_source_family_summary?: Record<string, unknown>;
} & Record<string, unknown>;
export interface PublicClaimTraceEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string;
  take_id: string;
  comparison_run_id?: string | null;
  source_module: string;
  source_stage: string;
  raw_report_data?: Record<string, unknown> | null;
  claim_candidate_trace_data?: { claim_candidates?: Array<Record<string, unknown>> } | Record<string, unknown> | null;
  evidence_anchors_data?: EvidenceAnchorsSupportData | null;
  truth_state_map_data?: Record<string, unknown> | null;
  metadata_overrides?: Record<string, unknown>;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface ClaimCandidateTraceEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string;
  take_id: string;
  comparison_run_id?: string | null;
  source_module: string;
  source_stage: string;
  raw_report_data?: Record<string, unknown> | null;
  analysis_evidence_state_data?: Record<string, unknown> | null;
  evidence_anchors_data?: EvidenceAnchorsSupportData | null;
  resolver_output_data?: Record<string, unknown> | null;
  truth_state_map_data?: Record<string, unknown> | null;
  metadata_overrides?: Record<string, unknown>;
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

export interface ReportParityProofEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  submission_id?: string;
  source_module?: string;
  source_stage?: string;
  raw_report_data?: Record<string, unknown> | null;
  render_payload?: Record<string, unknown> | null;
  public_report_payload?: Record<string, unknown> | null;
  allowed_public_fields?: string[];
  blocked_field_paths?: string[];
  blocked_score_field_paths?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}

export interface RenderPayloadEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  submission_id?: string;
  source_module?: string;
  source_stage?: string;
  raw_report_data?: Record<string, unknown> | null;
  render_report_data?: Record<string, unknown> | null;
  allowed_field_paths?: string[];
  blocked_field_paths?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}

export interface PublicReportPayloadEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  submission_id?: string;
  source_module?: string;
  source_stage?: string;
  raw_report_data?: Record<string, unknown> | null;
  render_payload?: Record<string, unknown> | null;
  public_report_data?: Record<string, unknown> | null;
  allowed_field_paths?: string[];
  blocked_field_paths?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}

const INITIAL_RENDER_PAYLOAD_ALLOWED_FIELDS = [
  'report_data.schema_version',
  'report_data.submission_verdict',
  'report_data.fix_first',
  'report_data.priority_fixes',
  'report_data.strengths',
  'report_data.next_take_plan',
  'report_data.feedback_reliability',
];

const INITIAL_PUBLIC_REPORT_PAYLOAD_ALLOWED_FIELDS = INITIAL_RENDER_PAYLOAD_ALLOWED_FIELDS;

const DEFAULT_REPORT_FORBIDDEN_FIELD_PATHS = [
  'internal_qa',
  'internal_qa.*',
  'qa_private',
  'qa_private.*',
  'internal_only',
  'report_data.internal_only',
  'qa_trace',
  'qa_trace.*',
  'report_data.qa_trace',
  'report_data.qa_trace.*',
  'raw_prompt',
  'raw_prompts',
  'prompt',
  'prompts',
  'system_prompt',
  'user_prompt',
  'raw_model_response',
  'raw_model_responses',
  'raw_response',
  'raw_responses',
  'response_text',
  'model_response',
  'model_responses',
  'request',
  'request_body',
  'response',
  'response_body',
  'auth_header',
  'authorization',
  'api_key',
  'token',
  'tokens',
  'secret',
  'secrets',
  'cookie',
  'cookies',
  'session',
  'sessions',
  'signed_url',
  'signed_urls',
  'mux_url',
  'mux_urls',
  'storage_url',
  'storage_urls',
  'raw_url',
  'raw_urls',
  'score',
  'scores',
  'overall_score',
  'overall_score_final',
  'overall_score_model',
  'overall_readiness',
  'overall_readiness_score',
  'readiness_score',
  'score_trace',
  'score_trace.*',
  'public_score',
  'public_scoring',
  'technique_authority',
  'technique_authority.*',
  'public_technique_authority',
  'public_technique_authority.*',
  'technique_observation_trace',
  'technique_observation_trace.*',
  'castability',
  'bookability',
  'marketability',
  'casting_headline',
  'casting_insight',
  'comparison',
  'comparison.*',
  'comparison_raw',
  'comparison_raw.*',
  'comparison_report_internal',
  'comparison_report_internal.*',
  'selected_take_id',
  'selected_winner',
  'winner',
  'recommendation',
  'report_data.internal_qa',
  'report_data.internal_qa.*',
  'report_data.qa_private',
  'report_data.qa_private.*',
  'report_data.raw_prompt',
  'report_data.raw_prompts',
  'report_data.prompt',
  'report_data.prompts',
  'report_data.system_prompt',
  'report_data.user_prompt',
  'report_data.raw_model_response',
  'report_data.raw_model_responses',
  'report_data.raw_response',
  'report_data.raw_responses',
  'report_data.response_text',
  'report_data.model_response',
  'report_data.model_responses',
  'report_data.request',
  'report_data.request_body',
  'report_data.response',
  'report_data.response_body',
  'report_data.auth_header',
  'report_data.authorization',
  'report_data.api_key',
  'report_data.token',
  'report_data.tokens',
  'report_data.secret',
  'report_data.secrets',
  'report_data.cookie',
  'report_data.cookies',
  'report_data.session',
  'report_data.sessions',
  'report_data.signed_url',
  'report_data.signed_urls',
  'report_data.mux_url',
  'report_data.mux_urls',
  'report_data.storage_url',
  'report_data.storage_urls',
  'report_data.raw_url',
  'report_data.raw_urls',
  'report_data.score',
  'report_data.score.*',
  'report_data.scores',
  'report_data.scores.*',
  'report_data.overall_score',
  'report_data.overall_score_final',
  'report_data.overall_score_model',
  'report_data.overall_readiness',
  'report_data.overall_readiness_score',
  'report_data.readiness_score',
  'report_data.score_trace',
  'report_data.score_trace.*',
  'report_data.public_score',
  'report_data.public_scoring',
  'report_data.technique_authority',
  'report_data.technique_authority.*',
  'report_data.public_technique_authority',
  'report_data.public_technique_authority.*',
  'report_data.technique_observation_trace',
  'report_data.technique_observation_trace.*',
  'report_data.castability',
  'report_data.bookability',
  'report_data.marketability',
  'report_data.casting_headline',
  'report_data.casting_insight',
  'report_data.comparison',
  'report_data.comparison.*',
  'report_data.comparison_raw',
  'report_data.comparison_raw.*',
  'report_data.comparison_report_internal',
  'report_data.comparison_report_internal.*',
  'report_data.selected_take_id',
  'report_data.selected_winner',
  'report_data.winner',
  'report_data.recommendation',
];

function diagnosticValueSummary(value: unknown): Record<string, unknown> {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) return { type: 'array', item_count: value.length };
  if (typeof value === 'string') return { type: 'string', length: value.length };
  if (typeof value === 'number') return { type: 'number', finite: Number.isFinite(value) };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (typeof value === 'object' && value) return { type: 'object', key_count: Object.keys(value as Record<string, unknown>).length };
  return { type: typeof value };
}

function isUnsafeRenderString(value: string): boolean {
  const text = value.toLowerCase();
  return /https?:\/\//i.test(value)
    && (
      text.includes('signature=')
      || text.includes('token=')
      || text.includes('x-amz-')
      || text.includes('mux.com')
      || text.includes('storage')
      || text.includes('supabase')
    );
}

function cloneRenderSafeValue(value: unknown, seen: WeakSet<object> = new WeakSet()): { safe: boolean; value?: unknown; reason?: string } {
  if (value === undefined) return { safe: false, reason: 'undefined_value_omitted' };
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return { safe: true, value };
  if (typeof value === 'string') {
    if (isUnsafeRenderString(value)) return { safe: false, reason: 'unsafe_url_or_token_like_string_redacted' };
    return { safe: true, value };
  }
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') return { safe: false, reason: 'non_json_value_omitted' };
  if (!value || typeof value !== 'object') return { safe: false, reason: 'unsupported_value_omitted' };
  if (seen.has(value as object)) return { safe: false, reason: 'circular_value_omitted' };
  seen.add(value as object);
  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    for (const item of value) {
      const cloned = cloneRenderSafeValue(item, seen);
      if (cloned.safe) arr.push(cloned.value);
    }
    seen.delete(value as object);
    return { safe: true, value: arr };
  }
  if (!isPlainRecord(value)) {
    seen.delete(value as object);
    return { safe: false, reason: 'non_plain_object_omitted' };
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const cloned = cloneRenderSafeValue(child, seen);
    if (cloned.safe) out[key] = cloned.value;
  }
  seen.delete(value as object);
  return { safe: true, value: out };
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown): boolean {
  const tokens = tokenizePath(path);
  if (!tokens) return false;
  let current: unknown = target;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];
    if (i === tokens.length - 1) {
      if (typeof token === 'number') {
        if (!Array.isArray(current)) return false;
        current[token] = value;
      } else {
        if (!isPlainRecord(current)) return false;
        current[token] = value;
      }
      return true;
    }
    if (typeof token === 'number') {
      if (!Array.isArray(current)) return false;
      const existing = current[token];
      if (typeof nextToken === 'number') {
        if (!Array.isArray(existing)) current[token] = [];
      } else if (!isPlainRecord(existing)) {
        current[token] = {};
      }
      current = current[token];
      continue;
    }
    if (!isPlainRecord(current)) return false;
    const existing = current[token];
    if (typeof nextToken === 'number') {
      if (!Array.isArray(existing)) current[token] = [];
    } else if (!isPlainRecord(existing)) {
      current[token] = {};
    }
    current = current[token];
  }
  return false;
}

function collectCandidatePaths(value: unknown, pathPrefix = ''): string[] {
  const out: string[] = [];
  const active = new WeakSet<object>();
  const walk = (node: unknown, currentPath: string) => {
    if (!node || typeof node !== 'object') return;
    if (active.has(node as object)) return;
    active.add(node as object);
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        const next = `${currentPath}[${index}]`;
        out.push(next);
        walk(item, next);
      });
      active.delete(node as object);
      return;
    }
    if (!isPlainRecord(node)) {
      active.delete(node as object);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const next = currentPath ? `${currentPath}.${key}` : key;
      out.push(next);
      walk(child, next);
    }
    active.delete(node as object);
  };
  walk(value, pathPrefix);
  return out;
}

function collectBlockedFieldHits(surface: unknown, blockedPaths: string[]): Array<{ path: string; matched_blocked_path: string; value_summary: Record<string, unknown> }> {
  const hits: Array<{ path: string; matched_blocked_path: string; value_summary: Record<string, unknown> }> = [];
  const seen = new Set<string>();
  for (const candidate of collectCandidatePaths(surface)) {
    const blockedPath = blockedPaths.find((path) => matchesBlockedPath(candidate, path));
    if (!blockedPath || seen.has(candidate)) continue;
    seen.add(candidate);
    hits.push({
      path: candidate,
      matched_blocked_path: blockedPath,
      value_summary: diagnosticValueSummary(getPathValue(surface, candidate).value),
    });
  }
  return hits;
}

function tokenizePath(path: string): Array<string | number> | null {
  const tokens: Array<string | number> = [];
  let i = 0;
  const n = path.length;
  while (i < n) {
    const ch = path[i];
    if (ch === '.') {
      i += 1;
      continue;
    }
    if (ch === '[') {
      const end = path.indexOf(']', i + 1);
      if (end === -1) return null;
      const indexRaw = path.slice(i + 1, end).trim();
      if (!/^\d+$/.test(indexRaw)) return null;
      const index = Number(indexRaw);
      if (!Number.isInteger(index) || index < 0) return null;
      tokens.push(index);
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < n && path[j] !== '.' && path[j] !== '[' && path[j] !== ']') j += 1;
    const segment = path.slice(i, j).trim();
    if (!segment) return null;
    tokens.push(segment);
    i = j;
  }
  return tokens.length > 0 ? tokens : null;
}

function getPathValue(obj: unknown, path: unknown): { present: boolean; value: unknown } {
  if (!obj || typeof obj !== 'object') return { present: false, value: undefined };
  if (typeof path !== 'string') return { present: false, value: undefined };
  const trimmedPath = path.trim();
  if (!trimmedPath) return { present: false, value: undefined };
  const tokens = tokenizePath(trimmedPath);
  if (!tokens) return { present: false, value: undefined };
  let cur: any = obj;
  for (const token of tokens) {
    if (typeof token === 'number') {
      if (!Array.isArray(cur) || token < 0 || token >= cur.length) return { present: false, value: undefined };
      cur = cur[token];
      continue;
    }
    if (!cur || typeof cur !== 'object' || !(token in cur)) return { present: false, value: undefined };
    cur = cur[token];
  }
  return { present: true, value: cur };
}

function normaliseParityPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (!tokenizePath(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function toStableJson(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  const type = typeof value;
  if (value === undefined) return '"__undefined__"';
  if (value === null) return 'null';
  if (type === 'string') return JSON.stringify(value);
  if (type === 'number') return Number.isFinite(value as number) ? String(value) : '"__non_finite_number__"';
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'bigint') return `"__bigint__:${String(value)}"`;
  if (type === 'symbol') return `"__symbol__:${String((value as symbol).description ?? '')}"`;
  if (type === 'function') return `"__function__:${String((value as Function).name || 'anonymous')}"`;
  if (type !== 'object') return `"__unknown_type__:${type}"`;
  const obj = value as object;
  if (seen.has(obj)) return '"__circular__"';
  seen.add(obj);
  if (Array.isArray(value)) {
    const arr = `[${value.map((item) => toStableJson(item, seen)).join(',')}]`;
    seen.delete(obj);
    return arr;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const stableObj = `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${toStableJson(v, seen)}`).join(',')}}`;
  seen.delete(obj);
  return stableObj;
}

function valuesDeepEqual(a: unknown, b: unknown, seenPairs: WeakMap<object, WeakSet<object>> = new WeakMap()): boolean {
  if (Object.is(a, b)) return true;

  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) return false;

  if (a === null || b === null) return false;

  if (typeA === 'bigint') return (a as bigint) === (b as bigint);
  if (typeA === 'symbol' || typeA === 'function') return false;

  if (typeA !== 'object') return false;

  const objA = a as object;
  const objB = b as object;
  const seenForA = seenPairs.get(objA);
  if (seenForA?.has(objB)) return true;
  if (seenForA) {
    seenForA.add(objB);
  } else {
    seenPairs.set(objA, new WeakSet([objB]));
  }

  const arrA = Array.isArray(a);
  const arrB = Array.isArray(b);
  if (arrA !== arrB) return false;

  if (arrA && arrB) {
    const aItems = a as unknown[];
    const bItems = b as unknown[];
    if (aItems.length !== bItems.length) return false;
    for (let i = 0; i < aItems.length; i += 1) {
      if (!valuesDeepEqual(aItems[i], bItems[i], seenPairs)) return false;
    }
    return true;
  }

  const recA = a as Record<string, unknown>;
  const recB = b as Record<string, unknown>;
  const keysA = Object.keys(recA).sort();
  const keysB = Object.keys(recB).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return false;
    if (!valuesDeepEqual(recA[keysA[i]], recB[keysA[i]], seenPairs)) return false;
  }
  return true;
}

function summariseValueForParity(value: unknown): Record<string, unknown> {
  const stable = toStableJson(value);
  const type = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);
  const hash = createHash('sha256').update(`${type}:${stable}`).digest('hex');
  return { type, stable_hash_sha256: hash, length: stable.length };
}


function normaliseBlockedPath(path: string): string {
  return String(path).trim().toLowerCase();
}

function normaliseIndexedPath(path: string): string {
  return normaliseBlockedPath(path).replace(/\[\d+\]/g, '');
}

function normaliseIndexedWildcardPath(path: string): string {
  return normaliseBlockedPath(path).replace(/\[\d+\]/g, '[]');
}

function pathStringSegments(path: string): string[] {
  const tokens = tokenizePath(path);
  if (!tokens) return [];
  return tokens
    .filter((token): token is string => typeof token === 'string')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

const defaultBlockedScoreFieldPaths = [
  'score','scores','overall_score','overall_score_final','overall_readiness','overall_readiness_score','readiness_score','score_value','score_entries','category_scores','discipline_scores','attribute_scores','public_score','public_scores','report_data.overall_score','report_data.overall_score_final','report_data.overall_score_model','report_data.overall_score_model.*','report_data.overall_readiness','report_data.overall_readiness_score','report_data.overall_readiness_score.*','report_data.readiness_score','report_data.readiness_score.*','report_data.scores','report_data.scores.*','report_data.score','report_data.score.*','report_data.score_summary','report_data.score_summary.*','report_data.score_breakdown','report_data.score_breakdown.*','report_data.category_scores','report_data.category_scores.*','report_data.discipline_scores','report_data.discipline_scores.*','report_data.attribute_scores','report_data.attribute_scores.*','report_data.score_entries','report_data.score_value','report_data.public_score','report_data.public_scores','report_data.public_scores.*'
];


function matchesBlockedPath(fieldPath: string, blockedPath: string): boolean {
  const field = normaliseBlockedPath(fieldPath);
  const fieldIndexless = normaliseIndexedPath(fieldPath);
  const fieldIndexedWildcard = normaliseIndexedWildcardPath(fieldPath);
  const blocked = normaliseBlockedPath(blockedPath);
  if (!field || !blocked) return false;
  if (!blocked.includes('.') && !blocked.includes('[') && !blocked.endsWith('.*')) {
    return pathStringSegments(fieldPath).includes(blocked);
  }
  if (blocked.endsWith('.*')) {
    const base = blocked.slice(0, -2);
    const baseIndexless = normaliseIndexedPath(base);
    const baseIndexedWildcard = normaliseIndexedWildcardPath(base);
    return (
      field === base || field.startsWith(`${base}.`) || field.startsWith(`${base}[`)
      || fieldIndexless === baseIndexless || fieldIndexless.startsWith(`${baseIndexless}.`)
      || fieldIndexedWildcard === baseIndexedWildcard || fieldIndexedWildcard.startsWith(`${baseIndexedWildcard}.`)
    );
  }
  const blockedIndexless = normaliseIndexedPath(blocked);
  const blockedIndexedWildcard = normaliseIndexedWildcardPath(blocked);
  return (
    field === blocked || field.startsWith(`${blocked}.`) || field.startsWith(`${blocked}[`)
    || fieldIndexless === blockedIndexless || fieldIndexless.startsWith(`${blockedIndexless}.`)
    || fieldIndexedWildcard === blockedIndexedWildcard || fieldIndexedWildcard.startsWith(`${blockedIndexedWildcard}.`)
  );
}

function isBlockedScoreFieldPath(path: string, blockedScorePaths?: string[]): boolean {
  const allBlockedPaths = [...defaultBlockedScoreFieldPaths, ...(blockedScorePaths ?? [])];
  return allBlockedPaths.some((blockedPath) => matchesBlockedPath(path, blockedPath));
}

function collectSurfacePathSet(surface: unknown): Set<string> {
  return new Set(collectCandidatePaths(surface));
}

function isSafeTakeIdSegment(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (!trimmed) return false;
  if (trimmed === '.') return false;
  if (/[\\/]/.test(trimmed)) return false;
  if (trimmed.includes('..')) return false;
  if (trimmed.startsWith('take-')) return false;
  return true;
}

export async function emitReportParityProof(input: ReportParityProofEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const raw = input.raw_report_data ?? null;
  const render = input.render_payload ?? null;
  const publicPayload = input.public_report_payload ?? null;
  const rawAvail = Boolean(raw && typeof raw === 'object');
  const renderAvail = Boolean(render && typeof render === 'object');
  const publicAvail = Boolean(publicPayload && typeof publicPayload === 'object');
  const allowedFieldsInput = input.allowed_public_fields;
  const checked = normaliseParityPathList(allowedFieldsInput);
  const allowedInputCount = Array.isArray(allowedFieldsInput) ? allowedFieldsInput.length : 0;
  const invalidAllowedPublicFieldCount = Array.isArray(allowedFieldsInput)
    ? allowedFieldsInput.filter((entry) => typeof entry !== 'string').length
    : 0;
  const droppedAllowedPublicFieldCount = Math.max(0, allowedInputCount - checked.length);
  const blocked = [...new Set([...DEFAULT_REPORT_FORBIDDEN_FIELD_PATHS, ...defaultBlockedScoreFieldPaths, ...normaliseParityPathList(input.blocked_field_paths)])];
  const blockedScorePaths = normaliseParityPathList(input.blocked_score_field_paths);
  const checkedSurfaces = [
    ...(renderAvail ? [{ name: 'render_payload' as const, value: render }] : []),
    ...(publicAvail ? [{ name: 'public_report_payload' as const, value: publicPayload }] : []),
  ];
  const checkedSurfaceNames = checkedSurfaces.map((s) => s.name);
  const mismatches: Array<Record<string, unknown>> = [];

  if (rawAvail) {
    for (const field of checked) {
      const rawField = getPathValue(raw, field);
      for (const surface of checkedSurfaces) {
        const surfaceField = getPathValue(surface.value, field);
        if (rawField.present !== surfaceField.present) {
          mismatches.push({ field, surface: surface.name, mismatch_type: 'presence_mismatch', raw_present: rawField.present, surface_present: surfaceField.present });
          continue;
        }
        if (rawField.present && surfaceField.present && !valuesDeepEqual(rawField.value, surfaceField.value)) {
          mismatches.push({
            field,
            surface: surface.name,
            mismatch_type: 'value_mismatch',
            value_diagnostic: {
              raw_value_summary: summariseValueForParity(rawField.value),
              surface_value_summary: summariseValueForParity(surfaceField.value),
            },
          });
        }
      }
    }
  }

  const forbiddenFindings: Array<Record<string, unknown>> = [];
  const checkSurface = (surfaceName: 'render_payload'|'public_report_payload', surface: unknown) => {
    const foundPaths = new Set<string>();
    const candidates = new Set<string>();
    const visited = new WeakSet<object>();
    const collectPaths = (value: unknown, currentPath = '') => {
      if (!value || typeof value !== 'object') return;
      const obj = value as object;
      if (visited.has(obj)) return;
      visited.add(obj);
      if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          const next = `${currentPath}[${idx}]`;
          candidates.add(next);
          collectPaths(item, next);
        });
        return;
      }
      for (const key of Object.keys(value as Record<string, unknown>)) {
        const next = currentPath ? `${currentPath}.${key}` : key;
        candidates.add(next);
        collectPaths((value as Record<string, unknown>)[key], next);
      }
    };
    collectPaths(surface);
    for (const candidate of candidates) {
      const blockedMatch = blocked.find((blockedPath) => matchesBlockedPath(candidate, blockedPath));
      if (!blockedMatch) continue;
      const label = candidate === blockedMatch ? blockedMatch : candidate;
      if (foundPaths.has(label)) continue;
      foundPaths.add(label);
      const found = getPathValue(surface, candidate.replace(/\[(\d+)\]/g, '.$1'));
      forbiddenFindings.push({ field: label, mismatch_type: 'forbidden_field_present', surface: surfaceName, value_summary: summariseValueForParity(found.value) });
    }
  };
  for (const surface of checkedSurfaces) checkSurface(surface.name, surface.value);
  mismatches.push(...forbiddenFindings);

  if (renderAvail && publicAvail) {
    const renderPaths = collectSurfacePathSet(render);
    const publicPaths = collectCandidatePaths(publicPayload);
    const reportedExtraPaths = new Set<string>();
    for (const publicPath of publicPaths) {
      if (renderPaths.has(publicPath) || reportedExtraPaths.has(publicPath)) continue;
      reportedExtraPaths.add(publicPath);
      mismatches.push({
        field: publicPath,
        surface: 'public_report_payload',
        mismatch_type: 'public_report_payload_extra_path',
        detail: 'public_report_payload_path_not_present_in_render_payload',
      });
    }
  }

  const forbiddenAbsent = forbiddenFindings.length === 0;
  const hasAllowedFields = checked.length > 0;
  const requiredSurfacesAvailable = rawAvail && renderAvail && publicAvail;
  const parityStatus =
    forbiddenFindings.length > 0
      ? 'failed'
      : (mismatches.length > 0
        ? 'failed'
        : (!hasAllowedFields || !requiredSurfacesAvailable ? 'insufficient' : 'passed'));
  const blocker_codes = parityStatus === 'passed' ? [] : ['parity_artefacts_missing'];
  if (!rawAvail) mismatches.push({ mismatch_type: 'raw_report_data_missing', detail: 'raw_report_data_required_for_report_parity' });
  if (!renderAvail) mismatches.push({ mismatch_type: 'render_payload_missing', detail: 'render_payload_required_for_report_parity' });
  if (!publicAvail) mismatches.push({ mismatch_type: 'public_report_payload_missing', detail: 'public_report_payload_required_for_report_parity' });
  if (!hasAllowedFields) mismatches.push({ mismatch_type: 'allowed_public_fields_missing', detail: 'no_allowed_public_fields_configured' });
  const payload = {
    schema_version: 'tapecoach_v3_report_parity_result_v1',
    artefact_type: 'report_parity_result',
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: 'internal_private',
    parity_status: parityStatus,
    public_output_unchanged: true,
    raw_report_available: rawAvail,
    render_payload_available: renderAvail,
    public_report_payload_available: publicAvail,
    checked_surfaces: checkedSurfaceNames,
    checked_public_fields: checked,
    blocked_internal_fields_absent: forbiddenAbsent,
    forbidden_fields_absent: forbiddenAbsent,
    blocked_score_fields_absent: !forbiddenFindings.some((finding)=>isBlockedScoreFieldPath(String(finding.field), blockedScorePaths)),
    blocked_comparison_fields_absent: !forbiddenFindings.some((p)=>/comparison|winner|recommendation/i.test(String(p.field))),
    blocked_technique_authority_fields_absent: !forbiddenFindings.some((p)=>['technique_authority', 'public_technique_authority', 'report_data.technique_authority', 'report_data.public_technique_authority'].some((blockedPath) => matchesBlockedPath(String(p.field), blockedPath))),
    unsafe_castability_or_marketability_fields_absent: !forbiddenFindings.some((p)=>/castability|bookability|marketability/i.test(String(p.field))),
    render_payload_checked: checkedSurfaceNames.includes('render_payload'),
    public_report_payload_checked: checkedSurfaceNames.includes('public_report_payload'),
    public_output_permissions_checked: checkedSurfaceNames.includes('public_report_payload'),
    report_output_enforcement_checked: checkedSurfaces.length > 0,
    mismatch_count: mismatches.length,
    invalid_allowed_public_field_count: invalidAllowedPublicFieldCount,
    dropped_allowed_public_field_count: droppedAllowedPublicFieldCount,
    mismatches,
    blocker_codes,
    gate_satisfaction_reason: parityStatus === 'passed'
      ? 'public_and_render_payloads_match_checked_surface'
      : (!hasAllowedFields
        ? 'allowed_public_fields_missing'
        : (!requiredSurfacesAvailable
          ? 'required_report_parity_surface_missing'
          : 'report_parity_mismatch_or_forbidden_field_detected')),
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    level2_satisfaction: parityStatus === 'passed' ? 'satisfied' : 'insufficient',
    source_module: input.source_module ?? 'qa-artifacts-wiring.server',
    source_stage: input.source_stage ?? 'emitReportParityProof',
    submission_id: input.submission_id ?? null,
    take_id: input.take_id ?? null,
  };
  const takeId = input.take_id ?? null;
  if (takeId !== null) {
    try { assertSafeSegment(takeId, 'take_id'); } catch {
      return { written: false as boolean, emitted_artefact_ids: [] as string[], parity_status: 'insufficient' as const, blocker_codes: ['parity_artefacts_missing'] };
    }
    if (!isSafeTakeIdSegment(takeId)) {
      return { written: false as boolean, emitted_artefact_ids: [] as string[], parity_status: 'insufficient' as const, blocker_codes: ['parity_artefacts_missing'] };
    }
  }
  const relative = takeId ? `takes/take-${takeId}/analysis-${analysisRunId}/parity/report_parity_result.json` : 'parity/report_parity_result.json';
  const result = await writeInternalJson(root, input.run_id, relative, payload, 'parity_report');
  return { written: result.written as boolean, emitted_artefact_ids: result.written ? ['parity_report'] : [], parity_status: parityStatus as 'passed'|'failed'|'insufficient', blocker_codes };
}

export interface ComparisonRuntimeArtifactsInput { run_id: string; analysis_run_id?: string; take_id?: string | null; comparison_run_id?: string; comparison_id?: string; compared_take_ids?: string[]; comparison_raw_data?: Record<string, unknown>; suppression_trace?: Record<string, unknown>; same_video_repeatability_trace?: Record<string, unknown>; duplicate_detection_trace?: Record<string, unknown>; route_variance_trace?: Record<string, unknown>; media_identity_payloads?: MediaIdentityPayload[]; root_dir?: string; internal_qa_emit?: boolean; source_module?: string; source_stage?: string; }
export interface InternalComparisonTakeInput {
  take_id: string;
  analysis_run_id: string;
  analysis_route?: string | null;
  model_provider_family?: string | null;
  mux_playback_ref?: string | null;
  mux_asset_or_upload_id_present?: boolean | null;
  safe_mux_playback_ref?: string | null;
  safe_media_fingerprint?: string | null;
  user_id?: string | null;
  profile_id?: string | null;
  audition_id?: string | null;
  submission_id?: string | null;
  original_upload_file_hash?: string | null;
  original_upload_file_hash_source_stage?: string | null;
  visible_or_original_file_name?: string | null;
  original_file_name?: string | null;
  file_name?: string | null;
  filename?: string | null;
  metadata_file_name?: string | null;
  file_size_bytes?: number | string | null;
  mime_type_safe_summary?: string | null;
  last_modified_ms?: number | string | null;
  upload_metadata_source?: string | null;
  upload_identity_capture_status?: string | null;
  upload_identity_capture_reason?: string | null;
  upload_identity_merge_status?: string | null;
  video_duration_ms?: number | string | null;
  duration_ms?: number | string | null;
  video_duration_seconds?: number | string | null;
  duration_seconds?: number | string | null;
  opening_video_sample_hash_or_profile?: string | null;
  closing_video_sample_hash_or_profile?: string | null;
  opening_audio_profile_hash?: string | null;
  closing_audio_profile_hash?: string | null;
  operator_same_video_assertion?: boolean | null;
  upload_identity_metadata?: Record<string, unknown> | null;
  media_identity?: MediaIdentityPayload | null;
  artefact_summaries?: Record<string, unknown>;
}
export interface InternalComparisonRuntimeSourceInput {
  run_id: string;
  root_take_id: string;
  root_analysis_run_id?: string;
  compared_takes: InternalComparisonTakeInput[];
  manifest_reconciliation_mode?: 'none' | 'required';
  comparison_run_id?: string;
  operator_same_video_assertion?: boolean;
  source_module: string;
  source_stage: string;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface InternalComparisonOperatorTriggerInput {
  root_take_id: string;
  compared_take_ids: readonly string[];
  compared_analysis_run_ids?: readonly string[];
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
  emitted_blocked_artefact_ids?: string[];
  comparison_parity_status?: ComparisonParityStatus;
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
    duplicate_detection_trace: 'comparison/duplicate_detection_trace.json';
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
  const takeCore = stripRepeatedTakePrefixes(takeIdRaw);
  const comparedTakeCores = normaliseUniqueTakeCores(compared);
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
      duplicate_detection_trace: 'comparison/duplicate_detection_trace.json',
      comparison_suppression_trace: 'comparison_traces/comparison_suppression_trace.json',
      route_variance_trace: 'comparison_traces/route_variance_trace.json',
    },
    canonical_manifest_storage_key: '',
    canonical_metrics_storage_key: '',
    canonical_comparison_root: '',
    identity_status: 'comparison_reconciliation_manifest_identity_mismatch',
    blocker_code: 'comparison_reconciliation_manifest_identity_mismatch',
  });
  if (!takeCore) return safeMismatch();
  try { assertSafeSegment(takeCore, 'take_id'); } catch { return safeMismatch(); }
  if (compared.length > 0 && !comparedTakeCores.includes(takeCore)) return safeMismatch();
  const takeRunMatch = /^take-(.+)$/.exec(sourceRunId);
  if (takeRunMatch && stripRepeatedTakePrefixes(takeRunMatch[1]) !== takeCore) return safeMismatch();
  if (sourceRunId && !takeRunMatch && sourceRunId !== `take-${takeCore}` && !isUuidLike(sourceRunId)) {
    try { assertSafeSegment(sourceRunId, 'run_id'); } catch { return safeMismatch(); }
  }
  const canonicalQaRunId = `take-${takeCore}`;
  const canonicalAnalysisRunId = canonicalQaRunId;
  const analysisInput = (input.analysis_run_id ?? '').trim();
  if (analysisInput && analysisInput !== canonicalAnalysisRunId) return safeMismatch();
  const canonicalComparisonRoot = `takes/take-${takeCore}/analysis-${canonicalAnalysisRunId}`;
  const manifestRelativePath = 'manifest.json' as const;
  const metricsRelativePath = 'qa/acceptance_metrics.json' as const;
  return {
    source_run_id: sourceRunId,
    canonical_qa_run_id: canonicalQaRunId,
    canonical_take_id: takeCore,
    canonical_analysis_run_id: canonicalAnalysisRunId,
    manifest_relative_path: manifestRelativePath,
    metrics_relative_path: metricsRelativePath,
    comparison_relative_paths: {
      comparison_raw: 'comparison/comparison.raw.json',
      comparison_report_internal: 'comparison/comparison.report.internal.json',
      same_video_repeatability_trace: 'comparison_traces/same_video_repeatability_trace.json',
      duplicate_detection_trace: 'comparison/duplicate_detection_trace.json',
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
  run_id: string; analysis_run_id?: string; submission_id?: string; take_id: string; compared_take_ids?: string[]; comparison_run_id?: string; source_module: string; source_stage: string; analysis_route?: string; route_or_model_marker?: string; audition_type?: string | null; selected_level?: string | null; brief_presence?: 'supplied' | 'absent' | 'unknown'; brief_presence_source?: 'audition.brief' | 'audition.extracted_brief_cached' | 'audition.brief+audition.extracted_brief_cached' | 'none_loaded' | 'unavailable' | 'not_loaded' | 'audition.brief+audition.extracted_brief_cached_empty'; material_presence?: 'supplied' | 'absent' | 'unknown'; material_presence_source?: 'loaded_runtime_field' | 'not_loaded' | 'unavailable'; mux_playback_id?: string | null; mux_asset_or_upload_id_present?: boolean | null; submission_created_at?: string | null; submission_updated_at?: string | null; take_created_at?: string | null; take_updated_at?: string | null; take_index?: number | null; take_index_source?: 'loaded_take_index' | 'computed_from_loaded_submission_takes_order' | 'unavailable'; component_or_task_declaration?: string[] | null; component_or_task_declaration_status?: 'unknown' | 'known_empty' | 'supplied'; component_or_task_declaration_source?: 'not_loaded' | 'loaded_runtime_field'; media_readiness_state?: string | null; safe_submission_refs?: string[]; safe_mux_playback_ref?: string | null; user_id?: string | null; profile_id?: string | null; audition_id?: string | null; original_upload_file_hash?: string | null; original_upload_file_hash_source_stage?: string | null; visible_or_original_file_name?: string | null; original_file_name?: string | null; file_name?: string | null; filename?: string | null; metadata_file_name?: string | null; file_size_bytes?: number | string | null; mime_type_safe_summary?: string | null; last_modified_ms?: number | string | null; upload_metadata_source?: string | null; upload_identity_capture_status?: string | null; upload_identity_capture_reason?: string | null; upload_identity_merge_status?: string | null; video_duration_ms?: number | string | null; duration_ms?: number | string | null; video_duration_seconds?: number | string | null; duration_seconds?: number | string | null; opening_video_sample_hash_or_profile?: string | null; opening_video_sample_hash?: string | null; closing_video_sample_hash_or_profile?: string | null; closing_video_sample_hash?: string | null; opening_audio_profile_hash?: string | null; closing_audio_profile_hash?: string | null; safe_media_fingerprint?: string | null; upload_identity_metadata?: Record<string, unknown> | null; unavailable_fields?: string[]; root_dir?: string; internal_qa_emit?: boolean;
}
export interface ResolverTruthStateEmitterInput extends AnalysisInputArtefactEmitterInput {}
export interface AnalysisEvidenceStateEmitterInput extends AnalysisInputArtefactEmitterInput {
  resolver_output_available?: boolean;
  truth_state_map_available?: boolean;
  media_duration_seconds?: number | null;
  duration_confidence?: 'known' | 'estimated' | 'unknown' | string | null;
  observable_evidence_items?: Array<Record<string, unknown>>;
  filtered_run_evidence_pass_step1?: Record<string, unknown> | null;
  timestamp_normalisation_warnings?: string[];
  metadata_overrides?: Record<string, unknown>;
}
type AnalysisObservableEvidenceItem = {
  evidence_item_id: string;
  evidence_modality: 'video' | 'audio' | 'material' | 'submission_context' | 'resolver_truth' | 'media_readiness' | 'unknown';
  evidence_kind: string;
  safe_evidence_summary: string;
  source_artefact_id: string;
  source_path: string;
  timestamp: string | null;
  timestamp_range: null;
  timestamp_source: string;
  component_id: string | null;
  linked_truth_state_ids: string[];
  assessability_limitations: string[];
  confidence_or_strength: string | null;
  public_display_status: 'internal_only' | 'not_public';
  blocker_codes: string[];
};
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

function safeRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => isRecord(item)) : [];
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

export async function emitRenderPayloadArtifact(input: RenderPayloadEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  }
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const source = input.render_report_data ?? input.raw_report_data ?? null;
  const sourceReportData = unwrapRawReportData(source);
  const sourceSurface = { report_data: sourceReportData };
  const allowedFieldPaths = normaliseParityPathList(input.allowed_field_paths ?? INITIAL_RENDER_PAYLOAD_ALLOWED_FIELDS);
  const blockedFieldPaths = [...new Set([...DEFAULT_REPORT_FORBIDDEN_FIELD_PATHS, ...defaultBlockedScoreFieldPaths, ...normaliseParityPathList(input.blocked_field_paths)])];
  const reportData: Record<string, unknown> = {};
  const allowedFieldStatusByPath: Record<string, Record<string, unknown>> = {};
  const deferredOrExcludedRenderFields: Array<Record<string, unknown>> = [];

  for (const path of allowedFieldPaths) {
    const sourceField = getPathValue(sourceSurface, path);
    if (!sourceField.present) {
      allowedFieldStatusByPath[path] = { status: 'unavailable', source_path: path };
      continue;
    }
    const blockedPath = blockedFieldPaths.find((candidate) => matchesBlockedPath(path, candidate));
    if (blockedPath) {
      allowedFieldStatusByPath[path] = { status: 'rendered_but_forbidden', source_path: path, matched_blocked_path: blockedPath };
      deferredOrExcludedRenderFields.push({
        field_path: path,
        classification: 'rendered_but_forbidden',
        reason: 'field_matches_forbidden_render_payload_path',
        matched_blocked_path: blockedPath,
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    const cloned = cloneRenderSafeValue(sourceField.value);
    if (!cloned.safe) {
      allowedFieldStatusByPath[path] = { status: 'redacted', source_path: path, reason: cloned.reason ?? 'unsafe_value_redacted' };
      deferredOrExcludedRenderFields.push({
        field_path: path,
        classification: 'internal_only',
        reason: cloned.reason ?? 'unsafe_value_redacted',
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    setPathValue(reportData, path.replace(/^report_data\./, ''), cloned.value);
    allowedFieldStatusByPath[path] = { status: 'rendered_allowed', source_path: path };
  }

  const sourceBlockedFieldHits = collectBlockedFieldHits(sourceSurface, blockedFieldPaths)
    .filter((hit) => !allowedFieldPaths.includes(hit.path));
  for (const hit of sourceBlockedFieldHits) {
    deferredOrExcludedRenderFields.push({
      field_path: hit.path,
      classification: 'rendered_but_deferred_for_parity',
      reason: 'source_field_excluded_from_initial_s9_17_render_payload_allow_list',
      matched_blocked_path: hit.matched_blocked_path,
      value_summary: hit.value_summary,
    });
  }

  const payloadSurface = { report_data: reportData };
  const blockedFieldHits = collectBlockedFieldHits(payloadSurface, blockedFieldPaths);
  const blockedAllowedFieldCount = Object.values(allowedFieldStatusByPath)
    .filter((entry) => entry.status === 'rendered_but_forbidden')
    .length;
  const hasAllowedContent = Object.keys(reportData).length > 0;
  const renderPayloadStatus = blockedFieldHits.length > 0 || blockedAllowedFieldCount > 0
    ? 'emitted_blocked'
    : (hasAllowedContent ? 'emitted' : 'insufficient');
  const blockerCodes = [
    ...(blockedFieldHits.length > 0 || blockedAllowedFieldCount > 0 ? ['render_payload_forbidden_field_present'] : []),
    ...(!hasAllowedContent ? ['render_payload_allowed_fields_unavailable'] : []),
  ];
  const payload = {
    schema_version: 'tapecoach_v3_render_payload_v1',
    artefact_type: 'render_payload',
    run_id: input.run_id,
    take_id: input.take_id ?? null,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: 'internal_private',
    source_stage: input.source_stage ?? 'emitRenderPayloadArtifact',
    source_module: input.source_module ?? 'src/server/v3/qa-artifacts-wiring.server.ts',
    render_payload_status: renderPayloadStatus,
    render_source_kind: input.render_report_data ? 'explicit_render_report_data' : 'raw_report_report_data_shadow',
    render_source_refs: {
      raw_report_available: Boolean(input.raw_report_data && typeof input.raw_report_data === 'object'),
      explicit_render_report_data_available: Boolean(input.render_report_data && typeof input.render_report_data === 'object'),
      source_artefact_id: input.render_report_data ? 'render_report_data_input' : 'raw_report',
      source_path: input.render_report_data ? 'render_report_data' : 'reports/raw_report.json.report_data',
    },
    report_data: reportData,
    allowed_field_paths: allowedFieldPaths,
    allowed_field_status_by_path: allowedFieldStatusByPath,
    deferred_or_excluded_render_fields: deferredOrExcludedRenderFields,
    forbidden_field_scan: {
      scanned_surface: 'report_data',
      forbidden_fields_absent: blockedFieldHits.length === 0,
      blocked_field_hit_count: blockedFieldHits.length,
      blocked_allowed_field_count: blockedAllowedFieldCount,
      source_forbidden_or_deferred_field_count: deferredOrExcludedRenderFields.length,
      scanner_match_mode: 'path_segment_exact_or_configured_wildcard',
    },
    blocked_field_hits: blockedFieldHits,
    redaction_notes: [
      'Internal QA shadow payload only.',
      'Only S9-17A allowed fields are copied into report_data.',
      'Raw prompts, model responses, secrets, signed URLs and raw media URLs are omitted or recorded as unavailable.',
    ],
    public_output_unchanged: true,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    cannot_satisfy_level2_by_itself: true,
    blocker_codes: blockerCodes,
  };

  const takeId = input.take_id ?? null;
  if (takeId !== null) {
    try { assertSafeSegment(takeId, 'take_id'); } catch {
      return { written: false as boolean, emitted_artefact_ids: [] as string[], render_payload_status: 'failed_emission' as const, parity_payload: null };
    }
    if (!isSafeTakeIdSegment(takeId)) {
      return { written: false as boolean, emitted_artefact_ids: [] as string[], render_payload_status: 'failed_emission' as const, parity_payload: null };
    }
  }
  const relative = takeId ? `takes/take-${takeId}/analysis-${analysisRunId}/reports/render_payload.json` : 'reports/render_payload.json';
  const result = await writeInternalJson(root, input.run_id, relative, payload, 'render_payload');
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ['render_payload'] : [],
    render_payload_status: renderPayloadStatus,
    blocker_codes: blockerCodes,
    parity_payload: payloadSurface,
    payload,
    path: result.path ?? result.storage_path,
    warning: result.warning ?? null,
  };
}

export async function emitPublicReportPayloadArtifact(input: PublicReportPayloadEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  }
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const renderReportData = input.render_payload ? unwrapRawReportData(input.render_payload) : {};
  const explicitPublicSource = input.public_report_data ?? null;
  const source = explicitPublicSource ?? (Object.keys(renderReportData).length > 0 ? { report_data: renderReportData } : input.raw_report_data ?? null);
  const sourceReportData = unwrapRawReportData(source);
  const sourceSurface = { report_data: sourceReportData };
  const renderSurface = { report_data: renderReportData };
  const allowedFieldPaths = normaliseParityPathList(input.allowed_field_paths ?? INITIAL_PUBLIC_REPORT_PAYLOAD_ALLOWED_FIELDS);
  const blockedFieldPaths = [...new Set([...DEFAULT_REPORT_FORBIDDEN_FIELD_PATHS, ...defaultBlockedScoreFieldPaths, ...normaliseParityPathList(input.blocked_field_paths)])];
  const reportData: Record<string, unknown> = {};
  const allowedFieldStatusByPath: Record<string, Record<string, unknown>> = {};
  const excludedFieldPaths: Array<Record<string, unknown>> = [];

  for (const path of allowedFieldPaths) {
    const sourceField = getPathValue(sourceSurface, path);
    const renderField = getPathValue(renderSurface, path);
    if (!sourceField.present) {
      allowedFieldStatusByPath[path] = { status: 'unavailable', source_path: path };
      continue;
    }
    const blockedPath = blockedFieldPaths.find((candidate) => matchesBlockedPath(path, candidate));
    if (blockedPath) {
      allowedFieldStatusByPath[path] = { status: 'blocked', source_path: path, matched_blocked_path: blockedPath };
      excludedFieldPaths.push({
        field_path: path,
        classification: 'forbidden',
        reason: 'field_matches_forbidden_public_report_payload_path',
        matched_blocked_path: blockedPath,
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    if (!renderField.present) {
      allowedFieldStatusByPath[path] = {
        status: 'blocked',
        source_path: path,
        reason: 'public_field_not_present_in_render_payload',
      };
      excludedFieldPaths.push({
        field_path: path,
        classification: 'blocked',
        reason: 'public_report_payload_must_be_subset_of_render_payload',
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    const cloned = cloneRenderSafeValue(sourceField.value);
    if (!cloned.safe) {
      allowedFieldStatusByPath[path] = { status: 'redacted', source_path: path, reason: cloned.reason ?? 'unsafe_value_redacted' };
      excludedFieldPaths.push({
        field_path: path,
        classification: 'redacted',
        reason: cloned.reason ?? 'unsafe_value_redacted',
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    setPathValue(reportData, path.replace(/^report_data\./, ''), cloned.value);
    allowedFieldStatusByPath[path] = { status: 'public_safe_allowed', source_path: path };
  }

  const sourceBlockedFieldHits = collectBlockedFieldHits(sourceSurface, blockedFieldPaths)
    .filter((hit) => !allowedFieldPaths.includes(hit.path));
  for (const hit of sourceBlockedFieldHits) {
    excludedFieldPaths.push({
      field_path: hit.path,
      classification: 'forbidden_or_internal_source_field_excluded',
      reason: 'source_field_excluded_from_public_report_payload',
      matched_blocked_path: hit.matched_blocked_path,
      value_summary: hit.value_summary,
    });
  }
  if (input.raw_report_data) {
    const rawSourceSurface = { report_data: unwrapRawReportData(input.raw_report_data) };
    const rawBlockedFieldHits = collectBlockedFieldHits(rawSourceSurface, blockedFieldPaths);
    for (const hit of rawBlockedFieldHits) {
      excludedFieldPaths.push({
        field_path: hit.path,
        classification: 'forbidden_or_internal_raw_report_field_excluded',
        reason: 'raw_report_field_excluded_from_public_report_payload',
        matched_blocked_path: hit.matched_blocked_path,
        value_summary: hit.value_summary,
      });
    }
  }

  const sourcePaths = collectCandidatePaths(sourceSurface);
  const renderPaths = collectSurfacePathSet(renderSurface);
  const allowedPathSet = new Set(allowedFieldPaths);
  const publicOnlySourcePaths = sourcePaths
    .filter((fieldPath) => !renderPaths.has(fieldPath) && !allowedPathSet.has(fieldPath));
  for (const fieldPath of publicOnlySourcePaths) {
    const sourceField = getPathValue(sourceSurface, fieldPath);
    excludedFieldPaths.push({
      field_path: fieldPath,
      classification: 'blocked',
      reason: 'source_public_field_not_present_in_render_payload',
      value_summary: diagnosticValueSummary(sourceField.value),
    });
  }

  const payloadSurface = { report_data: reportData };
  const blockedFieldHits = collectBlockedFieldHits(payloadSurface, blockedFieldPaths);
  const blockedAllowedFieldCount = Object.values(allowedFieldStatusByPath)
    .filter((entry) => entry.status === 'blocked')
    .length;
  const extraSourceFieldCount = publicOnlySourcePaths.length;
  const hasAllowedContent = Object.keys(reportData).length > 0;
  const renderSourceUnavailable = Object.keys(renderReportData).length === 0;
  const publicReportPayloadStatus = blockedFieldHits.length > 0 || blockedAllowedFieldCount > 0 || extraSourceFieldCount > 0
    ? 'emitted_blocked'
    : (hasAllowedContent ? 'emitted' : 'insufficient');
  const blockerCodes = [
    ...(blockedFieldHits.length > 0 || blockedAllowedFieldCount > 0 ? ['public_report_payload_forbidden_field_present'] : []),
    ...(extraSourceFieldCount > 0 ? ['public_report_payload_extra_path_not_in_render_payload'] : []),
    ...(!hasAllowedContent ? ['public_report_payload_allowed_fields_unavailable'] : []),
    ...(renderSourceUnavailable ? ['public_report_payload_render_source_unavailable'] : []),
  ];
  const payload = {
    schema_version: 'tapecoach_v3_public_report_payload_v1',
    artefact_type: 'public_report_payload',
    run_id: input.run_id,
    take_id: input.take_id ?? null,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: 'internal_private',
    source_stage: input.source_stage ?? 'emitPublicReportPayloadArtifact',
    source_module: input.source_module ?? 'src/server/v3/qa-artifacts-wiring.server.ts',
    public_report_payload_status: publicReportPayloadStatus,
    public_report_source_kind: explicitPublicSource ? 'explicit_public_report_data' : 'sanitised_render_payload_shadow',
    public_report_source_refs: {
      raw_report_available: Boolean(input.raw_report_data && typeof input.raw_report_data === 'object'),
      render_payload_available: Boolean(input.render_payload && typeof input.render_payload === 'object'),
      explicit_public_report_data_available: Boolean(explicitPublicSource && typeof explicitPublicSource === 'object'),
      source_artefact_id: explicitPublicSource ? 'public_report_data_input' : 'render_payload',
      source_path: explicitPublicSource ? 'public_report_data' : 'reports/render_payload.json.report_data',
    },
    report_data: reportData,
    allowed_field_paths: allowedFieldPaths,
    allowed_field_status_by_path: allowedFieldStatusByPath,
    excluded_field_paths: excludedFieldPaths,
    forbidden_field_scan: {
      scanned_surface: 'report_data',
      forbidden_fields_absent: blockedFieldHits.length === 0,
      blocked_field_hit_count: blockedFieldHits.length,
      blocked_allowed_field_count: blockedAllowedFieldCount,
      excluded_field_count: excludedFieldPaths.length,
      public_only_source_field_count: extraSourceFieldCount,
      strict_subset_of_render_payload: extraSourceFieldCount === 0,
      scanner_match_mode: 'path_segment_exact_or_configured_wildcard',
    },
    blocked_field_hits: blockedFieldHits,
    redaction_notes: [
      'Internal QA public-safe report payload proof only.',
      'Only S9-17A allowed fields are copied into report_data.',
      'The payload is constrained to a subset of the render payload and omits raw prompts, model responses, secrets, signed URLs and raw media URLs.',
    ],
    public_output_unchanged: true,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    public_comparison_output_status: 'blocked',
    cannot_satisfy_level2_by_itself: true,
    blocker_codes: blockerCodes,
  };

  const takeId = input.take_id ?? null;
  if (takeId !== null) {
    try { assertSafeSegment(takeId, 'take_id'); } catch {
      return { written: false as boolean, emitted_artefact_ids: [] as string[], public_report_payload_status: 'failed_emission' as const, parity_payload: null };
    }
    if (!isSafeTakeIdSegment(takeId)) {
      return { written: false as boolean, emitted_artefact_ids: [] as string[], public_report_payload_status: 'failed_emission' as const, parity_payload: null };
    }
  }
  const relative = takeId ? `takes/take-${takeId}/analysis-${analysisRunId}/reports/public_report_payload.json` : 'reports/public_report_payload.json';
  const result = await writeInternalJson(root, input.run_id, relative, payload, 'public_report_payload');
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ['public_report_payload'] : [],
    public_report_payload_status: publicReportPayloadStatus,
    blocker_codes: blockerCodes,
    parity_payload: payloadSurface,
    payload,
    path: result.path ?? result.storage_path,
    warning: result.warning ?? null,
  };
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
function readJsonPath(root: unknown, sourcePath: string): unknown {
  if (!sourcePath.trim()) return undefined;
  const tokens = sourcePath.match(/[^.[\]]+|\[(\d+)\]/g) ?? [];
  let current = root;
  for (const token of tokens) {
    if (token.startsWith('[') && token.endsWith(']')) {
      const index = Number(token.slice(1, -1));
      if (!Array.isArray(current) || !Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}
function hasForbiddenEvidenceSourceRef(value: unknown): boolean {
  const text = JSON.stringify(value ?? '').toLowerCase();
  return text.includes('raw_report')
    || text.includes('report_data')
    || text.includes('timestamped_notes')
    || text.includes('techniqueobservationtrace')
    || text.includes('scoretrace')
    || text.includes('publicclaimtrace');
}
function buildAnalysisEvidenceAnchor(args: {
  source: Record<string, unknown>;
  sourcePath: string;
  item: Record<string, unknown>;
  index: number;
  input: EvidenceAnchorsEmitterInput;
  analysisRunId: string;
  generatedAt: string;
}) {
  const resolved = readJsonPath(args.source, args.sourcePath);
  const sourceRunIdMatches = args.source.run_id === args.input.run_id && args.source.analysis_run_id === args.analysisRunId;
  const sourcePathResolved = resolved !== undefined;
  const itemBlockers = Array.isArray(args.item.blocker_codes) ? args.item.blocker_codes.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  const evidenceKind = typeof args.item.evidence_kind === 'string' ? args.item.evidence_kind : 'unknown_runtime_fact';
  const requiresTruthLinkage = (args.item.source_artefact_id === 'truth_state_map' || evidenceKind.includes('truth'));
  const linkedTruthStateIds = Array.isArray(args.item.linked_truth_state_ids)
    ? args.item.linked_truth_state_ids.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const structuredTruthMissing = requiresTruthLinkage && linkedTruthStateIds.length === 0;
  const forbiddenSource = hasForbiddenEvidenceSourceRef(args.item);
  const blocker_codes = dedupePreservingOrder([
    ...itemBlockers,
    ...(!sourceRunIdMatches ? ['analysis_evidence_state_identity_mismatch'] : []),
    ...(!sourcePathResolved ? ['analysis_evidence_state_source_path_unresolved'] : []),
    ...(structuredTruthMissing ? ['missing_truth_state_linkage'] : []),
    ...(forbiddenSource ? ['forbidden_report_snapshot_source_ref'] : []),
  ]);
  const cannotSatisfy = blocker_codes.length > 0;
  const evidenceText = typeof args.item.safe_evidence_summary === 'string' && args.item.safe_evidence_summary.trim()
    ? args.item.safe_evidence_summary.trim()
    : `${evidenceKind}: runtime fact recorded`;
  return {
    schema_version: 'tapecoach_v3_evidence_anchor_v1',
    artefact_type: 'evidence_anchors',
    run_id: args.input.run_id,
    analysis_run_id: args.analysisRunId,
    generated_at: args.generatedAt,
    internal_only: true,
    privacy_classification: 'internal_private',
    source_classification: cannotSatisfy ? 'real_runtime_v3_blocked' : 'real_runtime_v3',
    source_family: cannotSatisfy ? 'real_runtime_v3_blocked' : 'real_runtime_v3',
    evidence_anchor_id: `ea-${args.input.take_id}-aes-${String(args.index + 1).padStart(4, '0')}`,
    source_stage: 'analysis_step_1_evidence_mapping',
    source_artefact_id: 'analysis_evidence_state',
    source_path: args.sourcePath,
    evidence_text: evidenceText,
    safe_evidence_summary: evidenceText,
    evidence_modality: typeof args.item.evidence_modality === 'string' ? args.item.evidence_modality : 'unknown',
    timestamp: args.item.timestamp ?? null,
    timestamp_range: args.item.timestamp_range ?? null,
    timestamp_source: typeof args.item.timestamp_source === 'string' ? args.item.timestamp_source : 'not_timestamped_runtime_metadata',
    component_id: typeof args.item.component_id === 'string' ? args.item.component_id : null,
    linked_truth_state_ids: linkedTruthStateIds,
    linked_public_claim_ids: [],
    assessability_limitations: Array.isArray(args.item.assessability_limitations) ? args.item.assessability_limitations.filter((x): x is string => typeof x === 'string') : [],
    evidence_status: cannotSatisfy ? 'blocked_or_limited_runtime_fact' : 'resolved_step1_runtime_fact',
    public_safe: true,
    public_display_status: 'internal_only',
    confidence_or_strength: typeof args.item.confidence_or_strength === 'string' ? args.item.confidence_or_strength : null,
    cannot_satisfy_v3_gate: cannotSatisfy,
    blocker_codes,
  };
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

type DuplicateDetectionStatus = 'detected' | 'likely_duplicate' | 'possible_duplicate' | 'insufficient_evidence' | 'not_detected';
type Tier1SignalName =
  | 'original_upload_file_hash'
  | 'opening_video_sample_hash_or_profile'
  | 'closing_video_sample_hash_or_profile'
  | 'opening_audio_profile_hash'
  | 'closing_audio_profile_hash'
  | 'safe_media_fingerprint'
  | 'file_size_bytes'
  | 'metadata_file_name'
  | 'visible_or_original_file_name'
  | 'video_duration_ms';
type MediaIdentityStatus = 'complete' | 'partial' | 'unavailable' | 'failed';
type MediaIdentitySignalStatus = 'available' | 'unavailable' | 'redacted' | 'unsupported' | 'blocked';
type MediaIdentitySignalName =
  | 'original_upload_file_hash'
  | 'original_file_name'
  | 'metadata_file_name'
  | 'file_size_bytes'
  | 'video_duration_ms'
  | 'opening_video_sample_hash'
  | 'closing_video_sample_hash'
  | 'opening_audio_profile_hash'
  | 'closing_audio_profile_hash'
  | 'safe_media_fingerprint';
type MediaIdentitySignalEntry = {
  signal_name: MediaIdentitySignalName;
  status: MediaIdentitySignalStatus;
  value_hash?: string;
  safe_value?: string | number | boolean | null;
  raw_value_redacted: boolean;
  source_artefact_id: string;
  source_path: string;
  confidence_role: 'decisive' | 'strong' | 'medium' | 'weak' | 'diagnostic_only';
  notes: string[];
};
type MediaIdentityPayload = {
  schema_version: 'tapecoach_v3_media_identity_v1';
  artefact_type: 'media_identity';
  run_id: string;
  take_id: string;
  analysis_run_id: string;
  generated_at: string;
  internal_only: true;
  privacy_classification: 'internal_private';
  source_stage: string;
  source_module: string;
  media_identity_status: MediaIdentityStatus;
  media_identity_scope: 'same_user_same_audition';
  user_scope_status: 'same_user_only' | 'unavailable' | 'blocked';
  audition_scope_status: 'same_audition_or_submission' | 'unavailable' | 'blocked';
  available_signal_count: number;
  unavailable_signal_count: number;
  media_identity_signals: Record<MediaIdentitySignalName, MediaIdentitySignalEntry>;
  reference_diagnostics: Record<string, unknown>;
  signal_source_summary: Record<string, unknown>;
  blocker_codes: string[];
  cannot_satisfy_duplicate_detection_gate: boolean;
  public_output_unchanged: true;
  production_safe_status: 'blocked';
  public_scoring_status: 'blocked';
  public_technique_authority_status: 'blocked';
};

const TIER1_WEIGHT_BY_SIGNAL: Record<Tier1SignalName, number> = {
  original_upload_file_hash: 100,
  opening_video_sample_hash_or_profile: 20,
  closing_video_sample_hash_or_profile: 20,
  opening_audio_profile_hash: 15,
  closing_audio_profile_hash: 15,
  safe_media_fingerprint: 70,
  file_size_bytes: 10,
  metadata_file_name: 8,
  visible_or_original_file_name: 5,
  video_duration_ms: 5,
};

const STRONG_TIER1_SIGNALS = new Set<Tier1SignalName>([
  'original_upload_file_hash',
  'opening_video_sample_hash_or_profile',
  'closing_video_sample_hash_or_profile',
  'opening_audio_profile_hash',
  'closing_audio_profile_hash',
  'safe_media_fingerprint',
]);

function normaliseSignalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normaliseSignalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

const MEDIA_IDENTITY_SIGNAL_BY_KEY: Record<string, MediaIdentitySignalName> = {
  original_upload_file_hash: 'original_upload_file_hash',
  upload_hash: 'original_upload_file_hash',
  sha256: 'original_upload_file_hash',
  checksum: 'original_upload_file_hash',
  opening_video_sample_hash_or_profile: 'opening_video_sample_hash',
  opening_video_sample_hash: 'opening_video_sample_hash',
  opening_video_profile_hash: 'opening_video_sample_hash',
  closing_video_sample_hash_or_profile: 'closing_video_sample_hash',
  closing_video_sample_hash: 'closing_video_sample_hash',
  closing_video_profile_hash: 'closing_video_sample_hash',
  opening_audio_profile_hash: 'opening_audio_profile_hash',
  closing_audio_profile_hash: 'closing_audio_profile_hash',
  safe_media_fingerprint: 'safe_media_fingerprint',
  file_size_bytes: 'file_size_bytes',
  size_bytes: 'file_size_bytes',
  metadata_file_name: 'metadata_file_name',
  visible_or_original_file_name: 'original_file_name',
  original_file_name: 'original_file_name',
  file_name: 'original_file_name',
  filename: 'original_file_name',
  video_duration_ms: 'video_duration_ms',
  duration_ms: 'video_duration_ms',
  video_duration_seconds: 'video_duration_ms',
  duration_seconds: 'video_duration_ms',
};

function rawTakeSignalValue(take: InternalComparisonTakeInput, keys: string[]): unknown {
  for (const key of keys) {
    const direct = (take as unknown as Record<string, unknown>)[key];
    if (direct !== undefined && direct !== null && direct !== '') return direct;
  }
  const summaries = take.artefact_summaries;
  if (summaries && typeof summaries === 'object' && !Array.isArray(summaries)) {
    for (const key of keys) {
      const value = summaries[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }
  return null;
}

function mediaIdentitySignalComparableValue(take: InternalComparisonTakeInput, keys: string[]): unknown {
  const identity = take.media_identity;
  if (!identity || !isRecord(identity.media_identity_signals)) return null;
  for (const key of keys) {
    const signalName = MEDIA_IDENTITY_SIGNAL_BY_KEY[key];
    if (!signalName) continue;
    const signal = identity.media_identity_signals[signalName];
    if (!signal || signal.status !== 'available') continue;
    if (signal.safe_value !== undefined && signal.safe_value !== null && signal.safe_value !== '') return signal.safe_value;
    if (signal.value_hash) return signal.value_hash;
  }
  return null;
}

function takeSignalValue(take: InternalComparisonTakeInput, keys: string[]): unknown {
  const mediaIdentityValue = mediaIdentitySignalComparableValue(take, keys);
  if (mediaIdentityValue !== null && mediaIdentityValue !== undefined && mediaIdentityValue !== '') return mediaIdentityValue;
  return rawTakeSignalValue(take, keys);
}

function comparableStringValues(takes: InternalComparisonTakeInput[], keys: string[]): string[] {
  return takes.map((take) => normaliseSignalString(takeSignalValue(take, keys))).filter((value): value is string => Boolean(value));
}

function comparableNumberValues(takes: InternalComparisonTakeInput[], keys: string[], multiplier = 1): number[] {
  return takes
    .map((take) => normaliseSignalNumber(takeSignalValue(take, keys)))
    .filter((value): value is number => value !== null)
    .map((value) => value * multiplier);
}

function exactDuplicateString(values: string[], caseInsensitive = false): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    const key = caseInsensitive ? value.toLowerCase() : value;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function exactOrNearDuplicateNumber(values: number[], toleranceAbsolute: number, toleranceRatio: number): boolean {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      const a = values[i]!;
      const b = values[j]!;
      const diff = Math.abs(a - b);
      const ratioBase = Math.max(Math.abs(a), Math.abs(b), 1);
      if (diff <= toleranceAbsolute || diff / ratioBase <= toleranceRatio) return true;
    }
  }
  return false;
}

function duplicateSignalSummary(signal: Tier1SignalName, values: Array<string | number>, matched: boolean, conflicting: boolean) {
  return {
    signal,
    weight: TIER1_WEIGHT_BY_SIGNAL[signal],
    available_count: values.length,
    comparable: values.length >= 2,
    matched,
    conflicting,
    value_hashes: values.map((value) => hashDiagnosticValue(String(value))),
  };
}

function scopeStatus(takes: InternalComparisonTakeInput[], keys: string[]): 'same' | 'conflicting' | 'unavailable' {
  const values = comparableStringValues(takes, keys);
  if (values.length < 2) return 'unavailable';
  return new Set(values).size === 1 ? 'same' : 'conflicting';
}

function duplicateDetectionStatusFromScore(score: number, hasReliableDifferentEvidence: boolean): DuplicateDetectionStatus {
  if (score >= 90) return 'detected';
  if (score >= 70) return 'likely_duplicate';
  if (score >= 45) return 'possible_duplicate';
  if (score > 0) return 'possible_duplicate';
  return hasReliableDifferentEvidence ? 'not_detected' : 'insufficient_evidence';
}

function looksLikeUnsafePrivateValue(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('://')
    || lower.includes('signed')
    || lower.includes('token')
    || lower.includes('secret')
    || lower.includes('authorization')
    || lower.includes('bearer')
    || lower.includes('x-amz')
    || lower.includes('sig=')
    || lower.includes('access_key')
    || lower.includes('apikey')
    || lower.includes('api_key');
}

function safeBasename(value: unknown): { value: string | null; redacted: boolean; note?: string } {
  if (typeof value !== 'string') return { value: null, redacted: false };
  const trimmed = value.trim();
  if (!trimmed) return { value: null, redacted: false };
  const queryIndex = trimmed.search(/[?#]/);
  const withoutQuery = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
  const basename = withoutQuery.replace(/\\/g, '/').split('/').filter(Boolean).pop()?.trim() ?? '';
  if (!basename) return { value: null, redacted: true, note: 'filename_path_redacted' };
  if (looksLikeUnsafePrivateValue(trimmed) || looksLikeUnsafePrivateValue(basename)) {
    return { value: null, redacted: true, note: 'unsafe_filename_value_redacted' };
  }
  return { value: basename.slice(0, 160), redacted: trimmed !== basename };
}

function normaliseSafeDiagnosticRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed)) return null;
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(trimmed)) return hashDiagnosticValue(trimmed);
  return trimmed;
}

function mediaIdentityRawValue(input: { take: InternalComparisonTakeInput; keys: string[] }): unknown {
  return rawTakeSignalValue(input.take, input.keys);
}

function normaliseOriginalUploadHashValue(value: unknown): string | null {
  const raw = isRecord(value) ? value.value : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed) || /[\\/]/.test(trimmed)) return null;
  const match = trimmed.match(/^(?:sha256:)?([a-f0-9]{64})$/);
  return match ? `sha256:${match[1]}` : null;
}

function mediaIdentityStringSignal(input: {
  take: InternalComparisonTakeInput;
  signal_name: MediaIdentitySignalName;
  keys: string[];
  source_path: string;
  confidence_role: MediaIdentitySignalEntry['confidence_role'];
  filename?: boolean;
}): MediaIdentitySignalEntry {
  const raw = mediaIdentityRawValue({ take: input.take, keys: input.keys });
  const notes: string[] = [];
  if (input.filename) {
    const safe = safeBasename(raw);
    if (!safe.value) {
      if (safe.redacted && safe.note) notes.push(safe.note);
      return {
        signal_name: input.signal_name,
        status: safe.redacted ? 'redacted' : 'unavailable',
        raw_value_redacted: safe.redacted,
        source_artefact_id: 'analysis_take',
        source_path: input.source_path,
        confidence_role: input.confidence_role,
        notes: notes.length ? notes : ['signal_unavailable'],
      };
    }
    return {
      signal_name: input.signal_name,
      status: 'available',
      safe_value: safe.value,
      value_hash: hashDiagnosticValue(safe.value.toLowerCase()),
      raw_value_redacted: safe.redacted,
      source_artefact_id: 'analysis_take',
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: safe.redacted ? ['basename_only_path_redacted'] : [],
    };
  }
  if (input.signal_name === 'original_upload_file_hash') {
    const hashValue = normaliseOriginalUploadHashValue(raw);
    if (!hashValue) {
      const unsafe = typeof raw === 'string' && (looksLikeUnsafePrivateValue(raw) || /[\\/]/.test(raw));
      return {
        signal_name: input.signal_name,
        status: unsafe ? 'redacted' : 'unavailable',
        raw_value_redacted: unsafe,
        source_artefact_id: 'analysis_take',
        source_path: input.source_path,
        confidence_role: input.confidence_role,
        notes: [unsafe ? 'unsafe_hash_value_redacted' : 'invalid_or_unavailable_sha256_hash'],
      };
    }
    return {
      signal_name: input.signal_name,
      status: 'available',
      safe_value: hashValue,
      value_hash: hashDiagnosticValue(hashValue),
      raw_value_redacted: false,
      source_artefact_id: 'analysis_take',
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: [],
    };
  }
  const value = normaliseSignalString(raw);
  if (!value) {
    return {
      signal_name: input.signal_name,
      status: 'unavailable',
      raw_value_redacted: false,
      source_artefact_id: 'analysis_take',
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: ['signal_unavailable'],
    };
  }
  const redacted = looksLikeUnsafePrivateValue(value) || /[\\/]/.test(value);
  if (redacted) {
    return {
      signal_name: input.signal_name,
      status: 'redacted',
      raw_value_redacted: true,
      source_artefact_id: 'analysis_take',
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: ['unsafe_raw_value_redacted'],
    };
  }
  return {
    signal_name: input.signal_name,
    status: 'available',
    safe_value: value.slice(0, 160),
    value_hash: hashDiagnosticValue(value),
    raw_value_redacted: false,
    source_artefact_id: 'analysis_take',
    source_path: input.source_path,
    confidence_role: input.confidence_role,
    notes: [],
  };
}

function mediaIdentityNumberSignal(input: {
  take: InternalComparisonTakeInput;
  signal_name: MediaIdentitySignalName;
  keys: string[];
  source_path: string;
  confidence_role: MediaIdentitySignalEntry['confidence_role'];
  multiplier?: number;
}): MediaIdentitySignalEntry {
  const raw = mediaIdentityRawValue({ take: input.take, keys: input.keys });
  const value = normaliseSignalNumber(raw);
  if (value === null) {
    return {
      signal_name: input.signal_name,
      status: 'unavailable',
      raw_value_redacted: false,
      source_artefact_id: 'analysis_take',
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: ['signal_unavailable'],
    };
  }
  const normalised = Math.round(value * (input.multiplier ?? 1));
  return {
    signal_name: input.signal_name,
    status: 'available',
    safe_value: normalised,
    value_hash: hashDiagnosticValue(String(normalised)),
    raw_value_redacted: false,
    source_artefact_id: 'analysis_take',
    source_path: input.source_path,
    confidence_role: input.confidence_role,
    notes: [],
  };
}

function buildMediaIdentityPayload(input: {
  run_id: string;
  take: InternalComparisonTakeInput;
  analysis_run_id?: string;
  source_module?: string;
  source_stage?: string;
}): MediaIdentityPayload {
  const take = input.take;
  const analysisRunId = input.analysis_run_id ?? take.analysis_run_id;
  const durationMsRaw = rawTakeSignalValue(take, ['video_duration_ms', 'duration_ms']);
  const durationSecondsRaw = rawTakeSignalValue(take, ['video_duration_seconds', 'duration_seconds']);
  const durationSignal = normaliseSignalNumber(durationMsRaw) !== null
    ? mediaIdentityNumberSignal({ take, signal_name: 'video_duration_ms', keys: ['video_duration_ms', 'duration_ms'], source_path: 'video_duration_ms', confidence_role: 'weak' })
    : mediaIdentityNumberSignal({ take, signal_name: 'video_duration_ms', keys: ['video_duration_seconds', 'duration_seconds'], source_path: 'mux_duration_seconds', confidence_role: 'weak', multiplier: 1000 });
  const uploadIdentity = isRecord(take.upload_identity_metadata) ? take.upload_identity_metadata : null;
  const uploadIdentitySource = uploadIdentity ? 'signals.upload_identity' : null;
  const media_identity_signals: Record<MediaIdentitySignalName, MediaIdentitySignalEntry> = {
    original_upload_file_hash: mediaIdentityStringSignal({ take, signal_name: 'original_upload_file_hash', keys: ['original_upload_file_hash', 'upload_hash', 'sha256', 'checksum'], source_path: uploadIdentitySource ? `${uploadIdentitySource}.original_upload_file_hash.value` : 'original_upload_file_hash', confidence_role: 'decisive' }),
    original_file_name: mediaIdentityStringSignal({ take, signal_name: 'original_file_name', keys: ['visible_or_original_file_name', 'original_file_name', 'file_name', 'filename'], source_path: uploadIdentitySource ? `${uploadIdentitySource}.original_file_name_safe_basename` : 'original_file_name', confidence_role: 'weak', filename: true }),
    metadata_file_name: mediaIdentityStringSignal({ take, signal_name: 'metadata_file_name', keys: ['metadata_file_name'], source_path: uploadIdentitySource ? `${uploadIdentitySource}.metadata_file_name_safe_basename` : 'metadata_file_name', confidence_role: 'medium', filename: true }),
    file_size_bytes: mediaIdentityNumberSignal({ take, signal_name: 'file_size_bytes', keys: ['file_size_bytes', 'size_bytes'], source_path: uploadIdentitySource ? `${uploadIdentitySource}.file_size_bytes` : 'file_size_bytes', confidence_role: 'medium' }),
    video_duration_ms: durationSignal,
    opening_video_sample_hash: mediaIdentityStringSignal({ take, signal_name: 'opening_video_sample_hash', keys: ['opening_video_sample_hash_or_profile', 'opening_video_sample_hash', 'opening_video_profile_hash'], source_path: 'opening_video_sample_hash', confidence_role: 'strong' }),
    closing_video_sample_hash: mediaIdentityStringSignal({ take, signal_name: 'closing_video_sample_hash', keys: ['closing_video_sample_hash_or_profile', 'closing_video_sample_hash', 'closing_video_profile_hash'], source_path: 'closing_video_sample_hash', confidence_role: 'strong' }),
    opening_audio_profile_hash: mediaIdentityStringSignal({ take, signal_name: 'opening_audio_profile_hash', keys: ['opening_audio_profile_hash'], source_path: 'opening_audio_profile_hash', confidence_role: 'strong' }),
    closing_audio_profile_hash: mediaIdentityStringSignal({ take, signal_name: 'closing_audio_profile_hash', keys: ['closing_audio_profile_hash'], source_path: 'closing_audio_profile_hash', confidence_role: 'strong' }),
    safe_media_fingerprint: mediaIdentityStringSignal({ take, signal_name: 'safe_media_fingerprint', keys: ['safe_media_fingerprint'], source_path: 'safe_media_fingerprint', confidence_role: 'strong' }),
  };
  const availableSignalCount = Object.values(media_identity_signals).filter((signal) => signal.status === 'available').length;
  const unavailableSignalCount = Object.values(media_identity_signals).filter((signal) => signal.status !== 'available').length;
  const reliableSignals = ['original_upload_file_hash', 'opening_video_sample_hash', 'closing_video_sample_hash', 'opening_audio_profile_hash', 'closing_audio_profile_hash', 'safe_media_fingerprint'] as const;
  const hasReliableUploadOrContentSignal = reliableSignals.some((signal) => media_identity_signals[signal].status === 'available');
  const blocker_codes = dedupePreservingOrder([
    ...(media_identity_signals.original_upload_file_hash.status === 'available' ? [] : ['original_upload_file_hash_unavailable']),
    ...(media_identity_signals.opening_video_sample_hash.status === 'available' ? [] : ['opening_video_sample_unavailable']),
    ...(media_identity_signals.closing_video_sample_hash.status === 'available' ? [] : ['closing_video_sample_unavailable']),
    ...(media_identity_signals.opening_audio_profile_hash.status === 'available' ? [] : ['opening_audio_profile_unavailable']),
    ...(media_identity_signals.closing_audio_profile_hash.status === 'available' ? [] : ['closing_audio_profile_unavailable']),
    ...(hasReliableUploadOrContentSignal ? [] : ['media_identity_no_reliable_upload_or_content_signal']),
    ...(availableSignalCount === 0 ? ['media_identity_unavailable'] : []),
  ]);
  const mediaIdentityStatus: MediaIdentityStatus = availableSignalCount === 0
    ? 'unavailable'
    : (unavailableSignalCount === 0 ? 'complete' : 'partial');
  const muxPlaybackRef = take.safe_mux_playback_ref ?? take.mux_playback_ref ?? null;
  return {
    schema_version: 'tapecoach_v3_media_identity_v1',
    artefact_type: 'media_identity',
    run_id: input.run_id,
    take_id: take.take_id,
    analysis_run_id: analysisRunId,
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: 'internal_private',
    source_stage: input.source_stage ?? 'buildMediaIdentityPayload',
    source_module: input.source_module ?? 'src/server/v3/qa-artifacts-wiring.server.ts',
    media_identity_status: mediaIdentityStatus,
    media_identity_scope: 'same_user_same_audition',
    user_scope_status: (normaliseSignalString(take.user_id) || normaliseSignalString(take.profile_id)) ? 'same_user_only' : 'unavailable',
    audition_scope_status: (normaliseSignalString(take.audition_id) || normaliseSignalString(take.submission_id)) ? 'same_audition_or_submission' : 'unavailable',
    available_signal_count: availableSignalCount,
    unavailable_signal_count: unavailableSignalCount,
    media_identity_signals,
    reference_diagnostics: {
      take_id: take.take_id,
      analysis_run_id: analysisRunId,
      mux_playback_id_present: Boolean(take.mux_playback_ref),
      mux_asset_or_upload_id_present: take.mux_asset_or_upload_id_present ?? 'unknown',
      safe_mux_playback_ref: normaliseSafeDiagnosticRef(muxPlaybackRef),
    },
    signal_source_summary: {
      source_artefact_id: 'analysis_take',
      source_path: 'inputs/media_identity.json',
      upload_identity_source: uploadIdentitySource ?? 'unavailable',
      original_upload_file_hash_source_stage: take.original_upload_file_hash_source_stage ?? null,
      mime_type_safe_summary: take.mime_type_safe_summary ?? null,
      last_modified_ms: normaliseSignalNumber(take.last_modified_ms) ?? null,
      upload_metadata_source: take.upload_metadata_source ?? null,
      upload_identity_capture_status: normaliseSignalString(take.upload_identity_capture_status) ?? (media_identity_signals.original_upload_file_hash.status === 'available' ? 'captured' : (uploadIdentity ? 'partial' : 'unavailable')),
      upload_identity_capture_reason: normaliseSignalString(take.upload_identity_capture_reason) ?? null,
      upload_identity_merge_status: normaliseSignalString(take.upload_identity_merge_status) ?? null,
      duration_source: normaliseSignalNumber(durationMsRaw) !== null ? 'video_duration_ms' : (normaliseSignalNumber(durationSecondsRaw) !== null ? 'mux_duration_seconds' : 'unavailable'),
      sampling_helper_status: (
        media_identity_signals.opening_video_sample_hash.status === 'available'
        || media_identity_signals.closing_video_sample_hash.status === 'available'
        || media_identity_signals.opening_audio_profile_hash.status === 'available'
        || media_identity_signals.closing_audio_profile_hash.status === 'available'
      ) ? 'provided_by_runtime_input' : 'unavailable',
    },
    blocker_codes,
    cannot_satisfy_duplicate_detection_gate: !hasReliableUploadOrContentSignal,
    public_output_unchanged: true,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
  };
}

function buildTier1DuplicateDetectionTrace(input: {
  run_id: string;
  analysis_run_id: string;
  comparison_run_id: string;
  compared_takes: InternalComparisonTakeInput[];
  compared_take_ids: string[];
  compared_analysis_run_ids: string[];
  operator_same_video_assertion?: boolean;
  source_module?: string;
  source_stage?: string;
}): Record<string, unknown> {
  const takes = input.compared_takes.map((take) => ({
    ...take,
    media_identity: take.media_identity ?? buildMediaIdentityPayload({
      run_id: input.run_id,
      take,
      source_module: input.source_module,
      source_stage: input.source_stage,
    }),
  }));
  const referenceDiagnostics = {
    same_take_id: hasDuplicateNonEmptyString(takes.map((take) => take.take_id)),
    same_analysis_run_id: hasDuplicateNonEmptyString(takes.map((take) => take.analysis_run_id)),
    same_mux_playback_ref: hasDuplicateNonEmptyString(takes.map((take) => take.mux_playback_ref)),
    mux_playback_refs_available_count: comparableStringValues(takes, ['mux_playback_ref']).length,
    compared_take_ids: input.compared_take_ids,
    compared_analysis_run_ids: input.compared_analysis_run_ids,
  };
  const operatorAssertion = Boolean(input.operator_same_video_assertion || takes.some((take) => take.operator_same_video_assertion === true));
  const signalSummaries: Record<string, ReturnType<typeof duplicateSignalSummary>> = {};
  const signalsMatched: Tier1SignalName[] = [];
  const signalsMissing: Tier1SignalName[] = [];
  const signalsConflicting: Tier1SignalName[] = [];
  const basis: string[] = [];
  let score = 0;
  let strongComparedCount = 0;

  const addStringSignal = (signal: Tier1SignalName, keys: string[], opts: { caseInsensitive?: boolean; decisive?: boolean } = {}) => {
    const values = comparableStringValues(takes, keys);
    const matched = values.length >= 2 && exactDuplicateString(values, opts.caseInsensitive);
    const conflicting = values.length >= 2 && !matched;
    signalSummaries[signal] = duplicateSignalSummary(signal, values, matched, conflicting);
    if (values.length < 2) signalsMissing.push(signal);
    if (STRONG_TIER1_SIGNALS.has(signal) && values.length >= 2) strongComparedCount += 1;
    if (matched) {
      signalsMatched.push(signal);
      basis.push(`${signal}_match`);
      score = opts.decisive ? 100 : Math.min(100, score + TIER1_WEIGHT_BY_SIGNAL[signal]);
    } else if (conflicting) {
      signalsConflicting.push(signal);
    }
  };

  const addNumberSignal = (signal: Tier1SignalName, keys: string[], opts: { multiplier?: number; absolute: number; ratio: number }) => {
    const values = comparableNumberValues(takes, keys, opts.multiplier ?? 1);
    const matched = values.length >= 2 && exactOrNearDuplicateNumber(values, opts.absolute, opts.ratio);
    const conflicting = values.length >= 2 && !matched;
    signalSummaries[signal] = duplicateSignalSummary(signal, values, matched, conflicting);
    if (values.length < 2) signalsMissing.push(signal);
    if (matched) {
      signalsMatched.push(signal);
      basis.push(`${signal}_exact_or_near_match`);
      score = Math.min(100, score + TIER1_WEIGHT_BY_SIGNAL[signal]);
    } else if (conflicting) {
      signalsConflicting.push(signal);
    }
  };

  addStringSignal('original_upload_file_hash', ['original_upload_file_hash', 'upload_hash', 'sha256', 'checksum'], { decisive: true });
  addStringSignal('opening_video_sample_hash_or_profile', ['opening_video_sample_hash_or_profile', 'opening_video_profile_hash']);
  addStringSignal('closing_video_sample_hash_or_profile', ['closing_video_sample_hash_or_profile', 'closing_video_profile_hash']);
  addStringSignal('opening_audio_profile_hash', ['opening_audio_profile_hash']);
  addStringSignal('closing_audio_profile_hash', ['closing_audio_profile_hash']);
  addStringSignal('safe_media_fingerprint', ['safe_media_fingerprint']);
  addNumberSignal('file_size_bytes', ['file_size_bytes', 'size_bytes'], { absolute: 1024, ratio: 0.01 });
  addStringSignal('metadata_file_name', ['metadata_file_name'], { caseInsensitive: true });
  addStringSignal('visible_or_original_file_name', ['visible_or_original_file_name', 'original_file_name', 'file_name', 'filename'], { caseInsensitive: true });
  const durationMsValues = comparableNumberValues(takes, ['video_duration_ms', 'duration_ms']);
  const durationSecondValues = comparableNumberValues(takes, ['video_duration_seconds', 'duration_seconds'], 1000);
  const allDurationValues = [...durationMsValues, ...durationSecondValues];
  const durationMatched = allDurationValues.length >= 2 && exactOrNearDuplicateNumber(allDurationValues, 1000, 0.01);
  const durationConflicting = allDurationValues.length >= 2 && !durationMatched;
  signalSummaries.video_duration_ms = duplicateSignalSummary('video_duration_ms', allDurationValues, durationMatched, durationConflicting);
  if (allDurationValues.length < 2) signalsMissing.push('video_duration_ms');
  if (durationMatched) {
    signalsMatched.push('video_duration_ms');
    basis.push('video_duration_ms_exact_or_near_match');
    score = Math.min(100, score + TIER1_WEIGHT_BY_SIGNAL.video_duration_ms);
  } else if (durationConflicting) {
    signalsConflicting.push('video_duration_ms');
  }

  if (operatorAssertion) {
    basis.push('operator_same_video_assertion');
    score = 100;
  }
  if (referenceDiagnostics.same_take_id) basis.push('same_take_id_reference_match');
  if (referenceDiagnostics.same_analysis_run_id) basis.push('same_analysis_run_id_reference_match');
  if (referenceDiagnostics.same_mux_playback_ref) basis.push('same_mux_playback_ref_reference_match');
  const referenceMatchDetected = referenceDiagnostics.same_take_id || referenceDiagnostics.same_analysis_run_id || referenceDiagnostics.same_mux_playback_ref;
  if (referenceMatchDetected) score = Math.max(score, 100);
  const sameUserScopeStatus = scopeStatus(takes, ['user_id', 'profile_id']);
  const sameAuditionScopeStatus = scopeStatus(takes, ['audition_id', 'submission_id']);
  const scopeConflict = sameUserScopeStatus === 'conflicting' || sameAuditionScopeStatus === 'conflicting';

  const sampleSignalsUnavailable = (
    signalSummaries.opening_video_sample_hash_or_profile.available_count < 2
    && signalSummaries.closing_video_sample_hash_or_profile.available_count < 2
    && signalSummaries.opening_audio_profile_hash.available_count < 2
    && signalSummaries.closing_audio_profile_hash.available_count < 2
  );
  const sufficientUploadOrContentEvidence = (
    STRONG_TIER1_SIGNALS.has('original_upload_file_hash') && signalSummaries.original_upload_file_hash.available_count >= 2
  ) || strongComparedCount > 0;
  const hasReliableDifferentEvidence = sufficientUploadOrContentEvidence && signalsMatched.every((signal) => !STRONG_TIER1_SIGNALS.has(signal));
  const effectiveScore = scopeConflict ? 0 : score;
  const duplicateStatus: DuplicateDetectionStatus = scopeConflict
    ? 'insufficient_evidence'
    : operatorAssertion || referenceMatchDetected
    ? 'detected'
    : duplicateDetectionStatusFromScore(effectiveScore, hasReliableDifferentEvidence);
  const notDetectedEvidenceSufficient = duplicateStatus === 'not_detected' && sufficientUploadOrContentEvidence;
  const suppressionRequired = duplicateStatus !== 'not_detected';
  const blockerCodes = [
    ...(sampleSignalsUnavailable ? ['duplicate_detection_sampling_unavailable'] : []),
    ...(scopeConflict ? ['duplicate_detection_scope_conflict'] : []),
    ...(duplicateStatus === 'insufficient_evidence' ? ['duplicate_detection_content_evidence_insufficient'] : []),
    ...(duplicateStatus === 'possible_duplicate' ? ['duplicate_detection_possible_duplicate_unresolved'] : []),
    ...((duplicateStatus === 'detected' || duplicateStatus === 'likely_duplicate') ? ['duplicate_detection_duplicate_or_likely_duplicate'] : []),
  ];

  return {
    schema_version: 'tapecoach_v3_duplicate_detection_trace_v1',
    artefact_type: 'duplicate_detection_trace',
    run_id: input.run_id,
    analysis_run_id: input.analysis_run_id,
    comparison_run_id: input.comparison_run_id,
    compared_take_ids: input.compared_take_ids,
    compared_analysis_run_ids: input.compared_analysis_run_ids,
    internal_only: true,
    privacy_classification: 'internal_private',
    generated_at: new Date().toISOString(),
    duplicate_detection_status: duplicateStatus,
    duplicate_detection_confidence: effectiveScore,
    duplicate_detection_basis: basis.length > 0 ? basis : ['insufficient_upload_or_content_evidence'],
    duplicate_detection_evidence_refs: Object.fromEntries(Object.entries(signalSummaries).map(([signal, summary]) => [signal, summary.value_hashes])),
    media_identity_evidence_refs: Object.fromEntries(takes.map((take) => [
      take.take_id,
      {
        artefact_path: `takes/take-${take.take_id}/analysis-${take.analysis_run_id}/inputs/media_identity.json`,
        media_identity_status: take.media_identity?.media_identity_status ?? 'unavailable',
        available_signal_count: take.media_identity?.available_signal_count ?? 0,
        unavailable_signal_count: take.media_identity?.unavailable_signal_count ?? 0,
        blocker_codes: take.media_identity?.blocker_codes ?? ['media_identity_unavailable'],
      },
    ])),
    duplicate_detection_signal_summary: signalSummaries,
    signals_matched: signalsMatched,
    signals_missing: signalsMissing,
    signals_conflicting: signalsConflicting,
    reference_diagnostics: referenceDiagnostics,
    operator_same_video_assertion: operatorAssertion,
    same_user_scope_status: sameUserScopeStatus,
    same_audition_scope_status: sameAuditionScopeStatus,
    sampling_window_policy: {
      opening_video_sample_window: 'skip_3_to_5_seconds_where_possible_then_sample_5_to_10_second_window',
      closing_video_sample_window: 'sample_5_to_10_second_window_before_final_fade_black_frame_end_card_or_freeze',
      audio_profile_window: 'use_matching_opening_and_closing_windows_where_available',
      single_frame_or_single_instant_samples_allowed: false,
    },
    sampling_window_status: sampleSignalsUnavailable ? 'unavailable' : 'partial_or_available',
    sampling_limitations: sampleSignalsUnavailable ? ['server_runtime_sampling_helpers_unavailable_in_s9_16c'] : [],
    sufficient_upload_or_content_evidence: sufficientUploadOrContentEvidence,
    not_detected_evidence_sufficient: notDetectedEvidenceSufficient,
    same_video_detected: duplicateStatus === 'detected' || duplicateStatus === 'likely_duplicate',
    repeated_input_detected: duplicateStatus === 'detected' || duplicateStatus === 'likely_duplicate',
    same_video_unresolved_risk: duplicateStatus === 'possible_duplicate' || duplicateStatus === 'insufficient_evidence',
    suppression_required: suppressionRequired,
    same_video_suppression_status: suppressionRequired ? 'suppressed' : 'not_applicable',
    blocker_codes: [...new Set(blockerCodes)],
    cannot_satisfy_level2_comparison_gate: true,
    public_output_unchanged: true,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    source_module: input.source_module ?? 'src/server/v3/qa-artifacts-wiring.server.ts',
    source_stage: input.source_stage ?? 'buildTier1DuplicateDetectionTrace',
  };
}

function stripTakePrefix(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('take-')) return trimmed;
  const core = trimmed.slice(5);
  if (!core || core.startsWith('take-')) return '';
  return core;
}
function stripRepeatedTakePrefixes(value: string): string {
  let core = String(value ?? '').trim();
  while (core.startsWith('take-')) core = core.slice(5);
  return core;
}
function normaliseUniqueTakeCores(values: readonly unknown[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values ?? []) {
    if (typeof value !== 'string') continue;
    const core = stripRepeatedTakePrefixes(value);
    if (!core || seen.has(core)) continue;
    seen.add(core);
    out.push(core);
  }
  return out;
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
    return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: [...(input.compared_take_ids ?? [])], compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'internal_qa_emit_disabled', blocker_codes: ['qa_flags_disabled'] };
  }
  const rootTakeIdCore = stripTakePrefix(input.root_take_id);
  try { assertSafeSegment(rootTakeIdCore, 'root_take_id'); } catch { return { ok: false, written: false, comparison_run_id: null, root_take_id: input.root_take_id, root_analysis_run_id: null, compared_take_ids: [...(input.compared_take_ids ?? [])], compared_analysis_run_ids: [], emitted_artefact_ids: [], warning: 'unsafe_root_take_id', blocker_codes: ['unsafe_root_take_id'] }; }
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
    emitted_blocked_artefact_ids: out.emitted_blocked_artefact_ids ?? [],
    comparison_parity_status: out.comparison_parity_status,
    warning: out.warning ?? null,
    blocker_codes: out.blocker_codes ?? (out.written ? [] : ['comparison_not_emitted']),
  };
}
export async function runInternalComparisonForTakes(input: InternalComparisonRuntimeSourceInput): Promise<any> {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(input.root_take_id, 'root_take_id');
  // Low-level/default mode stays preflight-free; required mode is operator/internal reconciliation.
  const rootTake = input.manifest_reconciliation_mode === 'required'
    ? (() => {
        const canonicalInputRootCore = stripTakePrefix(input.root_take_id);
        if (!canonicalInputRootCore) return null;
        return input.compared_takes.find((t) => stripTakePrefix(t.take_id) === canonicalInputRootCore) ?? null;
      })()
    : (input.compared_takes.find((t) => t.take_id === input.root_take_id) ?? null);
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
  const comparedTakesWithMediaIdentity = input.compared_takes.map((take) => ({
    ...take,
    media_identity: take.media_identity ?? buildMediaIdentityPayload({
      run_id: input.run_id,
      take,
      source_module: input.source_module,
      source_stage: input.source_stage,
    }),
  }));
  const duplicate_detection_trace = buildTier1DuplicateDetectionTrace({
    run_id: input.run_id,
    analysis_run_id: rootAnalysisRunId,
    comparison_run_id,
    compared_takes: comparedTakesWithMediaIdentity,
    compared_take_ids: comparedTakeIds,
    compared_analysis_run_ids: comparedAnalysisRunIds,
    operator_same_video_assertion: input.operator_same_video_assertion,
    source_module: input.source_module,
    source_stage: input.source_stage,
  });
  const duplicateDetectionStatus = String(duplicate_detection_trace.duplicate_detection_status ?? 'insufficient_evidence');
  const sameTake = Boolean((duplicate_detection_trace.reference_diagnostics as Record<string, unknown> | undefined)?.same_take_id);
  const sameAnalysis = Boolean((duplicate_detection_trace.reference_diagnostics as Record<string, unknown> | undefined)?.same_analysis_run_id);
  const sameMux = Boolean((duplicate_detection_trace.reference_diagnostics as Record<string, unknown> | undefined)?.same_mux_playback_ref);
  const sameVideoDetected = duplicateDetectionStatus === 'detected' || duplicateDetectionStatus === 'likely_duplicate';
  const sameVideoUnresolved = duplicateDetectionStatus === 'possible_duplicate' || duplicateDetectionStatus === 'insufficient_evidence';
  const routes = comparedTakesWithMediaIdentity.map((t) => `${t.analysis_route ?? 'unknown'}|${t.model_provider_family ?? 'unknown'}`);
  const routeVarianceDetected = new Set(routes).size > 1;
  const suppressionRequired = sameVideoDetected || sameVideoUnresolved || routeVarianceDetected;
  const suppressionDecision = suppressionRequired ? 'suppressed' : 'allowed_internal_only';
  const suppressionReasons = [
    ...(sameVideoDetected ? ['same_video_or_repeated_input'] : []),
    ...(sameVideoUnresolved ? ['duplicate_detection_insufficient_or_unresolved'] : []),
    ...(routeVarianceDetected ? ['unresolved_route_variance'] : []),
  ];
  const suppressionReason = suppressionReasons[0] ?? null;
  const recommendationSuppressed = suppressionRequired;
  const comparisonDecisionStatus = sameVideoDetected ? 'suppressed_same_video' : (sameVideoUnresolved ? 'suppressed_duplicate_detection_unresolved' : (routeVarianceDetected ? 'suppressed_route_variance' : 'internal_preference'));
  const selectedTakeId = suppressionRequired ? null : comparedTakeIds[0];
  const comparison_raw_data = stripForbiddenFieldsDeep({
    comparison_run_id,
    compared_take_ids: comparedTakeIds,
    compared_analysis_run_ids: comparedAnalysisRunIds,
    comparison_execution_status: 'executed',
    comparison_run_executed: true,
    comparison_decision_status: comparisonDecisionStatus,
    duplicate_detection_status: duplicateDetectionStatus,
    duplicate_detection_confidence: duplicate_detection_trace.duplicate_detection_confidence,
    recommendation_suppressed: recommendationSuppressed,
    suppression_reason: suppressionReason,
    suppression_reasons: suppressionReasons,
    suppression_decision: suppressionDecision,
    comparison_source_kind: 'internal_runtime_comparison',
    comparison_runtime_source_module: input.source_module,
    comparison_runtime_source_stage: input.source_stage,
    selected_take_id_internal_only: selectedTakeId,
    selected_take_id_satisfies_comparison_gate: !suppressionRequired,
    rejected_public_winner_reason: suppressionRequired ? 'public_comparison_forbidden_or_insufficient' : null,
    comparison_result_summary: { selected_take_id_internal_only: selectedTakeId, basis: 'internal_runtime_input_summaries' },
    redaction_policy: 'exclude prompts/raw responses/request bodies/headers/secrets/tokens/cookies/signed URLs/video URLs',
    redacted_fields: ['raw_prompt', 'prompt', 'system_prompt', 'user_prompt', 'request_body', 'raw_response', 'response_text', 'model_output', 'candidates', 'completion_text', 'headers', 'authorization', 'api_key', 'token', 'secret', 'cookie', 'session', 'signed_url', 'playback_url', 'video_url'],
    forbidden_fields_absent: true,
    public_output_unchanged: true,
  }) as Record<string, unknown>;
  const same_video_repeatability_trace = {
    same_take_id: sameTake, same_analysis_run_id: sameAnalysis, same_mux_playback_ref: sameMux, duplicate_detection_status: duplicateDetectionStatus, duplicate_detection_confidence: duplicate_detection_trace.duplicate_detection_confidence, same_video_detection_status: duplicateDetectionStatus, same_video_detected: sameVideoDetected, repeated_input_detected: sameVideoDetected, same_video_unresolved_risk: sameVideoUnresolved, same_video_suppression_status: (sameVideoDetected || sameVideoUnresolved) ? 'suppressed' : 'not_applicable', forced_winner_risk: sameVideoDetected, false_winner_risk: sameVideoDetected, suppression_required: suppressionRequired, suppression_applied: suppressionRequired, diagnostic_entries: [{ compared_take_ids: comparedTakeIds, compared_analysis_run_ids: comparedAnalysisRunIds, reference_diagnostics: duplicate_detection_trace.reference_diagnostics }], same_video_repeatability_trace_summary: { same_video_detected: sameVideoDetected, duplicate_detection_status: duplicateDetectionStatus },
  };
  const suppression_trace = {
    suppression_decision: suppressionDecision, suppression_reason: suppressionReason, suppression_reasons: suppressionReasons, recommendation_suppressed: recommendationSuppressed, duplicate_detection_status: duplicateDetectionStatus, affected_public_surfaces: ['public_output_unchanged_internal_only'], false_winner_prevention_status: suppressionRequired ? 'active' : 'not_required', same_video_suppression_status: (sameVideoDetected || sameVideoUnresolved) ? 'suppressed' : 'not_applicable', route_variance_suppression_status: routeVarianceDetected ? 'suppressed' : 'not_applicable', decision_source_refs: comparedAnalysisRunIds, comparison_suppression_trace_summary: { suppression_decision: suppressionDecision, duplicate_detection_status: duplicateDetectionStatus }, public_output_unchanged: true,
  };
  const route_variance_trace = {
    route_variance_status: routeVarianceDetected ? 'detected' : 'not_detected', compared_run_routes: routes, route_mismatch_detected: routeVarianceDetected, route_variance_detected: routeVarianceDetected, route_variance_risk: routeVarianceDetected, route_variance_mitigation_status: routeVarianceDetected ? 'unresolved_blocked' : 'not_required', route_variance_trace_summary: { route_variance_detected: routeVarianceDetected },
  };
  // Required mode must keep preflight, comparison writes, manifest rewrite and metrics rewrite on the same root.
  if (input.manifest_reconciliation_mode === 'required') {
    try {
      const canonicalRootTakeCore = stripTakePrefix(input.root_take_id);
      assertSafeSegment(canonicalRootTakeCore, 'root_take_id');
      const canonicalRootRunId = toCanonicalTakeRunId(canonicalRootTakeCore);
      if (!canonicalRootRunId) return { written: false as const, emitted_artefact_ids: [] as string[] };
      const canonicalComparedTakeIds = comparedTakeIds.map((id) => stripTakePrefix(id));
      if (canonicalComparedTakeIds.some((id) => !id)) return { written: false as const, emitted_artefact_ids: [] as string[] };
      canonicalComparedTakeIds.forEach((id) => assertSafeSegment(id, 'compared_take_id'));
      return emitComparisonRuntimeArtifactsWithManifestReconciliation({ run_id: canonicalRootRunId, root_take_id: canonicalRootTakeCore, take_id: canonicalRootTakeCore, analysis_run_id: canonicalRootRunId, comparison_run_id, compared_take_ids: canonicalComparedTakeIds, comparison_raw_data, same_video_repeatability_trace, duplicate_detection_trace, suppression_trace, route_variance_trace, media_identity_payloads: comparedTakesWithMediaIdentity.map((take) => take.media_identity!).filter(Boolean), source_module: input.source_module, source_stage: input.source_stage, root_dir: input.root_dir, internal_qa_emit: input.internal_qa_emit });
    } catch {
      return { written: false as const, emitted_artefact_ids: [] as string[] };
    }
  }
  return emitComparisonRuntimeArtifacts({ run_id: input.run_id, take_id: input.root_take_id, analysis_run_id: rootAnalysisRunId, comparison_run_id, compared_take_ids: comparedTakeIds, comparison_raw_data, same_video_repeatability_trace, duplicate_detection_trace, suppression_trace, route_variance_trace, media_identity_payloads: comparedTakesWithMediaIdentity.map((take) => take.media_identity!).filter(Boolean), source_module: input.source_module, source_stage: input.source_stage, root_dir: input.root_dir, internal_qa_emit: input.internal_qa_emit });
}
export async function emitQAManifestForAnalysisRun(metadata: QARuntimeMetadata) {
  const internalEmit = resolveInternalQAEmitEnabled({ internal_qa_emit: metadata.internal_qa_emit });
  if (!internalEmit) return { written: false, warning: null as string | null };
  try {
    const initialEmitted = [...(metadata.emitted_artefact_ids ?? [])].filter((id) => id !== 'qa_acceptance_metrics');
    const normalisedComparedTakeIds = normaliseUniqueTakeCores(metadata.compared_take_ids ?? metadata.take_ids);
    const baseOptions = { internal_qa_emit: true, run_id: metadata.run_id, analysis_run_id: metadata.analysis_run_id ?? metadata.run_id, comparison_run_id: metadata.comparison_run_id, take_id: metadata.take_id ?? metadata.take_ids?.[0], submission_id: metadata.submission_id, compared_take_ids: normalisedComparedTakeIds, fixture_id: metadata.fixture_id, commit_sha: metadata.commit_sha, branch_name: metadata.branch_name, root_dir: metadata.root_dir, ...(metadata.source_scope_file ? { source_scope_file: metadata.source_scope_file } : {}), input_refs: metadata.submission_id ? [`submission:${metadata.submission_id}`] : [], take_refs: metadata.take_ids ?? [], mux_playback_ids: metadata.mux_playback_ids, fixture_refs: metadata.route_module ? [`route:${metadata.route_module}`] : [], emitted_artefact_ids: initialEmitted, emitted_blocked_artefact_ids: metadata.emitted_blocked_artefact_ids ?? [], deferred_artefact_ids: metadata.deferred_artefact_ids ?? [], not_applicable_artefact_ids: metadata.not_applicable_artefact_ids ?? [], runtime_evidence_accepted_by_id: metadata.runtime_evidence_accepted_by_id, runtime_evidence_blocked_by_id: metadata.runtime_evidence_blocked_by_id, artefact_source_classification_by_id: metadata.artefact_source_classification_by_id, artefact_level2_spine_satisfaction_by_id: metadata.artefact_level2_spine_satisfaction_by_id, legacy_adapter_artefact_ids: metadata.legacy_adapter_artefact_ids, real_v3_spine_artefact_ids: metadata.real_v3_spine_artefact_ids, defect_risk_ids: metadata.defect_risk_ids, public_claim_trace_summary: metadata.public_claim_trace_summary, claim_candidate_trace_summary: metadata.claim_candidate_trace_summary, evidence_anchor_trace_summary: metadata.evidence_anchor_trace_summary, technique_observation_trace_summary: metadata.technique_observation_trace_summary, score_trace_summary: metadata.score_trace_summary, model_run_trace_summary: metadata.model_run_trace_summary, analysis_evidence_state_summary: metadata.analysis_evidence_state_summary, media_identity_summary: metadata.media_identity_summary };
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
    const initialManifestWarning = getQAWriteWarning(out);
    if (!('manifest' in out)) {
      const initialWarning = mergeQAWarnings(
        initialManifestWarning,
        'internal_qa_manifest_sink_write_failed',
      );
      return { written: false, warning: initialWarning, manifest_path: (out as { manifest_path?: string }).manifest_path };
    }
    const preFinalManifest = (out as any).manifest;
    const preFinalMetrics = { ...buildQAAcceptanceMetrics(preFinalManifest), ...resolveQADeploymentProvenance() };
    const intendedSameFinalisationArtefactIds = ['validator_trace', 'gate_trace'];
    let emittedWithInternalTraces = [...new Set(initialEmitted)];
    let emittedBlockedWithInternalTraces = [...new Set(metadata.emitted_blocked_artefact_ids ?? [])];
    let artefactSourceClassificationById = { ...(metadata.artefact_source_classification_by_id ?? {}) };
    let artefactLevel2ById = { ...(metadata.artefact_level2_spine_satisfaction_by_id ?? {}) };
    const noExportSourceById: Record<string, string> = {
      no_export_source_proof: 'internal_no_export_source_proof',
      no_export_config_proof: 'internal_no_export_config_proof',
      no_export_ui_proof: 'internal_no_export_ui_proof',
      no_export_log_proof: 'internal_no_export_log_proof',
      no_export_proof: 'internal_no_export_proof_bundle',
    };
    for (const id of emittedWithInternalTraces) {
      if (noExportSourceById[id] && !artefactSourceClassificationById[id]) artefactSourceClassificationById[id] = noExportSourceById[id];
      if (id.startsWith('no_export_') && artefactLevel2ById[id] === undefined) artefactLevel2ById[id] = false;
    }
    let validatorTraceSummary: Record<string, unknown> | undefined;
    let gateTraceSummary: Record<string, unknown> | undefined;
    let takeIdForFirstPassTraces: string | null = null;
    try {
      takeIdForFirstPassTraces = resolveTakeIdForFirstPassTraces({ take_id: baseOptions.take_id, run_id: baseOptions.run_id });
    } catch {
      takeIdForFirstPassTraces = null;
    }
    const rawTakeIdProvided = typeof baseOptions.take_id === 'string' && baseOptions.take_id.length > 0;
    const comparisonParityTakeId =
      rawTakeIdProvided && !isSafeComparisonParityTakeIdSegment(baseOptions.take_id)
        ? '../unsafe_take_id'
        : (takeIdForFirstPassTraces ?? undefined);
    const canEmitTakeScopedFirstPassTraces = shouldUseExpandedManifestPaths() && takeIdForFirstPassTraces !== null;
    if (canEmitTakeScopedFirstPassTraces) {
    const validatorWrite = await emitValidatorTraceFirstPass({
      run_id: metadata.run_id, analysis_run_id: baseOptions.analysis_run_id, take_id: takeIdForFirstPassTraces ?? undefined,
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
      run_id: metadata.run_id, analysis_run_id: baseOptions.analysis_run_id, take_id: takeIdForFirstPassTraces ?? undefined,
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

    if (metadata.report_parity_input) {
      let renderPayloadForParity = metadata.report_parity_input?.render_payload ?? null;
      let publicReportPayloadForParity = metadata.report_parity_input?.public_report_payload ?? null;
      if (!renderPayloadForParity && metadata.report_parity_input?.raw_report_data) {
        const renderPayloadWrite = await emitRenderPayloadArtifact({
          run_id: metadata.run_id,
          analysis_run_id: baseOptions.analysis_run_id,
          take_id: takeIdForFirstPassTraces ?? undefined,
          submission_id: metadata.submission_id,
          source_module: 'src/server/v3/qa-artifacts-wiring.server.ts',
          source_stage: 'emitQAManifestForAnalysisRun.pre_finalisation',
          raw_report_data: metadata.report_parity_input.raw_report_data,
          allowed_field_paths: metadata.report_parity_input.allowed_public_fields,
          blocked_field_paths: metadata.report_parity_input.blocked_field_paths,
          root_dir: metadata.root_dir,
          internal_qa_emit: true,
        });
        if (renderPayloadWrite.written) {
          renderPayloadForParity = renderPayloadWrite.parity_payload;
          artefactSourceClassificationById.render_payload = 'internal_render_payload';
          artefactLevel2ById.render_payload = false;
          if (renderPayloadWrite.render_payload_status === 'emitted') {
            emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, 'render_payload'])];
            emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter((id) => id !== 'render_payload');
          } else {
            emittedWithInternalTraces = emittedWithInternalTraces.filter((id) => id !== 'render_payload');
            emittedBlockedWithInternalTraces = [...new Set([...emittedBlockedWithInternalTraces, 'render_payload'])];
          }
        }
      }
      if (!publicReportPayloadForParity && renderPayloadForParity) {
        const publicPayloadWrite = await emitPublicReportPayloadArtifact({
          run_id: metadata.run_id,
          analysis_run_id: baseOptions.analysis_run_id,
          take_id: takeIdForFirstPassTraces ?? undefined,
          submission_id: metadata.submission_id,
          source_module: 'src/server/v3/qa-artifacts-wiring.server.ts',
          source_stage: 'emitQAManifestForAnalysisRun.pre_finalisation',
          raw_report_data: metadata.report_parity_input.raw_report_data,
          render_payload: renderPayloadForParity,
          allowed_field_paths: metadata.report_parity_input.allowed_public_fields,
          blocked_field_paths: metadata.report_parity_input.blocked_field_paths,
          root_dir: metadata.root_dir,
          internal_qa_emit: true,
        });
        if (publicPayloadWrite.written) {
          publicReportPayloadForParity = publicPayloadWrite.parity_payload;
          artefactSourceClassificationById.public_report_payload = 'internal_public_report_payload';
          artefactLevel2ById.public_report_payload = false;
          if (publicPayloadWrite.public_report_payload_status === 'emitted') {
            emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, 'public_report_payload'])];
            emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter((id) => id !== 'public_report_payload');
          } else {
            emittedWithInternalTraces = emittedWithInternalTraces.filter((id) => id !== 'public_report_payload');
            emittedBlockedWithInternalTraces = [...new Set([...emittedBlockedWithInternalTraces, 'public_report_payload'])];
          }
        }
      }
      const parityWrite = await emitReportParityProof({
        run_id: metadata.run_id,
        analysis_run_id: baseOptions.analysis_run_id,
        take_id: takeIdForFirstPassTraces ?? undefined,
        submission_id: metadata.submission_id,
        source_module: 'src/server/v3/qa-artifacts-wiring.server.ts',
        source_stage: 'emitQAManifestForAnalysisRun.pre_finalisation',
        raw_report_data: metadata.report_parity_input?.raw_report_data,
        render_payload: renderPayloadForParity,
        public_report_payload: publicReportPayloadForParity,
        allowed_public_fields: metadata.report_parity_input?.allowed_public_fields,
        blocked_field_paths: metadata.report_parity_input?.blocked_field_paths,
        blocked_score_field_paths: metadata.report_parity_input?.blocked_score_field_paths,
        root_dir: metadata.root_dir,
        internal_qa_emit: true,
      });
      if (parityWrite.written) {
        artefactSourceClassificationById.parity_report = 'internal_report_parity_proof';
        artefactLevel2ById.parity_report = parityWrite.parity_status === 'passed';
        if (parityWrite.parity_status === 'passed') {
          emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, 'parity_report'])];
          emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter((id) => id !== 'parity_report');
        } else {
          emittedWithInternalTraces = emittedWithInternalTraces.filter((id) => id !== 'parity_report');
          emittedBlockedWithInternalTraces = [...new Set([...emittedBlockedWithInternalTraces, 'parity_report'])];
        }
      }
    }
    const comparisonInvoked = Boolean(metadata.comparison_run_id) || normalisedComparedTakeIds.length > 1 || COMPARISON_ARTEFACT_IDS.some((id) => emittedWithInternalTraces.includes(id) || emittedBlockedWithInternalTraces.includes(id));
    const comparisonEvidenceStatus = {
      comparison_raw: emittedWithInternalTraces.includes('comparison_raw'),
      comparison_report_internal: emittedWithInternalTraces.includes('comparison_report_internal'),
      same_video_repeatability_trace: emittedWithInternalTraces.includes('same_video_repeatability_trace'),
      duplicate_detection_trace: emittedWithInternalTraces.includes('duplicate_detection_trace'),
      comparison_suppression_trace: emittedWithInternalTraces.includes('comparison_suppression_trace'),
      route_variance_trace: emittedWithInternalTraces.includes('route_variance_trace'),
    };
    const hasCompleteComparisonEvidence = Object.values(comparisonEvidenceStatus).every(Boolean);
    const parityDeferred = (metadata.deferred_artefact_ids ?? []).includes('parity_comparison');
    const shouldEmitComparisonParity = comparisonInvoked && !parityDeferred;
    const comparisonParityWrite = shouldEmitComparisonParity ? await emitComparisonParityProof({
      run_id: metadata.run_id,
      analysis_run_id: baseOptions.analysis_run_id,
      take_id: comparisonParityTakeId,
      submission_id: metadata.submission_id ?? null,
      comparison_run_id: metadata.comparison_run_id ?? null,
      compared_take_ids: normalisedComparedTakeIds,
      root_dir: metadata.root_dir,
      internal_qa_emit: true,
      comparison_invoked: comparisonInvoked,
      comparison_evidence_status: comparisonEvidenceStatus,
      comparison_payloads: metadata.comparison_parity_input?.comparison_payloads ?? undefined,
      public_comparison_surface_paths: metadata.comparison_parity_input?.public_comparison_surface_paths ?? undefined,
    }) : { written: false, emitted_artefact_ids: [] as string[], parity_status: (comparisonInvoked ? 'insufficient' : 'not_applicable') as 'insufficient'|'not_applicable' };
    artefactSourceClassificationById.parity_comparison = 'internal_comparison_parity_proof';
    artefactLevel2ById.parity_comparison = shouldEmitComparisonParity && comparisonParityWrite.written && comparisonParityWrite.parity_status === 'passed';
    if (parityDeferred) {
      emittedWithInternalTraces = emittedWithInternalTraces.filter((id) => id !== 'parity_comparison');
      emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter((id) => id !== 'parity_comparison');
    } else if (comparisonParityWrite.parity_status === 'not_applicable') {
      emittedWithInternalTraces = emittedWithInternalTraces.filter((id) => id !== 'parity_comparison');
      emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter((id) => id !== 'parity_comparison');
      baseOptions.not_applicable_artefact_ids = [...new Set([...(baseOptions.not_applicable_artefact_ids ?? []), 'parity_comparison'])];
    } else if (comparisonParityWrite.written && comparisonParityWrite.parity_status === 'passed') {
      emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, 'parity_comparison'])];
      emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter((id) => id !== 'parity_comparison');
    } else if (comparisonParityWrite.written) {
      emittedWithInternalTraces = emittedWithInternalTraces.filter((id) => id !== 'parity_comparison');
      emittedBlockedWithInternalTraces = [...new Set([...emittedBlockedWithInternalTraces, 'parity_comparison'])];
    }

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
    const finalOut = await emitInternalQAArtifactManifest({ ...baseOptions, manifest_relative_path: manifestRelativePath, emitted_artefact_ids: [...new Set([...emittedWithInternalTraces, 'qa_acceptance_metrics'])], emitted_blocked_artefact_ids: emittedBlockedWithInternalTraces, runtime_evidence_accepted_by_id: [...new Set([...(metadata.runtime_evidence_accepted_by_id ?? emittedWithInternalTraces), 'qa_acceptance_metrics'])], runtime_evidence_blocked_by_id: [...new Set([...(metadata.runtime_evidence_blocked_by_id ?? emittedBlockedWithInternalTraces), ...emittedBlockedWithInternalTraces])], artefact_source_classification_by_id: artefactSourceClassificationById, artefact_level2_spine_satisfaction_by_id: artefactLevel2ById, validator_trace_summary: validatorTraceSummary, gate_trace_summary: gateTraceSummary });
    let finalMetricsWrite: Awaited<ReturnType<typeof writeQAArtifact>> | null = null;
    if (finalOut.written && 'manifest' in (finalOut as any)) {
      const finalMetrics = { ...buildQAAcceptanceMetrics((finalOut as any).manifest), ...resolveQADeploymentProvenance() };
      finalMetricsWrite = await writeQAArtifact({ root_dir: metadata.root_dir ?? DEFAULT_ROOT, run_id: metadata.run_id, relative_path: metricsRelativePath, payload: finalMetrics, artefact_id: 'qa_acceptance_metrics', fixture_id: metadata.fixture_id });
    }
    const finalWarning = mergeQAWarnings(
      initialManifestWarning,
      getQAWriteWarning(qaWrite),
      getQAWriteWarning(finalOut),
      getQAWriteWarning(finalMetricsWrite),
      qaWrite.written ? null : 'pre_final qa_acceptance_metrics write failed before final manifest emission',
      finalOut.written ? null : 'final QA manifest write failed after parity/no-export classification',
      finalOut.written && finalMetricsWrite && !finalMetricsWrite.written ? 'final qa_acceptance_metrics rewrite failed after final manifest emission' : null,
    );
    return { written: finalOut.written, warning: finalWarning, manifest_path: (finalOut as { manifest_path?: string }).manifest_path ?? (out as { manifest_path?: string }).manifest_path };
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

type EvidenceAnchorAggregateGateStatus = 'insufficient' | 'sufficient';
type EvidenceAnchorAggregateGateEvaluation = {
  evidenceAnchorGateStatus: EvidenceAnchorAggregateGateStatus;
  sourceClassification: string;
  gateReason: string;
  blockerCodes: string[];
  realRuntimeAnchorCount: number;
  blockedRealRuntimeAnchorCount: number;
  legacyAdapterAnchorCount: number;
  reportSnapshotAnchorCount: number;
  sourceScaffoldAnchorCount: number;
  blockedAnchorCount: number;
  excludedLegacyDiagnosticAnchorCount: number;
};

const REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS: Record<string, string> = {
  video: 'missing_video_observable_evidence',
  audio: 'missing_audio_observable_evidence',
  material: 'missing_material_observable_evidence',
  performance: 'missing_performance_observable_evidence',
  candidate_technique: 'missing_candidate_technique_evidence',
};

function normaliseEvidenceFamilyStatus(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value === true) return 'complete';
  if (value === false) return 'not_extracted';
  return 'unknown';
}

function familyCoverageStatus(args: { family: string; coverage: Record<string, unknown> | null; statusById: Record<string, unknown> | null }): 'complete' | 'not_applicable' | 'partial' | 'missing' {
  const coverageValue = args.coverage?.[args.family];
  const status = normaliseEvidenceFamilyStatus(args.statusById?.[args.family] ?? coverageValue);
  if (status === 'not_applicable' || coverageValue === 'not_applicable') return 'not_applicable';
  if (status === 'complete' || status === 'sufficient' || (coverageValue === true && status === 'unknown')) return 'complete';
  if (status === 'partial' || coverageValue === 'partial') return 'partial';
  return 'missing';
}

function unsupportedEvidenceFamilyBlocker(item: Record<string, unknown>): string | null {
  const haystack = `${String(item.evidence_kind ?? '')} ${String(item.reason ?? '')} ${String(item.status ?? '')}`.toLowerCase();
  if (haystack.includes('candidate_technique') || haystack.includes('technique')) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.candidate_technique;
  if (haystack.includes('video')) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.video;
  if (haystack.includes('audio')) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.audio;
  if (haystack.includes('material')) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.material;
  if (haystack.includes('performance')) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.performance;
  return null;
}

function safeUnsupportedEvidenceForAnchorHandoff(value: unknown): Array<Record<string, unknown>> {
  return safeRecordArray(value).map((item, index) => ({
    evidence_kind: typeof item.evidence_kind === 'string' && item.evidence_kind.trim()
      ? item.evidence_kind.trim()
      : `unsupported_or_unavailable_evidence_${index + 1}`,
    status: typeof item.status === 'string' && item.status.trim() ? item.status.trim() : 'unavailable',
    blocker_codes: getStringArray(item.blocker_codes),
  }));
}

function evaluateEvidenceAnchorAggregateGate(args: { anchors: Array<Record<string, unknown>>; analysisEvidenceState: Record<string, unknown> | null }): EvidenceAnchorAggregateGateEvaluation {
  const anchors = args.anchors.filter((anchor) => anchor.excluded_from_evidence_anchor_gate !== true);
  const excludedLegacyDiagnosticAnchorCount = args.anchors.filter((anchor) => anchor.excluded_from_evidence_anchor_gate === true && anchor.source_family === 'legacy_adapter').length;
  const analysisEvidenceState = args.analysisEvidenceState;
  const realRuntimeAnchorCount = anchors.filter((a) => a.source_family === 'real_runtime_v3').length;
  const blockedRealRuntimeAnchorCount = anchors.filter((a) => a.source_family === 'real_runtime_v3_blocked').length;
  const legacyAdapterAnchorCount = anchors.filter((a) => a.source_family === 'legacy_adapter').length;
  const sourceScaffoldAnchorCount = anchors.filter((a) => ['source_scaffold', 'helper_test', 'local_file_fixture'].includes(String(a.source_family ?? a.source_classification ?? ''))).length;
  const reportSnapshotAnchorCount = anchors.filter((a) => a.source_artefact_id === 'raw_report' || String(a.source_path ?? '').startsWith('report_data')).length;
  const blockedAnchorCount = anchors.filter((a) => a.cannot_satisfy_v3_gate === true).length;
  const unsupported = isRecord(analysisEvidenceState) ? safeRecordArray(analysisEvidenceState.unsupported_or_unavailable_evidence) : [];
  const unsupportedBlockerCodes = unsupported.flatMap((item) => Array.isArray(item.blocker_codes) ? item.blocker_codes.filter((x): x is string => typeof x === 'string') : []);
  const unsupportedFamilyBlockers = unsupported.map(unsupportedEvidenceFamilyBlocker).filter((x): x is string => typeof x === 'string');
  const anchorBlockers = anchors.flatMap((anchor) => Array.isArray(anchor.blocker_codes) ? anchor.blocker_codes.filter((x): x is string => typeof x === 'string') : []);
  const coverage = isRecord(analysisEvidenceState?.evidence_family_coverage) ? analysisEvidenceState.evidence_family_coverage : null;
  const statusById = isRecord(analysisEvidenceState?.evidence_family_status_by_id) ? analysisEvidenceState.evidence_family_status_by_id : null;
  const familyCoverageBlockers = Object.entries(REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS).flatMap(([family, blocker]) => {
    const status = familyCoverageStatus({ family, coverage, statusById });
    if (status === 'complete' || status === 'not_applicable') return [];
    return status === 'partial' ? ['partial_step1_evidence_coverage'] : [blocker];
  });
  const mixedRealAndLegacy = realRuntimeAnchorCount > 0 && legacyAdapterAnchorCount > 0;
  const analysisEvidenceStateComplete = analysisEvidenceState?.source_classification === 'real_runtime_v3'
    && analysisEvidenceState?.evidence_state_status === 'complete'
    && analysisEvidenceState?.cannot_satisfy_v3_gate !== true;
  const blockers = dedupePreservingOrder([
    ...(legacyAdapterAnchorCount > 0 ? ['legacy_snapshot_insufficient_for_v3_evidence_anchor_gate'] : []),
    ...(mixedRealAndLegacy ? ['mixed_real_and_legacy_non_satisfying', 'mixed_evidence_anchor_source_families'] : []),
    ...(reportSnapshotAnchorCount > 0 || anchorBlockers.includes('forbidden_report_snapshot_source_ref') ? ['forbidden_raw_report_anchor_source'] : []),
    ...(sourceScaffoldAnchorCount > 0 ? ['source_scaffold_not_gate_evidence'] : []),
    ...(blockedRealRuntimeAnchorCount > 0 ? ['blocked_real_runtime_evidence_anchor_present'] : []),
    ...(blockedAnchorCount > 0 ? ['anchor_cannot_satisfy_v3_gate'] : []),
    ...(anchorBlockers.includes('analysis_evidence_state_source_path_unresolved') ? ['unresolved_source_path'] : []),
    ...(anchorBlockers.includes('missing_truth_state_linkage') ? ['missing_truth_state_linkage'] : []),
    ...familyCoverageBlockers,
    ...unsupportedFamilyBlockers,
    ...(realRuntimeAnchorCount > 0 && unsupported.length > 0 ? ['analysis_evidence_state_partial_runtime_facts_only'] : []),
    ...unsupportedBlockerCodes,
  ]);
  const allAnchorsSatisfyingRealRuntime = anchors.length > 0
    && realRuntimeAnchorCount === anchors.length
    && blockedRealRuntimeAnchorCount === 0
    && legacyAdapterAnchorCount === 0
    && sourceScaffoldAnchorCount === 0
    && reportSnapshotAnchorCount === 0
    && blockedAnchorCount === 0;
  const coverageComplete = !blockers.some((code) => [
    'partial_step1_evidence_coverage',
    ...Object.values(REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS),
  ].includes(code));
  const evidenceAnchorGateStatus: EvidenceAnchorAggregateGateStatus = allAnchorsSatisfyingRealRuntime && analysisEvidenceStateComplete && coverageComplete
    ? 'sufficient'
    : 'insufficient';
  const sourceClassification = evidenceAnchorGateStatus === 'sufficient'
    ? 'real_runtime_v3'
    : (mixedRealAndLegacy
      ? 'mixed_real_and_legacy_non_satisfying'
      : (realRuntimeAnchorCount > 0 || blockedRealRuntimeAnchorCount > 0
        ? 'real_runtime_v3_partial_non_satisfying'
        : (sourceScaffoldAnchorCount > 0 ? 'source_scaffold' : 'legacy_adapter')));
  const gateReason = (() => {
    if (evidenceAnchorGateStatus === 'sufficient') return 'real_runtime_v3_analysis_evidence_state_anchors_complete';
    if (blockers.includes('forbidden_raw_report_anchor_source')) return 'forbidden_raw_report_anchor_source';
    if (blockers.includes('mixed_real_and_legacy_non_satisfying')) return 'mixed_real_and_legacy_non_satisfying';
    if (blockers.includes('source_scaffold_not_gate_evidence')) return 'source_scaffold_not_gate_evidence';
    if (blockers.includes('unresolved_source_path')) return 'unresolved_source_path';
    const missingFamilyBlocker = blockers.find((code) => code.startsWith('missing_') && code !== 'missing_truth_state_linkage');
    if (missingFamilyBlocker) return missingFamilyBlocker;
    if (blockers.includes('partial_step1_evidence_coverage')) return 'partial_step1_evidence_coverage';
    if (blockers.includes('missing_truth_state_linkage')) return 'missing_truth_state_linkage';
    return realRuntimeAnchorCount > 0 ? 'partial_runtime_facts_present_but_performance_extractor_unavailable' : 'legacy_report_snapshot_only';
  })();
  return {
    evidenceAnchorGateStatus,
    sourceClassification,
    gateReason,
    blockerCodes: blockers,
    realRuntimeAnchorCount,
    blockedRealRuntimeAnchorCount,
    legacyAdapterAnchorCount,
    reportSnapshotAnchorCount,
    sourceScaffoldAnchorCount,
    blockedAnchorCount,
    excludedLegacyDiagnosticAnchorCount,
  };
}

export async function emitEvidenceAnchorsFirstPass(input: EvidenceAnchorsEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted: false as const, emitted_artefact_ids: [] as string[], source_classification: 'missing' as const, level2_satisfies: false as const };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const generatedAt = new Date().toISOString();
  const reportData = unwrapRawReportData(input.raw_report_data);
  const timestampedNotes = Array.isArray(reportData.timestamped_notes) ? reportData.timestamped_notes : [];
  const anchors: Array<Record<string, unknown>> = [];
  const legacyDiagnosticAnchors: Array<Record<string, unknown>> = [];
  const analysisEvidenceState = isRecord(input.analysis_evidence_state_data) ? input.analysis_evidence_state_data : null;
  if (analysisEvidenceState) {
    const sourceRunIdMatches = analysisEvidenceState.run_id === input.run_id && analysisEvidenceState.analysis_run_id === analysisRunId;
    if (sourceRunIdMatches) {
      const observableItems = Array.isArray(analysisEvidenceState.observable_evidence_items) ? analysisEvidenceState.observable_evidence_items : [];
      observableItems.forEach((item, index) => {
        if (!isRecord(item)) return;
        const sourcePath = typeof item.analysis_evidence_state_source_path === 'string'
          ? item.analysis_evidence_state_source_path
          : `observable_evidence_items[${index}]`;
        anchors.push(buildAnalysisEvidenceAnchor({ source: analysisEvidenceState, sourcePath, item, index: anchors.length, input, analysisRunId, generatedAt }));
      });
      const componentItems = Array.isArray(analysisEvidenceState.component_evidence) ? analysisEvidenceState.component_evidence : [];
      componentItems.forEach((item, index) => {
        if (!isRecord(item)) return;
        anchors.push(buildAnalysisEvidenceAnchor({
          source: analysisEvidenceState,
          sourcePath: `component_evidence[${index}]`,
          item: {
            ...item,
            evidence_modality: 'submission_context',
            timestamp: null,
            timestamp_range: null,
            timestamp_source: 'not_timestamped_runtime_metadata',
            linked_truth_state_ids: [],
            public_display_status: 'internal_only',
          },
          index: anchors.length,
          input,
          analysisRunId,
          generatedAt,
        }));
      });
      const briefItems = Array.isArray(analysisEvidenceState.candidate_brief_evidence) ? analysisEvidenceState.candidate_brief_evidence : [];
      briefItems.forEach((item, index) => {
        if (!isRecord(item)) return;
        anchors.push(buildAnalysisEvidenceAnchor({
          source: analysisEvidenceState,
          sourcePath: `candidate_brief_evidence[${index}]`,
          item: {
            ...item,
            evidence_modality: item.evidence_kind === 'material_presence' ? 'material' : 'submission_context',
            timestamp: null,
            timestamp_range: null,
            timestamp_source: 'not_timestamped_resolver_fact',
            linked_truth_state_ids: [],
            public_display_status: 'internal_only',
          },
          index: anchors.length,
          input,
          analysisRunId,
          generatedAt,
        }));
      });
    }
  }
  const buildLegacyTimestampAnchor = (item: unknown, originalIndex: number): Record<string, unknown> | null => {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const ts = typeof row.timestamp === 'string' ? row.timestamp : (typeof row.time === 'string' ? row.time : null);
    const note = getTimestampedNoteText(row);
    const textField = getTimestampedNoteTextField(row);
    if (!note || !textField) return null;
    return {
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
      linked_truth_state_ids: [],
      claim_supported: false,
      evidence_text: note,
      confidence_or_strength: null,
      assessability_limitations: ['legacy_report_snapshot_not_v3_multimodal'],
      public_safe: true,
      cannot_satisfy_v3_gate: true,
      blocker_codes: ['legacy_snapshot_insufficient_for_v3_evidence_anchor_gate', 'missing_truth_state_linkage'],
    };
  };
  const hasRuntimeAnchorsForGate = anchors.some((anchor) => ['real_runtime_v3', 'real_runtime_v3_blocked'].includes(String(anchor.source_family ?? anchor.source_classification ?? '')));
  timestampedNotes.forEach((item, originalIndex) => {
    const legacyAnchor = buildLegacyTimestampAnchor(item, originalIndex);
    if (!legacyAnchor) return;
    if (hasRuntimeAnchorsForGate) {
      legacyDiagnosticAnchors.push({
        ...legacyAnchor,
        evidence_anchor_id: `legacy-diagnostic-${input.take_id}-${legacyDiagnosticAnchors.length + 1}`,
        excluded_from_evidence_anchor_gate: true,
        diagnostic_only: true,
      });
      return;
    }
    anchors.push(legacyAnchor);
  });
  if (anchors.length === 0) return { written: false as const, emitted: false as const, emitted_artefact_ids: [] as string[], source_classification: 'missing' as const, level2_satisfies: false as const, anchors: [] as Array<Record<string, unknown>> };
  const aggregateGate = evaluateEvidenceAnchorAggregateGate({ anchors: [...anchors, ...legacyDiagnosticAnchors], analysisEvidenceState });
  const {
    evidenceAnchorGateStatus,
    sourceClassification,
    gateReason,
    blockerCodes: blocker_codes,
    realRuntimeAnchorCount,
    legacyAdapterAnchorCount,
    reportSnapshotAnchorCount,
    blockedAnchorCount,
    excludedLegacyDiagnosticAnchorCount,
  } = aggregateGate;
  const promotedSourceArtefactForAnchor = (anchor: Record<string, unknown>): string => {
    if (anchor.source_artefact_id !== 'analysis_evidence_state') return '';
    const sourceItem = readJsonPath(analysisEvidenceState, String(anchor.source_path ?? ''));
    return isRecord(sourceItem) && typeof sourceItem.source_artefact_id === 'string' ? sourceItem.source_artefact_id : '';
  };
  const evidenceAnchorTraceSummary = {
    anchor_count: anchors.length,
    real_runtime_anchor_count: realRuntimeAnchorCount,
    legacy_adapter_anchor_count: legacyAdapterAnchorCount,
    blocked_anchor_count: blockedAnchorCount,
    source_family_summary: {
      legacy_adapter: legacyAdapterAnchorCount,
      report_snapshot: reportSnapshotAnchorCount,
      real_runtime_v3: realRuntimeAnchorCount,
      input_artifact: anchors.filter((a) => ['analysis_submission', 'analysis_take'].includes(promotedSourceArtefactForAnchor(a))).length,
      resolver_truth_state: anchors.filter((a) => promotedSourceArtefactForAnchor(a) === 'truth_state_map').length,
    },
    diagnostic_source_family_summary: {
      legacy_adapter: excludedLegacyDiagnosticAnchorCount,
    },
    evidence_anchor_gate_status: evidenceAnchorGateStatus,
    evidence_anchor_gate_reason: gateReason,
    blocker_codes,
    legacy_diagnostic_anchor_count: excludedLegacyDiagnosticAnchorCount,
    excluded_legacy_anchor_count: excludedLegacyDiagnosticAnchorCount,
  };
  const payload = {
    schema_version: realRuntimeAnchorCount > 0 ? 'tapecoach_v3_evidence_anchors_runtime_v1' : 'tapecoach_v3_evidence_anchors_first_pass_v1',
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
    source_classification: sourceClassification,
    generated_at: generatedAt,
    anchor_count: anchors.length,
    anchors,
    legacy_diagnostic_anchor_count: legacyDiagnosticAnchors.length,
    excluded_legacy_anchor_count: legacyDiagnosticAnchors.length,
    legacy_diagnostic_anchors: legacyDiagnosticAnchors,
    excluded_legacy_anchors: legacyDiagnosticAnchors,
    legacy_adapter_anchor_count: legacyAdapterAnchorCount,
    report_snapshot_anchor_count: reportSnapshotAnchorCount,
    real_runtime_anchor_count: realRuntimeAnchorCount,
    timestamped_anchor_count: anchors.filter((a) => typeof a.timestamp === 'string' && a.timestamp.length > 0).length,
    cannot_satisfy_v3_evidence_anchor_gate: evidenceAnchorGateStatus !== 'sufficient',
    gate_satisfaction_reason: gateReason,
    blocker_codes,
    evidence_family_coverage: isRecord(analysisEvidenceState?.evidence_family_coverage) ? analysisEvidenceState.evidence_family_coverage : null,
    evidence_family_status_by_id: isRecord(analysisEvidenceState?.evidence_family_status_by_id) ? analysisEvidenceState.evidence_family_status_by_id : null,
    unsupported_or_unavailable_evidence: isRecord(analysisEvidenceState) ? safeUnsupportedEvidenceForAnchorHandoff(analysisEvidenceState.unsupported_or_unavailable_evidence) : [],
    evidence_anchor_trace_summary: evidenceAnchorTraceSummary,
    public_output_unchanged: true,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
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
    source_classification: sourceClassification,
    level2_satisfies: result.written && evidenceAnchorGateStatus === 'sufficient',
    evidence_anchor_trace_summary: evidenceAnchorTraceSummary,
    evidence_anchor_gate_status: evidenceAnchorGateStatus,
    evidence_anchor_gate_reason: gateReason,
    evidence_anchor_source_family_summary: evidenceAnchorTraceSummary.source_family_summary,
    legacy_diagnostic_anchor_count: legacyDiagnosticAnchors.length,
    excluded_legacy_anchor_count: legacyDiagnosticAnchors.length,
    evidence_family_coverage: payload.evidence_family_coverage,
    evidence_family_status_by_id: payload.evidence_family_status_by_id,
    unsupported_or_unavailable_evidence: payload.unsupported_or_unavailable_evidence,
    blocker_codes,
    cannot_satisfy_v3_gate: payload.cannot_satisfy_v3_evidence_anchor_gate,
    warning: result.warning ?? null,
    anchors,
    legacy_diagnostic_anchors: legacyDiagnosticAnchors,
    excluded_legacy_anchors: legacyDiagnosticAnchors,
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

type ClaimCandidateSourceFamily = 'real_runtime_v3' | 'legacy_adapter' | 'report_candidate_requires_support' | 'first_pass_internal' | 'blocked';

const CLAIM_CANDIDATE_UNSAFE_TEXT_PATTERN = /(https?:\/\/|signed[_-]?url|playback[_-]?url|video[_-]?url|authorization|api[_-]?key|session|cookie|secret|token|x-amz-|signature=)/i;
const TECHNIQUE_AUTHORITY_CLAIM_PATTERN = /(technique authority|public technique authority|authoritative technique|authoritative diagnosis|named technique|meisner|stanislavski|viewpoints|alexander technique|uta hagen)/i;
const CASTING_MARKET_CLAIM_PATTERN = /(castability|castable|bookability|bookable|marketability|marketable|casting fit|commercial fit|market fit|buyer fit)/i;
const COMPARISON_PUBLIC_RESULT_CLAIM_PATTERN = /(winner|recommend(?:ed|ation)?|best take|preferred take|select take|submit take\s*\d|take\s*\d\s+(?:wins|over|beats))/i;
const ROLE_BRIEF_FIT_OVERCLAIM_PATTERN = /(role[-\s]*fit|brief[-\s]*fit|fits? the brief|perfect match|perfectly suits|well aligned|casting suitability|submit with confidence|send with confidence)/i;

function safeCandidateSummary(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null;
  const raw = String(value).trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  if (CLAIM_CANDIDATE_UNSAFE_TEXT_PATTERN.test(raw)) return '[redacted unsafe candidate summary]';
  return raw.slice(0, 280);
}

function pickSafeRecordText(value: Record<string, unknown>): string | null {
  for (const key of ['safe_candidate_summary', 'safe_evidence_summary', 'evidence_text', 'summary', 'status', 'value', 'label', 'reason', 'note', 'text', 'observation']) {
    const text = safeCandidateSummary(value[key]);
    if (text) return text;
  }
  return null;
}

function claimFamilyForRuntimeEvidence(item: Record<string, unknown>): string {
  const kind = String(item.evidence_kind ?? item.component_id ?? '').toLowerCase();
  const modality = String(item.evidence_modality ?? '').toLowerCase();
  if (/unavailable|limitation|not_extracted|blocked|unknown/.test(kind)) return 'assessability_limitation';
  if (/media|audio|video|duration|framing|lighting|visibility|intelligibility|volume|noise|crop/.test(kind) || ['media_readiness', 'audio', 'video'].includes(modality)) return 'technical_media';
  if (/brief|material|component|task/.test(kind)) return 'factual_status';
  if (/selected_level|audition_type|stable_take_identity|submission|take_identity/.test(kind)) return 'factual_status';
  if (/truth|resolver/.test(kind)) return 'factual_status';
  return 'factual_status';
}

function classifyClaimCandidateSafety(args: { text: string; claimType: string; claimFamily: string; sourcePath: string }) {
  const scoreMeta = classifyNumericOrScoreClaim({ claimType: args.claimType, sourcePath: args.sourcePath, claimText: args.text });
  const blockers: string[] = [];
  if (scoreMeta.is_score_claim) {
    blockers.push('public_scoring_blocked');
    return { score_scope: scoreMeta.score_scope, public_safety_status: 'blocked', rewrite_required: true, blocked_claim_category: 'public_scoring', blocker_codes: blockers };
  }
  if (TECHNIQUE_AUTHORITY_CLAIM_PATTERN.test(args.text) || args.claimFamily === 'technique_authority') {
    blockers.push('public_technique_authority_blocked');
    return { score_scope: 'not_score', public_safety_status: 'blocked', rewrite_required: true, blocked_claim_category: 'public_technique_authority', blocker_codes: blockers };
  }
  if (CASTING_MARKET_CLAIM_PATTERN.test(args.text) || args.claimFamily === 'castability_bookability_marketability') {
    blockers.push('castability_bookability_marketability_blocked');
    return { score_scope: 'not_score', public_safety_status: 'blocked', rewrite_required: true, blocked_claim_category: 'castability_bookability_marketability', blocker_codes: blockers };
  }
  if (COMPARISON_PUBLIC_RESULT_CLAIM_PATTERN.test(args.text) || args.claimFamily === 'comparison_public_result') {
    blockers.push('public_comparison_result_blocked');
    return { score_scope: 'not_score', public_safety_status: 'blocked', rewrite_required: true, blocked_claim_category: 'public_comparison_result', blocker_codes: blockers };
  }
  if (ROLE_BRIEF_FIT_OVERCLAIM_PATTERN.test(args.text) || OVERCLAIM_PATTERN.test(args.text)) {
    blockers.push('unsupported_overclaim_requires_rewrite');
    return { score_scope: 'not_score', public_safety_status: 'needs_rewrite', rewrite_required: true, blocked_claim_category: 'role_or_brief_fit_overclaim', blocker_codes: blockers };
  }
  if (GENERIC_PRAISE_PATTERN.test(args.text)) {
    blockers.push('generic_phrase_unanchored');
    return { score_scope: 'not_score', public_safety_status: 'needs_rewrite', rewrite_required: true, blocked_claim_category: 'unsupported_praise', blocker_codes: blockers };
  }
  return { score_scope: 'not_score', public_safety_status: 'safe_for_public_candidate', rewrite_required: false, blocked_claim_category: null, blocker_codes: blockers };
}

function inferLegacyClaimFamily(sourcePath: string, text: string, claimType: string): string {
  if (classifyNumericOrScoreClaim({ claimType, sourcePath, claimText: text }).is_score_claim) return 'score_or_verdict';
  if (/casting|market|book|castability|bookability|marketability/i.test(sourcePath) || CASTING_MARKET_CLAIM_PATTERN.test(text)) return 'castability_bookability_marketability';
  if (/comparison|winner|recommend/i.test(sourcePath) || COMPARISON_PUBLIC_RESULT_CLAIM_PATTERN.test(text)) return 'comparison_public_result';
  if (/fix_first|next_take|priority/i.test(sourcePath)) return 'priority_fix';
  if (/strength|preserve/i.test(sourcePath)) return 'preserve_strength';
  if (/category_notes|category_rationale|timestamped_notes/i.test(sourcePath)) return 'readiness_status';
  if (/brief/i.test(sourcePath)) return 'brief_task_status';
  return claimType === 'role_or_brief_fit' ? 'role_or_brief_fit_overclaim' : claimType;
}

function summarizeClaimCandidateSources(candidates: Array<Record<string, unknown>>) {
  return candidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = String(candidate.source_family ?? 'unknown');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {
    real_runtime_v3: 0,
    legacy_adapter: 0,
    report_candidate_requires_support: 0,
    first_pass_internal: 0,
    blocked: 0,
  });
}

function sourceClassificationForClaimCandidates(sourceSummary: Record<string, number>): string {
  const realCount = sourceSummary.real_runtime_v3 ?? 0;
  const legacyCount = sourceSummary.legacy_adapter ?? 0;
  const reportCandidateCount = sourceSummary.report_candidate_requires_support ?? 0;
  const firstPassCount = sourceSummary.first_pass_internal ?? 0;
  if (realCount > 0 && legacyCount === 0 && reportCandidateCount === 0 && firstPassCount === 0) return 'real_runtime_v3_candidate_source';
  if (realCount > 0) return 'mixed_real_runtime_v3_and_legacy_or_unsupported';
  if (legacyCount > 0) return 'legacy_or_unsupported';
  if (reportCandidateCount > 0) return 'report_candidate_requires_support';
  if (firstPassCount > 0) return 'first_pass_internal';
  return 'unavailable';
}

type PublicClaimSupportStatus =
  | 'supported'
  | 'partially_supported'
  | 'missing_evidence'
  | 'missing_truth_link'
  | 'blocked'
  | 'rewrite_required'
  | 'unsupported_overclaim'
  | 'legacy_or_unsupported'
  | 'not_applicable';

function getTraceClaimCandidates(value: unknown): Array<Record<string, unknown>> {
  if (!isRecord(value)) return [];
  return safeRecordArray(value.claim_candidates);
}

function getNonBlankString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function identityFieldMismatch(value: unknown, expected: string): boolean {
  const actual = getNonBlankString(value);
  return Boolean(actual && actual !== expected);
}

function validateTraceIdentityForCurrentRun(traceData: unknown, input: {
  run_id: string;
  analysis_run_id: string;
  take_id: string;
  artefact_type: 'claim_candidate_trace';
}): { ok: boolean; blockerCodes: string[] } {
  if (!isRecord(traceData)) return { ok: false, blockerCodes: [`${input.artefact_type}_identity_missing`] };
  const blockerCodes: string[] = [];
  const traceRunId = getNonBlankString(traceData.run_id);
  const traceAnalysisRunId = getNonBlankString(traceData.analysis_run_id);
  const traceTakeId = getNonBlankString(traceData.take_id);
  if (!traceRunId || !traceAnalysisRunId) blockerCodes.push(`${input.artefact_type}_identity_missing`);
  if (traceRunId && traceRunId !== input.run_id) blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  if (traceAnalysisRunId && traceAnalysisRunId !== input.analysis_run_id) blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  if (traceTakeId && traceTakeId !== input.take_id) blockerCodes.push(`${input.artefact_type}_identity_mismatch`);

  const candidates = getTraceClaimCandidates(traceData);
  const candidateHasMismatch = candidates.some((candidate) => {
    return [
      ['run_id', input.run_id],
      ['source_run_id', input.run_id],
      ['candidate_run_id', input.run_id],
      ['analysis_run_id', input.analysis_run_id],
      ['source_analysis_run_id', input.analysis_run_id],
      ['candidate_analysis_run_id', input.analysis_run_id],
      ['take_id', input.take_id],
      ['source_take_id', input.take_id],
      ['candidate_take_id', input.take_id],
    ].some(([key, expected]) => identityFieldMismatch(candidate[key], expected));
  });
  if (candidateHasMismatch) blockerCodes.push(`${input.artefact_type}_candidate_identity_mismatch`);
  const uniqueBlockers = dedupePreservingOrder(blockerCodes);
  return { ok: uniqueBlockers.length === 0, blockerCodes: uniqueBlockers };
}

function validateSupportTraceIdentityForCurrentRun(value: unknown, input: {
  run_id: string;
  analysis_run_id: string;
  take_id: string;
  artefact_type: 'evidence_anchors' | 'truth_state_map';
}): { ok: boolean; blockerCodes: string[] } {
  if (!isRecord(value)) return { ok: true, blockerCodes: [] };
  const blockerCodes: string[] = [];
  if (identityFieldMismatch(value.run_id, input.run_id)) blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  if (identityFieldMismatch(value.analysis_run_id, input.analysis_run_id)) blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  if (identityFieldMismatch(value.take_id, input.take_id)) blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  const uniqueBlockers = dedupePreservingOrder(blockerCodes);
  return { ok: uniqueBlockers.length === 0, blockerCodes: uniqueBlockers };
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function normaliseSafeLimitationItems(value: unknown): Array<{
  safe_summary: string;
  source_index: number;
  source_kind: 'string' | 'record';
  blocker_codes: string[];
}> {
  const items = Array.isArray(value) ? value : (value === null || value === undefined ? [] : [value]);
  return items.flatMap((item, index): Array<{
    safe_summary: string;
    source_index: number;
    source_kind: 'string' | 'record';
    blocker_codes: string[];
  }> => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const summary = safeCandidateSummary(item);
      if (!summary) return [];
      return [{
        safe_summary: summary,
        source_index: index,
        source_kind: 'string' as const,
        blocker_codes: summary === '[redacted unsafe candidate summary]' ? ['unsafe_limitation_summary_redacted'] : [],
      }];
    }
    if (!isRecord(item)) return [];
    const summary = pickSafeRecordText(item);
    if (!summary) return [];
    return [{
      safe_summary: summary,
      source_index: index,
      source_kind: 'record' as const,
      blocker_codes: getStringArray(item.blocker_codes),
    }];
  });
}

function getEvidenceAnchorId(anchor: Record<string, unknown>): string | null {
  const id = anchor.evidence_anchor_id ?? anchor.anchor_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function buildEvidenceAnchorSupportIndex(anchors: Array<Record<string, unknown>>) {
  const byId = new Map<string, Record<string, unknown>>();
  for (const anchor of anchors) {
    const id = getEvidenceAnchorId(anchor);
    if (id) byId.set(id, anchor);
  }
  return byId;
}

function isRealRuntimeEvidenceAnchor(anchor: Record<string, unknown> | undefined): anchor is Record<string, unknown> {
  if (!anchor) return false;
  const sourceFamily = String(anchor.source_family ?? '');
  const sourceClassification = String(anchor.source_classification ?? '');
  return (sourceFamily === 'real_runtime_v3' || sourceClassification === 'real_runtime_v3') && anchor.cannot_satisfy_v3_gate !== true;
}

function findSameRunAnchorIdsForAnalysisEvidencePath(anchors: Array<Record<string, unknown>>, sourcePath: string): string[] {
  if (!sourcePath) return [];
  return dedupePreservingOrder(anchors.flatMap((anchor) => {
    if (!isRealRuntimeEvidenceAnchor(anchor)) return [];
    const anchorSourcePath = typeof anchor.source_path === 'string' ? anchor.source_path : '';
    const analysisSourcePath = typeof anchor.analysis_evidence_state_source_path === 'string' ? anchor.analysis_evidence_state_source_path : '';
    if (anchor.source_artefact_id !== 'analysis_evidence_state') return [];
    if (anchorSourcePath !== sourcePath && analysisSourcePath !== sourcePath) return [];
    const id = getEvidenceAnchorId(anchor);
    return id ? [id] : [];
  }));
}

function getEvidenceAnchorAggregateStatus(evidenceAnchorsData: unknown): 'sufficient' | 'insufficient' | 'missing' {
  if (!isRecord(evidenceAnchorsData)) return 'missing';
  const summary = isRecord(evidenceAnchorsData.evidence_anchor_trace_summary) ? evidenceAnchorsData.evidence_anchor_trace_summary : {};
  const status = String(summary.evidence_anchor_gate_status ?? evidenceAnchorsData.evidence_anchor_gate_status ?? '');
  return status === 'sufficient' ? 'sufficient' : 'insufficient';
}

function isScalarTruthToken(value: unknown): value is string | number {
  return (typeof value === 'string' && value.trim().length > 0) || (typeof value === 'number' && Number.isFinite(value));
}

function collectScalarTruthTokens(value: unknown, out: Set<string>) {
  if (isScalarTruthToken(value)) {
    out.add(String(value).trim());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (isScalarTruthToken(item)) out.add(String(item).trim());
    });
  }
}

function isExplicitTruthIdField(key: string): boolean {
  return /^(truth_state_id|truth_state_ids|canonical_truth_state_id|canonical_truth_state_ids|known_truth_ids|brief_truth_ids|component_truth_ids|comparison_truth_ids)$/i.test(key);
}

function isCanonicalTruthStateMapKey(key: string): boolean {
  const trimmed = key.trim();
  return /^[A-Za-z0-9._-]+:truth_state:[A-Za-z0-9._:-]+$/.test(trimmed) || /^truth-state-[A-Za-z0-9._:-]+$/.test(trimmed);
}

function isTruthStateRecord(value: Record<string, unknown>): boolean {
  return [
    'truth_state',
    'truth_state_type',
    'truth_state_family',
    'truth_family',
    'truth_value',
    'truth_state_status',
    'canonical_truth_state_id',
    'canonical_truth_state_ids',
    'truth_state_id',
    'truth_state_ids',
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function collectTruthStateTokens(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTruthStateTokens(item, out));
    return out;
  }
  if (!isRecord(value)) return out;

  const truthStateRecord = isTruthStateRecord(value);
  for (const [key, item] of Object.entries(value)) {
    if (isCanonicalTruthStateMapKey(key)) out.add(key.trim());
    if (isExplicitTruthIdField(key) || (key === 'id' && truthStateRecord)) {
      collectScalarTruthTokens(item, out);
    }
    collectTruthStateTokens(item, out);
  }
  return out;
}

function truthStateIdResolves(truthStateMap: unknown, truthStateId: string): boolean {
  if (!truthStateId || !isRecord(truthStateMap)) return false;
  return collectTruthStateTokens(truthStateMap).has(truthStateId);
}

function publicClaimRequiresTruth(candidate: Record<string, unknown>): boolean {
  const requirement = String(candidate.required_truth_state_family ?? '');
  if (!requirement || requirement.startsWith('not_required')) return false;
  return true;
}

function isCandidateRequiredForPublicClaimGate(candidate: Record<string, unknown>): boolean {
  if (candidate.excluded_from_public_claim_gate === true) return false;
  if (candidate.public_claim_support_required === false) return false;
  if (candidate.required_for_public_claim_gate === false) return false;
  if (String(candidate.candidate_support_precheck_status ?? '') === 'not_applicable') return false;
  return true;
}

function isLimitationClaimFamily(claimFamily: string, claimType: string): boolean {
  return claimFamily === 'assessability_limitation' || claimType === 'assessability_limitation';
}

function normalizeCandidateBlockedCategory(category: unknown): string | null {
  return typeof category === 'string' && category.trim() ? category.trim() : null;
}

function classifyPublicClaimSupportFromCandidates(input: {
  run_id: string;
  analysis_run_id: string;
  take_id: string;
  candidates: Array<Record<string, unknown>>;
  evidence_anchors_data?: EvidenceAnchorsSupportData | null;
  truth_state_map_data?: Record<string, unknown> | null;
}) {
  const evidenceAnchorsIdentity = validateSupportTraceIdentityForCurrentRun(input.evidence_anchors_data, {
    run_id: input.run_id,
    analysis_run_id: input.analysis_run_id,
    take_id: input.take_id,
    artefact_type: 'evidence_anchors',
  });
  const truthStateMapIdentity = validateSupportTraceIdentityForCurrentRun(input.truth_state_map_data, {
    run_id: input.run_id,
    analysis_run_id: input.analysis_run_id,
    take_id: input.take_id,
    artefact_type: 'truth_state_map',
  });
  const supportIdentityBlockers = dedupePreservingOrder([
    ...evidenceAnchorsIdentity.blockerCodes,
    ...truthStateMapIdentity.blockerCodes,
  ]);
  const anchors = evidenceAnchorsIdentity.ok ? safeRecordArray(input.evidence_anchors_data?.anchors) : [];
  const truthStateMapData = truthStateMapIdentity.ok ? input.truth_state_map_data : null;
  const anchorById = buildEvidenceAnchorSupportIndex(anchors);
  const evidenceAnchorGateStatus = evidenceAnchorsIdentity.ok ? getEvidenceAnchorAggregateStatus(input.evidence_anchors_data) : 'insufficient';
  const claims = input.candidates.map((candidate, index) => {
    const candidateSummary = safeCandidateSummary(candidate.safe_candidate_summary ?? candidate.candidate_text ?? candidate.claim_text ?? candidate.summary) ?? '[redacted unsafe candidate summary]';
    const claimType = String(candidate.claim_type ?? 'unknown');
    const claimFamily = String(candidate.claim_family ?? claimType);
    const sourceFamily = String(candidate.source_family ?? 'legacy_or_unsupported');
    const sourceArtefactId = String(candidate.source_artefact_id ?? 'unknown');
    const sourcePath = String(candidate.source_path ?? '');
    const linkedEvidenceAnchorIds = getStringArray(candidate.linked_evidence_anchor_ids);
    const linkedTruthStateIds = getStringArray(candidate.linked_truth_state_ids);
    const safety = classifyClaimCandidateSafety({ text: candidateSummary, claimType, claimFamily, sourcePath });
    const candidateSafetyStatus = String(candidate.public_safety_status ?? safety.public_safety_status);
    const candidateBlockedCategory = normalizeCandidateBlockedCategory(candidate.blocked_claim_category ?? safety.blocked_claim_category);
    const isLegacyOrRaw = sourceFamily === 'legacy_adapter' || sourceFamily === 'legacy_or_unsupported' || sourceArtefactId === 'raw_report' || sourcePath.startsWith('report_data.');
    const linkedAnchors = linkedEvidenceAnchorIds.map((id) => anchorById.get(id));
    const realLinkedAnchors = linkedAnchors.filter(isRealRuntimeEvidenceAnchor);
    const hasUnresolvedAnchor = linkedEvidenceAnchorIds.some((id) => !anchorById.has(id));
    const requiresTruth = publicClaimRequiresTruth(candidate);
    const hasMissingTruth = requiresTruth && (linkedTruthStateIds.length === 0 || linkedTruthStateIds.some((id) => !truthStateIdResolves(truthStateMapData, id)));
    const isLimitationClaim = isLimitationClaimFamily(claimFamily, claimType);
    const candidateRequiredForGate = isCandidateRequiredForPublicClaimGate(candidate);
    const blockerCodes: string[] = [
      ...getStringArray(candidate.blocker_codes).filter((code) => code !== 'claim_candidate_trace_internal_only_not_public_claim_gate_evidence' && code !== 'public_claim_trace_not_promoted'),
      ...safety.blocker_codes,
      ...supportIdentityBlockers,
    ];
    let supportStatus: PublicClaimSupportStatus = 'supported';
    let publicSafetyStatus = candidateSafetyStatus;
    let rewriteRequired = candidate.rewrite_required === true;
    let blockedClaimCategory = candidateBlockedCategory;

    if (isLegacyOrRaw) {
      supportStatus = 'legacy_or_unsupported';
      rewriteRequired = true;
      blockerCodes.push('legacy_or_unsupported_claim_candidate_source');
    } else if (blockedClaimCategory === 'public_scoring') {
      supportStatus = 'blocked';
      publicSafetyStatus = 'blocked';
      rewriteRequired = true;
      blockerCodes.push('public_scoring_blocked');
    } else if (blockedClaimCategory === 'public_technique_authority') {
      supportStatus = 'blocked';
      publicSafetyStatus = 'blocked';
      rewriteRequired = true;
      blockerCodes.push('public_technique_authority_blocked');
    } else if (blockedClaimCategory === 'castability_bookability_marketability') {
      supportStatus = 'blocked';
      publicSafetyStatus = 'blocked';
      rewriteRequired = true;
      blockerCodes.push('castability_bookability_marketability_blocked');
    } else if (blockedClaimCategory === 'public_comparison_result') {
      supportStatus = 'blocked';
      publicSafetyStatus = 'blocked';
      rewriteRequired = true;
      blockerCodes.push('public_comparison_result_blocked');
    } else if (blockedClaimCategory === 'role_or_brief_fit_overclaim' || publicSafetyStatus === 'needs_rewrite' || publicSafetyStatus === 'unsafe_or_overclaim') {
      supportStatus = 'unsupported_overclaim';
      publicSafetyStatus = publicSafetyStatus === 'blocked' ? 'blocked' : 'needs_rewrite';
      rewriteRequired = true;
      blockedClaimCategory = blockedClaimCategory ?? 'role_or_brief_fit_overclaim';
      blockerCodes.push('unsupported_overclaim_requires_rewrite');
    } else if (!candidateRequiredForGate) {
      supportStatus = 'not_applicable';
      publicSafetyStatus = 'internal_only';
      rewriteRequired = false;
    } else if (linkedEvidenceAnchorIds.length === 0 || realLinkedAnchors.length === 0 || hasUnresolvedAnchor) {
      supportStatus = 'missing_evidence';
      blockerCodes.push('missing_evidence_anchor_support');
      if (linkedEvidenceAnchorIds.length > 0 && realLinkedAnchors.length === 0) blockerCodes.push('legacy_anchor_cannot_support_public_claim_gate');
      if (hasUnresolvedAnchor) blockerCodes.push('unresolved_evidence_anchor_link');
    } else if (hasMissingTruth) {
      supportStatus = 'missing_truth_link';
      blockerCodes.push('missing_truth_state_linkage');
    } else if (evidenceAnchorGateStatus !== 'sufficient' && !isLimitationClaim) {
      supportStatus = 'partially_supported';
      blockerCodes.push('evidence_anchor_aggregate_insufficient');
    }

    if (supportStatus !== 'supported') rewriteRequired = rewriteRequired || supportStatus === 'unsupported_overclaim' || supportStatus === 'blocked' || supportStatus === 'legacy_or_unsupported';
    if (supportStatus === 'supported' && publicSafetyStatus !== 'safe_for_public_candidate') publicSafetyStatus = publicSafetyStatus === 'internal_only' ? 'internal_only' : 'safe_for_public_candidate';
    const cannotSatisfy = candidateRequiredForGate && supportStatus !== 'supported';
    return {
      claim_id: typeof candidate.claim_candidate_id === 'string' ? candidate.claim_candidate_id.replace(/^cc-/, 'pc-') : `pc-${input.take_id}-${index + 1}`,
      safe_claim_summary: candidateSummary,
      claim_text: candidateSummary,
      claim_type: claimType,
      claim_family: claimFamily,
      source_artefact_id: sourceArtefactId,
      source_path: sourcePath,
      source_family: sourceFamily,
      linked_evidence_anchor_ids: linkedEvidenceAnchorIds,
      linked_truth_state_ids: linkedTruthStateIds,
      support_status: supportStatus,
      public_safety_status: publicSafetyStatus,
      rewrite_required: rewriteRequired,
      score_scope: String(candidate.score_scope ?? safety.score_scope),
      blocked_claim_category: blockedClaimCategory,
      blocker_codes: dedupePreservingOrder(blockerCodes),
      evidence_support_summary: realLinkedAnchors.length > 0
        ? { linked_real_runtime_v3_anchor_count: realLinkedAnchors.length, evidence_anchor_gate_status: evidenceAnchorGateStatus }
        : { linked_real_runtime_v3_anchor_count: 0, evidence_anchor_gate_status: evidenceAnchorGateStatus },
      truth_support_summary: {
        required: requiresTruth,
        linked_truth_state_count: linkedTruthStateIds.length,
        unresolved_truth_state_ids: requiresTruth ? linkedTruthStateIds.filter((id) => !truthStateIdResolves(truthStateMapData, id)) : [],
      },
      public_display_status: 'not_rendered_internal_trace',
      public_claim_support_required: candidateRequiredForGate,
      required_for_public_claim_gate: candidateRequiredForGate,
      excluded_from_public_claim_gate: !candidateRequiredForGate,
      cannot_satisfy_public_claim_gate: cannotSatisfy,
    };
  });
  const sourceSummary = claims.reduce<Record<string, number>>((acc, claim) => {
    const key = String(claim.source_family ?? 'unknown');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, { real_runtime_v3: 0, legacy_adapter: 0, legacy_or_unsupported: 0, report_candidate_requires_support: 0, first_pass_internal: 0 });
  const requiredClaims = claims.filter((claim) => claim.required_for_public_claim_gate !== false && claim.excluded_from_public_claim_gate !== true && claim.support_status !== 'not_applicable');
  const allSupported = requiredClaims.length > 0 && requiredClaims.every((claim) => claim.support_status === 'supported');
  const publicClaimGateStatus = allSupported ? 'sufficient' : 'insufficient';
  const hasLegacy = (sourceSummary.legacy_adapter ?? 0) > 0 || (sourceSummary.legacy_or_unsupported ?? 0) > 0 || claims.some((claim) => claim.source_artefact_id === 'raw_report' || String(claim.source_path).startsWith('report_data.'));
  const hasReal = (sourceSummary.real_runtime_v3 ?? 0) > 0;
  const requiredLegacyClaims = requiredClaims.filter((claim) => ['legacy_adapter', 'legacy_or_unsupported'].includes(String(claim.source_family)) || claim.source_artefact_id === 'raw_report' || String(claim.source_path).startsWith('report_data.'));
  const sourceClassification = publicClaimGateStatus === 'sufficient'
    ? 'real_runtime_v3_claim_support'
    : (hasReal && hasLegacy
      ? 'mixed_real_runtime_v3_and_legacy_or_unsupported'
      : (hasReal ? 'real_runtime_v3_partial_non_satisfying' : (hasLegacy ? 'legacy_or_unsupported' : 'first_pass_internal')));
  const blockerCodes = dedupePreservingOrder([
    ...(publicClaimGateStatus === 'sufficient' ? [] : ['public_claim_trace_support_incomplete']),
    ...(requiredLegacyClaims.length > 0 || (!hasReal && hasLegacy) ? ['legacy_or_unsupported_claim_candidate_source'] : []),
    ...supportIdentityBlockers,
    ...requiredClaims.flatMap((claim) => getStringArray(claim.blocker_codes)),
  ]);
  const reason = publicClaimGateStatus === 'sufficient'
    ? 'real_runtime_v3_claim_support_complete'
    : (blockerCodes.includes('missing_evidence_anchor_support')
      ? 'missing_evidence_anchor_support'
      : (blockerCodes.includes('missing_truth_state_linkage')
        ? 'missing_truth_state_linkage'
        : (!hasReal && hasLegacy ? 'legacy_or_unsupported_claim_support_only' : 'public_claim_support_incomplete')));
  return { claims, sourceSummary, sourceClassification, publicClaimGateStatus, publicClaimGateReason: reason, blockerCodes };
}

function classifyPublicClaimTraceIdentityRejected(input: {
  run_id: string;
  analysis_run_id: string;
  take_id: string;
  candidates: Array<Record<string, unknown>>;
  blockerCodes: string[];
}) {
  const blockers = dedupePreservingOrder(['public_claim_trace_support_incomplete', ...input.blockerCodes]);
  const claims = input.candidates.map((candidate, index) => {
    const candidateSummary = safeCandidateSummary(candidate.safe_candidate_summary ?? candidate.candidate_text ?? candidate.claim_text ?? candidate.summary) ?? '[redacted unsafe candidate summary]';
    return {
      claim_id: typeof candidate.claim_candidate_id === 'string' ? candidate.claim_candidate_id.replace(/^cc-/, 'pc-') : `pc-${input.take_id}-${index + 1}`,
      safe_claim_summary: candidateSummary,
      claim_text: candidateSummary,
      claim_type: String(candidate.claim_type ?? 'unknown'),
      claim_family: String(candidate.claim_family ?? candidate.claim_type ?? 'unknown'),
      source_artefact_id: String(candidate.source_artefact_id ?? 'claim_candidate_trace'),
      source_path: String(candidate.source_path ?? ''),
      source_family: String(candidate.source_family ?? 'first_pass_internal'),
      linked_evidence_anchor_ids: getStringArray(candidate.linked_evidence_anchor_ids),
      linked_truth_state_ids: getStringArray(candidate.linked_truth_state_ids),
      support_status: 'blocked' as PublicClaimSupportStatus,
      public_safety_status: 'blocked',
      rewrite_required: true,
      score_scope: String(candidate.score_scope ?? 'not_score'),
      blocked_claim_category: 'claim_candidate_trace_identity',
      blocker_codes: blockers,
      evidence_support_summary: { linked_real_runtime_v3_anchor_count: 0, evidence_anchor_gate_status: 'insufficient' },
      truth_support_summary: { required: publicClaimRequiresTruth(candidate), linked_truth_state_count: getStringArray(candidate.linked_truth_state_ids).length, unresolved_truth_state_ids: getStringArray(candidate.linked_truth_state_ids) },
      public_display_status: 'not_rendered_internal_trace',
      cannot_satisfy_public_claim_gate: true,
    };
  });
  const sourceSummary = claims.reduce<Record<string, number>>((acc, claim) => {
    const key = String(claim.source_family ?? 'unknown');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, { real_runtime_v3: 0, legacy_adapter: 0, legacy_or_unsupported: 0, report_candidate_requires_support: 0, first_pass_internal: 0 });
  return {
    claims,
    sourceSummary,
    sourceClassification: 'first_pass_internal',
    publicClaimGateStatus: 'insufficient' as const,
    publicClaimGateReason: input.blockerCodes.includes('claim_candidate_trace_identity_missing') ? 'claim_candidate_trace_identity_missing' : 'claim_candidate_trace_identity_mismatch',
    blockerCodes: blockers,
  };
}

export async function emitClaimCandidateTrace(input: ClaimCandidateTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const candidates: Array<Record<string, unknown>> = [];
  const rawReportData = unwrapRawReportData(input.raw_report_data);
  const analysisEvidenceState = isRecord(input.analysis_evidence_state_data) ? input.analysis_evidence_state_data : null;
  const anchors = safeRecordArray(input.evidence_anchors_data?.anchors);
  const generatedAt = new Date().toISOString();

  const addCandidate = (args: {
    summary: string;
    claimType: string;
    claimFamily: string;
    sourceArtefactId: string;
    sourcePath: string;
    sourceFamily: ClaimCandidateSourceFamily;
    sourceStage?: string;
    linkedEvidenceAnchorIds?: string[];
    linkedTruthStateIds?: string[];
    requiredEvidenceAnchorFamily?: string;
    requiredTruthStateFamily?: string;
    supportStatus?: string;
    extraBlockerCodes?: string[];
    publicClaimSupportRequired?: boolean;
    excludedFromPublicClaimGate?: boolean;
  }) => {
    const clean = safeCandidateSummary(args.summary);
    if (!clean) return;
    const safety = classifyClaimCandidateSafety({ text: clean, claimType: args.claimType, claimFamily: args.claimFamily, sourcePath: args.sourcePath });
    const isLegacy = args.sourceFamily === 'legacy_adapter';
    const excludedFromGate = args.excludedFromPublicClaimGate === true || args.publicClaimSupportRequired === false;
    const eligible = !excludedFromGate && args.sourceFamily === 'real_runtime_v3' && safety.public_safety_status !== 'blocked';
    const publicSafetyStatus = excludedFromGate && safety.public_safety_status === 'safe_for_public_candidate' ? 'internal_only' : safety.public_safety_status;
    const blockerCodes = dedupePreservingOrder([
      ...safety.blocker_codes,
      ...(isLegacy ? ['legacy_or_unsupported_claim_candidate_source'] : []),
      ...(args.sourceFamily === 'report_candidate_requires_support' ? ['report_candidate_requires_support'] : []),
      ...(!excludedFromGate && !eligible && !isLegacy && safety.public_safety_status !== 'blocked' ? ['claim_candidate_not_eligible_for_support_check'] : []),
      ...(args.extraBlockerCodes ?? []),
      'claim_candidate_trace_internal_only_not_public_claim_gate_evidence',
    ]);
    candidates.push({
      claim_candidate_id: `cc-${input.take_id}-${candidates.length + 1}`,
      safe_candidate_summary: clean,
      claim_type: safety.blocked_claim_category === 'public_scoring' ? 'score_or_verdict' : args.claimType,
      claim_family: args.claimFamily,
      source_artefact_id: args.sourceArtefactId,
      source_path: args.sourcePath,
      source_family: args.sourceFamily,
      source_stage: args.sourceStage ?? input.source_stage,
      required_evidence_anchor_family: args.requiredEvidenceAnchorFamily ?? args.claimFamily,
      required_truth_state_family: args.requiredTruthStateFamily ?? 'run_shape_or_claim_family_truth',
      linked_evidence_anchor_ids: args.linkedEvidenceAnchorIds ?? [],
      linked_truth_state_ids: args.linkedTruthStateIds ?? [],
      candidate_support_precheck_status: args.supportStatus ?? (excludedFromGate ? 'not_applicable' : (eligible ? 'eligible_for_support_check' : (isLegacy ? 'legacy_or_unsupported' : (safety.public_safety_status === 'blocked' ? 'blocked' : 'requires_support')))),
      public_safety_status: publicSafetyStatus,
      rewrite_required: safety.rewrite_required || isLegacy,
      score_scope: safety.score_scope,
      blocked_claim_category: safety.blocked_claim_category,
      blocker_codes: blockerCodes,
      public_display_status: 'not_rendered_internal_candidate',
      cannot_satisfy_public_claim_gate: true,
      eligible_for_public_claim_trace_support_check: eligible,
      public_claim_support_required: !excludedFromGate,
      required_for_public_claim_gate: !excludedFromGate,
      excluded_from_public_claim_gate: excludedFromGate,
    });
  };

  if (analysisEvidenceState) {
    const observableItems = safeRecordArray(analysisEvidenceState.observable_evidence_items);
    observableItems.forEach((item, index) => {
      const summary = pickSafeRecordText(item);
      if (!summary) return;
      const itemPath = typeof item.analysis_evidence_state_source_path === 'string' ? item.analysis_evidence_state_source_path : `observable_evidence_items[${index}]`;
      const explicitLinkedEvidenceAnchorIds = getStringArray(item.linked_evidence_anchor_ids);
      const linkedEvidenceAnchorIds = explicitLinkedEvidenceAnchorIds.length > 0
        ? explicitLinkedEvidenceAnchorIds
        : findSameRunAnchorIdsForAnalysisEvidencePath(anchors, itemPath);
      const linkedTruthStateIds = Array.isArray(item.linked_truth_state_ids) ? item.linked_truth_state_ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
      const hasAnchorSupport = linkedEvidenceAnchorIds.length > 0;
      addCandidate({
        summary,
        claimType: 'factual_or_limitation_status',
        claimFamily: claimFamilyForRuntimeEvidence(item),
        sourceArtefactId: 'analysis_evidence_state',
        sourcePath: itemPath,
        sourceFamily: 'real_runtime_v3',
        sourceStage: 'analysis_step_1_evidence_mapping',
        linkedEvidenceAnchorIds,
        linkedTruthStateIds,
        requiredEvidenceAnchorFamily: String(item.evidence_kind ?? 'runtime_fact'),
        requiredTruthStateFamily: linkedTruthStateIds.length > 0 ? 'linked_truth_state_ids' : 'not_required_for_runtime_fact',
        publicClaimSupportRequired: hasAnchorSupport,
        excludedFromPublicClaimGate: !hasAnchorSupport,
      });
    });
    const unsupportedItems = Array.isArray(analysisEvidenceState.unsupported_or_unavailable_evidence)
      ? analysisEvidenceState.unsupported_or_unavailable_evidence
      : (analysisEvidenceState.unsupported_or_unavailable_evidence === null || analysisEvidenceState.unsupported_or_unavailable_evidence === undefined ? [] : [analysisEvidenceState.unsupported_or_unavailable_evidence]);
    unsupportedItems.forEach((item, index) => {
      const recordItem = isRecord(item) ? item : null;
      const summary = recordItem
        ? `${safeCandidateSummary(recordItem.evidence_kind) ?? `unavailable_evidence_family_${index + 1}`}: ${safeCandidateSummary(recordItem.reason) ?? safeCandidateSummary(recordItem.status) ?? 'not extracted'}`
        : safeCandidateSummary(item);
      if (!summary) return;
      addCandidate({
        summary,
        claimType: 'assessability_limitation',
        claimFamily: 'assessability_limitation',
        sourceArtefactId: 'analysis_evidence_state',
        sourcePath: `unsupported_or_unavailable_evidence[${index}]`,
        sourceFamily: 'real_runtime_v3',
        sourceStage: 'analysis_step_1_evidence_mapping',
        requiredEvidenceAnchorFamily: 'assessability_limitation',
        requiredTruthStateFamily: 'not_required_for_limitation_candidate',
        extraBlockerCodes: recordItem ? getStringArray(recordItem.blocker_codes) : (summary === '[redacted unsafe candidate summary]' ? ['unsafe_limitation_summary_redacted'] : []),
      });
    });
    for (const [field, value] of [
      ['assessability_limitations', analysisEvidenceState.assessability_limitations],
      ['timestamp_normalisation_warnings', analysisEvidenceState.timestamp_normalisation_warnings],
      ['timestamp_normalization_warnings', analysisEvidenceState.timestamp_normalization_warnings],
      ['extraction_limitations', analysisEvidenceState.extraction_limitations],
    ] as const) {
      normaliseSafeLimitationItems(value).forEach((item) => {
        addCandidate({
          summary: item.safe_summary,
          claimType: 'assessability_limitation',
          claimFamily: 'assessability_limitation',
          sourceArtefactId: 'analysis_evidence_state',
          sourcePath: `${field}[${item.source_index}]`,
          sourceFamily: 'real_runtime_v3',
          sourceStage: 'analysis_step_1_evidence_mapping',
          requiredEvidenceAnchorFamily: 'assessability_limitation',
          requiredTruthStateFamily: 'not_required_for_limitation_candidate',
          extraBlockerCodes: item.blocker_codes,
        });
      });
    }
  }

  anchors.forEach((anchor, index) => {
    if (anchor.source_family !== 'real_runtime_v3' && anchor.source_classification !== 'real_runtime_v3') return;
    const summary = pickSafeRecordText(anchor);
    if (!summary) return;
    const anchorId = typeof anchor.evidence_anchor_id === 'string' ? anchor.evidence_anchor_id : null;
    const truthIds = Array.isArray(anchor.linked_truth_state_ids) ? anchor.linked_truth_state_ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
    addCandidate({
      summary,
      claimType: 'evidence_summary',
      claimFamily: claimFamilyForRuntimeEvidence(anchor),
      sourceArtefactId: 'evidence_anchors',
      sourcePath: `anchors[${index}]`,
      sourceFamily: 'real_runtime_v3',
      sourceStage: 'evidence_anchor_promotion',
      linkedEvidenceAnchorIds: anchorId ? [anchorId] : [],
      linkedTruthStateIds: truthIds,
      requiredEvidenceAnchorFamily: String(anchor.evidence_modality ?? anchor.evidence_kind ?? 'runtime_anchor'),
      requiredTruthStateFamily: truthIds.length > 0 ? 'linked_truth_state_ids' : 'not_required_for_runtime_fact',
    });
  });

  const addLegacyCandidate = (value: unknown, sourcePath: string, claimType: string) => {
    const summary = safeCandidateSummary(value);
    if (!summary) return;
    addCandidate({
      summary,
      claimType,
      claimFamily: inferLegacyClaimFamily(sourcePath, summary, claimType),
      sourceArtefactId: 'raw_report',
      sourcePath,
      sourceFamily: 'legacy_adapter',
      sourceStage: 'raw_report_snapshot',
      supportStatus: 'legacy_diagnostic_only',
      publicClaimSupportRequired: false,
      excludedFromPublicClaimGate: true,
      extraBlockerCodes: ['legacy_diagnostic_claim_candidate_excluded_from_public_claim_gate'],
    });
  };
  const directFields: Array<[string, unknown, string]> = [
    ['report_data.submission_verdict.label', (rawReportData.submission_verdict as Record<string, unknown> | undefined)?.label, 'score_or_verdict'],
    ['report_data.submission_verdict.reason', (rawReportData.submission_verdict as Record<string, unknown> | undefined)?.reason, 'readiness_status'],
    ['report_data.verdict_final', rawReportData.verdict_final, 'score_or_verdict'],
    ['report_data.casting_insight', rawReportData.casting_insight, 'role_or_brief_fit'],
    ['report_data.casting_headline', rawReportData.casting_headline, 'role_or_brief_fit'],
    ['report_data.fix_first', rawReportData.fix_first, 'priority_fix'],
    ['report_data.next_take', rawReportData.next_take, 'priority_fix'],
    ['report_data.presentation_notes', rawReportData.presentation_notes, 'performance_quality'],
  ];
  directFields.forEach(([sourcePath, value, claimType]) => addLegacyCandidate(value, sourcePath, claimType));
  for (const key of ['overall_score', 'overall_score_final', 'overall_score_model', 'overall_readiness', 'readiness_score'] as const) {
    const value = rawReportData[key];
    if (typeof value === 'number' || typeof value === 'string') addLegacyCandidate(value, `report_data.${key}`, 'score_or_verdict');
  }
  if (isRecord(rawReportData.scores)) {
    for (const [key, value] of Object.entries(rawReportData.scores)) {
      if (typeof value === 'number' || typeof value === 'string') addLegacyCandidate(`${key}: ${String(value)}`, `report_data.scores.${key}`, 'score_or_verdict');
    }
  }
  for (const [key, value, claimType] of [
    ['strengths', rawReportData.strengths, 'preserve_strength'],
    ['improvements', rawReportData.improvements, 'priority_fix'],
    ['category_notes', rawReportData.category_notes, 'readiness_status'],
    ['category_rationale', rawReportData.category_rationale, 'readiness_status'],
    ['priority_fixes', rawReportData.priority_fixes, 'priority_fix'],
  ] as const) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' || typeof item === 'number') addLegacyCandidate(item, `report_data.${key}[${index}]`, claimType);
        else if (isRecord(item)) {
          const text = pickSafeRecordText(item);
          if (text) addLegacyCandidate(text, `report_data.${key}[${index}]`, claimType);
        }
      });
    } else if (isRecord(value)) {
      for (const [subKey, subValue] of Object.entries(value)) addLegacyCandidate(subValue, `report_data.${key}.${subKey}`, claimType);
    }
  }
  if (Array.isArray(rawReportData.timestamped_notes)) {
    rawReportData.timestamped_notes.forEach((item, index) => {
      if (!isRecord(item)) return;
      const text = getTimestampedNoteText(item);
      const field = getTimestampedNoteTextField(item);
      if (text && field) addLegacyCandidate(text, `report_data.timestamped_notes[${index}].${field}`, 'performance_quality');
    });
  }

  if (candidates.length === 0) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const sourceSummary = summarizeClaimCandidateSources(candidates);
  const sourceClassification = sourceClassificationForClaimCandidates(sourceSummary);
  const blockedCandidateCount = candidates.filter((candidate) => candidate.public_safety_status === 'blocked').length;
  const rewriteRequiredCount = candidates.filter((candidate) => candidate.rewrite_required === true).length;
  const unsupportedCandidateCount = candidates.filter((candidate) => ['legacy_or_unsupported', 'requires_support'].includes(String(candidate.candidate_support_precheck_status))).length;
  const safeCandidateCount = candidates.filter((candidate) => candidate.public_safety_status === 'safe_for_public_candidate').length;
  const blockerCodes = dedupePreservingOrder([
    'claim_candidate_trace_internal_only_not_public_claim_gate_evidence',
    'public_claim_trace_not_promoted',
    ...(sourceSummary.legacy_adapter > 0 ? ['legacy_or_unsupported_claim_candidate_source'] : []),
    ...candidates.flatMap((candidate) => Array.isArray(candidate.blocker_codes) ? candidate.blocker_codes.filter((x): x is string => typeof x === 'string' && x.length > 0) : []),
  ]);
  const payload = {
    ...(input.metadata_overrides ?? {}),
    schema_version: 'tapecoach_v3_claim_candidate_trace_v1',
    artefact_type: 'claim_candidate_trace',
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    generated_at: generatedAt,
    internal_only: true,
    privacy_classification: 'internal_private',
    source_classification: sourceClassification,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module,
    source_stage: input.source_stage,
    claim_candidate_count: candidates.length,
    claim_candidates: candidates,
    claim_candidate_source_summary: sourceSummary,
    blocked_candidate_count: blockedCandidateCount,
    rewrite_required_count: rewriteRequiredCount,
    unsupported_candidate_count: unsupportedCandidateCount,
    safe_candidate_count: safeCandidateCount,
    public_render_permission_status: 'not_evaluated_or_blocked',
    cannot_satisfy_public_claim_gate: true,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    blocker_codes: blockerCodes,
    gate_satisfaction_reason: sourceSummary.real_runtime_v3 > 0
      ? 'claim_candidate_source_available_public_claim_trace_not_promoted'
      : 'legacy_or_unsupported_claim_candidates_only',
    public_output_unchanged: true,
    redaction_policy: 'safe_summaries_only',
  };
  assertSafeSegment(input.take_id, 'take_id');
  const result = await writeInternalJson(root, input.run_id, `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ClaimCandidateTrace.json`, payload, 'claim_candidate_trace');
  const summary = {
    claim_candidate_count: candidates.length,
    source_classification: sourceClassification,
    claim_candidate_source_summary: sourceSummary,
    blocked_candidate_count: blockedCandidateCount,
    rewrite_required_count: rewriteRequiredCount,
    unsupported_candidate_count: unsupportedCandidateCount,
    safe_candidate_count: safeCandidateCount,
    claim_candidate_gate_status: 'insufficient' as const,
    claim_candidate_gate_reason: 'claim_candidate_trace_internal_only_not_public_claim_gate_evidence',
  };
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ['claim_candidate_trace'] : [],
    source_classification: sourceClassification,
    summary,
    claim_candidates: candidates,
    warning: result.warning ?? null,
  };
}

export async function emitPublicClaimTraceFirstPass(input: PublicClaimTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const claimCandidates = getTraceClaimCandidates(input.claim_candidate_trace_data);
  if (claimCandidates.length > 0) {
    const identity = validateTraceIdentityForCurrentRun(input.claim_candidate_trace_data, {
      run_id: input.run_id,
      analysis_run_id: analysisRunId,
      take_id: input.take_id,
      artefact_type: 'claim_candidate_trace',
    });
    const classified = identity.ok
      ? classifyPublicClaimSupportFromCandidates({
        run_id: input.run_id,
        analysis_run_id: analysisRunId,
        take_id: input.take_id,
        candidates: claimCandidates,
        evidence_anchors_data: input.evidence_anchors_data,
        truth_state_map_data: input.truth_state_map_data,
      })
      : classifyPublicClaimTraceIdentityRejected({
        run_id: input.run_id,
        analysis_run_id: analysisRunId,
        take_id: input.take_id,
        candidates: claimCandidates,
        blockerCodes: identity.blockerCodes,
      });
    const supportedClaimCount = classified.claims.filter((claim) => claim.support_status === 'supported').length;
    const missingEvidenceCount = classified.claims.filter((claim) => claim.support_status === 'missing_evidence').length;
    const missingTruthLinkCount = classified.claims.filter((claim) => claim.support_status === 'missing_truth_link').length;
    const blockedClaimCount = classified.claims.filter((claim) => claim.support_status === 'blocked').length;
    const rewriteRequiredCount = classified.claims.filter((claim) => claim.rewrite_required === true).length;
    const unsupportedClaimCount = classified.claims.filter((claim) => !['supported', 'not_applicable'].includes(String(claim.support_status))).length;
    const legacyUntracedClaimCount = classified.claims.filter((claim) => ['legacy_adapter', 'legacy_or_unsupported'].includes(String(claim.source_family)) || claim.source_artefact_id === 'raw_report').length;
    const unsafeOrOverclaimCount = classified.claims.filter((claim) => ['unsafe_or_overclaim', 'needs_rewrite', 'blocked'].includes(String(claim.public_safety_status))).length;
    const payload = {
      ...(input.metadata_overrides ?? {}),
      schema_version: 'tapecoach_v3_public_claim_trace_support_v1',
      artefact_type: 'public_claim_trace',
      run_id: input.run_id,
      analysis_run_id: analysisRunId,
      generated_at: new Date().toISOString(),
      internal_only: true,
      privacy_classification: 'internal_private',
      submission_id: input.submission_id ?? null,
      take_id: input.take_id,
      comparison_run_id: input.comparison_run_id ?? null,
      source_module: input.source_module,
      source_stage: input.source_stage,
      source_classification: classified.sourceClassification,
      claim_count: classified.claims.length,
      claims: classified.claims,
      claim_source_summary: classified.sourceSummary,
      support_gate_status: classified.publicClaimGateStatus,
      public_claim_gate_status: classified.publicClaimGateStatus,
      public_claim_gate_reason: classified.publicClaimGateReason,
      supported_claim_count: supportedClaimCount,
      unsupported_claim_count: unsupportedClaimCount,
      legacy_untraced_claim_count: legacyUntracedClaimCount,
      unsafe_or_overclaim_count: unsafeOrOverclaimCount,
      rewrite_required_count: rewriteRequiredCount,
      missing_evidence_count: missingEvidenceCount,
      missing_truth_link_count: missingTruthLinkCount,
      blocked_claim_count: blockedClaimCount,
      public_safe_claim_count: classified.claims.filter((claim) => claim.public_safety_status === 'safe_for_public_candidate').length,
      blocker_codes: classified.blockerCodes,
      cannot_satisfy_public_claim_gate: classified.publicClaimGateStatus !== 'sufficient',
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
      public_output_unchanged: true,
      redaction_notes: ['Internal-only trace; no secrets or token/session credentials included', 'safe summaries only'],
      ...resolveQADeploymentProvenance(),
    };
    assertSafeSegment(input.take_id, 'take_id');
    const result = await writeInternalJson(root, input.run_id, `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/PublicClaimTrace.json`, payload, 'public_claim_trace');
    const summary = {
      claim_count: payload.claim_count,
      unsupported_claim_count: payload.unsupported_claim_count,
      legacy_untraced_claim_count: payload.legacy_untraced_claim_count,
      unsafe_or_overclaim_count: payload.unsafe_or_overclaim_count,
      rewrite_required_count: payload.rewrite_required_count,
      supported_claim_count: payload.supported_claim_count,
      missing_evidence_count: payload.missing_evidence_count,
      missing_truth_link_count: payload.missing_truth_link_count,
      blocked_claim_count: payload.blocked_claim_count,
      source_classification: classified.sourceClassification,
      claim_source_summary: classified.sourceSummary,
      support_gate_status: classified.publicClaimGateStatus,
      public_claim_gate_status: classified.publicClaimGateStatus,
      public_claim_gate_reason: classified.publicClaimGateReason,
      blocker_codes: classified.blockerCodes,
    };
    return {
      written: result.written as boolean,
      emitted_artefact_ids: result.written ? ['public_claim_trace'] : [],
      claims: classified.claims,
      source_classification: classified.sourceClassification,
      level2_satisfies: result.written && classified.publicClaimGateStatus === 'sufficient',
      summary,
      warning: result.warning ?? null,
    };
  }
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
      rewrite_required: true,
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
    claims,
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
export async function emitNoExportProofBundle(input: { run_id: string; proofs?: Record<string, unknown>; root_dir?: string; internal_qa_emit?: boolean; source_module?: string; source_stage?: string }) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const ids: string[] = [];
  let hadFailure = false;
  const sourceModule = input.source_module ?? 'src/server/v3/qa-artifacts-wiring.server.ts';
  const sourceStage = input.source_stage ?? 'emitNoExportProofBundle';
  const providedProofs = input.proofs ?? {};
  const entries: Array<[string, string]> = [
    ['no_export_source_proof', 'export_or_no_export/no_export_source_proof.json'],
    ['no_export_config_proof', 'export_or_no_export/no_export_config_proof.json'],
    ['no_export_ui_proof', 'export_or_no_export/no_export_ui_proof.json'],
    ['no_export_log_proof', 'export_or_no_export/no_export_log_proof.json'],
  ];
  const writeResults = await Promise.all(entries.map(async ([id, rel]) => {
    if (!providedProofs[id]) return null;
    const basePayload = isRecord(providedProofs[id]) ? providedProofs[id] as Record<string, unknown> : { provided_payload: providedProofs[id] };
    const payload = id === 'no_export_ui_proof' ? {
      schema_version: 'tapecoach_v3_no_export_ui_proof_v1',
      artefact_type: 'no_export_ui_proof',
      internal_only: true,
      privacy_classification: 'internal_private',
      run_id: input.run_id,
      generated_at: new Date().toISOString(),
      source_module: sourceModule,
      source_stage: sourceStage,
      public_export_ui_status: 'absent_in_customer_facing_surfaces',
      public_download_ui_status: 'absent_in_customer_facing_surfaces',
      public_share_ui_status: 'absent_in_customer_facing_surfaces',
      public_comparison_output_ui_status: 'absent_in_customer_facing_surfaces',
      checked_routes: (Array.isArray(basePayload.checked_routes) ? basePayload.checked_routes : ['src/routes']),
      checked_components_or_files: (Array.isArray(basePayload.checked_components_or_files) ? basePayload.checked_components_or_files : ['src/components', 'src/lib']),
      forbidden_ui_surfaces_absent: true,
      admin_internal_surfaces_classified: Array.isArray(basePayload.admin_internal_surfaces_classified) ? basePayload.admin_internal_surfaces_classified : [],
      unsupported_or_unknown_surfaces: Array.isArray(basePayload.unsupported_or_unknown_surfaces) ? basePayload.unsupported_or_unknown_surfaces : [],
      gate_satisfaction_reason: 'customer_facing_ui_surfaces_checked_no_forbidden_export_download_share_or_comparison_output_actions_found',
      blocker_codes: Array.isArray(basePayload.blocker_codes) ? basePayload.blocker_codes : [],
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
      level2_satisfaction: 'insufficient',
      public_output_unchanged: true,
      evidence_details: basePayload,
      ...resolveQADeploymentProvenance(),
    } : {
      schema_version: 'tapecoach_v3_no_export_proof_v1',
      artefact_type: id,
      internal_only: true,
      privacy_classification: 'internal_private',
      run_id: input.run_id,
      generated_at: new Date().toISOString(),
      source_module: sourceModule,
      source_stage: sourceStage,
      public_output_unchanged: true,
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
      level2_satisfaction: 'insufficient',
      evidence_details: basePayload,
      ...resolveQADeploymentProvenance(),
    };
    const w = await writeInternalJson(root, input.run_id, rel, payload, id);
    return { id, written: w.written };
  }));
  for (const result of writeResults) {
    if (!result) continue;
    const { id, written } = result;
    if (written) {
      ids.push(id);
    } else {
      hadFailure = true;
    }
  }
  const hasCore = ids.includes('no_export_source_proof') && ids.includes('no_export_config_proof') && ids.includes('no_export_log_proof');
  if (hasCore) {
    const hasUi = ids.includes('no_export_ui_proof');
    const b = await writeInternalJson(root, input.run_id, 'export_or_no_export/no_export_proof.json', {
      schema_version: 'tapecoach_v3_no_export_proof_bundle_v1',
      artefact_type: 'no_export_proof',
      internal_only: true,
      privacy_classification: 'internal_private',
      run_id: input.run_id,
      generated_at: new Date().toISOString(),
      source_module: sourceModule,
      source_stage: sourceStage,
      proof_refs: ids.map((id) => `export_or_no_export/${id}.json`),
      source_proof_emitted: ids.includes('no_export_source_proof'),
      config_proof_emitted: ids.includes('no_export_config_proof'),
      ui_proof_emitted: hasUi,
      log_proof_emitted: ids.includes('no_export_log_proof'),
      proof_family_status: hasUi ? 'complete' : 'partial_ui_proof_missing',
      level2_satisfaction: 'insufficient',
      level2_unsatisfied_reasons: hasUi ? [] : ['no_export_ui_proof_missing'],
      must_not_unblock_public_or_production_gates: true,
      public_output_unchanged: true,
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
      ...resolveQADeploymentProvenance(),
    }, 'no_export_proof');
    if (b.written) ids.push('no_export_proof'); else hadFailure = true;
  }
  return { written: !hadFailure, emitted_artefact_ids: ids };
}
export async function emitComparisonRuntimeArtifacts(input: ComparisonRuntimeArtifactsInput): Promise<any> {
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
  for (const payload of input.media_identity_payloads ?? []) {
    try {
      assertSafeSegment(payload.take_id, 'media_identity_take_id');
      assertSafeSegment(payload.analysis_run_id, 'media_identity_analysis_run_id');
      const w = await writeInternalJson(root, input.run_id, `takes/take-${payload.take_id}/analysis-${payload.analysis_run_id}/inputs/media_identity.json`, payload, 'media_identity');
      if (w.written && !emitted_artefact_ids.includes('media_identity')) emitted_artefact_ids.push('media_identity');
      else if (!w.written) hadFailure = true;
    } catch {
      hadFailure = true;
    }
  }
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
      duplicate_detection_status: input.comparison_raw_data.duplicate_detection_status ?? input.duplicate_detection_trace?.duplicate_detection_status ?? 'missing',
      duplicate_detection_confidence: input.comparison_raw_data.duplicate_detection_confidence ?? input.duplicate_detection_trace?.duplicate_detection_confidence ?? null,
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
  if (input.duplicate_detection_trace) {
    const w = await writeInternalJson(root, input.run_id, `${comparisonRoot}/comparison/duplicate_detection_trace.json`, { ...input.duplicate_detection_trace, cannot_satisfy_level2_comparison_gate: true, forbidden_fields_absent: true, public_output_unchanged: true }, 'duplicate_detection_trace');
    if (w.written) emitted_artefact_ids.push('duplicate_detection_trace'); else hadFailure = true;
  }
  const emitted_blocked_artefact_ids: string[] = [];
  return { written: !hadFailure, comparison_run_id: comparisonRunId, emitted_artefact_ids, emitted_blocked_artefact_ids };
}

export async function emitComparisonRuntimeArtifactsWithManifestReconciliation(input: ComparisonRuntimeArtifactsInput & { root_take_id?: string | null }): Promise<any> {
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
  const emittedBlockedIds = emitOut.emitted_blocked_artefact_ids ?? [];
  const normalisedComparedTakeIds = normaliseUniqueTakeCores(comparedTakeIds);
  const comparisonRunId = emitOut.comparison_run_id ?? input.comparison_run_id ?? null;
  const comparisonEvidenceStatus = {
    comparison_raw: emittedIds.includes('comparison_raw'),
    comparison_report_internal: emittedIds.includes('comparison_report_internal'),
    same_video_repeatability_trace: emittedIds.includes('same_video_repeatability_trace'),
    duplicate_detection_trace: emittedIds.includes('duplicate_detection_trace'),
    comparison_suppression_trace: emittedIds.includes('comparison_suppression_trace'),
    route_variance_trace: emittedIds.includes('route_variance_trace'),
  };
  const comparisonInvoked = Boolean(comparisonRunId)
    || normalisedComparedTakeIds.length > 1
    || COMPARISON_ARTEFACT_IDS.some((id) => emittedIds.includes(id) || emittedBlockedIds.includes(id));
  const comparisonParityPayloads = {
    public_output_unchanged: true,
    public_comparison_output_absent_or_unchanged: true,
    ...(input.comparison_raw_data ? { comparison_raw: { ...input.comparison_raw_data, public_output_unchanged: true } } : {}),
    ...(input.same_video_repeatability_trace ? { same_video_repeatability_trace: { ...input.same_video_repeatability_trace, public_output_unchanged: true } } : {}),
    ...(input.duplicate_detection_trace ? { duplicate_detection_trace: { ...input.duplicate_detection_trace, public_output_unchanged: true } } : {}),
    ...(input.suppression_trace ? { comparison_suppression_trace: { ...input.suppression_trace, public_output_unchanged: true } } : {}),
    ...(input.route_variance_trace ? { route_variance_trace: { ...input.route_variance_trace, public_output_unchanged: true } } : {}),
  };
  const comparisonParityWrite = comparisonInvoked ? await emitComparisonParityProof({
    run_id: identity.canonical_qa_run_id,
    analysis_run_id: identity.canonical_analysis_run_id,
    take_id: identity.canonical_take_id,
    comparison_run_id: comparisonRunId,
    compared_take_ids: normalisedComparedTakeIds,
    root_dir: root,
    internal_qa_emit: true,
    comparison_invoked: comparisonInvoked,
    comparison_evidence_status: comparisonEvidenceStatus,
    comparison_payloads: comparisonParityPayloads,
  }) : { written: false, emitted_artefact_ids: [] as string[], parity_status: 'not_applicable' as const, blocker_codes: [] as string[] };
  const reconciledComparisonManifest = reconcileComparisonManifestState({
    manifest: manifestObj,
    comparison_run_id: comparisonRunId,
    compared_take_ids: normalisedComparedTakeIds,
    comparison_write_success_by_id: {
      comparison_raw: emittedIds.includes('comparison_raw'),
      comparison_report_internal: emittedIds.includes('comparison_report_internal'),
      same_video_repeatability_trace: emittedIds.includes('same_video_repeatability_trace'),
      duplicate_detection_trace: emittedIds.includes('duplicate_detection_trace'),
      comparison_suppression_trace: emittedIds.includes('comparison_suppression_trace'),
      route_variance_trace: emittedIds.includes('route_variance_trace'),
    },
  });
  if (emittedIds.includes('media_identity')) {
    const emitted = new Set<string>(reconciledComparisonManifest.emitted_artifacts ?? []);
    const blocked = new Set<string>(reconciledComparisonManifest.runtime_evidence_blocked_by_id ?? []);
    const accepted = new Set<string>(reconciledComparisonManifest.runtime_evidence_accepted_by_id ?? []);
    emitted.add('media_identity');
    blocked.add('media_identity');
    accepted.delete('media_identity');
    const mediaIdentityPayloads = input.media_identity_payloads ?? [];
    const available = mediaIdentityPayloads.reduce((sum, payload) => sum + Number(payload.available_signal_count ?? 0), 0);
    const unavailable = mediaIdentityPayloads.reduce((sum, payload) => sum + Number(payload.unavailable_signal_count ?? 0), 0);
    const mediaBlockers = mediaIdentityPayloads.flatMap((payload) => payload.blocker_codes ?? []);
    reconciledComparisonManifest.emitted_artifacts = [...emitted];
    reconciledComparisonManifest.runtime_evidence_blocked_by_id = [...blocked];
    reconciledComparisonManifest.runtime_evidence_accepted_by_id = [...accepted];
    reconciledComparisonManifest.artefact_status_by_id = { ...(reconciledComparisonManifest.artefact_status_by_id ?? {}), media_identity: 'emitted' };
    reconciledComparisonManifest.artefact_source_classification_by_id = {
      ...(reconciledComparisonManifest.artefact_source_classification_by_id ?? {}),
      media_identity: mediaIdentityPayloads.some((payload) => payload.cannot_satisfy_duplicate_detection_gate === false) ? 'real_runtime_v3_media_identity' : 'partial_media_identity',
    };
    reconciledComparisonManifest.artefact_level2_spine_satisfaction_by_id = {
      ...(reconciledComparisonManifest.artefact_level2_spine_satisfaction_by_id ?? {}),
      media_identity: false,
    };
    reconciledComparisonManifest.media_identity_summary = {
      media_identity_status: mediaIdentityPayloads.some((payload) => payload.media_identity_status === 'complete') ? 'complete' : (available > 0 ? 'partial' : 'unavailable'),
      available_signal_count: available,
      unavailable_signal_count: unavailable,
      media_identity_gate_status: 'insufficient',
      media_identity_blocker_codes: [...new Set(mediaBlockers)],
      cannot_satisfy_duplicate_detection_gate: !mediaIdentityPayloads.some((payload) => payload.cannot_satisfy_duplicate_detection_gate === false),
    };
  }
  const reconciledManifest = applyComparisonParityManifestState({
    manifest: reconciledComparisonManifest,
    written: Boolean(comparisonParityWrite.written),
    parity_status: comparisonParityWrite.parity_status as ComparisonParityStatus,
  });
  const mw = await writeQAArtifact({ root_dir: root, run_id: identity.canonical_qa_run_id, relative_path: identity.manifest_relative_path, payload: reconciledManifest, artefact_id: 'manifest' });
  const metrics = { ...buildQAAcceptanceMetrics(reconciledManifest), ...resolveQADeploymentProvenance() };
  const qw = await writeQAArtifact({ root_dir: root, run_id: identity.canonical_qa_run_id, relative_path: identity.metrics_relative_path, payload: metrics, artefact_id: 'qa_acceptance_metrics' });
  const reconciliation_written = Boolean(mw.written && qw.written);
  const comparison_parity_write_satisfied = !comparisonInvoked || comparisonParityWrite.parity_status === 'not_applicable' || Boolean(comparisonParityWrite.written);
  const comparison_artefacts_written = emittedIds.length > 0;
  const comparison_artefact_root_match = Boolean(identity.canonical_comparison_root === `takes/take-${identity.canonical_take_id}/analysis-${identity.canonical_analysis_run_id}`);
  const read_write_root_match = Boolean(identity.canonical_manifest_storage_key.startsWith(`${identity.canonical_qa_run_id}/`) && identity.canonical_metrics_storage_key.startsWith(`${identity.canonical_qa_run_id}/`));
  return {
    ...emitOut,
    ...baseResult,
    emitted_artefact_ids: [...new Set([
      ...emittedIds,
      ...(comparisonParityWrite.written && comparisonParityWrite.parity_status === 'passed' ? ['parity_comparison'] : []),
    ])],
    emitted_blocked_artefact_ids: [...new Set([
      ...emittedBlockedIds,
      ...(comparisonParityWrite.written && comparisonParityWrite.parity_status !== 'passed' && comparisonParityWrite.parity_status !== 'not_applicable' ? ['parity_comparison'] : []),
    ])],
    written: Boolean(emitOut.written && reconciliation_written && comparison_parity_write_satisfied),
    reconciliation_written,
    comparison_artefacts_written,
    comparison_parity_written: Boolean(comparisonParityWrite.written),
    comparison_parity_status: comparisonParityWrite.parity_status,
    comparison_artefact_root_match,
    read_write_root_match,
    blocker_codes: [...new Set([
      ...(emitOut.written && reconciliation_written ? [] : ['comparison_reconciliation_failed']),
      ...(!comparison_parity_write_satisfied ? ['parity_artefacts_missing'] : []),
      ...(comparisonParityWrite.blocker_codes ?? []),
    ])],
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
    safe_upload_identity: {
      original_upload_file_hash: input.original_upload_file_hash ?? null,
      original_upload_file_hash_source_stage: input.original_upload_file_hash_source_stage ?? null,
      original_file_name_safe_basename: input.original_file_name ?? input.visible_or_original_file_name ?? input.file_name ?? input.filename ?? null,
      metadata_file_name_safe_basename: input.metadata_file_name ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      mime_type_safe_summary: input.mime_type_safe_summary ?? null,
      last_modified_ms: input.last_modified_ms ?? null,
      upload_metadata_source: input.upload_metadata_source ?? null,
      upload_identity_capture_status: input.upload_identity_capture_status ?? (input.original_upload_file_hash ? 'captured' : (input.upload_identity_metadata ? 'partial' : 'unavailable')),
      upload_identity_capture_reason: input.upload_identity_capture_reason ?? null,
      upload_identity_source_stage: input.original_upload_file_hash_source_stage ?? null,
      upload_identity_merge_status: input.upload_identity_merge_status ?? null,
      raw_values_redacted: true,
    },
    media_readiness_state: input.media_readiness_state ?? null,
    unavailable_fields: dedupePreservingOrder([...unavailableCommonDedupe, ...(input.take_created_at ? [] : ['take_created_at']), ...(input.take_updated_at ? [] : ['take_updated_at'])]), redaction_notes,
  };
  const mediaIdentity = buildMediaIdentityPayload({
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    source_module: input.source_module,
    source_stage: input.source_stage,
    take: {
      take_id: input.take_id,
      analysis_run_id: analysisRunId,
      mux_playback_ref: input.safe_mux_playback_ref ?? input.mux_playback_id ?? null,
      safe_mux_playback_ref: input.safe_mux_playback_ref ?? null,
      mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? null,
      user_id: input.user_id ?? null,
      profile_id: input.profile_id ?? null,
      audition_id: input.audition_id ?? input.submission_id ?? null,
      submission_id: input.submission_id ?? null,
      original_upload_file_hash: input.original_upload_file_hash ?? null,
      original_upload_file_hash_source_stage: input.original_upload_file_hash_source_stage ?? null,
      visible_or_original_file_name: input.visible_or_original_file_name ?? null,
      original_file_name: input.original_file_name ?? null,
      file_name: input.file_name ?? null,
      filename: input.filename ?? null,
      metadata_file_name: input.metadata_file_name ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      mime_type_safe_summary: input.mime_type_safe_summary ?? null,
      last_modified_ms: input.last_modified_ms ?? null,
      upload_metadata_source: input.upload_metadata_source ?? null,
      upload_identity_capture_status: input.upload_identity_capture_status ?? null,
      upload_identity_capture_reason: input.upload_identity_capture_reason ?? null,
      upload_identity_merge_status: input.upload_identity_merge_status ?? null,
      video_duration_ms: input.video_duration_ms ?? input.duration_ms ?? null,
      video_duration_seconds: input.video_duration_seconds ?? input.duration_seconds ?? null,
      opening_video_sample_hash_or_profile: input.opening_video_sample_hash_or_profile ?? input.opening_video_sample_hash ?? null,
      closing_video_sample_hash_or_profile: input.closing_video_sample_hash_or_profile ?? input.closing_video_sample_hash ?? null,
      opening_audio_profile_hash: input.opening_audio_profile_hash ?? null,
      closing_audio_profile_hash: input.closing_audio_profile_hash ?? null,
      safe_media_fingerprint: input.safe_media_fingerprint ?? null,
      upload_identity_metadata: input.upload_identity_metadata ?? null,
    },
  });
  assertSafeSegment(input.take_id, 'take_id');
  const base = `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs`;
  const emitted_artefact_ids: string[] = [];
  let hadFailure = false;
  const writes: Array<[string, string, unknown]> = [
    ['analysis_input_record', `${base}/input_record.json`, inputRecord],
    ['analysis_submission', `${base}/submission.json`, submissionSnapshot],
    ['analysis_take', `${base}/take.json`, takeSnapshot],
    ['media_identity', `${base}/media_identity.json`, mediaIdentity],
  ];
  for (const [id, rel, payload] of writes) {
    const w = await writeInternalJson(root, input.run_id, rel, payload, id);
    if (w.written) emitted_artefact_ids.push(id); else hadFailure = true;
  }
  return {
    written: !hadFailure,
    emitted_artefact_ids,
    media_identity_summary: {
      media_identity_status: mediaIdentity.media_identity_status,
      available_signal_count: mediaIdentity.available_signal_count,
      unavailable_signal_count: mediaIdentity.unavailable_signal_count,
      media_identity_gate_status: 'insufficient' as const,
      media_identity_blocker_codes: mediaIdentity.blocker_codes,
      cannot_satisfy_duplicate_detection_gate: mediaIdentity.cannot_satisfy_duplicate_detection_gate,
    },
    media_identity_source_classification: mediaIdentity.cannot_satisfy_duplicate_detection_gate ? 'partial_media_identity' as const : 'real_runtime_v3_media_identity' as const,
  };
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
  const comparedTakeIds = normaliseUniqueTakeCores(input.compared_take_ids ?? [input.take_id]);
  const comparisonInvoked = Boolean(input.comparison_run_id) || comparedTakeIds.length > 1;
  const gf01Rt15Status = comparisonInvoked ? 'blocked' : 'not_applicable';
  const sameVideoComparisonStatus = comparisonInvoked ? 'requires_comparison_runtime_evidence' : 'not_executed_single_take';
  const inferred_truths: Record<string, unknown> = { comparison_run_id: input.comparison_run_id ?? null, compared_take_ids: comparedTakeIds };
  unavailable_truths.role_fit = 'unavailable_without_brief_or_material_support';
  unavailable_truths.comparison_evidence = 'not_executed';
  unavailable_truths.evidence_anchors = 'not_emitted';
  unavailable_truths.public_claim_support = 'not_emitted';
  if ((input.component_or_task_declaration_status ?? 'unknown') === 'unknown') unavailable_truths.component_or_task_declaration = 'unknown_or_not_loaded';
  const unsafe_or_blocked_truths = { production_safe_status: 'blocked', public_scoring_status: 'blocked', public_technique_authority_status: 'blocked', gf01_rt15_status: gf01Rt15Status, same_video_comparison_status: sameVideoComparisonStatus };
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
    unresolved_inputs, unavailable_fields, blocker_codes: comparisonInvoked ? ['gf01_rt15_blocked_no_comparison_runtime_evidence'] : [], redaction_notes,
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
    comparison_truths: { comparison_run_executed: comparisonInvoked, status: comparisonInvoked ? 'blocked_pending_comparison_evidence' : 'not_applicable_single_take', compared_take_ids: comparedTakeIds },
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
  return { written: !hadFailure, emitted_artefact_ids, resolver_output, truth_state_map };
}

export async function emitAnalysisEvidenceStatePrerequisite(input: AnalysisEvidenceStateEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      emitted_blocked_artefact_ids: [] as string[],
      source_classification: 'unavailable' as const,
      level2_satisfies: false as const,
      payload: null,
    };
  }
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  assertSafeSegment(input.take_id, 'take_id');
  assertSafeSegment(analysisRunId, 'analysis_run_id');
  const generatedAt = new Date().toISOString();
  const resolverOutputAvailable = input.resolver_output_available === true;
  const truthStateMapAvailable = input.truth_state_map_available === true;
  const durationKnown = typeof input.media_duration_seconds === 'number' && Number.isFinite(input.media_duration_seconds) && input.media_duration_seconds > 0;
  const durationConfidence = durationKnown ? (input.duration_confidence ?? 'known') : 'unknown';
  const filteredStep1 = isRecord(input.filtered_run_evidence_pass_step1) ? input.filtered_run_evidence_pass_step1 : null;
  const step1VideoItems = safeRecordArray(filteredStep1?.video_observable_evidence_items);
  const step1AudioItems = safeRecordArray(filteredStep1?.audio_observable_evidence_items);
  const step1MaterialItems = safeRecordArray(filteredStep1?.material_observable_evidence_items);
  const step1PerformanceItems = safeRecordArray(filteredStep1?.performance_observable_evidence_items);
  const step1TechniqueItems = safeRecordArray(filteredStep1?.candidate_technique_evidence);
  const hasFilteredStep1Items = step1VideoItems.length + step1AudioItems.length + step1MaterialItems.length + step1PerformanceItems.length + step1TechniqueItems.length > 0;
  const inputArtifactRefs = {
    analysis_input_record: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/input_record.json`,
    analysis_submission: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/submission.json`,
    analysis_take: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/take.json`,
  };
  const observable_evidence_items: AnalysisObservableEvidenceItem[] = [];
  const addRuntimeFact = (item: Omit<AnalysisObservableEvidenceItem, 'evidence_item_id' | 'timestamp' | 'timestamp_range' | 'public_display_status'>) => {
    observable_evidence_items.push({
      evidence_item_id: `aes-${String(observable_evidence_items.length + 1).padStart(4, '0')}`,
      timestamp: null,
      timestamp_range: null,
      public_display_status: 'internal_only',
      ...item,
    });
  };
  const addIfKnown = (value: unknown, item: Omit<AnalysisObservableEvidenceItem, 'evidence_item_id' | 'timestamp' | 'timestamp_range' | 'public_display_status' | 'safe_evidence_summary'> & { label: string }) => {
    if (value == null) return;
    if (typeof value === 'string' && !value.trim()) return;
    addRuntimeFact({
      ...item,
      safe_evidence_summary: `${item.label}: ${String(value)}`,
    });
  };
  addIfKnown(input.selected_level, {
    label: 'selected_level',
    evidence_modality: 'submission_context',
    evidence_kind: 'selected_level',
    source_artefact_id: 'analysis_submission',
    source_path: 'selected_level',
    timestamp_source: 'not_timestamped_runtime_metadata',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: 'runtime_field_present',
    blocker_codes: [],
  });
  addIfKnown(input.audition_type, {
    label: 'audition_type',
    evidence_modality: 'submission_context',
    evidence_kind: 'audition_type',
    source_artefact_id: 'analysis_submission',
    source_path: 'audition_type',
    timestamp_source: 'not_timestamped_runtime_metadata',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: 'runtime_field_present',
    blocker_codes: [],
  });
  addRuntimeFact({
    evidence_modality: 'submission_context',
    evidence_kind: 'brief_presence',
    safe_evidence_summary: `brief_presence: ${input.brief_presence ?? 'unknown'}`,
    source_artefact_id: 'resolver_output',
    source_path: 'brief_presence',
    timestamp_source: 'not_timestamped_resolver_fact',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: resolverOutputAvailable ? 'resolver_runtime_fact' : null,
    blocker_codes: resolverOutputAvailable ? [] : ['resolver_output_missing'],
  });
  addRuntimeFact({
    evidence_modality: 'material',
    evidence_kind: 'material_presence',
    safe_evidence_summary: `material_presence: ${input.material_presence ?? 'unknown'}`,
    source_artefact_id: 'resolver_output',
    source_path: 'material_presence',
    timestamp_source: 'not_timestamped_resolver_fact',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: resolverOutputAvailable ? 'resolver_runtime_fact' : null,
    blocker_codes: resolverOutputAvailable ? [] : ['resolver_output_missing'],
  });
  addRuntimeFact({
    evidence_modality: 'submission_context',
    evidence_kind: 'stable_take_identity',
    safe_evidence_summary: `stable_take_identity: take ${input.take_id} / analysis ${analysisRunId}`,
    source_artefact_id: 'analysis_take',
    source_path: 'stable_take_identity',
    timestamp_source: 'not_timestamped_runtime_metadata',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: 'runtime_identity_present',
    blocker_codes: [],
  });
  addRuntimeFact({
    evidence_modality: 'media_readiness',
    evidence_kind: 'media_readiness_state',
    safe_evidence_summary: `media_readiness_state: ${input.media_readiness_state ?? 'unknown'}`,
    source_artefact_id: 'analysis_take',
    source_path: 'media_readiness_state',
    timestamp_source: durationKnown ? 'media_readiness_runtime_field' : 'unavailable',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: durationKnown ? [] : ['media_duration_unavailable_no_timestamp_evidence_fabricated'],
    confidence_or_strength: input.media_readiness_state ? 'runtime_field_present' : null,
    blocker_codes: durationKnown ? [] : ['media_duration_unavailable'],
  });
  addRuntimeFact({
    evidence_modality: 'media_readiness',
    evidence_kind: 'safe_media_reference_state',
    safe_evidence_summary: `media reference present: playback=${Boolean(input.mux_playback_id)}, asset_or_upload=${String(input.mux_asset_or_upload_id_present ?? 'unknown')}`,
    source_artefact_id: 'resolver_output',
    source_path: 'safe_media_reference_state',
    timestamp_source: 'not_timestamped_media_metadata',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: resolverOutputAvailable ? 'resolver_runtime_fact' : null,
    blocker_codes: resolverOutputAvailable ? [] : ['resolver_output_missing'],
  });
  addRuntimeFact({
    evidence_modality: 'resolver_truth',
    evidence_kind: 'known_truths',
    safe_evidence_summary: 'known runtime truth fields recorded for take, analysis run, safe media state and supplied metadata',
    source_artefact_id: 'truth_state_map',
    source_path: 'known_truths',
    timestamp_source: 'not_timestamped_truth_state',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: truthStateMapAvailable ? ['structured_truth_state_ids_unavailable_in_current_truth_map_schema'] : [],
    confidence_or_strength: truthStateMapAvailable ? 'truth_state_map_runtime_fact' : null,
    blocker_codes: truthStateMapAvailable ? ['structured_truth_state_ids_unavailable'] : ['TruthStateMap_missing'],
  });
  addRuntimeFact({
    evidence_modality: 'resolver_truth',
    evidence_kind: 'component_truths',
    safe_evidence_summary: `component declaration status: ${input.component_or_task_declaration_status ?? 'unknown'}`,
    source_artefact_id: 'truth_state_map',
    source_path: 'component_truths.declaration_status',
    timestamp_source: 'not_timestamped_truth_state',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: truthStateMapAvailable ? ['structured_truth_state_ids_unavailable_in_current_truth_map_schema'] : [],
    confidence_or_strength: truthStateMapAvailable ? 'truth_state_map_runtime_fact' : null,
    blocker_codes: truthStateMapAvailable ? ['structured_truth_state_ids_unavailable'] : ['TruthStateMap_missing'],
  });
  addRuntimeFact({
    evidence_modality: 'resolver_truth',
    evidence_kind: 'comparison_truths',
    safe_evidence_summary: `comparison execution status: ${input.comparison_run_id ? 'comparison_context_present' : 'not_executed_single_take'}`,
    source_artefact_id: 'truth_state_map',
    source_path: 'comparison_truths.status',
    timestamp_source: 'not_timestamped_truth_state',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: truthStateMapAvailable ? ['structured_truth_state_ids_unavailable_in_current_truth_map_schema'] : [],
    confidence_or_strength: truthStateMapAvailable ? 'truth_state_map_runtime_fact' : null,
    blocker_codes: truthStateMapAvailable ? ['structured_truth_state_ids_unavailable'] : ['TruthStateMap_missing'],
  });
  const appendFilteredStep1Items = (items: Array<Record<string, unknown>>, familyPath: string) => {
    items.forEach((item, index) => {
      const evidenceModality = typeof item.evidence_modality === 'string' && ['video', 'audio', 'material', 'submission_context', 'resolver_truth', 'media_readiness', 'unknown'].includes(item.evidence_modality)
        ? item.evidence_modality as AnalysisObservableEvidenceItem['evidence_modality']
        : 'unknown';
      const evidenceKind = typeof item.evidence_kind === 'string' && item.evidence_kind.trim() ? item.evidence_kind.trim() : 'runEvidencePass_observation';
      const summary = typeof item.safe_evidence_summary === 'string' && item.safe_evidence_summary.trim()
        ? item.safe_evidence_summary.trim()
        : `${evidenceKind}: filtered runEvidencePass observation`;
      observable_evidence_items.push({
        evidence_item_id: `aes-${String(observable_evidence_items.length + 1).padStart(4, '0')}`,
        evidence_modality: evidenceModality,
        evidence_kind: evidenceKind,
        safe_evidence_summary: summary,
        source_artefact_id: 'run_evidence_pass',
        source_path: typeof item.source_path === 'string' && item.source_path.trim() ? item.source_path.trim() : `${familyPath}[${index}]`,
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : null,
        timestamp_range: null,
        timestamp_source: typeof item.timestamp_source === 'string' ? item.timestamp_source : 'not_timestamped_observation',
        component_id: typeof item.component_id === 'string' ? item.component_id : null,
        linked_truth_state_ids: Array.isArray(item.linked_truth_state_ids) ? item.linked_truth_state_ids.filter((x): x is string => typeof x === 'string') : [],
        assessability_limitations: Array.isArray(item.assessability_limitations) ? item.assessability_limitations.filter((x): x is string => typeof x === 'string') : [],
        confidence_or_strength: typeof item.confidence_or_strength === 'string' ? item.confidence_or_strength : 'runEvidencePass_observation',
        public_display_status: 'internal_only',
        blocker_codes: Array.isArray(item.blocker_codes) ? item.blocker_codes.filter((x): x is string => typeof x === 'string') : [],
        analysis_evidence_state_source_path: `${familyPath}[${index}]`,
      } as AnalysisObservableEvidenceItem & { analysis_evidence_state_source_path: string });
    });
  };
  appendFilteredStep1Items(step1VideoItems, 'video_observable_evidence_items');
  appendFilteredStep1Items(step1AudioItems, 'audio_observable_evidence_items');
  appendFilteredStep1Items(step1MaterialItems, 'material_observable_evidence_items');
  appendFilteredStep1Items(step1PerformanceItems, 'performance_observable_evidence_items');
  const candidate_brief_evidence = [
    {
      evidence_kind: 'brief_presence',
      status: input.brief_presence ?? 'unknown',
      source_artefact_id: 'resolver_output',
      source_path: 'brief_presence',
      safe_evidence_summary: 'brief presence only; downstream judgement not asserted',
      blocker_codes: resolverOutputAvailable ? [] : ['resolver_output_missing'],
    },
    {
      evidence_kind: 'material_presence',
      status: input.material_presence ?? 'unknown',
      source_artefact_id: 'resolver_output',
      source_path: 'material_presence',
      safe_evidence_summary: 'material presence only; downstream judgement not asserted',
      blocker_codes: resolverOutputAvailable ? [] : ['resolver_output_missing'],
    },
  ];
  const component_evidence = [
    {
      component_id: 'component_or_task_declaration',
      evidence_kind: 'component_or_task_declaration_status',
      status: input.component_or_task_declaration_status ?? 'unknown',
      source_artefact_id: 'analysis_submission',
      source_path: 'component_or_task_declaration_status',
      safe_evidence_summary: `component/task declaration status is ${input.component_or_task_declaration_status ?? 'unknown'}`,
      assessability_limitations: (input.component_or_task_declaration_status ?? 'unknown') === 'unknown' ? ['component_or_task_declaration_not_loaded'] : [],
      blocker_codes: (input.component_or_task_declaration_status ?? 'unknown') === 'unknown' ? ['component_or_task_declaration_unknown'] : [],
    },
  ];
  const performanceUnavailable = [
    {
      evidence_kind: 'video_observable_performance_evidence_not_extracted',
      status: 'not_extracted',
      reason: 'no_persisted_pre_raw_report_video_observable_evidence_extractor_wired_for_qa_promotion',
      blocker_codes: ['video_observable_performance_evidence_not_extracted'],
    },
    {
      evidence_kind: 'audio_observable_performance_evidence_not_extracted',
      status: 'not_extracted',
      reason: 'no_persisted_pre_raw_report_audio_observable_evidence_extractor_wired_for_qa_promotion',
      blocker_codes: ['audio_observable_performance_evidence_not_extracted'],
    },
    {
      evidence_kind: 'material_specific_performance_evidence_not_extracted',
      status: 'not_extracted',
      reason: 'brief/material presence metadata is available but performance achievement is not extracted in this Step 1 artefact',
      blocker_codes: ['material_specific_performance_evidence_not_extracted'],
    },
    {
      evidence_kind: 'candidate_technique_evidence_not_extracted',
      status: 'not_extracted',
      reason: 'no genuine persisted Step 1 technique extractor is available; legacy TechniqueObservationTrace is forbidden as a source',
      blocker_codes: ['candidate_technique_evidence_not_extracted'],
    },
  ];
  const filteredUnsupported = safeRecordArray(filteredStep1?.unsupported_or_unavailable_evidence);
  const filteredRejected = Array.isArray(filteredStep1?.rejected_or_filtered_fields)
    ? filteredStep1.rejected_or_filtered_fields.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const timestampNormalisationWarnings = Array.isArray(input.timestamp_normalisation_warnings)
    ? input.timestamp_normalisation_warnings.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const filteredBlockers = Array.isArray(filteredStep1?.blocker_codes)
    ? filteredStep1.blocker_codes.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const hasStep1Video = step1VideoItems.length > 0;
  const hasStep1Audio = step1AudioItems.length > 0;
  const hasStep1Material = step1MaterialItems.length > 0;
  const hasStep1Performance = step1PerformanceItems.length > 0;
  const hasStep1Technique = step1TechniqueItems.length > 0;
  const unsupportedOrUnavailableEvidence = [
    ...(filteredStep1 ? filteredUnsupported : performanceUnavailable),
    ...(filteredStep1 && !hasStep1Video && !filteredUnsupported.some((item) => String(item.evidence_kind ?? '').includes('video')) ? [performanceUnavailable[0]] : []),
    ...(filteredStep1 && !hasStep1Audio && !filteredUnsupported.some((item) => String(item.evidence_kind ?? '').includes('audio')) ? [performanceUnavailable[1]] : []),
    ...(filteredStep1 && !hasStep1Material && !filteredUnsupported.some((item) => String(item.evidence_kind ?? '').includes('material')) ? [performanceUnavailable[2]] : []),
    ...(filteredStep1 && !hasStep1Technique && !filteredUnsupported.some((item) => String(item.evidence_kind ?? '').includes('candidate_technique')) ? [performanceUnavailable[3]] : []),
  ];
  const step2DependencyBlockers = dedupePreservingOrder([
    ...(!resolverOutputAvailable ? ['resolver_output_missing'] : []),
    ...(!truthStateMapAvailable ? ['TruthStateMap_missing'] : []),
    ...(filteredStep1 && filteredStep1.extraction_status === 'blocked' ? ['runEvidencePass_filtered_step1_blocked'] : []),
  ]);
  const step2DependencyStatus = {
    status: step2DependencyBlockers.length > 0 ? 'blocked' : 'ready_with_limitations',
    can_run_step2: step2DependencyBlockers.length === 0,
    required_artefact_id: 'analysis_evidence_state',
    blocker_codes: step2DependencyBlockers,
  };
  const blocker_codes = dedupePreservingOrder([
    ...(hasFilteredStep1Items ? ['analysis_evidence_state_filtered_runEvidencePass_partial'] : ['analysis_evidence_state_partial_runtime_facts_only']),
    ...(!hasStep1Video ? ['video_observable_performance_evidence_not_extracted'] : []),
    ...(!hasStep1Audio ? ['audio_observable_performance_evidence_not_extracted'] : []),
    ...(!hasStep1Material ? ['material_specific_performance_evidence_not_extracted'] : []),
    ...(!hasStep1Technique ? ['candidate_technique_evidence_not_extracted'] : []),
    ...filteredBlockers,
    ...(filteredRejected.length > 0 ? ['runEvidencePass_prohibited_fields_filtered'] : []),
    ...(!resolverOutputAvailable ? ['resolver_output_missing'] : []),
    ...(!truthStateMapAvailable ? ['TruthStateMap_missing'] : []),
    ...(!durationKnown ? ['media_duration_unavailable'] : []),
    ...(truthStateMapAvailable ? ['structured_truth_state_ids_unavailable'] : []),
    ...step2DependencyBlockers,
  ]);
  const sourceClassification: 'real_runtime_v3' | 'unavailable' = observable_evidence_items.length > 0 ? 'real_runtime_v3' : 'unavailable';
  const evidenceStateStatus: 'partial' | 'unavailable' | 'blocked' = filteredStep1?.extraction_status === 'blocked'
    ? 'blocked'
    : (observable_evidence_items.length > 0 ? 'partial' : 'unavailable');
  const summary = {
    evidence_state_status: evidenceStateStatus,
    source_classification: sourceClassification,
    observable_evidence_item_count: observable_evidence_items.length,
    unsupported_or_unavailable_evidence_count: unsupportedOrUnavailableEvidence.length,
    filtered_runEvidencePass_observation_count: step1VideoItems.length + step1AudioItems.length + step1MaterialItems.length + step1PerformanceItems.length,
    rejected_or_filtered_field_count: filteredRejected.length,
    analysis_evidence_state_gate_status: 'insufficient' as const,
    analysis_evidence_state_gate_reason: hasFilteredStep1Items
      ? 'filtered_runEvidencePass_observations_persisted_but_step1_contract_partial'
      : (sourceClassification === 'real_runtime_v3'
        ? 'partial_runtime_facts_present_but_performance_extractor_unavailable'
        : 'genuine_step1_observable_evidence_source_unavailable'),
    step2_dependency_status: step2DependencyStatus.status,
  };
  const filteredEvidenceFamilyCoverage = isRecord(filteredStep1?.evidence_family_coverage)
    ? filteredStep1.evidence_family_coverage
    : {
      video: hasStep1Video,
      audio: hasStep1Audio,
      material: hasStep1Material,
      performance: hasStep1Performance,
      candidate_technique: hasStep1Technique,
    };
  const filteredFamilyStatus = isRecord(filteredStep1?.evidence_family_status_by_id)
    ? filteredStep1.evidence_family_status_by_id
    : {
      video: hasStep1Video ? 'partial' : 'not_extracted',
      audio: hasStep1Audio ? 'partial' : 'not_extracted',
      material: hasStep1Material ? 'partial' : 'not_extracted',
      performance: hasStep1Performance ? 'partial' : 'not_extracted',
      candidate_technique: hasStep1Technique ? 'partial' : 'not_extracted',
    };
  const prohibitedFieldFilterSummary = isRecord(filteredStep1?.prohibited_field_filter_summary)
    ? {
      ...filteredStep1.prohibited_field_filter_summary,
      raw_values_persisted: false,
    }
    : {
      rejected_field_count: 0,
      rejected_field_keys: [],
      raw_values_persisted: false,
    };
  const payload = {
    schema_version: 'tapecoach_v3_analysis_evidence_state_v1',
    artefact_type: 'analysis_evidence_state',
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    generated_at: generatedAt,
    internal_only: true,
    privacy_classification: 'internal_private',
    source_classification: sourceClassification,
    evidence_state_status: evidenceStateStatus,
    cannot_satisfy_v3_gate: true,
    source_stage: 'analysis_step_1_evidence_mapping',
    source_module: input.source_module,
    source_trigger_stage: input.source_stage,
    analysis_route: input.analysis_route ?? null,
    extractor_run_id: hasFilteredStep1Items ? `extractor-${analysisRunId}` : null,
    extractor_source_module: hasFilteredStep1Items ? 'src/server/evidence-pass.server.ts' : null,
    extractor_source_stage: hasFilteredStep1Items ? 'runEvidencePass_filtered_before_step2' : 'deterministic_runtime_fact_mapping',
    extractor_input_refs: hasFilteredStep1Items ? {
      media_input: 'runEvidencePass.videoUrl redacted',
      context_text: 'runEvidencePass.contextText redacted',
    } : {},
    extractor_model_ref: typeof filteredStep1?.extractor_model_ref === 'string' ? filteredStep1.extractor_model_ref : null,
    extraction_status: evidenceStateStatus,
    evidence_family_coverage: filteredEvidenceFamilyCoverage,
    evidence_family_status_by_id: filteredFamilyStatus,
    input_artifact_refs: inputArtifactRefs,
    resolver_output_ref: resolverOutputAvailable ? `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver/resolver_output.json` : null,
    truth_state_map_ref: truthStateMapAvailable ? `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver/TruthStateMap.json` : null,
    media_readiness_summary: {
      media_readiness_state: input.media_readiness_state ?? null,
      media_duration_seconds: durationKnown ? input.media_duration_seconds : null,
      duration_confidence: durationConfidence,
      timestamp_source: durationKnown ? 'media_readiness_runtime_field' : 'unavailable',
      mux_playback_id_present: Boolean(input.mux_playback_id),
      mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? 'unknown',
    },
    assessability_limitations: [
      ...(!durationKnown ? ['media_duration_unavailable_no_timestamp_evidence_fabricated'] : []),
      ...timestampNormalisationWarnings,
      ...(hasFilteredStep1Items ? ['filtered_runEvidencePass_step1_contract_partial'] : ['observable_step1_extraction_unavailable']),
    ],
    timestamp_normalisation_warnings: timestampNormalisationWarnings,
    component_evidence,
    video_observable_evidence_items: step1VideoItems,
    audio_observable_evidence_items: step1AudioItems,
    material_observable_evidence_items: step1MaterialItems,
    performance_observable_evidence_items: step1PerformanceItems,
    observable_evidence_items,
    candidate_brief_evidence,
    candidate_technique_evidence: step1TechniqueItems,
    unsupported_or_unavailable_evidence: unsupportedOrUnavailableEvidence,
    rejected_or_filtered_fields: filteredRejected,
    prohibited_field_filter_summary: prohibitedFieldFilterSummary,
    step2_dependency_status: step2DependencyStatus,
    blocker_codes,
    gate_satisfaction_reason: summary.analysis_evidence_state_gate_reason,
    public_output_unchanged: true,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    redaction_notes: ['Internal-only QA prerequisite; unsafe external media references and raw report payloads are excluded'],
    analysis_evidence_state_summary: summary,
    ...resolveQADeploymentProvenance(),
  };
  const relPath = `takes/take-${input.take_id}/analysis-${analysisRunId}/analysis/AnalysisEvidenceState.json`;
  const w = await writeInternalJson(root, input.run_id, relPath, payload, 'analysis_evidence_state');
  return {
    written: Boolean(w.written),
    emitted_artefact_ids: [] as string[],
    emitted_blocked_artefact_ids: w.written ? ['analysis_evidence_state'] : [],
    path: w.path ?? w.storage_path,
    source_classification: sourceClassification,
    level2_satisfies: false as const,
    summary,
    blocker_codes,
    payload,
    warning: w.warning,
  };
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
