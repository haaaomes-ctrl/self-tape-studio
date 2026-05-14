import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockSigned = vi.fn();
const mockDownload = vi.fn();
const mockRemove = vi.fn();
const mockUpload = vi.fn();

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({ list: mockList, createSignedUrl: mockSigned, download: mockDownload, remove: mockRemove, upload: mockUpload }),
    },
  },
}));

describe('admin storage impl', () => {
  beforeEach(() => {
    mockList.mockReset(); mockSigned.mockReset(); mockDownload.mockReset(); mockRemove.mockReset(); mockUpload.mockReset();
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
    expect(out[0]).toMatchObject({ path: 'takes/take-abc/analysis-take-abc/manifest.json', takeId: 'take-abc' });
  });

  it('zip returns signed url (no base64 payload) and stages binary zip', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockDownload.mockResolvedValue({ data: new Blob(['x']), error: null });
    mockUpload.mockResolvedValue({ error: null });
    mockSigned.mockResolvedValue({ data: { signedUrl: 'https://signed/zip' }, error: null });
    const out = await mod.zipSelectedArtifactsImpl([
      'takes/take-aaa/analysis-take-aaa/manifest.json',
      'takes/take-bbb/analysis-take-bbb/manifest.json',
    ]);
    expect(out).toHaveProperty('signedUrl', 'https://signed/zip');
    expect((out as any).base64Zip).toBeUndefined();
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockSigned).toHaveBeenCalledTimes(1);
  });

  it('delete removes only selected and reports per-file outcomes', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockRemove.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'denied' } });
    const out = await mod.deleteSelectedArtifactsImpl(['a.json', 'b.json']);
    expect(mockRemove.mock.calls.map((c:any)=>c[0])).toEqual([['a.json'], ['b.json']]);
    expect(out.results[1]).toEqual({ path: 'b.json', ok: false, error: 'denied' });
  });
});
