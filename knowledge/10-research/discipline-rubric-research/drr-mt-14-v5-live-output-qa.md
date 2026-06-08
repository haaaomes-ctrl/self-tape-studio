---
id: drr-mt-14-v5-live-output-qa
title: Musical Theatre — V5 Live-Output QA
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/1. MT/MT-V5-LIVE-OUTPUT-QA.md"
discipline: mt
monday_ref: null
tags: [discipline-rubric-research, mt, stage-qa]
confidence: medium
created: 2026-05-06
imported: 2026-06-08
updated: 2026-06-08
---

# Musical Theatre — V5 Live-Output QA

> **Imported research — Discipline Rubric Research programme.** Step 14 of 17 in the Musical Theatre thread (`stage-qa`). Original file: `1. MT/MT-V5-LIVE-OUTPUT-QA.md`. Original date: 2026-05-06 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-mt-overview]].

---

MT-V5-LIVE-OUTPUT-QA — Musical Theatre Live Output QA Against Output-Specificity Patch
1. MT Live Output QA Readiness Check
Check
Result
Notes
MT-V5 output-specificity patch basis present
Yes
Patch basis supplied through MT maturity handoff, MT-REV and MT-FINAL-AUDIT addendum.
MT-REV / MT-FINAL-AUDIT material present
Yes
Revised MT slice and final-audit addendum are prepopulated.
TapeCoach baseline / guardrail context present
Yes
Run 0E / current product guardrails prepopulated.
Current MT rendered report artefacts present
Yes, partial
Four PDF-like rendered report artefacts are supplied.
Current MT PDF/export artefacts present
Yes, partial
Four PDF report captures supplied, but no rendered-vs-export parity pair.
Current MT screenshots present
No separate screenshots
PDF/report captures only.
Current MT raw JSON/report-object artefacts present
No
Not auditable from supplied materials.
Current MT comparison-page artefacts present
No
Not auditable from supplied materials.
Score/verdict/cap trace artefacts present
Partial proxy only
Two proxy audio-cap examples are supplied, not full live report traces.
Exact QA object identified
Yes
Four current Musical Theatre report artefacts: MT-V5-LIVE-A01–A04.
QA may proceed
Yes
Proceeding as partial PDF/rendered-output QA.
QA scope
Partial PDF/rendered-output QA
Full live-output QA is not possible without raw JSON, comparison, rendered/export parity and score recomputation artefacts.
Caveat: this QA can evaluate visible report wording, component display, timestamps, verdict/readiness contradictions, brief/no-brief contradictions, and generic-output risk. It cannot verify raw JSON, server-side recomputation, persisted timestamp parity, comparison page parity, renderer/export parity, or frontend label-helper behaviour.
2. Supplied Artefact Register
Artefact ID
Artefact name / file label / take label
Artefact type
Present?
Used?
Pages / sections inspected
What can be audited
What cannot be audited
Evidence pointer
MT-V5-LIVE-A01
“Hannah” / Brief-driven / Take 1 / score 91
Rendered report PDF
Yes
Yes
Headline, verdict, components, categories, brief adherence, strengths, improvements, timestamps, next take
Wording specificity, component display, category visibility, timestamp count, generic praise, recall overclaim
Raw JSON, comparison, export parity, score recomputation

MT-V5-LIVE-A02
“Test” / Brief-driven but technical signals say “No brief” / Take 1 / score 93 / “WHY THIS ISN’T READY”
Rendered report PDF
Yes
Yes
Headline, verdict, risk, components, categories, brief fit, technical signals, strengths, improvements, timestamps, next take
Brief/no-brief contradiction, readiness contradiction, false time-limit claim, generic praise, alternative repertoire leak
Raw JSON, comparison, export parity, recomputation cause

MT-V5-LIVE-A03
“Test” / Brief-driven / Take 1 / score 93 / callback and page-side claims
Rendered report PDF
Yes
Yes
Headline, confidence, components, categories, brief adherence, strengths, improvements, timestamps, next take
Callback overclaim, page-side false-specificity risk, generic praise, timestamp underproduction
Raw JSON, comparison, export parity, source of page-side data

MT-V5-LIVE-A04
“test” / Brief-driven / Take 1 / score 89 / “highly castable” language
Rendered report PDF
Yes
Yes
Headline, verdict, presentation notes, components, categories, brief adherence, strengths, improvements, timestamps, technical signals
Castability/workshop overclaim, generic vocal/acting phrases, timestamp underproduction, presentation note quality
Raw JSON, comparison, export parity, brief contents beyond visible text

