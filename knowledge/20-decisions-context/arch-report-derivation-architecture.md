---
id: arch-report-derivation-architecture
title: Report Derivation Architecture — single derivation view for every report number and prose block, with cross-delta dependency map
tier: corpus
status: draft
spine_anchor: ["ADR-0008", "README §Calibration doctrine", "AGENTS §Score terminology alignment"]
decided_ref: "ADR-0008"
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "Reviewing-architect consolidation, 2026-06-08, origin/main @ 665e22e2. Consolidates arch-d6-score-model-architecture, arch-d6-phase1-as-is-score-map and arch-d6-canonical-score-computation-spec into one report-wide derivation view + cross-delta dependency map. SRO decisions D1-D5 + gate Option A folded in. Senior-engineer review round 1 (RATIFY-WITH-AMENDMENTS) adjudicated and folded: (a) overall is NOT reshaped — it stays the as-is capped blend of all categories + bounded role-fit, and performance-quality is ADDED as the craft slice; (b) D3 corrected (the denormalised takes.scores column feeds the comparison/dashboard surfaces — deprecate the redundant copy but preserve the comparison data path); (c) role-fit defined and placed; (d) level-leak citation corrected to :3693 (built :3475); (e) comparison surface, denormalised columns and confidence added to the inventory; (f) show-every-adjustment rule added. Senior-engineer round-2 review: CLEAR-TO-RATIFY (all six amendments verified landed; role-fit verified exact against source — schema :2157/:2162/:2169, clamp :5319, baseline-zero :5321-5323, forbidden-strip :5328-5332, audio-cap re-apply :5336-5338). Two optional polish notes folded: topology-diagram audio-cap ordering (cap applied before role-fit and re-applied after) and forbidden-strip line range tightened to :5328-5332. Awaiting SRO ratification."
discipline: null
monday_ref: "2967669003"
tags: [arch-deltas, decisions, score-model, canonical-score, report-architecture, derivation, dependencies, narration, role-fit, conformance]
confidence: high
created: 2026-06-08
updated: 2026-06-08
---

> **STATUS: DRAFT for senior-engineer round-2 validation + SRO ratification.** The design spine the implementation
> deltas (Δ5 → Δ4 → Δ6-tail → Δ7) build against. Consolidates three existing notes; from-source facts cited to
> file:line on origin/main @ 665e22e2. Changes no code. **The overall score is NOT recomputed** — it stays as
> computed today (a capped weighted blend of all categories plus a bounded role-fit adjustment), consistent with
> the canonical-score spec; this architecture ADDS performance-quality (the craft slice) and makes the other
> numbers derive consistently. If ratified this likely earns its own ADR building on ADR-0008.

## 1. Why this document exists

We have reconciled the report ONE surface at a time — the Δ6 slices made the visible overall, verdict, category
scores and material_compliance derive from the deterministic value. But each delta touching the report
independently rediscovers that it also touches the numbers, because no single artifact states, for every number
and every prose block, where it comes from, how it is derived, what it depends on, its consistency rule, and who
owns it. This document is that operationalisation plus the cross-delta dependency order, so the remaining work is
one designed architecture rather than a sequence of patches.

## 2. What already exists (and the precise gap)

- **arch-d6-score-model-architecture** — the target principles (analysis precedes the score; one canonical number;
  level at one point; rubric authored offline; subjective voice bounded).
- **arch-d6-phase1-as-is-score-map** — the from-source as-is forensic of the OVERALL number and verdict divergences.
- **arch-d6-canonical-score-computation-spec** — the OVERALL number operationalised (single A-contamination site,
  canonical D computation, surface bindings for the four canonical surfaces).

**The gap:** none enumerates the WHOLE report — every category, sub-score, component score and prose block — with
per-module derivation, dependencies and consistency rules; none defines what each score attribute means or how
they relate (the topology); none maps Δ4/Δ5/Δ6/Δ7 into one dependency-ordered model. That is §§4–9.

## 3. The core model (recap — not re-derived here)

