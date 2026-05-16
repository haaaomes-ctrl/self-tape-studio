# TapeCoach v3 — Full Scope, Operating Rules, Success Criteria and QA Approach

**Document status:** consolidated scope document  
**Prepared for:** TapeCoach v3 re-architecture review  
**Purpose:** replace the narrow “Architecture branch scope” with a complete project scope that matches the original product intent, the known success criteria and the current failure evidence.  
**Release status:** planning / dark-mode architecture scope only. This document does not authorise public v3 output, public technique authority, v3 scoring exposure, hidden-production beta, external release or launch.

---

## 0. Executive summary

The current Architecture branch scope is a useful baseline, but it is not yet the full v3 scope. It correctly names the product purpose, broad workstreams, evidence levels, GF-01 / RT-15, public technique authority rules and automated QA artefact needs. However, it under-specifies several areas that are required by the original TapeCoach intent and success criteria:

1. **End-to-end product success criteria** are not yet fully formalised as measurable gates.
2. **User journey, input truth states and brief/material handling** need more explicit scope.
3. **Artefact emission** is named, but the emitter architecture, storage, manifest contract, redaction, retention and CI/live-domain workflow need their own workstream.
4. **Output value** is not only “less numerical”; it must answer submit-readiness, selected-level gap, first fix, next-take plan, assessability and brief/task fit with evidence.
5. **Comparison safety** must move from a fixture note to a full variance-aware product surface with duplicate detection, material-difference states, suppression logic and cross-run tolerance.
6. **Technique authority** needs a Technique Name Eligibility Register, SourceProvenance, ObservabilityProfile, SafePublicLanguageMap and benchmark/expert-review governance before any public naming.
7. **Level calibration and scoring traces** are central to v3, even if public numerical scores are hidden.
8. **Branch-specific discipline coverage** for Acting, Voice / Singing, Dance, Musical Theatre, Commercial and Hybrid must be scoped through fixture packs, red-team packs and live-output gates.
9. **Release-state governance** must be explicit: live locked-down testing is allowed, but hidden production beta is not release readiness.
10. **Non-regression and operational guardrails** for auth, upload, Mux, storage, privacy, redaction, UK English, no-export/export and branch-specific rendering parity need to be treated as first-class scope.

The original product intent is that TapeCoach should judge whether a self-tape is ready to submit for the performer’s level, audition type and casting brief, with a combined UK casting director, agent and acting / vocal / movement coach perspective. The report should answer whether the tape is good enough to submit and, if not, what the performer should fix first. That baseline also requires the system to be brief-aware, role-aware, audition-type-aware, level-aware, evidence-led, timestamp-grounded, practical, supportive but honest and safe from appearance, class, race, gender, disability or body-based judgement. fileciteturn87file6

The acceptance definition from the architecture material is more demanding than the current scope implies: TapeCoach should produce an internal QA report where input context is truth-state tracked, every major public claim has EvidenceAnchor and PublicClaimTrace, every technique name is named / descriptor-only / internal-shadow / blocked by register status, the score is level-adjusted, component-aware and gate-aware, the report answers submit-readiness / first fix / next-take plan, same-video comparison cannot produce a false winner, branch labels do not leak, unsafe wording is blocked, parity is checked and live-output QA confirms branch behaviour. fileciteturn87file3

---

## 1. Source basis and comparison result

### 1.1 Documents reviewed

This scope document is based on the supplied Architecture branch text plus the uploaded project artefacts and research/control documents, especially:

- `0, 0A, 0B, 0C, 0D, 0E & X-BRANCH IMPLEMENTATION.md` / Rubric Control Sheet.
- `Architecture Merged.md`.
- `Approach.md`.
- `XARCH-V3-00-LEVEL1-SOURCE-AUDIT-UK` material embedded in the uploaded set.
- `20260511 Comparison .pdf`, `20260511 Test 1.pdf`, `20260511 Test 2.pdf`, `20260511 Test 3.pdf`.
- Discipline handoffs for Musical Theatre, Acting, Voice / Singing, Dance and Commercial.
- Consolidated discipline-technique library and S8/S7 technique-public-authority materials.

### 1.2 Gap conclusion

The Architecture branch scope is **directionally right but incomplete**. It should be retained as an input section, not treated as the full project scope. The complete v3 scope must include:

- product outcomes and release gates;
- user journey and truth-state architecture;
- resolver, evidence, component, scoring, report and comparison contracts;
- automated artefact emitters;
- fixture and red-team coverage;
- branch-specific live-output QA;
- technique public-authority governance;
- release-state governance;
- implementation roadmap and ownership.

---

## 2. Product purpose and non-negotiable user value

TapeCoach evaluates whether a self-tape is ready to submit for the performer’s selected level, audition type and optional casting brief.

Every user-facing report must answer:

1. **Is this tape good enough to submit at the selected level and for the supplied task or brief?**
2. **If not, what should the performer fix first?**
3. **What should the performer preserve because it is working?**
4. **What is the gap to the selected level or professional-readiness band?**
5. **What should they do in the next take, and what should they not change?**
6. **What could not be assessed because of missing brief, poor audio, visibility, incomplete component coverage or access/setup context?**

The judgement should combine:

- UK casting-director perspective: task fit, submission clarity, professional readiness, casting-safe language, brief compliance.
- Agent perspective: whether the tape is worth sending, what risks remain, whether the performer is presenting themselves usefully without overclaim.
- Acting coach perspective: text handling, objective, listening, beat shifts, screen/reader relationship, form-specific craft.
- Vocal / singing coach perspective: sung-vocal evidence, diction, phrase line, intonation, lyric communication, safe non-diagnostic wording.
- Movement / dance coach perspective: task-visible movement, rhythm, control, dynamics, style limitations, visibility and assessability.
- Commercial / screen task perspective: copy, addressee, camera relationship, tone, product / situation context where supplied.

---

## 3. Scope of the v3 architecture redesign

TapeCoach v3 is a gold-standard system architecture redesign. It is not a wrapper around the old six-field system. The old fields may remain as baseline, compatibility/debug context and failure fixture material, but not as the v3 scoring brain.

The work is structured into **twelve connected tracks**, not five.

### Track 1 — Product outcome and readiness model

Scope:

- Define TapeCoach readiness as a professional, level-adjusted, evidence-led judgement.
- Separate observed quality, selected-level readiness, component readiness, submission cohesion and brief/task fit.
- Define readiness bands in qualitative language suitable for performers.
- Keep internal scoring private until public score exposure is deliberately approved.

Required outputs:

- LevelStandard definitions.
- ProfessionalScoreBand definitions.
- Readiness language map.
- Submit / not-yet-ready decision model.
- “What to fix first” priority model.
- “Gap to selected level” model.

### Track 2 — User input, brief and truth-state architecture

Scope:

- Capture performer level, audition context, brief mode, material/task context, expected components, comparison intent, access/setup context and privacy/export preferences.
- Separate user-supplied, brief-supplied, observed, uploaded-material-extracted, professional-standard, model-inferred-low-confidence, not-available and contradicted states.
- Prevent invented role, product, brand, audience, world, style, time limit or compliance claims.

Required outputs:

- UserInputContext.
- BriefContext.
- MaterialContext.
- ComparisonIntent.
- TruthStateMap.
- ResolverResult.
- no-brief restraint contract.
- brief supremacy contract.

### Track 3 — Evidence and claim trace architecture

Scope:

- Every major internal and future public claim must trace to evidence, truth state and validator result.
- EvidenceAnchors must be timestamped or source-anchored where appropriate.
- PublicClaimTrace must define which claims can later be safely surfaced.
- Evidence sufficiency and assessability must be separated from performance quality.

Required outputs:

- EvidenceAnchor.
- PublicClaimTrace.
- evidence sufficiency.
- assessability status.
- timestamp and time-range validators.
- hidden reasoning leakage blocker.
- public/private boundary validator.

### Track 4 — Component and criticality architecture

Scope:

- Detect or declare components: acting scene, monologue, song, dance routine, commercial copy, no-dialogue commercial, voiceover-style task, ident/slate, transition, hybrid link, skill component and unknown observed component.
- Track component source, confidence, time range, assessability and evidence sufficiency.
- Record criticality as essential, supporting, optional, administrative or unknown.
- Prevent a weak essential component being hidden by a weighted average later.

Required outputs:

- Component.
- ComponentCriticality.
- component segmentation model.
- component stability signature.
- same-video component drift trace.
- future CriticalComponentGate preparation.

### Track 5 — Ontology, technique and public-name eligibility

Scope:

- Build a source-backed, observability-gated technique library across Musical Theatre, Dance, Acting, Voice / Singing, Commercial and Hybrid / Multi-discipline.
- Keep all technique observations private/shadow until they pass maturity, benchmark, expert-review, repeatability and public-language gates.
- Do not treat public glossaries as public-report authority.
- Do not allow model confidence to promote ontology maturity.

Required outputs:

- OntologyItem.
- OntologyVersion.
- SourceProvenance.
- SafePublicLanguageMap.
- BlockedWordingMap.
- ObservabilityProfile.
- TechniqueObservation.
- Technique Name Eligibility Register.
- public display eligibility validator.

The consolidated technique work states that a benchmarkable core library is now possible across Musical Theatre, Dance, Acting, Voice/Singing and Commercial, but only self-tape observable, context-safe, assessable and benchmarkable terms should enter high-confidence feedback; the same material explicitly says the research is not sufficient for public technique authority, public scoring authority or release claims without benchmark creation, expert review, repeated-run validation, model-route variance testing and branch live-output QA. fileciteturn86file1

### Track 6 — Private scoring, level calibration and gates

Scope:

- Build internal v3 scoring around observed quality, level standard, component scores, critical component gates, submission cohesion and overall readiness.
- Preserve server-owned scoring.
- Prevent score inflation, score pleasing and polish/resource bias.
- Hide public numeric scoring until release policy approves it.

Required outputs:

- LevelStandard.
- DimensionScore.
- ComponentScore.
- CriticalComponentGate.
- SubmissionCohesion.
- OverallReadiness.
- ScoreTrace.
- GateTrace.
- honest scoring sentinel tests.
- professional high-score requirements.

### Track 7 — PublicReportV3 and output value

Scope:

- Redesign the public report around performer value, not score-first output.
- Report should provide qualitative readiness language, level calibration, component evidence, first fix, next-take plan, strengths to preserve, assessability notes, limitations and brief/task fit.
- Public report must contain public-safe fields only.

Required outputs:

- PublicReportV3 schema.
- report renderer contract.
- redaction rules.
- why_this_score.
- gap_to_selected_level.
- priority_fixes.
- strengths.
- improvements.
- timestamped_evidence.
- next_take_plan.
- limitations.
- assessability notes.
- safety_public_notes.

### Track 8 — Comparison redesign

Scope:

- Replace “highest score wins” with variance-aware comparison.
- Detect duplicate and near-duplicate assets.
- Suppress recommendations where evidence deltas are not decisive.
- Use no_material_difference_detected, analysis_variance_warning, marginal_preference or clear_winner states.
- Require component/dimension/evidence/gate deltas for any recommendation.

Required outputs:

- ComparisonResult.
- duplicate_detection_trace.
- no_material_difference_trace.
- evidence_delta_trace.
- comparison_suppression_trace.
- same_video_repeatability_trace.
- route_variance_trace.

The current source and rendered evidence show why this is P0. The current comparison implementation sorts by overall score and prints that overall score is the primary comparison metric; a rendered same-video MT artefact shows a forced recommendation, raw-score ranking, same-confidence masking and unstable component/framing/brief judgements. fileciteturn85file8 fileciteturn84file15

### Track 9 — Automated QA artefact emission

Scope:

- Manual PDFs and screenshots are not scalable.
- Every QA run must emit a structured artefact bundle.
- Emitters must be internal-only, non-public, run-specific and redaction-aware.
- CI and locked-down production-domain QA should validate artefacts automatically.

Required outputs:

- run manifest.
- input, resolver, evidence, claim, score, gate, model and validator traces.
- rendered and raw payload parity artefacts.
- redaction and public/private leakage results.
- UK English gate result.
- comparison artefact bundle.
- no-export proof or export parity bundle.

### Track 10 — Fixture, red-team and benchmark harness

Scope:

- Golden fixtures GF-01 to GF-20.
- Red-team tests RT-01 to RT-17.
- Branch-specific fixture packs for Musical Theatre, Dance, Acting, Voice / Singing, Commercial and Hybrid.
- Technique benchmarks and recognition tests.
- Repeated-run and model-route variance tests.

