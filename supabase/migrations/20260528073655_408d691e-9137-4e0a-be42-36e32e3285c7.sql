DO $$
BEGIN
  CREATE TYPE public.ai_usage_step AS ENUM ('brief_extraction','evidence_pass','single_pass_report','report_polish','fallback','repair');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE TYPE public.ai_usage_status AS ENUM ('success','failure','timeout','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE TYPE public.ai_usage_cost_source AS ENUM ('planning_baseline','duration_baseline','token_usage_available');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.estimate_ai_report_cost_usd(p_duration_seconds NUMERIC DEFAULT NULL)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT ROUND(
    CASE
      WHEN p_duration_seconds IS NULL OR p_duration_seconds <= 0 THEN 0.120000
      WHEN p_duration_seconds <= 300 THEN 0.080000 + (p_duration_seconds / 300.000000) * 0.040000
      WHEN p_duration_seconds <= 420 THEN 0.120000 + ((p_duration_seconds - 300.000000) / 120.000000) * 0.030000
      WHEN p_duration_seconds <= 600 THEN 0.150000 + ((p_duration_seconds - 420.000000) / 180.000000) * 0.050000
      ELSE 0.200000
    END, 6);
$$;

CREATE TABLE IF NOT EXISTS public.take_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id UUID REFERENCES public.takes(id) ON DELETE SET NULL,
  audition_id UUID REFERENCES public.auditions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  step public.ai_usage_step NOT NULL,
  provider TEXT NOT NULL DEFAULT 'lovable_ai_gateway',
  model TEXT NOT NULL,
  prompt_version TEXT,
  provider_contract TEXT,
  status public.ai_usage_status NOT NULL,
  success BOOLEAN NOT NULL,
  http_status INTEGER,
  failure_reason TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER NOT NULL,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  cost_source public.ai_usage_cost_source NOT NULL DEFAULT 'planning_baseline',
  video_duration_seconds NUMERIC(10, 2),
  duration_status TEXT,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  repair_attempt BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT take_ai_usage_model_present CHECK (length(trim(model)) > 0),
  CONSTRAINT take_ai_usage_provider_present CHECK (length(trim(provider)) > 0),
  CONSTRAINT take_ai_usage_http_status_valid CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599)),
  CONSTRAINT take_ai_usage_tokens_non_negative CHECK ((prompt_tokens IS NULL OR prompt_tokens >= 0) AND (completion_tokens IS NULL OR completion_tokens >= 0) AND (total_tokens IS NULL OR total_tokens >= 0)),
  CONSTRAINT take_ai_usage_latency_non_negative CHECK (latency_ms >= 0),
  CONSTRAINT take_ai_usage_cost_non_negative CHECK (estimated_cost_usd >= 0),
  CONSTRAINT take_ai_usage_duration_non_negative CHECK (video_duration_seconds IS NULL OR video_duration_seconds > 0),
  CONSTRAINT take_ai_usage_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT take_ai_usage_status_success_consistent CHECK ((status = 'success' AND success = TRUE) OR (status <> 'success' AND success = FALSE))
);

ALTER TABLE public.take_ai_usage ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.take_ai_usage TO service_role;
REVOKE ALL ON TABLE public.take_ai_usage FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.estimate_ai_report_cost_usd(NUMERIC) FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS take_ai_usage_take_created_idx ON public.take_ai_usage (take_id, created_at DESC) WHERE take_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS take_ai_usage_audition_created_idx ON public.take_ai_usage (audition_id, created_at DESC) WHERE audition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS take_ai_usage_step_status_idx ON public.take_ai_usage (step, status, created_at DESC);
CREATE INDEX IF NOT EXISTS take_ai_usage_model_created_idx ON public.take_ai_usage (provider, model, created_at DESC);
CREATE INDEX IF NOT EXISTS take_ai_usage_duration_status_idx ON public.take_ai_usage (duration_status, created_at DESC) WHERE duration_status IS NOT NULL;

