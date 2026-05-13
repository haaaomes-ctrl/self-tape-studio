import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitAnalysisInputArtefacts, emitQAManifestForAnalysisRun, emitRawReportArtefact, emitResolverOutputAndTruthStateMap } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 qa acceptance metrics', () => {
  it('emits qa/acceptance_metrics.json and marks manifest emitted without changing L2 acceptance', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s905-'));
    const run = 'run-s905'; const take = 'tk1';
    const input = await emitAnalysisInputArtefacts({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', brief_presence: 'supplied', material_presence: 'unknown', internal_qa_emit: true, root_dir: root });
    const resolver = await emitResolverOutputAndTruthStateMap({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', brief_presence: 'supplied', material_presence: 'unknown', internal_qa_emit: true, root_dir: root });
    await emitRawReportArtefact({ run_id: run, take_id: take, submission_id: 'sub1', source_stage: 'unit', source_module: 'test', report_data: { schema_version: 'v1-legacy', fix_first: '', priority_fixes: ['a'], strengths: ['Technically'], casting_headline: '', overall_score: 88 }, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: take, submission_id: 'sub1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report', ...input.emitted_artefact_ids, ...resolver.emitted_artefact_ids], legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [...input.emitted_artefact_ids, ...resolver.emitted_artefact_ids], defect_risk_ids: ['legacy_schema_snapshot', 'legacy_numeric_score_snapshot', 'legacy_report_used_as_v3_spine_proxy', 'empty_fix_first_with_priority_fixes', 'malformed_strength_entry', 'empty_casting_headline', 'v3_claim_fields_null', 'public_output_snapshot_missing'] });

    const base = path.join(root, run);
    const metrics = JSON.parse(await readFile(path.join(base, 'qa/acceptance_metrics.json'), 'utf8'));
    const manifest = JSON.parse(await readFile(path.join(base, 'manifest.json'), 'utf8'));
    expect(metrics.artefact_type).toBe('qa_acceptance_metrics');
    expect(metrics.internal_only).toBe(true);
    expect(metrics.required_artefact_counts.emitted).toBe(manifest.emitted_artifacts.length);
    expect(manifest.artefact_status_by_id.qa_acceptance_metrics).toBe('emitted');
    expect(manifest.emitted_artifacts).toContain('qa_acceptance_metrics');
    expect(manifest.missing_artifacts).not.toContain('qa_acceptance_metrics');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.acceptance_decision).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.gf01_rt15_status).toBe('blocked');
    expect(metrics.legacy_adapter_artefacts).toContain('raw_report');
    expect(metrics.output_quality_defects).toEqual(expect.arrayContaining(['legacy_schema_snapshot', 'legacy_numeric_score_snapshot', 'legacy_report_used_as_v3_spine_proxy', 'empty_fix_first_with_priority_fixes', 'malformed_strength_entry', 'empty_casting_headline', 'v3_claim_fields_null', 'public_output_snapshot_missing']));
    const txt = JSON.stringify(metrics).toLowerCase();
    for (const blocked of ['reconciler_secret', 'anon_session_secret', 'mux_token_secret', 'mux_webhook_secret', 'token_secret', 'webhook_secret', 'session_secret']) expect(txt).not.toContain(blocked);
  });
});
