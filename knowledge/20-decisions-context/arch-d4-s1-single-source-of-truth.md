---
id: arch-d4-s1-single-source-of-truth
title: Δ4-S1 — single source of truth for scores (flat L1 is a projection of marked L2)
tier: corpus
status: active
spine_anchor: ["arch-d6-canonical-score-computation-spec", "arch-report-derivation-architecture §D3"]
decided_ref: "SRO-approved 2026-06-09 — Δ4 brought forward as a root-cause L1↔L2 reconciliation; PR #251 (da986619), live-validated on the Hannah take (60→98)"
monday_ref: "2967669003"
tags: [arch-deltas, score-model, single-source-of-truth, l1-l2-reconciliation, deterministic-score]
confidence: high
created: 2026-06-09
updated: 2026-06-09
---

> **STATUS: MERGED (PR #251, da986619) + LIVE-VALIDATED.** Backfilled note — the decision predates the
> vault-note-in-PR rule. From-source facts cited to file:line on `main`. This is the foundation
> [[arch-d5-s2-per-dimension-anchor-binding]] and the [[arch-d6-canonical-score-computation-spec]] both build on.

## 1. The decision

There is **one source of truth for dimension scores**: the marked L2 layer
(`readiness_score_judgement.category_scores`). The performer-visible flat L1 scores
(`report.scores` — the six `PUBLIC_CATEGORIES`) are a **deterministic projection of L2**, not an independent
input. The model's own flat `scores` object is non-authoritative and is never consumed as a score.

## 2. The defect it fixed (root cause)

The model returned its flat L1 `scores` object as a **zeroed/null skeleton on every take**, while the real marks
sat correctly in L2 `category_scores`. The report builder already re-derived real flat scores from L2 for the
report JSONB — but the finalising recompute, the `takes.scores` column, and the canonical category scores all
read the **zeroed L1**. The cascade: `recompute(zeros) = 0`, then a holistic-overall fallback substituted the
model's own overall A, and the zeroed audio dimension tripped the audio cap → a flat **60** on takes that
deserved far more. The "deterministic" headline was, in effect, the AI's number capped — exactly what the
canonical-score guarantee forbids.

## 3. The mechanism

A single helper module is now the one place dimension scores are shaped: `src/server/score-projection.server.ts`
— `deriveDimensionScoresFromCategoryScores` (`:73`), `PUBLIC_CATEGORIES` (`:33`), `clampScore` (`:56`). On the
S10 path, `process-take.server.ts` projects L2 → `report.scores` from the marked category scores **before** the
recompute (`:5308`–`:5329`), so the recompute reads real values. The holistic-overall `||` fallback is gone on
that path: the recompute, gating and cap now live in the pure `resolveFinalisedOverall` (`score-projection
:116`), which takes the model overall **only as a diagnostic** (`process-take :5340`–`:5344`) and never
substitutes it. The report builder is consolidated onto the same helper; the audio cap is the shared
`applyAudioCap` (`audition-rules :883`); the model's flat `scores` schema field is marked `@deprecated` for
staged removal (`process-take :1236`). A new metric `s10_deterministic_overall_missing` (`metrics :157`) fires if
a marked take ever yields a 0/NaN deterministic overall — a contract anomaly, not a reason to fall back to A.

## 4. The invariant

The deterministic overall is computed from the **marked dimensions + caps**; the AI never emits or moves the
headline number. Honest derivation from located, marked evidence — asserted nowhere, computed everywhere.

## 5. Validation

The Hannah reference take went from overall **60 → 98** post-merge; the `takes.scores` column changed from a
zeroed skeleton to real values byte-identical to `report.scores`; every surface agreed on 98; the model's
holistic A was logged as a diagnostic, not substituted.

## 6. What builds on this

Δ4-S1 makes `category_scores` the single authoritative marked layer, which is precisely what
[[arch-d5-s2-per-dimension-anchor-binding]] anchors `supported_by` onto, and what the
[[arch-d6-canonical-score-computation-spec]] computes the canonical score from.

## 7. From-source anchors (`main`)

- `src/server/score-projection.server.ts` — `PUBLIC_CATEGORIES` `:33`, `clampScore` `:56`,
  `deriveDimensionScoresFromCategoryScores` `:73`, `resolveFinalisedOverall` `:116`.
- `src/server/process-take.server.ts` — `@deprecated` model flat `scores` `:1236`; S10-path projection
  `:5308`–`:5329`; `resolveFinalisedOverall` call with model overall as diagnostic `:5340`–`:5344`; final overall
  assignments `:6090`–`:6097`.
- `src/lib/audition-rules.ts` — shared `applyAudioCap` `:883`.
- `src/server/metrics.server.ts` — `s10_deterministic_overall_missing` `:157`.