1. Analysis precedes the score. Step 1 observes/locates evidence; Step 2 MARKS it against brief × level; the
   number is computed deterministically from marked dimensions plus hard caps. The AI judges dimensions; it never
   emits or moves the final number.
2. One canonical number, every surface derives. No surface holds an independently authored score value.
3. Level enters at exactly one point — the marking function. Step 1 must be level-invariant. **Currently refuted:**
   the level block is built at `process-take.server.ts:3475` (`buildS10PerformerLevelPromptBlock`) and injected
   into the Step-1 `evidenceContext` (observation pass) at `:3693` — a defect the build removes.
4. Rubric authored offline, ratified by expert discrimination; never authored at runtime.
5. Subjective voice (MD-voice) is bounded, suppressible, and cannot move the number.

## 4. The derivation model — layers, definitions, and topology

### 4.1 Internal layers (the spine)

- **L0 — Located evidence.** What the tape shows, anchored: `observed_tape_sequence`, `component_verifications`,
  `media_observation_summary`. Today Step 1 emits component-level evidence but not per-dimension anchors — Δ5.
- **L1 — Internal dimensions (marked).** The AI marks each dimension against rubric × level. Today this is the flat
  `scores` object (`process-take.server.ts:1231`). **Today the overall (L3) is computed from L1** (see 4.5).
- **L2 — Type-aware public categories.** The categories the performer sees. Today a SECOND independently
  AI-authored vocabulary — the `category_scores` array (`:1491`) — that can diverge from L1 even with no cap.
  Slice 3 already made the *visible* category scores read the L1 marks (`canonical_category_scores.score =
  report.scores[category_id]`); Δ4 collapses L1↔L2 so L2 is fully derived, not separately authored.
- **L3 — Deterministic overall + verdict** (4.5). **Note:** "L3 derives from L2" is the post-collapse target;
  *today* L3 derives from L1 and L2's scores are bypassed on the visible surface.

The rule: a value at any layer derives from the layer below; nothing is authored twice.

### 4.2 Definitions (the public score attributes — pin these precisely)

- **Component** = one physical piece of the audition (acting scene, song, slate, package); its score is justified
  by the L0 evidence for that piece.
- **Category** = a skill area the performer sees (acting, vocal, technical, movement/dance, brief-compliance,
  presentation); a category score is the roll-up of the components/dimensions that exercise it.
- **Performance quality** = the roll-up (≈ weighted average) of the CRAFT categories only. Answers "how good is the
  performance?" INDEPENDENT of whether the brief was met. Surfaced ALONGSIDE overall (it does not replace it).
  **Craft membership (Δ4 to confirm per discipline):** proposed CRAFT = {acting, vocal, technical, movement/dance
  where applicable}. This membership shapes ONLY performance-quality (not the overall), so the stakes are
  contained; `technical` is the placement most worth confirming (execution craft vs recording context).
- **Overall readiness** = the capped weighted blend of ALL category scores (craft + compliance + context) PLUS a
  bounded role-fit adjustment. **Kept exactly as computed today (4.5)** — not recomputed. Answers "should this be
  sent?" Every adjustment that moves it off the raw category average (role-fit, audio cap, mandatory-material cap)
  is SHOWN (4.4).
- **Role-fit** = a bounded, brief-derived adjustment to the overall capturing how well the performance suits the
  SPECIFIC role — its function, tone, energy, and emotional demands as described in the structured brief — and
  explicitly NOT likeness, appearance, race, body, age, or imitation. Gauged by the model in Step 2 as three
  fields: `role_fit_notes` (one-paragraph justification, `process-take.server.ts:2157`), `role_fit_modifier`
  (the number, `:2162`) and `role_fit_confidence` (`:2169`, "low" when the brief is thin). Bounds **−10 to +5**
  (asymmetric — a clear misfit is penalised harder than a strong fit is rewarded; deliberate, ratify like a
  weight). Forced to 0 in BASELINE mode (no brief); forbidden-language in the note zeroes the modifier and strips
  the note (`:5328-5332`). Applied to the overall after the category blend and the audio cap, with the audio cap
  re-applied after so role-fit cannot lift a tape past the audio ceiling, and below the matrix cap. **Shown to the
  user** under the 4.4 rule.
