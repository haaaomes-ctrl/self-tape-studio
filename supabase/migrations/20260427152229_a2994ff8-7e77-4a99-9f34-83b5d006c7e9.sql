-- Auditions table
CREATE TABLE public.auditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled audition',
  brief TEXT,
  brief_source TEXT NOT NULL DEFAULT 'none' CHECK (brief_source IN ('full', 'guided', 'none')),
  mode TEXT NOT NULL DEFAULT 'baseline' CHECK (mode IN ('brief', 'baseline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select auditions"
  ON public.auditions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert auditions"
  ON public.auditions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update auditions"
  ON public.auditions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete auditions"
  ON public.auditions FOR DELETE
  USING (auth.uid() = user_id);

-- Takes table
CREATE TABLE public.takes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audition_id UUID NOT NULL REFERENCES public.auditions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  take_number INTEGER NOT NULL DEFAULT 1,
  video_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  error_message TEXT,
  confidence INTEGER,
  overall_score INTEGER,
  scores JSONB,
  report JSONB,
  signals JSONB,
  checklist JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_takes_audition_id ON public.takes(audition_id);
CREATE INDEX idx_takes_user_id ON public.takes(user_id);

ALTER TABLE public.takes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select takes"
  ON public.takes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert takes"
  ON public.takes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update takes"
  ON public.takes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete takes"
  ON public.takes FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auditions_updated_at
  BEFORE UPDATE ON public.auditions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_takes_updated_at
  BEFORE UPDATE ON public.takes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for video uploads (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audition-videos', 'audition-videos', false);

-- Storage RLS: users can only access files in a folder named after their user id
CREATE POLICY "Users can read own videos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audition-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audition-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audition-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audition-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );