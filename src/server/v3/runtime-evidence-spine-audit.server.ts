import type { ArtefactStatus } from './qa-artifacts.server';

export type RuntimeEvidenceArtefactCategory = 'analysis_take' | 'comparison' | 'parity_export';
export type RuntimeEvidenceSourceClassification =
  | 'real_runtime_v3'
  | 'legacy_adapter'
  | 'internal_model_run_trace'
  | 'internal_validator'
  | 'internal_gate_trace'
  | 'source_only_stub'
  | 'emitted_not_wired'
  | 'missing'
  | 'deferred'
  | 'not_applicable'
  | 'emitted_blocked';

export interface RuntimeEvidenceSpineAuditItem {
  artefact_id: string;
  category: RuntimeEvidenceArtefactCategory;
  expected_path: string;
  current_source_module: string;
  expected_source_of_truth: string;
  current_manifest_status: ArtefactStatus;
  source_classification: RuntimeEvidenceSourceClassification;
  evidence_status?: 'not_executed';
  runtime_data_available_now: boolean | 'unknown';
  can_emit_without_invention: boolean;
  required_for_level: 'L2';
  blocker_code?: string;
  next_implementation_step: string;
}

const ALLOWED_STATUSES: ReadonlySet<ArtefactStatus> = new Set(['emitted', 'missing', 'deferred', 'not_applicable', 'emitted_blocked']);

