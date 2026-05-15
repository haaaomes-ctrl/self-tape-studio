import { describe, expect, it } from 'vitest';
import {
  assertRuntimeEvidenceSpineInventoryComplete,
  classifyRuntimeEvidenceArtefactStatus,
  getRequiredRuntimeEvidenceArtefactIds,
  getRuntimeEvidenceSpineAuditMap,
  isV3EvidenceSpineCompleteFromStatuses,
} from '../v3/runtime-evidence-spine-audit.server';

describe('v3 s9 runtime evidence spine audit map', () => {
  it('contains every required artefact exactly once with expected cardinality', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const ids = map.map((x) => x.artefact_id);
    expect(ids.length).toBe(26);
    expect(new Set(ids).size).toBe(26);
    expect(getRequiredRuntimeEvidenceArtefactIds()).toEqual(ids);
    expect(assertRuntimeEvidenceSpineInventoryComplete()).toEqual({ ok: true, count: 26 });
  });

  it('uses only approved manifest statuses and never blocked_not_executed', () => {
    const allowed = new Set(['emitted', 'missing', 'deferred', 'not_applicable', 'emitted_blocked']);
    for (const artefact of getRuntimeEvidenceSpineAuditMap()) {
      expect(allowed.has(artefact.current_manifest_status)).toBe(true);
      expect(artefact.current_manifest_status).not.toBe('blocked_not_executed');
    }
  });

  it('still classifies emitted_blocked fail-closed when explicitly requested', () => {
    const classified = classifyRuntimeEvidenceArtefactStatus({ artefact_id: 'comparison_raw', manifest_status: 'emitted_blocked', evidence_status: 'not_executed' });
    expect(classified).toEqual({ status: 'emitted_blocked', evidence_status: 'not_executed' });
  });

  it('marks raw_report as legacy adapter and not sufficient for v3 spine completion', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const rawReport = map.find((x) => x.artefact_id === 'raw_report');
    expect(rawReport).toBeDefined();
    expect(rawReport?.source_classification).toBe('legacy_adapter');

    const statuses: Record<string, 'emitted' | 'missing' | 'deferred' | 'not_applicable' | 'emitted_blocked'> = Object.fromEntries(
      map.map((item) => [item.artefact_id, item.artefact_id === 'raw_report' ? 'emitted' : 'missing']),
    );
    expect(isV3EvidenceSpineCompleteFromStatuses(statuses)).toBe(false);
  });

  it('emitted technique trace row does not use missing blocker code', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const technique = map.find((x) => x.artefact_id === 'technique_observation_trace');
    expect(technique?.current_manifest_status).toBe('emitted');
    expect(technique?.blocker_code).not.toBe('TechniqueObservation_trace_missing');
  });

  it('keeps missing blockers for actually missing artefacts', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    expect(map.find((x) => x.artefact_id === 'score_trace')?.blocker_code).toBe('ScoreTrace_legacy_only');
    expect(map.find((x) => x.artefact_id === 'validator_trace')?.blocker_code).toBe('ValidatorTrace_internal_only');
    expect(map.find((x) => x.artefact_id === 'gate_trace')?.blocker_code).toBe('GateTrace_internal_only');
    expect(map.find((x) => x.artefact_id === 'model_run_trace')?.blocker_code).toBe('ModelRunTrace_internal_only');
  });

  it('uses PascalCase expected paths for validator and gate traces', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    expect(map.find((x) => x.artefact_id === 'validator_trace')?.expected_path).toBe('traces/ValidatorTrace.json');
    expect(map.find((x) => x.artefact_id === 'gate_trace')?.expected_path).toBe('traces/GateTrace.json');
    expect(map.find((x) => x.artefact_id === 'validator_trace')?.expected_path).not.toBe('traces/validator_trace.json');
    expect(map.find((x) => x.artefact_id === 'gate_trace')?.expected_path).not.toBe('traces/gate_trace.json');
  });

  it('uses internal validator/gate source classifications and never promotes them', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const validator = map.find((x) => x.artefact_id === 'validator_trace');
    const gate = map.find((x) => x.artefact_id === 'gate_trace');
    expect(validator?.source_classification).toBe('internal_validator');
    expect(gate?.source_classification).toBe('internal_gate_trace');
    expect(validator?.source_classification).not.toBe('real_runtime_v3');
    expect(gate?.source_classification).not.toBe('real_runtime_v3');
    expect(validator?.source_classification).not.toBe('legacy_adapter');
    expect(gate?.source_classification).not.toBe('legacy_adapter');
  });

  it('marks immediate input artefacts as emit-capable without invention', () => {
    const ids = ['analysis_input_record', 'analysis_submission', 'analysis_take'];
    const map = getRuntimeEvidenceSpineAuditMap();
    for (const id of ids) {
      const item = map.find((x) => x.artefact_id === id);
      expect(item?.can_emit_without_invention).toBe(true);
    }
  });

  it('keeps qa_acceptance_metrics emitted and comparison traces internal/missing by default', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const qaMetrics = map.find((x) => x.artefact_id === 'qa_acceptance_metrics');
    expect(qaMetrics?.current_manifest_status).toBe('emitted');

    const comparisonTraceIds = ['same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace'];
    for (const id of comparisonTraceIds) {
      const item = map.find((x) => x.artefact_id === id);
      expect(item?.current_manifest_status).toBe('missing');
      expect(item?.source_classification).toBe('internal_comparison_trace');
    }
  });

  

  it('uses allowed source classification for qa_acceptance_metrics and appears exactly once', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const qaEntries = map.filter((x) => x.artefact_id === 'qa_acceptance_metrics');
    expect(qaEntries).toHaveLength(1);
    expect(qaEntries[0]?.source_classification).toBe('real_runtime_v3');
    expect(qaEntries[0]?.source_classification).not.toBe('runtime_v3');
    expect(qaEntries[0]?.current_manifest_status).toBe('emitted');
    expect(qaEntries[0]?.expected_path).toBe('qa/acceptance_metrics.json');
    expect(qaEntries[0]?.can_emit_without_invention).toBe(true);

    const allowedClassifications = new Set(['real_runtime_v3','legacy_adapter','source_only_stub','emitted_not_wired','missing','deferred','not_applicable','emitted_blocked','internal_validator','internal_gate_trace','internal_model_run_trace','internal_comparison_runtime','internal_comparison_report','internal_comparison_trace']);
    for (const item of map) {
      expect(allowedClassifications.has(item.source_classification)).toBe(true);
      expect(item.source_classification).not.toBe('runtime_v3');
    }
  });
