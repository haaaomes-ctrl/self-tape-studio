import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitComparisonRuntimeArtifacts, emitQAManifestForAnalysisRun, reconcileComparisonManifestState } from '@/server/v3/qa-artifacts-wiring.server';
import { readQAArtifactText } from '@/server/v3/qa-artifact-sink.server';

const upload = vi.fn();
const download = vi.fn();
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { storage: { from: vi.fn(() => ({ upload, download })) } },
}));


async function seedExistingManifest(root: string, runId: string, takeId: string, analysisRunId: string) {
  await emitQAManifestForAnalysisRun({ run_id: runId, take_id: takeId, analysis_run_id: analysisRunId, submission_id: 'seed-sub', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['analysis_input_record','analysis_submission','analysis_take','resolver_output','truth_state_map','evidence_anchors','public_claim_trace','raw_report','qa_acceptance_metrics'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false } });
}

describe('v3 s9 comparison runtime artifacts first pass', () => {
  beforeEach(() => {
    delete process.env.QA_ARTIFACT_SINK;
    upload.mockReset();
    download.mockReset();
    upload.mockResolvedValue({ error: null });
  });
  it('emits all five artifacts only when real comparison execution evidence exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-'));
    await seedExistingManifest(root, 'take-root1', 'root1', 'ar-1');
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-root1',
      take_id: 'root1',
      analysis_run_id: 'ar-1',
      comparison_run_id: 'cmp-1',
      compared_take_ids: ['root1', 'root2'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'root2' }, raw_comparison_decision_snapshot: { winner: 'root2' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
    });
    expect(out.emitted_artefact_ids.sort()).toEqual(['comparison_raw', 'comparison_report_internal', 'comparison_suppression_trace', 'route_variance_trace', 'same_video_repeatability_trace'].sort());
    const base = path.join(root, 'take-root1', 'takes', 'take-root1', 'analysis-ar-1');
    await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8');
    await readFile(path.join(base, 'comparison', 'comparison.report.internal.json'), 'utf8');
    await readFile(path.join(base, 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8');
    await readFile(path.join(base, 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8');
    await readFile(path.join(base, 'comparison_traces', 'route_variance_trace.json'), 'utf8');
    await emitQAManifestForAnalysisRun({ run_id: 'take-root1', take_id: 'root1', analysis_run_id: 'ar-1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: out.emitted_artefact_ids });
    const manifest = JSON.parse(await readFile(path.join(root, 'take-root1', 'manifest.json'), 'utf8'));
    expect(manifest.required_artifacts.find((a: any) => a.artefact_id === 'comparison_raw').expected_path).toBe('comparison/comparison.raw.json');
    expect(manifest.required_artifacts.find((a: any) => a.artefact_id === 'comparison_report_internal').expected_path).toBe('comparison/comparison.report.internal.json');
    expect(manifest.required_artifacts.find((a: any) => a.artefact_id === 'same_video_repeatability_trace').expected_path).toBe('comparison_traces/same_video_repeatability_trace.json');
    expect(manifest.required_artifacts.find((a: any) => a.artefact_id === 'comparison_suppression_trace').expected_path).toBe('comparison_traces/comparison_suppression_trace.json');
    expect(manifest.required_artifacts.find((a: any) => a.artefact_id === 'route_variance_trace').expected_path).toBe('comparison_traces/route_variance_trace.json');
    const advertised = (manifest.required_artifacts ?? []).map((a: any) => a.expected_path);
    expect(advertised).not.toContain('comparison/comparison_raw.json');
    expect(advertised).not.toContain('comparison/comparison_report_internal.json');
    expect(advertised).not.toContain('traces/SameVideoRepeatabilityTrace.json');
    expect(advertised).not.toContain('traces/ComparisonSuppressionTrace.json');
    expect(advertised).not.toContain('traces/RouteVarianceTrace.json');
  });

  it('does not emit for ordinary no-comparison single take runs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-single-'));
    await seedExistingManifest(root, 'take-only1', 'only1', 'ar-2');
    const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-only1', take_id: 'only1', analysis_run_id: 'ar-2', root_dir: root, internal_qa_emit: true, comparison_run_id: 'cmp-2', compared_take_ids: ['only1'], comparison_raw_data: { comparison_run_executed: false } });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual([]);
  });

  it('fails closed when prior root manifest is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-missing-manifest-'));
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-root2', take_id: 'root2', analysis_run_id: 'ar-2', comparison_run_id: 'cmp-2', compared_take_ids: ['root2', 'root3'], root_dir: root, internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'root3' }, raw_comparison_decision_snapshot: { winner: 'root3' } },
      suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false },
    });
    expect(out.written).toBe(false);
    expect((out as any).reconciliation_written).toBe(false);
    expect((out as any).comparison_artefacts_written).toBe(false);
    expect((out as any).warning).toMatch(/comparison_reconciliation_manifest_missing/);
    expect((out as any).blocker_codes).toContain('comparison_reconciliation_manifest_missing');
  });
});


