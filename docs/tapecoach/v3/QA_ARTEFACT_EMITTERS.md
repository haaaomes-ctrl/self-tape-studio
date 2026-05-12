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
