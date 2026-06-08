---
id: drr-voice-07-audit
title: Voice — Synthesis Audit
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/4.Voice/VOICE-Audit.md"
discipline: commercial
monday_ref: null
tags: [discipline-rubric-research, commercial, stage-audit, voice]
confidence: medium
created: 2026-05-05
imported: 2026-06-08
updated: 2026-06-08
---

# Voice — Synthesis Audit

> **Imported research — Discipline Rubric Research programme.** Step 7 of 12 in the Voice thread (`stage-audit`). Original file: `4.Voice/VOICE-Audit.md`. Original date: 2026-05-05 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-voice-overview]].

---

1. VOICE-AUDIT Readiness Check
Check
Result
Caveat
VOICE-SYN handoff present
Yes
Supplied with VOICE-SYN-F01–F17.
Current Voice / Singing baseline slice present
Yes
Supplied as the baseline slice under audit.
Baseline-control context present
Yes
0A–0E previously supplied; additional Report-Polish and Report-quality snippets supplied in this prompt.
VOICE-S001–VOICE-S052 source universe closed
Yes
All rows closed with final status or explicit limitation.
Source IDs normalised
Yes
S### treated as VOICE-S###.
Preliminary risk IDs VOICE-PRE-I01–I13 available
Yes
All available.
MT protected anchor context present
Yes
MT acting + song remains protected.
Acting and Dance label-risk context present
Yes
Acting speech-delivery containment and Dance no-singing protection preserved.
Current live Song / Voice outputs supplied
No
Code snippets were supplied, but no rendered report/PDF/screenshot/live output examples.
VOICE-AUDIT may proceed
Yes
Audit can proceed at baseline and recommendation-mapping level.
Caveats
This audit uses the supplied implementation snippets as current baseline-control evidence. They are not live Song / Voice outputs. Live-output QA, rendered label checks, comparison-page parity, score stability and timestamp rendering parity remain pending.

2. Audit Input Register
Input item
Type
Present?
Used in audit?
Role in audit
Limitation / note
VOICE-SYN handoff
Synthesis handoff
Yes
Yes
Primary evidence base
Summary-level synthesis, not full source ledgers.
Current Voice / Singing baseline slice
Baseline slice
Yes
Yes
Object under audit
Current discipline wording only.
0A-RECONCILE
Baseline-control material
Yes
Yes
Confirms live production architecture and current field meanings
Used as preservation context.
Rubric Control Sheet
Baseline-control material
Yes
Yes
Confirms score fields, weights, caps, blockers and report sections
Used as guardrail context.
0B Discipline-Specific Rubric Slices
Baseline-control material
Yes
Yes
Confirms Voice / Singing slice
Directly audited.
0C Process/Rubric Baseline Audit
Baseline-control material
Yes
Yes
Confirms shared schema and known risks
No new implementation proposal made.
0D Output Specificity Stress Test
Baseline-control material
Yes
Yes
Confirms genericity, false-specificity and timestamp risks
Not live Voice output QA.
0E Baseline Guardrail Pack
Baseline-control material
Yes
Yes
Confirms preserve/do-not-touch lists
Governs compatibility checks.
Report-Polish.Server.ts
Implementation snippet
Yes
Yes
Confirms Step 2 locked-evidence/polish rules, timestamp constraints and presentation safeguards
Does not prove rendered behaviour.
Report-quality.server.ts
Implementation snippet
Yes
Yes
Confirms deterministic text scrubs, timestamp ordering and presentation/source-reference safeguards
Does not prove live output quality.
MT / Dance / Acting branch context
Cross-branch control
Yes
Yes
Non-regression reference
Not reopened for research.
Live Song / Voice outputs
Live-output QA material
No
No
Would verify rendered behaviour
Pending.

3. Audit Scope and Non-Scope
This audit covers the current Voice / Singing baseline against VOICE-SYN. It identifies gaps, risks, issues, recommendations and provisional non-regression tests for VOICE-REV and later output-specificity mapping.
This audit does not revise rubric wording, create VOICE-REV change IDs, implement changes, write code, alter architecture, verify live Song / Voice reports, inspect rendered UI behaviour or perform product-release QA.
Out of scope because of architecture and guardrails:
score-field changes
weighting changes
cap, blocker, verdict or role-fit changes
database, report schema or public JSON changes
backend, Mux, webhook, pipeline or recomputation changes
Step 1 / Step 2 redesign
UI/display implementation proposals
Pending because no live Song / Voice outputs were supplied:
Song / Voice label display
comparison-page label parity
PDF/export parity
rendered timestamp count and order
live generic-feedback recurrence
live no-diagnosis enforcement
live access/fairness wording
Must remain preserved:
current six score fields
Song and MT weights
MT acting + song stabilised flow
server-side recomputation
Step 1 evidence pass and Step 2 text-only polish pass
locked-field enforcement
material-policy, safety, presentation and accessibility scrubs
Acting speech-delivery containment
Dance no-singing label protection
UK terminology

4. Current Baseline Strengths
Current baseline feature
Why it is already sound
Related VOICE-SYN finding ID(s)
Source ID(s) / baseline evidence
Preserve / refine / monitor
Note
vocal as central Song score
Song’s main assessment focus is sung vocal, which aligns with the evidence base.
VOICE-SYN-F01, F02
VOICE-S001–VOICE-S031
Preserve and refine
Needs clearer sung-vocal label containment.
Acting/storytelling as supporting Song dimension
Source evidence supports lyric intention and acting-through-song.
VOICE-SYN-F02, F04
VOICE-S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
Preserve and refine
Must not become acting-scene feedback.
Distinction between vocal technique and lyric storytelling
Baseline already states this distinction.
VOICE-SYN-F02, F03, F04
VOICE-S021, S023, S025, S026, S027, S029
Refine
Needs more explicit evidence requirements.
Step 2 locked-evidence rule
Report-Polish requires the model to use only supplied locked evidence and not invent timestamps, risk flags, presentation notes or role-fit claims.
VOICE-SYN-F16, F17
Report-Polish.Server.ts
Preserve
Strong baseline safeguard.
Locked-field enforcement
Scores, audition type, components and timestamped notes are overwritten from Step 1 evidence.
VOICE-SYN-F17
Report-Polish.Server.ts
Preserve
Helps prevent Step 2 score/evidence drift.
Timestamp chronological ordering
Report-quality normalises timestamped notes and sorts them chronologically.
VOICE-SYN-F17
Report-quality.server.ts
Preserve and monitor
Does not solve upstream underproduction.
Material-policy guardrail for fixed material
Existing guardrail blocks alternative material suggestions where fixed.
VOICE-SYN-F15
0E, Report-Polish frame/material rules
Preserve and refine
Needs Voice-specific repertoire boundary.
Presentation only where camera/audio readability matters
Report-Polish says presentation notes are optional; Report-quality grounds visual claims.
VOICE-SYN-F07, F08, F13
Report-Polish.Server.ts; Report-quality.server.ts; VOICE-S003, S005, S032, S040, S041
Preserve and refine
Strong anti-padding basis.
Unsupported visual/source-reference scrubs
Report-quality removes unsupported clothing/colour details and rewrites unsupported page/side references.
VOICE-SYN-F15, F16, F17
Report-quality.server.ts
Preserve
Helps false-specificity and bias control.
Existing no-diagnosis caution
0E blocks diagnostic vocal-health claims.
VOICE-SYN-F11
VOICE-S043–S046; 0E
Preserve and strengthen
Voice-specific operational wording is still needed.
Existing report sections
Category notes, timestamps, fix-first, strengths, improvements and next-take plan can carry evidence without schema change.
VOICE-SYN-F16, F17
0B, 0C, 0E
Preserve and refine
No new score/report field needed.

