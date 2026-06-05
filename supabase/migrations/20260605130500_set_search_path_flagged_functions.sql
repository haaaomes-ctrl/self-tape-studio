-- WS5 commit 2: pin search_path on the advisor-flagged SECURITY DEFINER /
-- definer-adjacent functions (mutable search_path warning).
--
-- ALTER FUNCTION ... SET search_path pins resolution without restating the
-- bodies, so behaviour and grants are untouched. Schema lists were verified
-- per function against the live bodies (2026-06-05):
--   - the four email-queue RPCs call pgmq.* -> search_path = public, pgmq
--   - the analytics/crm/cost helpers reference only public + built-ins
--     (no vault/net/extensions/auth/storage/cron references) -> public
-- record_analytics_event is deliberately NOT touched: it already has
-- SET search_path = public.

-- Email-queue RPCs (bodies call pgmq.send / pgmq.read / pgmq.delete)
ALTER FUNCTION public.enqueue_email(queue_name text, payload jsonb)
  SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
  SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(queue_name text, message_id bigint)
  SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
  SET search_path = public, pgmq;

-- Pure helpers (public + pg_catalog built-ins only)
ALTER FUNCTION public.analytics_safe_text(p_value text, p_max_length integer)
  SET search_path = public;
ALTER FUNCTION public.estimate_ai_report_cost_usd(p_duration_seconds numeric)
  SET search_path = public;
ALTER FUNCTION public.crm_normalize_email(p_email text)
  SET search_path = public;
ALTER FUNCTION public.crm_message_category_requires_consent(p_category text)
  SET search_path = public;
ALTER FUNCTION public.crm_safe_template_data(p_template_data jsonb)
  SET search_path = public;
ALTER FUNCTION public.crm_build_unsubscribe_url(p_token text, p_base_url text)
  SET search_path = public;
