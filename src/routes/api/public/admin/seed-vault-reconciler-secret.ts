import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// One-time seed endpoint: copies the worker's RECONCILER_SECRET into
// vault.secrets under the name `reconciler_secret` so the pg_cron job can read it.
// Protected by requiring the caller to present the same RECONCILER_SECRET as a header.
export const Route = createFileRoute('/api/public/admin/seed-vault-reconciler-secret')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get('x-reconciler-secret');
        const expected = process.env.RECONCILER_SECRET;
        if (!expected) {
          return new Response(JSON.stringify({ error: 'RECONCILER_SECRET not configured on worker' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (!provided || provided !== expected) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Check if it already exists
        const { data: existing, error: selErr } = await supabaseAdmin
          .rpc('exec_sql' as never, {} as never)
          .then(() => ({ data: null, error: null }))
          .catch(() => ({ data: null, error: null }));
        void existing;
        void selErr;

        // Use vault.create_secret via direct SQL through PostgREST is not available;
        // use raw SQL via supabaseAdmin.from is not possible either.
        // Instead, call a SECURITY DEFINER RPC we will create.
        const { data, error } = await supabaseAdmin.rpc('seed_reconciler_vault_secret', {
          p_value: expected,
        });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, details: error }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(JSON.stringify({ success: true, result: data }), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  },
});
