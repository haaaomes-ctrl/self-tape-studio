import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildUnavailableUploadIdentityMetadata,
  buildUploadIdentityMetadata,
  mergeSafeUploadIdentity,
  safeUploadBasename,
} from '@/lib/mux-upload';
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
    expect(extracted.metadata_file_name).toBe('take.mov');
    expect(extracted.file_size_bytes).toBe(123);
  });

  it('captures upload identity for a second browser upload in the same audition', async () => {
    const bytes = new TextEncoder().encode('same uploaded file bytes');
    const firstIdentity = await buildUploadIdentityMetadata(fakeFile({
      bytes,
      name: 'first take.mp4',
      type: 'video/mp4',
      lastModified: 1_722_000_000_000,
    }), 49.5);
    const secondIdentity = await buildUploadIdentityMetadata(fakeFile({
      bytes,
      name: 'renamed second take.mp4',
      type: 'video/mp4',
      lastModified: 1_722_000_100_000,
    }), 49.5);

    expect(firstIdentity.original_upload_file_hash?.value).toBe(secondIdentity.original_upload_file_hash?.value);
    const first = extractUploadIdentitySignals({ signals: { upload_identity: firstIdentity } });
    const second = extractUploadIdentitySignals({ signals: { upload_identity: secondIdentity } });
    expect(first.original_upload_file_hash).toBeTruthy();
    expect(second.original_upload_file_hash).toBe(first.original_upload_file_hash);
    expect(second.file_size_bytes).toBe(bytes.byteLength);
    expect(second.original_file_name).toBe('renamed second take.mp4');
    expect(second.upload_identity_capture_status).toBe('captured');

    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s916d-second-upload-'));
    for (const [takeId, upload] of [['first', first], ['second', second]] as const) {
      await emitAnalysisInputArtefacts({
        run_id: `take-${takeId}`,
        analysis_run_id: `take-${takeId}`,
        submission_id: 'same-audition',
        take_id: takeId,
        compared_take_ids: [takeId],
        source_module: 'test',
        source_stage: 'second-upload-regression',
        original_upload_file_hash: upload.original_upload_file_hash,
        original_upload_file_hash_source_stage: upload.original_upload_file_hash_source_stage,
        original_file_name: upload.original_file_name,
        metadata_file_name: upload.metadata_file_name,
        file_size_bytes: upload.file_size_bytes,
        mime_type_safe_summary: upload.mime_type_safe_summary,
        last_modified_ms: upload.last_modified_ms,
        upload_metadata_source: upload.upload_metadata_source,
        upload_identity_metadata: upload.upload_identity_metadata,
        upload_identity_capture_status: upload.upload_identity_capture_status,
        upload_identity_capture_reason: upload.upload_identity_capture_reason,
        upload_identity_merge_status: upload.upload_identity_merge_status,
        video_duration_ms: upload.video_duration_ms,
        internal_qa_emit: true,
        root_dir: root,
      });
    }
    const secondBase = path.join(root, 'take-second', 'takes', 'take-second', 'analysis-take-second', 'inputs');
    const secondTake = JSON.parse(await readFile(path.join(secondBase, 'take.json'), 'utf8'));
    const secondMediaIdentity = JSON.parse(await readFile(path.join(secondBase, 'media_identity.json'), 'utf8'));
    expect(secondTake.safe_upload_identity.original_upload_file_hash).toBe(second.original_upload_file_hash);
    expect(secondTake.safe_upload_identity.file_size_bytes).toBe(bytes.byteLength);
    expect(secondTake.safe_upload_identity.upload_identity_capture_status).toBe('captured');
    expect(secondMediaIdentity.media_identity_signals.original_upload_file_hash).toMatchObject({
      status: 'available',
      safe_value: second.original_upload_file_hash,
    });
  });

  it('preserves populated upload identity when later updates send null or invalid fields', async () => {
    const existing = await buildUploadIdentityMetadata(fakeFile({
      bytes: new TextEncoder().encode('valid original'),
      name: 'valid.mp4',
      type: 'video/mp4',
      lastModified: 1_722_000_000_000,
    }), 30);
    const nullUpdate = {
      original_upload_file_hash: null,
      original_file_name_safe_basename: null,
      metadata_file_name_safe_basename: null,
      file_size_bytes: null,
      mime_type_safe_summary: null,
      upload_metadata_source: 'browser_file',
    };
    const preserved = mergeSafeUploadIdentity(existing, nullUpdate);
    expect(preserved?.original_upload_file_hash?.value).toBe(existing.original_upload_file_hash?.value);
    expect(preserved?.file_size_bytes).toBe(existing.file_size_bytes);

    const invalidHash = mergeSafeUploadIdentity(existing, {
      ...nullUpdate,
      original_upload_file_hash: { algorithm: 'sha256', value: 'https://signed.example/video.mp4?token=abc' },
    });
    expect(invalidHash?.original_upload_file_hash?.value).toBe(existing.original_upload_file_hash?.value);
    expect(invalidHash?.blocker_codes).toContain('invalid_original_upload_file_hash_rejected');
  });

  it('records explicit unavailable reason when no browser File object is available', () => {
    const unavailable = buildUnavailableUploadIdentityMetadata('upload_hash_unavailable_no_file_object');
    expect(unavailable.original_upload_file_hash).toBeNull();
    expect(unavailable.hash_capture_status).toBe('unavailable');
    expect(unavailable.blocker_codes).toContain('upload_hash_unavailable_no_file_object');
    const extracted = extractUploadIdentitySignals({ signals: { upload_identity: unavailable } });
    expect(extracted.original_upload_file_hash).toBeNull();
    expect(extracted.upload_identity_capture_reason).toContain('upload_hash_unavailable_no_file_object');
  });

  it('keeps the new-audition upload path wired to browser-file identity capture', async () => {
    const routeSource = await readFile('src/routes/new.tsx', 'utf8');
    expect(routeSource).toContain('buildUploadIdentityMetadata');
    expect(routeSource).toContain('upload_identity: await buildUploadIdentityMetadata(file');
  });
});
