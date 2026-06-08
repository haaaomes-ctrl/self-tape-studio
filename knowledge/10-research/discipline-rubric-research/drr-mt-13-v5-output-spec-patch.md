---
id: drr-mt-13-v5-output-spec-patch
title: Musical Theatre — V5 Output-Spec Patch
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/1. MT/MT-V5-OUTPUT-SPEC-PATCH.MD"
discipline: mt
monday_ref: null
tags: [discipline-rubric-research, mt, stage-output-spec]
confidence: medium
created: 2026-05-06
imported: 2026-06-08
updated: 2026-06-08
---

# Musical Theatre — V5 Output-Spec Patch

> **Imported research — Discipline Rubric Research programme.** Step 13 of 17 in the Musical Theatre thread (`stage-output-spec`). Original file: `1. MT/MT-V5-OUTPUT-SPEC-PATCH.MD`. Original date: 2026-05-06 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-mt-overview]].

---

MT-V5-OUTPUT-SPEC-PATCH — Musical Theatre Output-Specificity Patch
1. MT Output-Specificity Patch Readiness Check
Check
Result
Notes
MT-V5 maturity handoff present
Yes
Supplies maturity decision, issue IDs and patch-action IDs.
MT-REV revised rubric slice present
Yes
Supplies revised MT slice and MT-A01–MT-A15 traceability.
MT-FINAL-AUDIT addendum present
Yes
Supplies output-specificity addendum, residual defer list and product-level tests.
TapeCoach baseline / guardrail context present
Yes
Supplies Run 0E preserve / improve / do-not-touch constraints.
Current MT live-output examples present
Partial
PDF/report examples are supplied and usable as risk evidence, but no full raw JSON, comparison-page package, renderer/export parity evidence or score recomputation trace is supplied.
Exact patch object identified
Yes
Standalone MT output-specificity and non-regression patch.
MT output-specificity patch may proceed
Yes
This patch may proceed as output-rule and QA-requirement work, not as live-output sign-off.
Caveats
Yes
The supplied PDF examples show generic MT language, under-produced timestamps, brief/no-brief contradiction, callback/castability overclaim, “perfect/flawless” adherence risks and alternative-material leakage. They do not prove full live behaviour across JSON, comparison, export or renderer surfaces.
Patch may proceed.

2. Patch Scope Lock
Item
Locked position
Reason
Can change in this patch?
MT weights
Preserve acting 30%, vocal 30%, brief_adherence 15%, technical 15%, audio 10%
Protected MT anchor and Run 0E guardrail
No
Six score fields
Preserve technical, audio, vocal, acting, brief_adherence, professional_presentation
Shared production architecture
No
Audition type enum
Preserve current types
No enum change authorised
No
Acting visibility
Visible where spoken acting exists
Protected MT anchor
No
Vocal visibility
Visible where singing exists
Protected MT anchor
No
Component breakdown
Preserve acting + song component visibility
Stabilised MT flow
No
consistency_modifier
Preserve if currently used
Stabilised MT flow
No
Timestamp cap
Maximum 8 notes
Run 0E cap
No
Strengths/improvements caps
Maximum 3 each
Run 0E cap
No
Caps/blockers/verdict thresholds
Preserve
Server-side scoring authority and guardrail
No
Role-fit bounds
Preserve -10 to +5, brief mode only, zero in baseline
Run 0E role-fit guardrail
No
Step 1 / Step 2 split
Preserve evidence pass and text-only polish pass
Protected workflow
No
Report JSON structure
Preserve
Do-not-touch list
No
Comparison page / renderer / export behaviour
No mechanism changes; only QA requirements
Patch can define checks, not implementation
No
Output wording rules
Strengthen specificity and suppression rules
Patch purpose
Yes
Live-output QA requirements
Define required checks and artefacts
Patch purpose
Yes

3. MT-V5 Issue-to-Patch Mapping
MT-V5 issue ID
Issue summary
Related maturity patch action ID(s)
Output-specificity rule ID(s)
Prohibited pattern ID(s)
Regression test ID(s)
Live-output QA requirement ID(s)
Priority
MT-V5-I01
Acting-through-song output specificity incomplete
MT-V5-P01, P03
MT-V5-OSR01, OSR04, OSR07
MT-V5-OSP09, OSP11
MT-V5-OST07, OST08, OST09
MT-V5-LQA02, LQA07, LQA12
P0
MT-V5-I03
Vocal feedback remains technique-heavy / generic
MT-V5-P03
MT-V5-OSR02, OSR07
MT-V5-OSP04, OSP05, OSP12, OSP18, OSP19, OSP20
MT-V5-OST08, OST13
MT-V5-LQA07, LQA12
P0
MT-V5-I06
Fixed-material / alternative-repertoire boundary leak
MT-V5-P06
MT-V5-OSR08, OSR11
MT-V5-OSP30
MT-V5-OST05, OST15
MT-V5-LQA16, LQA21
P0
MT-V5-I07
Brief/no-brief contradiction and false specificity
MT-V5-P05
MT-V5-OSR10, OSR16
MT-V5-OSP26, OSP27, OSP28, OSP29
MT-V5-OST02, OST19, OST20
MT-V5-LQA15, LQA20
P0
MT-V5-I09
Verdict/readiness consistency risk
MT-V5-P02
MT-V5-OSR16
MT-V5-OSP23, OSP24, OSP25, OSP29
MT-V5-OST20, OST21
MT-V5-LQA13, LQA14
P0
MT-V5-I11
Timestamp density and component coverage underproduced
MT-V5-P04
MT-V5-OSR05, OSR07
MT-V5-OSP01–OSP22 where unsupported
MT-V5-OST10, OST11, OST12, OST25
MT-V5-LQA11, LQA12, LQA22
P0
MT-V5-I13
Callback / recall / workshop overclaim risk
MT-V5-P07
MT-V5-OSR12
MT-V5-OSP21, OSP22, OSP23, OSP24, OSP35
MT-V5-OST23
MT-V5-LQA18, LQA19
P0
MT-V5-I14/I15
Display, comparison and export parity not fully auditable
MT-V5-P09
MT-V5-OSR14, OSR15
MT-V5-OSP31–OSP34 where display-related
MT-V5-OST26, OST27
MT-V5-LQA01–LQA24
P1

