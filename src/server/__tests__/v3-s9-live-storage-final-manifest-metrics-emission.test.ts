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
    for (const key of ['BUILD_COMMIT_SHA', 'COMMIT_SHA', 'GIT_SHA', 'GIT_COMMIT_SHA', 'SOURCE_VERSION', 'GITHUB_SHA', 'GITHUB_REF_NAME', 'BRANCH_NAME', 'GIT_BRANCH_NAME', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_DEPLOYMENT_ID', 'CF_PAGES_COMMIT_SHA', 'CF_PAGES_BRANCH', 'LOVABLE_GIT_COMMIT_SHA', 'LOVABLE_DEPLOYMENT_ID', 'DEPLOYMENT_REVISION'] as const) delete process.env[key];
  });

  it('uploads traces + manifest + acceptance metrics under one canonical take-analysis root', async () => {
    process.env.BUILD_COMMIT_SHA = 'abcdef1234567890abcdef1234567890abcdef12';
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
    expect(manifestPayload.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(manifestPayload.deployment_revision).toBe('test-revision');
    expect(manifestPayload.source_branch).toBe('test-branch');
    expect(metricsPayload.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(metricsPayload.deployment_revision).toBe('test-revision');
    expect(metricsPayload.source_branch).toBe('test-branch');
    expect(manifestPayload.qa_artifact_root).toBe(`take-${take}/analysis-${run}`);
    expect(metricsPayload.qa_artifact_root).toBe(`take-${take}/analysis-${run}`);
    expect(manifestPayload.storage_bucket).toBe('qa-artifacts');
    expect(metricsPayload.next_required_engineering_tasks).not.toContain('S9-06 EvidenceAnchors and PublicClaimTrace');
  });

  it('uses GIT_* provenance fallbacks when primary env vars are absent', async () => {
    process.env.GIT_COMMIT_SHA = 'abcdef1234567890abcdef1234567890abcdef12';
    process.env.GIT_BRANCH_NAME = 'git-branch';
    const run = 'take-tlive3';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive3', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive3/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    const metricsPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}qa/acceptance_metrics.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(metricsPayload.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(manifestPayload.source_branch).toBe('git-branch');
    expect(metricsPayload.source_branch).toBe('git-branch');
    expect(manifestPayload.deployment_provenance_status).toBe('resolved');
    expect(manifestPayload.deployment_provenance_sources_checked).toEqual(expect.arrayContaining(['GIT_COMMIT_SHA', 'GIT_BRANCH_NAME']));
  });

  it('uses COMMIT_SHA fallback as resolved provenance', async () => {
    process.env.COMMIT_SHA = 'abcdef1234567890abcdef1234567890abcdef12';
    const run = 'take-tlive-commitsha';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive-commitsha', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive-commitsha/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(manifestPayload.deployment_provenance_status).toBe('resolved');
    expect(manifestPayload.deployment_provenance_sources_checked).toEqual(expect.arrayContaining(['COMMIT_SHA']));
  });

  it('uses GIT_SHA fallback as resolved provenance', async () => {
    process.env.GIT_SHA = 'abcdef1234567890abcdef1234567890abcdef12';
    const run = 'take-tlive-gitsha';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive-gitsha', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive-gitsha/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(manifestPayload.deployment_provenance_status).toBe('resolved');
    expect(manifestPayload.deployment_provenance_sources_checked).toEqual(expect.arrayContaining(['GIT_SHA']));
  });

  it('uses fallback branch and deployment env keys as resolved provenance', async () => {
    process.env.BRANCH_NAME = 'main';
    process.env.VERCEL_DEPLOYMENT_ID = 'dep_abc123';
    const run = 'take-tlive-fallback-branch-dep';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive-fallback-branch-dep', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive-fallback-branch-dep/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.source_branch).toBe('main');
    expect(manifestPayload.deployment_revision).toBe('dep_abc123');
    expect(manifestPayload.deployment_provenance_status).toBe('resolved');
    expect(manifestPayload.deployment_provenance_sources_checked).toEqual(expect.arrayContaining(['BRANCH_NAME', 'VERCEL_DEPLOYMENT_ID']));
  });

  it('falls back to valid lower-priority branch key after invalid higher-priority branch value', async () => {
    process.env.VERCEL_GIT_COMMIT_REF = 'invalid branch with spaces ???';
    process.env.BRANCH_NAME = 'main';
    const run = 'take-tlive-invalid-branch-fallback';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive-invalid-branch-fallback', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive-invalid-branch-fallback/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.source_branch).toBe('main');
    expect(manifestPayload.deployment_provenance_status).toBe('resolved');
    expect(manifestPayload.deployment_provenance_sources_checked).toEqual(expect.arrayContaining(['VERCEL_GIT_COMMIT_REF', 'BRANCH_NAME']));
    expect(manifestPayload.deployment_provenance_invalid_sources_ignored).toEqual(expect.arrayContaining(['VERCEL_GIT_COMMIT_REF']));
    expect(JSON.stringify(manifestPayload)).not.toContain('invalid branch with spaces ???');
  });

  it('falls back to valid lower-priority deployment revision after invalid higher-priority candidate', async () => {
    process.env.VERCEL_DEPLOYMENT_ID = 'invalid deployment id with spaces ???';
    process.env.DEPLOYMENT_REVISION = 'dep_abc123';
    const run = 'take-tlive-invalid-deploy-fallback';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive-invalid-deploy-fallback', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive-invalid-deploy-fallback/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.deployment_revision).toBe('dep_abc123');
    expect(manifestPayload.deployment_provenance_status).toBe('resolved');
  });

  it('falls back to valid lower-priority commit key after invalid higher-priority candidate', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'not-a-valid-sha';
    process.env.COMMIT_SHA = 'abcdef1234567890abcdef1234567890abcdef12';
    const run = 'take-tlive-invalid-commit-fallback';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive-invalid-commit-fallback', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive-invalid-commit-fallback/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(manifestPayload.deployment_provenance_status).toBe('resolved');
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
    expect(manifestPayload.deployment_provenance_status).toBe('unknown_no_safe_env_var_found');
    expect(metricsPayload.deployment_provenance_status).toBe('unknown_no_safe_env_var_found');
    expect(manifestPayload.deployment_provenance_sources_checked).toEqual([
      'BUILD_COMMIT_SHA', 'COMMIT_SHA', 'GIT_SHA', 'GIT_COMMIT_SHA', 'SOURCE_VERSION', 'GITHUB_SHA', 'GITHUB_REF_NAME', 'BRANCH_NAME', 'GIT_BRANCH_NAME', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_DEPLOYMENT_ID', 'CF_PAGES_COMMIT_SHA', 'CF_PAGES_BRANCH', 'LOVABLE_GIT_COMMIT_SHA', 'LOVABLE_DEPLOYMENT_ID', 'DEPLOYMENT_REVISION',
    ]);
  });

  it('ignores invalid safe env commit values and reports diagnostic status', async () => {
    process.env.BUILD_COMMIT_SHA = '%%%';
    process.env.MUX_TOKEN_SECRET = 'never-emit';
    const run = 'take-tlive4';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive4', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive4/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('unknown');
    expect(manifestPayload.deployment_provenance_status).toBe('invalid_env_value_ignored');
    expect(manifestPayload.deployment_provenance_sources_checked).toEqual(expect.arrayContaining(['BUILD_COMMIT_SHA', 'GITHUB_SHA', 'LOVABLE_DEPLOYMENT_ID']));
    expect(JSON.stringify(manifestPayload).toLowerCase()).not.toContain('mux_token_secret');
    expect(JSON.stringify(manifestPayload).toLowerCase()).not.toContain('never-emit');
    expect(manifestPayload.deployment_provenance_status).not.toBe('unknown_no_safe_env_var_found');
  });

  it('returns invalid_env_value_ignored when present safe keys are all invalid', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'not-a-valid-sha';
    process.env.VERCEL_GIT_COMMIT_REF = 'invalid branch with spaces ???';
    process.env.VERCEL_DEPLOYMENT_ID = 'invalid deployment id with spaces ???';
    const run = 'take-tlive-all-invalid';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive-all-invalid', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive-all-invalid/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('unknown');
    expect(manifestPayload.source_branch).toBe('unknown');
    expect(manifestPayload.deployment_revision).toBe('unknown');
    expect(manifestPayload.deployment_provenance_status).toBe('invalid_env_value_ignored');
    expect(manifestPayload.deployment_provenance_status).not.toBe('unknown_no_safe_env_var_found');
  });

  it('keeps valid high-priority commit key precedence over lower-priority fallback', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = '1111111111111111111111111111111111111111';
    process.env.COMMIT_SHA = '2222222222222222222222222222222222222222';
    const run = 'take-tlive-priority-commit';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 'tlive-priority-commit', submission_id: 's1', internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const root = `take-tlive-priority-commit/analysis-${run}/`;
    const manifestPayload = JSON.parse(upload.mock.calls.find((c) => c[0] === `${root}manifest.json`)?.[1] ?? '{}');
    expect(manifestPayload.build_commit_sha).toBe('1111111111111111111111111111111111111111');
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
