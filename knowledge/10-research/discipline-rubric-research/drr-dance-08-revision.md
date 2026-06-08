---
id: drr-dance-08-revision
title: Dance — Synthesis Revision
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/2.Dance/D-Syn-Revision.md"
discipline: dance
monday_ref: null
tags: [discipline-rubric-research, dance, stage-revision]
confidence: medium
created: 2026-05-04
imported: 2026-06-08
updated: 2026-06-08
---

# Dance — Synthesis Revision

> **Imported research — Discipline Rubric Research programme.** Step 8 of 13 in the Dance thread (`stage-revision`). Original file: `2.Dance/D-Syn-Revision.md`. Original date: 2026-05-04 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-dance-overview]].

---

# Dance Baseline Revision Package

## Readiness and inputs

The revision can proceed. The supplied materials are sufficient to revise the Dance baseline at wording, guardrail and presentation-guidance level because the inline 0B/0E texts are present, and the supporting control materials confirm the implemented shared six-field schema, the vocal-field overload, the absence of a true Dance movement rubric, the shared report structure, and the current specificity and timestamp risks that the audit is trying to correct. fileciteturn0file3 fileciteturn0file0 fileciteturn0file1 fileciteturn0file2

**Revision Readiness Check**

| Check | Result | Caveat |
|---|---|---|
| 0B present | Yes | Supplied inline in the prompt; revisable directly |
| 0E present | Yes | Supplied inline in the prompt; revisable directly |
| 0C present | Yes | Attached and loaded; used as baseline-behaviour evidence |
| 0D present | Yes | Attached and loaded; used as specificity-risk evidence |
| 0A present | Yes | Attached and loaded; used to reconcile design memory with implementation |
| 0 present | Yes | Attached and loaded; used as control reference for current rubric behaviour |
| Completed DANCE-AUDIT handoff present | Yes | Supplied inline in the prompt |
| Source IDs normalised | Yes | All synthesis/source references below use DANCE-S001–DANCE-S072 format |
| Revision may proceed | Yes | With explicit residual limitations around unseen frontend/renderer behaviour |

**Revision Input Register**

| Input item | Type | Present? | Used in revision? | Role in revision | Limitation / note |
|---|---|---:|---:|---|---|
| 0B — Dance rubric slice | Primary baseline text | Yes | Yes | Direct revision root for Dance-specific rubric wording | Supplied inline only; no direct frontend helper text included |
| 0E — Baseline Guardrail Pack | Primary baseline text | Yes | Yes | Direct revision root for preserve rules, specificity rules, scoring guardrails and regression risks | Supplied inline only; no implementation layer exposed |
| 0C — Current Process and Rubric Baseline Audit | Baseline evidence / control | Yes | Yes | Confirms current schema, current process and current Dance weaknesses | Behavioural evidence, not replacement rubric text |
| 0D — Current Output Specificity Stress Test | Baseline evidence / control | Yes | Yes | Confirms genericity, missing evidence anchors, timestamp weakness and false-specificity risks | No current Dance report examples were supplied |
| 0A — RECONCILE | Reconciliation / control | Yes | Yes | Confirms implemented vocal overload and Dance proxy handling against remembered design intent | Highlights architecture pressures but does not solve them |
| 0 — GPT Rubric Control Sheet | Control reference | Yes | Yes | Confirms preserve rules, report structure, timestamp expectations and current category semantics | Some statements are remembered/control-level rather than direct code extracts |
| DANCE-AUDIT handoff | Audit traceability input | Yes | Yes | Drives revision priorities, issue IDs, recommendation IDs and residual limits | Supplied inline; not a baseline text to edit |
| DANCE-SYN findings via audit handoff | Synthesis evidence basis | Yes | Yes | Provides evidence rationale for each revision change | No new synthesis work performed in this run |

**Revision Scope and Preservation Rules**

This revision covers wording, guidance, evidence standards, confidence handling, exclusion rules and style-specific Dance reporting inside the existing six-field framework. It revises supplied baseline text where text exists in 0B and 0E, and it adds clearly labelled Dance addenda where the supplied baseline does not yet contain an adequate section for the required behaviour.

The texts actually revised in substance are 0B and 0E. The texts used as control and justification rather than replacement rubric wording are 0C, 0D, 0A and 0. This matters because 0C and 0D document current behaviour and current failure modes, but they are not themselves the production rubric. fileciteturn0file0 fileciteturn0file1

This revision intentionally defers anything that would require backend, schema, UI or renderer implementation work. That includes the exact current frontend label-helper implementation, comparison-page label-helper behaviour, render/export behaviour for Dance reports, and whether any partial subtype extraction is already live beyond what the summaries describe. Those items remain final-audit or implementation-adjacent checks rather than revision text edits. fileciteturn0file3 fileciteturn0file0

The following must remain preserved and unchanged: the six stored score fields, Dance weights, caps, blockers, verdict thresholds, role-fit bounds, server-side recomputation, Step 1 evidence pass, Step 2 text-only polish, locked-field enforcement, report schema, public JSON structure, data flow, safety/material/accessibility scrub layers, and the stabilised Musical Theatre acting-plus-song anchor. fileciteturn0file2 fileciteturn0file0

## Traceability from audit to revision

The traceability below is grounded in the confirmed baseline reality that Dance is currently routed through the shared schema, that the stored vocal field is overloaded across singing, speech and dance technique, and that current specificity failures are strongest where the report lacks subtype rules, assessability preconditions and evidence anchors. fileciteturn0file3 fileciteturn0file0 fileciteturn0file1

**Audit Recommendation-to-Revision Matrix**

