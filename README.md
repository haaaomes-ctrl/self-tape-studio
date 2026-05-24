# TapeCoach Requirements — AI-Led Full-Value Self-Tape Report System

**Document status:** controlling README for the S10 reset and rebuilt TapeCoach evaluation/report system.  
**Purpose:** define the product behaviour, report requirements, AI analysis contract, scoring semantics, comparison handling, QA proof expectations, public/private boundaries and release decisions that implementation agents must follow.  
**Supersedes:** earlier README/report design notes where they conflict with this document.  
**Language:** UK English.  
**Architecture reset:** S10 reset after rollback to S9-19 and report-value regressions.  
**Core correction:** TapeCoach is an AI-led professional critique system. The AI is the report brain. Code asks the right questions, validates, repairs, routes and renders the AI output.

---

## Source hierarchy and delivery documents

`README.md` is the controlling source for TapeCoach product behaviour, report requirements, scoring rules, AI analysis expectations, QA artefacts, validator gates, public/private boundaries and release decisions.

`AGENTS.md` operationalises this README for implementation agents. It does not override this README.

`docs/tapecoach/s10-target-architecture.md` describes the target architecture. It does not override this README.

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
- Canonical run identity is `take-[raw_core]`; `take-take-*` is invalid.
- Clean generated artefact churn before commit.

---

## 0. Executive summary

TapeCoach is an AI-led professional self-tape critique and audition-readiness system.

It reads the supplied brief where present, analyses the self-tape, identifies the discipline and required components, applies a professional judgement layer, and produces a full-value authenticated report for the performer.

The central product questions are:

> Is this tape ready to submit for this performer’s selected level, audition type and supplied brief / task?  
> Has the performer achieved the brief?  
> What does the tape communicate at the selected level?  
> What must be fixed first, what else should improve, what should be preserved, and what should not be over-fixed?  
> If there are multiple takes, which take or combination of choices best serves the submission, and why?

Every authenticated performer-facing report must help the performer understand:

1. whether to submit, retake or review carefully;
2. why that recommendation was reached;
3. what the supplied brief asked for;
4. what TapeCoach observed in the tape;
5. what was achieved, missed, incomplete, not assessable or not applicable;
6. the fix-first item, if a fix is needed;
7. all useful priority fixes, ranked by importance, without arbitrary item caps;
8. must-fix items before submission;
9. should-improve items if retaking;
10. optional polish, where useful;
11. what is already working and should be preserved;
12. relevant technique-library commentary;
13. timestamped or time-banded commentary where available;
14. what to do next;
15. what not to over-fix;
16. what could not be assessed reliably;
17. how score and comparison language should be interpreted, where scores or comparisons are visible.

The judgement should combine practical agent, casting-aware reviewer, acting coach, vocal/singing coach, movement/dance coach, musical-theatre package coach, commercial/screen-task coach, self-tape technician and audition-coach perspectives.

TapeCoach must not become a basic video/audio checker, a compliance wrapper, a JSON projection, or a thin safety shell.

---

## 1. Core doctrine

### 1.1 The AI is the report brain

TapeCoach’s performer-facing report must be primarily populated from AI analysis and AI professional judgement.

The AI should provide:

- observation;
- interpretation;
- component detection;
- brief achievement judgement;
- readiness recommendation;
- performance critique;
- technique commentary;
- prioritisation;
- strengths;
- optional polish;
- comparison judgement;
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
- role/project/material context;
- audition instructions;
- deadline, upload, file naming and format requirements;
- AI observations;
- performance critique;
- acting, vocal, singing, movement and musical-theatre package notes;
- technique-library commentary;
- scores and comparison values in authenticated/operator/test mode;
- timestamped or time-banded notes where available;
- professional judgement;
- operator-confirmed assumptions.

Do not suppress content merely because it is detailed, brief-derived, technique-related, score-related, comparison-related, positive, critical or professionally specific.

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

The authenticated report may show supplied brief content, scores, comparison values, technique commentary and detailed professional critique subject only to the high-risk red lines above.

A future public share/export mode may apply a stricter redacted policy, but that future mode must not be used to starve the authenticated report.

---

## 2. Primary system flow

The simplest TapeCoach flow is:

1. **User input**
   - optional brief;
   - selected skill / performer level;
   - self-tape video;
   - optional audition type / discipline / comparison selection.

