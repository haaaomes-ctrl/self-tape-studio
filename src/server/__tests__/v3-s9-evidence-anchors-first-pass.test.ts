import { access, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitEvidenceAnchorsFirstPass, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 evidence anchors first pass', () => {
  it('emits legacy timestamped notes as debug-only insufficient anchors', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906b-'));
    const run = 'run-s906b';
    const take = 't1';
    await emitRawReportArtefact({
      run_id: run,
      take_id: take,
      submission_id: 'sub1',
      source_stage: 'unit',
      source_module: 'test',
      report_data: { schema_version: 'v1-legacy', timestamped_notes: [{ timestamp: '00:12', note: 'Grounded beat lands.' }] },
      root_dir: root,
      internal_qa_emit: true,
    });
    const out = await emitEvidenceAnchorsFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: { artefact_type: 'raw_report', report_data: { timestamped_notes: [{ timestamp: '00:12', note: 'Grounded beat lands.' }] } }, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(true);
    const traces = JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'EvidenceAnchors.json'), 'utf8'));
    expect(traces.artefact_type).toBe('evidence_anchors');
    expect(traces.internal_only).toBe(true);
    expect(traces.anchor_count).toBeGreaterThan(0);
    expect(traces.cannot_satisfy_v3_evidence_anchor_gate).toBe(true);
    expect(traces.anchors[0].source_family).toBe('legacy_adapter');
    expect(traces.anchors[0].evidence_status).toBe('derived_from_legacy_report_snapshot');
    expect(traces.anchors[0].timestamp_source).toBe('raw_report_timestamped_note');
    expect(traces.anchors[0].source_path).toBe('report_data.timestamped_notes[0].note');

    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: take, submission_id: 'sub1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report', 'evidence_anchors'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter', evidence_anchors: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false }, legacy_adapter_artefact_ids: ['raw_report', 'evidence_anchors'] });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted');
    expect(manifest.missing_artifacts).not.toContain('evidence_anchors');
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('missing');

    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(metrics.emitted_artefacts).toContain('evidence_anchors');
    expect(metrics.missing_required_artefacts).not.toContain('evidence_anchors');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('does not emit evidence_anchors when no source data exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906b-missing-'));
    const out = await emitEvidenceAnchorsFirstPass({ run_id: 'run-missing', analysis_run_id: 'run-missing', submission_id: 'sub1', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: {}, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(false);
    await expect(access(path.join(root, 'run-missing', 'takes', 'take-t1', 'analysis-run-missing', 'traces', 'EvidenceAnchors.json'))).rejects.toThrow();
  });
  it('supports direct report_data shape and text field', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906b-direct-'));
    const out = await emitEvidenceAnchorsFirstPass({ run_id: 'run-direct', analysis_run_id: 'run-direct', submission_id: 'sub1', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: { schema_version: 'v1-legacy', timestamped_notes: [{ timestamp: '00:20', text: 'Direct text note' }] }, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(true);
    const traces = JSON.parse(await readFile(path.join(root, 'run-direct', 'takes', 'take-t1', 'analysis-run-direct', 'traces', 'EvidenceAnchors.json'), 'utf8'));
    expect(traces.anchors[0].evidence_text).toBe('Direct text note');
    expect(traces.anchors[0].source_path).toBe('report_data.timestamped_notes[0].text');
  });
  it('skips malformed timestamped rows and only emits real note/text anchors', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906b-malformed-'));
    const out = await emitEvidenceAnchorsFirstPass({
      run_id: 'run-malformed',
      analysis_run_id: 'run-malformed',
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { artefact_type: 'raw_report', report_data: { schema_version: 'v1-legacy', timestamped_notes: [{}, { note: '' }, { text: '' }, { note: 'Real note', timestamp: '00:10' }] } },
      root_dir: root,
      internal_qa_emit: true,
    });
    expect(out.written).toBe(true);
    const traces = JSON.parse(await readFile(path.join(root, 'run-malformed', 'takes', 'take-t1', 'analysis-run-malformed', 'traces', 'EvidenceAnchors.json'), 'utf8'));
    expect(traces.anchor_count).toBe(1);
    expect(traces.anchors[0].evidence_text).toBe('Real note');
    expect(traces.anchors[0].source_path).toBe('report_data.timestamped_notes[3].note');
    expect(traces.anchors.map((a: any) => a.evidence_text)).not.toContain('legacy report snapshot note');
  });

  it('does not emit when all timestamped rows are malformed/blank', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s906b-all-blank-'));
    const out = await emitEvidenceAnchorsFirstPass({
      run_id: 'run-all-blank',
      analysis_run_id: 'run-all-blank',
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { artefact_type: 'raw_report', report_data: { schema_version: 'v1-legacy', timestamped_notes: [{}, { note: '' }, { text: '   ' }] } },
      root_dir: root,
      internal_qa_emit: true,
    });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual([]);
    await expect(access(path.join(root, 'run-all-blank', 'takes', 'take-t1', 'analysis-run-all-blank', 'traces', 'EvidenceAnchors.json'))).rejects.toThrow();
  });
});
