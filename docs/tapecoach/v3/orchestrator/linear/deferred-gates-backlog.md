# Deferred Gates Backlog

These items are intentionally deferred from Setup Task 1. Setup Task 1 creates the MVP linear orchestrator foundation only.

Setup Task 2 keeps these items deferred. The MVP loop records review/fix/merge decisions locally and must not turn any deferred item into automation, enforcement or release approval.

## Trusted-Base Gatekeeper

- Why deferred: a gatekeeper workflow is outside the linear MVP and would expand this task into enforcement infrastructure.
- Before it starts: the linear loop must be accepted and the trusted-base policy must be explicitly scoped.
- Owner: future setup task for gatekeeper hardening.

## Protected-Area Validator

- Why deferred: protected-area validation requires source-contract and path policy decisions beyond this documentation foundation.
- Before it starts: protected areas, exception rules and enforcement owner must be approved.
- Owner: future setup task for protected-area controls.

## Protected-Area Exception Approval Flow

- Why deferred: exception approvals need governance and template decisions that depend on protected-area validator scope.
- Before it starts: protected areas and exception authority must be defined.
- Owner: future setup task for protected-area controls.

## Storage-Download QA Lane

- Why deferred: Storage-download automation is a separate QA lane and must not be created in this MVP task.
- Before it starts: Storage artefact contract, live QA access and review evidence requirements must be accepted.
- Owner: future setup task for Storage-download QA lane.

## Lovable Publish Lane

- Why deferred: Lovable publish review is not release approval and needs a separate publish-lane process.
- Before it starts: publish triggers, environments, rollback expectations and approval boundaries must be scoped.
- Owner: future setup task for Lovable publish lane.

## Full Sprint 0 / R0-R4 Product Contract Package

- Why deferred: this MVP avoids the heavy scaffold path and does not create the full product contract package.
- Before it starts: linear orchestration must be accepted and contract package contents must be narrowed.
- Owner: future setup or product contract task.

## Parallel Team Release Board

- Why deferred: Setup Task 1 is linear, not a parallel team release-board implementation.
- Before it starts: team ownership, board states and release governance must be approved.
- Owner: future setup task for parallel delivery operations.

## Full Contract Compatibility Package

- Why deferred: contract compatibility tests and fixtures would add a broader validation package than this foundation requires.
- Before it starts: stable contract surfaces and compatibility acceptance gates must be defined.
- Owner: future setup or product contract task.

## Level 2 Sub-Gates

- Why deferred: Level 2 remains `not_accepted`; sub-gates require proof artefacts and product/runtime evidence outside this task.
- Before it starts: required artefacts, proof standards and runtime evidence sources must be accepted.
- Owner: future product proof and Level 2 acceptance tasks.

## External API-Driven Orchestrator

- Why deferred: this MVP is manual-first and local. It must not add any automated/orchestrator integration that calls OpenAI, Codex, GitHub, Lovable or Storage APIs. Manual operator actions in normal Codex/GitHub review tooling remain allowed in the review loop.
- Before it starts: API boundaries, credentials handling, audit output and operator override rules must be accepted.
- Owner: future orchestrator automation task.

## Automatic PR Creation

- Why deferred: the operator creates PRs manually in the MVP loop.
- Before it starts: PR body requirements, branch ownership and review request rules must be accepted.
- Owner: future orchestrator automation task.

## Automatic Merge

- Why deferred: merge remains a manual operator action after ChatGPT approval.
- Before it starts: merge authority, rollback criteria and protected-branch rules must be accepted.
- Owner: future release governance task.

## Automatic Deployment

- Why deferred: deployment is outside the MVP linear orchestrator and customer-facing release remains blocked.
- Before it starts: deployment lane, environment promotion and release approval criteria must be accepted.
- Owner: future deployment governance task.
