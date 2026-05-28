-- DS-13: optional consumer credit packs, Stripe Checkout and webhooks.
--
-- DS-03 created the configurable consumer top-up catalogue, DS-04 created the
-- credit ledger, and DS-12 wired report-generation credit holds. This migration
-- adds the payment/revenue reconciliation layer for optional user-paid top-ups.

DO $$
BEGIN
  CREATE TYPE public.consumer_credit_payment_status AS ENUM (
    'checkout_created',
    'checkout_completed',
    'payment_succeeded',
    'payment_failed',
    'refunded',
    'disputed',
    'requires_review'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.consumer_credit_revenue_event_type AS ENUM (
    'checkout_session_created',
    'checkout_session_completed',
    'payment_succeeded',
    'payment_failed',
    'refund',
    'dispute'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.consumer_credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  credit_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  amount_total_pence INTEGER NOT NULL,
  stripe_price_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  status public.consumer_credit_payment_status NOT NULL DEFAULT 'checkout_created',
  credit_grant_id UUID REFERENCES public.credit_grants(id) ON DELETE SET NULL,
  latest_stripe_event_id TEXT,
  failure_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT consumer_credit_payments_sku_format CHECK (product_sku ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  CONSTRAINT consumer_credit_payments_credit_amount_positive CHECK (credit_amount > 0),
  CONSTRAINT consumer_credit_payments_amount_positive CHECK (amount_total_pence > 0),
  CONSTRAINT consumer_credit_payments_currency_gbp CHECK (currency = 'GBP'),
  CONSTRAINT consumer_credit_payments_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.consumer_credit_revenue_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.consumer_credit_payments(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type public.consumer_credit_revenue_event_type NOT NULL,
  stripe_event_id TEXT NOT NULL,
  stripe_object_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_pence INTEGER,
  currency TEXT NOT NULL DEFAULT 'GBP',
  credit_delta INTEGER NOT NULL DEFAULT 0,
  credit_grant_id UUID REFERENCES public.credit_grants(id) ON DELETE SET NULL,
  processing_status TEXT NOT NULL DEFAULT 'processed',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT consumer_credit_revenue_amount_nonzero CHECK (
    amount_pence IS NULL OR amount_pence > 0
  ),
  CONSTRAINT consumer_credit_revenue_currency_gbp CHECK (currency = 'GBP'),
  CONSTRAINT consumer_credit_revenue_processing_status_known CHECK (
    processing_status IN ('processed', 'duplicate_ignored', 'requires_review')
  ),
  CONSTRAINT consumer_credit_revenue_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.consumer_credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_credit_revenue_ledger_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.consumer_credit_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.consumer_credit_revenue_ledger_entries FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS consumer_credit_payments_set_updated_at ON public.consumer_credit_payments;
CREATE TRIGGER consumer_credit_payments_set_updated_at
BEFORE UPDATE ON public.consumer_credit_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS consumer_credit_revenue_ledger_entries_set_updated_at
  ON public.consumer_credit_revenue_ledger_entries;
CREATE TRIGGER consumer_credit_revenue_ledger_entries_set_updated_at
BEFORE UPDATE ON public.consumer_credit_revenue_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS consumer_credit_payments_checkout_session_idx
  ON public.consumer_credit_payments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS consumer_credit_payments_payment_intent_idx
  ON public.consumer_credit_payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS consumer_credit_payments_user_status_idx
  ON public.consumer_credit_payments (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS consumer_credit_payments_credit_grant_idx
  ON public.consumer_credit_payments (credit_grant_id)
  WHERE credit_grant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS consumer_credit_revenue_stripe_event_idx
  ON public.consumer_credit_revenue_ledger_entries (stripe_event_id);
CREATE INDEX IF NOT EXISTS consumer_credit_revenue_payment_idx
  ON public.consumer_credit_revenue_ledger_entries (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consumer_credit_revenue_user_idx
  ON public.consumer_credit_revenue_ledger_entries (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE VIEW public.consumer_credit_payment_reconciliation AS
SELECT
  payment.id AS payment_id,
  payment.user_id,
  payment.product_sku,
  payment.credit_amount,
  payment.currency,
  payment.amount_total_pence,
  payment.stripe_price_id,
  payment.stripe_checkout_session_id,
  payment.stripe_payment_intent_id,
  payment.status,
  payment.credit_grant_id,
  grant_row.remaining_credits,
  grant_row.status AS credit_grant_status,
  payment.latest_stripe_event_id,
  payment.failure_code,
  payment.created_at,
  payment.updated_at
FROM public.consumer_credit_payments payment
LEFT JOIN public.credit_grants grant_row
  ON grant_row.id = payment.credit_grant_id;

REVOKE ALL ON TABLE public.consumer_credit_payment_reconciliation FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_consumer_checkout_session(
  p_user_id UUID,
  p_product_sku TEXT,
  p_credit_amount INTEGER,
  p_currency TEXT,
  p_amount_total_pence INTEGER,
  p_stripe_price_id TEXT,
  p_stripe_checkout_session_id TEXT,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_id UUID;
  effective_metadata JSONB;
  local_event_id TEXT;
BEGIN
  effective_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(effective_metadata) <> 'object' THEN
    RAISE EXCEPTION 'checkout session metadata must be an object';
  END IF;
  IF p_credit_amount <= 0 OR p_amount_total_pence <= 0 THEN
    RAISE EXCEPTION 'checkout session credit and amount must be positive';
  END IF;
  IF UPPER(p_currency) <> 'GBP' THEN
    RAISE EXCEPTION 'consumer top-up checkout currently supports GBP only';
  END IF;

  INSERT INTO public.consumer_credit_payments (
    user_id,
    product_sku,
    credit_amount,
    currency,
    amount_total_pence,
    stripe_price_id,
    stripe_checkout_session_id,
    stripe_customer_id,
    status,
    metadata
  )
  VALUES (
    p_user_id,
    p_product_sku,
    p_credit_amount,
    'GBP',
    p_amount_total_pence,
    p_stripe_price_id,
    p_stripe_checkout_session_id,
    p_stripe_customer_id,
    'checkout_created',
    effective_metadata
  )
  ON CONFLICT (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL
  DO UPDATE SET
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, consumer_credit_payments.stripe_customer_id),
    metadata = consumer_credit_payments.metadata || EXCLUDED.metadata
  RETURNING id INTO payment_id;

  local_event_id := 'local_checkout_session_created:' || p_stripe_checkout_session_id;

  INSERT INTO public.consumer_credit_revenue_ledger_entries (
    payment_id,
    user_id,
    event_type,
    stripe_event_id,
    stripe_object_id,
    amount_pence,
    currency,
    metadata
  )
  VALUES (
    payment_id,
    p_user_id,
    'checkout_session_created',
    local_event_id,
    p_stripe_checkout_session_id,
    p_amount_total_pence,
    'GBP',
    effective_metadata
  )
  ON CONFLICT (stripe_event_id) DO NOTHING;

  RETURN payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_consumer_credit_payment(
  p_stripe_event_id TEXT,
  p_checkout_session_id TEXT DEFAULT NULL,
  p_payment_intent_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_product_sku TEXT DEFAULT NULL,
  p_credit_amount INTEGER DEFAULT NULL,
  p_currency TEXT DEFAULT 'GBP',
  p_amount_total_pence INTEGER DEFAULT NULL,
  p_stripe_price_id TEXT DEFAULT NULL,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_event_type public.consumer_credit_revenue_event_type DEFAULT 'checkout_session_completed',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment public.consumer_credit_payments%ROWTYPE;
  existing_payment_id UUID;
  grant_id UUID;
  grant_created BOOLEAN := FALSE;
  idempotency_reference TEXT;
  effective_metadata JSONB;
  effective_status public.consumer_credit_payment_status;
BEGIN
  effective_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(effective_metadata) <> 'object' THEN
    RAISE EXCEPTION 'payment metadata must be an object';
  END IF;
  IF p_event_type NOT IN ('checkout_session_completed', 'payment_succeeded') THEN
    RAISE EXCEPTION 'complete event must be checkout_session_completed or payment_succeeded';
  END IF;
  IF p_stripe_event_id IS NULL OR p_stripe_event_id = '' THEN
    RAISE EXCEPTION 'stripe event id is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.consumer_credit_revenue_ledger_entries
    WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    SELECT payment_id INTO existing_payment_id
    FROM public.consumer_credit_revenue_ledger_entries
    WHERE stripe_event_id = p_stripe_event_id
    LIMIT 1;
    RETURN existing_payment_id;
  END IF;

  SELECT * INTO payment
  FROM public.consumer_credit_payments
  WHERE (p_checkout_session_id IS NOT NULL AND stripe_checkout_session_id = p_checkout_session_id)
     OR (p_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_payment_intent_id)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_user_id IS NULL OR p_product_sku IS NULL OR p_credit_amount IS NULL OR p_amount_total_pence IS NULL THEN
      INSERT INTO public.consumer_credit_revenue_ledger_entries (
        user_id,
        event_type,
        stripe_event_id,
        stripe_object_id,
        stripe_payment_intent_id,
        amount_pence,
        currency,
        processing_status,
        metadata
      )
      VALUES (
        p_user_id,
        p_event_type,
        p_stripe_event_id,
        COALESCE(p_checkout_session_id, p_payment_intent_id, p_stripe_event_id),
        p_payment_intent_id,
        p_amount_total_pence,
        'GBP',
        'requires_review',
        effective_metadata || '{"requires_review_reason":"missing_payment_metadata"}'::jsonb
      );
      RETURN NULL;
    END IF;

    INSERT INTO public.consumer_credit_payments (
      user_id,
      product_sku,
      credit_amount,
      currency,
      amount_total_pence,
      stripe_price_id,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      stripe_customer_id,
      status,
      metadata
    )
    VALUES (
      p_user_id,
      p_product_sku,
      p_credit_amount,
      'GBP',
      p_amount_total_pence,
      p_stripe_price_id,
      p_checkout_session_id,
      p_payment_intent_id,
      p_stripe_customer_id,
      'checkout_created',
      effective_metadata
    )
    RETURNING * INTO payment;
  END IF;

  IF payment.credit_grant_id IS NULL THEN
    idempotency_reference := COALESCE(
      payment.stripe_checkout_session_id,
      p_checkout_session_id,
      p_payment_intent_id,
      p_stripe_event_id
    );
    grant_id := public.grant_funded_credits(
      payment.user_id,
      'user_paid',
      payment.credit_amount,
      now(),
      NULL,
      'stripe_checkout_session',
      idempotency_reference,
      payment.product_sku,
      NULL,
      'Consumer Stripe Checkout payment',
      payment.metadata || effective_metadata || jsonb_build_object(
        'stripe_checkout_session_id', COALESCE(payment.stripe_checkout_session_id, p_checkout_session_id),
        'stripe_payment_intent_id', COALESCE(payment.stripe_payment_intent_id, p_payment_intent_id),
        'amount_total_pence', payment.amount_total_pence,
        'currency', payment.currency
      ),
      'consumer-credit-grant_row:' || idempotency_reference
    );
    grant_created := TRUE;
  ELSE
    grant_id := payment.credit_grant_id;
  END IF;

  effective_status := CASE
    WHEN p_event_type = 'payment_succeeded' THEN 'payment_succeeded'::public.consumer_credit_payment_status
    ELSE 'checkout_completed'::public.consumer_credit_payment_status
  END;

  UPDATE public.consumer_credit_payments
  SET
    status = effective_status,
    stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    credit_grant_id = grant_id,
    latest_stripe_event_id = p_stripe_event_id,
    failure_code = NULL,
    metadata = metadata || effective_metadata
  WHERE id = payment.id
  RETURNING * INTO payment;

  INSERT INTO public.consumer_credit_revenue_ledger_entries (
    payment_id,
    user_id,
    event_type,
    stripe_event_id,
    stripe_object_id,
    stripe_payment_intent_id,
    amount_pence,
    currency,
    credit_delta,
    credit_grant_id,
    metadata
  )
  VALUES (
    payment.id,
    payment.user_id,
    p_event_type,
    p_stripe_event_id,
    COALESCE(p_checkout_session_id, p_payment_intent_id, p_stripe_event_id),
    COALESCE(p_payment_intent_id, payment.stripe_payment_intent_id),
    payment.amount_total_pence,
    payment.currency,
    CASE WHEN grant_created THEN payment.credit_amount ELSE 0 END,
    grant_id,
    effective_metadata
  );

  RETURN payment.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_consumer_credit_payment_failed(
  p_stripe_event_id TEXT,
  p_checkout_session_id TEXT DEFAULT NULL,
  p_payment_intent_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_product_sku TEXT DEFAULT NULL,
  p_credit_amount INTEGER DEFAULT NULL,
  p_currency TEXT DEFAULT 'GBP',
  p_amount_total_pence INTEGER DEFAULT NULL,
  p_stripe_price_id TEXT DEFAULT NULL,
  p_failure_code TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment public.consumer_credit_payments%ROWTYPE;
  existing_payment_id UUID;
  effective_metadata JSONB;
BEGIN
  effective_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(effective_metadata) <> 'object' THEN
    RAISE EXCEPTION 'payment failure metadata must be an object';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.consumer_credit_revenue_ledger_entries
    WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    SELECT payment_id INTO existing_payment_id
    FROM public.consumer_credit_revenue_ledger_entries
    WHERE stripe_event_id = p_stripe_event_id
    LIMIT 1;
    RETURN existing_payment_id;
  END IF;

  SELECT * INTO payment
  FROM public.consumer_credit_payments
  WHERE (p_checkout_session_id IS NOT NULL AND stripe_checkout_session_id = p_checkout_session_id)
     OR (p_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_payment_intent_id)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND AND p_user_id IS NOT NULL AND p_product_sku IS NOT NULL AND p_credit_amount IS NOT NULL AND p_amount_total_pence IS NOT NULL THEN
    INSERT INTO public.consumer_credit_payments (
      user_id,
      product_sku,
      credit_amount,
      currency,
      amount_total_pence,
      stripe_price_id,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      status,
      failure_code,
      latest_stripe_event_id,
      metadata
    )
    VALUES (
      p_user_id,
      p_product_sku,
      p_credit_amount,
      'GBP',
      p_amount_total_pence,
      p_stripe_price_id,
      p_checkout_session_id,
      p_payment_intent_id,
      'payment_failed',
      p_failure_code,
      p_stripe_event_id,
      effective_metadata
    )
    RETURNING * INTO payment;
  ELSIF FOUND THEN
    UPDATE public.consumer_credit_payments
    SET
      status = CASE
        WHEN credit_grant_id IS NULL THEN 'payment_failed'::public.consumer_credit_payment_status
        ELSE 'requires_review'::public.consumer_credit_payment_status
      END,
      stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
      latest_stripe_event_id = p_stripe_event_id,
      failure_code = p_failure_code,
      metadata = metadata || effective_metadata
    WHERE id = payment.id
    RETURNING * INTO payment;
  END IF;

  INSERT INTO public.consumer_credit_revenue_ledger_entries (
    payment_id,
    user_id,
    event_type,
    stripe_event_id,
    stripe_object_id,
    stripe_payment_intent_id,
    amount_pence,
    currency,
    processing_status,
    metadata
  )
  VALUES (
    payment.id,
    COALESCE(payment.user_id, p_user_id),
    'payment_failed',
    p_stripe_event_id,
    COALESCE(p_checkout_session_id, p_payment_intent_id, p_stripe_event_id),
    p_payment_intent_id,
    COALESCE(payment.amount_total_pence, p_amount_total_pence),
    'GBP',
    CASE WHEN payment.id IS NULL THEN 'requires_review' ELSE 'processed' END,
    effective_metadata || jsonb_build_object('failure_code', p_failure_code)
  );

  RETURN payment.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_or_flag_consumer_credit_payment(
  p_stripe_event_id TEXT,
  p_payment_intent_id TEXT DEFAULT NULL,
  p_checkout_session_id TEXT DEFAULT NULL,
  p_event_type public.consumer_credit_revenue_event_type DEFAULT 'refund',
  p_amount_pence INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment public.consumer_credit_payments%ROWTYPE;
  selected_grant public.credit_grants%ROWTYPE;
  existing_payment_id UUID;
  reversed_credit_delta INTEGER := 0;
  effective_metadata JSONB;
  next_status public.consumer_credit_payment_status;
BEGIN
  effective_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(effective_metadata) <> 'object' THEN
    RAISE EXCEPTION 'payment reversal metadata must be an object';
  END IF;
  IF p_event_type NOT IN ('refund', 'dispute') THEN
    RAISE EXCEPTION 'reversal event must be refund or dispute';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.consumer_credit_revenue_ledger_entries
    WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    SELECT payment_id INTO existing_payment_id
    FROM public.consumer_credit_revenue_ledger_entries
    WHERE stripe_event_id = p_stripe_event_id
    LIMIT 1;
    RETURN existing_payment_id;
  END IF;

  SELECT * INTO payment
  FROM public.consumer_credit_payments
  WHERE (p_checkout_session_id IS NOT NULL AND stripe_checkout_session_id = p_checkout_session_id)
     OR (p_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_payment_intent_id)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.consumer_credit_revenue_ledger_entries (
      event_type,
      stripe_event_id,
      stripe_object_id,
      stripe_payment_intent_id,
      amount_pence,
      currency,
      processing_status,
      metadata
    )
    VALUES (
      p_event_type,
      p_stripe_event_id,
      COALESCE(p_checkout_session_id, p_payment_intent_id, p_stripe_event_id),
      p_payment_intent_id,
      p_amount_pence,
      'GBP',
      'requires_review',
      effective_metadata || '{"requires_review_reason":"payment_not_found_for_reversal"}'::jsonb
    );
    RETURN NULL;
  END IF;

  IF payment.credit_grant_id IS NOT NULL THEN
    SELECT * INTO selected_grant
    FROM public.credit_grants
    WHERE id = payment.credit_grant_id
    FOR UPDATE;

    IF FOUND THEN
      IF selected_grant.remaining_credits > 0 THEN
        reversed_credit_delta := -selected_grant.remaining_credits;
        INSERT INTO public.credit_ledger_entries (
          user_id,
          source,
          entry_type,
          credit_delta,
          credit_grant_id,
          source_reference_type,
          source_reference_id,
          admin_reason,
          metadata,
          idempotency_key
        )
        VALUES (
          selected_grant.user_id,
          selected_grant.source,
          'admin_adjustment',
          reversed_credit_delta,
          selected_grant.id,
          'stripe_reversal',
          p_stripe_event_id,
          CASE
            WHEN p_event_type = 'dispute' THEN 'Stripe dispute/chargeback created'
            ELSE 'Stripe refund received'
          END,
          selected_grant.metadata || effective_metadata,
          'consumer-credit-reversal:' || p_stripe_event_id || ':remaining'
        )
        ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
      END IF;

      UPDATE public.credit_grants
      SET
        remaining_credits = 0,
        status = 'revoked',
        metadata = metadata || effective_metadata || jsonb_build_object(
          'reversal_status', p_event_type::TEXT,
          'stripe_event_id', p_stripe_event_id,
          'stripe_payment_intent_id', p_payment_intent_id
        )
      WHERE id = selected_grant.id;
    END IF;
  END IF;

  next_status := CASE
    WHEN p_event_type = 'dispute' THEN 'disputed'::public.consumer_credit_payment_status
    ELSE 'refunded'::public.consumer_credit_payment_status
  END;

  UPDATE public.consumer_credit_payments
  SET
    status = next_status,
    latest_stripe_event_id = p_stripe_event_id,
    metadata = metadata || effective_metadata
  WHERE id = payment.id
  RETURNING * INTO payment;

  INSERT INTO public.consumer_credit_revenue_ledger_entries (
    payment_id,
    user_id,
    event_type,
    stripe_event_id,
    stripe_object_id,
    stripe_payment_intent_id,
    amount_pence,
    currency,
    credit_delta,
    credit_grant_id,
    metadata
  )
  VALUES (
    payment.id,
    payment.user_id,
    p_event_type,
    p_stripe_event_id,
    COALESCE(p_checkout_session_id, p_payment_intent_id, p_stripe_event_id),
    COALESCE(p_payment_intent_id, payment.stripe_payment_intent_id),
    p_amount_pence,
    payment.currency,
    reversed_credit_delta,
    payment.credit_grant_id,
    effective_metadata
  );

  RETURN payment.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_consumer_checkout_session(
  UUID,
  TEXT,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_consumer_credit_payment(
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  public.consumer_credit_revenue_event_type,
  JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_consumer_credit_payment_failed(
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_or_flag_consumer_credit_payment(
  TEXT,
  TEXT,
  TEXT,
  public.consumer_credit_revenue_event_type,
  INTEGER,
  JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_consumer_checkout_session(
  UUID,
  TEXT,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_consumer_credit_payment(
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  public.consumer_credit_revenue_event_type,
  JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_consumer_credit_payment_failed(
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_or_flag_consumer_credit_payment(
  TEXT,
  TEXT,
  TEXT,
  public.consumer_credit_revenue_event_type,
  INTEGER,
  JSONB
) TO service_role;