| Audit recommendation ID | Short recommendation title | Affected baseline component or section | Current baseline text / behaviour / assumption actually revised | Revision status | Why this status was assigned | Proposed revision action | DANCE-AUDIT issue ID(s) | DANCE-SYN finding ID(s) | Source ID(s) | Priority | Revision change ID(s) | Residual caution / defer note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DANCE-AUDIT-R01 | Contain the dance-only vocal proxy in user-facing language | 0B Dance rubric slice; 0E scoring guardrails; addendum | 0B states that vocal is reused as a movement-technique proxy and that the label is misleading unless renamed or hidden | Partially addressed | Wording and guardrails can be revised, but exact frontend label-helper logic is unseen | Add explicit dance-only user-facing label containment text and block voice/singing wording where singing is absent | DANCE-AUDIT-I01 | DANCE-SYN-F01, F12, F14 | DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068 | P0 | DANCE-REV-C01 | Residual architecture risk remains until actual label rendering is checked |
| DANCE-AUDIT-R02 | Add style-specific dance guidance blocks inside the existing framework | 0B Dance rubric slice; addendum | Current baseline says feedback should be style-aware if style is detected or briefed, but confirms no formal subtype handling | Fully addressed | Baseline wording can support style-specific handling without changing schema | Add explicit style-aware guidance for ballet, contemporary, jazz/modern theatre, tap, commercial, street/hip-hop and MT dance | DANCE-AUDIT-I02 | DANCE-SYN-F02, F10, F11, F14 | DANCE-S023, DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043, DANCE-S044, DANCE-S069 | P0 | DANCE-REV-C02 | Actual subtype-detection coverage remains a final-audit limitation |
| DANCE-AUDIT-R03 | Codify dance tape assessability preconditions and confidence-lowering rules | 0B Dance rubric slice; 0E specificity/scoring guardrails | Current baseline mentions visibility and assessability but has no confirmed full-body visibility rubric | Fully addressed | Adequate text exists to tighten assessability expectations and reliability fallback | Add preconditions for full-body readability, stable framing, audible music, sufficient space, simple capture and minimal editing; require lower confidence when limited | DANCE-AUDIT-I03 | DANCE-SYN-F03, F09, F13 | DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068 | P0 | DANCE-REV-C03 | Actual renderer/export behaviour remains unseen |
| DANCE-AUDIT-R04 | Force evidence anchors in all dance praise and criticism | 0E specificity guardrails; Dance report-language addendum | 0D shows generic praise patterns and missing evidence-anchor requirements | Fully addressed | The problem is textual and guidance-based, so the revision can directly tighten it | Require timestamps, task references, style descriptors or assessability anchors in all substantive Dance praise/criticism | DANCE-AUDIT-I04 | DANCE-SYN-F04 | DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S053, DANCE-S064 | P0 | DANCE-REV-C04 | Enforcement quality still depends on final-audit testing |
| DANCE-AUDIT-R05 | Mark pick-up, direction response, adaptability and stamina as live-room-only or low-confidence | Addendum; 0B discipline logic | Current baseline does not ring-fence live-room-only Dance capacities tightly enough | Fully addressed | This is a wording and claim-scope issue | Add explicit live-room/callback-only guidance and prohibit confident inference from finished Dance tapes unless directly shown | DANCE-AUDIT-I05 | DANCE-SYN-F07, F13 | DANCE-S057, DANCE-S061, DANCE-S071, DANCE-S072 | P0 | DANCE-REV-C05 | Some task-specific exceptions may apply where the tape visibly includes these capacities |
| DANCE-AUDIT-R06 | Clarify accessibility-safe dance assessment as adaptation without deficit inference | 0B; 0E scoring guardrails; new addendum | Baseline already says do not penalise disability or mobility aids, but separation of adaptation from attainment is not explicit enough | Fully addressed | Enough baseline text exists to tighten this substantially | Add explicit adaptation-without-deficit language and block capability, medical-history and access-need inference | DANCE-AUDIT-I06 | DANCE-SYN-F08 | DANCE-S039, DANCE-S046, DANCE-S064, DANCE-S065, DANCE-S066 | P0 | DANCE-REV-C06 | Existing accessibility-safe physicality rules are preserved, not rewritten structurally |
| DANCE-AUDIT-R07 | Tighten professional_presentation to assessability, brief response and safe preparation only | 0B report-sections guidance; 0E scoring guardrails | Current presentation/professional language is too loose and can drift toward polish or look | Fully addressed | This is primarily a wording-boundary issue | Redefine Dance professional_presentation around assessability, brief response and safe preparation only; exclude glamour, polish and look logic | DANCE-AUDIT-I07 | DANCE-SYN-F09, F12 | DANCE-S057, DANCE-S064, DANCE-S067, DANCE-S068, DANCE-S069 | P0 | DANCE-REV-C07 | Employer-specific attire or look demands remain contextual only, not universal |
| DANCE-AUDIT-R08 | Separate training-potential language from present-tape judgement | Addendum | Current baseline does not clearly separate admissions-language potential from present-tape judgement | Fully addressed | This can be handled through a scope note | Limit training-potential language to training-route contexts and keep employer/professional tape feedback grounded in present observation | DANCE-AUDIT-I08 | DANCE-SYN-F05 | DANCE-S004, DANCE-S008, DANCE-S011, DANCE-S025, DANCE-S030 | P1 | DANCE-REV-C08 | Context detection still matters in final audit |
| DANCE-AUDIT-R09 | Constrain improvisation and creative-response comments to task-present evidence | Addendum; style-specific handling | Current baseline lacks a clear task-present rule for creative-response claims | Fully addressed | This is directly revisable in guidance text | Allow improvisation/creative-response comments only when the task or tape visibly includes them | DANCE-AUDIT-I09 | DANCE-SYN-F06 | DANCE-S001, DANCE-S014, DANCE-S015, DANCE-S041, DANCE-S064, DANCE-S069 | P1 | DANCE-REV-C09 | Expressiveness may still be discussed, but not generic creativity without task evidence |
| DANCE-AUDIT-R10 | Add a caution block for commercial, street and hip-hop wording | Addendum | Current baseline has no codified caution despite evidence being partly employer-shaped/competition-shaped | Partially addressed | Wording can be tightened, but universal descriptors still remain a limitation | Add caution language requiring tape-specific description and blocking universalised claims | DANCE-AUDIT-I10 | DANCE-SYN-F10, F14 | DANCE-S044, DANCE-S053, DANCE-S069, DANCE-S070, DANCE-S071 | P1 | DANCE-REV-C10 | Evidence base remains partly employer-shaped or competition-shaped |
| DANCE-AUDIT-R11 | Add tap-specific audibility and evidence caveats | Addendum; audio/music guidance | Current baseline has no tap audibility caveat despite tap’s dependence on audible rhythmic evidence | Partially addressed | Wording can be revised, but wider tap evidence remains thin | Add explicit tap audibility caveat and limit strong claims when relevant sound is not assessable | DANCE-AUDIT-I11 | DANCE-SYN-F11 | DANCE-S043, DANCE-S051 | P1 | DANCE-REV-C11 | Public admissions/employer tap evidence remains lighter than exam-board evidence |
| DANCE-AUDIT-R12 | Separate audio/music assessability from weak musicality claims | 0B; 0E scoring guardrails | Current baseline does not cleanly distinguish audio problems from weak musicality claims | Fully addressed | This is a guidance and claim-scope issue | Add separate audio/music assessability wording and prohibit musicality criticism where audibility is inadequate | DANCE-AUDIT-I12 | DANCE-SYN-F03, F11 | DANCE-S010, DANCE-S034, DANCE-S043, DANCE-S067, DANCE-S068 | P0 | DANCE-REV-C12 | Existing audio caps remain unchanged |
| DANCE-AUDIT-R13 | Reframe dance acting/performance language as movement-based expression and communication | 0B feedback specificity; addendum | Current Dance language risks overusing general acting/performance terms | Fully addressed | The baseline can be revised at wording level | Reframe performance language as movement-based expression, projection, communication and intention | DANCE-AUDIT-I13 | DANCE-SYN-F02, F04, F14 | DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043, DANCE-S069 | P1 | DANCE-REV-C13 | The stored acting field still remains architecture-shaped |
| DANCE-AUDIT-R14 | Strengthen dance timestamp expectations and reliability fallback | 0E specificity guardrails; Dance addendum | 0D documents under-produced timestamps and thin evidence anchors | Partially addressed | The baseline wording can force stronger expectations, but actual render/export behaviour is unseen | Add Dance note-density expectations, category-link expectations and a reliability fallback when assessability limits note production | DANCE-AUDIT-I14 | DANCE-SYN-F03, F04, F13 | DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068 | P0 | DANCE-REV-C14 | Final audit must test persisted-versus-rendered note counts |

## Revision sections and wording

The section package below revises only what is actually present in 0B/0E or adds clearly labelled Dance addenda where the supplied baseline did not yet contain adequate text. The rationale is consistent across the supporting baseline materials: Dance is currently the highest-risk discipline because it lacks a true movement-specific rubric, uses the stored vocal field as a proxy for technique, remains vulnerable to generic wording, and has underdeveloped assessability and timestamp rules. fileciteturn0file3 fileciteturn0file0 fileciteturn0file1

**Section-by-Section Revision Package**

**DANCE-REV-S01 — Dance-only category label containment**  
**Baseline source section:** 0B  
**Current baseline excerpt actually being revised:**  
> Operationally, vocal is reused as a movement-technique proxy for dance, which is a known risk.  
> “Vocal” label is misleading unless renamed or hidden.

**Proposed revised text:**  
> In Dance, the stored vocal field may continue to operate internally as the movement-technique slot, but user-facing Dance reports must not present that category as singing, voice or generic vocal performance unless singing is actually present in the tape. In dance-only reports, the user-facing interpretation of that category should be movement technique or dance technique within the current shared framework. Where singing is absent, do not describe the performer as vocally strong or weak.

**Change summary:** Contains the vocal-proxy risk through wording and user-facing interpretation without proposing field or schema change.  
**Audit recommendation ID(s):** DANCE-AUDIT-R01  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I01  
**DANCE-SYN finding ID(s):** DANCE-SYN-F01, DANCE-SYN-F12, DANCE-SYN-F14  
**Source ID(s):** DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068  
**Change type label(s):** tighten descriptor language; exclude / block language; out of scope for current architecture  
**Preserve note:** Stored fields, weights, schema and pipeline remain unchanged.  
**Must avoid note:** No backend field rename; no new score field.  
**Residual limitation:** Actual frontend/category helper behaviour is not directly revisable from supplied materials.