it('reconcile helper treats comparison family as current-attempt replace-set and preserves non-comparison state', () => {
  const existing = {
    emitted_artifacts: ['raw_report','comparison_raw','route_variance_trace'],
    runtime_evidence_accepted_by_id: ['raw_report','comparison_raw'],
    runtime_evidence_blocked_by_id: ['comparison_raw:previous_write_failed','route_variance_trace:previous_write_failed','raw_report:legacy'],
    emitted_blocked_artefact_ids: ['comparison_raw','public_output_render'],
    deferred_artefact_ids: ['parity_comparison'],
    not_applicable_artefact_ids: ['private_leak_scan'],
    defect_risk_ids: ['legacy_schema_snapshot'],
    gate_statuses: { level2: 'blocked' },
    artefact_source_classification_by_id: { raw_report: 'legacy_adapter', comparison_raw: 'legacy_adapter' },
    artefact_level2_spine_satisfaction_by_id: { raw_report: false, comparison_raw: false },
    public_claim_trace_summary: { claim_count: 3 },
    score_trace_summary: { score_count: 4 },
    model_run_trace_summary: { model_run_count: 2 },
    validator_trace_summary: { validation_count: 5 },
    gate_trace_summary: { gate_count: 6 },
    comparison_raw_summary: { stale: true },
    route_variance_trace_summary: { stale: true },
    blocker_codes: ['comparison_JSON_missing','route_variance_trace_missing','level2_not_accepted'],
    missing_artifacts: ['score_trace', 'validator_trace', 'comparison_raw'],
    required_artifacts: [
      { artefact_id: 'comparison_raw', status: 'missing' },
      { artefact_id: 'comparison_report_internal', status: 'missing' },
      { artefact_id: 'route_variance_trace', status: 'missing' },
      { artefact_id: 'score_trace', status: 'missing' },
      { artefact_id: 'raw_report', status: 'emitted' },
    ],
    real_v3_spine_artefact_ids: ['comparison_raw','raw_report'],
  } as Record<string, unknown>;
  const next = reconcileComparisonManifestState(existing, { emitted_artefact_ids: ['comparison_report_internal','same_video_repeatability_trace','comparison_suppression_trace','route_variance_trace'], comparison_run_id: 'cmp-new' });
  expect(next.public_claim_trace_summary).toEqual({ claim_count: 3 });
  expect(next.score_trace_summary).toEqual({ score_count: 4 });
  expect(next.model_run_trace_summary).toEqual({ model_run_count: 2 });
  expect(next.validator_trace_summary).toEqual({ validation_count: 5 });
  expect(next.gate_trace_summary).toEqual({ gate_count: 6 });
  expect((next.emitted_artifacts as string[])).toContain('raw_report');
  expect((next.emitted_artifacts as string[])).not.toContain('comparison_raw');
  expect((next.emitted_artifacts as string[])).toContain('comparison_report_internal');
  expect((next.runtime_evidence_blocked_by_id as string[])).toEqual(['raw_report:legacy']);
  expect((next.emitted_blocked_artefact_ids as string[])).toEqual(['public_output_render']);
  expect((next.blocker_codes as string[])).toContain('comparison_JSON_missing');
  expect((next.blocker_codes as string[])).not.toContain('route_variance_trace_missing');
  expect((next.missing_artifacts as string[])).toEqual(expect.arrayContaining(['score_trace', 'validator_trace', 'comparison_raw']));
  expect((next.missing_artifacts as string[])).not.toContain('route_variance_trace');
  expect((next as any).comparison_raw_summary).toBeUndefined();
  expect((next as any).route_variance_trace_summary).toBeUndefined();
  expect((next.real_v3_spine_artefact_ids as string[])).toEqual(['raw_report']);
  const requiredById = Object.fromEntries(((next.required_artifacts as any[]) ?? []).map((x) => [x.artefact_id, x.status]));
  expect(requiredById.comparison_raw).toBe('missing');
  expect(requiredById.comparison_report_internal).toBe('emitted');
  expect(requiredById.route_variance_trace).toBe('emitted');
  expect(requiredById.score_trace).toBe('missing');
  expect(next.comparison_run_id).toBe('cmp-new');
});

