# TapeCoach Requirements — Redesigned Evaluation and Report System

**Document status:** controlling replacement README for the redesigned TapeCoach evaluation and report system.  
**Purpose:** define the requirements that ChatGPT / implementation agents must follow when analysing self-tapes, calibrating scores, producing reports, generating comparisons and validating output quality.  
**Supersedes:** the current README and any earlier report design notes.  
**Language:** UK English.  
**Architecture review update:** repo-aligned requirements hardening, 18 May 2026.

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


## Development guardrails and common pitfalls

Mandatory pre-read for implementation agents and Codex before changing source: `docs/tapecoach/v3/engineering-lessons-and-guardrails.md`.

- Codex completion is not acceptance.
- `README.md` wins over roadmap/delivery docs.
- Low-level artefact emission and high-level reconciliation must stay separate.
- Low-level comparison emitters must not claim reconciliation unless required mode ran.
- Operator/internal comparison paths must use canonical take-root identity and reconcile manifest + metrics.
- Canonical run identity is `take-[raw_core]`; `take-take-*` is invalid.
- Level 2/public/production gates remain blocked unless separately accepted.
- Classify the first failing test gate before patching.
- Clean generated artefact churn before commit.


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


## 0A. Architecture, repo alignment and current implementation boundary

This README is both the product requirements source and the engineering contract for the next implementation slices. It must therefore distinguish:

- **target requirements**: what TapeCoach must eventually do;
- **current repo implementation**: what the current `main` branch can already emit or enforce;
- **first-pass internal artefacts**: useful QA/debug output that is not yet Level 2 proof;
- **accepted release evidence**: runtime proof that can satisfy a named gate.

### 0A.1 Current repo facts this README must preserve

The current repository contains a dark-mode internal QA artefact spine. It is useful and should not be regressed, but it is not release acceptance.

Current source-level facts:

- `src/server/process-take.server.ts` is a server-only processing module and imports the v3 QA artefact wiring. Public or client-callable surfaces must access it only through thin authenticated wrappers with ownership checks.
- The current process pipeline still contains legacy report-tool fields such as `casting_headline`, `casting_insight`, `fix_first`, `overall_score`, category scores and legacy report snapshots. These fields are allowed internally only as legacy/runtime data to be scrubbed, traced or migrated. They must not become the public v3 contract.
- `src/server/report-output-enforcement.server.ts` already performs deterministic public-output scrubbing for castability/bookability overclaims, generic unanchored language, presentation-polish merit claims and unsafe framing advice. The README must keep those rules as product requirements rather than weakening them.
- `src/server/v3/qa-artifact-sink.server.ts` supports `file`, `storage` and `console_jsonl` sinks, uses Storage upload upsert, records `sink_write_status`, and can emit fallback JSONL logs when `QA_ARTIFACT_LOG_FALLBACK=true`.
- `src/server/v3/qa-artifacts.server.ts` currently treats emitted, emitted-blocked, missing, deferred and not-applicable artefacts as manifest states. `failed_emission` is a target evidence state and must be mapped from failed sink writes or added to the manifest contract before Level 2 closure.
- `src/server/v3/qa-artifacts-wiring.server.ts` contains the current canonical take/comparison identity handling. Do not reintroduce `take-take-*` identities or nested duplicated take roots.
- `src/server-fns/internal-comparison-trigger.functions.ts` exposes an internal admin comparison trigger guarded by authentication, admin authorisation and `INTERNAL_COMPARISON_TRIGGER_ENABLED=true`. It is not a customer-facing comparison flow.
- `docs/tapecoach/v3/engineering-lessons-and-guardrails.md` is a mandatory engineering pre-read but does not override this README.
- Older repo notes, including QA-emitter notes that mention earlier object-key shapes such as `v3/<run_id>/<relative_path>`, are historical unless repeated in this README.

### 0A.2 Target-vs-current status language

Use the following language consistently in implementation notes, PRs, manifests and release-board entries:

| Term | Meaning | Release effect |
|---|---|---|
| `target_requirement` | Required by this README but not necessarily implemented. | Drives contracts and tickets; not proof. |
| `source_scaffold` | Source code or tests exist, but no accepted runtime bundle proves behaviour. | Does not satisfy runtime gates. |
| `first_pass_internal` | Artefact emits from legacy/snapshot or incomplete runtime data. | Useful for QA/debug only. |
| `real_runtime_v3` | Artefact is produced from the v3 runtime evidence spine and can be linked through resolver/truth/evidence/public-claim/gate traces. | Can satisfy a gate only if validators pass. |
| `accepted_gate_evidence` | Runtime artefacts and validators prove a named gate. | Can support dependent release decisions. |
| `operator_verification_required` | Source/Codex cannot inspect deployed state directly. | Requires Team G / release-governance confirmation. |

Do not treat a source scaffold, helper test, patch file, local file sink artefact, screenshot, manual PDF, or first-pass internal trace as accepted runtime evidence.

---

## 0B. Canonical runtime pipeline and engineering contracts

### 0B.1 Ordered pipeline

TapeCoach must use an ordered evidence-before-judgement pipeline. Later stages must not invent, repair or infer missing facts that should have been produced by earlier stages.

| Stage | Purpose | Required persisted outputs before next dependent stage |
|---|---|---|
| Media readiness | Confirm the uploaded media is playable and duration is known or truthfully unavailable. | `inputs/take.json`, media readiness fields, duration diagnostic. |
| Input capture | Record supplied take, submission, selected level, audition type, brief/material presence and safe media refs. | `inputs/input_record.json`, `inputs/submission.json`, `inputs/take.json`. |
| Resolver | Separate user-supplied, brief-supplied, observed, inferred, unavailable, conflicting and blocked context. | `resolver/resolver_output.json`, `resolver/TruthStateMap.json`. |
| Analysis Step 1 — evidence mapping | Extract observable video/audio/material evidence without producing final readiness judgement. | `analysis/AnalysisEvidenceState.json`, evidence anchors, component evidence, assessability limits and candidate technique/brief evidence. |
| Analysis Step 2 — judgement | Produce level-relative readiness, brief achievement, scores/bands, priorities and report data using only persisted evidence from Step 1 plus resolver/truth artefacts. | `reports/raw_report.json`, `traces/ScoreTrace.json`, `traces/TechniqueObservationTrace.json` where relevant. |
| Claim tracing | Link public/report claims back to evidence and truth-state entries. | `traces/PublicClaimTrace.json`, updated `traces/EvidenceAnchors.json` where needed. |
| Validation and gates | Validate schema, evidence linkage, wording, safety, UK English, public/private boundary, parity and release permissions. | `traces/ValidatorTrace.json`, `traces/GateTrace.json`, redaction/leakage/UK English results. |
| Render | Render only the public payload permitted by `GateTrace.public_output_permissions`. | `reports/render_payload.json`, rendered report artefact, parity result. |
| Manifest and acceptance metrics | Classify the bundle and summarise gate state. | `manifest.json`, `qa/acceptance_metrics.json`. |
| Comparison runtime | Run only when explicitly invoked and only from persisted take-level evidence. | `comparison/comparison_invocation_record.json`, comparison raw/render/evidence-delta/suppression traces. |

### 0B.2 Stage atomicity and retry policy

Each stage has a commit boundary:

- A stage is `complete` only when all required outputs for that stage have been written and included in the manifest or have been truthfully classified as `not_applicable`, `deferred`, `emitted_blocked` or `failed_emission`.
- Downstream stages may not consume partially written stage output.
- Step 2 must not run if `analysis/AnalysisEvidenceState.json` is absent, unreadable, failed, or not linked to the same `run_id`, `take_id`, `analysis_run_id` and `TruthStateMap` as the current run.
- If Step 1 writes partial evidence anchors but fails before `AnalysisEvidenceState.json`, those partial anchors must either be deleted on retry or left classified as `failed_emission`/`orphaned_partial_step1_output`. They must not be consumed by Step 2.
- Retried artefact emission should overwrite the same canonical object key. Appending retry-suffixed artefacts is not allowed unless the manifest declares one authoritative version.
- Storage write retries should be bounded. If repeated writes fail within a run, the run should trip a circuit breaker, classify remaining required artefacts as `failed_emission`, emit fallback logs where configured, and stop downstream processing.

