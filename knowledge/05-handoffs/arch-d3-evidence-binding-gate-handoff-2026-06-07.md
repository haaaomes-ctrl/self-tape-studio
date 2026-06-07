---
id: arch-d3-evidence-binding-gate-handoff-2026-06-07
title: ARCH-Δ3 evidence-binding gate — handoff (merged, live-validation defect open)
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
tags: [handoff, arch-deltas, evidence-binding-gate, pipeline, open-question]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Summary

Δ3 (#204) and the consent revert (#205) are merged; the kill-switch migration is applied and
verified; the worker is deployed and provably contains the gate code. BUT the gate is not
firing on live takes: two no-brief MT takes persisted with NO `evidence_binding_gate` block
at all — not even the disabled-branch `applied:false` form — meaning the wiring's code path
was not executed. One diagnostic step is queued before any fix.

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

## Single next step

Send the drafted diagnostic brief to Claude Code (INVESTIGATE-ONLY, no patch): trace which
terminal report-persisting paths in `process-take.server.ts` execute the gate wiring, and
where `brief_achievement_matrix` lives at gate-time vs persist-time. Fix from the findings.

## Open questions

1. H1 vs H2 — which explains the absent audit block (or both)?
2. Why do both live takes report "difficulty overcome", and which terminal path does that
   string correspond to?
3. Should the Δ3 gate get an ADR (would be ADR-0008 — none exists; ADRs currently end at
   0007 Knowledge OS)?

## Links

[[arch-d3-rescope-division-of-authority]] · [[consent-copy-ai-disclaimer-revert]] ·
PRs #203 #204 #205 · monday 2971908011 (Δ3a reason codes)
