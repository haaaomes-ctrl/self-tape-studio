# TapeCoach Requirements — AI-Led Full-Value Self-Tape Report System

**Document status:** controlling README for the S10 reset and rebuilt TapeCoach evaluation/report system.  
**Purpose:** define product behaviour, report requirements, AI analysis contract, performer-level calibration, brief/no-brief score semantics, role/material research, level-relative professional score calibration, audition take lifecycle, comparison handling, admin QA proof expectations, public/private boundaries and release decisions that implementation agents must follow.  
**Supersedes:** earlier README/report design notes where they conflict with this document.  
**Language:** UK English.  
**Architecture reset:** S10 reset after rollback to S9-19 and report-value regressions.  
**Current implementation note:** S10 is already being implemented. The calibration additions in this README are not a new reset; they are controlling amendments to be merged into the relevant in-flight S10 slices.  
**Core correction:** TapeCoach is an AI-led professional critique system. The AI is the report brain. Code asks the right questions, validates, repairs, routes and renders the AI output.

---

## Source hierarchy and delivery documents

`README.md` is the controlling source for TapeCoach product behaviour, report requirements, scoring rules, AI analysis expectations, QA artefacts, validator gates, public/private boundaries and release decisions.

`AGENTS.md` operationalises this README for implementation agents. It does not override this README.

`docs/tapecoach/s10-target-architecture.md` describes the S10 target architecture. It does not override this README.

`docs/tapecoach/s10-ai-prompt-map.md`, `docs/tapecoach/s10-score-calibration.md`, `docs/tapecoach/s10-same-video-handling.md`, and `docs/tapecoach/s10-golden-fixtures.md` are supporting specification documents. They must align with this README.

`tapecoach-v3-roadmap.md`, if present, is a sequencing layer only. It may define slices and workflow. It must not introduce product requirements, public-output permissions, release gates or acceptance decisions that are not already present in this README.

When implementation agents work on a task, they should use:

1. this README;
2. `AGENTS.md`;
3. the relevant target architecture / prompt / calibration / fixture document;
4. the specific issue, prompt or acceptance gate for the current task.

If documents conflict, this README wins.

---

## Development guardrails and common pitfalls

Implementation agents must read `AGENTS.md` before changing TapeCoach report, AI analysis, prompt, routing, rendering, QA or comparison code.

Mandatory guardrails:

- Codex or implementation completion is not acceptance.
- The report is the product; QA artefacts prove it, but do not replace it.
- AI output is the intelligence layer; code must not invent professional critique.
- A safe but unhelpful report fails.
- Payload success is not report success; route/PDF report surface must be reviewed or tested.
- Do not suppress supplied brief content by default.
- Do not avoid technique-library commentary by default.
- Do not use generic fallback copy as report substance.
- Do not add broad safety restrictions beyond the high-risk red lines defined in this README.
- Do not add environment-variable sprawl for product toggles.
- Operator assumptions that affect canary acceptance must be confirmed by the operator or marked uncertain.
- Selected performer level must be used as an assessment standard, not as tone.
- Scoring basis must be explicit: brief-supplied, partial-brief, no-brief baseline or brief-uncertain.
- Role/material research may support judgement only where source basis and observed evidence allow.
- Professional scoring must use stricter level-relative evidence thresholds across the full 0–100 scale; scores in the 90s should be rare and require exceptional evidence.
- Each audition supports up to three active take slots; replacing a take creates a new take version and a fresh report/QA run.
- Ordinary comparison is between the active versions of Take 1, Take 2 and Take 3.
- Canonical run identity is `take-[raw_core]`; `take-take-*` is invalid.
- Clean generated artefact churn before commit.

---

## 0. Executive summary

TapeCoach is an AI-led professional self-tape critique and audition-readiness system.

It reads the supplied brief where present, analyses the self-tape, identifies the discipline and required components, applies the selected performer-level standard, resolves role/material context where supplied, calibrates score language to the available evidence, and produces a full-value authenticated report for the performer.

The central product questions are:

> Is this tape ready to submit for this performer’s selected level, audition type and supplied brief / task?  
> Has the performer achieved the supplied brief, where one was provided?  
> If no brief was supplied, what can and cannot be assessed from the observable tape?  
> What does the tape communicate at the selected level?  
> Where role/material is supplied, how specifically does the tape serve that task?  
> At Professional level, is this merely competent, or competitive?  
> Across the Professional 0–100 scale, what evidence holds the score where it is, what would raise it, what should be preserved, and whether retaking is strategically useful or risky?  
> What must be fixed first, what else should improve, what should be preserved, and what should not be over-fixed?  
> If the audition has up to three active takes, which active take or combination of choices best serves the submission, and why?

Every authenticated performer-facing report must help the performer understand:

1. whether to submit, retake or review carefully;
2. why that recommendation was reached;
3. what scoring basis was used;
4. what selected performer level was applied;
5. what the supplied brief asked for, if supplied;
6. what TapeCoach observed in the tape;
7. what was achieved, missed, incomplete, not assessable or not applicable;
8. what role/material context was used, if any, and with what source basis;
9. the fix-first item, if a fix is needed;
10. all useful priority fixes, ranked by importance, without arbitrary item caps;
11. must-fix items before submission;
12. should-improve items if retaking;
13. optional polish, where useful;
14. what is already working and should be preserved;
15. relevant technique-library commentary;
16. timestamped or time-banded commentary where available;
17. what to do next;
18. what not to over-fix;
19. what could not be assessed reliably;
20. how score and comparison language should be interpreted, where scores or comparisons are visible;
21. for Professional reports, the selected-level score standard, score suppressors, score raisers, preserve guidance and retake strategy across the full 0–100 scale;
22. where multiple takes exist, which active take versions were analysed or compared, and whether any replacement made a previous comparison stale.

The judgement should combine practical agent, casting-aware reviewer, acting coach, vocal/singing coach, movement/dance coach, musical-theatre package coach, commercial/screen-task coach, self-tape technician and audition-coach perspectives.

TapeCoach must not become a basic video/audio checker, a compliance wrapper, a JSON projection, or a thin safety shell.

### 0.1 Final operating formula

```text
Selected level determines the standard.
Brief determines the task.
Observed tape provides the evidence.
Role/material research adds secondary specificity where supported.
Audition take slots determine which active takes are analysed or compared.
Score expresses readiness against the available evidence.
Professional scoring applies stricter evidence thresholds across the full 0–100 scale; scores in the 90s should be rare.
The UI and admin surfaces must make the source basis, active take versions and QA status visible where applicable.
```

With a brief:

```text
score can include brief achievement and mandatory blockers.
```

Without a brief:

```text
score is a baseline assessment only.
Brief adherence, mandatory requirements and audition-specific compliance are not assessable.
```

---

## 1. Core doctrine

### 1.1 The AI is the report brain

TapeCoach’s performer-facing report must be primarily populated from AI analysis and AI professional judgement.

The AI should provide:

- observation;
- interpretation;
- component detection;
- scoring-basis classification;
- brief achievement judgement;
- role/material calibration where supplied;
- performer-level calibration;
- readiness recommendation;
- performance critique;
- technique commentary;
- prioritisation;
- strengths;
- optional polish;
- level-relative professional score calibration where applicable;
- comparison judgement across active takes;
- take-slot and active-version awareness;
- score reasoning;
- timestamped or time-banded notes;
- next-action guidance.

Code should:

- load deterministic inputs;
- ask the AI the right module-level questions;
- validate structure;
- detect missing, thin, generic, contradictory or unsupported modules;
- re-prompt for repair;
- route structured outputs to the report model and UI;
- deduplicate and reconcile contradictions;
- apply narrow high-risk red-line filtering;
- render the report;
- emit diagnostics and QA artefacts.

Code must not replace missing AI judgement with generic filler.

### 1.2 Prompt engineering first

Every visible report module must have an AI question designed to populate it.

If a developer adds or changes a report section, they must also define:

- the AI question that populates it;
- the expected structured output;
- completeness rules;
- repair prompts;
- how the output is routed into the UI.

Do not build report sections primarily populated by static code fallback.

### 1.3 Full-value authenticated report mode

The authenticated performer-facing report should use all useful available information, including:

- supplied brief text;
- selected performer level and level standard;
- scoring basis and limitations;
- role/project/material context;
- audition instructions;
- deadline, upload, file naming and format requirements;
- AI observations;
- performance critique;
- acting, vocal, singing, movement and musical-theatre package notes;
- technique-library commentary;
- role/material research where source basis is clear;
- scores and comparison values in authenticated/operator/test mode;
- timestamped or time-banded notes where available;
- professional judgement;
- level-relative 0–100 score calibration where scores are visible;
- active take slot/version context and comparison context where applicable;
- per-take and per-comparison QA/admin status where applicable;
- operator-confirmed assumptions.

Do not suppress content merely because it is detailed, brief-derived, technique-related, score-related, comparison-related, positive, critical, role-specific or professionally specific.

### 1.4 Narrow high-risk red-line handling only

Suppress or rewrite only:

- system secrets;
- environment values;
- signed/private system URLs;
- raw prompts in performer-facing prose or non-secure exports;
- raw model responses in performer-facing prose or non-secure exports;
- internal QA artefact internals in performer-facing prose;
- evidence IDs / truth IDs / raw run IDs in performer prose;
- protected-characteristic inference;
- body/appearance judgement;
- medical or vocal-health diagnosis;
- guaranteed casting, callback, booking, job or employment outcomes;
- unsupported certainty.

Everything else should be available to the authenticated report if useful.

### 1.5 Authenticated report versus future public share/export modes

This README defines the authenticated performer-facing report.

The authenticated report may show supplied brief content, selected level, scoring basis, scores, comparison values, technique commentary, role/material context and detailed professional critique subject only to the high-risk red lines above.

A future public share/export mode may apply a stricter redacted policy, but that future mode must not be used to starve the authenticated report.

### 1.6 Calibration doctrine

The AI must resolve and preserve these distinctions:

```text
Brief-supplied scoring ≠ no-brief baseline scoring.
Selected level calibration ≠ tone.
Professional judgement ≠ harsh wording.
Role/material research ≠ hidden casting requirement.
High score ≠ no useful feedback.
Professional scoring ≠ a special top-band category; the full 0–100 scale must be stricter at Professional level.
```

---

## 2. Primary system flow

The simplest TapeCoach flow is:

1. **User input**
   - optional brief;
   - selected skill / performer level;
   - self-tape video;
   - optional audition type / discipline / comparison selection;
   - optional role, character, production, song, side, copy or material context;
   - up to three active audition take slots, with replacement history where relevant.

2. **Automated media layer**
   - upload;
   - Mux processing;
   - media readiness;
   - duration / audio / video / framing / continuity signals where available.

3. **Input intelligence layer**
   - determine scoring mode;
   - parse supplied brief where present;
   - preserve useful brief details;
   - extract role/project/material context;
   - classify requirements;
   - resolve whether known role/material research applies.

4. **AI intelligence layer**
   - two-step AI analysis observes the tape and produces professional judgement;
   - AI is prompted module by module;
   - AI repair prompts run if a report module is missing, thin, generic or contradictory;
   - technique-library and timestamp commentary are attempted by default where evidence allows;
   - performer-level standard is applied before final recommendation;
   - role/material calibration is applied where source basis and evidence support it;
   - Professional 0–100 level-relative score calibration is applied where applicable.

5. **Report/UI layer**
   - code pipes AI outputs into the report model and UI;
   - code formats and renders;
   - code applies only narrow high-risk red-line filtering;
   - code does not invent professional critique.

6. **Operator/QA layer**
   - uncertain assumptions are confirmed with the operator where needed;
   - QA artefacts prove what happened;
   - QA failure blocks release proof, not report generation.

Expanded architecture:

```text
User input
  - supplied brief, if present
  - selected performer level
  - audition type / discipline, if known
  - role/material context, if supplied
  - self-tape media
  - optional comparison takes, limited to three active take slots
        ↓
Input context builder
        ↓
Audition take slot / active version resolver
        ↓
Brief / no-brief scoring mode resolver
        ↓
Brief / material / role resolver
        ↓
Role / character / known-material research pass, if applicable
        ↓
Known material baseline profile, if applicable
        ↓
Media / assessability pass
        ↓
AI observation pass
        ↓
Brief achievement pass, if brief supplied
        ↓
Role/material calibration pass, if applicable
        ↓
AI professional judgement pass
        ↓
Performer level calibration pass
        ↓
Score and recommendation calibration
        ↓
level-relative score calibration, where scores are visible
        ↓
Report model composer
        ↓
Route / UI / PDF rendering
        ↓
QA artefacts as proof, not product
```

---

## 3. Input model and submission context

### 3.1 Required supported inputs

TapeCoach must support:

- video/audio self-tape media;
- selected performer level;
- optional supplied brief;
- optional audition type;
- optional discipline;
- optional role/material context;
- optional audition take slots up to Take 1, Take 2 and Take 3;
- optional replacement self-tapes for an existing take slot;
- optional comparison between active take versions.

### 3.2 Performer level is a required assessment input

The selected performer level is a first-class assessment standard.

It is not:

- a tone setting;
- an encouragement setting;
- a UI label only;
- a generic “be stricter” instruction.

It is:

- an input to the AI brain;
- a selector for the standard applied;
- a modifier of AI questions;
- a modifier of evidence thresholds;
- a modifier of score interpretation where scores are visible;
- a required part of the report explanation.

The same tape may be judged differently when the selected level changes. The observed evidence does not change, but the readiness bar, marginal risks, fix hierarchy, score interpretation and UI wording may change.

### 3.3 Supplied brief transparency

The supplied brief is first-class report input.

Do not lock down or hide the brief by default.

The report should show enough of the supplied brief for the performer to understand:

- project and role context where supplied;
- required material;
- required components;
- page / scene / line references;
- song / dance / movement requirements;
- ident/slate requirements;
- technical framing/orientation;
- file naming;
- upload instructions;
- deadline;
- one-file / continuous-video instructions;
- logistical constraints relevant to submission readiness.

### 3.4 No-brief behaviour

If no brief is supplied, TapeCoach must still provide useful performance and self-tape feedback.

It must not invent brief requirements.

It should say clearly:

- brief adherence cannot be assessed;
- no supplied-brief material requirements were available;
- performance, presentation and technical feedback are still available where assessable;
- the score, if shown, is a baseline assessment only.

Short UI language:

```text
No brief supplied. Score reflects observable performance and setup only; brief fit is not assessed.
```

### 3.5 Same video and duplicate uploads

TapeCoach must explicitly handle same-video uploads.

A same-video upload may be:

- an accidental duplicate;
- an intentional retest / canary rerun;
- the same media judged against a changed brief;
- the same media judged at a changed skill level;
- the same media judged with changed role/material context;
- the same media rerun after a new AI/report version;
- a comparison scenario where two takes are actually identical.

The system must not treat an accidental duplicate as a genuinely new performance attempt.

If same-video status affects comparison, canary acceptance or report interpretation, it must be confirmed by the operator or marked uncertain.

### 3.6 Same-video statuses

| Status | Meaning | Expected behaviour |
|---|---|---|
| `new_media` | The media appears to be a different self-tape. | Analyse as a new take. |
| `same_video_confirmed` | Operator or strong signals confirm same underlying video. | Do not imply performance changed; allow retest/regression review. |
| `probable_duplicate` | Signals strongly suggest duplicate, but not confirmed. | Ask operator or mark uncertain. |
| `intentional_retest` | Same video intentionally rerun to test report logic. | Allow, but mark as retest. |
| `same_video_changed_brief` | Same video judged against a different brief. | Reanalyse brief achievement; do not imply new performance. |
| `same_video_changed_level` | Same video judged at a different level. | Recalibrate level-relative commentary; do not imply performance changed. |
| `same_video_changed_role_context` | Same video judged with changed role/material context. | Recalibrate task specificity; do not imply performance changed. |
| `duplicate_in_comparison` | Compared takes are the same media. | Do not recommend one as a different performance; explain duplicate status. |


### 3.7 Audition take slots, replacement and comparison lifecycle

Each audition may contain up to three active take slots:

```text
Take 1
Take 2
Take 3
```

An audition may have fewer than three takes, but it must not have more than three active takes.

Comparison is performed between the active takes in those three slots.

```text
Audition
  Take 1 active version
  Take 2 active version
  Take 3 active version
        ↓
Comparison report
```

Each take slot may be replaced by a newly uploaded self-tape.

Replacing a take must not silently overwrite the previous take analysis. A replacement creates a new take version and a new analysis run.

```text
Take 2 v1
  replaced by
Take 2 v2
```

Only the latest active version of each take slot participates in the ordinary audition comparison, unless an admin/operator explicitly opens an earlier version for QA, audit or regression review.

Previous versions should remain available in the admin/QA view subject to retention, privacy and deletion policy.

#### Required behaviour

For every uploaded or replaced take, TapeCoach must create:

- a media processing record;
- an analysis run;
- an individual take report;
- a report model;
- QA artefacts where QA is enabled;
- admin-visible run status;
- admin-visible artefact status.

For every comparison run, TapeCoach must create:

- a comparison analysis run;
- a comparison report;
- comparison reasoning;
- same-video / duplicate checks;
- comparison QA artefacts where QA is enabled;
- admin-visible comparison status;
- admin-visible comparison artefact status.

A take replacement must trigger a fresh report for that take.

A take replacement must also invalidate or refresh any comparison that included the replaced active take.

#### Active comparison rule

Ordinary comparison uses the active version of each available take slot:

```text
active Take 1
active Take 2
active Take 3
```

Do not compare replaced or archived versions against active takes unless the admin/operator explicitly requests a historical, audit or regression comparison.

#### Same-video and duplicate handling

If a replacement or additional take appears to be the same underlying video as an existing take, TapeCoach must apply same-video / duplicate handling.

The system must not create a false winner between duplicate or near-duplicate media.

If the same video is intentionally re-uploaded as a retest, the report and QA artefacts must mark it as an intentional retest or operator-confirmed same-video run.

#### Admin requirements

The admin section must make the take lifecycle inspectable.

For each audition, admin should show:

```text
Audition
  Take 1
    active version
    previous versions
    report status
    QA artefact status
  Take 2
    active version
    previous versions
    report status
    QA artefact status
  Take 3
    active version
    previous versions
    report status
    QA artefact status
  Comparison runs
    compared active versions
    comparison report status
    comparison QA artefact status
```

A report is incomplete from an admin/QA perspective if the performer-facing report renders but the admin cannot see whether the take report, comparison report and QA artefacts were emitted, missing, failed, deferred or not applicable.

#### Performer-facing requirements

The performer-facing audition page should make the active take state clear:

```text
Take 1
Take 2
Take 3
```

Where a take was replaced, performer-facing UI may show only the current active take unless product policy chooses to expose previous versions.

The performer-facing comparison must not confuse replaced versions with active takes.

---

## 4. Media preparation and assessability

### 4.1 Media readiness

TapeCoach should resolve:

- media readiness;
- duration;
- audio presence;
- video presence;
- framing/orientation;
- continuity/cut-off indicators where available;
- timestamps or time bands where available.

Preferred duration sources:

1. trusted processed media metadata from the upload/Mux pipeline;
2. file/container metadata from the prepared media asset;
3. direct playable-duration probe;
4. user-supplied duration as low-confidence fallback only.

### 4.2 Assessability before criticism

Do not criticise what cannot be assessed.

If audio/video/framing/material is not assessable, say what could not be assessed and why. Do not treat not-assessable as performance criticism.

Assessability should inform the report, not dominate it unless it genuinely blocks judgement.

False audio domination is unacceptable: clear or assessable audio must not become a blocker merely because a fallback path failed.

---

## 5. AI analysis engine

### 5.1 AI passes

TapeCoach should use structured AI passes where possible.

#### Pass 0 — input/scoring context

The AI or deterministic context builder should identify:

- scoring mode;
- selected performer level;
- supplied brief status;
- available role/material context;
- audition type / discipline where known;
- active take slot/version context;
- comparison context;
- limitations before analysis.

#### Pass 1 — observation

The AI should identify:

- what appears in the tape;
- sequence of components;
- ident/slate;
- acting scene;
- song;
- dance/movement;
- missing/incomplete/cut-off material;
- audio/video/framing assessability;
- timestamped or time-banded observations where possible;
- uncertainty.

#### Pass 2 — professional judgement

The AI should provide:

- readiness recommendation;
- brief achievement judgement where brief exists;
- role/material calibration where applicable;
- performer-level calibration;
- fix hierarchy;
- strengths and preserve;
- technique-library commentary;
- score reasoning;
- comparison judgement across active take versions where relevant;
- level-relative 0–100 score calibration where scores are visible;
- next action;
- do-not-overfix;
- limitations.

### 5.2 Step 2 failure handling

If Pass 2 fails, the system must not collapse into a thin shell.

It should use Pass 1 + supplied brief + deterministic input to generate the best useful fallback report possible.

The report should clearly mark reliability limitations, but still answer the core report questions where evidence allows.

### 5.3 AI repair prompts

Before rendering, run a module completeness check.

For each report module, classify:

- `complete`;
- `missing`;
- `thin`;
- `generic`;
- `contradictory`;
- `unsupported`;
- `not_assessable`.

If a module is missing, thin, generic or contradictory, do not fill it with static fallback copy. Ask the AI a targeted repair question.

Examples:

- If strengths are generic, ask the AI for specific strengths from the tape.
- If technique commentary is missing despite visible evidence, ask the AI for technique commentary.
- If next action is empty, ask the AI for a submit checklist or retake plan.
- If comparison is present but no reasoning exists, ask the AI to compare the takes.
- If timestamps are unavailable, ask for component-level commentary instead.
- If scoring basis is missing, ask the AI to classify brief-supplied / partial-brief / no-brief / brief-uncertain.
- If selected-level reasoning is missing, ask the AI to state the applied level standard.
- If Professional full-scale score nuance is missing, ask the AI to explain the tape on the 0–100 level-relative scale.

Only after repair fails should the report explain a limitation.

---

## 6. AI module question map

Every visible report section must have an AI question designed to populate it.

The AI must be explicitly asked to populate:

- take slot and active version context where applicable;
- scoring basis;
- performer level calibration;
- brief intelligence;
- role/material context where supplied;
- observed tape content;
- component detection;
- brief achievement;
- role/material task calibration;
- readiness recommendation;
- why this recommendation;
- fix hierarchy;
- strengths and preserve;
- technique-library commentary;
- timestamped commentary;
- scores / calibration where enabled;
- level-relative 0–100 score calibration where scores are visible;
- comparison where enabled;
- next action;
- do-not-overfix;
- not-assessable limitations.

### 6.1 Brief / no-brief scoring mode prompt

Before scoring, determine the scoring mode.

Inputs:

- supplied brief text, if present;
- uploaded sides/copy/lyrics/material, if present;
- user-supplied role/material/task context;
- selected performer level;
- audition type / discipline;
- observed tape evidence;
- media assessability.

Tasks:

1. Classify scoring mode as:
   - `brief_supplied`;
   - `partial_brief_supplied`;
   - `no_brief_baseline`;
   - `brief_uncertain`.
2. State what can be scored in this mode.
3. State what cannot be scored in this mode.
4. If no brief is supplied, mark brief achievement as not assessable.
5. If brief status is uncertain, suppress unsupported brief-specific claims and request repair or operator confirmation.
6. Do not invent requirements, time limits, role demands, sides, upload instructions or package components.
7. Ensure score language matches the scoring mode.
8. Ensure the recommendation explains the scoring basis.

### 6.2 Brief intelligence prompt

Ask the AI to:

- read the supplied brief;
- extract every requirement relevant to submission readiness;
- quote or summarise useful brief wording;
- classify each requirement as material, performance, technical, admin/process, deadline or logistics;
- classify importance as mandatory, preferred, optional or ambiguous;
- say what evidence should appear in the tape;
- say how achievement should be judged.

### 6.3 Role / character research and material calibration prompt

Run this when the brief, uploaded material or user input identifies a production, role, character, scene, song, copy, dance task or known material.

Purpose:

```text
Resolve the role/material task so the tape can be judged against the supplied brief first, and against known role/material characteristics secondarily.
```

Inputs:

- supplied brief;
- uploaded sides/copy/lyrics/material, if available;
- selected performer level;
- audition type / discipline;
- role / character / production / song / scene / copy / routine identifiers;
- observed tape evidence;
- research results or known-material profile;
- media assessability.

Tasks:

1. Identify the production, role, character and material, if supplied.
2. Separate:
   - formal supplied-brief requirements;
   - uploaded-material demands;
   - user-supplied context;
   - known-material research;
   - general professional standards.
3. State which source has priority.
4. Extract task-relevant role/material demands.
5. Mark each demand as:
   - mandatory from brief;
   - preferred from brief;
   - optional from brief;
   - known-material context only;
   - ambiguous.
6. Identify what evidence would need to be visible/audible in the tape.
7. Compare observed evidence against those demands.
8. Use known-material research only as secondary nuance unless the brief explicitly requires it.
9. Do not infer appearance, body/type, marketability, bookability, callback likelihood or hidden casting fit.
10. Do not use role research to create a mandatory blocker unless the supplied brief or uploaded material supports it.
11. Preserve uncertainty where role/material identity or source confidence is low.

### 6.4 Observed tape prompt

Ask the AI to:

- analyse the tape in sequence;
- identify ident/slate, acting scene, song, dance/movement and other components;
- identify cut-off or incomplete material;
- assess continuity / one-file package where possible;
- assess audio, video and framing;
- provide timestamps or time bands where possible;
- state uncertainties clearly.

### 6.5 Brief achievement prompt

Ask the AI to compare the observed tape against each brief requirement and classify each as:

- achieved;
- mostly achieved;
- partly achieved;
- not achieved;
- not assessable;
- not applicable.

For each requirement, it should provide:

- evidence;
- submission impact;
- next action where relevant.

### 6.6 Performer level calibration prompt

Before making a recommendation, apply the selected performer level as the assessment standard.

Inputs:

- selected performer level;
- audition type / discipline;
- supplied brief, if present;
- observed tape evidence;
- media assessability;
- required components;
- role/material context, if applicable;
- comparison context, if present.

Tasks:

1. State the selected-level standard being applied.
2. Identify what the tape demonstrates at that level.
3. Identify what falls short at that level.
4. Separate:
   - brief blockers;
   - assessability blockers;
   - selected-level performance gaps;
   - role/material specificity gaps;
   - technical presentation issues;
   - optional polish.
5. Explain whether the selected level changes the recommendation.
6. Explain what would be different if the same tape were judged at a lower or higher level, only where useful.
7. Do not imply a higher-level standard has been met unless the evidence supports it.
8. Do not use guaranteed casting, callback, booking, job or employment language.
9. Preserve uncertainty where evidence is incomplete or not assessable.

### 6.7 Recommendation prompt

Ask the AI to give one of:

- `submit`;
- `submit_if_deadline_is_close`;
- `review_carefully`;
- `retake_required_if_possible`.

It must explain why in terms of:

- scoring basis;
- supplied brief;
- observed tape;
- selected performer level;
- role/material context where applicable;
- audition type / discipline where known;
- technical assessability;
- comparison context where relevant.

### 6.8 Fix hierarchy prompt

Ask the AI to rank all meaningful fixes by submission impact.

Return:

- fix first;
- priority fixes;
- must-fix before submitting;
- should-improve if retaking;
- optional polish.

For each fix, provide:

- issue;
- why it matters;
- exact action;
- severity / urgency;
- category: brief, performance, technical, admin, role/material or polish.

### 6.9 Strengths and preserve prompt

Ask the AI to identify what is already working and should be preserved.

Return:

- performance strengths;
- brief/package strengths;
- role/material strengths where supported;
- technical strengths;
- specific choices or moments to keep.

Do not accept generic praise as the only strength.

### 6.10 Technique-library prompt

Ask the AI to attempt technique commentary for:

- acting;
- vocal / singing;
- movement / dance;
- musical-theatre package integration;
- commercial / screen task;
- self-tape presentation.

For each area:

- what is visible;
- what is working;
- what could improve;
- what cannot be assessed;
- practical next action.

### 6.11 Timestamped commentary prompt

Ask the AI to provide timestamped or time-banded notes where possible.

Include:

- important strengths;
- component starts / endings;
- missing or incomplete material;
- cut-offs;
- technical/audio/framing issues;
- performance moments to refine;
- moments to preserve.

If timestamps are unavailable, ask for component-level commentary instead.

### 6.12 Score calibration prompt

Ask the AI to explain the score in relation to:

- scoring basis;
- selected performer level;
- brief completion, where brief exists;
- role/material specificity, where supplied;
- performance quality;
- technical assessability;
- submission readiness;
- comparison context.

A score must not be just a number. It must have language.

### 6.13 Professional 0–100 score calibration prompt

Run this prompt when:

- selected performer level is Professional;
- the tape is assessable enough to score;
- score language, score chips or score-relative recommendations are visible.

Purpose:

```text
Apply Professional evidence thresholds across the full 0–100 scale.
```

Professional is not a separate top-band calibration mode. Professional level means the same 0–100 scale is marked more stringently because the evidence threshold is higher across every band. Scores in the 90s should be rare and should appear only when the tape shows exceptional Professional evidence against the supplied task, selected level, observable performance, technical setup and any supported role/material context.

Tasks:

1. State the Professional standard applied.
2. Explain what evidence supports the actual score band, whatever the score is.
3. Identify what meets the Professional standard.
4. Identify what falls short of Professional standard.
5. Identify score suppressors: the concrete evidence holding the score down.
6. Identify score raisers: what would move the score higher.
7. Identify what should be preserved.
8. State whether retaking is strategically useful or risky.
9. If comparing takes, explain the evidence-based advantage without overclaiming small numerical differences.
10. Do not treat scores in the 90s as a separate report category or scoring subsystem.
11. Do not imply guaranteed casting, callback, booking or employment outcome.
12. Preserve uncertainty where the evidence is incomplete.

### 6.14 Comparison prompt

When multiple active takes exist, ask the AI to compare only the active take versions unless an admin/operator explicitly requests a historical comparison. Ask the AI to compare:

- which active take better meets the brief;
- performance differences;
- technical differences;
- role/material specificity where applicable;
- strongest choices in each;
- what should be preserved;
- whether the comparison is valid or affected by same-video status;
- which take slots and take version IDs were compared.

### 6.15 Next action prompt

Ask the AI to produce:

- a finite retake plan if retaking;
- a submit checklist if submitting;
- a review checklist if reviewing carefully.

Do not encourage endless retakes.

### 6.16 Do-not-overfix prompt

Ask the AI to identify what not to change.

Examples:

- do not chase audio changes if audio is already assessable;
- do not rework achieved brief components;
- do not keep retaking a strong complete package without a concrete purpose;
- do not spend time on optional polish before missing mandatory material;
- do not retake a Professional 96+ tape for vague polish if the likely retake risk is higher than the gain.

### 6.17 Limitations prompt

Ask the AI to list what could not be assessed and why.

No internal codes should appear in performer prose.

---

## 7. Report model and required sections

### 7.1 FullReportModel

The report model should be rich enough to preserve AI judgement.

Required top-level sections:

```text
take_lifecycle
scoring_context
level_calibration
role_material_context
recommendation
brief
observed_tape
scores
level_relative_score_calibration
comparison
fix_hierarchy
strengths
technique
timestamped_commentary
next_action
limitations
red_line_filter
operator_assumptions
```

### 7.2 Authenticated report sections

The authenticated report should render:

1. recommendation;
2. take slot / active take version where relevant;
3. scoring basis;
4. judged-against selected performer level;
5. readiness / score / comparison chips where enabled;
6. Professional score-band meaning where applicable;
7. why this recommendation;
8. what the brief asked for, if supplied;
9. brief achievement, if brief supplied;
10. role/material context, source basis and uncertainty where applicable;
11. what TapeCoach observed;
12. what meets the selected-level standard;
13. what falls short at the selected level;
14. fix first;
15. prioritised fixes;
16. must fix before submitting;
17. should improve if retaking;
18. optional polish;
19. strengths to preserve;
20. technique-library commentary;
21. timestamped / time-banded commentary;
22. next action;
23. do not over-fix;
24. not assessable / reliability notes;
25. operator/test diagnostic notes where applicable.

### 7.3 Required report labels

Every authenticated report must visibly answer:

```text
Take: [Take 1 / Take 2 / Take 3, where applicable]
Scoring basis: [brief supplied / partial brief supplied / no brief supplied — baseline assessment only / brief status uncertain]
Judged against: [selected performer level]
```

When role/material research applies, it must show:

```text
Role / material context: [production / role / material]
Source basis: [brief supplied / uploaded material / user supplied / known-material research]
Primary standard: [supplied brief]
Secondary context: [known role/material baseline, if used]
```

When selected level is Professional and score language is visible, it must show:

```text
Professional score calibration
Standard applied: [Professional casting-facing standard]
Score meaning: [...]
What supports this score: [...]
What holds the score down: [...]
What would raise the score: [...]
Retake strategy: [...]
```

### 7.4 Thin-shell anti-regression rule

A report fails if, despite available brief and media evidence, it collapses to generic copy such as:

- “No single public-safe priority fix was available”;
- “Preserve the clearest choices already captured”;
- “This affects readability, not talent” as the only strength;
- generic do-not-over-fix copy without context;
- a recommendation without concrete reasons;
- brief achievement without itemised evidence;
- level calibration without the selected-level standard;
- score without scoring basis;
- Professional score without level-relative score explanation;
- role/material context without source basis;
- an empty next-take plan;
- “report polish unavailable” as a reason to withhold useful guidance.

Thin-shell reports are unacceptable.

### 7.5 Limited report model

A limited report is allowed only when evidence is genuinely insufficient.

A limited report is not allowed merely because:

- report polish failed;
- AI judgement pass failed but observation evidence exists;
- section routing failed;
- QA artefacts failed;
- source-kind checks are incomplete;
- the system is being over-cautious.

If limited output is used, the report must say exactly what evidence was insufficient and what the performer can do next.

---

## 8. Performer Level Calibration Architecture

### 8.1 Purpose

TapeCoach must judge every self-tape against the performer level selected by the user.

The selected performer level changes:

- AI questions;
- evidence threshold;
- readiness interpretation;
- fix hierarchy;
- score meaning where scores are visible;
- level-relative report language;
- acceptance tests.

The same tape may be judged differently at different selected levels because the standard has changed.

### 8.2 Supported levels

```ts
type PerformerLevel =
  | "learning_school"
  | "amateur_community"
  | "emerging_training"
  | "professional";
```

| Selected level | AI brain emphasis | Evidence threshold | UI wording requirement |
|---|---|---|---|
| Learning / School | Is the performer prepared, clear and responding to the task? | Basic task understanding, preparation, intelligibility and early craft evidence. | “Ready for Learning / School level” or “next step before submitting at this level.” |
| Amateur / Community | Does the tape communicate reliably in a lower-stakes audition context? | Clear, prepared, task-relevant work that can be understood and assessed. | “Strong for Amateur / Community” without implying Professional standard. |
| Emerging / Training | Is there credible craft and specificity under training or early-career scrutiny? | Specific choices, consistency, assessable technique and clear development direction. | “Strong for Emerging / Training” plus gap to Professional where useful. |
| Professional | Is this competitive and sendable under casting-facing conditions? | Discipline-specific, evidence-rich, brief-precise, technically assessable work. | “Ready for Professional submission”, “Professional-level gap” or “not yet standout”, with concrete evidence. |

### 8.3 Level-specific flows

#### Learning / School

```text
Learning / School selected
        ↓
AI applies Learning / School standard
        ↓
AI asks:
- Is the task basically understood?
- Is the performer prepared enough for this context?
- Is speech, song or movement intelligible and assessable?
- Is there early craft evidence?
- Is the tape complete enough for the assignment or audition context?
- What is the most useful next correction?
        ↓
UI output:
- “Judged against: Learning / School”
- readiness at this level
- main next step
- what is already working
- what not to over-fix
```