const RUNTIME_EVIDENCE_SPINE_AUDIT_MAP: ReadonlyArray<RuntimeEvidenceSpineAuditItem> = [
  { artefact_id: 'analysis_input_record', category: 'analysis_take', expected_path: 'inputs/input_record.json', current_source_module: 'required list only', expected_source_of_truth: 'take/submission ingest payload at process start', current_manifest_status: 'missing', source_classification: 'missing', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', next_implementation_step: 'Emit Step-0 capture from process-take input context' },
  { artefact_id: 'analysis_submission', category: 'analysis_take', expected_path: 'inputs/submission.json', current_source_module: 'required list only', expected_source_of_truth: 'DB submission row used by runProcessTake', current_manifest_status: 'missing', source_classification: 'missing', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', next_implementation_step: 'Emit normalized submission snapshot' },
  { artefact_id: 'analysis_take', category: 'analysis_take', expected_path: 'inputs/take.json', current_source_module: 'required list only', expected_source_of_truth: 'DB take row for current take', current_manifest_status: 'missing', source_classification: 'missing', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', next_implementation_step: 'Emit normalized take snapshot' },
  { artefact_id: 'raw_report', category: 'analysis_take', expected_path: 'reports/raw_report.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts + src/server/process-take.server.ts', expected_source_of_truth: 'post-polish report payload', current_manifest_status: 'emitted', source_classification: 'legacy_adapter', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', next_implementation_step: 'Keep emitting, but classify as legacy_adapter when report_data.schema_version is v1-legacy and do not count as v3 spine proof' },
  { artefact_id: 'resolver_output', category: 'analysis_take', expected_path: 'resolver/resolver_output.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitResolverOutputAndTruthStateMap', expected_source_of_truth: 'deterministic resolver snapshot from loaded runtime input artefacts', current_manifest_status: 'emitted', source_classification: 'real_runtime_v3', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', next_implementation_step: 'Keep wired and emitted only from real loaded runtime state' },
  { artefact_id: 'truth_state_map', category: 'analysis_take', expected_path: 'resolver/TruthStateMap.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitResolverOutputAndTruthStateMap', expected_source_of_truth: 'deterministic truth-state separation from runtime inputs', current_manifest_status: 'emitted', source_classification: 'real_runtime_v3', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', next_implementation_step: 'Preserve known/inferred/unavailable/blocked separation and avoid promoting legacy claims to known truth' },
  { artefact_id: 'evidence_anchors', category: 'analysis_take', expected_path: 'traces/EvidenceAnchors.json', current_source_module: 'required list only', expected_source_of_truth: 'multimodal evidence pass outputs', current_manifest_status: 'missing', source_classification: 'missing', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'EvidenceAnchor_trace_missing', next_implementation_step: 'Define anchor schema from evidence-pass outputs and emit' },
  { artefact_id: 'public_claim_trace', category: 'analysis_take', expected_path: 'traces/PublicClaimTrace.json', current_source_module: 'required list + internal claim fields in s5 internal renderer', expected_source_of_truth: 'claim-trace generation layer', current_manifest_status: 'missing', source_classification: 'source_only_stub', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'PublicClaimTrace_missing', next_implementation_step: 'Introduce claim-trace artefact from existing claim traces surface only if real source exists' },
  { artefact_id: 'technique_observation_trace', category: 'analysis_take', expected_path: 'traces/TechniqueObservationTrace.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitTechniqueObservationTraceFirstPass', expected_source_of_truth: 'legacy report snapshot adapters pending real runtime technique evidence spine', current_manifest_status: 'emitted', source_classification: 'legacy_adapter', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', blocker_code: 'technique_observation_trace_legacy_insufficient', next_implementation_step: 'Promote to real_runtime_v3 only when linked to canonical runtime technique evidence sources' },
  { artefact_id: 'score_trace', category: 'analysis_take', expected_path: 'traces/ScoreTrace.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitScoreTraceFirstPass', expected_source_of_truth: 'legacy report snapshot adapters pending real runtime scoring proof', current_manifest_status: 'emitted', source_classification: 'legacy_adapter', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', blocker_code: 'ScoreTrace_legacy_only', next_implementation_step: 'Promote to real_runtime_v3 only when linked to canonical runtime scoring brain / score proof sources' },
  { artefact_id: 'validator_trace', category: 'analysis_take', expected_path: 'traces/ValidatorTrace.json', current_source_module: 'required list only', expected_source_of_truth: 'validation / UK / leakage gate chain', current_manifest_status: 'emitted', source_classification: 'internal_validator', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', blocker_code: 'ValidatorTrace_internal_only', next_implementation_step: 'promote only when independent runtime v3 validation/proof chain exists' },
  { artefact_id: 'gate_trace', category: 'analysis_take', expected_path: 'traces/GateTrace.json', current_source_module: 'required list only', expected_source_of_truth: 'gate status computation', current_manifest_status: 'emitted', source_classification: 'internal_gate_trace', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', blocker_code: 'GateTrace_internal_only', next_implementation_step: 'promote only when independent runtime v3 gate/proof chain exists' },
  { artefact_id: 'model_run_trace', category: 'analysis_take', expected_path: 'traces/ModelRunTrace.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts (emitModelRunTraceFirstPass)', expected_source_of_truth: 'model routing + attempts/fallback metadata', current_manifest_status: 'emitted', source_classification: 'internal_model_run_trace', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', blocker_code: 'ModelRunTrace_internal_only', next_implementation_step: 'promote only when independent model-run proof chain exists' },
  { artefact_id: 'qa_acceptance_metrics', category: 'analysis_take', expected_path: 'qa/acceptance_metrics.json', current_source_module: 'qa-artifacts.server + qa-artifacts-wiring.server', expected_source_of_truth: 'qa/acceptance_metrics.json', current_manifest_status: 'emitted', source_classification: 'real_runtime_v3', runtime_data_available_now: true, can_emit_without_invention: true, required_for_level: 'L2', next_implementation_step: 'Validate against real Storage sink evidence in operator environment' },
  { artefact_id: 'comparison_raw', category: 'comparison', expected_path: 'comparison/comparison.raw.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitComparisonRuntimeArtifacts', expected_source_of_truth: 'real comparison runtime execution', current_manifest_status: 'missing', source_classification: 'emitted_not_wired', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'comparison_JSON_missing', next_implementation_step: 'Only mark emitted when actual comparison run executes' },
  { artefact_id: 'comparison_report_internal', category: 'comparison', expected_path: 'comparison/comparison.report.internal.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitComparisonRuntimeArtifacts', expected_source_of_truth: 'real comparison runtime execution', current_manifest_status: 'missing', source_classification: 'emitted_not_wired', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'comparison_report_unavailable', next_implementation_step: 'Only mark emitted when actual comparison run executes' },
  { artefact_id: 'same_video_repeatability_trace', category: 'comparison', expected_path: 'comparison_traces/same_video_repeatability_trace.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts blocked placeholder writer', expected_source_of_truth: 'executed repeatability routine', current_manifest_status: 'emitted_blocked', source_classification: 'emitted_blocked', evidence_status: 'not_executed', runtime_data_available_now: false, can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'repeatability_not_executed', next_implementation_step: 'Do not treat as runtime proof unless real trace payload is produced' },
  { artefact_id: 'comparison_suppression_trace', category: 'comparison', expected_path: 'comparison_traces/comparison_suppression_trace.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts blocked placeholder writer', expected_source_of_truth: 'executed suppression evaluator', current_manifest_status: 'emitted_blocked', source_classification: 'emitted_blocked', evidence_status: 'not_executed', runtime_data_available_now: false, can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'comparison_suppression_not_executed', next_implementation_step: 'Do not treat as runtime proof unless real trace payload is produced' },
  { artefact_id: 'route_variance_trace', category: 'comparison', expected_path: 'comparison_traces/route_variance_trace.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts blocked placeholder writer', expected_source_of_truth: 'executed route variance evaluator', current_manifest_status: 'emitted_blocked', source_classification: 'emitted_blocked', evidence_status: 'not_executed', runtime_data_available_now: false, can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'route_variance_not_executed', next_implementation_step: 'Do not treat as runtime proof unless real trace payload is produced' },
  { artefact_id: 'parity_report', category: 'parity_export', expected_path: 'parity/report_parity_result.json', current_source_module: 'required list only', expected_source_of_truth: 'parity validator runtime', current_manifest_status: 'missing', source_classification: 'missing', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'parity_artefacts_missing', next_implementation_step: 'Defer until parity runtime exists' },
  { artefact_id: 'parity_comparison', category: 'parity_export', expected_path: 'parity/comparison_parity.json', current_source_module: 'required list only', expected_source_of_truth: 'comparison parity runtime', current_manifest_status: 'missing', source_classification: 'missing', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'parity_artefacts_missing', next_implementation_step: 'Defer until comparison parity runtime exists' },
  { artefact_id: 'no_export_proof', category: 'parity_export', expected_path: 'export_or_no_export/no_export_proof.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitNoExportProofBundle', expected_source_of_truth: 'proof bundle writer after all four component proofs', current_manifest_status: 'missing', source_classification: 'emitted_not_wired', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', blocker_code: 'no_export_proof_missing', next_implementation_step: 'Wire source/config/ui/log proof producers first' },
  { artefact_id: 'no_export_source_proof', category: 'parity_export', expected_path: 'export_or_no_export/no_export_source_proof.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitNoExportProofBundle', expected_source_of_truth: 'source proof producer', current_manifest_status: 'missing', source_classification: 'emitted_not_wired', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', next_implementation_step: 'Implement source proof producer then emit' },
  { artefact_id: 'no_export_config_proof', category: 'parity_export', expected_path: 'export_or_no_export/no_export_config_proof.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitNoExportProofBundle', expected_source_of_truth: 'config proof producer', current_manifest_status: 'missing', source_classification: 'emitted_not_wired', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', next_implementation_step: 'Implement config proof producer then emit' },
  { artefact_id: 'no_export_ui_proof', category: 'parity_export', expected_path: 'export_or_no_export/no_export_ui_proof.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitNoExportProofBundle', expected_source_of_truth: 'UI proof producer', current_manifest_status: 'missing', source_classification: 'emitted_not_wired', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', next_implementation_step: 'Implement UI proof producer then emit' },
  { artefact_id: 'no_export_log_proof', category: 'parity_export', expected_path: 'export_or_no_export/no_export_log_proof.json', current_source_module: 'src/server/v3/qa-artifacts-wiring.server.ts emitNoExportProofBundle', expected_source_of_truth: 'log proof producer', current_manifest_status: 'missing', source_classification: 'emitted_not_wired', runtime_data_available_now: 'unknown', can_emit_without_invention: false, required_for_level: 'L2', next_implementation_step: 'Implement log proof producer then emit' },
];

export function getRuntimeEvidenceSpineAuditMap(): RuntimeEvidenceSpineAuditItem[] {
  return RUNTIME_EVIDENCE_SPINE_AUDIT_MAP.map((item) => ({ ...item }));
}

export function getRequiredRuntimeEvidenceArtefactIds(): string[] {
  return RUNTIME_EVIDENCE_SPINE_AUDIT_MAP.map((item) => item.artefact_id);
}

export function classifyRuntimeEvidenceArtefactStatus(input: {
  artefact_id: string;
  manifest_status?: string | null;
  evidence_status?: string | null;
}): { status: ArtefactStatus; evidence_status?: 'not_executed' } {
  const item = RUNTIME_EVIDENCE_SPINE_AUDIT_MAP.find((candidate) => candidate.artefact_id === input.artefact_id);
  if (!item) {
    throw new Error(
      `Unknown runtime evidence artefact_id "${input.artefact_id}". Add it to RUNTIME_EVIDENCE_SPINE_AUDIT_MAP before classifying status.`,
    );
  }

  const status: ArtefactStatus =
    input.manifest_status && ALLOWED_STATUSES.has(input.manifest_status as ArtefactStatus)
      ? (input.manifest_status as ArtefactStatus)
      : item.current_manifest_status;

  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error(
      `Invalid runtime evidence status "${String(status)}" for artefact_id "${input.artefact_id}".`,
    );
  }

  if (status === 'emitted_blocked') {
    return { status, evidence_status: input.evidence_status === 'not_executed' ? 'not_executed' : 'not_executed' };
  }
  return { status };
}

export function assertRuntimeEvidenceSpineInventoryComplete(): { ok: true; count: number } {
  const ids = getRequiredRuntimeEvidenceArtefactIds();
  if (ids.length !== 26) throw new Error(`runtime_evidence_spine_inventory_count_invalid:${ids.length}`);
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new Error('runtime_evidence_spine_inventory_duplicate_ids');
  for (const item of RUNTIME_EVIDENCE_SPINE_AUDIT_MAP) {
    if (!ALLOWED_STATUSES.has(item.current_manifest_status)) throw new Error(`runtime_evidence_spine_status_invalid:${item.artefact_id}`);
    if (item.evidence_status && item.evidence_status !== 'not_executed') throw new Error(`runtime_evidence_spine_evidence_status_invalid:${item.artefact_id}`);
  }
  return { ok: true, count: ids.length };
}

export function isV3EvidenceSpineCompleteFromStatuses(statuses: Record<string, ArtefactStatus>): boolean {
  const mustEmit = ['analysis_input_record', 'analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', 'evidence_anchors', 'public_claim_trace', 'technique_observation_trace', 'score_trace', 'validator_trace', 'gate_trace', 'model_run_trace', 'qa_acceptance_metrics'];
  return mustEmit.every((id) => statuses[id] === 'emitted');
}
