# ADR-0008: Canonical Score Invariant — One Deterministic Score per Take, Every Surface Derives From It

## Status

Accepted (2026-06-07). Decided by the operator. Ratifies the from-source as-is
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
