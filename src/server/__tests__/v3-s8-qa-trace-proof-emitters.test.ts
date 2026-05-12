import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitModelRunTraceArtefact, emitNoExportProofBundle, emitTraceArtefact, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring';

describe('v3 s8-24 trace/parity/no-export emitters', () => {
  it('model run trace writes with supplied data', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-trace-'));
    await emitModelRunTraceArtefact({ run_id: 'm1', source_module: 'test', model_or_route: 'route-a', take_ids: ['t1'], internal_qa_emit: true, root_dir: root });
    const body = JSON.parse(await readFile(path.join(root, 'm1', 'traces', 'ModelRunTrace.json'), 'utf8'));
    expect(body.artefact_type).toBe('ModelRunTrace');
    expect(body.data.model_or_route).toBe('route-a');
  });

  it('validator trace writes supplied validator rows', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-trace-'));
    await emitTraceArtefact({ run_id: 'v1', relative_path: 'traces/validator_trace.json', artefact_type: 'validator_trace', source_module: 'test', internal_qa_emit: true, root_dir: root, data: [{ validator_id: 'public_scoring_blocked', action: 'block_report' }] });
    const body = JSON.parse(await readFile(path.join(root, 'v1', 'traces', 'validator_trace.json'), 'utf8'));
    expect(body.status).toBe('emitted');
  });

  it('uk/redaction/leakage can be deferred without pass claims', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-trace-'));
    await emitTraceArtefact({ run_id: 'u1', relative_path: 'traces/UKEnglishGateResult.json', artefact_type: 'UKEnglishGateResult', source_module: 'test', internal_qa_emit: true, root_dir: root, status: 'deferred', blocker_codes: ['UKEnglishGateResult_missing'] });
    const body = JSON.parse(await readFile(path.join(root, 'u1', 'traces', 'UKEnglishGateResult.json'), 'utf8'));
    expect(body.status).toBe('deferred');
  });

  it('no-export proof remains incomplete unless all lanes exist', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-trace-'));
    const out = await emitNoExportProofBundle({ run_id: 'n1', source_module: 'test', source_proof: { ok: true }, internal_qa_emit: true, root_dir: root });
    expect(out.complete).toBe(false);
    const proof = JSON.parse(await readFile(path.join(root, 'n1', 'export_or_no_export', 'no_export_proof.json'), 'utf8'));
    expect(proof.status).toBe('missing');
  });

  it('manifest remains partial and keeps no-export blocker when incomplete', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-trace-'));
    await emitQAManifestForAnalysisRun({ run_id: 'mm', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const manifest = JSON.parse(await readFile(path.join(root, 'mm', 'manifest.json'), 'utf8'));
    expect(manifest.level2_bundle_status).toBe('partial');
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.blocker_codes).toContain('no_export_proof_missing');
  });
});
