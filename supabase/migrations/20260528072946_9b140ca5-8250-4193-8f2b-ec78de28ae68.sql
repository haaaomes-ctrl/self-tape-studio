-- DS-12: report credit gate, reservation, consumption and refund lifecycle.
DO $$
BEGIN
  CREATE TYPE public.report_credit_reservation_status AS ENUM (
    'reserved',
    'consumed',
    'released',
    'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.report_credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audition_id UUID REFERENCES public.auditions(id) ON DELETE SET NULL,
  take_id UUID REFERENCES public.takes(id) ON DELETE SET NULL,
  credit_grant_id UUID REFERENCES public.credit_grants(id) ON DELETE RESTRICT,
  source public.credit_source,
  status public.report_credit_reservation_status NOT NULL DEFAULT 'reserved',
  credit_amount INTEGER NOT NULL DEFAULT 1,
  synthetic_usage BOOLEAN NOT NULL DEFAULT FALSE,
  commercial_metrics_excluded BOOLEAN NOT NULL DEFAULT FALSE,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  consumption_ledger_entry_id UUID REFERENCES public.credit_ledger_entries(id) ON DELETE SET NULL,
  release_reason TEXT,
  failure_code TEXT,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT report_credit_reservations_one_report_credit CHECK (credit_amount = 1),
  CONSTRAINT report_credit_reservations_funded_or_synthetic CHECK (
    (synthetic_usage = TRUE AND credit_grant_id IS NULL)
    OR (synthetic_usage = FALSE AND credit_grant_id IS NOT NULL AND source IS NOT NULL)
  ),
  CONSTRAINT report_credit_reservations_synthetic_metrics CHECK (
    synthetic_usage = FALSE OR commercial_metrics_excluded = TRUE
  ),
  CONSTRAINT report_credit_reservations_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT report_credit_reservations_terminal_times CHECK (
    (status <> 'consumed' OR consumed_at IS NOT NULL)
    AND (status <> 'released' OR released_at IS NOT NULL)
    AND (status <> 'refunded' OR refunded_at IS NOT NULL)
  )
);

ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS credit_reservation_id UUID,
  ADD COLUMN IF NOT EXISTS credit_lifecycle_status TEXT,
  ADD COLUMN IF NOT EXISTS credit_lifecycle_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS credit_is_synthetic_usage BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_credit_reservation_id_fkey') THEN
    ALTER TABLE public.takes
      ADD CONSTRAINT takes_credit_reservation_id_fkey
      FOREIGN KEY (credit_reservation_id)
      REFERENCES public.report_credit_reservations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_credit_lifecycle_status_known') THEN
    ALTER TABLE public.takes
      ADD CONSTRAINT takes_credit_lifecycle_status_known
      CHECK (
        credit_lifecycle_status IS NULL OR credit_lifecycle_status IN (
          'reserved','consumed','released','refunded','blocked_no_credit',
          'synthetic_reserved','synthetic_consumed','synthetic_released','synthetic_refunded'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_credit_lifecycle_metadata_object') THEN
    ALTER TABLE public.takes
      ADD CONSTRAINT takes_credit_lifecycle_metadata_object
      CHECK (jsonb_typeof(credit_lifecycle_metadata) = 'object');
  END IF;
END $$;

ALTER TABLE public.report_credit_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.report_credit_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.report_credit_reservations TO service_role;

DROP TRIGGER IF EXISTS report_credit_reservations_set_updated_at ON public.report_credit_reservations;
CREATE TRIGGER report_credit_reservations_set_updated_at
BEFORE UPDATE ON public.report_credit_reservations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS report_credit_reservations_user_status_idx
  ON public.report_credit_reservations (user_id, status, reserved_at DESC);
CREATE INDEX IF NOT EXISTS report_credit_reservations_take_idx
  ON public.report_credit_reservations (take_id, reserved_at DESC)
  WHERE take_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS report_credit_reservations_one_active_take_idx
  ON public.report_credit_reservations (take_id)
  WHERE status = 'reserved' AND take_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS report_credit_reservations_idempotency_key_idx
  ON public.report_credit_reservations (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS takes_credit_reservation_idx
  ON public.takes (credit_reservation_id)
  WHERE credit_reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS takes_credit_lifecycle_status_idx
  ON public.takes (credit_lifecycle_status)
  WHERE credit_lifecycle_status IS NOT NULL;

CREATE OR REPLACE VIEW public.report_credit_lifecycle_summary AS
SELECT
  reservation.id AS reservation_id,
  reservation.user_id,
  reservation.audition_id,
  reservation.take_id,
  reservation.credit_grant_id,
  reservation.source,
  reservation.status,
  reservation.credit_amount,
  reservation.synthetic_usage,
  reservation.commercial_metrics_excluded,
  reservation.reserved_at,
  reservation.consumed_at,
  reservation.released_at,
  reservation.refunded_at,
  reservation.failure_code,
  reservation.release_reason,
  reservation.consumption_ledger_entry_id
FROM public.report_credit_reservations reservation;

REVOKE ALL ON TABLE public.report_credit_lifecycle_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.report_credit_lifecycle_summary TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_report_credit_for_take(
  p_take_id UUID,
  p_requested_by_user_id UUID DEFAULT NULL,
  p_synthetic_usage BOOLEAN DEFAULT FALSE,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_take public.takes%ROWTYPE;
  selected_grant public.credit_grants%ROWTYPE;
  existing_reservation_id UUID;
  new_reservation_id UUID;
  effective_metadata JSONB;
BEGIN
  effective_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(effective_metadata) <> 'object' THEN
    RAISE EXCEPTION 'report credit reservation metadata must be an object';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_reservation_id
    FROM public.report_credit_reservations
    WHERE idempotency_key = p_idempotency_key AND status = 'reserved'
    LIMIT 1;
    IF existing_reservation_id IS NOT NULL THEN
      RETURN existing_reservation_id;
    END IF;
  END IF;

  SELECT * INTO selected_take FROM public.takes WHERE id = p_take_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAKE_NOT_FOUND: We could not find this take.';
  END IF;

  IF p_requested_by_user_id IS NOT NULL AND selected_take.user_id IS DISTINCT FROM p_requested_by_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: You do not have access to this take.';
  END IF;

  IF selected_take.credit_reservation_id IS NOT NULL THEN
    SELECT id INTO existing_reservation_id
    FROM public.report_credit_reservations
    WHERE id = selected_take.credit_reservation_id AND status = 'reserved'
    LIMIT 1;
    IF existing_reservation_id IS NOT NULL THEN
      RETURN existing_reservation_id;
    END IF;
  END IF;

  SELECT id INTO existing_reservation_id
  FROM public.report_credit_reservations
  WHERE take_id = p_take_id AND status = 'reserved'
  LIMIT 1;

  IF existing_reservation_id IS NOT NULL THEN
    UPDATE public.takes
    SET credit_reservation_id = existing_reservation_id,
        credit_lifecycle_status = CASE WHEN p_synthetic_usage THEN 'synthetic_reserved' ELSE 'reserved' END,
        credit_lifecycle_metadata = credit_lifecycle_metadata || effective_metadata,
        credit_is_synthetic_usage = p_synthetic_usage
    WHERE id = p_take_id;
    RETURN existing_reservation_id;
  END IF;

  IF p_synthetic_usage THEN
    INSERT INTO public.report_credit_reservations (
      user_id, audition_id, take_id, status, credit_amount,
      synthetic_usage, commercial_metrics_excluded, idempotency_key, metadata
    )
    VALUES (
      selected_take.user_id, selected_take.audition_id, selected_take.id,
      'reserved', 1, TRUE, TRUE, p_idempotency_key,
      effective_metadata || '{"synthetic_usage":true,"commercial_metrics_excluded":true}'::jsonb
    )
    RETURNING id INTO new_reservation_id;

    UPDATE public.takes
    SET credit_reservation_id = new_reservation_id,
        credit_lifecycle_status = 'synthetic_reserved',
        credit_lifecycle_metadata = credit_lifecycle_metadata || effective_metadata || '{"synthetic_usage":true,"commercial_metrics_excluded":true}'::jsonb,
        credit_is_synthetic_usage = TRUE
    WHERE id = selected_take.id;
    RETURN new_reservation_id;
  END IF;

  SELECT * INTO selected_grant
  FROM public.credit_grants
  WHERE user_id = selected_take.user_id
    AND status = 'active'
    AND remaining_credits >= 1
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY expires_at ASC NULLS LAST, granted_at ASC, created_at ASC
  FOR UPDATE LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.takes
    SET credit_lifecycle_status = 'blocked_no_credit',
        credit_lifecycle_metadata = credit_lifecycle_metadata || effective_metadata || '{"blocked_reason":"no_funded_credit"}'::jsonb,
        credit_is_synthetic_usage = FALSE
    WHERE id = selected_take.id;
    RAISE EXCEPTION 'CREDIT_REQUIRED: You need 1 TapeCoach credit to generate a self-tape report. Activate a partner code, use an available funded credit or add credits before trying again.';
  END IF;

  UPDATE public.credit_grants
  SET remaining_credits = remaining_credits - 1,
      status = CASE WHEN remaining_credits - 1 = 0 THEN 'exhausted'::public.credit_grant_status ELSE status END
  WHERE id = selected_grant.id;

  INSERT INTO public.report_credit_reservations (
    user_id, audition_id, take_id, credit_grant_id, source, status, credit_amount,
    synthetic_usage, commercial_metrics_excluded, idempotency_key, metadata
  )
  VALUES (
    selected_take.user_id, selected_take.audition_id, selected_take.id,
    selected_grant.id, selected_grant.source, 'reserved', 1, FALSE, FALSE,
    p_idempotency_key, effective_metadata
  )
  RETURNING id INTO new_reservation_id;

  UPDATE public.takes
  SET credit_reservation_id = new_reservation_id,
      credit_lifecycle_status = 'reserved',
      credit_lifecycle_metadata = credit_lifecycle_metadata || effective_metadata,
      credit_is_synthetic_usage = FALSE
  WHERE id = selected_take.id;

  RETURN new_reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_report_credit_reservation(
  p_reservation_id UUID,
  p_take_id UUID DEFAULT NULL,
  p_report_generated_at TIMESTAMPTZ DEFAULT now(),
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_reservation public.report_credit_reservations%ROWTYPE;
  existing_entry_id UUID;
  new_entry_id UUID;
  effective_metadata JSONB;
BEGIN
  effective_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(effective_metadata) <> 'object' THEN
    RAISE EXCEPTION 'report credit consumption metadata must be an object';
  END IF;

  SELECT * INTO selected_reservation FROM public.report_credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report credit reservation not found'; END IF;

  IF p_take_id IS NOT NULL AND selected_reservation.take_id <> p_take_id THEN
    RAISE EXCEPTION 'report credit reservation does not belong to this take';
  END IF;

  IF selected_reservation.status = 'consumed' THEN
    RETURN selected_reservation.consumption_ledger_entry_id;
  END IF;

  IF selected_reservation.status <> 'reserved' THEN
    RAISE EXCEPTION 'report credit reservation is not active';
  END IF;

  IF selected_reservation.synthetic_usage THEN
    UPDATE public.report_credit_reservations
    SET status = 'consumed', consumed_at = p_report_generated_at,
        metadata = metadata || effective_metadata || '{"synthetic_usage":true,"commercial_metrics_excluded":true}'::jsonb
    WHERE id = selected_reservation.id;

    UPDATE public.takes
    SET credit_lifecycle_status = 'synthetic_consumed',
        credit_lifecycle_metadata = credit_lifecycle_metadata || effective_metadata || '{"synthetic_usage":true,"commercial_metrics_excluded":true}'::jsonb,
        credit_is_synthetic_usage = TRUE
    WHERE id = selected_reservation.take_id;
    RETURN NULL;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_entry_id FROM public.credit_ledger_entries
    WHERE idempotency_key = p_idempotency_key AND entry_type = 'consume' LIMIT 1;
    IF existing_entry_id IS NOT NULL THEN new_entry_id := existing_entry_id; END IF;
  END IF;

  IF new_entry_id IS NULL THEN
    INSERT INTO public.credit_ledger_entries (
      user_id, source, entry_type, credit_delta, credit_grant_id, take_id, audition_id,
      report_generated_at, metadata, idempotency_key
    )
    VALUES (
      selected_reservation.user_id, selected_reservation.source, 'consume',
      -selected_reservation.credit_amount, selected_reservation.credit_grant_id,
      selected_reservation.take_id, selected_reservation.audition_id,
      p_report_generated_at, effective_metadata, p_idempotency_key
    )
    RETURNING id INTO new_entry_id;
  END IF;

  UPDATE public.report_credit_reservations
  SET status = 'consumed', consumed_at = p_report_generated_at,
      consumption_ledger_entry_id = new_entry_id,
      metadata = metadata || effective_metadata
  WHERE id = selected_reservation.id;

  UPDATE public.takes
  SET credit_consumption_ledger_entry_id = new_entry_id,
      credit_lifecycle_status = 'consumed',
      credit_lifecycle_metadata = credit_lifecycle_metadata || effective_metadata,
      credit_is_synthetic_usage = FALSE
  WHERE id = selected_reservation.take_id;

  RETURN new_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_report_credit_reservation(
  p_reservation_id UUID,
  p_release_status public.report_credit_reservation_status DEFAULT 'released',
  p_release_reason TEXT DEFAULT NULL,
  p_failure_code TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_reservation public.report_credit_reservations%ROWTYPE;
  effective_metadata JSONB;
  terminal_status public.report_credit_reservation_status;
  take_lifecycle_status TEXT;
BEGIN
  effective_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(effective_metadata) <> 'object' THEN
    RAISE EXCEPTION 'report credit release metadata must be an object';
  END IF;

  IF p_release_status NOT IN ('released', 'refunded') THEN
    RAISE EXCEPTION 'report credit release status must be released or refunded';
  END IF;
  terminal_status := p_release_status;

  SELECT * INTO selected_reservation FROM public.report_credit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report credit reservation not found'; END IF;

  IF selected_reservation.status IN ('released', 'refunded') THEN RETURN selected_reservation.id; END IF;
  IF selected_reservation.status = 'consumed' THEN RETURN selected_reservation.id; END IF;
  IF selected_reservation.status <> 'reserved' THEN RAISE EXCEPTION 'report credit reservation is not active'; END IF;

  IF NOT selected_reservation.synthetic_usage AND selected_reservation.credit_grant_id IS NOT NULL THEN
    UPDATE public.credit_grants
    SET remaining_credits = LEAST(original_credits, remaining_credits + selected_reservation.credit_amount),
        status = CASE WHEN status = 'exhausted' THEN 'active'::public.credit_grant_status ELSE status END
    WHERE id = selected_reservation.credit_grant_id;
  END IF;

  UPDATE public.report_credit_reservations
  SET status = terminal_status,
      released_at = CASE WHEN terminal_status = 'released' THEN now() ELSE released_at END,
      refunded_at = CASE WHEN terminal_status = 'refunded' THEN now() ELSE refunded_at END,
      release_reason = p_release_reason,
      failure_code = p_failure_code,
      metadata = metadata || effective_metadata
  WHERE id = selected_reservation.id;

  take_lifecycle_status := CASE
    WHEN selected_reservation.synthetic_usage AND terminal_status = 'released' THEN 'synthetic_released'
    WHEN selected_reservation.synthetic_usage AND terminal_status = 'refunded' THEN 'synthetic_refunded'
    ELSE terminal_status::TEXT
  END;

  UPDATE public.takes
  SET credit_lifecycle_status = take_lifecycle_status,
      credit_lifecycle_metadata = credit_lifecycle_metadata || effective_metadata,
      credit_is_synthetic_usage = selected_reservation.synthetic_usage
  WHERE id = selected_reservation.take_id
    AND credit_reservation_id = selected_reservation.id;

  RETURN selected_reservation.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_report_credit_for_take(UUID, UUID, BOOLEAN, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_report_credit_reservation(UUID, UUID, TIMESTAMPTZ, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_report_credit_reservation(UUID, public.report_credit_reservation_status, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_report_credit_for_take(UUID, UUID, BOOLEAN, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_report_credit_reservation(UUID, UUID, TIMESTAMPTZ, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_report_credit_reservation(UUID, public.report_credit_reservation_status, TEXT, TEXT, JSONB) TO service_role;