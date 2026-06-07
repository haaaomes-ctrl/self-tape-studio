// SERVER-ONLY (worker-shared, TanStack-free). ARCH-Δ3 evidence-binding gate.
//
// Deterministic post-Step-2 reconciliation between Step 1 located evidence
// and the Step 2 brief-achievement verdict. Runs AFTER
// normaliseBriefAchievementMatrix + applyBriefAchievementCompatibilityCaps
// and BEFORE applyReadinessScoreSemantics, on BOTH pipeline paths.
//
// RESCOPED (operator decision, 2026-06-07) after the stop-and-report:
// normaliseBriefAchievementMatrix already owns per-row evidence grounding
// (R2-like downgrades) and per-requirement row synthesis (R3-like
// promotion) — but ONLY when brief_requirements is non-empty, and its
// aggregateMatrix passes the MODEL'S raw top-level statuses through
// untouched when requirement_results is empty (the live specimen:
// overall_status "achieved", mandatory_status "clear",
// material_compliance 100, requirement_results []).
//
// Division of authority (binding):
//   - R4 (THE FIX, this gate's ONLY mutations): a positive top-level
//     verdict requires at least one LOCATED positive requirement_result
//     row. The located test is over requirement_results — an orphan
//     component_verification that no row references can NOT keep a
//     positive verdict. Violations collapse overall_status /
//     mandatory_status / readiness_impact to not_assessable ("we don't
//     know" is not "they failed"), replace the summary with the
//     deterministic withheld sentence, and withdraw
//     brief_adherence_breakdown.material_compliance.
//   - R1 is the location test feeding R4: strictly linked-ID-keyed
//     (linked_component_verification_ids / linked_observed_sequence_ids
//     resolving to present/partially_present evidence rows). Dangling or
//     empty link lists do NOT count as located.
//   - R2/R3 are ASSERT-ONLY: per-row downgrade authority stays in the
//     normaliser. The gate records an audit action when a row slipped
//     past it (a normaliser bug to fix at source) but NEVER rewrites rows.
//   - ID-SPACE RULE: R1/R2/R4 run whenever a matrix EXISTS, regardless of
//     whether brief_requirements is empty. Only R3 depends on
//     brief_requirements.
//   - Three-way preservation holds trivially: the gate mutates no rows, so
//     absent / not_assessable / not_applicable rows pass through
//     byte-identical.
//
// Pure, deterministic, idempotent (gate(gate(x)) deep-equals gate(x)) and
// reversible via the app_config kill-switch read in
// evidence-binding-gate-config.server.ts.

import type {
  BriefAchievementMatrix,
  BriefRequirement,
  RequirementAchievementResult,
} from "@/lib/audition-rules";
import type { ComponentVerification, ObservedTapeSequence } from "./evidence-pass.server";

export const EVIDENCE_BINDING_GATE_VERSION = "evidence_binding_gate_v1";

/**
 * Δ3a groundwork (monday 2971908011): distinguishes WHY something is
 * not assessable. The gate stamps only the unlocated_* values it can
 * deterministically prove; tape_limited vs analysis_failure classification
 * of pre-existing rows is Δ3a's job. Rides the report JSONB — no DB column.
 */
export type NotAssessableReason =
  | "tape_limited"
  | "analysis_failure"
  | "unlocated_claim"
  | "unlocated_mandatory_requirement";

export type EvidenceBindingGateActionCode =
  | "matrix_verdict_unsupported" // R4 mutation: top-level verdict collapsed
  | "adherence_breakdown_capped" // R4 mutation: material_compliance withdrawn
  | "positive_claim_unlocated" // R2 ASSERT-ONLY: row slipped past the normaliser
  | "mandatory_requirement_missing_row"; // R3 ASSERT-ONLY: mandatory requirement has no row

export type EvidenceBindingGateAction = {
  code: EvidenceBindingGateActionCode;
  requirement_id: string | null;
  field: string | null;
  from: string | number | null;
  to: string | number | null;
  reason: string;
  not_assessable_reason?: NotAssessableReason;
};

export type EvidenceBindingGateInput = {
  matrix: BriefAchievementMatrix | null;
  briefRequirements: BriefRequirement[];
  observedTapeSequence: ObservedTapeSequence[];
  componentVerifications: ComponentVerification[];
  briefAdherenceBreakdown: Record<string, unknown> | null;
};

export type EvidenceBindingGateResult = {
  matrix: BriefAchievementMatrix | null;
  briefAdherenceBreakdown: Record<string, unknown> | null;
  actions: EvidenceBindingGateAction[];
  applied: boolean;
};

export const EVIDENCE_BINDING_GATE_WITHHELD_SUMMARY =
  "Evidence-binding gate: the brief verdict was withheld because no located requirement evidence supports it.";

export const EVIDENCE_BINDING_GATE_BREAKDOWN_NOTE =
  "Evidence-binding gate: material compliance was withdrawn because the brief verdict is not supported by located requirement evidence.";

const POSITIVE_ACHIEVEMENTS = new Set(["achieved", "mostly_achieved", "partly_achieved"]);
const LOCATED_OBSERVED = new Set(["present", "partially_present"]);

function isPositiveAchievement(status: string): boolean {
  return POSITIVE_ACHIEVEMENTS.has(status);
}

/**
 * R1 — the location test. Strictly linked-ID-keyed: a row is LOCATED iff
 * one of its linked ids resolves to an evidence row whose status is
 * present/partially_present. Dangling ids and empty link lists do NOT
 * count. (Post-normaliser, positive rows always carry the matched
 * verification's requirement_id in linked_component_verification_ids, so
 * a sound pipeline run always locates here.)
 */
function isLocated(
  row: RequirementAchievementResult,
  verificationsById: Map<string, ComponentVerification>,
  sequencesById: Map<string, ObservedTapeSequence>,
): boolean {
  for (const id of row.linked_component_verification_ids ?? []) {
    const verification = verificationsById.get(id);
    if (verification && LOCATED_OBSERVED.has(verification.observed_status)) return true;
  }
  for (const id of row.linked_observed_sequence_ids ?? []) {
    const sequence = sequencesById.get(id);
    if (sequence && LOCATED_OBSERVED.has(sequence.present_status)) return true;
  }
  return false;
}

