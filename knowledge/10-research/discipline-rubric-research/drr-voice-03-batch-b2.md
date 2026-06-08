---
id: drr-voice-03-batch-b2
title: Voice — Batch B2 Extraction
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: research
source_ref: "/Users/bethwillars/Documents/AI.nosync/Apps/Tape Coach/Research/Rubric Research Each Discipline/4.Voice/VOICE-B2.md"
discipline: commercial
monday_ref: null
tags: [discipline-rubric-research, commercial, stage-extraction, voice]
confidence: medium
created: 2026-05-05
imported: 2026-06-08
updated: 2026-06-08
---

# Voice — Batch B2 Extraction

> **Imported research — Discipline Rubric Research programme.** Step 3 of 12 in the Voice thread (`stage-extraction`). Original file: `4.Voice/VOICE-B2.md`. Original date: 2026-05-05 (filesystem birthtime — no reliable in-content date; corroborated by the filename stage/batch convention and folder order). Imported: 2026-06-08. Preserved verbatim below — research evidence, not the live rubric; the consolidated rubric for this discipline is the archived *Merged* file referenced from [[drr-voice-overview]].

---

# Voice / Singing Formal Frameworks and Descriptor Extraction

## Readiness and source control

**B2 Readiness Check**

| Check | Status | Note |
|---|---:|---|
| VOICE-S0 handoff context prepopulated | Yes | Used as the controlling branch handoff. |
| VOICE-B1 handoff context prepopulated | Yes | Used to preserve B1 findings on contrast, story-through-song, assessability-first capture, and live-room boundaries. |
| VOICE-B2 source pack present | Yes | VOICE-S021 to VOICE-S031 were treated as the assigned pack. |
| Preserved baseline-control context prepopulated | Yes | Live product baseline, six fixed score fields, MT anchor, locked-field rules, server-side recomputation, caps/blockers and safety guardrails were treated as fixed. fileciteturn0file0 fileciteturn0file3 fileciteturn0file5 |
| Source IDs present and normalised | Yes | VOICE-S021 to VOICE-S031 preserved exactly. |
| Source-family boundaries understood | Yes | This run used formal frameworks, graded-exam specifications and descriptor sources only. |
| Field-semantics risk noted | Yes | The run was shaped by the need to clarify sung-vocal meaning without causing Acting/Dance label leakage. fileciteturn0file0 fileciteturn0file5 |
| MT protected anchor noted | Yes | No output here implies MT schema, weight or flow change. fileciteturn0file0 fileciteturn0file5 |
| Extraction may proceed | Yes | Proceeded with caveats below. |

**Caveats**

The current live production system is stable and already deployed, but revised branch refinements are not yet shipped as production behaviour; this run therefore extracts evidence only and does not imply implementation. fileciteturn0file0 fileciteturn0file3  
The exact VOICE-S0 detailed B2 ledger was not pasted in this turn, so the assigned VOICE-B2 pack supplied in the prompt was treated as authoritative.  
Two rows required constraint-safe closure rather than positive extraction: VOICE-S022 and VOICE-S030; one placeholder row, VOICE-S031, was closed as provenance-limited because the promised VOICE-S0 alternate row was not supplied in this run.

**B2 Extraction Input Register**

| Source ID | Source name | Present in source pack? | Extracted in this run? | Preferred current official location locked? | Final extraction status | Reason if not fully extracted | Note |
|---|---|---:|---:|---:|---|---|---|
| VOICE-S021 | LAMDA Exams Musical Theatre | Yes | Yes | Yes | Fully extracted: criteria found | — | Official page + linked syllabus/support material used. |
| VOICE-S022 | LAMDA Exams Singing | Yes | Yes | Partial | Out of scope | No standalone Singing qualification located in accessed official LAMDA exams materials | Closed, not unresolved. |
| VOICE-S023 | Trinity College London Musical Theatre | Yes | Yes | Yes | Fully extracted: criteria found | — | Official overview + syllabus PDF + digital context used. |
| VOICE-S024 | Trinity College London Singing | Yes | Yes | Partial | Partially extracted with explicit limitation | Direct public syllabus fetch throttled; extraction relies on official overview/resources/repertoire/digital pages | Enough for synthesis with caveat. |
| VOICE-S025 | ABRSM Singing | Yes | Yes | Yes | Fully extracted: criteria found | — | Official qualification spec + official marking criteria used. |
| VOICE-S026 | ABRSM Singing for Musical Theatre | Yes | Yes | Yes | Fully extracted: criteria found | — | Practical + performance grade specs + official marking criteria used. |
| VOICE-S027 | LCME Musical Theatre | Yes | Yes | Yes | Fully extracted: criteria found | — | Musical Theatre for Singers syllabus + digital guidance used. |
| VOICE-S028 | LCME Singing | Yes | Yes | Yes | Partially extracted with explicit limitation | Public official materials resolve to general music grades syllabus plus classical singing page/repertoire list, not a rich subject-specific descriptor matrix | Still useful for classical/formal boundaries. |
| VOICE-S029 | RSL / Rockschool Vocals | Yes | Yes | Yes | Fully extracted: criteria found | — | Official vocals course page contained assessment criteria and exam structure. |
| VOICE-S030 | RSL Musical Theatre / Performance Arts Vocal Source | Yes | Yes | No | Out of scope | No current official equivalent source was safely resolved in the assigned pack | Closed as out of scope/current-source-not-located. |
| VOICE-S031 | Additional current official source | Yes | Yes | No | Provenance unclear | Exact VOICE-S0 alternate official row was not supplied, so no safe remap was made | Closed with explicit limitation. |

**Source URL Resolution and Alias Log**

Raw URLs are omitted here; official locations are identified by official domain, page/PDF title and citations.

