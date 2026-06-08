---
id: drr-mt-11-audit-revision
title: Musical Theatre — Audit Revision
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/1. MT/6.1 Audit revision.md"
discipline: mt
monday_ref: null
tags: [discipline-rubric-research, mt, stage-revision]
confidence: medium
created: 2026-05-04
imported: 2026-06-08
updated: 2026-06-08
---

# Musical Theatre — Audit Revision

> **Imported research — Discipline Rubric Research programme.** Step 11 of 17 in the Musical Theatre thread (`stage-revision`). Original file: `1. MT/6.1 Audit revision.md`. Original date: 2026-05-04 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-mt-overview]].

---

MT-REV — Revised Run 0B Musical Theatre Rubric Slice
Status: MT revision executed from Run 0B §1 using MT-A01–MT-A15. Final implementation / non-regression audit: not yet run.
1. Revision Scope Lock
Item
Locked position
Active rubric object
Run 0B §1 — Musical Theatre rubric slice
Guardrail baseline
Run 0E compact handoff
Audit control IDs
MT-A01–MT-A15
Revision scope
Musical Theatre slice only
Score fields
Preserve technical, audio, vocal, acting, brief_adherence, professional_presentation
MT weights
Preserve acting 30%, vocal 30%, brief 15%, technical 15%, audio 10%
Product behaviour
Preserve acting + song detection, component breakdown, acting/vocal visibility, consistency_modifier, timestamp spread
Pipeline
Preserve Step 1 evidence pass, Step 2 text-only polish, deterministic post-processing, server-side recomputation
Structural changes
None
Backend/schema/data-flow changes
None
New score fields
None
Subtype weightings
None
This revision improves evidence requirements and report-language specificity inside the existing MT structure. It does not revise the whole system and does not change scoring architecture.

⸻

2. Recommendation-by-Recommendation Revision Control Table
Audit ID
Action
Revision handling
Baseline compatibility
Source basis
MT-A01
Preserve
Explicitly locks current MT weights, six fields, acting/vocal visibility, component breakdown and consistency_modifier
Compatible; direct baseline preservation
[MT-S004], [MT-S007], [MT-S045], [MT-S049], 0E
MT-A02
Improve
Makes acting-through-song a required evidence test inside existing acting/vocal/component commentary
Compatible; no new field
[MT-S004], [MT-S006], [MT-S077]
MT-A03
Improve
Requires lyric / phrase / beat evidence for song storytelling praise or criticism
Compatible; evidence-language change only
[MT-S004], [MT-S006], [MT-S077]
MT-A04
Improve
Requires vocal comments to distinguish technique from communication/story/style where observable
Compatible; no vocal sub-score
[MT-S007], [MT-S072], [MT-S034]
MT-A05
Improve
Requires visible movement evidence before movement/dance claims
Compatible; no MT dance score field
[MT-S019], [MT-S070], [MT-S051]
MT-A06
Improve
Requires at least one integration comment where acting + song and/or movement coexist
Compatible; report/evidence requirement only
[MT-S004], [MT-S009], [MT-S045], [MT-S049]
MT-A07
Improve with caution
Allows subtype/style language only when observable or task-known; no guessing or weighting
Compatible; conditional report calibration only
[MT-S072], [MT-S078], [MT-S074], [MT-S070]
MT-A08
Improve
Separates assessability/reliability from performance quality
Compatible; reinforces fairness guardrails
[MT-S055], [MT-S056], [MT-S011]
MT-A09
Suppress conditionally
Direction-response may be discussed only when actual adjustment/redirection is visible
Compatible; prevents invented evidence
[MT-S056], [MT-S058], [MT-S065], [MT-S070]
MT-A10
Improve
Bounds individuality, authenticity and readiness to observable choices/preparation
Compatible; keeps taste out of scoring
[MT-S057], [MT-S058], [MT-S064], [MT-S065]
MT-A11
Suppress conditionally
Keeps role fit brief-bounded; separates training potential from casting/market fit
Compatible; preserves role-fit bounds
[MT-S046], [MT-S018], [MT-S054]
MT-A12
Defer
Keeps through-composed MT visible as an unresolved evidence gap
Compatible; avoids invented subtype rules
[MT-S066], [MT-S074], [MT-S079]
MT-A13
Defer
Prevents direct import of exam-board percentages into MT scoring
Compatible; protects weights
[MT-S007], [MT-S009]
MT-A14
Improve
Strengthens timestamp/fix-first coverage across acting, song and integration/style where present
Compatible; stays within existing timestamp/report structure
[MT-S013], [MT-S045], [MT-S049], [MT-S011]
MT-A15
Remove / exclude
Excludes body/type/appearance, protected identity data, marketability, polish proxies, access needs and tape-only vocal-health diagnosis from scoring
Compatible; reinforces safety/fairness
[MT-S055], [MT-S056], [MT-S064], [MT-S072], 0E

