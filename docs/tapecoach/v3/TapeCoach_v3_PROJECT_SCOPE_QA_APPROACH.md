# TapeCoach v3 — Project Scope, Operating Rules and QA Approach

## 1. Product purpose

TapeCoach evaluates whether a self-tape is ready to submit for the performer’s selected level, audition type and optional casting brief.

Every report should answer two questions:

1. Is this tape good enough to submit at the selected level and brief?
2. If not, what should the performer fix first?

The product judgement should combine UK casting-director, agent and acting / vocal / movement-coach perspectives. Customer value is the filter for every architecture, research, QA and implementation decision.

## 2. Scope of the v3 architecture redesign

TapeCoach v3 is a gold-standard system architecture redesign. The work is structured across five connected tracks:

1. System architecture redesign: rebuild the end-to-end analysis system so it is accurate, scalable, reliable, evidence-led, component-aware, level-aware and brief-aware.
2. Technique library: build a structured, source-backed and observability-gated library of acting, voice/singing, dance, musical theatre, commercial and hybrid techniques.
3. User input review: improve the quality, clarity and truth-state handling of the information the performer supplies before analysis begins.
4. Analysis pipeline review: review the logic, AI behaviour, component detection, evidence anchoring, scoring traces and validator gates between input and output.
5. Output and comparison improvements: improve the report and comparison experience. Numerical score-first public feedback must be replaced by qualitative, text-based readiness language calibrated to the underlying private scoring logic and suitable for a professional performer audience.

## 3. Current operating principle

The current priority is to move quickly without weakening the quality bar. That means:

- automate QA wherever possible;
- avoid manual evidence gathering where the system can emit traces;
- use the live, locked-down production website as the test environment;
- preserve all public/private safety boundaries;
- prevent public technique authority until the evidence gates pass;
- prioritise visible customer value in the performer report.

## 4. Environment rule

All testing is production-domain testing.

There is no separate staging, pre-prod or beta environment in scope. The live TapeCoach website is the testing environment, but access is locked down to the development team and approved testers. The distinction is not environment; the distinction is exposure state:

- internal development-team QA;
- controlled tester access;
- customer-facing release.

No result should be described as customer-facing release-ready until the required artefact, repeatability, parity, safety and live-output gates pass.

## 5. Evidence levels

Level 0 — Planning/documentation:
Architecture notes, research packs, manifests, source maps, defect registers and prompts.

Level 1 — Source-only evidence:
Inspected source files, type contracts, validators, fixtures and unit tests. Source-only evidence proves code shape and guardrail intent. It does not prove actual run output correctness.

Level 2 — Specific-run artefact QA:
Raw report JSON, rendered report, comparison JSON, EvidenceAnchors, PublicClaimTrace, TechniqueObservationTrace, ScoreTrace, ModelRunTrace, validator trace, redaction trace, UK English result, public/private leakage result and parity artefacts for a specific run.

Level 3 — Repeatability evidence:
Repeated-run or route-variance evidence showing stable behaviour across identical or near-identical inputs.

Level 4 — Controlled live-output evidence:
Locked-down production-domain QA with complete artefact bundles and P0 gates passing. Level 4 does not automatically authorise customer-facing release unless release-candidate gates also pass.

## 6. Required automated QA artefact bundle

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

## 7. GF-01 / RT-15 same-video comparison rule

GF-01 / RT-15 is the P0 acceptance fixture for comparison safety.

For the same video submitted repeatedly to the same audition with the same brief:

- the system must detect duplicate or near-duplicate input;
- the system must not force a winner unless there is a decisive evidence delta;
- overall score must not be the public winner-forcing metric;
- component split instability must trigger warning or suppression;
- same-confidence masking must be blocked;
- the safe output is “no reliable material difference”, an analysis-variance warning, or a suppressed recommendation.

A comparison that recommends “Submit Take X” on the same video without a decisive evidence delta is a P0 comparison failure.

## 8. Public technique authority rule

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

## 9. Output and comparison direction

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

## 10. Current fixture evidence status

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

## 11. Definition of done for the current stage

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

## 12. Current P0 blockers

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

## 13. Next engineering priority

The next engineering priority is automated QA artefact emission.

Manual PDFs and summaries are not scalable. The system should emit structured artefacts automatically for every QA run so that CI and production-domain testing can validate traceability without manual reconstruction.

The next implementation-planning target is:

- locate existing emitters where present;
- implement missing internal-only emitters where absent;
- write artefacts under a controlled QA artefact path;
- keep all artefacts non-public;
- keep public report, public technique display, public scoring and production_safe blocked.

## 14. Next research priority

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
