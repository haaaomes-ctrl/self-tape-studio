import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildQAAcceptanceMetrics, emitInternalQAArtifactManifest, resolveQADeploymentProvenance } from '@/server/v3/qa-artifacts.server';
import { emitComparisonParityProof, emitQAManifestForAnalysisRun, emitRuntimeVerificationTrace } from '@/server/v3/qa-artifacts-wiring.server';

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function sameVideoSuppressedPayload() {
  return {
    public_output_unchanged: true,
    public_comparison_output_absent_or_unchanged: true,
    comparison_public_output_absent: true,
    forced_winner_risk: false,
    false_winner_risk: false,
    duplicate_detection_trace: {
      duplicate_detection_status: 'detected',
      duplicate_detection_confidence: 100,
      suppression_applied: true,
      same_video_suppression_status: 'suppressed',
      same_video_detected: true,
      repeated_input_detected: true,
      no_material_difference: true,
      suppression_required: true,
    },
    same_video_repeatability_trace: {
      same_video_detected: true,
      repeated_input_detected: true,
      same_video_suppression_status: 'suppressed',
      no_material_difference: true,
    },
    comparison_suppression_trace: {
      recommendation_suppressed: true,
      same_video_suppression_status: 'suppressed',
      selected_take_id_internal_only: null,
      public_winner_absent: true,
      public_recommendation_absent: true,
    },
    route_variance_trace: {
      route_variance_risk: false,
      route_mismatch_detected: false,
      route_variance_detected: false,
      route_variance_status: 'not_detected',
      route_variance_mitigation_status: 'not_required',
      false_winner_prevention_status: 'suppressed',
    },
  };
}

const provenanceEnvKeys = [
  'BUILD_COMMIT_SHA',
  'COMMIT_SHA',
  'GIT_SHA',
  'GIT_COMMIT_SHA',
  'SOURCE_VERSION',
  'GITHUB_SHA',
  'GITHUB_REF_NAME',
  'BRANCH_NAME',
  'GIT_BRANCH_NAME',
  'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_REF',
  'VERCEL_DEPLOYMENT_ID',
  'CF_PAGES_COMMIT_SHA',
  'CF_PAGES_BRANCH',
  'LOVABLE_GIT_COMMIT_SHA',
  'LOVABLE_DEPLOYMENT_ID',
  'DEPLOYMENT_REVISION',
] as const;

