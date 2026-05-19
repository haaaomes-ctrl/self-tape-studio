# S9-14I PublicClaimTrace Support Gate Contract

Status: design contract, implementation-facing.
Scope: internal QA contract for future `traces/PublicClaimTrace.json` support-gate promotion.
Language: UK English.

`README.md` controls product behaviour, report requirements, scoring rules, QA artefacts, validator gates, public/private boundaries and release decisions. This contract applies the S9-14 real-runtime evidence promotion contract to public claim support. It does not approve public rendering, public scoring, public technique authority, Level 2 or production.

## A. Scope and Non-Goals

S9-14I is design and audit only. It prepares `PublicClaimTrace.json` promotion from legacy report-snapshot tracing to real-runtime claim support.

Non-goals:

- no runtime source implementation;
- no `PublicClaimTrace.json` promotion in this slice;
- no public report output change;
- no public UX or render change;
- no public scoring exposure;
- no public technique authority exposure;
- no public comparison winner, recommendation or output change;
- no castability, bookability or marketability claim;
- no upload, Mux, webhook, database schema or admin comparison button change;
- no S9-12 comparison reconciliation or S9-13 parity/no-export semantic change;
- no Level 2 acceptance;
- no production gate unblocking.

All claim trace records described here are internal QA proof. They do not publish claims and they do not grant render permission.

## B. Current-State Finding

Current implementation state:

- `emitPublicClaimTraceFirstPass` in `src/server/v3/qa-artifacts-wiring.server.ts` emits `traces/PublicClaimTrace.json`.
- The emitter unwraps `raw_report.report_data` and builds claims from report fields such as `submission_verdict`, `verdict_final`, `casting_insight`, `casting_headline`, `fix_first`, `presentation_notes`, scores, `strengths`, `improvements`, `category_notes`, `category_rationale` and `timestamped_notes`.
- Every emitted claim currently has `source_family: legacy_adapter`, `source_artefact_id: raw_report` and a `source_path` under `report_data`.
- Claims may link to matching `EvidenceAnchors`, but legacy anchors do not satisfy the public-claim gate.
- Current claim blockers include `missing_evidence_anchor_support`, `unsupported_overclaim_requires_rewrite`, `generic_phrase_unanchored`, `public_scoring_blocked` and the artefact-level `public_claim_trace_legacy_or_unsupported`.
- `cannot_satisfy_public_claim_gate` remains `true`.
- Manifest and `qa_acceptance_metrics` classify `public_claim_trace` as emitted but insufficient unless the manifest source is `real_runtime_v3` and the subgate is explicitly satisfying.

S9-14H state:

- `AnalysisEvidenceState` persists filtered Step 1 evidence before Step 2.
- Individual deterministic `EvidenceAnchors` can be `real_runtime_v3`.
- The `EvidenceAnchors` aggregate subgate can satisfy in complete-coverage controlled fixtures.
- Current runtime remains aggregate insufficient when Step 1 evidence coverage is partial.
- `PublicClaimTrace` remains `legacy_adapter` and non-satisfying.

No current `ClaimCandidate` artefact or equivalent v3 claim-source stage exists. The only general claim-producing path found in this audit is final report/raw-report data. Therefore PublicClaimTrace promotion cannot truthfully use current raw-report strings as satisfying source.

## C. Real Runtime PublicClaimTrace Definition

A `real_runtime_v3` `PublicClaimTrace` entry is a claim-support record that:

- is generated from a v3 claim candidate or permitted internal claim source, not raw-report snapshot text alone;
- links to one or more `real_runtime_v3` `EvidenceAnchors` where evidence support is required;
- links to resolver or `TruthStateMap` IDs where truth support is required;
- classifies support and public safety status;
- blocks or marks `rewrite_required` for unsafe, unsupported or forbidden claims;
- records blocker codes and safe diagnostics;
- remains internal QA evidence and does not itself render a public claim.

`real_runtime_v3` claim support is narrower than public output permission. A supported internal claim may still be hidden from public output until GateTrace and render permissions separately allow it.

## D. PublicClaimTrace Schema

Future promoted `PublicClaimTrace` artefacts must include these top-level fields:

- `schema_version`;
- `artefact_type: public_claim_trace`;
- `run_id`;
- `analysis_run_id`;
- `generated_at`;
- `internal_only: true`;
- `privacy_classification: internal_private`;
- `source_classification`;
- `claim_count`;
- `claims`;
- `claim_source_summary`;
- `support_gate_status`;
- `public_claim_gate_status`;
- `public_claim_gate_reason`;
- `blocker_codes`;
- `cannot_satisfy_public_claim_gate`;
- `production_safe_status`;
- `public_scoring_status`;
- `public_technique_authority_status`.

