import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitAnalysisEvidenceStatePrerequisite, emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

type LegacyBundleOptions = {
  run?: string;
  take?: string;
  report?: Record<string, unknown>;
  manifestSource?: Record<string, string>;
  manifestLevel2?: Record<string, boolean>;
  acceptedIds?: string[];
  blockedIds?: string[];
  realV3Ids?: string[];
  includeAnalysisEvidenceState?: boolean;
};

const defaultLegacyReport = {
  schema_version: 'v1-legacy',
  overall_score: 92,
  casting_headline: 'Perfect match for this role',
  fix_first: 'send with confidence',
  strengths: ['strong presence'],
  category_notes: ['Take 2 is the winner and recommended over Take 1'],
  timestamped_notes: [{ timestamp: '00:10', note: 'Grounded beat lands.' }],
};

async function emitLegacyBundle(options: LegacyBundleOptions = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914a-'));
  const run = options.run ?? `run-s914a-${Math.random().toString(36).slice(2)}`;
  const take = options.take ?? 't1';
  const report = options.report ?? defaultLegacyReport;
  await emitRawReportArtefact({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    source_stage: 'unit',
    source_module: 'test',
    report_data: report,
    root_dir: root,
    internal_qa_emit: true,
  });
  const anchorsOut = await emitEvidenceAnchorsFirstPass({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    raw_report_data: { artefact_type: 'raw_report', report_data: report },
    root_dir: root,
    internal_qa_emit: true,
  });
  const anchorsPath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'EvidenceAnchors.json');
  const anchors = anchorsOut.written ? JSON.parse(await readFile(anchorsPath, 'utf8')) : null;
  const claimsOut = await emitPublicClaimTraceFirstPass({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    raw_report_data: { artefact_type: 'raw_report', report_data: report },
    evidence_anchors_data: anchors,
    root_dir: root,
    internal_qa_emit: true,
  });
  const claimsPath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'PublicClaimTrace.json');
  const claims = claimsOut.written ? JSON.parse(await readFile(claimsPath, 'utf8')) : null;
  const analysisEvidenceStateOut = options.includeAnalysisEvidenceState ? await emitAnalysisEvidenceStatePrerequisite({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    media_readiness_state: 'ready',
    media_duration_seconds: null,
    duration_confidence: 'unknown',
    resolver_output_available: true,
    truth_state_map_available: true,
    root_dir: root,
    internal_qa_emit: true,
  }) : null;
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: ['raw_report', ...(analysisEvidenceStateOut?.emitted_artefact_ids ?? []), ...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut.written ? ['public_claim_trace'] : [])],
    emitted_blocked_artefact_ids: [...(analysisEvidenceStateOut?.emitted_blocked_artefact_ids ?? [])],
    artefact_source_classification_by_id: {
      raw_report: 'legacy_adapter',
      ...(analysisEvidenceStateOut?.written ? { analysis_evidence_state: analysisEvidenceStateOut.source_classification } : {}),
      ...(anchorsOut.written ? { evidence_anchors: 'legacy_adapter' } : {}),
      ...(claimsOut.written ? { public_claim_trace: 'legacy_adapter' } : {}),
      ...(options.manifestSource ?? {}),
    },
    artefact_level2_spine_satisfaction_by_id: {
      raw_report: false,
      ...(analysisEvidenceStateOut?.written ? { analysis_evidence_state: analysisEvidenceStateOut.level2_satisfies } : {}),
      ...(anchorsOut.written ? { evidence_anchors: false } : {}),
      ...(claimsOut.written ? { public_claim_trace: false } : {}),
      ...(options.manifestLevel2 ?? {}),
    },
    legacy_adapter_artefact_ids: ['raw_report', ...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut.written ? ['public_claim_trace'] : [])],
    runtime_evidence_accepted_by_id: options.acceptedIds,
    runtime_evidence_blocked_by_id: options.blockedIds,
    real_v3_spine_artefact_ids: options.realV3Ids,
    public_claim_trace_summary: claimsOut.summary,
    analysis_evidence_state_summary: analysisEvidenceStateOut?.written ? analysisEvidenceStateOut.summary : undefined,
  });
  const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  const analysisEvidenceStatePath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'analysis', 'AnalysisEvidenceState.json');
  const analysisEvidenceState = analysisEvidenceStateOut?.written ? JSON.parse(await readFile(analysisEvidenceStatePath, 'utf8')) : null;
  return { root, run, take, report, anchorsOut, anchors, claimsOut, claims, analysisEvidenceStateOut, analysisEvidenceState, manifest, metrics };
}

