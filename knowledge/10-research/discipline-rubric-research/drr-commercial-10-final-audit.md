---
id: drr-commercial-10-final-audit
title: Commercial — Final Audit
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/5. Commercial/COMMERCIAL-FINAL-AUDIT .md"
discipline: commercial
monday_ref: null
tags: [discipline-rubric-research, commercial, stage-final-audit]
confidence: medium
created: 2026-05-06
imported: 2026-06-08
updated: 2026-06-08
---

# Commercial — Final Audit

> **Imported research — Discipline Rubric Research programme.** Step 10 of 12 in the Commercial thread (`stage-final-audit`). Original file: `5. Commercial/COMMERCIAL-FINAL-AUDIT .md`. Original date: 2026-05-06 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-commercial-overview]].

---

1. Final Audit Readiness Check
Check
Result
Note
Full COMMERCIAL-REV section package present
Yes
COMMERCIAL-REV-S01–S21 supplied
Clean revised Commercial baseline package present
Yes
Revised Commercial rubric slice, guardrail additions and addenda supplied
COMMERCIAL-REV handoff present
Yes
Includes COMMERCIAL-REV-C01–C21 and revision scope
COMMERCIAL-AUDIT handoff present
Yes
Includes COMMERCIAL-AUDIT-I01–I17 and R01–R21
COMMERCIAL-SYN handoff present
Yes
Includes COMMERCIAL-SYN-F01–F24 and limitation register
Baseline-control materials present
Yes
Shared fields, weights, caps, pipeline, MT anchor and safety constraints supplied
Exact revised version being audited
COMMERCIAL-REV package with COMMERCIAL-REV-S01–S21 and COMMERCIAL-REV-C01–C21
Wording / evidence-standard / guardrail revision only
Source IDs normalised
Yes
COMMERCIAL-S001–COMMERCIAL-S030
Final audit may proceed
Yes
Live Commercial outputs and display-layer materials remain unavailable
Caveats
Exact production Commercial prompt text was not supplied.
No current Commercial live outputs were supplied.
Frontend labels, comparison-page behaviour, rendered timestamp count and PDF/export parity remain unverified.
This final audit can approve or reject the revised Commercial baseline wording and guardrail package, but it cannot verify live rendered output behaviour.
2. Final Audit Input Register
Input item
Type
Present?
Used in final audit?
Role in final audit
Limitation / note
COMMERCIAL-REV section package
Revised baseline text
Yes
Yes
Primary object under audit
No live-rendered examples
Clean revised Commercial baseline package
Consolidated revision
Yes
Yes
Checks usability and consistency
Wording-level only
COMMERCIAL-AUDIT handoff
Audit control
Yes
Yes
Tests R01–R21 implementation
Recommendations compact but sufficient
COMMERCIAL-SYN handoff
Evidence basis
Yes
Yes
Tests compliance with F01–F24
No synthesis reopened
Preserved baseline / guardrail context
Non-regression control
Yes
Yes
Protects fields, weights, caps, pipeline and MT anchor
Used as constraint
Completed branch anchors
Cross-branch control
Yes
Yes
Prevents MT, Dance, Acting, Voice / Singing regression
Used only as reference
Live Commercial outputs
Output QA material
No
No
Would enable spot audit
Deferred to output-spec / live QA
Frontend / comparison / renderer material
Display QA material
No
No
Would verify labels and timestamp parity
Deferred
3. Final Audit Scope and Preservation Rules
This final audit covers whether COMMERCIAL-REV is materially responsive to COMMERCIAL-AUDIT-R01–R21, materially compliant with COMMERCIAL-SYN-F01–F24, and safe to move into Commercial Output Specificity / Non-Regression Test Mapping.
It does not cover production implementation, code, backend behaviour, schema, UI rendering, comparison-page behaviour, live Commercial output quality, actual prompt deployment, score recalculation code or product rollout.
The following remain preserved without change:
six stored score fields: technical, audio, vocal, acting, brief_adherence, professional_presentation;
current Commercial weighting: acting as presence/naturalism 60%, brief_adherence 20%, technical 15%, audio 5%;
score caps, blockers, verdict thresholds and role-fit bounds;
server-side score recomputation;
Step 1 evidence pass and Step 2 text-only polish;
locked-field enforcement;
report schema and public JSON structure;
MT acting + song stabilised flow;
Dance, Acting and Voice / Singing label protections;
safety, material-policy, presentation and accessibility scrubs.
A return to COMMERCIAL-REV would be required only if the revised text introduced a schema/weight change, failed to clarify Commercial field semantics, allowed marketability/appearance/polish scoring, collapsed Commercial into generic Acting, or failed to block no-brief invention and live-room overclaim. No such blocking failure is present.
4. Recommendation Acceptance Matrix
Audit rec ID
Title
Revised section(s) checked
REV change ID(s)
Final-audit status
Why
Issue ID(s)
SYN finding ID(s)
Source ID(s)
Check ID
Severity if unresolved
Residual caution
COMMERCIAL-AUDIT-R01
Commercial distinctiveness guardrail
S02
C01
Pass
Commercial is separated from theatre acting and generic screen acting
I01
F01, F02
S001–S008
COMMERCIAL-FINAL-CK01
Critical
Avoid over-narrowing Commercial
R02
Acting-as-presence semantics
S01
C02
Pass
acting meaning clarified without renaming field
I02
F03–F06
S001, S004, S007, S008
CK02
Critical
Shared field remains
R03
Suppress generic praise
S03
C03
Pass
Generic phrases require observable replacement evidence
I03
F23
S001–S014
CK03
Critical
Requires output QA
R04
Tone/copy/product grounding
S04
C04
Pass
Tone/copy/product claims must be grounded
I04
F04–F06
S001, S004, S005, S007, S008, S028–S030
CK04
Critical
No-brief limits must hold
R05
No-brief grounding
S05
C05
Pass
Blocks invented brand/product/audience/campaign claims
I05
F06, F18, F20
S015–S021
CK05
Critical
Clause is synthesis-derived but safe
R06
Direct-to-camera / reader-scene split
S06
C06
Pass
Camera and eyeline are task-specific
I06
F07, F08, F14
S004, S005, S007, S009–S014
CK06
High
Avoid universal eyeline
R07
No-dialogue conditional handling
S07
C07
Pass with limitation
Adds conditional silent-vignette handling
I14
F09
S001, S006
CK07
Medium
Evidence thinner than mainstream
R08
Voiceover conditional handling
S08
C08
Pass with limitation
Voiceover evidence is explicitly conditional
I14, I15
F10, F24
S028–S030
CK08
Medium
Do not generalise tone lists
R09
Subtype limitation block
S09
C09
Pass
UGC, presenter-led and corporate/industrial remain limitations
I14
F11, F24
S025–S030
CK09
Medium
Future research may refine
R10
Assessability as precondition
S10
C10
Pass
Reliable claims require readable sight/sound/framing
I07
F12, F13
S009–S014
CK10
Critical
Live reliability behaviour unverified
R11
Audio audibility vs performance
S11
C11
Pass
Poor audio cannot become weak Commercial performance by itself
I07
F17, F21
S009–S014, S019, S020
CK11
Critical
Speech/accent detail broad
R12
Simple capture / anti-polish
S12
C12
Pass
Simple capture protected; polish blocked as merit
I08
F16, F17
S009–S016
CK12
Critical
Output wording needs QA
R13
Reader/admin/deadline process-only
S13
C13
Pass
Reader, upload, slate and deadlines bounded as process/admin
I09
F15, F18
S009–S024
CK13
High
Explicit brief compliance remains allowed
R14
Live-room-only claim boundary
S14
C14
Pass
Direction response and callback readiness blocked unless directly shown
I10
F22
S015–S024
CK14
Critical
Directly shown exceptions remain narrow
R15
Safety boundary
S15
C15
Pass
Nudity, stunts, privacy and consent treated as safety/process
I10, I12
F19
S015–S024
CK15
High
Not implementation-tested
R16
Accessibility-safe rules
S16
C16
Pass with limitation
Access context treated as non-deficit
I11
F21
S015, S017, S019–S021
CK16
Critical
Detail for accent/speech/gender-diverse voice remains broad
R17
Anti-marketability / anti-appearance
S17
C17
Pass
Marketability, bookability, look and protected traits blocked
I12
F20
S017, S018, S020, S021
CK17
Critical
Some support inferential
R18
professional_presentation boundary
S18
C18
Pass
Presentation bounded to assessability/brief/safe process
I13
F16, F18, F20
S009–S024
CK18
High
Display wording unverified
R19
Source-shape caution
S19
C19
Pass
Practitioner/course/client-facing evidence cannot become universal
I15
F24
S001–S030
CK19
High
Overreach check needed later
R20
Timestamp / next-take evidence
S20
C20
Pass with limitation
Timestamp and next-take guidance requires Commercial anchors
I17
F23, F12
S001–S014
CK20
High
Renderer/export unverified
R21
Display / label / comparison watch item
S21
C21
Accepted with limitation
Correctly carried as watch item, not implemented
I16
F24
Baseline controls
CK21
Medium
Not auditable without display materials
5. Revision Section Acceptance Table
Section ID
Section title
Final-audit status
What it now does well
What remains weak / ambiguous
Change ID(s)
Audit rec ID(s)
SYN finding ID(s)
Check ID
Final release caution
COMMERCIAL-REV-S01
Field semantics / acting-as-presence
Accepted
Clarifies Commercial use of acting
Shared field remains
C02
R02
F03–F06
CK02
Confirm no score-field change implied
S02
Commercial distinctiveness
Accepted
Blocks theatre/generic screen leakage
Some source-shape caution remains
C01
R01
F01, F02
CK01
Do not over-narrow style
S03
Generic feedback suppression
Accepted
Requires behavioural evidence
Needs live-output QA
C03
R03
F23
CK03
Test outputs
S04
Copy / tone / product grounding
Accepted
Grounds claims in supplied or observable context
Voiceover support conditional
C04
R04
F04–F06
CK04
No no-brief invention
S05
No-brief grounding
Accepted
Blocks brand/product/audience invention
Direct source clause indirect
C05
R05
F06, F18, F20
CK05
Test no-brief outputs
S06
Direct-to-camera / reader-scene split
Accepted
Splits camera and eyeline logic by task
Generic self-tape evidence in B2
C06
R06
F07, F08, F14
CK06
No universal eyeline
S07
No-dialogue conditionality
Accepted with limitation
Adds safe non-verbal Commercial handling
Evidence thinner
C07
R07
F09
CK07
Conditional only
S08
Voiceover conditionality
Accepted with limitation
Narrows voiceover use
B4 lower authority
C08
R08
F10, F24
CK08
Do not generalise
S09
Subtype limitation block
Accepted
Carries UGC/presenter/corporate as limitations
Subtype evidence unresolved
C09
R09
F11, F24
CK09
No unsupported subtype rubric
S10
Assessability precondition
Accepted
Separates readability from performance
Live reliability not tested
C10
R10
F12, F13
CK10
Output QA required
S11
Audio reliability boundary
Accepted
Separates audibility from performance
Access speech detail broad
C11
R11, R16
F17, F21
CK11
Test poor-audio cases
S12
Simple capture / anti-polish
Accepted
Protects simple capture and blocks polish
Live wording untested
C12
R12
F16, F17
CK12
Test professional_presentation
S13
Process-only admin/resources
Accepted
Bounds reader/admin/deadline as process
Brief-compliance nuance remains
C13
R13
F15, F18
CK13
Avoid resource scoring
S14
Live-room boundary
Accepted
Blocks response/callback inference
Directly shown exception narrow
C14
R14
F22
CK14
Test overclaims
S15
Safety boundaries
Accepted
Adds nudity/stunt/privacy/consent guardrail
Not implementation-tested
C15
R15
F19
CK15
Safety scrub interactions later
S16
Accessibility-safe Commercial
Accepted with limitation
Blocks access-deficit inference
Some detail broad
C16
R16
F21
CK16
Test adapted contexts
S17
Anti-marketability / appearance
Accepted
Strong exclusion block
Some support inferential
C17
R17
F20
CK17
Test desirability-coded language
S18
professional_presentation boundary
Accepted
Limits to assessability/brief/safe process
Display wording unknown
C18
R18
F16, F18, F20
CK18
Presentation wording QA
S19
Source-shape caution
Accepted
Prevents practitioner/course overreach
Must remain visible in later stages
C19
R19
F24
CK19
Keep B4 conditional
S20
Timestamp / next-take specificity
Accepted with limitation
Requires Commercial evidence anchors
Renderer/export unknown
C20
R20
F23, F12
CK20
Render parity later
S21
Display / comparison watch item
Accepted with limitation
Correctly marks display as unverified
Not auditable
C21
R21
F24
CK21
Carry to output-spec/live QA
6. Revision Change Acceptance Register
Change ID
Change title
Final-audit status
What was solved
What remains open
Section ID(s)
Audit rec ID(s)
SYN finding ID(s)
Follow-up priority
Decision note
COMMERCIAL-REV-C01
Commercial distinctiveness
Accepted
Prevents theatre/generic screen default
Over-narrow style risk
S02
R01
F01, F02
P0
Ready for output-spec
C02
Acting-as-presence semantics
Accepted
Clarifies acting field meaning
Shared architecture
S01
R02
F03–F06
P0
No field rename implied
C03
Generic praise suppression
Accepted
Blocks free-floating praise
Live enforcement
S03
R03
F23
P0
Test outputs
C04
Tone/copy/product grounding
Accepted
Grounds Commercial claims
No-brief overreach watch
S04
R04
F04–F06
P0
Strong
C05
No-brief grounding
Accepted
Blocks invented context
Direct clause indirect
S05
R05
F06, F18, F20
P0
Safe
C06
Camera task split
Accepted
Splits direct/reader contexts
Generic B2 source basis
S06
R06
F07, F08, F14
P0
No universal eyeline
C07
No-dialogue conditionality
Accepted with limitation
Adds silent-vignette handling
Thin evidence
S07
R07
F09
P1
Conditional
C08
Voiceover conditionality
Accepted with limitation
Narrows voiceover use
B4 lower authority
S08
R08
F10, F24
P1
Conditional
C09
Subtype limitation block
Accepted
Carries weak subtypes as limitations
Gaps remain
S09
R09
F11, F24
P1
Safe
C10
Assessability precondition
Accepted
Separates assessability from performance
Live reliability
S10
R10
F12, F13
P0
Strong
C11
Audio reliability boundary
Accepted
Separates audibility from performance
Access detail broad
S11
R11, R16
F17, F21
P0
Strong
C12
Simple capture / anti-polish
Accepted
Blocks polish as merit
Output wording
S12
R12
F16, F17
P0
Strong
C13
Process-only admin/resources
Accepted
Blocks reader/admin/resource scoring
Brief nuance
S13
R13
F15, F18
P0
Strong
C14
Live-room boundary
Accepted
Blocks callback/direction inference
Direct evidence exception
S14
R14
F22
P0
Strong
C15
Safety boundaries
Accepted
Adds nudity/stunt/privacy/consent boundary
Implementation not tested
S15
R15
F19
P1
Safe
C16
Accessibility-safe Commercial
Accepted with limitation
Non-deficit access handling
Operational detail broad
S16
R16
F21
P0
Strong enough
C17
Anti-marketability / appearance
Accepted
Blocks look/bookability/marketability
Some inferential support
S17
R17
F20
P0
Strong enough
C18
professional_presentation boundary
Accepted
Blocks polish/resource/class drift
Display unknown
S18
R18
F16, F18, F20
P0
Strong
C19
Source-shape caution
Accepted
Prevents evidence overreach
Must persist later
S19
R19
F24
P1
Strong
C20
Timestamp / next-take specificity
Accepted with limitation
Adds Commercial evidence anchors
Renderer/export unknown
S20
R20
F23, F12
P0
Test later
C21
Display / comparison watch
Accepted with limitation
Carries unverified display risk
Not tested
S21
R21
F24
P2
Output-spec required
7. Topic-by-Topic Final Audit Summary
Commercial distinctiveness from theatre acting
Status: pass. The revised baseline explicitly blocks theatre-acting default language and redirects feedback to Commercial copy, addressee, tone and task scale. No revision loop required.
Commercial distinctiveness from generic screen acting
Status: pass. The revised baseline distinguishes Commercial from generic screen acting where copy, product, campaign and situation context matter. No revision loop required.
Acting-as-presence/naturalism field semantics
Status: pass with limitation. The wording clarifies Commercial acting as observable presence/naturalism without renaming the field. Structural field-sharing remains a limitation, not a blocker.
Generic “natural / confident / presence” suppression
Status: pass. The revised text names risky phrases and requires behavioural replacement evidence. Output enforcement remains live-QA dependent.
Tone calibration
Status: pass. Tone must be grounded in brief, copy, product, situation or observable tape evidence. No revision loop required.
Copy handling
Status: pass. Copy communication, cue-word handling, rhythm and point of view are now named as Commercial evidence where supported. Voiceover use remains conditional.
Product / brand / situation grounding
Status: pass. The revised baseline blocks unsupported product/brand/audience invention and allows grounding only where supplied or visible.
Direct-to-camera handling
Status: pass. Direct address and lens relationship are task-specific. No universal direct-to-camera rule is introduced.
Off-camera-reader / reader-scene handling
Status: pass. Reader-scene work is treated as mediated; reader access remains process rather than talent evidence.
No-dialogue / silent-vignette Commercial
Status: pass with limitation. The revision handles no-dialogue work conditionally and does not generalise it.
Voiceover-style Commercial as conditional
Status: pass with limitation. Voiceover-style evidence is explicitly conditional and low-confidence relative to B1–B3.
UGC / social-style limitation
Status: pass. The revision keeps UGC/social-style as a limitation, not a universal Commercial subtype.
Presenter-led product limitation
Status: pass. Presenter-led product remains under-evidenced and safely constrained.
Corporate / industrial limitation
Status: pass. Corporate/industrial remains an explicit limitation.
No-brief brand / product / situation invention
Status: pass. No-brief Commercial reports are restricted to observable evidence. This is a critical non-regression target.
Technical assessability versus performance
Status: pass. Assessability is a precondition and limited sight/sound narrows reliability before performance criticism.
Audio / speech audibility
Status: pass. Poor audio does not prove weak Commercial performance or weak speech skill.
Simple capture / anti-polish
Status: pass. Domestic capture and phones are protected; studio polish and production value are blocked as merit.
Equipment / production-value exclusion
Status: pass. Expensive equipment, studio polish, paid coaching and paid editing are excluded as talent evidence.
Reader-as-process support
Status: pass. Reader access, quality and paid-resource status are process issues.
Self-tape burden, upload and deadline process boundaries
Status: pass. Early submission, upload friction, file naming and deadline pressure are bounded as process/admin.
professional_presentation boundaries
Status: pass. professional_presentation is limited to assessability, brief response, safe process and observable task preparation.
brief_adherence / professional standards boundaries
Status: pass. Explicit brief compliance remains possible, but no-brief invention is blocked.
Live-room-only / process-only overclaim
Status: pass. Direction response, callback readiness and client-room behaviour are blocked unless directly shown.
Callback readiness and response-to-direction scope
Status: pass. Finished tape evidence cannot prove these capacities unless explicitly present.
Nudity / stunt / privacy / consent boundaries
Status: pass. These remain safety/process issues, not performer merit or willingness.
Accessibility-safe and non-deficit handling
Status: pass with limitation. Strong non-deficit rule added; accent, speech difference and gender-diverse voice detail remains broad.
Protected-characteristic and stereotype-led suitability boundaries
Status: pass. The revision blocks protected-trait and stereotype-led suitability claims.
Marketability / bookability / appearance exclusion
Status: pass with limitation. The exclusion is strong enough for wording-level approval; some support is inferential rather than verbatim Commercial-specific.
Methodology / practitioner / source-shape overreach
Status: pass. Source-shape caution is explicit and B4 is correctly conditional.
Display / label / comparison risks
Status: accepted with limitation. Display behaviour remains unverified and is correctly carried forward.
Timestamp and next-take specificity
Status: pass with limitation. Commercial-specific timestamp and next-take anchors are now present; renderer/export behaviour remains unverified.
8. Preservation and Non-Regression Audit
Constraint
Final-audit result
Note
No score-field changes
Pass
Six stored fields preserved
No weighting changes
Pass
Commercial weights preserved
No cap / blocker / verdict changes
Pass
No scoring logic change implied
No role-fit bound change
Pass
Role-fit restrictions strengthened only by wording
No schema changes
Pass
No schema proposal
No backend changes
Pass
No implementation proposal
No pipeline changes
Pass
Step 1 / Step 2 preserved
No server-side recomputation change
Pass
Server ownership preserved
No public JSON change
Pass
No report schema changes
No MT stabilised-flow regression
Pass
MT acting + song anchor explicitly protected
No Dance label regression
Pass
Dance no-singing protection unaffected
No Acting speech-label regression
Pass
Acting anchor unaffected
No Voice / Singing sung-vocal regression
Pass
Voice/Singing meaning protected
No generic shared praise reintroduced
Pass
Generic Commercial praise suppressed
No accessibility-safe protections weakened
Pass
Accessibility strengthened
No external marks / frameworks imported as weights
Pass
Source-shape caution explicit
9. Overreach and Evidence-Limit Check
Potential overreach area
Does revised baseline overreach?
Evidence limit
Revised wording safety
Follow-up required?
Related change ID(s)
Related SYN finding ID(s)
UGC/social universal criteria
No
Evidence thin
Limitation block
Yes, future research if needed
C09
F11, F24
Presenter-led product universal criteria
No
Evidence thin
Limitation block
Yes
C09
F11, F24
Corporate/industrial universal criteria
No
Evidence thin
Limitation block
Yes
C09
F11, F24
Voiceover as all Commercial
No
B4 conditional
Voiceover limited to task-present cases
Yes, output QA
C08
F10, F24
Voiceover tone lists as categories
No
Non-comprehensive/practitioner-shaped
Explicitly blocked
No immediate revision
C08, C19
F10, F24
Client-facing copywriting as scoring
No
Low-confidence source
Blocked as universal scoring
No immediate revision
C08, C19
F24
Direct-to-camera universal rule
No
Task-specific evidence
Explicitly blocked
Output QA
C06
F07, F14
Off-camera eyeline universal rule
No
Mixed self-tape evidence
Explicitly task-specific
Output QA
C06
F08, F14
Production polish as merit
No
B2/B3 anti-polish
Explicitly blocked
Output QA
C12, C18
F16–F18
Marketability/bookability as merit
No
B3 fairness spine partly inferential
Explicitly blocked
Output QA
C17
F20
Appearance / look as Commercial evidence
No
Strong baseline/safety constraints
Explicitly blocked
Output QA
C17
F20
Response to direction from finished tape
No
Live-room evidence absent
Explicitly blocked
Output QA
C14
F22
Accessibility context as deficit
No
B3 access evidence
Explicitly blocked
Output QA
C16
F21
Practitioner/course language as universal
No
B1/B4 source-shaped
Source-shape caution
No immediate revision
C19
F24
10. Residual Risk Register
Final-audit issue ID
Residual issue
Why it remains open
Related change ID(s)
Related audit rec ID(s)
Fully mitigated in wording?
Blocks release to output-spec?
Return to COMMERCIAL-REV required?
Carry as limitation?
Note
COMMERCIAL-FINAL-I01
Shared acting field limits sub-dimensions
Architecture preserved
C01, C02
R01, R02
Partly
No
No
Yes
Wording mitigates
I02
No live Commercial outputs
None supplied
C03, C20, C21
R03, R20, R21
No
No
No
Yes
Live QA later
I03
Frontend label behaviour unknown
Display not supplied
C21
R21
No
No
No
Yes
Output-spec checklist
I04
Comparison-page behaviour unknown
Comparison not supplied
C21
R21
No
No
No
Yes
Output-spec checklist
I05
Renderer/export timestamp behaviour unknown
Renderer/export not supplied
C20, C21
R20, R21
Partly
No
No
Yes
Render parity test later
I06
UGC/social evidence thin
Source gap
C09
R09
Partly
No
No
Yes
Limitation explicit
I07
Presenter-led product evidence thin
Source gap
C09
R09
Partly
No
No
Yes
Limitation explicit
I08
Corporate/industrial evidence thin
Source gap
C09
R09
Partly
No
No
Yes
Limitation explicit
I09
Voiceover support conditional
B4 lower authority
C08
R08
Partly
No
No
Yes
Conditional only
I10
Marketability/appearance exclusion partly inferential
Not always verbatim Commercial clause
C17
R17
Partly
No
No
Yes
Strong safety basis
I11
Accent/speech/gender-diverse voice detail broad
Access evidence broad
C11, C16
R11, R16
Partly
No
No
Yes
Non-deficit mitigates
I12
Source-shape limits
B1/B4 source shape
C19
R19
Yes
No
No
Yes
Carry caution
11. Final Non-Regression Test Map
Audit test ID
Scenario
Relevant change ID(s)
Relevant section ID(s)
What revised baseline should force
What it should block
Final-audit status
Final release note
COMMERCIAL-AUDIT-T01
Direct-to-camera Commercial
C01, C02, C04, C06
S01, S02, S04, S06
Copy/addressee/camera evidence
Generic presence
Pass
Core output-spec test
T02
Off-camera-reader / scene-style
C06, C13
S06, S13
Reader-scene evidence
Direct-address default
Pass
Camera split
T03
No-dialogue / silent-vignette
C07
S07
Non-verbal story evidence
Imposed spoken-copy criteria
Pass with limitation
Conditional
T04
No-brief Commercial
C05
S05
Observable-only claims
Brand/product/audience invention
Pass
P0
T05
Supplied brand/product/copy
C04, C05
S04, S05
Brief/copy grounding
Unsupported expansion
Pass
P0
T06
Generic “natural/confident” output
C03
S03
Behavioural replacement
Generic praise alone
Pass
P0
T07
Strong copy, weak camera
C04, C06
S04, S06
Separate dimensions
Inflated overall presence claim
Pass
P1
T08
Strong camera, unclear copy
C04, C06
S04, S06
Separate evidence
Camera as full merit
Pass
P1
T09
Poor lighting/framing
C10, C20
S10, S20
Reliability caveat
Performance criticism
Pass with limitation
Live reliability QA
T10
Poor audio
C11
S11
Audibility boundary
Poor performance claim
Pass
P0
T11
Assessable smartphone/home capture
C12, C18
S12, S18
Simple capture accepted
Non-studio penalty
Pass
P0
T12
High polish, weak performance
C12, C18
S12, S18
Performance evidence decisive
Polish reward
Pass
P0
T13
Paid/pro reader vs basic reader
C13, C18
S13, S18
Reader as process
Paid reader merit
Pass
P0
T14
Reader absence / weakness
C13
S13
Assessability caveat
Performer penalty
Pass
P1
T15
Response to direction inferred
C14
S14
Not inferable unless shown
Direction claim
Pass
P0
T16
Callback readiness inferred
C14
S14
Present-tape scope
Callback readiness claim
Pass
P0
T17
Fast turnaround as talent
C13
S13
Process-only
Talent/professionalism scoring
Pass
P1
T18
File/slate admin as talent
C13
S13
Admin/brief caveat
Merit/deficit claim
Pass
P1
T19
Voiceover-style copy
C08, C04
S08, S04
Conditional copy evidence
All-Commercial voiceover logic
Pass with limitation
Conditional
T20
UGC/social overclaimed
C09
S09
Limitation language
Universal UGC criteria
Pass
P1
T21
Presenter-led product overclaimed
C09
S09
Limitation language
Universal presenter rules
Pass
P1
T22
Corporate/industrial overclaimed
C09
S09
Limitation language
Universal corporate rubric
Pass
P1
T23
No-brief brand/product/audience invention
C05
S05
No-brief restraint
Invented context
Pass
P0
T24
Marketability/bookability/look
C17
S17
Anti-bias exclusion
Look/marketability scoring
Pass
P0
T25
Access-adapted context
C16
S16
Non-deficit evidence
Access weakness
Pass with limitation
Access QA later
T26
Visual impairment / Deaf or disabled access
C16
S16
Process/support context
Deficit inference
Pass
P0
T27
Speech difference/accent/gender-diverse voice
C11, C16
S11, S16
Non-deficit caution
Speech/accent deficit
Pass with limitation
Detail broad
T28
Polish rewarded in presentation
C12, C18
S12, S18
Assessability/brief/safe process
Polish/resource reward
Pass
P0
T29
Comparison label mismatch
C21
S21
Watch item
Claim verified display
Accepted with limitation
Output-spec/live QA
T30
Timestamp underproduction/generic notes
C20
S20
Commercial evidence anchors
Generic/padded notes
Pass with limitation
Renderer/export QA
12. Final Release Decision
COMMERCIAL-FINAL-D01 — Approved with explicit limitations
The revised Commercial baseline is materially responsive to COMMERCIAL-AUDIT-R01–R21 and materially aligned with COMMERCIAL-SYN-F01–F24. It is approved at wording, evidence-standard and guardrail level.
There are no critical blockers requiring another COMMERCIAL-REV pass. The revised package:
clarifies Commercial acting as presence/naturalism through observable Commercial evidence;
prevents theatre-acting and generic screen-acting leakage;
grounds tone, copy, product and situation claims;
blocks no-brief brand/product/audience invention;
splits direct-to-camera and reader-scene Commercial handling;
adds conditional no-dialogue and voiceover-style handling;
carries weak subtypes as limitations;
separates assessability, audio and technical quality from performance;
protects simple capture and blocks production polish;
treats reader/admin/deadline burdens as process-only;
blocks live-room and callback overclaim;
strengthens accessibility, anti-deficit, anti-marketability and anti-appearance rules;
preserves all protected shared-system constraints.
COMMERCIAL-FINAL-D02 — Approved for Commercial Output Specificity / Non-Regression Test Mapping with explicit limitation set
COMMERCIAL-OUTPUT-SPEC can proceed. It must carry forward the following limitations:
no live Commercial outputs supplied;
frontend labels, comparison labels and renderer/export timestamp behaviour unverified;
UGC/social, presenter-led product and corporate/industrial evidence thin;
voiceover-style evidence conditional only;
marketability/appearance exclusion partly inferential but strongly supported by fairness guardrails;
accent, speech difference and gender-diverse voice detail broad;
six-field architecture constrains exact Commercial sub-dimensions.
Live Commercial output examples are still required before production release sign-off of revised Commercial behaviour.
13. Reusable Handoff Pack for COMMERCIAL-OUTPUT-SPEC
COMMERCIAL-FINAL-AUDIT is complete. The COMMERCIAL-REV package is approved with explicit limitations and is ready for Commercial Output Specificity / Non-Regression Test Mapping. The revision remains inside the live TapeCoach shared architecture and does not propose any score-field, weighting, cap, blocker, verdict-threshold, role-fit, schema, backend, pipeline, report-schema or UI implementation changes.
The strongest accepted changes are COMMERCIAL-REV-C01 to C06 and C10 to C18. These clarify Commercial distinctiveness, acting as Commercial presence/naturalism, copy/tone/product grounding, no-brief restraint, task-specific camera handling, assessability, audio reliability, anti-polish, process-only reader/admin/deadline boundaries, live-room claim limits, safety, accessibility, anti-marketability and professional_presentation. COMMERCIAL-REV-C03 and C20 also provide strong anti-generic and timestamp/next-take specificity rules.
Accepted with limitation: COMMERCIAL-REV-C07, C08, C09, C16, C20 and C21. The limitations are evidence or verification limits, not revision blockers. No-dialogue evidence is thinner than mainstream Commercial evidence. Voiceover-style evidence is conditional and comes mainly from B4. UGC/social, presenter-led and corporate/industrial subtypes remain under-evidenced. Accessibility detail for accent, speech difference and gender-diverse voice remains broad. Display labels, comparison behaviour and renderer/export timestamp behaviour were not auditable.
Final accepted section set: COMMERCIAL-REV-S01–S21, with limitations attached to S07, S08, S09, S16, S20 and S21.
The next stage should convert the revised package into Commercial output-specificity rules, adversarial scenarios, display-layer checks and non-regression tests. Highest-priority output-spec scenarios are direct-to-camera Commercial, reader-scene Commercial, no-brief Commercial, supplied brand/product/copy, generic “natural/confident” wording, poor lighting/framing, poor audio, simple home capture, high polish with weak performance, paid reader, response-to-direction overclaim, callback readiness overclaim, no-brief brand/product/audience invention, marketability/bookability/look language, access-adapted context, speech/accent/gender-diverse voice safety, production polish in professional_presentation, and timestamp underproduction.
Evidence basis: COMMERCIAL-SYN-F01–F24, COMMERCIAL-AUDIT-I01–I17, COMMERCIAL-AUDIT-R01–R21, COMMERCIAL-REV-C01–C21, COMMERCIAL-REV-S01–S21, COMMERCIAL-S001–S030, COMMERCIAL-B1-F01–F09, COMMERCIAL-B2-F01–F09, COMMERCIAL-B3-F01–F10 and COMMERCIAL-B4-F01–F06.
What was auditable: revised Commercial wording, audit recommendation response, synthesis compliance and baseline non-regression posture.
What was not auditable: exact production prompt text, frontend labels, comparison-page labels, renderer/export timestamp behaviour, live Commercial output quality and implementation-layer subtype detection.
14. Completion Statement
COMMERCIAL-FINAL-AUDIT complete. Ready for COMMERCIAL-OUTPUT-SPEC / Non-Regression Test Mapping.

---

## Links

- **Previous:** [[drr-commercial-09-output-spec]] — Output Spec
- **Next:** [[drr-commercial-11-implementation]] — Implementation
- **Thread overview:** [[drr-commercial-overview]]
- **Programme:** [[drr-programme-overview]]
