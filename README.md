# TapeCoach Requirements — Redesigned Evaluation and Report System

**Document status:** controlling replacement README for the redesigned TapeCoach evaluation and report system.  
**Purpose:** define the requirements that ChatGPT / implementation agents must follow when analysing self-tapes, calibrating scores, producing reports, generating comparisons and validating output quality.  
**Supersedes:** the current README and any earlier report design notes.  
**Language:** UK English.

## Source hierarchy and delivery documents

`README.md` is the controlling source for TapeCoach product behaviour,
report requirements, scoring rules, QA artefacts, validator gates, public/private
boundaries and release decisions.

`tapecoach-v3-parallel-delivery-approach.md` is a delivery overlay.
It may define workstreams, sequencing, dependencies, acceptance evidence and
parallel execution rules. It does not override this README.

`tapecoach-v3-roadmap.md`, if present, is a planning index only.
It must not introduce requirements, public-output permissions or release gates
that are not already present in this README.

When implementation agents work on a task, they should use:
1. this README;
2. the relevant delivery slice;
3. the specific issue / prompt / acceptance gate for the current task.

Do not load unrelated roadmap sections into implementation tasks unless they are
needed for dependency or gate reasoning.

---

## 0. Executive summary

TapeCoach evaluates whether a performer’s self-tape is ready to submit for the selected performer level, audition type and optional casting brief / task.

The central product questions are:

> Is this tape good enough to submit for this performer’s selected level, audition type and brief / task?  
> Has the performer achieved the brief?  
> If not, what should the performer fix, prioritise or focus on?

Every report must help the performer understand:

1. whether the tape is ready to submit at the selected level;
2. whether the supplied brief / task has been achieved and, if not, how much has been achieved;
3. why that verdict was reached;
4. what to fix, prioritise or focus on;
5. what is already working and should be preserved;
6. what the gap is to the selected level;
7. what to do in the next take;
8. what could not be assessed reliably.

The judgement should combine UK casting-director, agent, acting coach, vocal / singing coach, movement / dance coach and commercial / screen-task perspectives.

The redesigned system must be evidence-led, level-relative, component-aware, audition-type-aware, brief-aware where a brief exists, timestamp-grounded where time-based evidence is available, practical, supportive but honest, and safe from appearance, body, protected-characteristic, marketability, bookability or castability judgement.

This document defines the target redesigned behaviour.

---

## Current internal QA / S9 implementation state

The current S9 internal QA Storage validation state is:

- live Storage validation has passed for current internal QA bundle emission;
- the current live Storage validation target is 12 files per take when TechniqueObservationTrace and ScoreTrace source data exists;
- `manifest.json` and `qa/acceptance_metrics.json` are required bundle members;
- internal QA bundle emission is not the same as Level 2 acceptance;
- Level 2 remains `not_accepted` until all required evidence, trace and proof gates pass;
- production-safe, public-scoring and public-technique-authority gates remain blocked;
- comparison evidence remains missing;
- further trace and proof artefacts are required before Level 2 can be accepted.

The current 12-file analysis-run Storage bundle (when TechniqueObservationTrace and ScoreTrace source data exists) is:

```text
inputs/input_record.json
inputs/submission.json
inputs/take.json
reports/raw_report.json
resolver/resolver_output.json
resolver/TruthStateMap.json
traces/EvidenceAnchors.json
traces/PublicClaimTrace.json
traces/TechniqueObservationTrace.json
traces/ScoreTrace.json
manifest.json
qa/acceptance_metrics.json
```

A run that emits only the first eight files without `manifest.json` and `qa/acceptance_metrics.json` is not a passing Storage validation.

Current S9 metrics may correctly show:

```text
evidence_anchor_trace_status: emitted
public_claim_trace_status: emitted
qa_acceptance_metrics: emitted
level2_status: not_accepted
```

That state is valid because some emitted first-pass traces are still not sufficient Level 2 proof.

### Current EvidenceAnchors / PublicClaimTrace status

`EvidenceAnchors.json` and `PublicClaimTrace.json` are emitted in first-pass form.

When these artefacts are derived from `raw_report` or report-snapshot fields:

- their source classification is `legacy_adapter`;
- they are internal QA/debug artefacts only;
- they do not satisfy v3 evidence gates;
- they do not satisfy Level 2 spine requirements;
- they must not be treated as `real_runtime_v3` proof.

Legacy-derived evidence anchors are currently based on `raw_report` timestamped notes and carry `cannot_satisfy_v3_gate: true`. Legacy-derived public claim traces may identify unsupported, overclaim or public-scoring risks, but they cannot satisfy the public-claim gate by themselves.

Level 2 requires real runtime evidence or equivalent `real_runtime_v3` linkage, not legacy report snapshots.

`EvidenceAnchors.json`, `PublicClaimTrace.json`, `TechniqueObservationTrace.json` and `ScoreTrace.json` are emitted in first-pass internal form.

These emitted first-pass traces remain legacy/report-snapshot derived for current internal QA, so they remain emitted-but-insufficient for Level 2 gate satisfaction until real runtime evidence linkage and proof artefacts are available.

`ScoreTrace.json` is emitted from explicit score/calibration fields only; it must not be treated as public overall-readiness score approval.

### Current QA environment configuration

Expected deployed QA configuration is:

```text
INTERNAL_COMPARISON_TRIGGER_ENABLED=true
QA_ARTIFACT_SINK=storage
QA_ARTIFACT_STORAGE_BUCKET=qa-artifacts
QA_ARTIFACT_LOG_FALLBACK=true
V3_QA_ARTIFACTS_ENABLED=true
INTERNAL_QA_EMIT=true
TWO_STEP_ANALYSIS_ENABLED=true
```

Do not print or expose secret values. If a source/Codex agent cannot inspect deployed environment variables directly, it should report `operator-verification-required` rather than blocking implementation.

### Current public scoring decision

Overall readiness score exposure remains blocked from public scoring output unless separately approved.

Raw overall scores may exist internally for calibration, QA metrics, traces and report-snapshot analysis. They must not be treated as approved public output.

Discipline, category or attribute scores are governed separately from overall readiness score exposure. They may be used where product requirements allow, but they still require evidence, level-relative calibration and safe public wording.

### Current Storage root and provenance decisions

Canonical Storage object keys use the flat analysis-run root:

```text
take-[id]/analysis-take-[id]/
```

QA artefact root metadata should use this flat root shape. The older descriptive shape `qa-artifacts/takes/...` must not be treated as the canonical Storage object key root.

Deployment provenance should use safe non-secret build or deployment environment variables where available. If safe provenance is unavailable, fields such as `build_commit_sha` and `deployment_revision` may remain `unknown`; that must not block artefact emission.

`QA_PROJECT_ROOT` and `PROJECT_ROOT` should be honoured as explicit provenance roots when they are valid. README/source-scope provenance must not claim root README presence unless `README.md` actually exists under the resolved root.

### Current Level 2 blockers

Level 2 remains blocked while any required Level 2 artefacts or proof gates are missing. Current known missing / blocked families include:

- `validator_trace`;
- `gate_trace`;
- `ModelRunTrace`;
- comparison runtime artefacts;
- same-video repeatability, comparison suppression and route-variance traces;
- real runtime technique-observation evidence linkage (TechniqueObservationTrace currently emitted but insufficient for gate satisfaction);
- parity artefacts;
- no-export proof artefacts;
- production-safe proof;
- public-scoring proof;
- public-technique-authority proof.

Do not mark Level 2 accepted while required artefacts are missing, comparison evidence is missing, emitted artefacts remain insufficient, public/production gates are blocked, or the v3 spine relies on `legacy_adapter` artefacts.

---

## 1. Non-negotiable product requirements

TapeCoach must:

- judge submission readiness for the selected performer level and task;
- use the selected level as a scoring standard, not only as a wording preference;
- treat Professional performers as being held to the highest standard;
- allow every non-Professional level to achieve 90+ for excellent work relative to that level;
- explain high scores with sharper marginal detail, not less feedback;
- identify the highest-impact next corrections through `priority_fixes[]`;
- translate supplied briefs into itemised, actionable requirements;
- classify each brief requirement as mandatory, preferred, optional, style-context, material instruction, technical/setup, admin/process or ambiguous;
- judge how well each assessable brief requirement has been achieved;
- reflect missing or partially achieved mandatory brief requirements in readiness, brief adherence, priority fixes and action plan;
- distinguish not achieved from not assessable;
- provide meaningful strengths, improvements and action steps without arbitrary item caps;
- provide duration-scaled timestamped evidence without invented or padded timestamps;
- explain category and component judgements with discipline-specific rationale;
- separate assessability limits from performance criticism;
- avoid unsupported inference, generic praise and generic criticism;
- avoid expensive-equipment, paid-coaching and resource-biased advice;
- use UK English throughout.

TapeCoach must not:

- guarantee recalls, bookings, jobs, employment, castability, bookability or market outcome;
- infer role fit, product fit, brand fit or casting suitability without a supplied brief or task context;
- treat studio polish, paid readers, paid editing, expensive microphones or professional filming as performance merit;
- penalise modest rooms, phones, domestic capture or simple equipment unless they materially limit assessability;
- infer protected traits, appearance, body type, class, disability, access need, gender, race, age or marketability;
- invent timestamps, brief requirements, material context, style claims or technique labels;
- treat a supplied brief requirement as achieved unless the tape evidence supports it;
- treat every brief phrase as a hard requirement without obligation classification;
- mark down performance for a requirement that could not be assessed because of capture, framing, audio, edit or missing material;
- truncate useful feedback to meet arbitrary item counts.

---

## 2. Core report structure

The redesigned public-facing report should use the following core sections:

1. Readiness statement
2. Why this verdict
3. Prioritised fixes
4. Strengths to preserve
5. Improvements
6. Gap to selected level
7. Action plan
8. Component breakdown
9. Timestamped evidence
10. Assessability and limitations
11. Brief achievement and task fit where supplied
12. Technical / setup signals where relevant
13. Technique / skill feedback where evidence supports it
14. Repertoire / show / number context where evidence and source gates support it
15. Comparison summary where evidence supports it

The most important decision, brief-achievement status and highest-impact priorities should appear before detailed evidence, technical notes or secondary refinements.

### 2.1 Public report data shape

The report model should be structured around these fields or close equivalents:

```ts
type PublicReport = {
  readiness: ReadinessSummary;
  selected_level: PerformerLevel;
  audition_type: AuditionType;
  brief_context?: BriefContextSummary;
  brief_achievement?: BriefAchievementSummary;
  brief_requirements?: BriefRequirement[];
  feedback_reliability: "high" | "medium" | "low";
  why_this_verdict: VerdictRationale;
  priority_fixes: PriorityFix[];
  strengths: Strength[];
  improvements: Improvement[];
  gap_to_selected_level: LevelGapSummary;
  action_plan: ActionPlanGroup[];
  component_breakdown: ComponentBreakdown[];
  category_rationale?: CategoryRationale[];
  timestamped_notes: TimestampedNote[];
  assessability_notes: AssessabilityNote[];
  technical_setup_signals?: TechnicalSetupSignal[];
  technique_skill_feedback?: TechniqueSkillFeedback[];
  repertoire_context_feedback?: RepertoireContextFeedback[];
  comparison_summary?: ComparisonSummary;
  safety_public_notes?: string[];
};
```

Do not create a separate single-item fix field. `priority_fixes[]` is the sole prioritised-fix structure.

### 2.2 Public section labels

Use these public labels consistently:

| Data field | Public label |
|---|---|
| `readiness` | Readiness |
| `why_this_verdict` | Why this verdict |
| `priority_fixes[]` | Prioritised fixes |
| `strengths[]` | Strengths to preserve |
| `improvements[]` | Improvements |
| `gap_to_selected_level` | Gap to selected level |
| `action_plan[]` | Action plan |
| `component_breakdown[]` | Component breakdown |
| `timestamped_notes[]` | Timestamped evidence |
| `assessability_notes[]` | Assessability and limitations |
| `brief_achievement` | Brief achievement |
| `technique_skill_feedback[]` | Technique / skill feedback |
| `repertoire_context_feedback[]` | Repertoire / show / number context |

Use `Action plan` as the canonical public label.

### 2.3 Brief achievement and requirement itemisation

Where a brief, casting note, audition instruction, task, show / number reference, material requirement or technical instruction is supplied, TapeCoach must assess whether the performer has achieved it.

The system must translate the brief into itemised, actionable requirements and classify each item before judging performance against it.

```ts
type BriefRequirement = {
  requirement_id: string;
  source_text: string;

  category:
    | "mandatory"
    | "preferred"
    | "optional"
    | "style_context"
    | "material_instruction"
    | "technical_setup"
    | "admin_process"
    | "ambiguous";

  requirement_type:
    | "technique"
    | "skill"
    | "song"
    | "dance"
    | "scene"
    | "monologue"
    | "copy"
    | "role_context"
    | "show_number"
    | "format"
    | "duration"
    | "framing"
    | "submission_process";

  mapped_technique_ids?: string[];
  mapped_repertoire_ids?: string[];
  selected_level_standard?: string;

  achievement_status:
    | "achieved"
    | "mostly_achieved"
    | "partially_achieved"
    | "not_achieved"
    | "not_assessable"
    | "not_applicable";

  achievement_score_band?: "high" | "medium" | "low" | "blocked";
  evidence_anchor_ids: string[];
  assessability_limits: string[];

  readiness_impact:
    | "supports_submission"
    | "minor_gap"
    | "material_gap"
    | "retake_recommended"
    | "submission_blocker"
    | "not_assessable";
};
```

Brief-achievement rules:

- If a mandatory brief requirement is assessable and not achieved, readiness must be reduced.
- If a mandatory brief requirement cannot be assessed because of framing, audio, edit, visibility or missing material, the system must record an assessability limitation before treating it as a performance failure.
- A supplied brief may authorise referencing the requested technique, skill, show, number, task or material requirement as brief context.
- A supplied brief does not automatically authorise claiming that the technique, skill or requirement was demonstrated, scored highly or publicly named as observed.
- Not achieved and not assessable are different states and must not be collapsed.

Example:

```text
Brief requirement:
“Perform a grand battement during the dance section.”

System should:
1. map “grand battement” to the technique library;
2. check whether the tape shows it;
3. check whether it is assessable;
4. judge execution against selected level;
5. mark brief achievement;
6. reflect that in readiness, priority fixes and action plan.
```

If mandatory and assessable but absent:

```text
Brief achievement: not achieved.
Readiness impact: material gap or submission blocker.
```

If mandatory but not visible due to framing:

```text
Brief achievement: not assessable.
Readiness impact: assessability blocker.
Next-take action: reframe full body / relevant technique pathway.
```

If present but weak for selected level:

```text
Brief achievement: partially achieved.
Readiness impact: material gap.
Priority fix: improve the specific technique characteristic.
```

---

## 3. Performer levels and level-relative scoring

### 3.1 Core scoring principle

Scoring is level-relative.

A score, score band or readiness descriptor must mean “how strong this tape is for the selected performer level and task”, not “how strong this tape is against every possible performer standard”.

The selected performer level changes the actual scoring standard. It is not just a tone or language setting.

A Professional performer must be held to a higher standard than every level below Professional. The bar to enter each score band rises as the selected level rises.

### 3.2 Performer levels

All performer levels below Professional can achieve a 90+ score for excellent work relative to that selected level.

| Performer level | Standard | 90+ rule |
|---|---|---|
| Learning / School | Clear preparation, intelligibility, basic task response, early craft evidence and useful next-step potential. | 90+ is achievable for excellent Learning / School work. It must not be described as Professional-standard unless the evidence independently supports Professional criteria. |
| Amateur / Community | Clear, prepared, task-relevant work that communicates reliably in a community or lower-stakes audition context. | 90+ is achievable for excellent Amateur / Community work. It means exceptional for that level, not automatically competitive at Professional level. |
| Emerging / Training | Credible craft, specific choices, reliable assessability and readiness for training, early-career or semi-professional scrutiny. | 90+ is achievable for excellent Emerging / Training work. It means the tape is strong against that higher developmental bar, not automatically top-tier Professional evidence. |
| Professional | Competitive discipline-specific evidence for the brief, context and market-facing submission standard. Clean capture alone is insufficient. | 90+ requires genuinely competitive Professional evidence. 95+ requires standout marginal evidence. 98–100 should be rare and reserved for near-flawless evidence at Professional standard. |

### 3.3 Same tape, different selected level

The same tape may receive different internal scores when evaluated at different selected levels. This is correct behaviour.

Example:

| Observed tape quality | Learning / School | Amateur / Community | Emerging / Training | Professional |
|---|---|---|---|---|
| Clear, prepared, readable, basic task fit | Could be high if excellent for a learning context | Could be strong | May expose craft limits | Usually not 90+ |
| Specific choices with some inconsistency | Could be exceptional | Could be 90+ | Could be strong / near-exceptional | May still need clearer competitive evidence |
| Strong craft, clear task fit, limited correctable issues | Benchmark-level for lower level | Standout for level | Could be 90+ | Strong, but still assessed against Professional marginal detail |
| Integrated, stable, discipline-specific, evidence-rich work | Benchmark-level | Benchmark-level | Standout / benchmark-level | May justify Professional 90+ or higher |

### 3.4 High-score meaning

For every selected level:

| Score band | Meaning |
|---|---|
| 90–94 | Exceptional for the selected level. |
| 95–97 | Standout or rare for the selected level. |
| 98–100 | Benchmark-level evidence for the selected level. |

These bands are not absolute across levels.

A 92 at Amateur / Community and a 92 at Professional are not equivalent. The Professional 92 must be earned against a higher technical and performance bar.

### 3.5 Professional strictness

For Professional level:

- competent is not enough for 90+;
- clean recording is not enough for 90+;
- confident energy is not enough for 90+;
- technically readable work is not enough for 90+;
- 90+ requires competitive, discipline-specific, evidence-rich work;
- 95+ requires standout marginal evidence;
- 98–100 should be rare and should not be awarded where meaningful correctable category-level notes remain.

