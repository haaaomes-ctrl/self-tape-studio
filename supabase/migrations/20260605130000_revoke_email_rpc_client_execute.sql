-- WS5 commit 1: lock down the email-queue RPCs.
--
-- Live advisors showed these four SECURITY DEFINER functions were executable
-- by anon AND authenticated via /rest/v1/rpc/. Caller audit (2026-06-05):
-- every invocation in the codebase goes through a service-role client —
--   - enqueue_email:    src/server/b2b-interest.server.ts (supabaseAdmin),
--                       src/routes/lovable/email/auth/webhook.ts (admin runtime client)
--   - read_email_batch / delete_email / move_to_dlq:
--                       src/routes/lovable/email/queue/process.ts (admin runtime client)
-- No client/browser code calls them with the anon or authenticated key, and
-- there are no Supabase Edge Functions in this repo. Revoking client EXECUTE
-- therefore changes nothing for the legitimate pipeline and closes the
-- anonymous enqueue/drain/DLQ surface.

REVOKE EXECUTE ON FUNCTION public.enqueue_email(queue_name text, payload jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(queue_name text, message_id bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
  FROM PUBLIC, anon, authenticated;

-- The email pipeline runs with the service role; keep its grant explicit.
GRANT EXECUTE ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(queue_name text, message_id bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) TO service_role;
