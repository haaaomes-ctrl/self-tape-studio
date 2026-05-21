# S9-18H ValidatorTrace, GateTrace and ModelRunTrace Proof-Chain Posture

Status: complete for independent proof-chain posture and partial internal metadata surfacing.

Scope: internal QA architecture contract and first-pass diagnostics for `traces/ValidatorTrace.json`, `traces/GateTrace.json` and `traces/ModelRunTrace.json`.

## 1. Purpose

S9-18H audits the remaining independent proof-chain traces after S9-18G deferred `ScoreTrace` and `TechniqueObservationTrace` promotion.

The goal is to make the current state explicit:

- internal `ValidatorTrace` does not satisfy Level 2;
- internal `GateTrace` does not satisfy Level 2;
- metadata-only `ModelRunTrace` does not satisfy Level 2;
- public scoring remains blocked;
- public technique authority remains blocked;
- public comparison recommendation remains blocked;
- production gates remain blocked;
- Level 2 remains `not_accepted`.

## 2. Non-Goals

S9-18H does not implement public scoring, public technique authority, public comparison winner or recommendation, public report rendering changes, database schema changes, Level 2 acceptance, production gate promotion, Tier 2 duplicate detection or Tier 3 duplicate detection.

It also does not allow raw report prose, render payloads, public payloads, report parity, legacy score traces, legacy technique traces, public UI text or unstructured model text to satisfy validator, gate or model proof-chain gates.

## 3. Current ValidatorTrace State

Current artefact path:

```text
traces/ValidatorTrace.json
```

Current artefact ID:

```text
validator_trace
```

Current producer:

```text
src/server/v3/qa-artifacts-wiring.server.ts::emitValidatorTraceFirstPass
src/server/v3/qa-artifacts-wiring.server.ts::emitQAManifestForAnalysisRun
```

Current schema version:

```text
tapecoach_v3_validator_trace_first_pass_v1
```

Current source inputs:

- pre-finalisation manifest snapshot;
- pre-finalisation `qa/acceptance_metrics.json` snapshot;
- emitted artefact IDs from the current QA finalisation pass.

Current source classification:

```text
internal_validator
```

Current gate status:

```text
insufficient
```

Current blocker:

```text
ValidatorTrace_internal_only
```

Current audit decision:

`ValidatorTrace` remains internal and non-satisfying. It currently checks a small set of manifest/metrics agreements and records stable rule IDs, counts and blocked public statuses, but it does not yet prove a complete independent validation chain with schema validation, referential-integrity validation, public/private leakage proof, render-permission validation, UK English validation and claim/evidence/gate dependency proof.

## 4. Current GateTrace State

Current artefact path:

```text
traces/GateTrace.json
```

Current artefact ID:

```text
gate_trace
```

Current producer:

```text
src/server/v3/qa-artifacts-wiring.server.ts::emitGateTraceFirstPass
src/server/v3/qa-artifacts-wiring.server.ts::emitQAManifestForAnalysisRun
```

Current schema version:

```text
tapecoach_v3_gate_trace_first_pass_v1
```

Current source inputs:

- pre-finalisation manifest snapshot;
- pre-finalisation acceptance metrics snapshot;
- emitted artefact IDs;
- internal public-output permission posture.

Current source classification:

```text
internal_gate_trace
```

Current gate status:

```text
insufficient
```

Current blocker:

```text
GateTrace_internal_only
```

Current audit decision:

`GateTrace` remains internal and non-satisfying. It now records explicit blocked public-output permissions for scores, public named techniques, repertoire claims, comparison recommendations and public report promotion, but it is still an internal gate snapshot. It does not yet prove accepted gate decisions with independent validator rule IDs, release-governance records or product-owner approval records.

## 5. Current ModelRunTrace State

Current artefact path:

```text
traces/ModelRunTrace.json
```

Current artefact ID:

```text
model_run_trace
```

Current producer:

```text
src/server/v3/qa-artifacts-wiring.server.ts::emitModelRunTraceFirstPass
src/server/process-take.server.ts::runProcessTake
```

Current schema version:

```text
tapecoach_v3_model_run_trace_first_pass_v1
```

Current source inputs:

- safe runtime model metadata supplied by `runProcessTake`;
- request status;
- parse status;
- duration, timeout, retry and fallback metadata where available.

Current source classification:

```text
internal_model_run_trace
```

Current gate status:

```text
insufficient
```

Current blocker:

```text
ModelRunTrace_internal_only
```

Current audit decision:

