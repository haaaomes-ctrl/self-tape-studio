import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildUploadIdentityMetadata, safeUploadBasename } from '@/lib/mux-upload';
import { extractUploadIdentitySignals } from '@/server/v3/media-identity-upload-signals.server';
import { emitAnalysisInputArtefacts } from '@/server/v3/qa-artifacts-wiring.server';

function fakeFile(input: {
  bytes: Uint8Array;
  name: string;
  type?: string;
  lastModified?: number;
}): File {
  return {
    name: input.name,
    type: input.type ?? '',
    size: input.bytes.byteLength,
    lastModified: input.lastModified ?? 0,
    arrayBuffer: async () => input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength),
  } as File;
}

describe('v3 s9 upload identity capture', () => {
  it('builds client pre-upload hash metadata and persists it into take/media identity artefacts', async () => {
    const bytes = new TextEncoder().encode('original upload bytes');
    const uploadIdentity = await buildUploadIdentityMetadata(fakeFile({
      bytes,
      name: '../private/uploads/Slate Take.mov',
      type: 'video/mp4',
      lastModified: 1_722_000_000_000,
    }), 61.25);
    expect(uploadIdentity.hash_capture_status).toBe('captured');
    expect(uploadIdentity.original_upload_file_hash).toMatchObject({
      algorithm: 'sha256',
      source_stage: 'client_pre_upload',
      confidence_role: 'decisive',
      raw_value_redacted: false,
    });
    expect(uploadIdentity.original_upload_file_hash?.value).toMatch(/^[a-f0-9]{64}$/);
    expect(uploadIdentity.original_file_name_safe_basename).toBe('Slate Take.mov');
    expect(uploadIdentity.file_size_bytes).toBe(bytes.byteLength);
    expect(uploadIdentity.mime_type_safe_summary).toBe('video/mp4');
    expect(uploadIdentity.last_modified_ms).toBe(1_722_000_000_000);
    expect(JSON.stringify(uploadIdentity).toLowerCase()).not.toContain('original upload bytes');

    const extracted = extractUploadIdentitySignals({
      signals: { upload_identity: uploadIdentity },
      checklist: { duration: { seconds: 61.25 } },
    });
    expect(extracted.original_upload_file_hash).toBe(`sha256:${uploadIdentity.original_upload_file_hash?.value}`);
    expect(extracted.original_file_name).toBe('Slate Take.mov');
    expect(extracted.metadata_file_name).toBe('Slate Take.mov');
    expect(extracted.file_size_bytes).toBe(bytes.byteLength);
    expect(extracted.video_duration_ms).toBe(61250);

    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s916d-upload-identity-'));
    await emitAnalysisInputArtefacts({
      run_id: 'take-upload-id',
      analysis_run_id: 'take-upload-id',
      submission_id: 'audition-upload-id',
      take_id: 'upload-id',
      compared_take_ids: ['upload-id'],
      source_module: 'test',
      source_stage: 'upload-identity',
      mux_asset_or_upload_id_present: true,
      original_upload_file_hash: extracted.original_upload_file_hash,
      original_upload_file_hash_source_stage: extracted.original_upload_file_hash_source_stage,
      original_file_name: extracted.original_file_name,
      metadata_file_name: extracted.metadata_file_name,
      file_size_bytes: extracted.file_size_bytes,
      mime_type_safe_summary: extracted.mime_type_safe_summary,
      last_modified_ms: extracted.last_modified_ms,
      upload_metadata_source: extracted.upload_metadata_source,
      video_duration_ms: extracted.video_duration_ms,
      upload_identity_metadata: extracted.upload_identity_metadata,
      internal_qa_emit: true,
      root_dir: root,
    });
    const base = path.join(root, 'take-upload-id', 'takes', 'take-upload-id', 'analysis-take-upload-id', 'inputs');
    const take = JSON.parse(await readFile(path.join(base, 'take.json'), 'utf8'));
    const mediaIdentity = JSON.parse(await readFile(path.join(base, 'media_identity.json'), 'utf8'));
    expect(take.safe_upload_identity.original_upload_file_hash).toBe(extracted.original_upload_file_hash);
    expect(take.safe_upload_identity.original_file_name_safe_basename).toBe('Slate Take.mov');
    expect(take.safe_upload_identity.mime_type_safe_summary).toBe('video/mp4');
    expect(mediaIdentity.media_identity_signals.original_upload_file_hash).toMatchObject({
      status: 'available',
      safe_value: extracted.original_upload_file_hash,
      source_path: 'signals.upload_identity.original_upload_file_hash.value',
      confidence_role: 'decisive',
    });
    expect(mediaIdentity.media_identity_signals.file_size_bytes).toMatchObject({ status: 'available', safe_value: bytes.byteLength });
    expect(mediaIdentity.signal_source_summary.upload_metadata_source).toBe('browser_file');
    expect(JSON.stringify(mediaIdentity).toLowerCase()).not.toContain('https://');
    expect(JSON.stringify(mediaIdentity).toLowerCase()).not.toContain('token');
  });

  it('redacts unsafe filenames and rejects URL-like upload hashes', () => {
    expect(safeUploadBasename('/Users/person/private/self-tape.mov')).toBe('self-tape.mov');
    expect(safeUploadBasename('take-token_secret.mov')).toBeNull();
    const extracted = extractUploadIdentitySignals({
      signals: {
        upload_identity: {
          original_upload_file_hash: {
            algorithm: 'sha256',
            value: 'https://storage.example/private/video.mp4?token=abc',
            source_stage: 'client_pre_upload',
          },
          original_file_name_safe_basename: 'take-token_secret.mov',
          metadata_file_name_safe_basename: '../private/take.mov',
          file_size_bytes: 123,
          mime_type_safe_summary: 'video/mp4',
          upload_metadata_source: 'browser_file',
        },
      },
    });
    expect(extracted.original_upload_file_hash).toBeNull();
    expect(extracted.original_file_name).toBeNull();
    expect(extracted.metadata_file_name).toBeNull();
    expect(extracted.file_size_bytes).toBe(123);
  });
});