| Source ID | Original target / source name | Resolved official location(s) | URL changed? | Official linked page, PDF or syllabus used? | Alias / duplicate issue? | Handling note |
|---|---|---|---:|---:|---|---|
| VOICE-S021 | LAMDA Exams Musical Theatre | Official LAMDA download centre; 2021 *Musical Theatre Solo/Duo Syllabus*; musical-theatre support material; ROA/download-centre guidance. citeturn16view0turn26view0turn26view1 | Yes | Yes | No | Syllabus remains the controlling source even though later support pages sit separately. |
| VOICE-S022 | LAMDA Exams Singing | Official LAMDA exams/download-centre family searched; no separate Singing syllabus was located among public current syllabus families accessed. citeturn16view0 | N/A | No | No | Closed as out of scope for this batch, not unresolved. |
| VOICE-S023 | Trinity Musical Theatre | Official Trinity Musical Theatre page plus official syllabus PDF (resource id 8856). citeturn1search0turn16view2 | Yes | Yes | No | Official PDF carried the main descriptor weight. |
| VOICE-S024 | Trinity Singing | Official Trinity Singing overview, support resources, repertoire list PDF, Information & Regulations PDF, digital submissions pages. citeturn34view4turn16view4turn35view1turn35view2turn37view1 | Yes | Yes | No | Direct “View syllabus” fetch throttled; row remains partial but closed. |
| VOICE-S025 | ABRSM Singing | Official ABRSM Singing qualification specification and official ABRSM marking criteria PDF. citeturn28view1turn28view3 | Yes | Yes | No | Marking-criteria PDF used as descriptor source, not as TapeCoach weighting logic. |
| VOICE-S026 | ABRSM Singing for MT | Official ABRSM practical grades spec, performance grades spec, official marking criteria PDF. citeturn28view0turn28view2turn28view3 | Yes | Yes | No | Practical and performance routes were kept analytically separate. |
| VOICE-S027 | LCME Musical Theatre | Official LCME Musical Theatre for Singers subject page, 2024 syllabus PDF, and official digital recorded-exam requirements page. citeturn11view3turn16view3turn26view4 | Yes | Yes | No | Strongest single MT-for-singers formal-framework source in this batch. |
| VOICE-S028 | LCME Singing | Official LCME Classical Singing page, repertoire list, and general Music Grades syllabus currently used for Classical Singing. citeturn20view1turn21view0turn22view0 | Yes | Yes | No | Descriptor density is thinner than S027; row remains partial. |
| VOICE-S029 | RSL / Rockschool Vocals | Official RSL/Rockschool “Learn to Sing – Vocals Courses” page. citeturn11view4turn13view4 | Yes | No separate PDF found | No | Sufficient to close as fully extracted because assessment criteria were stated on-page. |
| VOICE-S030 | RSL MT / Performance Arts vocal source | No current official current-source resolution secured during this run within the assigned pack. | — | No | Possible family gap | Closed as out of scope/current-source-not-located. |
| VOICE-S031 | Additional current official source | No exact VOICE-S0 alternate source row supplied in this turn. | — | No | Placeholder row | Closed as provenance unclear rather than inventing a replacement. |

## Source ledger and evidence notes

**Source Extraction Ledger**  
For readability, the requested long field list is compressed into the following columns: Tech = explicit vocal technical criteria; Mus/Interp = musical or interpretive criteria; Dict/Lang = diction/language/intelligibility; Style/Rep = style/genre/repertoire; Char/Story = acting-through-song/character/story; Perf/Comm = performance/communication; Acc/Dig = accompaniment or recorded/digital guidance; Aural/Mus = sight-singing/aural/musicianship; Access = accessibility/fairness; V-health = vocal health/sustainability; Tape = tape-observable support; Process = process/live-room/formal-only support.

| Source ID | Context | Status | Tech | Mus/Interp | Dict/Lang | Style/Rep | Char/Story | Perf/Comm | Acc/Dig | Aural/Mus | Access | V-health | Tape | Process | Exclude from TapeCoach | Key limitation | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S021 | LAMDA Musical Theatre Solo/Duo | Fully extracted | Y | Y | Y | Y | Y | Y | P | Knowledge/Q&A | Y | P | Y | Y | LAMDA marks, attainment bands, spoken-song structure | LAMDA exam format is MT-specific and partly question-led | Carry to VOICE-SYN |
| S022 | LAMDA Singing | Out of scope | N | N | N | N | N | N | N | N | N | N | N | N | Do not invent a missing source family | No standalone qualification located in accessed official pages | Carry as limitation |
| S023 | Trinity Musical Theatre | Fully extracted | Y | Y | Y | Y | Y | Y | Y | Reflection/supporting tasks | P | N | Y | Y | Trinity grade descriptors and movement-integrated structure | Includes movement and some reflection tasks not transferable to Song-only by default | Carry to VOICE-SYN |
| S024 | Trinity Singing | Partial | P | P | P | Y | P | P | Y | Sight-reading | P | P | Y | Y | Trinity syllabus architecture / book model as scoring logic | Direct public syllabus PDF fetch throttled; singing descriptors dispersed | Carry with caveat |
| S025 | ABRSM Singing | Fully extracted | Y | Y | P | Y | P | Y | P | Y | Y | N | Y | Y | ABRSM marks/grade bands/route rules | Diction-specific language is thinner than pitch/time/tone/shape | Carry to VOICE-SYN |
| S026 | ABRSM Singing for MT | Fully extracted | Y | Y | P | Y | Y | Y | P | Y | Y | N | Y | Y | ABRSM route structure and marks | Some evidence belongs to exam supporting tests, not tape-only song performance | Carry to VOICE-SYN |
| S027 | LCME Musical Theatre | Fully extracted | Y | Y | Y | Y | Y | Y | Y | Discussion | P | N | Y | Y | LCME weightings and domain percentages | Includes written programme/discussion elements that are formal/process-only | Carry to VOICE-SYN |
| S028 | LCME Singing | Partial | P | P | P | Y | N | P | P | Y | P | N | P | Y | LCME grade bands and general music weighting | Public current source is general rather than rich singing-specific descriptor matrix | Carry with caveat |
| S029 | RSL Vocals | Fully extracted | Y | Y | N | Y | P | Y | P | Y | N | N | Y | Y | RSL marks/percentages and course structure | Belt/mix/registration detail not explicit in accessed official page | Carry to VOICE-SYN |
| S030 | RSL MT / Performance Arts Vocal | Out of scope | N | N | N | N | N | N | N | N | N | N | N | N | Do not invent a current framework | Current official equivalent not securely located | Carry as limitation |
| S031 | Additional current official source | Provenance unclear | N | N | N | N | N | N | N | N | N | N | N | N | Do not backfill with an invented row | Exact VOICE-S0 alternate row absent | Carry as limitation |

**Source-by-Source Evidence Notes**

**VOICE-S021 — LAMDA Exams Musical Theatre**  
The official LAMDA Musical Theatre Solo/Duo syllabus is criterion-referenced and repeatedly couples interpretation with technique. Across grades it names audibility, fluency, focus, clear diction, accurate melody and rhythm, sustained vocal control, and—at higher levels—appropriate breathing, voice production and resonance. It also expects understanding of character, mood, place/period, and response to the vocal demands of characterisation, plus question-based knowledge tasks. Reasonable adjustments are explicitly built into the qualification framework. This source can later support observable wording for clarity, control, melody/rhythm, diction, resonance-like description and acting-through-song, but it cannot support importing LAMDA marks, grade bands, knowledge-question structures or spoken-song exam design into TapeCoach. Evidence is mixed: much is tape-observable, while knowledge answers and some grade-specific tasks are process/exam-only. citeturn16view0turn26view0turn27view2turn27view4turn27view5

**VOICE-S022 — LAMDA Exams Singing**  
Within the official LAMDA exam families accessed in this run, the public syllabus/download-centre material showed Introductory, Performance, Communication, Musical Theatre, Group, PCertLAM and Shakespeare families, but no standalone Singing qualification row. This row therefore cannot support Voice/Singing descriptor extraction and is closed as out of scope rather than left unresolved. citeturn16view0

