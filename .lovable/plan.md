# Phase 3A — v2 Component Report JSON Dark Launch (builder-only)

## 1. Phase 3A Readiness Check

- Phase 2 closure accepted: yes
- Source files inspected: yes (`process-take.server.ts`, `report-schema.ts`, `app-config.server.ts`, `evidence-pass.server.ts`, `shadow-scoring.server.ts`, `disciplines/*`, `dimensions/*`, `audition.$auditionId.tsx`, `checklist-view.tsx`)
- Current public scoring path identified: yes (`audition-rules.ts` + `recomputeOverall`/`applyCapsAndLabel`; report built from polish or fallback; persisted at `process-take.server.ts:~2838` into `takes.report` and `takes.scores`)
- Current report persistence path identified: yes (single `update({ report, scores, overall_score, score_breakdown, ... })` at line ~2838)
- Current renderer assumptions inspected: yes (`audition.$auditionId.tsx` uses `select("*")` and reads `report.*` v1 fields directly; no `schema_version` branch; `checklist-view.tsx` reads v1 shape)
- `future_report_enabled` default false confirmed: yes (`SAFE_DEFAULTS` in `app-config.server.ts`)
- Public/private boundary tests present: yes (`report-public-boundary`, `client-payload-boundary`)
- v2 dark-launch may proceed: partial — **builder-only**. The v1 renderer reads `takes.report.*` directly without honouring `schema_version`, so writing a v2 object into `takes.report` in this phase would break ordinary users. Per the "Hard safety rule", v2 persistence is deferred to Phase 3B (renderer branch). Phase 3A delivers the pure server-side v2 builder, flag-gated invocation behind `future_report_enabled` for log/QA-only use, and full boundary tests.
- Caveats: no v2 write into `takes.report` or `score_breakdown`. No optional persistence to `take_qa_traces` either (out of Phase 3A scope; QA traces remain structural-only). v2 output is constructed and logged structurally only.

## 2. Source Surface Map

| Surface | File | Current behaviour | Phase 3A relevance | Change? | Risk | Action |
|---|---|---|---|---|---|---|
| Final report assembly / persistence | `src/server/process-take.server.ts` (~1411, ~2838) | builds `report = twoStepReport`/legacy; persists `report`, `scores`, `score_breakdown` | call v2 builder when flag on, log only | yes (additive try/catch block) | low | add flag-gated builder call after `report` finalised, before persistence; do NOT mutate `report` |
| Report schema/version helper | `src/lib/report-schema.ts` | exports `readReportSchemaVersion`, defaults to v1-legacy | reused by v2 builder | no | none | reuse |
| Step 1 evidence pass | `src/server/evidence-pass.server.ts` | unchanged, returns `futureDimensions` | input to v2 builder | no | none | consume read-only |
| Step 2 polish pass | `src/server/report-polish.server.ts` | unchanged | provides v1 narrative inputs | no | none | reuse |
| Shadow scoring | `src/server/shadow-scoring.server.ts` | private only | NOT consumed by v2 public output | no | leak risk | exclude |
| QA trace writing | `src/server/qa-trace.server.ts` | service-role only | unrelated | no | none | leave |
| Deterministic scoring | `src/lib/audition-rules.ts` | source of truth for public scores | v2 `scores` reuses already-computed values | no | regression | do not change |
| Quality scrubs | `src/server/report-quality.server.ts` | unchanged | unrelated | no | none | leave |
| Audition route renderer | `src/routes/audition.$auditionId.tsx` | reads v1 shape via `select("*")` | must remain unchanged | no | render break if mutated | leave |
| Checklist renderer | `src/components/checklist-view.tsx` | reads v1 fields | unchanged | no | none | leave |
| Comparison view | comparison surface | unchanged | unchanged | no | none | leave |
| Tests | `src/server/__tests__/*` | 65 green | add v2 contract + boundary tests | yes (additive) | none | add new test files |

## 3. v2 Report Contract (Phase 3A)

Public keys (top-level of v2 object):

- `schema_version: "v2-component"` (required)
- `mode: "brief" | "baseline"` (mirror of v1)
- `audition_type` (mirror of v1)
- `headline` (string; sourced from existing v1 `report.headline`)
- `verdict` (mirror of existing v1 verdict)
- `overall_readiness` (number; mirror of existing `overall_score_final` / `overall_score`)
- `scores` (the **existing six fields** taken verbatim from current production scoring output: `technical`, `audio`, `vocal`, `acting`, `brief_adherence`, `professional_presentation`)
- `reliability` (mirror of v1 `feedback_reliability`)
- `confidence` (mirror of v1)
- `components[]` — derived from validated `futureDimensions.components` (type, subtype/style/form, start, end, assessability, sufficiency); no anchors, no raw prose, no dimension confidences exposed; only structural identifiers and labels from production constants
- `public_categories[]` — fixed list mirroring the six existing public score field labels (no new discipline-specific labels)
- `strengths[]`, `improvements[]`, `fix_first` — copied verbatim from v1 report
- `timestamped_notes[]` — copied verbatim from v1 report (locked)
- `next_take_plan` — copied verbatim from v1
- `risk_flags[]` — copied verbatim from v1 `risk_flags` / blockers
- `presentation_notes` — copied verbatim from v1
- `role_fit` — present **only** when `mode === "brief"`, copied verbatim

