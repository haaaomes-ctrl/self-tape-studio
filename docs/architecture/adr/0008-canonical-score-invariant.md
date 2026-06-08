# ADR-0008: Canonical Score Invariant — One Deterministic Score per Take, Every Surface Derives From It

## Status

Accepted (2026-06-07); operational definition added by addendum (2026-06-07, see below). Decided by the operator. Ratifies the from-source as-is
map `arch-d6-phase1-as-is-score-map` (knowledge corpus) into a controlling
contract; basis for the Δ6 build. README wins on conflict.

## Context

TapeCoach persists two score authorities per take that are never reconciled
back to each other: a deterministic value D (the AI-marked dimension scores
recomputed and then capped — audio, role-fit, matrix — persisted as the
`takes.overall_score` column) and an AI judgement A
(`readiness_score_judgement`; matrix-capped only). The S10 report-detail
render reads A; the take list, dashboard, ranking and admin surfaces read D —
so the same take shows different numbers on the same screen, including the
report route itself.

The from-source derivation (`arch-d6-phase1-as-is-score-map`) verified that
render-vs-D is **non-monotone**: the render both inflates above D and, on the
observed-tape reconcile and limited-report paths, withholds harsher than D.
A "the render is never lower than D" / flattering-only property is **refuted
from source**, so the contract cannot be R ≥ D. That refutation is the basis
for this decision: the only sound invariant is equality with a single
canonical value.

## Decision

A single canonical score and verdict per take is the sole authority for every
user-facing surface.

1. **Invariant (R = D):** the rendered score/verdict on every surface equals
   the one canonical value; no surface holds an independent score. The AI
   marks dimensions and evidence but never owns the headline number.
2. **Convergence toward the deterministic value:** the canonical value is the
   capped deterministic D. The list, dashboard, ranking and admin surfaces
   already read D and are correct; only the report detail reads A — so the
   report-detail surfaces (headline number, verdict, category scores,
   material_compliance) must be re-derived from the canonical value, not the
   aggregate surfaces moved onto A.
3. **Withholding is a deliberate model output**, not an artefact of which
   authority a surface read. The harsh/withheld paths (observed-tape
   reconcile, limited report) remain valid but must derive from the canonical
   model, not from a second authority.
4. **Conformance is enforced by pinned tests** — one per verified divergence
   in the as-is map (number-drift, verdict-label, A-raise, sub-surface,
   withheld, fork, cross-surface consistency) — and the existing
   `s10-v2-score-category-fallback-guard` is deliberately rewritten: it
   currently asserts the rendered score equals the AI judgement, i.e. it
   encodes the defect.

This ADR ratifies the invariant and the convergence direction only; it does
not specify the build beyond them, and it does not claim the build is done.

## Consequences

**Positive:** one honest number per take; the on-screen contradiction between
the report detail and the surfaces the performer navigated from is removed;
the safety contract is testable and exhaustive (one pinned test per verified
divergence).

**Costs / obligations:** the report-detail surfaces must be re-pointed to the
canonical value; the pinned `s10-v2-score-category-fallback-guard` must be
rewritten rather than made to pass.

**Risks:** the harsh-side safety net (the observed-tape reconcile) depends on
observed-tape evidence known to be unreliable on live takes — which is why
convergence is to D rather than a "block inflation only" half-measure; note
the Δ3 evidence-binding dependency.

## References

- As-is map (verified basis): `knowledge/20-decisions-context/arch-d6-phase1-as-is-score-map.md`
- Architecture: `knowledge/20-decisions-context/arch-d6-score-model-architecture.md`
- Spine reconciliation / conformance requirement: `knowledge/20-decisions-context/arch-d6-spine-reconciliation.md`
- Monday: Δ6 2967682223

## Addendum (2026-06-07) — Operational definition: canonical D = pure deterministic (the `min(.,A)` is removed)

### Why this addendum exists

