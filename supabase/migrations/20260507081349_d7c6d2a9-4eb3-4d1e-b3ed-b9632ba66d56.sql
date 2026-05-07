ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS future_evidence_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS future_report_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS future_qa_trace_enabled boolean NOT NULL DEFAULT false;