# Fix Loop Template

Use this template when review bugs or check failures must be sent back through ChatGPT and Codex.

## Inputs From Review

- PR:
- Failed checks:
- Review comments:
- P0 findings:
- P1 findings:
- P2 findings:

## ChatGPT Fix Decision

- Fix now:
- Defer:
- Stop:
- Reason:

## Codex Fix Prompt

- Source hierarchy:
- Files allowed:
- Files forbidden:
- Exact findings to fix:
- Checks to run:
- Summary required:

## Exit Criteria

- No P0 findings remain.
- No P1 findings remain.
- Required checks pass.
- P2 items are fixed only if they block the defined task.
- Deferred P2 items are recorded with owner and next-step recommendation.
