-- Internal QA-safe trace table. RLS deny-all; admin reads happen server-side
-- via service-role client + has_role check. Writes are gated in app code by
-- the future_qa_trace_enabled feature flag.
CREATE TABLE public.take_qa_traces (
  take_id uuid PRIMARY KEY REFERENCES public.takes(id) ON DELETE CASCADE,
  schema_version text,
  branch text,
  components_summary jsonb,
  dimensions_summary jsonb,
  sufficiency jsonb,
  scrub_counters jsonb,
  shadow_divergence jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.take_qa_traces ENABLE ROW LEVEL SECURITY;

-- Deny-all to anon and authenticated. No policies created => no access via
-- PostgREST. Server code uses the service-role client (bypasses RLS) and
-- must gate reads behind a server-side has_role('admin') check.

CREATE TRIGGER take_qa_traces_set_updated_at
  BEFORE UPDATE ON public.take_qa_traces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_take_qa_traces_branch_created
  ON public.take_qa_traces (branch, created_at DESC);
CREATE INDEX idx_take_qa_traces_schema_version
  ON public.take_qa_traces (schema_version);