# S10 AI Prompt Map

S10 makes the AI the report brain. Code supplies deterministic context, validates/repairs output, routes it to the report model and renders it. Code must not replace missing AI judgement with generic performer-facing filler.

Runtime provenance, GateTrace, ValidatorTrace, public/private parity and QA proof are not S10 acceptance requirements.

## Active Prompt Versions

| Prompt                                            | Version                                                      | Source                                                                              | Runtime stage                                         | Status                          |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| S10 brief intelligence                            | `s10_brief_intelligence_v1`                                  | `src/server/extract-brief.server.ts`                                                | Preflight brief extraction                            | Active                          |
| S10 observation/module map                        | `s10_observation_module_map_v1`                              | `src/server/evidence-pass.server.ts`                                                | Step 1 evidence / observation                         | Active                          |
| S10 brief achievement matrix                      | `s10_brief_achievement_matrix_v1`                            | `src/server/report-polish.server.ts` + `src/server/process-take.server.ts`          | Step 2 / single-pass pre-score requirement comparison | Active embedded module          |
| S10 readiness and score semantics                 | `s10_readiness_score_semantics_v1`                           | `src/server/report-polish.server.ts` + `src/server/process-take.server.ts`          | Step 2 / single-pass post-matrix readiness scoring    | Active embedded module          |
| S10 fix hierarchy and next action                 | `s10_fix_hierarchy_next_action_v1`                           | `src/server/report-polish.server.ts` + `src/server/process-take.server.ts`          | Step 2 / single-pass post-readiness action planning   | Active embedded module          |
| S10 strengths, preserve and professional critique | `s10_strengths_preserve_professional_critique_v1`            | `src/server/report-polish.server.ts` + `src/server/process-take.server.ts`          | Step 2 / single-pass post-fix professional critique   | Active embedded module          |
| S10 technique-library commentary                  | `s10_technique_library_commentary_v1`                        | `src/server/report-polish.server.ts` + `src/server/process-take.server.ts`          | Step 2 / single-pass post-professional critique       | Active embedded module          |
| S10 timestamped/time-banded commentary            | `s10_timestamped_commentary_v1`                              | `src/server/report-polish.server.ts` + `src/server/process-take.server.ts`          | Step 2 / single-pass post-technique commentary        | Active embedded module          |
| S10 professional judgement/module map             | `s10_professional_judgement_module_map_v1`                   | `src/server/report-polish.server.ts`                                                | Step 2 judgement / report generation                  | Active                          |
| S10 single-pass professional judgement/module map | `s10_professional_judgement_module_map_v1`                   | `src/server/process-take.server.ts`                                                 | Single-pass recovery                                  | Active                          |
| S10 module repair                                 | `s10_module_repair_v1`                                       | `src/server/s10-report-prompt-map.server.ts`                                        | Repair prompt template                                | Active template                 |
| Legacy brief adherence/material compliance        | `legacy_brief_adherence_material_compliance_diagnostic_only` | `src/server/process-take.server.ts`                                                 | Legacy raw report / score fields                      | Diagnostic only                 |
| Legacy score/readiness fields                     | `legacy_score_readiness_diagnostic_only`                     | `src/server/process-take.server.ts`                                                 | Legacy score traces / verdict prose                   | Diagnostic only                 |
| Legacy fix/action fields                          | `legacy_fix_action_diagnostic_only`                          | `src/server/process-take.server.ts` + `src/server/report-polish.server.ts`          | Legacy fix/action prose                               | Diagnostic only                 |
| Legacy strengths/professional critique fields     | `legacy_strengths_professional_critique_diagnostic_only`     | `src/server/process-take.server.ts` + `src/server/report-polish.server.ts`          | Legacy strengths, category notes and technique traces | Diagnostic only                 |
| Legacy technique commentary diagnostics           | `legacy_technique_commentary_diagnostic_only`                | `src/server/v3/qa-artifacts-wiring.server.ts` + `src/server/process-take.server.ts` | Legacy technique trace/category/drill diagnostics     | Diagnostic only                 |
| Legacy timestamped notes diagnostics              | `legacy_timestamped_notes_diagnostic_only`                   | `raw_report.timestamped_notes` + prior report prose                                 | Legacy timestamped report surface                     | Diagnostic only                 |
| Legacy S9 brief extraction                        | `legacy_s9_brief_extraction_supporting_current`              | `src/server/extract-brief.server.ts`                                                | Archived coarse brief extraction                      | Legacy only                     |
| Legacy S9 evidence pass                           | `legacy_s9_evidence_pass_current`                            | `src/server/evidence-pass.server.ts`                                                | Archived Step 1 label                                 | Legacy only                     |
| Legacy S9 single pass                             | `legacy_s9_single_pass_analysis_current`                     | `src/server/process-take.server.ts`                                                 | Archived single-pass label                            | Legacy only                     |
| Legacy S9 report polish                           | `legacy_s9_two_step_report_polish_current`                   | `src/server/report-polish.server.ts`                                                | Archived Step 2 label                                 | Legacy only                     |
| Internal dimensions                               | `legacy_internal_dimension_prompt_fragments`                 | `src/server/dimensions/*`                                                           | Flag-gated internal dimension capture                 | Legacy/internal only            |
| Comparison model prompt                           | `no_active_s10_comparison_model_prompt`                      | `src/server/v3/s6-variance-comparison.ts`                                           | Comparison                                            | No active model prompt in S10.1 |

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

