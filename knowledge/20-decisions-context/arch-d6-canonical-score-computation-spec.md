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
source_ref: "Δ6 canonical computation spec, from-source trace 2026-06-07, origin/main; jointly verified with Claude Code. Render-locus correction 2026-06-08 (from-source trace, origin/main): all four report-detail surfaces render from the view-model chokepoint (buildS10PerformerReportViewModel), not the v2-report-builder payload lines previously cited; capped-flag clause restored to both terms."
discipline: null
monday_ref: "2967682223"
tags:
  [arch-deltas, decisions, score-model, canonical-score, conformance, pipeline, level-calibration]
confidence: high
created: 2026-06-07
updated: 2026-06-08
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
2 and 3 are therefore the same render-reads-A architecture, fixed the same way (re-point the view-model
chokepoint + the visible render to a distinct canonical field — see the render-locus correction in §Surface
bindings), with no additional landmines — the spec is verified-complete for all three slices, not provisional.

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

**Render-locus correction (from-source trace, 2026-06-08, origin/main — supersedes the `v2-report-builder`
line citations carried in the earlier draft of this section).** The four performer-visible report-detail
fields are NOT rendered from `v2-report-builder.server.ts` — those lines assemble the V2 _payload_ and feed
only the legacy/non-S10 render branch. For S10, the visible surfaces — `V2ReportView.tsx` (ScoreRing,
decision, category, brief-adherence) and the PDF model `src/lib/report-view-model.ts` — read the **view-model
chokepoint**: `buildS10PerformerReportViewModel`'s `recommendation` + `score_summary` assembly
(s10-report-view-model.server.ts ~:1483-1510), every field sourced from `readiness` (= A). Canonical D is NOT
currently present on that view-model object. So each slice must (i) thread the persisted canonical value
(`takes.overall_score`, canonical after N4a) into `buildS10PerformerReportViewModel`'s input and surface it
as a DISTINCT canonical field on the view-model object, and (ii) re-point the visible render to read that
field, gated by the EXISTING provenance predicate (`s10ScoreAuthorized` etc.) so the withhold seam is
unchanged. `readiness`/`score_summary`/`recommendation` STAY = A — they feed narration, gating, the ≥90
suppression, the observed-tape reconcile and `numericScoresVisible`; canonical values are added alongside,
never overwritten. Making the persisted number canonical (N4a) is necessary but NOT sufficient for the
visible surface.

- Report-detail headline — visible render reads `score_summary.overall_submission_readiness_score` (= A;
  `visibleS10Score`, s10-report-view-model.server.ts ~:1281-1283) at `V2ReportView.tsx` ScoreRing (~:797-801)
  and PDF `report-view-model.ts` (~:1024-1028). Fix: surface a distinct `canonical_overall_score` (= D) on the
  view model; re-point both render reads to it via `s10ScoreAuthorized ? canonicalD : null`. The
  `v2-report-builder.server.ts:306-308` `overall_readiness` payload field is also re-pointed to D (cross-surface
  / QA / legacy-branch consistency), but it is NOT the visible headline. Slice 1.
