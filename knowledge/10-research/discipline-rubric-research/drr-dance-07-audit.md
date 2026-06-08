---
id: drr-dance-07-audit
title: Dance — Synthesis Audit
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/2.Dance/D-Syn-Dance-Audit.md"
discipline: dance
monday_ref: null
tags: [discipline-rubric-research, dance, stage-audit]
confidence: medium
created: 2026-05-04
imported: 2026-06-08
updated: 2026-06-08
---

# Dance — Synthesis Audit

> **Imported research — Discipline Rubric Research programme.** Step 7 of 13 in the Dance thread (`stage-audit`). Original file: `2.Dance/D-Syn-Dance-Audit.md`. Original date: 2026-05-04 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-dance-overview]].

---

# DANCE-AUDIT — Dance Gap Audit Against the Current TapeCoach Dance Baseline

## Audit readiness and inputs

### Audit readiness check

- **Current Dance baseline materials present:** **Yes**
- **Completed DANCE-SYN handoff present:** **Yes**
- **Example Dance outputs present:** **No**
- **Source IDs normalised:** **Yes**
- **Audit may proceed:** **Yes**

**Caveats**

The baseline pack is sufficient for a full wording-and-guidance audit, but not for a full implementation audit. The strongest baseline materials for this audit are:

- **Primary baseline materials:** prompt **0B** (Dance rubric slice), prompt **0E** (Baseline Guardrail Pack), attachment **0C — Current Process and Rubric Baseline Audit**, attachment **0D — Current Output Specificity Stress Test**
- **Supporting baseline materials:** attachment **0A-RECONCILE — Rubric Design Memory vs Current Implementation**, attachment **0 — GPT Rubric Control Sheet**

That means the attachments that should be treated as **baseline materials** are **0C and 0D as primary attachments**, with **0A** and **0 — GPT Rubric Control Sheet** used as supporting control/context documents. Prompt sections **0B** and **0E** remain binding because they are the most explicit Dance-specific baseline inputs.

What was **not** supplied:
- current frontend label-helper code
- current comparison-page label-helper code
- actual current Dance report examples
- raw current Dance prompt text beyond the supplied baseline slices
- current renderer/export behaviour for Dance specifically

So this audit can assess **baseline wording, logic framing, guardrails and report-structure intent**, but cannot fully certify live UI behaviour.

### Audit input register

| Input item | Type | Present? | Used in audit? | Role in audit | Limitation / note |
|---|---|---:|---:|---|---|
| **0B — Dance rubric slice** | Prompt baseline slice | Yes | Yes | Primary Dance baseline | Most direct current Dance-specific baseline text |
| **0E — Baseline Guardrail Pack** | Prompt guardrail pack | Yes | Yes | Primary preserve / do-not-touch / label guardrails | Cross-discipline, but binding for Dance audit |
| **0C — Current Process and Rubric Baseline Audit** | Attachment | Yes | Yes | Primary operational baseline | Strongest current-state summary of scoring, report structure and risks |
| **0D — Current Output Specificity Stress Test** | Attachment | Yes | Yes | Primary specificity-risk baseline | Strong on genericity and evidence-anchor failures; not Dance-output-specific |
| **0A-RECONCILE — Rubric Design Memory vs Current Implementation** | Attachment | Yes | Yes | Supporting implementation confirmation | Useful for shared-schema, vocal-overload and static-label evidence |
| **0 — GPT Rubric Control Sheet** | Attachment | Yes | Yes | Supporting control-sheet context | Broad control source; partly superseded by 0A/0C where implementation-specific |
| **Completed DANCE-SYN handoff** | Synthesis handoff | Yes | Yes | Audit benchmark and evidence basis | Authoritative for DANCE-SYN-F01 to DANCE-SYN-F14 |
| **Example Dance outputs** | Sample reports | No | No | Optional output-specificity spot audit | Not supplied; 0D includes mostly MT/general examples only |

### Audit scope and out-of-scope

**This audit covers**
- conflicts between the current Dance baseline and DANCE-SYN findings
- missing or underspecified dance wording and report guidance
- user-facing label risk within the existing six-field model
- evidence-anchor requirements
- style-specific versus generic movement language
- tape-observable versus live-room-only boundaries
- anti-bias and accessibility-safe language
- production-value versus assessability boundaries
- revision targets for DANCE-REV
- provisional non-regression tests

**This audit does not cover**
- backend logic changes
- schema changes
- score-field additions
- score-field renames in code
- weight changes
- cap or blocker changes
- verdict-threshold changes
- Mux or pipeline changes
- implementation of subtype extraction
- UI implementation beyond audit notes on wording, suppression and guardrails

**Intentionally deferred to DANCE-REV**
- actual revised sentence-level wording
- exact user-facing section text
- finalised label wording
- finalised confidence caveat wording
- finalised anti-bias rule wording
- finalised timestamp wording and report phrasing

**Out of scope because of architecture guardrails**
- replacing the stored `vocal` field
- altering the shared six-field score architecture
- adding a true dedicated dance-technique score field
- changing server-side recomputation
- changing public report schema or comparison-page data structures

## Finding-to-baseline audit matrix

