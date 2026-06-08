---
id: arch-d6-canonical-score-computation-spec
title: Canonical score computation spec — pure deterministic; the single A-contamination site (min) removed
tier: corpus
status: current
spine_anchor:
  [
    "ADR-0008",
    "README §Professional 0–100 level-relative score calibration",
    "README §Performer Level Calibration Architecture",
    "AGENTS §Score terminology alignment",
  ]
decided_ref: "ADR-0008"
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "Δ6 canonical computation spec, from-source trace 2026-06-07, origin/main; jointly verified with Claude Code"
discipline: null
monday_ref: "2967682223"
tags:
  [arch-deltas, decisions, score-model, canonical-score, conformance, pipeline, level-calibration]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Purpose

The single source-of-truth definition of the canonical score, sitting between ADR-0008 (the decision) and
the Δ6 build slices (the implementation). It is the operational detail the ADR-0008 addendum points to.
Once ratified, every slice is "point surface X at this computation" — no surface should force a
re-derivation or a definitional fork. Ratified by the operator 2026-06-07; the safety call (canary 42→54,
verdict unchanged) and the "canonical = pure deterministic, strictness tuned via the three levers, never
via quashing or A-override" principle are recorded in the ADR-0008 addendum.

## The single A-contamination site (verified — exactly one)

A full from-source trace of every place the AI judgement could touch the NUMBER found exactly one site:
the `min(.,A)` at `s10-readiness-score-semantics.server.ts:636-639`
(`overall = A != null ? Math.min(currentOverallScore, A) : currentOverallScore`), matrix-capped at
:641-650. The deterministic chain (recompute → audio cap → role-fit → matrix cap) never reads A; the AI
judgement object A is computed in parallel and touches the number only at that `min`. The verdict path
(deterministic verdict from the number at level bands; rendered verdict reads A's decision — the known V3
divergence) and the sub-surfaces (category scores clamped only; brief_adherence and material_compliance
capped against the MATRIX via `capNumberField`, not against A) contain NO further hidden A-movers. Slices
2 and 3 are therefore the same render-reads-A architecture, fixed the same way (re-point to canonical),
with no additional landmines — the spec is verified-complete for all three slices, not provisional.

## The canonical computation (definition of D)

The canonical score is the pure deterministic value; the AI marks the per-dimension scores that feed the
recompute but never moves the resulting number.

- N1 recompute — `recomputeOverall(report.scores, weightsForType(type))` (process-take.server.ts:5236);
  weighted mean of AI-marked category scores; missing categories dropped + renormalised (audition-rules.ts:707-731);
  MT weights {acting .3, vocal .3, brief_adherence .15, technical .15, audio .1} (audition-rules.ts:632-639).
- N2 audio cap — CONDITIONAL: `<35→60, <50→62, <60→75` (process-take.server.ts:5246-5248, 5331-5333). Fires
  only when audio is poor; audio ≥60 → no cap.
- N3 role-fit — clamped [-10,+5], 0 in baseline (process-take.server.ts:5311-5334).
- N4a CANONICAL CHANGE — replace the `min(.,A)` at sem:636-639 so `overall = currentOverallScore` (the
  deterministic value); the AI judgement no longer enters via min.
- N4b matrix cap (UNCHANGED) — `if overall > constraint.cap → overall = constraint.cap`
  (sem:641-650; deriveReadinessConstraint :175-201; hard blocker → 54, mandatory gap → 69, else none;
  isHardMandatoryBlocker :144-148).

Canonical D = recompute → audio cap → role-fit → matrix cap. No `min(.,A)`.

100 is attainable: every ceiling is conditional on something being wrong (audio cap only when audio <60;
matrix cap only on blocker/gap; recompute has no internal ceiling). Audio-prime disciplines (commercial,
voice, singing) are governed by the per-discipline weights (`weightsForType`), not by an artificial ceiling.

## Surface bindings (every surface derives from the canonical number)