4. Standalone MT Output-Specificity Rules
Rule ID
Rule title
Applies to report section(s)
Required behaviour
Required observable evidence
Must suppress / avoid
Related MT-V5 issue ID(s)
Related source / audit basis
Priority
MT-V5-OSR01
Acting-through-song evidence
component_breakdown, acting, vocal, strengths, improvements, timestamps, next-take plan
Song judgement must include acting-through-song evidence when story/connection/interpretation is claimed
Lyric, phrase, beat, objective, addressee, focus, breath/dynamic with dramatic function, body/facial evidence
“Good storytelling”, “emotionally connected” or “acting-through-song” without evidence
I01
MT-A02, MT-A03; [MT-S004], [MT-S006], [MT-S077]
P0
MT-V5-OSR02
Vocal technique versus story/style
Vocal category, song note, strengths, improvements
Separate technique from communication/story/style where either is claimed
Register, diction, pitch, breath, line, tone, style cue and how it serves lyric/story
Technique-only praise as complete song assessment
I03
MT-A04; [MT-S007], [MT-S072], [MT-S034]
P0
MT-V5-OSR03
Movement/dance evidence
component_breakdown, acting, technical, timestamps, next-take
Movement comments only where movement is visible and assessable
Full-body or task-sufficient visibility, rhythm, transition, posture, character through movement
“Nice movement” or “good energy” without visible evidence
I11
MT-A05; [MT-S019], [MT-S070], [MT-S051]
P0
MT-V5-OSR04
Scene-to-song integration
casting insight, component_breakdown, acting, vocal, timestamps, next-take
When acting + song both exist and are assessable, require an integration observation
Scene-to-song transition, continuity/drop of character, acting surviving vocal demands
Acting and song as isolated silos
I01, I11
MT-A06; [MT-S004], [MT-S009], [MT-S045], [MT-S049]
P0
MT-V5-OSR05
Timestamp density and distribution
timestamped_notes
Clearly assessable 3–5 minute MT/hybrid tapes should aim for 5–8 notes within cap
Acting moment, song moment, integration/style/fix-first moment where available
Under-producing notes on assessable multi-component tapes; padding invented notes
I11
MT-A14; final audit addendum
P0
MT-V5-OSR06
Headline / casting insight specificity
casting_headline, casting_insight
Must include a tape-specific differentiator
Material/component, performer choice, style cue, transition, lyric or beat
Transferable generic headline
I01, I03, I07
Final audit addendum; Run 0D risk
P0
MT-V5-OSR07
Strengths / improvements / fix-first specificity
strengths, improvements, fix_first
Each item must anchor to one performer choice or concrete issue
Timestamp/moment, component, lyric/line/phrase, technical/audio fact
Generic advice such as “connect more”, “bring more energy”
I01, I03, I11
MT-A03, MT-A14
P0
MT-V5-OSR08
Next-take plan boundary
next_take_plan, coaching_drills
Distinguish rehearsal-only from recorded-take changes when movement, props, frame or staging are involved
Submitted frame/brief constraints; explicit rehearsal exercise marker
Recorded-take advice that breaks fixed framing or task
I06
MT-A08, MT-A14; final audit addendum
P0
MT-V5-OSR09
Self-tape assessability
technical, audio, presentation_notes, feedback reliability
Separate assessability from performance quality
Audibility, framing, visibility, accompaniment balance, file/order clarity
Treating low-budget setup as talent weakness
I11
MT-A08; [MT-S055], [MT-S056], [MT-S011]
P0
MT-V5-OSR10
Brief / no-brief consistency
brief_adherence, technical signals, risk flags, headline, role_fit
Mode must be internally consistent; no no-brief invention
Explicit brief signal and supplied requirements
Brief-driven claims when technical signals say no brief; invented brief facts
I07
Run 0E; MT-V5 maturity issue
P0
MT-V5-OSR11
Fixed material versus choice material
improvements, next_take_plan, brief_adherence
Alternative-material advice is blocked in fixed/submitted-material improvement context
Explicit choice-material status or repertoire-development context
Suggesting a different song/repertoire when the task is to improve submitted tape
I06
MT-A11; Run 0E fixed-material guardrail
P0
MT-V5-OSR12
Role-fit / callback / workshop claim scope
casting insight, role_fit_notes, strengths, verdict/risk text
Callback, recall, workshop, training-potential and role-fit claims must be scope-bounded
Explicit brief/training context or observable submitted-tape evidence
“Recall-worthy”, “highly castable”, workshop readiness from one finished tape
I13
MT-A09, MT-A10, MT-A11
P0
MT-V5-OSR13
Accessibility / anti-polish boundary
technical, presentation, professional_presentation, reliability
Access and resource context must be non-deficit; polish cannot be performance evidence
Assessability-only details; explicit adaptation context
Penalising disability, adaptation, low-budget setup, accent, speech difference
I11, I14/I15
MT-A15; Run 0E safety/access guardrails
P0
MT-V5-OSR14
Display-label protection
rendered report, comparison page, PDF/export
Vocal label visible where singing exists; Acting label visible where spoken acting exists
Rendered labels and component detection
Hiding Vocal in singing MT; hiding Acting in spoken MT
I14/I15
Run 0E MT stabilisation
P0
MT-V5-OSR15
Comparison/export parity verification
JSON, rendered report, comparison page, PDF/export
Labels, scores, components and timestamps must match across surfaces
Raw JSON, rendered report, export, comparison artefacts
Mismatched timestamp count, labels, score or category meanings
I14/I15
Final audit product tests T17/T18
P1
MT-V5-OSR16
Verdict/readiness consistency
verdict, overall, risk flags, “Why this isn’t ready”, caps
Readiness language must align with verdict and cap/blocker outcome
Final score, verdict label, risk flags, cap evidence
“Strong for this level” plus “Why this isn’t ready” contradiction unless explained as non-blocking risk
I09
Run 0E verdict/cap guardrails
P0
MT-V5-OSR17
Style/subtype conditionality
headline, vocal, acting, component, timestamps
Style/subtype may sharpen feedback only when supplied or clearly observable
Known material/style cue, audible/visible style evidence
Guessing subtype; fixed subtype weights; through-composed overclaim
I01, I03
MT-A07, MT-A12; [MT-S072], [MT-S078], [MT-S074]
P1

