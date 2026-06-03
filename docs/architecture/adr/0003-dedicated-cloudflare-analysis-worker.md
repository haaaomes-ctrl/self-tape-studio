# ADR-0003: Dedicated Cloudflare Analysis Worker

## Status

Accepted (2026-06-03). Refines the topology of
[ADR-0001](./0001-durable-analysis-runtime.md).

## Context

ADR-0001 decided the durable analysis runtime should run on Cloudflare. The first
attempt put a `queue` handler on the TanStack/Lovable **app** Worker
(`src/worker-entry.ts`). That cannot ship:

- The app is deployed via Nitro's `cloudflare-module` preset, which generates its
  own entry and ignores `src/worker-entry.ts`; its Cloudflare `queue` delivery
  goes to a `cloudflare:queue` Nitro hook that our consumer was never wired to.
- Deploying `src/worker-entry.ts` with plain `wrangler deploy` fails because it
  statically imports `@tanstack/react-start/server-entry`, whose virtual modules
  (`tanstack-start-manifest:v`, `tanstack-start-injected-head-scripts:v`,
  `#tanstack-router-entry`, …) only the TanStack/Vite plugin can resolve.

So the app-deploy path and the queue-consumer path are different worlds. Making
one full-stack Worker be both is high-risk and unnecessary.

## Decision

Run the durable analysis runtime as a **separate, dedicated Cloudflare Worker**.

- The dedicated analysis Worker lives under **`analysis-worker/`** (`index.ts` +
  `wrangler.jsonc`) in this repo, so it shares the server-only S10 pipeline
  modules without duplication.
- It must remain **TanStack-free**: it must not import `@/worker-entry`,
  `src/routes/**`, `routeTree`, `@tanstack/react-start`, `@tanstack/react-router`,
  `react`/`react-dom`, `src/components/**`, `V2ReportView`, or `createServerFn`
  wrappers. A unit "bundleability guard" test enforces this, and plain
  `wrangler deploy` bundles it (proven by `npm run dry-run:analysis-worker`).
- It owns: `POST /dispatch-analysis` (authenticated enqueue), the
  `tapecoach-analysis-jobs` **producer and the only consumer**, and
  `direct_openrouter` execution of `runAnalysisJob` writing report/status/QA
  artefacts to owned Supabase. It also exposes `GET /health` (safe readiness).
- The runtime-env AsyncLocalStorage helpers were extracted from
  `src/worker-entry.ts` into a TanStack-free `src/server/runtime-env-als.server.ts`
  so both Workers resolve the Cloudflare `env` binding without importing the app.
- Lovable dispatches to the Worker via the existing `ANALYSIS_DISPATCH_URL`
  (→ `/dispatch-analysis`). No app code change; no Worker→Lovable bridge.

### Operational rules (binding)

- The **app Worker may keep its old `src/worker-entry.ts` queue handler
  temporarily**, but it **must not be attached as the `tapecoach-analysis-jobs`
  consumer**.
- **Only one Worker may consume `tapecoach-analysis-jobs`** — the dedicated
  analysis Worker.
- Cloudflare **Workers Builds for `tapecoach-analysis-worker` must deploy
  `analysis-worker/wrangler.jsonc`** — deploy command `npm run deploy:analysis-worker`
  (`wrangler deploy -c analysis-worker/wrangler.jsonc`).
- **Only `analysis-worker/wrangler.jsonc` may target the `tapecoach-analysis-worker`
  service.** To remove the overwrite footgun, the root `wrangler.jsonc` is
  **neutralised**: it uses a distinct, clearly-unused service name
  (`tapecoach-app-worker-unused`), not `tapecoach-analysis-worker`, and declares
  **no queue producer/consumer bindings**. It must not be deployed to the analysis
  service. (`src/worker-entry.ts`'s `queue` handler is left as dead/transitional
  code only — not attached to any queue.)
- `ANALYSIS_RUN_ENDPOINT` and `ANALYSIS_RUN_SECRET` are **not** part of this
  architecture and must not be reintroduced.

### Cloudflare configuration

Variables (non-secret): `ANALYSIS_EXECUTION_MODE=direct_openrouter`,
`TAPECOACH_SUPABASE_URL`, `QA_ARTIFACT_STORAGE_BUCKET=qa-artifacts`,
`QA_ARTIFACT_SINK=storage`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_TITLE`,
`S10_MODEL_STEP1/STEP2/RECOVERY`, plus the analysis feature flags
`process-take.server` reads via `process.env` (Cloudflare populates `process.env`
from vars under `nodejs_compat`): `TWO_STEP_ANALYSIS_ENABLED=true`,
`V3_QA_ARTIFACTS_ENABLED=true`, `INTERNAL_QA_EMIT=true`,
`QA_ARTIFACT_LOG_FALLBACK=true`, `INTERNAL_COMPARISON_TRIGGER_ENABLED=true`
(match env-vars.md's expected QA values, else the worker runs degraded:
single-step, no QA).

Secrets: `TAPECOACH_SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`,
`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `ANALYSIS_DISPATCH_SECRET`,
`RECONCILER_SECRET`. (`TAPECOACH_SUPABASE_URL` is a variable, not a secret.)

## Consequences

- The app deploy (Lovable/Nitro) and the analysis Worker deploy are independent;
  each builds cleanly on its own path.
- Direct OpenRouter analysis runs in the Worker against owned Supabase, off the
  Lovable request lifetime.

## Cleanup item (later slice)

Once the dedicated Worker is proven in production, retire `src/worker-entry.ts`'s
`queue` handler and the root `wrangler.jsonc` queue producer/consumer bindings so
there is a single, unambiguous analysis-runtime entry.

## Non-Goals

No change to S10 prompts, report schemas, scoring, report UI, canaries, or report
wording.
