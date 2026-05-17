# Adversarial Review Matrix

This matrix defines required adversarial cases for Setup Tasks 1–4 design and later implementation verification.

## Git / diff
Cover: added/modified/deleted/renamed/copied files; old/new content; empty blobs; unusual filenames (tab/newline/backslash); NUL-delimited parsing; no trusted merge base; binary/non-UTF8; Windows path normalization.

## Shell
Cover operators and execution forms: `&&`, `||`, `;`, `|`, `!`, `&`, bare newline, escaped newline continuation, comments, `echo`, `printf`, `node -e`, `npm run`, `npm run-script`, `--if-present`, missing npm script, forwarded npm args, parent npm-run failure context.

## GitHub Actions workflow
Cover: `pull_request`, `pull_request_target`, trusted-base execution, PR-controlled code, checkout target, fetch-depth, named/inline run steps, multiline run policy, `if`, `continue-on-error`, top/job/step env, `GITHUB_ENV` injection, PR number env, comments not counting, echo-only steps not counting.

## Exception workflow
Cover no self-approval, PR-scoped approval, stale/wrong PR approval, duplicate entries/categories, wildcard category, exact path matching, Windows/POSIX normalization, repo-file exception blocking, inline JSON blocking unless explicitly approved, global exception risk, operator source, expiry, `approval_source`, `approved_by`, `approved_at`.

## Lovable
Cover operator publish requirement, no bypass of GitHub checks/README/public-private gates, post-publish tests, failed publish QA loop, and no release approval from Lovable alone.

## Storage-download QA
Cover local runner labels, required env-var-based path controls, no artefact commits, no secret printing, and review summary limits.

Required cases:
- Expected/default configured value for Beth Willars’ Mac runner is `/Users/bethwillars/Documents/AI/Apps/Tape Coach/Agent` via `TAPECOACH_AGENT_DOWNLOAD_DIR`.
- `TAPECOACH_AGENT_DOWNLOAD_DIR` missing.
- `TAPECOACH_AGENT_DOWNLOAD_DIR` empty.
- `TAPECOACH_AGENT_DOWNLOAD_DIR` not absolute.
- `TAPECOACH_AGENT_DOWNLOAD_DIR` points inside the repository.
- `TAPECOACH_AGENT_DOWNLOAD_DIR` path does not exist.
- `TAPECOACH_AGENT_DOWNLOAD_DIR` exists but is not writable.
- `TAPECOACH_AGENT_DOWNLOAD_DIR` path differs on another operator machine.
- Implementation silently hardcodes Beth path instead of reading env var.
- Implementation silently falls back to Beth path when env var is missing.
- Private downloads are accidentally committed.
- Only summaries are exposed unless explicitly approved.
- `operator-verification-required` on auth/path/env failure.

## Release state invariants
Always enforce: Level 2 `not_accepted`, `production_safe` blocked, `public_scoring` blocked, `public_technique_authority` blocked, no public output change unless scoped, no upload/Mux/webhook implementation change unless scoped.
