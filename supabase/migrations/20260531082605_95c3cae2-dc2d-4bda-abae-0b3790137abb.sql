-- S10-04 email dispatcher Brevo runtime guardrails.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN dispatcher_mode TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

UPDATE public.email_send_state
SET dispatcher_mode = 'disabled'
WHERE dispatcher_mode IS NULL
   OR dispatcher_mode NOT IN ('disabled', 'dry_run', 'sandbox', 'enabled');

ALTER TABLE public.email_send_state
  ALTER COLUMN dispatcher_mode SET DEFAULT 'disabled',
  ALTER COLUMN dispatcher_mode SET NOT NULL;

ALTER TABLE public.email_send_state
  DROP CONSTRAINT IF EXISTS email_send_state_dispatcher_mode_check;

ALTER TABLE public.email_send_state
  ADD CONSTRAINT email_send_state_dispatcher_mode_check
  CHECK (dispatcher_mode IN ('disabled', 'dry_run', 'sandbox', 'enabled'));

ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_status_check;

ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_status_check
  CHECK (
    status IN (
      'pending','sent','suppressed','failed','bounced','complained','dlq','deferred','dry_run','sandbox'
    )
  );

CREATE OR REPLACE FUNCTION public.enqueue_crm_lifecycle_email(
  p_user_id UUID,
  p_message_key TEXT,
  p_message_category TEXT,
  p_subject TEXT,
  p_preview_text TEXT DEFAULT '',
  p_html TEXT DEFAULT NULL,
  p_text TEXT DEFAULT NULL,
  p_template_data JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_send_after TIMESTAMPTZ DEFAULT now(),
  p_from TEXT DEFAULT NULL,
  p_sender_domain TEXT DEFAULT 'notify.tapecoach.co.uk',
  p_purpose TEXT DEFAULT 'transactional',
  p_label TEXT DEFAULT NULL,
  p_unsubscribe_base_url TEXT DEFAULT 'https://tapecoach.co.uk/unsubscribe'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  contact public.crm_contacts%ROWTYPE;
  normalized TEXT;
  message_id TEXT;
  safe_template_data JSONB;
  unsubscribe_token TEXT := NULL;
  unsubscribe_url TEXT := NULL;
  is_suppressed BOOLEAN := false;
  has_hard_suppression BOOLEAN := false;
  suppression_reason TEXT := NULL;
  base_html TEXT;
  base_text TEXT;
  payload JSONB;
BEGIN
  IF p_message_key NOT IN (
    'verify_email','welcome','free_report_available','monthly_free_report',
    'no_report_started','report_started','report_ready',
    'failed_report_credit_restored','credits_added','b2b_follow_up'
  ) THEN
    RAISE EXCEPTION 'unsupported CRM message key';
  END IF;

  IF p_message_category NOT IN ('service', 'lifecycle', 'marketing') THEN
    RAISE EXCEPTION 'unsupported CRM message category';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT log.message_id INTO message_id
    FROM public.email_send_log log
    WHERE log.message_id = p_idempotency_key
      AND log.status IN ('pending', 'sent', 'suppressed', 'dlq', 'dry_run', 'sandbox')
    ORDER BY log.created_at DESC
    LIMIT 1;

    IF message_id IS NOT NULL THEN
      RETURN message_id;
    END IF;
  END IF;

  PERFORM public.sync_crm_contact_from_account_compliance(p_user_id);

  SELECT * INTO contact FROM public.crm_contacts WHERE user_id = p_user_id;

  IF contact.user_id IS NULL THEN
    RAISE EXCEPTION 'CRM contact is unavailable for user';
  END IF;

  normalized := contact.normalized_email;
  safe_template_data := public.crm_safe_template_data(p_template_data);
  message_id := COALESCE(NULLIF(trim(p_idempotency_key), ''), 'crm:' || gen_random_uuid()::TEXT);

  SELECT EXISTS (
    SELECT 1 FROM public.suppressed_emails suppressed
    WHERE public.crm_normalize_email(suppressed.email) = normalized
      AND suppressed.reason IN ('bounce', 'complaint')
  ) INTO has_hard_suppression;

  SELECT EXISTS (
    SELECT 1 FROM public.suppressed_emails suppressed
    WHERE public.crm_normalize_email(suppressed.email) = normalized
      AND suppressed.reason = 'unsubscribe'
  ) INTO is_suppressed;

  IF has_hard_suppression THEN
    suppression_reason := 'hard_suppressed_email';
  ELSIF p_message_category = 'service' AND contact.service_messages_allowed IS NOT true THEN
    suppression_reason := 'service_messages_disabled';
  ELSIF public.crm_message_category_requires_consent(p_message_category)
    AND contact.marketing_consent IS NOT true THEN
    suppression_reason := 'marketing_consent_required';
  ELSIF public.crm_message_category_requires_consent(p_message_category)
    AND is_suppressed THEN
    suppression_reason := 'suppressed_email';
  END IF;

  IF suppression_reason IS NOT NULL THEN
    INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status, error_message, metadata)
    VALUES (
      message_id,
      COALESCE(NULLIF(trim(p_label), ''), p_message_key),
      contact.email, 'suppressed', suppression_reason,
      jsonb_build_object(
        'message_key', p_message_key, 'message_category', p_message_category,
        'source', 'crm_lifecycle', 'user_segment', contact.user_segment,
        'recipient_role', contact.recipient_role, 'provider', 'brevo'
      )
    );
    RETURN message_id;
  END IF;

  IF public.crm_message_category_requires_consent(p_message_category) THEN
    unsubscribe_token := public.crm_get_unsubscribe_token(contact.email);
    unsubscribe_url := public.crm_build_unsubscribe_url(unsubscribe_token, p_unsubscribe_base_url);
  END IF;

  base_html := COALESCE(p_html, '<p>' || COALESCE(NULLIF(trim(p_preview_text), ''), trim(p_subject)) || '</p>');
  base_text := COALESCE(p_text, COALESCE(NULLIF(trim(p_preview_text), ''), trim(p_subject)));

  IF unsubscribe_url IS NOT NULL THEN
    base_html := base_html
      || '<hr><p style="font-size:12px;color:#6b7280;">You can unsubscribe from TapeCoach lifecycle emails at any time: <a href="'
      || unsubscribe_url || '">unsubscribe</a>.</p>';
    base_text := base_text || E'\n\nUnsubscribe from TapeCoach lifecycle emails: ' || unsubscribe_url;
  END IF;

  payload := jsonb_build_object(
    'message_id', message_id,
    'to', contact.email,
    'from', COALESCE(NULLIF(trim(p_from), ''), 'TapeCoach <notify@notify.tapecoach.co.uk>'),
    'sender_domain', COALESCE(NULLIF(trim(p_sender_domain), ''), 'notify.tapecoach.co.uk'),
    'subject', trim(p_subject),
    'html', base_html, 'text', base_text,
    'purpose', COALESCE(NULLIF(trim(p_purpose), ''), 'transactional'),
    'label', COALESCE(NULLIF(trim(p_label), ''), p_message_key),
    'idempotency_key', message_id,
    'unsubscribe_token', unsubscribe_token,
    'queued_at', COALESCE(p_send_after, now()),
    'template_data', safe_template_data
  );

  PERFORM public.enqueue_email('transactional_emails', payload);

  INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status, metadata)
  VALUES (
    message_id,
    COALESCE(NULLIF(trim(p_label), ''), p_message_key),
    contact.email, 'pending',
    jsonb_build_object(
      'message_key', p_message_key, 'message_category', p_message_category,
      'source', 'crm_lifecycle', 'user_segment', contact.user_segment,
      'recipient_role', contact.recipient_role, 'provider', 'brevo'
    )
  );

  RETURN message_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_crm_lifecycle_email(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_crm_lifecycle_email(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

DO $$
BEGIN
  IF to_regclass('pgmq.q_transactional_emails') IS NOT NULL THEN
    UPDATE pgmq.q_transactional_emails
    SET message = message - 'run_id'
    WHERE message ? 'run_id'
      AND (
        message->>'message_id' LIKE 'crm:%'
        OR message->>'label' IN (
          'verify_email','welcome','free_report_available','monthly_free_report',
          'no_report_started','report_started','report_ready',
          'failed_report_credit_restored','credits_added','b2b_follow_up','b2b_interest'
        )
      );
  END IF;
END $$;

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
      (SELECT dispatcher_mode FROM public.email_send_state WHERE id = 1),
      'disabled'
    ) <> 'enabled'
      THEN NULL
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

NOTIFY pgrst, 'reload schema';