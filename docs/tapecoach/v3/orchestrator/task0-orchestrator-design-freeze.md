# Task 0 Orchestrator Design Freeze

## Design-freeze declaration
This document is a design freeze only. No runtime code is implemented, no product behaviour is changed, no public output is changed, and no upload/Mux/webhook implementation is changed. Level 2 remains `not_accepted`; `production_safe`, `public_scoring`, and `public_technique_authority` remain blocked.

## Purpose
Define the definitive operating model and authority boundaries for the TapeCoach ChatGPT ↔ Codex ↔ GitHub ↔ Lovable ↔ local Storage-download QA orchestrator across Setup Tasks 1–4.

## What the orchestrator is / is not
- **Is**: a controlled decision/execution/verification loop with explicit evidence gates.
- **Is not**: runtime product implementation, release authority, or an auto-merge/autonomous release bot.

## Source hierarchy
1. `README.md`.
2. Relevant orchestrator setup task / delivery slice.
3. Current Codex prompt and acceptance gate.
4. Delivery approach docs for sequencing/roles only.
5. Roadmap docs for planning/dependency reasoning only.
6. PR #49 lessons learned only.

## Authority model
- ChatGPT = decision agent.
- Codex = engineering executor.
- GitHub = verification and audit.
- Operator = manual authority for Codex task creation, PR creation, merge, Lovable publish, and ambiguity resolution.
- Lovable = publish lane, not release authority.
- Local Mac runner = private Storage-download QA lane.

## No-bypass rule
No single actor can complete a release alone.
- Codex cannot merge.
- GitHub checks cannot approve release.
- Lovable publish cannot approve release.
- Storage-download review cannot approve Level 2/3/4, `production_safe`, public scoring, or public technique authority.
- ChatGPT cannot click/manual-run external tools.
- Operator cannot mark gates passed without evidence.

## Protected areas and blocked states
Protected areas include public output controls, release-state truth, private artefacts/secrets, protected-characteristic handling, and protected workflow boundaries. Non-negotiable blocked states remain:
- Level 2: `not_accepted`
- `production_safe`: blocked
- `public_scoring`: blocked
- `public_technique_authority`: blocked

## Severity and stop rules
- **P0**: unsafe exposure/release bypass risk.
- **P1**: false-pass/bypass of required controls.
- **P2**: false-fail, flexibility, ergonomics, non-critical hardening.
- **P3**: minor wording/formatting.

Before merge: fix all P0/P1. Defer P2 unless blocking acceptance; track as backlog. Do not expand scope to deferred P2 items without operator approval.

## Evidence and acceptance
- Codex summaries are evidence inputs, not acceptance decisions.
- GitHub checks/reviews are required verification inputs, not standalone release approval.
- Final merge decision requires ChatGPT decision + operator manual action with evidence.

## Ambiguity and contradiction escalation
If required details are incomplete/contradictory, stop and record `operator-verification-required` rather than invent behaviour.

## PR #49 review-loop prevention
PR #49 became a review loop because implementation began before the orchestrator/gatekeeper threat model and setup boundaries were frozen. This design prevents recurrence by freezing authority boundaries, defining stop rules, separating setup vs product package scope, and prohibiting implementation in Task 0.

## Task 0 acceptance boundary
- Codex may structure and write documentation.
- Codex may not implement workflow, script, package, or source changes.
- Codex may not create runtime automation.
- Codex may not create gatekeeper implementation.
- Codex may not create tests or test fixtures.
- Codex may not update `src/routeTree.gen.ts`.
- If a non-doc change appears necessary, Codex must stop with `operator-verification-required`.
