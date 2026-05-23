# R10.7 Batched Canary Checkpoint

**Controlling source:** `README.md` remains the product, report, scoring, QA, validator, public/private boundary and release-decision authority. This checkpoint records R10.7 verification status only; it must not override README.

## Checkpoint Summary

| Item                                 | Status                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Branch                               | `codex/r10-readiness-first-report-shell`                                |
| Source baseline inspected            | `0a04e1c Implement R10.6 usefulness review loop`                        |
| Recorded at                          | `2026-05-23 11:27:06 BST` / `2026-05-23T10:27:06Z`                      |
| Environment class                    | `operator_verification_required`                                        |
| Live runtime run                     | No                                                                      |
| Dev-server verification run          | No                                                                      |
| Canary run                           | No                                                                      |
| Canary result                        | Not run; no pass claimed                                                |
| Fixtures or runs used                | None; no fresh runtime or canary artefacts were available               |
| Report surfaces inspected at runtime | None; runtime surfaces were unavailable locally                         |
| Historical S9 runtime JSONs used     | No; historical S9 artefacts remain examples or regression evidence only |

## Runtime Availability Finding

R10.7 is the planned batched canary checkpoint, but this local workspace cannot honestly run the locked-down runtime canary:

- `package.json` exposes `dev`, `build`, `build:dev`, `preview`, `lint` and `format`; it does not expose a canary command.
- The only script under `scripts/` is `scripts/run-comparison-tmp.ts`, which is an internal comparison helper rather than an integrated R10 report canary.
- Local `.env` inspection was limited to key presence. Secret values were not printed or copied.
- The local `.env` has client-side Supabase keys, but the locked-down runtime prerequisites are not available locally: `SUPABASE_SERVICE_ROLE_KEY`, Mux secret keys, `QA_ARTIFACT_SINK`, `QA_ARTIFACT_STORAGE_BUCKET`, `QA_ARTIFACT_LOG_FALLBACK`, `V3_QA_ARTIFACTS_ENABLED`, `INTERNAL_QA_EMIT`, `TWO_STEP_ANALYSIS_ENABLED` and `INTERNAL_COMPARISON_TRIGGER_ENABLED`.

Because runtime access is unavailable, this checkpoint is `operator_verification_required`. It is not a canary pass and must not be treated as accepted runtime evidence.

## Source And Contract Coverage Completed Locally

Local source/test/build checks can verify the repository contract remains coherent, but they cannot prove deployed runtime behaviour.

| Check                                    | Local status | Notes                                                                                             |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| Branch and commit confirmed              | Passed       | Branch was clean at `codex/r10-readiness-first-report-shell`, source baseline `0a04e1c`.          |
| README controlling gates inspected       | Passed       | README keeps Level 2 not accepted and public/production gates blocked unless separately accepted. |
| R10.6 usefulness loop inspected          | Passed       | R10.6 template can receive later canary evidence and tester review results.                       |
| Runtime command discovery                | Passed       | No integrated repository canary command was found.                                                |
| Runtime credential and QA flag discovery | Passed       | Required runtime secrets and QA flags are absent locally; values were not printed.                |
| Fresh runtime artefacts inspected        | Not run      | No fresh R10 runtime artefact root was supplied or generated.                                     |

## Local Verification Commands

| Command                                                                                                                    | Result                      |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `npx vitest run src/server/__tests__/r10-canary-checkpoint.test.ts`                                                        | Passed: 1 file, 9 tests     |
| `npx vitest run`                                                                                                           | Passed: 94 files, 931 tests |
| `npx tsc --noEmit`                                                                                                         | Passed                      |
| `npm run build`                                                                                                            | Passed                      |
| `git diff --check`                                                                                                         | Passed                      |
| `npx eslint src/server/__tests__/r10-canary-checkpoint.test.ts`                                                            | Passed                      |
| `npx prettier --check docs/tapecoach/v3/r10/r10-7-canary-checkpoint.md src/server/__tests__/r10-canary-checkpoint.test.ts` | Passed                      |

Repo-wide lint debt was not broadened or cleaned. The changed-file ESLint check passed for the new TypeScript contract test; Markdown formatting was checked with Prettier.

## Operator Verification Steps Required

Run these steps only in an approved locked-down runtime or QA environment. Do not print, paste, commit or attach secret values.

1. Check out the R10 branch and record the commit:

   ```sh
   git checkout codex/r10-readiness-first-report-shell
   git rev-parse HEAD
   ```

