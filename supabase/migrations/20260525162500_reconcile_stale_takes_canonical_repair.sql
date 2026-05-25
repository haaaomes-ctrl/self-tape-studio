-- Re-assert the production stale-take reconciler target after the S10.P2d
-- finalising lifetime fix. Some live logs still showed the old Lovable
-- project URL returning unauthorised 401s; those calls are not the intended
-- recovery path.
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
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'reconciler_secret') THEN
    RAISE WARNING 'Supabase Vault secret reconciler_secret is missing; reconcile-stale-takes will return 401 until it matches Worker RECONCILER_SECRET';
  END IF;
END $$;

SELECT cron.schedule(
  'reconcile-stale-takes',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tapecoach.co.uk/api/public/reconcile-stale-takes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reconciler-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reconciler_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $cron$
);

-- Deploy verification: this SELECT appears in migration output and should
-- show only the canonical production URL.
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'reconcile-stale-takes';
