import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInternalComparisonOperatorTrigger } from '@/server/v3/qa-artifacts-wiring.server';
import { runAdminInternalComparisonTriggerImpl } from '@/server-fns/internal-comparison-trigger.functions';

describe('v3 s9 comparison operator trigger', () => {
  it('emits comparison artifacts for two completed analyses via trigger path', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911c-op-'));
    const result = await runInternalComparisonOperatorTrigger({
      root_take_id: 'take-b',
      compared_take_ids: ['take-a', 'take-b'],
      source_module: 'test',
      source_stage: 'operator-trigger',
      root_dir: root,
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `analysis-${takeId}`, completed: true, mux_playback_ref: `pb-${takeId}` }));
    expect(result.ok).toBe(true);
    expect(result.written).toBe(true);
    expect(result.root_analysis_run_id).toBe('analysis-take-b');
    expect(result.emitted_artefact_ids.sort()).toEqual(['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace'].sort());
    const base = path.join(root, 'take-b', 'takes', 'take-take-b', 'analysis-analysis-take-b');
    await expect(readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8')).resolves.toBeTruthy();
  });

  it('fails closed for one-take input', async () => {
    const result = await runInternalComparisonOperatorTrigger({ root_take_id: 'take-a', compared_take_ids: ['take-a'], source_module: 'test', source_stage: 'one-take', internal_qa_emit: true }, async (takeId) => ({ take_id: takeId, analysis_run_id: `analysis-${takeId}`, completed: true }));
    expect(result.ok).toBe(false);
    expect(result.written).toBe(false);
    expect(result.comparison_run_id).toBeNull();
  });

  it('fails closed when root take is missing from compared list', async () => {
    const result = await runInternalComparisonOperatorTrigger({ root_take_id: 'take-z', compared_take_ids: ['take-a', 'take-b'], source_module: 'test', source_stage: 'missing-root', internal_qa_emit: true }, async (takeId) => ({ take_id: takeId, analysis_run_id: `analysis-${takeId}`, completed: true }));
    expect(result.ok).toBe(false);
    expect(result.written).toBe(false);
    expect(result.warning).toMatch(/root_take_id/i);
  });

  it('fails closed when qa flags are disabled', async () => {
    const result = await runInternalComparisonOperatorTrigger({ root_take_id: 'take-a', compared_take_ids: ['take-a', 'take-b'], source_module: 'test', source_stage: 'flags-disabled', internal_qa_emit: false }, async (takeId) => ({ take_id: takeId, analysis_run_id: `analysis-${takeId}`, completed: true }));
    expect(result.ok).toBe(false);
    expect(result.written).toBe(false);
    expect(result.warning).toContain('disabled');
  });

  it('admin/internal entrypoint succeeds and preserves suppression for same-video', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911c-admin-'));
    const out = await runAdminInternalComparisonTriggerImpl({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      source_module: 'test',
      source_stage: 'admin-entry',
      root_dir: root,
      internal_qa_emit: true,
    }, async (takeId) => ({
      take_id: takeId,
      analysis_run_id: `ar-${takeId}`,
      completed: true,
      mux_playback_ref: 'pb-same',
      artefact_summaries: { token: 'SECRET_TOKEN', signed_url: 'https://signed.example' },
    }));
    expect(out.ok).toBe(true);
    const base = path.join(root, 'a', 'takes', 'take-a', 'analysis-ar-a');
    const raw = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8'));
    const report = JSON.parse(await readFile(path.join(base, 'comparison', 'comparison.report.internal.json'), 'utf8'));
    const suppression = JSON.parse(await readFile(path.join(base, 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8'));
    expect(raw.recommendation_suppressed).toBe(true);
    expect(report.recommendation_suppressed).toBe(true);
    expect(suppression.suppression_decision).toBe('suppressed');
    expect(raw.selected_take_id_internal_only).toBeNull();
    expect(JSON.stringify(raw)).not.toContain('SECRET_TOKEN');
  });

  it('fails closed on explicit compared analysis run mismatch via entrypoint', async () => {
    const out = await runAdminInternalComparisonTriggerImpl({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      compared_analysis_run_ids: ['ar-a', 'ar-wrong'],
      source_module: 'test',
      source_stage: 'mismatch',
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    expect(out.ok).toBe(false);
    expect(out.written).toBe(false);
    expect(out.blocker_codes).toContain('analysis_run_id_mismatch');
  });

  it('suppresses on route variance via entrypoint', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911c-route-'));
    const out = await runAdminInternalComparisonTriggerImpl({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      source_module: 'test',
      source_stage: 'route-variance',
      root_dir: root,
      internal_qa_emit: true,
    }, async (takeId) => ({
      take_id: takeId,
      analysis_run_id: `ar-${takeId}`,
      completed: true,
      analysis_route: takeId === 'a' ? 'route-a' : 'route-b',
      model_provider_family: takeId === 'a' ? 'provider-a' : 'provider-b',
    }));
    expect(out.ok).toBe(true);
    const route = JSON.parse(await readFile(path.join(root, 'a', 'takes', 'take-a', 'analysis-ar-a', 'comparison_traces', 'route_variance_trace.json'), 'utf8'));
    expect(route.route_variance_detected).toBe(true);
  });
});
