-- DS-18: Analytics, attribution and habit tracking.
--
-- This is a first-party analytics foundation only. It intentionally avoids
-- third-party trackers, CRM messaging, performer report logic, and pricing or
-- credit-enforcement changes.

ALTER TABLE public.auditions
  ADD COLUMN IF NOT EXISTS analytics_attribution JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS analytics_attribution JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'auditions_analytics_attribution_object'
  ) THEN
    ALTER TABLE public.auditions
      ADD CONSTRAINT auditions_analytics_attribution_object
      CHECK (jsonb_typeof(analytics_attribution) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'takes_analytics_attribution_object'
  ) THEN
    ALTER TABLE public.takes
      ADD CONSTRAINT takes_analytics_attribution_object
      CHECK (jsonb_typeof(analytics_attribution) = 'object');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'landing_view',
      'signup',
      'free_credit_grant',
      'partner_code_activation',
      'upload',
      'report_started',
      'report_completed',
      'report_viewed',
      'second_report',
      'return_7d',
      'return_30d',
      'b2b_lead',
      'creator_code_capture',
      'partner_code_capture',
      'purchase_started',
      'purchase_completed'
    )
  ),
  event_source TEXT NOT NULL DEFAULT 'client' CHECK (
    event_source IN ('client', 'server_product_event', 'stripe_webhook', 'admin_import')
  ),
  consent_state TEXT NOT NULL DEFAULT 'unknown' CHECK (
    consent_state IN ('unknown', 'analytics_granted', 'analytics_denied', 'essential_only')
  ),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attribution_key TEXT,
  session_key TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  creator_code TEXT,
  partner_code_hint TEXT,
  landing_path TEXT,
  referrer_host TEXT,
  object_type TEXT CHECK (
    object_type IS NULL OR object_type IN (
      'user',
      'audition',
      'take',
      'report',
      'purchase',
      'partner_code',
      'credit_grant',
      'b2b_lead'
    )
  ),
  object_id UUID,
  audition_id UUID REFERENCES public.auditions(id) ON DELETE SET NULL,
  take_id UUID REFERENCES public.takes(id) ON DELETE SET NULL,
  event_properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_properties_object CHECK (jsonb_typeof(event_properties) = 'object')
);

