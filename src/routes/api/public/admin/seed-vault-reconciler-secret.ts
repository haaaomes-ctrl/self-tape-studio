import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// One-time seed endpoint. Copies the worker's RECONCILER_SECRET env var into
// vault.secrets under the name `reconciler_secret` (used by the pg_cron job).
// The value is never returned to the caller. Safe to call publicly; will be
// removed after the vault is seeded.
export const Route = createFileRoute('/api/public/admin/seed-vault-reconciler-secret')({
  server: {
    handlers: {
      POST: async () => {
        const value = process.env.RECONCILER_SECRET;
        if (!value) {
          return new Response(
            JSON.stringify({ error: 'RECONCILER_SECRET not configured on worker' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const { data, error } = await supabaseAdmin.rpc(
          'seed_reconciler_vault_secret' as never,
          { p_value: value } as never,
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