5. Baseline Gap Matrix Against VOICE-SYN
VOICE-SYN finding ID
Finding summary
Current baseline coverage
Current baseline gap or risk
Baseline area affected
Evidence strength
Source ID(s)
Preliminary risk ID(s)
Audit issue?
Issue ID(s)
Recommendation ID(s)
Baseline compatibility concern
Note
VOICE-SYN-F01
vocal means sung vocal in Song / MT and must stay separate from Acting/Dance proxy meanings.
Partial
Field semantics are known, but label containment is not fully codified for Voice/Song.
Category labels, category notes, comparison labels
High
VOICE-S001–S031; 0A–0E
VOICE-PRE-I04
Yes
VOICE-AUDIT-I01
R01, R20
Display unverified
Compatible as wording/output-spec guardrail.
VOICE-SYN-F02
Song is vocal-plus-interpretive, not technique-only.
Partial
Baseline says distinguish technique/story, but does not force both where assessable.
Vocal, acting/storytelling, headline
High
VOICE-S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
I01, I06
Yes
I02
R02
None
Core revision priority.
VOICE-SYN-F03
Descriptor spine supports pitch, rhythm, tone, diction, phrasing, communication and interpretation.
Partial
Baseline lists broad terms but lacks a formal evidence spine.
Category notes, strengths, improvements
High
VOICE-S021, S023, S025, S026, S027, S029
I12
Yes
I03
R03, R17
Must not import marks/grades
Descriptor language only.
VOICE-SYN-F04
Acting-through-song is source-supported but must stay song-framed.
Partial
Acting/storytelling could leak into acting-scene/reader language.
Acting/storytelling notes, component notes
High
VOICE-S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
I05
Yes
I04
R04
Must preserve Acting containment
Song-framed addressee/lyric/action only.
VOICE-SYN-F05
Song contrast is real but non-uniform.
Weak
No clear rule for cautious contrast/repertoire handling.
Brief/material, style notes
High
VOICE-S001–S020
I02, I07
Yes
I06, I15
R06, R16
Universalisation risk
Treat contrast as context-specific.
VOICE-SYN-F06
Style/subtype distinctions are supported but uneven.
Weak
No confirmed subtype handling; thin areas risk overclaim.
Style/subtype guidance
Medium-high
VOICE-S001–S020, S021–S031, S035, S039, S040
I02
Yes
I06, I07
R06, R07
Evidence uneven
Use cautious fallback.
VOICE-SYN-F07
Assessability-first capture is strongly supported.
Partial
Implementation separates evidence sufficiency in places, but Voice-specific assessability wording is thin.
Technical, audio, presentation
High
VOICE-S003, S005, S008, S011, S013, S023, S024, S027, S032, S040, S041
I09
Yes
I08
R08
None
Strongly compatible.
VOICE-SYN-F08
Audio/technical quality must be separated from vocal merit.
Partial
Report-Polish blocks praising vocal detail when audio is not assessable, but does not fully handle marginal balance/track issues.
Audio, technical, vocal
High
VOICE-S003, S011, S027, S032, S040, S041
I09
Yes
I08
R08
None
Needs explicit Song boundary.
VOICE-SYN-F09
Accompaniment/backing/self-accompaniment rules are context-specific.
Weak
Baseline lacks accompaniment-specific rule.
Audio, brief/material, professional standards
High
VOICE-S001, S003, S006, S009, S011, S015, S018, S039, S040, S041
I07, I09
Yes
I09
R10
No universal rule allowed
Context-specific only.
VOICE-SYN-F10
Live-room capacities must not be inferred from finished song tape.
Partial
Generic evidence-sufficiency exists; Voice-specific process-only capacities are not codified.
Headline, strengths, risk flags, next take
High
VOICE-S001, S004, S006, S015, S016, S017, S020, S033, S037, S039, S040, S041
I11
Yes
I10
R11
None
Major overclaim risk.
VOICE-SYN-F11
Vocal-health language must be no-diagnosis and observation-only.
Partial
0E blocks diagnosis, but Report-Polish prompt lacks explicit vocal-health diagnosis language.
Vocal notes, improvements, safety
High
VOICE-S043–S046
I03
Yes
I11
R12
No medical advice
Safety-critical.
VOICE-SYN-F12
Access needs, disability, neurodivergence, hearing difference, accent, speech difference and gender-diverse voice must not be deficits.
Partial
General protected-trait guardrails exist; Voice-specific diction/accent/gender-diverse handling is under-specified.
Safety/accessibility, diction, role-fit
High
VOICE-S046–S051
I10
Yes
I12, I13, I14
R13, R14, R15
Guardrail-only evidence
Do not score access.
VOICE-SYN-F13
Resource inequality and production polish must not become vocal merit.
Partial
Presentation scrubs are strong; Voice-specific equipment/accompanist/track inequality remains under-specified.
Technical, audio, presentation, vocal
High
VOICE-S003, S005, S009, S033, S040, S041, S047, S048, S051
I09
Yes
I08, I14
R09
None
Strongly compatible.
VOICE-SYN-F14
External marks, grades, school preferences and practitioner taste must not become scoring logic.
Partial
Baseline guardrails prevent weights, but Voice revision must explicitly preserve source-type boundaries.
Revision control
High
VOICE-S001–S031, S035–S041
I02, I07
Yes
I16
R06, R16
No imported weights
Final-audit watch item.
VOICE-SYN-F15
Material/repertoire advice must distinguish fixed from choice contexts.
Partial
Material policy exists; Song-specific false-specificity risks remain.
Brief/material, next take, improvements
High
VOICE-S009, S010, S015, S035, S036, S039, S040, S041
I07, I08
Yes
I15
R16
Must preserve fixed-material rule
Strongly compatible.
VOICE-SYN-F16
Generic vocal praise requires observable anchors.
Partial
Report-quality can rewrite unsupported strengths/improvements, but it is not a Voice-specific anti-generic detector.
Headline, category notes, strengths, improvements, fix-first
High
VOICE-S021, S023, S025, S026, S027, S029; 0D
I12
Yes
I17
R17, R18
None
Key output-quality issue.
VOICE-SYN-F17
Timestamp, display-label and live-output behaviours remain untested.
Partial
Code caps and sorts timestamps, but live density/rendering/parity remain untested.
Timestamps, display, comparison
Medium
0D, 0E, Report-Polish.Server.ts, Report-quality.server.ts
I04, I13
Yes
I18
R18, R19, R20
Output verification pending
Not fully auditable from code alone.

6. Voice / Singing Audit Issue Register
Audit issue ID
Issue title
Problem summary
Current baseline text / behaviour / assumption at issue
Why it matters
Related VOICE-SYN finding ID(s)
Related VOICE-PRE risk ID(s)
Source ID(s) / baseline evidence
Evidence strength
Severity
Affected report area(s)
Affected audition type(s)
Implication
Compatibility sensitivity
Recommendation?
Recommendation ID(s)
Note
VOICE-AUDIT-I01
Sung-vocal field semantics and label containment
vocal is overloaded and must be semantically contained.
vocal means singing, speech or dance technique depending on type.
Prevents misleading labels.
F01, F17
I04
0A–0E; VOICE-S001–S031
High
Critical
Category labels/notes, comparison
Song, MT, Acting, Dance
Display / wording
High
Yes
R01, R20
No field rename authorised.
VOICE-AUDIT-I02
Technique-over-story risk
Song feedback may over-reward technique and under-report interpretation.
Baseline distinguishes both but does not require both.
Song evidence is vocal and interpretive.
F02, F04
I01, I06
VOICE-S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
High
Critical
Vocal, acting/storytelling, component notes
Song, MT
Tape-observable
Low
Yes
R02, R04, R05
Strong source convergence.
VOICE-AUDIT-I03
Descriptor specificity gap
Broad vocal terms remain vulnerable to generic praise.
“Breath, diction, phrasing, tone…” not yet operationalised.
Reports need evidence-backed precision.
F03, F16
I12
VOICE-S021, S023, S025, S026, S027, S029
High
Critical
Category notes, strengths, improvements
Song, MT
Tape-observable
Low
Yes
R03, R17
Formal marks excluded.
VOICE-AUDIT-I04
Acting-through-song versus acting-scene leakage
Storytelling is valid, but reader/scene language is not valid for song-only reports.
Acting/storytelling supporting category may drift.
Prevents discipline leakage.
F04
I05
VOICE-S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
High
High
Acting/storytelling notes
Song, MT
Tape-observable
Medium
Yes
R04
Song-framed language only.
VOICE-AUDIT-I05
Musical interpretation implicit
Musical interpretation can disappear because it is not a separate field.
Baseline says musical interpretation is implicit.
Evidence supports making it visible through wording.
F02, F03, F04
I06
VOICE-S021, S023, S025, S026, S027, S029
High
High
Vocal, acting/storytelling, component notes
Song, MT
Tape-observable
Medium
Yes
R05
No new score field.
VOICE-AUDIT-I06
Style/subtype specificity underdeveloped
Stronger styles are supported, but baseline has no subtype handling.
Known gap lists styles but no operational handling.
Style affects fair feedback.
F05, F06, F14
I02
VOICE-S001–S020, S021–S031, S035, S039, S040
Medium-high
High
Style/material/category notes
Song, MT, hybrid
Tape + context
Medium
Yes
R06, R07
Cautious fallback required.
VOICE-AUDIT-I07
Belt/mix/registration thinness
Evidence is too thin for detailed universal criteria.
Baseline names unknown handling.
Prevents false technical specificity.
F06
I02, I12
VOICE-S013, S014, S035, S036
Medium-low
Medium
Vocal notes
Song, MT
Partial tape-observable
Low
Yes
R07
Defer detail.
VOICE-AUDIT-I08
Assessability versus vocal merit
Capture, track balance and room acoustics can distort vocal assessment.
Evidence_sufficiency exists; Voice-specific boundary still thin.
Protects fairness and score meaning.
F07, F08, F13
I09
VOICE-S003, S005, S011, S023, S024, S027, S032, S033, S040, S041, S051; Report-Polish
High
Critical
Audio, technical, vocal, presentation
Song, MT
Tape + process
Low
Yes
R08, R09
Strong P0 issue.
VOICE-AUDIT-I09
Accompaniment context under-specified
Backing track, a cappella, live piano and self-accompaniment vary by task.
No explicit accompaniment context rule.
Prevents penalising valid formats.
F09
I07, I09
VOICE-S001, S003, S006, S009, S011, S015, S018, S039, S040, S041
High
High
Audio, brief/material, vocal
Song, MT, actor-musician
Mixed
Low
Yes
R10
No universal accompaniment preference.
VOICE-AUDIT-I10
Live-room/process overclaim
Finished tape cannot prove stamina, direction response, learning speed or callback readiness.
Baseline lacks explicit Song process-only list.
Prevents inflated claims.
F10
I11
VOICE-S001, S004, S006, S015, S016, S017, S020, S033, S037, S039, S040, S041
High
Critical
Headline, strengths, risk flags, next take
Song, MT
Process-only
Low
Yes
R11
Directly shown exceptions only.
VOICE-AUDIT-I11
Vocal-health no-diagnosis boundary under-operationalised
Strong source boundary now exists, but prompt/code lacks explicit Voice no-diagnosis wording.
0E contains general caution; Report-Polish prompt does not name vocal diagnosis.
Safety-critical.
F11
I03
VOICE-S043–S046; 0E
High
Critical
Vocal notes, improvements, safety
Song, MT
Safety-only
Medium
Yes
R12
No medical advice.
VOICE-AUDIT-I12
Access-safe inclusive voice handling under-specified
Disability, neurodivergence, hearing access and communication support need Voice-specific non-deficit rules.
General protected-trait rules exist.
Prevents access-as-deficit claims.
F12
I10
VOICE-S046–S049, S051
High
Critical
Safety/accessibility, presentation
Song, MT
Access-only
Low
Yes
R13
Guardrail-only.
VOICE-AUDIT-I13
Accent and speech-difference bias
Diction guidance could become accent hierarchy.
Baseline names diction but not accent fairness.
Prevents class/race/region bias.
F12
I10
VOICE-S050
Medium-high
High
Vocal/diction notes
Song, MT
Access/policy
Medium
Yes
R14
Speech-difference evidence remains thinner.
VOICE-AUDIT-I14
Gendered voice, body and voice-type overclaim
Voice type/range can invite gender/body/appearance assumptions.
Baseline lacks explicit Voice-type guardrail.
Prevents biased role-fit and identity assumptions.
F12, F13
I10
VOICE-S049, S043, S050
Medium-high
High
Vocal, role fit, brief/material
Song, MT
Identity/access
Medium
Yes
R15
Strong anti-bias requirement.
VOICE-AUDIT-I15
Repertoire and fixed-material false specificity
“Perfect song choice” and alternative song advice can overreach.
Existing fixed-material guardrail needs Song-specific reinforcement.
Protects trust and brief fidelity.
F05, F09, F15
I07, I08
VOICE-S009, S010, S015, S035, S036, S039, S040, S041
High
High
Brief/material, next take, improvements
Song, MT
Mixed
Low
Yes
R16
Strong revision priority.
VOICE-AUDIT-I16
External-framework and source-taste overreach
Formal frameworks and school/open-call preferences could be misused.
Baseline excludes weights but not every Voice-specific overreach.
Prevents source-type misuse.
F05, F06, F14
I02, I07
VOICE-S001–S031, S035–S041
High
High
Revision controls
Song, MT
Formal/process
Medium
Yes
R06, R16
Final-audit watch.
VOICE-AUDIT-I17
Generic vocal praise
Current scrubs do not specifically block generic vocal praise if it overlaps with evidence.
Report-quality soft unsupported-claim handling is not Voice-specific.
Generic feedback is a known product risk.
F03, F16
I12
VOICE-S021, S023, S025, S026, S027, S029; 0D; Report-quality
High
Critical
Headline, category notes, strengths, improvements
Song, MT
Tape-observable
Low
Yes
R17, R18
Needs explicit evidence-anchor rule.
VOICE-AUDIT-I18
Timestamp density and evidence coverage
Code preserves and sorts timestamps but cannot create missing evidence.
Step 2 cannot add timestamps; final notes slice to max 8.
Underproduction remains possible.
F17
I13
0D; Report-Polish; Report-quality
Medium
High
Timestamped notes, next take
All
Output/display
Medium
Yes
R18, R19
Live output needed later.
VOICE-AUDIT-I19
Display-layer and comparison risk
Code snippets do not verify user-facing label helpers or comparison parity.
UI/display not supplied.
Labels can mislead even if backend fields are correct.
F01, F17
I04
0A–0E; no live outputs
Medium
High
UI labels, comparison page, export
All
Display-only
High
Yes
R19, R20
Output-spec/live QA item.
VOICE-AUDIT-I20
MT and cross-discipline non-regression
Voice revisions could accidentally hide MT Vocal or leak singing labels into Acting/Dance.
Shared schema and overloaded vocal field.
Protects already-stabilised branches.
F01, F17
I04
Baseline-control, MT/Dance/Acting handoffs
High
Critical
Labels, category notes, components
MT, Song, Acting, Dance
Non-regression
High
Yes
R20
Must be watched in VOICE-REV and final audit.

