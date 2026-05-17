# Codex Prompt Draft: setup-task-3-lovable-publish-lane

## Task mode
Implementation task (not design-only) for future setup execution; this Task 0 PR remains design-only.

## Source hierarchy
1) README.md 2) relevant setup task doc 3) current Codex prompt/acceptance gate 4) delivery approach sequencing only 5) roadmap planning only 6) PR #49 lessons only.

## Protected/still-blocked states
No public output changes unless scoped. No upload/Mux/webhook implementation changes unless scoped. Level 2 remains not_accepted. production_safe/public_scoring/public_technique_authority remain blocked.

## Required commands
- npm run build
- npm run test:contracts
- task-specific checks as scoped

## Scope control
- Do not expand scope without operator approval.
- Do not copy implementation from PR #49.
- Respect P0/P1/P2 policy: fix P0/P1 before merge; defer P2 unless blocking acceptance.

## Allowed and disallowed file changes
- Expected files to change: only task-scoped files explicitly listed by operator at run time.
- Not allowed: unrelated package/workflow/script/source/test/runtime files, and any protected areas outside approved scope.

## Fail-closed reporting
Report local fail-closed behaviour explicitly as local context only; do not claim PR-context pass from local-only checks.

## GitHub PR-context confirmation
Confirm PR-context checks via GitHub check runs, reviewer outcomes, and evidence links in summary.

## Stop rule
If ambiguity/contradiction or non-scoped required change appears: stop with operator-verification-required.

## Completion line
XDESIGN-V3-ORCHESTRATOR-TASKS1-4-DESIGN-FREEZE-UK complete.
