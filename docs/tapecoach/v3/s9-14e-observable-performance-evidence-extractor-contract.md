# S9-14E Observable Performance Evidence Extractor Contract

Status: design contract, implementation-facing.
Scope: internal QA contract for the missing Step 1 observable performance evidence extractor.
Language: UK English.

`README.md` controls product behaviour, report requirements, scoring rules, QA artefacts, validator gates, public/private boundaries and release decisions. This document applies the S9-14 real-runtime evidence promotion contract to the missing video, audio, material and technique evidence families needed before aggregate `EvidenceAnchors.json` can truthfully satisfy and before `PublicClaimTrace.json` can be promoted.

## A. Scope and Non-Goals

S9-14E is design and audit only. It defines the extractor contract required before aggregate `EvidenceAnchors.json` can satisfy the evidence-anchor gate.

Non-goals:

- no runtime source implementation;
- no `PublicClaimTrace.json` promotion;
- no Level 2 acceptance;
- no public report output change;
- no public report rendering or UX change;
- no public scoring exposure;
- no public technique authority exposure;
- no public comparison winner, recommendation or output change;
- no castability, bookability or marketability claim;
- no upload, Mux, webhook, database schema or admin comparison button change;
- no S9-12 comparison reconciliation or S9-13 parity/no-export semantic change.

All artefacts described here are internal QA proof until render permissions, public claim gates and public/private boundary validators separately allow use.

## B. Current-State Finding

S9-14D creates item-level `real_runtime_v3` deterministic evidence anchors from `analysis/AnalysisEvidenceState.json` when the source path resolves and canonical metadata matches the run.

Current state:

- `analysis/AnalysisEvidenceState.json` is emitted at `takes/take-[id]/analysis-[analysis_run_id]/analysis/AnalysisEvidenceState.json`.
- `AnalysisEvidenceState` records deterministic runtime facts from input artefacts, resolver output, `TruthStateMap` availability and media readiness.
- Deterministic anchors may be `real_runtime_v3` at item level for facts such as selected level, audition type, brief or material presence, stable take identity, media readiness and safe media-reference presence.
- Truth-map-derived anchors remain blocked when structured truth-state IDs are unavailable.
- `EvidenceAnchors.json` aggregate status remains insufficient because Step 1 evidence coverage is partial.
- `unsupported_or_unavailable_evidence` records `video_observable_performance_evidence_not_extracted`, `audio_observable_performance_evidence_not_extracted`, `material_specific_performance_evidence_not_extracted` and `candidate_technique_evidence_not_extracted`.
- Raw-report timestamped-note anchors remain `legacy_adapter` and carry `cannot_satisfy_v3_gate: true`.
- `PublicClaimTrace.json` remains `legacy_adapter` and non-satisfying.

There is a candidate pre-judgement model path in `src/server/evidence-pass.server.ts` via `runEvidencePass`, invoked from `src/server/process-take.server.ts` when two-step analysis is enabled. That path currently keeps Step 1 evidence in memory for Step 2 and persists only a compact non-sensitive summary into `score_breakdown.two_step`. It is not yet a canonical persisted `AnalysisEvidenceState` performance extractor source. Its output also includes scores, role-fit suggestions and downstream-adjacent fields that must be filtered or split before it can satisfy this contract.

## C. Genuine Step 1 Observable Performance Evidence Definition

Genuine Step 1 observable evidence is produced before `reports/raw_report.json` or Step 2 judgement and records what can be observed, detected or truthfully not assessed. It is not final readiness judgement, public prose or report polish.

Allowed evidence families:

1. Video-observable evidence:
- framing state;
- eyeline state;
- lighting, focus or visibility assessability;
- component or task presence only when observed before judgement;
- movement visibility or camera-crop limitation;
- timestamped observable event when the timestamp source is reliable.

2. Audio-observable evidence:
- audio present or missing;
- intelligibility limitation;
- volume, clipping or noise assessability;
- transcript or lyric availability only when genuinely extracted;
- timestamped audio event when the timestamp source is reliable.

3. Material and brief evidence:
- supplied material presence;
- brief constraint presence;
- component or task declarations;
- material-specific constraints;
- not brief achievement, role fit or casting suitability.

4. Performance observation evidence:
- only when produced by a pre-judgement extractor;
- phrased as observable evidence, not final readiness judgement;
- no score, market fit, casting fit or public technique authority.

5. Candidate technique evidence:
- only pre-judgement observable technique candidates;
- internal only;
- no public technique authority;
- no named authoritative diagnosis unless a separate technique-authority gate approves it.

## D. Forbidden Sources

These sources must not create satisfying Step 1 performance evidence, performance anchors or public claim support:

