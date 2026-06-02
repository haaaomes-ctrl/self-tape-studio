# TapeCoach v3 Roadmap — Product and Delivery Plan Including S10

**Document status:** product roadmap and delivery sequencing layer.  
**Current reset point:** S9-19.  
**Current active phase:** S10 — AI-led full-value authenticated report reset.  
**Current implementation note:** S10 is already being implemented. The additional calibration slices in this roadmap are amendments to be merged into the in-flight S10 work, not a new reset or reason to discard useful accepted implementation.  
**Language:** UK English.  
**Release philosophy:** small, frequent, reversible releases that preserve or improve performer-facing report value.  
**Primary correction after S10 rollback:** the AI is the report brain; code orchestrates, validates, routes, renders and applies narrow high-risk filtering only.

---

## 1. Source hierarchy

`README.md` is the controlling product contract for TapeCoach behaviour, report requirements, scoring rules, performer-level calibration, brief/no-brief semantics, role/material research, audition take lifecycle, QA artefacts, validator gates, public/private boundaries and release decisions.

`AGENTS.md` defines the implementation operating rules agents must follow. It does not override `README.md`.

`docs/tapecoach/s10-target-architecture.md` defines the S10 target architecture. It does not override `README.md`.

This roadmap is a sequencing layer. It organises phases, slices, dependencies, rollback points, canary checkpoints and acceptance evidence. It must not introduce product permissions, public-output permissions, release decisions or acceptance gates that are not already allowed by `README.md`.

If this roadmap conflicts with `README.md`, `README.md` wins.

---

## 2. Product north star

TapeCoach is an AI-led professional self-tape critique and audition-readiness system.

The performer-facing report is the product. It should help the performer understand:

1. whether to submit, retake or review carefully;
2. why;
3. what scoring basis was used;
4. what performer level they were judged against;
5. what the supplied brief asked for, if supplied;
6. what TapeCoach observed in the tape;
7. what was achieved;
8. what was missed, incomplete or not assessable;
9. what role/material context was used, if any;
10. what must be fixed first;
11. what else should improve;
12. what is optional polish;
13. what should be preserved;
14. what should not be over-fixed;
15. what to do next;
16. how to interpret score and comparison language where visible;
17. for Professional tapes, how the full 0–100 score reflects the stricter selected-level standard;
18. where multiple takes exist, which active take versions were compared and whether any replacement made a comparison stale.

The report should feel like a combined perspective from:

- a casting-aware agent;
- an acting coach;
- a vocal/singing coach;
- a movement or MT package coach;
- a self-tape technician;
- a practical audition checklist.

It should not feel like:

- a compliance wrapper;
- a JSON projection;
- a safety shell;
- a vague checklist;
- a QA artefact viewer.

---

## 3. Roadmap correction after S10 regression

S10 previously drifted towards a proof-first, over-cautious report path. That produced thin-shell reports: generic copy, weak strengths, missing professional judgement, and payload success without route/PDF usefulness.

The corrected roadmap uses this hierarchy:

```text
1. Performer-facing report usefulness
2. AI prompt quality and module completeness
3. Supplied brief transparency
4. Selected performer-level calibration
5. Brief/no-brief score semantics
6. Role/material task specificity where supplied
7. Technique and timestamp commentary
8. Score/comparison meaning and level-relative 0–100 score calibration
9. Audition take slot lifecycle and replacement handling
10. Same-video and operator assumption handling
11. Route/PDF acceptance
12. QA artefacts as secondary proof
13. Release governance
```

The failed hierarchy was:

```text
1. Internal artefact proof
2. Payload gates
3. Source-kind restrictions
4. Broad safety wrappers
5. Generic fallback copy
6. Report value if anything remained
```

That direction must not return.

---

## 4. Current baseline and historical context

### S9-19 — Current rollback baseline

S9-19 is the current recovery point.

Preserve useful work from later experiments where appropriate, but do not reintroduce any feature that recreates thin-shell reports or proof-first acceptance.

Useful ideas to preserve or rebuild carefully:

- brief requirement itemisation;
- selected performer level as a first-class input;
- fix-first derived from the highest-ranked meaningful fix;
- must-fix / should-improve / optional-polish separation;
- song/package and continuous-video routing;
- canonical report model concept;
- route/PDF first review;
- no-export and QA diagnostics as proof;
- operator assumption confirmation;
- same-video handling;
- timestamped commentary;
- technique-library commentary;
- score terminology alignment;
- level-relative professional score calibration across the full 0–100 scale.

Ideas to discard or quarantine:

- broad brief lockdown;
- “public-safe” as a synonym for minimal;
- limited model as ordinary output;
- generic fallback phrases;
- payload-only acceptance;
- QA-only acceptance;
- hiding useful content because it is detailed;
- replacing AI judgement with static code copy;
- treating selected level as tone;
- using no-brief scores as though brief achievement were known;
- using role/material research to invent hidden casting requirements.

---

## 5. Product maturity tracks

The roadmap is organised across product maturity tracks. Each phase may touch several tracks, but S10 prioritises Report Intelligence and Prompt Engineering first.

### Track A — Report intelligence

Goal: produce the full professional performer-facing report.

Includes:

- scoring basis;
- selected-level standard;
- recommendation;
- why;
- supplied brief task;
- observed tape;
- brief achievement;
- role/material context;
- fix-first;
- priority fixes;
- must-fix / should-improve / optional-polish;
- strengths and preserve;
- technique commentary;
- timestamped commentary;
- next action;
- do-not-overfix;
- not-assessable limitations.

### Track B — AI prompt engineering

Goal: ensure the AI is asked the correct questions for every report module.

Includes:

- scoring-context pass;
- observation pass;
- professional judgement pass;
- performer-level calibration pass;
- role/material calibration pass;
- technique-library pass;
- timestamp pass;
- score calibration pass;
- level-relative 0–100 score calibration pass;
- comparison pass;
- module completeness check;
- repair prompts.

### Track C — Brief intelligence

Goal: treat the supplied brief as first-class input.

Includes:

