# S9-13D Comparison Parity Proof Contract

Status: design contract, implementation-facing.
Scope: internal QA artefact `parity/comparison_parity.json`, comparison artefact reconciliation, manifest blocker semantics and `qa/acceptance_metrics.json` blocker semantics for comparison-invoked runs.
Language: UK English.

This comparison parity proof contract defines explicit named invariants for S9-13D. Implementation and review should cite this document and `README.md`, not GitHub review comment memory.

## A. Source hierarchy and non-goals

`README.md` wins for product behaviour, QA artefacts, public/private boundaries, scoring rules, gates and release decisions.

Roadmap and delivery documents cannot weaken README gates. They may define sequencing or acceptance evidence only where consistent with README.

This is an internal-only proof. It validates that an explicitly invoked internal comparison is reconciled across comparison artefacts, `manifest.json` and `qa/acceptance_metrics.json`.

Non-goals:

- no public comparison UX;
- no public comparison output;
- no public winner or recommendation;
- no public scoring;
- no public technique authority;
- no public castability, bookability or marketability judgement;
- no DB changes;
- no upload, Mux or webhook changes;
- no admin-button or admin-trigger behaviour changes;
- no global Level 2 acceptance;
- no production/public gate approval.

Comparison artefacts are not emitted automatically for ordinary single-take runs. When internal comparison is explicitly invoked, comparison artefacts, manifest state and `qa_acceptance_metrics` must reconcile together.

## B. Named invariants

- INV-CMP-001 comparisonInvoked uses comparison_run_id, normalised unique compared_take_ids and comparison artefact presence.
- INV-CMP-002 ordinary single-take parity_comparison is not_applicable and non-blocking.
- INV-CMP-003 invoked incomplete evidence emits insufficient proof when identity/context is safe.
- INV-CMP-004 missing/null/empty/uninspectable comparison_payloads cannot pass.
- INV-CMP-005 recursive public scan detects forbidden fields at any depth.
- INV-CMP-006 internal-only lookalike keys do not count as public leakage.
- INV-CMP-007 nested trace risk sources are inspected.
- INV-CMP-008 repeated_input_detected, route_mismatch_detected and route_variance_detected are checked.
- INV-CMP-009 accepted mitigation statuses are honoured.
- INV-CMP-010 explicit unmitigated risk is failed, not insufficient.
- INV-CMP-011 failed/insufficient comparison parity is emitted_blocked/non-satisfying and keeps parity_artefacts_missing.
- INV-CMP-012 manifest and qa_acceptance_metrics blocker_codes align.
- INV-CMP-013 global Level 2/public/production gates remain blocked.
- INV-CMP-014 comparison_parity does not alter public output or public comparison UX.
- INV-CMP-015 recursive scanners are safe for malformed objects, arrays, unexpected scalars and cycles.
- INV-CMP-016 absence of public comparison output is passable only when explicit absence/unchanged evidence exists.
- INV-CMP-017 duplicate compared-take IDs are normalised/deduped before cardinality checks.
- INV-CMP-018 unsafe run/take/analysis/comparison IDs must not be interpolated into artefact paths.
- INV-CMP-019 canonical proof metadata is emitter-controlled and cannot be overridden by caller payload.
- INV-CMP-020 mismatch diagnostics use safe summaries/hashes and do not dump sensitive raw values.

## C. Comparison-invoked truth table

`comparisonInvoked` is derived from:

- `comparison_run_id`;
- the final normalised unique `compared_take_ids` used by manifest and metrics;
- comparison artefact presence, including `emitted` and `emitted_blocked`.

Do not use raw `metadata.compared_take_ids` for cardinality if a normalised compared-take list exists. Prefer the final list carried through the manifest/metrics path, for example `baseOptions.compared_take_ids` after fallback, take-root normalisation and dedupe.

Normalisation rule:

- strip a single leading `take-` prefix where appropriate;
- preserve stable take cores;
- reject blank or unsafe values;
- dedupe before length checks;
- `normalisedUniqueComparedTakeIds.length > 1` means comparison is invoked.

`take_ids` may be used as a fallback source only when a final `compared_take_ids` list is absent, and must go through the same normalisation and dedupe before cardinality is evaluated.

| Input condition | comparisonInvoked | `parity_comparison` result |
|---|---:|---|
| Ordinary single-take, no comparison run id, no comparison artefacts, one or zero normalised unique compared take IDs | false | `not_applicable`, no blocker solely from `parity_comparison` |
| `normalisedUniqueComparedTakeIds.length > 1` | true | required |
| `comparison_run_id` present | true | required |
| Any comparison artefact present as `emitted` or `emitted_blocked` | true | required |
| Duplicate same take listed twice, no `comparison_run_id`, no comparison artefacts | false after dedupe | not comparison-invoked solely by cardinality |

## D. Identity/path safety contract

Rules:

- `parity/comparison_parity.json` pathing must use existing safe segment helpers and the canonical sink abstraction.
- Raw caller IDs must not be interpolated into relative paths without validation.
- Unsafe `comparison_run_id`, `take_id`, `run_id` or `analysis_run_id` means no unintended write.
- Unsafe identity state must classify truthfully as missing, insufficient or blocked according to existing manifest conventions and keep `parity_artefacts_missing`.
- Never create `take-take-*` roots or nested duplicated take roots.

## E. Evidence availability truth table

Required evidence in invoked mode:

- `comparison_raw`;
- `comparison_report_internal`;
- `same_video_repeatability_trace`;
- `comparison_suppression_trace`;
- `route_variance_trace`;
- `comparison_payloads` / `comparison_parity_input` containing inspectable public/risk context.

Rules:

- missing any required evidence in invoked mode yields `parity_status = insufficient` unless a stronger failed risk or public leak exists;
- when safe identity and context exist, physically write an insufficient proof rather than leaving `parity_comparison` absent;
- manifest status must be `emitted_blocked` or an equivalent non-satisfying emitted state;
- `parity_artefacts_missing` remains in both `manifest.json` and `qa/acceptance_metrics.json`;
- write failure remains missing/failure and keeps the blocker;
- physical write is not proof satisfaction.

| Invoked? | Required evidence | Stronger failed risk/leak? | Write possible? | Required result |
|---:|---|---:|---:|---|
| false | any | any | any | `not_applicable` |
| true | complete | true | true | written `failed`, `emitted_blocked`, blocker kept |
| true | incomplete | true | true | written `failed`, `emitted_blocked`, blocker kept |
| true | incomplete | false | true | written `insufficient`, `emitted_blocked`, blocker kept |
| true | complete | false but payload/risk/public context incomplete | true | written `insufficient`, `emitted_blocked`, blocker kept |
| true | complete and context complete | false | true | written `passed`, satisfying for `parity_comparison` only |
| true | any | any | false | missing/failed emission state, blocker kept |

## F. Payload availability contract

`comparison_payloads_available` is true only when `comparison_payloads` is a non-null plain object and contains at least one of:

- an explicit public/output comparison surface object;
- explicit public-output absence/unchanged proof;
- a known risk trace object containing at least one contracted risk, mitigation or no-risk field;
- top-level explicit contracted risk, mitigation or no-risk fields.

These are insufficient:

- absent `comparison_payloads`;
- `null`;
- `{}`;
- scalar payload;
- array-only payload;
- object with only unknown keys;
- object with internal-only evidence but no inspectable public/risk context;
- object with malformed or cyclic content that cannot be safely inspected.

Unknown-only data is not proof. Internal-only diagnostic evidence is useful context, but it cannot by itself satisfy `comparison_payloads_available` unless it contains exact contracted risk/no-risk/mitigation fields under an inspectable source.

## G. Public comparison surface contract

Explicit public/output surfaces:

- `public_comparison_payload`;
- `comparison_public_payload`;
- `public_output`;
- `comparison_output_public`;
- `render_payload.comparison`;
- `public_report_payload.comparison`;
- explicit public comparison surfaces named in `comparison_parity_input`.

A public surface is considered clean only when it is recursively scanned and no forbidden hit is found.

If no public surface is present, the proof may still pass only when there is explicit public-output absence/unchanged evidence, for example:

- `public_comparison_output_absent_or_unchanged === true`;
- `public_output_unchanged === true`;
- `comparison_public_output_absent === true`;
- another explicitly documented equivalent with the same meaning.

If no public surface exists and no explicit absence/unchanged evidence exists, status is `insufficient`, not `passed`. Absence of public surfaces is not the same as clean public surfaces unless explicit absence/unchanged evidence is present.

## H. Internal-only surface contract

Internal-only sources:

- `comparison_raw`;
- `comparison_report_internal`;
- `same_video_repeatability_trace`;
- `comparison_suppression_trace`;
- `route_variance_trace`;
- internal diagnostic summaries.

Internal-only lookalike keys must not count as public leakage:

- `selected_take_id_internal_only`;
- `internal_recommendation_note`;
- `internal_castability_diagnostic`;
- `comparison_result_summary`;
- `comparison_decision_status`;
- `recommendation_suppressed`;
- `suppression_reason`;
- `suppression_reasons`;
- internal winner/recommendation fields.

Do not scan internal-only surfaces for public leakage. Public leakage is evaluated only inside explicit public/output surfaces.

## I. Recursive public-surface scanner

Scan explicit public/output surfaces recursively through objects and arrays.

Scanner requirements:

- match exact path segments, not substrings;
- preserve original diagnostic path and surface name;
- include array indices in diagnostic paths, for example `cards[0].winner`;
- handle malformed values safely;
- handle cycles with visited-object tracking;
- apply a bounded depth limit;
- exceeding the depth limit is insufficient unless an already-detected failed condition exists;
- never scan internal-only surfaces for public leakage.

Forbidden segments:

- `winner`;
- `public_winner`;
- `selected_winner`;
- `selected_take_id_public`;
- `recommendation`;
- `public_recommendation`;
- `comparison_recommendation`;
- `forced_winner`;
- `false_winner`;
- `castability`;
- `bookability`;
- `marketability`;
- `public_scoring`;
- `public_score`;
- `public_technique_authority`;
- `technique_authority`.

## J. Forbidden diagnostics

Define:

- `public_winner_absent`;
- `public_recommendation_absent`;
- `forbidden_public_comparison_fields_absent`.

Rules:

- `public_winner_absent` is false only for winner-family hits in public surfaces.
- `public_recommendation_absent` is false only for recommendation-family hits in public surfaces.
- `forbidden_public_comparison_fields_absent = forbiddenHits.length === 0`.
- Any forbidden hit means `parity_status = failed`.
- Multiple forbidden hits produce multiple mismatch entries.

Winner-family segments:

- `winner`;
- `public_winner`;
- `selected_winner`;
- `selected_take_id_public`.

Recommendation-family segments:

- `recommendation`;
- `public_recommendation`;
- `comparison_recommendation`.

Non-winner forbidden hits such as `public_score`, `public_technique_authority`, `castability`, `bookability` and `marketability` must still make `forbidden_public_comparison_fields_absent` false and fail parity.

## K. Risk source model

Risk extraction must inspect:

- top-level `comparison_payloads`;
- `same_video_repeatability_trace`;
- `route_variance_trace`;
- `comparison_suppression_trace`;
- `comparison_raw` only for explicit contracted risk fields;
- `comparison_report_internal` only for explicit contracted risk fields.

Within known risk trace sources, scan recursively for exact risk/mitigation/no-risk field segments. Do not infer risk from substrings or arbitrary unknown key names.

Risk/no-risk/mitigation fields:

- `forced_winner_risk`;
- `false_winner_risk`;
- `false_winner_prevention_status`;
- `same_video_unresolved_risk`;
- `same_video_detected`;
- `repeated_input_detected`;
- `no_material_difference`;
- `same_video_suppression_status`;
- `same_video_repeatability_status`;
- `route_variance_risk`;
- `route_mismatch_detected`;
- `route_variance_detected`;
- `route_variance_status`;
- `route_variance_mitigation_status`;
- `route_variance_suppression_status`.

Nested trace risk sources have equal precedence to top-level fields.

## L. Risk context completeness

Risk context is inspectable only when `comparison_payloads` includes:

- same-video risk context, or explicit no-same-video-risk status;
- route-variance risk context, or explicit no-route-variance-risk status;
- forced/false-winner risk context, or explicit no-risk/prevention status.

If a required risk family is absent or unknown and no explicit failed condition exists, status is `insufficient`, not `passed`.

Examples of inspectable same-video context:

- `same_video_detected === false`;
- `repeated_input_detected === false`;
- `same_video_repeatability_status === "not_detected"`;
- `same_video_suppression_status === "not_required"`;
- `same_video_detected === true` with accepted mitigation, where that mitigation is allowed by section M.

Examples of inspectable route-variance context:

- `route_variance_detected === false`;
- `route_mismatch_detected === false`;
- `route_variance_status === "not_detected"`;
- `route_variance_risk === false`;
- `route_variance_detected === true` with accepted mitigation, where that mitigation is allowed by section M.

Examples of inspectable forced/false-winner context:

- `forced_winner_risk === false`;
- `false_winner_risk === false`;
- `false_winner_prevention_status` is an accepted safe value and no explicit risk field is true.

## M. Mitigation semantics

Accepted statuses:

- `not_required`;
- `mitigated`;
- `resolved`;
- `accepted`.

Never accepted:

- `unresolved_blocked`;
- `unresolved`;
- `blocked`;
- `failed`;
- `missing`;
- `unknown`;
- `absent`.

Rules:

- missing mitigation does not neutralise detected risk;
- mitigation is risk-family-scoped;
- `same_video_suppression_status` can only mitigate same-video/repeated-input detection-style risks;
- `route_variance_mitigation_status` and `route_variance_suppression_status` can only mitigate route variance detection-style risks;
- `false_winner_prevention_status` is diagnostic/no-risk context but must not neutralise `false_winner_risk === true`;
- `not_applicable` is not accepted for an active detected risk unless the source explicitly states no risk exists;
- explicit unresolved risk fields override ambiguous benign statuses;
- accepted mitigation never neutralises `forced_winner_risk === true` or `false_winner_risk === true`.

## N. Risk classification

Always failed:

- `forced_winner_risk === true`;
- `false_winner_risk === true`;
- `same_video_unresolved_risk === true`;
- `route_variance_mitigation_status === "unresolved_blocked"`.

Failed if unmitigated:

- `same_video_detected === true`;
- `repeated_input_detected === true`;
- `no_material_difference === false` where used as unresolved conflict marker;
- `route_variance_risk === true`;
- `route_mismatch_detected === true`;
- `route_variance_detected === true`.

Accepted mitigation may neutralise:

- `same_video_detected`;
- `repeated_input_detected`;
- `route_variance_risk`;
- `route_mismatch_detected`;
- `route_variance_detected`.

Accepted mitigation must not neutralise:

- `forced_winner_risk === true`;
- `false_winner_risk === true`;
- `same_video_unresolved_risk === true`;
- `route_variance_mitigation_status === "unresolved_blocked"`.

No-risk examples:

- `same_video_detected === false`;
- `repeated_input_detected === false`;
- `same_video_repeatability_status === "not_detected"`;
- `route_variance_detected === false`;
- `route_mismatch_detected === false`;
- `route_variance_status === "not_detected"`;
- `route_variance_risk === false`.

## O. Status precedence

