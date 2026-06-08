---
id: drr-mt-16-lessons
title: Musical Theatre — Lessons Learned
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/1. MT/MT-Lessons.md"
discipline: mt
monday_ref: null
tags: [discipline-rubric-research, mt, stage-lessons]
confidence: medium
created: 2026-05-06
imported: 2026-06-08
updated: 2026-06-08
---

# Musical Theatre — Lessons Learned

> **Imported research — Discipline Rubric Research programme.** Step 16 of 17 in the Musical Theatre thread (`stage-lessons`). Original file: `1. MT/MT-Lessons.md`. Original date: 2026-05-06 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-mt-overview]].

---

Yes. The MT gap audit surfaced several additional lessons beyond the synthesis-stage lessons. These should be integrated before the next discipline series, especially before any future final audit / revision cycle.
Additional lessons learned from MT-AUDIT
Lesson
Why it matters
Improvement to carry forward
Audit-stage aliasing is still necessary
MT-SYN used some legacy IDs, but MT-AUDIT resolved them into repaired IDs such as [MT-S013], [MT-S018], [MT-S019].
Do not assume synthesis aliasing is final. Every audit should re-run a compact alias check and preserve both IDs where needed.
Coverage counts can shift after alias normalisation
MT-SYN estimated about 75 source groups; MT-AUDIT counted 79 after normalising active synthesis/audit sources.
Future prompts should require the model to explain the counting method and flag whether totals are approximate or normalised.
The audit should identify the rubric object before doing anything else
The 0B / 0C / 0E ambiguity nearly caused the wrong rubric slice to be audited.
Make “rubric version under audit” a mandatory readiness-check row.
Recommendation IDs are essential for downstream revision
MT-A01 to MT-A15 now give a stable bridge from audit to revision.
All audits should create stable recommendation IDs that are reused in revision and final audit.
Baseline compatibility should be checked recommendation-by-recommendation
MT-AUDIT avoided new fields, weights, and schema changes because each recommendation was tested against 0E.
Require a Baseline Compatibility Check table in every audit.
Evidence-to-rubric traceability matrix is highly valuable
It made clear which source findings justified each audit recommendation.
Require this matrix before the final handoff in every audit.
“Already covered well” protects against over-revision
MT had important stabilised strengths that should be preserved, not rewritten.
Require an “Already Covered Well / Preserve” section before gaps.
“Areas not to change yet” is not optional
MT had several tempting but unsupported changes: through-composed rules, fixed subtype weights, new score fields.
Every audit should include a formal defer list.
Implementation caution should sit inside the recommendations table
The MT table worked because it said “no new score field,” “suppress conditionally,” “defer to Dance research,” etc.
Add “implementation caution” as a standard recommendation-table column.
Final handoff should be revision-ready, not just descriptive
The MT handoff clearly separated preserve, improve, suppress, remove, and defer.
Future audit handoffs should be structured for direct use in the revision prompt.
High-priority recommendations should not rely on weak evidence alone
MT avoided using [MT-S046] as a sole high-priority anchor because it was medium confidence.
Add a rule that high-priority recommendations need either high-confidence evidence or multiple converging sources.
Generic-feedback risks are reusable but discipline-specific
“Strong voice” mattered in MT; another discipline may have equivalents like “good physicality,” “emotional truth,” or “camera presence.”
Future prompts should require discipline-specific generic-risk examples, not just a fixed generic list.
Suppress conditionally is a distinct audit outcome
Direction-response was valid only where observable.
Keep “suppress conditionally” as a baseline-impact option in every recommendations table.
Final audit should verify implementation, not reopen research
Once the revision happens, the final audit should check whether allowed changes were implemented and whether forbidden changes were avoided.
Add a final-audit prompt that maps revision changes back to recommendation IDs and baseline constraints.

Add this to the next discipline audit prompts
AUDIT-STAGE LESSONS-LEARNED ADDENDUM

Before auditing, perform an audit-specific input and alias check even if the synthesis already did one.

Required audit readiness checks:
- discipline synthesis handoff present: yes/no
- rubric slice under audit present: yes/no
- baseline / guardrail pack present: yes/no
- optional prior or later rubric versions present: yes/no
- exact rubric version under audit
- whether optional versions are context only
- whether audit may proceed
- any input ambiguity
- any source ID alias issues
- any evidence gaps that constrain the audit
- whether any high-priority recommendation would depend on unclear or weak evidence

SOURCE ALIAS AND COUNTING RULE

If the synthesis used legacy IDs but repaired IDs are available in the pasted material, create an audit-stage Source ID Alias Map.

Rules:
1. Treat matching source names and raw URLs as one source group.
2. Prefer repaired global IDs where available.
3. Preserve legacy IDs in the notes column.
4. Do not double-count legacy and repaired versions of the same source.
5. State whether the source-group count is exact, normalised, or approximate.
6. Do not make high-priority recommendations from a source whose provenance or identity is unclear.

RECOMMENDATION TRACEABILITY RULE

Every audit recommendation must have:
- stable recommendation ID
- rubric area
- current risk
- specific recommended change
- observable evidence the assessor must cite
- subtype/style affected, if relevant
- source basis from the synthesis handoff
- evidence strength
- baseline impact: preserve / improve / replace / remove / suppress conditionally / defer
- priority
- implementation caution