it('reconcile helper clears stale previous full comparison state when all current writes fail', () => {
  const existing = {
    emitted_artifacts: ['comparison_raw','comparison_report_internal','same_video_repeatability_trace','comparison_suppression_trace','route_variance_trace','raw_report'],
    runtime_evidence_blocked_by_id: ['comparison_raw:previous_write_failed','raw_report:legacy'],
    blocker_codes: ['score_trace_missing', 'comparison_JSON_missing'],
    missing_artifacts: ['score_trace'],
    required_artifacts: [
      { artefact_id: 'comparison_raw', status: 'emitted' },
      { artefact_id: 'comparison_report_internal', status: 'emitted' },
      { artefact_id: 'same_video_repeatability_trace', status: 'emitted' },
      { artefact_id: 'comparison_suppression_trace', status: 'emitted' },
      { artefact_id: 'route_variance_trace', status: 'emitted' },
      { artefact_id: 'score_trace', status: 'missing' },
    ],
    comparison_raw_summary: { stale: true },
    comparison_report_internal_summary: { stale: true },
    same_video_repeatability_trace_summary: { stale: true },
    comparison_suppression_trace_summary: { stale: true },
    route_variance_trace_summary: { stale: true },
  } as Record<string, unknown>;
  const next = reconcileComparisonManifestState(existing, { emitted_artefact_ids: [] });
  expect((next.emitted_artifacts as string[])).toEqual(['raw_report']);
  expect((next.missing_artifacts as string[])).toEqual(expect.arrayContaining(['score_trace', 'comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace']));
  expect((next.blocker_codes as string[])).toEqual(expect.arrayContaining(['comparison_JSON_missing','comparison_report_unavailable','same_video_repeatability_trace_missing','comparison_suppression_trace_missing','route_variance_trace_missing']));
  expect((next.blocker_codes as string[])).not.toContain('comparison_report_internal_missing');
  expect((next.blocker_codes as string[])).toContain('score_trace_missing');
  expect((next.runtime_evidence_blocked_by_id as string[])).toEqual(['raw_report:legacy']);
  const requiredById = Object.fromEntries(((next.required_artifacts as any[]) ?? []).map((x) => [x.artefact_id, x.status]));
  expect(requiredById.comparison_raw).toBe('missing');
  expect(requiredById.comparison_report_internal).toBe('missing');
  expect(requiredById.same_video_repeatability_trace).toBe('missing');
  expect(requiredById.comparison_suppression_trace).toBe('missing');
  expect(requiredById.route_variance_trace).toBe('missing');
  expect(requiredById.score_trace).toBe('missing');
  expect((next as any).comparison_raw_summary).toBeUndefined();
  expect((next as any).comparison_report_internal_summary).toBeUndefined();
  expect((next as any).same_video_repeatability_trace_summary).toBeUndefined();
  expect((next as any).comparison_suppression_trace_summary).toBeUndefined();
  expect((next as any).route_variance_trace_summary).toBeUndefined();
});


it('storage sink preflight reads canonical key and succeeds when manifest exists', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  process.env.QA_ARTIFACT_STORAGE_BUCKET = 'qa-artifacts';
  const manifest = { run_id: 'take-s1', artefact_status_by_id: {}, blocker_codes: [] };
  download.mockResolvedValue({ data: { text: async () => JSON.stringify(manifest) }, error: null });
  const out = await emitComparisonRuntimeArtifacts({
    run_id: 'take-s1', analysis_run_id: 'ar-s1', take_id: 's1', comparison_run_id: 'cmp-s1', compared_take_ids: ['s1','s2'], internal_qa_emit: true,
    comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 's2' }, raw_comparison_decision_snapshot: { winner: 's2' } },
    suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false },
  });
  expect(out.written).toBe(true);
  expect(download).toHaveBeenCalledWith('take-s1/analysis-ar-s1/manifest.json');
  expect((out as any).warning ?? null).toBeNull();
});

it('file preflight canonicalises raw run_id to canonical take run root', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-file-canon-'));
  await seedExistingManifest(root, 'take-u123', 'u123', 'take-u123');
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'u123', analysis_run_id: 'take-u123', take_id: 'u123', comparison_run_id: 'cmp-u123', compared_take_ids: ['u123', 'u124'], root_dir: root, internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'u124' }, raw_comparison_decision_snapshot: { winner: 'u124' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(true);
  expect((out as any).warning ?? null).toBeNull();
});

it('file preflight accepts already canonical run_id', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-file-canon2-'));
  await seedExistingManifest(root, 'take-u200', 'u200', 'take-u200');
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-u200', analysis_run_id: 'take-u200', take_id: 'u200', comparison_run_id: 'cmp-u200', compared_take_ids: ['u200', 'u201'], root_dir: root, internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'u201' }, raw_comparison_decision_snapshot: { winner: 'u201' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(true);
});

it('file preflight rejects mismatched canonical run_id', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-file-mismatch-'));
  await seedExistingManifest(root, 'take-u301', 'u301', 'take-u301');
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-u999', analysis_run_id: 'take-u301', take_id: 'u301', comparison_run_id: 'cmp-u301', compared_take_ids: ['u301', 'u302'], root_dir: root, internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'u302' }, raw_comparison_decision_snapshot: { winner: 'u302' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(false);
  expect((out as any).comparison_artefacts_written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_unreadable');
});

