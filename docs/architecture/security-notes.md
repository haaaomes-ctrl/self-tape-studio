# Security Notes — Intentional Posture

Record of deliberate security decisions so future advisor runs and audits can
distinguish "accepted by design" from "needs fixing". Last verified against
the live database: 2026-06-05.

## RLS enabled with no policies = deny-all by design

Supabase advisors flag tables that enable RLS but define no policies
("RLS enabled, no policy"). For the tables below this is **intentional**:
no policies means every anon/authenticated request is denied, and only the
service role (which bypasses RLS) can touch them. They are server-owned
system-of-record tables, written exclusively through server code or
SECURITY DEFINER RPCs.

```text
admin_audit_log                          analytics_events
analytics_user_attribution               app_config
consumer_credit_payments                 consumer_credit_products
consumer_credit_revenue_ledger_entries   credit_grants
credit_ledger_entries                    crm_contacts
partner_codes                            partner_credit_allocations
partner_credit_pool_events               partner_credit_pools
partner_memberships                      partner_package_presets
partner_usage_alerts                     partner_visibility_acceptances
partners                                 quota_exempt_users
report_credit_reservations               take_ai_usage
take_qa_traces
```

Adding a client-facing policy to any of these is a security decision, not a
cleanup — treat advisor warnings on them as acknowledged.

## pg_net in the public-adjacent schema — accepted WARN

The `pg_net` extension lives where the original Lovable migration installed
it. Relocating extensions is invasive and would break the pg_cron jobs that
call `net.http_post` (e.g. the every-minute `reconcile-stale-takes` job).
Accepted as a WARN-level advisor finding; do not action without a migration
plan that re-points every `net.*` caller.

## Email-queue RPCs — service-role only (since 2026-06-05)

`enqueue_email`, `read_email_batch`, `delete_email` and `move_to_dlq` are
SECURITY DEFINER wrappers over pgmq. Client EXECUTE (anon/authenticated/
PUBLIC) was revoked in migration `20260605130000` after a caller audit
confirmed only service-role server code invokes them. All four (plus the
analytics/crm/cost helpers) have pinned `search_path`
(migration `20260605130500`).

## list_free_credit_due_users — service-role only by design

SECURITY DEFINER candidate-selection helper for free-credit issuance
(migration `20260605150000`): reads `auth.users` minus `quota_exempt_users`
to find users due a free credit. `search_path` pinned, EXECUTE revoked from
anon/authenticated/PUBLIC, granted to service_role only — it is called
solely by the secret-gated `/api/public/free-credit-reconcile` endpoint. It
SELECTs candidates only; granting happens app-side (ADR-0005).

## record_analytics_event — anon-callable by design

This is the client analytics ingest path and stays executable by anon and
authenticated. Its abuse posture: event names, consent states and object
types are validated against fixed whitelists (unsupported values raise),
properties must be a JSON object, free text passes through
`analytics_safe_text` truncation, and `search_path = public` is already
pinned. Acceptable for unauthenticated ingest; revisit only if event-spam
becomes a cost issue (rate limiting would be the next step, not a REVOKE).

## Tracked .env — public values only

`.env` is tracked deliberately: full git history was audited (2026-06-05)
and it has only ever contained the public Supabase client values
(URL / publishable key / project id), which ship in the browser bundle
anyway. It is maintained by the Lovable sync — do not untrack it without
checking that sync. Real secrets live in the Lovable app env, Cloudflare
Worker secrets and Supabase Vault. Local overrides go in `.env.local` /
`.env.*.local` (gitignored); `.env.example` documents the full name surface.

## Out-of-repo items (operator-owned)

- Supabase Auth **leaked-password protection** toggle: dashboard-only;
  pending operator action.
- Secret **values** (Vault entries, app env, Worker secrets): never set,
  printed or rotated from this repo.
