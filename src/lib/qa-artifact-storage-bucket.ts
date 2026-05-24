export const DEFAULT_QA_ARTIFACT_STORAGE_BUCKET = 'qa-artifacts';

const BOOLEAN_LIKE_BUCKET_VALUES = new Set(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']);

export type QAArtifactStorageBucketResolution = {
  bucket: string;
  warning: string | null;
};

export function resolveQAArtifactStorageBucket(env: NodeJS.ProcessEnv = process.env): QAArtifactStorageBucketResolution {
  const configured = env.QA_ARTIFACT_STORAGE_BUCKET;
  if (configured === undefined) {
    return { bucket: DEFAULT_QA_ARTIFACT_STORAGE_BUCKET, warning: null };
  }

  const trimmed = configured.trim();
  if (!trimmed) {
    return {
      bucket: DEFAULT_QA_ARTIFACT_STORAGE_BUCKET,
      warning: 'qa_artifact_storage_bucket_defaulted:blank',
    };
  }

  const lower = trimmed.toLowerCase();
  if (BOOLEAN_LIKE_BUCKET_VALUES.has(lower)) {
    return {
      bucket: DEFAULT_QA_ARTIFACT_STORAGE_BUCKET,
      warning: `qa_artifact_storage_bucket_defaulted:boolean_like_value:${lower}`,
    };
  }

  return { bucket: trimmed, warning: null };
}
