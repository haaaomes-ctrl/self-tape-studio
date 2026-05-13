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
      brief_present: true,
      material_present: false,
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
});
