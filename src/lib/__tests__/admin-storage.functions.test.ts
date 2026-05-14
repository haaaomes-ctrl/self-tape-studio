import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockSigned = vi.fn();
const mockDownload = vi.fn();
const mockRemove = vi.fn();

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({ list: mockList, createSignedUrl: mockSigned, download: mockDownload, remove: mockRemove }),
    },
  },
}));

describe('admin storage impl', () => {
  beforeEach(() => {
    mockList.mockReset(); mockSigned.mockReset(); mockDownload.mockReset(); mockRemove.mockReset();
  });

  it('rejects non-admin claims', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    expect(() => mod.assertAdminClaims({ email: 'non-admin@example.com' })).toThrow();
  });

  it('lists nested files with metadata + inferred IDs', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockList
      .mockResolvedValueOnce({ data: [{ id: null, name: 'takes' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: null, name: 'take-abc' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: null, name: 'analysis-take-abc' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: '1', name: 'manifest.json', updated_at: '2026-05-02T00:00:00Z', metadata: { size: 10, mimetype: 'application/json' } }], error: null });
    const out = await mod.listAllArtifactsImpl();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      path: 'takes/take-abc/analysis-take-abc/manifest.json',
      size: 10,
      lastModified: '2026-05-02T00:00:00Z',
      contentType: 'application/json',
      takeId: 'take-abc',
      analysisRunId: 'analysis-take-abc',
    });
  });

  it('zip downloads exactly selected files and returns expected envelope', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockDownload.mockResolvedValue({ data: new Blob(['x']), error: null });
    const out = await mod.zipSelectedArtifactsImpl([
      'takes/take-aaa/analysis-take-aaa/manifest.json',
      'takes/take-bbb/analysis-take-bbb/manifest.json',
    ]);
    expect(mockDownload).toHaveBeenCalledTimes(2);
    expect(out.count).toBe(2);
    expect(out.filename).toContain('qa-artifacts-selected-');
    expect(out.base64Zip.length).toBeGreaterThan(0);
  });

  it('delete removes only selected and reports per-file outcomes', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockRemove.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'denied' } });
    const out = await mod.deleteSelectedArtifactsImpl(['a.json', 'b.json']);
    expect(mockRemove.mock.calls.map((c:any)=>c[0])).toEqual([['a.json'], ['b.json']]);
    expect(out.results).toEqual([
      { path: 'a.json', ok: true, error: null },
      { path: 'b.json', ok: false, error: 'denied' },
    ]);
  });

  it('secret names are not exposed in list payload', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockList.mockResolvedValueOnce({ data: [{ id: '1', name: 'manifest.json', updated_at: null, metadata: { size: 1, mimetype: 'application/json' } }], error: null });
    const out = await mod.listAllArtifactsImpl();
    const dump = JSON.stringify(out);
    for (const secret of ['RECONCILER_SECRET','ANON_SESSION_SECRET','MUX_TOKEN_ID','MUX_TOKEN_SECRET','MUX_WEBHOOK_SECRET','token_secret','webhook_secret','session_secret']) {
      expect(dump).not.toContain(secret);
    }
  });
});
