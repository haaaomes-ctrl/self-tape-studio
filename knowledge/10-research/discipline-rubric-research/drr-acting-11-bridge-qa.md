---
id: drr-acting-11-bridge-qa
title: Acting — Bridge QA
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/3. Acting/ACTING-BRIDGE-QA.md"
discipline: acting
monday_ref: null
tags: [discipline-rubric-research, acting, stage-qa]
confidence: medium
created: 2026-05-05
imported: 2026-06-08
updated: 2026-06-08
---

# Acting — Bridge QA

> **Imported research — Discipline Rubric Research programme.** Step 11 of 14 in the Acting thread (`stage-qa`). Original file: `3. Acting/ACTING-BRIDGE-QA.md`. Original date: 2026-05-05 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-acting-overview]].

---

1. Bridge QA Readiness Check
Check
Result
Caveat
ACTING-OUTPUT-SPEC handoff present
Yes
Supplied in prompt.
ACTING-FINAL-AUDIT handoff present
Yes
Supplied and supported by attached final-audit material. The final audit approved Acting with explicit limitations and required live-output/display QA.
ACTING-REV handoff or revised baseline summary present
Yes
Supplied and supported by attached ACTING-REV material.
Baseline / guardrail context present
Yes
0A/0C/0D and rubric-control materials supplied. They confirm the shared fields, MT flow and report sections.
MT acting+song live output present
Yes
Four printed report PDFs supplied.
Screenshots present
No separate screenshots
Printed report PDFs were supplied and rendered internally for review; no separate screenshot package was supplied.
PDF/export present
Yes
Four printed report PDFs. Exports are not yet a product feature.
JSON/report object present
No actual report JSON
Evidence-pass, report-polish and report-quality snippets were supplied, but these are pipeline/reference snippets, not live report JSON objects.
Comparison-page output present
No distinct comparison page
The reports show “All auditions” navigation, but no comparison table/page output was supplied.
Rule and test IDs preserved
Yes
ACTING-OS-R01–R19 and ACTING-OS-T01–T20 carried forward.
Bridge QA may proceed
Yes
As bridge QA only, not full Acting release sign-off.
Caveats
This bridge QA can assess MT acting+song component behaviour, generic phrase leakage, timestamp density, no-brief false specificity, presentation wording and some display-surface label issues. It cannot fully assess spoken-only Acting labels, monologue-only reports, acting_scene-only reports, Acting comparison-page labels or access-adapted Acting outputs. The final Acting audit explicitly left live Acting outputs, frontend labels, comparison labels and renderer/export timestamp parity unverified.
2. Bridge QA Input Register
Output ID
Output type
Audition type shown or inferred
Brief mode or baseline mode
Component(s) shown
Singing present?
Spoken acting present?
Relevant ACTING-OS rule(s)
Relevant ACTING-OS test(s)
Used in QA?
Limitation / note
MT-BRIDGE-01
Printed report PDF: Test Result 1
MT inferred; report shows acting + song
Brief-driven mode
Acting Scene 50%, Song 50%
Yes
Yes
R02, R06, R08, R11, R14, R15, R18
T03, T11, T13, T14, T17
Yes
Legacy “CONFIDENCE” display; no exported/report JSON.
MT-BRIDGE-02
Printed report PDF: Test Result 2
MT inferred; report shows acting + song
Contradictory: page says brief-driven; technical signals say no brief
Acting Scene 50%, Song 50%
Yes
Yes
R02, R06, R08, R09, R14, R15, R17, R18
T02, T08, T13, T17, T18
Yes
Critical no-brief/brief contradiction and invented time-limit risk.
MT-BRIDGE-03
Printed report PDF: Test Result 3
MT inferred; report shows acting + song
Brief-driven mode
Acting Scene 50%, Song 50%
Yes
Yes
R02, R06, R08, R11, R14, R15, R17
T03, T08, T11, T14, T17
Yes
Severe timestamp underproduction; generic acting and vocal praise.
MT-BRIDGE-04
Printed report PDF: test 4
MT inferred; report shows acting + song + slate
Brief-driven mode
Acting Scene 40%, Song 50%, Slate 10%
Yes
Yes
R02, R04, R06, R08, R11, R13, R14, R15
T03, T05, T11, T14, T17, T20
Yes
Better component split; still timestamp-underproduced and generically phrased.
PIPE-01
Evidence-pass.md
n/a
n/a
n/a
n/a
n/a
R15, R18
Timestamp-density controls
Yes
Defines target: 3–5 minute multi-component tapes should target 7–8 notes, minimum 5 if assessable.
PIPE-02
Report-Polish.md
n/a
n/a
n/a
n/a
n/a
R09, R11, R14, R18
Grounding / unsupported-claim controls
Yes
Step 2 must use locked evidence only, not invent timestamps, risks, presentation notes or role-fit claims.
PIPE-03
Report-Quality.md
n/a
n/a
n/a
n/a
n/a
R09, R15, R18
Display/text scrub checks
Yes
Shows deterministic scrubs for page/side references, timestamp ordering and presentation-note grounding.
3. Scope Classification: What This MT Report Can and Cannot Test
Test area
Directly testable from MT report?
Why
Related ACTING-OS rule/test ID(s)
What remains untested until true Acting output exists
Spoken-only Acting label containment
No
Singing is present in all supplied MT reports; Vocal should remain visible in genuine MT.
R01, T01
Acting-only speech-delivery label display.
MT acting+song category visibility
Yes
Reports visibly show Acting Scene and Song components, plus Vocal and Acting category scores.
R18
Comparison-page parity remains untested.
Acting component specificity
Yes
Acting sections are visible and can be checked for behavioural anchors.
R02, R14, T17
Acting_scene-only report behaviour.
Acting-through-song specificity
Yes
Song and acting-through-song comments appear in several reports.
R14, R15
Dedicated Acting-through-song field does not exist and remains implicit.
Monologue-only behaviour
No
No monologue-only report supplied.
R03, T02, T06, T07
Monologue report with and without brief.
Scene / reader behaviour
Partial
Reader references appear, but this is an MT scene, not a standalone acting_scene output.
R04, T03, T12
Acting-only scene/duologue report with basic/paid reader contrast.
No-brief role/world invention
Yes / partial
MT-BRIDGE-02 has a contradiction: brief-driven mode and risk text conflict with “No brief” technical signal.
R09, R17, T18
True acting no-brief report still required.
Generic acting praise
Yes
“Grounded”, “natural”, “connected”, “believable”, “strong vocal control” and similar phrases appear.
R14, T17
Acting-only generic suppression remains untested.
Speech audibility versus speech performance
Partial
Audio categories mention speaking voice and vocal balance; no poor-audio case supplied.
R07, T09
Poor speech audibility Acting output.
Production polish versus performance quality
Yes / partial
Some reports use “polished” and “professional” language in presentation.
R06, R11, T11
Weak-acting/high-polish adversarial test.
Timestamp count and distribution
Yes
All four reports show 2–4 notes, below the minimum 5 for an assessable 3–5 minute multi-component tape.
R15, T17
Persisted-vs-rendered parity still needs JSON/export comparison.
Comparison-label behaviour
No
No distinct comparison page supplied.
R18
Actual comparison page screenshots/exports.
Renderer/export timestamp behaviour
Partial
Printed PDFs show rendered note count, but no persisted JSON or separate export parity.
R18, R15
JSON vs rendered vs PDF/export timestamp parity.
Accessibility/adapted Acting behaviour
No
No access/adapted context supplied.
R10, T15, T16
Access-adapted Acting report.
4. MT Acting+Song Output-Level Spot Audit
Output ID
Overall bridge-QA status
What is specific and compliant
What is generic / unsupported
Acting component specificity
Song/vocal specificity
Acting-through-song status
Component separation
Category label status
Timestamp count/distribution
Next-take specificity
professional_presentation status
No-brief / role-world handling
Live-room-only overclaim
Related ACTING-OS issue(s)
Related ACTING-OS rule(s)
Related ACTING-REV change(s)
Required follow-up
MT-BRIDGE-01
Partial / fail for bridge QA
Shows Acting Scene and Song separately; Vocal and Acting categories visible; some timestamps cover scene and song.
“Strong callback potential”; “well-connected”, “believable”, “emotional connection”; “Side 1 (pg. 85–87)”; “polished”.
Partial: reader/eyeline named, but not enough behavioural evidence.
Partial: vocal quality, pitch/control named; lyric/storytelling still broad.
Partial: story/music named, but not phrase-level enough.
Pass
Pass for MT; Vocal correctly visible because singing exists.
Fail: 4 notes for ~4 minutes; target minimum is 5, ideal 7–8.
Partial: relevant but some generic rehearsal advice.
Partial/fail: “polished” wording risks production/presentation bias.
Pass if brief truly supplied; source references still too page/side-heavy.
Fail: callback potential inferred from finished tape.
OS-I03, OS-I04, OS-I05
R08, R11, R14, R15, R18
C05, C06, C11, C15
Remove live-room overclaim; strengthen behavioural anchors; enforce timestamp minimum.
MT-BRIDGE-02
Fail
Component split exists; some useful material-specific “quick swig” note; acting-through-song drill is useful.
Critical contradiction: report claims brief-driven and invented 240s limit, but technical signals say “No brief”; also says “perfect submission” while “Why this isn’t ready” flags rejection risk.
Partial: acting comment generic; one good beat note.
Partial: style/technique named, but generic.
Pass/partial: “Speak lyrics as monologue” is useful, but report also recommends alternative song.
Pass
Pass for MT
Fail: 3 notes for 246s multi-component tape.
Partial/pass: concrete acting-through-song plan, but alternative material advice is out of scope.
Fail: “whole package feels polished” and “perfect submission” conflict with no-brief signal.
Fail: invented brief/time limit.
Partial: “recall chances” from invented compliance risk.
OS-I04, OS-I05
R09, R14, R15, R17, R18
C06, C07, C11, C15
Critical retest after correcting brief/no-brief grounding and risk generation.
MT-BRIDGE-03
Partial / fail for bridge QA
Correct acting+song split; Vocal and Acting categories visible; technical framing issue tied to brief.
“Recall-worthy”, “connected”, “believable”, “grounded and natural”; acting-through-song praise lacks evidence.
Partial: scene “wit” and timing are named, but generic naturalism remains.
Partial: dynamics/control/belt named, but phrase evidence sparse.
Partial: named, but broad.
Pass
Pass for MT
Fail: 2 notes for 3–5 minute multi-component tape.
Partial: component-aware, but some generic “pure emotion” language.
Partial: “comfortable and disciplined on camera” is a process/personality-adjacent claim.
Pass if brief supplied.
Fail/partial: recall-worthiness inferred.
OS-I04, OS-I05
R08, R11, R14, R15
C05, C06, C11, C15
Retest timestamp production and generic-language suppression.
MT-BRIDGE-04
Partial
Best component split: Acting Scene, Song and Slate shown; acting note includes a concrete 0:15 transition; Vocal and Acting visible; brief mode consistent.
Headline says “strong vocal control and grounded acting”; strengths include “Natural, grounded acting”; “workshops” castability language is live-room-adjacent.
Partial/pass: 0:15 transition and off-camera relationship are better anchored than other reports.
Partial: vocal range and phrasing named, but still not lyric/phrase-specific enough.
Partial: eyes/internal monologue note in song is useful; still light.
Pass
Pass for MT
Fail: 3 notes for 246s multi-component tape.
Pass/partial: specific to wit, resonance and transition.
Partial: “Very professional” and eyeline/pacing are acceptable if tied to assessability, but still broad.
Pass if full brief truly supplied.
Partial/fail: “workshops” castability language overreaches.
OS-I04, OS-I05
R02, R04, R11, R14, R15
C06, C08, C11, C15
Keep this as best candidate for retest after timestamp/generic fixes.
5. Acting-Adjacent ACTING-OS Rule Compliance Matrix
Rule ID
Rule title
Applicability to this MT report
Live output evidence checked
Status
Evidence from supplied output
Failure or risk
Related output ID(s)
Related ACTING-REV change(s)
Related ACTING-SYN finding(s)
Severity if unresolved
Required follow-up
ACTING-OS-R01
Spoken-only speech label containment
Proxy-testable only
MT Vocal category should remain visible because singing is present.
Partial / not fully auditable
Vocal is visible in MT reports.
Does not test spoken-only Acting display.
All
C02, C09
F06
High for Acting-only
True Acting output required.
ACTING-OS-R02
Acting-form identification and cautious fallback
Directly testable
Acting Scene and Song components.
Pass / partial
Components shown in all four reports.
Some component notes remain generic.
All
C01
F01
Medium
Strengthen component-note evidence anchors.
ACTING-OS-R03
Monologue and text-structure anchoring
Not testable
No monologue-only output.
Not auditable
n/a
Monologue output still unverified.
n/a
C01
F01, F03
Medium
Supply monologue report.
ACTING-OS-R04
Scene / duologue reader mediation rule
Proxy-testable
Off-camera reader references.
Partial
Reports mention off-screen/off-camera reader.
No paid/basic reader contrast; reader quality not fully testable.
MT-BRIDGE-01, 04
C08
F08
Medium
True acting scene with reader needed.
ACTING-OS-R05
Screen task-to-camera rule
Proxy-testable
Eyeline / self-tape framing references.
Partial
Test 4 notes eyelines “well-placed just off-camera”.
Not a direct-to-camera/off-camera Acting-only task.
MT-BRIDGE-04
C03
F04
Medium
Direct-to-camera and off-camera Acting outputs needed.
ACTING-OS-R06
Assessability before polish
Directly testable
Technical/presentation notes.
Partial / fail
Reports use “polished”, “professional”, “model submission” language.
Presentation/polish still risks merit proxy.
01, 02, 03
C04, C11
F05, F09
High
Tighten output guidance/scrub for “polish” language.
ACTING-OS-R07
Speech audibility versus speech performance
Proxy-testable
Audio notes include speaking voice/vocal balance.
Partial / pass
Test 4 separates accompaniment and speaking voice audibility.
No poor-audio case supplied.
04
C09
F06
Medium
Poor speech-audibility retest required.
ACTING-OS-R08
Tape-observable only / live-room boundary
Directly testable
Recall/callback/workshop language.
Fail
“Strong callback potential”, “recall-worthy”, and workshop castability appear.
Finished tape is used to infer live-room outcome.
01, 03, 04
C05, C14
F02, F16
High
Block recall/callback/workshop potential from finished-tape outputs unless explicitly brief-supported.
ACTING-OS-R09
No-brief grounding rule
Directly testable in one report
Brief/no-brief conflict.
Fail
Test Result 2 claims brief-driven and a 240s cap, but technical signals say no brief.
Critical false-specificity and trust risk.
02
C07
F07, F15
Critical
Retest no-brief MT baseline.
ACTING-OS-R10
Accessibility-safe non-deficit language
Not directly testable
No adapted/access context.
Not auditable, general pass only
No obvious access-deficit language in supplied reports.
Access scenarios untested.
All
C10
F10-F12
High for access release
Supply adapted/access-sensitive output.
ACTING-OS-R11
Professional presentation / process boundary
Directly testable
Presentation and professional notes.
Partial / fail
“Polished”, “professional marker”, “comfortable and disciplined on camera” appear.
Professionalism can drift into polish/personality.
01, 02, 03
C11
F05, F09
High
Constrain presentation wording to assessability/brief/safe process.
ACTING-OS-R12
Methodology-neutral and framework-safe language
Directly testable
Method terminology.
Pass
No named methodology or external-framework score import appears.
None found.
All
C12, C16
F03, F17
Low
Preserve.
ACTING-OS-R13
Conditional comedy / physical / fight language
Proxy-testable
Comedy/wit references.
Partial
Reports mention comic timing, comedy and wit.
Comedy is not universalised, but some claims remain broad.
03, 04
C13
F13, F17
Medium
Keep comedy tied to timing/rhythm/brief text.
ACTING-OS-R14
Behavioural evidence in every substantive section
Directly testable
Headline, category notes, strengths, improvements.
Fail / partial
Generic “grounded”, “natural”, “connected”, “believable”, “emotionally connected” recur.
Generic praise not always anchored.
All
C06
F14
High
Add output-level suppression/rewrite retest.
ACTING-OS-R15
Timestamp density and specificity
Directly testable
Timestamped notes.
Fail
Reports show 2–4 notes; evidence target is 7–8, minimum 5 for assessable 3–5 minute multi-component tapes.
Underproduction across all supplied outputs.
All
C15
F14, F05
High
Retest timestamp persistence/rendering after prompt/evidence changes.
ACTING-OS-R16
Reliability fallback under limited assessability
Partially testable
Framing issue in Test Result 3; technical signals.
Partial
Framing issue is correctly identified as a brief/technical fix.
No poor-visibility or poor-audio reliability fallback case.
03
C04, C15
F05
Medium
Supply poor assessability output.
ACTING-OS-R17
Brief / role-fit boundary
Directly testable
Brief fit and role language.
Fail / partial
Test Result 2 conflicts with no-brief signal; other reports use role/brief claims that may be supported by brief.
False brief compliance in no-brief output.
02
C07
F15
Critical
No-brief retest required.
ACTING-OS-R18
Display-layer consistency check
Directly testable only at report/PDF surface
Labels, confidence/reliability, timestamps.
Partial / fail
Test Result 1 uses legacy “CONFIDENCE 95” display, while later reports use Feedback reliability.
Comparison page and report JSON not supplied; timestamp parity unverified.
01, all
C02, C15
F06, F14
High
UI/report/comparison/export QA needed.
ACTING-OS-R19
Exclusion and anti-bias language block
Directly testable for visible text
Exclusion language.
Partial / pass
No body/appearance/follower/marketability/access-deficit language found.
“Polish” and live-room potential still create adjacent bias/overclaim risk.
All
C10, C11
F10-F12, F15
Medium
Continue anti-bias retests with adapted contexts.
6. ACTING-OS Test Bridge Mapping
Output-specificity test ID
Preserved audit test ID
Scenario
Directly represented?
Tested status
Evidence from supplied output
Correct behaviour
Incorrect / missing behaviour
Evidence anchor present?
Unsafe/generic wording?
Display/rendering issue?
Priority
Required follow-up
ACTING-OS-T01
ACTING-AUDIT-T01
Spoken-only no-singing label containment
No
Not tested
Singing is present in all MT reports.
MT Vocal remains visible.
Acting-only speech label not tested.
n/a
n/a
Yes: acting-only label remains unknown.
P0
True spoken-only Acting output required.
ACTING-OS-T02
T02
Monologue with no brief
No
Not tested
No monologue output supplied.
n/a
Monologue no-brief still untested.
n/a
n/a
No
P0
Supply no-brief monologue.
ACTING-OS-T03
T03
Reader-mediated scene fairness
Partial
Partial
Reader/relationship appears in acting notes.
Performer response is named.
No paid/basic reader contrast; some generic “relationship” wording.
Partial
Yes
No
P0
Supply acting_scene with reader.
ACTING-OS-T04
T04
Direct-to-camera task specificity
No
Not tested
No direct-to-camera acting task.
n/a
Not represented.
n/a
n/a
No
P0
Supply screen direct-to-camera task.
ACTING-OS-T05
T05
Off-camera-reader task specificity
Partial
Partial
Off-camera reader/eyeline references appear.
Off-camera eyeline is not penalised.
Not enough task-specific screen context.
Partial
Some
No
P0
Supply off-camera-reader screen self-tape.
ACTING-OS-T06
T06
Classical / heightened text specificity
No
Not tested
No classical/heightened text report.
n/a
Not represented.
n/a
n/a
No
P1
Supply heightened-text monologue.
ACTING-OS-T07
T07
Contemporary text specificity
Partial
Partial
MT scene appears contemporary; text specificity around “wit” appears.
Some dialogue rhythm/wit evidence.
Still broad “naturalistic” and “grounded” claims.
Partial
Yes
No
P1
True contemporary monologue/scene test.
ACTING-OS-T08
T08
Poor lighting/framing reliability fallback
Partial
Partial
Test Result 3 flags framing wider than brief.
Framing noted as technical/brief issue.
No poor/unreadable visibility case.
Yes
No
No
P0
Test poor lighting/framing.
ACTING-OS-T09
T09
Poor speech audibility boundary
No
Not tested
All reports indicate clear audio.
n/a
Poor audibility not represented.
n/a
n/a
No
P0
Supply poor-audio Acting/MT output.
ACTING-OS-T10
T10
Simple home capture acceptability
Partial
Partial
Neutral background / readable setup accepted.
Simple setup not penalised.
No explicit low-resource home setup case.
Partial
No
No
P0
Supply simple-home assessable case.
ACTING-OS-T11
T11
Anti-polish boundary
Partial
Partial / fail
“Polished” and “professional” wording appears.
Production polish not always directly scored.
Wording risks equating polish with merit.
Partial
Yes
No
P0
Retest presentation wording.
ACTING-OS-T12
T12
Paid/basic reader neutrality
No / partial
Not tested
Reader mentioned, but no paid/basic contrast.
No obvious paid-reader reward.
Scenario not represented.
Partial
No
No
P1
Supply paid/basic reader contrast or scenario.
ACTING-OS-T13
T13
Response-to-direction overclaim block
Partial
Partial
No direct “takes direction” claim, but recall/callback potential appears.
No explicit redirection claim.
Live-room outcome overclaim still present.
No
Yes
No
P0
Block live-room/potential wording.
ACTING-OS-T14
T14
Training-potential overclaim block
Partial
Fail / partial
“Strong callback potential” and “recall-worthy” appear.
n/a
Admissions/live-room-style potential inferred from finished tape.
No
Yes
No
P1
Retest with overclaim suppression.
ACTING-OS-T15
T15
Access-adapted / visual-impairment-safe output
No
Not tested
No access context.
n/a
Access output untested.
n/a
n/a
No
P0
Supply adapted/access-sensitive output.
ACTING-OS-T16
T16
Speech-difference non-deficit handling
No
Not tested
No speech-difference context.
n/a
Untested.
n/a
n/a
No
P0
Supply speech-difference scenario/output.
ACTING-OS-T17
T17
Generic praise suppression
Yes
Fail
Generic phrases recur across outputs.
Some timestamped anchors exist.
Many headline/category/strength phrases remain generic.
Partial
Yes
No
P0
Retest generic suppression.
ACTING-OS-T18
T18
No-brief role/world invention block
Yes
Fail
Test Result 2 says no brief in technical signals but invents brief and 240s cap elsewhere.
n/a
Critical false specificity.
No
Yes
Yes
P0
No-brief retest required.
ACTING-OS-T19
T19
Conditional physical/fight handling
No
Not tested
No physical/fight task.
n/a
Not represented.
n/a
n/a
No
P1
Supply task-present physical/fight case if needed.
ACTING-OS-T20
T20
Conditional comedy handling
Partial
Partial
Comedy/wit references appear.
Wit/comic timing tied partly to brief/line.
No dedicated comedy output; some over-broad comedy phrasing.
Partial
Some
No
P1
Retest comedy-specific output later.
7. MT-Specific Non-Regression Check
MT non-regression area
Status
Evidence observed
Risk if unresolved
Related baseline guardrail
Related ACTING-OS / ACTING-REV ID(s)
Follow-up required
audition_type = musical_theatre shown or inferred correctly
Partial
Reports show MT acting+song components, but do not visibly show audition_type = musical_theatre.
Misclassification could persist invisibly.
MT anchor; component detection
R18
Confirm from report object/logs.
Acting + Song components detected and displayed
Pass
All reports show Acting Scene and Song component breakdown; test 4 also includes Slate.
MT anchor breaks if absent.
MT stabilised flow
R02, R18
Preserve.
Acting score visible where spoken acting exists
Pass
Acting category visible in supplied reports.
Acting hidden in MT.
MT regression guardrail
R18
Preserve.
Vocal score visible where singing exists
Pass
Vocal category visible in supplied reports.
Vocal hidden wrongly in genuine MT.
MT regression guardrail
R01, R18
Preserve.
Component breakdown visible
Pass
Component breakdown displayed in all reports.
Component silo/loss risk.
MT anchor
R18
Preserve.
Component notes specific to acting and song
Partial
Some notes are component-specific; many remain generic (“technically excellent”, “connected”).
Component breakdown becomes cosmetic.
0D specificity guardrail
R14
Strengthen evidence anchors.
Timestamps cover both acting and song
Partial / fail
Outputs cover both components in some cases, but only 2–4 notes, below minimum.
Evidence credibility weakens.
Timestamp target
R15
Retest timestamp count/distribution.
No Acting-only speech label rule wrongly hides MT Vocal
Pass
Vocal remains visible where singing exists.
MT song evaluation could disappear.
MT regression guardrail
R01
Preserve.
No song-only section receives scene/reader feedback unless spoken acting exists
Pass / not fully testable
Spoken acting exists in supplied MT reports.
Song-only leakage still untested.
Discipline separation
R02
Test song-only separately.
No MT report becomes acting-only in baseline/no-brief mode
Fail / partial
Test Result 2 preserves acting+song, but has no-brief/brief contradiction.
Baseline trust issue.
No-brief MT baseline guardrail
R09, R17
Retest no-brief MT.
consistency_modifier preserved if visible
Pass
Cross-component consistency appears in reports.
MT integration loss.
MT anchor
n/a
Preserve.
Comparison-page score/label parity
Not auditable
No comparison page supplied.
UI mismatch may remain.
Comparison alignment
R18
Supply comparison page.
8. Generic-Feedback Failure Audit
Output ID
Section
Generic phrase found
Why it fails or nearly fails
Observable evidence attached?
Safer evidence-led replacement direction
Related ACTING-OS-R
Related ACTING-REV-C
Severity
MT-BRIDGE-01
Headline/insight
“strong callback potential”
Finished tape cannot safely prove live-room outcome.
No
Tie to current tape strength only; avoid callback/recall prediction.
R08, R14
C05, C14
High
MT-BRIDGE-01
Acting category
“well-connected”, “believable relationship”
Needs cue/timing/reader behaviour evidence.
Partial
Anchor to a timestamped reader response or eyeline shift.
R14
C06
Medium
MT-BRIDGE-01
Song/component
“emotionally connected”
Needs lyric/phrase/beat evidence.
Partial
Tie to phrase, lyric, vocal dynamic or acting-through-song moment.
R14
C06
Medium
MT-BRIDGE-02
Headline
“technically strong and emotionally connected”
Previously identified as transferable MT praise.
No
Name the component/moment that makes the tape strong.
R14
C06
High
MT-BRIDGE-02
Acting category
“strong connection”, “believable and engaging”
Generic acting praise without enough behaviour.
Partial
Anchor to the 0:45 listening or 1:24 “quick swig” beat.
R14
C06
High
MT-BRIDGE-02
Professional presentation
“whole package feels polished”
Polish can become a resource/professionalism proxy.
No
Use assessability/transition clarity only.
R11
C11
Medium
MT-BRIDGE-03
Component note
“great naturalism and comic timing”
Naturalism/comedy need specific rhythm or reaction evidence.
Partial
Tie to the line at 0:45 or a named text beat.
R13, R14
C06, C13
Medium
MT-BRIDGE-03
Acting category
“very connected and believable”
Generic unless tied to relation/response.
No
Specify the scene behaviour or song vulnerability moment.
R14
C06
High
MT-BRIDGE-03
Strengths
“grounded and natural”
Explicit generic Acting risk.
Partial
Replace with the specific comic rhythm or vulnerability beat.
R14
C06
High
MT-BRIDGE-04
Headline/insight
“strong vocal control and grounded acting”
Generic MT/Acting praise.
No
Name the 0:15 transition or 02:30 vocal bloom.
R14
C06
High
MT-BRIDGE-04
Strengths
“Natural, grounded acting”
Generic phrase without sufficient behavioural replacement.
Partial
Tie to “signature move” reaction or off-camera reader relation.
R14
C06
High
MT-BRIDGE-04
Professional presentation
“Very professional”
Too broad unless assessability/process is the evidence.
Partial
Use “transition is efficient” and “eyeline consistent” only.
R11, R14
C11
Medium
9. Acting-Through-Song and Component-Integration Audit
Output ID
Acting-through-song evidence present?
Lyric / phrase / beat evidence present?
Acting component linked to song component?
Song feedback limited to vocal technique?
Scene-to-song transition discussed?
Role/material specificity present?
Generic MT praise present?
Required follow-up
Related baseline / ACTING-OS / ACTING-REV ID(s)
MT-BRIDGE-01
Partial
Partial
Yes
Partial
Yes
Yes
Yes
Add specific lyric/phrase/transition anchor; avoid callback overclaim.
R14, R15; C06, C15
MT-BRIDGE-02
Yes / partial
Partial
Yes
No / partial
Yes
Yes, but no-brief conflict undermines trust
Yes
Fix no-brief contradiction; keep the “speak lyrics as monologue” style drill but tie to evidence.
R09, R14, R17; C07, C15
MT-BRIDGE-03
Partial
Partial
Yes
Partial
Yes
Yes
Yes
Replace “acting-through-song is a real highlight” with lyric/phrase evidence.
R14, R15; C06, C15
MT-BRIDGE-04
Partial / pass
Partial
Yes
Partial
Yes
Yes
Yes
Best current example; still needs more timestamps and lyric/phrase specificity.
R14, R15; C06, C15
10. False-Specificity and No-Brief Audit
Output ID
Claim made
Supported by brief, text, slate, known material or observable evidence?
Risk type
Required safer handling
Related ACTING-OS-R
Related ACTING-REV-C
Severity
MT-BRIDGE-01
“Strong callback potential”
Unclear / no direct live-room evidence
Live-room outcome overclaim
Replace with present-tape readiness only.
R08
C05, C14
High
MT-BRIDGE-01
“Side 1 (pg. 85–87)”
Unclear; page metadata may be in brief but user-facing output should prefer moments/timestamps
Page/source-reference over-specificity
Use “acting scene” or timestamped moment. Report-polish guidance prefers timestamps over page/line/side references.
R09, R18
C07
Medium
MT-BRIDGE-02
“Tape runs 246s; brief asks for under 240s”
No; technical signals say “No brief”
Invented time limit / inferred brief compliance
Remove risk unless explicit brief provides cap.
R09, R17
C07
Critical
MT-BRIDGE-02
“Perfect submission against the brief”
No / contradicted by no-brief signal
Inferred brief compliance
Use professional standards wording only in baseline mode.
R09, R17
C07
Critical
MT-BRIDGE-02
“Having a less-used alternative in your book”
Unclear / outside submitted-material improvement
Alternative material overreach
Only suggest repertoire alternatives where the task is choice-material/repertoire advice.
R09
C07
Medium
MT-BRIDGE-03
“Recall-worthy”
Unclear; no live-room evidence
Training/live-room outcome overclaim
Use current submission strength only.
R08
C05, C14
High
MT-BRIDGE-03
“Perfect song choice”
Unclear unless brief explicitly confirms suitability
Unsupported material claim
Tie to brief style and observable performance evidence.
R09, R17
C07
Medium
MT-BRIDGE-04
“Highly castable for contemporary musical theatre workshops”
Unclear; “workshops” is live/process context
Live-room/process overclaim
Use present-tape readiness and brief-alignment language only.
R08, R17
C05, C14
High
MT-BRIDGE-04
“Side 1”
Probably brief-supported, but less user-friendly and weaker than timestamp
Side/source-reference over-specificity
Prefer “acting scene” or timestamped beat.
R09, R18
C07
Low-medium
11. Display-Layer and Rendering Verification Results
Display check area
Live evidence supplied?
Status
Evidence observed
Risk if unresolved
Related ACTING-OS rule/test ID(s)
Related ACTING-REV change(s)
Follow-up required
MT category label suitability
Yes
Pass
Vocal and Acting visible where both singing and spoken acting are present.
MT vocal hidden or Acting hidden.
R01, R18
C02
Preserve.
Acting category visible where spoken acting exists
Yes
Pass
Acting category appears.
MT acting component loss.
R18
C01
Preserve.
Vocal category visible where singing exists
Yes
Pass
Vocal appears in MT reports.
MT song evaluation loss.
R01, R18
C02
Preserve.
No Acting-only speech label rule misapplied to MT singing
Yes
Pass
Vocal remains visible in MT.
Overcorrecting Acting label rule could break MT.
R01
C02
Preserve.
Category breakdown wording
Yes
Partial / fail
Some category notes are generic or too polish-oriented.
Reports remain transferable.
R14
C06
Retest category note specificity.
Component breakdown display
Yes
Pass
Acting Scene + Song displayed; one report also shows Slate.
MT component loss.
R18
C01
Preserve.
Timestamp count rendered versus expected density
Yes
Fail
2–4 notes rendered; target minimum is 5 for assessable 3–5 minute multi-component tapes.
Under-evidenced reports.
R15, T17
C15
Retest with report JSON and rendered output.
Timestamp order
Yes
Pass
Visible notes are chronological in supplied PDFs.
Trust issue if misordered.
R15
C15
Preserve.
Timestamp specificity
Yes
Partial
Some notes are specific; several still generic.
Timestamp section may not prove tape-watching.
R15
C15
Strengthen observations/why-it-matters.
Timestamp distribution across acting and song
Yes
Partial / fail
Some scene and song coverage exists, but counts too low.
Component imbalance.
R15
C15
Increase count and coverage.
Next-take plan specificity
Yes
Partial
Some plans are strong; some are generic or need “rehearsal-only” clarity.
Generic coaching or frame-incompatible advice.
R14, R15
C06, C15
Retest.
Reliability fallback when assessability is limited
Partial
Partial
Framing issue noted in Test Result 3.
Technical issues may be over/under-weighted.
R06, R16
C04
Supply poor-audio/visibility output.
No generic filler in headline/category/strengths/fix-first
Yes
Fail
Generic phrases recur in all reports.
Copy-paste feel and weak evidence.
R14
C06
Retest suppression.
No production-polish reward in professional_presentation
Yes
Partial / fail
“Polished”, “professional”, “model submission” wording appears.
Resource/polish bias.
R11
C11
Constrain presentation wording.
Comparison-page label consistency
No
Not auditable
No comparison page supplied.
Cross-surface mismatch unknown.
R18
C02
Supply comparison output.
PDF/export parity
Partial
Not fully auditable
Printed PDFs supplied; no product export feature / no JSON parity.
Persisted-vs-rendered count unknown.
R18, R15
C15
Supply report object + rendered output.
12. Accessibility and Anti-Bias Audit
No adapted/access-sensitive context was supplied in this MT acting+song output, so access-specific live-output QA remains pending beyond general anti-bias language checks.
General visible-language check: no supplied report visibly uses disability, mobility, neurodivergence, body, age, class, follower count, fame, or protected-characteristic language as performance evidence. The remaining adjacent risks are production-polish/professionalism language and live-room outcome overclaim, not direct access-deficit language.
13. Preservation and Non-Regression Check
Check
Result
Note
No score-field changes appear in supplied outputs
Pass
Reports use current category structure.
No weighting changes implied by supplied outputs
Partial
MT component weights vary by component split, which is expected, but no structural score-field change appears. Baseline confirms MT uses acting/vocal balanced scoring inside the shared fields.
No cap / blocker / verdict changes implied
Partial
Test Result 2’s false time-limit risk implies a blocker/risk issue from unsupported brief data.
No schema changes implied
Pass
No schema change visible.
No Step 1 / Step 2 rewrite implied
Pass
Attached pipeline preserves Step 1 evidence and Step 2 polish.
No server-side recomputation change implied
Pass
No evidence of score-recompute change from outputs.
No role-fit bound change implied
Pass
No visible modifier issue in supplied PDFs.
No Musical Theatre regression introduced
Partial
MT components are preserved, but timestamp underproduction and false no-brief compliance are regressions against output quality.
No genuine MT acting/vocal category hiding implied
Pass
Acting and Vocal visible.
No Acting-only speech rule misapplied to hide sung vocal evidence
Pass
Vocal remains present where singing exists.
No generic shared praise reintroduced as default
Fail
Generic language is still frequent.
No accessibility-safe physicality/speech protections weakened
Not fully auditable
No access-sensitive output.
No external framework, mark, methodology or school preference imported as weighting
Pass
No external marks/grades/methods as weights appear.
14. Bridge QA Issue Register
Bridge QA issue ID
Issue title
Affected output ID(s)
Problem summary
Related ACTING-OS rule/test ID(s)
Related ACTING-REV change(s)
Related MT / baseline guardrail
Severity
Blocks MT regression confidence?
Blocks Acting release sign-off?
Requires Acting wording revision?
Requires MT wording revision?
Requires implementation/display investigation?
Can be fixed by prompt/report guidance only?
Note
MT-ACTING-BRIDGE-I01
Timestamp underproduction
All
All reports render 2–4 timestamp notes for ~4-minute multi-component tapes; evidence-pass target is 7–8, minimum 5.
R15, T17
C15
Timestamp target / MT cross-component coverage
High
Yes
No, but prevents Acting sign-off until true outputs pass
No
Unclear
Yes
Unclear
Need report object to locate whether issue is Step 1, Step 2, validation, persistence or rendering.
MT-ACTING-BRIDGE-I02
No-brief / brief contradiction and false time-limit risk
MT-BRIDGE-02
Report says brief-driven and invents 240s cap, while technical signals say “No brief”.
R09, R17, T18
C07
No-brief grounding / false specificity
Critical
Yes
Yes for no-brief release behaviour
No
Possibly
Yes
Unclear
This is the clearest blocker before broader regression execution.
MT-ACTING-BRIDGE-I03
Generic praise leakage
All
“Grounded”, “natural”, “connected”, “believable”, “emotionally connected”, “technically excellent” and similar phrases recur without sufficient behavioural anchors.
R14, T17
C06
Output specificity / generic-feedback suppression
High
Yes
Yes until true Acting outputs pass
No
Possibly
No
Yes
Strongest wording-quality issue across reports.
MT-ACTING-BRIDGE-I04
Live-room outcome overclaim
MT-BRIDGE-01, 03, 04
“Callback potential”, “recall-worthy” and “workshop” castability appear from finished-tape evidence.
R08, T13, T14
C05, C14
Live-room/process-only boundary
High
Yes
Yes for Acting output scope
No
Possibly
No
Yes
Needs suppression unless brief explicitly supports it.
MT-ACTING-BRIDGE-I05
Professional/presentation wording drifts into polish
MT-BRIDGE-01, 02, 03
“Polished”, “model submission”, “professional marker” and “comfortable/disciplined on camera” risk resource/personality proxy.
R06, R11, T11
C04, C11
Presentation/polish boundary
Medium-high
Partial
Partial
No
Possibly
No
Yes
Reframe to assessability, brief compliance and safe process only.
MT-ACTING-BRIDGE-I06
Source/page/side reference leakage
MT-BRIDGE-01, 03, 04
“Side 1 (pg. 85–87)”, “correct sides” and “Side 1” persist in user-facing output; polish/quality snippets prefer timestamp/moment phrasing and rewrite side jargon.
R09, R18
C07
False-specificity / source-reference scrub
Medium
No
No
No
Possibly
Yes
Yes/unclear
Not as severe as false time limit, but still a report-polish issue.
MT-ACTING-BRIDGE-I07
Legacy reliability display
MT-BRIDGE-01
Shows “CONFIDENCE 95 · Highly reliable” rather than the later “Feedback reliability: High” pattern.
R18
C15
Display consistency / no raw confidence score
Medium
Partial
No
No
No
Yes
No
Display-layer parity check needed.
MT-ACTING-BRIDGE-I08
Acting-through-song remains too implicit
MT-BRIDGE-01, 03, 04
Acting-through-song appears, but often lacks lyric/phrase/beat specificity; this was an existing MT risk.
R14, R15
C06, C15
MT acting-through-song specificity
Medium
Partial
No
No
Possibly
No
Yes
Add phrase/lyric/transition anchors in retest.
15. Bridge QA Decision
MT acting+song output reveals output behaviour requiring correction before broader regression execution.
Rationale
The supplied MT reports preserve the most important structural MT anchor: acting and song are detected and displayed, Acting and Vocal categories remain visible where both spoken acting and singing are present, and cross-component consistency appears. That is a meaningful pass for the protected MT acting+song flow.
However, the output behaviour is not yet safe for broader regression execution or product-level sign-off. The blocking issue is MT-BRIDGE-02: it combines brief-driven report framing and an invented 240-second rejection risk with a technical signal saying “No brief — we’ll apply the professional baseline rubric.” That is a critical false-specificity/no-brief failure. Across all four reports, timestamp density also fails the evidence-pass target for 3–5 minute multi-component tapes: the attached evidence-pass standard calls for 7–8 notes, minimum 5, while the printed reports show only 2–4 notes. Generic praise remains common, and several reports infer recall/callback/workshop potential from a finished tape, which conflicts with the Acting live-room boundary carried through final audit.
Critical blockers
MT-ACTING-BRIDGE-I02: false brief/time-limit contradiction.
MT-ACTING-BRIDGE-I01: timestamp underproduction across all reports.
MT-ACTING-BRIDGE-I03 / I04: generic praise and live-room outcome overclaim.
Can move forward immediately
Preserve MT Acting + Vocal category visibility.
Preserve component breakdown and cross-component consistency.
Use MT-BRIDGE-04 as the best current candidate for retest after timestamp and generic-language corrections.
Still required before Acting release sign-off
True spoken-only acting_scene report.
True monologue report.
No-brief Acting report.
Direct-to-camera screen/self-tape Acting report.
Off-camera-reader Acting report.
Poor-audio / poor-visibility Acting report.
Access-adapted or speech-difference Acting report.
Comparison-page and rendered/export parity examples.
16. Reusable Handoff Pack for Next QA Stage
MT-ACTING-BRIDGE-QA is complete as a bridge QA, not as full Acting live-output sign-off. Four printed MT acting+song reports and three pipeline/reference snippets were reviewed. The strongest positive result is that the protected MT structure still appears: reports show Acting Scene and Song components, visible Acting and Vocal category scores where spoken acting and singing are both present, component breakdown, and cross-component consistency. This preserves the core MT acting+song anchor and confirms that the Acting-only speech-label rule has not been wrongly applied to hide Vocal in genuine MT reports.
The strongest failures are output-specificity failures rather than baseline-design failures. All four reports underproduce timestamped evidence for a 3–5 minute multi-component tape: the evidence-pass target is 7–8 notes, minimum 5, but the supplied reports render only 2–4. A critical false-specificity issue appears in Test Result 2: the report claims brief-driven mode, a 246s/240s risk and perfect brief compliance, while technical signals say no brief and professional baseline mode. Generic praise also persists across reports: “grounded”, “natural”, “connected”, “believable”, “emotionally connected”, “technically excellent”, “strong vocal control” and similar phrases often appear without enough behavioural evidence. Several outputs infer live-room outcomes such as callback, recall or workshop potential from finished tape evidence, which remains unsafe under ACTING-OS-R08 and ACTING-REV-C05/C14.
ACTING-OS rule applicability summary: R02, R06, R08, R09, R11, R14, R15, R17 and R18 were directly or partially testable. R01 was only proxy-testable because singing is present. R03, R10, and several Acting-only screen/monologue tests remain untested until true Acting outputs exist.
Bridge issue register: MT-ACTING-BRIDGE-I01 timestamp underproduction; I02 false brief/time-limit contradiction; I03 generic praise leakage; I04 live-room outcome overclaim; I05 polish/professional-presentation drift; I06 side/page reference leakage; I07 legacy confidence display; I08 acting-through-song remains too implicit.
Required retests: no-brief MT acting+song, rendered timestamp count with report object, comparison-page parity, true spoken-only acting_scene, monologue, screen direct-to-camera, off-camera-reader scene, poor-audio/poor-framing and access-adapted Acting outputs.
Evidence basis: ACTING-SYN-F01–F17, ACTING-AUDIT-I01–I15, ACTING-AUDIT-R01–R16, ACTING-REV-C01–C16, ACTING-REV-S01–S15, ACTING-FINAL-D01/D02, ACTING-OS-R01–R19 and ACTING-OS-T01–T20, with the supplied MT PDFs and pipeline snippets.
17. Completion Statement
MT-ACTING-BRIDGE-QA complete. Output behaviour requires correction before broader regression execution.

---

## Links

- **Previous:** [[drr-acting-10-output-spec]] — Output Spec
- **Next:** [[drr-acting-12-lessons]] — Lessons Learned
- **Thread overview:** [[drr-acting-overview]]
- **Programme:** [[drr-programme-overview]]
