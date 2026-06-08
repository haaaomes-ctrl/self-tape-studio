---
id: drr-dance-11-lessons
title: Dance — Lessons Learned
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/2.Dance/D-Lessons Learned.md"
discipline: dance
monday_ref: null
tags: [discipline-rubric-research, dance, stage-lessons]
confidence: medium
created: 2026-05-04
imported: 2026-06-08
updated: 2026-06-08
---

# Dance — Lessons Learned

> **Imported research — Discipline Rubric Research programme.** Step 11 of 13 in the Dance thread (`stage-lessons`). Original file: `2.Dance/D-Lessons Learned.md`. Original date: 2026-05-04 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-dance-overview]].

---

# Lessons Learned from the Dance Branch for Rubric Development

## Core conclusion

The strongest lesson from the Dance branch is that rubric improvement did not come mainly from inventing new scoring theory. It came from making an existing shared system more truthful about what it is already doing, more precise about what it can and cannot judge, and more disciplined about how that judgement appears in user-facing output. The baseline-control pack shows that TapeCoach currently runs on a stable shared architecture: fixed operational score fields, a shared report schema, server-side recomputation, and a two-step evidence-plus-polish pipeline. It also shows that discipline specificity is still expressed mostly through inferred type, weighting, prompt prose and category-note wording rather than through formal subtype rubrics. In that environment, label semantics, evidence anchors, claim-scope rules and renderer behaviour are not cosmetic details; they are part of the rubric itself. fileciteturn0file0 fileciteturn0file3 fileciteturn0file2

The Dance branch therefore matters beyond Dance. It proves that the right question for a new discipline is not “Can we redesign the rubric from scratch?” but “What specificity, restraint and testability can we add inside the current architecture without destabilising the strongest existing flows?” That is exactly the question the control sheet and baseline audit say the product needs to answer: improve discipline-specific specificity while preserving shared-system stability, evidence-led reporting and non-regression of the protected Musical Theatre flow. fileciteturn0file2 fileciteturn0file0

## What the Dance branch demonstrated

The first important result is that architecture-aware revision works. The baseline audit and reconciliation pack both confirm that the operational six-field system is real, stable and shared, and that `vocal` is explicitly overloaded across singing, speech delivery and dance technique. They also confirm that Dance had the weakest credibility because it lacked a true movement rubric and depended on proxy mapping. The Dance branch improved that situation not by changing fields, but by tightening semantics, guardrails, evidence requirements and output rules around those fields. That is a major process gain: wording-and-guardrail revision can deliver meaningful rubric development when the architecture is fixed. fileciteturn0file3 fileciteturn0file0

The second result is that a protected regression anchor is essential. The baseline materials repeatedly identify Musical Theatre acting-plus-song as the strongest stabilised flow and specify that it must not regress. That constraint was not an obstacle; it was a design aid. It forced Dance work to become more disciplined, because every proposed improvement had to prove that it would not damage multi-component handling, acting/vocal visibility, timestamp spread or MT weighting stability. This is a portable lesson: every discipline cycle should begin by naming the load-bearing flow that must survive change intact. fileciteturn0file0 fileciteturn0file3

The third result is that output specificity is the real acceptance standard. The stress test shows that many system weaknesses did not appear as outright scoring failure. They appeared as plausible-but-transferable language, under-anchored casting headlines, generic category notes, over-broad technical comments, thin timestamp coverage and false specificity around brief compliance. In other words, the system could sound competent while still failing the goal of being evidence-led and tape-specific. The Dance branch only became operationally solid once revision outputs were translated into concrete output-specificity rules and preserved test scenarios. That is a fundamental lesson for rubric development: a rubric is not complete when wording is improved; it is complete when the wording has been converted into observable output behaviour and regression tests. fileciteturn0file1 fileciteturn0file2

## What still slowed or weakened the cycle

The biggest drag on confidence was not source quality but display-layer uncertainty. The baseline audit and reconciliation pack both flag that type-aware labels are not fully confirmed, comparison-page label logic is uncertain, and timestamp rendering may be losing information somewhere between evidence generation, validation, persistence and output. The stress test reinforces that uncertainty by noting that UI timestamp mapping appears structurally capable of rendering the array, while real outputs still showed under-production or under-display. This means that, late in the cycle, the team still had to reason about wording without being able to fully verify live display behaviour. That should not become normal. Renderer and label-helper verification need to enter the process earlier. fileciteturn0file3 fileciteturn0file0 fileciteturn0file1

