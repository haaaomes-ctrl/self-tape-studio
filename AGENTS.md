# TapeCoach Agent Operating Notes

## Source Hierarchy

Use this hierarchy for TapeCoach work:

1. `README.md` controls product behaviour, public/private boundaries, report requirements, QA artefacts, scoring exposure and release decisions.
2. `docs/tapecoach/v3/orchestrator/**` controls orchestrator setup design where present.
3. `tapecoach-v3-parallel-delivery-approach.md` controls sequencing only. It does not override `README.md`.
4. `tapecoach-v3-roadmap.md` is planning/reference only.
5. `env-vars.md` documents expected QA environment values and secret names.

If sources conflict, follow the highest controlling source and record the conflict in the task summary.

## Agent Roles

ChatGPT is the decision agent. It reads the controlling sources, decides the task boundary, writes Codex prompts, reviews Codex summaries, classifies P0/P1/P2 findings and recommends fix, PR, merge or stop.

Codex is the execution agent. It changes repository files only within the scoped task, runs the requested checks, prepares summaries and implements ChatGPT-approved fixes. Codex completion is not acceptance.

The operator performs manual actions. The operator passes source documents and summaries between ChatGPT and Codex, creates PRs when instructed, provides review findings back to ChatGPT, verifies deployed environment values when Codex cannot inspect them and performs squash merges only after approval.

GitHub verifies repository checks and review state. Passing GitHub checks alone is not release approval.

## Protected Product Boundaries

Unless a task explicitly scopes them, do not change:

- public output;
- upload flow;
- Mux upload flow;
- Mux webhook flow;
- webhook implementation;
- public scoring exposure;
- public technique authority;
- `production_safe`;
- Storage sink semantics;
- `emitted_blocked` semantics;
- blocker-code meanings;
- comparison manifest identity or `comparison_run_id` handling;
- `src/routeTree.gen.ts`.

## Acceptance Evidence

Codex completion is not acceptance. A task summary must include:

- files changed;
- tests run;
- build result;
- GitHub check status where available;
- review evidence and unresolved findings;
- operator-verification-required items;
- public output/upload/Mux/webhook impact;
- release-state impact.

## Finding Severity

P0 findings block merge and require immediate fix or task stop.

P1 findings block merge and require fix before approval.

P2 findings should be deferred unless they block the defined task. Record deferred P2 items with owner and next-step recommendation.

## Operator Verification

When Codex cannot inspect deployed environment, secrets, live Storage, Lovable state or production configuration directly, report `operator-verification-required`. Do not infer approval from missing access.

Do not print secret values. Only secret names may be documented.

## Setup Task 1 Boundary

Setup Task 1 is the MVP linear orchestrator foundation. It documents the minimum repeatable loop between README/roadmap/delivery docs, ChatGPT, Codex, the operator, GitHub review and merge decisions.

Setup Task 1 is not:

- a gatekeeper workflow;
- gate scripts;
- protected-area validators;
- source-contract validators;
- Storage validation automation;
- Storage-download QA automation;
- Lovable automation;
- ChatGPT/Codex runtime orchestrator implementation;
- full Sprint 0 / R0-R4 product contract package;
- parallel team release board;
- product runtime change;
- customer-facing release implementation.
