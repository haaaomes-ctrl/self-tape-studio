// Direct upload helper: PUTs a File to a Mux direct-upload URL.
// Mux uses a signed Google Cloud Storage URL that accepts a single PUT for
// files up to a few GB. We stream progress via XHR so the UI can show %.
export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

export interface OriginalUploadFileHash {
  algorithm: "sha256";
  value: string;
  source_stage: "client_pre_upload";
  source_module: "src/lib/mux-upload.ts";
  captured_at: string;
  confidence_role: "decisive";
  raw_value_redacted: false;
}

export interface UploadIdentityMetadata {
  schema_version: "tapecoach_upload_identity_v1";
  internal_only: true;
  privacy_classification: "internal_private";
  original_upload_file_hash: OriginalUploadFileHash | null;
  original_file_name_safe_basename: string | null;
  metadata_file_name_safe_basename: string | null;
  file_size_bytes: number | null;
  mime_type_safe_summary: string | null;
  last_modified_ms: number | null;
  video_duration_ms: number | null;
  upload_metadata_source: "browser_file";
  hash_capture_status: "captured" | "unavailable" | "failed";
  blocker_codes: string[];
  public_output_unchanged: true;
}

function looksLikeUnsafePrivateValue(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("://")
    || lower.includes("signed")
    || lower.includes("token")
    || lower.includes("secret")
    || lower.includes("authorization")
    || lower.includes("bearer")
    || lower.includes("x-amz")
    || lower.includes("sig=")
    || lower.includes("access_key")
    || lower.includes("apikey")
    || lower.includes("api_key");
}

export function safeUploadBasename(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const queryIndex = trimmed.search(/[?#]/);
  const withoutQuery = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
  const basename = withoutQuery.replace(/\\/g, "/").split("/").filter(Boolean).pop()?.trim() ?? "";
  if (!basename || looksLikeUnsafePrivateValue(trimmed) || looksLikeUnsafePrivateValue(basename)) return null;
  return basename.slice(0, 160);
}

function safeMimeTypeSummary(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed)) return null;
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(trimmed) ? trimmed.slice(0, 96) : null;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeOriginalUploadFileSha256(file: File): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
  return bytesToHex(digest);
}

export async function buildUploadIdentityMetadata(
  file: File,
  durationSeconds?: number | null,
): Promise<UploadIdentityMetadata> {
  let hashValue: string | null = null;
  let hashStatus: UploadIdentityMetadata["hash_capture_status"] = "unavailable";
  const blockerCodes: string[] = [];
  try {
    hashValue = await computeOriginalUploadFileSha256(file);
    hashStatus = hashValue ? "captured" : "unavailable";
  } catch {
    hashStatus = "failed";
  }
  if (!hashValue) blockerCodes.push(hashStatus === "failed" ? "original_upload_file_hash_failed" : "original_upload_file_hash_unavailable");
  const safeName = safeUploadBasename(file.name);
  if (!safeName) blockerCodes.push("original_file_name_unavailable_or_redacted");
  const safeMime = safeMimeTypeSummary(file.type);
  if (!safeMime) blockerCodes.push("mime_type_unavailable_or_redacted");
  const size = Number.isFinite(file.size) && file.size >= 0 ? file.size : null;
  if (size === null) blockerCodes.push("file_size_unavailable");
  const lastModified = Number.isFinite(file.lastModified) && file.lastModified > 0 ? Math.round(file.lastModified) : null;
  const durationMs = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? Math.round(durationSeconds * 1000)
    : null;
  return {
    schema_version: "tapecoach_upload_identity_v1",
    internal_only: true,
    privacy_classification: "internal_private",
    original_upload_file_hash: hashValue
      ? {
          algorithm: "sha256",
          value: hashValue,
          source_stage: "client_pre_upload",
          source_module: "src/lib/mux-upload.ts",
          captured_at: new Date().toISOString(),
          confidence_role: "decisive",
          raw_value_redacted: false,
        }
      : null,
    original_file_name_safe_basename: safeName,
    metadata_file_name_safe_basename: safeName,
    file_size_bytes: size,
    mime_type_safe_summary: safeMime,
    last_modified_ms: lastModified,
    video_duration_ms: durationMs,
    upload_metadata_source: "browser_file",
    hash_capture_status: hashStatus,
    blocker_codes: blockerCodes,
    public_output_unchanged: true,
  };
}

export function uploadFileToMux(
  url: string,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new UploadCancelledError());
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.send(file);
  });
}

// Pre-upload validation. Hard-rejects oversized or overly long files so the
// user doesn't waste bandwidth on a take that will fail downstream.
export interface PreflightOptions {
  maxBytes?: number;
  maxSeconds?: number;
}

export interface PreflightResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

export function preflightVideoBasics(
  file: File,
  durationSeconds: number,
  audioPeak: number,
  opts: PreflightOptions = {},
): PreflightResult {
  const maxBytes = opts.maxBytes ?? 500 * 1024 * 1024; // 500 MB
  const maxSeconds = opts.maxSeconds ?? 10 * 60; // 10 min

  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File is ${(file.size / 1024 / 1024).toFixed(0)}MB — limit is ${(
        maxBytes /
        1024 /
        1024
      ).toFixed(0)}MB. Re-export at a lower bitrate.`,
    };
  }
  if (durationSeconds > maxSeconds) {
    return {
      ok: false,
      error: `Video is ${Math.round(
        durationSeconds,
      )}s — limit is ${maxSeconds}s. Trim to a shorter take.`,
    };
  }
  if (audioPeak === 0) {
    return {
      ok: true,
      warning:
        "We couldn't detect any audio in this file — the analysis will continue but audio scoring may be unreliable.",
    };
  }
  return { ok: true };
}
