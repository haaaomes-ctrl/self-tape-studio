---
id: arch-d5-s2-per-dimension-anchor-binding
title: Δ5-S2 — per-dimension evidence anchor binding (supported_by on the marked layer)
tier: corpus
status: active
spine_anchor: ["plan-d5-evidence-anchors §1", "arch-report-derivation-architecture §8", "ADR-0008"]
decided_ref: "SRO go-ahead 2026-06-09 — S2 build commissioned on the design below; vault note committed in the same PR"
monday_ref: "2967708093"
tags: [arch-deltas, evidence-anchors, score-model, observation-binding, auditability]
confidence: high
created: 2026-06-09
updated: 2026-06-09
---

> **STATUS: BUILD COMMISSIONED (SRO, 2026-06-09).** S2 implements the per-dimension binding defined in
> [[plan-d5-evidence-anchors]] §1. From-source facts cited to file:line on `main`. Code + tests + this note land
> in one PR (held for verification, then SRO merge).

## 1. What S2 binds

A **per-dimension evidence anchor** links each scored dimension's MARK to the specific Step-1 observations that
justify it. S2 records this as `supported_by` — an array of Step-1 observation IDs — on each `category_scores`
item. The mark becomes traceable to named, located evidence rather than a holistic impression.

## 2. Attach point — the marked layer (post-Δ4-S1)

Δ4-S1 made the flat L1 dimension scores a deterministic projection of the marked L2 `category_scores`, so
`category_scores` is now the single authoritative *marked* layer. `supported_by` therefore attaches to each
`category_scores` item (the plan's "internal dimensions" wording predates the Δ4-S1 collapse; the practical,
coherent anchor point is the marked category scores). The public L1 projection inherits nothing it does not need —
anchors live with the marks.

## 3. Reference space — existing Step-1 observation IDs

`supported_by` references IDs that already exist and are already stabilised: `observed_tape_sequence[].id` and
`component_verifications[].requirement_id`. Δ5-S1's `applyObservationIdIntegrityGuard` de-duplicates/repairs these
IDs; S2 validates anchors against that **guarded** ID set. No new ID scheme is introduced.

## 4. Exemption (the canary-A case)

A dimension with `score: null` or a non-empty `blocked_or_not_assessable_reason` is **exempt** from requiring an
anchor — a not-assessable or blocked mark legitimately has no supporting observation. The S10 "incomplete package"
canary must therefore produce zero missing-anchor flags.

## 5. Enforcement — deterministic orphan-check, not a hard schema gate

`supported_by` is OPTIONAL in the tool schema and defaulted to `[]` by the normaliser, so no construction path can
emit an undefined value and the model is not hard-failed for an absent field. Presence is driven by the Step-2
prompt and MEASURED deterministically after marking:
- orphan IDs (citing no real Step-1 observation) are dropped and metered (`s10_supported_by_orphan_dropped`);
- a non-exempt mark that ends with no valid anchor is flagged (`s10_supported_by_missing_for_scored_dimension`).
This makes incomplete adoption visible without destabilising the pipeline — consistent with measuring consistency
rather than asserting it.

## 6. Guard ordering

The orphan-check validates against the guarded observation ID set, and the guard runs on the Step-1 observations
before Step-2 marking sees them, so the model cites already-stabilised IDs. If the pre-Step-2 guard placement
entangles with the broader Step-1→Step-2 handoff rework reserved for S3, S2 keeps the (safe) orphan-check and the
guard move defers to S3.

## 7. Boundary vs the pre-existing evidence-anchor system

`supported_by` is distinct from the existing `evidence_anchor` provenance (a `source` value on timestamped
notes/warnings) and the S9 section-level `evidence_anchor_trace` / `source_family` QA gate — those are
section/claim-level provenance, a different granularity and purpose. S2 reuses the same observation ID space for
consistency but keeps `supported_by` as its own per-mark field. Surfacing per-mark anchors into the S9 QA trace is
a deliberate later concern, not part of S2.

## 8. Score integrity

Anchoring is what makes the score a stable function of located evidence and makes "why this score?" answerable
from structure rather than prose. It serves every user's report equally — a defensible, evidence-bound number.
