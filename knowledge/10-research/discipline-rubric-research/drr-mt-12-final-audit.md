---
id: drr-mt-12-final-audit
title: Musical Theatre — Final Audit
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/1. MT/6.2 MT Final Audit.md"
discipline: mt
monday_ref: null
tags: [discipline-rubric-research, mt, stage-final-audit]
confidence: medium
created: 2026-05-04
imported: 2026-06-08
updated: 2026-06-08
---

# Musical Theatre — Final Audit

> **Imported research — Discipline Rubric Research programme.** Step 12 of 17 in the Musical Theatre thread (`stage-final-audit`). Original file: `1. MT/6.2 MT Final Audit.md`. Original date: 2026-05-04 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-mt-overview]].

---

MT-FINAL-AUDIT — Musical Theatre Revised Rubric Slice
Stage: Final audit Object audited: MT-REV — revised Run 0B §1 Musical Theatre rubric slice Baseline guardrails: Run 0E Output-specificity benchmark: Run 0D Audit control IDs: MT-A01–MT-A15 Result: Pass, with final implementation addendum applied below
This is a rubric-slice final audit, not a product/code audit. No backend files, prompts, schema, UI rendering, persistence, scoring code or report exports have been inspected or changed here. Runtime checks such as timestamp persistence, UI/PDF rendering and score repeatability remain implementation-test items.

⸻

1. Audit Readiness
Check
Result
Active audited object identified
Pass — Run 0B §1 Musical Theatre
Revised MT slice available
Pass — MT-REV exists
MT-AUDIT recommendation IDs available
Pass — MT-A01–MT-A15
Run 0E guardrail pack available
Pass
Run 0D specificity stress test available
Pass
Need to reopen research
No
Need to alter source evidence
No
Need to change schema/backend/scoring
No
Audit may proceed
Yes

⸻

2. Final Verdict
Overall result
Area
Result
MT-A01–MT-A15 implemented or correctly deferred
Pass
Run 0E baseline preserved
Pass
Run 0D specificity risks addressed
Pass with addendum
New score fields introduced
No
MT weights changed
No
Backend/schema/data-flow changes introduced
No
Unsupported subtype rules introduced
No
Anti-bias / fairness guardrails preserved
Yes
Final rubric-slice status
Approved for prompt/product implementation planning
The revised MT slice successfully improves discipline specificity while preserving the stable TapeCoach baseline. The final audit finds no blocker.
A small final addendum is required to make Run 0D output-specificity checks explicit before product implementation. That addendum is included in section 7 and should be attached to MT-REV.

⸻

3. MT-A01–MT-A15 Final Audit
Audit ID
Required outcome
MT-REV result
Final audit result
MT-A01
Preserve MT core structure: weights, visible acting/vocal categories, component breakdown, consistency_modifier
MT-REV explicitly preserves all of these
Pass
MT-A02
Make acting-through-song structurally required inside existing acting/vocal sections
MT-REV adds acting-through-song evidence requirements without a new field
Pass
MT-A03
Require lyric / phrase / beat evidence for song storytelling
MT-REV requires lyric-, phrase- or beat-level evidence for song storytelling claims
Pass
MT-A04
Distinguish vocal technique from communication/story/style
MT-REV separates technical vocal evidence from communication/story/style function inside the existing vocal field
Pass
MT-A05
Require visible movement evidence before movement/dance claims
MT-REV suppresses movement claims unless enough visible evidence exists
Pass
MT-A06
Require integration commentary where acting + song and/or movement coexist
MT-REV requires integration evidence through scene-to-song continuity, acting in song and movement-as-story
Pass
MT-A07
Capture subtype/style only where observable or task-known
MT-REV allows conditional style language and blocks guessing, fixed weights and subtype score fields
Pass with caution retained
MT-A08
Separate self-tape assessability from performance quality
MT-REV separates audio/technical/presentation assessability from artistic performance quality
Pass
MT-A09
Suppress direction-response unless observable
MT-REV permits direction-response only with alternate take, visible redirect, note application or workshop/recall evidence
Pass
MT-A10
Bound individuality/authenticity/readiness to observable choices
MT-REV excludes vague charm/presence and requires observable choice or preparation evidence
Pass
MT-A11
Keep training potential distinct from casting/market fit
MT-REV keeps role fit brief-bounded and blocks marketability, appearance and perfect-casting logic
Pass
MT-A12
Keep through-composed MT visible as an evidence gap
MT-REV explicitly marks through-composed / sung-through MT as unresolved
Pass / correctly deferred
MT-A13
Do not import exam-board percentages into scoring
MT-REV explicitly blocks exam-board percentage import and preserves MT weights
Pass / correctly deferred
MT-A14
Improve timestamp and fix-first coverage across acting, song and integration/style
MT-REV strengthens timestamp coverage; Run 0D addendum below makes 5–8-note expectation explicit
Pass with addendum
MT-A15
Exclude bias-sensitive and unsafe criteria
MT-REV excludes body/type/appearance, protected data, marketability, access needs, polish proxies and tape-only vocal-health diagnosis
Pass

