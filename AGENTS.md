# AGENTS.md — TapeCoach Implementation Contract

## Purpose

This file keeps implementation agents aligned with TapeCoach’s S10 direction.

TapeCoach is an AI-led professional self-tape critique system. The performer-facing report is the product. QA artefacts, gates and diagnostics prove the report; they do not replace it.

Do not optimise for a clean internal proof layer at the expense of performer-facing usefulness.

## Source hierarchy

1. `README.md` is the controlling product contract.
2. `docs/tapecoach/s10-target-architecture.md` defines the target S10 architecture.
3. Roadmap and delivery docs define sequencing only.
4. This `AGENTS.md` defines implementation operating rules for agents.

If there is a conflict, `README.md` wins.

## Simplest mental model

TapeCoach’s simplest flow is:

1. User input:
   - optional brief;
   - selected skill / performer level;
   - self-tape video.

2. Automated media layer:
   - Mux prepares the media;
   - the system records media readiness and assessability;
   - the system captures duration, audio/video assessability, framing and continuity signals where available.

3. AI intelligence layer:
   - two-step AI analysis observes the tape and produces professional judgement;
   - the AI is prompted module by module;
   - AI repair prompts run if a report module is missing, thin, generic or contradictory;
   - additional AI reviews may be requested when the first analysis is incomplete, low-confidence or contradictory.

4. Report/UI layer:
   - code pipes structured AI outputs into the report model and UI;
   - code formats and renders;
   - code applies only narrow high-risk red-line filtering;
   - code does not invent professional critique.

5. Operator loop:
   - uncertain assumptions are confirmed with the operator;
   - operator confirmations become tests or fixtures.

## Core doctrine

The AI is the report brain.

The code should:

- load inputs;
- ask the AI the right module-level questions;
- validate structure;
- detect missing, thin, generic, contradictory or unsupported output;
- re-prompt for repair;
- route outputs to the UI;
- apply narrow high-risk red-line filtering;
- emit diagnostics.

The code must not replace missing AI judgement with generic filler.

## Product goal

Every authenticated performer-facing report must help the performer understand:

- whether to submit, retake or review carefully;
- why;
- what the supplied brief asked for;
- what TapeCoach observed;
- what was achieved;
- what was missed or incomplete;
- what must be fixed first;
- what else should improve;
- what is optional polish;
- what should be preserved;
- what should not be over-fixed;
- what to do next;
- what could not be assessed.

A safe but unhelpful report fails.

## Full-value authenticated report mode

Authenticated performer-facing reports should use all useful available information, including:

- supplied brief text;
- role, project and material context;
- audition instructions;
- deadline, upload, file naming and format requirements;
- AI observations;
- performance critique;
- acting, vocal, singing, movement and musical-theatre package notes;
- technique-library commentary;
- scores and comparison values in authenticated, operator or test mode;
- timestamped or time-banded notes where available;
- professional judgement;
- operator-confirmed assumptions.

Do not suppress content merely because it is detailed, brief-derived, technique-related, score-related, comparison-related, positive, critical or professionally specific.

## Narrow high-risk red lines only

Suppress or rewrite only:

- system secrets;
- environment values;
- signed/private system URLs;
- raw prompts;
- raw model responses;
- internal QA artefact internals;
- evidence IDs, truth IDs or raw run IDs in performer prose;
- protected-characteristic inference;
- body or appearance judgement;
- medical or vocal-health diagnosis;
- guaranteed casting, callback, booking, job or employment outcomes;
- unsupported certainty.

Everything else should be available to the authenticated report if useful.

## Supplied brief transparency

The supplied brief is first-class report input.

Do not lock down or hide the brief by default.

The report should show enough of the supplied brief for the performer to understand:

- required material;
- required components;
- page, scene or line references;
- song, dance or movement requirements;
- ident/slate requirements;
- technical framing or orientation;
- file naming;
- upload instructions;
- deadline;
- one-file / continuous-video instructions;
- logistical constraints relevant to submission readiness.

## AI module question map

Before implementing or changing report output, identify which AI module questions are needed.

The AI should be explicitly asked to populate:

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
- scores and calibration where enabled;
- comparison where enabled;
- next action;
- do-not-overfix;
- not-assessable limitations.

If a UI report section exists, there must be an AI question designed to populate it.

## One AI question per UI module

Every visible report section must have a corresponding AI prompt question.

If a developer adds or changes a UI report module, they must also define:

- the AI question that populates it;
- the expected structured output;
- the completeness rules;
- the repair prompt;
- how the output is routed to the UI.

Do not add report UI sections that are primarily populated by code filler.

## AI responsibilities

The AI should provide:

- observation;
- interpretation;
- professional judgement;
- technique commentary;
- prioritisation;
- strengths;
- optional polish;
- comparison judgement;
- timestamped notes;
- next-take actions.

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
- QA artefacts.

