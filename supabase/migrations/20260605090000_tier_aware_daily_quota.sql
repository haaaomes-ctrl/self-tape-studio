-- WS1: tier-aware daily submission quota.
--
-- The daily cap (app_config.daily_submission_cap) is a FREE-tier abuse control.
-- This migration makes the DB-level trigger tier-aware so it no longer blocks:
--   (a) admin/test accounts seeded into public.quota_exempt_users
--       (seeded server-side by UUID via the credit-entitlement system — the
--       admin email is intentionally never stored in SQL), and
--   (b) paying users with an active, unexpired paid/funded credit grant.
--
-- Free tiers stay capped: free_signup and free_monthly grants do NOT exempt,
-- and admin_grant is excluded from the auto-exempt set (admin accounts are
-- handled solely via quota_exempt_users).
--
-- IMPORTANT: this migration does NOT touch app_config.quota_enabled. The
-- quota stays off until the admin exemption row is seeded and verified
-- (rollout: migration+code -> seed admin UUID -> verify -> flip quota_enabled).

-- 1. Service-role-only exemption table (same posture as credit_grants:
--    RLS enabled with no policies, all client grants revoked).
CREATE TABLE IF NOT EXISTS public.quota_exempt_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quota_exempt_users ENABLE ROW LEVEL SECURITY;
-- No policies created -> all client requests denied. Service role bypasses RLS.
REVOKE ALL ON TABLE public.quota_exempt_users FROM PUBLIC, anon, authenticated;

-- 2. Tier-aware daily-cap trigger. Identical to the previous version except
--    for the two exemption checks in the authenticated-user branch. The anon
--    lifetime cap, the quota_enabled bypass, SECURITY DEFINER, search_path
--    and the client-facing error messages are unchanged.
CREATE OR REPLACE FUNCTION public.enforce_daily_takes_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_count integer;
  lifetime_count integer;
  effective_enabled boolean := TRUE;
  effective_user_cap integer := 5;
  anon_cap constant integer := 2;
BEGIN
  -- Resolve effective config (falls back to safe defaults)
  BEGIN
    SELECT quota_enabled, daily_submission_cap
      INTO effective_enabled, effective_user_cap
      FROM public.get_effective_quota_config();
  EXCEPTION WHEN OTHERS THEN
    effective_enabled := TRUE;
    effective_user_cap := 5;
  END;

  IF NEW.user_id IS NOT NULL THEN
    -- Bypass entirely when quota is disabled
    IF effective_enabled IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    -- Tier exemption (a): seeded admin/test accounts. quota_exempt_users is
    -- service-role-only, so this cannot be set from the client.
    IF EXISTS (
      SELECT 1
      FROM public.quota_exempt_users
      WHERE user_id = NEW.user_id
    ) THEN
      RETURN NEW;
    END IF;

    -- Tier exemption (b): an active, unexpired paid/funded credit grant with
    -- credits remaining. Free-tier sources (free_signup, free_monthly) and
    -- admin_grant are deliberately NOT in this set. credit_grants is
    -- service-role-only, so this cannot be set from the client. Uses the
    -- existing credit_grants_user_status_expiry_idx index.
    IF EXISTS (
      SELECT 1
      FROM public.credit_grants
      WHERE user_id = NEW.user_id
        AND status = 'active'
        AND remaining_credits > 0
        AND (expires_at IS NULL OR expires_at > now())
        AND source IN (
          'user_paid',
          'school_funded',
          'coach_funded',
          'agent_funded',
          'platform_funded',
          'sponsor_campaign'
        )
    ) THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO daily_count
    FROM public.takes
    WHERE user_id = NEW.user_id
      AND created_at >= date_trunc('day', now());

    IF daily_count >= effective_user_cap THEN
      RAISE EXCEPTION 'Daily submission limit reached (%/day). Please try again tomorrow.', effective_user_cap
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.anon_id IS NOT NULL THEN
    -- Anon lifetime cap is intentionally hard-coded (out of scope for app_config)
    SELECT COUNT(*) INTO lifetime_count
    FROM public.takes
    WHERE anon_id = NEW.anon_id;

    IF lifetime_count >= anon_cap THEN
      RAISE EXCEPTION 'Free trial limit reached (%/total). Sign up to keep going.', anon_cap
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_daily_takes_cap() FROM PUBLIC, anon, authenticated;

-- The BEFORE INSERT trigger on public.takes already points at this function
-- (created in 20260501122107); CREATE OR REPLACE updates it in place.
