# TapeCoach v3 Roadmap — Product and Delivery Plan Including S10

**Document status:** Product roadmap and delivery sequencing layer.  
**Current reset point:** S9-19.  
**Current active phase:** S10 — AI-led full-value authenticated report reset.  
**Language:** UK English.  
**Release philosophy:** small, frequent, reversible releases that preserve or improve performer-facing report value.  
**Primary correction after S10 rollback:** the AI is the report brain; code orchestrates, validates, routes, renders and applies narrow high-risk filtering only.

---

## 1. Source hierarchy

`README.md` is the controlling product contract for TapeCoach behaviour, report requirements, scoring rules, QA artefacts, validator gates, public/private boundaries and release decisions.

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
3. what the supplied brief asked for;
4. what TapeCoach observed in the tape;
5. what was achieved;
6. what was missed, incomplete or not assessable;
7. what must be fixed first;
8. what else should improve;
9. what is optional polish;
10. what should be preserved;
11. what should not be over-fixed;
12. what to do next.

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
4. Technique and timestamp commentary
5. Score/comparison meaning and professional nuance
6. Same-video and operator assumption handling
7. Route/PDF acceptance
8. QA artefacts as secondary proof
9. Release governance
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
- score terminology alignment.

Ideas to discard or quarantine:

- broad brief lockdown;
- “public-safe” as a synonym for minimal;
- limited model as ordinary output;
- generic fallback phrases;
- payload-only acceptance;
- QA-only acceptance;
- hiding useful content because it is detailed;
- replacing AI judgement with static code copy.

---

## 5. Product maturity tracks

The roadmap is organised across product maturity tracks. Each phase may touch several tracks, but S10 prioritises Report Intelligence and Prompt Engineering first.

### Track A — Report intelligence

Goal: produce the full professional performer-facing report.

Includes:

- recommendation;
- why;
- supplied brief task;
- observed tape;
- brief achievement;
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

- observation pass;
- professional judgement pass;
- technique-library pass;
- timestamp pass;
- score calibration pass;
- comparison pass;
- module completeness check;
- repair prompts.

### Track C — Brief intelligence

Goal: treat the supplied brief as first-class input.

Includes:

- full useful brief preservation;
- role/project/material extraction;
- required component extraction;
- deadlines, upload instructions, file naming, framing and format instructions;
- mandatory / preferred / optional / ambiguous classification;
- achievement status per requirement.

### Track D — Technique library

Goal: attempt observable, useful technique commentary by default.

Includes:

- acting;
- vocal/singing;
- movement/dance;
- Musical Theatre package integration;
- commercial/screen task;
- self-tape presentation.

### Track E — Scoring and comparison

Goal: ensure numeric values support language and judgement rather than replacing it.

Includes:

- score-to-terminology mapping;
- professional score nuance above 90;
- sub-dimension scoring;
- brief blockers overriding performance scores;
- comparison reasoning;
- operator/test diagnostic score chips.

### Track F — Media and same-video handling

Goal: handle Mux/media readiness, timestamps, continuity, duplicates and retests.

Includes:

- Mux readiness;
- audio/video/framing assessability;
- timestamp/time-band support;
- same-video duplicate detection;
- intentional retest handling;
- same-video changed brief/level handling;
- same-video comparison safeguards.

### Track G — QA and operations

Goal: prove the report without replacing it.

Includes:

- report model artefacts;
- AI pass artefacts;
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
What did the brief require?
What was achieved/missed?
What is fix-first?
What should I preserve?
What should I do next?
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

### Level 3 — Scoring, calibration and comparison

Adds calibrated scoring and take comparison.

Must preserve:

- score terminology alignment;
- high-professional nuance;
- comparison reasoning;
- same-video safeguards.

### Level 4 — Operational/release proof

Adds stronger artefacts, provenance, operator confirmation, release and production gates.

Level 4 is not allowed to degrade Level 1–3 report value.

---

## 7. Active phase: S10 — AI-led full-value report reset

### S10 objective

Rebuild from S9-19 into a full-value, AI-led authenticated report system.

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

**Purpose:** Make the corrected direction unavoidable before implementation resumes.

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
- docs state thin-shell output is failure;
- docs state QA artefacts are proof, not the product;
- roadmap remains sequencing-only.

---

### S10.1 — AI report module question map and active prompt replacement

**Purpose:** Define what the AI must answer for every performer-facing report module and make the S10 prompt map the active runtime path.

**Acceptance:** active Step 1, Step 2 and fallback/single-pass report generation use S10 prompt versions; legacy S9 prompt labels are legacy-only; every visible report module has an AI question, output destination, completeness rule and repair prompt; Canary A component verification is explicit before scoring or recommending.

---

### S10.2 — Brief intelligence and requirement extraction

Extract the supplied brief into explicit, testable `BriefRequirement[]` items before the tape is judged.

---

### S10.3 — Tape observation and component verification

Ask the AI to observe the tape sequence and classify each required component as present, partially present, absent, not assessable or uncertain.

---

### S10.4 — Brief achievement matrix

