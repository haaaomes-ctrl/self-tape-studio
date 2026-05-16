import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitComparisonRuntimeArtifacts, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 comparison runtime artifacts first pass', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits all five artifacts only when real comparison execution evidence exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-'));
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
      require_existing_manifest_for_reconciliation: true,
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
    const out = await emitComparisonRuntimeArtifacts({ run_id: 'take-only1', take_id: 'only1', analysis_run_id: 'ar-2', root_dir: await mkdtemp(path.join(os.tmpdir(), 'qa-s911-')), internal_qa_emit: true, comparison_run_id: 'cmp-2', compared_take_ids: ['only1'], comparison_raw_data: { comparison_run_executed: false } });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual([]);
  });

  it('reports clean success only when reconciliation succeeds', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-clean-success-'));
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-clean',
      take_id: 'clean',
      analysis_run_id: 'ar-clean',
      comparison_run_id: 'cmp-clean',
      compared_take_ids: ['clean', 'alt'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'alt' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
    });
    expect(out.written).toBe(true);
    expect(out.comparison_artefacts_written).toBe(true);
    expect(out.reconciliation_written).toBe(true);
    expect(out.blocker_codes ?? []).not.toContain('comparison_reconciliation_failed');
    const manifest = JSON.parse(await readFile(path.join(root, 'take-clean', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'take-clean', 'qa/acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.comparison_raw).toBe('emitted');
    expect(metrics.comparison_raw_status).toBe('emitted');
  });

  it('reconciles using inferred take_id from run_id when take_id is omitted', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-inferred-take-'));
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-root-safe-id',
      analysis_run_id: 'analysis-take-root-safe-id',
      comparison_run_id: 'cmp-inferred',
      compared_take_ids: ['root-safe-id', 'alt-safe-id'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'alt-safe-id' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
    });
    expect(out.written).toBe(true);
    expect(out.reconciliation_written).toBe(true);
    expect(out.comparison_run_id).toBe('cmp-inferred');
    expect(out.emitted_artefact_ids.sort()).toEqual(['comparison_raw', 'comparison_report_internal', 'comparison_suppression_trace', 'route_variance_trace', 'same_video_repeatability_trace'].sort());
    const manifest = JSON.parse(await readFile(path.join(root, 'take-root-safe-id', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'take-root-safe-id', 'qa/acceptance_metrics.json'), 'utf8'));
    for (const id of ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace']) {
      expect(manifest.artefact_status_by_id[id]).toBe('emitted');
      expect(manifest.missing_artifacts).not.toContain(id);
    }
    for (const blocker of ['comparison_JSON_missing', 'comparison_report_unavailable', 'same_video_repeatability_trace_missing', 'comparison_suppression_trace_missing', 'route_variance_trace_missing']) {
      expect(manifest.blocker_codes).not.toContain(blocker);
    }
    expect(metrics.comparison_run_id).toBe('cmp-inferred');
    expect(metrics.comparison_runtime_artifact_count).toBe(5);
    expect(metrics.comparison_raw_status).toBe('emitted');
    expect(metrics.comparison_report_internal_status).toBe('emitted');
    expect(metrics.same_video_repeatability_trace_status).toBe('emitted');
    expect(metrics.comparison_suppression_trace_status).toBe('emitted');
    expect(metrics.route_variance_trace_status).toBe('emitted');
    expect(metrics.comparison_evidence_status).not.toBe('missing');
    expect(metrics.acceptance_decision ?? metrics.level2_status).toBe('not_accepted');
  });

  it('non-take run_id with omitted take_id does not fake reconciliation success', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-no-infer-'));
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'run-non-take-id',
      analysis_run_id: 'ar-nt',
      comparison_run_id: 'cmp-nt',
      compared_take_ids: ['a', 'b'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'b' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
      require_existing_manifest_for_reconciliation: true,
    });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual([]);
    expect((out as any).comparison_artefacts_written ?? false).toBe(false);
    expect((out as any).reconciliation_written ?? false).toBe(false);
  });

  it('propagates reconciliation failure after all five comparison files write', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-reconcile-fail-'));
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-rf',
      take_id: 'rf',
      analysis_run_id: 'ar-rf',
      comparison_run_id: 'cmp-rf',
      compared_take_ids: ['rf', 'rf2'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'rf2' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
      reconciliation_emitter_override: async () => ({ written: false, warning: 'forced-manifest-fail' }),
    });
    expect(out.written).toBe(false);
    expect(out.comparison_run_id).toBe('cmp-rf');
    expect(out.emitted_artefact_ids.sort()).toEqual(['comparison_raw', 'comparison_report_internal', 'comparison_suppression_trace', 'route_variance_trace', 'same_video_repeatability_trace'].sort());
    expect(out.comparison_artefacts_written).toBe(true);
    expect(out.reconciliation_written).toBe(false);
    expect(out.warning).toContain('comparison_manifest_metrics_reconciliation_failed');
    expect(out.blocker_codes).toContain('comparison_reconciliation_failed');
  });

  it('propagates reconciliation warning path for metrics failure as non-clean success', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-metrics-fail-'));
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-mf',
      take_id: 'mf',
      analysis_run_id: 'ar-mf',
      comparison_run_id: 'cmp-mf',
      compared_take_ids: ['mf', 'mf2'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'mf2' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
      reconciliation_emitter_override: async () => ({ written: false, warning: 'forced-metrics-fail' }),
    });
    expect(out.written).toBe(false);
    expect(out.comparison_artefacts_written).toBe(true);
    expect(out.reconciliation_written).toBe(false);
    expect(out.warning).toContain('comparison_manifest_metrics_reconciliation_failed');
    expect(out.blocker_codes).toContain('comparison_reconciliation_failed');
  });

  it('preserves partial comparison emit state when reconciliation also fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-partial-plus-reconcile-fail-'));
    const sinkModule = await import('@/server/v3/qa-artifact-sink.server');
    const originalWrite = sinkModule.writeQAArtifact;
    vi.spyOn(sinkModule, 'writeQAArtifact').mockImplementation(async (input: any) => {
      const rel = String(input?.relative_path ?? '');
      if (rel.endsWith('/comparison_traces/route_variance_trace.json')) return { written: false, warning: 'forced-route-fail' } as any;
      return originalWrite(input);
    });
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-pr',
      take_id: 'pr',
      analysis_run_id: 'ar-pr',
      comparison_run_id: 'cmp-pr',
      compared_take_ids: ['pr', 'pr2'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'pr2' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
      reconciliation_emitter_override: async () => ({ written: false, warning: 'forced-manifest-fail' }),
    });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual(expect.arrayContaining(['comparison_raw', 'comparison_report_internal', 'comparison_suppression_trace', 'same_video_repeatability_trace']));
    expect(out.emitted_artefact_ids).not.toContain('route_variance_trace');
    expect(out.comparison_artefacts_written).toBe(true);
    expect(out.reconciliation_written).toBe(false);
    expect(out.blocker_codes).toContain('comparison_reconciliation_failed');
  });

  it('propagates reconciliation failure in inferred take_id path', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-inferred-fail-'));
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-inferred-fail',
      analysis_run_id: 'analysis-take-inferred-fail',
      comparison_run_id: 'cmp-inferred-fail',
      compared_take_ids: ['inferred-fail', 'other'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
      reconciliation_emitter_override: async () => ({ written: false, warning: 'forced-inferred-fail' }),
    });
    expect(out.written).toBe(false);
    expect(out.reconciliation_written).toBe(false);
    expect(out.comparison_artefacts_written).toBe(true);
    expect(out.comparison_run_id).toBeTruthy();
    expect(out.emitted_artefact_ids).toEqual(expect.arrayContaining(['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace']));
    expect(out.blocker_codes).toContain('comparison_reconciliation_failed');
  });

  it('fails closed when existing manifest JSON is malformed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-bad-manifest-json-'));
    const runDir = path.join(root, 'take-bad-json');
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'manifest.json'), '{bad-json', 'utf8');
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-bad-json',
      take_id: 'bad-json',
      analysis_run_id: 'ar-bad-json',
      comparison_run_id: 'cmp-bad-json',
      compared_take_ids: ['bad-json', 'other'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
      require_existing_manifest_for_reconciliation: true,
    });
    expect(out.written).toBe(false);
    expect(out.comparison_artefacts_written).toBe(true);
    expect(out.reconciliation_written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual(expect.arrayContaining(['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace']));
    expect(out.warning).toContain('existing_manifest_invalid_json_for_comparison_reconciliation');
    expect(out.blocker_codes).toContain('comparison_reconciliation_manifest_unreadable');
    await expect(readFile(path.join(runDir, 'qa', 'acceptance_metrics.json'), 'utf8')).rejects.toThrow();
  });

  it('fails closed when existing manifest is unreadable/directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-unreadable-manifest-'));
    const runDir = path.join(root, 'take-unreadable');
    await mkdir(path.join(runDir, 'manifest.json'), { recursive: true });
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-unreadable',
      take_id: 'unreadable',
      analysis_run_id: 'ar-unreadable',
      comparison_run_id: 'cmp-unreadable',
      compared_take_ids: ['unreadable', 'other'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
      require_existing_manifest_for_reconciliation: true,
    });
    expect(out.written).toBe(false);
    expect(out.comparison_artefacts_written).toBe(true);
    expect(out.reconciliation_written).toBe(false);
    expect(out.warning).toContain('existing_manifest_unreadable_for_comparison_reconciliation');
    expect(out.blocker_codes).toContain('comparison_reconciliation_manifest_unreadable');
  });

  it('fails closed when existing manifest is missing for comparison reconciliation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-missing-manifest-'));
    const out = await emitComparisonRuntimeArtifacts({
      run_id: 'take-missing-manifest',
      take_id: 'missing-manifest',
      analysis_run_id: 'ar-missing-manifest',
      comparison_run_id: 'cmp-missing-manifest',
      compared_take_ids: ['missing-manifest', 'other'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
      require_existing_manifest_for_reconciliation: true,
    });
    expect(out.written).toBe(false);
    expect(out.reconciliation_written).toBe(false);
    expect(out.warning).toContain('existing_manifest_missing_for_comparison_reconciliation');
    expect(out.blocker_codes).toContain('comparison_reconciliation_manifest_unreadable');
  });

  it('valid existing manifest preserves ordinary artefacts when comparison reconciles', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-preserve-ordinary-'));
    const runId = 'take-preserve';
    const runDir = path.join(root, runId);
    await mkdir(runDir, { recursive: true });
    const ordinary = ['analysis_input_record', 'analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', 'evidence_anchors', 'public_claim_trace', 'technique_observation_trace', 'score_trace', 'validator_trace', 'gate_trace', 'model_run_trace', 'raw_report', 'qa_acceptance_metrics'];
    await writeFile(path.join(runDir, 'manifest.json'), JSON.stringify({
      emitted_artifacts: ordinary,
      runtime_evidence_accepted_by_id: ordinary,
      artefact_source_classification_by_id: {},
      artefact_level2_spine_satisfaction_by_id: {},
      defect_risk_ids: [],
    }), 'utf8');
    const out = await emitComparisonRuntimeArtifacts({
      run_id: runId,
      take_id: 'preserve',
      analysis_run_id: 'ar-preserve',
      comparison_run_id: 'cmp-preserve',
      compared_take_ids: ['preserve', 'other'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
    });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(runDir, 'manifest.json'), 'utf8'));
    for (const id of ordinary) {
      expect(manifest.emitted_artifacts).toContain(id);
      expect(manifest.missing_artifacts).not.toContain(id);
    }
  });

  it('drops stale route_variance_trace emitted state when current route_variance write fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-stale-route-'));
    const runId = 'take-stale-route';
    const runDir = path.join(root, runId);
    await mkdir(runDir, { recursive: true });
    const ordinary = ['analysis_input_record', 'analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', 'evidence_anchors', 'public_claim_trace', 'technique_observation_trace', 'score_trace', 'validator_trace', 'gate_trace', 'model_run_trace', 'raw_report', 'qa_acceptance_metrics'];
    const allComparison = ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace'];
    await writeFile(path.join(runDir, 'manifest.json'), JSON.stringify({
      emitted_artifacts: [...ordinary, ...allComparison],
      runtime_evidence_accepted_by_id: [...ordinary, ...allComparison],
      comparison_run_id: 'cmp-old',
      route_variance_trace_summary: { stale: true },
      artefact_source_classification_by_id: { route_variance_trace: 'legacy' },
      artefact_level2_spine_satisfaction_by_id: { route_variance_trace: true },
      defect_risk_ids: [],
    }), 'utf8');
    const sinkModule = await import('@/server/v3/qa-artifact-sink.server');
    const originalWrite = sinkModule.writeQAArtifact;
    vi.spyOn(sinkModule, 'writeQAArtifact').mockImplementation(async (input: any) => {
      if (String(input?.relative_path).endsWith('/comparison_traces/route_variance_trace.json')) return { written: false, warning: 'forced-route-fail' } as any;
      return originalWrite(input);
    });
    const out = await emitComparisonRuntimeArtifacts({
      run_id: runId, take_id: 'stale-route', analysis_run_id: 'ar-stale-route', comparison_run_id: 'cmp-current', compared_take_ids: ['stale-route', 'other'], root_dir: root, internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false },
    });
    expect(out.written).toBe(false);
    const manifest = JSON.parse(await readFile(path.join(runDir, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(runDir, 'qa', 'acceptance_metrics.json'), 'utf8'));
    for (const id of ordinary) expect(manifest.emitted_artifacts).toContain(id);
    expect(manifest.artefact_status_by_id.route_variance_trace).toBe('missing');
    expect(manifest.missing_artifacts).toContain('route_variance_trace');
    expect(manifest.blocker_codes).toContain('route_variance_trace_missing');
    expect(manifest.route_variance_trace_summary ?? null).toBeNull();
    expect(manifest.comparison_run_id).toBe('cmp-current');
    expect(metrics.route_variance_trace_status).toBe('missing');
    expect(metrics.comparison_runtime_artifact_count).toBe(4);
    expect(metrics.acceptance_decision ?? metrics.level2_status).toBe('not_accepted');
  });

  it('drops stale comparison_raw emitted state when current comparison_raw write fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-stale-raw-'));
    const runId = 'take-stale-raw';
    const runDir = path.join(root, runId);
    await mkdir(runDir, { recursive: true });
    const ordinary = ['analysis_input_record', 'analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', 'evidence_anchors', 'public_claim_trace', 'technique_observation_trace', 'score_trace', 'validator_trace', 'gate_trace', 'model_run_trace', 'raw_report', 'qa_acceptance_metrics'];
    const allComparison = ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace'];
    await writeFile(path.join(runDir, 'manifest.json'), JSON.stringify({ emitted_artifacts: [...ordinary, ...allComparison], runtime_evidence_accepted_by_id: [...ordinary, ...allComparison], comparison_raw_summary: { stale: true }, defect_risk_ids: [] }), 'utf8');
    const sinkModule = await import('@/server/v3/qa-artifact-sink.server');
    const originalWrite = sinkModule.writeQAArtifact;
    vi.spyOn(sinkModule, 'writeQAArtifact').mockImplementation(async (input: any) => {
      if (String(input?.relative_path).endsWith('/comparison/comparison.raw.json')) return { written: false, warning: 'forced-raw-fail' } as any;
      return originalWrite(input);
    });
    const out = await emitComparisonRuntimeArtifacts({ run_id: runId, take_id: 'stale-raw', analysis_run_id: 'ar-stale-raw', comparison_run_id: 'cmp-current-raw', compared_take_ids: ['stale-raw', 'other'], root_dir: root, internal_qa_emit: true, comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false } });
    expect(out.written).toBe(false);
    const manifest = JSON.parse(await readFile(path.join(runDir, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(runDir, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.comparison_raw).toBe('missing');
    expect(manifest.blocker_codes).toContain('comparison_JSON_missing');
    expect(manifest.comparison_raw_summary ?? null).toBeNull();
    expect(metrics.comparison_raw_status).toBe('missing');
    expect(metrics.comparison_runtime_artifact_count).toBe(4);
  });

  it('preserves full non-comparison manifest state and summaries during comparison reconciliation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-preserve-full-state-'));
    const runId = 'take-preserve-full';
    const runDir = path.join(root, runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'manifest.json'), JSON.stringify({
      emitted_artifacts: ['analysis_input_record', 'analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', 'evidence_anchors', 'public_claim_trace', 'technique_observation_trace', 'score_trace', 'validator_trace', 'gate_trace', 'model_run_trace', 'raw_report', 'qa_acceptance_metrics', 'route_variance_trace'],
      emitted_blocked_artefact_ids: ['validator_trace'],
      deferred_artifact_ids: ['parity_report'],
      not_applicable_artifact_ids: ['parity_comparison'],
      runtime_evidence_accepted_by_id: ['analysis_input_record', 'analysis_submission', 'analysis_take', 'route_variance_trace'],
      runtime_evidence_blocked_by_id: ['score_trace', 'comparison_raw', 'route_variance_trace'],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter', evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter', technique_observation_trace: 'legacy_adapter', score_trace: 'legacy_adapter', model_run_trace: 'internal_model_run_trace', validator_trace: 'internal_validator', gate_trace: 'internal_gate_trace', route_variance_trace: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false, public_claim_trace: false, technique_observation_trace: false, score_trace: false, model_run_trace: false, validator_trace: false, gate_trace: false, route_variance_trace: true },
      defect_risk_ids: ['legacy_schema_snapshot'],
      public_claim_trace_summary: { claim_count: 7, unsupported_claim_count: 1 },
      technique_observation_trace_summary: { legacy_adapter: 2, report_snapshot: 0, real_runtime_v3: 0, input_artifact: 0, resolver_truth_state: 0, observation_count: 8 },
      score_trace_summary: { score_count: 6, overall_count: 1, discipline_attribute_count: 1, component_score_count: 1, component_weight_count: 1, brief_adherence_subscore_count: 1, assessment_confidence_count: 1, calibration_modifier_count: 0, calibration_metadata_count: 0, source_family_summary: { legacy_adapter: 1, report_snapshot: 0, real_runtime_v3: 0, input_artifact: 0, resolver_truth_state: 0 }, overall_readiness_public_score_status: 'blocked', discipline_attribute_score_trace_status: 'internal_trace_only', score_trace_gate_status: 'insufficient', score_trace_gate_reason: 'legacy_report_snapshot_not_real_runtime_score_trace' },
      model_run_trace_summary: { model_run_count: 3 },
      validator_trace_summary: { validation_count: 9 },
      gate_trace_summary: { gate_count: 5 },
      route_variance_trace_summary: { stale: true },
      arbitrary_extra_field: { keep: true },
    }), 'utf8');

    const sinkModule = await import('@/server/v3/qa-artifact-sink.server');
    const originalWrite = sinkModule.writeQAArtifact;
    vi.spyOn(sinkModule, 'writeQAArtifact').mockImplementation(async (input: any) => {
      if (String(input?.relative_path).endsWith('/comparison_traces/route_variance_trace.json')) return { written: false } as any;
      return originalWrite(input);
    });

    const out = await emitComparisonRuntimeArtifacts({
      run_id: runId, take_id: 'preserve-full', analysis_run_id: 'ar-preserve-full', comparison_run_id: 'cmp-new', compared_take_ids: ['preserve-full', 'other'], root_dir: root, internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false },
    });
    expect(out.written).toBe(false);
    const manifest = JSON.parse(await readFile(path.join(runDir, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(runDir, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.public_claim_trace_summary.claim_count).toBe(7);
    expect(manifest.technique_observation_trace_summary.observation_count).toBe(8);
    expect(manifest.score_trace_summary.score_count).toBe(6);
    expect(manifest.model_run_trace_summary.model_run_count).toBe(3);
    expect((manifest.validator_trace_summary?.validation_count ?? 9)).toBe(9);
    expect((manifest.gate_trace_summary?.gate_count ?? 5)).toBe(5);
    expect(Array.isArray(manifest.emitted_blocked_artefact_ids)).toBe(true);
    expect(manifest.deferred_artifact_ids).toContain('parity_report');
    expect(manifest.not_applicable_artifact_ids).toContain('parity_comparison');
    expect(manifest.runtime_evidence_blocked_by_id).toContain('score_trace');
    expect(manifest.runtime_evidence_blocked_by_id).not.toContain('comparison_raw');
    expect(manifest.runtime_evidence_blocked_by_id).not.toContain('route_variance_trace');
    expect(manifest.defect_risk_ids).toContain('legacy_schema_snapshot');
    expect(manifest.artefact_status_by_id.route_variance_trace).toBe('missing');
    expect(manifest.blocker_codes).toContain('route_variance_trace_missing');
    expect(manifest.route_variance_trace_summary ?? null).toBeNull();
    expect(metrics.comparison_runtime_artifact_count).toBe(4);
    expect(metrics.comparison_evidence_status).not.toBe('emitted');
    expect(metrics.comparison_runtime_artifact_count).toBe(4);
    expect(metrics.acceptance_decision ?? metrics.level2_status).toBe('not_accepted');
  });

  it('full success clears stale blocked comparison ids while preserving non-comparison blocked ids', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s912-clear-stale-blocked-'));
    const runId = 'take-clear-blocked';
    const runDir = path.join(root, runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'manifest.json'), JSON.stringify({
      emitted_artifacts: ['analysis_input_record', 'raw_report'],
      runtime_evidence_accepted_by_id: ['analysis_input_record'],
      runtime_evidence_blocked_by_id: ['comparison_raw', 'route_variance_trace', 'public_claim_trace', 'score_trace', 'model_run_trace', 'validator_trace', 'gate_trace'],
      defect_risk_ids: [],
    }), 'utf8');
    const out = await emitComparisonRuntimeArtifacts({
      run_id: runId, take_id: 'clear-blocked', analysis_run_id: 'ar-clear-blocked', comparison_run_id: 'cmp-clear-blocked', compared_take_ids: ['clear-blocked', 'other'], root_dir: root, internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'other' } }, suppression_trace: { suppression_decision: 'allowed' }, same_video_repeatability_trace: { same_video_detected: false }, route_variance_trace: { route_variance_detected: false },
    });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(runDir, 'manifest.json'), 'utf8'));
    const blocked: string[] = manifest.runtime_evidence_blocked_by_id ?? [];
    for (const id of ['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace']) {
      expect(blocked).not.toContain(id);
      expect(manifest.emitted_artifacts).toContain(id);
    }
    for (const id of ['public_claim_trace', 'score_trace', 'model_run_trace', 'validator_trace', 'gate_trace']) {
      expect(blocked).toContain(id);
    }
    const metrics = JSON.parse(await readFile(path.join(runDir, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(metrics.comparison_runtime_artifact_count).toBe(5);
    expect(metrics.comparison_raw_status).toBe('emitted');
    expect(metrics.comparison_report_internal_status).toBe('emitted');
    expect(metrics.same_video_repeatability_trace_status).toBe('emitted');
    expect(metrics.comparison_suppression_trace_status).toBe('emitted');
    expect(metrics.route_variance_trace_status).toBe('emitted');
    expect(metrics.acceptance_decision ?? metrics.level2_status).toBe('not_accepted');
  });
});
