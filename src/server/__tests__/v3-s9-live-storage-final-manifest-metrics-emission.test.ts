import { beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.fn();
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { storage: { from: vi.fn(() => ({ upload })) } },
}));

import { emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 live storage final manifest metrics emission', () => {
  beforeEach(() => {
    upload.mockReset();
    upload.mockResolvedValue({ error: null });
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_STORAGE_BUCKET = 'qa-artifacts';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'false';
    process.env.V3_QA_ARTIFACTS_ENABLED = 'true';
    process.env.INTERNAL_QA_EMIT = 'true';
    delete process.env.BUILD_COMMIT_SHA;
    delete process.env.DEPLOYMENT_REVISION;
    delete process.env.BRANCH_NAME;
  });

  it('uploads traces + manifest + acceptance metrics under one canonical take-analysis root', async () => {
    process.env.BUILD_COMMIT_SHA = 'test-sha';
    process.env.DEPLOYMENT_REVISION = 'test-revision';
    process.env.BRANCH_NAME = 'test-branch';
    const run = 'take-tlive1';
    const take = 'tlive1';
    const raw = { report_data: { timestamped_notes: [{ timestamp: '00:01', note: 'Beat lands' }] } } as Record<string, unknown>;

    const anchors = await emitEvidenceAnchorsFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's1', take_id: take, source_stage: 'test', source_module: 'test', internal_qa_emit: true, raw_report_data: raw });
    const claims = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's1', take_id: take, source_stage: 'test', source_module: 'test', internal_qa_emit: true, raw_report_data: raw, evidence_anchors_data: { anchors: anchors.anchors ?? [] } });

    const out = await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: take,
      take_ids: [take],
      submission_id: 's1',
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report', ...(anchors.written ? anchors.emitted_artefact_ids : []), ...(claims.written ? claims.emitted_artefact_ids : [])],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter', evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false, public_claim_trace: false },
      legacy_adapter_artefact_ids: ['raw_report', 'evidence_anchors', 'public_claim_trace'],
      public_claim_trace_summary: claims.summary,
    });

    expect(out.written).toBe(true);
    const keys = upload.mock.calls.map((c) => c[0]);
    const root = `take-${take}/analysis-${run}/`;
    expect(keys).toContain(`${root}traces/EvidenceAnchors.json`);
    expect(keys).toContain(`${root}traces/PublicClaimTrace.json`);
    expect(keys).toContain(`${root}manifest.json`);
    expect(keys).toContain(`${root}qa/acceptance_metrics.json`);

    expect(out.warning).toBeNull();
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    const metricsPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}qa/acceptance_metrics.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('test-sha');
    expect(manifestPayload.deployment_revision).toBe('test-revision');
    expect(manifestPayload.source_branch).toBe('test-branch');
    expect(metricsPayload.build_commit_sha).toBe('test-sha');
    expect(metricsPayload.deployment_revision).toBe('test-revision');
    expect(metricsPayload.source_branch).toBe('test-branch');
    expect(manifestPayload.qa_artifact_root).toBe(`take-${take}/analysis-${run}`);
    expect(metricsPayload.qa_artifact_root).toBe(`take-${take}/analysis-${run}`);
    expect(metricsPayload.next_required_engineering_tasks).not.toContain('S9-06 EvidenceAnchors and PublicClaimTrace');
  });

  it('keeps unknown provenance safely when env is absent', async () => {
    const run = 'take-tlive2';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive2', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive2/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    const metricsPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}qa/acceptance_metrics.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('unknown');
    expect(metricsPayload.build_commit_sha).toBe('unknown');
    expect(manifestPayload.deployment_revision).toBe('unknown');
    expect(metricsPayload.deployment_revision).toBe('unknown');
  });

  it('surfaces non-null warning when manifest or metrics write fails', async () => {
    upload.mockResolvedValueOnce({ error: { message: 'manifest-fail' } }).mockResolvedValue({ error: null });
    const outManifestFail = await emitQAManifestForAnalysisRun({ run_id: 'take-tfail1', analysis_run_id: 'take-tfail1', take_id: 'tfail1', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    expect(outManifestFail.written).toBe(false);
    expect(outManifestFail.warning).toMatch(/manifest/i);

    upload.mockReset();
    upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'metrics-fail' } })
      .mockResolvedValue({ error: null });

    const outMetricsFail = await emitQAManifestForAnalysisRun({ run_id: 'take-tfail2', analysis_run_id: 'take-tfail2', take_id: 'tfail2', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    expect(outMetricsFail.written).toBe(false);
    expect(outMetricsFail.warning).toMatch(/qa_acceptance_metrics/i);
  });
});
