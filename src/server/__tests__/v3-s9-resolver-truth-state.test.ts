import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitAnalysisInputArtefacts, emitQAManifestForAnalysisRun, emitRawReportArtefact, emitResolverOutputAndTruthStateMap } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 resolver_output and truth_state_map', () => {
  it('emits resolver_output + TruthStateMap and manifest tracks emitted status', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s904-'));
    const run = 'take-s904'; const takeId = 'tk-s904';
    await emitAnalysisInputArtefacts({ run_id: run, analysis_run_id: run, submission_id: 'sub-s904', take_id: takeId, source_module: 'test', source_stage: 'unit', brief_presence: 'supplied', brief_presence_source: 'audition.extracted_brief_cached', material_presence: 'unknown', selected_level: 'advanced', mux_playback_id: 'pb1', mux_asset_or_upload_id_present: true, take_created_at: '2026-01-01T00:00:00.000Z', take_updated_at: '2026-01-01T00:01:00.000Z', take_index: null, take_index_source: 'unavailable', component_or_task_declaration: null, component_or_task_declaration_status: 'unknown', component_or_task_declaration_source: 'not_loaded', internal_qa_emit: true, root_dir: root });
    const resolver = await emitResolverOutputAndTruthStateMap({ run_id: run, analysis_run_id: run, submission_id: 'sub-s904', take_id: takeId, source_module: 'test', source_stage: 'unit', brief_presence: 'supplied', brief_presence_source: 'audition.extracted_brief_cached', material_presence: 'unknown', selected_level: 'advanced', mux_playback_id: 'pb1', mux_asset_or_upload_id_present: true, take_created_at: '2026-01-01T00:00:00.000Z', take_updated_at: '2026-01-01T00:01:00.000Z', take_index: null, take_index_source: 'unavailable', component_or_task_declaration: null, component_or_task_declaration_status: 'unknown', component_or_task_declaration_source: 'not_loaded', internal_qa_emit: true, root_dir: root });
    expect(resolver.emitted_artefact_ids.sort()).toEqual(['resolver_output', 'truth_state_map']);
    const base = path.join(root, run, 'takes', `take-${takeId}`, `analysis-${run}`, 'resolver');
    const resolverOutput = JSON.parse(await readFile(path.join(base, 'resolver_output.json'), 'utf8'));
    const truth = JSON.parse(await readFile(path.join(base, 'TruthStateMap.json'), 'utf8'));
    expect(resolverOutput.internal_only).toBe(true); expect(truth.internal_only).toBe(true);
    expect(resolverOutput.privacy_classification).toBeTruthy(); expect(truth.privacy_classification).toBeTruthy();
    expect(resolverOutput.legacy_adapter_present).toBe(true);
    expect(truth.public_authority_truths.public_scoring_status).toBe('blocked');
    expect(truth.component_truths.legacy_report_detected_components).toContain('not_v3_input_truth');
    const asText = `${JSON.stringify(resolverOutput)}${JSON.stringify(truth)}`.toLowerCase();
    for (const banned of ['reconciler_secret','anon_session_secret','mux_token_id','mux_token_secret','mux_webhook_secret','token_secret','webhook_secret','session_secret']) expect(asText).not.toContain(banned);

    await emitRawReportArtefact({ run_id: run, take_id: takeId, submission_id: 'sub-s904', source_stage: 'unit', source_module: 'test', report_data: { schema_version: 'v1-legacy', detected_components: ['song'] }, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: takeId, submission_id: 'sub-s904', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['analysis_input_record','analysis_submission','analysis_take','resolver_output','truth_state_map','raw_report'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false } });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.resolver_output).toBe('emitted');
    expect(manifest.artefact_status_by_id.truth_state_map).toBe('emitted');
    expect(manifest.missing_artifacts).not.toEqual(expect.arrayContaining(['resolver_output','truth_state_map']));
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(manifest.artefact_status_by_id.qa_acceptance_metrics).toBe('missing');
  });
});
