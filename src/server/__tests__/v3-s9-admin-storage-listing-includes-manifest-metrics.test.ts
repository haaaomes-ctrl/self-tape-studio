import { describe, expect, it, vi } from 'vitest';

const list = vi.fn();
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { storage: { from: vi.fn(() => ({ list })) } },
}));

import { listAllArtifactsImpl } from '@/lib/admin-storage.functions';

describe('v3 s9 admin storage listing includes manifest + metrics', () => {
  it('includes manifest.json and qa/acceptance_metrics.json alongside traces', async () => {
    list
      .mockResolvedValueOnce({ data: [{ id: null, name: 'take-t1' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: null, name: 'analysis-take-t1' }], error: null })
      .mockResolvedValueOnce({ data: [
        { id: '1', name: 'manifest.json', updated_at: '2026-05-14T00:00:00Z', metadata: { size: 10, mimetype: 'application/json' } },
        { id: null, name: 'qa' },
        { id: null, name: 'traces' },
      ], error: null })
      .mockResolvedValueOnce({ data: [
        { id: '2', name: 'acceptance_metrics.json', updated_at: '2026-05-14T00:00:01Z', metadata: { size: 12, mimetype: 'application/json' } },
      ], error: null })
      .mockResolvedValueOnce({ data: [
        { id: '3', name: 'EvidenceAnchors.json', updated_at: '2026-05-14T00:00:02Z', metadata: { size: 8, mimetype: 'application/json' } },
      ], error: null });

    const out = await listAllArtifactsImpl();
    const paths = out.map((x) => x.path);
    expect(paths).toContain('take-t1/analysis-take-t1/manifest.json');
    expect(paths).toContain('take-t1/analysis-take-t1/qa/acceptance_metrics.json');
    expect(paths).toContain('take-t1/analysis-take-t1/traces/EvidenceAnchors.json');
  });
});
