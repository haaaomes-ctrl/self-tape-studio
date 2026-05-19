export function safeIsoTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim().length === 0) return null;

  const date = value instanceof Date
    ? value
    : (typeof value === 'string' || typeof value === 'number' ? new Date(value) : null);

  if (!date) return null;
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;

  try {
    return date.toISOString();
  } catch {
    return null;
  }
}

export function timestampNormalisationWarnings(fields: Record<string, unknown>): string[] {
  return Object.entries(fields).flatMap(([field, value]) => {
    if (value == null) return [];
    if (typeof value === 'string' && value.trim().length === 0) return [];
    return safeIsoTimestamp(value) ? [] : [`${field}_invalid_timestamp`];
  });
}