A second efficiency loss came from prompt-only logic that was not clearly separated from deterministic logic. The reconciliation pack is explicit that some important behaviour, including parts of brief-adherence weighting and score anchoring, remains prompt-led rather than deterministically recomposed. It also notes that there are no formal score anchor tables in code and that subtype handling is underdeveloped across disciplines. That does not make the current product unusable, but it does make auditability harder. The lesson is not that prompt-led logic is unacceptable; it is that every discipline cycle should identify prompt-dependent logic up front and carry it as a named auditability risk instead of discovering it halfway through the branch. fileciteturn0file3

A third weakness was the absence of live Dance outputs in the final stages. The supplied Dance output-specificity handover correctly carried this forward as a limitation rather than pretending the renderer had been verified. That honesty is a strength. But as a process lesson, it means the next discipline should not rely on synthetic/adversarial QA alone if live renderer verification is realistically obtainable. Synthetic mapping is strong for logic; it is weaker for confirming real label behaviour, comparison-page parity and timestamp rendering. The baseline pack itself already warned that those were open uncertainties. fileciteturn0file0 fileciteturn0file1

## Lessons to institutionalise for future rubric work

The most useful carry-forward lessons are best treated as permanent operating rules rather than Dance-only observations.

| Portable lesson | Why the Dance branch proved it | Carry-forward rule |
|---|---|---|
| Start from baseline reality, not design memory | The reconciliation stage showed that remembered rubric intent and actual implementation were not identical, especially around field overload, prompt-led logic and shared report structure | Begin every new discipline with a reconciliation pass before deep research expands |
| Name a protected anchor before changing anything | Musical Theatre stability made Dance revision safer and more disciplined | Require one explicit non-regression anchor for every discipline |
| Audit field semantics before rubric wording | The overloaded `vocal` field became a core rubric problem, not just a naming problem | Add a mandatory field-semantics and label-risk scan at the start of every branch |
| Treat assessability as a first-order rubric domain | The stress test showed technical/audio comments become generic unless tied to what the tape actually allows the system to judge | Every discipline must define its own assessability preconditions early |
| Separate positive criteria from blocked claims | Dance improved most when it defined not just what to praise, but what must not be inferred from tape | Every discipline needs an explicit “must not claim” set |
| Make accessibility explicit, not ambient | General fairness principles existed already, but Dance needed explicit anti-inference and adaptation-without-deficit wording | Every discipline should include an accessibility-safe interpretation layer in revision |
| Convert revision into behaviour, not prose alone | Dance only became QA-ready once the wording package became an output-specificity and test map | Do not treat revision as complete until it produces concrete output rules and test cases |
| Distinguish renderer verification from rubric logic | Label-helper, comparison-page and timestamp-rendering risks persisted despite strong wording | Require a display-layer verification checklist for every discipline |
| Keep a standing limitation spine | Dance moved forward faster once unresolved issues were carried openly instead of being re-litigated at every stage | Maintain one discipline limitation ledger from first extraction batch to output QA |
| Keep source types distinct | The Dance synthesis only became reliable when admissions, formal descriptors, employer context and fairness/self-tape evidence were not collapsed into one standard | Require source-type separation in research, synthesis and audit |

These lessons follow directly from the documented shared architecture, the lack of formal subtype rubrics, the overloaded score-field semantics, the genericity risks in current outputs, and the unresolved renderer/display uncertainties captured in the baseline-control pack. fileciteturn0file0 fileciteturn0file1 fileciteturn0file3

## Process changes to adopt before the next discipline

The next discipline should not simply reuse the Dance workflow mechanically. It should reuse the successful parts and harden the weak parts.

| Workflow stage | Change to make mandatory | Why it should now be mandatory | Minimum artefact required |
|---|---|---|---|
| Preflight | Baseline-control packet plus reconciliation note | Prevents research from drifting away from actual implementation | Baseline slice, guardrails, control sheet, reconcile note, current output examples if available |
| Research | Source-family plan before batch extraction | Keeps formal descriptors, employer sources, accessibility sources and comparators distinct from the start | Source-family ledger and batch scope rules |
| Synthesis | Descriptor dictionary plus claim-scope table | Forces the branch to define both what can be named and what must remain cautious | Recurring domains, style-specific domains, live-room-only boundaries |
| Audit | Display-layer uncertainty register | Stops UI/renderer risks from remaining invisible until the end | Label risk register, comparison-page risk register, timestamp-render uncertainty note |
| Revision | Dual output: wording package plus QA hooks | Makes revision immediately auditable and testable | Clean revised baseline plus section/change register |
| Final audit | Explicit limitation set and release decision | Prevents soft approval and keeps open issues visible | Accepted changes, accepted-with-limitation changes, residual risk register |
| Output specificity | Adversarial scenario pack and live-output checklist | Converts rubric development into behaviour that can be tested | Scenario pack, rule map, renderer checklist, preserved test clusters |
| Release readiness | Live-output spot audit where possible | Ensures the branch is not only logically strong but actually rendered correctly | Real report examples, comparison-page examples, export examples |

