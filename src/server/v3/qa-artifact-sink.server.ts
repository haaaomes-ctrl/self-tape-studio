import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_QA_ARTIFACT_STORAGE_BUCKET,
  resolveQAArtifactStorageBucket,
} from "@/lib/qa-artifact-storage-bucket";
import { assertSafeSegment, stableStringify } from "./qa-artifacts.server";

export type QAArtifactSinkMode = "file" | "storage" | "console_jsonl";
export interface QAArtifactWriteInput {
  run_id: string;
  relative_path: string;
  payload: unknown;
  root_dir?: string;
  fixture_id?: string;
  artefact_id?: string;
}
export interface QAArtifactWriteResult {
  written: boolean;
  sink_mode: QAArtifactSinkMode;
  sink_write_status: "written" | "failed" | "skipped";
  warning?: string;
  storage_bucket?: string;
  storage_path?: string;
  path?: string;
  log_fallback_emitted: boolean;
}

const LOG_PREFIX = "TAPECOACH_QA_ARTIFACT_JSON:";

function toCanonicalStoragePath(runId: string, relativePath: string): string {
  const normalized = path.posix.normalize(relativePath);
  const m = normalized.match(/^takes\/take-([^/]+)\/analysis-([^/]+)\/(.+)$/);
  if (m) return `take-${m[1]}/analysis-${m[2]}/${m[3]}`;
  const takeRun = runId.match(/^take-([^/]+)$/);
  if (takeRun && (normalized === "manifest.json" || normalized === "qa/acceptance_metrics.json")) {
    return `take-${takeRun[1]}/analysis-${runId}/${normalized}`;
  }
  return `${runId}/${normalized}`;
}

function validateRelativePath(relativePath: string): string {
  if (!/^[A-Za-z0-9._/-]+$/.test(relativePath)) throw new Error("artefact_path_invalid");
  const normalized = path.posix.normalize(relativePath);
  if (normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(relativePath))
    throw new Error("artefact_path_invalid");
  return normalized;
}

function resolveMode(env = process.env): QAArtifactSinkMode {
  const mode = env.QA_ARTIFACT_SINK as QAArtifactSinkMode | "log" | undefined;
  if (mode === "storage" || mode === "console_jsonl" || mode === "file") return mode;
  if (env.NODE_ENV === "test" || env.VITEST) return "file";
  return "storage";
}

function emitLog(input: {
  sink_mode: QAArtifactSinkMode;
  sink_write_status: "written" | "failed" | "skipped";
  run_id: string;
  fixture_id?: string;
  artefact_id?: string;
  relative_path: string;
  storage_bucket?: string;
  storage_path?: string;
  blocker_codes?: string[];
  payload: unknown;
  warning?: string;
}) {
  const line = {
    schema_version: "tapecoach_v3_internal_qa_sink_log_v1",
    sink_mode: input.sink_mode,
    sink_write_status: input.sink_write_status,
    run_id: input.run_id,
    fixture_id: input.fixture_id ?? null,
    artefact_id: input.artefact_id ?? null,
    relative_path: input.relative_path,
    storage_bucket: input.storage_bucket ?? null,
    storage_path: input.storage_path ?? null,
    emitted_at: new Date().toISOString(),
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? null,
    branch_name: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.BRANCH_NAME ?? null,
    blocker_codes: input.blocker_codes ?? [],
    payload_summary: {
      warning: input.warning ?? null,
      payload_bytes: Buffer.byteLength(stableStringify(input.payload), "utf8"),
    },
    internal_only: true,
  };
  console.info(`${LOG_PREFIX}${JSON.stringify(line)}`);
}

function mergeWarnings(...warnings: Array<string | null | undefined>): string | undefined {
  const present = warnings.filter((warning): warning is string =>
    Boolean(warning && warning.trim()),
  );
  return present.length > 0 ? present.join(";") : undefined;
}

export interface QAArtifactReadResult {
  status: "ok" | "missing" | "unreadable" | "unsupported";
  text?: string;
  warning?:
    | "comparison_reconciliation_manifest_missing"
    | "comparison_reconciliation_manifest_unreadable"
    | "comparison_reconciliation_manifest_read_unsupported";
  sink_mode: QAArtifactSinkMode;
  storage_path?: string;
  path?: string;
}