Professional reports must explicitly articulate the difference between:

- ready and competitive;
- strong and standout;
- technically secure and artistically compelling;
- visible execution and specialist precision;
- good submission quality and job-winning evidence.

### 3.6 Public score and readiness language

Raw numerical scores may be used internally for calibration, traces, quality control and comparison logic.

Public reports should use qualitative readiness language by default unless public raw score exposure is separately approved.

Overall readiness score exposure remains blocked from public scoring output unless separately approved. Discipline, category or attribute score context is governed separately and must not be conflated with public overall readiness score exposure.

If numerical scores are displayed in any surface, the same level-relative rules apply.

Public language must always make the selected-level standard clear:

```text
Exceptional for Amateur / Community level.
Strong for Emerging / Training level.
Ready to submit at Professional level, with manageable risk.
Submit-ready for Professional level, but not yet standout.
```

Do not say or imply:

```text
This is a Professional-standard tape because it scored 90 at Amateur / Community.
This is objectively a 92-quality performance in all contexts.
This is perfect because the score is high.
```

---

## 4. Readiness model

The readiness statement must combine:

- selected performer level;
- audition type;
- supplied brief or task;
- itemised brief achievement;
- essential component coverage;
- observable performance quality;
- assessability;
- technical / setup limitations;
- safety and fairness gates;
- comparison evidence where relevant.

Public readiness descriptors should include the selected-level context:

| Readiness state | Public wording pattern |
|---|---|
| Not assessable | “Not enough reliable evidence to judge this fairly.” |
| Not ready yet | “Not ready to submit at the selected level yet.” |
| Another take recommended | “Worth another take before submitting.” |
| Borderline / exposed | “Close, but still exposed for the selected level.” |
| Submit-ready | “Ready to submit at the selected level, with manageable risk.” |
| Strong for selected level | “Strong for the selected level.” |
| Exceptional for selected level | “Exceptional for the selected level.” |
| Standout for selected level | “A standout take for the selected level.” |
| Benchmark-level evidence | “Benchmark-level evidence for the selected level.” |

Use “world-class” only if the evidence, performer level, component coverage, specialist gates and expert / benchmark validation justify it. In normal output, prefer “benchmark-level evidence for the selected level”.

---

## 5. Evidence and claim discipline

Every meaningful claim must be grounded in at least one of:

- observed video evidence;
- observed audio evidence;
- supplied brief or sides;
- supplied material / copy / role / song / dance task;
- explicit user input;
- validated timestamp anchor;
- component evidence;
- category rationale;
- assessability limitation;
- established professional standard used cautiously.

Claims must not rely on:

- model confidence alone;
- invented casting context;
- invented role, product, brand, buyer or world;
- inferred personality;
- appearance, body or marketability inference;
- production polish as talent evidence;
- live-room behaviour not shown on tape.

### 5.1 Assessability before performance criticism

Sight, sound, framing, continuity, accompaniment balance, lyric audibility, copy audibility and full-body visibility affect feedback reliability. They do not automatically prove weak performance.

Use assessability language before performance criticism where evidence is limited:

```text
Some lyric detail is hard to assess because the track sits over the voice.
Lower-body organisation is not fully assessable from this frame.
The reader relationship is partly hard to assess because the cue line is not audible.
```

Do not convert capture issues into character, skill or professionalism faults.

### 5.2 No-brief restraint

If no brief is supplied, the system must not invent:

- role;
- brand;
- product;
- buyer;
- audience;
- campaign world;
- show style;
- casting fit;
- exact professional target;
- subtype certainty;
- time limit;
- compliance rule.

In no-brief mode, use general submission standards and observable task evidence only.

### 5.3 Fixed-material restraint

If material is fixed:

- do not suggest alternative material;
- do not imply that a different song, monologue, dance routine, copy or scene would solve the tape;
- keep advice to delivery, readability, task clarity, preparation or next-take execution;
- label rehearsal-only drills clearly if included.

### 5.4 Live-room and recall boundaries

A finished self-tape does not prove:

- direction response;
- room chemistry;
- recall conversion;
- campaign-pressure flexibility;
- stamina across a full session;
- group-work behaviour;
- cold-read ability;
- workshop flexibility;
- taking direction well;
- live-room adaptability.

Only make those claims if direct evidence is shown.

### 5.5 Accessibility and non-deficit handling

Access needs, disability, neurodiversity, visual impairment, Deaf / disabled access, hearing difference, speech difference, accent, gender-diverse voice, mobility difference, convalescence and adaptation must be treated as fairness, process or assessability context, not as deficits.

Blocked framing includes:

```text
despite your disability
access adaptation as weakness
disability as performance deficit
body / appearance judgement
commercial look
marketability / bookability
healthy / unhealthy voice diagnosis
paid resource or studio polish as talent
```

---

## 6. Feedback volume and technical safety maximums

No section should impose a fixed item count where doing so sacrifices useful insight.

TapeCoach should provide as many helpful, relevant, specific and actionable notes as the tape warrants, without padding or arbitrary truncation.

Technical maxima are safety limits only. They prevent runaway output. They are not required counts and must not become normal product caps.

| Field | Soft target | Technical maximum |
|---|---:|---:|
| `strengths[]` | 3–8 | 12 |
| `improvements[]` | 3–10 | 15 |
| `priority_fixes[]` | 2–5 | 8 |
| `action_plan[]` | 4–10 | 15 |
| `timestamped_notes[]` | duration-scaled | 36 |

Rules:

- Do not pad to reach the soft target.
- Do not cap useful feedback at three items.
- Do not slice timestamped notes to eight.
- Return fewer items where fewer genuinely useful items exist.
- Return more items where more distinct, actionable, evidence-led items exist, up to the technical maximum.

---

## 7. Prioritised fixes

Use:

```ts
type PriorityFix = {
  priority_rank: number;
  type:
    | "retake_critical"
    | "quick_win"
    | "critical_gap"
    | "assessability_blocker"
    | "high_impact_refinement";
  title: string;
  evidence_summary: string;
  why_it_matters: string;
  action: string;
  linked_components?: string[];
  linked_categories?: string[];
  timestamp_refs?: string[];
};
```

`priority_fixes[]` must be a prioritised shortlist, not a single item.

It should include, where supported by evidence:

- the single most urgent correction;
- quick wins;
- critical gaps;
- assessability blockers;
- low-effort / high-impact changes;
- essential retake corrections;
- discipline-specific refinements.

The first item must be the highest-impact next correction.

Bad:

```text
Be more confident.
Improve technique.
Give it more energy.
```

Good:

```text
Clarify the dynamic contrast between the accented counts and the sustained phrase so the choreography reads as controlled rather than only high-energy.
```

---

## 8. Strengths to preserve

`strengths[]` must be a meaningful list of distinct strengths worth preserving.

Do not cap strengths at three.

Each strength should explain:

- what is working;
- where it is observed;
- why it matters for the selected level, audition type or brief;
- whether it should be preserved in the next take;
- which component or category it supports where relevant.

Strengths must not be generic praise. They must be anchored to observable behaviour, timestamped evidence, component evidence, brief / task fit or assessability context.

A Learning / School, Amateur / Community or Emerging / Training performer who earns 90+ should receive strengths that clearly explain why the work is excellent for that level without inflating it into Professional-standard language.

---

## 9. Improvements

`improvements[]` must be a meaningful list of actionable improvements.

Do not cap improvements at three.

Each improvement should explain:

- what needs changing;
- why it matters;
- how to change it;
- whether it is retake-critical, a quick win or a refinement;
- which component / category it relates to;
- whether it is level-specific.

Improvements must be practical and evidence-led.

Avoid:

- paid-coaching advice;
- expensive-equipment advice;
- alternative-material advice where the material is fixed;
- unsupported style or role claims;
- vague advice such as “commit more” or “be more natural”.

High scores must still generate useful improvements where meaningful improvements exist. A 95 should not receive thinner feedback than a 75.

---

## 10. Action plan

Use:

```ts
type ActionPlanGroup = {
  group:
    | "retake_critical"
    | "quick_wins"
    | "craft_refinements"
    | "rehearsal_drills"
    | "recording_setup";
  actions: ActionPlanItem[];
};
```

The action plan must synthesise useful work generated from:

- prioritised fixes;
- improvements;
- category rationale;
- component rationale;
- brief / task fit;
- assessability limitations.

It should not simply duplicate earlier sections, but every actionable improvement must be represented directly or through a clearly grouped action.

The action plan must:

- include all identified actionable improvements;
- avoid generic advice;
- avoid padded filler;
- avoid expensive-equipment advice;
- avoid paid-coaching advice;
- separate rehearsal-only drills from recorded-take changes;
- include setup notes only when setup genuinely affects assessability or brief compliance;
- link actions back to components, categories or observed evidence where possible.

If multiple improvements exist and the action plan contains only one item, validation must fail or the normaliser must expand the action plan from evidence-supported fixes and improvements.

---

## 11. Timestamped evidence