2. Confirm the required runtime environment is configured by key name only:

   ```text
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   MUX_TOKEN_ID
   MUX_TOKEN_SECRET
   MUX_WEBHOOK_SECRET
   QA_ARTIFACT_SINK=storage
   QA_ARTIFACT_STORAGE_BUCKET=qa-artifacts
   QA_ARTIFACT_LOG_FALLBACK=true
   V3_QA_ARTIFACTS_ENABLED=true
   INTERNAL_QA_EMIT=true
   TWO_STEP_ANALYSIS_ENABLED=true
   INTERNAL_COMPARISON_TRIGGER_ENABLED=true
   ```

3. Process approved fixture media through the normal locked-down upload, Mux webhook and take-processing path. Use existing fixture IDs only. Suggested coverage from the existing registry, where approved media exists:

   | Coverage need                                             | Existing fixture IDs to use if media is available |
   | --------------------------------------------------------- | ------------------------------------------------- |
   | No brief / no invented requirements                       | `GF-03`, `GF-06`, `GF-12`                         |
   | Supplied brief / fixed-frame or format instruction        | `GF-20`                                           |
   | Poor audio / not assessable reliability limit             | `GF-15`                                           |
   | Poor visibility / not assessable reliability limit        | `GF-16`                                           |
   | Multiple priority fixes / strong public-safe hierarchy    | `GF-18`, `GF-19`                                  |
   | Comparison/no-export parity path where explicitly invoked | `GF-01` with `RT-15`                              |

   If any fixture media or approved registry entry is unavailable, record the coverage gap rather than substituting an invented fixture.

4. For each completed run, record safe references only:
   - fixture ID;
   - run ID;
   - take ID;
   - selected level;
   - audition type;
   - discipline;
   - whether a brief was supplied;
   - whether material was fixed;
   - branch and commit;
   - artefact root or storage object root;
   - report surface reviewed;
   - whether live runtime, dev-server verification or canary was used.

5. Inspect these artefacts where emitted, or mark them truthfully unavailable:

   ```text
   manifest.json
   qa/acceptance_metrics.json
   reports/render_payload.json
   reports/public_report_payload.json
   parity/report_parity_result.json
   export_or_no_export/no_export_proof.json
   export_or_no_export/no_export_ui_proof.json
   traces/ValidatorTrace.json
   traces/GateTrace.json
   reports/raw_report.json
   ```

   `reports/raw_report.json` is internal evidence only. It must not be rendered, copied into public output or treated as the public report.

6. Apply the pass/fail checks below and record P0/P1/P2/P3 findings using the R10.6 usefulness loop.

7. Hand the runtime result to `docs/tapecoach/v3/r10/r10-6-review-template.md` for approved tester review. Mark any absent live artefact as `not run / not supplied`.

## Required Canary Checks

| Area                                   | Required check                                                                                                                                                                                                                                                                                                                                                                                        | Current R10.7 status             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| A. Public report rendering             | Locked-down report renders from public-safe payload with a stable shell, useful labels and submit/retake/review guidance.                                                                                                                                                                                                                                                                             | `operator_verification_required` |
| B. Professional decision-support model | `schema_version`, `submission_verdict`, `why_this_verdict`, `fix_first`, `priority_fixes`, `must_fix_before_submitting`, `should_improve_if_retaking`, `optional_polish`, `preserve`, `brief_requirements`, `brief_achievement`, `next_take_plan`, `do_not_overfix`, `feedback_reliability` and `not_assessable` are present or safely unavailable.                                                   | `operator_verification_required` |
| C. Fix hierarchy                       | `fix_first` derives from `priority_fixes[0]`; lower-ranked meaningful fixes stay visible; must-fix, should-improve and optional-polish stay distinct; `next_take_plan` covers must-fix and should-improve items.                                                                                                                                                                                      | `operator_verification_required` |
| D. Brief-first value                   | No-brief runs do not invent requirements; supplied-brief runs show understood requirements and achievement; mandatory assessable gaps affect readiness where material; preferred/optional gaps are proportionate; ambiguous and not-assessable states remain distinct.                                                                                                                                | `operator_verification_required` |
| E. Public/private leakage              | Public report, render payload and public report payload do not expose blocked scores, category scores, public named technique authority, comparison recommendation, castability, bookability, marketability, role-fit, employability, guaranteed outcomes, raw report, internal QA artefacts, IDs, paths, signed URLs, raw prompts, raw responses, private media URLs, secrets or environment values. | `operator_verification_required` |
| F. Payload parity                      | `reports/render_payload.json`, `reports/public_report_payload.json` and `parity/report_parity_result.json` exist or are truthfully unavailable; allowed `report_data` fields match; unknown/private nested keys and blocked wording are stripped.                                                                                                                                                     | `operator_verification_required` |
| G. No-export proof                     | Export is truthfully absent with no-export proof, or export artefacts are present only if an export path exists. Manual print or PDF evidence is not represented as export parity.                                                                                                                                                                                                                    | `operator_verification_required` |
| H. QA spine and gates                  | Manifest and acceptance metrics describe artefact state truthfully; non-success states are not counted as accepted proof; ordinary single-take runs are not blocked solely by missing comparison artefacts; global Level 2 remains `not_accepted`; public/production gates remain blocked.                                                                                                            | `operator_verification_required` |
| I. R10.6 review handoff                | Canary output records fixture/run/report reference, branch, commit, report surface, live runtime/dev-server/canary status, artefact root, coverage gaps and P0/P1/P2/P3 issues.                                                                                                                                                                                                                       | `operator_verification_required` |

