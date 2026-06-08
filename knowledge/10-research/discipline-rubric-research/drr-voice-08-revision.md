---
id: drr-voice-08-revision
title: Voice — Synthesis Revision
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/4.Voice/VOICE-REV.md"
discipline: commercial
monday_ref: null
tags: [discipline-rubric-research, commercial, stage-revision, voice]
confidence: medium
created: 2026-05-05
imported: 2026-06-08
updated: 2026-06-08
---

# Voice — Synthesis Revision

> **Imported research — Discipline Rubric Research programme.** Step 8 of 12 in the Voice thread (`stage-revision`). Original file: `4.Voice/VOICE-REV.md`. Original date: 2026-05-05 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-voice-overview]].

---

1. VOICE-REV Readiness Check
Check
Status
Caveat
VOICE-SYN handoff present
yes
Supplied in prompt.
VOICE-AUDIT handoff present
yes
Supplied in prompt.
Current Voice / Singing baseline slice present
yes
Supplied in prompt.
Baseline-control context present
yes
0A–0E and report-polish / report-quality summaries supplied previously.
VOICE-AUDIT issue IDs present
yes
VOICE-AUDIT-I01–I20.
VOICE-AUDIT recommendation IDs present
yes
VOICE-AUDIT-R01–R21.
Source IDs VOICE-S001–VOICE-S052 preserved
yes
Used as source range; no renumbering.
VOICE-SYN-F01–F17 preserved
yes
Used as synthesis basis.
MT protected anchor context present
yes
MT acting + song flow remains protected.
Acting / Dance label-risk context present
yes
Acting speech-delivery and Dance no-singing label protections preserved.
Live Song / Voice outputs supplied
no
Live-output QA remains pending.
VOICE-REV may proceed
yes
Revision can proceed as baseline/rubric refinement only.
2. Revision Input Register
Input item
Type
Present?
Used in revision?
Role in revision
Limitation / note
VOICE-SYN handoff
Evidence synthesis
yes
yes
Source-led basis for revision
Summary-level handoff, not full source ledger.
VOICE-AUDIT handoff
Gap audit
yes
yes
Controls issue and recommendation implementation
Full audit output not pasted, but compact issue/recommendation map supplied.
Current Voice / Singing baseline slice
Baseline slice
yes
yes
Object under revision
Compact slice only.
0A–0E baseline guardrails
Baseline-control context
yes
yes
Protects architecture, scoring and MT anchor
Previously supplied.
Report-Polish.Server.ts / Report-quality.server.ts
Implementation-control excerpts
yes
yes
Confirms locked evidence, timestamp preservation and deterministic scrubs
Used as baseline-control only, not implementation target.
Completed MT, Dance and Acting summaries
Non-regression context
yes
yes
Preserves cross-discipline label and flow protections
Not reopened.
Live Song / Voice outputs
Live output examples
no
no
Would support rendered behaviour checks
Pending for later live QA.
3. Revision Scope and Non-Scope
This revision covers Voice / Singing baseline wording, evidence requirements, claim-scope rules, safety/fairness guardrails, style/subtype boundaries, generic-feedback suppression, material-policy handling and report-behaviour expectations inside the current six-field TapeCoach architecture.
This revision does not cover backend implementation, schema changes, score-field changes, weighting changes, cap/blocker/verdict changes, role-fit bound changes, server-side recomputation changes, frontend label implementation, comparison-page rendering, PDF/export behaviour, live-output QA or product rollout.
Out of scope because of production guardrails: adding a musical-interpretation score field, renaming operational score fields, adding a vocal-health score, adding formal subtype rubrics that require schema changes, importing external exam marks, and changing the MT acting + song flow.
Pending because no live Song / Voice outputs were supplied: live report quality, rendered category labels, comparison-page parity, timestamp rendering parity, score stability and production-output non-regression.
Preserve without change: six score fields, Song and MT weights, Step 1 / Step 2 pipeline, locked-field enforcement, deterministic scrubs, maximum 3 strengths, maximum 3 improvements, maximum 8 timestamped notes, material-policy guardrails, safety/accessibility scrubs, server-side recomputation and MT acting + song stability.
4. Audit Recommendation Implementation Matrix
Recommendation ID
Title
Audit classification
VOICE-REV handling
Issue ID(s)
SYN ID(s)
Source basis
Baseline area
Change ID(s)
Section ID(s)
Reason / non-regression
Final-audit watch
VOICE-AUDIT-R01
Clarify sung-vocal field semantics
implement
yes
I01, I20
F01
S001–S052
Field semantics
C02, C16
S02, S17
Clarifies meaning without renaming fields.
Label containment.
VOICE-AUDIT-R02
Require vocal-plus-interpretive Song evidence
implement
yes
I02
F02
S001–S031, S035–S040
Song evidence standard
C03
S03, S05
Strengthens Song within existing weights.
Technique/story balance.
VOICE-AUDIT-R03
Expand descriptor specificity
implement
yes
I03, I17
F03, F16
S021–S031
Vocal technique wording
C04
S04, S15
Adds observable descriptors, not external marks.
Genericity.
VOICE-AUDIT-R04
Preserve song-framed acting-through-song
implement
yes
I04
F04
S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
Acting/storytelling
C05
S05
Blocks acting-scene leakage.
Song-only containment.
VOICE-AUDIT-R05
Make musical interpretation visible without new field
implement
yes
I05
F02, F03
S021–S031, S035–S041
Category notes / report prose
C05
S06
Uses existing vocal/acting/storytelling fields.
No new score field.
VOICE-AUDIT-R06
Add cautious style/subtype handling
implement
yes
I06
F05, F06
S001–S020, S021–S031, S035–S041
Style handling
C06
S07
Allows supported labels only.
Overclaim.
VOICE-AUDIT-R07
Limit belt/mix/registration claims
suppress conditionally / defer
suppress conditionally
I07
F06
S013, S014, S035, thin evidence
Style handling
C06
S07, S18
Permit only when clearly observable; no detailed rubric.
Thin evidence.
VOICE-AUDIT-R08
Separate assessability from vocal merit
implement
yes
I08
F07, F08
S003, S005, S008, S011, S013, S023, S024, S027, S032–S041
Audio/technical
C07
S09
Keeps audio/technical as assessability.
Polish drift.
VOICE-AUDIT-R09
Block polish/resource as vocal merit
implement
yes
I08, I20
F13
S033, S040, S041, S047–S051
Presentation/fairness
C07
S10
Production finish not talent.
Class/resource bias.
VOICE-AUDIT-R10
Treat accompaniment as context-specific
implement
yes
I09
F09
S001–S020, S026, S027, S039–S041
Accompaniment
C08
S08
No universal accompaniment rule.
Context overreach.
VOICE-AUDIT-R11
Block live-room/process overclaim
implement
yes
I10
F10
S001, S004, S006, S015–S017, S021–S031, S033, S037, S039–S041
Claim scope
C09
S12
Finished tape cannot prove process capacities.
Overclaim.
VOICE-AUDIT-R12
Codify no-diagnosis vocal-health language
implement
yes
I11
F11
S043–S046
Safety
C10
S13
Observation-only vocal-health wording.
Medical overclaim.
VOICE-AUDIT-R13
Codify access-safe inclusive voice handling
implement
yes
I12
F12, F13
S046–S051
Accessibility
C11
S14
Access is context, not deficit.
Bias.
VOICE-AUDIT-R14
Block accent hierarchy and speech-difference deficit inference
implement
yes
I13
F12
S050
Diction/fairness
C11
S14
Intelligibility without accent prestige.
Accent bias.
VOICE-AUDIT-R15
Block gendered voice/body/voice-type overclaim
implement
yes
I14
F12
S049, S043, S050
Role fit / safety
C11
S14
Prevents identity/body inference.
Protected traits.
VOICE-AUDIT-R16
Strengthen repertoire and fixed-material boundaries
implement
yes
I15, I16
F05, F14, F15
S001–S020, S035–S040
Material policy
C12
S11
Keeps source-specific rules contextual.
False specificity.
VOICE-AUDIT-R17
Suppress generic vocal praise unless evidence anchored
implement
yes
I17
F16
S021–S031 plus 0D
Report specificity
C13
S15
Requires phrase/timestamp/material anchors.
Generic filler.
VOICE-AUDIT-R18
Strengthen timestamp and next-take specificity
implement
yes
I18
F17
0D, Report-quality baseline
Timestamps / next take
C14
S16
Uses existing timestamp cap and locked evidence.
Timestamp density.
VOICE-AUDIT-R19
Carry display/render checks into output-spec
defer to output-spec
defer
I19
F17
Baseline guardrails
Display/rendering
C15
S17, S18
Not a baseline wording fix alone.
Output-spec must verify.
VOICE-AUDIT-R20
Preserve cross-discipline label non-regression
preserve only / implement guardrail
preserve only + guardrail
I01, I20
F01, F17
Cross-branch context
Non-regression
C16
S17
Protects MT, Acting and Dance semantics.
Cross-type labels.
VOICE-AUDIT-R21
Preserve Step 2 locked-evidence and scrub strengths
preserve only / implement guardrail
preserve only + guardrail
I17, I18
F16, F17
Report-polish / quality snippets
Evidence discipline
C17
S01, S15, S16
Does not alter implementation; reinforces baseline rule.
Step 2 invention.
5. Revision Change Register
Change ID
Change title
What changed
What did not change
Related recs
Issues
SYN findings
Source basis
Compatibility / non-regression
Sections
Final-audit watch
VOICE-REV-C01
Baseline fit and locked architecture preserved
Added explicit live-production and six-field preservation language.
No architecture, schema or scoring change.
R20, R21
I19, I20
F01, F17
Baseline materials
Compatible; protects MT anchor and locked Step 2.
S01
Accidental architecture drift.
VOICE-REV-C02
Sung-vocal semantics clarified
Clarified vocal as sung-vocal evidence in Song / MT.
Field name and weight unchanged.
R01, R20
I01, I20
F01
S001–S052
Compatible; protects Acting/Dance proxy containment.
S02, S17
Label semantics.
VOICE-REV-C03
Vocal-plus-interpretive Song standard added
Made Song evidence require vocal and interpretive observations where assessable.
Acting/storytelling remains supporting, not new field.
R02
I02
F02
S001–S031, S035–S040
Compatible; preserves Song weights.
S03
Technique-only drift.
VOICE-REV-C04
Descriptor specificity strengthened
Added pitch, rhythm, tone, diction, phrasing, communication and interpretation anchors.
No external grade/mark import.
R03, R17
I03, I17
F03, F16
S021–S031
Compatible; wording/evidence only.
S04, S15
Generic descriptors.
VOICE-REV-C05
Song-framed acting-through-song and musical interpretation
Added song-native lyric, addressee, objective, phrase and arc evidence rules.
No acting-scene category or new musical-interpretation field.
R04, R05
I04, I05
F02, F04
S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
Compatible; protects song-only outputs.
S05, S06
Scene-language leakage.
VOICE-REV-C06
Style/subtype caution and belt/mix limits
Added supported style map and explicit thin-evidence limits.
No universal style, belt, mix or registration rubric.
R06, R07
I06, I07
F05, F06
S001–S020, S021–S031, S035–S041
Compatible; prevents overclaim.
S07, S18
Style overreach.
VOICE-REV-C07
Assessability, audio and anti-polish boundary
Separated audio/technical readability from vocal merit; blocked polish/resource merit.
Audio/technical fields unchanged.
R08, R09
I08
F07, F08, F13
S003, S005, S008, S011, S013, S023, S024, S027, S032–S041, S047–S051
Compatible; supports fairness.
S09, S10
Production polish drift.
VOICE-REV-C08
Accompaniment context handling
Added context-specific treatment for backing tracks, live accompaniment, a cappella and self-accompaniment.
No universal accompaniment requirement.
R10
I09
F09
S001–S020, S026, S027, S039–S041
Compatible; brief/task-led.
S08
Accompaniment overclaim.
VOICE-REV-C09
Live-room/process-only boundary
Blocked overclaims about stamina, direction response, learning speed, musicianship and callback readiness.
No new score or type.
R11
I10
F10
S001, S004, S006, S015–S017, S021–S031, S033, S037, S039–S041
Compatible; tape-observable only.
S12
Process overclaim.
VOICE-REV-C10
Vocal-health no-diagnosis rule
Added observation-only language for strain-like/fatigued/hoarse sound.
No medical advice or health score.
R12
I11
F11
S043–S046
Compatible; safety scrub aligned.
S13
Diagnosis wording.
VOICE-REV-C11
Inclusive voice and anti-bias guardrails
Added access, accent, speech difference, hearing, neurodivergence and gender-diverse voice guardrails.
No hidden scoring or identity inference.
R13, R14, R15
I12, I13, I14
F12, F13
S046–S051
Compatible; guardrail only.
S14
Deficit language.
VOICE-REV-C12
Material and repertoire boundaries
Strengthened fixed-material and source-specific instruction restraint.
Material policy unchanged.
R16
I15, I16
F05, F14, F15
S001–S020, S035–S040
Compatible; prevents false specificity.
S11
Repertoire overreach.
VOICE-REV-C13
Generic praise suppression
Added requirement that substantive praise must attach to observable evidence.
Max strengths/improvements unchanged.
R17
I17
F16
S021–S031, 0D
Compatible; report wording only.
S15
Filler praise.
VOICE-REV-C14
Timestamp and next-take specificity
Added component-aware, phrase-aware and fix-first-linked timestamp/next-take guidance.
Max 8 timestamps unchanged; no timestamp invention.
R18, R21
I18
F17
0D, report-quality baseline
Compatible; preserves locked evidence.
S16
Timestamp density.
VOICE-REV-C15
Display/rendering deferred
Added explicit carry-forward note for display, comparison and rendering checks.
No UI implementation proposal.
R19
I19
F17
Baseline guardrails
Compatible; output-spec later.
S17, S18
Display verification.
VOICE-REV-C16
Cross-discipline label non-regression
Added rules protecting MT Vocal, Acting speech and Dance no-singing semantics.
No field hiding in genuine Song/MT.
R20
I01, I20
F01, F17
Cross-branch context
Compatible; protects completed branches.
S17
Label regression.
VOICE-REV-C17
Step 2 locked-evidence preservation
Reaffirmed Step 2 cannot invent timestamps, evidence, presentation notes, risk flags or role-fit claims.
No implementation change.
R21
I17, I18
F16, F17
Report-polish / quality snippets
Compatible; preserves live architecture.
S01, S15, S16
Step 2 overreach.
6. Revised Voice / Singing Baseline
Section ID
Revised baseline wording
Evidence required
Blocks
Related recommendations
Related SYN findings
Source basis
Non-regression note
VOICE-REV-S01 — Purpose and baseline fit
Voice / Singing assesses whether a song self-tape is submission-ready for the performer’s level, audition type and brief context. It improves sung-vocal and song-interpretation specificity inside the existing TapeCoach structure.
Locked Step 1 evidence, performer level, audition type, brief/material context and timestamped observations where available.
New score fields, new weights, invented observations, Step 2 score/evidence alteration.
R20, R21
F01, F17
Baseline controls, report-polish / quality snippets
Preserves live production architecture.
VOICE-REV-S02 — Field semantics and category meanings
In Song and Musical Theatre, vocal means sung-vocal evidence. In Song, acting means lyric/storytelling/communication through song, not acting-scene performance. Audio and technical are assessability conditions.
Observable sung sound, lyric delivery, communication, audio/video readability and brief/task context.
Singing labels in Acting/Dance-only contexts; acting-scene language in song-only outputs.
R01, R20
F01
VOICE-S001–S052, cross-branch context
Keeps field names and weights unchanged.
VOICE-REV-S03 — Song / Voice evidence standard
A compliant Song report must assess vocal technique and interpretive/song-communication evidence where assessable. Technique-only praise is insufficient.
At least one observable vocal evidence anchor and one lyric/story/communication anchor when material and audio allow.
Reports that only say “good voice”, “secure pitch” or “strong vocal control” without phrase, lyric, timestamp or behaviour evidence.
R02
F02
VOICE-S001–S031, S035–S040
Preserves Song vocal-centred weighting.
VOICE-REV-S04 — Vocal technique evidence
Vocal technique language must use observable descriptors such as pitch/intonation, rhythm/time, tone/tonal quality, diction/intelligibility, phrasing/shape, dynamic control, range exposure and breath/phrase management where supported.
Specific moment, phrase, timestamp, register/line demand or audible change.
Generic “technically excellent”, diagnostic vocal-health wording, unsupported method claims.
R03, R17
F03, F16
VOICE-S021–S031
Uses descriptor language only; no grades or marks.
VOICE-REV-S05 — Lyric storytelling / acting-through-song evidence
Acting/storytelling through song must be song-framed: lyric intention, addressee, objective, phrase action, emotional arc, character communication or relationship to the song’s situation.
Observable lyric/phrase/beat/transition evidence.
Reader, scene-partner, eyeline-to-reader or spoken-scene feedback where no spoken acting exists.
R02, R04
F02, F04
VOICE-S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
Protects song-only outputs from acting-scene leakage.
VOICE-REV-S06 — Musical interpretation inside existing fields
Musical interpretation should appear through vocal and acting/storytelling wording: phrasing, shape, dynamics, style, musical communication and lyric meaning. It is not a separate score.
Observable phrasing, dynamic choice, tempo/rhythm relationship, lyric emphasis or stylistic communication.
A new musical-interpretation score field; vague “great musicality” without evidence.
R05
F02, F03
VOICE-S021–S031, S035–S041
Preserves six-field model.
VOICE-REV-S07 — Style / subtype handling
Name style/subtype only when brief, material, source context, slate or observable performance supports it. Stronger supported contexts include classical/legit, contemporary MT, classical art song/opera-adjacent, unaccompanied singing, accompanied/backing-track song, audition cuts and MT song in multi-component tapes.
Brief/material evidence, known repertoire context or observable style markers.
Universal style rules; unsupported belt/mix/registration labels; school-specific era rules as global standards.
R06, R07
F05, F06
VOICE-S001–S020, S021–S031, S035–S041
Prevents subtype overclaim.
VOICE-REV-S08 — Accompaniment / backing track / self-accompaniment handling
Treat accompaniment mode as task/context evidence. Balance, audibility and acceptability matter for assessability; access to a better track, pianist or studio must not be scored as vocal merit.
Task requirement, brief instruction, audible balance, visible self-accompaniment or source-supported context.
Universal “must use backing track/live pianist” rules; rewarding paid accompanist or professional track access.
R10
F09, F13
VOICE-S001–S020, S026, S027, S039–S041, S051
Preserves fairness and material-policy context.
VOICE-REV-S09 — Self-tape assessability, audio and technical boundaries
Audio and technical notes should explain whether singing and storytelling are assessable: clear audio, balanced accompaniment, workable acoustics, stable framing and readable capture. These are not vocal merit.
Audio clarity, track/voice balance, room noise/reverb, framing, visibility and recording continuity where observed.
“Clean audio” as vocal quality; weak audio as weak singing unless vocal evidence is fairly assessable.
R08
F07, F08
VOICE-S003, S005, S008, S011, S013, S023, S024, S027, S032–S041
Preserves audio/technical categories.
VOICE-REV-S10 — Professional presentation / anti-polish boundary
Professional presentation in Song / Voice is about submission readability and process, not polish, class-coded setup, expensive kit, paid support, charm, appearance or studio quality. Omit presentation notes if no material value.
Locked evidence that presentation affects readability, compliance or assessability.
“Professional self-tape” as praise for expensive production; home setup/resource limits as deficit.
R09
F13
VOICE-S033, S040, S041, S047–S051, baseline scrubs
Preserves presentation as optional and non-personal.
VOICE-REV-S11 — Material, repertoire and fixed-brief handling
If material is fixed, improve the submitted song only. If material is choice-led, repertoire comments must be brief-aware, source-bounded and evidence-led. Avoid universal rules from school/open-call contexts.
Brief/material instruction, supplied song title, audition context, source-supported task requirement.
Alternative song advice for fixed material; “perfect song choice”; invented song title/cut/time-limit/era rule.
R16
F05, F14, F15
VOICE-S001–S020, S035–S040
Preserves material_policy guardrails.
VOICE-REV-S12 — Tape-observable versus live-room / process-only boundary
Finished song tape can support observable singing, interpretation and assessability. It cannot prove response to direction, learning speed, aural skills, sight-singing, stamina, callback readiness, training potential or broad professional readiness.
Direct tape evidence or explicit process evidence if actually supplied.
Inferring live-room capacities from a finished take.
R11
F10
VOICE-S001, S004, S006, S015–S017, S021–S031, S033, S037, S039–S041
Supports tape-observable-only principle.
VOICE-REV-S13 — Vocal-health safety and no-diagnosis language
Do not diagnose from tape. Strain-like, fatigued, hoarse, pressed or reduced-range sound may be described only as cautious observable sound, with assessability or care-seeking phrased non-diagnostically.
Clear audible evidence and evidence_sufficiency permitting vocal observation.
“Vocal health sounds good/bad”, nodules, reflux, infection, injury, pathology, psychological or respiratory inference.
R12
F11
VOICE-S043–S046
Safety guardrail only; no health score.
VOICE-REV-S14 — Accessibility, accent, speech difference and inclusive voice handling
Access needs, disability, neurodivergence, hearing difference, speech difference, accent, gender-diverse voice, assistive technology and reasonable adjustments are access/fairness context, not deficits. Diction feedback must focus on intelligibility, not accent hierarchy.
Observable communication/audibility evidence plus supplied access context where available.
Accent prestige, gendered voice norms, body/appearance assumptions, access-support penalty, assistive-tech deficit language.
R13, R14, R15
F12, F13
VOICE-S046–S051
Preserves anti-bias protections.
VOICE-REV-S15 — Generic-feedback suppression and evidence anchors
Every substantive strength, improvement, category note and fix-first item must attach to a behaviour, phrase, lyric, timestamp, section, style demand or assessability fact.
Observable evidence anchor, ideally timestamped or material-linked.
Generic vocal praise, generic story praise, unsupported style labels and “technically excellent vocal performance” without evidence.
R03, R17, R21
F03, F16
VOICE-S021–S031, 0D, report-polish controls
Improves specificity without schema change.
VOICE-REV-S16 — Timestamped notes, fix-first and next-take specificity
Timestamped notes should be chronological, specific and distributed across meaningful song moments where evidence exists. Fix-first must name the highest-impact observable change. Next-take advice must be component-aware and evidence-led.
Existing locked timestamps, phrase/lyric/technical moment, category link and practical next action.
Invented timestamps; generic drills; next-take advice unrelated to evidence; exceeding max 8 timestamps.
R18, R21
F17
0D, report-quality / report-polish controls
Preserves max timestamp and locked evidence.
VOICE-REV-S17 — Cross-discipline non-regression rules
Voice / Singing revisions must not hide Vocal in genuine Song/MT, must not label Acting speech as singing, must not label Dance movement as singing/voice, and must not weaken MT acting + song flow.
Audition type, detected components and visible singing/spoken/dance evidence.
Cross-type label leakage; MT Vocal suppression; song-only acting-scene commentary.
R01, R19, R20
F01, F17
Cross-branch context, baseline guardrails
Protects completed branches.
VOICE-REV-S18 — Limitations and deferred areas
Carry forward thin or unverified areas: belt/mix/registration, jazz/folk/commercial-pop descriptors, full actor-musician rubric, live-output labels, comparison parity, rendered timestamp parity and score stability.
N/A; limitation register.
Treating weak evidence as settled rubric language.
R07, R19
F06, F17
SYN limitations
Prevents over-implementation.
7. Revised Scoring-Category Semantics
Score field
Current operational meaning in Song / Voice
Revised Voice / Singing interpretation
Observable evidence required
What must not be scored here
Sections
Recs
Non-regression note
technical
Recording / camera setup and task readability
Whether the song tape is visually/technically assessable and brief-compliant enough to judge the performance
Framing, visibility, continuity, required format, readable setup
Singing quality, expensive camera, studio polish, class-coded setup
S09, S10
R08, R09
Field unchanged; assessability only.
audio
Sound capture and audibility
Whether voice, accompaniment and text are audible enough for fair vocal/interpretive assessment
Voice-track balance, distortion, noise, reverb, clipping, track dominance
Vocal tone/skill as such, paid mix quality, professional track access
S08, S09
R08, R10
Field unchanged; does not become vocal merit.
vocal
Sung-vocal score
Sung-vocal performance: pitch, rhythm, tone, diction, phrasing, dynamic/phrase control, range exposure and style-relevant vocal choices where observable
Audible singing evidence tied to phrase, lyric, section, style or timestamp
Speech delivery in Acting, movement technique in Dance, vocal-health diagnosis, unsupported belt/mix labels
S02, S04, S07, S13
R01, R03, R07, R12
Clarifies meaning without renaming field.
acting
Acting/storytelling support in Song
Lyric storytelling, acting-through-song, communication, addressee, intention, emotional arc and character/song situation
Lyric/phrase/beat evidence, visible communication, choices that serve song meaning
Acting-scene reader notes, scene-partner feedback, spoken-scene scoring where no spoken acting exists
S02, S03, S05, S06
R02, R04, R05
Keeps Song acting support but blocks leakage.
brief_adherence
Brief compliance / standards in baseline
Whether the song, cut, format, accompaniment and submitted material match supplied brief or baseline professional standards without invention
Explicit brief, supplied task, stated material, timing/cut only if given
Invented time limits, universal cut rules, alternative material advice for fixed material
S11
R16
Material policy preserved.
professional_presentation
Professional standards / presentation
Submission readability, process compliance and non-distracting presentation only when material to assessment
Locked evidence of readability, file/process compliance, slate if required, non-distracting frame
Appearance, charm, polish, expensive kit, studio quality, class markers, paid support
S10, S14
R09, R13
Presentation remains optional and non-personal.
8. Revised Evidence Requirements by Report Section
Report section
Revised evidence requirement
Required specificity anchor
Generic wording blocked
False specificity blocked
Sections
Recs
Casting headline
Name the main tape-specific strength/risk in song terms.
Song moment, component, material, phrase, technical assessability or strongest differentiator.
“Technically strong and emotionally connected” alone.
Invented role, title, brief, time limit or style.
S03, S15
R02, R17
Casting insight
Explain what the tape communicates vocally and interpretively.
Vocal descriptor plus lyric/story evidence.
“Excellent vocal ability” alone.
Unsupported casting fit or voice-type suitability.
S03–S06
R02, R05
Component breakdown
For Song/MT, separate song evidence from acting-scene evidence while showing integration where applicable.
Component-specific evidence.
“Strong song performance” without detail.
Treating song-only as scene work.
S05, S17
R04, R20
Category notes
Each note must match field meaning and use observable evidence.
Category-specific behaviour or assessability fact.
“Lovely tone”, “good breath support”, “strong presence” unsupported.
Audio polish as vocal merit.
S02, S04, S09, S15
R01, R03, R08, R17
Brief/professional standards breakdown
Identify only supplied or observable compliance points.
Explicit brief instruction or baseline standard.
“Perfect adherence” without evidence.
Invented cut limit, universal 16/32-bar rule.
S11
R16
Strengths
Up to 3 evidence-led strengths.
Phrase, timestamp, lyric, vocal choice or communication moment.
“Strong vocal control” unsupported.
Unsupported style/role fit.
S15
R17
Improvements
Up to 3 prioritised, evidence-led improvements.
Moment plus change direction.
“Work on emotion” alone.
Medical diagnosis or invented technique problem.
S04, S13, S15
R03, R12, R17
Fix-first
Single highest-impact action.
Specific observable issue and why it matters.
Generic “connect more”.
Alternative song advice for fixed material.
S11, S16
R16, R18
Timestamped notes
Chronological, locked-evidence-based notes across significant song moments.
MM:SS plus observation and impact.
Generic praise timestamps.
Invented timestamps.
S16
R18, R21
Next-take plan / coaching drills
Practical action tied to fix-first/improvement and assessability.
Phrase, lyric, breath/phrase management, audio balance or communication aim.
Generic warm-ups or drills.
Medical advice; frame-breaking or brief-incompatible advice.
S12, S13, S16
R11, R12, R18
Role-fit notes
Only where brief and role-fit evidence are assessable.
Brief role requirement plus observable song evidence.
“Ready because of voice type”.
Appearance/voice-type/gendered role fit.
S14
R15
Presentation notes
Optional; only if materially useful and locked in evidence.
Readability, frame, audio/visual assessability, process compliance.
“Looks professional”.
Wardrobe/colour/background claims not in evidence.
S10
R09, R21
Submission risk flags
Only evidence-backed risk flags.
Locked risk evidence.
Generic “not professional”.
Unsupported health, role-fit or compliance risk.
S11, S13, S14
R12–R16
Comparison page / display check note
Carry to output-spec; individual report labels and comparison labels must align.
Later live/rendered output evidence.
N/A
Inferring display parity from baseline text.
S17, S18
R19, R20
9. Revised Style / Subtype Handling Map
Style / subtype / context
Revised handling
Evidence required before naming it
Must not assume
Evidence confidence
Source IDs
SYN
Section
Watch item
Classical / legit
May name where material/style supports it.
Brief, repertoire, legit/classical style markers.
That classical/legit is universal excellence.
strong
S001, S002, S004, S007, S012, S024, S025, S028
F06
S07
Over-imposition.
Contemporary MT
May name where MT style/material supports it.
MT repertoire, brief, contemporary vocal/lyric context.
That contemporary MT equals pop or belt.
strong
S004, S009, S010, S014, S020–S027
F06
S07
Style precision.
Classical art song / opera-adjacent
Treat as specialist context.
Classical repertoire/language/art-song/aria evidence.
That opera criteria apply to all Song.
strong
S007, S012, S025, S028, S041
F06
S07
Specialist overreach.
Belt
Suppress unless clearly supported.
Observable belt demand or explicit brief/source context.
Belt as universal merit.
thin
S013, S014, S035, S036
F06
S07, S18
Thin evidence.
Mix
Suppress unless clearly supported.
Observable mix/head/falsetto mix context or brief/source wording.
Guessing registration from tone alone.
thin
S013, S035
F06
S07, S18
Thin evidence.
Registration
Use cautious, non-diagnostic phrasing only.
Clear audible transition/register demand.
Detailed registration rubric.
thin
S021 plus limited source context
F06
S07, S18
Overclaim.
Pop-rock
May name broad context where material supports it.
Brief, song style, source/open-call context.
Universal pop-rock vocal standard.
medium
S010, S013, S014, S020, S029, S035, S039
F06
S07
Descriptor thinness.
Jazz
May name as context; keep descriptors cautious.
Jazz standard/material/brief evidence.
Full jazz rubric.
thin-medium
S010, S013, S018, S035
F06
S07, S18
Descriptor thinness.
Folk
May name as repertoire/context; avoid full style rubric.
Folk material/brief evidence.
Folk descriptor certainty.
thin
S013, S014, S015, S035
F06
S07, S18
Thin evidence.
Commercial/pop vocal
May use broad context if source/material supports it.
Pop/commercial material and observable style evidence.
Marketability or social-media merit.
medium
S010, S013, S014, S020, S029, S035, S039
F06
S07
Marketability block.
Actor-musician
Treat as optional subtype only.
Self-accompaniment/instrument task visibly present or briefed.
All singers must self-accompany.
medium
S006, S017, S018, S041
F06
S07, S08, S18
Full rubric deferred.
Self-accompanied song
Assess voice/instrument balance only if task supports it.
Visible/audible self-accompaniment.
Instrument access as merit.
medium
S018, S041, S051
F09, F13
S08
Access fairness.
Unaccompanied song
Valid where task allows/requires it.
Brief or observable a cappella context.
Lack of accompaniment as deficit.
strong
S006, S015, S026, S041
F09
S08
Context.
Accompanied / backing-track song
Treat balance and track quality as assessability.
Audible accompaniment and task context.
Professional track as merit.
strong
S001–S020, S026, S027, S039–S041
F09
S08, S09
Audio merit separation.
Audition cut
Assess what the cut permits; avoid full-arc overclaim.
Known cut length or visible short-form structure.
Universal 16/32/60–90 rule.
strong
S001, S009–S013, S020, S035, S039, S040
F05, F15
S11
Cut overclaim.
Full song
May discuss full journey if task/duration supports it.
Full-song or substantial cut evidence.
Full arc in short cut.
medium
S003, S041
F15
S06, S11
Evidence sufficiency.
Song-only self-tape
Keep feedback song-framed.
Song component only.
Acting-scene feedback.
strong
S003, S009, S011, S013, S019, S039–S041
F04
S05, S17
Song-only containment.
MT song in multi-component tape
Preserve both vocal and acting evidence; connect song to MT performance when visible.
Detected MT song component and, where present, acting scene component.
Hiding Vocal or isolating song from MT story context.
strong
S001, S004, S006, S017, S021, S023, S026, S027
F01, F04
S05, S17
MT anchor.
10. Revised Safety, Accessibility and Anti-Bias Guardrails
Guardrail area
Revised rule
Safe output language direction
Blocked claim
Type
Source IDs
SYN
Recs
Section
No vocal-health diagnosis
Never diagnose from tape.
“The sound becomes pressed/strained-like here, so keep the next take efficient and avoid forcing it.”
Nodules, reflux, laryngitis, injury, pathology, illness.
safety-only
S043–S046
F11
R12
S13
Strain-like / fatigued / hoarse sound
Describe cautiously if audible and assessable.
“There is a strain-like quality on the upper phrase.”
“Your voice is damaged/unhealthy.”
partial tape / safety
S043–S046
F11
R12
S13
Respiratory / convalescence / medical-status inference
Do not infer medical status.
“Audio/vocal evidence is limited here.”
Respiratory condition, convalescence, fatigue disorder.
clinical-only
S044, S045
F11
R12
S13
Hearing difference
Treat as access context.
Acknowledge hearing-access supports if supplied.
Hearing difference as musical deficit.
access-only
S047
F12
R13
S14
Captions / STT / sign interpretation / assistive listening
Legitimate access supports.
“Access support is process context, not performance weakness.”
Penalising captions, STT, interpreters, devices.
access-only
S047, S048
F12
R13
S14
Speech difference
Avoid deficit inference.
Focus on intelligibility in the submitted audio, not speech norming.
“Speech difference weakens professionalism.”
access/fairness
S050
F12
R14
S14
Accent / dialect bias
No accent hierarchy.
“The lyric is/is not intelligible in this recording.”
“Standard accent”, prestige accent, class-coded diction.
policy/fairness
S050
F12
R14
S14
Diction / intelligibility without accent hierarchy
Assess clarity of text, not accent status.
Phrase-level consonant/vowel clarity only where relevant and audible.
Equating accent with poor diction.
tape/fairness
S021, S027, S050
F03, F12
R03, R14
S04, S14
Neurodivergence
Treat as access/context, not deficit.
Do not infer cognitive or processing traits from performance.
Neurodivergence as unreliability.
access-only
S046, S048, S051
F12
R13
S14
Disability / access support
Access support is fairness.
“Adaptation/support is process context.”
Penalising support, mobility aid, access need.
access-only
S046, S048, S051
F12
R13
S14
Visual impairment if relevant
Do not impose sight-dependent norms.
Note only if access context is supplied and relevant to assessability.
Treating visual impairment as performance deficit.
access-only
S046, S051
F12
R13
S14
Gender-diverse / trans voice
Identity-led, non-stereotyped handling.
Avoid gendered voice expectations.
“Male/female voice type”, gendered suitability claims.
identity/access
S049
F12
R15
S14
Body / appearance and voice assumptions
No body/appearance inference from sound.
None unless brief-supplied and safe; normally omit.
Voice implies body, age appearance, gender presentation, marketability.
blocked
S049, S050
F12
R15
S14
Age / voice maturity assumptions
Avoid over-reading age/maturity from sound.
“The material exposes a mature/young-sounding colour” only if safely evidence-led and not age inference.
“Voice is too old/young” without brief/evidence.
safety/fairness
S043
F12
R15
S14
Assistive technology
Legitimate support.
Treat as access/readability context.
Assistive tech as deficit or polish.
access-only
S047–S051
F12, F13
R13
S14
Reasonable adjustments
Proactive fairness.
Do not score adjustment use.
Access request as unprofessional.
access-only
S046, S048
F12
R13
S14
Backing-track / accompanist inequality
Context and access issue.
Treat track/accompanist quality as assessability context.
Paid accompanist as talent.
access/process
S041, S051
F09, F13
R09, R10
S08, S10
Recording-equipment inequality
Equipment affects assessability.
Mention only how recording affects what can be judged.
Better mic/studio as vocal merit.
assessability/access
S043, S047, S051
F13
R08, R09
S09, S10
Home setup / low-resource recording
Home capture can be acceptable if assessable.
“The recording is simple but clear enough to assess.”
Home setup as lack of professionalism.
access/process
S003, S005, S006, S008, S009, S033, S040, S041, S051
F07, F13
R08, R09
S09, S10
11. Revised Tape-Observable versus Process-Only Boundary
Evidence / capacity
Allowed handling
Blocked handling
Tape-observable?
Evidence required
Source IDs
SYN
Recs
Section
Pitch
Assess audible pitch/intonation in the submitted song.
Inferring pitch skill if audio is not assessable.
yes
Clear audio and sung phrase.
S021, S025–S029
F03
R03
S04
Rhythm
Assess timing/pulse where musical reference is audible.
Inferring sight-reading or musicianship.
yes
Audible pulse/track or internal rhythm.
S021, S023, S025–S029
F03
R03
S04
Tone
Describe audible tonal quality cautiously.
Treating room/mic colour as vocal tone.
partial
Sufficient audio fidelity.
S025, S026, S029, S040, S041
F03, F08
R03, R08
S04, S09
Diction
Assess intelligibility, not accent status.
Accent hierarchy.
yes
Audible text and language context.
S021, S027, S050
F03, F12
R03, R14
S04, S14
Phrasing
Assess musical shape and breath/phrase management where audible.
Generic “good phrasing”.
yes
Phrase-specific evidence.
S025–S027
F03
R03
S04
Lyric intention
Assess observable lyric emphasis, addressee or objective.
Inventing intention.
partial/yes
Understandable lyric and performance choices.
S009, S010, S017, S021, S023, S026, S027, S036
F02, F04
R02, R04
S05
Acting-through-song
Assess song-native storytelling.
Reader/scene feedback in song-only tape.
yes
Phrase/lyric/character communication evidence.
S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
F04
R04
S05
Style fit
Use cautiously where material/context supports.
Universal style rules.
partial
Brief/material/source-supported style evidence.
S001–S020, S029, S035, S039
F05, F06
R06
S07
Song choice suitability
Comment only if choice-material context exists.
Alternative advice for fixed material.
partial
Brief says choice material or source-supported task context.
S009, S010, S015, S020, S035–S040
F15
R16
S11
Range / tessitura
Describe what the submitted material exposes.
Full range or voice-type claims from one cut.
partial
Material exposes range demand.
S003, S006, S009, S010, S019, S024–S026
F03, F06
R03, R15
S04, S14
Belt / mix / legit
Name only if clearly supported.
Guessing belt/mix/registration.
partial
Clear audible evidence or brief/source label.
S001, S002, S004, S013, S014, S035
F06
R07
S07
Vocal health
Observation-only caution.
Diagnosis/prognosis.
partial
Clear audible strain-like/fatigue-like evidence and assessable audio.
S043–S046
F11
R12
S13
Stamina
Do not infer from short tape.
Full-show stamina claims.
no/partial
Long repeated task or supplied live/process evidence.
S026, S043, S044, S046
F10, F11
R11
S12
Response to direction
Only if direction response is actually shown/supplied.
Inferring from finished take.
no
Direct redirection evidence.
S001, S004, S017, S033, S037, S039–S041
F10
R11
S12
Learning speed
Only if task includes learning on tape/process evidence.
Inferring from polish.
no
Direct new-song/workshop evidence.
S016, S040
F10
R11
S12
Aural skills
Do not infer.
Aural ability claims from song tape.
no
Formal aural task evidence.
S025, S026, S028, S029
F10
R11
S12
Sight-singing
Do not infer.
Sight-singing readiness from prepared song.
no
Sight-singing task evidence.
S025, S026, S028, S029
F10
R11
S12
Musicianship
May discuss observable musical communication; not formal musicianship tests.
Musicianship-test claims.
partial
Observable phrasing/structure; otherwise process task.
S015, S021, S026, S028, S029
F03, F10
R03, R11
S04, S12
Recall / callback readiness
Do not infer except with explicit process evidence.
“Would take direction well in recall.”
no
Recall/callback evidence supplied.
S001, S004, S006, S017, S039–S041
F10
R11
S12
Training potential
Avoid from finished tape alone.
Broad training-potential claims.
no/partial
Direct process evidence or level-calibrated observable learning context.
S012, S015–S017
F10
R11
S12
Professional readiness
Limit to submitted tape readiness and observable task compliance.
Broad employability/marketability.
partial
Brief adherence, assessability, specific observable standards.
S032, S039, S040
F10, F13
R11, R15
S12, S14
Access needs
Treat as context, never scored.
Access need as deficit.
no
Supplied access context only.
S046–S051
F12
R13
S14
Recording setup / equipment access
Assess only as readability/assessability.
Equipment quality as talent.
partial
Locked technical/audio evidence.
S003, S005, S008, S011, S013, S032–S041, S047–S051
F07, F08, F13
R08, R09
S09, S10
12. Revised Generic-Feedback Suppression Rules
Generic phrase / risk
Revised handling
Required evidence anchor
Blocked unless evidence present?
Sections
Recs
strong vocal control
Replace with specific control evidence.
Pitch/rhythm/tone/phrase/timestamp.
yes
S04, S15
R03, R17
lovely tone
Specify tonal quality and where heard.
Phrase, register, vowel/line, timestamp.
yes
S04, S15
R03, R17
good breath support
Use only if phrase management is observable.
Breath/phrase point, line length, release/control evidence.
yes
S04, S13, S15
R03, R12, R17
secure pitch
Anchor to note/phrase/section.
Audible pitch/intonation evidence.
yes
S04, S15
R03, R17
emotional connection
Replace with lyric/choice evidence.
Lyric intention, addressee, dynamic/phrase choice.
yes
S05, S15
R04, R17
powerful belt
Suppress unless clearly supported.
Explicit belt demand or observable belt phrase.
yes
S07, S15
R07, R17
nice mix
Suppress unless clearly supported.
Clear mix context/evidence.
yes
S07, S15
R07, R17
good legit quality
Anchor to style/material and evidence.
Legit/classical context plus phrase evidence.
yes
S07, S15
R06, R17
expressive singing
Specify what expressed and how.
Lyric, phrase, dynamic, timing or communication evidence.
yes
S05, S06, S15
R05, R17
great musicality
Replace with musical interpretation evidence.
Phrasing, rhythm, shape, dynamics, style relationship.
yes
S06, S15
R05, R17
strong storytelling
Anchor to lyric/addressee/objective/arc.
Lyric/beat evidence.
yes
S05, S15
R04, R17
professional song choice
Use only in choice-material contexts and explain why.
Brief/source-supported material fit.
yes
S11
R16
perfect song choice
Block as overclaim.
N/A; use bounded evidence if choice context exists.
yes
S11, S13
R16
vocal health sounds good
Block.
N/A; health is not scored.
yes
S13
R12
ready because of voice type
Block unless role brief explicitly supports and non-protected evidence exists; normally avoid.
Explicit brief requirement plus observable vocal fit, not body/gender/appearance.
yes
S14
R15
strong presence
Anchor to communication/performance behaviour, not charisma/appearance.
Audience/lens/lyric communication evidence.
yes
S05, S14, S15
R13, R17
clean audio as vocal merit
Reframe as assessability.
Audio clarity/track balance evidence.
yes
S09
R08
technically excellent vocal performance
Replace with specific technique plus interpretation evidence.
Descriptor spine plus phrase/timestamp.
yes
S03, S04, S15
R02, R03, R17
13. Revised False-Specificity and Material-Policy Rules
Risk
Revised handling
Required evidence before claim
Blocked claim type
Sections
Recs
Watch item
Invented song title
Do not name title unless supplied, stated or clearly identifiable in locked evidence.
Brief, slate, metadata or locked evidence.
Unsupported title.
S11
R16
Title invention.
Invented role / world / casting fit
Do not infer role/world from song style alone.
Brief or explicit material context.
Unsupported role/world/casting fit.
S11, S14
R15, R16
Role-fit overclaim.
“Perfect song choice”
Avoid absolute praise.
Choice-material context plus specific fit evidence.
Absolute material verdict.
S11, S15
R16, R17
Generic false specificity.
Alternative material suggestions where material is fixed
Block. Improve submitted material only.
User asks for repertoire advice or brief allows choice.
Substitute song advice.
S11
R16
Fixed-material regression.
Invented time limit or cut breach
Only state if brief provides limit or duration evidence is deterministically known and relevant.
Explicit brief/time requirement.
False duration/cut breach.
S11
R16
Historical risk.
Universal 16-bar / 32-bar / 60–90s rule
Treat as context-specific.
Brief/open-call/source task requires it.
Universal cut standard.
S11
R16
Source overreach.
Universal pre-/post-era rule
Treat as institution-specific unless brief requires.
Explicit brief/source context.
Universal era contrast.
S07, S11
R06, R16
Style overclaim.
Unsupported voice-type suitability
Avoid suitability based on voice type alone.
Explicit role/brief and observable non-protected evidence.
“Ready because of voice type.”
S14
R15
Bias.
School-specific bans as universal rules
Keep school/open-call restrictions contextual.
Source-specific task only.
“Never use X material.”
S11
R16
Source taste.
Production/open-call restrictions treated as global rules
Use only for that brief/process.
Supplied open-call instruction.
Global submission rule.
S11
R16
False specificity.
Paid accompanist / professional track as merit
Treat only as context/assessability.
Audio balance evidence.
Paid support as quality.
S08, S10
R09, R10
Resource bias.
High production polish as merit
Reframe as readability if relevant.
Locked technical/audio evidence.
Polish as talent/professionalism.
S09, S10
R08, R09
Anti-polish.
14. Baseline Compatibility and Non-Regression Check
Baseline constraint
Preserved?
How revision preserves it
Change IDs
Recs
Final-audit watch
Six score fields
yes
Clarifies semantics only.
C01, C02
R01, R20
No field drift.
Song weights
yes
Vocal remains 45%, acting/storytelling 15%.
C02, C03
R01, R02
No weighting change.
MT weights
yes
MT acting/vocal visibility preserved.
C16
R20
MT anchor.
Server-side recomputation
yes
No calculation change.
C01
R21
Recompute untouched.
Caps / blockers / verdicts
yes
No threshold change.
C01
R20
No cap drift.
Role-fit bounds
yes
Blocks unsupported role-fit; no bound change.
C11
R15
Role-fit safety.
Step 1 / Step 2 pipeline
yes
Locked evidence reaffirmed.
C17
R21
Step 2 invention.
Locked-field enforcement
yes
Revision relies on locked evidence.
C17
R21
Timestamp/evidence preservation.
Report schema / public JSON
yes
No new fields proposed.
C01
R20
Schema unchanged.
Material-policy guardrails
yes
Fixed material protection strengthened.
C12
R16
No substitute advice.
Safety / accessibility scrubs
yes
No-diagnosis and access-safe language strengthened.
C10, C11
R12–R15
Bias/diagnosis.
MT acting + song flow
yes
Vocal not hidden; acting/story supported.
C16
R20
MT regression.
Acting spoken-only label containment
yes
Song-specific vocal semantics do not apply to Acting speech.
C02, C16
R01, R20
Acting label.
Dance no-singing label protection
yes
Song-specific vocal semantics do not apply to Dance movement proxy.
C02, C16
R01, R20
Dance label.
External marks / grades / percentages excluded
yes
Descriptor language only; no scoring import.
C04, C12
R03, R16
Framework overreach.
No-diagnosis boundary
yes
Explicit safety rule added.
C10
R12
Medical claims.
Anti-polish / resource-equity boundary
yes
Presentation/audio separated from merit.
C07, C11
R08, R09, R13
Resource bias.
Timestamp maximum
yes
Max 8 retained; no invented timestamps.
C14, C17
R18, R21
Density within cap.
Strengths / improvements maximum
yes
Max 3 retained; evidence anchors strengthened.
C13, C17
R17, R21
Generic praise.
15. Deferred / Not Implemented Register
Deferred / not implemented area
Reason
Related recs
SYN limitation theme
Source IDs
Later handling
Final-audit watch
Detailed belt rubric
Evidence thin and source-shaped.
R07
Belt thinness
S013, S014, S035, S036
Suppress conditionally / future research.
Do not overclaim.
Detailed mix rubric
Evidence thin.
R07
Mix thinness
S013, S035
Suppress conditionally.
Unsupported label.
Detailed registration rubric
Insufficient cross-source descriptor base.
R07
Registration thinness
S021 limited
Carry as limitation.
Method overclaim.
Rich jazz descriptor rubric
Context exists, descriptors thin.
R06, R07
Jazz thinness
S010, S013, S018, S035
Carry as limitation.
Style overreach.
Rich folk descriptor rubric
Context exists, descriptors thin.
R06, R07
Folk thinness
S013–S015, S035
Carry as limitation.
Style overreach.
Broad commercial/pop descriptor rubric
Some evidence, not rich enough for full rubric.
R06
Commercial-pop unevenness
S010, S013, S014, S020, S029, S035, S039
Cautious handling.
Marketability risk.
Full actor-musician rubric
Partial evidence only.
R06, R10
Actor-musician partial
S006, S017, S018, S041
Future branch/gap-fill.
Subtype overclaim.
Vocal-health scoring
Safety sources support guardrails only.
R12
No health score
S043–S046
Block; safety-only.
No diagnosis.
Stamina scoring from short tapes
Process/live evidence needed.
R11
Live-room boundary
S016, S026, S037, S041
Block unless directly shown.
Overclaim.
Voice type / range as role-fit proxy
Bias and evidence risk.
R15
Body/voice-type caution
S043, S049, S050
Suppress conditionally.
Protected-trait risk.
Gendered voice norms
Identity-led evidence blocks stereotyping.
R15
Gender-diverse caution
S049
Block.
Stereotyping.
Universal song contrast rule
Contrast is non-uniform.
R06, R16
Non-uniform contrast
S001–S020
Context-specific only.
Universal rule overreach.
Universal repertoire-choice rule
Source taste varies.
R16
Repertoire overreach
S001–S020, S035–S040
Context-specific only.
False specificity.
Universal accompaniment rule
Accompaniment rules vary.
R10
Context-specific accompaniment
S001–S020, S039–S041
Context-specific only.
Access inequity.
Frontend label verification
No live/rendered outputs supplied.
R19, R20
Display untested
N/A
Output-spec/live QA.
Label mismatch.
Comparison-page parity
Not auditable here.
R19
Comparison untested
N/A
Output-spec/live QA.
Score/label mismatch.
Rendered timestamp parity
Not auditable here.
R18, R19
Rendering untested
N/A
Output-spec/live QA.
Persisted/rendered mismatch.
Live Song / Voice output QA
No live outputs supplied.
R19
Live outputs absent
N/A
Later live QA.
Report quality.
Score stability tests
No live repeat outputs supplied.
R19
Score stability untested
N/A
Later regression.
Stability.
16. Revision Traceability Matrix
Change ID
Revised section ID(s)
Recommendations
Issues
SYN findings
Source ID(s)
Evidence basis summary
Baseline compatibility
Non-regression note
C01
S01
R20, R21
I19, I20
F01, F17
Baseline controls
Current architecture must be preserved.
Fully compatible.
No implementation change.
C02
S02, S17
R01, R20
I01, I20
F01
S001–S052
vocal is sung vocal in Song/MT; proxy meanings differ elsewhere.
Field unchanged.
Protects Acting/Dance.
C03
S03
R02
I02
F02
S001–S031, S035–S040
Song is vocal plus interpretive evidence.
Weights unchanged.
Song remains vocal-centred.
C04
S04, S15
R03, R17
I03, I17
F03, F16
S021–S031
Descriptor spine supports specificity.
No marks/grades imported.
Blocks generic praise.
C05
S05, S06
R04, R05
I04, I05
F02, F04
S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
Acting-through-song is song-framed.
No new field.
Blocks scene leakage.
C06
S07, S18
R06, R07
I06, I07
F05, F06
S001–S020, S021–S031, S035–S041
Style map supported but uneven.
Wording-only.
Prevents overclaim.
C07
S09, S10
R08, R09
I08
F07, F08, F13
S003, S005, S008, S011, S013, S023, S024, S027, S032–S041, S047–S051
Capture quality is assessability, not merit.
Fields unchanged.
Anti-polish.
C08
S08
R10
I09
F09
S001–S020, S026, S027, S039–S041
Accompaniment varies by context.
Compatible.
No universal rule.
C09
S12
R11
I10
F10
S001, S004, S006, S015–S017, S021–S031, S033, S037, S039–S041
Process capacities require process evidence.
Compatible.
Blocks live-room overclaim.
C10
S13
R12
I11
F11
S043–S046
Health sources support no-diagnosis rule.
Safety-only.
No health score.
C11
S14
R13–R15
I12–I14
F12, F13
S046–S051
Access and identity are non-deficit contexts.
Guardrail-only.
Anti-bias.
C12
S11
R16
I15, I16
F05, F14, F15
S001–S020, S035–S040
Source-specific repertoire rules must remain contextual.
Material policy preserved.
Blocks false specificity.
C13
S15
R17
I17
F16
S021–S031, 0D
Generic feedback needs evidence anchors.
Report wording only.
Specificity.
C14
S16
R18
I18
F17
0D, report-quality controls
Timestamp and next-take advice need density/specificity.
Max 8 retained.
No timestamp invention.
C15
S17, S18
R19
I19
F17
Baseline guardrails
Display/rendering requires later verification.
No UI proposal.
Output-spec deferred.
C16
S17
R20
I01, I20
F01, F17
Cross-branch context
Protect MT/Acting/Dance semantics.
Compatible.
Cross-branch non-regression.
C17
S01, S15, S16
R21
I17, I18
F16, F17
Report-polish / quality controls
Step 2 must not invent or alter locked evidence.
Compatible.
Locked evidence preserved.
17. Final-Audit Watch List
Watch ID
Watch item
Why it matters
Sections
Recs
VOICE-FINAL-AUDIT must check
Severity
VOICE-REV-W01
No accidental field/weight/schema change
Core product stability.
S01, S02
R01, R20, R21
Six fields and weights unchanged.
critical
VOICE-REV-W02
MT Vocal visibility
MT anchor protection.
S02, S17
R01, R20
Vocal remains visible where singing exists.
critical
VOICE-REV-W03
Acting and Dance label containment
Prevents cross-discipline leakage.
S02, S17
R20
Acting speech and Dance movement are not labelled singing.
high
VOICE-REV-W04
Generic vocal praise suppression
Output quality risk.
S04, S15
R03, R17
Generic phrases require anchors.
high
VOICE-REV-W05
No-diagnosis vocal-health wording
Safety risk.
S13
R12
No pathology/medical claims from tape.
critical
VOICE-REV-W06
Access-safe inclusive language
Fairness risk.
S14
R13
Access context is non-deficit.
high
VOICE-REV-W07
Accent/speech-difference handling
Bias risk.
S14
R14
Diction ≠ accent hierarchy.
high
VOICE-REV-W08
Gendered voice / voice-type overclaim block
Protected-trait risk.
S14
R15
No gender/body/voice-type stereotyping.
high
VOICE-REV-W09
Fixed-material protection
Trust/material-policy risk.
S11
R16
No substitute song advice when fixed.
high
VOICE-REV-W10
Style/subtype overclaim
Source-shaped evidence risk.
S07, S18
R06, R07
Supported labels only.
medium
VOICE-REV-W11
Belt/mix limitation
Thin evidence risk.
S07, S18
R07
Conditional suppression retained.
medium
VOICE-REV-W12
Timestamp density and next-take specificity
Evidence-led report value.
S16
R18, R21
Specific, chronological, locked timestamps; next take tied to evidence.
high
VOICE-REV-W13
Display/rendering deferred to output-spec
Avoid false verification.
S17, S18
R19
Display not claimed as verified.
medium
VOICE-REV-W14
Live-output QA pending
Product behaviour not verified.
S18
R19
No live-output claims.
high
18. Revised Baseline Handoff for VOICE-FINAL-AUDIT
VOICE-REV is complete with explicit limitations. The revised Voice / Singing baseline strengthens the current Song slice while preserving the live TapeCoach production architecture. It keeps the six operational score fields, Song and MT weights, server-side recomputation, caps, blockers, verdict logic, role-fit bounds, Step 1 / Step 2 architecture, locked evidence, deterministic scrubs, material-policy guardrails and MT acting + song anchor unchanged.
The core revision clarifies that vocal means sung-vocal evidence in Song / Musical Theatre, while Acting/Monologue and Dance retain their existing proxy meanings and must not receive singing labels. Song remains vocal-centred, but acting/storytelling is now explicitly framed as lyric/storytelling and communication through song, not acting-scene performance. The revised evidence standard requires both vocal technique and interpretive evidence where assessable. Formal descriptor evidence is converted into observable prompt/report guidance for pitch, rhythm, tone, diction, phrasing, communication and interpretation, while external grades, marks and framework weights remain excluded.
The revision adds song-framed acting-through-song, musical interpretation through existing fields, cautious style/subtype handling, context-specific accompaniment handling, and stronger separation of audio/technical assessability from vocal merit. It blocks production polish, expensive resources, paid accompanist access and studio quality as talent evidence. It preserves fixed-material policy and blocks false specificity such as invented song titles, universal cut lengths, universal era rules, unsupported voice-type fit and alternative material suggestions where material is fixed.
Safety and fairness revisions add a firm no-diagnosis rule for vocal-health language and non-deficit handling of access needs, disability, neurodivergence, hearing difference, speech difference, accent, gender-diverse voice, reasonable adjustments and assistive technology. Generic vocal praise is now blocked unless anchored to observable evidence. Timestamp and next-take guidance is strengthened within existing caps and locked-evidence limits.
Compact VOICE-REV-C changes: C01 architecture preservation; C02 sung-vocal semantics; C03 vocal-plus-interpretive standard; C04 descriptor specificity; C05 song-framed acting-through-song; C06 style/subtype limits; C07 assessability/anti-polish; C08 accompaniment context; C09 process-only boundary; C10 no-diagnosis safety; C11 inclusive voice guardrails; C12 material boundaries; C13 generic praise suppression; C14 timestamp/next-take specificity; C15 display deferral; C16 cross-discipline non-regression; C17 Step 2 locked-evidence preservation.
Revised sections: VOICE-REV-S01–S18. Implemented recommendations: R01–R06, R08–R18. R07 is suppress conditionally / defer. R19 is deferred to output-specificity. R20–R21 are preserve-only / guardrail recommendations. Source range used: VOICE-S001–VOICE-S052. VOICE-SYN findings used: VOICE-SYN-F01–F17. Audit IDs used: VOICE-AUDIT-I01–I20 and VOICE-AUDIT-R01–R21.
What was revised: baseline wording, evidence standards, claim-scope rules, style/subtype boundaries, safety/fairness guardrails, generic-feedback suppression and non-regression protections. What was not revised: scoring fields, weights, schema, backend, frontend, pipeline, caps, verdicts, role-fit logic, server-side recomputation or live-output behaviour.
19. VOICE-REV Decision
VOICE-REV complete with explicit limitations; ready for VOICE-FINAL-AUDIT.
Rationale: the supplied VOICE-SYN and VOICE-AUDIT materials are sufficient to revise the Voice / Singing baseline at rubric/prompt/report-behaviour level without altering production architecture. The revision implements the evidence-backed, baseline-compatible recommendations and preserves all product constraints.
Critical blockers: none for final audit of the revised baseline.
Implemented recommendations: VOICE-AUDIT-R01–R06 and R08–R18.
Preserve-only recommendations: VOICE-AUDIT-R20 and VOICE-AUDIT-R21.
Suppressed conditionally / deferred recommendations: VOICE-AUDIT-R07 is limited to cautious evidence-led use; VOICE-AUDIT-R19 is deferred to output-specificity / display verification.
Limitations to carry forward: thin belt/mix/registration evidence, uneven jazz/folk/commercial-pop descriptors, partial actor-musician evidence, no live Song / Voice outputs, unverified frontend labels, unverified comparison-page parity, unverified rendered timestamp parity and untested score stability.
Live-output examples are not required before VOICE-FINAL-AUDIT of the revised baseline, but they remain required later for output-specificity / live-output QA.
Recommended mode for VOICE-FINAL-AUDIT: standard ChatGPT with file uploads enabled, not Deep Research.
20. Completion Statement
VOICE-REV complete with explicit limitations. Ready for VOICE-FINAL-AUDIT.

---

## Links

- **Previous:** [[drr-voice-07-audit]] — Synthesis Audit
- **Next:** [[drr-voice-09-final-audit]] — Final Audit
- **Thread overview:** [[drr-voice-overview]]
- **Programme:** [[drr-programme-overview]]