**DANCE-REV-S02 — Movement-technique and style-specific handling**  
**Baseline source section:** 0B plus addendum  
**Current baseline excerpt actually being revised:**  
> Feedback should be style-aware if the style is detected or briefed, but current implementation does not confirm dance subtype extraction.  
> No confirmed ballet/jazz/tap/contemporary/commercial/hip-hop/MT dance subtype handling.

**Proposed revised text:**  
> Dance notes must be style-aware wherever the brief, task or tape makes the style reasonably identifiable. Use the most specific supported style label available: ballet, contemporary/modern, jazz/modern theatre, tap, commercial dance, street/hip-hop, or MT dance. If style is mixed, uncertain or only partly inferable, say so and keep language to observable shared domains rather than guessing. Shared domains include placement/posture, coordination, control, clarity, rhythm/timing, musical responsiveness, use of space, line where relevant, and movement-based expression/communication. Do not use one undifferentiated movement-technique label across all Dance tapes.

**Change summary:** Adds style-specific handling inside the existing shared framework.  
**Audit recommendation ID(s):** DANCE-AUDIT-R02  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I02  
**DANCE-SYN finding ID(s):** DANCE-SYN-F02, DANCE-SYN-F10, DANCE-SYN-F11, DANCE-SYN-F14  
**Source ID(s):** DANCE-S023, DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043, DANCE-S044, DANCE-S069  
**Change type label(s):** split style handling; tighten descriptor language  
**Preserve note:** Existing shared fields remain the same.  
**Must avoid note:** No claim that subtype extraction is already fully implemented.  
**Residual limitation:** Final audit must check how unknown or mixed-style tapes are rendered in practice.

**DANCE-REV-S03 — Dance tape assessability and confidence fallback**  
**Baseline source section:** 0B and 0E  
**Current baseline excerpt actually being revised:**  
> Notes should focus on timing, control, musicality, transitions, energy, intention and whether movement is assessable.  
> No confirmed full-body visibility rubric.

**Proposed revised text:**  
> Strong Dance judgement from tape depends first on assessability. The report should treat head-to-toe or otherwise task-sufficient movement visibility, stable framing, readable space, audible music where relevant, low-edit continuity and safe/reasonably readable setup as preconditions for high-confidence movement judgement. If one or more of these conditions is materially limited, narrow the claim, state the assessability limitation plainly, and lower feedback reliability rather than substituting generic criticism or inflated certainty.

**Change summary:** Converts vague assessability language into explicit preconditions plus a fallback rule.  
**Audit recommendation ID(s):** DANCE-AUDIT-R03  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I03  
**DANCE-SYN finding ID(s):** DANCE-SYN-F03, DANCE-SYN-F09, DANCE-SYN-F13  
**Source ID(s):** DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068  
**Change type label(s):** require evidence anchor; lower confidence when assessability is limited; constrain claim scope  
**Preserve note:** No change to existing reliability labels; only stronger usage guidance.  
**Must avoid note:** No production-value requirement.  
**Residual limitation:** Final audit must still check rendered technical-visibility notes and confidence behaviour.

**DANCE-REV-S04 — Audio and music assessability including tap audibility**  
**Baseline source section:** addendum  
**Current baseline excerpt actually being revised:**  
> The system should assess observable movement performance, musicality, clarity, control and visibility only within the existing fields.

**Proposed revised text:**  
> Separate audio/music assessability from musical quality. Use audio language to describe whether music, counts or relevant rhythmic output are audible enough to support fair assessment. Do not infer weak musicality from poor playback, low recording level or unclear accompaniment where the performer’s rhythmic relationship cannot be heard reliably. For tap, do not make strong positive or negative rhythmic-clarity claims unless the relevant footwork sound is sufficiently audible.

**Change summary:** Distinguishes audibility from performance quality and adds a tap-specific caveat.  
**Audit recommendation ID(s):** DANCE-AUDIT-R12, DANCE-AUDIT-R11  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I12, DANCE-AUDIT-I11  
**DANCE-SYN finding ID(s):** DANCE-SYN-F03, DANCE-SYN-F11  
**Source ID(s):** DANCE-S010, DANCE-S034, DANCE-S043, DANCE-S067, DANCE-S068, DANCE-S051  
**Change type label(s):** constrain claim scope; lower confidence when assessability is limited; carry as limitation  
**Preserve note:** Audio weighting, caps and blockers remain unchanged.  
**Must avoid note:** No claim that inaudible tap equals poor tap.  
**Residual limitation:** Tap remains better evidenced in exam-board language than in public employer/admissions sources.

**DANCE-REV-S05 — Movement-based expression, performance and communication**  
**Baseline source section:** 0B plus addendum  
**Current baseline excerpt actually being revised:**  
> The system should assess observable movement performance, musicality, clarity, control and visibility only within the existing fields.

**Proposed revised text:**  
> In Dance, performance language must be movement-based. Use expression, projection, communication, intention or performance quality only where those ideas are visible through phrasing, dynamic contrast, focus, attack/release, spatial intention, relation to music, or relation to choreographic task. Avoid theatre-acting wording unless spoken acting is actually present. Avoid generic presence language unless it is tied to a visible movement choice.

**Change summary:** Reframes Dance performance language away from generic acting terms and toward observable movement communication.  
**Audit recommendation ID(s):** DANCE-AUDIT-R13  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I13  
**DANCE-SYN finding ID(s):** DANCE-SYN-F02, DANCE-SYN-F04, DANCE-SYN-F14  
**Source ID(s):** DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043, DANCE-S069  
**Change type label(s):** tighten descriptor language; constrain claim scope  
**Preserve note:** The stored acting field remains unchanged.  
**Must avoid note:** No suggestion that Dance performance equals spoken acting.  
**Residual limitation:** Stored score semantics remain shared-schema-shaped.

**DANCE-REV-S06 — Professional presentation and production-value boundary**  
**Baseline source section:** 0B and 0E  
**Current baseline excerpt actually being revised:**  
> presentation only if camera-readability affects assessability.  
> Professional Presentation is one of the current shared score fields.

**Proposed revised text:**  
> In Dance, professional_presentation should be limited to assessability, brief response and safe preparation. Valid grounds include whether the tape is readable enough to judge, whether stated task requirements were followed, and whether preparation choices helped or hindered safe, fair assessment. It must not reward glamour, physique, expensive production, studio polish, domestic set transformation, hair/makeup or employer-specific look rules as general dance merit. Smartphone or home capture may be fully acceptable if the movement remains readable.

**Change summary:** Tightens professional-presentation language and blocks production-polish bias.  
**Audit recommendation ID(s):** DANCE-AUDIT-R07  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I07  
**DANCE-SYN finding ID(s):** DANCE-SYN-F09, DANCE-SYN-F12  
**Source ID(s):** DANCE-S057, DANCE-S064, DANCE-S067, DANCE-S068, DANCE-S069  
**Change type label(s):** clarify professional_presentation boundary; exclude / block language  
**Preserve note:** No change to the stored professional_presentation field or weighting.  
**Must avoid note:** No employer physique/look logic as universal standard.  
**Residual limitation:** Actual UI label behaviour is still a final-audit check.

**DANCE-REV-S07 — Accessibility-safe adaptation and anti-bias protections**  
**Baseline source section:** 0B, 0E and addendum  
**Current baseline excerpt actually being revised:**  
> It must not penalise disability, mobility aids, reduced range of motion or seated adaptation.  
> Safety and fairness guardrails must be preserved.

**Proposed revised text:**  
> Dance assessment must separate process adaptation from attainment. Access needs, mobility aids, seated adaptation, reduced range, bespoke training pathways, CV gaps, convalescence, body type, appearance, and pace-of-learning differences must not be treated as deficits in themselves. Where a task is adapted to body or access need, judge only what is shown and how clearly it communicates the task. Do not infer injury status, medical history, capability ceiling or lack of professionalism from appearance, support equipment or visible adaptation.