A strong Learning / School tape may be excellent for that level. It must not be implied to be Professional-standard unless Professional evidence is independently present.

#### Amateur / Community

```text
Amateur / Community selected
        ↓
AI applies Amateur / Community standard
        ↓
AI asks:
- Is the tape clear, prepared and task-relevant?
- Does the performance communicate reliably in a lower-stakes audition context?
- Are the required brief components present, where a brief exists?
- Is the tape technically assessable?
- What would most improve readability, confidence or task fit?
        ↓
UI output:
- “Judged against: Amateur / Community”
- strong / usable / not ready for this level
- gap to selected level
- must-fix versus optional polish
```

A tape may be strong for Amateur / Community without being Professional-ready.

#### Emerging / Training

```text
Emerging / Training selected
        ↓
AI applies Emerging / Training standard
        ↓
AI asks:
- Is there credible craft beyond basic preparation?
- Are the choices specific rather than general?
- Does the performer sustain the scene, song, copy or movement task?
- Is the work ready for training, early-career or semi-professional scrutiny?
- Is the tape technically clean enough to judge the work fairly?
- What is the gap to Professional, if useful?
        ↓
UI output:
- “Judged against: Emerging / Training”
- readiness for this level
- priority fixes
- strengths to preserve
- Professional gap where relevant
```

Emerging / Training should be developmental without becoming soft or vague.

#### Professional

Professional level is the strictest branch.

```text
Professional selected
        ↓
Load ProfessionalLevelStandard
        ↓
AI observation pass:
- What is actually visible and audible?
- Which brief components are present?
- Which components are missing?
- Which components are incomplete or cut off?
- What is assessable?
- What is uncertain?
        ↓
AI professional judgement pass:
- Does this meet the brief at Professional submission standard?
- Is the work competitive, not merely competent?
- Are acting, vocal, singing, movement, commercial or self-tape choices discipline-specific?
- Is the tape technically clean enough not to distract?
- Is there a casting-facing risk?
- Is any issue a mandatory blocker, Professional-level gap or optional polish?
        ↓
Level calibration pass:
- What meets Professional standard?
- What falls short of Professional standard?
- What might be acceptable at a lower level but exposed here?
- What is the single highest-impact fix?
- Is this submit, submit-if-deadline-close, review carefully or retake required at Professional level?
        ↓
Professional level-relative score calibration
        ↓
UI output:
- “Judged against: Professional”
- recommendation
- why this recommendation is Professional-level
- Professional-level evidence that works
- Professional-level gaps
- score-band meaning and score suppressors
- fix first
- preserve guidance
- retake strategy
```

Professional does not mean “use harsher language”. Professional means the AI applies a higher standard and asks higher-resolution questions.

### 8.4 Professional distinction requirements

Professional reports must explicitly distinguish:

```text
competent vs competitive
ready vs standout
technically secure vs artistically compelling
visible execution vs specialist precision
good submission quality vs stronger competitive evidence
```

Professional judgement must consider:

- brief precision;
- mandatory component completion;
- performance specificity;
- discipline-specific evidence;
- acting / vocal / movement / commercial task fit;
- camera readability;
- technical assessability;
- style / material fit where supported by the brief;
- role/material specificity where supplied;
- risk under casting-facing conditions;
- fix-first urgency;
- optional polish;
- retake risk;
- score-language alignment where scores are visible.

---

## 9. Brief-Supplied and No-Brief Scoring Architecture

### 9.1 Purpose

TapeCoach must make clear whether a score was produced with or without a supplied brief.

A score means different things depending on the available input context.

The report must never imply that the performer achieved a brief if no brief was supplied.

The report must never invent missing brief requirements, time limits, sides, page numbers, role demands, upload instructions, file naming rules or mandatory components.

### 9.2 Scoring modes

```ts
type ScoringMode =
  | "brief_supplied"
  | "partial_brief_supplied"
  | "no_brief_baseline"
  | "brief_uncertain";
```

| Scoring mode | Use when | Score may include | Score must not claim |
|---|---|---|---|
| `brief_supplied` | A casting brief, audition instructions, sides, copy, song requirement, role requirement or package requirement is supplied. | Brief achievement, mandatory requirements, preferred/optional handling, role/material specificity where supplied, admin/process readiness, level calibration, technical assessability, performance quality. | Guaranteed outcome, universal quality or hidden casting fit. |
| `partial_brief_supplied` | Some context is supplied, but formal requirements are incomplete. | Supplied context, observed performance quality, limited task-fit commentary, selected-level calibration, known role/material context if supported. | Full brief compliance, deadline/upload compliance, time-limit compliance or mandatory package completion unless supplied. |
| `no_brief_baseline` | No brief, role, task, material, copy, song, side or audition instruction is supplied. | Observable performance readability, selected-level calibration, technical assessability, inferred discipline/task evidence, self-tape presentation. | Brief achievement, mandatory component completion, role-specific compliance, project-specific fit or admin compliance. |
| `brief_uncertain` | Metadata or user input conflicts. | Provisional observed quality/readiness with uncertainty. | Any confident brief-adherence claim. |

### 9.3 Score meaning by mode

With a supplied brief:

```text
Score = brief achievement + observed performance + selected level + assessability + discipline/task + optional role/material context.
```

Without a brief:

```text
Score = observed performance + selected level + assessability + inferred task/discipline only.
Brief achievement is not scored.
Brief blockers cannot be invented.
Known role/material claims must be suppressed unless supplied or confidently observable.
```

### 9.4 Mode-aware score bands

#### With a supplied brief

| Score band | Meaning with brief |
|---|---|
| 0–39 | Not submission-ready / not assessable because serious missing evidence, technical blocker or incomplete required package prevents reliable judgement. |
| 40–54 | Retake required if possible because a major brief, performance or presentation issue blocks submission readiness. |
| 55–69 | Review carefully because some usable material exists, but there is meaningful brief, performance, technical or uncertainty risk. |
| 70–84 | Submit if deadline is close because the tape is submission-supporting, with manageable caveats or optional polish. |
| 85–100 | Strong submission / submit because the tape is brief-complete or mostly brief-complete, assessable, strong for selected level and not blocked by a mandatory brief issue. |

#### Without a supplied brief

| Score band | Meaning without brief |
|---|---|
| 0–39 | Not reliably assessable or not ready on observable performance/setup evidence. |
| 40–54 | Retake recommended because a major observable performance, task-readability or technical issue limits usefulness. |
| 55–69 | Review carefully because the tape has usable elements but meaningful observable risk, uncertainty or selected-level gap remains. |
| 70–84 | Baseline submission-supporting for the selected level, assuming the unseen brief does not add requirements this tape fails. |
| 85–100 | Strong baseline tape for the selected level, based on observable performance and setup only. Brief achievement is not assessed. |

### 9.5 Required no-brief limitation language

When no brief is supplied, the report must visibly say:

```text
No casting brief was supplied, so TapeCoach cannot assess brief adherence, required components, role-specific instructions, deadline/upload compliance or whether this tape fulfils the exact audition task.

This score is a baseline assessment of the observable tape against the selected performer level, inferred discipline/task evidence and technical assessability.
```

### 9.6 No-brief score constraints

A no-brief tape can still score highly, but the meaning must be constrained.

```text
No-brief score can be high for observable tape quality.
No-brief score cannot certify audition-specific readiness.
```

A no-brief tape may score above 85 if the observed performance and setup are strong for the selected level.

However, the report must phrase this as:

```text
strong baseline assessment
```

or:

```text
strong for selected level from observable evidence
```

not:

```text
brief-complete
fully submission-ready for the audition
```

For Professional:

```text
A no-brief Professional tape may score highly only as a baseline Professional tape. Scores in the 90s should remain rare and must not imply full audition-specific readiness without a supplied brief.

It must not be described as fully competitive for a specific role, production, brief or casting task unless that context is supplied or reliably resolved.
```

### 9.7 Recommendation language by mode

With brief:

```text
Recommendation:
Submit.

Why:
The required material is present, the brief is achieved or mostly achieved, the tape is assessable, and the performance meets the selected-level standard.
```

Without brief:

```text
Recommendation:
Baseline submit-supporting.

Why:
From the observable evidence, the tape is strong for the selected level and technically assessable. Because no brief was supplied, TapeCoach cannot confirm whether the tape meets the actual audition requirements.
```

With uncertain brief:

```text
Recommendation:
Review carefully.

Why:
The tape has assessable strengths, but brief status is uncertain. Brief-specific claims have been suppressed until the actual task requirements are confirmed.
```

---

## 10. Role / Character Research and Known-Material Calibration

### 10.1 Purpose

When the supplied brief defines a role, character, production, scene, song, copy, brand, routine or known material, TapeCoach should research and resolve that material before final judgement.

The AI brain should not judge only against a generic acting / vocal / movement standard when the task is clearly role-specific.

The research layer answers:

```text
What does this role/material appear to demand?
Which of those demands are explicitly required by the brief?
Which are known-material context only?
Which are visible in the tape?
Which are not assessable?
How should this affect readiness at the selected level?
```

### 10.2 Core rule

```text
Known role/material research supports the brief.
It does not outrank the brief.
```

TapeCoach must not do this:

```text
Known character lore
        ↓
Invent hidden casting requirements
        ↓
Penalise the performer for not matching them
```

TapeCoach must do this:

```text
Supplied brief
        ↓
Extract role / character / material
        ↓
Research known role/material baseline if confidence is high enough
        ↓
Separate brief requirements from known-material context
        ↓
Observe the tape
        ↓
Judge performance against:
  1. the supplied brief;
  2. observed evidence;
  3. selected performer level;
  4. known role/material baseline;
  5. general professional standard.
        ↓
Render clear report with source confidence and uncertainty
```

### 10.3 Precedence rules

1. Supplied brief is primary.
2. Observed tape evidence is required for scoring.
3. Selected level still controls the bar.
4. Known material cannot invent mandatory blockers.
5. Role research must avoid unsafe casting language.

Correct wording:

```text
The supplied brief appears to prioritise guarded vulnerability. Known role context supports moral conviction and outsider pressure, but the report should judge this take primarily against the brief’s requested version.
```

Incorrect wording:

```text
This performer is not right for the role.
This performer does not look like the character.
The role must always be played this way.
```

### 10.4 Activation

Run this pass when one or more of the following are present:

- production title;
- role / character name;
- scene / side reference;
- song title;
- commercial product / campaign context;
- dance style / routine title;
- known play, musical, film, series, advert, game or source material;
- uploaded sides / script / lyrics / copy;
- user-supplied role or material context.

Do not run the pass as fact if:

- no role or material is supplied;
- role recognition confidence is low;
- the title is ambiguous;
- the role conflicts with the brief;
- the material is private/confidential and cannot be safely researched or surfaced;
- research would require guessing protected characteristics or appearance-based fit.

In no-brief mode, use only:

```text
observed task + selected level + general professional standards
```

and explicitly say:

```text
No supplied role or material context was available, so role-specific fit was not assessed.
```

### 10.5 Research source hierarchy

Use this hierarchy for role/material research:

1. Supplied casting brief.
2. Uploaded sides / copy / lyrics / material packet.
3. User-confirmed role/material context.
4. Official production / publisher / licensing / theatre / education materials.
5. Reputable theatre, film, literary or industry references.
6. Internal known-material profile, if already validated.
7. General model knowledge only as low-confidence context.

### 10.6 Truth-state handling

Every role/material claim must carry a truth state.

```ts
type RoleResearchTruthState =
  | "brief_supplied"
  | "uploaded_material_extracted"
  | "user_supplied"
  | "official_source_researched"
  | "known_material_profile"
  | "model_inferred_low_confidence"
  | "observed_in_tape"
  | "not_available"
  | "contradicted_or_unreliable";
```

The report should phrase claims according to source:

```text
The supplied brief asks for...
From the uploaded side...
You supplied...
Known-material context suggests...
From the available research...
This was visible/audible in the tape...
This was not assessable...
```

Do not flatten these into one certainty level.

### 10.7 Scoring impact rules

Brief-primary demands can affect:

- brief achievement;
- mandatory blockers;
- fix-first;
- recommendation;
- score caps;
- selected-level readiness;
- selected-level score-band meaning.