- **Verdict** = the band overall readiness falls into (submit / review / retake).

### 4.3 The public topology (relational derivation)

```
component scores  --roll up-->  category scores  (craft, compliance, context)
                                       |
              craft categories  --roll up-->  PERFORMANCE QUALITY   (surfaced alongside)
                                       |
   ALL categories  --weighted blend, then audio cap-->  base
        base  + ROLE-FIT (−10..+5, shown)  --audio cap re-applied, then mandatory-material cap (shown)-->  OVERALL READINESS
                                                                                                       |
                                                                                           --band-->  VERDICT
```

Consistency that follows: components reconcile with their category; performance quality is the craft average (no
"all 3s but a 90"); and **overall equals the weighted average of all shown categories, moved only by the named,
shown adjustments** (role-fit, audio cap, mandatory cap) — so "overall ≈ the average of the scores below it" holds,
with every exception visible. Cross-take consistency (the 8/10-then-4/10 trust case) is a separate, MEASURED goal:
it needs the score to be a stable function of L0 evidence rather than a fresh holistic guess — delivered by Δ5
(anchoring) + Δ7 (consistent rubric), not enforceable as a single CI check.

### 4.4 The gate and the show-every-adjustment rule (SRO decision — Option A)

A hard cap (mandatory material missing → "not submission-ready"; `deriveReadinessConstraint` 54/69,
`s10-readiness-score-semantics.server.ts:175`) deliberately pulls overall below the category blend. **Option A:**
caps are HARD — craft cannot offset a missing mandatory element — AND the cap is shown explicitly. (Rejected:
modelling compliance as just another category in the average, which would let strong craft offset a missing
mandatory element.) Generalised: **every adjustment that moves the overall off the raw category average is shown**
— role-fit ("reads against the role's intent, −4"), the audio cap, and the mandatory-material cap. The overall is
not recomputed to remove these; the report explains them. This is the legibility mechanism (Δ7 + display), not a
score change.

### 4.5 How the overall is computed (kept as-is; corrected citations)

`recomputeOverall(scores, weightsForType)` — weighted blend of ALL categories, renormalised
(`audition-rules.ts`) → audio cap (tiered <35→60/<50→62/<60→75, `process-take.server.ts:5251-5253`) → role-fit
modifier (clamped [-10,+5] at `:5319`, baseline-zeroed at `:5321-5323`, forbidden-stripped at `:5328-5332`) → audio cap re-applied (`:5336-5338`) → N4a min(.,A)
REMOVED (`s10-readiness-score-semantics.server.ts:642`) → matrix cap on the overall (`:652`). `capNumberField`
(`:531`) only ever lowers a value to a cap and never raises it (early-returns when `original <= cap`). **This
formula is preserved.** What Δ4 changes is the *inputs* (deriving categories from components, collapsing the
duplicate vocabularies) and what is *surfaced* (performance-quality), not the overall formula — so the overall
NUMBER will still shift as inputs are made consistent (hence the §8 canary-diff gate), but the computation is not
reshaped.

## 5. Report module inventory (every number and prose block)

Performer-visible unless marked. "Status" = current state on origin/main @ 665e22e2.

### 5a. Numbers