⸻

3. Revised Run 0B §1 — Musical Theatre Rubric Slice
1. Musical Theatre rubric slice — revised
Relevant scoring categories: acting, vocal, audio, technical, brief_adherence, professional_presentation.
Musical Theatre continues to use the existing six-category scoring system. Acting and vocal remain the two central score areas. The current Musical Theatre weights are unchanged:
Category
Weight
acting
30%
vocal
30%
brief_adherence
15%
technical
15%
audio
10%
No separate score field may be added for acting-through-song, integration, dance, movement, style, subtype, training potential or professional readiness without separate approval.

⸻

Core Musical Theatre discipline logic
Musical Theatre assessment depends on multi-component performance evidence, usually an acting scene plus song. The existing component detection, component breakdown and consistency_modifier remain central and must not be weakened.
Where the tape contains both acting and song, the report should distinguish:
spoken scene work
sung performance
acting-through-song
transition or continuity between scene and song
any visible movement/dance evidence where present and assessable
any style/subtype evidence that is task-known or clearly observable
Musical Theatre must not be treated as generic acting plus generic singing. The assessment should look for how acting, singing and movement combine to carry story, character, relationship, lyric intention and style.

⸻

Acting evidence requirements
Acting feedback should cover observable performance choices such as:
objective or action
relationship target
listening or response
thought shift
beat change
subtext
stakes
stillness or focus
eyeline or camera/reader relationship
scene-to-song continuity
acting choices inside sung material
Spoken acting notes should be tied to a specific line, beat, reaction, transition or moment of decision. Avoid generic comments such as “strong acting”, “more confidence” or “good presence” unless the report names the behaviour that created that effect.
Where no brief exists, the report must not invent role expectations or production-world requirements.

⸻

Acting-through-song evidence requirements
Acting-through-song is now a required Musical Theatre evidence test inside the existing acting, vocal and component commentary.
When praising or criticising a song performance, the report must cite at least one observable song-specific acting detail where available, such as:
lyric beat
phrase change
objective or action carried through the lyric
imagined relationship or addressee
focus shift
breath or dynamic choice with dramatic function
body/facial expression supporting the lyric
continuity or drop between spoken scene and sung material
Generic “good storytelling” is insufficient unless anchored to lyric-, phrase- or beat-level evidence.
Acceptable wording pattern:
“In the song, the storytelling became clearer at the phrase where the performer redirected the lyric towards the imagined partner, using a quieter attack and steadier eyeline to show the objective changing.”
Unacceptable wording pattern:
“The song had good storytelling.”
If lyric / phrase / beat evidence is not available or the song component is too technically unclear to assess, the report should avoid broad claims about song storytelling and instead state the evidence limitation.

⸻

Vocal evidence requirements
The vocal category remains a single score field, but MT vocal feedback must distinguish, where observable, between:
technical accomplishment Examples: breath use, diction, register choice, line, resonance, placement, tone, support, range handling, rhythmic accuracy, pitch security.
communication / story / style function Examples: lyric clarity, phrase intention, style/era awareness, character-driven sound, dynamic shape, textual emphasis, whether vocal choices served the dramatic moment.
The report should not use “strong voice” as a standalone conclusion. It should name the technical and/or communicative evidence that made the singing effective or limited.
Acceptable evidence includes:
register event
diction choice
phrase shape
breath or sustain moment
style or era cue
text clarity
vocal colour serving character or lyric
contrast between technical security and storytelling impact
Do not diagnose vocal health from tape. Do not make medical, fach or long-term sustainability claims. Limit vocal comments to observable sound, use and performance function.