## Public-Safe Payload Fields To Verify

The runtime canary must verify parity and render availability for the current locked-down report field set:

```text
schema_version
submission_verdict
why_this_verdict
fix_first
priority_fixes
must_fix_before_submitting
should_improve_if_retaking
optional_polish
strengths
preserve
do_not_overfix
next_take_plan
feedback_reliability
brief_requirements
brief_achievement
not_assessable
```

Unknown upstream fields must not pass through into public report payloads. Nested private keys inside allowed object fields must be stripped.

## Severity Handling

Use the fixed R10.6 model:

- P0: public/private leakage, public or category score exposure, blocked public named technique authority, blocked comparison recommendation or winner, castability/bookability/marketability/role-fit/employability claim, guaranteed casting/recall/job outcome, protected-characteristic/body/appearance/medical or vocal-health inference, raw report or internal QA artefact rendered publicly, evidence IDs, truth IDs, storage paths, signed URLs, raw prompts or raw responses exposed, materially harmful not-assessable criticism, or false readiness caused by an ignored missing mandatory assessable brief requirement.
- P1: tester cannot identify the submission recommendation or fix-first item, material brief achievement is missing or misleading, useful fixes collapse to one item despite multiple meaningful issues, next-take plan does not cover must-fix or should-improve items, generic filler materially weakens usefulness, unsupported overconfidence, or optional polish is treated as a blocker.
- P2: useful but unclear wording, minor duplication, labels that slow comprehension, or action wording that could be more specific without blocking usefulness.
- P3/design preference: subjective layout or tone preference, request for a new section not required by README, or desire for public scores, named technique authority or comparison recommendation while those gates remain blocked.

P0/P1 findings must be fixed immediately or converted into a direct follow-up patch before claiming a canary pass. P2 findings may become follow-up slices. P3/design preferences must be logged as future work and must not derail the checkpoint.

## Gate Status Summary

| Gate or release decision         | R10.7 status                                              |
| -------------------------------- | --------------------------------------------------------- |
| Global Level 2                   | `not_accepted`                                            |
| Production-safe status           | `blocked`                                                 |
| Customer release                 | `blocked`                                                 |
| Public scoring                   | `blocked`                                                 |
| Public named technique authority | `blocked`                                                 |
| Public comparison recommendation | `blocked`                                                 |
| Export/share enablement          | `blocked` unless separately implemented and parity-proven |
| Runtime canary evidence          | `operator_verification_required`                          |

This checkpoint does not approve customer release, production-safe status, Level 2 acceptance, public scoring, public named technique authority or public comparison recommendation.

## Coverage Gaps

- No live runtime or canary output was produced in this local workspace.
- No fresh R10 artefact root was available for inspection.
- No approved runtime fixture media set was available locally beyond historical artefact examples.
- Public report rendering, payload parity, no-export proof and QA spine stability still require operator verification against fresh runtime artefacts.
- R10.6 approved tester usefulness review cannot be marked complete until fresh report output is supplied.

## Next Recommended Action

Run the operator verification steps above in the approved locked-down runtime environment, attach only safe artefact references, and complete the R10.6 review template for each fixture/run. Do not claim a canary pass until the runtime artefacts satisfy the required checks without P0/P1 findings.