High-priority recommendations must be supported by:
- at least one high-confidence source, or
- multiple converging medium-confidence sources, and
- no unresolved provenance issue.

BASELINE COMPATIBILITY RULE

After the recommendations table, produce a Baseline Compatibility Check.

For each recommendation, state:
- baseline constraint affected
- compatible: yes/no
- reason
- required handling
- priority

If a recommendation would require backend, schema, pipeline, database, data-flow, scoring-field, or fixed-weight changes not explicitly authorised, mark it:
“defer” or “preserve baseline — revise only if compatible.”

EVIDENCE-TO-RUBRIC TRACEABILITY MATRIX

Before the final handoff, include a matrix:

- synthesis evidence finding
- Source ID(s)
- rubric area affected
- audit implication
- recommendation ID(s)
- confidence

This prevents recommendations from becoming detached from the evidence base.

DO-NOT-CHANGE SECTION

Include a section called:
“Areas Not to Change Yet Because Evidence Is Insufficient”

Use this for:
- unresolved subtype/style areas
- fixed weighting claims not supported by evidence
- discipline-specific details deferred to later research
- practitioner opinion that is too subjective
- pedagogy/context sources that do not support formal scoring
- any proposed change that would break baseline constraints

FINAL AUDIT HANDOFF REQUIREMENT

The final audit handoff must be revision-ready.

It must clearly separate:
- preserve
- improve
- suppress conditionally
- remove
- defer
- evidence gaps
- anti-bias exclusions
- non-regression constraints
- recommendation IDs to carry into revision

Do not rewrite the rubric.
Do not create final wording.
Do not implement changes.

Add this to the next discipline revision prompts
REVISION TRACEABILITY ADDENDUM

Use the audit recommendation IDs as the control system.

Before revising:
1. List all audit recommendation IDs.
2. Classify each as:
   - implement
   - preserve only
   - suppress conditionally
   - remove
   - defer
   - not implemented because baseline-incompatible
3. Do not implement any recommendation marked defer.
4. Do not implement any recommendation that requires unauthorised schema, backend, scoring-field, weighting, pipeline, database, or data-flow changes.
5. Do not implement any recommendation based only on weak, unclear, or unresolved evidence.

For every implemented change, provide:
- recommendation ID
- rubric area changed
- what changed
- source basis
- baseline compatibility
- why it does not regress stabilised behaviour

For every recommendation not implemented, provide:
- recommendation ID
- reason not implemented
- whether it remains a future research gap, baseline constraint, or final-audit watch item

Revision must preserve:
- stabilised rubric structure
- protected weights unless explicitly authorised
- existing working behaviours
- component detection logic
- timestamp constraints
- safety and anti-bias guardrails
- separation of assessability from performance quality

Revision must not:
- rewrite beyond the audited slice
- invent unsupported subtype criteria
- import exact external weighting systems
- create new score fields unless explicitly authorised
- turn practitioner taste into scoring
- penalise access needs or resource limitations

Add this to the final audit prompt after each discipline revision
FINAL AUDIT / NON-REGRESSION CHECK

This is a final audit step, not a research, synthesis, or rewrite step.

Use only:
1. The discipline audit handoff
2. The revised discipline rubric slice
3. The original rubric slice under audit
4. The baseline / guardrail pack
5. Optional prior versions only for regression context

Task:
Verify that the revision implemented the approved audit recommendations without regression.

Required output:

1. Input check
   - audit handoff present
   - original rubric slice present
   - revised rubric slice present
   - baseline guardrail pack present
   - optional versions present
   - exact revised version being audited

2. Recommendation implementation matrix
   - recommendation ID
   - audit recommendation summary
   - implemented: yes / partial / no / over-implemented
   - evidence in revised rubric
   - baseline-compatible: yes/no
   - issue if any

3. Non-regression check
   - preserved stabilised behaviours
   - any broken baseline constraints
   - any unauthorised score-field, weighting, schema, backend, pipeline, database, or data-flow changes
   - any missing preserve items

4. Overreach check
   - unsupported criteria introduced
   - fixed weighting changes introduced without evidence
   - practitioner taste converted into scoring
   - pedagogy/context treated as formal scoring
   - access or technical limitations penalised incorrectly

5. Generic-feedback check
   Apply the benchmark:
   “Could this feedback only have been written about this specific tape, performer, material, style/subtype, and observable evidence?”

6. Remaining issues
   - must fix before finalising
   - acceptable limitations
   - deferred evidence gaps

7. Final decision
   - pass
   - pass with minor issues
   - revision required
   - blocked by regression

Do not rewrite the rubric unless explicitly requested.
Do not create new recommendations unless needed to identify a regression or unresolved implementation issue.

Most important improvement to carry forward
For the next disciplines, the sequence should now be:
Research → Synthesis → Gap Audit → Revision → Final Audit
Each step should preserve this chain:
Source ID → evidence finding → audit recommendation ID → revision change → final audit check
That traceability chain is the main improvement from the MT process. It prevents three common failures: using the wrong rubric version, making unsupported changes, and losing evidence provenance during revision.

---

## Links

- **Previous:** [[drr-mt-15-v5-maturity-audit]] — V5 Maturity Audit
- **Next:** [[drr-mt-17-final-handoff]] — Final Handoff
- **Thread overview:** [[drr-mt-overview]]
- **Programme:** [[drr-programme-overview]]
