# TapeCoach Future-State — Revised Implementation Plan (v2)

This revision incorporates the 12 amendments. The directional architecture is unchanged: keep the legacy readiness shell + six public scores, layer a component/dimension evidence model beneath it, and only flip user-facing rendering when explicit gates pass.

The core safety stance is now stricter: **public report JSON never carries shadow scores or internal QA data**, and **dimension-derived scores never reach users without a separate score-publication gate**.

---

## Cross-cutting rules (apply to every phase)

- **R1 — Public/private boundary**: `takes.report` is user-facing. Shadow scores, divergence diffs, QA counters, scrub hits and dimension-derivation traces live in `takes.score_breakdown.future_shadow` (per-take internal data) or `take_qa_traces` (admin-only). Never in `report`.
- **R2 — Single schema field**: `report.schema_version` is the only versioning field. Values: `"v1-legacy"` | `"v2-component"`. Missing/null ⇒ treat as `"v1-legacy"` at read time.
- **R3 — Score-publication boundary**: dimension-derived scores are shadow-only across every phase below. Public scores, verdicts and the overall readiness number continue to come from the existing production scoring logic until a separate, explicitly-approved "score publication" gate (out of scope for this plan) flips them.
- **R4 — Server-side role gating**: any admin surface (e.g. `?admin=1`, `/dashboard?qa=1`) authorises via `has_role` server-side. Query params only request the mode; they never grant it. Client never receives shadow/QA data unless the server confirms the role.
- **R5 — Legacy renders as legacy**: v1 reports always render with v1 labels and layout. v2 discipline labels (e.g. Dance public categories, MT acting-through-song) only apply when the report itself carries v2 component/dimension evidence.
- **R6 — Forward-only**: no rewrites of historical reports. The renderer branches on `schema_version`.

---

## Phase 0 — Foundations (no behaviour change) — START HERE

Goal: make the codebase safe to extend; persist nothing user-visible.

1. **Schema versioning**
  - `process-take.server.ts` stamps every new report with `report.schema_version = "v1-legacy"`.
  - `audition.$auditionId.tsx` and `checklist-view.tsx` read `schema_version`; missing/`v1-legacy` ⇒ existing renderer (R2, R5).
2. **Server-only feature flags** in `app_config` (singleton, RLS deny-all):
  - `future_evidence_enabled` — Phase 1 dimension capture.
  - `future_report_enabled` — Phase 3 v2 schema + UI.
  - `future_qa_trace_enabled` — gates writes to `take_qa_traces`.
  - Read only via `app-config.server.ts`. Never expose to client.