**VOICE-S023 — Trinity College London Musical Theatre**  
The official Trinity Musical Theatre syllabus provides unusually direct acting-through-song language. Candidates are expected to sing and move in time with the music, perform audibly, clearly and accurately, vary pace, pitch and volume to create character and support narrative, use movement/dance and space to support character and narrative, communicate understanding of the material and connection with character, make choices of interpretation, and communicate meaning and mood with audience awareness. It also exists explicitly in face-to-face and digital formats. This can later support integrated MT descriptors and claim-scope rules, but it cannot justify importing Trinity’s movement expectations or qualification structure into Song-only casting-tape scoring. Evidence is mixed: core performance language is observable, while reflection/supporting-task elements are formal-framework/process-only. citeturn18view1turn18view3turn18view4

**VOICE-S024 — Trinity College London Singing**  
The official Trinity Singing overview confirms a current 2023 syllabus approach with digital and face-to-face delivery, broad style/genre range, separate high/low voice books without gender restriction, a dedicated sight-reading format for singers, and strong Musical Theatre presence inside the broader singing route. Official digital-recording guidance requires a quiet space, whole body and face in view, enough facial visibility to assess focus and personal investment, one continuous take, and allows recorded accompaniments in digital exams. The public page also points to healthy vocal technique as a teaching/publication theme. This source can later support wide style-range language, assessability-first framing and digital capture conditions, but the direct public syllabus fetch was throttled, so fine-grained singing descriptors remain partial. It cannot support importing Trinity’s product/book architecture or digital-exam rules wholesale into TapeCoach scoring. Evidence is mixed and partly dispersed. citeturn34view1turn34view2turn34view4turn35view1turn35view2turn36view3turn37view1

**VOICE-S025 — ABRSM Singing**  
The official ABRSM Singing qualification specification and official marking criteria converge on a stable descriptor family: pitch, time, tone, shape and performance. The marking criteria then unpack these into notes/intonation, tempo/rhythmic character, well projected or controlled tonal qualities, expressive musical shaping/detail, and communication of character and style. The singing specification also keeps songs flexible as to key and language/translation, and includes access arrangements for candidates with specific needs. This source can later support precise non-generic language for pitch/intonation, tempo/rhythm, tone/tonal awareness, shape/phrasing and performance communication, especially in classical/legit and formal singing contexts. It cannot support importing ABRSM marks, distinctions/merits, full exam structure, or sight-singing/aural tasks as equivalent to a finished song self-tape. Evidence is mixed between tape-observable performance and formal supporting tests. citeturn28view1turn28view3turn30view4turn31view0turn31view2turn31view3turn31view6turn32view1turn32view3

**VOICE-S026 — ABRSM Singing for Musical Theatre**  
The official ABRSM Singing for Musical Theatre practical syllabus is one of the strongest formal MT vocal sources in this batch. It explicitly frames the route around three accompanied songs and one unaccompanied song, communication of character and style, relevant sight-singing for MT singers, aural tests, and fair access arrangements. The official marking criteria add notes/intonation, rhythm, tonal qualities, musical shaping/detail and vivid story-telling. The performance-grade route adds whole-programme musical intent, communication, interpretation, delivery and even stamina/control across transitions. This source can later support acting-through-song, unaccompanied singing, musical communication, interpretation and careful use of “story-telling” language. It cannot support importing ABRSM route design, marks, or supporting-test expectations as direct Song-tape scoring logic. Evidence is mixed between tape-observable performance and formal exam components. citeturn28view0turn28view2turn28view3turn29view3turn29view4turn29view5turn29view8turn32view1

**VOICE-S027 — LCME Musical Theatre**  
The official LCME *Musical Theatre for Singers* syllabus supplies unusually explicit assessment-domain wording. Its assessment objectives are technical accomplishment, interpretation, knowledge and understanding, and communication. It names audibility, clarity of diction, fluency, projection, intonation, sense of spontaneity, character portrayal, movement and gesture, use of space, facial expression, accent, breath control, and variety as part of technical accomplishment, while higher grades require seamless integration of vocal and dramatic skills and thoughtful interpretation of musical and textual syntax to convey subtleties of meaning. The official digital-recording guidance then adds quiet room, static camera, single microphone, sufficient quality for tone quality and dynamic range, candidate continuously in shot, balanced backing track, and one continuous unedited file. This can later support rich observable MT-for-singers language and assessability rules. It cannot support importing LCME percentages, discussion/written-programme requirements, or assuming all singing assessment includes movement/space. Evidence is strongly mixed across tape-observable performance and process-only discussion/knowledge components. citeturn18view7turn18view8turn18view9turn38view0turn38view3turn38view5turn39view3

**VOICE-S028 — LCME Singing**  
The official LCME Classical Singing page confirms a formal classical route with technical work, performance, discussion, sight reading and aural tests, while the currently linked public syllabus for Classical Singing resolves through the broader *Music Grades* specification. That broader framework supports classical/formal route boundaries, discussion-based musicianship, stylistic range and formal assessment architecture, but it gives thinner singing-specific descriptor detail than the MT-for-singers syllabus. This row can therefore support classical/art-song context and formal-framework task boundaries, but it cannot carry a rich singing-only descriptor family on its own and should be treated as partial evidence. It also cannot justify importing general LCME grade bands or percentages into TapeCoach. citeturn20view1turn21view0turn21view1turn21view2turn22view0

**VOICE-S029 — RSL / Rockschool Vocals**  
The official Rockschool/RSL Vocals course page was sufficient to close the row because it states both exam structure and assessment criteria. For performance pieces it names clear production of sound and even tone quality, synchronisation to music or internal pulse, accuracy and understanding of musical structure, and convincing projection/style-expression. The same official page also keeps unseen tests, ear tests and general musicianship questions as separate formal components, including improvisation and interpretation or quick-study work at different levels. This source can later support contemporary/pop-friendly wording for pulse, tone evenness, projection, structural understanding and interpretation. It cannot support importing RSL marks or course architecture, and it does not provide strong explicit belt/mix language in the accessed official source. Evidence is mixed between tape-observable performance and formal supporting tests. citeturn11view4turn13view4

**VOICE-S030 — RSL Musical Theatre / Performance Arts Vocal Source**  
No current official RSL musical-theatre/performance-arts vocal framework was safely resolved inside the assigned pack during this run. The row is therefore closed as out of scope/current-source-not-located and must not be treated as positive evidence.

**VOICE-S031 — Additional current official source**  
Because the exact VOICE-S0 alternate official row was not supplied in this turn, the placeholder could not be safely remapped without inventing a source family. It is closed as provenance unclear and should remain a limitation in later synthesis.

## Descriptor and boundary evidence

**Formal Descriptor Evidence Table**

