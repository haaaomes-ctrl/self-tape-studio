import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitInternalQAArtifactManifest } from '@/server/v3/qa-artifacts.server';

describe('v3 s8 internal qa artefact emitter', () => {
  it('disabled by default writes no files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-artifacts-'));
    const out = await emitInternalQAArtifactManifest({ run_id: 'run-a', root_dir: root });
    expect(out.written).toBe(false);
  });

  it('enabled writes manifest under qa-artifacts/takes/take-<id>/analysis-<id>/manifest.json', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-artifacts-'));
    const out = await emitInternalQAArtifactManifest({ internal_qa_emit: true, run_id: 'run-b', take_id: 'take-b', analysis_run_id: 'run-b', root_dir: root, generated_at: '2026-05-12T00:00:00.000Z' });
    expect(out.written).toBe(true);
    const manifestPath = path.join(root, 'run-b', 'manifest.json');
    await expect(stat(manifestPath)).resolves.toBeTruthy();
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.no_export_status).toBe('no_export_proof_missing');
    expect(manifest.qa_artifact_root).toContain('takes/take-take-b/analysis-run-b');
    expect(manifest.artefact_status_by_id.comparison_report_internal).toBe('missing');
    expect(Array.isArray(manifest.emitted_blocked_artefact_ids)).toBe(true);
  });

  it('includes GF-01 fixture metadata and active P0', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-artifacts-'));
    await emitInternalQAArtifactManifest({ internal_qa_emit: true, run_id: 'run-c', root_dir: root, fixture_id: 'GF-01 / RT-15 / MT-same-video-20260511' });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-c', 'manifest.json'), 'utf8'));
    expect(manifest.fixture_observations.take_scores).toEqual([91, 94, 91]);
    expect(manifest.fixture_observations.comparison_recommendation).toBe('Take 2');
    expect(manifest.gate_statuses.some((g: { blocker_code: string }) => g.blocker_code === 'same_video_false_winner_active_P0')).toBe(true);
  });

  it('marks unavailable artefacts as missing with blocker codes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-artifacts-'));
    await emitInternalQAArtifactManifest({ internal_qa_emit: true, run_id: 'run-d', root_dir: root });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-d', 'manifest.json'), 'utf8'));
    expect(manifest.missing_artifacts).toContain('raw_report');
    expect(manifest.blocker_codes).toContain('raw_JSON_missing');
    expect(manifest.blocker_codes).toContain('no_export_proof_missing');
    expect(manifest.required_artifacts.length).toBeGreaterThanOrEqual(26);
  });

  it('rejects path traversal', async () => {
    await expect(emitInternalQAArtifactManifest({ internal_qa_emit: true, run_id: '../bad' })).rejects.toThrow('run_id_invalid_path');
  });

  it('infers comparison qa_artifact_root when comparison artefacts are emitted without explicit comparison_run_id', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-artifacts-'));
    await emitInternalQAArtifactManifest({ internal_qa_emit: true, run_id: 'run-e', root_dir: root, emitted_artefact_ids: ['comparison_raw'] });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-e', 'manifest.json'), 'utf8'));
    expect(manifest.qa_artifact_root).toContain('comparisons/comparison-run-e');
  });
});