⸻

Song storytelling and lyric specificity
Whenever song storytelling is praised or criticised, the report must cite the actual moment that supports the claim. Evidence may include:
a lyric phrase
a musical phrase
a breath or pause before a line
a shift in dynamic, tempo, focus or physicality
a change in relationship target
a contrast between verse/chorus, section A/B, or spoken/sung material
a moment where vocal technique either supported or obscured the lyric
The report should make clear whether the issue is primarily:
vocal technique
lyric understanding
acting-through-song
style fit
transition/continuity
audio/technical assessability
This prevents song feedback from collapsing into vague praise or a purely vocal-technical judgement.

⸻

Movement and dance evidence requirements
Movement and dance comments are permitted only where the tape shows enough visible, assessable movement evidence.
Movement feedback should cite observable details such as:
full-body visibility
rhythm or musicality
posture or alignment as readable on tape
transition quality
physical attack or release
risk-taking where visible
choreography uptake where visible
character or story carried through movement
movement vocabulary where the style is clear or briefed
Do not use generic phrases such as “nice movement” or “good energy” without naming the visible movement moment and its function.
If the tape does not show enough of the body, space or choreography to judge movement fairly, the report should suppress dance-specific claims and may instead note the assessability limitation. This must not penalise disability, mobility aids, seated adaptation, access needs or reduced range of motion. Only assess what is visible and relevant to the submitted task.
No MT dance score field is added. Deeper movement calibration remains deferred to the Dance branch.

⸻

Integration and component breakdown requirements
The component breakdown must not read as separate acting and singing reports pasted together.
Where acting and song are both present, the report should include at least one explicit integration comment, grounded in observable evidence such as:
scene-to-song transition
continuity of character from spoken text into song
acting intention maintained through vocal demands
lyric/story supported by movement
contrast between spoken acting and sung acting
consistency or inconsistency across components
whether the performer’s strongest component supported or disrupted the whole MT presentation
The consistency_modifier remains protected. It should continue to help capture whether the acting, vocal and component-level evidence align or diverge across the tape.

⸻

Timestamp and fix-first requirements
Timestamped notes should cover both acting and song where possible. Within the existing timestamp limit, MT timestamping should aim to include:
one spoken acting moment, if present
one song/vocal moment, if present
one acting-through-song, integration, transition, movement or style-specific moment, if present and assessable
If one component is absent, too short, technically blocked or not assessable, the report should not invent coverage. It should state the limitation in reliability, technical, audio or component language as appropriate.
Fix-first and next-take notes must be evidence-led and component-specific. They should identify the highest-impact observable adjustment, such as:
clarifying the objective in a spoken beat
anchoring a lyric phrase to a clearer addressee
improving diction on a story-critical phrase
stabilising the scene-to-song transition
making movement more readable in frame
separating technical singing work from lyric/story work
improving accompaniment balance where audio blocks judgement
Generic fix-first advice such as “bring more energy”, “connect more” or “be more confident” should be avoided unless translated into a specific action tied to the submitted material.

⸻

Style and subtype handling
MT subtype or style may shape feedback emphasis only when it is:
stated in the brief
obvious from the material
visible/audible in the tape
necessary to explain the performance evidence
Supported conditional style language may include:
Golden Age
contemporary MT
legit
mix
belt
pop-rock
jukebox
dance-led MT
voice-led MT
acting-led MT
integrated MT
Style/subtype evidence should be used to sharpen commentary, not to create new score fields or fixed weights.
Examples of evidence-based subtype handling:
Subtype/style
Permitted evidence focus
Golden Age
phrase line, diction, period-aware sound, style-appropriate vocal/acting choices
Contemporary MT
speech-inflected phrasing, register shifts, mix/belt/chest where observable, text-forward delivery
Jukebox
non-imitation, lyric ownership, style authenticity, transformation of a known song into character action
Dance-led MT
full-body readability, rhythm, choreographic intention, story carried through movement
Voice-led MT
register choice, style-through-ages, line, diction, tonal colour, vocal storytelling
Acting-led MT
objective through lyric, relationship target, speech-to-song continuity, phrase-level acting
Do not guess a subtype from limited evidence. Do not create fixed weighting changes for dance-led, voice-led or acting-led MT. Do not import exam-board percentages into TapeCoach scoring.

