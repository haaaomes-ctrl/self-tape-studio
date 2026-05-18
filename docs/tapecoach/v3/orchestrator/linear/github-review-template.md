# GitHub Review Template

GitHub checks alone are not release approval. Review findings must be classified by ChatGPT before fix, defer or merge consideration.

## PR

- PR link:
- Branch:
- Review round number:
- Review focus:

## Expected Scope

- Expected changed files:
- Forbidden changed files:
- Public output impact expected: none unless explicitly scoped
- Upload/Mux/webhook implementation impact expected: none unless explicitly scoped
- `src/routeTree.gen.ts` expected unchanged: yes
- Gatekeeper workflow introduced: no
- Gate scripts introduced: no
- Protected-area validator introduced: no
- External API-driven orchestrator introduced: no
- Lovable automation introduced: no
- Storage-download automation introduced: no

## Review Inputs

- GitHub checks:
- Codex review findings:
- Inline comments:
- Review comments:
- Requested changes:

## Bug Classification

- P0 findings:
- P1 findings:
- P2 findings:
- Non-issues:
- Source evidence:

## Triage

- Fix now:
- Defer:
- Stop:
- Deferred owner and next step:
- Another review round required: true/false
- Merge can be considered: true/false

## Merge Consideration Guardrails

Merge can be considered only when:

- No open P0 findings remain.
- No open P1 findings remain.
- GitHub checks pass.
- Required build passes.
- Blocked states remain blocked.
- ChatGPT recommends merge.
- The operator will merge manually.