**Change summary:** Makes the anti-inference rule explicit and operational.  
**Audit recommendation ID(s):** DANCE-AUDIT-R06  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I06  
**DANCE-SYN finding ID(s):** DANCE-SYN-F08  
**Source ID(s):** DANCE-S039, DANCE-S046, DANCE-S064, DANCE-S065, DANCE-S066  
**Change type label(s):** clarify accessibility boundary; exclude / block language  
**Preserve note:** Existing safety and fairness scrubs remain unchanged.  
**Must avoid note:** No diagnostic, capability or deficit language.  
**Residual limitation:** Final audit should still check interaction with existing accessibility scrub layers.

**DANCE-REV-S08 — Live-room-only and low-confidence claim boundaries**  
**Baseline source section:** addendum  
**Current baseline excerpt actually being revised:**  
> The system should assess observable movement performance, musicality, clarity, control and visibility only within the existing fields.

**Proposed revised text:**  
> Treat choreography pick-up, response to direction, adaptability after feedback, workshop behaviour, callback responsiveness, interview readiness and long-day stamina as mainly live-room or callback evidence unless the tape directly shows those capacities. Where such evidence is not directly shown, mark the capacity as not assessable or low-confidence rather than inferring it from a finished tape. Do not claim stamina from a short clip alone. Do not claim response to direction from a finished take alone.

**Change summary:** Hardens the boundary between tape-observable and live-room-only capacities.  
**Audit recommendation ID(s):** DANCE-AUDIT-R05  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I05  
**DANCE-SYN finding ID(s):** DANCE-SYN-F07, DANCE-SYN-F13  
**Source ID(s):** DANCE-S057, DANCE-S061, DANCE-S071, DANCE-S072  
**Change type label(s):** mark live-room-only; constrain claim scope  
**Preserve note:** No changes to core scoring architecture.  
**Must avoid note:** No overclaim from polished finished tape.  
**Residual limitation:** Some audition videos may directly include learning/redirection tasks; those remain task-specific exceptions.

**DANCE-REV-S09 — Training potential and task-specific creative scope**  
**Baseline source section:** addendum  
**Current baseline excerpt actually being revised:**  
> Dance is supported as an audition type, but there is no confirmed true dance-technique rubric.

**Proposed revised text:**  
> Training-potential language should be reserved to training-route contexts where the admissions-style task and source logic justify it. In employer or professional-first-round contexts, prioritise present observable level in this tape. Improvisation and creative response may be assessed only where the task or tape clearly includes improvisation, creative tasking or open material. Do not describe a non-improvisation tape as creative merely because it feels expressive.

**Change summary:** Separates admissions logic from employer judgement and limits creative-language overreach.  
**Audit recommendation ID(s):** DANCE-AUDIT-R08, DANCE-AUDIT-R09  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I08, DANCE-AUDIT-I09  
**DANCE-SYN finding ID(s):** DANCE-SYN-F05, DANCE-SYN-F06  
**Source ID(s):** DANCE-S004, DANCE-S008, DANCE-S011, DANCE-S025, DANCE-S030, DANCE-S001, DANCE-S014, DANCE-S015, DANCE-S041, DANCE-S064, DANCE-S069  
**Change type label(s):** constrain claim scope; carry as limitation  
**Preserve note:** No new training-potential score field.  
**Must avoid note:** No general employer use of admissions-style potential language.  
**Residual limitation:** Context detection still needs final-audit checking.

**DANCE-REV-S10 — Commercial, street and hip-hop caution**  
**Baseline source section:** addendum  
**Current baseline excerpt actually being revised:**  
> no confirmed ballet/jazz/tap/contemporary/commercial/hip-hop/MT dance subtype handling.

**Proposed revised text:**  
> Commercial, street and hip-hop wording must remain tape-specific and cautious. Describe observable groove, phrasing, coordination, attack, release, musical fit, style coherence and full-body clarity only where they are actually shown. Do not present employer-shaped preferences, competition-style judging logic or culture claims as universal scoring standards. If the tape appears mixed-style or only partly identifiable, say so.

**Change summary:** Adds a controlled wording block for the least universally formalised Dance subtypes.  
**Audit recommendation ID(s):** DANCE-AUDIT-R10  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I10  
**DANCE-SYN finding ID(s):** DANCE-SYN-F10, DANCE-SYN-F14  
**Source ID(s):** DANCE-S044, DANCE-S053, DANCE-S069, DANCE-S070, DANCE-S071  
**Change type label(s):** split style handling; carry as limitation  
**Preserve note:** No claim that the current evidence base is universal for these styles.  
**Must avoid note:** No import of competition/employer preference as general baseline logic.  
**Residual limitation:** Universal descriptors remain a live limitation into final audit.

**DANCE-REV-S11 — Evidence-anchor and generic-feedback suppression**  
**Baseline source section:** 0E plus addendum  
**Current baseline excerpt actually being revised:**  
> Reports should be grounded in this performer, this tape, this material, this style/subtype and observable evidence.

**Proposed revised text:**  
> Every substantive Dance praise or criticism must contain an evidence anchor. Acceptable anchors include a timestamp, a named phrase or transition, a style-specific technical attribute, a task descriptor, or a clear assessability condition. Generic phrases such as good energy, nice movement, strong technique, strong performance, good musicality, clean lines or great presence are not sufficient on their own. Replace them with what was visible, where it happened and why it mattered.

**Change summary:** Makes the anti-generic rule explicit for Dance.  
**Audit recommendation ID(s):** DANCE-AUDIT-R04  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I04  
**DANCE-SYN finding ID(s):** DANCE-SYN-F04  
**Source ID(s):** DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S053, DANCE-S064  
**Change type label(s):** require evidence anchor; exclude / block language  
**Preserve note:** No change to overall report structure.  
**Must avoid note:** No unsupported free-floating praise/criticism.  
**Residual limitation:** Final audit should test whether prompt and validation layers enforce this consistently.

**DANCE-REV-S12 — Dance note, timestamp and coaching specificity**  
**Baseline source section:** 0E plus addendum  
**Current baseline excerpt actually being revised:**  
> Timestamp target rules exist generally, but current outputs can under-produce timestamps and generic notes.

**Proposed revised text:**  
> Dance reports should prioritise timestamped movement evidence. For an assessable 1–3 minute Dance tape, aim for 5–7 useful notes. For an assessable 3–5 minute Dance tape, aim for 7–8 useful notes, without padding or invention. Notes should be chronological, tied to the task/style/assessability question, and include at least one high-value strength moment and one improvement moment where justified. Fix-first, strengths, improvements and next-take advice must each connect to observable evidence. If assessability limits note density, say so explicitly and lower reliability rather than filling the report with generic wording.

**Change summary:** Strengthens movement-note density, evidence linkage and reliability fallback.  
**Audit recommendation ID(s):** DANCE-AUDIT-R14  
**DANCE-AUDIT issue ID(s):** DANCE-AUDIT-I14  
**DANCE-SYN finding ID(s):** DANCE-SYN-F03, DANCE-SYN-F04, DANCE-SYN-F13  
**Source ID(s):** DANCE-S010, DANCE-S034, DANCE-S064, DANCE-S067, DANCE-S068  
**Change type label(s):** require evidence anchor; lower confidence when assessability is limited  
**Preserve note:** Existing maximum timestamp cap remains eight.  
**Must avoid note:** No invented timestamps or padded note counts.  
**Residual limitation:** Final audit still needs to compare persisted, rendered and exported note counts.

## Consolidated revised baseline text

The consolidated package below turns the revision into usable working-draft baseline text. It is driven by the same baseline-side evidence throughout: the current implementation uses a shared schema, Dance still lacks a true dedicated movement rubric, output specificity remains uneven, and timestamp and label risks are real enough to require explicit wording rather than implied good practice alone. fileciteturn0file3 fileciteturn0file0 fileciteturn0file1

**Clean Revised Dance Baseline Package**

### A. Revised 0B Dance rubric slice

**Relevant scoring categories**  
Relevant scoring categories remain: technical, audio, vocal, acting, brief_adherence and professional_presentation.  
Operationally, the stored vocal field may continue to function internally as the movement-technique slot for Dance within the current shared architecture. However, user-facing Dance reports must not present that category as singing, voice or generic vocal performance unless singing is actually present in the tape. In dance-only outputs, that category should be interpreted for the user as movement technique or dance technique within the current framework.