### 0B.3 Media readiness and duration detection

Timestamp depth, extended-run handling and some assessability rules depend on media duration. Duration must be resolved before Step 1 evidence mapping.

Preferred duration sources, in order:

1. trusted processed media metadata from the upload/Mux pipeline;
2. file/container metadata from the prepared media asset;
3. direct playable-duration probe;
4. user-supplied duration only as low-confidence fallback.

If duration cannot be resolved, the system must record `media_duration_seconds: null`, `duration_confidence: "unknown"` and apply conservative timestamp expectations without padding. A tape over 10 minutes is an `extended_run`; this is not automatically a failure, but timing exceptions and evidence-depth expectations must be recorded in `qa/acceptance_metrics.json`.

### 0B.4 Schema versioning

All runtime artefacts must include `schema_version` using semver-compatible project schema identifiers, for example `tapecoach_v3_manifest@1.1.0` or an equivalent stable string that can be mapped to semver.

Rules:

- `manifest.json` must record the schema version for every artefact family in the run bundle.
- During active v3 delivery, validators must support N-1 schema compatibility unless a release gate explicitly declares a breaking migration.
- Mixed-version bundles are allowed only when every artefact version is recognised and the manifest marks compatibility status.
- Deprecated schema versions must remain readable for historical QA and rollback until the retention period expires.

### 0B.5 Canonical ID convention

Use structured IDs for cross-artefact references:

```text
{run_id}:{artefact_type}:{sequence_or_local_id}
```

Examples:

```text
take-abc123:evidence_anchor:0007
take-abc123:truth_state:brief_001
take-abc123:public_claim:priority_fix_01
technique.1.3.0:grand_battement
```

Rules:

- Runtime artefact IDs must be resolvable within the same canonical run root unless explicitly declared as a versioned library snapshot ID.
- Cross-run references are allowed only for comparison runs and must include both take/run IDs.
- Validators must run referential-integrity checks before any dependent gate can pass.

---

## Current internal QA / S9 implementation state

The current S9 internal QA Storage validation state is:

- live Storage validation has passed for current internal QA bundle emission;
- the current live Storage validation target is 12 files per take when TechniqueObservationTrace and ScoreTrace source data exists;
- `manifest.json` and `qa/acceptance_metrics.json` are required bundle members;
- internal QA bundle emission is not the same as Level 2 acceptance;
- Level 2 remains `not_accepted` until all required evidence, trace and proof gates pass;
- production-safe, public-scoring and public-technique-authority gates remain blocked;
- comparison evidence remains missing for ordinary single-take runs unless internal comparison is explicitly invoked and reconciled;
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

### Comparison invocation and reconciliation modes

- Comparison artefacts are **not** emitted automatically for ordinary single-take analysis runs.
- Ordinary single-take runs may show comparison artefacts as `missing`, `deferred`, `not_applicable` or `emitted_blocked` depending on run purpose and invoked flow.
- Absence of comparison artefacts in ordinary single-take runs must not automatically fail ordinary analysis proof.
- When internal comparison is explicitly invoked (operator/internal trigger path), comparison artefacts, `manifest.json` and `qa/acceptance_metrics.json` must be reconciled together.
- Canonical comparison reconciliation uses the root take identity, not an independent comparison-only identity. In Storage mode, comparison relative paths may originate as `takes/take-[core]/analysis-take-[core]/comparison/...` and must normalise to flat object keys under `take-[core]/analysis-take-[core]/comparison/...`; manifest and metrics remain under `take-[core]/analysis-take-[core]/`.
- In local file sink mode, diagnostic paths may include `<root>/<run_id>/takes/take-[core]/analysis-take-[core]/...`. That local diagnostic shape is not the canonical Storage object key root.
- Low-level comparison emitters must not claim reconciliation unless the reconciliation-enabled path was executed and manifest + metrics were rewritten against the same canonical take root.
- Level 2 acceptance and public/production gates remain blocked unless separately satisfied by full required evidence/proof gates.

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

Canonical take/run identity must follow these rules:

```text
raw take core: [core]                 # database/storage take id without a take- prefix
canonical run_id: take-[core]
canonical analysis_run_id: take-[core] unless explicitly and safely overridden
invalid: take-take-*
```

Canonical Storage object keys use the flat analysis-run root:

```text
take-[core]/analysis-[analysis_run_id]/
```

For the common analysis run where `run_id = analysis_run_id = take-[core]`, this becomes:

```text
take-[core]/analysis-take-[core]/
```

The current repo sink normalises expanded relative paths such as:

```text
takes/take-[core]/analysis-[analysis_run_id]/traces/EvidenceAnchors.json
```

to Storage object keys such as:

```text
take-[core]/analysis-[analysis_run_id]/traces/EvidenceAnchors.json
```

`manifest.json` and `qa/acceptance_metrics.json` for a `take-[core]` run must resolve to:

```text
take-[core]/analysis-take-[core]/manifest.json
take-[core]/analysis-take-[core]/qa/acceptance_metrics.json
```

Local file sink paths may include `qa-artifacts/<run_id>/takes/take-[core]/analysis-[analysis_run_id]/...`. Those paths are diagnostic file-mode paths only. Historical shapes such as `qa-artifacts/takes/...`, `v3/<run_id>/<relative_path>` or duplicated `take-[core]/takes/take-[core]/...` must not be treated as canonical Storage object keys.

Deployment provenance should use safe non-secret build or deployment environment variables where available. If safe provenance is unavailable, fields such as `build_commit_sha` and `deployment_revision` may remain `unknown`; that must not block artefact emission.

`QA_PROJECT_ROOT` and `PROJECT_ROOT` should be honoured as explicit provenance roots when they are valid. README/source-scope provenance must not claim root README presence unless `README.md` actually exists under the resolved root.

### Current Level 2 blockers

Level 2 remains blocked while any required Level 2 artefacts or proof gates are missing. Current known missing, first-pass-only, insufficient or blocked families include:

- `validator_trace` and `gate_trace` as independent runtime gate proof;
- `ModelRunTrace` as independent per-stage model-run proof;
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

Shared evidence-bearing public report types:

```ts
type EvidenceRefSource =
  | "observed_video"
  | "observed_audio"
  | "supplied_brief"
  | "supplied_material"
  | "component_evidence"
  | "category_rationale"
  | "assessability_limit";

type EvidenceRef = {
  evidence_ref_id: string;
  source: EvidenceRefSource;
  evidence_anchor_ids: string[];
  truth_state_entry_ids: string[];
  timestamp_refs?: string[];
  component_ids?: string[];
  confidence: "high" | "medium" | "low";
  limitation_only?: boolean;
};

type ReadinessSummary = {
  state:
    | "not_assessable"
    | "not_ready_yet"
    | "another_take_recommended"
    | "borderline_exposed"
    | "submit_ready"
    | "strong_for_selected_level"
    | "exceptional_for_selected_level"
    | "standout_for_selected_level"
    | "benchmark_level_evidence";
  public_statement: string;
  selected_level_standard: string;
  brief_achievement_summary?: string;
  main_risks: string[];
  evidence_refs: EvidenceRef[];
};

type VerdictRationale = {
  summary: string;
  main_reasons: string[];
  readiness_drivers: string[];
  readiness_risks: string[];
  evidence_refs: EvidenceRef[];
};

type Strength = {
  title: string;
  what_is_working: string;
  why_it_matters: string;
  preserve_in_next_take: boolean;
  linked_components?: string[];
  linked_categories?: string[];
  evidence_refs: EvidenceRef[];
};

type Improvement = {
  title: string;
  what_to_change: string;
  why_it_matters: string;
  how_to_change: string;
  urgency: "retake_critical" | "quick_win" | "craft_refinement" | "setup_refinement";
  linked_components?: string[];
  linked_categories?: string[];
  evidence_refs: EvidenceRef[];
};

type LevelGapSummary = {
  selected_level: PerformerLevel;
  current_gap: string;
  closest_next_standard: string;
  standout_delta?: string;
  evidence_refs: EvidenceRef[];
};

type ActionPlanItem = {
  action_id: string;
  action: string;
  reason: string;
  source_priority_rank?: number;
  rehearsal_only: boolean;
  recorded_take_change: boolean;
  linked_improvement_ids?: string[];
  evidence_refs: EvidenceRef[];
};

type ComponentBreakdown = {
  component_id: string;
  component_label: string;
  component_type:
    | "acting_scene"
    | "monologue"
    | "song"
    | "dance"
    | "commercial"
    | "slate"
    | "transition"
    | "hybrid_link"
    | "other";
  component_purpose: string;
  criticality: "essential" | "supporting" | "optional" | "administrative" | "unknown";
  assessability_status: "sufficient" | "partial" | "not_assessable" | "not_present" | "not_relevant";
  key_strengths: string[];
  key_gaps: string[];
  judgement_summary: string;
  relation_to_brief?: string;
  relation_to_categories?: string[];
  evidence_refs: EvidenceRef[];
};

type CategoryRationale = {
  category_id: string;
  category_label: string;
  score_band?: string;
  what_works: string;
  why_not_full_score?: string;
  close_gap: string;
  standout_delta?: string;
  limitation_type: "performance" | "assessability" | "mixed" | "not_applicable";
  evidence_refs: EvidenceRef[];
};

type TimestampedNote = {
  timestamp: string;
  end_timestamp?: string;
  note: string;
  note_type: "strength" | "improvement" | "priority_fix" | "assessability" | "brief_achievement" | "component_evidence";
  linked_components?: string[];
  linked_categories?: string[];
  evidence_anchor_ids: string[];
};

type AssessabilityNote = {
  note_id: string;
  area: "video" | "audio" | "framing" | "continuity" | "material" | "brief" | "component" | "technique";
  limitation: string;
  effect_on_feedback: string;
  public_wording: string;
  evidence_refs: EvidenceRef[];
};

type TechnicalSetupSignal = {
  signal_id: string;
  area: "audio" | "lighting" | "framing" | "camera" | "upload" | "reader" | "accompaniment";
  signal: string;
  impact: "none" | "minor" | "material" | "blocks_assessment";
  action?: string;
  evidence_refs: EvidenceRef[];
};

type TechniqueSkillFeedback = {
  feedback_id: string;
  technique_or_skill: string;
  public_authority_status:
    | "public_named_technique"
    | "public_safe_descriptor"
    | "limitation_only"
    | "internal_shadow"
    | "blocked";
  detection_status: "present" | "possible" | "absent" | "not_assessable" | "not_applicable";
  selected_level_judgement?: string;
  preserve?: string;
  improve?: string;
  evidence_refs: EvidenceRef[];
};

type RepertoireContextFeedback = {
  feedback_id: string;
  repertoire_context: string;
  knowledge_state:
    | "accepted_library"
    | "research_supported_provisional"
    | "research_discovered"
    | "stale_requires_refresh"
    | "conflicting_sources"
    | "missing"
    | "not_applicable";
  safe_public_summary: string;
  public_claim_allowed: boolean;
  evidence_refs: EvidenceRef[];
};

type ComparisonSummary = {
  comparison_state:
    | "duplicate_near_duplicate_detected"
    | "no_reliable_material_difference"
    | "analysis_variance_warning"
    | "marginal_preference"
    | "clear_winner"
    | "recommendation_suppressed";
  public_summary: string;
  recommended_take_id?: string;
  recommendation_allowed: boolean;
  evidence_delta_ids: string[];
  suppression_reason?: string;
  evidence_refs: EvidenceRef[];
};

type BriefContextSummary = {
  brief_present: boolean;
  supplied_context_summary: string;
  no_brief_mode: boolean;
  unresolved_or_ambiguous_items: string[];
};

type BriefAchievementSummary = {
  overall_status:
    | "achieved"
    | "mostly_achieved"
    | "partially_achieved"
    | "not_achieved"
    | "not_assessable"
    | "not_applicable";
  summary: string;
  mandatory_requirements_status: string;
  readiness_impact: BriefRequirement["readiness_impact"];
  evidence_refs: EvidenceRef[];
};
```

`EvidenceRef.truth_state_entry_ids` is required for every non-limitation source. It may be empty only when `source = "assessability_limit"` and `limitation_only = true`; in that case the referenced limitation must still appear in `assessability_notes[]` or `TruthStateMap`.


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

### 3.7 Public scoring unblock criteria

`PUBLIC-SCORING-GATE` remains blocked by default. It may pass only when all of the following are true:

1. `ScoreTrace.json` is emitted from real runtime v3 scoring logic, not legacy report snapshots.
2. Score evidence links to selected level, audition type, brief achievement and component evidence.
3. Public score wording makes the selected-level standard explicit.
4. Repeated same-video and route-variance fixtures do not produce materially unstable public scores.
5. The score is not used to force a comparison winner without evidence delta.
6. Public/private leakage tests prove internal calibration metadata and raw scoring traces are not exposed.
7. Approved testers understand the score as level-relative and do not read it as a booking, recall or marketability prediction.
8. Product owner / release governance explicitly records approval in `GateTrace` and the release-risk register.

Until those conditions pass, raw overall readiness scores may be used only internally for calibration, QA, traces and comparison safety diagnostics.


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

```ts
type TechniqueLevelStandard = {
  standard_summary: string;
  expected_characteristics: string[];
  developing_characteristics: string[];
  insufficient_characteristics: string[];
  standout_delta: string[];
  common_level_specific_faults: string[];
  assessability_limits: string[];
  safe_recommendations: string[];
  blocked_recommendations: string[];
};
```

`TechniqueStandard.evidence_requirements.cannot_assess_if[]` applies universally. `TechniqueLevelStandard.assessability_limits[]` may add level-specific limits, but must not weaken or override the parent `cannot_assess_if[]` list.

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


Authority tiers:

| Tier | Meaning | Public-use posture |
|---|---|---|
| 1 | Supplied brief, official audition pack, production-provided material, official show/licensing page or project-approved source material. | Strongest for task context, subject to tape evidence and validators. |
| 2 | Expert-reviewed internal standard, teacher/choreographer/vocal/acting review, benchmark fixture. | Strong for “what good looks like”; may support public claims if gates pass. |
| 3 | Reputable theatre/dance/music scholarship, programme notes, interviews or project-approved contextual research. | Useful context; normally needs review before scoring or public authority. |
| 4 | Public videos, social clips, blogs or informal commentary. | Discovery only; not sufficient for public authority alone. |
| 5 | Unattributed, conflicting, stale or low-quality material. | Blocked or internal gap signal only. |

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



```ts
type KnowledgeCoverageDecision = {
  coverage_state:
    | "accepted_coverage_sufficient"
    | "accepted_coverage_partial"
    | "library_missing"
    | "library_stale"
    | "sources_conflict"
    | "brief_ambiguous"
    | "research_not_needed";
  invoke_controlled_research: boolean;
  reason: string;
  public_authority_allowed_before_review: false;
};
```

