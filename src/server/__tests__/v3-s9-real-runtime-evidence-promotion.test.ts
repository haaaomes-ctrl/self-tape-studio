import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

type LegacyBundleOptions = {
  run?: string;
  take?: string;
  report?: Record<string, unknown>;
  manifestSource?: Record<string, string>;
  manifestLevel2?: Record<string, boolean>;
  acceptedIds?: string[];
  blockedIds?: string[];
  realV3Ids?: string[];
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
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: ['raw_report', ...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut.written ? ['public_claim_trace'] : [])],
    artefact_source_classification_by_id: {
      raw_report: 'legacy_adapter',
      ...(anchorsOut.written ? { evidence_anchors: 'legacy_adapter' } : {}),
      ...(claimsOut.written ? { public_claim_trace: 'legacy_adapter' } : {}),
      ...(options.manifestSource ?? {}),
    },
    artefact_level2_spine_satisfaction_by_id: {
      raw_report: false,
      ...(anchorsOut.written ? { evidence_anchors: false } : {}),
      ...(claimsOut.written ? { public_claim_trace: false } : {}),
      ...(options.manifestLevel2 ?? {}),
    },
    legacy_adapter_artefact_ids: ['raw_report', ...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut.written ? ['public_claim_trace'] : [])],
    runtime_evidence_accepted_by_id: options.acceptedIds,
    runtime_evidence_blocked_by_id: options.blockedIds,
    real_v3_spine_artefact_ids: options.realV3Ids,
    public_claim_trace_summary: claimsOut.summary,
  });
  const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { root, run, take, report, anchorsOut, anchors, claimsOut, claims, manifest, metrics };
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

function claimsOutSummary(claims: any) {
  return {
    claim_count: claims.claim_count,
    unsupported_claim_count: claims.unsupported_claim_count,
    legacy_untraced_claim_count: claims.legacy_untraced_claim_count,
    unsafe_or_overclaim_count: claims.unsafe_or_overclaim_count,
    rewrite_required_count: claims.rewrite_required_count,
  };
}

