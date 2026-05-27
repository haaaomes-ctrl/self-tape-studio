-- DS-03: optional consumer top-up product catalogue.
--
-- Checkout, payment webhooks, revenue ledger entries and credit grants are
-- intentionally out of scope for this migration. DS-03 only establishes the
-- admin-configurable catalogue rows that later Stripe checkout work can use.

CREATE TABLE IF NOT EXISTS public.consumer_credit_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  credit_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  unit_amount_pence INTEGER NOT NULL,
  stripe_price_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 100,
  founding_price BOOLEAN NOT NULL DEFAULT FALSE,
  display_context TEXT NOT NULL DEFAULT 'secondary_consumer_top_up',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT consumer_credit_products_sku_format CHECK (sku ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  CONSTRAINT consumer_credit_products_credit_amount_positive CHECK (credit_amount > 0),
  CONSTRAINT consumer_credit_products_unit_amount_positive CHECK (unit_amount_pence > 0),
  CONSTRAINT consumer_credit_products_currency_gbp CHECK (currency = 'GBP'),
  CONSTRAINT consumer_credit_products_stripe_price_id_format CHECK (
    stripe_price_id IS NULL OR stripe_price_id ~ '^price_[A-Za-z0-9_]+$'
  ),
  CONSTRAINT consumer_credit_products_display_context_known CHECK (
    display_context = 'secondary_consumer_top_up'
  )
);

ALTER TABLE public.consumer_credit_products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.consumer_credit_products FROM anon, authenticated;

DROP TRIGGER IF EXISTS consumer_credit_products_set_updated_at ON public.consumer_credit_products;
CREATE TRIGGER consumer_credit_products_set_updated_at
BEFORE UPDATE ON public.consumer_credit_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.consumer_credit_products (
  sku,
  name,
  description,
  credit_amount,
  currency,
  unit_amount_pence,
  stripe_price_id,
  active,
  display_order,
  founding_price,
  display_context
)
VALUES
  (
    'consumer-top-up-3-gbp-299',
    'Starter top-up',
    'Adds 3 TapeCoach report credits for performers who need more than their free or partner-funded allowance.',
    3,
    'GBP',
    299,
    NULL,
    TRUE,
    10,
    TRUE,
    'secondary_consumer_top_up'
  ),
  (
    'consumer-top-up-10-gbp-799',
    'Habit top-up',
    'Adds 10 TapeCoach report credits for performers using TapeCoach across repeated self-tape practice.',
    10,
    'GBP',
    799,
    NULL,
    TRUE,
    20,
    TRUE,
    'secondary_consumer_top_up'
  )
ON CONFLICT (sku) DO NOTHING;