Controlled research should be invoked when accepted library coverage is missing, stale, conflicting or too thin for the supplied brief/material. It should be suppressed when the accepted library is sufficient, the run is no-brief baseline with no repertoire context, or the proposed research would not change an evidence-led recommendation.

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

Active-learning governance:

- Candidate examples are isolated from accepted technique/repertoire standards until human or expert review promotes them.
- Candidate queues must be private/internal and must not alter public output directly.
- Library snapshots use immutable IDs such as `technique.1.3.0` or `repertoire.0.4.0`.
- A promoted snapshot must pass fixture regression tests before release.
- Rollback must restore the previous accepted snapshot and suppress any public wording introduced by the failed snapshot.
- Library-level P0 regressions require immediate rollback. P0 includes unsafe public wording, protected-characteristic inference, public authority leakage, same-video false winner, or unsupported definitive repertoire/technique claims.
- Library-level P1 regressions block the public release slice. P1 includes measurable benchmark degradation, mandatory-brief mapping failures, or a rise in false public technique/repertoire claims across the fixture set.

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

### 17.1 Comparison invocation contract

Comparison must be explicitly invoked. Ordinary single-take analysis must not run comparison by default.

Allowed initiator classes:

| Initiator | Allowed use | Conditions |
|---|---|---|
| `user_flow` | Future user-facing comparison. | Disabled until public comparison gates pass. |
| `approved_tester` | Locked-down QA comparison. | Named fixture/test plan and Team G validation. |
| `operator_internal` | Admin/operator validation. | Authenticated admin/operator path, feature flag enabled, completed take resolution, manifest + metrics reconciliation. |
| `system_internal` | Automated QA/regression only. | Named test plan, fixture set, feature flag, release-gate purpose and no public output. |

The first comparison artefact must be:

```text
comparison/comparison_invocation_record.json
```

```ts
type ComparisonInvocationRecord = {
  schema_version: string;
  invocation_id: string;
  run_id: string;
  comparison_run_id: string;
  root_take_id: string;
  compared_take_ids: string[];
  compared_analysis_run_ids: string[];
  initiator_class: "user_flow" | "approved_tester" | "operator_internal" | "system_internal";
  comparison_reason:
    | "operator_validation"
    | "qa_validation"
    | "same_video_check"
    | "route_variance_check"
    | "release_gate_fixture"
    | "user_requested_comparison";
  public_comparison_output_allowed: boolean;
  manifest_reconciliation_mode: "none" | "required";
  feature_flags: Record<string, boolean>;
  created_at: string;
};
```

No comparison raw JSON, evidence delta or rendered comparison may be emitted before this invocation record exists.

### 17.2 GF-01 and RT-15

`GF-01` is the same-video false-winner gate. It passes only when identical or near-identical inputs produce duplicate/no-material-difference/suppressed states unless a decisive evidence delta is independently proven.

Required GF-01 evidence:

- duplicate or near-duplicate detection trace;
- evidence-delta trace showing no forced score-rank winner;
- comparison suppression trace where no reliable material difference exists;
- public comparison output permission set to false unless the gate passes.

`RT-15` is the repeatability and route-variance gate. It passes only when repeated runs or route variants on identical/near-identical inputs are stable, or when instability is classified as analysis/validator variance and public recommendation is suppressed.

Required RT-15 evidence:

- same-video repeatability trace;
- route-variance trace;
- model-run trace for each model-invoked stage;
- validator trace with validator model version where model-assisted checks are used;
- clear suppression or no-material-difference output when variance prevents a reliable recommendation.

GF-01 or RT-15 failure is P0 for public comparison.

### 17.3 Same-video and duplicate-upload detection

Same-video and duplicate-upload detection is a comparison-safety requirement. It exists to prevent TapeCoach from selecting a winner, recommendation or comparison preference when the compared takes are the same recording, near-duplicate recordings or insufficiently distinguishable.

Runtime identifiers are diagnostic only. They must not be treated as proof that two uploaded videos contain different media.

Diagnostic runtime identifiers include:

```text
take_id
analysis_run_id
mux_playback_id
mux_asset_id
mux_upload_id
storage object path
comparison_run_id
```

These identifiers may prove that two references are the same stored object when they match. They do not prove that videos differ when they do not match, because every new upload can receive a new take ID, analysis ID, Mux playback reference and storage reference even when the underlying media is the same.

If upload-level or content-level duplicate evidence is unavailable, the system must classify duplicate detection as `insufficient_evidence`, not cleanly `not_detected`.

#### Duplicate detection statuses

Duplicate detection must emit a status and confidence value:

```text
duplicate_detection_status:
  detected
  likely_duplicate
  possible_duplicate
  insufficient_evidence
  not_detected

duplicate_detection_confidence:
  0-100 internal confidence score
```

This confidence score is an internal duplicate-detection score. It is not a performer score, readiness score, public score, quality score or casting score.

Recommended status bands:

```text
90-100 = detected
70-89  = likely_duplicate
45-69  = possible_duplicate
0-44   = not_detected only when enough reliable upload/content evidence exists and indicates different media
unknown / missing content evidence = insufficient_evidence
```

`not_detected` is valid only when enough reliable upload-level or content-level signals were inspected and indicate different media. Lack of duplicate evidence is not evidence of different media.

#### Tier 1 — same-user, same-audition duplicate detection

Tier 1 is the S9-16 implementation target.

Tier 1 duplicate detection is scoped to:

```text
same user profile
same audition / submission group
same comparison context
```

Do not compare duplicate fingerprints across the entire database. Global matching adds privacy and performance cost with little product value at this maturity stage.

Tier 1 is confidence-based. It must not require every signal to match.

A video may still be classified as `detected` or `likely_duplicate` when weaker signals differ, such as filename or duration, if stronger upload/content signals match.

Example:

```text
file name differs
video duration differs
but original upload hash, file size, opening/closing video samples, and opening/closing audio profiles match
=> duplicate_detection_status = detected or likely_duplicate
```

Tier 1 may use the following signals:

```text
original_upload_file_hash
visible_or_original_file_name
metadata_file_name
file_size_bytes
video_duration_ms
opening_video_sample_hash_or_profile
closing_video_sample_hash_or_profile
opening_audio_profile_hash
closing_audio_profile_hash
operator_same_video_assertion
```

`operator_same_video_assertion` is internal QA-only. It may be used for controlled duplicate-test mode and must never become public output or user-facing evidence by itself.

Implementation may calibrate exact weights, but it must preserve these principles:

| Signal | Strength | Requirement |
|---|---:|---|
| Original upload file hash exact match | Decisive | May set confidence to 100 and status to `detected`. |
| Opening video sample match | Strong | Must be a sampled window, not one frame. |
| Closing video sample match | Strong | Must avoid final black/fade/end-card frames where possible. |
| Opening audio profile match | Strong | Must use a short audio window, not one instant. |
| Closing audio profile match | Strong | Must use a short audio window, not one instant. |
| File size exact or near match | Medium | Useful with stronger signals; not decisive alone. |
| Metadata file name match | Medium | Stronger than user-facing filename but not decisive alone. |
| Visible/original file name match | Weak-to-medium | Useful but user-controlled and not decisive. |
| Video duration exact or near match | Weak-to-medium | Useful but may be a red herring if the same video is trimmed. |

A suggested deterministic score model is:

```text
original_upload_file_hash exact match => 100 / detected

otherwise, score available non-hash signals:
opening_video_sample_match       20
closing_video_sample_match       20
opening_audio_profile_match      15
closing_audio_profile_match      15
file_size_exact_or_near_match    10
metadata_file_name_match          8
visible_file_name_match           5
video_duration_exact_or_near      7
```

The score model must be deterministic so repeated analysis of the same evidence produces the same duplicate-detection status and confidence band.

#### Sampling-window requirement

Opening and closing samples must use a sufficient duration window, not a single frame or one instant.