- Report-detail headline — today A (v2-report-builder.server.ts:306-307); must read canonical D (withhold-null
  preserved). Slice 1.
- Report-detail verdict — today A's decision (v2-report-builder.server.ts:318-322); must derive from canonical
  D at level-relative bands. Slice 2.
- Report-detail category scores — today A, uncapped (v2-report-builder.server.ts:343-352); must be canonical,
  matrix-capped. Slice 3.
- Report-detail material_compliance — today A's brief_completion_score (v2-report-builder.server.ts:424); must
  be canonical. Slice 3.
- Take list / dashboard / ranking / admin — render `takes.overall_score`, today = min(det,A) (A-contaminated
  where A<det); becomes canonical D automatically once N4a removes the min. This movement is the fix, not a
  regression, and supersedes the earlier "do not move the aggregates" framing (which rested on the false
  premise that they already showed pure D). See the ADR-0008 addendum.

## Withhold semantics (preserved exactly)

When the S10 model deliberately withholds (score_summary/readiness null — H1 observed-tape reconcile at
s10-report-view-model.server.ts:574; missing-readiness), the headline stays null. Selector shape:
`s10View ? (withheld ? null : canonicalD) : legacyD`. Matrix caps (N4b) remain — an incomplete package is
still capped into the retake/review band; removing the min does not remove the cap.

## Fixture expected outputs (from source; the ratifiable numbers)

- Strong-complete-professional: recompute 93; no matrix cap; A 91; today persisted min(93,91)=91; CANONICAL D
  = 93; headline rises 91→93; verdict submit/ready.
- Canary-A-incomplete: recompute 66; matrix cap 54 (hard blocker); A 42; today persisted min(66,42)=42;
  CANONICAL D = 54; headline rises 42→54; verdict RETAKE (matrix decision cap holds).
- Repro-B audio-capped (TO BE ADDED): A high (e.g. 94); audio cap pulls deterministic below A → D=60; today
  persisted ~60; CANONICAL D = 60; headline FALLS 94→60. This is the only case that proves the headline fix in
  the INFLATION direction — neither named fixture exhibits it (in both, A < deterministic), so this fixture
  MUST be added.

## Build-mechanics note

Removing the min shifts the meaning of the function's `capped` return flag (sem:715:
`overall !== currentOverallScore`) — it now means "matrix-capped" rather than "min-or-matrix moved". The
build must re-point that flag's semantics and any test asserting it, deliberately.

## Build sequence

1. Slice 1 (headline + the N4a edit): remove min at sem:638; re-point headline to canonical D (withhold-null
   preserved); add the Repro-B audio-capped fixture; correct the canary fixture's false-positive D-side to
   honest inputs and assert canonical D=54; assert strong canonical D=93; re-point the `capped` flag semantics;
   selective re-pin of the guard test (preserve null-on-missing, source_map, legacy_projection); assert
   aggregates equal the headline (cross-surface consistency). Slice 1 legitimately includes the pipeline min
   removal — not render-only.
2. Slice 2: verdict → canonical D at level-relative bands (V1-V3).
3. Slice 3: category scores + material_compliance → canonical, matrix-capped (S1-S2).
   Each test-first, PR-and-hold, scoring-path blast-radius (manual-approval + dry-run + canary + worker redeploy).

## Links

- [[arch-d6-phase1-as-is-score-map]] — the verified as-is divergence inventory this spec operationalises.
- [[arch-d6-score-model-architecture]] — the target architecture.
- [[arch-d6-spine-reconciliation]] — the conformance-test requirement.
- [[gemini-flash-lite-assessment-learnings-2026-06-07]] — the separate upstream extraction-quality concern
  (ingestion/model), distinct from this scoring/render spec.
- ADR-0008 (plain text — lives in docs/architecture/adr/, outside the vault) — the decision and its
  operational-definition addendum that this spec details.
- Monday: Δ6 2967682223.
