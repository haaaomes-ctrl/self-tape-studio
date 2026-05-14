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

  it('excludes admin-zips from listing', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockList
      .mockResolvedValueOnce({ data: [
        { id: null, name: 'takes' },
        { id: null, name: 'admin-zips' },
      ], error: null })
      .mockResolvedValueOnce({ data: [{ id: null, name: 'take-abc' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: null, name: 'analysis-take-abc' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: '1', name: 'manifest.json', updated_at: '2026-05-02T00:00:00Z', metadata: { size: 10, mimetype: 'application/json' } }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const out = await mod.listAllArtifactsImpl();
    expect(out.map((x:any)=>x.path)).toContain('takes/take-abc/analysis-take-abc/manifest.json');
    expect(out.some((x:any)=>String(x.path).startsWith('admin-zips/'))).toBe(false);
  });

  it('cleanup removes only expired admin-zips', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    const now = Date.parse('2026-05-14T12:00:00Z');
    mockList.mockResolvedValueOnce({ data: [
      { id: '1', name: 'old.zip', updated_at: '2026-05-14T08:00:00Z' },
      { id: '2', name: 'fresh.zip', updated_at: '2026-05-14T11:30:00Z' },
    ], error: null });
    mockRemove.mockResolvedValue({ error: null });
    const out = await mod.cleanupExpiredAdminZipsImpl(now);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith(['admin-zips/old.zip']);
    expect(out.deleted).toEqual(['admin-zips/old.zip']);
  });

  it('cleanup paginates beyond first page and deletes expired on later pages', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    const now = Date.parse('2026-05-14T12:00:00Z');
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i + 1),
      name: `fresh-${i}.zip`,
      updated_at: '2026-05-14T11:59:00Z',
    }));
    mockList
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({
        data: [{ id: '1001', name: 'old-page-2.zip', updated_at: '2026-05-14T08:00:00Z' }],
        error: null,
      });
    mockRemove.mockResolvedValue({ error: null });
    const out = await mod.cleanupExpiredAdminZipsImpl(now);
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledWith(['admin-zips/old-page-2.zip']);
    expect(out.deleted).toContain('admin-zips/old-page-2.zip');
  });

  it('zip returns signed url (no base64 payload) and stages binary zip', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockList.mockResolvedValue({ data: [], error: null });
    mockDownload.mockResolvedValue({ data: new Blob(['x']), error: null });
    mockUpload.mockResolvedValue({ error: null });
    mockSigned.mockResolvedValue({ data: { signedUrl: 'https://signed/zip' }, error: null });
    const out = await mod.zipSelectedArtifactsImpl([
      'takes/take-aaa/analysis-take-aaa/manifest.json',
      'takes/take-bbb/analysis-take-bbb/manifest.json',
    ]);
    expect(out).toHaveProperty('signedUrl', 'https://signed/zip');
    expect((out as any).base64Zip).toBeUndefined();
  });

  it('delete removes only selected and reports per-file outcomes', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    mockRemove.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'denied' } });
    const out = await mod.deleteSelectedArtifactsImpl(['a.json', 'b.json']);
    expect(mockRemove.mock.calls.map((c:any)=>c[0])).toEqual([['a.json'], ['b.json']]);
    expect(out.results[1]).toEqual({ path: 'b.json', ok: false, error: 'denied' });
  });

  it('cleanup reports remove failures without touching non-temp paths', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    const now = Date.parse('2026-05-14T12:00:00Z');
    mockList.mockResolvedValueOnce({ data: [
      { id: '1', name: 'old.zip', updated_at: '2026-05-14T08:00:00Z' },
    ], error: null });
    mockRemove.mockResolvedValueOnce({ error: { message: 'cannot-delete' } });
    const out = await mod.cleanupExpiredAdminZipsImpl(now);
    expect(out.failed[0]).toEqual({ path: 'admin-zips/old.zip', error: 'cannot-delete' });
  });

});