- full useful brief preservation;
- project/role/material extraction;
- required component extraction;
- deadlines, upload instructions, file naming, framing and format instructions;
- mandatory / preferred / optional / ambiguous classification;
- achievement status per requirement;
- no-brief and partial-brief scoring mode.

### Track D — Performer level calibration

Goal: ensure selected performer level changes the assessment standard rather than only tone.

Includes:

- `PerformerLevel` enum;
- level standards;
- level-relative AI questions;
- level-relative evidence thresholds;
- level-relative score language;
- level-relative recommendation and fix hierarchy;
- route/PDF field: `Judged against: [selected level]`;
- same-tape/different-level fixtures.

### Track E — Role/material and known-context intelligence

Goal: use supplied role, character, production, song, scene, copy or routine context where available without inventing hidden requirements.

Includes:

- role/material resolver;
- research source hierarchy;
- truth-state handling;
- known-material baseline profile;
- role/material calibration pass;
- source-basis display;
- safe boundaries around appearance, type, marketability and casting prediction.

### Track F — Technique library

Goal: attempt observable, useful technique commentary by default.

Includes:

- acting;
- vocal/singing;
- movement/dance;
- Musical Theatre package integration;
- commercial/screen task;
- self-tape presentation;
- level-specific technique expectations.

### Track G — Scoring and comparison

Goal: ensure numeric values support language and judgement rather than replacing it.

Includes:

- scoring mode semantics;
- score-to-terminology mapping;
- level-relative professional score calibration across the full 0–100 scale;
- sub-dimension scoring;
- brief blockers overriding performance scores;
- comparison reasoning;
- high-score comparison safeguards;
- operator/test diagnostic score chips.


### Track H — Audition take lifecycle and admin reports

Goal: make the three-take audition model explicit and inspectable.

Includes:

- maximum of three active take slots;
- active versus replaced take versions;
- take replacement lifecycle;
- one individual report per take version;
- one QA/admin artefact bundle per take report where QA is enabled;
- comparison runs across active take versions;
- stale comparison detection after replacement;
- admin visibility for take reports, comparison reports and QA status.

### Track I — Media and same-video handling

Goal: handle Mux/media readiness, timestamps, continuity, duplicates and retests.

Includes:

- Mux readiness;
- audio/video/framing assessability;
- timestamp/time-band support;
- same-video duplicate detection;
- intentional retest handling;
- same-video changed brief/level/role handling;
- same-video comparison safeguards.

### Track J — QA and operations

Goal: prove the report without replacing it.

Includes:

- report model artefacts;
- AI pass artefacts;
- level calibration artefacts;
- brief/no-brief scoring artefacts;
- role/material calibration artefacts;
- level-relative Professional score calibration artefacts;
- red-line trace;
- route/PDF snapshots;
- operator assumption log;
- QA emission diagnostics;
- runtime proof;
- release readiness later.

---

## 6. Product release levels

### Level 1 — Useful authenticated audition-readiness report

The first shippable product layer.

Must answer:

```text
Is this ready to submit?
Why?
What scoring basis was used?
What selected level was applied?
What did the brief require, if supplied?
What was achieved/missed?
What is fix-first?
What should I preserve?
Which active take versions were analysed or compared, where applicable?
What should I do next?
What could not be assessed?
```

Level 1 is S10’s main target.

### Level 2 — Technique-aware professional critique

Adds deeper discipline-specific analysis.

Must attempt:

- acting technique commentary;
- vocal/singing commentary;
- movement/dance commentary;
- MT package commentary;
- self-tape technique commentary;
- timestamped or time-banded observations where possible.

### Level 3 — Brief, level and score calibration

Adds calibrated scoring and take comparison.

Must preserve:

- brief/no-brief scoring semantics;
- selected-level calibration;
- score terminology alignment;
- level-relative Professional score calibration;
- comparison reasoning across up to three active take slots;
- active/replaced take version clarity;
- same-video safeguards.

### Level 4 — Role/material-aware feedback

Adds known role, character, production, repertoire and task-specific calibration.

Must preserve:

- supplied brief priority;
- role/material source basis;
- truth-state handling;
- no hidden mandatory requirements;
- no appearance/type/castability language.

### Level 5 — Operational/release proof

Adds stronger artefacts, per-take/per-comparison admin QA status, provenance, operator confirmation, release and production gates.

Level 5 is not allowed to degrade Level 1–4 report value.

---

## 7. Active phase: S10 — AI-led full-value report reset

### S10 objective

Rebuild from S9-19 into a full-value, AI-led authenticated report system.

### S10 status note

S10 is already in implementation. The additions below should be merged into the relevant S10 workstreams:

- S10.1a into prompt/question-map work;
- S10.2a into take lifecycle, comparison and admin QA work;
- S10.3a into brief intelligence and score semantics;
- S10.3b into brief intelligence / role material resolver work;
- S10.8a into score terminology and professional nuance.

Do not restart or discard useful implementation solely because these amendments add detail. Do update schemas, prompts, acceptance and route/PDF tests where the in-flight work does not yet satisfy these rules.

### S10 non-goals

Do not prioritise:

- production/customer release;
- Level 2 release acceptance;
- public-share/export mode;
- broad public gating;
- heavy artefact reconciliation;
- source-kind refactors;
- public scoring governance;
- comparison release governance.

Those come later, after route/PDF report value is stable.

### S10 acceptance principle

A S10 slice cannot be accepted if it only improves internal proof or code structure while degrading or failing to improve performer-facing report usefulness.

---

## 8. S10 implementation sequence

### S10.0 — Documentation and agent alignment

**Purpose:** Make the corrected direction unavoidable before and during implementation.

**Deliverables:**

- updated `README.md`;
- root `AGENTS.md`;
- `docs/tapecoach/s10-target-architecture.md`;
- `docs/tapecoach/s10-ai-prompt-map.md`;
- `docs/tapecoach/s10-score-calibration.md`;
- `docs/tapecoach/s10-same-video-handling.md`;
- `docs/tapecoach/s10-golden-fixtures.md`;
- updated roadmap.

**Acceptance:**

