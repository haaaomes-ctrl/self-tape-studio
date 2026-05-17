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

Task 1A safe CI protected-area exception channel is intentionally narrow:
- allow only `PROTECTED_AREA_EXCEPTIONS_JSON` on the gatekeeper `npm run gate:release` step;
- source must be `${{ vars.PROTECTED_AREA_EXCEPTIONS_JSON }}` or `${{ secrets.PROTECTED_AREA_EXCEPTIONS_JSON }}`;
- do not allow repository file exceptions, inline JSON, top/job-level inherited exception env, or run-command injection.

Task 1B may design richer operator approval paths, for example:
- GitHub environment approvals;
- issue-backed operator approvals;
- signed approval artefacts;
- release-board-driven approval workflow.

These are not required for Task 1A merge unless they introduce a P0/P1 false-pass issue.