5. Prohibited MT Output Patterns
Prohibited pattern ID
Pattern / phrase / behaviour
Why unsafe or too generic
Allowed replacement behaviour
Required evidence anchor
Related issue ID(s)
Priority
MT-V5-OSP01
“emotionally connected”
Transferable and taste-based unless anchored
Name the lyric, beat, relationship or vocal/physical choice that made emotion legible
Lyric/phrase/beat/addressee
I01, I03
P0
MT-V5-OSP02
“grounded acting”
Acting generic; can appear in any discipline
Name the behaviour: stillness, reaction, thought shift, eyeline, objective
Line/beat/response
I01
P0
MT-V5-OSP03
“strong acting”
Non-specific and untraceable
Name what was strong and where
Moment + acting choice
I01
P0
MT-V5-OSP04
“strong vocal control”
Technique-only without story/style
Link control to phrase, diction, register or lyric function
Phrase/register/style cue
I03
P0
MT-V5-OSP05
“technically excellent”
Overbroad and often unsupported
Specify exact technical domain
Pitch/diction/breath/register/audio/framing
I03
P0
MT-V5-OSP06
“smooth transition”
Does not say what transitioned or why
Identify scene-to-song continuity or character thought
Transition moment
I01, I11
P0
MT-V5-OSP07
“captures warmth”
Character-trait abstraction without action
Name delivery choice or reaction that expressed warmth
Line/response/eyeline
I01
P0
MT-V5-OSP08
“captures wit”
Abstract and brief-dependent
Name comic timing, rhythm, pause or emphasis
Specific line/beat
I01
P0
MT-V5-OSP09
“strong storytelling”
Generic MT praise
Tie to lyric beat, objective, relationship or phrase shape
Lyric/phrase/action
I01
P0
MT-V5-OSP10
“clear character”
Broad and often role-inventing
Name objective, thought shift, relationship or behaviour
Character evidence moment
I01, I07
P0
MT-V5-OSP11
“good acting-through-song”
Says the criterion but not evidence
Cite how acting operated through lyric/music
Lyric + dramatic function
I01
P0
MT-V5-OSP12
“good vocal performance”
Too broad
Identify technique and/or communication evidence
Register/diction/phrase/style
I03
P0
MT-V5-OSP13
“confident performance”
Can reward charm/presence
Name secure task handling or observable clarity
Behavioural evidence
I01, I13
P1
MT-V5-OSP14
“professional tape”
Can reward polish/resources
Limit to assessability and explicit brief compliance
Audio/framing/file/order
I11
P0
MT-V5-OSP15
“strong presence”
Vague charisma risk
Replace with focus, stillness, camera/reader/lyric relationship
Behavioural moment
I13
P0
MT-V5-OSP16
“good energy”
Empty and transferable
Name musical drive, attack, tempo or movement purpose
Phrase/movement/tempo
I01, I11
P1
MT-V5-OSP17
“good breath control”
Technique-only unless contextualised
Say how breath shaped phrase/text or where it was observable
Breath/phrase evidence
I03
P1
MT-V5-OSP18
“secure pitch”
Useful but incomplete as MT judgement
Pair with style/story/lyric impact if making performance claim
Pitch + lyric/style moment
I03
P1
MT-V5-OSP19
“lovely tone”
Taste-coded and broad
Specify tone colour and its function
Style/lyric/character cue
I03
P1
MT-V5-OSP20
“good movement”
Generic movement praise
Name visible movement, transition, rhythm, posture or story use
Visible movement moment
I11
P0
MT-V5-OSP21
“good musicality”
Overbroad
Specify rhythm, phrasing, timing or dynamic shape
Musical moment
I03
P1
MT-V5-OSP22
“recall-worthy”
Live/casting outcome overclaim
Replace with present-tape readiness evidence only
Observable tape strength
I13
P0
MT-V5-OSP23
“strong callback potential”
Outcome speculation
Limit to submitted-tape evidence and avoid callback claim
Evidence-bound strength
I13
P0
MT-V5-OSP24
“highly castable”
Marketability / appearance risk
Use brief-bounded material/style fit only
Supplied brief + performance evidence
I13
P0
MT-V5-OSP25
“perfect submission”
Overstates certainty and can contradict risk flags
State which supplied requirements were met
Explicit checked requirements
I07, I09
P0
MT-V5-OSP26
“flawless adherence”
Overconfident and brittle
Use evidence-based compliance only
Supplied brief items
I07, I09
P0
MT-V5-OSP27
“all instructions were met”
Unsafe unless every instruction is verified
Specify verified instructions only
Brief evidence
I07
P0
MT-V5-OSP28
Unsupported exact duration/time-limit claim
False specificity risk
Only state if brief time limit and measured duration are both locked
Brief time limit + locked duration
I07
P0
MT-V5-OSP29
Unsupported page/side/material claim
False specificity risk
Only state if brief/material explicitly supplies it
Supplied material reference
I07
P0
MT-V5-OSP30
Alternative-repertoire suggestion in fixed-material context
Misaligns with submitted-tape improvement task
Use performance adjustment to submitted material
Fixed-material/choice-material status
I06
P0
MT-V5-OSP31
Production-polish praise
Resource/class proxy
Limit to assessability, not merit
Readability evidence
I11
P0
MT-V5-OSP32
Marketability / bookability / appearance / look / type language
Bias-sensitive and not skill evidence
Block; use material/style/task fit only if brief-supported
Brief + observable behaviour
I13
P0
MT-V5-OSP33
Paid coaching / accompanist / reader as merit
Resource-access proxy
Treat only as process/access context
None for talent scoring
I11
P0
MT-V5-OSP34
Disability/access/adaptation as weakness
Anti-deficit breach
Treat as neutral context unless assessability is blocked
Access/assessability boundary
I11
P0
MT-V5-OSP35
Workshop / direction-response inferred from single take
Not tape-observable
Suppress unless actual redirection footage exists
Alternate take / shown note
I13
P0

6. Allowed MT Evidence Anchors
Evidence anchor ID
Evidence type
What it can support
What it cannot support
Example of acceptable evidence shape, without final report wording
Related rule ID(s)
MT-V5-OSA01
Exact lyric or phrase
Acting-through-song, lyric intention, vocal story function
Whole-song success without other evidence
Identified lyric phrase + observed change in focus/dynamic/objective
OSR01, OSR02
MT-V5-OSA02
Beat change
Acting, integration, scene-to-song continuity
Full character arc unless enough tape supports it
A clear thought shift before or during a line/song section
OSR01, OSR04
MT-V5-OSA03
Objective / action
Acting, lyric action, scene note
Training potential unless explicit context supports it
Observable action pursued in a line or lyric
OSR01, OSR07
MT-V5-OSA04
Imagined addressee / relationship target
Acting-through-song, “connection” claims
Actual reader/cast chemistry beyond visible tape
Lyric directed towards a defined imagined person or off-camera reader
OSR01
MT-V5-OSA05
Focus / eyeline shift
Acting clarity, song relationship, camera/reader handling
Inner life unless behaviour is visible
Focus changes between reader, camera, or imagined partner
OSR01, OSR04
MT-V5-OSA06
Breath, pause or dynamic choice serving story
Vocal-story integration
Vocal health diagnosis
Pause/dynamic/breath that changes meaning or relationship
OSR01, OSR02
MT-V5-OSA07
Register or style event serving lyric/story
Vocal technique plus communication/style
Medical/fach/sustainability claims
Belt/mix/legit-style event tied to lyric/story
OSR02, OSR17
MT-V5-OSA08
Diction / text clarity moment
Vocal technique, lyric communication
Accent value judgement
Clear or obscured text on a story-critical phrase
OSR02
MT-V5-OSA09
Scene-to-song transition moment
Integration, component consistency
Whole-MT quality by itself
Observable continuity or drop moving from scene to song
OSR04
MT-V5-OSA10
Movement / choreography moment
Movement/dance comment
Dance quality if frame is insufficient
Full-body or task-sufficient visible movement phrase
OSR03
MT-V5-OSA11
Full-body or task-sufficient visibility
Movement assessability
Performance weakness if absent for access reasons
Frame shows enough body/space to judge movement
OSR03, OSR09
MT-V5-OSA12
Audio / accompaniment balance
Audio quality, vocal assessability, reliability
Artistic failure by itself
Voice/backing-track balance allows or blocks lyric/vocal assessment
OSR09
MT-V5-OSA13
Technical assessability
Reliability, technical note, presentation boundary
Talent/polish scoring
Framing/lighting/camera stability materially affects readability
OSR09, OSR13
MT-V5-OSA14
Brief instruction explicitly supplied
Brief adherence, role-fit boundary
Unsupported production-world invention
Specific instruction in the supplied brief matched to tape evidence
OSR10
MT-V5-OSA15
Fixed-material requirement explicitly supplied
Blocking alternative-material advice
Broader repertoire coaching
Brief or task states submitted/fixed material
OSR11
MT-V5-OSA16
No-brief limitation
Suppressing false specificity
Role/brief/compliance claims
Report states no brief and avoids invented requirements
OSR10
MT-V5-OSA17
Access / adaptation context
Non-deficit handling, reliability
Lower talent judgement
Adapted setup noted only if it affects assessability
OSR13
MT-V5-OSA18
Live redirection shown
Direction-response claims
Inferring direction-response from one finished take
Alternate take or note application is visible/documented
OSR12
MT-V5-OSA19
Score / cap / verdict trace
Readiness consistency
Changing thresholds or caps
Final score, cap and level threshold align with verdict text
OSR16
MT-V5-OSA20
Display parity evidence
Label/export/comparison checks
Rubric or scoring changes
Same label/score/timestamp across JSON, rendered page and export
OSR14, OSR15

