---
id: drr-dance-12-pre-prod-qa
title: Dance — Pre-Production QA
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/2.Dance/DANCE-PRE-PROD-QA.md"
discipline: dance
monday_ref: null
tags: [discipline-rubric-research, dance, stage-qa]
confidence: medium
created: 2026-05-06
imported: 2026-06-08
updated: 2026-06-08
---

# Dance — Pre-Production QA

> **Imported research — Discipline Rubric Research programme.** Step 12 of 13 in the Dance thread (`stage-qa`). Original file: `2.Dance/DANCE-PRE-PROD-QA.md`. Original date: 2026-05-06 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Converted from RTF to Markdown on import. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-dance-overview]].

---

1. Pre-Production QA Readiness Check
Check
Result
Notes
Dance research complete
Yes
Completed through DANCE-S0, DANCE-B1, DANCE-B2, DANCE-B3 and DANCE-B4.
Dance synthesis complete
Yes
DANCE-SYN complete.
Dance audit complete
Yes
DANCE-AUDIT complete.
Dance revision complete
Yes
DANCE-REV complete.
Dance final audit complete
Yes
DANCE-FINAL-AUDIT complete.
Dance output-specificity mapping complete
Yes
DANCE-OUTPUT-SPEC complete.
Dance v5 maturity audit complete
Yes
DANCE-V5-MATURITY-AUDIT complete.
Real Dance live outputs available
No
User confirmed no current Dance-only outputs exist.
Synthetic/adversarial pre-production QA may proceed
Yes
This is the correct next step before production release.
Caveats
Yes
This plan does not verify real rendered report behaviour, comparison-page labels, persisted/exported timestamp parity or live user-facing copy. Those remain release-gate checks once synthetic outputs are generated.
2. Pre-Production QA Scope
This run covers:
Pre-production release gates for the revised Dance rubric feature.
Synthetic/adversarial test scenarios for Dance outputs.
Dance-specific display, label, timestamp and report-behaviour QA requirements.
Cross-branch non-regression checks required before release.
Post-release monitoring requirements for the first real Dance outputs.
This run does not cover:
live-output QA against real Dance reports
implementation
backend or schema changes
frontend design
renderer/export changes
score-field or weighting changes
new source research
rubric rewriting
Live-output QA cannot happen yet because no Dance-only rendered reports, PDFs, exports, report JSONs or comparison examples exist.
Synthetic/adversarial QA is now the correct next step because Dance is a new production feature with no meaningful live usage. The release risk must therefore be tested through generated pre-production scenarios before users begin submitting Dance tapes.
Must remain preserved:
shared six-field architecture
current Dance weights
server-side score recomputation
Step 1 / Step 2 workflow
locked-field enforcement
caps, blockers and verdict thresholds
MT acting + song stabilised flow
completed Acting, Voice/Singing and Commercial semantics
Live-output QA is triggered once either:
synthetic Dance outputs are generated in staging/pre-production, or
the first real Dance report exists in production.
3. Dance Pre-Production Release Gates
Release gate ID
Gate title
What must be verified
Required evidence
Related DANCE-OS rule ID(s)
Related DANCE-OS test ID(s)
Related DANCE-V5 patch action ID(s)
Pass criteria
Fail criteria
Blocks production release?
DANCE-PROD-GATE01
Dance-only label containment
Dance-only output does not show singing/voice/Vocal Performance wording
Rendered report labels and category text
DANCE-OS-R01
DANCE-OS-T01
DANCE-V5-P01
User-facing category means movement/dance technique
Any singing/voice label where singing absent
Yes
DANCE-PROD-GATE02
Comparison-page label parity
Comparison labels match Dance report semantics
Comparison page output
DANCE-OS-R01
DANCE-OS-T01
DANCE-V5-P03
Comparison does not show Vocal/singing wording for Dance-only
Report and comparison use conflicting labels
Yes
DANCE-PROD-GATE03
Timestamp density and rendering
Dance notes render with adequate density and chronology
Report + PDF/export + JSON if available
DANCE-OS-R14
DANCE-OS-T02–T15
DANCE-V5-P02
Notes are chronological, movement-specific, not padded
Notes missing, generic, lost in export or over cap
Yes
DANCE-PROD-GATE04
Assessability precondition
Output treats visibility/framing/audio as confidence conditions
Technical/audio/reliability sections
DANCE-OS-R03, R12
T02, T03, T04, T05
DANCE-V5-P02
Limits claims where assessability limited
Strong judgement despite unreadable tape
Yes
DANCE-PROD-GATE05
Anti-polish / simple capture
Smartphone/home setup is not penalised if readable
Presentation/technical wording
DANCE-OS-R07
T02, T03
—
Rewards assessability, not polish
Studio/equipment praised as talent
Yes
DANCE-PROD-GATE06
Style specificity
Style-specific language appears where justified
Category notes, strengths, timestamps
DANCE-OS-R02
T08, T09, T15
—
Style named or uncertainty stated
Generic movement bucket only
Yes
DANCE-PROD-GATE07
Generic-feedback suppression
Substantive claims have evidence anchors
Full report text
DANCE-OS-R04
T02–T15
—
Generic phrases replaced with evidence
“Good energy / strong technique” without anchor
Yes
DANCE-PROD-GATE08
Live-room-only overclaim suppression
Pickup, direction response, adaptability, stamina not inferred
Report and next-take plan
DANCE-OS-R05
T11, T12
—
Marked not assessable / low-confidence unless shown
Finished tape used to infer live-room capacity
Yes
DANCE-PROD-GATE09
Accessibility-safe language
Adaptation is not treated as deficit
Adapted/seated/mobility scenario output
DANCE-OS-R06
T07
—
Evaluates shown task only
Mobility aid, seated work or reduced range treated as weakness
Yes
DANCE-PROD-GATE10
Tap audibility
Tap claims require audible footwork
Audio + tap report wording
DANCE-OS-R11, R12
T06
—
Caveat if footwork not audible
Rhythm/clarity claim from inaudible tap
Yes
DANCE-PROD-GATE11
Commercial/street/hip-hop caution
Style language remains contextual and tape-specific
Commercial/street/hip-hop output
DANCE-OS-R10
T08
—
Avoids universalising employer/competition logic
Presents one style source as universal standard
Yes
DANCE-PROD-GATE12
MT non-regression
Dance launch does not affect MT acting+song flow
MT regression output
DANCE-OS-R01
Cross-branch
—
MT still shows Acting + Vocal when appropriate
MT vocal hidden or component logic broken
Yes
DANCE-PROD-GATE13
Acting/Voice/Commercial label non-regression
Other branches retain correct field semantics
Cross-branch regression outputs
DANCE-OS-R01
Cross-branch
—
Acting, Voice and Commercial labels remain correct
Dance label logic leaks into other branches
Yes
4. Synthetic Dance QA Scenario Matrix
Pre-production test ID
Related DANCE-OS-T ID
Scenario
Synthetic input condition
Expected output behaviour
Blocked output behaviour
Required evidence anchor
Required reliability / confidence behaviour
Required label behaviour
Related release gate ID(s)
Priority
DANCE-PROD-T01
DANCE-OS-T01
Dance-only no-singing label containment
Dance-only tape, no singing
Movement/dance technique shown user-facing
Vocal Performance / voice / singing wording
Category text and report labels
Normal if assessable
No singing/voice label
GATE01, GATE02
P0
DANCE-PROD-T02
DANCE-OS-T02
Smartphone/home setup assessable
Full-body clear home recording
Accepts simple capture; focuses on movement
Penalises home/smartphone setup
Visibility/framing evidence
High if readable
Dance technique label
GATE04, GATE05
P0
DANCE-PROD-T03
DANCE-OS-T03
High polish, weak assessability
Studio polish but cropped/unclear movement
Lowers confidence; flags assessability
Rewards polish as quality
Cropping/framing evidence
Lower reliability
Dance labels only
GATE04, GATE05
P0
DANCE-PROD-T04
DANCE-OS-T04
Cropped/partial-body tape
Important foot/leg/body action missing
Narrows movement claims
Strong technique claim from cropped tape
Missing-body visibility note
Lower reliability
Dance labels only
GATE04
P0
DANCE-PROD-T05
DANCE-OS-T05
Weak/inaudible music
Movement visible, music unclear
Separates audio limitation from musicality
Says weak musicality due to inaudible music
Audio/music note
Lower confidence for musicality only
Audio note not performance proxy
GATE04
P0
DANCE-PROD-T06
DANCE-OS-T06
Tap with poor audibility
Tap visible, footwork sound unclear
Caveats rhythm/clarity claims
Strong tap rhythm claim without sound
Footwork audibility note
Lower confidence for tap rhythm
Dance/tap wording only
GATE10
P0
DANCE-PROD-T07
DANCE-OS-T07
Visible mobility aid / seated adaptation
Adapted or seated dance task
Describes shown movement without deficit
Treats adaptation as weakness
Movement/task evidence
Depends on assessability
No deficit language
GATE09
P0
DANCE-PROD-T08
DANCE-OS-T08
Mixed commercial/street tape
Mixed identifiable commercial/street vocabulary
Contextual cautious wording
Universal street/hip-hop claims
Groove/phrasing/style evidence
Normal if visible
Style label cautious
GATE06, GATE11
P1
DANCE-PROD-T09
DANCE-OS-T09
Contemporary with improvisation
Tape includes improvisation task
Comments on creative response with evidence
Generic creativity without task evidence
Improvisation moment/timestamp
Normal if visible
Contemporary/improv wording
GATE06, GATE07
P1
DANCE-PROD-T10
DANCE-OS-T10
Fixed choreography, no improvisation
Set choreography only
Does not praise improvisation/creativity unless shown
“Great improvisation” claim
Choreography phrase evidence
Normal if visible
Style-specific if known
GATE07
P1
DANCE-PROD-T11
DANCE-OS-T11
Pickup speed unknown
Polished finished tape only
Marks pickup not assessable
Infers quick learner
No direct pickup evidence
Low/not assessable for pickup
No label issue
GATE08
P0
DANCE-PROD-T12
DANCE-OS-T12
Short clip, stamina unknown
30–60 second clip
Does not infer stamina
Claims stamina/endurance
Clip length / scope evidence
Low/not assessable for stamina
No label issue
GATE08
P0
DANCE-PROD-T13
DANCE-OS-T13
Admissions-style training tape
School/training context
May mention potential only if brief/context supports
Uses potential in employer context
Admissions/training context
Normal if assessable
Dance labels only
GATE07
P1
DANCE-PROD-T14
DANCE-OS-T14
Employer-style reel
Commercial/employer first-round reel
Present-observed evidence; live-only caveats
Training-potential inflation
Reel content evidence
Normal for shown reel only
Employer context cautious
GATE08, GATE11
P1
DANCE-PROD-T15
DANCE-OS-T15
Mixed/unclear style
Style not confidently identifiable
States mixed/unclear; shared movement domains
Guesses style confidently
Observable shared domains
Normal if assessable
Mixed/uncertain fallback
GATE06
P0
5. Minimum Synthetic Test Set for Launch
Minimum P0 tests
Test ID
Why needed
Risk covered
Release consequence if failed
DANCE-PROD-T01
Highest-risk Dance label problem
Vocal proxy / singing label leakage
Block release
DANCE-PROD-T02
Ensures anti-resource-bias handling
Home/smartphone setup not penalised
Block release if polish bias appears
DANCE-PROD-T03
Tests anti-polish and assessability priority
Production value over-reward
Block release
DANCE-PROD-T04
Tests partial-body assessability
Overclaim from cropped tape
Block release
DANCE-PROD-T05
Tests audio/music separation
Poor audio becomes poor musicality
Block release
DANCE-PROD-T06
Tests tap audibility caveat
Unsupported tap rhythm claim
Block release
DANCE-PROD-T07
Tests accessibility-safe language
Adaptation/access deficit inference
Block release
DANCE-PROD-T11
Tests live-room boundary
Pickup inferred from finished tape
Block release
DANCE-PROD-T12
Tests stamina boundary
Stamina inferred from short clip
Block release
DANCE-PROD-T15
Tests unknown-style fallback
Unsupported subtype certainty
Block release
Recommended P1 tests
Test ID
Why needed
Risk covered
Release consequence if failed
DANCE-PROD-T08
Commercial/street/hip-hop caution
Universalised style logic
Fix before broad release
DANCE-PROD-T09
Task-present creativity
Supported improvisation evidence
Fix prompt/report wording if failed
DANCE-PROD-T10
No unsupported creativity
Generic creativity overclaim
Fix before release if systemic
DANCE-PROD-T13
Training-potential scope
Admissions-only potential handling
Fix if employer/training scope confused
DANCE-PROD-T14
Employer reel handling
Present-observable vs live-only
Fix if live claims overreach
Optional P2 tests
Test ID
Why needed
Risk covered
Release consequence if failed
Additional style variants
Broader style coverage
Edge-case subtype wording
Monitor if core P0/P1 pass
Hybrid Dance + other component
Future hybrid robustness
Component leakage
Not launch-blocking unless common path
Unknown low-confidence Dance upload
Ambiguity handling
False specificity
Monitor and patch if repeated
6. Dance Prompt / Report Behaviour QA Checklist
Area
QA question
Pass condition
Category labels
Does Dance-only output avoid Vocal Performance / voice / singing?
Movement/dance technique semantics only
Movement technique wording
Is technique tied to visible movement evidence?
Uses style/task/timestamp anchor
Style-specific handling
Is style named only where justified?
Style-specific or cautious fallback
Mixed/uncertain style fallback
Does output avoid guessing?
Says mixed/unclear and uses shared domains
Assessability notes
Does output state visibility/framing/space limits?
Limits claims and reliability where needed
Audio/music notes
Is audibility separated from musicality?
No weak-musicality inference from poor audio
Performance / expression wording
Is performance movement-based?
Phrasing, dynamics, focus, space, communication
professional_presentation note
Is it bounded?
Assessability / brief response / safe prep only
Strengths
Are strengths evidence-anchored?
Observable moment or movement quality
Improvements
Are improvements actionable and observed?
Specific issue + next action
Fix-first
Is fix-first the highest-impact observed change?
Not generic
Timestamped notes
Are notes chronological and movement-specific?
Enough useful notes, max 8
Next-take plan
Is advice tied to evidence?
No live-room/stamina overclaim
Feedback reliability
Does reliability reflect assessability?
Lower when evidence limited
Comparison-page labels
Do labels match report semantics?
No Vocal/singing for Dance-only
Anti-bias
Any appearance/body/access deficit language?
None
Anti-polish
Any reward for expensive production?
None
Live-room-only
Pickup/stamina/direction inferred?
Only if directly shown
7. Dance Label and Field-Semantics QA Checklist
Check
Requirement
Internal stored field
May remain vocal internally.
User-facing Dance-only label
Must not say Vocal Performance, voice, singing or vocal quality unless singing exists.
User-facing Dance technique label
Must mean movement technique / dance technique.
Comparison page
Must match report semantics.
Song / MT
Must retain sung-vocal meaning where singing exists.
Acting / Monologue
Must retain speech-delivery containment.
Commercial
Must not acquire singing/voice labels unless supported by task.
Cross-discipline regression
Dance label containment must not hide legitimate Vocal in Song/MT.
Hybrid
Labels must reflect actual components present.
Unknown
Must not force Dance semantics unless Dance is detected.
8. Timestamp and Renderer QA Checklist
Timestamp check
Requirement
Under 60 seconds
3–4 useful notes if assessable.
1–3 minutes
5–7 useful notes if assessable.
3–5 minutes
7–8 useful notes if assessable.
Maximum cap
Never exceed 8 timestamped notes.
Chronological order
Required.
Movement-specific evidence
Required; no generic filler.
Strength moment
At least one where justified by tape.
Improvement moment
At least one where justified by tape.
Assessability fallback
If visibility/audio limits note density, say so and lower reliability.
Rendered report count
Must match intended note count.
PDF/export count
Must match rendered/report object where available.
Comparison/summary display
Must not distort notes if shown.
Persisted-versus-rendered parity
Must be checked if JSON/report object exists.
No padding
Never invent notes to meet density target.
9. Adversarial Failure Library
Failure pattern
Why dangerous
Example unsafe output pattern
Required safe replacement
Related DANCE-OS rule ID
Related test ID
Release consequence
“Vocal Performance” in Dance-only output
Confuses Dance with singing
“Vocal Performance: 88”
“Dance technique / movement technique”
R01
T01
Block release
“Great energy” without evidence
Generic praise
“Great energy throughout”
“At 0:42, sharper attack through the turn lifted the phrase”
R04
T20 / T08
Block if systemic
“Strong technique” without style/timestamp
Unsupported
“Strong technique”
“Clear control through the ballet adage at 1:10”
R04/R02
T01–T06
Block if systemic
“Professional tape” because studio polish
Resource bias
“The studio setup makes this professional”
“The full-body framing makes movement assessable”
R07
T02/T03
Block release
“Good musicality” when music inaudible
False performance judgement
“Musicality needs work”
“Music is not clear enough to judge rhythmic relationship confidently”
R12
T05
Block release
Tap rhythm claim without audible tap
Unsupported tap assessment
“Excellent tap clarity”
“Footwork sound is not audible enough for strong rhythm claims”
R11
T06
Block release
Stamina claim from short clip
Live-room overclaim
“Shows strong stamina”
“Stamina over a full call is not assessable from this short clip”
R05
T12
Block release
Direction-response claim from finished tape
Unsupported
“Clearly takes direction well”
“Direction response is not shown in this finished take”
R05
T11
Block release
Disability/seated adaptation as weakness
Bias/safety breach
“Limited by seated performance”
“Assess the adapted task as shown without deficit inference”
R06
T07
Block release
Appearance/body/line critique
Protected/body bias
“Better body lines needed”
“Clarify the arm pathway / extension through the phrase”
R06/R04
T07/T20
Block release
Commercial/street universal claim
Overclaim
“This is correct hip-hop style”
“This tape shows a groove/attack choice consistent with the task shown”
R10
T08
Fix before release
Generic Dance report no style handling
Low specificity
“Good movement and energy”
Style-aware or mixed-style fallback with evidence anchors
R02/R04
T15
Block if systemic
10. Cross-Branch Regression Matrix
Branch / audition type
What Dance launch must not break
Why it matters
Regression test required
Related Dance release gate ID
Pass / fail indicator
Musical Theatre acting + song
Acting + song components, Acting/Vocal visibility, consistency modifier, timestamps
MT is protected anchor
MT acting+song regression output
GATE12
Pass if MT categories/components remain unchanged
Song / Voice
Sung-vocal meaning
Dance label containment must not hide singing
Song-only output
GATE13
Pass if Vocal remains sung-vocal where singing exists
Acting / Monologue
Speech-delivery containment
Vocal proxy should not become singing label
Spoken-only output
GATE13
Pass if no singing/vocal performance wording
Commercial
Acting-as-presence/naturalism semantics
Dance movement rules must not leak
Commercial output
GATE13
Pass if Commercial remains camera/copy/naturalism-based
Hybrid
Component breakdown and category meaning
Mixed tapes need correct component handling
Hybrid output
GATE13
Pass if components are explained and labels fit components
Unknown / low-confidence
Cautious professional baseline
Avoid false Dance classification
Ambiguous output
GATE13
Pass if uncertainty is reflected and no invented type claims
11. Pre-Production QA Issue Register
Issue ID
Issue title
Trigger condition
Severity
Blocks release?
Required fix category
Related release gate ID(s)
DANCE-PROD-I01
Dance-only singing label leakage
Dance-only output shows Vocal Performance / voice / singing
Critical
Yes
display label patch or prompt/config patch
GATE01, GATE02
DANCE-PROD-I02
Comparison label mismatch
Report label safe but comparison page shows Vocal/singing
Critical
Yes
comparison label patch
GATE02
DANCE-PROD-I03
Timestamp underproduction
Assessable Dance tape has too few notes without caveat
High
Yes
prompt/config patch or renderer/export patch
GATE03
DANCE-PROD-I04
Timestamp render/export mismatch
Notes present in object but missing in render/PDF
High
Yes
renderer/export patch
GATE03
DANCE-PROD-I05
Assessability overclaim
Poor visibility/audio but confident critique
Critical
Yes
output wording patch / prompt patch
GATE04
DANCE-PROD-I06
Production-polish reward
Studio/equipment praised as talent
High
Yes
output wording patch
GATE05
DANCE-PROD-I07
Generic Dance praise
“Good movement/energy/technique” without anchor
High
Yes if systemic
prompt/config patch
GATE07
DANCE-PROD-I08
Live-room overclaim
Pickup/stamina/direction inferred from finished tape
Critical
Yes
prompt/config patch
GATE08
DANCE-PROD-I09
Accessibility deficit language
Adaptation/access need treated as weakness
Critical
Yes
safety/output wording patch
GATE09
DANCE-PROD-I10
Tap audibility overclaim
Tap clarity/rhythm praised or criticised without sound
High
Yes
prompt/config patch
GATE10
DANCE-PROD-I11
Commercial/street overclaim
Employer/competition style logic universalised
Medium
No if isolated
output wording patch
GATE11
DANCE-PROD-I12
Cross-branch regression
MT/Song/Acting/Commercial label semantics break
Critical
Yes
regression fix
GATE12, GATE13
DANCE-PROD-I13
False style certainty
Mixed/unclear style labelled confidently
High
Yes if repeated
prompt/config patch
GATE06
12. Release Readiness Decision Framework
Decision category
When to use
Required evidence
Next step
Approved for production release
All P0 gates pass, no critical cross-branch regressions, timestamp/display checks pass
Synthetic report set + label/comparison/render verification
Release Dance feature with monitoring
Approved for limited / monitored release
P0 gates pass; only P1/P2 limitations remain
Synthetic outputs pass; documented limitations
Limited release + first 5 report manual review
Blocked pending output wording patch
Genericity, overclaim, anti-bias or assessability wording fails
Failed synthetic reports
Patch prompt/report wording, rerun tests
Blocked pending display label patch
Dance-only Vocal/singing label appears
Report or comparison display evidence
Patch display/label handling, rerun label tests
Blocked pending timestamp/rendering fix
Timestamp density/parity fails
Render/PDF/JSON mismatch or underproduction
Fix renderer/export/prompt behaviour, rerun
Blocked pending cross-branch regression fix
MT/Song/Acting/Commercial semantics break
Cross-branch regression output
Fix regression before Dance release
Not auditable because synthetic outputs not generated
No synthetic output set exists
No generated Dance reports
Generate minimum P0 synthetic outputs
13. Post-Release Monitoring Plan
Because no users have used Dance yet, monitor the first real Dance outputs manually.
Required post-release checks:
First 5 Dance reports manual review.
First Dance-only report label audit.
First Dance comparison page audit.
First poor-visibility Dance tape audit.
First accessibility/adapted Dance context audit if it occurs.
First tap subtype audit if it occurs.
First commercial/street/hip-hop subtype audit if it occurs.
Timestamp density check for each of first 5 Dance reports.
Rendered vs exported note count check where PDF/export exists.
User-facing category-label check for each of first 5 Dance reports.
Presentation-note audit for anti-polish and class-coded wording.
Feedback reliability audit when visibility/audio is limited.
Escalation triggers:
Any Dance-only Vocal Performance / singing / voice label.
Any comparison-page label mismatch.
Any appearance/body/access-deficit language.
Any production-polish reward as talent.
Any stamina, pickup or direction-response overclaim from a finished tape.
Any tap rhythm claim without audible evidence.
Any report with generic strengths/improvements and no movement evidence.
Any timestamp underproduction without assessability caveat.
Any MT/Song/Acting/Commercial label regression after Dance release.
14. Reusable Handoff Pack
Dance pre-production QA mapping is complete. Because no real Dance-only live outputs exist, the correct next step is controlled synthetic/adversarial output generation rather than live-output QA. The Dance branch is mature at rubric, synthesis, audit, revision, final-audit, output-specificity and v5 maturity level, but release readiness still depends on verifying output-layer behaviour before users begin using the feature.
The release gates are centred on the known high-risk areas: Dance-only label containment, comparison-page label parity, timestamp density/rendering, assessability preconditions, anti-polish handling, style specificity, generic-feedback suppression, live-room-only overclaim suppression, accessibility-safe wording, tap audibility, commercial/street/hip-hop caution, and cross-branch non-regression.
The minimum launch-blocking synthetic test set is DANCE-PROD-T01, T02, T03, T04, T05, T06, T07, T11, T12 and T15. These cover the core P0 risks: no singing/voice label in Dance-only reports, simple home setup not penalised, high production polish not over-rewarded, cropped visibility handled through assessability, poor audio not converted into weak musicality, tap audibility caveats, adapted movement without deficit inference, no pickup-speed overclaim, no stamina overclaim, and cautious fallback when style cannot be confidently identified.
Before release, synthetic Dance outputs must be generated and inspected against the release gates. If all P0 gates pass and no cross-branch regression appears, Dance may proceed to production release or limited monitored release. After release, the first five Dance reports require manual QA, including label checks, timestamp density, comparison-page parity, assessability behaviour, anti-bias language and presentation-note boundaries.
Residual risks remain output-layer risks, not rubric-research blockers: frontend label behaviour, comparison labels, renderer/export timestamp parity and real-world Dance report wording are still unverified until synthetic and then live outputs exist.
15. Completion Statement
DANCE-PRE-PROD-QA complete. Ready to generate synthetic Dance outputs for release-gate testing.

---

## Links

- **Previous:** [[drr-dance-11-lessons]] — Lessons Learned
- **Next:** [[drr-dance-13-final-handoff]] — Final Handoff
- **Thread overview:** [[drr-dance-overview]]
- **Programme:** [[drr-programme-overview]]