| Synthesis finding ID | Short finding title | Current baseline component affected | Current baseline text / behaviour / assumption actually audited | Status | Why this status was assigned | Evidence basis | Source ID(s) | Severity | Audit issue ID(s) | Revision relevance | Caution / defer note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **DANCE-SYN-F01** | Layered source model, not one generic Dance standard | 0B dance slice; 0A/0C shared schema notes | Dance is supported but has “no confirmed true dance-technique rubric”; shared six fields remain; discipline differences are mainly weights-first, not template-first | **Partial** | The baseline recognises the problem, but still operates a generic shared model without layered dance guidance | 0B; 0A-RECONCILE; 0C | DANCE-S009, DANCE-S034, DANCE-S038, DANCE-S041, DANCE-S056, DANCE-S066, DANCE-S068 | **Critical** | DANCE-AUDIT-I01, I02, I03 | Foundational | Revision must work inside the shared architecture; no new schema |
| **DANCE-SYN-F02** | Style-aware technical language | Movement-technique guidance; category note logic | Current dance slice permits timing, control, musicality, transitions, energy, intention and assessability focus, but no confirmed subtype handling | **Partial** | Some movement language exists, but not the stable style-aware descriptor set supported by synthesis | 0B; 0C; 0A | DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043 | **High** | DANCE-AUDIT-I02, I13 | Core DANCE-REV target | Do not import exam-board mark bands or percentages |
| **DANCE-SYN-F03** | Tape assessability preconditions | Technical visibility notes; presentation notes; reliability logic | Presentation only if camera-readability affects assessability; known gap: no confirmed full-body visibility rubric | **Partial** | Assessability is recognised, but dance-specific preconditions are not codified tightly enough | 0B; 0C; 0D | DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068 | **Critical** | DANCE-AUDIT-I03, I12 | Core DANCE-REV target | Missing assessability should lower confidence, not trigger appearance critique |
| **DANCE-SYN-F04** | Generic praise must be evidence-anchored | Headline; strengths; improvements; fix-first; category notes | “Evidence-led, not generic” exists, but dance slice still invites broad terms without forcing observable anchors | **Partial** | Anti-generic principle is present, but dance-specific evidence requirements are too weak | 0B; 0D; 0E | DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S053, DANCE-S064 | **Critical** | DANCE-AUDIT-I04, I14 | Core DANCE-REV target | Output specificity must be carried forward from Run 0D |
| **DANCE-SYN-F05** | Training potential versus current level | Casting insight / readiness language | Level-aware logic exists, but no current dance baseline text separates training potential from current observed standard | **Non-compliant** | The distinction is not currently encoded in the Dance baseline materials | 0B; 0C; DANCE-SYN handoff | DANCE-S004, DANCE-S008, DANCE-S011, DANCE-S025, DANCE-S030 | **High** | DANCE-AUDIT-I08 | Important but secondary | Keep this mainly to admissions/training contexts |
| **DANCE-SYN-F06** | Improvisation and creative response are task-specific | Performance/artistry guidance | No current dance-specific rule limits improvisation/creative-response commentary to task-present evidence | **Non-compliant** | The baseline does not currently constrain this topic enough | 0B; 0C; DANCE-SYN handoff | DANCE-S001, DANCE-S014, DANCE-S015, DANCE-S041, DANCE-S064, DANCE-S069 | **High** | DANCE-AUDIT-I09 | Important DANCE-REV target | Avoid generic “creative” claims from non-improvisation tapes |
| **DANCE-SYN-F07** | Pick-up, direction response and adaptability are mainly live-room | Claim-scope logic; next-take logic; live-only caveats | Workshop/recall are not first-class types; no explicit dance rule blocks inference from finished tape | **Non-compliant** | Current baseline does not sufficiently ring-fence live-room-only capacities | 0C; 0D; DANCE-SYN handoff | DANCE-S057, DANCE-S061, DANCE-S071, DANCE-S072 | **Critical** | DANCE-AUDIT-I05 | Core DANCE-REV target | Major anti-overclaim finding |
| **DANCE-SYN-F08** | Accessibility-safe adaptation and anti-inference | Accessibility-safe physicality guardrails; exclusion rules | Baseline says do not penalise disability, mobility aids, reduced range or seated adaptation; stronger attainment/process split is not codified | **Partial** | Anti-penalisation exists, but full adaptation-versus-attainment language is incomplete | 0B; 0E; 0C | DANCE-S039, DANCE-S046, DANCE-S064, DANCE-S065, DANCE-S066 | **Critical** | DANCE-AUDIT-I06 | Core DANCE-REV target | No medical or capability inference from tape |
| **DANCE-SYN-F09** | Production value is not quality | Professional_presentation; presentation notes; technical visibility | Baseline limits presentation notes and warns against unsafe visual commentary, but does not fully encode “performance-not-equipment” for Dance | **Partial** | Direction is broadly correct, but the anti-polish boundary is not explicit enough | 0B; 0E; 0D | DANCE-S064, DANCE-S067, DANCE-S068 | **High** | DANCE-AUDIT-I03, I07 | Core DANCE-REV target | Smartphone/home setup must remain valid if readable |
| **DANCE-SYN-F10** | Commercial/street/hip-hop caution | Style guidance; subtype handling | Baseline explicitly says no confirmed commercial/hip-hop subtype handling; no caution block yet exists | **Non-compliant** | Gap is recognised, but not yet translated into report guardrails | 0B; 0C | DANCE-S044, DANCE-S053, DANCE-S069, DANCE-S070, DANCE-S071 | **High** | DANCE-AUDIT-I10 | DANCE-REV with limitation language | Do not universalise employer- or competition-shaped criteria |
| **DANCE-SYN-F11** | Tap evidence limits and audibility | Tap guidance; audio/music logic | Baseline has no dance subtype handling and no tap-specific audibility rule | **Non-compliant** | Tap-specific evidence limits are absent from the current dance baseline | 0B; 0C | DANCE-S043, DANCE-S051 | **Medium** | DANCE-AUDIT-I11, I12 | DANCE-REV with limitation language | Avoid strong tap claims without audible/readable evidence |
| **DANCE-SYN-F12** | Tight professional_presentation boundary | Professional_presentation guidance | Presentation only if camera-readability affects assessability; technical/presentation should not dominate unless assessability or brief compliance is materially affected | **Partial** | Baseline points in the right direction, but does not yet fully exclude glamour, polish and marketability leakage in Dance | 0B; 0E; 0C | DANCE-S057, DANCE-S064, DANCE-S067, DANCE-S068, DANCE-S069 | **High** | DANCE-AUDIT-I07, I13 | Core DANCE-REV target | Keep assessability distinct from polish |
| **DANCE-SYN-F13** | Recorded-first-round versus live-stage distinction | Reliability and claim-scope logic | Baseline says assess observable movement, musicality, clarity, control and visibility only within existing fields, but does not fully codify live-only reserves | **Partial** | The principle is implicit; the claim boundary is not explicit enough | 0B; 0C; 0D | DANCE-S009, DANCE-S018, DANCE-S023, DANCE-S033, DANCE-S056, DANCE-S070, DANCE-S071, DANCE-S072 | **Critical** | DANCE-AUDIT-I03, I05, I14 | Core DANCE-REV target | Critical for confidence logic |
| **DANCE-SYN-F14** | Style-specific reporting, not one movement label | Dance-specific guidance; label handling | Baseline says feedback should be style-aware if style is detected or briefed, but confirms no subtype handling and warns the vocal label is misleading | **Non-compliant** | The baseline states the problem but does not yet solve it in current guidance | 0B; 0A; 0C | DANCE-S023, DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043, DANCE-S044, DANCE-S069 | **Critical** | DANCE-AUDIT-I01, I02, I10, I11, I13 | Foundational | Field rename remains out of scope; wording and display handling are in scope |

## Issue register and recommendation table

### Audit issue register