Each claim entry must include:

- `claim_id`;
- `claim_text` or `safe_claim_summary`;
- `claim_type`;
- `claim_family`;
- `source_artefact_id`;
- `source_path`;
- `source_family`;
- `linked_evidence_anchor_ids`;
- `linked_truth_state_ids`;
- `support_status`;
- `public_safety_status`;
- `rewrite_required`;
- `score_scope`;
- `blocked_claim_category`;
- `blocker_codes`;
- `evidence_support_summary`;
- `truth_support_summary`;
- `public_display_status`;
- `cannot_satisfy_public_claim_gate`.

Canonical metadata must be emitter-controlled. Caller payloads must not override schema, IDs, privacy, source classification, gate status, blocker codes or Level 2 satisfaction.

## E. Allowed Claim Source Model

Allowed future sources for `real_runtime_v3` claim support:

- a v3 `ClaimCandidate` artefact, if created;
- render-eligible internal claim candidates generated after Step 2 judgement but before public render;
- `AnalysisEvidenceState`-derived claim candidates only for factual status or limitation claims;
- `EvidenceAnchors`-derived claim candidates only for evidence summaries and limitations;
- resolver or `TruthStateMap` status claims.

Legacy or blocked sources:

- raw `raw_report` or `report_data` direct strings;
- `report_data.submission_verdict`;
- `report_data.fix_first`;
- `report_data.category_notes`;
- `report_data.strengths`;
- `report_data.casting_headline`;
- `report_data.casting_insight`;
- `report_data.overall_score`, `overall_score_final`, `overall_score_model` or `scores`;
- rendered public payload, except for parity validation and never as claim support source.

Raw report text may be a downstream output to validate against a supported claim candidate, but it cannot be the satisfying source of the claim trace.

## F. Claim Categories and Required Support

### 1. Readiness or Status Claim

Examples:

- submit, retake or not assessable;
- readiness headline;
- limitation-aware readiness status.

Required support:

- real evidence anchors;
- truth state for run shape, media readiness and limitations;
- no score wording;
- no overconfident casting, booking, recall or outcome language.

Current raw-report verdict strings remain legacy until regenerated or validated through a v3 claim pipeline.

### 2. Brief or Task Status Claim

Examples:

- brief supplied, not supplied or unavailable;
- achieved, partly achieved, not achieved or not assessable.

Required support:

- resolver or `TruthStateMap` brief facts;
- material or brief evidence anchors;
- no role-fit, casting-fit, marketability, bookability or castability wording.

### 3. Priority-Fix or Next-Take Claim

Required support:

- real evidence anchors for the observed limitation;
- truth state for assessability where relevant;
- actionable wording;
- no raw-report copy treated as satisfying source.

Final report prose such as `fix_first` or `next_take_plan` may be checked for parity later, but the satisfying support source must be a v3 claim candidate linked to real anchors.

### 4. Strength or Preserve Claim

Required support:

- real evidence anchors;
- no score-like wording;
- no public technique authority;
- no market, casting, booking, recall or outcome language.

Generic praise such as `strong`, `natural` or `great energy` remains `rewrite_required` unless the v3 claim pipeline turns it into a specific supported claim.

### 5. Assessability Limitation Claim

Required support:

- media readiness, evidence-family coverage or limitation anchor;
- truthful limitation text.

Limitation-only claims may be supported when linked to a real limitation anchor, even if other claim families remain blocked. This does not make the whole PublicClaimTrace aggregate sufficient unless required claims are also supported or truthfully excluded.

### 6. Technical or Media Claim

Required support:

- media, video, audio or material evidence anchor;
- safe source summary;
- no public technique authority unless separately permitted.

### 7. Score or Verdict Claim

Score or score-like public claims are blocked for the public-claim gate unless a future public scoring gate accepts them.

Required classification:

- `support_status: blocked`;
- `public_safety_status: blocked`;
- `rewrite_required: true`;
- `blocked_claim_category: public_scoring`;
- blocker code `public_scoring_blocked`;
- `public_scoring_status: blocked`.

### 8. Technique Authority Claim

Public technique authority is blocked unless a future public technique authority gate accepts it.

Required classification:

