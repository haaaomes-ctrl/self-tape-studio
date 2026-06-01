## Rotate SUPABASE_SERVICE_ROLE_KEY

Use the `supabase--rotate_api_keys` tool to generate fresh Supabase API keys for this Lovable Cloud project. This will:

1. Generate a new `SUPABASE_SERVICE_ROLE_KEY` (and refresh the publishable/anon key pair).
2. Update the project's `.env` and internal integration data so server functions and the admin client (`src/integrations/supabase/client.server.ts`) pick up the new key automatically.
3. Disable the previous keys so any leaked copy stops working.

### After rotation — manual steps you'll need to do

The rotated value is **not** automatically propagated to anything outside this Lovable project. You must update it everywhere it's been pasted, specifically:

- **External Cloudflare Worker** — paste the new `SUPABASE_SERVICE_ROLE_KEY` into the Worker's secrets (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY` or via the Cloudflare dashboard) and redeploy.
- Any other external service, CI secret store, or local `.env` file where the old key was stored.

### What I will NOT touch

- No source code changes.
- No migrations.
- No edits to `src/integrations/supabase/client.server.ts`, `.env` (manually), or any auto-generated files.
- No publish/deploy.

### Confirmation needed

Rotating immediately invalidates the current service role key. Any system still using the old key (including the Cloudflare Worker you mentioned earlier) will start failing with auth errors until you update it.

Confirm and I'll run the rotation, then report back the new key so you can paste it into the Worker.