7. MT Report Section Patch Requirements
Report section
Existing risk
Required output-specificity behaviour
Required evidence anchor
Suppression condition
Related output rule ID(s)
Related test ID(s)
casting_headline
Generic praise / overclaim
Include one tape-specific differentiator
OSA01–OSA10, OSA14 where briefed
Suppress callback/castability claims unless brief-supported and observable
OSR06, OSR12
OST01, OST02, OST12, OST23
casting_insight
Role/brief false specificity
Ground insight in component/material/style evidence
OSA01–OSA09, OSA14
No role/world invention in no-brief mode
OSR06, OSR10
OST02, OST19
component_breakdown
Acting/song siloing
Show acting + song components and integration where both exist
OSA09 plus component-specific evidence
Do not force MT breakdown if song-only or acting-only
OSR04, OSR14
OST01, OST03, OST04
acting component note
“Grounded/connected” generic
Cite line, beat, thought shift or relationship
OSA02–OSA05
Suppress role-specific claims if no brief/material basis
OSR01, OSR07, OSR10
OST13, OST19
song component note
“Technically excellent/emotional” generic
Cite lyric/phrase/vocal-story/style evidence
OSA01, OSA06–OSA08
Suppress song-story claims if audio blocks lyric/vocal evidence
OSR01, OSR02, OSR09
OST07, OST08
slate component note, if present
Slate as polish/charm
Treat as brief/process evidence only
OSA14, OSA13
Suppress performer-quality inference from slate alone
OSR13
OST17
Vocal category note
Technique-only praise
Distinguish technical and communication/story/style evidence
OSA06–OSA08, OSA12
Suppress Vocal label only if no singing/voiceover-style evidence; preserve where singing exists
OSR02, OSR14
OST08, OST13
Acting category note
Generic “connection”
Anchor to objective, beat, relationship, or sung-acting evidence
OSA02–OSA05, OSA01
Suppress acting-scene labels in song-only tape
OSR01, OSR14
OST03, OST04
Audio category note
“Clean audio” generic
State how audio affects assessability of speech, singing and accompaniment
OSA12
Do not equate poor audio with poor artistry
OSR09
OST18
Technical category note
Polish reward
Limit to assessability / explicit brief compliance
OSA13, OSA14
Suppress resource/polish merit
OSR09, OSR13
OST16, OST17
Brief fit / brief_adherence
Perfect/flawless overstatement
Only state verified requirements
OSA14, OSA15
Suppress if no brief or contradiction exists
OSR10, OSR16
OST19, OST20
Professional presentation
Class/polish/charm bias
Bound to task following, file/order clarity and safe assessability
OSA13, OSA14
Suppress polish, marketability, look, coaching/resource praise
OSR13
OST16, OST17
strengths
Transferable praise
Each strength needs material/component evidence
OSA01–OSA10
No generic “strong voice/acting/presence”
OSR07
OST12–OST14
improvements
Generic or alternative repertoire
Give actionable adjustment to submitted tape
OSA01–OSA15
No alternative material where fixed/submitted-material context
OSR07, OSR11
OST15
fix_first
Too broad
Identify one highest-impact observable change
OSA01–OSA14
No generic confidence/energy advice
OSR07
OST12–OST14
timestamped_notes
Too few / one-component only
Distribute across acting, song, integration/style where assessable
MM:SS plus OSA evidence
No invented/padded timestamps
OSR05
OST10, OST11, OST25
next_take_plan / coaching_drills
Brief-incompatible advice
Tie to submitted material and distinguish rehearsal vs recorded take
OSA01–OSA15
No prop/movement/framing-breaking advice
OSR08, OSR11
OST15, OST22
submission_risk_flags
Verdict inconsistency / false specificity
Risk language must align with caps, brief and verdict
OSA14, OSA19
Suppress unsupported “Why this isn’t ready” contradictions
OSR10, OSR16
OST20, OST21
role_fit_notes
Casting/marketability drift
Brief-bounded material/style/task fit only
OSA14 + performance evidence
No look/type/marketability/callback overclaim
OSR12, OSR13
OST23
presentation_notes
Low-value polish note
Use only where assessability or brief compliance matters
OSA13, OSA14
Suppress “neutral background works well” unless linked to readability
OSR09, OSR13
OST16
technical signals
Brief/no-brief mismatch
Must align with report mode and claims
OSA14, OSA16, OSA19
No contradiction between signal and report body
OSR10, OSR16
OST20
feedback reliability
Overconfidence
Reliability must reflect assessability and brief completeness
OSA12, OSA13, OSA14, OSA16
Suppress “High” confidence if key component is blocked or mode contradicts
OSR09, OSR10
OST18, OST20
comparison page
Label/score mismatch
Must match individual report labels, components, scores and timestamps
OSA20
No comparison-only reinterpretation
OSR15
OST26, OST27

8. Timestamp Density and Distribution Patch
Tape scenario
Target timestamp count
Required distribution
When fewer timestamps are acceptable
What must not happen
Related test ID(s)
Assessable 3–5 minute MT tape with acting + song
5–8
At least one acting, one song/vocal, one acting-through-song/integration/style, one strength, one improvement/fix-first
Shortened material, blocked audio/visibility, genuinely low-evidence tape
Two or three generic notes on a clear multi-component tape
OST01, OST10, OST11, OST25
Shorter MT tape under 60 seconds
3–4
Best available spread across visible components
Very brief slate-only or blocked evidence
Padding to hit 5 notes
OST01
1–3 minute MT tape
5–7
Cover each assessable component and one priority fix
One component absent or unassessable
Ignoring song or acting where both exist
OST10, OST11
Song-only tape
3–7 depending length
Song/vocal, lyric/story/style where assessable
Very short or poor audio
Acting-scene timestamp leakage
OST03
Acting-only tape misclassified as MT
3–7 depending length
Acting evidence only; no sung-vocal note
Singing absent
Vocal Performance label or song feedback
OST04
Poor-audio MT tape
Variable, lower acceptable
Timestamp what remains assessable; include reliability context
Audio materially blocks song or speech
Overconfident vocal/story claims
OST18
Poor-visibility or cropped movement tape
Variable
Suppress dance/movement claims; cover visible acting/song
Movement not assessable
Dance critique from cropped evidence
OST22
Access-adapted MT tape
5–8 if assessable
Same distribution where evidence is readable
Adaptation changes available evidence
Deficit language or lower density solely due to adaptation
OST24
Fixed-material MT tape
5–8 if assessable
Submitted material only
Brief blocks certain comments
Alternative material/repertoire advice
OST05, OST15
No-brief MT tape
5–8 if acting + song assessable
Acting + song + integration, no brief-specific claims
Material/role unknown
Invented role/brief/world/time limit
OST02, OST19
Preserved: maximum 8 timestamped notes, chronological order, no invented timestamps, MM:SS format.

