-- DS-05: partner entities, controllable codes and membership activation.
--
-- This is the B2B-funded access foundation. It intentionally does not add
-- partner pool enforcement (DS-06), partner visibility dashboards (DS-07),
-- package presets (DS-08/09/10), user-facing activation UI (DS-14), runtime
-- report credit gating (DS-12) or admin console screens (DS-21).

DO $$
BEGIN
  CREATE TYPE public.partner_type AS ENUM (
    'school',
    'coach',
    'agent',
    'sponsor',
    'platform'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.partner_status AS ENUM (
    'active',
    'paused',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.partner_code_status AS ENUM (
    'active',
    'paused',
    'revoked',
    'rotated',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.partner_membership_status AS ENUM (
    'active',
    'revoked',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.partner_credit_source(
  p_partner_type public.partner_type
)
RETURNS public.credit_source
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_partner_type
    WHEN 'school' THEN 'school_funded'::public.credit_source
    WHEN 'coach' THEN 'coach_funded'::public.credit_source
    WHEN 'agent' THEN 'agent_funded'::public.credit_source
    WHEN 'sponsor' THEN 'sponsor_campaign'::public.credit_source
    WHEN 'platform' THEN 'platform_funded'::public.credit_source
  END;
$$;

CREATE OR REPLACE FUNCTION public.partner_email_domain(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR position('@' IN p_email) < 2 THEN NULL
    ELSE lower(split_part(trim(p_email), '@', 2))
  END;
$$;

CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.partner_type NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status public.partner_status NOT NULL DEFAULT 'active',
  primary_contact_email TEXT,
  allowed_email_domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partners_name_present CHECK (length(trim(name)) > 0),
  CONSTRAINT partners_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  CONSTRAINT partners_primary_contact_email_format CHECK (
    primary_contact_email IS NULL OR primary_contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT partners_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.partner_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  code_display_hint TEXT NOT NULL,
  version INTEGER NOT NULL,
  status public.partner_code_status NOT NULL DEFAULT 'active',
  allowance_credits INTEGER NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  max_activations INTEGER,
  activation_count INTEGER NOT NULL DEFAULT 0,
  allowed_email_domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  rotated_from_code_id UUID REFERENCES public.partner_codes(id) ON DELETE SET NULL,
  rotated_to_code_id UUID REFERENCES public.partner_codes(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  abuse_flagged_at TIMESTAMPTZ,
  abuse_flagged_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  abuse_flag_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_codes_hash_format CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT partner_codes_display_hint_present CHECK (length(trim(code_display_hint)) > 0),
  CONSTRAINT partner_codes_version_positive CHECK (version > 0),
  CONSTRAINT partner_codes_allowance_positive CHECK (allowance_credits > 0),
  CONSTRAINT partner_codes_max_activations_positive CHECK (
    max_activations IS NULL OR max_activations > 0
  ),
  CONSTRAINT partner_codes_activation_count_valid CHECK (
    activation_count >= 0
    AND (max_activations IS NULL OR activation_count <= max_activations)
  ),
  CONSTRAINT partner_codes_expiry_after_valid_from CHECK (
    expires_at IS NULL OR expires_at > valid_from
  ),
  CONSTRAINT partner_codes_revoked_fields CHECK (
    status <> 'revoked' OR revoked_at IS NOT NULL
  ),
  CONSTRAINT partner_codes_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT partner_codes_unique_version_per_partner UNIQUE (partner_id, version)
);

CREATE TABLE IF NOT EXISTS public.partner_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_code_id UUID NOT NULL REFERENCES public.partner_codes(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.partner_membership_status NOT NULL DEFAULT 'active',
  partner_type public.partner_type NOT NULL,
  credit_source public.credit_source NOT NULL,
  code_version INTEGER NOT NULL,
  allowance_credits INTEGER NOT NULL,
  credit_grant_id UUID REFERENCES public.credit_grants(id) ON DELETE SET NULL,
  email_domain TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  activation_idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_memberships_allowance_positive CHECK (allowance_credits > 0),
  CONSTRAINT partner_memberships_code_version_positive CHECK (code_version > 0),
  CONSTRAINT partner_memberships_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_memberships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.partners FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.partner_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.partner_memberships FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS partners_set_updated_at ON public.partners;
CREATE TRIGGER partners_set_updated_at
BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS partner_codes_set_updated_at ON public.partner_codes;
CREATE TRIGGER partner_codes_set_updated_at
BEFORE UPDATE ON public.partner_codes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS partner_memberships_set_updated_at ON public.partner_memberships;
CREATE TRIGGER partner_memberships_set_updated_at
BEFORE UPDATE ON public.partner_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS partners_type_status_idx
  ON public.partners (type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_codes_partner_status_idx
  ON public.partner_codes (partner_id, status, expires_at);
CREATE INDEX IF NOT EXISTS partner_codes_status_expiry_idx
  ON public.partner_codes (status, expires_at)
  WHERE expires_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS partner_codes_idempotency_key_idx
  ON public.partner_codes (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_memberships_user_status_idx
  ON public.partner_memberships (user_id, status, activated_at DESC);
CREATE INDEX IF NOT EXISTS partner_memberships_partner_status_idx
  ON public.partner_memberships (partner_id, status, activated_at DESC);
CREATE INDEX IF NOT EXISTS partner_memberships_code_idx
  ON public.partner_memberships (partner_code_id, activated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS partner_memberships_active_partner_user_idx
  ON public.partner_memberships (partner_id, user_id)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS partner_memberships_activation_idempotency_key_idx
  ON public.partner_memberships (activation_idempotency_key)
  WHERE activation_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_partner_code_status(
  p_partner_code_id UUID,
  p_status public.partner_code_status,
  p_admin_actor_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status = 'rotated' THEN
    RAISE EXCEPTION 'use rotate_partner_code to rotate partner codes';
  END IF;

  UPDATE public.partner_codes
  SET
    status = p_status,
    revoked_by_user_id = CASE WHEN p_status = 'revoked' THEN p_admin_actor_user_id ELSE revoked_by_user_id END,
    revoked_at = CASE WHEN p_status = 'revoked' THEN p_now ELSE revoked_at END,
    revoked_reason = CASE WHEN p_status = 'revoked' THEN p_reason ELSE revoked_reason END
  WHERE id = p_partner_code_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner code not found';
  END IF;

  RETURN p_partner_code_id;
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

CREATE OR REPLACE FUNCTION public.expire_partner_codes(
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.partner_codes
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at <= p_now;

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.flag_partner_code_abuse(
  p_partner_code_id UUID,
  p_admin_actor_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_codes
  SET
    abuse_flagged_at = p_now,
    abuse_flagged_by_user_id = p_admin_actor_user_id,
    abuse_flag_reason = p_reason
  WHERE id = p_partner_code_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner code not found';
  END IF;

  RETURN p_partner_code_id;
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

  RETURN membership_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.partner_credit_source(public.partner_type) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_email_domain(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_partner_code_status(
  UUID,
  public.partner_code_status,
  UUID,
  TEXT,
  TIMESTAMPTZ
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
REVOKE EXECUTE ON FUNCTION public.expire_partner_codes(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_partner_code_abuse(
  UUID,
  UUID,
  TEXT,
  TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_partner_code(
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  JSONB,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.partner_credit_source(public.partner_type) TO service_role;
GRANT EXECUTE ON FUNCTION public.partner_email_domain(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_partner_code_status(
  UUID,
  public.partner_code_status,
  UUID,
  TEXT,
  TIMESTAMPTZ
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
GRANT EXECUTE ON FUNCTION public.expire_partner_codes(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.flag_partner_code_abuse(
  UUID,
  UUID,
  TEXT,
  TIMESTAMPTZ
) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_partner_code(
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  JSONB,
  TEXT
) TO service_role;
