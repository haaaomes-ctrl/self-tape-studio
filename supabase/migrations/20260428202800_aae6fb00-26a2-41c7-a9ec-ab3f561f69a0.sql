CREATE OR REPLACE FUNCTION public.enforce_daily_takes_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_count integer;
  cap constant integer := 5;
BEGIN
  SELECT COUNT(*) INTO daily_count
  FROM public.takes
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('day', now());

  IF daily_count >= cap THEN
    RAISE EXCEPTION 'Daily analysis limit reached (%/day). Try again tomorrow.', cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_daily_takes_cap_trigger ON public.takes;
CREATE TRIGGER enforce_daily_takes_cap_trigger
BEFORE INSERT ON public.takes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_daily_takes_cap();