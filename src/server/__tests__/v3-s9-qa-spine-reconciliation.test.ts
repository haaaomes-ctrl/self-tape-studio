import { describe, expect, it } from 'vitest';
import { QA_SPINE_RECONCILIATION_VERSION, reconcileQASpineStatus, type QASpineReconciliationInput } from '@/server/v3/qa-spine-reconciliation.server';

function completeOrdinaryInput(overrides: Partial<QASpineReconciliationInput> = {}): QASpineReconciliationInput {
  return {
    analysisEvidenceStateGateStatus: 'satisfied',
    completeFamilyCount: 5,
    missingFamilyCount: 0,
    analysisEvidenceStateBlockers: [],
    evidenceAnchorAggregateStatus: 'sufficient',
    publicClaimGateBlocked: false,
    claimCandidateGateBlocked: false,
    scoreTraceInternalBlocked: false,
    techniqueTraceInternalBlocked: false,
    modelRunGateBlocked: false,
    gateTraceInternalBlocked: false,
    validatorTraceInternalBlocked: false,
    gateTraceCannotSatisfyLevel2: false,
    validatorTraceCannotSatisfyLevel2: false,
    reportParityPassed: true,
    noExportComplete: true,
    comparisonScope: 'ordinary_single_take',
    comparisonParityStatus: 'not_applicable',
    comparisonBlockers: ['parity_artefacts_missing'],
    runtimeOperatorVerificationStatus: 'required',
    runtimeBundleFreshnessStatus: 'unknown',
    runtimeCurrentImplementationStatus: 'unknown',
    deploymentProvenanceStatus: 'unknown_no_safe_env_var_found',
    operatorConfirmationStatus: 'missing',
    publicScoringStatus: 'blocked',
    publicTechniqueAuthorityStatus: 'blocked',
    publicComparisonRecommendationStatus: 'blocked',
    productionSafeStatus: 'blocked',
    customerReleaseStatus: 'blocked',
    rawReportLegacyAdapterPresent: true,
    rawReportUsedAsSatisfyingEvidence: false,
    ...overrides,
  };
}

describe('v3 s9 qa spine reconciliation reducer', () => {
  it('satisfies complete ordinary proof while keeping release blockers separate', () => {
    const out = reconcileQASpineStatus(completeOrdinaryInput());

    expect(out.qa_spine_reconciliation_version).toBe(QA_SPINE_RECONCILIATION_VERSION);
    expect(out.ordinary_internal_proof_status).toBe('satisfied');
    expect(out.ordinary_internal_blockers).toEqual([]);
    expect(out.comparison_blockers).toEqual([]);
    expect(out.release_blockers).toEqual(expect.arrayContaining([
      'runtime_operator_verification_required',
      'deployment_provenance_or_operator_confirmation_required',
      'production_public_authority_gates_blocked',
      'customer_release_gates_blocked',
    ]));
    expect(out.acceptance_decision).toBe('not_accepted');
    expect(out.acceptance_reasons).not.toContain('ordinary internal analysis proof incomplete');
    expect(out.acceptance_reasons).not.toContain('qa_acceptance_metrics emitted but does not satisfy evidence gates');
    expect(out.acceptance_reasons).not.toContain('raw_report is legacy_adapter where applicable');
    expect(out.acceptance_reasons).not.toContain('ValidatorTrace_internal_only');
    expect(out.acceptance_reasons).not.toContain('GateTrace_internal_only');
    expect(out.acceptance_reasons).not.toContain('parity_artefacts_missing');
  });

  it('preserves exact ordinary blockers for incomplete family evidence', () => {
    const out = reconcileQASpineStatus(completeOrdinaryInput({
      analysisEvidenceStateGateStatus: 'insufficient',
      completeFamilyCount: 3,
      missingFamilyCount: 2,
      analysisEvidenceStateBlockers: ['missing_material_specific_performance_evidence', 'missing_performance_observable_evidence'],
      evidenceAnchorAggregateStatus: 'insufficient',
    }));

    expect(out.ordinary_internal_proof_status).toBe('insufficient');
    expect(out.ordinary_internal_blockers).toEqual(expect.arrayContaining([
      'analysis_evidence_state_gate_insufficient',
      'required_family_completion_count_not_satisfied',
      'required_family_missing_count_nonzero',
      'missing_material_specific_performance_evidence',
      'missing_performance_observable_evidence',
      'evidence_anchor_aggregate_insufficient',
    ]));
    expect(out.acceptance_reasons).toContain('ordinary internal analysis proof incomplete');
  });

  it('fails closed when required reducer inputs are missing', () => {
    const out = reconcileQASpineStatus(completeOrdinaryInput({
      analysisEvidenceStateGateStatus: undefined,
      evidenceAnchorAggregateStatus: undefined,
      reportParityPassed: undefined,
      noExportComplete: undefined,
      runtimeOperatorVerificationStatus: undefined,
    }));

    expect(out.ordinary_internal_blockers).toEqual(expect.arrayContaining([
      'missing_analysis_evidence_state_status',
      'missing_evidence_anchor_aggregate_status',
      'missing_report_parity_status',
      'missing_no_export_status',
    ]));
    expect(out.release_blockers).toContain('missing_runtime_verification_status');
  });

  it('ignores stale compatibility ordinary status when low-level proof is complete', () => {
    const out = reconcileQASpineStatus(completeOrdinaryInput({
      compatibilityOrdinaryL2AStatus: 'insufficient:ValidatorTrace_internal_only,GateTrace_internal_only',
    }));

    expect(out.ordinary_internal_proof_status).toBe('satisfied');
    expect(out.ordinary_internal_blockers).toEqual([]);
    expect(out.acceptance_reasons).not.toContain('ordinary internal analysis proof incomplete');
    expect(out.acceptance_reasons).not.toContain('ValidatorTrace_internal_only');
    expect(out.acceptance_reasons).not.toContain('GateTrace_internal_only');
    expect(out.diagnostic_reasons).toContain('compatibility_ordinary_l2a_analysis_proof_status=insufficient:ValidatorTrace_internal_only,GateTrace_internal_only');
  });

  it('keeps comparison fail-closed blockers separate from ordinary proof', () => {
    const out = reconcileQASpineStatus(completeOrdinaryInput({
      comparisonScope: 'comparison_invoked',
      comparisonParityStatus: 'fail_closed',
      comparisonBlockers: ['duplicate_same_video_suppressed_without_decisive_evidence_delta'],
    }));

    expect(out.ordinary_internal_proof_status).toBe('satisfied');
    expect(out.ordinary_internal_blockers).toEqual([]);
    expect(out.comparison_blockers).toEqual(['duplicate_same_video_suppressed_without_decisive_evidence_delta']);
    expect(out.acceptance_reasons).toContain('duplicate same-video comparison suppressed without decisive evidence delta');
  });

  it('keeps raw report legacy adapter diagnostic-only when not used as evidence', () => {
    const out = reconcileQASpineStatus(completeOrdinaryInput({
      rawReportLegacyAdapterPresent: true,
      rawReportUsedAsSatisfyingEvidence: false,
    }));

    expect(out.diagnostic_reasons).toContain('raw_report legacy_adapter emitted as diagnostic only; not used as v3 evidence spine');
    expect(out.acceptance_reasons).not.toContain('raw_report is legacy_adapter where applicable');
  });
});