| Audit issue ID | Issue title | Problem summary | Affected baseline component | Synthesis finding ID(s) | Source ID(s) | Severity | User impact | Evidence confidence | Out-of-scope implementation risk? | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| **DANCE-AUDIT-I01** | Dance-only vocal proxy and label ambiguity | Movement technique is still routed through the shared `vocal` field, while the current baseline already admits the label is misleading for dance-only use | Category labels; dance-only output display; score-field guidance | F01, F12, F14 | DANCE-S009, DANCE-S034, DANCE-S057, DANCE-S064, DANCE-S068 | Critical | Dance-only reports may appear to score singing | High | Yes | Structural field rename stays out of scope |
| **DANCE-AUDIT-I02** | Style-specific dance technique is under-specified | No confirmed subtype handling for ballet, contemporary, jazz, tap, commercial, hip-hop or MT dance; no true movement rubric | Movement-technique guidance; style blocks | F01, F02, F10, F11, F14 | DANCE-S023, DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043, DANCE-S044, DANCE-S069 | Critical | Feedback can become generic or style-inaccurate | High | No | Highest content-specific gap |
| **DANCE-AUDIT-I03** | Dance video assessability conditions are incomplete | Full-body visibility, stable framing, space, minimal editing and readable audio are not yet codified as hard assessability preconditions | Technical/video guidance; reliability; presentation notes | F03, F09, F13 | DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068 | Critical | Reports may overclaim technique from under-readable tape | High | No | Must change confidence framing, not backend scoring |
| **DANCE-AUDIT-I04** | Generic dance feedback is not sufficiently blocked | Evidence-led intent exists, but dance praise/criticism can still pass without observable anchors | Headline; category notes; strengths; improvements; fix-first | F04, F14 | DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S053, DANCE-S064 | Critical | Reports may sound transferable across many tapes | High | No | Core specificity problem |
| **DANCE-AUDIT-I05** | Live-room-only capacities are not ring-fenced | Pick-up, direction response, adaptability and stamina may still be overclaimed from finished tape | Claim-scope guidance; next-take logic; confidence caveats | F07, F13 | DANCE-S057, DANCE-S061, DANCE-S071, DANCE-S072 | Critical | Unfair claims about what the tape actually proves | High | No | Major anti-overclaim issue |
| **DANCE-AUDIT-I06** | Accessibility-safe assessment is only partially codified | Current baseline blocks some penalisation, but not the full process-adaptation-versus-attainment distinction | Accessibility rules; exclusion rules; movement guidance | F08 | DANCE-S039, DANCE-S046, DANCE-S064, DANCE-S065, DANCE-S066 | Critical | Access needs can still be misread as deficits | High | No | Core anti-bias issue |
| **DANCE-AUDIT-I07** | Professional presentation and production-value boundaries are too loose | Current guidance limits presentation, but not enough to prevent polish/equipment from leaking into quality judgements | Professional_presentation guidance; presentation notes | F09, F12 | DANCE-S064, DANCE-S067, DANCE-S068, DANCE-S069 | High | High-production tapes may be over-rewarded | High | No | Needs explicit dance framing |
| **DANCE-AUDIT-I08** | Training potential and current observed level are not cleanly separated | Admissions-style potential language is not currently bounded away from employer/professional tape judgements | Casting insight; readiness language | F05 | DANCE-S004, DANCE-S008, DANCE-S011, DANCE-S025, DANCE-S030 | High | Reports may overstate what a present tape demonstrates | Med-High | No | Mostly a scope/claim issue |
| **DANCE-AUDIT-I09** | Improvisation and creative response are not tied to task-present evidence | The baseline does not specify when creativity is assessable and when it should be omitted | Performance/artistry guidance | F06 | DANCE-S001, DANCE-S014, DANCE-S015, DANCE-S041, DANCE-S064, DANCE-S069 | High | Creativity comments may become invented or generic | Med-High | No | Important for contemporary/commercial cases |
| **DANCE-AUDIT-I10** | Commercial, street and hip-hop wording risks over-generality | The evidence base is improved but still partly employer-/competition-shaped; current baseline lacks caution wording | Style guidance; commercial dance notes | F10, F14 | DANCE-S044, DANCE-S053, DANCE-S069, DANCE-S070, DANCE-S071 | High | Overconfident “universal” wording | Medium | No | Must be carried partly as limitation |
| **DANCE-AUDIT-I11** | Tap evidence limits are under-specified | Tap audibility and rhythmic readability are not yet built into current dance guidance | Tap guidance; style blocks | F11, F14 | DANCE-S043, DANCE-S051 | Medium | Tap reports may overclaim where sound is not reliable | Med-High | No | Evidence base is narrower than ballet/contemporary |
| **DANCE-AUDIT-I12** | Audio and music assessability are not clearly separated from performance quality | Weak or unclear soundtrack may be misread as poor musicality rather than limited assessability | Audio/music guidance; reliability wording | F03, F11 | DANCE-S010, DANCE-S034, DANCE-S043, DANCE-S067, DANCE-S068 | High | Unfair musicality/tap judgements | High | No | Strong overlap with tap and self-tape evidence |
| **DANCE-AUDIT-I13** | Acting, performance and artistry language remains overloaded in dance | Shared acting/performance language can leak theatre-style acting terms into dance reports | Performance/artistry guidance; category breakdown | F02, F12, F14 | DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S069 | High | Dance notes may sound like generic acting feedback | High | No | Needs wording discipline, not new fields |
| **DANCE-AUDIT-I14** | Dance timestamp specificity is not guaranteed | No dance sample outputs were supplied and current baseline does not yet impose dance-specific note coverage rules | Timestamp note rules; reliability handling | F04, F13 | DANCE-S010, DANCE-S023, DANCE-S034 | High | Reports may remain under-evidenced even when assessable | Med-High | No | Output-specificity audit limited to wording and logic |

### Audit recommendation table

