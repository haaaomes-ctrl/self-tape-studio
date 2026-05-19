# S9-14 Real Runtime Evidence Promotion Contract

Status: design contract, implementation-facing.
Scope: internal QA proof and promotion rules for `traces/EvidenceAnchors.json` and `traces/PublicClaimTrace.json`.
Language: UK English.

This contract defines when first-pass or legacy evidence artefacts may be promoted into `real_runtime_v3` evidence for S9-14. It also defines when they must remain non-satisfying. Implementation and review should cite this document and `README.md`.

`README.md` controls product behaviour, public report requirements, scoring rules, QA artefacts, validator gates, public/private boundaries and release decisions. Planning documents may sequence work, but cannot weaken README constraints.

## A. Scope and Non-Goals

S9-14 is proof and evidence promotion only.

Non-goals:

- no public report output change;
- no public score exposure;
- no public technique authority exposure;
- no Level 2 acceptance;
- no preview-shell work;
- no public comparison output;
- no export, share or download work;
- no upload, Mux or webhook change;
- no database schema change;
- no admin comparison button change;
- no S9-13 parity or no-export semantic change.

S9-14 may define internal QA proof requirements and implementation slices. It must not alter public UX, public report rendering, public comparison behaviour, scoring, public technique authority, Level 2 acceptance, production gates or public gates.

## B. Current-State Classification

Current implementation state:

- `EvidenceAnchors.json` is emitted by `emitEvidenceAnchorsFirstPass` in `src/server/v3/qa-artifacts-wiring.server.ts`.
- `PublicClaimTrace.json` is emitted by `emitPublicClaimTraceFirstPass` in `src/server/v3/qa-artifacts-wiring.server.ts`.
- Both are wired from `runProcessTake` after `raw_report` emission.
- Both currently derive from `raw_report.report_data`, especially legacy timestamped notes and public-ish report fields.
- `EvidenceAnchors.json` carries `source_family: legacy_adapter` on anchors, `cannot_satisfy_v3_gate: true` per anchor and `cannot_satisfy_v3_evidence_anchor_gate: true` at artefact level.
- `PublicClaimTrace.json` carries `source_family: legacy_adapter` on claims, empty `linked_truth_state_ids`, legacy-only evidence links when present and `cannot_satisfy_public_claim_gate: true` at artefact level.
- Manifest callers classify these artefacts as `legacy_adapter` and set `artefact_level2_spine_satisfaction_by_id.evidence_anchors = false` and `artefact_level2_spine_satisfaction_by_id.public_claim_trace = false`.
- `qa_acceptance_metrics` reports emitted traces as insufficient unless their manifest Level 2 satisfaction flag is true.

Classification meanings:

- `legacy_adapter`: derived from legacy report payloads or report snapshots. Useful for QA/debug only. It cannot satisfy v3 evidence gates or public-claim gates.
- `first_pass_internal`: emitted for internal QA before real runtime linkage is proven. It may be inspectable but remains non-satisfying.
- `source_scaffold`: source code, tests or planned emitters exist without accepted runtime bundle proof. It cannot satisfy runtime gates.
- `real_runtime_v3`: emitted from the v3 runtime evidence spine and linked through resolver, truth, evidence, public-claim and gate traces. It can satisfy a subgate only if validators pass.
- `accepted_gate_evidence`: runtime artefacts and validators prove a named gate. This is narrower than `real_runtime_v3` source classification.

Legacy-derived evidence anchors cannot satisfy v3 evidence gates. Legacy-derived public claim traces cannot satisfy the public-claim gate. Raw report snapshots cannot be the v3 evidence spine.

The runtime pipeline has an in-memory Step 1 evidence pass, but there is no current persisted `analysis/AnalysisEvidenceState.json` QA artefact wired as the canonical real Step 1 handoff. Until that or an equivalent persisted runtime evidence source exists, promotion must be blocked.

## C. Real Runtime EvidenceAnchors Contract

A `real_runtime_v3` `EvidenceAnchors.json` artefact must include, at minimum:

- `schema_version`;
- `artefact_type: evidence_anchors`;
- `run_id`;
- `analysis_run_id`;
- `generated_at`;
- `internal_only: true` unless explicitly rendered through a permissioned public path;
- `privacy_classification`;
- `source_classification: real_runtime_v3`;
- `anchor_id` or `evidence_anchor_id`;
- `source_stage`;
- `source_artefact_id`;
- `source_path`;
- `evidence_text` or a safe evidence summary;
- `evidence_modality`, if known;
- `timestamp` or `timestamp_range` where available;
- `timestamp_source`;
- `component_id` or component/task reference where known;
- `linked_truth_state_ids`;
- `linked_public_claim_ids` where applicable;
- `assessability_limitations`;
- `confidence` or `evidence_strength`, if available;
- `public_safe` boolean or `public_display_status`;
- `blocker_codes`;
- `cannot_satisfy_v3_gate`.

