import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

async function readManifest(root:string, run:string){ return JSON.parse(await readFile(path.join(root, run, 'manifest.json'),'utf8')); }
async function readMetrics(root:string, run:string){ return JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'),'utf8')); }
async function readParity(root:string, run:string,take='ta'){ return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'parity', 'comparison_parity.json'),'utf8')); }

const evidenceIds = ['comparison_raw','comparison_report_internal','same_video_repeatability_trace','comparison_suppression_trace','route_variance_trace'] as const;

async function emitCase(root:string, run:string, opts:{emitted?:string[]; compared?:string[]; comparisonRunId?:string|null; payloads?:Record<string, unknown>}){
  await emitQAManifestForAnalysisRun({
    run_id:run, analysis_run_id:run, take_id:'ta', root_dir:root, internal_qa_emit:true,
    comparison_run_id: opts.comparisonRunId ?? 'cmp-x',
    compared_take_ids: opts.compared ?? ['ta','tb'],
    emitted_artefact_ids: ['raw_report', ...(opts.emitted ?? [...evidenceIds])],
    ...(opts.payloads === undefined ? {} : { comparison_parity_input: { comparison_payloads: opts.payloads } }),
  });
  const manifest = await readManifest(root,run);
  const metrics = await readMetrics(root,run);
  let parity: any = null;
  if (manifest.artefact_status_by_id?.parity_comparison !== 'missing' && manifest.artefact_status_by_id?.parity_comparison !== 'not_applicable') {
    parity = await readParity(root,run,'ta');
  }
  return { manifest, metrics, parity };
}

describe('v3-s9 comparison parity proof', () => {
  it('A ordinary single-take comparison parity not required', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-a-'));
    await emitQAManifestForAnalysisRun({ run_id:'run-a', analysis_run_id:'run-a', take_id:'ta', root_dir:root, internal_qa_emit:true, compared_take_ids:['ta'], comparison_run_id:null, emitted_artefact_ids:['raw_report'] });
    const manifest = await readManifest(root,'run-a');
    expect(manifest.comparison_run_id).toBeNull();
    expect(manifest.compared_take_ids).toEqual(['ta']);
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('not_applicable');
    const parityMissingInputs = ['parity_report','parity_comparison'].filter((id:string)=>manifest.missing_artifacts.includes(id));
    expect(parityMissingInputs).toEqual(['parity_report']);
  });

  it('B/T/U complete safe evidence passes; public gates remain blocked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-b-'));
    const { manifest, parity } = await emitCase(root,'run-b',{ payloads: { public_comparison_payload: { summary: 'safe' } } });
    expect(parity.parity_status).toBe('passed');
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.parity_comparison).toBe(true);
    expect(parity.production_safe_status).toBe('blocked');
    expect(parity.public_scoring_status).toBe('blocked');
    expect(parity.public_technique_authority_status).toBe('blocked');
    expect(parity.public_output_unchanged).toBe(true);
  });

  it('C-G missing each required evidence emits insufficient proof and keeps parity blocker', async () => {
    for (const missing of evidenceIds){
      const root = await mkdtemp(path.join(os.tmpdir(),`s9-13d-m-${missing}-`));
      const emitted = evidenceIds.filter((x)=>x!==missing);
      const { manifest, metrics, parity } = await emitCase(root,`run-${missing}`,{ emitted:[...emitted] });
      expect(parity.parity_status).toBe('insufficient');
      expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
      expect(parity[`${missing}_available` as keyof typeof parity]).toBe(false);
      expect(manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_comparison')?.blocker_code).toBe('parity_artefacts_missing');
      expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
      expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
    }
  });

  it('H internal winner/recommendation-like keys do not fail when no public leakage', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-h-'));
    const { parity } = await emitCase(root,'run-h',{ payloads: { public_comparison_payload: { note: 'safe' }, comparison_result_summary: { winner: 'internal' }, internal_recommendation_note: 'internal', selected_take_id_internal_only: 'ta' } });
    expect(parity.parity_status).toBe('passed');
    expect(parity.forbidden_public_comparison_fields_absent).toBe(true);
  });

  it('I/J/K/L/M/N failed-risk states are emitted_blocked and written', async () => {
    const cases: Array<[string,Record<string,unknown>]> = [
      ['winner',{ public_comparison_payload: { winner:'take-a' } }],
      ['recommendation',{ public_output: { recommendation:'take-a' } }],
      ['forced',{ forced_winner_risk:true }],
      ['false',{ false_winner_risk:true }],
      ['route',{ route_variance_risk:true }],
      ['same-video',{ same_video_unresolved_risk:true }],
    ];
    for (const [suffix,payloads] of cases){
      const root = await mkdtemp(path.join(os.tmpdir(),`s9-13d-f-${suffix}-`));
      const { manifest, metrics, parity } = await emitCase(root,`run-f-${suffix}`,{ payloads });
      expect(['failed','insufficient']).toContain(parity.parity_status);
      expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
      expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
      expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
      expect(parity.mismatch_count).toBeGreaterThan(0);
    }
  });

  it('O insufficient parity can be physically written and non-satisfying', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-o-'));
    const { manifest, parity } = await emitCase(root,'run-o',{ payloads: { route_variance_mitigation_status:'unresolved_blocked' } });
    expect(parity.parity_status).toBe('insufficient');
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
  });

  it('P manifest and metrics blocker code align for pass and non-pass', async () => {
    const rootPass = await mkdtemp(path.join(os.tmpdir(),'s9-13d-p1-'));
    const pass = await emitCase(rootPass,'run-p-pass',{ payloads:{ public_comparison_payload: { note: 'safe' } } });
    expect(pass.manifest.blocker_codes.includes('parity_artefacts_missing')).toBe(pass.metrics.blocker_codes.includes('parity_artefacts_missing'));

    const rootFail = await mkdtemp(path.join(os.tmpdir(),'s9-13d-p2-'));
    const fail = await emitCase(rootFail,'run-p-fail',{ payloads:{ winner:'x' } });
    expect(fail.manifest.blocker_codes.includes('parity_artefacts_missing')).toBe(true);
    expect(fail.metrics.blocker_codes.includes('parity_artefacts_missing')).toBe(true);
  });

  it('C/D invoked with missing or empty payloads is insufficient', async () => {
    const rootMissing = await mkdtemp(path.join(os.tmpdir(),'s9-13d-payload-missing-'));
    const miss = await emitCase(rootMissing,'run-payload-missing',{ payloads: undefined });
    expect(miss.parity.parity_status).toBe('insufficient');
    expect(miss.parity.comparison_payloads_available).toBe(false);
    expect(miss.manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');

    const rootEmpty = await mkdtemp(path.join(os.tmpdir(),'s9-13d-payload-empty-'));
    const empty = await emitCase(rootEmpty,'run-payload-empty',{ payloads: {} });
    expect(empty.parity.parity_status).toBe('insufficient');
    expect(empty.parity.comparison_payloads_available).toBe(false);
    expect(empty.manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(empty.metrics.blocker_codes).toContain('parity_artefacts_missing');
  });
});
