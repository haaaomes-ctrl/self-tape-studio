# AGENTS.md — TapeCoach Implementation Contract

## Purpose

This file keeps implementation agents aligned with TapeCoach’s S10 direction.

TapeCoach is an AI-led professional self-tape critique system. The performer-facing report is the product. QA artefacts, gates and diagnostics prove the report; they do not replace it.

Do not optimise for a clean internal proof layer at the expense of performer-facing usefulness.

S10 is already being implemented. The performer-level, brief/no-brief, role/material, Professional 0–100 level-relative score calibration and audition take lifecycle rules in this file are controlling amendments to merge into the relevant in-flight S10 work. They are not a reason to discard useful implementation that already satisfies the README.

---

## Source hierarchy

1. `README.md` is the controlling product contract.
2. `docs/tapecoach/s10-target-architecture.md` defines the target S10 architecture.
3. Roadmap / delivery docs define sequencing only.
4. This `AGENTS.md` defines implementation operating rules for agents.

If there is a conflict, `README.md` wins.

Before any change to runtime topology, where analysis executes, deployment, or
queue/Worker wiring, read `docs/architecture/` first (ADRs + runbooks) and follow
its invariants — e.g. the dedicated Cloudflare analysis Worker (`analysis-worker/`),
the one-consumer rule for `tapecoach-analysis-jobs`, and the TanStack-free Worker
constraint. Topology changes that contradict an ADR require a new ADR.

---

## Core doctrine

The AI is the report brain.

The code should:

- load inputs;
- ask the AI the right module-level questions;
- validate structure;
- detect missing/thin/generic output;
- re-prompt for repair;
- route outputs to the UI;
- apply narrow high-risk red-line filtering;
- emit diagnostics.

The code must not replace missing AI judgement with generic filler.

---

## Simplest mental model

TapeCoach’s simplest flow is:

1. User input:
   - optional brief;
   - selected skill / performer level;
   - self-tape video;
   - optional audition type / discipline;
   - optional role, character, production, song, side, copy or material context;
   - up to three active audition take slots;
   - optional take replacement;
   - optional comparison selection across active takes.
2. Automated media layer:
   - Mux prepares the media;
   - system records media readiness and assessability.
3. Input intelligence layer:
   - determine scoring mode;
   - preserve and parse brief where present;
   - resolve selected performer level;
   - resolve role/material context where supplied.
4. AI intelligence layer:
   - two-step AI analysis observes the tape and produces professional judgement;
   - AI is prompted module-by-module;
   - AI applies the selected performer-level standard;
   - AI applies role/material context where supported;
   - AI explains score meaning and recommendation;
   - AI applies level-relative 0–100 score calibration where scores are visible;
   - AI repair prompts run if a module is missing, thin, generic or contradictory.
5. Report/UI layer:
   - code pipes AI outputs into the report model and UI;
   - code formats and renders;
   - code applies only narrow high-risk red-line filtering;
   - code does not invent professional critique.
6. Operator loop:
   - any uncertain assumption is confirmed with the operator or marked uncertain;
   - operator confirmations become tests or fixtures.

Final implementation formula:

```text
Selected level determines the standard.
Brief determines the task.
Observed tape provides the evidence.
Role/material research adds secondary specificity where supported.
Audition take slots determine which active takes are analysed or compared.
Score expresses readiness against the available evidence.
Professional scoring applies stricter evidence thresholds across the full 0–100 scale; scores in the 90s should be rare.
The UI must make the source basis visible.
```

---

## Product goal

Every authenticated performer-facing report must help the performer understand:

- whether to submit, retake or review carefully;
- why;
- what scoring basis was used;
- what selected level they were judged against;
- what the supplied brief asked for, if supplied;
- what TapeCoach observed;
- what was achieved;
- what was missed or incomplete;
- what role/material context was used, if any;
- what must be fixed first;
- what else should improve;
- what is optional polish;
- what should be preserved;
- what should not be over-fixed;
- what to do next;
- what could not be assessed;
- what the score means, where visible;
- what the score means at the selected level, including Professional score suppressors/raisers where applicable;
- which active take versions were analysed or compared, where applicable.