⸻

Through-composed / sung-through MT
Through-composed Musical Theatre remains an unresolved evidence gap.
The report may make cautious, evidence-based observations about:
continuity of intention
sustained character
transition continuity
stamina as observable in the submitted passage
whether the performer drops or maintains dramatic focus across extended sung material
The report must not imply that TapeCoach has a complete through-composed MT rule set. Do not create through-composed-specific weights, score fields or formal descriptors until further evidence is available.

⸻

Brief adherence, role fit and training-potential boundaries
Brief adherence should assess whether the performer followed the stated task, material requirements and submission instructions. It must not invent missing brief demands.
Role fit should appear only where a brief exists and must remain bounded to:
material
style
task context
stated role/world requirements
observable performance evidence
Role fit must not become a proxy for:
body/type/appearance
protected characteristics
nationality, passport or identity data
marketability
commercial suitability
class-coded presentation
social-media behaviour
“perfect casting” logic
Training potential may be mentioned only where it is tied to observable evidence such as:
trainable technical strengths
readiness markers
responsiveness if visible
ownership of material
prepared handling of the task
strengths-led performance choices
Training potential must remain separate from market fit or appearance-based casting assumptions.

⸻

Direction-response
Direction-response should be suppressed unless there is observable evidence of it.
Permitted evidence includes:
an alternate take showing adjustment
a visible response to a live redirect
documented note application within the submitted material
workshop/recall footage where note-taking and adjustment are part of the task
Do not infer direction-response from a single finished self-tape.

⸻

Self-tape assessability, technical and audio handling
Technical, audio and presentation notes must separate assessability from performance quality.
The report may comment on:
audibility
accompaniment balance
camera stability
framing
full-body visibility where movement/dance is relevant
lighting only where it affects readability
file/order clarity
whether the submitted evidence is sufficient to judge fairly
The report must not reward expensive production value, studio polish or coaching polish as talent. Low-budget, home-recorded or access-adapted tapes should not be penalised unless the issue materially blocks assessment.
If audio, camera, framing or accompaniment makes a component hard to assess, the report should identify the reliability limitation rather than lowering artistic judgements by implication.

⸻

Professional presentation
Professional presentation should be reported only where materially useful and observable.
Permitted professional-readiness evidence includes:
clear task following
prepared cuts
file/order discipline
slate clarity where required
accompanist or backing-track readiness where observable
appropriate response to known submission instructions
interview or person-to-camera evidence where part of the task
Do not use professional presentation to score:
home environment
clothing cost
accent, class markers or polish
social-media behaviour
appearance
charm
marketability
production budget
access needs

⸻

Generic-feedback suppression rules
The following phrases should not appear as unsupported conclusions in MT reports. If used at all, they must be replaced or immediately anchored to observable evidence.
Generic phrase
Required replacement evidence
“Great stage presence”
exact focus, stillness, entrance, physical choice, lyric moment or relationship target
“Strong voice”
register, diction, phrase, tone, style cue, breath/line and story function
“Good storytelling”
lyric beat, phrase action, objective, focus shift, scene-to-song continuity
“Nice movement”
visible full-body moment, rhythm, posture, transition, character-through-movement evidence
“Authentic performance”
non-imitation, material ownership, distinct choice, own vocal/textual imprint
“Professional tape”
audibility, framing, accompaniment balance, file/order clarity, assessability
“Good energy”
tempo, attack, breath impulse, choreographic intention, scene-to-song lift
“Good connection”
relationship target, eyeline, lyric addressee, listening or response moment
“Clear potential”
specific trainable strength, readiness marker or strengths-led task handling
“Commercially suitable”
suppress unless brief-bounded; replace with material/style/context fit
“Polished performance”
observable preparation, secure cuts, clarity under self-tape conditions
Benchmark test:
Could this feedback only have been written about this specific performer, this tape, this material, this style/subtype and this observable evidence?
If not, the comment is too generic for MT.

