## Two fixes

### 1. QA artefacts never reach the bucket (root cause of empty `/admin/storage-downloads`)

`resolveMode()` in `src/server/v3/qa-artifact-sink.server.ts` defaults to `'file'` when `QA_ARTIFACT_SINK` is unset. On the Cloudflare Worker runtime, filesystem writes fail with `EPERM` ("operation not permitted") — confirmed in worker logs: every emission logs `sink_mode:"file"`, `sink_write_status:"failed"`, `warning:"operation not permitted"`. The bucket is empty (0 rows in `storage.objects`).

**Change:** default the sink to `'storage'` instead of `'file'`. Workers can't write files, so `'file'` is never a usable production default. Tests stub the env explicitly so they are unaffected.

```ts
// src/server/v3/qa-artifact-sink.server.ts
function resolveMode(env = process.env): QAArtifactSinkMode {
  const mode = env.QA_ARTIFACT_SINK as QAArtifactSinkMode | undefined;
  if (mode === 'storage' || mode === 'console_jsonl' || mode === 'file') return mode;
  return 'storage'; // was 'file'
}
```

`QA_ARTIFACT_STORAGE_BUCKET` already defaults to `'qa-artifacts'` in `writeQAArtifact`, so uploads will land in the correct bucket.

### 2. Hardcoded admin email in test file (security finding)

`src/server/__tests__/v3-s9-comparison-operator-trigger.test.ts` contains the real admin email at lines 12 and 211. Replace with a generic placeholder and derive the assertion from the env var.

```ts
// line 12
process.env.TAPECOACH_ADMIN_EMAIL = process.env.TAPECOACH_ADMIN_EMAIL ?? 'admin-test@example.com';
const TEST_ADMIN_EMAIL = process.env.TAPECOACH_ADMIN_EMAIL;

// line 211
expect(() => assertAdminEmail({ email: TEST_ADMIN_EMAIL })).not.toThrow();
```

Then mark the `admin_email_hardcoded` finding fixed.

## Verification

- After deploy: trigger a take, query `storage.objects WHERE bucket_id='qa-artifacts'` — expect new rows.
- Reload `/admin/storage-downloads` — expect entries newest first.
- Tail server-function-logs filtered on `TAPECOACH_QA_ARTIFACT_JSON` — expect `sink_mode:"storage"` + `sink_write_status:"written"`.
- Existing vitest suites continue to pass (env stubs unchanged).

## Files to change

- `src/server/v3/qa-artifact-sink.server.ts`
- `src/server/__tests__/v3-s9-comparison-operator-trigger.test.ts`
