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

SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'reconcile-stale-takes';