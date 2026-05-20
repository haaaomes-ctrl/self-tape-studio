import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitAnalysisInputArtefacts, emitQAManifestForAnalysisRun, emitRawReportArtefact, emitResolverOutputAndTruthStateMap } from '@/server/v3/qa-artifacts-wiring.server';

async function emitAndRead(input: Record<string, unknown>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s904-p2-'));
  const run = 'take-s904'; const takeId = 'tk-s904';
  await emitAnalysisInputArtefacts({ run_id: run, analysis_run_id: run, submission_id: 'sub-s904', take_id: takeId, source_module: 'test', source_stage: 'unit', selected_level: 'advanced', internal_qa_emit: true, root_dir: root, ...input });
  await emitResolverOutputAndTruthStateMap({ run_id: run, analysis_run_id: run, submission_id: 'sub-s904', take_id: takeId, source_module: 'test', source_stage: 'unit', selected_level: 'advanced', internal_qa_emit: true, root_dir: root, ...input });
  const base = path.join(root, run, 'takes', `take-${takeId}`, `analysis-${run}`, 'resolver');
  return { root, run, takeId, resolverOutput: JSON.parse(await readFile(path.join(base, 'resolver_output.json'), 'utf8')), truth: JSON.parse(await readFile(path.join(base, 'TruthStateMap.json'), 'utf8')) };
}