9. Brief / No-Brief and False-Specificity Patch
Mode / scenario
Allowed claims
Blocked claims
Required reliability wording or limitation
Related issue ID(s)
Related rule/test ID(s)
Full brief present
Verified brief compliance, role/material/style task fit, explicit technical requirements
Anything not in the brief or not observable
State brief-driven evaluation only if technical signals and report agree
I07, I09
OSR10, OSR16; OST01
Partial brief present
Claims tied only to supplied brief elements
Assumed time limits, pages, sides, role/world not supplied
Note partial brief limitation if relevant
I07
OSR10; OST19
No brief present
Baseline professional standards and observable tape evidence
Role, brief, production-world, page/side, target audience, exact task requirements
State no-brief limitation; avoid role-fit
I07
OSR10; OST02
Technical signals say no brief but report claims brief-driven mode
None until contradiction resolved in output QA
Brief adherence, perfect compliance, role fit, instruction precision
Flag as report consistency failure
I07, I09
OSR10, OSR16; OST20
Unsupported exact time limit
Only general duration/assessability if locked and relevant
“Tape runs X; brief asks under Y” without supplied brief and locked measurement
Treat as false-specificity failure
I07
OSR10; OST19
Unsupported page / side reference
Only if supplied
Page/side citations not in brief/material
Suppress
I07
OSR10; OST19
Unsupported role requirement
Only task-known role requirements
Character traits or role demands invented from genre assumptions
Note unknown role/brief
I07
OSR10; OST19
Unsupported production-world claim
None unless supplied
Production setting, casting world, workshop context
Suppress
I07, I13
OSR10, OSR12; OST23
Unsupported material identity
Only clearly supplied/visible material
Song/scene title guesses
Use generic component description if uncertain
I07
OSR10
Unsupported “perfect adherence”
Verified specific compliance only
Perfect/flawless/all instructions met
State specific met requirements; do not overstate
I07, I09
OSR16; OST21
Fixed-material brief
Compliance and improvement within submitted material
Alternative-material advice
Mark fixed-material boundary
I06
OSR11; OST05, OST15
Choice-material brief
Repertoire suitability where choice was performer-controlled
Treating fixed material as performer choice
State choice status if known
I06
OSR11

10. Fixed-Material and Next-Take Boundary Patch
Context
Allowed next-take advice
Blocked next-take advice
Rehearsal-only distinction required?
Recorded-take compatibility required?
Related issue/test ID(s)
Fixed material
Adjust performance of submitted material
Choose a different song/scene/repertoire
Yes, if exercise uses altered text/action
Yes
I06; OST05, OST15
Choice material
Repertoire reflection only if performer-controlled and relevant
Blanket advice to replace material when task is tape improvement
Yes, if outside submitted tape
Yes
I06; OST06
Fixed framing
Use eye-line, thought, phrase, breath or contained physicality
Walking, large blocking, props that break frame
Yes
Yes
I06; OST22
Head-and-shoulders frame
Facial/eye-line/upper-body clarity
Full-body choreography advice unless required elsewhere
Yes
Yes
I06; OST22
Minimal movement self-tape
Contained physical intention
Expansive staging or business
Yes
Yes
I06; OST22
Song accompaniment constraints
Balance, cue, diction, phrase preparation
Demand paid accompanist or new track as performance requirement
Sometimes
Yes
I11; OST18
Props or business
Rehearsal exploration if safely labelled
Recorded-take prop use when brief discourages or frame cannot support it
Yes
Yes
I06; OST22
Physical movement advice
Frame-compatible movement if visible and relevant
Movement advice from cropped/unseen body
Yes
Yes
I11; OST22
Alternate song/repertoire advice
Only in repertoire-development context, not fixed submitted-tape improvement
“Pick a less-used alternative” in fixed-material/fix-first context
Yes
Yes
I06; OST15
Lyric-as-monologue rehearsal exercise
Allowed as rehearsal exercise for acting-through-song
Presenting spoken lyrics as final recorded-take change unless requested
Yes
No, unless brief allows
I01; OST07
Transition rehearsal exercise
Allowed to clarify scene-to-song thought
Unbriefed edit/restructure in recorded take
Yes
Yes
I01; OST09

11. Role-Fit / Callback / Workshop Claim Scope Patch
Claim type
Allowed only when
Must not be inferred from
Safer replacement
Related issue/test ID(s)
Recall-worthy
Explicit admissions/recall context or supplied evaluator brief supports it
High score or polished tape alone
Present-tape strengths and remaining risk
I13; OST23
Callback potential
Explicit casting process context and observable submitted-tape evidence
One finished take, charm, look, marketability
Evidence-bound readiness for submitted task
I13; OST23
Highly castable
Avoid except brief-bounded material/style fit; even then use cautiously
Appearance, type, commercial suitability, workshop language
Material/style/task fit where brief supports it
I13; OST23
Workshop readiness
Actual workshop footage or brief asks for workshop behaviour
Finished self-tape
Not assessable from this tape
I13; OST23
Response to direction
Alternate take, visible note application, live redirect, documented task
Single finished take
Direction-response not shown
I13; OST23
Training potential
Admissions/training context and observable trainable evidence
Marketability, appearance, polish
Observable readiness/strengths-led task handling
I13; OST23
Professional readiness
Clear task following, file/order, prepared cuts, process evidence
Studio polish, paid support, charm
Observable process or assessability evidence
I11, I13; OST16
Role fit
Supplied brief/role/material requirements
No-brief tape, assumed character world, appearance
Brief-bounded material/style fit
I07, I13; OST02, OST23
Casting fit
Supplied casting criteria and safe observable evidence
Type/look/marketability
Task fit or performance fit to stated material
I13; OST23
Marketability
Not a valid scoring claim
Any tape performance
Block entirely
I13; OST23
Bookability
Not a valid scoring claim
Any tape performance
Block entirely
I13; OST23
Perfect casting
Not a valid talent criterion
Any tape performance
Training potential or task fit if evidence supports
I13; OST23

12. Presentation, Access and Anti-Polish Patch
Area
Allowed handling
Prohibited handling
Required wording boundary
Related issue/test ID(s)
Neutral background
Mention only if it improves readability or meets explicit brief
Praise as polish/status
Assessability only
I11; OST16
Lighting
Mention if it affects facial/body readability
Treat expensive lighting as merit
Visibility/readability only
I11; OST16
Framing
Assess against brief or component visibility
Penalise access adaptation unless assessment blocked
Brief/assessability only
I11; OST16, OST22
Home setup
Neutral if assessable
Class-coded or resource criticism
No home-quality judgement
I11; OST17
Studio setup
Readability only
Reward studio access as talent
No polish bonus
I11; OST16
Paid accompanist / backing track
Assess balance and audibility
Reward paid support
Audio/assessability only
I11; OST18
Paid reader
Assess performer response if visible
Reward reader access
Reader is process support
I11; OST17
Paid coaching
Not performance evidence
Any coaching/polish inference
Exclude
I11; OST16
Slate
Brief/process clarity only
Charm or professional-value overclaim
Evidence of required ident only
I11
Clothing
Only if explicit safety/brief issue and non-personal
Appearance/class/style judgement
Do not score clothing cost/look
I13
Accent / speech difference
Assess only task-specific clarity where safe and explicit
Treat accent as deficit
No accent bias
I11; OST24
Mobility difference / seated adaptation
Assess visible submitted performance
Treat range/mobility as deficit
Non-deficit; assess only visible task evidence
I11; OST24
Disability / access need
Fairness/reliability context if relevant
Talent deficit
Non-penalisation
I11; OST24
Convalescence
Do not diagnose; assess submitted evidence
Medical inference
No diagnosis or deficit
I11; OST24
Production polish
Do not treat as talent
“Polished” as merit
Readability/assessability only
I11; OST16
File/order clarity
Process/brief compliance if explicit
Talent or class proxy
Keep bounded to task following
I11
Technical assessability
Can affect reliability and technical/audio fields
Hidden artistic penalty
State limitation explicitly
I11; OST18

