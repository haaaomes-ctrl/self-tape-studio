import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  emitGateTraceFirstPass,
  emitModelRunTraceFirstPass,
  emitValidatorTraceFirstPass,
} from '@/server/v3/qa-artifacts-wiring.server';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

const emittedOrdinaryArtefacts = [
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

function completeOrdinaryManifest(overrides: Record<string, unknown> = {}) {
  return {
    run_id: 'r19d',
    analysis_run_id: 'r19d',
    take_id: 't1',
    compared_take_ids: ['t1'],
    generated_at: new Date().toISOString(),
    emitted_artifacts: emittedOrdinaryArtefacts,
    missing_artifacts: [],
    emitted_blocked_artefact_ids: [],
    deferred_artifact_ids: [],
    not_applicable_artifact_ids: ['comparison_report_internal'],
    artefact_status_by_id: Object.fromEntries(emittedOrdinaryArtefacts.map((id) => [id, 'emitted'])),
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

describe('v3 s9 independent proof-chain ordinary L2A closeout', () => {
  it('surfaces satisfied ordinary L2A proof while global Level 2 and public release gates remain blocked', () => {
    const metrics = buildQAAcceptanceMetrics(completeOrdinaryManifest());

    expect(metrics.ordinary_l2a_analysis_proof_status).toBe('satisfied');
    expect(metrics.ordinary_l2a_analysis_proof_blocker_codes).toEqual([]);
    expect(metrics.ordinary_l2a_unsatisfied_gate_ids).toEqual([]);
    expect(metrics.ordinary_l2a_satisfied_gate_ids).toEqual(expect.arrayContaining([
      'analysis_evidence_state_gate',
      'evidence_anchor_aggregate_gate',
      'public_claim_support_gate',
      'score_trace_internal_gate',
      'technique_observation_internal_gate',
      'model_run_trace_gate',
      'validator_trace_gate',
      'gate_trace_gate',
      'report_parity_gate',
      'no_export_gate',
    ]));
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.public_comparison_recommendation_status).toBe('blocked');
    expect(metrics.public_scoring_suppression_proof_status).toBe('satisfied');
    expect(metrics.public_technique_authority_suppression_proof_status).toBe('satisfied');
    expect(metrics.public_comparison_recommendation_suppression_proof_status).toBe('not_applicable');
    expect(metrics.global_level2_evidence_status).toBe('satisfied');
    expect(metrics.global_level2_release_status).toBe('blocked');
    expect(metrics.global_level2_acceptance_status).toBe('not_accepted');
    expect(metrics.level2_blocker_codes).toEqual(expect.arrayContaining([
      'public_scoring_feature_approval_blocked',
      'public_technique_authority_feature_approval_blocked',
      'public_comparison_recommendation_feature_approval_blocked',
      'production_public_authority_gates_blocked',
      'customer_release_gates_blocked',
    ]));
  });

  it('keeps ordinary L2A insufficient when ModelRunTrace lacks a required stage boundary', () => {
    const metrics = buildQAAcceptanceMetrics(completeOrdinaryManifest({
      artefact_level2_spine_satisfaction_by_id: {
        ...completeOrdinaryManifest().artefact_level2_spine_satisfaction_by_id,
        model_run_trace: false,
      },
      model_run_trace_summary: {
        model_run_trace_gate_status: 'insufficient',
        independent_model_proof_status: 'independent_model_proof_partial',
        per_stage_model_proof_status: 'partial_missing_stage_boundaries',
        raw_prompt_or_response_stored: false,
        secrets_or_signed_urls_stored: false,
      },
    }));

    expect(metrics.ordinary_l2a_analysis_proof_status).toBe('insufficient');
    expect(metrics.ordinary_l2a_unsatisfied_gate_ids).toContain('model_run_trace_gate');
    expect(metrics.ordinary_l2a_analysis_proof_blocker_codes).toContain('model_run_gate_blocked');
  });

  it('finalises ModelRunTrace only when expected invoked model stages have refs and no prompt or secret storage', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19d-modelrun-'));
    const out = await emitModelRunTraceFirstPass({
      run_id: 'r19d-model',
      analysis_run_id: 'r19d-model',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      root_dir: root,
      internal_qa_emit: true,
      model_run_entries: [
        {
          model_run_id: 'mr-step1',
          stage: 'analysis_step_1_evidence_mapping',
          invocation_status: 'invoked',
          request_status: 'completed',
          input_artifact_refs: ['inputs/input_record.json'],
          output_artifact_refs: ['analysis/Step1ObservableEvidence.json'],
          raw_prompt_or_response_stored: false,
          secrets_or_signed_urls_stored: false,
        },
        {
          model_run_id: 'mr-step2',
          stage: 'analysis_step_2_judgement_or_report_generation',
          invocation_status: 'invoked',
          request_status: 'completed',
          input_artifact_refs: ['analysis/AnalysisEvidenceState.json'],
          output_artifact_refs: ['reports/raw_report.json'],
          raw_prompt_or_response_stored: false,
          secrets_or_signed_urls_stored: false,
        },
      ],
    });

    expect(out.written).toBe(true);
    expect(out.level2_satisfies).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'r19d-model', 'takes', 'take-t1', 'analysis-r19d-model', 'traces', 'ModelRunTrace.json'), 'utf8'));
    expect(payload.source_classification).toBe('independent_model_run_trace');
    expect(payload.model_run_trace_summary.model_run_trace_gate_status).toBe('satisfied');
    expect(payload.model_run_trace_summary.required_model_stage_ids).toEqual(['analysis_step_1_evidence_mapping', 'analysis_step_2_judgement_or_report_generation']);
    expect(payload.model_run_entries.map((entry: any) => entry.stage_id)).toEqual(expect.arrayContaining([
      'input_capture',
      'resolver',
      'analysis_step_1_evidence_mapping',
      'analysis_step_2_judgement_or_report_generation',
      'report_parity',
      'no_export_proof',
      'validator',
      'gate_finalisation',
      'comparison_not_applicable_for_ordinary_run',
    ]));
    expect(payload.raw_prompt_or_response_stored).toBe(false);
    expect(payload.secrets_or_signed_urls_stored).toBe(false);
  });

  it('lets ValidatorTrace and GateTrace satisfy ordinary proof while public release gates stay blocked', async () => {
    const metrics = buildQAAcceptanceMetrics(completeOrdinaryManifest());
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19d-proof-'));
    const base = {
      run_id: 'r19d-proof',
      analysis_run_id: 'r19d-proof',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: emittedOrdinaryArtefacts,
      acceptance_metrics_snapshot: metrics,
      manifest_snapshot: completeOrdinaryManifest(),
    };

    const validator = await emitValidatorTraceFirstPass(base);
    expect(validator.written).toBe(true);
    expect(validator.validator_trace_summary?.validator_trace_gate_status).toBe('satisfied');

    const gate = await emitGateTraceFirstPass({
      ...base,
      validator_trace_summary: validator.validator_trace_summary,
    });
    expect(gate.written).toBe(true);
    expect(gate.gate_trace_summary?.gate_trace_gate_status).toBe('satisfied');

    const gatePayload = JSON.parse(await readFile(path.join(root, 'r19d-proof', 'takes', 'take-t1', 'analysis-r19d-proof', 'traces', 'GateTrace.json'), 'utf8'));
    expect(gatePayload.ordinary_l2a_analysis_proof_status).toBe('satisfied');
    expect(gatePayload.public_scoring_suppression_proof_status).toBe('satisfied');
    expect(gatePayload.public_technique_authority_suppression_proof_status).toBe('satisfied');
    expect(gatePayload.public_comparison_recommendation_suppression_proof_status).toBe('not_applicable');
    expect(gatePayload.global_level2_evidence_status).toBe('satisfied');
    expect(gatePayload.global_level2_release_status).toBe('blocked');
    expect(gatePayload.global_level2_acceptance_status).toBe('not_accepted');
    expect(gatePayload.level2_status).toBe('not_accepted');
    expect(gatePayload.public_output_permissions).toEqual({
      show_overall_score: false,
      show_public_technique_names: false,
      show_repertoire_claims: false,
      show_comparison_recommendation: false,
      show_public_report: false,
    });
    expect(gatePayload.gate_entries.find((entry: any) => entry.gate_id === 'global_level2_acceptance_gate')?.status).toBe('blocked');
    expect(gatePayload.gate_entries.find((entry: any) => entry.gate_id === 'global_level2_evidence_gate')?.status).toBe('passed');
    expect(gatePayload.gate_entries.find((entry: any) => entry.gate_id === 'public_scoring_suppression_proof_gate')?.status).toBe('passed');
    expect(gatePayload.gate_entries.find((entry: any) => entry.gate_id === 'public_technique_authority_suppression_proof_gate')?.status).toBe('passed');
    expect(gatePayload.gate_entries.find((entry: any) => entry.gate_id === 'public_comparison_recommendation_suppression_proof_gate')?.status).toBe('not_applicable');
    expect(gatePayload.gate_entries.find((entry: any) => entry.gate_id === 'public_scoring_gate')?.status).toBe('blocked');
    expect(gatePayload.gate_entries.find((entry: any) => entry.gate_id === 'public_technique_authority_gate')?.status).toBe('blocked');
    expect(gatePayload.gate_entries.find((entry: any) => entry.gate_id === 'production_safe_gate')?.status).toBe('blocked');
  });
});