Secondary known-material demands can affect:

- sub-dimension nuance;
- role/material specificity;
- style/genre fit where supported;
- Professional-level competitiveness;
- what to preserve;
- optional polish;
- score movement within a band.

Secondary known-material demands must not create:

- mandatory blockers;
- hidden requirements;
- appearance/type criticism;
- casting prediction;
- guaranteed outcome.

### 10.8 Elphaba / Wicked example

Do not hard-code this as a universal rule. Use it as an example of the process.

```text
Brief:
Professional MT audition.
Role: Elphaba.
Show: Wicked.
Material: song cut and side.

Known-material baseline may include:
- outsider / misunderstood status;
- moral conviction;
- self-definition under pressure;
- relationship stakes where relevant to the supplied material;
- strong acting-through-song demand where singing is present;
- role-specific vocal/story integration;
- stricter Professional evidence thresholds if auditioning at Professional level.

Primary judgement:
Did the performer meet the supplied brief?

Secondary judgement:
Did the tape show observable role-specific evidence that supports the known material?

Professional score calibration across 0–100:
A technically excellent vocal take may still score in the high-but-sub-exceptional range if the story pressure, lyric intention or character arc is clear but not distinctive enough for the very top of the Professional scale.
```

Correct report language:

```text
Judged against: Professional.
Role/material context: Elphaba, Wicked.

The supplied brief is the primary standard. Known-material context suggests the role benefits from clear moral conviction, outsider pressure and story-led vocal choices. In this tape, the vocal line is secure and the final phrase has stronger conviction, but the opening reads more generally intense than specifically role-driven. That keeps this in the solid Professional score band rather than the standout-level band.
```

Incorrect report language:

```text
You are not right for Elphaba.
You do not look like Elphaba.
This will not book.
Elphaba must always be played this way.
The role requires X because fans expect it.
```

---

## 11. Scores, score terminology and professional nuance

### 11.1 Scores are allowed in authenticated/operator/test mode

Numeric score and comparison chips may be visible in authenticated, operator and test modes.

This does not mean public/customer scoring approval, production release, or external public comparison recommendation approval.

The system must distinguish:

- score chip visibility;
- score reasoning in the report;
- public scoring product approval;
- comparison chip visibility;
- comparison recommendation approval.

### 11.2 Scores must align with terminology

Visible scores must align with report terminology.

A score is not just a number. It must map to:

- scoring basis;
- readiness language;
- submission guidance;
- selected performer level;
- confidence / reliability;
- fix hierarchy;
- comparison wording;
- performer-facing next action.

Unacceptable contradictions:

- score suggests strong readiness but verdict says retake required without explaining the brief blocker;
- score suggests low readiness but verdict says submit without explanation;
- comparison chip shows a large difference but report gives no comparison reasoning;
- report says “brief achieved” but score language implies a mandatory blocker;
- report says “no mandatory blocker” but score terminology says “not ready”;
- report says “no brief supplied” but score language says “brief-complete”.

### 11.3 Score dimensions

Scores should be explained through dimensions such as:

- scoring basis;
- brief completion where brief exists;
- performance readability;
- acting / vocal / movement quality as relevant;
- role/material specificity where supplied;
- technical assessability;
- self-tape presentation;
- selected-level calibration;
- Professional score-band meaning where applicable;
- comparison advantage.

### 11.4 Professional 0–100 level-relative score calibration

Professional scoring must be more stringent across the full 0–100 scale.

Do not create a separate high-score-only calibration subsystem. Do not bundle Professional reports into a special scores-in-the-90s category. The whole Professional scale must carry higher evidence thresholds than lower selected levels.

A Professional score in the 90s should be difficult to achieve. It should appear only when the tape shows exceptional evidence across the relevant supplied brief, observable performance, technical assessability, selected-level standard and supported role/material context.

Professional score explanation must answer:

```text
What Professional standard was applied?
What evidence supports this actual score?
What meets Professional standard?
What holds the score down?
What would raise the score?
What should be preserved?
Is retaking strategically useful or risky?
```

If a mandatory brief blocker exists, Professional score language must not override the blocker. The report should say:

```text
The performance evidence may be strong, but Professional submission readiness is blocked by missing required material.
```

### 11.5 Professional full-scale score-band expectations

These bands are guides for score meaning at Professional level. They are not a public scoring release policy and do not replace the AI's evidence-led explanation.

| Score band | Professional meaning | Typical action |
|---|---|---|
| 0–39 | Not reliably assessable or materially below Professional submission standard. | Retake or resolve assessability/material blockers before relying on the report. |
| 40–54 | Major Professional readiness gaps or mandatory brief/technical issues dominate. | Retake required if possible, with fix-first driven by the largest blocker. |
| 55–69 | Some Professional evidence exists, but the tape carries meaningful submission risk. | Review carefully or retake if the highest-impact fix is practical. |
| 70–79 | Viable Professional elements are visible, but the tape is not yet strongly competitive. | Submit only if deadline pressure or context supports it; otherwise targeted retake/review. |
| 80–89 | Professional-standard or near submission-ready evidence, with specific refinements or risks. | Usually submit-supporting if no mandatory blocker exists; preserve strongest choices. |
| 90–100 | Rare, exceptional Professional evidence across the relevant criteria. | Usually submit; do not retake unless there is a specific high-value, low-risk fix or a brief/admin issue. |

A top-band Professional score does not mean:

```text
guaranteed callback
guaranteed booking
perfect performance
objectively best possible take
```

It means:

```text
From the available evidence, this is exceptionally strong against the selected Professional standard and the available task context.
```

### 11.6 Professional score suppressors, raisers and retake strategy

At Professional level, every visible score should explain why it is not higher and what would raise it.

Evaluate:

- brief precision;
- role / material fit where supplied;
- acting specificity;
- vocal / singing specificity;
- movement / physical precision;
- camera and self-tape readability;
- distinctiveness and memorability where observable;
- casting-facing risk;
- retake risk;
- comparison advantage where comparison is valid.

Do not say the performer is “memorable” as generic praise. Say what creates that effect.

At Professional level, retaking a strong tape can make it worse. Ask:

```text
Is the likely gain from retaking greater than the risk of losing what already works?
```

The report should say:

```text
Retake only if you can fix [specific issue] without losing [specific strength].
```

or:

```text
Do not retake for general polish. Submit this version.
```

### 11.7 High-score comparison rules

When comparing Professional take comparisons, TapeCoach must not overstate tiny numerical differences.

| Score difference | Interpretation |
|---|---|
| 0–1 point | Treat as essentially equivalent unless there is a clear brief, technical or comparison-specific reason. |
| 2–3 points | Meaningful only if supported by concrete evidence. Explain the specific advantage. |
| 4–5 points | Likely meaningful. Explain what materially improves competitiveness. |
| 6+ points | Significant difference, unless same-video / assessability / brief mismatch invalidates comparison. |

If two takes sit in the same broad Professional score band:

```text
Both takes sit in the same broad Professional score band. The better choice depends on [brief precision / acting specificity / vocal security / technical clarity / style fit].
```

If the difference is too close to call:

```text
The numerical difference is too small to treat as decisive. Choose the take that best matches the brief, or use the one with the cleaner technical presentation.
```

If the compared takes are the same video:

```text
The comparison is not valid as a performance comparison because the media appears to be the same underlying tape.
```

---

## 12. Data model additions

These types are illustrative contracts. They may be split across implementation files, but the concepts must exist.

```ts
type PerformerLevel =
  | "learning_school"
  | "amateur_community"
  | "emerging_training"
  | "professional";

type PerformerLevelStandard = {
  level: PerformerLevel;
  displayLabel: string;
  assessmentStandard: string;
  submitReadyRequires: string[];
  strongEvidenceRequires: string[];
  commonGaps: string[];
  highScoreMeaning: string;
  mustNotImply: string[];
};

type LevelCalibrationPass = {
  selectedLevel: PerformerLevel;
  standardApplied: string;
  evidenceMeetsLevel: string[];
  evidenceExceedsLevel?: string[];
  evidenceFallsShortAtLevel: string[];
  lowerLevelWouldLikelyReadAs?: string;
  nextLevelGap?: string[];
  recommendationImpact:
    | "supports_submission"
    | "minor_level_gap"
    | "material_level_gap"
    | "not_level_ready"
    | "overridden_by_brief_blocker"
    | "overridden_by_assessability_blocker";
  confidence: "high" | "medium" | "low";
  uncertaintyNotes: string[];
};

type ScoringMode =
  | "brief_supplied"
  | "partial_brief_supplied"
  | "no_brief_baseline"
  | "brief_uncertain";

type BriefScoringContext = {
  scoringMode: ScoringMode;
  briefStatus:
    | "full_brief_available"
    | "partial_context_available"
    | "no_brief_available"
    | "conflicting_signals";
  canAssessBriefAchievement: boolean;
  canAssessMandatoryRequirements: boolean;
  canAssessRoleSpecificFit: boolean;
  canAssessAdminCompliance: boolean;
  canAssessObservedPerformance: boolean;
  canAssessTechnicalSetup: boolean;
  canAssessSelectedLevelReadiness: boolean;
  scoreMeaningLabel:
    | "brief_based_submission_readiness"
    | "partial_context_readiness"
    | "no_brief_baseline_quality"
    | "provisional_due_to_brief_uncertainty";
  requiredLimitations: string[];
  forbiddenClaims: string[];
};

type ScoreCalibration = {
  totalScore: number;
  scoreBand: string;
  scoringMode: ScoringMode;
  scoreMeaning: string;
  selectedLevelContribution: string;
  briefContribution?: string;
  performanceContribution: string;
  technicalContribution: string;
  roleMaterialContribution?: string;
  whatThisScoreMeans: string;
  whatThisScoreDoesNotMean: string[];
  confidence: "high" | "medium" | "low";
  uncertaintyNotes: string[];
};

type RoleResearchTruthState =
  | "brief_supplied"
  | "uploaded_material_extracted"
  | "user_supplied"
  | "official_source_researched"
  | "known_material_profile"
  | "model_inferred_low_confidence"
  | "observed_in_tape"
  | "not_available"
  | "contradicted_or_unreliable";

type ResolvedField = {
  value: string;
  truthState: RoleResearchTruthState;
  sourceRef?: string;
  confidence: "high" | "medium" | "low";
  publicSafe: boolean;
};

type RoleMaterialDemand = {
  id: string;
  label: string;
  description: string;
  sourceTruthState: RoleResearchTruthState;
  importance:
    | "mandatory_from_brief"
    | "preferred_from_brief"
    | "optional_from_brief"
    | "known_material_context_only"
    | "ambiguous";
  observableEvidenceNeeded: string[];
  scoringUse:
    | "can_drive_brief_achievement"
    | "can_nuance_score"
    | "report_context_only"
    | "not_for_scoring";
  unsafeIfUsedFor?: string[];
};

type KnownMaterialBaselineProfile = {
  applies: boolean;
  productionTitle?: ResolvedField;
  roleOrCharacter?: ResolvedField;
  materialUnit?: ResolvedField;
  disciplineContext:
    | "acting"
    | "musical_theatre"
    | "singing"
    | "dance_movement"
    | "commercial"
    | "screen"
    | "hybrid"
    | "unknown";
  sourceSummary: {
    sourceType:
      | "brief"
      | "uploaded_material"
      | "user_supplied"
      | "official_source"
      | "licensed_or_publisher_source"
      | "reputable_reference"
      | "internal_known_material_profile"
      | "model_inferred_low_confidence";
    sourceLabel: string;
    confidence: "high" | "medium" | "low";
    publicUsable: boolean;
  }[];
  roleFunction?: string;
  characterGivenCircumstances?: string[];
  relationshipDynamics?: string[];
  emotionalOrStoryDemands?: string[];
  vocalOrMusicalDemands?: string[];
  movementOrPhysicalDemands?: string[];
  styleGenreDemands?: string[];
  cameraOrSelfTapeImplications?: string[];
  briefPrimaryDemands: RoleMaterialDemand[];
  secondaryKnownMaterialDemands: RoleMaterialDemand[];
  blockedInferences: string[];
  confidence: "high" | "medium" | "low";
  uncertaintyNotes: string[];
};


type AuditionTakeSlot = 1 | 2 | 3;

type TakeVersionStatus =
  | "active"
  | "replaced"
  | "processing_failed"
  | "analysis_failed"
  | "deleted_by_user"
  | "archived";

type TakeVersionSummary = {
  takeVersionId: string;
  slot: AuditionTakeSlot;
  uploadedAt: string;
  status: TakeVersionStatus;
  mediaAssetId?: string;
  analysisRunId?: string;
  reportId?: string;
  replacedByTakeVersionId?: string;
  replacementReason?:
    | "user_replaced"
    | "admin_retest"
    | "processing_retry"
    | "unknown";
};

type AuditionTakeSlotState = {
  auditionId: string;
  slot: AuditionTakeSlot;
  activeTakeVersionId?: string;
  versions: TakeVersionSummary[];
};

type TakeReportRun = {
  auditionId: string;
  slot: AuditionTakeSlot;
  takeVersionId: string;
  analysisRunId: string;
  reportId: string;
  reportStatus:
    | "pending"
    | "processing"
    | "rendered"
    | "failed"
    | "limited";
  qaArtefactStatus:
    | "not_enabled"
    | "emitted"
    | "partially_emitted"
    | "failed"
    | "deferred"
    | "not_applicable";
};

type AuditionComparisonRun = {
  auditionId: string;
  comparisonRunId: string;
  comparedTakeVersionIds: string[];
  comparedSlots: AuditionTakeSlot[];
  comparisonStatus:
    | "pending"
    | "processing"
    | "rendered"
    | "stale_after_replacement"
    | "suppressed_same_video"
    | "too_close_to_call"
    | "failed";
  qaArtefactStatus:
    | "not_enabled"
    | "emitted"
    | "partially_emitted"
    | "failed"
    | "deferred"
    | "not_applicable";
};

type ProfessionalScoreBand =
  | "0_39_not_reliably_assessable_or_materially_below_professional"
  | "40_54_major_professional_readiness_gap"
  | "55_69_meaningful_professional_submission_risk"
  | "70_79_viable_professional_elements_not_strongly_competitive"
  | "80_89_professional_standard_or_near_submission_ready"
  | "90_100_rare_exceptional_professional_evidence";

type ScoreRetakeStrategy =
  | "submit_do_not_retake"
  | "submit_retake_only_for_specific_fix"
  | "submit_if_deadline_close_targeted_retake_possible"
  | "review_before_submit_due_to_specific_risk"
  | "retake_required_due_to_blocker";

type ProfessionalScoreDimension =
  | "brief_precision"
  | "role_or_material_fit"
  | "acting_specificity"
  | "vocal_or_singing_specificity"
  | "movement_or_physical_precision"
  | "camera_readability"
  | "technical_presentation"
  | "distinctiveness"
  | "casting_facing_risk"
  | "retake_risk"
  | "comparison_advantage";

type ProfessionalScoreDimensionJudgement = {
  dimension: ProfessionalScoreDimension;
  rating:
    | "not_assessable"
    | "professional_viable"
    | "competitive"
    | "strong_competitive"
    | "standout"
    | "exceptional";
  evidence: string;
  impactOnScore:
    | "raises_score"
    | "holds_score"
    | "suppresses_score"
    | "not_applicable";
  performerFacingNote: string;
};

type ProfessionalScoreCalibration = {
  applies: boolean;
  selectedLevel: "professional";
  totalScore: number;
  scoreBand: ProfessionalScoreBand;
  scoreBandLabel: string;
  scoreBandSummary: string;
  whyThisScore: string[];
  professionalStrengths: string[];
  scoreSuppressors: string[];
  scoreRaisers: string[];
  preserveAtAllCosts: string[];
  retakeStrategy: ScoreRetakeStrategy;
  retakeRisk: string;
  dimensions: ProfessionalScoreDimensionJudgement[];
  comparisonNotes?: {
    comparedTakeId?: string;
    advantage?: string;
    disadvantage?: string;
    differenceMagnitude:
      | "material"
      | "moderate"
      | "marginal"
      | "too_close_to_call"
      | "invalid_same_video";
  }[];
  confidence: "high" | "medium" | "low";
  uncertaintyNotes: string[];
};
```