## S10.4 Brief Achievement Matrix

The active Step 2 and single-pass prompts embed `s10_brief_achievement_matrix_v1`. Before writing any score, verdict, chip, readiness language, submission risk or fix hierarchy, the AI must produce `brief_achievement_matrix` by comparing each S10 `BriefRequirement` with S10.3 `ObservedTapeSequence[]`, `ComponentVerification[]` and `MediaObservationSummary`.

The matrix contains aggregate status (`overall_status`, `mandatory_status`, `readiness_impact`) plus one `RequirementAchievementResult` per requirement. Each result records observed status, completion status, achievement status, evidence summary, submission impact, fix category, recommended action, confidence, linked S10.3 ids and `cannot_infer_from_brief_only: true`.

S10.4 rules:

- brief text defines the requirement but cannot prove achievement;
- `ComponentVerification` is the source for observed achievement;
- `raw_report.brief_adherence_breakdown`, `material_compliance`, `detected_components`, score traces and previous report prose are diagnostic only;
- mandatory material that is absent, partial, cut off, uncertain or not assessable prevents `overall_status=achieved`;
- unsupported admin/process requirements become `final_check` or `not_assessable`, not performance criticism;
- continuous-video technical evidence remains separate from complete required-material package evidence.

## S10.5 Readiness Recommendation And Score Semantics

The active Step 2 and single-pass prompts embed `s10_readiness_score_semantics_v1`. After `brief_achievement_matrix`, the AI must produce `readiness_score_judgement` that separates `performance_quality_score`, `brief_completion_score` and `overall_submission_readiness_score`.

The visible overall score represents submission readiness. Category/component scores may still recognise strong observed performance where supported. Mandatory material/package blockers can override readiness language and visible overall readiness. Preferred, optional and final-check gaps do not automatically cap readiness unless the AI explains concrete submission-readiness impact.

S10.5 rules:

- S10.4 is authoritative for brief completion;
- high audio, framing or observed-song scores may remain high when supported;
- absent Side 1 means acting-scene score is unavailable or not assessable;
- partial or cut-off song may be scored only for the observed portion;
- `submit_if_deadline_is_close` is not allowed for assessable missing/incomplete mandatory material unless framed as emergency/partial submission outside normal readiness;
- every cap/downshift emits a `score_contradiction_warning` with original value, capped value, matrix reason, affected field and source.

## S10.6 Fix Hierarchy And Next-Action Plan