- docs state AI is the report brain;
- docs state supplied brief transparency is default;
- docs state selected level is a judgement standard;
- docs state no-brief scoring is baseline only;
- docs state role/material research is secondary to the brief;
- docs state Professional scoring is stricter across the full 0–100 scale and does not use a separate high-score high-score-only system;
- docs state one audition supports up to three active take slots with replacement/version history;
- docs state each take and comparison run requires admin-visible report/QA status where QA is enabled;
- docs state thin-shell output is failure;
- docs state QA artefacts are proof, not the product;
- roadmap remains sequencing-only.

---

### S10.1 — AI-led report module question map

**Purpose:** Define what the AI must answer for every UI report module.

**Why first:** The previous system failed because modules were populated by deterministic fallback copy instead of AI judgement.

**Deliverables:**

- `AiScoringContextPass` schema;
- `AiObservationPass` schema;
- `AiProfessionalJudgementPass` schema;
- `AiTechniqueCommentary` schema;
- `AiTimestampedCommentary` schema;
- `AiReportModuleCompletenessCheck` schema;
- module-level AI questions;
- repair prompt templates.

**Acceptance:**

- every UI report module has a corresponding AI question;
- every AI output field has a destination in the report model;
- missing/thin/generic modules trigger repair prompts;
- no module relies on generic fallback copy as primary content.

**Prompt:**

```text
Implement S10.1 — AI-led report module question map.

Context:
TapeCoach has rolled back to S9-19 after S10 report-value regressions.
README.md is the controlling product contract.

Purpose:
Define the AI question map and module-completeness contract before rebuilding report rendering.

Deliverables:
- AI questions for every visible report module;
- structured observation and judgement output schemas;
- technique and timestamp commentary schemas;
- scoring context schema;
- module completeness classifications;
- repair prompts for missing, thin, generic, contradictory or unsupported modules.

Acceptance:
- every UI section has an AI question;
- every AI answer has a report destination;
- no generic fallback copy is accepted as primary report content.
```

---

### S10.1a — Performer Level Calibration Architecture

**Purpose:** Make selected performer level a first-class AI judgement standard.

**Problem:** The flow captures selected performer level, but implementation must explicitly define how that level changes AI questions, evidence thresholds, recommendation language, score interpretation, fix hierarchy, strengths/preserve language, gap language, UI output and route/PDF acceptance.

**Deliverables:**

- `PerformerLevel` enum aligned to the UI selector;
- `PerformerLevelStandard` definitions;
- `LevelCalibrationPass` schema;
- level-calibration AI prompt;
- level-relative recommendation rules;
- level-relative score-language rules;
- UI field: `Judged against: [selected level]`;
- route/PDF checks for selected-level wording;
- fixtures for same tape judged at different levels.

**Acceptance:**

- selected performer level is passed into the AI judgement context;
- AI states the standard applied;
- recommendation explains selected-level reasoning;
- fix hierarchy changes where the selected level changes submission risk;
- score language, where visible, is level-relative;
- route and PDF display the selected level;
- a Professional run asks stricter Professional questions and requires stronger evidence;
- mandatory brief blockers override level-based praise;
- assessability blockers are not mislabelled as performance weakness;
- no report uses selected level only as tone or encouragement.

**Prompt:**

```text
Implement S10.1a — Performer Level Calibration Architecture.

Purpose:
Ensure selected performer level is used as an assessment standard before final judgement.

Deliverables:
- PerformerLevel enum;
- performer-level standards;
- LevelCalibrationPass schema;
- level-calibration prompt;
- report fields for judged-against level and why-at-this-level;
- fixtures for same tape / different level.

Acceptance:
- every report states "Judged against: [selected level]";
- recommendation and score language are level-relative;
- Professional is stricter because questions and thresholds change, not because wording is harsher.
```

---

### S10.2 — Full-value architecture and model types

**Purpose:** Add architecture/types that support the AI-led report without changing user-facing behaviour yet.

**Deliverables:**

- `AnalysisInputContext`;
- `AuditionTakeSlotState`;
- `TakeReportRun`;
- `AuditionComparisonRun`;
- `BriefScoringContext`;
- `PerformerLevelStandard`;
- `BriefRequirement`;
- `MediaEvidence`;
- `KnownMaterialBaselineProfile`;
- `RoleMaterialCalibrationPass`;
- `TechniqueCommentary`;
- `LevelRelativeScoreCalibration`;
- `FullReportModel`;
- `AuthenticatedReportModel`;
- `OperatorAssumptionLog`.

**Acceptance:**

- types exist;
- no broad public-safe restrictions are introduced;
- no report behaviour is degraded;
- architecture supports full-value output;
- types support level calibration, no-brief scoring, role/material context, audition take lifecycle and level-relative Professional score calibration.

---


### S10.2a — Audition Take Slot Lifecycle and Admin QA Contract

**Purpose:** Make the three-take audition model explicit before comparison and QA work hardens.

**Problem:** The product supports up to three takes per audition, but the documentation and implementation must explicitly define take slots, replacement behaviour, active versus replaced versions, per-take reports, per-take QA artefacts, comparison runs and admin visibility.

**Deliverables:**

- `AuditionTakeSlot` model for Take 1, Take 2 and Take 3;
- active take version model;
- replaced take version model;
- take replacement lifecycle;
- per-take report requirement;
- per-take QA artefact requirement;
- comparison run model;
- comparison stale/refresh rule when a take is replaced;
- admin UI contract for take reports and QA artefacts;
- route/PDF/admin checks.

**Acceptance:**

- each audition has no more than three active take slots;
- each active take can produce an individual report;
- each take replacement creates a new take version and fresh analysis run;
- replaced versions are not silently overwritten;
- ordinary comparison uses only active take versions;
- comparison identifies the take versions compared;
- replacing a take invalidates or refreshes comparison;
- each take report has admin-visible QA artefact status where QA is enabled;
- each comparison run has admin-visible QA artefact status where QA is enabled;
- same-video / duplicate handling applies across uploads, replacements and comparisons.

**Prompt:**

