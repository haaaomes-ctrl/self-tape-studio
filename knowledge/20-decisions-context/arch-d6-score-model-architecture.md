---
id: arch-d6-score-model-architecture
title: Δ6 score-model architecture — analysis-first canonical score, level as marking standard, authored rubric model
tier: corpus
status: current
spine_anchor:
  [
    "README §Calibration doctrine",
    "README §Performer Level Calibration Architecture",
    "AGENTS §Performer level calibration",
    "AGENTS §Professional 0–100 level-relative score calibration",
    "AGENTS §Score terminology alignment",
  ]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "ARCH-Δ6 Phase 1 investigation + operator decision session, 2026-06-07 (Monday 2967682223)"
discipline: null
monday_ref: "2967682223"
tags: [arch-deltas, decisions, score-model, level-calibration, rubric, pipeline, open-question]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Summary

Δ6 decides the target score-model architecture: **analysis precedes the score; one canonical
score computed deterministically from AI-marked dimensions; level enters at exactly one point
(the marking function) and never touches Step 1 observation; rubrics are authored offline and
ratified by expert discrimination, never authored by the AI at runtime; subjective practitioner
voice is contained in a bounded, suppressible module that cannot move the number.** This
collapses the four-authority tangle found in Phase 1 (deterministic D / AI-judgement A / matrix
M / observed-tape O) to a single source of truth. Likely earns a formal ADR — **next free slot
verified as ADR-0008** (0001–0007 exist in `docs/architecture/adr/`); proposed, not assigned —
spine/ADR edits held for separate review.

## Context / why

The Δ6 Phase 1 as-is trace (Monday 2967682223; repro takes 39cc95b2 and 0f033af1, Run T1) found
**no single source of truth** for the score/verdict surface. The grounded findings:

- **Two-authority model.** A deterministic authority D (recompute → caps → verdict, persisted to
  `takes.overall_score` / `score_breakdown`) and an AI-judgement authority A
  (`readiness_score_judgement` → s10 view model → rendered headline/verdict) run in parallel,
  with **one-way reconciliation**: A pulls D down via `min()` at
  `s10-readiness-score-semantics.server.ts:636-639`; D is never propagated back into A.
- **Repro A (take 39cc95b2) — temporal.** The matrix constraint cap was applied to the score
  (`s10-readiness-score-semantics.server.ts:347-355`, `:641-650`) while the AI-authored
  `score_explanation` was preserved verbatim (`:507-508`), leaving prose quoting the pre-cap
  number against a capped persisted score.
- **Repro B (take 0f033af1, confirmed against the live row) — structural.** The audio cap
  (`process-take.server.ts:5246`) reached `takes.overall_score` (60), `score_breakdown`
  (model 94 / final 60) and the deterministic verdict ("Not ready yet"), but the rendered
  surface (94, "submit") derives from the AI judgement, into which the audio cap has no
  channel.

A fuller Phase 1 inversion table (conditions F1–F9, a "flattering-only theorem", an F5
prose-upgrade and F9 dead-caps mechanism) was stated in a parallel session; its provenance is
**unconfirmed** and it is **not** treated as established here — see Open questions. The
decisions below rest on the grounded two-authority/no-SSOT finding, not on those rows.

A narrow back-propagation fix (sync the AI judgement to the capped value at the choke point) was
considered and **rejected as evidenced-insufficient**: the defect class is structural (parallel
authorities with one-way reconciliation), and the level-calibration trace then found the same
class of split along the level axis. The durable fix is one canonical score that everything
derives from.

## Detail

### Core score model

- **Analysis precedes the score.** Step 1 observes and locates evidence; Step 2 _marks_ that
  evidence against brief × level; the score is **computed deterministically** from marked
  dimensions plus hard caps. The AI judges dimensions; it never emits or moves the final number.
- **One canonical score.** Every surface — render, narration, verdict, category scores,
  material_compliance, dashboard — derives from it. No surface may hold an independently
  authored score value.
- **Reasoning:** each confirmed divergence (Repro A, Repro B, the level-axis split) is an
  instance of a value being authored in one authority and consumed by a surface aligned to
  another. If the number is computed once and derived everywhere, that failure mode is
  structurally impossible rather than patched per-condition (the broader F1–F9 enumeration of
  conditions is pending re-derivation — see Open questions).

