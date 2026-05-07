## XIMPL-PHASE-3C-P1-COMPLETE-V2-OUTPUT-DEPTH-PROMPT-SCHEMA — Plan

Completes the deferred Phase 3C P0 work: removes upstream prompt/schema caps, adds v2 `priority_fixes`, category rationales, richer component breakdowns, exhaustive action plan, duration-scaled timestamps, discipline-specialist depth, and professional calibration. Preserves all P0 changes (Dance cleanup, soft-risk demotion, Comparison rename, new-take navigation), all scoring, weights, blockers, role-fit bounds, Mux flow, public/private boundary and v1 historical rendering.

### 1. Cap removal (upstream + downstream, v2-safe)

**`src/server/process-take.server.ts` — REPORT_TOOL schema (lines ~160–278)**
- `strengths.maxItems`: 3 → 12 (`minItems: 1`).
- `improvements.maxItems`: 3 → 15.
- `coaching_drills.maxItems`: 5 → 15.
- `presentation_notes.maxItems`: 3 → 6.
- `timestamped_notes`: add `maxItems: 36`.
- Add OPTIONAL public-safe fields:
  - `priority_fixes: { type: array, items: { type: object, properties: { headline, rationale, kind ∈ ["urgent","quick_win","critical_gap","assessability_blocker","low_effort_high_impact"] }, required: ["headline"] }, maxItems: 8 }`.
  - `category_rationale: { type: object, properties: { technical, audio, vocal, acting, brief_adherence, professional_presentation : { type: object, properties: { what_works, why_not_full_score, close_gap, standout_delta }, required: ["why_not_full_score","close_gap"] } } }`.
  - `next_take_plan: { type: object, properties: { steps: { type: array, items: string, maxItems: 15 }, groups: { type: array, items: { type: object, properties: { label ∈ ["retake_critical","quick_wins","craft_refinements","rehearsal_drills","recording_setup"], items: { array of string, maxItems: 10 } } }, maxItems: 6 } } }`.
- None of the new fields are added to `required`. v1 fallback unchanged.

**`buildSystemPrompt()` (lines ~280–408)** — replace WRITING RULES block:
- `strengths`: 3–8 specific items (technical max 12). No padding.
- `improvements`: 3–10 ordered most-impactful first (technical max 15).
- `coaching_drills` / next-step items: 4–10 (max 15).
- `priority_fixes`: 2–5 prioritised fixes per the kind enum; do not duplicate improvements verbatim unless that is the clearest formulation.
- `category_rationale`: REQUIRED for every category whose score < 100. Must explain `what_works`, `why_not_full_score`, `close_gap`. For scores ≥ 90 also write `standout_delta`. Discipline-specific language; never generic praise.
- `timestamped_notes`: duration-scaled (<60s → 3–5; 1–3m → 6–10; 3–5m → 8–14; 5–10m → 12–24; 10m+ → 18–36). Never invent. Chronological.
- Professional calibration block: 90–100 must be differentiated; 95 must produce as much feedback as 75; reserve 98–100 for near-flawless tape-level evidence; high-score categories must always include marginal `standout_delta`.
- Discipline depth fragments (concise, in main system prompt):
  - Dance: cite movement evidence (rhythm/timing, control, spatial pathway, dynamics, intention); never invent style/subtype confidence; never claim foot/leg cropping without timestamped observation; never use unanchored "high-energy", "clean lines"; no MT-role/employer language.
  - MT: preserve Acting Scene + Song; cite acting-through-song with lyric/phrase/beat; vocal feedback distinguishes technique from story/style; no castability/recall/workshop/live-room overclaim; for fixed-frame briefs, recorded-take advice must preserve the frame (rehearsal-only items prefixed and paired with frame-safe alternative).

**`src/server/report-polish.server.ts`** — `POLISH_SYSTEM_PROMPT` (line 35):
- Replace "strengths ≤3, improvements ≤3, presentation_notes ≤3, timestamped_notes ≤8" with the v2 soft targets / technical maxima above. Add lines mirroring the discipline + calibration + rationale guidance so Step 2 can produce the new fields from locked Step 1 evidence. Keep "use only locked evidence" discipline.

**`src/server/evidence-pass.server.ts`** — EVIDENCE_TOOL (lines 99, 113, 169, 192, 223) + EVIDENCE_SYSTEM_PROMPT (lines 276–285):
- `core_strengths_evidence.maxItems`: 5 → 12.
- `core_improvements_evidence.maxItems`: 5 → 15.
- `presentation_evidence.maxItems`: 6 → 8.
- `risk_evidence.maxItems`: 8 → 10.
- `timestamped_evidence.maxItems`: 8 → 36, description rewritten with the duration-scaled bands (matches new prompt) and explicit Dance/MT coverage targets (rhythm/timing, control, spatial, dynamics, performance, ≥1 improvement; acting scene, song, transition, acting-through-song, ≥1 improvement).
- Prompt re-written to match (remove "Maximum 8" and "absolute maximum: 8").
- Validation: existing `.slice(0, 36)` already caps; remove the implicit assumption of 8.

