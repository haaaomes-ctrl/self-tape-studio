// ARCH-Δ3: evidence-binding gate (rescoped — R4 sole mutator, R1 location
// test over requirement_results, R2/R3 assert-only).
//
// STOP-GATES (operator-binding): idempotence (gate(gate(x)) === gate(x))
// and canary-A ZERO gate actions through the REAL normaliser output — if
// either fails, halt and report before merge.

import { describe, expect, it } from "vitest";
import {
  applyEvidenceBindingGate,
  EVIDENCE_BINDING_GATE_BREAKDOWN_NOTE,
  EVIDENCE_BINDING_GATE_WITHHELD_SUMMARY,
  type EvidenceBindingGateInput,
} from "@/server/evidence-binding-gate.server";
import { normaliseBriefAchievementMatrix } from "@/server/s10-brief-achievement-matrix.server";
import type {
  BriefAchievementMatrix,
  BriefRequirement,
  RequirementAchievementResult,
} from "@/lib/audition-rules";
import type { ComponentVerification, ObservedTapeSequence } from "@/server/evidence-pass.server";
import {
  buildS10CanaryAReportInput,
  s10CanaryABriefRequirements,
  s10CanaryAComponentVerifications,
  s10CanaryAMediaObservationSummary,
  s10CanaryAObservedTapeSequence,
} from "@/test-fixtures/s10-canary-a-incomplete-package";
import {
  buildS10StrongCompleteProfessionalReportInput,
  s10StrongCompleteProfessionalBriefRequirements,
  s10StrongCompleteProfessionalComponentVerifications,
  s10StrongCompleteProfessionalMediaObservationSummary,
  s10StrongCompleteProfessionalObservedTapeSequence,
} from "@/test-fixtures/s10-strong-complete-professional";

// ── hand-built fixture helpers (pure shapes, no mocks) ─────────────────────

function verification(overrides: Partial<ComponentVerification> = {}): ComponentVerification {
  return {
    requirement_id: "req_acting_scene",
    requirement_summary: "Required acting scene",
    observed_status: "present",
    completion_status: "complete",
    evidence_summary: "The acting scene is present and complete.",
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    timestamp_refs: [],
    confidence: "high",
    cannot_infer_from_brief_only: true,
    ...overrides,
  } as ComponentVerification;
}

function requirementResult(
  overrides: Partial<RequirementAchievementResult> = {},
): RequirementAchievementResult {
  return {
    requirement_id: "req_acting_scene",
    requirement_summary: "Required acting scene",
    category: "material",
    importance: "mandatory",
    observed_status: "present",
    completion_status: "complete",
    achievement_status: "achieved",
    evidence_summary: "Delivered in full.",
    submission_impact: "supports_submission",
    fix_category: "preserve",
    recommended_action: "",
    confidence: "high",
    linked_observed_sequence_ids: [],
    linked_component_verification_ids: ["req_acting_scene"],
    cannot_infer_from_brief_only: true,
    ...overrides,
  };
}

function matrix(overrides: Partial<BriefAchievementMatrix> = {}): BriefAchievementMatrix {
  return {
    overall_status: "achieved",
    mandatory_status: "clear",
    readiness_impact: "supports_submission",
    summary: "Brief achievement is supported by the observed tape requirements.",
    achieved_requirements: [],
    missing_or_incomplete_requirements: [],
    not_assessable_requirements: [],
    final_check_requirements: [],
    requirement_results: [],
    ...overrides,
  };
}

function gateInput(overrides: Partial<EvidenceBindingGateInput> = {}): EvidenceBindingGateInput {
  return {
    matrix: matrix(),
    briefRequirements: [],
    observedTapeSequence: [],
    componentVerifications: [],
    briefAdherenceBreakdown: null,
    ...overrides,
  };
}

// ── R4: the fix ────────────────────────────────────────────────────────────

