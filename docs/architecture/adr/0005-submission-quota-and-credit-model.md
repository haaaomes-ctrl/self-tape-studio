# ADR-0005: Submission Quota and Credit Model

## Status

Accepted (2026-06-05). Complements the runtime topology in
[ADR-0003](./0003-dedicated-cloudflare-analysis-worker.md) and the cutover
posture in [ADR-0004](./0004-lovable-cloud-exit-clean-cutover.md): those ADRs
say where analysis runs; this ADR says what governs **how much** a user may
run.

## Decision

**Credits are the sole usage governor.** Every generated report consumes
exactly one credit (`REPORT_CREDIT_AMOUNT = 1`, `src/lib/credit-ledger.ts:30`),
reserved before upload/retry via `reserve_report_credit_for_take` and consumed
only after the report persists. There is no free tier beyond the two free
credit sources below, and there is **no active per-user daily submission cap**
— the daily-cap machinery exists but is switched off (see "Dormant machinery").

### The credit model (confirmed from code, 2026-06-05)

| Source                                                                                     | Amount          | Policy (from code)                                                                                                                                                        | Issuance                                                                                         |
| ------------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `free_signup`                                                                              | 1 credit        | rollover, no expiry (`resolveCreditGrantPolicy`, `src/lib/credit-ledger.ts:201`)                                                                                          | One per account at sign-up                                                                       |
| `free_monthly`                                                                             | 1 credit        | **no rollover**, expires 31 days after grant (`FREE_MONTHLY_CREDIT_VALIDITY_DAYS = 31`, `src/lib/credit-ledger.ts:29`; DB constraint `credit_grants_free_monthly_expiry`) | One per account per month                                                                        |
| `user_paid`                                                                                | per product SKU | rollover, never expires (DB constraint `credit_grants_user_paid_rollover`)                                                                                                | Automated: Stripe checkout webhook → `complete_consumer_credit_payment` → `grant_funded_credits` |
| `school_funded` / `coach_funded` / `agent_funded` / `platform_funded` / `sponsor_campaign` | per allocation  | funding-period expiry where set                                                                                                                                           | Partner credit-pool allocation RPCs                                                              |
| `admin_grant`                                                                              | per grant       | per grant                                                                                                                                                                 | Manual only: `admin_grant_user_credits` (requires ≥12-char `admin_reason`, audited)              |

**Free-source issuance (wired 2026-06-05; Monday 2969404421):** the
`free_signup` and `free_monthly` semantics above are fully encoded — source
enums, grant-policy code, DB constraints, balance/snapshot UI copy, and the
CRM emails (`free_report_available`, `monthly_free_report`). Issuance is
**lazy and app-side**: `reconcileFreeCreditsForUser`
(`src/server/free-credit-issuance.server.ts`) runs at dashboard load
(`getCreditBalance`) and at the report-reservation choke point
(`reserveReportCreditForTake`), plus a daily pg_cron job that calls the
secret-gated `/api/public/free-credit-reconcile` endpoint for dormant users
(candidates pre-filtered by the service-role `list_free_credit_due_users`
helper). All grants flow through the idempotent `grant_funded_credits` RPC
via the TS wrapper `grantFundedCredits`
(`src/server/credit-ledger.server.ts`).

**Why app-side, not a DB trigger/SQL cron:** the CRM emails are rendered and
enqueued by the TS wrapper — a SQL-level grant cannot send them, and the lazy
hooks fire at the only moments a credit can be spent. (An `auth.users`
trigger would additionally need GoTrue-role EXECUTE plumbing, but the email
constraint is the deciding reason.) The monthly grant still issues when the
lifecycle email is consent-suppressed — grant ≠ email. The
`free_monthly_includes_funded_users` toggle in `app_config` (default true)
controls whether holders of ACTIVE paid/funded credits also receive the
monthly allowance.