A safe but unhelpful report fails.

---

## Full-value authenticated report mode

Authenticated performer-facing reports should use all useful available information, including:

- supplied brief text;
- selected performer level;
- scoring basis;
- role/project/material context;
- audition instructions;
- deadline, upload, file naming and format requirements;
- AI observations;
- performance critique;
- acting, vocal, singing, movement and MT package notes;
- technique-library commentary;
- role/material calibration where source basis supports it;
- scores and comparison values in authenticated/operator/test mode;
- level-relative 0–100 score calibration where scores are visible;
- take slot/version context and comparison context where applicable;
- timestamped or time-banded notes where available;
- professional judgement;
- operator-confirmed assumptions.

Do not suppress content merely because it is detailed, brief-derived, level-specific, role-specific, technique-related, score-related, comparison-related, positive, critical or professionally specific.

---

## Narrow high-risk red lines only

Suppress or rewrite only:

- system secrets;
- environment values;
- signed/private system URLs;
- raw prompts;
- raw model responses;
- internal QA artefact internals;
- evidence IDs / truth IDs / raw run IDs in performer prose;
- protected-characteristic inference;
- body/appearance judgement;
- medical or vocal-health diagnosis;
- guaranteed casting, callback, booking, job or employment outcomes;
- unsupported certainty.

Everything else should be available to the authenticated report if useful.

Rewrite before suppressing where safe.

Examples:

| Unsafe / overstrong                 | Preferred rewrite                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| “This guarantees a callback.”       | “This supports submission readiness from the available evidence.”                                                    |
| “This proves professional mastery.” | “This reads strongly against the selected level in the observed areas.”                                              |
| “You are right for this role.”      | “The observed tape supports the role/material demands that were assessable from the supplied task.”                  |
| “You are not bookable for this.”    | “Casting outcome cannot be predicted; the report can only assess the submitted tape against the available evidence.” |

---

## Supplied brief transparency

The supplied brief is first-class report input.

Do not lock down or hide the brief by default.

The report should show enough of the supplied brief for the performer to understand:

- required material;
- required components;
- role/project/material context;
- page / scene / line references;
- song / dance / movement requirements;
- ident/slate requirements;
- technical framing/orientation;
- file naming;
- upload instructions;
- deadline;
- one-file / continuous-video instructions;
- logistical constraints relevant to submission readiness.

---

## Brief / no-brief score semantics

Before scoring, determine whether the run is:

- `brief_supplied`;
- `partial_brief_supplied`;
- `no_brief_baseline`;
- `brief_uncertain`.

Do not use the same score language for all four modes.

With a supplied brief, the score may include:

- brief achievement;
- mandatory requirement completion;
- preferred/optional requirements;
- admin/process readiness;
- role/material specificity where supported;
- selected-level calibration;
- observed performance;
- technical assessability.

Without a supplied brief, the score may assess only:

- observable performance;
- selected-level readiness;
- inferred discipline/task evidence;
- technical assessability;
- self-tape presentation.

A no-brief score must not claim:

- brief achievement;
- required material completion;
- page/side compliance;
- role-specific fit;
- upload/deadline/file compliance;
- time-limit compliance;
- one-continuous-video compliance;
- casting brief adherence.

A no-brief high score means:

```text
strong baseline evidence for the selected level
```

not:

```text
fully brief-ready
brief-complete
submission-compliant for the audition
```

If brief status is contradictory or uncertain, suppress unsupported brief-specific claims and repair before rendering.

The rendered report must show:

```text
Scoring basis: [mode]
```

No report may say “no brief supplied” and also claim brief achievement.

---

## Performer level calibration

The selected performer level must be passed into the AI judgement context and used as an assessment standard.

Do not treat selected level as:

- tone;
- encouragement;
- harshness;
- UI-only metadata;
- score decoration.