Optional v1 compatibility keys: all v1 top-level fields are mirrored on the v2 object so a v1 reader could still parse it during dark-launch staging (additive, not breaking).

Forbidden private keys (must never appear): `shadow_scores`, `shadow_score`, `shadow_divergence`, `future_shadow`, `qa_counters`, `scrub_counters`, `components_summary`, `dimensions_summary`, `dimension_traces`, `evidence_dimensions`, `internal_dimensions`, `internal_qa`, `take_qa_traces`, `future_evidence`, `future_dimensions`, `future_components`, `evidence_anchors`, `dimension_confidence`, `future_dimension_validation`, `qa_trace`, `legacy_scores`.

Relationships:
- `scores` and `verdict` come from existing production scoring only — never derived from `shadow_scores` or dimensions.
- `components[]` is structural metadata only; no per-dimension confidence and no anchor objects are surfaced.
- v2 builder is pure: same inputs → same output; no I/O; no mutation of inputs.

## 4. Patch Plan

| ID | Requirement | File | Change | Why | Must preserve | QA | Risk |
|---|---|---|---|---|---|---|---|
| P1 | v2 builder | `src/server/v2-report-builder.server.ts` (new) | add pure `buildV2Report({ legacyReport, futureDimensions, auditionType, mode })` returning v2 object | dark-launch foundation | v1 inputs unmutated | unit tests | low |
| P2 | Flag-gated invocation (log only) | `src/server/process-take.server.ts` | after `twoStepReport` finalised, when `future_report_enabled === true` and `futureDimensions` present, call builder inside try/catch and `console.log("[take-pipeline] v2_report_constructed", { take_id, schema_version, components, scores_source })` | dark-launch | no write to `report`/`score_breakdown`; v1 path identical when flag false | tests + log inspection | low |
| P3 | v2 contract tests | `src/server/__tests__/v2-report-builder.test.ts` (new) | structural shape, score parity, mode-gated `role_fit`, components shape | proves contract | — | vitest | none |
| P4 | v2 boundary tests | `src/server/__tests__/v2-report-boundary.test.ts` (new) | scan v2 output for forbidden keys at any depth | privacy proof | — | vitest | none |
| P5 | Flag-off non-regression test | `src/server/__tests__/v2-flag-off-isolation.test.ts` (new) | with flag false, builder is not invoked from pipeline path; legacy report unchanged | preserves v1 | — | vitest | none |
| P6 | Renderer/comparison no-change assertion | `src/server/__tests__/renderer-no-change.test.ts` (new) | static read of `audition.$auditionId.tsx` and `checklist-view.tsx` confirming no `schema_version === "v2-component"` branch present | proves no UI change | — | vitest | none |

## 5. Implementation (planned, not executed in plan mode)

Allowed only:
- new pure builder + tests (P1, P3, P4, P5, P6)
- additive flag-gated log invocation in `process-take.server.ts` (P2), wrapped in try/catch, no mutation of `report`/`scores`/`score_breakdown`

Explicitly disallowed in this phase:
- writing v2 into `takes.report`
- writing v2 into `take_qa_traces`
- any UI/renderer/comparison change
- any change to `audition-rules.ts`, `report-polish.server.ts`, `report-quality.server.ts`
- exposure of `future_report_enabled` to client
- shadow/QA data inclusion in v2 output
- v2 public rollout, admin dashboard, blocker/cap/verdict change

## 6. Changed Files Summary (planned)

| Path | Change | Why | Public impact | Scoring impact | Privacy impact | Tests | Risk |
|---|---|---|---|---|---|---|---|
| `src/server/v2-report-builder.server.ts` | new pure builder | foundation | none | none | excludes private keys by construction | P3, P4 | low |
| `src/server/process-take.server.ts` | additive flag-gated try/catch builder call + `console.log` only | dark-launch | none | none | no write to `report`/`score_breakdown` | P5 | low |
| `src/server/__tests__/v2-report-builder.test.ts` | new | proves contract | none | none | none | self | none |
| `src/server/__tests__/v2-report-boundary.test.ts` | new | proves no leak | none | none | enforces boundary | self | none |
| `src/server/__tests__/v2-flag-off-isolation.test.ts` | new | proves v1 preserved | none | none | none | self | none |
| `src/server/__tests__/renderer-no-change.test.ts` | new | proves no renderer branch | none | none | none | self | none |

## 7. Non-Changed Critical Files

- `src/lib/audition-rules.ts` — scoring source of truth; untouched.
- `src/server/report-polish.server.ts` — Step 2 polish; untouched.
- `src/server/report-quality.server.ts` — quality scrubs; untouched.
- `src/routes/audition.$auditionId.tsx` — v1 renderer; untouched (avoids breaking ordinary users).
- `src/components/checklist-view.tsx` — v1 renderer; untouched.
- Comparison surface — untouched.
- Migrations — none added (no schema change required for builder-only dark launch).
- `src/lib/report-schema.ts` — reused; untouched.
- `src/server/shadow-scoring.server.ts`, `src/server/qa-trace.server.ts` — Phase 2 internals; untouched.