Many self-tapes begin with a slate, ident, introduction, framing adjustment or performer stillness. The first frame or first second may look similar across different takes and create false positives.

Recommended Tier 1 sampling behaviour:

```text
opening_video_sample_window:
  skip the first 3-5 seconds where possible;
  sample a 5-10 second window after the likely slate/intro;
  use multiple frames or a compact profile over the window.

closing_video_sample_window:
  sample a 5-10 second window before the final fade, black frame, end card, or freeze;
  avoid relying only on the final frame.

opening_audio_profile_window:
  use the same opening window as video where possible;
  profile the short duration, not a single sample.

closing_audio_profile_window:
  use the same closing window as video where possible;
  profile the short duration, not a single sample.
```

If the video is too short for the recommended windows, the system may use shorter windows but must lower confidence or record a sampling limitation.

#### Tier 1 artefact contract

Tier 1 must emit an internal comparison artefact, preferably:

```text
comparison/duplicate_detection_trace.json
```

Required fields:

```text
artefact_type
schema_version
run_id
analysis_run_id
comparison_run_id
compared_take_ids
internal_only
privacy_classification
same_user_scope
same_audition_scope
duplicate_detection_status
duplicate_detection_confidence
duplicate_detection_basis
duplicate_detection_evidence_refs
signals_available
signals_missing
signals_matched
signals_conflicting
operator_same_video_assertion
sampling_window_summary
sampling_limitations
public_output_unchanged
cannot_satisfy_level2_comparison_gate
blocker_codes
```

The artefact must not emit signed URLs, secret tokens, raw private media URLs, full media paths or user-identifying raw file paths.

#### Tier 2 — later maturity near-duplicate sampling

Tier 2 is deferred until later development maturity because the current product still has higher-value user-facing and evidence-gate work.

Tier 2 may add more robust near-duplicate detection within the same user profile, such as:

```text
perceptual opening/closing frame hashes
middle-window frame/audio sampling
duration-normalised sample windows
tolerance thresholds for trimmed or re-encoded files
stronger audio-profile comparison
near-duplicate confidence calibration
```

Tier 2 should remain scoped to same user and, by default, same audition/submission group. Cross-audition same-user matching may be added only if it has clear product value and safe privacy/performance handling.

#### Tier 3 — future normalised media fingerprinting

Tier 3 is the gold-standard future state and is explicitly out of immediate S9-16 scope.

Tier 3 may add normalised media fingerprinting:

```text
normalised video fingerprint
normalised audio fingerprint
original upload hash combined with perceptual fingerprints
same-user profile fingerprint lookup
optional same-user cross-audition lookup
```

Fingerprint lookup should be scoped to the same user profile. It must not compare audition tapes across the full database unless a separate privacy, performance, retention and product-value case is approved.

Tier 3 is deferred because its near-term user value is lower than current low-hanging improvements such as clearer readiness reporting, brief itemisation, safer limitations, report parity, no-export proof and Level 2 evidence correctness.

#### Comparison-gate behaviour for duplicate detection

Comparison parity must consume duplicate-detection output.

Rules:

```text
duplicate_detection_status = detected
  => suppression_required = true
  => internal winner/recommendation suppressed unless decisive evidence_delta_trace proves material difference

duplicate_detection_status = likely_duplicate
  => suppression_required = true
  => internal winner/recommendation suppressed unless decisive evidence_delta_trace proves material difference

duplicate_detection_status = possible_duplicate
  => comparison parity insufficient unless evidence_delta_trace proves material difference

duplicate_detection_status = insufficient_evidence
  => comparison parity insufficient, not passed

duplicate_detection_status = not_detected
  => comparison parity may proceed only if enough reliable upload/content evidence was inspected and indicates different media
```

If duplicate or likely duplicate is detected and no decisive material difference is proven, comparison output must be suppressed or classified as non-satisfying internal-only evidence.

Comparison parity must not pass when duplicate detection is missing, insufficient or based only on runtime/reference ID inequality.

For comparison-invoked runs, Level 2 comparison proof requires the comparison family to reconcile together:

```text
comparison/comparison_invocation_record.json
comparison/comparison_raw.json
comparison/comparison_report_internal.json
comparison/same_video_repeatability_trace.json
comparison/duplicate_detection_trace.json
comparison/no_material_difference_trace.json, or equivalent explicit status within duplicate trace
comparison/evidence_delta_trace.json, where a winner/preference is selected
comparison/comparison_suppression_trace.json
comparison/route_variance_trace.json
parity/comparison_parity.json
manifest.json
qa/acceptance_metrics.json
```

Missing duplicate, no-material-difference, suppression or evidence-delta proof must keep comparison parity non-satisfying.

### 17.4 S9-16 development sequence

S9-16 must proceed in small slices so implementation does not drift back into review-led design.

#### S9-16A — duplicate detection contract and documentation

Update README and roadmap with this Tier 1 / Tier 2 / Tier 3 duplicate-detection contract.

Acceptance:

```text
README states runtime identifiers cannot prove media difference.
README defines confidence-based Tier 1 duplicate detection.
Roadmap defers Tier 2 and Tier 3.
No runtime source changes required in this slice.
```

#### S9-16B — Tier 1 media identity capture

Persist safe Tier 1 upload/content signals where available.

Acceptance:

```text
original_upload_file_hash captured when available;
file names / metadata filename / file size / duration captured when available;
opening/closing video/audio sample windows recorded or truthfully unavailable;
missing signals recorded as unavailable, not treated as not_detected;
no public output changes.
```

#### S9-16C — DuplicateDetectionTrace implementation

Emit `comparison/duplicate_detection_trace.json` and compute confidence.

Acceptance:

```text
detected / likely_duplicate / possible_duplicate / insufficient_evidence / not_detected implemented;
confidence score deterministic;
operator_same_video_assertion supported for internal QA duplicate-test mode;
trace is internal-only and safe.
```

#### S9-16D — same-video, suppression, and comparison parity integration

Feed duplicate detection into same-video repeatability, suppression, internal comparison report, comparison parity, manifest and metrics.

Acceptance:

```text
same uploaded video as two different takes is detected or classified insufficient;
reference-ID inequality does not prove different videos;
duplicate/likely duplicate requires suppression unless decisive evidence delta exists;
comparison parity cannot pass on missing duplicate evidence;
public output unchanged.
```

#### S9-16E — base-take Level 2 blocker cleanup

Correct the non-comparison blockers revealed by the real runtime bundle.

Acceptance:

```text
AnalysisEvidenceState partial is not labelled missing;
EvidenceAnchors metrics reflect real_runtime_v3 partial anchors;
ordinary single-take runs are not blocked solely by missing comparison artefacts;
report parity emits or truthfully blocks;
no-export proof lanes emit or truthfully block.
```

#### S9-16F — real-runtime rerun and Level 2 audit

Run both an ordinary base take and a same-video duplicate comparison.

Acceptance:

```text
manifest and qa_acceptance_metrics align;
duplicate comparison suppresses false winner or remains insufficient;
Level 2 remains not_accepted unless every required gate truly satisfies;
production/public gates remain blocked unless separately accepted.
```

---

## 18. QA artefacts and runtime evidence

Every QA run should emit a structured internal artefact bundle that can prove what happened without relying on screenshots or manual PDFs.

Artefacts are internal-only and must not leak into public output.

The current S9 live Storage validation target is the 12-file analysis-run bundle (when TechniqueObservationTrace and ScoreTrace source data exists) listed in `Current internal QA / S9 implementation state`. That passing bundle is not the full Level 2 artefact target.

Minimum target analysis-run artefacts, using canonical relative paths under the analysis root:

- `manifest.json`
- `qa/acceptance_metrics.json`
- `inputs/input_record.json`
- `inputs/submission.json`
- `inputs/take.json`
- `resolver/resolver_output.json`
- `resolver/TruthStateMap.json`
- `analysis/AnalysisEvidenceState.json`
- `reports/raw_report.json`
- `reports/render_payload.json`
- rendered report artefact
- `traces/EvidenceAnchors.json`
- `traces/PublicClaimTrace.json`
- `traces/TechniqueObservationTrace.json` where relevant
- `traces/ScoreTrace.json`
- `traces/ModelRunTrace.json` plus per-stage `traces/model-runs/{stage}.json` where invoked
- `traces/ValidatorTrace.json`
- `traces/GateTrace.json`
- `traces/redaction_trace.json`
- `traces/UKEnglishGateResult.json`
- `traces/public_private_leakage_result.json`
- `parity/report_parity_result.json`

Minimum comparison-run artefacts, when comparison is explicitly invoked:

- `comparison/comparison_invocation_record.json`
- `comparison/comparison_raw.json`
- `comparison/comparison_report_internal.json`
- rendered comparison artefact
- `comparison/same_video_repeatability_trace.json`
- `comparison/duplicate_detection_trace.json`
- `comparison/no_material_difference_trace.json`, or equivalent explicit status within duplicate trace
- `comparison/evidence_delta_trace.json` where a winner/preference is selected
- `comparison/comparison_suppression_trace.json`
- `comparison/route_variance_trace.json`
- `parity/comparison_parity.json`

Export handling:

- if export exists, emit `export_manifest.json` and `render_to_export_parity.json`;
- if export does not exist, emit no-export proof from source, config, UI and logs;
- manual print PDFs are rendered / manual-print evidence only and do not prove export parity.

Blocked or not-executed artefacts must be clearly marked:

```ts
type ArtefactEvidenceStatus =
  | "emitted"
  | "emitted_blocked"
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

Assignment table:

| Artefact | Classification |
|---|---|
| `BriefRequirementTrace.json` | `required_for_L2` once brief engine is in scope. |
| `BriefAchievementTrace.json` | `required_for_L2` once brief engine is in scope. |
| `TechniqueStandardsTrace.json` | `required_for_specialist_feedback`. |
| `TechniqueDetectionTrace.json` | `required_for_specialist_feedback`; required for public technique authority where public technique feedback is rendered. |
| `KnowledgeSourceTrace.json` | `required_for_public_authority` for specialist/repertoire claims. |
| `RepertoireResolutionTrace.json` | `required_for_repertoire_feedback`. |
| `RepertoireResearchTrace.json` | `required_for_repertoire_feedback` when controlled research is invoked. |
| `ResearchAugmentedSpecificityTrace.json` | `required_for_repertoire_feedback` when provisional research informs output. |
| `ActiveLearningCandidateTrace.json` | `internal_maturity_only`. |
| `ReviewTaskTrace.json` | `internal_maturity_only`. |
| `KnowledgeCoverageSummary.json` | `required_for_specialist_feedback` and `required_for_repertoire_feedback` where coverage state affects output. |

### 18.2 Canonical artefact path register

All relative paths below are relative to the canonical analysis root `take-[core]/analysis-[analysis_run_id]/` in Storage mode.

| Artefact | Canonical relative path | Notes |
|---|---|---|
| Input record | `inputs/input_record.json` | S9 member. |
| Submission | `inputs/submission.json` | S9 member. |
| Take | `inputs/take.json` | S9 member. |
| Raw report | `reports/raw_report.json` | Current first-pass may be legacy snapshot. |
| Resolver output | `resolver/resolver_output.json` | S9 member. |
| TruthStateMap | `resolver/TruthStateMap.json` | S9 member. |
| Analysis evidence state | `analysis/AnalysisEvidenceState.json` | Required persisted Step 1 handoff target. |
| Evidence anchors | `traces/EvidenceAnchors.json` | First-pass may be legacy-derived. |
| Public claim trace | `traces/PublicClaimTrace.json` | First-pass may be legacy-derived. |
| Technique observation trace | `traces/TechniqueObservationTrace.json` | Emits only where source data exists. |
| Score trace | `traces/ScoreTrace.json` | Internal calibration only unless public score gate passes. |
| Model run trace index | `traces/ModelRunTrace.json` | May aggregate per-stage traces. |
| Per-stage model run trace | `traces/model-runs/{stage}.json` | Required target for each model-invoked stage. |
| Validator trace | `traces/ValidatorTrace.json` | Target independent validation proof. |
| Gate trace | `traces/GateTrace.json` | Target release/gate proof. |
| Render payload | `reports/render_payload.json` | Required before render parity. |
| Rendered report | `reports/rendered_report.*` | Format may vary; internal proof only. |
| Report parity | `parity/report_parity_result.json` | Required for L2-B. |
| Redaction trace | `traces/redaction_trace.json` | Required for L2-E. |
| UK English result | `traces/UKEnglishGateResult.json` | Required for L2-E. |
| Public/private leakage result | `traces/public_private_leakage_result.json` | Required for L2-E. |
| Manifest | `manifest.json` | Required bundle classifier. |
| Acceptance metrics | `qa/acceptance_metrics.json` | Required bundle summary. |

Comparison artefacts, when invoked, use these canonical relative paths under the same root take analysis identity unless a future comparison-specific root is approved in this README:

| Artefact | Canonical relative path |
|---|---|
| Invocation record | `comparison/comparison_invocation_record.json` |
| Comparison raw | `comparison/comparison_raw.json` |
| Internal comparison report | `comparison/comparison_report_internal.json` |
| Rendered comparison | `comparison/comparison.rendered.*` |
| Same-video repeatability | `comparison/same_video_repeatability_trace.json` |
| Duplicate detection | `comparison/duplicate_detection_trace.json` |
| No material difference | `comparison/no_material_difference_trace.json` or equivalent explicit status within duplicate trace |
| Evidence delta | `comparison/evidence_delta_trace.json` where a winner/preference is selected |
| Suppression trace | `comparison/comparison_suppression_trace.json` |
| Route variance | `comparison/route_variance_trace.json` |
| Comparison parity | `parity/comparison_parity.json` |

### 18.3 Truth, evidence and trace schemas

```ts
type TruthState =
  | "user_supplied"
  | "brief_supplied"
  | "material_supplied"
  | "observed_video"
  | "observed_audio"
  | "accepted_library"
  | "research_supported_provisional"
  | "professional_standard"
  | "inferred_low_confidence"
  | "unknown"
  | "unavailable"
  | "conflicting"
  | "blocked";

type TruthStateEntry = {
  truth_state_entry_id: string;
  key: string;
  state: TruthState;
  value_summary?: string;
  confidence: "high" | "medium" | "low";
  source_artifact_ids: string[];
  evidence_anchor_ids: string[];
  public_claim_allowed: boolean;
  public_claim_limit?: "direct" | "cautious" | "limitation_only" | "blocked";
};

type TruthStateMap = {
  schema_version: string;
  artefact_id: string;
  run_id: string;
  take_id: string;
  entries: TruthStateEntry[];
  unresolved_inputs: string[];
  conflicts: string[];
  blocked_inferences: string[];
};

type ResolverOutput = {
  schema_version: string;
  artefact_id: string;
  run_id: string;
  take_id: string;
  selected_level?: PerformerLevel;
  audition_type?: AuditionType;
  brief_presence: "supplied" | "absent" | "unknown";
  material_presence: "supplied" | "absent" | "unknown";
  no_brief_mode: boolean;
  public_safe_context_summary?: string;
  public_safe_context_summary_classification: "internal_only" | "public_claim_trace_required";
  truth_state_map_id: string;
};

type AnalysisEvidenceState = {
  schema_version: string;
  artefact_id: string;
  run_id: string;
  take_id: string;
  analysis_run_id: string;
  resolver_artifact_id: string;
  truth_state_map_id: string;
  media_duration_seconds?: number | null;
  evidence_anchor_ids: string[];
  component_evidence_ids: string[];
  assessability_limit_ids: string[];
  brief_requirement_ids: string[];
  technique_candidate_ids: string[];
  status: "complete" | "partial_failed" | "failed_emission";
};

