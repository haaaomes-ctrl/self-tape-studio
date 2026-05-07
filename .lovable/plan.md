
# XIMPL-HIDDEN-PROD-V2-LIVE-QA — Hidden-Production v2 Report Live QA

UK English. Read-only audit only — no code changed, no flags flipped, no real takes submitted by the auditor. Evidence drawn from `app_config`, `takes`, and a static read of the Phase 3B persistence/renderer wiring.

---

## 1. Hidden-Production QA Readiness Check

| Item | Result |
|---|---|
| Live site hidden from users | Assumed yes (per brief) |
| Production deployment of Phase 3B code completed | Code-side yes (`buildV2Report`, `validateV2PublicBoundary`, `V2ReportView`, `readReportSchemaVersion` branch all present in `main`) |
| Mux webhook available in production | Yes (`/api/public/mux-webhook` route present and unchanged) |
| `future_report_enabled` initial value | **false** |
| `future_evidence_enabled` initial value | **false** |
| `future_qa_trace_enabled` initial value | **false** |
| `TWO_STEP_ANALYSIS_ENABLED` value | Unknown from DB; environment-controlled (no client exposure) |
| Historical v1 reports render before v2 flag flip | Yes — see §2 |
| No runtime errors on existing audition pages | No errors observed in current snapshot |
| v2 QA may proceed end-to-end | **No** — see blockers below |

Blockers preventing a complete live QA run in this audit:

1. `future_report_enabled = false` in `app_config`. No v2 report can be persisted until it is flipped server-side.
2. **Zero** `takes.report.schema_version = "v2-component"` rows exist. Total takes = 20; all are v1/null (13 complete, 7 error/transcoding).
3. No new MT, Acting, Song/Voice, Dance or Commercial real takes have been pushed through the live Mux webhook under v2. Sections 4–11 require submission events that only the operator can trigger.

Per protocol the readiness gate fails on items 1–3, so this report cannot return “QA passed”. It can only certify pre-flip safety and what must happen next.

---

## 2. Existing v1 Report Smoke Test (pre-flip baseline)

Sampled most-recent completed takes via `takes` query.

| Audition ID | Take ID | Schema version | Renderer path | Scores | Components | Timestamps | Comparison | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|---|
| b606bb7b…df66 | 65e11b95…f69d | null → `v1-legacy` | v1 (legacy `TakeView`) | yes | yes | yes | n/a (single take) | Pass | `casting_headline` populated; `score_breakdown` clean (sample inspected) |
| 18072552…13df | c7edea26…698c | null → `v1-legacy` | v1 | yes | yes | yes | multi-take audition (3 takes) — comparison page expected v1/v1 only | Pass | Mixed comparison untestable until a v2 take exists in same audition |
| 5d3c9734…71d3c | b3795c5a…a5f1 | null → `v1-legacy` | v1 | yes | yes | yes | multi-take | Pass | — |
| 27a49d98…3e425 | 68464e5c…2c1b | null → `v1-legacy` | v1 | yes | yes | yes | multi-take | Pass | — |

`readReportSchemaVersion()` returns `"v1-legacy"` for `schema_version` missing/null/unknown, so all 13 historical complete takes render through the v1 path with no behaviour change. Renderer-no-change tests (Phase 3A/3B updates) confirm this.

---

## 3. Flag State and v2 Enablement Summary

Current `app_config` (singleton):

```
quota_enabled              = true
future_evidence_enabled    = false
future_report_enabled      = false
future_qa_trace_enabled    = false
updated_at                 = 2026-05-01 12:42:49+00
```

Recommended sequence for the operator (not executed by auditor):

1. Confirm production build deployed.
2. `UPDATE app_config SET future_report_enabled = true WHERE id = 'singleton';`
3. Optional, for component-bearing v2: also set `future_evidence_enabled = true` and ensure `TWO_STEP_ANALYSIS_ENABLED=true` in the worker env.
4. Optional, for trace inspection: `future_qa_trace_enabled = true`.
5. Submit takes per §4.
6. Re-run sections 5–11 against the new rows.

