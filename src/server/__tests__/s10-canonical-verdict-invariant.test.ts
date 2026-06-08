// Δ6 Slice 2 — canonical-verdict invariant, END-TO-END.
//
// The performer-VISIBLE verdict equals the canonical deterministic decision (derived from
// the persisted submission_verdict via canonicalVerdictDecision), NOT the AI judgement A's
// recommendation.decision. The visible surface is the view-model chokepoint
// (buildS10PerformerReportViewModel → a distinct canonical_verdict {decision, reason}), read
// by the PDF model (buildReportViewModel → modules.recommendation.display.decisionRaw) and the
// V2ReportView pill, gated by the existing s10SubmissionGuidanceAuthorized predicate.
// recommendation.decision STAYS = A (narration).
//
// These FAIL against current code (which renders A's decision); pass once Slice 2 lands.

import { describe, expect, it } from "vitest";
import { buildV2Report } from "@/server/v2-report-builder.server";
import { buildReportViewModel, type RecommendationDisplay } from "@/lib/report-view-model";
import { computeSubmissionVerdict } from "@/server/process-take.server";
import { canonicalVerdictDecision } from "@/lib/audition-rules";
import {
  buildS10StrongCompleteProfessionalReportInput,
  buildS10StrongCompleteProfessionalViewContext,
} from "@/test-fixtures/s10-strong-complete-professional";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";

type AnyRec = Record<string, unknown>;

function buildStrongWith(overrides: {
  submission_verdict?: AnyRec;
  aDecision?: string; // override recommendation.decision (= A)
}) {
  const report = buildS10StrongCompleteProfessionalReportInput() as AnyRec;
  if (overrides.submission_verdict) report.submission_verdict = overrides.submission_verdict;
  if (overrides.aDecision) {
    (report.readiness_score_judgement as AnyRec).decision = overrides.aDecision;
  }
  return buildV2Report({
    legacyReport: report,
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10StrongCompleteProfessionalViewContext() as never,
  });
}

// The performer-visible verdict decision (PDF surface).
function visibleVerdict(v2: unknown): string | null {
  const model = buildReportViewModel(v2 as AnyRec, { takeNumber: 1 });
  expect(model).not.toBeNull();
  const display = model!.modules.recommendation.display as RecommendationDisplay | null;
  return display ? display.decisionRaw : null;
}

// The distinct canonical_verdict field on the view-model chokepoint (Record-cast so this
// file compiles against current code; undefined until Slice 2 adds it).
function canonicalVerdict(v2: unknown): AnyRec | null | undefined {
  const vm = (v2 as AnyRec).s10_view_model as AnyRec | null | undefined;
  return vm ? (vm.canonical_verdict as AnyRec | null) : undefined;
}

const REASON = "Deterministic verdict reason.";