```text
Implement S10.2a — Audition Take Slot Lifecycle and Admin QA Contract.

Purpose:
Define the product lifecycle for up to three active take slots per audition, including replacement, per-take reports, comparison runs and admin QA proof.

Deliverables:
- AuditionTakeSlot model for slots 1, 2 and 3;
- take version status model;
- take replacement lifecycle;
- per-take report and QA status;
- comparison run model across active take versions;
- stale comparison handling when an active take is replaced;
- admin UI/report/QA status contract;
- fixtures for three active takes, replacement and same-video replacement.

Acceptance:
- no more than three active takes exist for one audition;
- replacement creates a new take version and analysis run;
- previous versions remain admin-inspectable subject to retention policy;
- ordinary comparison uses active take versions only;
- comparison identifies compared take versions;
- admin can see per-take and per-comparison report/QA status.
```

### S10.3 — Brief intelligence and authenticated brief transparency

**Purpose:** Treat the supplied brief as first-class report input.

**Deliverables:**

- full useful brief preservation;
- project/role/material extraction;
- requirement extraction;
- mandatory/preferred/optional/ambiguous classification;
- achievement criteria per requirement.

**Acceptance:**

- supplied brief details can appear in authenticated report;
- Canary A and Canary B brief requirements extract correctly;
- no invented requirements;
- red-line filtering remains narrow.

---

### S10.3a — Brief / No-Brief Score Semantics

**Purpose:** Make scoring mode explicit so no-brief reports do not make false brief-achievement claims.

**Problem:** A score map that says high scores are “brief-complete” works only when a brief exists. No-brief reports must be baseline assessments, not implicit brief-adherence reports.

**Deliverables:**

- `ScoringMode` enum;
- `BriefScoringContext` schema;
- brief/no-brief scoring prompt;
- mode-specific score-band language;
- UI label: `Scoring basis`;
- no-brief limitations block;
- contradiction validator for brief/no-brief claims;
- route/PDF checks;
- fixtures for brief-supplied, partial-brief, no-brief and conflicting-signal reports.

**Acceptance:**

- no-brief reports never claim brief achievement;
- no-brief scores are labelled as baseline assessments;
- full-brief reports can score brief achievement and blockers;
- partial-brief reports distinguish supplied context from missing formal requirements;
- conflicting brief signals trigger repair or operator confirmation;
- score language and recommendation do not contradict the scoring mode;
- route/PDF visibly show the scoring basis and limitations.

**Prompt:**

```text
Implement S10.3a — Brief / No-Brief Score Semantics.

Purpose:
Before scoring, classify whether the run is brief_supplied, partial_brief_supplied, no_brief_baseline or brief_uncertain.

Deliverables:
- scoring mode enum;
- scoring context schema;
- AI prompt to classify scoring basis;
- score-band language by mode;
- UI display of scoring basis;
- route/PDF assertions.

Acceptance:
- no-brief reports say brief achievement is not assessable;
- no-brief high scores mean strong baseline evidence only;
- no report says brief-complete when no brief exists.
```

---

### S10.3b — Role / Character Research and Known-Material Calibration

**Purpose:** Allow TapeCoach to research and resolve known role, character, production and material context where supplied, so scoring and report feedback can be more specific.

**Problem:** Known roles/materials such as Elphaba from Wicked require an additional resolver. Without it, reports may judge against generic acting/vocal/MT standards and miss role-specific nuance. With it implemented badly, reports may invent hidden casting requirements. The brief must remain primary.

**Deliverables:**

- `BriefMaterialRoleResolver`;
- `KnownMaterialBaselineProfile`;
- `RoleMaterialCalibrationPass`;
- research-source hierarchy;
- truth-state handling for role/material claims;
- prompt for role/character/material research;
- scoring rules for primary brief demands vs secondary known-material demands;
- UI block: `Role / material context`;
- role-specific Professional score calibration across the full 0–100 scale;
- route/PDF checks for role/material context;
- fixtures for known role, ambiguous role, no brief, and conflict with brief.

**Acceptance:**

- supplied brief always outranks known-material research;
- known-material research never invents hidden brief requirements;
- known-material research can nuance scoring only where evidence is observable or audible;
- role/material context can affect score bands and level-relative Professional score explanations;
- no role research creates appearance, body/type, marketability, bookability or casting outcome language;
- no report says “right/wrong for the role” without brief-bounded, evidence-led wording;
- route/PDF shows the role/material source basis and uncertainty;
- no-brief mode does not invent role, style, brand, audience or casting fit.

**Prompt:**

```text
Implement S10.3b — Role / Character Research and Known-Material Calibration.

Purpose:
When role/material is supplied, resolve the task so feedback can be brief-first and role-specific without inventing hidden requirements.

Deliverables:
- role/material resolver;
- source hierarchy;
- truth-state handling;
- calibration schema;
- AI prompt;
- UI role/material context block;
- fixtures.

Acceptance:
- brief wins;
- observed evidence is required for scoring;
- known material is secondary nuance;
- unsafe casting/type/callback language is blocked;
- source basis is visible.
```

---

### S10.4 — AI observation and professional judgement prompts

**Purpose:** Run the two-step AI analysis as the report intelligence source.

**Deliverables:**

- observation prompt;
- professional judgement prompt;
- prompt fixtures;
- schema validation;
- repair prompts.

**Acceptance:**

- observation pass identifies what appears in the tape;
- judgement pass provides recommendation, fixes, strengths, technique commentary and next action;
- selected level and scoring basis are available to judgement;
- role/material context is available where supported;
- AI output is module-ready;
- no thin shell.

---

### S10.5 — Report model to UI piping

**Purpose:** Render structured AI outputs in the performer-facing report.

**Deliverables:**

- `FullReportModel` composer;
- `AuthenticatedReportModel` renderer mapping;
- route text rendering;
- PDF text rendering;
- narrow red-line filter.

**Acceptance:**

- AI output appears in the route/PDF;
- UI does not invent professional judgement;
- scoring basis is visible;
- judged-against level is visible;
- role/material source basis is visible where applicable;
- take slot and take version context are visible where applicable;
- level-relative Professional score explanation is visible where applicable;
- if AI output exists but is not rendered, that is treated as a routing bug.

---

### S10.6 — Technique-library commentary

**Purpose:** Attempt discipline-specific technique commentary wherever evidence exists.

