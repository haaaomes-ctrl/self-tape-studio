import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitComparisonRuntimeArtifacts, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

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
});