- `support_status: blocked` or `rewrite_required`;
- `public_safety_status: blocked`;
- blocker code `public_technique_authority_blocked` or current equivalent;
- `public_technique_authority_status: blocked`.

Internal candidate technique observations may support internal QA only. They do not create public technique authority.

### 9. Castability, Bookability or Marketability Claim

Always blocked or `rewrite_required`. It must not satisfy the public-claim gate.

### 10. Public Comparison Winner or Recommendation Claim

Blocked unless a future comparison public-output gate explicitly permits it. It must not satisfy in S9-14.

### 11. Protected-Characteristic, Body or Appearance Claim

Blocked or `rewrite_required` unless clearly safe, user-supplied and permitted by `README.md`. Such claims require explicit safety validation and must not rely on inferred appearance, body, access, class, race, age, disability, gender or marketability.

## G. Support Status Model

Allowed statuses:

- `supported`;
- `partially_supported`;
- `missing_evidence`;
- `missing_truth_link`;
- `blocked`;
- `rewrite_required`;
- `unsupported_overclaim`;
- `legacy_or_unsupported`;
- `not_applicable`.

Status meanings:

- `supported` requires all required real evidence and truth links plus a safe claim category.
- `partially_supported` cannot satisfy the aggregate gate.
- `missing_evidence` cannot satisfy.
- `missing_truth_link` cannot satisfy where truth linkage is required.
- `blocked` cannot satisfy.
- `rewrite_required` cannot satisfy.
- `unsupported_overclaim` cannot satisfy.
- `legacy_or_unsupported` cannot satisfy.
- `not_applicable` may be ignored only when the claim family is truthfully not required for the run shape.

No claim with `cannot_satisfy_public_claim_gate: true` may be counted toward aggregate satisfaction.

## H. Public Safety Status Model

Allowed statuses:

- `internal_only`;
- `safe_for_public_candidate`;
- `needs_rewrite`;
- `unsafe_or_overclaim`;
- `blocked`.

`safe_for_public_candidate` means only that the claim passed support and public-safety preconditions for possible future rendering. It does not mean rendered, user-visible, production-safe or release-approved.

Actual render still requires:

- GateTrace public-output permissions;
- public/private leakage checks;
- UK English and wording checks;
- public scoring and public technique authority gates where relevant;
- render permission enforcement.

## I. Gate Status Rules

`PublicClaimTrace` aggregate may become sufficient only when:

- every claim counted toward support is sourced from `real_runtime_v3` claim candidates or an explicitly equivalent runtime source;
- every required claim has linked `real_runtime_v3` evidence-anchor support;
- required truth links resolve;
- no blocked claim category is counted as satisfying;
- unsupported, `rewrite_required` and blocked claims are excluded or explicitly non-satisfying;
- legacy raw-report or `report_data` claims are not counted as satisfying;
- source paths and IDs are canonical and same-run;
- diagnostics are safe;
- manifest and `qa_acceptance_metrics` agree.

Aggregate remains insufficient when:

- any required claim remains `legacy_adapter`;
- any required claim lacks evidence-anchor support;
- any required claim lacks truth-state support;
- any score, public-technique-authority, castability, bookability, marketability or comparison-winner claim is not blocked or `rewrite_required`;
- `PublicClaimTrace` still contains only raw-report or `report_data` claim strings;
- claim support cannot be reconciled with the `EvidenceAnchors` aggregate and source-family summary.

`accepted_gate_evidence` must not be assigned globally in this slice. A future implementation may only mark the public-claim support subgate satisfying when validators pass and dependent gates remain independently blocked or accepted according to their own criteria.

## J. Interaction with EvidenceAnchors Gate

`PublicClaimTrace` depends on `EvidenceAnchors` support:

- public claim support must resolve to `real_runtime_v3` anchors;
- legacy anchors cannot support public-claim gate satisfaction;
- `source_scaffold`, helper-test or local-fixture anchors cannot support satisfaction;
- mixed real and legacy anchor support keeps the claim `partially_supported` or `missing_evidence`;
- unresolved anchor IDs block support;
- anchor source paths must resolve into `AnalysisEvidenceState`;
- required truth links must resolve through `TruthStateMap`.

`PublicClaimTrace` cannot fully satisfy while the `EvidenceAnchors` aggregate gate is insufficient, except for explicit limitation-only claim families that link to a real limitation anchor and are not counted as proof for broader report claims. Such limitation support is useful QA evidence, not global public-claim acceptance.

## K. Interaction with Public Output

`PublicClaimTrace` is internal QA proof.

