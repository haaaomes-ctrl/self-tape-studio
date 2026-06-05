-- Daily free-credit reconcile cron (Monday 2969404421; ADR-0005).
--
-- pg_cron calls the app's secret-gated reconcile endpoint once a day. The
-- ENDPOINT performs issuance (TS grantFundedCredits) so the CRM emails fire
-- correctly — SQL cannot render/send them, which is exactly why this job is
-- an HTTP call rather than a SQL grant loop. Lazy on-access issuance
-- (dashboard / report attempt) remains the primary path; this cron covers
-- dormant users (monthly nudge) and acted as the one-time backfill executor.
--
-- Pairing rule (same as reconcile-stale-takes): the Supabase Vault secret
-- RECONCILER_SECRET and the app env var RECONCILER_SECRET must hold the SAME
-- value. Until they do, the call 401s harmlessly.

DO $$
DECLARE
  job record;
BEGIN
  FOR job IN SELECT jobid FROM cron.job WHERE jobname = 'free-credit-reconcile'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'RECONCILER_SECRET') THEN
    RAISE WARNING 'Supabase Vault secret RECONCILER_SECRET is missing; free-credit-reconcile will return 401 until it matches the app env RECONCILER_SECRET';
  END IF;
END $$;

SELECT cron.schedule(
  'free-credit-reconcile',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tapecoach.co.uk/api/public/free-credit-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reconciler-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'RECONCILER_SECRET')
    ),
    body := '{"limit": 500}'::jsonb,
    timeout_milliseconds := 15000
  );
  $cron$
);

SELECT jobid, jobname, schedule
FROM cron.job
WHERE jobname = 'free-credit-reconcile';
