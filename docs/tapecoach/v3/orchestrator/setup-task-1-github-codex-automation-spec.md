# Setup Task 1 Spec — GitHub/Codex Automation Bootstrap

Design scope only: AGENTS.md, env-vars.md alignment, issue/PR templates, minimal contracts/build/gatekeeper workflows, `test:contracts`, storage validation script, blocked-state contract tests. No public output changes, no upload/Mux/webhook changes; Level 2 remains `not_accepted`; `production_safe`, `public_scoring`, `public_technique_authority` remain blocked.

## Bootstrap rule
Task 1 is bootstrap. PR-controlled validator code cannot be treated as fully trusted for its own bootstrap PR.

## Canonical Task 1A closure
- Canonical package scripts/workflows only.
- No broad shell/YAML parser support in bootstrap.
- No global CI protected-area exception channel.
- Only PR-scoped, operator-controlled exceptions if any.
- P2 parser flexibility deferred.

## PR #49 lessons applied
Avoid broad parser hardening, PR-controlled trusted decisions, global exception env, generated artefact churn, fragile chained `test:contracts`, undefined severity gates, scope-expanding P2 reviews, inaccurate local fail-closed claims, and confusion between local and PR-context checks.

## Trusted gatekeeper options
### Option A — Base-branch validator code
Trusted: base default-branch validator. Untrusted: PR branch scripts. Secrets exposure: avoid PR execution with secrets. PR inspection: trusted code inspects diff entries (add/mod/del/rename/copy, old/new, unusual names). Exceptions: operator-approved PR-scoped records only. Self-approval blocked by trusted-base ownership. Suitable for Task 1 only if implemented safely from trusted base.

### Option B — `pull_request_target` with safe checkout discipline
Trusted: workflow + trusted scripts from base branch. Untrusted: PR content never executed directly. Secrets: high-risk if checkout discipline broken. Inspection: diff metadata via API/git with strict path handling. Suitable with strict hardening; operationally sensitive.

### Option C — GitHub API diff inspection (no PR script execution)
Trusted: API inspector in trusted context. Untrusted: PR scripts/files. Secrets: limited if no PR code execution. Inspection: API-based file list/content with rename/copy/deleted handling and path normalization. Good bootstrap candidate.

### Option D — GitHub App / external orchestrator
Trusted: external service/app policy engine. Untrusted: PR code. Secrets: isolated by app/service boundary. Inspection: API-driven; strongest separation, highest setup overhead; likely later hardening stage.

### Option E — Manual operator exception until trusted validation exists
Trusted: humans + GitHub review trail. Untrusted: PR validator claims. Secrets: controlled manually. Inspection: reviewer-guided. Best immediate fallback but cannot claim automated full enforcement.

## Recommended posture
Use **strict canonical bootstrap only**, with trusted-base protected-area enforcement deferred as highest-priority follow-up unless a trusted-base implementation can guarantee no PR-controlled validator execution.

If deferred: Task 1 must explicitly state no full protected-area enforcement for bootstrap PR, requires manual operator/GitHub review, and tracks trusted-base enforcement as next mandatory subtask.
