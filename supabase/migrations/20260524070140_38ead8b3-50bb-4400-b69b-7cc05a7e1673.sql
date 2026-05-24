DROP POLICY IF EXISTS "Owner can insert takes" ON public.takes;

CREATE POLICY "Owner can insert takes"
  ON public.takes
  FOR INSERT
  WITH CHECK (
    (
      auth.uid() IS NOT NULL
      AND auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.auditions a
        WHERE a.id = takes.audition_id
          AND a.user_id = auth.uid()
      )
    )
    OR (
      auth.uid() IS NULL
      AND user_id IS NULL
      AND anon_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.auditions a
        WHERE a.id = takes.audition_id
          AND a.anon_id = takes.anon_id
      )
    )
  );