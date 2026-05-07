# Flip v2 rollout flags in production

Enable all three future-state flags on the `app_config` singleton so the next take submitted via the live Mux webhook persists as `schema_version: "v2-component"`, writes a QA trace row, and emits Step 1 component evidence.

## Changes

1. **Data update on `public.app_config`** (singleton row), via the data-update tool (not a schema migration):
   ```sql
   UPDATE public.app_config
   SET future_evidence_enabled  = true,
       future_report_enabled    = true,
       future_qa_trace_enabled  = true,
       updated_at               = now()
   WHERE id = 'singleton';
   ```
   Effect: `getResolvedConfig()` will return all three flags as `true` on the next read; the dedupe logger will emit one fresh `[quota] config_resolved` line.

2. **`TWO_STEP_ANALYSIS_ENABLED`** is an environment variable on the worker, not a column in `app_config`. It cannot be set from this side. You will need to set it to `true` in the production worker environment yourself (Lovable Cloud → project env). I will flag this as an operator action in the closing note rather than attempting it from here.

## Out of scope

- No code changes.
- No schema migration.
- No real takes submitted; that is the operator's next step to populate §§4–10 of the hidden-prod QA report.
- No change to quotas, weights, blockers, role-fit bounds, RLS, or the Mux/webhook flow.

## Post-flip verification (read-only, after you approve)

- Re-read `app_config` to confirm the three flags are `true`.
- Confirm zero `takes.report.schema_version = "v2-component"` rows still exist (baseline before submissions).
- Remind you to (a) set `TWO_STEP_ANALYSIS_ENABLED=true` in the worker env, and (b) submit one MT brief-mode take and one Acting baseline take through the live Mux webhook so §§4–11 of `.lovable/plan.md` can be populated.

## Rollback

Single statement: `UPDATE public.app_config SET future_evidence_enabled=false, future_report_enabled=false, future_qa_trace_enabled=false WHERE id='singleton';`. Existing v2 rows continue to render via the persisted `schema_version`; no schema changes to undo.