CREATE OR REPLACE VIEW public.take_ai_report_costs AS
WITH usage_rollup AS (
  SELECT usage.take_id,
    (array_agg(usage.audition_id ORDER BY usage.created_at DESC) FILTER (WHERE usage.audition_id IS NOT NULL))[1] AS audition_id,
    (array_agg(usage.user_id ORDER BY usage.created_at DESC) FILTER (WHERE usage.user_id IS NOT NULL))[1] AS user_id,
    COUNT(*)::INTEGER AS ai_call_count,
    COUNT(*) FILTER (WHERE usage.status = 'success')::INTEGER AS successful_call_count,
    COUNT(*) FILTER (WHERE usage.status <> 'success')::INTEGER AS failed_call_count,
    COUNT(*) FILTER (WHERE usage.fallback_used OR usage.step = 'fallback')::INTEGER AS fallback_call_count,
    COUNT(*) FILTER (WHERE usage.repair_attempt OR usage.step = 'repair')::INTEGER AS repair_call_count,
    COALESCE(SUM(usage.prompt_tokens), 0)::INTEGER AS prompt_tokens,
    COALESCE(SUM(usage.completion_tokens), 0)::INTEGER AS completion_tokens,
    COALESCE(SUM(usage.total_tokens), 0)::INTEGER AS total_tokens,
    COALESCE(SUM(usage.latency_ms), 0)::INTEGER AS total_latency_ms,
    ROUND(COALESCE(SUM(usage.estimated_cost_usd), 0), 6) AS recorded_estimated_cost_usd,
    MAX(usage.video_duration_seconds) AS usage_duration_seconds,
    MAX(usage.duration_status) AS usage_duration_status,
    MAX(usage.created_at) AS last_ai_usage_at
  FROM public.take_ai_usage usage
  WHERE usage.take_id IS NOT NULL
  GROUP BY usage.take_id
),
latest_reservation AS (
  SELECT DISTINCT ON (reservation.take_id)
    reservation.take_id, reservation.id AS reservation_id, reservation.source AS credit_source,
    reservation.credit_grant_id, reservation.synthetic_usage, reservation.commercial_metrics_excluded, reservation.reserved_at
  FROM public.report_credit_reservations reservation
  WHERE reservation.take_id IS NOT NULL
  ORDER BY reservation.take_id, reservation.reserved_at DESC
),
partner_context AS (
  SELECT reservation.take_id, partner.id AS partner_id, partner.name AS partner_name, partner.type AS partner_type
  FROM latest_reservation reservation
  LEFT JOIN public.credit_grants grant_row ON grant_row.id = reservation.credit_grant_id
  LEFT JOIN public.partner_memberships membership ON grant_row.source_reference_type = 'partner_membership' AND grant_row.source_reference_id = membership.id::TEXT
  LEFT JOIN public.partners partner ON partner.id = membership.partner_id OR (grant_row.source_reference_type = 'partner' AND grant_row.source_reference_id = partner.id::TEXT)
),
take_duration AS (
  SELECT take_row.id AS take_id,
    COALESCE(take_row.mux_duration_seconds::NUMERIC,
      CASE
        WHEN (take_row.signals ->> 'duration_seconds') ~ '^[0-9]+(\.[0-9]+)?$' THEN (take_row.signals ->> 'duration_seconds')::NUMERIC
        WHEN (take_row.signals ->> 'duration') ~ '^[0-9]+(\.[0-9]+)?$' THEN (take_row.signals ->> 'duration')::NUMERIC
        WHEN (take_row.checklist #>> '{duration,seconds}') ~ '^[0-9]+(\.[0-9]+)?$' THEN (take_row.checklist #>> '{duration,seconds}')::NUMERIC
        ELSE NULL
      END) AS duration_seconds
  FROM public.takes take_row
)
SELECT take_row.id AS take_id, take_row.audition_id, take_row.user_id, take_row.status AS take_status,
  take_row.created_at AS take_created_at, take_row.updated_at AS take_updated_at, take_row.overall_score,
  COALESCE(usage_rollup.ai_call_count, 0)::INTEGER AS ai_call_count,
  COALESCE(usage_rollup.successful_call_count, 0)::INTEGER AS successful_call_count,
  COALESCE(usage_rollup.failed_call_count, 0)::INTEGER AS failed_call_count,
  COALESCE(usage_rollup.fallback_call_count, 0)::INTEGER AS fallback_call_count,
  COALESCE(usage_rollup.repair_call_count, 0)::INTEGER AS repair_call_count,
  COALESCE(usage_rollup.prompt_tokens, 0)::INTEGER AS prompt_tokens,
  COALESCE(usage_rollup.completion_tokens, 0)::INTEGER AS completion_tokens,
  COALESCE(usage_rollup.total_tokens, 0)::INTEGER AS total_tokens,
  COALESCE(usage_rollup.total_latency_ms, 0)::INTEGER AS total_latency_ms,
  COALESCE(usage_rollup.usage_duration_seconds, take_duration.duration_seconds) AS video_duration_seconds,
  COALESCE(usage_rollup.usage_duration_status, NULLIF(take_row.signals ->> 'duration_status', ''),
    CASE
      WHEN take_duration.duration_seconds > 600 THEN 'over_hard_cap'
      WHEN take_duration.duration_seconds > 300 THEN 'over_soft_guidance'
      WHEN take_duration.duration_seconds IS NOT NULL THEN 'within_target'
      ELSE 'unknown'
    END) AS duration_status,
  latest_reservation.credit_source AS credit_source,
  COALESCE(latest_reservation.synthetic_usage, FALSE) AS synthetic_usage,
  COALESCE(latest_reservation.commercial_metrics_excluded, FALSE) AS commercial_metrics_excluded,
  partner_context.partner_id, partner_context.partner_name, partner_context.partner_type,
  CASE WHEN COALESCE(usage_rollup.ai_call_count, 0) > 0 THEN usage_rollup.recorded_estimated_cost_usd
       ELSE public.estimate_ai_report_cost_usd(take_duration.duration_seconds) END AS report_estimated_cost_usd,
  CASE WHEN COALESCE(usage_rollup.ai_call_count, 0) > 0 THEN 'recorded_ai_usage' ELSE 'duration_baseline' END AS report_cost_source,
  usage_rollup.last_ai_usage_at
FROM public.takes take_row
LEFT JOIN usage_rollup ON usage_rollup.take_id = take_row.id
LEFT JOIN take_duration ON take_duration.take_id = take_row.id
LEFT JOIN latest_reservation ON latest_reservation.take_id = take_row.id
LEFT JOIN partner_context ON partner_context.take_id = take_row.id
WHERE take_row.report IS NOT NULL OR take_row.status = 'complete';

CREATE OR REPLACE VIEW public.ai_usage_cost_dashboard AS
SELECT COUNT(*)::INTEGER AS report_count,
  ROUND(COALESCE(SUM(report_estimated_cost_usd), 0), 6) AS estimated_total_cost_usd,
  ROUND(COALESCE(AVG(report_estimated_cost_usd), 0), 6) AS average_report_cost_usd,
  ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY report_estimated_cost_usd), 0)::NUMERIC, 6) AS p50_report_cost_usd,
  ROUND(COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY report_estimated_cost_usd), 0)::NUMERIC, 6) AS p95_report_cost_usd,
  SUM(ai_call_count)::INTEGER AS ai_call_count,
  SUM(failed_call_count)::INTEGER AS failed_call_count,
  SUM(fallback_call_count)::INTEGER AS fallback_call_count,
  SUM(repair_call_count)::INTEGER AS repair_call_count,
  ROUND(COALESCE(SUM(fallback_call_count)::NUMERIC / NULLIF(SUM(ai_call_count), 0), 0), 4) AS fallback_rate,
  ROUND(COALESCE(SUM(repair_call_count)::NUMERIC / NULLIF(SUM(ai_call_count), 0), 0), 4) AS repair_rate,
  0.080000::NUMERIC(10, 6) AS planning_baseline_min_usd,
  0.200000::NUMERIC(10, 6) AS planning_baseline_max_usd,
  0.120000::NUMERIC(10, 6) AS planning_baseline_6_7_min_low_usd,
  0.150000::NUMERIC(10, 6) AS planning_baseline_6_7_min_high_usd,
  0.150000::NUMERIC(10, 6) AS p50_watch_threshold_usd,
  0.200000::NUMERIC(10, 6) AS p95_watch_threshold_usd