It must not:

- publish a claim;
- alter the render payload;
- alter public report wording;
- change public UX;
- unblock public scoring;
- unblock public technique authority;
- unblock production;
- expose public comparison recommendations.

It may mark a claim `safe_for_public_candidate` only as a future render precondition. GateTrace `public_output_permissions` and render permission enforcement remain required before any public output can change.

## L. Canonical Metadata and Diagnostics Safety

Implementation must enforce:

- caller payload cannot override canonical metadata;
- `run_id`, `analysis_run_id`, `take_id` and source paths are canonical and safe;
- no `take-take-*` identity;
- safe summaries rather than raw private dumps;
- no signed URLs, tokens, secrets or raw Mux URLs;
- no unsafe media refs;
- no full private payload dumps;
- no raw full report text dumps where unsafe;
- no public release implication;
- blocker codes are preserved until cleared by evidence and validation.

Diagnostics may name safe field keys and blocker categories. They must not include raw token values, signed URLs or private user payloads.

## M. Required Implementation Test Matrix for S9-14J

Future implementation must test:

1. legacy raw-report `PublicClaimTrace` remains non-satisfying.
2. raw-report `submission_verdict` claim cannot satisfy.
3. raw-report `fix_first` claim cannot satisfy.
4. raw-report `category_notes` or `strengths` claim cannot satisfy.
5. score claim remains `public_scoring_blocked`.
6. public technique authority claim remains blocked.
7. castability, bookability and marketability claims remain blocked.
8. public comparison winner or recommendation claim remains blocked.
9. unsupported role or brief-fit overclaim remains `rewrite_required`.
10. claim with no linked evidence anchor remains `missing_evidence`.
11. claim with unresolved truth link remains `missing_truth_link`.
12. claim linked only to a legacy anchor remains non-satisfying.
13. limitation claim linked to a real limitation anchor can be supported.
14. brief presence claim linked to `TruthStateMap` and a real anchor can be supported.
15. media readiness limitation claim linked to a real anchor can be supported.
16. priority-fix claim requires real evidence and cannot be a raw-report copy.
17. `safe_for_public_candidate` does not render public output.
18. GateTrace `public_output_permissions` remains required.
19. aggregate remains insufficient while required claims are legacy or unsupported.
20. complete controlled fixture can satisfy the PublicClaimTrace subgate without global Level 2 acceptance.
21. manifest and `qa_acceptance_metrics` align.
22. `EvidenceAnchors` aggregate insufficient prevents full PublicClaimTrace satisfaction except explicit limitation-only cases.
23. canonical metadata cannot be overwritten.
24. diagnostics do not leak signed URLs, tokens or private payloads.
25. public output remains unchanged.
26. Level 2, public and production gates remain blocked.
27. S9-13 parity/no-export regressions remain green.
28. S9-12 comparison regressions remain green.

## N. Implementation Slicing Recommendation

Recommended implementation series:

1. S9-14J: implement PublicClaimTrace support classification skeleton without generating new public claims. It should preserve legacy containment and prove blocked categories, but it should not promote raw-report claims.
2. S9-14K: add a v3 `ClaimCandidate` artefact because the current audited source is raw-report/report-data only.
3. S9-14L: align manifest and `qa_acceptance_metrics` for the public-claim support subgate once ClaimCandidate evidence exists.
4. S9-14M: run the final S9-14 audit across AnalysisEvidenceState, EvidenceAnchors, PublicClaimTrace and gate posture.

Because this audit found no current v3 claim-candidate source, S9-14K is a prerequisite for true PublicClaimTrace promotion even if S9-14J first lands containment and classification tests.

## O. Decision Output

Decision: B. A new v3 `ClaimCandidate` artefact is required before `PublicClaimTrace` promotion.

Rationale:

- current `PublicClaimTrace` claims are generated from `raw_report.report_data`;
- raw-report and final report strings are legacy report snapshots under the S9-14 contract;
- there is no current v3 `ClaimCandidate` artefact or equivalent independent internal claim source;
- supported claims must link to `real_runtime_v3` `EvidenceAnchors` and `TruthStateMap`;
- current runtime may still have partial `EvidenceAnchors` aggregate coverage;
- blocked categories must remain blocked regardless of evidence presence;
- public render permission is separate and remains blocked.

Next implementation should not treat raw-report claim text as satisfying evidence. It should either create the v3 `ClaimCandidate` source first or implement only non-promoting classification guardrails until that source exists.
