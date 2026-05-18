# Linear Orchestrator Runbook

This runbook defines the MVP linear operating loop for TapeCoach setup tasks. It is a manual orchestration process, not a runtime ChatGPT/Codex integration and not a gatekeeper implementation.

## Source Order

1. `README.md` controls product behaviour, report requirements, public/private boundaries, QA artefacts and release decisions.
2. `docs/tapecoach/v3/orchestrator/**` controls orchestrator setup design where present.
3. `tapecoach-v3-parallel-delivery-approach.md` controls sequencing only.
4. `tapecoach-v3-roadmap.md` is planning/reference only.
5. `env-vars.md` documents expected QA env values and secret names.

## Four Roles

ChatGPT decides scope, prompts, finding severity, fix/PR/merge recommendations and next task.

Codex edits the repository within scope, runs checks and returns evidence. Codex completion is not acceptance.

The operator moves information between agents, creates PRs, requests reviews, verifies deployed values when needed and squash-merges after approval.

GitHub runs checks and captures PR review state. GitHub checks alone are not release approval.

## Fourteen-Step Linear Loop

1. Operator gives ChatGPT the source docs/task.
2. ChatGPT produces Codex prompt.
3. Operator runs Codex task.
4. Codex returns summary.
5. Operator gives summary to ChatGPT.
6. ChatGPT decides fix or PR.
7. Operator creates PR.
8. Operator asks Codex/GitHub for review.
9. Operator gives review bugs/check failures to ChatGPT.
10. ChatGPT produces Codex fix prompt.
11. Repeat until no P0/P1 and checks pass.
12. ChatGPT recommends merge.
13. Operator squash-merges.
14. Next task starts.

## Minimum Evidence Per Loop

Each Codex summary must include files changed, tests run, build result, public output impact, upload/Mux/webhook impact, release-state impact, deferred P2 items and `operator-verification-required` items.

Each ChatGPT decision must state whether P0/P1 findings remain. P0/P1 findings block merge. P2 findings are deferred unless they block the defined task.

## Boundaries

This MVP linear foundation must not add gatekeeper workflow, gate scripts, protected-area validators, source-contract validators, Storage-download automation, Lovable automation, runtime ChatGPT/Codex orchestration or product runtime changes.

Do not change public output, upload flow, Mux upload flow, Mux webhook flow, webhook implementation, public scoring exposure, public technique authority, `production_safe`, Storage sink semantics, `emitted_blocked` semantics, blocker-code meanings, comparison manifest identity, `comparison_run_id` handling or `src/routeTree.gen.ts` unless explicitly scoped by a future accepted task.
