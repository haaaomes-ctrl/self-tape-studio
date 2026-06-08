// Δ6 — unit tests for performerSafeVerdictReason (blocked-reason sanitisation).

import { describe, expect, it } from "vitest";
import { performerSafeVerdictReason } from "@/lib/audition-rules";

const RAW_BLOCKED = "Blocked: a major casting brief instruction wasn't followed.";
const SAFE_BLOCK_REASON = "The mandatory Side 1 acting scene was not observed.";

describe("performerSafeVerdictReason", () => {
  it("passes a non-blocked (tone-honest) reason through unchanged", () => {
    const r = "Close, but a focused retake will lift this above the submission bar.";
    expect(performerSafeVerdictReason({ reason: r, blocked: false, blockReasons: [] })).toBe(r);
  });

  it("passes an already-safe reason through unchanged even when blocked", () => {
    const r = "The required Side 1 acting scene is missing — record it and shoot a fresh take.";
    expect(performerSafeVerdictReason({ reason: r, blocked: true, blockReasons: [] })).toBe(r);
  });

  it('reuses the first performer-safe block reason for a raw "Blocked:" reason', () => {
    expect(
      performerSafeVerdictReason({
        reason: RAW_BLOCKED,
        blocked: true,
        blockReasons: [SAFE_BLOCK_REASON],
      }),
    ).toBe(SAFE_BLOCK_REASON);
  });

  it('skips a "Blocked:" entry in block_reasons (process-take pushes verdict.reason there)', () => {
    expect(
      performerSafeVerdictReason({
        reason: RAW_BLOCKED,
        blocked: true,
        blockReasons: [RAW_BLOCKED, SAFE_BLOCK_REASON],
      }),
    ).toBe(SAFE_BLOCK_REASON);
  });

  it("falls back to a reframed action-honest sentence when no safe block reason exists", () => {
    const out = performerSafeVerdictReason({
      reason: RAW_BLOCKED,
      blocked: true,
      blockReasons: [RAW_BLOCKED], // only the raw line
    });
    expect(out).toBe(
      "Not ready to send — a major casting brief instruction wasn't followed. Record a fresh take before submitting.",
    );
    expect(out).not.toMatch(/blocked\s*:/i);
  });

  it("falls back when block_reasons is empty/missing", () => {
    expect(
      performerSafeVerdictReason({ reason: RAW_BLOCKED, blocked: true, blockReasons: [] }),
    ).toBe(
      "Not ready to send — a major casting brief instruction wasn't followed. Record a fresh take before submitting.",
    );
    expect(
      performerSafeVerdictReason({ reason: RAW_BLOCKED, blocked: true, blockReasons: undefined }),
    ).toMatch(/^Not ready to send/);
  });

  it("NEVER returns a string carrying the forbidden Blocked: phrasing", () => {
    for (const blockReasons of [[], [RAW_BLOCKED], [RAW_BLOCKED, SAFE_BLOCK_REASON], undefined]) {
      const out = performerSafeVerdictReason({ reason: RAW_BLOCKED, blocked: true, blockReasons });
      expect(out).not.toMatch(/blocked\s*:/i);
    }
  });

  it("returns null for a null reason", () => {
    expect(
      performerSafeVerdictReason({ reason: null, blocked: true, blockReasons: [] }),
    ).toBeNull();
  });
});