| Descriptor topic | Source ID(s) | Explicit descriptor evidence found | Evidence type | Confidence | Later rubric relevance | Caution |
|---|---|---|---|---|---|---|
| Pitch accuracy | S021, S025, S026, S027, S029 | “accurate melody”, “notes and intonation”, “accurate notes/pitch/key”, “intonation”, “accuracy & understanding”. citeturn27view5turn32view1turn18view8turn13view4 | Tape-observable | High | Strong observable vocal criterion | Do not collapse into generic “secure pitch” without moment-level evidence later. |
| Intonation | S025, S026, S027 | “notes and intonation”, “reliable pitch and intonation”, “intonation”. citeturn32view1turn29view3turn18view8 | Tape-observable | High | Strong sung-vocal descriptor | Still separate from diagnosis or fatigue claims. |
| Rhythm / timing | S021, S023, S025, S026, S027, S029 | “accurate rhythm”, “in time with the music”, “rhythmic character”, “stable rhythm”, “synced to music”. citeturn27view5turn18view1turn32view1turn29view3turn13view4 | Tape-observable | High | Strong criterion | Avoid inferring musical reading skill from finished performance alone. |
| Tempo | S023, S025, S029 | “pace… to create character”, “suitable tempo”, “sustained effective tempo”, “sync or pulse”. citeturn18view1turn32view1turn13view4 | Tape-observable | High | Useful report wording | Must stay observable, not pedagogy-heavy. |
| Phrasing | S025, S026, S027 | ABRSM “shape” / “musical shaping”; LCME phrasing inside technical security. citeturn31view3turn32view1turn18view8 | Tape-observable | High | Replaces generic “good phrasing” | Needs phrase or timestamp evidence later. |
| Breath management | S021, S027 | LAMDA “breathing”; LCME “breath control”. citeturn27view5turn18view8 | Partial tape-observable | Medium | Supports cautious observable breath language | Do not diagnose health or prescribe technique. |
| Support | S021 | “sustained vocal control” and breathing/voice-production support language in higher grades. citeturn27view5 | Partial tape-observable | Medium | Useful but cautious | “Support” remains method-loaded; use only where clearly observable. |
| Diction / articulation | S021, S027 | “clear diction”; “clarity of diction”. citeturn27view5turn18view8 | Tape-observable | High | Strong anti-generic descriptor | Needs accent-bias watchlist later. |
| Vowel / consonant clarity | — | Not explicit enough across this batch | — | Low | Remains a gap | Carry to later synthesis cautiously, if at all. |
| Language / pronunciation | S025, S028 | ABRSM language/translation flexibility; LCME classical route formal language use. citeturn30view4turn21view1 | Formal + taped if audible | Medium | Useful for classical/art-song handling | Do not turn language choice into bias or purity policing. |
| Tone / tonal quality | S025, S026, S029 | “tone”, “tonal qualities”, “tonal control”, “even tone quality”. citeturn31view2turn32view1turn13view4 | Tape-observable | High | Strong non-generic wording family | Still needs specific evidence. |
| Resonance | S021 | “resonance” named in higher LAMDA MT levels. citeturn27view5 | Partial tape-observable | Medium | Cautious specialised descriptor | Avoid pseudo-clinical claims. |
| Dynamic control | S023, S027 | Trinity pace/pitch/volume variation; LCME dynamic range in digital assessability. citeturn18view1turn38view5 | Tape-observable | Medium | Useful for expressive control | Thin as a formal descriptor family in this batch. |
| Range / tessitura | S024, S025, S026 | High/low voice book split; vocal ranges and published keys; unaccompanied + accompanied route structures. citeturn34view2turn30view4turn28view0 | Partial taper + formal list context | Medium | Useful for material-demand language | Do not turn range labels into type-casting claims. |
| Registration | S021 | Voice production/resonance implied; no robust cross-source registration matrix | Partial | Low | Limited | Needs later gap handling. |
| Belt | — | No explicit formal descriptor support located in this batch | — | Low | Gap remains | Carry to B3/B4/gap list. |
| Mix | — | No explicit formal descriptor support located in this batch | — | Low | Gap remains | Carry to B3/B4/gap list. |
| Legit / classical | S024, S025, S028 | Classical songs, art songs, language repertoire, classical singing formal routes. citeturn34view2turn30view4turn21view1 | Formal + partly tape-observable | High | Strong subtype anchor | Not the only valid standard for Song or MT. |
| Style / genre authenticity | S023, S024, S025, S026, S027, S029 | Trinity “engaging with the styles”; ABRSM “character and style”; LCME programme variety/genres/styles; RSL style & expression. citeturn18view1turn34view2turn29view4turn18view7turn13view4 | Tape-observable | High | Rich anti-generic language | Avoid importing one framework’s stylistic taste as universal. |
| Musicality | S023, S026, S029 | Trinity “musicality”; ABRSM story-oriented shaping/performance; RSL musical structure and projection. citeturn18view0turn29view4turn13view4 | Tape-observable | High | Strong report language | Needs concrete evidence later. |
| Musical intelligence | S026 | ABRSM supporting tests framed as ear/pulse/melodic understanding relevant to MT singers. citeturn28view0 | Formal/process-only mostly | Medium | Important boundary marker | Do not overclaim from a finished tape alone. |
| Interpretation | S021, S023, S025, S026, S027, S029 | Explicit “interpretation”, “choices of interpretation”, “shape”, “story-telling”. citeturn27view4turn18view1turn32view1turn18view7turn39view3turn13view4 | Tape-observable | High | Core criterion family | Must not become scene-acting leakage in Song-only outputs. |
| Musical communication | S025, S026, S027 | “communication of character and style”; LCME “communication”; ABRSM overall communication/delivery. citeturn29view4turn29view8turn39view3 | Tape-observable | High | Strong alternative to generic praise | Needs material-specific proof later. |
| Lyric intention | S021, S023, S026, S027 | Character/mood/narrative language supports lyric-intention handling even where the exact term is not repeated. citeturn27view2turn18view1turn29view8turn18view7 | Partial tape-observable | Medium | Important later rubric bridge | More explicit lyric-level evidence still needed in synthesis. |
| Acting-through-song | S021, S023, S026, S027 | Characterisation, story, narrative support, connection with character, response to vocal demands of characterisation. citeturn27view5turn18view1turn29view8turn18view7 | Tape-observable | High | Strong B2 contribution | Must remain song-framed, not scene-reader-framed. |
| Characterisation through song | S021, S023, S026, S027 | Character, mood, situation, narrative, spontaneity, portrayal. citeturn27view2turn18view1turn29view4turn18view8 | Tape-observable | High | Strong criterion | Needs moment-specific evidence later. |
| Emotional arc | S021, S027 | Mood, subtleties of meaning, emotional range, universal themes. citeturn27view5turn18view7 | Partial tape-observable | Medium | Useful anti-generic descriptor | Thin outside a few frameworks. |
| Performance presence | S021, S023, S025, S027, S029 | Audience awareness, confident/assured performance, convincing projection. citeturn26view0turn18view1turn32view1turn39view3turn13view4 | Tape-observable | High | Strong report language | Must not blur into appearance or charisma bias. |
| Accompaniment / ensemble relationship | S024, S026, S027 | Recorded/live accompaniment rules, interacting with another musician, balance requirements. citeturn37view1turn28view0turn38view3 | Partial tape-observable + process | Medium | Useful for balance/relationship wording | Not all self-tapes will make this assessable. |
| Sight-singing / aural / musicianship | S025, S026, S028, S029 | Separate formal supporting tests and musicianship questions. citeturn28view0turn30view4turn21view1turn13view4 | Formal/process-only | High | Strong boundary evidence | Must not be inferred from finished-tape performance. |
| Vocal stamina / sustainability | S026 | Performance-grades whole-programme delivery/control across transitions and stamina. citeturn29view8 | Partial, programme-specific | Low/Medium | Boundary aid | Not a diagnostic or general tape-only criterion. |
| Digital / recorded assessment guidance | S023, S024, S027 | Digital formats, whole body/face visibility, one continuous take, quiet room, sufficient quality, balanced accompaniment. citeturn18view3turn37view1turn38view0turn38view5 | Assessability/process | High | Strong later B3 bridge | These are assessability conditions, not artistic merit. |

