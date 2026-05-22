import { describe, expect, it } from 'vitest';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

function completeOrdinaryManifest(overrides: Record<string, any> = {}) {
  const emittedArtifacts = [
    'raw_report',
    'step1_observable_evidence',
    'analysis_evidence_state',
    'truth_state_map',
    'evidence_anchors',
    'public_claim_trace',
    'claim_candidate_trace',
    'score_trace',
    'technique_observation_trace',
    'model_run_trace',
    'validator_trace',
    'gate_trace',
    'parity_report',
    'no_export_proof',
    'qa_acceptance_metrics',
  ];
  const artefactStatusById = Object.fromEntries(emittedArtifacts.map((id) => [id, 'emitted']));
  const realRuntimeSpineIds = emittedArtifacts.filter((id) => !['raw_report', 'qa_acceptance_metrics'].includes(id));
  const artefactSourceClassificationById = {
    raw_report: 'legacy_adapter',
    step1_observable_evidence: 'real_runtime_v3',
    analysis_evidence_state: 'real_runtime_v3',
    truth_state_map: 'real_runtime_v3',
    evidence_anchors: 'real_runtime_v3',
    public_claim_trace: 'real_runtime_v3_claim_support',
    claim_candidate_trace: 'real_runtime_v3_candidate_source',
    score_trace: 'real_runtime_v3_internal_score_proof',
    technique_observation_trace: 'real_runtime_v3_internal_technique_observation',
    model_run_trace: 'internal_model_run_trace',
    validator_trace: 'internal_validator',
    gate_trace: 'internal_gate_trace',
    parity_report: 'internal_report_parity_proof',
    no_export_proof: 'internal_no_export_proof_bundle',
    qa_acceptance_metrics: 'real_runtime_v3',
  };
  const artefactLevel2SpineSatisfactionById = Object.fromEntries(
    emittedArtifacts.map((id) => [id, id !== 'raw_report']),
  );

  return {
    run_id: 'run-s9-19n-complete',
    analysis_run_id: 'run-s9-19n-complete',
    submission_id: 'submission-s9-19n',
    take_id: 'take-s9-19n',
    compared_take_ids: ['take-s9-19n'],
    comparison_run_id: null,
    generated_at: new Date('2026-05-22T12:00:00.000Z').toISOString(),
    qa_artifact_root: 'qa-artifacts',
    emitted_artifacts: emittedArtifacts,
    missing_artifacts: [],
    emitted_blocked_artefact_ids: [],
    deferred_artifact_ids: [],
    not_applicable_artifact_ids: [],
    blocker_codes: [],
    required_artifacts: [],
    runtime_evidence_accepted_by_id: realRuntimeSpineIds,
    runtime_evidence_blocked_by_id: [],
    artefact_status_by_id: artefactStatusById,
    artefact_source_classification_by_id: artefactSourceClassificationById,
    artefact_level2_spine_satisfaction_by_id: artefactLevel2SpineSatisfactionById,
    legacy_adapter_artefact_ids: ['raw_report'],
    real_v3_spine_artefact_ids: realRuntimeSpineIds,
    public_output_unchanged: true,
    no_export_status: 'no_export_proof_complete',
    analysis_evidence_state_summary: {
      evidence_state_status: 'complete',
      source_classification: 'real_runtime_v3',
      observable_evidence_item_count: 8,
      unsupported_or_unavailable_evidence_count: 0,
      analysis_evidence_state_gate_status: 'satisfied',
      analysis_evidence_state_gate_reason: 'all_required_step1_families_complete',
      ordinary_analysis_proof_bundle_status: 'step1_families_complete_proof_chain_satisfied',
      ordinary_analysis_proof_bundle_gate_status: 'satisfied',
      ordinary_analysis_proof_bundle_gate_reason: 'ordinary_step1_family_truth_anchor_chain_satisfied',
      required_evidence_family_completion_count: 5,
      required_evidence_family_partial_count: 0,
      required_evidence_family_missing_count: 0,
      blocked_family_count: 0,
      accepted_observation_field_count: 8,
      complete_family_count: 5,
      missing_family_count: 0,
      video_observable_evidence_count: 1,
      audio_observable_evidence_count: 1,
      material_specific_performance_evidence_count: 1,
      performance_observable_evidence_count: 1,
      performance_observable_derivation_count: 1,
      candidate_technique_evidence_count: 1,
      truth_state_linkage_status: 'satisfied',
    },
    step1_observable_evidence_summary: {
      extraction_status: 'complete',
      source_classification: 'real_runtime_v3',
      observable_evidence_item_count: 8,
      unsupported_or_unavailable_evidence_count: 0,
      rejected_or_filtered_field_count: 0,
      step1_observable_evidence_gate_status: 'satisfied',
      step1_observable_evidence_gate_reason: 'all_required_step1_family_arrays_present',
      ordinary_analysis_proof_bundle_status: 'step1_families_complete_proof_chain_satisfied',
      ordinary_analysis_proof_bundle_gate_status: 'satisfied',
      required_evidence_family_completion_count: 5,
      required_evidence_family_missing_count: 0,
      complete_family_count: 5,
      missing_family_count: 0,
      accepted_observation_field_count: 8,
      video_observable_evidence_count: 1,
      audio_observable_evidence_count: 1,
      material_specific_performance_evidence_count: 1,
      performance_observable_evidence_count: 1,
      performance_observable_derivation_count: 1,
      candidate_technique_evidence_count: 1,
      truth_state_linkage_status: 'satisfied',
      forbidden_sources_rejected: true,
      internal_only: true,
      public_output_unchanged: true,
    },
    evidence_anchor_trace_summary: {
      evidence_anchor_gate_status: 'sufficient',
      evidence_anchor_gate_reason: 'all_required_family_anchors_truth_linked',
      source_family_summary: { real_runtime_v3: 8, legacy_adapter: 0, report_snapshot: 0, input_artifact: 0, resolver_truth_state: 8 },
    },
    public_claim_trace_summary: {
      public_claim_gate_status: 'sufficient',
      public_claim_gate_reason: 'rendered_public_claims_supported_internal_diagnostics_excluded',
      required_rendered_public_claim_count: 0,
      rendered_public_claim_count: 0,
      not_rendered_internal_trace_count: 2,
      not_rendered_internal_candidate_count: 1,
      excluded_internal_claim_count: 3,
      unsupported_rendered_claim_count: 0,
      unsupported_internal_only_claim_count: 2,
      supported_claim_count: 0,
      unsupported_claim_count: 0,
      suppressed_claim_count: 3,
      blocked_claim_count: 0,
      rewrite_required_count: 0,
      blocker_codes: [],
    },
    claim_candidate_trace_summary: {
      claim_candidate_gate_status: 'sufficient',
      claim_candidate_gate_reason: 'not_rendered_internal_candidates_excluded_from_public_claim_gate',
      claim_candidate_source_summary: { real_runtime_v3: 1, legacy_adapter: 0, report_candidate_requires_support: 0, first_pass_internal: 1, blocked: 0 },
      required_rendered_public_claim_count: 0,
      rendered_public_claim_count: 0,
      not_rendered_internal_candidate_count: 2,
      excluded_internal_claim_count: 2,
      unsupported_rendered_claim_count: 0,
      unsupported_internal_only_claim_count: 2,
      supported_candidate_count: 0,
      unsupported_candidate_count: 0,
      blocked_candidate_count: 0,
      rewrite_required_count: 0,
      blocker_codes: [],
    },
    score_trace_summary: {
      score_count: 1,
      overall_count: 1,
      discipline_attribute_count: 0,
      component_score_count: 0,
      component_weight_count: 0,
      brief_adherence_subscore_count: 0,
      assessment_confidence_count: 0,
      calibration_modifier_count: 0,
      calibration_metadata_count: 0,
      real_runtime_v3_internal_score_entry_count: 1,
      source_family_summary: { real_runtime_v3: 1, legacy_adapter: 0, report_snapshot: 0, input_artifact: 0, resolver_truth_state: 0 },
      overall_readiness_public_score_status: 'blocked',
      discipline_attribute_score_trace_status: 'internal_trace_only',
      score_trace_gate_status: 'satisfied',
      score_trace_gate_reason: 'real_runtime_v3_internal_score_proof_present',
    },
    technique_observation_trace_summary: {
      real_runtime_v3_internal_technique_observation_count: 1,
      real_runtime_v3: 1,
      legacy_adapter: 0,
      report_snapshot: 0,
      input_artifact: 0,
      resolver_truth_state: 1,
      technique_observation_gate_status: 'satisfied',
      public_technique_authority_status: 'blocked',
    },
    model_run_trace_summary: {
      model_run_count: 2,
      model_run_completed_count: 2,
      model_run_failed_count: 0,
      model_run_timeout_count: 0,
      model_run_fallback_count: 0,
      model_run_trace_gate_status: 'satisfied',
      model_run_trace_gate_reason: 'expected_model_stages_completed',
      independent_model_proof_status: 'independent_model_proof_satisfying',
      raw_prompt_or_response_stored: false,
      secrets_or_signed_urls_stored: false,
      forbidden_payload_fields_absent: true,
    },
    validator_trace_summary: {
      validation_count: 12,
      pass_count: 12,
      warning_count: 0,
      fail_count: 0,
      blocked_count: 0,
      validator_trace_gate_status: 'satisfied',
      validator_trace_internal_proof_status: 'satisfied',
      validator_trace_public_release_status: 'blocked',
      ordinary_l2a_validation_status: 'satisfied',
      ordinary_l2a_validation_reason: 'ordinary_internal_validation_satisfied',
      independent_validation_status: 'independent_validation_satisfying',
      validator_trace_internal_blocker_codes: [],
      validator_trace_release_blocker_codes: ['production_safe_blocked', 'customer_release_blocked'],
    },
    gate_trace_summary: {
      gate_count: 12,
      passed_gate_count: 12,
      blocked_gate_count: 0,
      insufficient_gate_count: 0,
      missing_gate_count: 0,
      not_applicable_gate_count: 1,
      gate_trace_gate_status: 'satisfied',
      gate_trace_internal_l2a_status: 'satisfied',
      gate_trace_internal_l2a_reason: 'ordinary_internal_l2a_gate_satisfied',
      gate_trace_release_status: 'blocked',
      ordinary_l2a_analysis_proof_status: 'satisfied',
      independent_gate_decision_status: 'independent_gate_satisfying',
      gate_trace_internal_l2a_blocker_codes: [],
      gate_trace_release_blocker_codes: ['production_safe_blocked', 'customer_release_blocked'],
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
      public_output_permissions_checked: true,
      blocked_score_fields_absent: true,
      blocked_technique_authority_fields_absent: true,
      blocked_comparison_fields_absent: true,
      public_technique_authority_content_scan_safe: true,
    },
    ...overrides,
  };
}