13. Display, Label, Comparison and Export QA Requirements
Live QA requirement ID
What must be checked
Artefact needed
Expected pass condition
Failure condition
Related issue ID(s)
Priority
MT-V5-LQA01
Raw report JSON
JSON/report object
Contains correct audition_type, components, scores, timestamps and mode
JSON unavailable or inconsistent with render
I14/I15
P1
MT-V5-LQA02
Rendered report page
Screenshot/rendered report
Reflects same components, scores, labels and notes
Label/score/component mismatch
I14/I15
P0
MT-V5-LQA03
PDF/export
Export/PDF
Same scores, labels, timestamps and section content as rendered page
Export differs from rendered report
I14/I15
P1
MT-V5-LQA04
Comparison page
Comparison screenshot/export
Scores/labels align with individual reports
Comparison labels or scores drift
I14/I15
P1
MT-V5-LQA05
Category labels
Rendered report + JSON
Acting/Vocal labels match meaning and visibility rules
Vocal hidden in MT singing; Acting hidden in spoken acting
I14/I15
P0
MT-V5-LQA06
Component labels
Rendered report
Acting scene and song displayed when present
Components collapsed or mislabeled
I14/I15
P0
MT-V5-LQA07
Component weights / displayed component percentages
Rendered report + JSON
Displayed component percentages do not imply changed operational score fields/weights
Confusing component weighting or mismatch
I14/I15
P1
MT-V5-LQA08
Vocal label where singing exists
Rendered report
Vocal visible and singing-appropriate in genuine MT singing
Vocal omitted or relabelled incorrectly
I14/I15
P0
MT-V5-LQA09
Acting label where spoken acting exists
Rendered report
Acting visible in genuine spoken acting
Acting omitted or hidden
I14/I15
P0
MT-V5-LQA10
No Vocal Performance label in acting-only output
Acting-only report
No singing/vocal-performance language
Acting-only report shows sung-vocal label
I14/I15
P0
MT-V5-LQA11
No acting-scene feedback in song-only output
Song-only report
No reader/scene/dialogue feedback
Song-only report references scene/reader
I14/I15
P0
MT-V5-LQA12
Timestamp count parity
JSON + rendered + PDF/export
Same count and same MM:SS notes across surfaces
Rendered/exported timestamps mismatch
I11, I14/I15
P0
MT-V5-LQA13
Score/verdict consistency
JSON + rendered report
Overall, verdict and explanatory language align
Strong verdict paired with unready language without explanation
I09
P0
MT-V5-LQA14
Cap/verdict consistency
JSON + rendered report
Cap and threshold produce correct verdict label
Capped score crosses wrong verdict
I09
P0
MT-V5-LQA15
Brief mode / no-brief mode consistency
JSON + technical signals + render
Mode language is consistent throughout
Brief-driven body with “No brief” signal
I07
P0
MT-V5-LQA16
role_fit_modifier display and suppression
JSON + render
Role fit only appears in brief mode and safe terms
Role fit in baseline/no-brief or marketability terms
I07, I13
P0
MT-V5-LQA17
Feedback reliability label
Rendered report
High/Medium/Low aligns with evidence availability
High reliability despite blocked evidence/mode contradiction
I07, I09
P0
MT-V5-LQA18
Presentation notes
Rendered report
Assessability/process only
Polish/class/resource praise
I11
P0
MT-V5-LQA19
Technical signals
Rendered report
Signals support report claims and mode
Signals contradict brief/readiness claims
I07
P0
MT-V5-LQA20
Brief adherence section
Rendered report
Only verified brief requirements claimed
Perfect/flawless unsupported compliance
I07, I09
P0
MT-V5-LQA21
Fixed-material suppression
Rendered report
No alternative-material advice where fixed/submitted-material context
Alternative repertoire suggestion
I06
P0
MT-V5-LQA22
Component-balanced timestamp distribution
Rendered report/export
Acting + song + integration/style represented where assessable
Timestamps only one component
I11
P0
MT-V5-LQA23
Callback/workshop claim suppression
Rendered report
No unsupported recall/callback/workshop/castability claims
“Recall-worthy”, “highly castable”, “workshop-ready” from one take
I13
P0
MT-V5-LQA24
Access-adapted output handling
Rendered report + brief/context
Non-deficit language and assessability-only framing
Access/adaptation treated as weakness
I11
P0

