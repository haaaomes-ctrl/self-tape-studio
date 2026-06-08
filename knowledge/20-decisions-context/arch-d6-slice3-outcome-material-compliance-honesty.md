---
id: arch-d6-slice3-outcome-material-compliance-honesty
title: Δ6 Slice 3 outcome (canonical category scores + material_compliance) + the material_compliance up-movement honesty principle
tier: corpus
status: current
spine_anchor:
  [
    "ADR-0008",
    "README §Professional 0–100 level-relative score calibration",
    "AGENTS §Score terminology alignment",
  ]
decided_ref: "ADR-0008"
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "Δ6 Slice 3 build + review, 2026-06-08, origin/main @ 64d6a5b (#245 merged). Divergence-without-cap finding and the material_compliance up-movement sign-off ratified by the operator during the Slice 3 review. Jointly worked with Claude Code."
discipline: null
monday_ref: "2967682223"
tags:
  [
    arch-deltas,
    decisions,
    score-model,
    canonical-score,
    category-scores,
    material-compliance,
    honesty,
    conformance,
  ]
confidence: high
created: 2026-06-08
updated: 2026-06-08
---

## Purpose

Records the Δ6 Slice 3 outcome (the final performer-visible canonical surface) and, more importantly, the
honesty principle the operator ratified during its review: the canonical material_compliance may render
HIGHER than the AI judgement A, and this is honest BECAUSE the matrix only ever caps downward. This is a
durable judgement that is not obvious from the code alone — without it, a future reader could mistake the
up-movement for re-introduced inflation and "fix" it wrongly. Detail of the computation lives in the canonical
score computation spec; the render wiring lives in the process-time-snapshot note; this note is the Slice 3
decision layer on top of both.

## Slice 3 outcome (MERGED, #245, main 64d6a5b)

The final Δ6 visible surface. After Slice 3, ALL FOUR performer-visible S10 surfaces read canonical: headline
(Slice 1), verdict (Slice 2), category scores + material_compliance (Slice 3). Same proven pattern: read the
persisted canonical value → thread a DISTINCT view-model field → re-point the visible render via the EXISTING
gate → the A-side score_summary objects stay = A for narration.

- canonical_category_scores: A's category rows (readiness.category_scores, narration preserved) with each row's
  SCORE replaced by report.scores[category_id] (matrix-capped for brief_adherence via capNumberField at
  semantics time). Null-safe: where report.scores lacks a category (e.g. movement / mt_package, not keys in the
  flat scores map), the A row is preserved unchanged. Distinct from score_summary.category_scores (= A).
- canonical_material_compliance: report.brief_adherence_breakdown.material_compliance (matrix-capped via
  capNumberField). Gated to the EXISTING brief_completion authority (present iff A's brief_completion_score is
  present) so the withhold seam is identical. Distinct from score_summary.brief_completion_score (= A).
- Render re-points: V2ReportView.tsx:892, V2ReportViewLegacy.tsx:597 (existing presence seam), PDF
  report-view-model.ts categoryRowsRaw (scoreAuthorized-gated) + briefCompletion (view-model-gated) — only the
  source changed, the withhold gates are unchanged.
- The v2-report-builder PAYLOAD (v2.scores / v2.brief_adherence_breakdown) was deliberately LEFT = A and is NOT
  performer-visible (verified: no report component / route / PDF model reads it; all visible renders read the
  canonical view-model fields). The persisted payload is therefore internally inconsistent with the canonical
  view-model fields, but dormant. Tracked as a deferred follow-up (canonical-ise the payload + rewrite
  s10-v2-score-category-fallback-guard, the Δ6-anticipated guard rewrite).

## DECISION 1 — the category divergence is broader than a matrix cap (ratified)