async function emitAnalysisEvidenceStateBundle(options: {
  run?: string;
  take?: string;
  resolver?: boolean;
  truth?: boolean;
  duration?: number | null;
  mediaState?: string | null;
  selectedLevel?: string | null;
  auditionType?: string | null;
  briefPresence?: 'supplied' | 'absent' | 'unknown';
  materialPresence?: 'supplied' | 'absent' | 'unknown';
  componentStatus?: 'unknown' | 'known_empty' | 'supplied';
  metadataOverrides?: Record<string, unknown>;
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914b-'));
  const run = options.run ?? `run-s914b-${Math.random().toString(36).slice(2)}`;
  const take = options.take ?? 't1';
  const out = await emitAnalysisEvidenceStatePrerequisite({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    selected_level: options.selectedLevel === undefined ? 'advanced' : options.selectedLevel,
    audition_type: options.auditionType === undefined ? 'monologue' : options.auditionType,
    brief_presence: options.briefPresence ?? 'supplied',
    brief_presence_source: 'audition.brief',
    material_presence: options.materialPresence ?? 'supplied',
    material_presence_source: 'loaded_runtime_field',
    component_or_task_declaration_status: options.componentStatus ?? 'unknown',
    component_or_task_declaration_source: options.componentStatus === 'supplied' ? 'loaded_runtime_field' : 'not_loaded',
    media_readiness_state: options.mediaState ?? 'ready',
    media_duration_seconds: options.duration ?? null,
    duration_confidence: options.duration ? 'known' : 'unknown',
    resolver_output_available: options.resolver ?? true,
    truth_state_map_available: options.truth ?? true,
    metadata_overrides: options.metadataOverrides,
    raw_report_data: { report_data: { timestamped_notes: [{ timestamp: '00:12', note: 'Forbidden downstream note' }], fix_first: 'Forbidden raw report field' } },
    root_dir: root,
    internal_qa_emit: true,
  } as any);
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: out.emitted_artefact_ids,
    emitted_blocked_artefact_ids: out.emitted_blocked_artefact_ids,
    artefact_source_classification_by_id: out.written ? { analysis_evidence_state: out.source_classification } : {},
    artefact_level2_spine_satisfaction_by_id: out.written ? { analysis_evidence_state: out.level2_satisfies } : {},
    analysis_evidence_state_summary: out.written ? out.summary : undefined,
  });
  const payloadPath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'analysis', 'AnalysisEvidenceState.json');
  const payload = out.written ? JSON.parse(await readFile(payloadPath, 'utf8')) : null;
  const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { root, run, take, out, payload, manifest, metrics };
}