it('storage sink missing manifest fails closed before writes', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: null, error: { status: 404, message: 'not found' } });
  const beforeUploads = upload.mock.calls.length;
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-s2', analysis_run_id: 'ar-s2', take_id: 's2', comparison_run_id: 'cmp-s2', compared_take_ids: ['s2','s3'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 's3' }, raw_comparison_decision_snapshot: { winner: 's3' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_missing');
  expect(upload.mock.calls.length).toBe(beforeUploads);
});

it('console_jsonl sink fails closed with unsupported-manifest-read warning and no writes', async () => {
  process.env.QA_ARTIFACT_SINK = 'console_jsonl';
  upload.mockClear();
  download.mockClear();
  const out = await emitComparisonRuntimeArtifacts({
    run_id: 'take-console1',
    analysis_run_id: 'ar-console1',
    take_id: 'console1',
    comparison_run_id: 'cmp-console1',
    compared_take_ids: ['console1', 'c2'],
    internal_qa_emit: true,
    comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'c2' }, raw_comparison_decision_snapshot: { winner: 'c2' } },
    suppression_trace: { suppression_decision: 'allowed' },
    same_video_repeatability_trace: { same_video_detected: false },
    route_variance_trace: { route_variance_detected: false },
  });
  expect(out.written).toBe(false);
  expect((out as any).reconciliation_written).toBe(false);
  expect((out as any).comparison_artefacts_written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_read_unsupported');
  expect((out as any).blocker_codes).toContain('comparison_reconciliation_manifest_read_unsupported');
  expect((out as any).blocker_codes).not.toContain('comparison_reconciliation_manifest_missing');
  expect((out as any).blocker_codes).not.toContain('comparison_reconciliation_manifest_unreadable');
  expect((out as any).emitted_artefact_ids).toEqual([]);
  expect(upload).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
});

it('readQAArtifactText storage 404 returns missing with canonical path', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: null, error: { statusCode: 404, message: 'Object not found' } });
  const out = await readQAArtifactText({ run_id: 'take-miss1', relative_path: 'takes/take-miss1/analysis-take-miss1/manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) {
    expect(out.code).toBe('missing');
    expect(out.storage_path).toBe('take-miss1/analysis-take-miss1/manifest.json');
  }
});

it('readQAArtifactText storage auth/permission errors return unreadable', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: null, error: { status: 403, message: 'forbidden' } });
  const out = await readQAArtifactText({ run_id: 'take-auth1', relative_path: 'manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe('unreadable');
});

it('storage sink auth/permission manifest error fails closed as unreadable', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: null, error: { status: 401, message: 'unauthorized' } });
  const beforeUploads = upload.mock.calls.length;
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-s2u', analysis_run_id: 'ar-s2u', take_id: 's2u', comparison_run_id: 'cmp-s2u', compared_take_ids: ['s2u','s3u'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 's3u' }, raw_comparison_decision_snapshot: { winner: 's3u' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(false);
  expect((out as any).reconciliation_written).toBe(false);
  expect((out as any).comparison_artefacts_written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_unreadable');
  expect((out as any).blocker_codes).toContain('comparison_reconciliation_manifest_unreadable');
  expect(upload.mock.calls.length).toBe(beforeUploads);
});

it('readQAArtifactText storage service errors return unreadable', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: null, error: { status: 500, message: 'storage service down' } });
  const out = await readQAArtifactText({ run_id: 'take-svc1', relative_path: 'manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe('unreadable');
});

it('readQAArtifactText storage bucket-not-found style error returns unreadable', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: null, error: { status: 404, message: 'Bucket not found' } });
  const out = await readQAArtifactText({ run_id: 'take-bucket404', relative_path: 'manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe('unreadable');
});

it('readQAArtifactText storage no-data/no-error returns unreadable', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: null, error: null });
  const out = await readQAArtifactText({ run_id: 'take-nodata', relative_path: 'manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe('unreadable');
});

it('readQAArtifactText storage text() failure returns unreadable', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => { throw new Error('blob-read-failed'); } }, error: null });
  const out = await readQAArtifactText({ run_id: 'take-textfail', relative_path: 'manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe('unreadable');
});

it('storage sink malformed manifest fails closed', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => '{bad-json' }, error: null });
  const beforeUploads = upload.mock.calls.length;
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-s3', analysis_run_id: 'ar-s3', take_id: 's3', comparison_run_id: 'cmp-s3', compared_take_ids: ['s3','s4'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 's4' }, raw_comparison_decision_snapshot: { winner: 's4' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_unreadable');
  expect(upload.mock.calls.length).toBe(beforeUploads);
});

it('storage sink array manifest fails closed (no empty-baseline reconciliation)', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => '[]' }, error: null });
  const beforeUploads = upload.mock.calls.length;
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-s3a', analysis_run_id: 'ar-s3a', take_id: 's3a', comparison_run_id: 'cmp-s3a', compared_take_ids: ['s3a','s4a'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 's4a' }, raw_comparison_decision_snapshot: { winner: 's4a' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(false);
  expect((out as any).reconciliation_written).toBe(false);
  expect((out as any).comparison_artefacts_written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_unreadable');
  expect((out as any).blocker_codes).toContain('comparison_reconciliation_manifest_unreadable');
  expect(upload.mock.calls.length).toBe(beforeUploads);
});

