// Direct upload helper: PUTs a File to a Mux direct-upload URL.
// Mux uses a signed Google Cloud Storage URL that accepts a single PUT for
// files up to a few GB. We stream progress via XHR so the UI can show %.
import {
  buildVideoDurationDecision,
  VIDEO_DURATION_HARD_CAP_COPY,
} from "@/lib/video-duration-policy";

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

export type UploadIdentityUnavailableReason =
  | "upload_hash_computation_failed"
  | "upload_hash_unavailable_browser_crypto_missing"
  | "upload_hash_unavailable_no_file_object";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function dedupe(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function looksLikeUnsafePrivateValue(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("://") ||
    lower.includes("signed") ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("authorization") ||
    lower.includes("bearer") ||
    lower.includes("x-amz") ||
    lower.includes("sig=") ||
    lower.includes("access_key") ||
    lower.includes("apikey") ||
    lower.includes("api_key")
  );
}

export function safeUploadBasename(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const queryIndex = trimmed.search(/[?#]/);
  const withoutQuery = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
  const basename = withoutQuery.replace(/\\/g, "/").split("/").filter(Boolean).pop()?.trim() ?? "";
  if (!basename || looksLikeUnsafePrivateValue(trimmed) || looksLikeUnsafePrivateValue(basename))
    return null;
  return basename.slice(0, 160);
}

function safeMimeTypeSummary(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed)) return null;
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(trimmed) ? trimmed.slice(0, 96) : null;
}

function safeUploadMetadataSource(value: unknown): "browser_file" {
  return value === "browser_file" ? "browser_file" : "browser_file";
}

function safePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  }
  return null;
}

function normaliseUploadHashRecord(value: unknown): OriginalUploadFileHash | null {
  const rawValue = isRecord(value) ? value.value : value;
  if (typeof rawValue !== "string") return null;
  const match = rawValue
    .trim()
    .toLowerCase()
    .match(/^(?:sha256:)?([a-f0-9]{64})$/);
  if (!match) return null;
  return {
    algorithm: "sha256",
    value: match[1],
    source_stage: "client_pre_upload",
    source_module: "src/lib/mux-upload.ts",
    captured_at:
      typeof (isRecord(value) ? value.captured_at : null) === "string"
        ? String((value as Record<string, unknown>).captured_at)
        : new Date().toISOString(),
    confidence_role: "decisive",
    raw_value_redacted: false,
  };
}

function hasUploadIdentityLikeKeys(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return [
    "original_upload_file_hash",
    "original_file_name_safe_basename",
    "metadata_file_name_safe_basename",
    "file_size_bytes",
    "mime_type_safe_summary",
    "last_modified_ms",
    "video_duration_ms",
    "upload_metadata_source",
    "hash_capture_status",
    "blocker_codes",
  ].some((key) => key in value);
}

function uploadIdentityBlockerCodes(value: Record<string, unknown> | null): string[] {
  return Array.isArray(value?.blocker_codes)
    ? value.blocker_codes.filter((code): code is string => typeof code === "string")
    : [];
}

function hasExplicitUploadIdentityField(value: Record<string, unknown> | null): boolean {
  if (!value) return false;
  return [
    "original_upload_file_hash",
    "original_file_name_safe_basename",
    "metadata_file_name_safe_basename",
    "file_size_bytes",
    "mime_type_safe_summary",
    "last_modified_ms",
    "video_duration_ms",
    "upload_metadata_source",
    "hash_capture_status",
  ].some((key) => key in value);
}

