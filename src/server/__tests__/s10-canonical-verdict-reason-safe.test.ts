// Δ6 — canonical_verdict.reason is performer-safe BY CONSTRUCTION (end-to-end).
//
// For blocked takes the deterministic submission_verdict.reason is the raw "Blocked: …"
// phrasing (computeSubmissionVerdict), which is performer-forbidden. canonicalVerdictFromReport
// must sanitise it (reuse the performer-safe block_reasons; reframe as a fallback) so the
// field is safe wherever it is later rendered. The DECISION is unaffected (Slice 2 holds).
//
// These FAIL against current code (reason passes through raw) and pass once the helper is
// applied in the view model.

import { describe, expect, it } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { computeSubmissionVerdict } from "@/server/process-take.server";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";

type AnyRec = Record<string, unknown>;

function buildWith(submission_verdict: AnyRec | null, block_reasons: unknown) {
  const report = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
  if (submission_verdict) report.submission_verdict = submission_verdict;
  else delete report.submission_verdict;
  report.block_reasons = block_reasons;
  return buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
}

function canonicalVerdict(v2: unknown): AnyRec | null | undefined {
  const vm = (v2 as AnyRec).s10_view_model as AnyRec | null | undefined;
  return vm ? (vm.canonical_verdict as AnyRec | null) : undefined;
}

const SAFE_BLOCK_REASON = "The mandatory Side 1 acting scene was not observed.";

describe("Δ6 — canonical_verdict.reason performer-safe by construction", () => {
  it("blocked take: the raw deterministic Blocked: reason is replaced by the performer-safe block reason", () => {
    // Live: a brief-blocked verdict carries the raw "Blocked: …" reason.
    const verdict = computeSubmissionVerdict({
      overall: 54,
      audioScore: 86,
      technicalScore: 82,
      briefAdherence: 25,
      mode: "brief",
      atRisk: false,
      riskFlags: [],
      level: "professional",
      scores: { vocal: 72, brief_adherence: 25, technical: 82, audio: 86 },
    });
    expect(verdict.blocked).toBe(true);
    expect(verdict.reason).toMatch(/^Blocked:/i); // the raw forbidden phrasing

    // process-take pushes verdict.reason into block_reasons[0], then a performer-safe line.
    const v2 = buildWith(verdict as unknown as AnyRec, [verdict.reason, SAFE_BLOCK_REASON]);
    expect(canonicalVerdict(v2)?.reason).toBe(SAFE_BLOCK_REASON);
    expect(canonicalVerdict(v2)?.reason as string).not.toMatch(/blocked\s*:/i);
    // decision unaffected (Slice 2 invariant)
    expect(canonicalVerdict(v2)?.decision).toBe("retake_required_if_possible");
    // and nothing in the payload carries the raw Blocked: phrasing
    expect(JSON.stringify(v2)).not.toContain("Blocked:");
  });

  it("non-blocked take: the tone-honest reason passes through unchanged", () => {
    const reason = "Close, but a focused retake will lift this above the submission bar.";
    const v2 = buildWith({ label: "Worth another take", reason, blocked: false, capped: false }, [
      reason,
    ]);
    expect(canonicalVerdict(v2)?.reason).toBe(reason);
    expect(canonicalVerdict(v2)?.decision).toBe("retake_required_if_possible");
  });

  it("fallback: no performer-safe block reason → reframed action-honest sentence (no Blocked:)", () => {
    const raw = "Blocked: a major casting brief instruction wasn't followed.";
    const v2 = buildWith({ label: "Not ready yet", reason: raw, blocked: true, capped: true }, [
      raw,
    ]);
    expect(canonicalVerdict(v2)?.reason).toBe(
      "Not ready to send — a major casting brief instruction wasn't followed. Record a fresh take before submitting.",
    );
    expect(canonicalVerdict(v2)?.reason as string).not.toMatch(/blocked\s*:/i);
  });

  it("withhold: no submission_verdict → canonical_verdict null", () => {
    const v2 = buildWith(null, []);
    expect(canonicalVerdict(v2)).toBeNull();
  });
});