it('preserves blocked/not accepted implications for current release state', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const hasBlockedComparisonEvidence = map.some((x) => x.category === 'comparison' && x.current_manifest_status === 'missing');
    const hasRequiredMissingEvidence = map.some((x) => x.required_for_level === 'L2' && x.current_manifest_status === 'missing');
    expect(hasBlockedComparisonEvidence).toBe(true);
    expect(hasRequiredMissingEvidence).toBe(true);
  });

  it('uses writer-compatible expected paths for comparison artefacts', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    expect(map.find((x) => x.artefact_id === 'comparison_raw')?.expected_path).toBe('comparison/comparison.raw.json');
    expect(map.find((x) => x.artefact_id === 'comparison_report_internal')?.expected_path).toBe('comparison/comparison.report.internal.json');
    expect(map.find((x) => x.artefact_id === 'same_video_repeatability_trace')?.expected_path).toBe('comparison_traces/same_video_repeatability_trace.json');
    expect(map.find((x) => x.artefact_id === 'comparison_suppression_trace')?.expected_path).toBe('comparison_traces/comparison_suppression_trace.json');
    expect(map.find((x) => x.artefact_id === 'route_variance_trace')?.expected_path).toBe('comparison_traces/route_variance_trace.json');
  });

  it('fails closed for unknown artefact ids', () => {
    expect(() => classifyRuntimeEvidenceArtefactStatus({ artefact_id: 'typo_new_unknown_artefact' })).toThrow(/Unknown runtime evidence artefact_id/);
    expect(() => classifyRuntimeEvidenceArtefactStatus({ artefact_id: 'typo_new_unknown_artefact', manifest_status: 'emitted_blocked', evidence_status: 'not_executed' })).toThrow(/Unknown runtime evidence artefact_id/);
  });

  it('uses fallback and override rules for known artefacts', () => {
    expect(classifyRuntimeEvidenceArtefactStatus({ artefact_id: 'analysis_input_record' })).toEqual({ status: 'missing' });
    expect(classifyRuntimeEvidenceArtefactStatus({ artefact_id: 'analysis_input_record', manifest_status: 'emitted_blocked', evidence_status: 'not_executed' })).toEqual({ status: 'emitted_blocked', evidence_status: 'not_executed' });
    expect(classifyRuntimeEvidenceArtefactStatus({ artefact_id: 'raw_report', manifest_status: 'emitted' })).toEqual({ status: 'emitted' });
  });
});
