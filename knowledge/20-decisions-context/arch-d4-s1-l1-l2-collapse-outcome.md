---
id: arch-d4-s1-l1-l2-collapse-outcome
title: Δ4-S1 outcome — single source of truth for the flat dimension scores (L1 = deterministic projection of marked L2 category_scores); repairs the degenerate input to the deterministic overall D
tier: corpus
status: current
spine_anchor:
  [
    "ADR-0008",
    "README §Professional 0–100 level-relative score calibration",
    "AGENTS §Score terminology alignment",
    "AGENTS §Code responsibilities",
  ]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "Δ4-S1 build + addendum, 2026-06-09, merged to origin/main as #251 (squash da986619), on top of the prerequisite lockfile resync #252 (e5510932) and CI hardening #253 (65de12a8). Implemented by the engineer pair (developer + senior-dev, APPROVE round 1 on both the base change and the addendum) under SRO direction; orchestrated via Claude Code. Root-cause investigation against origin/main @ c8748c62 + the live owned Supabase."
discipline: null
monday_ref: null
tags:
  [
    arch-deltas,
    decisions,
    score-model,
    canonical-score,
    category-scores,
    dimension-scores,
    deterministic-overall,
    single-source-of-truth,
    conformance,
    pipeline,
  ]
confidence: high
created: 2026-06-09
updated: 2026-06-09
---

## Summary

Δ4-S1 makes the flat **L1** dimension scores a **deterministic projection of the marked L2
`category_scores`** (`readiness_score_judgement.category_scores`), establishing a single source of
truth, and demotes the model's own flat `scores` object to a non-authoritative/vestigial input.
This is the **Δ4 slice** of the [[arch-report-derivation-architecture]] dependency order (Δ5 → **Δ4**
→ Δ6-tail → Δ7) and the implementation that **repairs the degenerate INPUT to the deterministic
overall D** which [[arch-d6-phase1-as-is-score-map]] documented but did not catch was being fed
zeros on the live path. The overall is **not reshaped** — it stays the as-is capped weighted blend +
bounded role-fit; only its input is repaired. Merged #251 (`da986619`).

## Context / why

The as-is map's number-drift source **N1** ("recompute: `recomputeOverall(modelScores, weights)`
yields a number that can differ from A") silently assumed `modelScores` (= `report.scores`) held the
real per-category marks. It does not. On the live two-step path the model returns its flat `scores`
object as a **zeroed/null skeleton on every take** (`{audio:0, vocal:null, acting:0, technical:0,
brief_adherence:0, professional_presentation:0}`); nothing populated `report.scores` from L2 before
the deterministic recompute. Consequences, all from the one zeroed input:

- `recomputeOverall` returned ~0, so the finalising line `overall = recomputed.overall ||
  (report.overall_score) || 0` **fell back to the model's holistic overall A** — the precise
  A-over-D substitution the whole Δ6 canonical-score programme exists to prevent.
- The zeroed `audio` (0) then tripped the `<35 → 60` audio cap, clamping the substituted A **down to
  60**. Net live result on the canonical reference take (a clean professional self-tape that should
  score ~90): persisted `overall_score = 60` with a "retake required" verdict, while the report body
  showed the real, excellent dimension scores.
- Because [[arch-d6-slice3-outcome-material-compliance-honesty]] wired the visible category surface
  to read `report.scores[category_id]`, the live `canonical_category_scores` (and the persisted
  `takes.scores` column) were **mostly 0**.

So the Δ6 "converge every surface toward D" work was converging toward a **D that was broken at its
input** — degenerate because the marked dimensions never reached the recompute. This is
pre-existing and systemic (every completed take going back days showed it), **not** a regression from
the Δ5-S1 observation-pass work. Material-compliance was unaffected (derived separately) and the
marking itself (the L2 `category_scores`) was always correct — only its projection to L1 and onward
to D was broken.

## Detail

**The fix — single source of truth.**

- One shared pure helper `deriveDimensionScoresFromCategoryScores(category_scores)` reduces the
  marked L2 rows → the flat L1 map, restricted to `PUBLIC_CATEGORIES`, clamped to `[0,100]` integers,
  **omitting** (never zeroing) missing/invalid/null rows. It lives in the new
  `src/server/score-projection.server.ts`, which now owns `PUBLIC_CATEGORIES` + the clamp, and is the
  **single** implementation — `buildV2Report`'s previously-inlined reduce now calls it (JSONB output
  byte-identical for takes with present `category_scores`).
