-- 1. Create the singleton config table
CREATE TABLE IF NOT EXISTS public.app_config (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  quota_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_submission_cap INTEGER NOT NULL DEFAULT 5,
  max_takes_per_audition INTEGER NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT app_config_singleton_id CHECK (id = 'singleton'),
  CONSTRAINT app_config_daily_cap_positive CHECK (daily_submission_cap > 0),
  CONSTRAINT app_config_per_audition_positive CHECK (max_takes_per_audition > 0)
);

-- 2. RLS: deny everyone. Only service role (admin server fns) can read/write.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- No policies created → all client requests denied. Service role bypasses RLS.

-- 3. Seed singleton row with safe defaults
INSERT INTO public.app_config (id, quota_enabled, daily_submission_cap, max_takes_per_audition)
VALUES ('singleton', TRUE, 5, 3)
ON CONFLICT (id) DO NOTHING;

-- 4. Helper to resolve effective values with safe fallbacks
CREATE OR REPLACE FUNCTION public.get_effective_quota_config()
RETURNS TABLE(quota_enabled BOOLEAN, daily_submission_cap INTEGER, max_takes_per_audition INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.app_config%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM public.app_config WHERE id = 'singleton';
  IF NOT FOUND THEN
    quota_enabled := TRUE;
    daily_submission_cap := 5;
    max_takes_per_audition := 3;
    RETURN NEXT;
    RETURN;
  END IF;
  quota_enabled := COALESCE(cfg.quota_enabled, TRUE);
  daily_submission_cap := CASE
    WHEN cfg.daily_submission_cap IS NULL OR cfg.daily_submission_cap <= 0 THEN 5
    ELSE cfg.daily_submission_cap
  END;
  max_takes_per_audition := CASE
    WHEN cfg.max_takes_per_audition IS NULL OR cfg.max_takes_per_audition <= 0 THEN 3
    ELSE cfg.max_takes_per_audition
  END;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_effective_quota_config() FROM PUBLIC, anon, authenticated;

-- 5. Update the daily-cap trigger to read from app_config
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

-- Trigger already exists from prior migration; ensure it's wired up
DROP TRIGGER IF EXISTS enforce_daily_takes_cap_trigger ON public.takes;
CREATE TRIGGER enforce_daily_takes_cap_trigger
BEFORE INSERT ON public.takes
FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_takes_cap();

-- 6. updated_at trigger for app_config
CREATE TRIGGER app_config_set_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();