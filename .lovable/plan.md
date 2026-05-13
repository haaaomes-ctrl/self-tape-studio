## Goal

Make the live take pipeline reliably reach `complete` so users never sit on "Finalising results" indefinitely. Smallest safe change. No public output / scoring / comparison / Mux / export changes.

## Root-cause analysis

There are two distinct stuck-at-finalising windows:

1. **Pre-persist hang (real stuck-finalising)** — between `processing_phase: "finalising"` (process-take.server.ts:1953) and the conditional `status: "complete"` write (line 3066). Deterministic scrubs/score recompute (~lines 2018–3000) is large; if a Worker dies or runs out of CPU mid-scrub, the `try/catch/finally` never executes, no terminal state is written, and the row sits at `(processing, finalising)` until the reconciler's `FINALISING_ORPHAN_MINUTES = 5` window force-errors it. That looks to the user like "stuck at Finalising results, then errored" — exactly the intermittent failure described.

2. **Post-complete QA emission hang (cosmetic but risky)** — after `status: "complete"` is written, two awaited QA calls run (lines 3199–3231). `writeQAArtifact` calls `supabaseAdmin.storage.from(...).upload(...)` with **no timeout**. If Storage stalls, the request handler stays open. Status is already `complete` so the user sees the report on next poll, but unhandled rejections / Worker timeouts here can mask success metrics and cause the Mux cleanup branch to retry oddly on the next reconciler tick.

Why intermittent: scrubs CPU cost varies by report size; Storage upload latency varies. Both are unbounded today.

## Fix (smallest safe change)

### A. Make QA emission truly non-blocking and bounded

`src/server/process-take.server.ts` (lines 3198–3231): convert the two awaited QA emit calls into a single fire-and-forget `void` call wrapped in `Promise.race` with a 5s timeout, with `try/catch` that only logs warnings. Status is already `complete` before this runs. No change to artefact contents.

`src/server/v3/qa-artifact-sink.server.ts`: wrap the `supabaseAdmin.storage.from(bucket).upload(...)` call in `Promise.race` with a 5s timeout. On timeout, return `{ written: false, sink_write_status: 'failed', warning: 'storage_upload_timeout' }` and emit the existing fallback log. No change to file/console_jsonl modes.

### B. Reconcile "report exists but stuck finalising" to complete (instead of error)

`src/routes/api/public/reconcile-stale-takes.ts` (the `staleFinalising` loop, ~lines 290–344): before force-erroring, re-read the row including `report` and `scores`. If `report` is non-null and contains a valid scores object, write `status: 'complete', processing_phase: 'complete', error_message: null` instead of error. Log `finalising_orphan_recovered_complete` metric. Only force-error when `report` is null. This handles the case where persistence partially landed or where QA-emit timeouts happened just after a successful complete write that we want to surface.

### C. Heartbeat in long scrubs

`src/server/process-take.server.ts`: at the existing scrub sub-stage logging points (e.g. before `finaliseExceeded()` checks at lines 2064, 2198, 3009), add a lightweight `updated_at: new Date().toISOString()` touch via a single `supabaseAdmin.from('takes').update({ updated_at: ... }).eq('id', takeId).eq('processing_phase', 'finalising')`. This keeps the reconciler's `idle > 5min` window accurate so a slow-but-alive run is not killed prematurely, and a truly dead worker is detected promptly.

### D. Tests

Add `src/server/__tests__/finalising-reconciler-recovery.test.ts`:
- stale-finalising row with `report = {...}` → reconciler marks `complete`, not `error`.
- stale-finalising row with `report = null` → reconciler force-errors as today.

Extend `v3-s8-qa-artifact-sink.test.ts`:
- mock `upload` that never resolves → with the 5s timeout, `writeQAArtifact` returns `{ written: false, warning: contains 'storage_upload_timeout' }` within budget.

Add `process-take-qa-nonblocking.test.ts`:
- spy on `safeEmitRawReportForQA` / `emitQAManifestForAnalysisRun`; verify `runProcessTake` resolves before they resolve (i.e. fire-and-forget).

### E. Out of scope (explicit non-changes)

- No edit to report/scoring/comparison/technique/export logic.
- No Mux/webhook/upload changes.
- No new RLS, no new public surface.
- QA artefacts remain internal-only; storage bucket stays private.
- Public-output gates and `production_safe = blocked` invariants untouched.

## Files changed

- `src/server/process-take.server.ts` — sections A and C only.
- `src/server/v3/qa-artifact-sink.server.ts` — storage upload timeout.
- `src/routes/api/public/reconcile-stale-takes.ts` — recover-to-complete branch.
- `src/server/__tests__/finalising-reconciler-recovery.test.ts` — new.
- `src/server/__tests__/v3-s8-qa-artifact-sink.test.ts` — extended.
- `src/server/__tests__/process-take-qa-nonblocking.test.ts` — new.

## Verification

```text
npx vitest --run src/server/__tests__/v3-s8-qa-artifact-sink.test.ts
npx vitest --run src/server/__tests__/v3-s8-qa-artifact-emitter.test.ts
npx vitest --run src/server/__tests__/v3-s8-qa-artifact-wiring.test.ts
npx vitest --run src/server/__tests__/v3-s8-qa-artifact-raw-json.test.ts
npx vitest --run src/server/__tests__/v3-s8-qa-trace-proof-emitters.test.ts
npx vitest --run src/server/__tests__/v3-s8-comparison-runtime-trace-wiring.test.ts
npx vitest --run src/server/__tests__/v3-s8-raw-report-nonblocking.test.ts
npx vitest --run src/server/__tests__/finalising-reconciler-recovery.test.ts
npx vitest --run src/server/__tests__/process-take-qa-nonblocking.test.ts
npx vitest --run
```

Plus `git status --short`, `git diff --stat`, `npm run build:dev`, `npm run build`, and the guardrail `rg` scans listed in the brief.

## Live retest plan

After merge/publish on the locked production domain:
- Fixture: GF-01 / RT-15 / MT-same-video-20260511.
- Submit two sets of three takes.
- Success: 0 stuck at "Finalising results"; every completed take has either a Storage artefact under `qa-artifacts/take-<id>/...` or a `TAPECOACH_QA_ARTIFACT_JSON:` fallback log line.
