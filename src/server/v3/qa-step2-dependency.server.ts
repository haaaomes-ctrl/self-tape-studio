type Step1PersistenceStatus = 'written' | 'failed_emission' | 'skipped' | 'unavailable';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getNonBlankString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function normaliseStatus(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'missing';
}

function matchesRuntimeIdentity(value: Record<string, unknown>, input: {
  expectedRunId: string;
  expectedAnalysisRunId: string;
  takeId: string;
  artefactType: 'resolver_output' | 'truth_state_map';
}): boolean {
  return getNonBlankString(value.artefact_type) === input.artefactType
    && getNonBlankString(value.run_id) === input.expectedRunId
    && getNonBlankString(value.analysis_run_id) === input.expectedAnalysisRunId
    && getNonBlankString(value.take_id) === input.takeId;
}

export function hasValidResolverOutputForStep2(value: unknown, input: {
  expectedRunId: string;
  expectedAnalysisRunId: string;
  takeId: string;
}): boolean {
  if (!isRecord(value)) return false;
  if (!matchesRuntimeIdentity(value, { ...input, artefactType: 'resolver_output' })) return false;
  return isRecord(value.input_artifact_refs) || isRecord(value.v3_spine_available);
}

export function hasValidTruthStateMapForStep2(value: unknown, input: {
  expectedRunId: string;
  expectedAnalysisRunId: string;
  takeId: string;
}): boolean {
  if (!isRecord(value)) return false;
  if (!matchesRuntimeIdentity(value, { ...input, artefactType: 'truth_state_map' })) return false;
  return isRecord(value.known_truths)
    || isRecord(value.inferred_truths)
    || Array.isArray(value.truth_state_ids)
    || Array.isArray(value.canonical_truth_state_ids);
}

export function evaluateStep1EvidenceForStep2(input: {
  analysisEvidenceState: unknown;
  expectedRunId: string;
  expectedAnalysisRunId: string;
  takeId: string;
  internalQaEmit: boolean;
}): {
  step1EvidenceValidForStep2: boolean;
  step1QaPersistenceStatus: Step1PersistenceStatus;
  step2DependencyBlocked: boolean;
  step2DependencyStatus: string;
  analysisEvidenceStateRef: string | null;
  analysisEvidenceStateRefStatus: Step1PersistenceStatus;
  blockerCodes: string[];
  warningCodes: string[];
} {
  const result = isRecord(input.analysisEvidenceState) ? input.analysisEvidenceState : null;
  const payload = isRecord(result?.payload) ? result.payload : null;
  const written = result?.written === true;
  const step2Dependency = isRecord(payload?.step2_dependency_status) ? payload.step2_dependency_status : null;
  const step2DependencyStatus = normaliseStatus(step2Dependency?.status);
  const evidenceStateStatus = normaliseStatus(payload?.evidence_state_status);
  const blockerCodes = [
    ...(!payload ? ['AnalysisEvidenceState_payload_missing'] : []),
    ...(payload && payload.run_id !== input.expectedRunId ? ['AnalysisEvidenceState_run_id_mismatch'] : []),
    ...(payload && payload.analysis_run_id !== input.expectedAnalysisRunId ? ['AnalysisEvidenceState_analysis_run_id_mismatch'] : []),
    ...(payload && !getNonBlankString(payload.take_id) ? ['AnalysisEvidenceState_take_id_missing'] : []),
    ...(payload && getNonBlankString(payload.take_id) && getNonBlankString(payload.take_id) !== input.takeId ? ['AnalysisEvidenceState_take_id_mismatch'] : []),
    ...(payload && !step2Dependency ? ['analysis_evidence_state_step2_dependency_status_missing'] : []),
    ...(payload && ['failed', 'blocked'].includes(evidenceStateStatus) ? ['analysis_evidence_state_invalid_for_step2'] : []),
    ...(step2Dependency && step2Dependency.can_run_step2 === false ? ['analysis_evidence_state_step2_dependency_blocked'] : []),
    ...(step2Dependency && ['failed', 'blocked'].includes(step2DependencyStatus) ? getStringArray(step2Dependency.blocker_codes) : []),
  ];
  const step1EvidenceValidForStep2 = blockerCodes.length === 0;
  const step1QaPersistenceStatus: Step1PersistenceStatus = written
    ? 'written'
    : (payload ? (input.internalQaEmit ? 'failed_emission' : 'skipped') : 'unavailable');
  const analysisEvidenceStateRef = payload
    ? `takes/take-${input.takeId}/analysis-${input.expectedAnalysisRunId}/analysis/AnalysisEvidenceState.json`
    : null;
  const warningCodes = step1EvidenceValidForStep2 && step1QaPersistenceStatus === 'failed_emission'
    ? ['qa_persistence_failed_but_step1_evidence_valid']
    : [];

  return {
    step1EvidenceValidForStep2,
    step1QaPersistenceStatus,
    step2DependencyBlocked: !step1EvidenceValidForStep2,
    step2DependencyStatus,
    analysisEvidenceStateRef,
    analysisEvidenceStateRefStatus: step1QaPersistenceStatus,
    blockerCodes: [...new Set(blockerCodes)],
    warningCodes,
  };
}
