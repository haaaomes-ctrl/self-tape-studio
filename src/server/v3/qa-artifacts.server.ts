import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  manifest_relative_path?: string;

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
  comparison_run_id?: string | null;
  submission_id?: string;
  take_id?: string;
  compared_take_ids?: string[];
  deferred_artefact_ids?: string[];
  not_applicable_artefact_ids?: string[];
  runtime_evidence_accepted_by_id?: string[];
  runtime_evidence_blocked_by_id?: string[];
  artefact_source_classification_by_id?: Record<string, string>;
  artefact_level2_spine_satisfaction_by_id?: Record<string, boolean>;
  legacy_adapter_artefact_ids?: string[];
  real_v3_spine_artefact_ids?: string[];
  defect_risk_ids?: string[];
  public_claim_trace_summary?: {
    claim_count?: number;
    unsupported_claim_count?: number;
    legacy_untraced_claim_count?: number;
    unsafe_or_overclaim_count?: number;
    rewrite_required_count?: number;
    supported_claim_count?: number;
    missing_evidence_count?: number;
    missing_truth_link_count?: number;
    blocked_claim_count?: number;
    public_claim_gate_status?: string;
    public_claim_gate_reason?: string;
    source_classification?: string;
    public_output_unchanged?: boolean;
    blocker_codes?: string[];
  };
  claim_candidate_trace_summary?: {
    claim_candidate_count?: number;
    source_classification?: string;
    claim_candidate_source_summary?: Record<string, number>;
    blocked_candidate_count?: number;
    rewrite_required_count?: number;
    unsupported_candidate_count?: number;
    safe_candidate_count?: number;
    claim_candidate_gate_status?: 'missing' | 'insufficient';
    claim_candidate_gate_reason?: string;
  };
  technique_observation_trace_summary?: {
    legacy_adapter: number;
    report_snapshot: number;
    real_runtime_v3: number;
    input_artifact: number;
    resolver_truth_state: number;
  };
  score_trace_summary?: {
    score_count: number;
    overall_count: number;
    discipline_attribute_count: number;
    component_score_count: number;
    component_weight_count: number;
    brief_adherence_subscore_count: number;
    assessment_confidence_count: number;
    calibration_modifier_count: number;
    calibration_metadata_count: number;
    source_family_summary: { legacy_adapter: number; report_snapshot: number; real_runtime_v3: number; input_artifact: number; resolver_truth_state: number; };
    overall_readiness_public_score_status: 'blocked';
    discipline_attribute_score_trace_status: 'internal_trace_only';
    score_trace_gate_status: 'insufficient';
    score_trace_gate_reason: 'legacy_report_snapshot_not_real_runtime_score_trace';
  };
  model_run_trace_summary?: {
    model_run_count?: number;
    model_run_completed_count?: number;
    model_run_failed_count?: number;
    model_run_timeout_count?: number;
    model_run_fallback_count?: number;
    model_run_trace_gate_status?: 'insufficient' | 'missing' | 'satisfied';
    model_run_trace_gate_reason?: string;
  };
  analysis_evidence_state_summary?: {
    evidence_state_status?: 'complete' | 'partial' | 'unavailable' | 'failed' | 'blocked';
    source_classification?: string;
    observable_evidence_item_count?: number;
    unsupported_or_unavailable_evidence_count?: number;
    analysis_evidence_state_gate_status?: 'missing' | 'insufficient' | 'satisfied';
    analysis_evidence_state_gate_reason?: string;
    qa_persistence_status?: 'written' | 'failed_emission' | 'unavailable' | 'skipped' | 'fallback_logged';
    qa_persistence_warning?: string | null;
  };
  media_identity_summary?: {
    media_identity_status?: 'complete' | 'partial' | 'unavailable' | 'failed' | string;
    available_signal_count?: number;
    unavailable_signal_count?: number;
    media_identity_gate_status?: 'insufficient' | 'missing' | 'satisfied' | string;
    media_identity_blocker_codes?: string[];
    cannot_satisfy_duplicate_detection_gate?: boolean;
  };
  evidence_anchor_trace_summary?: {
    anchor_count?: number;
    real_runtime_anchor_count?: number;
    legacy_adapter_anchor_count?: number;
    blocked_anchor_count?: number;
    source_family_summary?: { legacy_adapter: number; report_snapshot: number; real_runtime_v3: number; input_artifact: number; resolver_truth_state: number; source_scaffold?: number; };
    evidence_anchor_gate_status?: 'missing' | 'insufficient' | 'satisfied' | 'sufficient';
    evidence_anchor_gate_reason?: string;
    blocker_codes?: string[];
  };
  report_parity_summary?: {
    parity_status?: 'passed' | 'failed' | 'insufficient' | 'missing' | string;
  };
  validator_trace_summary?: Record<string, unknown>;
  gate_trace_summary?: Record<string, unknown>;
}

export const DEFAULT_ROOT = 'qa-artifacts';
const DEFAULT_SCHEMA_VERSION = 'tapecoach_v3_internal_qa_manifest_v1';
const DEFAULT_EMITTER_VERSION = '0.2.0';
const RELEASE_STATE = 'planning_dark_mode_internal_only';
const BLOCKED_STATUS = 'blocked';
const P0_CODE = 'same_video_false_winner_active_P0';
const S9_14_CONTAINED_TRACE_IDS = new Set(['analysis_evidence_state', 'evidence_anchors', 'public_claim_trace']);

const REQUIRED: Omit<QARequiredArtefact, 'status' | 'blocker_code' | 'reason'>[] = [
  { artefact_id: 'analysis_input_record', name: 'input record', expected_path: 'inputs/input_record.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'analysis_submission', name: 'submission', expected_path: 'inputs/submission.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'analysis_take', name: 'take', expected_path: 'inputs/take.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'resolver_output', name: 'resolver output', expected_path: 'resolver/resolver_output.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'truth_state_map', name: 'TruthStateMap', expected_path: 'resolver/TruthStateMap.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'analysis_evidence_state', name: 'AnalysisEvidenceState', expected_path: 'analysis/AnalysisEvidenceState.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: ['resolver_output', 'truth_state_map'] },
  { artefact_id: 'evidence_anchors', name: 'EvidenceAnchors', expected_path: 'traces/EvidenceAnchors.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'public_claim_trace', name: 'PublicClaimTrace', expected_path: 'traces/PublicClaimTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'technique_observation_trace', name: 'TechniqueObservationTrace', expected_path: 'traces/TechniqueObservationTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'score_trace', name: 'ScoreTrace', expected_path: 'traces/ScoreTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'validator_trace', name: 'ValidatorTrace', expected_path: 'traces/ValidatorTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'gate_trace', name: 'GateTrace', expected_path: 'traces/GateTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'model_run_trace', name: 'ModelRunTrace', expected_path: 'traces/ModelRunTrace.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'raw_report', name: 'raw report', expected_path: 'reports/raw_report.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'comparison_raw', name: 'comparison raw', expected_path: 'comparison/comparison.raw.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'comparison_report_internal', name: 'comparison report internal', expected_path: 'comparison/comparison.report.internal.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'same_video_repeatability_trace', name: 'same video repeatability trace', expected_path: 'comparison_traces/same_video_repeatability_trace.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: [] },
  { artefact_id: 'duplicate_detection_trace', name: 'duplicate detection trace', expected_path: 'comparison/duplicate_detection_trace.json', category: 'comparison_run', required_for_level: 'L2', linked_artifacts: ['same_video_repeatability_trace', 'comparison_suppression_trace'] },
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
  resolver_output: 'resolver_output_missing', analysis_evidence_state: 'AnalysisEvidenceState_missing', same_video_repeatability_trace: 'same_video_repeatability_trace_missing', route_variance_trace: 'route_variance_trace_missing',
  duplicate_detection_trace: 'duplicate_detection_trace_missing', comparison_suppression_trace: 'comparison_suppression_trace_missing', no_export_proof: 'no_export_proof_missing', no_export_ui_proof: 'no_export_proof_missing', parity_report: 'parity_artefacts_missing', parity_comparison: 'parity_artefacts_missing',
  validator_trace: 'validator_trace_missing', gate_trace: 'gate_trace_missing',
  comparison_report_internal: 'comparison_report_unavailable',
};
const REQUIRED_ARTEFACT_ID_SET = new Set(REQUIRED.map((artefact) => artefact.artefact_id));
const COMPARISON_REQUIRED_ARTEFACT_IDS = new Set([
  'comparison_raw',
  'comparison_report_internal',
  'same_video_repeatability_trace',
  'duplicate_detection_trace',
  'comparison_suppression_trace',
  'route_variance_trace',
  'parity_comparison',
]);
const NO_EXPORT_REQUIRED_ARTEFACT_IDS = [
  'no_export_proof',
  'no_export_source_proof',
  'no_export_config_proof',
  'no_export_ui_proof',
  'no_export_log_proof',
] as const;

function stripRepeatedTakePrefixes(value: string): string {
  let core = String(value ?? '').trim();
  while (core.startsWith('take-')) core = core.slice(5);
  return core;
}

function normaliseComparedTakeIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const core = stripRepeatedTakePrefixes(value);
    if (!core || seen.has(core)) continue;
    seen.add(core);
    out.push(core);
  }
  return out;
}

