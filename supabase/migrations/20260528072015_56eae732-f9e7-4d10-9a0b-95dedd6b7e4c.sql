ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_school_context;
ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_school_credits;
ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_school_pool;
ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_supported_context;

ALTER TABLE public.partner_package_presets
  ADD CONSTRAINT partner_package_presets_supported_context CHECK (
    (partner_type = 'school' AND display_context = 'school_mt_college_pilot'
       AND billing_period = 'term' AND package_tier IN ('pilot', 'growth'))
    OR
    (partner_type = 'coach' AND display_context = 'coach_pilot'
       AND billing_period = 'monthly' AND package_tier IN ('starter', 'studio'))
  );

ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_package_credits;
ALTER TABLE public.partner_package_presets
  ADD CONSTRAINT partner_package_presets_package_credits CHECK (
    (partner_type = 'school' AND credits_per_member = 12 AND per_user_cap = 12
       AND total_credits = included_seats * credits_per_member)
    OR
    (partner_type = 'coach' AND credits_per_member = per_user_cap
       AND per_user_cap IN (6, 10)
       AND total_credits >= included_seats * credits_per_member)
  );

ALTER TABLE public.partner_package_presets
  DROP CONSTRAINT IF EXISTS partner_package_presets_pool_visibility;
ALTER TABLE public.partner_package_presets
  ADD CONSTRAINT partner_package_presets_pool_visibility CHECK (
    (partner_type = 'school' AND pool_period_type = 'term'
       AND progress_visibility_scope = 'named_progress')
    OR
    (partner_type = 'coach' AND pool_period_type = 'monthly'
       AND progress_visibility_scope = 'named_progress')
  );

INSERT INTO public.partner_package_presets (
  sku, name, description, package_tier, partner_type, display_context,
  billing_period, currency, unit_amount_pence, included_seats, credits_per_member,
  total_credits, per_user_cap, pool_period_type, progress_visibility_scope,
  active, display_order, metadata
)
VALUES
  ('coach-starter-monthly-gbp-29', 'Coach Starter',
   'Monthly coach package with 40 TapeCoach credits and a 6-credit performer cap.',
   'starter', 'coach', 'coach_pilot', 'monthly', 'GBP',
   2900, 6, 6, 40, 6, 'monthly', 'named_progress', TRUE, 10,
   jsonb_build_object('launch_package', true, 'sales_route', 'coach_pilot',
     'full_report_private_by_default', true)),
  ('coach-studio-monthly-gbp-79', 'Coach Studio',
   'Monthly coach package with 150 TapeCoach credits and a 10-credit performer cap.',
   'studio', 'coach', 'coach_pilot', 'monthly', 'GBP',
   7900, 15, 10, 150, 10, 'monthly', 'named_progress', TRUE, 20,
   jsonb_build_object('launch_package', true, 'sales_route', 'coach_pilot',
     'full_report_private_by_default', true))
ON CONFLICT (sku) DO NOTHING;