import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitComparisonRuntimeArtifacts, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring';

describe('v3 s8 comparison runtime traces', () => {
  it('does not emit synthetic suppression/repeatability traces when missing runtime data', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    const cmp = await emitComparisonRuntimeArtifacts({ run_id: 'run-1', root_dir: root, internal_qa_emit: true, route_variance_trace: { ok: true } });
    expect(cmp.emitted_artefact_ids).toContain('route_variance_trace');
    expect(cmp.emitted_artefact_ids).not.toContain('comparison_suppression_trace');
    expect(cmp.emitted_artefact_ids).not.toContain('same_video_repeatability_trace');
    await expect(stat(path.join(root, 'run-1', 'comparison_traces', 'comparison_suppression_trace.json'))).rejects.toBeTruthy();
    await expect(stat(path.join(root, 'run-1', 'comparison_traces', 'same_video_repeatability_trace.json'))).rejects.toBeTruthy();
    await emitQAManifestForAnalysisRun({ run_id: 'run-1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: cmp.emitted_artefact_ids });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-1', 'manifest.json'), 'utf8'));
    expect(manifest.missing_artifacts).toContain('comparison_suppression_trace');
    expect(manifest.missing_artifacts).toContain('same_video_repeatability_trace');
  });

  it('emits suppression/repeatability traces when runtime data exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    const cmp = await emitComparisonRuntimeArtifacts({ run_id: 'run-2', root_dir: root, internal_qa_emit: true, suppression_trace: { reason: 'x' }, same_video_repeatability_trace: { runs: 3 } });
    expect(cmp.emitted_artefact_ids).toContain('comparison_suppression_trace');
    expect(cmp.emitted_artefact_ids).toContain('same_video_repeatability_trace');
  });
});
