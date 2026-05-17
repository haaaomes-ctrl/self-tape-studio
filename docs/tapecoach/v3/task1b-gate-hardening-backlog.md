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

These are not required for Task 1A merge unless they introduce a P0/P1 false-pass issue.
