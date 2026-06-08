---
id: plan-d5-evidence-anchors
title: Δ5 plan/backlog — per-dimension evidence anchors (the L0→L1 foundation)
tier: corpus
status: active
spine_anchor: ["ADR-0008", "arch-report-derivation-architecture §8", "README §Calibration doctrine"]
decided_ref: "SRO ratification 2026-06-08 — D5.1–D5.5 recommendations accepted as plan of record"
monday_ref: "2967708093"
tags: [arch-deltas, planning, evidence-anchors, score-model, observation-invariance, cross-take-consistency]
confidence: high
created: 2026-06-08
updated: 2026-06-08
---

> **STATUS: RATIFIED (SRO, 2026-06-08) — D5.1–D5.5 recommendations accepted; Δ5's plan of record.** Δ5 is the foundation the Report Derivation Architecture puts first
> (arch-report-derivation-architecture §8). It changes the Step-1/Step-2 prompt structure; from-source facts
> cited to file:line on origin/main. The plan defines the term, maps the as-is, folds in the level-invariance
> fix, proposes slices + gates, and ends with the decisions the SRO needs to take to open the build.

## 1. The term, defined first

A **per-dimension evidence anchor** is a structured link from each scored dimension's MARK to the specific
located observations in Step 1 that justify it. The mark becomes a function of named, located evidence rather
than a holistic impression of the tape.

The model already does the two halves separately — Step 1 LOCATES (it observes the tape and records what is
there); Step 2 MARKS (it grades the dimensions). What is missing is the BINDING between them: today nothing
records "this mark was driven by these observations." Δ5 adds that binding. This is precisely the L0→L1 join the
architecture names (located evidence → marked dimensions).

## 2. Why Δ5 is the foundation (the goal)

Two things depend on anchoring, and neither is achievable without it:

- **Cross-take consistency** (the 8/10-then-4/10 trust problem). If a mark is a holistic guess, re-running the
  same tape can produce a different number. If a mark is a function of located, level-blind observations, the
  same tape yields the same mark. Anchoring is what turns the score into a stable function of the evidence —
  arch invariant 10, the MEASURED goal.
- **Auditability.** With anchors, every mark can show which observations drove it ("vocal pitch: anchored to
  obs #4, #7"). Without them, "why this score?" has no structural answer — only prose that can drift.

Score honesty on a minors-facing verdict depends on the number being defensible from located evidence. Δ5 is
what makes that structurally true rather than asserted.

## 3. The as-is (from source, origin/main)

- **Step 1 already emits located evidence**, but at COMPONENT / TIMESTAMP granularity, not per-scored-dimension:
  `observed_tape_sequence` (array ≤30, `process-take.server.ts:1192`), `component_verifications` (array ≤40, one
  per brief requirement, `:1199`), `media_observation_summary` (`:1206`); all three required (`:2195-2197`) and
  flagged as "the component evidence source" produced before the brief matrix (`:2293`). Step 1 also emits
  `timestamped_evidence` and `candidate_technique_evidence`. These located entries ALREADY carry stable
  identifiers (`observed_tape_sequence[].id` `:433`, `component_verifications[].requirement_id` `:488`, both
  required), so S2 anchors reference EXISTING IDs — no new ID scheme is needed.
- **"evidence_anchor" today is only a PROVENANCE label**, not a per-dimension binding — it appears as an enum
  value in the correction `source` (`:915`) and note `note_source_authority` (`:1004`) lists. There is no
  structure tying a dimension's mark to observation IDs.
- **Step 2 marks the dimensions** — the flat `scores` that feed the overall (`:1231`) and the public
  `category_scores` (`:1491`) — but the binding "this mark ← these observations" is NOT structural; grading is
  holistic against the evidence bundle. (A free-text `score_basis` exists, but prose is not a stable, checkable
  anchor.)
- **The observation pass is level-contaminated.** `levelBlock = buildS10PerformerLevelPromptBlock(auditionLevel)`
  is built at `:3475` and injected into the Step-1 `evidenceContext` at `:3693` (the two-step path,
  `isTwoStepEnabled()` `:3688`). So Step 1 is told the performer's level, which can colour what it "observes" —
  breaking observation invariance before any marking happens.
- **The Step-1→Step-2 evidence handoff is partial and fragile.** The compact Step-1 path maps only
  `observed_tape_sequence` + `component_verifications` into the EvidencePass; `timestamped_evidence` and
  `candidate_technique_evidence` "arrive empty even though the model emitted them," patched by a
  `projectFilteredStep1EvidenceForPolish` workaround (`:4077-4086`). Anchors must not be lost on this handoff.

## 4. The gap (what Δ5 closes)

1. No per-dimension anchor binding — marks are not tied to located observations.
2. Observation is level-coloured — Step 1 must be level-blind for anchors to mean anything.
3. The evidence handoff drops two arrays and relies on a workaround — anchoring would be lost through it.

## 5. Design decisions for the SRO (options · recommendation · impact)

**D5.1 — Anchor granularity.**
- A) Anchor the internal dimensions only (the flat `scores` that compute the overall).
- B) Anchor dimensions AND the public categories.
- **Recommendation: A.** Categories and components are DERIVED from the dimensions/components under Δ4, so
  anchoring the base layer propagates upward; anchoring categories too duplicates the binding and adds model
  burden. *Impact:* smaller schema/model change; categories inherit anchoring via the Δ4 roll-up.

**D5.2 — Binding mechanism.**
- A) Each dimension mark carries an array of observation IDs referencing the EXISTING `observed_tape_sequence[].id` /
  `component_verifications[].requirement_id` entries.