2. **Automated media layer**
   - upload;
   - Mux processing;
   - media readiness;
   - duration / audio / video / framing / continuity signals where available.

3. **AI intelligence layer**
   - two-step AI analysis observes the tape and produces professional judgement;
   - AI is prompted module by module;
   - AI repair prompts run if a report module is missing, thin, generic or contradictory;
   - technique-library and timestamp commentary are attempted by default where evidence allows.

4. **Report/UI layer**
   - code pipes AI outputs into the report model and UI;
   - code formats and renders;
   - code applies only narrow high-risk red-line filtering;
   - code does not invent professional critique.

5. **Operator/QA layer**
   - uncertain assumptions are confirmed with the operator where needed;
   - QA artefacts prove what happened;
   - QA failure blocks release proof, not report generation.

---

## 3. Input model and submission context

### 3.1 Required inputs

TapeCoach must support:

- video/audio self-tape media;
- selected performer level;
- optional supplied brief;
- optional audition type;
- optional discipline;
- optional comparison takes.

### 3.2 Supplied brief transparency

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

### 3.3 No-brief behaviour

If no brief is supplied, TapeCoach must still provide useful performance and self-tape feedback.

It must not invent brief requirements.

It should say clearly:

- brief adherence cannot be assessed;
- no supplied-brief material requirements were available;
- performance, presentation and technical feedback are still available where assessable.

### 3.4 Same video and duplicate uploads

TapeCoach must explicitly handle same-video uploads.

A same-video upload may be:

- an accidental duplicate;
- an intentional retest / canary rerun;
- the same media judged against a changed brief;
- the same media judged at a changed skill level;
- the same media rerun after a new AI/report version;
- a comparison scenario where two takes are actually identical.

The system must not treat an accidental duplicate as a genuinely new performance attempt.

If same-video status affects comparison, canary acceptance or report interpretation, it must be confirmed by the operator or marked uncertain.

### 3.5 Same-video statuses

Use the following status language:

| Status                     | Meaning                                                   | Expected behaviour                                                         |
| -------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `new_media`                | The media appears to be a different self-tape.            | Analyse as a new take.                                                     |
| `same_video_confirmed`     | Operator or strong signals confirm same underlying video. | Do not imply performance changed; allow retest/regression review.          |
| `probable_duplicate`       | Signals strongly suggest duplicate, but not confirmed.    | Ask operator or mark uncertain.                                            |
| `intentional_retest`       | Same video intentionally rerun to test report logic.      | Allow, but mark as retest.                                                 |
| `same_video_changed_brief` | Same video judged against a different brief.              | Reanalyse brief achievement; do not imply new performance.                 |
| `same_video_changed_level` | Same video judged at a different level.                   | Recalibrate level-relative commentary.                                     |
| `duplicate_in_comparison`  | Compared takes are the same media.                        | Do not recommend one as a different performance; explain duplicate status. |

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

### 5.1 Two-step AI analysis

TapeCoach should use two AI passes where possible.

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
- brief achievement judgement;
- fix hierarchy;
- strengths and preserve;
- technique-library commentary;
- score reasoning;
- comparison judgement where relevant;
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

Only after repair fails should the report explain a limitation.

---

## 6. AI module question map

Every visible report section must have an AI question designed to populate it.

The AI must be explicitly asked to populate:

- brief intelligence;
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
- comparison where enabled;
- next action;
- do-not-overfix;
- not-assessable limitations.

### 6.1 Brief intelligence prompt

Ask the AI to:

- read the supplied brief;
- extract every requirement relevant to submission readiness;
- quote or summarise useful brief wording;
- classify each requirement as material, performance, technical, admin/process, deadline or logistics;
- classify importance as mandatory, preferred, optional or ambiguous;
- say what evidence should appear in the tape;
- say how achievement should be judged.

### 6.2 Observed tape prompt

Ask the AI to:

- analyse the tape in sequence;
- identify ident/slate, acting scene, song, dance/movement and other components;
- identify cut-off or incomplete material;
- assess continuity / one-file package where possible;
- assess audio, video and framing;
- provide timestamps or time bands where possible;
- state uncertainties clearly.

### 6.3 Brief achievement prompt

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

### 6.4 Recommendation prompt

Ask the AI to give one of:

- `submit`;
- `submit_if_deadline_is_close`;
- `review_carefully`;
- `retake_required_if_possible`.

It must explain why in terms of:

- supplied brief;
- observed tape;
- selected performer level;
- audition type / discipline where known;
- technical assessability;
- comparison context where relevant.

### 6.5 Fix hierarchy prompt

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
- category: brief, performance, technical, admin or polish.

### 6.6 Strengths and preserve prompt

Ask the AI to identify what is already working and should be preserved.

Return:

- performance strengths;
- brief/package strengths;
- technical strengths;
- specific choices or moments to keep.

Do not accept generic praise as the only strength.

### 6.7 Technique-library prompt

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

### 6.8 Timestamped commentary prompt

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

### 6.9 Score calibration prompt

Ask the AI to explain the score in relation to:

- selected performer level;
- brief completion;
- performance quality;
- technical assessability;
- submission readiness;
- comparison context.

A score must not be just a number. It must have language.

### 6.10 Comparison prompt

When multiple takes exist, ask the AI to compare:

- which take better meets the brief;
- performance differences;
- technical differences;
- strongest choices in each;
- what should be preserved;
- whether the comparison is valid or affected by same-video status.

### 6.11 Next action prompt

Ask the AI to produce:

- a finite retake plan if retaking;
- a submit checklist if submitting;
- a review checklist if reviewing carefully.

Do not encourage endless retakes.

### 6.12 Do-not-overfix prompt

Ask the AI to identify what not to change.

Examples:

- do not chase audio changes if audio is already assessable;
- do not rework achieved brief components;
- do not keep retaking a strong complete package without a concrete purpose;
- do not spend time on optional polish before missing mandatory material.

### 6.13 Limitations prompt

Ask the AI to list what could not be assessed and why.

No internal codes should appear in performer prose.

---

## 7. Report model and required sections

### 7.1 FullReportModel

The report model should be rich enough to preserve AI judgement.

Required top-level sections:

```text
recommendation
brief
observed_tape
scores
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
2. readiness / score / comparison chips where enabled;
3. why this recommendation;
4. what the brief asked for;
5. brief achievement;
6. what TapeCoach observed;
7. fix first;
8. prioritised fixes;
9. must fix before submitting;
10. should improve if retaking;
11. optional polish;
12. strengths to preserve;
13. technique-library commentary;
14. timestamped / time-banded commentary;
15. next action;
16. do not over-fix;
17. not assessable / reliability notes;
18. operator/test diagnostic notes where applicable.

### 7.3 Thin-shell anti-regression rule

A report fails if, despite available brief and media evidence, it collapses to generic copy such as:

- “No single public-safe priority fix was available”;
- “Preserve the clearest choices already captured”;
- “This affects readability, not talent” as the only strength;
- generic do-not-over-fix copy without context;
- a recommendation without concrete reasons;
- brief achievement without itemised evidence;
- an empty next-take plan;
- “report polish unavailable” as a reason to withhold useful guidance.

Thin-shell reports are unacceptable.

### 7.4 Limited report model

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

## 8. Readiness recommendations

### 8.1 Recommendation options

TapeCoach should use these performer-facing recommendation states:

| State                         | Meaning                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit`                      | The tape appears ready to submit for the selected level and supplied task.                                                                          |
| `submit_if_deadline_is_close` | The tape supports submission; optional polish may exist but should not delay unnecessarily.                                                         |
| `review_carefully`            | The tape may be usable, but there is meaningful uncertainty or risk to check.                                                                       |
| `retake_required_if_possible` | A material issue, missing brief component, serious technical issue or performance readability problem means a retake is recommended if time allows. |

### 8.2 Recommendation rules

The recommendation must be grounded in:

- brief requirements;
- observed tape content;
- selected performer level;
- discipline / audition type where known;
- media assessability;
- comparison context where applicable.

Do not use scores alone to determine recommendation.

A required brief failure can override a high performance score.

A technically assessable, brief-complete professional take should not collapse to `review_carefully` without a specific reason.

---

## 9. Scores, score terminology and professional nuance

### 9.1 Scores are allowed in authenticated/operator/test mode

Numeric score and comparison chips may be visible in authenticated, operator and test modes.

This does not mean public/customer scoring approval, production release, or external public comparison recommendation approval.

The system must distinguish:

- score chip visibility;
- score reasoning in the report;
- public scoring product approval;
- comparison chip visibility;
- comparison recommendation approval.

### 9.2 Scores must align with terminology