### Score vs subjectivity (MD-voice)

- The score is the **consistent gate**; subjective judgement must **not** move the number.
- **MD-voice** is a separate, bounded (2–3 sentences), suppressible module rendered _below_ the
  score, framed explicitly as one subjective practitioner view. It is evidence-gated, forbidden
  from contradicting the verdict, and is the designated home for developmental (non-gate)
  feedback.
- **Reasoning:** consistency is the product promise — the same tape must earn the same number.
  Containment keeps the report lean and quarantines AI hallucination away from the number. The
  reported F5 prose-upgrade is precisely what _unquarantined_ qualitative judgement would look
  like — prose reaching in and raising a score (that specific mechanism is pending verification,
  see Open questions; the quarantine decision stands on the grounded two-authority finding).

### Level calibration

- **Level changes the marking standard, not the observations.** Step 1 must be
  **level-invariant** — observe at maximum resolution regardless of selected level.
  **Currently refuted in code:** the selected-level prompt block is injected into the Step 1
  evidence-pass prompt (`process-take.server.ts:3688`), so Step 1 is level-aware today. Logged
  as an architectural defect to be removed by the Δ6 build.
- **Level enters at exactly one point: the marking function.** The score derives from
  level-marked dimensions; level cannot act twice (today it acts once on the A side as
  prompt-instructed score relativity and once on the D side as verdict-label bands) or float
  unchecked (today the A-side decision bands are level-flat while the D-side label bands are
  level-relative, so the two can disagree).
- **Rubric model, not threshold model.** Higher tiers add genuinely _different assessable
  criteria_, not the same dimensions with a moved bar. **Reasoning:** honest 0–100 calibration
  requires it; a threshold model bunches good professionals near the top — flat criteria with no
  real discriminating value.
- **S10-03 (Level-Relative Performer Calibration, Monday 2952749999, was Complete) found NOT
  fit for purpose** and reopened/blocked: level is split across A (prompt-instructed score
  relativity, unverified by any deterministic check) and D (verdict-label bands only,
  `bandsForLevel` `src/lib/audition-rules.ts:676-701`), unreconciled, and they can diverge —
  e.g. professional-level score 75 → D verdict "Worth another take" vs A band "submit if
  deadline is close". Observation invariance refuted (Step 1 level injection above). No
  full-pipeline same-tape-two-levels test exists.
- **S10-14 (Professional 90–100 banding, Monday 2952750147) closed/superseded:** it sub-divides
  an inflation that honest 0–100 calibration removes; professionals should **not** be assumed to
  cluster at 90+.

### Rubric authoring

- The AI **marks evidence against a defined rubric; it never authors the rubric at runtime**.
  Runtime authoring destroys consistency — each run would invent its own standard.
- **Method:** AI-drafted from research (institutional/academic marking criteria, conservatoire
  grade descriptors, pedagogy), seeded by existing discipline material → **expert
  discrimination elicitation** (experts rank/judge real tapes; they never read rubrics — experts
  are tacit: they confabulate when asked for rules but are reliable when judging instances) →
  **ratify by exception** (scarce expert time spent only where the AI-draft ranking diverges
  from the expert ranking).
- **Reasoning — expert-access constraints shape the method:** the available experts are busy,
  non-technical, costly, and uninvested-but-supportive. Asking them to codify their tacit
  standard directly is unreliable; asking them to discriminate between real tapes is reliable
  and cheap per unit of signal.
- **Provenance/confidence metadata:** each rubric criterion carries internal, version-controlled
  provenance (`expert_ratified` / `research_derived` / `model_drafted`). It **never moves the
  score and is never shown to the user or in the report** — it is an internal system-maturity
  measure for rubric governance.
- **QA note (not a user/runtime requirement):** stamping each take with the rubric version used
  is a QA/audit/reproducibility concern, not a product feature and not a Δ6 acceptance
  criterion.

### Rubric corpus scope (operator decision, 2026-06-07)

