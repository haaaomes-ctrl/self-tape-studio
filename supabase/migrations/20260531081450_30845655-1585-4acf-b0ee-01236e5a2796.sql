ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS take_slot INTEGER,
  ADD COLUMN IF NOT EXISTS take_version_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS take_version_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS replaces_take_id UUID REFERENCES public.takes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_take_id UUID REFERENCES public.takes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_reason TEXT,
  ADD COLUMN IF NOT EXISTS analysis_run_id TEXT,
  ADD COLUMN IF NOT EXISTS report_model_status TEXT NOT NULL DEFAULT 'not_emitted',
  ADD COLUMN IF NOT EXISTS qa_artifact_status TEXT NOT NULL DEFAULT 'not_enabled',
  ADD COLUMN IF NOT EXISTS manifest_status TEXT NOT NULL DEFAULT 'not_enabled',
  ADD COLUMN IF NOT EXISTS same_video_status TEXT NOT NULL DEFAULT 'not_evaluated',
  ADD COLUMN IF NOT EXISTS take_lifecycle_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

WITH ranked AS (
  SELECT
    id,
    CASE WHEN COALESCE(take_slot, take_number) BETWEEN 1 AND 3 THEN COALESCE(take_slot, take_number) END AS safe_slot,
    ROW_NUMBER() OVER (
      PARTITION BY audition_id, CASE WHEN COALESCE(take_slot, take_number) BETWEEN 1 AND 3 THEN COALESCE(take_slot, take_number) END
      ORDER BY created_at ASC, id ASC
    ) AS version_number,
    ROW_NUMBER() OVER (
      PARTITION BY audition_id, CASE WHEN COALESCE(take_slot, take_number) BETWEEN 1 AND 3 THEN COALESCE(take_slot, take_number) END
      ORDER BY created_at DESC, id DESC
    ) AS newest_rank
  FROM public.takes
)
UPDATE public.takes AS take_row
SET
  take_slot = ranked.safe_slot,
  take_version_number = GREATEST(1, ranked.version_number),
  take_version_status = CASE
    WHEN ranked.safe_slot IS NULL THEN 'archived'
    WHEN ranked.newest_rank = 1 THEN 'active'
    ELSE 'archived'
  END,
  analysis_run_id = COALESCE(take_row.analysis_run_id, 'take-' || take_row.id::text),
  report_model_status = CASE
    WHEN take_row.report IS NOT NULL THEN 'rendered'
    WHEN take_row.status = 'processing' THEN 'pending'
    WHEN take_row.status = 'error' THEN 'failed'
    ELSE take_row.report_model_status
  END