7. Voice / Singing Audit Recommendation Register
Audit recommendation ID
Short recommendation title
Related issue ID(s)
Specific recommended change
Observable evidence required
Report area affected
Subtype/style/context affected
Source basis
Related VOICE-SYN finding ID(s)
Evidence strength
Baseline impact classification
Compatibility
Priority
Implementation caution
Revision-stage instruction
Limitation / note
VOICE-AUDIT-R01
Clarify sung-vocal field semantics
I01, I20
Make vocal explicitly sung-vocal evidence in Song / MT and preserve non-singing label protections.
Singing/component context.
Category notes, labels, output-spec
Song, MT, Acting, Dance
VOICE-SYN-F01; 0A–0E
F01
High
Implement
Compatible
P0
No field rename or schema change.
Add semantic guardrail.
Display verification later.
VOICE-AUDIT-R02
Require vocal-plus-interpretive Song evidence
I02
Require Song feedback to include vocal technique plus lyric/story evidence where assessable.
Phrase, lyric, musical moment, objective/addressee or communication evidence.
Vocal, acting/storytelling, component notes
Song, MT
VOICE-S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
F02, F04
High
Implement
Compatible
P0
No new score field.
Strengthen evidence rules.

VOICE-AUDIT-R03
Expand descriptor specificity
I03, I17
Add descriptor spine: pitch/intonation, rhythm/time, tone, diction, phrasing/shape, communication and interpretation.
Timestamp, phrase or material moment.
Category notes, strengths, improvements
Song, MT
VOICE-S021, S023, S025, S026, S027, S029
F03, F16
High
Implement
Compatible
P0
Do not import marks/grades.
Use descriptors only.

VOICE-AUDIT-R04
Preserve song-framed acting-through-song
I04
Keep acting/storytelling inside Song, but block acting-scene terminology unless spoken acting exists.
Lyric, addressee, character-through-song, phrase behaviour.
Acting/storytelling, component notes
Song-only, MT
VOICE-S002, S009, S010, S017, S021, S023, S026, S027, S035, S036, S040
F04
High
Implement
Compatible
P0
Protect Acting branch.
Add leakage boundary.

VOICE-AUDIT-R05
Make musical interpretation visible without new field
I05
Require musical interpretation to be expressed through existing vocal/story/component wording.
Phrasing, dynamic shape, style, lyric communication.
Vocal, acting/storytelling, component notes
Song, MT
VOICE-S021, S023, S025, S026, S027, S029
F02, F03, F04
High
Implement
Compatible
P1
No separate musical-interpretation field.
Use existing sections.

VOICE-AUDIT-R06
Add cautious style/subtype handling
I06, I16
Use style/subtype only where brief, material or observable evidence supports it; otherwise use cautious fallback.
Known style/material, brief, audible stylistic features.
Style/material notes, category notes
Classical/legit, contemporary MT, art song, commercial/pop, actor-musician
VOICE-S001–S020, S021–S031, S035, S039, S040
F05, F06, F14
Medium-high
Implement
Compatible
P1
Do not universalise school taste.
Add style-confidence rule.

VOICE-AUDIT-R07
Limit belt/mix/registration claims
I06, I07
Suppress detailed belt/mix/registration claims unless clearly observable and context-supported; defer detailed sub-rubrics.
Clear audible register/style evidence.
Vocal notes
Belt, mix, registration
VOICE-S013, S014, S035, S036
F06
Medium-low
Suppress conditionally / defer
Compatible
P1
Avoid false precision.
Add limitation note.
Evidence thin.
VOICE-AUDIT-R08
Separate assessability from vocal merit
I08
Audio/technical limitations should affect assessability/reliability, not automatically vocal quality.
Audio clarity, balance, room, device/visibility evidence.
Audio, technical, vocal
All singing contexts
VOICE-S003, S005, S011, S023, S024, S027, S032, S040, S041
F07, F08
High
Implement
Compatible
P0
No cap change.
Strengthen wording and reliability boundary.

VOICE-AUDIT-R09
Block polish/resource as vocal merit
I08, I14
Production polish, paid resources, kit quality, studio access or home aesthetics must not be vocal merit.
Only assessability facts.
Presentation, technical, audio
All singing contexts
VOICE-S003, S005, S009, S033, S040, S041, S047, S048, S051
F13
High
Implement
Compatible
P0
No presentation scoring expansion.
Add anti-polish guardrail.

VOICE-AUDIT-R10
Treat accompaniment as context-specific
I09
Judge accompaniment/backing/self-accompaniment against task context, not universal preference.
Brief/task requirement, actual balance, visible self-accompaniment.
Audio, brief/material, vocal
Backing track, live piano, a cappella, actor-musician
VOICE-S001, S003, S006, S009, S011, S015, S018, S039, S040, S041
F09
High
Implement
Compatible
P1
No universal accompaniment rule.
Add context-specific guidance.

VOICE-AUDIT-R11
Block live-room/process overclaim
I10
Do not infer stamina, direction response, learning speed, sight-singing, aural skill, callback readiness or training potential from finished tape.
Direct evidence of that process required.
Headline, strengths, risk, next take
Song, MT
VOICE-S001, S004, S006, S015, S016, S017, S020, S033, S037, S039, S040, S041
F10
High
Implement
Compatible
P0
Allow only directly shown process.
Add process-only suppression rule.

VOICE-AUDIT-R12
Codify no-diagnosis vocal-health language
I11
Permit cautious observable strain-like/fatigued-sound language only; block pathology, medical status and advice.
Audible observation only; no cause inference.
Vocal, improvements, safety
All singing contexts
VOICE-S043–S046
F11
High
Implement
Compatible
P0
No medical advice.
Add explicit no-diagnosis block.

VOICE-AUDIT-R13
Codify access-safe inclusive voice handling
I12
Treat disability, neurodivergence, hearing access, communication support and reasonable adjustments as access context, not performance deficit.
Observable performance evidence only; access context where supplied.
Safety, accessibility, presentation
All
VOICE-S046–S049, S051
F12
High
Implement
Compatible
P0
Guardrail only.
Add non-deficit rule.

VOICE-AUDIT-R14
Block accent hierarchy and speech-difference deficit inference
I13
Diction/intelligibility feedback must not imply accent prestige or speech-difference deficit.
Lyric/text intelligibility in task context.
Diction, vocal, accessibility
Song, MT
VOICE-S050
F12
Medium-high
Implement
Compatible
P0
Wider speech-difference evidence is partial.
Add anti-accent hierarchy rule.

VOICE-AUDIT-R15
Block gendered voice/body/voice-type overclaim
I14
Do not infer gender, body, appearance, age, identity, marketability or role readiness from voice type, range or tone.
Explicit brief vocal demand plus observable vocal evidence only.
Vocal, role-fit, brief/material
Song, MT
VOICE-S049, S043, S050
F12, F13
Medium-high
Implement
Compatible
P0
Role-fit bounds unchanged.
Add identity/body/voice-type block.