describe("R4 — verdict coherence (the live specimen)", () => {
  it("collapses the empty-results specimen: achieved/clear/100 with requirement_results=[]", () => {
    const result = applyEvidenceBindingGate(
      gateInput({
        briefAdherenceBreakdown: { material_compliance: 100 },
      }),
    );
    expect(result.matrix?.overall_status).toBe("not_assessable");
    expect(result.matrix?.mandatory_status).toBe("not_assessable");
    expect(result.matrix?.readiness_impact).toBe("not_assessable");
    expect(result.matrix?.summary).toBe(EVIDENCE_BINDING_GATE_WITHHELD_SUMMARY);
    expect(result.briefAdherenceBreakdown?.material_compliance).toBeNull();
    expect(result.briefAdherenceBreakdown?.note).toContain(EVIDENCE_BINDING_GATE_BREAKDOWN_NOTE);
    const codes = result.actions.map((action) => action.code);
    expect(codes).toContain("matrix_verdict_unsupported");
    expect(codes).toContain("adherence_breakdown_capped");
  });

  it("ORPHAN-VERIFICATION VARIANT: a located verification that NO row references cannot keep the verdict", () => {
    // The live specimen exactly: brief_requirements=[], lying "achieved"
    // matrix, AND a located req_acting_scene verification in evidence.
    // R4's located test is over requirement_results — it must still collapse.
    const result = applyEvidenceBindingGate(
      gateInput({
        componentVerifications: [verification()], // orphan: no row links it
        briefAdherenceBreakdown: { material_compliance: 100 },
      }),
    );
    expect(result.matrix?.overall_status).toBe("not_assessable");
    expect(result.matrix?.mandatory_status).toBe("not_assessable");
    expect(result.matrix?.readiness_impact).toBe("not_assessable");
    expect(result.briefAdherenceBreakdown?.material_compliance).toBeNull();
  });

  it("runs the ID-space rule: fires regardless of brief_requirements being empty", () => {
    const withReqs = applyEvidenceBindingGate(
      gateInput({
        briefRequirements: [],
      }),
    );
    expect(withReqs.actions.some((a) => a.code === "matrix_verdict_unsupported")).toBe(true);
  });

  it("keeps a SUPPORTED positive verdict byte-identical (located positive row)", () => {
    const input = gateInput({
      matrix: matrix({ requirement_results: [requirementResult()] }),
      componentVerifications: [verification()],
      briefAdherenceBreakdown: { material_compliance: 90 },
    });
    const result = applyEvidenceBindingGate(input);
    expect(result.matrix).toBe(input.matrix); // same reference — untouched
    expect(result.briefAdherenceBreakdown).toBe(input.briefAdherenceBreakdown);
    expect(result.actions).toEqual([]);
  });

  it("never touches a non-positive verdict (we don't know ≠ they failed, and not_achieved stays)", () => {
    const input = gateInput({
      matrix: matrix({
        overall_status: "not_achieved",
        mandatory_status: "blocked",
        readiness_impact: "submission_blocker",
      }),
    });
    const result = applyEvidenceBindingGate(input);
    expect(result.matrix).toBe(input.matrix);
    expect(result.actions).toEqual([]);
  });

  it("collapses to not_assessable, never not_achieved, on every top-level field", () => {
    const result = applyEvidenceBindingGate(gateInput());
    expect(result.matrix?.overall_status).not.toBe("not_achieved");
    expect(result.matrix?.mandatory_status).not.toBe("blocked");
    expect(result.matrix?.readiness_impact).not.toBe("submission_blocker");
  });
});

// ── R1: location test feeding R4 ───────────────────────────────────────────

