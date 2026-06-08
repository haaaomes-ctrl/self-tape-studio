// Δ6 Slice 2 — unit tests for the canonical verdict mapper (the ratified
// label + capped + blocked → render-decision mapping). Pure and exhaustive.

import { describe, expect, it } from "vitest";
import { canonicalVerdictDecision } from "@/lib/audition-rules";

describe("canonicalVerdictDecision — ratified label→decision mapping", () => {
  it("passing label, not capped → submit", () => {
    expect(
      canonicalVerdictDecision({ label: "Strong for this level", capped: false, blocked: false }),
    ).toBe("submit");
    expect(
      canonicalVerdictDecision({ label: "Ready to submit", capped: false, blocked: false }),
    ).toBe("submit");
  });

  it("passing label, capped → review_carefully (clears the bar but a cap fired)", () => {
    expect(
      canonicalVerdictDecision({ label: "Strong for this level", capped: true, blocked: false }),
    ).toBe("review_carefully");
    expect(
      canonicalVerdictDecision({ label: "Ready to submit", capped: true, blocked: false }),
    ).toBe("review_carefully");
  });

  it('"Worth another take" → retake (honest reshoot, never softened to review)', () => {
    expect(
      canonicalVerdictDecision({ label: "Worth another take", capped: false, blocked: false }),
    ).toBe("retake_required_if_possible");
    expect(
      canonicalVerdictDecision({ label: "Worth another take", capped: true, blocked: false }),
    ).toBe("retake_required_if_possible");
  });

  it('"Not ready yet" → retake', () => {
    expect(
      canonicalVerdictDecision({ label: "Not ready yet", capped: false, blocked: false }),
    ).toBe("retake_required_if_possible");
  });

  it("blocked overrides any passing label → retake", () => {
    expect(
      canonicalVerdictDecision({ label: "Strong for this level", capped: false, blocked: true }),
    ).toBe("retake_required_if_possible");
    expect(
      canonicalVerdictDecision({ label: "Ready to submit", capped: true, blocked: true }),
    ).toBe("retake_required_if_possible");
  });

  it("never emits submit_if_deadline_is_close (the dropped A-side hedge) for any input", () => {
    const labels = [
      "Strong for this level",
      "Ready to submit",
      "Worth another take",
      "Not ready yet",
      "some_unrecognised_label",
    ];
    for (const label of labels) {
      for (const capped of [true, false]) {
        for (const blocked of [true, false]) {
          const decision = canonicalVerdictDecision({ label, capped, blocked });
          expect(decision).not.toBe("submit_if_deadline_is_close");
          expect(["submit", "review_carefully", "retake_required_if_possible"]).toContain(decision);
        }
      }
    }
  });

  it("unrecognised label → honest retake (conservative default)", () => {
    expect(canonicalVerdictDecision({ label: "future_label", capped: false, blocked: false })).toBe(
      "retake_required_if_possible",
    );
  });
});
