# Phase 0 — Closure Plan

Most of Phase 0 from the approved revised plan is already in place from prior turns. This plan covers the small remaining gaps and a verification pass. No user-facing behaviour changes.

## What's already in place (verified)

- **Schema-version stamping** — `src/server/process-take.server.ts` lines ~2703–2708 stamp `report.schema_version = "v1-legacy"` on every write unless already set.
- **Server-only feature flags** — `app_config` has `future_evidence_enabled`, `future_report_enabled`, `future_qa_trace_enabled` (all default false). Read via `src/server/app-config.server.ts`. No client exposure.
- **`take_qa_traces` table** — created with RLS deny-all (migration `20260507083726_…`), `ON DELETE CASCADE` from `takes`, indices on `(branch, created_at DESC)` and `schema_version`. Only service-role server code can read/write.
- **Failure fixture suite** — `src/server/__tests__/fixtures/failures/` contains all 8 fixtures (clean control + 7 known MT failure modes: generic praise, weak acting-through-song, broad vocal praise, timestamp underproduction, role-fit overclaim, presentation/polish drift, frame-break coaching).
- **Legacy fixture scaffolding** — `src/server/__tests__/fixtures/legacy/{mt,acting,dance,voice,commercial}/` directories + loader (`fixtures/index.ts`) + README. Real artefacts added incrementally.
- **Harness test** — `src/server/__tests__/future-state-fixtures.test.ts` asserts every required failure mode is present and well-formed.
- **Vitest** installed as dev dependency.
- **Renderers untouched** — `audition.$auditionId.tsx` and `checklist-view.tsx` do not branch on `schema_version`, so v1 reports (with or without the field) continue to render exactly as today. This satisfies "treat missing as v1-legacy at read time" by construction.

## Remaining Phase 0 work

### 1. Defensive read helper for `schema_version`

Add a tiny pure helper `readReportSchemaVersion(report)` in a new
`src/lib/report-schema.ts` that returns `"v1-legacy" | "v2-component"`,
defaulting to `"v1-legacy"` for missing/unknown values. **Not wired into
renderers** in Phase 0 (no UI change), but available for Phase 3 to
import. Keeps the rule "missing means v1-legacy" in one auditable place.

### 2. R1 boundary enforcement test

Add `src/server/__tests__/report-public-boundary.test.ts` — a unit test
that takes a representative current `report` JSON (synthesised in-test from
the existing schema) and asserts none of the forbidden keys appear at any
depth: `shadow_scores`, `shadow_divergence`, `future_shadow`,
`qa_counters`, `scrub_counters`, `dimensions_summary`. This locks in
amendment R1 ("public/private boundary") so future phases can't regress.

### 3. Verification pass

Run `bunx vitest run src/server/__tests__/` and confirm green. Report
results.

## Explicitly NOT in this run

- No Phase 1 dimensions, no Phase 2 shadow scoring, no Phase 3 v2 schema, no Phase 4 admin page.
- No `user_roles` / `has_role` table — the admin read path lands with the QA admin page in Phase 4. Until then, `take_qa_traces` is reachable only via the service-role server client, which is the correct deny-all posture for Phase 0.
- No renderer changes. v1 reports continue to render via the existing path.
- No changes to scoring fields, weights, caps, blockers, verdicts, role-fit bounds, audition types, Mux/upload, polish, quality scrubs, or visible report text.
- No backfill of `schema_version` on historical rows. Read-time defaulting handles them.

## Exit criteria

- All three new flags resolved through `app-config.server.ts` and default false.
- `take_qa_traces` exists with deny-all RLS; no writes occur in Phase 0 (writes start in Phase 2 under `future_qa_trace_enabled`).
- Failure fixture suite covers all 8 required modes; legacy fixture loader returns an array.
- New schema-version helper exists and is unit-tested for the missing/`v1-legacy`/`v2-component`/garbage cases.
- R1 boundary test green.
- No user-visible behaviour change.
