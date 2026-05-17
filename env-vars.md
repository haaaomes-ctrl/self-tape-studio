# TapeCoach QA Environment Variables

This file documents expected QA environment variable names and secret names. It must not contain secret values.

## Expected QA Runtime Values

The current deployed QA configuration should use:

```text
INTERNAL_COMPARISON_TRIGGER_ENABLED=true
QA_ARTIFACT_SINK=storage
QA_ARTIFACT_STORAGE_BUCKET=qa-artifacts
QA_ARTIFACT_LOG_FALLBACK=true
V3_QA_ARTIFACTS_ENABLED=true
INTERNAL_QA_EMIT=true
TWO_STEP_ANALYSIS_ENABLED=true
```

If Codex or another source-level agent cannot inspect deployed environment variables directly, report `operator-verification-required` rather than blocking implementation.

## Secret Names

The following names may exist in deployment or GitHub secret stores. Do not print their values in logs, tests, PRs or issue comments:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `QA_ARTIFACT_STORAGE_ACCESS_KEY`
- `QA_ARTIFACT_STORAGE_SECRET_KEY`

## Safe Provenance Values

The QA artefact system may record safe non-secret provenance values when available, such as build commit SHA, source branch and deployment revision. Unknown safe provenance must not block artefact emission.