it.each(['null', '"hello"', '123', 'true'])('storage sink primitive manifest %s fails closed', async (raw) => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => raw }, error: null });
  const beforeUploads = upload.mock.calls.length;
  const out = await emitComparisonRuntimeArtifacts({ run_id: `take-prim-${raw.length}`, analysis_run_id: `ar-prim-${raw.length}`, take_id: `prim${raw.length}`, comparison_run_id: `cmp-prim-${raw.length}`, compared_take_ids: [`prim${raw.length}`,'p2'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'p2' }, raw_comparison_decision_snapshot: { winner: 'p2' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(false);
  expect((out as any).reconciliation_written).toBe(false);
  expect((out as any).comparison_artefacts_written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_unreadable');
  expect((out as any).blocker_codes).toContain('comparison_reconciliation_manifest_unreadable');
  expect(upload.mock.calls.length).toBe(beforeUploads);
});

it('storage sink inferred take_id uses canonical inferred key', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => JSON.stringify({ ok: true }) }, error: null });
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-derivedx', analysis_run_id: 'take-derivedx', comparison_run_id: 'cmp-dx', compared_take_ids: ['derivedx','d2'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'd2' }, raw_comparison_decision_snapshot: { winner: 'd2' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(true);
  expect(download).toHaveBeenCalledWith('take-derivedx/analysis-take-derivedx/manifest.json');
});

it('storage preflight canonicalises raw run_id and does not use raw UUID root key', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => JSON.stringify({ run_id: 'take-u401', artefact_status_by_id: {}, blocker_codes: [] }) }, error: null });
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'u401', analysis_run_id: 'take-u401', take_id: 'u401', comparison_run_id: 'cmp-u401', compared_take_ids: ['u401','u402'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'u402' }, raw_comparison_decision_snapshot: { winner: 'u402' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(true);
  expect(download).toHaveBeenCalledWith('take-u401/analysis-take-u401/manifest.json');
  expect(download).not.toHaveBeenCalledWith('u401/takes/take-u401/analysis-take-u401/manifest.json');
});

it('file preflight does not accept raw UUID fallback manifest path', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-file-rawfallback-'));
  await mkdir(path.join(root, 'u501'), { recursive: true });
  await writeFile(path.join(root, 'u501', 'manifest.json'), JSON.stringify({ fake: true }));
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'u501', analysis_run_id: 'take-u501', take_id: 'u501', comparison_run_id: 'cmp-u501', compared_take_ids: ['u501','u502'], root_dir: root, internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'u502' }, raw_comparison_decision_snapshot: { winner: 'u502' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(false);
  expect((out as any).comparison_artefacts_written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_missing');
});

it('valid object manifest still allows comparison writes and reconciliation persistence', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => JSON.stringify({ run_id: 'take-good', artefact_status_by_id: {}, blocker_codes: [] }) }, error: null });
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-good', analysis_run_id: 'ar-good', take_id: 'good', comparison_run_id: 'cmp-good', compared_take_ids: ['good','g2'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'g2' }, raw_comparison_decision_snapshot: { winner: 'g2' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(true);
  expect((out as any).comparison_artefacts_written).toBe(true);
  expect((out as any).reconciliation_written).toBe(true);
  expect((out as any).warning ?? null).not.toBe('comparison_reconciliation_manifest_unreadable');
});


it('persists reconciled manifest and metrics after successful comparison writes (no early return)', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-persist-'));
  await seedExistingManifest(root, 'take-persist', 'persist', 'take-persist');
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-persist', take_id: 'persist', analysis_run_id: 'take-persist', comparison_run_id: 'cmp-persist', compared_take_ids: ['persist','p2'], root_dir: root, internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'p2' }, raw_comparison_decision_snapshot: { winner: 'p2' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect((out as any).reconciliation_written).toBe(true);
  const manifest = JSON.parse(await readFile(path.join(root, 'take-persist', 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, 'take-persist', 'qa', 'acceptance_metrics.json'), 'utf8'));
  expect(manifest.artefact_status_by_id.comparison_raw).toBe('emitted');
  expect(metrics.comparison_runtime_artifact_count).toBe(5);
});