Treat selected level as:

- part of the AI brain;
- part of the readiness standard;
- part of the score standard where scores are visible;
- part of the recommendation logic;
- part of the fix hierarchy;
- part of the report explanation.

Supported levels:

```ts
type PerformerLevel =
  | "learning_school"
  | "amateur_community"
  | "emerging_training"
  | "professional";
```

Every report must show:

```text
Judged against: [selected performer level]
```

A report fails if:

- selected level is captured but not used;
- Professional level only makes the wording harsher;
- lower-level excellence is described as Professional-standard without evidence;
- the same tape with a different selected level produces copied judgement with only wording changes;
- a mandatory brief blocker is hidden by level-based praise;
- an assessability blocker is mislabelled as performance weakness.

Professional level requires the AI to distinguish:

- competent vs competitive;
- ready vs standout;
- technically secure vs artistically compelling;
- visible execution vs specialist precision;
- submit-ready vs job-facing evidence under casting conditions.

---

## Role / Character Research and Known-Material Calibration

When a brief, uploaded material or user input identifies a production, role, character, scene, song, copy, routine or known material, the AI should run a role/material resolver before final judgement.

The resolver must separate:

- supplied brief requirements;
- uploaded material;
- user-supplied context;
- researched known-material context;
- observed tape evidence;
- selected-level standard.

Supplied brief always wins.

Known-material research may:

- clarify role/material demands;
- support task-specific feedback;
- nuance score reasoning;
- help explain Professional score meaning across the full 0–100 scale;
- inform what to preserve or refine.

Known-material research must not:

- override the brief;
- invent mandatory requirements;
- predict casting outcomes;
- infer appearance, body/type, marketability, bookability or callback likelihood;
- create “right/wrong for role” language;
- score claims that are not visible or audible in the tape.

Every role/material claim must have a truth state.

Allowed truth states include:

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

If role/material confidence is low, mark it uncertain or suppress the claim.

If the UI shows role/material context, there must be:

- an AI question;
- structured output;
- completeness rule;
- repair prompt;
- route/PDF rendering.

The rendered report should show:

```text
Role / material context: [...]
Source basis: [...]
Primary standard: supplied brief, where available
Secondary context: known role/material baseline, where used
```

---

## Professional 0–100 level-relative score calibration

Professional level does not activate a separate high-score-only scoring subsystem.

Professional level means the evidence thresholds are higher across the full 0–100 scale. A score in the 90s should be difficult to achieve and should appear only when the tape shows exceptional Professional evidence across the relevant brief, performance, technical, role/material and selected-level criteria.

When selected level is Professional and score language is visible, the AI must explain:

- the Professional standard applied;
- what evidence supports the actual score;
- what meets Professional standard;
- what falls short of Professional standard;
- what holds the score down;
- what would raise the score;
- what should be preserved;
- whether retaking is strategically useful or risky.

The report must not:

- treat Professional scoring as harsher wording only;
- describe lower-level excellence as Professional-standard without evidence;
- bundle Professional reports in the 90s into a special high-score-only system;
- imply guaranteed casting, callback, booking or employment outcome;
- overclaim tiny score differences between Professional takes.

The rendered report should show:

```text
Professional score calibration
Standard applied: [...]
Score meaning: [...]
What supports this score: [...]
What holds the score down: [...]
What would raise the score: [...]
Retake strategy: [...]
Preserve: [...]
```

## AI module question map

Before implementing or changing report output, identify which AI module questions are needed.

The AI should be explicitly asked to populate:

- scoring basis;
- performer level calibration;
- brief intelligence;
- role/material context;
- observed tape content;
- component detection;
- brief achievement;
- readiness recommendation;
- why this recommendation;
- fix hierarchy;
- strengths and preserve;
- technique-library commentary;
- timestamped commentary;
- scores / calibration where enabled;
- level-relative 0–100 score calibration where scores are visible;
- comparison where enabled;
- active take slot/version context where comparison is enabled;
- next action;
- do-not-overfix;
- not-assessable limitations.

