# Phase 1 Hardening + Phase 2 — Internal Shadow Scoring & QA Counters

## Privacy boundary decision (driving constraint)

`src/routes/audition.$auditionId.tsx` (line 84-85) does `from("takes").select("*")` and the local TS type at line 43 explicitly declares `score_breakdown?: any`. Ordinary authenticated owners therefore receive `score_breakdown` over PostgREST. Conclusion:

**`score_breakdown.future_shadow` will NOT be used in Phase 2.** Private shadow data is restricted to:
1. `take_qa_traces` (RLS deny-all confirmed; service-role only) under `future_qa_trace_enabled === true`, and
2. server-only in-memory values discarded after a structural log line.

`takes.report` and `takes.score_breakdown` remain free of any shadow / dimension / QA keys.

## Scope

This plan covers (A) the Phase 1 closure follow-up, (B) the privacy boundary audit, (C) per-discipline shadow rules, (D) the in-memory shadow-score derivation, (E) QA counters, and (F) flag-gated `take_qa_traces` writes. No public score, verdict, prose, UI, comparison page, or DB schema change.

## A. Phase 1 hardening follow-up

1. Extend `src/server/__tests__/report-public-boundary.test.ts` `FORBIDDEN_KEYS` to add: `future_components`, `evidence_anchors`, `component_dimensions`, `dimension_confidence`, `future_dimension_validation`, `dimensions`. Keep all existing 16.
2. New `src/server/__tests__/client-payload-boundary.test.ts` — sweeps a representative client-shaped take payload (the exact field list from `audition.$auditionId.tsx` `select("*")`) for the same forbidden keys plus `score_breakdown.future_shadow`, `score_breakdown.shadow_*`, `score_breakdown.qa_*`, `score_breakdown.dimensions*`, `score_breakdown.components_summary`.
3. New `src/server/__tests__/dimensions/flag-on-isolation.test.ts` — fixture-based: feed a valid `futureDimensions` block through the public-report build path (`buildEvidenceBlock` source check + a small constructed `report` JSON) and assert no forbidden key leaks, `report.scores` unchanged, no `take_qa_traces` write happens unless `future_qa_trace_enabled` is true. Documented gap: real Step 2 model call cannot be exercised in unit harness.

## B. Privacy / persistence boundary audit (output)

| Candidate location | Client-visible? | Safe for shadow? | Decision |
|---|---|---|---|
| `takes.report` | yes (rendered) | no | NEVER write shadow/QA |
| `takes.score_breakdown` | yes (`select("*")` in `audition.$auditionId.tsx`) | no | NOT used in Phase 2 |
| `take_qa_traces` | no (RLS deny-all, no policies; service-role only) | yes | Structural counts only, gated by `future_qa_trace_enabled` |
| Server logs | server-only | yes | One structural log line per take |
| In-memory | yes | yes | Default storage when QA flag off |

## C. Discipline rule modules (`src/server/disciplines/`)

New server-only files:
- `shared.ts` — `LegacyScoreField`, `ShadowScores` (one per legacy field), `DimensionDensity`, helpers to map dimension confidences/anchor counts into a 0–100 estimate, plus `clamp01_100`.
- `mt.ts`, `dance.ts`, `acting.ts`, `voice.ts`, `commercial.ts` — each exports `deriveShadow(input) -> { shadowScores, density, warnings }` and a list of discipline-specific QA-counter probes.
- `index.ts` — branch dispatcher keyed off `audition_type` / `detected_components`. Voice and song are routed together; monologue and acting share the acting derivation; slate is excluded.

Discipline mapping rules (research-led):
- **MT**: acting-through-song / lyric_intention / phrase_action density → shadow `acting`; vocal_technique_serves_story / pitch_rhythm / tone → shadow `vocal`; integration / scene_to_song_transition → small modifier on shadow `acting`. Counters: weak `acting_through_song`, generic vocal praise, MT acting density low.
- **Dance**: technique_control / alignment / coordination / line_shape → shadow `acting` (movement performance proxy, never published as Vocal); rhythm_timing / musicality → modifier; visibility flags → density only. Counters: vocal-language leakage, cropped-frame, generic movement praise, adaptation deficit risk.
- **Acting**: objective_action / listening_response / beat_shift / stakes → shadow `acting`; speech_delivery → shadow `acting` (NEVER vocal); reader / camera / eyeline → modifier; no_brief_restraint flagged when brief absent. Counters: generic praise, no-brief invention, speech-as-vocal, response-to-direction overclaim.
- **Voice**: pitch_rhythm / breath / tone / register → shadow `vocal`; lyric_intention / communication / acting_through_song → modifier on shadow `acting`; accompaniment_balance → shadow `audio` modifier (never reward paid resource). Counters: technique-only praise, lyric weak, vocal-health diagnosis, resource merit drift.
- **Commercial**: copy_handling / tone_calibration / camera_addressee → shadow `acting`; product_brand_situation_grounding only when brief supplied → modifier on `brief_adherence`. Counters: marketability/look, no-brief invention, theatre-acting leakage, generic "natural/confident".

Each discipline module is pure: dimensions in, structural object out. Never returns prose, never references public report fields outside the legacy 6.

## D. Shadow scoring (in-memory, server-only)

New `src/server/shadow-scoring.server.ts`:

```ts
export interface FutureShadowResult {
  shadow_schema_version: "shadow-v1";
  branch: string;
  components_summary: Array<{ type: string; confidence: string; assessable: boolean }>;
  dimensions_summary: Record<string, { populated: number; null_or_unknown: number }>;
  shadow_scores: Partial<Record<LegacyScoreField, number>>;
  shadow_divergence: Partial<Record<LegacyScoreField, number>>; // shadow - legacy
  evidence_density: Record<string, "low" | "medium" | "high">;
  sufficiency: { ... mirror of evidence_sufficiency ... };
  qa_counters: Record<string, number>;
  warnings: string[];
}

export function computeFutureShadow(args: {
  futureDimensions: FutureDimensionsResult;
  evidence: EvidencePass;
  auditionType: string;
  durationSeconds: number | null;
  mode: "brief" | "baseline";
}): FutureShadowResult;
```

Called once in `process-take.server.ts` immediately after the existing `future_dimensions_captured` log and only when `cfg.future_evidence_enabled === true` AND `evResult.futureDimensions` is present. The result is:
- always logged as a single structural line (`[take-pipeline] shadow_scoring_completed`),
- written to `take_qa_traces` (service-role insert/upsert) only when `cfg.future_qa_trace_enabled === true`,
- never returned from any server function, never put on `report` or `score_breakdown`.

The write maps `FutureShadowResult` into the existing `take_qa_traces` columns (`schema_version`, `branch`, `components_summary`, `dimensions_summary`, `sufficiency`, `scrub_counters`, `shadow_divergence`). `qa_counters` maps to `scrub_counters`. No new migration needed — the table already exists.

## E. QA counters

A single counter registry in `src/server/disciplines/shared.ts` covers all the names listed in the brief: `generic_praise_hits`, `timestamp_underproduction`, `timestamp_component_imbalance`, `no_brief_invention`, `role_fit_overclaim`, `castability_overclaim`, `marketability_or_look_hit`, `live_room_overclaim`, `frame_break_coaching`, `presentation_polish_drift`, `access_deficit_risk`, `speech_accent_voice_deficit_risk`, `vocal_health_diagnosis_risk`, `resource_merit_drift`, `field_label_leakage_risk`, `dimension_density_low`, `malformed_dimension_drop_count`. Counters are pure functions over `EvidencePass` + `FutureDimensionsResult`. They never block, never edit report, never appear publicly.

## F. No admin UI

Phase 2 ships zero UI. Reads against `take_qa_traces` remain service-role server-only. No `?qa=` toggle, no dashboard.

## Tests (`src/server/__tests__/`)

1. `report-public-boundary.test.ts` — extended forbidden-key list (drop-in update).
2. `client-payload-boundary.test.ts` (new) — full take row shape, no forbidden key under any depth, including nested `score_breakdown`.
3. `dimensions/flag-on-isolation.test.ts` (new) — flag on, dims captured, no leak.
4. `disciplines/{mt,dance,acting,voice,commercial}.test.ts` (new) — mapping shape, malformed tolerance, missing-anchor density behaviour.
5. `shadow-scoring.test.ts` (new) — divergence math, public scores untouched (no mutation of input `EvidencePass.raw_scores`), warnings emitted, schema fields present, no forbidden keys.
6. `qa-counters.test.ts` (new) — exercises the Phase 0 failure fixtures (clean-control → zero criticals; generic praise → `generic_praise_hits ≥ 1`; timestamp underproduction → `timestamp_underproduction ≥ 1`; weak acting-through-song → MT density counter; broad vocal praise → vocal counter; role-fit overclaim → `role_fit_overclaim`; presentation drift → `presentation_polish_drift`; frame-break → `frame_break_coaching`).
7. `qa-trace-persistence.test.ts` (new) — with QA flag off, no insert occurs (mock supabaseAdmin); with QA flag on, payload contains only structural keys (assert no `prose|quote|note|why_it_matters|observation|evidence` text fields, no `*_evidence` keys).
8. Phase 0 + Phase 1 suites continue to pass unchanged.

## Files to add / change

**New (server-only):**
- `src/server/disciplines/{shared,mt,dance,acting,voice,commercial,index}.ts`
- `src/server/shadow-scoring.server.ts`
- `src/server/qa-trace.server.ts` (thin write helper, gated)
- 6 new test files under `src/server/__tests__/`

**Edited:**
- `src/server/process-take.server.ts` — after the existing `future_dimensions_captured` log block, call `computeFutureShadow(...)`, log structural counts, and conditionally call `qa-trace.writeTrace(...)`. Wrapped in try/catch — never disrupts the user-facing pipeline.
- `src/server/__tests__/report-public-boundary.test.ts` — extend `FORBIDDEN_KEYS`.

**Untouched (must remain so):**
- `src/server/report-polish.server.ts`
- `src/server/report-quality.server.ts`
- `src/lib/audition-rules.ts`
- `src/lib/report-schema.ts`
- `src/routes/audition.$auditionId.tsx`
- `src/components/checklist-view.tsx`
- All migrations
- All Mux/upload paths

## Hard limits

No Phase 3, no v2 schema/UI, no public label change, no admin dashboard, no comparison-page edit, no scoring or verdict change, no migration in this phase, no new runtime dependency, no Zod, no client read of `take_qa_traces`.

## Verification

`bunx vitest run --dir src` — expect existing 41 tests + roughly 25 new ones, all green.

## Exit

“Phase 2 complete. Ready for Phase 2 closure audit before Phase 3A dark-launch planning.”
