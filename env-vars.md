# TapeCoach QA Environment Variables

This file documents expected QA environment values and secret names for operator verification. It does not change deployed environment configuration.

For runtime ownership/boundaries (which Worker owns what, the variable-vs-secret split, and the dedicated Cloudflare analysis Worker's Cloudflare config), see `docs/architecture/` — ADR-0003 and the cutover checklist runbook.

## Expected QA Values

```text
INTERNAL_COMPARISON_TRIGGER_ENABLED=true
QA_ARTIFACT_SINK=storage
QA_ARTIFACT_STORAGE_BUCKET=qa-artifacts
QA_ARTIFACT_LOG_FALLBACK=true
V3_QA_ARTIFACTS_ENABLED=true
INTERNAL_QA_EMIT=true
TWO_STEP_ANALYSIS_ENABLED=true
```

`QA_ARTIFACT_STORAGE_BUCKET` is the Supabase Storage bucket id. It must be `qa-artifacts` for the standard TapeCoach admin storage lane; do not set it to a boolean feature-flag value such as `true`.

## Owned Supabase Runtime

Lovable reserves the `SUPABASE_` secret prefix. For server-side writes to the owned Supabase project, configure these server-only secrets in Lovable:

```text
TAPECOACH_SUPABASE_URL
TAPECOACH_SUPABASE_SERVICE_ROLE_KEY
CUTOVER_HEALTH_SECRET
```

The server admin client prefers `TAPECOACH_SUPABASE_URL` and `TAPECOACH_SUPABASE_SERVICE_ROLE_KEY`. Legacy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supported only as local/dev/backward-compatible fallbacks.

The browser/public Supabase client must use only Vite public env:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Never expose `TAPECOACH_SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.

## Secret Names

Document names only. Do not print, paste, log or commit secret values.

```text
TAPECOACH_SUPABASE_URL
TAPECOACH_SUPABASE_SERVICE_ROLE_KEY
RECONCILER_SECRET
CUTOVER_HEALTH_SECRET
ANON_SESSION_SECRET
MUX_TOKEN_ID
MUX_TOKEN_SECRET
MUX_WEBHOOK_SECRET
ANALYSIS_DISPATCH_URL
ANALYSIS_DISPATCH_SECRET
ANALYSIS_RUN_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
OPENROUTER_API_KEY
```

## OpenRouter Analysis Provider

OpenRouter is optional for this slice. The existing Lovable AI gateway remains the default analysis provider unless `OPENROUTER_API_KEY` is explicitly configured in server/runtime env.

Document names only. Do not print, paste, log or commit secret values.

```text
OPENROUTER_API_KEY
OPENROUTER_SITE_URL
OPENROUTER_APP_TITLE
S10_MODEL_STEP1
S10_MODEL_STEP2
S10_MODEL_RECOVERY
```

`OPENROUTER_SITE_URL` maps to the optional `HTTP-Referer` header. `OPENROUTER_APP_TITLE` maps to the optional `X-OpenRouter-Title` header. Model names are server/runtime configuration for the S10 evidence, report-polish and recovery calls respectively.

## Analysis Runtime Env (runtime-neutral)

`src/server/analysis-runtime-env.server.ts` defines a server-only, runtime-neutral
contract (`AnalysisRuntimeEnv`) so the analysis pipeline can receive its
configuration through a single injected object in either the Lovable runtime or the
Cloudflare Worker runtime. It is server-only and must never be imported by
browser/client code.

Document names only. Do not print, paste, log or commit secret values.

```text
TAPECOACH_SUPABASE_URL
TAPECOACH_SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
OPENROUTER_SITE_URL
OPENROUTER_APP_TITLE
S10_MODEL_STEP1
S10_MODEL_STEP2
S10_MODEL_RECOVERY
MUX_TOKEN_ID
MUX_TOKEN_SECRET
MUX_WEBHOOK_SECRET
QA_ARTIFACT_STORAGE_BUCKET
QA_ARTIFACT_SINK
```

- `resolveAnalysisRuntimeEnv` inspects runtime env safely and returns nullable
  values plus boolean-only diagnostics (safe Supabase host only; never secret values).
- `requireAnalysisRuntimeEnv` is the strict guard for the **future direct Worker
  analysis runtime**. It requires the owned Supabase pair and `OPENROUTER_API_KEY`,
  because the durable Worker runner uses OpenRouter as its transport.
  `OPENROUTER_API_KEY` is **not** required for the current Lovable-managed AI path,
  which keeps the Lovable AI gateway as its default provider. `requireAnalysisRuntimeEnv`
  is not wired into any current production analysis path yet.
- `mapCloudflareEnvToAnalysisRuntimeEnvInput` maps a Cloudflare Worker `env` binding
  into the contract by extracting only the known keys above. It never reads
  `process.env`. It deliberately does **not** extract the legacy `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` names: those are dev/local fallbacks only, so a Worker
  configured with just the legacy pair fails safe (the strict guard throws) instead
  of resolving to the legacy Supabase project. Configure the owned `TAPECOACH_SUPABASE_*`
  pair on the Worker binding.

## Owned Supabase Cutover Health

The Lovable → owned Supabase cutover health check is server-only and protected by `CUTOVER_HEALTH_SECRET`:

```text
POST /api/internal/cutover-health
Authorization: Bearer CUTOVER_HEALTH_SECRET
```

It returns safe status JSON only: Supabase host, env presence booleans, core table checks, private storage bucket checks for `audition-videos` and `qa-artifacts`, optional admin-user/account-compliance status, and Mux env presence booleans. It must never return secret values, service-role keys, Mux tokens, signed URLs or raw stack traces.

Post-deploy check:

```bash
curl -sS -X POST https://<lovable-domain>/api/internal/cutover-health \
  -H "Authorization: Bearer $CUTOVER_HEALTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"admin_email":"o.halawi90@gmail.com"}'
```

## External Analysis Worker Dispatch

`ANALYSIS_DISPATCH_URL` enables server-side dispatch to the external Cloudflare analysis Worker. When this URL is configured, TapeCoach treats the external Worker as the authoritative analysis dispatch path and must not silently fall back to request `waitUntil` if dispatch fails.

Do not configure `ANALYSIS_DISPATCH_URL` for production uploads until the external Worker `/health` response confirms:

```json
{
  "queue_binding_available": true,
  "analysis_run_endpoint_configured": true
}
```

`queue_binding_available=true` alone proves queue dispatch only. It does not prove live analysis completion. External dispatch success means the job was queued, not that the tape was analysed.

If `ANALYSIS_RUN_ENDPOINT` points back to Lovable, treat that as a bridge only; Lovable request lifetime limits may still apply to long Gemini/finalising work. The durable target is either a Cloudflare Queue consumer that runs the real S10 analysis code directly, or a backend that supports long-running analysis jobs.

`ANALYSIS_RUN_SECRET` protects TapeCoach's internal analysis runner endpoint. Configure the external Worker `ANALYSIS_RUN_ENDPOINT` to call:

```text
POST /api/internal/run-analysis
Authorization: Bearer ANALYSIS_RUN_SECRET
```

The internal endpoint is a Stage 2 bridge into the existing TapeCoach `runProcessTake` path. It returns `mark_complete=false` because TapeCoach owns report/status persistence. After deployment, run one full-length Professional take through the queue; if Lovable request limits still terminate the run, Stage 3 is to move the real runner into Cloudflare or another durable long-running backend.

## Verification Rule

If deployed environment values cannot be inspected directly, report `operator-verification-required` rather than guessing or blocking unrelated repository work.
