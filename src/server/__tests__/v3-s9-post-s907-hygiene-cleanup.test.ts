import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitAnalysisInputArtefacts, emitQAManifestForAnalysisRun, emitResolverOutputAndTruthStateMap, emitTechniqueObservationTraceFirstPass } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 post s907 hygiene cleanup', () => {
  it('preserves S9-07 emitted-but-insufficient gate posture', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s907-cleanup-'));
    const run = 'take-s907';
    const take = 'tk-s907';
    await emitAnalysisInputArtefacts({ run_id: run, analysis_run_id: run, submission_id: 'sub', take_id: take, source_module: 'test', source_stage: 'unit', brief_presence: 'supplied', brief_presence_source: 'audition.brief', material_presence: 'unknown', internal_qa_emit: true, root_dir: root });
    await emitResolverOutputAndTruthStateMap({ run_id: run, analysis_run_id: run, submission_id: 'sub', take_id: take, source_module: 'test', source_stage: 'unit', brief_presence: 'supplied', brief_presence_source: 'audition.brief', material_presence: 'unknown', internal_qa_emit: true, root_dir: root });
    const technique = await emitTechniqueObservationTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub', take_id: take, source_module: 'test', source_stage: 'unit', internal_qa_emit: true, root_dir: root, raw_report_data: { report_data: { detected_components: ['clear storytelling intent'] } } });
    expect(technique.written).toBe(true);

    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: take, submission_id: 'sub', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['analysis_input_record', 'analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', ...(technique.emitted_artefact_ids ?? [])], artefact_source_classification_by_id: { technique_observation_trace: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { technique_observation_trace: false } });

    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.technique_observation_trace).toBe('emitted');
    expect(metrics.technique_observation_trace_status).toBe('emitted');
    expect(metrics.technique_observation_gate_status).toBe('insufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.gf01_rt15_status).toBe('not_applicable');
  });
});