Replace fixed timestamp limits with duration-scaled timestamp depth.

Longer, more complex or more professional tapes should receive more evidence coverage, not less.

### 11.1 Duration-scaled guidance

| Tape duration | Expected useful timestamped notes, if assessable |
|---|---:|
| Under 60 seconds | 3–5 |
| 1–3 minutes | 6–10 |
| 3–5 minutes | 8–14 |
| 5–10 minutes | 12–24 |
| 10+ minutes | 18–36 |

Never exceed the technical maximum of 36.

### 11.2 Timestamp rules

Timestamped notes must:

- be chronological;
- use only valid timestamps from locked evidence;
- never invent timestamps;
- never pad;
- be useful;
- be tied to at least one category, component, strength, improvement, priority fix or action-plan item;
- cover the whole relevant tape where possible;
- avoid repeatedly timestamping the same issue unless it materially recurs.

Invalid timestamps must be dropped.

If evidence supplies fewer timestamps than the duration target, the report must not pad. It should render the available locked timestamps and record underproduction.

Suggested diagnostic fields:

```ts
type TimestampDepthDiagnostic = {
  timestamp_evidence_below_target: boolean;
  stage_where_count_was_lost?:
    | "evidence_pass_underproduced"
    | "report_generation_dropped"
    | "validation_removed"
    | "locked_field_slice";
  expected_timestamp_range: [number, number];
  actual_timestamp_count: number;
};
```

---

## 12. Category rationale and score explanation

This requirement applies to:

- internal category scores;
- displayed category scores if any;
- score bands;
- category-level readiness descriptors;
- QA traces;
- any public explanation derived from scoring.

### 12.1 Required rationale for every category below full marks

Every category below 100 must explain:

1. what is working;
2. why full score was not awarded;
3. what would close the gap;
4. whether the limitation is performance-based or assessability-based;
5. what evidence supports the judgement;
6. how the selected level affects the judgement.

Do not invent unsupported craft problems. If evidence is insufficient, say the limitation is assessability or reliability.

### 12.2 High-score rationale

For scores 90–99:

- do not treat the category as finished;
- identify the precise delta to standout work at the selected level;
- use technical, discipline-specific language;
- explain the marginal difference between strong and standout;
- give more precise feedback than a lower-scoring category, not less.

For scores 98–100:

- reserve for near-flawless evidence at the selected level;
- do not award if there are meaningful correctable notes in that category;
- require exceptional evidence, not just absence of obvious mistakes.

### 12.3 Mid and low-score rationale

For scores 70–89:

- provide clear corrective direction;
- distinguish essential corrections from refinements;
- explain what would move the category up for the selected level.

For scores below 70:

- name the assessability or performance blocker;
- provide a practical retake path;
- avoid shaming or vague criticism.

### 12.4 Professional-level requirement

For Professional level reports, include a section equivalent to:

```text
What would make this stand out
```

For every high-scoring Professional category, include the marginal improvement that separates strong work from top-tier Professional evidence.

Use discipline-specific language.

### 12.5 Non-Professional high-score requirement

For Learning / School, Amateur / Community and Emerging / Training:

- 90+ is valid for excellent work at the selected level;
- the rationale must explain why the work is excellent for that level;
- the rationale must not inflate the result into Professional-standard language;
- the rationale should still identify useful next refinements where they exist;
- the report should make clear that the score is relative to the selected level.

---

## 13. Component breakdown

The component breakdown must add information that category scores or readiness descriptors do not.

Bad:

```text
Dance — 82. High-energy dance sequence with contemporary/jazz influences.
```

Good component breakdown should explain:

- component purpose;
- style or task confidence;
- what is assessable;
- what is not assessable;
- key evidence;
- relation to brief / task;
- what drives the component judgement;
- how this component differs from category-level scoring.

Component breakdown should be especially clear for hybrid submissions. A strong supporting component must not hide a weak essential component.

---

## 14. Discipline-specific requirements

### 14.1 Musical Theatre

Musical Theatre is integrated acting, singing and, where relevant, movement / dance.

Requirements:

- Preserve acting scene and song evidence where both are present.
- Do not reduce Musical Theatre to singing-only or acting-only.
- Acting-through-song must be evidenced through lyric, thought, addressee, objective, phrase or dramatic shift.
- Vocal technique and story / style function must be distinguished.
- Scene-to-song transition must be assessed where present.
- Movement comments require visible, task-relevant movement.
- Style / subtype comments must be conditional and observable.
- Role-fit language must be brief-bounded.
- Do not use marketability, perfect-casting, bookability, recall-ready or callback-ready claims.

Timestamped Musical Theatre notes should cover, where assessable:

- acting scene evidence;
- song evidence;
- scene-to-song transition;
- acting-through-song;
- sung-vocal technique;
- story, lyric or style function;
- at least one improvement or priority-fix moment.

For high-scoring Vocal Performance, explain the marginal delta to standout through evidence such as:

- phrase intention;
- lyric specificity;
- register event where supportable;
- diction;
- dynamic shape;
- acting-through-song;
- style function.

For Acting / Performance, explain missing points through:

- beat specificity;
- objective;
- relationship target;
- transition;
- reaction;
- scene-to-song continuity.

### 14.2 Dance

Dance must be assessed with movement-specific language, not generic energy praise.

Requirements:

- Use Dance-specific labels where appropriate, such as Technique / Control, Musicality, Performance / Presence, Brief Adherence and Technical / Visibility.
- Do not show Vocal Performance unless singing is present.
- If only partial body is visible, do not make full-body technique claims.
- Treat full-body framing as assessability, not performer merit.
- Do not infer commercial dance casting fit without a supplied brief.
- Do not infer workshop adaptability, unseen-learning speed, direction response or stamina from a finished tape.
- Avoid body, physique or line-as-appearance judgements.
- Avoid “high energy” as a substitute for Dance technique.

Dance comments should cover, where observable:

- timing and rhythm;
- control and coordination;
- weight transfer;
- jump / landing control;
- turn sequence control;
- dynamics and phrasing;
- musical responsiveness;
- performance intention;
- spatial clarity;
- transitions and direction changes;
- line, placement or posture where visible and relevant.

Dance timestamped notes should cover, where observable and relevant:

- opening clarity / setup;
- rhythm and timing;
- movement quality and control;
- transitions;
- spatial use, pathway or direction changes;
- style-specific evidence where supportable;
- performance, presence and communication;
- at least one improvement moment;
- assessability limitations only when directly observed.

Dance action plan examples:

```text
Clarify dynamic contrast between accented counts and sustained phrases.
Sharpen weight transfer into direction changes.
Vary attack and release between counts.
Mark spatial pathways before filming.
Check full-body visibility with a 5-second test clip.
Rehearse facial and body intention together rather than treating expression as separate.
Review whether transitions are initiated from breath, focus, weight or musical accent.
```

Only mention lighting, framing or footwork visibility if genuinely limiting.

Professional Dance reports must distinguish:

- high energy from controlled dynamic range;
- musical timing from rhythmic nuance;
- visible execution from technical precision;
- performance presence from choreographic clarity;
- clean movement from style-specific accuracy.

### 14.3 Acting

Acting reports should use Acting / Performance and Voice / Speech Delivery, not Vocal Performance, unless singing exists.

Anchor acting comments to observable:

- objective / intention;
- action or tactic;
- beat or thought shift;
- listening / response;
- relationship or addressee;
- given circumstances actually supplied or shown;
- text / context understanding;
- eyeline and reader connection;
- pacing and release;
- screen or stage framing where relevant.

Avoid invented psychology, backstory or production world.

Do not claim collaboration, redirection, workshop readiness, taking direction well, recall readiness or callback readiness unless directly shown.

Reader quality and paid-reader access must not inflate or depress the actor’s score.

### 14.4 Voice / Singing

Voice / Singing assessment must evaluate only what is audible enough.

Assess:

- pitch / intonation;
- rhythm / timing;
- diction / lyric clarity;
- phrasing / line;
- tone / colour, cautiously;
- communication / interpretation;
- lyric intention;
- breath / line management where audible without diagnosis.

Separate:

- vocal technique;
- lyric storytelling;
- acting-through-song;
- audio clarity;
- accompaniment balance;
- style context.

Do not diagnose:

- vocal health;
- injury;
- strain pathology;
- register mechanism;
- “healthy voice”;
- “unhealthy voice”.

Belt, mix, passaggio, register transition and fine-grain vocal pedagogy should remain cautious descriptor territory until benchmarked.

If backing track, room, phone compression or balance masks evidence, use assessability wording.

### 14.5 Commercial

Commercial must be treated as its own context, not generic acting.

Requirements:

- Define Commercial presence / naturalism through observable copy, camera relationship, tone, addressee and scale.
- Suppress generic Commercial praise.
- Ground tone, copy and product claims in supplied or observable context.
- Block no-brief invention.
- Separate direct-to-camera from reader / off-camera setup.
- Require assessability before strong claims.
- Separate audibility from performance.
- Accept simple capture and block polish-as-merit.
- Keep process / admin details process-only unless explicit brief compliance is affected.
- Block commercial look, marketability, buyer fit, bookability or casting fit without supplied brief.

