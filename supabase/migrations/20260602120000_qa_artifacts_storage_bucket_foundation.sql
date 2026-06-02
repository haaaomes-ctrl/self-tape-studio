-- Owned Supabase cutover foundation for internal QA artefact storage.
-- Strictly idempotent: do not alter existing buckets or policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-artifacts', 'qa-artifacts', false)
ON CONFLICT (id) DO NOTHING;