**Relevant report sections**  
Relevant Dance report sections remain: category breakdown, professional standards/brief adherence, timestamped notes, fix-first, improvements, technical visibility notes, and presentation only where camera readability or setup materially affects assessability.  
Dance reports should also use strengths, improvements, fix-first and timestamps to show what was actually observable in this performer, in this tape, in this choreography/task, and in this dance style where known.

**Current discipline logic**  
Dance is supported as an audition type inside the existing shared framework. The system should assess only what is observable in the recorded submission. Valid Dance evidence includes visible movement execution, control, coordination, rhythm/timing, musical responsiveness, use of space, clarity of phrase, transitions, style indicators where identifiable, and movement-based expression/communication.  
The report must clearly separate tape-observable evidence from live-room-only or callback-only capacities. Choreography pick-up speed, response to direction, adaptability after feedback, group-room behaviour, interview readiness and long-day stamina should not be treated as strongly assessable from a finished dance tape unless the tape itself directly shows them.

**Feedback specificity rules**  
Dance feedback must be style-aware wherever the brief, task or tape makes the style reasonably identifiable. Use the most specific supported label available: ballet, contemporary/modern, jazz/modern theatre, tap, commercial dance, street/hip-hop, or MT dance. If style is mixed or unclear, say so and keep wording to shared observable domains rather than guessing.  
Generic praise or criticism is not sufficient. Terms such as good energy, nice movement, strong performance, good control, strong technique, good musicality, great presence, expressive, clear style, good rhythm, professional tape, confident performer, clean lines and good dynamics must be replaced with observable evidence, a named task or phrase, a timestamp, a style-specific attribute, or a clear assessability condition.

**Dance tape assessability**  
Strong Dance judgement from tape depends on assessability first. High-confidence Dance feedback requires enough body and space to read the relevant movement, stable framing, readable movement continuity, audible music where musical judgement depends on it, and a simple enough capture to show what the performer is actually doing. If those conditions are partly missing, the report must narrow claim scope, state the limitation, and lower feedback reliability rather than turning the limitation into generic criticism of skill.

**Audio and music assessability**  
Audio in Dance should describe whether the music, counts or relevant rhythmic output are audible enough to support fair movement assessment. It should not be used to imply weak musicality where the rhythmic relationship cannot be heard reliably.  
For tap, do not make strong positive or negative rhythmic-clarity claims unless the relevant footwork sound is sufficiently audible.

**Movement-based expression and communication**  
In Dance, performance language must remain movement-based. Use intention, expression, projection, communication or performance quality only where those ideas are visible through phrasing, dynamics, focus, spatial intention, attack/release, relation to music, or relation to choreographic task. Avoid theatre-acting language unless spoken acting is actually present.

**Professional presentation boundary**  
In Dance, professional_presentation should be limited to assessability, brief response and safe preparation. It may address whether the tape is readable enough to judge, whether stated task requirements were followed, and whether preparation choices supported or hindered safe, fair assessment. It must not reward glamour, physique, expensive production, studio polish, domestic set transformation or employer-specific look rules as general merit. Smartphone or home capture may be fully acceptable if the movement is readable.

**Accessibility-safe assessment**  
Dance assessment must separate process adaptation from attainment. Mobility aids, seated adaptation, reduced range, bespoke training pathway, CV gaps, convalescence, body difference or access need must not be treated as deficits in themselves. Where material is adapted to body or access need, judge only what is shown and how clearly it communicates the task. Do not infer medical history, injury status, capability ceiling or lack of professionalism from appearance, support equipment or visible adaptation.

**Training potential and creative scope**  
Training-potential language should be reserved to admissions-style or training-route contexts where the task and source logic justify it. Elsewhere, the report should prioritise present observable level in this tape.  
Improvisation and creative-response comments may be used only where the task or tape clearly includes improvisation, creative tasking or open material.

**Known gaps / residual architecture note**  
Current baseline limitations remain: the shared six-field architecture is preserved; the stored vocal field still creates a residual structural risk for Dance-only category display; subtype extraction is not fully confirmed as live; commercial/street/hip-hop evidence remains less universally formalised than ballet/contemporary/jazz-adjacent/tap; and actual Dance report rendering is still a final-audit item.

### B. Revised 0E Dance-specific guardrail additions or amendments

**Dance-specific preserve note**  
Preserve the current six stored score fields, weights, caps, blockers, verdict thresholds, server-side recomputation, two-step architecture, safety/material/accessibility scrub layers, report schema, public JSON structure, and the stabilised Musical Theatre acting-plus-song flow. Dance revisions in this pack are wording, evidence-standard and guardrail changes only.

**Dance-specific regression-risk additions**  
Add the following Dance-specific regression risks to the guardrail pack:
- Dance-only report shows “Vocal”, “voice” or singing language where no singing is present.
- Dance report uses one undifferentiated movement label with no style-specific handling and no “style unclear” caution.
- Dance report makes strong judgements where full-body/task-sufficient visibility, readable space or music audibility are materially limited.
- Dance report rewards production polish, studio environment or equipment quality as a proxy for movement quality.
- Dance report infers pick-up speed, direction response, adaptability or stamina from a finished tape alone.
- Dance report treats disability, access need, mobility aid, adaptation, body difference or convalescence as negative evidence.
- Dance report applies commercial/street/hip-hop wording as if it were a universally formalised standard.
- Dance report makes tap rhythm or clarity claims where relevant audibility is insufficient.
- Dance timestamp count or note specificity drops below what an assessable tape should reasonably support.

**Dance-specific specificity guardrails**  
Add the following to the specificity guardrails:
- Every substantive Dance section must anchor claims to observable evidence.
- Category notes must identify the observable basis for the judgement.
- Strengths and improvements must not rely on generic praise terms alone.
- Fix-first must identify the highest-impact observable change.
- Timestamped notes must be chronological, evidence-led and tied to style/task or assessability.
- If style is unknown, mixed or only partly inferable, mark that cautiously rather than guessing.
- If assessability is materially limited, narrow claim scope and lower reliability rather than padding the report with generic wording.

**Dance-specific scoring and presentation guardrails**  
Add the following to the scoring guardrails:
- Do not present the Dance technique proxy as singing or voice where singing is absent.
- Do not show user-facing singing/voice language in dance-only situations unless singing is actually present.
- Do not score unsupported live-room capacities from a finished Dance tape.
- Do not infer weak musicality from poor music audibility alone.
- Do not reward expensive production, studio polish, employer-specific “look”, glamour or physique as general Dance merit.
- Do not allow presentation notes to drift beyond assessability, brief response or safe preparation.
- Do not let technical/presentation categories dominate unless assessability or explicit brief compliance is materially affected.

### C. New Dance addenda where no adequate baseline text existed

**Dance addendum: style-specific guidance blocks**  
Use the following as style-specific reference language inside the existing framework:
- **Ballet:** placement/posture, line, coordination, control, spatial clarity, musical responsiveness, and style-specific precision where visible.
- **Contemporary / modern:** weight, breath, alignment, flow, use of space, dynamic range, and creative task response where the task includes it.
- **Jazz / modern theatre:** precision, rhythm/timing, projection, line, use of space, style/theme clarity and musical fit.
- **Tap:** precision of footwork, rhythmic interpretation, clarity of attack, audible response where assessable, and overall phrase control.
- **Commercial dance:** clarity of phrasing, groove/style fit, coordination, attack/release, camera readability where relevant, and cautious handling of employer-specific expectations.
- **Street / hip-hop:** groove, phrasing, style authenticity where reasonably inferable, whole-body clarity and musical fit, without presenting competition or employer preferences as universal standards.
- **MT dance:** movement clarity, musical responsiveness, performance intention through movement, style coherence and choreographic communication.

**Dance addendum: live-room-only and low-confidence claim block**  
The following should usually be marked as live-room-only, callback-only or low-confidence unless directly shown: choreography pick-up speed, response to notes, adaptability after direction, stamina across a long call, workshop behaviour, interview readiness and group-room responsiveness. Where such evidence is not directly present, say not assessable or low-confidence.

