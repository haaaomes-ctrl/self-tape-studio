# TapeCoach Future-State — Implementation Plan

This plan turns the future-state design into a phased, low-risk refactor on top of the current pipeline (Step 1 evidence pass → process-take → report polish/quality → audition report UI). It adopts **Option D (Hybrid)**: keep the overall readiness score and the existing six public score fields as a legacy-compatible shell, and add a new component/dimension evidence layer beneath it that drives discipline-aware reports, labels, and QA.

The work is structured so that **nothing user-facing changes until Phase 3**, and historical reports remain readable forever via a `report_schema_version` flag.

---

## Phase 0 — Foundations (no behaviour change)

Goal: make the current code safe to extend without touching live outputs.

1. **Schema versioning**
   - Add `report.schema_version` (string) to the report JSON written by `process-take.server.ts`. Backfill reads default to `"v1-legacy"`. New writes start as `"v1-legacy"` until Phase 3 flips them to `"v2-component"`.
   - UI in `audition.$auditionId.tsx` and `checklist-view.tsx` reads `schema_version` and falls back to current rendering when absent or `v1-legacy`.

2. **Feature flags** in `app_config` (singleton row, already present):
   - `future_evidence_enabled` (bool, default false) — Phase 1 evidence dimensions.
   - `future_report_enabled` (bool, default false) — Phase 3 report shape + labels.
   - `future_qa_trace_enabled` (bool, default false) — Phase 4 QA persistence.
   - Wire flags through `app-config.server.ts`; never read flags on the client.

3. **QA-safe trace table** (created in Phase 4, designed now):
   - `take_qa_traces (take_id, schema_version, components_summary jsonb, dimensions_summary jsonb, sufficiency jsonb, scrub_counters jsonb, created_at)` — admin-only read, no raw evidence.

4. **Test harness**
   - Add `src/server/__tests__/` snapshot tests for current MT, Acting, Dance, Voice, Commercial example payloads (use the production artefacts referenced in the design doc). These become the **regression baseline** for every later phase.

Exit criteria: snapshots pass; flags exist; nothing in the live UI changes.

---

## Phase 1 — Evidence dimensions in Step 1 (internal only)

Goal: capture the discipline-specific evidence the future state needs, without changing scores, prose, or UI.

1. **Extend Step 1 output** in `evidence-pass.server.ts` to add an internal `dimensions` block per detected component:

   ```text
   components: [{
     type, start, end, confidence, assessability,
     subtype, style, form,
     dimensions: { <discipline-specific keys with anchors> },
     evidence_anchors: [{ kind, ts, quote_or_note }]
   }]
   ```

   Dimension keys per component follow §7 of the design doc (acting / monologue / song / MT / dance / commercial / slate).

2. **Dimension contracts** in a new `src/server/dimensions/` module — one file per component (`mt.ts`, `dance.ts`, `acting.ts`, `voice.ts`, `commercial.ts`) exporting:
   - the Zod schema for that component's dimensions,
   - the prompt fragment Step 1 uses to elicit them,
   - the validator that enforces "no claim without an anchor".

3. **Backwards compatibility**: the existing six `scores` fields and `report` shape are still produced exactly as today. The new `dimensions` block is additive and gated by `future_evidence_enabled`.

4. **Assessability + sufficiency** are extended with: `evidence_density` (count of anchored dimensions / expected for component+duration), `visibility` (for dance), `audio_balance` (for voice/MT).

Exit criteria: with the flag on, Step 1 returns a populated `dimensions` block on real takes; snapshot tests for the public report still match Phase 0 baselines exactly.

---

## Phase 2 — Discipline rules + scoring derivation (internal only)

Goal: derive an internal **dimension-driven** version of the six public scores, run it in shadow mode against the current scoring, and prove parity/explain divergences.

1. **Discipline rule files** under `src/server/disciplines/` (one per branch). Each exports:
   - the public-category mapping (the labels in §10),
   - the rules that aggregate component dimensions into the legacy six fields (so MT `vocal` is composed from sung-vocal + acting-through-song; Dance `vocal` is composed from dance technique only and is **never surfaced as "Vocal" at the display layer**),
   - the role-fit guardrails (no appearance / marketability / live-room) — extending the existing scrubs in `report-polish.server.ts` and `report-quality.server.ts` rather than replacing them.

2. **Shadow scoring** in `process-take.server.ts`: when `future_evidence_enabled` is on, compute both the legacy scores and the dimension-derived scores, persist the dimension-derived ones into `report.shadow_scores`, but **publish the legacy scores**. Add an admin diff view (simple JSON dump on the audition page when an `?admin=1` query is set, gated server-side by role check — re-use `has_role` pattern from the user-roles guidance).

