export const QA_SPINE_RECONCILIATION_VERSION = 's9_19o_minimum_v1';

export type QAReconciliationStatus = 'satisfied' | 'insufficient' | 'blocked' | 'not_applicable';
export type QAComparisonScope = 'ordinary_single_take' | 'comparison_invoked' | 'comparison_only';

export interface QASpineReconciliationInput {
  analysisEvidenceStateGateStatus?: string | null;
  completeFamilyCount?: number | null;
  missingFamilyCount?: number | null;
  analysisEvidenceStateBlockers?: string[] | null;
  evidenceAnchorAggregateStatus?: string | null;
  publicClaimGateBlocked?: boolean | null;
  claimCandidateGateBlocked?: boolean | null;
  scoreTraceInternalBlocked?: boolean | null;
  techniqueTraceInternalBlocked?: boolean | null;
  modelRunGateBlocked?: boolean | null;
  gateTraceInternalBlocked?: boolean | null;
  validatorTraceInternalBlocked?: boolean | null;
  gateTraceCannotSatisfyLevel2?: boolean | null;
  validatorTraceCannotSatisfyLevel2?: boolean | null;
  reportParityPassed?: boolean | null;
  noExportComplete?: boolean | null;
  comparisonScope?: QAComparisonScope | null;
  comparisonParityStatus?: string | null;
  comparisonBlockers?: string[] | null;
  runtimeOperatorVerificationStatus?: string | null;
  runtimeBundleFreshnessStatus?: string | null;
  runtimeCurrentImplementationStatus?: string | null;
  deploymentProvenanceStatus?: string | null;
  operatorConfirmationStatus?: string | null;
  publicScoringStatus?: string | null;
  publicTechniqueAuthorityStatus?: string | null;
  publicComparisonRecommendationStatus?: string | null;
  productionSafeStatus?: string | null;
  customerReleaseStatus?: string | null;
  rawReportLegacyAdapterPresent?: boolean | null;
  rawReportUsedAsSatisfyingEvidence?: boolean | null;
  compatibilityOrdinaryL2AStatus?: string | null;
}

export interface QASpineReconciliationResult {
  qa_spine_reconciliation_version: typeof QA_SPINE_RECONCILIATION_VERSION;
  ordinary_internal_proof_status: QAReconciliationStatus;
  ordinary_internal_blockers: string[];
  release_blockers: string[];
  comparison_blockers: string[];
  acceptance_decision: 'accepted' | 'not_accepted';
  acceptance_reasons: string[];
  diagnostic_reasons: string[];
}

