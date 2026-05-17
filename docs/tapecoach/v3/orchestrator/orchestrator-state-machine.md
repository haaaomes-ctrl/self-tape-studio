# Orchestrator State Machine

## Top-level loop
```text
README / roadmap / delivery docs
        ↓
ChatGPT decision agent
        ↓
Codex prompt
        ↓
Operator clicks / runs Codex task
        ↓
Codex builds branch
        ↓
Codex summary
        ↓
ChatGPT decides fix or PR
        ↓
Operator clicks Codex create PR
        ↓
Codex PR review
        ↓
ChatGPT reviews bugs
        ↓
Codex fixes
        ↓
GitHub checks
        ↓
ChatGPT approves merge
        ↓
Operator squash-merges to remote GitHub
        ↓
Lovable syncs / operator publishes if needed
        ↓
Post-publish tests
        ↓
Storage-download review on local Mac
        ↓
ChatGPT receives review summary
        ↓
Next release decision
```

No asynchronous hidden work. No automatic merge without explicit operator action. No Lovable publish before merge approval. No release decision from Codex alone or Lovable alone. No acceptance without required tests/build/checks/evidence.

## Authority boundary table
| Stage | Primary actor | Manual or automated | Output | Cannot do |
|---|---|---|---|---|
| Source review | ChatGPT | Automated reasoning over supplied docs/repo context | Codex-ready prompt | Cannot override README |
| Codex task start | Operator | Manual click/run | Codex task begins | Cannot run without operator action where tool requires it |
| Branch build | Codex | Automated engineering execution | Branch + summary | Cannot decide release approval |
| Summary review | ChatGPT | Decision | Fix / PR / stop recommendation | Cannot merge directly |
| PR creation | Operator / Codex UI | Manual click where required | GitHub PR | Cannot bypass review |
| PR review | Codex + GitHub | Automated/static review | Bugs/checks | Cannot approve product release alone |
| Bug triage | ChatGPT | Decision | Fix prompt or merge recommendation | Cannot ignore P0/P1 |
| Fix cycle | Codex | Automated engineering execution | Updated branch | Cannot expand scope without approval |
| GitHub checks | GitHub | Automated verification | Check result | Cannot prove live product QA alone |
| Merge approval | ChatGPT + Operator | Decision + manual action | Squash merge | Cannot merge if checks/P0/P1 fail |
| Lovable publish | Operator | Manual publish/sync | Published locked-down site | Cannot authorise release gates |
| Post-publish QA | Orchestrator/tests | Automated + operator where needed | QA summary | Cannot pass Level 4 alone |
| Storage-download QA | Local Mac runner | Local/private execution | Review summary | Cannot expose private artefacts by default |
| Release decision | ChatGPT + Operator | Decision | Next release/fix/hold | Cannot unblock README gates without evidence |

## States
Each state logs timestamp, actor, inputs, outputs, evidence refs, and blocking reason if any.

- **IDLE**: entry=start; action=wait; next=`READ_SOURCE_HIERARCHY`.
- **READ_SOURCE_HIERARCHY** (ChatGPT): input=README/setup docs; output=hierarchy-checked record; block=missing source.
- **ASK_CHATGPT_FOR_CODEX_PROMPT** (ChatGPT): output=prompt draft with scope/stop rules.
- **WAITING_FOR_OPERATOR_TO_RUN_CODEX** (Operator): manual run required; block=no operator action.
- **INGEST_CODEX_SUMMARY** (ChatGPT): input=Codex summary/evidence; block=missing evidence.
- **ASK_CHATGPT_FOR_PR_DECISION** (ChatGPT): output=fix/pr/stop.
- **WAITING_FOR_OPERATOR_CREATE_PR** (Operator): manual create PR click; block=no PR link.
- **MONITOR_GITHUB_PR** (GitHub+ChatGPT): input=PR metadata/check statuses.
- **REQUEST_CODEX_PR_REVIEW** (ChatGPT->Codex): output=review request.
- **INGEST_CODEX_REVIEW** (ChatGPT): input=bugs/severity list.
- **ASK_CHATGPT_FIX_OR_MERGE** (ChatGPT): requires Codex review + checks context.
- **WAITING_FOR_OPERATOR_RUN_FIX** (Operator): manual run fix task.
- **MONITOR_GITHUB_CHECKS** (GitHub): requires pass statuses.
- **WAITING_FOR_OPERATOR_MERGE** (Operator): explicit merge action only if approved.
- **MERGED**: merge evidence captured.
- **WAITING_FOR_OPERATOR_LOVABLE_PUBLISH** (Operator): optional publish action.
- **POST_PUBLISH_TESTS** (orchestrator/tests): execute required post-publish checks.
- **STORAGE_DOWNLOAD_QA_REQUIRED**: determine requirement from task scope.
- **WAITING_FOR_LOCAL_STORAGE_DOWNLOAD_RUNNER** (Operator/local runner): manual trigger of labeled self-hosted lane.
- **INGEST_STORAGE_DOWNLOAD_REVIEW** (ChatGPT): input=local summary only.
- **RELEASE_DECISION_REQUIRED** (ChatGPT+Operator): decision hold/fix/next release.
- **BLOCKED_OPERATOR_VERIFICATION_REQUIRED**: contradiction/ambiguity/security uncertainty; stop until operator resolves.
- **COMPLETE**: terminal for the orchestrated cycle.
