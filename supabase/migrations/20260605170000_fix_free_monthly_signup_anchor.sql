-- BUGFIX: a brand-new signup received 2 free credits (free_signup AND
-- free_monthly in the same reconcile pass) because the monthly-due test
-- keyed only on recent free_monthly grants — trivially absent for a fresh
-- account.
--
-- Fix: anchor the monthly allowance on the most recent FREE-TIER grant of
-- EITHER source (free_signup OR free_monthly) within 31 days. The signup
-- credit occupies the first period; free_monthly first becomes due ~31 days
-- after it, then every 31 days from the last free-tier grant. The TS
-- reconcile (src/server/free-credit-issuance.server.ts) applies the same
-- anchor and additionally never grants monthly in the signup pass itself.
--
-- Security unchanged: SECURITY DEFINER, search_path pinned, service-role-only.

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
          AND g.source IN ('free_signup', 'free_monthly')
          AND g.granted_at > now() - interval '31 days'
      )
    )
  ORDER BY u.created_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 1000));
$$;

REVOKE EXECUTE ON FUNCTION public.list_free_credit_due_users(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_free_credit_due_users(integer) TO service_role;
