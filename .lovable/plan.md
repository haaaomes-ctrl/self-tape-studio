## Phase 3C P0 — Output-Enforcement Cleanup

A narrow, deterministic, server-only text-enforcement layer that runs after `scrubReportQuality` / `enforceScoreAlignment` and before v1 persistence and v2 builder. Scores, weights, caps, blockers, verdicts, role-fit bounds, schema versions, and Mux flow are not touched.

### Files to add

1. **`src/server/report-output-enforcement.server.ts`** — new pure module.
   - Exports `enforcePublicReportOutputQuality(report, ctx)` returning `{ report, counters }`.
   - `ctx`: `{ mode: "brief"|"baseline", auditionType, extractedBrief, evidenceSufficiency, framingFixed, materialPolicy }`.
   - Operates on user-facing string fields only:
     - `casting_headline`, `headline`, `casting_insight`, `insight`
     - `role_fit_notes`, `role_fit`, `category_notes.*`
     - `strengths[]`, `improvements[]`, `presentation_notes[]`, `casting_risk_explanations[]`
     - `fix_first` (object: `headline`, `why_now`)
     - `timestamped_notes[].note`
     - `next_take_plan.steps[]`, `coaching_drills[]`
     - `detected_components[].note`, `submission_verdict.reason`
   - Six rule groups, each with explicit regex banks + counters:
     1. **Castability/callback/recall/workshop overclaim**: regex bank covers `highly castable`, `castable for`, `bookable`, `marketable`, `commercial look`, `strong contender`, `perfect fit`, `exactly what they(’|')re looking for`, `callback-ready`, `recall-worthy`, `would (get|be) a? recall`, `strong callback potential`, `workshop-ready`, `development(-| )workshop ready`, `highly castable for (musical theatre|contemporary|development workshops)`, `likely to (progress|be recalled)`, `would be called back`, `buyer/brand/market fit`. Sentence-level removal; if a sentence contains the literal brief project type ("development workshop") in a neutral noun phrase (no `castable|ready|contender|fit|strong|highly` nearby), keep it. Empty fields get a neutral, evidence-bound replacement only when the field is required (e.g. `casting_headline`); otherwise drop sentence.
     2. **Generic phrase anchoring**: phrase bank (`strong vocal performance`, `grounded acting`, `natural`, `believable`, `character warmth`, `polished`, `professional tape`, `screen-ready`, `development-ready`, etc.). A sentence containing one of these is kept ONLY if it also contains an anchor token: a timestamp `\b\d{1,2}:\d{2}\b`, the literal words `lyric|line|phrase|beat|verse|bridge|chorus|reader|reaction|breath|diction|register|transition`, or a component label. Otherwise the sentence is removed.
     3. **Brief-adherence overconfidence**: replace `perfect adherence`, `perfectly aligned`, `all (specific )?brief requirements were met (precisely|fully)`, `every instruction was met`, `flawless (adherence|compliance)`, `strict adherence to all`, `full marks for adherence`, `spot on`, `exactly what was requested` → "The submitted material appears consistent with the supplied brief." `brief_adherence` score is never touched.
     4. **`professional_presentation` anti-polish**: in `category_notes.professional_presentation`, `presentation_notes`, and any sentence about presentation: strip `highly professional tape`, `polished tape`, `technically polished`, `professional standard`, `high production value`, `studio-quality`, `expensive equipment`, `paid (reader|accompanist|coaching|editing)`, `well-lit`, `neutral background`, `no (visual )?distractions`, `solid colour (of your )?top`, `clean package`, `professional look`, `screen-ready as marketability`. Allowed terms: `readable frame`, `stable framing`, `head-and-shoulders framing maintained`, assessability/orientation/slate/single-edit references; suffix `This affects readability, not talent.` if the field becomes empty.
     5. **Fixed-frame / rehearsal-only**: when `framingFixed` (derived from extracted brief tokens `head-and-shoulders|close-up|fixed|static|self-tape camera-led`), in `next_take_plan.steps`, `coaching_drills`, `improvements`, `fix_first.headline`/`why_now`, and `timestamped_notes[].note`: detect `walking|standing to record|moving (around|across) the room|holding (a|an|the) (instrument|prop)|using props|physical business|crossing the room|stepping out of frame|adding (staging|blocking)|recording while moving|sit on (your|my) hands`. Rewrite each match by prefixing `Rehearsal-only: ` and appending ` For the recorded take, keep the head-and-shoulders frame and use breath, stillness, eyeline and thought shifts to carry the same intention.` (single canonical suffix to avoid combinatorial drift). Existing `scrubReportQuality` framing scrub continues to run; this layer is the safety net.
   - Counters returned (logged, not persisted to public report or `score_breakdown`):
     `{ castability_removed, generic_unanchored_removed, brief_overconfidence_rewritten, presentation_polish_removed, framing_rehearsal_rewritten, comparison_fallback_used: 0 }`.
   - Pure: clones inputs via `structuredClone`. No private fields ever added. Never mutates `scores`, `overall_score`, `verdict`, `role_fit_modifier`, `score_breakdown`, `schema_version`.