If a UI report section exists, there must be an AI question designed to populate it.

---

## One AI question per UI module

Every visible report section must have a corresponding AI prompt question.

If a developer adds or changes a UI report module, they must also define:

- the AI question that populates it;
- the expected structured output;
- the completeness rules;
- the repair prompt;
- how the output is routed to the UI.

Do not add report UI sections that are primarily populated by code filler.

---

## AI responsibilities

The AI should provide:

- scoring-mode classification;
- observation;
- interpretation;
- professional judgement;
- selected-level calibration;
- role/material calibration where supported;
- technique commentary;
- prioritisation;
- strengths;
- optional polish;
- level-relative 0–100 score calibration where scores are visible;
- comparison judgement across active take versions;
- take slot/version awareness;
- timestamped notes;
- next-take actions.

---

## Code responsibilities

The code should provide:

- deterministic input loading;
- schema validation;
- section routing;
- deduplication;
- contradiction detection;
- thin/generic module detection;
- AI repair prompting;
- red-line filtering;
- rendering;
- take lifecycle state management;
- per-take and per-comparison admin status;
- QA artefacts.

The code must not invent professional feedback such as strengths, technique notes, optional polish, level reasoning, role/material judgement, score explanation or readiness rationale.

---

## Report model to UI piping

The UI should render the structured AI-populated report model.

The UI may:

- order sections;
- format text;
- group related items;
- show score/comparison chips;
- show scoring basis;
- show judged-against level;
- show role/material source basis;
- show Professional 0–100 score calibration;
- show take slot and compared take version context where applicable;
- show timestamped notes;
- highlight fix-first and must-fix items.

The UI must not:

- invent professional judgement;
- invent strengths;
- invent technique notes;
- invent optional polish;
- invent level reasoning;
- invent role/material demands;
- invent brief requirements;
- replace missing AI content with generic performer-facing copy;
- hide useful AI output unless it crosses a high-risk red line.

If AI output exists but does not appear in the UI, that is a routing bug.

---

## AI module completeness and repair

Every report module should be populated by AI output or deterministic input.

Before rendering, run a module completeness check.

For each module, classify:

- complete;
- missing;
- thin;
- generic;
- contradictory;
- unsupported;
- not assessable.

If a module is missing, thin, generic or contradictory, do not fill it with static fallback copy.

Instead:

1. ask the AI a targeted repair question;
2. validate the repaired output;
3. only if repair fails, explain the limitation specifically in the report.

Examples:

- If strengths are generic, ask the AI for specific strengths from the tape.
- If technique commentary is missing despite visible evidence, ask the AI for technique commentary.
- If next action is empty, ask the AI for a submit checklist or retake plan.
- If comparison is present but no reasoning exists, ask the AI to compare the active takes.
- If comparison does not identify compared take versions, repair the comparison context before rendering.
- If timestamps are unavailable, ask for component-level commentary instead.
- If scoring basis is missing, ask the AI to classify scoring mode.
- If selected-level reasoning is missing, ask the AI to state the level standard applied.
- If role/material context is used without source basis, ask for truth-state/source repair.
- If Professional score explanation is missing, ask for Professional 0–100 level-relative score calibration.

Generic fallback copy must not be the primary content of any report module.

---

## No AI, no report brain

If AI analysis fails, the system may produce a limited report only if it clearly explains what failed and what can still be assessed.

The system must not pretend that deterministic fallback copy is professional analysis.

If the AI cannot produce a module after repair prompting, the report should say:

- what could not be assessed;
- what evidence is missing;
- what the performer can do next.

It should not produce a thin shell.

---

## Score terminology alignment

Visible scores must align with report terminology.

A score is not just a number. It must map to:

- scoring basis;
- selected performer level;
- readiness language;
- submission guidance;
- confidence / reliability;
- fix hierarchy;
- comparison wording;
- performer-facing next action.

Do not show a score that contradicts the report language.

