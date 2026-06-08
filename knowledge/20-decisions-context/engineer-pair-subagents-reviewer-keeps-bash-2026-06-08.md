---
id: engineer-pair-subagents-reviewer-keeps-bash-2026-06-08
title: Engineer pair — committed subagents, and the reviewer keeps Bash
tier: corpus
status: decided
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "Session 2026-06-08, KOS-05 build + Bash review"
discipline: null
monday_ref: "KOS-05"
tags: [decisions, agents, subagents, engineer-pair, tooling, write-boundary, meta]
confidence: high
created: 2026-06-08
updated: 2026-06-08
---

## Summary

The Tranche-1 engineer pair is built as **two committed subagents** in `.claude/agents/`
(PR #225, commit `67c3712b`): a **developer** (the sole write path to code, via branch + PR)
and a **senior-dev** reviewer (no `Edit`/`Write`/`NotebookEdit`; evaluator–optimizer loop,
max 3 rounds then escalate). This is the subagents-first form; Agent Teams remains the later
parallel-coordination option, not used here. **Decided:** the senior-dev reviewer **retains
`Bash`**.

## Context / why

The question was whether a "read-only" reviewer should also be denied `Bash` to make its
non-mutation structural rather than contractual.

The guarantee that actually matters is **"no unreviewed code reaches `main`"** — and that is
already enforced **structurally**, by two layers that have nothing to do with Bash: the
reviewer has **no `Edit`/`Write`** (no casual in-place edits) and **no merge authority**
(nothing it touches can reach `main` without the developer's PR, CI review, and the operator).
`Bash` sits between those layers and is governed by **contract**.

Removing `Bash` would have a real cost: the reviewer could no longer run `git diff`, `tsc`,
`vitest`, or `prettier --check` itself, and would have to trust the developer's self-reported
gate output — which defeats the point of an independent second pair of eyes. Independent
verification is _why_ the reviewer exists.

The residual risk is **bounded**: a reviewer that went off-contract and ran `git commit` would
land a junk commit on a **feature branch** — visible in the PR, un-mergeable without the
operator, fully recoverable. Bounded blast radius.

## Detail

- **Honest caveat:** this makes the reviewer's non-mutation a **contract boundary**, not a
  structural one — a slight departure from the "structural over promise" preference. Acceptable
  here precisely because the **load-bearing** boundary (no path to `main`) is structural, and
  the commands the reviewer is asked to run are non-mutating.
- **If ever tightened:** the move is **not** to remove `Bash` — it is a `Bash` **deny-rule on
  the mutating verbs** (`git commit`, `git push`, `git checkout`/`switch`, `git reset`, and
  redirects into tracked paths), keeping the verify commands while blocking the write path.
  Permission rules on compound commands are fiddly, so this is deferred, not done now.
- Both contracts state the single write path explicitly: the developer **asserts** it; the
  senior-dev **disclaims** it ("specify the fix as a finding; you do not make it"). That
  disclaimer is what makes keeping `Bash` safe.

## Open questions

None. Tightening (the Bash deny-rule) is a known, deferred option, not an open question.

## Links

- [[knowledge-os-decisions-2026-06]] — the prior Knowledge OS decisions this extends.
- Role contracts: `.claude/agents/developer.md`, `.claude/agents/senior-dev.md`; design in
  `00-meta/AGENT-ECOSYSTEM.md`.
- PR #225 (commit `67c3712b`). Monday: KOS-05.
