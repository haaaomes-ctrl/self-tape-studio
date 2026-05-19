# S9-14F Model-Call Split and Persisted Step 1 Extractor Contract

Status: design contract, implementation-facing.
Scope: internal QA architecture for persisted Step 1 observable evidence.
Language: UK English.

`README.md` controls product behaviour, report requirements, scoring rules, QA artefacts, validator gates, public/private boundaries and release decisions. This contract builds on the S9-14 promotion contract and the S9-14E observable performance evidence extractor contract.

## A. Scope and Non-Goals

S9-14F is design and audit only. It prepares implementation of the model-call split or hardened evidence pass needed to persist Step 1 observable evidence before Step 2 judgement.

Non-goals:

- no runtime source implementation;
- no `EvidenceAnchors.json` aggregate promotion;
- no `PublicClaimTrace.json` promotion;
- no Level 2 acceptance;
- no public report output change;
- no public UX or render change;
- no public scoring exposure;
- no public technique authority exposure;
- no castability, bookability, marketability or public casting outcome claim;
- no public comparison winner, recommendation or output change;
- no upload, Mux, webhook, database schema or admin comparison button change;
- no S9-12 comparison reconciliation or S9-13 parity/no-export semantic change.

## B. Current-State Finding

`runEvidencePass` exists in `src/server/evidence-pass.server.ts`. It is invoked from `runProcessTake` in `src/server/process-take.server.ts` when `TWO_STEP_ANALYSIS_ENABLED` is enabled.

Current execution order:

- `runEvidencePass` runs before Step 2 report polish.
- `runEvidencePass` receives the media URL and prompt context, then returns an in-memory `EvidencePass`.
- `runReportPolish` in `src/server/report-polish.server.ts` consumes that in-memory `EvidencePass` as a locked evidence block.
- The raw report is created later from the polish result or fallback renderer.
- QA `analysis/AnalysisEvidenceState.json` is currently emitted after the take row is completed and after raw-report emission setup, using deterministic runtime inputs rather than persisted `EvidencePass` output.

Current persistence:

- The full `EvidencePass` object is not persisted.
- Only a compact non-sensitive `score_breakdown.two_step` summary is persisted on the take row.
- Current `AnalysisEvidenceState` records partial `real_runtime_v3` deterministic facts, not full video/audio/material/performance evidence.

Prohibited or judgement-adjacent fields currently present in candidate `EvidencePass` output:

- `detected_components[].score`;
- `raw_scores`;
- `brief_adherence_evidence.score_*`;
- `role_fit_evidence`;
- `role_fit_modifier_suggested`;
- `role_fit_confidence`;
- `fix_first_evidence`;
- `core_strengths_evidence` and `core_improvements_evidence` when used as final report-ready judgement rather than observation support;
- `category_notes_evidence` when used as report-ready judgement;
- `risk_evidence.recall_impact`;
- any fallback report generated directly from `EvidencePass`.

The current Step 1 / Step 2 separation is real in model-call order but incomplete as a release-grade contract. Step 2 currently consumes an in-memory object, not the persisted `analysis/AnalysisEvidenceState.json` required by `README.md`. S9-14G can implement directly by hardening `runEvidencePass` into a persisted Step 1 extractor projection, provided blocked fields are filtered and Step 2 is rewired to consume the persisted projection or a canonical in-memory object produced from the same persisted payload.

## C. Required Architecture

### 1. Step 1 Observable Evidence Extractor

Step 1 must:

- run before `reports/raw_report.json` creation;
- produce observation-only evidence;
- persist `analysis/AnalysisEvidenceState.json` before Step 2 starts;
- include input, resolver, `TruthStateMap` and media readiness references;
- record missing evidence families as unavailable, not fabricated;
- omit final readiness judgement, scores, public claims and report prose.

### 2. Step 2 Judgement

Step 2 must:

- run only after `AnalysisEvidenceState.json` is persisted and linked to the current run;
- consume `AnalysisEvidenceState` plus resolver and `TruthStateMap` evidence;
- produce `reports/raw_report.json`, `ScoreTrace.json`, `TechniqueObservationTrace.json` where relevant, priorities and judgement;
- fail closed or classify blocked when Step 1 is missing, unreadable, failed or unlinked;
- never backfill Step 1 from `raw_report`, report prose or public render payload.

