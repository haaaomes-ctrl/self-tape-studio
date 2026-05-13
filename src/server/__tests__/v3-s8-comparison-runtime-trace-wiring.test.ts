import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitComparisonRuntimeArtifacts, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s8 comparison runtime traces', () => {
  it('does not emit synthetic suppression/repeatability traces when missing runtime data', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    const cmp = await emitComparisonRuntimeArtifacts({ run_id: 'run-1', root_dir: root, internal_qa_emit: true, route_variance_trace: { ok: true } });
    expect(cmp.emitted_artefact_ids).toContain('route_variance_trace');
    expect(cmp.emitted_artefact_ids).not.toContain('comparison_suppression_trace');
    expect(cmp.emitted_artefact_ids).not.toContain('same_video_repeatability_trace');
    await expect(stat(path.join(root, 'run-1', 'comparisons', 'comparison-run-1', 'comparison_traces', 'comparison_suppression_trace.json'))).resolves.toBeTruthy();
    await expect(stat(path.join(root, 'run-1', 'comparisons', 'comparison-run-1', 'comparison_traces', 'same_video_repeatability_trace.json'))).resolves.toBeTruthy();
    await emitQAManifestForAnalysisRun({ run_id: 'run-1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: cmp.emitted_artefact_ids, emitted_blocked_artefact_ids: cmp.emitted_blocked_artefact_ids });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-1', 'manifest.json'), 'utf8'));
    const blocked = manifest.required_artifacts.filter((a: {status:string}) => a.status === 'emitted_blocked').map((a: {artefact_id:string}) => a.artefact_id);
    expect(blocked).toContain('comparison_suppression_trace');
    expect(blocked).toContain('same_video_repeatability_trace');
  });

  it('emits suppression/repeatability traces when runtime data exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    const cmp = await emitComparisonRuntimeArtifacts({ run_id: 'run-2', root_dir: root, internal_qa_emit: true, suppression_trace: { reason: 'x' }, same_video_repeatability_trace: { runs: 3 } });
    expect(cmp.emitted_artefact_ids).toContain('comparison_suppression_trace');
    expect(cmp.emitted_artefact_ids).toContain('same_video_repeatability_trace');
  });

  it('emits internal comparison report when comparison raw is written', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    const cmp = await emitComparisonRuntimeArtifacts({ run_id: 'run-9', root_dir: root, internal_qa_emit: true, comparison_raw_data: { comparison_run_id: 'cmp-9', compared_take_ids: ['a', 'b'], duplicate_or_near_duplicate_detected: true } });
    expect(cmp.comparison_run_id).toBe('cmp-9');
    expect(cmp.emitted_artefact_ids).toContain('comparison_report_internal');
    await expect(stat(path.join(root, 'run-9', 'comparisons', 'comparison-cmp-9', 'comparison', 'comparison.report.internal.json'))).resolves.toBeTruthy();
  });

  it('uses comparison_id fallback so runtime artefacts stay in same directory family', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    const cmp = await emitComparisonRuntimeArtifacts({ run_id: 'run-10', comparison_id: 'cmp-10', root_dir: root, internal_qa_emit: true, comparison_raw_data: { recommendation_suppressed: true } });
    expect(cmp.comparison_run_id).toBe('cmp-10');
    await expect(stat(path.join(root, 'run-10', 'comparisons', 'comparison-cmp-10', 'comparison', 'comparison.raw.json'))).resolves.toBeTruthy();
  });



  it('rejects unsafe comparison id segments before writing runtime artifacts', async () => {
    await expect(emitComparisonRuntimeArtifacts({ run_id: 'run-unsafe', comparison_id: 'cmp/../../other', internal_qa_emit: true })).rejects.toThrow('comparison_run_id_invalid_path');
  });

  it('returns written false when comparison runtime sink writes fail', async () => {
    process.env.QA_ARTIFACT_SINK = 'file';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    const cmp = await emitComparisonRuntimeArtifacts({ run_id: 'run-3', root_dir: '/dev/null', internal_qa_emit: true, suppression_trace: { reason: 'x' }, same_video_repeatability_trace: { runs: 2 } });
    expect(cmp.written).toBe(false);
    expect(cmp.emitted_artefact_ids).toEqual([]);
  });

  it('does not claim emitted_blocked when blocked trace file writes fail', async () => {
    process.env.QA_ARTIFACT_SINK = 'file';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    const cmp = await emitComparisonRuntimeArtifacts({ run_id: 'run-4', root_dir: '/dev/null', internal_qa_emit: true });
    expect(cmp.written).toBe(false);
    expect(cmp.emitted_blocked_artefact_ids).toEqual([]);
  });
});