No flag is wired to a client query parameter or response payload. `app_config` has no RLS SELECT policy for anon/auth users; reads occur only through `getResolvedConfig` server-side. No allowlist, no per-account, no per-audition gating exists in the code path.

---

## 4. Submitted Real Takes Register

| # | Required submission | Status | Take ID | Notes |
|---|---|---|---|---|
| 1 | MT brief-mode (acting + song) | **Not submitted** | — | Awaiting operator |
| 2 | Acting baseline, no brief | **Not submitted** | — | Awaiting operator |
| 3 | Song / Voice | Not submitted | — | Recommended |
| 4 | Dance | Not submitted | — | Recommended |
| 5 | Commercial | Not submitted | — | Recommended |
| 6 | Multi-take audition (≥2 v2 takes) | Not submitted | — | Required for v2/v2 and mixed comparison |

All later evidence-bearing sections (5, 7, 8, 9, 10, 11) depend on these submissions.

---

## 5. v2 JSON Verification

Cannot execute against live data: zero v2 rows exist. Static contract review of `buildV2Report` + `validateV2PublicBoundary` against the brief's forbidden-key list:

- `schema_version: "v2-component"` is hard-coded in `buildV2Report`.
- `scores` is filtered through `asScores` to the six canonical public keys only (`technical, audio, vocal, acting, brief_adherence, professional_presentation`).
- `validateV2PublicBoundary` enforces score round-trip from legacy `report.scores`; mismatches force fallback to v1.
- `overall_readiness` is required if legacy had any overall score.
- `role_fit` block is gated on `mode === "brief"`.
- `FORBIDDEN_KEYS` set covers every key in the brief's forbidden list (24 keys), including `supports`, `anchor_id`, `anchor_ids`, `legacy_scores`, `dimensions`. Any depth-anywhere occurrence triggers v1 fallback.
- The boundary scan is recursive (`findForbiddenKey` walks arrays and objects).
- `evidence_anchors`, `dimension_confidence`, `supports`, `anchor_id`, `anchor_ids`, `dimensions` are stripped at the v2 boundary even if a leaky legacy report were passed in (covered by `v2-report-boundary.test.ts`).

Verdict: contract-clean. Live verification still required after operator submits real takes.

| Take ID | Schema | Scores match prod? | Forbidden keys? | Role-fit safe? | Baseline safe? | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|
| (none) | — | — | — | — | — | **Pending** | No v2 rows in DB |

---

## 6. `score_breakdown` Privacy Verification

The audition route runs `select("*")` on `takes`, so `score_breakdown` is effectively client-visible. Reviewed the constructor at `src/server/process-take.server.ts:2707-2771` and a live sample row (`take 65e11b95…`).

Constructor produces only:
`audition_type, level, weights, thresholds, overall_score_model, overall_before_role_fit, role_fit_modifier, role_fit_modifier_explanation, role_fit_confidence, overall_score_final, verdict_final, block_reasons, extraction_confidence, score_discrepancy, compliance_flags, presentation_notes_count, safety_rewrite_applied, material_policy, material_scrub_triggered, two_step{enabled, evidence_version, *_duration_ms, timestamped_evidence_count, timestamped_evidence_dropped_count, fallback_used, polish_fallback_reason, locked_field_overwrite_count, unsupported_claims_removed_count, unsupported_claims_rewritten_count, evidence_sufficiency{*_assessable booleans}}`.

None of the forbidden private keys appear: no `future_shadow`, `shadow_*`, `qa_counters`, `scrub_counters`, `components_summary`, `dimensions_summary`, `future_components`, `future_dimensions`, `evidence_anchors`, `dimensions`, `internal_qa`, `take_qa_traces`, `raw_evidence`, `hidden_reasoning`. The two-step block contains only structural counters and durations — no prose, no quotes, no anchor IDs.

| Take ID | `score_breakdown` present | Forbidden keys | Public metadata intact | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 65e11b95…f69d | yes | none | yes | Pass | Live sample |
| Future v2 takes | — | — | — | Pending | Same constructor used; expected to remain clean |

Caveat: the v2 persistence path (lines 2782–2829) only swaps the SHAPE of `report`. It does not touch `score_breakdown`. The privacy posture above is therefore unchanged when v2 is flipped on.

---

## 7. v2 Renderer Verification

Static review of `src/routes/audition.$auditionId.tsx`:

- `readReportSchemaVersion(report)` is the sole branch.
- `"v2-component"` → `<V2ReportView />`.
- Anything else → existing v1 renderer.
- Checklist view is schema-agnostic (Phase 0 posture preserved; covered by `phase0-posture.test.ts`).

Live UI verification requires v2 rows. Cannot complete this section.

| Take ID | Renderer loaded | Core sections | Private leakage | Screenshot | Pass/Fail | Notes |
|---|---|---|---|---|---|---|
| (none) | — | — | — | — | **Pending** | No v2 rows |

---

## 8. Discipline Label Verification

Static review of `src/lib/discipline-labels.ts` against §8 expectations:

- MT: `acting → Acting / performance`, `vocal → Vocal performance`. ✓
- Monologue / acting_scene: `acting → Acting / performance`, `vocal → Speech delivery`. ✓ (no “singing” label)
- Song / voice: `vocal → Vocal performance`, `acting → Lyric & story communication`. ✓
- Dance: `vocal → Movement technique`, `acting → Performance & presence`. `shouldShowVocal('dance', …) = false` regardless of score, so the row is suppressed entirely. ✓
- Commercial: `vocal → Voice delivery`, `acting → Presence & naturalism`; vocal row only when a numeric score exists. ✓

Contract-clean. Live verification on real take outputs still required.

| Take ID | Audition type | Expected | Observed | Pass/Fail | Notes |
|---|---|---|---|---|---|
| (none) | — | — | — | **Pending** | — |

---

## 9. Output-Specificity Smoke Review

Cannot run. No v2 outputs exist to inspect for generic praise, weak acting-through-song anchoring, role-fit overclaim, frame-break coaching, etc. This section is the entry-point for Phase 3C and must be populated from real submissions.

| Take ID | Audition type | Patterns found | Severity | Blocks 3C? | Notes |
|---|---|---|---|---|---|
| (none) | — | — | — | — | **Pending** |

---

## 10. Comparison Safety Check

Comparison page renders against v1 today. v1/v1 multi-take auditions exist (e.g. `18072552…13df`, `5d3c9734…71d3c`, `27a49d98…3e425`) and load cleanly. v2/v2 and mixed cases require ≥1 v2 row in the same audition.

Phase 3B audit already noted the cosmetic `casting_headline` omission for v2 takes inside the comparison view; that is a Phase 3D item, not a safety bug, provided it does not produce raw `undefined` or `[object Object]` strings. To be confirmed live.

| Audition ID | Comparison type | Loaded | Scores correct | Private leakage | Cosmetic issues | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|
| 18072552…13df | v1/v1 | yes | yes | none | none | Pass | Pre-flip baseline |
| (any) | v2/v2 | — | — | — | — | **Pending** | — |
| (any) | v1/v2 mixed | — | — | — | — | **Pending** | Watch headline fallback |

---

## 11. QA Trace Verification

`future_qa_trace_enabled = false`. **QA trace verification not run; `future_qa_trace_enabled` was false.** Static checks only:

- `take_qa_traces` table has no RLS policies declared → PostgREST denies anon/auth automatically because RLS is enabled with no permissive policies. Service-role only.
- `writeQaTrace` payload is built from `toQaTracePayload(shadow)` and contains `schema_version, branch, components_summary, dimensions_summary, sufficiency, scrub_counters, shadow_divergence` — structural only, no prose, no quotes, no anchor IDs.

