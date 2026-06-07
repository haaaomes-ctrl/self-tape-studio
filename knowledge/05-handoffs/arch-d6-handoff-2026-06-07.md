---
id: arch-d6-handoff-2026-06-07
title: Δ6 session handoff — architecture banked; next action is the F1–F9 from-source inversion derivation (fresh session required)
tier: corpus
status: current
spine_anchor:
  [
    "AGENTS §Score terminology alignment",
    "AGENTS §Performer level calibration",
    "README §Professional 0–100 level-relative score calibration",
  ]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "ARCH-Δ6 decision + reconciliation session, 2026-06-07 (PRs #217, #218)"
discipline: null
monday_ref: "2967682223"
tags: [handoff, arch-deltas, score-model, level-calibration, open-question]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Summary

**Purpose: this note is the STARTING CONTEXT for the next Δ6 session — not a transcript.**
Δ6 architecture is decided and banked (live on main, #217 and #218). The next concrete action
is the **F1–F9 from-source inversion derivation**, which must run in a **fresh session** — the
session that produced this handoff was very long, and the derivation needs clean context, not
a deep thread's tail.

## State — verified and banked (treat as established)

**Architecture decided** (full detail in [[arch-d6-score-model-architecture]], live on main #217):

- Analysis-first single canonical score; the AI marks dimensions, never emits or moves the number.
- All surfaces derive from one canonical value; the score is the consistent gate.
- MD-voice = separate bounded suppressible module that cannot move the score.
- Level changes the MARKING standard, not the observations; Step 1 must become level-invariant
  (currently leaks at pt:3688).
- Rubric MODEL, not threshold model; rubric authored from codified criteria +
  expert-discrimination ratify-by-exception, never learned from raw media.
- Provenance = internal-only metadata.
- Corpus = all publicly available material (operator decision; architect's IP/consent concern
  logged, non-blocking).
- Plumbing-first sequencing.

**Grounded findings:**

- Two-authority model: D (deterministic) / A (AI judgement); one-way reconcile — A caps D via
  min at sem:636–639; D never back-propagates.
- Repro A (take `39cc95b2`, temporal): matrix cap + preserved pre-cap prose.
- Repro B (take `0f033af1`, structural, confirmed live): audio cap pt:5246 reaches
  `takes.overall_score` / `score_breakdown` but not the rendered AI surface.

**Spine reconciliation routed** (live on main #218, [[arch-d6-spine-reconciliation]]):

- The spine was substantially CORRECT; the defect was undetected code drift (MAST
  verification-failure pattern).
- The Δ6 build MUST include conformance tests against named clauses (AGENTS
  score-terminology-alignment, README 11.4, README 8.x flow), not just new-behaviour tests.
- Categories: Cat 1 conformance / Cat 2 additions / Cat 3 correction / Cat 4 ADR-0008.

**Board:** S10-03 reopened/Blocked (level calibration not fit — split across A/D, unreconciled,
observation-invariance refuted); S10-14 deferred/superseded (no 90+ bunching; honest 0–100).

## State — pending, do NOT treat as established

The **F1–F9 inversion table / flattering-only theorem / F5 prose-upgrade / F9 dead-caps**:
provenance UNCONFIRMED — produced in a prior session, never durably captured. Quarantined under
Open questions in [[arch-d6-score-model-architecture]]. It MUST be re-derived FROM LIVE SOURCE,
report-only, with real file:line, as a NEW investigation (NOT a re-emit — there is nothing
verified to re-emit). Do not let any prior-sounding summary of this table be treated as fact.

## Next actions (in order)

1. **F1–F9 from-source derivation** (investigate-only, report-only). Produces the Phase 2
   safety spec AND the vault note
   `knowledge/20-decisions-context/arch-d6-phase1-as-is-score-map.md` (resolving the
   deliberately-dangling wikilink [[arch-d6-phase1-as-is-score-map]]). Prompt shape: trace the
   scoring/verdict/render path; number conditions as found (do not assume 9); include the
   level-axis split (professional 75: D "Worth another take" vs A-band "submit if deadline
   close", bandsForLevel rules:676–701) if source confirms; finish with the universality
   check — is "R never lower than D" true across all conditions AND all four levels, verified
   from source.
2. **ADR-0008 write-up** (slot verified free; draws from the decision note; best AFTER the
   derivation so it does not enshrine a pending claim).
3. **Δ11 spine edits** (Cat 2 additions, Cat 3 correction) per the routing note
   [[arch-d6-spine-reconciliation]]; README-wins holds.

## Standing recommendation

The Δ6 BUILD waits for the verified inversion table — that table is the build's safety
contract; building against a pending spec is the one shortcut to refuse. The build is high
blast radius: pinned tests encode current DEFECTIVE behaviour and must be deliberately
rewritten; scoring-path = manual-approval edits + `dry-run:analysis-worker` + canary + worker
redeploy post-merge.

## Open questions

- The F1–F9 inversion table and its associated claims (flattering-only theorem, F5
  prose-upgrade, F9 dead-caps) are unverified pending the from-source derivation (next
  action 1). Until then, nothing in that table is established.

## Links

[[arch-d6-score-model-architecture]] · [[arch-d6-spine-reconciliation]] ·
[[arch-d6-phase1-as-is-score-map]] (dangling — created by next action 1) ·
PRs #217 #218 · monday 2967682223
