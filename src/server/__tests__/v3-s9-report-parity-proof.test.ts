import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitQAManifestForAnalysisRun, emitReportParityProof } from '@/server/v3/qa-artifacts-wiring.server';

async function readParity(root: string, run: string, take: string) {
  return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'parity', 'report_parity_result.json'), 'utf8'));
}

describe('v3-s9 report parity proof', () => {
  it('A/B: detects value drift on both public_report_payload and render_payload surfaces', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-a-'));
    await emitReportParityProof({ run_id: 'run-a1', analysis_run_id: 'run-a1', take_id: 't1', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['summary'] });
    const p1 = await readParity(root, 'run-a1', 't1');
    expect(p1.parity_status).toBe('failed');
    expect(p1.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='summary' && m.surface==='public_report_payload')).toBe(true);

    await emitReportParityProof({ run_id: 'run-a2', analysis_run_id: 'run-a2', take_id: 't2', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, render_payload: { summary: 'B' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] });
    const p2 = await readParity(root, 'run-a2', 't2');
    expect(p2.parity_status).toBe('failed');
    expect(p2.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='summary' && m.surface==='render_payload')).toBe(true);
  });

  it('C/D/E: nested object, array and presence mismatches fail parity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-cde-'));
    await emitReportParityProof({ run_id: 'run-cde', analysis_run_id: 'run-cde', take_id: 't3', internal_qa_emit: true, root_dir: root, raw_report_data: { priority_fix: { title: 'A', detail: 'B' }, notes: ['a', 'b'], required_field: 'x' }, public_report_payload: { priority_fix: { title: 'A', detail: 'C' }, notes: ['b', 'a'] }, allowed_public_fields: ['priority_fix', 'notes', 'required_field'] });
    const p = await readParity(root, 'run-cde', 't3');
    expect(p.parity_status).toBe('failed');
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='priority_fix')).toBe(true);
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='notes')).toBe(true);
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='presence_mismatch' && m.field==='required_field')).toBe(true);
  });

  it('F/G: forbidden field leaks fail parity on both surfaces', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-fg-'));
    await emitReportParityProof({ run_id: 'run-fg', analysis_run_id: 'run-fg', take_id: 't4', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, render_payload: { summary: 'ok', winner: 'take-1' }, public_report_payload: { summary: 'ok', scores: { overall: 99 } }, allowed_public_fields: ['summary'], blocked_field_paths: ['winner', 'scores'] });
    const p = await readParity(root, 'run-fg', 't4');
    expect(p.checked_surfaces).toEqual(['render_payload', 'public_report_payload']);
    expect(p.parity_status).toBe('failed');
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.surface==='render_payload' && m.field==='winner')).toBe(true);
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.surface==='public_report_payload' && m.field==='scores')).toBe(true);
  });

  it('H/I: empty or missing allowed fields are insufficient', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-hi-'));
    await emitReportParityProof({ run_id: 'run-h', analysis_run_id: 'run-h', take_id: 't5', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: [] });
    const h = await readParity(root, 'run-h', 't5');
    expect(h.parity_status).toBe('insufficient');
    expect(h.level2_satisfaction).toBe('insufficient');
    expect(h.mismatches.some((m:any)=>m.mismatch_type==='allowed_public_fields_missing')).toBe(true);

    await emitReportParityProof({ run_id: 'run-i', analysis_run_id: 'run-i', take_id: 't6', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok' } });
    const i = await readParity(root, 'run-i', 't6');
    expect(i.parity_status).toBe('insufficient');
    expect(i.mismatches.some((m:any)=>m.mismatch_type==='allowed_public_fields_missing')).toBe(true);
  });

  it('J/L: clean surfaces pass; canonical metadata preserved', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-jl-'));
    await emitReportParityProof({ run_id: 'run-j', analysis_run_id: 'run-j', take_id: 't7', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, render_payload: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] });
    const p = await readParity(root, 'run-j', 't7');
    expect(p.parity_status).toBe('passed');
    expect(p.internal_only).toBe(true);
    expect(p.privacy_classification).toBe('internal_private');
    expect(p.schema_version).toBe('tapecoach_v3_report_parity_result_v1');
    expect(p.run_id).toBe('run-j');
    expect(p.analysis_run_id).toBe('run-j');
    expect(p.production_safe_status).toBe('blocked');
    expect(p.public_scoring_status).toBe('blocked');
    expect(p.public_technique_authority_status).toBe('blocked');
  });

  it('K: manifest + metrics align and parity blockers remain when parity fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-k-'));
    const out = await emitReportParityProof({ run_id: 'run-k', analysis_run_id: 'run-k', take_id: 't8', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['summary'] });
    await emitQAManifestForAnalysisRun({ run_id: 'run-k', analysis_run_id: 'run-k', take_id: 't8', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report', ...out.emitted_artefact_ids], artefact_source_classification_by_id: { parity_report: 'internal_report_parity_proof' }, artefact_level2_spine_satisfaction_by_id: { parity_report: false } });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-k', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-k', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });
});