describe("R1 — located means a resolving linked id with present evidence", () => {
  it("dangling linked ids do NOT count as located", () => {
    const result = applyEvidenceBindingGate(
      gateInput({
        matrix: matrix({
          requirement_results: [
            requirementResult({
              linked_component_verification_ids: ["req_does_not_exist"],
              linked_observed_sequence_ids: ["seq_does_not_exist"],
            }),
          ],
        }),
        componentVerifications: [verification()], // exists but under a different id
      }),
    );
    expect(result.matrix?.overall_status).toBe("not_assessable");
  });

  it("a linked verification that is ABSENT does not locate a positive claim", () => {
    const result = applyEvidenceBindingGate(
      gateInput({
        matrix: matrix({ requirement_results: [requirementResult()] }),
        componentVerifications: [verification({ observed_status: "absent" })],
      }),
    );
    expect(result.matrix?.overall_status).toBe("not_assessable");
  });

  it("locates via observed_tape_sequence ids too", () => {
    const sequence = {
      id: "seq_1",
      label: "Acting scene",
      component_type: "acting_scene",
      linked_requirement_ids: ["req_acting_scene"],
      start_time: "0:05",
      end_time: "1:00",
      present_status: "present",
      completion_status: "complete",
      evidence_summary: "Scene observed in full.",
      observed_from_media: true,
      evidence_basis: "observed_audio_video",
      confidence: "high",
      assessability_notes: "",
    } as unknown as ObservedTapeSequence;
    const input = gateInput({
      matrix: matrix({
        requirement_results: [
          requirementResult({
            linked_component_verification_ids: [],
            linked_observed_sequence_ids: ["seq_1"],
          }),
        ],
      }),
      observedTapeSequence: [sequence],
    });
    const result = applyEvidenceBindingGate(input);
    expect(result.matrix).toBe(input.matrix);
    expect(result.actions).toEqual([]);
  });
});

// ── R2/R3: assert-only ─────────────────────────────────────────────────────

describe("R2/R3 — assert-only: audit actions, NEVER row mutations", () => {
  it("R2: an unlocated positive row is flagged but NOT rewritten", () => {
    const row = requirementResult({ linked_component_verification_ids: ["dangling"] });
    const input = gateInput({
      matrix: matrix({
        overall_status: "partly_achieved", // non-positive top-level: R4 quiet
        mandatory_status: "some_gaps",
        readiness_impact: "material_gap",
        requirement_results: [row],
      }),
    });
    const result = applyEvidenceBindingGate(input);
    const r2 = result.actions.filter((a) => a.code === "positive_claim_unlocated");
    expect(r2).toHaveLength(1);
    expect(r2[0].requirement_id).toBe("req_acting_scene");
    expect(r2[0].not_assessable_reason).toBe("unlocated_claim");
    // Row untouched — per-row authority stays with the normaliser.
    expect(result.matrix?.requirement_results[0]).toBe(row);
    expect(result.matrix?.requirement_results[0].achievement_status).toBe("achieved");
  });

  it("R3: a mandatory brief requirement with no row is flagged but NOT synthesized", () => {
    const requirement = {
      id: "req_song",
      brief_text: "Include a song.",
      summary: "Required song",
      category: "material",
      importance: "mandatory",
      expected_evidence_in_tape: "The tape contains the song.",
      achievement_test: "Song present and complete.",
      submission_impact_if_missing: "Mandatory material missing.",
      report_destination: "brief_achievement",
      confidence: "high",
    } as BriefRequirement;
    const input = gateInput({
      matrix: matrix({
        overall_status: "partly_achieved",
        mandatory_status: "some_gaps",
        readiness_impact: "material_gap",
        requirement_results: [],
      }),
      briefRequirements: [requirement],
    });
    const result = applyEvidenceBindingGate(input);
    const r3 = result.actions.filter((a) => a.code === "mandatory_requirement_missing_row");
    expect(r3).toHaveLength(1);
    expect(r3[0].requirement_id).toBe("req_song");
    expect(r3[0].not_assessable_reason).toBe("unlocated_mandatory_requirement");
    expect(result.matrix?.requirement_results).toHaveLength(0); // nothing synthesized
  });
});

// ── three-way preservation ─────────────────────────────────────────────────

