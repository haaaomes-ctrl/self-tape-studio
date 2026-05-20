import { mergeSafeUploadIdentity } from "@/lib/mux-upload";

type UploadIdentityExtraction = {
  original_upload_file_hash: string | null;
  original_upload_file_hash_source_stage: string | null;
  original_file_name: string | null;
  metadata_file_name: string | null;
  file_size_bytes: number | null;
  mime_type_safe_summary: string | null;
  last_modified_ms: number | null;
  video_duration_ms: number | null;
  upload_metadata_source: string | null;
  upload_identity_metadata: Record<string, unknown> | null;
  upload_identity_capture_status: string | null;
  upload_identity_capture_reason: string | null;
  upload_identity_merge_status: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed) || /[\\/]/.test(trimmed)) return null;
  return trimmed.slice(0, 160);
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function safeMime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed)) return null;
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(trimmed) ? trimmed.slice(0, 96) : null;
}

function normaliseUploadHash(value: unknown): string | null {
  const raw = isRecord(value) ? value.value : value;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed) || /[\\/]/.test(trimmed)) return null;
  const match = trimmed.match(/^(?:sha256:)?([a-f0-9]{64})$/);
  return match ? `sha256:${match[1]}` : null;
}

function hasAnyUploadIdentityValue(value: Record<string, unknown>): boolean {
  return [
    'original_upload_file_hash',
    'original_file_name_safe_basename',
    'metadata_file_name_safe_basename',
    'file_size_bytes',
    'mime_type_safe_summary',
    'last_modified_ms',
    'video_duration_ms',
    'upload_metadata_source',
    'hash_capture_status',
  ].some((key) => value[key] != null)
    || (Array.isArray(value.blocker_codes) && value.blocker_codes.length > 0);
}

export function extractUploadIdentitySignals(input: {
  signals?: unknown;
  checklist?: unknown;
  muxDurationSeconds?: unknown;
}): UploadIdentityExtraction {
  const signals = isRecord(input.signals) ? input.signals : {};
  const checklist = isRecord(input.checklist) ? input.checklist : {};
  const safeUploadIdentity = isRecord(signals.safe_upload_identity) ? signals.safe_upload_identity : null;
  const explicitUploadIdentity = isRecord(signals.upload_identity) ? signals.upload_identity : null;
  const topLevelUploadIdentity = hasAnyUploadIdentityValue(signals) ? signals : null;
  const nestedUploadIdentity = mergeSafeUploadIdentity(safeUploadIdentity, explicitUploadIdentity);
  const uploadIdentity = (nestedUploadIdentity ?? mergeSafeUploadIdentity(null, topLevelUploadIdentity) ?? {}) as Record<string, unknown>;
  const originalHashRecord = isRecord(uploadIdentity.original_upload_file_hash)
    ? uploadIdentity.original_upload_file_hash
    : null;
  const checklistDuration = isRecord(checklist.duration) ? checklist.duration.seconds : null;
  const muxDurationMs = safeNumber(input.muxDurationSeconds);
  const identityDurationMs = safeNumber(uploadIdentity.video_duration_ms);
  const signalDurationSeconds = safeNumber(signals.duration);
  const checklistDurationSeconds = safeNumber(checklistDuration);
  return {
    original_upload_file_hash: normaliseUploadHash(uploadIdentity.original_upload_file_hash),
    original_upload_file_hash_source_stage: safeString(originalHashRecord?.source_stage) ?? null,
    original_file_name: safeString(uploadIdentity.original_file_name_safe_basename),
    metadata_file_name: safeString(uploadIdentity.metadata_file_name_safe_basename),
    file_size_bytes: safeNumber(uploadIdentity.file_size_bytes),
    mime_type_safe_summary: safeMime(uploadIdentity.mime_type_safe_summary),
    last_modified_ms: safeNumber(uploadIdentity.last_modified_ms),
    video_duration_ms: identityDurationMs
      ?? (muxDurationMs && muxDurationMs > 0 ? Math.round(muxDurationMs * 1000) : null)
      ?? (signalDurationSeconds && signalDurationSeconds > 0 ? Math.round(signalDurationSeconds * 1000) : null)
      ?? (checklistDurationSeconds && checklistDurationSeconds > 0 ? Math.round(checklistDurationSeconds * 1000) : null),
    upload_metadata_source: safeString(uploadIdentity.upload_metadata_source),
    upload_identity_metadata: isRecord(uploadIdentity) && hasAnyUploadIdentityValue(uploadIdentity) ? uploadIdentity : null,
    upload_identity_capture_status: safeString(uploadIdentity.hash_capture_status),
    upload_identity_capture_reason: Array.isArray(uploadIdentity.blocker_codes)
      ? uploadIdentity.blocker_codes.filter((code: unknown) => typeof code === 'string').join(',')
      : null,
    upload_identity_merge_status: safeUploadIdentity || explicitUploadIdentity || topLevelUploadIdentity ? 'merged_safe_upload_identity' : null,
  };
}
