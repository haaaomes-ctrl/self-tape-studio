---
id: arch-d6-phase1-as-is-score-map
title: Δ6 Phase 1 as-is score map — from-source inversion derivation (render reads AI authority A, not deterministic D)
tier: corpus
status: current
spine_anchor:
  [
    "AGENTS §Score terminology alignment",
    "README §Professional 0–100 level-relative score calibration",
    "README §Performer Level Calibration Architecture",
  ]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "ARCH-Δ6 Phase 1 from-source inversion derivation, fresh session 2026-06-07 (Monday 2967682223); files re-anchored to origin/main post-#218"
discipline: null
monday_ref: "2967682223"
tags: [arch-deltas, decisions, score-model, level-calibration, inversion, conformance, pipeline]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Summary

The from-source derivation the Δ6 build's safety contract rests on. It **resolves the
deliberately-dangling [[arch-d6-phase1-as-is-score-map]] link** and **replaces the quarantined
prior "F1–F9 / flattering-only theorem / F5 prose-upgrade / F9 dead-caps" table**, which was
provenance-unconfirmed (see [[arch-d6-score-model-architecture]] §Open questions). Nothing from
that prior table is carried; every claim below was traced fresh from live source on `origin/main`
and is cited to file:line.

**The single root cause.** Every divergence is one mechanism: on the live S10 render path, the
report renders the **AI judgement authority A** (`readiness_score_judgement`), not the persisted
**deterministic authority D** (`overall_score` / `score_breakdown`). The deterministic caps are
not "overwritten" — they are **bypassed by branch selection** at
`v2-report-builder.server.ts:306-320`, which reads A directly and never reads D on the S10 path.

**The headline correction to the prior framing.** It is **not** "9 conditions" or "6+1". Traced
from source, the within-report divergences are: **4 number-drift sources into D**, **3 verdict-label
divergences**, **1 A-raise**, **2 sub-surface inversions**, and **3 harsh/withheld paths** — fed
through **one branch selector**, with **one fork** deciding inflation-vs-withhold, in **one live
render regime**. Beyond the report detail there is also a **surface split**: the list/dashboard/
ranking/admin surfaces render the deterministic value D while the report detail renders A, so the
two disagree on screen (see §The surface split).

**The safety conclusion (verified, not inherited).** R-vs-D is **non-monotone**: the report-detail
render can be both higher than D (inflation) and harsher than D (withheld). A "flattering-only" /
"R ≥ D" universality is **refuted from source**. Moreover the surfaces are **split across two
persisted homes** — the report detail renders A (`report.overall_readiness`), while every
list/dashboard/ranking/admin surface renders D (`takes.overall_score` column) — producing a visible
two-number contradiction on the same screen. The only sound invariant for the build is **R = D —
one canonical value, every surface** — and because the aggregate surfaces are already on D, the
convergence is toward the deterministic value.

## Context / why