**Deliverables:**

- acting commentary;
- vocal/singing commentary;
- movement/dance commentary;
- MT package commentary;
- commercial/screen-task commentary;
- self-tape presentation commentary.

**Acceptance:**

- missing components are marked not assessable rather than ignored;
- visible components receive specific commentary;
- selected level informs expectations;
- role/material context informs technique notes where supported;
- no avoidance of technique notes by default;
- only high-risk medical/body/protected-characteristic/guaranteed-outcome claims are filtered.

---

### S10.7 — Timestamped commentary

**Purpose:** Restore timestamped or time-banded commentary as a positive report feature.

**Deliverables:**

- timestamp/time-band prompt;
- timestamped strengths/fixes/observations;
- cut-off and component-boundary notes;
- component-level fallback if timestamps unavailable.

**Acceptance:**

- timestamped commentary appears where available;
- timestamp absence does not collapse the report;
- report remains useful without timestamps.

---

### S10.8 — Score terminology and professional calibration

**Purpose:** Align visible scores with report language and apply selected-level score standards across the full 0–100 scale, especially the stricter Professional standard.

**Deliverables:**

- score-to-language map;
- scoring mode language;
- selected-level score calibration;
- Professional 0–100 score calibration policy;
- sub-dimension score language;
- brief blocker override rules;
- role/material score contribution rules;
- comparison score language.

**Acceptance:**

- score chips do not contradict verdicts;
- score language does not contradict scoring basis;
- score language does not flatten Professional feedback;
- Professional scores in every band receive meaningful written nuance; scores in the 90s are rare and evidence-led;
- brief blockers can override performance quality;
- no-brief high scores are labelled as baseline quality only.

---

### S10.8a — Level-relative Professional 0–100 score calibration

**Purpose:** Ensure Professional scoring is stricter across the full 0–100 scale rather than using a separate high-score-only calibration subsystem.

**Problem:** The older Professional high-score-only model over-focused on differentiating already high scores. The updated product rule is broader: selected performer level changes the evidence threshold for every score band. A Professional 72, 84 or 92 must all receive score explanations calibrated to Professional standards. Scores in the 90s should be rare because the Professional bar is higher across the whole scale, not because a special module activates only at the top.

**Deliverables:**

- level-relative 0–100 score map by selected performer level;
- Professional full-scale score-band expectations;
- `LevelRelativeScoreCalibration` schema;
- prompt and repair prompt for score meaning, suppressors, raisers, preserve guidance and retake strategy;
- Professional score sub-dimensions;
- comparison rules that do not overclaim small numerical differences;
- UI block: `Score meaning` / `Professional score calibration`;
- route/PDF checks for full-scale Professional score explanation;
- fixtures for sub-ready, viable, strong and rare-exceptional Professional reports across the full scale.

**Acceptance:**

- Professional reports do not rely on a separate high-score-only scoring system;
- every visible Professional score explains the actual score band, not only scores in the 90s;
- scores in the 90s are rare and require exceptional evidence;
- a Professional 62, 74, 86 and 92 produce meaningfully different score explanations, suppressors, raisers, preserve guidance and retake strategy;
- lower-level excellence is not described as Professional-standard without evidence;
- high scores do not imply guaranteed casting, callback, booking or employment outcome;
- tiny score differences are not overclaimed;
- same-video comparisons cannot create a false winner;
- route/PDF surfaces score meaning, score suppressors, score raisers, preserve guidance and retake strategy where score language is visible.

**Prompt:**

```text
Implement S10.8a — Level-relative Professional 0–100 score calibration.

Purpose:
When selected level is Professional and score language is visible, explain the score against the stricter Professional standard across the full 0–100 scale. Do not use a separate high-score-only calibration subsystem.

Deliverables:
- level-relative score map for every selected performer level;
- Professional full-scale score-band expectations;
- LevelRelativeScoreCalibration schema;
- prompt and repair prompt;
- UI score-meaning block;
- route/PDF assertions;
- fixtures across low, mid, high and rare-exceptional Professional scores.

Acceptance:
- no separate high-score-only Professional scoring system;
- score meaning is explained for the actual score;
- score suppressors, score raisers, preserve guidance and retake strategy are visible;
- scores in the 90s are rare and evidence-led;
- no guaranteed outcome language.
```

### S10.9 — Same-video and duplicate-upload handling

**Purpose:** Handle duplicate media, retests and same-video comparisons explicitly.

**Deliverables:**

- same-video status model;
- duplicate/retest classification;
- operator confirmation fields;
- same-video/new-brief handling;
- same-video/new-level handling;
- same-video/new-role-context handling;
- comparison safeguards.

**Acceptance:**

- accidental duplicates are not treated as different performances;
- intentional retests are allowed and labelled;
- same-video comparison cannot create a false winner;
- same video changed level recalibrates judgement without implying performance changed;
- same video changed role context recalibrates task specificity without implying performance changed;
- operator assumptions are captured where needed.

---

### S10.10 — Positive brief-complete report path

**Purpose:** Ensure strong complete takes produce rich positive reports, not empty “no blocker” reports.

**Deliverables:**

- positive readiness rationale;
- achieved/mostly achieved brief status;
- no-mandatory-fix language;
- specific strengths;
- technique commentary;
- optional polish;
- submit checklist;
- do-not-overfix guidance;
- level-relative Professional score calibration where applicable.

**Acceptance:**

- Canary B passes route/PDF review;
- no invented blocker;
- strengths are specific;
- optional polish is useful and finite;
- no “This affects readability, not talent” as sole strength;
- Professional reports include level-relative score calibration;
- no thin shell.

---

### S10.11 — Incomplete mandatory package path

**Purpose:** Ensure missing required material produces decisive fix-first guidance.

**Deliverables:**

- missing-material detection;
- missing Side 1 fix-first;
- song/package completion;
- continuous-video package check;
- one-file export/upload check;
- finite retake plan.

**Acceptance:**

- Canary A passes route/PDF review;
- missing Side 1 is fix-first;
- song/package completion appears;
- continuous-video check appears;
- no false audio blocker;
- no generic “Blocked…” legacy copy;
- level calibration does not hide mandatory brief blockers;
- role/material research does not distract from missing required material.

