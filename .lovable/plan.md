## What's happening

Take `8911ce0c…` did not actually reach "Finalising results" — it died during `analysing`, and the reconciler force-errored it after 4 minutes of silence. The user sees "Finalising results" because the UI keeps spinning until the reconciler flips the row to `error`.

Worker logs show the exact failure at 17:49:14:

```
[warn] [analysis-queue] ANALYSIS_QUEUE binding unavailable; using waitUntil fallback
[take-pipeline] metric analysis_enqueue_failed  failure_code: analysis_queue_unavailable
[take-pipeline] metric analysis_job_enqueued    dispatch_method: wait_until_fallback  degraded: true
```

Then analysis ran inline inside the **Mux webhook request**:
- `evidence_pass_completed` at 17:49:26 ✅
- `report_polish_started` at 17:49:30 ✅
- …silence…
- reconciler `analysing_orphan_forced_error` at 17:54:00 ❌

The Step 2 (Gemini polish) call started but never finished — the webhook request's `waitUntil` budget expired before Gemini returned, so the worker was torn down mid-flight.

## Root cause

Even though `wrangler.jsonc` declares the `ANALYSIS_QUEUE` producer binding → `tapecoach-analysis-jobs`, the deployed worker doesn't actually have the binding at runtime (`env.ANALYSIS_QUEUE` is undefined). So every analysis falls back to `waitUntil`, which is fine for fast jobs but unsafe for a multi-minute Gemini call.

Likely reasons (need to verify):
1. The queue `tapecoach-analysis-jobs` doesn't exist yet in the Cloudflare account that owns the deployment, so the binding silently fails to attach.
2. The deployment platform (Lovable Cloud worker) doesn't honour the `queues.producers` block in `wrangler.jsonc` for this project, so the binding never gets injected.
3. A recent deploy went out without the binding refreshed.

## Plan

1. **Confirm the binding state** — read `wrangler.jsonc` and `src/server/analysis-job-queue.server.ts` to see exactly what the code expects, and check whether the queue is actually provisioned (this may need a Cloudflare/Lovable infra step).
2. **Short-term mitigation in code** — make the `waitUntil` fallback safer for long Gemini calls:
   - Keep the take heartbeat alive (`updated_at` ping every ~30s) while Step 2 runs, so the 180s reconciler doesn't kill an in-flight analysis.
   - Add a hard timeout + clear failure code around the Step 2 Gemini call so we surface "model timeout" instead of `analysing_orphan` when it really did hang.
3. **Long-term fix** — get the queue binding wired so the producer actually enqueues and the consumer in `src/worker-entry.ts queue()` handles the job (durable, retried, not bound to a request's lifetime). This is the only way a 60-120s Gemini call is reliable.
4. **Verify** — trigger a fresh upload, confirm logs show `dispatch_method: queue` (not `wait_until_fallback`), and that the take reaches `complete`.

## Technical details

- Producer call site: `src/server/analysis-job-queue.server.ts` (checks `env.ANALYSIS_QUEUE` and falls back to `waitUntil` when missing)
- Consumer: `src/worker-entry.ts` `queue()` handler → `runProcessTake`
- Reconciler thresholds: `ANALYSING_ORPHAN_MS = 180_000` in `src/server/finalising-recovery.server.ts`
- Failed take for repro: `8911ce0c-c681-45e2-9aa9-f0d4b359a424` (already force-errored)

## Open question for you

Before I implement, one decision: do you want me to

**(A)** just add the heartbeat + timeout mitigation (so waitUntil mode doesn't get killed prematurely and we get a real error code), and you handle the queue-binding infra side separately, or

**(B)** also dig into why `env.ANALYSIS_QUEUE` is undefined despite the `wrangler.jsonc` entry (may require checking with Lovable infra / provisioning the queue), or

**(C)** both?