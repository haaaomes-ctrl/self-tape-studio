DO $$
BEGIN
  CREATE TYPE public.credit_source AS ENUM (
    'free_signup','free_monthly','school_funded','coach_funded','agent_funded',
    'platform_funded','sponsor_campaign','user_paid','admin_grant'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.credit_ledger_entry_type AS ENUM (
    'grant','consume','admin_adjustment','expiry_adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.credit_rollover_policy AS ENUM ('rollover','no_rollover','funding_period');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.credit_grant_status AS ENUM ('active','exhausted','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source public.credit_source NOT NULL,
  original_credits INTEGER NOT NULL,
  remaining_credits INTEGER NOT NULL,
  rollover_policy public.credit_rollover_policy NOT NULL,
  expires_at TIMESTAMPTZ,
  source_reference_type TEXT,
  source_reference_id TEXT,
  source_label TEXT,
  granted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.credit_grant_status NOT NULL DEFAULT 'active',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_grants_original_positive CHECK (original_credits > 0),
  CONSTRAINT credit_grants_remaining_valid CHECK (remaining_credits >= 0 AND remaining_credits <= original_credits),
  CONSTRAINT credit_grants_free_monthly_expiry CHECK (source <> 'free_monthly' OR (rollover_policy = 'no_rollover' AND expires_at IS NOT NULL)),
  CONSTRAINT credit_grants_user_paid_rollover CHECK (source <> 'user_paid' OR (rollover_policy = 'rollover' AND expires_at IS NULL)),
  CONSTRAINT credit_grants_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.credit_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source public.credit_source NOT NULL,
  entry_type public.credit_ledger_entry_type NOT NULL,
  credit_delta INTEGER NOT NULL,
  credit_grant_id UUID REFERENCES public.credit_grants(id) ON DELETE RESTRICT,
  take_id UUID REFERENCES public.takes(id) ON DELETE SET NULL,
  audition_id UUID REFERENCES public.auditions(id) ON DELETE SET NULL,
  report_generated_at TIMESTAMPTZ,
  idempotency_key TEXT,
  source_reference_type TEXT,
  source_reference_id TEXT,
  admin_actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_ledger_delta_not_zero CHECK (credit_delta <> 0),
  CONSTRAINT credit_ledger_grant_positive CHECK (entry_type <> 'grant' OR (credit_delta > 0 AND credit_grant_id IS NOT NULL)),
  CONSTRAINT credit_ledger_consume_negative CHECK (entry_type <> 'consume' OR (credit_delta < 0 AND credit_grant_id IS NOT NULL)),
  CONSTRAINT credit_ledger_expiry_negative CHECK (entry_type <> 'expiry_adjustment' OR credit_delta < 0),
  CONSTRAINT credit_ledger_consume_report_link CHECK (entry_type <> 'consume' OR take_id IS NOT NULL OR source_reference_type IS NOT NULL),
  CONSTRAINT credit_ledger_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.takes ADD COLUMN IF NOT EXISTS credit_consumption_ledger_entry_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_credit_consumption_ledger_entry_id_fkey') THEN
    ALTER TABLE public.takes
      ADD CONSTRAINT takes_credit_consumption_ledger_entry_id_fkey
      FOREIGN KEY (credit_consumption_ledger_entry_id)
      REFERENCES public.credit_ledger_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT ALL ON public.credit_grants TO service_role;
GRANT ALL ON public.credit_ledger_entries TO service_role;

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.credit_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.credit_ledger_entries FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS credit_grants_set_updated_at ON public.credit_grants;
CREATE TRIGGER credit_grants_set_updated_at BEFORE UPDATE ON public.credit_grants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS credit_ledger_entries_set_updated_at ON public.credit_ledger_entries;
CREATE TRIGGER credit_ledger_entries_set_updated_at BEFORE UPDATE ON public.credit_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS credit_grants_user_status_expiry_idx ON public.credit_grants (user_id, status, expires_at, granted_at);
CREATE INDEX IF NOT EXISTS credit_grants_source_created_idx ON public.credit_grants (source, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_entries_user_created_idx ON public.credit_ledger_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_entries_source_created_idx ON public.credit_ledger_entries (source, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_entries_grant_idx ON public.credit_ledger_entries (credit_grant_id);
CREATE INDEX IF NOT EXISTS credit_ledger_entries_take_idx ON public.credit_ledger_entries (take_id);
CREATE INDEX IF NOT EXISTS takes_credit_consumption_ledger_entry_idx ON public.takes (credit_consumption_ledger_entry_id) WHERE credit_consumption_ledger_entry_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_entries_idempotency_key_idx ON public.credit_ledger_entries (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE VIEW public.credit_source_finance_summary AS
SELECT
  source,
  COALESCE(SUM(CASE WHEN entry_type = 'grant' THEN credit_delta ELSE 0 END), 0)::INTEGER AS granted_credits,
  ABS(COALESCE(SUM(CASE WHEN entry_type = 'consume' THEN credit_delta ELSE 0 END), 0))::INTEGER AS consumed_credits,
  COALESCE(SUM(CASE WHEN entry_type = 'admin_adjustment' THEN credit_delta ELSE 0 END), 0)::INTEGER AS admin_adjustment_credits,
  ABS(COALESCE(SUM(CASE WHEN entry_type = 'expiry_adjustment' THEN credit_delta ELSE 0 END), 0))::INTEGER AS expired_credits,
  COALESCE(SUM(credit_delta), 0)::INTEGER AS net_credits,
  COUNT(*)::INTEGER AS entry_count,
  MIN(created_at) AS first_entry_at,
  MAX(created_at) AS latest_entry_at
FROM public.credit_ledger_entries
GROUP BY source;

REVOKE ALL ON TABLE public.credit_source_finance_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.credit_source_finance_summary TO service_role;

CREATE OR REPLACE FUNCTION public.grant_funded_credits(
  p_user_id UUID, p_source public.credit_source, p_credit_amount INTEGER,
  p_granted_at TIMESTAMPTZ DEFAULT now(), p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_source_reference_type TEXT DEFAULT NULL, p_source_reference_id TEXT DEFAULT NULL,
  p_source_label TEXT DEFAULT NULL, p_admin_actor_user_id UUID DEFAULT NULL,
  p_admin_reason TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_grant_id UUID;
  new_grant_id UUID;
  effective_expires_at TIMESTAMPTZ;
  effective_rollover_policy public.credit_rollover_policy;
BEGIN
  IF p_credit_amount <= 0 THEN RAISE EXCEPTION 'credit grant amount must be positive'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT credit_grant_id INTO existing_grant_id FROM public.credit_ledger_entries
      WHERE idempotency_key = p_idempotency_key AND entry_type = 'grant' LIMIT 1;
    IF existing_grant_id IS NOT NULL THEN RETURN existing_grant_id; END IF;
  END IF;
  IF p_source = 'free_monthly' THEN
    effective_expires_at := p_granted_at + INTERVAL '31 days';
    effective_rollover_policy := 'no_rollover';
  ELSIF p_source = 'user_paid' THEN
    effective_expires_at := NULL; effective_rollover_policy := 'rollover';
  ELSIF p_expires_at IS NOT NULL THEN
    effective_expires_at := p_expires_at; effective_rollover_policy := 'funding_period';
  ELSE
    effective_expires_at := NULL; effective_rollover_policy := 'rollover';
  END IF;
  INSERT INTO public.credit_grants (user_id, source, original_credits, remaining_credits, rollover_policy, expires_at, source_reference_type, source_reference_id, source_label, granted_by_user_id, admin_reason, metadata, granted_at)
  VALUES (p_user_id, p_source, p_credit_amount, p_credit_amount, effective_rollover_policy, effective_expires_at, p_source_reference_type, p_source_reference_id, p_source_label, p_admin_actor_user_id, p_admin_reason, COALESCE(p_metadata, '{}'::jsonb), p_granted_at)
  RETURNING id INTO new_grant_id;
  INSERT INTO public.credit_ledger_entries (user_id, source, entry_type, credit_delta, credit_grant_id, source_reference_type, source_reference_id, admin_actor_user_id, admin_reason, metadata, idempotency_key, created_at)
  VALUES (p_user_id, p_source, 'grant', p_credit_amount, new_grant_id, p_source_reference_type, p_source_reference_id, p_admin_actor_user_id, p_admin_reason, COALESCE(p_metadata, '{}'::jsonb), p_idempotency_key, p_granted_at);
  RETURN new_grant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_credit_consumption(
  p_user_id UUID, p_credit_grant_id UUID, p_credit_amount INTEGER,
  p_take_id UUID DEFAULT NULL, p_audition_id UUID DEFAULT NULL,
  p_report_generated_at TIMESTAMPTZ DEFAULT now(),
  p_metadata JSONB DEFAULT '{}'::jsonb, p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  selected_grant public.credit_grants%ROWTYPE;
  existing_entry_id UUID;
  new_entry_id UUID;
BEGIN
  IF p_credit_amount <= 0 THEN RAISE EXCEPTION 'credit consumption amount must be positive'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_entry_id FROM public.credit_ledger_entries
      WHERE idempotency_key = p_idempotency_key AND entry_type = 'consume' LIMIT 1;
    IF existing_entry_id IS NOT NULL THEN RETURN existing_entry_id; END IF;
  END IF;
  SELECT * INTO selected_grant FROM public.credit_grants WHERE id = p_credit_grant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'credit grant not found'; END IF;
  IF selected_grant.user_id <> p_user_id THEN RAISE EXCEPTION 'credit grant does not belong to user'; END IF;
  IF selected_grant.status <> 'active' THEN RAISE EXCEPTION 'credit grant is not active'; END IF;
  IF selected_grant.expires_at IS NOT NULL AND selected_grant.expires_at <= now() THEN RAISE EXCEPTION 'credit grant is expired'; END IF;
  IF selected_grant.remaining_credits < p_credit_amount THEN RAISE EXCEPTION 'insufficient remaining credits on grant'; END IF;
  IF p_take_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.takes WHERE id = p_take_id AND (user_id = p_user_id OR user_id IS NULL)) THEN
    RAISE EXCEPTION 'take does not belong to user';
  END IF;
  UPDATE public.credit_grants
  SET remaining_credits = remaining_credits - p_credit_amount,
      status = CASE WHEN remaining_credits - p_credit_amount = 0 THEN 'exhausted'::public.credit_grant_status ELSE status END
  WHERE id = selected_grant.id;
  INSERT INTO public.credit_ledger_entries (user_id, source, entry_type, credit_delta, credit_grant_id, take_id, audition_id, report_generated_at, metadata, idempotency_key)
  VALUES (p_user_id, selected_grant.source, 'consume', -p_credit_amount, selected_grant.id, p_take_id, p_audition_id, p_report_generated_at, COALESCE(p_metadata, '{}'::jsonb), p_idempotency_key)
  RETURNING id INTO new_entry_id;
  IF p_take_id IS NOT NULL THEN
    UPDATE public.takes SET credit_consumption_ledger_entry_id = new_entry_id WHERE id = p_take_id;
  END IF;
  RETURN new_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_admin_credit_adjustment(
  p_user_id UUID, p_source public.credit_source, p_credit_delta INTEGER,
  p_admin_actor_user_id UUID DEFAULT NULL, p_admin_reason TEXT DEFAULT NULL,
  p_credit_grant_id UUID DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_entry_id UUID;
  new_entry_id UUID;
BEGIN
  IF p_credit_delta = 0 THEN RAISE EXCEPTION 'admin credit adjustment delta must not be zero'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_entry_id FROM public.credit_ledger_entries
      WHERE idempotency_key = p_idempotency_key AND entry_type = 'admin_adjustment' LIMIT 1;
    IF existing_entry_id IS NOT NULL THEN RETURN existing_entry_id; END IF;
  END IF;
  INSERT INTO public.credit_ledger_entries (user_id, source, entry_type, credit_delta, credit_grant_id, admin_actor_user_id, admin_reason, metadata, idempotency_key)
  VALUES (p_user_id, p_source, 'admin_adjustment', p_credit_delta, p_credit_grant_id, p_admin_actor_user_id, p_admin_reason, COALESCE(p_metadata, '{}'::jsonb), p_idempotency_key)
  RETURNING id INTO new_entry_id;
  RETURN new_entry_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_funded_credits(UUID, public.credit_source, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_credit_consumption(UUID, UUID, INTEGER, UUID, UUID, TIMESTAMPTZ, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_admin_credit_adjustment(UUID, public.credit_source, INTEGER, UUID, TEXT, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.grant_funded_credits(UUID, public.credit_source, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_credit_consumption(UUID, UUID, INTEGER, UUID, UUID, TIMESTAMPTZ, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_admin_credit_adjustment(UUID, public.credit_source, INTEGER, UUID, TEXT, UUID, JSONB, TEXT) TO service_role;