The Decision above ratified the _principle_ ("one canonical score computed deterministically; the AI
marks dimensions but never owns the number") but not the _operational definition_ — what the canonical
number concretely is in code. The Δ6 build then stalled on "which D?", because a from-source trace
(jointly verified by the project model and Claude Code, `origin/main`) established a fact the original
Context did not capture:

**The value persisted as `takes.overall_score` is not the pure deterministic number — it is
`min(deterministic, A)`.** At `s10-readiness-score-semantics.server.ts:636-639` the persisted overall is
`A != null ? Math.min(currentOverallScore, A) : currentOverallScore`, then matrix-capped at :641-650.
So the AI judgement A can pull the number **down**, and wherever A is lower than the deterministic value,
the persisted column **equals A**. This corrects Decision point 2 above: the statement that "the list,
dashboard, ranking and admin surfaces already read D and are correct" holds **only where A ≥ deterministic**;
where A < deterministic, those aggregate surfaces render an **A-contaminated** value, not the pure
canonical value. The aggregates were not "already correct" in those cases — they were quietly carrying
the AI's downward influence.

### The single A-contamination site (verified — exactly one)

A full trace of every place the AI judgement could touch the **number** found **one** site: the
`min(.,A)` at sem:638. The deterministic chain (recompute → audio cap → role-fit → matrix cap) never
reads A; the AI judgement object A is computed in parallel and touches the number only at that `min`.
The verdict path (deterministic verdict derives from the number; rendered verdict reads A's decision —
the known level-axis divergence) and the sub-surfaces (category scores clamped only; `brief_adherence`
and `material_compliance` capped against the **matrix**, not A) contain **no further hidden A-movers**.
This is a single, well-localised defect — not a tangled score model — so it is corrected in place; a
score-model rebuild is not warranted.

### Operational definition (ratified)

**The canonical score is the pure deterministic value. The AI marks the per-dimension scores that feed
the recompute, but never moves the resulting number.**

Canonical chain, in order: (N1) `recomputeOverall` — weighted mean of AI-marked category scores, missing
categories dropped and weights renormalised; (N2) audio cap — **conditional**, fires only when audio is
poor (`<35→60, <50→62, <60→75`); (N3) role-fit modifier, clamped [-10,+5]; (N4) matrix cap — fires only
on a blocker/gap (hard mandatory blocker → 54; mandatory gap → 69; else none). **The `min(.,A)` at
sem:638 is removed** so the AI judgement can no longer move the number; the matrix cap (N4) is retained
unchanged. The AI judgement object A continues to exist and to inform narration and dimension scoring;
it simply stops owning the number.

**100 remains attainable.** Every ceiling in the chain is conditional on something being wrong: the audio
cap fires only when audio `< 60`; the matrix cap fires only on missing/blocked mandatory material; the
recompute is a weighted mean with no internal ceiling. A take with strong dimensions, good audio (≥60)
and a complete, compliant package has no cap applied and can reach 100. This matters for audio-prime
disciplines (commercial, voice, singing): how much audio drives the number is governed by the
per-discipline recompute **weights** (`weightsForType`), not by an artificial ceiling — so if an
audio-prime discipline should weight audio more heavily, that is a weights decision, not a change to this
canonical definition.

### The three levers for tuning strictness (ratified principle — guidance for all future "scores too generous / too harsh" decisions)

The canonical number is the **honest deterministic measurement**. We do not artificially quash scores to
manufacture caution, and we do not let the AI's holistic opinion silently override the measured number.
If scores come out too generous or too harsh, there are exactly three legitimate, traceable levers — and
"let A move the number" is explicitly **not** one of them:

1. **Strictness of the measurement → the AI Prompt Catalogue.** The dimension scores should be honestly
   hard. The protocol, rigour and attitude of the analysis are stipulated in the AI Prompt Catalogue (the
   decided single source of truth across model calls). If the system is too generous, tighten how the
   dimensions are scored here. This is the primary lever.
2. **Structural gates → the matrix caps (N4).** Missing/blocked mandatory material is gated by the matrix
   constraint caps (54 / 69). If an incomplete package scores too kindly, recalibrate the cap value — not
   the computation, and not by re-introducing an A-override.
3. **Discipline weighting → `weightsForType` (N1).** How much each dimension drives the number is set by
   the per-discipline weights. Mis-weighting (e.g. audio under-counted for a voice discipline) is fixed
   here.

A fourth, hidden lever — the `min(.,A)` — previously let the AI's opinion pull the number around
untraceably. It is removed precisely because it is untraceable and because it is the AI owning the number,
which Decision point 1 forbids. Future contributors must not re-introduce a `min`/`max`-against-A or any
equivalent shortcut; strictness belongs in the three levers above.

### The safety-semantics consequence (ratified with eyes open)

Removing the `min(.,A)` means: wherever the AI scored **lower** than the deterministic value, the canonical
number rises to the deterministic value. Concretely, the canary incomplete-package fixture's headline rises
**42 → 54** (deterministic 66, capped at 54 by the hard-blocker matrix cap; the AI's 42 was the AI owning
the number). The **verdict is unchanged** — it remains "retake/not ready to submit" via the matrix decision
cap — so the casting outcome is identical; only the number is more faithful to the rubric and now fully
traceable. Operator's ratified position: a 54 and a 42 yield the same outcome (the take is not ready to
submit); the jump is immaterial at this level; and for a fixture this thin (a short clip, no brief, Side 1
absent) the system having little to score by and correctly returning "not ready" is the system functioning
honestly — no false promise, no over-scoring. If 54 is ever judged too kind for a hard blocker, the lever is
the matrix cap value (lever 2 above), not the `min`.

### Strong-fixture consequence

For a complete strong take where the deterministic value **exceeds** A (e.g. deterministic 93 vs A 91),
removing the `min` lets the honest **higher** number show: the headline rises 91 → 93. This is the
flattering-direction proof that R = canonical D.

### What is corrected, what stands

- **Corrected:** Decision point 2's "aggregates already read D and are correct" — true only where
  A ≥ deterministic; the aggregate column is A-contaminated where A < deterministic and becomes the pure
  canonical value once the `min` is removed (so the aggregates _move_ to the correct value — this movement
  is the fix, not a regression, and it supersedes the original "do not move the aggregates" framing, which
  rested on the false premise that they already showed pure D).
- **Stands:** Decision points 1, 3, 4 unchanged; the non-monotone refutation of "R ≥ D" unchanged; R = D
  unchanged; the conformance corpus unchanged (with the addition below).
- **Conformance addition:** the headline-inflation direction (A higher than a capped D) is exhibited by
  **neither** named fixture (in both strong and canary, A < deterministic), so a Repro-B-style audio-capped
  fixture (A high, audio cap pulls D below A; e.g. A=94 → D=60, headline must fall to 60) MUST be added — or
  the headline fix is not demonstrated in the inflation direction.
- **Build-mechanics note:** removing the `min` shifts the meaning of the function's `capped` return flag
  (sem:715: `overall !== currentOverallScore`) — it now means "matrix-capped" rather than "min-or-matrix
  moved"; the build must re-point that flag's semantics and any test asserting it, deliberately.

### Operational reference

The full computation specification (chain, surface bindings, fixture expected outputs, build sequence) is
captured at `knowledge/20-decisions-context/arch-d6-canonical-score-computation-spec.md` (separate vault PR).