describe("Δ6 Slice 2 — visible verdict === canonical deterministic decision (not A)", () => {
  it("passing label, not capped → submit", () => {
    const v2 = buildStrongWith({
      submission_verdict: {
        label: "Ready to submit",
        reason: REASON,
        blocked: false,
        capped: false,
      },
    });
    expect(canonicalVerdict(v2)?.decision).toBe("submit");
    expect(visibleVerdict(v2)).toBe("submit");
  });

  it("passing label, CAPPED → review_carefully, even though A says submit", () => {
    const v2 = buildStrongWith({
      submission_verdict: {
        label: "Ready to submit",
        reason: REASON,
        blocked: false,
        capped: true,
      },
      aDecision: "submit", // A would show a clean submit
    });
    expect(canonicalVerdict(v2)?.decision).toBe("review_carefully");
    expect(visibleVerdict(v2)).toBe("review_carefully"); // canonical, NOT A's "submit"
    expect(visibleVerdict(v2)).not.toBe("submit");
  });

  it('"Worth another take" → retake, even though A says review_carefully (the ratified call)', () => {
    const v2 = buildStrongWith({
      submission_verdict: {
        label: "Worth another take",
        reason: REASON,
        blocked: false,
        capped: false,
      },
      aDecision: "review_carefully",
    });
    expect(canonicalVerdict(v2)?.decision).toBe("retake_required_if_possible");
    expect(visibleVerdict(v2)).toBe("retake_required_if_possible");
    expect(visibleVerdict(v2)).not.toBe("review_carefully");
  });

  it("blocked overrides a passing label → retake", () => {
    const v2 = buildStrongWith({
      submission_verdict: {
        label: "Ready to submit",
        reason: REASON,
        blocked: true,
        capped: false,
      },
      aDecision: "submit",
    });
    expect(canonicalVerdict(v2)?.decision).toBe("retake_required_if_possible");
    expect(visibleVerdict(v2)).toBe("retake_required_if_possible");
  });

  it("dropped hedge: A says submit_if_deadline_is_close → visible verdict is the honest canonical decision", () => {
    const v2 = buildStrongWith({
      submission_verdict: {
        label: "Ready to submit",
        reason: REASON,
        blocked: false,
        capped: false,
      },
      aDecision: "submit_if_deadline_is_close",
    });
    expect(visibleVerdict(v2)).toBe("submit");
    expect(visibleVerdict(v2)).not.toBe("submit_if_deadline_is_close");
  });

  it("preserves the deterministic reason on the canonical field", () => {
    const v2 = buildStrongWith({
      submission_verdict: {
        label: "Worth another take",
        reason: REASON,
        blocked: false,
        capped: false,
      },
    });
    expect(canonicalVerdict(v2)?.reason).toBe(REASON);
  });

  it("withhold: missing readiness (submission_guidance unauthorised) → verdict null", () => {
    const report = buildS10CanaryAReportInput() as AnyRec;
    report.submission_verdict = {
      label: "Worth another take",
      reason: REASON,
      blocked: false,
      capped: false,
    };
    delete report.readiness_score_judgement;
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    expect(visibleVerdict(v2)).toBeNull();
  });
});

describe("Δ6 Slice 2 — cross-slice coherence + live derivation (verdict agrees with canonical D)", () => {
  it("canary: D=54 (capped/blocked) → live verdict maps to retake; headline + verdict coherent", () => {
    const report = buildS10CanaryAReportInput() as AnyRec;
    // Live: derive the deterministic verdict from canonical D=54 + the canary's honest scores.
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
    const expectedDecision = canonicalVerdictDecision({
      label: verdict.label,
      capped: verdict.capped,
      blocked: verdict.blocked,
    });
    expect(expectedDecision).toBe("retake_required_if_possible"); // D below bar + brief blocker
    report.submission_verdict = verdict;
    const v2 = buildV2Report({
      legacyReport: report,
      futureDimensions: null,
      auditionType: "musical_theatre",
      mode: "brief",
      s10Context: buildS10CanaryAViewContext() as never,
    });
    expect(canonicalVerdict(v2)?.decision).toBe("retake_required_if_possible");
    expect(visibleVerdict(v2)).toBe("retake_required_if_possible");
    // coherent with Slice 1's canonical headline D = 54
    expect(v2.overall_readiness).toBe(54);
  });

  it("strong: D=93 (clean) → live verdict maps to submit; headline + verdict coherent", () => {
    const verdict = computeSubmissionVerdict({
      overall: 93,
      audioScore: 90,
      technicalScore: 91,
      briefAdherence: 96,
      mode: "brief",
      atRisk: false,
      riskFlags: [],
      level: "professional",
      scores: { acting: 93, vocal: 94, brief_adherence: 96, technical: 91, audio: 90 },
    });
    expect(
      canonicalVerdictDecision({
        label: verdict.label,
        capped: verdict.capped,
        blocked: verdict.blocked,
      }),
    ).toBe("submit");
    const v2 = buildStrongWith({ submission_verdict: verdict });
    expect(canonicalVerdict(v2)?.decision).toBe("submit");
    expect(visibleVerdict(v2)).toBe("submit");
    expect(v2.overall_readiness).toBe(93);
  });
});
