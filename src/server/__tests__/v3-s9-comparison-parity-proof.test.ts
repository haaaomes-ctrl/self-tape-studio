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
  it('A multiple take_ids fallback without compared_take_ids invokes parity requirement', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-inv-fallback-'));
    await emitQAManifestForAnalysisRun({ run_id:'run-fallback', analysis_run_id:'run-fallback', take_id:'ta', take_ids:['ta','tb'], root_dir:root, internal_qa_emit:true, emitted_artefact_ids:['raw_report'] });
    const manifest = await readManifest(root,'run-fallback');
    const metrics = await readMetrics(root,'run-fallback');
    expect(manifest.compared_take_ids).toEqual(['ta','tb']);
    expect(manifest.artefact_status_by_id.parity_comparison).not.toBe('not_applicable');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
  });

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

  it('C metadata.compared_take_ids with 2 ids invokes comparison parity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-explicit-compared-'));
    const out = await emitCase(root,'run-explicit',{ compared:['ta','tb'], payloads: undefined });
    expect(out.manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
  });

  it('D comparison artefact presence forces invoked even with one compared id', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-artefact-forces-'));
    await emitQAManifestForAnalysisRun({ run_id:'run-artefact-forces', analysis_run_id:'run-artefact-forces', take_id:'ta', root_dir:root, internal_qa_emit:true, compared_take_ids:['ta'], emitted_artefact_ids:['raw_report','comparison_raw'] });
    const manifest = await readManifest(root,'run-artefact-forces');
    expect(manifest.artefact_status_by_id.parity_comparison).not.toBe('not_applicable');
  });

  it('E comparison_run_id forces invoked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-runid-forces-'));
    await emitQAManifestForAnalysisRun({ run_id:'run-runid-forces', analysis_run_id:'run-runid-forces', take_id:'ta', root_dir:root, internal_qa_emit:true, compared_take_ids:['ta'], comparison_run_id:'cmp-123', emitted_artefact_ids:['raw_report'] });
    const manifest = await readManifest(root,'run-runid-forces');
    expect(manifest.artefact_status_by_id.parity_comparison).not.toBe('not_applicable');
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

  it('nested trace risk flags fail/block and retained blockers', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['nested-same-video-detected', { same_video_repeatability_trace: { same_video_detected: true } }],
      ['nested-repeated-input', { same_video_repeatability_trace: { repeated_input_detected: true } }],
      ['nested-forced-winner', { same_video_repeatability_trace: { forced_winner_risk: true } }],
      ['nested-false-winner', { same_video_repeatability_trace: { false_winner_risk: true } }],
      ['nested-route-risk', { route_variance_trace: { route_variance_risk: true } }],
      ['nested-route-unresolved', { route_variance_trace: { route_variance_mitigation_status: 'unresolved_blocked' } }],
      ['nested-route-detected-missing-mitigation', { route_variance_trace: { route_variance_detected: true } }],
    ];
    for (const [suffix, payloads] of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(), `s9-13d-nested-risk-${suffix}-`));
      const { manifest, metrics, parity } = await emitCase(root, `run-${suffix}`, { payloads });
      expect(['failed', 'insufficient']).toContain(parity.parity_status);
      expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
      expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
      expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
    }
  });

  it('accepted mitigation statuses neutralise nested risk when otherwise safe', async () => {
    const rootRoute = await mkdtemp(path.join(os.tmpdir(), 's9-13d-route-mitigated-'));
    const route = await emitCase(rootRoute, 'run-route-mitigated', {
      payloads: { route_variance_trace: { route_variance_detected: true, route_variance_mitigation_status: 'mitigated' }, public_comparison_payload: { note: 'safe' } },
    });
    expect(route.parity.parity_status).toBe('passed');

    const rootSameVideo = await mkdtemp(path.join(os.tmpdir(), 's9-13d-samevideo-mitigated-'));
    const sameVideo = await emitCase(rootSameVideo, 'run-samevideo-mitigated', {
      payloads: { same_video_repeatability_trace: { same_video_detected: true, same_video_mitigation_status: 'accepted' }, public_comparison_payload: { note: 'safe' } },
    });
    expect(sameVideo.parity.parity_status).toBe('passed');
  });

  it('collector diagnostics include top-level and nested risk sources/fields', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-risk-collector-'));
    const { parity } = await emitCase(root,'run-risk-collector',{ payloads: {
      forced_winner_risk: true,
      same_video_repeatability_trace: { same_video_detected: true, repeated_input_detected: true, forced_winner_risk: true, false_winner_risk: true },
      route_variance_trace: { route_variance_risk: true, route_mismatch_detected: true, route_variance_detected: true, route_variance_mitigation_status: 'unresolved_blocked' },
      comparison_suppression_trace: { same_video_suppression_status: 'not_required', route_variance_suppression_status: 'mitigated', false_winner_prevention_status: 'not_required' },
      comparison_report_internal: { internal_same_video_note: 'same video', internal_route_variance_note: 'route variance' },
    }});
    expect(parity.checked_risk_sources).toContain('comparison_payloads');
    expect(parity.checked_risk_sources).toContain('same_video_repeatability_trace');
    expect(parity.checked_risk_sources).toContain('route_variance_trace');
    expect(parity.checked_risk_sources).toContain('comparison_suppression_trace');
    expect(parity.risk_source_count).toBeGreaterThanOrEqual(4);
    expect(parity.risk_trace_fields_checked).toContain('repeated_input_detected');
    expect(parity.risk_trace_fields_checked).toContain('route_mismatch_detected');
    expect(parity.risk_trace_fields_checked).toContain('route_variance_detected');
  });

  it('collector does not infer explicit risk from lookalike internal keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-risk-lookalike-'));
    const { parity } = await emitCase(root,'run-risk-lookalike',{ payloads: {
      public_comparison_payload: { note: 'safe' },
      comparison_report_internal: { internal_same_video_note: 'same video', internal_route_variance_note: 'route variance' },
    }});
    expect(parity.checked_risk_sources).toEqual(['comparison_payloads']);
    expect(parity.parity_status).toBe('passed');
  });

  it('A-F forbidden non-winner public fields fail parity and keep winner/recommendation diagnostics true when applicable', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['castability', { public_comparison_payload: { castability: 'x' } }],
      ['bookability', { public_comparison_payload: { bookability: 'x' } }],
      ['marketability', { public_comparison_payload: { marketability: 'x' } }],
      ['public_score', { public_comparison_payload: { public_score: 90 } }],
      ['technique_authority', { public_comparison_payload: { technique_authority: 'x' } }],
      ['selected_take_id_public', { public_comparison_payload: { selected_take_id_public: 'ta' } }],
    ];
    for (const [suffix, payloads] of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(), `s9-13d-forbidden-${suffix}-`));
      const { manifest, metrics, parity } = await emitCase(root, `run-forbidden-${suffix}`, { payloads });
      expect(parity.forbidden_public_comparison_fields_absent).toBe(false);
      expect(parity.parity_status).toBe('failed');
      expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
      expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
      expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
      expect(parity.mismatches.some((m:any)=>m.mismatch_type==='forbidden_public_comparison_field_present')).toBe(true);
    }
  });

  it('G/H winner and recommendation leaks set respective diagnostics false', async () => {
    const rootWinner = await mkdtemp(path.join(os.tmpdir(),'s9-13d-win-leak-'));
    const winner = await emitCase(rootWinner,'run-win-leak',{ payloads: { public_comparison_payload: { winner:'ta' } } });
    expect(winner.parity.public_winner_absent).toBe(false);
    expect(winner.parity.public_recommendation_absent).toBe(true);

    const rootRec = await mkdtemp(path.join(os.tmpdir(),'s9-13d-rec-leak-'));
    const rec = await emitCase(rootRec,'run-rec-leak',{ payloads: { public_comparison_payload: { recommendation:'ta' } } });
    expect(rec.parity.public_winner_absent).toBe(true);
    expect(rec.parity.public_recommendation_absent).toBe(false);
  });

  it('P1-6 nested public leaks are detected recursively', async () => {
    const rootWinner = await mkdtemp(path.join(os.tmpdir(),'s9-13d-nested-winner-'));
    const winner = await emitCase(rootWinner,'run-nested-winner',{ payloads: { public_comparison_payload: { summary: { winner: 'take-a' } } } });
    expect(winner.parity.parity_status).toBe('failed');
    expect(winner.parity.forbidden_public_comparison_fields_absent).toBe(false);
    expect(winner.parity.mismatches.some((m:any)=>m.path === 'public_comparison_payload.summary.winner')).toBe(true);

    const rootRec = await mkdtemp(path.join(os.tmpdir(),'s9-13d-nested-rec-'));
    const rec = await emitCase(rootRec,'run-nested-rec',{ payloads: { public_comparison_payload: { sections: [{ recommendation: 'use take-a' }] } } });
    expect(rec.parity.parity_status).toBe('failed');
    expect(rec.parity.mismatches.some((m:any)=>m.path === 'public_comparison_payload.sections[0].recommendation')).toBe(true);

    const rootScore = await mkdtemp(path.join(os.tmpdir(),'s9-13d-nested-score-'));
    const score = await emitCase(rootScore,'run-nested-score',{ payloads: { public_output: { comparison: { cards: [{ public_score: 98 }] } } } });
    expect(score.parity.parity_status).toBe('failed');
    expect(score.parity.mismatches.some((m:any)=>m.path === 'public_output.comparison.cards[0].public_score')).toBe(true);
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
