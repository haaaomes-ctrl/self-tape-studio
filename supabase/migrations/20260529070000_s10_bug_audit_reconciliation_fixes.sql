-- S10 bug-audit fixes: preserve consumer checkout/payment-intent linkage and
-- keep rotated partner codes attached to their credit pools.

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
  checkout_payment public.consumer_credit_payments%ROWTYPE;
  intent_payment public.consumer_credit_payments%ROWTYPE;
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
  IF p_event_type NOT IN ('checkout_session_completed','payment_succeeded') THEN
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

  IF p_checkout_session_id IS NOT NULL THEN
    SELECT * INTO checkout_payment
    FROM public.consumer_credit_payments
    WHERE stripe_checkout_session_id = p_checkout_session_id
    FOR UPDATE;
  END IF;

  IF p_payment_intent_id IS NOT NULL THEN
    SELECT * INTO intent_payment
    FROM public.consumer_credit_payments
    WHERE stripe_payment_intent_id = p_payment_intent_id
    FOR UPDATE;
  END IF;

  IF checkout_payment.id IS NOT NULL
     AND intent_payment.id IS NOT NULL
     AND checkout_payment.id <> intent_payment.id THEN
    IF intent_payment.credit_grant_id IS NOT NULL
       OR checkout_payment.credit_grant_id IS NULL THEN
      UPDATE public.consumer_credit_payments
      SET status = 'requires_review',
          stripe_checkout_session_id = NULL,
          latest_stripe_event_id = p_stripe_event_id,
          metadata = metadata || effective_metadata || jsonb_build_object(
            'requires_review_reason', 'checkout_session_completed_after_payment_intent_succeeded',
            'duplicate_checkout_session_id', p_checkout_session_id,
            'merged_into_payment_id', intent_payment.id
          )
      WHERE id = checkout_payment.id;

      payment := intent_payment;
    ELSE
      UPDATE public.consumer_credit_payments
      SET status = 'requires_review',
          stripe_payment_intent_id = NULL,
          latest_stripe_event_id = p_stripe_event_id,
          metadata = metadata || effective_metadata || jsonb_build_object(
            'requires_review_reason', 'payment_intent_succeeded_after_checkout_session_completed',
            'duplicate_payment_intent_id', p_payment_intent_id,
            'merged_into_payment_id', checkout_payment.id
          )
      WHERE id = intent_payment.id;

      payment := checkout_payment;
    END IF;
  ELSIF checkout_payment.id IS NOT NULL THEN
    payment := checkout_payment;
  ELSIF intent_payment.id IS NOT NULL THEN
    payment := intent_payment;
  ELSE
    IF p_user_id IS NULL
       OR p_product_sku IS NULL
       OR p_credit_amount IS NULL
       OR p_amount_total_pence IS NULL THEN
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
      payment.stripe_payment_intent_id,
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
    WHEN payment.status = 'payment_succeeded' THEN 'payment_succeeded'::public.consumer_credit_payment_status
    WHEN p_event_type = 'payment_succeeded' THEN 'payment_succeeded'::public.consumer_credit_payment_status
    ELSE 'checkout_completed'::public.consumer_credit_payment_status
  END;

  UPDATE public.consumer_credit_payments
  SET status = effective_status,
      stripe_checkout_session_id = COALESCE(p_checkout_session_id, stripe_checkout_session_id),
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

CREATE OR REPLACE FUNCTION public.rotate_partner_code(
  p_existing_code_id UUID,
  p_new_code_hash TEXT,
  p_new_code_display_hint TEXT,
  p_allowance_credits INTEGER DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_max_activations INTEGER DEFAULT NULL,
  p_allowed_email_domains TEXT[] DEFAULT NULL,
  p_admin_actor_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_code public.partner_codes%ROWTYPE;
  new_code_id UUID;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO new_code_id
    FROM public.partner_codes
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF new_code_id IS NOT NULL THEN
      RETURN new_code_id;
    END IF;
  END IF;

  SELECT * INTO existing_code
  FROM public.partner_codes
  WHERE id = p_existing_code_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner code not found';
  END IF;

  IF existing_code.status NOT IN ('active', 'paused') THEN
    RAISE EXCEPTION 'only active or paused partner codes can be rotated';
  END IF;

  INSERT INTO public.partner_codes (
    partner_id,
    partner_credit_pool_id,
    code_hash,
    code_display_hint,
    version,
    status,
    allowance_credits,
    expires_at,
    max_activations,
    allowed_email_domains,
    rotated_from_code_id,
    created_by_user_id,
    metadata,
    idempotency_key
  )
  VALUES (
    existing_code.partner_id,
    existing_code.partner_credit_pool_id,
    p_new_code_hash,
    p_new_code_display_hint,
    existing_code.version + 1,
    'active',
    COALESCE(p_allowance_credits, existing_code.allowance_credits),
    p_expires_at,
    p_max_activations,
    COALESCE(p_allowed_email_domains, existing_code.allowed_email_domains),
    existing_code.id,
    p_admin_actor_user_id,
    COALESCE(p_metadata, '{}'::jsonb),
    p_idempotency_key
  )
  RETURNING id INTO new_code_id;

  UPDATE public.partner_codes
  SET
    status = 'rotated',
    rotated_to_code_id = new_code_id
  WHERE id = existing_code.id;

  RETURN new_code_id;
END;
$$;

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
REVOKE EXECUTE ON FUNCTION public.rotate_partner_code(
  UUID,
  TEXT,
  TEXT,
  INTEGER,
  TIMESTAMPTZ,
  INTEGER,
  TEXT[],
  UUID,
  JSONB,
  TEXT
) FROM PUBLIC, anon, authenticated;

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
GRANT EXECUTE ON FUNCTION public.rotate_partner_code(
  UUID,
  TEXT,
  TEXT,
  INTEGER,
  TIMESTAMPTZ,
  INTEGER,
  TEXT[],
  UUID,
  JSONB,
  TEXT
) TO service_role;
