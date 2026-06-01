Pull the latest commits from the connected GitHub repository into the Lovable workspace so the preview/editor matches `main`.

## What this does
- Triggers a Git → Lovable sync of the currently connected branch (`main`).
- Updates the workspace file tree to match the remote HEAD.
- Does NOT publish to the worker — publishing remains a separate step.

## What this does NOT do
- No source edits, no migrations, no config changes.
- No regeneration of `src/routeTree.gen.ts` or `src/integrations/supabase/types.ts` — whatever is on the remote commit is what lands.
- No deploy to `tapecoach.lovable.app` / `tapecoach.co.uk`.

## After sync
- Confirm the new HEAD commit hash.
- Spot-check that generated files (`routeTree.gen.ts`, Supabase `types.ts`) match the remote — per AGENTS.md, Lovable refresh is a known drift risk.
- If you then want it live, publish as a separate step.