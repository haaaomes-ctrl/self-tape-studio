CREATE TABLE IF NOT EXISTS public.account_compliance (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_route TEXT NOT NULL CHECK (
    account_route IN ('self_service_13_plus', 'parent_guardian', 'under_13')
  ),
  account_type TEXT NOT NULL CHECK (
    account_type IN ('self_service_performer', 'parent_guardian_managed')
  ),
  age_band_declaration TEXT NOT NULL CHECK (
    age_band_declaration IN ('13_plus', 'parent_guardian', 'under_13')
  ),
  parent_managed BOOLEAN NOT NULL DEFAULT false,
  parent_guardian_attested BOOLEAN NOT NULL DEFAULT false,
  parent_guardian_attested_at TIMESTAMPTZ,
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  privacy_version TEXT NOT NULL,
  privacy_accepted_at TIMESTAMPTZ NOT NULL,
  ai_disclaimer_version TEXT NOT NULL,
  ai_disclaimer_accepted_at TIMESTAMPTZ NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_compliance_parent_route_consistency CHECK (
    (
      account_route = 'self_service_13_plus'
      AND account_type = 'self_service_performer'
      AND age_band_declaration = '13_plus'
      AND parent_managed = false
      AND parent_guardian_attested = false
      AND parent_guardian_attested_at IS NULL
    )
    OR
    (
      account_route IN ('parent_guardian', 'under_13')
      AND account_type = 'parent_guardian_managed'
      AND parent_managed = true
      AND parent_guardian_attested = true
      AND parent_guardian_attested_at IS NOT NULL
    )
  ),
  CONSTRAINT account_compliance_under_13_age_band CHECK (
    account_route <> 'under_13' OR age_band_declaration = 'under_13'
  ),
  CONSTRAINT account_compliance_parent_age_band CHECK (
    account_route <> 'parent_guardian' OR age_band_declaration = 'parent_guardian'
  ),
  CONSTRAINT account_compliance_marketing_timestamp CHECK (
    (marketing_consent = true AND marketing_consent_at IS NOT NULL)
    OR (marketing_consent = false AND marketing_consent_at IS NULL)
  )
);

ALTER TABLE public.account_compliance
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS account_route TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT,
  ADD COLUMN IF NOT EXISTS age_band_declaration TEXT,
  ADD COLUMN IF NOT EXISTS parent_managed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_guardian_attested BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_guardian_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_version TEXT,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_disclaimer_version TEXT,
  ADD COLUMN IF NOT EXISTS ai_disclaimer_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.account_compliance
  ALTER COLUMN parent_managed SET DEFAULT false,
  ALTER COLUMN parent_guardian_attested SET DEFAULT false,
  ALTER COLUMN marketing_consent SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.account_compliance
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN account_route SET NOT NULL,
  ALTER COLUMN account_type SET NOT NULL,
  ALTER COLUMN age_band_declaration SET NOT NULL,
  ALTER COLUMN parent_managed SET NOT NULL,
  ALTER COLUMN parent_guardian_attested SET NOT NULL,
  ALTER COLUMN terms_version SET NOT NULL,
  ALTER COLUMN terms_accepted_at SET NOT NULL,
  ALTER COLUMN privacy_version SET NOT NULL,
  ALTER COLUMN privacy_accepted_at SET NOT NULL,
  ALTER COLUMN ai_disclaimer_version SET NOT NULL,
  ALTER COLUMN ai_disclaimer_accepted_at SET NOT NULL,
  ALTER COLUMN marketing_consent SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.account_compliance'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.account_compliance
      ADD CONSTRAINT account_compliance_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.account_compliance'::regclass
      AND conname = 'account_compliance_user_id_fkey'
  ) THEN
    ALTER TABLE public.account_compliance
      ADD CONSTRAINT account_compliance_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.account_compliance
  DROP CONSTRAINT IF EXISTS account_compliance_account_route_check,
  DROP CONSTRAINT IF EXISTS account_compliance_account_type_check,
  DROP CONSTRAINT IF EXISTS account_compliance_age_band_declaration_check,
  DROP CONSTRAINT IF EXISTS account_compliance_parent_route_consistency,
  DROP CONSTRAINT IF EXISTS account_compliance_under_13_age_band,
  DROP CONSTRAINT IF EXISTS account_compliance_parent_age_band,
  DROP CONSTRAINT IF EXISTS account_compliance_marketing_timestamp;

ALTER TABLE public.account_compliance
  ADD CONSTRAINT account_compliance_account_route_check CHECK (
    account_route IN ('self_service_13_plus', 'parent_guardian', 'under_13')
  ),
  ADD CONSTRAINT account_compliance_account_type_check CHECK (
    account_type IN ('self_service_performer', 'parent_guardian_managed')
  ),
  ADD CONSTRAINT account_compliance_age_band_declaration_check CHECK (
    age_band_declaration IN ('13_plus', 'parent_guardian', 'under_13')
  ),
  ADD CONSTRAINT account_compliance_parent_route_consistency CHECK (
    (
      account_route = 'self_service_13_plus'
      AND account_type = 'self_service_performer'
      AND age_band_declaration = '13_plus'
      AND parent_managed = false
      AND parent_guardian_attested = false
      AND parent_guardian_attested_at IS NULL
    )
    OR
    (
      account_route IN ('parent_guardian', 'under_13')
      AND account_type = 'parent_guardian_managed'
      AND parent_managed = true
      AND parent_guardian_attested = true
      AND parent_guardian_attested_at IS NOT NULL
    )
  ),
  ADD CONSTRAINT account_compliance_under_13_age_band CHECK (
    account_route <> 'under_13' OR age_band_declaration = 'under_13'
  ),
  ADD CONSTRAINT account_compliance_parent_age_band CHECK (
    account_route <> 'parent_guardian' OR age_band_declaration = 'parent_guardian'
  ),
  ADD CONSTRAINT account_compliance_marketing_timestamp CHECK (
    (marketing_consent = true AND marketing_consent_at IS NOT NULL)
    OR (marketing_consent = false AND marketing_consent_at IS NULL)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_compliance TO authenticated;
GRANT ALL ON public.account_compliance TO service_role;

ALTER TABLE public.account_compliance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can select account compliance"
  ON public.account_compliance;
CREATE POLICY "Owner can select account compliance"
  ON public.account_compliance FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner can insert account compliance"
  ON public.account_compliance;
CREATE POLICY "Owner can insert account compliance"
  ON public.account_compliance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner can update account compliance"
  ON public.account_compliance;
CREATE POLICY "Owner can update account compliance"
  ON public.account_compliance FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_account_compliance_updated_at
  ON public.account_compliance;
CREATE TRIGGER trg_account_compliance_updated_at
  BEFORE UPDATE ON public.account_compliance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