### 3. Claim Tracing

Claim tracing must:

- run after Step 2;
- link report/public claims to evidence anchors sourced from Step 1 and to truth-state entries;
- keep unsupported report claims non-satisfying;
- keep blocked public categories blocked unless their own gates pass.

## D. Option Analysis

### Option 1: Split Existing Model Call

Description:

- Use one pre-call for Step 1 evidence only.
- Use a second call for judgement from persisted Step 1.
- Treat Step 1 and Step 2 as separately persisted stage boundaries.

Targets:

- `src/server/evidence-pass.server.ts`;
- `src/server/report-polish.server.ts`;
- `src/server/process-take.server.ts`;
- `src/server/v3/qa-artifacts-wiring.server.ts`;
- `src/server/v3/qa-artifacts.server.ts`;
- `src/server/__tests__/v3-s9-real-runtime-evidence-promotion.test.ts`.

Risk level: medium. The repo already has two calls, but tests must prove the persisted handoff rather than the in-memory handoff.

Likely test changes:

- Step 1 persistence before Step 2;
- Step 2 blocked when persisted Step 1 is missing or unlinked;
- no raw-report backfill;
- manifest and metrics alignment.

S9-14G suitability: yes. This is the best long-term alignment with `README.md`.

README compliance: compliant when Step 1 is persisted before Step 2 and Step 2 consumes the persisted artefact.

### Option 2: Harden Existing `runEvidencePass`

Description:

- Keep the current pre-raw-report `runEvidencePass` call.
- Filter it into an observation-only Step 1 projection.
- Persist that projection as `AnalysisEvidenceState`.
- Make Step 2 consume the persisted projection or a canonical object derived from the persisted projection.

Targets:

- `src/server/evidence-pass.server.ts` for a safe projection/filter helper;
- `src/server/process-take.server.ts` for write-before-Step-2 ordering and fail-closed dependency checks;
- `src/server/report-polish.server.ts` for consuming the safe persisted Step 1 shape;
- `src/server/v3/qa-artifacts-wiring.server.ts` for AnalysisEvidenceState population;
- `src/server/v3/qa-artifacts.server.ts` for manifest and metrics alignment;
- `src/server/__tests__/v3-s9-real-runtime-evidence-promotion.test.ts` for implementation proof.

Risk level: medium-low if implemented as a projection and dependency contract, not as raw `EvidencePass` persistence.

Likely test changes:

- filter rejects scores, role-fit, fix-first and report-ready prose;
- accepted timestamped observations and assessability limitations persist;
- Step 2 reads only the accepted projection;
- blocked fields appear only in `rejected_or_filtered_fields` or `prohibited_field_filter_summary`.

S9-14G suitability: yes, and it is the recommended implementation route because the candidate extractor already runs before `raw_report`.

README compliance: compliant only if the persisted projection, not the raw `EvidencePass`, is the Step 1 contract.

### Option 3: Keep Unavailable

Description:

- Leave performance/video/audio/material extractor families as unavailable.
- Keep aggregate `EvidenceAnchors.json` insufficient.
- Do not fake extractor coverage.

Targets:

- no runtime change beyond preserving current S9-14C/D behaviour;
- tests continue asserting unavailable families.

Risk level: low for product safety, high for delivery because S9-14 cannot progress to aggregate evidence satisfaction.

Likely test changes:

- none beyond containment regressions.

S9-14G suitability: no. This blocks promotion until a safe extractor path is designed.

README compliance: compliant as a truthful blocked state, but incomplete for Level 2 readiness.

## E. Step 1 Allowed Output Contract

Allowed Step 1 categories:

- media readiness facts;
- audio presence and intelligibility limitations;
- video visibility, framing, lighting, focus and crop assessability;
- material and brief presence facts;
- component and task declaration facts;
- transcript, lyric or material text availability only when genuinely extracted and safe;
- timestamped observable performance events only when generated before judgement;
- candidate technique evidence only as internal observation candidates;
- assessability limitations;
- safe source references and confidence/strength metadata.

Step 1 must not output:

- final readiness verdict;
- submit, retake, recall or booking recommendation;
- numeric scores or score labels;
- casting fit, role fit or market fit;
- public technique authority;
- castability, bookability or marketability;
- public comparison winner or recommendation;
- final priority fixes;
- report prose;
- public render payload text.

