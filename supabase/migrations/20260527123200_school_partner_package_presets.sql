-- DS-08: School / MT college pilot package presets.
--
-- This is the school package catalogue/template foundation only. Stripe
-- checkout, public landing pages, renewal-report UI and package-specific
-- dashboards are owned by later DS slices.

CREATE TABLE IF NOT EXISTS public.partner_package_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  package_tier TEXT NOT NULL,
  partner_type public.partner_type NOT NULL,
  display_context TEXT NOT NULL,
  billing_period TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  unit_amount_pence INTEGER NOT NULL,
  included_seats INTEGER NOT NULL,
  credits_per_member INTEGER NOT NULL,
  total_credits INTEGER NOT NULL,
  per_user_cap INTEGER NOT NULL,
  pool_period_type public.partner_credit_pool_period_type NOT NULL,
  progress_visibility_scope public.partner_visibility_scope NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_package_presets_sku_format CHECK (sku ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  CONSTRAINT partner_package_presets_school_context CHECK (
    partner_type = 'school'
    AND display_context = 'school_mt_college_pilot'
    AND billing_period = 'term'
    AND package_tier IN ('pilot', 'growth')
  ),
  CONSTRAINT partner_package_presets_currency_gbp CHECK (currency = 'GBP'),
  CONSTRAINT partner_package_presets_price_positive CHECK (unit_amount_pence > 0),
  CONSTRAINT partner_package_presets_seats_positive CHECK (included_seats > 0),
  CONSTRAINT partner_package_presets_credits_positive CHECK (
    credits_per_member > 0 AND total_credits > 0 AND per_user_cap > 0
  ),
  CONSTRAINT partner_package_presets_school_credits CHECK (
    credits_per_member = 12
    AND per_user_cap = 12
    AND total_credits = included_seats * credits_per_member
  ),
  CONSTRAINT partner_package_presets_school_pool CHECK (
    pool_period_type = 'term' AND progress_visibility_scope = 'named_progress'
  ),
  CONSTRAINT partner_package_presets_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.partner_package_presets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.partner_package_presets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.partner_package_presets TO service_role;

DROP TRIGGER IF EXISTS partner_package_presets_set_updated_at
  ON public.partner_package_presets;
CREATE TRIGGER partner_package_presets_set_updated_at
BEFORE UPDATE ON public.partner_package_presets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS partner_package_presets_context_active_idx
  ON public.partner_package_presets (display_context, active, display_order, sku);

INSERT INTO public.partner_package_presets (
  sku,
  name,
  description,
  package_tier,
  partner_type,
  display_context,
  billing_period,
  currency,
  unit_amount_pence,
  included_seats,
  credits_per_member,
  total_credits,
  per_user_cap,
  pool_period_type,
  progress_visibility_scope,
  active,
  display_order,
  metadata
)
VALUES
  (
    'school-pilot-term-gbp-500',
    'School Pilot',
    'Term pilot for up to 25 students, with 12 TapeCoach credits per student.',
    'pilot',
    'school',
    'school_mt_college_pilot',
    'term',
    'GBP',
    50000,
    25,
    12,
    300,
    12,
    'term',
    'named_progress',
    TRUE,
    10,
    jsonb_build_object('launch_package', true)
  ),
  (
    'school-growth-term-gbp-1000',
    'School Growth',
    'Term growth package for up to 60 students, with 12 TapeCoach credits per student.',
    'growth',
    'school',
    'school_mt_college_pilot',
    'term',
    'GBP',
    100000,
    60,
    12,
    720,
    12,
    'term',
    'named_progress',
    TRUE,
    20,
    jsonb_build_object('launch_package', true)
  )
ON CONFLICT (sku) DO NOTHING;
