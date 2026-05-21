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
    run_id: 'r19e',
    analysis_run_id: 'r19e',
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
	      public_technique_authority_content_scan_safe: true,
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
    ...overrides,
  };
}

describe('v3 s9 public release suppression proof and Level 2 reconciliation', () => {
  it('satisfies public scoring and technique suppression proof without approving the public features', () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest());

    expect(metrics.ordinary_l2a_analysis_proof_status).toBe('satisfied');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_scoring_feature_status).toBe('blocked');
    expect(metrics.public_scoring_suppression_proof_status).toBe('satisfied');
    expect(metrics.public_score_gate_permission).toBe(false);
    expect(metrics.public_score_fields_absent_from_public_payload).toBe(true);
    expect(metrics.public_score_claims_suppressed).toBe(true);

    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.public_technique_authority_feature_status).toBe('blocked');
    expect(metrics.public_technique_authority_suppression_proof_status).toBe('satisfied');
    expect(metrics.public_technique_gate_permission).toBe(false);
    expect(metrics.public_named_technique_fields_absent_from_public_payload).toBe(true);
    expect(metrics.public_named_technique_claims_suppressed).toBe(true);
  });

  it('keeps suppression insufficient and reports the observed permission when public score output is enabled', () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest({
      gate_trace_summary: {
        gate_trace_gate_status: 'satisfied',
        independent_gate_decision_status: 'independent_gate_satisfying',
        ordinary_l2a_analysis_proof_status: 'satisfied',
        ordinary_l2a_analysis_proof_blocker_codes: [],
        public_output_permissions: {
          show_overall_score: true,
          show_public_technique_names: false,
          show_repertoire_claims: false,
          show_comparison_recommendation: false,
          show_public_report: false,
        },
      },
    }));

    expect(metrics.public_score_gate_permission).toBe(true);
    expect(metrics.public_scoring_suppression_proof_status).toBe('insufficient');
    expect(metrics.public_scoring_suppression_blocker_codes).toContain('public_score_gate_permission_not_blocked');
  });

  it('keeps global Level 2 not accepted while evidence and suppression gates are separated from release gates', () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest());

    expect(metrics.global_level2_evidence_status).toBe('satisfied');
    expect(metrics.global_level2_release_status).toBe('blocked');
    expect(metrics.global_level2_acceptance_status).toBe('not_accepted');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.customer_release_status).toBe('blocked');
    expect(metrics.global_level2_blocker_codes_by_family).toMatchObject({
      evidence: [],
      suppression: [],
      release: ['production_safe_blocked', 'customer_release_blocked'],
    });
  });

  it('does not satisfy suppression proof when parity has not validated blocked public score absence', () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest({
      report_parity_summary: {
        parity_status: 'passed',
        forbidden_fields_absent: true,
        blocked_score_fields_absent: false,
        blocked_technique_authority_fields_absent: true,
        blocked_comparison_fields_absent: true,
        public_output_permissions_checked: true,
      },
    }));

    expect(metrics.public_scoring_suppression_proof_status).toBe('insufficient');
    expect(metrics.public_scoring_suppression_blocker_codes).toContain('public_score_absence_not_validated_by_report_parity');
    expect(metrics.global_level2_evidence_status).toBe('insufficient');
  });

  it('lets ordinary single-take comparison suppression be not applicable while feature approval stays blocked', () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest());

    expect(metrics.public_comparison_recommendation_status).toBe('blocked');
    expect(metrics.public_comparison_recommendation_feature_status).toBe('blocked');
    expect(metrics.public_comparison_recommendation_suppression_proof_status).toBe('not_applicable');
    expect(metrics.public_winner_absent).toBe(true);
    expect(metrics.public_recommendation_absent).toBe(true);
  });

  it('records suppression gates separately from feature approval and release gates in GateTrace', async () => {
    const metrics = buildQAAcceptanceMetrics(completeManifest());
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19e-gates-'));
    const base = {
      run_id: 'r19e-gates',
      analysis_run_id: 'r19e-gates',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ordinaryArtefacts,
      acceptance_metrics_snapshot: metrics,
      manifest_snapshot: completeManifest(),
    };

    const validator = await emitValidatorTraceFirstPass(base);
    expect(validator.validator_trace_summary?.validator_trace_gate_status).toBe('satisfied');

    const gate = await emitGateTraceFirstPass({
      ...base,
      validator_trace_summary: validator.validator_trace_summary,
    });
    expect(gate.gate_trace_summary?.gate_trace_gate_status).toBe('satisfied');

    const payload = JSON.parse(await readFile(path.join(root, 'r19e-gates', 'takes', 'take-t1', 'analysis-r19e-gates', 'traces', 'GateTrace.json'), 'utf8'));
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'global_level2_evidence_gate')?.status).toBe('passed');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'public_scoring_suppression_proof_gate')?.status).toBe('passed');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'public_technique_authority_suppression_proof_gate')?.status).toBe('passed');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'public_comparison_recommendation_suppression_proof_gate')?.status).toBe('not_applicable');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'public_scoring_feature_approval_gate')?.status).toBe('blocked');
    expect(payload.gate_entries.find((entry: any) => entry.gate_id === 'production_safe_gate')?.status).toBe('blocked');
    expect(payload.global_level2_acceptance_status).toBe('not_accepted');
  });
});
