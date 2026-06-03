# Runbook: Dedicated Analysis Worker smoke test

Verifies the dedicated Cloudflare analysis Worker (`analysis-worker/`) is built,
configured, and able to run a real take end-to-end against owned Supabase via
OpenRouter. See [ADR-0003](../adr/0003-dedicated-cloudflare-analysis-worker.md).

## 0. Pre-req: one-consumer rule

Confirm **only** `tapecoach-analysis-worker` (deployed from
`analysis-worker/wrangler.jsonc`) consumes `tapecoach-analysis-jobs`. The app
Worker must not be attached as a consumer.

## 1. Local bundle check

```bash
npm run dry-run:analysis-worker
```

Expect: succeeds, no `Could not resolve "tanstack-start-*"` errors. (The
bundleability guard test also asserts the Worker imports nothing TanStack/UI-bound.)

## 2. Deploy

In Cloudflare → Workers Builds for `tapecoach-analysis-worker`, deploy command
`npm run deploy:analysis-worker`. Ensure variables + secrets are set per ADR-0003.

## 3. Health

```bash
curl -s https://tapecoach-analysis-worker.<subdomain>.workers.dev/health | jq
```

Expect `ok:true` and `{ execution_mode:"direct_openrouter", queue_binding_available:true,
supabase_env_present:true, openrouter_key_present:true, mux_env_present:true,
qa_bucket_configured:true }`. No secret values in the response.

## 4. Dispatch → queue → analysis

Trigger a real take from the app (upload → Mux ready → app dispatches to
`ANALYSIS_DISPATCH_URL` = `/dispatch-analysis`). Or manually:

```bash
curl -s -X POST https://tapecoach-analysis-worker.<subdomain>.workers.dev/dispatch-analysis \
  -H "Authorization: Bearer $ANALYSIS_DISPATCH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"take_id":"<take-uuid>","reason":"mux_asset_ready"}'
```

Expect `{ ok:true, dispatch_method:"queue", queued:true, take_id:"<...>" }`.

## 5. Confirm completion in owned Supabase

The take row should transition `processing → complete` (or a safe `error` with a
`[failure_code:...]` message), with `report`, `scores`, and QA artefacts written.
The Lovable UI should render the report from owned Supabase.

## Pass criteria

- Bundle builds TanStack-free; health green; one full take completes or
  safe-errors with persisted diagnostics; no secret leakage; queue not consumed
  by the app Worker.

## Failure triage

- `analysis_direct_mode_not_ready` from `/dispatch-analysis` → a required var/secret
  is missing (check `/health` booleans).
- Bundling error on virtual modules → something re-introduced a TanStack/app import
  into the Worker graph; run the bundleability guard test.
