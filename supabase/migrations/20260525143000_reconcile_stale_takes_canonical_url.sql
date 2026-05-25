-- Re-point stale take reconciliation at the canonical production host.
--
-- The endpoint remains protected by x-reconciler-secret. The Supabase Vault
-- secret named `reconciler_secret` must match the Worker RECONCILER_SECRET.
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'reconcile-stale-takes';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
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