export function applyEvidenceBindingGate(
  input: EvidenceBindingGateInput,
): EvidenceBindingGateResult {
  const actions: EvidenceBindingGateAction[] = [];

  // Baseline / no-matrix runs: nothing to gate (a no-brief report must not
  // carry a matrix at all; when it does, the matrix-exists trigger below
  // applies in full — the ID-space rule).
  if (!input.matrix) {
    return {
      matrix: null,
      briefAdherenceBreakdown: input.briefAdherenceBreakdown,
      actions,
      applied: true,
    };
  }

  const verificationsById = new Map(
    input.componentVerifications.map((verification) => [verification.requirement_id, verification]),
  );
  const sequencesById = new Map(
    input.observedTapeSequence.map((sequence) => [sequence.id, sequence]),
  );
  const results = Array.isArray(input.matrix.requirement_results)
    ? input.matrix.requirement_results
    : [];

  // R1 over requirement_results — NOT raw verifications. An orphan
  // verification no row references cannot keep a positive verdict.
  const locatedPositiveResults = results.filter(
    (row) =>
      isPositiveAchievement(row.achievement_status) &&
      isLocated(row, verificationsById, sequencesById),
  );

  // R2 — ASSERT-ONLY. Rows that slipped past the normaliser. Scope note:
  // the normaliser's positive branch only emits "achieved" from a PRESENT
  // verification, while its admin-like branch DELIBERATELY emits
  // "partly_achieved"/final_check without tape anchors (file naming, role
  // context — things a tape can never locate). So the slip-detection
  // target is unlocated achieved/mostly_achieved ONLY; flagging
  // partly_achieved would permanently false-positive on deliberate
  // normaliser output (canary A). Record, never rewrite: per-row authority
  // stays with the normaliser; a genuine slip is a bug to fix at source.
  for (const row of results) {
    if (
      (row.achievement_status === "achieved" || row.achievement_status === "mostly_achieved") &&
      !isLocated(row, verificationsById, sequencesById)
    ) {
      actions.push({
        code: "positive_claim_unlocated",
        requirement_id: row.requirement_id ?? null,
        field: "achievement_status",
        from: row.achievement_status,
        to: row.achievement_status, // assert-only: unchanged
        reason:
          "Positive requirement status has no located evidence anchor — slipped past the matrix normaliser; fix at source.",
        not_assessable_reason: "unlocated_claim",
      });
    }
  }

  // R3 — ASSERT-ONLY (the only rule that depends on briefRequirements).
  // The normaliser synthesizes a row per brief requirement; a missing
  // mandatory row means it was bypassed. Record, never synthesize here.
  const resultIds = new Set(results.map((row) => row.requirement_id));
  for (const requirement of input.briefRequirements) {
    if (requirement.importance !== "mandatory") continue;
    if (resultIds.has(requirement.id)) continue;
    actions.push({
      code: "mandatory_requirement_missing_row",
      requirement_id: requirement.id,
      field: "requirement_results",
      from: null,
      to: null,
      reason:
        "Mandatory brief requirement has no requirement_results row — slipped past the matrix normaliser; fix at source.",
      not_assessable_reason: "unlocated_mandatory_requirement",
    });
  }

  // R4 — THE FIX and the gate's only mutations. Positive top-level verdicts
  // require at least one located positive requirement_result row. Fires on
  // the live specimen (positive verdict + requirement_results []) even when
  // an orphan verification exists in evidence, and regardless of whether
  // brief_requirements is empty.
  const verdictSupported = locatedPositiveResults.length > 0;
  const overallPositive =
    input.matrix.overall_status === "achieved" || input.matrix.overall_status === "mostly_achieved";
  const mandatoryClear = input.matrix.mandatory_status === "clear";
  const readinessSupports = input.matrix.readiness_impact === "supports_submission";

  if (verdictSupported || (!overallPositive && !mandatoryClear && !readinessSupports)) {
    // Verdict is supported, or there is no positive verdict to withhold —
    // pass through byte-identical (idempotence + canary-A zero actions).
    return {
      matrix: input.matrix,
      briefAdherenceBreakdown: input.briefAdherenceBreakdown,
      actions,
      applied: true,
    };
  }

  const gatedMatrix: BriefAchievementMatrix = {
    ...input.matrix,
    requirement_results: results,
  };

  if (overallPositive) {
    actions.push({
      code: "matrix_verdict_unsupported",
      requirement_id: null,
      field: "overall_status",
      from: input.matrix.overall_status,
      to: "not_assessable",
      reason: EVIDENCE_BINDING_GATE_WITHHELD_SUMMARY,
    });
    gatedMatrix.overall_status = "not_assessable";
  }
  if (mandatoryClear) {
    actions.push({
      code: "matrix_verdict_unsupported",
      requirement_id: null,
      field: "mandatory_status",
      from: input.matrix.mandatory_status,
      to: "not_assessable",
      reason: EVIDENCE_BINDING_GATE_WITHHELD_SUMMARY,
    });
    gatedMatrix.mandatory_status = "not_assessable";
  }
  if (readinessSupports) {
    actions.push({
      code: "matrix_verdict_unsupported",
      requirement_id: null,
      field: "readiness_impact",
      from: input.matrix.readiness_impact,
      to: "not_assessable",
      reason: EVIDENCE_BINDING_GATE_WITHHELD_SUMMARY,
    });
    gatedMatrix.readiness_impact = "not_assessable";
  }
  gatedMatrix.summary = EVIDENCE_BINDING_GATE_WITHHELD_SUMMARY;

  // Breakdown cap: a withheld verdict cannot keep asserting material
  // compliance. Only material_compliance is withdrawn (the brief-material
  // claim); technical/instruction/professionalism signals are untouched.
  let gatedBreakdown = input.briefAdherenceBreakdown;
  if (
    gatedBreakdown &&
    typeof gatedBreakdown === "object" &&
    typeof (gatedBreakdown as Record<string, unknown>).material_compliance === "number"
  ) {
    const previous = (gatedBreakdown as Record<string, unknown>).material_compliance as number;
    const existingNote =
      typeof (gatedBreakdown as Record<string, unknown>).note === "string"
        ? ((gatedBreakdown as Record<string, unknown>).note as string)
        : "";
    gatedBreakdown = {
      ...gatedBreakdown,
      material_compliance: null,
      note: existingNote.includes(EVIDENCE_BINDING_GATE_BREAKDOWN_NOTE)
        ? existingNote
        : existingNote
          ? `${existingNote} ${EVIDENCE_BINDING_GATE_BREAKDOWN_NOTE}`
          : EVIDENCE_BINDING_GATE_BREAKDOWN_NOTE,
    };
    actions.push({
      code: "adherence_breakdown_capped",
      requirement_id: null,
      field: "material_compliance",
      from: previous,
      to: null,
      reason: EVIDENCE_BINDING_GATE_BREAKDOWN_NOTE,
    });
  }

  return {
    matrix: gatedMatrix,
    briefAdherenceBreakdown: gatedBreakdown,
    actions,
    applied: true,
  };
}
