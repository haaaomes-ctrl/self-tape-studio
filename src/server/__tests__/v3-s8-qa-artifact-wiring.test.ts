import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitQAManifestForAnalysisRun, resolveInternalQAEmitEnabled } from '@/server/v3/qa-artifacts-wiring.server';


const ENV_KEYS = ['INTERNAL_QA_EMIT', 'V3_QA_ARTIFACTS_ENABLED'] as const;

beforeEach(() => {
  for (const key of ENV_KEYS) vi.stubEnv(key, undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});
describe('v3 s8 qa artifact wiring', () => {
  it('ordinary run with internal_qa_emit false writes nothing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-wiring-'));
    const out = await emitQAManifestForAnalysisRun({ run_id: 'run-1', root_dir: root, internal_qa_emit: false });
    expect(out.written).toBe(false);
    await expect(stat(path.join(root, 'run-1', 'manifest.json'))).rejects.toBeTruthy();
  });

  it('enabled run writes and carries runtime metadata while preserving blocked statuses', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-wiring-'));
    const out = await emitQAManifestForAnalysisRun({
      run_id: 'run-2',
      root_dir: root,
      internal_qa_emit: true,
      submission_id: 'sub-123',
      take_ids: ['take-a', 'take-b'],
      route_module: 'analysis-wrapper',
      fixture_id: 'GF-01 / RT-15 / MT-same-video-20260511',
      mux_playback_ids: { take_1_mux_playback_id: 'abc' },
    });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(root, 'run-2', 'manifest.json'), 'utf8'));
    expect(manifest.input_refs).toContain('submission:sub-123');
    expect(manifest.take_refs).toEqual(['take-a', 'take-b']);
    expect(manifest.fixture_refs).toContain('route:analysis-wrapper');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.gate_statuses.some((g: { blocker_code: string }) => g.blocker_code === 'same_video_false_winner_active_P0')).toBe(true);
    expect(manifest.public_output_unchanged).toBe(true);
    expect(manifest.user_experience_unchanged).toBe(true);
  });

  it('does not accept emitted artefacts as runtime evidence without satisfying L2 proof', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-wiring-'));
    await emitQAManifestForAnalysisRun({ run_id: 'run-ev', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-ev', 'manifest.json'), 'utf8'));
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('raw_report');
    expect(manifest.runtime_evidence_blocked_by_id).toContain('raw_report');
  });

  it('emitter failure is captured as warning and does not throw', async () => {
    const out = await emitQAManifestForAnalysisRun({ run_id: '../bad', internal_qa_emit: true });
    expect(out.written).toBe(false);
    expect(out.warning).toContain('internal_qa_manifest_emit_failed');
  });



  it('propagates sink warning when manifest write fails without throw', async () => {
    const out = await emitQAManifestForAnalysisRun({ run_id: 'run-warn', root_dir: '/dev/null', internal_qa_emit: true });
    expect(out.written).toBe(false);
    expect(out.warning).toBeTruthy();
  });

  it('env-based enabling remains explicit and off by default', () => {
    expect(resolveInternalQAEmitEnabled({ env: {} as NodeJS.ProcessEnv })).toBe(false);
    expect(resolveInternalQAEmitEnabled({ env: { V3_QA_ARTIFACTS_ENABLED: 'true' } as NodeJS.ProcessEnv })).toBe(true);
  });
});
