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

The existing v2 component renderer can also receive scores, category notes, component scores, risk flags and role-fit fields from the older persisted report shape. Those fields are not needed for R10.1 and are not read by the locked-down shell.

Brief achievement is not yet a separate permitted public path. R10.1 may show a brief-achievement summary only if it is safely nested inside the permitted `submission_verdict` object. Otherwise the shell shows a concise unavailable state.

## Minimum Shell Decision

The shell renders only:

1. readiness / submit-or-retake summary;
2. fix first;
3. priority fixes;
4. brief achievement / missing requirements when available, otherwise a safe unavailable state;
5. strengths / preserve;
6. next-take checklist;
7. limitations / not assessable;
8. feedback reliability / assessability note.

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