async function emitPromotedEvidenceAnchorsBundle(options: {
  rawReport?: Record<string, unknown> | null;
  transformAnalysisEvidenceState?: (payload: any) => void;
  includePublicClaimTrace?: boolean;
} = {}) {
  const base = await emitAnalysisEvidenceStateBundle({ duration: 42 });
  if (options.transformAnalysisEvidenceState) options.transformAnalysisEvidenceState(base.payload);
  const anchorsOut = await emitEvidenceAnchorsFirstPass({
    run_id: base.run,
    analysis_run_id: base.run,
    submission_id: 'sub1',
    take_id: base.take,
    source_module: 'test',
    source_stage: 'unit',
    analysis_evidence_state_data: base.payload,
    raw_report_data: options.rawReport === undefined ? null : options.rawReport,
    root_dir: base.root,
    internal_qa_emit: true,
  });
  const anchorsPath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'EvidenceAnchors.json');
  const anchors = anchorsOut.written ? JSON.parse(await readFile(anchorsPath, 'utf8')) : null;
  let claimsOut: any = null;
  let claims: any = null;
  if (options.includePublicClaimTrace) {
    claimsOut = await emitPublicClaimTraceFirstPass({
      run_id: base.run,
      analysis_run_id: base.run,
      submission_id: 'sub1',
      take_id: base.take,
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { report_data: { strengths: ['grounded acting'] } },
      evidence_anchors_data: anchors,
      root_dir: base.root,
      internal_qa_emit: true,
    });
    const claimsPath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'PublicClaimTrace.json');
    claims = claimsOut.written ? JSON.parse(await readFile(claimsPath, 'utf8')) : null;
  }
  await emitQAManifestForAnalysisRun({
    run_id: base.run,
    analysis_run_id: base.run,
    take_id: base.take,
    submission_id: 'sub1',
    root_dir: base.root,
    internal_qa_emit: true,
    emitted_artefact_ids: [...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut?.written ? ['public_claim_trace'] : [])],
    emitted_blocked_artefact_ids: base.out.emitted_blocked_artefact_ids,
    artefact_source_classification_by_id: {
      analysis_evidence_state: base.out.source_classification,
      ...(anchorsOut.written ? { evidence_anchors: anchorsOut.source_classification } : {}),
      ...(claimsOut?.written ? { public_claim_trace: 'legacy_adapter' } : {}),
    },
    artefact_level2_spine_satisfaction_by_id: {
      analysis_evidence_state: false,
      ...(anchorsOut.written ? { evidence_anchors: false } : {}),
      ...(claimsOut?.written ? { public_claim_trace: false } : {}),
    },
    evidence_anchor_trace_summary: anchorsOut.written ? anchorsOut.evidence_anchor_trace_summary : undefined,
    analysis_evidence_state_summary: base.out.summary,
    public_claim_trace_summary: claimsOut?.summary,
    legacy_adapter_artefact_ids: claimsOut?.written ? ['public_claim_trace'] : [],
  });
  const manifest = JSON.parse(await readFile(path.join(base.root, base.run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(base.root, base.run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { ...base, anchorsOut, anchors, claimsOut, claims, manifest, metrics };
}

describe('S9-14A legacy containment and current-state guardrail', () => {
  it('keeps legacy EvidenceAnchors emitted but non-satisfying', async () => {
    const { anchors, manifest, metrics } = await emitLegacyBundle();
    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted');
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_trace_status).toBe('emitted');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('legacy_or_non_v3_support_only');
    expect(anchors.cannot_satisfy_v3_evidence_anchor_gate).toBe(true);
    expect(anchors.anchors.every((anchor: any) => anchor.cannot_satisfy_v3_gate === true)).toBe(true);
    expect(anchors.blocker_codes).toEqual(expect.arrayContaining(['legacy_snapshot_insufficient_for_v3_evidence_anchor_gate']));
  });

  it('prevents raw_report-only EvidenceAnchors from becoming real_runtime_v3', async () => {
    const { anchors, manifest, metrics } = await emitLegacyBundle({
      manifestSource: { evidence_anchors: 'legacy_adapter' },
      manifestLevel2: { evidence_anchors: true },
      acceptedIds: ['evidence_anchors'],
      realV3Ids: ['evidence_anchors'],
    });
    expect(anchors.anchors.every((anchor: any) => anchor.source_artefact_id === 'raw_report')).toBe(true);
    expect(anchors.anchors.every((anchor: any) => String(anchor.source_path).startsWith('report_data.timestamped_notes'))).toBe(true);
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).not.toBe('real_runtime_v3');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('evidence_anchors');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(anchors.anchors[0].cannot_satisfy_v3_gate).toBe(true);
  });

  it('keeps EvidenceAnchors without TruthStateMap linkage non-satisfying', async () => {
    const { anchors, manifest, metrics } = await emitLegacyBundle();
    expect(anchors.anchors[0].linked_truth_state_ids).toEqual([]);
    expect(anchors.anchors[0].blocker_codes).toEqual(expect.arrayContaining(['missing_truth_state_linkage']));
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).not.toBe('real_runtime_v3');
  });

  it('keeps EvidenceAnchors without resolver or Step 1 provenance out of accepted gate evidence', async () => {
    const { anchors, manifest } = await emitLegacyBundle();
    expect(anchors.source_stage).toBe('unit');
    expect(anchors.gate_satisfaction_reason).toBe('legacy_report_snapshot_only');
    expect(anchors.anchors[0].assessability_limitations).toContain('legacy_report_snapshot_not_v3_multimodal');
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('evidence_anchors');
    expect(manifest.runtime_evidence_blocked_by_id).toContain('evidence_anchors');
  });

  it('does not let caller payload override canonical EvidenceAnchors metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914a-meta-'));
    const run = 'run-s914a-meta';
    const out = await emitEvidenceAnchorsFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      root_dir: root,
      internal_qa_emit: true,
      raw_report_data: {
        schema_version: 'attacker_schema',
        artefact_type: 'accepted_gate_evidence',
        run_id: 'wrong-run',
        analysis_run_id: 'wrong-analysis',
        internal_only: false,
        privacy_classification: 'public',
        source_classification: 'real_runtime_v3',
        cannot_satisfy_v3_gate: false,
        blocker_codes: [],
        timestamped_notes: [{ timestamp: '00:11', note: 'Legacy note' }],
      },
    } as any);
    expect(out.source_classification).toBe('legacy_adapter');
    expect(out.level2_satisfies).toBe(false);
    const payload = JSON.parse(await readFile(path.join(root, run, 'takes', 'take-t1', `analysis-${run}`, 'traces', 'EvidenceAnchors.json'), 'utf8'));
    expect(payload.schema_version).toBe('tapecoach_v3_evidence_anchors_first_pass_v1');
    expect(payload.artefact_type).toBe('evidence_anchors');
    expect(payload.run_id).toBe(run);
    expect(payload.analysis_run_id).toBe(run);
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.cannot_satisfy_v3_evidence_anchor_gate).toBe(true);
    expect(payload.blocker_codes).toContain('legacy_snapshot_insufficient_for_v3_evidence_anchor_gate');
  });

  it('keeps legacy PublicClaimTrace emitted but non-satisfying', async () => {
    const { claims, manifest, metrics } = await emitLegacyBundle();
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted');
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_trace_status).toBe('emitted');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_reason).toBe('legacy_or_unsupported_claim_support_only');
  });

  it('keeps public claims with no evidence anchor support blocked for rewrite', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { strengths: ['grounded acting'] } });
    const claim = claims.claims.find((entry: any) => entry.claim_text === 'grounded acting');
    expect(claim.linked_evidence_anchor_ids).toEqual([]);
    expect(['missing_evidence', 'blocked']).toContain(claim.support_status);
    expect(claim.blocker_codes).toContain('missing_evidence_anchor_support');
    expect(claim.rewrite_required).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps unsupported overclaims rewrite_required and unsupported', async () => {
    const { claims } = await emitLegacyBundle({ report: { casting_headline: 'Perfect match for this role' } });
    const claim = claims.claims.find((entry: any) => entry.source_path === 'report_data.casting_headline');
    expect(['unsafe_or_overclaim', 'needs_rewrite']).toContain(claim.public_safety_status);
    expect(claim.rewrite_required).toBe(true);
    expect(claim.support_status).not.toBe('supported_by_evidence_anchor');
    expect(claim.blocker_codes).toContain('unsupported_overclaim_requires_rewrite');
  });

  it('keeps score claims public_scoring_blocked', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { overall_score: 92, improvements: ['readiness score 92'] } });
    const overallScore = claims.claims.find((entry: any) => entry.source_path === 'report_data.overall_score');
    const scoreWording = claims.claims.find((entry: any) => entry.claim_text === 'readiness score 92');
    expect(overallScore.claim_type).toBe('score_or_verdict');
    expect(overallScore.score_scope).toBe('overall_readiness');
    expect(overallScore.blocker_codes).toContain('public_scoring_blocked');
    expect(scoreWording.blocker_codes).toContain('public_scoring_blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps public technique authority claims blocked from gate satisfaction', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { strengths: ['professional standard technique authority'] } });
    const claim = claims.claims.find((entry: any) => entry.claim_text === 'professional standard technique authority');
    expect(claim.public_safety_status).toBe('unsafe_or_overclaim');
    expect(claim.rewrite_required).toBe(true);
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps castability bookability and marketability wording blocked or rewrite_required', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { casting_headline: 'Bookable and marketable casting choice' } });
    const claim = claims.claims.find((entry: any) => entry.source_path === 'report_data.casting_headline');
    expect(claim.rewrite_required).toBe(true);
    expect(claim.support_status).not.toBe('supported_by_evidence_anchor');
    expect(['needs_rewrite', 'unsafe_or_overclaim', 'blocked']).toContain(claim.public_safety_status);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps public comparison winner or recommendation wording blocked from public claim satisfaction', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { category_notes: ['Take 2 is the winner and recommended over Take 1'] } });
    const claim = claims.claims.find((entry: any) => entry.claim_text === 'Take 2 is the winner and recommended over Take 1');
    expect(claim.rewrite_required).toBe(true);
    expect(claim.support_status).not.toBe('supported_by_evidence_anchor');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(metrics.public_output_unchanged).toBe(true);
  });

  it('aligns manifest and qa_acceptance_metrics for legacy containment', async () => {
    const { manifest, metrics, claims } = await emitLegacyBundle();
    expect(metrics.evidence_anchor_source_family_summary.legacy_adapter).toBe(1);
    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBe(0);
    expect(metrics.public_claim_trace_summary).toMatchObject(claimsOutSummary(claims));
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('does not treat emitted trace artefacts as satisfying or accepted gate evidence', async () => {
    const { manifest, metrics } = await emitLegacyBundle();
    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted');
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(metrics.runtime_evidence_accepted_by_id).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
  });

  it('keeps malformed legacy anchors or claims from crashing finalisation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914a-malformed-'));
    const run = 'run-s914a-malformed';
    const anchors = await emitEvidenceAnchorsFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { timestamped_notes: [null, {}, { note: '' }] },
      root_dir: root,
      internal_qa_emit: true,
    });
    const claims = await emitPublicClaimTraceFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { strengths: [null, '', 1] },
      evidence_anchors_data: { anchors: [{ source_family: 'legacy_adapter' }] },
      root_dir: root,
      internal_qa_emit: true,
    } as any);
    expect(anchors.written).toBe(false);
    expect(claims.written).toBe(false);
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 't1',
      submission_id: 'sub1',
      root_dir: root,
      internal_qa_emit: true,
      emitted_blocked_artefact_ids: ['evidence_anchors', 'public_claim_trace'],
      artefact_source_classification_by_id: { evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: true, public_claim_trace: true },
      runtime_evidence_accepted_by_id: ['evidence_anchors', 'public_claim_trace'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted_blocked');
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted_blocked');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('prevents source_scaffold helper and local fixture classifications from satisfying gates', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914a-scaffold-'));
    const run = 'run-s914a-scaffold';
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 't1',
      submission_id: 'sub1',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['evidence_anchors', 'public_claim_trace'],
      artefact_source_classification_by_id: { evidence_anchors: 'source_scaffold', public_claim_trace: 'helper_test' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: true, public_claim_trace: true },
      runtime_evidence_accepted_by_id: ['evidence_anchors', 'public_claim_trace'],
      real_v3_spine_artefact_ids: ['evidence_anchors', 'public_claim_trace'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(manifest.real_v3_spine_artefact_ids).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps global Level 2 public and production gates blocked', async () => {
    const { manifest, metrics } = await emitLegacyBundle();
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });
});

