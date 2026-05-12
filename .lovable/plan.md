&nbsp;

```

```

```
## Goal

Temporary admin-only page at `/admin/storage-downloads` that lists every file in the private `qa-artifacts` bucket, with per-file download and a sequential "Download all".

Admin access is gated by authenticated email only:

`o.halawi90@gmail.com`

Email comparison must be normalized by:

- trimming whitespace
- converting to lowercase

The bucket must stay private. Do not add a new storage RLS policy. Do not make the bucket public.

---

## Architecture

Use this structure:

private `qa-artifacts` bucket  
+ no new storage RLS policy  
+ server-only service-role/admin storage access  
+ authenticated email-only admin check  
+ short-lived signed download URLs  
+ temporary admin page  

Browser code must not receive broad storage `SELECT` access.

All storage listing and signed download URL generation must go through server functions that use the server-only `supabaseAdmin` service-role client.

The route should have a client-side guard for convenience, but every server function must independently enforce the authenticated email check. The server-side check is the real security boundary.

Do not use UID-based validation.

Do not check:

```ts
auth.uid()
```

Do not require this user ID:

```

```

```
ef613960-10b6-4e7f-8d05-2daa944f8836
```

Use email-only validation.

---

## Files to add

### 1. `src/lib/admin-storage.functions.ts`

Server functions only.

This should be a thin module containing server function declarations and only the necessary imports.

Do not expose the service-role/admin client to browser code.

Do not reference `supabaseAdmin` in route components, client components, exported helpers, or browser-executed code.

If the build complains about the server-only import boundary, move the `supabaseAdmin` import inside each server function handler or place the admin-storage function module behind a server-only boundary.

---

## Constants

Use:

```

```

```
const ADMIN_EMAIL = "o.halawi90@gmail.com";
const BUCKET_NAME = "qa-artifacts";
const SIGNED_URL_TTL_SECONDS = 3600;
const PAGE_SIZE = 1000;
```

Normalize emails with:

```

```

```
function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}
```

---

## Admin email assertion

Create a local, non-exported helper:

```

```

```
function assertAdminEmail(claims: { email?: string | null }) {
  if (normalizeEmail(claims.email) !== ADMIN_EMAIL) {
    throw new Response("Forbidden", { status: 403 });
  }
}
```

Important correction:

Use this:

```

```

```
throw new Response("Forbidden", { status: 403 });
```

Do not use:

```

```

```
throw Response("Forbidden", 403);
```

---

## Server function: `listAllArtifacts`

Create:

```

```

```
export const listAllArtifacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // ...
  });
```

Requirements:

- `requireSupabaseAuth` must validate the authenticated request.  

-   
Call `assertAdminEmail(context.claims)`.  

-   
Use `supabaseAdmin`, not the user-scoped Supabase client.  

-   
Read from the private `qa-artifacts` bucket.  

-   
Recursively list every file.  

-   
Use pagination with `limit: 1000` and `offset`.  

-   
Continue paginating until a page returns fewer than `1000` entries.  

-   
Use stable sorting in the storage list call.  

-   
Recurse into folders where `entry.id === null`.  

-   
Return only files.  

-   
Return results sorted by path.  


Use list options like:

```

```

```
{
  limit: 1000,
  offset,
  sortBy: { column: "name", order: "asc" }
}
```

Return shape:

```

```

```
{
  path: string;
  size: number;
  updated_at: string | null;
}[]
```

The returned list should be sorted by `path`.

Add no-cache behavior for sensitive private file listing data. Set:

```

```

```
Cache-Control: no-store
```

on the server response if supported by the framework/server-function implementation.

---

## Recursive listing behavior

The recursive listing should handle:

-   
folders/prefixes  

-   
pagination per folder  

-   
folders with more than 1000 objects  

-   
empty folders  

-   
storage API errors  

-   
missing metadata  

-   
files with unusual names  

-   
stable path construction  


Folder detection:

```