function comparisonInvokedForManifest(manifest: Record<string, any>): boolean {
  const statusById = manifest.artefact_status_by_id ?? {};
  const comparedTakeIds = normaliseComparedTakeIds(manifest.compared_take_ids);
  return Boolean(manifest.comparison_run_id)
    || comparedTakeIds.length > 1
    || [...COMPARISON_REQUIRED_ARTEFACT_IDS].some((id) => {
      const status = statusById[id];
      return status === 'emitted' || status === 'emitted_blocked';
    });
}

function comparisonGateAppliesForManifest(manifest: Record<string, any>): boolean {
  return comparisonInvokedForManifest(manifest)
    || manifest.fixture_id === 'GF-01 / RT-15 / MT-same-video-20260511';
}

const BASE_REAL_RUNTIME_V3_ARTEFACT_IDS = new Set([
  'analysis_input_record',
  'analysis_submission',
  'analysis_take',
  'resolver_output',
  'truth_state_map',
]);
const NEVER_ACCEPTED_RUNTIME_EVIDENCE_IDS = new Set([
  'qa_acceptance_metrics',
  'claim_candidate_trace',
  'media_identity',
]);
const NON_ACCEPTED_SOURCE_CLASSIFICATION_PATTERNS = [
  'legacy_adapter',
  'source_scaffold',
  'first_pass_internal',
  'report_snapshot',
  'internal_validator',
  'internal_gate_trace',
  'internal_model_run_trace',
  'internal_comparison_runtime',
  'internal_comparison_report',
  'internal_comparison_trace',
  'internal_no_export',
  'missing',
  'unavailable',
];

function blockerCodeForRequiredArtefact(artefactId: string, status: string): string | undefined {
  if (artefactId === 'analysis_evidence_state') {
    if (status === 'missing') return 'AnalysisEvidenceState_missing';
    if (status === 'emitted_blocked') return 'AnalysisEvidenceState_insufficient';
    if (status === 'failed_emission') return 'AnalysisEvidenceState_failed_emission';
    if (status === 'deferred' || status === 'unavailable') return 'AnalysisEvidenceState_unavailable';
  }
  return BLOCKERS[artefactId];
}

function fallbackSourceFamilySummary(sourceClassification: unknown) {
  const source = typeof sourceClassification === 'string' ? sourceClassification : '';
  return {
    real_runtime_v3: source === 'real_runtime_v3' || source.includes('real_runtime_v3_partial') ? 1 : 0,
    legacy_adapter: source.includes('legacy_adapter') ? 1 : 0,
    report_snapshot: source === 'report_snapshot' ? 1 : 0,
    input_artifact: source === 'input_artifact' ? 1 : 0,
    resolver_truth_state: source === 'resolver_truth_state' ? 1 : 0,
  };
}

function sourceFamilyCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function resolveEvidenceAnchorSourceFamilySummary(summary: Record<string, any>, sourceClassification: unknown) {
  if (summary.source_family_summary && typeof summary.source_family_summary === 'object') return summary.source_family_summary;
  const hasCounts = [
    'real_runtime_anchor_count',
    'legacy_adapter_anchor_count',
    'report_snapshot_anchor_count',
  ].some((key) => key in summary);
  if (hasCounts) {
    return {
      real_runtime_v3: sourceFamilyCount(summary.real_runtime_anchor_count),
      legacy_adapter: sourceFamilyCount(summary.legacy_adapter_anchor_count),
      report_snapshot: sourceFamilyCount(summary.report_snapshot_anchor_count),
      input_artifact: sourceFamilyCount(summary.input_artifact_anchor_count),
      resolver_truth_state: sourceFamilyCount(summary.resolver_truth_state_anchor_count),
      source_scaffold: sourceFamilyCount(summary.source_scaffold_anchor_count),
    };
  }
  return fallbackSourceFamilySummary(sourceClassification);
}

function resolveNoExportStatus(artefactStatusById: Record<string, string>): string {
  const statuses = NO_EXPORT_REQUIRED_ARTEFACT_IDS.map((id) => artefactStatusById[id] ?? 'missing');
  if (statuses.every((status) => status === 'emitted')) return 'no_export_proof_complete';
  if (statuses.some((status) => status === 'emitted_blocked')) return 'no_export_proof_insufficient';
  return 'no_export_proof_missing';
}


function safeExists(filePath: unknown): boolean {
  if (typeof filePath !== 'string' || !filePath.trim()) return false;
  try { return existsSync(filePath); } catch { return false; }
}

function safeJoin(...segments: Array<string | null | undefined>): string | null {
  if (segments.some((s) => typeof s !== 'string' || !s.trim())) return null;
  try { return path.join(...(segments as string[])); } catch { return null; }
}

export function findProjectRootFrom(startDir: unknown): string | null {
  if (typeof startDir !== 'string' || !startDir.trim()) return null;
  let current: string;
  try {
    current = path.resolve(startDir);
  } catch {
    return null;
  }
  while (true) {
    const packagePath = safeJoin(current, 'package.json');
    const srcMarkerPath = safeJoin(current, 'src', 'server', 'v3', 'qa-artifacts.server.ts');
    const distMarkerPath = safeJoin(current, 'dist', 'server');
    const readmePath = safeJoin(current, 'README.md');
    const hasPackage = safeExists(packagePath);
    const hasSrcMarker = safeExists(srcMarkerPath) || safeExists(distMarkerPath);
    const hasReadme = safeExists(readmePath);
    if (hasPackage || hasSrcMarker || hasReadme) return current;
    let parent: string;
    try { parent = path.dirname(current); } catch { return null; }
    if (parent === current) return null;
    current = parent;
  }
}

function resolveModuleDirForQAManifest(): string | null {
  try {
    const metaUrl = import.meta?.url;
    if (typeof metaUrl !== 'string' || !metaUrl.trim()) return null;
    const filePath = fileURLToPath(metaUrl);
    if (typeof filePath !== 'string' || !filePath.trim()) return null;
    return path.dirname(filePath);
  } catch {
    return null;
  }
}

function resolveExplicitProjectRootOverride(env: NodeJS.ProcessEnv = process.env): string | null {
  const qaCandidate = env.QA_PROJECT_ROOT;
  if (typeof qaCandidate === 'string' && qaCandidate.trim()) {
    try {
      const resolved = path.resolve(qaCandidate);
      if (safeExists(resolved)) return resolved;
    } catch {}
  }
  const projectCandidate = env.PROJECT_ROOT;
  if (typeof projectCandidate === 'string' && projectCandidate.trim()) {
    try {
      const resolved = path.resolve(projectCandidate);
      if (safeExists(resolved)) return resolved;
    } catch {}
  }
  return null;
}

