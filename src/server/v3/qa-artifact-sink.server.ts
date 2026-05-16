import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { assertSafeSegment, stableStringify } from './qa-artifacts.server';

export type QAArtifactSinkMode = 'file' | 'storage' | 'console_jsonl';
export interface QAArtifactWriteInput { run_id: string; relative_path: string; payload: unknown; root_dir?: string; fixture_id?: string; artefact_id?: string; }
export interface QAArtifactWriteResult { written: boolean; sink_mode: QAArtifactSinkMode; sink_write_status: 'written'|'failed'|'skipped'; warning?: string; storage_bucket?: string; storage_path?: string; path?: string; log_fallback_emitted: boolean; }

const LOG_PREFIX = 'TAPECOACH_QA_ARTIFACT_JSON:';


export function toCanonicalStoragePath(runId: string, relativePath: string): string {
  const normalized = path.posix.normalize(relativePath);
  const m = normalized.match(/^takes\/take-([^/]+)\/analysis-([^/]+)\/(.+)$/);
  if (m) return `take-${m[1]}/analysis-${m[2]}/${m[3]}`;
  const takeRun = runId.match(/^take-([^/]+)$/);
  if (takeRun && (normalized === 'manifest.json' || normalized === 'qa/acceptance_metrics.json')) {
    return `take-${takeRun[1]}/analysis-${runId}/${normalized}`;
  }
  return `${runId}/${normalized}`;
}


function validateRelativePath(relativePath: string): string {
  if (!/^[A-Za-z0-9._/-]+$/.test(relativePath)) throw new Error('artefact_path_invalid');
  const normalized = path.posix.normalize(relativePath);
  if (normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(relativePath)) throw new Error('artefact_path_invalid');
  return normalized;
}

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

  let validatedRelativePath = input.relative_path;
  let storage_path = toCanonicalStoragePath(input.run_id, input.relative_path);

  const trySuccessLog = (args: Parameters<typeof emitLog>[0]): { emitted: boolean; warning?: string } => {
    if (!allowLogFallback) return { emitted: false };
    try { emitLog(args); return { emitted: true }; } catch (error) {
      return { emitted: false, warning: `qa_artifact_success_log_failed:${error instanceof Error ? error.message : 'unknown'}` };
    }
  };

  const tryFallbackLog = (warning: string): { attempted: boolean; emitted: boolean } => {
    if (!allowLogFallback) return { attempted: false, emitted: false };
    try {
      emitLog({ sink_mode: mode, sink_write_status: 'failed', run_id: input.run_id, fixture_id: input.fixture_id, artefact_id: input.artefact_id, relative_path: validatedRelativePath, storage_bucket: mode === 'storage' ? storage_bucket : undefined, storage_path: mode === 'storage' ? storage_path : undefined, payload: input.payload, warning, blocker_codes: ['qa_artifact_sink_write_failed'] });
      return { attempted: true, emitted: true };
    } catch {
      return { attempted: true, emitted: false };
    }
  };

  try {
    validatedRelativePath = validateRelativePath(input.relative_path);
    storage_path = toCanonicalStoragePath(input.run_id, validatedRelativePath);
    if (mode === 'file') {
      const abs = path.join(root, input.run_id, validatedRelativePath);
      const prefix = path.resolve(path.join(root, input.run_id)) + path.sep;
      if (!path.resolve(abs).startsWith(prefix)) throw new Error('artefact_path_invalid');
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, payloadText, 'utf8');
      const successLog = trySuccessLog({ sink_mode: mode, sink_write_status: 'written', run_id: input.run_id, fixture_id: input.fixture_id, artefact_id: input.artefact_id, relative_path: validatedRelativePath, payload: input.payload });
      return { written: true, sink_mode: mode, sink_write_status: 'written', path: abs, log_fallback_emitted: successLog.emitted, warning: successLog.warning };
    }
    if (mode === 'storage') {
      const STORAGE_UPLOAD_TIMEOUT_MS = Number(process.env.QA_ARTIFACT_STORAGE_TIMEOUT_MS ?? 5000);
      const uploadPromise = supabaseAdmin.storage.from(storage_bucket).upload(storage_path, payloadText, { upsert: true, contentType: 'application/json' });
      const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) => setTimeout(() => resolve({ error: { message: 'storage_upload_timeout' } }), STORAGE_UPLOAD_TIMEOUT_MS));
      const { error } = await Promise.race([uploadPromise, timeoutPromise]) as { error: { message: string } | null };
      if (error) throw new Error(`storage_upload_failed:${error.message}`);
      const successLog = trySuccessLog({ sink_mode: mode, sink_write_status: 'written', run_id: input.run_id, fixture_id: input.fixture_id, artefact_id: input.artefact_id, relative_path: validatedRelativePath, storage_bucket, storage_path, payload: input.payload });
      return { written: true, sink_mode: mode, sink_write_status: 'written', storage_bucket, storage_path, log_fallback_emitted: successLog.emitted, warning: successLog.warning };
    }
    emitLog({ sink_mode: mode, sink_write_status: 'written', run_id: input.run_id, fixture_id: input.fixture_id, artefact_id: input.artefact_id, relative_path: validatedRelativePath, payload: input.payload });
    return { written: true, sink_mode: mode, sink_write_status: 'written', log_fallback_emitted: true };
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'unknown_sink_error';
    const fallback = tryFallbackLog(warning);
    const warningOut = fallback.attempted && !fallback.emitted ? `${warning};fallback_log_failed` : warning;
    return { written: false, sink_mode: mode, sink_write_status: 'failed', warning: warningOut, storage_bucket: mode === 'storage' ? storage_bucket : undefined, storage_path: mode === 'storage' ? storage_path : undefined, log_fallback_emitted: fallback.emitted };
  }
}

