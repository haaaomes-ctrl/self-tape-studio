import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// One-time seed endpoint: copies the worker's RECONCILER_SECRET into
// vault.secrets under the name `reconciler_secret` so the pg_cron job can read it.
// Caller must present the same RECONCILER_SECRET as `x-reconciler-secret` header.
export const Route = createFileRoute('/api/public/admin/seed-vault-reconciler-secret')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get('x-reconciler-secret');
        const expected = process.env.RECONCILER_SECRET;
        if (!expected) {
          return new Response(
            JSON.stringify({ error: 'RECONCILER_SECRET not configured on worker' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (!provided || provided !== expected) {
          return new Response('Unauthorized', { status: 401 });
        }

        const { data, error } = await supabaseAdmin.rpc(
          'seed_reconciler_vault_secret' as never,
          { p_value: expected } as never,
        );

        if (error) {
          return new Response(
            JSON.stringify({ error: (error as { message: string }).message }),
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