⸻

Known gaps / uncertainties retained
The following remain unresolved or deliberately deferred:
acting-through-song is now formalised as an evidence requirement, but not as a new score field
Golden Age, contemporary, legit, mix, belt, jukebox, dance-led, voice-led and acting-led MT are handled conditionally through evidence language, not fixed scoring rules
through-composed MT remains only partly supported and must stay visible as an evidence gap
deeper style-specific vocal calibration is deferred to Voice/Singing research
deeper movement/dance calibration is deferred to Dance research
exact exam-board percentages must not be imported into TapeCoach weights
no backend, schema, report JSON, enum, data-flow or component-detection architecture changes are made

⸻

4. Evidence-to-Rubric Traceability Matrix
Evidence finding
Source ID(s)
Audit ID(s)
Revised rubric location
Change type
Final audit check
MT must preserve acting/vocal centrality and multi-component logic
[MT-S004], [MT-S007], [MT-S045], [MT-S049], [MT-S013]
MT-A01
Core scoring categories; Core discipline logic
Preserve
Confirm weights, fields and component behaviour unchanged
Acting-through-song must be evidenced, not implied
[MT-S004], [MT-S006], [MT-S077]
MT-A02
Acting-through-song evidence requirements
Improve
Confirm song judgements require lyric/phrase/beat evidence
Song storytelling must cite lyric/phrase/beat evidence
[MT-S004], [MT-S006], [MT-S077]
MT-A03
Song storytelling and lyric specificity
Improve
Confirm generic “good storytelling” is suppressed
Vocal technique and communication/story/style must be distinguished
[MT-S007], [MT-S072], [MT-S034]
MT-A04
Vocal evidence requirements
Improve
Confirm no new vocal sub-score added
Movement/dance claims need visible evidence
[MT-S019], [MT-S070], [MT-S051]
MT-A05
Movement and dance evidence requirements
Improve
Confirm movement claims are suppressed if not assessable
MT integration must be explicit where components coexist
[MT-S004], [MT-S009], [MT-S045], [MT-S049]
MT-A06
Integration and component breakdown requirements
Improve
Confirm at least one integration comment is required where present
Subtype/style should sharpen feedback only where observable
[MT-S072], [MT-S078], [MT-S074], [MT-S070]
MT-A07
Style and subtype handling
Improve with caution
Confirm no guessing, no subtype fields, no fixed subtype weights
Assessability must be separated from performance quality
[MT-S055], [MT-S056], [MT-S011]
MT-A08
Self-tape assessability, technical and audio handling
Improve
Confirm low-budget/access-adapted setups are not penalised as talent
Direction-response must not be inferred from a single take
[MT-S056], [MT-S058], [MT-S065], [MT-S070]
MT-A09
Direction-response
Suppress conditionally
Confirm direction-response appears only when observable
Authenticity/readiness must be observable, not taste-based
[MT-S057], [MT-S058], [MT-S064], [MT-S065]
MT-A10
Professional presentation; Generic-feedback suppression
Improve
Confirm charm/presence/marketability language is excluded
Training potential must stay separate from casting suitability
[MT-S046], [MT-S018], [MT-S054]
MT-A11
Brief adherence, role fit and training-potential boundaries
Suppress conditionally
Confirm role fit is brief-bounded and not appearance/market based
Through-composed MT remains unresolved
[MT-S066], [MT-S074], [MT-S079]
MT-A12
Through-composed / sung-through MT
Defer
Confirm no full subtype rule set is implied
Exam-board percentages are comparators only
[MT-S007], [MT-S009]
MT-A13
Known gaps / uncertainties retained
Defer
Confirm MT weights are unchanged
MT timestamps should cover acting, song and integration/style where possible
[MT-S013], [MT-S045], [MT-S049], [MT-S011]
MT-A14
Timestamp and fix-first requirements
Improve
Confirm timestamp spread is strengthened without schema changes
Bias-sensitive and unsafe criteria must be excluded
[MT-S055], [MT-S056], [MT-S064], [MT-S072], 0E
MT-A15
Exclusions across role fit, presentation, technical/audio and vocal health
Remove / exclude
Confirm excluded criteria cannot drive scoring