The active Step 2 and single-pass prompts embed `s10_fix_hierarchy_next_action_v1`. After `brief_achievement_matrix` and `readiness_score_judgement`, the AI must produce authoritative `s10_fix_hierarchy` and `s10_next_action_plan`.

S10.6 rules:

- matrix before fixes;
- readiness before action plan;
- mandatory material/package blockers outrank polish, diction, character detail, file naming and admin-only final checks;
- supported positives may appear in preserve/do-not-overfix, but cannot reduce blocker urgency;
- `fix_first`, `priority_fixes`, `improvements`, `next_take_plan` and `coaching_drills` are compatibility projections only until S10.10 rendering;
- `raw_report.fix_first`, `raw_report.improvements`, `raw_report.next_take_plan`, `raw_report.block_reasons`, legacy coaching drills and previous report prose are diagnostic only;
- legacy actions may only be used when re-authored through S10 evidence and source-tracked;
- action contradiction warnings are internal diagnostics only;
- missing or generic S10.6 output becomes a specific limitation, never generic fallback copy.

## S10.7 Strengths, Preserve And Professional Critique

The active Step 2 and single-pass prompts embed `s10_strengths_preserve_professional_critique_v1`. After `brief_achievement_matrix`, `readiness_score_judgement`, `s10_fix_hierarchy` and `s10_next_action_plan`, the AI must produce authoritative `s10_professional_critique`.

S10.7 is not the detailed technique-library slice; S10.8 will deepen acting/vocal/movement/MT technique commentary. S10.7 produces broad evidence-grounded strengths, preserve guidance, do-not-overfix notes, professional nuance and limitations.

S10.7 rules:

- component verification before strengths;
- absent or unverified components produce limitations, not praise;
- missing Side 1 prevents acting-scene strengths such as "naturalistic acting";
- partial, cut-off or uncertain song strengths must say observed portion only;
- incomplete packages reject "correct material", "complete package" and "single-file submission as requested";
- strong-complete reports must include one specific strength, one preserve item, one do-not-overfix item and one professional nuance note, or a specific limitation explaining why not;
- incomplete reports may include supported positives, but they must not obscure the fix-first blocker;
- legacy strengths, category notes, category rationale, presentation notes, coaching drills, technique traces and prior prose are diagnostic only;
- compatibility projections into `strengths`, `category_notes`, `category_rationale`, `presentation_notes` and `coaching_drills` are lossy in favour of truth until S10.10 rendering.

## S10.8 Technique-Library Commentary

The active Step 2 and single-pass prompts embed `s10_technique_library_commentary_v1`. After `s10_professional_critique`, the AI must produce authoritative `s10_technique_commentary` for acting, vocal/singing, movement/dance, musical-theatre package integration, self-tape presentation and commercial/screen task where verified evidence supports it.

S10.8 may consume timestamp refs where available, but S10.9 owns first-class timestamped/time-banded commentary.

S10.8 source-of-truth hierarchy:

1. S10.3 `ComponentVerification` determines whether a component exists.
2. S10.4 `BriefAchievementMatrix` determines whether the requirement was achieved.
3. S10.7 `S10ProfessionalCritique` provides evidence-grounded professional observations.
4. S10.8 AI authors technique commentary from those verified inputs.
5. Legacy `TechniqueObservationTrace`, raw report prose and coaching drills are diagnostic only.

S10.8 rules:

- verified component evidence before technique commentary;
- technique commentary is attempted where verified evidence exists;
- required-but-missing components become `not_assessable` or limited, not `not_applicable`;
- `not_applicable` is only for areas not required by the brief and not visible in the tape;
- present-but-incomplete components become `partially_assessable`, and notes must be observed-portion-only;
- missing required Side 1 prevents acting-scene technique praise;
- partial, cut-off or completion-uncertain song commentary must not imply complete song/package readiness;
- musical-theatre package commentary must state the package is incomplete when required components are missing or incomplete;
- self-tape presentation may use verified audio/framing evidence;
- `public_technique_authority_status` and `public_technique_authority_blocked` must not suppress ordinary authenticated technique commentary;
- only genuinely high-risk claims are suppressed or rewritten: medical/vocal-health diagnosis, body/appearance judgement, protected-characteristic inference, guaranteed casting/job outcome and unsupported certainty;
- legacy technique trace entries with `source_family=legacy_adapter` or `evidence_status=missing_evidence` cannot populate S10 technique commentary;
- compatibility projections into `category_notes`, `category_rationale`, `presentation_notes`, `coaching_drills` and technique-related `improvements` are safe subsets only until S10.10 rendering.