VOICE-AUDIT-R16
Strengthen repertoire and fixed-material boundaries
I15, I16
Separate fixed material, choice material, school/open-call restrictions and repertoire taste.
Brief/material evidence.
Brief/material notes, next take, improvements
Song, MT
VOICE-S009, S010, S015, S035, S036, S039, S040, S041
F05, F15
High
Implement
Compatible
P0
No alternative material advice in fixed tasks.
Add false-specificity guardrail.

VOICE-AUDIT-R17
Suppress generic vocal praise unless evidence anchored
I03, I17
Every substantive praise/criticism must attach to observable phrase, timestamp, lyric, vocal choice, style or assessability evidence.
Observable anchor.
Headline, category notes, strengths, improvements, fix-first
Song, MT
VOICE-S021, S023, S025, S026, S027, S029; 0D
F03, F16
High
Implement
Compatible
P0
Existing generic scrub is not enough.
Add explicit anti-generic standard.

VOICE-AUDIT-R18
Strengthen timestamp and next-take specificity
I17, I18
Timestamped notes and next-take actions should tie to phrase, lyric, vocal/story choice, accompaniment or assessability evidence.
Moment-specific evidence; chronological order.
Timestamped notes, next-take plan
Song, MT
0D, 0E, Report-Polish, Report-quality
F16, F17
Medium
Implement
Compatible
P0
Do not exceed max 8.
Improve evidence density, not cap.
Rendering still unverified.
VOICE-AUDIT-R19
Carry display/render checks into output-spec
I18, I19
Output-spec must verify labels, comparison parity, timestamp rendering and export/PDF behaviour.
Rendered outputs required later.
Display, comparison, export
All
0D, 0E, supplied code snippets
F17
Medium
Defer to output-spec
Compatible
P0
Not solved by baseline wording alone.
Create VOICE-OS checks later.

VOICE-AUDIT-R20
Preserve cross-discipline label non-regression
I01, I20
Voice revisions must not hide MT Vocal, create Acting singing labels, or show singing/voice labels for Dance-only where absent.
Audition type/component context.
Labels, category notes, comparison
Song, MT, Acting, Dance
VOICE-SYN-F01; cross-branch handoffs
F01, F17
High
Preserve only / implement guardrail
Compatible
P0
No UI proposal here.
Add final-audit watch item.

VOICE-AUDIT-R21
Preserve Step 2 locked-evidence and scrub strengths
I03, I11, I17, I18
Preserve existing locked-evidence, timestamp, presentation and unsupported-claim safeguards while adding Voice-specific guidance.
Locked Step 1 evidence.
Step 2 report wording
All
Report-Polish.Server.ts; Report-quality.server.ts
F16, F17
High
Preserve only / implement guardrail
Compatible
P0
Do not weaken existing safeguards.
Explicitly preserve in VOICE-REV.


8. Recommendation Classification Table
Recommendation ID
Classification
Why this classification was assigned
Evidence confidence
Baseline compatibility
Priority
Carry to VOICE-REV?
If no, why not?
Final-audit watch item?
R01
Implement
Field semantics risk is high and wording-compatible.
High
Compatible
P0
Yes
—
Yes
R02
Implement
Strong evidence that Song is vocal-plus-interpretive.
High
Compatible
P0
Yes
—
Yes
R03
Implement
Formal descriptor spine is strong.
High
Compatible
P0
Yes
—
Yes
R04
Implement
Acting-through-song is supported, but leakage risk is real.
High
Compatible
P0
Yes
—
Yes
R05
Implement
Musical interpretation can be surfaced through existing fields.
High
Compatible
P1
Yes
—
Yes
R06
Implement
Style evidence is real but must be cautious.
Medium-high
Compatible
P1
Yes
—
Yes
R07
Suppress conditionally / defer
Belt/mix/registration detail remains thin.
Medium-low
Compatible
P1
Yes
—
Yes
R08
Implement
Assessability-first evidence is strong.
High
Compatible
P0
Yes
—
Yes
R09
Implement
Anti-polish/resource evidence is strong.
High
Compatible
P0
Yes
—
Yes
R10
Implement
Accompaniment rules are clearly contextual.
High
Compatible
P1
Yes
—
Yes
R11
Implement
Live-room/process boundary is strongly evidenced.
High
Compatible
P0
Yes
—
Yes
R12
Implement
No-diagnosis boundary is safety-critical and well supported.
High
Compatible
P0
Yes
—
Yes
R13
Implement
Access-safe handling is strongly supported.
High
Compatible
P0
Yes
—
Yes
R14
Implement
Accent hierarchy must be blocked; evidence is medium-high.
Medium-high
Compatible
P0
Yes
—
Yes
R15
Implement
Voice-type/gender/body assumptions require explicit blocking.
Medium-high
Compatible
P0
Yes
—
Yes
R16
Implement
Fixed-material and repertoire false-specificity risks are high.
High
Compatible
P0
Yes
—
Yes
R17
Implement
Generic vocal praise is a core output failure mode.
High
Compatible
P0
Yes
—
Yes
R18
Implement
Timestamp/next-take specificity can improve within existing limits.
Medium
Compatible
P0
Yes
—
Yes
R19
Defer to output-spec
Display/rendering cannot be verified in this audit.
Medium
Compatible
P0
No as revision wording only
Carry into VOICE-OS.
Yes
R20
Preserve only / implement guardrail
Cross-discipline label stability must be preserved.
High
Compatible
P0
Yes
—
Yes
R21
Preserve only / implement guardrail
Existing Step 2 and deterministic scrub safeguards are valuable.
High
Compatible
P0
Yes
—
Yes

9. Evidence-to-Audit Traceability Matrix
Source ID(s) / baseline evidence
VOICE-SYN finding ID(s)
Audit issue ID(s)
Audit recommendation ID(s)
Evidence summary
Source-family type
Confidence
Limitation / note
VOICE-S001–VOICE-S020
F02, F04, F05, F06, F09, F10, F15
I02, I04, I06, I09, I10, I15, I16
R02, R04, R06, R10, R11, R16
Admissions support contrast, acting-through-song, accompaniment variability, task-aware material and live-room boundaries.
Admissions / programmes
High
School rules are contextual.
VOICE-S021, S023, S025, S026, S027, S029
F02, F03, F04, F14, F16
I02, I03, I04, I05, I16, I17
R02, R03, R04, R05, R17
Formal frameworks support pitch/rhythm/tone/diction/phrasing plus communication/interpretation descriptors.
Formal frameworks
High
Marks and grades excluded.
VOICE-S024, S028
F03, F06, F14
I03, I06, I16
R03, R06
Useful but partial formal descriptor/style evidence.
Formal frameworks
Medium
Public evidence thinner.
VOICE-S030, S031
F14
I16
R06, R16
No safe positive extraction; reinforces source-boundary caution.
Closed non-positive rows
Low
Do not use as evidence.
VOICE-S032–S041
F07, F08, F09, F10, F13, F15
I08, I09, I10, I15
R08, R09, R10, R11, R16
Professional/process evidence supports assessability-first, anti-polish, accompaniment context and callback/process boundaries.
Professional / self-tape / open-call
High
Some practitioner/opera-shaped limitations.
VOICE-S034, S037, S041
F07, F10, F13
I08, I10
R08, R11
Useful but limited process evidence.
Partial/provenance-limited process sources
Medium
Snippet, opinion/paywall, opera/remote-context limitations.
VOICE-S043–S046
F11
I11
R12
Strong no-diagnosis and professional-support boundary.
Vocal-health / clinical / performer-health
High
Safety-only, not scoring.
VOICE-S046–S049
F12
I12, I14
R13, R15
Access, disability, neurodivergence, hearing access and gender-diverse voice are non-deficit contexts.
Accessibility / identity / hearing access
High
Guardrail-only.
VOICE-S050
F12
I13
R14
Accent hierarchy must not drive competence judgements.
Accent-bias source
Medium-high
Hiring-context-led.
VOICE-S051
F13
I08, I14
R09, R13
Device, data and assistive-tech access affect assessability and participation.
Resource inequality / digital access
Medium
Broad, not narrow song-tape guidance.
VOICE-S052
F17 / limitation
I18, I19
R19
No source supplied; no positive evidence.
Not found
Low
Provenance limitation only.
Report-Polish.Server.ts
F16, F17
I17, I18
R18, R21
Step 2 uses locked evidence, cannot invent timestamps, and limits arrays.
Current implementation snippet
High
Does not verify live output density.
Report-quality.server.ts
F15, F16, F17
I15, I17, I18
R17, R18, R21
Deterministic scrubs for visual details, page/side references, frame-breaking advice and timestamp ordering.
Current implementation snippet
High
Not Voice-specific generic suppression.
0D / 0E
F16, F17
I17, I18, I19, I20
R17, R18, R19, R20
Generic praise, false specificity, timestamp and display risks.
Baseline/output-risk control
Medium-high
Live Voice outputs absent.

