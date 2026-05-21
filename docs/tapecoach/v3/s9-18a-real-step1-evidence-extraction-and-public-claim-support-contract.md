# S9-18A Real Step 1 Evidence Extraction and Public Claim Support Contract

**Status:** S9-18A architecture/design contract.  
**Scope:** internal QA evidence-spine architecture only.  
**Controlling source:** `README.md` remains the product, QA, public/private boundary and release decision authority. This document must not override it.

## 1. Purpose

S9-18 defines the architecture for closing the remaining Level 2 evidence-spine blockers after S9-17 report parity closure. It introduces genuine pre-raw-report Step 1 observable evidence and public-claim support from real runtime evidence, not legacy report snapshots.

S9-18A is a design slice. It does not implement video, audio, material, performance or candidate-technique extraction. It does not accept Level 2 and does not unblock public or production gates.

## 2. Non-Goals

S9-18A and the immediate S9-18 implementation sequence must not implement or approve:

- public scoring;
- public technique authority;
- public comparison winner or recommendation output;
- castability, bookability or marketability judgement;
- production-safe release gates;
- Level 2 acceptance by default;
- public output changes;
- public report rendering changes;
- DB schema changes, unless a later audit proves a migration is unavoidable;
- upload, Mux or webhook contract changes;
- Tier 2 near-duplicate sampling;
- Tier 3 normalised media fingerprinting.

## 3. Current S9-18 Finding

S9-17 closed the internal report parity proof path:

- `reports/render_payload.json` emits.
- `reports/public_report_payload.json` emits.
- `parity/report_parity_result.json` passes for complete, safe raw/render/public surfaces.
- `parity_artefacts_missing` clears when report parity truly passes.

That closure does not accept Level 2. The remaining blockers are evidence-spine blockers:

- `AnalysisEvidenceState` is partial and insufficient because it records deterministic runtime facts but not full video, audio, material, performance or candidate-technique observations.
- `EvidenceAnchors` remain insufficient while real observable evidence coverage and truth linkage are incomplete.
- `PublicClaimTrace` remains insufficient when its claims cannot be fully supported by real evidence anchors and explicit truth-state links.
- `ScoreTrace` remains legacy/internal-only.
- `TechniqueObservationTrace` remains legacy/internal-only.
- `ValidatorTrace`, `GateTrace` and `ModelRunTrace` remain internal or metadata-only and do not independently satisfy Level 2.

Report parity, render payloads, public report payloads and raw report prose are forbidden as satisfying Step 1 evidence sources.

## 4. Current `AnalysisEvidenceState` Contract

The current runtime emits `analysis/AnalysisEvidenceState.json` as an internal-only QA artefact.

Current state:

- `evidence_state_status` is `partial` when deterministic runtime facts are available.
- `source_classification` is `real_runtime_v3` for deterministic runtime facts.
- `step2_dependency_status` can be `ready_with_limitations`.
- `observable_evidence_item_count` reflects deterministic runtime facts.
- video, audio, material, performance and candidate-technique evidence is not extracted.
- `unsupported_or_unavailable_evidence` records unavailable extractor families.
- `AnalysisEvidenceState` cannot satisfy the v3/Level 2 gate yet.

Already safe runtime facts include:

- selected performer level;
- audition type or task type where supplied;
- brief/material presence;
- stable run, take and analysis identity;
- media readiness state;
- safe media reference state;
- duration when available;
- ordinary/comparison run-shape facts;
- deterministic truth-map facts and component truth summaries.

Current placeholders or limitations include:

- video observable performance evidence unavailable;
- audio observable performance evidence unavailable;
- material-specific performance evidence unavailable;
- candidate technique evidence unavailable;
- structured truth-state IDs incomplete where the current `TruthStateMap` exposes structural objects but not stable explicit truth IDs for all required links.

Fields that can be populated without model inference:

- media metadata;
- safe upload/media identity;
- material/brief presence metadata;
- resolver-known selected level, task type and comparison applicability;
- component declarations or user/brief supplied component metadata;
- stable explicit truth IDs once the TruthStateMap contract is extended.

Fields that require real extractors:

- framing, eyeline, visibility, face/body visibility and movement observations;
- audibility, clipping, background noise and speech/music balance observations;
- material/component boundary observations;
- candidate technique observations grounded in observable evidence.

Fields that must remain unavailable until later maturity:

