import { mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { emitModelRunTraceFirstPass, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 model run trace first pass', () => {
  it('emits from safe model metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    const out = await emitModelRunTraceFirstPass({
      run_id: 'take-safe123', analysis_run_id: 'take-safe123', take_id: 'safe123', source_module: 'unit-test', source_stage: 'analysis_generation', analysis_route: 'single_pass', root_dir: root, internal_qa_emit: true,
      model_run_entries: [{ model_provider: 'openrouter', model_name: 'google/gemini-3-flash-preview', started_at: '2026-05-15T10:00:00.000Z', completed_at: '2026-05-15T10:00:01.000Z', duration_ms: 1000, timeout_ms: 90000, timed_out: false, retry_count: 0, http_status: 200, fallback_used: false, circuit_open: false, analysis_tier: 'standard', request_status: 'completed' }],
    });
    expect(out.written).toBe(true);
    expect(out.emitted_artefact_ids).toContain('model_run_trace');
    expect(Number((out.model_run_trace_summary as any)?.model_run_count ?? 0)).toBeGreaterThan(0);
    const p = path.join(root, 'take-safe123', 'takes', 'take-safe123', 'analysis-take-safe123', 'traces', 'ModelRunTrace.json');
    const payload = JSON.parse(await readFile(p, 'utf8'));
    expect(payload.model_run_entries.length).toBeGreaterThan(0);
    expect(payload.source_module).toBe('unit-test');
    expect(payload.source_stage).toBe('analysis_generation');
    expect(payload.analysis_run_id).toBe('take-safe123');
    expect(payload.take_id).toBe('safe123');
    expect(payload.public_output_unchanged).toBe(true);
    expect(payload.cannot_satisfy_model_run_gate).toBe(true);
    expect(payload.gate_satisfaction_reason).toContain('runtime_metadata_without_independent_model_proof_chain');
  });

  it('uses computed per-attempt timeout when it differs from global timeout', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    const out = await emitModelRunTraceFirstPass({
      run_id: 'take-timeout-small', analysis_run_id: 'take-timeout-small', take_id: 'timeout-small', source_module: 'unit-test', source_stage: 'analysis_generation', root_dir: root, internal_qa_emit: true,
      model_run_entries: [{ model_name: 'm', timeout_ms: 12000, request_status: 'completed' }],
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'take-timeout-small', 'takes', 'take-timeout-small', 'analysis-take-timeout-small', 'traces', 'ModelRunTrace.json'), 'utf8'));
    expect(payload.model_run_entries[0].timeout_ms).toBe(12000);
    expect(payload.model_run_entries[0].timeout_ms).not.toBe(90000);
  });

  it('keeps default/normal timeout value when computed value equals global timeout', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    const out = await emitModelRunTraceFirstPass({
      run_id: 'take-timeout-default', analysis_run_id: 'take-timeout-default', take_id: 'timeout-default', source_module: 'unit-test', source_stage: 'analysis_generation', root_dir: root, internal_qa_emit: true,
      model_run_entries: [{ model_name: 'm', timeout_ms: 90000, request_status: 'completed' }],
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'take-timeout-default', 'takes', 'take-timeout-default', 'analysis-take-timeout-default', 'traces', 'ModelRunTrace.json'), 'utf8'));
    expect(payload.model_run_entries[0].timeout_ms).toBe(90000);
    expect(payload.model_run_entries[0].timeout_ms).not.toBeNull();
  });

  it('returns no write when no safe model metadata exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    const out = await emitModelRunTraceFirstPass({ run_id: 'take-none', analysis_run_id: 'take-none', take_id: 'none', source_module: 'unit-test', source_stage: 'analysis_generation', root_dir: root, internal_qa_emit: true, model_run_entries: [] });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).not.toContain('model_run_trace');
    expect((out as any).model_run_trace_summary).toBeUndefined();
    expect(existsSync(path.join(root, 'take-none', 'takes', 'take-none', 'analysis-take-none', 'traces', 'ModelRunTrace.json'))).toBe(false);
  });

  it('forbidden fields are excluded', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    const forbiddenValue = 'super-secret-value';
    const out = await emitModelRunTraceFirstPass({ run_id: 'take-redact', analysis_run_id: 'take-redact', take_id: 'redact', source_module: 'unit-test', source_stage: 'analysis_generation', root_dir: root, internal_qa_emit: true, model_run_entries: [{ model_provider: 'openrouter', model_name: 'm', request_status: 'completed', prompt: forbiddenValue, raw_response: forbiddenValue, authorization: forbiddenValue, headers: forbiddenValue } as any] });
    expect(out.written).toBe(true);
    const p = path.join(root, 'take-redact', 'takes', 'take-redact', 'analysis-take-redact', 'traces', 'ModelRunTrace.json');
    const payloadText = await readFile(p, 'utf8');
    const payload = JSON.parse(payloadText);
    expect(payload.redaction_policy).toBeTruthy();
    expect(Array.isArray(payload.redacted_fields)).toBe(true);
    expect(payload.forbidden_fields_absent).toBe(true);
    const entryKeys = Object.keys(payload.model_run_entries[0] ?? {});
    for (const k of ['prompt','raw_prompt','system_prompt','user_prompt','prompt_messages','request_body','raw_response','response_text','candidates','model_output','completion_text','authorization','api_key','token','secret','cookie','session','signed_url','headers']) {
      expect(entryKeys).not.toContain(k);
    }
    expect(payloadText).not.toContain(forbiddenValue);
  });

  it('path safety rejects unsafe ids', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    await expect(emitModelRunTraceFirstPass({ run_id: 'take-../bad', analysis_run_id: '../bad', take_id: '../bad', source_module: 'unit-test', source_stage: 'analysis_generation', root_dir: root, internal_qa_emit: true, model_run_entries: [{ model_name: 'm' }] as any })).rejects.toThrow();
  });

  it('invalid timeout is not emitted as false data', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    const out = await emitModelRunTraceFirstPass({
      run_id: 'take-timeout-invalid', analysis_run_id: 'take-timeout-invalid', take_id: 'timeout-invalid', source_module: 'unit-test', source_stage: 'analysis_generation', root_dir: root, internal_qa_emit: true,
      model_run_entries: [{ model_name: 'm', timeout_ms: Number.NaN, request_status: 'completed' }, { model_name: 'm', timeout_ms: -1, request_status: 'completed' } as any],
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'take-timeout-invalid', 'takes', 'take-timeout-invalid', 'analysis-take-timeout-invalid', 'traces', 'ModelRunTrace.json'), 'utf8'));
    expect(payload.model_run_entries[0].timeout_ms).toBeNull();
    expect(payload.model_run_entries[1].timeout_ms).toBeNull();
  });

  it('supports run_id fallback take identity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    const out = await emitModelRunTraceFirstPass({ run_id: 'take-derived123', analysis_run_id: 'take-derived123', source_module: 'unit-test', source_stage: 'analysis_generation', root_dir: root, internal_qa_emit: true, model_run_entries: [{ model_name: 'm', request_status: 'completed' }] });
    expect(out.written).toBe(true);
    const p = path.join(root, 'take-derived123', 'takes', 'take-derived123', 'analysis-take-derived123', 'traces', 'ModelRunTrace.json');
    const payload = JSON.parse(await readFile(p, 'utf8'));
    expect(payload.take_id).toBe('derived123');
  });

  it('non-take finalisation skips model_run_trace without failing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-model-run-'));
    const out = await emitQAManifestForAnalysisRun({ run_id: 'comparison-run-123', analysis_run_id: 'comparison-run-123', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false } });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(root, 'comparison-run-123', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'comparison-run-123', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.emitted_artifacts).not.toContain('model_run_trace');
    expect(manifest.artefact_status_by_id.model_run_trace).toBe('missing');
    expect(metrics.model_run_trace_status).toBe('missing');
  });
});