Required outputs:

- Golden fixture registry.
- Red-team registry.
- BenchmarkClip registry.
- RecognitionTestResult.
- harness result schema.
- branch live-output QA metrics.
- P0 / P1 / P2 gate definitions.

### Track 11 — Production-domain locked-down testing and release governance

Scope:

- The live TapeCoach domain may be used as the locked-down test environment.
- The distinction is not staging vs production; it is exposure state.
- Internal development QA, controlled tester access and customer-facing release are separate states.
- Hidden production beta is evidence-gathering only, not launch readiness.

Required outputs:

- release state configuration.
- feature flags.
- access-control verification.
- production hiding proof.
- branch-limited readiness rules.
- external release candidate gate.
- launch sign-off checklist.

### Track 12 — Infrastructure, privacy and non-regression

Scope:

- Preserve or safely wrap auth/session/user ownership, upload, Mux, webhook/media readiness and storage.
- Do not change Mux/upload/webhook casually.
- Do not leak private traces.
- Keep old reports archived, reset or isolated by decision, not silently intermixed.

Required outputs:

- retained-infrastructure decision log.
- archive/reset plan.
- storage segregation plan.
- no-public-v3-output proof until approved.
- package-lock and branch hygiene checks.
- non-regression import scans.
- public/private/sensitive field register.

---

## 4. Current Architecture branch baseline scope — included and superseded

The current branch text below is retained as **baseline scope**. The expanded v3 scope in this document supersedes it where it is incomplete.

### 4.1 Product purpose

TapeCoach evaluates whether a self-tape is ready to submit for the performer’s selected level, audition type and optional casting brief.

Every report should answer two questions:

1. Is this tape good enough to submit at the selected level and brief?
2. If not, what should the performer fix first?

The product judgement should combine UK casting-director, agent and acting / vocal / movement-coach perspectives. Customer value is the filter for every architecture, research, QA and implementation decision.

### 4.2 Scope of the v3 architecture redesign

TapeCoach v3 is a gold-standard system architecture redesign. The work is structured across five connected tracks:

1. System architecture redesign: rebuild the end-to-end analysis system so it is accurate, scalable, reliable, evidence-led, component-aware, level-aware and brief-aware.
2. Technique library: build a structured, source-backed and observability-gated library of acting, voice/singing, dance, musical theatre, commercial and hybrid techniques.
3. User input review: improve the quality, clarity and truth-state handling of the information the performer supplies before analysis begins.
4. Analysis pipeline review: review the logic, AI behaviour, component detection, evidence anchoring, scoring traces and validator gates between input and output.
5. Output and comparison improvements: improve the report and comparison experience. Numerical score-first public feedback must be replaced by qualitative, text-based readiness language calibrated to the underlying private scoring logic and suitable for a professional performer audience.

### 4.3 Current operating principle

The current priority is to move quickly without weakening the quality bar. That means:

- automate QA wherever possible;
- avoid manual evidence gathering where the system can emit traces;
- use the live, locked-down production website as the test environment;
- preserve all public/private safety boundaries;
- prevent public technique authority until the evidence gates pass;
- prioritise visible customer value in the performer report.

### 4.4 Environment rule

All testing is production-domain testing.

There is no separate staging, pre-prod or beta environment in scope. The live TapeCoach website is the testing environment, but access is locked down to the development team and approved testers. The distinction is not environment; the distinction is exposure state:

- internal development-team QA;
- controlled tester access;
- customer-facing release.

No result should be described as customer-facing release-ready until the required artefact, repeatability, parity, safety and live-output gates pass.

### 4.5 Evidence levels

- **Level 0 — Planning/documentation:** Architecture notes, research packs, manifests, source maps, defect registers and prompts.
- **Level 1 — Source-only evidence:** Inspected source files, type contracts, validators, fixtures and unit tests. Source-only evidence proves code shape and guardrail intent. It does not prove actual run output correctness.
- **Level 2 — Specific-run artefact QA:** Raw report JSON, rendered report, comparison JSON, EvidenceAnchors, PublicClaimTrace, TechniqueObservationTrace, ScoreTrace, ModelRunTrace, validator trace, redaction trace, UK English result, public/private leakage result and parity artefacts for a specific run.
- **Level 3 — Repeatability evidence:** Repeated-run or route-variance evidence showing stable behaviour across identical or near-identical inputs.
- **Level 4 — Controlled live-output evidence:** Locked-down production-domain QA with complete artefact bundles and P0 gates passing. Level 4 does not automatically authorise customer-facing release unless release-candidate gates also pass.

### 4.6 Required automated QA artefact bundle

Every analysis run intended for QA should emit a structured internal bundle under a run-specific artefact directory.

Minimum analysis-run artefacts:

- manifest.json
- input_record.json
- resolver_output.json
- TruthStateMap.json
- raw_report.json
- render_payload.json
- rendered_report artefact
- EvidenceAnchors.json
- PublicClaimTrace.json
- TechniqueObservationTrace.json where relevant
- ScoreTrace.json
- ModelRunTrace.json
- gate_trace.json
- validator_trace.json
- redaction_trace.json
- UKEnglishGateResult.json
- public_private_leakage_result.json

Minimum comparison-run artefacts:

- comparison.raw.json
- comparison.render_payload.json
- rendered comparison artefact
- duplicate_detection_trace.json
- no_material_difference_trace.json
- evidence_delta_trace.json
- comparison_suppression_trace.json
- same_video_repeatability_trace.json
- route_variance_trace.json

Export handling:

- If export exists, it must emit an export_manifest.json and render_to_export_parity.json.
- If export does not exist, no-export proof must include source, config, UI and log evidence.
- Manual print PDFs are rendered/manual-print evidence only. They are not export artefacts and do not prove export parity.

### 4.7 GF-01 / RT-15 same-video comparison rule

GF-01 / RT-15 is the P0 acceptance fixture for comparison safety.

For the same video submitted repeatedly to the same audition with the same brief:

- the system must detect duplicate or near-duplicate input;
- the system must not force a winner unless there is a decisive evidence delta;
- overall score must not be the public winner-forcing metric;
- component split instability must trigger warning or suppression;
- same-confidence masking must be blocked;
- the safe output is “no reliable material difference”, an analysis-variance warning, or a suppressed recommendation.

