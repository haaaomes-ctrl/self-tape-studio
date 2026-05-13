import { access, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 public claim trace first pass', () => {
  it('emits from legacy raw_report claim fields and flags unsafe/unsupported claims', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906c-'));
    const run = 'run-s906c'; const take = 't1';
    const report = {
      schema_version: 'v1-legacy',
      verdict_final: '88',
      casting_headline: 'Perfect match for this role',
      strengths: ['strong presence', 'great energy'],
      fix_first: 'send with confidence',
      timestamped_notes: [{ timestamp: '00:10', note: 'fits the brief perfectly' }],
    };
    await emitRawReportArtefact({ run_id: run, take_id: take, submission_id: 'sub1', source_stage: 'unit', source_module: 'test', report_data: report, root_dir: root, internal_qa_emit: true });
    const anchors = await emitEvidenceAnchorsFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: report, root_dir: root, internal_qa_emit: true });
    expect(anchors.written).toBe(true);
    const evidence = JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'EvidenceAnchors.json'), 'utf8'));
    const out = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: report, evidence_anchors_data: evidence, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(true);
    const trace = JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'PublicClaimTrace.json'), 'utf8'));
    expect(trace.artefact_type).toBe('public_claim_trace');
    expect(trace.internal_only).toBe(true);
    expect(trace.claim_count).toBeGreaterThan(0);
    expect(trace.cannot_satisfy_public_claim_gate).toBe(true);
    expect(trace.claims.every((c: any) => c.source_family === 'legacy_adapter')).toBe(true);
    expect(trace.claims.some((c: any) => c.public_safety_status === 'unsafe_or_overclaim')).toBe(true);
    expect(trace.claims.some((c: any) => c.claim_type === 'score_or_verdict' && (c.public_safety_status === 'blocked' || c.public_safety_status === 'internal_only'))).toBe(true);

    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report', 'evidence_anchors', 'public_claim_trace'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter', evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false, public_claim_trace: false }, legacy_adapter_artefact_ids: ['raw_report', 'evidence_anchors', 'public_claim_trace'] });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted');
    expect(manifest.missing_artifacts).not.toContain('public_claim_trace');
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(metrics.missing_required_artefacts).not.toContain('public_claim_trace');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.gf01_rt15_status).toBe('blocked');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('does not emit when no claim source exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906c-none-'));
    const out = await emitPublicClaimTraceFirstPass({ run_id: 'run-none', analysis_run_id: 'run-none', submission_id: 'sub1', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: {}, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(false);
    await expect(access(path.join(root, 'run-none', 'takes', 'take-t1', 'analysis-run-none', 'traces', 'PublicClaimTrace.json'))).rejects.toThrow();
  });
});