- Report-detail verdict — visible render reads `recommendation.decision` (= A's decision) at `V2ReportView.tsx`
  (~:814/:820) and PDF `report-view-model.ts` (~:1006). Fix: derive a canonical verdict from D at level-relative
  bands, surface it as a distinct view-model field, re-point the render. Slice 2.
- Report-detail category scores — visible render reads `score_summary.category_scores` (= A) at `V2ReportView.tsx`
  (~:881) and PDF `report-view-model.ts` (~:1030). Fix: surface canonical, matrix-capped category scores as a
  distinct view-model field, re-point the render. Slice 3.
- Report-detail material_compliance — visible render reads `score_summary.brief_completion_score` (= A;
  section-source-map module `readiness_score_judgement.brief_completion_score`) at PDF `report-view-model.ts`
  (~:1667 `briefCompletion`) and the `V2ReportView.tsx` brief-adherence section. Fix: surface a canonical
  material_compliance as a distinct view-model field, re-point the render. Slice 3.
- Take list / dashboard / ranking / admin — render `takes.overall_score`, today = min(det,A) (A-contaminated
  where A<det); becomes canonical D automatically once N4a removes the min. This movement is the fix, not a
  regression, and supersedes the earlier "do not move the aggregates" framing (which rested on the false
  premise that they already showed pure D). See the ADR-0008 addendum.

### Conditional contradiction (refinement)

The report-route two-number contradiction — the "Dominant overall score" block (today persisted
`min(det,A)`) directly above `V2ReportView` (today A) — is **conditional, not universal**: it shows
only where a cap binds below A so `min(det,A)=det<A` (e.g. Repro-B audio: block 60 vs A 94). Where
`det ≥ A`, today's persisted `min(det,A)=A`, so both already render the same number and there is no
visible contradiction (canary 42, strong 91) — N4a then makes every surface render canonical D,
closing it in every regime.

## Withhold semantics (preserved exactly)

When the S10 model deliberately withholds (score_summary/readiness null — H1 observed-tape reconcile at
s10-report-view-model.server.ts:574; missing-readiness), the headline stays null. The VISIBLE render gates on
the EXISTING provenance predicate `s10ScoreAuthorized` (the `score_summary` section-source-map authority):
`s10ScoreAuthorized ? canonicalD : null`. Do NOT introduce a second predicate keyed on the canonical field's
presence — that would open a new withhold seam. (The `v2-report-builder` payload selector
`s10View ? (withheld ? null : canonicalD) : legacyD` is the payload-field analogue, not the visible-surface
gate.) Matrix caps (N4b) remain — an incomplete package is still capped into the retake/review band; removing
the min does not remove the cap.

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

Removing the min shifts the meaning of the function's `capped` return flag. The flag is
`capped: overall !== input.currentOverallScore || warnings.length > 0` (s10-readiness-score-semantics.server.ts:715
— BOTH terms; the earlier draft of this spec dropped the `|| warnings.length > 0` term). With the min gone,
the first term `overall !== input.currentOverallScore` becomes true ONLY when the matrix cap (N4b) fires, so
it now means "matrix-capped" rather than "min-or-matrix moved"; the second term (`warnings.length > 0`) is
unchanged and still trips on any cap/contradiction warning. The build must re-point that flag's meaning and
any test asserting it, deliberately.

## Build sequence

Each slice = pipeline (where relevant) + VIEW-MODEL threading (surface a DISTINCT canonical field on
`buildS10PerformerReportViewModel`, never overwriting `readiness`/`score_summary`/`recommendation` = A) +
VISIBLE-RENDER re-point (`V2ReportView.tsx` + PDF `report-view-model.ts`, gated by the existing
`s10*Authorized` provenance predicate). See the render-locus correction in §Surface bindings. Re-pointing the
persisted/payload number alone (N4a + the `v2-report-builder` field) does NOT move the visible surface.

1. Slice 1 — canonical headline end-to-end: (pipeline) remove min at sem:638 so `overall = currentOverallScore`,
   matrix cap N4b unchanged; (view model) thread `takes.overall_score` into `buildS10PerformerReportViewModel`'s
   input and surface a distinct `canonical_overall_score` at the recommendation/score_summary assembly
   (~:1483-1510); (render) re-point the headline at `V2ReportView.tsx` ScoreRing (~:797-801) and PDF
   `report-view-model.ts` (~:1024-1028) to read it via `s10ScoreAuthorized ? canonicalD : null`. Plus: add the
   Repro-B audio-capped fixture; correct the canary fixture's false-positive D-side to honest inputs and assert
   canonical D=54; assert strong canonical D=93; re-point the `capped` flag meaning; selective re-pin of the
   guard test (preserve null-on-missing, source_map, legacy_projection, input-purity); assert aggregates equal
   the visible headline (cross-surface consistency). Transient cross-slice caveat: until Slice 2 the headline
   reads canonical D while the verdict still reads A's decision — coherent for the fixtures (strong D=93/submit,
   canary D=54/retake, Repro-B per band).
2. Slice 2 — verdict: derive a canonical verdict from D at level-relative bands, surface it as a distinct
   view-model field, re-point the visible verdict render (`V2ReportView.tsx` ~:814/:820; PDF ~:1006) (V1-V3).
3. Slice 3 — category scores + material_compliance: surface canonical, matrix-capped values as distinct
   view-model fields, re-point the visible renders (category `V2ReportView.tsx` ~:881 / PDF ~:1030;
   material_compliance `score_summary.brief_completion_score`, PDF ~:1667) (S1-S2).
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