FROM public.take_ai_report_costs;

CREATE OR REPLACE VIEW public.ai_usage_cost_grouping_summary AS
SELECT COALESCE(credit_source::TEXT, CASE WHEN synthetic_usage THEN 'synthetic_usage' ELSE 'unknown' END) AS credit_source_group,
  partner_id, partner_name, partner_type, duration_status,
  COUNT(*)::INTEGER AS report_count,
  ROUND(COALESCE(SUM(report_estimated_cost_usd), 0), 6) AS estimated_total_cost_usd,
  ROUND(COALESCE(AVG(report_estimated_cost_usd), 0), 6) AS average_report_cost_usd,
  ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY report_estimated_cost_usd), 0)::NUMERIC, 6) AS p50_report_cost_usd,
  ROUND(COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY report_estimated_cost_usd), 0)::NUMERIC, 6) AS p95_report_cost_usd,
  SUM(ai_call_count)::INTEGER AS ai_call_count,
  ROUND(COALESCE(SUM(fallback_call_count)::NUMERIC / NULLIF(SUM(ai_call_count), 0), 0), 4) AS fallback_rate,
  ROUND(COALESCE(SUM(repair_call_count)::NUMERIC / NULLIF(SUM(ai_call_count), 0), 0), 4) AS repair_rate
FROM public.take_ai_report_costs
GROUP BY COALESCE(credit_source::TEXT, CASE WHEN synthetic_usage THEN 'synthetic_usage' ELSE 'unknown' END),
  partner_id, partner_name, partner_type, duration_status;

CREATE OR REPLACE VIEW public.ai_usage_model_cost_summary AS
SELECT provider, model, step, status,
  COUNT(*)::INTEGER AS call_count,
  ROUND(COALESCE(SUM(estimated_cost_usd), 0), 6) AS estimated_cost_usd,
  ROUND(COALESCE(AVG(latency_ms), 0), 2) AS average_latency_ms,
  ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms), 0)::NUMERIC, 2) AS p50_latency_ms,
  ROUND(COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::NUMERIC, 2) AS p95_latency_ms,
  COALESCE(SUM(prompt_tokens), 0)::INTEGER AS prompt_tokens,
  COALESCE(SUM(completion_tokens), 0)::INTEGER AS completion_tokens,
  COALESCE(SUM(total_tokens), 0)::INTEGER AS total_tokens,
  COUNT(*) FILTER (WHERE fallback_used OR step = 'fallback')::INTEGER AS fallback_call_count,
  COUNT(*) FILTER (WHERE repair_attempt OR step = 'repair')::INTEGER AS repair_call_count
FROM public.take_ai_usage
GROUP BY provider, model, step, status;

REVOKE ALL ON TABLE public.take_ai_report_costs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_cost_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_cost_grouping_summary FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_model_cost_summary FROM PUBLIC, anon, authenticated;