it('full comparison success removes stale comparison_report_unavailable while preserving non-comparison blockers', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-blocker-clear-'));
  await seedExistingManifest(root, 'take-clear', 'clear', 'take-clear');
  const manifestPath = path.join(root, 'take-clear', 'manifest.json');
  const seed = JSON.parse(await readFile(manifestPath, 'utf8'));
  seed.artefact_status_by_id.comparison_report_internal = 'missing';
  seed.required_artifacts = (seed.required_artifacts ?? []).map((entry: any) => entry.artefact_id === 'comparison_report_internal' ? { ...entry, status: 'missing' } : entry);
  seed.missing_artifacts = Array.from(new Set([...(seed.missing_artifacts ?? []), 'comparison_report_internal']));
  seed.blocker_codes = Array.from(new Set([...(seed.blocker_codes ?? []), 'comparison_report_unavailable', 'validator_trace_missing']));
  await writeFile(manifestPath, JSON.stringify(seed, null, 2));
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-clear', take_id: 'clear', analysis_run_id: 'take-clear', comparison_run_id: 'cmp-clear', compared_take_ids: ['clear','c2'], root_dir: root, internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'c2' }, raw_comparison_decision_snapshot: { winner: 'c2' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(true);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, 'take-clear', 'qa', 'acceptance_metrics.json'), 'utf8'));
  expect(manifest.artefact_status_by_id.comparison_report_internal).toBe('emitted');
  const requiredById = Object.fromEntries((manifest.required_artifacts ?? []).map((x: any) => [x.artefact_id, x.status]));
  expect(requiredById.comparison_report_internal).toBe('emitted');
  expect(manifest.emitted_artifacts).toContain('comparison_report_internal');
  expect(manifest.missing_artifacts).not.toContain('comparison_report_internal');
  expect(manifest.blocker_codes).not.toContain('comparison_report_unavailable');
  expect(manifest.blocker_codes).not.toContain('comparison_report_internal_missing');
  expect(manifest.blocker_codes).toContain('validator_trace_missing');
  expect(metrics.comparison_report_internal_status).toBe('emitted');
  expect(metrics.blocker_codes).not.toContain('comparison_report_unavailable');
  expect(JSON.stringify(manifest)).not.toContain('comparison_report_internal_missing');
  expect(JSON.stringify(metrics)).not.toContain('comparison_report_internal_missing');
  expect(metrics.level2_status).toBe('not_accepted');
});