Visible scores must align with report terminology.

A score is not just a number. It must map to:

- readiness language;
- submission guidance;
- confidence / reliability;
- fix hierarchy;
- comparison wording;
- performer-facing next action.

Unacceptable contradictions:

- score suggests strong readiness but verdict says retake required without explaining the brief blocker;
- score suggests low readiness but verdict says submit without explanation;
- comparison chip shows a large difference but report gives no comparison reasoning;
- report says “brief achieved” but score language implies a mandatory blocker;
- report says “no mandatory blocker” but score terminology says “not ready”.

### 9.3 Professional score nuance

At professional level, many strong performers may score in a high band. TapeCoach must still distinguish professional nuance through written judgement, sub-dimensions, brief achievement, submission readiness, comparison reasoning, technique commentary and next-action guidance.

A professional take scoring above 90 may still differ meaningfully in:

- brief precision;
- acting specificity;
- vocal or singing specificity;
- movement/dance precision;
- style or genre fit;
- camera readability;
- technical presentation;
- risk under casting conditions;
- optional polish;
- comparison against another take.

Scores must not flatten professional feedback into “high score = no useful notes”.

### 9.4 Provisional score-to-language map

Use this default map unless superseded by a calibration document.

| Score band | Terminology                           | Typical meaning                                                                          |
| ---------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0–39       | Not submission-ready / not assessable | Serious missing evidence, technical blocker or incomplete package.                       |
| 40–54      | Retake required if possible           | Major brief, performance or presentation issue blocks submission readiness.              |
| 55–69      | Review carefully                      | Some usable material, but meaningful risk, uncertainty or important improvement remains. |
| 70–84      | Submit if deadline is close           | Submission-supporting tape with optional polish or manageable caveats.                   |
| 85–100     | Strong submission / submit            | Brief-complete, assessable, strong for selected level, no mandatory blocker.             |

The verdict is not determined by score alone.

### 9.5 Score dimensions

Scores should be explained through dimensions such as:

- brief completion;
- performance readability;
- acting / vocal / movement quality as relevant;
- technical assessability;
- self-tape presentation;
- selected-level calibration;
- comparison advantage.

---

## 10. Brief achievement and requirement itemisation

### 10.1 Requirement categories

Classify requirements as:

- material;
- performance;
- technical;
- admin/process;
- deadline;
- logistics.

### 10.2 Requirement importance

Classify importance as:

- mandatory;
- preferred;
- optional;
- ambiguous.

Ambiguous requirements must remain ambiguous unless evidence or operator confirmation resolves them.

### 10.3 Achievement statuses

Use:

- achieved;
- mostly achieved;
- partly achieved;
- not achieved;
- not assessable;
- not applicable.

Not assessable is a limitation, not criticism.

### 10.4 Brief blockers

An assessable mandatory requirement that is not achieved can block submission readiness.

The report must identify:

- the requirement;
- evidence or uncertainty;
- submission impact;
- next action.

### 10.5 Positive brief completion

If required brief components are present and assessable, the report should say so and provide positive readiness guidance, strengths, optional polish and a submit checklist.

A brief-complete take must not receive an empty or thin report merely because there is no mandatory blocker.

---

## 11. Fix hierarchy and next action

### 11.1 Fix-first rule

`fix_first` is the highest-impact action before submission.

If no mandatory fix is identified, the report should say:

```text
No mandatory fix identified before submission.
```

Do not invent a fix.

### 11.2 Priority fixes

Include all meaningful priority fixes. Do not arbitrarily cap useful fixes.

Each fix should include:

- issue;
- why it matters;
- action;
- urgency / severity;
- category.

### 11.3 Must-fix, should-improve and optional polish

Separate:

- must-fix before submitting;
- should-improve if retaking;
- optional polish.

This prevents endless retake loops.

### 11.4 Next action

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

### 11.5 Do-not-overfix

Do-not-overfix guidance must be specific.

Examples:

- do not chase audio changes if audio is already assessable;
- do not rework achieved brief components;
- do not keep retaking a strong complete package without a concrete purpose;
- do not spend time on optional polish before missing mandatory material.

---

## 12. Strengths, preserve and positive feedback

### 12.1 Required strengths

Every useful report should identify what is working, unless the evidence genuinely cannot support it.

Strengths should be specific, such as:

- performance clarity;
- vocal or acting specificity;
- achieved brief package;
- assessable setup;
- strong moments;
- useful choices to preserve.

