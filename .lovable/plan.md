## XIMPL-PHASE-3C-P2-ENFORCEMENT-QA-COMPONENT-DEPTH — Plan

Hardens v2 enforcement, normalises `category_rationale`, exposes a deeper component-breakdown surface, and adds the missing QA test coverage. Preserves all P0/P1 work, scores, weights, caps, blockers, role-fit bounds, Mux flow, public/private boundary and v1 historical rendering.

### 1. Enforcement hardening (`src/server/report-output-enforcement.server.ts`)

**Castability rewrite (was: drop sentence; now: rewrite first).** Replace the drop-on-match for the soft cluster with a phrase-level rewrite map applied BEFORE the sentence-level castability filter:

| Trigger | Rewrite |
|---|---|
| "highly castable" | "well aligned with the supplied brief" |
| "strong contender" | "a strong tape for the stated task" |
| "callback-ready" / "callback ready" / "recall-worthy" / "recall worthy" / "workshop-ready" | "ready to submit" |
| "perfectly captures" | "clearly supports" |
| "exactly what they're/the team/they are looking for" | "matches the stated style/task requirements" |
| "perfect fit" | "a strong fit for the stated task" |

Counter: extend `EnforcementCounters` with `castability_rewritten`. Sentences still containing residual hard overclaims (`bookable`, `marketable`, `would get a recall`, `buyer/brand fit`, `strong callback potential`) continue to be dropped via the existing castability sentence filter. Idempotent (rewritten phrases no longer match the trigger regex).

**Frame-break expansion.** Extend `FRAME_BREAK_TRIGGERS` to also catch:
- "stand to sing", "standing to sing", "sing standing"
- "hold(ing) an instrument", "with an instrument"
- "physical task", "stage business"
- "blocking" / "staging" as recorded-take advice (heuristic: only inside coaching_drills / next_take_plan / improvements)

**`category_rationale` walker.** New `cleanCategoryRationale(r, scores, counters)`:
- For each public category key, walk `what_works | why_not_full_score | close_gap | standout_delta`:
  - run `cleanProse` (drops castability + generic-unanchored, scrubs brief overconfidence and the new rewrite map)
  - reject FORBIDDEN private keys (`shadow_*`, `qa_*`, `evidence_anchors`, `dimension_*`, `supports`, `anchor_id`, etc.) — strip the offending property entirely
  - drop `standout_delta` containing "perfect"/"flawless"/"all requirements met" wording
- After cleaning: for each category whose score < 100, if BOTH `why_not_full_score` and `close_gap` are empty → drop the whole category entry; counter `category_rationale_dropped++`.
- For categories with score ≥ 90 where `standout_delta` is missing → counter `category_rationale_missing_delta++` (non-blocking, log only).
- Drop empty category objects entirely. Counter `category_rationale_scrubbed`.

**`priority_fixes` + `next_take_plan.groups[].items[]` walker.** Apply existing `cleanProse` + framing rewrite to:
- `priority_fixes[].headline`, `priority_fixes[].rationale` (drop entry if headline empties).
- `next_take_plan.groups[].items[]` (drop empty items / empty groups). New counter `next_take_plan_scrubbed`.

**Component public-safe scrub.** New `cleanComponentPublicFields()` runs `cleanProse` over the optional public-safe fields (see §3) on `detected_components[]`/`components[]` items, and strips any FORBIDDEN private key.

Wire all new walkers into `enforcePublicReportOutputQuality` after the existing field passes; export `EnforcementCounters` updated. Counters are a structured log — never persisted into `takes.report` or `score_breakdown`.

### 2. Builder extension (`src/server/v2-report-builder.server.ts`)

Extend `V2Component` with optional public-safe fields, all `string | null` except `score`/`weight`:

```ts
component_type?: string | null;   // alias of `type` for renderer clarity
label?: string | null;
what_it_shows?: string | null;
what_is_assessable?: string | null;
key_evidence?: string | null;     // short prose; raw anchors stripped
score_driver?: string | null;
close_gap?: string | null;
style_or_task_confidence?: "low" | "medium" | "high" | null;
```

`projectFutureComponent` and `projectLegacyComponent` populate these from the same-named fields on the upstream object when present (no fabrication, no defaults). `key_evidence` is a string copy only — `evidence_anchors`, `supports`, `anchor_id` and other private keys are never read. `style_or_task_confidence` falls back to `style_confidence` if `subtype`/`style` were supplied.

`buildV2Report` continues to surface `category_rationale` verbatim (already cleaned upstream) and `priority_fixes` with `fix_first` fallback.

`FORBIDDEN_KEYS` walker is unchanged (it already covers the new private tokens).

### 3. Renderer (`src/components/report/V2ReportView.tsx`)