| Audit recommendation ID | Recommendation title | Audit issue ID(s) | What needs to change | Why it needs to change | Affected baseline component | Change type label(s) | Synthesis finding ID(s) | Source ID(s) | Priority | Evidence confidence | Baseline compatibility | Backend impact likely | Revision target section for DANCE-REV | Caution / boundary note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **DANCE-AUDIT-R01** | Contain the dance-only vocal proxy in user-facing language | I01 | Add an explicit DANCE-REV target that stops dance-only outputs from using singing/voice wording when singing is absent, and requires dance-specific user-facing phrasing for the existing proxy field | The baseline already treats the current label as misleading, and synthesis rejects undifferentiated movement-technique labelling | Dance-only output display / label handling note; category label guidance | exclude / block language; constrain claim scope; out of scope for current architecture | F01, F12, F14 | DANCE-S009, DANCE-S034, DANCE-S057, DANCE-S064, DANCE-S068 | **P0** | High | High within current schema | **Unclear** | dance-only output display / label handling note | True field rename remains out of scope in this run |
| **DANCE-AUDIT-R02** | Add style-specific dance guidance blocks inside the existing framework | I02 | Revise movement-technique guidance so that ballet, contemporary/modern, jazz/modern theatre, tap, commercial, street/hip-hop and MT dance can each be described with evidence-based subtype language | Synthesis strongly supports style-specific reporting and resists one generic movement-technique label | Movement-technique guidance; style-specific guidance blocks | split style handling; tighten descriptor language | F01, F02, F10, F11, F14 | DANCE-S023, DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043, DANCE-S044, DANCE-S069 | **P0** | High | High; wording-only | No | movement-technique guidance; style-specific guidance blocks | Do not import score bands or percentages |
| **DANCE-AUDIT-R03** | Codify dance tape assessability preconditions and confidence-lowering rules | I03, I12 | Add explicit dance video guidance covering full-body visibility, stable framing, sufficient space, audible music, minimal editing and the rule that missing conditions lower confidence rather than justify stronger criticism | Synthesis treats these as preconditions for fair dance judgement from tape | Tape assessability guidance; technical/video guidance; feedback reliability guidance | require evidence anchor; lower confidence when assessability is limited; constrain claim scope | F03, F09, F13 | DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068 | **P0** | High | High; wording-only | No | tape assessability guidance; technical/video guidance | Do not let assessability limits become appearance or body critique |
| **DANCE-AUDIT-R04** | Force evidence anchors in all dance praise and criticism | I04 | Revise headline, category notes, strengths, improvements and fix-first guidance so that dance comments must tie to observable movement, music, style or assessability evidence and should use timestamps when available | Generic praise is the clearest non-regression risk in the synthesis and the baseline stress test | Headline / casting insight; category notes; strengths; improvements; fix-first | require evidence anchor; tighten descriptor language | F04, F14 | DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S053, DANCE-S064 | **P0** | High | High; wording-only | No | strengths language; improvements language; fix-first logic | Keep wording tape-specific, not academic |
| **DANCE-AUDIT-R05** | Mark pick-up, direction response, adaptability and stamina as live-room-only or low-confidence | I05 | Add a live-room confidence caveat block stating that choreography pick-up, response to direction, adaptability, interview readiness and long-day stamina are not strong finished-tape claims unless directly evidenced | Synthesis treats these as major anti-overclaim boundaries | Live-only confidence caveat language; claim-scope guidance | mark live-room-only; constrain claim scope; carry as limitation | F07, F13 | DANCE-S057, DANCE-S061, DANCE-S071, DANCE-S072 | **P0** | High | High; wording-only | No | live-only confidence caveat language | Particularly important for employer/commercial contexts |
| **DANCE-AUDIT-R06** | Clarify accessibility-safe dance assessment as adaptation without deficit inference | I06 | Revise exclusion and accessibility guidance so that dance reports explicitly separate process adaptation from attainment, allow body- and pace-specific adaptation, and block capability, medical-history and access-need assumptions | Current anti-penalisation wording is directionally good but incomplete against synthesis evidence | Exclusion / anti-bias rules; accessibility-safe assessment guidance | clarify accessibility boundary; exclude / block language | F08 | DANCE-S039, DANCE-S046, DANCE-S064, DANCE-S065, DANCE-S066 | **P0** | High | High; wording-only | No | exclusion / anti-bias rules; accessibility-safe assessment | Must preserve existing accessibility-safe physicality guardrails |
| **DANCE-AUDIT-R07** | Tighten professional_presentation to assessability, brief response and safe preparation only | I07 | Revise professional_presentation guidance so that it is bounded to assessability, safe preparation, brief response and basic audition readiness, and explicitly excludes glamour, marketability, physique, equipment quality and studio polish as quality proxies | Synthesis draws a bright line between assessability and polish | Professional_presentation guidance; presentation notes | clarify professional_presentation boundary; exclude / block language | F09, F12 | DANCE-S064, DANCE-S067, DANCE-S068, DANCE-S069 | **P0** | High | High; wording-only | No | professional_presentation guidance; presentation notes | Employer-specific attire/physique rules stay source-specific and non-universal |
| **DANCE-AUDIT-R08** | Separate training-potential language from present-tape judgement | I08 | Add a scope note limiting training-potential wording to admissions/training-route contexts or explicitly relevant briefs; elsewhere, describe current observed readiness only | Synthesis shows that potential language is source-specific, not universally transferable | Casting insight / readiness language | constrain claim scope; carry as limitation | F05 | DANCE-S004, DANCE-S008, DANCE-S011, DANCE-S025, DANCE-S030 | **P1** | Med-High | High; wording-only | No | casting insight; readiness language | Particularly important to avoid employer-tape overclaim |
| **DANCE-AUDIT-R09** | Constrain improvisation and creative-response comments to task-present evidence | I09 | Revise performance/artistry guidance so that improvisation, freestyle, creative response and versatility are only discussed when the tape or brief clearly includes those tasks | Synthesis treats these as legitimate but task-specific criteria | Performance/artistry guidance; style note guidance | constrain claim scope; require evidence anchor | F06 | DANCE-S001, DANCE-S014, DANCE-S015, DANCE-S041, DANCE-S064, DANCE-S069 | **P1** | Med-High | High; wording-only | No | performance/artistry guidance; style note guidance | Avoid generic “creative” praise on set-phrase-only tapes |
| **DANCE-AUDIT-R10** | Add a caution block for commercial, street and hip-hop wording | I10 | Revise style guidance so that commercial, street and hip-hop language stays evidence-based and explicitly cautious where source support is employer- or competition-shaped rather than universal | Synthesis improves coverage but still warns against universality here | Style-specific guidance blocks; commercial dance note guidance | split style handling; carry as limitation | F10, F14 | DANCE-S044, DANCE-S053, DANCE-S069, DANCE-S070, DANCE-S071 | **P1** | Medium | High; wording-only | No | style-specific guidance blocks; commercial dance guidance | Keep competition/employer logic clearly labelled as such |
| **DANCE-AUDIT-R11** | Add tap-specific audibility and evidence caveats | I11 | Revise tap guidance so that rhythmic clarity, precision and musicality can be discussed, but strong tap-technique claims require sufficiently audible and readable footwork | Tap evidence is strong on descriptors but thinner on public admissions/professional tape evidence | Tap guidance; audio/music assessability guidance | constrain claim scope; lower confidence when assessability is limited | F11 | DANCE-S043, DANCE-S051 | **P1** | Med-High | High; wording-only | No | tap guidance; audio/music assessability guidance | Do not treat silence or poor mix as weak tap quality by default |
| **DANCE-AUDIT-R12** | Separate audio/music assessability from weak musicality claims | I12 | Revise audio/music guidance so that unclear soundtrack, poor balance or weak audibility reduce confidence or assessability first; they should not automatically become performance criticism | Synthesis distinguishes assessability limits from performer limitations | Audio/music assessability guidance; feedback reliability language | require evidence anchor; lower confidence when assessability is limited | F03, F11 | DANCE-S010, DANCE-S034, DANCE-S043, DANCE-S067, DANCE-S068 | **P0** | High | High; wording-only | No | audio/music assessability guidance; feedback reliability language | Especially important for tap and poor-home-audio cases |
| **DANCE-AUDIT-R13** | Reframe dance acting/performance language as movement-based expression and communication | I13 | Revise dance performance/artistry guidance so that shared acting-field language refers to movement-based projection, intention, communication and stylistic expression rather than theatre-style acting or vague presence | Synthesis supports expression/communication, but resists acting-language leakage into dance | Performance/artistry guidance; category breakdown wording | tighten descriptor language; split style handling | F02, F12, F14 | DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S069 | **P1** | High | High; wording-only | No | performance/artistry guidance; category breakdown wording | Keep it movement-based, not personality-based |
| **DANCE-AUDIT-R14** | Strengthen dance timestamp expectations and reliability fallback | I14, I04 | Revise timestamp note rules so that assessable dance tapes are expected to show note coverage for setup/assessability, at least one strength, at least one improvement, and style/component-specific observations; under-evidenced reports should downgrade reliability | Timestamp evidence is the clearest visible proof that the report came from the tape | Timestamp note rules; feedback reliability guidance | require evidence anchor; lower confidence when assessability is limited | F04, F13 | DANCE-S010, DANCE-S023, DANCE-S034 | **P0** | Med-High | High; wording-only | No | timestamp note rules; feedback reliability guidance | No Dance sample outputs were provided, so this is wording-first |