// Missing vs unreadable sink classification matters for reconciliation diagnostics.
function looksLikeObjectNotFound(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("404") ||
    m.includes("not found") ||
    m.includes("object not found") ||
    m.includes("no such key") ||
    m.includes("enoent") ||
    m.includes("no such file")
  );
}

export async function readQAArtifactText(input: {
  run_id: string;
  relative_path: string;
  root_dir?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<QAArtifactReadResult> {
  const env = input.env ?? process.env;
  const mode = resolveMode(env);
  const root = input.root_dir ?? "qa-artifacts";
  let rel = input.relative_path;
  try {
    assertSafeSegment(input.run_id, "run_id");
    rel = validateRelativePath(input.relative_path);
  } catch {
    return {
      status: "unreadable",
      warning: "comparison_reconciliation_manifest_unreadable",
      sink_mode: mode,
    };
  }
  const storage_bucket = resolveQAArtifactStorageBucket(env).bucket;
  const storage_path = toCanonicalStoragePath(input.run_id, rel);
  if (mode === "console_jsonl") {
    return {
      status: "unsupported",
      warning: "comparison_reconciliation_manifest_read_unsupported",
      sink_mode: mode,
      storage_path,
    };
  }
  if (mode === "file") {
    const abs = path.join(root, input.run_id, rel);
    const prefix = path.resolve(path.join(root, input.run_id)) + path.sep;
    if (!path.resolve(abs).startsWith(prefix))
      return {
        status: "unreadable",
        warning: "comparison_reconciliation_manifest_unreadable",
        sink_mode: mode,
      };
    try {
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(abs, "utf8");
      return { status: "ok", text, sink_mode: mode, path: abs };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown";
      if (looksLikeObjectNotFound(msg))
        return {
          status: "missing",
          warning: "comparison_reconciliation_manifest_missing",
          sink_mode: mode,
          path: abs,
        };
      return {
        status: "unreadable",
        warning: "comparison_reconciliation_manifest_unreadable",
        sink_mode: mode,
        path: abs,
      };
    }
  }
  try {
    const storageClient = supabaseAdmin.storage.from(storage_bucket);
    const { data, error } = await storageClient.download(storage_path);
    if (error) {
      if (looksLikeObjectNotFound(error.message ?? ""))
        return {
          status: "missing",
          warning: "comparison_reconciliation_manifest_missing",
          sink_mode: mode,
          storage_path,
        };
      return {
        status: "unreadable",
        warning: "comparison_reconciliation_manifest_unreadable",
        sink_mode: mode,
        storage_path,
      };
    }
    if (!data)
      return {
        status: "unreadable",
        warning: "comparison_reconciliation_manifest_unreadable",
        sink_mode: mode,
        storage_path,
      };
    const text = await data.text();
    return { status: "ok", text, sink_mode: mode, storage_path };
  } catch {
    return {
      status: "unreadable",
      warning: "comparison_reconciliation_manifest_unreadable",
      sink_mode: mode,
      storage_path,
    };
  }
}

export async function writeQAArtifact(input: QAArtifactWriteInput): Promise<QAArtifactWriteResult> {
  assertSafeSegment(input.run_id, "run_id");
  const mode = resolveMode();
  const allowLogFallback = process.env.QA_ARTIFACT_LOG_FALLBACK === "true";
  const payloadText = stableStringify(input.payload) + "\n";
  const root = input.root_dir ?? "qa-artifacts";
  const storageBucketResolution =
    mode === "storage"
      ? resolveQAArtifactStorageBucket(process.env)
      : { bucket: DEFAULT_QA_ARTIFACT_STORAGE_BUCKET, warning: null as string | null };
  const storage_bucket = storageBucketResolution.bucket;
  const storageBucketWarning = storageBucketResolution.warning;

  let validatedRelativePath = input.relative_path;
  let storage_path = toCanonicalStoragePath(input.run_id, input.relative_path);

  const trySuccessLog = (
    args: Parameters<typeof emitLog>[0],
  ): { emitted: boolean; warning?: string } => {
    if (!allowLogFallback) return { emitted: false };
    try {
      emitLog(args);
      return { emitted: true };
    } catch (error) {
      return {
        emitted: false,
        warning: `qa_artifact_success_log_failed:${error instanceof Error ? error.message : "unknown"}`,
      };
    }
  };

  const tryFallbackLog = (warning: string): { attempted: boolean; emitted: boolean } => {
    if (!allowLogFallback) return { attempted: false, emitted: false };
    try {
      emitLog({
        sink_mode: mode,
        sink_write_status: "failed",
        run_id: input.run_id,
        fixture_id: input.fixture_id,
        artefact_id: input.artefact_id,
        relative_path: validatedRelativePath,
        storage_bucket: mode === "storage" ? storage_bucket : undefined,
        storage_path: mode === "storage" ? storage_path : undefined,
        payload: input.payload,
        warning,
        blocker_codes: ["qa_artifact_sink_write_failed"],
      });
      return { attempted: true, emitted: true };
    } catch {
      return { attempted: true, emitted: false };
    }
  };

  try {
    validatedRelativePath = validateRelativePath(input.relative_path);
    storage_path = toCanonicalStoragePath(input.run_id, validatedRelativePath);
    if (mode === "file") {
      const abs = path.join(root, input.run_id, validatedRelativePath);
      const prefix = path.resolve(path.join(root, input.run_id)) + path.sep;
      if (!path.resolve(abs).startsWith(prefix)) throw new Error("artefact_path_invalid");
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, payloadText, "utf8");
      const successLog = trySuccessLog({
        sink_mode: mode,
        sink_write_status: "written",
        run_id: input.run_id,
        fixture_id: input.fixture_id,
        artefact_id: input.artefact_id,
        relative_path: validatedRelativePath,
        payload: input.payload,
      });
      return {
        written: true,
        sink_mode: mode,
        sink_write_status: "written",
        path: abs,
        log_fallback_emitted: successLog.emitted,
        warning: successLog.warning,
      };
    }
    if (mode === "storage") {
      const STORAGE_UPLOAD_TIMEOUT_MS = Number(process.env.QA_ARTIFACT_STORAGE_TIMEOUT_MS ?? 5000);
      const uploadPromise = supabaseAdmin.storage
        .from(storage_bucket)
        .upload(storage_path, payloadText, { upsert: true, contentType: "application/json" });
      const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ error: { message: "storage_upload_timeout" } }),
          STORAGE_UPLOAD_TIMEOUT_MS,
        ),
      );
      const { error } = (await Promise.race([uploadPromise, timeoutPromise])) as {
        error: { message: string } | null;
      };
      if (error) throw new Error(`storage_upload_failed:${error.message}`);
      const successLog = trySuccessLog({
        sink_mode: mode,
        sink_write_status: "written",
        run_id: input.run_id,
        fixture_id: input.fixture_id,
        artefact_id: input.artefact_id,
        relative_path: validatedRelativePath,
        storage_bucket,
        storage_path,
        payload: input.payload,
        warning: storageBucketWarning ?? undefined,
      });
      return {
        written: true,
        sink_mode: mode,
        sink_write_status: "written",
        storage_bucket,
        storage_path,
        log_fallback_emitted: successLog.emitted,
        warning: mergeWarnings(storageBucketWarning, successLog.warning),
      };
    }
    emitLog({
      sink_mode: mode,
      sink_write_status: "written",
      run_id: input.run_id,
      fixture_id: input.fixture_id,
      artefact_id: input.artefact_id,
      relative_path: validatedRelativePath,
      payload: input.payload,
    });
    return {
      written: true,
      sink_mode: mode,
      sink_write_status: "written",
      log_fallback_emitted: true,
    };
  } catch (error) {
    const warning =
      mergeWarnings(
        storageBucketWarning,
        error instanceof Error ? error.message : "unknown_sink_error",
      ) ?? "unknown_sink_error";
    const fallback = tryFallbackLog(warning);
    const warningOut =
      fallback.attempted && !fallback.emitted ? `${warning};fallback_log_failed` : warning;
    return {
      written: false,
      sink_mode: mode,
      sink_write_status: "failed",
      warning: warningOut,
      storage_bucket: mode === "storage" ? storage_bucket : undefined,
      storage_path: mode === "storage" ? storage_path : undefined,
      log_fallback_emitted: fallback.emitted,
    };
  }
}
