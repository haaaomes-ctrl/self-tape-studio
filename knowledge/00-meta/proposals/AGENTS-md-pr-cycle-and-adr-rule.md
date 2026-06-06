# PROPOSAL — AGENTS.md addition: PR cycle, ADR rule, decision escalation (apply via Claude Code, do not auto-apply)

> Proposed addition to the spine operating contract (`AGENTS.md`), with a one-line pointer from `CLAUDE.md`. Purpose: make the merge cycle consistent for the operator, and make ADR recording a _rule Code follows_, not a manual step you might forget to prompt. Apply by hand via Code on a branch and merge by PR. The same significance test drives both "record an ADR" and "escalate to the operator", so the two are defined together.

## Suggested block to add to `AGENTS.md`

```markdown
## Operator PR & merge cycle (follow on every task)

1. Implement on a feature branch off `main` (never commit to `main`).
2. Run the gates locally: `tsc --noEmit`, `vitest run`, `prettier --check` on changed files, `npm run build` (and `dry-run:analysis-worker` if the worker changed).
3. Commit.
4. Push the branch and open a PR into `main`.
5. Mark the PR ready and await the automated PR review.
6. If the review reports issues, fix on the branch and re-run the gates; repeat until the review concludes with no findings.
7. Squash and merge.
8. Delete the branch.
9. Clean up generated-artifact churn and temporary files.
10. Record an ADR if the **ADR rule** below is met.

## ADR rule — when to record an ADR

Record a new ADR under `docs/architecture/adr/` when the change does ANY of:

- alters system architecture/topology, the data model, or a controlling invariant;
- adds, removes, or changes an external dependency or integration;
- changes a contract/interface (API shape, report schema, the analysis pipeline's stages or contract);
- is costly or hard to reverse;
- resolves a previously-open question with spine implications, or supersedes/contradicts an existing ADR.

Do NOT record an ADR for: routine feature work, bug fixes, copy/string changes, refactors with no interface or behaviour change, or easily reversible local changes.

If in doubt and the decision is significant or contested, record it — a short ADR is cheap; lost rationale is expensive.

## Decision escalation (the same significance test)

During implementation, a decision that meets the ADR rule is **operator-level**: pause and ask the operator rather than deciding alone, then record the outcome as an ADR. Decisions that do not meet the rule (reversible, local, no interface/behaviour change) are made without escalating.

When the options include investigating further or gathering a more nuanced view, prefer that before committing to an implementation path, unless the operator has already decided.
```

## Why this shape

- **Consistency:** the cycle is identical every time, so the operator is not improvising the merge sequence per task.
- **No forgotten ADRs:** recording is gated by an explicit rule at a fixed point in the cycle, not by the operator remembering to prompt it.
- **One significance test, two uses:** the criteria that make a decision ADR-worthy also make it operator-escalation-worthy. This is what lets Code make routine decisions itself (shrinking the relay) while still surfacing the decisions that genuinely need you.
- **Encodes your standing preference:** "investigate further is usually the better option" becomes a rule Code applies, instead of a judgement you have to relay through a chat each time.
