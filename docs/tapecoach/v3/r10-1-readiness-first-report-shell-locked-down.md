# R10.1 Readiness-First Locked-Down Report Shell

## Purpose

R10.1 is the first user-facing value slice after S9-19 closeout. It does not reopen the S9 evidence spine, comparison parity, public scoring, public technique authority, public comparison recommendation, production release or customer release.

The goal is to render the existing public-safe report fields in a clearer order so a tester can quickly answer:

- whether to submit or retake;
- what to fix first;
- the top action items;
- what to preserve;
- what to do in the next take;
- what could not be assessed.

## Current Public-Safe Content

The current report parity allow-list already permits:

- `report_data.schema_version`
- `report_data.submission_verdict`
- `report_data.fix_first`
- `report_data.priority_fixes`
- `report_data.strengths`
- `report_data.next_take_plan`
- `report_data.feedback_reliability`
- `report_data.brief_requirements`

The existing v2 component renderer can also receive scores, category notes, component scores, risk flags and role-fit fields from the older persisted report shape. Those fields are not needed for R10.1 and are not read by the locked-down shell.

Brief achievement is not a separate permitted public path. R10.2A permits only the neutral `brief_requirements` checklist shape, not broad brief-achievement prose.

## Minimum Shell Decision

The shell renders only:

1. readiness / submit-or-retake summary;
2. fix first;
3. priority fixes;
4. brief requirements, when the public-safe checklist is present;
5. strengths / preserve;
6. next-take checklist;
7. feedback reliability / assessability note and limitations.

Missing fields do not invent content. They render either nothing or a short locked-down unavailable message.

## Safety Boundary

The shell does not consume:

- raw report directly as a display source beyond the already persisted public report object passed by the route;
- Step1ObservableEvidence, AnalysisEvidenceState, TruthStateMap, EvidenceAnchors, PublicClaimTrace, ClaimCandidateTrace, ScoreTrace, TechniqueObservationTrace, ModelRunTrace, RuntimeVerificationTrace or comparison internals;
- scores, category scores, component scores, score breakdowns, role-fit modifiers, named technique authority, comparison winners or recommendations.

The shell also rejects unsafe text that contains obvious public/private boundary terms, including score claims, internal trace IDs, evidence/truth IDs, signed URLs, storage paths, castability, bookability, marketability, employability, role-fit prediction and public named technique-authority markers.

## Product Value

The current safe field set is sufficient for the minimum shell:

- `submission_verdict` answers submit/retake when available;
- `fix_first` answers the highest-priority action;
- `priority_fixes` gives the top 1-3 action items;
- `brief_requirements` shows observed / not observed / not assessable brief items where safe;
- `strengths` gives preserve guidance;
- `next_take_plan` gives practical next-take steps;
- `feedback_reliability` and unavailable section copy explain assessability limits.

## Remaining Blockers

R10.1 does not change release posture:

- global Level 2 remains `not_accepted`;
- runtime/provenance verification remains required;
- production and customer release remain blocked;
- public scoring remains blocked;
- public named technique authority remains blocked;
- public comparison recommendation remains blocked.

## R10.1B Payload Normalisation Note

R10.1B keeps the same public-safe field set and does not add brief-achievement, score, technique-authority, comparison, role-fit or release fields.

### Existing Payload Shape

- `submission_verdict` can be a string or object-like value with labels, status and reason fields.
- `fix_first` is usually a string, but the shell defensively accepts a small object-like action shape.
- `priority_fixes` and `strengths` can be arrays of strings or object-like rows; empty, generic or unsafe rows are ignored.
- `next_take_plan` can be an array, a single string, or an object with `steps` / `groups`.
- `feedback_reliability` can be a string or object-like value with a label, reason and limitation list.
- Any of those fields can be missing, null, empty or malformed, so display must fail closed to concise unavailable copy.

### Shell Usability

The R10.1B shell is ordered around the minimum tester questions:

1. readiness;
2. fix first;
3. priority fixes;
4. keep / preserve;
5. next take plan;
6. reliability / limitations.

Brief achievement is omitted until a separate explicit public payload/parity path permits it. The shell remains useful through readiness, fix-first, priority, preserve, next-take and reliability fields.

### Safety Boundary

Normalisation is view-only and reads only the existing allowed public-safe field names. It does not consume raw report internals, QA artefacts, scores, category scores, named technique authority, comparison winner/recommendation, castability, bookability, marketability, employability or role-fit claims. Fallback copy must not invent feedback or turn assessability limitations into performer criticism.

## R10.1C Public Payload Alignment Note

R10.1C keeps the same seven public-safe field paths and aligns their payload shapes before the readiness-first shell receives them. It does not add brief achievement, scores, named technique authority, comparison recommendation, role-fit, release or S9 evidence-spine fields.

### Existing Public Payload Availability

- `schema_version` is copied as the public report schema marker when present.
- `submission_verdict` is usually a string or small object and can be unavailable on sparse artefacts.
- `fix_first` may be a string or object-like action row; only one safe item should reach the shell.
- `priority_fixes`, `strengths` and `next_take_plan` can be strings, arrays or object-like rows and can be empty, malformed or over-populated.
- `feedback_reliability` is allowed but can be missing from current artefacts. It can be surfaced only from existing public-safe reliability or limitation text, or as a concise unavailable state.

### Payload Usefulness

The existing allowed fields can support the minimum readiness-first value when normalised consistently: a readiness posture, one fix-first action, up to three priority actions, preserve guidance, next-take steps and a reliability/limitations note. Missing source values remain unavailable rather than being invented.

### Safety Boundary

Public payload alignment must not copy raw report-only material into new public fields, must not read internal QA artefacts as display sources, and must filter score, category-score, named technique, comparison, castability, bookability, marketability, employability, role-fit, internal ID, storage URL, signed URL, prompt, response, trace, gate and blocker-code language from the allowed field values.

## R10.2A Public-Safe Brief Requirements Checklist Note

R10.2A adds one narrowly scoped public-safe field path, `report_data.brief_requirements`, so the readiness-first shell can show a neutral checklist when the current public report already contains safe brief/task requirement content. It does not add scores, named technique authority, comparison recommendation, role-fit, repertoire authority, production release or customer release fields.

### Existing Brief Source Availability

- Supplied and structured brief data can exist in the normal analysis pipeline, but the locked-down shell must not display those internal inputs directly.
- Before R10.2A there was no explicit public payload path for brief requirements, so brief-achievement content remained hidden.
- Brief requirements are safe only when reduced to short public labels and neutral statuses, without evidence IDs, QA gate names, raw blocker codes or internal artefact references.
- Current reports may still lack safe brief requirement content; missing source content must remain unavailable rather than being inferred.

### Public-Safe Support

- `observed` is allowed only for a requirement represented by safe public report content.
- `not_observed` is allowed only when the requirement label is public-safe and the public report has no safe support for it.
- `not_assessable` is used when the report cannot safely determine the requirement status.
- `not_applicable` is used when the requirement does not apply to the report context.
- The checklist must never use passed/failed/achieved/scored language, castability, bookability, marketability, role-fit language, or public technique authority.

### Shell Value

The brief requirements section sits after priority fixes and before keep/preserve guidance. It helps a tester see which task or brief requirements appear observed, missing, or not assessable without turning missing requirements into a quality judgement.

### Safety Boundary

The public payload normaliser and shell filter internal trace names, QA gate names, evidence/truth IDs, run IDs, signed/storage URLs, raw prompts/responses, raw report-only material, score-like text, technique-authority names, comparison winner/recommendation wording and casting-market value claims. If no safe checklist source exists, no checklist items are invented.