type EvidenceAnchor = {
  evidence_anchor_id: string;
  run_id: string;
  take_id: string;
  source_classification:
    | "real_runtime_v3"
    | "legacy_adapter"
    | "report_snapshot"
    | "input_artifact"
    | "resolver_truth_state"
    | "manual_operator_evidence";
  modality: "video" | "audio" | "brief" | "material" | "metadata" | "professional_standard";
  timestamp?: string;
  end_timestamp?: string;
  evidence_text: string;
  truth_state_entry_ids: string[];
  component_ids?: string[];
  confidence: "high" | "medium" | "low";
  assessability_status: "sufficient" | "partial" | "not_assessable" | "not_present" | "not_relevant";
  cannot_satisfy_v3_gate: boolean;
};

type PublicClaimTrace = {
  schema_version: string;
  artefact_id: string;
  run_id: string;
  take_id: string;
  claims: Array<{
    claim_id: string;
    public_section: string;
    claim_text: string;
    claim_status: "supported" | "unsupported" | "overclaim" | "unsafe" | "rewrite_required" | "suppressed";
    evidence_anchor_ids: string[];
    truth_state_entry_ids: string[];
    validator_rule_ids: string[];
    final_public_text?: string;
  }>;
};
```

Manual operator evidence may support L0/L1 diagnosis or release-governance notes, but it must not satisfy L2-A real-runtime evidence gates, public-claim gates, public technique authority or comparison safety gates by itself.

### 18.4 ModelRunTrace, ValidatorTrace and GateTrace

`ModelRunTrace` is required once per model-invoked stage. `traces/ModelRunTrace.json` may be an index, but the target contract also requires stage-addressable records such as `traces/model-runs/analysis_step_1.json`, `traces/model-runs/analysis_step_2.json`, `traces/model-runs/validator.json` and `traces/model-runs/comparison.json` where invoked.

```ts
type ModelRunTrace = {
  schema_version: string;
  artefact_id: string;
  run_id: string;
  take_id?: string;
  stage:
    | "analysis_step_1"
    | "analysis_step_2"
    | "validator"
    | "render"
    | "comparison"
    | "brief_extraction"
    | "research";
  model_provider?: string;
  model_name?: string;
  model_version?: string;
  prompt_version?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  timeout_ms?: number;
  request_status: "completed" | "failed" | "timed_out" | "skipped" | "unknown";
  retry_count: number;
  fallback_used: boolean;
  safe_error_category?: string;
  raw_prompt_or_response_stored: false;
};

type ValidatorTrace = {
  schema_version: string;
  artefact_id: string;
  run_id: string;
  validator_version: string;
  validator_model_version?: string;
  deterministic_checks_version: string;
  referential_integrity_status: "pass" | "fail" | "not_run";
  results: ValidatorResult[];
  override?: ValidatorOverride;
};

type ValidatorResult = {
  rule_id: string;
  rule_version: string;
  status: "pass" | "fail" | "warning" | "not_applicable";
  severity: "P0" | "P1" | "P2" | "P3";
  response: "fail_run" | "rewrite" | "suppress" | "flag_for_review" | "record_only";
  affected_claim_ids?: string[];
  affected_gate_ids?: string[];
  message: string;
};

type ValidatorOverride = {
  requested_by_role: "product_owner" | "release_governance";
  authorised_by: string;
  audit_record_id: string;
  audit_record_target: "release_risk_register" | "governance_log" | "issue_tracker";
  reason: string;
  affected_gate_ids: string[];
  affected_validator_rule_ids: string[];
  retention_until: string;
};

type GateTrace = {
  schema_version: string;
  artefact_id: string;
  run_id: string;
  gate_registry_version: string;
  gate_decisions: Array<{
    gate_id: string;
    status: "passed" | "blocked" | "not_accepted" | "missing" | "deferred" | "not_applicable";
    reason: string;
    evidence_artefact_ids: string[];
    validator_rule_ids: string[];
    decided_by: "validator" | "release_governance" | "product_owner";
    decision_record_id?: string;
  }>;
  public_output_permissions: {
    show_overall_score: boolean;
    show_public_technique_names: boolean;
    show_repertoire_claims: boolean;
    show_comparison_recommendation: boolean;
    show_public_report: boolean;
  };
};
```

The render layer must read and enforce `GateTrace.public_output_permissions`. It must not render public output for any permission set to `false`, even if the render payload contains the relevant content.

Human gate decisions must be recorded through a signed/authorised governance mechanism, such as a release-risk register entry or governance log, and imported into `GateTrace` with a resolvable `decision_record_id`. They must not be hand-edited into runtime artefacts without audit metadata.

### 18.5 Manifest and acceptance metrics contracts

```ts
type Manifest = {
  schema_version: string;
  run_id: string;
  analysis_run_id: string;
  take_id: string | null;
  comparison_run_id?: string | null;
  generated_at: string;
  qa_artifact_root: string;
  storage_bucket?: string | null;
  storage_key_root?: string | null;
  required_artifacts: Array<{
    artefact_id: string;
    expected_path: string;
    category: "analysis_run" | "comparison_run" | "export_no_export" | "qa_summary";
    status: ArtefactEvidenceStatus;
    blocker_code?: string;
    reason?: string;
    schema_version?: string;
  }>;
  emitted_artifacts: string[];
  emitted_blocked_artefact_ids: string[];
  missing_artifacts: string[];
  deferred_artifact_ids: string[];
  not_applicable_artifact_ids: string[];
  failed_emission_artifact_ids: string[];
  artefact_status_by_id: Record<string, ArtefactEvidenceStatus>;
  artefact_source_classification_by_id: Record<string, string>;
  artefact_level2_spine_satisfaction_by_id: Record<string, boolean>;
  legacy_adapter_artefact_ids: string[];
  real_v3_spine_artefact_ids: string[];
  blocker_codes: string[];
};

