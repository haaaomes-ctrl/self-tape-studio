import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.fn();
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { storage: { from: vi.fn(() => ({ upload })) } },
}));

import { writeQAArtifact } from '@/server/v3/qa-artifact-sink.server';

describe('v3 s8 qa artifact sink', () => {
  beforeEach(() => { upload.mockReset(); upload.mockResolvedValue({ error: null }); });

  it('file sink writes as before', async () => {
    process.env.QA_ARTIFACT_SINK = 'file';
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-sink-'));
    const out = await writeQAArtifact({ run_id: 'r1', root_dir: root, relative_path: 'reports/a.json', payload: { ok: true } });
    expect(out.written).toBe(true);
    const body = JSON.parse(await readFile(path.join(root, 'r1', 'reports', 'a.json'), 'utf8'));
    expect(body.ok).toBe(true);
  });

  it('storage sink calls bucket upload with expected path', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_STORAGE_BUCKET = 'qa-artifacts';
    const out = await writeQAArtifact({ run_id: 'r2', relative_path: 'manifest.json', payload: { run_id: 'r2' } });
    expect(upload).toHaveBeenCalledWith('v3/r2/manifest.json', expect.any(String), expect.objectContaining({ contentType: 'application/json', upsert: true }));
    expect(out.storage_bucket).toBe('qa-artifacts');
  });

  it('console_jsonl sink emits prefixed log', async () => {
    process.env.QA_ARTIFACT_SINK = 'console_jsonl';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await writeQAArtifact({ run_id: 'r3', relative_path: 'manifest.json', payload: { a: 1 } });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('TAPECOACH_QA_ARTIFACT_JSON:'));
    spy.mockRestore();
  });
});
