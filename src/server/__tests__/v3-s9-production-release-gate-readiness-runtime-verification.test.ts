import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitGateTraceFirstPass, emitValidatorTraceFirstPass } from '@/server/v3/qa-artifacts-wiring.server';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

const ordinaryArtefacts = [
  'step1_observable_evidence',
  'analysis_evidence_state',
  'evidence_anchors',
  'public_claim_trace',
  'score_trace',
  'technique_observation_trace',
  'model_run_trace',
  'validator_trace',
  'gate_trace',
  'parity_report',
  'no_export_proof',
];

function completeManifest(overrides: Record<string, unknown> = {}) {
  return {
    run_id: 'r19f',
    analysis_run_id: 'r19f',
    take_id: 't1',
    compared_take_ids: ['t1'],
    generated_at: new Date().toISOString(),
    emitted_artifacts: ordinaryArtefacts,
    missing_artifacts: [],
    emitted_blocked_artefact_ids: [],
    deferred_artifact_ids: [],
    not_applicable_artifact_ids: ['comparison_report_internal'],
    artefact_status_by_id: Object.fromEntries(ordinaryArtefacts.map((id) => [id, 'emitted'])),
    artefact_source_classification_by_id: {
      step1_observable_evidence: 'real_runtime_v3',
      analysis_evidence_state: 'real_runtime_v3',
      evidence_anchors: 'real_runtime_v3',
      public_claim_trace: 'real_runtime_v3_claim_support',
      score_trace: 'real_runtime_v3_internal_score_proof',
      technique_observation_trace: 'real_runtime_v3_internal_technique_observation',
      model_run_trace: 'independent_model_run_trace',
      validator_trace: 'independent_validation_satisfying',
      gate_trace: 'independent_gate_decision',
      parity_report: 'real_runtime_v3',
      no_export_proof: 'real_runtime_v3',
    },
    artefact_level2_spine_satisfaction_by_id: {
      step1_observable_evidence: true,
      analysis_evidence_state: true,
      evidence_anchors: true,
      public_claim_trace: true,
      score_trace: true,
      technique_observation_trace: true,
      model_run_trace: true,
      validator_trace: true,
      gate_trace: true,
      parity_report: true,
      no_export_proof: true,
    },
    analysis_evidence_state_summary: {
      analysis_evidence_state_gate_status: 'satisfied',
      ordinary_analysis_proof_bundle_status: 'step1_families_complete_proof_chain_blocked',
      ordinary_analysis_proof_bundle_gate_status: 'satisfied',
    },
    step1_observable_evidence_summary: {
      ordinary_analysis_proof_bundle_status: 'step1_families_complete_proof_chain_blocked',
      ordinary_analysis_proof_bundle_gate_status: 'satisfied',
    },
    evidence_anchor_trace_summary: {
      evidence_anchor_gate_status: 'sufficient',
      source_family_summary: { real_runtime_v3: 6 },
    },
    public_claim_trace_summary: {
      public_claim_gate_status: 'sufficient',
      public_claim_trace_gate_status: 'sufficient',
      unsupported_claim_count: 0,
      rewrite_required_count: 0,
      unsafe_or_overclaim_count: 0,
    },
    score_trace_summary: {
      score_trace_gate_status: 'satisfied',
      source_classification: 'real_runtime_v3_internal_score_proof',
      source_family_summary: { real_runtime_v3: 1 },
      real_runtime_v3_internal_score_entry_count: 1,
      overall_readiness_public_score_status: 'blocked',
    },
    technique_observation_trace_summary: {
      technique_observation_trace_gate_status: 'satisfied',
      source_classification: 'real_runtime_v3_internal_technique_observation',
    },
    model_run_trace_summary: {
      model_run_trace_gate_status: 'satisfied',
      independent_model_proof_status: 'independent_model_proof_satisfying',
      per_stage_model_proof_status: 'per_stage_model_proof_satisfied',
      raw_prompt_or_response_stored: false,
      secrets_or_signed_urls_stored: false,
    },
    validator_trace_summary: {
      validator_trace_gate_status: 'satisfied',
      independent_validation_status: 'independent_validation_satisfying',
    },
    gate_trace_summary: {
      gate_trace_gate_status: 'satisfied',
      independent_gate_decision_status: 'independent_gate_satisfying',
      ordinary_l2a_analysis_proof_status: 'satisfied',
      ordinary_l2a_analysis_proof_blocker_codes: [],
      public_output_permissions: {
        show_overall_score: false,
        show_public_technique_names: false,
        show_repertoire_claims: false,
        show_comparison_recommendation: false,
        show_public_report: false,
      },
    },
    report_parity_summary: {
      parity_status: 'passed',
      forbidden_fields_absent: true,
      blocked_score_fields_absent: true,
      blocked_technique_authority_fields_absent: true,
      blocked_comparison_fields_absent: true,
      public_output_permissions_checked: true,
    },
    no_export_status: 'no_export_proof_complete',
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    public_comparison_recommendation_status: 'blocked',
    public_output_unchanged: true,
    level2_qa_acceptance: 'not_accepted',
    deployment_provenance_status: 'unknown_no_safe_env_var_found',
    ...overrides,
  };
}

function runtimeVerifiedOverrides(overrides: Record<string, unknown> = {}) {
  return {
    runtime_operator_verification_status: 'completed',
    runtime_verified_take_ids: ['t1'],
    runtime_verified_deployment_ref: '024c5bbea8acdecc6781e4318094424c13088a9595',
    runtime_verified_at: '2026-05-21T12:00:00.000Z',
    runtime_verified_by_role: 'operator',
    runtime_bundle_freshness_status: 'fresh',
    runtime_bundle_matches_current_commit_status: 'matched',
    operator_confirmation_status: 'confirmed',
    operator_confirmed_pr_or_commit: '024c5bbea8acdecc6781e4318094424c13088a9595',
    operator_confirmation_reason: 'operator_confirmed_pr_runtime_bundle',
    ...overrides,
  };
}

