import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

async function readManifest(root:string, run:string){ return JSON.parse(await readFile(path.join(root, run, 'manifest.json'),'utf8')); }
async function readMetrics(root:string, run:string){ return JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'),'utf8')); }
async function readParity(root:string, run:string,take='ta'){ return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'parity', 'comparison_parity.json'),'utf8')); }

const evidenceIds = ['comparison_raw','comparison_report_internal','same_video_repeatability_trace','comparison_suppression_trace','route_variance_trace'] as const;

function safePublicPayload(): Record<string, unknown> {
  return {
    public_comparison_payload: { summary: 'safe' },
    same_video_detected: false,
    repeated_input_detected: false,
    forced_winner_risk: false,
    false_winner_risk: false,
    route_variance_detected: false,
    route_mismatch_detected: false,
    route_variance_risk: false,
  };
}

function safeNoPublicSurfacePayload(): Record<string, unknown> {
  return {
    public_output_unchanged: true,
    same_video_detected: false,
    repeated_input_detected: false,
    forced_winner_risk: false,
    false_winner_risk: false,
    route_variance_detected: false,
    route_mismatch_detected: false,
    route_variance_risk: false,
  };
}

async function emitCase(root:string, run:string, opts:{emitted?:string[]; compared?:string[]; comparisonRunId?:string|null; payloads?:unknown; publicSurfacePaths?: string[]}){
  await emitQAManifestForAnalysisRun({
    run_id:run, analysis_run_id:run, take_id:'ta', root_dir:root, internal_qa_emit:true,
    comparison_run_id: opts.comparisonRunId ?? 'cmp-x',
    compared_take_ids: opts.compared ?? ['ta','tb'],
    emitted_artefact_ids: ['raw_report', ...(opts.emitted ?? [...evidenceIds])],
    ...((opts.payloads === undefined && opts.publicSurfacePaths === undefined) ? {} : { comparison_parity_input: { comparison_payloads: opts.payloads, public_comparison_surface_paths: opts.publicSurfacePaths } }),
  });
  const manifest = await readManifest(root,run);
  const metrics = await readMetrics(root,run);
  let parity: any = null;
  if (manifest.artefact_status_by_id?.parity_comparison !== 'missing' && manifest.artefact_status_by_id?.parity_comparison !== 'not_applicable') {
    parity = await readParity(root,run,'ta');
  }
  return { manifest, metrics, parity };
}

function expectInsufficientBlocked(out:{manifest:any; metrics:any; parity:any}) {
  expect(out.parity.parity_status).toBe('insufficient');
  expect(out.manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
  expect(out.manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_comparison')?.blocker_code).toBe('parity_artefacts_missing');
  expect(out.manifest.blocker_codes).toContain('parity_artefacts_missing');
  expect(out.metrics.blocker_codes).toContain('parity_artefacts_missing');
}

function expectFailedBlocked(out:{manifest:any; metrics:any; parity:any}) {
  expect(out.parity.parity_status).toBe('failed');
  expect(out.manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
  expect(out.manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_comparison')?.blocker_code).toBe('parity_artefacts_missing');
  expect(out.manifest.blocker_codes).toContain('parity_artefacts_missing');
  expect(out.metrics.blocker_codes).toContain('parity_artefacts_missing');
}

function expectComparisonNotBlocking(manifest:any) {
  const parityComparison = manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_comparison');
  expect(parityComparison?.blocker_code).toBeUndefined();
  expect(manifest.missing_artifacts).not.toContain('parity_comparison');
}

function expectRiskFieldHit(parity:any, source:string, field:string, path:string) {
  expect(parity.risk_trace_field_hits).toEqual(expect.arrayContaining([
    expect.objectContaining({ source, field, path }),
  ]));
}

describe('v3-s9 comparison parity proof', () => {
  it('A multiple take_ids fallback without compared_take_ids invokes parity requirement', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-inv-fallback-'));
    await emitQAManifestForAnalysisRun({ run_id:'run-fallback', analysis_run_id:'run-fallback', take_id:'ta', take_ids:['ta','tb'], root_dir:root, internal_qa_emit:true, emitted_artefact_ids:['raw_report'] });
    const manifest = await readManifest(root,'run-fallback');
    const metrics = await readMetrics(root,'run-fallback');
    expect(manifest.compared_take_ids).toEqual(['ta','tb']);
    expect(manifest.artefact_status_by_id.parity_comparison).not.toBe('not_applicable');
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
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
    expectComparisonNotBlocking(manifest);
    const parityMissingInputs = ['parity_report','parity_comparison'].filter((id:string)=>manifest.missing_artifacts.includes(id));
    expect(parityMissingInputs).toEqual(['parity_report']);
  });

  it('A duplicate same take in compared_take_ids does not invoke comparison by cardinality alone', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-dedup-same-take-'));
    await emitQAManifestForAnalysisRun({ run_id:'run-dedup-same-take', analysis_run_id:'run-dedup-same-take', take_id:'ta', root_dir:root, internal_qa_emit:true, compared_take_ids:['ta','take-ta'], comparison_run_id:null, emitted_artefact_ids:['raw_report'] });
    const manifest = await readManifest(root,'run-dedup-same-take');
    expect(manifest.compared_take_ids).toEqual(['ta']);
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('not_applicable');
    expectComparisonNotBlocking(manifest);
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
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
  });

  it('E comparison_run_id forces invoked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-runid-forces-'));
    await emitQAManifestForAnalysisRun({ run_id:'run-runid-forces', analysis_run_id:'run-runid-forces', take_id:'ta', root_dir:root, internal_qa_emit:true, compared_take_ids:['ta'], comparison_run_id:'cmp-123', emitted_artefact_ids:['raw_report'] });
    const manifest = await readManifest(root,'run-runid-forces');
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
  });

  it('B/T/U complete safe evidence passes; public gates remain blocked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-b-'));
    const { manifest, metrics, parity } = await emitCase(root,'run-b',{ payloads: safePublicPayload() });
    expect(parity.parity_status).toBe('passed');
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.parity_comparison).toBe(true);
    expect(parity.production_safe_status).toBe('blocked');
    expect(parity.public_scoring_status).toBe('blocked');
    expect(parity.public_technique_authority_status).toBe('blocked');
    expect(parity.public_output_unchanged).toBe(true);
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('B public-clean payload without risk context is insufficient', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-risk-context-missing-'));
    const out = await emitCase(root,'run-risk-context-missing',{ payloads: { public_comparison_payload: { summary: 'safe' } } });
    expectInsufficientBlocked(out);
    expect(out.parity.comparison_payloads_available).toBe(true);
    expect(out.parity.public_surface_context_available).toBe(true);
    expect(out.parity.comparison_risk_context_available).toBe(false);
    expect(out.parity.mismatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ mismatch_type: 'comparison_risk_context_missing' }),
    ]));
  });

  it('C-G missing each required evidence emits insufficient proof and keeps parity blocker', async () => {
    for (const missing of evidenceIds){
      const root = await mkdtemp(path.join(os.tmpdir(),`s9-13d-m-${missing}-`));
      const emitted = evidenceIds.filter((x)=>x!==missing);
      const { manifest, metrics, parity } = await emitCase(root,`run-${missing}`,{ emitted:[...emitted], payloads: safePublicPayload() });
      expectInsufficientBlocked({ manifest, metrics, parity });
      expect(parity[`${missing}_available` as keyof typeof parity]).toBe(false);
    }
  });

  it('H internal winner/recommendation-like keys do not fail when no public leakage', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-h-'));
    const { parity } = await emitCase(root,'run-h',{ payloads: { ...safePublicPayload(), comparison_result_summary: { winner: 'internal' }, internal_recommendation_note: 'internal', selected_take_id_internal_only: 'ta' } });
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
      expect(parity.parity_status).toBe('failed');
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
      ['nested-same-video-unresolved-benign-status', { same_video_repeatability_trace: { same_video_unresolved_risk: true, same_video_suppression_status: 'resolved' } }],
      ['nested-no-material-difference-conflict', { same_video_repeatability_trace: { no_material_difference: false } }],
      ['nested-same-video-summary-detected', { same_video_repeatability_trace: { same_video_repeatability_trace_summary: { same_video_detected: true } } }],
      ['nested-route-risk', { route_variance_trace: { route_variance_risk: true } }],
      ['nested-route-mismatch', { route_variance_trace: { route_mismatch_detected: true } }],
      ['nested-route-unresolved', { route_variance_trace: { route_variance_mitigation_status: 'unresolved_blocked' } }],
      ['nested-route-detected-missing-mitigation', { route_variance_trace: { route_variance_detected: true } }],
      ['nested-route-summary-detected', { route_variance_trace: { route_variance_trace_summary: { route_variance_detected: true } } }],
    ];
    for (const [suffix, payloads] of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(), `s9-13d-nested-risk-${suffix}-`));
      const { manifest, metrics, parity } = await emitCase(root, `run-${suffix}`, { payloads });
      expect(parity.parity_status).toBe('failed');
      expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
      expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
      expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
    }
  });

  it('accepted mitigation statuses neutralise nested risk when otherwise safe', async () => {
    const rootRouteRisk = await mkdtemp(path.join(os.tmpdir(), 's9-13d-route-risk-mitigated-'));
    const routeRisk = await emitCase(rootRouteRisk, 'run-route-risk-mitigated', {
      payloads: { route_variance_trace: { route_variance_risk: true, route_variance_mitigation_status: 'resolved' }, ...safePublicPayload() },
    });
    expect(routeRisk.parity.parity_status).toBe('passed');

    const rootRoute = await mkdtemp(path.join(os.tmpdir(), 's9-13d-route-mitigated-'));
    const route = await emitCase(rootRoute, 'run-route-mitigated', {
      payloads: { route_variance_trace: { route_variance_detected: true, route_variance_mitigation_status: 'mitigated' }, ...safePublicPayload() },
    });
    expect(route.parity.parity_status).toBe('passed');

    const rootSameVideo = await mkdtemp(path.join(os.tmpdir(), 's9-13d-samevideo-mitigated-'));
    const sameVideo = await emitCase(rootSameVideo, 'run-samevideo-mitigated', {
      payloads: { same_video_repeatability_trace: { same_video_detected: true, same_video_suppression_status: 'resolved' }, ...safePublicPayload() },
    });
    expect(sameVideo.parity.parity_status).toBe('passed');

    const rootRouteSuppressed = await mkdtemp(path.join(os.tmpdir(), 's9-13d-route-suppressed-'));
    const routeSuppressed = await emitCase(rootRouteSuppressed, 'run-route-suppressed', {
      payloads: { route_variance_trace: { route_variance_detected: true, route_variance_suppression_status: 'mitigated' }, ...safePublicPayload() },
    });
    expect(routeSuppressed.parity.parity_status).toBe('passed');

    const rootRepeatedMitigated = await mkdtemp(path.join(os.tmpdir(), 's9-13d-repeated-mitigated-'));
    const repeatedMitigated = await emitCase(rootRepeatedMitigated, 'run-repeated-mitigated', {
      payloads: { same_video_repeatability_trace: { repeated_input_detected: true, same_video_suppression_status: 'mitigated' }, ...safePublicPayload() },
    });
    expect(repeatedMitigated.parity.parity_status).toBe('passed');

    const rootNoMaterialDifferenceMitigated = await mkdtemp(path.join(os.tmpdir(), 's9-13d-no-material-mitigated-'));
    const noMaterialDifferenceMitigated = await emitCase(rootNoMaterialDifferenceMitigated, 'run-no-material-mitigated', {
      payloads: { same_video_repeatability_trace: { no_material_difference: false, same_video_suppression_status: 'accepted' }, ...safePublicPayload() },
    });
    expect(noMaterialDifferenceMitigated.parity.parity_status).toBe('passed');
  });

  it('top-level repeated_input_detected and route variance detections fail when unmitigated', async () => {
    const rootRepeated = await mkdtemp(path.join(os.tmpdir(), 's9-13d-top-repeated-'));
    const repeated = await emitCase(rootRepeated, 'run-top-repeated', { payloads: { repeated_input_detected: true } });
    expect(repeated.parity.parity_status).toBe('failed');

    const rootMismatch = await mkdtemp(path.join(os.tmpdir(), 's9-13d-top-route-mismatch-'));
    const mismatch = await emitCase(rootMismatch, 'run-top-route-mismatch', { payloads: { route_mismatch_detected: true } });
    expect(mismatch.parity.parity_status).toBe('failed');

    const rootVariance = await mkdtemp(path.join(os.tmpdir(), 's9-13d-top-route-variance-'));
    const variance = await emitCase(rootVariance, 'run-top-route-variance', { payloads: { route_variance_detected: true } });
    expect(variance.parity.parity_status).toBe('failed');
  });

  it('accepted-looking mitigation does not neutralise forced or false winner risk', async () => {
    const rootForced = await mkdtemp(path.join(os.tmpdir(), 's9-13d-forced-mitigation-'));
    const forced = await emitCase(rootForced, 'run-forced-mitigation', {
      payloads: { ...safePublicPayload(), forced_winner_risk: true, route_variance_mitigation_status: 'resolved', same_video_suppression_status: 'accepted' },
    });
    expectFailedBlocked(forced);

    const rootFalse = await mkdtemp(path.join(os.tmpdir(), 's9-13d-false-not-required-'));
    const falseWinner = await emitCase(rootFalse, 'run-false-not-required', {
      payloads: { ...safePublicPayload(), false_winner_risk: true, false_winner_prevention_status: 'not_required' },
    });
    expectFailedBlocked(falseWinner);
  });

  it('not_applicable mitigation does not neutralise active detected risk', async () => {
    const rootSameVideo = await mkdtemp(path.join(os.tmpdir(), 's9-13d-same-video-na-'));
    const sameVideo = await emitCase(rootSameVideo, 'run-same-video-na', {
      payloads: { same_video_repeatability_trace: { same_video_detected: true, same_video_suppression_status: 'not_applicable' }, ...safePublicPayload() },
    });
    expectFailedBlocked(sameVideo);

    const rootRoute = await mkdtemp(path.join(os.tmpdir(), 's9-13d-route-na-'));
    const route = await emitCase(rootRoute, 'run-route-na', {
      payloads: { route_variance_trace: { route_variance_detected: true, route_variance_mitigation_status: 'not_applicable' }, ...safePublicPayload() },
    });
    expectFailedBlocked(route);
  });

  it('explicit no-risk statuses and prevention status do not fail when otherwise safe', async () => {
    const rootRoute = await mkdtemp(path.join(os.tmpdir(), 's9-13d-route-not-detected-'));
    const route = await emitCase(rootRoute, 'run-route-not-detected', {
      payloads: { route_variance_trace: { route_variance_status: 'not_detected' }, ...safePublicPayload() },
    });
    expect(route.parity.parity_status).toBe('passed');

    const rootSameVideo = await mkdtemp(path.join(os.tmpdir(), 's9-13d-same-video-false-'));
    const sameVideo = await emitCase(rootSameVideo, 'run-same-video-false', {
      payloads: { same_video_repeatability_trace: { same_video_detected: false, repeated_input_detected: false, same_video_repeatability_status: 'not_detected' }, ...safePublicPayload() },
    });
    expect(sameVideo.parity.parity_status).toBe('passed');

    const rootPrevention = await mkdtemp(path.join(os.tmpdir(), 's9-13d-prevention-not-required-'));
    const prevention = await emitCase(rootPrevention, 'run-prevention-not-required', {
      payloads: { comparison_suppression_trace: { false_winner_prevention_status: 'not_required' }, ...safePublicPayload() },
    });
    expect(prevention.parity.parity_status).toBe('passed');
  });

  it('unresolved_blocked always fails even with benign suppression status', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13d-unresolved-blocked-'));
    const out = await emitCase(root, 'run-unresolved-blocked', {
      payloads: { route_variance_trace: { route_variance_detected: true, route_variance_mitigation_status: 'unresolved_blocked', route_variance_suppression_status: 'not_required' } },
    });
    expect(out.parity.parity_status).toBe('failed');
  });

  it('collector diagnostics include top-level and nested risk sources/fields', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-risk-collector-'));
    const { parity } = await emitCase(root,'run-risk-collector',{ payloads: {
      forced_winner_risk: true,
      same_video_repeatability_trace: { same_video_detected: true, repeated_input_detected: true, forced_winner_risk: true, false_winner_risk: true, same_video_repeatability_trace_summary: { same_video_detected: true } },
      route_variance_trace: { route_variance_risk: true, route_mismatch_detected: true, route_variance_detected: true, route_variance_mitigation_status: 'unresolved_blocked', route_variance_trace_summary: { route_variance_detected: true } },
      comparison_suppression_trace: { same_video_suppression_status: 'not_required', route_variance_suppression_status: 'mitigated', false_winner_prevention_status: 'not_required' },
      comparison_raw: { false_winner_prevention_status: 'not_required' },
      comparison_report_internal: { forced_winner_risk: false, internal_same_video_note: 'same video', internal_route_variance_note: 'route variance' },
    }});
    expect(parity.checked_risk_sources).toContain('comparison_payloads');
    expect(parity.checked_risk_sources).toContain('same_video_repeatability_trace');
    expect(parity.checked_risk_sources).toContain('route_variance_trace');
    expect(parity.checked_risk_sources).toContain('comparison_suppression_trace');
    expect(parity.checked_risk_sources).toContain('comparison_raw');
    expect(parity.checked_risk_sources).toContain('comparison_report_internal');
    expect(parity.risk_source_count).toBeGreaterThanOrEqual(6);
    expect(parity.risk_trace_fields_checked).toContain('repeated_input_detected');
    expect(parity.risk_trace_fields_checked).toContain('route_mismatch_detected');
    expect(parity.risk_trace_fields_checked).toContain('route_variance_detected');
    expectRiskFieldHit(parity, 'comparison_payloads', 'forced_winner_risk', 'comparison_payloads.forced_winner_risk');
    expectRiskFieldHit(parity, 'same_video_repeatability_trace', 'same_video_detected', 'same_video_repeatability_trace.same_video_detected');
    expectRiskFieldHit(parity, 'same_video_repeatability_trace', 'same_video_detected', 'same_video_repeatability_trace.same_video_repeatability_trace_summary.same_video_detected');
    expectRiskFieldHit(parity, 'same_video_repeatability_trace', 'repeated_input_detected', 'same_video_repeatability_trace.repeated_input_detected');
    expectRiskFieldHit(parity, 'same_video_repeatability_trace', 'forced_winner_risk', 'same_video_repeatability_trace.forced_winner_risk');
    expectRiskFieldHit(parity, 'same_video_repeatability_trace', 'false_winner_risk', 'same_video_repeatability_trace.false_winner_risk');
    expectRiskFieldHit(parity, 'route_variance_trace', 'route_mismatch_detected', 'route_variance_trace.route_mismatch_detected');
    expectRiskFieldHit(parity, 'route_variance_trace', 'route_variance_detected', 'route_variance_trace.route_variance_trace_summary.route_variance_detected');
    expectRiskFieldHit(parity, 'route_variance_trace', 'route_variance_mitigation_status', 'route_variance_trace.route_variance_mitigation_status');
    expectRiskFieldHit(parity, 'comparison_suppression_trace', 'same_video_suppression_status', 'comparison_suppression_trace.same_video_suppression_status');
    expectRiskFieldHit(parity, 'comparison_suppression_trace', 'route_variance_suppression_status', 'comparison_suppression_trace.route_variance_suppression_status');
    expectRiskFieldHit(parity, 'comparison_suppression_trace', 'false_winner_prevention_status', 'comparison_suppression_trace.false_winner_prevention_status');
    expectRiskFieldHit(parity, 'comparison_raw', 'false_winner_prevention_status', 'comparison_raw.false_winner_prevention_status');
    expectRiskFieldHit(parity, 'comparison_report_internal', 'forced_winner_risk', 'comparison_report_internal.forced_winner_risk');
    expect(parity.risk_source_scan_warnings).toEqual([]);
  });

  it('collector does not infer explicit risk from lookalike internal keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-risk-lookalike-'));
    const { parity } = await emitCase(root,'run-risk-lookalike',{ payloads: {
      ...safePublicPayload(),
      comparison_report_internal: { internal_same_video_note: 'same video', internal_route_variance_note: 'route variance' },
    }});
    expect(parity.checked_risk_sources).toEqual(['comparison_payloads']);
    expect(parity.checked_risk_sources).not.toContain('comparison_report_internal');
    expect(
      parity.risk_trace_field_hits.some(
        (hit: { path: string }) =>
          hit.path.includes('internal_same_video_note') || hit.path.includes('internal_route_variance_note'),
      ),
    ).toBe(false);
    expect(parity.parity_status).toBe('passed');
  });

  it('collector records malformed, cyclic and over-depth risk source warnings without throwing', async () => {
    const rootCycle = await mkdtemp(path.join(os.tmpdir(),'s9-13d-risk-cycle-'));
    const cyclicTrace: Record<string, unknown> = { same_video_detected: false };
    cyclicTrace.self = cyclicTrace;
    const cycle = await emitCase(rootCycle,'run-risk-cycle',{ payloads: { ...safePublicPayload(), same_video_repeatability_trace: cyclicTrace } });
    expectInsufficientBlocked(cycle);
    expect(cycle.parity.risk_source_scan_safe).toBe(false);
    expect(cycle.parity.risk_source_scan_warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'same_video_repeatability_trace', warning: 'cycle_detected' }),
    ]));
    expectRiskFieldHit(cycle.parity, 'same_video_repeatability_trace', 'same_video_detected', 'same_video_repeatability_trace.same_video_detected');

    const rootDepth = await mkdtemp(path.join(os.tmpdir(),'s9-13d-risk-depth-'));
    const deepTrace: Record<string, unknown> = {};
    let cursor = deepTrace;
    for (let i = 0; i < 30; i += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    const depth = await emitCase(rootDepth,'run-risk-depth',{ payloads: { ...safePublicPayload(), route_variance_trace: deepTrace } });
    expectInsufficientBlocked(depth);
    expect(depth.parity.risk_source_scan_warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'route_variance_trace', warning: 'depth_limit_exceeded' }),
    ]));

    const rootMalformed = await mkdtemp(path.join(os.tmpdir(),'s9-13d-risk-malformed-'));
    const malformed = await emitCase(rootMalformed,'run-risk-malformed',{ payloads: { ...safePublicPayload(), comparison_suppression_trace: new Date('2026-05-19T00:00:00.000Z') } });
    expectInsufficientBlocked(malformed);
    expect(malformed.parity.risk_source_scan_warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'comparison_suppression_trace', path: 'comparison_suppression_trace', warning: 'uninspectable_object' }),
    ]));
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

    const rootTechnique = await mkdtemp(path.join(os.tmpdir(),'s9-13d-nested-technique-'));
    const technique = await emitCase(rootTechnique,'run-nested-technique',{ payloads: { public_comparison_payload: { panels: [{ detail: { technique_authority: 'public' } }] } } });
    expect(technique.parity.parity_status).toBe('failed');
    expect(technique.parity.mismatches.some((m:any)=>m.path === 'public_comparison_payload.panels[0].detail.technique_authority')).toBe(true);
  });

  it('recursive public scanner reports exact forbidden hits and diagnostic families', async () => {
    const rootCastability = await mkdtemp(path.join(os.tmpdir(),'s9-13d-castability-diagnostics-'));
    const castability = await emitCase(rootCastability,'run-castability-diagnostics',{ payloads: { public_comparison_payload: { profile: { castability: 'public' } } } });
    expectFailedBlocked(castability);
    expect(castability.parity.public_winner_absent).toBe(true);
    expect(castability.parity.public_recommendation_absent).toBe(true);
    expect(castability.parity.forbidden_public_comparison_fields_absent).toBe(false);

    const rootMultiple = await mkdtemp(path.join(os.tmpdir(),'s9-13d-multiple-forbidden-'));
    const multiple = await emitCase(rootMultiple,'run-multiple-forbidden',{ payloads: { public_comparison_payload: { cards: [{ winner: 'ta', recommendation: 'use ta', public_score: 99 }], marketability: 'public' } } });
    expectFailedBlocked(multiple);
    const forbiddenMismatches = multiple.parity.mismatches.filter((m:any)=>m.mismatch_type === 'forbidden_public_comparison_field_present');
    expect(forbiddenMismatches.length).toBe(4);
    expect(forbiddenMismatches.map((m:any)=>m.path)).toEqual(expect.arrayContaining([
      'public_comparison_payload.cards[0].winner',
      'public_comparison_payload.cards[0].recommendation',
      'public_comparison_payload.cards[0].public_score',
      'public_comparison_payload.marketability',
    ]));
  });

  it('recursive public scanner does not false-fail internal-only or lookalike fields', async () => {
    const rootPublicLookalike = await mkdtemp(path.join(os.tmpdir(),'s9-13d-public-lookalike-'));
    const publicLookalike = await emitCase(rootPublicLookalike,'run-public-lookalike',{ payloads: { ...safePublicPayload(), public_comparison_payload: { internal_recommendation_note: 'internal note', recommendation_suppressed: true, comparison_result_summary: 'safe' } } });
    expect(publicLookalike.parity.parity_status).toBe('passed');
    expect(publicLookalike.parity.forbidden_public_comparison_fields_absent).toBe(true);
    expect(publicLookalike.parity.public_recommendation_absent).toBe(true);

    const rootInternalOnly = await mkdtemp(path.join(os.tmpdir(),'s9-13d-internal-only-lookalike-'));
    const internalOnly = await emitCase(rootInternalOnly,'run-internal-only-lookalike',{ payloads: {
      ...safePublicPayload(),
      comparison_suppression_trace: { recommendation_suppressed: true, suppression_reason: 'internal-only' },
      comparison_report_internal: {
        selected_take_id_internal_only: 'ta',
        internal_recommendation_note: 'internal note',
        internal_castability_diagnostic: 'internal-only',
      },
    }});
    expect(internalOnly.parity.parity_status).toBe('passed');
    expect(internalOnly.parity.forbidden_public_comparison_fields_absent).toBe(true);
  });

  it('recursive public scanner handles cyclic and over-depth public surfaces safely', async () => {
    const rootCycle = await mkdtemp(path.join(os.tmpdir(),'s9-13d-public-cycle-'));
    const cyclicPayload: Record<string, unknown> = { summary: 'safe' };
    cyclicPayload.self = cyclicPayload;
    const cycle = await emitCase(rootCycle,'run-public-cycle',{ payloads: { public_comparison_payload: cyclicPayload } });
    expectInsufficientBlocked(cycle);
    expect(cycle.parity.public_surface_scan_safe).toBe(false);
    expect(cycle.parity.public_surface_scan_issues.some((x:any)=>x.issue === 'cycle_detected')).toBe(true);

    const rootCycleWithHit = await mkdtemp(path.join(os.tmpdir(),'s9-13d-public-cycle-hit-'));
    const cyclicHitPayload: Record<string, unknown> = { winner: 'ta' };
    cyclicHitPayload.self = cyclicHitPayload;
    const cycleWithHit = await emitCase(rootCycleWithHit,'run-public-cycle-hit',{ payloads: { public_comparison_payload: cyclicHitPayload } });
    expectFailedBlocked(cycleWithHit);
    expect(cycleWithHit.parity.mismatches.some((m:any)=>m.path === 'public_comparison_payload.winner')).toBe(true);

    const rootDepth = await mkdtemp(path.join(os.tmpdir(),'s9-13d-public-depth-'));
    const deepPayload: Record<string, unknown> = {};
    let cursor = deepPayload;
    for (let i = 0; i < 30; i += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    const depth = await emitCase(rootDepth,'run-public-depth',{ payloads: { public_comparison_payload: deepPayload } });
    expectInsufficientBlocked(depth);
    expect(depth.parity.public_surface_scan_safe).toBe(false);
    expect(depth.parity.public_surface_scan_issues.some((x:any)=>x.issue === 'depth_limit_exceeded')).toBe(true);
  });

  it('explicitly named public comparison surfaces are scanned without broad substring matching', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-named-public-surface-'));
    const out = await emitCase(root,'run-named-public-surface',{
      payloads: { custom_public: { cards: [{ selected_take_id_public: 'ta' }] } },
      publicSurfacePaths: ['custom_public'],
    });
    expectFailedBlocked(out);
    expect(out.parity.checked_comparison_surfaces).toContain('custom_public');
    expect(out.parity.mismatches.some((m:any)=>m.path === 'custom_public.cards[0].selected_take_id_public')).toBe(true);
  });

  it('O unresolved_blocked route risk is failed and non-satisfying', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-o-'));
    const { manifest, parity } = await emitCase(root,'run-o',{ payloads: { route_variance_mitigation_status:'unresolved_blocked' } });
    expect(parity.parity_status).toBe('failed');
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
  });

  it('P manifest and metrics blocker code align for pass and non-pass', async () => {
    const rootPass = await mkdtemp(path.join(os.tmpdir(),'s9-13d-p1-'));
    const pass = await emitCase(rootPass,'run-p-pass',{ payloads: safePublicPayload() });
    expect(pass.manifest.blocker_codes.includes('parity_artefacts_missing')).toBe(pass.metrics.blocker_codes.includes('parity_artefacts_missing'));

    const rootFail = await mkdtemp(path.join(os.tmpdir(),'s9-13d-p2-'));
    const fail = await emitCase(rootFail,'run-p-fail',{ payloads:{ winner:'x' } });
    expect(fail.manifest.blocker_codes.includes('parity_artefacts_missing')).toBe(true);
    expect(fail.metrics.blocker_codes.includes('parity_artefacts_missing')).toBe(true);
  });

  it('C/D invoked with missing or empty payloads is insufficient', async () => {
    const rootMissing = await mkdtemp(path.join(os.tmpdir(),'s9-13d-payload-missing-'));
    const miss = await emitCase(rootMissing,'run-payload-missing',{ payloads: undefined });
    expectInsufficientBlocked(miss);
    expect(miss.parity.comparison_payloads_available).toBe(false);

    const rootEmpty = await mkdtemp(path.join(os.tmpdir(),'s9-13d-payload-empty-'));
    const empty = await emitCase(rootEmpty,'run-payload-empty',{ payloads: {} });
    expectInsufficientBlocked(empty);
    expect(empty.parity.comparison_payloads_available).toBe(false);
  });

  it('comparison_payloads with unknown-only, scalar, or array-only payloads are insufficient', async () => {
    const cases: Array<[string, unknown]> = [
      ['unknown-only', { unexpected: { note: 'not inspectable' } }],
      ['scalar', 'not-an-object'],
      ['array-only', [{ public_output_unchanged: true }]],
    ];
    for (const [suffix, payloads] of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(),`s9-13d-payload-${suffix}-`));
      const out = await emitCase(root,`run-payload-${suffix}`,{ payloads });
      expectInsufficientBlocked(out);
      expect(out.parity.comparison_payloads_available).toBe(false);
    }
  });

  it('no public surface without explicit absence or unchanged proof is insufficient', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-no-public-proof-missing-'));
    const out = await emitCase(root,'run-no-public-proof-missing',{ payloads: {
      same_video_detected: false,
      repeated_input_detected: false,
      route_variance_detected: false,
      route_mismatch_detected: false,
    } });
    expectInsufficientBlocked(out);
    expect(out.parity.comparison_payloads_available).toBe(true);
    expect(out.parity.public_surface_context_available).toBe(false);
    expect(out.parity.mismatches.some((m:any)=>m.mismatch_type==='comparison_public_surface_context_missing')).toBe(true);
  });

  it('no public surface with explicit absence or unchanged proof can pass when otherwise complete', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(),'s9-13d-no-public-proof-present-'));
    const out = await emitCase(root,'run-no-public-proof-present',{ payloads: safeNoPublicSurfacePayload() });
    expect(out.parity.parity_status).toBe('passed');
    expect(out.parity.comparison_payloads_available).toBe(true);
    expect(out.parity.public_surface_context_available).toBe(true);
    expect(out.parity.public_output_absence_or_unchanged_evidence_available).toBe(true);
    expect(out.manifest.artefact_status_by_id.parity_comparison).toBe('emitted');
    expectComparisonNotBlocking(out.manifest);
    expect(out.manifest.blocker_codes.includes('parity_artefacts_missing')).toBe(out.metrics.blocker_codes.includes('parity_artefacts_missing'));
  });
});
