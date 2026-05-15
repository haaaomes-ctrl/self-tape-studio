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
});
