-- DS-06: partner credit pools, per-user caps and usage alerts.
--
-- This enforces partner-funded credit allocation at grant time. It intentionally
-- does not reserve/consume/refund report runtime credits; DS-12 owns the
-- report-generation reservation and failed-report lifecycle.

DO $$
BEGIN
  CREATE TYPE public.partner_credit_pool_period_type AS ENUM (
    'monthly',
    'term',
    'annual',
    'fixed_campaign'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.partner_credit_pool_status AS ENUM (
    'active',
    'paused',
    'exhausted',
    'expired',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.partner_credit_allocation_source AS ENUM (
    'code_activation',
    'admin_partner_top_up',
    'admin_performer_top_up'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.partner_usage_alert_status AS ENUM (
    'triggered',
    'acknowledged'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.partner_credit_pool_event_type AS ENUM (
    'pool_created',
    'partner_top_up',
    'performer_allocation',
    'performer_top_up',
    'usage_alert'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.partner_credit_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_type public.partner_credit_pool_period_type NOT NULL,
  status public.partner_credit_pool_status NOT NULL DEFAULT 'active',
  total_credits INTEGER NOT NULL,
  allocated_credits INTEGER NOT NULL DEFAULT 0,
  consumed_credits INTEGER NOT NULL DEFAULT 0,
  per_user_cap INTEGER NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  overage_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  overage_price_pence INTEGER,
  currency TEXT NOT NULL DEFAULT 'GBP',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_credit_pools_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT partner_credit_pools_total_positive CHECK (total_credits > 0),
  CONSTRAINT partner_credit_pools_allocated_valid CHECK (allocated_credits >= 0),
  CONSTRAINT partner_credit_pools_consumed_valid CHECK (
    consumed_credits >= 0 AND consumed_credits <= allocated_credits
  ),
  CONSTRAINT partner_credit_pools_per_user_cap_positive CHECK (per_user_cap > 0),
  CONSTRAINT partner_credit_pools_period_valid CHECK (period_end > period_start),
  CONSTRAINT partner_credit_pools_currency_gbp CHECK (currency = 'GBP'),
  CONSTRAINT partner_credit_pools_overage_price CHECK (
    (overage_allowed = FALSE AND overage_price_pence IS NULL)
    OR (overage_allowed = TRUE AND (overage_price_pence IS NULL OR overage_price_pence >= 0))
  ),
  CONSTRAINT partner_credit_pools_no_overallocation_without_overage CHECK (
    overage_allowed = TRUE OR allocated_credits <= total_credits
  ),
  CONSTRAINT partner_credit_pools_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.partner_credit_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_credit_pool_id UUID NOT NULL REFERENCES public.partner_credit_pools(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_membership_id UUID REFERENCES public.partner_memberships(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_grant_id UUID REFERENCES public.credit_grants(id) ON DELETE SET NULL,
  source public.partner_credit_allocation_source NOT NULL,
  credit_amount INTEGER NOT NULL,
  cap_override BOOLEAN NOT NULL DEFAULT FALSE,
  cap_override_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_credit_allocations_amount_positive CHECK (credit_amount > 0),
  CONSTRAINT partner_credit_allocations_override_reason CHECK (
    cap_override = FALSE OR length(trim(COALESCE(cap_override_reason, ''))) > 0
  ),
  CONSTRAINT partner_credit_allocations_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.partner_usage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_credit_pool_id UUID NOT NULL REFERENCES public.partner_credit_pools(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  threshold_percent INTEGER NOT NULL,
  status public.partner_usage_alert_status NOT NULL DEFAULT 'triggered',
  allocated_credits INTEGER NOT NULL,
  total_credits INTEGER NOT NULL,
  usage_percent NUMERIC(7, 2) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_usage_alerts_threshold_known CHECK (threshold_percent IN (50, 80, 100)),
  CONSTRAINT partner_usage_alerts_credits_valid CHECK (
    allocated_credits >= 0 AND total_credits > 0
  ),
  CONSTRAINT partner_usage_alerts_usage_valid CHECK (usage_percent >= 0),
  CONSTRAINT partner_usage_alerts_acknowledged_fields CHECK (
    status <> 'acknowledged' OR acknowledged_at IS NOT NULL
  ),
  CONSTRAINT partner_usage_alerts_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT partner_usage_alerts_once_per_threshold UNIQUE (
    partner_credit_pool_id,
    threshold_percent
  )
);

CREATE TABLE IF NOT EXISTS public.partner_credit_pool_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_credit_pool_id UUID NOT NULL REFERENCES public.partner_credit_pools(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  event_type public.partner_credit_pool_event_type NOT NULL,
  credit_delta INTEGER NOT NULL DEFAULT 0,
  admin_actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  related_allocation_id UUID REFERENCES public.partner_credit_allocations(id) ON DELETE SET NULL,
  related_alert_id UUID REFERENCES public.partner_usage_alerts(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_credit_pool_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.partner_codes
  ADD COLUMN IF NOT EXISTS partner_credit_pool_id UUID REFERENCES public.partner_credit_pools(id) ON DELETE SET NULL;

ALTER TABLE public.partner_memberships
  ADD COLUMN IF NOT EXISTS partner_credit_pool_id UUID REFERENCES public.partner_credit_pools(id) ON DELETE SET NULL;

ALTER TABLE public.partner_credit_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_credit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_usage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_credit_pool_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.partner_credit_pools FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.partner_credit_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.partner_usage_alerts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.partner_credit_pool_events FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS partner_credit_pools_set_updated_at ON public.partner_credit_pools;
CREATE TRIGGER partner_credit_pools_set_updated_at
BEFORE UPDATE ON public.partner_credit_pools
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS partner_credit_allocations_set_updated_at ON public.partner_credit_allocations;
CREATE TRIGGER partner_credit_allocations_set_updated_at
BEFORE UPDATE ON public.partner_credit_allocations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS partner_usage_alerts_set_updated_at ON public.partner_usage_alerts;
CREATE TRIGGER partner_usage_alerts_set_updated_at
BEFORE UPDATE ON public.partner_usage_alerts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS partner_credit_pool_events_set_updated_at ON public.partner_credit_pool_events;
CREATE TRIGGER partner_credit_pool_events_set_updated_at
BEFORE UPDATE ON public.partner_credit_pool_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS partner_credit_pools_partner_status_period_idx
  ON public.partner_credit_pools (partner_id, status, period_start, period_end);
CREATE INDEX IF NOT EXISTS partner_credit_allocations_pool_user_idx
  ON public.partner_credit_allocations (partner_credit_pool_id, user_id, allocated_at DESC);
CREATE INDEX IF NOT EXISTS partner_credit_allocations_membership_idx
  ON public.partner_credit_allocations (partner_membership_id, allocated_at DESC)
  WHERE partner_membership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_usage_alerts_pool_status_idx
  ON public.partner_usage_alerts (partner_credit_pool_id, status, threshold_percent);
CREATE INDEX IF NOT EXISTS partner_credit_pool_events_pool_created_idx
  ON public.partner_credit_pool_events (partner_credit_pool_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS partner_credit_pool_events_idempotency_key_idx
  ON public.partner_credit_pool_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_codes_credit_pool_idx
  ON public.partner_codes (partner_credit_pool_id)
  WHERE partner_credit_pool_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_memberships_credit_pool_idx
  ON public.partner_memberships (partner_credit_pool_id)
  WHERE partner_credit_pool_id IS NOT NULL;

CREATE OR REPLACE VIEW public.partner_credit_pool_usage_summary AS
SELECT
  pool.id AS partner_credit_pool_id,
  pool.partner_id,
  pool.name,
  pool.period_type,
  pool.status,
  pool.total_credits,
  pool.allocated_credits,
  pool.consumed_credits,
  GREATEST(pool.total_credits - pool.allocated_credits, 0)::INTEGER AS remaining_credits,
  pool.per_user_cap,
  pool.overage_allowed,
  CASE
    WHEN pool.total_credits > 0 THEN ROUND((pool.allocated_credits::NUMERIC / pool.total_credits::NUMERIC) * 100, 2)
    ELSE 0
  END AS allocated_usage_percent,
  pool.period_start,
  pool.period_end
FROM public.partner_credit_pools pool;

REVOKE ALL ON TABLE public.partner_credit_pool_usage_summary FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_partner_pool_alerts(
  p_partner_credit_pool_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_pool public.partner_credit_pools%ROWTYPE;
  threshold INTEGER;
  inserted_count INTEGER := 0;
  alert_id UUID;
BEGIN
  SELECT * INTO selected_pool
  FROM public.partner_credit_pools
  WHERE id = p_partner_credit_pool_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner credit pool not found';
  END IF;

  FOREACH threshold IN ARRAY ARRAY[50, 80, 100] LOOP
    IF selected_pool.allocated_credits * 100 >= selected_pool.total_credits * threshold THEN
      INSERT INTO public.partner_usage_alerts (
        partner_credit_pool_id,
        partner_id,
        threshold_percent,
        allocated_credits,
        total_credits,
        usage_percent,
        triggered_at
      )
      VALUES (
        selected_pool.id,
        selected_pool.partner_id,
        threshold,
        selected_pool.allocated_credits,
        selected_pool.total_credits,
        ROUND((selected_pool.allocated_credits::NUMERIC / selected_pool.total_credits::NUMERIC) * 100, 2),
        p_now
      )
      ON CONFLICT (partner_credit_pool_id, threshold_percent) DO NOTHING
      RETURNING id INTO alert_id;

      IF alert_id IS NOT NULL THEN
        inserted_count := inserted_count + 1;
        INSERT INTO public.partner_credit_pool_events (
          partner_credit_pool_id,
          partner_id,
          event_type,
          credit_delta,
          related_alert_id,
          metadata,
          created_at
        )
        VALUES (
          selected_pool.id,
          selected_pool.partner_id,
          'usage_alert',
          0,
          alert_id,
          jsonb_build_object('threshold_percent', threshold),
          p_now
        );
      END IF;
      alert_id := NULL;
    END IF;
  END LOOP;

  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_partner_pool_credits(
  p_partner_credit_pool_id UUID,
  p_user_id UUID,
  p_credit_amount INTEGER,
  p_source public.partner_credit_allocation_source,
  p_partner_membership_id UUID DEFAULT NULL,
  p_credit_grant_id UUID DEFAULT NULL,
  p_created_by_user_id UUID DEFAULT NULL,
  p_cap_override BOOLEAN DEFAULT FALSE,
  p_cap_override_reason TEXT DEFAULT NULL,
  p_allocated_at TIMESTAMPTZ DEFAULT now(),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_pool public.partner_credit_pools%ROWTYPE;
  user_allocated INTEGER;
  new_allocation_id UUID;
BEGIN
  IF p_credit_amount <= 0 THEN
    RAISE EXCEPTION 'partner pool allocation amount must be positive';
  END IF;

  IF p_cap_override = TRUE AND length(trim(COALESCE(p_cap_override_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'cap override requires a reason';
  END IF;

  SELECT * INTO selected_pool
  FROM public.partner_credit_pools
  WHERE id = p_partner_credit_pool_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner credit pool not found';
  END IF;

  IF selected_pool.status <> 'active' THEN
    RAISE EXCEPTION 'partner credit pool is not active';
  END IF;

  IF selected_pool.period_start > p_allocated_at THEN
    RAISE EXCEPTION 'partner credit pool is not active yet';
  END IF;

  IF selected_pool.period_end <= p_allocated_at THEN
    UPDATE public.partner_credit_pools
    SET status = 'expired'
    WHERE id = selected_pool.id;
    RAISE EXCEPTION 'partner credit pool is expired';
  END IF;

  SELECT COALESCE(SUM(credit_amount), 0)::INTEGER INTO user_allocated
  FROM public.partner_credit_allocations
  WHERE partner_credit_pool_id = selected_pool.id
    AND user_id = p_user_id;

  IF p_cap_override = FALSE
     AND user_allocated + p_credit_amount > selected_pool.per_user_cap THEN
    RAISE EXCEPTION 'partner per-user cap exceeded';
  END IF;

  IF selected_pool.overage_allowed = FALSE
     AND selected_pool.allocated_credits + p_credit_amount > selected_pool.total_credits THEN
    RAISE EXCEPTION 'partner credit pool exhausted';
  END IF;

  INSERT INTO public.partner_credit_allocations (
    partner_credit_pool_id,
    partner_id,
    partner_membership_id,
    user_id,
    credit_grant_id,
    source,
    credit_amount,
    cap_override,
    cap_override_reason,
    metadata,
    created_by_user_id,
    allocated_at
  )
  VALUES (
    selected_pool.id,
    selected_pool.partner_id,
    p_partner_membership_id,
    p_user_id,
    p_credit_grant_id,
    p_source,
    p_credit_amount,
    p_cap_override,
    p_cap_override_reason,
    COALESCE(p_metadata, '{}'::jsonb),
    p_created_by_user_id,
    p_allocated_at
  )
  RETURNING id INTO new_allocation_id;

  UPDATE public.partner_credit_pools
  SET
    allocated_credits = allocated_credits + p_credit_amount,
    status = CASE
      WHEN overage_allowed = FALSE AND allocated_credits + p_credit_amount >= total_credits
        THEN 'exhausted'::public.partner_credit_pool_status
      ELSE status
    END
  WHERE id = selected_pool.id;

  INSERT INTO public.partner_credit_pool_events (
    partner_credit_pool_id,
    partner_id,
    event_type,
    credit_delta,
    admin_actor_user_id,
    related_allocation_id,
    metadata,
    created_at
  )
  VALUES (
    selected_pool.id,
    selected_pool.partner_id,
    CASE
      WHEN p_source = 'admin_performer_top_up' THEN 'performer_top_up'::public.partner_credit_pool_event_type
      ELSE 'performer_allocation'::public.partner_credit_pool_event_type
    END,
    -p_credit_amount,
    p_created_by_user_id,
    new_allocation_id,
    COALESCE(p_metadata, '{}'::jsonb),
    p_allocated_at
  );

  PERFORM public.record_partner_pool_alerts(selected_pool.id, p_allocated_at);

  RETURN new_allocation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_top_up_partner_credit_pool(
  p_partner_credit_pool_id UUID,
  p_credit_amount INTEGER,
  p_admin_actor_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_pool public.partner_credit_pools%ROWTYPE;
  event_id UUID;
BEGIN
  IF p_credit_amount <= 0 THEN
    RAISE EXCEPTION 'partner pool top-up amount must be positive';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO event_id
    FROM public.partner_credit_pool_events
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF event_id IS NOT NULL THEN
      RETURN event_id;
    END IF;
  END IF;

  SELECT * INTO selected_pool
  FROM public.partner_credit_pools
  WHERE id = p_partner_credit_pool_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner credit pool not found';
  END IF;

  UPDATE public.partner_credit_pools
  SET
    total_credits = total_credits + p_credit_amount,
    status = CASE
      WHEN status = 'exhausted'
        AND (allocated_credits < total_credits + p_credit_amount OR overage_allowed = TRUE)
        THEN 'active'::public.partner_credit_pool_status
      ELSE status
    END
  WHERE id = selected_pool.id;

  INSERT INTO public.partner_credit_pool_events (
    partner_credit_pool_id,
    partner_id,
    event_type,
    credit_delta,
    admin_actor_user_id,
    reason,
    metadata,
    idempotency_key
  )
  VALUES (
    selected_pool.id,
    selected_pool.partner_id,
    'partner_top_up',
    p_credit_amount,
    p_admin_actor_user_id,
    p_reason,
    COALESCE(p_metadata, '{}'::jsonb),
    p_idempotency_key
  )
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_top_up_partner_membership(
  p_partner_membership_id UUID,
  p_credit_amount INTEGER,
  p_admin_actor_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_cap_override BOOLEAN DEFAULT FALSE,
  p_cap_override_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_membership public.partner_memberships%ROWTYPE;
  selected_partner public.partners%ROWTYPE;
  allocation_id UUID;
  grant_id UUID;
BEGIN
  IF p_credit_amount <= 0 THEN
    RAISE EXCEPTION 'partner performer top-up amount must be positive';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT credit_grant_id INTO grant_id
    FROM public.credit_ledger_entries
    WHERE idempotency_key = p_idempotency_key
      AND entry_type = 'grant'
    LIMIT 1;

    IF grant_id IS NOT NULL THEN
      RETURN grant_id;
    END IF;
  END IF;

  SELECT * INTO selected_membership
  FROM public.partner_memberships
  WHERE id = p_partner_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner membership not found';
  END IF;

  IF selected_membership.status <> 'active' THEN
    RAISE EXCEPTION 'partner membership is not active';
  END IF;

  IF selected_membership.partner_credit_pool_id IS NULL THEN
    RAISE EXCEPTION 'partner membership is not linked to a credit pool';
  END IF;

  SELECT * INTO selected_partner
  FROM public.partners
  WHERE id = selected_membership.partner_id;

  allocation_id := public.allocate_partner_pool_credits(
    selected_membership.partner_credit_pool_id,
    selected_membership.user_id,
    p_credit_amount,
    'admin_performer_top_up',
    selected_membership.id,
    NULL,
    p_admin_actor_user_id,
    p_cap_override,
    p_cap_override_reason,
    now(),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  grant_id := public.grant_funded_credits(
    selected_membership.user_id,
    selected_membership.credit_source,
    p_credit_amount,
    now(),
    selected_membership.expires_at,
    'partner_membership_top_up',
    selected_membership.id::TEXT,
    selected_partner.name || ' admin top-up',
    p_admin_actor_user_id,
    p_reason,
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_idempotency_key, 'partner-membership-top-up:' || allocation_id::TEXT)
  );

  UPDATE public.partner_credit_allocations
  SET credit_grant_id = grant_id
  WHERE id = allocation_id;

  RETURN grant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_partner_code(
  p_user_id UUID,
  p_code_hash TEXT,
  p_user_email TEXT DEFAULT NULL,
  p_activated_at TIMESTAMPTZ DEFAULT now(),
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_code public.partner_codes%ROWTYPE;
  selected_partner public.partners%ROWTYPE;
  effective_domains TEXT[];
  user_domain TEXT;
  membership_id UUID;
  grant_id UUID;
  allocation_id UUID;
  source public.credit_source;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO membership_id
    FROM public.partner_memberships
    WHERE activation_idempotency_key = p_idempotency_key
    LIMIT 1;

    IF membership_id IS NOT NULL THEN
      RETURN membership_id;
    END IF;
  END IF;

  IF p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'partner code hash is invalid';
  END IF;

  SELECT * INTO selected_code
  FROM public.partner_codes
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner code not found';
  END IF;

  SELECT * INTO selected_partner
  FROM public.partners
  WHERE id = selected_code.partner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner not found';
  END IF;

  IF selected_partner.status <> 'active' THEN
    RAISE EXCEPTION 'partner is not active';
  END IF;

  IF selected_code.status <> 'active' THEN
    RAISE EXCEPTION 'partner code is not active';
  END IF;

  IF selected_code.valid_from > p_activated_at THEN
    RAISE EXCEPTION 'partner code is not active yet';
  END IF;

  IF selected_code.expires_at IS NOT NULL AND selected_code.expires_at <= p_activated_at THEN
    UPDATE public.partner_codes
    SET status = 'expired'
    WHERE id = selected_code.id;
    RAISE EXCEPTION 'partner code is expired';
  END IF;

  IF selected_code.max_activations IS NOT NULL
     AND selected_code.activation_count >= selected_code.max_activations THEN
    RAISE EXCEPTION 'partner code has reached max activations';
  END IF;

  effective_domains := CASE
    WHEN cardinality(selected_code.allowed_email_domains) > 0 THEN selected_code.allowed_email_domains
    ELSE selected_partner.allowed_email_domains
  END;
  user_domain := public.partner_email_domain(p_user_email);

  IF cardinality(effective_domains) > 0
     AND (user_domain IS NULL OR NOT user_domain = ANY(effective_domains)) THEN
    RAISE EXCEPTION 'partner code is not valid for this email domain';
  END IF;

  SELECT id INTO membership_id
  FROM public.partner_memberships
  WHERE partner_id = selected_partner.id
    AND user_id = p_user_id
    AND status = 'active'
  LIMIT 1;

  IF membership_id IS NOT NULL THEN
    RETURN membership_id;
  END IF;

  source := public.partner_credit_source(selected_partner.type);

  INSERT INTO public.partner_memberships (
    partner_id,
    partner_code_id,
    partner_credit_pool_id,
    user_id,
    status,
    partner_type,
    credit_source,
    code_version,
    allowance_credits,
    email_domain,
    activated_at,
    expires_at,
    activation_idempotency_key,
    metadata
  )
  VALUES (
    selected_partner.id,
    selected_code.id,
    selected_code.partner_credit_pool_id,
    p_user_id,
    'active',
    selected_partner.type,
    source,
    selected_code.version,
    selected_code.allowance_credits,
    user_domain,
    p_activated_at,
    selected_code.expires_at,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO membership_id;

  IF selected_code.partner_credit_pool_id IS NOT NULL THEN
    allocation_id := public.allocate_partner_pool_credits(
      selected_code.partner_credit_pool_id,
      p_user_id,
      selected_code.allowance_credits,
      'code_activation',
      membership_id,
      NULL,
      NULL,
      FALSE,
      NULL,
      p_activated_at,
      COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;

  UPDATE public.partner_codes
  SET activation_count = activation_count + 1
  WHERE id = selected_code.id;

  grant_id := public.grant_funded_credits(
    p_user_id,
    source,
    selected_code.allowance_credits,
    p_activated_at,
    selected_code.expires_at,
    'partner_membership',
    membership_id::TEXT,
    selected_partner.name || ' code v' || selected_code.version::TEXT,
    NULL,
    NULL,
    COALESCE(p_metadata, '{}'::jsonb),
    'partner-membership-credit:' || membership_id::TEXT
  );

  UPDATE public.partner_memberships
  SET credit_grant_id = grant_id
  WHERE id = membership_id;

  IF allocation_id IS NOT NULL THEN
    UPDATE public.partner_credit_allocations
    SET credit_grant_id = grant_id
    WHERE id = allocation_id;
  END IF;

  RETURN membership_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_partner_pool_alerts(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.allocate_partner_pool_credits(
  UUID,
  UUID,
  INTEGER,
  public.partner_credit_allocation_source,
  UUID,
  UUID,
  UUID,
  BOOLEAN,
  TEXT,
  TIMESTAMPTZ,
  JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_top_up_partner_credit_pool(
  UUID,
  INTEGER,
  UUID,
  TEXT,
  JSONB,
  TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_top_up_partner_membership(
  UUID,
  INTEGER,
  UUID,
  TEXT,
  BOOLEAN,
  TEXT,
  JSONB,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_partner_pool_alerts(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.allocate_partner_pool_credits(
  UUID,
  UUID,
  INTEGER,
  public.partner_credit_allocation_source,
  UUID,
  UUID,
  UUID,
  BOOLEAN,
  TEXT,
  TIMESTAMPTZ,
  JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_up_partner_credit_pool(
  UUID,
  INTEGER,
  UUID,
  TEXT,
  JSONB,
  TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_up_partner_membership(
  UUID,
  INTEGER,
  UUID,
  TEXT,
  BOOLEAN,
  TEXT,
  JSONB,
  TEXT
) TO service_role;