10. Source-Type Boundary and Overreach Check
Source type
Source IDs
Audit use allowed
Audit use blocked
Overreach risk
Required handling in VOICE-REV
Official admissions / programme sources
VOICE-S001–S020
Real audition asks, contrast, accompaniment, song cuts, acting-through-song, process boundaries.
Universal school preferences, exact song-count/cut/era rules as scoring.
High
Treat as contextual evidence.
Formal exam frameworks
VOICE-S021–S031
Descriptor vocabulary and prepared-performance boundaries.
Marks, grades, levels, percentages or exam structures as TapeCoach scoring.
Very high
Use descriptors only.
Professional / practitioner advice
VOICE-S035–S037
Practical lyric/story phrasing, song choice cautions, self-tape craft.
Practitioner taste or repertoire lists as universal scoring.
High
Use only where convergent or clearly bounded.
Union / professional-body process guidance
VOICE-S033, S034, S046
Fair process, burden, access, no-polish, health boundaries.
Vocal technique scoring.
Medium
Use as guardrail/process evidence.
Self-tape / recorded-audio guidance
VOICE-S032, S038, S040, S041
Assessability, audio balance, framing, simple capture.
Production polish as merit.
High
Keep in technical/audio/reliability logic.
Open-call / production-specific guidance
VOICE-S039, S040
Brief-specific song length, style, bans, callback process.
Global rules for all Song reports.
Very high
Treat as brief-specific only.
Vocal-health / clinical-information sources
VOICE-S043–S046
No-diagnosis, cautious observation, referral boundary.
Diagnosis, treatment advice, health scoring.
Critical
Safety-only guardrail.
Accessibility / disability / inclusive music sources
VOICE-S046, S048, S051
Reasonable adjustments, access support, barrier removal.
Access needs as merit/deficit.
Critical
Non-deficit language only.
Hearing-access sources
VOICE-S047
Captions, speech-to-text, sign interpretation and assistive listening as legitimate supports.
Hearing ability as score factor.
Critical
Access-only guardrail.
Gender-diverse / trans voice sources
VOICE-S049
Identity-led voice handling and anti-stereotype caution.
Gendered voice norms or role-fit assumptions.
Critical
Guardrail only.
Accent / speech-difference sources
VOICE-S050
Accent hierarchy block; objective intelligibility handling.
Standard accent as vocal excellence.
Critical
Diction without accent hierarchy.
Resource-inequality / digital-access sources
VOICE-S051
Devices, data, assistive technology and equipment access as fairness context.
Technical privilege as vocal merit.
High
Strengthen anti-polish wording.

11. Baseline Compatibility Check
Baseline constraint
Affected by any recommendation?
Compatible?
Reason
Required handling
Priority
Six score fields
Yes
Yes
Recommendations clarify field meaning only.
No new fields.
P0
Song weights
Yes
Yes
No weighting changes recommended.
Preserve vocal 45%, acting/storytelling 15%, technical 20%, brief 10%, audio 10%.
P0
MT weights
Yes
Yes
No weighting changes recommended.
Preserve acting 30%, vocal 30%, brief 15%, technical 15%, audio 10%.
P0
Server-side recomputation
No
Yes
No scoring authority change.
Preserve.
P0
Caps / blockers / verdicts
No
Yes
No threshold changes.
Preserve.
P0
Role-fit bounds
Yes
Yes
Recommendations block overclaim but do not alter bounds.
Preserve -10 to +5 and baseline zero.
P0
Step 1 / Step 2 pipeline
Yes
Yes
Recommendations reinforce locked evidence, not pipeline.
Preserve.
P0
Locked-field enforcement
Yes
Yes
Recommendations rely on locked evidence.
Preserve and do not weaken.
P0
Report schema / public JSON
Yes
Yes
Existing sections can carry improved wording.
No schema/public JSON change.
P0
Material-policy guardrails
Yes
Yes
Recommendations strengthen existing fixed-material protection.
Preserve.
P0
Safety / accessibility scrubs
Yes
Yes
Recommendations strengthen guardrails.
Preserve and refine wording.
P0
MT acting + song flow
Yes
Yes
Recommendations protect Vocal visibility.
Preserve MT anchor.
P0
Acting spoken-only label containment
Yes
Yes
Recommendations protect speech-delivery distinction.
Preserve.
P0
Dance no-singing label protection
Yes
Yes
Recommendations prevent singing-label leakage.
Preserve.
P0
External marks / grades / percentages
Yes
Yes
Explicitly excluded.
Do not import.
P0
No-diagnosis boundary
Yes
Yes
Strongly supported and compatible.
Add explicit Voice guardrail.
P0
Anti-polish / resource-equity boundary
Yes
Yes
Strongly supported and compatible.
Treat polish as assessability only.
P0

12. Areas Not to Change Yet Because Evidence Is Insufficient
Area
Why evidence is insufficient or source-shaped
Related limitation theme
Related source ID(s)
Risk if over-implemented
Later handling
Note
Detailed belt criteria
Evidence is thin and partly example/practitioner-shaped.
Thin belt evidence
VOICE-S013, S014, S035, S036
False precision and genre bias.
Suppress conditionally / carry as limitation
Allow only clearly observable, context-supported reference.
Detailed mix criteria
Limited source support.
Mix evidence thin
VOICE-S013, S035
Unsupported technical labelling.
Defer
No detailed mix rubric.
Detailed registration language
Formal evidence does not support detailed universal registration rules.
Registration detail thin
VOICE-S021 and limited related evidence
Pedagogy/method overreach.
Defer
Use plain observable language.
Rich jazz vocal descriptor rubric
Jazz appears, but descriptors remain sparse.
Jazz descriptors uneven
VOICE-S010, S013, S018, S035
Invented jazz criteria.
Carry as limitation / future research

Rich folk vocal descriptor rubric
Folk appears mostly as repertoire option.
Folk descriptors thin
VOICE-S013, S014, S015, S035
Unsupported folk rubric.
Carry as limitation

Broad commercial/pop vocal descriptor rubric
Evidence exists but is uneven and style-shaped.
Commercial/pop descriptors uneven
VOICE-S010, S014, S020, S029, S035, S039
Marketability or taste leakage.
Suppress conditionally / future research

Actor-musician full rubric
Evidence is partial and route-specific.
Actor-musician evidence partial
VOICE-S006, S017, S018, S041
Instrument skill wrongly folded into Song score.
Defer
Context only.
Vocal-health scoring
Health sources are safety/clinical boundaries, not scoring criteria.
No-diagnosis boundary
VOICE-S043–S046
Medicalisation.
Suppress conditionally
Do not score health.
Stamina scoring from short tapes
Stamina is process/long-form evidence.
Live-room capacities
VOICE-S016, S041, S043–S046
Overclaim from one song take.
Suppress conditionally

Voice type / range as role-fit proxy
Voice type/range can become gender/body/role stereotype.
Gender/body/voice assumptions
VOICE-S049, S043
Bias and false casting fit.
Suppress conditionally
Only explicit brief vocal demands.
Gendered voice norms
Evidence supports identity-led handling, not norms.
Gender-diverse voice caution
VOICE-S049
Misgendering and stereotype scoring.
Suppress conditionally

Exact external grade/mark/percentage imports
Formal frameworks are not TapeCoach weights.
External framework boundary
VOICE-S021–S031
Weight/score regression.
Block

Universal song contrast rule
Contrast is recurring but non-uniform.
Song contrast non-uniform
VOICE-S001–S020
False requirements.
Suppress conditionally
Context-led only.
Universal repertoire-choice rule
Repertoire advice is source/context-shaped.
Repertoire boundary
VOICE-S035, S036, S039, S040
Bad advice under fixed material.
Suppress conditionally

Universal accompaniment rule
Accompaniment rules vary widely.
Context-specific accompaniment
VOICE-S001, S003, S006, S009, S015, S018, S039, S040, S041
Penalising valid formats.
Suppress conditionally


13. Generic-Feedback Audit
Generic phrase / risk
Current baseline vulnerability
Evidence required to make it acceptable
Related VOICE-SYN finding ID(s)
Related audit issue ID(s)
Related recommendation ID(s)
Severity
Revision instruction
strong vocal control
Can survive as generic praise.
Pitch/rhythm/tone/phrase evidence.
F03, F16
I03, I17
R03, R17
High
Anchor to observable moment.
lovely tone
Taste-shaped and vague.
Specific tonal quality, range/phrase context, recording caveat.
F03, F16
I03, I17
R03, R17
High
Replace with observable sound description.
good breath support
Method-loaded and vague.
Phrase-length, breath release, continuity or audibility evidence.
F03, F11
I03, I11, I17
R03, R12, R17
High
Avoid diagnosis or prescriptive technique.
secure pitch
Generic unless phrase-based.
Phrase/timestamp or intonation example.
F03
I03, I17
R03, R17
High
Anchor to sung moment.
emotional connection
Vague.
Lyric intention, addressee, dynamic/phrase choice.
F02, F04, F16
I02, I04, I17
R02, R04, R17
High
Use lyric/story evidence.
powerful belt
Thin evidence and false-label risk.
Clear style context and audible belt evidence.
F06
I07, I17
R07, R17
Medium-high
Suppress unless clear.
nice mix
Thin evidence and method label risk.
Clear, source-supported mix evidence; otherwise avoid.
F06
I07
R07
Medium
Usually defer.
good legit quality
Style/taste risk.
Legit/classical context plus diction/tone/line evidence.
F06
I06, I17
R06, R17
Medium-high
Contextualise.
expressive singing
Generic.
Dynamics, phrase shape, lyric or character evidence.
F02, F03, F16
I02, I03, I17
R02, R03, R17
High
Anchor to phrase/lyric.
great musicality
Generic.
Rhythm, phrasing, tempo, style, communication evidence.
F03, F16
I03, I17
R03, R17
High
Replace with evidence.
strong storytelling
Generic.
Addressee, objective, lyric turn, emotional arc.
F02, F04, F16
I02, I04, I17
R02, R04, R17
High
Keep song-framed.
professional song choice
Repertoire-taste risk.
Choice-material context and task evidence.
F05, F15
I15, I16
R16
High
Avoid if material fixed.
perfect song choice
Absolute and false-specific.
Rarely acceptable; requires explicit choice context and strong evidence.
F15
I15
R16
High
Block or make cautious.
vocal health sounds good
Medicalised.
Not acceptable as health judgement.
F11
I11
R12
Critical
Block.
ready because of voice type
Role-fit/body/gender risk.
Explicit brief vocal demand plus observable evidence; no identity inference.
F12, F13
I14
R15
Critical
Block as default.
strong presence
Appearance/charisma risk.
Specific communication, focus, lyric address or performance behaviour.
F03, F16
I17
R17
High
Anchor to behaviour.
clean audio as vocal merit
Audio/vocal conflation.
Audio clarity can support assessability only.
F07, F08, F13
I08
R08, R09
Critical
Separate categories.
technically excellent vocal performance
Generic and inflated.
Specific technical descriptors and phrase evidence.
F03, F16
I03, I17
R03, R17
High
Replace with concrete anchors.