CREATE TABLE IF NOT EXISTS public.analytics_user_attribution (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attribution_key TEXT,
  first_landing_path TEXT,
  first_referrer_host TEXT,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_term TEXT,
  first_utm_content TEXT,
  first_creator_code TEXT,
  first_partner_code_hint TEXT,
  signup_event_id UUID REFERENCES public.analytics_events(id) ON DELETE SET NULL,
  consent_state TEXT NOT NULL DEFAULT 'unknown' CHECK (
    consent_state IN ('unknown', 'analytics_granted', 'analytics_denied', 'essential_only')
  ),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signup_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_user_attribution ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_user_attribution FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS analytics_user_attribution_set_updated_at
  ON public.analytics_user_attribution;
CREATE TRIGGER analytics_user_attribution_set_updated_at
BEFORE UPDATE ON public.analytics_user_attribution
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS analytics_events_name_time_idx
  ON public.analytics_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_time_idx
  ON public.analytics_events (user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_events_attribution_idx
  ON public.analytics_events (utm_source, creator_code, partner_code_hint, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_audition_take_idx
  ON public.analytics_events (audition_id, take_id, occurred_at DESC)
  WHERE audition_id IS NOT NULL OR take_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS auditions_analytics_attribution_gin_idx
  ON public.auditions USING GIN (analytics_attribution);
CREATE INDEX IF NOT EXISTS takes_analytics_attribution_gin_idx
  ON public.takes USING GIN (analytics_attribution);

CREATE OR REPLACE FUNCTION public.analytics_safe_text(p_value TEXT, p_max_length INTEGER DEFAULT 120)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    LEFT(
      regexp_replace(COALESCE(p_value, ''), '[^a-zA-Z0-9._~:@/+ -]', '', 'g'),
      GREATEST(1, LEAST(COALESCE(p_max_length, 120), 240))
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.record_analytics_event(
  p_event_name TEXT,
  p_consent_state TEXT DEFAULT 'unknown',
  p_attribution_key TEXT DEFAULT NULL,
  p_session_key TEXT DEFAULT NULL,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_utm_term TEXT DEFAULT NULL,
  p_utm_content TEXT DEFAULT NULL,
  p_creator_code TEXT DEFAULT NULL,
  p_partner_code_hint TEXT DEFAULT NULL,
  p_landing_path TEXT DEFAULT NULL,
  p_referrer_host TEXT DEFAULT NULL,
  p_object_type TEXT DEFAULT NULL,
  p_object_id UUID DEFAULT NULL,
  p_audition_id UUID DEFAULT NULL,
  p_take_id UUID DEFAULT NULL,
  p_event_properties JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_id UUID;
  effective_user_id UUID := auth.uid();
  effective_properties JSONB;
  effective_attribution_key TEXT;
  effective_session_key TEXT;
  effective_utm_source TEXT;
  effective_utm_medium TEXT;
  effective_utm_campaign TEXT;
  effective_utm_term TEXT;
  effective_utm_content TEXT;
  effective_creator_code TEXT;
  effective_partner_code_hint TEXT;
  effective_landing_path TEXT;
  effective_referrer_host TEXT;
BEGIN
  IF p_event_name NOT IN (
    'landing_view',
    'signup',
    'free_credit_grant',
    'partner_code_activation',
    'upload',
    'report_started',
    'report_completed',
    'report_viewed',
    'second_report',
    'return_7d',
    'return_30d',
    'b2b_lead',
    'creator_code_capture',
    'partner_code_capture',
    'purchase_started',
    'purchase_completed'
  ) THEN
    RAISE EXCEPTION 'unsupported analytics event';
  END IF;

  IF p_consent_state NOT IN (
    'unknown',
    'analytics_granted',
    'analytics_denied',
    'essential_only'
  ) THEN
    RAISE EXCEPTION 'unsupported analytics consent state';
  END IF;

  IF p_object_type IS NOT NULL AND p_object_type NOT IN (
    'user',
    'audition',
    'take',
    'report',
    'purchase',
    'partner_code',
    'credit_grant',
    'b2b_lead'
  ) THEN
    RAISE EXCEPTION 'unsupported analytics object type';
  END IF;

  effective_properties := COALESCE(p_event_properties, '{}'::jsonb);
  IF jsonb_typeof(effective_properties) <> 'object' THEN
    RAISE EXCEPTION 'analytics event properties must be an object';
  END IF;

  effective_properties := effective_properties
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

  IF p_event_name IN (
    'landing_view',
    'return_7d',
    'return_30d',
    'b2b_lead',
    'creator_code_capture',
    'partner_code_capture'
  ) AND p_consent_state <> 'analytics_granted' THEN
    RETURN NULL;
  END IF;

  IF p_consent_state = 'analytics_granted' THEN
    effective_attribution_key := public.analytics_safe_text(p_attribution_key, 80);
    effective_session_key := public.analytics_safe_text(p_session_key, 80);
    effective_utm_source := public.analytics_safe_text(p_utm_source, 80);
    effective_utm_medium := public.analytics_safe_text(p_utm_medium, 80);
    effective_utm_campaign := public.analytics_safe_text(p_utm_campaign, 120);
    effective_utm_term := public.analytics_safe_text(p_utm_term, 120);
    effective_utm_content := public.analytics_safe_text(p_utm_content, 120);
    effective_creator_code := public.analytics_safe_text(p_creator_code, 80);
    effective_partner_code_hint := public.analytics_safe_text(p_partner_code_hint, 80);
    effective_landing_path := public.analytics_safe_text(p_landing_path, 160);
    effective_referrer_host := public.analytics_safe_text(p_referrer_host, 120);
  END IF;

  INSERT INTO public.analytics_events (
    event_name,
    event_source,
    consent_state,
    user_id,
    attribution_key,
    session_key,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    creator_code,
    partner_code_hint,
    landing_path,
    referrer_host,
    object_type,
    object_id,
    audition_id,
    take_id,
    event_properties
  )
  VALUES (
    p_event_name,
    'client',
    p_consent_state,
    effective_user_id,
    effective_attribution_key,
    effective_session_key,
    effective_utm_source,
    effective_utm_medium,
    effective_utm_campaign,
    effective_utm_term,
    effective_utm_content,
    effective_creator_code,
    effective_partner_code_hint,
    effective_landing_path,
    effective_referrer_host,
    p_object_type,
    p_object_id,
    p_audition_id,
    p_take_id,
    effective_properties
  )
  RETURNING id INTO event_id;

  IF p_event_name = 'signup'
    AND effective_user_id IS NOT NULL
    AND p_consent_state = 'analytics_granted' THEN
    INSERT INTO public.analytics_user_attribution (
      user_id,
      attribution_key,
      first_landing_path,
      first_referrer_host,
      first_utm_source,
      first_utm_medium,
      first_utm_campaign,
      first_utm_term,
      first_utm_content,
      first_creator_code,
      first_partner_code_hint,
      signup_event_id,
      consent_state,
      first_seen_at,
      signup_at
    )
    VALUES (
      effective_user_id,
      effective_attribution_key,
      effective_landing_path,
      effective_referrer_host,
      effective_utm_source,
      effective_utm_medium,
      effective_utm_campaign,
      effective_utm_term,
      effective_utm_content,
      effective_creator_code,
      effective_partner_code_hint,
      event_id,
      p_consent_state,
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      signup_event_id = COALESCE(analytics_user_attribution.signup_event_id, EXCLUDED.signup_event_id),
      signup_at = COALESCE(analytics_user_attribution.signup_at, EXCLUDED.signup_at),
      attribution_key = COALESCE(analytics_user_attribution.attribution_key, EXCLUDED.attribution_key),
      first_landing_path = COALESCE(analytics_user_attribution.first_landing_path, EXCLUDED.first_landing_path),
      first_referrer_host = COALESCE(analytics_user_attribution.first_referrer_host, EXCLUDED.first_referrer_host),
      first_utm_source = COALESCE(analytics_user_attribution.first_utm_source, EXCLUDED.first_utm_source),
      first_utm_medium = COALESCE(analytics_user_attribution.first_utm_medium, EXCLUDED.first_utm_medium),
      first_utm_campaign = COALESCE(analytics_user_attribution.first_utm_campaign, EXCLUDED.first_utm_campaign),
      first_utm_term = COALESCE(analytics_user_attribution.first_utm_term, EXCLUDED.first_utm_term),
      first_utm_content = COALESCE(analytics_user_attribution.first_utm_content, EXCLUDED.first_utm_content),
      first_creator_code = COALESCE(analytics_user_attribution.first_creator_code, EXCLUDED.first_creator_code),
      first_partner_code_hint = COALESCE(analytics_user_attribution.first_partner_code_hint, EXCLUDED.first_partner_code_hint),
      consent_state = EXCLUDED.consent_state,
      updated_at = now();
  END IF;

  RETURN event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_analytics_event(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  UUID,
  UUID,
  JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_analytics_event(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  UUID,
  UUID,
  JSONB
) TO anon, authenticated;

CREATE OR REPLACE VIEW public.analytics_funnel_dashboard AS
SELECT
  date_trunc('day', event.occurred_at)::DATE AS event_day,
  event.event_name,
  COALESCE(
    NULLIF(event.utm_source, ''),
    CASE
      WHEN event.partner_code_hint IS NOT NULL THEN 'partner_code'
      WHEN event.creator_code IS NOT NULL THEN 'creator_code'
      ELSE 'direct_or_unknown'
    END
  ) AS attribution_source,
  event.utm_medium,
  event.utm_campaign,
  event.creator_code,
  event.partner_code_hint,
  COUNT(*)::INTEGER AS event_count,
  COUNT(DISTINCT event.user_id)::INTEGER AS distinct_user_count
FROM public.analytics_events event
GROUP BY
  date_trunc('day', event.occurred_at)::DATE,
  event.event_name,
  attribution_source,
  event.utm_medium,
  event.utm_campaign,
  event.creator_code,
  event.partner_code_hint;

CREATE OR REPLACE VIEW public.analytics_report_completion_dashboard AS
WITH take_counts AS (
  SELECT
    date_trunc('month', COALESCE(take.updated_at, take.created_at))::DATE AS month_start,
    COUNT(*)::INTEGER AS report_started_count,
    COUNT(*) FILTER (WHERE take.status = 'complete' OR take.report IS NOT NULL)::INTEGER
      AS report_completed_count,
    COUNT(DISTINCT take.user_id) FILTER (
      WHERE take.status = 'complete' OR take.report IS NOT NULL
    )::INTEGER AS users_with_completed_report_count
  FROM public.takes take
  GROUP BY date_trunc('month', COALESCE(take.updated_at, take.created_at))::DATE
),
view_counts AS (
  SELECT
    date_trunc('month', event.occurred_at)::DATE AS month_start,
    COUNT(*)::INTEGER AS report_viewed_count,
    COUNT(DISTINCT event.user_id)::INTEGER AS report_viewing_user_count
  FROM public.analytics_events event
  WHERE event.event_name = 'report_viewed'
  GROUP BY date_trunc('month', event.occurred_at)::DATE
)
SELECT
  COALESCE(take_counts.month_start, view_counts.month_start) AS month_start,
  COALESCE(take_counts.report_started_count, 0)::INTEGER AS report_started_count,
  COALESCE(take_counts.report_completed_count, 0)::INTEGER AS report_completed_count,
  COALESCE(view_counts.report_viewed_count, 0)::INTEGER AS report_viewed_count,
  COALESCE(take_counts.users_with_completed_report_count, 0)::INTEGER
    AS users_with_completed_report_count,
  COALESCE(view_counts.report_viewing_user_count, 0)::INTEGER AS report_viewing_user_count,
  CASE
    WHEN COALESCE(take_counts.report_started_count, 0) = 0 THEN NULL
    ELSE ROUND(
      take_counts.report_completed_count::NUMERIC
      / NULLIF(take_counts.report_started_count, 0),
      4
    )
  END AS report_completion_rate
FROM take_counts
FULL OUTER JOIN view_counts
  ON view_counts.month_start = take_counts.month_start;

CREATE OR REPLACE VIEW public.analytics_habit_dashboard AS
WITH user_auditions AS (
  SELECT
    audition.user_id,
    MIN(audition.created_at) AS first_audition_at,
    MAX(audition.created_at) AS latest_audition_at,
    COUNT(*)::INTEGER AS audition_count
  FROM public.auditions audition
  WHERE audition.user_id IS NOT NULL
  GROUP BY audition.user_id
),
report_counts AS (
  SELECT
    take.user_id,
    COUNT(*) FILTER (WHERE take.status = 'complete' OR take.report IS NOT NULL)::INTEGER
      AS completed_report_count
  FROM public.takes take
  WHERE take.user_id IS NOT NULL
  GROUP BY take.user_id
)
SELECT
  date_trunc('month', user_auditions.first_audition_at)::DATE AS cohort_month,
  COUNT(*)::INTEGER AS users_with_auditions_count,
  COUNT(*) FILTER (WHERE user_auditions.audition_count > 1)::INTEGER
    AS users_with_more_than_one_audition_count,
  COUNT(*) FILTER (
    WHERE user_auditions.latest_audition_at >= user_auditions.first_audition_at + INTERVAL '7 days'
  )::INTEGER AS users_returned_after_7_days_count,
  COUNT(*) FILTER (
    WHERE user_auditions.latest_audition_at >= user_auditions.first_audition_at + INTERVAL '30 days'
  )::INTEGER AS users_returned_after_30_days_count,
  COALESCE(SUM(report_counts.completed_report_count), 0)::INTEGER AS completed_report_count
FROM user_auditions
LEFT JOIN report_counts
  ON report_counts.user_id = user_auditions.user_id
GROUP BY date_trunc('month', user_auditions.first_audition_at)::DATE;

CREATE OR REPLACE VIEW public.analytics_attribution_dashboard AS
WITH attributed_activity AS (
  SELECT
    event.event_name,
    event.user_id,
    event.utm_source,
    event.utm_medium,
    event.utm_campaign,
    event.creator_code,
    event.partner_code_hint
  FROM public.analytics_events event
  WHERE event.event_name NOT IN ('report_completed', 'purchase_started', 'purchase_completed')

  UNION ALL

  SELECT
    'report_completed'::TEXT AS event_name,
    take.user_id,
    NULLIF(take.analytics_attribution->>'utm_source', '') AS utm_source,
    NULLIF(take.analytics_attribution->>'utm_medium', '') AS utm_medium,
    NULLIF(take.analytics_attribution->>'utm_campaign', '') AS utm_campaign,
    NULLIF(take.analytics_attribution->>'creator_code', '') AS creator_code,
    NULLIF(take.analytics_attribution->>'partner_code_hint', '') AS partner_code_hint
  FROM public.takes take
  WHERE (take.status = 'complete' OR take.report IS NOT NULL)
    AND take.analytics_attribution->>'attribution_available' = 'true'

  UNION ALL

  SELECT
    'purchase_started'::TEXT AS event_name,
    payment.user_id,
    NULLIF(payment.metadata #>> '{analytics_attribution,utm_source}', '') AS utm_source,
    NULLIF(payment.metadata #>> '{analytics_attribution,utm_medium}', '') AS utm_medium,
    NULLIF(payment.metadata #>> '{analytics_attribution,utm_campaign}', '') AS utm_campaign,
    NULLIF(payment.metadata #>> '{analytics_attribution,creator_code}', '') AS creator_code,
    NULLIF(payment.metadata #>> '{analytics_attribution,partner_code_hint}', '') AS partner_code_hint
  FROM public.consumer_credit_payments payment
  WHERE payment.metadata #>> '{analytics_attribution,attribution_available}' = 'true'

  UNION ALL

  SELECT
    'purchase_completed'::TEXT AS event_name,
    payment.user_id,
    NULLIF(payment.metadata #>> '{analytics_attribution,utm_source}', '') AS utm_source,
    NULLIF(payment.metadata #>> '{analytics_attribution,utm_medium}', '') AS utm_medium,
    NULLIF(payment.metadata #>> '{analytics_attribution,utm_campaign}', '') AS utm_campaign,
    NULLIF(payment.metadata #>> '{analytics_attribution,creator_code}', '') AS creator_code,
    NULLIF(payment.metadata #>> '{analytics_attribution,partner_code_hint}', '') AS partner_code_hint
  FROM public.consumer_credit_payments payment
  WHERE payment.metadata #>> '{analytics_attribution,attribution_available}' = 'true'
    AND payment.status IN ('checkout_completed', 'payment_succeeded')
)
SELECT
  COALESCE(
    NULLIF(activity.utm_source, ''),
    CASE
      WHEN activity.partner_code_hint IS NOT NULL THEN 'partner_code'
      WHEN activity.creator_code IS NOT NULL THEN 'creator_code'
      ELSE 'direct_or_unknown'
    END
  ) AS attribution_source,
  activity.utm_source,
  activity.utm_medium,
  activity.utm_campaign,
  activity.creator_code,
  activity.partner_code_hint,
  COUNT(*) FILTER (WHERE activity.event_name = 'signup')::INTEGER AS signup_count,
  COUNT(*) FILTER (WHERE activity.event_name = 'upload')::INTEGER AS upload_count,
  COUNT(*) FILTER (WHERE activity.event_name = 'report_completed')::INTEGER AS report_completed_count,
  COUNT(*) FILTER (WHERE activity.event_name = 'report_viewed')::INTEGER AS report_viewed_count,
  COUNT(*) FILTER (WHERE activity.event_name = 'purchase_started')::INTEGER AS purchase_started_count,
  COUNT(*) FILTER (WHERE activity.event_name = 'purchase_completed')::INTEGER AS purchase_completed_count,
  COUNT(DISTINCT activity.user_id)::INTEGER AS distinct_user_count
FROM attributed_activity activity
GROUP BY
  attribution_source,
  activity.utm_source,
  activity.utm_medium,
  activity.utm_campaign,
  activity.creator_code,
  activity.partner_code_hint;

CREATE OR REPLACE VIEW public.analytics_b2b_leads_dashboard AS
SELECT
  date_trunc('day', event.occurred_at)::DATE AS lead_day,
  COALESCE(event.event_properties->>'lead_type', 'unknown') AS lead_type,
  COALESCE(event.utm_source, 'direct_or_unknown') AS attribution_source,
  event.utm_campaign,
  event.creator_code,
  event.partner_code_hint,
  COUNT(*)::INTEGER AS lead_count,
  COUNT(DISTINCT event.user_id)::INTEGER AS distinct_user_count
FROM public.analytics_events event
WHERE event.event_name = 'b2b_lead'
GROUP BY
  date_trunc('day', event.occurred_at)::DATE,
  COALESCE(event.event_properties->>'lead_type', 'unknown'),
  COALESCE(event.utm_source, 'direct_or_unknown'),
  event.utm_campaign,
  event.creator_code,
  event.partner_code_hint;

REVOKE ALL ON TABLE public.analytics_funnel_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_report_completion_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_habit_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_attribution_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_b2b_leads_dashboard FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.analytics_events TO service_role;
GRANT SELECT ON TABLE public.analytics_user_attribution TO service_role;
GRANT SELECT ON TABLE public.analytics_funnel_dashboard TO service_role;
GRANT SELECT ON TABLE public.analytics_report_completion_dashboard TO service_role;
GRANT SELECT ON TABLE public.analytics_habit_dashboard TO service_role;
GRANT SELECT ON TABLE public.analytics_attribution_dashboard TO service_role;
GRANT SELECT ON TABLE public.analytics_b2b_leads_dashboard TO service_role;