Compare `BriefRequirement[]` with observed tape components before recommendation, score or fix hierarchy.

---

### S10.5 — Readiness recommendation and score semantics

Make score, score chip language and recommendation depend on brief achievement, with mandatory brief blockers overriding submission readiness.

---

### S10.6 — Fix hierarchy and next-action plan

Ask the AI to rank must-fix, should-improve and optional-polish actions by submission impact.

---

### S10.7 — Strengths, preserve and professional critique

Preserve old-report richness with AI-authored strengths, preserve guidance and professional critique for incomplete and strong complete takes.

---

### S10.8 — Technique-library commentary

Attempt practical technique commentary by default where evidence exists; missing components produce not-assessable technique notes.

---

### S10.9 — Timestamped and time-banded commentary

Keep timestamped/time-banded commentary as a first-class AI output and UI module.

---

### S10.10 — Report model to UI piping

Pipe AI module outputs into the existing rich report surface; if AI output exists but is not rendered, treat it as a routing bug.

---

### S10.11 — Canary A incomplete mandatory package fixture

Create permanent regression coverage for the incomplete mandatory MT package false-positive.

---

### S10.12 — Strong complete professional fixture

Create permanent coverage for a professional-level complete take that receives a rich positive report.

---

### S10.13 — Same-video and comparison handling

Handle duplicate media, intentional retests, changed brief/level/report version and same-video comparison without false performance deltas.

---

### S10.14 — Operator assumption checkpoints

Record lightweight operator fixture assumptions for content testing; missing assumptions make results uncertain, not accepted by hidden proof.

---

### S10.15 — Route/PDF content acceptance

Treat rendered route text, exported PDF text and visible performer-facing modules as the S10 acceptance surface.

S10 explicitly defers runtime provenance, operator runtime verification, GateTrace, ValidatorTrace, Level 2 acceptance, production/customer release, public/private payload parity, public scoring approval, public technique authority approval, public comparison approval and full QA artefact reconciliation.

---

## 9. Post-S10 roadmap

### S11 — Broaden report reliability and fixture coverage

Purpose:

```text
Expand from two core canaries to a broad suite of realistic performer scenarios.
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
- multiple takes;
- duplicate video;
- high-scoring professional takes;
- early-career performer calibration.

Acceptance:

- reports remain useful across disciplines;
- no thin shell;
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
- uncertainty phrasing.

Acceptance:

- technique commentary is useful and specific;
- not-assessable limitations are clear;
- no medical/body/protected-characteristic claims.

### S13 — Score and comparison productisation

Purpose:

```text
Turn score/comparison diagnostics into a consistent authenticated product feature.
```

Likely work:

- sub-dimension score explanation;
- professional >90 nuance;
- comparison reasoning;
- same-video comparison safeguards;
- score trend across takes;
- operator/test to authenticated product mode transition.

Acceptance:

- scores never contradict language;
- comparison explains why;
- duplicate videos are handled honestly;
- high-level performers still receive useful nuance.

### S14 — QA, provenance and operator proof hardening

Purpose:

```text
Strengthen proof without degrading report value.
```

Likely work:

- stable QA artefact emission;
- operator confirmation workflows;
- report model snapshots;
- AI prompt/version provenance;
- route/PDF snapshot storage;
- regression dashboards.

Acceptance:

- useful report renders even if proof artefacts fail;
- proof failure blocks release evidence only;
- diagnostics are clear.

### S15 — Production/customer release readiness

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
useful next action.
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

---

## 11. Operating rules for roadmap slices

Every slice must satisfy these rules:

1. **Report value first.** If the route/PDF is weak, the slice fails.
2. **AI question first.** Do not add report UI without an AI question.
3. **No generic code brain.** Code must not invent professional critique.
4. **Brief transparency by default.** Do not suppress supplied brief content by default.
5. **Technique commentary by default.** Attempt it where evidence exists.
6. **Timestamp commentary by default.** Attempt timestamps/time bands where available.
7. **Score language must align.** Numeric values must not contradict report language.
8. **Professional score nuance matters.** High-scoring professional takes still need written distinction.
9. **Same-video handling is explicit.** Duplicate/retest/comparison cases must not be ambiguous.
10. **Operator assumptions are tested.** Canary-critical assumptions must be confirmed or marked uncertain.
11. **QA is proof, not product.** Artefact work must not starve report value.
12. **Minimal env sprawl.** Product toggles belong in admin/database config where possible.

---

## 12. Stop / rollback conditions

Pause or rollback a slice if any of these occurs:

- Canary A or Canary B regresses;
- the route/PDF becomes less useful than the previous accepted state;
- a module becomes generic/thin because AI output was not requested or not routed;
- supplied brief detail is suppressed by default;
- score language contradicts report terminology;
- same-video comparison creates a false winner;
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
Technique and timestamp commentary.
Score/comparison nuance.
Same-video handling.
Route/PDF first acceptance.
QA as secondary proof.
```

---

## 14. Final roadmap rule

If the performer would not find the report useful within 60 seconds, the roadmap slice fails — regardless of how clean the payloads, artefacts or gates look.
