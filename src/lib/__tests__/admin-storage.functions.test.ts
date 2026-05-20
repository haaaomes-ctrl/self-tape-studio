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
        { id: null, name: 'admin-temp-zips' },
      ], error: null })
      .mockResolvedValueOnce({ data: [{ id: null, name: 'take-abc' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: null, name: 'analysis-take-abc' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: '1', name: 'manifest.json', updated_at: '2026-05-02T00:00:00Z', metadata: { size: 10, mimetype: 'application/json' } }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const out = await mod.listAllArtifactsImpl();
    expect(out.map((x:any)=>x.path)).toContain('takes/take-abc/analysis-take-abc/manifest.json');
    expect(out.some((x:any)=>String(x.path).startsWith('admin-temp-zips/'))).toBe(false);
  });

  it('cleanup removes only expired admin-zips', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    const now = Date.parse('2026-05-14T12:00:00Z');
    mockList.mockResolvedValueOnce({ data: [
      { id: '1', name: 'old.zip', updated_at: '2026-05-14T08:00:00Z' },
      { id: '2', name: 'fresh.zip', updated_at: '2026-05-14T11:30:00Z' },
    ], error: null }).mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [], error: null });
    mockRemove.mockResolvedValue({ error: null });
    const out = await mod.cleanupExpiredAdminZipsImpl(now);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith(['admin-temp-zips/old.zip']);
    expect(out.deleted).toEqual(['admin-temp-zips/old.zip']);
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
    mockList.mockResolvedValue({ data: [], error: null });
    mockRemove.mockResolvedValue({ error: null });
    const out = await mod.cleanupExpiredAdminZipsImpl(now);
    expect(mockList).toHaveBeenCalledTimes(3);
    expect(mockRemove).toHaveBeenCalledWith(['admin-temp-zips/old-page-2.zip']);
    expect(out.deleted).toContain('admin-temp-zips/old-page-2.zip');
  });

  it('zip returns signed url (no base64 payload) and stages binary zip', async () => {
    const mod = await import('@/lib/admin-storage.functions');
    const { default: JSZip } = await import('jszip');
    mockList.mockResolvedValue({ data: [], error: null });
    mockDownload
      .mockResolvedValueOnce({ data: new Blob(['{"ok":true}'], { type: 'application/json' }), error: null })
      .mockResolvedValueOnce({ data: new Blob(['{"ok":false}'], { type: 'application/json' }), error: null });
    mockUpload.mockResolvedValue({ error: null });
    mockSigned.mockResolvedValue({ data: { signedUrl: 'https://signed/zip' }, error: null });
    const out = await mod.zipSelectedArtifactsImpl([
      'takes/take-aaa/analysis-take-aaa/manifest.json',
      'takes/take-bbb/analysis-take-bbb/manifest.json',
    ]);
    expect(out).toHaveProperty('signedUrl', 'https://signed/zip');
    expect((out as any).base64Zip).toBeUndefined();
    const [uploadPath,,uploadOpts] = mockUpload.mock.calls[0];
    expect(String(uploadPath).startsWith('admin-temp-zips/')).toBe(true);
    expect(mockUpload.mock.calls[0][1]).toBeInstanceOf(Blob);
    expect(mockUpload.mock.calls[0][1].type).toBe('application/zip');
    expect(uploadOpts.metadata.temp_zip).toBe('true');
    expect(typeof uploadOpts.metadata.expires_at).toBe('string');
    const uploadedZip = await JSZip.loadAsync(await mockUpload.mock.calls[0][1].arrayBuffer());
    expect(Object.keys(uploadedZip.files).sort()).toEqual([
      'take-aaa__analysis-take-aaa__manifest.json',
      'take-bbb__analysis-take-bbb__manifest.json',
    ]);
    await expect(uploadedZip.file('take-aaa__analysis-take-aaa__manifest.json')?.async('string')).resolves.toBe('{"ok":true}');
    await expect(uploadedZip.file('take-bbb__analysis-take-bbb__manifest.json')?.async('string')).resolves.toBe('{"ok":false}');
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
    ], error: null }).mockResolvedValueOnce({ data: [], error: null });
    mockRemove.mockResolvedValueOnce({ error: { message: 'cannot-delete' } });
    const out = await mod.cleanupExpiredAdminZipsImpl(now);
    expect(out.failed.some((f:any)=>f.path === 'admin-temp-zips/old.zip' && f.error === 'cannot-delete')).toBe(true);
  });

});
