---
id: arch-d6-slice1-outcome-slice2-verdict-mapping
title: Δ6 Slice 1 outcome (canonical headline, live-verified) + Slice 2 ratified verdict mapping
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
source_ref: "Δ6 build session 2026-06-08, origin/main; Slice 1 merged (#237, 2c89568) and live-verified via Supabase MCP; Slice 2 verdict mapping ratified by the operator on the honesty principle. Jointly worked with Claude Code."
discipline: null
monday_ref: "2967682223"
tags:
  [arch-deltas, decisions, score-model, canonical-score, verdict, conformance, level-calibration]
confidence: high
created: 2026-06-08
updated: 2026-06-08
---

## Purpose

Records two things the design notes do not yet carry: (1) that Δ6 Slice 1 (canonical headline) is **merged
and live-verified**, with what the live evidence showed; and (2) the **ratified verdict mapping** for Slice 2
(deterministic label → render decision vocabulary), with its honesty rationale. Both are operational
conclusions of the 2026-06-08 build session that a later session must inherit. Detail of the canonical
computation itself lives in the canonical score computation spec; this note is the build-progress + verdict
decision layer that sits on top of it.

## Slice 1 — canonical headline (MERGED, live-verified)

Merged as PR #237 (main 2c89568). Three-part shape, all on main:

- **Pipeline N4a:** the `min(.,A)` is removed at s10-readiness-score-semantics.server.ts:642
  (`overall = input.currentOverallScore`); the matrix cap (N4b) immediately below is unchanged; the AI
  judgement A is untouched. The `capped` return flag (sem:715) retains BOTH terms
  (`overall !== input.currentOverallScore || warnings.length > 0`); with the min gone, the first term now
  means "matrix-capped" rather than "min-or-matrix moved".
- **View model:** a DISTINCT `canonical_overall_score` field on S10PerformerReportViewModel
  (s10-report-view-model.server.ts:88 type; :1516 full builder = `asNumber(overall_score_final) ?? overall_score`;
  :1630 limited builder = null). `score_summary.overall_submission_readiness_score` stays = A (narration,
  gating, ≥90 suppression) — never overwritten.
- **Render:** V2ReportView ScoreRing, V2ReportViewLegacy, and the PDF model read
  `s10ScoreAuthorized ? canonical_overall_score : null` (the existing provenance gate — withhold seam
  unchanged). The v2-report-builder `overall_readiness` payload also points to D for cross-surface/QA/legacy
  consistency, with the withhold-null path preserved via the A-null signal.

**Live verification (Supabase MCP, the live site is the pre-launch test environment):**

- Take 56683584 — full report (report_status null, no limitation): `canonical_overall_score`=60 (D),
  `score_summary.overall_submission_readiness_score`=84 (A), payload overall_readiness=60, takes.overall_score=60.
  So visible/payload/aggregate all show canonical D=60 while score_summary retains A=84 for narration —
  exactly the contract, on real data. This is also a live inflation-direction case (A=84 > D=60): the headline
  correctly shows the lower honest deterministic number, not the AI's more generous 84.
- Take 51c56142 (first smoke) — fell to the limited report (limitation_reason
  `s10_v2_build_or_validation_failed`). This was a TAKE-SPECIFIC build artifact (the rebuild settling), NOT a
  Slice 1 regression: Slice 1's changes are null-safe on inspection, and the very next take on the same code
  produced a full correct canonical report — a systematic break could not pass and fail the identical path.
  No fix pursued; not release-blocking.

**Established pattern for the remaining slices:** read a persisted canonical value → thread a DISTINCT
view-model field → re-point the visible render via the existing provenance gate → the A-side object stays = A
for narration. Slices 2 and 3 follow this exactly (the verdict and the sub-surfaces render from the same
view-model chokepoint).

## Slice 2 — ratified verdict mapping (label → decision vocabulary)

The deterministic verdict is already persisted (computeSubmissionVerdict, process-take.server.ts:2588 →
`report.submission_verdict {label, reason, blocked}` at :5743 and `report.verdict_final` at :5924) and, since
Slice 1 made the number canonical, derives from canonical D at level-relative bands. So Slice 2 surfaces it and
re-points the render — it does NOT recompute the verdict in the view model.

**The subtlety:** the deterministic verdict uses a LABEL vocabulary (`VerdictLabel`: "Strong for this level" |
"Ready to submit" | "Worth another take" | "Not ready yet", plus a `capped` flag from applyCapsAndLabel),
while the render's display mapping (`verdictDisplay` / `VERDICT_DISPLAY` in src/lib/report-view-model.ts) is
keyed on a DECISION vocabulary (submit | submit_if_deadline_is_close | review_carefully |
retake_required_if_possible). So Slice 2 must surface a canonical DECISION derived deterministically from
label + capped + blocked.

**Ratified mapping (operator decision, honesty principle — "what is reliable, consistent and honest"):**

- "Strong for this level" OR "Ready to submit", and NOT capped → **submit**
- "Strong for this level" OR "Ready to submit", AND capped == true → **review_carefully**
  (the score clears the bar but a cap/flag fired — genuinely "submittable, but check it"; this is the real
  deterministic basis for review_carefully, not an invented state)
- "Worth another take" → **retake_required_if_possible**
  (below the bar; the deterministic reason itself says "close, a focused retake will lift this above the
  submission bar" — mapping it to review_carefully would dishonestly soften a reshoot into a maybe-submit,
  the flattering-direction error Δ6 exists to remove)
- "Not ready yet" OR blocked == true → **retake_required_if_possible**
- **submit_if_deadline_is_close → DROPPED.** It is an A-side hedge the deterministic system never makes; the
  AI cannot know the performer's deadline, so preserving it would reintroduce A-as-authority on the verdict —
  the same contamination Δ6 removed from the number. The canonical verdict emits only submit / review_carefully
  / retake_required_if_possible.

The deterministic REASON string (`submission_verdict.reason`) is preserved as the canonical verdict's reason —
it is tone-honest even when the action is "retake" (e.g. "close, a focused retake will lift it"). The chip word
comes from `verdictDisplay` (action-honest); the reason text stays the deterministic reason (tone-honest).

**Why this is correct under the Δ6 contract:** it directly satisfies the no-score↔verdict-drift invariant — a
capped-below-bar D can never show a clean "submit" because both the number and the verdict derive from D. It
removes the last A-as-authority path on the visible verdict (the deadline hedge), exactly as N4a removed it
from the number.

## Links

- [[arch-d6-canonical-score-computation-spec]] — the operational computation + surface bindings this builds on.
- [[arch-d6-phase1-as-is-score-map]] — the verified as-is divergence inventory.
- [[arch-d6-score-model-architecture]] — the target architecture.
- ADR-0008 (plain text — lives in docs/architecture/adr/, outside the vault) — the decision and its
  operational-definition addendum; Slice 1's N4a is its operational realisation, Slice 2's mapping extends
  the same "A never owns the visible value" principle to the verdict.
- Monday: Δ6 2967682223 (updates 587311553 Slice 1 live-verified; 587339795; 587348894 Slice 2 mapping).