| Module / field shown | Source today | Derivation (target) | Consistency rule | Status |
|---|---|---|---|---|
| Overall readiness (`canonical_overall_score`, `V2ReportView.tsx:803`) | D | KEPT (4.5): capped all-category blend + role-fit | = weighted avg of all categories, moved only by shown adjustments | **Canonical (Δ6 S1)**; formula unchanged, inputs reshaped by Δ4 |
| Verdict (`canonical_verdict.decision`, `:820`) | D-derived | deterministic map from overall band + blockers | agrees with overall band | **Canonical (Δ6 S2)** ✓ |
| Category scores (`canonical_category_scores[].score`, `:892`) | `report.scores[category_id]` (L1) | roll-up of component evidence (Δ4) | = the marks that feed the overall | **Canonical (Δ6 S3)**; derivation deepened by Δ4 |
| Material compliance (`canonical_material_compliance`) | `report.brief_adherence_breakdown.material_compliance` (capped) | matrix-capped compliance mark | ≤ matrix cap (ceiling guardrail #246) | **Canonical (Δ6 S3)** ✓ guarded |
| Performance quality (`performanceQuality`, `report-view-model.ts:1675`) | **A** | NEW: roll-up of craft categories (D2) | ≈ avg of craft categories | **A — RESIDUAL**; owner Δ4 |
| Component scores (`:895`/`:2086`) | **A** (`score_summary.component_scores`) | derived/consistent within the layer model (D1) | consistent with its category | **A — RESIDUAL**; owner Δ4 |
| Score band label (`bandLabel`, `report-view-model.ts:1680`) | **A** (`score_summary.score_band_label`) | derived from canonical verdict band | matches canonical verdict | **A — RESIDUAL**; owner Δ4 |
| Role-fit adjustment (notes + modifier, `:2157`/`:2162`) | AI (`role_fit_modifier`) | bounded brief-derived adjustment (4.2) | shown; ≤ +5 / ≥ −10; 0 in baseline | kept; must be SHOWN (Δ7/display) |
| **Comparison surface** (CompareView: per-take `overall_score`, `scores`, deltas) | denormalised `takes` columns | must derive from / stay in sync with canonical | comparison numbers = canonical | **needs binding** (Δ4) |
| **Confidence / "feedback reliability"** (`takes.confidence`, trust indicator) | denormalised `takes.confidence` | derived value; define its derivation | stated derivation | **needs definition** (Δ4) |
| Denormalised `takes` columns (`scores`, `overall_score`, `confidence`, `score_breakdown`, `compliance_flags`, set `process-take.server.ts:6906`) | from `report.*` at persist | kept in sync with canonical; feed dashboards/admin/CompareView | = canonical | **derivation surface** (Δ4) |
| v2 payload `scores` / `brief_adherence_breakdown` (not performer-visible) | **A** | DEPRECATE the redundant JSON copy; PRESERVE the comparison data path | n/a once removed | **A — dormant**; D3 (deprecate + preserve path) |

### 5b. Prose blocks (all AI-authored today; the narration co-derivation surface)

Free AI text in the Step-2 schema: `recommendation` (`score_explanation` `:1441`/required `:1620`, `headline`,
`rationale`); `selected_level_calibration`; per-category prose (`what_works`/`why_not_full_score`/`close_gap`/
`score_basis`, in `category_scores` `:1491`); per-component `score_basis`; `strengths_and_preserve` (`:1717+`);
`professional_critique` (MD-voice); `technique_commentary`; `timestamped_commentary`; `fix_hierarchy`/
`next_action_plan`; and the per-category rationale strings at `:1846`.

**Rule (target):** every prose block is generated from / constrained to the final canonical numbers and verdict
and asserts no figure that can drift (C-floor + A-regeneration, §7). The defect (headline prose quoting 85 against
a capped 69, take 39cc95b2) is this rule unmet.

## 6. Consistency invariants (what must hold across the report)

1. **Overall = capped all-category weighted blend + bounded role-fit** (4.5, kept). Deterministic chain.
2. **Performance quality = roll-up of the craft categories.** NOT yet enforced — performance quality still A.
   Owner: Δ4.
3. **Overall = the weighted average of all shown categories, moved only by NAMED, SHOWN adjustments** (role-fit,
   audio cap, mandatory cap). The legibility guarantee (4.3/4.4). Owner: Δ4 (compute) + Δ7/display (show).
4. **Hard caps are absolute and shown** (4.4, Option A). Owner: Δ4 + Δ7.
5. **Visible category = the mark that feeds the overall.** Enforced by Slice 3.
6. **Component scores reconcile with their category** via a DEFINED roll-up rule (average? weighted? — Δ4 to
   specify). NOT yet enforced — components still A. Owner: Δ4.
7. **Material compliance ≤ matrix cap; unchanged when no cap.** Enforced by the ceiling guardrail (#246).
8. **Performance-quality, band, and the denormalised/comparison numbers all agree with the canonical overall/
   verdict.** NOT yet enforced. Owner: Δ4.
9. **Every prose figure equals the canonical number it refers to (or no figure is asserted).** Owner: Δ7.
10. **Cross-take: the same anchored evidence produces the same mark** — a MEASURED goal (determinism at
    temp-0/cache), delivered by Δ5 + Δ7; not a single CI-checkable invariant. Owner: Δ5/Δ7.

Invariants 5 and 7 hold today; the rest are the open surface this architecture sequences.

## 7. Prose co-derivation (the Δ7 narration layer, summarised)

- **C — structural floor.** The Step-2 narration contract instructs every prose field to describe qualities and
  the verdict rationale and never state a numeric score; a deterministic guard at the view-model assembly
  neutralises any leaked figure. The floor that makes a versioned prompt catalogue (Δ7) safe.
- **A — content layer.** Regenerate prose FROM the final numbers so it explains each shown adjustment richly
  ("strong take, but a required section is missing, so readiness is held at 69; the read also sits slightly
  against the role, −4"). Sits ON the C-floor. Δ7-native.
- **MD-voice (`professional_critique`)** follows the same no-figure rule (D4): qualitative, verdict-consistent,
  never number-asserting.

## 8. Cross-delta dependency map (the implementation order)

Dependency-ordered (anchors-first — SRO decision D5):

1. **Δ5 — evidence anchors (L0→L1 foundation).** Per-dimension anchors Step 2 grades. Without it, L1 marks are
   holistic and cross-take consistency (inv 10) is impossible. Foundation. (Monday 2967708093.)
2. **Δ4 — three-layer reconciliation + the residual/derived surfaces.** Collapse L1↔L2 so categories, component
   scores, performance-quality, band, and the denormalised/comparison numbers are DERIVED/in-sync; ADD
   performance-quality (craft slice); deprecate the redundant payload copy while PRESERVING the comparison data
   path; define the component→category roll-up rule and the confidence derivation. The overall FORMULA is
   unchanged. Delivers invariants 1–3, 6, 8. (Monday 2967669003 — this note is its design front-end.)
3. **Δ6 — canonical visible numbers (L3 surface).** DONE for overall/verdict/category/material (#237/#241/#245 +
   #246). Tail: the conditional two-number-contradiction corpus edit; the level-invariance fix (`:3693`/built
   `:3475`). (Monday 2967682223.)
4. **Δ7 — prompt catalogue + prose co-derivation.** One source of truth for model calls makes L1 marking
   consistent (inv 10); narration co-derivation (§7) plus the show-every-adjustment display delivers invariants 3,
   4, 9. Depends on Δ4/Δ6. (Monday 2967722202; absorbs the narration fragment, item 2972065331.)

**Gate on Δ4 (required):** even though the overall formula is unchanged, making the category inputs consistent
moves the overall NUMBER on existing reports — so Δ4's category-derivation changes ship behind a **before/after
canary diff + Δ10 re-baseline**, not unit fixtures alone. **D5 staging note:** anchors-first runs the critical
path through the hardest piece (Δ5) first; insurance if Δ5 slips is a hybrid (Δ4 de-dup against current marks as an
interim, then anchor) — the interim delivers intra-report consistency (inv 1–3, 6, 8) but NOT cross-take (inv 10).

**Orthogonal:** Δ10 (first clean E2E) measures the current system to rebaseline, run before Δ7 lever-tuning. Δ11
(governing-docs north-star) absorbs this architecture. The rubric-content stream runs in parallel at expert pace.

## 9. Residual inconsistencies on origin/main (enumerated, with owners)

- **component_scores, performance_quality_score, score_band_label still A** (visible) → invariants 2, 6, 8. Owner: Δ4.
- **All prose still A** → invariant 9; live instance take 39cc95b2 (overall 69 vs prose "85"). Owner: Δ7 (item 2972065331).
- **Role-fit is invisible today** — it moves the overall off the category average with no on-report explanation →
  invariant 3. Owner: Δ7/display (show it).
- **v2 payload `scores`/`brief_adherence_breakdown`** — the JSON copy has no main-report consumer, BUT
  `report.scores` is denormalised into the `takes.scores` column (`process-take.server.ts:6906`) which feeds the
  CompareView/dashboards, and the v1-legacy `TakeView` renderer reads `report.scores`/`brief_adherence_breakdown`
  (dead behind the `v2-component` early-return, but present). DEPRECATE the redundant JSON copy; CONFIRM/remove
  the dead v1 path; PRESERVE the comparison path (keep `takes.scores`/`overall_score` populated from CANONICAL
  values, or repoint CompareView). Owner: Δ4 (Monday 2977734682).
- **Dead-field audit (D3).** Audit the Step-2 schema for fields the model GENERATES that nothing consumes — true
  dead AI output costing tokens/latency. (The dormant copy is copied, not generated, so removing it saves
  storage/debt, not generation; the audit is the real AI-cost saving.) Owner: Δ4/Δ7.
- **Step-1 level leak** (`:3693`, built `:3475`) → level acts in observation, not just marking. Owner: Δ6/Δ7 build.

## 10. Sequencing recommendation (against this spine, no fragmentation)

1. Land the two in-flight PRs (#246 guardrail, Slice 3 outcome note).
2. Senior-engineer round-2 validation + SRO ratification of this spine; file it as Δ4's design front-end.
3. Δ10 rebaseline (scoring surfaces already canonical) — optionally begin Δ5/Δ4 design analysis in parallel.
4. Implement Δ5 → Δ4 (derived surfaces + performance-quality + deprecate-with-path-preserved + dead-field audit,
   gated by the canary diff) → Δ6 tail → Δ7 (prose + catalogue + show-every-adjustment), each a held PR reviewed
   from source.

## 11. Design decisions — ratified by SRO (2026-06-08)

- **D1 — keep component + category + overall, bind them into one derivation.** All three levels stay; each derives
  from the one below. → §4.
- **D2 — define the attributes and the topology.** Defined (§4.2); performance-quality = craft roll-up SURFACED
  ALONGSIDE overall; **overall is kept as-is, not reshaped** (round-1 amendment); topology fixed (§4.3); craft
  membership a Δ4 spec item.
- **Gate — Option A + show every adjustment.** Hard caps preserved and shown; role-fit and the audio cap shown too
  (§4.4).
- **Role-fit — keep and show.** Defined (§4.2); a bounded brief-derived adjustment (−10..+5), shown on the report
  rather than moving the headline invisibly.
- **D3 — deprecate the redundant v2-payload copy, preserve the comparison data path**, plus a Step-2 dead-field
  audit (round-1 amendment: the data is NOT consumer-free via the denormalised column). → §9.
- **D4 — MD-voice under the no-figure rule.** → §7.
- **D5 — anchors-first (Δ5 → Δ4).** Engineering-safety staging; hybrid fallback if Δ5 slips; Δ4 gated on a
  canary diff + re-baseline. → §8.

## Links
- [[arch-d6-score-model-architecture]] — the target principles this operationalises.
- [[arch-d6-phase1-as-is-score-map]] — the as-is overall/verdict forensic.
- [[arch-d6-canonical-score-computation-spec]] — the overall-number operational contract (L3); consistent with
  §4.5 (overall kept as the all-category blend).
- [[arch-d6-render-wiring-process-time-snapshot]] — why canonical-field changes are forward-only.
- [[arch-d6-slice3-outcome-material-compliance-honesty]] — the ceiling guarantee + up-movement honesty principle.
- ADR-0008 (plain text — docs/architecture/adr/) — the canonical-score invariant this builds on.
- Monday: Δ4 2967669003 (design home) · Δ5 2967708093 · Δ6 2967682223 (+ narration instance 2972065331) ·
  Δ7 2967722202 · Δ10 2967682227 · Δ11 2967685901 · residual payload 2977734682.
