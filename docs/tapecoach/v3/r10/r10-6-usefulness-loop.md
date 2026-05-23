# R10.6 Locked-Down Usefulness Review Loop

**Controlling source:** `README.md` remains the product, report, scoring, QA, validator, public/private boundary and release-decision authority. This review pack is a repeatable R10 reviewer aid only; it must not override README.

**Branch scope:** R10 locked-down public report value delivery on `codex/r10-readiness-first-report-shell`.

**Purpose:** let an approved agent, casting-aware reviewer, acting coach, vocal coach, dance coach, commercial coach or professional tester decide whether the locked-down R10 report is useful without redesigning it during review.

This slice is source/test support for a later reviewer loop. It does not claim that agent/tester validation has passed unless completed reviewer records are supplied.

## Review Inputs

Use the template in `docs/tapecoach/v3/r10/r10-6-review-template.md`.

Reviewer record must capture:

- reviewer role;
- relevant expertise;
- discipline or audition type approved for review;
- conflict-of-interest declaration;
- fixture ID or run ID, where available;
- artefact root or report reference, where available;
- branch and commit SHA;
- date reviewed;
- report surface reviewed: source/test output, rendered locked-down report, runtime canary output or other supplied report;
- whether live runtime, dev-server verification or canary was used.

If live runtime or canary output is absent, mark it `not run / not supplied`. Do not block source acceptance solely because live runtime output is absent.

Fixture/run metadata must capture, where available:

- fixture ID;
- run ID;
- take ID;
- selected level;
- audition type;
- discipline;
- brief supplied: yes / no / unknown;
- material fixed: yes / no / unknown;
- report surface reviewed;
- branch;
- commit SHA.

## Reviewer Instructions

1. Review only the supplied locked-down public report surface.
2. Do not inspect raw prompts, raw responses, storage paths, signed URLs, hidden traces or internal QA artefacts as public evidence.
3. Answer the fixed rubric before suggesting design changes.
4. Classify every issue as P0, P1, P2 or P3/design preference.
5. Fix or escalate P0/P1 issues immediately through a direct follow-up patch.
6. Log P2 items as scoped follow-ups when they improve performer-facing usefulness.
7. Capture P3/design preferences without redesigning the report during review.
8. Do not treat historical S9 runtime JSONs as current behaviour unless fresh runtime files are explicitly supplied for this R10 review.

## Fixed Usefulness Rubric

Use yes / partial / no / not applicable, then add evidence from the report text.

1. Can the tester identify the submission recommendation within 60 seconds?
2. Can the tester explain why the recommendation was reached using report text only?
3. Can the tester identify the single most important fix before submission?
4. Are all meaningful priority fixes visible, not hidden behind an arbitrary top-1 or top-3 display?
5. Does the report distinguish must-fix, should-improve and optional-polish guidance?
6. Does the brief requirement checklist look correct?
7. Does the report show whether the brief was achieved, mostly achieved, partly achieved, not achieved, not assessable or not applicable?
8. Does not-assessable feel fair and separate from criticism?
9. Does the next-take plan tell the performer exactly what to do next?
10. Does every must-fix and should-improve item have an action or a fair unavailable reason?
11. Does the report identify what to preserve?
12. Does the do-not-over-fix section prevent unnecessary retakes?
13. Is anything generic, padded or vague?
14. Is anything overconfident?
15. Is anything invented: requirement, fix, timestamp, role/material context, technique claim or achievement?
16. Does any blocked public content or private/internal field leak?
17. Would this report change the performer’s next take?
18. Does the report feel like practical agent, casting-aware or coach-style guidance rather than a QA checklist?

## Usefulness Metrics

Record one outcome for each metric: pass / partial / fail / not applicable.

- submit/retake clarity;
- reason clarity;
- fix-first clarity;
- useful priority-fix coverage;
- brief understanding;
- brief achievement trust;
- actionability;
- preserve / do-not-over-fix usefulness;
- anti-endless-retake behaviour;
- professional usefulness;
- safety;
- report quality;
- UK English.

