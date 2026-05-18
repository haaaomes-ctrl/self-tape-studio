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

  it('public_report_payload is required for pass even when render_payload matches', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-public-required-'));
    const out = await emitReportParityProof({ run_id: 'run-pr', analysis_run_id: 'run-pr', take_id: 'tpr', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, render_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] });
    const p = await readParity(root, 'run-pr', 'tpr');
    expect(out.parity_status).toBe('insufficient');
    expect(p.parity_status).toBe('insufficient');
    expect(p.level2_satisfaction).toBe('insufficient');
    expect(p.public_report_payload_available).toBe(false);
    expect(p.blocker_codes).toContain('parity_artefacts_missing');
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

  it('classifies blocked score/readiness leaks using blocked score path set', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-scoreblock-'));
    const cases: Array<[string, any, 'render_payload'|'public_report_payload', boolean]> = [
      ['overall_readiness', { overall_readiness: 88 }, 'public_report_payload', true],
      ['overall_readiness', { overall_readiness: 88 }, 'render_payload', true],
      ['report_data.overall_readiness', { report_data: { overall_readiness: 86 } }, 'public_report_payload', true],
      ['overall_score', { overall_score: 90 }, 'public_report_payload', true],
      ['overall_score_final', { overall_score_final: 89 }, 'public_report_payload', true],
      ['score_value', { score_value: 77 }, 'public_report_payload', true],
      ['category_scores', { category_scores: { acting: 90 } }, 'public_report_payload', true],
      ['report_data.scores', { report_data: { scores: { overall: 91 } } }, 'public_report_payload', true],
      ['report_data.scores.overall', { report_data: { scores: { overall: 91 } } }, 'public_report_payload', true],
      ['report_data.overall_score_model', { report_data: { overall_score_model: 90 } }, 'render_payload', true],
      ['report_data.score_summary.overall', { report_data: { score_summary: { overall: 90 } } }, 'render_payload', true],
      ['report_data.score_breakdown.category_scores', { report_data: { score_breakdown: { category_scores: { acting: 88 } } } }, 'public_report_payload', true],
      ['report_data.readiness_score', { report_data: { readiness_score: 84 } }, 'public_report_payload', true],
      ['report_data.scores[0].value', { report_data: { scores: [{ value: 91 }] } }, 'public_report_payload', true],
      ['comparison', { comparison: { winner: 't2' } }, 'public_report_payload', false],
      ['winner', { winner: 't2' }, 'public_report_payload', false],
      ['recommendation', { recommendation: 'choose take 2' }, 'public_report_payload', false],
    ];
    for (const [field, patch, surface, shouldBeScoreLeak] of cases) {
      const run = `run-${field.replace(/\W/g,'-')}-${surface}`;
      const input: any = { run_id: run, analysis_run_id: run, take_id: 'ts', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] };
      if (surface === 'render_payload') input.render_payload = { summary: 'ok', ...patch };
      else input.public_report_payload = { summary: 'ok', ...patch };
      await emitReportParityProof(input);
      const out = await readParity(root, run, 'ts');
      expect(out.parity_status).toBe('failed');
      expect(out.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && (m.field===field || String(m.field).startsWith(`${field}.`) || String(m.field).startsWith(`${field}[`)))).toBe(true);
      expect(out.blocked_score_fields_absent).toBe(!shouldBeScoreLeak);
      expect(out.public_scoring_status).toBe('blocked');
      expect(out.production_safe_status).toBe('blocked');
      expect(out.public_technique_authority_status).toBe('blocked');
      expect(out.level2_satisfaction).toBe('insufficient');
    }

    await emitReportParityProof({ run_id:'run-custom-private', analysis_run_id:'run-custom-private', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', internal_notes:'private' }, allowed_public_fields:['summary'], blocked_field_paths:['internal_notes'] });
    const customPrivate = await readParity(root, 'run-custom-private', 'ts');
    expect(customPrivate.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='internal_notes')).toBe(true);
    expect(customPrivate.forbidden_fields_absent).toBe(false);
    expect(customPrivate.blocked_internal_fields_absent).toBe(false);
    expect(customPrivate.blocked_score_fields_absent).toBe(true);
    expect(customPrivate.parity_status).toBe('failed');

    await emitReportParityProof({ run_id:'run-custom-score', analysis_run_id:'run-custom-score', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', custom_readiness_metric:73 }, allowed_public_fields:['summary'], blocked_field_paths:['custom_readiness_metric'], blocked_score_field_paths:['custom_readiness_metric'] });
    const customScore = await readParity(root, 'run-custom-score', 'ts');
    expect(customScore.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='custom_readiness_metric')).toBe(true);
    expect(customScore.blocked_score_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-custom-additive', analysis_run_id:'run-custom-additive', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', overall_score:99, internal_notes:'private' }, allowed_public_fields:['summary'], blocked_field_paths:['internal_notes'] });
    const customAdditive = await readParity(root, 'run-custom-additive', 'ts');
    expect(customAdditive.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='overall_score')).toBe(true);
    expect(customAdditive.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='internal_notes')).toBe(true);
    expect(customAdditive.blocked_score_fields_absent).toBe(false);


    await emitReportParityProof({ run_id:'run-allowed-cannot-override-score', analysis_run_id:'run-allowed-cannot-override-score', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', report_data:{ scores:{ overall:99 } } }, allowed_public_fields:['summary'] });
    const allowCantOverride = await readParity(root, 'run-allowed-cannot-override-score', 'ts');
    expect(allowCantOverride.parity_status).toBe('failed');
    expect(allowCantOverride.blocked_score_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-readiness-note-safe', analysis_run_id:'run-readiness-note-safe', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', readiness_note:'narrative only' }, allowed_public_fields:['summary'] });
    const readinessNoteSafe = await readParity(root, 'run-readiness-note-safe', 'ts');
    expect(readinessNoteSafe.parity_status).toBe('passed');

    await emitReportParityProof({ run_id:'run-tech-auth-public', analysis_run_id:'run-tech-auth-public', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', technique_authority:{ score: 1 } }, allowed_public_fields:['summary'] });
    const techAuthPublic = await readParity(root, 'run-tech-auth-public', 'ts');
    expect(techAuthPublic.parity_status).toBe('failed');
    expect(techAuthPublic.blocked_technique_authority_fields_absent).toBe(false);
    expect(techAuthPublic.public_technique_authority_status).toBe('blocked');

    await emitReportParityProof({ run_id:'run-tech-auth-render', analysis_run_id:'run-tech-auth-render', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, render_payload:{ summary:'ok', technique_authority: { leaked: true } }, allowed_public_fields:['summary'] });
    const techAuthRender = await readParity(root, 'run-tech-auth-render', 'ts');
    expect(techAuthRender.parity_status).toBe('failed');
    expect(techAuthRender.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.surface==='render_payload' && String(m.field).startsWith('technique_authority'))).toBe(true);
    expect(techAuthRender.blocked_technique_authority_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-tech-auth-report-data', analysis_run_id:'run-tech-auth-report-data', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', report_data: { technique_authority: { details: 'x' } } }, allowed_public_fields:['summary'] });
    const techAuthReportData = await readParity(root, 'run-tech-auth-report-data', 'ts');
    expect(techAuthReportData.parity_status).toBe('failed');
    expect(techAuthReportData.blocked_technique_authority_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-public-tech-auth', analysis_run_id:'run-public-tech-auth', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', public_technique_authority: { details: true } }, allowed_public_fields:['summary'] });
    const publicTechAuth = await readParity(root, 'run-public-tech-auth', 'ts');
    expect(publicTechAuth.parity_status).toBe('failed');
    expect(publicTechAuth.blocked_technique_authority_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-array-generic', analysis_run_id:'run-array-generic', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', items:[{ secret:'leak' }] }, allowed_public_fields:['summary'], blocked_field_paths:['items.secret'] });
    const arrayGeneric = await readParity(root, 'run-array-generic', 'ts');
    expect(arrayGeneric.parity_status).toBe('failed');
    expect(arrayGeneric.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && String(m.field).includes('items[0].secret'))).toBe(true);
    expect(arrayGeneric.blocked_score_fields_absent).toBe(true);

    await emitReportParityProof({ run_id:'run-array-container', analysis_run_id:'run-array-container', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', items:[{ nested:{ secret:'leak' } }] }, allowed_public_fields:['summary'], blocked_field_paths:['items'] });
    const arrayContainer = await readParity(root, 'run-array-container', 'ts');
    expect(arrayContainer.parity_status).toBe('failed');
    expect(arrayContainer.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && String(m.field).startsWith('items['))).toBe(true);

    await emitReportParityProof({ run_id:'run-render-array-leak', analysis_run_id:'run-render-array-leak', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, render_payload:{ summary:'ok', items:[{ secret:'leak' }] }, allowed_public_fields:['summary'], blocked_field_paths:['items.secret'] });
    const renderArrayLeak = await readParity(root, 'run-render-array-leak', 'ts');
    expect(renderArrayLeak.parity_status).toBe('failed');
    expect(renderArrayLeak.mismatches.some((m:any)=>m.surface==='render_payload' && String(m.field).includes('items[0].secret'))).toBe(true);

    await emitReportParityProof({ run_id:'run-config-nested-score-array', analysis_run_id:'run-config-nested-score-array', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', sections:[{ metrics:[{ score_value: 91 }] }] }, allowed_public_fields:['summary'], blocked_field_paths:['sections.metrics.score_value'], blocked_score_field_paths:['sections.metrics.score_value'] });
    const configNestedScoreArray = await readParity(root, 'run-config-nested-score-array', 'ts');
    expect(configNestedScoreArray.parity_status).toBe('failed');
    expect(configNestedScoreArray.blocked_score_fields_absent).toBe(false);

    const safeTakeRoot = await mkdtemp(path.join(os.tmpdir(), 's9-13c-safe-take-'));
    const safeTakeOut = await emitReportParityProof({ run_id:'run-safe-take', analysis_run_id:'run-safe-take', take_id:'safe-take-1', internal_qa_emit:true, root_dir: safeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(safeTakeOut.written).toBe(true);
    await expect(readFile(path.join(safeTakeRoot, 'run-safe-take', 'takes', 'take-safe-take-1', 'analysis-run-safe-take', 'parity', 'report_parity_result.json'), 'utf8')).resolves.toBeTruthy();

    const runScopedRoot = await mkdtemp(path.join(os.tmpdir(), 's9-13c-runscoped-2-'));
    const runScopedOut = await emitReportParityProof({ run_id:'run-no-take', analysis_run_id:'run-no-take', take_id:null, internal_qa_emit:true, root_dir: runScopedRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(runScopedOut.written).toBe(true);
    await expect(readFile(path.join(runScopedRoot, 'run-no-take', 'parity', 'report_parity_result.json'), 'utf8')).resolves.toBeTruthy();

    const unsafeTakeRoot = await mkdtemp(path.join(os.tmpdir(), 's9-13c-unsafe-take-'));
    const unsafeSlash = await emitReportParityProof({ run_id:'run-unsafe-slash', analysis_run_id:'run-unsafe-slash', take_id:'bad/take', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafeSlash.written).toBe(false);
    const unsafeBackslash = await emitReportParityProof({ run_id:'run-unsafe-backslash', analysis_run_id:'run-unsafe-backslash', take_id:'bad\\take', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafeBackslash.written).toBe(false);
    const unsafeEmpty = await emitReportParityProof({ run_id:'run-unsafe-empty', analysis_run_id:'run-unsafe-empty', take_id:'', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafeEmpty.written).toBe(false);

  });

});
