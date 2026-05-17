# AGENTS.md — TapeCoach Setup Task Guardrails

## Source hierarchy
1. `README.md`.
2. `docs/tapecoach/v3/orchestrator/**` Task 0 design-freeze package.
3. `docs/tapecoach/v3/orchestrator/setup-task-1-github-codex-automation-spec.md`.
4. Current task prompt.
5. `tapecoach-v3-parallel-delivery-approach.md` for sequencing only.
6. `tapecoach-v3-roadmap.md` for planning/dependency reasoning only.

## Codex execution rules
- Codex completion is not acceptance.
- Tests/build/check outputs and evidence are mandatory.
- Do not copy implementation from PR #49.
- Preserve blocked-state truth and release-state truth.
- If ambiguity/contradiction exists, stop and report `operator-verification-required`.

## Protected areas and non-negotiable boundaries
- No public output behaviour change.
- No upload flow changes.
- No Mux upload or webhook implementation changes.
- No webhook implementation changes.
- No public scoring exposure changes.
- No public technique authority changes.
- No changes to `production_safe` or blocked-state semantics.
- No `src/routeTree.gen.ts` churn in PRs.

## Still-blocked states
- Level 2: `not_accepted`.
- `production_safe`: blocked.
- `public_scoring`: blocked.
- `public_technique_authority`: blocked.
- Comparison/public winner: blocked.
- Customer-facing release: blocked.

## PR expectations
- Keep scope to the declared setup task/release slice.
- Include tests/build results and gate status (or fail-closed explanation).
- Clearly state public output impact and upload/Mux/webhook impact.
- Record deferred P2 items separately.

## P0/P1/P2 handling
- Fix all P0/P1 false-pass and safety defects before completion.
- Defer P2 false-fail/parser-flexibility/ergonomics unless blocking acceptance.
- Do not expand scope to close deferred P2 items without operator approval.

## Escalation
Report `operator-verification-required` for:
- ambiguity/contradictions in controlling docs;
- deployed-environment uncertainty that cannot be inspected safely;
- protected-area exception requests;
- release/public-authority decisions.
