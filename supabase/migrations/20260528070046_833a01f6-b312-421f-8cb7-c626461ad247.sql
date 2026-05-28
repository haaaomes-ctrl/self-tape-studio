CREATE TABLE public.account_compliance (
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_compliance TO authenticated;
GRANT ALL ON public.account_compliance TO service_role;

ALTER TABLE public.account_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select account compliance"
  ON public.account_compliance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert account compliance"
  ON public.account_compliance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update account compliance"
  ON public.account_compliance FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_account_compliance_updated_at
  BEFORE UPDATE ON public.account_compliance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();