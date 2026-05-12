import { describe, expect, it, vi } from 'vitest';
import * as wiring from '@/server/v3/qa-artifacts-wiring';
import { safeEmitRawReportForQA } from '@/server/process-take.server';

describe('s8 p1 raw report emitter non-blocking', () => {
  it('returns written false and warning when raw emitter throws', async () => {
    const spy = vi.spyOn(wiring, 'emitRawReportArtefact').mockRejectedValueOnce(new Error('disk full'));
    const warnings: string[] = [];
    const out = await safeEmitRawReportForQA({
      run_id: 'take-1', take_id: 't1', source_stage: 'process_take_success', source_module: 'process-take.server', report_data: {}, internal_qa_emit: true,
    }, (w) => warnings.push(w));
    expect(out.written).toBe(false);
    expect(warnings[0]).toContain('internal_qa_raw_report_emit_failed');
    spy.mockRestore();
  });
});