In the existing component-breakdown section, after the `meta` row and `note`, render any of the new fields when truthy, each as a small label + body line:
- "What it shows", "What's assessable", "Key evidence", "Score driver", "Close the gap"
- Confidence chip ("style/task confidence: low|medium|high") when present.

Backwards-compatible: `note`, weight, score, type continue to render as today. v1 path is untouched (legacy `<ReportView>` component is not modified).

### 4. New tests

- `src/server/__tests__/timestamp-density-scaling.test.ts` — source-string assertions of the duration bands `3–5/6–10/8–14/12–24/18–36` in `process-take.server.ts`, `report-polish.server.ts`, `evidence-pass.server.ts`. Functional: ensure the existing post-validation sort/drop preserves chronological order, drops malformed `MM:SS`, accepts >8 entries; assert `V2ReportView` source has no `slice(0, 8)` for `tsNotes`. MT/Dance coverage strings present in the prompts.
- `src/server/__tests__/professional-calibration-enforcement.test.ts` — deterministic enforcement tests proving each rewrite-map phrase is rewritten to its safer alternative (not deleted); high-overclaim phrases are still dropped; `role_fit_notes` containing "perfectly captures" or "exactly what the team is looking for" is rewritten; idempotent.
- `src/server/__tests__/category-rationale-scrub.test.ts` — empty `why_not_full_score` + empty `close_gap` for score 88 drops the entry; score 95 with no `standout_delta` keeps the entry and increments `category_rationale_missing_delta`; injected `shadow_scores`/`anchor_id` keys are removed; "perfect"/"flawless adherence"/"all requirements met" inside `standout_delta` is removed.
- `src/server/__tests__/frame-break-hardening.test.ts` — new triggers ("stand to sing", "holding an instrument", "stage business", recorded-take "blocking/staging") rewrite to "Rehearsal-only:" with the head-and-shoulders suffix when `framingFixed=true`; do NOT rewrite when `framingFixed=false`.
- `src/server/__tests__/component-depth.test.ts` — builder maps `what_it_shows`, `what_is_assessable`, `key_evidence`, `score_driver`, `close_gap`, `style_or_task_confidence` from both legacy and future-component shapes; never copies `evidence_anchors`/`supports`/`anchor_id`; renderer source includes the new field labels.
- `src/server/__tests__/dance-depth.test.ts` — Dance prompt source contains `rhythm/timing`, `control`, `spatial`, `dynamics`, `performance`; forbids unanchored "high-energy", "clean lines", "rhythmic precision"; does not block ordinary low-lighting from being a craft note (P0 soft-risk demotion still active); enforcement leaves `singing` labels off Dance components (deterministic check on a Dance-only `report` fixture).
- `src/server/__tests__/mt-depth.test.ts` — MT prompt source contains `acting-through-song`, `lyric`, `phrase`, `beat`, `transition`; forbids `castability`/`recall`/`workshop`/`live room`; enforcement preserves both Acting Scene + Song component entries; v2 builder accepts >8 timestamps and >3 strengths/improvements; baseline mode leaves `role_fit_notes` empty.
- `src/server/__tests__/v2-report-boundary.test.ts` — extend the FORBIDDEN walker to also visit `priority_fixes`, `category_rationale`, `next_take_plan.groups[].items[]`, and the new component public-safe fields; assert the leaky-legacy fixture still passes.
- `src/server/__tests__/report-output-enforcement.test.ts` — additions for new rewrite map (assert text rewritten, not blank), new framing triggers, and new counters; assert the existing "does not add items to capped arrays" test in this file is updated to allow the v2 maxima (12 strengths, 15 improvements, 36 timestamped notes) — the legacy 3/3/8 assertions are replaced.

Run: `bunx vitest run --dir src`.

### 5. Out of scope (preserved)

`audition-rules.ts`, weights, scoring caps, blockers, verdict thresholds, role-fit bounds, Mux/upload/webhook flow, dimension-derived public scores, `score_breakdown` shape, schema_version values, v1 historical rendering, Comparison rename, new-take navigation fix, P0 Dance soft-risk demotion, P1 priority_fixes / category_rationale shapes, P1 schema maxima.

### 6. Hidden-production retest runbook (delivered in final response)

Flags `future_report_enabled=true`, `future_evidence_enabled=true`, `TWO_STEP_ANALYSIS_ENABLED=true`. Submissions: MT brief / no-brief, Dance brief / no-brief, 5–10m professional tape, multi-take comparison. Pass checks: no `highly castable` / `recall-worthy` survives in any user-facing prose; `category_rationale` shows discipline-specific language; component breakdown shows extra detail when supplied; >8 timestamped notes appear on long tapes; Dance reports never label vocal; MT reports always include both Acting Scene + Song entries. Rollback: `future_report_enabled=false`.