describe('v3 s9 production release readiness and runtime verification gates', () => {
  it('keeps release readiness blocked when source proof passes but runtime operator verification is absent', () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest());

    expect(metrics.ordinary_l2a_analysis_proof_status).toBe('satisfied');
    expect(metrics.global_level2_evidence_status).toBe('satisfied');
    expect(metrics.global_level2_suppression_proof_status).toBe('satisfied');
    expect(metrics.runtime_operator_verification_status).toBe('required');
    expect(metrics.runtime_operator_verification_blocker_codes).toEqual(expect.arrayContaining([
      'runtime_operator_verification_required',
      'runtime_bundle_freshness_required',
      'runtime_bundle_current_commit_required',
      'deployment_provenance_or_operator_confirmation_required',
      'runtime_verified_take_required',
    ]));
    expect(metrics.production_safe_readiness_status).toBe('blocked');
    expect(metrics.customer_release_readiness_status).toBe('blocked');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.customer_release_status).toBe('blocked');
    expect(metrics.global_level2_acceptance_status).toBe('not_accepted');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('allows safe operator confirmation to make release readiness ready_for_review without approval', () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest(runtimeVerifiedOverrides()));

    expect(metrics.runtime_operator_verification_status).toBe('completed');
    expect(metrics.deployment_provenance_status).toBe('unknown_no_safe_env_var_found');
    expect(metrics.operator_confirmation_status).toBe('confirmed');
    expect(metrics.production_safe_readiness_status).toBe('ready_for_review');
    expect(metrics.customer_release_readiness_status).toBe('ready_for_review');
    expect(metrics.release_candidate_status).toBe('ready_for_review');
    expect(metrics.global_level2_release_readiness_status).toBe('ready_for_review');
    expect(metrics.global_level2_release_status).toBe('blocked');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.customer_release_status).toBe('blocked');
    expect(metrics.global_level2_acceptance_status).toBe('not_accepted');
  });

  it('does not let stale runtime fixture metadata satisfy runtime verification', () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest(runtimeVerifiedOverrides({
      runtime_bundle_freshness_status: 'stale_tracked_fixture',
    })));

    expect(metrics.runtime_operator_verification_status).toBe('incomplete');
    expect(metrics.runtime_operator_verification_blocker_codes).toContain('runtime_bundle_freshness_required');
    expect(metrics.production_safe_readiness_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('records runtime and release readiness separately from release approval in ValidatorTrace and GateTrace', async () => {
    const manifest = completeManifest(runtimeVerifiedOverrides());
    const metrics = buildQAAcceptanceMetrics(manifest);
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19f-release-gates-'));
    const base = {
      run_id: 'r19f-gates',
      analysis_run_id: 'r19f-gates',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ordinaryArtefacts,
      acceptance_metrics_snapshot: metrics,
      manifest_snapshot: manifest,
    };

    const validator = await emitValidatorTraceFirstPass(base);
    expect(validator.validator_trace_summary?.release_readiness_validation_status).toBe('passed');

    const gate = await emitGateTraceFirstPass({
      ...base,
      validator_trace_summary: validator.validator_trace_summary,
    });
    expect(gate.gate_trace_summary?.production_safe_readiness_status).toBe('ready_for_review');
    expect(gate.gate_trace_summary?.customer_release_readiness_status).toBe('ready_for_review');

    const payload = JSON.parse(await readFile(path.join(root, 'r19f-gates', 'takes', 'take-t1', 'analysis-r19f-gates', 'traces', 'GateTrace.json'), 'utf8'));
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'runtime_operator_verification_gate')?.status).toBe('passed');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'deployment_provenance_gate')?.status).toBe('passed');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'production_safe_readiness_gate')?.status).toBe('passed');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'customer_release_readiness_gate')?.status).toBe('passed');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'production_safe_approval_gate')?.status).toBe('blocked');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'customer_release_approval_gate')?.status).toBe('blocked');
    expect(payload.global_level2_acceptance_status).toBe('not_accepted');
  });

  it('keeps duplicate comparison safety suppressed but comparison parity fail-closed when decisive proof is absent', () => {
    const artefacts = [
      ...ordinaryArtefacts,
      'comparison_raw',
      'comparison_report_internal',
      'same_video_repeatability_trace',
      'duplicate_detection_trace',
      'comparison_suppression_trace',
      'route_variance_trace',
    ];
    const metrics = buildQAAcceptanceMetrics(completeManifest({
      compared_take_ids: ['t1', 't1'],
      comparison_run_id: 'cmp1',
      emitted_artifacts: artefacts,
      artefact_status_by_id: Object.fromEntries(artefacts.map((id) => [id, 'emitted'])),
    }));

    expect(metrics.public_comparison_recommendation_suppression_proof_status).toBe('satisfied');
    expect(metrics.duplicate_same_video_safety_status).toBe('satisfied_suppressed');
    expect(metrics.public_winner_absent).toBe(true);
    expect(metrics.public_recommendation_absent).toBe(true);
    expect(metrics.evidence_delta_or_no_material_difference_status).toBe('insufficient');
    expect(metrics.comparison_parity_release_blocker_status).toBe('fail_closed_decisive_proof_required');
    expect(metrics.public_comparison_recommendation_status).toBe('blocked');
  });
});
