# TapeCoach v3 internal QA artefact emitters (dark mode)

This note implements the first internal-only QA artefact emitter foundation for TapeCoach v3.

- The emitter is **internal-only** and **disabled by default**.
- When explicitly enabled, it writes a deterministic run manifest to:
  - persisted sink path: `qa-artifacts/<run_id>/manifest.json`
  - manifest-declared QA root: `qa-artifacts/takes/take-<take_id>/analysis-<analysis_run_id>/` or `qa-artifacts/comparisons/comparison-<comparison_run_id>/`
- The manifest is for Level 2 QA bookkeeping and records emitted/emitted_blocked/missing/deferred/not_applicable artefacts.
- `emitted_blocked` means we emitted a trace/report describing blocked/deferred/not-executed runtime evidence and **does not** count as successful runtime-evidence proof.
- Missing artefacts are intentionally recorded with blocker codes (not fabricated).
- Generated run artefacts are not public output and must not be exposed via public routes.
- MP4 media files are not required for manifest emission and should not be committed as QA output evidence.
- Rendered page-print PDFs are treated as rendered/manual evidence only, not raw trace or parity proof.
- No-export status is complete only when the four-lane proof files exist (source/config/UI/log); otherwise it remains blocked with `no_export_proof_missing`.
- Level 2 QA is not accepted from physical artefact emission alone; all required trace, validator, gate, model, parity and public-boundary gates must truly satisfy.

## Pipeline wiring status

- Wired at server analysis pipeline surface: `runProcessTake` in `src/server/process-take.server.ts` via `emitQAManifestForAnalysisRun`.
- Enabling path is explicit: `internal_qa_emit` input or env flags `V3_QA_ARTIFACTS_ENABLED=true` / `INTERNAL_QA_EMIT=true`.
- Output remains internal-only and best-effort. Current sink layout stores files under `qa-artifacts/<run_id>/...` while manifest metadata provides stable take/comparison identity roots.
- Manifest emission is best-effort and non-blocking for user-facing analysis completion; failures are logged as internal warnings.
- Public response/report/comparison payloads are unchanged by wiring.
- Level 2 QA remains not accepted while evidence-spine and proof-chain blockers remain. S9-17 report parity and the no-export proof family can emit, but they do not accept Level 2 by themselves.
- S9-17 closes the internal render/public report parity path; S9-18 should focus on the remaining real Step 1 evidence extraction and public-claim support blockers.

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
  - `qa-artifacts/<run_id>/takes/take-<take_id>/analysis-<analysis_run_id>/reports/raw_report.json`
  - `qa-artifacts/<run_id>/comparisons/comparison-<comparison_run_id>/comparison/comparison.raw.json`
  - `qa-artifacts/<run_id>/manifest.json`
- Current artefacts produced:
  - per-take raw report JSON from analysis path when enabled;
  - manifest JSON with emitted-vs-missing status;
  - comparison raw JSON via helper/integration tests only.
- Current artefacts still missing or non-satisfying for Level 2:
  - incomplete EvidenceAnchors/PublicClaimTrace support, legacy/internal ScoreTrace and TechniqueObservationTrace support, non-independent ValidatorTrace/GateTrace/ModelRunTrace proof chains, and comparison parity for invoked duplicate/same-video runs without decisive evidence-delta/no-material-difference proof.
- Blockers cleared:
  - `raw_JSON_missing` only when raw report emitter writes and manifest is passed `raw_report` in emitted artefact IDs.
  - `comparison_JSON_missing` only when comparison raw emitter writes and manifest is passed `comparison_raw` in emitted artefact IDs.
- Blockers still active:
  - all remaining blocker codes stay active unless corresponding artefacts are genuinely emitted.
- GF-01 / RT-15 status:
  - remains blocked/not accepted unless repeatability, route-variance and suppression traces contain real runtime evidence;
  - synthetic/default/placeholder traces must not clear comparison-safety gates.
- Live production-domain locked-down test requirement:
  - still required for release evidence; not required to merge this dark-mode internal foundation PR.
- PR merge:
  - mergeable as dark-mode QA-emitter foundation if targeted tests pass, no public-output change, and full-suite failures are classified.
- Level 2 QA:
  - still not accepted because remaining evidence-spine and proof-chain gates are incomplete, even when report parity and no-export proof lanes emit.

## Runtime sink policy

- GitHub is **not** a runtime artefact sink.
- Filesystem sink (`qa-artifacts/<run_id>/...`) is local/dev only unless the runtime keeps files retrievable.
- Locked-down Lovable production should use `QA_ARTIFACT_SINK=storage` with private bucket `qa-artifacts`.
- Object key pattern is `v3/<run_id>/<relative_path>` (for example `v3/<run_id>/manifest.json`).
- Optional fallback logging: `QA_ARTIFACT_LOG_FALLBACK=true` emits one JSONL-style line per write attempt, prefixed with `TAPECOACH_QA_ARTIFACT_JSON:`.
- Storage/log sinks are internal-only and non-public.
- Database-backed QA artefact indexing is deferred to a later QA dashboard/search phase.
- Level 2 remains not accepted until artefacts are emitted, retrieved, and inspected.
