# Runbook: Owned Supabase cutover checklist

Owned Supabase is the system of record (see
[ADR-0002](../adr/0002-platform-portability-and-lovable-exit-path.md)). Use this
checklist when verifying the owned project is authoritative for the analysis/report
pipeline and the dedicated analysis Worker.

## Environment ownership

- [ ] Server admin uses the owned **TAPECOACH\_** pair:
      `TAPECOACH_SUPABASE_URL` (variable) + `TAPECOACH_SUPABASE_SERVICE_ROLE_KEY` (secret).
- [ ] Legacy `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are dev/local fallbacks
      only and are NOT mixed with the TAPECOACH pair. The Cloudflare env mapper
      excludes the legacy names entirely (Worker fails safe).
- [ ] Browser/public client uses only `VITE_SUPABASE_*`. The service-role key is
      never exposed to client/browser code.
- [ ] Full var/secret split per [env-vars.md](../../../env-vars.md) and ADR-0003.

## Health check (Lovable app, server-only)

```bash
curl -sS -X POST https://<lovable-domain>/api/internal/cutover-health \
  -H "Authorization: Bearer $CUTOVER_HEALTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"admin_email":"o.halawi90@gmail.com"}'
```

- [ ] `owned_supabase.admin_client = ok`, core tables `ok`, private buckets
      `audition-videos` + `qa-artifacts` present.
- [ ] `secrets_present` booleans true for the owned pair, QA bucket/sink, Mux.
- [ ] `analysis_runtime` block reflects the intended execution mode + readiness.
- [ ] Response returns booleans/safe host only — never secret values, service-role
      keys, Mux tokens, signed URLs, or raw stack traces.

## Storage

- [ ] `qa-artifacts` and `audition-videos` buckets exist and are private in the
      owned project. `QA_ARTIFACT_STORAGE_BUCKET=qa-artifacts`, `QA_ARTIFACT_SINK=storage`.

## Worker parity

- [ ] The dedicated analysis Worker resolves the same owned Supabase project
      (its `TAPECOACH_SUPABASE_URL` variable matches). Run the
      [worker analysis smoke test](./worker-analysis-smoke-test.md).

## Verification rule

If deployed environment values cannot be inspected directly, report
`operator-verification-required` rather than guessing or blocking unrelated work.