The code must not invent professional feedback such as strengths, technique notes, optional polish, comparison judgement or readiness rationale.

## Report model to UI piping

The UI should render the structured AI-populated report model.

The UI may:

- order sections;
- format text;
- group related items;
- show score/comparison chips;
- show timestamped notes;
- highlight fix-first and must-fix items.

The UI must not:

- invent professional judgement;
- invent strengths;
- invent technique notes;
- invent optional polish;
- replace missing AI content with generic performer-facing copy;
- hide useful AI output unless it crosses a high-risk red line.

If AI output exists but does not appear in the UI, that is a routing bug.

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
- If comparison is present but no reasoning exists, ask the AI to compare the takes.
- If timestamps are unavailable, ask for component-level commentary instead.

Generic fallback copy must not be the primary content of any report module.

## No AI, no report brain

If AI analysis fails, the system may produce a limited report only if it clearly explains what failed and what can still be assessed.

The system must not pretend that deterministic fallback copy is professional analysis.

If the AI cannot produce a module after repair prompting, the report should say:

- what could not be assessed;
- what evidence is missing;
- what the performer can do next.

It should not produce a thin shell.

## Thin-shell anti-regression rule

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

## Timestamped commentary

Where available, the AI should attempt timestamped or time-banded commentary.

Timestamped commentary should identify:

- component starts and endings;
- strong moments to preserve;
- missing or incomplete material;
- cut-offs;
- technical, framing or audio issues;
- performance moments to refine.

If timestamps are unavailable, the report must still provide useful component-level commentary.

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

Avoid only high-risk claims: medical diagnosis, body/appearance judgement, protected-characteristic inference, guaranteed casting/job outcome, or unsupported certainty.

## Scores, terminology and professional nuance

Numeric scores and comparison chips may remain visible in authenticated/operator/test mode.

Do not confuse this with production/customer approval.

The report may use scores for testing and calibration, but must not claim production release, customer release, public scoring approval, or public comparison recommendation approval unless separately accepted.

### Score is a compression, not the judgement

A score is not the report. It is a compact signal that must be interpreted through:

- performer level;
- brief completion;
- material difficulty;
- audition type;
- discipline;
- professional standard;
- submission risk;
- comparison context;
- confidence / reliability;
- AI qualitative judgement.

The AI must explain what the score means. Code must not rely on the number alone to create verdicts or report language.

### Professional-level score nuance

For professional performers, the score scale compresses a large amount of nuance. Many professional, submission-worthy tapes may score above 90.

At professional level, the system must not treat all scores above 90 as equivalent, and it must not pretend the number alone captures the professional distinction.

Professional scores should be interpreted with qualitative labels and explanation, such as:

- **90–92: Professionally viable / submission-capable** — the tape can credibly sit in a professional submission pool, but may still have clear optional polish, brief-specific risk or comparison weaknesses.
- **93–95: Strong professional submission** — the tape is brief-aligned and professionally readable, with limited risk and meaningful strengths to preserve.
- **96–98: Highly competitive professional submission** — the tape is not only brief-complete but unusually clear, specific, technically reliable and performance-ready for the supplied task.
- **99–100: Exceptional / near-ceiling for this rubric** — reserved for rare cases. This does not guarantee casting, callback, booking or employment.

These bands are descriptive, not deterministic. The AI must still explain the difference in terms a performer can use.

Examples of professional nuance the score alone cannot capture:

- one take may be vocally stronger while another is more role-specific;
- one take may be technically cleaner while another is more emotionally compelling;
- one take may have higher polish while another better meets the brief;
- two takes may both be over 90 but one may be easier to submit because it has lower brief or edit risk;
- a lower-scored take may still be the better submission if it fulfils the brief more precisely.

### Score terminology alignment

Visible scores must align with report terminology.

A score must map to:

- readiness language;
- submission guidance;
- confidence / reliability;
- fix hierarchy;
- comparison wording;
- performer-facing next action.

Do not show a score that contradicts the report language without explanation.

Unacceptable contradictions:

- score suggests strong readiness but verdict says retake required without explaining the brief blocker;
- score suggests low readiness but verdict says submit without explanation;
- comparison chip shows a meaningful difference but the report gives no comparison reasoning;
- report says “brief achieved” but score language implies a mandatory blocker;
- report says “no mandatory blocker” but score terminology says “not ready”.

Brief blockers can override performance score.

Example:

A vocally strong tape can still be “retake required” if the brief-required acting side is missing.

Score language should distinguish:

- performance quality;
- brief completion;
- technical assessability;
- submission readiness;
- professional nuance;
- comparison usefulness.

The AI must be asked to explain the score in these terms, not simply output a number.

### General readiness terminology

Use this as a default terminology map unless README or a calibration document defines a newer one.

