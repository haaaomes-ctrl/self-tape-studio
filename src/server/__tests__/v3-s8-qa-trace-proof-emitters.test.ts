import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitNoExportProofBundle, emitQAManifestForAnalysisRun, emitTraceArtefact } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s8 trace + no-export proof emitters', () => {
  it('gate_trace has distinct blocker from validator_trace', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-trace-'));
    const trace = await emitTraceArtefact({ run_id: 'run-g1', artefact_id: 'validator_trace', relative_path: 'traces/validator_trace.json', trace_data: { ok: true }, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: 'run-g1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: [trace.artefact_id] });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-g1', 'manifest.json'), 'utf8'));
    expect(manifest.blocker_codes).toContain('gate_trace_missing');
    expect(manifest.blocker_codes).not.toContain('validator_trace_missing');
  });

  it('no_export_proof is incomplete unless four proofs are emitted', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-proof-'));
    const partial = await emitNoExportProofBundle({ run_id: 'run-p1', root_dir: root, internal_qa_emit: true, proofs: { no_export_source_proof: { ok: true } } });
    expect(partial.emitted_artefact_ids).not.toContain('no_export_proof');
  });
});