---

### S10.12 — Route/PDF first QA

**Purpose:** Test the actual performer-facing report surface.

**Deliverables:**

- route text snapshot;
- PDF text snapshot;
- report surface assertions;
- operator fixture confirmation.

**Acceptance:**

- route/PDF text is checked;
- payload parity alone is insufficient;
- Canary A and Canary B pass visually and textually;
- thin-shell phrases are blocked;
- scoring basis and selected level are visible;
- level-relative Professional score explanation is visible where applicable;
- role/material source basis is visible where applicable.

---

### S10.13 — QA artefacts as secondary proof

**Purpose:** Reintroduce diagnostics without blocking useful report generation.

**Deliverables:**

- AI pass artefacts;
- scoring context artefact;
- level calibration artefact;
- role/material calibration artefact where applicable;
- level-relative Professional score calibration artefact where applicable;
- take lifecycle artefact where applicable;
- comparison run artefact where applicable;
- per-take report/QA status artefacts where applicable;
- report model artefacts;
- red-line filter trace;
- report quality check;
- operator assumption log;
- QA emission diagnostics.

**Acceptance:**

- QA artefacts emit when enabled;
- missing artefacts are clearly diagnosed;
- report still renders if artefacts fail;
- artefact failure blocks proof/release, not user report generation;
- admin can see per-take and per-comparison QA artefact status where QA is enabled;
- no secrets, signed URLs, raw prompts or raw responses leak.

---

## 9. Post-S10 roadmap

### S11 — Broaden report reliability and fixture coverage

Purpose:

```text
Expand from core canaries to a broad suite of realistic performer scenarios.
```

Likely work:

- drama scene only;
- musical theatre song only;
- MT song + acting + dance package;
- commercial self-tape;
- poor audio;
- poor framing;
- no brief;
- partial brief;
- ambiguous role/material;
- known role/material;
- one, two and three active takes;
- take replacement;
- duplicate video;
- Professional takes across score bands;
- same tape judged at different levels;
- early-career performer calibration.

Acceptance:

- reports remain useful across disciplines;
- no thin shell;
- scoring basis remains clear;
- selected level visibly affects judgement;
- score terminology remains aligned;
- technique commentary is attempted where evidence exists.

### S12 — Technique-library maturity

Purpose:

```text
Make the technique-library commentary more structured, trustworthy and discipline-aware.
```

Likely work:

- acting rubric expansion;
- vocal/singing rubric expansion;
- dance/movement rubric expansion;
- MT package integration rubric;
- screen/commercial rubric;
- level-specific technique expectations;
- role/material-specific technique prompts;
- uncertainty phrasing.

Acceptance:

- technique commentary is useful and specific;
- not-assessable limitations are clear;
- level differences are visible;
- no medical/body/protected-characteristic claims.

### S13 — Score and comparison productisation

Purpose:

```text
Turn score/comparison diagnostics into a consistent authenticated product feature.
```

Likely work:

- sub-dimension score explanation;
- full-scale Professional scoring nuance;
- comparison reasoning across active take versions;
- stale comparison handling after replacement;
- same-video comparison safeguards;
- score trend across takes;
- role/material contribution to score;
- operator/test to authenticated product mode transition.

Acceptance:

- scores never contradict language;
- comparison explains why;
- duplicate videos are handled honestly;
- high-level performers still receive useful nuance.

### S14 — Role/material and repertoire maturity

Purpose:

```text
Make known role/material research safer, more useful and easier to validate.
```

Likely work:

- official-source resolver;
- curated internal known-material profiles;
- licensed/publisher source handling;
- role/material ambiguity resolver;
- user confirmation flow;
- source confidence UI;
- fixture suite for common role/material cases.

Acceptance:

- supplied brief always wins;
- known material never invents hidden requirements;
- source basis is visible;
- no appearance/type/castability language.

### S15 — QA, provenance and operator proof hardening

Purpose:

```text
Strengthen proof without degrading report value.
```

Likely work:

- stable QA artefact emission;
- per-take and per-comparison admin QA visibility;
- operator confirmation workflows;
- report model snapshots;
- AI prompt/version provenance;
- route/PDF snapshot storage;
- regression dashboards.

Acceptance:

- useful report renders even if proof artefacts fail;
- proof failure blocks release evidence only;
- diagnostics are clear.

### S16 — Production/customer release readiness

Purpose:

```text
Prepare for broader customer release after report value and proof are stable.
```

Likely work:

- release gates;
- privacy/export modes;
- support workflows;
- monitoring;
- billing/quotas if applicable;
- production runbooks;
- public/share report rules if introduced.

Acceptance:

- production/customer release is explicitly approved;
- Level 2/Level 3 gates are separately accepted where required;
- authenticated report value remains intact.

---

## 10. Golden fixtures

### Fixture A — incomplete mandatory MT package

```text
Brief:
Side 1 + contemporary legit MT song + one continuous video.

Tape:
partial/cut-off song only;
Side 1 missing;
audio assessable.

Expected:
retake required;
missing Side 1 fix-first;
song completion;
continuous-video package check;
one-file export check;
specific next-take plan;
no false audio blocker;
no generic fallback copy.
```

### Fixture B — strong professional complete package

```text
Brief:
same or equivalent.

Tape:
Side 1 present;
song present;
package complete;
professional level;
audio/video assessable.

Expected:
submit / submit if deadline is close;
brief achieved or mostly achieved;
no mandatory blocker;
specific strengths;
specific technique commentary;
optional polish;
level-relative Professional score calibration when score language is visible;
submit checklist;
do-not-overfix.
```

### Fixture C — old-report usefulness baseline

The 22 May report is a minimum usefulness floor, not an exact template. New reports must preserve or exceed its practical specificity while applying only narrow high-risk filtering.

### Fixture D — poor assessability

```text
Expected:
limited report allowed only with specific assessability explanation;
no invented fixes;
no thin shell.
```

### Fixture E — no brief supplied

```text
Expected:
performance and setup feedback;
no invented brief requirements;
brief adherence not assessable;
scoring basis shown as no_brief_baseline;
score language says baseline only.
```

