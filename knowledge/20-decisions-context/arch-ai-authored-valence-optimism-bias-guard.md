---
id: arch-ai-authored-valence-optimism-bias-guard
title: Guarding AI-authored evaluative fields against optimism bias — anchor to evidence-bound signals, calibrate the prompt, validate with a negative case
tier: corpus
status: current
spine_anchor: ["ADR-0008", "README §Calibration doctrine"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "Δ6 P5 critical design review + build, 2026-06-09 (#267, 27c7548c). The reviewing architect's self-review surfaced AI optimism bias as the key risk in AI-authored per-note valence; the mitigation was designed, built and verified, then generalised here as reusable doctrine."
discipline: null
monday_ref: "2967682223"
tags: [decisions, ai-output-discipline, bias, calibration, valence, conformance, principle]
confidence: high
created: 2026-06-09
updated: 2026-06-09
---

## Summary
When the AI authors an evaluative field (a per-item valence or label), its documented optimism bias will skew the field positive unless guarded. The durable mitigation is three levers: anchor the field to evidence-bound signals deterministically, calibrate the prompt against defaulting-to-positive, and validate with a deliberately negative case.

## Context / why
TapeCoach has a documented flattering-bias finding — before it was fixed, the rendered score was provably never lower than the deterministic value. Any AI-authored evaluative field inherits that tendency. Δ6 P5 added per-note valence (strength / neutral / improvement) on timestamped notes — a field whose whole purpose is the good-vs-needs-work judgement, so it was directly exposed: the likely failure is a misleadingly green report that under-surfaces improvements. The first design guarded only the missing-component case; that was not enough, and the critical review caught it.

## Detail
Three levers (all built and verified in #267):
1. Deterministic reconciliation to evidence-bound signals. The note already carries linkages (linked_strength_ids, linked_fix_ids, is_missing_component_note) that are harder to inflate than a free label. Guard: if the AI says "strength" but the note links a fix or a missing component and links no strength, force "improvement" and emit a metric (s10_valence_reconciled_to_improvement). A note linked to BOTH a strength and a fix is genuinely mixed — leave it. Code repairs the contradiction; it does not invent.
2. Prompt calibration. Instruct explicitly: valence must reflect the note's actual content; do NOT default to "strength"; a real tape normally carries a mix; mark "strength" only where genuinely strong. This is the only lever for systematic over-positivity that has no linkage contradiction to catch.
3. Negative-case validation. A positive reference take (Hannah) cannot prove the improvement path fires or that calibration holds — it has no weaknesses to surface. The bias check needs a deliberately weak/mixed take; pair the positive and negative takes in the E2E.

Two supporting invariants:
- Author evaluative judgement at the judgement stage. Valence is a judgement, so it is authored in Step 2 (report authoring), not the judgement-free Step-1 observation pass — which also avoids a fragile Step-1→note timecode join. Step 1 stays judgement-free ([[arch-d5-s3-evidence-handoff-cleanup]]).
- Display-only by construction. The field colours/labels the note and never feeds a score, cap, verdict or gate. Verify this by inspection (which code reads the field), not only by a "cannot move the number" test — for P5 the only readers were parseNote (normalisation) and the render.

## Links
- [[arch-d6-phase2-report-experience-outcome]]
- [[arch-report-derivation-architecture]]
- [[arch-d5-s3-evidence-handoff-cleanup]]
