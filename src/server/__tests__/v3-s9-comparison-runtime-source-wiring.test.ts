import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitQAManifestForAnalysisRun, runInternalComparisonForTakes } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 comparison runtime source wiring', () => {
  it('uses upstream internal runtime source for two real completed takes and emits comparison artefacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-source-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-root-a',
      root_take_id: 'root-a',
      source_module: 'test',
      source_stage: 'runtime-source-wiring',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'root-a', analysis_run_id: 'ar-a', analysis_route: 'route-v1', model_provider_family: 'provider-a', mux_playback_ref: 'pb-a', artefact_summaries: { score_trace_summary: { score_count: 10 } } },
        { take_id: 'root-b', analysis_run_id: 'ar-b', analysis_route: 'route-v2', model_provider_family: 'provider-b', mux_playback_ref: 'pb-b', artefact_summaries: { score_trace_summary: { score_count: 11 } } },
      ],
    });
    expect(out.written).toBe(true);
    expect(out.comparison_run_id).toBeTruthy();
    expect(out.emitted_artefact_ids.sort()).toEqual(['comparison_raw', 'comparison_report_internal', 'comparison_suppression_trace', 'route_variance_trace', 'same_video_repeatability_trace'].sort());
    const base = path.join(root, 'take-root-a', 'takes', 'take-root-a', 'analysis-ar-a');
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    expect(raw.comparison_execution_status).toBe('executed');
    expect(raw.compared_take_ids).toEqual(['root-a', 'root-b']);
    await emitQAManifestForAnalysisRun({ run_id: 'take-root-a', take_id: 'root-a', analysis_run_id: 'ar-a', comparison_run_id: raw.comparison_run_id, compared_take_ids: ['root-a', 'root-b'], root_dir: root, internal_qa_emit: true, emitted_artefact_ids: out.emitted_artefact_ids });
    const metrics = JSON.parse(await readFile(path.join(root, 'take-root-a', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(metrics.comparison_evidence_status).toBe('insufficient');
    expect(metrics.comparison_raw_status).toBe('emitted');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('suppresses decision for same video duplicate input and keeps public winner blocked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-same-video-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-dup-root',
      root_take_id: 'dup-root',
      source_module: 'test',
      source_stage: 'same-video',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'dup-root', analysis_run_id: 'ar1', mux_playback_ref: 'pb-same' },
        { take_id: 'dup-alt', analysis_run_id: 'ar2', mux_playback_ref: 'pb-same' },
      ],
    });
    expect(out.written).toBe(true);
    const base = path.join(root, 'take-dup-root', 'takes', 'take-dup-root', 'analysis-ar1');
    const sameVideo = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8'));
    const suppression = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8'));
    expect(sameVideo.same_video_detected).toBe(true);
    expect(sameVideo.false_winner_risk).toBe(true);
    expect(suppression.suppression_decision).toBe('suppressed');
    expect(suppression.public_output_unchanged).toBe(true);
  });

  it('fails closed for ordinary single-take/raw-report-only style input and emits nothing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-single-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-only-root',
      root_take_id: 'only-root',
      source_module: 'test',
      source_stage: 'single-take',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [{ take_id: 'only-root', analysis_run_id: 'ar-only', artefact_summaries: { raw_report: { comparison_run_executed: false } } }],
    });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual([]);
  });

  it('rejects unsafe IDs and does not emit', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-unsafe-'));
    await expect(runInternalComparisonForTakes({
      run_id: 'take-unsafe-root',
      root_take_id: '../unsafe',
      source_module: 'test',
      source_stage: 'unsafe-id',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'a', analysis_run_id: 'ar-a' },
        { take_id: 'b', analysis_run_id: 'ar-b' },
      ],
    })).rejects.toThrow(/root_take_id|segment/i);
  });

  it('redacts forbidden fields from emitted comparison payload', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-redact-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-redact-root',
      root_take_id: 'redact-root',
      source_module: 'test',
      source_stage: 'redaction',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'redact-root', analysis_run_id: 'ar-r1', artefact_summaries: { prompt: 'SECRET_PROMPT', signed_url: 'https://signed.example/a' } },
        { take_id: 'redact-alt', analysis_run_id: 'ar-r2', artefact_summaries: { token: 'SECRET_TOKEN', video_url: 'https://video.example/b' } },
      ],
    });
    expect(out.written).toBe(true);
    const base = path.join(root, 'take-redact-root', 'takes', 'take-redact-root', 'analysis-ar-r1');
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    expect(JSON.stringify(raw)).not.toContain('SECRET_PROMPT');
    expect(JSON.stringify(raw)).not.toContain('SECRET_TOKEN');
    expect(JSON.stringify(raw)).not.toContain('signed.example');
    expect(JSON.stringify(raw)).not.toContain('video.example');
    expect(raw.forbidden_fields_absent).toBe(true);
    expect(Array.isArray(raw.redacted_fields)).toBe(true);
  });
});
