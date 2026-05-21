# S9-19H Live Step 1 Provider Contract And Suppression Validation Repair

## Purpose

S9-19H targets the live runtime gaps that remained after S9-19G. The source tests passed, but the Lovable/OpenRouter Step 1 evidence-mapping stage still failed with HTTP 400 for `google/gemini-3-flash-preview`, and suppression validation still failed despite report parity, public payload and no-export artefacts proving public score and public technique-authority absence.

## Blocker Closure Map

### A. Live Step 1 Provider / Request Contract Failure

- Provider/model/path used: Lovable gateway chat completions, OpenRouter provider, `google/gemini-3-flash-preview`, `analysis_step_1_evidence_mapping`, prompt version `evidence_pass_current`.
- Current failing request surface: tool/function calling with a large JSON schema, multimodal `file_url` content and forced `tool_choice`.
- Likely unsupported fields: `tools` / `tool_choice` function-calling shape for the selected provider/model route; S9-19G removed nullable schema arrays, but live still returned HTTP 400.
- Fix strategy: route Gemini/OpenRouter Step 1 through a compact plain JSON observation contract with no `tools`, no `tool_choice`, and no strict `response_format` dependency. Parse the returned JSON locally and reject malformed/unsafe output without storing raw prompts, raw responses or request bodies.
- Fallback behaviour: if the provider still fails or returns malformed JSON, keep Step 1 failed with safe error category and do not fake evidence.
- Why source tests passed: S9-19G tests verified schema sanitisation and safe failure classification, but did not exercise the live provider capability mismatch created by the function-calling request shape.

### B. Step 1 Observation Extraction

- Safe families to project after provider success: `video_observable`, `audio_observable`, `material_specific`, `performance_observable`, and `candidate_technique`.
- Accepted observations must be non-judgemental, internal-only, source-pathable and truth-linked downstream.
- Rejected candidates include scores, readiness verdicts, role-fit/casting/bookability/marketability, public named technique authority, public comparison recommendations, raw report prose and render/public/parity payload text.
- Families may remain partial if the provider produces too few safe observations or if truth IDs/source paths cannot be resolved.

### C. TechniqueObservationTrace

- Internal technique observations can be emitted only from accepted Step 1 `candidate_technique` observations or safe descriptor candidates derived from accepted Step 1 observations.
- Public technique authority remains blocked.
- If Step 1 succeeds but no accepted candidate-technique evidence exists, `technique_trace_requires_step1_candidate_technique_extractor` remains the exact blocker.

### D. Public Scoring Suppression Validation

- Existing artefacts can prove score absence when parity passes, blocked score fields are absent, public output permissions block score display, no-export is complete, ScoreTrace is internal-only and public score claims are suppressed or absent.
- Live failure cause in source wiring: manifest finalisation collapsed the parity proof down to `{ parity_status }`, dropping `blocked_score_fields_absent`, `forbidden_fields_absent` and `public_output_permissions_checked` before acceptance metrics/ValidatorTrace/GateTrace re-ran.
- Fix strategy: propagate the full report parity summary into manifest finalisation and metrics.

### E. Public Technique Suppression Validation

- Existing artefacts can prove technique-authority absence when parity passes, blocked technique-authority fields are absent, the content scan is safe, public output permissions block technique authority, no-export is complete and public technique-authority claims are suppressed or absent.
- Live failure cause in source wiring: the final manifest lost `blocked_technique_authority_fields_absent` and `public_technique_authority_content_scan_safe`, so metrics kept stale validation blockers.
- Fix strategy: preserve full parity payload fields through manifest finalisation and keep public technique suppression independent from the internal TechniqueObservationTrace gate.

### F. Remaining Release / Provenance / Comparison Blockers

- Deployment provenance remains blocked unless safe env vars or operator confirmation provide it.
- Runtime operator verification remains required unless fresh current-deployment artefacts are supplied.
- Production/customer release remains blocked.
- Same-video comparison remains detected/suppressed/fail-closed unless decisive evidence-delta/no-material-difference proof is implemented.

## Intended Result

S9-19H should make the live Step 1 request provider-compatible, allow safe Step 1 observations to feed AnalysisEvidenceState/EvidenceAnchors/TechniqueObservationTrace, and remove stale public score/technique suppression blockers when parity/payload/no-export/claim evidence genuinely proves absence. It must not approve public scoring, public technique authority, public comparison recommendation, production safety or customer release.

## Implementation Summary

- Added a provider-contract selector for Step 1 evidence pass calls. `google/gemini-3-flash-preview` now uses a compact plain JSON observation contract instead of tool/function calling.
- Added a strict compact Step 1 parser for `tapecoach_step1_observable_evidence_v1`. Unsafe or judgemental observations are filtered before they can enter Step1ObservableEvidence projection.
- Added compact Step 1 observation projection into `filterRunEvidencePassForStep1`, covering video, audio, material, performance and candidate-technique families from safe observation-only source paths.
- Marked compact Step 1 evidence as observation-only so the runtime falls back to the existing single-pass report generation path instead of using non-score Step 1 observations as Step 2 score calibration. This preserves public report behaviour while Step 1 QA evidence improves.
- Preserved full report parity payload fields through manifest finalisation. Acceptance metrics, ValidatorTrace and GateTrace can now see `blocked_score_fields_absent`, `blocked_technique_authority_fields_absent`, `forbidden_fields_absent`, `public_output_permissions_checked` and `public_technique_authority_content_scan_safe`.
- Added focused S9-19H tests for provider request shape, compact Step 1 parsing/projection, and report parity summary preservation.

## Resulting Gate Posture

- Step 1 provider/request-contract result: source now avoids the live Gemini/OpenRouter tool-call contract that produced HTTP 400; fresh runtime verification is still required.
- Step1ObservableEvidence result: safe compact observations can populate all required families when the live provider returns them.
- TechniqueObservationTrace result: can improve once accepted Step 1 candidate-technique observations exist; public technique authority remains blocked.
- Public scoring suppression validation result: stale parity-absence blockers can clear when the full parity summary proves absence.
- Public technique authority suppression validation result: stale parity/content-scan blockers can clear when the full parity summary proves field and content absence.
- Global Level 2 remains `not_accepted`; production/customer release, runtime operator verification and deployment provenance remain blocked unless separately supplied.