it('partial failure keeps comparison_report_unavailable and removes successful comparison blockers', async () => {
  const existing = {
    emitted_artifacts: ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace', 'raw_report'],
    blocker_codes: ['comparison_report_unavailable', 'validator_trace_missing'],
    missing_artifacts: ['validator_trace'],
    required_artifacts: [
      { artefact_id: 'comparison_raw', status: 'emitted' },
      { artefact_id: 'comparison_report_internal', status: 'emitted' },
      { artefact_id: 'same_video_repeatability_trace', status: 'emitted' },
      { artefact_id: 'comparison_suppression_trace', status: 'emitted' },
      { artefact_id: 'route_variance_trace', status: 'emitted' },
      { artefact_id: 'validator_trace', status: 'missing' },
    ],
    artefact_status_by_id: {
      comparison_raw: 'emitted',
      comparison_report_internal: 'emitted',
      same_video_repeatability_trace: 'emitted',
      comparison_suppression_trace: 'emitted',
      route_variance_trace: 'emitted',
      validator_trace: 'missing',
    },
    artefact_source_classification_by_id: {
      raw_report: 'legacy_adapter',
      comparison_raw: 'internal_comparison_runtime',
      comparison_report_internal: 'internal_comparison_report',
      same_video_repeatability_trace: 'internal_comparison_trace',
      comparison_suppression_trace: 'internal_comparison_trace',
      route_variance_trace: 'internal_comparison_trace',
    },
    artefact_level2_spine_satisfaction_by_id: {
      raw_report: false,
      comparison_raw: true,
      comparison_report_internal: true,
      same_video_repeatability_trace: true,
      comparison_suppression_trace: true,
      route_variance_trace: true,
    },
  } as Record<string, unknown>;
  const next = reconcileComparisonManifestState(existing, { emitted_artefact_ids: ['comparison_raw', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace'] });
  expect((next.artefact_status_by_id as any).comparison_report_internal).toBe('missing');
  const requiredById = Object.fromEntries(((next.required_artifacts as any[]) ?? []).map((x) => [x.artefact_id, x.status]));
  expect(requiredById.comparison_report_internal).toBe('missing');
  expect((next.missing_artifacts as string[])).toContain('comparison_report_internal');
  expect((next.blocker_codes as string[])).toContain('comparison_report_unavailable');
  expect((next.blocker_codes as string[])).not.toContain('comparison_report_internal_missing');
  expect((next.blocker_codes as string[])).not.toContain('comparison_JSON_missing');
  expect((next.blocker_codes as string[])).not.toContain('same_video_repeatability_trace_missing');
  expect((next.blocker_codes as string[])).not.toContain('comparison_suppression_trace_missing');
  expect((next.blocker_codes as string[])).not.toContain('route_variance_trace_missing');
  expect((next.blocker_codes as string[])).toContain('validator_trace_missing');
  const source = next.artefact_source_classification_by_id as Record<string, string>;
  const level2 = next.artefact_level2_spine_satisfaction_by_id as Record<string, boolean>;
  expect(source.comparison_raw).toBe('internal_comparison_runtime');
  expect(source.same_video_repeatability_trace).toBe('internal_comparison_trace');
  expect(source.comparison_suppression_trace).toBe('internal_comparison_trace');
  expect(source.route_variance_trace).toBe('internal_comparison_trace');
  expect(source.comparison_report_internal).toBeUndefined();
  expect(source.raw_report).toBe('legacy_adapter');
  expect(level2.comparison_raw).toBe(false);
  expect(level2.same_video_repeatability_trace).toBe(false);
  expect(level2.comparison_suppression_trace).toBe(false);
  expect(level2.route_variance_trace).toBe(false);
  expect(level2.comparison_report_internal).toBeUndefined();
  expect(level2.raw_report).toBe(false);
});

it('reconciliation invariant: comparison states/classification/summaries are self-consistent and non-comparison state preserved', () => {
  const existing = {
    emitted_artifacts: ['raw_report', 'comparison_raw'],
    missing_artifacts: ['validator_trace'],
    blocker_codes: ['comparison_report_unavailable', 'validator_trace_missing'],
    runtime_evidence_blocked_by_id: ['comparison_raw:previous_write_failed', 'raw_report:legacy'],
    required_artifacts: [
      { artefact_id: 'comparison_raw', status: 'missing' },
      { artefact_id: 'comparison_report_internal', status: 'missing' },
      { artefact_id: 'same_video_repeatability_trace', status: 'missing' },
      { artefact_id: 'comparison_suppression_trace', status: 'missing' },
      { artefact_id: 'route_variance_trace', status: 'missing' },
      { artefact_id: 'validator_trace', status: 'missing' },
      { artefact_id: 'raw_report', status: 'emitted' },
    ],
    artefact_status_by_id: { raw_report: 'emitted', validator_trace: 'missing', comparison_raw: 'missing' },
    artefact_source_classification_by_id: { raw_report: 'legacy_adapter' },
    artefact_level2_spine_satisfaction_by_id: { raw_report: false },
    public_claim_trace_summary: { claim_count: 2 },
    comparison_raw_summary: { stale: true },
    comparison_report_internal_summary: { stale: true },
  } as Record<string, unknown>;
  const next = reconcileComparisonManifestState(existing, {
    emitted_artefact_ids: ['comparison_raw', 'comparison_report_internal', 'route_variance_trace'],
    comparison_summaries_by_id: {
      comparison_raw: { comparison_execution_status: 'executed' },
      comparison_report_internal: { comparison_run_id: 'cmp-1' },
      route_variance_trace: { route_variance_detected: false },
    },
  });
  const req = Object.fromEntries(((next.required_artifacts as any[]) ?? []).map((x) => [x.artefact_id, x.status]));
  const byId = next.artefact_status_by_id as Record<string, string>;
  for (const id of ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace']) {
    expect(byId[id]).toBe(req[id]);
  }
  expect((next.emitted_artifacts as string[])).toEqual(expect.arrayContaining(['comparison_raw', 'comparison_report_internal', 'route_variance_trace']));
  expect((next.missing_artifacts as string[])).toEqual(expect.arrayContaining(['same_video_repeatability_trace', 'comparison_suppression_trace']));
  expect((next.emitted_artifacts as string[])).not.toContain('same_video_repeatability_trace');
  const source = next.artefact_source_classification_by_id as Record<string, string>;
  const l2 = next.artefact_level2_spine_satisfaction_by_id as Record<string, boolean>;
  expect(source.comparison_raw).toBe('internal_comparison_runtime');
  expect(source.comparison_report_internal).toBe('internal_comparison_report');
  expect(source.route_variance_trace).toBe('internal_comparison_trace');
  expect(l2.comparison_raw).toBe(false);
  expect(l2.comparison_report_internal).toBe(false);
  expect(l2.route_variance_trace).toBe(false);
  expect((next.runtime_evidence_blocked_by_id as string[]).some((x) => x.startsWith('comparison_raw'))).toBe(false);
  expect((next.blocker_codes as string[])).not.toContain('comparison_report_unavailable');
  expect((next.blocker_codes as string[])).not.toContain('comparison_report_internal_missing');
  expect((next as any).comparison_raw_summary).toEqual({ comparison_execution_status: 'executed' });
  expect((next as any).comparison_report_internal_summary).toEqual({ comparison_run_id: 'cmp-1' });
  expect((next as any).route_variance_trace_summary).toEqual({ route_variance_detected: false });
  expect((next as any).same_video_repeatability_trace_summary).toBeUndefined();
  expect((next as any).comparison_suppression_trace_summary).toBeUndefined();
  expect((next.public_claim_trace_summary as any).claim_count).toBe(2);
  expect((next.blocker_codes as string[])).toContain('validator_trace_missing');
  expect((next.missing_artifacts as string[])).toContain('validator_trace');
});

it('all-current-write-failure clears stale comparison source + level2 metadata', () => {
  const existing = {
    emitted_artifacts: ['raw_report', 'comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace'],
    missing_artifacts: ['validator_trace'],
    blocker_codes: ['validator_trace_missing'],
    required_artifacts: [
      { artefact_id: 'comparison_raw', status: 'emitted' },
      { artefact_id: 'comparison_report_internal', status: 'emitted' },
      { artefact_id: 'same_video_repeatability_trace', status: 'emitted' },
      { artefact_id: 'comparison_suppression_trace', status: 'emitted' },
      { artefact_id: 'route_variance_trace', status: 'emitted' },
      { artefact_id: 'validator_trace', status: 'missing' },
    ],
    artefact_status_by_id: { raw_report: 'emitted', validator_trace: 'missing', comparison_raw: 'emitted', comparison_report_internal: 'emitted', same_video_repeatability_trace: 'emitted', comparison_suppression_trace: 'emitted', route_variance_trace: 'emitted' },
    artefact_source_classification_by_id: { raw_report: 'legacy_adapter', comparison_raw: 'internal_comparison_runtime', comparison_report_internal: 'internal_comparison_report', same_video_repeatability_trace: 'internal_comparison_trace', comparison_suppression_trace: 'internal_comparison_trace', route_variance_trace: 'internal_comparison_trace' },
    artefact_level2_spine_satisfaction_by_id: { raw_report: false, comparison_raw: true, comparison_report_internal: true, same_video_repeatability_trace: true, comparison_suppression_trace: true, route_variance_trace: true },
    comparison_raw_summary: { stale: true },
    comparison_report_internal_summary: { stale: true },
    same_video_repeatability_trace_summary: { stale: true },
    comparison_suppression_trace_summary: { stale: true },
    route_variance_trace_summary: { stale: true },
  } as Record<string, unknown>;
  const next = reconcileComparisonManifestState(existing, { emitted_artefact_ids: [] });
  const source = next.artefact_source_classification_by_id as Record<string, string>;
  const level2 = next.artefact_level2_spine_satisfaction_by_id as Record<string, boolean>;
  for (const id of ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace']) {
    expect(source[id]).toBeUndefined();
    expect(level2[id]).toBeUndefined();
  }
  expect(source.raw_report).toBe('legacy_adapter');
  expect(level2.raw_report).toBe(false);
  expect((next as any).comparison_raw_summary).toBeUndefined();
  expect((next as any).comparison_report_internal_summary).toBeUndefined();
  expect((next as any).same_video_repeatability_trace_summary).toBeUndefined();
  expect((next as any).comparison_suppression_trace_summary).toBeUndefined();
  expect((next as any).route_variance_trace_summary).toBeUndefined();
});

it('readQAArtifactText classifies EISDIR as unreadable', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-readerr-'));
  await mkdir(path.join(root, 'run-x', 'manifest.json'), { recursive: true });
  const out = await readQAArtifactText({ run_id: 'run-x', root_dir: root, relative_path: 'manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe('unreadable');
});

it('readQAArtifactText classifies ENOENT as missing', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-missingread-'));
  const out = await readQAArtifactText({ run_id: 'run-y', root_dir: root, relative_path: 'manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe('missing');
});


it('readQAArtifactText rejects traversal/absolute/slashed run_id in file mode', async () => {
  process.env.QA_ARTIFACT_SINK = 'file';
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-unsafe-runid-'));
  for (const runId of ['../outside', '../../x', '/abs/path', 'take-a/../take-b', 'take-a/take-b', 'take-a\\take-b']) {
    const out = await readQAArtifactText({ run_id: runId, root_dir: root, relative_path: 'manifest.json' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe('unreadable');
  }
});

it('readQAArtifactText rejects unsafe storage run_id before download', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockClear();
  const out = await readQAArtifactText({ run_id: '../outside', relative_path: 'manifest.json' });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe('unreadable');
  expect(download).not.toHaveBeenCalled();
});

it('readQAArtifactText storage safe run_id still reads canonical key', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => '{"ok":true}' }, error: null });
  const out = await readQAArtifactText({ run_id: 'take-safe123', relative_path: 'takes/take-safe123/analysis-take-safe123/manifest.json' });
  expect(out.ok).toBe(true);
  expect(download).toHaveBeenCalledWith('take-safe123/analysis-take-safe123/manifest.json');
});

it('readQAArtifactText rejects invalid relative_path without throwing and without download', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockClear();
  await expect(readQAArtifactText({ run_id: 'take-safe123', relative_path: '../manifest.json' })).resolves.toEqual({ ok: false, code: 'unreadable' });
  expect(download).not.toHaveBeenCalled();
});