- **In scope:** all publicly available internet material — institutional/academic/published
  marking criteria and pedagogy; professional published performance media of any kind and any
  performer age (including child-led professional productions, e.g. Matilda); publicly published
  performance media including self-tapes. Licensed corpus also in scope.
- **Boundary:** publicly available only — no accessing encrypted/private stores (e.g. iCloud).
- **Noted concern (reviewing architect, logged against the decision, NON-BLOCKING):** "publicly
  viewable" is not "public-domain" or "consented" — families retain rights to self-tapes, and
  some material sits under casting confidentiality. For a product serving minors, recommend
  data/IP counsel sign-off before scale ingestion. Advisory; the operator has consciously
  accepted the exposure.
- **Method invariant (architecture, independent of corpus scope):** the rubric is **authored
  from codified expert criteria and validated by expert discrimination**. Performance media —
  however expert or widely available — is research signal and ratification _fixtures_, never the
  rubric's raw training corpus. **Reasoning:** this prevents the rubric becoming "what is
  common/available online" instead of "what is expert" — the same disease class one layer up:
  uncontrolled input reaching in and setting the standard (cf. the reported F5 mechanism,
  itself pending verification — see Open questions).

### Sequencing

- **Plumbing first:** build the canonical-score model + level-invariant Step 1 against the
  _current_ dimension set. This fixes the render-vs-persisted divergence class (including the
  reported flattering-only behaviour, pending verification — see Open questions) and the
  level-divergence defects regardless of rubric richness, and defines the shape the rubric
  plugs into.
- **Rubric-content authoring runs as a parallel stream** at expert-availability pace, gated on a
  human/research dependency — it is **not** a normal engineering task and must not block the
  plumbing.
- **Build discipline:** plan-first → design-review → PR-hold (operator merge protocol). High
  blast radius: the pinned test suite encodes the current _defective_ behaviour (e.g.
  `s10-v2-score-category-fallback-guard` asserts the rendered score equals the AI judgement
  score) and must be deliberately rewritten, not "fixed to pass". Scoring-path changes are
  manual-approval edits + `dry-run:analysis-worker` + canary + worker redeploy post-merge.

## Open questions

- **RESOLVED (2026-06-07): Phase 1 inversion table — the from-source re-derivation is COMPLETE,
  captured in [[arch-d6-phase1-as-is-score-map]] and ratified by ADR-0008.** The
  "flattering-only" / "rendered never lower than deterministic" theorem is **REFUTED** — R-vs-D
  is non-monotone (the render also withholds harsher than D). F9-as-described (deterministic
  caps overwritten by the v2 projection) was not confirmed; F5 was re-characterised as a
  prose-driven A-raise. The architecture decisions above did not depend on the prior table and
  are unaffected.
- **RESOLVED (2026-06-07): ADR-0008 ratification** — written and merged as
  `docs/architecture/adr/0008-canonical-score-invariant.md`.
- Data/IP counsel sign-off on the rubric corpus scope before scale ingestion (advisory,
  non-blocking — see noted concern above).
- Expert panel logistics: who, how many tapes per discrimination round, and the divergence
  threshold that triggers ratify-by-exception review.
- Whether the MD-voice module ships in the first plumbing build or after the rubric stream
  delivers its first ratified rubric.

## Links

- [[run-t1-evidence-binding-gate-2026-06-07]] — Run T1 validation evidence (rendered 93–96 vs
  all-zero persisted categories).
- [[arch-d3-evidence-binding-gate-handoff-2026-06-07]] — Δ3 handoff note (evidence-binding gate
  build whose authority framing this decision supersedes).
- [[arch-d3-rescope-division-of-authority]] — Δ3 rescope decision (gate as R4-only mutator);
  Δ6 inherits its division-of-authority framing.
- [[arch-d6-phase1-as-is-score-map]] — Δ6 Phase 1 as-is field map / inversion table (the
  completed from-source re-derivation; ratified by ADR-0008).
- [[arch-d6-canonical-score-computation-spec]] — the operational computation spec (canonical D; the single `min(.,A)` site removed) that operationalises this note for the build.
- Monday: Δ6 2967682223 · S10-03 2952749999 (reopened/blocked) · S10-14 2952750147
  (closed/superseded).
