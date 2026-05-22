# S9-19M Ordinary L2-A Consistency and Internal Gate Reconciliation

## Purpose

S9-19M stays within S9-19 and reconciles the remaining ordinary single-take internal proof path after S9-19L. It does not add media-test automation, public scoring, public named technique authority, public comparison recommendation, production release, customer release, or S10+ scope.

## Post-S9-19L Runtime Blockers

The latest runtime showed one complete 85e-style ordinary path with all five required ordinary evidence families complete, while ordinary L2-A still reported insufficient. It also showed a b464-style path where audio, video and candidate technique completed, but material-specific performance and performance-observable evidence were absent. Comparison parity remained correctly fail-closed on the non-decisive same-video evidence-delta blocker.

## Root-Cause Map

### A. b464 vs 85e Family Inconsistency

The source path accepts compact Step 1 observations and can now promote event-based material/task observations into `material_specific_performance`. The b464-style blocker is therefore not caused by `material_presence = unknown` or `component_or_task_declaration_status = unknown` alone; those context fields should not suppress a safe observed event. The b464-style run remains insufficient only when Step 1 does not return a non-judgemental material/task event such as a slate, scene, song, monologue, dialogue, task component or delivered material segment.

The 85e-style path succeeds when such an event is present and source-linked. S9-19M preserves that path and hardens wording coverage for safe event language without treating brief/material context as event proof.

### B. performance_observable

`performance_observable` can be direct Step 1 evidence or a safe derivation from `material_specific_performance`. When b464-style material performance is missing, performance derivation is also missing. Audio presence, framing visibility, candidate technique, supplied context and judgemental language remain forbidden performance proof. The stable result is: derive performance only from event-based, non-judgemental, Step1/AnalysisEvidenceState-sourced material-performance evidence with truth linkage and anchors; otherwise keep `performance_observable_requires_safe_step1_event_observation`.

### C. PublicClaimTrace / ClaimCandidateTrace

S9-19L fixed the main rendered/internal bug, and current source tests show not-rendered internal traces and candidates excluded from the public-claim gate. S9-19M keeps this as regression coverage: internal diagnostics may remain recorded, but they cannot set `required_for_public_claim_gate = true`, cannot be eligible for public-claim support checks, and cannot contribute to public-claim gate failure. Rendered/promoted public claims remain strict, and public score, technique-authority and comparison-recommendation claims remain blocked/suppressed.

### D. GateTrace / ValidatorTrace

The 85e-style ordinary path can still report `ordinary_l2a_analysis_proof_status = insufficient` because the proof-chain finaliser emits ValidatorTrace and GateTrace from a pre-final metrics snapshot. That snapshot still contains `validator_trace_gate` and `gate_trace_gate` in `ordinary_l2a_unsatisfied_gate_ids`, so ValidatorTrace requires an already-satisfied ordinary status before it can itself satisfy. This is a circular/self-referential blocker, not an evidence-family blocker.

`ValidatorTrace_internal_only` and `GateTrace_internal_only` are release/public boundary labels. They should not block ordinary internal proof when all non-self ordinary gates pass. No-export complete and ordinary comparison not-applicable must also count as satisfying or not-applicable for ordinary single-take L2-A.

### E. Release / Provenance

Deployment provenance remains `unknown_no_safe_env_var_found`, runtime bundle freshness/current implementation remain unconfirmed, and operator confirmation remains missing unless explicitly provided. These states block release readiness, production/customer release and global Level 2 acceptance. They do not block ordinary internal evidence proof when the internal evidence, trace, parity and no-export gates satisfy.

### F. Comparison

The fresh comparison parity shape is correct: same-video duplicate detection suppresses recommendation, public winner/recommendation remain absent, public output remains unchanged, and comparison parity fails closed with `duplicate_same_video_suppressed_without_decisive_evidence_delta`. S9-19M treats comparison as regression-only and does not reopen parity unless tests expose a regression.

## Implementation Decision

- Keep material-specific performance distinct from material/context and require a safe Step 1 event.
- Keep performance-observable derivation limited to safe material-performance events or direct safe performance events.
- Preserve explicit material/performance truth IDs and real-runtime EvidenceAnchors.
- Reconcile ValidatorTrace so ordinary internal validation can satisfy when all non-self ordinary dependencies satisfy.
- Reconcile GateTrace so ordinary internal L2-A can satisfy from internal evidence proof, no-export complete, report parity passed and single-take comparison not-applicable.
- Keep provenance, runtime operator verification, production/customer release and public feature approval as release/global blockers only.

## Expected Result

An 85e-style complete ordinary path can satisfy ordinary internal L2-A in source/tests. A b464-style path remains insufficient only when Step 1 genuinely lacks a safe material/performance event. Global Level 2 remains `not_accepted` while release/provenance/public feature gates are blocked.
