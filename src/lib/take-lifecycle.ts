export const S10_TAKE_SLOTS = [1, 2, 3] as const;

export type S10TakeSlot = (typeof S10_TAKE_SLOTS)[number];

export type S10TakeVersionStatus =
  | "active"
  | "replaced"
  | "processing_failed"
  | "analysis_failed"
  | "deleted_by_user"
  | "archived";

export type S10QaArtifactStatus =
  | "not_enabled"
  | "emitted"
  | "partially_emitted"
  | "failed"
  | "deferred"
  | "not_applicable";

export type S10ComparisonRunStatus =
  | "pending"
  | "processing"
  | "rendered"
  | "stale_after_replacement"
  | "suppressed_same_video"
  | "too_close_to_call"
  | "failed";

export type S10TakeLifecycleRow = {
  id: string;
  audition_id?: string | null;
  take_number?: number | null;
  take_slot?: number | null;
  take_version_number?: number | null;
  take_version_status?: string | null;
  replaced_by_take_id?: string | null;
  replaces_take_id?: string | null;
  analysis_run_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type S10ActiveTakeVersion<T extends S10TakeLifecycleRow = S10TakeLifecycleRow> = T & {
  take_slot: S10TakeSlot;
};

export type S10TakeLifecycleIssue =
  | "invalid_slot"
  | "more_than_three_active_slots"
  | "duplicate_active_slot"
  | "active_replaced_version"
  | "invalid_version_number";

export type S10ComparisonFoundation = {
  audition_id: string;
  compared_take_version_ids: string[];
  compared_slots: S10TakeSlot[];
  comparison_status: S10ComparisonRunStatus;
  stale_after_replacement: boolean;
  stale_reason: string | null;
};

const TAKE_VERSION_STATUSES = new Set<S10TakeVersionStatus>([
  "active",
  "replaced",
  "processing_failed",
  "analysis_failed",
  "deleted_by_user",
  "archived",
]);

export function isS10TakeSlot(value: unknown): value is S10TakeSlot {
  return value === 1 || value === 2 || value === 3;
}

export function normaliseS10TakeSlot(row: S10TakeLifecycleRow): S10TakeSlot | null {
  if (isS10TakeSlot(row.take_slot)) return row.take_slot;
  if (isS10TakeSlot(row.take_number)) return row.take_number;
  return null;
}

export function normaliseS10TakeVersionStatus(
  value: unknown,
  fallback: S10TakeVersionStatus = "active",
): S10TakeVersionStatus {
  return typeof value === "string" && TAKE_VERSION_STATUSES.has(value as S10TakeVersionStatus)
    ? (value as S10TakeVersionStatus)
    : fallback;
}

export function isS10ActiveTakeVersion(row: S10TakeLifecycleRow): boolean {
  return normaliseS10TakeVersionStatus(row.take_version_status) === "active";
}

export function buildS10TakeAnalysisRunId(takeId: string): string {
  const raw = takeId.trim().replace(/^(take-)+/, "");
  return `take-${raw}`;
}

export function getS10TakeVersionNumber(row: S10TakeLifecycleRow): number {
  return Number.isFinite(row.take_version_number) && Number(row.take_version_number) > 0
    ? Number(row.take_version_number)
    : 1;
}

function compareS10TakeVersionRows(a: S10TakeLifecycleRow, b: S10TakeLifecycleRow): number {
  const slotA = normaliseS10TakeSlot(a) ?? Number.POSITIVE_INFINITY;
  const slotB = normaliseS10TakeSlot(b) ?? Number.POSITIVE_INFINITY;
  if (slotA !== slotB) return slotA - slotB;

  const versionA = getS10TakeVersionNumber(a);
  const versionB = getS10TakeVersionNumber(b);
  if (versionA !== versionB) return versionA - versionB;

  const createdA = a.created_at ? Date.parse(a.created_at) : Number.NaN;
  const createdB = b.created_at ? Date.parse(b.created_at) : Number.NaN;
  if (Number.isFinite(createdA) && Number.isFinite(createdB) && createdA !== createdB) {
    return createdA - createdB;
  }
  return a.id.localeCompare(b.id);
}

export function activeS10TakeVersions<T extends S10TakeLifecycleRow>(
  rows: readonly T[],
): S10ActiveTakeVersion<T>[] {
  return rows
    .filter(isS10ActiveTakeVersion)
    .map((row) => {
      const slot = normaliseS10TakeSlot(row);
      return slot ? ({ ...row, take_slot: slot } as S10ActiveTakeVersion<T>) : null;
    })
    .filter((row): row is S10ActiveTakeVersion<T> => row !== null)
    .sort(compareS10TakeVersionRows);
}

export function nextS10TakeSlot(rows: readonly S10TakeLifecycleRow[]): S10TakeSlot | null {
  const used = new Set(activeS10TakeVersions(rows).map((row) => row.take_slot));
  return S10_TAKE_SLOTS.find((slot) => !used.has(slot)) ?? null;
}

export function nextS10TakeVersionNumberForSlot(
  rows: readonly S10TakeLifecycleRow[],
  slot: S10TakeSlot,
): number {
  const existing = rows
    .filter((row) => normaliseS10TakeSlot(row) === slot)
    .map((row) => (Number.isFinite(row.take_version_number) ? Number(row.take_version_number) : 1));
  return Math.max(0, ...existing) + 1;
}

export function validateS10TakeLifecycle(rows: readonly S10TakeLifecycleRow[]): {
  ok: boolean;
  issues: S10TakeLifecycleIssue[];
} {
  const issues: S10TakeLifecycleIssue[] = [];
  const active = rows.filter(isS10ActiveTakeVersion);
  const activeWithSlots = activeS10TakeVersions(rows);
  if (active.some((row) => !normaliseS10TakeSlot(row))) issues.push("invalid_slot");
  if (
    rows.some(
      (row) =>
        row.take_version_number != null &&
        (!Number.isFinite(row.take_version_number) || Number(row.take_version_number) < 1),
    )
  ) {
    issues.push("invalid_version_number");
  }
  if (activeWithSlots.length > 3) issues.push("more_than_three_active_slots");
  const seen = new Set<S10TakeSlot>();
  for (const row of activeWithSlots) {
    if (seen.has(row.take_slot)) issues.push("duplicate_active_slot");
    seen.add(row.take_slot);
    if (row.replaces_take_id && row.replaced_by_take_id) issues.push("active_replaced_version");
  }
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

export function buildS10ComparisonFoundation(
  auditionId: string,
  rows: readonly S10TakeLifecycleRow[],
): S10ComparisonFoundation {
  const active = activeS10TakeVersions(rows);
  return {
    audition_id: auditionId,
    compared_take_version_ids: active.map((row) => row.id),
    compared_slots: active.map((row) => row.take_slot),
    comparison_status: active.length >= 2 ? "pending" : "failed",
    stale_after_replacement: false,
    stale_reason: null,
  };
}

export function markS10ComparisonStaleAfterReplacement(
  comparison: S10ComparisonFoundation,
  replacedTakeVersionId: string,
): S10ComparisonFoundation {
  if (!comparison.compared_take_version_ids.includes(replacedTakeVersionId)) return comparison;
  return {
    ...comparison,
    comparison_status: "stale_after_replacement",
    stale_after_replacement: true,
    stale_reason: `Take version ${replacedTakeVersionId} was replaced after this comparison was prepared.`,
  };
}
