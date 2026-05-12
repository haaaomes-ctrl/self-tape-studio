# TapeCoach v3 internal QA artefact emitters (dark mode)

This note implements the first internal-only QA artefact emitter foundation for TapeCoach v3.

- The emitter is **internal-only** and **disabled by default**.
- When explicitly enabled, it writes a deterministic run manifest to:
  - `qa-artifacts/<run_id>/manifest.json`
- The manifest is for Level 2 QA bookkeeping and records emitted/missing/deferred/not_applicable artefacts.
- Missing artefacts are intentionally recorded with blocker codes (not fabricated).
- Generated run artefacts are not public output and must not be exposed via public routes.
- MP4 media files are not required for manifest emission and should not be committed as QA output evidence.
- Rendered page-print PDFs are treated as rendered/manual evidence only, not raw trace or parity proof.
- No-export status remains blocked (`no_export_proof_missing`) unless four-lane proof files exist (source/config/UI/log).
- Level 2 QA is not accepted until raw JSON, trace, validator, and parity artefacts are emitted by the pipeline.

## Pipeline wiring status

- Wired at server analysis pipeline surface: `runProcessTake` in `src/server/process-take.server.ts` via `emitQAManifestForAnalysisRun`.
- Enabling path is explicit: `internal_qa_emit` input or env flags `V3_QA_ARTIFACTS_ENABLED=true` / `INTERNAL_QA_EMIT=true`.
- Output remains limited to `manifest.json` under `qa-artifacts/<run_id>/`.
- Manifest emission is best-effort and non-blocking for user-facing analysis completion; failures are logged as internal warnings.
- Public response/report/comparison payloads are unchanged by wiring.
- Level 2 QA remains not accepted because raw reports, comparison raw JSON, full traces, parity, and no-export four-lane proof files are still missing unless separately emitted.
- S8-23/S8-24 should wire raw report/comparison JSON emitters and trace/parity/no-export proof lanes into the same run context.

## S8-23 raw report and comparison raw emitter status

- Emitter paths:
  - `src/server/v3/qa-artifacts-wiring.ts` (`emitRawReportArtefact`, `emitComparisonRawArtefact`)
  - `src/server/v3/qa-artifacts.ts` (manifest status reconciliation)
- Wired runtime paths:
  - Analysis raw report: wired in `runProcessTake` (`src/server/process-take.server.ts`).
  - Comparison raw: helper exists; live runtime wiring is currently not_found in this repository path and remains deferred.
- Flags/env gates:
  - `internal_qa_emit`
  - `V3_QA_ARTIFACTS_ENABLED=true`
  - `INTERNAL_QA_EMIT=true`
- Output paths:
  - `qa-artifacts/<run_id>/reports/take_<n>.raw_report.json`
  - `qa-artifacts/<run_id>/comparison/comparison.raw.json`
  - `qa-artifacts/<run_id>/manifest.json`
- Current artefacts produced:
  - per-take raw report JSON from analysis path when enabled;
  - manifest JSON with emitted-vs-missing status;
  - comparison raw JSON via helper/integration tests only.
- Current artefacts still missing:
  - resolver output, TruthStateMap, EvidenceAnchors, PublicClaimTrace, TechniqueObservationTrace, ScoreTrace, ModelRunTrace, comparison suppression traces, route variance trace, repeatability trace, parity, no-export four-lane proof.
- Blockers cleared:
  - `raw_JSON_missing` only when raw report emitter writes and manifest is passed `raw_report` in emitted artefact IDs.
  - `comparison_JSON_missing` only when comparison raw emitter writes and manifest is passed `comparison_raw` in emitted artefact IDs.
- Blockers still active:
  - all remaining blocker codes stay active unless corresponding artefacts are genuinely emitted.
- Live production-domain locked-down test requirement:
  - still required for release evidence; not required to merge this dark-mode internal foundation PR.
- PR merge:
  - mergeable as dark-mode QA-emitter foundation if targeted tests pass, no public-output change, and full-suite failures are classified.
- Level 2 QA:
  - still not accepted because traces/parity/redaction/leakage/no-export proof lanes are incomplete.

## S8-24 trace, parity and no-export proof emitter status

- New helper paths:
  - `src/server/v3/qa-artifacts-wiring.ts` (`emitTraceArtefact`, `emitModelRunTraceArtefact`, `emitNoExportProofBundle`)
- Artefacts conditionally emitted when real data is supplied:
  - `traces/ModelRunTrace.json`
  - `traces/validator_trace.json`
  - `traces/gate_trace.json`
  - `traces/redaction_trace.json`
  - `traces/UKEnglishGateResult.json`
  - `traces/public_private_leakage_result.json`
  - no-export proof lane files + `no_export_proof.json` (incomplete unless all lanes exist)
- Artefacts still requiring runtime supply/wiring:
  - per-take EvidenceAnchors/PublicClaimTrace/TechniqueObservationTrace/ScoreTrace payloads,
  - resolver output / TruthStateMap / component traces,
  - live comparison trace emission wiring,
  - parity comparisons requiring real source/target artefacts.
- Blockers that can be conditionally cleared:
  - `raw_JSON_missing`, `comparison_JSON_missing` (when emitted),
  - `no_export_proof_missing` only when all four proof lanes are present and complete.
- Blockers still active by default:
  - trace/parity/comparison suppression/route variance/repeatability blockers until files are truly emitted.
- `level2_bundle_status` remains `partial` in current dark-mode runs; `level2_qa_acceptance` remains `not_accepted`.
- Comparison runtime wiring status: deferred (no safe live comparison runtime emitter integration found in current path).
- Live production-domain locked-down QA remains required for release evidence; this PR remains foundation-only and non-release-affecting.

## S8-25 live comparison runtime trace wiring status

- Comparison runtime path found: `source_only_shadow_runtime_found` (no dedicated public server comparison endpoint found; dark-mode runtime helper wiring added).
- Emitter/helper paths:
  - `src/server/v3/qa-artifacts-wiring.ts` (`emitComparisonRuntimeArtifacts`, `emitComparisonRawArtefact`, `emitTraceArtefact`).
- Artefacts now conditionally emitted when internal QA emit is enabled and comparison runtime payload is supplied:
  - `comparison/comparison.raw.json`
  - `comparison_traces/duplicate_detection_trace.json`
  - `comparison_traces/no_material_difference_trace.json`
  - `comparison_traces/evidence_delta_trace.json`
  - `comparison_traces/comparison_suppression_trace.json`
  - `comparison_traces/same_video_repeatability_trace.json`
  - `comparison_traces/route_variance_trace.json`
  - `comparison_traces/comparison_validator_trace.json`
  - `parity/comparison_parity.json` when parity input is supplied.
- GF-01 / RT-15 support:
  - operator same-media confirmation is recorded as `unverified_by_system` until automated duplicate detection exists.
  - 91/94/91 and comparison recommendation context are preserved as failure evidence.
- Blockers cleared conditionally:
  - `comparison_JSON_missing`, `comparison_suppression_trace_missing`, `same_video_repeatability_trace_missing`, `route_variance_trace_missing` clear only when corresponding files are emitted.
- Blockers still active:
  - parity and no-export blockers remain until full real artefacts/proofs exist.
- Public comparison output changed: no.
- Live production-domain locked-down test required for release evidence: yes (post-merge/deploy), but not required before merging this dark-mode foundation PR.
- PR merge status: mergeable as dark-mode/internal QA emitter wiring when targeted tests pass and full-suite failures are classified.