`cannot_satisfy_v3_gate` may be false only when all required real-runtime conditions are met:

- the anchor source is persisted Step 1 evidence, `AnalysisEvidenceState` or an equivalent real runtime evidence source;
- the source path is canonical and resolvable;
- the anchor is linked to the same `run_id` and `analysis_run_id`;
- required truth-state linkage resolves through `TruthStateMap`;
- timestamp provenance is truthful;
- evidence text is extracted or safely summarised from runtime evidence, not fabricated or padded;
- validator and gate traces recognise the artefact.

An anchor is disqualified from `real_runtime_v3` when any of these are true:

- `source_family = legacy_adapter`;
- `source_stage` is report snapshot only;
- `source_path` points only to `raw_report.report_data` without Step 1 evidence linkage;
- required `TruthStateMap` linkage is missing;
- public claim linkage is unsupported;
- timestamp source is unverified;
- evidence text is fabricated, padded or copied only to satisfy shape;
- resolver/truth provenance is absent;
- canonical metadata is caller-overridable.

## D. Real Runtime PublicClaimTrace Contract

A `real_runtime_v3` `PublicClaimTrace.json` artefact must include, at minimum:

- `schema_version`;
- `artefact_type: public_claim_trace`;
- `run_id`;
- `analysis_run_id`;
- `generated_at`;
- `internal_only: true`;
- `privacy_classification`;
- `source_classification: real_runtime_v3`;
- `claim_id`;
- `claim_text` or safe claim summary;
- `claim_type`;
- `source_artefact_id`;
- `source_path`;
- `linked_evidence_anchor_ids`;
- `linked_truth_state_ids`;
- `support_status`;
- `public_safety_status`;
- `rewrite_required`;
- `score_scope`;
- `blocked_claim_category` where relevant;
- `blocker_codes`;
- `cannot_satisfy_public_claim_gate`.

`cannot_satisfy_public_claim_gate` may be false only when all required real-runtime conditions are met:

- the claim source is canonical, runtime-produced report or claim-generation state;
- required evidence links resolve to `real_runtime_v3` evidence anchors;
- required truth links resolve to `TruthStateMap`;
- unsupported or unsafe claims are blocked or marked `rewrite_required`;
- blocked public categories remain non-satisfying;
- validator and gate traces recognise the artefact;
- no public/private leakage exists.

Blocked public claim categories:

- score wording or numeric scores;
- public technique authority;
- castability, bookability or marketability;
- public comparison winner or recommendation;
- unsupported role or brief-fit overclaims;
- protected-characteristic, body or appearance claims;
- signed URLs, tokens or secrets;
- internal QA details.

## E. Promotion Rules

`legacy_adapter -> insufficient` remains the default.

Legacy artefacts may stop being insufficient only when:

- the source comes from persisted Step 1, `AnalysisEvidenceState` or equivalent real runtime evidence;
- anchors and claims link to `TruthStateMap` and resolver entries;
- public claims link to at least one `real_runtime_v3` evidence anchor where support is required;
- no forbidden public/private leakage exists;
- validator and gate traces recognise the artefact;
- manifest and `qa_acceptance_metrics` agree.

`first_pass_internal -> real_runtime_v3` is allowed only when:

- runtime source is not raw-report snapshot only;
- source paths are canonical and resolvable;
- `schema_version` is accepted;
- IDs are canonical and do not include malformed `take-take-*` identity;
- unsupported or unsafe claims do not remain satisfying;
- `blocker_codes` are cleared by evidence and validation, not by source existence.

`real_runtime_v3 -> accepted_gate_evidence` is allowed only when:

- validators pass;
- manifest marks the artefact-level subgate satisfaction true;
- `qa_acceptance_metrics` agrees;
- dependent gates remain blocked unless their own conditions pass.

Physical emission is not proof satisfaction. `emitted`, `first_pass_internal`, `legacy_adapter`, `source_scaffold`, `emitted_blocked`, failed or incomplete states remain non-satisfying.

## F. Manifest / Metrics Contract

If `EvidenceAnchors` remains `legacy_adapter`:

- `EvidenceAnchors.json` may be emitted but is non-satisfying;
- `artefact_source_classification_by_id.evidence_anchors = legacy_adapter`;
- `artefact_level2_spine_satisfaction_by_id.evidence_anchors = false`;
- `qa_acceptance_metrics.evidence_anchor_gate_status = insufficient` when emitted;
- blocker or gate reason states legacy or unsupported evidence, for example `legacy_or_non_v3_support_only`.

If `EvidenceAnchors` becomes `real_runtime_v3` but incomplete:

- status must be `emitted_blocked` or emitted non-satisfying according to the current vocabulary;
- `artefact_level2_spine_satisfaction_by_id.evidence_anchors = false`;
- `qa_acceptance_metrics.evidence_anchor_gate_status = insufficient`;
- blocker codes must explain the missing runtime linkage, truth linkage, timestamp provenance or validation failure.