14. Adversarial MT Regression Test Pack
Test ID
Scenario
Input condition
Expected output behaviour
Must fail / be blocked
Related rule ID(s)
Related issue ID(s)
Priority
MT-V5-OST01
Acting + song MT tape with full brief
Clear brief, acting scene and song both present
MT type, Acting and Vocal visible, component breakdown, 5–8 notes if assessable
Component loss, generic headline, timestamp underproduction
OSR04, OSR05, OSR06, OSR14
I01, I11, I14/I15
P0
MT-V5-OST02
Acting + song MT tape with no brief
No brief, acting and song present
No role/brief/world invention; components still detected
No-brief treated as acting-only or brief-specific
OSR10, OSR14
I07, I14/I15
P0
MT-V5-OST03
Song-only MT-style tape
Song only; no spoken scene
Song/vocal/lyric feedback; no scene/reader claims
Acting-scene feedback leakage
OSR01, OSR02, OSR14
I14/I15
P0
MT-V5-OST04
Spoken scene only misclassified as MT
Acting only; no singing
Acting only; no sung Vocal Performance label
Vocal/singing label or song feedback
OSR14
I14/I15
P0
MT-V5-OST05
Fixed material brief
Brief specifies material
Improve submitted performance only
Alternative repertoire suggestion
OSR11
I06
P0
MT-V5-OST06
Choice material brief
Performer chooses piece
Repertoire suitability may be discussed if observable
Treat fixed material as choice or vice versa
OSR11
I06
P1
MT-V5-OST07
Acting-through-song evidence missing
Song praise lacks lyric/phrase/beat evidence
Song-story claim suppressed or limited
“Good storytelling” unsupported
OSR01
I01
P0
MT-V5-OST08
Song feedback over-focused on vocal technique
Technique evidence but no story/style anchor
Distinguish technique from story/style; do not overclaim
Technique-only complete success
OSR02
I03
P0
MT-V5-OST09
Scene-to-song transition ignored
Acting + song both present
Integration note appears where assessable
Siloed acting/song notes only
OSR04
I01, I11
P0
MT-V5-OST10
Timestamps cover only acting
MT tape with song present
Song/vocal or integration timestamp included
Acting-only timestamp distribution
OSR05
I11
P0
MT-V5-OST11
Timestamps cover only song
MT tape with acting present
Acting timestamp included
Song-only timestamp distribution
OSR05
I11
P0
MT-V5-OST12
Generic “emotionally connected” praise
Report includes phrase
Must anchor to lyric/beat/action or suppress
Unsupported generic phrase
OSR01, OSR07
I01
P0
MT-V5-OST13
Generic “strong vocal control” praise
Report includes phrase
Must anchor to register/diction/phrase/style/story
Technique-only phrase
OSR02
I03
P0
MT-V5-OST14
Generic “grounded acting” praise
Report includes phrase
Must anchor to line/beat/objective/relationship
Unsupported acting generic
OSR07
I01
P0
MT-V5-OST15
Alternative repertoire suggestion in fixed-material context
Fixed/submitted-material task
Advice remains within submitted material
Less-used alternative song advice
OSR11
I06
P0
MT-V5-OST16
Strong production polish but weak performance
Polished technical capture, weak acting/song
Performance evidence remains decisive
Polish inflates performance/presentation as talent
OSR09, OSR13
I11
P0
MT-V5-OST17
Simple home capture with strong performance
Low-budget but assessable
No penalty for lack of polish
Resource/class-coded critique
OSR09, OSR13
I11
P0
MT-V5-OST18
Poor audio / accompaniment balance
Backing track masks voice or speech unclear
Reliability/audio limitation; no overconfident vocal/acting judgement
Artistic criticism from unassessable audio
OSR09
I11
P0
MT-V5-OST19
Unsupported exact time-limit claim
No locked brief time limit
No precise duration breach claim
“Tape runs X; brief asks Y”
OSR10
I07
P0
MT-V5-OST20
Contradictory brief/no-brief signal
Report says brief-driven but signals no brief
Failure flagged; no brief claims accepted
Internal contradiction
OSR10, OSR16
I07, I09
P0
MT-V5-OST21
Strong verdict plus “Why this is not ready” contradiction
Strong verdict and unready section coexist
Clear non-blocking risk explanation or aligned verdict
Conflicting readiness message
OSR16
I09
P0
MT-V5-OST22
Movement advice breaks fixed frame
Close-up/fixed-frame brief
Rehearsal-only or frame-compatible advice
Recorded-take prop/walking/frame-breaking advice
OSR03, OSR08
I06, I11
P0
MT-V5-OST23
Callback / recall / workshop overclaim
Single finished self-tape
Present-tape evidence only
Recall-worthy/callback/workshop-ready/highly castable
OSR12
I13
P0
MT-V5-OST24
Access-adapted MT context
Adapted setup/performance
Non-deficit, assessability-only handling
Access/adaptation deficit
OSR13
I11
P0
MT-V5-OST25
Underproduced timestamps
Clear 3–5 minute MT tape
5–8 useful notes where assessable
Only 2–4 notes without limitation
OSR05
I11
P0
MT-V5-OST26
Comparison-page label mismatch
Report + comparison page
Labels/scores align
Comparison mismatches report
OSR15
I14/I15
P1
MT-V5-OST27
Rendered/exported timestamp mismatch
Rendered page + PDF/export + JSON
Same timestamps across surfaces
Timestamp count/text mismatch
OSR15
I14/I15
P1

15. Patch-to-Baseline Compatibility Check
Patch area
Baseline constraint affected
Compatible?
Reason
Required preservation language
Risk if mishandled
Acting-through-song output rule
No new score fields
Yes
Evidence rule inside existing sections
No acting-through-song score field
Schema drift
Vocal technique/story rule
Vocal field preserved
Yes
Clarifies meaning, does not split field
No vocal sub-score
Field fragmentation
Movement evidence rule
No MT dance score field
Yes
Suppresses/conditions comments only
No movement/dance score field
Weight/schema creep
Integration comment rule
Component breakdown preserved
Yes
Uses existing component/report structure
No new integration score
Structural change
Timestamp density
Max 8 notes
Yes
Target within existing cap
Maximum remains 8
Overlong reports or invented notes
Brief/no-brief consistency
Report mode / brief guardrails
Yes
Prevents false specificity
No invented brief facts
Trust regression
Fixed-material suppression
Material-policy guardrails
Yes
Strengthens guardrail
No alternative material in fixed context
Brief-incompatible advice
Role/callback scope
Role-fit bounds
Yes
Narrows claims, no bound change
Role fit remains brief-mode only
Marketability/casting overclaim
Presentation/access boundary
Safety/accessibility scrub
Yes
Strengthens non-deficit handling
No polish/resource/access deficit scoring
Bias regression
Display-label QA
No UI mechanism proposal
Yes
Defines QA artefacts only
No frontend mechanism proposed
Display mismatch if untested
Comparison/export QA
No renderer/export mechanism proposal
Yes
Defines checks only
No render/export change proposed
Parity remains unverified
Verdict/readiness consistency
Caps/blockers/verdict thresholds
Yes
Aligns language to existing decisions
No threshold/cap changes
Conflicting user guidance
No score-field changes
Six-field model
Yes
Explicitly preserved
No score-field changes
Architecture break
No weight changes
Current MT weights
Yes
Explicitly preserved
No weight changes
MT anchor regression
No cap/blocker/verdict-threshold changes
Scoring guardrails
Yes
Output alignment only
No cap/blocker/threshold changes
Scoring instability
No role-fit bound changes
Role-fit guardrails
Yes
Scope suppression only
No role-fit bound changes
Unsafe role-fit behaviour
No backend/schema/report JSON changes
Do-not-touch list
Yes
Patch is requirements only
No backend/schema/report JSON changes
Implementation overreach
No UI/render/export mechanism proposal
Do-not-touch list
Yes
QA requirements only
No mechanism proposal
Scope creep
No Step 1 / Step 2 pipeline change
Protected workflow
Yes
Output expectations only
Preserve Step 1 / Step 2 split
Evidence/polish instability
No subtype score field
Scoring guardrails
Yes
Conditional report language only
No subtype score field
Pseudo-precision
No MT dance score field
Scoring guardrails
Yes
Evidence comments only
No MT dance score field
Architecture creep
No vocal sub-score
Scoring guardrails
Yes
Internal distinction only
No vocal sub-score
Score schema drift
No new audition type
Audition enum
Yes
No enum change
No new audition type
Classification drift
No imported exam-board percentages
MT weights
Yes
Comparator only
No imported percentages
Invalid scoring import

16. MT Output-Specificity Patch Decision
Decision: Patch complete but live-output QA still required before release.
Rationale: The output-specificity patch now converts the MT maturity issues into standalone rules, prohibited patterns, evidence anchors, timestamp-distribution expectations, brief/no-brief safeguards, fixed-material boundaries, role/callback claim limits, presentation/access guardrails, display-label QA requirements and adversarial regression tests. This addresses the identified output-risk pattern without reopening research, rewriting the rubric, or proposing implementation mechanics.
Critical blockers: No research or rubric-slice blocker remains. Full release sign-off is blocked until live-output QA is run against implemented outputs or current full artefacts.
What can remain closed: MT research, synthesis, gap audit, rubric-slice revision, final audit, source maturity and source-family boundaries.
What must be used in implementation planning: MT-V5-OSR01–OSR17, MT-V5-OSP01–OSP35, MT-V5-OSA01–OSA20, MT-V5-OST01–OST27, and MT-V5-LQA01–LQA24.
What must remain pending for live-output QA: Raw JSON verification, rendered-page label checks, PDF/export timestamp parity, comparison-page parity, score/verdict/cap consistency, label-helper behaviour, role_fit_modifier suppression, and access-adapted MT behaviour.
What must remain a limitation: Through-composed MT is not a complete rule set. Fixed subtype weighting remains unsupported. Deeper dance and voice calibration remains deferred to those branches. Pop-rock / belt / mix / jukebox handling remains conditional and evidence-bound.
Can MT proceed into cross-branch implementation planning after this patch? Yes, with live-output QA still required before release.