```

```
entry.id === null
```

File size should come from metadata when available. If size is unavailable, return `0`.

Example returned item:

```

```

```
{
  path: "folder/example.pdf",
  size: 123456,
  updated_at: "2026-05-12T10:00:00.000Z"
}
```

---

## Server function: `signArtifactDownload`

Create a Zod schema:

```

```

```
const SignArtifactDownloadInput = z.object({
  path: z.string().min(1).max(1024),
});
```

Create:

```

```

```
export const signArtifactDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(SignArtifactDownloadInput)
  .handler(async ({ data, context }) => {
    // ...
  });
```

Alternatively, use:

```

```

```
.inputValidator((data) => SignArtifactDownloadInput.parse(data))
```

Do not use the unsafe/ambiguous style:

```

```

```
.inputValidator(z.object({ path: z.string().min(1).max(1024) }).parse)
```

Requirements:

- `requireSupabaseAuth` must validate the authenticated request.  

-   
Call `assertAdminEmail(context.claims)`.  

-   
Use `supabaseAdmin`, not the user-scoped Supabase client.  

-   
Generate a signed URL from the private `qa-artifacts` bucket.  

-   
Signed URL should expire after 1 hour.  

-   
Signed URL should force download behavior.  


Use:

```

```

```
const { data: signedData, error } = await supabaseAdmin
  .storage
  .from("qa-artifacts")
  .createSignedUrl(data.path, 3600, { download: true });
```

If there is an error, throw a server error response.

Return:

```

```

```
{
  signedUrl: signedData.signedUrl
}
```

Add no-cache behavior for signed URLs. Set:

```

```

```
Cache-Control: no-store
```

on the server response if supported by the framework/server-function implementation.

---

## Server/client boundary requirements

The following must be true:

- `supabaseAdmin` is only created on the server.  

-   
The service-role/admin key is never imported into client-side code.  

-   
The service-role/admin key is never exposed in browser bundles.  

- `supabaseAdmin` does not persist sessions.  

- `supabaseAdmin` does not inherit the current user's JWT/session.  

-   
The authenticated user session is used only to confirm who is making the request.  

-   
The actual storage list/sign operations use the server-only service-role/admin client.  

-   
Do not use a user-scoped Supabase client for listing or signing private storage files.  

-   
Do not reference `supabaseAdmin` in exported helpers, route components, client components, or module-level client code.  

-   
If needed, import `supabaseAdmin` dynamically inside the server function handler to keep it out of the client graph.  

-   
Run a production build/check after implementation to confirm the service-role/admin secret is not included in the client bundle.  


---

## 2. `src/routes/admin/storage-downloads.tsx`

Create the route:

```

```

```
/admin/storage-downloads
```

Use the existing TanStack route/file-routing conventions for this project.

---

## Route head metadata

Set:

```

```

```
Title: Admin Storage Downloads
```

Add:

```

```

```
<meta name="robots" content="noindex,nofollow">
```

---

## Client-side route guard

Use `beforeLoad` as a convenience guard.

Behavior:

-   
Read the current user using `supabase.auth.getUser()`.  

-   
Normalize the email with trim + lowercase.  

-   
If there is no user, redirect to `/`.  

-   
If the normalized email is not `o.halawi90@gmail.com`, redirect to `/`.  


Example logic:

```

```

```
const ADMIN_EMAIL = "o.halawi90@gmail.com";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}
```

Then:

```

```

```
if (!user || normalizeEmail(user.email) !== ADMIN_EMAIL) {
  throw redirect({ to: "/" });
}
```

This client-side check is only for UX/convenience. It is not sufficient by itself. The server functions must still enforce email validation.

---

## Component behavior

On mount:

-   
Call `listAllArtifacts`.  

-   
Use `useServerFn` + `useQuery`, or the existing query/server-function pattern already used in the project.  

-   
Show loading state.  

-   
Show error state.  

-   
Show empty state if no files are found.  


Render a table with:

-   
Path  

-   
Size  

-   
Modified date  

-   
Download button  


Use existing tokenised UI components where available:

- `Button`  

- `Table`  

- `Progress`  


---

## Per-file download

Each row should have a Download button.

When clicked:

1.   
Call:  


```

