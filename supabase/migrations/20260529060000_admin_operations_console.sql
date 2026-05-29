-- DS-21: admin operations console audit trail and credit adjustment RPC.
--
-- The console itself reads existing S10.1 credit, partner, report, payment,
-- consent and cost tables. This migration adds the missing durable admin action
-- log and an atomic, reason-required credit grant operation for support use.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_action_type_present CHECK (length(trim(action_type)) > 0),
  CONSTRAINT admin_audit_log_target_type_present CHECK (length(trim(target_type)) > 0),
  CONSTRAINT admin_audit_log_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_created_idx
  ON public.admin_audit_log (actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON public.admin_audit_log (target_type, target_id, created_at DESC)
  WHERE target_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_audit_log_idempotency_key_idx
  ON public.admin_audit_log (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.admin_grant_user_credits(
  p_user_id UUID,
  p_credit_amount INTEGER,
  p_admin_actor_user_id UUID DEFAULT NULL,
  p_admin_actor_email TEXT DEFAULT NULL,
  p_admin_reason TEXT DEFAULT NULL,
  p_source_label TEXT DEFAULT 'Admin credit adjustment',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  credit_grant_id UUID,
  audit_log_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_metadata JSONB;
  effective_reason TEXT;
  effective_source_label TEXT;
BEGIN
  IF p_credit_amount <= 0 THEN
    RAISE EXCEPTION 'admin credit grant amount must be positive';
  END IF;

  effective_reason := NULLIF(trim(COALESCE(p_admin_reason, '')), '');
  IF effective_reason IS NULL OR length(effective_reason) < 12 THEN
    RAISE EXCEPTION 'admin credit grants require a reason of at least 12 characters';
  END IF;

  effective_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(effective_metadata) <> 'object' THEN
    RAISE EXCEPTION 'admin credit grant metadata must be an object';
  END IF;

  effective_source_label := COALESCE(NULLIF(trim(p_source_label), ''), 'Admin credit adjustment');

  credit_grant_id := public.grant_funded_credits(
    p_user_id,
    'admin_grant'::public.credit_source,
    p_credit_amount,
    now(),
    NULL,
    'admin_adjustment',
    NULL,
    effective_source_label,
    p_admin_actor_user_id,
    effective_reason,
    effective_metadata || jsonb_build_object(
      'admin_operation', 'credit_grant_added',
      'credit_amount', p_credit_amount,
      'source', 'admin_grant'
    ),
    p_idempotency_key
  );

  INSERT INTO public.admin_audit_log (
    actor_user_id,
    actor_email,
    action_type,
    target_type,
    target_id,
    reason,
    idempotency_key,
    metadata
  )
  VALUES (
    p_admin_actor_user_id,
    NULLIF(trim(COALESCE(p_admin_actor_email, '')), ''),
    'credit_grant_added',
    'credit_grant',
    credit_grant_id::TEXT,
    effective_reason,
    p_idempotency_key,
    effective_metadata || jsonb_build_object(
      'credit_grant_id', credit_grant_id,
      'credit_amount', p_credit_amount,
      'source', 'admin_grant',
      'source_label', effective_source_label
    )
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
  DO UPDATE SET
    metadata = public.admin_audit_log.metadata || EXCLUDED.metadata
  RETURNING id INTO audit_log_id;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_user_credits(
  UUID,
  INTEGER,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_grant_user_credits(
  UUID,
  INTEGER,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  TEXT
) TO service_role;
