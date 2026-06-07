---
id: run-t1-evidence-binding-gate-2026-06-07
title: Run T1 — first live brief-supplied take through the evidence-binding gate (2026-06-07)
tier: corpus
status: current
spine_anchor: ["AGENTS §Route/PDF first acceptance", "ADR-0003"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: run-t1-validation-2026-06-07
discipline: null
monday_ref: ["2972065331", "2971908011"]
tags: [validation, run-log, evidence-binding-gate, arch-deltas, pipeline, brief-supplied]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

# Run T1 — first live brief-supplied take through the evidence-binding gate (2026-06-07)

## Summary

First brief-supplied Professional musical-theatre take run live through the Δ3 evidence-binding gate after the persistence fix (#212). The plumbing and evidence-binding layers proved more mature than first thought — the gate fired correctly and bound 10 of 12 requirement rows to located evidence. The one structural gap the run confirmed is **score coherence (Δ6)**: four disagreeing score/verdict representations persisted on a single take. Two initially raised findings were retracted as query artefacts; the retraction itself yields the run's most reusable method learning.

## Context / why

First live exercise of the brief-supplied path: a Professional MT take (take `0f033af1-9bb6-4fa1-a5ee-6f4bff7680da`, audition `4dbe0732`, ~4:06) submitted after the Δ3 persistence fix (#212) deployed. Prior validation had used no-brief takes, which leave the brief-achievement matrix, evidence binding and co-derivation unexercised — so this run was the first time those layers faced real input.

## Detail

### What worked

- **Δ2 discipline resolution holds live** — `auditions.discipline = musical_theatre` resolved correctly.
- **Δ3 gate fired with `action_count: 2`** — the first live ≥1-action audit trail; the persistence fix is confirmed on the brief-supplied path.
- **Evidence binding largely works.** The brief-supplied matrix populated 12 `requirement_results`, of which 10 were properly located — `linked_component_verification_ids` + `linked_observed_sequence_ids` resolving to `present`/`partially_present`. The gate flagged exactly the two genuine unlocated positives (`req010`/`req011`) and left the ten located rows alone — correct selectivity, assert-only as designed.

### Real findings

- **Δ6 — score coherence (structural, confirmed; Monday 2972065331, High).** Four disagreeing score/verdict representations persisted on one take: `report.overall_readiness` "94" / verdict "submit" (rendered) vs `takes.overall_score` 60 vs `score_breakdown.scores` all-zero/null vs matrix `overall_status` "mostly_achieved". The verdict ("Submit/Ready") contradicts the matrix ("mostly achieved, some mandatory gaps, review carefully"), and the "WHY THIS ISN'T READY" heading is wired to the wrong state. There is no single source of truth for score/verdict. This finding came from UI/PDF-vs-model reconciliation, independent of any query.
- **Δ3a — normaliser heuristic refinement (bounded; Monday 2971908011).** The text heuristic `mediaEvidenceSummaryLooksSupported` (`s10-brief-achievement-matrix.server.ts:512-529`) admits unlocated `admin_process` positives (Dropbox upload, copyright). The gate caught them downstream; the heuristic should be tightened for `admin_process` rows, which can rarely have located tape evidence.

### Corrected — method learning, not findings

Two findings initially raised in this run were **false**, both query artefacts, and were retracted on the board:

- "All 12 rows zero-anchored (Δ5/Δ4 gap)" — queried nonexistent JSON keys (`linked_component_ids` / `linked_verification_ids`). The correct keys are `linked_component_verification_ids` / `linked_observed_sequence_ids`, and they were populated.
- "`scoring_basis` null contradicts S10-07" — queried a scalar `scoring_basis` that does not exist; scoring basis lives at `scoring_context.scoring_basis_label` ("Brief supplied"), exactly as S10-07 specified, and persists correctly.

### Key learnings (durable principles)

1. **Verify JSON field names against the schema (`audition-rules.ts:950-951`) before reading meaning into a query.** An absent key returns empty/null and masquerades as a real negative finding. A nonexistent-key query is the data equivalent of a stale README assumption.
2. **A no-brief take cannot validate the brief-supplied path.** Binding and co-derivation are only actually exercised when a brief is supplied; quiet passes on no-brief takes structurally hide those layers.
3. **Payload-green ≠ render-correct.** The rendered UI was polished and tonally strong yet factually self-contradicting. Reconciling the persisted model against the route/PDF is mandatory — never payload parity alone (consistent with the AGENTS route/PDF-first acceptance rule). Δ6 was found _only_ because of that reconciliation.

### Maturity read

Gate + evidence-binding layers are more mature than first thought (mostly working). The score-coherence layer (Δ6) is the real exposed gap and the priority next move. The run validates the existing delta sequence rather than changing it.

## Open questions

None — both suspected findings from the initial pass were resolved (retracted as query artefacts) within the run; remaining work is tracked on the Monday items below.

## Links

- [[arch-d3-evidence-binding-gate-handoff-2026-06-07]] — the Δ3 handoff this run validates
- Monday 2972065331 — Δ6 score coherence (High)
- Monday 2971908011 — Δ3a normaliser heuristic tightening
- PR #212 — the Δ3 persistence fix this run exercised
