# S9-17A Render/Public Payload Report Parity Contract

**Status:** S9-17A design/audit contract.  
**Scope:** internal QA artefact architecture only.  
**Controlling source:** `README.md` remains the product, QA, public/private boundary and release decision authority. This document must not override it.

## 1. Purpose

S9-17 defines internal QA render/public payload artefacts for report parity. The goal is to let report parity compare the raw report, the report data shape used by rendering, and an explicitly public-safe report surface.

This is internal proof work. It is not a public UX change, production release, Level 2 acceptance, public scoring acceptance, public technique authority acceptance, public comparison output, export/share/download enablement, DB schema change, upload/Mux/webhook change, Tier 2 duplicate detection or Tier 3 media fingerprinting.

## 2. Current Finding

Current runtime report parity is correctly insufficient:

- `reports/raw_report.json` is available for the audited run shape.
- `render_payload` is unavailable.
- `public_report_payload` is unavailable.
- `parity/report_parity_result.json` emits an insufficient result and keeps `parity_artefacts_missing`.

That state must remain blocked until the missing surfaces are emitted and checked. Physical emission of a parity artefact is not acceptance.

The current user-facing report source is the persisted take report loaded by the audition route and rendered through the report components. The v2 report renderer consumes the report data shape directly. S9-17 must create QA shadow copies of the relevant render/public-safe surfaces without changing what the user sees.

## 3. Scope

S9-17 covers:

- `render_payload` generation and persistence as an internal QA artefact.
- `public_report_payload` generation and persistence as an internal QA artefact.
- report parity checked surfaces across raw, render and public payloads.
- forbidden-field scanning for public-output boundary enforcement.
- manifest and `qa_acceptance_metrics` alignment.
- no public output change.
- no Level 2 acceptance in the design slice.

## 4. Non-Goals

S9-17A and the immediate S9-17 implementation sequence must not implement:

- public scoring;
- public technique authority;
- public comparison winner or recommendation output;
- production-safe release gates;
- Level 2 acceptance by default;
- DB schema changes;
- export/share/download enablement;
- upload/Mux/webhook contract changes;
- Tier 2 near-duplicate sampling;
- Tier 3 normalised media fingerprinting.

## 5. Required Artefacts

S9-17 proposes the following artefacts:

```text
render/report_render_payload.json
public/report_public_payload.json
parity/report_parity_result.json
```

`parity/report_parity_result.json` already exists and must consume both payload surfaces when they are implemented.

Every S9-17 QA payload copy must be:

- `internal_only: true`;
- `privacy_classification: internal_private`;
- redacted where needed;
- safe from secrets, tokens, signed URLs, raw storage URLs and raw Mux URLs;
- unavailable to public rendering unless a separate product change explicitly authorises it.

## 6. `render_payload` Definition

`render_payload` represents the data shape the current report UI actually receives or would render for the audited run. It is a QA shadow artefact, not a new public response.

It must:

- be produced from the final report data used by the report view;
- include enough structure to compare user-visible report content;
- preserve only fields the current public/report UI is expected to render under the approved boundary;
- exclude internal-only diagnostics;
- exclude raw model prompts and raw model responses;
- exclude secrets, tokens and signed URLs;
- avoid inventing new public fields;
- exclude blocked comparison winner/recommendation output;
- exclude public scoring unless README later permits public scoring.

Audit note: current render components can still reference score-like, category and comparison-adjacent data in existing paths. S9-17 must not widen the public contract merely because a field exists in a legacy or current render source. If a field is not approved for the initial parity allow-list, it must either be omitted from the QA render surface or classified as deferred/internal-only until a separate public boundary decision is made.

## 7. `public_report_payload` Definition

`public_report_payload` represents the explicitly public-safe report surface for parity checks. It should be a sanitised subset of `render_payload` or final report data.

It must:

- include only allowed public/report fields;
- exclude internal/private fields;
- exclude scoring fields;
- exclude technique authority fields;
- exclude castability, bookability and marketability fields;
- exclude comparison fields;
- exclude raw model fields;
- exclude Mux/storage URLs and signed URLs;
- exclude admin and internal QA metadata.

## 8. Initial Allowed Field Model

The initial S9-17 parity allow-list follows the current report parity input unless README is later updated to permit more:

```text
report_data.schema_version
report_data.submission_verdict
report_data.fix_first
report_data.priority_fixes
report_data.strengths
report_data.next_take_plan
report_data.feedback_reliability
```

Classification for S9-17A:

| Field | Initial classification |
|---|---|
| `report_data.schema_version` | allowed for parity identity/version checking |
| `report_data.submission_verdict` | allowed public/report field |
| `report_data.fix_first` | allowed public/report field |
| `report_data.priority_fixes` | allowed public/report field |
| `report_data.strengths` | allowed public/report field |
| `report_data.next_take_plan` | allowed public/report field |
| `report_data.feedback_reliability` | allowed public/report field |

Other currently rendered or persisted fields are not automatically accepted into the initial public-safe parity surface. They need explicit classification as allowed, render-only, public-safe, internal-only or deferred before they can satisfy report parity.

## 9. Forbidden Field Model