## Acceptance Thresholds

- Submit/retake clarity passes only if the tester can answer within 60 seconds.
- Reason clarity passes only if the tester can explain why using report text only.
- Fix-first clarity passes only if the tester can identify one top fix.
- Useful-fix coverage passes only if meaningful lower-ranked fixes are visible where public-safe.
- Actionability passes only if every must-fix and should-improve item has a practical next step or fair unavailable reason.
- Safety requires zero blocked public leakage.
- Not-assessable passes only if limitations are not treated as performance failure.
- Design preferences do not block R10.6 unless they reveal a P0/P1 product failure.

## Severity Taxonomy

### P0

- public/private leakage;
- public scores or category scores exposed;
- public named technique authority exposed while blocked;
- public comparison recommendation or winner exposed while blocked;
- castability, bookability, marketability, role-fit or employability claim;
- guaranteed casting, recall or job outcome;
- protected-characteristic, body, appearance or medical/vocal-health inference;
- raw report or internal QA artefact rendered publicly;
- evidence IDs, truth IDs, run IDs, storage paths, signed URLs, raw prompts or raw responses exposed in the public report;
- not-assessable converted into performance criticism in a materially harmful way;
- false readiness recommendation caused by ignoring a missing mandatory assessable brief requirement.

### P1

- tester cannot identify submit/retake recommendation;
- tester cannot identify fix-first;
- material brief achievement is missing or misleading;
- missing assessable mandatory brief requirement does not affect readiness, fixes or action plan;
- all useful fixes collapse to one item despite multiple meaningful issues;
- next-take plan does not cover must-fix or should-improve items;
- generic filler materially weakens usefulness;
- overconfident unsupported professional claim;
- report encourages endless retake loop by treating optional polish as a blocker.

### P2

- useful but unclear wording;
- section ordering or labels slow comprehension;
- minor duplication across fixes and action plan;
- some action wording could be more specific but does not block usefulness;
- reviewer wants more detail within the current public-safe model.

### P3 / Design Preference

- subjective layout preference;
- alternate tone preference;
- desire for a new section not required by README;
- request for public scoring, named technique authority, comparison recommendation or role/repertoire authority while gates remain blocked;
- broader product idea for a future slice.

## Handling Rule

- P0/P1: fix immediately or convert into a direct follow-up patch before treating the review as useful.
- P2: record as a follow-up slice when it improves performer-facing understanding.
- P3/design preference: log as future work and do not derail validation.
- Do not redesign the report live during review.

## Blocked-Content Reminders

The review loop must not approve, request or treat as accepted:

- public scores;
- category scores;
- public named technique authority;
- public comparison winner or recommendation;
- castability, bookability, marketability, role-fit or employability claims;
- guaranteed recall, job or casting outcomes;
- raw report as public output;
- internal QA artefacts as public output;
- EvidenceAnchors, TruthStateMap, PublicClaimTrace, ValidatorTrace or GateTrace internals;
- evidence IDs, truth IDs, run IDs, analysis IDs, storage paths, signed URLs, raw prompts, raw responses, private media URLs, secrets or environment values in public report text.

## Release And Runtime Boundaries

R10.6 does not approve:

- customer release;
- production-safe status;
- Level 2 acceptance;
- public scoring;
- public named technique authority;
- public comparison recommendation;
- production/customer release gates.

Do not run live runtime verification, dev-server verification or canary for this slice. R10.7 remains the batched canary checkpoint unless a product owner explicitly chooses otherwise.

## Historical Artefact Caution

Historical S9 runtime JSONs are stale examples or regression evidence only. Some contain stale acceptance metrics, old public-claim blockers or pre-S9-19 failures. Treat latest repo source/test state as current unless fresh runtime files are explicitly supplied for this review.
