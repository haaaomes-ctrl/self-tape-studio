import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitAnalysisInputArtefacts, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 take input artifacts', () => {
  it('emits all three take-level input artefacts and updates manifest truthfully', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s903-'));
    const run = 'take-tk1';
    const takeId = 'tk1';

    const emit = await emitAnalysisInputArtefacts({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: takeId,
      compared_take_ids: [takeId],
      source_module: 'test',
      source_stage: 'unit',
      analysis_route: 'runProcessTake',
      route_or_model_marker: 'runProcessTake',
      audition_type: 'screen',
      selected_level: 'advanced',
      brief_presence: 'supplied',
      brief_presence_source: 'audition.brief',
      material_presence: 'unknown',
      mux_playback_id: 'pb1',
      mux_asset_or_upload_id_present: true,
      submission_created_at: '2026-01-01T00:00:00.000Z',
      submission_updated_at: '2026-01-02T00:00:00.000Z',
      take_created_at: '2026-01-03T00:00:00.000Z',
      take_updated_at: '2026-01-04T00:00:00.000Z',
      take_index: 1,
      internal_qa_emit: true,
      root_dir: root,
    });
    expect(emit.emitted_artefact_ids.sort()).toEqual(['analysis_input_record', 'analysis_submission', 'analysis_take']);

    const base = path.join(root, run, 'takes', `take-${takeId}`, `analysis-${run}`, 'inputs');
    const inputRecord = JSON.parse(await readFile(path.join(base, 'input_record.json'), 'utf8'));
    const submission = JSON.parse(await readFile(path.join(base, 'submission.json'), 'utf8'));
    const take = JSON.parse(await readFile(path.join(base, 'take.json'), 'utf8'));

    for (const payload of [inputRecord, submission, take]) {
      expect(payload.internal_only).toBe(true);
      expect(payload.privacy_classification).toBeTruthy();
      expect(payload.run_id).toBe(run);
      expect(payload.analysis_run_id).toBe(run);
      expect(payload.submission_id).toBe('sub1');
      expect(payload.take_id).toBe(takeId);
      expect(payload.generated_at).toBeTruthy();
      expect(payload.source_module).toBe('test');
      expect(payload.source_stage).toBe('unit');
      const txt = JSON.stringify(payload).toLowerCase();
      expect(txt).not.toContain('token_secret');
      expect(txt).not.toContain('webhook_secret');
      expect(txt).not.toContain('session_secret');
    }

    expect(take.stable_take_identity).toEqual({ take_id: takeId, analysis_run_id: run });
    expect(take.take_index_source).toBe('loaded_take_index');

    await emitRawReportArtefact({ run_id: run, take_id: takeId, submission_id: 'sub1', source_stage: 'unit', source_module: 'test', report_data: { schema_version: 'v1-legacy' }, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: takeId, submission_id: 'sub1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report', ...emit.emitted_artefact_ids], artefact_source_classification_by_id: { raw_report: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false } });

    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.analysis_input_record).toBe('emitted');
    expect(manifest.artefact_status_by_id.analysis_submission).toBe('emitted');
    expect(manifest.artefact_status_by_id.analysis_take).toBe('emitted');
    expect(manifest.emitted_artifacts).toEqual(expect.arrayContaining(['analysis_input_record', 'analysis_submission', 'analysis_take']));
    expect(manifest.missing_artifacts).not.toEqual(expect.arrayContaining(['analysis_input_record', 'analysis_submission', 'analysis_take']));
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(manifest.artefact_status_by_id.qa_acceptance_metrics).toBe('missing');
    expect(manifest.artefact_source_classification_by_id.raw_report).toBe('legacy_adapter');
  });

  it('uses loaded audition-shape truth and keeps not-loaded fields unknown/unavailable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s903-loaded-'));
    const audition = {
      id: 'sub-loaded',
      brief: 'Play urgency and stakes.',
      brief_source: 'user',
      mode: 'brief',
      title: 'Loaded shape',
      audition_level: 'intermediate',
      extracted_brief: '',
    };

    const emitted = await emitAnalysisInputArtefacts({
      run_id: 'take-loaded',
      analysis_run_id: 'take-loaded',
      submission_id: audition.id,
      take_id: 'tk-loaded',
      compared_take_ids: ['tk-loaded'],
      source_module: 'process-take.server',
      source_stage: 'process_take_success',
      analysis_route: 'runProcessTake',
      route_or_model_marker: 'runProcessTake',
      audition_type: null,
      selected_level: audition.audition_level,
      brief_presence: ((audition.brief && audition.brief.trim().length > 0) || (audition.extracted_brief && audition.extracted_brief.trim().length > 0)) ? 'supplied' : 'absent',
      brief_presence_source: 'audition.brief',
      material_presence: 'unknown',
      mux_playback_id: 'pb-x',
      mux_asset_or_upload_id_present: true,
      submission_created_at: null,
      submission_updated_at: null,
      take_created_at: null,
      take_updated_at: null,
      take_index: null,
      take_index_source: 'unavailable',
      unavailable_fields: ['audition_type', 'material_presence_source', 'submission_created_at', 'submission_updated_at', 'take_created_at', 'take_updated_at', 'take_index', 'component_or_task_declaration'],
      internal_qa_emit: true,
      root_dir: root,
    });
    expect(emitted.emitted_artefact_ids.sort()).toEqual(['analysis_input_record', 'analysis_submission', 'analysis_take']);

    const base = path.join(root, 'take-loaded', 'takes', 'take-tk-loaded', 'analysis-take-loaded', 'inputs');
    const inputRecord = JSON.parse(await readFile(path.join(base, 'input_record.json'), 'utf8'));
    const submission = JSON.parse(await readFile(path.join(base, 'submission.json'), 'utf8'));
    expect(inputRecord.audition_type).toBeNull();
    expect(inputRecord.brief_presence).toBe('supplied');
    expect(inputRecord.material_presence).toBe('unknown');
    expect(submission.selected_level).toBe('intermediate');
    expect(submission.submission_created_at).toBeNull();
    expect(submission.submission_updated_at).toBeNull();
    expect(submission.component_or_task_declaration).toBeNull();
    expect(submission.component_or_task_declaration_status).toBe('unknown');
    expect(submission.component_or_task_declaration_source).toBe('not_loaded');
    const take = JSON.parse(await readFile(path.join(base, 'take.json'), 'utf8'));
    expect(take.take_index).toBeNull();
    expect(take.take_index_source).toBe('unavailable');
    expect(take.unavailable_fields).toEqual(expect.arrayContaining(['take_index', 'take_created_at', 'take_updated_at']));
    expect(inputRecord.unavailable_fields).toEqual(expect.arrayContaining(['audition_type', 'material_presence_source']));
    expect(submission.unavailable_fields).toEqual(expect.arrayContaining(['submission_created_at', 'submission_updated_at']));
  });

  it('treats structured and json-string extracted brief cache as supplied and empty cache as absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s903-briefcache-'));
    const baseInput = {
      run_id: 'r1',
      analysis_run_id: 'r1',
      submission_id: 's1',
      take_id: 't1',
      source_module: 'process-take.server',
      source_stage: 'process_take_success',
      material_presence: 'unknown' as const,
      internal_qa_emit: true,
      root_dir: root,
    };
    await emitAnalysisInputArtefacts({ ...baseInput, brief_presence: 'supplied', brief_presence_source: 'audition.extracted_brief_cached', unavailable_fields: [] });
    const one = JSON.parse(await readFile(path.join(root, 'r1', 'takes', 'take-t1', 'analysis-r1', 'inputs', 'input_record.json'), 'utf8'));
    expect(one.brief_presence).toBe('supplied');
    expect(one.brief_presence_source).toBe('audition.extracted_brief_cached');
    await emitAnalysisInputArtefacts({ ...baseInput, run_id: 'r2', analysis_run_id: 'r2', take_id: 't2', brief_presence: 'supplied', brief_presence_source: 'audition.extracted_brief_cached', unavailable_fields: [] });
    const two = JSON.parse(await readFile(path.join(root, 'r2', 'takes', 'take-t2', 'analysis-r2', 'inputs', 'input_record.json'), 'utf8'));
    expect(two.brief_presence).toBe('supplied');
    await emitAnalysisInputArtefacts({ ...baseInput, run_id: 'r3', analysis_run_id: 'r3', take_id: 't3', brief_presence: 'absent', brief_presence_source: 'none_loaded', unavailable_fields: [] });
    const three = JSON.parse(await readFile(path.join(root, 'r3', 'takes', 'take-t3', 'analysis-r3', 'inputs', 'input_record.json'), 'utf8'));
    expect(three.brief_presence).toBe('absent');
  });

  it('populates take timestamps when loaded and omits unavailable timestamp flags', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s903-ts-'));
    await emitAnalysisInputArtefacts({
      run_id: 'take-ts',
      analysis_run_id: 'take-ts',
      submission_id: 'sub-ts',
      take_id: 'tk-ts',
      source_module: 'process-take.server',
      source_stage: 'process_take_success',
      brief_presence: 'supplied',
      material_presence: 'unknown',
      take_created_at: '2026-03-01T10:00:00.000Z',
      take_updated_at: '2026-03-01T10:05:00.000Z',
      take_index: null,
      take_index_source: 'unavailable',
      unavailable_fields: ['take_index'],
      internal_qa_emit: true,
      root_dir: root,
    });
    const take = JSON.parse(await readFile(path.join(root, 'take-ts', 'takes', 'take-tk-ts', 'analysis-take-ts', 'inputs', 'take.json'), 'utf8'));
    expect(take.take_created_at).toBe('2026-03-01T10:00:00.000Z');
    expect(take.take_updated_at).toBe('2026-03-01T10:05:00.000Z');
    expect(take.unavailable_fields).not.toContain('take_created_at');
    expect(take.unavailable_fields).not.toContain('take_updated_at');
    expect(take.stable_take_identity).toEqual({ take_id: 'tk-ts', analysis_run_id: 'take-ts' });
  });
});
