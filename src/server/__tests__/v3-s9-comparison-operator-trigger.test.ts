import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInternalComparisonOperatorTrigger } from '@/server/v3/qa-artifacts-wiring.server';

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
});
