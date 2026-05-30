-- Smoke-test tech debt cleanup.
--
-- The external-worker smoke succeeded, but logs showed two deployment wiring
-- issues:
-- - an old Lovable reconciler cron job still calling a stale project URL;
-- - PostgREST schema cache missing the CRM account-compliance sync RPC.
--
-- This migration only repairs deployment/runtime plumbing. It does not change
-- S10 report logic, prompts, scoring, UI rendering, analysis dispatch, or queue
-- behaviour.

DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'reconcile-stale-takes'
      OR command LIKE '%project--af0c387f-c90b-4efa-b943-dc325d1a44f5.lovable.app/api/public/reconcile-stale-takes%'
      OR command LIKE '%selftape.lovable.app/api/public/reconcile-stale-takes%'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'reconciler_secret') THEN
    RAISE WARNING 'Supabase Vault secret reconciler_secret is missing; reconcile-stale-takes will return 401 until it matches Worker RECONCILER_SECRET';
  END IF;
END $$;

SELECT cron.schedule(
  'reconcile-stale-takes',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tapecoach.co.uk/api/public/reconcile-stale-takes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reconciler-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reconciler_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $cron$
);

CREATE OR REPLACE FUNCTION public.sync_crm_contact_from_account_compliance(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  compliance public.account_compliance%ROWTYPE;
  user_email TEXT;
  normalized TEXT;
  segment TEXT := 'unknown';
  role TEXT := 'unknown';
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF user_email IS NULL OR trim(user_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO compliance
  FROM public.account_compliance
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  normalized := public.crm_normalize_email(user_email);

  IF compliance.account_type = 'parent_guardian_managed' THEN
    segment := 'parent_guardian';
    role := 'parent_guardian';
  ELSIF compliance.account_type = 'self_service_performer' THEN
    segment := 'performer';
    role := 'performer';
  END IF;

  INSERT INTO public.crm_contacts (
    user_id,
    email,
    normalized_email,
    user_segment,
    recipient_role,
    account_route,
    account_type,
    age_band_declaration,
    parent_managed,
    service_messages_allowed,
    marketing_consent,
    marketing_consent_at,
    lifecycle_messages_allowed,
    consent_source,
    crm_metadata
  )
  VALUES (
    p_user_id,
    user_email,
    normalized,
    segment,
    role,
    compliance.account_route,
    compliance.account_type,
    compliance.age_band_declaration,
    COALESCE(compliance.parent_managed, false),
    true,
    COALESCE(compliance.marketing_consent, false),
    compliance.marketing_consent_at,
    COALESCE(compliance.marketing_consent, false),
    'account_compliance',
    jsonb_build_object(
      'source', 'account_compliance_sync',
      'policy_versions', jsonb_build_object(
        'terms', compliance.terms_version,
        'privacy', compliance.privacy_version,
        'ai_disclaimer', compliance.ai_disclaimer_version
      )
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    normalized_email = EXCLUDED.normalized_email,
    user_segment = EXCLUDED.user_segment,
    recipient_role = EXCLUDED.recipient_role,
    account_route = EXCLUDED.account_route,
    account_type = EXCLUDED.account_type,
    age_band_declaration = EXCLUDED.age_band_declaration,
    parent_managed = EXCLUDED.parent_managed,
    service_messages_allowed = EXCLUDED.service_messages_allowed,
    marketing_consent = EXCLUDED.marketing_consent,
    marketing_consent_at = EXCLUDED.marketing_consent_at,
    lifecycle_messages_allowed = EXCLUDED.lifecycle_messages_allowed,
    consent_source = EXCLUDED.consent_source,
    crm_metadata = public.crm_contacts.crm_metadata || EXCLUDED.crm_metadata,
    updated_at = now();

  RETURN p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_crm_contact_from_account_compliance_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.sync_crm_contact_from_account_compliance(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_compliance_sync_crm_contact ON public.account_compliance;
CREATE TRIGGER account_compliance_sync_crm_contact
AFTER INSERT OR UPDATE ON public.account_compliance
FOR EACH ROW EXECUTE FUNCTION public.sync_crm_contact_from_account_compliance_trigger();

REVOKE EXECUTE ON FUNCTION public.sync_crm_contact_from_account_compliance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_crm_contact_from_account_compliance_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_crm_contact_from_account_compliance(UUID) TO service_role;

-- Refresh PostgREST's schema cache so server RPC calls can see the reasserted
-- function immediately after deployment.
NOTIFY pgrst, 'reload schema';

-- Deploy verification: only the canonical production reconciler URL should
-- remain scheduled.
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'reconcile-stale-takes'
   OR command LIKE '%/api/public/reconcile-stale-takes%';