- `process-take.server.ts` populates `report.scores` from that projection **before** the finalising
  recompute, on the S10 path only (legacy/no-`category_scores` reports untouched). It derives from the
  **same normalised source** `buildV2Report` consumes —
  `buildS10PerformerReportViewModel(...).score_summary.category_scores` — so the process-take map is
  byte-identical to the persisted JSONB `scores`. (Equivalence holds because both call sites pass the
  same observation-context constraints, so `reconcileReadinessWithObservedTape`'s null-on-contradiction
  applies identically on both sides.)
- The A-over-D fallback (`|| report.overall_score`) is **removed on the S10 path**: deterministic D is
  used directly; a genuinely missing/NaN D emits `metric("s10_deterministic_overall_missing")` rather
  than silently substituting A. The legacy path keeps `recomputed.overall || modelOverall || 0`.
- With real audio in `report.scores`, the audio cap is correctly armed (no longer tripped by a phantom
  zero).
- The model's flat `scores` schema field is marked `@deprecated` (vestigial; retained only because the
  model still emits it — removal is a staged schema-contract change, not done here).

**The overall is NOT recomputed/reshaped** — consistent with [[arch-report-derivation-architecture]]
(§"The overall score is NOT recomputed"). Δ4-S1 only repairs the INPUT so the existing capped weighted
blend computes a real number instead of ~0.

**Addendum (same PR, behaviour-preserving consolidation).** Extracted the tiered audio cap into one
pure `applyAudioCap(overall, audio)` in `audition-rules.ts` (previously duplicated inline in
process-take and inside `applyCapsAndLabel`); extracted the finalising recompute + S10/legacy gating +
cap into a pure, unit-tested `resolveFinalisedOverall(...)` (the test now calls the real function
rather than mirroring it); consolidated two byte-identical `clampScore(value, fallback=0)` copies into
`clampScoreWithFallback`. The `?? 100` audio magic-default was removed in favour of `audio ?? null` +
the `audio != null` guard (behaviourally identical).

**Conformance.** New tests pin: the helper omits/clamps correctly; the finalising recompute uses the
L2-derived scores and yields D (not A) with no spurious cap on a Hannah-shaped fixture (rich
`category_scores`, zeroed model flat scores); the legacy guard holds; `applyAudioCap` tiers. Full
gates green (tsc, prettier, eslint, `dry-run:analysis-worker`, build, vitest 1706 pass / 3 known
pre-existing fails / 0 new, canary-A zero gate actions).

**Net effect on the canonical surfaces.** `canonical_category_scores` and the `takes.scores` column
now carry the real marked values, and the report-headline overall equals the real deterministic D
(no spurious audio cap) on the S10 path — i.e. the Δ6 Slice-3 canonical category surface and the
canonical headline finally carry non-zero, true values live.

## Open questions

- **Historical takes.** Takes analysed before #251 persisted the degenerate capped-60 overall and
  ~0 `canonical_category_scores`. Whether to run a post-fix re-analysis sweep to refresh them (vs
  leave forward-only) is open — relates to the deferred post-launch re-analysis sweep noted in
  [[arch-d6-slice3-outcome-material-compliance-honesty]].
- **Vestigial model flat `scores` field.** Still emitted by the model and carried in the schema
  (`@deprecated`). Removing it is a staged schema-contract change, not yet scheduled.
- **`clampScore` variants.** Two byte-identical copies were consolidated; the null-returning
  projection clamp and the max-bounded `(value, max)` variant in `s10-brief-achievement-matrix` are
  intentionally distinct and were left — a fuller audit of clamp contracts is a follow-up.
- **Vestigial legacy overall branch.** The as-is map notes the legacy/no-S10 render branch is
  unreachable in production; Δ4-S1 deliberately preserved its behaviour rather than removing it, so
  the dead-branch cleanup remains open.

## Links

- [[arch-report-derivation-architecture]] — the Δ4 design front-end; sets the Δ5 → Δ4 → Δ6-tail → Δ7
  order and the "overall is NOT recomputed" rule Δ4-S1 honours.
- [[arch-d6-phase1-as-is-score-map]] — the as-is forensic whose N1 input assumption (marks reach the
  recompute) Δ4-S1 repairs; a "now fixed" pointer was added there.
- [[arch-d6-slice3-outcome-material-compliance-honesty]] — wired the visible category surface to
  `report.scores[category_id]`; Δ4-S1 is why those values are now real (non-zero) live.
- [[arch-d6-canonical-score-computation-spec]] — the canonical D computation Δ4-S1 feeds correct input to.
- [[arch-d6-score-model-architecture]] — the decided target (AI marks dimensions; never owns the number).
- ADR-0008 (plain text — lives in docs/architecture/adr/, outside the vault) — the canonical-score
  decision this slice implements.