2. **`src/server/__tests__/report-output-enforcement.test.ts`** — new file, ≥ 25 cases:
   - Castability bank (10 fixtures including the four phrases observed in production).
   - Neutral "development workshop" project title preserved.
   - Generic phrase anchoring (anchored kept, unanchored stripped) — both vocal + acting.
   - Brief-adherence overconfidence rewriting and score immutability assertion.
   - Presentation polish/wardrobe/lighting/equipment removal and assessability preservation.
   - Fixed-frame: rehearsal-only rewrite for walking/prop/instrument/stand/sit-on-hands; recorded-take alternative appended; brief without fixed framing leaves text unchanged.
   - Idempotence: running enforcement twice equals once.
   - Privacy: forbidden-key scan over output; original `scores`, `overall_score`, `role_fit_modifier`, `verdict_final` deep-equal pre/post.
   - Caps preserved: ≤ 3 strengths, ≤ 3 improvements, ≤ 8 timestamped notes (does not add items).

3. **`src/lib/__tests__/comparison-headline-fallback.test.ts`** — new file (or co-locate near comparison util) testing the headline picker in 6 cases (v1 only, v2 only, v2 with insight only, both, neither, malformed).

### Files to modify

4. **`src/server/process-take.server.ts`**
   - Import `enforcePublicReportOutputQuality`.
   - Insert call immediately after the existing locked-fields/score-alignment block at ~line 2675 and before the schema-version stamp at ~line 2778.
   - Pass framing flag derived from `extractedBrief.framing` (presence of `head-and-shoulders|fixed|static|close-up|self-tape camera-led`) and `materialPolicy`.
   - Log counters under `[take-pipeline] output_enforcement_applied` (no PII, no raw text). Counters do NOT enter `report` or `score_breakdown`.
   - The same `report` object is then handed to `buildV2Report` (already happens at ~2797) so v2 inherits the cleaned text automatically.

5. **`src/routes/audition.$auditionId.tsx`**
   - Introduce a small local helper `pickComparisonHeadline(report)` returning the first non-empty of `casting_headline`, `headline`, `casting_insight`, `insight`, else `null`.
   - Replace the four call sites using `report?.casting_headline` (lines ~1062, 1511, 1542, 1588) with this helper.
   - At line ~1588, render the `—` and headline only when the picked headline is non-empty; otherwise show just `Best take: Take N`. Apply same pattern at line ~1511.
   - No layout/redesign changes; quoting and styling preserved. Pure presentation.

### Out of scope (explicit non-changes)

- `src/lib/audition-rules.ts`, `src/lib/report-schema.ts`, `src/server/shadow-scoring.server.ts`, `src/server/evidence-pass.server.ts`, weights, caps, verdict labels, blockers, role-fit bounds, Mux upload/webhook, schema versions, RLS policies, dimension scoring, `score_breakdown` shape (counters are logged only).
- `v2-report-builder.server.ts`: no functional change required because the legacy `report` object it receives is now already cleaned. The forbidden-key validator stays as-is.

### Tests / verification

- `bunx vitest run --dir src` once at the end. Update only the new tests + any drifted assertion that previously expected pre-enforcement language; existing posture / no-private-key / boundary tests must still pass unchanged.

### Hidden-production QA runbook (delivered after merge)

Re-submit the same MT brief × 3 takes with `future_report_enabled=true`, `future_evidence_enabled=true`, `TWO_STEP_ANALYSIS_ENABLED=true`, then verify `schema_version="v2-component"`, no forbidden keys, none of the banned phrases (case-insensitive grep over all string fields), 5–8 timestamps each, comparison headline non-blank, `scores`/`overall_score`/`verdict_final` unchanged versus current production for the same input.
