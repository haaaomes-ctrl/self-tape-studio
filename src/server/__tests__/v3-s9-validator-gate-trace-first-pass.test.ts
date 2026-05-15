import { describe, expect, it } from 'vitest';
import { emitGateTraceFirstPass, emitValidatorTraceFirstPass } from '../v3/qa-artifacts-wiring.server';

describe('v3 s9 validator/gate trace first pass', () => {
  const base = {
    run_id: 'run-1', analysis_run_id: 'run-1', take_id: 'abc', source_module: 'caller.ts', source_stage: 'stage',
    manifest_snapshot: { level2_qa_acceptance: 'not_accepted', public_scoring_status: 'blocked' },
    acceptance_metrics_snapshot: { level2_status: 'not_accepted', public_scoring_status: 'blocked' },
    emitted_artefact_ids: ['score_trace'], internal_qa_emit: true,
  } as any;

  it('emits validator trace from snapshots', async () => {
    const out = await emitValidatorTraceFirstPass(base);
    expect(out.written).toBe(true);
    expect(out.emitted_artefact_ids).toContain('validator_trace');
    expect(String(out.path)).toContain('traces/ValidatorTrace.json');
    expect((out.validator_trace_summary?.validation_count ?? 0)).toBeGreaterThan(0);
  });

  it('emits gate trace from snapshots', async () => {
    const out = await emitGateTraceFirstPass(base);
    expect(out.written).toBe(true);
    expect(out.emitted_artefact_ids).toContain('gate_trace');
    expect(String(out.path)).toContain('traces/GateTrace.json');
    expect((out.gate_trace_summary?.gate_count ?? 0)).toBeGreaterThan(0);
  });

  it('rejects unsafe segments', async () => {
    await expect(emitValidatorTraceFirstPass({ ...base, take_id: '../bad' })).rejects.toThrow(/take_id_invalid_path/);
    await expect(emitGateTraceFirstPass({ ...base, take_id: '../bad' })).rejects.toThrow(/take_id_invalid_path/);
  });

  it('uses run_id fallback for analysis_run_id consistently', async () => {
    const out = await emitValidatorTraceFirstPass({ ...base, run_id: 'take-abc123', analysis_run_id: undefined });
    expect(out.written).toBe(true);
    expect(String(out.path)).toContain('analysis-take-abc123');
    expect(String(out.path)).not.toContain('analysis-undefined');
  });

  it('uses run_id fallback for gate trace analysis_run_id consistently', async () => {
    const out = await emitGateTraceFirstPass({ ...base, run_id: 'take-abc123', analysis_run_id: undefined });
    expect(out.written).toBe(true);
    expect(String(out.path)).toContain('analysis-take-abc123');
    expect(String(out.path)).not.toContain('analysis-undefined');
  });

  it('keeps explicit analysis_run_id when provided', async () => {
    const outV = await emitValidatorTraceFirstPass({ ...base, run_id: 'take-run', analysis_run_id: 'analysis-explicit' });
    const outG = await emitGateTraceFirstPass({ ...base, run_id: 'take-run', analysis_run_id: 'analysis-explicit' });
    expect(String(outV.path)).toContain('analysis-analysis-explicit');
    expect(String(outG.path)).toContain('analysis-analysis-explicit');
  });

  it('does not write when both run_id and analysis_run_id are missing', async () => {
    const outV = await emitValidatorTraceFirstPass({ ...base, run_id: '', analysis_run_id: undefined });
    const outG = await emitGateTraceFirstPass({ ...base, run_id: '', analysis_run_id: undefined });
    expect(outV.written).toBe(false);
    expect(outG.written).toBe(false);
    expect(outV.emitted_artefact_ids).toEqual([]);
    expect(outG.emitted_artefact_ids).toEqual([]);
  });

  it('explicit take_id wins over run_id-derived take identity', async () => {
    const outV = await emitValidatorTraceFirstPass({ ...base, take_id: 'explicit-take', run_id: 'take-derived', analysis_run_id: 'take-derived' });
    const outG = await emitGateTraceFirstPass({ ...base, take_id: 'explicit-take', run_id: 'take-derived', analysis_run_id: 'take-derived' });
    expect(String(outV.path)).toContain('takes/take-explicit-take/analysis-take-derived');
    expect(String(outG.path)).toContain('takes/take-explicit-take/analysis-take-derived');
  });
});