3. `**take_qa_traces` table created now** (amendment #2 — pulled forward):
  ```text
   take_qa_traces (
     take_id uuid pk references takes(id) on delete cascade,
     schema_version text,
     branch text,
     components_summary jsonb,        -- counts/types only, no quotes
     dimensions_summary jsonb,        -- per-dimension anchor counts
     sufficiency jsonb,               -- density/visibility/audio_balance
     scrub_counters jsonb,            -- specificity/live-room/marketability hits
     shadow_divergence jsonb,         -- populated from Phase 2 onward
     created_at timestamptz default now()
   )
  ```
  - RLS deny-all to anon/auth; admin reads via `has_role('admin')` server-side only.
  - Writes gated by `future_qa_trace_enabled`. No raw Step 1 prose, no PII, no quotes — only structural counts and flags.
4. **Test harness — two fixture suites** (amendment #6):
  - **Legacy preservation fixtures** under `src/server/__tests__/fixtures/legacy/` — current MT, Acting, Dance, Voice, Commercial production artefacts. Snapshot tests pin the existing public report shape exactly.
  - **Future-state failure fixtures** under `src/server/__tests__/fixtures/failures/` — staged/synthetic takes that reproduce known current MT failures, designed so later phases can assert detection without changing current output:
    - generic praise ("strong vocals", "lovely energy")
    - weak acting-through-song anchoring (no lyric-intention anchors)
    - broad vocal praise without timestamped technical evidence
    - timestamp underproduction (MT 3–5 min with <5 timestamps)
    - castability / role-fit overclaim ("highly castable", "would get a recall")
    - presentation/polish drift (appearance, marketability, "commercial look")
    - frame-breaking coaching (walking / props / instrument advice for fixed-frame briefs)
  - In Phase 0 these fixtures only assert *current* behaviour; later phases assert detection/scrub.

Exit criteria: snapshots green; flags exist and default false; `take_qa_traces` exists with RLS; no user-visible change.

---

## Phase 1 — Evidence dimensions in Step 1 (internal only)

Goal: capture discipline-specific evidence; no scoring or UI change.

1. **Extend `evidence-pass.server.ts**` (under `future_evidence_enabled`) to add `components[].dimensions` + `evidence_anchors[]` per design doc §7. Existing six `scores` and `report` shape unchanged.
2. `**src/server/dimensions/**` — one file per component (`mt.ts`, `dance.ts`, `acting.ts`, `voice.ts`, `commercial.ts`, `monologue.ts`, `song.ts`, `slate.ts`): Zod schema, prompt fragment, "no claim without anchor" validator.
3. **Sufficiency extensions**: `evidence_density`, `visibility` (dance), `audio_balance` (voice/MT) — internal only.
4. **Backwards-compat assertion**: legacy snapshot suite from Phase 0 must remain byte-identical with the flag on.

Exit: dimensions populate on real takes; legacy snapshots unchanged.

---

## Phase 2 — Discipline rules + shadow scoring (internal only)

Goal: derive scores from dimensions, run shadow, persist QA-safe data.

1. `**src/server/disciplines/**` per branch: public-category mapping (§10), aggregation rules from dimensions to the legacy six fields, role-fit guardrails extending `report-polish.server.ts` / `report-quality.server.ts`.
2. **Shadow scoring in `process-take.server.ts**`: when `future_evidence_enabled` is on, compute dimension-derived scores **but never write them to `report**` (R1, R3). Persist to:
  - `takes.score_breakdown.future_shadow` (per-take internal), and
  - `take_qa_traces.shadow_divergence` (admin aggregate) when `future_qa_trace_enabled` is on.
3. **Specificity / density / live-room / marketability counters** land in `take_qa_traces.scrub_counters`. Counters flag, never block.
4. **Castability / role-fit overclaim validator** (amendment #9): a shared scrubber checks for "highly castable", "bookable", "strong contender", "perfect fit", "exactly what they're looking for", "commercial look", "marketable", "would get a recall", "callback-ready" and similar. Suppress or rewrite to evidence-based readiness language unless brief mode + supporting evidence explicitly permits. Hits increment `scrub_counters.role_fit_overclaim`.
5. **Fixed-frame / fixed-material coaching QA** (amendment #10): when the brief requires close-up / head-and-shoulders / static framing, the polish step rejects recorded-take advice that suggests walking, moving around the room, using props, holding instruments or breaking frame. Such suggestions are allowed only as rehearsal-only notes paired with a recorded-take-safe alternative. Hits increment `scrub_counters.frame_break`.
6. **Admin diff view**: gated server-side by `has_role('admin')` (R4). `?admin=1` only requests the mode.

Exit: shadow scores produced for **≥20 real takes per branch where real outputs exist; synthetic/staged fixtures for branches without real outputs** (amendment #5 — Dance, Voice/Singing, Commercial). QA counters populated. Public output unchanged.

---

## Phase 3 — Future-state report + display (staged rollout)

Split per amendment #7. Each sub-phase is independently flag-gated and reversible.

### 3A — v2 JSON generation, dark launch only

- `process-take.server.ts` writes `schema_version: "v2-component"` when `future_report_enabled` is on.
- v2 report contains: `overall_readiness`, `components[]`, `public_categories[]`, `headline`, `verdict`, `reliability`, `strengths`, `improvements`, `fix_first`, `timestamped_notes`, `next_take_plan`, `risk_flags`, `role_fit` (brief mode only), `presentation_notes`.
- **Backwards-compat scores** (amendment #4): v2 reports continue to emit `report.scores` (the existing six fields, populated by **production logic**, not dimension-derived — R3). `report.legacy_scores` is **not** introduced; `report.scores` remains the single canonical public score field across v1 and v2. Documented in `src/server/process-take.server.ts` header comment.
- No UI change yet — renderer still uses v1 path because 3B not enabled.

### 3B — Admin/staging single-report rendering

- New `src/components/report/*` (`ComponentBreakdown`, `CategoryBreakdown`, `EvidenceAnchors`, `TimestampedNotes`, `ReliabilityBadge`, `RoleFit`, `RiskFlags`, `PresentationNotes`).
- `src/lib/discipline-labels.ts` — single source of truth for branch-specific public labels (Dance never shows "Vocal"; MT shows Acting / Vocal / Acting Through Song / Integration; etc.).
- v2 layout rendered only when `schema_version === "v2-component"` **and** server confirms admin/staging audience (R4, R5).

### 3C — Selected-account v2 report rollout

- Account-level allowlist on the server controls which users see v2 rendering for their v2 reports. Legacy users with v2 reports still get v1 rendering of legacy fields.

### 3D — v2 comparison page

- Comparison rebuilt to derive rows from each report's own `public_categories`. Mixed v1/v2 comparisons fall back to legacy rendering for the v1 side.

### 3E — General rollout

- Flag flipped for all users only after release gates (Phase 4) pass on real + synthetic suites.

Throughout 3A–3E: no-brief restraint, role-fit overclaim scrubber, and frame-break QA from Phase 2 are re-asserted in the renderer (defensive — forbidden phrases are suppressed and increment QA counters).

Exit: v2 reports render for general users; legacy reports unchanged; QA gates green.

---

## Phase 4 — QA traceability + release gates

1. `**take_qa_traces` already exists** (Phase 0). Phase 4 adds the **admin QA page** at `/dashboard?qa=1`, server-role-gated via `has_role` (R4): per-branch counters, shadow divergence, role-fit overclaim hits, frame-break hits, generic-praise hits, timestamp underproduction.
2. **Release gates** wired to the test harness:
  - Legacy preservation snapshots green.
  - Future-state failure fixtures: each known failure mode is detected (counters > 0 on the failing fixture, 0 on the clean fixture).
  - MT v5 retest green on real outputs.
  - Dance / Voice / Commercial: synthetic + staged fixtures green; real-output gates added once real outputs exist.
  - role_fit_overclaim, frame_break, marketability and live-room counters = 0 on the gate fixture set.

---

## Migration & risk

- **Forward-only**, **flag-gated**, **rollback = flip flag**.
- **R1/R3 enforced by code review + a unit test** that asserts `report` JSON contains no `shadow_*`, no `*_divergence`, no `qa_counters` keys.
- **Privacy**: `take_qa_traces` stores structural counts only — no quotes, no Step 1 prose, no hidden reasoning, no PII.
- **Out of scope**: changing caps/blockers/verdict math, billing/quotas, Mux pipeline, auth, brand copy, **and any flip of public scores to dimension-derived values** (separate gate).

---

## Deliverables checklist

Phase 0 (start now):

- `report.schema_version` written + read with `v1-legacy` fallback
- Three feature flags in `app_config`, server-only readers
- `take_qa_traces` table + RLS + admin-only read path
- Legacy preservation fixture suite
- Future-state failure fixture suite (7 known MT failure modes)
- No user-visible change (verified by snapshot suite)

Later phases: dimensions module, disciplines module, shadow scoring into `score_breakdown.future_shadow` / `take_qa_traces`, role-fit overclaim scrubber, frame-break QA scrubber, v2 schema (with `report.scores` preserved), staged 3A–3E rollout, admin QA page, release gates.

---

## Immediate next action

Begin Phase 0 only. Specifically:

1. Migration: add `take_qa_traces` with RLS deny-all + admin-read helper using existing `has_role` pattern.
2. Code: legacy + failure fixture scaffolding under `src/server/__tests__/fixtures/`. (Schema-version stamping and the three feature flags are already in place from the prior Phase 0 increment.)
3. No edits to `process-take.server.ts` output shape, no UI changes.

I will stop after Phase 0 and wait for review before Phase 1.