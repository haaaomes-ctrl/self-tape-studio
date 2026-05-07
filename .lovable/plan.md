# Phase 0 — Task 5 Closure Plan

## 1. Phase 0 Closure Readiness Check

Verified in the codebase:

- `report.schema_version = "v1-legacy"` stamping is present in `src/server/process-take.server.ts` (~line 2703–2708).
- `app_config` carries `future_evidence_enabled`, `future_report_enabled`, `future_qa_trace_enabled`, all defaulting `false`; resolved via `src/server/app-config.server.ts`.
- `take_qa_traces` exists with RLS deny-all (migration `20260507083726_…`).
- Failure fixture suite (`src/server/__tests__/fixtures/failures/`) ships all 8 required categories: `00-clean-control`, `01-generic-praise`, `02-acting-through-song-weak`, `03-broad-vocal-praise`, `04-timestamp-underproduction`, `05-role-fit-overclaim`, `06-presentation-polish-drift`, `07-frame-break-coaching`.
- Legacy fixture scaffolding present for `mt`, `acting`, `dance`, `voice`, `commercial` (each with `.gitkeep`); loader at `src/server/__tests__/fixtures/index.ts` already tolerates missing/empty directories via `fs.existsSync` + filtered readdir.
- `src/lib/report-schema.ts` (Task 1) and its unit tests (8 cases covering missing/empty/`v1-legacy`/`v2-component`/unknown/null/numeric) are in place — green.
- `src/server/__tests__/report-public-boundary.test.ts` (Task 2) is in place — green.
- Vitest 4.1.5 installed; renderers untouched.

Closure tasks may proceed.

## 2. Remaining work in this run

Only three small additions remain. None change user-facing behaviour.

### A. Extend the boundary test's forbidden-key list

`src/server/__tests__/report-public-boundary.test.ts` currently checks 8 forbidden keys. Task 2 specifies 15. Extend `FORBIDDEN_KEYS` to add: `shadow_score`, `dimension_traces`, `evidence_dimensions`, `internal_dimensions`, `internal_qa`, `take_qa_traces`, `future_evidence`, `future_dimensions`. Re-assert representative report and nested-leak regression cases.

### B. Add legacy fixture loader test (Task 4)

New file `src/server/__tests__/legacy-fixture-loader.test.ts`:

- `loadLegacyFixtures()` returns an array (currently empty — that is the truthful state for Phase 0).
- Calling per-branch (`loadLegacyFixtures("dance")`, `"voice"`, `"commercial"`) returns `[]` without throwing — proves empty-directory tolerance.
- For every fixture loaded (currently zero, but the assertion stays), the `expected_report` JSON contains none of the boundary-forbidden keys — guards future additions.

### C. Add Phase 0 no-behaviour-change posture test (Task 5)

New file `src/server/__tests__/phase0-posture.test.ts`:

- Reads `src/server/app-config.server.ts` source and asserts the three `future_*` flags default to `false` in the resolver fallback path.
- Imports `readReportSchemaVersion` and re-asserts that a stamped `{ schema_version: "v1-legacy" }` report resolves to `"v1-legacy"` (i.e. stamping never escalates to v2).
- Greps `src/routes/audition.$auditionId.tsx` and `src/components/checklist-view.tsx` source for `schema_version` and `v2-component` and asserts neither token appears — proves renderers are not branching on version yet.
- Asserts the canonical public score-field set (`technical`, `audio`, `vocal`, `acting`, `brief_adherence`, `professional_presentation`) is referenced by `src/lib/audition-rules.ts` (or wherever it is the source of truth) — a structural smoke test that no field was removed in Phase 0.

### D. Verification

Run `bunx vitest run --dir src` and report counts.

## 3. Explicitly NOT in this run

- No Phase 1 evidence dimensions, no Phase 2 shadow scoring or QA trace writes, no Phase 3 v2 schema/UI, no Phase 4 admin dashboard.
- No renderer changes. `audition.$auditionId.tsx` and `checklist-view.tsx` remain untouched.
- No scoring, weights, caps, blockers, verdict thresholds, role-fit bounds, audition types, Mux/upload, polish, or quality-scrub changes.
- No fabricated Dance / Voice / Commercial live artefacts. Their legacy directories remain empty by design; the loader test proves emptiness is safe.
- No backfill of historical reports. Read-time defaulting via `readReportSchemaVersion` is the contract.
- No client exposure of feature flags.

## 4. Exit criteria

- Boundary test enforces all 15 forbidden keys, green.
- Legacy loader test proves empty-branch tolerance and per-fixture boundary safety, green.
- Phase 0 posture test proves flags default false, schema-version helper defaults to `v1-legacy`, renderers do not branch on version, and the public score-field set is intact, green.
- `bunx vitest run --dir src` reports all suites green with no skipped tests.

End state: **Phase 0 complete. Ready for review before Phase 1.**