If `EvidenceAnchors` becomes `real_runtime_v3` and complete:

- `artefact_source_classification_by_id.evidence_anchors = real_runtime_v3`;
- `artefact_level2_spine_satisfaction_by_id.evidence_anchors` may become true only for the evidence-anchor subgate;
- `qa_acceptance_metrics.evidence_anchor_gate_status = satisfied`;
- global Level 2 remains not accepted unless every other required gate passes.

Apply equivalent logic for `PublicClaimTrace`:

- legacy claims are emitted but non-satisfying;
- incomplete `real_runtime_v3` claim traces remain insufficient;
- complete claim traces may satisfy only the public-claim support subgate;
- public scoring, public technique authority, production safety and global Level 2 remain blocked unless separately accepted.

Manifest and metrics must align on:

- source classifications;
- artefact-level satisfaction;
- blocker codes;
- emitted versus emitted-blocked state;
- gate status and gate reason.

## G. Public/Private Boundary

S9-14 artefacts are internal QA proof.

Rules:

- no public report rendering change;
- no public claims are newly exposed;
- `PublicClaimTrace` may validate future public claims but does not itself publish them;
- public scoring remains blocked;
- public technique authority remains blocked;
- public comparison output remains unchanged;
- diagnostics must avoid secrets, tokens, signed URLs and raw private evidence dumps.

## H. Validator / Gate Requirements

Required validation checks:

- `schema_version` is present and recognised;
- `run_id` and `analysis_run_id` are canonical and match the current run;
- no `take-take-*` identity is created;
- `source_classification` is valid;
- no `legacy_adapter` artefact is marked satisfying;
- `linked_evidence_anchor_ids` are resolvable;
- `linked_truth_state_ids` are resolvable;
- public claims have evidence support or are blocked and `rewrite_required`;
- blocked claim categories remain blocked;
- safe diagnostics do not include secrets, tokens or signed URLs;
- manifest and `qa_acceptance_metrics` align.

Validators must fail closed. A malformed anchor or claim may not crash finalisation, but it must not satisfy a gate.

## I. Test Matrix

EvidenceAnchors tests:

- legacy_adapter anchors remain non-satisfying.
- raw_report-only anchors cannot become `real_runtime_v3`.
- real runtime anchor with resolver/truth linkage can classify as `real_runtime_v3`.
- missing `TruthStateMap` linkage blocks satisfaction.
- missing timestamp source is truthfully recorded.
- unsupported or fabricated evidence text is blocked.
- malformed anchor cannot crash finalisation.
- canonical metadata cannot be overridden.

PublicClaimTrace tests:

- legacy_adapter claims remain non-satisfying.
- unsupported overclaim remains `rewrite_required`.
- score claim remains `public_scoring_blocked`.
- technique-authority claim remains blocked.
- castability, bookability or marketability claim remains blocked.
- claim with no evidence anchor remains unsupported.
- claim with real anchor and truth linkage can satisfy the claim-support subgate.
- unsafe public claim cannot satisfy even if linked.
- canonical metadata cannot be overridden.

Manifest/metrics tests:

- source classifications align.
- `blocker_codes` align.
- satisfying subgate only when artefact is `real_runtime_v3` and validated.
- global Level 2 remains `not_accepted`.
- `production_safe`, `public_scoring` and `public_technique_authority` remain blocked.

Regression tests:

- S9-12 comparison reconciliation remains green.
- S9-13 parity/no-export remains green.
- public output is unchanged.
- generated churn is cleaned.

## J. Implementation Slicing Recommendation

Recommended implementation series:

1. S9-14A contract tests and legacy containment assertions.
2. S9-14B `real_runtime_v3` `EvidenceAnchors` promotion from actual Step 1 evidence source, if present.
3. S9-14C `real_runtime_v3` `PublicClaimTrace` promotion from supported claims.
4. S9-14D manifest and `qa_acceptance_metrics` subgate alignment.
5. S9-14E full S9-14 audit and readiness for S9-15.

If actual Step 1 or `AnalysisEvidenceState` source is absent:

- do not fake promotion;
- classify as `source_scaffold`, `first_pass_internal` or blocked according to emitted state;
- keep legacy/report-snapshot artefacts non-satisfying;
- produce a prerequisite implementation prompt for emitting real Step 1 evidence.

Prerequisite implementation prompt:

Implement persisted `analysis/AnalysisEvidenceState.json` or an equivalent canonical Step 1 runtime evidence artefact. It must be emitted from the real Step 1 evidence pass, linked to resolver output and `TruthStateMap`, keyed by canonical `run_id`, `take_id` and `analysis_run_id`, and validated before Step 2 or trace promotion may consume it. Do not derive it from `raw_report.report_data`; do not mark any dependent evidence anchor or public claim trace satisfying until manifest and `qa_acceptance_metrics` agree.

