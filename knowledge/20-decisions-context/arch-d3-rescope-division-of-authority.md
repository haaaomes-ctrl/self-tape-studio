---
id: arch-d3-rescope-division-of-authority
title: Δ3 rescope — gate is R4-only mutator; per-row authority stays with the normaliser
tier: corpus
status: current
spine_anchor: ["AGENTS §Code responsibilities", "AGENTS §Score terminology alignment"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "ARCH-Δ3 stop-and-report + operator rescope approval, 2026-06-06/07 (PR #204)"
discipline: null
monday_ref: null
tags: [arch-deltas, evidence-binding-gate, decisions, pipeline]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Summary

The planned full evidence-binding gate (R1–R5, rewriting rows and synthesizing gaps) was
rescoped after a mandated stop-and-report: `normaliseBriefAchievementMatrix` already owns
per-row downgrade (R2-like) and mandatory-absence promotion (R3-like). The shipped gate is
R4 (verdict coherence) + R1 (the location test feeding it), with R2/R3 kept ASSERT-ONLY.

## Context / why

Building the gate as planned would have double-applied per-row logic against the
normaliser and broken idempotence. The stop-and-report build step (read the normaliser
end-to-end BEFORE writing the gate) caught it. The actual hole was narrower than planned:
`aggregateMatrix` passes the MODEL'S raw top-level statuses through untouched when
`requirement_results` is empty — every corrective branch keys on results content, and
"achieved" survives `oneOf()` because it is a valid enum member.

## Detail

**Division of authority (binding):**
- **R4 — the gate's ONLY mutations:** a positive top-level verdict (`achieved`/
  `mostly_achieved` overall, `clear` mandatory, `supports_submission` readiness) requires
  ≥1 LOCATED positive `requirement_result` row. The located test is over
  requirement_results — an orphan `component_verification` no row references cannot keep a
  verdict. Violations collapse all three fields to `not_assessable` (never `not_achieved`
  — "we don't know" ≠ "they failed"), replace the summary with the deterministic withheld
  sentence, and withdraw `material_compliance`.
- **R1:** strictly linked-ID-keyed location; dangling/empty `linked_*_ids` never count.
  ID-space rule: R1/R2/R4 run whenever a matrix exists, regardless of `brief_requirements`
  being empty; only R3 depends on it.
- **R2/R3 — ASSERT-ONLY:** audit actions when a row slipped past the normaliser; rows are
  never rewritten. A genuine slip is a normaliser bug to fix at source.
- **R2 slip-detector narrowed during build:** unlocated `achieved`/`mostly_achieved` only.
  `partly_achieved` is DELIBERATE normaliser output for admin-like requirements (file
  naming, role context — things a tape can never locate); asserting on it permanently
  false-positived canary A. Caught by the canary-zero-actions stop-gate, operator-approved.

**Performer-visible deterministic sentences (approved, test-pinned):**
- "Evidence-binding gate: the brief verdict was withheld because no located requirement
  evidence supports it."
- "Evidence-binding gate: material compliance was withdrawn because the brief verdict is
  not supported by located requirement evidence."

**Reversibility:** `app_config.evidence_binding_gate_enabled`, narrow read failing
OPEN-TO-ON (truthfulness gate — polarity deliberately opposite the tpl3 toggle); not in
`getResolvedConfig()`. Δ3a groundwork: `NotAssessableReason` field laid in report JSONB —
no DB column (monday 2971908011).

## Open questions

(none — settled; live-validation defect tracked in
[[arch-d3-evidence-binding-gate-handoff-2026-06-07]])

## Links

[[arch-d3-evidence-binding-gate-handoff-2026-06-07]] · PR #204 ·
src/server/evidence-binding-gate.server.ts · src/server/s10-brief-achievement-matrix.server.ts