No-dialogue Commercial can still show Commercial behaviour only where non-verbal reaction, action or facial clarity is visible.

Voiceover-style evidence is conditional and should be used only when supplied voiceover copy or task context supports it.

---

## 15. Generic phrase and specialist-depth enforcement

Generic praise and criticism must be suppressed unless anchored to observable evidence.

The following phrases may appear only when tied to specific evidence:

```text
strong energy
good movement
high-energy movement
performance energy
good character focus
rhythmic precision
sharp accents
facial engagement
clear technique
strong technique
clean lines
controlled movement
nice musicality
expressive
dynamic
polished
professional
technically strong
consistent energy
contemporary/jazz influences
strong vocal control
vocal resonance
grounded acting
emotionally connected
natural
believable
strong presence
strong acting
highly professional
```

Each substantive praise or criticism should reference at least one of:

- timestamp;
- movement quality;
- count / rhythm;
- transition;
- spatial pathway;
- body / line / placement where visible;
- dynamic contrast;
- musical accent;
- lyric / phrase / register event;
- beat / objective / action;
- relationship / addressee;
- task / brief requirement;
- assessability limitation;
- specific category rationale.

Generic phrases without anchors must be rewritten or suppressed.

---

## 16. Technique naming and public authority

No technique name is automatically safe for public output because it appears in a syllabus, glossary, source, ontology or model output.

Each candidate technique term must be assigned one of:

| Status | Meaning | Public behaviour |
|---|---|---|
| Public named technique | Source-stable, self-tape observable, fair, repeatably recognised, benchmark-validated, expert-reviewed and safe wording approved. | May be named publicly. |
| Public safe descriptor | Observable phenomenon, but exact technical name is too fragile, style-specific or benchmark-thin. | Use plain descriptor, not formal authority. |
| Limitation-only | Useful only to explain what could not be assessed. | Use only as assessability / limitation wording. |
| Internal shadow | Useful internally for traces, tests or routing, but not public. | Do not surface publicly. |
| Blocked | Depends on appearance, body, marketability, diagnosis, access deficit, unsupported role fit or weak inference. | Never surface except in blocked-wording tests. |

Public naming requires:

1. source stability;
2. self-tape observability;
3. fairness and safety;
4. repeatability across model runs, routes and reviewers;
5. public wording quality;
6. evidence-anchor linkage;
7. benchmark requirement;
8. expert review where required;
9. display eligibility.

### 16.1 Internal Technique Standards Library

The Technique Standards Library is an internal standards system, not a public glossary.

TapeCoach may identify and name techniques internally when evidence supports them. Public technique naming remains separately gated.

Internal technique detection does not automatically authorise:

- public naming;
- public scoring;
- public technique authority;
- production-safe status.

Technique detection may return:

- none detected;
- one technique;
- multiple techniques;
- possible but uncertain;
- requested but not present;
- not assessable.

Each technique or skill-family entry should define:

| Area | Requirement |
|---|---|
| Definition | What the technique is. |
| Purpose | Why it matters in the discipline/task. |
| Characteristics | What strong, developing or weak execution looks/sounds like. |
| Level standards | How expectations differ by selected performer level. |
| Evidence requirements | What must be visible/audible/supplied to assess it. |
| Common faults | What mistakes are observable. |
| Assessability limits | When the system must not judge it. |
| Scoring implications | Which categories/components it can affect. |
| Recommendation rules | When to preserve, improve, suggest drills or stay silent. |
| Public authority | Whether the name can be public, descriptor-only, limitation-only, internal shadow or blocked. |

```ts
type TechniqueStandard = {
  technique_id: string;
  discipline:
    | "musical_theatre"
    | "dance"
    | "acting"
    | "voice_singing"
    | "commercial";

  component: string;
  technique_family: string;

  names: {
    canonical: string;
    aliases: string[];
    plain_language_descriptors: string[];
  };

  definition: string;
  purpose: string;

  characteristics: {
    core: string[];
    strong_execution: string[];
    developing_execution: string[];
    common_faults: string[];
    unsafe_or_unfair_inferences: string[];
  };

  level_standards: {
    learning_school: TechniqueLevelStandard;
    amateur_community: TechniqueLevelStandard;
    emerging_training: TechniqueLevelStandard;
    professional: TechniqueLevelStandard;
  };

  evidence_requirements: {
    required_modalities: ("video" | "audio" | "brief" | "material" | "timestamp")[];
    required_visibility_or_audibility: string[];
    timestamp_preferred: boolean;
    cannot_assess_if: string[];
  };

  scoring_implications: {
    categories_supported: string[];
    component_scores_supported: string[];
    readiness_relevance: string;
  };

  recommendation_rules: {
    when_to_recommend: string[];
    when_not_to_recommend: string[];
    safe_drills: string[];
    caution_drills: string[];
    blocked_advice: string[];
  };

  public_authority: {
    status:
      | "public_named_technique"
      | "public_safe_descriptor"
      | "limitation_only"
      | "internal_shadow"
      | "blocked";
    benchmark_status: "not_started" | "in_progress" | "passed";
    expert_review_required: boolean;
    public_wording_approved: boolean;
  };
};
```

Example:

```text
Grand battement:
The system should define it, identify whether it appears, identify characteristics such as brush through tendu, height, turnout, pelvis/torso control, controlled descent and clean return, judge those characteristics by selected level, and recommend improvements only where useful.
```

### 16.2 Brief-requested technique and skill handling

If a supplied brief requests a named technique, skill, style, number, movement quality, vocal style, accent, copy task or material requirement, TapeCoach must:

1. extract the requirement;
2. map it to the internal technique / repertoire library where possible;
3. determine whether it is mandatory, preferred, optional or style-context;
4. check whether it appears in the tape;
5. determine whether it is assessable;
6. judge quality against the selected performer level;
7. reflect the result in brief achievement, readiness, priority fixes and action plan.

A supplied brief may authorise referencing the requested technique as a brief requirement. It does not automatically authorise claiming the technique was demonstrated, scored highly or publicly named as observed.

### 16.3 Repertoire, show and number intelligence

Where a brief supplies show, role, number, cut, style or material context, TapeCoach should resolve that context and use it to guide analysis where evidence supports it.

The system should be able to map show / number context to:

- likely discipline focus;
- technique families;
- style demands;
- component requirements;
- selected-level standards;
- assessability needs;
- common risks;
- safe feedback patterns.

The system must not invent show, number, role, production or choreography context where the brief does not supply it and the knowledge base / controlled research cannot support it.

Repertoire public claims must be governed separately from internal repertoire understanding. A supplied brief can authorise referencing the show or number as task context, but it does not automatically prove that the submitted tape demonstrated the number-specific standard.

### 16.4 Knowledge and research access policy

The project has all required agreements, lawful access and permissions for the knowledge, research and reference materials used to develop TapeCoach’s technique library, repertoire library, show / number understanding, performance standards, benchmark examples and specialist evaluation logic.

Rights, licensing and lawful-access management are handled outside the TapeCoach system.

The TapeCoach system is not required to enforce or reason about rights or licensing.

TapeCoach may use all project-approved information sources for internal knowledge development, including:

- licensed materials;
- official audition packs;
- show / number references;
- performance footage where available to the project;
- syllabus and technique materials;
- expert review;
- internal benchmark clips;
- controlled public research;
- production-specific material supplied in the brief;
- historical and current repertoire sources;
- discipline-specific training and performance references.

TapeCoach is not:

- streaming;
- reselling;
- pirating;
- republishing protected material;
- distributing scripts, choreography, videos or lyrics;
- reusing source material as a public substitute for the original material.

TapeCoach is using project-approved information to build an internal knowledge base capable of recognising known techniques, styles, skills, repertoire, numbers, performance standards and self-tape expectations, then producing original, evidence-led, safe feedback.

Inside the system, knowledge sources should be tracked for quality and release control:

- source type;
- authority tier;
- confidence;
- freshness;
- review status;
- benchmark status;
- public-claim status.

Use source metadata for quality and release control, not legal-rights enforcement.

```ts
type KnowledgeSource = {
  source_id: string;

  source_type:
    | "licensed_or_project_approved_material"
    | "official_audition_pack"
    | "supplied_brief"
    | "official_show_page"
    | "production_material"
    | "syllabus_or_training_material"
    | "expert_review"
    | "benchmark_fixture"
    | "controlled_public_research"
    | "internal_reference";

  knowledge_use:
    | "technique_standard"
    | "repertoire_standard"
    | "show_number_context"
    | "brief_mapping"
    | "benchmarking"
    | "validator_rule"
    | "public_wording_candidate";

  authority_tier: 1 | 2 | 3 | 4 | 5;
  provenance_confidence: "high" | "medium" | "low";

  freshness_status:
    | "current"
    | "review_due"
    | "stale"
    | "unknown";

  review_status:
    | "unreviewed"
    | "system_reviewed"
    | "human_reviewed"
    | "expert_reviewed"
    | "blocked";

  public_claim_status:
    | "accepted_public_claim_allowed"
    | "safe_descriptor_only"
    | "internal_only"
    | "blocked";

  notes?: string[];
};
```