describe("three-way preservation (no row mutations by construction)", () => {
  it("not_applicable rows pass through byte-identical and are never a gap (acting audition, MT song)", () => {
    const naRow = requirementResult({
      requirement_id: "req_mt_song",
      achievement_status: "not_applicable",
      observed_status: "absent",
      completion_status: "not_applicable",
      submission_impact: "not_assessable",
      fix_category: "none",
      linked_component_verification_ids: [],
    });
    const input = gateInput({
      matrix: matrix({
        overall_status: "partly_achieved",
        mandatory_status: "some_gaps",
        readiness_impact: "material_gap",
        requirement_results: [naRow],
      }),
    });
    const result = applyEvidenceBindingGate(input);
    expect(result.matrix?.requirement_results[0]).toBe(naRow);
    expect(result.actions).toEqual([]); // not_applicable is not a positive claim
  });

  it("tape-limited not_assessable rows stay untouched with the Δ3a reason left null", () => {
    const row = requirementResult({
      achievement_status: "not_assessable",
      observed_status: "not_assessable",
      submission_impact: "not_assessable",
      fix_category: "must_fix",
    });
    const input = gateInput({
      matrix: matrix({
        overall_status: "not_assessable",
        mandatory_status: "not_assessable",
        readiness_impact: "not_assessable",
        requirement_results: [row],
      }),
    });
    const result = applyEvidenceBindingGate(input);
    expect(result.matrix).toBe(input.matrix);
    expect(result.actions).toEqual([]);
    expect((row as Record<string, unknown>).not_assessable_reason).toBeUndefined();
  });
});

// ── mechanics ──────────────────────────────────────────────────────────────

describe("gate mechanics", () => {
  it("no matrix → no-op with applied:true (baseline runs)", () => {
    const result = applyEvidenceBindingGate(gateInput({ matrix: null }));
    expect(result.matrix).toBeNull();
    expect(result.actions).toEqual([]);
    expect(result.applied).toBe(true);
  });

  it("STOP-GATE — idempotence: gate(gate(x)) deep-equals gate(x)", () => {
    const once = applyEvidenceBindingGate(
      gateInput({ briefAdherenceBreakdown: { material_compliance: 100 } }),
    );
    const twice = applyEvidenceBindingGate(
      gateInput({
        matrix: once.matrix,
        briefAdherenceBreakdown: once.briefAdherenceBreakdown,
      }),
    );
    expect(twice.matrix).toEqual(once.matrix);
    expect(twice.briefAdherenceBreakdown).toEqual(once.briefAdherenceBreakdown);
    // Second pass mutates nothing (the collapsed verdict is non-positive).
    expect(
      twice.actions.filter(
        (a) => a.code === "matrix_verdict_unsupported" || a.code === "adherence_breakdown_capped",
      ),
    ).toEqual([]);
  });

  it("does not mutate its inputs", () => {
    const m = matrix();
    const breakdown = { material_compliance: 100 };
    const snapshotMatrix = JSON.parse(JSON.stringify(m));
    const snapshotBreakdown = JSON.parse(JSON.stringify(breakdown));
    applyEvidenceBindingGate(gateInput({ matrix: m, briefAdherenceBreakdown: breakdown }));
    expect(m).toEqual(snapshotMatrix);
    expect(breakdown).toEqual(snapshotBreakdown);
  });
});

// ── STOP-GATE: golden fixtures through the REAL normaliser ────────────────

describe("STOP-GATE — golden fixtures produce ZERO gate actions", () => {
  it("canary A (incomplete mandatory package): zero actions, matrix untouched", () => {
    const raw = buildS10CanaryAReportInput() as Record<string, unknown>;
    const normalised = normaliseBriefAchievementMatrix({
      matrix: raw.brief_achievement_matrix,
      briefRequirements: s10CanaryABriefRequirements as never,
      componentVerifications: s10CanaryAComponentVerifications as never,
      observedTapeSequence: s10CanaryAObservedTapeSequence as never,
      mediaObservationSummary: s10CanaryAMediaObservationSummary as never,
    });
    const input = gateInput({
      matrix: normalised,
      briefRequirements: s10CanaryABriefRequirements as never,
      componentVerifications: s10CanaryAComponentVerifications as never,
      observedTapeSequence: s10CanaryAObservedTapeSequence as never,
    });
    const result = applyEvidenceBindingGate(input);
    expect(result.actions).toEqual([]);
    expect(result.matrix).toBe(normalised);
  });

  it("strong complete professional: zero actions, supported verdict kept", () => {
    const raw = buildS10StrongCompleteProfessionalReportInput() as Record<string, unknown>;
    const normalised = normaliseBriefAchievementMatrix({
      matrix: raw.brief_achievement_matrix,
      briefRequirements: s10StrongCompleteProfessionalBriefRequirements as never,
      componentVerifications: s10StrongCompleteProfessionalComponentVerifications as never,
      observedTapeSequence: s10StrongCompleteProfessionalObservedTapeSequence as never,
      mediaObservationSummary: s10StrongCompleteProfessionalMediaObservationSummary as never,
    });
    const input = gateInput({
      matrix: normalised,
      briefRequirements: s10StrongCompleteProfessionalBriefRequirements as never,
      componentVerifications: s10StrongCompleteProfessionalComponentVerifications as never,
      observedTapeSequence: s10StrongCompleteProfessionalObservedTapeSequence as never,
    });
    const result = applyEvidenceBindingGate(input);
    expect(result.actions).toEqual([]);
    expect(result.matrix).toBe(normalised);
  });
});

