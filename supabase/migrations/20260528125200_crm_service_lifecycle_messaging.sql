-- DS-19: CRM, service emails and lifecycle messaging.
--
-- This composes account-compliance consent, DS-18 analytics segmentation and
-- Lovable/Brevo email infrastructure into a first-party CRM layer. It does not
-- change report judgement, prompts, scoring or performer-facing report output.

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  user_segment TEXT NOT NULL DEFAULT 'unknown' CHECK (
    user_segment IN ('performer', 'parent_guardian', 'b2b_lead', 'partner_admin', 'unknown')
  ),
  recipient_role TEXT NOT NULL DEFAULT 'unknown' CHECK (
    recipient_role IN ('performer', 'parent_guardian', 'partner_admin', 'unknown')
  ),
  account_route TEXT CHECK (
    account_route IS NULL OR account_route IN ('self_service_13_plus', 'parent_guardian', 'under_13')
  ),
  account_type TEXT CHECK (
    account_type IS NULL OR account_type IN ('self_service_performer', 'parent_guardian_managed')
  ),
  age_band_declaration TEXT CHECK (
    age_band_declaration IS NULL OR age_band_declaration IN ('13_plus', 'parent_guardian', 'under_13')
  ),
  parent_managed BOOLEAN NOT NULL DEFAULT false,
  service_messages_allowed BOOLEAN NOT NULL DEFAULT true,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  lifecycle_messages_allowed BOOLEAN NOT NULL DEFAULT false,
  consent_source TEXT NOT NULL DEFAULT 'account_compliance' CHECK (
    consent_source IN ('account_compliance', 'admin_import', 'b2b_lead_form', 'unknown')
  ),
  brevo_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    brevo_sync_status IN ('pending', 'synced', 'failed', 'not_configured')
  ),
  brevo_synced_at TIMESTAMPTZ,
  brevo_sync_error TEXT,
  crm_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_contacts_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT crm_contacts_normalized_email_lower CHECK (normalized_email = lower(trim(email))),
  CONSTRAINT crm_contacts_marketing_timestamp CHECK (
    (marketing_consent = true AND marketing_consent_at IS NOT NULL)
    OR (marketing_consent = false AND marketing_consent_at IS NULL)
  ),
  CONSTRAINT crm_contacts_metadata_object CHECK (jsonb_typeof(crm_metadata) = 'object')
);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.crm_contacts TO service_role;

CREATE INDEX IF NOT EXISTS crm_contacts_normalized_email_idx
  ON public.crm_contacts (normalized_email);
CREATE INDEX IF NOT EXISTS crm_contacts_segment_consent_idx
  ON public.crm_contacts (user_segment, marketing_consent, lifecycle_messages_allowed);

