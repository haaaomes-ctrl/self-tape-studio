import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitComparisonRuntimeArtifacts, emitComparisonRuntimeArtifactsWithManifestReconciliation, emitQAManifestForAnalysisRun, resolveCanonicalComparisonReconciliationIdentity, reconcileComparisonManifestState } from '@/server/v3/qa-artifacts-wiring.server';
import { readQAArtifactText } from '@/server/v3/qa-artifact-sink.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';


beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('v3 s9 comparison runtime artifacts first pass', () => {
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

  it('persists comparison_run_id to manifest and qa acceptance metrics when comparison artefacts are emitted', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'take-root3',
      take_id: 'root3',
      analysis_run_id: 'take-root3',
      comparison_run_id: null,
      compared_take_ids: ['root3'],
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: [],
    });
    const out = await emitComparisonRuntimeArtifactsWithManifestReconciliation({
      run_id: 'take-root3',
      take_id: 'root3',
      root_take_id: 'root3',
      analysis_run_id: 'take-root3',
      comparison_run_id: 'cmp-root3',
      compared_take_ids: ['root3', 'root4'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: { comparison_execution_status: 'executed', comparison_result_summary: { winner: 'root3' } },
      suppression_trace: { suppression_decision: 'allowed' },
      same_video_repeatability_trace: { same_video_detected: false },
      route_variance_trace: { route_variance_detected: false },
    });
    expect(out.written).toBe(true);
    expect(out.comparison_run_id).toBe('cmp-root3');
    expect(out.emitted_artefact_ids.sort()).toEqual(['comparison_raw', 'comparison_report_internal', 'comparison_suppression_trace', 'route_variance_trace', 'same_video_repeatability_trace'].sort());
    expect(out.comparison_parity_written).toBe(true);
    expect(out.comparison_parity_status).toBe('insufficient');
    expect(out.emitted_blocked_artefact_ids).toContain('parity_comparison');
    expect(out.blocker_codes).toContain('parity_artefacts_missing');
    const parity = JSON.parse(await readFile(path.join(root, 'take-root3', 'takes', 'take-root3', 'analysis-take-root3', 'parity', 'comparison_parity.json'), 'utf8'));
    expect(parity.parity_status).toBe('insufficient');
    expect(parity.comparison_invoked).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(root, 'take-root3', 'manifest.json'), 'utf8'));
    expect(manifest.comparison_run_id).toBe('cmp-root3');
    expect(manifest.compared_take_ids).toEqual(['root3', 'root4']);
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
    expect(manifest.emitted_blocked_artefact_ids).toContain('parity_comparison');
    expect(manifest.not_applicable_artifact_ids).not.toContain('parity_comparison');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    const metrics = JSON.parse(await readFile(path.join(root, 'take-root3', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(metrics.comparison_run_id).toBe('cmp-root3');
    expect(metrics.compared_take_ids).toEqual(['root3', 'root4']);
    expect(metrics.comparison_runtime_artifact_count).toBe(5);
    expect(metrics.emitted_blocked_artefacts).toContain('parity_comparison');
    expect(metrics.not_applicable_artefacts).not.toContain('parity_comparison');
    expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('recomputes satisfying comparison parity during manifest reconciliation when risk context is complete', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'take-root5',
      take_id: 'root5',
      analysis_run_id: 'take-root5',
      comparison_run_id: null,
      compared_take_ids: ['root5'],
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: [],
    });
    const out = await emitComparisonRuntimeArtifactsWithManifestReconciliation({
      run_id: 'take-root5',
      take_id: 'root5',
      root_take_id: 'root5',
      analysis_run_id: 'take-root5',
      comparison_run_id: 'cmp-root5',
      compared_take_ids: ['take-root5', 'take-root5', 'take-root6'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_raw_data: {
        comparison_execution_status: 'executed',
        comparison_result_summary: { selected_take_id_internal_only: 'root5' },
        forced_winner_risk: false,
        false_winner_risk: false,
      },
      suppression_trace: { false_winner_prevention_status: 'not_required' },
      same_video_repeatability_trace: { same_video_detected: false, repeated_input_detected: false },
      route_variance_trace: { route_variance_detected: false, route_mismatch_detected: false, route_variance_status: 'not_detected' },
    });
    expect(out.written).toBe(true);
    expect(out.comparison_parity_written).toBe(true);
    expect(out.comparison_parity_status).toBe('passed');
    expect(out.emitted_artefact_ids).toContain('parity_comparison');
    expect(out.emitted_blocked_artefact_ids).not.toContain('parity_comparison');
    const manifest = JSON.parse(await readFile(path.join(root, 'take-root5', 'manifest.json'), 'utf8'));
    expect(manifest.compared_take_ids).toEqual(['root5', 'root6']);
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted');
    expect(manifest.emitted_artifacts).toContain('parity_comparison');
    expect(manifest.emitted_blocked_artefact_ids).not.toContain('parity_comparison');
    expect(manifest.runtime_evidence_accepted_by_id).toContain('parity_comparison');
    expect(manifest.runtime_evidence_blocked_by_id).not.toContain('parity_comparison');
    expect(manifest.required_artifacts.find((artefact: any) => artefact.artefact_id === 'parity_comparison')?.blocker_code).toBeUndefined();
    const metrics = JSON.parse(await readFile(path.join(root, 'take-root5', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(metrics.compared_take_ids).toEqual(['root5', 'root6']);
    expect(metrics.emitted_artefacts).toContain('parity_comparison');
    expect(metrics.emitted_blocked_artefacts).not.toContain('parity_comparison');
    expect(metrics.runtime_evidence_accepted_by_id).toContain('parity_comparison');
    expect(metrics.runtime_evidence_blocked_by_id).not.toContain('parity_comparison');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });
});


describe('canonical comparison reconciliation identity resolver', () => {
  it('raw UUID source_run_id canonicalises', () => {
    const out = resolveCanonicalComparisonReconciliationIdentity({ run_id: '123e4567-e89b-42d3-a456-426614174000', take_id: '123e4567-e89b-42d3-a456-426614174000', compared_take_ids: ['123e4567-e89b-42d3-a456-426614174000', 'b'] });
    expect(out.identity_status).toBe('resolved');
    expect(out.canonical_qa_run_id).toBe('take-123e4567-e89b-42d3-a456-426614174000');
  });
  it('canonical run_id accepted', () => {
    const out = resolveCanonicalComparisonReconciliationIdentity({ run_id: 'take-a', take_id: 'a', compared_take_ids: ['a','b'] });
    expect(out.identity_status).toBe('resolved');
  });
  it('arbitrary safe source_run_id does not become storage root', () => {
    const out = resolveCanonicalComparisonReconciliationIdentity({ run_id: 'safe-source-1', take_id: 'a', compared_take_ids: ['a','b'] });
    expect(out.identity_status).toBe('resolved');
    expect(out.canonical_qa_run_id).toBe('take-a');
  });
  it('take-shaped mismatch fails closed', () => {
    const out = resolveCanonicalComparisonReconciliationIdentity({ run_id: 'take-b', take_id: 'a', compared_take_ids: ['a','b'] });
    expect(out.identity_status).toBe('comparison_reconciliation_manifest_identity_mismatch');
  });
  it('analysis_run_id mismatch fails closed', () => {
    const out = resolveCanonicalComparisonReconciliationIdentity({ run_id: 'take-a', take_id: 'a', analysis_run_id: 'wrong', compared_take_ids: ['a','b'] });
    expect(out.identity_status).toBe('comparison_reconciliation_manifest_identity_mismatch');
  });
  it('root take not first resolves root identity correctly', () => {
    const out = resolveCanonicalComparisonReconciliationIdentity({ run_id: 'take-b', root_take_id: 'b', compared_take_ids: ['a','b'] });
    expect(out.identity_status).toBe('resolved');
    expect(out.canonical_take_id).toBe('b');
  });
  it('root take missing fails closed', () => {
    const out = resolveCanonicalComparisonReconciliationIdentity({ run_id: 'take-z', root_take_id: 'z', compared_take_ids: ['a','b'] });
    expect(out.identity_status).toBe('comparison_reconciliation_manifest_identity_mismatch');
  });
  it('no take-take path and no analysis-undefined path and no comparison_run_id root', () => {
    const out = resolveCanonicalComparisonReconciliationIdentity({ run_id: 'take-a', take_id: 'a', compared_take_ids: ['a','b'] });
    expect(out.canonical_comparison_root.includes('take-take-')).toBe(false);
    expect(out.canonical_comparison_root.includes('analysis-undefined')).toBe(false);
    expect(out.canonical_qa_run_id).not.toContain('cmp-');
  });
});


describe('sink read hardening for comparison preflight', () => {
  it('invalid relative_path returns unreadable', async () => {
    const out = await readQAArtifactText({ run_id: 'take-a', relative_path: '../manifest.json' });
    expect(out.status).toBe('unreadable');
  });
  it('invalid run_id returns unreadable', async () => {
    const out = await readQAArtifactText({ run_id: '../bad', relative_path: 'manifest.json' });
    expect(out.status).toBe('unreadable');
  });
  it('console_jsonl unsupported', async () => {
    vi.stubEnv('QA_ARTIFACT_SINK', 'console_jsonl');
    const out = await readQAArtifactText({ run_id: 'take-a', relative_path: 'manifest.json' });
    expect(out.status).toBe('unsupported');
    expect(out.warning).toBe('comparison_reconciliation_manifest_read_unsupported');
  });
  it('file missing returns missing', async () => {
    vi.stubEnv('QA_ARTIFACT_SINK', 'file');
    const out = await readQAArtifactText({ run_id: 'take-a', relative_path: 'manifest.json', root_dir: '/tmp/non-existent-root' });
    expect(out.status).toBe('missing');
  });
  it('storage 404 returns missing and non-404 unreadable and no-data unreadable and text failure unreadable', async () => {
    vi.stubEnv('QA_ARTIFACT_SINK', 'storage');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
    const download = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: '404 object not found' } })
      .mockResolvedValueOnce({ data: null, error: { message: '403 forbidden' } })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { text: async () => { throw new Error('boom'); } }, error: null });
    vi.spyOn(supabaseAdmin.storage, 'from').mockReturnValue({ download } as any);
    expect((await readQAArtifactText({ run_id: 'take-a', relative_path: 'manifest.json' })).status).toBe('missing');
    expect((await readQAArtifactText({ run_id: 'take-a', relative_path: 'manifest.json' })).status).toBe('unreadable');
    expect((await readQAArtifactText({ run_id: 'take-a', relative_path: 'manifest.json' })).status).toBe('unreadable');
    expect((await readQAArtifactText({ run_id: 'take-a', relative_path: 'manifest.json' })).status).toBe('unreadable');
  });
});


