## Goal

Make `npm run build:dev` and `npm run build` pass with the smallest safe changes. No public/comparison/scoring/export/Mux/webhook behaviour changes. QA artefact emitter stack and invariants preserved.

## Changes

### 1. TanStack import-protection boundary

`src/server/v3/qa-artifacts.ts` and `src/server/v3/qa-artifacts-wiring.ts` use `node:fs/promises` and are reached transitively from client-imported `.functions.ts` (via `process-take.server.ts → ./v3/qa-artifacts-wiring`). Rename both to enforce the server-only boundary explicitly:

- `src/server/v3/qa-artifacts.ts` → `src/server/v3/qa-artifacts.server.ts`
- `src/server/v3/qa-artifacts-wiring.ts` → `src/server/v3/qa-artifacts-wiring.server.ts`

Update importers:
- `src/server/process-take.server.ts` — update relative import path.
- `src/server/v3/index.ts` — re-export from new `.server` paths (barrel only consumed by tests/server code).
- All test files under `src/server/__tests__/v3-s8-*.test.ts` — update import paths.

No public surface or emitter semantics change. All emitter function names, defaults, gating, and dark-mode behaviour preserved.

### 2. TypeScript fixes (test/source narrow)

A. `src/server/__tests__/v3-s4-shadow-scoring.test.ts` — change `dimension_score_ids: ["d1"]` (or remove `as const`) so it lands as `string[]`. Scoring logic untouched.

B. `src/server/__tests__/v3-s5-internal-renderer.test.ts` — set `comparison_summary.note` to `"comparison not available in S5"`. PublicReportV3 type unchanged.

C. `src/server/__tests__/v3-s8-qa-trace-proof-emitters.test.ts` — guard `string | undefined` with non-null assertion / `expect(...).toBeDefined()` then `!`-narrow before passing as `string`. Emitter types unchanged.

D. `src/server/process-take.server.ts` — add a `typeof x === 'string' && x.length > 0` guard before passing the optional value where `string` is required. Raw report emitter remains non-blocking; emitted ID added only when `written === true` and a valid string ID exists; otherwise `raw_JSON_missing` stays active.

E. `src/server/v3/index.ts` — replace ambiguous `export *` with explicit named re-exports for the colliding members; `EvidenceSufficiency` and `QAValidationResult` re-exported from `./types` only (drop them from any other `export *` source). All required emitter symbols remain exported: `emitQAManifestForAnalysisRun`, `emitRawReportArtefact`, `emitComparisonRawArtefact`, `emitTraceArtefact`, `emitModelRunTraceArtefact`, `emitNoExportProofBundle`, `emitComparisonRuntimeArtifacts`, `safeEmitRawReportForQA`, `v3_internal_qa_emit_enabled`.

F. `src/server/v3/s6-internal-comparison-renderer.ts` — locate the `severity: "P0"` literal that is being assigned to a `Severity = "P1"`-narrowed field. Either widen the local internal-finding severity union to `"P0" | "P1"` (internal-only type, no public surface) or, if the finding is genuinely P1, change the literal to `"P1"`. Use whichever matches the surrounding intent of the file; do not alter comparison recommendation logic or public output.

G. `src/server/v3/s6-variance-comparison.ts` — `V3ReleaseState` is defined in `./release-state`, not re-exported from `./types`. Change the import to `import type { V3ReleaseState } from './release-state'` (split from the `./types` import).

### 3. Verification

- Run targeted vitest files listed in the brief, then `npx vitest --run`.
- Run `npm run build:dev` and `npm run build`.
- Guardrail rg scans for `production_safe`, `Submit Take`, `export`, `Mux|webhook|upload`.

### 4. Invariants preserved

- QA emission default disabled; failures non-blocking.
- `gate_trace` → `gate_trace_missing`; distinct from `validator_trace_missing`.
- Synthetic suppression/repeatability traces not marked emitted without runtime data.
- `production_safe`, public technique authority, public scoring all remain blocked.
- No change to public report, comparison output, recommendation text, export, Mux, webhook, upload.

## Files touched

- rename: `src/server/v3/qa-artifacts.ts`, `src/server/v3/qa-artifacts-wiring.ts`
- edit: `src/server/v3/index.ts`, `src/server/v3/s6-variance-comparison.ts`, `src/server/v3/s6-internal-comparison-renderer.ts`, `src/server/process-take.server.ts`
- edit tests: `v3-s4-shadow-scoring.test.ts`, `v3-s5-internal-renderer.test.ts`, `v3-s8-qa-trace-proof-emitters.test.ts`, and the 5 other `v3-s8-*.test.ts` files (import path update only)
