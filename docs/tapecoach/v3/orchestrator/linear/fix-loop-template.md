# Fix Loop Template

Use this template when review bugs or check failures must be sent back through ChatGPT and Codex.

## Bug Summary

- Bug summary:
- Severity: P0 | P1 | P2
- Source evidence:
- Review round that found it:
- Affected files:

## ChatGPT Decision

- Fix now:
- Defer:
- Stop:
- Reason:
- Deferred owner and next step if P2:

## Codex Fix Prompt

- Source hierarchy:
- Codex fix prompt:
- Expected files allowed:
- Forbidden files:
- Exact findings to fix:
- Tests to run:
- Build command:
- Completion line required:

## Completion Line

Use this completion line in the Codex fix summary:

`FIX-ROUND-[N] complete: no automatic merge, no automatic deploy, blocked states unchanged.`

## Review After Fix

- Codex fix summary:
- Tests run:
- Build result:
- GitHub checks after fix:
- Public output impact:
- Upload/Mux/webhook implementation impact:
- Blocked states unchanged:
- Next review round required: true/false

## Exit Criteria

- No P0 findings remain.
- No P1 findings remain.
- Required checks pass.
- P2 items are fixed only if they block the defined task.
- Deferred P2 items are recorded with owner and next-step recommendation.
