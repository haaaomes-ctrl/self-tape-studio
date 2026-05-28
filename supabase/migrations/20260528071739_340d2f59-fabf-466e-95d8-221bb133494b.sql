-- DS-07: partner data visibility, consent and dashboard data foundation.
--
-- This establishes the data-sharing rules used by future partner dashboards.
-- It intentionally does not create partner portal UI, admin console UI, public
-- report sharing/export, leaderboard/ranking, or S10 report-intelligence changes.

DO $$
BEGIN
  CREATE TYPE public.partner_visibility_scope AS ENUM (
    'aggregate_only',
    'limited_usage_readiness',
    'named_progress'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.partner_visibility_acceptance_status AS ENUM (
    'active',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.partner_default_visibility_scope(
  p_partner_type public.partner_type
)
RETURNS public.partner_visibility_scope
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_partner_type
    WHEN 'school' THEN 'named_progress'::public.partner_visibility_scope
    WHEN 'coach' THEN 'named_progress'::public.partner_visibility_scope
    WHEN 'agent' THEN 'limited_usage_readiness'::public.partner_visibility_scope
    WHEN 'platform' THEN 'limited_usage_readiness'::public.partner_visibility_scope
    ELSE 'aggregate_only'::public.partner_visibility_scope
  END;
$$;

CREATE TABLE IF NOT EXISTS public.partner_visibility_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_membership_id UUID NOT NULL REFERENCES public.partner_memberships(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_type public.partner_type NOT NULL,
  visibility_scope public.partner_visibility_scope NOT NULL,
  status public.partner_visibility_acceptance_status NOT NULL DEFAULT 'active',
  policy_version TEXT NOT NULL,
  parent_guardian_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  full_report_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_media_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  brief_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  leaderboard_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revocation_reason TEXT,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_visibility_acceptances_policy_present CHECK (length(trim(policy_version)) > 0),
  CONSTRAINT partner_visibility_acceptances_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT partner_visibility_acceptances_no_leaderboard CHECK (leaderboard_enabled = FALSE),
  CONSTRAINT partner_visibility_acceptances_media_private CHECK (
    uploaded_media_sharing_enabled = FALSE AND brief_sharing_enabled = FALSE
  ),
  CONSTRAINT partner_visibility_acceptances_sponsor_aggregate CHECK (
    partner_type <> 'sponsor' OR visibility_scope = 'aggregate_only'
  ),
  CONSTRAINT partner_visibility_acceptances_agent_limited CHECK (
    partner_type <> 'agent' OR visibility_scope IN ('aggregate_only', 'limited_usage_readiness')
  ),
  CONSTRAINT partner_visibility_acceptances_platform_limited CHECK (
    partner_type <> 'platform' OR visibility_scope IN ('aggregate_only', 'limited_usage_readiness')
  ),
  CONSTRAINT partner_visibility_acceptances_revoked_fields CHECK (
    status <> 'revoked' OR revoked_at IS NOT NULL
  )
);

ALTER TABLE public.partner_visibility_acceptances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.partner_visibility_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.partner_visibility_acceptances TO service_role;

DROP TRIGGER IF EXISTS partner_visibility_acceptances_set_updated_at
  ON public.partner_visibility_acceptances;
CREATE TRIGGER partner_visibility_acceptances_set_updated_at
BEFORE UPDATE ON public.partner_visibility_acceptances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS partner_visibility_acceptances_partner_idx
  ON public.partner_visibility_acceptances (partner_id, status, visibility_scope);
CREATE INDEX IF NOT EXISTS partner_visibility_acceptances_user_idx
  ON public.partner_visibility_acceptances (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS partner_visibility_acceptances_one_active_membership_idx
  ON public.partner_visibility_acceptances (partner_membership_id)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS partner_visibility_acceptances_idempotency_key_idx
  ON public.partner_visibility_acceptances (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.accept_partner_visibility(
  p_partner_membership_id UUID,
  p_user_id UUID,
  p_visibility_scope public.partner_visibility_scope DEFAULT NULL,
  p_parent_guardian_confirmed BOOLEAN DEFAULT FALSE,
  p_full_report_sharing_enabled BOOLEAN DEFAULT FALSE,
  p_uploaded_media_sharing_enabled BOOLEAN DEFAULT FALSE,
  p_brief_sharing_enabled BOOLEAN DEFAULT FALSE,
  p_accepted_at TIMESTAMPTZ DEFAULT now(),
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
  selected_account public.account_compliance%ROWTYPE;
  effective_scope public.partner_visibility_scope;
  existing_acceptance_id UUID;
  new_acceptance_id UUID;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_acceptance_id
    FROM public.partner_visibility_acceptances
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF existing_acceptance_id IS NOT NULL THEN
      RETURN existing_acceptance_id;
    END IF;
  END IF;

  IF p_uploaded_media_sharing_enabled = TRUE OR p_brief_sharing_enabled = TRUE THEN
    RAISE EXCEPTION 'uploaded video and brief sharing are not enabled by default';
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

  IF selected_membership.user_id <> p_user_id THEN
    RAISE EXCEPTION 'partner visibility user mismatch';
  END IF;

  SELECT * INTO selected_partner
  FROM public.partners
  WHERE id = selected_membership.partner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner not found';
  END IF;

  effective_scope := COALESCE(
    p_visibility_scope,
    public.partner_default_visibility_scope(selected_partner.type)
  );

  IF selected_partner.type = 'sponsor' AND effective_scope <> 'aggregate_only' THEN
    RAISE EXCEPTION 'sponsor partners can access aggregate data only';
  END IF;

  IF selected_partner.type IN ('agent', 'platform') AND effective_scope = 'named_progress' THEN
    RAISE EXCEPTION 'partner type cannot access named progress data';
  END IF;

  IF selected_partner.type IN ('sponsor', 'platform')
     AND p_full_report_sharing_enabled = TRUE THEN
    RAISE EXCEPTION 'partner type cannot access full reports';
  END IF;

  SELECT * INTO selected_account
  FROM public.account_compliance
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account compliance is required for partner visibility';
  END IF;

  IF selected_account.account_route = 'under_13'
     AND p_parent_guardian_confirmed = FALSE THEN
    RAISE EXCEPTION 'under-13 partner linking requires parent/guardian confirmation';
  END IF;

  UPDATE public.partner_visibility_acceptances
  SET
    status = 'revoked',
    revoked_at = p_accepted_at,
    revocation_reason = 'replaced_by_new_acceptance'
  WHERE partner_membership_id = selected_membership.id
    AND status = 'active';

  INSERT INTO public.partner_visibility_acceptances (
    partner_membership_id,
    partner_id,
    user_id,
    partner_type,
    visibility_scope,
    status,
    policy_version,
    parent_guardian_confirmed,
    full_report_sharing_enabled,
    uploaded_media_sharing_enabled,
    brief_sharing_enabled,
    leaderboard_enabled,
    accepted_at,
    metadata,
    idempotency_key
  )
  VALUES (
    selected_membership.id,
    selected_membership.partner_id,
    selected_membership.user_id,
    selected_partner.type,
    effective_scope,
    'active',
    'partner-visibility-2026-05-27',
    p_parent_guardian_confirmed,
    p_full_report_sharing_enabled,
    FALSE,
    FALSE,
    FALSE,
    p_accepted_at,
    COALESCE(p_metadata, '{}'::jsonb),
    p_idempotency_key
  )
  RETURNING id INTO new_acceptance_id;

  RETURN new_acceptance_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_partner_visibility_acceptance(
  p_partner_visibility_acceptance_id UUID,
  p_revoked_by_user_id UUID DEFAULT NULL,
  p_revocation_reason TEXT DEFAULT NULL,
  p_revoked_at TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_visibility_acceptances
  SET
    status = 'revoked',
    revoked_at = p_revoked_at,
    revoked_by_user_id = p_revoked_by_user_id,
    revocation_reason = p_revocation_reason
  WHERE id = p_partner_visibility_acceptance_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active partner visibility acceptance not found';
  END IF;

  RETURN p_partner_visibility_acceptance_id;
END;
$$;

CREATE OR REPLACE VIEW public.partner_progress_dashboard_summary AS
WITH ranked_takes AS (
  SELECT
    audition.user_id,
    audition.id AS audition_id,
    take_row.id AS take_id,
    take_row.created_at AS report_created_at,
    take_row.overall_score,
    take_row.report,
    ROW_NUMBER() OVER (
      PARTITION BY audition.user_id
      ORDER BY take_row.created_at DESC, take_row.id DESC
    ) AS take_rank,
    LEAD(take_row.overall_score) OVER (
      PARTITION BY audition.user_id
      ORDER BY take_row.created_at DESC, take_row.id DESC
    ) AS previous_score
  FROM public.takes take_row
  JOIN public.auditions audition ON audition.id = take_row.audition_id
  WHERE take_row.overall_score IS NOT NULL OR take_row.report IS NOT NULL
),
latest_take AS (
  SELECT *
  FROM ranked_takes
  WHERE take_rank = 1
),
report_dates AS (
  SELECT
    user_id,
    ARRAY_AGG(report_created_at ORDER BY report_created_at DESC) AS report_dates,
    COUNT(*)::INTEGER AS report_count
  FROM ranked_takes
  GROUP BY user_id
),
membership_credit_usage AS (
  SELECT
    membership.id AS partner_membership_id,
    COALESCE(SUM(ABS(ledger.credit_delta)) FILTER (
      WHERE ledger.entry_type = 'consume'
    ), 0)::INTEGER AS credits_used
  FROM public.partner_memberships membership
  LEFT JOIN public.credit_grants grant_row
    ON grant_row.source_reference_type = 'partner_membership'
   AND grant_row.source_reference_id = membership.id::TEXT
  LEFT JOIN public.credit_ledger_entries ledger
    ON ledger.credit_grant_id = grant_row.id
  GROUP BY membership.id
)
SELECT
  acceptance.partner_id,
  partner.name AS partner_name,
  partner.type AS partner_type,
  acceptance.partner_membership_id,
  acceptance.user_id,
  acceptance.visibility_scope,
  CASE
    WHEN acceptance.visibility_scope = 'named_progress'
      THEN NULLIF(acceptance.metadata ->> 'performer_name', '')
    ELSE NULL
  END AS performer_name,
  COALESCE(usage.credits_used, 0)::INTEGER AS credits_used,
  COALESCE(dates.report_count, 0)::INTEGER AS report_count,
  CASE
    WHEN acceptance.visibility_scope = 'named_progress' THEN latest.overall_score
    ELSE NULL
  END AS latest_score,
  CASE
    WHEN acceptance.visibility_scope = 'named_progress'
      AND latest.overall_score IS NOT NULL
      AND latest.previous_score IS NOT NULL
      THEN latest.overall_score - latest.previous_score
    ELSE NULL
  END AS score_trend,
  CASE
    WHEN acceptance.visibility_scope IN ('named_progress', 'limited_usage_readiness')
      AND latest.overall_score IS NOT NULL
      THEN CASE
        WHEN latest.overall_score < 40 THEN 'not_ready_or_not_assessable'
        WHEN latest.overall_score < 55 THEN 'retake_recommended'
        WHEN latest.overall_score < 70 THEN 'review_carefully'
        WHEN latest.overall_score < 85 THEN 'submission_supporting'
        ELSE 'strong_submission'
      END
    ELSE NULL
  END AS readiness_band,
  CASE
    WHEN acceptance.visibility_scope = 'named_progress'
      THEN COALESCE(
        latest.report #>> '{s10_fix_hierarchy,fix_first,category}',
        latest.report #>> '{fix_first,category}',
        latest.report #>> '{priority_fixes,0,category}'
      )
    ELSE NULL
  END AS fix_first_category,
  CASE
    WHEN acceptance.visibility_scope IN ('named_progress', 'limited_usage_readiness')
      THEN latest.report_created_at
    ELSE NULL
  END AS latest_report_at,
  CASE
    WHEN acceptance.visibility_scope = 'named_progress'
      THEN COALESCE(dates.report_dates, ARRAY[]::TIMESTAMPTZ[])
    ELSE ARRAY[]::TIMESTAMPTZ[]
  END AS report_dates,
  acceptance.full_report_sharing_enabled AS full_report_visible,
  FALSE AS uploaded_media_visible,
  FALSE AS brief_visible,
  FALSE AS leaderboard_visible
FROM public.partner_visibility_acceptances acceptance
JOIN public.partners partner ON partner.id = acceptance.partner_id
JOIN public.partner_memberships membership
  ON membership.id = acceptance.partner_membership_id
LEFT JOIN latest_take latest ON latest.user_id = acceptance.user_id
LEFT JOIN report_dates dates ON dates.user_id = acceptance.user_id
LEFT JOIN membership_credit_usage usage
  ON usage.partner_membership_id = acceptance.partner_membership_id
WHERE acceptance.status = 'active'
  AND membership.status = 'active'
  AND partner.type <> 'sponsor'
  AND acceptance.visibility_scope <> 'aggregate_only';

CREATE OR REPLACE VIEW public.partner_aggregate_dashboard_summary AS
WITH ranked_takes AS (
  SELECT
    audition.user_id,
    take_row.id AS take_id,
    take_row.created_at AS report_created_at,
    take_row.overall_score,
    ROW_NUMBER() OVER (
      PARTITION BY audition.user_id
      ORDER BY take_row.created_at DESC, take_row.id DESC
    ) AS take_rank
  FROM public.takes take_row
  JOIN public.auditions audition ON audition.id = take_row.audition_id
  WHERE take_row.overall_score IS NOT NULL OR take_row.report IS NOT NULL
),
latest_takes AS (
  SELECT *
  FROM ranked_takes
  WHERE take_rank = 1
),
report_counts AS (
  SELECT
    user_id,
    COUNT(*)::INTEGER AS report_count
  FROM ranked_takes
  GROUP BY user_id
),
membership_credit_usage AS (
  SELECT
    membership.id AS partner_membership_id,
    COALESCE(SUM(ABS(ledger.credit_delta)) FILTER (
      WHERE ledger.entry_type = 'consume'
    ), 0)::INTEGER AS credits_used
  FROM public.partner_memberships membership
  LEFT JOIN public.credit_grants grant_row
    ON grant_row.source_reference_type = 'partner_membership'
   AND grant_row.source_reference_id = membership.id::TEXT
  LEFT JOIN public.credit_ledger_entries ledger
    ON ledger.credit_grant_id = grant_row.id
  GROUP BY membership.id
)
SELECT
  partner.id AS partner_id,
  partner.name AS partner_name,
  partner.type AS partner_type,
  COUNT(DISTINCT membership.user_id)::INTEGER AS active_member_count,
  COALESCE(SUM(usage.credits_used), 0)::INTEGER AS credits_used,
  COALESCE(SUM(report_counts.report_count), 0)::INTEGER AS report_count,
  MAX(latest_takes.report_created_at) AS latest_report_at,
  ROUND(AVG(latest_takes.overall_score)::NUMERIC, 2) AS average_latest_score
FROM public.partners partner
LEFT JOIN public.partner_memberships membership
  ON membership.partner_id = partner.id
 AND membership.status = 'active'
LEFT JOIN membership_credit_usage usage
  ON usage.partner_membership_id = membership.id
LEFT JOIN report_counts ON report_counts.user_id = membership.user_id
LEFT JOIN latest_takes ON latest_takes.user_id = membership.user_id
GROUP BY partner.id, partner.name, partner.type;

REVOKE ALL ON TABLE public.partner_progress_dashboard_summary FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.partner_aggregate_dashboard_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.partner_progress_dashboard_summary TO service_role;
GRANT SELECT ON TABLE public.partner_aggregate_dashboard_summary TO service_role;

REVOKE EXECUTE ON FUNCTION public.partner_default_visibility_scope(public.partner_type)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_partner_visibility(
  UUID,
  UUID,
  public.partner_visibility_scope,
  BOOLEAN,
  BOOLEAN,
  BOOLEAN,
  BOOLEAN,
  TIMESTAMPTZ,
  JSONB,
  TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_partner_visibility_acceptance(
  UUID,
  UUID,
  TEXT,
  TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.partner_default_visibility_scope(public.partner_type)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_partner_visibility(
  UUID,
  UUID,
  public.partner_visibility_scope,
  BOOLEAN,
  BOOLEAN,
  BOOLEAN,
  BOOLEAN,
  TIMESTAMPTZ,
  JSONB,
  TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_partner_visibility_acceptance(
  UUID,
  UUID,
  TEXT,
  TIMESTAMPTZ
) TO service_role;