---

## 13. Readiness recommendations

### 13.1 Recommendation options

TapeCoach should use these performer-facing recommendation states:

| State | Meaning |
|---|---|
| `submit` | The tape appears ready to submit for the selected level and supplied task, or is a strong baseline where no brief is supplied and limitations are visible. |
| `submit_if_deadline_is_close` | The tape supports submission; optional polish may exist but should not delay unnecessarily. |
| `review_carefully` | The tape may be usable, but there is meaningful uncertainty or risk to check. |
| `retake_required_if_possible` | A material issue, missing brief component, serious technical issue or performance readability problem means a retake is recommended if time allows. |

### 13.2 Recommendation rules

The recommendation must be grounded in:

- scoring basis;
- brief requirements where supplied;
- observed tape content;
- selected performer level;
- role/material context where supported;
- discipline / audition type where known;
- media assessability;
- comparison context where applicable.

Do not use scores alone to determine recommendation.

A required brief failure can override a high performance score.

A technically assessable, brief-complete professional take should not collapse to `review_carefully` without a specific reason.

A no-brief report should not claim full audition readiness.

---

## 14. Brief achievement and requirement itemisation

### 14.1 Requirement categories

Classify requirements as:

- material;
- performance;
- technical;
- admin/process;
- deadline;
- logistics;
- role/material;
- ambiguous.

### 14.2 Requirement importance

Classify importance as:

- mandatory;
- preferred;
- optional;
- ambiguous.

Ambiguous requirements must remain ambiguous unless evidence or operator confirmation resolves them.

### 14.3 Achievement statuses

Use:

- achieved;
- mostly achieved;
- partly achieved;
- not achieved;
- not assessable;
- not applicable.

Not assessable is a limitation, not criticism.

### 14.4 Brief blockers

An assessable mandatory requirement that is not achieved can block submission readiness.

The report must identify:

- the requirement;
- evidence or uncertainty;
- submission impact;
- next action.

### 14.5 Positive brief completion

If required brief components are present and assessable, the report should say so and provide positive readiness guidance, strengths, optional polish and a submit checklist.

A brief-complete take must not receive an empty or thin report merely because there is no mandatory blocker.

---

## 15. Fix hierarchy and next action

### 15.1 Fix-first rule

`fix_first` is the highest-impact action before submission.

If no mandatory fix is identified, the report should say:

```text
No mandatory fix identified before submission.
```

Do not invent a fix.

### 15.2 Priority fixes

Include all meaningful priority fixes. Do not arbitrarily cap useful fixes.

Each fix should include:

- issue;
- why it matters;
- action;
- urgency / severity;
- category.

### 15.3 Must-fix, should-improve and optional polish

Separate:

- must-fix before submitting;
- should-improve if retaking;
- optional polish.

This prevents endless retake loops.

### 15.4 Next action

Next action should be finite and practical.

If retaking, provide ordered retake steps.

If submitting, provide a final submit checklist such as:

- filename;
- one-file export;
- playback/cut-off check;
- deadline;
- upload location;
- any required notes.

If reviewing carefully, say what specifically needs human/operator confirmation.

### 15.5 Do-not-overfix

Do-not-overfix guidance must be specific.

Examples:

- do not chase audio changes if audio is already assessable;
- do not rework achieved brief components;
- do not keep retaking a strong complete package without a concrete purpose;
- do not spend time on optional polish before missing mandatory material;
- do not retake a strong Professional tape unless the likely improvement is specific and worth the risk.

---

## 16. Strengths, preserve and positive feedback

### 16.1 Required strengths

Every useful report should identify what is working, unless the evidence genuinely cannot support it.

Strengths should be specific, such as:

- performance clarity;
- vocal or acting specificity;
- achieved brief package;
- role/material specificity where supported;
- assessable setup;
- strong moments;
- useful choices to preserve.

### 16.2 Generic strengths are not enough

The following must not be the only strength/preserve content:

- “Preserve the clearest choices already captured.”
- “This affects readability, not talent.”
- “Keep what works.”

If the AI returns only generic strengths, run a repair prompt.

### 16.3 Strong takes require value

A strong professional complete take must receive a useful report.

It should include:

- why it supports submission;
- what specifically works;
- what to preserve;
- optional polish, if useful;
- Professional score-band meaning where applicable;
- what not to change;
- final submit checklist.

---

## 17. Timestamped commentary

### 17.1 Requirement

Where timestamps or time-bands are available, TapeCoach should provide timestamped commentary for important observations.

Timestamped commentary should identify:

- component starts / endings;
- strong moments to preserve;
- missing or incomplete material;
- cut-offs;
- technical/framing/audio issues;
- performance moments to refine.

### 17.2 Fallback

If timestamps are unavailable, the report must still provide useful component-level commentary.

Absence of timestamps must not collapse the report into a thin shell.

### 17.3 Timestamp use

Timestamped notes may appear in:

- observed tape;
- strengths;
- priority fixes;
- technique commentary;
- next action;
- limitations.

---

## 18. Technique-library commentary

### 18.1 Default attempt

Technique-library commentary should be attempted by default where evidence exists.

Do not avoid technique commentary merely because prior versions over-restricted named technique authority.

### 18.2 Technique areas

Attempt commentary for:

- acting;
- vocal / singing;
- movement / dance;
- musical-theatre package integration;
- commercial / screen task;
- self-tape presentation.

### 18.3 Boundaries

Avoid:

- medical diagnosis;
- vocal-health diagnosis;
- body or appearance judgement;
- protected-characteristic inference;
- guaranteed casting/job outcomes;
- unsupported certainty.

Allowed:

- evidence-led acting notes;
- vocal/singing observations;
- movement/dance observations;
- MT package integration notes;
- camera/readability feedback;
- style/genre comments where supported;
- role/material technique comments where supported;
- practical coaching actions.

### 18.4 Missing material

If a required component is missing, technique commentary for that component should say it could not be assessed because the component is missing.

Example:

```text
The acting side could not be assessed because the required Side 1 scene was not present in the submitted tape.
```

---

## 19. Discipline and module detection

TapeCoach should detect and activate relevant modules from the supplied brief and observed tape.

Supported discipline/module families include:

- acting;
- musical theatre;
- singing / vocal;
- dance / movement;
- commercial / screen task;
- self-tape technical presentation;
- admin/submission package requirements;
- role/material-specific task requirements where supplied.

If discipline or module is uncertain, mark it as uncertain and explain why. Do not invent discipline-specific requirements.

---

## 20. Musical Theatre package requirements

Musical Theatre briefs may include:

- song;
- acting scene / side;
- dance / movement;
- ident/slate;
- one continuous video;
- technical or file instructions;
- role/material expectations.

TapeCoach must judge the package, not only the individual performance elements.

For MT package reports, identify:

- whether song is present and complete;
- whether acting side is present and complete;
- whether dance/movement is required and present;
- whether the package is continuous / one file;
- whether any component is missing, incomplete or not assessable;
- how the package affects submission readiness;
- how role/material context affects interpretation where supplied.

---

## 21. Comparison requirements

Comparison requirements apply to the active versions of up to three audition take slots unless an admin/operator explicitly runs a historical, audit or regression comparison.

### 21.1 Comparison modes

Comparison may occur in authenticated/operator/test mode.

The report may show score/comparison chips in these modes.

The system must distinguish comparison visibility from production/customer approval.

### 21.2 Comparison judgement

When comparison is enabled, ask the AI to compare:

- scoring basis;
- brief achievement;
- selected-level calibration;
- role/material specificity where applicable;
- performance quality;
- technical assessability;
- strongest choices;
- risks;
- what to preserve;
- whether one take better serves submission.

Do not guarantee casting, callback, booking or employment outcomes.

### 21.3 Same-video comparison

If compared takes appear to be the same video, the report must say so or ask for operator confirmation.

Do not recommend one duplicate over another as if they were different performances.


### 21.4 Three-take comparison model

Each audition supports a maximum of three active takes.

Comparison is between the active versions of Take 1, Take 2 and Take 3.