⸻

4. Run 0E Non-Regression Audit
Run 0E guardrail
MT-REV status
Final result
Current audition types preserved
No enum change proposed
Pass
Six operational score fields preserved
Explicitly preserved
Pass
MT weights unchanged
Explicitly preserved
Pass
Server-side score recomputation unchanged
No change proposed
Pass
Level-aware verdict bands unchanged
No change proposed
Pass
Caps and blockers unchanged
No change proposed; addendum clarifies assessability language does not override caps
Pass
Role-fit modifier bounds preserved
No change proposed; role fit remains brief-bounded
Pass
Step 1 evidence pass preserved
No change proposed
Pass
Step 2 text-only polish preserved
No change proposed
Pass
Locked-field enforcement preserved
No change proposed
Pass
Safety/fairness guardrails preserved
Strengthened
Pass
Material-policy guardrails preserved
Strengthened by fixed-material caution
Pass
Presentation/accessibility scrub preserved
Strengthened
Pass
Feedback reliability language preserved
No change proposed; High / Medium / Low retained
Pass
UK terminology preserved
No incompatible terminology introduced
Pass
Maximum 3 strengths preserved
No change proposed
Pass
Maximum 3 improvements preserved
No change proposed
Pass
Maximum 8 timestamped notes preserved
Preserved; addendum clarifies target density within cap
Pass
Comparison page alignment preserved
No change proposed
Pass
Raw Step 1 evidence not publicly persisted
No change proposed
Pass
MT acting + song stabilised flow preserved
Explicitly preserved
Pass
Acting + song component detection preserved
Explicitly preserved
Pass
Component breakdown visibility preserved
Explicitly preserved
Pass
Acting and vocal category visibility preserved
Explicitly preserved
Pass
consistency_modifier retained
Explicitly preserved
Pass
Baseline and brief-mode MT functioning preserved
No change proposed
Pass
No Run 0E regression found.

⸻

5. Run 0D Output-Specificity Audit
Run 0D tests whether the revised slice would prevent plausible but copy-pasteable report language.
Run 0D risk
MT-REV handling
Final result
Generic casting headline
Broadly covered by generic-feedback suppression, but headline-specific evidence should be made explicit
Pass with addendum
Generic acting note: “connected”, “grounded”, “believable”
MT-REV requires objective, beat, thought shift, line/action, relationship target or sung-lyric action
Pass
Generic song note: “technically excellent and emotionally resonant”
MT-REV requires lyric/phrase/beat and vocal technique/story/style distinction
Pass
Vocal category too broad
MT-REV separates technical accomplishment from story/style function
Pass
Acting and song treated as silos
MT-REV requires integration commentary where components coexist
Pass
Movement praise too generic
MT-REV requires visible movement evidence and suppresses claims where not assessable
Pass
Timestamp count too low
MT-REV strengthens coverage; final addendum adds explicit 5–8-note target for assessable 3–5 minute MT/hybrid tapes
Pass with addendum
Timestamp imbalance
MT-REV requires acting, song and integration/style coverage where present
Pass
False duration/time-limit specificity
Run 0E and MT-REV block unsupported precise claims
Pass
False page/side/material specificity
Run 0E addendum blocks unsupported page/side/material claims
Pass
Overstated “perfect adherence”
MT-REV requires brief demands to be explicit and not invented
Pass
Alternative material suggestion risk
Run 0E/MT-REV guardrails preserve fixed-material fidelity
Pass
Recorded-take movement/prop advice risk
Final addendum requires rehearsal-only versus recorded-take distinction where relevant
Pass with addendum
Low-value presentation notes
MT-REV limits presentation notes to materially useful, observable assessability/professional evidence
Pass
Baseline no-brief MT misclassification
MT stabilised flow is preserved, but runtime detection still needs product testing
Pass at rubric level; implementation test required
UI/PDF timestamp rendering mismatch
Outside rubric scope; remains implementation test T18
Not auditable at rubric-slice level
Run 0D does not require reopening the MT revision. It requires an output-specificity addendum, applied below.