- public score evidence;
- public technique authority;
- casting or market-fit judgement;
- claims that require unavailable media or model-assisted observations.

## 5. Extractor Source Options

### A. Deterministic Metadata

Examples:

- Mux or processed media duration;
- file size where safe to record;
- original upload identity;
- media readiness;
- safe media reference presence;
- selected level;
- audition type;
- brief/material presence metadata.

Classification: usable now for runtime facts, with small implementation needed for stricter family coverage and explicit truth linkage.

Limitations:

- deterministic metadata cannot prove performance quality;
- runtime IDs such as take ID, analysis run ID or Mux refs are diagnostic only;
- metadata cannot substitute for observable video/audio evidence.

### B. Media Sampling

Examples:

- opening frame sample;
- mid-tape sample;
- closing frame sample;
- visible face/body/framing sample;
- lighting or visibility sample.

Classification: requires new media processing.

Limitations:

- samples need safe extraction, retention and redaction policy;
- timestamp provenance must be preserved;
- frame-level observations must remain internal QA unless later public gates approve them.

### C. Audio Sampling

Examples:

- opening audio profile;
- closing audio profile;
- audibility;
- clipping or distortion;
- background noise;
- speech/music balance.

Classification: requires new media processing.

Limitations:

- audio extraction needs safe file handling and retention rules;
- speech or music balance must be framed as assessability evidence, not public scoring;
- no public vocal authority may be promoted in S9-18A.

### D. Supplied Brief and Material Resolver

Examples:

- component or task declarations;
- required sides, songs, slate or commercial copy;
- explicit brief requirements;
- material/component boundary expectations.

Classification: usable now for declared facts, with small implementation needed for stricter evidence-family mapping and truth-state linkage.

Limitations:

- supplied metadata proves declaration or requirement, not observed performance;
- inferred compliance must wait for real observable evidence;
- no invented role, product, audience, scene world or style claims.

### E. Model-Assisted Observable Extraction

Examples:

- structured visual observation pass;
- structured audio observation pass;
- structured material/component boundary observation pass;
- constrained candidate-technique observation pass.

Classification: requires model-assisted extraction.

Requirements:

- model output must be persisted as structured evidence, not raw prose;
- each item must include extractor provenance, input refs, timestamps where available and safety limitations;
- raw model text alone must not satisfy evidence gates;
- scoring, public technique authority, castability, bookability and marketability output must be filtered or blocked.

### F. Forbidden Satisfying Sources

These sources are forbidden as satisfying Step 1 observable evidence:

- `reports/raw_report.json` prose or report snapshot fields;
- `reports/render_payload.json`;
- `reports/public_report_payload.json`;
- `parity/report_parity_result.json`;
- legacy `traces/ScoreTrace.json`;
- legacy `traces/TechniqueObservationTrace.json`;
- public report UI;
- report parity status;
- comparison outputs, except for comparison-specific gates;
- model response text without structured extractor output and provenance.

## 6. Step 1 Extractor Architecture

S9-18 should separate extraction from gate aggregation. The extractor should produce structured observable evidence before raw-report judgement, and `AnalysisEvidenceState` should remain the canonical gate/handoff aggregate consumed by EvidenceAnchors and later traces.

### Artefact Container Options

#### Option 1: Introduce `analysis/Step1ObservableEvidence.json` only

Pros:

- clean extractor-output boundary;
- avoids overloading the current `AnalysisEvidenceState` shape;
- easier to version extractor families independently.

Cons:

- existing consumers currently read `AnalysisEvidenceState`;
- would require broader manifest, metrics and trace rewiring;
- risks two competing Step 1 sources unless ownership is strict.

Migration risk: medium.  
Runtime wiring impact: medium.  
Manifest/metrics impact: medium.  
Test impact: medium.

#### Option 2: Extend `AnalysisEvidenceState` only

Pros:

- smallest consumer migration;
- keeps one canonical Step 1 artefact;
- aligns with existing EvidenceAnchors and PublicClaimTrace inputs.

Cons:

- mixes extractor raw output, limitations, family coverage and gate handoff in one object;
- makes provenance and retry semantics harder to isolate;
- future media/model extractor changes may churn the handoff schema.

Migration risk: low.  
Runtime wiring impact: low.  
Manifest/metrics impact: low.  
Test impact: medium.

#### Option 3: Use both, with `Step1ObservableEvidence` feeding `AnalysisEvidenceState`

Pros:

- preserves `AnalysisEvidenceState` as the canonical gate/handoff aggregate;
- gives extractors a dedicated structured output contract;
- makes anti-fake evidence rules easier to validate;
- lets EvidenceAnchors link either to accepted Step 1 items or to the aggregate projection;
- isolates future media/model extraction changes from the existing handoff contract.

Cons:

- introduces one more artefact family;
- requires strict identity and freshness checks between the two artefacts;
- requires manifest and metrics support for both extractor output and aggregate status.

Migration risk: medium.  
Runtime wiring impact: medium.  
Manifest/metrics impact: medium.  
Test impact: medium.

Recommendation: Option 3. Future implementation should introduce `analysis/Step1ObservableEvidence.json` as the extractor output container and project accepted items into `analysis/AnalysisEvidenceState.json`, which remains the canonical Step 1 gate/handoff aggregate.

## 7. Required Evidence Families

### 7.1 `video_observable_performance_evidence`

Examples:

- framing consistency;
- eyeline behaviour;
- visibility and lighting;
- body or face visibility;
- slate presence if visually observed;
- material or scene boundary if visually observed.

### 7.2 `audio_observable_performance_evidence`

Examples:

- audibility;
- clipping or distortion;
- background noise;
- voice/music balance;
- slate audibility if observed;
- vocal intelligibility if observed.

### 7.3 `material_specific_performance_evidence`

Examples:

- supplied material presence;
- scene, song, slate or component boundaries;
- whether requested components appear to be present;
- direct observable evidence rather than raw-report inference.

### 7.4 `candidate_technique_evidence`

Examples:

- technique observations only when grounded in observable evidence;
- private/internal-only candidate technique facts;
- no public authority promotion;
- no scoring;
- no unsupported coaching, casting or market-fit claims;
- no legacy `TechniqueObservationTrace` as a satisfying source.

### 7.5 `structured_truth_state_linkage`

Examples:

- stable truth-state IDs for selected level, brief presence, material presence, media readiness, component status and comparison applicability;
- evidence anchors linking to explicit truth IDs where required;
- structural object keys not treated as truth IDs.

## 8. Source Boundaries

Allowed sources:

- uploaded media metadata;
- safe media reference state;
- original upload identity;
- Mux or media duration;
- extracted visual/audio observations genuinely produced by an extractor;
- supplied brief/material metadata;
- deterministic resolver facts;
- explicitly structured truth-state map entries.

Forbidden satisfying sources:

- raw report prose;
- legacy report snapshots;
- legacy ScoreTrace entries;
- legacy TechniqueObservationTrace entries;
- public report payload;
- render payload;
- report parity result;
- comparison outputs unless the gate is comparison-specific;
- public/UX artefacts;
- model response text without structured extraction proof.

## 9. Extractor Output Contract

Future implementation should emit:

```text
analysis/Step1ObservableEvidence.json
```

Required fields:

- `schema_version`;
- `artefact_type`;
- `run_id`;
- `analysis_run_id`;
- `take_id`;
- `generated_at`;
- `internal_only: true`;
- `privacy_classification: internal_private`;
- `extractor_source_stage`;
- `extractor_source_module`;
- `extractor_model_ref` when model-assisted;
- `extractor_input_refs`;
- `extraction_status`;
- `evidence_family_coverage`;
- `evidence_family_status_by_id`;
- `observable_evidence_items`;
- `unsupported_or_unavailable_evidence`;
- `assessability_limitations`;
- `public_output_unchanged: true`;
- `production_safe_status: blocked`;
- `public_scoring_status: blocked`;
- `public_technique_authority_status: blocked`;
- `cannot_satisfy_public_authority_by_itself: true`.

`AnalysisEvidenceState` should consume accepted Step 1 items and continue to expose aggregate readiness, unsupported families, Step 2 dependency state and gate blockers.

## 10. Observable Evidence Item Contract

Each `observable_evidence_items` entry must include:

- `evidence_item_id`;
- `evidence_kind`;
- `evidence_family`;
- `evidence_modality`;
- `component_id` if known;
- `timestamp` or `timestamp_range` if available;
- `timestamp_source`;
- `source_artefact_id`;
- `source_path`;
- `confidence_or_strength`;
- `safe_evidence_summary`;
- `linked_truth_state_ids` where available;
- `blocker_codes`;
- `assessability_limitations`;
- `public_display_status: internal_only`.

Status vocabulary:

- `resolved_step1_runtime_fact`;
- `resolved_observable_evidence`;
- `blocked_or_limited_runtime_fact`;
- `unavailable_not_extracted`;
- `unsupported_legacy_source`;
- `insufficient_context`.

## 11. Anti-Fake Evidence Rules

S9-18 implementations must enforce:

- raw report prose cannot become observable evidence;
- render payload cannot become observable evidence;
- public report payload cannot become observable evidence;
- report parity result cannot become observable evidence;
- legacy ScoreTrace cannot become satisfying score evidence;
- legacy TechniqueObservationTrace cannot become satisfying technique evidence;
- model text cannot satisfy unless emitted as structured extractor output with input refs and provenance;
- user-facing report text cannot serve as proof of the evidence used to create it.

## 12. EvidenceAnchors Integration

Step 1 evidence becomes `EvidenceAnchors` only after identity, source path and truth-state checks pass.

Rules:

- accepted Step 1 items may become `real_runtime_v3` anchors;
- blocked or limited items remain diagnostic unless the gate permits limitations as support;
- legacy/report snapshot anchors remain excluded from satisfaction;
- timestamped anchors must preserve timestamp source and confidence;
- `source_family_summary.real_runtime_v3` must count real Step 1 anchors truthfully;
- aggregate gate satisfaction requires required family coverage and truth linkage, not just anchor count.

## 13. TruthStateMap Integration

Future S9-18 implementation must add or harden explicit truth IDs.

Required truth families:

- selected level;
- audition type or task type;
- brief presence;
- material presence;
- media readiness;
- component status;
- comparison applicability.

Rules:

- truth IDs must be stable and explicit;
- structural object keys must not count as truth IDs;
- unresolved truth links must be recorded as blockers or limitations;
- ordinary single-take comparison remains `not_applicable`;
- EvidenceAnchors link to truth IDs where required by the gate.

## 14. ClaimCandidateTrace Integration

Claim candidates may be created from:

- accepted Step 1 observable evidence items;
- accepted deterministic runtime facts;
- assessability limitations;
- supported material/brief truth facts.

Legacy raw-report candidates remain excluded from public claim gate satisfaction.

Rules:

- public scoring candidates remain blocked;
- technique-authority candidates remain blocked unless a later public-authority gate approves them;
- castability, bookability and marketability candidates remain blocked;
- claim identity must match `run_id`, `take_id` and `analysis_run_id`;
- claim candidates must link to same-run evidence anchors when promoted.

## 15. PublicClaimTrace Integration

`PublicClaimTrace` can become sufficient only when required public-safe claims have real evidence-anchor and truth-state support.

Support classifications:

- `supported`;
- `partially_supported`;
- `missing_evidence`;
- `missing_truth_state_linkage`;
- `unsupported_overclaim`;
- `legacy_or_unsupported`.

Claim support rules:

- factual runtime/status claims need matching truth-state support;
- assessability limitation claims need corresponding Step 1 limitations;
- material/component claims need material or component evidence plus truth linkage;
- technique claims remain blocked unless a later approved technique-support proof exists;
- score and market-fit claims remain blocked.

The aggregate public-claim gate can become sufficient only when every required public-safe claim type satisfies and blocked categories remain absent.

## 16. ScoreTrace and TechniqueObservationTrace Strategy

S9-18A does not promote ScoreTrace or TechniqueObservationTrace.

Recommended strategy:

- keep current legacy/internal traces blocked for public authority and Level 2 satisfaction;
- decide in a later S9-18 slice whether new real-runtime score or technique proof artefacts are required;
- if implemented later, new proof must consume accepted Step 1 evidence and explicit truth links, not legacy report snapshots.

## 17. ValidatorTrace, GateTrace and ModelRunTrace Strategy

Current validator, gate and model-run traces remain insufficient when they are metadata-only or internal-only.

Independent runtime validator proof would require:

- explicit validator input refs;
- validator result payloads;
- public/private leakage checks;
- UK English and safety checks;
- pass/fail/blocker outputs tied to the same run.

Independent gate proof would require:

- gate inputs;
- gate decisions;
- blocker and dependency evidence;
- clear separation of emitted artefacts from accepted gates.

Independent model-run proof would require:

- per-stage model-run identity;
- input/output provenance safe enough for internal QA;
- structured proof of which model call produced which artefact;
- redaction of prompts, secrets and unsafe payload bodies.

## 18. Public and Private Boundary