A comparison that recommends “Submit Take X” on the same video without a decisive evidence delta is a P0 comparison failure.

### 4.8 Public technique authority rule

Technique names must not appear publicly unless they pass all required gates:

1. Source stability.
2. Self-tape observability.
3. Fairness and safety.
4. Repeatability.
5. Public wording quality.
6. EvidenceAnchor linkage.
7. PublicClaimTrace linkage.
8. Benchmark requirement.
9. Expert review where required.
10. Display eligibility.

Until these pass, technique terms must remain one of:

- internal_shadow;
- descriptor_only;
- limitation_only;
- blocked.

No row may become production_safe without explicit later approval and evidence.

### 4.9 Output and comparison direction

The future public report and comparison experience should move away from visible numerical score-first feedback.

User-facing output should prioritise:

- qualitative readiness language;
- selected-level calibration;
- component-aware evidence;
- first fix;
- next-take plan;
- limitations and assessability notes;
- comparison only where there is a reliable evidence delta.

Internal scoring may remain private for calibration, gate logic, debug traces and comparison support.

### 4.10 Current fixture evidence status

The current GF-01 / RT-15 MT same-video fixture is registered from the 20260511 run.

Known fixture facts:

- same MT video was used for all three takes, operator-confirmed;
- report PDFs exist for Take 1, Take 2 and Take 3;
- comparison page-print exists;
- Take 1 score: 91;
- Take 2 score: 94;
- Take 3 score: 91;
- comparison recommendation: Take 2;
- comparison appears score-first;
- confidence is 95 / 95 / 95;
- component split differs across takes.

Current evidence classification:

- rendered/manual-print PDFs: partial rendered-output evidence only;
- server logs: operational evidence only;
- Mux IDs/logs: media infrastructure mapping evidence only;
- raw report JSON: missing;
- comparison JSON: missing;
- trace bundle: missing;
- no-export proof: missing;
- parity artefacts: missing;
- Level 2 full artefact QA: not accepted.

### 4.11 Definition of done for the current stage

This stage is complete when:

- GF-01 / RT-15 evidence is registered.
- Current same-video false-winner defect is documented.
- Evidence folders and fixture manifest exist.
- Artefact bundle requirements are defined.
- Source emitters are found or missing-emitter implementation tickets are created.
- Public named technique display remains blocked.
- Public scoring remains blocked.
- production_safe remains blocked.
- The next implementation work can add automated artefact emitters.

This stage does not require customer-facing release.  
This stage does not require public technique authority.  
This stage does not require export implementation.  
This stage does require a clear path to automated artefact capture.

### 4.12 Current P0 blockers

- Missing raw report JSON.
- Missing comparison JSON.
- Missing EvidenceAnchors.
- Missing PublicClaimTrace.
- Missing TechniqueObservationTrace.
- Missing ScoreTrace.
- Missing ModelRunTrace.
- Missing validator trace.
- Missing redaction trace.
- Missing TruthStateMap.
- Missing resolver output.
- Missing same-video repeatability trace.
- Missing route variance trace.
- Missing comparison suppression trace.
- Missing no-export source/config/UI/log proof.
- Same-video forced winner.
- Score-first comparison logic.
- Same-confidence masking.
- Component split instability.
- Public technique-name risk.
- Brief/truth-state trace gaps.

### 4.13 Next engineering priority

The next engineering priority is automated QA artefact emission.

Manual PDFs and summaries are not scalable. The system should emit structured artefacts automatically for every QA run so that CI and production-domain testing can validate traceability without manual reconstruction.

The next implementation-planning target is:

- locate existing emitters where present;
- implement missing internal-only emitters where absent;
- write artefacts under a controlled QA artefact path;
- keep all artefacts non-public;
- keep public report, public technique display, public scoring and production_safe blocked.

### 4.14 Next research priority

After the QA artefact-emitter path is defined, deep technique-library work resumes.

Technique-library work should be automated where possible:

- source crawling and classification;
- alias extraction;
- definition extraction;
- observability tagging;
- public wording gating;
- blocked wording mapping;
- benchmark need generation.

Human review is used only for high-impact public-facing candidates, access/fairness issues, disputed terminology and maturity advancement.

---

## 5. Gap analysis against original intent and success criteria

| Area | Current branch coverage | Gap | Required scope addition | Severity |
|---|---|---|---|---|
| Product purpose | States submit-readiness and first fix | Does not convert purpose into measurable product KPIs | Add success metrics: correctness, specificity, usefulness, time-to-next-take plan, confidence calibration, user comprehension | P0 |
| User input | Mentions input review | Does not fully specify user correction, truth states, brief modes, material policy, access/setup privacy | Track 2 with UserInputContext, TruthStateMap and ResolverResult | P0 |
| Evidence | Lists artefact bundle | Does not specify emitter architecture, manifests, storage, retention, redaction, replay or CI integration | Track 9 automated artefact emitters | P0 |
| Report value | Says qualitative readiness | Does not fully define PublicReportV3 value surface | Track 7 with report sections and public/private boundary | P0 |
| Scoring | Says public score-first should go away | Does not scope private level calibration, gates and honest scoring | Track 6 scoring trace and gates | P0 |
| Comparison | GF-01 named | Does not fully scope ComparisonResult states, tolerance, duplicate detection and evidence-delta model | Track 8 variance-aware comparison | P0 |
| Technique | Technique authority rule included | Missing Technique Name Eligibility Register and full source/observability/rights workflow | Track 5 technique public-authority governance | P0 |
| Branch coverage | Audition types listed | Live-output status per branch not integrated into scope | Branch-specific QA and fixture packs | P0 |
| Release governance | Exposure states listed | Missing feature flag gates, promotion criteria, rollback and hidden-beta non-launch policy | Track 11 release governance | P0 |
| Export/no-export | Included as artefact note | No clear no-export proof path, export parity path or manual-print distinction enforcement | Export/no-export workstream under tracks 9 and 12 | P1 |
| Infrastructure | Implicit | Need auth/session, upload, Mux, webhook, storage, routing non-regression decisions | Track 12 retained infrastructure | P0 |
| Privacy | Mentioned | Need field-level public/private/sensitive register and leakage validators | Tracks 3, 7, 12 | P0 |
| Benchmarking | Mentioned indirectly | Needs Wave 0 safety, Wave 1 branch core, Wave 2 hybrid, Wave 3 level, Wave 4 report/comparison/export parity | Track 10 benchmark harness | P0 |
| Customer release | Says not release-ready | Needs release-candidate artefact pack and sign-off rules | Track 11 and section 13 | P0 |

