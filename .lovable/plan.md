## Goal
Make `/admin/storage-downloads` render reliably inside the app, use the app’s own authenticated session, validate admin access by normalized email only (`o.halawi90@gmail.com`), and list/download private `qa-artifacts` files through server-only signed URLs without changing bucket privacy or storage policies.

## What I’ll change

### 1) Repair the server-function auth boundary
Update `src/lib/admin-storage.functions.ts` so it contains server functions only and follows the project’s working auth pattern:
- Keep constants exactly as requested:
  - `ADMIN_EMAIL = "o.halawi90@gmail.com"`
  - `BUCKET_NAME = "qa-artifacts"`
  - `SIGNED_URL_TTL_SECONDS = 3600`
  - `PAGE_SIZE = 1000`
- Keep normalized email checking with `trim().toLowerCase()`.
- Add `attachSupabaseAuth` alongside `requireSupabaseAuth` on all client-called server functions so the app session token is actually forwarded.
- Keep storage access server-only via `supabaseAdmin` and never expose it to the browser.
- Implement/fix:
  - `whoAmIAdmin` → returns diagnostic email info and `isAdmin`, throws only for missing auth
  - `listAllArtifacts` → admin-only, recursive paginated listing of files only
  - `signArtifactDownload` → admin-only, 1-hour signed download URLs with `download: true`
- Keep storage errors explicit and readable.

### 2) Replace the crashing route implementation
Rebuild `src/routes/admin/storage-downloads.tsx` so it does not depend on React Query.

Reason for the current crash:
- The route currently calls `useQuery(...)`, but this app does not mount a `QueryClientProvider`, which throws `No QueryClient set, use QueryClientProvider to set one` and causes the generic error page.

New route behavior:
- Always render the route; no `beforeLoad` redirect to `/`.
- Use the existing app auth/session flow (`useAuth` and `/login`) to determine whether the user is signed into the app.
- Show clear UI states instead of throwing:
  - **Checking session**
  - **Not signed in** → access panel with a button/link to `/login`
  - **Signed in as wrong email** → visible email mismatch details + sign-out button
  - **Signed in as correct client email** → call `whoAmIAdmin`
  - **Server confirms admin** → load files and render download UI
  - **Server rejects/can’t verify** → render diagnostics and error details inline
- Use plain React state/effects for calling `whoAmIAdmin` and `listAllArtifacts` so no provider dependency exists.
- Keep per-file download and sequential “Download all” behavior with progress and failure reporting.

### 3) Add route-level error handling
Add a route-specific `errorComponent` on `/admin/storage-downloads` that shows:
- error name
- error message
- error status if present
- retry/reload action

I’ll also keep normal operational errors from reaching that boundary by catching server/auth failures in component state and rendering them directly on the page.

### 4) Keep routing and metadata correct
- Keep the route file at `src/routes/admin/storage-downloads.tsx`
- Confirm it remains registered as `/admin/storage-downloads`
- Keep route metadata:
  - title: `Admin Storage Downloads`
  - robots: `noindex,nofollow`

### 5) Verification after implementation
I’ll verify the result by checking:
1. the route no longer crashes with the generic error page
2. the route is still registered as `/admin/storage-downloads`
3. signed-out users see an access/login screen
4. admin-email diagnostics render safely
5. server admin confirmation happens only after a real app session exists
6. the private bucket list loads only after server confirmation
7. per-file download requests use fresh signed URLs
8. “Download all” runs sequentially and shows progress/failures
9. no storage policy or migration was added
10. the bucket remains private
11. the exact changed files are reported

## Technical notes
- I will not add any DB migration or storage policy.
- I will not make the bucket public.
- I will not use UID-based admin checks.
- I will not expose the service-role/admin key to browser code.
- I will not edit `src/integrations/supabase/client.ts` or generated route files manually.

## Expected changed files
- `src/lib/admin-storage.functions.ts`
- `src/routes/admin/storage-downloads.tsx`
- possibly one small unrelated fix only if a blocking compile error already exists elsewhere during verification