14. False-Specificity and Material-Policy Audit
Risk
Why it is false-specificity or material-policy risk
Source/evidence boundary
Current baseline coverage
Required recommendation or defer note
Related VOICE-SYN finding ID(s)
Related audit issue/recommendation ID(s)
Severity
Invented song-title or repertoire claims
Sounds precise but may not be grounded.
Brief, slate, known material or intelligible lyric evidence required.
General unsupported-claim guardrail.
Add Song-specific grounding rule.
F15, F16
I15 / R16, R17
High
“Perfect song choice”
Absolute, taste-shaped and often unsupported.
Choice-material context only, and still should avoid absolutes.
Partial.
Block or make evidence-led and cautious.
F15
I15 / R16
High
Alternative material suggestions where material is fixed
Violates material policy.
Fixed material controls the task.
Strong baseline rule, needs Voice-specific reinforcement.
Preserve and strengthen.
F15
I15 / R16
Critical
Invented time limit or cut breach
False precision if no explicit limit.
Only explicit brief/source requirement.
0D flags this risk.
Add output-spec test.
F15, F17
I15, I18 / R16, R19
High
Universal 16-bar / 32-bar / 60–90s rule
Cut lengths vary across sources.
Context-specific only.
Weak.
Suppress universalisation.
F05, F15
I15, I16 / R16
High
Universal pre-/post-era rule
Era contrast is programme-specific.
Admissions-specific evidence only.
Weak.
Suppress universalisation.
F05, F06
I06, I16 / R06, R16
High
Invented role or casting fit from song style
Style alone cannot prove casting fit.
Needs brief/material plus observable evidence.
Role-fit guardrails exist but need Voice-specific reinforcement.
Strengthen.
F12, F15
I14, I15 / R15, R16
High
Unsupported voice-type suitability
Can encode gender/body/type bias.
Explicit brief vocal demands only.
Weak.
Block default voice-type role-fit.
F12, F13
I14 / R15
Critical
School-specific song bans as universal rules
Source-specific bans do not generalise.
Programme/open-call context only.
Weak.
Add source-type caution.
F05, F14, F15
I16 / R06, R16
High
Production/open-call restrictions treated as global rules
Show-specific restrictions are brief/process rules only.
Open-call brief only.
Partial.
Treat as brief-specific.
F09, F15
I09, I15 / R10, R16
High

15. Safety, Accessibility and Anti-Bias Audit
Safety/fairness risk
Current baseline coverage
Evidence from VOICE-SYN
Gap
Required recommendation or guardrail
Related source ID(s)
Related VOICE-SYN finding ID(s)
Related audit issue/recommendation ID(s)
Priority
No vocal-health diagnosis
General 0E caution; not explicit in Voice slice/polish prompt.
Strong no-diagnosis boundary.
Voice-specific operational wording needed.
Codify no diagnosis and no medical advice.
VOICE-S043–S046
F11
I11 / R12
P0
Strain-like sound / fatigue / hoarseness wording
Weak.
Observation-only, no pathology.
Needs safe phrasing rule.
Cautious observation only.
VOICE-S043–S046
F11
I11 / R12
P0
Respiratory / convalescence inference
Missing.
Cannot infer health state from tape.
Explicit block needed.
Block respiratory/convalescence/illness inference.
VOICE-S044, S045
F11
I11 / R12
P0
Hearing difference
General access guardrail.
Hearing access tools are legitimate supports.
Voice-specific handling needed.
Do not treat hearing access as deficit.
VOICE-S047
F12
I12 / R13
P0
Speech difference
Partial.
Non-deficit handling required.
Evidence thinner than accent evidence.
Treat as access/communication context, not weak singing.
VOICE-S050, S047
F12
I13 / R14
P0
Accent / dialect bias
Missing in Voice slice.
Accent prestige is social, not competence.
Explicit block needed.
Separate intelligibility from accent hierarchy.
VOICE-S050
F12
I13 / R14
P0
Neurodivergence
General protected-trait guardrail.
Neurodiversity as variation, not deficit.
Voice-specific output rule needed.
Treat supports/adaptations as access context.
VOICE-S046, S048, S051
F12
I12 / R13
P0
Disability / access support
General guardrail.
Reasonable adjustments are fairness.
Needs Voice-specific phrasing.
Do not score access/support use.
VOICE-S046, S048, S051
F12
I12 / R13
P0
Visual impairment if relevant
General guardrail.
Evidence indirect via adaptive equipment/access.
Partial.
Treat as access support, not deficit.
VOICE-S046, S051
F12
I12 / R13
P1
Gender-diverse / trans voice
Missing.
Identity-led and non-stereotyped handling.
Explicit block needed.
No gendered voice norms.
VOICE-S049
F12
I14 / R15
P0
Body / appearance and voice assumptions
General anti-bias guardrail.
Voice should not imply body, identity or competence.
Voice-specific block needed.
Block body/type/appearance/marketability inference.
VOICE-S049, S050
F12, F13
I14 / R15
P0
Age / voice maturity assumptions
Weak.
Age/adolescent voice can vary.
Needs caution.
Do not infer maturity, decline or readiness from sound alone.
VOICE-S043
F11, F12
I14 / R15
P1
Assistive technology
General access guardrail.
Assistive tech is legitimate support.
Needs non-merit/non-deficit wording.
Treat as access context.
VOICE-S047, S048, S051
F12, F13
I12 / R13
P0
Reasonable adjustments
General access guardrail.
Proactive fairness, not special pleading.
Needs explicit Voice use.
Non-deficit; no scoring penalty.
VOICE-S046, S048
F12
I12 / R13
P0
Backing-track / accompanist inequality
Partly addressed through anti-polish.
Evidence partial but supports caution.
Needs limitation-aware guardrail.
Do not treat paid/accompanist access as vocal merit.
VOICE-S041, S051
F09, F13
I09, I14 / R09, R10
P1
Recording-equipment inequality
Partly addressed in code and baseline.
Device/equipment access is unequal.
Needs output guardrail.
Separate assessability from kit quality.
VOICE-S032, S040, S041, S051
F07, F08, F13
I08 / R08, R09
P0
Home setup / low-resource recording
Partly addressed.
Simple/home capture can be acceptable if assessable.
Needs anti-polish reinforcement.
Do not penalise home setup if assessable.
VOICE-S003, S005, S009, S033, S040, S041, S051
F07, F13
I08, I14 / R08, R09
P0

16. Tape-Observable versus Process-Only Audit
Capacity / evidence type
Current baseline treatment
Source-supported boundary
Tape-observable?
Risk if mishandled
Related VOICE-SYN finding ID(s)
Related audit issue/recommendation ID(s)
Required later output test?
Pitch
Named broadly.
Assess only when audio/reference supports it.
Yes
Poor audio becomes pitch criticism.
F03, F08
I03, I08 / R03, R08
Yes
Rhythm
Under-specified.
Observable with clear pulse/track.
Yes
Confused with musicianship/aural ability.
F03, F10
I03, I10 / R03, R11
Yes
Tone
Named broadly.
Recording/room can distort tone.
Partial
Tech/room mistaken for vocal quality.
F03, F08
I03, I08 / R03, R08
Yes
Diction
Named, but no anti-accent guardrail.
Intelligibility without accent hierarchy.
Yes
Accent bias.
F03, F12
I03, I13 / R03, R14
Yes
Lyric intention
Named.
Must be tied to lyric/phrase/addressee.
Yes
Invented intention.
F02, F04
I02, I04 / R02, R04
Yes
Acting-through-song
Recognised.
Song-framed only.
Yes
Acting-scene leakage.
F04
I04 / R04
Yes
Style fit
Gap.
Context-supported only.
Partial
Universal style rules.
F05, F06
I06 / R06
Yes
Song choice suitability
Partial.
Fixed/choice context required.
Partial
Repertoire overreach.
F15
I15 / R16
Yes
Range / tessitura
Named.
Only what material exposes.
Partial
Role/voice-type overclaim.
F03, F12
I14 / R15
Yes
Belt / mix / legit
Gap.
Use only if clear and supported.
Partial
False technical labels.
F06
I07 / R07
Yes
Vocal health
General diagnostic block only.
Safety-only; no diagnosis.
No / partial
Medical claims.
F11
I11 / R12
Yes
Stamina
Not clearly ring-fenced.
Process/long-form evidence.
No / partial
Full-show readiness overclaim.
F10, F11
I10, I11 / R11, R12
Yes
Response to direction
Not fully ring-fenced.
Live-room only unless directly shown.
No
Redirection overclaim.
F10
I10 / R11
Yes
Learning speed
Not addressed.
Workshop/process-only.
No
Training potential overclaim.
F10
I10 / R11
Yes
Aural skills
Not addressed.
Formal/process-only.
No
Musicianship overclaim.
F10
I10 / R11
Yes
Sight-singing
Not addressed.
Formal/process-only.
No
Overclaim from prepared tape.
F10
I10 / R11
Yes
Musicianship
Indirect.
Some musical behaviour visible; formal tests are not.
Partial
Overclaim beyond tape.
F10
I10 / R11
Yes
Callback readiness
Not addressed.
Process-only.
No
Casting overclaim.
F10
I10 / R11
Yes
Training potential
Not addressed.
Admissions/process-only.
No
Inflated readiness claims.
F10
I10 / R11
Yes
Professional readiness
Presentation/pro standards exist.
Observable compliance only; not polish/class-coded cues.
Partial
Class-coded professionalism.
F07, F13
I08, I14 / R09
Yes
Access needs
General guardrail.
Access/process only, not merit/deficit.
No as merit
Access treated as weakness.
F12
I12 / R13
Yes
Recording setup / equipment access
Technical/presentation.
Assessability only.
Partial
Equipment as vocal quality.
F07, F08, F13
I08 / R08, R09
Yes

