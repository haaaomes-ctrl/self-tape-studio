# Phase 1 — Internal Discipline Evidence Dimensions (flag-gated)

## Goal

Capture internal, observation-only discipline dimensions during Step 1 of the analysis pipeline when `future_evidence_enabled === true`. Public report JSON, scoring, prose, UI, DB schema, and Mux/upload behaviour remain byte-identical to today. No QA-trace writes, no shadow scoring, no v2 schema or UI.

## Source surface map (planned)

| Surface | File | Phase 1 change |
|---|---|---|
| Evidence pass | `src/server/evidence-pass.server.ts` | Add optional dimensions tool-block + parsing behind a per-call `withFutureDimensions` arg. Legacy path unchanged. |
| Orchestration | `src/server/process-take.server.ts` | Read `getResolvedConfig().future_evidence_enabled`, pass as `withFutureDimensions` into `runEvidencePass`. No Step 2 wiring. |
| Polish (Step 2) | `src/server/report-polish.server.ts` | No change. `buildEvidenceBlock()` continues to omit dimension data. |
| Scrubs | `src/server/report-quality.server.ts` | No change. |
| App config | `src/server/app-config.server.ts` | No change (flag already exists). |
| Audition rules | `src/lib/audition-rules.ts` | No change. |
| Public schema helper | `src/lib/report-schema.ts` | No change. |
| Dimensions modules | `src/server/dimensions/*` (new) | Schemas, anchors, prompt fragments, validators. |
| Tests | `src/server/__tests__/dimensions/*` (new) | Schema, anchor, flag, boundary, isolation tests. |

## Dimension module layout

Create `src/server/dimensions/`:

- `shared.ts` — anchor model, assessability model, `DimensionConfidence`, `validateAnchors`, `dropMalformedDimensions`, common Zod-free runtime guards (project does not currently use Zod in `evidence-pass.server.ts` — keep it dependency-free with hand-written guards to avoid adding a dependency).
- `acting.ts`, `monologue.ts`, `song.ts`, `mt.ts`, `dance.ts`, `voice.ts`, `commercial.ts`, `slate.ts` — per-discipline dimension keys (exact lists from the brief), prompt fragment, and validator.
- `index.ts` — registry of `{ key, dimensions, promptFragment, validate }` plus the combined prompt-fragment builder used by Step 1 when the flag is on.

### Shared anchor model

```ts
type AnchorKind =
  | "timestamp" | "component_note" | "brief"
  | "audio_observation" | "visual_observation" | "movement_observation"
  | "copy_observation" | "lyric_observation" | "reader_observation"
  | "camera_observation";

interface EvidenceAnchor {
  id: string;
  timestamp?: string | null;   // MM:SS, validated via existing isValidTimestamp
  kind: AnchorKind;
  note: string;                // observation only, short
  supports: string[];          // dimension keys it supports
}
```

### Component future-evidence shape

```ts
interface FutureComponent {
  type: string;
  start: string | null;
  end: string | null;
  confidence: "low" | "medium" | "high";
  assessability: { /* mirrors evidence_sufficiency, no duplication of fields already present */ };
  subtype?: string | null;
  style?: string | null;
  form?: string | null;
  dimensions: Record<string, { value: unknown | null; confidence: "low" | "medium" | "high"; supports: string[] /* anchor ids */ }>;
  evidence_anchors: EvidenceAnchor[];
}
```

### Validation rules

- Every populated dimension claim must reference at least one anchor id present in `evidence_anchors`.
- Anchor `supports` must reference dimension keys defined in the relevant discipline module.
- Timestamps validated through existing `isValidTimestamp` against tape duration.
- Unknown style/subtype is allowed (kept as `null` or free string).
- Forbidden inference (protected traits, marketability, live-room, no-brief invention) is blocked at prompt level; validator drops any anchor whose `note` exceeds length budget or whose dimension is unsupported.
- Malformed `future_components` block → drop entirely, log `[evidence] future_dimensions_dropped`, return rest of evidence intact. Never fail the pipeline.

## Evidence-pass changes

`runEvidencePass` gains an optional `withFutureDimensions: boolean` arg (default false). When true:

1. The tool schema is extended with an optional `future_components` array (matching `FutureComponent`), declared via the discipline module registry. The legacy schema fields remain required and unchanged.
2. The system prompt is concatenated with the combined dimension prompt fragment (observation-only, anchors required, unknown allowed, no protected-trait inference, no live-room inference, no no-brief invention).
3. After the existing normalisation, the parsed `future_components` is run through the dimension validators. Malformed entries are dropped; the result is attached to the returned evidence as a NON-enumerable property (or to a separate sibling field on `RunEvidencePassResult` such as `futureDimensions`) so it never gets JSON-serialised into anything that flows downstream.

`summariseEvidence` is unchanged. Public summary in `score_breakdown.two_step` is unchanged.

## Orchestration change

In `process-take.server.ts` around the `runEvidencePass` call:

```ts
const cfg = await getResolvedConfig();
const evResult = await runEvidencePass({
  ...,
  withFutureDimensions: cfg.future_evidence_enabled,
});
```

When dimensions are returned, log a single internal line `[take-pipeline] future_dimensions_captured` with counts only (no content). The dimensions are not passed to `runReportPolish`, not written to `takes.report`, not written to `take_qa_traces`, not used in scoring. They are discarded after the log.

Step 2, locked-field enforcement, score scrubbing, and report rendering paths are untouched.

## Tests

New folder `src/server/__tests__/dimensions/`:

1. `flag.test.ts` — When flag false, `runEvidencePass` is invoked without dimension prompt/schema (assert via the `withFutureDimensions` arg path / by inspecting the prompt builder pure function exported for testing). When flag true, it is invoked with dimensions.
2. `acting.test.ts`, `monologue.test.ts`, `song.test.ts`, `mt.test.ts`, `dance.test.ts`, `voice.test.ts`, `commercial.test.ts`, `slate.test.ts` — valid dimension passes; missing-anchor dimension dropped; unknown style allowed; unsupported claim rejected.
3. `anchors.test.ts` — anchor key/timestamp/malformed rules.
4. `step2-isolation.test.ts` — `buildEvidenceBlock` output (exported for test) does not contain any dimension or future-component key for a sample evidence object.
5. Extend `report-public-boundary.test.ts` — already covers all 15 forbidden keys; add a fixture-style assertion that a sample report produced with the flag on still contains none.
6. `legacy-fixture-loader.test.ts` and `phase0-posture.test.ts` — must continue to pass unchanged.

## Failure-fixture compatibility

The Phase 0 failure fixtures (e.g. `02-acting-through-song-weak.json`, `04-timestamp-underproduction.json`) are touched only to confirm the new MT / timestamp dimensions could in principle express the missing evidence. No change to public expectations.

## Hard limits

- No `shadow_*`, `qa_*`, `scrub_*`, `dimensions_summary`, `components_summary`, `dimension_traces`, `evidence_dimensions`, `internal_dimensions`, `internal_qa`, `take_qa_traces`, `future_evidence`, `future_dimensions` keys in `takes.report`.
- No DB migration in Phase 1.
- No new runtime dependency (Zod not added; hand-written guards instead).
- No change to `TWO_STEP_ANALYSIS_ENABLED`, weights, caps, blockers, verdict thresholds, role-fit bounds, audition types, Mux/upload, renderer, schema helper.

## Verification

`bunx vitest run --dir src` — expect existing 19 tests + new dimension tests all green.

## Exit

“Phase 1 complete. Ready for review before Phase 2.”
