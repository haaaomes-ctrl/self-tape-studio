---
id: arch-d6-render-wiring-process-time-snapshot
title: Δ6 render wiring — performer surface reads the PROCESS-TIME snapshot (report.s10_view_model); canonical fields are forward-only by construction
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
source_ref: "Δ6 build session 2026-06-08, origin/main @ 4d1751c (Slices 1+2 and the blocked-reason sanitisation #242 merged). Wiring verified from source during the #242 review; corrects an earlier loose assumption (held by both the reviewing assistant and the #242 author's first description) that the canonical fields were render-time. Jointly worked with Claude Code."
discipline: null
monday_ref: "2967682223"
tags:
  [arch-deltas, decisions, score-model, canonical-score, render-wiring, view-model, forward-only]
confidence: high
created: 2026-06-08
updated: 2026-06-08
---

## Purpose

Records the VERIFIED render wiring for the Δ6 canonical fields, because an earlier loose assumption (canonical
values are computed at render time) was WRONG and would cause a fresh session to reason incorrectly about where
the fix lands and why persisted-value changes behave as they do. This is the controlling fact for Slices 1, 2,
and 3: all canonical fields are computed at PROCESS time and baked into the persisted snapshot the performer
reads. Detail of the canonical computation lives in the canonical score computation spec and the Slice-1/2
outcome note; this note is the render-wiring layer that sits under all of them.

## The verified wiring (from source, origin/main @ 4d1751c)

- The performer-visible report reads the PERSISTED PROCESS-TIME SNAPSHOT, not a render-time rebuild:
  V2ReportView.tsx:661 and V2ReportViewLegacy.tsx:371 both do `const rawS10View = report.s10_view_model`. The
  report route is audition.$auditionId.tsx (renders V2ReportView ~:1081).
- The snapshot is built at PROCESS time. Chain: process-take.server.ts → buildRouteReportForPersistence
  (process-take.server.ts:6737, dynamically imported :6733) → buildV2Report (v2-report-builder.server.ts:569
  `args.buildV2 ?? buildV2Report`, def :293) → buildS10PerformerReportViewModel (v2-report-builder.server.ts:246/295)
  → canonicalVerdictFromReport / the canonical-field assembly. At that point report.submission_verdict (set
  process-take.server.ts:5748) and the IN-MEMORY report.block_reasons (set :5930) are present in memory.
- composeS10AuthenticatedReportModel (s10-authenticated-report-model.server.ts:398) is DEFINED but has NO live
  callers — it is not a render path. (Do not assume an authenticated-model rebuild feeds the screen.)
- submission_verdict is NOT persisted on the report JSONB (confirmed by DB on take 0a7e52d7: absent at top level,
  under s10_view_model, and under raw_report). The persisted s10_view_model snapshot carries the canonical fields
  (canonical_overall_score, canonical_verdict); the raw inputs that produced them are not all persisted.
- Semantics-cap ordering: applyReadinessScoreSemantics (process-take.server.ts:5357) applies the matrix caps to
  report.scores.brief_adherence and report.brief_adherence_breakdown.material_compliance (via capNumberField,
  s10-readiness-score-semantics.server.ts:656/665) BEFORE buildRouteReportForPersistence (:6737) builds the
  snapshot. So the already-capped sub-surface values are available at the build point — relevant to Slice 3.

## Why this matters (the consequence)

All Δ6 canonical fields — canonical_overall_score (Slice 1), canonical_verdict (Slice 2), and the forthcoming
canonical category scores + canonical material_compliance (Slice 3) — are computed at PROCESS time and persisted
into the snapshot the performer reads. Therefore:

- Persisted-snapshot changes are FORWARD-ONLY BY CONSTRUCTION: a code change to the canonical computation affects
  only NEWLY-analysed takes; pre-existing snapshots are unchanged until re-analysed. This is benign pre-launch
  (the live site is the test environment; no delivered reports), and a re-analysis sweep is the lever if/when
  older takes need the new behaviour (e.g. before any future slice renders canonical_verdict.reason on old takes).