---

## 12. Rollback Verification

Not executed; flag was never flipped on during this audit, so there is nothing to roll back. Logical rollback path is intact:

- Setting `future_report_enabled = false` causes the v2 branch in `process-take.server.ts:2793` to be skipped; new takes persist as v1 again.
- Existing v2 rows continue to render via the v2 renderer because `readReportSchemaVersion` reads the persisted `schema_version` value.
- No schema migration required to roll back; the change is JSON-shape-only.

---

## 13. Artefact Register

| Artefact | Take/audition ID | Type | Captured | Used for decision | Notes |
|---|---|---|---|---|---|
| `app_config` snapshot (all `future_*` flags false) | n/a | flag state | yes | yes | Establishes pre-flip baseline |
| `takes` summary (20 total, 0 v2) | n/a | DB count | yes | yes | Confirms no v2 evidence exists |
| Sample v1 row `report` & `score_breakdown` | 65e11b95…f69d | JSON | yes | yes | Confirms `score_breakdown` is private-clean today |
| v1 renderer working baseline | various | inference | yes | yes | Pre-flip rendering unchanged |
| MT v2 report | — | JSON | **No** | — | Required before Phase 3C |
| Acting v2 report | — | JSON | **No** | — | Required before Phase 3C |
| Song/Voice v2 report | — | JSON | No | — | Recommended |
| Dance v2 report | — | JSON | No | — | Recommended |
| Commercial v2 report | — | JSON | No | — | Recommended |
| v2/v2 comparison screenshot | — | screenshot | No | — | Required for §10 closure |
| Mixed v1/v2 comparison screenshot | — | screenshot | No | — | Required for §10 closure |
| QA trace row | — | DB row | No | — | Only if `future_qa_trace_enabled` is set true |

---

## 14. Hidden-Production QA Decision

**XIMPL-HIDDEN-PROD-V2-LIVE-QA incomplete. Blocker remains.**

Rationale:
- Phase 3B code is in place and contract-correct (builder, validator, renderer branch, label map, score_breakdown constructor are all clean against the forbidden-key matrix).
- The pre-flip posture is safe: existing v1 reports render unchanged, `score_breakdown` exposes no private internals, `take_qa_traces` is RLS-locked, no client query param controls schema selection.
- However, the run **cannot certify v2 live behaviour** because:
  1. `future_report_enabled = false` server-side — no v2 row can be created.
  2. Zero v2 rows currently exist.
  3. No real Mux-path submissions have been performed under this run.

Blockers (operator action required):
- B1. Flip `future_report_enabled` to true in `app_config` server-side.
- B2. Submit at minimum one MT brief-mode take and one Acting baseline take through the live Mux webhook.
- B3. Re-run §§4–10 (and §11 if `future_qa_trace_enabled` is also flipped) against the new rows and capture the artefacts marked “Pending” above.

Caveats:
- Comparison-page `casting_headline` fallback for v2 rows is a known Phase 3D cosmetic item; confirm live that it does not render `undefined`/`null` strings.
- `TWO_STEP_ANALYSIS_ENABLED` is environment-driven and not visible from `app_config`. Operator should record its value at submission time alongside each take.

Recommendation on `future_report_enabled` state at end of this audit: **leave at `false`** until the operator is ready to perform §4 submissions in a single sitting; flipping it on without immediately submitting and inspecting takes only widens the verification window without producing evidence.

Phase 3C may begin only once: at least one real MT v2 report and at least one real Acting or Song/Voice v2 report have been generated and inspected, no private-key leakage exists in `takes.report` or `score_breakdown`, the v2 renderer renders cleanly, the v1 fallback renders cleanly, and production scoring remains unchanged. Those preconditions are **not yet met**.