⸻

6. Final Evidence-to-Revision Traceability
Source/evidence finding
Audit ID
Revision change
Final audit result
MT must preserve acting/vocal centrality and multi-component logic — [MT-S004], [MT-S007], [MT-S045], [MT-S049], [MT-S013]
MT-A01
Current six-field MT structure, acting/vocal visibility, component breakdown and weights preserved
Pass
Acting-through-song must be evidenced — [MT-S004], [MT-S006], [MT-S077]
MT-A02
Acting-through-song evidence test added inside existing fields
Pass
Song storytelling needs lyric/phrase/beat evidence — [MT-S004], [MT-S006], [MT-S077]
MT-A03
Generic song storytelling praise suppressed unless evidence-anchored
Pass
Vocal technique and story/style function are distinct — [MT-S007], [MT-S072], [MT-S034]
MT-A04
Vocal comments must distinguish technical and communicative evidence
Pass
Movement evidence must be visible and story-linked — [MT-S019], [MT-S070], [MT-S051]
MT-A05
Movement/dance claims require visible assessable evidence
Pass
MT integration is core — [MT-S004], [MT-S009], [MT-S045], [MT-S049]
MT-A06
Integration comment required where components coexist and are assessable
Pass
Style/subtype can sharpen commentary but not weights — [MT-S072], [MT-S078], [MT-S074], [MT-S070]
MT-A07
Conditional style handling added; fixed subtype weights blocked
Pass
Self-tape fairness and assessability separation — [MT-S055], [MT-S056], [MT-S011]
MT-A08
Technical/audio/presentation reliability separated from talent judgement
Pass
Direction-response must be observable — [MT-S056], [MT-S058], [MT-S065], [MT-S070]
MT-A09
Direction-response suppressed unless actual adjustment evidence exists
Pass
Authenticity/readiness must be observable and safe — [MT-S057], [MT-S058], [MT-S064], [MT-S065]
MT-A10
Vague charm/presence/marketability language excluded
Pass
Training potential must not become perfect-casting logic — [MT-S046], [MT-S018], [MT-S054]
MT-A11
Role fit brief-bounded; marketability and appearance excluded
Pass
Through-composed MT unresolved — [MT-S066], [MT-S074], [MT-S079]
MT-A12
Through-composed retained as evidence gap
Pass / deferred
Exam-board percentages are comparators only — [MT-S007], [MT-S009]
MT-A13
No score-weight changes
Pass / deferred
MT timestamps must span components — [MT-S013], [MT-S045], [MT-S049], [MT-S011]
MT-A14
Timestamp coverage strengthened; 5–8-note target added below
Pass with addendum
Unsafe/bias-sensitive criteria must be excluded — [MT-S055], [MT-S056], [MT-S064], [MT-S072], 0E
MT-A15
Exclusions added across role fit, presentation, vocal and technical language
Pass
Traceability chain is intact:
Source ID → evidence finding → MT-Audit ID → MT-REV change → final audit result

⸻