Examples of unacceptable contradictions:

- score suggests strong readiness but verdict says retake required without explaining the brief blocker;
- score suggests low readiness but verdict says submit without explanation;
- comparison chip shows a large difference but the report gives no comparison reasoning;
- report says “brief achieved” but score language implies a mandatory blocker;
- report says “no mandatory blocker” but score terminology says “not ready”;
- report says “no brief supplied” but score terminology says “brief-complete”.

Brief blockers can override performance score.

Example: a vocally strong tape can still be “retake required” if the brief-required acting side is missing.

Score language should distinguish:

- scoring basis;
- performance quality;
- brief completion;
- selected-level calibration;
- role/material specificity where supplied;
- technical assessability;
- submission readiness.

The AI must be asked to explain the score in these terms, not simply output a number.

---

## Provisional readiness terminology

Use the README’s score map and calibration documents as controlling references.

Default score-band language must be mode-aware.

With a supplied brief:

| Score band | Typical report meaning                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–39       | Not submission-ready / not assessable because serious missing evidence, technical blocker or incomplete required package prevents reliable judgement.                     |
| 40–54      | Retake required if possible because a major brief, performance or presentation issue blocks submission readiness.                                                         |
| 55–69      | Review carefully because some usable material exists, but there is meaningful brief, performance, technical or uncertainty risk.                                          |
| 70–84      | Submit if deadline is close because the tape is submission-supporting, with manageable caveats or optional polish.                                                        |
| 85–100     | Strong submission / submit because the tape is brief-complete or mostly brief-complete, assessable, strong for selected level and not blocked by a mandatory brief issue. |

Without a supplied brief:

| Score band | Typical report meaning                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0–39       | Not reliably assessable or not ready on observable performance/setup evidence.                                                   |
| 40–54      | Retake recommended because a major observable performance, task-readability or technical issue limits usefulness.                |
| 55–69      | Review carefully because the tape has usable elements but meaningful observable risk, uncertainty or selected-level gap remains. |
| 70–84      | Baseline submission-supporting for the selected level, assuming the unseen brief does not add requirements this tape fails.      |
| 85–100     | Strong baseline tape for the selected level, based on observable performance and setup only. Brief achievement is not assessed.  |

The verdict is not determined by score alone. Required brief failures, missing material, non-assessability or critical technical issues can override the numerical band.

---

## Score and comparison display modes

Numeric score and comparison chips may remain visible in authenticated/operator/test mode. Comparison chips apply to active take versions unless an admin/operator explicitly requests a historical comparison.

If visible, they must be treated as diagnostic or authenticated report information, not production/customer release approval.

The system must distinguish:

- score chip visibility;
- score reasoning in the report;
- public scoring product approval;
- comparison chip visibility;
- comparison recommendation approval.

Visible score/comparison chips do not by themselves mean public scoring or comparison recommendation is production-approved.

---

## Audition take slots, replacement and admin QA

Each audition supports up to three active take slots:

```text
Take 1
Take 2
Take 3
```

Do not implement arbitrary active take counts unless `README.md` is updated.

Each take slot may be replaced by a newly uploaded self-tape.

Replacing a take must create a new take version and a new analysis/report run. Do not silently overwrite the previous take report or QA proof.

Ordinary comparison uses the active version of each available take slot.

If a take is replaced, any comparison that used the previous active version is stale and must be regenerated or clearly marked stale.

Each take version must produce:

- media processing status;
- analysis run status;
- individual report status;
- QA artefact status where QA is enabled;
- admin-visible diagnostics.

Each comparison run must produce:

- comparison report status;
- compared take version IDs;
- same-video / duplicate status;
- comparison QA artefact status where QA is enabled;
- admin-visible diagnostics.

Admin must be able to inspect:

```text
Audition
  Take 1 active/replaced versions
  Take 2 active/replaced versions
  Take 3 active/replaced versions
  Individual take reports
  Individual take QA artefacts
  Comparison reports
  Comparison QA artefacts
```