17. Reusable Handoff Pack for MT Implementation Planning
MT output-specificity patch summary
The Musical Theatre branch remains closed at research, synthesis, audit, revision and final-audit level. The required v5 work is an output-specificity patch, not a broader refresh. The patch preserves the stabilised MT anchor: musical_theatre detection where acting + song are present, component breakdown, visible Acting and Vocal categories, current MT weights, consistency_modifier where used, and timestamp coverage across acting and song. No new score fields, subtype weights, score caps, verdict thresholds, role-fit bounds, backend, schema, UI, data-flow or renderer/export changes are proposed.
The patch addresses the output behaviour risks shown in supplied MT report examples: generic headlines, under-anchored vocal and acting notes, broad acting-through-song praise, insufficient timestamp density, brief/no-brief contradiction, unsupported time-limit or perfect-adherence claims, callback/castability overclaim, alternative-repertoire leakage, and polish/resource presentation risk. Current PDFs are usable as risk evidence but not as full live-output sign-off because raw JSON, comparison-page parity, renderer/export parity and score recomputation traces are not supplied.
The core output rules require MT feedback to pass the specificity benchmark: it must be about this performer, this tape, this material, this style/subtype where known, and this observable evidence. Acting-through-song claims require lyric, phrase, beat, objective, addressee, focus or physical/facial evidence. Vocal comments must distinguish technique from communication/story/style. Movement/dance claims require visible, assessable movement. Integration must be addressed when acting and song coexist. Timestamps should be component-balanced and, for assessable 3–5 minute MT/hybrid tapes, should aim for 5–8 notes within the existing maximum of 8.
The patch blocks false specificity and overclaiming: no invented brief, role, production world, time limit, page/side reference or material requirement; no contradictory brief/no-brief output; no alternative-material advice in fixed/submitted-material contexts; no callback, recall, workshop, response-to-direction or training-potential claim unless directly supported; no marketability, bookability, appearance, body/type, polish, paid support or access-need deficit language.
Compact rule list
Rule ID
Rule title
MT-V5-OSR01
Acting-through-song evidence
MT-V5-OSR02
Vocal technique versus story/style
MT-V5-OSR03
Movement/dance evidence
MT-V5-OSR04
Scene-to-song integration
MT-V5-OSR05
Timestamp density and distribution
MT-V5-OSR06
Headline / casting insight specificity
MT-V5-OSR07
Strengths / improvements / fix-first specificity
MT-V5-OSR08
Next-take plan boundary
MT-V5-OSR09
Self-tape assessability
MT-V5-OSR10
Brief / no-brief consistency
MT-V5-OSR11
Fixed material versus choice material
MT-V5-OSR12
Role-fit / callback / workshop claim scope
MT-V5-OSR13
Accessibility / anti-polish boundary
MT-V5-OSR14
Display-label protection
MT-V5-OSR15
Comparison/export parity verification
MT-V5-OSR16
Verdict/readiness consistency
MT-V5-OSR17
Style/subtype conditionality
Compact prohibited-pattern list
Pattern ID range
Covers
MT-V5-OSP01–OSP21
Generic acting, vocal, movement, musicality and storytelling praise requiring evidence anchors
MT-V5-OSP22–OSP24
Recall/callback/castability overclaims
MT-V5-OSP25–OSP29
Perfect/flawless adherence and false-specificity claims
MT-V5-OSP30
Alternative-repertoire advice in fixed-material contexts
MT-V5-OSP31–OSP35
Polish, marketability, paid-resource, access-deficit and live-room inference blocks
Compact evidence-anchor list
Anchor ID range
Covers
MT-V5-OSA01–OSA09
Lyric, phrase, beat, objective, relationship, focus, breath/dynamic, register/style, diction and transition evidence
MT-V5-OSA10–OSA13
Movement, full-body/task-sufficient visibility, audio/accompaniment and technical assessability
MT-V5-OSA14–OSA16
Brief instruction, fixed-material requirement and no-brief limitation
MT-V5-OSA17–OSA18
Access/adaptation context and live redirection only where actually shown
MT-V5-OSA19–OSA20
Score/verdict trace and display parity evidence
Compact regression-test list
Test ID range
Covers
MT-V5-OST01–OST04
MT classification, acting + song, no-brief, song-only and acting-only leakage
MT-V5-OST05–OST06
Fixed versus choice material
MT-V5-OST07–OST14
Acting-through-song, vocal over-focus, integration and generic praise suppression
MT-V5-OST15–OST18
Alternative repertoire, production polish, home capture and poor audio
MT-V5-OST19–OST21
False specificity, brief contradiction and verdict/readiness consistency
MT-V5-OST22–OST24
Movement/framing, callback/workshop overclaim and access-adapted MT
MT-V5-OST25–OST27
Timestamp underproduction, comparison label mismatch and render/export timestamp mismatch
Compact live-QA requirement list
LQA ID range
Covers
MT-V5-LQA01–LQA04
JSON, rendered report, PDF/export and comparison artefacts
MT-V5-LQA05–LQA11
Category/component label protection and acting/song leakage checks
MT-V5-LQA12–LQA15
Timestamp parity, score/verdict consistency, cap/verdict consistency and brief-mode consistency
MT-V5-LQA16–LQA21
Role-fit suppression, reliability, presentation, technical signals, brief adherence and fixed-material boundaries
MT-V5-LQA22–LQA24
Component-balanced timestamps, callback/workshop suppression and access-adapted output handling
Baseline preservation statement
This patch preserves the current six-field scoring model, MT weights, audition type enum, component breakdown, Acting/Vocal visibility, consistency_modifier, caps, blockers, verdict thresholds, role-fit bounds, Step 1 / Step 2 split, report JSON structure, comparison/export architecture and maximum output limits. It defines output requirements and QA tests only.
Unresolved limitations
Through-composed MT remains a limitation. Fixed dance-led / voice-led / acting-led MT weighting remains unsupported. Deeper vocal-style calibration is deferred to Voice/Singing. Deeper movement/dance calibration is deferred to Dance. Full live-output sign-off remains pending until raw JSON, rendered report, PDF/export and comparison-page artefacts are checked.
Final patch decision
Patch complete. MT can enter cross-branch implementation planning with live-output QA still required before release.

18. Completion Statement
MT-V5-OUTPUT-SPEC-PATCH complete. Musical Theatre output-specificity package is ready for implementation planning, with live-output QA still required before release.

---

## Links

- **Previous:** [[drr-mt-12-final-audit]] — Final Audit
- **Next:** [[drr-mt-14-v5-live-output-qa]] — V5 Live-Output QA
- **Thread overview:** [[drr-mt-overview]]
- **Programme:** [[drr-programme-overview]]
