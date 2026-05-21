import { describe, expect, it } from 'vitest';
import {
  buildEvidencePassToolForProvider,
  classifyEvidencePassSafeErrorCategory,
  filterRunEvidencePassForStep1,
} from '@/server/evidence-pass.server';
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

function arrayTypePaths(value: unknown, path = 'tool'): string[] {
  if (Array.isArray(value)) return [];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const childPath = `${path}.${key}`;
    if (key === 'type' && Array.isArray(child)) return [childPath];
    return arrayTypePaths(child, childPath);
  });
}

function completeRuntimeManifest(overrides: Record<string, unknown> = {}) {
  return {
    run_id: 'r19g',
    analysis_run_id: 'r19g',
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
      technique_observation_trace: 'legacy_adapter',
      model_run_trace: 'independent_model_run_trace',
      validator_trace: 'independent_validation_satisfying',
      gate_trace: 'independent_gate_decision',
      parity_report: 'real_runtime_v3',
      no_export_proof: 'real_runtime_v3',
    },
    artefact_level2_spine_satisfaction_by_id: {
      step1_observable_evidence: true,
      analysis_evidence_state: true,
      evidence_anchors: false,
      public_claim_trace: false,
      score_trace: true,
      technique_observation_trace: false,
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
      evidence_anchor_gate_status: 'insufficient',
      source_family_summary: { real_runtime_v3: 6 },
      blocker_codes: ['anchor_cannot_satisfy_v3_gate'],
    },
    public_claim_trace_summary: {
      public_claim_gate_status: 'insufficient',
      public_claim_trace_gate_status: 'insufficient',
      public_claim_gate_reason: 'evidence_anchor_aggregate_insufficient',
      unsupported_claim_count: 0,
      rewrite_required_count: 0,
      unsafe_or_overclaim_count: 0,
      public_score_claim_count: 0,
      public_technique_authority_claim_count: 0,
    },
    score_trace_summary: {
      score_trace_gate_status: 'satisfied',
      source_classification: 'real_runtime_v3_internal_score_proof',
      source_family_summary: { real_runtime_v3: 1 },
      real_runtime_v3_internal_score_entry_count: 1,
      overall_readiness_public_score_status: 'blocked',
    },
    technique_observation_trace_summary: {
      technique_observation_trace_gate_status: 'insufficient',
      source_classification: 'legacy_adapter',
      public_technique_authority_status: 'blocked',
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
    ...overrides,
  };
}

describe('S9-19G Step 1 evidence pass, suppression wiring, and technique proof', () => {
  it('uses a provider-compatible Step 1 tool schema and safe HTTP 400 classification', () => {
    const tool = buildEvidencePassToolForProvider() as unknown as Record<string, unknown>;

    expect(arrayTypePaths(tool)).toEqual([]);
    expect((tool.function as any).parameters.properties.candidate_technique_evidence).toBeDefined();
    expect(classifyEvidencePassSafeErrorCategory(400, 'provider rejected request schema')).toBe('provider_request_contract_error');
    expect(classifyEvidencePassSafeErrorCategory(504, 'timeout')).toBe('provider_timeout');
  });

  it('projects safe Step 1 material, performance and internal technique observations while rejecting judgements', () => {
    const filtered = filterRunEvidencePassForStep1({
      detected_components: [{ type: 'song', weight: 1, score: 92, note: 'Strong performance.' }],
      timestamped_evidence: [
        { timestamp: '00:05', observation: 'Eyeline shifts toward the reader before the pause.', linked_category: 'acting' },
        { timestamp: '00:08', observation: 'Audio is audible through the final phrase.', linked_category: 'audio' },
        { timestamp: '00:12', observation: 'Ready to submit because the performance is strong.', linked_category: 'acting' },
      ],
      presentation_evidence: ['Head and shoulders framing remains visible.'],
      evidence_sufficiency: { audio_assessable: true, video_assessable: true, movement_assessable: true, notes: 'Assessable.' },
      overall_score: 94,
      role_fit_evidence: 'Perfect role fit.',
    }, { model: 'unit-step1', durationSeconds: 30 });

    expect(filtered.material_observable_evidence_items).toHaveLength(1);
    expect(filtered.performance_observable_evidence_items).toHaveLength(1);
    expect(filtered.candidate_technique_evidence).toHaveLength(1);
    expect(filtered.candidate_technique_evidence[0].safe_evidence_summary).toContain('Internal descriptor candidate only');
    expect(filtered.rejected_or_filtered_fields).toEqual(expect.arrayContaining([
      'detected_components[].score',
      'timestamped_evidence[2].observation',
      'overall_score',
      'role_fit_evidence',
    ]));
  });

  it('satisfies score and technique suppression absence proof without requiring public claim aggregate or internal technique proof', () => {
    const metrics = buildQAAcceptanceMetrics(completeRuntimeManifest());

    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_scoring_suppression_proof_status).toBe('satisfied');
    expect(metrics.public_scoring_suppression_blocker_codes).not.toContain('public_score_absence_not_validated_by_report_parity');
    expect(metrics.public_scoring_suppression_blocker_codes).not.toContain('public_score_claim_suppression_not_validated');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.technique_observation_gate_status).toBe('insufficient');
    expect(metrics.public_technique_authority_suppression_proof_status).toBe('satisfied');
    expect(metrics.public_technique_authority_suppression_blocker_codes).not.toContain('technique_observation_internal_proof_not_satisfied');
    expect(metrics.public_technique_authority_content_scan_status).toBe('satisfied');
  });

  it('keeps public technique suppression insufficient when unsuppressed authority claims remain', () => {
    const metrics = buildQAAcceptanceMetrics(completeRuntimeManifest({
      public_claim_trace_summary: {
        public_claim_gate_status: 'insufficient',
        public_claim_trace_gate_status: 'insufficient',
        unsupported_claim_count: 0,
        rewrite_required_count: 0,
        unsafe_or_overclaim_count: 0,
        public_technique_authority_claim_count: 1,
        unsuppressed_public_technique_authority_claim_count: 1,
      },
    }));

    expect(metrics.public_technique_authority_suppression_proof_status).toBe('insufficient');
    expect(metrics.public_technique_authority_suppression_blocker_codes).toContain('public_technique_claim_suppression_not_validated');
    expect(metrics.public_technique_authority_feature_status).toBe('blocked');
  });
});
