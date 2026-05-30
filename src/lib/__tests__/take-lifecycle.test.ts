import { describe, expect, it } from "vitest";

import {
  activeS10TakeVersions,
  buildS10ComparisonFoundation,
  buildS10TakeAnalysisRunId,
  markS10ComparisonStaleAfterReplacement,
  nextS10TakeSlot,
  nextS10TakeVersionNumberForSlot,
  validateS10TakeLifecycle,
  type S10TakeLifecycleRow,
} from "@/lib/take-lifecycle";

function take(overrides: Partial<S10TakeLifecycleRow>): S10TakeLifecycleRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    audition_id: overrides.audition_id ?? "audition-1",
    take_number: overrides.take_number ?? 1,
    take_slot: overrides.take_slot ?? overrides.take_number ?? 1,
    take_version_number: overrides.take_version_number ?? 1,
    take_version_status: overrides.take_version_status ?? "active",
    created_at: overrides.created_at ?? "2026-05-30T12:00:00.000Z",
    replaced_by_take_id: overrides.replaced_by_take_id ?? null,
    replaces_take_id: overrides.replaces_take_id ?? null,
  };
}

describe("S10 take lifecycle foundation", () => {
  it("uses the lowest open active slot instead of appending by row count", () => {
    const rows = [
      take({ id: "take-1", take_slot: 1 }),
      take({ id: "take-2-old", take_slot: 2, take_version_status: "replaced" }),
      take({ id: "take-3", take_slot: 3 }),
    ];

    expect(nextS10TakeSlot(rows)).toBe(2);
    expect(activeS10TakeVersions(rows).map((row) => row.id)).toEqual(["take-1", "take-3"]);
  });

  it("detects duplicate active slots and the fourth active slot state", () => {
    expect(
      validateS10TakeLifecycle([
        take({ id: "take-1", take_slot: 1 }),
        take({ id: "take-1b", take_slot: 1, take_version_number: 2 }),
      ]),
    ).toEqual({ ok: false, issues: ["duplicate_active_slot"] });

    expect(
      validateS10TakeLifecycle([
        take({ id: "take-1", take_slot: 1 }),
        take({ id: "take-2", take_slot: 2 }),
        take({ id: "take-3", take_slot: 3 }),
        take({ id: "take-4", take_number: 4, take_slot: 4 }),
      ]),
    ).toEqual({ ok: false, issues: ["invalid_slot"] });
  });

  it("increments replacement version numbers without losing prior version identity", () => {
    const rows = [
      take({
        id: "slot-2-v1",
        take_slot: 2,
        take_version_number: 1,
        take_version_status: "replaced",
      }),
      take({
        id: "slot-2-v2",
        take_slot: 2,
        take_version_number: 2,
        take_version_status: "active",
      }),
    ];

    expect(nextS10TakeVersionNumberForSlot(rows, 2)).toBe(3);
    expect(activeS10TakeVersions(rows).map((row) => row.id)).toEqual(["slot-2-v2"]);
  });

  it("builds active-version comparison foundations and marks replaced versions stale", () => {
    const rows = [
      take({ id: "slot-1-v1", take_slot: 1 }),
      take({ id: "slot-2-v1", take_slot: 2 }),
      take({ id: "slot-3-v0", take_slot: 3, take_version_status: "replaced" }),
      take({ id: "slot-3-v1", take_slot: 3, take_version_number: 2 }),
    ];

    const comparison = buildS10ComparisonFoundation("audition-1", rows);

    expect(comparison).toMatchObject({
      audition_id: "audition-1",
      compared_take_version_ids: ["slot-1-v1", "slot-2-v1", "slot-3-v1"],
      compared_slots: [1, 2, 3],
      comparison_status: "pending",
      stale_after_replacement: false,
    });

    expect(markS10ComparisonStaleAfterReplacement(comparison, "slot-2-v1")).toMatchObject({
      comparison_status: "stale_after_replacement",
      stale_after_replacement: true,
    });
  });

  it("canonicalises analysis run IDs without double take-prefixing", () => {
    expect(buildS10TakeAnalysisRunId("abc-123")).toBe("take-abc-123");
    expect(buildS10TakeAnalysisRunId("take-abc-123")).toBe("take-abc-123");
    expect(buildS10TakeAnalysisRunId("take-take-abc-123")).toBe("take-abc-123");
  });
});
