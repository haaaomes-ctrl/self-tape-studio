-- Free-credit issuance foundation (Monday 2969404421; ADR-0005).
--
-- 1. app_config toggle: when false, users holding ACTIVE funded-source
--    credits (ADR-0005 paid set) do not receive the free_monthly allowance.
--    Default true = everyone gets the monthly credit. Instant-flip via the
--    secret-gated /api/public/admin-config endpoint or service-role SQL.
-- 2. list_free_credit_due_users: service-role-only helper returning users
--    that are actually DUE issuance (missing free_signup OR no free_monthly
--    in the last 31 days) so the reconcile endpoint/cron never wastes its
--    batch limit on no-op users and newer users are never starved.
--
-- NOTE: issuance itself stays APP-SIDE (TS grantFundedCredits) because the
-- CRM emails (free_report_available / monthly_free_report) are rendered and
-- enqueued by the TS wrapper — SQL-level grants cannot send them. This
-- helper only SELECTS candidates; it never grants.

ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS free_monthly_includes_funded_users BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.list_free_credit_due_users(p_limit integer DEFAULT 500)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE u.id NOT IN (SELECT q.user_id FROM public.quota_exempt_users q)
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.credit_grants g
        WHERE g.user_id = u.id AND g.source = 'free_signup'
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.credit_grants g
        WHERE g.user_id = u.id
          AND g.source = 'free_monthly'
          AND g.granted_at > now() - interval '31 days'
      )
    )
  ORDER BY u.created_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 1000));
$$;

REVOKE EXECUTE ON FUNCTION public.list_free_credit_due_users(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_free_credit_due_users(integer) TO service_role;
