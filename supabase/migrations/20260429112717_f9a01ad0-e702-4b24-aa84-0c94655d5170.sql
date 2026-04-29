ALTER TABLE public.auditions
  ADD COLUMN IF NOT EXISTS audition_level text NOT NULL DEFAULT 'emerging',
  ADD COLUMN IF NOT EXISTS extracted_brief jsonb;

ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS compliance_flags jsonb,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb;