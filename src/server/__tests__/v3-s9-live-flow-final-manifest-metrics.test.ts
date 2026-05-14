import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 live flow final manifest metrics', () => {
  it('writes final manifest and metrics after traces', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'v3-s9-final-'));
    const run = 'take-z1';
    await emitRawReportArtefact({ run_id: run, take_id: 'z1', submission_id: 's1', source_stage: 'test', source_module: 'test', internal_qa_emit: true, root_dir: root, report_data: { schema_version: 'v1-legacy', timestamped_notes: [{ timestamp: '00:01', note: 'Beat lands' }] } });
    const anchors = await emitEvidenceAnchorsFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's1', take_id: 'z1', source_stage: 'test', source_module: 'test', internal_qa_emit: true, root_dir: root, raw_report_data: { report_data: { timestamped_notes: [{ timestamp: '00:01', note: 'Beat lands' }] } } });
    const claims = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's1', take_id: 'z1', source_stage: 'test', source_module: 'test', internal_qa_emit: true, root_dir: root, raw_report_data: { report_data: { timestamped_notes: [{ timestamp: '00:01', note: 'Beat lands' }] } }, evidence_anchors_data: { anchors: anchors.anchors ?? [] } });
    const out = await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, submission_id: 's1', take_id: 'z1', take_ids: ['z1'], internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report', ...(anchors.written ? anchors.emitted_artefact_ids : []), ...(claims.written ? claims.emitted_artefact_ids : [])], artefact_source_classification_by_id: { raw_report: 'legacy_adapter', evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false, public_claim_trace: false }, legacy_adapter_artefact_ids: ['raw_report', 'evidence_anchors', 'public_claim_trace'], real_v3_spine_artefact_ids: [] });
    expect(out.warning).toBeNull();
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa/acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted');
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted');
    expect(metrics.evidence_anchor_trace_status).toBe('emitted');
    expect(metrics.public_claim_trace_status).toBe('emitted');
  });
});
