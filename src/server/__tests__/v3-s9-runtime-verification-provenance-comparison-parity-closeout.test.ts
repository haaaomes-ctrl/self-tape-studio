import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildQAAcceptanceMetrics, emitInternalQAArtifactManifest } from '@/server/v3/qa-artifacts.server';
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
      operator_confirmed_runtime_build_ref: 's9-19i-runtime-confirmed',
      runtime_verified_deployment_ref: 's9-19i-runtime-confirmed',
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
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.customer_release_status).toBe('blocked');
  });

  it('preserves supplied runtime verification summaries without rewriting a default trace', async () => {
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
        operator_confirmation_status: 'confirmed',
        operator_confirmed_runtime_build_ref: 'operator-confirmed-runtime',
      },
    });

    expect(out.written).toBe(true);
    const manifest = await readJson(path.join(root, 'run-runtime-summary', 'manifest.json'));
    const metrics = await readJson(path.join(root, 'run-runtime-summary', 'qa', 'acceptance_metrics.json'));
    expect(manifest.runtime_verification_trace_summary.runtime_operator_verification_status).toBe('completed');
    expect(metrics.runtime_operator_verification_status).toBe('completed');
    await expect(readFile(path.join(root, 'run-runtime-summary', 'takes', 'take-ta', 'analysis-run-runtime-summary', 'analysis', 'RuntimeVerificationTrace.json'), 'utf8')).rejects.toThrow();
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
