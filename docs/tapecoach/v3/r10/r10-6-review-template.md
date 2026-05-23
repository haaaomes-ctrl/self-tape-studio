# R10.6 Usefulness Review Template

Use this template for each approved tester review. Leave unknown fields as `unknown`; do not invent metadata.

## Reviewer Record

- Reviewer name or identifier:
- Reviewer role:
- Relevant expertise:
- Discipline / audition type approved for review:
- Conflict-of-interest declaration:
- Date reviewed:
- Branch:
- Commit SHA:

## Fixture Or Run Metadata

- Fixture ID:
- Run ID:
- Take ID:
- Selected level:
- Audition type:
- Discipline:
- Brief supplied: yes / no / unknown
- Material fixed: yes / no / unknown
- Artefact root or report reference:
- Report surface reviewed: source/test output / rendered locked-down report / runtime canary output / other supplied report
- Live runtime used: yes / no / not run / not supplied
- Dev-server verification used: yes / no / not run / not supplied
- Canary used: yes / no / not run / not supplied

## Fixed Usefulness Rubric

For each question, mark yes / partial / no / not applicable, then quote or paraphrase the report text that supports the answer.

| ID        | Question                                                                                                                               | Outcome | Evidence from report | Severity if failed |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------- | ------------------ |
| R10.6-Q01 | Can the tester identify the submission recommendation within 60 seconds?                                                               |         |                      | P1                 |
| R10.6-Q02 | Can the tester explain why the recommendation was reached using report text only?                                                      |         |                      | P1                 |
| R10.6-Q03 | Can the tester identify the single most important fix before submission?                                                               |         |                      | P1                 |
| R10.6-Q04 | Are all meaningful priority fixes visible, not hidden behind an arbitrary top-1 or top-3 display?                                      |         |                      | P1                 |
| R10.6-Q05 | Does the report distinguish must-fix, should-improve and optional-polish guidance?                                                     |         |                      | P1                 |
| R10.6-Q06 | Does the brief requirement checklist look correct?                                                                                     |         |                      | P1/P2              |
| R10.6-Q07 | Does the report show whether the brief was achieved, mostly achieved, partly achieved, not achieved, not assessable or not applicable? |         |                      | P1                 |
| R10.6-Q08 | Does not-assessable feel fair and separate from criticism?                                                                             |         |                      | P0/P1              |
| R10.6-Q09 | Does the next-take plan tell the performer exactly what to do next?                                                                    |         |                      | P1                 |
| R10.6-Q10 | Does every must-fix and should-improve item have an action or a fair unavailable reason?                                               |         |                      | P1                 |
| R10.6-Q11 | Does the report identify what to preserve?                                                                                             |         |                      | P2                 |
| R10.6-Q12 | Does the do-not-over-fix section prevent unnecessary retakes?                                                                          |         |                      | P1/P2              |
| R10.6-Q13 | Is anything generic, padded or vague?                                                                                                  |         |                      | P1/P2              |
| R10.6-Q14 | Is anything overconfident?                                                                                                             |         |                      | P1                 |
| R10.6-Q15 | Is anything invented: requirement, fix, timestamp, role/material context, technique claim or achievement?                              |         |                      | P0/P1              |
| R10.6-Q16 | Does any blocked public content or private/internal field leak?                                                                        |         |                      | P0                 |
| R10.6-Q17 | Would this report change the performer’s next take?                                                                                    |         |                      | P2                 |
| R10.6-Q18 | Does the report feel like practical agent, casting-aware or coach-style guidance rather than a QA checklist?                           |         |                      | P2                 |

## Usefulness Metrics

Mark pass / partial / fail / not applicable.

- Submit/retake clarity:
- Reason clarity:
- Fix-first clarity:
- Useful priority-fix coverage:
- Brief understanding:
- Brief achievement trust:
- Actionability:
- Preserve / do-not-over-fix usefulness:
- Anti-endless-retake behaviour:
- Professional usefulness:
- Safety:
- Report quality:
- UK English:

## Issue Log

| Issue ID | Severity          | Rubric IDs | Description | Required handling | Follow-up owner |
| -------- | ----------------- | ---------- | ----------- | ----------------- | --------------- |
|          | P0 / P1 / P2 / P3 |            |             |                   |                 |

Severity handling:

- P0/P1: fix immediately or create a direct follow-up patch.
- P2: create a scoped follow-up if it improves performer-facing understanding.
- P3/design preference: log for future work. Do not redesign the report during this review.

## Result Summary

- Overall review result: pass / pass with P2 follow-ups / blocked by P0/P1 / not enough supplied evidence
- Would the report change the next take? yes / partial / no
- Highest-value public-safe improvement:
- Design preferences captured for future slices:
- Confirmation that no live redesign occurred during review:
- Confirmation that no customer release, production-safe approval, Level 2 acceptance, public scoring approval, public technique authority or public comparison approval is claimed:

## Historical Artefact Note

Historical S9 runtime JSONs are examples or regression evidence only unless fresh runtime files are explicitly supplied for this R10 review.