## Topic summary and safeguard audit

### Topic-by-topic audit summary

**Style-specific movement technique language**  
Current baseline status: **Non-compliant**.  
Key risk: one generic movement-technique bucket, plus the `vocal` proxy, encourages interchangeable feedback across ballet, contemporary, jazz, tap, commercial and street forms.  
Recommendation IDs: **R01, R02, R13**.  
Revision scope note: revise movement-technique guidance, style-specific guidance blocks and dance-only label handling.

**Technical / video assessability**  
Current baseline status: **Partial**.  
Key risk: visibility and assessability are recognised, but not formalised as dance-specific preconditions.  
Recommendation IDs: **R03, R14**.  
Revision scope note: revise tape assessability guidance, technical/video guidance and reliability wording.

**Audio / music assessability**  
Current baseline status: **Partial**.  
Key risk: weak or unclear soundtrack can be mistaken for weak musicality or poor tap/rhythm quality.  
Recommendation IDs: **R03, R11, R12**.  
Revision scope note: revise audio/music assessability guidance and reliability language.

**Acting / performance / artistry overlap**  
Current baseline status: **Partial**.  
Key risk: shared acting-field language can produce theatre-style or vague “presence” language rather than movement-based expression.  
Recommendation IDs: **R13**.  
Revision scope note: revise performance/artistry guidance and category breakdown wording.

**professional_presentation boundaries**  
Current baseline status: **Partial**.  
Key risk: polish, glamour, equipment quality or “professional look” can leak into dance judgement.  
Recommendation IDs: **R07**.  
Revision scope note: revise professional_presentation guidance and presentation-note rules.

**Dance-only label risk**  
Current baseline status: **Non-compliant**.  
Key risk: dance-only reports may display singing-coded language because of the stored `vocal` proxy.  
Recommendation IDs: **R01**.  
Revision scope note: revise dance-only output display / label handling note.

**Current vocal-proxy risk**  
Current baseline status: **Non-compliant**.  
Key risk: the field meaning changes across singing, speech and movement technique, which is confusing for users and destabilises category interpretation.  
Recommendation IDs: **R01, R02**.  
Revision scope note: contain via wording and label handling; do not alter architecture in this run.

**Live-room-only versus tape-observable claims**  
Current baseline status: **Non-compliant**.  
Key risk: pickup speed, response to direction, adaptability, interview readiness and long-day stamina may be overclaimed from finished tape.  
Recommendation IDs: **R05**.  
Revision scope note: add live-room-only caveat language and claim-scope rules.

**Accessibility-safe assessment**  
Current baseline status: **Partial**.  
Key risk: access needs may still be framed as performance deficits if process-adaptation language is not made explicit.  
Recommendation IDs: **R06**.  
Revision scope note: strengthen exclusion / anti-bias rules and accessibility-safe assessment language.

**Generic feedback suppression**  
Current baseline status: **Partial**.  
Key risk: broad praise such as “good musicality” or “strong performance” can still slip through without movement or timing evidence.  
Recommendation IDs: **R04, R14**.  
Revision scope note: strengthen evidence-anchor rules across headline, category notes, strengths, improvements and timestamps.

**Production-value versus assessability**  
Current baseline status: **Partial**.  
Key risk: polished tapes can be over-rewarded and simple, home-shot but readable tapes can be undervalued.  
Recommendation IDs: **R03, R07**.  
Revision scope note: tighten presentation, assessability and reliability rules.

**Choreography pick-up / learning-speed caution**  
Current baseline status: **Non-compliant**.  
Key risk: finished tape may be treated as evidence of quick learning or direction response when those are usually live-room tests.  
Recommendation IDs: **R05**.  
Revision scope note: add explicit live-room-only claim boundaries.

**Stamina / endurance caution**  
Current baseline status: **Non-compliant**.  
Key risk: short clips can invite unsupported claims about endurance, fatigue handling or full-call reliability.  
Recommendation IDs: **R05**.  
Revision scope note: add explicit anti-overclaim language in live-only caveats.

**Commercial / street / hip-hop caution**  
Current baseline status: **Non-compliant**.  
Key risk: employer- and competition-shaped criteria may be written as universal commercial-dance standards.  
Recommendation IDs: **R10**.  
Revision scope note: add style-specific caution language and limitation wording.

**Tap evidence limits**  
Current baseline status: **Non-compliant**.  
Key risk: strong tap comments may be made where rhythmic audibility is not actually reliable.  
Recommendation IDs: **R11, R12**.  
Revision scope note: add tap-specific guidance and audio/music caveats.

### Exclusion and anti-bias audit

| Excluded or tightly constrained criterion/language | Where it appears or might appear in the current baseline | Why it is unsafe or unsupported | Required safer handling | Audit recommendation ID(s) | Source ID(s) / synthesis finding ID(s) |
|---|---|---|---|---|---|
| Singing / voice scoring in dance-only situations unless singing is actually present | Current shared `vocal` field; dance-only label risk | Mislabels movement technique as singing and misleads the user | Use dance-specific user-facing phrasing or suppress singing-coded language; keep schema unchanged for now | R01 | F01, F12, F14 |
| Body type | Employer-shaped or presentation language; role-fit leakage risk | Protected-characteristic / appearance bias | Exclude from scoring and report language entirely | R06, R07 | F08, F12 |
| Appearance | Presentation notes; role-fit or professionalism leakage | Unsafe and unsupported unless tied to assessability or explicit non-discriminatory brief constraints | Restrict to assessability-only effects | R06, R07 | F08, F12 |
| Height / physique except as source-specific employer context, not general scoring | Employer/commercial materials | Employer preference is not a universal dance-quality criterion | Label as source-specific context only; never generalise into scoring evidence | R07, R10 | F10, F12 |
| Protected characteristics | Any user-facing evaluation layer | Unlawful and unreliable basis for score or feedback | Explicitly block | R06 | F08 |
| Disability / access needs as deficit | Dance physicality comments; presentation/accessibility handling | Confuses access needs with attainment | Separate adaptation from attainment; no deficit language | R06 | F08 |
| Injury or medical diagnosis from tape | Stamina, range, vibration/strain-like assumptions, capability inference | Unsupported medical inference | Describe only observable assessability or movement outcome; no diagnosis | R06 | F08 |
| Follower count | Practitioner/commercial drift risk | Not talent evidence | Explicitly block | R07 | F12 |
| Fame | Practitioner/commercial drift risk | Not audition evidence | Explicitly block | R07 | F12 |
| Social-media behaviour | Commercial/employer leakage | Not tape-quality evidence | Explicitly block | R07 | F12 |
| Marketability | Commercial/employer/practitioner leakage | Bias-prone and not a valid dance-quality criterion | Exclude from scoring; if contextually relevant, frame only as source-specific casting context and not a quality judgement | R07, R10 | F10, F12 |
| “Bookability” | Commercial/employer/practitioner leakage | Same problem as marketability | Exclude / tightly constrain | R07, R10 | F10, F12 |
| Expensive production value | Technical/presentation language | Synthesis explicitly rejects production polish as proxy for dance quality | Treat only assessability as relevant | R03, R07 | F03, F09 |
| Studio polish | Presentation notes; professional_presentation drift | Same problem as production value | Restrict to readability / safety / brief response only | R07 | F09, F12 |
| Costume / fashion / hair / makeup preferences unless tied to safe movement or basic assessability | Presentation notes; employer-shaped style drift | Appearance and class-coded bias risk | Mention only where they materially affect movement safety or assessability | R07 | F09, F12 |
| Generic charisma / spark / presence | Acting/performance language | Too vague and easily appearance-coded | Replace with observable focus, projection, spatial command, communication through movement | R04, R13 | F04, F12 |
| Stamina claims from short clips | Strengths/improvements/fix-first | Not reliably tape-observable | Mark as live-room-only or low-confidence | R05 | F07 |
| Direction-response claims from a finished tape | Strengths/improvements/callback inference | Finished tape does not show redirection response | Mark as live-room-only or callback-only | R05 | F07, F13 |
| Importing exam-board or competition percentages as TapeCoach scoring logic | Formal descriptor / competition sources | Source-type misuse; would distort current scoring model | Use descriptors as language support only, never as TapeCoach weights | R02, R10, R11 | F01, F02, F10, F11 |