The following fields or field families are forbidden in S9-17 render/public QA payload surfaces unless README later permits them:

```text
overall_score
overall_score_final
overall_score_model
overall_readiness
scores
score_trace
public_score
public_scoring
technique_authority
public_technique_authority
technique_observation_trace
castability
bookability
marketability
casting_headline, when it implies castability or marketability
casting_insight, when it is used as market-fit or public authority
comparison
comparison_raw
comparison_report_internal
selected_take_id
selected_winner
winner
recommendation, when it is a comparison recommendation
internal_only fields
QA trace fields
raw prompts
raw model responses
request or response bodies
tokens
secrets
signed URLs
raw Mux URLs
raw storage URLs
```

Forbidden-field scanning must check both the render QA payload and the public-safe payload. A forbidden field in either surface is a failed parity result, not an insufficient result.

## 10. Report Parity Status Model

`not_applicable` is valid only when report parity is genuinely not required for the run shape. Ordinary analysis runs require report parity proof.

`insufficient` applies when:

- raw report data is missing;
- `render_payload` is missing;
- `public_report_payload` is missing;
- checked surfaces are incomplete;
- allowed field paths are malformed or unavailable;
- public output permission context is unavailable.

`failed` applies when:

- allowed public fields drift between raw, render and public surfaces;
- allowed field presence differs between surfaces;
- forbidden fields appear in render or public surfaces;
- payload shape is malformed in a way that could leak unsafe content.

`passed` requires:

- raw report data available;
- `render_payload` available;
- `public_report_payload` available;
- all required allowed fields checked;
- values and presence match according to the contract;
- forbidden fields absent;
- public output boundary checked;
- no score, technique authority, comparison, castability, bookability or marketability leakage.

## 11. Manifest and Metrics Contract

Manifest and `qa_acceptance_metrics` must align:

- `parity_report` is emitted only when `parity/report_parity_result.json` is written.
- `parity_report` is `emitted_blocked` when `parity_status` is `insufficient` or `failed`.
- `parity_report` is `emitted` only when `parity_status` is `passed`.
- `parity_artefacts_missing` remains active for insufficient report parity.
- Failed report parity must keep a blocker that prevents Level 2 satisfaction.
- Physical emission alone must not satisfy Level 2.
- `accepted_gate_evidence` must not include report parity until the passed criteria are met.

## 12. Public Output Boundary

S9-17 implementation must not change public output unless a separate product scope explicitly authorises it. The new payload artefacts are internal proof copies.

The user-facing report UI must not gain:

- public scores;
- public technique authority;
- public comparison recommendations;
- public winner selection;
- castability, bookability or marketability authority;
- export, share or download controls.

## 13. Required Implementation Slices

Recommended sequence:

### S9-17B - Render Payload Shadow Artefact

Emit `render/report_render_payload.json` from the existing report-render source without changing the report UI.

### S9-17C - Public Report Payload and Forbidden-Field Scanner

Emit `public/report_public_payload.json` as a sanitised subset and enforce forbidden-field scanning.

### S9-17D - Report Parity Integration

Feed both payloads into `parity/report_parity_result.json`, align manifest and `qa_acceptance_metrics`, and keep blockers when parity is insufficient or failed.

### S9-17E - Real-Runtime Retest and Closeout

Rerun ordinary single-take and duplicate-comparison runtime evidence. Level 2 remains not accepted unless every required gate truly satisfies.

Tier 2 and Tier 3 duplicate detection remain deferred beyond S9-17.

## 14. Future Test Matrix

Future implementation slices must cover:

1. `render_payload` emits an internal-only QA artefact.
2. `render_payload` mirrors allowed report UI fields.
3. `render_payload` excludes raw prompts, raw responses and secrets.
4. `render_payload` excludes public scoring.
5. `render_payload` excludes public technique authority.
6. `render_payload` excludes public comparison winner/recommendation.
7. `public_report_payload` emits an internal-only QA artefact.
8. `public_report_payload` is a sanitised subset.
9. `public_report_payload` excludes internal/private fields.
10. `public_report_payload` excludes scores.
11. `public_report_payload` excludes technique authority.
12. `public_report_payload` excludes castability, bookability and marketability.
13. `public_report_payload` excludes comparison fields.
14. Report parity is insufficient when `render_payload` is missing.
15. Report parity is insufficient when `public_report_payload` is missing.
16. Report parity fails when an allowed field value drifts.
17. Report parity fails when allowed field presence drifts.
18. Report parity fails when a forbidden field appears.
19. Report parity passes for complete controlled safe surfaces.
20. Failed or insufficient parity remains `emitted_blocked`.
21. Manifest and `qa_acceptance_metrics` align.
22. No-export proof remains complete.
23. Duplicate comparison regression remains green.
24. Ordinary single-take comparison remains not applicable.
25. Public output remains unchanged.
26. Level 2 remains `not_accepted` unless all unrelated gates truly satisfy.

## 15. S9-17A Decision

S9-17A is complete when this contract, README posture and roadmap sequence are aligned and the existing S9 regression matrix remains green. It does not implement either payload surface and does not clear report parity blockers.
