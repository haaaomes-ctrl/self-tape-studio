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
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    const report = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.report.internal.json'), 'utf8'));
    expect(sameVideo.same_video_detected).toBe(true);
    expect(sameVideo.false_winner_risk).toBe(true);
    expect(suppression.suppression_decision).toBe('suppressed');
    expect(suppression.recommendation_suppressed).toBe(true);
    expect(raw.recommendation_suppressed).toBe(true);
    expect(raw.suppression_reasons).toContain('same_video_or_repeated_input');
    expect(report.recommendation_suppressed).toBe(true);
    expect(raw.selected_take_id_internal_only).toBeNull();
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

  it('detects duplicate mux pair in 3+ inputs and suppresses internal winner', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-dup-mux-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-dup-mux-root',
      root_take_id: 't-a',
      source_module: 'test',
      source_stage: 'dup-mux',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 't-a', analysis_run_id: 'ar-a', mux_playback_ref: 'pb-a' },
        { take_id: 't-b', analysis_run_id: 'ar-b', mux_playback_ref: 'pb-a' },
        { take_id: 't-c', analysis_run_id: 'ar-c', mux_playback_ref: 'pb-b' },
      ],
    });
    expect(out.written).toBe(true);
    const base = path.join(root, 'take-dup-mux-root', 'takes', 'take-t-a', 'analysis-ar-a');
    const sameVideo = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8'));
    const suppression = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8'));
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    expect(sameVideo.same_mux_playback_ref).toBe(true);
    expect(sameVideo.same_video_detected).toBe(true);
    expect(sameVideo.repeated_input_detected).toBe(true);
    expect(suppression.suppression_decision).toBe('suppressed');
    expect(raw.selected_take_id_internal_only).toBeNull();
    expect(raw.public_output_unchanged).toBe(true);
    expect(raw.comparison_decision_status).toBe('suppressed_same_video');
  });

  it('detects duplicate fingerprint pair in 3+ inputs and suppresses internal winner', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-dup-fp-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-dup-fp-root',
      root_take_id: 't-a1',
      source_module: 'test',
      source_stage: 'dup-fp',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 't-a1', analysis_run_id: 'ar-a1', mux_playback_ref: 'pb-a1', safe_media_fingerprint: 'fp-a' },
        { take_id: 't-b1', analysis_run_id: 'ar-b1', mux_playback_ref: 'pb-b1', safe_media_fingerprint: 'fp-a' },
        { take_id: 't-c1', analysis_run_id: 'ar-c1', mux_playback_ref: 'pb-c1', safe_media_fingerprint: 'fp-b' },
      ],
    });
    expect(out.written).toBe(true);
    const base = path.join(root, 'take-dup-fp-root', 'takes', 'take-t-a1', 'analysis-ar-a1');
    const sameVideo = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8'));
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    expect(sameVideo.same_video_detected).toBe(true);
    expect(sameVideo.repeated_input_detected).toBe(true);
    expect(sameVideo.false_winner_risk).toBe(true);
    expect(raw.selected_take_id_internal_only).toBeNull();
  });

  it('does not trigger same-video suppression for 3+ all-unique refs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-unique-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-unique-root',
      root_take_id: 'tu-a',
      source_module: 'test',
      source_stage: 'all-unique',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'tu-a', analysis_run_id: 'aru-a', mux_playback_ref: 'pb-a', safe_media_fingerprint: 'fp-a', analysis_route: 'same-route', model_provider_family: 'same-provider' },
        { take_id: 'tu-b', analysis_run_id: 'aru-b', mux_playback_ref: 'pb-b', safe_media_fingerprint: 'fp-b', analysis_route: 'same-route', model_provider_family: 'same-provider' },
        { take_id: 'tu-c', analysis_run_id: 'aru-c', mux_playback_ref: 'pb-c', safe_media_fingerprint: 'fp-c', analysis_route: 'same-route', model_provider_family: 'same-provider' },
      ],
    });
    expect(out.written).toBe(true);
    const base = path.join(root, 'take-unique-root', 'takes', 'take-tu-a', 'analysis-aru-a');
    const sameVideo = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8'));
    const suppression = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8'));
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    const report = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.report.internal.json'), 'utf8'));
    expect(sameVideo.same_video_detected).toBe(false);
    expect(sameVideo.repeated_input_detected).toBe(false);
    expect(raw.recommendation_suppressed).toBe(false);
    expect(report.recommendation_suppressed).toBe(false);
    expect(suppression.suppression_decision).toBe('allowed_internal_only');
  });

  it('keeps route-variance suppression fields consistent across artefacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-route-suppress-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-route-root',
      root_take_id: 'route-root',
      source_module: 'test',
      source_stage: 'route-variance',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'route-root', analysis_run_id: 'route-ar-a', analysis_route: 'route-a', model_provider_family: 'provider-a', mux_playback_ref: 'pb-r1', safe_media_fingerprint: 'fp-r1' },
        { take_id: 'route-b', analysis_run_id: 'route-ar-b', analysis_route: 'route-b', model_provider_family: 'provider-b', mux_playback_ref: 'pb-r2', safe_media_fingerprint: 'fp-r2' },
      ],
    });
    expect(out.written).toBe(true);
    const base = path.join(root, 'take-route-root', 'takes', 'take-route-root', 'analysis-route-ar-a');
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    const report = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.report.internal.json'), 'utf8'));
    const suppression = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8'));
    const route = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'route_variance_trace.json'), 'utf8'));
    expect(raw.recommendation_suppressed).toBe(true);
    expect(raw.suppression_reasons).toContain('unresolved_route_variance');
    expect(report.recommendation_suppressed).toBe(true);
    expect(route.route_variance_detected).toBe(true);
    expect(['suppressed', 'blocked']).toContain(suppression.suppression_decision);
    expect(raw.selected_take_id_internal_only).toBeNull();
  });

  it('uses root take analysis_run_id when root take is not first', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-root-analysis-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-root-order',
      root_take_id: 'take-b',
      source_module: 'test',
      source_stage: 'root-order',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'take-a', analysis_run_id: 'analysis-a', mux_playback_ref: 'pb-a', safe_media_fingerprint: 'fp-a' },
        { take_id: 'take-b', analysis_run_id: 'analysis-b', mux_playback_ref: 'pb-b', safe_media_fingerprint: 'fp-b' },
        { take_id: 'take-c', analysis_run_id: 'analysis-c', mux_playback_ref: 'pb-c', safe_media_fingerprint: 'fp-c' },
      ],
    });
    expect(out.written).toBe(true);
    await expect(readFile(path.join(root, 'take-root-order', 'takes', 'take-take-b', 'analysis-analysis-b', 'comparison', 'comparison.raw.json'), 'utf8')).resolves.toBeTruthy();
    await expect(readFile(path.join(root, 'take-root-order', 'takes', 'take-take-b', 'analysis-analysis-a', 'comparison', 'comparison.raw.json'), 'utf8')).rejects.toBeTruthy();
  });

  it('fails closed when root take is missing from compared_takes', async () => {
    const out = await runInternalComparisonForTakes({
      run_id: 'take-missing-root',
      root_take_id: 'take-z',
      source_module: 'test',
      source_stage: 'missing-root',
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'take-a', analysis_run_id: 'analysis-a' },
        { take_id: 'take-b', analysis_run_id: 'analysis-b' },
      ],
    });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual([]);
  });

  it('fails closed when root take analysis_run_id is unsafe', async () => {
    await expect(runInternalComparisonForTakes({
      run_id: 'take-unsafe-analysis',
      root_take_id: 'take-safe',
      source_module: 'test',
      source_stage: 'unsafe-analysis',
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'take-safe', analysis_run_id: '../analysis-b' },
        { take_id: 'take-b', analysis_run_id: 'analysis-b' },
      ],
    })).rejects.toThrow(/analysis_run_id|segment/i);
  });

  it('ignores blank mux refs for duplicate detection', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-blank-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-blank-root',
      root_take_id: 'tb-a',
      source_module: 'test',
      source_stage: 'blank-refs',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'tb-a', analysis_run_id: 'arb-a', mux_playback_ref: '' },
        { take_id: 'tb-b', analysis_run_id: 'arb-b', mux_playback_ref: '   ' },
        { take_id: 'tb-c', analysis_run_id: 'arb-c', mux_playback_ref: 'pb-a' },
        { take_id: 'tb-d', analysis_run_id: 'arb-d', mux_playback_ref: 'pb-b' },
      ],
    });
    expect(out.written).toBe(true);
    const base = path.join(root, 'take-blank-root', 'takes', 'take-tb-a', 'analysis-arb-a');
    const sameVideo = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8'));
    expect(sameVideo.same_mux_playback_ref).toBe(false);
    expect(sameVideo.same_video_detected).toBe(false);
  });

  it('detects duplicate take_id/analysis_run_id pairs in 3+ inputs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911b-dup-ids-'));
    const out = await runInternalComparisonForTakes({
      run_id: 'take-dup-ids-root',
      root_take_id: 'tid-a',
      source_module: 'test',
      source_stage: 'dup-ids',
      root_dir: root,
      internal_qa_emit: true,
      compared_takes: [
        { take_id: 'tid-a', analysis_run_id: 'arid-a' },
        { take_id: 'tid-a', analysis_run_id: 'arid-b' },
        { take_id: 'tid-c', analysis_run_id: 'arid-b' },
      ],
    });
    expect(out.written).toBe(true);
    const base = path.join(root, 'take-dup-ids-root', 'takes', 'take-tid-a', 'analysis-arid-a');
    const sameVideo = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8'));
    const suppression = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8'));
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    expect(sameVideo.same_take_id).toBe(true);
    expect(sameVideo.same_analysis_run_id).toBe(true);
    expect(sameVideo.same_video_detected).toBe(true);
    expect(suppression.suppression_decision).toBe('suppressed');
    expect(raw.selected_take_id_internal_only).toBeNull();
  });
});