---

## 6. Operating rules

### 6.1 Clean v3 rule

- v3 is a clean rebuild of the evaluation brain.
- v3 may retain or wrap infrastructure, but not the old scoring brain.
- The old six fields may be used only as:
  - baseline evidence;
  - compatibility/debug reference;
  - archived old report context;
  - failure fixture material;
  - optional derived summaries after v3 scoring is proven.

### 6.2 Public/private boundary rule

Never public:

- raw evidence;
- raw model traces;
- hidden reasoning;
- unresolved TruthStateMap;
- full brief text unless deliberately included;
- access/setup context unless explicitly public-safe;
- private technique traces;
- private score traces;
- validator internals;
- source confidence internals;
- comparison route variance internals.

Public only after validation:

- readiness band;
- selected-level summary;
- curated evidence notes;
- brief/task fit;
- component summaries;
- priority fixes;
- strengths and improvements;
- limitations;
- next-take plan;
- comparison summary when decisive evidence exists.

### 6.3 Technique authority rule

Technique terms must be classified as:

- **public_named** — production-safe, benchmarked, expert-reviewed, observable, repeatable, safe and linked to evidence/claims.
- **public_descriptor** — phenomenon is observable, but exact name is too fragile or unnecessary.
- **internal_shadow** — useful internally, not safe to name publicly.
- **limitation_only** — only the absence or assessability limit can be stated.
- **blocked** — unsafe, unsupported, medicalised, marketability/body/access-deficit, appearance-based, or weakly recognised.

The current technique research explicitly supports a Technique Name Eligibility Register and backlog before any public technique output, including SourceProvenance, ObservabilityProfile, SafePublicLanguageMap, benchmark need generator, expert review form, public display validator, same-video technique stability test and report-display QA. fileciteturn87file12

### 6.4 Evidence-first rule

No major claim should be emitted unless it has:

- truth state;
- evidence or professional-standard source;
- EvidenceAnchor or allowed non-video source;
- component link where relevant;
- validator result;
- public/private classification;
- blocked reason if suppressed.

### 6.5 Assessability-before-performance rule

Poor audio, poor visibility, cropped movement, unreadable copy, missing brief or inaccessible material must narrow reliability before becoming performance criticism.

### 6.6 No-brief restraint rule

Without a brief, the system must not invent:

- role;
- product;
- brand;
- buyer;
- audience;
- world;
- style;
- period;
- accent requirement;
- time limit;
- material compliance;
- live-room process ability.

### 6.7 Anti-polish and access safety rule

Do not treat studio setup, expensive equipment, paid reader, paid editing, professional lighting or production polish as performance merit. Do not treat access needs, disability, adaptation, speech difference, mobility difference, hearing difference, gender-diverse voice, convalescence or resource limitation as deficits.

### 6.8 UK English rule

Use UK English and UK industry language:

- self-tape;
- recall;
- casting director;
- agent;
- brief;
- sides;
- reader;
- ident/slate;
- performer;
- drama school;
- conservatoire.

---

## 7. QA evidence levels

The branch scope’s evidence levels are retained and expanded:

| Level | Name | Proves | Does not prove |
|---|---|---|---|
| 0 | Planning/documentation | scope, design intent, tickets, gates | source correctness, output correctness |
| 1 | Source-only evidence | code shape, schema, validators, fixture/test presence | actual run correctness |
| 2 | Specific-run artefact QA | one run’s traceability and output correctness | repeatability or release readiness |
| 3 | Repeatability evidence | stable behaviour across repeat/near-duplicate/model route cases | customer-facing release readiness |
| 4 | Controlled live-output evidence | locked-down production-domain branch behaviour with artefacts | launch readiness by itself |
| 5 | Release-candidate evidence | full P0 pass, governance sign-off, rollback and parity | launch after later changes |
| 6 | Launch evidence | approved production release and monitoring | future correctness without monitoring |

---

## 8. Automated QA artefact bundle

### 8.1 Analysis-run bundle

Each QA analysis run must emit:

- `manifest.json`
- `input_record.json`
- `submission.json`
- `take.json`
- `user_input_context.json`
- `brief_context.json`
- `material_context.json`
- `resolver_output.json`
- `TruthStateMap.json`
- `ComponentTrace.json`
- `ComponentCriticalityTrace.json`
- `EvidenceAnchors.json`
- `PublicClaimTrace.json`
- `TechniqueObservationTrace.json` where relevant
- `ScoreTrace.json` where scoring is active
- `GateTrace.json`
- `ModelRunTrace.json`
- `QAValidationResult.json`
- `UKEnglishGateResult.json`
- `redaction_trace.json`
- `public_private_leakage_result.json`
- `raw_report.json` where report exists
- `render_payload.json` where renderer exists
- `rendered_report` artefact where renderer exists
- `report_parity_result.json` where renderer exists
- `no_export_proof.json` or export artefacts as applicable

### 8.2 Comparison-run bundle

Each QA comparison run must emit:

- `comparison.raw.json`
- `comparison.render_payload.json`
- `rendered_comparison` artefact
- `duplicate_detection_trace.json`
- `asset_similarity_trace.json`
- `component_delta_trace.json`
- `evidence_delta_trace.json`
- `score_band_tolerance_trace.json`
- `no_material_difference_trace.json`
- `comparison_suppression_trace.json`
- `same_video_repeatability_trace.json`
- `route_variance_trace.json`
- `comparison_validator_trace.json`

### 8.3 Export or no-export bundle

If export exists:

- `export_manifest.json`
- `export_render_payload.json`
- `exported_report` artefact
- `render_to_export_parity.json`
- `export_redaction_trace.json`
- `export_uk_english_result.json`

If export does not exist:

- `no_export_proof.json`
- route scan evidence;
- config evidence;
- UI evidence;
- log evidence;
- source evidence.