`ModelRunTrace` remains metadata-only and non-satisfying. It records safe per-run metadata and explicitly states that raw prompts, raw responses, secrets and signed URLs are not stored. It does not yet prove every expected model stage with complete provider/model/prompt version metadata, per-stage status, timing, fallback records and independent proof-chain validation.

## 6. Forbidden Proof Sources

Validator, gate and model-run proof cannot be satisfied by:

- raw report prose;
- `reports/raw_report.json`;
- `reports/render_payload.json`;
- `reports/public_report_payload.json`;
- `parity/report_parity_result.json`;
- legacy `ScoreTrace`;
- legacy `TechniqueObservationTrace`;
- public UI text;
- comparison artefacts for ordinary single-take analysis;
- unstructured model text without structured provenance.

Physical artefact emission is not proof-chain satisfaction.

## 7. ValidatorTrace Future Independent Proof Requirements

Future satisfying `ValidatorTrace` promotion requires:

- stable validator rule IDs and rule versions;
- deterministic check version;
- artefact schema and schema-version checks;
- referential-integrity validation across artefacts;
- EvidenceAnchors, TruthStateMap and PublicClaimTrace linkage validation;
- source-classification validation;
- anti-fake evidence validation;
- public/private leakage validation;
- UK English validation where in scope;
- render-permission validation where in scope;
- pass, fail, warning, blocked and not-applicable counts;
- affected artefact IDs, claim IDs, gate IDs and blocker IDs where relevant;
- safe summaries with no secrets, raw prompts or raw model responses;
- validator model version only when a validator model was invoked.

## 8. GateTrace Future Independent Proof Requirements

Future satisfying `GateTrace` promotion requires:

- gate registry version;
- stable gate decision IDs;
- explicit decisions for Level 2, production, public scoring, public technique authority, public comparison output and public report rendering;
- evidence artefact IDs used by each decision;
- validator rule IDs used by each decision;
- blocker codes;
- decision source: validator, release governance, product owner or manifest classifier;
- signed or otherwise authorised governance records for human overrides;
- explicit public-output permissions;
- false permissions for public scores, public named techniques and comparison recommendation until gates pass;
- no acceptance from physical artefact emission alone.

## 9. ModelRunTrace Future Independent Proof Requirements

Future satisfying `ModelRunTrace` promotion requires:

- one trace index plus stage-addressable records for every expected model stage;
- analysis Step 1 evidence-pass metadata where invoked;
- analysis Step 2 report-polish metadata where invoked;
- fallback renderer metadata where used;
- brief extraction metadata where invoked;
- validator model metadata where invoked;
- comparison model metadata where invoked;
- model provider, name, version and prompt version where safe and available;
- started and completed timestamps;
- duration, timeout, retry and fallback metadata;
- request status and safe error category;
- explicit skipped or not-applicable records for stages that did not run;
- raw prompt/response storage proof set to false;
- no secrets, headers, cookies, session identifiers, signed URLs or raw storage URLs.

## 10. Manifest and Metrics Requirements

Manifest and acceptance metrics must show:

- `validator_trace` emitted when written, but non-satisfying;
- `validator_trace_gate_status = insufficient`;
- `gate_trace` emitted when written, but non-satisfying;
- `gate_trace_gate_status = insufficient`;
- blocked public-output permissions in gate summaries;
- `model_run_trace` emitted when written, but non-satisfying;
- `model_run_trace_gate_status = insufficient`;
- `raw_prompt_or_response_stored = false` where model-run metadata exists;
- public scoring blocked;
- public technique authority blocked;
- public comparison output blocked;
- production safe blocked;
- Level 2 `not_accepted`.

## 11. Follow-Up Sequence

1. Add schema and referential-integrity validators that operate independently over the emitted QA bundle.
2. Add stage-addressable model-run records for Step 1, Step 2, fallback renderer, validator and comparison stages.
3. Add a gate registry and decision record resolver that references validator rule IDs and artefact IDs.
4. Add public/private leakage, UK English and render-permission validators.
5. Re-run S9-18I real-runtime retest and Level 2 blocker audit.

## 12. S9-18H Decision

S9-18H implements explicit internal proof-chain posture and blocked public-output permissions, but defers satisfying promotion for all three traces.

Final decision:

- `ValidatorTrace`: internal, insufficient, not satisfying.
- `GateTrace`: internal, insufficient, not satisfying.
- `ModelRunTrace`: metadata-only, insufficient, not satisfying.
- Level 2 remains `not_accepted`.