**Dance addendum: exclusion and anti-bias block**  
Never use the following as positive or negative Dance scoring evidence unless strictly required for safe assessability and directly supported by the task: body type, appearance, height/physique as a universal standard, disability or access need as deficit, injury or medical diagnosis, follower count, fame, social-media behaviour, marketability, bookability, expensive production value, studio polish, cosmetic presentation, generic charisma, stamina claims from short clips, response-to-direction claims from a finished tape, or employer physique rules as a general Dance norm.

**Revision Change Register**

| Revision change ID | Change title | Revision section ID | Audit recommendation ID(s) | Audit issue ID(s) | Synthesis finding ID(s) | Source ID(s) | What changed | Change type label(s) | Priority | Evidence confidence | Baseline compatibility | Backend impact likely | Residual risk note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DANCE-REV-C01 | Dance-only label containment | DANCE-REV-S01 | DANCE-AUDIT-R01 | I01 | F01, F12, F14 | DANCE-S010, S034, S064, S067, S068 | Reframed user-facing Dance technique proxy away from singing language | tighten descriptor language; exclude / block language | P0 | High | High | out of scope | Frontend helper still needs final-audit confirmation |
| DANCE-REV-C02 | Style-specific Dance guidance | DANCE-REV-S02 | DANCE-AUDIT-R02 | I02 | F02, F10, F11, F14 | DANCE-S023, S038, S041, S042, S043, S044, S069 | Added style-aware wording and explicit style blocks | split style handling; tighten descriptor language | P0 | High | High | no | Subtype detection coverage remains unconfirmed |
| DANCE-REV-C03 | Assessability preconditions and reliability fallback | DANCE-REV-S03 | DANCE-AUDIT-R03 | I03 | F03, F09, F13 | DANCE-S010, S034, S064, S067, S068 | Added full-body/framing/space/music continuity preconditions and lower-confidence rule | require evidence anchor; lower confidence when assessability is limited | P0 | High | High | no | Rendering/export still needs audit |
| DANCE-REV-C04 | Evidence-anchor rule for Dance praise/criticism | DANCE-REV-S11 | DANCE-AUDIT-R04 | I04 | F04 | DANCE-S038, S041, S042, S053, S064 | Converted anti-generic principle into explicit requirement | require evidence anchor; exclude / block language | P0 | High | High | no | Enforcement quality must be tested |
| DANCE-REV-C05 | Live-room-only claim boundary | DANCE-REV-S08 | DANCE-AUDIT-R05 | I05 | F07, F13 | DANCE-S057, S061, S071, S072 | Ring-fenced pick-up, direction response, adaptability and stamina | mark live-room-only; constrain claim scope | P0 | High | High | no | Task-present exceptions remain possible |
| DANCE-REV-C06 | Accessibility-safe adaptation rule | DANCE-REV-S07 | DANCE-AUDIT-R06 | I06 | F08 | DANCE-S039, S046, S064, S065, S066 | Clarified adaptation-without-deficit and blocked capability inference | clarify accessibility boundary; exclude / block language | P0 | High | High | no | Interaction with scrub layers still needs final audit |
| DANCE-REV-C07 | Professional-presentation boundary | DANCE-REV-S06 | DANCE-AUDIT-R07 | I07 | F09, F12 | DANCE-S057, S064, S067, S068, S069 | Narrowed professional_presentation to assessability/brief/safe prep | clarify professional_presentation boundary; exclude / block language | P0 | High | High | no | Employer-specific look rules remain contextual only |
| DANCE-REV-C08 | Training-potential separation | DANCE-REV-S09 | DANCE-AUDIT-R08 | I08 | F05 | DANCE-S004, S008, S011, S025, S030 | Limited training-potential language to admissions-style contexts | constrain claim scope; carry as limitation | P1 | Medium-high | High | no | Context detection still requires checking |
| DANCE-REV-C09 | Improvisation and creative-response scope | DANCE-REV-S09 | DANCE-AUDIT-R09 | I09 | F06 | DANCE-S001, S014, S015, S041, S064, S069 | Restricted creative-response language to task-present evidence | constrain claim scope | P1 | Medium-high | High | no | Expressiveness remains allowed when genuinely visible |
| DANCE-REV-C10 | Commercial/street/hip-hop caution | DANCE-REV-S10 | DANCE-AUDIT-R10 | I10 | F10, F14 | DANCE-S044, S053, S069, S070, S071 | Added controlled language block for less-universal style evidence | split style handling; carry as limitation | P1 | Medium | High | no | Universal descriptor gap remains open |
| DANCE-REV-C11 | Tap audibility caveat | DANCE-REV-S04 | DANCE-AUDIT-R11 | I11 | F11 | DANCE-S043, S051 | Added audibility precondition for strong tap rhythm claims | constrain claim scope; carry as limitation | P1 | Medium-high | High | no | Public tap evidence remains thinner outside formal frameworks |
| DANCE-REV-C12 | Audio/music assessability separation | DANCE-REV-S04 | DANCE-AUDIT-R12 | I12 | F03, F11 | DANCE-S010, S034, S043, S067, S068 | Separated music audibility from musicality judgement | tighten descriptor language; lower confidence when assessability is limited | P0 | High | High | no | Existing audio cap logic remains unchanged |
| DANCE-REV-C13 | Movement-based performance language | DANCE-REV-S05 | DANCE-AUDIT-R13 | I13 | F02, F04, F14 | DANCE-S038, S041, S042, S043, S069 | Reframed acting/performance wording around movement communication | tighten descriptor language; constrain claim scope | P1 | High | High | no | Stored acting field remains shared-schema-shaped |
| DANCE-REV-C14 | Timestamp specificity and reliability fallback | DANCE-REV-S12 | DANCE-AUDIT-R14 | I14 | F03, F04, F13 | DANCE-S010, S034, S064, S067, S068 | Added Dance note-density expectations and fallback when assessability limits note count | require evidence anchor; lower confidence when assessability is limited | P0 | High | High | no | Persisted-versus-rendered notes still need final audit |

## Controls, risks and final-audit mapping

The summary below keeps the revision tied to the known baseline risks rather than treating the new wording as if it resolved the entire architecture. That caution is important because the supporting materials repeatedly confirm that the highest Dance weaknesses sit at the intersection of shared schema, static labels, weak subtype logic and under-produced observable evidence. fileciteturn0file3 fileciteturn0file0 fileciteturn0file1

**Topic-by-Topic Revision Summary**

| Topic | Current baseline problem | Revision approach taken | Revision change ID(s) | Residual limitation | Final-audit attention note |
|---|---|---|---|---|---|
| Style-specific movement technique language | Too generic; style awareness encouraged but not codified | Added explicit style-aware wording and style blocks | C02 | Subtype extraction live status still unconfirmed | Check unknown/mixed-style handling in real outputs |
| Technical / video assessability | Visibility/readability recognised but underspecified | Added assessability preconditions and confidence fallback | C03 | Renderer/export behaviour unseen | Check full-body/framing/space note handling |
| Audio / music assessability | Audio and musicality can be conflated | Split audibility from musicality claims | C12, C11 | Tap evidence remains thinner outside formal sources | Check inaudible music/tap cases |
| Acting / performance / artistry overlap | Dance can borrow generic acting language | Reframed performance as movement-based communication | C13 | Stored acting field remains shared | Check category note wording for Dance |
| professional_presentation boundaries | Too loose; polish bias risk | Restricted to assessability, brief response, safe preparation | C07 | UI label/helper behaviour unseen | Check no glamour/look bias appears |
| Dance-only label containment | Current vocal proxy creates immediate user-facing risk | Added explicit dance-only label rule | C01 | Frontend implementation not supplied | Check any Dance-only report or comparison label |
| Current vocal-proxy containment | Internal proxy remains architecture pressure | Contained via wording, not schema change | C01 | Structural risk only partly mitigated | Keep as explicit final-audit limitation |
| Live-room-only versus tape-observable claims | Pick-up/adaptability/stamina not tightly ring-fenced | Added live-room-only and low-confidence block | C05 | Task-present exceptions must stay narrow | Check no finished-tape overclaim |
| Accessibility-safe assessment | Anti-penalisation present but insufficiently explicit | Added adaptation-without-deficit and anti-inference wording | C06 | Interaction with scrub layer not directly tested | Check visible adaptation cases carefully |
| Generic feedback suppression | Generic praise remains a live risk | Made evidence anchors mandatory | C04 | Enforcement still needs testing | Check headline, strengths, improvements, category notes |
| Production-value versus assessability | Polish can still read as merit | Bound professional_presentation away from polish | C07, C03 | Some presentation notes may still overreach if validation is weak | Check smartphone/home-setup fairness |
| Choreography pick-up / learning-speed caution | Overclaim risk from finished tapes | Marked as live-room-only unless directly shown | C05 | Some employer reels may show partial evidence | Check balanced low-confidence wording |
| Stamina / endurance caution | Short clips can prompt unsupported stamina claims | Explicitly blocked from short-clip inference | C05 | Employer contexts still value stamina live | Check no short-clip stamina overclaim |
| Commercial / street / hip-hop caution | Evidence improved but not universal | Added cautious tape-specific wording block | C10 | Universal descriptor limit remains open | Check no over-generalised style claims |
| Tap evidence limits | Audibility dependence under-specified | Added tap audibility caveat | C11, C12 | Source base remains thinner outside exam-board logic | Check no strong tap claim without audible evidence |
| Timestamp specificity and reliability fallback | Underproduction and thin specificity remain live | Added Dance note-density and fallback rule | C14 | Actual persisted/rendered counts not visible here | Check rendered output count and specificity |