Do not add or use system-level legal-rights enforcement gates in TapeCoach. The project’s lawful access, agreements and permissions are handled outside the system.

### 16.5 Controlled research and research-augmented specificity

TapeCoach should not rely only on a static repertoire library. Where accepted library coverage is missing, stale or ambiguous, controlled research may identify likely techniques, styles, task demands and repertoire context.

Research-supported knowledge must be classified as:

- `accepted_library`;
- `research_supported_provisional`;
- `research_discovered`;
- `stale_requires_refresh`;
- `conflicting_sources`;
- `missing`;
- `not_applicable`.

Research can support evaluation focus before it supports public authority.

Research-supported provisional feedback may be more specific than generic discipline feedback, but must use cautious wording and must not claim definitive repertoire authority.

Allowed wording pattern:

```text
The brief and available repertoire context point towards [technique/style demand]. In the tape, [observable evidence]. For the selected level, [specific feedback].
```

Blocked wording pattern:

```text
This number definitively requires X.
This is exactly how the production expects it.
You have mastered this technique.
The choreography should be done this way.
```

### 16.6 Active learning and library maturation

The system should mature the technique, repertoire and benchmark libraries automatically where possible. Human review should be used through controlled, high-value review tasks rather than broad manual authoring.

The active-learning loop is:

1. system analyses tapes / fixtures;
2. system detects uncertain technique, style, repertoire or brief-achievement cases;
3. system proposes candidate examples;
4. system groups candidates into review tasks;
5. human reviewer performs small, controlled decisions;
6. system updates benchmark sets, standards, thresholds or validators;
7. updated behaviour is tested before release.

Review tasks may include:

- pairwise comparison;
- presence / absence labelling;
- characteristic labelling;
- level calibration;
- brief achievement review;
- repertoire mapping;
- public wording review.

Example review task:

```text
Which clip better demonstrates grand battement for Amateur / Community level?
```

---

## 17. Comparison requirements

Comparison must use evidence deltas, not raw score rank.

Required comparison states:

| State | Meaning |
|---|---|
| Duplicate / near-duplicate detected | Same or materially same input. |
| No reliable material difference | Differences are not evidence-supported. |
| Analysis variance warning | Differences may be system variance, not performer difference. |
| Marginal preference | Small evidence-backed preference, not a strong winner. |
| Clear winner | Decisive evidence delta across relevant components. |
| Recommendation suppressed | Unsafe or unsupported to recommend a take. |

For the same video submitted repeatedly to the same audition with the same brief:

- detect duplicate or near-duplicate input;
- do not force a winner unless there is a decisive evidence delta;
- do not use overall score as the public winner-forcing metric;
- warn or suppress if component split instability appears;
- block same-confidence masking;
- output “no reliable material difference”, an analysis-variance warning or suppressed recommendation where appropriate.

A comparison that recommends “Submit Take X” on the same video without decisive evidence delta is a P0 failure.

---

## 18. QA artefacts and runtime evidence

Every QA run should emit a structured internal artefact bundle that can prove what happened without relying on screenshots or manual PDFs.

Artefacts are internal-only and must not leak into public output.

The current S9 live Storage validation target is the 12-file analysis-run bundle (when TechniqueObservationTrace and ScoreTrace source data exists) listed in `Current internal QA / S9 implementation state`. That passing bundle is not the full Level 2 artefact target.

Minimum analysis-run artefacts:

- `manifest.json`
- `qa/acceptance_metrics.json`
- `input_record.json`
- `resolver_output.json`
- `TruthStateMap.json`
- `raw_report.json`
- `render_payload.json`
- rendered report artefact
- `EvidenceAnchors.json`
- `PublicClaimTrace.json`
- `TechniqueObservationTrace.json` where relevant
- `ScoreTrace.json`
- `GateTrace.json`
- `ModelRunTrace.json`
- `validator_trace.json`
- `redaction_trace.json`
- `UKEnglishGateResult.json`
- `public_private_leakage_result.json`

Minimum comparison-run artefacts:

- `comparison.raw.json`
- `comparison.render_payload.json`
- rendered comparison artefact
- `duplicate_detection_trace.json`
- `no_material_difference_trace.json`
- `evidence_delta_trace.json`
- `comparison_suppression_trace.json`
- `same_video_repeatability_trace.json`
- `route_variance_trace.json`

Export handling:

- if export exists, emit `export_manifest.json` and `render_to_export_parity.json`;
- if export does not exist, emit no-export proof from source, config, UI and logs;
- manual print PDFs are rendered / manual-print evidence only and do not prove export parity.

Blocked or not-executed artefacts must be clearly marked:

```ts
type ArtefactEvidenceStatus =
  | "emitted"
  | "missing"
  | "deferred"
  | "not_executed"
  | "not_applicable"
  | "failed_emission";
```

Do not count not-executed placeholders as successful runtime evidence.

### 18.1 Additional maturity artefact families

The following artefact families support the roadmap maturity layers. They do not all need to be Level 2 blockers immediately; each must be classified by required maturity level.

```text
BriefRequirementTrace.json
BriefAchievementTrace.json
TechniqueStandardsTrace.json
TechniqueDetectionTrace.json
KnowledgeSourceTrace.json
RepertoireResolutionTrace.json
RepertoireResearchTrace.json
ResearchAugmentedSpecificityTrace.json
ActiveLearningCandidateTrace.json
ReviewTaskTrace.json
KnowledgeCoverageSummary.json
```

Each maturity artefact should be classified as one of:

```text
required_for_L2
required_for_specialist_feedback
required_for_repertoire_feedback
required_for_public_authority
internal_maturity_only
```

---

## 19. Testing and acceptance policy

Product QA must prove actual behaviour on the locked-down user-facing TapeCoach website before customer-facing release.

Engineering tests such as unit tests, build checks, static scans and CI checks are required for code correctness, but they do not replace product QA on the user-facing site.

No result should be described as customer-facing release-ready until artefact, repeatability, parity, safety, discipline-output and website QA gates pass.

The required evidence levels are:

| Level | Meaning |
|---|---|
| Level 0 — Planning / documentation | Requirements, architecture notes, manifests, prompts and defect registers. |
| Level 1 — Source inspection | Source files, schemas, validators, fixtures and tests inspected. |
| Level 2 — Specific-run artefact QA | Raw report, rendered report, traces, validator results and parity artefacts for a specific run. |
| Level 3 — Repeatability evidence | Repeated-run or route-variance evidence for identical or near-identical inputs. |
| Level 4 — Controlled website QA | Locked-down user-facing-site QA with complete artefact bundles and P0 gates passing. |

Level 4 does not automatically authorise customer-facing release unless release-candidate gates also pass.

### 19.1 Level 2 sub-gates

Level 2 should be decomposed so parallel teams can close evidence families without confusing analysis proof, render proof, comparison proof and export proof.

| Sub-gate | Meaning | Required evidence |
|---|---|---|
| `L2-A-ANALYSIS-RUN-QA` | The analysis run is auditable. | Input record, resolver output, TruthStateMap, EvidenceAnchors, PublicClaimTrace, TechniqueObservationTrace where relevant, ScoreTrace, ModelRunTrace, ValidatorTrace, GateTrace. |
| `L2-B-RENDER-PARITY-QA` | The rendered report matches validated internal data. | Render payload, rendered report artefact, report parity result. |
| `L2-C-COMPARISON-RUN-QA` | Comparison artefacts exist where comparison is invoked. | Comparison raw JSON, comparison render payload, duplicate detection, evidence-delta trace, suppression trace. |
| `L2-D-EXPORT-NO-EXPORT-QA` | Export is either parity-proven or proven absent. | Export manifest and export parity, or no-export source/config/UI/log proof. |
| `L2-E-GATE-VALIDATOR-QA` | Safety, wording, UK English, public/private boundary and production gates are recorded. | ValidatorTrace, GateTrace, redaction trace, UK English result, public/private leakage result. |

For single-take analysis runs, comparison artefacts should not automatically be treated as failed analysis proof. They should be `missing`, `deferred`, `not_applicable` or `emitted_blocked` according to whether comparison was invoked and what the run was supposed to prove.

---

## 20. Validation rules

Validation must fail or normalise if:

- strengths are artificially capped despite more useful distinct strengths;
- improvements are artificially capped despite more useful actionable improvements;
- prioritised fixes collapse to one item when more evidence-supported priorities exist;
- the action plan contains only one item while multiple improvements exist;
- timestamped notes are sliced to a fixed small count;
- timestamps are invented, padded, invalid or non-chronological;
- a long professional tape receives shallow feedback despite available evidence;
- a high score receives less feedback than a lower score;
- a category below 100 lacks close-gap rationale;
- Professional scoring does not use a higher standard than lower selected levels;
- any non-Professional 90+ score is described as Professional-standard without evidence;
- any non-Professional level is prevented from reaching 90+ for excellent work at that level;
- setup advice rewards expensive kit, studio polish or paid coaching;
- Dance reports use “high energy” as technique evidence;
- Musical Theatre reports silo acting and song without considering integration where relevant;
- generic phrases appear without anchors;
- role fit, marketability, bookability or casting fit is inferred without a supplied brief;
- comparison forces a winner without evidence delta;
- a mandatory brief requirement is assessable and missing, but readiness is not reduced;
- a brief requirement is marked achieved without evidence;
- every brief phrase is treated as mandatory without obligation classification;
- a requested technique is claimed as demonstrated without evidence;
- a requested technique is absent but the report ignores it;
- a not-assessable brief requirement is treated as a performance weakness;
- research-supported provisional knowledge is presented as accepted-library authority;
- stale or conflicting repertoire knowledge produces definitive public claims;
- technique / repertoire / action-plan content is padded;
- a public technique name appears before public technique authority passes;
- a public repertoire claim appears before repertoire public-claim gates pass;
- private traces, hidden reasoning or raw evidence leak into public output.

---

## 21. Acceptance tests

### 21.1 Level calibration tests

- Learning / School, Amateur / Community and Emerging / Training can each achieve 90+ for excellent work at the selected level.
- Professional 90+ requires a higher standard than any non-Professional 90+.
- A non-Professional 90+ is never described as Professional-standard unless separately assessed and supported by Professional evidence.
- The same tape can receive different scores across Learning / School, Amateur / Community, Emerging / Training and Professional.
- The selected level changes the scoring standard, not only the verdict wording.
- Public language always says “for the selected level” or equivalent where readiness could otherwise sound absolute.
- Professional 95+ includes a meaningful standout delta.
- Professional 98–100 is rare and not awarded where meaningful correctable category notes exist.

### 21.2 Feedback volume tests

- Strengths are not capped at three.
- Improvements are not capped at three.
- Prioritised fixes return a useful shortlist.
- Technical safety maxima prevent runaway output but do not become normal caps.
- Longer professional tapes receive more depth, not less.
- No section pads items to meet a target count.

### 21.3 Timestamp tests

- A 45-second Dance tape yields 3–5 purposeful timestamped notes if assessable.
- A 2-minute Dance tape yields 6–10 purposeful timestamped notes if assessable.
- A 4-minute Musical Theatre tape yields 8–14 purposeful timestamped notes if assessable.
- A 10-minute professional tape can yield more than eight timestamped notes.
- Chronological order is preserved.
- Invalid timestamps are dropped.
- No report path slices timestamped notes to eight.
- If evidence supplies fewer timestamps than the duration target, the report does not pad and records underproduction.

### 21.4 Category rationale tests

- Every category below 100 explains what worked.
- Every category below 100 explains why full marks were not awarded.
- Every category below 100 explains what would close the gap.
- Every score above 90 includes a meaningful marginal improvement.
- A score of 95 does not produce less feedback than a score of 75.
- Professional Dance reports contain specialist movement detail.
- High scores do not reduce feedback volume.
- If repeated takes receive near-identical scores, the comparison explains the tie or variance rather than inventing differences.

### 21.5 Action plan tests

- All improvements are represented in the action plan.
- No action plan contains only one item when multiple improvements exist.
- No padded filler appears.
- No expensive-equipment advice appears.
- No paid-coaching advice appears.
- No unsupported foot-cropping advice appears.
- Dance action plans include movement-specific drills or setup corrections where relevant.

### 21.6 Component breakdown tests

- Component breakdown adds information beyond component name, weight and score.
- Dance component breakdown includes style / task confidence where supportable.
- Dance component breakdown includes assessability limits where relevant.
- Component rationale explains what drives the component judgement.
- Component rationale distinguishes component-level evidence from category-level scoring.

### 21.7 Generic phrase tests

- Generic praise is rewritten or suppressed unless anchored.
- Generic criticism is rewritten or suppressed unless actionable.
- Dance reports do not rely on “high energy” as technique evidence.
- Musical Theatre reports do not rely on “strong vocal” or “grounded acting” without evidence.
- Each substantive praise or criticism links to timestamp, component, category, brief / task evidence or assessability limitation.

### 21.8 Comparison tests

- Same-video or near-duplicate comparison does not force a winner without decisive evidence delta.
- Comparison uses evidence deltas rather than raw score rank.
- No-material-difference and analysis-variance states are available.
- Same-confidence masking is blocked.
- Component split instability triggers warning or suppression.

### 21.9 Brief achievement tests

- A mandatory brief requirement that is assessable and absent reduces readiness.
- A mandatory brief requirement that is cropped, masked or inaudible is marked `not_assessable`, not `not_achieved`.
- Every meaningful supplied brief item is classified by obligation type before being judged.
- A supplied brief may be referenced as a requirement without claiming successful execution.
- Brief achievement appears in readiness rationale, priority fixes and action plan where relevant.

### 21.10 Brief-requested technique tests

- A brief-requested named technique is extracted and mapped to a known technique ID or safe unresolved state.
- A requested technique can be identified as present, possible, absent or not assessable.
- A requested technique is judged against the selected performer level.
- A requested technique that is absent but mandatory affects readiness where assessable.
- Public naming of a requested technique remains gated by evidence and public technique authority.

### 21.11 Technique standards tests

- Technique detection can return no detected techniques without padding comments.
- Technique entries include definition, purpose, characteristics, level standards, evidence requirements, common faults, assessability limits, scoring implications and recommendation rules.
- A technique such as grand battement can be assessed for observable characteristics such as pathway, turnout, torso/pelvis control, descent and return where visible.
- Technique improvement suggestions are omitted when not useful or not evidence-supported.

### 21.12 Repertoire / show / number tests

- A supplied show / number / role / cut is resolved where confidence is high enough.
- Ambiguous show or number context is recorded and public number-specific claims are blocked or caveated.
- Repertoire context maps to relevant technique families and selected-level standards where supported.
- Repertoire-informed feedback is omitted or downgraded when tape evidence is insufficient.

### 21.13 Research-augmented specificity tests

- Research-supported provisional repertoire context may guide cautious feedback but cannot become definitive public authority.
- Stale repertoire knowledge triggers a refresh or caveat state.
- Conflicting sources block definitive public claims.
- Research-supported demands are cross-referenced with brief, selected level, technique standards and tape evidence before informing feedback.

### 21.14 Active-learning tests

- The system can propose candidate review examples for uncertain technique, style, repertoire or brief-achievement cases.
- Pairwise review tasks can ask which clip better demonstrates a technique at a selected level.
- Human review updates benchmark candidates without automatically changing public authority.
- Library maturation updates are versioned and tested before release.

### 21.15 Knowledge-source provenance tests

- Knowledge claims include source type, authority tier, confidence, freshness, review status and public-claim status.
- The system does not require rights/licensing fields for knowledge-source governance.
- Project-approved source provenance is used for quality and release control, not legal-rights enforcement.

### 21.16 Public claim authority tests

- Public technique names do not appear before public technique authority gates pass.
- Public repertoire claims do not appear before repertoire public-claim gates pass.
- Safe descriptors can be used where public naming is blocked but the observation is evidence-supported.
- Private/internal technique and repertoire traces do not leak into public output.

### 21.17 Product usefulness tests

- Approved testers can identify the readiness verdict, brief achievement, highest-priority focus areas, strengths to preserve, selected-level gap, action plan and limitations.
- Reports are judged for clarity, actionability, specificity and safety, not only schema validity.
- No-padding rules are enforced across technique, repertoire, action-plan and timestamp content.

---

## 22. Implementation priorities and incremental release train

The implementation order should support parallel team delivery while keeping release gates explicit.

### 22.1 Implementation priorities

1. Runtime proof spine and Level 2 sub-gates.
2. Brief requirement itemisation and brief achievement.
3. Technique Standards Library.
4. Active-learning review loop.
5. Brief-requested technique handling.
6. Project-approved knowledge source provenance.
7. Repertoire / show / number standards.
8. Controlled research and research-augmented specificity.
9. ValidatorTrace, GateTrace and ModelRunTrace.
10. Render, parity, redaction, UK English, leakage and export/no-export proof.
11. PublicReportV3-A: readiness and brief-first structure.
12. Specialist descriptors.
13. Public scoring / public technique / public repertoire claim governance.
14. Comparison runtime.
15. GF-01 / RT-15.
16. Level 3 repeatability.
17. Level 4 locked-down website QA.
18. Release candidate.
19. Legacy-adapter sunset.

### 22.2 Incremental release train

Incremental releases may be shipped into the locked-down live product for the development team and approved testers, but customer-facing release remains blocked until release-candidate gates pass.

