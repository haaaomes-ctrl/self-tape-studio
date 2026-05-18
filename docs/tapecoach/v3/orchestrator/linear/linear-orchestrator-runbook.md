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

## Running one MVP linear task

Use this process for one task, one Codex branch, one PR and one merge decision.

1. Ask ChatGPT for the Codex prompt.
2. Copy the prompt into Codex.
3. Run Codex.
4. Copy Codex summary into ChatGPT.
5. Follow ChatGPT decision: fix, create PR or stop.
6. Create the PR manually if ChatGPT instructs the operator to create PR.
7. Ask for Codex PR review manually.
8. Copy review findings to ChatGPT.
9. Run the fix loop until no P0/P1 findings remain.
10. Request another Codex/GitHub review after each fix.
11. Continue review/fix loop until GitHub/Codex review finds no P0/P1.
12. Wait for GitHub checks.
13. Ask ChatGPT for the merge decision.
14. Squash-merge manually only if ChatGPT approves merge.
15. Pull latest `main` locally after the manual squash merge.
16. Start the next task.

Record each step in `current-task-state-template.md` or the equivalent JSON example shape in `task-state.example.json`. The operator remains responsible for PR creation, review requests, manual squash merge and any deployed environment checks Codex cannot inspect.

## Manual task-state review

This MVP task intentionally does not add validation scripts, schema validators or gate checks. Review the task state manually before asking ChatGPT for a merge decision:

1. Confirm `task_id`, `task_name`, `branch`, source hierarchy checked, ChatGPT prompt, Codex status, Codex summary, ChatGPT decision, PR status, GitHub checks, deferred items, operator-verification-required items, merge status and next task recommendation are recorded.
2. Confirm PR review cycles are recorded only after review has begun through a review request, review finding or check result.
3. For merge consideration, evaluate unresolved P0/P1 findings from the latest review cycle. Historical P0/P1 findings may remain in earlier rounds as audit history after later fix rounds clear them.
4. Confirm the latest review cycle does not require another review.
5. Confirm GitHub checks are passed.
6. Confirm blocked states are explicitly recorded as unchanged: Level 2 `not_accepted`; `production_safe`, `public_scoring`, `public_technique_authority`, comparison/public winner and customer-facing release all `blocked`.
7. Confirm no automatic merge, automatic deploy, external API-driven orchestrator, Lovable publish, Storage-download QA automation, gatekeeper workflow, gate script or protected-area validator has been added.

## Minimum Evidence Per Loop

Each Codex summary must include files changed, tests run, build result, public output impact, upload/Mux/webhook impact, release-state impact, deferred P2 items and `operator-verification-required` items.

Each ChatGPT decision must state whether P0/P1 findings remain. P0/P1 findings block merge. P2 findings are deferred unless they block the defined task.

## Boundaries

This MVP linear foundation must not add gatekeeper workflow, gate scripts, protected-area validators, source-contract validators, Storage-download automation, Lovable automation, runtime ChatGPT/Codex orchestration or product runtime changes.

Do not change public output, upload flow, Mux upload flow, Mux webhook flow, webhook implementation, public scoring exposure, public technique authority, `production_safe`, Storage sink semantics, `emitted_blocked` semantics, blocker-code meanings, comparison manifest identity, `comparison_run_id` handling or `src/routeTree.gen.ts` unless explicitly scoped by a future accepted task.
