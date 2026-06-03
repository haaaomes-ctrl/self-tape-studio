# TapeCoach Architecture

Authoritative record of TapeCoach's runtime topology, ownership boundaries, and
deployment decisions. **Read this before changing topology, runtime, deployment,
queue wiring, or where analysis executes.**

## Current topology (summary)

```
Performer / operator
      │
      ▼
Lovable / TanStack app Worker ............ UI, editor, dashboard, upload flow,
      │     (NOT the analysis runtime)      auth/compliance, Mux webhook receive,
      │                                      analysis dispatch, report viewing
      │  POST /dispatch-analysis (Bearer ANALYSIS_DISPATCH_SECRET)
      ▼
Dedicated Cloudflare Analysis Worker ..... analysis-worker/  (durable runtime)
      │   • POST /dispatch-analysis  → enqueue
      │   • tapecoach-analysis-jobs  → producer + the ONLY consumer
      │   • direct_openrouter        → runAnalysisJob via OpenRouter
      ▼
Owned Supabase ........................... system of record: DB, auth, storage,
                                            qa-artifacts, report/status state
```

- **OpenRouter** — AI model gateway used by the Worker-run analysis.
- **Mux** — video upload / transcoding / playback / signed media.

## Decision records (ADRs)

- [ADR-0001 — Durable Analysis Runtime](./adr/0001-durable-analysis-runtime.md)
- [ADR-0002 — Platform Portability & Lovable Exit Path](./adr/0002-platform-portability-and-lovable-exit-path.md)
- [ADR-0003 — Dedicated Cloudflare Analysis Worker](./adr/0003-dedicated-cloudflare-analysis-worker.md)
- [ADR-0004 — Lovable Cloud Exit & Clean Owned-Supabase Cutover](./adr/0004-lovable-cloud-exit-clean-cutover.md)

## Runbooks

- [Worker analysis smoke test](./runbooks/worker-analysis-smoke-test.md)
- [Owned Supabase cutover checklist](./runbooks/owned-supabase-cutover-checklist.md)

## Invariants (do not break without a new ADR)

- Only **one** Worker may consume `tapecoach-analysis-jobs` — the dedicated
  analysis Worker (`analysis-worker/`). The app Worker must not be the active consumer.
- The analysis Worker must stay **TanStack-free** (no `@tanstack/react-start`,
  routes, `routeTree`, React, UI components, `V2ReportView`, or `createServerFn`).
- No `ANALYSIS_RUN_ENDPOINT` / `ANALYSIS_RUN_SECRET` and no Worker→Lovable bridge.
- No changes to S10 prompts, report schemas, scoring, report UI, canaries, or
  report wording as part of runtime/topology work.
- Supabase service-role key is a **secret**; `TAPECOACH_SUPABASE_URL` is a
  non-secret variable. See [env-vars.md](../../env-vars.md).