17. Provisional Non-Regression Test Map
Audit test ID
Scenario
Risk tested
Expected compliant output behaviour
Expected blocked behaviour
Related VOICE-SYN finding ID(s)
Related issue ID(s)
Related recommendation ID(s)
Priority
Later output-spec relevance
VOICE-AUDIT-T01
Song-only tape with no spoken acting
Song/Acting leakage
Vocal plus lyric/storytelling only.
Reader/scene/dialogue notes.
F01, F04
I01, I04
R01, R04
P0
Core output test.
VOICE-AUDIT-T02
Song-only report using acting-scene language
Acting leakage
Reframe to lyric/addressee/character through song.
“Scene partner”, “reader”, “dialogue beat” without spoken acting.
F04
I04
R04
P0
Required.
VOICE-AUDIT-T03
MT acting + song report where Vocal must remain visible
MT regression
Acting and Vocal both visible.
Vocal hidden or relabelled away where singing exists.
F01
I01, I20
R01, R20
P0
Protected MT anchor.
VOICE-AUDIT-T04
Acting/Monologue report where singing label must not appear
Acting label regression
Speech delivery only.
Singing / vocal-performance wording.
F01
I01, I20
R01, R20
P0
Cross-branch test.
VOICE-AUDIT-T05
Dance-only report where singing/voice label must not appear
Dance label regression
Movement/technique semantics only.
Singing/voice label where no singing exists.
F01
I01, I20
R01, R20
P0
Cross-branch test.
VOICE-AUDIT-T06
Technically clear but generic vocal report
Genericity
Phrase/timestamp/style anchors.
“Strong vocal control”, “lovely tone” alone.
F03, F16
I03, I17
R03, R17
P0
Generic-praise test.
VOICE-AUDIT-T07
Poor audio / poor track balance
Audio-vocal conflation
Assessability/reliability caveat.
Weak pitch/tone claim from poor audio alone.
F07, F08
I08
R08
P0
Assessability test.
VOICE-AUDIT-T08
Strong production polish but weak vocal/story evidence
Polish bias
Evaluate performance evidence, not finish.
Reward studio sound as vocal merit.
F08, F13
I08, I14
R09
P0
Anti-polish.
VOICE-AUDIT-T09
Simple home recording that is assessable
Resource bias
Accept simple capture if readable.
Penalise phone/home setup as unprofessional.
F07, F13
I08
R08, R09
P0
Fairness.
VOICE-AUDIT-T10
Fixed-material brief receives alternative song advice
Material-policy breach
Improve submitted material only.
Suggest another song.
F15
I15
R16
P0
Fixed-material test.
VOICE-AUDIT-T11
No-brief song report invents role/song-choice requirements
False specificity
No invented role, repertoire or casting fit.
Unsupported “perfect for this role”.
F15, F16
I15
R16, R17
P0
No-brief test.
VOICE-AUDIT-T12
Song cut too short to support full emotional arc
Overclaim
Note limited arc evidence.
Full journey claim from tiny extract.
F02, F15
I02, I15
R02, R16
P1
Cut-aware test.
VOICE-AUDIT-T13
Belt/mix label used without evidence
False technical label
Avoid or caveat label.
Unsupported “powerful belt” / “nice mix”.
F06
I07
R07
P1
Thin-evidence test.
VOICE-AUDIT-T14
Classical/legit criteria imposed on pop/MT material
Style overreach
Use task-supported style.
Classical purity criteria imposed globally.
F05, F06
I06
R06
P1
Style test.
VOICE-AUDIT-T15
Pop/commercial criteria imposed on classical/legit material
Style overreach
Use source-supported classical/legit context.
Commercial authenticity as universal standard.
F05, F06
I06
R06
P1
Style test.
VOICE-AUDIT-T16
Accompaniment absent where task allows unaccompanied singing
Accompaniment bias
Treat unaccompanied as valid if context allows.
Penalise absence of track/piano as talent issue.
F09, F13
I09
R10
P1
Accompaniment test.
VOICE-AUDIT-T17
Paid accompanist / professional track treated as merit
Resource bias
Assess balance/readability only.
Reward paid resources.
F09, F13
I09, I14
R09, R10
P0
Resource-equity test.
VOICE-AUDIT-T18
Vocal-health diagnosis or pathology inferred
Safety breach
No diagnosis; cautious observation only.
“Nodules”, “laryngitis”, “damaged voice”.
F11
I11
R12
P0
Safety-critical.
VOICE-AUDIT-T19
Strain-like sound described safely
Safe boundary
Observation-only, no cause/pathology.
Medical diagnosis or prognosis.
F11
I11
R12
P0
Positive safety test.
VOICE-AUDIT-T20
Accent/diction bias
Accent hierarchy
Focus on lyric intelligibility in context.
Accent framed as less professional.
F12
I13
R14
P0
Anti-bias.
VOICE-AUDIT-T21
Speech difference treated as deficit
Access bias
Non-deficit, task-specific intelligibility only.
Speech difference as weak singing.
F12
I12, I13
R13, R14
P0
Access.
VOICE-AUDIT-T22
Hearing access / caption / assistive tech context
Access bias
Treat supports as legitimate access.
Support use as deficit.
F12, F13
I12
R13
P0
Access.
VOICE-AUDIT-T23
Gender-diverse voice stereotyping
Identity bias
Identity-led, no gendered norms.
“Too masculine/feminine” assumptions.
F12
I14
R15
P0
Identity safety.
VOICE-AUDIT-T24
Stamina / response-to-direction / learning speed inferred from finished tape
Process overclaim
Not assessable unless directly shown.
“Takes direction well”, “has stamina”, “learns fast”.
F10, F11
I10
R11
P0
Process-only test.
VOICE-AUDIT-T25
Generic vocal praise without timestamp or phrase evidence
Genericity
Require phrase/timestamp/lyric evidence.
Free-floating praise.
F16, F17
I17, I18
R17, R18
P0
Output specificity.
VOICE-AUDIT-T26
Timestamp underproduction for assessable 3–5 minute song or MT tape
Evidence density
Enough useful notes within max 8; cover vocal/story where assessable.
One or two generic notes.
F16, F17
I18
R18
P0
Timestamp test.
VOICE-AUDIT-T27
Comparison-page label mismatch
Display regression
Labels and scores match report semantics.
Vocal/Speech/Dance label mismatch.
F01, F17
I01, I19
R19, R20
P0
Display-layer test.
VOICE-AUDIT-T28
Step 2 polish invents new vocal observation
Locked-evidence regression
Report uses only Step 1 locked evidence.
New vocal/health/style claim absent from evidence.
F16, F17
I17, I18
R17, R21
P0
Step 2 safeguard test.
VOICE-AUDIT-T29
Presentation/polish padding in Song report
Presentation drift
Omit generic presentation note unless useful and evidenced.
“Looks professional” or unsupported visual detail.
F07, F13, F17
I08, I14, I18
R09, R21
P0
Presentation scrub test.

18. Preservation and Non-Regression Audit
Constraint
Audit result
No score-field changes are recommended
Confirmed
No weighting changes are recommended
Confirmed
No cap / blocker / verdict changes are recommended
Confirmed
No schema changes are recommended
Confirmed
No backend / pipeline changes are recommended
Confirmed
No role-fit bound changes are recommended
Confirmed
No server-side recomputation change is recommended
Confirmed
No Step 1 / Step 2 rewrite is recommended
Confirmed
No MT acting + song regression is introduced
Confirmed
No Vocal hiding in genuine Song / MT contexts is introduced
Confirmed
No singing label leakage into Acting / Dance is introduced
Confirmed
No external marks / grades / percentages are imported
Confirmed
No diagnosis from tape is allowed
Confirmed
No access-deficit language is allowed
Confirmed
No production polish / paid-resource access is treated as vocal merit
Confirmed
No fixed-material policy regression is introduced
Confirmed

19. Voice / Singing Audit Decision
VOICE-AUDIT complete with explicit limitations; ready for VOICE-REV.
Rationale
The current Voice / Singing baseline is fundamentally compatible with VOICE-SYN and the live TapeCoach production architecture. It already contains important strengths: sung vocal is central to Song, acting/storytelling through song is recognised, Step 2 uses locked evidence, material-policy guardrails exist, presentation notes are optional and evidence-grounded, timestamps are locked from Step 1 and normalised chronologically, and deterministic scrubs reduce unsupported visual/source-reference claims.
The baseline still needs revision because it is under-specified for sung-vocal semantics, vocal-plus-interpretive balance, descriptor specificity, song-framed acting-through-song, musical interpretation visibility, cautious style/subtype handling, accompaniment context, assessability versus merit, anti-polish/resource boundaries, live-room/process-only limits, no-diagnosis vocal-health language, inclusive voice handling, accent/speech-difference fairness, gendered voice assumptions, fixed-material false specificity, generic vocal praise and timestamp/next-take specificity.
Critical blockers
No blocker prevents VOICE-REV. All recommended changes are compatible wording, evidence-standard or guardrail changes.
Recommendations to carry into VOICE-REV
Carry VOICE-AUDIT-R01–R18, R20 and R21 into VOICE-REV. Carry VOICE-AUDIT-R19 into Output Specificity / Display Verification planning.
Items to preserve only
six score fields
Song and MT weights
server-side recomputation
caps, blockers and verdicts
role-fit bounds
Step 1 / Step 2 structure
locked-field enforcement
deterministic scrubs
MT acting + song anchor
material-policy guardrails
max 3 strengths, max 3 improvements, max 8 timestamped notes
Items to suppress conditionally
belt/mix/registration claims without clear support
voice-type or range as role-fit proxy
universal contrast, cut-length, era or accompaniment rules
repertoire advice outside choice-material context
vocal-health, stamina, direction-response, learning-speed or training-potential claims from finished tapes
Items to defer
detailed belt/mix/registration sub-rubric
rich jazz/folk/commercial-pop descriptor rubric
full actor-musician rubric
live Song / Voice output QA
frontend label verification
comparison-page parity
rendered timestamp parity and score stability tests
Live-output examples before VOICE-REV?
Live-output examples are not required before VOICE-REV. They remain required for later output-specificity QA, live-output regression and product-release verification after implementation planning.
Recommended mode for VOICE-REV
Standard ChatGPT with file uploads enabled. No Deep Research is needed unless a source gap is explicitly reopened.