- `raw_report`;
- `reports/raw_report.json`;
- `raw_report.report_data`;
- `report_data.timestamped_notes`;
- `report_data.strengths`;
- `report_data.fix_first`;
- `report_data.category_notes`;
- `report_data.detected_components`;
- `ScoreTrace.json` when sourced as `legacy_adapter`;
- `TechniqueObservationTrace.json` when sourced as `legacy_adapter`;
- `EvidenceAnchors.json` when sourced as `legacy_adapter`;
- `PublicClaimTrace.json` when sourced as `legacy_adapter`;
- final report output;
- public render payload;
- `score_breakdown.two_step` compact summaries by themselves;
- helper or local fixtures unless explicitly classified as `source_scaffold` and non-satisfying.

The presence of useful wording, timestamps or `public_safe: true` in any forbidden source does not make it `real_runtime_v3`.

## E. Required Extractor Architecture

Preferred architecture, Option 1:

- Add or harden a pre-raw-report Step 1 model/evidence extraction output.
- Persist its accepted, filtered evidence into `analysis/AnalysisEvidenceState.json` before Step 2 judgement and before raw-report-derived trace promotion.
- Step 2 judgement may consume Step 1 evidence.
- Step 1 evidence must never consume Step 2 judgement, raw report text or public render payload.

Fallback architecture, Option 2:

- If the current model call cannot be split or filtered safely, keep `extractor_unavailable` recorded in `AnalysisEvidenceState`.
- Keep aggregate `EvidenceAnchors.json` and public-claim gates non-satisfying.

Architecture rules:

- Step 1 writes before `raw_report`.
- `AnalysisEvidenceState` is the canonical QA handoff for Step 1 evidence.
- Source paths are resolvable into `AnalysisEvidenceState`.
- Source artefact IDs identify the persisted Step 1 family, not downstream reports.
- Canonical `run_id`, `take_id`, `analysis_run_id` and truth-map references must match.
- Downstream report text cannot be backfilled into Step 1.
- Raw model output is not automatically accepted evidence; it must be schema-validated, safety-filtered and classified by family.

Implementation implication: S9-14F should not treat the existing in-memory `runEvidencePass` object as accepted proof merely because it runs before Step 2. It must first persist a filtered, evidence-only Step 1 result or explicitly record that the extractor remains unavailable.

## F. AnalysisEvidenceState Schema Extension

Future implementation should extend `AnalysisEvidenceState` with these top-level fields:

- `video_observable_evidence_items`;
- `audio_observable_evidence_items`;
- `material_observable_evidence_items`;
- `performance_observable_evidence_items`;
- `candidate_technique_evidence`;
- `candidate_brief_evidence`;
- `extraction_source`;
- `extraction_model_run_ref`;
- `extraction_input_refs`;
- `extraction_status`;
- `extraction_limitations`;
- `evidence_family_coverage`;
- `evidence_family_status_by_id`;
- `timestamp_source_status`;
- `cannot_satisfy_v3_gate`.

Each evidence item must include:

- `evidence_item_id`;
- `evidence_family`;
- `evidence_modality`;
- `evidence_kind`;
- `safe_evidence_summary`;
- `source_artefact_id`;
- `source_path`;
- `timestamp` or `timestamp_range`, if available;
- `timestamp_source`;
- `component_id` or task reference, if known;
- `linked_truth_state_ids`;
- `assessability_limitations`;
- `confidence_or_strength`;
- `public_display_status`;
- `blocker_codes`.

Recommended source identifiers:

- `analysis_evidence_state` for anchors sourced from this persisted artefact;
- `analysis_step1_extraction` or equivalent for persisted pre-raw-report extractor output, if separated from `AnalysisEvidenceState`;
- `analysis_submission`, `analysis_take`, `resolver_output` and `truth_state_map` for deterministic runtime facts already represented by S9-14C.

## G. Extraction Status Model

Allowed statuses:

- `complete`;
- `partial`;
- `unavailable`;
- `not_extracted`;
- `unsupported`;
- `failed`;
- `blocked`.

Status meanings:

- `complete` means every evidence family required for the run shape is extracted or truthfully `not_applicable`, with resolvable source paths and required truth linkage.
- `partial` means at least one genuine family is available but at least one required family is missing, unavailable or unresolved.
- `unavailable` means the runtime cannot access a required source family.
- `not_extracted` means the runtime source exists but no extractor currently emits accepted evidence for that family.
- `unsupported` means the run shape, media, material or model path cannot support that family.
- `failed` means extraction attempted but did not produce a usable validated output.
- `blocked` means safety, provenance, identity or validation failure prevents use.

`cannot_satisfy_v3_gate` remains true for `partial`, `unavailable`, `not_extracted`, `unsupported`, `failed` and `blocked` states. It may become false only when full Step 1 evidence coverage is complete and validators agree.

## H. Evidence Family Coverage Contract

Required families for an ordinary single-take run:

- input, submission and take facts;
- resolver and truth facts;
- media readiness facts;
- video observable evidence or an explicit video evidence unavailable reason;
- audio observable evidence or an explicit audio evidence unavailable reason;
- material and brief evidence where supplied;
- component or task declaration status;
- timestamp-source status for any timestamped evidence.