If only two takes are active, compare the two active takes.

If only one take is active, no ordinary comparison should be produced unless an admin/operator is running a historical, audit or regression comparison.

If a take is replaced, the previous comparison is stale because one of its compared inputs is no longer active.

The system should either:

- regenerate the comparison automatically after the replacement report is complete; or
- mark the comparison as stale and ask the user/admin to rerun comparison.

The comparison report must identify which take versions were compared.

```text
Compared:
Take 1 — version [...]
Take 2 — version [...]
Take 3 — version [...]
```

Do not compare hidden replaced versions against active takes unless the admin/operator explicitly requests that historical comparison.

A comparison report is incomplete if it does not identify its compared take slots and active take versions.

---

## 22. High-risk red-line filter

### 22.1 Filter actions

The red-line filter may:

- allow;
- rewrite;
- suppress.

It must not become a broad lockdown layer.

### 22.2 Rewrite before suppressing

If content is useful but overstrong, rewrite it into safe professional language.

| Overstrong / high-risk | Preferred rewrite |
|---|---|
| “This guarantees a callback.” | “This supports submission readiness from the available evidence.” |
| “This proves professional mastery.” | “This reads strongly against the selected level in the observed areas.” |
| “The performer has a vocal health issue.” | “Vocal health cannot be assessed; consider professional advice if there is concern.” |
| “You are right for this role.” | “The observed tape supports the role/material demands that were assessable from the supplied task.” |
| “You are not bookable for this.” | “Casting outcome cannot be predicted; the report can only assess the submitted tape against the available evidence.” |

### 22.3 Suppress only true red lines

Suppress only the high-risk categories defined in section 1.4.

Do not suppress supplied brief text, professional critique, scores, comparison values, technique commentary, timestamps, role/material context or brief instructions merely because they are detailed.

---

## 23. Certainty and ambiguity rules

The AI must not overstate certainty.

The report may say:

```text
from the available evidence
in the observed areas
not assessable from this tape
this appears to meet the selected-level standard
this is exposed at Professional level because...
known-material context suggests...
brief fit cannot be confirmed without the brief
```

The report must not say:

```text
this guarantees a callback
this will get the job
this proves professional mastery
this is objectively a 92-quality performance in all contexts
this is Professional-standard
this is right/wrong for the role
```

unless the selected level is Professional and the evidence independently supports a safe, non-guaranteed version of the professional-standard statement.

If the selected level affects judgement, the report must say how.

If the selected level does not affect judgement because a mandatory brief blocker or assessability blocker dominates, the report must say that too.

---

## 24. QA artefacts and diagnostics

### 24.1 QA is proof, not product

QA artefacts prove what happened. They do not replace the report.

If QA artefacts fail to emit:

- the report may still render;
- release proof is blocked;
- diagnostics must explain the artefact failure.

### 24.2 Required artefacts for proof

Where QA is enabled, preferred artefacts include:

- `input/context.json`;
- `ai/observation_pass.json`;
- `ai/judgement_pass.json`;
- `ai/repair_passes.json` where relevant;
- `ai/technique_commentary.json`;
- `ai/level_calibration.json`;
- `ai/brief_scoring_context.json`;
- `ai/role_material_calibration.json` where relevant;
- `ai/level_relative_score_calibration.json` where relevant;
- `take/take_lifecycle.json` where relevant;
- `comparison/comparison_run.json` where relevant;
- `report/full_report_model.json`;
- `report/authenticated_report_model.json`;
- `report/rendered_text.txt`;
- `qa/red_line_filter_trace.json`;
- `qa/report_quality_check.json`;
- `operator/assumption_log.json`.

### 24.3 Artefact failure handling

If artefacts are missing, release/canary proof fails until resolved.

The system should log safe diagnostics:

- whether QA emit was attempted;
- sink mode;
- bucket/config presence;
- artefact IDs attempted;
- artefact IDs written;
- safe error codes;
- whether log fallback was used.

Never log secrets, signed URLs, private media URLs, raw prompts or raw responses in ordinary logs.


### 24.4 Per-take and per-comparison QA in admin

Each take analysis run must have its own QA artefact bundle where QA is enabled.

Each comparison run must have its own comparison QA artefact bundle where QA is enabled.

Admin must show, for each take version:

- audition ID;
- take slot;
- take version ID;
- active/replaced status;
- media readiness status;
- analysis run ID;
- report status;
- QA artefact status;
- manifest status;
- report model status;
- rendered report status;
- failure/deferred/not-applicable reason where relevant.

Admin must show, for each comparison run:

- audition ID;
- compared take slots;
- compared take version IDs;
- comparison status;
- stale-after-replacement status where relevant;
- same-video / duplicate status;
- comparison recommendation status;
- comparison QA artefact status;
- manifest status;
- failure/deferred/not-applicable reason where relevant.

QA artefacts are internal/admin proof and must not leak into performer-facing prose.

---

## 25. Minimal env/config principle

### 25.1 Environment variables

Use environment variables only for secrets and deployment/runtime basics.

Expected categories:

- database / storage connection;
- AI provider key;
- Mux credentials;
- session/auth secrets;
- app environment;
- deployment commit if automatically provided.

Do not add env vars for ordinary product behaviour. The maximum of three active take slots is a product invariant in this README, not an environment toggle.