All new S9-18 evidence remains internal QA until a separate release decision approves public use.

S9-18 must preserve:

- no public output change;
- no public score;
- no public technique authority;
- no public casting or market-fit judgement;
- no public comparison output;
- production gates blocked;
- Level 2 not accepted unless every required gate truly satisfies.

## 19. Implementation Sequence

### S9-18B - Step1ObservableEvidence / AnalysisEvidenceState Extractor Contract Implementation

Goal:

- emit genuine structured observable evidence container;
- keep all evidence internal-only;
- decide and implement the canonical `Step1ObservableEvidence` to `AnalysisEvidenceState` projection;
- no gate promotion except controlled fixtures proving their specific subgate.

### S9-18C - Deterministic Metadata and Brief/Material Evidence Extraction

Goal:

- populate deterministic non-model facts that can be truthfully extracted now;
- improve component/material/brief presence evidence;
- keep performance evidence unavailable unless genuinely observed.

### S9-18D - Media Observable Extraction Plan or First Narrow Extractor

Goal:

- implement or design the first narrow video/audio observable extractor;
- avoid broad technique or scoring claims;
- preserve internal-only handling and redaction.

### S9-18E - EvidenceAnchors and TruthStateMap Linkage

Goal:

- add stable truth IDs;
- link real observable evidence anchors;
- remove `missing_truth_state_linkage` only where evidence genuinely links.

### S9-18F - ClaimCandidateTrace and PublicClaimTrace Support Classification

Goal:

- support public-safe factual and limitation claims from real evidence anchors;
- keep scores, technique authority, castability, bookability and marketability blocked.

### S9-18G - ScoreTrace / TechniqueObservationTrace Strategy or Deferral Audit

Goal:

- decide whether these traces remain blockers for S9 or move to a later sequence;
- define the minimum Level 2 requirement without promoting legacy traces.

### S9-18H - Validator/Gate/ModelRun Independent Proof Chain

Goal:

- define or implement independent proof for validator, gate and model-run trace families;
- avoid accepting internal metadata-only traces.

### S9-18I - Real-Runtime Retest and Level 2 Blocker Audit

Goal:

- inspect fresh runtime artefacts;
- determine whether Level 2 is still blocked and why;
- keep public and production gates blocked until every required gate satisfies.

## 20. Future Test Matrix

Future implementation slices must cover:

1. `AnalysisEvidenceState` remains partial when extractors are unavailable.
2. `Step1ObservableEvidence` emits internal-only evidence.
3. Video observable evidence cannot be faked from `raw_report`.
4. Audio observable evidence cannot be faked from `raw_report`.
5. Material-specific evidence cannot be faked from `raw_report`.
6. Candidate technique evidence cannot use legacy `TechniqueObservationTrace` as a satisfying source.
7. `render_payload`, `public_report_payload` and `report_parity_result` cannot become satisfying Step 1 evidence.
8. `EvidenceAnchors` count `real_runtime_v3` anchors truthfully.
9. `EvidenceAnchors` exclude legacy/report snapshot anchors from satisfaction.
10. `TruthStateMap` exposes explicit truth IDs.
11. Structural object keys do not count as truth IDs.
12. `ClaimCandidateTrace` rejects mismatched run, take or analysis identity.
13. `PublicClaimTrace` remains insufficient when evidence anchors are insufficient.
14. `PublicClaimTrace` can satisfy only in a controlled complete-support fixture.
15. `ScoreTrace` remains blocked unless real runtime proof exists.
16. `TechniqueObservationTrace` remains blocked unless real runtime proof exists.
17. `ValidatorTrace` and `GateTrace` remain blocked unless independent proof exists.
18. `ModelRunTrace` remains blocked unless an independent proof chain exists.
19. Report parity remains passed from S9-17.
20. No-export remains complete.
21. Ordinary comparison remains `not_applicable`.
22. Duplicate comparison remains suppressed and fail-closed.
23. Public output remains unchanged.
24. Level 2 remains `not_accepted` unless all required gates genuinely satisfy.

## 21. S9-18A Decision

S9-18A is complete when:

- this contract exists and is aligned with README/roadmap posture;
- S9-17 remains closed for report parity;
- no public output, public scoring, public technique authority, comparison output or production gate is promoted;
- tests and build remain green.

Recommended next slice: S9-18B, implementing the internal `Step1ObservableEvidence` extractor container and its projection into `AnalysisEvidenceState`.