function hasHashUnavailableSignal(value: Record<string, unknown> | null): boolean {
  if (!value) return false;
  return (
    value.hash_capture_status === "failed" ||
    value.hash_capture_status === "unavailable" ||
    uploadIdentityBlockerCodes(value).some(
      (code) =>
        code === "upload_hash_computation_failed" ||
        code === "upload_hash_unavailable_browser_crypto_missing" ||
        code === "upload_hash_unavailable_no_file_object" ||
        code === "original_upload_file_hash_unavailable",
    )
  );
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
  let hashBlockerCode: UploadIdentityUnavailableReason | null = null;
  const blockerCodes: string[] = [];
  if (!globalThis.crypto?.subtle) {
    hashStatus = "unavailable";
    hashBlockerCode = "upload_hash_unavailable_browser_crypto_missing";
  } else {
    try {
      hashValue = await computeOriginalUploadFileSha256(file);
      hashStatus = hashValue ? "captured" : "unavailable";
      if (!hashValue) hashBlockerCode = "upload_hash_unavailable_browser_crypto_missing";
    } catch {
      hashStatus = "failed";
      hashBlockerCode = "upload_hash_computation_failed";
    }
  }
  if (!hashValue) {
    blockerCodes.push(
      hashBlockerCode ??
        (hashStatus === "failed"
          ? "upload_hash_computation_failed"
          : "original_upload_file_hash_unavailable"),
    );
  }
  const safeName = safeUploadBasename(file.name);
  if (!safeName) blockerCodes.push("original_file_name_unavailable_or_redacted");
  const safeMime = safeMimeTypeSummary(file.type);
  if (!safeMime) blockerCodes.push("mime_type_unavailable_or_redacted");
  const size = Number.isFinite(file.size) && file.size >= 0 ? file.size : null;
  if (size === null) blockerCodes.push("file_size_unavailable");
  const lastModified =
    Number.isFinite(file.lastModified) && file.lastModified > 0
      ? Math.round(file.lastModified)
      : null;
  const durationMs =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
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

export function buildUnavailableUploadIdentityMetadata(
  reason: UploadIdentityUnavailableReason,
  durationSeconds?: number | null,
): UploadIdentityMetadata {
  const durationMs =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.round(durationSeconds * 1000)
      : null;
  return {
    schema_version: "tapecoach_upload_identity_v1",
    internal_only: true,
    privacy_classification: "internal_private",
    original_upload_file_hash: null,
    original_file_name_safe_basename: null,
    metadata_file_name_safe_basename: null,
    file_size_bytes: null,
    mime_type_safe_summary: null,
    last_modified_ms: null,
    video_duration_ms: durationMs,
    upload_metadata_source: "browser_file",
    hash_capture_status: reason === "upload_hash_computation_failed" ? "failed" : "unavailable",
    blocker_codes: [reason],
    public_output_unchanged: true,
  };
}

export function mergeSafeUploadIdentity(
  existing: unknown,
  incoming: unknown,
): UploadIdentityMetadata | null {
  const existingRecord = hasUploadIdentityLikeKeys(existing) ? existing : null;
  const incomingRecord = hasUploadIdentityLikeKeys(incoming) ? incoming : null;
  if (!existingRecord && !incomingRecord) return null;

  const existingHash = normaliseUploadHashRecord(existingRecord?.original_upload_file_hash);
  const incomingHash = normaliseUploadHashRecord(incomingRecord?.original_upload_file_hash);
  const invalidIncomingHash =
    incomingRecord &&
    "original_upload_file_hash" in incomingRecord &&
    incomingRecord.original_upload_file_hash != null &&
    !incomingHash;
  const incomingExplicitUploadIdentity =
    hasExplicitUploadIdentityField(incomingRecord) || hasHashUnavailableSignal(incomingRecord);
  const incomingCannotProvideHash = incomingExplicitUploadIdentity && !incomingHash;
  const staleHashSuppressed = incomingCannotProvideHash && Boolean(existingHash);
  const hash = incomingHash ?? (incomingCannotProvideHash ? null : existingHash);

  const pickName = (
    key: "original_file_name_safe_basename" | "metadata_file_name_safe_basename",
  ) =>
    incomingExplicitUploadIdentity
      ? safeUploadBasename(incomingRecord?.[key])
      : safeUploadBasename(existingRecord?.[key]);
  const pickNumber = (key: "file_size_bytes" | "last_modified_ms" | "video_duration_ms") =>
    incomingExplicitUploadIdentity
      ? safePositiveNumber(incomingRecord?.[key])
      : safePositiveNumber(existingRecord?.[key]);
  const pickMime = () =>
    incomingExplicitUploadIdentity
      ? safeMimeTypeSummary(incomingRecord?.mime_type_safe_summary)
      : safeMimeTypeSummary(existingRecord?.mime_type_safe_summary);
  const blockerCodes = dedupe([
    ...(incomingExplicitUploadIdentity ? [] : uploadIdentityBlockerCodes(existingRecord)),
    ...uploadIdentityBlockerCodes(incomingRecord),
    invalidIncomingHash ? "invalid_original_upload_file_hash_rejected" : null,
    staleHashSuppressed ? "stale_original_upload_file_hash_not_reused" : null,
    hash ? null : "original_upload_file_hash_unavailable",
  ]);
  return {
    schema_version: "tapecoach_upload_identity_v1",
    internal_only: true,
    privacy_classification: "internal_private",
    original_upload_file_hash: hash,
    original_file_name_safe_basename: pickName("original_file_name_safe_basename"),
    metadata_file_name_safe_basename: pickName("metadata_file_name_safe_basename"),
    file_size_bytes: pickNumber("file_size_bytes"),
    mime_type_safe_summary: pickMime(),
    last_modified_ms: pickNumber("last_modified_ms"),
    video_duration_ms: pickNumber("video_duration_ms"),
    upload_metadata_source: safeUploadMetadataSource(
      incomingExplicitUploadIdentity
        ? incomingRecord?.upload_metadata_source
        : existingRecord?.upload_metadata_source,
    ),
    hash_capture_status: hash
      ? "captured"
      : incomingRecord?.hash_capture_status === "failed" ||
          (!incomingExplicitUploadIdentity && existingRecord?.hash_capture_status === "failed")
        ? "failed"
        : "unavailable",
    blocker_codes: blockerCodes,
    public_output_unchanged: true,
  };
}

export function replaceReuploadUploadIdentitySignals(
  incoming: unknown,
): Record<string, unknown> | null {
  const incomingRecord = isRecord(incoming) ? incoming : {};
  const replacementSignals: Record<string, unknown> = { ...incomingRecord };
  const nestedUploadIdentity =
    "upload_identity" in incomingRecord
      ? mergeSafeUploadIdentity(null, incomingRecord.upload_identity)
      : null;
  const topLevelUploadIdentity = nestedUploadIdentity
    ? null
    : mergeSafeUploadIdentity(null, incomingRecord);
  const replacementUploadIdentity = nestedUploadIdentity ?? topLevelUploadIdentity;
  if (replacementUploadIdentity) {
    replacementSignals.upload_identity = replacementUploadIdentity;
  } else {
    delete replacementSignals.upload_identity;
  }
  return Object.keys(replacementSignals).length > 0 ? replacementSignals : null;
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
  durationStatus?: "within_target" | "over_soft_guidance" | "over_hard_cap";
}

// S11-AUDIO-01: brief-independent, reliable usability preflight only (file size
// + video length). The browser audio-peak warning was removed with the rest of
// the browser perceptual probe — audio assessability is the model's job (it
// hears the file_url audio directly), so no pre-upload audio verdict is given.
export function preflightVideoBasics(
  file: File,
  durationSeconds: number,
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
  const durationDecision = buildVideoDurationDecision(durationSeconds);
  if (durationSeconds > maxSeconds || durationDecision.status === "over_hard_cap") {
    return {
      ok: false,
      error: VIDEO_DURATION_HARD_CAP_COPY,
      durationStatus: "over_hard_cap",
    };
  }
  if (durationDecision.status === "over_soft_guidance") {
    return {
      ok: true,
      warning: durationDecision.message ?? undefined,
      durationStatus: "over_soft_guidance",
    };
  }
  return { ok: true, durationStatus: durationDecision.status };
}
