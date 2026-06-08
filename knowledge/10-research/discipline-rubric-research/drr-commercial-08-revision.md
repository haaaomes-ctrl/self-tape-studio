---
id: drr-commercial-08-revision
title: Commercial — Synthesis Revision
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/5. Commercial/C-Rev.md"
discipline: commercial
monday_ref: null
tags: [discipline-rubric-research, commercial, stage-revision]
confidence: medium
created: 2026-05-06
imported: 2026-06-08
updated: 2026-06-08
---

# Commercial — Synthesis Revision

> **Imported research — Discipline Rubric Research programme.** Step 8 of 12 in the Commercial thread (`stage-revision`). Original file: `5. Commercial/C-Rev.md`. Original date: 2026-05-06 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-commercial-overview]].

---

1. Revision Readiness Check
Check
Result
Caveat
Current Commercial baseline slice present
Yes
Supplied as a summary slice, not exact full production prompt text
COMMERCIAL-AUDIT handoff present
Yes
Includes issue IDs, recommendation IDs, priorities, test map and open risks
COMMERCIAL-SYN handoff present
Yes
Includes COMMERCIAL-SYN-F01–F24 and limitation register
Preserved TapeCoach baseline / guardrail context present
Yes
Includes shared architecture, scoring, pipeline, MT anchor and safety constraints
Completed branch anchors noted
Yes
MT, Dance, Acting and Voice / Singing anchors carried forward
COMMERCIAL-AUDIT-R01–R21 carried forward
Yes
All recommendations classified below
COMMERCIAL-SYN-F01–F24 carried forward
Yes
All relevant findings mapped into revision
Source IDs normalised
Yes
COMMERCIAL-S001–COMMERCIAL-S030
Revision may proceed
Yes
Exact frontend labels, production prompt text, comparison page behaviour, renderer/export behaviour and live Commercial outputs remain unaudited
2. Revision Input Register
Input item
Type
Present?
Used in revision?
Role in revision
Limitation / note
Current Commercial baseline slice
Baseline text
Yes
Yes
Direct root text for revision
Summary slice only
Preserved TapeCoach guardrail context
Baseline control
Yes
Yes
Defines do-not-change constraints
Used as preservation control, not revised globally
COMMERCIAL-SYN handoff
Evidence synthesis
Yes
Yes
Supplies evidence findings and source limitations
No new synthesis performed
COMMERCIAL-AUDIT handoff
Audit control
Yes
Yes
Supplies issues, recommendations and test IDs
No audit reopened
Completed MT, Dance, Acting, Voice / Singing anchors
Cross-branch controls
Yes
Yes
Prevents regression across completed branches
Used only as control reference
Current live Commercial outputs
Live-output examples
No
No
Would support spot QA
Live-output QA remains pending
Exact current production Commercial prompt
Production prompt text
No
No
Would allow exact prompt revision
Addenda used where full text was not supplied
3. Revision Scope and Preservation Rules
This revision covers Commercial wording, evidence requirements, field-semantics guidance, report behaviour rules, claim-scope limits, exclusion rules and discipline-specific guardrails inside the existing TapeCoach architecture.
Actually revised or added:
the supplied Commercial baseline slice;
Commercial-specific addenda for evidence requirements and report behaviour;
Commercial-specific guardrail additions that sit under the preserved baseline guardrail pack.
Used only as control/reference:
current six-field scoring architecture;
score weights, caps, blockers, verdict thresholds and role-fit bounds;
Step 1 / Step 2 pipeline;
MT, Dance, Acting and Voice / Singing branch anchors;
source-family limitations from COMMERCIAL-SYN.
Deferred to COMMERCIAL-FINAL-AUDIT:
whether all COMMERCIAL-AUDIT-R01–R21 are fully implemented in the revised package;
whether the wording overreaches beyond evidence;
whether baseline non-regression constraints are preserved;
whether output-specificity mapping can proceed.
Out of scope:
backend, schema, pipeline, UI, data-flow, public JSON or database changes;
score-field, weighting, cap, blocker, verdict-threshold or role-fit changes;
frontend label helper behaviour;
comparison-page label behaviour;
renderer/export timestamp behaviour;
live-output QA.
Must remain preserved:
six stored score fields;
current Commercial weights;
server-side recomputation;
locked evidence model;
MT acting + song stabilised flow;
no unsupported appearance, marketability, access-need or production-polish scoring.
4. Audit Recommendation Classification
Audit recommendation ID
Short recommendation title
Classification
Reason
Baseline compatibility
Evidence confidence
Revision change ID(s)
Residual caution / final-audit watch item
COMMERCIAL-AUDIT-R01
Add Commercial distinctiveness guardrail
Implement
Needed to prevent theatre-acting / generic screen leakage
Compatible
High
COMMERCIAL-REV-C01
Check no overcorrection into one narrow Commercial style
COMMERCIAL-AUDIT-R02
Clarify acting-as-presence/naturalism semantics
Implement
Current acting field meaning is too vague for Commercial
Compatible
High
COMMERCIAL-REV-C02
Field remains architecturally shared
COMMERCIAL-AUDIT-R03
Suppress generic Commercial praise
Implement
Generic praise is a core output risk
Compatible
High
COMMERCIAL-REV-C03
Requires output QA later
COMMERCIAL-AUDIT-R04
Add tone/copy/product grounding rules
Implement
Core Commercial evidence area
Compatible
High
COMMERCIAL-REV-C04
Must not invent product/brand context
COMMERCIAL-AUDIT-R05
Strengthen no-brief Commercial grounding
Implement
No-brief invention risk is critical
Compatible
High
COMMERCIAL-REV-C05
Brief-supported claims remain allowed
COMMERCIAL-AUDIT-R06
Split direct-to-camera and reader-scene handling
Implement
Camera/eyeline rules are task-specific
Compatible
High
COMMERCIAL-REV-C06
Avoid universal eyeline rule
COMMERCIAL-AUDIT-R07
Add no-dialogue conditional handling
Implement
Evidence exists but thinner
Compatible
Medium
COMMERCIAL-REV-C07
Conditional only
COMMERCIAL-AUDIT-R08
Add voiceover-style conditional handling
Suppress conditionally
B4 evidence is narrow and conditional
Compatible
Medium-low
COMMERCIAL-REV-C08
Do not generalise to all Commercial
COMMERCIAL-AUDIT-R09
Add subtype limitation block
Implement
Weak subtype evidence must remain visible
Compatible
Medium
COMMERCIAL-REV-C09
UGC / presenter / corporate remain limitations
COMMERCIAL-AUDIT-R10
Codify assessability as precondition
Implement
Strong B2 convergence
Compatible
High
COMMERCIAL-REV-C10
Reliability behaviour needs live QA
COMMERCIAL-AUDIT-R11
Separate audio audibility from Commercial performance
Implement
Prevents unfair performance criticism
Compatible
High
COMMERCIAL-REV-C11
Speech/access nuances remain broad
COMMERCIAL-AUDIT-R12
Add simple capture and anti-polish boundary
Implement
Strong B2/B3 support
Compatible
High
COMMERCIAL-REV-C12
Output wording must not reward polish
COMMERCIAL-AUDIT-R13
Bound reader, slate, upload and deadline as process-only
Implement
Process/admin items can be mis-scored
Compatible
High
COMMERCIAL-REV-C13
Some brief compliance remains legitimate if explicit
COMMERCIAL-AUDIT-R14
Add live-room-only claim boundary
Implement
Finished tape cannot prove redirection/callback readiness
Compatible
High
COMMERCIAL-REV-C14
Directly shown exceptions remain narrow
COMMERCIAL-AUDIT-R15
Add safety boundary for nudity/stunts/privacy/consent
Implement
Strong B3 process/safety evidence
Compatible
High
COMMERCIAL-REV-C15
Process/safety, not performance scoring
COMMERCIAL-AUDIT-R16
Add accessibility-safe non-deficit rules
Implement
Strong B3 access evidence
Compatible
High
COMMERCIAL-REV-C16
Operational detail for accent/speech/gender-diverse voice remains broad
COMMERCIAL-AUDIT-R17
Strengthen anti-marketability / anti-appearance boundary
Implement
Critical bias risk
Compatible
High
COMMERCIAL-REV-C17
Some Commercial-specific clauses are inferential but supported by safety guardrails
COMMERCIAL-AUDIT-R18
Tighten professional_presentation boundary
Implement
Presentation is vulnerable to polish/resource drift
Compatible
High
COMMERCIAL-REV-C18
Renderer wording remains unverified
COMMERCIAL-AUDIT-R19
Add source-shape / practitioner-language caution
Implement
B1/B4 contain practitioner and course-shaped evidence
Compatible
Medium-high
COMMERCIAL-REV-C19
Final audit should check overreach
COMMERCIAL-AUDIT-R20
Add timestamp and next-take evidence requirements
Implement
Report specificity depends on behaviour anchors
Compatible
High
COMMERCIAL-REV-C20
Renderer/export behaviour unverified
COMMERCIAL-AUDIT-R21
Carry display / label / comparison as watch item
Preserve only
No display materials supplied; cannot revise unseen UI
Compatible as watch item
Medium
COMMERCIAL-REV-C21
Final audit/output-spec should preserve as verification requirement
5. Audit Recommendation-to-Revision Matrix
Audit recommendation ID
Short title
Affected baseline component or section
Current baseline text / behaviour / assumption revised
Revision status
Why status was assigned
Proposed revision action
Audit issue ID(s)
SYN finding ID(s)
Source ID(s)
Priority
Revision change ID(s)
Residual caution
R01
Commercial distinctiveness
Commercial / screen-style intent
“clarity, naturalism, camera connection…”
Fully addressed
Adds distinction from theatre and generic screen acting
Add Commercial distinctiveness block
I01
F01, F02
S001–S008
P0
C01
Avoid one narrow Commercial style
R02
Acting-as-presence semantics
acting field
acting as presence/naturalism
Fully addressed
Clarifies meaning without field change
Add field-semantics block
I02
F03–F06
S001, S004, S007, S008
P0
C02
Architecture remains shared
R03
Generic praise suppression
Feedback specificity
“strong presence”, “natural” risk
Fully addressed
Adds replacement-evidence rule
Add generic phrase block
I03
F23
S001–S008, S009–S014
P0
C03
Needs output QA
R04
Tone/copy/product grounding
Commercial evidence
copy/brand tone too broad
Fully addressed
Adds supplied-context rule
Add tone/copy/product grounding
I04
F04–F06
S001, S004, S005, S007, S008, S028–S030
P0
C04
No-brief claims remain blocked
R05
No-brief grounding
brief/pro standards
no explicit brand/product invention block
Fully addressed
Adds no-brief guardrail
Add no-brief Commercial block
I05
F06, F18, F20
S015–S021
P0
C05
Robust clause is indirect but sufficient
R06
Camera/eyeline split
Commercial camera guidance
task setup under-specified
Fully addressed
Adds direct/readers split
Add camera setup block
I06
F07, F08, F14
S004, S005, S007, S009–S014
P0
C06
Avoid universal rule
R07
No-dialogue conditional
Commercial subtypes
no no-dialogue handling
Fully addressed conditionally
Evidence exists but thinner
Add conditional no-dialogue block
I14
F09
S001, S006
P1
C07
Conditional only
R08
Voiceover conditional
Commercial subtypes
voiceover unspecified
Fully addressed conditionally
B4 support is narrow
Add voiceover conditional block
I14, I15
F10, F24
S028–S030
P1
C08
Not all Commercial
R09
Subtype limitations
Commercial subtypes
UGC/presenter/corporate underdeveloped
Fully addressed
Makes limitation explicit
Add limitation spine
I14
F11, F24
S025–S030
P1
C09
Do not overbuild
R10
Assessability precondition
technical/report reliability
technical readability not fully bounded
Fully addressed
B2 supports this strongly
Add assessability block
I07
F12, F13
S009–S014
P0
C10
Live reliability behaviour unverified
R11
Audio vs performance
audio/speech
poor audio can become weak performance
Fully addressed
Adds audibility boundary
Add audio reliability block
I07
F17
S009–S014
P0
C11
Speech/accent access detail broad
R12
Simple capture / anti-polish
technical/presentation
polish can be misread as merit
Fully addressed
Strong B2/B3 support
Add anti-polish block
I08
F16
S009–S016
P0
C12
Output wording must be checked
R13
Process-only reader/admin/deadline
brief/pro standards
process/admin can be mis-scored
Fully addressed
B2/B3 supports process boundary
Add process-only block
I09
F15, F18
S009–S024
P0
C13
Explicit brief compliance remains allowed
R14
Live-room-only boundary
claim scope
callback/redirection can be overclaimed
Fully addressed
B3 blocks inference
Add live-room boundary
I10
F22
S015–S024
P0
C14
Directly shown exception only
R15
Safety boundaries
safety/process
nudity/stunt/privacy not Commercial-specific
Fully addressed
B3 supports clear boundary
Add safety boundary
I10, I12
F19
S015–S024
P1
C15
Process/safety only
R16
Accessibility non-deficit
accessibility/fairness
access handling under-specified
Fully addressed
B3 supports non-deficit rules
Add accessibility block
I11
F21
S019, S020, S015–S017
P0
C16
Some detail broad
R17
Anti-marketability/appearance
bias/exclusions
marketability/look risk
Fully addressed
Supported by safety/protected-trait spine
Add exclusion block
I12
F20
S017, S018, S020, S021
P0
C17
Some clauses inferential
R18
professional_presentation
professional_presentation
too loose
Fully addressed
Adds process/assessability boundary
Add presentation block
I13
F16, F18, F20
S009–S024
P0
C18
Display wording unverified
R19
Source-shape caution
evidence use
practitioner/course overreach risk
Fully addressed
B1/B4 source shape requires caution
Add source-shape block
I15
F24
S001–S030
P1
C19
Final audit overreach check
R20
Timestamp / next-take
report sections
specificity underdeveloped
Fully addressed
Adds Commercial evidence anchors
Add timestamp/next-take block
I17
F23, F12
S001–S014
P0
C20
Renderer/export unverified
R21
Display/label/comparison watch
output display
not auditable
Partially addressed as watch item
No live/display materials supplied
Add verification watch note
I16
F24
Baseline controls
P2
C21
Final audit/output-spec only
6. Section-by-Section Revision Package
COMMERCIAL-REV-S01 — Commercial field semantics / acting-as-presence-naturalism
Field
Detail
Baseline source section
Current Commercial baseline slice
Current baseline excerpt
“Commercial / screen-style current baseline intent: feedback should focus on clarity, naturalism, camera connection, copy / brand tone, listening, immediacy and technical readability.”
Proposed revised text
In Commercial reports, the stored acting field should be interpreted as Commercial presence / naturalism only where that meaning is tied to observable Commercial evidence. It may cover believable scale, copy communication, task-calibrated tone, camera or reader relationship, addressee logic, clarity of thought, rhythm, immediacy, and product / situation grounding where supplied or visible. It must not become a generic theatre-acting score or a vague “presence” score.
Change summary
Clarifies the Commercial meaning of acting without changing the field.
Recommendation ID(s)
COMMERCIAL-AUDIT-R02
Issue ID(s)
COMMERCIAL-AUDIT-I02
SYN finding ID(s)
COMMERCIAL-SYN-F03, F04, F05, F06
Source ID(s)
COMMERCIAL-S001, S004, S007, S008
Change type label(s)
clarify acting-as-presence/naturalism field semantics; require evidence anchor
Preserve note
No new score fields or weights.
Must avoid note
Do not treat “presence” as marketability, charm or appearance.
Residual limitation
Six-field architecture remains shared.
COMMERCIAL-REV-S02 — Commercial distinctiveness from theatre acting and generic screen acting
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“Commercial feedback can become theatre-style acting feedback.”
Proposed revised text
Commercial feedback must use a Commercial lens, not a theatre-acting or generic screen-acting lens by default. Evidence should focus on how the performer communicates the copy, situation, addressee and tone at the scale of the commercial task. Avoid defaulting to theatrical stakes, scene-study terminology, extended character psychology or generic screen-naturalism language unless the brief or tape directly supports that context.
Change summary
Adds Commercial distinctiveness guardrail.
Recommendation ID(s)
COMMERCIAL-AUDIT-R01
Issue ID(s)
COMMERCIAL-AUDIT-I01
SYN finding ID(s)
COMMERCIAL-SYN-F01, F02
Source ID(s)
COMMERCIAL-S001–S008
Change type label(s)
tighten descriptor language; split Commercial context handling
Preserve note
Existing Commercial audition type remains unchanged.
Must avoid note
Do not collapse Commercial into Acting, Voiceover, presenting or UGC by default.
Residual limitation
Corporate/industrial and presenter evidence remains thin.
COMMERCIAL-REV-S03 — Generic Commercial feedback suppression
Field
Detail
Baseline source section
Preserved guardrail pack / Commercial addendum
Current baseline excerpt
“Commercial feedback can become generic: ‘strong presence’, ‘clear delivery’, ‘natural’.”
Proposed revised text
Generic Commercial phrases are not sufficient unless attached to observable behaviour. Terms such as natural, confident, relatable, authentic, strong presence, engaging, conversational, likeable, warm, friendly, approachable, believable, grounded, clear tone, strong copy read, good camera work, professional self-tape, polished, marketable or bookable must be replaced with what was visible, where it occurred and why it matters: a copy beat, addressee shift, camera relationship, product/situation cue, rhythm change, tone adjustment, reaction, facial/physical communication, speech/audibility condition or assessability limitation.
Change summary
Converts generic risk list into a Commercial replacement rule.
Recommendation ID(s)
COMMERCIAL-AUDIT-R03
Issue ID(s)
COMMERCIAL-AUDIT-I03
SYN finding ID(s)
COMMERCIAL-SYN-F23
Source ID(s)
COMMERCIAL-S001–S014
Change type label(s)
require evidence anchor; exclude / block language
Preserve note
Report structure and max strengths/improvements remain unchanged.
Must avoid note
No free-floating praise.
Residual limitation
Enforcement requires live-output QA.
COMMERCIAL-REV-S04 — Copy, tone, product, brand and situation grounding
Field
Detail
Baseline source section
Current Commercial baseline slice
Current baseline excerpt
“copy / brand tone”
Proposed revised text
Commercial tone and copy feedback must be grounded in supplied brief, script, product, campaign, situation, visible copy clues or observable tape behaviour. Safe evidence may include cue-word emphasis, pacing, conversational rhythm, addressee logic, product or situation awareness where supplied, point of view, and whether the delivery supports the copy’s intended world. If product, brand, campaign, buyer or target audience information is not supplied or visible, do not invent it.
Change summary
Adds tone/copy/product grounding rule.
Recommendation ID(s)
COMMERCIAL-AUDIT-R04
Issue ID(s)
COMMERCIAL-AUDIT-I04
SYN finding ID(s)
COMMERCIAL-SYN-F04, F05, F06
Source ID(s)
COMMERCIAL-S001, S004, S005, S007, S008, S028–S030
Change type label(s)
require evidence anchor; constrain claim scope
Preserve note
Brief mode remains allowed where brief exists.
Must avoid note
No invented buyer, brand, product or audience.
Residual limitation
Voiceover-style support is conditional.
COMMERCIAL-REV-S05 — No-brief Commercial grounding
Field
Detail
Baseline source section
Preserved guardrail pack / Commercial addendum
Current baseline excerpt
“If no brief exists, do not invent role, product, brand, target audience, production world, buyer fit or casting requirements.”
Proposed revised text
In no-brief Commercial reports, do not invent brand, product, campaign, buyer, target audience, casting fit, commercial market, product category, role requirements, campaign world, time limit or platform requirement. Keep the report to what the tape itself shows: copy if audible or visible, performance scale, camera relationship, tone, clarity, timing, assessability and professional standards. If the missing brief limits confidence, state the limitation rather than filling the gap.
Change summary
Strengthens no-brief Commercial claim-scope boundary.
Recommendation ID(s)
COMMERCIAL-AUDIT-R05
Issue ID(s)
COMMERCIAL-AUDIT-I05
SYN finding ID(s)
COMMERCIAL-SYN-F06, F18, F20
Source ID(s)
COMMERCIAL-S015–S021
Change type label(s)
clarify brief / no-brief boundary; constrain claim scope
Preserve note
Brief-supported role/product comments remain allowed.
Must avoid note
No unsupported brand/product/audience invention.
Residual limitation
No direct robust no-brief clause; rule is synthesis-derived from claim-scope and fairness evidence.
COMMERCIAL-REV-S06 — Direct-to-camera and reader-scene handling
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“Known missing / underdeveloped: to-camera commercial; camera craft: lens relationship…”
Proposed revised text
Commercial camera feedback must follow the task. Direct-to-camera work may address lens relationship, addressee, scale, immediacy, and whether the performer appears to communicate to a specific viewer or buyer only where supported by brief/copy/tape. Off-camera-reader or scene-style Commercial work should assess the performer’s relationship to the reader or scene target, controlled near-lens eyeline where appropriate, listening/responding on cue, and copy/situation clarity. Do not apply one universal eye-line or direct-address rule to every Commercial tape.
Change summary
Splits direct-to-camera and reader-scene handling.
Recommendation ID(s)
COMMERCIAL-AUDIT-R06
Issue ID(s)
COMMERCIAL-AUDIT-I06
SYN finding ID(s)
COMMERCIAL-SYN-F07, F08, F14
Source ID(s)
COMMERCIAL-S004, S005, S007, S009–S014
Change type label(s)
split Commercial context handling; require evidence anchor
Preserve note
No new Commercial subtype field.
Must avoid note
No universal direct-to-camera or off-camera rule.
Residual limitation
Some self-tape evidence is generic rather than Commercial-specific.
COMMERCIAL-REV-S07 — No-dialogue / silent-vignette Commercial conditional handling
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“Known missing / underdeveloped Commercial areas…”
Proposed revised text
If the tape or brief is a no-dialogue or silent-vignette Commercial, feedback may address visible story clarity, reaction timing, facial and physical communication, object/situation relationship, and whether the non-verbal behaviour makes the commercial idea readable. This should be used only where the task is clearly no-dialogue or materially relies on silent action. Do not impose no-dialogue criteria on spoken copy or scene-style Commercials.
Change summary
Adds conditional no-dialogue handling.
Recommendation ID(s)
COMMERCIAL-AUDIT-R07
Issue ID(s)
COMMERCIAL-AUDIT-I14
SYN finding ID(s)
COMMERCIAL-SYN-F09
Source ID(s)
COMMERCIAL-S001, S006
Change type label(s)
suppress conditionally; split Commercial context handling
Preserve note
No new score field.
Must avoid note
Do not generalise thin no-dialogue evidence.
Residual limitation
Evidence remains thinner than mainstream Commercial.
COMMERCIAL-REV-S08 — Voiceover-style Commercial conditional handling
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“voiceover-style delivery where relevant”
Proposed revised text
Voiceover-style Commercial evidence is conditional. Use it only where the task is explicitly voiceover-style, audio-led spoken copy, or otherwise clearly asks for spoken-copy performance rather than on-camera screen work. Safe comments may address copy clarity, product or message cues, point of view, cue words, tone from supplied copy, and spoken readability. Do not treat voiceover tone lists, client-facing copywriting advice or one practitioner’s method as universal Commercial categories.
Change summary
Adds conditional voiceover handling.
Recommendation ID(s)
COMMERCIAL-AUDIT-R08
Issue ID(s)
COMMERCIAL-AUDIT-I14, I15
SYN finding ID(s)
COMMERCIAL-SYN-F10, F24
Source ID(s)
COMMERCIAL-S028, S029, S030
Change type label(s)
suppress conditionally; carry as limitation
Preserve note
Voice / Singing sung-vocal meaning remains protected.
Must avoid note
Do not collapse Commercial into voiceover by default.
Residual limitation
B4 source authority is lower and conditional.
COMMERCIAL-REV-S09 — UGC / social, presenter-led and corporate / industrial limitation block
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“corporate / industrial; voiceover-style delivery where relevant”
Proposed revised text
UGC/social-style Commercial, presenter-led product, corporate/industrial and similar sub-contexts are under-evidenced in the current Commercial source base. Use only task-present, observable evidence for these contexts. Do not create universal subtype rules, hidden weights, or style expectations for them. If the context appears but the brief is thin, mark it cautiously and keep comments to observable copy, camera, tone, situation and assessability evidence.
Change summary
Adds subtype limitation spine.
Recommendation ID(s)
COMMERCIAL-AUDIT-R09
Issue ID(s)
COMMERCIAL-AUDIT-I14
SYN finding ID(s)
COMMERCIAL-SYN-F11, F24
Source ID(s)
COMMERCIAL-S025–S030
Change type label(s)
carry as limitation; suppress conditionally
Preserve note
No Commercial subtype fields or weights added.
Must avoid note
Do not overbuild unsupported subtypes.
Residual limitation
These contexts remain research gaps.
COMMERCIAL-REV-S10 — Self-tape assessability as precondition
Field
Detail
Baseline source section
Current Commercial baseline slice / Commercial addendum
Current baseline excerpt
“technical readability”
Proposed revised text
Commercial performance claims should be strongest only when the tape is assessable: the performer can be clearly seen and heard, framing is task-appropriate, eyeline/reader setup is readable, lighting allows facial or physical communication to register, and continuity is sufficient to judge the performance. If visibility, framing, sound or continuity materially limits assessment, narrow the claims and lower feedback reliability rather than substituting generic performance criticism.
Change summary
Codifies assessability as feedback precondition.
Recommendation ID(s)
COMMERCIAL-AUDIT-R10
Issue ID(s)
COMMERCIAL-AUDIT-I07
SYN finding ID(s)
COMMERCIAL-SYN-F12, F13
Source ID(s)
COMMERCIAL-S009–S014
Change type label(s)
lower confidence when assessability is limited; clarify technical assessability boundary
Preserve note
Technical/audio caps remain unchanged.
Must avoid note
Do not criticise performance from unreadable tape.
Residual limitation
Live reliability behaviour unverified.
COMMERCIAL-REV-S11 — Audio / speech audibility boundary
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“technical readability”
Proposed revised text
Audio comments should distinguish audibility from Commercial performance. Poor sound, room noise, low volume, distortion or unclear capture may limit reliability, but they do not by themselves prove weak copy handling, weak naturalism or weak speech skill. Where spoken copy is audible enough to assess, comments may address clarity, pace, emphasis, rhythm, cue-word handling and tone. Do not treat accent, speech difference, gender-diverse voice, hearing difference or communication support as a Commercial deficit.
Change summary
Separates audio audibility from performance judgement.
Recommendation ID(s)
COMMERCIAL-AUDIT-R11, R16
Issue ID(s)
COMMERCIAL-AUDIT-I07, I11
SYN finding ID(s)
COMMERCIAL-SYN-F17, F21
Source ID(s)
COMMERCIAL-S009–S014, S019, S020
Change type label(s)
clarify audio / speech audibility boundary; clarify accessibility boundary
Preserve note
Audio field remains unchanged.
Must avoid note
No speech/accent deficit inference.
Residual limitation
Operational detail remains broad.
COMMERCIAL-REV-S12 — Simple capture and anti-polish
Field
Detail
Baseline source section
Commercial addendum / preserved guardrail pack
Current baseline excerpt
“technical readability”
Proposed revised text
Simple domestic capture can be fully acceptable where the Commercial evidence is readable. Phones, plain walls, home setups, simple lighting, low-fuss framing and limited editing should not be penalised because they are not studio-level. Conversely, expensive equipment, studio lighting, heavy editing, high production value, professional packaging, paid coaching, paid editing or polished surroundings must not be rewarded as Commercial merit.
Change summary
Adds simple-capture and anti-polish boundary.
Recommendation ID(s)
COMMERCIAL-AUDIT-R12
Issue ID(s)
COMMERCIAL-AUDIT-I08
SYN finding ID(s)
COMMERCIAL-SYN-F16, F17
Source ID(s)
COMMERCIAL-S009–S016
Change type label(s)
exclude / block language; clarify technical assessability boundary
Preserve note
No changes to technical field or cap logic.
Must avoid note
No production polish as talent evidence.
Residual limitation
Output wording must be tested.
COMMERCIAL-REV-S13 — Reader, slate, upload, admin and deadline as process-only
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“brief_adherence / professional standards”
Proposed revised text
Reader access, reader quality, paid-reader availability, slate/ident details, file naming, upload friction, platform access, early submission, turnaround speed and deadline pressure are process or brief-compliance matters, not Commercial talent evidence. Comment on them only where they affect explicit brief compliance, assessability or submission risk. Do not treat ability to pay, upload quickly, access a professional reader or meet excessive technical burden as performance quality.
Change summary
Marks reader/admin/deadline as process-only.
Recommendation ID(s)
COMMERCIAL-AUDIT-R13
Issue ID(s)
COMMERCIAL-AUDIT-I09
SYN finding ID(s)
COMMERCIAL-SYN-F15, F18
Source ID(s)
COMMERCIAL-S009–S024
Change type label(s)
mark process-only; constrain claim scope
Preserve note
Explicit brief compliance remains legitimate.
Must avoid note
No resource-access scoring.
Residual limitation
Some admin may still be reportable as submission risk.
COMMERCIAL-REV-S14 — Live-room-only and callback-readiness boundary
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“listening, immediacy”
Proposed revised text
A finished Commercial tape can show observable performance choices, but it cannot safely prove response to direction, redirection skill, callback readiness, campaign-pressure professionalism, improvisation flexibility, availability, client-room behaviour, or live-room adaptability unless those capacities are directly shown in the supplied material. If not shown, do not infer them from polish, confidence, tone or pace.
Change summary
Blocks live-room and callback overclaims.
Recommendation ID(s)
COMMERCIAL-AUDIT-R14
Issue ID(s)
COMMERCIAL-AUDIT-I10
SYN finding ID(s)
COMMERCIAL-SYN-F22
Source ID(s)
COMMERCIAL-S015–S024
Change type label(s)
mark live-room-only; constrain claim scope
Preserve note
Observable improvisation in a tape remains commentable if directly shown.
Must avoid note
No callback readiness from finished tape.
Residual limitation
No live outputs supplied to test.
COMMERCIAL-REV-S15 — Nudity, stunt, privacy and consent safety boundary
Field
Detail
Baseline source section
Commercial addendum / safety guardrails
Current baseline excerpt
“safety and fairness guardrails”
Proposed revised text
Commercial report language must preserve safety and consent boundaries. Nudity, simulated nudity, intimate material, stunts, unsafe requests, privacy issues, public release of audition material, data handling and taped-material consent are safety/process matters. They should never be framed as performer talent, professionalism or willingness. Do not encourage performers to comply with unsafe, nude, stunt or privacy-compromising self-tape requests.
Change summary
Adds Commercial safety boundary.
Recommendation ID(s)
COMMERCIAL-AUDIT-R15
Issue ID(s)
COMMERCIAL-AUDIT-I10, I12
SYN finding ID(s)
COMMERCIAL-SYN-F19
Source ID(s)
COMMERCIAL-S015–S024
Change type label(s)
constrain claim scope; exclude / block language
Preserve note
Existing safety/material-policy scrubs remain unchanged.
Must avoid note
No unsafe-compliance scoring.
Residual limitation
Safety processing not audited here.
COMMERCIAL-REV-S16 — Accessibility-safe and anti-deficit Commercial guidance
Field
Detail
Baseline source section
Preserved guardrail pack / Commercial addendum
Current baseline excerpt
“safety and fairness guardrails”
Proposed revised text
Commercial assessment must separate access process, communication support and performance evidence. Access needs, disability, neurodivergence, visual impairment, Deaf/disabled access, hearing difference, speech difference, accent, gender-diverse voice, mobility difference, convalescence, fatigue, lighting needs, time-slot needs, accessible materials, support workers or adaptation must not be treated as Commercial deficits. Judge only what is observable and assessable in the task. Do not infer capability ceiling, marketability, professionalism, buyer fit or role suitability from access context.
Change summary
Adds non-deficit Commercial access rules.
Recommendation ID(s)
COMMERCIAL-AUDIT-R16
Issue ID(s)
COMMERCIAL-AUDIT-I11
SYN finding ID(s)
COMMERCIAL-SYN-F21
Source ID(s)
COMMERCIAL-S015, S017, S019, S020, S021
Change type label(s)
clarify accessibility boundary; exclude / block language
Preserve note
Existing accessibility scrubs preserved.
Must avoid note
No deficit inference.
Residual limitation
Accent/speech/gender-diverse voice detail remains broad.
COMMERCIAL-REV-S17 — Anti-marketability, anti-bookability and anti-appearance rules
Field
Detail
Baseline source section
Preserved guardrail pack / Commercial addendum
Current baseline excerpt
“Do not allow role fit to reward appearance…”
Proposed revised text
Commercial scoring and report language must not use marketability, bookability, buyer fit, brand fit, product fit, target-audience fit, commercial look, appearance, body type, attractiveness, charm, charisma, class-coded polish, fame, follower count, social-media profile, influencer status, age appearance, race, gender presentation, disability or other protected characteristics as evidence unless a supplied brief lawfully and specifically supports a narrow factual requirement. Even then, keep language factual, brief-grounded and non-stereotyping.
Change summary
Strengthens Commercial anti-bias exclusion block.
Recommendation ID(s)
COMMERCIAL-AUDIT-R17
Issue ID(s)
COMMERCIAL-AUDIT-I12
SYN finding ID(s)
COMMERCIAL-SYN-F20
Source ID(s)
COMMERCIAL-S017, S018, S020, S021
Change type label(s)
exclude / block language; constrain claim scope
Preserve note
Role-fit bounds unchanged.
Must avoid note
No marketability or look-based scoring.
Residual limitation
Some exclusion support is inferential but strong through fairness guardrails.
COMMERCIAL-REV-S18 — professional_presentation boundary
Field
Detail
Baseline source section
Commercial addendum / professional_presentation
Current baseline excerpt
“professional_presentation”
Proposed revised text
In Commercial reports, professional_presentation should be limited to observable assessability, explicit brief response, safe process and task preparation. It must not reward studio quality, expensive equipment, paid readers, paid editing, paid coaching, home quality, wardrobe cost, grooming taste, class-coded presentation, charm, look, marketability or resource access. Presentation notes should be used only when they materially affect assessability, explicit brief compliance or safe process.
Change summary
Tightens professional_presentation boundary.
Recommendation ID(s)
COMMERCIAL-AUDIT-R18
Issue ID(s)
COMMERCIAL-AUDIT-I13
SYN finding ID(s)
COMMERCIAL-SYN-F16, F18, F20
Source ID(s)
COMMERCIAL-S009–S024
Change type label(s)
clarify professional_presentation boundary; exclude / block language
Preserve note
Field and weight remain unchanged.
Must avoid note
No polish/resource/class bias.
Residual limitation
UI/report display wording remains unverified.
COMMERCIAL-REV-S19 — Source-shape and practitioner-language caution
Field
Detail
Baseline source section
Commercial addendum
Current baseline excerpt
“known missing / underdeveloped Commercial areas”
Proposed revised text
Commercial evidence should remain source-shape aware. B1 platform, casting-director and coach-shaped language may support observable behaviours only where it converges. B2 self-tape guidance supports assessability, not Commercial performance scoring. B3 process/fairness sources support boundaries, not performance descriptors. B4 course, voiceover and client-facing sources are conditional gap-fill only. Do not import one expert’s method, a course page, a tone list, client-facing copywriting advice or advertising preference as universal Commercial scoring.
Change summary
Adds source-shape caution.
Recommendation ID(s)
COMMERCIAL-AUDIT-R19
Issue ID(s)
COMMERCIAL-AUDIT-I15
SYN finding ID(s)
COMMERCIAL-SYN-F24
Source ID(s)
COMMERCIAL-S001–S030
Change type label(s)
carry as limitation; constrain claim scope
Preserve note
Formal score structure unchanged.
Must avoid note
No practitioner taste as scoring.
Residual limitation
Final audit should check overreach.
COMMERCIAL-REV-S20 — Timestamp and next-take evidence guidance
Field
Detail
Baseline source section
Preserved guardrail pack / Commercial addendum
Current baseline excerpt
“timestamped notes… fix this first… next take plan”
Proposed revised text
Commercial timestamped notes, strengths, improvements, fix-first and next-take advice must be tied to observable Commercial evidence. Strong notes should identify the copy beat, camera/addressee relationship, tone adjustment, product/situation cue, reader exchange, no-dialogue reaction, speech/audibility issue, framing/visibility issue or assessability limitation. For assessable Commercial tapes, timestamped notes should cover the key beginning/middle/end moments where useful and should include at least one high-value strength and one improvement where justified. Do not pad with generic notes if the tape is not assessable.
Change summary
Adds Commercial timestamp and next-take specificity rules.
Recommendation ID(s)
COMMERCIAL-AUDIT-R20
Issue ID(s)
COMMERCIAL-AUDIT-I17
SYN finding ID(s)
COMMERCIAL-SYN-F23, F12
Source ID(s)
COMMERCIAL-S001–S014
Change type label(s)
require evidence anchor; lower confidence when assessability is limited
Preserve note
Maximum 8 timestamps remains unchanged.
Must avoid note
No generic or invented timestamps.
Residual limitation
Renderer/export behaviour unverified.
COMMERCIAL-REV-S21 — Display / label / comparison watch item
Field
Detail
Baseline source section
Commercial addendum / final-audit watch
Current baseline excerpt
“Type-aware UI labels, comparison labels and rendered timestamp behaviour are not fully verified.”
Proposed revised text
Commercial final audit and output-specificity mapping must carry a display-layer watch item. User-facing category labels, comparison-page labels, rendered timestamp count, PDF/export parity and Commercial category wording were not directly auditable from the supplied materials. Any future display surface should preserve the Commercial meaning of acting as Commercial presence / naturalism, avoid misleading vocal labels where vocal is absent, and keep comparison labels aligned with report labels.
Change summary
Preserves display risk without proposing UI changes.
Recommendation ID(s)
COMMERCIAL-AUDIT-R21
Issue ID(s)
COMMERCIAL-AUDIT-I16
SYN finding ID(s)
COMMERCIAL-SYN-F24
Source ID(s)
Baseline controls
Change type label(s)
carry as limitation; out of scope for current architecture
Preserve note
No UI implementation proposed.
Must avoid note
Do not claim display behaviour is verified.
Residual limitation
Requires later output-specificity and live QA.
7. Clean Revised Commercial Baseline Package
A. Revised Commercial rubric slice
Commercial remains an operational audition type inside the existing shared TapeCoach framework.
Current Commercial scoring uses the shared fields:
acting;
brief_adherence;
technical;
audio;
professional_presentation where applicable;
vocal only if singing, voiceover-style or another explicitly supported vocal/spoken component is actually present.
Current Commercial weighting remains unchanged where supplied:
acting as Commercial presence / naturalism: 60%;
brief_adherence: 20%;
technical: 15%;
audio: 5%.
In Commercial reports, the acting field should be interpreted as Commercial presence / naturalism only when tied to observable Commercial evidence. This may include:
believable scale;
task-calibrated tone;
copy communication;
camera or reader relationship;
addressee logic;
product, brand or situation grounding where supplied or visible;
clarity of thought;
timing and rhythm;
immediacy;
facial or physical communication where task-relevant.
Commercial feedback must not become theatre-style acting feedback or generic screen-acting feedback. Avoid defaulting to theatrical stakes, extended character psychology, generic “screen naturalism” or vague “presence” language unless the task or tape supports that context.
Commercial tone and copy feedback must be grounded in supplied brief, script, product, campaign, situation, visible copy clues or observable tape behaviour. If no brief or material context is supplied, do not invent brand, product, buyer, target audience, campaign world, product category, casting fit, commercial market, hidden brief requirement or platform requirement.
Direct-to-camera, off-camera-reader, scene-style, no-dialogue and voiceover-style Commercial tasks require different evidence expectations. Use the most specific Commercial context supported by the brief or tape. If the context is unclear, say so and keep the report to observable Commercial evidence.
Assessability is a precondition for reliable Commercial feedback. Strong Commercial performance claims require clear sight, audible speech or copy, task-appropriate framing, readable eyeline or reader setup, and enough continuity to judge the work. If technical or audio limitations materially reduce assessability, narrow the claim and lower reliability rather than converting those limitations into performance criticism.
Simple domestic capture, phones, plain backgrounds and low-fuss setups may be fully acceptable if the performance evidence is readable. Expensive equipment, studio polish, paid editing, professional packaging, paid readers, paid coaching, wardrobe cost, home quality and production value must not become Commercial merit.
Commercial reports must not use marketability, bookability, buyer fit, brand fit, target-audience fit, commercial look, appearance, body type, charm, charisma, class-coded polish, fame, follower count, social-media profile or protected characteristics as scoring evidence.
B. Revised Commercial-specific guardrail additions or amendments
Add the following Commercial-specific guardrails:
Do not reward production polish, studio quality, expensive equipment, paid reader access, paid coaching, paid editing or professional setup access as Commercial merit.
Do not penalise simple domestic capture if the tape is assessable.
Do not treat reader quality, reader absence, upload friction, file naming, slate, early submission, fast turnaround or platform cost as talent evidence.
Do not infer response to direction, callback readiness, live-room flexibility, campaign-pressure professionalism or client-room behaviour from a finished tape unless directly shown.
Do not use voiceover-style evidence as a general rule for all Commercial tapes.
Do not overbuild UGC/social, presenter-led product or corporate/industrial rules from the current evidence base.
Do not treat access needs, disability, neurodivergence, visual impairment, Deaf/disabled access, hearing difference, speech difference, accent, gender-diverse voice, mobility difference, convalescence or adaptation as a Commercial deficit.
Do not infer capability ceiling, professionalism, marketability, buyer fit or suitability from access context.
Do not encourage unsafe, nude, stunt, intimate or privacy-compromising self-tape requests.
Do not use protected-characteristic or stereotype-led suitability claims.
Keep Commercial comments specific to this tape, this performer, this copy or task, this brief where supplied, and observable evidence.
C. New Commercial addenda where no adequate baseline text existed
Commercial context handling
Use these Commercial context blocks only where supported by the brief or tape:
Direct-to-camera Commercial: lens relationship, addressee, immediacy, conversational scale, copy emphasis, tone, and product/situation grounding where supplied.
Off-camera-reader / scene-style Commercial: relationship target, off-camera cue use, near-camera eyeline where appropriate, listening/response, situation clarity and copy delivery.
No-dialogue / silent-vignette Commercial: visible story clarity, reaction timing, facial/physical communication, object/situation relationship and whether the non-verbal behaviour makes the commercial idea readable.
Voiceover-style Commercial: conditional only; copy clarity, cue words, point of view, product/message cues, tone from supplied copy and spoken readability.
UGC/social, presenter-led product and corporate/industrial: limitation areas; use only task-present, observable evidence and do not create universal subtype rules.
Commercial generic-feedback suppression
The following phrases must not stand alone:
natural;
confident;
relatable;
authentic;
strong presence;
engaging;
conversational;
likeable;
warm;
friendly;
approachable;
believable;
grounded;
clear tone;
strong copy read;
good camera work;
professional self-tape;
polished;
marketable;
bookable;
sells the product;
connects with the audience.
Replace them with observable evidence from copy, camera, addressee, tone, product/situation, reaction, speech/audibility, timing, physical/facial communication or assessability.
Commercial exclusion and anti-bias block
Never use the following as positive or negative Commercial scoring evidence unless strictly brief-supported, lawful, factual and non-stereotyping:
marketability;
bookability;
buyer fit;
brand fit;
product fit;
target-audience fit;
commercial look;
appearance;
body type;
charm or charisma without observable behaviour;
class-coded polish;
fame;
follower count;
social-media profile;
influencer status;
studio polish;
paid resources;
protected characteristics;
disability or access need as deficit;
visual impairment as deficit;
Deaf/disabled access as deficit;
hearing difference as deficit;
speech difference or accent as deficit;
gender-diverse voice as deficit;
neurodivergence as deficit;
mobility difference, convalescence or adaptation as deficit.
8. Revision Change Register
Revision change ID
Change title
Revision section ID
Audit recommendation ID(s)
Audit issue ID(s)
SYN finding ID(s)
Source ID(s)
What changed
Change type label(s)
Priority
Evidence confidence
Baseline compatibility
Backend impact likely
Residual risk note
COMMERCIAL-REV-C01
Commercial distinctiveness
S02
R01
I01
F01, F02
S001–S008
Added non-theatre/non-generic screen guardrail
tighten descriptor language
P0
High
High
no
Avoid over-narrow Commercial style
C02
Acting-as-presence semantics
S01
R02
I02
F03–F06
S001, S004, S007, S008
Clarified acting field meaning
clarify field semantics
P0
High
High
no
Shared architecture remains
C03
Generic praise suppression
S03
R03
I03
F23
S001–S014
Added evidence-anchor replacement rule
require evidence anchor
P0
High
High
no
Needs output QA
C04
Tone/copy/product grounding
S04
R04
I04
F04–F06
S001, S004, S005, S007, S008, S028–S030
Added copy and tone grounding
constrain claim scope
P0
High
High
no
No-brief overreach watch
C05
No-brief grounding
S05
R05
I05
F06, F18, F20
S015–S021
Blocked brand/product/audience invention
clarify no-brief boundary
P0
High
High
no
Clause is synthesis-derived
C06
Camera task split
S06
R06
I06
F07, F08, F14
S004, S005, S007, S009–S014
Split direct-to-camera and reader-scene
split context handling
P0
High
High
no
Avoid universal eyeline
C07
No-dialogue conditionality
S07
R07
I14
F09
S001, S006
Added silent-vignette handling
suppress conditionally
P1
Medium
High
no
Thin evidence
C08
Voiceover conditionality
S08
R08
I14, I15
F10, F24
S028–S030
Added conditional voiceover block
carry as limitation
P1
Medium-low
High
no
B4 low authority
C09
Subtype limitation block
S09
R09
I14
F11, F24
S025–S030
Made UGC/presenter/corporate limitations explicit
carry as limitation
P1
Medium
High
no
Gaps remain
C10
Assessability precondition
S10
R10
I07
F12, F13
S009–S014
Added visibility/readability precondition
lower confidence when limited
P0
High
High
no
Reliability live QA pending
C11
Audio reliability boundary
S11
R11, R16
I07, I11
F17, F21
S009–S014, S019, S020
Separated audio from performance
clarify audio boundary
P0
High
High
no
Access detail broad
C12
Simple capture / anti-polish
S12
R12
I08
F16, F17
S009–S016
Blocked polish as merit
exclude / block language
P0
High
High
no
Display wording unverified
C13
Process-only admin/resources
S13
R13
I09
F15, F18
S009–S024
Bound reader/admin/deadline as process
mark process-only
P0
High
High
no
Explicit brief compliance still allowed
C14
Live-room boundary
S14
R14
I10
F22
S015–S024
Blocked callback/redirection inference
mark live-room-only
P0
High
High
no
Directly shown exceptions only
C15
Safety boundaries
S15
R15
I10, I12
F19
S015–S024
Added nudity/stunt/privacy/consent guardrail
constrain claim scope
P1
High
High
no
Safety processing not audited
C16
Accessibility-safe Commercial
S16
R16
I11
F21
S015, S017, S019–S021
Added non-deficit access rules
clarify accessibility boundary
P0
High
High
no
Accent/speech detail broad
C17
Anti-marketability/appearance
S17
R17
I12
F20
S017, S018, S020, S021
Added anti-look/marketability block
exclude / block language
P0
High
High
no
Some support inferential
C18
Professional presentation boundary
S18
R18
I13
F16, F18, F20
S009–S024
Limited presentation to assessability/brief/safe process
clarify professional_presentation boundary
P0
High
High
no
UI wording unverified
C19
Source-shape caution
S19
R19
I15
F24
S001–S030
Added source-family use caution
carry as limitation
P1
Medium-high
High
no
Overreach watch
C20
Timestamp / next-take specificity
S20
R20
I17
F23, F12
S001–S014
Added Commercial evidence anchors for notes
require evidence anchor
P0
High
High
no
Renderer/export unverified
C21
Display / comparison watch
S21
R21
I16
F24
Baseline controls
Carried display risk as watch item
out of scope for current architecture
P2
Medium
High
out of scope
Not verified
9. Topic-by-Topic Revision Summary
Commercial distinctiveness from theatre acting
Current problem: Commercial could be judged through theatre-style acting language. Revision approach: Added COMMERCIAL-REV-C01 / S02. Residual limitation: Some B1 evidence is platform or practitioner-shaped. Final-audit attention: Check that wording does not over-narrow Commercial.
Commercial distinctiveness from generic screen acting
Current problem: Commercial could collapse into generic screen-naturalism. Revision approach: C01, C04 and C06 separate copy/product/camera evidence. Residual limitation: UGC/presenter/corporate remain thin. Final-audit attention: Confirm Commercial stays distinct without inventing subtypes.
Acting-as-presence/naturalism field semantics
Current problem: “presence / naturalism” too vague. Revision approach: C02 defines observable Commercial evidence. Residual limitation: shared acting field remains. Final-audit attention: Confirm no field rename or weight change implied.
Generic “natural / confident / presence” suppression
Revision approach: C03 requires behavioural anchors. Residual limitation: live outputs needed to test enforcement. Final-audit attention: Check headline, category notes, strengths and fix-first.
Tone calibration
Revision approach: C04 ties tone to brief, copy, product, situation or observable tape. Residual limitation: no-brief tapes remain limited. Final-audit attention: Check no invented campaign tone.
Copy handling
Revision approach: C04 and C08 add copy/cue-word/point-of-view evidence. Residual limitation: voiceover copy support is conditional. Final-audit attention: Prevent client-copywriting guidance becoming scoring.
Product / brand / situation grounding
Revision approach: C04 and C05 require supplied or visible context. Residual limitation: no direct robust no-brief clause. Final-audit attention: Check false specificity.
Direct-to-camera handling
Revision approach: C06 defines direct-address addressee logic. Residual limitation: no universal rule. Final-audit attention: Direct-to-camera should be task-supported.
Off-camera-reader / reader-scene handling
Revision approach: C06 and C13 separate mediated scene evidence and reader process. Residual limitation: reader quality remains output-test risk. Final-audit attention: Paid/basic reader neutrality.
No-dialogue / silent-vignette Commercial
Revision approach: C07 adds conditional non-verbal story evidence. Residual limitation: thin evidence. Final-audit attention: Avoid applying to spoken copy.
Voiceover-style Commercial as conditional
Revision approach: C08 limits to voiceover-style or spoken-copy tasks. Residual limitation: B4 only. Final-audit attention: Do not generalise tone families.
UGC / social-style limitation
Revision approach: C09 carries limitation. Residual limitation: unresolved. Final-audit attention: No universal UGC criteria.
Presenter-led product limitation
Revision approach: C09 carries limitation. Residual limitation: unresolved. Final-audit attention: No presenter subtype overclaim.
Corporate / industrial limitation
Revision approach: C09 carries limitation. Residual limitation: unresolved. Final-audit attention: No corporate/industrial universal rubric.
No-brief brand / product / situation invention
Revision approach: C05 blocks invention. Residual limitation: partly synthesis-derived. Final-audit attention: No brand/product/audience claims without support.
Technical assessability versus performance
Revision approach: C10. Residual limitation: live reliability behaviour unverified. Final-audit attention: Poor visibility should narrow reliability.
Audio / speech audibility
Revision approach: C11. Residual limitation: speech/accent access detail broad. Final-audit attention: Poor audio should not become poor copy handling.
Simple capture / anti-polish
Revision approach: C12. Residual limitation: output wording unverified. Final-audit attention: No studio/polish reward.
Equipment / production-value exclusion
Revision approach: C12 and C18. Residual limitation: display phrasing needs QA. Final-audit attention: No professional setup as merit.
Reader-as-process support
Revision approach: C13. Residual limitation: brief compliance nuance. Final-audit attention: No paid-reader scoring.
Self-tape burden, upload and deadline process boundaries
Revision approach: C13. Residual limitation: explicit brief compliance remains legitimate. Final-audit attention: No early-submission talent claim.
professional_presentation boundaries
Revision approach: C18. Residual limitation: display not supplied. Final-audit attention: Presentation limited to assessability, brief response and safe process.
brief_adherence / professional standards boundaries
Revision approach: C05 and C13. Residual limitation: exact production prompt not supplied. Final-audit attention: No false brief compliance.
Live-room-only / process-only overclaim
Revision approach: C14. Residual limitation: directly shown exceptions must be narrow. Final-audit attention: No callback readiness from finished tape.
Callback readiness and response-to-direction scope
Revision approach: C14. Residual limitation: no live outputs. Final-audit attention: High-priority non-regression test.
Nudity / stunt / privacy / consent boundaries
Revision approach: C15. Residual limitation: not implementation-tested. Final-audit attention: Safety boundary remains process/safety.
Accessibility-safe and non-deficit handling
Revision approach: C16. Residual limitation: some operational detail broad. Final-audit attention: No access context as deficit.
Protected-characteristic and stereotype-led suitability boundaries
Revision approach: C17. Residual limitation: marketability/appearance exclusion partly inferential. Final-audit attention: No commercial look or buyer-fit bias.
Marketability / bookability / appearance exclusion
Revision approach: C17. Residual limitation: supported by fairness spine, not always verbatim. Final-audit attention: Check no desirability-coded language.
Methodology / practitioner / source-shape overreach
Revision approach: C19. Residual limitation: B1 and B4 source shapes. Final-audit attention: No practitioner method as universal rule.
Display / label / comparison risks
Revision approach: C21 preserves watch item. Residual limitation: not auditable from supplied materials. Final-audit attention: Carry to output-spec/live QA.
Timestamp and next-take specificity
Revision approach: C20. Residual limitation: renderer/export not supplied. Final-audit attention: Behavioural evidence, no padding.
10. Residual Risks and Out-of-Scope Architecture Notes
Issue
Why it remains open
Revision change ID(s)
Fully mitigated in wording?
Can final audit proceed?
Carry as limitation or defer?
Note
Current six-field architecture constraining exact Commercial sub-dimensions
No new fields allowed
C01–C21
Partly
Yes
Carry
Wording-only refinement
No live Commercial outputs supplied
No spot QA possible
C03, C20, C21
No
Yes
Carry
Output QA later
Frontend / category label behaviour not supplied
Display layer unseen
C21
No
Yes
Defer
Output-spec/live QA
Comparison-page behaviour not supplied
Comparison not auditable
C21
No
Yes
Defer
Preserve watch item
Renderer / export timestamp behaviour not supplied
Render parity unknown
C20, C21
Partly
Yes
Defer
Test later
UGC / social-style evidence thinness
Source base weak
C09
Partly
Yes
Carry
Limitation block added
Presenter-led product evidence thinness
Source base weak
C09
Partly
Yes
Carry
Limitation block added
Corporate / industrial evidence thinness
Source base weak
C09
Partly
Yes
Carry
Limitation block added
Voiceover-style support conditional only
B4 narrow
C08
Partly
Yes
Carry
Use only task-present
Source-shape limits in B1 and B4
Platform/course/practitioner-shaped
C19
Partly
Yes
Carry
Overreach check needed
US Commercial-specific evidence preview limitations
Less extractable than UK
C15, C13
Partly
Yes
Carry
UK evidence stronger
Marketability / appearance exclusion partly inferential
Not always verbatim
C17
Partly
Yes
Carry
Safety/fairness spine supports
Broad access detail for accent / speech difference / gender-diverse voice
Accessibility evidence broad
C11, C16
Partly
Yes
Carry
Non-deficit rule mitigates
11. Provisional Non-Regression Test Mapping
Audit test ID
Scenario
Relevant revision change ID(s)
Relevant section ID(s)
Revised baseline should force
Revised baseline should block
Priority
Final-audit / output-specificity use note
T01
Mainstream direct-to-camera Commercial
C01, C02, C04, C06
S01, S02, S04, S06
Addressee/camera/copy evidence
Generic presence only
P0
Core Commercial test
T02
Off-camera-reader / scene-style Commercial
C06, C13
S06, S13
Reader-scene relationship evidence
Direct-to-camera criticism by default
P0
Camera setup test
T03
No-dialogue / silent-vignette Commercial
C07
S07
Visible story/reaction evidence
Spoken-copy criteria imposed
P1
Conditional subtype test
T04
Commercial tape with no brief
C05
S05
Observable-only grounding
Invented brand/product/audience
P0
False-specificity test
T05
Supplied brand/product/copy
C04, C05
S04, S05
Brief/copy/product-specific evidence
Unsupported expansion beyond brief
P0
Brief-mode grounding
T06
Generic “natural/confident” output
C03
S03
Behavioural replacement
Generic praise alone
P0
Genericity test
T07
Strong copy, weak camera
C04, C06
S04, S06
Separate copy and camera evidence
Single inflated presence claim
P1
Category specificity
T08
Strong camera, unclear copy
C04, C06
S04, S06
Separate camera and copy evidence
Camera work as full Commercial merit
P1
Evidence balance
T09
Poor lighting/framing
C10, C20
S10, S20
Reliability/assessability caveat
Performance criticism from unreadability
P0
Assessability test
T10
Poor audio
C11
S11
Audibility boundary
Poor performance from poor audio
P0
Audio reliability
T11
Assessable smartphone/home capture
C12, C18
S12, S18
Simple capture acceptability
Penalising non-studio setup
P0
Anti-polish
T12
High polish, weak performance
C12, C18
S12, S18
Performance evidence decisive
Reward polish/equipment
P0
Anti-polish
T13
Paid/pro reader vs basic reader
C13, C18
S13, S18
Reader as process support
Paid reader as talent evidence
P0
Resource fairness
T14
Reader absence / weakness
C13
S13
Assessability caveat if needed
Performer talent penalty for reader
P1
Reader boundary
T15
Response to direction inferred
C14
S14
Not inferable unless shown
Direction-response claim
P0
Live-room boundary
T16
Callback readiness inferred
C14
S14
Present-tape evidence only
Callback readiness from tape
P0
Live-room boundary
T17
Fast turnaround / early submission as talent
C13
S13
Process-only handling
Talent/professionalism scoring
P1
Process boundary
T18
File/slate admin as talent
C13
S13
Brief/admin caveat only
Performance merit/deficit
P1
Process boundary
T19
Voiceover-style commercial copy
C08, C04
S08, S04
Conditional copy/POV evidence
Generalising to all Commercial
P1
Conditional subtype
T20
UGC/social overclaimed
C09
S09
Limitation language
Universal UGC rules
P1
Evidence limit
T21
Presenter-led product overclaimed
C09
S09
Limitation language
Universal presenter criteria
P1
Evidence limit
T22
Corporate/industrial overclaimed
C09
S09
Limitation language
Corporate universal rubric
P1
Evidence limit
T23
No-brief brand/product/audience invention
C05
S05
No-brief restraint
Invented buyer/brand
P0
False-specificity
T24
Marketability/bookability/look language
C17
S17
Anti-bias exclusion
Marketability/look scoring
P0
Bias test
T25
Access-adapted context
C16
S16
Non-deficit assessable evidence
Access as weakness
P0
Access-safe test
T26
Visual impairment / Deaf or disabled access
C16
S16
Process/support context
Deficit inference
P0
Access-safe test
T27
Speech difference/accent/gender-diverse voice
C11, C16
S11, S16
Non-deficit, task-specific caution
Speech/accent deficit
P0
Access/speech test
T28
Polish rewarded in professional_presentation
C12, C18
S12, S18
Assessability/brief/safe process only
Production polish reward
P0
Presentation test
T29
Comparison-page label mismatch
C21
S21
Carry watch item
Claim display verified
P2
Display test later
T30
Timestamp underproduction / generic notes
C20
S20
Commercial evidence anchors
Generic timestamps / padding
P0
Output-specificity test
12. Revision Scope for COMMERCIAL-FINAL-AUDIT
Final-audit target section
Why it needs checking
Revision change ID(s)
Audit recommendation ID(s)
SYN finding ID(s)
Must preserve
Must not regress
Priority
Commercial field semantics
Confirms acting field is clarified without rename
C02
R02
F03–F06
Shared acting field
Vague presence / schema change
P0
Commercial distinctiveness
Prevents theatre/generic screen leakage
C01
R01
F01, F02
Current Commercial type
Theatre acting default
P0
Direct-to-camera guidance
Checks task-specific camera logic
C06
R06
F07, F14
No new subtype field
Universal eyeline
P0
Reader-scene guidance
Checks mediated reader handling
C06, C13
R06, R13
F08, F15
Reader evidence where observable
Paid-reader scoring
P0
Copy/tone/product grounding
Checks evidence anchors
C04
R04
F04–F06
Brief mode
Brand/product invention
P0
No-brief guardrail
Checks false-specificity controls
C05
R05
F06, F18, F20
Baseline mode
No-brief invention
P0
Assessability guidance
Checks technical reliability
C10
R10
F12, F13
Technical/audio caps
Performance from unreadable tape
P0
Audio reliability guidance
Checks audibility boundary
C11
R11
F17, F21
Audio field
Speech/audio bias
P0
professional_presentation boundary
Checks anti-polish
C18
R18
F16, F18, F20
Field unchanged
Polish/resource reward
P0
Process-only boundaries
Checks reader/admin/deadline handling
C13
R13
F15, F18
Brief compliance allowed
Process as talent
P0
Live-room claim boundary
Checks redirection/callback block
C14
R14
F22
Finished-tape scope
Live-room overclaim
P0
Accessibility / anti-deficit
Checks non-deficit wording
C16
R16
F21
Existing safety scrubs
Access deficits
P0
Anti-marketability / appearance
Checks bias exclusions
C17
R17
F20
Role-fit bounds
Look/bookability scoring
P0
Generic-feedback suppression
Checks phrase replacement
C03
R03
F23
Report sections
Generic praise
P0
Subtype limitation block
Checks weak subtypes not overbuilt
C07, C08, C09
R07–R09
F09–F11
Evidence limits
Unsupported subtype rubrics
P1
Source-shape caution
Checks overreach
C19
R19
F24
Source boundaries
Practitioner/course scoring
P1
Timestamp rules
Checks evidence density guidance
C20
R20
F23, F12
Max 8 timestamps
Generic/padded notes
P0
Display / label note
Checks watch item preserved
C21
R21
F24
No UI proposal
Claim display verified
P2
13. Open Risks and Deferred Issues
Issue
Why it remains open
Revision change ID(s)
Can final audit proceed?
Carry as limitation or defer?
Note
No live Commercial outputs
None supplied
C03, C20, C21
Yes
Carry
Live QA later
Frontend/category labels
Display layer not supplied
C21
Yes
Defer
Output-spec/live QA
Comparison-page behaviour
Not supplied
C21
Yes
Defer
Later verification
Renderer/export timestamps
Not supplied
C20, C21
Yes
Defer
Later verification
UGC/social evidence thinness
Source gap
C09
Yes
Carry
Limitation explicit
Presenter-led product thinness
Source gap
C09
Yes
Carry
Limitation explicit
Corporate/industrial thinness
Source gap
C09
Yes
Carry
Limitation explicit
Voiceover support conditional
B4 low authority
C08
Yes
Carry
Narrow use only
Marketability/appearance exclusion partly inferential
Not always verbatim
C17
Yes
Carry
Safety spine strong
Access detail broad
Accent/speech/gender-diverse voice not operationally deep
C11, C16
Yes
Carry
Non-deficit mitigates
Six-field constraints
Architecture preserved
C01–C21
Yes
Carry
Wording-level only
14. Reusable Handoff Pack for COMMERCIAL-FINAL-AUDIT
COMMERCIAL-REV is complete at wording, evidence-standard and guardrail level. It preserves the current shared TapeCoach architecture, including the six score fields, current Commercial weights, caps, blockers, verdict thresholds, role-fit bounds, server-side recomputation, Step 1 / Step 2 pipeline, report schema, public JSON structure and Musical Theatre acting + song stabilised flow. No implementation, backend, schema, UI, weighting or score-field changes are proposed.
The revision clarifies the current Commercial acting field as Commercial presence / naturalism only where that meaning is grounded in observable Commercial evidence: copy communication, task-calibrated tone, believable scale, camera or reader relationship, addressee logic, rhythm, immediacy and product/situation grounding where supplied. It adds a clear distinctiveness guardrail so Commercial does not become theatre acting or generic screen acting by default. It also blocks no-brief invention of brand, product, buyer, target audience, campaign world, casting fit or platform requirements.
The revision separates direct-to-camera work from off-camera-reader / scene-style Commercial work, adds conditional handling for no-dialogue / silent-vignette Commercial and voiceover-style copy, and explicitly carries UGC/social, presenter-led product and corporate/industrial as limitations rather than unsupported sub-rubrics. It codifies self-tape assessability as a precondition for reliable feedback, separates audio audibility from Commercial performance, protects simple domestic capture, and blocks production polish, studio quality, paid reader access, paid coaching and paid editing as Commercial merit.
Fairness and safety were strengthened through non-deficit access handling, anti-marketability / anti-bookability / anti-appearance rules, protected-characteristic boundaries, and process-only handling for reader access, slate, upload, file naming, deadline pressure and self-tape burden. Live-room-only capacities such as response to direction, callback readiness and campaign-pressure professionalism are blocked unless directly shown.
Compact change summary:
COMMERCIAL-REV-C01 — Commercial distinctiveness
COMMERCIAL-REV-C02 — Acting-as-presence/naturalism semantics
COMMERCIAL-REV-C03 — Generic praise suppression
COMMERCIAL-REV-C04 — Tone/copy/product grounding
COMMERCIAL-REV-C05 — No-brief grounding
COMMERCIAL-REV-C06 — Direct-to-camera / reader-scene split
COMMERCIAL-REV-C07 — No-dialogue conditionality
COMMERCIAL-REV-C08 — Voiceover conditionality
COMMERCIAL-REV-C09 — Subtype limitation block
COMMERCIAL-REV-C10 — Assessability precondition
COMMERCIAL-REV-C11 — Audio reliability boundary
COMMERCIAL-REV-C12 — Simple capture / anti-polish
COMMERCIAL-REV-C13 — Process-only admin/resources
COMMERCIAL-REV-C14 — Live-room boundary
COMMERCIAL-REV-C15 — Safety boundaries
COMMERCIAL-REV-C16 — Accessibility-safe Commercial
COMMERCIAL-REV-C17 — Anti-marketability / appearance
COMMERCIAL-REV-C18 — professional_presentation boundary
COMMERCIAL-REV-C19 — Source-shape caution
COMMERCIAL-REV-C20 — Timestamp / next-take specificity
COMMERCIAL-REV-C21 — Display / comparison watch item
Compact section summary:
COMMERCIAL-REV-S01–S21 correspond to the section-by-section package above.
Priority final-audit scope: Commercial semantics, distinctiveness, no-brief grounding, copy/tone/product evidence, direct/readers split, assessability, anti-polish, process-only boundaries, live-room overclaim, accessibility, anti-marketability/appearance, generic-feedback suppression and timestamp specificity.
What was revisable:
supplied Commercial baseline slice;
Commercial-specific guardrail/addendum wording;
evidence requirements and claim-scope rules.
What was not revisable:
exact production Commercial prompt text;
frontend labels;
comparison-page behaviour;
renderer/export timestamp behaviour;
live Commercial output quality;
implementation-layer subtype detection.
Evidence basis: COMMERCIAL-SYN-F01–F24, COMMERCIAL-AUDIT-I01–I17, COMMERCIAL-AUDIT-R01–R21, COMMERCIAL-S001–S030, COMMERCIAL-B1-F01–F09, COMMERCIAL-B2-F01–F09, COMMERCIAL-B3-F01–F10, COMMERCIAL-B4-F01–F06, and preserved TapeCoach baseline constraints.
15. Completion Statement
COMMERCIAL-REV complete. Ready for COMMERCIAL-FINAL-AUDIT.

---

## Links

- **Previous:** [[drr-commercial-07-audit]] — Synthesis Audit
- **Next:** [[drr-commercial-09-output-spec]] — Output Spec
- **Thread overview:** [[drr-commercial-overview]]
- **Programme:** [[drr-programme-overview]]