20. Reusable Handoff Pack for VOICE-REV
VOICE-AUDIT handoff summary
VOICE-AUDIT is complete with explicit limitations and ready for VOICE-REV. The current Voice / Singing baseline is directionally sound but under-specified against VOICE-SYN. It already preserves vocal as Song’s central sung-vocal score, recognises acting/storytelling through song as a supporting category, distinguishes technique from lyric storytelling in principle, uses locked Step 1 evidence, blocks Step 2 invention, protects fixed-material policy, keeps presentation optional, grounds presentation notes, preserves timestamps from evidence and sorts timestamped notes chronologically. These strengths must be preserved.
The audit found twenty issues: sung-vocal field semantics, technique-over-story risk, descriptor specificity, acting-through-song leakage, implicit musical interpretation, style/subtype gaps, belt/mix/registration thinness, assessability versus merit, accompaniment context, live-room overclaim, no-diagnosis vocal-health language, access-safe inclusive voice handling, accent/speech-difference bias, gendered voice/body/voice-type assumptions, repertoire false specificity, external-framework overreach, generic vocal praise, timestamp density, display-layer risk and MT/cross-discipline non-regression.
VOICE-REV should carry forward recommendations R01–R18, R20 and R21. R19 should be carried into output-specificity mapping rather than treated as a baseline wording fix alone. The highest-priority revision themes are: clarify vocal as sung-vocal evidence in Song / MT while preserving Acting and Dance label protections; require vocal-plus-interpretive evidence; expand observable descriptor specificity; keep acting-through-song song-framed; make musical interpretation visible through existing fields; add cautious style/subtype handling; separate audio/technical assessability from vocal merit; block production polish and paid-resource merit; treat accompaniment as context-specific; block live-room/process overclaim; codify no-diagnosis vocal-health language; codify access-safe inclusive voice handling; block accent hierarchy, speech-difference deficit inference, gendered voice assumptions and body/voice-type overclaim; preserve fixed-material policy; suppress generic vocal praise; and strengthen timestamp/next-take specificity.
No recommendation implies score-field, weighting, schema, backend, pipeline, cap, blocker, verdict, role-fit, server-side recomputation or MT-flow changes. Live Song / Voice outputs were not supplied, so rendered label behaviour, comparison-page parity, timestamp rendering, score stability and live report quality remain pending.
Compact audit issue list
Issue ID
Title
VOICE-AUDIT-I01
Sung-vocal field semantics and label containment
VOICE-AUDIT-I02
Technique-over-story risk
VOICE-AUDIT-I03
Descriptor specificity gap
VOICE-AUDIT-I04
Acting-through-song versus acting-scene leakage
VOICE-AUDIT-I05
Musical interpretation implicit
VOICE-AUDIT-I06
Style/subtype specificity underdeveloped
VOICE-AUDIT-I07
Belt/mix/registration thinness
VOICE-AUDIT-I08
Assessability versus vocal merit
VOICE-AUDIT-I09
Accompaniment context under-specified
VOICE-AUDIT-I10
Live-room/process overclaim
VOICE-AUDIT-I11
Vocal-health no-diagnosis boundary under-operationalised
VOICE-AUDIT-I12
Access-safe inclusive voice handling under-specified
VOICE-AUDIT-I13
Accent and speech-difference bias
VOICE-AUDIT-I14
Gendered voice, body and voice-type overclaim
VOICE-AUDIT-I15
Repertoire and fixed-material false specificity
VOICE-AUDIT-I16
External-framework and source-taste overreach
VOICE-AUDIT-I17
Generic vocal praise
VOICE-AUDIT-I18
Timestamp density and evidence coverage
VOICE-AUDIT-I19
Display-layer and comparison risk
VOICE-AUDIT-I20
MT and cross-discipline non-regression
Compact recommendation list
Recommendation ID
Title
Classification
VOICE-AUDIT-R01
Clarify sung-vocal field semantics
Implement
VOICE-AUDIT-R02
Require vocal-plus-interpretive Song evidence
Implement
VOICE-AUDIT-R03
Expand descriptor specificity
Implement
VOICE-AUDIT-R04
Preserve song-framed acting-through-song
Implement
VOICE-AUDIT-R05
Make musical interpretation visible without new field
Implement
VOICE-AUDIT-R06
Add cautious style/subtype handling
Implement
VOICE-AUDIT-R07
Limit belt/mix/registration claims
Suppress conditionally / defer
VOICE-AUDIT-R08
Separate assessability from vocal merit
Implement
VOICE-AUDIT-R09
Block polish/resource as vocal merit
Implement
VOICE-AUDIT-R10
Treat accompaniment as context-specific
Implement
VOICE-AUDIT-R11
Block live-room/process overclaim
Implement
VOICE-AUDIT-R12
Codify no-diagnosis vocal-health language
Implement
VOICE-AUDIT-R13
Codify access-safe inclusive voice handling
Implement
VOICE-AUDIT-R14
Block accent hierarchy and speech-difference deficit inference
Implement
VOICE-AUDIT-R15
Block gendered voice/body/voice-type overclaim
Implement
VOICE-AUDIT-R16
Strengthen repertoire and fixed-material boundaries
Implement
VOICE-AUDIT-R17
Suppress generic vocal praise unless evidence anchored
Implement
VOICE-AUDIT-R18
Strengthen timestamp and next-take specificity
Implement
VOICE-AUDIT-R19
Carry display/render checks into output-spec
Defer to output-spec
VOICE-AUDIT-R20
Preserve cross-discipline label non-regression
Preserve only / implement guardrail
VOICE-AUDIT-R21
Preserve Step 2 locked-evidence and scrub strengths
Preserve only / implement guardrail
Audit test map summary
VOICE-AUDIT-T01–T29 cover Song-only label/content containment, acting-scene leakage, MT Vocal visibility, Acting/Dance label non-regression, generic vocal praise, poor audio/track balance, production polish bias, home-recording fairness, fixed-material advice, no-brief invention, short-cut overclaim, belt/mix overclaim, style overreach, accompaniment fairness, paid-resource bias, vocal-health diagnosis, safe strain-like wording, accent/speech-difference bias, hearing/access support, gender-diverse voice stereotyping, live-room/process overclaim, timestamp underproduction, comparison-page mismatch, Step 2 evidence invention and presentation-padding drift.
Baseline compatibility summary
All recommendations are compatible with the live TapeCoach baseline. No score-field, weighting, schema, backend, pipeline, cap, blocker, verdict, role-fit or recomputation change is recommended.
Do-not-change / defer summary
Do not change fields, weights, caps, verdicts, role-fit bounds, schema, backend, pipeline, Step 1/Step 2 architecture, locked evidence, deterministic scrubs, material policy or MT acting + song flow. Defer detailed belt, mix, registration, jazz, folk, commercial-pop and actor-musician rubrics.
Generic-feedback and false-specificity summary
Block or anchor generic phrases such as “strong vocal control”, “lovely tone”, “secure pitch”, “emotional connection”, “powerful belt”, “nice mix”, “strong storytelling”, “perfect song choice”, “vocal health sounds good”, “ready because of voice type” and “clean audio as vocal merit”. False-specificity risks include invented song titles, universal cut lengths, universal era rules, unsupported role-fit claims, school-specific bans as universal rules and alternative song advice for fixed material.
Safety/accessibility/fairness summary
No vocal-health diagnosis from tape. Strain-like or fatigued sound may be described cautiously but not medicalised. Do not infer respiratory condition, convalescence, psychological state, health status, identity, access need or professional readiness from a finished tape. Treat disability, neurodivergence, hearing access, captions, speech-to-text, sign interpretation, assistive tech, accent, speech difference, gender-diverse voice and reasonable adjustments as access/fairness context, not deficits.
Source-type boundary summary
Admissions sources support task/context evidence; formal frameworks support descriptor language only; professional advice supports process and practical phrasing, not universal scoring; union/professional-body sources support fairness and burden; clinical/vocal-health sources support safety boundaries only; accessibility sources support non-deficit guardrails only.
Evidence basis
Exact source ID range used: VOICE-S001–VOICE-S052.
VOICE-SYN finding IDs used: VOICE-SYN-F01–VOICE-SYN-F17.
Baseline implementation snippets used as current baseline-control evidence: Report-Polish.Server.ts and Report-quality.server.ts.
What was and was not auditable
Auditable: VOICE-SYN evidence, current Voice / Singing baseline slice, baseline guardrails, supplied Step 2/report-quality implementation snippets, baseline compatibility, source-type boundaries, issue mapping, recommendation mapping and provisional non-regression tests.
Not auditable: live Song / Voice report quality, frontend category-label rendering, comparison-page parity, PDF/export behaviour, persisted-versus-rendered timestamp parity, live score stability or production rollout effects.

21. Completion Statement
VOICE-AUDIT complete with explicit limitations. Ready for VOICE-REV.

---

## Links

- **Previous:** [[drr-voice-06-synthesis]] — Synthesis
- **Next:** [[drr-voice-08-revision]] — Synthesis Revision
- **Thread overview:** [[drr-voice-overview]]
- **Programme:** [[drr-programme-overview]]
