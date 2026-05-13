import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 trace manifest metrics integration', () => {
  it('emits both traces only when written and keeps gates insufficient for legacy-only traces', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906d-'));
    const run = 'run-s906d'; const take = 't1';
    const report = { schema_version: 'v1-legacy', verdict_final: '92', casting_headline: 'perfectly suits this role', timestamped_notes: [{ timestamp: '00:14', note: 'fits the brief perfectly' }], strengths: ['strong presence'] };
    await emitRawReportArtefact({ run_id: run, take_id: take, submission_id: 'sub1', source_stage: 'unit', source_module: 'test', report_data: report, root_dir: root, internal_qa_emit: true });
    const anchorsOut = await emitEvidenceAnchorsFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: report, root_dir: root, internal_qa_emit: true });
    const anchors = JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'EvidenceAnchors.json'), 'utf8'));
    const claimsOut = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: report, evidence_anchors_data: anchors, root_dir: root, internal_qa_emit: true });
    expect(anchorsOut.written).toBe(true);
    expect(claimsOut.written).toBe(true);

    await emitQAManifestForAnalysisRun({
      run_id: run, analysis_run_id: run, take_id: take, submission_id: 'sub1', root_dir: root, internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report', 'evidence_anchors', 'public_claim_trace'],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter', evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false, public_claim_trace: false },
      legacy_adapter_artefact_ids: ['raw_report', 'evidence_anchors', 'public_claim_trace'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));

    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted');
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted');
    expect(manifest.emitted_artifacts).toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(manifest.missing_artifacts).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));

    expect(metrics.required_artefact_counts.emitted).toBe(manifest.emitted_artifacts.length);
    expect(metrics.required_artefact_counts.missing).toBe(manifest.missing_artifacts.length);
    expect(metrics.emitted_artefacts).toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(metrics.missing_required_artefacts).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(metrics.evidence_anchor_trace_status).toBe('emitted');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.public_claim_trace_status).toBe('emitted');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.gf01_rt15_status).toBe('blocked');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('does not predeclare traces when they are not written', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906d-none-'));
    const run = 'run-s906d-none';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 't1', submission_id: 'sub1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false } });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    expect(manifest.emitted_artifacts).not.toContain('evidence_anchors');
    expect(manifest.emitted_artifacts).not.toContain('public_claim_trace');
    expect(manifest.artefact_status_by_id.evidence_anchors).not.toBe('emitted');
    expect(manifest.artefact_status_by_id.public_claim_trace).not.toBe('emitted');
  });
});