⸻

5. Explicit Defer List
These items must remain deferred after the MT revision:
Deferred area
Reason
Handling
Through-composed MT rule set
Evidence remains partial
Keep visible as gap; allow cautious continuity observations only
Dance-led / voice-led / acting-led fixed weighting
Evidence supports emphasis shifts, not numeric weight changes
Use feedback emphasis only
New acting-through-song score field
Baseline forbids new fields; evidence can be handled inside acting/vocal/component language
Do not add
MT dance score field
Baseline does not support it
Defer movement calibration to Dance branch
Vocal sub-scores
Baseline does not support splitting the vocal field
Defer deeper vocal calibration to Voice/Singing branch
Exact exam-board percentages
Not transferable into TapeCoach scoring
Comparator only
Formal jukebox / pop-rock / contemporary descriptor bands
Evidence is useful but not robust enough for formal scoring bands
Use only where observable
Backend/schema/report JSON/data-flow changes
Outside scope and baseline-protected
Do not change
New audition type enum or component architecture
Outside scope
Do not change
Tape-only vocal-health diagnosis
Not supported and unsafe
Exclude
Marketability / perfect-casting logic
Bias and role-fit risk
Suppress unless brief-bounded material/style context

⸻

6. Final Audit Readiness Checklist
This revision is ready for a final implementation / non-regression audit against the following checks.
Final audit check
Required result
Revised object is Run 0B §1 Musical Theatre only
Yes
MT-A01–MT-A15 each resolved or explicitly deferred
Yes
Existing six score fields preserved
Yes
MT weights unchanged
Yes
Acting and vocal remain visible
Yes
Component breakdown preserved
Yes
consistency_modifier preserved
Yes
Acting + song detection protected
Yes
Timestamp spread across components preserved or strengthened
Yes
No new acting-through-song field
Yes
No new dance/movement/style/subtype score field
Yes
No backend/schema/report JSON/data-flow changes
Yes
Step 1 evidence / Step 2 polish separation preserved
Yes
Step 2 still cannot invent evidence
Yes
Acting-through-song evidence now required
Yes
Lyric / phrase / beat-level evidence now required for song storytelling
Yes
Vocal technique separated from communication/story/style in wording
Yes
Movement claims require visible assessable evidence
Yes
Integration comment required where components coexist
Yes
Style/subtype handling conditional and evidence-based
Yes
Through-composed MT kept as unresolved evidence gap
Yes
Self-tape assessability separated from performance quality
Yes
Access-adapted or low-budget tapes not penalised as talent evidence
Yes
Direction-response suppressed unless observable
Yes
Role fit brief-bounded
Yes
Training potential separated from casting/market fit
Yes
Body/type/appearance and protected characteristics excluded
Yes
Tape-only vocal-health diagnosis excluded
Yes
Generic MT feedback risks actively suppressed
Yes

⸻

Final Handoff State
The Musical Theatre revision is now complete at rubric-slice level.
The next step is Final Audit, with a narrow remit:
verify the revised MT slice implements MT-A01–MT-A15
verify no regression against Run 0E guardrails
verify no accidental schema, scoring, pipeline or product-behaviour change
verify the revised wording does not reopen research or add unsupported subtype rules

---

## Links

- **Previous:** [[drr-mt-10-gap-audit]] — Rubric Gap Audit
- **Next:** [[drr-mt-12-final-audit]] — Final Audit
- **Thread overview:** [[drr-mt-overview]]
- **Programme:** [[drr-programme-overview]]