- B) Keep free-text `score_basis` only.
- **Recommendation: A.** Structured observation-ID references are what make the mark auditable and stable;
  free text gives neither cross-take stability nor a checkable guarantee. *Impact:* add a `supported_by:
  [obs_id,…]` array on each marked dimension referencing the existing observation IDs; enables a conformance
  check (every ASSESSABLE, non-null mark cites ≥1 real observation; null/not-assessable marks — e.g. a
  dimension whose material is absent, the canary-A case — are exempt, anchored to the absence evidence where
  present).

**D5.3 — Fold in the level-invariance fix.**
- **Recommendation: YES.** Remove `levelBlock` from the Step-1 `evidenceContext` (`:3693`) so Step 1 is a pure,
  level-blind observation pass; level enters only at Step-2 marking. *Impact:* small and surgical, and it is the
  PRECONDITION for anchoring — anchors must be level-blind observations, otherwise the same tape at two levels
  produces different "evidence." Resolves the loose Δ6/Δ7 residue by landing it where it belongs.

**D5.4 — How cross-take consistency is verified.**
- It is a MEASURED goal, not a CI invariant (arch §6, invariant 10).
- **Recommendation:** a determinism harness — run the Hannah Willars reference tape N times at temp-0/cache and
  measure mark variance; target near-zero variance on the anchored dimensions, verdict stable. Plus the canary
  fixtures. *Impact:* Δ5 gets a real pass/fail gate without pretending consistency is a unit invariant.

**D5.5 — Clean up the fragile evidence handoff.**
- A) Fix it inside Δ5 (Δ5 already touches the Step-1→Step-2 pass): route the full located-evidence set through
  cleanly and retire the `polishEvidenceProjection` workaround.
- B) Leave it; only add anchors.
- **Recommendation: A.** Leaving a known-fragile handoff while adding a new dependency (anchors) through it
  invites silent loss. *Impact:* removes the workaround; one fewer fragile path. Shared-module change → dry-run
  discipline applies.

## 6. Proposed slices (each a held PR, reviewed from source, gated)

- **Δ5-S1 — Level-invariant observation pass.** Remove `levelBlock` from the Step-1 `evidenceContext` (`:3693`) —
  verified the ONLY leak site; the other four `levelBlock` uses (single-pass `userText` `:3483`, Step-2 polish
  `:4174`/`:6278`/`:6312`) are marking contexts and are retained. Add a deterministic integrity guard that the
  EXISTING observation IDs (`observed_tape_sequence[].id`, `component_verifications[].requirement_id`) are unique
  and non-empty so S2 can anchor against them. **Gate:** the same tape produces identical Step-1 observations
  across levels (observation-invariance test); existing dry-run parity holds.
- **Δ5-S2 — Per-dimension anchor binding.** Add `supported_by` observation-ID references to each marked dimension
  (Step 2); the marking function grades each dimension against its bound evidence. **Gate:** conformance check —
  every assessable, non-null dimension mark cites ≥1 real observation ID (null/not-assessable marks exempt —
  anchored to the absence evidence where present); no orphan marks; canary-A still zero gate actions.
- **Δ5-S3 — Clean evidence handoff.** Route the full located-evidence set (incl. timestamped + technique)
  through the Step-1→Step-2 pass; retire `projectFilteredStep1EvidenceForPolish`. **Gate:** dry-run parity; no
  fallback-shell collapse.
- **Δ5-S4 — Determinism / consistency harness.** Reference-tape variance harness (Hannah Willars, N runs) +
  canary fixtures. **Gate:** near-zero mark variance on anchored dimensions; verdict stable.

Order: S1 → S2 → S3 → S4 (level-blindness first, then anchoring, then handoff, then measurement). S1 and S2 are
the load-bearing pair; S3 de-risks; S4 proves the goal.

## 7. Dependencies, safety, sequencing

- **Downstream:** Δ4 (category/component roll-up) consumes Δ5's anchored dimensions; Δ7 (rubric + prose
  co-derivation) consumes both. So Δ5 lands first.
- **Safety discipline:** Δ5 changes Step-1/Step-2 prompt structure and shared modules → `npm run
  dry-run:analysis-worker` on every shared-module change; **canary-A zero-gate-actions is a binding stop-gate**.
- **Persisted values:** no live users, so mark shifts are forward-only/benign; Δ10 rebaseline still MEASURES the
  effect (run after, to recalibrate). Overall FORMULA is unchanged by Δ5 (Δ5 changes inputs' provenance, not the
  blend) — but inputs move, so the Δ4 canary-diff gate still applies when Δ4 builds on this.
- **Provenance to confirm in-build (carried from arch §9 / memory):** the F1–F9 inversion table is quarantined
  pending re-derivation; any conformance tests Δ5 adds should name the spine clause they enforce (the MAST
  verification-failure lesson).

## 8. Plan-gate asks (what I need from you to open Δ5)

1. **D5.1** anchor granularity — confirm dimensions-only (rec).
2. **D5.2** binding mechanism — confirm structured observation-ID references (rec).
3. **D5.3** confirm folding the level-invariance fix into Δ5-S1 (rec).
4. **D5.4** confirm the determinism-harness approach to measuring consistency (rec).
5. **D5.5** confirm cleaning the evidence handoff inside Δ5-S3 (rec).

On your decisions I record the ratified plan on Monday (Δ5, 2967708093) and draft the first held Code prompt
(Δ5-S1). Nothing is committed or fired until you approve.

## Links
- [[arch-report-derivation-architecture]] — the spine; Δ5 is its §8 foundation.
- [[arch-d6-score-model-architecture]] — analysis-precedes-the-score principle.
- ADR-0008 (plain text — docs/architecture/adr/) — the canonical-score invariant.
- Monday: Δ5 2967708093 · Δ4 2967669003 (consumer) · Δ7 2967722202 (consumer) · Δ10 2967682227 (rebaseline).
