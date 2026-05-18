# Current Task State Template

Codex completion is not acceptance. GitHub checks alone are not release approval.

Use this template to record one linear ChatGPT/Codex/GitHub task at a time. The state may be copied into the `task-state.example.json` shape for manual review.

## Task Identity

- `task_id`:
- `task_name`:
- `branch`:
- `pr_link`:
- `source_hierarchy_checked`:
  - `README.md`:
  - `AGENTS.md`:
  - `docs/tapecoach/v3/orchestrator/**`:
  - `env-vars.md`:
  - `tapecoach-v3-parallel-delivery-approach.md`:
  - `tapecoach-v3-roadmap.md`:

## Prompt And Codex Run

- `chatgpt_prompt_issued_to_codex`:
- `operator_manual_codex_run_required`: true
- `codex_task_status`: not_started | running | complete | failed | stopped
- `codex_summary`:
- `chatgpt_decision_after_summary`: fix | create_pr | stop | pending

## PR State

- `pr_creation_status`: not_started | operator_required | created | blocked
- `pr_link`:
- `github_checks_status`: not_started | pending | passed | failed | blocked

## Review Cycles

Record every review/fix round. PR review has begun once any review has been requested or any PR review finding/check failure is recorded.

### Review Cycle N

- `round_number`:
- `review_requested_at`:
- `reviewer_source`: Codex PR review | GitHub review | GitHub checks | operator | other
- `review_result`: no_findings | findings | check_failure | blocked | pending
- `bugs_found`:
- `p0_findings`:
- `p1_findings`:
- `p2_findings`:
- `chatgpt_triage_decision`: fix | defer | stop | merge_candidate | pending
- `codex_fix_prompt`:
- `codex_fix_summary`:
- `github_checks_after_fix`: not_started | pending | passed | failed | blocked
- `continue_review_required`: true | false

## Deferred And Operator Items

- `deferred_items`:
- `operator_verification_required_items`:

## Merge And Next Task

- `merge_recommendation`: true | false
- `merge_recommendation_source`: ChatGPT | none
- `merge_status`: not_started | operator_required | manually_squash_merged | blocked
- `next_task_recommendation`:

## Blocked States

These states must remain explicitly recorded and blocked for this MVP loop.

- `Level 2`: `not_accepted`
- `production_safe`: `blocked`
- `public_scoring`: `blocked`
- `public_technique_authority`: `blocked`
- `comparison/public winner`: `blocked`
- `customer-facing release`: `blocked`

## Required Impact Statements

- Public output impact: none unless explicitly scoped.
- Upload/Mux/webhook implementation impact: none unless explicitly scoped.
- Product runtime impact: none unless explicitly scoped.
- Automatic merge: prohibited.
- Automatic deploy: prohibited.
- Lovable publish: prohibited.
- Storage-download QA automation: prohibited.
