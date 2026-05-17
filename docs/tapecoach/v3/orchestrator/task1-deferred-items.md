# Setup Task 1 Deferred Items

## Deferred follow-up (highest priority)
- Implement trusted-base protected-area gatekeeper in a dedicated follow-up task with safe trust boundaries and false-pass prevention.

## Deferred by design in this task
- Setup Task 2 ChatGPT↔Codex orchestrator implementation.
- Setup Task 3 Lovable publish lane implementation.
- Setup Task 4 Storage-download QA lane implementation (including live Storage-download QA).
- Full Sprint 0 / R0-R4 product contract package.

## Clarifications for current bootstrap validators
- `gate:v3` is exported source-contract validation only; it is not live runtime proof.
- `gate:storage` validates exported source-contract shape by default; optional local bundle validation requires explicit path input.
- `gate:release` remains intentionally fail-closed while trusted-base gatekeeper is deferred.

## P2 deferred items
- Parser flexibility and non-canonical format convenience improvements are deferred to post-bootstrap hardening.
