## Phase 3B — Hidden-Production Single-Path v2 Persistence & Rendering

### Scope

Convert Phase 3A's log-only v2 builder into a **server-flag-only** persistence + render path. No allowlists, no client toggles, no dual-published reports. v1 remains the default and the fallback. Production scoring is untouched.

### 1. Hidden-Production Readiness Check (output only, no code)

The implementation will report each readiness item as yes/no in the final summary. All required items are satisfied: single flag (`future_report_enabled`), v1 default + fallback, no scoring/verdict/role-fit changes, `score_breakdown` privacy preserved, v1 historical rendering preserved.

### 2. v2 Builder Hardening (`src/server/v2-report-builder.server.ts`)

Extend `buildV2Report` so it can build from either:
1. validated `futureDimensions.components` (preferred when present), or
2. legacy `report.detected_components` (when futureDimensions absent), or
3. empty `components: []`.

Add public-safe field mapping:
- `casting_headline → headline`
- `casting_insight → insight`
- `verdict_final` / `submission_verdict.label → verdict`
- `overall_score_final` / `overall_score → overall_readiness`
- `feedback_reliability_override → reliability` (+ `confidence_reason → reliability_reason`)
- `category_notes`, `brief_adherence_breakdown`, `coaching_drills` (→ `next_take_plan` if v2 plan absent), `submission_risk_flags → risk_flags`, `casting_risk_explanations`, `presentation_notes`, `timestamped_notes`
- `role_fit_*` → `role_fit` only in brief mode
- `scores` verbatim from production (six-field public object, never derived)

Component projection strips: `dimensions`, `dimension_confidence`, `evidence_anchors`, `supports`, `anchor_id(s)`, raw evidence prose. Allows: `type`, `subtype`, `style`, `form`, `start`, `end`, `assessability`, plus a sanitised public `note` string when derived from legacy `detected_components`.

Add new pure helper `validateV2PublicBoundary(v2)` (same module or sibling) that:
- recursively rejects any forbidden key from the canonical list (shadow_*, qa_counters, scrub_counters, components_summary, dimensions_summary, dimension_traces, evidence_dimensions, internal_*, take_qa_traces, future_*, evidence_anchors, dimension_confidence, qa_trace, raw_evidence, hidden_reasoning, supports, anchor_id, anchor_ids);
- requires `schema_version === "v2-component"`;
- requires `scores` to be the canonical six-field object when legacy scores exist;
- requires `overall_readiness` when legacy overall exists;
- rejects forbidden keys inside `components[]`;
- does **not** reject normal user-facing keys (`note`, `timestamped_notes`, `presentation_notes`, `category_notes`, `brief_adherence_breakdown`, `detected_components`).

Returns `{ ok: true } | { ok: false; reason: string }` — reason is a short code, no payload echo.

### 3. Persistence Wiring (`src/server/process-take.server.ts`)

Replace the existing log-only block (≈ lines 1312–1342) with a build step that produces a candidate v2 object earlier, but defer the persistence decision to the single write site (≈ lines 2867–2887). New flow:

```text
buildFinalReport (existing v1 'report')
  └── if cfg.future_report_enabled:
        v2Candidate = buildV2Report({legacyReport: report, ...})
        if validateV2PublicBoundary(v2Candidate).ok → reportToPersist = v2Candidate
        else → log v2_report_fallback_to_v1 {reason}; reportToPersist = report
      else:
        reportToPersist = report
```

The DB write keeps `scores: report.scores` and `overall_score: overall` untouched (production-derived). Only the `report` column swaps shape. `score_breakdown` is unchanged. Errors thrown by builder/validator are caught → v1 fallback, log reason code only.

### 4. Schema-Version Renderer Branch

`src/routes/audition.$auditionId.tsx`: import `readReportSchemaVersion`. For each take's report, if version is `v2-component`, render the new `<V2ReportView report={...} auditionType={...} />`; otherwise existing v1 rendering path is unchanged.