export async function readQAArtifactText(input: { run_id: string; relative_path: string; root_dir?: string }): Promise<{ ok: true; text: string; storage_path?: string } | { ok: false; code: 'missing' | 'unreadable'; storage_path?: string }> {
  const mode = resolveMode();
  const root = input.root_dir ?? 'qa-artifacts';
  let validatedRelativePath: string;
  try {
    validatedRelativePath = validateRelativePath(input.relative_path);
  } catch {
    return { ok: false, code: 'unreadable' };
  }
  let safeRunId: string;
  try {
    assertSafeSegment(input.run_id, 'run_id');
    safeRunId = input.run_id;
  } catch {
    return { ok: false, code: 'unreadable' };
  }
  if (mode === 'file') {
    try {
      const { readFile } = await import('node:fs/promises');
      const baseRoot = path.resolve(root);
      const runRoot = path.resolve(baseRoot, safeRunId);
      const abs = path.resolve(runRoot, validatedRelativePath);
      if (abs !== runRoot && !abs.startsWith(runRoot + path.sep)) return { ok: false, code: 'unreadable' };
      const text = await readFile(abs, 'utf8');
      return { ok: true, text };
    } catch (error) {
      const code = (error && typeof error === 'object' && 'code' in (error as any) && (error as any).code === 'ENOENT') ? 'missing' : 'unreadable';
      return { ok: false, code };
    }
  }
  if (mode === 'storage') {
    const storage_bucket = process.env.QA_ARTIFACT_STORAGE_BUCKET ?? 'qa-artifacts';
    const storage_path = toCanonicalStoragePath(safeRunId, validatedRelativePath);
    try {
      const { data, error } = await supabaseAdmin.storage.from(storage_bucket).download(storage_path);
      if (error || !data) return { ok: false, code: 'missing', storage_path };
      const text = typeof (data as any).text === 'function' ? await (data as any).text() : String(data);
      return { ok: true, text, storage_path };
    } catch {
      return { ok: false, code: 'unreadable', storage_path };
    }
  }
  return { ok: false, code: 'unreadable' };
}