Established and not re-derived here (per the owning session's grounding): two-authority model
D/A; one-way reconcile via `min()` at `s10-readiness-score-semantics.server.ts:636-639`; Repro A
(take `39cc95b2`, temporal); Repro B (take `0f033af1`, structural, confirmed live). This note
extends those into the full divergence inventory.

**The two authorities, persisted side by side, never reconciled back.**

- **D (deterministic)** = the `overall` variable in `process-take.server.ts`, persisted as the
  `takes.overall_score` column (`:6882`/`:6903`) and, on the pre-projection `report` object, as
  `overall_score_final`/`overall_score` (`:5923`, `:5929`) plus the diagnostics `score_breakdown`
  (`:6578`). **Note:** the persisted V2Report projection drops `overall_score_final`/`overall_score`
  (see §The surface split), so post-persist the durable D home is the `takes.overall_score` column.
  Its verdict is `computeSubmissionVerdict` → `applyCapsAndLabel` → `labelForScore(overall, level)`,
  persisted as `verdict_final` / `submission_verdict` (`:5732`, `:5743`, `:5923`).
- **A (AI judgement)** = `report.readiness_score_judgement.overall_submission_readiness_score`,
  set in `normaliseReadinessScoreJudgement` and written back at
  `s10-readiness-score-semantics.server.ts:497` and `:705`. Inside that function the readiness
  score is **only ever lowered by the matrix `constraint.cap`** (`:347-355`) and can be **raised**
  by the stale-package block (`:380-398`). It is **never** lowered to the audio/role-fit/recompute
  -capped `currentOverallScore`.
- **The `min()` at `:636-639`** lowers the _returned local_ `overall` (→ D). It does **not** write
  back into the judgement object — grep for any writeback of the reconciled overall into
  `readiness_score_judgement.overall_submission_readiness_score` returns nothing. So **A retains
  the matrix-capped-only AI score; D is A min'd against the deterministic caps.**

**The branch selector (the inversion gate).** `v2-report-builder.server.ts:306-308`:
`overall = s10View ? clampScore(scoreSummary.overall_submission_readiness_score) /*A*/ :
(overall_score_final ?? overall_score ?? overall_readiness) /*D*/`. Verdict at `:318-320` is
`s10View ? readiness.decision : verdict_final`. `s10View` is truthy whenever any S10 module object
exists on the report (`s10-report-view-model.server.ts:1017-1036`). The rendered number is
`visibleS10Score = readiness.overall_submission_readiness_score`
(`s10-report-view-model.server.ts:1282-1283`, surfaced at `:1497-1498`); `V2ReportView.tsx:797-816`
consumes exactly those A-values. **On the S10 path the render never reads D.**

## Detail

### Number-drift sources into D (EXHAUSTIVE)

The deterministic `overall` is mutated in exactly these places — verified: `let overall` at
`process-take.server.ts:5237`, mutations through `:5358`, then **no reassignment** between `:5358`
and persistence at `:5923/:5929/:6903` (full-span scan confirms zero). So this set is complete.

- **N1 — recompute** (`:5237`): `recomputeOverall(modelScores, weights)` (weighted, renormalised,
  `audition-rules.ts:711+`) yields a number that can differ from the AI-authored readiness A.
- **N2 — audio cap** (`:5246-5248`, re-applied post-role-fit `:5331-5333`): tiered <35→60, <50→62,
  <60→75. A has no audio channel, so A is uncapped here.
- **N3 — role-fit modifier** (`:5329-5330`): clamped [-10,+5], applied to D only; A never sees it.
- **N4 — matrix cap / min reconcile** (`:5358` ← `s10-...:636-639`): the only channel that also
  touches A (via the matrix `constraint.cap`); the `min` lowers D further.

### Verdict-label divergences (D verdict ≠ rendered A decision; number may agree)

These act on the **verdict label**, NOT on the number `overall` (which is why they are not N-rows).

- **V1 — blocker cap**: a hard blocker caps the D verdict at ≤ "Worth another take"
  (`audition-rules.ts:854-859`); the rendered A `decision` is unaffected.
- **V2 — brief-adherence floor**: brief_adherence <45 forces D verdict "Not ready yet"
  (`audition-rules.ts:864-867`); A unaffected.
- **V3 — level axis**: D uses **level-relative** bands `bandsForLevel`
  (`audition-rules.ts:676-689`: learning 80/70/58, amateur 83/73/60, emerging 86/76/63,
  professional 89/80/68) via `labelForScore` (`:696-701`). A uses **level-flat** bands —
  `readinessBandLabel` thresholds (`s10-...:84-90`) and `scoreForDecision` 54/69/84/100
  (`:91-95`). The two diverge at every level and the gap **widens with seniority**. Worked case
  (verified): professional/75 → D `labelForScore(75,"professional")` = **"Worth another take"**
  (between worth 68 and ready 80); A `readinessBandLabel(75)` = ≤84 = **submit_if_deadline_is_close**.
  Render shows A (`v2-report-builder.server.ts:318-320`).

### A-raise

- **R1 — stale-package prose upgrade** (`s10-...:380-398`): when `!constraint.decision` ∧
  `matrixHasClearMandatoryMaterial` ∧ decision ∈ {review*carefully, retake_required} ∧
  `mentionsStaleMandatoryPackageGap(prose)`, A is **raised** to ≥70 (or ≥85 for "submit") via
  `readinessScore = Math.max(..., minimumScore)`. This is a genuine prose-driven \_raise* of A
  (located at `:383-404`, contra the prior "F5" which mislabelled the mechanism as a category
  prose-upgrade). D is untouched, so this widens A−D upward.

### Sub-surface inversions inside the report detail (same root; MUST be in the contract)

Within the S10 report-detail surface the inversion is not confined to the headline number:

- **S1 — category scores**: rendered from A's `category_scores`
  (`v2-report-builder.server.ts:343-352`, public-category filter), NOT the persisted D-side
  `score_breakdown`. Critically, A's `category_scores` are passed through with **only `clampScore`
  (0-100)** and are **not matrix-capped** (`s10-...:453-522`); the matrix `capNumberField` caps
  (`:653-668`) apply to the D-side `scores.brief_adherence` and `material_compliance`, and
  component scores get nulled when absent/blocked (`:246-262`) — but the **rendered A category
  scores carry no matrix cap at all**, so this surface is _less_ constrained than the A headline.
- **S2 — material_compliance**: rendered from A's `brief_completion_score`
  (`v2-report-builder.server.ts:424`), itself only `clampScore`'d (`s10-...:469-472`), not D's
  `brief_adherence_breakdown.material_compliance`.

### The surface split — and a live on-screen contradiction (the most user-visible finding)

**The two authorities are persisted in two different homes, and different surfaces read different
homes.** The number has two persisted locations:

1. **`takes.overall_score` (DB column) = D** — `Math.round(overall)` at persist
   (`process-take.server.ts:6882`/`:6903`), the fully-capped deterministic value.
2. **`report.overall_readiness` (inside the persisted V2Report JSON) = A** — set on the S10 path to
   `clampScore(scoreSummary.overall_submission_readiness_score)` (`v2-report-builder.server.ts:306-307`).
   Note the persisted `V2Report` interface (`v2-report-builder.server.ts:62-101`) **drops
   `overall_score_final`/`overall_score` entirely** — it carries only `overall_readiness`.

Which home each surface reads (verified):

- **A (inflated) — report detail only:** `V2ReportView` headline + verdict + category scores +
  material_compliance read A via `s10_view_model` (`V2ReportView.tsx:797-816`).
- **D (honest, capped) — every list/aggregate surface:** the audition take list, the "Dominant
  overall score" block on the report route, the ranking sort, the "best take" selector, and the
  admin export all read `overall_score_final ?? take.overall_score` — and because the V2Report
  projection drops `overall_score_final`, that resolves to the **`take.overall_score` column = D**
  (`audition.$auditionId.tsx:449-451`, `:1165-1173`, `:1634` verdict, `:1718`/`:1822` ranking,
  `:1877`; `dashboard.tsx:61`,`:123-161`; `admin.tsx:377`).

**Consequence — same screen, two numbers.** On the report route (`audition.$auditionId.tsx`) the
"Dominant overall score — primary signal" block (`:1164-1166`) shows **D**, while `V2ReportView`
immediately below (`:1081`) shows the readiness headline from **A**. A performer therefore sees the
honest capped number and the inflated number **on the same view**, and the take-list/ranking they
navigated from is on D. This is not only an inflation defect; it is a visible internal
contradiction between user-facing surfaces.

**Fix-direction implication (informs the build, not a new decision).** The list/dashboard/ranking/
admin surfaces are _already_ on the deterministic value; only the report-detail surfaces read A. So
the canonical-score convergence is toward the **D-side value** (the honest, capped number) — the
report detail must be made to render the canonical/D value, not the dashboard made to render A. This
is the operational meaning of R = D here.

### Harsh / withheld paths (R null or harsher than D)

- **H1 — route observed-tape reconcile**: `reconcileReadinessWithObservedTape`
  (`s10-report-view-model.server.ts:523-639`) forces `overall_submission_readiness_score: null`
  (`:574`), decision → review_carefully/retake (`:553-555`), category/component scores nulled
  (`:594-619`). Bypass guard at `:533-540` (already-blocking ∧ score<70 ∧ no professional-90+
  claim).
- **H2 — component absent/blocked**: `normaliseComponentScores` nulls the component score with a
  `cannot_score_reason` (`s10-...:246-262`).
- **H4 — limited-report panel**: `isLimitedS10Report` / unusable S10 view renders the "S10 report
  assembly limitation" panel with **no score** (`V2ReportView.tsx:667-690`).

### The fork (verified mutually-exclusive, not a race)

Order is fixed at `s10-report-view-model.server.ts:1102`: `reconcileReadinessWithObservedTape`
runs and **overwrites `readiness`** (incl. nulling the score) _before_ `visibleS10Score` reads it
at `:1282`. So:

- **Restrictive observed-tape constraints present (non-empty map)** → H1 fires, A nulled, render
  withholds/harsher. The map is non-empty only when `observed_tape_sequence` has a restrictive item
  linked to a requirement (`buildRouteObservationConstraints`, `:243-262`).
- **Map empty, or H1 bypass guard holds** → inflation (N/V/R/S rows) flows to the render.

These are **mutually exclusive on a single take.** Risk note: H1 — the harsh-side safety net —
depends entirely on the observed-tape sequence being populated, which is exactly the upstream data
known to be unreliable on live takes (the Δ3 gate-not-firing problem,
[[arch-d3-evidence-binding-gate-handoff-2026-06-07]]). When that data is thin/absent, takes fall
through to the **inflation** path with nothing catching them. This strengthens the case for the
single-canonical-score fix over any "block inflation only" half-measure.

### One live render regime (legacy path verified unreachable in production)

The S10 module set is **guaranteed on every persisted take** — verified via three independent
mechanisms, so the legacy render branch is not a second regime:

1. **Schema-required.** All seven S10 module keys plus the S10.3 evidence fields
   (`observed_tape_sequence`, `component_verifications`, `media_observation_summary`) are in the
   output schema's `required[]` array (`process-take.server.ts:2184-2204`). The model is
   contractually obliged to emit them on the single-pass path.
2. **Both pipeline paths converge S10-bearing.** Two-step assigns `report = twoStepReport`
   (`:4471`) and single-pass uses the schema-validated output; both flow into the same persistence
   selection at `:6705`. The two-step path runs through `evaluateS10ModuleReadiness` (`:6152`), so
   it is itself S10-module-bearing.
3. **Module-readiness gate, never a legacy fallback.** When S10 modules are thin/missing the
   pipeline repairs (`canRecoverModuleQuality` retry, `:6206-6260+`), persists the **S10 limited**
   report (H4), or throws `AnalysisFailure` — decision-critical S10 quality is never skipped
   (`:6202`). The persistence block comment is explicit (`:6706-6709`): "never substitute the
   legacy v1 report."

The three persistence outcomes when S10 modules are present are therefore `v2_persisted` (the S10
inversion path), `s10_limited_v2_persisted` (H4), or `s10_unrecoverable` → `AnalysisFailure`. The
legacy `overall_score_final` branch at `v2-report-builder.server.ts:308` is reachable only for a
report carrying **no** S10 modules at all, which no pipeline path (single-pass or two-step, brief
or baseline) produces. **It is unreachable in production — vestigial code, not a live regime.** The
contract has one live regime: S10, with the limited/failed terminals as its only alternatives.

### Universality check — the Phase 2 safety contract (verified from source)

R-vs-D is **non-monotone**:

- **R > D / more-favourable verdict** (inflation): N1-N4, V1-V3, R1, S1-S2.
- **R harsher than D / withheld**: H1, H2, H4.

Therefore "the render is never lower than D" / "flattering-only" is **FALSE from source**. The
contract **cannot** be "R ≥ D". The only sound invariant is **R = D — a single canonical value,
every surface derives from it** — confirmed to span the report headline number, verdict, category
scores and material_compliance (all currently A) **and** the list/dashboard/ranking/admin surfaces
(all currently D, i.e. already correct). Because the aggregate surfaces already read the
deterministic value, convergence is toward **D**: the report detail must render the canonical/D
value. This is the operational form of the decided architecture
([[arch-d6-score-model-architecture]]): one canonical score, AI marks dimensions but never owns
the number.

**Verified-not-a-divergence (completeness guard).** Between the readiness clone
(`s10-report-view-model.server.ts:1039`) and the `visibleS10Score` read (`:1282`), the `readiness`
object is reassigned exactly twice: `reconcileReadinessWithObservedTape` (= H1, the fork) and
`removeSub90Professional90PlusLanguage` (`:921-945`). The latter was traced and **only rewrites
`selected_level_calibration` prose for sub-90 scores carrying 90+ language; it never touches
`overall_submission_readiness_score` or the decision** — so it is not a divergence path. This
confirms no third unconditional mutation sits between persist and render.

### Conformance-test corpus implied (for the Δ6 build)

Per the conformance-test requirement in [[arch-d6-spine-reconciliation]] (the failure mode was
unverified conformance, not wrong doctrine), each divergence becomes an individual pinned test
asserting the canonical model makes it impossible: N1-N4 (number cannot drift off canonical),
V1-V3 (verdict derives from the canonical value at the correct level bands), R1 (prose cannot raise
the number), S1-S2 (sub-surfaces derive from canonical, category scores matrix-capped), H1/H2/H4
(withholding is deliberate model output, not an artefact of which authority was read), one test on
the fork itself (after R=D there is only one number, so the inflation-vs-withhold gate no longer
selects _which number_ shows), and — added from the surface-split finding — a **cross-surface
consistency test**: the number/verdict shown on the report detail must equal the number/verdict on
the take list, dashboard, ranking and admin export for the same take (today the report detail reads
A while those read D). Note the existing pinned guard `s10-v2-score-category-fallback-guard` asserts
the rendered score equals the AI judgement (i.e. it encodes the defect) and must be deliberately
rewritten, not fixed-to-pass.

## Open questions

None outstanding for the as-is map itself — the divergence inventory is exhaustive, the
inflation-vs-withhold fork is verified mutually-exclusive, and the single live render regime is
confirmed (legacy branch unreachable). Downstream actions (not open questions about this map):

- ADR-0008 write-up (per [[arch-d6-score-model-architecture]] / [[arch-d6-spine-reconciliation]])
  references this as-is map as the verified basis for the canonical-score invariant; best written
  after this note is reviewed.
- Δ6 build authors the conformance-test corpus (above) and deliberately rewrites the pinned
  `s10-v2-score-category-fallback-guard`, which currently encodes the defect.

## Links

- [[arch-d6-score-model-architecture]] — the decided architecture this map's R=D invariant
  operationalises (resolves the forward link previously dangling here).
- [[arch-d6-spine-reconciliation]] — the conformance-test requirement this corpus feeds.
- [[arch-d6-handoff-2026-06-07]] — the session handoff that commissioned this derivation.
- [[arch-d3-evidence-binding-gate-handoff-2026-06-07]] — the observed-tape evidence work H1
  depends on.
- [[arch-d6-canonical-score-computation-spec]] — the operational computation spec (canonical D; the single `min(.,A)` site removed) that operationalises this note for the build.
- Monday: Δ6 2967682223 · S10-03 2952749999 (reopened/blocked) · S10-14 2952750147
  (closed/superseded).