Owned Supabase migration note: Lovable reserves the `SUPABASE_` secret prefix, so TapeCoach server/admin Supabase runtime must prefer `TAPECOACH_SUPABASE_URL` and `TAPECOACH_SUPABASE_SERVICE_ROLE_KEY`. Legacy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are local/dev fallback names only. Browser Supabase configuration remains Vite-public only: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PROJECT_ID`. The service-role key must never be exposed to client/browser code. The protected cutover health route `POST /api/internal/cutover-health` requires `CUTOVER_HEALTH_SECRET` and may report only safe host/status/boolean diagnostics, never secret values.

### 25.2 Product configuration

Product toggles should live in database/admin config where possible.

Examples:

- `qa_artifacts_enabled`;
- `operator_test_mode_enabled`;
- `score_chips_visible`;
- `comparison_chips_visible`;
- `technique_library_enabled`;
- `role_material_research_enabled`;
- `level_relative_score_calibration_enabled`;
- `report_mode`;
- `ai_model_primary`;
- `ai_model_fallback`.

### 25.3 Deployment provenance

Deployment provenance is useful for release proof, not for report value.

A missing commit SHA should block release proof, but should not prevent the report from rendering.

---

## 26. Operator-tested assumptions

Any assumption that affects canary acceptance must be confirmed by the operator or marked uncertain.

Examples:

- same brief;
- same video;
- fixture type;
- expected blocker;
- complete brief package;
- selected performer level;
- scoring mode;
- role/material identity;
- known material source confidence;
- score chips intentionally visible;
- comparison intentionally visible;
- AI missed a component;
- AI misclassified material;
- same video changed brief;
- same video changed level;
- active take slot;
- active take version;
- replaced take version;
- replacement reason;
- comparison stale/refresh decision;
- intentional retest.

Operator feedback should become a fixture, regression test, prompt improvement or report-quality rule.

---

## 27. Golden fixtures

Every report-value change must preserve or improve these fixtures.

### Fixture A — incomplete mandatory MT package

Brief:

- Side 1 acting scene;
- contemporary legit MT song;
- one continuous video.

Tape:

- partial/cut-off song only;
- Side 1 missing;
- audio assessable.

Expected:

- retake required if possible;
- missing Side 1 is fix-first;
- song/package completion appears;
- continuous-video check appears;
- one-file upload/export check appears;
- no false audio blocker;
- no generic fallback copy;
- finite retake plan.

### Fixture B — strong professional complete package

Brief:

- same or comparable full brief.

Tape:

- required material present;
- complete package;
- professional level;
- audio/video assessable.

Expected:

- submit or submit if deadline is close;
- brief achieved or mostly achieved;
- no invented mandatory blocker;
- specific strengths;
- technique commentary;
- optional polish if useful;
- submit checklist;
- specific do-not-overfix guidance;
- no thin shell.

### Fixture C — old-report usefulness baseline

The 22 May report is a minimum usefulness floor, not an exact template.

New reports must preserve or exceed its practical specificity while applying only narrow high-risk filtering.

### Fixture D — poor assessability

Expected:

- limited report allowed;
- specific assessability explanation;
- no invented fixes;
- no generic shell.

### Fixture E — no brief supplied

Expected:

- useful performance/setup feedback;
- no invented brief requirements;
- brief adherence marked not assessable;
- scoring basis shown as no-brief baseline.

### Fixture F — same-video duplicate

Expected:

- duplicate/same-video status identified or marked uncertain;
- no misleading comparison of duplicate media as different performances;
- operator confirmation requested where needed.

### Fixture G — comparison

Expected:

- score/comparison chips visible in operator/test mode;
- comparison reasoning where enabled;
- same-video safeguards;
- no guaranteed casting outcome.

### Fixture H — same tape, different selected level

Expected:

- observed evidence remains the same;
- selected-level standard changes;
- recommendation may change;
- fix hierarchy may change;
- score language, where visible, is level-relative;
- UI states `Judged against: [selected level]`;
- Professional run is stricter and identifies Professional-level gaps;
- lower-level runs do not imply Professional readiness unless independently supported.

### Fixture I — Professional strictness

Expected:

- report does not call a clean but general take standout;
- AI distinguishes competent from competitive;
- Professional gaps are concrete;
- optional polish is separated from must-fix;
- no guaranteed callback, booking or employment language.

### Fixture J — mandatory blocker overrides level

Expected:

- missing required material remains fix-first at every level;
- tone and detail may vary by level;
- recommendation remains driven by brief failure;
- no level setting hides the mandatory blocker;
- report says the issue is brief completion, not lack of talent.

### Fixture K — strong lower-level tape, not Professional-ready

Expected:

- lower-level run may be strong or submission-supporting;
- Professional run should not describe the tape as standout unless evidence supports it;
- Professional run identifies the higher-level gap;
- report preserves strengths while explaining why the Professional bar is higher.

### Fixture L — Professional low-range score calibration

Expected:

- Professional score language explains why the tape sits below submission-ready Professional standard;
- the report separates assessability, brief blockers and performance gaps;
- the fix-first item is specific and evidence-led;
- lower-level strengths are not described as Professional readiness.

### Fixture M — Professional mid-range score calibration

Expected:

- Professional score language explains visible viable elements and meaningful competitive gaps;
- score suppressors are concrete;
- score raisers are practical;
- retake strategy is tied to the highest-impact improvement, not vague polish.

### Fixture N — Professional strong score calibration

Expected:

- report may support submission if no mandatory blocker exists;
- score language explains why the tape is strong but not exceptional;
- optional polish is separated from must-fix;
- preserve guidance is specific;
- no special top-band calibration block is required.

### Fixture O — Professional rare top-band score calibration

Expected:

- score in the 90s is treated as rare and exceptional;
- report explains the evidence that justifies the top-band score;
- report states what, if anything, holds the score below 100;
- no guaranteed outcome language;
- next action is usually a submission checklist, not performance correction.

### Fixture P — two Professional take comparisons

Expected:

- both are submit-supporting;
- the higher score is not treated as better merely because the number is higher;
- report explains the specific competitive advantage;
- comparison identifies what each take still does well;
- recommendation is evidence-led;
- no guaranteed callback or booking language.

### Fixture Q — tiny high-score difference

Expected:

- report does not overclaim a 1-point difference;
- if the advantage is marginal, say so;
- choose based on brief precision, technical clarity or specific performance evidence;
- if no meaningful difference is visible, mark as too close to call.

### Fixture R — known role with clear brief

Example:

```text
Professional MT audition.
Role: Elphaba.
Show: Wicked.
Required: specified song and side.
```

Expected:

- role/material context appears;
- supplied brief is primary;
- known role/material baseline is secondary;
- report references role-specific demands only as task/material context;
- no appearance/type/castability language;
- score nuance explains why the take is professionally viable / solid / strong / standout;
- Professional score meaning reflects role-specific competitive clarity where evidence supports it.

### Fixture S — known role conflicts with supplied brief

Expected:

- brief wins;
- report does not penalise the performer simply for not playing a generic version of the role;
- known-material context is used only to ask whether the brief version still carries stakes and specificity;
- no hidden requirement is invented.

### Fixture T — known material but missing required component

Expected:

- missing required component is fix-first;
- role research does not distract from the mandatory blocker;
- report may say role/material specificity in the present component is assessable, but full package readiness is blocked by missing required material.

### Fixture U — ambiguous role/material

Expected:

- role is not assumed unless the material clearly identifies it;
- report may say “known material” but must not state role-specific demands unless confidently resolved;
- uncertainty is visible.

### Fixture V — no brief, user mentions role casually

Expected:

- report treats the role mention as user-supplied focus, not a formal audition requirement;
- no mandatory role standards;
- feedback may offer role-context notes cautiously;
- readiness remains general to selected level unless a formal brief is supplied.

### Fixture W — no brief, strong observable tape

Expected:

- scoring basis: no brief baseline;
- brief achievement: not assessable;
- no invented role, time limit, sides, page range or package requirement;
- high score allowed only as baseline quality/readiness;
- report says actual audition fit cannot be confirmed without the brief;
- useful strengths, fixes, preserve guidance and next action still appear.

### Fixture X — brief supplied, missing mandatory component

Expected:

- scoring basis: brief supplied;
- missing component is a brief blocker;
- strong observed performance evidence may be acknowledged;
- overall recommendation is driven by missing required material;
- score language explains blocker override.

### Fixture Y — partial brief / known role only

Expected:

- scoring basis: partial brief supplied;
- role/material context may be used cautiously;
- no full package compliance claim;
- no deadline/upload/time-limit claim;
- no hidden mandatory side/song requirement unless supplied;
- report explains what cannot be confirmed.

### Fixture Z — brief signal conflict

Expected:

- scoring basis: brief uncertain;
- unsupported brief-specific claims suppressed;
- repair prompt or operator confirmation requested;
- report does not publish contradictory score language.


### Fixture AA — three active takes

Input:

```text
One audition with Take 1, Take 2 and Take 3 active.
```

Expected:

- all three active takes have individual reports;
- all three active takes have QA artefact status in admin where QA is enabled;
- comparison runs across the three active take versions;
- comparison identifies which take versions were compared;
- route/PDF/admin surfaces do not imply a fourth active take exists.

### Fixture AB — replace Take 2

Input:

```text
Audition has Take 1, Take 2 and Take 3.
User replaces Take 2 with a new self-tape.
```

Expected:

- Take 2 v1 becomes replaced or archived;
- Take 2 v2 becomes active;
- Take 2 v2 receives a new analysis run and individual report;
- Take 2 v2 receives QA artefact status in admin where QA is enabled;
- previous comparison is marked stale or regenerated;
- new comparison uses Take 1 active, Take 2 v2 active and Take 3 active;
- Take 2 v1 remains inspectable in admin subject to retention policy.

### Fixture AC — replace with same video

Input:

```text
User replaces Take 3 with the same underlying media.
```

Expected:

- same-video / duplicate handling activates;
- replacement is marked duplicate, probable duplicate or intentional retest;
- new report may be generated for regression/retest, but comparison must not create a false winner;
- admin shows duplicate/same-video status and QA artefact status.

### Fixture AD — one or two active takes

Input:

```text
Audition has only Take 1, or only Take 1 and Take 2.
```

Expected:

- one active take: individual report only, no ordinary comparison;
- two active takes: comparison between the two active versions only;
- empty slots are shown as empty, not failed.

---

## 28. Route/PDF first acceptance

Payloads are not enough.

Every report-value slice must inspect or test:

- rendered route text;
- exported PDF text;
- payload model;
- QA artefacts where available.

If the route/PDF is weak, the slice fails even if payload parity passes.

A performer should be able to understand within 60 seconds:

- submit / retake / review;
- scoring basis;
- judged-against selected level;
- why;
- top fix;
- brief achievement, where brief exists;
- role/material source basis, where used;
- Professional score-band meaning, where applicable;
- active take slots / compared take versions, where applicable;
- admin-visible per-take/per-comparison QA status where QA is enabled;
- next action.

---

## 29. Testing and acceptance policy

### 29.1 Required tests for report-value changes

Report-value changes should include tests for:

- AI prompt output shape;
- module completeness;
- repair prompting;
- route/PDF text;
- scoring mode classification;
- performer-level calibration;
- brief requirement extraction;
- brief achievement;
- role/material resolver where relevant;
- fix hierarchy;
- positive complete take;
- incomplete mandatory package;
- technique commentary;
- timestamped commentary where available;
- score terminology alignment;
- level-relative 0–100 score calibration;
- same-video handling;
- take slot lifecycle;
- take replacement invalidation/refresh;
- per-take and per-comparison admin QA status;
- comparison handling;
- red-line filtering;
- QA proof where relevant.

### 29.2 Acceptance hierarchy

A slice is not done unless:

- source/tests/build pass;
- route/PDF report surface is useful;
- relevant golden fixtures are preserved or improved;
- supplied brief content is not suppressed by default;
- selected level is visible and used;
- scoring basis is visible and consistent;
- role/material context has source basis where used;
- active take slots and compared take versions are visible where comparison/replacement applies;
- admin can inspect per-take and per-comparison report/QA status where QA is enabled;
- AI outputs are routed to the UI;
- no generic thin-shell copy is introduced;
- high-risk red-line content is suppressed or rewritten;
- assumptions are confirmed with operator where needed;
- QA artefact status is clear;
- production/customer/Level acceptance is not claimed unless explicitly in scope.

### 29.3 QA-only success is not acceptance

A slice cannot be accepted only because:

- payload parity passed;
- no-export proof passed;
- source-kind checks passed;
- QA artefacts emitted;
- build/tests passed.

Those are necessary but not sufficient.

The route/PDF report must be useful.

---

## 30. Release and maturity model

### 30.1 Maturity levels

Use maturity levels as release-control language, not as a reason to suppress useful feedback.

| Level | Meaning |
|---|---|
| Level 1 | AI-led audition readiness and performance readability report. |
| Level 2 | Discipline-specific and technique-aware critique. |
| Level 3 | Brief-intelligent module detection and package analysis. |
| Level 4 | Role/material/repertoire-aware feedback. |
| Level 5 | Comparison-aware and competitive readiness feedback. |
| Level 6 | Professional/agent mode with stricter full-scale scoring and operator tools. |

### 30.2 Release gates

Production/customer release requires separate acceptance.

Visible score/comparison chips in authenticated/operator/test mode do not equal production approval.

Operator/test diagnostics do not equal customer release.

### 30.3 Rollback rule

If a release produces a thin shell or materially reduces report usefulness, rollback the report-generation/rendering path while preserving useful infrastructure where possible.

---

## 31. S10 rebuild sequence

S10 is already in implementation. The sequence below remains the controlling order, with calibration amendments merged into relevant slices rather than treated as a separate reset.

1. AI-led report module question map.
2. Performer level calibration architecture.
3. Audition take slot lifecycle and admin QA contract.
4. Full-value authenticated report architecture and types.
5. Brief intelligence and authenticated brief transparency.
6. Brief/no-brief scoring basis semantics.
7. Role / character research and known-material calibration.
8. AI observation and professional judgement prompts.
9. Report model to UI piping.
10. Technique-library commentary.
11. Timestamped commentary.
12. Score terminology and professional nuance.
13. Professional 0–100 level-relative score calibration.
14. Same-video / duplicate-upload handling.
15. Positive brief-complete report path.
16. Incomplete mandatory package path.
17. Route/PDF first QA.
18. QA artefacts as secondary proof.

Do not start with payload gates, source-kind restrictions or QA architecture before the report is useful.

---

## 32. Resolved design issues from previous S10 attempts

### 32.1 Safety versus usefulness

Previous issue:

```text
public-safe = say less
```

Resolved rule:

```text
authenticated report = maximum useful information, narrow high-risk red-line filtering only
```

### 32.2 QA artefacts versus product

Previous issue:

```text
clean QA proof could coexist with weak report output
```

Resolved rule:

```text
QA proves the report; it does not replace report usefulness
```

### 32.3 Code versus AI

Previous issue:

```text
code filled modules with generic fallback when AI output was missing
```

Resolved rule:

```text
AI is the brain; code repairs, validates, routes and renders
```

### 32.4 Brief transparency

Previous issue:

```text
supplied brief content was treated as unsafe by default
```

Resolved rule:

```text
supplied brief is first-class authenticated report input
```

### 32.5 Scoring visibility

Previous issue:

```text
score visibility and production public scoring approval were conflated
```

Resolved rule:

```text
score/comparison chips may be visible in authenticated/operator/test mode; production approval is separate
```

### 32.6 Professional scoring nuance

Previous issue:

```text
Professional scores risked being treated as a high-score special case rather than calibrated across 0–100
```

Resolved rule:

```text
professional nuance must be expressed through sub-dimensions and written judgement, especially in the 90s
```

### 32.7 Same-video uploads

Previous issue:

```text
same video uploads could be treated as new performances or ambiguous comparisons
```

Resolved rule:

```text
same-video state must be detected, confirmed or marked uncertain
```

### 32.8 Selected level as tone

Previous issue:

```text
professional = harsher wording
```

Resolved rule:

```text
selected level determines the assessment standard before judgement is made
```

### 32.9 No-brief contradiction

Previous issue:

```text
no brief supplied, but report still claimed brief achievement
```

Resolved rule:

```text
no-brief score is baseline only; brief achievement is not assessable
```

### 32.10 Role/material specificity

Previous issue:

```text
known character or material context was either ignored or over-inferred
```

Resolved rule:

```text
known material supports the brief, carries truth state and source basis, and cannot invent hidden casting requirements
```


### 32.11 Take replacement and comparison lifecycle

Previous issue:

```text
multiple takes could be compared without a clear active-slot/version lifecycle
```

Resolved rule:

```text
each audition has up to three active take slots; replacing a take creates a new version, a new take report and a new QA/admin trail, and stale comparisons must be refreshed or marked stale
```

---

## 33. Forbidden failure modes

Do not:

- build a thin public-safe shell;
- suppress the supplied brief by default;
- avoid technique commentary by default;
- replace AI judgement with generic code fallback;
- accept a limited model when evidence is sufficient;
- accept payload-only success;
- accept QA-only success;
- hide behind “report polish unavailable”;
- render generic strengths as the only value;
- add broad restrictions beyond explicit high-risk red lines;
- add env-var sprawl for product toggles;
- proceed when operator assumptions are untested;
- treat a high score as a substitute for professional feedback;
- compare duplicate/same-video takes as though they are different performances;
- allow more than three active takes for one audition;
- silently overwrite a replaced take report or QA proof;
- let comparison mix active and replaced take versions unintentionally;
- render a comparison without identifying compared take versions;
- let a take or comparison report render without admin-visible report/QA status where QA is enabled;
- let a strong complete take produce an empty or thin report;
- treat selected level as tone or encouragement;
- let Professional merely mean harsher language;
- describe lower-level excellence as Professional-standard without evidence;
- let a no-brief score imply brief achievement;
- use role/material research to invent mandatory requirements;
- infer appearance, body/type, marketability, bookability or callback likelihood;
- flatten Professional scoring into generic excellence language.

---

## 34. Final controlling decision

TapeCoach should feel like:

```text
a casting-aware agent;
an acting coach;
a vocal/singing coach;
a movement/MT package coach;
a self-tape technician;
and a practical audition checklist.
```

It should not feel like:

```text
a compliance wrapper;
a JSON projection;
a safety shell;
a vague checklist;
a QA artefact viewer.
```

Final rule:

```text
Maximise useful professional information for the authenticated performer.
Suppress or rewrite only narrow high-risk content.
Ask the AI the right questions for every report module.
Pipe the AI output to the UI.
Use selected level as the standard.
Use the brief as the task authority.
Use role/material research only with source basis and observed evidence.
Use active take slots for comparison and preserve replacement history in admin/QA.
Make no-brief limitations visible.
Preserve Professional 0–100 level-relative score calibration.
Test assumptions with the operator.
Never accept a report that is safe but useless.
```
