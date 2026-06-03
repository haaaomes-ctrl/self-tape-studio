# ADR-0004: Lovable Cloud Exit & Clean Owned-Supabase Cutover

## Status

Accepted (2026-06-03). Operationalises [ADR-0002](./0002-platform-portability-and-lovable-exit-path.md) and depends on the [owned Supabase cutover checklist](../runbooks/owned-supabase-cutover-checklist.md).

## Context

ADR-0002 declared owned Supabase the system of record and committed to keeping the Lovable exit cheap. In practice the deployed app still has a split-brain: Lovable Cloud remains linked to an inaccessible managed Supabase project (`nefojirfnzomkearyoji`), while the owned project (`sdsrmeomaafvuhdedlnl`) is the intended authoritative backend.

Symptom: an upload reached `upload_url_requested` and the server function returned 200, yet the user still saw `POLICY_ACCEPTANCE_REQUIRED`. That is the signature of the browser client resolving one Supabase project (Cloud `VITE_SUPABASE_*`) while the server/admin path checks another (owned `TAPECOACH_SUPABASE_*`).

Constraints:

- This is a test environment. There is no production data or user accounts to preserve.
- Lovable Cloud cannot be disconnected once connected, and a Lovable-published build stays bound to the Cloud database regardless of owned env values.
- Cloud to Supabase export is manual: schema and storage buckets come via SQL migrations, but auth providers, secrets, table data, storage files and user accounts do not.

## Decision

Perform a **clean cutover, not a data migration**. Rebuild the owned Supabase project from repo migrations and point every runtime at it; treat all locked Cloud data as disposable test data.

Binding cutover requirements (these extend the TC-CUTOVER Monday items):

1. **Single authoritative backend.** Owned project `sdsrmeomaafvuhdedlnl` is the only durable store. No upload/report/worker/payments path may write durable state to `nefojirfnzomkearyoji`.
2. **Env ownership across all three runtimes.** Browser build uses owned `VITE_SUPABASE_*`; server/admin uses owned `TAPECOACH_SUPABASE_URL` + `TAPECOACH_SUPABASE_SERVICE_ROLE_KEY`; the Cloudflare analysis Worker resolves the same owned project. Legacy `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are dev/local fallbacks only. Service-role keys never reach browser/`VITE_*` code.
3. **Auth re-config is explicit and manual.** Configure the owned project's Auth: Site URL and redirect/allow-list URLs, email templates, JWT settings, and any OAuth providers. Auth does not come across via SQL migrations.
4. **Full secret inventory present in the serving runtime.** Beyond Supabase, the owned runtime must hold the non-Supabase secrets the cutover smoke test exercises and the product needs: `MUX_*`, `STRIPE_*`, `OPENROUTER_*`, email/Brevo, `CUTOVER_HEALTH_SECRET`, `ANALYSIS_DISPATCH_*`. Documented by name only (see `env-vars.md`); never committed.
5. **Lovable AI gateway is a residual Cloud dependency.** The analysis provider defaults to the Lovable AI gateway unless `OPENROUTER_API_KEY` is set. A literal "off Lovable Cloud" posture requires OpenRouter configured on the Worker. This is out of scope for the TC-CUTOVER-01..05 upload critical path and is tracked as a follow-up, not a blocker.
6. **Supabase Edge Functions check.** Confirm the owned project depends on no Supabase Edge Functions (server logic lives in the Lovable app shell + the Cloudflare Worker). If any exist, they require manual redeploy + secrets. Expected: N/A.
7. **Verification gate.** Cutover is "done" only when the owned-Supabase cutover-health check is green, the Worker analysis smoke test passes, and one fresh user completes sign-up to account compliance to audition to Mux upload-URL creation on the owned project.

Sequencing: TC-CUTOVER-01 to 02 to 03 to 04 to 05 is the critical path. Storage buckets (04) must exist before the smoke test (05); either complete bucket creation within the 02 baseline or gate 05 on 04. The admin dashboard (TC-ADMIN-\*) follows but must not delay the cutover.

## Consequences

- The deployed app, server/admin path, and analysis Worker resolve a single owned Supabase project, removing the split-brain and the misleading compliance error.
- Owning auth, storage and secrets directly is now an operator responsibility (no Lovable-managed fallback).
- **Frontend hosting independence is a separate, later phase.** This ADR delivers "own your data"; the app continues to publish via Lovable (`tapecoach.lovable.app`) until hosting is moved (e.g. Cloudflare Pages/Workers). While the frontend publishes through Lovable, owned `VITE_*` values must be verified to win at build time, or the split-brain can reopen.

## Non-Goals

- No data migration from the locked Cloud project.
- No change to S10 prompts, report schemas, scoring, report UI, canaries, or report wording.
- No frontend hosting migration in this slice.