## S10.9 Timestamped And Time-Banded Commentary

The active Step 2 and single-pass prompts embed `s10_timestamped_commentary_v1`. After `s10_technique_commentary`, the AI must produce authoritative `s10_timestamped_commentary` from verified S10 evidence. The existing Step 1 `timestamped_notes` lock remains in place: Step 2 must not directly bypass it. S10.9 validates the richer structured module and then projects only safe notes into legacy `timestamped_notes`.

S10.9 source hierarchy:

1. S10.3 `ObservedTapeSequence` with supported start/end times.
2. Step 1 `timestamped_evidence` where the source is media-observed.
3. Evidence anchors with genuine `timestamp` or `timestamp_range`.
4. Provider-output timestamp/time-band explicitly tied to observed component evidence.
5. Approximate or order-only commentary when timing support is insufficient.
6. No projection when the note only comes from `raw_report.timestamped_notes`.

S10.9 rules:

- `s10_timestamped_commentary` is authoritative; legacy `timestamped_notes` is a projection only;
- timestamped commentary cannot prove that a component exists;
- exact timestamps must have a trusted timing source;
- missing components may produce `display_label="Not observed"` notes without fake timestamps;
- order-only or unavailable timing must not be forced into fake timecodes;
- absent Side 1 prevents acting-scene timestamped strengths and eyeline/scene-partner notes;
- partial, cut-off or uncertain song notes must be observed-portion-only and must not imply a complete song/package;
- raw/prior `timestamped_notes` cannot survive by text copy;
- existing route/PDF output may change only through validated compatibility projection until S10.10.

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