3. QA Scope and Non-Implementation Boundary
This QA covers visible PDF/rendered report behaviour: wording specificity, component display, Acting/Vocal visibility, timestamp density, brief/no-brief consistency, readiness/verdict consistency, role-fit/callback overclaims, generic praise, fixed-material leakage, presentation/polish boundaries, and visible technical-signal contradictions.
It does not cover raw report JSON, score recomputation, caps/blockers as implemented, role-fit modifier calculation, comparison page parity, renderer/export parity, frontend label helper behaviour, pipeline behaviour, or persistence.
A pass means the visible report follows MT-V5 output rules with no material contradiction and enough evidence anchoring. A partial pass means the MT stabilised structure is present but wording or density needs verification. A fail means output-specificity or non-regression rules are visibly violated. Not auditable means the required artefact is absent.
Release sign-off is blocked by critical contradictions, unsafe overclaims, unsupported brief specificity, repeated generic-output failures, and missing parity artefacts. Implementation-planning follow-up may proceed only as requirements and verification work, not release approval.
4. Artefact-by-Artefact Executive QA Summary
Artefact ID
Apparent mode
Apparent audition type / components
Score / verdict shown
Timestamp count
Component spread
Major output-specificity failures
Major non-regression failures
Live-QA status
Release-sign-off impact
MT-V5-LIVE-A01
Brief-driven
MT: Acting Scene + Song
91 / Strong for this level
2
Acting yes; song yes; integration weak; style weak
“recall-worthy”, “vocally superb”, “emotionally intelligent”, “perfect song choice”, acting-through-song praise without lyric/phrase evidence
Timestamp underproduction; generic song/story evidence
Fail
Requires patch verification
MT-V5-LIVE-A02
Contradictory / unclear
MT: Acting Scene + Song
93 / Strong for this level + “WHY THIS ISN’T READY”
3
Acting yes; song yes; integration partial; style weak
Brief/no-brief contradiction; unsupported 246s/240s claim; generic praise; alternative repertoire advice; recall-chance overclaim
Critical readiness contradiction and false-specificity risk
Fail
Blocks release
MT-V5-LIVE-A03
Brief-driven
MT: Acting Scene + Song
93 / confidence 95
4
Acting yes; song yes; integration claimed; style partial
“strong callback potential”; “Side 1 (pg. 85-87)” unsupported unless brief data proves it; “flawlessly”; generic vocal/storytelling
Timestamp under target; role/callback overclaim
Fail
Requires patch verification
MT-V5-LIVE-A04
Brief-driven
MT: Acting Scene + Song + Slate
89 / Strong for this level
3
Acting yes; song yes; integration partial; style partial
“Highly castable”; “workshops”; “strong vocal control”; “grounded acting”; “perfect adherence”; low-value presentation note
Timestamp under target; workshop/castability overclaim
Fail
Requires patch verification
5. MT-V5-LQA Requirement Matrix
LQA ID
Requirement
Status
Evidence from artefacts
Gap / failure
Required follow-up
Related finding ID(s)
Priority
MT-V5-LQA01
Raw report JSON
Not auditable
No JSON supplied
Cannot verify persisted fields or score source
Supply raw JSON for each artefact
MT-V5-LIVE-F12
P0
MT-V5-LQA02
Rendered report page
Partial
PDF-like rendered reports supplied
No separate live page screenshots
Verify live rendered page after patch
MT-V5-LIVE-F12
P1
MT-V5-LQA03
PDF/export
Partial
Four PDF captures supplied
No rendered-vs-export parity pair
Supply export paired with rendered page
MT-V5-LIVE-F12
P1
MT-V5-LQA04
Comparison page
Not auditable
No comparison artefact
Comparison parity unknown
Supply comparison page
MT-V5-LIVE-F12
P1
MT-V5-LQA05
Category labels
Partial pass
Vocal, Acting, Audio, Technical, Brief fit visible
Label semantics not verified against JSON
Verify labels in JSON/render/export
MT-V5-LIVE-P01
P1
MT-V5-LQA06
Component labels
Pass, visible level
Acting Scene, Song, Slate shown where relevant
Component detection source not auditable
Verify component detection in JSON
MT-V5-LIVE-P01
P1
MT-V5-LQA07
Component weights / displayed percentages
Partial
50/50 in A01–A03; 40/50/10 in A04
Need clarify component weights are not final MT field weights
Verify display is non-misleading
MT-V5-LIVE-F12
P1
MT-V5-LQA08
Vocal label where singing exists
Pass
Vocal visible in all four MT reports
No issue visible
Preserve
MT-V5-LIVE-P01
P0
MT-V5-LQA09
Acting label where spoken acting exists
Pass
Acting visible in all four MT reports
No issue visible
Preserve
MT-V5-LIVE-P01
P0
MT-V5-LQA10
No Vocal Performance label in acting-only output
Not auditable
No acting-only artefact supplied
Cannot test leakage
Supply acting-only negative test
MT-V5-LIVE-F12
P1
MT-V5-LQA11
No acting-scene feedback in song-only output
Not auditable
No song-only artefact supplied
Cannot test leakage
Supply song-only negative test
MT-V5-LIVE-F12
P1
MT-V5-LQA12
Timestamp parity between JSON, render, export
Not auditable
No JSON/export parity material
Cannot compare persisted and rendered counts
Supply JSON + rendered + export
MT-V5-LIVE-F12
P0
MT-V5-LQA13
Score/verdict consistency
Fail
A02 shows Strong / “send with confidence” plus “WHY THIS ISN’T READY”
Internal readiness conflict
Re-test readiness/verdict language
MT-V5-LIVE-F06
P0
MT-V5-LQA14
Cap/verdict consistency
Not auditable live; proxy concern
Audio-cap examples supplied only as proxy
No live capped report trace
Supply capped-score report JSON / trace
MT-V5-LIVE-F12
P0
MT-V5-LQA15
Brief mode / no-brief consistency
Fail
A02 top says brief-driven; technical signals say “No brief”
Critical contradiction
Re-test brief signal alignment
MT-V5-LIVE-F05
P0
MT-V5-LQA16
role_fit_modifier display and suppression
Not auditable
No role-fit modifier data supplied
Cannot verify bounds/suppression
Supply JSON and rendered role-fit section
MT-V5-LIVE-F12
P1
MT-V5-LQA17
Feedback reliability label
Partial fail
A02 “Very reliable” despite brief contradiction
Reliability overstates certainty
Re-test reliability in contradiction cases
MT-V5-LIVE-F05
P0
MT-V5-LQA18
Presentation notes
Partial fail
“polished”, “professional”, “neutral background works well” recur
Polish/readability boundary weak
Verify assessability-only wording
MT-V5-LIVE-F10
P1
MT-V5-LQA19
Technical signals
Partial fail
A02 technical signals contradict report mode and risk
Technical signal not consistently integrated
Verify signal-to-report consistency
MT-V5-LIVE-F05
P0
MT-V5-LQA20
Brief adherence section
Fail
“perfect”, “flawless”, “all instructions met” with contradictory or unverified inputs
Overstated compliance
Verify brief evidence anchoring
MT-V5-LIVE-F09
P0
MT-V5-LQA21
Fixed-material suppression
Fail
A02 suggests alternative song/repertoire
Submitted-material boundary leaks
Re-test fixed/submitted material outputs
MT-V5-LIVE-F07
P0
MT-V5-LQA22
Component-balanced timestamp distribution
Fail
2–4 timestamps across multi-component reports
Under target and weak integration density
Re-test timestamp production
MT-V5-LIVE-F04
P0
MT-V5-LQA23
Callback/workshop claim suppression
Fail
“recall-worthy”, “strong callback potential”, “highly castable… workshops”
Live-room/casting outcome overclaims
Suppress unless directly evidenced
MT-V5-LIVE-F08
P0
MT-V5-LQA24
Access-adapted output handling
Not auditable
No access-adapted artefact supplied
Cannot verify anti-deficit handling
Supply access-adapted MT artefact
MT-V5-LIVE-F12
P1
6. Output-Specificity Rule Compliance Matrix
Rule ID
Rule title
Status
Evidence from supplied outputs
Failure pattern
Artefact ID(s)
Finding ID(s)
Priority
MT-V5-OSR01
Acting-through-song evidence
Fail
A01 says “acting-through-song is a real highlight” without lyric/phrase evidence
Claim not anchored to lyric/beat/action
A01–A04
F02
P0
MT-V5-OSR02
Vocal technique versus story/style
Fail
“superb vocal”, “strong vocal control”, “secure pitch”, “lovely tone” recur
Technique/style praise not tied enough to lyric/story
A01–A04
F03
P0
MT-V5-OSR03
Movement/dance evidence
Partial / not materially tested
No dance-heavy tape supplied
No direct movement claim failure, but physical advice needs boundary
A02–A03
F11
P1
MT-V5-OSR04
Scene-to-song integration
Partial fail
Integration praised in A01/A03/A04 but often broad
Transition claims lack concrete transition evidence
A01, A03, A04
F02, F04
P0
MT-V5-OSR05
Timestamp density and distribution
Fail
A01 has 2; A02/A04 have 3; A03 has 4
Clearly below 5–8 target for assessable 3–5 minute MT outputs
A01–A04
F04
P0
MT-V5-OSR06
Headline / casting insight specificity
Fail
“emotionally connected”, “recall-worthy”, “highly castable”
Transferable headline language
A01–A04
F01, F08
P0
MT-V5-OSR07
Strengths / improvements / fix-first specificity
Partial fail
Some concrete beats; many generic strengths
Strengths over-rely on broad vocal/acting praise
A01–A04
F01, F02, F03
P0
MT-V5-OSR08
Next-take plan boundary
Partial fail
A02 physical sip; A03 squats/wall exercise
Rehearsal vs recorded-take boundary partly present but inconsistent
A02–A03
F11
P1
MT-V5-OSR09
Self-tape assessability
Partial pass
Audio/framing comments visible
Presentation sometimes drifts into polish
A01–A04
F10
P1
MT-V5-OSR10
Brief / no-brief consistency
Fail
A02 brief-driven mode vs “No brief” technical signal
Critical contradiction
A02
F05
P0
MT-V5-OSR11
Fixed material versus choice material
Fail
A02 recommends less-used alternative song
Alternative repertoire leak
A02
F07
P0
MT-V5-OSR12
Role-fit / callback / workshop claim scope
Fail
“recall-worthy”; “strong callback potential”; “highly castable… workshops”
Finished-tape overclaim
A01, A02, A03, A04
F08
P0
MT-V5-OSR13
Accessibility / anti-polish boundary
Partial fail
“polished”, “professional”, neutral background notes
Resource/polish boundary not tight enough
A01–A04
F10
P1
MT-V5-OSR14
Display-label protection
Partial pass
Acting and Vocal visible where expected
Negative cases not supplied
A01–A04
P01, F12
P1
MT-V5-OSR15
Comparison/export parity verification
Not auditable
No comparison/export parity artefacts
Missing artefacts
All
F12
P1
MT-V5-OSR16
Verdict/readiness consistency
Fail
A02 Strong/send with confidence + “WHY THIS ISN’T READY”
Readiness contradiction
A02
F06
P0
MT-V5-OSR17
Style/subtype conditionality
Partial fail
“contemporary legit” appears, sometimes useful
Style labels often lack phrase/style evidence
A02–A04
F03
P1
7. Prohibited Pattern Audit
Prohibited pattern ID
Pattern found?
Exact output phrase / behaviour
Artefact ID / section
Why it fails
Required replacement evidence type
Severity
Related issue ID(s)
MT-V5-OSP01
Yes
“emotionally connected”; “emotional depth”; “emotionally intelligent”
A01–A03
Broad feeling claim without lyric/beat evidence
Lyric/phrase/beat, addressee, vocal dynamic serving story
High
I01, I03
MT-V5-OSP02
Yes
“grounded and natural”; “grounded acting”
A01, A04
Generic acting praise
Specific beat, action, eyeline, relationship, thought shift
High
I01
MT-V5-OSP03
Yes
“strong acting”; “well-connected and engaging” equivalents
A02–A03
Generic acting claim
Exact line/beat/reaction evidence
Medium
I01
MT-V5-OSP04
Yes
“strong vocal control”; “great control”
A01, A03, A04
Technique claim not tied enough to lyric/story
Register/phrase/diction evidence serving story
High
I03
MT-V5-OSP05
Yes
“technically excellent”
A02 song note
Overbroad vocal-performance praise
Named technical detail and dramatic function
High
I03
MT-V5-OSP06
Yes
“smooth” / “clean” transition
A02, A03
Transition praise lacks transition-moment detail
Scene-to-song trigger, beat, continuity evidence
Medium
I01
MT-V5-OSP07
Yes
“captures warmth”; “warmth and wit”
A01–A04
Character-trait summary without sufficient observable behaviour
Line, reaction, timing or vocal/physical choice
Medium
I01
MT-V5-OSP08
Yes
“captures wit”
A01, A03, A04
Needs exact timing/line evidence
Specific comic beat/timing/response
Medium
I01
MT-V5-OSP09
Yes
“great storytelling”; “clear and compelling story”
A01, A03
Story claim lacks lyric/phrase evidence
Lyric/phrase/beat/action evidence
High
I01
MT-V5-OSP10
Partial
“clear character” equivalents
A02–A04
Character fit often relies on brief/world assumptions
Brief quote + observed behaviour
Medium
I07
MT-V5-OSP11
Yes
“acting-through-song is a real highlight”
A01
Direct ATS claim without lyric evidence
Lyric/action/relationship evidence
High
I01
MT-V5-OSP12
Yes
“superb vocal performance”; “very strong vocal performance”
A01–A03
Generic vocal claim
Style/phrase/register/story evidence
High
I03
MT-V5-OSP13
Yes
“confident”
A01, A04
Vague performance quality
Observable stillness, pace, eyeline, score/task handling
Medium
I01
MT-V5-OSP14
Yes
“professional”; “polished”; “flawless”
A01–A04
Can reward polish/resource or overstate compliance
Assessability or explicit instruction evidence only
High
I07, I09
MT-V5-OSP15
Not explicit
“strong presence”
Not found
No visible exact pattern
N/A
Low
N/A
MT-V5-OSP16
Yes
“great energy”; “specific energy”
A03
Generic unless anchored
Specific physical/vocal/timing behaviour
Medium
I01
MT-V5-OSP17
Yes
“good breath control”; “secure pitch”
A02
Useful only if tied to story/style
Phrase where breath/pitch supported lyric
Medium
I03
MT-V5-OSP18
Yes
“lovely tone”; “beautiful, clear legit tone”
A02–A04
Style praise not enough by itself
Style cue and dramatic function
Medium
I03
MT-V5-OSP19
Not found
“good movement”; “good musicality”
Not found
No direct issue in supplied outputs
N/A
Low
N/A
MT-V5-OSP20
Yes
“recall-worthy”
A01 headline
Live-room/casting outcome overclaim
Present-tape evidence only
High
I13
MT-V5-OSP21
Yes
“strong callback potential”
A03 headline
Callback prediction unsupported by finished tape
Present-tape evidence only
High
I13
MT-V5-OSP22
Yes
“Highly castable for… workshops”
A04 headline
Castability/workshop claim overreaches
Brief-bounded material/style fit only
High
I13
MT-V5-OSP23
Yes
“perfect submission”; “Perfect adherence”; “flawlessly”; “all instructions were met”
A02–A04
Overconfident compliance; A02 contradicts itself
List supplied instructions and observed compliance only
Critical in A02; High elsewhere
I07, I09
MT-V5-OSP24
Yes
“Tape runs 246s; brief asks for under 240s”
A02 risk
Unsupported and contradicted by technical signal
Explicit brief time limit required
Critical
I07, I09
MT-V5-OSP25
Yes
“Side 1 (pg. 85-87)”
A03 component note
False-specificity risk unless brief data proves it
Supplied side/page evidence
Medium
I07
MT-V5-OSP26
Yes
“less-used alternative in your book”
A02 improvement
Alternative repertoire leak in submitted-material review
Improve submitted material unless choice-material context explicitly allows
High
I06
MT-V5-OSP27
Yes
“polished”, “highest possible audio quality”, “professional standard”
A02–A03
Production/resource-polish risk
Assessability and audio balance only
Medium
I03, I09
MT-V5-OSP28
Not found as direct appearance/social/access claim
Body/type, appearance, social media, access deficit, paid support
Not found
No visible direct unsafe pattern
Continue testing with edge cases
Low
N/A
8. Allowed Evidence Anchor Audit
Evidence anchor ID
Evidence type
Found in outputs?
Where used well
Where missing
Claim needing anchor but lacking it
Related rule ID(s)
Related finding ID(s)
MT-V5-OSA01
Exact lyric or phrase
Partial
A02 “quick swig” improvement
Most song/ATS praise
“emotional connection”, “storytelling”, “acting-through-song”
OSR01, OSR02
F02, F03
MT-V5-OSA02
Beat change
Yes
A02 “quick swig”; A03 01:25; A04 00:12/0:15
Not used in headlines or song notes
“captures warmth”, “grounded acting”
OSR01, OSR07
F01
MT-V5-OSA03
Objective / action
Partial
A01 next-take transition question; A02 lyric monologue exercise
Current evaluative claims
“clear and compelling story”
OSR01
F02
MT-V5-OSA04
Addressee / relationship target
Partial
A03 off-screen reader; A02 monologue exercise
Song-specific claims
“emotional connection to lyrics”
OSR01
F02
MT-V5-OSA05
Focus / eyeline shift
Partial
A03 focused eyeline; A04 eyes active
Headlines/strengths rarely use it
“strong connection”
OSR06, OSR07
F01
MT-V5-OSA06
Breath/pause/dynamic serving story
Partial
A01 final chorus build; A02 breath support
Often technical-only
“strong vocal control”
OSR02
F03
MT-V5-OSA07
Register/style event serving lyric/story
Partial
A04 higher register; A02 contemporary legit
Story function often missing
“lovely tone”, “legit vocals”
OSR02, OSR17
F03
MT-V5-OSA08
Diction / text clarity moment
No / weak
None clearly material-specific
Vocal category
“strong vocal performance”
OSR02
F03
MT-V5-OSA09
Scene-to-song transition moment
Partial
A01 improvement names transition; A03 claims transition
Often broad, no exact moment
“Excellent scene-to-song transition”
OSR04
F02, F04
MT-V5-OSA10
Movement / choreography moment
Not materially tested
None
No dance-heavy artefact
Movement advice not strongly applicable
OSR03
F11
MT-V5-OSA11
Full-body/task visibility
Partial
Framing notes visible
Dance/movement claims absent
Not a core failure here
OSR03, OSR09
F10
MT-V5-OSA12
Audio/accompaniment balance
Yes
A01, A03, A04 audio notes
A03 “highest possible quality” drifts into polish
Track quality advice
OSR09, OSR13
F10
MT-V5-OSA13
Technical assessability
Yes
Lighting/framing/audio notes
Often becomes “professional”/“polished”
Presentation claims
OSR09, OSR13
F10
MT-V5-OSA14
Brief instruction explicitly supplied
Partial
A04 full brief signal; A01 close-up mentioned
A02 contradiction; A03 page/side unsupported from artefact
Perfect/flawless adherence
OSR10
F05, F09
MT-V5-OSA15
Fixed-material requirement explicitly supplied
Not auditable
Not enough brief text
A02 alternative repertoire context
Alternative-song advice
OSR11
F07
MT-V5-OSA16
No-brief limitation
Fail in A02
Technical signal says no brief
Report does not honour it
Brief-driven scoring and risk claim
OSR10
F05
MT-V5-OSA17
Access/adaptation context
Not auditable
No access example
Access handling unknown
N/A
OSR13
F12
MT-V5-OSA18
Live redirection actually shown
No
None
Callback/recall/workshop claims
“recall-worthy”, “callback potential”, “workshops”
OSR12
F08
MT-V5-OSA19
Verdict/cap trace
Partial proxy only
Proxy audio-cap examples
No live cap trace
A02 readiness contradiction needs trace
OSR16
F06, F12
MT-V5-OSA20
Display parity evidence
Not auditable
No JSON/comparison/export
All parity claims
Label/export/comparison parity
OSR15
F12
9. Timestamp Density and Distribution Audit
Artefact ID
Tape duration if shown
Timestamp count
Format valid?
Chronological?
Acting timestamp present?
Song/vocal timestamp present?
Integration/style timestamp present?
Strength timestamp present?
Improvement/fix-first timestamp present?
Meets MT-V5 target?
Failure details
Required follow-up
MT-V5-LIVE-A01
Not shown; at least 2:55
2
Partial: 0:45, 2:55
Yes
Yes
Yes
Weak/no
Yes
No
No
Severe underproduction; no fix-first timestamp; no clear integration timestamp
Re-test 5–8 target for assessable MT tapes
MT-V5-LIVE-A02
246s
3
Yes
Yes
Yes
Yes
Weak/partial
Yes
Yes
No
Underproduction for 4:06 tape; no dedicated integration/style timestamp; A02 also has contradiction
Re-test component-balanced timestamp generation
MT-V5-LIVE-A03
At least 3:15
4
Yes
Yes
Yes
Yes
Partial
Yes
Weak/no
No
Under 5-note target; song/story timestamp lacks lyric/phrase specificity
Re-test 5–8 target and lyric-specific song timestamps
MT-V5-LIVE-A04
246s
3
Yes
Yes
Yes
Yes
Partial
Yes
Weak/no
No
Underproduction; no explicit improvement/fix-first timestamp
Re-test timestamp density and integration coverage
Pattern summary: all four artefacts underproduce timestamps relative to the v5 5–8 target for assessable 3–5 minute MT reports. Acting and song are represented, but integration/style and improvement/fix-first coverage are weak. JSON/export timestamp parity is not auditable.
10. Brief / No-Brief and False-Specificity QA
Artefact ID
Brief mode shown
Technical signal / metadata brief status
Contradiction?
Unsupported time-limit claim?
Unsupported page/side/material claim?
Unsupported role/production-world claim?
Unsupported “perfect/flawless/all instructions met”?
Evidence
Severity
Required follow-up
A01
Brief-driven
Brief said to be provided
No visible contradiction
No
Partial: “perfect song choice” depends on choice context
Partial: Tam/brief claims not independently shown
Partial
“perfect choice”, correct sides/accent
Medium
Verify brief anchoring and fixed/choice material handling
A02
Brief-driven
“No brief — baseline rubric”
Yes
Yes
Yes: time limit unsupported by no-brief signal
Yes: Young Tam/brief claims conflict with no-brief signal
Yes
“brief asks for under 240s” vs “No brief”
Critical
P0 brief/no-brief signal alignment and false-specificity re-test
A03
Brief-driven
Not shown
Not auditable
No
Yes risk: “Side 1 (pg. 85-87)”
Partial: leading role / character brief
Yes
“flawlessly adheres to every instruction”
High
Verify page/side and instruction claims with supplied brief/JSON
A04
Brief-driven
“Full brief provided”
No
No
Partial: role musician background / Young Tam depends on brief
Partial but brief appears present
Yes
“perfect adherence”, “strictly to all”
Medium
Re-test overconfident adherence language
11. Fixed-Material and Next-Take QA
Artefact ID
Fixed/submitted-material context?
Alternative-material advice present?
Rehearsal-only distinction clear?
Recorded-take compatibility issue?
Movement/prop/framing risk?
Evidence
Severity
Required follow-up
A01
Unclear
No
Yes for hum exercise
No
No
“Sing the first verse… on a hum”
Low
Preserve rehearsal exercise clarity
A02
Submitted-material context; fixed status unclear
Yes
Partial: “Rehearse…” suggests rehearsal-only
Partial
Yes: physical sip could be unsafe if copied into take
“less-used alternative in your book”; “physically take a sip”
High
Suppress alternative repertoire unless choice-material task; clarify rehearsal-only physical business
A03
Submitted-material context
No alternative song
Yes: practice squats/wall
No if clearly rehearsal-only
Low
“practice singing while doing gentle squats…”
Medium
Ensure exercise is clearly rehearsal-only, not recorded-take advice
A04
Submitted-material context
No
Yes
No
No
“Vocalize… Practice the transition…”
Low
Preserve
12. Role-Fit / Callback / Workshop / Castability QA
Artefact ID
Claim found
Claim type
Supported by supplied brief and observable tape evidence?
Why risky
Safer scope
Severity
Required follow-up
A01
“recall-worthy”
Recall-worthy
No / not auditable
Predicts live-room outcome from finished tape
Present-tape strengths only
High
Suppress recall language unless actual recall context supplied
A02
“dent recall chances”; “May reduce recall chances”
Recall/casting outcome
No; undermined by no-brief contradiction
Speculative casting outcome and false brief risk
Compliance risk only if explicit brief issue proven
Critical
Remove unsupported recall-risk predictions
A03
“strong callback potential”
Callback potential
No / not auditable
Callback prediction from finished tape
Observable readiness in submitted tape only
High
Suppress callback-potential phrase
A04
“Highly castable for contemporary musical theatre workshops”
Highly castable / workshop readiness
No / not auditable
Castability/workshop suitability overclaim
Style/material fit if brief-supported
High
Suppress highly castable / workshop claim
A04
“suits the role’s musician background”
Role fit
Partial / depends on full brief
Requires supplied role evidence
Brief-bounded role note only
Medium
Verify against brief text
13. Presentation, Access and Anti-Polish QA
Artefact ID
Presentation / professional note
Allowed assessability evidence present?
Production-polish or resource-access praise present?
Access/adaptation handled?
Class-coded or appearance-adjacent wording?
Evidence
Severity
Required follow-up
A01
“clean and professional”; “Highly professional”; “comfortable and disciplined”
Partial
Yes
Not applicable
Partial
Background/lighting/framing linked to professional language
Medium
Tighten to assessability and explicit instructions
A02
“feels polished”; “flawless”; “professional standard”
Partial
Yes
Not applicable
Partial
Technical submission “flawless” despite contradiction
High
Block polish as merit; anchor to assessability only
A03
“feels polished and well-prepared”; “highest possible audio quality”
Partial
Yes
Not applicable
Partial
Backing-track quality advice risks resource framing
Medium
Keep audio balance/readability, not highest-resource quality
A04
“neutral background works well”; “Very professional”
Yes, partial
Low / partial
Not applicable
No clear issue
Neutral background note is safe but low-value
Low
Prefer assessability-linked wording
14. Score, Verdict, Cap and Readiness Consistency QA
Artefact ID
Overall score
Verdict label
Readiness language
Risk / blocker language
Cap/threshold evidence supplied
Consistent?
Failure pattern
Severity
Required follow-up
A01
91
Strong for this level
“send with confidence”
No major risk
None
Partial pass
No visible contradiction, but recall overclaim remains
Medium
Verify score trace in JSON
A02
93
Strong for this level
“send with confidence”
“WHY THIS ISN’T READY”; medium risk; recall-risk warning
Conflicting length signals; no JSON
No
Strong verdict/readiness contradicts not-ready section and no-brief signal
Critical
Re-test score/verdict/readiness and signal integration
A03
93
No explicit verdict visible, high confidence
Not shown
No blocker
None
Partial / not fully auditable
No visible readiness contradiction, but callback overclaim
Medium
Supply JSON/rendered full report
A04
89
Strong for this level
“send with confidence”
No blocker
None
Partial pass
No visible contradiction, but castability overclaim
Medium
Verify score trace in JSON
Proxy B8 audio cap
75 expected after cap
Worth another take expected
N/A
Audio cap
Proxy only
Not live-auditable
Useful regression case, not live QA proof
High
Supply actual capped MT output trace
15. Component, Category Label and Display QA
Artefact ID
Acting + song components shown?
Acting category visible?
Vocal category visible?
Component labels clear?
Displayed component weights consistent / non-misleading?
Song-only acting leakage?
Acting-only vocal leakage?
Evidence
Required follow-up
A01
Yes
Yes
Yes
Yes
Partial: 50/50 component weights visible; no JSON to verify relation to field weights
N/A
N/A
Acting Scene + Song; Vocal/Acting visible
Verify JSON/display semantics
A02
Yes
Yes
Yes
Yes
Partial
N/A
N/A
Acting Scene + Song; category breakdown visible
Verify contradictory brief state
A03
Yes
Yes
Yes
Yes
Partial
N/A
N/A
Acting Scene + Song
Verify component weights and field weights
A04
Yes, plus Slate
Yes
Yes
Partial
Partial: Slate 10% shown; ensure non-misleading against MT field weights
N/A
N/A
Acting Scene 40 / Song 50 / Slate 10
Verify slate component display and scoring semantics
Protected MT anchor status: visible component breakdown, Acting category and Vocal category are preserved in all supplied MT artefacts. The failures are wording, timestamp density, contradiction handling and overclaim control, not component visibility.
16. Comparison Page / Renderer / Export Parity QA
Surface
Artefact supplied?
Status
What was checked
What could not be checked
Required artefact for future QA
Priority
Raw JSON
No
Not auditable
None
Persisted scores, timestamps, labels, role_fit_modifier, technical signals
Raw report JSON for each output
P0
Rendered page
Partial PDF-like capture
Partial
Visible report wording and labels
Live page behaviour beyond captured PDF
Rendered page screenshots
P1
PDF/export
Yes, partial
Partial
PDF/report text
Export parity against rendered page
Paired rendered page + PDF/export
P1
Comparison page
No
Not auditable
None
Comparison labels, scores, component parity
Comparison page screenshot/export
P1
Timestamps
PDF only
Partial
Visible count/order
JSON/export parity
JSON + rendered + export
P0
Scores
PDF only
Partial
Visible scores and verdict text
Recalculation trace
Raw JSON / scoring trace
P0
Labels
PDF only
Partial
Visible Acting/Vocal labels
Frontend label helper and comparison labels
Rendered + JSON + comparison
P1
Component breakdown
PDF only
Partial pass
Components displayed
Detection source and persisted components
Raw JSON
P1
Category notes
PDF only
Fail/partial
Genericity audited
Locked evidence source
Raw JSON / report object
P1
Role-fit display
No modifier shown
Not auditable
Role-fit wording only
Modifier value and suppression
JSON + rendered role-fit section
P1
Feedback reliability
PDF only
Partial fail
Reliability label text
Underlying confidence logic
JSON + signal trace
P0
Technical signals
A02/A04 visible
Partial fail
A02 contradiction found
Hidden signal pipeline
JSON + technical signal block
P0
17. Live Output Finding Register
Finding ID
Finding title
Artefact ID(s)
Evidence phrase / behaviour
Related OSR ID(s)
Related OSP ID(s)
Related LQA ID(s)
Severity
Release-sign-off impact
Required follow-up
MT-V5-LIVE-F01
Recurring generic headline and category language
A01–A04
“emotionally connected”, “strong”, “grounded”, “polished”
OSR06, OSR07
OSP01–OSP18
LQA02, LQA18
High
Patch verification required
Generic praise suppression re-test
MT-V5-LIVE-F02
Acting-through-song claims lack lyric/phrase evidence
A01–A04
“acting-through-song is a real highlight”; “storytelling”
OSR01, OSR04
OSP09, OSP11
LQA22
High
Patch verification required
Require lyric/phrase/beat anchor
MT-V5-LIVE-F03
Vocal feedback remains technique-heavy / generic
A01–A04
“strong vocal control”, “secure pitch”, “lovely tone”
OSR02, OSR17
OSP04, OSP12, OSP17, OSP18
LQA02
High
Patch verification required
Tie vocal technique to lyric/story/style
MT-V5-LIVE-F04
Timestamp underproduction across all MT outputs
A01–A04
2–4 timestamps on multi-component MT reports
OSR05
N/A
LQA22
High
Patch verification required
Re-test 5–8 target and component spread
MT-V5-LIVE-F05
Critical brief/no-brief contradiction
A02
“Brief-driven mode” vs “No brief”
OSR10
OSP24
LQA15, LQA19
Critical
Blocker
Align mode, technical signals and wording
MT-V5-LIVE-F06
Verdict/readiness contradiction
A02
Strong / “send with confidence” plus “WHY THIS ISN’T READY”
OSR16
OSP23, OSP24
LQA13
Critical
Blocker
Re-test readiness and risk logic
MT-V5-LIVE-F07
Alternative repertoire leak
A02
“less-used alternative in your book”
OSR11
OSP26
LQA21
High
Patch verification required
Suppress in fixed/submitted-material reports
MT-V5-LIVE-F08
Callback/recall/workshop/castability overclaims
A01–A04
“recall-worthy”, “strong callback potential”, “highly castable”
OSR12
OSP20–OSP22
LQA23
High
Patch verification required
Bound to present-tape evidence only
MT-V5-LIVE-F09
Unsupported or overconfident brief adherence claims
A02–A04
“perfect”, “flawless”, “all instructions were met”
OSR10
OSP23, OSP25
LQA20
High
Patch verification required
Require supplied instruction evidence
MT-V5-LIVE-F10
Presentation / polish boundary weak
A01–A04
“polished”, “professional”, “highest possible audio quality”
OSR09, OSR13
OSP14, OSP27
LQA18
Medium
Patch verification required
Tie presentation to assessability only
MT-V5-LIVE-F11
Next-take rehearsal vs recorded-take boundary inconsistent
A02–A03
physical sip; squats/wall exercise
OSR08, OSR03
N/A
LQA21
Medium
Monitor / patch verification
Mark physical exercises as rehearsal-only
MT-V5-LIVE-F12
JSON, comparison and export parity not auditable
All
Missing artefacts
OSR14, OSR15
N/A
LQA01, LQA04, LQA12
High
Blocks full release sign-off
Supply JSON, comparison and export parity artefacts
MT-V5-LIVE-F13
Protected MT component visibility preserved
A01–A04
Acting + Song, Acting and Vocal visible
OSR14
N/A
LQA05–LQA09
Low / pass confirmation
Preserve
Keep MT anchor protected
18. Live Output Blocker Register
Blocker ID
Blocker title
Why it blocks release sign-off
Evidence
Related finding ID(s)
Related LQA ID(s)
Required condition to clear
Priority
MT-V5-LIVE-B01
Brief/no-brief contradiction
A report cannot be both brief-driven and no-brief baseline without undermining reliability
A02: brief-driven mode plus technical signal “No brief”
F05
LQA15, LQA19
Mode and technical signals must align in output and JSON
P0
MT-V5-LIVE-B02
Verdict/readiness contradiction
Strong/send-with-confidence language conflicts with “WHY THIS ISN’T READY”
A02: Strong verdict, send with confidence, not-ready/risk section
F06
LQA13
Readiness, risk, verdict and cap language must be internally consistent
P0
MT-V5-LIVE-B03
Repeated prohibited generic MT praise
The supplied outputs repeatedly fail the v5 specificity benchmark
A01–A04 generic headline/category/strength language
F01, F02, F03
LQA02, LQA22
Output must anchor MT praise to lyric/phrase/beat/style/component evidence
P0
MT-V5-LIVE-B04
Timestamp underproduction
All supplied multi-component outputs fall below target density
A01: 2; A02: 3; A03: 4; A04: 3
F04
LQA22
Clearly assessable 3–5 minute MT outputs should produce 5–8 useful notes
P0
MT-V5-LIVE-B05
Callback/castability overclaims
Finished tapes must not infer live-room/casting outcomes
A01, A03, A04
F08
LQA23
Suppress recall/callback/castability/workshop claims unless directly supported
P0
MT-V5-LIVE-B06
Missing parity artefacts
Full release sign-off needs JSON/comparison/export parity
No raw JSON, comparison or export parity supplied
F12
LQA01, LQA04, LQA12
Supply and pass raw JSON, comparison and export parity checks
P0
19. Required Follow-Up Action Table
Follow-up ID
Action title
Related finding/blocker ID(s)
Follow-up type
What must be checked or supplied
What must not be changed
Priority
MT-V5-LIVE-R01
Re-run MT output-specificity after patch enforcement
F01–F04, B03–B04
Live-output QA rerun
New MT outputs for acting+song with brief and no brief
No score fields, weights, caps, schema or pipeline
P0
MT-V5-LIVE-R02
Brief/no-brief consistency verification
F05, B01
Output-rule verification
Output and JSON must agree on brief mode / no-brief mode
No role-fit bounds or verdict thresholds
P0
MT-V5-LIVE-R03
Readiness/verdict consistency verification
F06, B02
Score/verdict trace verification
Strong/Ready/Not-ready/risk/cap language must align
No threshold or cap changes
P0
MT-V5-LIVE-R04
Timestamp density and component-spread verification
F04, B04
Output-rule verification
5–8 notes on assessable 3–5 min MT; acting + song + integration/style spread
Max 8 timestamp cap preserved
P0
MT-V5-LIVE-R05
Generic MT praise suppression test
F01–F03, B03
Output-rule verification
Prohibited phrases replaced or anchored to evidence
No rubric rewrite
P0
MT-V5-LIVE-R06
Fixed/submitted-material boundary test
F07
Output-rule verification
No alternative repertoire advice unless choice-material context supports it
No material-policy weakening
P0
MT-V5-LIVE-R07
Callback/castability/workshop scope test
F08, B05
Output-rule verification
No recall/callback/castability/workshop claims from single finished tape
No role-fit bound changes
P0
MT-V5-LIVE-R08
Presentation/anti-polish verification
F10
Output-rule verification
Presentation notes must be assessability or instruction-based
No production polish or class-coded reward
P1
MT-V5-LIVE-R09
Raw JSON package required
F12, B06
JSON artefact required
Raw report JSON for each tested MT output
No JSON structure changes proposed
P0
MT-V5-LIVE-R10
Comparison-page artefact required
F12, B06
Comparison artefact required
Comparison page screenshot/export
No UI mechanism proposal
P1
MT-V5-LIVE-R11
Render/export parity package required
F12, B06
Export artefact required
Rendered report + PDF/export pair
No renderer mechanism proposal
P1
MT-V5-LIVE-R12
Display-label verification
F13, F12
Display-label verification
Vocal visible with singing; Acting visible with spoken acting; negative song-only/acting-only tests
No label schema change proposed
P1
MT-V5-LIVE-R13
Access-adapted MT test
F12
Live-output QA rerun
Access/adaptation artefact to test non-deficit handling
No access penalty or diagnostic claims
P1
MT-V5-LIVE-R14
Audio-cap/verdict regression test
F12
Score/verdict trace verification
Live capped MT output or trace using audio 50–59 cap
No cap/threshold changes
P0
20. MT Live Output QA Decision
Decision: Current MT live outputs fail MT-V5 output-specificity QA.
The supplied outputs preserve the historic MT structural anchor: Acting and Song components are shown, Vocal remains visible where singing exists, and Acting remains visible where spoken acting exists. That part can remain protected and closed.
The outputs fail the later v5 standard on enforcement. The main failures are repeated generic MT praise, weak acting-through-song anchoring, vocal feedback that remains technique-heavy or broad, underproduced timestamps across all supplied multi-component reports, unsupported callback/recall/workshop/castability claims, a fixed/submitted-material alternative-repertoire leak, and one critical brief/no-brief contradiction with readiness inconsistency.
Critical blockers:
MT-V5-LIVE-B01: brief/no-brief contradiction.
MT-V5-LIVE-B02: verdict/readiness contradiction.
MT-V5-LIVE-B03: repeated generic MT praise.
MT-V5-LIVE-B04: timestamp underproduction.
MT-V5-LIVE-B05: callback/castability overclaims.
MT-V5-LIVE-B06: missing JSON/comparison/export parity artefacts for full release sign-off.
What can remain closed:
MT source research.
MT synthesis.
MT gap audit.
MT revised rubric slice.
MT final audit decision.
MT weights and six-field structure.
What must be corrected or verified before release:
Output-specificity enforcement.
Brief/no-brief signal consistency.
Verdict/readiness/risk consistency.
Timestamp density and component distribution.
Generic phrase suppression.
Callback/recall/workshop/castability suppression.
Fixed-material / alternative-material boundary.
JSON, comparison and export parity.
MT can proceed into cross-branch implementation planning only as a failing QA evidence package with P0 requirements. MT cannot proceed to production release sign-off from the supplied outputs.
21. Reusable Handoff Pack for Implementation Planning / QA Rerun
The Musical Theatre live-output QA reviewed four current PDF/report artefacts: MT-V5-LIVE-A01 “Hannah” score 91, MT-V5-LIVE-A02 “Test” score 93 with a brief/no-brief contradiction, MT-V5-LIVE-A03 “Test” score 93 with callback/page-side claims, and MT-V5-LIVE-A04 “test” score 89 with castability/workshop language. All four preserve the core MT component structure: Acting Scene and Song are displayed, Vocal remains visible where singing exists, and Acting remains visible where spoken acting exists. The stabilised MT anchor is therefore still present in the supplied artefacts.
The outputs nevertheless fail MT-V5 output-specificity QA. The main repeated failures are generic MT praise, unanchored acting-through-song claims, broad vocal praise, timestamp underproduction, and overconfident live-room/casting claims. Examples include “recall-worthy”, “strong callback potential”, “highly castable”, “emotionally connected”, “strong vocal control”, “grounded acting”, “technically excellent”, “perfect submission”, and “flawlessly adheres”. These phrases often appear without lyric-, phrase-, beat-, style-, addressee-, transition- or component-specific evidence.
The most serious artefact-level failure is MT-V5-LIVE-A02. It is labelled “Brief-driven mode” while its technical signals say “No brief — baseline rubric”. It also shows Strong for this level and “send with confidence” while displaying “WHY THIS ISN’T READY” and a medium casting-compliance risk based on an unsupported 246s/240s time-limit claim. This creates both brief/no-brief and readiness/verdict contradictions.
Timestamp density is a cross-output problem. A01 has 2 notes, A02 has 3, A03 has 4, and A04 has 3. For assessable multi-component MT reports around 3–5 minutes, the MT-V5 target is 5–8 notes with coverage across acting, song and integration/style where possible. None of the four supplied outputs meets that target.
Required follow-up is P0: re-run MT outputs after output-rule enforcement, supply raw JSON for each report, provide comparison-page artefacts, provide rendered/export parity artefacts, and verify score/verdict/cap consistency. Additional tests must cover no-brief MT, fixed-material MT, song-only and acting-only negative cases, access-adapted MT, callback/castability suppression and timestamp parity. The MT source/revision branch remains closed; the open work is output enforcement and live QA, not new research or rubric rewrite.
22. Completion Statement
MT-V5-LIVE-OUTPUT-QA complete. Current Musical Theatre outputs fail MT-V5 output-specificity QA and require the listed output-rule corrections before release sign-off.

---

## Links

- **Previous:** [[drr-mt-13-v5-output-spec-patch]] — V5 Output-Spec Patch
- **Next:** [[drr-mt-15-v5-maturity-audit]] — V5 Maturity Audit
- **Thread overview:** [[drr-mt-overview]]
- **Programme:** [[drr-programme-overview]]