describe('v3 s9 acceptance metrics global reason final reconciliation', () => {
  it('separates complete ordinary internal proof from blocked global release acceptance', () => {
    const metrics = buildQAAcceptanceMetrics(completeOrdinaryManifest());

    expect(metrics.ordinary_internal_proof_status).toBe('satisfied');
    expect(metrics.ordinary_l2a_analysis_proof_status).toBe('satisfied');
    expect(metrics.global_level2_evidence_status).toBe('satisfied');
    expect(metrics.global_level2_suppression_proof_status).toBe('satisfied');
    expect(metrics.global_level2_release_status).toBe('blocked');
    expect(metrics.global_level2_acceptance_status).toBe('not_accepted');
    expect(metrics.acceptance_decision).toBe('not_accepted');
    expect(metrics.acceptance_reasons).not.toContain('ordinary internal analysis proof incomplete');
    expect(metrics.acceptance_reasons).not.toContain('qa_acceptance_metrics emitted but does not satisfy evidence gates');
    expect(metrics.acceptance_reasons).not.toContain('raw_report is legacy_adapter where applicable');
    expect(metrics.release_blocker_reasons).toEqual(expect.arrayContaining([
      'runtime/operator verification required',
      'deployment provenance or operator confirmation required',
      'production/public authority gates blocked',
      'customer release gates blocked',
    ]));
    expect(metrics.diagnostic_reasons).toEqual(expect.arrayContaining([
      'raw_report legacy_adapter emitted as diagnostic only; not used as v3 evidence spine',
      'qa_acceptance_metrics emitted as reconciliation summary; not satisfying evidence by itself',
    ]));
    expect(metrics.non_satisfying_artefact_summary.raw_report).toBe('legacy_adapter_diagnostic_only_not_v3_evidence');
    expect(metrics.non_satisfying_artefact_summary.qa_acceptance_metrics).toBe('reconciliation_summary_not_satisfying_evidence_source');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.customer_release_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.public_comparison_recommendation_status).toBe('blocked');
  });

  it('preserves strict ordinary incomplete reasons when required evidence remains missing', () => {
    const manifest = completeOrdinaryManifest({
      artefact_level2_spine_satisfaction_by_id: {
        ...completeOrdinaryManifest().artefact_level2_spine_satisfaction_by_id,
        analysis_evidence_state: false,
        evidence_anchors: false,
      },
      analysis_evidence_state_summary: {
        evidence_state_status: 'partial',
        source_classification: 'real_runtime_v3',
        observable_evidence_item_count: 4,
        unsupported_or_unavailable_evidence_count: 1,
        analysis_evidence_state_gate_status: 'insufficient',
        analysis_evidence_state_gate_reason: 'missing_performance_observable_evidence',
        ordinary_analysis_proof_bundle_status: 'step1_families_complete_proof_chain_blocked',
        ordinary_analysis_proof_bundle_gate_status: 'insufficient',
        ordinary_analysis_proof_bundle_gate_reason: 'missing_performance_observable_evidence',
        required_evidence_family_completion_count: 4,
        required_evidence_family_missing_count: 1,
        complete_family_count: 4,
        missing_family_count: 1,
        performance_observable_evidence_count: 0,
        performance_observable_derivation_count: 0,
        analysis_evidence_state_remaining_blockers: ['missing_performance_observable_evidence'],
      },
      evidence_anchor_trace_summary: {
        evidence_anchor_gate_status: 'insufficient',
        evidence_anchor_gate_reason: 'missing_performance_observable_anchor',
        source_family_summary: { real_runtime_v3: 4, legacy_adapter: 0, report_snapshot: 0, input_artifact: 0, resolver_truth_state: 4 },
      },
    });
    const metrics = buildQAAcceptanceMetrics(manifest);

    expect(metrics.ordinary_internal_proof_status).toBe('insufficient');
    expect(metrics.ordinary_l2a_analysis_proof_status).toBe('insufficient');
    expect(metrics.ordinary_internal_proof_reasons).toContain('ordinary internal analysis proof incomplete');
    expect(metrics.acceptance_reasons).toContain('ordinary internal analysis proof incomplete');
    expect(metrics.ordinary_l2a_analysis_proof_blocker_codes).toEqual(expect.arrayContaining([
      'AnalysisEvidenceState_insufficient',
      'EvidenceAnchor_trace_insufficient',
    ]));
    expect(metrics.acceptance_reasons).not.toContain('qa_acceptance_metrics emitted but does not satisfy evidence gates');
    expect(metrics.diagnostic_reasons).toContain('qa_acceptance_metrics emitted as reconciliation summary; not satisfying evidence by itself');
  });
});