| Score band | General terminology | Typical meaning |
|---|---|---|
| 0–39 | Not submission-ready / not assessable | Serious missing evidence, technical blocker or incomplete package. |
| 40–54 | Retake required if possible | Major brief, performance or presentation issue blocks submission readiness. |
| 55–69 | Review carefully | Some usable material, but meaningful risk, uncertainty or important improvement remains. |
| 70–84 | Submit if deadline is close | Submission-supporting tape with optional polish or manageable caveats. |
| 85–100 | Strong submission range | Brief-complete, assessable and strong for the selected level, but professional nuance still requires qualitative interpretation. |

The verdict is not determined by score alone. Required brief failures, missing material, non-assessability or critical technical issues can override the numerical band.

## Score and comparison display modes

Numeric score and comparison chips may be visible in authenticated/operator/test mode.

If visible, they must be treated as diagnostic or authenticated report information, not production/customer release approval.

The system must distinguish:

- score chip visibility;
- score reasoning in the report;
- public scoring product approval;
- comparison chip visibility;
- comparison recommendation approval.

Visible score/comparison chips do not by themselves mean public scoring or comparison recommendation is production-approved.

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

### Same video scenarios

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

5. Same video with new AI/report version:
   - analysis may be rerun for regression testing;
   - report artefacts should record the analysis/report version where available.

6. Comparison mode:
   - if two compared takes are actually the same video, the system must say so or ask the operator;
   - do not recommend one duplicate over another as if they were different performances.

### Operator confirmation for same video

If same-video status affects acceptance, comparison or canary interpretation, confirm with the operator.

Operator-confirmed fields may include:

- same_video_confirmed;
- same_brief_confirmed;
- same_test_fixture_confirmed;
- intentional_duplicate_upload;
- accidental_duplicate_upload;
- retest_same_media;
- changed_brief_same_media;
- changed_level_same_media.

If the system is uncertain, it must not guess. It should mark same-video status as uncertain and ask for operator confirmation.

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
- submit checklist;
- specific do-not-overfix guidance;
- no thin shell;
- professional score nuance is explained qualitatively, especially above 90.

### Fixture C — old-report usefulness baseline

The 22 May report is a minimum usefulness floor, not an exact template.

New reports must preserve or exceed its practical specificity while applying only narrow high-risk filtering.

## Route/PDF first acceptance

Payloads are not enough.

Every report-value slice must inspect or test:

- rendered route text;
- exported PDF text;
- payload model;
- QA artefacts where available.

If the route/PDF is weak, the slice fails even if payload parity passes.

## QA artefacts

QA artefacts are proof, not the product.

If QA artefacts fail to emit:

- report rendering may still proceed;
- release proof is blocked;
- diagnostics must explain the artefact failure.

Do not let QA artefact work starve report value.

## Operator-tested assumptions

Any assumption that affects canary acceptance must be confirmed by the operator.

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
- score terminology and score nuance are acceptable for the tested performer level.

If an assumption is uncertain, ask for operator confirmation or mark it as uncertain.

## Operator testing loop

Any assumption that affects whether a canary passed must be tested with the operator.

Examples:

- Is this the same video?
- Is this the same brief?
- Is this meant to be a strong complete take?
- Is this meant to be an incomplete mandatory-package take?
- Are score chips intentionally visible?
- Is comparison intentionally visible?
- Does the score terminology make sense for the selected skill level?
- Did the AI miss a component?
- Did the report understate the take?

Operator feedback should become a fixture, regression test or prompt improvement.

## Minimal env/config principle

Do not add environment variables for ordinary product behaviour.

Use env vars only for secrets and deployment/runtime basics.

Product toggles should live in database/admin config where possible.

## Report-value first sequence

When rebuilding S10, work in this order:

1. Define AI questions for each report module.
2. Validate AI output quality.
3. Pipe AI output to the report UI.
4. Test route/PDF usefulness.
5. Add QA artefacts and release proof.

Do not start with payload gates, source-kind restrictions or QA artefact architecture before the report is useful.

## Definition of done

A slice is not done unless:

- source/tests/build pass;
- route/PDF report surface is useful;
- Canary A and Canary B are preserved or improved if relevant;
- supplied brief content is not suppressed by default;
- AI outputs are routed to the UI;
- score terminology aligns with report terminology;
- professional-level score nuance is explained qualitatively when relevant;
- same-video handling is explicit when relevant;
- no generic thin-shell copy is introduced;
- high-risk red-line content is suppressed or rewritten;
- assumptions are confirmed with operator where needed;
- QA artefact status is clear;
- production/customer/Level 2 approval is not claimed unless explicitly in scope.

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
- show a score that contradicts report terminology without explanation;
- treat all professional scores above 90 as equivalent;
- treat duplicate uploads as new performances without confirmation;
- add broad safety restrictions beyond explicit high-risk red lines;
- add env-var sprawl for product toggles;
- proceed when operator assumptions are untested.

## Final rule

If the performer would not find the report useful within 60 seconds, the slice fails.