7. Final Addendum to Attach to MT-REV
Attach the following block to the revised MT slice before product/prompt implementation.
MT final audit output-specificity addendum
The Musical Theatre report must satisfy the following output-specificity checks in addition to the revised rubric wording.
Headline / casting insight
The headline or casting insight must include at least one tape-specific differentiator, such as:
the material, role or component
a specific acting, song, movement or transition choice
the performer’s strongest observable differentiator
a style/subtype cue where known or clearly observable
Avoid broad headline language such as “technically strong and emotionally connected” unless it is immediately tied to this performer, this tape, this material and an observable moment.
Timestamp density
For an assessable 3–5 minute Musical Theatre or hybrid tape, the system should aim for 5–8 timestamped notes, while preserving the Run 0E maximum of 8.
Where acting and song are both present and assessable, timestamped notes should normally include:
at least one spoken acting moment
at least one song/vocal moment
at least one acting-through-song, integration, transition, movement or style-specific moment
at least one strength moment
at least one improvement or fix-first moment
Shorter tapes, blocked evidence, poor audio, poor visibility or genuinely low-evidence submissions may justify fewer notes, but the report should not under-produce timestamps on a clearly assessable multi-component tape.
Next-take plan: rehearsal versus recorded take
Where the next-take plan suggests physical action, props, movement, staging or framing, it must distinguish between:
rehearsal-only exercises, and
recorded-take changes that are safe and compatible with the brief.
Do not suggest walking, props, additional staging or frame-breaking movement where the brief requires fixed framing, head-and-shoulders framing, minimal movement or a simple self-tape setup.
Assessability and caps
Separating assessability from performance quality does not override existing TapeCoach caps, blockers or reliability logic.
If audio, visibility, framing, file handling or technical setup materially blocks assessment, the report may:
lower technical/audio/professional-standard scores where appropriate
reduce feedback reliability
trigger existing caps or blockers where applicable
But it must not describe access-adapted, low-budget or home-recorded conditions as weaker talent evidence unless the submitted performance is materially unassessable.
Professional presentation weighting clarity
professional_presentation remains part of the six operational score-field system and report logic. The MT final score formula remains unchanged:
acting 30%
vocal 30%
brief_adherence 15%
technical 15%
audio 10%
Do not introduce a new weighted professional-presentation component for Musical Theatre unless explicitly approved elsewhere.

⸻

8. Residual Defer List After Final Audit
These items remain deliberately unresolved and must not be treated as solved by the MT revision.
Deferred item
Final audit status
Through-composed / sung-through MT full rule set
Deferred
Fixed dance-led / voice-led / acting-led MT weighting
Deferred
New acting-through-song score field
Not approved
New MT dance/movement score field
Not approved
Vocal sub-scores or formal voice-style bands
Deferred to Voice/Singing branch
Deeper movement/dance calibration
Deferred to Dance branch
Exact import of exam-board percentages
Rejected / comparator only
Formal jukebox/pop-rock/contemporary descriptor bands
Deferred / report language only
Backend/schema/report JSON changes
Not approved
Component-detection architecture changes
Not approved
Product implementation validation
Pending if product files are changed

⸻

9. Product-Level Test Mapping
The rubric-slice final audit passes, but the following Run 0D tests remain essential once the wording is implemented in product prompts or code.
Test ID
Product-level purpose
Current MT final audit status
T01
MT brief: acting + song, both components shown, timestamps span both
Required implementation test
T02
MT baseline: no brief, acting + song still detected, no invented brief
Required implementation test
T03
Song-only: no acting-scene leakage
Required implementation test
T08
Hybrid: component split and timestamp spread
Required implementation test
T10
Fixed material: no alternative-material substitution advice
Required implementation test
T12
Fixed framing: no brief-incompatible movement/props
Required implementation test
T14
Poor audio: assessability separated from performance quality
Required implementation test
T16
Repeat same video: score/verdict stability
Required implementation test
T17
Comparison page alignment
Required implementation test
T18
Timestamp persistence/render/export alignment
Required implementation test
These are not blockers to the rubric-slice final audit. They become mandatory once the MT revision is implemented in product prompts, report generation, UI or export logic.

⸻

10. Final MT Branch Status
Workflow stage
Status
MT research
Complete
MT synthesis
Complete
MT gap audit
Complete
MT revision
Complete
MT final audit
Complete
Run 0E reconciliation
Complete
Run 0D output-specificity mapping
Complete
Product/code implementation
Not yet executed in this branch
Product-level non-regression tests
Pending after implementation
Final audit outcome
The Musical Theatre rubric branch is complete at rubric-slice level.
Final status:
Pass — approved for controlled implementation planning, with the section 7 output-specificity addendum attached.

---

## Links

- **Previous:** [[drr-mt-11-audit-revision]] — Audit Revision
- **Next:** [[drr-mt-13-v5-output-spec-patch]] — V5 Output-Spec Patch
- **Thread overview:** [[drr-mt-overview]]
- **Programme:** [[drr-programme-overview]]