type AcceptanceMetrics = {
  schema_version: string;
  artefact_type: "qa_acceptance_metrics";
  run_id: string;
  take_id: string | null;
  comparison_run_id?: string | null;
  bundle_completeness: "complete" | "partial" | "failed";
  level2_status: "passed" | "not_accepted" | "blocked";
  level3_status: "passed" | "blocked" | "not_accepted";
  level4_status: "passed" | "blocked" | "not_accepted";
  extended_run: boolean;
  gate_summary: Record<string, "passed" | "blocked" | "not_accepted" | "missing" | "deferred" | "not_applicable">;
  legacy_adapter_count: number;
  failed_emission_count: number;
  artefact_statuses: Record<string, ArtefactEvidenceStatus>;
  public_scoring_status: "blocked" | "approved";
  public_technique_authority_status: "blocked" | "approved";
  production_safe_status: "blocked" | "approved";
};
```

The manifest is a classifier. It must never turn a missing, failed, legacy, first-pass or blocked artefact into passing gate evidence.

### 18.6 Artefact dependency graph

| Artefact | Depends on |
|---|---|
| `inputs/*` | user upload/submission/take records |
| `resolver/resolver_output.json` | `inputs/*` |
| `resolver/TruthStateMap.json` | `inputs/*`, resolver output |
| `analysis/AnalysisEvidenceState.json` | resolver output, TruthStateMap, media readiness |
| `traces/EvidenceAnchors.json` | AnalysisEvidenceState, media evidence, TruthStateMap |
| `traces/TechniqueObservationTrace.json` | EvidenceAnchors, TechniqueStandards where relevant |
| `traces/ScoreTrace.json` | AnalysisEvidenceState, component evidence, selected-level standards |
| `reports/raw_report.json` | AnalysisEvidenceState, ScoreTrace, brief achievement where relevant |
| `traces/PublicClaimTrace.json` | raw report, EvidenceAnchors, TruthStateMap |
| `traces/ValidatorTrace.json` | all applicable upstream artefacts and referential-integrity pre-check |
| `traces/GateTrace.json` | ValidatorTrace, manifest classifications, release governance inputs |
| `reports/render_payload.json` | GateTrace public-output permissions and validated report data |
| rendered report | render payload |
| parity result | render payload and rendered report |
| `manifest.json` | emitted artefacts and sink statuses |
| `qa/acceptance_metrics.json` | manifest and gate summaries |
| comparison invocation record | explicit comparison trigger |
| comparison raw/evidence delta/suppression traces | invocation record and persisted take evidence |

### 18.7 Validator rule registry

Validator rule IDs must be stable and resolvable in a named rule registry. Suggested format:

```text
DOMAIN_SUBTYPE_NNN
GENERIC_PHRASE_ANCHOR_003
BRIEF_ACHIEVEMENT_MANDATORY_001
PUBLIC_PRIVATE_LEAKAGE_001
```

Deprecated rules must be marked inactive rather than deleted so historical traces remain legible. Overrides must reference active or historically known rule IDs.

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

### 19.0 Approved tester and fixture registry requirements

Approved tester criteria:

- tester role and relevant expertise are recorded;
- conflict of interest is declared;
- tester is approved for the discipline/audition type being reviewed;
- tester uses a structured rubric for clarity, actionability, specificity, safety, brief achievement and selected-level calibration;
- tester feedback is linked to fixture ID, run ID, artefact root and release gate.

A fixture registry is required before automated acceptance can be treated as repeatable evidence.

```ts
type FixtureRegistryEntry = {
  fixture_id: string;
  fixture_description: string;
  discipline: "musical_theatre" | "dance" | "acting" | "voice_singing" | "commercial" | "hybrid";
  performer_level: PerformerLevel;
  tape_duration_seconds: number;
  brief_present: boolean;
  media_file_reference: string;
  expected_readiness_state?: string;
  expected_timestamp_count_range?: [number, number];
  release_gating_tests: string[];
  privacy_classification: "internal_private" | "approved_test_fixture";
};
```

Acceptance tests that mention fixture characteristics, such as “45-second Dance tape” or “4-minute Musical Theatre tape”, must eventually reference named fixture IDs.

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

## 20. Validation architecture and rules

Validation is a hybrid system:

- deterministic schema, path, referential-integrity, status, privacy and gate checks;
- deterministic public-output phrase and leakage checks where possible;
- model- or prompt-assisted judgement checks only where rule-based validation cannot reliably judge specificity or actionability.

Model-assisted validation must record `validator_model_version` and should run deterministically for RT-15 fixtures. If repeated identical inputs produce different validator outcomes due to validator-model variance, that must be recorded as validator variance in `route_variance_trace.json` and must not be misclassified as performer evidence delta.

Referential-integrity validation is a pre-condition. If IDs cannot be resolved across `TruthStateMap`, `EvidenceAnchors`, `PublicClaimTrace`, report payload and gate traces, the validator must record a P0 or P1 failure and dependent gates must not pass.

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

### 21.18 Runtime proof and path tests

- Storage-mode object keys normalise expanded `takes/take-[core]/analysis-[analysis_run_id]/...` paths to flat `take-[core]/analysis-[analysis_run_id]/...` keys.
- `take-take-*` identities never appear in run IDs, manifest paths, metrics paths or comparison roots.
- Manifest and acceptance metrics refer to the same run, take, analysis run and comparison run IDs.
- `emitted_blocked`, `not_executed`, `deferred`, `not_applicable` and `failed_emission` never count as successful runtime evidence.
- First-pass legacy/report-snapshot traces remain insufficient for Level 2.

### 21.19 Schema and referential-integrity tests

- Every artefact records a recognised schema version.
- The manifest records schema versions per artefact family.
- N-1 schema compatibility works during active v3 delivery.
- EvidenceRef non-limitation sources include resolvable `truth_state_entry_ids`.
- PublicClaimTrace claim IDs resolve to evidence anchors and truth-state entries.
- Validator rule IDs resolve to the rule registry.

### 21.20 Two-step and atomicity tests

- Step 2 does not run when `AnalysisEvidenceState.json` is missing, failed, unreadable or belongs to a different run.
- Partial Step 1 outputs are not consumed after Step 1 failure.
- Stage retries overwrite canonical artefact keys or record one authoritative version in manifest.
- Storage circuit-breaker conditions prevent long retry cascades.

### 21.21 Gate and render-permission tests

- Render reads and enforces `GateTrace.public_output_permissions`.
- Public scores, public technique names, repertoire claims and comparison recommendations are suppressed when the corresponding permission is false.
- Human gate decisions require a governance/audit record.
- Validator overrides cannot override P0 public/private leakage, protected-characteristic inference, same-video false winner or public raw-score leakage.

### 21.22 Comparison invocation tests

- No comparison artefact other than an explicit not-applicable/deferred status appears in ordinary single-take analysis runs.
- `comparison_invocation_record.json` is emitted before comparison raw/evidence-delta traces.
- Operator/internal comparison requires feature flag, authorised trigger, completed takes and manifest/metrics reconciliation.
- `system_internal` comparison runs only for named QA/regression/release-gate fixtures.

### 21.23 Operational readiness tests

- Storage/log fallback behaviour is monitored and alertable.
- Artefact retention and deletion policies are defined before Level 4.
- Queue/concurrency behaviour is defined before customer-facing release.
- Media readiness failure and corrupt media paths produce truthful blocked/not-assessable states, not invented performance feedback.

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

Before R1 deep implementation starts, close these engineering contract items:

- canonical schema-version policy;
- manifest and `qa/acceptance_metrics.json` schemas;
- full artefact path register;
- `AnalysisEvidenceState` persistence and failure handling;
- stage atomicity, retry idempotency and storage circuit-breaker policy;
- fixture registry minimum contract;
- validator rule registry convention.

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

### 22.4 Legacy-adapter sunset criteria

`LEGACY-ADAPTER-SUNSET-GATE` may pass only when:

1. readiness, scoring, claims and public report payloads are generated from the v3 evidence spine rather than legacy report snapshots;
2. `EvidenceAnchors`, `PublicClaimTrace`, `TechniqueObservationTrace` and `ScoreTrace` needed for public output are `real_runtime_v3` or equivalent accepted runtime linkage;
3. manifest and acceptance metrics show zero required Level 2 artefacts relying on `legacy_adapter` for N consecutive accepted locked-down runs across agreed fixtures;
4. validators prove no public output depends on legacy-only fields such as `fix_first`, `casting_insight`, raw overall score snapshots or untraced category prose;
5. fallback to legacy report output is feature-flagged off or classified as emergency rollback only;
6. release governance records rollback and re-enable conditions;
7. product owner accepts the sunset in the release-risk register.

### 22.5 Release rollback and production-readiness policy

Rollback must be available for every public-output or gate-affecting release slice.

Immediate rollback / flag-off is required for:

- P0 public/private leakage;
- same-video false winner or unsafe comparison recommendation;
- public raw score exposure while `PUBLIC-SCORING-GATE` is blocked;
- public named technique/repertoire claim while authority gates are blocked;
- protected-characteristic, appearance, marketability, bookability or health-diagnosis inference;
- rendered report materially diverging from validated internal payload.

Before Level 4, the system must define minimum observability: run counts, stage latency, artefact write success/failure, gate pass/fail counts, P0 alerts, storage failure alerts and log aggregation separate from QA artefact fallback.

Before customer-facing release, retention, user deletion handling, queueing, rate limiting and concurrency policies must be defined and tested.

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
