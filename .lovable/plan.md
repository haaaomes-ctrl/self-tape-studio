## Diagnosis

Two issues from the previous "Finalising Results" reliability fix:

1. **QA artefacts (logs + raw report `.json`) stopped appearing in the `qa-artifacts` bucket.**
   The fix wrapped QA emission in `void (async () => { ... })()` *after* `status: complete` was written (lines ~3198–3250 of `src/server/process-take.server.ts`). On this app's Cloudflare Worker SSR runtime, async work that is not awaited inside the request lifecycle (and not registered with `ctx.waitUntil`) is cancelled the moment the response is returned. The Storage upload promise is being killed before it reaches the bucket.
   The original "Finalising Results" hang is now independently guarded by the 5s per-upload timeout we added inside `qa-artifact-sink.server.ts` (`QA_ARTIFACT_STORAGE_TIMEOUT_MS`). That makes awaiting the emission bounded and safe — the outer fire-and-forget wrapper is no longer needed.

2. **`/admin/storage-downloads` lists files alphabetically by path.** `listAllArtifacts` in `src/lib/admin-storage.functions.ts` ends with `results.sort((a, b) => a.path.localeCompare(b.path))`. There is no date ordering, so newest takes are not surfaced at the top.

## Fix

### A. Restore QA emission so files actually upload — `src/server/process-take.server.ts`
- Replace the `void (async () => { ... })()` block (lines ~3198–3250) with an awaited `try/catch` around the same emission body.
- Remove the outer `QA_EMIT_TIMEOUT_MS` / `Promise.race` wrapper. The bounded timeout already lives one layer down in `qa-artifact-sink.server.ts` (5s per upload), so worst-case added latency after `complete` is ~5s × number of artefacts (raw report + manifest ≈ 10s ceiling).
- Keep a try/catch so a QA failure can never fail the take.
- Net effect: pipeline still cannot hang at "Finalising Results" (storage timeout protects it), and artefacts actually reach the bucket because the work happens inside the request lifecycle.

### B. Order downloads by date — `src/lib/admin-storage.functions.ts`
- Change the final sort to `updated_at` descending (fall back to `path` when null/equal). Newest first by default.

### C. Date grouping in the admin UI — `src/routes/admin/storage-downloads.tsx`
- Add a "Sort by" toggle: `Newest first` (default) / `Oldest first` / `Path A→Z`. Pure client-side sort over the already-fetched list.
- When sorted by date, render `YYYY-MM-DD` group headers above each day's files.

## Verification (end-to-end test the user requested)

After applying the fix, I will:

1. Submit a fresh take through the live pipeline using the project's standard submission path.
2. Poll the take row until `status = complete` to confirm the pipeline does not stall at "Finalising Results".
3. Visit `/admin/storage-downloads` (or list the bucket via `listAllArtifacts`) and confirm a new dated folder appears at the top containing both:
   - the raw report `.json`
   - the manifest + log artefacts
4. Repeat with a second take to confirm both appear, newest-first, and neither stalls.
5. Pull `server-function-logs` for the run to confirm no `internal_qa_emit_warning` / `storage_upload_timeout` warnings.

If the live submission requires an authenticated user session I cannot drive headlessly, I will fall back to invoking the existing process-take server function directly via `invoke-server-function` against a known take id and verify the same artefacts land in the bucket.

## Out of scope / unchanged

- No RLS policy changes
- `qa-artifacts` bucket stays private
- No changes to public report shape, scoring, Mux pipeline, reconciler, or `production_safe` status
- No service-role secret in client bundle

## Files to change

- `src/server/process-take.server.ts`
- `src/lib/admin-storage.functions.ts`
- `src/routes/admin/storage-downloads.tsx`