1. `not_applicable` if `comparisonInvoked` is false.
2. `failed` if forbidden public leakage or explicit unmitigated risk exists.
3. `insufficient` if invoked but evidence, payload, risk or public-surface context is missing, malformed, uninspectable or partial.
4. `passed` only if invoked, evidence complete, payload/risk context inspected, public surfaces absent-with-proof or present-and-clean, all risks absent or accepted-mitigated, and no blocker is retained for `parity_comparison`.

Explicit route/same-video risks are `failed`, not `insufficient`.

`emitted`, `emitted_blocked`, physical files and local write success are state transport. They do not by themselves prove parity satisfaction. A non-passed proof remains non-satisfying even when a JSON proof file exists.

## P. Canonical metadata and diagnostics safety

Emitter controls:

- `schema_version`;
- `artefact_type`;
- `run_id`;
- `analysis_run_id`;
- `comparison_run_id`;
- `generated_at`;
- `internal_only`;
- `privacy_classification`;
- `production_safe_status`;
- `public_scoring_status`;
- `public_technique_authority_status`;
- `level2_satisfaction`.

Caller payload must not override these.

Mismatches and diagnostics:

- include field path, surface/source, `mismatch_type` and `risk_type` where applicable;
- use safe summaries or hashes for values;
- do not dump full raw payloads, tokens, signed URLs, secrets or private notes;
- redact unsafe refs if present.

## Q. Gate posture

Always preserve:

- `production_safe_status = blocked`;
- `public_scoring_status = blocked`;
- `public_technique_authority_status = blocked`;
- global Level 2 = `not_accepted` unless all unrelated gates truly satisfy.

Comparison parity may satisfy only its own internal proof when it passes. It does not approve public comparison, production release, public scoring, public technique authority, upload/Mux/webhook behaviour, DB behaviour or global Level 2 acceptance.

## R. Required test matrix

Required named coverage:

- ordinary non-comparison `not_applicable`;
- duplicate same take does not invoke by cardinality alone;
- `take_ids` fallback invokes comparison after dedupe when two unique takes;
- `compared_take_ids` invokes comparison;
- `comparison_run_id` invokes comparison;
- comparison artefact presence invokes comparison;
- unsafe identity/path does not write unintended path and keeps blocker;
- canonical metadata cannot be overridden;
- missing payload insufficient;
- empty payload insufficient;
- unknown-only payload insufficient;
- scalar payload insufficient;
- array-only payload insufficient;
- payload with only internal evidence insufficient unless risk/public context inspectable;
- each missing evidence artefact insufficient;
- complete safe evidence passes;
- explicit public-output absence/unchanged evidence allows pass when no public surface exists;
- missing public surface without absence/unchanged proof is insufficient;
- nested winner leak fails;
- nested recommendation leak fails;
- nested `public_score` leak fails;
- nested `technique_authority` leak fails;
- `castability`/`bookability`/`marketability` leak fails;
- internal-only lookalike keys do not fail;
- recursive scanner handles arrays/cycles/depth guard safely;
- `repeated_input_detected` fails unless mitigated;
- `route_mismatch_detected` fails unless mitigated;
- `route_variance_detected` fails unless mitigated;
- top-level and nested risk fields both work;
- accepted mitigations do not fail;
- cross-family mitigation does not neutralise unrelated risk;
- missing mitigation does fail/block detected risk;
- `forced_winner_risk` and `false_winner_risk` fail even with benign prevention/mitigation status;
- `same_video_unresolved_risk` fails;
- `route_variance_mitigation_status` `unresolved_blocked` fails;
- explicit route/same-video risks are failed, not insufficient;
- failed/insufficient `emitted_blocked` keeps `parity_artefacts_missing`;
- manifest and `qa_acceptance_metrics` align;
- diagnostics do not expose raw sensitive payload values;
- report parity regression remains green;
- no-export regression remains green;
- S9-12 comparison reconciliation remains green;
- gates remain blocked;
- public surface unchanged.