**`src/components/report/V2ReportView.tsx`** — remove `slice(0, 3/8/5/3)` on lines 305, 322, 339, 354, 419. Keep technical safety: `slice(0, 36)` for timestamped_notes only (defensive).

**`src/server/report-output-enforcement.server.ts`** — no behavioural change to existing rules; add a small `priority_fixes` and `category_rationale` walker that runs the existing castability / generic-anchoring / brief-overconfidence / polish / framing scrubs over the new fields' string properties. Counters extended.

**`src/server/v2-report-builder.server.ts`** — extend `V2Report` and `buildV2Report`:
- Surface new public fields: `priority_fixes`, `category_rationale`, `next_take_plan` (now object with `steps[]` and optional `groups[]`).
- Project legacy report's new fields verbatim (already-public). When `priority_fixes` absent, derive a minimum of `[{ headline: legacy fix_first }]` so the section always renders something. When `category_rationale` absent, leave undefined (renderer hides the section, no fabricated content).
- No new forbidden tokens; FORBIDDEN_KEYS unchanged. `validateV2PublicBoundary` re-runs as-is.

**`src/components/report/V2ReportView.tsx`** — add sections, all read-only:
- "Prioritised fixes" (renders `priority_fixes`, falls back to `fix_first` single-card when absent).
- "Why this score" (renders `category_rationale[key]` per category — `what_works`, `why_not_full_score`, `close_gap`, optional `standout_delta`).
- Component breakdown: render any of `subtype`, `style`, `form`, `assessability`, plus existing `note`. (Server prompt already requested the additional detail; renderer just exposes it.)
- Rename "Next take plan" → "Next steps" and render `next_take_plan.groups[]` when present, else flat `next_take_plan.steps[]` (no slice).

**`src/server/process-take.server.ts` finalisation block (~line 2050–2200)** — change `presentation_notes.slice(0, 6)` to `slice(0, 6)` (already), but add equivalent scrub passes for `priority_fixes` headline/rationale strings and for `category_rationale.{key}.*` strings via the same `containsForbidden` / `stripAlt` helpers. No new caps below the schema maxima.

### 2. Tests

Add new tests, no schema migrations:
- `src/server/__tests__/v2-output-depth-caps.test.ts` — REPORT_TOOL schema maxima, evidence-pass schema maxima, polish prompt no longer references legacy "≤3 / ≤8" caps, V2ReportView source contains no `slice(0, 3)` / `slice(0, 8)` / `slice(0, 5)` for v2 lists.
- `src/server/__tests__/priority-fixes.test.ts` — builder maps `priority_fixes`, falls back to `fix_first`, scrubs banned phrases.
- `src/server/__tests__/category-rationale.test.ts` — builder surfaces rationales; output enforcement scrubs castability/polish from `why_not_full_score` and `close_gap`.
- `src/server/__tests__/timestamp-density-scaling.test.ts` — fixtures at 45s, 2m, 4m, 6m, 12m durations: validation accepts >8 entries when timestamps are valid; chronological sort preserved; invalid dropped.
- `src/server/__tests__/professional-calibration-prompt.test.ts` — system prompt source includes 90–100 differentiation, standout_delta, no "less feedback at higher scores".
- `src/server/__tests__/dance-mt-depth-prompt.test.ts` — prompt source includes Dance specialist tokens (rhythm/timing, control, dynamics, spatial, performance), MT acting-through-song / lyric / phrase / beat, and MT no-castability/recall/workshop/live-room language.
- `src/server/__tests__/v2-report-boundary.test.ts` — extend FORBIDDEN scan to assert new public fields contain no forbidden keys when populated.
- `src/server/__tests__/report-output-enforcement.test.ts` — add cases for `priority_fixes` and `category_rationale` cleanup; assert idempotence.
- Regression: existing `dance-visibility-guard.test.ts`, `report-output-enforcement.test.ts`, `v2-report-builder.test.ts`, `v2-report-boundary.test.ts`, `phase0-posture.test.ts` must remain green.

Run: `bunx vitest run --dir src`.

### 3. Out of scope (preserved)

- `audition-rules.ts`, weights, scoring caps, blockers, verdict thresholds, role-fit bounds, Mux/upload/webhook flow, dimension-derived public scores, `score_breakdown` shape, schema_version values, v1 historical rendering, Comparison rename, new-take navigation fix, Dance soft-risk demotion, false-cropping guard.

### 4. Hidden-production retest runbook (delivered in final response)

Flags: `future_report_enabled=true`, `future_evidence_enabled=true`, `TWO_STEP_ANALYSIS_ENABLED=true`. Submissions: same MT video brief / no-brief, Dance with prompt brief, Dance no-brief, one 5–10m professional tape, one multi-take comparison, Take 2/3 add-take navigation. Pass checks per spec. Rollback: `future_report_enabled=false`.
