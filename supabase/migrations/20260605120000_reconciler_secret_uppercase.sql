-- WS4a: re-point the reconcile-stale-takes pg_cron job at the canonical
-- uppercase Vault secret name.
--
-- The app endpoint (/api/public/reconcile-stale-takes) validates the app-env
-- var RECONCILER_SECRET. The cron job previously read the Supabase Vault
-- secret named `reconciler_secret` (lowercase), so a name/value mismatch left
-- the every-minute call 401ing. Canonical pairing from here on:
--
--   Supabase Vault secret name : RECONCILER_SECRET
--   App (Lovable) env var      : RECONCILER_SECRET
--   ...and BOTH must hold the SAME value.
--
-- This migration only re-schedules the job to read the uppercase Vault name.
-- It does NOT create/set any secret value and does NOT delete the old
-- lowercase Vault entry — those are operator activation steps performed after
-- merge. Until the uppercase Vault secret is created with the matching value,
-- the cron call simply keeps 401ing exactly as it does today (fail-safe).

DO $$
DECLARE
  job record;
BEGIN
  FOR job IN SELECT jobid FROM cron.job WHERE jobname = 'reconcile-stale-takes'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'RECONCILER_SECRET') THEN
    RAISE WARNING 'Supabase Vault secret RECONCILER_SECRET is missing; reconcile-stale-takes will return 401 until it is created with the same value as the app env RECONCILER_SECRET';
  END IF;
END $$;

-- Same URL, schedule, body and timeout as the previous job
-- (20260525165658); only the Vault secret name changes.
SELECT cron.schedule(
  'reconcile-stale-takes',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tapecoach.co.uk/api/public/reconcile-stale-takes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reconciler-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'RECONCILER_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $cron$
);

SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'reconcile-stale-takes';
