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

## Secret Names

Document names only. Do not print, paste, log or commit secret values.

```text
RECONCILER_SECRET
ANON_SESSION_SECRET
MUX_TOKEN_ID
MUX_TOKEN_SECRET
MUX_WEBHOOK_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

## Verification Rule

If deployed environment values cannot be inspected directly, report `operator-verification-required` rather than guessing or blocking unrelated repository work.