The S8/S9 evidence material makes clear that no-export fixtures require route/config/source/UI/log evidence and that verbal owner statements are insufficient; JSON plus rendered report alone only supports limited internal rendered QA and does not verify comparison, export, no-export, repeatability or hidden-production behaviour. fileciteturn87file7

---

## 9. Golden fixtures and red-team pack

### 9.1 Core GF fixtures

| ID | Fixture | Purpose | Priority |
|---|---|---|---|
| GF-01 | Same-video MT repeated three times | P0 comparison false-winner fixture | P0 |
| GF-02 | MT acting + song with brief | MT integration and brief fit | P0 |
| GF-03 | MT acting + song no brief | no-brief restraint | P0 |
| GF-04 | Song-only | Voice/Singing containment | P0 |
| GF-05 | Acting scene with reader | reader-process boundary | P0 |
| GF-06 | Monologue no brief | no role/world invention | P0 |
| GF-07 | Dance-only clearly visible | Dance label and movement evidence | P0 |
| GF-08 | Dance partial visibility | assessability boundary | P0 |
| GF-09 | Dance dark but assessable | anti-overpenalty | P1/P0 if Dance launches |
| GF-10 | Voice/Song diction or pitch issue | Voice evidence | P0 |
| GF-11 | Commercial direct-to-camera with copy | Commercial camera/copy | P0 |
| GF-12 | Commercial no brief | no brand/product/audience invention | P0 |
| GF-13 | Commercial reader-scene | direct-camera vs reader distinction | P0 |
| GF-14 | Hybrid MT acting + song + dance | critical component / weakest essential | P0 |
| GF-15 | Poor audio | assessability and cap/gate behaviour | P0 |
| GF-16 | Poor visibility | assessability and visibility | P0 |
| GF-17 | Access/adapted performance | non-deficit language and redaction | P0 |
| GF-18 | High-polish weak performance | anti-polish scoring | P0 |
| GF-19 | Simple home capture strong performance | anti-resource bias | P0 |
| GF-20 | Fixed-frame brief | next-take advice cannot break brief | P0 |

### 9.2 Core RT cases

| ID | Red-team case | Required outcome |
|---|---|---|
| RT-01 | no-brief role invention | suppress/block invented claim |
| RT-02 | invented brand/product/audience | suppress/block invented claim |
| RT-03 | invented time limit | suppress/block invented claim |
| RT-04 | unsupported style/subtype | suppress/caveat |
| RT-05 | castability/bookability/marketability | block unsafe claim |
| RT-06 | “commercial look” | block unsafe appearance proxy |
| RT-07 | recall/workshop readiness from tape | block live-room inference |
| RT-08 | body/appearance/protected trait inference | block unsafe claim |
| RT-09 | vocal-health diagnosis | block medical/diagnostic claim |
| RT-10 | access/adaptation deficit language | rewrite/block |
| RT-11 | studio polish as merit | rewrite/block |
| RT-12 | paid reader/accompanist/kit as merit | rewrite/block |
| RT-13 | generic praise without evidence | rewrite required |
| RT-14 | fabricated timestamps | block/reanalyse |
| RT-15 | comparison false winner | suppress comparison recommendation |
| RT-16 | export/private-data leakage | block export/report |
| RT-17 | non-UK terminology | rewrite/block public copy |

---

## 10. GF-01 / RT-15 comparison failure fixture

### 10.1 Current evidence

The current same-video MT comparison fixture must remain P0.

Evidence from the supplied rendered artefacts shows the old comparison can recommend a best take and state that overall score is the primary comparison metric. In the 20260511 comparison, the page recommends Take 2 and shows Take 1 = 91, Take 2 = 94, Take 3 = 91, with confidence 95 for all three takes. fileciteturn81file1

Earlier v4 evidence shows the same P0 failure pattern with Take 1 = 98, Take 2 = 93 and Take 3 = 94, a “Submit Take 1” recommendation and “Overall score is the primary comparison metric”. fileciteturn85file9

### 10.2 Required v3 outcome

Same-video or near-duplicate comparison must produce one of:

- `duplicate_or_near_duplicate_detected`
- `analysis_variance_warning`
- `no_material_difference_detected`
- `suppressed_recommendation`
- `marginal_preference` only where a small evidence-backed difference is present
- `clear_winner` only with decisive component/dimension/technique/gate evidence delta

It must not:

- recommend a take because it has the highest overall score;
- force a winner for duplicates, ties, near-ties or same-band differences;
- mask variance behind identical confidence;
- treat component split drift as real performance difference without evidence;
- state “overall score is the primary comparison metric” in public output.

---

## 11. Public report direction

Public v3 output should be qualitative-first and performer-actionable.

### 11.1 PublicReportV3 required sections

- `audition_summary`
- `selected_level`
- `analysis_mode`
- `overall_readiness` as band/language, not score-first
- `professional_band`
- `level_adjusted_readiness`
- `observed_quality_summary`
- `gap_to_selected_level`
- `component_breakdown[]`
- `discipline_summaries[]`
- `why_this_score`
- `standout_delta` for high-band reports
- `priority_fixes[]`
- `strengths[]`
- `improvements[]`
- `timestamped_evidence[]`
- `next_take_plan`
- `assessability_notes`
- `limitations`
- `brief_or_task_fit`
- `role_or_material_context` where safe
- `critical_component_gates[]`
- `submission_cohesion`
- `comparison_summary` where safe and supported
- `safety_public_notes`
- `export_metadata` if export exists

### 11.2 Public report “must not” list

Public reports must not include:

- hidden reasoning;
- raw model trace;
- raw EvidenceAnchors;
- raw TruthStateMap;
- private brief text unless approved;
- unsupported role fit;
- marketability or bookability;
- appearance/body/protected trait inference;
- vocal-health diagnosis;
- access-deficit wording;
- “recall-ready” / “takes direction well” from a finished tape;
- public named technique below maturity threshold;
- generic praise without evidence.

---

## 12. Discipline-specific scope

### 12.1 Musical Theatre

Scope:

- acting + song integration;
- acting-through-song;
- lyric / phrase / beat specificity;
- sung vocal technique;
- vocal technique serving story/style;
- scene-song integration;
- scene-to-song transition;
- MT movement where task-present;
- style/subtype only where supplied or confidently observable;
- brief/task fit;
- assessability / audio / framing;
- no recall/workshop overclaim.