FROM ranked
WHERE take_row.id = ranked.id;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_take_slot_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_take_slot_check CHECK (take_slot IS NULL OR take_slot BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_take_version_number_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_take_version_number_check CHECK (take_version_number >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_take_version_status_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_take_version_status_check
      CHECK (take_version_status IN ('active','replaced','processing_failed','analysis_failed','deleted_by_user','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_replacement_reason_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_replacement_reason_check
      CHECK (replacement_reason IS NULL OR replacement_reason IN
        ('user_replaced','operator_retest','upload_cancelled','same_media_retest',
         'changed_brief_same_media','changed_level_same_media','changed_role_context_same_media'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_report_model_status_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_report_model_status_check
      CHECK (report_model_status IN ('not_emitted','pending','rendered','failed','deferred'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_qa_artifact_status_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_qa_artifact_status_check
      CHECK (qa_artifact_status IN ('not_enabled','emitted','partially_emitted','failed','deferred','not_applicable'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_manifest_status_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_manifest_status_check
      CHECK (manifest_status IN ('not_enabled','emitted','partially_emitted','failed','deferred','not_applicable'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_same_video_status_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_same_video_status_check
      CHECK (same_video_status IN ('not_evaluated','new_media','same_video_confirmed','probable_duplicate',
        'possible_duplicate','intentional_retest','same_video_changed_brief','same_video_changed_level',
        'same_video_changed_report_version','duplicate_in_comparison','uncertain'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'takes_s10_lifecycle_metadata_object_check') THEN
    ALTER TABLE public.takes ADD CONSTRAINT takes_s10_lifecycle_metadata_object_check
      CHECK (jsonb_typeof(take_lifecycle_metadata) = 'object');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS takes_one_active_version_per_slot_idx
  ON public.takes (audition_id, take_slot)
  WHERE take_slot IS NOT NULL AND take_version_status = 'active';
CREATE INDEX IF NOT EXISTS takes_audition_slot_version_idx
  ON public.takes (audition_id, take_slot, take_version_number);
CREATE INDEX IF NOT EXISTS takes_replacement_chain_idx
  ON public.takes (replaces_take_id, replaced_by_take_id);
CREATE INDEX IF NOT EXISTS takes_analysis_run_id_idx
  ON public.takes (analysis_run_id) WHERE analysis_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.audition_comparison_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audition_id UUID NOT NULL REFERENCES public.auditions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comparison_run_id TEXT NOT NULL DEFAULT ('comparison-' || gen_random_uuid()::text),
  compared_take_version_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  compared_take_slots INTEGER[] NOT NULL DEFAULT '{}'::integer[],
  comparison_status TEXT NOT NULL DEFAULT 'pending',
  qa_artifact_status TEXT NOT NULL DEFAULT 'not_enabled',
  same_video_status TEXT NOT NULL DEFAULT 'not_evaluated',
  stale_after_replacement BOOLEAN NOT NULL DEFAULT false,
  stale_reason TEXT,
  report JSONB,
  qa_artifacts JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audition_comparison_runs_run_id_key UNIQUE (comparison_run_id),
  CONSTRAINT audition_comparison_runs_take_count_check CHECK (cardinality(compared_take_version_ids) <= 3),
  CONSTRAINT audition_comparison_runs_slot_count_check CHECK (cardinality(compared_take_slots) = cardinality(compared_take_version_ids)),
  CONSTRAINT audition_comparison_runs_slot_values_check CHECK (compared_take_slots <@ ARRAY[1,2,3]::integer[]),
  CONSTRAINT audition_comparison_runs_status_check CHECK (
    comparison_status IN ('pending','processing','rendered','stale_after_replacement',
      'suppressed_same_video','too_close_to_call','failed')),
  CONSTRAINT audition_comparison_runs_qa_artifact_status_check CHECK (
    qa_artifact_status IN ('not_enabled','emitted','partially_emitted','failed','deferred','not_applicable')),
  CONSTRAINT audition_comparison_runs_same_video_status_check CHECK (
    same_video_status IN ('not_evaluated','new_media','same_video_confirmed','probable_duplicate',
      'possible_duplicate','intentional_retest','same_video_changed_brief','same_video_changed_level',
      'same_video_changed_report_version','duplicate_in_comparison','uncertain')),
  CONSTRAINT audition_comparison_runs_qa_artifacts_object_check CHECK (jsonb_typeof(qa_artifacts) = 'object'),
  CONSTRAINT audition_comparison_runs_metadata_object_check CHECK (jsonb_typeof(comparison_metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS audition_comparison_runs_audition_id_idx ON public.audition_comparison_runs (audition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audition_comparison_runs_user_id_idx ON public.audition_comparison_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audition_comparison_runs_stale_idx ON public.audition_comparison_runs (audition_id, stale_after_replacement) WHERE stale_after_replacement = true;

ALTER TABLE public.audition_comparison_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audition_comparison_runs' AND policyname='Owner can select audition comparison runs') THEN
    CREATE POLICY "Owner can select audition comparison runs" ON public.audition_comparison_runs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audition_comparison_runs' AND policyname='Owner can insert audition comparison runs') THEN
    CREATE POLICY "Owner can insert audition comparison runs" ON public.audition_comparison_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audition_comparison_runs' AND policyname='Owner can update audition comparison runs') THEN
    CREATE POLICY "Owner can update audition comparison runs" ON public.audition_comparison_runs FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS audition_comparison_runs_set_updated_at ON public.audition_comparison_runs;
CREATE TRIGGER audition_comparison_runs_set_updated_at
  BEFORE UPDATE ON public.audition_comparison_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_replacement_take_version(
  p_take_id UUID, p_user_id UUID,
  p_signals JSONB DEFAULT NULL, p_checklist JSONB DEFAULT NULL,
  p_replacement_reason TEXT DEFAULT 'user_replaced'
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  old_take public.takes%ROWTYPE;
  resolved_slot INTEGER;
  next_version INTEGER;
  replacement_take_id UUID;
BEGIN
  SELECT * INTO old_take FROM public.takes WHERE id = p_take_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'take_not_found' USING ERRCODE = 'P0002'; END IF;
  IF old_take.user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'take_forbidden' USING ERRCODE = '42501'; END IF;
  IF old_take.take_version_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'take_version_not_active' USING ERRCODE = '22023'; END IF;
  resolved_slot := COALESCE(old_take.take_slot, CASE WHEN old_take.take_number BETWEEN 1 AND 3 THEN old_take.take_number END);
  IF resolved_slot IS NULL OR resolved_slot NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'invalid_take_slot' USING ERRCODE = '22023'; END IF;
  IF p_replacement_reason NOT IN ('user_replaced','operator_retest','upload_cancelled','same_media_retest',
    'changed_brief_same_media','changed_level_same_media','changed_role_context_same_media') THEN
    RAISE EXCEPTION 'invalid_replacement_reason' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(MAX(take_version_number), 0) + 1 INTO next_version
  FROM public.takes
  WHERE audition_id = old_take.audition_id
    AND COALESCE(take_slot, CASE WHEN take_number BETWEEN 1 AND 3 THEN take_number END) = resolved_slot;
  UPDATE public.takes
  SET take_slot = resolved_slot,
      take_version_status = 'replaced',
      replacement_reason = p_replacement_reason,
      report_model_status = CASE WHEN report IS NOT NULL THEN 'rendered' ELSE report_model_status END,
      take_lifecycle_metadata = take_lifecycle_metadata || jsonb_build_object(
        'replaced_at', now(), 'replacement_reason', p_replacement_reason)
  WHERE id = p_take_id;
  INSERT INTO public.takes (
    audition_id, user_id, take_number, take_slot, take_version_number, take_version_status,
    replaces_take_id, replacement_reason, video_path, status, processing_phase, error_message,
    report, scores, overall_score, confidence, signals, checklist, attempt_count, analysis_tier,
    mux_status, mux_upload_id, mux_asset_id, mux_playback_id, mux_mp4_standard_url, mux_mp4_high_url,
    mux_duration_seconds, credit_reservation_id, credit_consumption_ledger_entry_id,
    credit_lifecycle_status, credit_lifecycle_metadata, credit_is_synthetic_usage,
    analytics_attribution, anon_id, report_model_status, qa_artifact_status, manifest_status,
    same_video_status, take_lifecycle_metadata
  ) VALUES (
    old_take.audition_id, old_take.user_id, resolved_slot, resolved_slot, next_version, 'active',
    p_take_id, p_replacement_reason, NULL, 'pending', 'uploading', NULL,
    NULL, NULL, NULL, NULL, p_signals, p_checklist, 0, NULL,
    'none', NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object('trigger','reset_take_for_reupload','replacement_credit_policy','new_report_generation_requires_new_credit'),
    false, COALESCE(old_take.analytics_attribution, '{}'::jsonb), old_take.anon_id,
    'not_emitted','not_enabled','not_enabled','not_evaluated',
    jsonb_build_object('created_from_take_id', p_take_id, 'replacement_reason', p_replacement_reason)
  ) RETURNING id INTO replacement_take_id;
  UPDATE public.takes SET replaced_by_take_id = replacement_take_id WHERE id = p_take_id;
  UPDATE public.audition_comparison_runs
  SET comparison_status = 'stale_after_replacement', stale_after_replacement = true,
      stale_reason = 'Compared take version ' || p_take_id::text || ' was replaced after this comparison was prepared.'
  WHERE audition_id = old_take.audition_id
    AND p_take_id = ANY(compared_take_version_ids)
    AND stale_after_replacement = false;
  RETURN replacement_take_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_audition_comparison_run_foundation(
  p_audition_id UUID, p_user_id UUID
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  active_take_ids UUID[];
  active_take_slots INTEGER[];
  comparison_id UUID;
BEGIN
  SELECT
    COALESCE(array_agg(take_row.id ORDER BY take_row.take_slot), '{}'::uuid[]),
    COALESCE(array_agg(take_row.take_slot ORDER BY take_row.take_slot), '{}'::integer[])
  INTO active_take_ids, active_take_slots
  FROM public.takes AS take_row
  WHERE take_row.audition_id = p_audition_id
    AND take_row.user_id = p_user_id
    AND take_row.take_version_status = 'active'
    AND take_row.take_slot BETWEEN 1 AND 3;
  IF cardinality(active_take_ids) < 2 THEN
    RAISE EXCEPTION 'comparison_requires_two_active_take_versions' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.audition_comparison_runs (
    audition_id, user_id, compared_take_version_ids, compared_take_slots, comparison_metadata
  ) VALUES (
    p_audition_id, p_user_id, active_take_ids, active_take_slots,
    jsonb_build_object('source','s10_comparison_foundation')
  ) RETURNING id INTO comparison_id;
  RETURN comparison_id;
END;
$$;