---
id: arch-d6-phase2-report-experience-outcome
title: Δ6 phase 2 outcome — the report-experience programme (P1–P5), surfacing the canonical score honestly across the report
tier: corpus
status: current
spine_anchor: ["ADR-0008", "README §Calibration doctrine", "AGENTS §Score terminology alignment"]
decided_ref: "ADR-0008"
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "Δ6 phase-2 build + reviewing-architect verification, 2026-06-09, origin/main @ 27c7548c. Six slices P1–P5 built by Claude Code (developer + senior-dev pair), each PR-and-HOLD, verified byte-exact vs merge-base by the reviewing architect, merged by the SRO. Jointly worked with Claude Code."
discipline: null
monday_ref: "2967682223"
tags: [arch-deltas, decisions, report-experience, canonical-score, narration, valence, render, conformance]
confidence: high
created: 2026-06-09
updated: 2026-06-09
---

## Summary
The canonical-score-first architecture (ADR-0008 / report-derivation) fixed *what the number is*; this programme — six slices, P1–P5 — fixed *how the report presents it*, so every surface narrates from the one canonical score and never drifts from it. All six merged to main; post-merge build green.

## Context / why
ADR-0008 and [[arch-report-derivation-architecture]] established the deterministic canonical score and the rule that narration is written FROM scored, anchored dimensions. But the rendered report still had score↔narration drift, duplicate brief listings, a flat topology, and no per-moment valence. Phase 2 is the report-experience layer on top of the score model in [[arch-d6-score-model-architecture]].

## Detail
Six slices (each PR-and-HOLD; verified byte-exact vs true merge-base by the reviewing architect; merged by the SRO):
- P1 (#260, 0d2d1fd1) — verdict↔content coherence: a deterministic rationale built from block_reasons replaces AI rationale on non-positive verdicts, so the recommendation cannot contradict the canonical verdict.
- P2 (#261, 91f83af9) — the optional MD-voice practitioner module below the score (one subjective view; verdict-language suppressed). The only migration in the series: the md_voice_enabled kill-switch.
- P3a (#263, 03376aa6) — D3 v2-payload canonical-isation: in-payload score copies annotated @deprecated; canonical-sourced columns + comparison data-path preserved; dead-field audit = 0 dead fields.
- P3b (#265, b52871bc) — render topology: category-scores + prioritised-fixes promoted; per-category rationale enriched from canonical rows.
- P4 (#266, 7b0439eb) — brief de-dup: one collapsible per-requirement table; orphan requirements folded so nothing drops; Observed-tape slimmed.
- P5 (#267, 27c7548c) — AI-authored per-note valence + module-link on timestamped notes (display-only; colour + non-colour cue + category tag). See [[arch-ai-authored-valence-optimism-bias-guard]].

Cross-cutting principles realised:
- Display-only / cannot-move-the-number: every new surface field (deterministic rationale, MD-voice, valence) never feeds a score, cap, verdict or gate. For P5 this was verified by inspection of who reads the field, not only by test.
- Deterministic for the number; AI for the prose/colour around it.
- Judgement at the judgement stage: valence is authored in Step 2, not the judgement-free Step-1 observation pass ([[arch-d5-s3-evidence-handoff-cleanup]]).
- Verification discipline: every held PR diffed byte-exact against its true merge-base (main drifts via Lovable + other streams); legacy paths proven byte-identical.

Discrepancies surfaced and handled (retraction culture — premises corrected on record, instructions held where still correct):
- P3a: the "future_report_enabled fully on" premise was wrong (it is false; the v1 path is dead-in-practice but retained as a failure-mode fallback), and the deprecation target was mis-pointed at the live column — both caught by Code and corrected.
- P3b / P4: work-orders mis-cited render sources (category_rationale is gated out for S10; the "category is not a per-row field" premise was backwards) — caught by Code; the omit/enrich instructions held; premises corrected.
- P5: the AI output schema lived in process-take.server.ts (S10_TIMESTAMPED_NOTE_SCHEMA), not where the grounding looked — Code located it correctly.

## Open questions
- P5 valence calibration is not yet empirically confirmed. The two-take bias E2E — Hannah (positive) + a deliberately degraded/mixed take — is the outstanding architect check; a positive take alone cannot prove the "improvement" path fires or that optimism bias is held. Pending a real mixed take.

## Links
- [[arch-report-derivation-architecture]]
- [[arch-d6-score-model-architecture]]
- [[arch-d6-slice3-outcome-material-compliance-honesty]]
- [[arch-d5-s3-evidence-handoff-cleanup]]
- [[arch-ai-authored-valence-optimism-bias-guard]]

(Follow-ups spawned, tracked on Monday — not open questions: flag-gated v1/legacy_passthrough + deprecated in-payload V2Report.scores removal; per-module→category attribution of the global craft modules; optional per-requirement page-reference line in the brief table; the PDF report rework, S11-PDF-01, Deferred. The stale s10-ai-prompt-map.md v1→v2 reference is corrected in this same PR.)