### Fixture F — same-video duplicate/retest

```text
Expected:
system marks duplicate, retest or uncertain;
operator confirmation requested where needed;
comparison does not recommend one duplicate over another as different performances.
```

### Fixture G — comparison

```text
Expected:
score/comparison chips visible in authenticated/operator/test mode;
comparison reasoning exists when comparison is shown;
no guaranteed casting outcome.
```

### Fixture H — same tape, different selected level

```text
Brief:
Same supplied brief.

Tape:
Same assessable self-tape.

Runs:
1. Amateur / Community
2. Emerging / Training
3. Professional

Expected:
observed evidence remains the same;
selected-level standard changes;
recommendation may change;
fix hierarchy may change;
score language is level-relative;
UI states "Judged against: [selected level]";
Professional run is stricter and identifies Professional-level gaps;
lower-level runs do not imply Professional readiness unless independently supported.
```

### Fixture I — Professional strictness

```text
Brief:
Professional audition brief with required scene, song, package or task.

Tape:
Prepared, clear, technically assessable, but only generally specific.

Expected:
report does not call it standout merely because it is clean;
AI distinguishes competent from competitive;
Professional gaps are concrete;
optional polish is separated from must-fix;
no guaranteed callback, booking or employment language.
```

### Fixture J — mandatory blocker overrides level

```text
Brief:
Side 1 + song + one continuous video.

Tape:
Song only;
Side 1 missing.

Runs:
Learning / School, Amateur / Community, Emerging / Training, Professional.

Expected:
missing Side 1 remains the fix-first item at every level;
tone and detail may vary by level;
recommendation remains driven by brief failure;
no level setting hides the mandatory blocker;
report says the issue is brief completion, not lack of talent.
```

### Fixture K — strong lower-level tape, not Professional-ready

```text
Brief:
Acting scene, song, commercial copy or MT package.

Tape:
Clear, prepared, task-relevant and assessable.
Choices are readable but not consistently discipline-specific.

Runs:
1. Amateur / Community
2. Professional

Expected:
Amateur / Community run may be strong or submission-supporting;
Professional run should not describe the tape as standout unless evidence supports it;
Professional run identifies the higher-level gap;
report preserves strengths while explaining why the Professional bar is higher.
```

### Fixture L — Professional low-range score calibration

```text
Expected:
Professional score language explains why the tape sits below submission-ready Professional standard; the fix-first item is specific; lower-level strengths are not described as Professional readiness.
```

### Fixture M — Professional mid-range score calibration

```text
Expected:
Professional score language explains viable elements and meaningful competitive gaps; score suppressors and score raisers are concrete; retake strategy is tied to the highest-impact improvement.
```

### Fixture N — Professional strong score calibration

```text
Expected:
Report may support submission if no mandatory blocker exists; score language explains why the tape is strong but not exceptional; optional polish is separated from must-fix; preserve guidance is specific.
```

### Fixture O — Professional rare top-band score calibration

```text
Expected:
Score in the 90s is treated as rare and exceptional; report explains the evidence that justifies the top-band score; no guaranteed outcome language; next action is usually a submission checklist, not performance correction.
```

### Fixture P — Professional take comparison

```text
Brief:
Same professional brief.

Takes:
Take A: 93.
Take B: 96.

Expected:
both are submit-supporting;
Take B is not described as better merely because the number is higher;
report explains the specific competitive advantage;
comparison identifies what Take A still does well;
recommendation is evidence-led;
no guaranteed callback or booking language.
```

### Fixture Q — tiny high-score difference

```text
Brief:
Same professional brief.

Takes:
Take A: 95.
Take B: 96.

Expected:
report does not overclaim the 1-point difference;
if the advantage is marginal, say so;
choose based on brief precision, technical clarity or specific performance evidence;
if no meaningful difference is visible, mark as too close to call.
```

### Fixture R — known role with clear brief

```text
Brief:
Professional MT audition.
Role: Elphaba.
Show: Wicked.
Required: specified song and side.

Tape:
Technically assessable.
Required material present.
Strong vocal performance.
Acting-through-song is partly specific but not consistently role-specific.

Expected:
role/material context appears;
supplied brief is primary;
known role/material baseline is secondary;
report references role-specific demands only as task/material context;
no appearance/type/castability language;
score nuance explains why the take is professionally viable / solid / strong / standout;
level-relative Professional score explanation reflects role-specific competitive clarity.
```

### Fixture S — known role conflicts with supplied brief

```text
Brief:
Role: Elphaba.
Instruction: play the material quietly, guarded and restrained.

Known material:
Often associated with power, defiance and vocal force.

Tape:
Quiet, guarded performance.

Expected:
brief wins;
report does not penalise the performer simply for not playing generic force;
known-material context is used only to ask whether restraint still carries stakes and conviction;
no hidden requirement is invented.
```

### Fixture T — known material but missing required component

```text
Brief:
Known role side + song.

Tape:
Song only.

Expected:
missing side is fix-first;
role research does not distract from the mandatory blocker;
report may say role/material specificity in the song is assessable, but full package readiness is blocked by missing required material.
```

### Fixture U — ambiguous role/material

```text
Brief:
Known show song only.
No role specified.

Tape:
Song from known show.

Expected:
role is not assumed unless the material clearly identifies it;
report may say known material but must not state character-specific demands unless confidently resolved;
uncertainty is visible.
```

### Fixture V — no brief, user mentions role casually

```text
Input:
User writes “I’m working on something role-ish” but no formal brief.

Expected:
report treats this as user-supplied focus, not formal audition requirement;
no mandatory role standards;
feedback may offer role-context notes cautiously;
readiness remains general to selected level unless a formal brief is supplied.
```

### Fixture W — no brief, strong observable tape

```text
Input:
No brief supplied.
Selected level: Professional.
Tape: strong, technically assessable monologue or song.

Expected:
scoring basis: no brief baseline;
brief achievement: not assessable;
no invented role, time limit, sides, page range or package requirement;
high score allowed only as baseline quality/readiness;
report says actual audition fit cannot be confirmed without the brief;
useful strengths, fixes, preserve guidance and next action still appear.
```