A slice fails if:

- more than three active takes can exist for one audition;
- replacing a take destroys or hides prior QA proof without policy;
- comparison mixes active and replaced versions unintentionally;
- comparison does not identify which take versions were compared;
- a take report renders but admin cannot see report/QA status;
- comparison renders but admin cannot see comparison/QA status.

## Same video and duplicate upload handling

The system must explicitly handle same-video uploads.

A same-video upload means the submitted media appears to be the same underlying self-tape as a previous take, based on available signals such as:

- file identity;
- file size;
- duration;
- Mux asset/upload identity;
- media fingerprints where available;
- operator confirmation;
- matching brief / audition context.

Same-video handling matters because the system must not treat an accidental duplicate as a genuinely new performance take.

### Same-video scenarios

1. Accidental duplicate upload:
   - identify as duplicate where evidence is sufficient;
   - do not imply it is a new artistic/performance attempt;
   - do not create misleading comparison guidance.
2. Intentional retest / canary rerun:
   - allowed;
   - must be marked as same_video_confirmed or operator-confirmed;
   - useful for testing new report logic on the same media.
3. Same video with changed brief:
   - analysis may need rerun because the task changed;
   - report must say the video is the same media but judged against a different brief.
4. Same video with changed skill level:
   - analysis may need rerun because calibration changed;
   - report must not imply the performance changed.
5. Same video with changed role/material context:
   - analysis may need rerun because task specificity changed;
   - report must not imply the performance changed.
6. Same video with new AI/report version:
   - analysis may be rerun for regression testing;
   - report artefacts should record the analysis/report version where available.
7. Replacement with same media:
   - same-video / duplicate handling applies;
   - the new take version may be valid for retest/regression, but comparison must not create a false winner.
8. Comparison mode:
   - if two compared takes are actually the same video, the system must say so or ask the operator;
   - do not recommend one duplicate over another as if they were different performances.

### Operator confirmation for same video

If same-video status affects acceptance, comparison or canary interpretation, confirm with the operator.

Operator-confirmed fields may include:

- same_video_confirmed;
- same_brief_confirmed;
- same_test_fixture_confirmed;
- same_level_confirmed;
- same_role_context_confirmed;
- intentional_duplicate_upload;
- accidental_duplicate_upload;
- retest_same_media;
- changed_brief_same_media;
- changed_level_same_media;
- changed_role_context_same_media.

If the system is uncertain, it must not guess. It should mark same-video status as uncertain and ask for operator confirmation.

---

## Thin-shell anti-regression rule

A report fails if, despite available brief and media evidence, it collapses to generic copy such as:

- “No single public-safe priority fix was available”;
- “Preserve the clearest choices already captured”;
- “This affects readability, not talent” as the only strength;
- generic do-not-over-fix copy without context;
- a recommendation without concrete reasons;
- brief achievement without itemised evidence;
- selected-level judgement without level-specific reasoning;
- no-brief report with brief-complete language;
- role/material context without source basis;
- Professional score without level-relative score explanation;
- an empty next-take plan;
- “report polish unavailable” as a reason to withhold useful guidance.

Thin-shell reports are unacceptable.

---

## Timestamped commentary

Where available, the AI should attempt timestamped or time-banded commentary.

Timestamped commentary should identify:

- component starts / endings;
- strong moments to preserve;
- missing or incomplete material;
- cut-offs;
- technical/framing/audio issues;
- performance moments to refine.

If timestamps are unavailable, the report must still provide useful component-level commentary.

---

## Technique-library commentary

Technique-library commentary should be attempted by default where evidence exists.

Attempt commentary for:

- acting;
- vocal / singing;
- movement / dance;
- musical-theatre package integration;
- commercial / screen task;
- self-tape presentation.

Do not avoid technique commentary merely because named public technique authority was previously over-restricted.

Avoid only high-risk claims:

- medical diagnosis;
- body/appearance judgement;
- protected-characteristic inference;
- guaranteed casting/job outcome;
- unsupported certainty.