3. **Specificity/density enforcement** (still internal): extend `report-quality.server.ts` to flag — not block — generic praise, missing timestamp density (MT 5–8 for 3–5 min), no-brief invention, and live-room overclaim. Counters land in `report.qa_counters` for Phase 4.

Exit criteria: shadow scores produced for ≥20 real takes per branch; divergence categorised; QA counters populated; public output unchanged.

---

## Phase 3 — Future-state report + display (user-facing)

Goal: flip new reports to the v2 schema with discipline-aware labels, components-first layout, and evidence anchors. Old reports stay on v1 rendering.

1. **Report schema v2** written by `process-take.server.ts` when `future_report_enabled` is on:
   - `schema_version: "v2-component"`,
   - `overall_readiness` (single score, replaces the user-facing aggregate role of the six fields),
   - `components[]` with timing, subtype, dimension scores and anchors,
   - `public_categories[]` derived per branch (labels from §10),
   - `headline`, `verdict`, `reliability {level, reasons[]}`, `strengths[]`, `improvements[]`, `fix_first`, `timestamped_notes[]`, `next_take_plan`, `risk_flags[]`, `role_fit` (brief mode only), `presentation_notes`,
   - legacy six fields are **still emitted** under `report.legacy_scores` for any downstream that reads them.

2. **UI refactor** in `src/routes/audition.$auditionId.tsx`:
   - Split the monolithic page into smaller components in `src/components/report/` (`ComponentBreakdown`, `CategoryBreakdown`, `EvidenceAnchors`, `TimestampedNotes`, `ReliabilityBadge`, `RoleFit`, `RiskFlags`, `PresentationNotes`, `ComparisonRow`).
   - Component routing: if `schema_version === "v2-component"` → render new components-first layout with branch-specific labels; else render existing layout. No retrofit on legacy data.
   - Comparison view rebuilt to derive rows from the report's own `public_categories`, not a fixed list. Multi-take comparisons across schema versions render in legacy mode.

3. **Branch label tables** centralised in `src/lib/discipline-labels.ts` — single source of truth for what users see per branch (Dance never shows "Vocal"; MT shows Acting / Vocal / Acting Through Song / Integration; Commercial shows Copy & Tone, Camera / Addressee, etc.).

4. **No-brief restraint + role-fit safety** enforced in the polish step and re-asserted in the renderer (defensive — if a forbidden phrase reaches the UI, it is suppressed and a QA counter increments).

Exit criteria: new takes render in v2; legacy takes render unchanged; per-branch live QA passes the v5 specificity bar referenced in the design doc (MT regression suite green, Dance/Voice/Commercial synthetic suites green).

---

## Phase 4 — QA traceability + release gates

1. **Persist QA-safe traces** (`take_qa_traces` table from Phase 0) on every v2 report write: component summary, dimension counts with anchor counts, sufficiency flags, scrub/validation counters, schema version. Never persist raw Step 1 prose or hidden reasoning.

2. **Admin QA page** at `/dashboard?qa=1` (role-gated server-side via `has_role`): per-branch counters, divergence between legacy and dimension-derived scores, generic-praise hits, timestamp underproduction, live-room/marketability blocks.

3. **Release gates** wired into the test harness from Phase 0:
   - MT v5 retest must pass.
   - Dance/Voice/Commercial synthetic suites must pass.
   - Generic-praise / live-room / marketability counters must be zero on the gate fixture set.

---

## Migration & risk

- **Forward-only**: no rewrites of historical reports. `schema_version` selects renderer.
- **Feature-flagged rollout**: every phase is dark-launchable. Rollback = flip the flag.
- **Score continuity**: legacy six fields keep being written through Phase 3; comparison across old/new takes uses the legacy fields when either side is v1.
- **Privacy**: raw Step 1 evidence stays unpersisted; only QA-safe summaries land in `take_qa_traces`.
- **Out of scope for this plan**: changing caps/blockers/verdict math, brand or marketing copy, billing/quotas, the Mux pipeline, auth.

---

## Deliverables checklist

- [ ] `report.schema_version` everywhere (Phase 0)
- [ ] Three feature flags in `app_config` + server-only readers (Phase 0)
- [ ] Snapshot regression suite for current outputs (Phase 0)
- [ ] `src/server/dimensions/*` per component with Zod + anchors (Phase 1)
- [ ] Step 1 emits `components[].dimensions` under flag (Phase 1)
- [ ] `src/server/disciplines/*` rules + shadow scoring + admin diff (Phase 2)
- [ ] Specificity / density / live-room / marketability counters (Phase 2)
- [ ] v2 report schema writer + legacy_scores carry-through (Phase 3)
- [ ] `src/components/report/*` + `src/lib/discipline-labels.ts` (Phase 3)
- [ ] Comparison view derived from report categories (Phase 3)
- [ ] `take_qa_traces` table + admin QA page (Phase 4)
- [ ] Release gates in CI test harness (Phase 4)
