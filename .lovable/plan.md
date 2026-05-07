## Findings

A repo-wide search for `selftape` / `self.tape` / `self_tape` (case-insensitive) turned up **one** literal reference to the old brand/URL:

- `supabase/migrations/20260428214150_3b8da3cb-1f00-4762-9f67-4d160fbbf858.sql:42` — historical migration that scheduled the pg_cron reconciler against `https://selftape.lovable.app/api/public/reconcile-stale-takes`.

Everything else is the **industry term "self-tape"** (the act of recording an audition), which is generic copy in the brand voice — e.g. "Private self-tape feedback", "Self-tape tips", AI prompts using the term as casting-industry vocabulary. These are intentional and correct for TapeCoach's positioning. They are not references to the old "Selftape" brand.

The live database cron job has already been repointed to the stable `project--<id>.lovable.app` URL (done in the previous turn), and the Mux webhook is now `https://tapecoach.co.uk/api/public/mux-webhook`.

## Plan

### 1. Update the historical migration file

Edit `supabase/migrations/20260428214150_…sql` line 42 to use the stable project URL (`https://project--af0c387f-c90b-4efa-b943-dc325d1a44f5.lovable.app/...`) so any future re-run, fork, or remix of the project re-creates the cron at the correct host. No DB change is needed — the live job is already correct — but the migration must match reality.

Note: editing a past migration file is acceptable here because it's documentation-of-record for fresh installs; we're not re-running it on production.

### 2. Leave the "self-tape" industry term in copy and prompts

These are not brand references and changing them would break casting-industry positioning:

- `src/config/brand.ts` — mission/description copy
- `src/routes/index.tsx`, `src/routes/about.tsx`, `src/routes/dashboard.tsx` — landing/marketing/onboarding copy
- `src/components/site-footer.tsx` — "Self-tape tips" link label
- `src/server/*.server.ts`, `src/lib/audition-rules.ts` — AI prompts that explicitly tell models to use British casting vocabulary including "self-tape"

If you actually want these reworded too (e.g. replace every "self-tape" with "tape" or "audition tape"), tell me and I'll do a separate pass — but that's a copywriting decision, not a brand-leak fix.

### 3. Verify

After the migration edit, re-run the same `rg -i "selftape"` search to confirm zero hits.

## Summary

One file to change (`supabase/migrations/20260428214150_…sql`). Everything else is already on TapeCoach + tapecoach.co.uk.
