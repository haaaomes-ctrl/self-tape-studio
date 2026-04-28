-- 1. Add anon_id columns
ALTER TABLE public.takes ADD COLUMN IF NOT EXISTS anon_id uuid;
ALTER TABLE public.auditions ADD COLUMN IF NOT EXISTS anon_id uuid;

-- 2. Make user_id nullable
ALTER TABLE public.takes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.auditions ALTER COLUMN user_id DROP NOT NULL;

-- 3. Enforce exactly-one-identity via trigger (CHECK can't be deferred and we want clear errors)
CREATE OR REPLACE FUNCTION public.enforce_identity_xor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.user_id IS NULL AND NEW.anon_id IS NULL)
     OR (NEW.user_id IS NOT NULL AND NEW.anon_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Row must have exactly one of user_id or anon_id set'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_identity_xor_takes ON public.takes;
CREATE TRIGGER enforce_identity_xor_takes
BEFORE INSERT OR UPDATE OF user_id, anon_id ON public.takes
FOR EACH ROW EXECUTE FUNCTION public.enforce_identity_xor();

DROP TRIGGER IF EXISTS enforce_identity_xor_auditions ON public.auditions;
CREATE TRIGGER enforce_identity_xor_auditions
BEFORE INSERT OR UPDATE OF user_id, anon_id ON public.auditions
FOR EACH ROW EXECUTE FUNCTION public.enforce_identity_xor();

-- 4. Indexes for quota lookups
CREATE INDEX IF NOT EXISTS idx_takes_anon_id ON public.takes(anon_id) WHERE anon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_takes_user_id_created_at ON public.takes(user_id, created_at) WHERE user_id IS NOT NULL;

-- 5. Replace daily-cap trigger with one that handles BOTH identity modes
CREATE OR REPLACE FUNCTION public.enforce_daily_takes_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_count integer;
  lifetime_count integer;
  user_cap constant integer := 5;
  anon_cap constant integer := 2;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO daily_count
    FROM public.takes
    WHERE user_id = NEW.user_id
      AND created_at >= date_trunc('day', now());

    IF daily_count >= user_cap THEN
      RAISE EXCEPTION 'Daily analysis limit reached (%/day). Try again tomorrow.', user_cap
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.anon_id IS NOT NULL THEN
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

-- Make sure the trigger is wired up (was created in a prior migration as enforce_daily_takes_cap_trigger)
DROP TRIGGER IF EXISTS enforce_daily_takes_cap_trigger ON public.takes;
CREATE TRIGGER enforce_daily_takes_cap_trigger
BEFORE INSERT ON public.takes
FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_takes_cap();

-- 6. Tighten RLS: existing owner policies use `auth.uid() = user_id`. With user_id nullable,
-- those still correctly evaluate to false for anon-only rows (NULL = uuid -> NULL -> false).
-- No additional policies needed — anon rows are admin-only by design.
