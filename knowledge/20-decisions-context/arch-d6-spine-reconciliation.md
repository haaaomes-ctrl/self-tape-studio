---
id: arch-d6-spine-reconciliation
title: Δ6 spine reconciliation change set — conformance vs additions vs corrections, routed to Δ11 and ARCH-DOC
tier: corpus
status: current
spine_anchor: ["AGENTS §Score terminology alignment", "README §Professional 0–100 level-relative score calibration", "README §Performer Level Calibration Architecture", "README §Level-specific flows"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "Operator routing instruction following Δ6 decision capture, 2026-06-07 (post PR #217)"
discipline: null
monday_ref: "2967682223"
tags: [arch-deltas, decisions, spine-reconciliation, routing, conformance, score-model, open-question]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Summary

Plan for reconciling the spine to the Δ6 score-model decisions
([[arch-d6-score-model-architecture]]), routed to **Δ11** (README/AGENTS edits) and **ARCH-DOC**
(ADRs). This note routes; it does **not** edit README/AGENTS/CLAUDE.md/roadmap/ADRs — "README
wins on conflict" holds, and spine edits happen deliberately under Δ11, not here.

**Key finding (the durable lesson): the spine was SUBSTANTIALLY CORRECT; the defect was code
drifting from it undetected** — the MAST "verification failure" pattern (spec right, conformance
never verified). Most of Δ6 is *conformance to existing doctrine*, not new doctrine. Implication:
the Δ6 build needs **conformance tests against the named spine clauses** (AGENTS
§Score terminology alignment, README §11.4, README §8.x flows), not only new-behaviour tests, so
the drift cannot silently recur.

## Context / why

The Δ6 investigation found the live system contradicting spine clauses that already existed:
rendered scores contradicting report language (forbidden by AGENTS §Score terminology
alignment), a superseded work item (S10-14, Professional 90–100 banding) that contradicted
README §11.4's explicit prohibition on a high-score-only subsystem, and an AI-emits-the-score
code path inverting the §8 architecture in which the score is the terminal, derived output. The
reconciliation work therefore splits four ways: where the spine is right, the code conforms;
where the spine is silent, Δ11 adds; where the spine is contradicted by an artefact reference,
Δ11 corrects; and the canonical-score architecture itself earns an ADR via ARCH-DOC.

## Detail

### Category 1 — Spine already correct; code must conform (NO spine edit; becomes Δ6 build acceptance criteria)

- **AGENTS §Score terminology alignment** already forbids showing a score that contradicts
  report language, and lists the exact contradictions found live (blocker-vs-submit,
  brief-complete with no brief). Δ6 is **conformance to an existing clause, not new doctrine**.
- **README §11.4 Professional 0–100 level-relative score calibration** already mandates
  stringent full-0–100 Professional scoring and explicitly forbids a high-score-only
  subsystem / bundling Professionals into the 90s ("Do not create a separate high-score-only
  calibration subsystem. Do not bundle Professional reports into a special scores-in-the-90s
  category." README:1840). **S10-14 contradicted this clause — vindicating its supersession**;
  no spine change needed there.
- **README §8 (Performer Level Calibration Architecture, §8.3 Level-specific flows)** already
  encodes the ordering standard-application → judgement → calibration → score: each level flow
  runs "level selected → AI applies standard → AI asks → readiness output", with the score as
  the terminal derived output. The code's AI-emits-score path inverts it. **Conformance.**

### Category 2 — Genuine spine ADDITIONS (route to Δ11)

- **Single-canonical-score / no-second-authority:** add an AGENTS clause — one canonical score;
  the AI marks dimensions but never emits/moves the number; all surfaces derive from it. The
  spine forbids *contradictions* but is **silent on the multi-authority architecture** — that
  silence is the gap the drift used.
- **Step-1 level-invariance as a stated invariant:** observations are facts; level changes only
  the marking. The spine says level is first-class and not tone, but does not state observation
  invariance — and the trace found level leaking into the Step 1 evidence-pass prompt
  (`process-take.server.ts:3688`).
- **MD-voice module:** separate, bounded, suppressible, subjective-framed, cannot move the
  score.
- **Rubric provenance model** (internal-only metadata), **corpus scope**, and the **method
  invariant** (rubric authored from codified expert criteria and ratified by expert
  discrimination — never learned from raw media).

### Category 3 — Spine CONTRADICTED, needs CORRECTION (route to Δ11; flag as correction, not addition)

- Roadmap/README references to "level-relative Professional score calibration" preserved as a
  deliverable (e.g. tapecoach-v3-roadmap "Ideas to preserve" list: "level-relative professional
  score calibration across the full 0–100 scale") were carried alongside the **S10-14 banding
  artefact**. The principle — stringent full-scale Professional calibration — **STAYS**; the
  90–100 banding artefact reference is removed/reconciled so the roadmap does not point at a
  superseded item as a deliverable.

### Category 4 — ADR (route to ARCH-DOC)

- The canonical-score architecture earns a new ADR; **ADR-0008 is the verified next free slot**
  (0001–0007 exist in `docs/architecture/adr/`) — **proposed, not assigned**; the ADR file is
  not created here.
- The **S10-03 reopening** (Monday 2952749999) and **S10-14 supersession** (Monday 2952750147)
  must be referenced in the ADR/consolidation doc so the Complete→reopened reversal has durable
  rationale.

### Routing instruction (Δ11 / ARCH-DOC)

Reconcile against the blessed decision record ([[arch-d6-score-model-architecture]]).
**Category 1 = conformance-only (no spine edit). Category 2 = additions. Category 3 =
corrections. Category 4 = new ADR + consolidation references. README-wins holds throughout.**

### Conformance-test requirement (from the key finding)

Because the failure mode was unverified conformance rather than wrong doctrine, the Δ6 build's
acceptance suite must include tests that assert the *named spine clauses* hold end-to-end:

- AGENTS §Score terminology alignment — no rendered score may contradict report language
  (blocker-vs-submit, brief-complete-with-no-brief, and the live-found variants).
- README §11.4 — full-0–100 Professional calibration; no high-score-only subsystem behaviour.
- README §8.x flows — the score is derived after standard-application and judgement, never
  emitted ahead of them.

### Provenance note (carry forward, do not re-assert)

Where this note touches "F-class drift" or the inversion conditions, those are the
**PENDING-verification findings** per [[arch-d6-score-model-architecture]] §Open questions
(F1–F9 / flattering-only theorem: stated in a parallel session, provenance unconfirmed, awaiting
from-source re-derivation). This reconciliation plan rests on the **grounded two-authority
finding and the existing spine clauses**, not on the unverified F1–F9 table.

## Open questions

- Δ11 execution: the Category 2 additions and Category 3 corrections as a reviewed spine PR
  (separate, deliberate; not part of this note's PR).
- ARCH-DOC execution: ADR-0008 write-up referencing the S10-03 reopening and S10-14
  supersession rationale.
- Conformance-test authoring: which existing pinned tests must be rewritten (they currently
  encode the defective behaviour) vs which new clause-conformance tests are added.

## Links

- [[arch-d6-score-model-architecture]] — the blessed Δ6 decision record this plan reconciles
  the spine against.
- [[arch-d3-rescope-division-of-authority]] — prior division-of-authority decision in the same
  lineage.
- Monday: Δ6 2967682223 · S10-03 2952749999 (reopened/blocked) · S10-14 2952750147
  (closed/superseded).
