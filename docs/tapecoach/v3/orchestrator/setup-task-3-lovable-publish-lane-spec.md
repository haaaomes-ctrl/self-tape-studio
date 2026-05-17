# Setup Task 3 Spec — Lovable Publish Lane

Lovable is operator-controlled publish infrastructure. Codex remains engineering executor, ChatGPT remains decision agent, GitHub remains verification/audit.

## Required states
- `WAITING_FOR_OPERATOR_LOVABLE_PUBLISH`
- `POST_PUBLISH_TESTS`

## Rules
- Lovable cannot bypass README gates, GitHub checks, PR review, manifest/QA artefact validation, public/private leakage gates, or release gates.
- Publish action is manual/operator controlled.
- Post-publish tests must check locked-down site behaviour, required QA artefacts, leakage controls, and expected blocked-state truth.
- Failures loop back to ChatGPT decision + Codex fix cycle.
- Release remains blocked when post-publish tests fail.
- Rollback / “do not publish wider” decisions must be logged with evidence.

## Explicit non-authority
Lovable publish is not release approval, not `production_safe`, not Level 4, and cannot approve public scoring or public technique authority.
