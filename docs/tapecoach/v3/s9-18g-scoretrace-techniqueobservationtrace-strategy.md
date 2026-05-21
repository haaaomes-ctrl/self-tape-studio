# S9-18G ScoreTrace and TechniqueObservationTrace Strategy

Status: complete for audit and deferral strategy.

Scope: internal QA architecture contract for deciding whether `traces/ScoreTrace.json` and `traces/TechniqueObservationTrace.json` can be promoted from legacy/internal-only traces to real runtime v3 proof.

## 1. Purpose

S9-18G audits the score and technique trace families after S9-18F claim support classification.

The goal is to keep the current gate posture truthful:

- `ScoreTrace` remains internal and non-satisfying.
- `TechniqueObservationTrace` remains internal and non-satisfying.
- Public scoring remains blocked.
- Public technique authority remains blocked.
- Level 2 remains `not_accepted`.

This slice does not implement public scoring, public technique authority, candidate-technique extraction, material-performance achievement, brief-achievement judgement or public report rendering changes.

## 2. Current ScoreTrace State

Current artefact path:

```text
traces/ScoreTrace.json
```

Current artefact ID:

```text
score_trace
```

Current producer:

```text
src/server/v3/qa-artifacts-wiring.server.ts::emitScoreTraceFirstPass
src/server/process-take.server.ts::runProcessTake
```

Current schema version:

```text
tapecoach_v3_score_trace_first_pass_v1
```

Current source inputs:

- `reports/raw_report.json` / `raw_report.report_data`.
- Explicit legacy score fields only:
  - `overall_score`;
  - `overall_score_final`;
  - `overall_score_model`;
  - `scores.*`;
  - `detected_components[*].score`;
  - `detected_components[*].weight`;
  - `brief_adherence_breakdown.*`;
  - `confidence`;
  - `consistency_modifier`.
- `PublicClaimTrace` IDs are linked only for diagnostics.

Current source classification:

```text
legacy_adapter
```

Current gate status:

```text
insufficient
```

Current blocker:

```text
ScoreTrace_legacy_only
```

Current public boundary:

- `overall_readiness_public_score_status = blocked`;
- `discipline_attribute_score_trace_status = internal_trace_only`;
- every score entry has `public_display_status = internal_only`;
- every score entry has `cannot_satisfy_v3_gate = true`.

Current audit decision:

ScoreTrace cannot satisfy Level 2 today. It is a legacy report snapshot adapter and has no real runtime scoring proof spine, no evidence-anchor IDs, no explicit truth-state IDs, no selected-level standards linkage, no audition-type linkage, no brief/material linkage, and no independent validator/gate/model proof chain.

## 3. Current TechniqueObservationTrace State

Current artefact path:

```text
traces/TechniqueObservationTrace.json
```

Current artefact ID:

```text
technique_observation_trace
```

Current producer:

```text
src/server/v3/qa-artifacts-wiring.server.ts::emitTechniqueObservationTraceFirstPass
src/server/process-take.server.ts::runProcessTake
```

Current schema version:

```text
tapecoach_v3_technique_observation_trace_v1
```

Current source inputs:

- `reports/raw_report.json` / `raw_report.report_data`.
- Legacy report text fields:
  - `detected_components`;
  - `category_notes`;
  - `category_rationale`;
  - `strengths`;
  - `improvements`;
  - `priority_fixes`;
  - `fix_first`;
  - `brief_adherence_breakdown.note`;
  - `next_take_plan`;
  - `timestamped_notes`.
- `EvidenceAnchors` and `PublicClaimTrace` links are diagnostic only when they match legacy source paths or text.

Current source classification:

```text
legacy_adapter
```

or, for report-only families:

```text
report_snapshot
```

Current gate status:

```text
insufficient
```

Current blocker:

```text
TechniqueObservation_legacy_only
```

Current public boundary:

- each observation has `public_technique_authority_status = blocked`;
- each observation has `observable_basis = legacy_report_snapshot`;
- each observation has `cannot_satisfy_v3_gate = true`;
- each observation carries `legacy_report_snapshot_not_real_runtime_technique_evidence`.

Current audit decision:

TechniqueObservationTrace cannot satisfy Level 2 today. Candidate-technique extraction is not implemented, named technique authority is not approved, and the current trace is derived from raw/report-snapshot fields rather than Step1ObservableEvidence, AnalysisEvidenceState, EvidenceAnchors and explicit TruthStateMap IDs.

## 4. Forbidden Satisfying Sources

Neither future trace may satisfy a gate from:

- raw report prose;
- `reports/raw_report.json`;
- `reports/render_payload.json`;
- `reports/public_report_payload.json`;
- `parity/report_parity_result.json`;
- legacy `ScoreTrace`;
- legacy `TechniqueObservationTrace`;
- public report UI text;
- supplied brief technique names by themselves;
- comparison artefacts for ordinary single-take analysis;
- unstructured model text without structured provenance.

These sources may remain diagnostics, candidate text or legacy adapters. They must not become satisfying proof.

## 5. ScoreTrace Future Promotion Requirements

Future `ScoreTrace` promotion to `real_runtime_v3` requires all of the following:

- score events derived from canonical Step 2 scoring or judgement logic, not legacy raw-report snapshots;
- each score or band linked to selected level, audition type and relevant component/category;
- score evidence linked to `EvidenceAnchors` and explicit `TruthStateMap` IDs;
- score events linked to the Step 1 evidence that justified them;
- no score derived only from report prose;
- calibration metadata kept internal/private;
- public/private leakage proof;
- independent validator/gate proof;
- model-run proof for scoring stages where model-assisted;
- repeated-run and route-variance stability before public scores are considered;
- no public score exposure until the public-scoring gate passes.

Future status vocabulary:

- `missing`;
- `legacy_adapter`;
- `internal_score_snapshot`;
- `real_runtime_v3_partial`;
- `real_runtime_v3_satisfying`;
- `blocked_public_scoring`;
- `deferred`.

## 6. TechniqueObservationTrace Future Promotion Requirements

Future `TechniqueObservationTrace` promotion to `real_runtime_v3` requires all of the following:

- technique observations sourced from `Step1ObservableEvidence`, `AnalysisEvidenceState` and `EvidenceAnchors`, not raw report prose;
- every observation linked to explicit evidence anchors and truth-state IDs where required;
- every technique term classified as `public_named_technique`, `public_safe_descriptor`, `limitation_only`, `internal_shadow` or `blocked`;
- candidate-technique extraction implemented before candidate technique evidence can satisfy;
- technique standard or library linkage for named techniques;
- no technique achievement claim from supplied brief terms alone;
- limitation-only technique observations cannot support performance-achievement claims;
- public/private leakage proof;
- independent validator/gate proof;
- model-run proof for model-assisted technique extraction;
- repeated-run and route-variance stability before public technique authority is considered;
- no public named technique unless public technique authority passes.

Future status vocabulary:

- `missing`;
- `legacy_adapter`;
- `internal_technique_snapshot`;
- `limitation_only_real_runtime_v3`;
- `real_runtime_v3_partial`;
- `real_runtime_v3_satisfying`;
- `blocked_public_technique_authority`;
- `deferred`.

## 7. Dependencies

Both trace families depend on:

- `Step1ObservableEvidence` coverage that is more complete than the current deterministic/media-assessability partial state;
- `AnalysisEvidenceState` remaining the canonical Step 1 handoff;
- `EvidenceAnchors` aggregate support from real runtime v3 anchors;
- explicit `TruthStateMap` IDs, not structural object keys;
- `ClaimCandidateTrace` and `PublicClaimTrace` rejecting unsupported score/technique public claims;
- independent validator, gate and model-run proof chains.

## 8. S9-18G Decision

Decision: defer both `ScoreTrace` and `TechniqueObservationTrace` promotion.

Reason:

- ScoreTrace is still a legacy raw-report score snapshot adapter.
- TechniqueObservationTrace is still a legacy/report-snapshot text adapter.
- Neither trace currently has sufficient evidence-anchor and truth-state linkage to satisfy Level 2.
- Public scoring and public technique authority remain blocked.
- Promoting either trace now would turn report-derived outputs into evidence, violating the S9-18 anti-fake evidence contract.

Follow-up:

S9-18H should address independent `ValidatorTrace`, `GateTrace` and `ModelRunTrace` proof chains before any score or technique authority promotion. A later score/technique implementation slice may return to these trace families once real Step 2 scoring proof and candidate-technique extraction exist.

## 9. Required Regression Posture

Tests must continue to prove:

1. Legacy `ScoreTrace` cannot satisfy public score support.
2. Raw report score fields cannot satisfy ScoreTrace proof.
3. Legacy `TechniqueObservationTrace` cannot satisfy public technique support.
4. Raw report technique wording cannot satisfy TechniqueObservationTrace proof.
5. Supplied brief technique names do not prove observed technique.
6. Limitation-only technique evidence cannot support technique achievement.
7. Public score claims remain blocked.
8. Public technique claims remain blocked.
9. Level 2 remains `not_accepted`.