**Tape-Observable versus Formal / Process-Only Boundary**

| Evidence type | Tape-observable? | Formal-framework / live-room / process-only? | Conditions required to assess fairly | Source ID(s) | Later-use caution |
|---|---|---|---|---|---|
| Pitch accuracy | Yes | — | Clear enough audio; stable enough accompaniment/reference | S021, S025, S026, S027, S029 | Do not overstate if audio is poor. |
| Rhythm / timing | Yes | — | Audible pulse/accompaniment or internally clear rhythmic line | S021, S023, S025, S026, S029 | Separate from sight-singing ability. |
| Tone | Partial | — | Recording must preserve vocal quality reasonably | S025, S026, S029 | Poor capture can distort perceived tone. |
| Diction / intelligibility | Yes | — | Speech/music balance sufficient; style/language context known where possible | S021, S027 | Keep accent-bias safeguards. |
| Breath / support | Partial | — | Visible/audible phrase management actually assessable | S021, S027 | Avoid diagnostic or method-based claims. |
| Range | Partial | Formal list context often needed | Material must actually expose upper/lower demands | S024, S025, S026 | Do not infer full range from one cut. |
| Registration / belt / mix / legit | Partial to no | Often framework-only unless directly audible | Clear exemplar material and stable recording | Mostly thin in B2 | Do not force unsupported labels. |
| Style authenticity | Partial | — | Style or repertoire context reasonably identifiable | S023, S024, S025, S026, S027, S029 | Avoid prescriptive taste-policing. |
| Musical interpretation | Yes, partial | — | Material choices must be observable in phrasing/dynamics/character | S021, S023, S025, S026, S027 | Needs specific performance evidence. |
| Lyric intention | Partial | — | Words and intention must be intelligible enough | S021, S023, S026, S027 | Do not invent text-level intention if inaudible. |
| Acting-through-song | Yes | — | Character/story work has to be visible in song behaviour | S021, S023, S026, S027 | Keep it song-framed, not scene-framed. |
| Emotional arc | Partial | — | Enough duration and textual clarity to perceive development | S021, S027 | Thin evidence if cut is very short. |
| Performance presence | Yes | — | Candidate visible enough; performance readable | S021, S023, S025, S027, S029 | Do not let “presence” drift into appearance bias. |
| Sight-singing | No | Formal/process-only | Requires unseen test context | S025, S026, S028, S029 | Must not be inferred from a prepared tape. |
| Aural tests | No | Formal/process-only | Requires examiner-led prompts | S025, S026, S028, S029 | Same caution. |
| Musicianship tests | No | Formal/process-only | Requires separate task or Q&A | S021, S026, S028, S029 | Same caution. |
| Vocal stamina | Partial at best | Programme-specific or live/process | Longer continuous programme needed | S026 | Do not claim from a short tape. |
| Vocal health / safe voice use | No/partial | Formal-only / safety-limited | Only cautious observable wording allowed | Thin in B2 | Full safety boundary remains B4. |
| Accompaniment balance | Yes | Assessability/process | Balanced capture between singer and track/accompanist | S024, S026, S027 | Treat as audio/assessability, not talent. |
| Recorded-audio assessability | Yes | Process/technical | Quiet room, continuous take, visible performer, usable file | S023, S024, S027 | Must not be treated as production-polish merit. |
| External marks / grades / levels | No | Formal-framework-only | N/A | All formal frameworks | Must never become TapeCoach weights. |

**Style / Subtype Descriptor Map**

| Style / subtype | Source ID(s) | Descriptor evidence found | Confidence | Real source-supported distinction? | What must not be assumed? | Carry to VOICE-SYN? | Later caution |
|---|---|---|---|---:|---|---:|---|
| Classical / legit | S024, S025, S028 | Formal classical repertoire, art songs, language lists, classical singing route | High | Yes | Not the universal standard for all song work | Yes | Keep separate from MT/pop criteria. |
| Contemporary MT | S021, S023, S024, S026, S027 | Character/style/story communication within MT frameworks | High | Yes | Not every song tape is MT | Yes | Preserve Song/MT distinction. |
| Belt | — | No explicit descriptor family securely found in this batch | Low | No | Do not label belt from guesswork | No | Gap remains. |
| Mix | — | No explicit descriptor family securely found in this batch | Low | No | Do not label mix from guesswork | No | Gap remains. |
| Pop-rock | S029 | Contemporary vocals assessment criteria, projection, pulse, structure | Medium | Yes, partially | One contemporary framework is not a universal pop-rock rule | Yes | More detail needed later. |
| Jazz | S024, S028 (broad only) | Broad stylistic range; no robust jazz-specific descriptor matrix located | Low | Thin | Do not claim a jazz rubric from this batch | Partial | Gap remains. |
| Folk | S024, S025 | Folk/traditional repertoire presence | Medium | Yes, as repertoire family | Repertoire family does not equal descriptor family by itself | Partial | Descriptor language still thin. |
| Commercial/pop vocal | S029 | Contemporary vocal performance criteria | Medium | Yes, partially | Do not collapse all commercial singing into one tone standard | Yes | Needs B3 process/casting support. |
| Classical art song / opera-adjacent | S025, S028 | Art song languages, classical singing route | High | Yes | Not every legit song is art song | Yes | Keep repertoire-context aware. |
| Actor-musician | — | Not meaningfully touched in B2 | Low | No | Do not infer from accompaniment alone | No | Remains B1/B3 territory. |
| Unaccompanied singing | S026, S025 | Unaccompanied song/traditional song as formal component | High | Yes | Unaccompanied exam component is not universal audition practice | Yes | Distinguish from accompanied song expectations. |
| Accompanied / backing-track contexts | S024, S026, S027 | Recorded or live accompaniment rules, balance requirements | High | Yes | Balance rules are assessability rules, not artistry | Yes | Important for audio vs vocal separation. |
| Audition cut / prepared song context | S021, S026, S027 | Prepared songs/programmes, but not casting-cut-specific | Medium | Partial | Do not equate exam programme rules with audition cuts | Partial | Needs B3. |
| Song-only self-tape / digital exam context | S023, S024, S027 | Digital submission, filming guidance, continuous take | High | Yes | Exam capture rules are not 1:1 casting rules | Yes | Use for assessability, not scoring weight. |
| MT song in multi-component tape | S021, S023, S026, S027 | MT frameworks explicitly combine vocal and interpretive/story evidence | High | Yes | Does not justify scene-language leakage into song-only reports | Yes | Strong synergy with MT anchor. |

