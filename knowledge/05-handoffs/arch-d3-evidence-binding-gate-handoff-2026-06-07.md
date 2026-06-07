---
id: arch-d3-evidence-binding-gate-handoff-2026-06-07
title: ARCH-Δ3 evidence-binding gate — handoff (RESOLVED 2026-06-07 — persist-projection defect fixed, live-proven)
tier: corpus
status: current
spine_anchor: ["AGENTS §Code responsibilities", "ADR-0003"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "ARCH-Δ2/Δ3 build session + operator handoff brief, 2026-06-07 (PRs #203, #204, #205)"
discipline: null
monday_ref: null
tags: [handoff, arch-deltas, evidence-binding-gate, pipeline]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Summary

RESOLVED. Δ3 is merged, deployed and live-proven end-to-end. The "gate not firing"
live-validation defect was neither of the original hypotheses: the gate executed correctly
on every path — its audit block was being silently dropped by the V2Report persistence
projection (root cause H3). Fixed by PR #212 (mirror into the `score_breakdown` column);
live row `fe3e880a` proves the mirror persists. See **Resolution (2026-06-07)** below; the
sections beneath it preserve the original investigation state as written pre-resolution.

## Resolution (2026-06-07)

- **Root cause = H3 (persist projection):** `buildV2Report` constructs a fixed-shape
  `V2Report`; `report.evidence_binding_gate` is not a field of it, so the audit block
  written onto the working report was dropped at the persistence projection on EVERY path.
  **H1 (path coverage) REFUTED in source** — all terminal report-persisting paths
  (two-step success, polish fallback, module-quality recovery, single-pass, baseline) pass
  the gate wiring before the single rendered-report write. **H2 (matrix location) REFUTED
  at gate-time** — the matrix is top-level when the gate reads it (set ~30 lines above);
  the projection re-homes it under `s10_view_model` afterwards. The gate's R4 effect always
  propagated (the view-model embeds the gated matrix); only observability was lost.
- **Fix = PR #212** (squash-merged `97eaa493`): mirror the audit object into the
  `score_breakdown` column, UNCONDITIONAL (every gated run, incl. quiet
  `applied:true/action_count:0` and kill-switch-off `applied:false`), following the
  `s10_module_readiness` precedent; plus an always-on `evidence_binding_gate_run` worker
  log so quiet passes are visible. No migration. No report-schema/public-boundary change.
- **Live proof = take `fe3e880a-7e02-4985-aaf4-6c4d828bb363`:**
  `score_breakdown.evidence_binding_gate = {version:"evidence_binding_gate_v1",
  applied:true, action_count:0, actions:[]}`; the report has NO top-level
  `evidence_binding_gate` key and NO top-level `brief_achievement_matrix` (matrix at
  `s10_view_model.brief_achievement_matrix`) — confirming the projection behaviour exactly
  as traced.
- **Deploy confirmed live** by re-grepping the worker bundle for the
  `evidence_binding_gate_run` marker and the scoreBreakdown mirror line BEFORE reading the
  row (merge ≠ live lesson applied).
- The "difficulty overcome" phrase was found in neither the repo source nor either
  persisted report — UI-side copy or paraphrase; it played no role in the defect.

**Carry-forward (nice-to-have validation, NOT outstanding Δ3 work):** the first persisted
`action_count >= 1` row (a positive-but-unlocated verdict collapsing to `not_assessable`
via R4) is the cleanest end-to-end proof of R4's visible corrective effect; the trace
already confirmed R4 propagates into the persisted matrix and scoring, so this is
confirmation-in-the-wild only.

---

_The sections below preserve the original investigation state (2026-06-07,
pre-resolution) as history._

## Context / why

Δ3 exists because a live report carried a positive brief verdict
(`overall_status="achieved"`, `mandatory_status="clear"`, `material_compliance=100`) over
ZERO located requirement evidence (`requirement_results=[]`). The gate makes that class of
report structurally impossible — when its code path runs.

## Detail

**Current state (verified):**
- `#204` (gate) and `#205` (consent revert) merged to main, in that blessed order reversed
  (#205 first for a clean baseline).
- Migration applied via MCP: `app_config.evidence_binding_gate_enabled` exists, NOT NULL,
  default true, value true; `quota_enabled` still false; `tpl3_report_view_enabled` still
  true; advisors clean (only known by-design/plan-limited findings).
- Worker deployed; live bundle grepped and contains `applyEvidenceBindingGate`,
  `getEvidenceBindingGateEnabled` and the withheld sentence.
- Δ2 confirmed working live: real MT take `ea017160` persists
  `audition_type="musical_theatre"`; an earlier Acting take persisted `"acting_scene"` —
  the hardcoded "unknown" is gone end-to-end.

**The one bug:** takes `568227bc` and `ea017160` (both no-brief, both reporting
"difficulty overcome" during analysis) persisted with no `evidence_binding_gate` audit
block. Two live hypotheses, not yet distinguished:
- **H1 (path coverage):** the gate wiring sits in a path these takes skipped — likely the
  single-pass/recovery path ("difficulty overcome" is the tell), not the shared section the
  plan intended.
- **H2 (matrix location):** the gate reads `report.brief_achievement_matrix` (top-level),
  but on real takes the matrix may live only at
  `report.s10_view_model.brief_achievement_matrix` — so even when the gate runs it may
  receive null. (May be a non-issue if the matrix is top-level at gate-time and only
  nested later — needs source confirmation.)

**Safety posture:** no rollback needed — the gate is inert/fail-safe in this failure mode
(absent, not corrupting). Reports are no worse than pre-Δ3.

**Operating lessons (also recorded in Lovable workspace knowledge):**
1. Merge ≠ live — the frontend needs Lovable Publish, the worker needs a manual
   `npm run deploy:analysis-worker`.
2. The leaked-password advisor WARN is plan-limited (Pro-only feature), not a regression.

**Monday board:** Architecture Consolidation Deltas group triaged — Δ1 Complete,
Δ2 Complete, Δ3 In Progress, Template 3 Complete, others Not Started with priorities set.
Δ3's item should read: "merged but live-validation found a path-coverage defect; gate not
yet firing" — held until the trace distinguishes H1/H2.

## Single next step (completed — see Resolution above)

~~Send the drafted diagnostic brief to Claude Code (INVESTIGATE-ONLY, no patch): trace which
terminal report-persisting paths in `process-take.server.ts` execute the gate wiring, and
where `brief_achievement_matrix` lives at gate-time vs persist-time. Fix from the findings.~~
Done: the trace refuted H1/H2, identified H3, and PR #212 fixed it.

## Open questions

(none — resolved 2026-06-07. The original questions and their answers: H1 vs H2 → neither,
root cause was H3 (persist projection); "difficulty overcome" → not pipeline or report copy,
played no role. The ADR question — should the gate get ADR-0008? — is NOT carried on this
handoff: it belongs to the ARCH-DOC / ADR-0008 workstream.)

## Links

[[arch-d3-rescope-division-of-authority]] · [[consent-copy-ai-disclaimer-revert]] ·
PRs #203 #204 #205 · **PR #212 (`97eaa493`) — the persist-projection fix** ·
monday 2971908011 (Δ3a reason codes)