describe('S9-14C Step 1 observable evidence extractor', () => {
  it('emits AnalysisEvidenceState from input resolver truth and media artefact refs', async () => {
    const { payload, manifest, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(payload.artefact_type).toBe('analysis_evidence_state');
    expect(payload.schema_version).toBe('tapecoach_v3_analysis_evidence_state_v1');
    expect(payload.run_id).toBe(manifest.run_id);
    expect(payload.analysis_run_id).toBe(manifest.analysis_run_id);
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.input_artifact_refs.analysis_input_record).toContain('/inputs/input_record.json');
    expect(payload.input_artifact_refs.analysis_submission).toContain('/inputs/submission.json');
    expect(payload.input_artifact_refs.analysis_take).toContain('/inputs/take.json');
    expect(payload.resolver_output_ref).toContain('/resolver/resolver_output.json');
    expect(payload.truth_state_map_ref).toContain('/resolver/TruthStateMap.json');
    expect(payload.media_readiness_summary).toMatchObject({ media_readiness_state: 'ready' });
    expect(manifest.artefact_status_by_id.analysis_evidence_state).toBe('emitted_blocked');
    expect(manifest.artefact_source_classification_by_id.analysis_evidence_state).toBe('real_runtime_v3');
    expect(metrics.analysis_evidence_state_status).toBe('emitted_blocked');
  });

  it('does not derive AnalysisEvidenceState from raw_report or report_data snapshots', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle();
    expect(JSON.stringify(payload)).not.toContain('report_data.timestamped_notes');
    expect(JSON.stringify(payload)).not.toContain('Forbidden raw report field');
    expect(payload.observable_evidence_items.some((item: any) => item.source_artefact_id === 'raw_report')).toBe(false);
    expect(payload.observable_evidence_items.some((item: any) => String(item.source_path ?? '').startsWith('report_data'))).toBe(false);
  });

  it('records TruthStateMap known component and comparison truths without fake truth IDs', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle();
    const truthItems = payload.observable_evidence_items.filter((item: any) => item.source_artefact_id === 'truth_state_map');
    expect(truthItems.map((item: any) => item.evidence_kind)).toEqual(expect.arrayContaining(['known_truths', 'component_truths', 'comparison_truths']));
    expect(truthItems.every((item: any) => Array.isArray(item.linked_truth_state_ids) && item.linked_truth_state_ids.length === 0)).toBe(true);
    expect(payload.blocker_codes).toContain('structured_truth_state_ids_unavailable');
    expect(truthItems.some((item: any) => item.assessability_limitations.includes('structured_truth_state_ids_unavailable_in_current_truth_map_schema'))).toBe(true);
  });

  it('does not invent performance observations when no persisted extractor exists', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle();
    const performanceKinds = ['acting_performance', 'vocal_performance', 'movement_performance', 'technique_observation'];
    expect(payload.observable_evidence_items.some((item: any) => performanceKinds.includes(item.evidence_kind))).toBe(false);
    expect(payload.unsupported_or_unavailable_evidence.map((item: any) => item.evidence_kind)).toEqual(expect.arrayContaining([
      'video_observable_performance_evidence_not_extracted',
      'audio_observable_performance_evidence_not_extracted',
      'material_specific_performance_evidence_not_extracted',
    ]));
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
  });

  it('keeps candidate brief evidence to presence facts only', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ briefPresence: 'supplied', materialPresence: 'supplied' });
    const serialised = JSON.stringify(payload.candidate_brief_evidence).toLowerCase();
    expect(payload.candidate_brief_evidence.length).toBeGreaterThan(0);
    expect(serialised).toContain('brief presence only');
    expect(serialised).not.toContain('brief achievement');
    expect(serialised).not.toContain('role fit');
    expect(serialised).not.toContain('casting suitability');
  });

  it('keeps candidate technique evidence unavailable when only legacy traces exist', async () => {
    const { payload, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(payload.candidate_technique_evidence).toEqual([]);
    expect(payload.unsupported_or_unavailable_evidence.map((item: any) => item.evidence_kind)).toContain('candidate_technique_evidence_not_extracted');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('truthfully records unknown component or task declaration', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ componentStatus: 'unknown' });
    expect(payload.component_evidence[0]).toMatchObject({
      component_id: 'component_or_task_declaration',
      status: 'unknown',
      source_artefact_id: 'analysis_submission',
      source_path: 'component_or_task_declaration_status',
    });
    expect(payload.component_evidence[0].blocker_codes).toContain('component_or_task_declaration_unknown');
  });

  it('records selected_level audition_type and brief presence from runtime inputs or resolver', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ selectedLevel: 'professional', auditionType: 'song', briefPresence: 'supplied' });
    const selectedLevel = payload.observable_evidence_items.find((item: any) => item.evidence_kind === 'selected_level');
    const auditionType = payload.observable_evidence_items.find((item: any) => item.evidence_kind === 'audition_type');
    const briefPresence = payload.observable_evidence_items.find((item: any) => item.evidence_kind === 'brief_presence');
    expect(selectedLevel).toMatchObject({ source_artefact_id: 'analysis_submission', source_path: 'selected_level' });
    expect(auditionType).toMatchObject({ source_artefact_id: 'analysis_submission', source_path: 'audition_type' });
    expect(briefPresence).toMatchObject({ source_artefact_id: 'resolver_output', source_path: 'brief_presence' });
    expect(JSON.stringify(payload)).not.toContain('report_data');
  });

  it('records stable take identity from analysis_take without unsafe media refs', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle();
    const identity = payload.observable_evidence_items.find((item: any) => item.evidence_kind === 'stable_take_identity');
    expect(identity).toMatchObject({ source_artefact_id: 'analysis_take', source_path: 'stable_take_identity' });
    const serialized = JSON.stringify(identity).toLowerCase();
    expect(serialized).not.toContain('http://');
    expect(serialized).not.toContain('https://');
  });

  it('records partial real_runtime_v3 runtime facts but keeps the Step 1 gate non-satisfying', async () => {
    const { payload, manifest, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(payload.source_classification).toBe('real_runtime_v3');
    expect(payload.evidence_state_status).toBe('partial');
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
    expect(payload.observable_evidence_items.length).toBeGreaterThan(0);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.analysis_evidence_state).toBe(false);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
    expect(metrics.analysis_evidence_state_gate_reason).toBe('partial_runtime_facts_present_but_performance_extractor_unavailable');
  });

  it('does not fake real_runtime_v3 Step 1 classification without a genuine source', async () => {
    const { payload, manifest } = await emitAnalysisEvidenceStateBundle({
      metadataOverrides: {
        source_classification: 'real_runtime_v3',
        cannot_satisfy_v3_gate: false,
        blocker_codes: [],
      },
    });
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.analysis_evidence_state).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('analysis_evidence_state');
  });

  it('records media readiness and resolver/truth refs safely without URL or token leakage', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ duration: 42 });
    expect(payload.resolver_output_ref).toContain('/resolver/resolver_output.json');
    expect(payload.truth_state_map_ref).toContain('/resolver/TruthStateMap.json');
    expect(payload.media_readiness_summary.media_readiness_state).toBe('ready');
    expect(payload.media_readiness_summary.media_duration_seconds).toBe(42);
    const serialized = JSON.stringify(payload).toLowerCase();
    expect(serialized).not.toContain('http://');
    expect(serialized).not.toContain('https://');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('signed');
  });

  it('blocks satisfaction when resolver_output is missing', async () => {
    const { payload, manifest, metrics } = await emitAnalysisEvidenceStateBundle({ resolver: false });
    expect(payload.resolver_output_ref).toBeNull();
    expect(payload.blocker_codes).toContain('resolver_output_missing');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.analysis_evidence_state).toBe(false);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
  });

  it('blocks satisfaction when TruthStateMap is missing', async () => {
    const { payload, metrics } = await emitAnalysisEvidenceStateBundle({ truth: false });
    expect(payload.truth_state_map_ref).toBeNull();
    expect(payload.blocker_codes).toContain('TruthStateMap_missing');
    expect(payload.observable_evidence_items.some((item: any) => item.blocker_codes.includes('TruthStateMap_missing'))).toBe(true);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
  });

  it('truthfully records missing media readiness duration without padded timestamps', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ duration: null, mediaState: null });
    expect(payload.media_readiness_summary.media_duration_seconds).toBeNull();
    expect(payload.media_readiness_summary.duration_confidence).toBe('unknown');
    expect(payload.media_readiness_summary.timestamp_source).toBe('unavailable');
    expect(payload.assessability_limitations).toContain('media_duration_unavailable_no_timestamp_evidence_fabricated');
    expect(payload.observable_evidence_items.some((item: any) => item.blocker_codes.includes('media_duration_unavailable'))).toBe(true);
  });

  it('does not let caller metadata override canonical AnalysisEvidenceState fields', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({
      metadataOverrides: {
        schema_version: 'attacker',
        artefact_type: 'accepted_gate_evidence',
        run_id: 'wrong',
        analysis_run_id: 'wrong',
        internal_only: false,
        privacy_classification: 'public',
        source_classification: 'real_runtime_v3',
        blocker_codes: [],
      },
    });
    expect(payload.schema_version).toBe('tapecoach_v3_analysis_evidence_state_v1');
    expect(payload.artefact_type).toBe('analysis_evidence_state');
    expect(payload.run_id).not.toBe('wrong');
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.source_classification).toBe('real_runtime_v3');
    expect(payload.blocker_codes).toContain('analysis_evidence_state_partial_runtime_facts_only');
  });

  it('does not crash on partial prerequisite input and preserves blockers', async () => {
    const { out, payload, manifest } = await emitAnalysisEvidenceStateBundle({ run: 'run-s914b-malformed', take: 't1', resolver: false, truth: false, duration: null });
    expect(out.written).toBe(true);
    expect(payload.blocker_codes).toEqual(expect.arrayContaining(['resolver_output_missing', 'TruthStateMap_missing', 'media_duration_unavailable']));
    expect(manifest.artefact_status_by_id.analysis_evidence_state).toBe('emitted_blocked');
  });

  it('keeps EvidenceAnchors legacy after AnalysisEvidenceState emits', async () => {
    const { manifest, metrics } = await emitLegacyBundle({ includeAnalysisEvidenceState: true });
    expect(manifest.artefact_source_classification_by_id.analysis_evidence_state).toBe('real_runtime_v3');
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('keeps PublicClaimTrace legacy and non-satisfying after AnalysisEvidenceState emits', async () => {
    const { claims, manifest, metrics } = await emitLegacyBundle({ includeAnalysisEvidenceState: true });
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('aligns manifest and qa_acceptance_metrics for AnalysisEvidenceState status and blockers', async () => {
    const { manifest, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(metrics.analysis_evidence_state_status).toBe(manifest.artefact_status_by_id.analysis_evidence_state);
    expect(metrics.analysis_evidence_state_source_classification).toBe(manifest.artefact_source_classification_by_id.analysis_evidence_state);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
    expect(metrics.blocker_codes).toContain('AnalysisEvidenceState_missing');
  });

  it('keeps global gates blocked', async () => {
    const { manifest, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('does not change public output posture', async () => {
    const { payload, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(payload.public_output_unchanged).toBe(true);
    expect(metrics.public_output_unchanged).toBe(true);
    expect(metrics.public_scoring_status).toBe('blocked');
  });
});

describe('S9-14D EvidenceAnchors real_runtime_v3 promotion', () => {
  it('promotes AnalysisEvidenceState observable evidence items to real_runtime_v3 anchors', async () => {
    const { payload, anchors } = await emitPromotedEvidenceAnchorsBundle();
    const selectedLevel = anchors.anchors.find((anchor: any) => anchor.evidence_text === 'selected_level: advanced');
    expect(selectedLevel).toMatchObject({
      source_artefact_id: 'analysis_evidence_state',
      source_path: 'observable_evidence_items[0]',
      source_family: 'real_runtime_v3',
      source_classification: 'real_runtime_v3',
      cannot_satisfy_v3_gate: false,
    });
    expect(payload.observable_evidence_items[0].safe_evidence_summary).toBe(selectedLevel.evidence_text);
  });

  it('promotes selected_level and audition_type as factual deterministic anchors', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const texts = anchors.anchors.map((anchor: any) => anchor.evidence_text);
    expect(texts).toEqual(expect.arrayContaining(['selected_level: advanced', 'audition_type: monologue']));
    expect(JSON.stringify(anchors).toLowerCase()).not.toContain('raw_report');
    expect(JSON.stringify(anchors).toLowerCase()).not.toContain('report_data');
    const selectedAndAudition = anchors.anchors.filter((anchor: any) => ['selected_level: advanced', 'audition_type: monologue'].includes(anchor.evidence_text));
    expect(JSON.stringify(selectedAndAudition).toLowerCase()).not.toContain('readiness judgement');
  });

  it('promotes stable take identity and media readiness facts with safe refs only', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const identity = anchors.anchors.find((anchor: any) => anchor.evidence_text.includes('stable_take_identity'));
    const media = anchors.anchors.find((anchor: any) => anchor.evidence_text.includes('media_readiness_state'));
    expect(identity).toMatchObject({ source_artefact_id: 'analysis_evidence_state', source_family: 'real_runtime_v3' });
    expect(media).toMatchObject({ evidence_modality: 'media_readiness', source_family: 'real_runtime_v3' });
    const serialised = JSON.stringify([identity, media]).toLowerCase();
    expect(serialised).not.toContain('http://');
    expect(serialised).not.toContain('https://');
    expect(serialised).not.toContain('token');
    expect(serialised).not.toContain('signed');
  });

  it('promotes brief and material presence without achievement or suitability claims', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const briefAnchors = anchors.anchors.filter((anchor: any) => String(anchor.evidence_text).includes('presence'));
    const serialised = JSON.stringify(briefAnchors).toLowerCase();
    expect(serialised).toContain('brief_presence: supplied');
    expect(serialised).toContain('material_presence: supplied');
    expect(serialised).not.toContain('brief achievement');
    expect(serialised).not.toContain('role fit');
    expect(serialised).not.toContain('casting suitability');
  });

  it('promotes component declaration status as a fact or limitation only', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const component = anchors.anchors.find((anchor: any) => anchor.source_path === 'component_evidence[0]');
    expect(component).toMatchObject({
      source_artefact_id: 'analysis_evidence_state',
      source_path: 'component_evidence[0]',
      source_classification: 'real_runtime_v3_blocked',
      cannot_satisfy_v3_gate: true,
    });
    expect(component.blocker_codes).toContain('component_or_task_declaration_unknown');
    expect(String(component.evidence_text).toLowerCase()).not.toContain('performance');
  });

  it('records TruthStateMap anchors as blocked when structured truth IDs are unavailable', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const truthAnchors = anchors.anchors.filter((anchor: any) => anchor.evidence_modality === 'resolver_truth');
    expect(truthAnchors.length).toBeGreaterThan(0);
    expect(truthAnchors.every((anchor: any) => anchor.source_artefact_id === 'analysis_evidence_state')).toBe(true);
    expect(truthAnchors.every((anchor: any) => anchor.cannot_satisfy_v3_gate === true)).toBe(true);
    expect(truthAnchors.some((anchor: any) => anchor.blocker_codes.includes('missing_truth_state_linkage'))).toBe(true);
  });

  it('keeps raw_report timestamped notes as legacy_adapter even beside promoted anchors', async () => {
    const { anchors, manifest, metrics } = await emitPromotedEvidenceAnchorsBundle({
      rawReport: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy report note' }] } },
    });
    const legacy = anchors.anchors.find((anchor: any) => anchor.source_artefact_id === 'raw_report');
    expect(legacy).toMatchObject({ source_family: 'legacy_adapter', cannot_satisfy_v3_gate: true });
    expect(anchors.anchors.some((anchor: any) => anchor.source_artefact_id === 'raw_report' && anchor.source_classification === 'real_runtime_v3')).toBe(false);
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('mixed_real_and_legacy_non_satisfying');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('does not promote a legacy report snapshot because public_safe is true', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle({
      rawReport: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy public-safe note', public_safe: true }] } },
    });
    const legacy = anchors.anchors.find((anchor: any) => anchor.evidence_text === 'Legacy public-safe note');
    expect(legacy.public_safe).toBe(true);
    expect(legacy.source_family).toBe('legacy_adapter');
    expect(legacy.cannot_satisfy_v3_gate).toBe(true);
  });

  it('blocks promotion when the AnalysisEvidenceState source path is unresolved', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle({
      transformAnalysisEvidenceState(payload) {
        payload.observable_evidence_items[0].analysis_evidence_state_source_path = 'observable_evidence_items[99]';
      },
    });
    const blocked = anchors.anchors.find((anchor: any) => anchor.source_path === 'observable_evidence_items[99]');
    expect(blocked.cannot_satisfy_v3_gate).toBe(true);
    expect(blocked.blocker_codes).toContain('analysis_evidence_state_source_path_unresolved');
    expect(blocked.source_classification).toBe('real_runtime_v3_blocked');
  });

  it('blocks cross-run AnalysisEvidenceState promotion', async () => {
    const { anchorsOut } = await emitPromotedEvidenceAnchorsBundle({
      transformAnalysisEvidenceState(payload) {
        payload.run_id = 'other-run';
      },
    });
    expect(anchorsOut.written).toBe(false);
    expect(anchorsOut.source_classification).toBe('missing');
  });

  it('blocks truth-linked anchors when linked_truth_state_ids are unavailable', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const knownTruths = anchors.anchors.find((anchor: any) => anchor.evidence_modality === 'resolver_truth' && anchor.evidence_text.includes('known runtime truth'));
    expect(knownTruths.linked_truth_state_ids).toEqual([]);
    expect(knownTruths.cannot_satisfy_v3_gate).toBe(true);
    expect(knownTruths.blocker_codes).toContain('missing_truth_state_linkage');
  });

  it('blocks fabricated evidence text that is not supported by the source path', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle({
      transformAnalysisEvidenceState(payload) {
        payload.observable_evidence_items[0].safe_evidence_summary = 'fabricated unsupported claim from nowhere';
        payload.observable_evidence_items[0].source_artefact_id = 'raw_report';
      },
    });
    const fabricated = anchors.anchors.find((anchor: any) => anchor.evidence_text === 'fabricated unsupported claim from nowhere');
    expect(fabricated.cannot_satisfy_v3_gate).toBe(true);
    expect(fabricated.blocker_codes).toContain('forbidden_report_snapshot_source_ref');
  });

  it('keeps source_scaffold helper and local fixture classifications non-satisfying', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914d-scaffold-'));
    const run = 'run-s914d-scaffold';
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 't1',
      submission_id: 'sub1',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['evidence_anchors'],
      artefact_source_classification_by_id: { evidence_anchors: 'source_scaffold' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: true },
      runtime_evidence_accepted_by_id: ['evidence_anchors'],
      real_v3_spine_artefact_ids: ['evidence_anchors'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('evidence_anchors');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('does not turn unavailable extractor families into satisfying anchors', async () => {
    const { anchors, metrics } = await emitPromotedEvidenceAnchorsBundle();
    const serialised = JSON.stringify(anchors.anchors);
    expect(serialised).not.toContain('video_observable_performance_evidence_not_extracted');
    expect(serialised).not.toContain('candidate_technique_evidence_not_extracted');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('partial_runtime_facts_present_but_performance_extractor_unavailable');
  });

  it('does not use legacy TechniqueObservationTrace for candidate technique anchors', async () => {
    const { anchors, metrics } = await emitPromotedEvidenceAnchorsBundle();
    expect(anchors.anchors.some((anchor: any) => anchor.source_artefact_id === 'technique_observation_trace')).toBe(false);
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('keeps mixed real and legacy anchors aggregate insufficient', async () => {
    const { anchors, metrics } = await emitPromotedEvidenceAnchorsBundle({
      rawReport: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy report note' }] } },
    });
    expect(anchors.blocker_codes).toContain('mixed_evidence_anchor_source_families');
    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBeGreaterThan(0);
    expect(metrics.evidence_anchor_source_family_summary.legacy_adapter).toBe(1);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('classifies deterministic anchors as real_runtime_v3 while aggregate remains insufficient for partial Step 1 coverage', async () => {
    const { anchors, manifest, metrics } = await emitPromotedEvidenceAnchorsBundle();
    expect(anchors.real_runtime_anchor_count).toBeGreaterThan(0);
    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBeGreaterThan(0);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('partial_runtime_facts_present_but_performance_extractor_unavailable');
  });

  it('does not let caller metadata override canonical promoted EvidenceAnchors fields', async () => {
    const { anchors, run } = await emitPromotedEvidenceAnchorsBundle({
      transformAnalysisEvidenceState(payload) {
        payload.schema_version = 'attacker';
        payload.artefact_type = 'accepted_gate_evidence';
        payload.internal_only = false;
        payload.privacy_classification = 'public';
      },
    });
    expect(anchors.schema_version).toBe('tapecoach_v3_evidence_anchors_runtime_v1');
    expect(anchors.artefact_type).toBe('evidence_anchors');
    expect(anchors.run_id).toBe(run);
    expect(anchors.internal_only).toBe(true);
    expect(anchors.privacy_classification).toBe('internal_private');
    expect(anchors.cannot_satisfy_v3_evidence_anchor_gate).toBe(true);
  });

  it('aligns manifest and qa_acceptance_metrics for deterministic anchor promotion', async () => {
    const { manifest, metrics, anchors } = await emitPromotedEvidenceAnchorsBundle();
    expect(metrics.evidence_anchor_trace_status).toBe(manifest.artefact_status_by_id.evidence_anchors);
    expect(metrics.evidence_anchor_source_family_summary).toEqual(anchors.evidence_anchor_trace_summary.source_family_summary);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
  });

  it('keeps PublicClaimTrace legacy and non-satisfying after EvidenceAnchors promotion', async () => {
    const { claims, manifest, metrics } = await emitPromotedEvidenceAnchorsBundle({ includePublicClaimTrace: true });
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps global gates blocked after EvidenceAnchors promotion', async () => {
    const { manifest, metrics } = await emitPromotedEvidenceAnchorsBundle();
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('does not change public output posture after EvidenceAnchors promotion', async () => {
    const { anchors, metrics } = await emitPromotedEvidenceAnchorsBundle();
    expect(anchors.public_output_unchanged ?? true).toBe(true);
    expect(metrics.public_output_unchanged).toBe(true);
  });

  it('does not crash on malformed AnalysisEvidenceState input', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914d-malformed-'));
    const out = await emitEvidenceAnchorsFirstPass({
      run_id: 'run-s914d-malformed',
      analysis_run_id: 'run-s914d-malformed',
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      analysis_evidence_state_data: { run_id: 'run-s914d-malformed', analysis_run_id: 'run-s914d-malformed', observable_evidence_items: [null, {}, { safe_evidence_summary: '' }] },
      root_dir: root,
      internal_qa_emit: true,
    } as any);
    expect(out.written).toBe(true);
    expect(out.source_classification).toBe('real_runtime_v3_partial_non_satisfying');
    expect(out.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
  });
});

function claimsOutSummary(claims: any) {
  return {
    claim_count: claims.claim_count,
    unsupported_claim_count: claims.unsupported_claim_count,
    legacy_untraced_claim_count: claims.legacy_untraced_claim_count,
    unsafe_or_overclaim_count: claims.unsafe_or_overclaim_count,
    rewrite_required_count: claims.rewrite_required_count,
  };
}