## F. `runEvidencePass` Filtering Contract

If `runEvidencePass` is used, implementation must persist only an accepted projection.

Allowed from `runEvidencePass` when pre-judgement and safe:

- `timestamped_evidence[].timestamp` with reliable duration validation;
- `timestamped_evidence[].observation` as observable summary;
- `timestamped_evidence[].linked_category` as internal family hint;
- `presentation_evidence` only when phrased as observable video/framing/visibility evidence;
- `evidence_sufficiency` as assessability limitations;
- non-score component or task presence facts where genuinely observed;
- media/audio/video/material availability facts;
- internal candidate technique labels only when non-authoritative and not public-facing.

Blocked even if present:

- `detected_components[].score`;
- `raw_scores`;
- `brief_adherence_evidence.score_*`;
- readiness labels;
- role-fit, suitability or casting-fit fields;
- `role_fit_modifier_suggested`;
- `role_fit_confidence`;
- brief-achievement judgement;
- marketability, bookability or castability wording;
- public technique authority;
- final `fix_first` or next-take priorities;
- report-ready prose in `core_strengths_evidence`, `core_improvements_evidence` or `category_notes_evidence`;
- public comparison winner or recommendation;
- any field copied from `raw_report` or report snapshots.

Blocked fields should be counted and named in `rejected_or_filtered_fields` and `prohibited_field_filter_summary`, but must not become satisfying evidence.

## G. Persistence Contract

Canonical path:

- `analysis/AnalysisEvidenceState.json`.

Write ordering:

- Step 1 writes `AnalysisEvidenceState.json` before Step 2 starts.
- `raw_report` is written only after Step 2.
- `ScoreTrace`, `TechniqueObservationTrace`, `EvidenceAnchors` and `PublicClaimTrace` must not use raw report data to satisfy Step 1 gates.

Required references:

- same `run_id`, `take_id` and `analysis_run_id` as input, resolver and truth artefacts;
- `input_artifact_refs`;
- `resolver_output_ref`;
- `truth_state_map_ref`;
- media readiness and duration source;
- extractor model/run reference when model evidence is used.

Forbidden references:

- `raw_report`;
- `report_data`;
- `report_data.timestamped_notes`;
- final report fields or public render payloads.

Failure, missing and partial states:

- failed Step 1 extraction writes a blocked or failed `AnalysisEvidenceState` where possible;
- missing/unreadable Step 1 blocks Step 2;
- partial Step 1 may allow Step 2 only when missing families are truthfully recorded and the run shape permits judgement with limitations;
- partial Step 1 cannot make aggregate evidence anchors sufficient;
- failed sink writes must classify authoritative output as `failed_emission` or equivalent before downstream consumption.

Retry and orphan policy:

- retries overwrite the same canonical key;
- retry-suffixed authoritative Step 1 artefacts are not allowed unless manifest declares exactly one authoritative version;
- partial anchors from a failed Step 1 must be deleted or classified as `orphaned_partial_step1_output` / `failed_emission`.

## H. Step 2 Dependency Contract

Step 2 must fail closed or classify blocked when:

- `AnalysisEvidenceState` is missing;
- `AnalysisEvidenceState` is unreadable;
- `AnalysisEvidenceState.source_classification` is unsupported;
- `AnalysisEvidenceState.run_id` or `analysis_run_id` mismatches the current run;
- `take_id` mismatches the current take;
- `truth_state_map_ref` is missing or points to a different run;
- resolver output linkage is missing where required;
- `evidence_state_status` is `failed` or `blocked`;
- required evidence families are unavailable and no truthful limitation path exists;
- the persisted Step 1 artefact contains prohibited public or judgement fields in satisfying evidence arrays.

Step 2 may continue only when:

- `AnalysisEvidenceState` is persisted;
- canonical IDs match;
- resolver and truth refs align;
- missing families are truthfully recorded as unavailable, not fabricated;
- downstream judgement is allowed to work with those limitations;
- manifest and metrics can represent the Step 1 status without implying Level 2 acceptance.

## I. Schema Update Proposal

Add or harden these `AnalysisEvidenceState` fields:

- `extractor_run_id`;
- `extractor_source_module`;
- `extractor_source_stage`;
- `extractor_input_refs`;
- `extractor_model_ref`;
- `extraction_status`;
- `evidence_family_coverage`;
- `evidence_family_status_by_id`;
- `video_observable_evidence_items`;
- `audio_observable_evidence_items`;
- `material_observable_evidence_items`;
- `performance_observable_evidence_items`;
- `candidate_technique_evidence`;
- `candidate_brief_evidence`;
- `rejected_or_filtered_fields`;
- `prohibited_field_filter_summary`;
- `step2_dependency_status`;
- `cannot_satisfy_v3_gate`.

Per-item fields should continue to include:

- `evidence_item_id`;
- `evidence_family`;
- `evidence_modality`;
- `evidence_kind`;
- `safe_evidence_summary`;
- `source_artefact_id`;
- `source_path`;
- `timestamp` or `timestamp_range`;
- `timestamp_source`;
- `component_id` or task reference;
- `linked_truth_state_ids`;
- `assessability_limitations`;
- `confidence_or_strength`;
- `public_display_status`;
- `blocker_codes`.

## J. Safety / Redaction Contract

Step 1 persistence must enforce:

- no signed URLs;
- no tokens or secrets;
- no raw full transcript unless explicitly safe, bounded and classified internal-only;
- no private notes or full private payload dumps;
- no public output text;
- no raw model response dump;
- safe summaries only;
- `internal_only: true`;
- `privacy_classification: internal_private`.

Safe media references may record boolean presence, canonical artefact refs or redacted IDs only. They must not expose raw Mux URLs or signed media URLs.

## K. Required Implementation Test Matrix for S9-14G

S9-14G must add tests proving:

1. Step 1 writes `AnalysisEvidenceState` before `raw_report`.
2. Step 1 output contains no `raw_report` refs.
3. `runEvidencePass`, if used, is filtered to observation-only fields.
4. Score, readiness, role-fit, fix-first and report-prose fields are rejected.
5. Video observable evidence persists when the extractor provides it.
6. Audio observable evidence persists when the extractor provides it.
7. Material observable evidence persists when the extractor provides it.
8. Performance observation evidence persists only if pre-judgement.
9. Missing video, audio and material families are recorded as unavailable, not fabricated.
10. Step 2 blocks if `AnalysisEvidenceState` is missing.
11. Step 2 blocks if `AnalysisEvidenceState.run_id` mismatches.
12. Step 2 blocks if `TruthStateMap` link is missing.
13. Step 2 can proceed with truthful limitations when partial evidence is valid.
14. `EvidenceAnchors` map only from `AnalysisEvidenceState`, not `raw_report`.
15. `PublicClaimTrace` remains non-satisfying until linked support exists.
16. Public output remains unchanged.
17. Level 2, public and production gates remain blocked.
18. Manifest and `qa_acceptance_metrics` align.
19. Generated churn is cleaned before commit.

Regression coverage must include S9-12 comparison reconciliation and S9-13 parity/no-export proof.

## L. Implementation Slicing Recommendation

Recommended slices:

- S9-14G: implement hardened `runEvidencePass` persistence into `AnalysisEvidenceState`, including rejected-field filtering and Step 2 dependency checks.
- S9-14H: promote aggregate `EvidenceAnchors` only if extractor coverage is sufficient and validators agree.
- S9-14I: promote `PublicClaimTrace` from supported claims linked to real runtime anchors and truth states.
- S9-14J: final S9-14 audit for manifest, metrics, public/private boundaries and readiness for later Level 2 audit.

## M. Decision

Decision: A. Use existing `runEvidencePass`, after filtering and persistence.

Rationale:

- `runEvidencePass` already runs before raw report creation and before `runReportPolish`.
- The current two-step flow is separable enough to harden in a small S9-14G slice.
- Raw `EvidencePass` is not acceptable as persisted Step 1 evidence because it contains scores, role-fit-adjacent fields, fix-first evidence and report-ready prose.
- A filtered `AnalysisEvidenceState` projection can comply with `README.md` if it is written before Step 2 and Step 2 is made dependent on that persisted artefact.
- If filtering cannot remove prohibited fields safely during implementation, S9-14G must fall back to `extractor_unavailable` and keep aggregate evidence gates insufficient.

Recommended next prompt:

`RUN XIMPLEMENT-V3-S9-14G-HARDENED-RUNEVIDENCEPASS-PERSISTED-STEP1-EXTRACTOR-UK`
