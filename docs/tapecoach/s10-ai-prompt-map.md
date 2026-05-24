# S10 AI Prompt Map

S10 makes the AI the report brain. Code supplies deterministic context, validates/repairs output, routes it to the report model and renders it. Code must not replace missing AI judgement with generic performer-facing filler.

Runtime provenance, GateTrace, ValidatorTrace, public/private parity and QA proof are not S10 acceptance requirements.

## Active Prompt Versions

| Prompt                                            | Version                                         | Source                                       | Runtime stage                         | Status                          |
| ------------------------------------------------- | ----------------------------------------------- | -------------------------------------------- | ------------------------------------- | ------------------------------- |
| S10 brief intelligence                            | `s10_brief_intelligence_v1`                     | `src/server/extract-brief.server.ts`         | Preflight brief extraction            | Active                          |
| S10 observation/module map                        | `s10_observation_module_map_v1`                 | `src/server/evidence-pass.server.ts`         | Step 1 evidence / observation         | Active                          |
| S10 professional judgement/module map             | `s10_professional_judgement_module_map_v1`      | `src/server/report-polish.server.ts`         | Step 2 judgement / report generation  | Active                          |
| S10 single-pass professional judgement/module map | `s10_professional_judgement_module_map_v1`      | `src/server/process-take.server.ts`          | Single-pass recovery                  | Active                          |
| S10 module repair                                 | `s10_module_repair_v1`                          | `src/server/s10-report-prompt-map.server.ts` | Repair prompt template                | Active template                 |
| Legacy S9 brief extraction                        | `legacy_s9_brief_extraction_supporting_current` | `src/server/extract-brief.server.ts`         | Archived coarse brief extraction      | Legacy only                     |
| Legacy S9 evidence pass                           | `legacy_s9_evidence_pass_current`               | `src/server/evidence-pass.server.ts`         | Archived Step 1 label                 | Legacy only                     |
| Legacy S9 single pass                             | `legacy_s9_single_pass_analysis_current`        | `src/server/process-take.server.ts`          | Archived single-pass label            | Legacy only                     |
| Legacy S9 report polish                           | `legacy_s9_two_step_report_polish_current`      | `src/server/report-polish.server.ts`         | Archived Step 2 label                 | Legacy only                     |
| Internal dimensions                               | `legacy_internal_dimension_prompt_fragments`    | `src/server/dimensions/*`                    | Flag-gated internal dimension capture | Legacy/internal only            |
| Comparison model prompt                           | `no_active_s10_comparison_model_prompt`         | `src/server/v3/s6-variance-comparison.ts`    | Comparison                            | No active model prompt in S10.1 |

The old S9 prompt version names must not be emitted by the active S10 analysis path. They may appear only in this inventory, tests, or archived compatibility references.

## S10.2 Brief Intelligence

The active brief preflight prompt extracts `BriefContext` and `BriefRequirement[]` before the tape is observed, scored or recommended. It preserves supplied brief details and makes each requirement testable by S10.3 observation.

For supplied-brief runs, legacy cached brief fields are not enough for the active S10 path. The pipeline re-extracts when the cached brief lacks `s10_brief_intelligence_v1` requirements, and it must not proceed to scoring/recommendation while a supplied brief has no S10 requirement list.

Each `BriefRequirement` contains:

- `id`;
- `brief_text`;
- `summary`;
- `category`: `material`, `performance`, `technical`, `admin_process`, `deadline`, `logistics` or `role_context`;
- `importance`: `mandatory`, `preferred`, `optional` or `ambiguous`;
- `expected_evidence_in_tape`;
- `achievement_test`;
- `submission_impact_if_missing`;
- `report_destination`;
- `confidence`.

Canary A guardrail: Side 1 and the song are separate mandatory material requirements; one continuous video and one file only are separate mandatory package/admin requirements; landscape and head-and-shoulders are mandatory technical requirements; role description stays `role_context` unless the brief explicitly makes it performed material.

## S10.3 Tape Observation And Component Verification

The active Step 1 prompt remains `s10_observation_module_map_v1`, but its output contract now separates requested brief material from observed media facts.

Step 1 must consume:

- supplied brief;
- S10 `BriefContext`;
- S10 `BriefRequirement[]`;
- media reference;
- selected level;
- media duration and readiness signals where available.

Step 1 must produce:

- `ObservedTapeSequence[]`: ordered visible/audible sections, including what appears first, component type, linked requirement ids, timestamp or time-band where possible, present status, completion status, evidence basis, confidence and assessability notes;
- `ComponentVerification[]`: one row per relevant `BriefRequirement`, with observed status, completion status, media evidence summary, timestamp refs, confidence and `cannot_infer_from_brief_only: true`;
- `MediaObservationSummary`: audio/video/framing/continuity assessability, abrupt cut-off, one-continuous-video observation, duration summary and uncertainties.

Strict S10.3 rules:

- requested material and observed material remain separate;
- a component can only be `present`, `partially_present` or `complete` when `observed_from_media=true` and `evidence_basis=observed_audio_video`;
- `brief_text_only` can define what to look for but cannot prove the thing appears in the tape;
- deterministic duration/readiness can support assessability but cannot prove component completion;
- `raw_report.detected_components`, legacy report prose and material-compliance fields are diagnostic only and cannot override S10 component verification.

Canary A observation requirement: the Step 1 contract must allow and expect intro first, partial/cut-off song, missing Side 1, incomplete package, assessable audio, and video/framing assessability where supported. It must not mark `acting_scene` present without acting-scene media evidence or mark the song complete without media evidence through the end.

## Deterministic Inputs Code May Supply

- supplied brief;
- selected level;
- take metadata;
- media duration;
- upload identity;
- known comparison take IDs;
- operator-declared fixture assumptions.

## Code Must Not Invent

- observed component presence;
- professional strengths;
- technique notes;
- optional polish;
- readiness rationale;
- score explanation;
- comparison judgement.

## Completeness Statuses

- `complete`;
- `missing`;
- `thin`;
- `generic`;
- `contradictory`;
- `unsupported`;
- `not_assessable`.

## Module Coverage Table

