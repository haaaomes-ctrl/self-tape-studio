ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_supported_context;
ALTER TABLE public.partner_package_presets
  ADD CONSTRAINT partner_package_presets_supported_context CHECK (
    (partner_type = 'school' AND display_context = 'school_mt_college_pilot'
       AND billing_period = 'term' AND package_tier IN ('pilot', 'growth'))
    OR (partner_type = 'coach' AND display_context = 'coach_pilot'
       AND billing_period = 'monthly' AND package_tier IN ('starter', 'studio'))
    OR (partner_type = 'agent' AND display_context = 'agent_trial'
       AND billing_period = 'monthly' AND package_tier IN ('trial', 'growth'))
  );

ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_package_credits;
ALTER TABLE public.partner_package_presets
  ADD CONSTRAINT partner_package_presets_package_credits CHECK (
    (partner_type = 'school' AND credits_per_member = 12 AND per_user_cap = 12
       AND total_credits = included_seats * credits_per_member)
    OR (partner_type = 'coach' AND credits_per_member = per_user_cap
       AND per_user_cap IN (6, 10)
       AND total_credits >= included_seats * credits_per_member)
    OR (partner_type = 'agent' AND credits_per_member = per_user_cap
       AND per_user_cap IN (3, 6)
       AND total_credits >= included_seats * credits_per_member)
  );

ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_pool_visibility;
ALTER TABLE public.partner_package_presets
  ADD CONSTRAINT partner_package_presets_pool_visibility CHECK (
    (partner_type = 'school' AND pool_period_type = 'term'
       AND progress_visibility_scope = 'named_progress')
    OR (partner_type = 'coach' AND pool_period_type = 'monthly'
       AND progress_visibility_scope = 'named_progress')
    OR (partner_type = 'agent' AND pool_period_type = 'monthly'
       AND progress_visibility_scope = 'limited_usage_readiness')
  );

INSERT INTO public.partner_package_presets (
  sku, name, description, package_tier, partner_type, display_context,
  billing_period, currency, unit_amount_pence, included_seats, credits_per_member,
  total_credits, per_user_cap, pool_period_type, progress_visibility_scope,
  active, display_order, metadata
)
VALUES
  ('agent-trial-monthly-gbp-49', 'Agent Trial',
   'Monthly agent trial with 75 TapeCoach credits and a 3-credit performer cap.',
   'trial', 'agent', 'agent_trial', 'monthly', 'GBP',
   4900, 25, 3, 75, 3, 'monthly', 'limited_usage_readiness', TRUE, 10,
   jsonb_build_object('launch_package', true, 'sales_route', 'agent_trial',
     'full_report_requires_performer_share', true)),
  ('agent-growth-monthly-gbp-99', 'Agent Growth',
   'Monthly agent growth package with 175 TapeCoach credits and a 6-credit performer cap.',
   'growth', 'agent', 'agent_trial', 'monthly', 'GBP',
   9900, 29, 6, 175, 6, 'monthly', 'limited_usage_readiness', TRUE, 20,
   jsonb_build_object('launch_package', true, 'sales_route', 'agent_trial',
     'full_report_requires_performer_share', true))
ON CONFLICT (sku) DO NOTHING;