# TapeCoach QA Environment Variables (Setup Task 1)

This file documents expected QA env names and values for Setup Task 1 verification only.
Do not print secret values.

## Expected QA env values
- `INTERNAL_COMPARISON_TRIGGER_ENABLED=true`
- `QA_ARTIFACT_SINK=storage`
- `QA_ARTIFACT_STORAGE_BUCKET=qa-artifacts`
- `QA_ARTIFACT_LOG_FALLBACK=true`
- `V3_QA_ARTIFACTS_ENABLED=true`
- `INTERNAL_QA_EMIT=true`
- `TWO_STEP_ANALYSIS_ENABLED=true`

## Secret names (names only)
- `RECONCILER_SECRET`
- `ANON_SESSION_SECRET`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`

## Verification rule
If deployed environment variables cannot be directly inspected in the current execution context, report:
`operator-verification-required`.

Never infer, print, or expose secret values in logs, scripts, CI output, or docs.