**Residual Risks and Out-of-Scope Architecture Notes**

| Issue | Why it remains open | Revision change ID(s), if any | Fully mitigated in wording? | Can final audit proceed anyway? | Carry as limitation or defer? | Note |
|---|---|---|---|---|---|---|
| Vocal-proxy structural risk | Stored field semantics remain shared across disciplines | C01 | Partly | Yes | Carry as limitation | Wording contains risk, but schema semantics remain |
| Dance-only user-facing label risk | Frontend helper implementation not supplied | C01 | Partly | Yes | Carry as limitation | Must be checked in real rendered outputs |
| Universal commercial/street/hip-hop descriptor limits | Evidence base remains partly employer-/competition-shaped | C10 | Partly | Yes | Carry as limitation | Wording now cautions against universality |
| Tap limits outside exam-board evidence | Public employer/admissions evidence remains thinner | C11, C12 | Partly | Yes | Carry as limitation | Strong rapport with audibility caveat now present |
| Pickup speed as formal descriptor versus live-room process | Evidence still favours live-room interpretation | C05 | Yes in wording | Yes | Carry as limitation | Keep as claim-scope boundary |
| Stamina overclaim boundaries | Live value recognised, tape evidence still weak | C05 | Yes in wording | Yes | Carry as limitation | Final audit should check operational language |
| Tape-observable direction response | Finished tape rarely supports it | C05 | Yes in wording | Yes | Carry as limitation | Final audit should ensure block holds |
| Lack of actual current Dance output examples | Spot-auditing rendered behaviour remains impossible here | — | No | Yes | Defer | Final audit must use real Dance outputs |
| Exact comparison-page label logic | Not supplied in baseline materials | C01 | No | Yes | Defer | Check Dance labels on comparison page |
| Exact renderer/export timestamp behaviour | Not supplied in baseline materials | C14 | No | Yes | Defer | Compare persisted, rendered and exported note counts |

**Provisional Non-Regression Test Mapping**

| Test ID or test cluster | Scenario | Relevant revision change ID(s) | Relevant revision section ID(s) | What the revised baseline should now force | What it should now block | Priority | Final-audit use note |
|---|---|---|---|---|---|---|---|
| T01–T04 | Assessability and anti-polish boundaries | C03, C07, C12 | S03, S04, S06 | Explicit assessability conditions, reduced confidence when limited, simple-setup acceptability | Production polish as proxy, weak-audio-as-weak-musicality confusion | P0 | Use poor-visibility, poor-audio, home/smartphone and over-polished scenarios |
| T05 | Dance-only no-singing label containment | C01 | S01 | Dance-only technique wording, no singing label where singing absent | “Vocal”/voice/singing language in Dance-only display | P0 | Must check both report and comparison surfaces |
| T06–T07 | Generic-feedback suppression and style specificity | C02, C04, C13 | S02, S05, S11 | Style-aware, evidence-anchored Dance language | “Good energy”, “nice movement”, “strong technique” with no anchor | P0 | Use at least one identifiable style and one unclear-style case |
| T08–T10 | Live-room-only and anti-bias controls | C05, C06 | S07, S08 | Low-confidence or not-assessable wording for live-only capacities; adaptation without deficit | Direction-response, stamina or disability inference from finished tape | P0 | Include visible adaptation and short-clip stamina cases |
| T11–T13 | Production-value boundary, commercial/street caution and tap audibility | C07, C10, C11, C12 | S04, S06, S10 | Tape-specific, cautious street/commercial language; tap audibility caveat | Universalised employer/competition claims; tap rhythm claims without sound | P1 | Include one street/commercial tape and one tap tape with weak audibility |
| T14–T15 | Improvisation scope and training-potential scope | C08, C09 | S09 | Task-present creativity language; admissions-only training-potential usage | Generic creativity claims; employer-tape potential inflation | P1 | Include one admissions-style tape and one employer-style tape |

**Revision Scope for Final Audit**

| Final-audit target section | Why it needs checking | Revision change ID(s) | Audit recommendation ID(s) | Synthesis finding ID(s) | Must preserve | Must not regress | Priority |
|---|---|---|---|---|---|---|---|
| Dance movement-technique guidance | Confirms style-aware wording is functioning | C02 | R02 | F02, F14 | Shared six-field storage | One generic movement label for all Dance | P0 |
| Dance-only output display / label note | Confirms label containment works in user-facing output | C01 | R01 | F01, F12, F14 | Stored field architecture | Dance-only “Vocal” or singing language | P0 |
| Tape assessability guidance | Confirms preconditions and lowered-confidence logic appear | C03 | R03 | F03, F09, F13 | Reliability labels | High-confidence judgement with unreadable tape | P0 |
| Audio/music assessability guidance | Confirms audibility is separated from musical quality | C11, C12 | R11, R12 | F03, F11 | Audio cap logic | Weak-audio equals weak-musicality language | P0 |
| Performance/expression guidance | Confirms movement-based rather than generic acting language | C13 | R13 | F02, F04, F14 | Existing acting field storage | Theatre-acting terms for Dance-only movement | P1 |
| professional_presentation guidance | Confirms assessability-only boundary | C07 | R07 | F09, F12 | Shared field and schema | Glamour/polish/physique bias | P0 |
| Exclusion / anti-bias rules | Confirms adaptation-without-deficit handling | C06 | R06 | F08 | Safety and fairness scrubs | Disability/access need as deficit | P0 |
| Live-only confidence caveat language | Confirms overclaim block is active | C05 | R05 | F07, F13 | Current architecture | Direction response/pick-up/stamina from finished tape | P0 |
| Style-specific caution blocks | Confirms commercial/street/tap caution is visible and proportionate | C10, C11 | R10, R11 | F10, F11 | Current field model | Universal overclaim or unsupported tap certainty | P1 |
| Strengths / improvements / fix-first / timestamp rules | Confirms note density and evidence-anchor rules are working | C04, C14 | R04, R14 | F03, F04, F13 | Max 8 timestamps | Thin generic notes on assessable Dance tapes | P0 |

**Open Risks and Deferred Issues**

