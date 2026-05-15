import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInternalComparisonOperatorTrigger } from '@/server/v3/qa-artifacts-wiring.server';
import { assertAdminEmail, isExplicitCompletedAnalysisStatus, runAdminInternalComparisonTriggerImpl, resolveCompletedTakeComparisonSourceByTakeId } from '@/server-fns/internal-comparison-trigger.functions';
import { assertSafeSegment } from '@/server/v3/qa-artifacts.server';
import { z } from 'zod';

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

  it('unauthenticated/non-admin guard fails closed before helper invocation', async () => {
    try {
      assertAdminEmail(null);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(403);
    }
    try {
      assertAdminEmail({ email: 'not-admin@example.com' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(403);
    }
  });

  it('admin guard allows admin caller', async () => {
    expect(() => assertAdminEmail({ email: 'o.halawi90@gmail.com' })).not.toThrow();
  });

  it('resolver fails closed for unsafe take id', async () => {
    const row = await resolveCompletedTakeComparisonSourceByTakeId('../unsafe');
    expect(row).toBeNull();
  });

  it('resolver safety: unresolved and incomplete takes fail closed; safe fields only', async () => {
    const unresolved = await runAdminInternalComparisonTriggerImpl({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      source_module: 'test',
      source_stage: 'unresolved',
      internal_qa_emit: true,
    }, async (takeId) => takeId === 'b' ? null : ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    expect(unresolved.ok).toBe(false);
    const incomplete = await runAdminInternalComparisonTriggerImpl({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      source_module: 'test',
      source_stage: 'incomplete',
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: takeId !== 'b' }));
    expect(incomplete.ok).toBe(false);
    const safe = await runAdminInternalComparisonTriggerImpl({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      source_module: 'test',
      source_stage: 'safe-fields',
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true, mux_playback_ref: 'pb', analysis_route: 'route', model_provider_family: 'provider', artefact_summaries: { score_trace_summary: { score_count: 1 } } }));
    const txt = JSON.stringify(safe);
    for (const banned of ['prompt', 'raw_response', 'token', 'secret', 'signed_url', 'video_url', 'cookie', 'session']) expect(txt).not.toContain(banned);
  });

  it('fails closed for resolver take_id mismatch without throw', async () => {
    const out = await runInternalComparisonOperatorTrigger({
      root_take_id: 'take-a',
      compared_take_ids: ['take-a', 'take-b'],
      source_module: 'test',
      source_stage: 'resolver-mismatch',
      internal_qa_emit: true,
    }, async (takeId) => takeId === 'take-a'
      ? ({ take_id: 'take-x', analysis_run_id: 'ar-x', completed: true })
      : ({ take_id: 'take-b', analysis_run_id: 'ar-b', completed: true }));
    expect(out.ok).toBe(false);
    expect(out.written).toBe(false);
    expect(out.warning).toBe('resolver_take_id_mismatch');
    expect(out.emitted_artefact_ids).toEqual([]);
    expect(out.comparison_run_id).toBeNull();
  });

  it('fails closed for duplicate resolved take ids without throw', async () => {
    const out = await runInternalComparisonOperatorTrigger({
      root_take_id: 'take-a',
      compared_take_ids: ['take-a', 'take-b'],
      source_module: 'test',
      source_stage: 'duplicate-resolved',
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: 'take-a', analysis_run_id: `ar-${takeId}`, completed: true }));
    expect(out.ok).toBe(false);
    expect(out.written).toBe(false);
    expect(['duplicate_resolved_take_id', 'resolver_take_id_mismatch']).toContain(out.warning);
    expect(out.emitted_artefact_ids).toEqual([]);
  });

  it('fails closed when completed is undefined or null or false', async () => {
    const baseInput = { root_take_id: 'a', compared_take_ids: ['a', 'b'], source_module: 'test', source_stage: 'completed-state', internal_qa_emit: true } as const;
    const u = await runInternalComparisonOperatorTrigger(baseInput, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: undefined as unknown as boolean }));
    const n = await runInternalComparisonOperatorTrigger(baseInput, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: null as unknown as boolean }));
    const f = await runInternalComparisonOperatorTrigger(baseInput, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: false }));
    for (const out of [u, n, f]) {
      expect(out.ok).toBe(false);
      expect(out.written).toBe(false);
      expect(out.warning).toBe('take_analysis_not_completed');
      expect(out.emitted_artefact_ids).toEqual([]);
    }
  });

  it('fails closed for missing/null/non-string/empty analysis_status mapped completion uncertainty', async () => {
    const mk = async (completed: unknown) => runAdminInternalComparisonTriggerImpl({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      source_module: 'test',
      source_stage: 'status-missing-null-nonstr-empty',
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: completed as boolean }));
    for (const out of [await mk(undefined), await mk(null), await mk(123), await mk('' as unknown as boolean)]) {
      expect(out.ok).toBe(false);
      expect(out.written).toBe(false);
      expect(out.emitted_artefact_ids).toEqual([]);
      expect(out.comparison_run_id).toBeNull();
    }
  });

  it('fails closed for pending/processing/failed style statuses mapped to incomplete', async () => {
    for (const status of ['pending', 'processing', 'failed']) {
      const out = await runAdminInternalComparisonTriggerImpl({
        root_take_id: 'a',
        compared_take_ids: ['a', 'b'],
        source_module: 'test',
        source_stage: `status-${status}`,
        internal_qa_emit: true,
      }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: false }));
      expect(out.ok).toBe(false);
      expect(out.written).toBe(false);
      expect(out.emitted_artefact_ids).toEqual([]);
    }
  });

  it('accepted explicit completed statuses remain eligible', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911c-status-ok-'));
    for (const status of ['completed', 'succeeded', 'processed']) {
      const out = await runAdminInternalComparisonTriggerImpl({
        root_take_id: 'a',
        compared_take_ids: ['a', 'b'],
        source_module: 'test',
        source_stage: `status-${status}`,
        root_dir: root,
        internal_qa_emit: true,
      }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}-${status}`, completed: true }));
      expect(out.ok).toBe(true);
      expect(out.emitted_artefact_ids.sort()).toEqual(['comparison_raw', 'comparison_report_internal', 'same_video_repeatability_trace', 'comparison_suppression_trace', 'route_variance_trace'].sort());
    }
  });

  it('fails closed for compared_analysis_run_ids too short/long and unsafe explicit ids', async () => {
    const base = { root_take_id: 'a', compared_take_ids: ['a', 'b'], source_module: 'test', source_stage: 'cardinality', internal_qa_emit: true } as const;
    const shortOut = await runInternalComparisonOperatorTrigger({ ...base, compared_analysis_run_ids: ['ar-a'] }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    const longOut = await runInternalComparisonOperatorTrigger({ ...base, compared_analysis_run_ids: ['ar-a', 'ar-b', 'ar-c'] }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    const unsafeOut = await runInternalComparisonOperatorTrigger({ ...base, compared_analysis_run_ids: ['../unsafe', 'ar-b'] }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    expect(shortOut.warning).toBe('compared_analysis_run_ids_length_mismatch');
    expect(longOut.warning).toBe('compared_analysis_run_ids_length_mismatch');
    expect(unsafeOut.warning).toBe('explicit_analysis_run_id_mismatch');
    expect(shortOut.written).toBe(false);
    expect(longOut.written).toBe(false);
    expect(unsafeOut.written).toBe(false);
  });

  it('succeeds when compared_analysis_run_ids exact length and matching', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911c-cardinality-ok-'));
    const out = await runInternalComparisonOperatorTrigger({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      compared_analysis_run_ids: ['ar-a', 'ar-b'],
      source_module: 'test',
      source_stage: 'cardinality-ok',
      root_dir: root,
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    expect(out.ok).toBe(true);
    const base = path.join(root, 'a', 'takes', 'take-a', 'analysis-ar-a');
    await expect(readFile(path.join(base, 'comparison', 'comparison.raw.json'), 'utf8')).resolves.toBeTruthy();
    await expect(readFile(path.join(base, 'comparison', 'comparison.report.internal.json'), 'utf8')).resolves.toBeTruthy();
    await expect(readFile(path.join(base, 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8')).resolves.toBeTruthy();
    await expect(readFile(path.join(base, 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8')).resolves.toBeTruthy();
    await expect(readFile(path.join(base, 'comparison_traces', 'route_variance_trace.json'), 'utf8')).resolves.toBeTruthy();
  });

  it('fails closed for unsafe comparison_run_id values at boundary-equivalent validation', async () => {
    const schema = z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).refine((value) => {
      try {
        assertSafeSegment(value, 'comparison_run_id');
        return true;
      } catch {
        return false;
      }
    });
    for (const bad of ['comparison bad', 'comparison!', '../comparison-x', 'comparison/x', 'comparison\\x', '.', '..']) {
      expect(schema.safeParse(bad).success).toBe(false);
    }
  });

  it('safe explicit comparison_run_id succeeds and omitted comparison_run_id generates safe id', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911c-runid-'));
    const explicit = await runInternalComparisonOperatorTrigger({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      comparison_run_id: 'comparison-safe-123',
      source_module: 'test',
      source_stage: 'safe-explicit-id',
      root_dir: root,
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    expect(explicit.ok).toBe(true);
    expect(explicit.comparison_run_id).toBe('comparison-safe-123');
    const generated = await runInternalComparisonOperatorTrigger({
      root_take_id: 'c',
      compared_take_ids: ['c', 'd'],
      source_module: 'test',
      source_stage: 'generated-id',
      root_dir: root,
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    expect(generated.ok).toBe(true);
    expect(generated.comparison_run_id).toMatch(/^comparison-[a-z0-9-]+$/);
    expect(generated.warning).toBeNull();
  });

  it('fails closed when resolver rejects and does not leak raw error text', async () => {
    const out = await runInternalComparisonOperatorTrigger({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      source_module: 'test',
      source_stage: 'resolver-reject',
      internal_qa_emit: true,
    }, async (takeId) => {
      if (takeId === 'b') throw new Error('SUPABASE_SERVICE_ROLE_KEY=secret-test-value signed_url=https://example.invalid/private');
      return { take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true };
    });
    expect(out.ok).toBe(false);
    expect(out.written).toBe(false);
    expect(out.warning).toBe('take_resolution_failed');
    expect(out.blocker_codes).toContain('take_resolution_failed');
    expect(out.comparison_run_id).toBeNull();
    expect(out.emitted_artefact_ids).toEqual([]);
    const txt = JSON.stringify(out);
    expect(txt).not.toContain('secret-test-value');
    expect(txt).not.toContain('signed_url');
    expect(txt).not.toContain('example.invalid/private');
  });

  it('fails closed when first resolver succeeds and second rejects (no partial emit)', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s911c-reject-partial-'));
    const out = await runInternalComparisonOperatorTrigger({
      root_take_id: 'a',
      compared_take_ids: ['a', 'b'],
      source_module: 'test',
      source_stage: 'resolver-reject-partial',
      root_dir: root,
      internal_qa_emit: true,
    }, async (takeId) => {
      if (takeId === 'a') return { take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true };
      throw new Error('resolver transient failure');
    });
    expect(out.ok).toBe(false);
    expect(out.written).toBe(false);
    expect(out.warning).toBe('take_resolution_failed');
    expect(out.emitted_artefact_ids).toEqual([]);
    expect(out.comparison_run_id).toBeNull();
    await expect(readFile(path.join(root, 'a', 'takes', 'take-a', 'analysis-ar-a', 'comparison', 'comparison.raw.json'), 'utf8')).rejects.toBeTruthy();
  });

  it('accepts complete status and normalizes trim/case', () => {
    for (const v of ['complete', ' complete ', 'Complete', 'completed', 'succeeded', 'processed']) {
      expect(isExplicitCompletedAnalysisStatus(v)).toBe(true);
    }
  });

  it('rejects missing/unknown/active/error statuses', () => {
    for (const v of [undefined, null, '', 123, {}, 'unknown', 'pending', 'processing', 'analysing', 'failed', 'error', 'cancelled']) {
      expect(isExplicitCompletedAnalysisStatus(v)).toBe(false);
    }
  });

  it('fails closed for duplicate compared_take_ids before resolver invocation', async () => {
    let calls = 0;
    const out = await runInternalComparisonOperatorTrigger({
      root_take_id: 'take-a',
      compared_take_ids: ['take-a', 'take-a', 'take-b'],
      source_module: 'test',
      source_stage: 'dup-compared-take-id',
      internal_qa_emit: true,
    }, async () => {
      calls += 1;
      return { take_id: 'take-a', analysis_run_id: 'ar-a', completed: true };
    });
    expect(out.ok).toBe(false);
    expect(out.warning).toBe('duplicate_compared_take_id');
    expect(out.blocker_codes).toContain('duplicate_compared_take_id');
    expect(out.emitted_artefact_ids).toEqual([]);
    expect(out.comparison_run_id).toBeNull();
    expect(calls).toBe(0);
  });

  it('fails closed for duplicate compared_take_ids after trim', async () => {
    const out = await runInternalComparisonOperatorTrigger({
      root_take_id: 'take-a',
      compared_take_ids: ['take-a', ' take-a ', 'take-b'],
      source_module: 'test',
      source_stage: 'dup-compared-take-id-trim',
      internal_qa_emit: true,
    }, async (takeId) => ({ take_id: takeId, analysis_run_id: `ar-${takeId}`, completed: true }));
    expect(out.ok).toBe(false);
    expect(out.warning).toBe('duplicate_compared_take_id');
  });
});