// ── wiring (source-text) ───────────────────────────────────────────────────

describe("wiring order (source-text assertions)", () => {
  it("gate runs after the normaliser/caps and before applyReadinessScoreSemantics, with audit block + kill-switch", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(path.resolve(__dirname, "../process-take.server.ts"), "utf8");
    const normaliser = source.indexOf("applyBriefAchievementCompatibilityCaps(");
    const gate = source.indexOf("applyEvidenceBindingGate({");
    const readiness = source.indexOf("applyReadinessScoreSemantics({");
    expect(normaliser).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(normaliser);
    expect(readiness).toBeGreaterThan(gate);
    expect(source).toContain("getEvidenceBindingGateEnabled()");
    expect(source).toContain("report.evidence_binding_gate = {");
  });

  it("audit trail is mirrored into score_breakdown UNCONDITIONALLY (survives the v2 projection)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(path.resolve(__dirname, "../process-take.server.ts"), "utf8");

    // (a) The mirror line exists, with the deliberate `?? null` (honest null,
    // never a fabricated default object).
    const mirrorLine =
      "evidence_binding_gate: (report as Record<string, unknown>).evidence_binding_gate ?? null,";
    const mirror = source.indexOf(mirrorLine);
    expect(mirror).toBeGreaterThan(-1);

    // The mirror sits INSIDE the scoreBreakdown literal that the
    // score_breakdown COLUMN write persists.
    const literalStart = source.indexOf("const scoreBreakdown = {");
    const columnWrite = source.indexOf("score_breakdown: scoreBreakdown");
    expect(literalStart).toBeGreaterThan(-1);
    expect(mirror).toBeGreaterThan(literalStart);
    expect(columnWrite).toBeGreaterThan(mirror);

    // (b) UNCONDITIONAL: no guard wraps the mirror. The window immediately
    // preceding the mirror line (after the s10_module_readiness block ends —
    // its closing `})),` map is the last code before the mirror's comment)
    // contains no `if (`, no ternary, no && and no reference to the gate's
    // action count. The mirror line itself is a plain object property.
    const windowBefore = source.slice(Math.max(0, mirror - 600), mirror);
    expect(windowBefore).not.toContain("if (");
    expect(windowBefore).not.toContain("&&");
    expect(windowBefore).not.toContain("gated.actions");
    expect(windowBefore).not.toContain("action_count >");
    expect(windowBefore).not.toContain("action_count ===");

    // (c) The always-on run log exists so quiet passes are visible in worker
    // logs (previously only action-bearing and disabled runs logged).
    expect(source).toContain('console.log("[take-pipeline] evidence_binding_gate_run", {');
    const runLog = source.indexOf("evidence_binding_gate_run");
    const actionGuard = source.indexOf("if (gated.actions.length > 0)");
    expect(runLog).toBeGreaterThan(-1);
    expect(actionGuard).toBeGreaterThan(-1);
    // The run log fires BEFORE (outside) the action_count>0 guard.
    expect(runLog).toBeLessThan(actionGuard);
  });
});