describe('v3 s9 resolver_output presence truthfulness', () => {
  it('brief_presence unknown is never marked known', async () => {
    const { resolverOutput, truth } = await emitAndRead({ brief_presence: 'unknown', brief_presence_source: 'unavailable', material_presence: 'unknown', material_presence_source: 'not_loaded' });
    expect(resolverOutput.brief_presence).toEqual({ value: 'unknown', source: 'unavailable', status: 'unknown' });
    expect(truth.known_truths.brief_presence).toBeUndefined();
  });

  it('omitted material_presence defaults unknown and is never known', async () => {
    const { resolverOutput, truth } = await emitAndRead({ brief_presence: 'supplied', brief_presence_source: 'audition.extracted_brief_cached' });
    expect(resolverOutput.material_presence.value).toBe('unknown');
    expect(['unavailable', 'not_loaded']).toContain(resolverOutput.material_presence.source);
    expect(['unknown', 'unavailable']).toContain(resolverOutput.material_presence.status);
    expect(resolverOutput.material_presence.status).not.toBe('known');
    expect(truth.known_truths.material_presence).toBeUndefined();
    expect(truth.unavailable_truths.material_presence).toBe('unknown');
  });

  it('known supplied material is known and not unavailable', async () => {
    const { resolverOutput, truth } = await emitAndRead({ material_presence: 'supplied', material_presence_source: 'loaded_runtime_field' });
    expect(resolverOutput.material_presence.status).toBe('known');
    expect(truth.known_truths.material_presence).toBe('supplied');
    expect('material_presence' in truth.unavailable_truths).toBe(false);
  });

  it('known absent material is known and not unavailable', async () => {
    const { resolverOutput, truth } = await emitAndRead({ material_presence: 'absent', material_presence_source: 'loaded_runtime_field' });
    expect(resolverOutput.material_presence.status).toBe('known');
    expect(truth.known_truths.material_presence).toBe('absent');
    expect('material_presence' in truth.unavailable_truths).toBe(false);
  });

  it('material_presence unknown/not_loaded is not known and stays unavailable bucket', async () => {
    const { resolverOutput, truth } = await emitAndRead({ brief_presence: 'supplied', brief_presence_source: 'audition.brief', material_presence: 'unknown', material_presence_source: 'not_loaded' });
    expect(resolverOutput.material_presence.status).not.toBe('known');
    expect(truth.unavailable_truths.material_presence).toBe('unknown');
  });

  it('brief supplied with loaded source is known', async () => {
    const { resolverOutput, truth } = await emitAndRead({ brief_presence: 'supplied', brief_presence_source: 'audition.extracted_brief_cached' });
    expect(resolverOutput.brief_presence.status).toBe('known');
    expect(truth.known_truths.brief_presence).toBe('supplied');
  });

  it('brief absent is only known with loaded-empty source', async () => {
    const known = await emitAndRead({ brief_presence: 'absent', brief_presence_source: 'audition.brief+audition.extracted_brief_cached_empty' });
    expect(known.resolverOutput.brief_presence.status).toBe('known');
    const unknown = await emitAndRead({ brief_presence: 'absent', brief_presence_source: 'unavailable' });
    expect(unknown.resolverOutput.brief_presence.status).not.toBe('known');
  });

  it('preserves manifest/gate/raw_report safeguards and secret redaction', async () => {
    const { root, run, takeId, resolverOutput, truth } = await emitAndRead({ brief_presence: 'supplied', brief_presence_source: 'audition.extracted_brief_cached', material_presence: 'unknown', material_presence_source: 'not_loaded' });
    await emitRawReportArtefact({ run_id: run, take_id: takeId, submission_id: 'sub-s904', source_stage: 'unit', source_module: 'test', report_data: { schema_version: 'v1-legacy' }, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: takeId, submission_id: 'sub-s904', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['analysis_input_record','analysis_submission','analysis_take','resolver_output','truth_state_map','raw_report'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false } });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.resolver_output).toBe('emitted');
    expect(manifest.artefact_status_by_id.truth_state_map).toBe('emitted');
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    const txt = `${JSON.stringify(resolverOutput)}${JSON.stringify(truth)}`.toLowerCase();
    for (const banned of ['reconciler_secret','anon_session_secret','mux_token_id','mux_token_secret','mux_webhook_secret','token_secret','webhook_secret','session_secret']) expect(txt).not.toContain(banned);
  });

  it('truth buckets are mutually exclusive for relevant keys', async () => {
    const { truth } = await emitAndRead({ brief_presence: 'unknown', brief_presence_source: 'unavailable', material_presence: 'unknown', material_presence_source: 'not_loaded' });
    const buckets = [truth.known_truths ?? {}, truth.inferred_truths ?? {}, truth.unavailable_truths ?? {}, truth.unsafe_or_blocked_truths ?? {}];
    const relevantKeys = ['material_presence', 'brief_presence', 'component_or_task_declaration', 'take_index'];
    for (const key of relevantKeys) {
      const count = buckets.reduce((acc, b) => acc + (Object.prototype.hasOwnProperty.call(b, key) ? 1 : 0), 0);
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  it('declares resolver-stage snapshot scope and final-status sources', async () => {
    const { truth } = await emitAndRead({ brief_presence: 'supplied', brief_presence_source: 'audition.brief' });
    expect(truth.truth_state_scope).toBe('resolver_stage_snapshot');
    expect(truth.final_artefact_status_source).toBe('manifest.json');
    expect(truth.final_qa_acceptance_source).toBe('qa/acceptance_metrics.json');
    expect(truth.not_final_artefact_emission_state).toBe(true);
  });

  it('marks GF-01/RT-15 not applicable for ordinary single-take resolver snapshots', async () => {
    const { resolverOutput, truth } = await emitAndRead({
      compared_take_ids: ['tk-s904'],
      comparison_run_id: null,
    });
    expect(resolverOutput.blocker_codes).not.toContain('gf01_rt15_blocked_no_comparison_runtime_evidence');
    expect(truth.unsafe_or_blocked_truths.gf01_rt15_status).toBe('not_applicable');
    expect(truth.unsafe_or_blocked_truths.same_video_comparison_status).toBe('not_executed_single_take');
    expect(truth.comparison_truths.status).toBe('not_applicable_single_take');
    expect(truth.comparison_truths.comparison_run_executed).toBe(false);
  });

  it('keeps GF-01/RT-15 blocked when comparison runtime is invoked', async () => {
    const { resolverOutput, truth } = await emitAndRead({
      comparison_run_id: 'cmp-1',
      compared_take_ids: ['tk-s904', 'tk-s904-b'],
    });
    expect(resolverOutput.blocker_codes).toContain('gf01_rt15_blocked_no_comparison_runtime_evidence');
    expect(truth.unsafe_or_blocked_truths.gf01_rt15_status).toBe('blocked');
    expect(truth.comparison_truths.status).toBe('blocked_pending_comparison_evidence');
    expect(truth.comparison_truths.comparison_run_executed).toBe(true);
  });
});