## 8. Phase 3A Test Plan

- Flag false: pipeline behaviour byte-identical to current (no builder call, no log line emitted).
- `readReportSchemaVersion(undefined | null | "garbage" | {})` still defaults to `"v1-legacy"`.
- Flag true + valid `futureDimensions`: builder returns v2 object containing `schema_version: "v2-component"`.
- v2 `scores` deep-equal to the legacy `report.scores` passed in (proves public scores still come from production scoring).
- v2 contains no forbidden private keys (deep recursive scan).
- v2 `role_fit` only present when `mode === "brief"`.
- v2 `components[]` contains only whitelisted structural fields; no `evidence_anchors`, no `dimensions`, no `dimension_confidence`.
- `takes.report` public-boundary test still passes (existing).
- Client-payload boundary test still passes (existing).
- Step 2 isolation test still passes (existing).
- Scoring non-regression: import `audition-rules.ts` exports unchanged (existing).
- Renderer no-change: static-read assertion that `audition.$auditionId.tsx` and `checklist-view.tsx` contain no `"v2-component"` literal.
- Full suite (current 65 tests + new) all green.

## 9. Specific Boundary Tests

`v2-report-boundary.test.ts` recurses every node in the builder output and fails if any of the following keys appear at any depth: `shadow_scores`, `shadow_score`, `shadow_divergence`, `future_shadow`, `qa_counters`, `scrub_counters`, `components_summary`, `dimensions_summary`, `dimension_traces`, `evidence_dimensions`, `internal_dimensions`, `internal_qa`, `take_qa_traces`, `future_evidence`, `future_dimensions`, `future_components`, `evidence_anchors`, `dimension_confidence`, `future_dimension_validation`, `qa_trace`. The same scan is also asserted against a synthetic `takes` row carrying `report` set to the v2 output, to prove that even if a future operator wrote v2 into `report`, it would not leak any of the listed private tokens.

## 10. Phase 3A QA Artefacts

After implementation:
- v1 flag-off generated report sample (test fixture printed to log line).
- v2 flag-on dark-launch generated report sample (test fixture printed to log line).
- Diff showing public `scores`, `verdict`, `overall_readiness` byte-identical between v1 and v2 builder outputs for the same inputs.
- Static grep proving `audition.$auditionId.tsx` and `checklist-view.tsx` contain no `"v2-component"` literal (renderer no-change).
- Static grep proving no v2 write into `takes.report` or `score_breakdown`.
- Public/private boundary test output (vitest summary).
- Full test suite output (target: 71/71 green).

## 11. Risk Register

| Risk | Severity | Likelihood | Mitigation | Release impact | Phase 3B implication |
|---|---|---|---|---|---|
| v2 visible to ordinary users | High | Very Low | builder-only; not persisted; flag default false | none | Phase 3B must add renderer branch before any persistence |
| v1 renderer breaks on v2 report | High | Very Low | no v2 write to `report` in this phase | none | Phase 3B introduces `schema_version` branch in renderer |
| Private data leaks into `takes.report` | High | Very Low | v2 not persisted; boundary test scans builder output | none | maintain test |
| Private data leaks into `score_breakdown` | High | Very Low | not modified | none | maintain |
| Shadow scores become public | High | Very Low | `scores` taken verbatim from existing production output; builder rejects shadow inputs | none | maintain test |
| Flag defaults true | High | Very Low | `SAFE_DEFAULTS` asserts false; flag test exists | none | re-assert in Phase 3B |
| Step 2 receives future dimensions early | High | Very Low | `flag-on-isolation` test still green; builder runs after Step 2 | none | maintain |
| v2 builder duplicates unsafe wording | Medium | Low | wording fields copied verbatim from already-scrubbed v1; no new prose | none | revisit in Phase 3B |
| v2 weakens MT acting+song structure | Medium | Low | components keep MT subtype/style/form structure from validated dimensions | none | live-output review in Phase 3B/4 |
| Tests pass structurally but real model behaviour unproven | High | Certain | documented caveat | none until rollout | Phase 3B+ requires live-sample calibration |

## 12. Stop / Continue Decision

Proposed: **Phase 3A planning complete; ready to implement builder-only path on approval.**

- Rationale: builder-only dark launch is the safest interpretation of the "Hard safety rule" — the v1 renderer reads `takes.report.*` directly and would break if we wrote v2 into that column today. The builder + flag-gated log + boundary tests deliver the JSON foundation Phase 3B needs, with zero risk to ordinary users.
- Blockers (to address in Phase 3B before any v2 persistence): renderer branch on `schema_version`; staged write gate (admin/staging-only) before v2 enters `takes.report`; live-sample calibration of components/categories.
- Phase 3B may start only after Phase 3A closure audit confirms the builder boundary holds.
- Must remain behind flags: v2 builder invocation, future renderer branch, future persistence.
- Must be verified before any user-facing rollout: renderer parity, comparison-page parity, MT/Dance/Voice/Commercial live samples, real-output QA-counter calibration, release gate criteria.