| Report module              | AI question                                                                                                                | Structured output field                                                                                 | UI destination                            | Completeness rule                              | Repair prompt         | Deterministic inputs allowed                                                                            | Code-generated content forbidden        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| overall readiness          | After brief achievement is known, what readiness decision and score should the performer see?                              | `overall_score`, `casting_headline`, `submission_verdict`                                               | Overall readiness header                  | complete                                       | contradictory repair  | brief, level, take metadata, duration, upload identity, known comparison take IDs, operator assumptions | readiness rationale, score explanation  |
| score/chip                 | What score band and score-to-language explanation matches verified brief achievement?                                      | `overall_score`, `scores`, `category_rationale`                                                         | Score chip and category score bars        | complete                                       | contradictory repair  | brief, level, take metadata, duration                                                                   | score explanation                       |
| verdict                    | Should the performer submit, review carefully, submit only if deadline is close, or retake if possible?                    | `verdict_final`, `casting_insight`, `at_risk`                                                           | Verdict header and risk panel             | complete                                       | contradictory repair  | brief, level, take metadata, operator assumptions                                                       | readiness rationale                     |
| prioritised fixes          | What are the most submission-impactful fixes, ordered by urgency and source category?                                      | `priority_fixes`                                                                                        | Prioritised fixes section                 | complete                                       | thin repair           | brief, level, observed evidence                                                                         | professional fixes                      |
| fix-first                  | What is the single first action before submitting or retaking?                                                             | `fix_first`                                                                                             | Fix this first fallback section           | complete                                       | generic repair        | brief, level, observed evidence                                                                         | professional fixes                      |
| why this score             | For each visible score, what works, why is it not full score, and what closes the gap?                                     | `category_rationale`                                                                                    | Why this score section                    | complete                                       | thin repair           | brief, level, observed evidence                                                                         | score explanation                       |
| category scores            | How should technical, audio, vocal, acting, brief adherence and presentation be scored after component verification?       | `scores`, `category_notes`                                                                              | Category scores section                   | complete                                       | contradictory repair  | brief, level, observed evidence                                                                         | score explanation                       |
| component breakdown        | Which components were actually observed, and are they present, absent, partial, cut off, uncertain or not assessable?      | `observed_tape_sequence`, `component_verifications`, `media_observation_summary`, `detected_components` | Component breakdown section               | complete                                       | unsupported repair    | brief, duration, observed evidence                                                                      | observed component presence             |
| brief achievement          | For every requirement, what was achieved, missed, incomplete or not assessable?                                            | `brief_adherence_breakdown`, `submission_risk_flags`                                                    | Readiness/risk/category sections          | complete                                       | contradictory repair  | supplied brief, level, observed evidence                                                                | readiness rationale, component presence |
| strengths                  | What specific strengths are supported by observed evidence?                                                                | `strengths`                                                                                             | Strengths section                         | complete                                       | generic repair        | observed evidence, level                                                                                | professional strengths                  |
| preserve / do-not-overfix  | What should be preserved, and what should not be over-fixed?                                                               | `next_take_plan`, `coaching_drills`, `category_rationale`                                               | Next steps / why this score               | thin allowed only if not assessable            | thin repair           | observed evidence, level                                                                                | optional polish, strengths              |
| improvements               | What concrete improvements are grounded in the observed tape and selected level?                                           | `improvements`                                                                                          | Improvements section                      | complete                                       | generic repair        | observed evidence, level                                                                                | professional fixes                      |
| technique commentary       | What acting, vocal, movement, MT package or presentation technique commentary is visible, and what is not assessable?      | `category_rationale`, `category_notes`, `improvements`                                                  | Why this score / category / improvements  | thin allowed only with limitation              | not-assessable repair | observed evidence, level                                                                                | technique notes                         |
| timestamped notes          | What timestamped or time-banded moments evidence strengths, fixes, missing components, cut-offs or technical observations? | `timestamped_notes`                                                                                     | Timestamped notes section                 | thin allowed when exact timestamps unavailable | missing repair        | media duration                                                                                          | component presence, strengths           |
| next action                | What finite next-take plan or submit checklist should the performer follow?                                                | `next_take_plan`, `coaching_drills`                                                                     | Next steps section                        | complete                                       | generic repair        | brief, level, observed evidence                                                                         | optional polish, readiness rationale    |
| submission risk            | Which brief, package, technical or admin issues could block or reduce readiness?                                           | `submission_risk_flags`, `casting_risk_explanations`, `at_risk`                                         | Submission risk section                   | complete                                       | contradictory repair  | brief, take metadata, upload identity                                                                   | readiness rationale                     |
| role fit                   | Where brief context is sufficient, how does performance serve role function and tone?                                      | `role_fit_notes`, `role_fit_modifier`, `role_fit_confidence`                                            | Role fit section                          | not_assessable allowed                         | not-assessable repair | supplied brief, selected level                                                                          | comparison judgement                    |
| presentation notes         | What practical presentation notes are supported by camera/audio evidence?                                                  | `presentation_notes`                                                                                    | Presentation notes section                | thin allowed                                   | unsupported repair    | technical signals, duration                                                                             | optional polish                         |
| not-assessable limitations | What cannot be assessed, what is affected, and what check resolves it?                                                     | `confidence_reason`, `category_notes`, `improvements`                                                   | Reliability, category notes, improvements | not_assessable                                 | not-assessable repair | brief, level, duration, take metadata                                                                   | technique notes, score explanation      |

## Canary A Requirement

Before scoring or recommending, the AI must verify whether each required brief component is present, absent, partial, cut off, uncertain or not assessable.

For Canary A, the active prompts must explicitly check:

- Side 1 acting scene;
- contemporary legit MT song completion;
- one continuous video;
- one final file/package readiness;
- abrupt cut-off.

The AI must not infer required material is present just because the brief requested it. If Side 1 is missing, the report cannot mark `acting_scene` achieved. If the song is partial or cut off, the report cannot mark the package complete. Audio assessability cannot override missing mandatory material.

## Repair Prompts

Use `s10_module_repair_v1` for missing, thin, generic, contradictory, unsupported or not-assessable modules. The repair prompt must use only the supplied brief, observed tape sequence, brief achievement matrix and locked AI outputs, and it must return specific replacement content or a useful not-assessable limitation.