### Generic-feedback risk audit

| Generic phrase | Why it fails the evidence standard | What observable evidence would be required | Current baseline risk level | Audit recommendation ID(s) | Synthesis finding ID(s) |
|---|---|---|---|---|---|
| **good energy** | Too vague; can describe effort, dynamics or simply speed | Dynamic contrast, commitment of attack/release, phrase drive, accent pattern, spatial intent | High | R04, R13 | F02, F04 |
| **nice movement** | Says nothing about style, clarity or control | Phrase clarity, transition quality, coordination, timing and style-specific execution | High | R04, R02 | F02, F04, F14 |
| **strong performance** | Can hide generic presence language | Movement-based communication, projection, focus, stylistic conviction, phrasing or task fulfilment | High | R04, R13 | F02, F04, F12 |
| **good control** | Needs observable physical evidence | Stable landings, controlled stops, balance recovery, clear weight transfers, precise initiation/finish | High | R04, R02 | F02, F04 |
| **strong technique** | Meaning depends entirely on style | Style-specific placement, coordination, line, rhythm, clarity, weight use or rhythmic accuracy | High | R02, R04 | F02, F14 |
| **good musicality** | Often used without showing how the dancer meets the music | Timing against beat, phrasing, accent response, syncopation, breath-to-phrase relation, audible rhythmic match where relevant | High | R04, R12 | F02, F04 |
| **great presence** | Often drifts into charisma or appearance judgement | Focus, spatial command, projection, intention through movement, readable commitment to phrases | High | R04, R13 | F04, F12 |
| **expressive** | Can be empty praise unless linked to movement change | Observable dynamic shifts, focus changes, phrasing, gesture quality, projection or facial/movement congruence where visible | High | R04, R13 | F02, F04 |
| **clear style** | Needs the style named and behaviour evidenced | Named style plus specific markers: e.g. groove, line, weight flow, accent, articulation, turnout, rhythmic clarity | High | R02, R04 | F02, F10, F14 |
| **good rhythm** | Needs precise timing evidence | Beat accuracy, syncopation, accent placement, audible/readable rhythmic articulation | High | R11, R12 | F02, F11 |
| **professional tape** | Risks collapsing assessability and polish into one phrase | Assessable framing, readable full-body image, audible music, safe setup, brief response | High | R03, R07 | F03, F09, F12 |
| **confident performer** | Easily becomes a personality judgement | Committed initiation, decisive transitions, stable focus, clear phrase attack, no need to infer personality | Medium-High | R04, R13 | F04, F12 |
| **clean lines** | Only relevant in some styles and must be visible | Observable extension, placement, shape clarity, angle/readability, full-body visibility | Medium-High | R02, R03 | F02, F03 |
| **good dynamics** | Needs phrase-specific contrast evidence | Contrast between sustained and sharp qualities, rise/fall, accent, suspension, timing shape | High | R04, R13 | F02, F04 |

### Output-specificity spot audit

No example Dance outputs were supplied, so output-specificity auditing is limited to baseline wording and logic only.

RUN 0D is still useful as a **system-level specificity warning source**, but its visible sample analysis is mostly **Musical Theatre / cross-discipline**, not current Dance-report output.

## Provisional test map and DANCE-REV scope

### Provisional non-regression test map

| Audit test ID | Scenario | What should happen | What must not happen | Audit recommendation ID(s) | Synthesis finding ID(s) | Priority | Later revision / final-audit use |
|---|---|---|---|---|---|---|---|
| **DANCE-AUDIT-T01** | Full-body visibility missing | Report should mark assessability as limited and reduce confidence in technique/style claims | It must not criticise the performer’s body or make strong full-body technique claims | R03, R14 | F03, F13 | P0 | Final audit for assessability logic |
| **DANCE-AUDIT-T02** | Stable framing missing | Report should identify framing instability as a technical/assessability issue | It must not over-read timing, line or coordination as if visibility were unaffected | R03 | F03 | P0 | Final audit for video preconditions |
| **DANCE-AUDIT-T03** | Music inaudible or unclear | Report should distinguish limited music assessability from weak musicality | It must not confidently criticise rhythm or tap clarity when sound is unreliable | R03, R12 | F03, F11 | P0 | Final audit for audio/music handling |
| **DANCE-AUDIT-T04** | Smartphone / home setup but still assessable | Report should accept the setup if movement is readable | It must not penalise lack of studio environment or equipment polish | R03, R07 | F09 | P0 | Final audit for anti-polish boundary |
| **DANCE-AUDIT-T05** | Dance-only audition with no singing present | User-facing output should avoid singing/voice language | It must not display a singing-coded category label as if voice were assessed | R01 | F01, F12, F14 | P0 | Final audit for label containment |
| **DANCE-AUDIT-T06** | Generic praise without evidence | Report should be rewritten to cite observable movement/music/style evidence | It must not leave unsupported “good energy” or “strong technique” language in place | R04 | F04 | P0 | Final audit for generic-feedback suppression |
| **DANCE-AUDIT-T07** | Style-specific tape receives only a generic technique label | Report should either identify the style and use style-relevant evidence, or state that the style cannot be safely identified | It must not use one undifferentiated movement-technique label as if that were enough | R02, R13 | F02, F14 | P0 | Final audit for style specificity |
| **DANCE-AUDIT-T08** | Response to direction inferred from a finished tape | Report should mark that as live-room/callback evidence and avoid the claim | It must not infer redirection ability from the finished submission alone | R05 | F07 | P0 | Final audit for anti-overclaim logic |
| **DANCE-AUDIT-T09** | Stamina inferred from a short clip | Report should avoid stamina claims or explicitly mark them low-confidence/live-only | It must not claim endurance or full-call sustainability from a short taped excerpt | R05 | F07 | P0 | Final audit for stamina boundary |
| **DANCE-AUDIT-T10** | Disability / access need treated as deficit | Report should discuss only observable performance and assessability, with adaptation-safe language | It must not frame access need, mobility aid, seated adaptation or range difference as a negative trait | R06 | F08 | P0 | Final anti-bias audit |
| **DANCE-AUDIT-T11** | High production polish over-rewarded | Report should keep polish separate from quality unless it affects assessability or brief response | It must not convert polish, lighting quality or “professional look” into dance talent evidence | R07 | F09, F12 | P0 | Final anti-polish audit |
| **DANCE-AUDIT-T12** | Commercial / street / hip-hop wording overclaims universality | Report should qualify its wording as style-specific and evidence-limited where needed | It must not describe employer- or competition-shaped criteria as universal dance law | R10 | F10 | P1 | Final limitation-language audit |
| **DANCE-AUDIT-T13** | Tap claims made without audible evidence where audibility matters | Report should lower confidence or restrict claims to visible aspects only | It must not make strong rhythmic-clarity judgements without enough sound | R11, R12 | F11 | P1 | Final tap-evidence audit |
| **DANCE-AUDIT-T14** | Improvisation praised although no improvisation task is shown | Report should omit or qualify creativity claims unless task evidence exists | It must not infer improvisational ability from a set phrase alone | R09 | F06 | P1 | Final improvisation-scope audit |
| **DANCE-AUDIT-T15** | Training-potential language used on an employer/professional tape | Report should describe current observed readiness only, unless the context is clearly a training-route audition | It must not apply conservatoire-style potential logic universally | R08 | F05 | P1 | Final context-scope audit |