| Issue | Why it remains open | Revision change ID(s), if any | Can final audit proceed anyway? | Carry as limitation or defer? | Note |
|---|---|---|---|---|---|
| Vocal-proxy structural risk | Wording containment is possible, field semantics remain shared | C01 | Yes | Carry as limitation | Final audit should state this plainly |
| Dance-only user-facing label risk | Actual UI/helper logic unseen | C01 | Yes | Defer to final audit | Must test live rendered outputs |
| Universal commercial/street/hip-hop descriptor limits | Evidence base still partly shaped by employer/competition sources | C10 | Yes | Carry as limitation | Keep cautious wording in final audit |
| Tap limits outside exam-board evidence | Public non-exam evidence remains comparatively thin | C11 | Yes | Carry as limitation | Audibility caveat now mitigates overclaim |
| Pickup speed as live-room evidence | Formal tape descriptor remains weak | C05 | Yes | Carry as limitation | Avoid promoting it into tape score language |
| Stamina overclaim boundary | Short-clip inference remains unsafe | C05 | Yes | Carry as limitation | Final audit should test short clip cases |
| Tape-observable direction response | Usually absent from finished tapes | C05 | Yes | Carry as limitation | Must stay low-confidence or not assessable |
| Lack of actual current Dance output examples | Revision is baseline-only, not output-spot-audited | — | Yes | Defer | Final audit should use current Dance examples |
| Unseen frontend/comparison logic | Not directly revisable from supplied materials | C01, C14 | Yes | Defer | Final audit needs display-layer verification |

## Handoff for final audit

The revision package below is grounded in a now-consistent baseline picture: the current system is stable as a shared-schema self-tape evaluator, but Dance remains the most exposed discipline because technique is still routed through the stored vocal field, subtype handling is underdeveloped, and report specificity depends too heavily on generic shared logic unless it is tightened explicitly. The reconciliation note, control sheet, baseline audit and specificity stress test all point to the same conclusion: the safest path is not a schema rewrite, but a wording-and-guardrail revision that makes Dance more style-specific, more assessability-led, more anti-bias and more resistant to overclaim. fileciteturn0file3 fileciteturn0file2 fileciteturn0file0 fileciteturn0file1

**Reusable Handoff Pack for DANCE-FINAL-AUDIT**

**DANCE-REV handoff summary**

The Dance revision is complete at wording and guardrail level. It does not alter the shared six-field architecture, weights, caps, blockers, verdict thresholds, report schema or backend pipeline. Instead, it makes the Dance baseline materially more specific and more defensible inside the existing system. The most important change is containment of the dance-only vocal-proxy risk. The revision now states plainly that, although the stored vocal field may continue to operate internally as the movement-technique slot, Dance-only reports must not present that category to users as singing or voice unless singing is actually present.

The second major gain is style specificity. The revised baseline now requires style-aware Dance language wherever the brief, task or tape supports it, and it adds explicit handling blocks for ballet, contemporary/modern, jazz/modern theatre, tap, commercial dance, street/hip-hop and MT dance. The third is assessability. Full-body or task-sufficient visibility, stable framing, readable space, audible music where relevant, continuity and simple capture are now codified as preconditions for high-confidence Dance judgement from tape. If those conditions are materially limited, the report must narrow claim scope and lower reliability rather than substituting generic criticism.

The fourth major gain is claim-scope control. Choreography pick-up, direction response, adaptability, workshop behaviour and long-day stamina are now marked as mainly live-room or callback evidence unless directly shown. The fifth is accessibility-safe assessment. The revision makes explicit that process adaptation must be separated from attainment, and that access need, mobility aid, seated adaptation, convalescence, body difference or bespoke pathway must not be treated as negative evidence.

Residual limitations remain, but they do not block final audit: the vocal-proxy issue remains partly structural; commercial/street/hip-hop descriptors remain less universal than ballet/contemporary/jazz/tap; tap remains thinner outside formal frameworks; and actual current Dance report outputs and frontend label behaviour were not supplied for direct spot-auditing.

**Compact change summary with DANCE-REV-C IDs**

| Change ID | Title |
|---|---|
| DANCE-REV-C01 | Dance-only label containment |
| DANCE-REV-C02 | Style-specific Dance guidance |
| DANCE-REV-C03 | Assessability preconditions and reliability fallback |
| DANCE-REV-C04 | Evidence-anchor rule for Dance praise/criticism |
| DANCE-REV-C05 | Live-room-only claim boundary |
| DANCE-REV-C06 | Accessibility-safe adaptation rule |
| DANCE-REV-C07 | professional_presentation boundary |
| DANCE-REV-C08 | Training-potential separation |
| DANCE-REV-C09 | Improvisation and creative-response scope |
| DANCE-REV-C10 | Commercial/street/hip-hop caution |
| DANCE-REV-C11 | Tap audibility caveat |
| DANCE-REV-C12 | Audio/music assessability separation |
| DANCE-REV-C13 | Movement-based performance language |
| DANCE-REV-C14 | Timestamp specificity and reliability fallback |

**Compact section summary with DANCE-REV-S IDs**

| Section ID | Section title |
|---|---|
| DANCE-REV-S01 | Dance-only category label containment |
| DANCE-REV-S02 | Movement-technique and style-specific handling |
| DANCE-REV-S03 | Dance tape assessability and confidence fallback |
| DANCE-REV-S04 | Audio and music assessability including tap audibility |
| DANCE-REV-S05 | Movement-based expression, performance and communication |
| DANCE-REV-S06 | Professional presentation and production-value boundary |
| DANCE-REV-S07 | Accessibility-safe adaptation and anti-bias protections |
| DANCE-REV-S08 | Live-room-only and low-confidence claim boundaries |
| DANCE-REV-S09 | Training potential and task-specific creative scope |
| DANCE-REV-S10 | Commercial, street and hip-hop caution |
| DANCE-REV-S11 | Evidence-anchor and generic-feedback suppression |
| DANCE-REV-S12 | Dance note, timestamp and coaching specificity |

**Priority revision scope**

The highest-priority final-audit checks are label containment, style specificity, assessability preconditions, audio/music separation, generic-feedback suppression, live-room-only overclaim controls, accessibility-safe assessment, professional-presentation boundaries, and timestamp specificity.

**Provisional non-regression test mapping**

Carry forward the grouped audit test references as follows:
- T01–T04 for assessability and anti-polish boundaries
- T05 for dance-only no-singing label containment
- T06–T07 for generic-feedback suppression and style specificity
- T08–T10 for live-room-only and anti-bias controls
- T11–T13 for production-value boundary, commercial/street caution and tap audibility
- T14–T15 for improvisation scope and training-potential scope

**Open risks and deferred issues**

Carry forward as explicit limitations: the structural vocal-proxy risk; universal commercial/street/hip-hop descriptor limits; tap limits outside exam-board evidence; pickup speed and direction response as mainly live-room evidence; stamina overclaim boundaries; lack of current Dance report examples; and unseen frontend/comparison label logic.

**What was and was not revisable from supplied baseline materials**

Revisable from supplied materials: 0B Dance rubric slice, 0E guardrail rules, and Dance addenda justified by 0C, 0D, 0A and 0.  
Not directly revisable from supplied materials: exact frontend label-helper implementation, exact comparison-page label behaviour, current Dance renderer/export behaviour, actual current Dance report outputs, and any production subtype extraction not surfaced in the supplied summaries.

**Evidence basis**

This revision is grounded in DANCE-SYN-F01 to DANCE-SYN-F14, DANCE-AUDIT-I01 to DANCE-AUDIT-I14, DANCE-AUDIT-R01 to DANCE-AUDIT-R14, and the source families carried forward in the audit handoff, especially admissions/school sources DANCE-S009, DANCE-S010, DANCE-S014, DANCE-S023, DANCE-S034; formal descriptors DANCE-S038, DANCE-S041, DANCE-S042, DANCE-S043; accessibility/inclusive/self-tape sources DANCE-S039, DANCE-S046, DANCE-S064, DANCE-S065, DANCE-S066, DANCE-S067, DANCE-S068; and employer/professional sources DANCE-S056, DANCE-S057, DANCE-S069, DANCE-S070, DANCE-S071, DANCE-S072.

**Completion Statement**

DANCE-REV complete. Ready for DANCE-FINAL-AUDIT.

---

## Links

- **Previous:** [[drr-dance-07-audit]] — Synthesis Audit
- **Next:** [[drr-dance-09-final-audit]] — Final Audit
- **Thread overview:** [[drr-dance-overview]]
- **Programme:** [[drr-programme-overview]]
