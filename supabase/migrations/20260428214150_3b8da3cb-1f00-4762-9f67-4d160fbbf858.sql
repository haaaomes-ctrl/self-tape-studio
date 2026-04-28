-- Stale-analysis reconciler infrastructure for the Mux webhook → analyse handoff.
--
-- 1) Indexes to make the reconciler's "is this take stale?" lookup cheap.
-- 2) Enable pg_cron + pg_net (idempotent).
-- 3) Schedule a per-minute reconciler that POSTs to /api/public/reconcile-stale-takes.
--
-- Note: the reconciler endpoint is itself protected by an `x-reconciler-secret`
-- header (the value is a Lovable Cloud secret). The cron job reads this from
-- the `app.settings` GUC, which the user must set once via the SQL below
-- (we cannot read project secrets from inside the database).
CREATE INDEX IF NOT EXISTS takes_processing_phase_updated_at_idx
  ON public.takes (processing_phase, updated_at);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Set the secret in vault so the cron job can read it without leaking it
-- to anyone with cron.job read access.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'reconciler_secret') THEN
    PERFORM vault.create_secret('REPLACE_ME_WITH_RECONCILER_SECRET', 'reconciler_secret');
  END IF;
END $$;

-- Unschedule any prior version, then (re)schedule the reconciler.
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
    url := 'https://selftape.lovable.app/api/public/reconcile-stale-takes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reconciler-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reconciler_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $cron$
);
