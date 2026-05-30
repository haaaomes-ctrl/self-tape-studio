-- Email queue live wiring cleanup.
--
-- Live S10-04 validation showed the take lifecycle working, but the email
-- queue cron was still calling a Lovable preview URL with a query token. That
-- makes production smoke tests depend on a preview worker bundle and can fail
-- with 404/worker-bundle errors even when the production route is healthy.
--
-- This migration repairs runtime plumbing only. It does not change email
-- payload shape, report logic, CRM logic, take lifecycle behavior, prompts,
-- scoring, UI rendering or queue semantics.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-email-queue'
   OR command LIKE '%/lovable/email/queue/process%'
   OR command LIKE '%id-preview--%.lovable.app%'
   OR command LIKE '%__lovable_token=%';

SELECT cron.schedule(
  'process-email-queue',
  '5 seconds',
  $cron$
  SELECT CASE
    WHEN COALESCE(
      (SELECT retry_after_until FROM public.email_send_state WHERE id = 1),
      '-infinity'::timestamptz
    ) > now()
      THEN NULL
    WHEN EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
      OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
      THEN net.http_post(
        url := 'https://tapecoach.co.uk/lovable/email/queue/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 5000
      )
    ELSE NULL
  END;
  $cron$
);

-- Deploy verification: only the canonical production email queue URL should
-- remain scheduled, and it should use the vault-backed service-role bearer
-- rather than a Lovable preview query token.
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'process-email-queue'
   OR command LIKE '%/lovable/email/queue/process%';

SELECT
  'email_queue_service_role_key_present' AS check_name,
  EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
  ) AS present;
