# TapeCoach QA Environment Variables

This file documents expected QA environment values and secret names for operator verification. It does not change deployed environment configuration.

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
```

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