```

```
signArtifactDownload({ data: { path } })
```

2.   
Receive:  


```

```

```
{ signedUrl }
```

3.   
Create a hidden anchor:  


```

```

```
const a = document.createElement("a");
a.href = signedUrl;
a.download = path.split("/").pop() || "download";
a.rel = "noopener";
document.body.appendChild(a);
a.click();
a.remove();
```

4.   
Do not expose any service-role key.  

5.   
Do not expose a permanent public URL.  

6.   
Request a fresh signed URL every time the user clicks Download.  


---

## Download all

Add a "Download all" button.

Behavior:

-   
Disabled while running.  

-   
Iterates the current file list sequentially.  

-   
For each file:  

  -   
  request a fresh signed URL with `signArtifactDownload`  

  -   
  trigger the browser download  

  -   
  wait approximately `600ms` before the next file  

-   
Track progress with:  


```

```

```
{
  done: number;
  total: number;
  current: string | null;
  failed: { path: string; error: string }[];
}
```

Render:

-   
progress bar  

- `x of n downloaded`  

-   
current file path  

-   
list of failed downloads, if any  


Show this warning above the button:

```

```

```
Your browser may block multiple automatic downloads — allow them when prompted.
```

For many files, browser automatic downloads may be throttled or blocked. Keep the bucket private either way.

---

## RLS / migration

Do not add a storage RLS policy.

Do not modify existing storage RLS policies.

Do not make the bucket public.

Do not add this UID-based policy:

```

```

```
create policy "Admin can read qa-artifacts"
on storage.objects for select to authenticated
using (
  bucket_id = 'qa-artifacts'
  and auth.uid() = 'ef613960-10b6-4e7f-8d05-2daa944f8836'
);
```

Do not add a broad authenticated-user policy like:

```

```

```
bucket_id = 'qa-artifacts'
```

The page reads and signs downloads server-side through `supabaseAdmin`, so no storage policy is required for this temporary download page.

The bucket should remain private with its current zero-policy state for `qa-artifacts`.

---

## Security requirements

-   
Bucket remains private.  

-   
No public bucket access.  

-   
No new storage RLS policy.  

-   
No UID-based validation.  

-   
Admin validation is by authenticated email only.  

-   
Email must be normalized with trim + lowercase.  

-   
Allowed email is exactly:  


```

```

```
o.halawi90@gmail.com
```

-   
Every server function must verify the authenticated email.  

-   
Client-side route protection is convenience only.  

-   
Server-side email validation is mandatory.  

-   
Service-role/admin key must never reach the browser.  

-   
Signed URLs expire after 1 hour.  

-   
Signed URLs use `download: true`.  

-   
Private file listings and signed URLs should not be cached.  


---

## Removal note

After downloads are complete, remove:

```

```

```
src/routes/admin/storage-downloads.tsx
src/lib/admin-storage.functions.ts
```

No DB rollback is required.

No RLS rollback is required because no storage policy should be added.

---

## Verification

After implementation:

1.   
Run typecheck/build.  

2.   
Confirm no service-role/admin secret is included in the client bundle.  

3.   
Open the preview route:  


```

```

```
/admin/storage-downloads
```

4.   
Confirm unauthorized users are redirected.  

5.   
Confirm the admin email can access the page.  

6.   
Confirm the file list loads.  

7.   
Confirm files are listed from the private `qa-artifacts` bucket.  

8.   
Click one file's Download button and confirm the signed URL works.  

9.   
Click "Download all" and confirm sequential downloads begin.  

10.   
Confirm progress updates correctly.  

11.   
Confirm failures, if any, are displayed.  

12.   
Confirm no bucket RLS policy was added or changed.  

13.   
Report the exact list of changed files.