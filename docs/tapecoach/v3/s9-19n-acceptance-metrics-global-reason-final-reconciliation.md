# S9-19N Acceptance Metrics Global Reason Final Reconciliation

## Purpose

S9-19N stays within S9-19 and reconciles `qa/acceptance_metrics.json` with the post-S9-19M runtime shape. The ordinary internal evidence chain can now satisfy for complete runs, but acceptance metrics still reported stale global reasons that implied ordinary proof was incomplete.

This slice does not approve public scoring, public named technique authority, public comparison recommendation, production release, customer release, or global Level 2 acceptance.

## Post-S9-19M Runtime Issue

Fresh S9-19M runtime showed the successful ordinary path with `AnalysisEvidenceState` satisfied, all five ordinary families complete, `EvidenceAnchors` sufficient, PublicClaimTrace and ClaimCandidateTrace non-blocking for internal-only diagnostics, ScoreTrace and TechniqueObservationTrace internally satisfying, ModelRunTrace satisfying, ValidatorTrace and GateTrace no longer blocking ordinary internal proof, report parity passed, and no-export complete.

Despite that, acceptance metrics still included:

- `ordinary internal analysis proof incomplete`
- `qa_acceptance_metrics emitted but does not satisfy evidence gates`
- `raw_report is legacy_adapter where applicable`

Those reasons were correct for older/incomplete runs, but stale for complete ordinary internal proof where only release, provenance, runtime verification, public feature, and customer/production gates remain blocked.

## Root-Cause Map

### A. Acceptance Metrics Stale Ordinary Proof Reason

`buildQAAcceptanceMetrics` already computes `ordinary_l2a_analysis_proof_status` from the ordinary gate list. The stale reason came from the final `acceptance_reasons` taxonomy, which mixed ordinary proof, release blockers, raw report diagnostics, and `qa_acceptance_metrics` self-classification into one list.

The ordinary proof reason must be emitted only when `ordinary_l2a_analysis_proof_status` is not `satisfied`.

### B. Acceptance Metrics Self-Blocking Reason

`qa_acceptance_metrics emitted but does not satisfy evidence gates` was emitted as a top-level acceptance reason regardless of whether the evidence gates satisfied. `qa_acceptance_metrics` is a reconciliation summary; it must not count as satisfying evidence by itself, but its emission is not a blocker when the underlying evidence chain satisfies.

The correct place for this is diagnostic metadata, not global acceptance reasons.

### C. Raw Report Legacy Reason

`raw_report` remains a legacy adapter artefact and is forbidden as satisfying Step 1 evidence. That is diagnostic/non-satisfying artefact metadata when the real runtime evidence spine satisfies.

It should remain an acceptance blocker only if raw report is being used as the required evidence source. S9-19N keeps it as a diagnostic reason for complete ordinary proof.

### D. Ordinary Internal Proof Status

Ordinary internal L2-A proof is derived from current run artefacts:

- Step1ObservableEvidence emitted and classified.
- AnalysisEvidenceState satisfied with all five required families complete.
- TruthStateMap links resolve for required family observations.
- EvidenceAnchors aggregate sufficient.
- PublicClaimTrace and ClaimCandidateTrace exclude internal-only not-rendered diagnostics from the required public claim gate.
- ScoreTrace internal proof satisfies.
- TechniqueObservationTrace internal proof satisfies.
- ModelRunTrace satisfies.
- ValidatorTrace internal proof satisfies.
- GateTrace internal L2-A satisfies.
- Report parity passes.
- No-export proof is complete.
- Ordinary comparison is not applicable for a single-take ordinary run.

If any of these are incomplete, acceptance metrics may report ordinary proof incomplete with exact blockers.

### E. Global Level 2 Status

Global Level 2 remains `not_accepted` while any README-required global/release gates remain blocked:

- Runtime operator verification required or incomplete.
- Runtime bundle freshness/current implementation match unknown or stale.
- Deployment provenance unknown or operator confirmation missing.
- Production safety blocked.
- Customer release blocked.
- Public scoring blocked.
- Public technique authority blocked.
- Public comparison recommendation blocked.
- Comparison Level 2 fail-closed where comparison acceptance is required.

These blockers belong to release/global reasons, not ordinary internal proof reasons.

### F. Comparison

Fresh comparison parity is already correct after S9-19M: same-video comparison suppresses recommendation, prevents false winner output, preserves public output, and fails closed with `duplicate_same_video_suppressed_without_decisive_evidence_delta` instead of `parity_artefacts_missing` when suppression/risk artefacts exist.

S9-19N preserves this as regression coverage only.

## Design Decision

Acceptance metrics now separate:

- `ordinary_internal_proof_status`
- `ordinary_internal_proof_reasons`
- `release_blocker_reasons`
- `diagnostic_reasons`
- `comparison_blocker_reasons`
- `comparison_level2_status`

`acceptance_decision` remains `not_accepted` unless every README-required global gate genuinely satisfies. A complete ordinary internal proof no longer implies release readiness, production safety, customer release, or public feature approval.

## Blockers Closed

- Stale ordinary proof incomplete reason for complete ordinary internal proof.
- `qa_acceptance_metrics` self-blocking reason when evidence gates already satisfy.
- Raw report legacy adapter reason incorrectly appearing as an acceptance blocker for complete real-runtime evidence.

## Blockers Reduced

- Acceptance metrics now report ordinary proof progress independently from global release acceptance.
- Release/provenance/runtime blockers are explicitly grouped as release/global blockers.

## Blockers Remaining

- Runtime operator verification can remain required.
- Runtime bundle freshness/current implementation match can remain unknown.
- Deployment provenance can remain `unknown_no_safe_env_var_found`.
- Production safety remains blocked.
- Customer release remains blocked.
- Public scoring, public technique authority, and public comparison recommendation remain blocked.
- Comparison Level 2 remains fail-closed without decisive evidence-delta/no-material-difference proof.

## Expected Status

For complete ordinary internal proof:

- `ordinary_internal_proof_status`: `satisfied`
- `ordinary_l2a_analysis_proof_status`: `satisfied`
- `global_level2_evidence_status`: `satisfied`
- `global_level2_suppression_proof_status`: `satisfied` when suppression proof satisfies
- `global_level2_release_status`: `blocked`
- `global_level2_acceptance_status`: `not_accepted`
- `acceptance_decision`: `not_accepted`

If ordinary evidence is incomplete, the ordinary proof status remains `insufficient` or `blocked` with exact blockers.

## Next Recommendation

After S9-19N, the next narrow slice should be runtime/operator provenance and release-readiness review only if fresh runtime artefacts and safe operator/deployment metadata are available. Public scoring, named technique authority, comparison recommendation, production release, and customer release must remain separate approvals.