The original framing assumed report.scores and A's category_scores diverge ONLY where a matrix cap binds.
Source disproves this: report.scores (the marks that feed the canonical overall D) and
readiness.category_scores / brief_completion_score are INDEPENDENTLY AI-authored, so they differ by a point or
two even with NO cap (strong fixture: report.scores {acting 93, vocal 94, technical 91, brief_adherence 96} vs
A {91, 92, 89, 94}). Per the ratified Option A, the visible category surface shows report.scores — the marks the
overall D is actually built from. This is consistent (subjects match the overall that was computed from them),
does not confuse the performer, and FIXES a latent category↔overall inconsistency that pre-dated Slice 3.
Consequence: it is a broad visible shift (most reports' category numbers move slightly), not cap-only. Benign
pre-launch (live site is the test environment; forward-only by the process-time-snapshot mechanics).

## DECISION 2 — material_compliance can move UP vs A; this is honest (ratified, with guardrail)

Unlike Slices 1/2 (where the canonical was typically LOWER than A — inflation removed), the canonical
material_compliance can render HIGHER than A (strong fixture: canonical 100 vs A 94). Two causes combine: the
same independent-authoring effect as Decision 1, and the fact that material_compliance is the MATRIX-CAPPED
surface while brief_completion_score (A) is clampScore-only.

THE PRINCIPLE (the durable judgement): this up-movement is HONEST, and Δ6 honesty was never "always show the
lower number." It is "show the value tied to the deterministic surface, and never let A inflate PAST what the
structure permits." capNumberField (s10-readiness-score-semantics.server.ts:531) only ever SETS a value DOWN to
the matrix cap and returns early when the value is already at or below the cap (`if (... original <= args.cap)
return;`) — it never RAISES a value. Therefore a high canonical material_compliance (e.g. 100) provably means
"the matrix found nothing missing" (no cap fired), NOT "A felt generous." The matrix is the discipline; a value
can only be as high as the matrix permits.

Operator decisions attached to this principle:

- Product perception: presenting a number is better than a blank field on a paying product. A's
  brief_completion_score is retained as a REDUNDANCY/FALLBACK so a missing canonical value never shows as an
  empty field. (Deferred follow-up.)
- Investigation: the operator would be surprised if the deterministic path ever fails to produce a score, so
  the missing-canonical case should emit a SERVER-LOG ERROR for later investigation rather than silently
  blanking. (Deferred follow-up / backlog.)
- GUARDRAIL (higher priority, pulled forward as its own PR): a conformance test pinning the invariant —
  canonical material_compliance (and brief_adherence) NEVER exceeds deriveReadinessConstraint(matrix).cap when
  a cap is present, and is left UNCHANGED (a high value such as 100 is legitimate) when no cap is present. The
  test asserts against the real semantics output and calls deriveReadinessConstraint for the ceiling (never a
  hard-coded cap value), and must fail under a deliberately broken capNumberField. This converts the sign-off
  from "true by reasoning" into "enforced by structure," so a future change to the cap logic that broke the
  guarantee would fail CI.

## Why the guardrail matters (the reason it was not deferred)

The sign-off on the up-movement rests entirely on "the matrix only caps downward." That is currently true by
reading the code, but nothing fails if a future edit makes capNumberField raise a value, or removes the
`constraint.cap != null` guard, or lets material_compliance exceed the cap. On a minors-facing scoring product
where the displayed number can now legitimately go up, the cheapest protection against silent regression of the
honesty guarantee is a test that pins the relationship. It was therefore pulled forward rather than batched with
the lower-priority fallback/logging work.

## Open / deferred (tracked on Monday, not conclusions)

- Guardrail test — pulled forward (own PR). Pins canonical material_compliance ≤ matrix ceiling (conditional on
  constraint.cap), no-cap arm preserved, asserted against real semantics.
- material_compliance A-fallback + server-log error on missing canonical score — deferred (Monday subitem
  2977679592).
- Canonical-ise the v2 payload + rewrite the fallback-guard — deferred (Monday subitem 2977734682).
- Post-launch re-analysis sweep — deferred (Monday subitem 2977261080).
- Audition-route guidanceReason hardening — deferred (Monday subitem 2977259906).
- D=40 score-reproduction + the verdict-reason-content question (reason cited "audio" while the blocker was the
  truncated song) — open thread, to be traced on the next smoke take.

## Links

- [[arch-d6-slice1-outcome-slice2-verdict-mapping]] — Slices 1/2 outcome + verdict mapping.
- [[arch-d6-render-wiring-process-time-snapshot]] — the render wiring (why Slice 3 changes are forward-only).
- [[arch-d6-canonical-score-computation-spec]] — the operational computation + surface bindings.
- [[arch-d6-score-model-architecture]] — the target architecture.
- ADR-0008 (plain text — lives in docs/architecture/adr/, outside the vault) — the canonical-score decision and
  its addendum; the matrix-cap lever and "A never owns the visible value" principle this note builds on.
- Monday: Δ6 2967682223 (update 587592917 records the Slice 3 review + both decisions; subitems 2977679592 / 2977734682 / 2977261080 / 2977259906 track the deferred follow-ups).