| Report module              | AI question                                                                                                                | Structured output field                                                                                 | UI destination                            | Completeness rule                              | Repair prompt         | Deterministic inputs allowed                                                                            | Code-generated content forbidden               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| overall readiness          | After brief achievement is known, what readiness decision and score should the performer see?                              | `overall_score`, `casting_headline`, `submission_verdict`                                               | Overall readiness header                  | complete                                       | contradictory repair  | brief, level, take metadata, duration, upload identity, known comparison take IDs, operator assumptions | readiness rationale, score explanation         |
| score/chip                 | What score band and score-to-language explanation matches verified brief achievement?                                      | `overall_score`, `scores`, `category_rationale`                                                         | Score chip and category score bars        | complete                                       | contradictory repair  | brief, level, take metadata, duration                                                                   | score explanation                              |
| verdict                    | Should the performer submit, review carefully, submit only if deadline is close, or retake if possible?                    | `verdict_final`, `casting_insight`, `at_risk`                                                           | Verdict header and risk panel             | complete                                       | contradictory repair  | brief, level, take metadata, operator assumptions                                                       | readiness rationale                            |
| prioritised fixes          | What are the most submission-impactful fixes, ordered by urgency and source category?                                      | `priority_fixes`                                                                                        | Prioritised fixes section                 | complete                                       | thin repair           | brief, level, observed evidence                                                                         | professional fixes                             |
| fix-first                  | What is the single first action before submitting or retaking?                                                             | `fix_first`                                                                                             | Fix this first fallback section           | complete                                       | generic repair        | brief, level, observed evidence                                                                         | professional fixes                             |
| why this score             | For each visible score, what works, why is it not full score, and what closes the gap?                                     | `category_rationale`                                                                                    | Why this score section                    | complete                                       | thin repair           | brief, level, observed evidence                                                                         | score explanation                              |
| category scores            | How should technical, audio, vocal, acting, brief adherence and presentation be scored after component verification?       | `scores`, `category_notes`                                                                              | Category scores section                   | complete                                       | contradictory repair  | brief, level, observed evidence                                                                         | score explanation                              |
| component breakdown        | Which components were actually observed, and are they present, absent, partial, cut off, uncertain or not assessable?      | `observed_tape_sequence`, `component_verifications`, `media_observation_summary`, `detected_components` | Component breakdown section               | complete                                       | unsupported repair    | brief, duration, observed evidence                                                                      | observed component presence                    |
| brief achievement          | For every requirement, what was achieved, mostly achieved, partly achieved, missed, final-check-only or not assessable?    | `brief_achievement_matrix`, `brief_adherence_breakdown`, `submission_risk_flags`                        | Readiness/risk/category sections          | complete                                       | contradictory repair  | supplied brief, level, observed evidence                                                                | readiness rationale, component presence        |
| strengths                  | What specific strengths are supported by verified S10 component evidence?                                                  | `s10_professional_critique`, `strengths`                                                                | Strengths section                         | complete                                       | generic repair        | observed evidence, level                                                                                | professional strengths                         |
| preserve / do-not-overfix  | What should be preserved, and what should not be over-fixed?                                                               | `s10_professional_critique`, `next_take_plan`, `coaching_drills`, `category_rationale`                  | Next steps / why this score               | thin allowed only if not assessable            | thin repair           | observed evidence, level                                                                                | optional polish, strengths                     |
| improvements               | What concrete improvements are grounded in the observed tape and selected level?                                           | `improvements`                                                                                          | Improvements section                      | complete                                       | generic repair        | observed evidence, level                                                                                | professional fixes                             |
| technique commentary       | What acting, vocal, movement, MT package or presentation technique commentary is visible, and what is not assessable?      | `s10_technique_commentary`, `category_rationale`, `category_notes`, `improvements`                      | Why this score / category / improvements  | thin allowed only with limitation              | not-assessable repair | observed evidence, level                                                                                | technique notes                                |
| timestamped notes          | What timestamped or time-banded moments evidence strengths, fixes, missing components, cut-offs or technical observations? | `s10_timestamped_commentary`, `timestamped_notes`                                                       | Timestamped notes section                 | thin allowed when exact timestamps unavailable | missing repair        | media duration, Step 1 timestamped evidence                                                             | component presence, strengths, fake timestamps |
| next action                | What finite next-take plan or submit checklist should the performer follow?                                                | `next_take_plan`, `coaching_drills`                                                                     | Next steps section                        | complete                                       | generic repair        | brief, level, observed evidence                                                                         | optional polish, readiness rationale           |
| submission risk            | Which brief, package, technical or admin issues could block or reduce readiness?                                           | `submission_risk_flags`, `casting_risk_explanations`, `at_risk`                                         | Submission risk section                   | complete                                       | contradictory repair  | brief, take metadata, upload identity                                                                   | readiness rationale                            |
| role fit                   | Where brief context is sufficient, how does performance serve role function and tone?                                      | `role_fit_notes`, `role_fit_modifier`, `role_fit_confidence`                                            | Role fit section                          | not_assessable allowed                         | not-assessable repair | supplied brief, selected level                                                                          | comparison judgement                           |
| presentation notes         | What practical presentation notes are supported by camera/audio evidence?                                                  | `presentation_notes`                                                                                    | Presentation notes section                | thin allowed                                   | unsupported repair    | technical signals, duration                                                                             | optional polish                                |
| not-assessable limitations | What cannot be assessed, what is affected, and what check resolves it?                                                     | `confidence_reason`, `category_notes`, `improvements`                                                   | Reliability, category notes, improvements | not_assessable                                 | not-assessable repair | brief, level, duration, take metadata                                                                   | technique notes, score explanation             |

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