## Risk mapping and provisional findings

**Preliminary Risk-to-Evidence Mapping**

| Risk ID | Risk title | B2 evidence position | Does B2 reduce this risk? | Remaining gap | Later batch / stage | Caution |
|---|---|---|---:|---|---|---|
| VOICE-PRE-I01 | Technique over story | Strongly constrained by ABRSM, Trinity MT, LAMDA, LCME MT, RSL communication/interpretation/story descriptors | Yes | Need output rules that force evidence at phrase/material level | Synthesis, output-spec | Avoid replacing one genericity with another. |
| VOICE-PRE-I02 | Style/genre not captured | Partially reduced by classical/MT/pop formal routes | Partial | Belt/mix/jazz/folk/commercial detail remains thin | B3, B4, synthesis | No single universal style map. |
| VOICE-PRE-I03 | Vocal-health diagnosis risk | B2 gives only cautious non-diagnostic breathing/resonance/healthy-technique hints | Partial | Proper health-safety boundary still missing | B4 | Do not infer pathology from formal technique language. |
| VOICE-PRE-I04 | Singing label leakage into non-singing auditions | B2 does not materially address cross-discipline UI/label behaviour | No | Acting/Dance display semantics remain later-stage work | Output-spec | Keep as architectural/display risk. |
| VOICE-PRE-I05 | Acting-scene language leaking into song-only reports | B2 supports story/character through song, not reader/scene language | Partial | Later claim-scope rules still needed | Synthesis, output-spec | “Character/story” must remain song-rooted. |
| VOICE-PRE-I06 | Musical interpretation implicit | Strongly reduced by interpretation/communication descriptor families | Yes | Still needs visible report behaviour later | Synthesis, revision, output-spec | Do not create a new score field. |
| VOICE-PRE-I07 | Repertoire advice overreach | Formal frameworks discuss suitability/selection, but cautiously and contextually | Partial | Need strong fixed-material boundary later | Synthesis, output-spec | Do not turn exam repertoire planning into blanket tape advice. |
| VOICE-PRE-I08 | Fixed-material policy breach | B2 does not justify substitute-material advice | Partial | Needs explicit later guardrail | Synthesis, output-spec | Preserve existing material policy. |
| VOICE-PRE-I09 | Production/audio polish as vocal merit | Digital rules stress quiet, capture sufficiency, continuous take, balance—not polish | Yes, partially | Professional self-tape process sources still needed | B3 | Assessability is not artistry. |
| VOICE-PRE-I10 | Accent/diction/speech-difference bias | Some access language and LAMDA “no need to conform to all British Standard English features” style caution help | Partial | Speech-difference, accent and inclusive voice practice remain thin | B4 | Diction must not become accent policing. |
| VOICE-PRE-I11 | Live-room stamina/direction overclaim | Formal frameworks separate sight-singing, aural, discussion, Q&A and some programme stamina from finished tape evidence | Yes, partially | Casting-room direction response still not covered | B3, output-spec | Preserve process-only boundaries. |
| VOICE-PRE-I12 | Generic vocal praise | Strongly reduced by descriptor families for pitch/time/tone/shape/story/comms | Yes | Needs report-level evidence forcing later | Synthesis, output-spec | Descriptors still need moment anchors. |
| VOICE-PRE-I13 | Timestamp underproduction | B2 does not address timestamp rendering or count | No | Still a product/output issue | Output-spec, live QA | Remains untouched by formal-framework extraction. |

**B1-to-B2 Evidence Comparison**

| Evidence area | What B1 established | What B2 adds | Source ID(s) | Confidence | Later synthesis implication | Caution |
|---|---|---|---|---|---|---|
| Song contrast | Official admissions use contrast, but not uniformly | Formal frameworks support style families and repertoire grouping, but still not one universal contrast law | S023, S024, S025, S026, S028 | High | Keep subtype map flexible, not fixed | No universal pre/post-year rule import. |
| Style/subtype map | Classical/legit, contemporary MT, actor-musician, pop-commercial crossover, unaccompanied song surfaced | Formal frameworks strengthen classical, MT and contemporary/pop boundaries; belt/mix remain thin | S024, S025, S026, S027, S029 | High/Medium | Build supported map with explicit gaps | Do not invent unsupported labels. |
| Vocal technique descriptors | B1 had general admissions language | B2 adds pitch/time/tone/shape, diction, fluency, audibility, breathing/resonance, pulse and projection | S021, S025, S026, S027, S029 | High | Strong vocabulary expansion for later prompts/reports | Still needs claim-scope controls. |
| Pitch/rhythm/tone language | Thin in B1 | Strong in B2 | S021, S025, S026, S027, S029 | High | Major non-generic gain | Must stay observable. |
| Lyric/story interpretation | B1 showed story-through-song demand | B2 formalises interpretation/communication/character/style/story descriptors | S021, S023, S026, S027 | High | Supports visible story language within Song | Avoid scene-language leakage. |
| Acting-through-song | B1 strongly supported | B2 strongly confirms via MT formal frameworks | S021, S023, S026, S027 | High | Now a secure synthesis pillar | Still no new score field authorised. |
| Musical interpretation | B1 said it mattered but was implicit | B2 supplies explicit interpretation/shape/communication wording | S021, S025, S026, S027, S029 | High | Can become report-visible wording later | Not a new schema element. |
| Recorded assessability | B1 supported clear sound/simple capture | B2 adds continuous-take, quiet room, face/body visibility, static camera, balance guidance | S023, S024, S027 | High | Strong bridge into B3/self-tape process batch | Keep “assessability not merit” rule. |
| Process-only musicianship | B1 separated recalls/workshops etc. | B2 adds sight-singing, aural, discussion, Q&A, general musicianship as formal/process-only | S021, S025, S026, S028, S029 | High | Strong claim-scope boundary | Do not infer from finished tape. |
| Access / fairness | B1 showed low-resource/simple-capture ethos | B2 adds formal access arrangements and reasonable adjustments language | S021, S024, S025, S026, S028 | Medium | Useful fairness spine | Detailed inclusive voice guidance still deferred. |
| Vocal-health safety | B1 underdeveloped | B2 adds only light breathing/resonance/healthy-technique hints | S021, S024 | Low/Medium | Explicit B4 dependency confirmed | Do not over-read. |
| Marks/grades exclusion | B1 warned against importing external scoring | B2 confirms every formal framework is mark/grade-based and therefore must be excluded from TapeCoach weights | All formal frameworks | High | Strong boundary for later synthesis | Must be restated in audit/revision stages. |

