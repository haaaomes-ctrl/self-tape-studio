import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitQAManifestForAnalysisRun, emitReportParityProof } from '@/server/v3/qa-artifacts-wiring.server';

async function readParity(root: string, run: string, take: string) {
  return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'parity', 'report_parity_result.json'), 'utf8'));
}

describe('v3-s9 report parity proof', () => {
  it('A: allowed field value drift fails parity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-a-'));
    const run = 'run-rp-a';
    const take = 't1';
    await emitReportParityProof({ run_id: run, analysis_run_id: run, take_id: take, internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['summary'] });
    const parity = await readParity(root, run, take);
    expect(parity.parity_status).toBe('failed');
    expect(parity.mismatches.some((m: any) => m.mismatch_type === 'value_mismatch' && m.field === 'summary')).toBe(true);
  });

  it('B/C/D: nested object, array, and presence mismatches are detected', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-b-'));
    const run = 'run-rp-b';
    const take = 't2';
    await emitReportParityProof({ run_id: run, analysis_run_id: run, take_id: take, internal_qa_emit: true, root_dir: root, raw_report_data: { priority_fix: { title: 'A', detail: 'B' }, notes: ['a', 'b'], missing_on_public: 'x' }, public_report_payload: { priority_fix: { title: 'A', detail: 'C' }, notes: ['b', 'a'] }, allowed_public_fields: ['priority_fix', 'notes', 'missing_on_public'] });
    const parity = await readParity(root, run, take);
    expect(parity.parity_status).toBe('failed');
    expect(parity.mismatches.some((m: any) => m.mismatch_type === 'value_mismatch' && m.field === 'priority_fix')).toBe(true);
    expect(parity.mismatches.some((m: any) => m.mismatch_type === 'value_mismatch' && m.field === 'notes')).toBe(true);
    expect(parity.mismatches.some((m: any) => m.mismatch_type === 'presence_mismatch' && m.field === 'missing_on_public')).toBe(true);
  });

  it('E/F: forbidden field leaks on either surface fail parity and identify surface', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-ef-'));
    const run = 'run-rp-ef';
    const take = 't3';
    await emitReportParityProof({ run_id: run, analysis_run_id: run, take_id: take, internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, render_payload: { summary: 'ok', winner: 'take-1' }, public_report_payload: { summary: 'ok', scores: { overall: 99 } }, allowed_public_fields: ['summary'], blocked_field_paths: ['winner', 'scores'] });
    const parity = await readParity(root, run, take);
    expect(parity.checked_surfaces).toEqual(['render_payload', 'public_report_payload']);
    expect(parity.parity_status).toBe('failed');
    expect(parity.mismatches.some((m: any) => m.mismatch_type === 'forbidden_field_present' && m.surface === 'render_payload' && m.field === 'winner')).toBe(true);
    expect(parity.mismatches.some((m: any) => m.mismatch_type === 'forbidden_field_present' && m.surface === 'public_report_payload' && m.field === 'scores')).toBe(true);
  });

  it('G/H/J: clean match passes, missing surfaces insufficient, canonical metadata enforced', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-ghj-'));
    const runPass = 'run-rp-pass';
    const takePass = 't4';
    await emitReportParityProof({ run_id: runPass, analysis_run_id: runPass, take_id: takePass, internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, render_payload: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] });
    const pass = await readParity(root, runPass, takePass);
    expect(pass.parity_status).toBe('passed');
    expect(pass.internal_only).toBe(true);
    expect(pass.privacy_classification).toBe('internal_private');
    expect(pass.public_scoring_status).toBe('blocked');
    expect(pass.public_technique_authority_status).toBe('blocked');
    expect(pass.production_safe_status).toBe('blocked');

    const runIns = 'run-rp-ins';
    const takeIns = 't5';
    await emitReportParityProof({ run_id: runIns, analysis_run_id: runIns, take_id: takeIns, internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, allowed_public_fields: ['summary'] });
    const ins = await readParity(root, runIns, takeIns);
    expect(ins.parity_status).toBe('insufficient');
  });

  it('I: manifest and metrics align; parity blockers remain; public gates blocked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-i-'));
    const run = 'run-rp-i';
    const take = 't6';
    const out = await emitReportParityProof({ run_id: run, analysis_run_id: run, take_id: take, internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['summary'] });
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: take, submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report', ...out.emitted_artefact_ids], artefact_source_classification_by_id: { parity_report: 'internal_report_parity_proof' }, artefact_level2_spine_satisfaction_by_id: { parity_report: false } });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });
});