async function withProvenanceEnv<T>(
  env: Partial<Record<(typeof provenanceEnvKeys)[number], string>>,
  fn: () => Promise<T>,
) {
  const previous = Object.fromEntries(provenanceEnvKeys.map((key) => [key, process.env[key]]));
  for (const key of provenanceEnvKeys) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  try {
    return await fn();
  } finally {
    for (const key of provenanceEnvKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('v3-s9-19j runtime verification provenance and comparison parity closeout', () => {
  it('keeps source/test/build-only proof from satisfying runtime verification', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19j-runtime-required-'));
    const out = await emitRuntimeVerificationTrace({
      run_id: 'run-runtime-required',
      analysis_run_id: 'run-runtime-required',
      take_id: 'ta',
      root_dir: root,
      internal_qa_emit: true,
      runtime_verified_artefact_ids: [],
    });

    expect(out.written).toBe(true);
    expect(out.runtime_verification_trace_summary?.runtime_operator_verification_status).toBe('required');
    expect(out.runtime_verification_trace_summary?.blocker_codes).toContain('runtime_operator_verification_required');
    const trace = await readJson(path.join(root, 'run-runtime-required', 'takes', 'take-ta', 'analysis-run-runtime-required', 'analysis', 'RuntimeVerificationTrace.json'));
    expect(trace.raw_prompt_or_response_stored).toBe(false);
    expect(trace.secrets_or_signed_urls_stored).toBe(false);
    expect(trace.request_body).toBeUndefined();
    expect(trace.headers).toBeUndefined();
    expect(trace.raw_prompt).toBeUndefined();
    expect(trace.raw_response).toBeUndefined();
  });

  it('captures safe commit branch and deployment env provenance without raw env dumps', () => {
    const provenance = resolveQADeploymentProvenance({
      BUILD_COMMIT_SHA: 'abcdef1234567890abcdef1234567890abcdef12',
      BRANCH_NAME: 'codex/r10-7h-runtime-provenance-operator-verification',
      DEPLOYMENT_REVISION: 'deploy_123',
      MUX_TOKEN_SECRET: 'never-emit',
    } as NodeJS.ProcessEnv);

    expect(provenance.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(provenance.source_branch).toBe('codex/r10-7h-runtime-provenance-operator-verification');
    expect(provenance.deployment_revision).toBe('deploy_123');
    expect(provenance.deployment_provenance_status).toBe('resolved');
    expect(JSON.stringify(provenance)).not.toContain('never-emit');
  });

  it('ignores unsafe provenance env values without storing rejected raw values', () => {
    const provenance = resolveQADeploymentProvenance({
      BUILD_COMMIT_SHA: 'https://example.test/build?token=secret',
      BRANCH_NAME: 'main?token=secret',
      DEPLOYMENT_REVISION: 'deploy=secret',
    } as NodeJS.ProcessEnv);

    expect(provenance.build_commit_sha).toBe('unknown');
    expect(provenance.source_branch).toBe('unknown');
    expect(provenance.deployment_revision).toBe('unknown');
    expect(provenance.deployment_provenance_status).toBe('invalid_env_value_ignored');
    expect(provenance.deployment_provenance_invalid_sources_ignored).toEqual(expect.arrayContaining([
      'BUILD_COMMIT_SHA',
      'BRANCH_NAME',
      'DEPLOYMENT_REVISION',
    ]));
    expect(JSON.stringify(provenance)).not.toContain('token=secret');
    expect(JSON.stringify(provenance)).not.toContain('deploy=secret');
  });

  it('allows operator-confirmed deployment context without approving production release', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19j-runtime-confirmed-'));
    const trace = await emitRuntimeVerificationTrace({
      run_id: 'run-runtime-confirmed',
      analysis_run_id: 'run-runtime-confirmed',
      take_id: 'ta',
      root_dir: root,
      internal_qa_emit: true,
      runtime_operator_verification_status: 'completed',
      runtime_bundle_freshness_status: 'fresh',
      runtime_bundle_matches_current_implementation_status: 'operator_confirmed',
      runtime_verified_take_ids: ['ta'],
      runtime_verified_artefact_ids: ['step1_observable_evidence', 'analysis_evidence_state'],
      operator_confirmation_status: 'confirmed',
      operator_confirmed_deployed_commit_sha: 'abcdef1234567890abcdef1234567890abcdef12',
      operator_confirmed_deployment_reference: 'deploy_123',
      operator_confirmed_branch: 'main',
      operator_confirmed_by: 'operator',
      operator_confirmed_at: '2026-05-21T12:00:00.000Z',
      operator_confirmed_take_id: 'ta',
      operator_confirmed_analysis_run_id: 'run-runtime-confirmed',
      operator_confirmed_report_surface: 'public_report_page',
      operator_confirmation_source: 'explicit_operator_runtime_message',
      operator_confirmation_scope: 'ordinary_single_take',
      runtime_verified_deployment_ref: 'deploy_123',
    });
    const manifestOut = await emitInternalQAArtifactManifest({
      run_id: 'run-runtime-confirmed',
      analysis_run_id: 'run-runtime-confirmed',
      take_id: 'ta',
      root_dir: root,
      internal_qa_emit: true,
      runtime_verification_trace_summary: trace.runtime_verification_trace_summary ?? undefined,
      emitted_artefact_ids: ['runtime_verification_trace'],
      artefact_source_classification_by_id: { runtime_verification_trace: 'runtime_verification_trace' },
      artefact_level2_spine_satisfaction_by_id: { runtime_verification_trace: false },
    });
    const metrics = buildQAAcceptanceMetrics(manifestOut.manifest);

    expect(metrics.runtime_operator_verification_status).toBe('completed');
    expect(metrics.runtime_bundle_freshness_status).toBe('fresh');
    expect(metrics.runtime_bundle_matches_current_implementation_status).toBe('operator_confirmed');
    expect(metrics.operator_confirmation_status).toBe('confirmed');
    expect(metrics.operator_confirmed_deployed_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(metrics.operator_confirmed_report_surface).toBe('public_report_page');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.customer_release_status).toBe('blocked');
    const confirmation = await readJson(path.join(root, 'run-runtime-confirmed', 'takes', 'take-ta', 'analysis-run-runtime-confirmed', 'analysis', 'runtime_operator_confirmation.json'));
    expect(confirmation.internal_only).toBe(true);
    expect(confirmation.deployed_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(confirmation.production_safe_status).toBe('blocked');
  });

  it('allows safe env provenance to complete runtime proof without release approval', async () => {
    await withProvenanceEnv({
      BUILD_COMMIT_SHA: 'abcdef1234567890abcdef1234567890abcdef12',
      BRANCH_NAME: 'main',
      DEPLOYMENT_REVISION: 'deploy_123',
    }, async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 's9-19j-runtime-env-'));
      const out = await emitRuntimeVerificationTrace({
        run_id: 'run-runtime-env',
        analysis_run_id: 'run-runtime-env',
        take_id: 'ta',
        root_dir: root,
        internal_qa_emit: true,
        runtime_operator_verification_status: 'completed',
        runtime_verified_take_ids: ['ta'],
        runtime_verified_artefact_ids: ['step1_observable_evidence'],
      });

      const summary = out.runtime_verification_trace_summary as any;
      expect(summary.runtime_operator_verification_status).toBe('completed');
      expect(summary.runtime_bundle_freshness_status).toBe('fresh');
      expect(summary.runtime_bundle_matches_current_implementation_status).toBe('matches_current_implementation');
      const trace = await readJson(path.join(root, 'run-runtime-env', 'takes', 'take-ta', 'analysis-run-runtime-env', 'analysis', 'RuntimeVerificationTrace.json'));
      expect(trace.deployment_provenance_status).toBe('resolved');
      expect(trace.build_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
      expect(trace.production_safe_status).toBe('blocked');
    });
  });

  it('blocks runtime proof when safe env provenance conflicts with operator confirmation', async () => {
    await withProvenanceEnv({
      BUILD_COMMIT_SHA: '1111111111111111111111111111111111111111',
      BRANCH_NAME: 'main',
      DEPLOYMENT_REVISION: 'deploy_123',
    }, async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 's9-19j-runtime-conflict-'));
      const out = await emitRuntimeVerificationTrace({
        run_id: 'run-runtime-conflict',
        analysis_run_id: 'run-runtime-conflict',
        take_id: 'ta',
        root_dir: root,
        internal_qa_emit: true,
        runtime_operator_verification_status: 'completed',
        runtime_verified_take_ids: ['ta'],
        runtime_verified_artefact_ids: ['step1_observable_evidence'],
        operator_confirmation_status: 'confirmed',
        operator_confirmed_deployed_commit_sha: '2222222222222222222222222222222222222222',
        operator_confirmed_deployment_reference: 'deploy_123',
        operator_confirmed_branch: 'main',
        operator_confirmed_by: 'operator',
        operator_confirmed_at: '2026-05-21T12:00:00.000Z',
        operator_confirmed_take_id: 'ta',
        operator_confirmed_analysis_run_id: 'run-runtime-conflict',
        operator_confirmed_report_surface: 'public_report_page',
        operator_confirmation_source: 'explicit_operator_runtime_message',
      });

      expect(out.runtime_verification_trace_summary?.runtime_operator_verification_status).toBe('incomplete');
      expect(out.runtime_verification_trace_summary?.blocker_codes).toEqual(expect.arrayContaining(['runtime_provenance_conflict']));
      const trace = await readJson(path.join(root, 'run-runtime-conflict', 'takes', 'take-ta', 'analysis-run-runtime-conflict', 'analysis', 'RuntimeVerificationTrace.json'));
      expect(trace.deployment_provenance_status).toBe('runtime_provenance_conflict');
      expect(trace.runtime_provenance_conflict_fields).toEqual(['commit']);
      expect(JSON.stringify(trace)).not.toContain('token=');
    });
  });

  it('keeps incomplete operator confirmation blocked with a specific reason', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19j-runtime-incomplete-confirmation-'));
    const out = await emitRuntimeVerificationTrace({
      run_id: 'run-runtime-incomplete-confirmation',
      analysis_run_id: 'run-runtime-incomplete-confirmation',
      take_id: 'ta',
      root_dir: root,
      internal_qa_emit: true,
      runtime_operator_verification_status: 'completed',
      runtime_verified_take_ids: ['ta'],
      runtime_verified_artefact_ids: ['step1_observable_evidence'],
      operator_confirmation_status: 'confirmed',
      operator_confirmed_deployed_commit_sha: 'abcdef1234567890abcdef1234567890abcdef12',
      operator_confirmed_by: 'operator',
      operator_confirmed_at: '2026-05-21T12:00:00.000Z',
    });

    const summary = out.runtime_verification_trace_summary as any;
    expect(summary.operator_confirmation_status).toBe('incomplete');
    expect(summary.operator_confirmation_reason).toBe('operator_confirmation_incomplete');
    expect(summary.runtime_operator_verification_status).toBe('incomplete');
    expect(out.emitted_artefact_ids).not.toContain('runtime_operator_confirmation');
  });

  it('preserves supplied runtime verification summaries when emitting the runtime trace', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19j-runtime-summary-'));
    const out = await emitQAManifestForAnalysisRun({
      run_id: 'run-runtime-summary',
      analysis_run_id: 'run-runtime-summary',
      take_id: 'ta',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['runtime_verification_trace'],
      runtime_verification_trace_summary: {
        runtime_operator_verification_status: 'completed',
        runtime_bundle_freshness_status: 'fresh',
        runtime_bundle_matches_current_implementation_status: 'operator_confirmed',
        runtime_verified_take_ids: ['ta'],
        runtime_verified_artefact_ids: ['runtime_verification_trace'],
        operator_confirmation_status: 'confirmed',
        operator_confirmed_deployed_commit_sha: 'abcdef1234567890abcdef1234567890abcdef12',
        operator_confirmed_deployment_reference: 'deploy_123',
        operator_confirmed_branch: 'main',
        operator_confirmed_by: 'operator',
        operator_confirmed_at: '2026-05-21T12:00:00.000Z',
        operator_confirmed_take_id: 'ta',
        operator_confirmed_analysis_run_id: 'run-runtime-summary',
        operator_confirmed_report_surface: 'public_report_page',
        operator_confirmation_source: 'explicit_operator_runtime_message',
      },
    });

    expect(out.written).toBe(true);
    const manifest = await readJson(path.join(root, 'run-runtime-summary', 'manifest.json'));
    const metrics = await readJson(path.join(root, 'run-runtime-summary', 'qa', 'acceptance_metrics.json'));
    const trace = await readJson(path.join(root, 'run-runtime-summary', 'takes', 'take-ta', 'analysis-run-runtime-summary', 'analysis', 'RuntimeVerificationTrace.json'));
    expect(manifest.runtime_verification_trace_summary.runtime_operator_verification_status).toBe('completed');
    expect(metrics.runtime_operator_verification_status).toBe('completed');
    expect(trace.runtime_operator_verification_status).toBe('completed');
    expect(manifest.operator_confirmed_deployed_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(metrics.operator_confirmed_deployed_commit_sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(trace.operator_confirmed_report_surface).toBe('public_report_page');
  });

  it('classifies intentionally absent same-video public output as suppressed, not missing parity artefacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19j-comparison-suppressed-'));
    const out = await emitComparisonParityProof({
      run_id: 'run-comparison-suppressed',
      analysis_run_id: 'run-comparison-suppressed',
      take_id: 'ta',
      comparison_run_id: 'cmp-ta-tb',
      compared_take_ids: ['ta', 'tb'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_invoked: true,
      comparison_evidence_status: {
        comparison_raw: true,
        comparison_report_internal: true,
        same_video_repeatability_trace: true,
        duplicate_detection_trace: true,
        comparison_suppression_trace: true,
        route_variance_trace: true,
      },
      comparison_payloads: sameVideoSuppressedPayload(),
    });

    expect(out.written).toBe(true);
    expect(['failed', 'insufficient']).toContain(out.parity_status);
    expect(out.blocker_codes).toEqual(['duplicate_same_video_suppressed_without_decisive_evidence_delta']);
    expect(out.blocker_codes).not.toContain('parity_artefacts_missing');
    expect(out.comparison_parity_summary?.comparison_public_output_status).toBe('not_emitted_suppressed');
    expect(out.comparison_parity_summary?.comparison_public_output_absence_proof_status).toBe('satisfied');
    expect(out.comparison_parity_summary?.comparison_suppression_safety_status).toBe('satisfied_suppressed');
    expect(out.comparison_parity_summary?.comparison_parity_status).toBe('fail_closed');
    expect(out.comparison_parity_summary?.evidence_delta_or_no_material_difference_status).toBe('non_decisive');

    const parity = await readJson(path.join(root, 'run-comparison-suppressed', 'takes', 'take-ta', 'analysis-run-comparison-suppressed', 'parity', 'comparison_parity.json'));
    expect(parity.comparison_public_winner_absent).toBe(true);
    expect(parity.comparison_public_recommendation_absent).toBe(true);
    expect(parity.comparison_recommendation_permission).toBe(false);
  });

  it('keeps parity_artefacts_missing when required suppression or risk artefacts are absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19j-comparison-missing-'));
    const out = await emitComparisonParityProof({
      run_id: 'run-comparison-missing',
      analysis_run_id: 'run-comparison-missing',
      take_id: 'ta',
      comparison_run_id: 'cmp-ta-tb',
      compared_take_ids: ['ta', 'tb'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_invoked: true,
      comparison_evidence_status: {
        comparison_raw: true,
        comparison_report_internal: true,
        same_video_repeatability_trace: true,
        duplicate_detection_trace: true,
        comparison_suppression_trace: false,
        route_variance_trace: true,
      },
      comparison_payloads: {
        ...sameVideoSuppressedPayload(),
        comparison_suppression_trace: undefined,
      },
    });

    expect(out.written).toBe(true);
    expect(out.parity_status).toBe('insufficient');
    expect(out.blocker_codes).toContain('parity_artefacts_missing');
    expect(out.comparison_parity_summary?.comparison_suppression_safety_status).toBe('insufficient');
  });
});