**Provisional VOICE-B2 Findings**

| Finding ID | Finding statement | Supported by | Source type | Area affected | Implication type | Confidence | Why it matters later | Caution / limitation | Likely synthesis relevance |
|---|---|---|---|---|---|---|---|---|---|
| VOICE-B2-F01 | Formal singing and MT frameworks converge on a two-part descriptor spine: observable vocal control language (pitch/time/tone/clarity/control) plus observable communication/interpretation language (shape/story/character/style/communication). | S021, S023, S025, S026, S027, S029 | Formal frameworks | Vocal + acting/storytelling in Song/MT | Tape-observable | High | It directly addresses generic vocal praise and technique-only drift | Descriptor families vary and must not be turned into imported weights or grade bands | High |
| VOICE-B2-F02 | Formal frameworks sharply separate prepared performance evidence from formal supporting-test or process evidence such as sight-singing, aural tests, discussion, musicianship questions, reflection and some whole-programme stamina claims. | S021, S023, S024, S025, S026, S027, S028, S029 | Formal frameworks + digital rules | Claim-scope rules | Formal-only / process-only boundary | High | It protects TapeCoach from overclaiming live-room or exam-task capacities from a finished tape | Some routes combine these in one qualification, so later wording must separate them carefully | High |
| VOICE-B2-F03 | Official digital/formal recording guidance consistently treats capture quality as an assessability condition: quiet space, stable framing, visible face/body, one continuous take, balanced accompaniment and usable audio are required so performance can be judged, but they are not artistic merit in themselves. | S023, S024, S027 | Digital assessment guidance | Technical/audio versus vocal merit | Assessability/process | High | It strengthens the separation between singing quality and production polish | These are exam/digital guidance sources, not full casting self-tape sources; B3 is still needed | High |

**Evidence-to-Source Traceability Matrix**

| Finding ID | Source ID(s) | Source family | Evidence summary | Likely later rubric area | Confidence | Limitation | Later stage affected |
|---|---|---|---|---|---|---|---|
| VOICE-B2-F01 | S021, S023, S025, S026, S027, S029 | Formal frameworks | Pitch/time/tone/control + interpretation/character/style/communication repeatedly co-present | Vocal field semantics; Song acting/storytelling wording; generic-feedback suppression | High | Belt/mix and some diction specificity remain thin | VOICE-SYN, gap audit, output-spec |
| VOICE-B2-F02 | S021, S023, S024, S025, S026, S027, S028, S029 | Formal frameworks + digital | Sight-singing, aural, discussion, reflection, musicianship and some stamina belong to separate formal tasks | Claim-scope rules; “do not score unsupported criteria” guardrails | High | Some frameworks bundle these closely, so later wording must unpack them | VOICE-SYN, audit, output-spec |
| VOICE-B2-F03 | S023, S024, S027 | Digital assessment guidance | Quiet room, visible performer, one take, balanced accompaniment, sufficient quality | Technical/audio/assessability language; anti-polish bias | High | Exam capture guidance is not identical to professional casting tape guidance | VOICE-SYN, VOICE-B3, output-spec |

## Compatibility, gaps and completion

**Source-Type Boundary Check**

| Source type | Source IDs | What this source type can support | What it must not support | Boundary caution |
|---|---|---|---|---|
| Formal singing frameworks | S024, S025, S028 | Observable singing vocabulary; formal route boundaries; some access wording | TapeCoach weights, grade bands, exam architecture as universal scoring | Use descriptor language, not scoring logic. |
| Musical theatre formal frameworks | S021, S023, S026, S027 | Acting-through-song, character/story, MT communication, integrated interpretation | Universal movement requirements or question-led structures in Song-only tapes | MT-specific evidence stays MT-specific. |
| Classical voice frameworks | S024, S025, S028 | Legit/classical/art-song context; language/repertoire boundaries | Universal vocal ideal for all genres | Keep subtype-specific. |
| Contemporary / pop / rock vocal frameworks | S029 | Pulse, projection, tone consistency, structure, interpretation in contemporary context | Universal CCM benchmark; appearance/mic style rules as merit | Contemporary evidence remains style-bounded. |
| Recorded / digital assessment guidance | S023, S024, S027 | Assessability rules, capture sufficiency, one-take guidance, accompaniment balance | Aesthetic production standards as talent evidence | Treat as assessability/process only. |
| Aural / musicianship sources | S021, S025, S026, S028, S029 | Claim-scope boundaries for unseen/music-theory-adjacent skills | Song-tape scoring criteria | Strong “do not infer from prepared tape” rule. |
| Repertoire / syllabus sources | S021–S029 where relevant | Style families, language, formal task design, material suitability in context | Blanket repertoire policing or replacement advice | Maintain fixed-material guardrails. |
| Accessibility / inclusive notes inside formal frameworks | S021, S024, S025, S026, S028 | Access arrangements, fair-access wording, reasonable adjustments | Deficit framing or health inference | Detailed inclusive voice practice still needs B4. |

**Baseline Compatibility and Preservation Check**

All B2 extraction remains compatible with the current live TapeCoach baseline and implies **no** score-field, weighting, cap, blocker, verdict, role-fit, schema, backend or pipeline change. It preserves the live six-field model, the current Song and MT weight structures, server-side recomputation, Step 1/Step 2 separation, locked-field enforcement and the protected MT acting+song anchor. fileciteturn0file0 fileciteturn0file3 fileciteturn0file5

| Preservation check | Result |
|---|---:|
| No score-field changes implied | Confirmed |
| No weighting changes implied | Confirmed |
| No cap / blocker / verdict changes implied | Confirmed |
| No schema changes implied | Confirmed |
| No backend / pipeline changes implied | Confirmed |
| No role-fit bound changes implied | Confirmed |
| No Musical Theatre regression introduced | Confirmed |
| No Vocal hiding in genuine Song / MT contexts | Confirmed |
| No singing label leakage into Acting / Dance implied | Confirmed |
| No external marks / grades / percentages imported as TapeCoach weights | Confirmed |
| No source-specific style rule imported as universal scoring | Confirmed |
| No vocal-health diagnosis implied | Confirmed |
| No access deficit inference implied | Confirmed |
| No production polish or paid-resource access treated as vocal merit | Confirmed |

**Coverage Gaps and Defer List**

