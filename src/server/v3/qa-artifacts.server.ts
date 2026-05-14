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
  comparison_run_id?: string;
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
  };
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
  { artefact_id: 'raw_report', name: 'raw report', expected_path: 'reports/raw_report.json', category: 'analysis_run', required_for_level: 'L2', linked_artifacts: [] },
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

function isCommitLike(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{6,80}$/.test(value.trim());
}

function firstPresent(env: NodeJS.ProcessEnv, keys: string[]): string | null {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function resolveQADeploymentProvenance(env: NodeJS.ProcessEnv = process.env) {
  const commitCandidate = firstPresent(env, ['VERCEL_GIT_COMMIT_SHA', 'LOVABLE_GIT_COMMIT_SHA', 'BUILD_COMMIT_SHA', 'COMMIT_SHA', 'GIT_SHA', 'GIT_COMMIT_SHA', 'SOURCE_VERSION', 'GITHUB_SHA', 'CF_PAGES_COMMIT_SHA']);
  const sourceBranch = firstPresent(env, ['VERCEL_GIT_COMMIT_REF', 'CF_PAGES_BRANCH', 'GITHUB_REF_NAME', 'BRANCH_NAME', 'GIT_BRANCH_NAME']) ?? 'unknown';
  const deploymentRevision = firstPresent(env, ['VERCEL_DEPLOYMENT_ID', 'LOVABLE_DEPLOYMENT_ID', 'DEPLOYMENT_REVISION']) ?? 'unknown';
  return {
    build_commit_sha: isCommitLike(commitCandidate) ? commitCandidate : 'unknown',
    deployment_revision: deploymentRevision,
    source_branch: sourceBranch,
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
  const evidenceAnchorStatus = manifest.artefact_status_by_id?.evidence_anchors ?? 'missing';
  const publicClaimStatus = manifest.artefact_status_by_id?.public_claim_trace ?? 'missing';
  const evidenceAnchorGateStatus = evidenceAnchorStatus === 'missing' ? 'missing' : (spineById.evidence_anchors === true ? 'satisfied' : 'insufficient');
  const publicClaimGateStatus = publicClaimStatus === 'missing' ? 'missing' : (spineById.public_claim_trace === true ? 'satisfied' : 'insufficient');
  const evidenceAnchorSourceSummary = {
    real_runtime_v3: sourceClassById.evidence_anchors === 'real_runtime_v3' ? 1 : 0,
    legacy_adapter: sourceClassById.evidence_anchors === 'legacy_adapter' ? 1 : 0,
    report_snapshot: sourceClassById.evidence_anchors === 'report_snapshot' ? 1 : 0,
    input_artifact: sourceClassById.evidence_anchors === 'input_artifact' ? 1 : 0,
    resolver_truth_state: sourceClassById.evidence_anchors === 'resolver_truth_state' ? 1 : 0,
  };
  const publicClaimSummary = manifest.public_claim_trace_summary ?? {
    claim_count: 0,
    unsupported_claim_count: 0,
    legacy_untraced_claim_count: 0,
    unsafe_or_overclaim_count: 0,
    rewrite_required_count: 0,
  };
  const tracesEmitted = evidenceAnchorStatus === 'emitted' && publicClaimStatus === 'emitted';
  const nextTasks = [
    ...(!tracesEmitted ? ['S9-06 EvidenceAnchors and PublicClaimTrace'] : []),
    ...(tracesEmitted && (evidenceAnchorGateStatus !== 'satisfied' || publicClaimGateStatus !== 'satisfied') ? ['promote trace gates from legacy_adapter to real_runtime_v3 where supported'] : []),
    'TechniqueObservationTrace',
    'ScoreTrace/GateTrace/ModelRunTrace/validator_trace',
    'comparison runtime artefacts',
    'parity and no-export proof',
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
    gf01_rt15_status: 'blocked',
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
    public_private_leakage_status: 'blocked', uk_english_status: 'unknown', render_parity_status: 'blocked', export_or_no_export_status: manifest.no_export_status ?? 'blocked',
    comparison_evidence_status: emitted.includes('comparison_raw') ? 'available' : 'missing',
    truth_state_status: manifest.artefact_status_by_id?.truth_state_map ?? 'missing',
    resolver_status: manifest.artefact_status_by_id?.resolver_output ?? 'missing',
    evidence_anchor_trace_status: evidenceAnchorStatus,
    evidence_anchor_gate_status: evidenceAnchorGateStatus,
    evidence_anchor_source_family_summary: evidenceAnchorSourceSummary,
    evidence_anchor_gate_reason: evidenceAnchorGateStatus === 'satisfied' ? 'real_runtime_v3_support_present' : (evidenceAnchorStatus === 'missing' ? 'trace_not_emitted' : 'legacy_or_non_v3_support_only'),
    public_claim_trace_status: publicClaimStatus,
    public_claim_gate_status: publicClaimGateStatus,
    public_claim_trace_summary: publicClaimSummary,
    public_claim_gate_reason: publicClaimGateStatus === 'satisfied' ? 'real_runtime_v3_claim_support_present' : (publicClaimStatus === 'missing' ? 'trace_not_emitted' : 'legacy_or_unsupported_claim_support_only'),
    input_artefact_status: (manifest.artefact_status_by_id?.analysis_input_record === 'emitted' && manifest.artefact_status_by_id?.analysis_submission === 'emitted' && manifest.artefact_status_by_id?.analysis_take === 'emitted') ? 'emitted' : 'incomplete',
    raw_report_status: manifest.artefact_status_by_id?.raw_report ?? 'missing',
    acceptance_decision: 'not_accepted',
    acceptance_reasons: [
      'missing required Level 2 artefacts',
      'raw_report is legacy_adapter where applicable',
      'comparison evidence missing',
      'GF-01 / RT-15 blocked',
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

export async function emitInternalQAArtifactManifest(options: QAArtifactEmitterOptions) {
  const internal_qa_emit = options.internal_qa_emit ?? false;
  if (!internal_qa_emit) return { written: false };
  const root = options.root_dir ?? DEFAULT_ROOT;
  const comparisonArtefactIds = new Set(['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace', 'parity_comparison']);
  const emittedForMode = [...(options.emitted_artefact_ids ?? []), ...(options.emitted_blocked_artefact_ids ?? [])];
  const inferredComparisonMode = emittedForMode.some((id) => comparisonArtefactIds.has(id));
  const mode = (options.comparison_run_id || inferredComparisonMode) ? 'comparison' : 'take';
  const comparisonRunId = options.comparison_run_id ?? (inferredComparisonMode ? options.run_id : undefined);
  const runDir = resolveRunDir(root, options.run_id, mode, options.take_id, options.analysis_run_id, comparisonRunId);
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
  const resolvedProjectRoot = resolveProjectRootForQAManifest();
  let cwdFallback = '.';
  try { cwdFallback = process.cwd(); } catch {}
  const projectRoot = typeof resolvedProjectRoot === 'string' && resolvedProjectRoot.trim().length > 0
    ? resolvedProjectRoot
    : cwdFallback;
  const rootReadmeExists = (() => {
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
  const manifest = {
    schema_version: options.schema_version ?? DEFAULT_SCHEMA_VERSION, emitter_version: options.emitter_version ?? DEFAULT_EMITTER_VERSION, run_id: options.run_id, analysis_run_id: options.analysis_run_id ?? options.run_id, comparison_run_id: comparisonRunId ?? null, submission_id: options.submission_id ?? null, take_id: options.take_id ?? null, compared_take_ids: options.compared_take_ids ?? [], fixture_id: options.fixture_id ?? null,
    generated_at: options.generated_at ?? new Date().toISOString(), commit_sha: options.commit_sha ?? provenance.build_commit_sha, branch_name: options.branch_name ?? provenance.source_branch, release_state: RELEASE_STATE, internal_qa_emit,
    qa_artifact_root: (process.env.QA_ARTIFACT_SINK === 'storage' && storageRoot) ? storageRoot : runDir, storage_bucket: process.env.QA_ARTIFACT_SINK === 'storage' ? (process.env.QA_ARTIFACT_STORAGE_BUCKET ?? 'qa-artifacts') : null, storage_key_root: process.env.QA_ARTIFACT_SINK === 'storage' ? storageRoot : null, requested_source_scope_file: requestedSourceScopeFile, source_scope_file: sourceScopeFile, controlling_source_file: sourceScopeFile, controlling_source_location_note: usingRootReadme ? 'Using repository root README.md as controlling requirements source' : (requestedReadmeButMissing ? 'Requested README.md was not present in runtime workspace; using fallback scope file' : 'Replacement README supplied externally; root README.md not present in resolved project root'), controlling_requirements_status: usingRootReadme ? 'root_readme_present' : 'operator_supplied_replacement_README', fixture_refs: options.fixture_refs ?? [], input_refs: options.input_refs ?? [], take_refs: options.take_refs ?? [], mux_playback_ids: options.mux_playback_ids ?? {}, public_output_unchanged: true, user_experience_unchanged: true,
    required_artifacts, emitted_artifacts, emitted_blocked_artefact_ids, missing_artifacts, deferred_artifact_ids, not_applicable_artifact_ids, artefact_status_by_id, blocker_codes,
    runtime_evidence_accepted_by_id: options.runtime_evidence_accepted_by_id ?? emitted_artifacts,
    runtime_evidence_blocked_by_id: options.runtime_evidence_blocked_by_id ?? emitted_blocked_artefact_ids,
    artefact_source_classification_by_id: options.artefact_source_classification_by_id ?? {},
    artefact_level2_spine_satisfaction_by_id: options.artefact_level2_spine_satisfaction_by_id ?? {},
    legacy_adapter_artefact_ids: options.legacy_adapter_artefact_ids ?? [],
    real_v3_spine_artefact_ids: options.real_v3_spine_artefact_ids ?? [],
    defect_risk_ids: options.defect_risk_ids ?? [],
    public_claim_trace_summary: options.public_claim_trace_summary ?? undefined,
    qa_acceptance_metrics: { gf01_rt15_status: 'blocked', level2_status: 'not_accepted', blocker_codes },
    gate_statuses: [{ gate: 'GF-01_same_video_false_winner', status: 'blocked', blocker_code: P0_CODE }, { gate: 'same_video_forced_winner_still_present', status: 'blocked', blocker_code: P0_CODE }],
    warnings: ['Rendered PDFs/page-prints are manual-render evidence only'], privacy_notes: ['Internal-only dark mode artefact manifest; no public output changes'], redaction_notes: ['Private traces must not be exposed publicly'],
    no_export_status: 'no_export_proof_missing', production_safe_status: BLOCKED_STATUS, public_technique_authority_status: BLOCKED_STATUS, public_scoring_status: BLOCKED_STATUS, export_share_enabled: BLOCKED_STATUS,
    fixture_observations: options.fixture_id === 'GF-01 / RT-15 / MT-same-video-20260511' ? { take_scores: [91, 94, 91], comparison_recommendation: 'Take 2', same_video_operator_confirmation: true } : undefined,
    ...provenance,
    level2_qa_acceptance: 'not_accepted',
  };
  const manifestRelativePath = options.manifest_relative_path ?? 'manifest.json';
  const sink = await writeQAArtifact({ run_id: options.run_id, root_dir: root, relative_path: manifestRelativePath, payload: manifest, artefact_id: 'manifest', fixture_id: options.fixture_id });
  return { written: sink.written, manifest_path: sink.path ?? sink.storage_path, sink_mode: sink.sink_mode, sink_write_status: sink.sink_write_status, storage_bucket: sink.storage_bucket, storage_path: sink.storage_path, sink_warning: sink.warning ?? null, log_fallback_emitted: sink.log_fallback_emitted, manifest };
}