DROP TRIGGER IF EXISTS crm_contacts_set_updated_at ON public.crm_contacts;
CREATE TRIGGER crm_contacts_set_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.crm_normalize_email(p_email TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT lower(trim(COALESCE(p_email, '')));
$$;

CREATE OR REPLACE FUNCTION public.crm_message_category_requires_consent(p_category TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT p_category IN ('lifecycle', 'marketing');
$$;

CREATE OR REPLACE FUNCTION public.crm_safe_template_data(p_template_data JSONB)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(p_template_data, '{}'::jsonb)
    - 'brief'
    - 'full_brief'
    - 'report'
    - 'raw_report'
    - 'prompt'
    - 'raw_prompt'
    - 'system_prompt'
    - 'user_prompt'
    - 'raw_response'
    - 'response_text'
    - 'video_url'
    - 'signed_url'
    - 'playback_url'
    - 'authorization'
    - 'api_key'
    - 'token'
    - 'secret'
    - 'cookie'
    - 'session';
$$;

CREATE OR REPLACE FUNCTION public.sync_crm_contact_from_account_compliance(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  compliance public.account_compliance%ROWTYPE;
  user_email TEXT;
  normalized TEXT;
  segment TEXT := 'unknown';
  role TEXT := 'unknown';
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF user_email IS NULL OR trim(user_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO compliance
  FROM public.account_compliance
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  normalized := public.crm_normalize_email(user_email);

  IF compliance.account_type = 'parent_guardian_managed' THEN
    segment := 'parent_guardian';
    role := 'parent_guardian';
  ELSIF compliance.account_type = 'self_service_performer' THEN
    segment := 'performer';
    role := 'performer';
  END IF;

  INSERT INTO public.crm_contacts (
    user_id,
    email,
    normalized_email,
    user_segment,
    recipient_role,
    account_route,
    account_type,
    age_band_declaration,
    parent_managed,
    service_messages_allowed,
    marketing_consent,
    marketing_consent_at,
    lifecycle_messages_allowed,
    consent_source,
    crm_metadata
  )
  VALUES (
    p_user_id,
    user_email,
    normalized,
    segment,
    role,
    compliance.account_route,
    compliance.account_type,
    compliance.age_band_declaration,
    COALESCE(compliance.parent_managed, false),
    true,
    COALESCE(compliance.marketing_consent, false),
    compliance.marketing_consent_at,
    COALESCE(compliance.marketing_consent, false),
    'account_compliance',
    jsonb_build_object(
      'source', 'account_compliance_sync',
      'policy_versions', jsonb_build_object(
        'terms', compliance.terms_version,
        'privacy', compliance.privacy_version,
        'ai_disclaimer', compliance.ai_disclaimer_version
      )
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    normalized_email = EXCLUDED.normalized_email,
    user_segment = EXCLUDED.user_segment,
    recipient_role = EXCLUDED.recipient_role,
    account_route = EXCLUDED.account_route,
    account_type = EXCLUDED.account_type,
    age_band_declaration = EXCLUDED.age_band_declaration,
    parent_managed = EXCLUDED.parent_managed,
    service_messages_allowed = EXCLUDED.service_messages_allowed,
    marketing_consent = EXCLUDED.marketing_consent,
    marketing_consent_at = EXCLUDED.marketing_consent_at,
    lifecycle_messages_allowed = EXCLUDED.lifecycle_messages_allowed,
    consent_source = EXCLUDED.consent_source,
    crm_metadata = public.crm_contacts.crm_metadata || EXCLUDED.crm_metadata,
    updated_at = now();

  RETURN p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_crm_contact_from_account_compliance_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.sync_crm_contact_from_account_compliance(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_compliance_sync_crm_contact ON public.account_compliance;
CREATE TRIGGER account_compliance_sync_crm_contact
AFTER INSERT OR UPDATE ON public.account_compliance
FOR EACH ROW EXECUTE FUNCTION public.sync_crm_contact_from_account_compliance_trigger();

CREATE OR REPLACE FUNCTION public.crm_get_unsubscribe_token(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT := public.crm_normalize_email(p_email);
  existing_token TEXT;
  next_token TEXT;
BEGIN
  IF normalized IS NULL OR normalized = '' THEN
    RETURN NULL;
  END IF;

  SELECT token INTO existing_token
  FROM public.email_unsubscribe_tokens
  WHERE email = normalized;

  IF existing_token IS NOT NULL THEN
    RETURN existing_token;
  END IF;

  next_token := replace(gen_random_uuid()::TEXT, '-', '');
  INSERT INTO public.email_unsubscribe_tokens (token, email)
  VALUES (next_token, normalized)
  ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
  RETURNING token INTO existing_token;

  RETURN existing_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_build_unsubscribe_url(
  p_token TEXT,
  p_base_url TEXT DEFAULT 'https://tapecoach.co.uk/unsubscribe'
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN p_token IS NULL OR trim(p_token) = '' THEN NULL
      WHEN position('?' IN COALESCE(NULLIF(trim(p_base_url), ''), 'https://tapecoach.co.uk/unsubscribe')) > 0
        THEN COALESCE(NULLIF(trim(p_base_url), ''), 'https://tapecoach.co.uk/unsubscribe') || '&token=' || p_token
      ELSE COALESCE(NULLIF(trim(p_base_url), ''), 'https://tapecoach.co.uk/unsubscribe') || '?token=' || p_token
    END;
$$;

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
    'verify_email',
    'welcome',
    'free_report_available',
    'monthly_free_report',
    'no_report_started',
    'report_started',
    'report_ready',
    'failed_report_credit_restored',
    'credits_added',
    'b2b_follow_up'
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
      AND log.status IN ('pending', 'sent', 'suppressed', 'dlq')
    ORDER BY log.created_at DESC
    LIMIT 1;

    IF message_id IS NOT NULL THEN
      RETURN message_id;
    END IF;
  END IF;

  PERFORM public.sync_crm_contact_from_account_compliance(p_user_id);

  SELECT * INTO contact
  FROM public.crm_contacts
  WHERE user_id = p_user_id;

  IF contact.user_id IS NULL THEN
    RAISE EXCEPTION 'CRM contact is unavailable for user';
  END IF;

  normalized := contact.normalized_email;
  safe_template_data := public.crm_safe_template_data(p_template_data);
  message_id := COALESCE(NULLIF(trim(p_idempotency_key), ''), 'crm:' || gen_random_uuid()::TEXT);

  SELECT EXISTS (
    SELECT 1
    FROM public.suppressed_emails suppressed
    WHERE public.crm_normalize_email(suppressed.email) = normalized
      AND suppressed.reason IN ('bounce', 'complaint')
  )
  INTO has_hard_suppression;

  SELECT EXISTS (
    SELECT 1
    FROM public.suppressed_emails suppressed
    WHERE public.crm_normalize_email(suppressed.email) = normalized
      AND suppressed.reason = 'unsubscribe'
  )
  INTO is_suppressed;

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
    INSERT INTO public.email_send_log (
      message_id,
      template_name,
      recipient_email,
      status,
      error_message,
      metadata
    )
    VALUES (
      message_id,
      COALESCE(NULLIF(trim(p_label), ''), p_message_key),
      contact.email,
      'suppressed',
      suppression_reason,
      jsonb_build_object(
        'message_key', p_message_key,
        'message_category', p_message_category,
        'source', 'crm_lifecycle',
        'user_segment', contact.user_segment,
        'recipient_role', contact.recipient_role
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
      || unsubscribe_url
      || '">unsubscribe</a>.</p>';
    base_text := base_text || E'\n\nUnsubscribe from TapeCoach lifecycle emails: ' || unsubscribe_url;
  END IF;

  payload := jsonb_build_object(
    'run_id', message_id,
    'message_id', message_id,
    'to', contact.email,
    'from', COALESCE(NULLIF(trim(p_from), ''), 'TapeCoach <notify@notify.tapecoach.co.uk>'),
    'sender_domain', COALESCE(NULLIF(trim(p_sender_domain), ''), 'notify.tapecoach.co.uk'),
    'subject', trim(p_subject),
    'html', base_html,
    'text', base_text,
    'purpose', COALESCE(NULLIF(trim(p_purpose), ''), 'transactional'),
    'label', COALESCE(NULLIF(trim(p_label), ''), p_message_key),
    'idempotency_key', message_id,
    'unsubscribe_token', unsubscribe_token,
    'queued_at', COALESCE(p_send_after, now()),
    'template_data', safe_template_data
  );

  PERFORM public.enqueue_email('transactional_emails', payload);

  INSERT INTO public.email_send_log (
    message_id,
    template_name,
    recipient_email,
    status,
    metadata
  )
  VALUES (
    message_id,
    COALESCE(NULLIF(trim(p_label), ''), p_message_key),
    contact.email,
    'pending',
    jsonb_build_object(
      'message_key', p_message_key,
      'message_category', p_message_category,
      'source', 'crm_lifecycle',
      'user_segment', contact.user_segment,
      'recipient_role', contact.recipient_role
    )
  );

  RETURN message_id;
END;
$$;

CREATE OR REPLACE VIEW public.crm_contact_dashboard AS
SELECT
  contact.user_segment,
  contact.recipient_role,
  contact.account_route,
  contact.parent_managed,
  contact.marketing_consent,
  contact.lifecycle_messages_allowed,
  contact.brevo_sync_status,
  COUNT(*)::INTEGER AS contact_count,
  MIN(contact.first_seen_at) AS first_seen_at,
  MAX(contact.updated_at) AS last_updated_at,
  MAX(contact.brevo_synced_at) AS last_brevo_synced_at
FROM public.crm_contacts contact
GROUP BY
  contact.user_segment,
  contact.recipient_role,
  contact.account_route,
  contact.parent_managed,
  contact.marketing_consent,
  contact.lifecycle_messages_allowed,
  contact.brevo_sync_status;

CREATE OR REPLACE VIEW public.crm_email_delivery_dashboard AS
WITH latest_log AS (
  SELECT DISTINCT ON (COALESCE(log.message_id, log.id::TEXT))
    COALESCE(log.message_id, log.id::TEXT) AS effective_message_id,
    log.template_name,
    log.recipient_email,
    log.status,
    log.error_message,
    log.metadata,
    log.created_at
  FROM public.email_send_log log
  ORDER BY COALESCE(log.message_id, log.id::TEXT), log.created_at DESC, log.id DESC
)
SELECT
  date_trunc('day', latest_log.created_at)::DATE AS activity_day,
  latest_log.template_name AS message_key,
  COALESCE(latest_log.metadata ->> 'message_category', 'unknown') AS message_category,
  latest_log.status,
  COUNT(*)::INTEGER AS message_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'pending')::INTEGER AS pending_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'sent')::INTEGER AS sent_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'suppressed')::INTEGER AS suppressed_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'failed')::INTEGER AS failed_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'dlq')::INTEGER AS dlq_count,
  MIN(latest_log.created_at) AS first_activity_at,
  MAX(latest_log.created_at) AS last_activity_at
FROM latest_log
WHERE latest_log.template_name IN (
  'verify_email',
  'welcome',
  'free_report_available',
  'monthly_free_report',
  'no_report_started',
  'report_started',
  'report_ready',
  'failed_report_credit_restored',
  'credits_added',
  'b2b_follow_up'
)
GROUP BY
  date_trunc('day', latest_log.created_at)::DATE,
  latest_log.template_name,
  COALESCE(latest_log.metadata ->> 'message_category', 'unknown'),
  latest_log.status;

CREATE OR REPLACE VIEW public.crm_lifecycle_messaging_dashboard AS
WITH latest_log AS (
  SELECT DISTINCT ON (COALESCE(log.message_id, log.id::TEXT))
    COALESCE(log.message_id, log.id::TEXT) AS effective_message_id,
    log.template_name,
    log.status,
    log.metadata,
    log.created_at
  FROM public.email_send_log log
  ORDER BY COALESCE(log.message_id, log.id::TEXT), log.created_at DESC, log.id DESC
)
SELECT
  COALESCE(latest_log.metadata ->> 'message_category', 'unknown') AS message_category,
  latest_log.template_name AS message_key,
  COUNT(*)::INTEGER AS total_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'pending')::INTEGER AS pending_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'sent')::INTEGER AS sent_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'suppressed')::INTEGER AS suppressed_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'failed')::INTEGER AS failed_count,
  COUNT(*) FILTER (WHERE latest_log.status = 'dlq')::INTEGER AS dlq_count,
  MAX(latest_log.created_at) AS last_activity_at
FROM latest_log
WHERE latest_log.template_name IN (
  'verify_email',
  'welcome',
  'free_report_available',
  'monthly_free_report',
  'no_report_started',
  'report_started',
  'report_ready',
  'failed_report_credit_restored',
  'credits_added',
  'b2b_follow_up'
)
GROUP BY
  COALESCE(latest_log.metadata ->> 'message_category', 'unknown'),
  latest_log.template_name;

CREATE OR REPLACE VIEW public.crm_b2b_leads_dashboard AS
SELECT
  leads.lead_day,
  leads.lead_type,
  leads.lead_type AS partner_type,
  leads.attribution_source AS utm_source,
  leads.utm_campaign,
  leads.creator_code,
  leads.partner_code_hint,
  leads.lead_count,
  COALESCE(followup.follow_up_pending_count, 0)::INTEGER AS follow_up_pending_count,
  COALESCE(followup.follow_up_sent_count, 0)::INTEGER AS follow_up_sent_count
FROM public.analytics_b2b_leads_dashboard leads
LEFT JOIN (
  SELECT
    date_trunc('day', log.created_at)::DATE AS activity_day,
    COUNT(*) FILTER (WHERE log.status = 'pending') AS follow_up_pending_count,
    COUNT(*) FILTER (WHERE log.status = 'sent') AS follow_up_sent_count
  FROM public.email_send_log log
  WHERE log.template_name = 'b2b_follow_up'
  GROUP BY date_trunc('day', log.created_at)::DATE
) followup ON followup.activity_day = leads.lead_day;

REVOKE ALL ON TABLE public.crm_contact_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_email_delivery_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_lifecycle_messaging_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_b2b_leads_dashboard FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.crm_contact_dashboard TO service_role;
GRANT SELECT ON TABLE public.crm_email_delivery_dashboard TO service_role;
GRANT SELECT ON TABLE public.crm_lifecycle_messaging_dashboard TO service_role;
GRANT SELECT ON TABLE public.crm_b2b_leads_dashboard TO service_role;

REVOKE EXECUTE ON FUNCTION public.crm_normalize_email(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_message_category_requires_consent(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_safe_template_data(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_crm_contact_from_account_compliance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_crm_contact_from_account_compliance_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_get_unsubscribe_token(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_build_unsubscribe_url(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_crm_lifecycle_email(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_crm_contact_from_account_compliance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_crm_lifecycle_email(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