Additional families for comparison-invoked runs:

- comparison invocation facts;
- comparison runtime evidence;
- compared take identity and safe media-reference facts;
- same-video repeatability evidence;
- route-variance evidence;
- suppression/reconciliation evidence.

Aggregate `evidence_anchor_gate_status` may become sufficient only when the required family coverage for the run shape is complete, source paths resolve, identity matches and blockers are cleared by evidence rather than by artefact existence.

## I. Safety and Wording Constraints

Evidence item summaries must:

- be observable;
- avoid final judgement wording;
- avoid `good`, `bad`, `strong` or `weak` unless tied to an allowed observable measure;
- avoid score language and numeric scoring;
- avoid castability, bookability and marketability;
- avoid protected-characteristic, body and appearance judgements;
- avoid public technique authority;
- avoid public comparison winner or recommendation wording;
- avoid signed URLs, tokens, secrets, full private payload dumps and unsafe media references.

Candidate technique evidence must remain internal. It can describe an observable candidate pattern only when sourced from accepted Step 1 evidence and must not claim public authority.

## J. Gate and Manifest Behaviour

`AnalysisEvidenceState` may be `real_runtime_v3` while still partial. In that state:

- `cannot_satisfy_v3_gate = true`;
- `artefact_level2_spine_satisfaction_by_id.analysis_evidence_state = false`;
- `qa_acceptance_metrics.analysis_evidence_state_gate_status = insufficient`;
- `EvidenceAnchors.json` aggregate remains insufficient while required extractor families are missing;
- deterministic anchors may remain item-level `real_runtime_v3`;
- unavailable extractor families do not become satisfying anchors;
- `PublicClaimTrace.json` remains blocked until supported by real anchors and public-claim validators.

Global gates remain unchanged:

- `level2_status` and `level2_qa_acceptance` remain `not_accepted`;
- `production_safe_status` remains `blocked`;
- `public_scoring_status` remains `blocked`;
- `public_technique_authority_status` remains `blocked`.

Manifest and `qa_acceptance_metrics` must agree on source classification, family coverage, blocker codes and subgate status.

## K. Required Implementation Tests for Next Slice

S9-14F implementation must add tests proving:

1. The pre-raw-report extractor writes `performance_observable_evidence_items` before `raw_report`.
2. `raw_report` and `report_data` are not used as Step 1 evidence sources.
3. A video observable evidence item maps to a `real_runtime_v3` evidence anchor.
4. An audio observable evidence item maps to a `real_runtime_v3` evidence anchor.
5. A material observable evidence item maps to a `real_runtime_v3` evidence anchor.
6. Candidate technique evidence remains internal and `public_technique_authority_status` remains blocked.
7. Timestamped evidence requires a reliable timestamp source.
8. A missing extractor family keeps aggregate `evidence_anchor_gate_status` insufficient.
9. Unsupported evidence families are recorded without runtime crashes.
10. Source paths resolve into `AnalysisEvidenceState`.
11. Step 2 cannot run from missing, unreadable, failed or unlinked Step 1 evidence.
12. Public output remains unchanged.
13. Global Level 2, production, public scoring and public technique authority gates remain blocked.

Additional regression tests should keep S9-12 comparison reconciliation and S9-13 parity/no-export proof green.

## L. Decision Output

Is there an existing genuine extractor source?

No accepted persisted extractor source exists yet. The repository has a candidate in-memory pre-judgement path in `runEvidencePass`, but it is not persisted as canonical Step 1 QA evidence and includes score or role-fit-adjacent fields that are not acceptable as public or gate evidence without filtering.

Can S9-14F implement extractor directly?

Not directly as promotion. S9-14F should first split or harden the current model-call flow so accepted observation-only evidence is persisted into `AnalysisEvidenceState` before Step 2 and before `raw_report`. Only after that can S9-14G or a later implementation slice promote performance anchors from the persisted source.

Likely implementation targets:

- `src/server/evidence-pass.server.ts` for the extraction schema, prompt filtering and accepted output contract;
- `src/server/process-take.server.ts` for ordering, persistence and Step 2 dependency enforcement;
- `src/server/v3/qa-artifacts-wiring.server.ts` for `AnalysisEvidenceState` schema population and future anchor mapping;
- `src/server/v3/qa-artifacts.server.ts` for manifest and `qa_acceptance_metrics` alignment;
- `src/server/__tests__/v3-s9-real-runtime-evidence-promotion.test.ts` for S9-14F coverage and regression assertions.

Recommended next prompt:

`RUN XDESIGN-V3-S9-14F-MODEL-CALL-SPLIT-AND-PERSISTED-STEP1-EXTRACTOR-UK`

The next slice should design the safe split or filtered persistence of `runEvidencePass` output into `AnalysisEvidenceState`, keeping all public, Level 2 and production gates blocked.
