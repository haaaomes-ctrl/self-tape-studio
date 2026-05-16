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
  expect((next as any).comparison_raw_summary).toBeUndefined();
  expect((next as any).route_variance_trace_summary).toBeUndefined();
  expect((next.real_v3_spine_artefact_ids as string[])).toEqual(['raw_report']);
  expect(next.comparison_run_id).toBe('cmp-new');
});

it('reconcile helper clears stale previous full comparison state when all current writes fail', () => {
  const existing = {
    emitted_artifacts: ['comparison_raw','comparison_report_internal','same_video_repeatability_trace','comparison_suppression_trace','route_variance_trace','raw_report'],
    runtime_evidence_blocked_by_id: ['comparison_raw:previous_write_failed','raw_report:legacy'],
    blocker_codes: [],
    comparison_raw_summary: { stale: true },
    comparison_report_internal_summary: { stale: true },
    same_video_repeatability_trace_summary: { stale: true },
    comparison_suppression_trace_summary: { stale: true },
    route_variance_trace_summary: { stale: true },
  } as Record<string, unknown>;
  const next = reconcileComparisonManifestState(existing, { emitted_artefact_ids: [] });
  expect((next.emitted_artifacts as string[])).toEqual(['raw_report']);
  expect((next.blocker_codes as string[])).toEqual(expect.arrayContaining(['comparison_JSON_missing','comparison_report_internal_missing','same_video_repeatability_trace_missing','comparison_suppression_trace_missing','route_variance_trace_missing']));
  expect((next.runtime_evidence_blocked_by_id as string[])).toEqual(['raw_report:legacy']);
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

it('storage sink missing manifest fails closed before writes', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: null, error: { message: 'not found' } });
  const beforeUploads = upload.mock.calls.length;
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-s2', analysis_run_id: 'ar-s2', take_id: 's2', comparison_run_id: 'cmp-s2', compared_take_ids: ['s2','s3'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 's3' }, raw_comparison_decision_snapshot: { winner: 's3' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(false);
  expect((out as any).warning).toBe('comparison_reconciliation_manifest_missing');
  expect(upload.mock.calls.length).toBe(beforeUploads);
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

it('storage sink inferred take_id uses canonical inferred key', async () => {
  process.env.QA_ARTIFACT_SINK = 'storage';
  download.mockResolvedValue({ data: { text: async () => JSON.stringify({ ok: true }) }, error: null });
  const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-derivedx', analysis_run_id: 'take-derivedx', comparison_run_id: 'cmp-dx', compared_take_ids: ['derivedx','d2'], internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'd2' }, raw_comparison_decision_snapshot: { winner: 'd2' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
  expect(out.written).toBe(true);
  expect(download).toHaveBeenCalledWith('take-derivedx/analysis-take-derivedx/manifest.json');
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
