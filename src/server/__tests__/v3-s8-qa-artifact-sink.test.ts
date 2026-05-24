import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upload, download, storageFrom } = vi.hoisted(() => {
  const upload = vi.fn();
  const download = vi.fn();
  const storageFrom = vi.fn(() => ({ upload, download }));
  return { upload, download, storageFrom };
});
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { storage: { from: storageFrom } },
}));

import { readQAArtifactText, writeQAArtifact } from '@/server/v3/qa-artifact-sink.server';

describe('v3 s8 qa artifact sink', () => {
  beforeEach(() => {
    storageFrom.mockClear();
    upload.mockReset();
    download.mockReset();
    upload.mockResolvedValue({ error: null });
    download.mockResolvedValue({ data: new Blob(['{"ok":true}'], { type: 'application/json' }), error: null });
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'false';
    delete process.env.QA_ARTIFACT_STORAGE_BUCKET;
  });

  it('file sink writes as before', async () => {
    process.env.QA_ARTIFACT_SINK = 'file';
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-sink-'));
    const out = await writeQAArtifact({ run_id: 'r1', root_dir: root, relative_path: 'reports/a.json', payload: { ok: true } });
    expect(out.written).toBe(true);
    expect(out.sink_write_status).toBe('written');
    const body = JSON.parse(await readFile(path.join(root, 'r1', 'reports', 'a.json'), 'utf8'));
    expect(body.ok).toBe(true);
  });

  it('storage sink calls bucket upload with expected path', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_STORAGE_BUCKET = 'qa-artifacts';
    const out = await writeQAArtifact({ run_id: 'r2', relative_path: 'manifest.json', payload: { run_id: 'r2' } });
    expect(upload).toHaveBeenCalledWith('r2/manifest.json', expect.any(String), expect.objectContaining({ contentType: 'application/json', upsert: true }));
    expect(out.storage_bucket).toBe('qa-artifacts');
  });

  it('defaults boolean-like storage bucket env to qa-artifacts with a warning', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_STORAGE_BUCKET = 'true';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = await writeQAArtifact({ run_id: 'r2b', relative_path: 'manifest.json', payload: { run_id: 'r2b' } });
    expect(storageFrom).toHaveBeenCalledWith('qa-artifacts');
    expect(out.written).toBe(true);
    expect(out.storage_bucket).toBe('qa-artifacts');
    expect(out.warning).toContain('qa_artifact_storage_bucket_defaulted:boolean_like_value:true');
    const logLine = spy.mock.calls.map((call) => String(call[0])).find((line) => line.includes('TAPECOACH_QA_ARTIFACT_JSON:'));
    expect(logLine).toContain('"storage_bucket":"qa-artifacts"');
    expect(logLine).not.toContain('"storage_bucket":"true"');
    expect(logLine).toContain('qa_artifact_storage_bucket_defaulted:boolean_like_value:true');
    spy.mockRestore();
  });

  it('uses resolved qa-artifacts bucket for reads when bucket env is boolean-like', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_STORAGE_BUCKET = 'true';
    const out = await readQAArtifactText({ run_id: 'r2c', relative_path: 'manifest.json' });
    expect(storageFrom).toHaveBeenCalledWith('qa-artifacts');
    expect(download).toHaveBeenCalledWith('r2c/manifest.json');
    expect(out.status).toBe('ok');
  });

  it('fallback log metadata uses resolved bucket when bucket env is boolean-like', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_STORAGE_BUCKET = 'true';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    upload.mockResolvedValue({ error: { message: 'boom' } });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = await writeQAArtifact({ run_id: 'r2d', relative_path: 'manifest.json', payload: { run_id: 'r2d' } });
    expect(out.written).toBe(false);
    expect(out.storage_bucket).toBe('qa-artifacts');
    expect(out.warning).toContain('qa_artifact_storage_bucket_defaulted:boolean_like_value:true');
    expect(out.warning).toContain('storage_upload_failed:boom');
    const logLine = spy.mock.calls.map((call) => String(call[0])).find((line) => line.includes('TAPECOACH_QA_ARTIFACT_JSON:'));
    expect(logLine).toContain('"storage_bucket":"qa-artifacts"');
    expect(logLine).not.toContain('"storage_bucket":"true"');
    expect(logLine).toContain('qa_artifact_storage_bucket_defaulted:boolean_like_value:true');
    spy.mockRestore();
  });

  it('storage failure + log fallback returns written false', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    upload.mockResolvedValue({ error: { message: 'boom' } });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = await writeQAArtifact({ run_id: 'r4', relative_path: 'manifest.json', payload: { run_id: 'r4' } });
    expect(out.written).toBe(false);
    expect(out.sink_write_status).toBe('failed');
    expect(out.log_fallback_emitted).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('TAPECOACH_QA_ARTIFACT_JSON:'));
    spy.mockRestore();
  });

  it('file failure + log fallback returns written false', async () => {
    process.env.QA_ARTIFACT_SINK = 'file';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = await writeQAArtifact({ run_id: 'r5', root_dir: '/dev/null', relative_path: 'manifest.json', payload: { run_id: 'r5' } });
    expect(out.written).toBe(false);
    expect(out.sink_write_status).toBe('failed');
    expect(out.log_fallback_emitted).toBe(true);
    spy.mockRestore();
  });

  it('console_jsonl primary sink success remains written true', async () => {
    process.env.QA_ARTIFACT_SINK = 'console_jsonl';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = await writeQAArtifact({ run_id: 'r3', relative_path: 'manifest.json', payload: { a: 1 } });
    expect(out.written).toBe(true);
    expect(out.sink_write_status).toBe('written');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('TAPECOACH_QA_ARTIFACT_JSON:'));
    spy.mockRestore();
  });


  it('fallback disabled does not report fallback_log_failed', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'false';
    upload.mockResolvedValue({ error: { message: 'boom' } });
    const out = await writeQAArtifact({ run_id: 'r7', relative_path: 'manifest.json', payload: { run_id: 'r7' } });
    expect(out.written).toBe(false);
    expect(out.warning).toContain('storage_upload_failed:boom');
    expect(out.warning).not.toContain('fallback_log_failed');
    expect(out.log_fallback_emitted).toBe(false);
  });
  it('fallback log failure remains non-throwing and written false', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    upload.mockResolvedValue({ error: { message: 'boom' } });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => { throw new Error('log fail'); });
    const out = await writeQAArtifact({ run_id: 'r6', relative_path: 'manifest.json', payload: { run_id: 'r6' } });
    expect(out.written).toBe(false);
    expect(out.sink_write_status).toBe('failed');
    expect(out.log_fallback_emitted).toBe(false);
    expect(out.warning).toContain('fallback_log_failed');
    spy.mockRestore();
  });


  it('success-path log failure does not flip primary write to failed', async () => {
    process.env.QA_ARTIFACT_SINK = 'file';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'true';
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-sink-'));
    const spy = vi.spyOn(console, 'info').mockImplementation(() => { throw new Error('log fail'); });
    const out = await writeQAArtifact({ run_id: 'r8', root_dir: root, relative_path: 'reports/b.json', payload: { ok: true } });
    expect(out.written).toBe(true);
    expect(out.sink_write_status).toBe('written');
    expect(out.log_fallback_emitted).toBe(false);
    expect(out.warning).toContain('qa_artifact_success_log_failed');
    const body = JSON.parse(await readFile(path.join(root, 'r8', 'reports', 'b.json'), 'utf8'));
    expect(body.ok).toBe(true);
    spy.mockRestore();
  });


  it('rejects unsafe relative path in storage mode', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'false';
    const out = await writeQAArtifact({ run_id: 'r9', relative_path: '../manifest.json', payload: { run_id: 'r9' } });
    expect(out.written).toBe(false);
    expect(out.sink_write_status).toBe('failed');
    expect(out.warning).toContain('artefact_path_invalid');
  });

  it('storage upload that never resolves times out within budget', async () => {
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.QA_ARTIFACT_LOG_FALLBACK = 'false';
    process.env.QA_ARTIFACT_STORAGE_TIMEOUT_MS = '50';
    upload.mockImplementation(() => new Promise(() => {})); // never resolves
    const start = Date.now();
    const out = await writeQAArtifact({ run_id: 'r10', relative_path: 'manifest.json', payload: { run_id: 'r10' } });
    const elapsed = Date.now() - start;
    expect(out.written).toBe(false);
    expect(out.sink_write_status).toBe('failed');
    expect(out.warning).toContain('storage_upload_timeout');
    expect(elapsed).toBeLessThan(2000);
    delete process.env.QA_ARTIFACT_STORAGE_TIMEOUT_MS;
  });
});