`src/components/checklist-view.tsx`: unchanged (it doesn't read the report body — confirmed in Phase 3A renderer-no-change tests; will keep that test green by adding the v2 branch only inside the audition route).

Comparison section inside the audition route (multi-take view): always source comparison numbers from `take.scores` first, then `report.scores`; never from v2 components. This already matches existing behaviour — add a defensive guard so a malformed v2 `report` cannot throw.

### 5. v2 Renderer Components (`src/components/report/`)

Minimal, semantic-token-styled components, each thin and read-only:

```text
V2ReportView          (orchestrator, picks discipline labels)
V2Header              (headline, insight, reliability badge)
V2VerdictSummary      (verdict, overall_readiness)
V2CategoryBreakdown   (six public scores w/ discipline-aware labels)
V2ComponentBreakdown  (components[], optional)
V2Strengths / V2Improvements / V2FixFirst
V2TimestampedNotes
V2NextTakePlan
V2RiskFlags
V2RoleFit             (brief mode only)
V2PresentationNotes
V2ReliabilityBadge
```

All components consume only the public-safe v2 shape. No private keys are read. Shape mismatches degrade silently (empty section).

### 6. Discipline-Aware Display Labels (`src/lib/discipline-labels.ts`)

New pure module exporting `getCategoryLabel(auditionType, key)` and `shouldShowVocal(auditionType, scores)`. Backend score keys are unchanged. Mapping per spec: MT, Song/Voice, Acting/Monologue, Dance, Commercial, Hybrid (default to MT-style), Unknown (neutral wording). Used by `V2CategoryBreakdown` and `V2ComponentBreakdown`.

### 7. Tests (`src/server/__tests__/` and `src/lib/__tests__/`)

Add or extend:

- **persistence**: `process-take` integration-style unit on the inline branch — flag-off → v1 persisted; flag-on + valid → v2 persisted; flag-on + validator fail → v1 persisted with `v2_report_fallback_to_v1` log; scores untouched in all three.
- **v2-report-boundary**: extend with synthetic-leak fixtures (`future_shadow`, `qa_counters`, `future_dimensions`, `evidence_anchors`, `dimensions`) injected into legacy input → must not appear in v2 output; validator rejects when synthetically appended.
- **v2-report-builder**: legacy-only path (no futureDimensions) builds components from `detected_components`; brief vs baseline role-fit; field mapping (`casting_headline`, `coaching_drills→next_take_plan` fallback, etc.).
- **discipline-labels**: Dance never shows "Vocal Performance"; Acting/Monologue uses "Speech Delivery"; Song/Voice uses "Vocal Performance"; Commercial omits Vocal by default; MT shows both.
- **renderer branch**: existing `renderer-no-change.test.ts` updated to allow v2 branching in `audition.$auditionId.tsx` *only* via `readReportSchemaVersion` (no inline string `"v2-component"`/`"schema_version"` outside the helper); checklist-view still untouched.
- **comparison safety**: rendering-shape unit confirming comparison reads from `take.scores`/`report.scores` only; mixed v1/v2 row arrays don't throw.
- **non-regression**: `audition-rules.ts` untouched; no new public score field; no `legacy_scores` key anywhere in v2 output.

Run command: `bunx vitest run --dir src`.

### 8. Files Touched

```text
src/server/v2-report-builder.server.ts        — extend builder + add validator
src/server/process-take.server.ts             — replace dark-launch block with persistence-or-fallback
src/lib/discipline-labels.ts                  — NEW
src/components/report/                        — NEW (13 small files)
src/routes/audition.$auditionId.tsx           — schema-version branch + v2 view
src/server/__tests__/v2-report-builder.test.ts        — extend
src/server/__tests__/v2-report-boundary.test.ts       — extend
src/server/__tests__/v2-persistence.test.ts           — NEW
src/server/__tests__/renderer-no-change.test.ts       — relax to allow helper-driven branch
src/lib/__tests__/discipline-labels.test.ts           — NEW
```

### Out of scope (explicitly not implemented)

Account/audition allowlists; admin-only render gate; client query-param switch; dual-published reports; comparison redesign (Phase 3D); admin QA dashboard (Phase 4); any scoring/weight/cap/blocker/verdict/role-fit changes; Mux flow changes; private data in `takes.report` or `score_breakdown`; `legacy_scores`; output-quality repair (generic praise, role-fit overclaim, etc. — those remain known issues to QA in hidden production).

### Approval

Approve to proceed with implementation against this plan.