| Release | Scope | Gates | Benefit | User-facing change |
|---|---|---|---|---|
| R0 — Current S9 baseline | Current S9 internal bundle emission. | `S9-BUNDLE-EMISSION`, `QA-METRICS-GATE` | Runtime proof bundle exists. | No public change. |
| R1 — Level 2 sub-gate decomposition | Split Level 2 into analysis QA, render/parity QA, validator/gate QA, export/no-export QA and comparison QA. | `L2-A`, `L2-B`, `L2-C`, `L2-D`, `L2-E` | Teams can close gates in parallel. | None. |
| R2 — Brief achievement engine | Parse brief into itemised requirements, classify obligation and evaluate achievement. | `BRIEF-REQUIREMENT-ITEMISATION-GATE`, `BRIEF-OBLIGATION-CLASSIFICATION-GATE`, `BRIEF-ACHIEVEMENT-GATE` | TapeCoach can answer whether the performer achieved the brief. | Locked-down testers may see brief achievement summary once validated. |
| R3 — Technique standards and active-learning foundation | Technique library schema, seed packs, source provenance and active-learning candidate queues. | `TECHNIQUE-STANDARDS-LIBRARY-GATE`, `ACTIVE-LEARNING-CANDIDATE-GATE`, `PAIRWISE-REVIEW-GATE` | Starts automated maturation of specialist knowledge. | None initially. |
| R4 — Brief-requested technique handling | Extract required techniques, map to library, detect in tape and judge by selected level. | `BRIEF-TECHNIQUE-MAPPING-GATE`, `BRIEF-TECHNIQUE-ADHERENCE-GATE`, `TECHNIQUE-LEVEL-CALIBRATION-GATE` | Required techniques affect readiness and brief adherence. | Yes, if evidence-backed and validator-approved. |
| R5 — Project-approved knowledge ingestion and provenance | Use all project-approved knowledge and research sources to build technique, repertoire, show / number and benchmark knowledge; track source provenance, authority tier, confidence, freshness, review state and public-claim status. | `KNOWLEDGE-SOURCE-PROVENANCE-GATE`, `CONTROLLED-RESEARCH-GATE`, `RESEARCH-TO-LIBRARY-GATE` | Library development uses the full approved knowledge base while keeping public claims evidence-linked, reviewed and safe. | None directly. |
| R6 — Controlled research and research-augmented specificity | Use controlled research when library coverage is missing, stale or ambiguous. | `CONTROLLED-RESEARCH-GATE`, `RESEARCH-AUGMENTED-SPECIFICITY-GATE`, `RESEARCH-TO-LIBRARY-GATE` | Feedback does not become generic just because curated library coverage is incomplete. | Cautious, evidence-led wording only. |
| R7 — Repertoire / show / number intelligence | Build show, number, role, style and task standards; map to techniques and selected level. | `REPERTOIRE-STANDARDS-LIBRARY-GATE`, `REPERTOIRE-SOURCE-PROVENANCE-GATE`, `REPERTOIRE-TECHNIQUE-MAPPING-GATE` | TapeCoach can understand material-specific expectations. | Locked-down, gated, cautious. |
| R8 — Level 2 trace closure | ValidatorTrace, GateTrace, ModelRunTrace, redaction, UK English and leakage. | `VALIDATOR-TRACE-GATE`, `GATE-TRACE-GATE`, `MODEL-RUN-TRACE-GATE`, `REDACTION-GATE`, `UK-ENGLISH-GATE` | A specific run becomes much more auditable. | None unless report gate allows. |
| R9 — Render, parity and no-export proof | Render payload, rendered report artefact, report parity and export/no-export proof. | `RENDER-PAYLOAD-GATE`, `RENDERED-REPORT-GATE`, `REPORT-PARITY-GATE`, `NO-EXPORT-GATE` | Proves visible report matches validated internal data. | Enables safer report improvements. |
| R10 — PublicReportV3-A | Public report structure: readiness, brief achievement, why, priorities, strengths, gap, action plan and limitations. | `PUBLIC-REPORT-V3-GATE`, `STRATEGIC-REPORT-OUTCOME-GATE`, `PUBLIC-PRIVATE-LEAKAGE-GATE` | Testers see a report that reflects TapeCoach’s actual product purpose. | Yes, locked-down live product. |
| R11 — Specialist feedback descriptors | Technique-informed safe descriptors and level-calibrated feedback. | `TECHNIQUE-CHARACTERISTICS-GATE`, `TECHNIQUE-RECOMMENDATION-GATE`, `PUBLIC-CLAIM-GATE` | Feedback becomes specialist without unsafe public naming. | Yes, descriptor mode only unless authority passes. |
| R12 — Public technique and repertoire authority candidates | Promote selected terms/claims to public authority where benchmarks, evidence and review pass. | `PUBLIC-TECHNIQUE-AUTHORITY-GATE`, `REPERTOIRE-PUBLIC-CLAIM-GATE`, `EXPERT-REVIEW-GATE` | Carefully approved specialist language enters reports. | Limited and gated. |
| R13 — Comparison runtime | Comparison raw JSON, internal report, evidence delta, duplicate detection and no-material-difference. | `COMPARISON-RAW-GATE`, `EVIDENCE-DELTA-GATE`, `DUPLICATE-DETECTION-GATE` | Comparison becomes auditable. | No public winner until GF-01 / RT-15 pass. |
| R14 — GF-01 / RT-15 comparison safety | Same-video suppression, route variance and repeatability traces. | `GF-01`, `RT-15`, `SUPPRESSION-GATE`, `ROUTE-VARIANCE-GATE`, `L3-REPEATABILITY` | Prevents false take winners. | Safe comparison guidance only after gates pass. |
| R15 — Level 4 locked-down website QA | Full live website test with complete artefact bundles and P0 gates passing. | `L4-CONTROLLED-WEBSITE-QA`, `PUBLIC-PRIVATE-LEAKAGE-GATE`, `PRODUCTION-SAFE-GATE` | Proves real product behaviour. | Locked-down approved testers only. |
| R16 — Release candidate | P0 clear, production-safe decision, public scoring decision, public technique/repertoire decision, rollback and sign-off. | `CUSTOMER-RELEASE-GATE`, `PRODUCTION-SAFE-GATE`, `PUBLIC-SCORING-GATE`, `PUBLIC-TECHNIQUE-AUTHORITY-GATE` | Customer-facing release can be considered. | Only after RC passes. |

### 22.3 Non-negotiable release-control rules

| Rule | Meaning |
|---|---|
| S9 is not Level 2 | S9 bundle emission is useful but does not equal specific-run artefact QA acceptance. |
| Legacy-derived traces do not satisfy v3 gates | `legacy_adapter` artefacts are internal QA/debug only. |
| Public scoring remains blocked | Internal scores do not authorise public score exposure. |
| Public technique authority remains blocked | Internal technique detection does not authorise public naming. |
| Brief achievement is central | The report must answer whether the brief was achieved and how much of it was achieved. |
| Brief request does not equal demonstrated technique | A brief can authorise referencing the requirement, not claiming successful execution. |
| Missing mandatory brief requirement affects readiness | If assessable and absent, readiness must be marked down. |
| Not assessable is not the same as not achieved | If the tape does not show enough, use assessability limitation before performance criticism. |
| Research support does not equal accepted authority | Research may guide focus and cautious feedback, but does not automatically authorise definitive public claims. |
| Project-approved knowledge may be used for library development | The project has required agreements and lawful access outside the system. TapeCoach is not required to enforce rights or licensing. |
| Conflicting or stale repertoire knowledge must be blocked or caveated | Do not force show/number-specific claims where source confidence is weak. |
| Comparison cannot force a winner without evidence delta | Same/near-identical videos require suppression, tie or variance warning unless decisive evidence exists. |
| Level 4 is not release | Controlled website QA does not automatically authorise customer-facing release. |
| QA artefacts stay private | Internal traces, scores, validators and safety gates must not leak publicly. |
| Runtime artefacts are not GitHub artefacts | Storage/log fallback are runtime sinks, not GitHub. |
| No padding | Do not invent technique comments, repertoire claims, fixes, drills or timestamps to fill space. |

---

## 23. Final controlling decision

This README is the controlling replacement for the redesigned TapeCoach requirements.

The target system is not a score-first report and not a fixed-cap feedback generator. It is a level-relative, evidence-led, discipline-aware and brief-aware self-tape evaluation system that tells the performer whether the tape is ready to submit, whether the brief has been achieved, why, what to preserve, what to fix, prioritise or focus on, what to do next and what could not be assessed.

Final strategic position:

```text
TapeCoach should use a governed research-augmented knowledge model.

Curated library knowledge is the authority for accepted public claims.
Project-approved knowledge sources build the internal standards library.
Controlled research keeps the system current and specific.
Evidence anchors prove what is actually in the tape.
Brief achievement determines whether the submission task was met.
Validators decide what can be said.
Release gates decide what can go public.
```

The practical product outcome is:

```text
The brief asked for this.
The tape shows this much of it.
This technique or skill is present / absent / not assessable.
This is how well it meets the selected-level standard.
This is what should be preserved.
This is what should be prioritised next.
This is whether the tape is ready to submit.
```

The scoring theme must remain consistent throughout the system:

- every performer level is judged fairly against its own standard;
- every non-Professional level can achieve 90+ for excellent work at that selected level;
- Professional performers are held to the highest bar;
- a Professional 90+ requires stronger, more competitive, discipline-specific evidence than a non-Professional 90+;
- high scores require sharper marginal feedback, not less feedback.
