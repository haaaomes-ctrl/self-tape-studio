import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitQAManifestForAnalysisRun, emitReportParityProof } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3-s9 report parity proof', () => {
  it('A/D/E/I: emits report parity artefact and wires manifest/metrics with blocked public gates', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-a-'));
    const run = 'run-rp-a';
    const take = 't1';
    const out = await emitReportParityProof({ run_id: run, analysis_run_id: run, take_id: take, internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] });
    expect(out.written).toBe(true);
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: take, submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report', ...out.emitted_artefact_ids], artefact_source_classification_by_id: { parity_report: 'internal_report_parity_proof' }, artefact_level2_spine_satisfaction_by_id: { parity_report: true } });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('B/C/F/G/H: marks insufficient honestly and keeps parity blockers when comparison parity missing/required', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-b-'));
    const run = 'run-rp-b';
    const take = 't2';
    const out = await emitReportParityProof({ run_id: run, analysis_run_id: run, take_id: take, internal_qa_emit: true, root_dir: root, raw_report_data: { internal_qa: { hidden: 1 }, winner: 't1' }, blocked_field_paths: ['internal_qa', 'winner'] });
    expect(out.written).toBe(true);
    expect(out.parity_status).toBe('insufficient');
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: take, submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report', ...out.emitted_artefact_ids] });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
  });
});