Selected level and role/material context may inform technique commentary where source basis and observed evidence support it.

---

## Golden fixtures

Every report-value change must preserve or improve these fixtures.

### Fixture A — incomplete mandatory package

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
- no generic fallback copy.

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
- Professional 0–100 level-relative score calibration where score language is visible;
- submit checklist;
- specific do-not-overfix guidance;
- no thin shell.

### Fixture C — old-report usefulness baseline

The 22 May report is a minimum usefulness floor, not an exact template.

New reports must preserve or exceed its practical specificity while applying only narrow high-risk filtering.

### Fixture D — same tape, different selected level

Expected:

- observed evidence remains the same;
- selected-level standard changes;
- recommendation may change;
- score language is level-relative;
- UI states `Judged against: [selected level]`;
- Professional run is stricter and identifies Professional-level gaps;
- lower-level runs do not imply Professional readiness unless independently supported.

### Fixture E — no brief supplied

Expected:

- useful performance/setup feedback;
- no invented brief requirements;
- brief adherence marked not assessable;
- scoring basis shown as no-brief baseline;
- score language says baseline only.

### Fixture F — brief supplied, missing mandatory component

Expected:

- scoring basis: brief supplied;
- missing required material is a brief blocker;
- strong present component may be acknowledged;
- recommendation is driven by missing required material;
- score language explains blocker override.

### Fixture G — known role with clear brief

Expected:

- role/material context appears;
- supplied brief is primary;
- known role/material baseline is secondary;
- report references role-specific demands only as task/material context;
- no appearance/type/castability language;
- score nuance reflects role-specific competitive clarity.

### Fixture H — ambiguous role/material

Expected:

- role is not assumed unless confidently resolved;
- uncertainty is visible;
- no hidden mandatory requirements are invented.

### Fixture I — Professional score calibration across 0–100

Expected:

- reports explain score meaning across low, mid, high and rare top-band Professional scores;
- reports do not use generic excellence language;
- retake strategy is explicit;
- score suppressors, score raisers and preserve guidance are visible.

### Fixture J — tiny high-score comparison

Expected:

- report does not overclaim a 1-point difference;
- if the advantage is marginal, say so;
- if no meaningful difference is visible, mark as too close to call.

### Fixture K — same-video duplicate/retest

Expected:

- system marks duplicate, retest or uncertain;
- operator confirmation requested where needed;
- comparison does not recommend one duplicate over another as different performances.

### Fixture L — three active takes

Expected:

- one audition has Take 1, Take 2 and Take 3 active;
- all three active takes have individual reports;
- all three active takes have QA artefact status in admin where QA is enabled;
- comparison identifies the active take versions compared;
- no fourth active take is possible.

### Fixture M — replace Take 2

Expected:

- Take 2 v1 becomes replaced or archived;
- Take 2 v2 becomes active;
- Take 2 v2 receives a new analysis run and individual report;
- previous comparison is marked stale or regenerated;
- new comparison uses active versions only;
- admin can inspect Take 2 v1 and Take 2 v2 subject to retention policy.

### Fixture N — replace with same video

Expected:

- same-video / duplicate handling activates;
- replacement is marked duplicate, probable duplicate or intentional retest;
- comparison does not create a false winner;
- admin shows duplicate/same-video status and QA artefact status.

### Fixture O — one or two active takes

Expected:

- one active take produces an individual report only;
- two active takes produce comparison between the two active versions only;
- empty slots are empty, not failed.

---

## Route/PDF first acceptance

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
- selected level;
- why;
- top fix;
- brief achievement where applicable;
- role/material source basis where applicable;
- active take/comparison version context where applicable;
- next action.

---

## QA artefacts

QA artefacts are proof, not the product.

If QA artefacts fail to emit:

- report rendering may still proceed;
- release proof is blocked;
- diagnostics must explain the artefact failure.

Do not let QA artefact work starve report value.

Preferred artefacts include:

- input context;
- take lifecycle context;
- observation pass;
- judgement pass;
- scoring context;
- level calibration;
- role/material calibration where applicable;
- level-relative score calibration where scores are visible;
- per-take report/QA status where applicable;
- comparison run status where applicable;
- report model;
- rendered text;
- red-line trace;
- operator assumptions.

---

## Operator-tested assumptions

Any assumption that affects canary acceptance must be confirmed by the operator.

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
- active take slot/version;
- replacement reason;
- stale comparison handling;
- AI missed a component;
- AI misclassified material.

If an assumption is uncertain, ask for operator confirmation or mark it as uncertain.

Operator feedback should become a fixture, regression test or prompt improvement.

---

## Minimal env/config principle

Do not add environment variables for ordinary product behaviour. The maximum of three active take slots is a product invariant, not an environment variable.

Use env vars only for secrets and deployment/runtime basics.

Product toggles should live in database/admin config where possible.

Ordinary product behaviour that should not become env-var sprawl includes:

- selected-level calibration;
- scoring mode semantics;
- role/material research enablement, unless temporarily gated as implementation rollout config;
- score chips visibility;
- comparison chips visibility;
- technique-library mode;
- report rendering mode.

---

## Report-value first sequence

When rebuilding S10, work in this order, allowing in-flight work to be amended rather than restarted:

1. Define AI questions for each report module.
2. Add performer-level calibration questions and schema.
3. Add scoring basis / brief-no-brief semantics.
4. Add audition take slot lifecycle and replacement handling.
5. Add role/material resolver where supplied.
6. Validate AI output quality.
7. Pipe AI output to the report UI.
8. Add level-relative 0–100 score calibration.
9. Test route/PDF usefulness.
10. Add QA artefacts and release proof.

Do not start with payload gates, source-kind restrictions or QA artefact architecture before the report is useful.

---

## Definition of done

A slice is not done unless:

- source/tests/build pass;
- route/PDF report surface is useful;
- relevant fixtures are preserved or improved;
- supplied brief content is not suppressed by default;
- selected level is visible and used;
- scoring basis is visible and consistent;
- no-brief reports do not claim brief achievement;
- role/material context has source basis and does not invent requirements;
- active take slots and compared take versions are clear where comparison applies;
- admin can inspect per-take and per-comparison report/QA status where QA is enabled;
- AI outputs are routed to the UI;
- no generic thin-shell copy is introduced;
- Professional reports include level-relative score calibration where applicable;
- high-risk red-line content is suppressed or rewritten;
- assumptions are confirmed with operator where needed;
- QA artefact status is clear;
- production/customer/Level 2 approval is not claimed unless explicitly in scope.

---

## Forbidden failure modes

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
- treat selected level as tone or encouragement;
- let Professional merely mean harsher language;
- describe lower-level excellence as Professional-standard without evidence;
- let a no-brief score imply brief achievement;
- use role/material research to invent mandatory requirements;
- infer appearance, body/type, marketability, bookability or callback likelihood;
- treat a high score as a substitute for professional feedback;
- treat Professional scores in the 90s as a separate generic “excellent” bucket;
- compare duplicate/same-video takes as though they are different performances;
- allow more than three active takes for one audition;
- silently overwrite replaced take reports or QA proof;
- compare active and replaced take versions unintentionally;
- render comparison without compared take version IDs;
- let a take or comparison report render without admin-visible QA/report status where QA is enabled;
- let a strong complete take produce an empty or thin report.

---

## Final rule

If the performer would not find the report useful within 60 seconds, the slice fails.

The report should make these visible:

```text
Scoring basis: [...]
Judged against: [...]
Recommendation: [...]
Why: [...]
Fix first: [...]
Preserve: [...]
Next action: [...]
Limitations: [...]
```

Where applicable, it should also make these visible:

```text
Brief achievement: [...]
Role / material context: [...]
Professional score calibration: [...]
Comparison reasoning: [...]
Active take versions compared: [...]
```