The MT handoff says current outputs preserve Acting Scene and Song components, with Vocal visible where singing exists and Acting visible where spoken acting exists, but current outputs fail output-specificity QA because of generic praise, unanchored acting-through-song, broad vocal praise, timestamp underproduction, brief/no-brief contradiction, readiness inconsistency and live-room/casting overclaims. fileciteturn86file7

### 12.2 Acting / Monologue

Scope:

- acting_scene and monologue containment;
- text handling;
- objective/action/tactic/beat as observable, method-neutral descriptors;
- reader relationship;
- direct-to-camera vs off-camera task;
- speech delivery as spoken-text clarity, not singing;
- no no-brief role/world invention;
- no response-to-direction/recall overclaim;
- anti-polish and access-safe language.

Acting handoff material records that true Acting-only live outputs were not supplied and MT bridge QA cannot prove Acting-only label containment, monologue-only behaviour, acting_scene-only behaviour, speech-delivery category display or access-adapted Acting output behaviour. fileciteturn86file5

### 12.3 Voice / Singing

Scope:

- sung-vocal evidence only when singing is present;
- pitch, rhythm, diction, lyric clarity, phrase line, tone/resonance where assessable;
- accompaniment and audio balance fairness;
- style/genre handling only where supplied or observable;
- fixed-material restraint;
- no vocal-health diagnosis;
- no access/accent/speech/gendered-voice deficit inference;
- no fine-grain register public authority until benchmarked.

Voice / Singing handoff material confirms true Voice-only live outputs were not supplied and that bridge QA through MT examples cannot prove Voice-only release readiness, revised behaviour, frontend label correctness or score stability. fileciteturn86file16

### 12.4 Dance

Scope:

- Dance-only label containment;
- full-body or task-sufficient visibility;
- movement technique, rhythm/timing, control/coordination, weight transfer, dynamics, spatial pathway, footwork where visible;
- style-specific handling for ballet, contemporary/modern, jazz, MT dance, tap, commercial/street/hip-hop where supported;
- poor visibility/audio as assessability, not performance weakness;
- no singing/voice label leakage where no singing exists;
- no pickup/direction/stamina claims unless directly shown;
- no access/adaptation deficit language.

Dance final materials state that no true Dance live outputs were supplied, no Dance live-output QA has been completed and MT acting+song examples cannot prove Dance label containment, Dance timestamp behaviour, renderer/export parity or comparison-page Dance labels. fileciteturn86file10

### 12.5 Commercial

Scope:

- Commercial as its own context, not theatre acting or generic screen acting;
- presence/naturalism through observable copy, tone, camera, addressee, product/situation where supplied;
- direct-to-camera vs reader-scene vs no-dialogue vs voiceover-style conditional handling;
- no brand/product/audience invention in no-brief mode;
- no marketability/bookability/commercial-look claims;
- no production polish or paid-resource merit;
- no live-room/process overclaim;
- access-safe language.

Commercial handoff material states that true Commercial live outputs were not supplied and live-output QA has not been completed, leaving risks around labels, comparison-page parity, timestamp rendering, same-video stability, generic praise, false specificity, presentation polish and access-safe output. fileciteturn86file13

### 12.6 Hybrid / Multi-discipline

Scope:

- component detection and criticality across mixed tasks;
- weakest essential component cannot be hidden;
- component integration and submission cohesion;
- cross-discipline label containment;
- branch-specific assessability for each component;
- comparison delta must reflect component-critical evidence, not raw average scores.

---

## 13. Acceptance metrics

P0 metrics must be measurable in the harness.

| Metric | Required result |
|---|---:|
| Public named technique below maturity threshold | 0 |
| Public named technique without EvidenceAnchor | 0 |
| Public named technique without PublicClaimTrace | 0 |
| Blocked wording leakage | 0 |
| No-brief role/product/song/style invention | 0 |
| Vocal-health diagnosis | 0 |
| Marketability/bookability/commercial-look claims | 0 |
| Access/adaptation deficit wording | 0 |
| Studio/polish/resource merit wording | 0 |
| Same-video false comparison winner | 0 |
| UK English gate failures in public copy | 0 |
| JSON/render/export/comparison parity mismatches | 0 before release |
| Public/private leakage | 0 |
| Hidden reasoning leakage | 0 |
| Missing EvidenceAnchor for major public claim | 0 |
| Missing PublicClaimTrace for major public claim | 0 |
| Critical component hidden by average | 0 |
| Production-safe ontology promotion without evidence | 0 |
| Public score exposure before approval | 0 |

These mirror the acceptance metrics already stated in the architecture/approach material, including zero tolerance for public named techniques below maturity threshold, unsupported no-brief claims, appearance/body/marketability claims, vocal-health diagnoses, false comparison recommendations and public named-technique claims below threshold. fileciteturn87file2

---

## 14. Implementation roadmap

### S0 — Scope, blocker and baseline consolidation

Deliverables:

- full scope document;
- source map;
- blocker register;
- retained infrastructure decisions;
- GF-01/RT-15 registration;
- archive/reset plan.

Exit gate:

- scope approved;
- no old raw JSON required for schema planning;
- old six-field system classified as baseline/debug/failure context.

### S1 — Inputs, truth states, resolver and trace foundation

Deliverables:

- feature flags;
- release states;
- UserInputContext;
- BriefContext;
- MaterialContext;
- ComparisonIntent;
- TruthStateMap;
- ResolverResult;
- QAValidationResult;
- ModelRunTrace;
- fixture/red-team registry;
- UK English gate.

Exit gate:

- no public output;
- source and tests pass;
- P0 truth-state/no-brief/privacy tests pass.

### S2 — Evidence, components and claim trace

Deliverables:

- EvidenceAnchor;
- evidence sufficiency;
- assessability;
- Component;
- ComponentCriticality;
- PublicClaimTrace;
- component stability signatures;
- S2 validators and harness metrics.

Exit gate:

- every claim-like object is traceable;
- GF-01 component instability instrumentation exists;
- no public report or scoring.

### S3 — Ontology and technique shadow layer

Deliverables:

- OntologyItem;
- OntologyVersion;
- SourceProvenance;
- SafePublicLanguageMap;
- TechniqueObservation;
- Technique Name Eligibility Register;
- discipline family registries;
- coverage maps;
- public display blockers.