- A fix to a canonical field must land where the snapshot is BUILT (process-time, inside the buildV2Report chain
  above) to be effective on the displayed value. A render-time-only change would not alter an already-built
  snapshot. (This is why the #242 blocked-reason sanitisation is effective: performerSafeVerdictReason sits inside
  canonicalVerdictFromReport, which the process-time build calls — so new takes' snapshots are sanitised.)

## block_reasons timing (supporting detail)

The helper/assembly consumes the IN-MEMORY report.block_reasons (process-take.server.ts:5930), which is DISTINCT
from the V2Report's PROJECTED block_reasons (v2-report-builder.server.ts:480 = `readiness.rationale ?? []`). So a
persisted block_reasons of `[]` is the projection, not the value consumed at build time — for a blocked take the
in-memory array is populated (it carries the verdict reason plus compliance/readiness lines).

## Open threads (as of 2026-06-08, NOT yet resolved — do not treat as conclusions)

- Slice 3 is scoped and ready (NOT yet built): canonical category scores + material_compliance, the final
  performer-visible surface. Ratified design = Option A — re-point ALL category scores to the deterministic
  report.scores (brief_adherence already matrix-capped; other categories = marks), preserving A's per-category
  narration; canonical material_compliance from report.brief_adherence_breakdown.material_compliance; distinct
  view-model fields; re-point render via the existing s10ScoreAuthorized gate. NOT a number-swap (category marks
  already equal A except where a matrix cap binds). To verify in build: the score_summary.brief_completion_score
  (A) ↔ brief_adherence_breakdown.material_compliance (canonical) field-name reconciliation, and whether non-brief
  category scores can diverge between report.scores and A's rows. Slice 3 outcome will be captured in its own note
  once built (mirroring the Slice 1/2 outcome note).
- D=40 score-reproduction (OPEN): on take 0a7e52d7, recomputing report.scores {acting 45, vocal 50,
  brief_adherence 30, technical 80, audio 85, professional_presentation 70} with the documented MT weights
  ({acting .3, vocal .3, brief_adherence .15, technical .15, audio .1}) gives ≈53.5, and no documented cap
  (54/60/62/69/75) lands on 40 — so the persisted canonical D=40 could not be reproduced from the visible inputs.
  Possibly stale weights, or an unmodelled computation step. To be traced on the next smoke take (operator reports
  the score; this assistant follows the calculation; pull Code in to compute against the actual scoring code if it
  still won't reconcile). It does NOT change that take's outcome (retake either way), but a non-reproducible score
  is a score-honesty flag worth resolving.
- Related verdict-reason-CONTENT question (OPEN, separate from the #242 sanitisation mechanism): on the same take
  the verdict reason cited "audio is too unclear" while the actual blocker per brief_adherence_breakdown was the
  truncated/incomplete song (audio scored 85). The sanitiser faithfully reframes whatever reason it is given; this
  is a reason-content accuracy question, tied to the D=40 trace, not a sanitisation defect.
- Deferred (flagged): audition-route guidanceReason hardening — confirmed latent (r.submission_verdict absent in
  the persisted report → falls through to block_reasons → safe). Low-priority follow-up.

## Links

- [[arch-d6-slice1-outcome-slice2-verdict-mapping]] — Slice 1 outcome + Slice 2 verdict mapping (the canonical
  fields whose render wiring this note documents).
- [[arch-d6-canonical-score-computation-spec]] — the operational computation + surface bindings.
- [[arch-d6-score-model-architecture]] — the target architecture.
- ADR-0008 (plain text — lives in docs/architecture/adr/, outside the vault) — the canonical-score decision and
  its addendum; this note is the render-wiring fact underpinning how the canonical values reach the performer.
- Monday: Δ6 2967682223 (update 587459416 records this wiring + the forward-only consequence).