export function resolveProjectRootForQAManifest(): string {
  const explicitRoot = resolveExplicitProjectRootOverride();
  if (explicitRoot) return explicitRoot;
  const candidates: Array<string | null> = [];
  candidates.push(resolveModuleDirForQAManifest());
  try { candidates.push(process.cwd()); } catch {}
  for (const candidate of candidates) {
    const root = findProjectRootFrom(candidate);
    if (root) return root;
  }
  try { return process.cwd(); } catch { return '.'; }
}
export function assertSafeSegment(value: string, field: string) {
  if (
    !/^[A-Za-z0-9._/-]+$/.test(value)
    || value.includes('..')
    || path.isAbsolute(value)
    || value.split('/').some((segment) => segment === '' || segment === '.')
  ) throw new Error(`${field}_invalid_path`);
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

function isCommitLike(value: unknown): value is string {
  return typeof value === 'string' && /^[a-fA-F0-9]{7,64}$/.test(value.trim());
}
function isSafeRefLike(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._/-]{1,120}$/.test(value.trim());
}

function firstPresent(env: NodeJS.ProcessEnv, keys: string[]): string | null {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
function firstValidPresent(
  env: Record<string, string | undefined>,
  keys: readonly string[],
  validator: (value: string) => boolean,
): { value: string | null; source_key: string | null; invalid_keys_seen: string[]; present_keys_seen: string[] } {
  const invalid_keys_seen: string[] = [];
  const present_keys_seen: string[] = [];
  for (const key of keys) {
    const raw = env[key];
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    present_keys_seen.push(key);
    if (!validator(value)) {
      invalid_keys_seen.push(key);
      continue;
    }
    return { value, source_key: key, invalid_keys_seen, present_keys_seen };
  }
  return { value: null, source_key: null, invalid_keys_seen, present_keys_seen };
}

export function resolveQADeploymentProvenance(env: NodeJS.ProcessEnv = process.env) {
  const SAFE_DEPLOYMENT_PROVENANCE_ENV_KEYS = ['BUILD_COMMIT_SHA', 'COMMIT_SHA', 'GIT_SHA', 'GIT_COMMIT_SHA', 'SOURCE_VERSION', 'GITHUB_SHA', 'GITHUB_REF_NAME', 'BRANCH_NAME', 'GIT_BRANCH_NAME', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_DEPLOYMENT_ID', 'CF_PAGES_COMMIT_SHA', 'CF_PAGES_BRANCH', 'LOVABLE_GIT_COMMIT_SHA', 'LOVABLE_DEPLOYMENT_ID', 'DEPLOYMENT_REVISION'] as const;
  const commitKeys = ['VERCEL_GIT_COMMIT_SHA', 'LOVABLE_GIT_COMMIT_SHA', 'BUILD_COMMIT_SHA', 'COMMIT_SHA', 'GIT_SHA', 'GIT_COMMIT_SHA', 'SOURCE_VERSION', 'GITHUB_SHA', 'CF_PAGES_COMMIT_SHA'] as const;
  const branchKeys = ['VERCEL_GIT_COMMIT_REF', 'CF_PAGES_BRANCH', 'GITHUB_REF_NAME', 'BRANCH_NAME', 'GIT_BRANCH_NAME'] as const;
  const deploymentKeys = ['VERCEL_DEPLOYMENT_ID', 'LOVABLE_DEPLOYMENT_ID', 'DEPLOYMENT_REVISION'] as const;
  const commitResolved = firstValidPresent(env, commitKeys, (value) => isCommitLike(value));
  const branchResolved = firstValidPresent(env, branchKeys, (value) => isSafeRefLike(value));
  const deploymentResolved = firstValidPresent(env, deploymentKeys, (value) => isSafeRefLike(value));
  const hasAnySafeValue = SAFE_DEPLOYMENT_PROVENANCE_ENV_KEYS.some((key) => typeof env[key] === 'string' && env[key]?.trim().length);
  const acceptedCommit = commitResolved.value;
  const sourceBranch = branchResolved.value ?? 'unknown';
  const deploymentRevision = deploymentResolved.value ?? 'unknown';
  const acceptedAny = Boolean(acceptedCommit || sourceBranch !== 'unknown' || deploymentRevision !== 'unknown');
  const invalidPresentValues = hasAnySafeValue && !acceptedAny;
  const invalidSourcesIgnored = [...new Set([...commitResolved.invalid_keys_seen, ...branchResolved.invalid_keys_seen, ...deploymentResolved.invalid_keys_seen])];
  const resolvedSources = {
    ...(commitResolved.source_key ? { build_commit_sha: commitResolved.source_key } : {}),
    ...(branchResolved.source_key ? { source_branch: branchResolved.source_key } : {}),
    ...(deploymentResolved.source_key ? { deployment_revision: deploymentResolved.source_key } : {}),
  };
  return {
    build_commit_sha: acceptedCommit ?? 'unknown',
    deployment_revision: deploymentRevision,
    source_branch: sourceBranch,
    deployment_provenance_status: acceptedAny ? 'resolved' : (invalidPresentValues ? 'invalid_env_value_ignored' : 'unknown_no_safe_env_var_found'),
    deployment_provenance_sources_checked: SAFE_DEPLOYMENT_PROVENANCE_ENV_KEYS,
    deployment_provenance_resolved_sources: resolvedSources,
    deployment_provenance_invalid_sources_ignored: invalidSourcesIgnored,
    qa_emitter_version: 'xfix-v3-s9-hygiene-provenance-v1',
    storage_path_mapper_version: 'expanded-storage-mode-paths-v1',
    qa_finaliser_version: 'xfix-v3-s9-hygiene-provenance-v1',
  } as const;
}



export function buildQAAcceptanceMetrics(manifest: Record<string, any>) {
  const emitted = manifest.emitted_artifacts ?? [];
  const missing = manifest.missing_artifacts ?? [];
  const emittedBlocked = manifest.emitted_blocked_artefact_ids ?? [];
  const deferred = manifest.deferred_artifact_ids ?? [];
  const notApplicable = manifest.not_applicable_artifact_ids ?? [];
  const defects = [...new Set(manifest.defect_risk_ids ?? [])];
  const sourceClassById = manifest.artefact_source_classification_by_id ?? {};
  const spineById = manifest.artefact_level2_spine_satisfaction_by_id ?? {};
  const analysisEvidenceStateStatus = manifest.artefact_status_by_id?.analysis_evidence_state ?? 'missing';
  const analysisEvidenceStateGateStatus = analysisEvidenceStateStatus === 'missing' ? 'missing' : (spineById.analysis_evidence_state === true && sourceClassById.analysis_evidence_state === 'real_runtime_v3' ? 'satisfied' : 'insufficient');
  const evidenceAnchorStatus = manifest.artefact_status_by_id?.evidence_anchors ?? 'missing';
  const publicClaimStatus = manifest.artefact_status_by_id?.public_claim_trace ?? 'missing';
  const claimCandidateStatus = manifest.artefact_status_by_id?.claim_candidate_trace ?? 'missing';
  const evidenceAnchorGateStatus = evidenceAnchorStatus === 'missing' ? 'missing' : (spineById.evidence_anchors === true && sourceClassById.evidence_anchors === 'real_runtime_v3' ? 'sufficient' : 'insufficient');
  const publicClaimGateStatus = publicClaimStatus === 'missing' ? 'missing' : (spineById.public_claim_trace === true && ['real_runtime_v3', 'real_runtime_v3_claim_support'].includes(String(sourceClassById.public_claim_trace)) ? 'sufficient' : 'insufficient');
  const claimCandidateGateStatus = claimCandidateStatus === 'missing' ? 'missing' : 'insufficient';

  const techniqueObservationStatus = manifest.artefact_status_by_id?.technique_observation_trace ?? 'missing';
  const scoreTraceStatus = manifest.artefact_status_by_id?.score_trace ?? 'missing';
  const techniqueObservationGateStatus = techniqueObservationStatus === 'missing' ? 'missing' : (spineById.technique_observation_trace === true ? 'satisfied' : 'insufficient');
  const scoreTraceGateStatus = scoreTraceStatus === 'missing' ? 'missing' : (spineById.score_trace === true ? 'satisfied' : 'insufficient');
  const techniqueObservationSourceSummary = manifest.technique_observation_trace_summary ?? {
    real_runtime_v3: sourceClassById.technique_observation_trace === 'real_runtime_v3' ? 1 : 0,
    legacy_adapter: sourceClassById.technique_observation_trace === 'legacy_adapter' ? 1 : 0,
    report_snapshot: sourceClassById.technique_observation_trace === 'report_snapshot' ? 1 : 0,
    input_artifact: sourceClassById.technique_observation_trace === 'input_artifact' ? 1 : 0,
    resolver_truth_state: sourceClassById.technique_observation_trace === 'resolver_truth_state' ? 1 : 0,
  };
  const evidenceAnchorTraceSummary = manifest.evidence_anchor_trace_summary ?? {};
  const evidenceAnchorSourceSummary = resolveEvidenceAnchorSourceFamilySummary(evidenceAnchorTraceSummary, sourceClassById.evidence_anchors);
  const publicClaimSummary = manifest.public_claim_trace_summary ?? {
    claim_count: 0,
    unsupported_claim_count: 0,
    legacy_untraced_claim_count: 0,
    unsafe_or_overclaim_count: 0,
    rewrite_required_count: 0,
  };
  const claimCandidateSummary = manifest.claim_candidate_trace_summary ?? {
    claim_candidate_count: 0,
    source_classification: sourceClassById.claim_candidate_trace ?? 'missing',
    claim_candidate_source_summary: {
      real_runtime_v3: sourceClassById.claim_candidate_trace === 'real_runtime_v3_candidate_source' ? 1 : 0,
      legacy_adapter: sourceClassById.claim_candidate_trace === 'legacy_or_unsupported' ? 1 : 0,
      report_candidate_requires_support: 0,
      first_pass_internal: 0,
      blocked: 0,
    },
    blocked_candidate_count: 0,
    rewrite_required_count: 0,
    unsupported_candidate_count: 0,
    safe_candidate_count: 0,
    claim_candidate_gate_status: claimCandidateGateStatus,
    claim_candidate_gate_reason: claimCandidateStatus === 'missing' ? 'trace_not_emitted' : 'claim_candidate_trace_internal_only_not_public_claim_gate_evidence',
  };
  const fallbackAnalysisEvidenceStateStatus = (() => {
    if (analysisEvidenceStateStatus === 'missing') return 'unavailable';
    if (analysisEvidenceStateStatus === 'emitted_blocked') return 'blocked';
    if (analysisEvidenceStateStatus === 'failed_emission') return 'failed';
    if (analysisEvidenceStateStatus === 'emitted') return 'partial';
    return 'unavailable';
  })();
  const analysisEvidenceStateSummary = manifest.analysis_evidence_state_summary ?? {
    evidence_state_status: fallbackAnalysisEvidenceStateStatus,
    source_classification: sourceClassById.analysis_evidence_state ?? 'missing',
    observable_evidence_item_count: 0,
    unsupported_or_unavailable_evidence_count: analysisEvidenceStateStatus === 'missing' ? 1 : 0,
    analysis_evidence_state_gate_status: analysisEvidenceStateGateStatus,
    analysis_evidence_state_gate_reason: analysisEvidenceStateStatus === 'missing' ? 'analysis_evidence_state_not_emitted' : 'analysis_evidence_state_not_real_runtime_v3',
  };

  const scoreTraceSummary = manifest.score_trace_summary ?? {
    score_count: 0,
    overall_count: 0,
    discipline_attribute_count: 0,
    component_score_count: 0,
    component_weight_count: 0,
    brief_adherence_subscore_count: 0,
    assessment_confidence_count: 0,
    calibration_modifier_count: 0,
    calibration_metadata_count: 0,
    source_family_summary: {
      real_runtime_v3: sourceClassById.score_trace === 'real_runtime_v3' ? 1 : 0,
      legacy_adapter: sourceClassById.score_trace === 'legacy_adapter' ? 1 : 0,
      report_snapshot: sourceClassById.score_trace === 'report_snapshot' ? 1 : 0,
      input_artifact: sourceClassById.score_trace === 'input_artifact' ? 1 : 0,
      resolver_truth_state: sourceClassById.score_trace === 'resolver_truth_state' ? 1 : 0,
    },
    overall_readiness_public_score_status: 'blocked',
    discipline_attribute_score_trace_status: scoreTraceStatus === 'emitted' ? 'internal_trace_only' : 'missing',
    score_trace_gate_status: scoreTraceGateStatus,
    score_trace_gate_reason: scoreTraceGateStatus === 'satisfied' ? 'real_runtime_v3_support_present' : (scoreTraceStatus === 'missing' ? 'trace_not_emitted' : 'legacy_report_snapshot_not_real_runtime_score_trace'),
  };
  const validatorTraceStatus = manifest.artefact_status_by_id?.validator_trace ?? 'missing';
  const gateTraceStatus = manifest.artefact_status_by_id?.gate_trace ?? 'missing';
  const modelRunTraceStatus = manifest.artefact_status_by_id?.model_run_trace ?? 'missing';
  const modelRunTraceGateStatus = modelRunTraceStatus === 'missing' ? 'missing' : (spineById.model_run_trace === true ? 'satisfied' : 'insufficient');
  const modelRunTraceSummary = manifest.model_run_trace_summary ?? {
    model_run_count: 0,
    model_run_completed_count: 0,
    model_run_failed_count: 0,
    model_run_timeout_count: 0,
    model_run_fallback_count: 0,
    model_run_trace_gate_status: modelRunTraceGateStatus,
    model_run_trace_gate_reason: modelRunTraceStatus === 'missing' ? 'trace_not_emitted' : 'runtime_metadata_without_independent_model_proof_chain',
  };
  const validatorTraceSummary = manifest.validator_trace_summary ?? {};
  const gateTraceSummary = manifest.gate_trace_summary ?? {};
  const validatorTraceGateStatus: 'missing' | 'insufficient' | 'satisfied' = validatorTraceStatus === 'missing' ? 'missing' : 'insufficient';
  const gateTraceGateStatus: 'missing' | 'insufficient' | 'satisfied' = gateTraceStatus === 'missing' ? 'missing' : 'insufficient';
  const mediaIdentityStatus = manifest.artefact_status_by_id?.media_identity ?? 'missing';
  const mediaIdentitySummary = manifest.media_identity_summary ?? {};
  const mediaIdentityBlockerCodes = Array.isArray(mediaIdentitySummary.media_identity_blocker_codes)
    ? mediaIdentitySummary.media_identity_blocker_codes
    : [];

  const tracesEmitted = evidenceAnchorStatus === 'emitted' && publicClaimStatus === 'emitted';
  const comparisonApplies = comparisonGateAppliesForManifest(manifest);
  const comparisonInvoked = comparisonInvokedForManifest(manifest);
  const comparisonArtefactIds = ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'duplicate_detection_trace', 'comparison_suppression_trace', 'route_variance_trace'];
  const comparisonEmittedCount = comparisonArtefactIds.filter((id) => manifest.artefact_status_by_id?.[id] === 'emitted').length;
  const comparisonEvidenceStatus = !comparisonInvoked
    ? 'not_applicable'
    : (comparisonEmittedCount === comparisonArtefactIds.length ? 'insufficient' : (comparisonEmittedCount > 0 ? 'partial' : 'missing'));
  const gf01Rt15Status = comparisonApplies ? 'blocked' : 'not_applicable';
  const evidenceAnchorHasPartialRealRuntime =
    sourceFamilyCount(evidenceAnchorSourceSummary.real_runtime_v3) > 0
    || String(sourceClassById.evidence_anchors ?? '').includes('real_runtime_v3_partial');
  const noExportStatus = String(manifest.no_export_status ?? 'blocked');
  const parityArtefactStatus = String(manifest.artefact_status_by_id?.parity_report ?? 'missing');
  const rawReportParitySummary = manifest.report_parity_summary && typeof manifest.report_parity_summary === 'object'
    ? manifest.report_parity_summary
    : {};
  const rawReportParityStatus = typeof rawReportParitySummary.parity_status === 'string'
    ? rawReportParitySummary.parity_status
    : null;
  const reportParityStatus = parityArtefactStatus === 'missing'
    ? 'missing'
    : (rawReportParityStatus === 'passed' || rawReportParityStatus === 'failed' || rawReportParityStatus === 'insufficient'
      ? rawReportParityStatus
      : (parityArtefactStatus === 'emitted' && spineById.parity_report === true ? 'passed' : 'insufficient'));
  const reportParityNeedsWork = reportParityStatus !== 'passed';
  const noExportNeedsWork = noExportStatus !== 'no_export_proof_complete';
  const parityAndNoExportTask = noExportNeedsWork && reportParityNeedsWork
    ? 'parity and no-export proof'
    : (noExportNeedsWork ? 'no-export proof' : (reportParityNeedsWork ? 'report parity proof' : null));
  const nextTasks = [
    ...(analysisEvidenceStateGateStatus !== 'satisfied' ? ['persist real Step 1 AnalysisEvidenceState source'] : []),
    ...(!tracesEmitted ? ['S9-06 EvidenceAnchors and PublicClaimTrace'] : []),
    ...(tracesEmitted && (evidenceAnchorGateStatus !== 'sufficient' || publicClaimGateStatus !== 'sufficient') ? ['promote trace gates from legacy_adapter to real_runtime_v3 where supported'] : []),
    ...(techniqueObservationStatus === 'missing' ? ['TechniqueObservationTrace'] : []),
    ...(techniqueObservationStatus !== 'missing' && techniqueObservationGateStatus !== 'satisfied' ? ['real runtime technique observation evidence linkage'] : []),
    ...(scoreTraceStatus === 'missing' ? ['ScoreTrace'] : []),
    ...(scoreTraceStatus !== 'missing' && scoreTraceGateStatus !== 'satisfied' ? ['real runtime score trace/proof linkage'] : []),
    ...(validatorTraceStatus === 'missing' ? ['ValidatorTrace'] : []),
    ...(validatorTraceStatus !== 'missing' ? ['independent runtime validator proof chain'] : []),
    ...(gateTraceStatus === 'missing' ? ['GateTrace'] : []),
    ...(gateTraceStatus !== 'missing' ? ['independent runtime gate proof chain'] : []),
    ...(modelRunTraceStatus === 'missing' ? ['ModelRunTrace'] : []),
    ...(modelRunTraceStatus !== 'missing' && modelRunTraceGateStatus !== 'satisfied' ? ['independent model-run proof chain'] : []),
    ...(comparisonInvoked
      ? (comparisonEvidenceStatus === 'missing' ? ['comparison runtime artefacts'] : ['promote comparison runtime artefacts to independently validated comparison proof'])
      : []),
    ...(parityAndNoExportTask ? [parityAndNoExportTask] : []),
  ];
  return {
    schema_version: 'tapecoach_v3_qa_acceptance_metrics_v1',
    artefact_type: 'qa_acceptance_metrics',
    internal_only: true,
    privacy_classification: 'internal_private',
    run_id: manifest.run_id,
    analysis_run_id: manifest.analysis_run_id,
    submission_id: manifest.submission_id,
    take_id: manifest.take_id,
    comparison_run_id: manifest.comparison_run_id ?? null,
    compared_take_ids: manifest.compared_take_ids ?? [],
    source_module: 'src/server/v3/qa-artifacts.server.ts',
    source_stage: 'manifest_classification_summary',
    generated_at: manifest.generated_at,
    qa_artifact_root: manifest.qa_artifact_root,
    storage_bucket: manifest.storage_bucket ?? null,
    storage_key_root: manifest.storage_key_root ?? null,
    qc_level_requested: 'L2',
    level2_status: 'not_accepted',
    level3_status: 'blocked',
    level4_status: 'blocked',
    gf01_rt15_status: gf01Rt15Status,
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    public_output_unchanged: true,
    required_artefact_counts: { emitted: emitted.length, missing: missing.length, emitted_blocked: emittedBlocked.length, deferred: deferred.length, not_applicable: notApplicable.length },
    required_artefact_total: (manifest.required_artifacts ?? []).length,
    emitted_artefacts: emitted,
    missing_required_artefacts: missing,
    emitted_blocked_artefacts: emittedBlocked,
    deferred_artefacts: deferred,
    not_applicable_artefacts: notApplicable,
    blocker_codes: manifest.blocker_codes ?? [],
    runtime_evidence_accepted_by_id: manifest.runtime_evidence_accepted_by_id ?? [],
    runtime_evidence_blocked_by_id: manifest.runtime_evidence_blocked_by_id ?? [],
    legacy_adapter_artefacts: manifest.legacy_adapter_artefact_ids ?? [],
    real_v3_spine_artefacts: manifest.real_v3_spine_artefact_ids ?? [],
    real_v3_spine_artefact_count: (manifest.real_v3_spine_artefact_ids ?? []).length,
    legacy_adapter_artefact_count: (manifest.legacy_adapter_artefact_ids ?? []).length,
    output_quality_defects: defects,
    defect_risk_ids: defects,
    public_private_leakage_status: 'blocked', uk_english_status: 'unknown', render_parity_status: reportParityStatus, report_parity_status: reportParityStatus, export_or_no_export_status: noExportStatus,
    comparison_evidence_status: comparisonEvidenceStatus,
    comparison_raw_status: manifest.artefact_status_by_id?.comparison_raw ?? 'missing',
    comparison_report_internal_status: manifest.artefact_status_by_id?.comparison_report_internal ?? 'missing',
    same_video_repeatability_trace_status: manifest.artefact_status_by_id?.same_video_repeatability_trace ?? 'missing',
    duplicate_detection_trace_status: manifest.artefact_status_by_id?.duplicate_detection_trace ?? 'missing',
    comparison_suppression_trace_status: manifest.artefact_status_by_id?.comparison_suppression_trace ?? 'missing',
    route_variance_trace_status: manifest.artefact_status_by_id?.route_variance_trace ?? 'missing',
    comparison_runtime_artifact_count: comparisonEmittedCount,
    media_identity_status: mediaIdentityStatus,
    media_identity_available_signal_count: Number(mediaIdentitySummary.available_signal_count ?? 0),
    media_identity_unavailable_signal_count: Number(mediaIdentitySummary.unavailable_signal_count ?? 0),
    media_identity_gate_status: String(mediaIdentitySummary.media_identity_gate_status ?? (mediaIdentityStatus === 'missing' ? 'missing' : 'insufficient')),
    media_identity_blocker_codes: mediaIdentityBlockerCodes,
    media_identity_cannot_satisfy_duplicate_detection_gate: mediaIdentitySummary.cannot_satisfy_duplicate_detection_gate ?? true,
    truth_state_status: manifest.artefact_status_by_id?.truth_state_map ?? 'missing',
    resolver_status: manifest.artefact_status_by_id?.resolver_output ?? 'missing',
    analysis_evidence_state_status: analysisEvidenceStateStatus,
    analysis_evidence_state_source_classification: sourceClassById.analysis_evidence_state ?? 'missing',
    analysis_evidence_state_gate_status: analysisEvidenceStateGateStatus,
    analysis_evidence_state_gate_reason: analysisEvidenceStateGateStatus === 'satisfied'
      ? 'real_runtime_v3_analysis_evidence_state_present'
      : (analysisEvidenceStateStatus === 'missing'
        ? 'analysis_evidence_state_not_emitted'
        : String(analysisEvidenceStateSummary.analysis_evidence_state_gate_reason ?? 'analysis_evidence_state_not_real_runtime_v3')),
    analysis_evidence_state_summary: analysisEvidenceStateSummary,
    evidence_anchor_trace_status: evidenceAnchorStatus,
    evidence_anchor_gate_status: evidenceAnchorGateStatus,
    evidence_anchor_source_family_summary: evidenceAnchorSourceSummary,
    evidence_anchor_gate_reason: evidenceAnchorGateStatus === 'sufficient'
      ? String(evidenceAnchorTraceSummary.evidence_anchor_gate_reason ?? 'real_runtime_v3_support_present')
      : (evidenceAnchorStatus === 'missing'
        ? 'trace_not_emitted'
        : String(evidenceAnchorTraceSummary.evidence_anchor_gate_reason ?? (evidenceAnchorHasPartialRealRuntime ? 'partial_runtime_facts_present_but_extractor_coverage_incomplete' : 'legacy_or_non_v3_support_only'))),
    public_claim_trace_status: publicClaimStatus,
    public_claim_gate_status: publicClaimGateStatus,
    public_claim_trace_summary: publicClaimSummary,
    public_claim_gate_reason: publicClaimGateStatus === 'sufficient'
      ? String(publicClaimSummary.public_claim_gate_reason ?? 'real_runtime_v3_claim_support_present')
      : (publicClaimStatus === 'missing'
        ? 'trace_not_emitted'
        : String(publicClaimSummary.public_claim_gate_reason ?? 'legacy_or_unsupported_claim_support_only')),
    claim_candidate_trace_status: claimCandidateStatus,
    claim_candidate_gate_status: claimCandidateGateStatus,
    claim_candidate_source_classification: sourceClassById.claim_candidate_trace ?? 'missing',
    claim_candidate_source_summary: claimCandidateSummary.claim_candidate_source_summary,
    claim_candidate_trace_summary: claimCandidateSummary,
    claim_candidate_gate_reason: claimCandidateStatus === 'missing'
      ? 'trace_not_emitted'
      : String(claimCandidateSummary.claim_candidate_gate_reason ?? 'claim_candidate_trace_internal_only_not_public_claim_gate_evidence'),
    technique_observation_trace_status: techniqueObservationStatus,
    technique_observation_gate_status: techniqueObservationGateStatus,
    technique_observation_source_family_summary: techniqueObservationSourceSummary,
    technique_observation_gate_reason: techniqueObservationGateStatus === 'satisfied' ? 'real_runtime_v3_support_present' : (techniqueObservationStatus === 'missing' ? 'trace_not_emitted' : 'legacy_report_snapshot_not_real_runtime_technique_evidence'),

    score_trace_status: scoreTraceStatus,
    score_trace_gate_status: scoreTraceGateStatus,
    score_trace_gate_reason: scoreTraceSummary.score_trace_gate_reason,
    score_trace_source_family_summary: scoreTraceSummary.source_family_summary,
    score_trace_count: scoreTraceSummary.score_count,
    overall_readiness_public_score_status: scoreTraceSummary.overall_readiness_public_score_status,
    discipline_attribute_score_trace_status: scoreTraceSummary.discipline_attribute_score_trace_status,
    score_trace_overall_count: scoreTraceSummary.overall_count,
    score_trace_discipline_attribute_count: scoreTraceSummary.discipline_attribute_count,
    score_trace_component_score_count: scoreTraceSummary.component_score_count,
    score_trace_brief_adherence_subscore_count: scoreTraceSummary.brief_adherence_subscore_count,
    score_trace_calibration_metadata_count: scoreTraceSummary.calibration_metadata_count,
    validator_trace_status: validatorTraceStatus,
    validator_trace_gate_status: validatorTraceGateStatus,
    validator_trace_gate_reason: validatorTraceStatus === 'missing' ? 'trace_not_emitted' : 'internal_bundle_validator_not_independent_runtime_v3_proof',
    validator_trace_validation_count: Number(validatorTraceSummary.validation_count ?? 0),
    validator_trace_pass_count: Number(validatorTraceSummary.pass_count ?? 0),
    validator_trace_warning_count: Number(validatorTraceSummary.warning_count ?? 0),
    validator_trace_fail_count: Number(validatorTraceSummary.fail_count ?? 0),
    validator_trace_blocked_count: Number(validatorTraceSummary.blocked_count ?? 0),
    validator_trace_summary: validatorTraceSummary,
    gate_trace_status: gateTraceStatus,
    gate_trace_gate_status: gateTraceGateStatus,
    gate_trace_gate_reason: gateTraceStatus === 'missing' ? 'trace_not_emitted' : 'internal_gate_snapshot_not_independent_runtime_v3_proof',
    gate_trace_gate_count: Number(gateTraceSummary.gate_count ?? 0),
    gate_trace_passed_gate_count: Number(gateTraceSummary.passed_gate_count ?? 0),
    gate_trace_blocked_gate_count: Number(gateTraceSummary.blocked_gate_count ?? 0),
    gate_trace_insufficient_gate_count: Number(gateTraceSummary.insufficient_gate_count ?? 0),
    gate_trace_missing_gate_count: Number(gateTraceSummary.missing_gate_count ?? 0),
    gate_trace_not_applicable_gate_count: Number(gateTraceSummary.not_applicable_gate_count ?? 0),
    gate_trace_summary: gateTraceSummary,
    model_run_trace_status: modelRunTraceStatus,
    model_run_trace_gate_status: modelRunTraceGateStatus,
    model_run_trace_gate_reason: String(modelRunTraceSummary.model_run_trace_gate_reason ?? (modelRunTraceStatus === 'missing' ? 'trace_not_emitted' : 'runtime_metadata_without_independent_model_proof_chain')),
    model_run_count: Number(modelRunTraceSummary.model_run_count ?? 0),
    model_run_completed_count: Number(modelRunTraceSummary.model_run_completed_count ?? 0),
    model_run_failed_count: Number(modelRunTraceSummary.model_run_failed_count ?? 0),
    model_run_timeout_count: Number(modelRunTraceSummary.model_run_timeout_count ?? 0),
    model_run_fallback_count: Number(modelRunTraceSummary.model_run_fallback_count ?? 0),
    model_run_trace_summary: modelRunTraceSummary,
    input_artefact_status: (manifest.artefact_status_by_id?.analysis_input_record === 'emitted' && manifest.artefact_status_by_id?.analysis_submission === 'emitted' && manifest.artefact_status_by_id?.analysis_take === 'emitted') ? 'emitted' : 'incomplete',
    raw_report_status: manifest.artefact_status_by_id?.raw_report ?? 'missing',
    acceptance_decision: 'not_accepted',
    acceptance_reasons: [
      'missing required Level 2 artefacts',
      'raw_report is legacy_adapter where applicable',
      ...(comparisonInvoked
        ? [comparisonEvidenceStatus === 'missing'
          ? 'comparison evidence missing'
          : 'comparison evidence emitted but insufficient for Level 2']
        : []),
      ...(comparisonApplies ? ['GF-01 / RT-15 blocked'] : []),
      'production/public authority gates blocked',
      'qa_acceptance_metrics emitted but does not satisfy evidence gates',
    ],
    build_commit_sha: manifest.build_commit_sha ?? 'unknown',
    deployment_revision: manifest.deployment_revision ?? 'unknown',
    source_branch: manifest.source_branch ?? manifest.branch_name ?? 'unknown',
    qa_emitter_version: manifest.qa_emitter_version ?? 'unknown',
    storage_path_mapper_version: manifest.storage_path_mapper_version ?? 'unknown',
    qa_finaliser_version: manifest.qa_finaliser_version ?? 'unknown',
    next_required_engineering_tasks: nextTasks,
    redaction_notes: ['Internal-only QA summary; no secrets or tokens are emitted'],
  };
}

export async function emitInternalQAArtifactManifest(options: QAArtifactEmitterOptions): Promise<any> {
  const internal_qa_emit = options.internal_qa_emit ?? false;
  if (!internal_qa_emit) return { written: false };
  const root = options.root_dir ?? DEFAULT_ROOT;
  const emittedForMode = [...(options.emitted_artefact_ids ?? []), ...(options.emitted_blocked_artefact_ids ?? [])];
  const inferredComparisonMode = emittedForMode.some((id) => COMPARISON_REQUIRED_ARTEFACT_IDS.has(id));
  const mode = (options.comparison_run_id || inferredComparisonMode) ? 'comparison' : 'take';
  const comparisonRunId = options.comparison_run_id ?? (inferredComparisonMode ? options.run_id : undefined);
  const runDir = resolveRunDir(root, options.run_id, mode, options.take_id, options.analysis_run_id, comparisonRunId);
  const emittedIds = new Set(options.emitted_artefact_ids ?? []);
  const emittedBlockedIds = new Set(options.emitted_blocked_artefact_ids ?? []);
  const deferredIds = new Set(options.deferred_artefact_ids ?? []);
  const notApplicableIds = new Set(options.not_applicable_artefact_ids ?? []);
  const comparedTakeIds = normaliseComparedTakeIds(options.compared_take_ids);
  const comparisonRuntimeEvidenceCount = ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'duplicate_detection_trace', 'comparison_suppression_trace', 'route_variance_trace']
    .filter((id) => emittedIds.has(id) || emittedBlockedIds.has(id))
    .length;
  const comparisonInvoked =
    Boolean(options.comparison_run_id) ||
    comparedTakeIds.length > 1 ||
    comparisonRuntimeEvidenceCount > 0;
  const comparisonGateApplies = comparisonInvoked || options.fixture_id === 'GF-01 / RT-15 / MT-same-video-20260511';
  const initialLevel2ById = options.artefact_level2_spine_satisfaction_by_id ?? {};
  const required_artifacts: QARequiredArtefact[] = REQUIRED.map((r) => {
    const emitted = emittedIds.has(r.artefact_id);
    const emittedUnsatisfiedReportParity = r.artefact_id === 'parity_report' && emitted && initialLevel2ById.parity_report !== true;
    const emittedBlocked = emittedBlockedIds.has(r.artefact_id);
    const deferred = deferredIds.has(r.artefact_id);
    const explicitNotApplicable = notApplicableIds.has(r.artefact_id)
      && !(comparisonInvoked && COMPARISON_REQUIRED_ARTEFACT_IDS.has(r.artefact_id));
    const notApplicable = explicitNotApplicable || (!comparisonInvoked && COMPARISON_REQUIRED_ARTEFACT_IDS.has(r.artefact_id));
    const status: ArtefactStatus = emitted
      ? (emittedUnsatisfiedReportParity ? 'emitted_blocked' : 'emitted')
      : (emittedBlocked ? 'emitted_blocked' : (deferred ? 'deferred' : (notApplicable ? 'not_applicable' : 'missing')));
    const blocker_code = (status === 'emitted' || status === 'not_applicable') ? undefined : blockerCodeForRequiredArtefact(r.artefact_id, status);
    return { ...r, status, blocker_code, reason: emitted ? 'Emitted in current run' : (emittedBlocked ? 'Emitted with blocked/not_executed runtime evidence' : (deferred ? 'Intentionally deferred' : (notApplicable ? 'Not applicable for this run shape' : 'Not emitted by current pipeline stage'))) };
  });
  const missing_artifacts = required_artifacts.filter((a) => a.status === 'missing').map((a) => a.artefact_id);
  const emitted_artifacts = required_artifacts.filter((a) => a.status === 'emitted').map((a) => a.artefact_id);
  const emitted_blocked_artefact_ids = required_artifacts.filter((a) => a.status === 'emitted_blocked').map((a) => a.artefact_id);
  const deferred_artifact_ids = required_artifacts.filter((a) => a.status === 'deferred').map((a) => a.artefact_id);
  const not_applicable_artifact_ids = required_artifacts.filter((a) => a.status === 'not_applicable').map((a) => a.artefact_id);
  const blocker_codes = [...new Set(required_artifacts.map((a) => a.blocker_code).filter(Boolean) as string[])];
  const artefact_status_by_id = Object.fromEntries(required_artifacts.map((a) => [a.artefact_id, a.status]));
  const optionalArtefactIds = [...new Set([
    ...(options.emitted_artefact_ids ?? []),
    ...(options.emitted_blocked_artefact_ids ?? []),
    ...(options.deferred_artefact_ids ?? []),
    ...(options.not_applicable_artefact_ids ?? []),
  ].filter((id) => !REQUIRED_ARTEFACT_ID_SET.has(id)))];
  for (const artefactId of optionalArtefactIds) {
    const status: ArtefactStatus = emittedIds.has(artefactId)
      ? 'emitted'
      : (emittedBlockedIds.has(artefactId)
        ? 'emitted_blocked'
        : (deferredIds.has(artefactId)
          ? 'deferred'
          : (notApplicableIds.has(artefactId) ? 'not_applicable' : 'missing')));
    artefact_status_by_id[artefactId] = status;
    if (status === 'emitted') emitted_artifacts.push(artefactId);
    else if (status === 'emitted_blocked') emitted_blocked_artefact_ids.push(artefactId);
    else if (status === 'deferred') deferred_artifact_ids.push(artefactId);
    else if (status === 'not_applicable') not_applicable_artifact_ids.push(artefactId);
  }
  const resolvedProjectRoot = resolveProjectRootForQAManifest();
  const projectRoot = typeof resolvedProjectRoot === 'string' && resolvedProjectRoot.trim().length > 0
    ? resolvedProjectRoot
    : null;
  const rootReadmeExists = (() => {
    if (!projectRoot) return false;
    try {
      const readmePath = safeJoin(projectRoot, 'README.md');
      return safeExists(readmePath);
    } catch {
      return false;
    }
  })();
  const storageRoot = mode === 'take'
    ? `take-${options.take_id ?? 'take-unknown'}/analysis-${options.analysis_run_id ?? options.run_id}`
    : null;
  const provenance = resolveQADeploymentProvenance();
  const fallbackScopeFile = 'docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md';
  const requestedSourceScopeFile = options.source_scope_file ?? null;
  const requestedReadmeButMissing = requestedSourceScopeFile === 'README.md' && !rootReadmeExists;
  const sourceScopeFile = requestedReadmeButMissing
    ? fallbackScopeFile
    : (options.source_scope_file ?? (rootReadmeExists ? 'README.md' : fallbackScopeFile));
  const usingRootReadme = rootReadmeExists && sourceScopeFile === 'README.md';
  const artefact_source_classification_by_id = { ...(options.artefact_source_classification_by_id ?? {}) };
  const artefact_level2_spine_satisfaction_by_id = { ...(options.artefact_level2_spine_satisfaction_by_id ?? {}) };
  const runtime_evidence_accepted_by_id = new Set<string>(options.runtime_evidence_accepted_by_id ?? []);
  const runtime_evidence_blocked_by_id = new Set<string>(options.runtime_evidence_blocked_by_id ?? emitted_blocked_artefact_ids);
  const real_v3_spine_artefact_ids = new Set<string>(options.real_v3_spine_artefact_ids ?? []);
  if (artefact_status_by_id.media_identity === 'emitted' || artefact_status_by_id.media_identity === 'emitted_blocked') {
    if (!artefact_source_classification_by_id.media_identity) {
      artefact_source_classification_by_id.media_identity = options.media_identity_summary?.cannot_satisfy_duplicate_detection_gate === false
        ? 'real_runtime_v3_media_identity'
        : 'partial_media_identity';
    }
    artefact_level2_spine_satisfaction_by_id.media_identity = false;
    runtime_evidence_accepted_by_id.delete('media_identity');
    runtime_evidence_blocked_by_id.add('media_identity');
    real_v3_spine_artefact_ids.delete('media_identity');
  }
  for (const artefactId of BASE_REAL_RUNTIME_V3_ARTEFACT_IDS) {
    if (artefact_status_by_id[artefactId] !== 'emitted' || !real_v3_spine_artefact_ids.has(artefactId)) continue;
    if (!artefact_source_classification_by_id[artefactId]) artefact_source_classification_by_id[artefactId] = 'real_runtime_v3';
    if (artefact_level2_spine_satisfaction_by_id[artefactId] === undefined) artefact_level2_spine_satisfaction_by_id[artefactId] = true;
  }
  for (const artefactId of S9_14_CONTAINED_TRACE_IDS) {
    const sourceClassification = artefact_source_classification_by_id[artefactId];
    const acceptedTraceSource = artefactId === 'public_claim_trace'
      ? ['real_runtime_v3', 'real_runtime_v3_claim_support'].includes(String(sourceClassification))
      : sourceClassification === 'real_runtime_v3';
    const isCompleteRealRuntimeTrace =
      artefact_status_by_id[artefactId] === 'emitted'
      && acceptedTraceSource
      && artefact_level2_spine_satisfaction_by_id[artefactId] === true;
    if (!isCompleteRealRuntimeTrace) {
      artefact_level2_spine_satisfaction_by_id[artefactId] = false;
      runtime_evidence_accepted_by_id.delete(artefactId);
      real_v3_spine_artefact_ids.delete(artefactId);
      if (emittedIds.has(artefactId) || emittedBlockedIds.has(artefactId)) runtime_evidence_blocked_by_id.add(artefactId);
    }
  }
  if (artefact_status_by_id.claim_candidate_trace === 'emitted' || artefact_status_by_id.claim_candidate_trace === 'emitted_blocked') {
    artefact_level2_spine_satisfaction_by_id.claim_candidate_trace = false;
    runtime_evidence_accepted_by_id.delete('claim_candidate_trace');
    runtime_evidence_blocked_by_id.add('claim_candidate_trace');
    real_v3_spine_artefact_ids.delete('claim_candidate_trace');
    if (!blocker_codes.includes('claim_candidate_trace_internal_only_not_public_claim_gate_evidence')) blocker_codes.push('claim_candidate_trace_internal_only_not_public_claim_gate_evidence');
  }
  const isAcceptedRuntimeEvidence = (artefactId: string) => {
    if (NEVER_ACCEPTED_RUNTIME_EVIDENCE_IDS.has(artefactId)) return false;
    if (artefact_status_by_id[artefactId] !== 'emitted') return false;
    if (artefact_level2_spine_satisfaction_by_id[artefactId] !== true) return false;
    const sourceClassification = String(artefact_source_classification_by_id[artefactId] ?? '');
    if (NON_ACCEPTED_SOURCE_CLASSIFICATION_PATTERNS.some((pattern) => sourceClassification.includes(pattern))) return false;
    return true;
  };
  for (const artefactId of Object.keys(artefact_status_by_id)) {
    if (isAcceptedRuntimeEvidence(artefactId)) {
      runtime_evidence_accepted_by_id.add(artefactId);
      runtime_evidence_blocked_by_id.delete(artefactId);
      continue;
    }
    runtime_evidence_accepted_by_id.delete(artefactId);
    if (artefact_status_by_id[artefactId] === 'emitted' && REQUIRED_ARTEFACT_ID_SET.has(artefactId)) {
      runtime_evidence_blocked_by_id.add(artefactId);
    }
  }
  const no_export_status = resolveNoExportStatus(artefact_status_by_id);
  const manifest = {
    schema_version: options.schema_version ?? DEFAULT_SCHEMA_VERSION, emitter_version: options.emitter_version ?? DEFAULT_EMITTER_VERSION, run_id: options.run_id, analysis_run_id: options.analysis_run_id ?? options.run_id, comparison_run_id: comparisonRunId ?? null, submission_id: options.submission_id ?? null, take_id: options.take_id ?? null, compared_take_ids: comparedTakeIds, fixture_id: options.fixture_id ?? null,
    generated_at: options.generated_at ?? new Date().toISOString(), commit_sha: options.commit_sha ?? provenance.build_commit_sha, branch_name: options.branch_name ?? provenance.source_branch, release_state: RELEASE_STATE, internal_qa_emit,
    qa_artifact_root: (process.env.QA_ARTIFACT_SINK === 'storage' && storageRoot) ? storageRoot : runDir, storage_bucket: process.env.QA_ARTIFACT_SINK === 'storage' ? (process.env.QA_ARTIFACT_STORAGE_BUCKET ?? 'qa-artifacts') : null, storage_key_root: process.env.QA_ARTIFACT_SINK === 'storage' ? storageRoot : null, requested_source_scope_file: requestedSourceScopeFile, source_scope_file: sourceScopeFile, controlling_source_file: sourceScopeFile, controlling_source_location_note: usingRootReadme ? 'Using repository root README.md as controlling requirements source' : (requestedReadmeButMissing ? 'Requested README.md was not present in runtime workspace; using fallback scope file' : 'Replacement README supplied externally; root README.md not present in resolved project root'), controlling_requirements_status: usingRootReadme ? 'root_readme_present' : 'operator_supplied_replacement_README', fixture_refs: options.fixture_refs ?? [], input_refs: options.input_refs ?? [], take_refs: options.take_refs ?? [], mux_playback_ids: options.mux_playback_ids ?? {}, public_output_unchanged: true, user_experience_unchanged: true,
    required_artifacts, emitted_artifacts, emitted_blocked_artefact_ids, missing_artifacts, deferred_artifact_ids, not_applicable_artifact_ids, artefact_status_by_id, blocker_codes,
    runtime_evidence_accepted_by_id: [...runtime_evidence_accepted_by_id],
    runtime_evidence_blocked_by_id: [...runtime_evidence_blocked_by_id],
    artefact_source_classification_by_id,
    artefact_level2_spine_satisfaction_by_id,
    legacy_adapter_artefact_ids: options.legacy_adapter_artefact_ids ?? [],
    real_v3_spine_artefact_ids: [...real_v3_spine_artefact_ids],
    defect_risk_ids: options.defect_risk_ids ?? [],
    public_claim_trace_summary: options.public_claim_trace_summary ?? undefined,
    claim_candidate_trace_summary: options.claim_candidate_trace_summary ?? undefined,
    evidence_anchor_trace_summary: options.evidence_anchor_trace_summary ?? undefined,
    technique_observation_trace_summary: options.technique_observation_trace_summary ?? undefined,
    score_trace_summary: options.score_trace_summary ?? undefined,
    model_run_trace_summary: options.model_run_trace_summary ?? undefined,
    media_identity_summary: options.media_identity_summary ?? undefined,
    analysis_evidence_state_summary: options.analysis_evidence_state_summary ?? undefined,
    report_parity_summary: options.report_parity_summary ?? undefined,
    validator_trace_summary: options.validator_trace_summary ?? undefined,
    gate_trace_summary: options.gate_trace_summary ?? undefined,
    qa_acceptance_metrics: { gf01_rt15_status: comparisonGateApplies ? 'blocked' : 'not_applicable', level2_status: 'not_accepted', blocker_codes },
    gate_statuses: comparisonGateApplies
      ? [{ gate: 'GF-01_same_video_false_winner', status: 'blocked', blocker_code: P0_CODE }, { gate: 'same_video_forced_winner_still_present', status: 'blocked', blocker_code: P0_CODE }]
      : [],
    warnings: ['Rendered PDFs/page-prints are manual-render evidence only'], privacy_notes: ['Internal-only dark mode artefact manifest; no public output changes'], redaction_notes: ['Private traces must not be exposed publicly'],
    no_export_status, production_safe_status: BLOCKED_STATUS, public_technique_authority_status: BLOCKED_STATUS, public_scoring_status: BLOCKED_STATUS, export_share_enabled: BLOCKED_STATUS,
    fixture_observations: options.fixture_id === 'GF-01 / RT-15 / MT-same-video-20260511' ? { take_scores: [91, 94, 91], comparison_recommendation: 'Take 2', same_video_operator_confirmation: true } : undefined,
    ...provenance,
    level2_qa_acceptance: 'not_accepted',
  };
  const manifestRelativePath = options.manifest_relative_path ?? 'manifest.json';
  const sink = await writeQAArtifact({ run_id: options.run_id, root_dir: root, relative_path: manifestRelativePath, payload: manifest, artefact_id: 'manifest', fixture_id: options.fixture_id });
  return { written: sink.written, manifest_path: sink.path ?? sink.storage_path, sink_mode: sink.sink_mode, sink_write_status: sink.sink_write_status, storage_bucket: sink.storage_bucket, storage_path: sink.storage_path, sink_warning: sink.warning ?? null, log_fallback_emitted: sink.log_fallback_emitted, manifest };
}