### Revision scope for DANCE-REV

| Revision target section | Why revision is needed | Recommendation ID(s) | Synthesis finding ID(s) | Type of revision required | Must preserve | Must avoid | Priority |
|---|---|---|---|---|---|---|---|
| **dance-only output display / label handling note** | Current `vocal` proxy creates misleading user-facing language | R01 | F01, F12, F14 | label-handling note / suppression guidance | Existing six-field storage model | Backend field rename or schema change | P0 |
| **movement-technique guidance** | Generic movement language is insufficiently style-aware | R02 | F02, F14 | descriptor expansion within existing framework | Shared scoring schema | One undifferentiated technique label | P0 |
| **style-specific guidance blocks** | Ballet/contemporary/jazz/tap/commercial/street/MT dance need distinct evidence cues | R02, R10, R11, R13 | F02, F10, F11, F14 | split style handling | Existing fields and weights | New score fields or imported mark bands | P0 |
| **tape assessability guidance** | Full-body visibility and readable setup need to be explicit preconditions | R03 | F03, F09, F13 | assessability threshold wording | Technical/presentation guardrails | Appearance/body critique | P0 |
| **audio/music assessability guidance** | Dance musicality and tap/rhythm need clearer audio-conditioned handling | R03, R11, R12 | F03, F11 | evidence-scope / confidence wording | Existing audio field and caps | Treating all poor sound as weak performance | P0 |
| **performance/artistry guidance** | Shared acting/performance language needs a movement-based frame | R09, R13 | F06, F12, F14 | tighten descriptor language | Expression/communication evidence | Theatre-acting leakage or charisma language | P1 |
| **strengths language** | Current baseline still permits generic praise | R04 | F04 | evidence-anchor requirement | Max 3 strengths | Generic praise phrases | P0 |
| **improvements language** | Improvement notes need stronger evidence anchors and claim-scope boundaries | R04, R05 | F04, F07 | evidence-anchor + live-only caveat | Max 3 improvements | Generic or over-claiming coaching | P0 |
| **fix-first logic** | Highest-impact advice must remain tape-specific and not overclaim live-only capacities | R04, R05 | F04, F07, F13 | fix-first guidance revision | Fix-first structure | Generic “work on confidence” or live-only inference | P0 |
| **timestamp note rules** | Dance-specific evidence density is not currently guaranteed | R14 | F04, F13 | timestamp expectation wording | Max 8 notes; chronological logic | Padding, invented timestamps, low-value notes | P0 |
| **professional_presentation guidance** | Dance needs tighter anti-polish and anti-marketability limits | R07 | F09, F12 | boundary clarification | Existing assessability-first intent | Glamour / bookability / polish leakage | P0 |
| **exclusion / anti-bias rules** | Current anti-bias logic must be made more explicit for dance | R06, R07 | F08, F09, F12 | exclusion block tightening | Existing fairness guardrails | Capability or appearance inference | P0 |
| **live-only confidence caveat language** | Pick-up, stamina and response-to-direction need firm claim-scope limits | R05, R08, R09, R10, R11 | F05, F06, F07, F10, F11, F13 | claim-scope clarification | Confidence/reliability framework | High-confidence live-only claims from tape | P0 |

### Open risks and deferred issues

| Issue | Why it remains open | Recommendation ID(s), if any | Can DANCE-REV proceed anyway? | Carry as limitation or defer? | Note |
|---|---|---|---|---|---|
| **Vocal-proxy structural risk** | The stored shared field still exists and real field renaming is out of scope | R01 | **Yes** | Carry as limitation and presentation-handling note | DANCE-REV can contain the user-facing harm without changing architecture |
| **Dance-only user-facing label risk** | Actual current UI label-helper code was not supplied | R01 | **Yes** | Carry as limitation and revision target | Wording audit is complete; implementation audit remains partial |
| **Universal commercial / street / hip-hop descriptors remain limited** | Evidence improved but remains partly employer-/competition-shaped | R10 | **Yes** | Carry as limitation | Use cautious wording in DANCE-REV |
| **Tap limits outside exam-board evidence** | Strong descriptor base, thinner broader-public tape evidence | R11, R12 | **Yes** | Carry as limitation | No reason to block DANCE-REV |
| **Pickup speed as formal descriptor versus live-room process** | Still stronger as process evidence than universal descriptor | R05 | **Yes** | Carry as limitation | Major caution area |
| **Stamina overclaim boundaries** | Synthesis supports caution more strongly than positive scoring language | R05 | **Yes** | Carry as limitation | Do not build stamina-positive rhetoric into Dance wording |
| **Tape-observable direction response** | Still not formally codified as tape-observable in the evidence base | R05 | **Yes** | Carry as limitation | Must remain live-room/callback-biased |
| **Exact current UI/render behaviour for Dance** | Label helpers and renderer/export specifics were not supplied | R01, R14 | **Yes** | Defer implementation audit; proceed with wording audit | No need to block DANCE-REV |
| **No current Dance report examples supplied** | Output-specific spot audit cannot test real dance phrasing | R14 | **Yes** | Carry as limitation | DANCE-REV should proceed; final audit should test live examples |
| **Dance-only category labelling / user-facing vocal proxy issue** | The problem is larger than wording alone | R01 | **Yes** | Carry into later revision/final audit | High-priority open risk, but not a blocker to DANCE-REV |

## Reusable handoff pack for DANCE-REV

### DANCE-AUDIT handoff summary

