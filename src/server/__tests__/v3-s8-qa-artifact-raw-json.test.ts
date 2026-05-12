import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitComparisonRawArtefact, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s8-23 raw json emitters', () => {
  it('raw report disabled no write', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-raw-'));
    const out = await emitRawReportArtefact({ run_id: 'r1', take_id: 't1', source_stage: 'x', source_module: 'm', report_data: { foo: 1 }, root_dir: root, internal_qa_emit: false });
    expect(out.written).toBe(false);
  });

  it('raw report enabled writes and preserves supplied report', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-raw-'));
    await emitRawReportArtefact({ run_id: 'r2', take_id: 't2', source_stage: 'process_take_success', source_module: 'process-take', report_data: { headline: 'ok', scores: { overall: 91 } }, submission_id: 'sub', root_dir: root, internal_qa_emit: true });
    const body = JSON.parse(await readFile(path.join(root, 'r2', 'reports', 'take_1.raw_report.json'), 'utf8'));
    expect(body.report_data.headline).toBe('ok');
    expect(body.missing_required_fields).toEqual([]);
  });

  it('comparison enabled writes and preserves supplied object', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    await emitComparisonRawArtefact({ run_id: 'r3', source_stage: 'comparison_success', source_module: 'comparison', comparison_data: { recommendation: { label: 'Take 2' }, ranking: ['t1', 't2'] }, comparison_id: 'cmp-1', root_dir: root, internal_qa_emit: true });
    const body = JSON.parse(await readFile(path.join(root, 'r3', 'comparison', 'comparison.raw.json'), 'utf8'));
    expect(body.comparison_data.recommendation.label).toBe('Take 2');
    expect(body.missing_required_fields).toEqual([]);
  });

  it('path traversal rejected', async () => {
    await expect(emitRawReportArtefact({ run_id: '../bad', take_id: 't1', source_stage: 'x', source_module: 'm', report_data: {}, internal_qa_emit: true })).rejects.toThrow();
  });

  it('manifest clears only written blockers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-manifest-'));
    await emitRawReportArtefact({ run_id: 'r4', take_id: 't4', source_stage: 'x', source_module: 'm', report_data: {}, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: 'r4', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report'] });
    const manifest = JSON.parse(await readFile(path.join(root, 'r4', 'manifest.json'), 'utf8'));
    expect(manifest.emitted_artifacts).toContain('raw_report');
    expect(manifest.blocker_codes).not.toContain('raw_JSON_missing');
    expect(manifest.blocker_codes).toContain('comparison_JSON_missing');
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
  });

  it('storage/file failure does not clear raw_JSON_missing blocker', async () => {
    process.env.QA_ARTIFACT_SINK = 'file';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    const root = '/dev/null';
    const out = await emitRawReportArtefact({ run_id: 'r5', take_id: 't5', source_stage: 'x', source_module: 'm', report_data: {}, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(false);
    await emitQAManifestForAnalysisRun({ run_id: 'r5', root_dir: await mkdtemp(path.join(os.tmpdir(), 'qa-manifest-')), internal_qa_emit: true, emitted_artefact_ids: out.written ? ['raw_report'] : [] });
    const mroot = await mkdtemp(path.join(os.tmpdir(), 'qa-manifest2-'));
    await emitQAManifestForAnalysisRun({ run_id: 'r5', root_dir: mroot, internal_qa_emit: true, emitted_artefact_ids: [] });
    const manifest = JSON.parse(await readFile(path.join(mroot, 'r5', 'manifest.json'), 'utf8'));
    expect(manifest.emitted_artifacts).not.toContain('raw_report');
    expect(manifest.blocker_codes).toContain('raw_JSON_missing');
  });
});
