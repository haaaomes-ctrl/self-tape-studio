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

  it('forces not_executed evidence status for emitted_blocked traces', () => {
    const blocked = getRuntimeEvidenceSpineAuditMap().filter((x) => x.current_manifest_status === 'emitted_blocked');
    expect(blocked.length).toBeGreaterThan(0);
    for (const artefact of blocked) {
      expect(artefact.evidence_status).toBe('not_executed');
      const classified = classifyRuntimeEvidenceArtefactStatus({ artefact_id: artefact.artefact_id, manifest_status: artefact.current_manifest_status, evidence_status: artefact.evidence_status });
      expect(classified).toEqual({ status: 'emitted_blocked', evidence_status: 'not_executed' });
    }
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

  it('marks immediate input artefacts as emit-capable without invention', () => {
    const ids = ['analysis_input_record', 'analysis_submission', 'analysis_take'];
    const map = getRuntimeEvidenceSpineAuditMap();
    for (const id of ids) {
      const item = map.find((x) => x.artefact_id === id);
      expect(item?.can_emit_without_invention).toBe(true);
    }
  });

  it('keeps qa_acceptance_metrics emitted and comparison blocked traces non-proof', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const qaMetrics = map.find((x) => x.artefact_id === 'qa_acceptance_metrics');
    expect(qaMetrics?.current_manifest_status).toBe('emitted');

    const comparisonTraceIds = ['same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace'];
    for (const id of comparisonTraceIds) {
      const item = map.find((x) => x.artefact_id === id);
      expect(item?.current_manifest_status).toBe('emitted_blocked');
      expect(item?.evidence_status).toBe('not_executed');
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

    const allowedClassifications = new Set(['real_runtime_v3','legacy_adapter','source_only_stub','emitted_not_wired','missing','deferred','not_applicable','emitted_blocked']);
    for (const item of map) {
      expect(allowedClassifications.has(item.source_classification)).toBe(true);
      expect(item.source_classification).not.toBe('runtime_v3');
    }
  });
it('preserves blocked/not accepted implications for current release state', () => {
    const map = getRuntimeEvidenceSpineAuditMap();
    const hasBlockedComparisonEvidence = map.some((x) => x.current_manifest_status === 'emitted_blocked');
    const hasRequiredMissingEvidence = map.some((x) => x.required_for_level === 'L2' && x.current_manifest_status === 'missing');
    expect(hasBlockedComparisonEvidence).toBe(true);
    expect(hasRequiredMissingEvidence).toBe(true);
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
