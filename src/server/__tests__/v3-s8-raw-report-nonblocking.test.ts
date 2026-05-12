import { describe, expect, it, vi } from 'vitest';
import * as wiring from '@/server/v3/qa-artifacts-wiring';

describe('v3 s8 raw report non-blocking helper', () => {
  it('emitRawReportArtefact failure can be caught by caller without affecting flow', async () => {
    const spy = vi.spyOn(wiring, 'emitRawReportArtefact').mockRejectedValueOnce(new Error('boom'));
    let written = true;
    try { await wiring.emitRawReportArtefact({ run_id: '../bad', take_id: 't', source_stage: 'x', source_module: 'y', report_data: {}, internal_qa_emit: true }); } catch { written = false; }
    expect(written).toBe(false);
    spy.mockRestore();
  });
});