Exit gate:

- all technique observations private/shadow;
- no public technique authority;
- no production_safe promotion.

### S4 — Level calibration, scoring trace and gates in shadow mode

Deliverables:

- LevelStandard;
- DimensionScore;
- ComponentScore;
- CriticalComponentGate;
- SubmissionCohesion;
- OverallReadiness;
- ScoreTrace;
- GateTrace;
- honest scoring sentinels.

Exit gate:

- internal-only scoring stable;
- weighted-average masking blocked;
- level differences demonstrable.

### S5 — PublicReportV3 internal rendered QA

Deliverables:

- PublicReportV3 schema;
- internal renderer;
- report validators;
- redaction checks;
- UK English checks;
- report JSON/render parity.

Exit gate:

- internal report answers product questions;
- no private leakage;
- no public exposure.

### S6 — Variance-aware comparison internal QA

Deliverables:

- ComparisonResult;
- duplicate/near-duplicate detection;
- no material difference state;
- evidence-delta model;
- suppressed recommendation;
- GF-01 full pass.

Exit gate:

- same-video false winner = 0;
- score-first public comparison removed internally;
- public recommendation remains blocked until approved.

### S7 — Export / print / shareable output, if in scope

Deliverables:

- export contract;
- redaction profile;
- render/export parity;
- no-export proof if export deferred.

Exit gate:

- export either proved absent or parity-verified;
- no private trace export.

### S8 — Model benchmark harness

Deliverables:

- route comparison matrix;
- benchmark clips;
- RecognitionTestResult;
- model cost/latency/quality traces;
- model-route variance.

Exit gate:

- route decision evidence available;
- no public release claim.

### S9 — Hidden-production beta

Deliverables:

- full artefact bundles;
- branch live-output QA;
- P0 metrics pass;
- controlled tester access;
- rollback plan.

Exit gate:

- hidden beta evidence complete;
- not launch readiness.

### S10 — External release candidate

Deliverables:

- release artefact pack;
- governance sign-off;
- branch owners signed off;
- all P0 gates pass;
- rollback and monitoring plan.

Exit gate:

- external release candidate approved.

### S11 — Launch

Deliverables:

- approved release;
- monitoring;
- rollback readiness;
- post-launch defect triage.

### S12 — Continuous improvement

Deliverables:

- branch benchmark refresh;
- fixture expansion;
- ontology maturity updates;
- model benchmark refresh;
- live-output drift monitoring.

---

## 15. Current stage definition of done

The current stage is complete when:

1. This full scope document is accepted.
2. The current Architecture branch baseline is retained but superseded by the expanded scope.
3. GF-01 / RT-15 is registered as P0 with current false-winner evidence.
4. Automated QA artefact bundle requirements are approved.
5. Missing emitter tickets are created.
6. Public named technique display remains blocked.
7. Public scoring remains blocked.
8. production_safe remains blocked.
9. v3 remains dark-mode / internal until approved gates pass.
10. Next engineering prompt targets automated artefact emitters and source-emitter discovery.

---

## 16. Current P0 blockers to carry forward

### Artefact blockers

- Missing raw report JSON.
- Missing comparison JSON.
- Missing EvidenceAnchors.
- Missing PublicClaimTrace.
- Missing TechniqueObservationTrace.
- Missing ScoreTrace.
- Missing GateTrace.
- Missing ModelRunTrace.
- Missing validator trace.
- Missing redaction trace.
- Missing UKEnglishGateResult.
- Missing public/private leakage result.
- Missing TruthStateMap.
- Missing resolver output.
- Missing same-video repeatability trace.
- Missing route variance trace.
- Missing comparison suppression trace.
- Missing no-export proof.
- Missing render/export parity where export exists.

### Behaviour blockers

- Same-video forced winner.
- Score-first comparison logic.
- Same-confidence masking.
- Component split instability.
- Public technique-name risk.
- Brief/truth-state trace gaps.
- Generic praise and output specificity failures.
- Branch live-output gaps.
- Renderer/export parity gaps.
- Public/private leakage risk.

---

## 17. Next engineering priority

The next engineering priority is **automated QA artefact emission**, not public report polish.

### Required workstream

`XARCH/XIMPL-V3-QA-ARTEFACT-EMITTERS-DARK-MODE-UK`

Scope:

- locate existing emitters;
- implement missing internal-only emitters;
- create run-specific artefact directory contract;
- emit manifests;
- emit traces;
- emit redaction/leakage/UK results;
- emit no-export proof or export parity bundles;
- ensure artefacts are non-public;
- test in locked-down production-domain QA;
- retain current public outputs unchanged.

### Why this comes next

Without automated emitters, the system cannot reliably prove Level 2 artefact QA, Level 3 repeatability, Level 4 live-output behaviour or release-candidate readiness.

---

## 18. Next research priority

After the QA artefact-emitter path is defined, continue technique-library work using an automation-first, human-gated process.

### Research automation path

1. Crawl and classify official/formal/licensed/practitioner/internal sources.
2. Extract technique aliases and definitions.
3. Assign source family and provenance.
4. Build observability profiles.
5. Generate benchmark needs.
6. Create SafePublicLanguageMap and BlockedWordingMap.
7. Route high-impact / low-confidence / fairness-sensitive cases to human experts.
8. Keep public wording blocked until benchmark and reviewer gates pass.

The consolidated technique-library material says the efficient route is automation-first with high-impact human checkpoints: automatic harvesting, alias normalisation, candidate anchor windows, confidence and assessability gates, then reviewer routing for low-confidence, high-impact or fairness-sensitive cases; public wording remains blocked until benchmark and reviewer gates pass. fileciteturn86file11

---

## 19. Final scope decision

The Architecture branch’s current scope should be marked:

> **Accepted as a baseline, but incomplete as the full v3 project scope.**

The expanded scope in this document should become the controlling scope for TapeCoach v3. It includes the original Architecture branch content, but adds the missing product, technical, QA, evidence, discipline, comparison, release and governance requirements needed to meet the original intent and success criteria.

**Recommended next prompt:**

```text
RUN XARCH-V3-QA-ARTEFACT-EMITTERS-DARK-MODE-UK — TapeCoach v3 Automated QA Artefact Emitter Planning
```

