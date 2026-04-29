-- Remove unused database-driven scheduling and vault secret.
-- The stale-take reconciler is being removed; runtime relies solely on Mux webhook + Cloudflare Worker waitUntil.

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'reconcile-stale-takes';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- pg_cron not installed; nothing to do
  NULL;
END $$;

-- Remove the vault secret that was only used by the cron job.
DO $$
BEGIN
  DELETE FROM vault.secrets WHERE name = 'reconciler_secret';
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Drop the extensions we no longer use.
DROP EXTENSION IF EXISTS pg_net;
DROP EXTENSION IF EXISTS pg_cron;

-- Drop the index that supported the reconciler's stale-lookup query.
DROP INDEX IF EXISTS public.takes_processing_phase_updated_at_idx;