function unique(values: Array<string | null | undefined | false>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function isUnknown(value: unknown): boolean {
  return isMissing(value) || String(value).trim() === 'unknown';
}

function statusIsOneOf(value: unknown, allowed: string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

function boolBlocker(value: boolean | null | undefined, missingCode: string, blockedCode: string): string | null {
  if (typeof value !== 'boolean') return missingCode;
  return value ? blockedCode : null;
}

function blockerReason(code: string): string {
  switch (code) {
    case 'ordinary_internal_analysis_proof_incomplete':
      return 'ordinary internal analysis proof incomplete';
    case 'runtime_operator_verification_required':
      return 'runtime/operator verification required';
    case 'runtime_bundle_freshness_required':
      return 'runtime bundle freshness required';
    case 'runtime_bundle_current_implementation_required':
      return 'runtime bundle current implementation match required';
    case 'deployment_provenance_or_operator_confirmation_required':
      return 'deployment provenance or operator confirmation required';
    case 'production_public_authority_gates_blocked':
      return 'production/public authority gates blocked';
    case 'customer_release_gates_blocked':
      return 'customer release gates blocked';
    case 'public_scoring_feature_approval_blocked':
      return 'public scoring feature approval blocked';
    case 'public_technique_authority_feature_approval_blocked':
      return 'public technique authority feature approval blocked';
    case 'public_comparison_recommendation_feature_approval_blocked':
      return 'public comparison recommendation feature approval blocked';
    case 'duplicate_same_video_suppressed_without_decisive_evidence_delta':
      return 'duplicate same-video comparison suppressed without decisive evidence delta';
    case 'comparison_level2_fail_closed':
      return 'comparison Level 2 fail-closed';
    case 'comparison_level2_insufficient':
      return 'comparison Level 2 insufficient';
    case 'comparison_level2_blocked':
      return 'comparison Level 2 blocked';
    case 'comparison_parity_missing':
      return 'comparison parity missing';
    default:
      return code;
  }
}

export function reconcileQASpineStatus(input: QASpineReconciliationInput): QASpineReconciliationResult {
  const ordinaryBlockers: string[] = [];
  const comparisonScope = input.comparisonScope ?? null;

  if (comparisonScope === 'comparison_only') {
    // Comparison-only bundles do not make a claim about ordinary single-take L2-A.
  } else {
    if (isUnknown(input.analysisEvidenceStateGateStatus)) {
      ordinaryBlockers.push('missing_analysis_evidence_state_status');
    } else if (input.analysisEvidenceStateGateStatus !== 'satisfied') {
      ordinaryBlockers.push('analysis_evidence_state_gate_insufficient');
    }

    if (typeof input.completeFamilyCount !== 'number' || !Number.isFinite(input.completeFamilyCount)) {
      ordinaryBlockers.push('missing_complete_family_count');
    } else if (input.completeFamilyCount !== 5) {
      ordinaryBlockers.push('required_family_completion_count_not_satisfied');
    }

    if (typeof input.missingFamilyCount !== 'number' || !Number.isFinite(input.missingFamilyCount)) {
      ordinaryBlockers.push('missing_missing_family_count');
    } else if (input.missingFamilyCount !== 0) {
      ordinaryBlockers.push('required_family_missing_count_nonzero');
    }

    ordinaryBlockers.push(...(input.analysisEvidenceStateBlockers ?? []));

    if (isUnknown(input.evidenceAnchorAggregateStatus)) {
      ordinaryBlockers.push('missing_evidence_anchor_aggregate_status');
    } else if (!statusIsOneOf(input.evidenceAnchorAggregateStatus, ['sufficient', 'satisfied'])) {
      ordinaryBlockers.push('evidence_anchor_aggregate_insufficient');
    }

    ordinaryBlockers.push(...[
      boolBlocker(input.publicClaimGateBlocked, 'missing_public_claim_gate_status', 'public_claim_support_gate_blocked'),
      boolBlocker(input.claimCandidateGateBlocked, 'missing_claim_candidate_gate_status', 'claim_candidate_support_gate_blocked'),
      boolBlocker(input.scoreTraceInternalBlocked, 'missing_score_trace_internal_status', 'score_trace_internal_gate_blocked'),
      boolBlocker(input.techniqueTraceInternalBlocked, 'missing_technique_trace_internal_status', 'technique_trace_internal_gate_blocked'),
      boolBlocker(input.modelRunGateBlocked, 'missing_model_run_gate_status', 'model_run_gate_blocked'),
      boolBlocker(input.gateTraceInternalBlocked, 'missing_gate_trace_internal_status', 'gate_trace_internal_gate_blocked'),
      boolBlocker(input.validatorTraceInternalBlocked, 'missing_validator_trace_internal_status', 'validator_trace_internal_gate_blocked'),
      boolBlocker(input.gateTraceCannotSatisfyLevel2, 'missing_gate_trace_cannot_satisfy_status', 'gate_trace_cannot_satisfy_level2'),
      boolBlocker(input.validatorTraceCannotSatisfyLevel2, 'missing_validator_trace_cannot_satisfy_status', 'validator_trace_cannot_satisfy_level2'),
    ].filter((code): code is string => Boolean(code)));

    if (typeof input.reportParityPassed !== 'boolean') {
      ordinaryBlockers.push('missing_report_parity_status');
    } else if (!input.reportParityPassed) {
      ordinaryBlockers.push('report_parity_not_passed');
    }

    if (typeof input.noExportComplete !== 'boolean') {
      ordinaryBlockers.push('missing_no_export_status');
    } else if (!input.noExportComplete) {
      ordinaryBlockers.push('no_export_proof_not_complete');
    }

    if (!comparisonScope) {
      ordinaryBlockers.push('missing_comparison_scope');
    }
  }

  const ordinary_internal_blockers = unique(ordinaryBlockers);
  const ordinary_internal_proof_status: QAReconciliationStatus = comparisonScope === 'comparison_only'
    ? 'not_applicable'
    : (ordinary_internal_blockers.length === 0 ? 'satisfied' : 'insufficient');

  const releaseBlockers: string[] = [];
  if (isMissing(input.runtimeOperatorVerificationStatus)) {
    releaseBlockers.push('missing_runtime_verification_status');
  } else if (input.runtimeOperatorVerificationStatus !== 'completed') {
    releaseBlockers.push('runtime_operator_verification_required');
  }

  if (isMissing(input.runtimeBundleFreshnessStatus)) {
    releaseBlockers.push('missing_runtime_bundle_freshness_status');
  } else if (!statusIsOneOf(input.runtimeBundleFreshnessStatus, ['fresh', 'verified_fresh', 'current'])) {
    releaseBlockers.push('runtime_bundle_freshness_required');
  }

  if (isMissing(input.runtimeCurrentImplementationStatus)) {
    releaseBlockers.push('missing_runtime_current_implementation_status');
  } else if (!statusIsOneOf(input.runtimeCurrentImplementationStatus, ['matched', 'matches_current_commit', 'current_commit_matched', 'matches', 'operator_confirmed', 'matches_current_implementation', 'current_implementation_matched'])) {
    releaseBlockers.push('runtime_bundle_current_implementation_required');
  }

  const deploymentResolved = input.deploymentProvenanceStatus === 'resolved' || input.operatorConfirmationStatus === 'confirmed';
  if (isMissing(input.deploymentProvenanceStatus) && isMissing(input.operatorConfirmationStatus)) {
    releaseBlockers.push('missing_deployment_provenance_status');
  } else if (!deploymentResolved) {
    releaseBlockers.push('deployment_provenance_or_operator_confirmation_required');
  }

  if (isMissing(input.publicScoringStatus)) releaseBlockers.push('missing_public_scoring_status');
  else if (input.publicScoringStatus === 'blocked') releaseBlockers.push('public_scoring_feature_approval_blocked');

  if (isMissing(input.publicTechniqueAuthorityStatus)) releaseBlockers.push('missing_public_technique_authority_status');
  else if (input.publicTechniqueAuthorityStatus === 'blocked') releaseBlockers.push('public_technique_authority_feature_approval_blocked');

  if (isMissing(input.publicComparisonRecommendationStatus)) releaseBlockers.push('missing_public_comparison_recommendation_status');
  else if (input.publicComparisonRecommendationStatus === 'blocked') releaseBlockers.push('public_comparison_recommendation_feature_approval_blocked');

  if (isMissing(input.productionSafeStatus)) releaseBlockers.push('missing_production_safe_status');
  else if (input.productionSafeStatus === 'blocked') releaseBlockers.push('production_public_authority_gates_blocked');

  if (isMissing(input.customerReleaseStatus)) releaseBlockers.push('missing_customer_release_status');
  else if (input.customerReleaseStatus === 'blocked') releaseBlockers.push('customer_release_gates_blocked');

  const release_blockers = unique(releaseBlockers);

  const comparisonBlockers: string[] = [];
  if (comparisonScope === 'comparison_invoked' || comparisonScope === 'comparison_only') {
    comparisonBlockers.push(...(input.comparisonBlockers ?? []));
    if (isUnknown(input.comparisonParityStatus)) {
      comparisonBlockers.push('comparison_parity_missing');
    } else if (comparisonBlockers.length === 0 && input.comparisonParityStatus !== 'passed' && input.comparisonParityStatus !== 'satisfied_suppression_only') {
      comparisonBlockers.push(input.comparisonParityStatus === 'fail_closed'
        ? 'comparison_level2_fail_closed'
        : (input.comparisonParityStatus === 'blocked' ? 'comparison_level2_blocked' : 'comparison_level2_insufficient'));
    }
  }
  const comparison_blockers = unique(comparisonBlockers);

  const diagnosticReasons = unique([
    input.rawReportLegacyAdapterPresent && !input.rawReportUsedAsSatisfyingEvidence
      ? 'raw_report legacy_adapter emitted as diagnostic only; not used as v3 evidence spine'
      : null,
    input.rawReportLegacyAdapterPresent && input.rawReportUsedAsSatisfyingEvidence
      ? 'raw_report legacy_adapter unexpectedly used as satisfying evidence'
      : null,
    'qa_acceptance_metrics_projection_used',
    input.compatibilityOrdinaryL2AStatus
      ? `compatibility_ordinary_l2a_analysis_proof_status=${input.compatibilityOrdinaryL2AStatus}`
      : null,
  ]);

  const ordinaryReasons = ordinary_internal_blockers.length === 0
    ? []
    : ['ordinary internal analysis proof incomplete', `ordinary_internal_blockers:${ordinary_internal_blockers.join(',')}`];
  const releaseReasons = release_blockers.length === 0
    ? []
    : ['missing or blocked required global Level 2 release gates', ...release_blockers.map(blockerReason)];
  const comparisonReasons = comparison_blockers.map(blockerReason);
  const acceptance_reasons = unique([
    ...ordinaryReasons,
    ...releaseReasons,
    ...comparisonReasons,
  ]);

  const acceptance_decision = ordinary_internal_blockers.length === 0
    && release_blockers.length === 0
    && comparison_blockers.length === 0
    ? 'accepted'
    : 'not_accepted';

  return {
    qa_spine_reconciliation_version: QA_SPINE_RECONCILIATION_VERSION,
    ordinary_internal_proof_status,
    ordinary_internal_blockers,
    release_blockers,
    comparison_blockers,
    acceptance_decision,
    acceptance_reasons,
    diagnostic_reasons: diagnosticReasons,
  };
}