| Gap / limitation | Why it remains open after B2 | Related source ID(s) | Later batch / stage | Carry as limitation? | Note |
|---|---|---|---|---:|---|
| Vocal-health / sustainability diagnosis boundary | Only light breathing/resonance/healthy-technique language surfaced; no robust safe diagnostic boundary | S021, S024, S026 | VOICE-B4 | Yes | Do not diagnose from tape. |
| Belt / mix / registration language | Formal B2 evidence is still too thin | — | VOICE-B3 / B4 / synthesis | Yes | Explicit gap. |
| Pop-rock / jazz / folk / commercial descriptors | Pop/contemporary improved; jazz/folk/commercial still thin or repertoire-led rather than descriptor-led | S024, S029 | VOICE-B3 / synthesis | Yes | Likely needs professional-process sources. |
| Accessibility / speech-difference / gender-diverse voice | Formal access notes exist, but inclusive voice detail is still broad | S021, S024, S025, S026, S028 | VOICE-B4 | Yes | Strong B4 dependency. |
| Professional self-tape / audio process guidance | Formal digital-exam guidance is useful but not a full casting/self-tape evidence family | S023, S024, S027 | VOICE-B3 | Yes | B3 remains essential. |
| Output label/display behaviour | Not a source-extraction question | — | Output-spec / live QA | Yes | Still open. |
| Live Song / Voice output examples absent | No live product samples were supplied in this branch | — | Live-output QA later | Yes | Research completion not blocked. |
| Score stability / timestamp rendering not tested | Outside B2 scope | — | Output-spec / live QA | Yes | Remains product-level gap. |
| External grades / marks not usable as TapeCoach scoring | Every formal framework is mark-based | All formal frameworks | Synthesis / audit / revision | Yes | Must stay excluded. |
| Trinity Singing public syllabus fetch limitation | Direct public fetch throttled; descriptor extraction used official overview/support/digital pages instead | S024 | Synthesis | Yes | Row closed as partial, not unresolved. |
| S030 current-source gap | No securely resolved official current equivalent | S030 | Future gap-fill only if authorised | Yes | Closed, not unresolved. |
| S031 provenance limitation | Exact VOICE-S0 alternate row absent in this turn | S031 | Future gap-fill only if supplied | Yes | Closed, not unresolved. |

**B2 Source Completion Checklist**

| Source ID | Final status | Complete enough for synthesis? | If partial, exact limitation | Follow-up needed? | Follow-up stage |
|---|---|---:|---|---:|---|
| S021 | Fully extracted: criteria found | Yes | — | No | — |
| S022 | Out of scope | Yes | No standalone Singing qualification located in accessed official LAMDA pack | No | Carry as limitation |
| S023 | Fully extracted: criteria found | Yes | — | No | — |
| S024 | Partially extracted with explicit limitation | Partial | Direct public syllabus fetch throttled; descriptor evidence dispersed across official pages | Yes | VOICE-SYN / possibly later gap-fill |
| S025 | Fully extracted: criteria found | Yes | — | No | — |
| S026 | Fully extracted: criteria found | Yes | — | No | — |
| S027 | Fully extracted: criteria found | Yes | — | No | — |
| S028 | Partially extracted with explicit limitation | Partial | Classical Singing resolves through broader Music Grades syllabus with thinner subject-specific descriptors | Yes | VOICE-SYN |
| S029 | Fully extracted: criteria found | Yes | — | No | — |
| S030 | Out of scope | Yes | Current official equivalent not located in assigned pack | No | Carry as limitation |
| S031 | Provenance unclear | Yes | Exact VOICE-S0 alternate row absent; no safe remap made | No | Carry as limitation |

## Handoff for B3

**Reusable Handoff Pack for VOICE-B3**

VOICE-B2 reviewed formal framework sources from official pages and linked specifications across entity["organization","LAMDA","uk drama exams"], entity["organization","Trinity College London","music exams uk"], entity["organization","ABRSM","royal schools music board"], entity["organization","London College of Music Examinations","uwl exams uk"] and entity["organization","RSL Awards","rockschool exams uk"]. The strongest outcome is a stable formal descriptor spine for Voice / Singing: formal frameworks repeatedly pair observable vocal control language with observable communication/interpretation language. Across the strongest sources, B2 now supports precise vocabulary for pitch and intonation, rhythm/tempo/pulse, tonal control/evenness, musical shape/phrasing, audibility and diction, plus communication of character and style, story-telling, interpretation, audience engagement and acting-through-song. The strongest fully extracted rows are S021 LAMDA Musical Theatre, S023 Trinity Musical Theatre, S025 ABRSM Singing, S026 ABRSM Singing for Musical Theatre, S027 LCME Musical Theatre, and S029 RSL Vocals. S024 Trinity Singing and S028 LCME Singing are useful but remain partial because the public evidence was thinner or technically limited. S022, S030 and S031 are closed with explicit non-positive statuses, not left unresolved.

B2 also sharpened the boundary between tape-observable evidence and formal/process-only evidence. Sight-singing, aural tests, discussion, reflection, general musicianship questions, some knowledge work and some whole-programme stamina claims belong primarily to formal exam contexts and should not later be overclaimed from a finished song tape. Digital guidance from Trinity and LCME additionally strengthens the assessability-first position: quiet room, usable audio, visible face/body, balanced accompaniment and one continuous take are conditions for fair assessment, not artistic merit.

Style/subtype coverage improved but remains uneven. B2 now supports real distinctions for classical/legit, contemporary Musical Theatre, classical art song, contemporary/pop vocal contexts, accompanied vs unaccompanied work, and MT-integrated storytelling. It does **not** yet supply robust formal descriptor support for belt, mix, detailed registration language, or a rich jazz/folk/commercial descriptor family. Accessibility is also still broad: access arrangements and reasonable adjustments appear, but speech difference, inclusive voice practice, gender-diverse voice considerations and health-safety boundaries remain mainly B4 work.

Recommended focus for VOICE-B3 is therefore professional and casting-process evidence: self-tape and recorded-audio practice, singer audition guidance, accompaniment/backing-track handling, song self-tape framing, wording that separates assessability from polish, and claim-scope limits around audition-room direction, stamina, learning speed and rehearsal/callback behaviours. Exact source IDs used in B2: VOICE-S021, VOICE-S022, VOICE-S023, VOICE-S024, VOICE-S025, VOICE-S026, VOICE-S027, VOICE-S028, VOICE-S029, VOICE-S030, VOICE-S031.

**Completion Statement**

VOICE-B2 Formal Frameworks / Descriptor Extraction complete. Ready for VOICE-B3 Professional / Casting / Self-Tape Process Extraction.

---

## Links

- **Previous:** [[drr-voice-02-batch-b1]] — Batch B1 Extraction
- **Next:** [[drr-voice-04-batch-b3]] — Batch B3 Extraction
- **Thread overview:** [[drr-voice-overview]]
- **Programme:** [[drr-programme-overview]]
