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

  
  it('J/K/L/M: undefined/function/symbol hashing is stable and does not throw', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-jklm-'));

    await expect(emitReportParityProof({ run_id: 'run-j1', analysis_run_id: 'run-j1', take_id: 't9', internal_qa_emit: true, root_dir: root, raw_report_data: { weird: undefined }, public_report_payload: { weird: undefined }, allowed_public_fields: ['weird'] })).resolves.toBeTruthy();
    const j = await readParity(root, 'run-j1', 't9');
    expect(j.parity_status).toBe('passed');

    await expect(emitReportParityProof({ run_id: 'run-k1', analysis_run_id: 'run-k1', take_id: 't10', internal_qa_emit: true, root_dir: root, raw_report_data: { weird: undefined }, public_report_payload: { weird: null }, allowed_public_fields: ['weird'] })).resolves.toBeTruthy();
    const k = await readParity(root, 'run-k1', 't10');
    expect(k.parity_status).toBe('failed');
    expect(k.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='weird')).toBe(true);

    await expect(emitReportParityProof({ run_id: 'run-l1', analysis_run_id: 'run-l1', take_id: 't11', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok', forbidden: undefined }, allowed_public_fields: ['summary'], blocked_field_paths: ['forbidden'] })).resolves.toBeTruthy();
    const l = await readParity(root, 'run-l1', 't11');
    expect(l.parity_status).toBe('failed');
    expect(l.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='forbidden')).toBe(true);

    const fn = function demoFn(){};
    await expect(emitReportParityProof({ run_id: 'run-m1', analysis_run_id: 'run-m1', take_id: 't12', internal_qa_emit: true, root_dir: root, raw_report_data: { f: fn, s: Symbol('x') }, public_report_payload: { f: fn, s: Symbol('x') }, allowed_public_fields: ['f', 's'] })).resolves.toBeTruthy();
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

  it('O/P/Q: manifest flow emits parity in file/log sinks when report_parity_input exists, and stays missing when absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-opq-'));
    const prevSink = process.env.QA_ARTIFACT_SINK;

    process.env.QA_ARTIFACT_SINK = 'file';
    await emitQAManifestForAnalysisRun({ run_id: 'run-o', analysis_run_id: 'run-o', take_id: 'to', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], report_parity_input: { raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] } });
    const manifestO = JSON.parse(await readFile(path.join(root, 'run-o', 'manifest.json'), 'utf8'));
    expect(manifestO.artefact_status_by_id.parity_report).toBe('emitted');

    process.env.QA_ARTIFACT_SINK = 'log';
    await emitQAManifestForAnalysisRun({ run_id: 'run-p', analysis_run_id: 'run-p', take_id: 'tp', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], report_parity_input: { raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['summary'] } });
    const manifestP = JSON.parse(await readFile(path.join(root, 'run-p', 'manifest.json'), 'utf8'));
    expect(manifestP.artefact_status_by_id.parity_report).toBe('emitted');

    await emitQAManifestForAnalysisRun({ run_id: 'run-q', analysis_run_id: 'run-q', take_id: 'tq', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'] });
    const manifestQ = JSON.parse(await readFile(path.join(root, 'run-q', 'manifest.json'), 'utf8'));
    expect(manifestQ.artefact_status_by_id.parity_report).toBe('missing');

    process.env.QA_ARTIFACT_SINK = prevSink;
  });

  it('B/D/E/F: emits run-scoped parity when take id is unavailable; handles unsafe identity without crash', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-runscoped-'));
    process.env.QA_ARTIFACT_SINK = 'file';
    await emitQAManifestForAnalysisRun({ run_id: 'run-rs', analysis_run_id: 'run-rs', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], report_parity_input: { raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] } });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-rs', 'manifest.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted');
    const parity = JSON.parse(await readFile(path.join(root, 'run-rs', 'parity', 'report_parity_result.json'), 'utf8'));
    expect(parity.parity_status).toBe('passed');

    const bad = await emitQAManifestForAnalysisRun({ run_id: '../bad', analysis_run_id: '../bad', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], report_parity_input: { raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] } } as any);
    expect(bad.written).toBe(false);
  });

  it('score-leak defaults A-I/J: block common score fields by default and preserve blocked gate statuses', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-scoreblock-'));
    const cases: Array<[string, any, 'render_payload'|'public_report_payload']> = [
      ['overall_score', { overall_score: 90 }, 'public_report_payload'],
      ['overall_score_final', { overall_score_final: 89 }, 'public_report_payload'],
      ['overall_readiness', { overall_readiness: 88 }, 'render_payload'],
      ['score_value', { score_value: 77 }, 'public_report_payload'],
      ['score_entries', { score_entries: [1,2] }, 'public_report_payload'],
      ['category_scores', { category_scores: { acting: 90 } }, 'public_report_payload'],
      ['report_data.overall_score', { report_data: { overall_score: 91 } }, 'public_report_payload'],
    ];
    for (const [field, patch, surface] of cases) {
      const run = `run-${field.replace(/\W/g,'-')}`;
      const input: any = { run_id: run, analysis_run_id: run, take_id: 'ts', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, allowed_public_fields: ['summary'] };
      if (surface === 'render_payload') input.render_payload = { summary: 'ok', ...patch };
      else input.public_report_payload = { summary: 'ok', ...patch };
      await emitReportParityProof(input);
      const out = await readParity(root, run, 'ts');
      expect(out.parity_status).toBe('failed');
      expect(out.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field===field)).toBe(true);
      expect(out.public_scoring_status).toBe('blocked');
      expect(out.production_safe_status).toBe('blocked');
      expect(out.public_technique_authority_status).toBe('blocked');
      expect(out.level2_satisfaction).toBe('insufficient');
    }

    await emitReportParityProof({ run_id:'run-allow-match', analysis_run_id:'run-allow-match', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', overall_score:99 }, allowed_public_fields:['summary'] });
    const allow = await readParity(root, 'run-allow-match', 'ts');
    expect(allow.parity_status).toBe('failed');

    await emitReportParityProof({ run_id:'run-custom', analysis_run_id:'run-custom', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', overall_score:99, custom_private:true }, allowed_public_fields:['summary'], blocked_field_paths:['custom_private'] });
    const custom = await readParity(root, 'run-custom', 'ts');
    expect(custom.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='overall_score')).toBe(true);
    expect(custom.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='custom_private')).toBe(true);
  });

});