This process adjustment is justified by the documented current-state weaknesses: discipline specificity is underdeveloped, fixed fields carry different meanings by type, type-aware labels are not fully confirmed, timestamps are under-produced or under-verified, and shared report sections can sound specific without being sufficiently grounded. fileciteturn0file0 fileciteturn0file1 fileciteturn0file3

A particularly important addition for the next discipline is an explicit **field-overload review**. Dance showed that a branch can spend large amounts of effort cleaning symptoms that originate in one overloaded stored field. The next discipline should therefore begin with a short but formal answer to three questions: which stored fields are being repurposed, which user-facing labels those fields may trigger, and which of those semantics are architecture-fixed versus wording-fixable. That one move will make later audit and revision work faster and cleaner. fileciteturn0file0 fileciteturn0file3

## What this means for rubric development itself

The Dance branch sharpened the product’s real rubric philosophy. The control sheet says the rubric should be brief-aware, audition-type-aware, level-aware, evidence-led, timestamp-grounded, practical and safe from protected-trait judgement. Dance showed what that means in operational terms. It means a rubric is not just a list of scoring areas. It is a combination of five things: what the system is allowed to judge, what evidence it needs before making that judgement, how user-facing labels describe the underlying score semantics, what claims must stay low-confidence or live-room-only, and what language must be blocked to prevent genericity or bias. fileciteturn0file2 fileciteturn0file0

That has two practical implications for future rubric development. First, each discipline should be expected to produce its own **descriptor dictionary** and its own **forbidden-claim map**, even if the stored score fields remain shared. Second, each discipline should be expected to end with an **output-behaviour standard**, not just a revised text pack. In other words, the real rubric is now the combination of baseline wording, evidence rules, display semantics and regression tests. The Dance branch made that visible. The next discipline should start there rather than discover it half-way through. The stress test strongly supports this conclusion because it shows that many failures came from the mismatch between plausible prose and missing evidence anchors, not from obviously broken scoring. fileciteturn0file1 fileciteturn0file3

Another deeper lesson is that architecture constraints should not automatically be framed as blockers. In Dance, the fixed schema was a real limitation, but it also created a useful discipline: it forced the team to distinguish between wording fixes, evidence-boundary fixes, display-risk checks and true architecture backlog. That separation is healthy. The next discipline should preserve it by maintaining three parallel lists from the start: **revisable in wording**, **test-only / verification dependent**, and **architecture-shaped residual risks**. That would have shortened the Dance branch further. fileciteturn0file0 fileciteturn0file3

## Readiness gates before the next discipline begins

The next discipline should begin only if the following gates are met.

| Readiness gate | Pass condition | Failure signal |
|---|---|---|
| Baseline reality gate | Baseline slice, guardrails, reconcile note and control sheet are present | Research begins from memory rather than implementation |
| Protected anchor gate | One preserved non-regression flow is named explicitly | Revision work has no stable reference point |
| Field semantics gate | Any overloaded stored fields and label risks are enumerated | Label problems surface only during audit |
| Source-family gate | Planned source families are distinct before extraction begins | Synthesis collapses different source types into one “standard” |
| Evidence-anchor gate | The discipline has a draft evidence-anchor dictionary by synthesis stage | Audit and revision stay too generic |
| Display verification gate | Real output examples are supplied before or during final stages where possible | Final audit cannot confirm labels, comparison naming or rendered note behaviour |
| Limitation spine gate | Open risks are carried forward in one explicit ledger | The same unresolved issue gets rediscovered at each stage |
| Completion gate | “Done” means output-specificity and non-regression mapping, not just revision text | The branch ends with strong prose but weak QA readiness |

These gates are not arbitrary. They answer the exact weaknesses documented in the baseline pack: overloaded categories, discipline leakage, lack of subtype anchors, generic shared sections, timestamp underproduction, uncertain label helpers and the need to preserve the MT anchor while improving other disciplines. fileciteturn0file0 fileciteturn0file1 fileciteturn0file2 fileciteturn0file3

The final lesson is the simplest one. The objective is not to make each discipline branch longer or more elaborate. The objective is to make each branch more **auditable**, more **specific**, and more **product-safe**. The Dance branch improved the rubric because it moved from research to synthesis, from synthesis to bounded audit, from audit to traceable revision, and from revision to output behaviour that can actually be tested. That should now be the default standard before the next discipline starts.

---

## Links

- **Previous:** [[drr-dance-10-output-spec]] — Output Spec
- **Next:** [[drr-dance-12-pre-prod-qa]] — Pre-Production QA
- **Thread overview:** [[drr-dance-overview]]
- **Programme:** [[drr-programme-overview]]
