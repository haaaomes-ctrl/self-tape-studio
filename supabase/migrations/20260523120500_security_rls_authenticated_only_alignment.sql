-- Security alignment: TapeCoach is authenticated-only.
--
-- Historical anon_id columns remain for compatibility with old rows and generated
-- types, but new audition/take identities must be owned by auth.users. Do not add
-- anonymous RLS policies for these columns.

COMMENT ON COLUMN public.auditions.anon_id IS
  'DEPRECATED. Anonymous submissions are no longer supported; new rows must use user_id. Kept only for historical compatibility.';

COMMENT ON COLUMN public.takes.anon_id IS
  'DEPRECATED. Anonymous submissions are no longer supported; new rows must use user_id. Kept only for historical compatibility.';

CREATE OR REPLACE FUNCTION public.enforce_identity_xor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user_id is required; anonymous ownership is deprecated'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.anon_id IS NOT NULL THEN
    RAISE EXCEPTION 'anon_id is deprecated; use authenticated user_id ownership'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_identity_xor() IS
  'Enforces authenticated-only row ownership. The historical anon_id path is deprecated and blocked for new identity writes.';

-- Replace "RLS enabled with zero policies" with explicit deny-all policies.
-- Service-role server code still bypasses RLS; anon/authenticated clients get no
-- direct access.

COMMENT ON TABLE public.take_qa_traces IS
  'Internal QA trace table. Service-role only; no direct anon/authenticated client access.';

DROP POLICY IF EXISTS "take_qa_traces deny all select" ON public.take_qa_traces;
DROP POLICY IF EXISTS "take_qa_traces deny all insert" ON public.take_qa_traces;
DROP POLICY IF EXISTS "take_qa_traces deny all update" ON public.take_qa_traces;
DROP POLICY IF EXISTS "take_qa_traces deny all delete" ON public.take_qa_traces;

CREATE POLICY "take_qa_traces deny all select"
  ON public.take_qa_traces FOR SELECT
  USING (false);

CREATE POLICY "take_qa_traces deny all insert"
  ON public.take_qa_traces FOR INSERT
  WITH CHECK (false);

CREATE POLICY "take_qa_traces deny all update"
  ON public.take_qa_traces FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "take_qa_traces deny all delete"
  ON public.take_qa_traces FOR DELETE
  USING (false);

COMMENT ON TABLE public.app_config IS
  'Internal runtime configuration table. Service-role only; no direct anon/authenticated client access.';

DROP POLICY IF EXISTS "app_config deny all select" ON public.app_config;
DROP POLICY IF EXISTS "app_config deny all insert" ON public.app_config;
DROP POLICY IF EXISTS "app_config deny all update" ON public.app_config;
DROP POLICY IF EXISTS "app_config deny all delete" ON public.app_config;

CREATE POLICY "app_config deny all select"
  ON public.app_config FOR SELECT
  USING (false);

CREATE POLICY "app_config deny all insert"
  ON public.app_config FOR INSERT
  WITH CHECK (false);

CREATE POLICY "app_config deny all update"
  ON public.app_config FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "app_config deny all delete"
  ON public.app_config FOR DELETE
  USING (false);

-- QA artefacts are internal-only. The private bucket exists for service-role
-- writes and signed admin downloads only; clients must not receive direct
-- Storage access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-artifacts', 'qa-artifacts', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS "qa_artifacts deny all select" ON storage.objects;
DROP POLICY IF EXISTS "qa_artifacts deny all insert" ON storage.objects;
DROP POLICY IF EXISTS "qa_artifacts deny all update" ON storage.objects;
DROP POLICY IF EXISTS "qa_artifacts deny all delete" ON storage.objects;

CREATE POLICY "qa_artifacts deny all select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'qa-artifacts' AND false);

CREATE POLICY "qa_artifacts deny all insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'qa-artifacts' AND false);

CREATE POLICY "qa_artifacts deny all update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'qa-artifacts' AND false)
  WITH CHECK (bucket_id = 'qa-artifacts' AND false);

CREATE POLICY "qa_artifacts deny all delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'qa-artifacts' AND false);