**Cadence anchor (load-bearing; fixed 2026-06-05 after a live double-grant,
PR #195):** the monthly allowance is anchored on the most recent free-tier
grant of EITHER source. `free_monthly` is due only when a `free_signup`
grant already exists AND no free-tier grant (`free_signup` OR
`free_monthly`) was issued in the last 31 days — and the signup pass itself
never grants monthly. Net invariant: **a fresh account receives exactly ONE
credit at signup**, with the monthly allowance first due ~31 days after the
signup grant and every 31 days from the last free-tier grant thereafter.
Keying the monthly gate on `free_monthly` history alone reintroduces the
signup double-grant — the rule lives in BOTH deciders
(`reconcileFreeCreditsForUser` and the `list_free_credit_due_users` SQL
helper) and is pinned by a fresh-signup "exactly one grant call" test.

### The admin account is unconstrained

The admin/test account `o.halawi90@gmail.com`
(`user_id d8d561ed-42dd-4afd-8d33-bb1427a2169d`) is **unlimited — not
credit-bounded**:

- The credit gate short-circuits on the `unlimited_admin` entitlement
  (`resolveCreditEntitlementForUser`,
  `src/server/credit-entitlement.server.ts`) — no reservation, no decrement.
- The same entitlement exempts it from the (currently disabled) daily cap at
  the app layer (`assertWithinAnalysisQuota`, `src/server/quota.server.ts`).
- It is the sole seeded row in the service-role-only
  `public.quota_exempt_users` table, which exempts it at the DB-trigger layer
  if the daily cap is ever re-enabled.

### The per-user daily submission cap is DISABLED

`public.app_config` (singleton row) currently holds:

```text
quota_enabled            = false   (set 2026-06-05)
daily_submission_cap     = 5       (configured but inert)
max_takes_per_audition   = 3       (configured but inert at the daily-cap layer;
                                    still enforced per-audition by the upload path)
```

Both enforcement layers read this via `get_effective_quota_config()` and
bypass the daily cap entirely while `quota_enabled` is false. **No signed-in
user is capped per day; credits govern usage.**

### Anon lifetime cap (moot)

The same `enforce_daily_takes_cap` trigger contains a separate, hard-coded
anonymous lifetime cap (2 takes per `anon_id`; mirrored as
`ANON_LIFETIME_CAP = 2` in `src/server/quota.server.ts`). It is **not**
gated by `quota_enabled` — but it is moot in practice: an account is required
to run a tape, so no anonymous users exist in the live flow. It is retained
only as a backstop.

### Dormant machinery (retained, re-enable-able)

The following daily-cap machinery is deliberately kept, switched off:

- the user-branch daily cap inside the `enforce_daily_takes_cap` BEFORE
  INSERT trigger on `public.takes`
  (`supabase/migrations/20260605090000_tier_aware_daily_quota.sql`);
- the app-layer gate `assertWithinAnalysisQuota`
  (`src/server/quota.server.ts`), called before minting a Mux upload URL and
  before user-initiated retries;
- the service-role-only `public.quota_exempt_users` table (RLS deny-all, all
  client grants revoked) and its seed/verify endpoint
  (`/api/public/admin-quota-exemption`, gated by `RECONCILER_SECRET`);
- the paid-source bypass in both layers.

If a per-user daily backstop is ever wanted again, set `quota_enabled = true`.
When ON, the exempt set is: the admin (via `quota_exempt_users`) plus any user
holding an **active, unexpired paid/funded grant with credits remaining** from
`user_paid`, `school_funded`, `coach_funded`, `agent_funded`,
`platform_funded` or `sponsor_campaign`. `free_signup`, `free_monthly` and
`admin_grant` are **not** exempt sources.

## Operational notes

Flip the daily cap with:

```sql
UPDATE public.app_config SET quota_enabled = <bool> WHERE id = 'singleton';
```

(or via the secret-gated `/api/public/admin-config` endpoint). Currently
`false` (set 2026-06-05).

**If you hit an unexpected cap, check:**

1. `quota_enabled` in `app_config` — it should be `false`; if `true`, the
   daily cap and its exemption rules above are live.
2. If testing as a guest: the separate hard-coded anon lifetime cap (2 takes
   per `anon_id`) still fires regardless of `quota_enabled`.
3. A `CREDIT_REQUIRED` (402) block is not a cap — it is the credit gate, and
   for a standard account it means no active grant holds remaining credits.

## Tech debt

Monday item **2969310453** tracks the eventual removal of the dormant
daily-cap and anon-cap machinery if the credit-only model is confirmed as
permanent. Until that lands, treat the machinery as dormant-but-supported:
changes to `enforce_daily_takes_cap`, `quota.server.ts` or
`quota_exempt_users` must keep the re-enable path working.

## Related

- [ADR-0003: Dedicated Cloudflare Analysis Worker](./0003-dedicated-cloudflare-analysis-worker.md)
  — where analysis executes; the credit gate runs in the app before dispatch.
- [ADR-0004: Lovable Cloud exit & clean owned-Supabase cutover](./0004-lovable-cloud-exit-clean-cutover.md)
  — ownership of the database this model lives in.