describe('pure comparison manifest reconciliation helper', () => {
  const baseManifest = {
    emitted_artifacts: ['raw_report', 'comparison_raw', 'comparison_report_internal'],
    missing_artifacts: ['resolver_output'],
    blocker_codes: ['x_other', 'comparison_report_unavailable', 'comparison_report_internal_missing'],
    runtime_evidence_accepted_by_id: ['raw_report', 'comparison_raw'],
    runtime_evidence_blocked_by_id: ['truth_state_map', 'comparison_report_internal'],
    artefact_status_by_id: { raw_report: 'emitted', comparison_raw: 'emitted', comparison_report_internal: 'missing' },
    artefact_source_classification_by_id: { raw_report: 'legacy_adapter', comparison_raw: 'old_source', comparison_report_internal: 'old_source' },
    artefact_level2_spine_satisfaction_by_id: { raw_report: false, comparison_raw: true, comparison_report_internal: true },
    required_artifacts: [
      { artefact_id: 'raw_report', status: 'emitted' },
      { artefact_id: 'comparison_raw', status: 'emitted' },
      { artefact_id: 'comparison_report_internal', status: 'missing' },
      { artefact_id: 'same_video_repeatability_trace', status: 'missing' },
      { artefact_id: 'comparison_suppression_trace', status: 'missing' },
      { artefact_id: 'route_variance_trace', status: 'missing' },
    ],
  } as any;

  it('full success marks all five emitted and uses report_unavailable mapping only', () => {
    const out = reconcileComparisonManifestState({ manifest: baseManifest, comparison_write_success_by_id: {
      comparison_raw: true, comparison_report_internal: true, same_video_repeatability_trace: true, comparison_suppression_trace: true, route_variance_trace: true,
    } });
    for (const id of ['comparison_raw','comparison_report_internal','same_video_repeatability_trace','comparison_suppression_trace','route_variance_trace']) {
      expect(out.emitted_artifacts).toContain(id);
      expect(out.artefact_status_by_id[id]).toBe('emitted');
    }
    expect(out.blocker_codes).not.toContain('comparison_report_internal_missing');
    expect(out.blocker_codes).not.toContain('comparison_report_unavailable');
    expect(out.artefact_source_classification_by_id.comparison_report_internal).toBe('internal_comparison_report');
    expect(out.artefact_level2_spine_satisfaction_by_id.comparison_raw).toBe(false);
  });

  it('partial success marks only successful current writes emitted and clears stale metadata for missing', () => {
    const out = reconcileComparisonManifestState({ manifest: baseManifest, comparison_write_success_by_id: { comparison_raw: true } });
    expect(out.emitted_artifacts).toContain('comparison_raw');
    expect(out.emitted_artifacts).not.toContain('comparison_report_internal');
    expect(out.missing_artifacts).toContain('comparison_report_internal');
    expect(out.blocker_codes).toContain('comparison_report_unavailable');
    expect(out.artefact_source_classification_by_id.comparison_report_internal).toBeUndefined();
    expect(out.artefact_level2_spine_satisfaction_by_id.comparison_report_internal).toBeUndefined();
  });

  it('all writes fail clears old comparison emitted state and preserves non-comparison', () => {
    const out = reconcileComparisonManifestState({ manifest: baseManifest, comparison_write_success_by_id: {} });
    for (const id of ['comparison_raw','comparison_report_internal','same_video_repeatability_trace','comparison_suppression_trace','route_variance_trace']) {
      expect(out.emitted_artifacts).not.toContain(id);
      expect(out.missing_artifacts).toContain(id);
    }
    expect(out.emitted_artifacts).toContain('raw_report');
    expect(out.blocker_codes).toContain('x_other');
    expect(out.required_artifacts.find((a:any)=>a.artefact_id==='comparison_report_internal').status).toBe('missing');
  });
});