### Fixture X — brief supplied, missing mandatory component

```text
Input:
Brief requires Side 1 + song + one continuous video.
Tape: song only.

Expected:
scoring basis: brief supplied;
missing Side 1 is a brief blocker;
strong song evidence may be acknowledged;
overall recommendation is driven by missing required material;
score language explains blocker override.
```

### Fixture Y — partial brief / known role only

```text
Input:
User supplies “Elphaba, Wicked” but no full casting brief.
Tape: assessable song.

Expected:
scoring basis: partial brief supplied;
role/material context may be used cautiously;
no full package compliance claim;
no deadline/upload/time-limit claim;
no hidden mandatory side/song requirement unless supplied;
report explains what cannot be confirmed.
```

### Fixture Z — brief signal conflict

```text
Input:
Metadata says no brief.
AI output references a supplied brief, time limit or side requirement.

Expected:
scoring basis: brief uncertain;
unsupported brief-specific claims suppressed;
repair prompt or operator confirmation requested;
report does not publish contradictory score language.
```


### Fixture AA — three active takes

```text
Input:
One audition with Take 1, Take 2 and Take 3 active.

Expected:
all three active takes have individual reports;
all three active takes have QA artefact status in admin where QA is enabled;
comparison runs across the three active take versions;
comparison identifies which take versions were compared;
route/PDF/admin surfaces do not imply a fourth active take exists.
```

### Fixture AB — replace Take 2

```text
Input:
Audition has Take 1, Take 2 and Take 3.
User replaces Take 2 with a new self-tape.

Expected:
Take 2 v1 becomes replaced or archived;
Take 2 v2 becomes active;
Take 2 v2 receives a new analysis run and individual report;
Take 2 v2 receives QA artefact status in admin where QA is enabled;
previous comparison is marked stale or regenerated;
new comparison uses Take 1 active, Take 2 v2 active and Take 3 active;
Take 2 v1 remains inspectable in admin subject to retention policy.
```

### Fixture AC — replace with same video

```text
Input:
User replaces Take 3 with the same underlying media.

Expected:
same-video / duplicate handling activates;
replacement is marked duplicate, probable duplicate or intentional retest;
new report may be generated for regression/retest, but comparison must not create a false winner;
admin shows duplicate/same-video status and QA artefact status.
```

### Fixture AD — one or two active takes

```text
Input:
Audition has only Take 1, or only Take 1 and Take 2.

Expected:
one active take: individual report only, no ordinary comparison;
two active takes: comparison between the two active versions only;
empty slots are shown as empty, not failed.
```

---

## 11. Operating rules for roadmap slices

Every slice must satisfy these rules:

1. **Report value first.** If the route/PDF is weak, the slice fails.
2. **AI question first.** Do not add report UI without an AI question.
3. **No generic code brain.** Code must not invent professional critique.
4. **Brief transparency by default.** Do not suppress supplied brief content by default.
5. **Selected level is a standard.** Do not treat level as tone.
6. **Scoring basis is explicit.** No-brief scores are baseline only.
7. **Known material is secondary.** Role/material research supports the brief and cannot invent mandatory blockers.
8. **Technique commentary by default.** Attempt it where evidence exists.
9. **Timestamp commentary by default.** Attempt timestamps/time bands where available.
10. **Score language must align.** Numeric values must not contradict report language.
11. **Level-relative Professional score calibration matters.** Professional tapes need stricter 0–100 score explanation, not only high-score differentiation.
12. **Take lifecycle is explicit.** One audition has up to three active take slots; replacement creates a new take version and stale comparisons are refreshed or marked stale.
13. **Same-video handling is explicit.** Duplicate/retest/comparison cases must not be ambiguous.
14. **Operator assumptions are tested.** Canary-critical assumptions must be confirmed or marked uncertain.
15. **QA is proof, not product.** Artefact work must not starve report value.
16. **Minimal env sprawl.** Product toggles belong in admin/database config where possible.

---

## 12. Stop / rollback conditions

Pause or rollback a slice if any of these occurs:

- Canary A or Canary B regresses;
- the route/PDF becomes less useful than the previous accepted state;
- a module becomes generic/thin because AI output was not requested or not routed;
- supplied brief detail is suppressed by default;
- selected level is captured but not used;
- no-brief report claims brief achievement;
- role/material research invents hidden requirements or unsafe casting/type language;
- score language contradicts report terminology;
- Professional score collapses to generic excellence;
- same-video comparison creates a false winner;
- more than three active takes can exist for one audition;
- replacing a take silently overwrites earlier report/QA proof;
- comparison mixes active and replaced versions unintentionally;
- admin cannot see take/comparison report and QA status where QA is enabled;
- QA/proof work blocks useful report generation unnecessarily;
- product toggles are implemented as env-var sprawl;
- production/customer/Level 2 approval is claimed without a dedicated release slice.

---

## 13. What this roadmap deliberately does not do

This roadmap does not approve:

- production/customer release;
- Level 2 or Level 3 release acceptance;
- public-share/export report mode;
- public scoring release;
- public comparison recommendation release;
- broad removal of red-line handling;
- direct raw prompt/raw response output;
- direct internal QA artefact rendering as the report.

It does approve the S10 direction:

```text
Full-value authenticated report mode.
AI as the brain.
Prompt-engineering first.
Supplied brief transparency.
Selected level as assessment standard.
Brief/no-brief score semantics.
Role/material context where source basis supports it.
Technique and timestamp commentary.
Score/comparison nuance.
level-relative 0–100 score calibration.
Audition take slot lifecycle and replacement history.
Per-take and per-comparison admin QA visibility.
Same-video handling.
Route/PDF first acceptance.
QA as secondary proof.
```

---

## 14. Final roadmap rule

If the performer would not find the report useful within 60 seconds, the roadmap slice fails — regardless of how clean the payloads, artefacts or gates look.

The report must visibly answer:

```text
What was I judged against?
What was the scoring basis?
What did the brief require, if supplied?
What did the tape show?
What is ready?
What is not ready?
What should I fix first?
What should I preserve?
What should I do next?
```
