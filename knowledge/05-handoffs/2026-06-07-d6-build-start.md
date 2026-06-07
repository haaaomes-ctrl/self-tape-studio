---
id: handoff-d6-build-start
title: Δ6 build start — implement canonical-score R=D; report detail re-pointed to deterministic value; test-first
tier: corpus
type: handoff
status: requested
target: claude-code
source: claude-project
created: 2026-06-07
updated: 2026-06-07
pr: null
spine_anchor:
  [
    "AGENTS §Score terminology alignment",
    "README §Professional 0–100 level-relative score calibration",
    "README §Performer Level Calibration Architecture",
  ]
monday_ref: "2967682223"
tags: [handoff, arch-deltas, score-model, level-calibration, build, conformance]
---

## Plan

The Δ6 derivation track is closed and ratified. This work-order BEGINS THE BUILD: make the rendered
score/verdict equal the single canonical deterministic value (R = D) on every surface. First
code-touching session of Δ6. Test-first. Do NOT re-derive, re-investigate, or re-open the
architecture — it is settled and ratified in ADR-0008. Implement against the settled contract.

**Convergence is toward the deterministic value D.** The report-detail surfaces currently render the
AI judgement A and must be re-pointed to the canonical D-derived value. The list/dashboard/ranking/
admin surfaces already render D and are correct — do NOT move them toward A.

**Suggested first vertical slice (operator confirms scope at session start):** the headline number
on the report detail — the branch selector at v2-report-builder.server.ts:306-320 (N1-N4). Write the
failing conformance test that the rendered headline equals canonical D, plus the cross-surface
consistency test (report detail == list/dashboard for the same take), THEN re-point the selector.
Land that slice; then proceed surface by surface — verdict/level bands (V1-V3), then sub-surfaces
(S1 category scores, S2 material_compliance), then confirm the withhold guards (H1/H2/H4) still hold.
Do NOT attempt all surfaces in one PR — atomise per the PR-and-hold model.

## Context (read before doing anything)

- docs/architecture/adr/0008-canonical-score-invariant.md — THE CONTRACT. R = D; one canonical
  value; AI marks dimensions, never owns the number; convergence toward deterministic D.
- knowledge/20-decisions-context/arch-d6-phase1-as-is-score-map.md — the verified as-is defect map
  and the conformance-test corpus this build implements; every divergence cited to file:line. This
  is the build spec.
- knowledge/20-decisions-context/arch-d6-score-model-architecture.md — target architecture.
- knowledge/20-decisions-context/arch-d6-spine-reconciliation.md — conformance-test requirement
  (test named spine clauses end-to-end; the failure mode was unverified conformance, not wrong
  doctrine).

**The defect in one paragraph:** Two persisted authorities, never reconciled back to each other —
D (deterministic `overall`: recompute → audio/role-fit/matrix caps; persisted as the
takes.overall_score column) and A (AI judgement readiness_score_judgement.
overall_submission_readiness_score; matrix-capped only). On the live S10 path the report renders A,
never D, via the branch selector at v2-report-builder.server.ts:306-320. R-vs-D is NON-MONOTONE
(render both inflates above D and, on observed-tape-reconcile / limited-report paths, withholds
harsher than D), so the contract is R = D, not "R ≥ D".

## State of main (verify at write-time)

- Main tip at handoff write: 35e2eacb docs(adr): ADR-0008 canonical score invariant (R=D) — ratifies Δ6 as-is map (#222)
- Landed in order: #217 architecture → #218 spine reconciliation → #219 handoff → #220 index parser
  fix → #221 as-is map → #222 ADR.
- Vault reconcile PR (chore/d6-reconcile-resolved-open-questions): NOT YET MERGED — the architecture
  note still *reads* as if the inversion table is pending; it is NOT, it is ratified in ADR-0008. Do
  not be misled by that stale signal.

## Acceptance

The build's acceptance suite = the conformance corpus from the as-is map, one pinned test per
verified divergence, each asserting the canonical model makes the divergence impossible:
- Number-drift N1 recompute / N2 audio cap / N3 role-fit / N4 matrix-min — rendered number cannot
  drift off the canonical value.
- Verdict-label V1 blocker cap / V2 brief-adherence floor / V3 level-axis — verdict derives from the
  canonical value at the correct LEVEL-RELATIVE bands (bandsForLevel), not the flat A bands.
- A-raise R1 — stale-package prose cannot raise the number.
- Sub-surface S1 category scores / S2 material_compliance — derive from canonical; category scores
  matrix-capped (today the rendered A category scores are NOT matrix-capped).
- Withheld H1 observed-tape reconcile / H2 component absent-blocked / H4 limited-report — remain
  valid; assert withholding is deliberate model output, not an artefact of which authority was read.
- Fork — after R=D there is only one number; the inflation-vs-withhold gate no longer selects WHICH
  number shows.
- Cross-surface consistency — report detail number/verdict equals list/dashboard/ranking/admin for
  the same take.

Implementation completion is NOT acceptance. Tests express R=D FIRST (fail against current code),
then implement to green; never weaken a test to make code pass.

## Constraints

- Test-first; plan-first; PR-and-HOLD (operator reviews the diff; Code does not merge).
- This touches the SCORING RENDER PATH. Blast radius is real: manual-approval + dry-run + canary +
  worker redeploy. Call out migration/deploy implications explicitly in the PR.
- The pinned guard src/server/__tests__/s10-v2-score-category-fallback-guard.test.ts must be
  SELECTIVELY RE-PINNED, NOT inverted or deleted. Its score/category/compliance assertions pin the
  headline to the A-side readiness (e.g. `expect(v2.overall_readiness).not.toBe(report.overall_score)`)
  — THAT is the defect, flip those to the canonical D-derived value. BUT the same file legitimately
  guards behaviour to KEEP: the canary null-on-missing-readiness cases (the withhold/H1 behaviour),
  the section_source_map provenance assertions, and the non-S10 legacy_projection case. Do NOT break
  those. "Rewrite, not fix-to-pass" = targeted re-pinning, not file replacement.
- Do NOT re-derive/re-investigate the inversion (ratified, ADR-0008). Do NOT touch the as-is map or
  ADR-0008 (correct and merged). Do NOT move aggregate surfaces toward A. Do NOT implement a "block
  inflation only" half-measure (the non-monotone finding rules it out; the harsh-side withhold
  depends on observed-tape evidence known unreliable — Δ3 dependency).
- Verify claims from source with file:line; if a line number has drifted, STOP and report rather
  than guessing.

## Results (filled in by Claude Code)
- Branch / PR:
- What changed:
- Deviations / decisions made:
- Follow-ups / new open questions:
