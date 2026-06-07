---
id: consent-copy-ai-disclaimer-revert
title: Consent prompt must NAME the AI report disclaimer — bot copy regression reverted
tier: corpus
status: current
spine_anchor: ["ADR-0006"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "Operator decision, 2026-06-07 (PR #205; regression from Lovable commit a1d16903)"
discipline: null
monday_ref: null
tags: [compliance, consent, decisions, minors]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Summary

A Lovable "Fast Visual Edit" bot commit changed the consent validation prompt from
"…Terms, Privacy Policy and AI report disclaimer…" to "…and Disclaimer…". The operator
chose to REVERT the copy rather than update the failing test, because the edit weakened
consent specificity on a surface that serves parent/guardian accounts for minors.

## Context / why

The test failure surfaced as an unexplained new red on main during the Δ3 build and was
traced to bot commit `a1d16903` (merge `c9742d62`). The underlying `aiDisclaimer`
acceptance and the ADR-0006 consent projection were unchanged — only the human-facing
prompt wording was degraded. Principle established: **a failing consent-copy test is
treated as a tripwire, not an inconvenience — never pin new consent wording into a test
without an explicit operator compliance check.** Reverting restored the test to green
without weakening consent language.

## Detail

One-line revert in `src/lib/account-compliance.ts:66` (PR #205, its own branch/commit,
deliberately kept OFF the Δ3 PR). Watch-item: Lovable visual edits can silently alter
compliance-sensitive copy; the test suite caught this one — keep consent strings test-pinned.

## Open questions

(none)

## Links

[[arch-d3-evidence-binding-gate-handoff-2026-06-07]] · PR #205 · ADR-0006