The Dance audit is complete and the baseline is now clearly mapped against the completed Dance synthesis. The strongest audit conclusion is that the current Dance baseline is **not wrongly directed**, but it is still **too generic, too shared-schema-shaped, and too weakly bounded** for evidence-led Dance reporting unless it is revised before rollout. The two biggest structural pressures are already acknowledged by the baseline itself: first, Dance still relies on the shared six-field architecture; second, the current `vocal` field is still being used as a movement-technique proxy, which creates immediate user-facing label risk in dance-only situations. That issue is real, but it is also partly architectural, so DANCE-REV should address it first through wording, user-facing label handling and exclusion rules rather than through schema change.

The highest-priority content issue is **style specificity**. The synthesis supports different evidence vocabularies for ballet, contemporary, jazz/modern theatre, tap, commercial, street/hip-hop and MT dance, while the current baseline still operates largely through a generic movement bucket. The second high-priority issue is **assessability**. Full-body visibility, stable framing, readable space, audible music and low-edit setup are not aesthetic preferences; they are preconditions for fair dance judgement from tape. The baseline currently gestures towards that, but does not yet codify it strongly enough.

The third high-priority issue is **claim scope**. The current baseline does not yet ring-fence live-room-only capacities tightly enough. Choreography pick-up, response to direction, adaptability, workshop behaviour and long-day stamina should be treated as live-room or callback evidence unless directly shown. The fourth is **accessibility-safe assessment**. Existing anti-penalisation language is useful, but DANCE-REV must separate process adaptation from attainment much more explicitly and block capability, medical-history and access-need inference.

None of the remaining issues block DANCE-REV. The most important limitations to carry forward are: the structural vocal-proxy risk, universal commercial/street/hip-hop descriptor limits, tap limits outside exam-board evidence, and the absence of actual current Dance report examples for spot-auditing.

### Compact audit recommendation summary

| Recommendation ID | Recommendation title | Priority |
|---|---|---|
| DANCE-AUDIT-R01 | Contain the dance-only vocal proxy in user-facing language | P0 |
| DANCE-AUDIT-R02 | Add style-specific dance guidance blocks inside the existing framework | P0 |
| DANCE-AUDIT-R03 | Codify dance tape assessability preconditions and confidence-lowering rules | P0 |
| DANCE-AUDIT-R04 | Force evidence anchors in all dance praise and criticism | P0 |
| DANCE-AUDIT-R05 | Mark pick-up, direction response, adaptability and stamina as live-room-only or low-confidence | P0 |
| DANCE-AUDIT-R06 | Clarify accessibility-safe dance assessment as adaptation without deficit inference | P0 |
| DANCE-AUDIT-R07 | Tighten professional_presentation to assessability, brief response and safe preparation only | P0 |
| DANCE-AUDIT-R08 | Separate training-potential language from present-tape judgement | P1 |
| DANCE-AUDIT-R09 | Constrain improvisation and creative-response comments to task-present evidence | P1 |
| DANCE-AUDIT-R10 | Add a caution block for commercial, street and hip-hop wording | P1 |
| DANCE-AUDIT-R11 | Add tap-specific audibility and evidence caveats | P1 |
| DANCE-AUDIT-R12 | Separate audio/music assessability from weak musicality claims | P0 |
| DANCE-AUDIT-R13 | Reframe dance acting/performance language as movement-based expression and communication | P1 |
| DANCE-AUDIT-R14 | Strengthen dance timestamp expectations and reliability fallback | P0 |

### Compact issue register

| Issue ID | Issue title | Severity |
|---|---|---|
| DANCE-AUDIT-I01 | Dance-only vocal proxy and label ambiguity | Critical |
| DANCE-AUDIT-I02 | Style-specific dance technique is under-specified | Critical |
| DANCE-AUDIT-I03 | Dance video assessability conditions are incomplete | Critical |
| DANCE-AUDIT-I04 | Generic dance feedback is not sufficiently blocked | Critical |
| DANCE-AUDIT-I05 | Live-room-only capacities are not ring-fenced | Critical |
| DANCE-AUDIT-I06 | Accessibility-safe assessment is only partially codified | Critical |
| DANCE-AUDIT-I07 | Professional presentation and production-value boundaries are too loose | High |
| DANCE-AUDIT-I08 | Training potential and current observed level are not cleanly separated | High |
| DANCE-AUDIT-I09 | Improvisation and creative response are not tied to task-present evidence | High |
| DANCE-AUDIT-I10 | Commercial, street and hip-hop wording risks over-generality | High |
| DANCE-AUDIT-I11 | Tap evidence limits are under-specified | Medium |
| DANCE-AUDIT-I12 | Audio and music assessability are not clearly separated from performance quality | High |
| DANCE-AUDIT-I13 | Acting, performance and artistry language remains overloaded in dance | High |
| DANCE-AUDIT-I14 | Dance timestamp specificity is not guaranteed | High |

### Provisional non-regression test map

The most important provisional tests to carry into DANCE-REV and later final audit are:

- **T01–T04:** assessability and anti-polish boundaries
- **T05:** dance-only no-singing label containment
- **T06–T07:** generic-feedback suppression and style specificity
- **T08–T10:** live-room-only and anti-bias controls
- **T11–T13:** production-value, commercial/street overclaim and tap audibility boundaries
- **T14–T15:** improvisation scope and training-potential scope

### What was and was not auditable from supplied materials

**Auditable from supplied materials**
- the current Dance baseline slice
- preserve/do-not-touch constraints
- shared-score-field logic
- known Dance gaps and uncertainties
- current report structure and genericity risks
- the current explicit dance-only label warning
- current output-specificity risks at system level
- the completed DANCE-SYN evidence priorities

**Not fully auditable from supplied materials**
- exact current frontend label-helper implementation
- exact current comparison-page label-helper implementation
- current dance renderer/export behaviour
- current actual Dance report outputs
- whether any partial subtype extraction is already live in production beyond what the baseline summaries state

### Source IDs and synthesis finding IDs used as the evidence basis

This audit was grounded in:
- **DANCE-SYN-F01 to DANCE-SYN-F14**
- Primary source families carried through those findings, especially:
  - admissions / schools: **DANCE-S009, DANCE-S010, DANCE-S014, DANCE-S023, DANCE-S034**
  - formal descriptors: **DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043**
  - professional / inclusive / self-tape sources: **DANCE-S056, DANCE-S064, DANCE-S065, DANCE-S066, DANCE-S067, DANCE-S068**
  - employer sources: **DANCE-S057, DANCE-S069, DANCE-S070, DANCE-S071, DANCE-S072**
  - comparator caution sources: **DANCE-S044, DANCE-S051, DANCE-S053**

The baseline side of the audit was grounded in:
- **0B — Dance rubric slice**
- **0E — Baseline Guardrail Pack**
- **0C — Current Process and Rubric Baseline Audit**
- **0D — Current Output Specificity Stress Test**
- supported by **0A-RECONCILE** and **0 — GPT Rubric Control Sheet**

### Completion statement

**DANCE-AUDIT complete. Ready for DANCE-REV.**

---

## Links

- **Previous:** [[drr-dance-06-synthesis]] — Synthesis
- **Next:** [[drr-dance-08-revision]] — Synthesis Revision
- **Thread overview:** [[drr-dance-overview]]
- **Programme:** [[drr-programme-overview]]