### 12.2 Generic strengths are not enough

The following must not be the only strength/preserve content:

- “Preserve the clearest choices already captured.”
- “This affects readability, not talent.”
- “Keep what works.”

If the AI returns only generic strengths, run a repair prompt.

### 12.3 Strong takes require value

A strong professional complete take must receive a useful report.

It should include:

- why it supports submission;
- what specifically works;
- what to preserve;
- optional polish, if useful;
- what not to change;
- final submit checklist.

---

## 13. Timestamped commentary

### 13.1 Requirement

Where timestamps or time-bands are available, TapeCoach should provide timestamped commentary for important observations.

Timestamped commentary should identify:

- component starts / endings;
- strong moments to preserve;
- missing or incomplete material;
- cut-offs;
- technical/framing/audio issues;
- performance moments to refine.

### 13.2 Fallback

If timestamps are unavailable, the report must still provide useful component-level commentary.

Absence of timestamps must not collapse the report into a thin shell.

### 13.3 Timestamp use

Timestamped notes may appear in:

- observed tape;
- strengths;
- priority fixes;
- technique commentary;
- next action;
- limitations.

---

## 14. Technique-library commentary

### 14.1 Default attempt

Technique-library commentary should be attempted by default where evidence exists.

Do not avoid technique commentary merely because prior versions over-restricted named technique authority.

### 14.2 Technique areas

Attempt commentary for:

- acting;
- vocal / singing;
- movement / dance;
- musical-theatre package integration;
- commercial / screen task;
- self-tape presentation.

### 14.3 Boundaries

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
- practical coaching actions.

### 14.4 Missing material

If a required component is missing, technique commentary for that component should say it could not be assessed because the component is missing.

Example:

```text
The acting side could not be assessed because the required Side 1 scene was not present in the submitted tape.
```

---

## 15. Discipline and module detection

TapeCoach should detect and activate relevant modules from the supplied brief and observed tape.

Supported discipline/module families include:

- acting;
- musical theatre;
- singing / vocal;
- dance / movement;
- commercial / screen task;
- self-tape technical presentation;
- admin/submission package requirements.

If discipline or module is uncertain, mark it as uncertain and explain why. Do not invent discipline-specific requirements.

---

## 16. Musical Theatre package requirements

Musical Theatre briefs may include:

- song;
- acting scene / side;
- dance / movement;
- ident/slate;
- one continuous video;
- technical or file instructions.

TapeCoach must judge the package, not only the individual performance elements.

For MT package reports, identify:

- whether song is present and complete;
- whether acting side is present and complete;
- whether dance/movement is required and present;
- whether the package is continuous / one file;
- whether any component is missing, incomplete or not assessable;
- how the package affects submission readiness.

---

## 17. Comparison requirements

### 17.1 Comparison modes

Comparison may occur in authenticated/operator/test mode.

The report may show score/comparison chips in these modes.

The system must distinguish comparison visibility from production/customer approval.

### 17.2 Comparison judgement

When comparison is enabled, ask the AI to compare:

- brief achievement;
- performance quality;
- technical assessability;
- strongest choices;
- risks;
- what to preserve;
- whether one take better serves submission.

Do not guarantee casting, callback, booking or employment outcomes.

### 17.3 Same-video comparison

If compared takes appear to be the same video, the report must say so or ask for operator confirmation.

Do not recommend one duplicate over another as if they were different performances.

---

## 18. High-risk red-line filter

### 18.1 Filter actions

The red-line filter may:

- allow;
- rewrite;
- suppress.

It must not become a broad lockdown layer.

### 18.2 Rewrite before suppressing

If content is useful but overstrong, rewrite it into safe professional language.

Examples:

| Overstrong / high-risk                    | Preferred rewrite                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| “This guarantees a callback.”             | “This supports submission readiness from the available evidence.”                    |
| “This proves professional mastery.”       | “This reads strongly against the selected level in the observed areas.”              |
| “The performer has a vocal health issue.” | “Vocal health cannot be assessed; consider professional advice if there is concern.” |

### 18.3 Suppress only true red lines

Suppress only the high-risk categories defined in section 1.4.

Do not suppress supplied brief text, professional critique, scores, comparison values, technique commentary, timestamps, role/material context or brief instructions merely because they are detailed.

---

## 19. QA artefacts and diagnostics

