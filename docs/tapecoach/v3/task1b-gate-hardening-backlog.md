# Task 1B gate-hardening backlog

Task 1A closes with canonical package scripts and canonical workflow shapes for the initial autonomous GitHub/Codex gate layer.

Task 1B may later add flexible shell/YAML parsing where required.

Deferred hardening examples:
- richer YAML parser support;
- broader shell syntax support;
- advanced workflow shapes;
- optional formatting variants.
- support `npm run-script` aliases in workflow validation;
- treat `npm run-script gate:release` as equivalent to `npm run gate:release` in future flexible parser mode.

Task 1A bootstrap stance:
- Task 1A is a bootstrap gate layer.
- Future PRs should move toward running gatekeeper validation from trusted base-branch validator code against candidate PR files.
- Protected-area exception CI channel is deferred; Task 1A blocks protected-area changes without a CI approval channel.

Task 1B may design richer operator approval paths, for example:
- GitHub environment approvals;
- issue-backed operator approvals;
- signed approval artefacts;
- release-board-driven approval workflow.
- PR-scoped protected-area exception approval channel.

Additional Task 1B hardening/flexibility items:
- trusted base-branch gatekeeper execution after Task 1A bootstrap merge;
- npm run-script alias support;
- forwarded npm args compatibility for `test:contracts` wrapper;
- richer workflow/parser flexibility;
- multiline workflow run support if needed.

These are not required for Task 1A merge unless they introduce a P0/P1 false-pass issue.
