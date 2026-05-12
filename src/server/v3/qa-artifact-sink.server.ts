import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { assertSafeSegment, stableStringify } from './qa-artifacts.server';

export type QAArtifactSinkMode = 'file' | 'storage' | 'console_jsonl';
export interface QAArtifactWriteInput { run_id: string; relative_path: string; payload: unknown; root_dir?: string; fixture_id?: string; artefact_id?: string; }
export interface QAArtifactWriteResult { written: boolean; sink_mode: QAArtifactSinkMode; sink_write_status: 'written'|'failed'|'skipped'; warning?: string; storage_bucket?: string; storage_path?: string; path?: string; log_fallback_emitted: boolean; }

const LOG_PREFIX = 'TAPECOACH_QA_ARTIFACT_JSON:';

function resolveMode(env = process.env): QAArtifactSinkMode {
  const mode = env.QA_ARTIFACT_SINK as QAArtifactSinkMode | undefined;
  if (mode === 'storage' || mode === 'console_jsonl' || mode === 'file') return mode;
  return 'file';
}

function emitLog(input: { sink_mode: QAArtifactSinkMode; sink_write_status: 'written'|'failed'|'skipped'; run_id: string; fixture_id?: string; artefact_id?: string; relative_path: string; storage_bucket?: string; storage_path?: string; blocker_codes?: string[]; payload: unknown; warning?: string; }) {
  const line = { schema_version: 'tapecoach_v3_internal_qa_sink_log_v1', sink_mode: input.sink_mode, sink_write_status: input.sink_write_status, run_id: input.run_id, fixture_id: input.fixture_id ?? null, artefact_id: input.artefact_id ?? null, relative_path: input.relative_path, storage_bucket: input.storage_bucket ?? null, storage_path: input.storage_path ?? null, emitted_at: new Date().toISOString(), commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? null, branch_name: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.BRANCH_NAME ?? null, blocker_codes: input.blocker_codes ?? [], payload_summary: { warning: input.warning ?? null, payload_bytes: Buffer.byteLength(stableStringify(input.payload), 'utf8') }, internal_only: true };
  console.info(`${LOG_PREFIX}${JSON.stringify(line)}`);
}

export async function writeQAArtifact(input: QAArtifactWriteInput): Promise<QAArtifactWriteResult> {
  assertSafeSegment(input.run_id, 'run_id');
  const mode = resolveMode();
  const allowLogFallback = process.env.QA_ARTIFACT_LOG_FALLBACK === 'true';
  const payloadText = stableStringify(input.payload) + '\n';
  const root = input.root_dir ?? 'qa-artifacts';
  const storage_bucket = process.env.QA_ARTIFACT_STORAGE_BUCKET ?? 'qa-artifacts';
  const storage_path = `v3/${input.run_id}/${input.relative_path}`;

  const tryFallbackLog = (warning: string): boolean => {
    if (!allowLogFallback) return false;
    try {
      emitLog({ sink_mode: mode, sink_write_status: 'failed', run_id: input.run_id, fixture_id: input.fixture_id, artefact_id: input.artefact_id, relative_path: input.relative_path, storage_bucket: mode === 'storage' ? storage_bucket : undefined, storage_path: mode === 'storage' ? storage_path : undefined, payload: input.payload, warning, blocker_codes: ['qa_artifact_sink_write_failed'] });
      return true;
    } catch {
      return false;
    }
  };

  try {
    if (mode === 'file') {
      const abs = path.join(root, input.run_id, input.relative_path);
      const prefix = path.resolve(path.join(root, input.run_id)) + path.sep;
      if (!path.resolve(abs).startsWith(prefix)) throw new Error('artefact_path_invalid');
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, payloadText, 'utf8');
      if (allowLogFallback) emitLog({ sink_mode: mode, sink_write_status: 'written', run_id: input.run_id, fixture_id: input.fixture_id, artefact_id: input.artefact_id, relative_path: input.relative_path, payload: input.payload });
      return { written: true, sink_mode: mode, sink_write_status: 'written', path: abs, log_fallback_emitted: allowLogFallback };
    }
    if (mode === 'storage') {
      const { error } = await supabaseAdmin.storage.from(storage_bucket).upload(storage_path, payloadText, { upsert: true, contentType: 'application/json' });
      if (error) throw new Error(`storage_upload_failed:${error.message}`);
      if (allowLogFallback) emitLog({ sink_mode: mode, sink_write_status: 'written', run_id: input.run_id, fixture_id: input.fixture_id, artefact_id: input.artefact_id, relative_path: input.relative_path, storage_bucket, storage_path, payload: input.payload });
      return { written: true, sink_mode: mode, sink_write_status: 'written', storage_bucket, storage_path, log_fallback_emitted: allowLogFallback };
    }
    emitLog({ sink_mode: mode, sink_write_status: 'written', run_id: input.run_id, fixture_id: input.fixture_id, artefact_id: input.artefact_id, relative_path: input.relative_path, payload: input.payload });
    return { written: true, sink_mode: mode, sink_write_status: 'written', log_fallback_emitted: true };
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'unknown_sink_error';
    const logFallbackEmitted = tryFallbackLog(warning);
    return { written: false, sink_mode: mode, sink_write_status: 'failed', warning: logFallbackEmitted ? warning : `${warning};fallback_log_failed`, storage_bucket: mode === 'storage' ? storage_bucket : undefined, storage_path: mode === 'storage' ? storage_path : undefined, log_fallback_emitted: logFallbackEmitted };
  }
}