### 19.1 QA is proof, not product

QA artefacts prove what happened. They do not replace the report.

If QA artefacts fail to emit:

- the report may still render;
- release proof is blocked;
- diagnostics must explain the artefact failure.

### 19.2 Required artefacts for proof

Where QA is enabled, preferred artefacts include:

- `input/context.json`;
- `ai/observation_pass.json`;
- `ai/judgement_pass.json`;
- `ai/repair_passes.json` where relevant;
- `ai/technique_commentary.json`;
- `report/full_report_model.json`;
- `report/authenticated_report_model.json`;
- `report/rendered_text.txt`;
- `qa/red_line_filter_trace.json`;
- `qa/report_quality_check.json`;
- `operator/assumption_log.json`.

### 19.3 Artefact failure handling

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

---

## 20. Minimal env/config principle

### 20.1 Environment variables

Use environment variables only for secrets and deployment/runtime basics.

Expected categories:

- database / storage connection;
- AI provider key;
- Mux credentials;
- session/auth secrets;
- app environment;
- deployment commit if automatically provided.

Do not add env vars for ordinary product behaviour.

### 20.2 Product configuration

Product toggles should live in database/admin config where possible.

Examples:

- `qa_artifacts_enabled`;
- `operator_test_mode_enabled`;
- `score_chips_visible`;
- `comparison_chips_visible`;
- `technique_library_enabled`;
- `report_mode`;
- `ai_model_primary`;
- `ai_model_fallback`.

### 20.3 Deployment provenance

Deployment provenance is useful for release proof, not for report value.

A missing commit SHA should block release proof, but should not prevent the report from rendering.

---

## 21. Operator-tested assumptions

Any assumption that affects canary acceptance must be confirmed by the operator or marked uncertain.

Examples:

- same brief;
- same video;
- fixture type;
- expected blocker;
- complete brief package;
- score chips intentionally visible;
- comparison intentionally visible;
- AI missed a component;
- AI misclassified material;
- same video changed brief;
- same video changed level;
- intentional retest.

Operator feedback should become a fixture, regression test, prompt improvement or report-quality rule.

---

## 22. Golden fixtures

Every report-value change must preserve or improve these fixtures.

### 22.1 Fixture A — incomplete mandatory MT package

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

### 22.2 Fixture B — strong professional complete package

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

### 22.3 Fixture C — old-report usefulness baseline

The 22 May report is a minimum usefulness floor, not an exact template.

New reports must preserve or exceed its practical specificity while applying only narrow high-risk filtering.

### 22.4 Fixture D — poor assessability

Expected:

- limited report allowed;
- specific assessability explanation;
- no invented fixes;
- no generic shell.

### 22.5 Fixture E — no brief supplied

Expected:

- useful performance/setup feedback;
- no invented brief requirements;
- brief adherence marked not assessable.

### 22.6 Fixture F — same-video duplicate

Expected:

- duplicate/same-video status identified or marked uncertain;
- no misleading comparison of duplicate media as different performances;
- operator confirmation requested where needed.

### 22.7 Fixture G — comparison

Expected:

- score/comparison chips visible in operator/test mode;
- comparison reasoning where enabled;
- same-video safeguards;
- no guaranteed casting outcome.

---

## 23. Route/PDF first acceptance

Payloads are not enough.

Every report-value slice must inspect or test:

- rendered route text;
- exported PDF text;
- payload model;
- diagnostics where relevant. QA artefacts may help later proof work but are not required for S10 report-value acceptance.

If the route/PDF is weak, the slice fails even if payload parity passes.

A performer should be able to understand within 60 seconds:

- submit / retake / review;
- why;
- top fix;
- brief achievement;
- next action.

---

## 24. Testing and acceptance policy

### 24.1 Required tests for report-value changes

Report-value changes should include tests for:

- AI prompt output shape;
- module completeness;
- repair prompting;
- route/PDF text;
- brief requirement extraction;
- brief achievement;
- fix hierarchy;
- positive complete take;
- incomplete mandatory package;
- technique commentary;
- timestamped commentary where available;
- score terminology alignment;
- same-video handling;
- comparison handling;
- red-line filtering;
- route/PDF content acceptance. QA proof is deferred unless a later non-S10 release/provenance slice explicitly scopes it.

### 24.2 Acceptance hierarchy

A slice is not done unless:

- source/tests/build pass;
- route/PDF report surface is useful;
- relevant golden fixtures are preserved or improved;
- supplied brief content is not suppressed by default;
- AI outputs are routed to the UI;
- no generic thin-shell copy is introduced;
- high-risk red-line content is suppressed or rewritten;
- assumptions are confirmed with operator where needed;
- production/customer/Level acceptance is not claimed unless explicitly in scope.

### 24.3 QA-only success is not acceptance

A slice cannot be accepted only because:

- payload parity passed;
- no-export proof passed;
- source-kind checks passed;
- QA artefacts emitted;
- build/tests passed.

Those are necessary but not sufficient.

The route/PDF report must be useful.

---

## 25. Release and maturity model

### 25.1 Maturity levels

Use maturity levels as release-control language, not as a reason to suppress useful feedback.

Suggested levels:

| Level   | Meaning                                                             |
| ------- | ------------------------------------------------------------------- |
| Level 1 | AI-led audition readiness and performance readability report.       |
| Level 2 | Discipline-specific and technique-aware critique.                   |
| Level 3 | Brief-intelligent module detection and package analysis.            |
| Level 4 | Role/material/repertoire-aware feedback.                            |
| Level 5 | Comparison-aware and competitive readiness feedback.                |
| Level 6 | Professional/agent mode with deeper calibration and operator tools. |

### 25.2 Release gates

Production/customer release requires separate acceptance.

Visible score/comparison chips in authenticated/operator/test mode do not equal production approval.

Operator/test diagnostics do not equal customer release.

### 25.3 Rollback rule

If a release produces a thin shell or materially reduces report usefulness, rollback the report-generation/rendering path while preserving useful infrastructure where possible.

---

## 26. S10 rebuild sequence

The corrected S10 rebuild should follow this order:

1. AI report module question map and active prompt replacement.
2. Brief intelligence and requirement extraction.
3. Tape observation and component verification.
4. Brief achievement matrix.
5. Readiness recommendation and score semantics.
6. Fix hierarchy and next-action plan.
7. Strengths, preserve and professional critique.
8. Technique-library commentary.
9. Timestamped/time-banded commentary.
10. Report model to UI piping.
11. Canary A incomplete mandatory package fixture.
12. Strong complete professional fixture.
13. Same-video and comparison handling.
14. Operator assumption checkpoints.
15. Route/PDF content acceptance.

Do not start with payload gates, source-kind restrictions or QA architecture before the report is useful.

Runtime provenance, GateTrace, ValidatorTrace, public/private payload parity, Level 2 acceptance, production release and full QA artefact reconciliation are post-S10 roadmap work unless explicitly scoped in a later slice.

---

## 27. Resolved design issues from previous S10 attempts

This README resolves the following circular or contradictory design issues:

### 27.1 Safety versus usefulness

Previous issue:

```text
public-safe = say less
```

Resolved rule:

```text
authenticated report = maximum useful information, narrow high-risk red-line filtering only
```

### 27.2 QA artefacts versus product

Previous issue:

```text
clean QA proof could coexist with weak report output
```

Resolved rule:

```text
QA proves the report; it does not replace report usefulness
```

### 27.3 Code versus AI

Previous issue:

```text
code filled modules with generic fallback when AI output was missing
```

Resolved rule:

```text
AI is the brain; code repairs, validates, routes and renders
```

### 27.4 Brief transparency

Previous issue:

```text
supplied brief content was treated as unsafe by default
```

Resolved rule:

```text
supplied brief is first-class authenticated report input
```

### 27.5 Scoring visibility

Previous issue:

```text
score visibility and production public scoring approval were conflated
```

Resolved rule:

```text
score/comparison chips may be visible in authenticated/operator/test mode; production approval is separate
```

### 27.6 Professional scoring nuance

Previous issue:

```text
high professional scores risked flattening report value
```

Resolved rule:

```text
professional nuance must be expressed through sub-dimensions and written judgement, especially above 90
```

### 27.7 Same-video uploads

Previous issue:

```text
same video uploads could be treated as new performances or ambiguous comparisons
```

Resolved rule:

```text
same-video state must be detected, confirmed or marked uncertain
```

---

## 28. Forbidden failure modes

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
- let a strong complete take produce an empty or thin report.

---

## 29. Final controlling decision

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
Test assumptions with the operator.
Never accept a report that is safe but useless.
```
