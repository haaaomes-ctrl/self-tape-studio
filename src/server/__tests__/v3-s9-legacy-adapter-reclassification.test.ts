import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';
import { assertRuntimeEvidenceSpineInventoryComplete, getRuntimeEvidenceSpineAuditMap, isV3EvidenceSpineCompleteFromStatuses } from '../v3/runtime-evidence-spine-audit.server';

describe('v3 s9 legacy adapter reclassification', () => {
  it('classifies legacy raw_report wrapper without changing emitted status', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-legacy-'));
    await emitRawReportArtefact({
      run_id: 's902-r1',
      take_id: 't1',
      submission_id: 'sub1',
      source_stage: 'process_take_success',
      source_module: 'process-take',
      report_data: { schema_version: 'v1-legacy', claim_traces: null, components: null, limitations: null, scores: { overall: 91 } },
      root_dir: root,
      internal_qa_emit: true,
    });
    const raw = JSON.parse(await readFile(path.join(root, 's902-r1', 'takes', 'take-t1', 'analysis-s902-r1', 'reports', 'raw_report.json'), 'utf8'));
    expect(raw.source_family).toBe('legacy_adapter');
    expect(raw.report_schema_family).toBe('legacy_v1');
    expect(['incomplete', 'not_available']).toContain(raw.v3_evidence_spine_status);
    expect(raw.does_not_satisfy_level2_spine).toBe(true);
    expect(raw.linked_v3_trace_ids).toEqual([]);
    expect(typeof raw.legacy_snapshot_reason).toBe('string');

    await emitQAManifestForAnalysisRun({
      run_id: 's902-r1',
      take_id: 't1',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report'],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false },
      legacy_adapter_artefact_ids: ['raw_report'],
      real_v3_spine_artefact_ids: [],
      defect_risk_ids: raw.defect_risk_ids,
    });
    const manifest = JSON.parse(await readFile(path.join(root, 's902-r1', 'manifest.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.raw_report).toBe('emitted');
    expect(Object.values(manifest.artefact_status_by_id)).not.toContain('legacy_adapter');
    expect(manifest.artefact_source_classification_by_id.raw_report).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.raw_report).toBe(false);
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(manifest.artefact_status_by_id.qa_acceptance_metrics).toBe('emitted');

    expect(raw.defect_risk_ids).toEqual(expect.arrayContaining([
      'legacy_schema_snapshot',
      'legacy_report_used_as_v3_spine_proxy',
      'v3_claim_fields_null',
      'public_output_snapshot_missing',
      'legacy_numeric_score_snapshot',
    ]));
  });

  it('keeps audit map complete and raw_report insufficient for v3 spine completion', () => {
    expect(assertRuntimeEvidenceSpineInventoryComplete()).toEqual({ ok: true, count: 26 });
    const map = getRuntimeEvidenceSpineAuditMap();
    expect(map.find((x) => x.artefact_id === 'raw_report')?.source_classification).toBe('legacy_adapter');
    const statuses = Object.fromEntries(map.map((item) => [item.artefact_id, item.artefact_id === 'raw_report' ? 'emitted' : 'missing'])) as Record<string, 'emitted'|'missing'|'deferred'|'not_applicable'|'emitted_blocked'>;
    expect(isV3EvidenceSpineCompleteFromStatuses(statuses)).toBe(false);
  });
});
