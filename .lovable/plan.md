## Goal

Add the runtime provenance env vars that `resolveQADeploymentProvenance` reads, so the runtime verification trace can resolve commit/branch/deployment without operator confirmation conflicts.

## What to set

Add three secrets via `secrets--add_secret` (runtime env vars in the deployed Worker):

| Secret name | Value |
|---|---|
| `BUILD_COMMIT_SHA` | `f2e87e6` (or full 40-char SHA if you have it — preferred for the resolver's safe-value check) |
| `BRANCH_NAME` | `main` |
| `DEPLOYMENT_REVISION` | `r10-7h-f2e87e6` |

The other aliases in your table (`COMMIT_SHA`, `GIT_SHA`, `GITHUB_SHA`, `VERCEL_*`, `CF_PAGES_*`, `LOVABLE_GIT_COMMIT_SHA`, `LOVABLE_DEPLOYMENT_ID`, etc.) are alternate names the resolver also accepts. Leave them unset — Lovable's Worker runtime does not inject GitHub/Vercel/Cloudflare-specific names, and setting redundant aliases just creates drift risk if values disagree later.

## Why these three

`src/server/v3/qa-artifacts.server.ts` → `resolveQADeploymentProvenance` walks the alias list per field and picks the first present + "safe" value (rejects URLs, `token=`, `=`, etc.). Setting one canonical name per field is enough and matches the test fixtures in `v3-s9-runtime-verification-provenance-comparison-parity-closeout.test.ts` ("allows safe env provenance to complete runtime proof").

## Notes / caveats

- **Prefer the full 40-char Git SHA** for `BUILD_COMMIT_SHA` if you have it. The short `f2e87e6` will be accepted by the safe-value filter, but operator-confirmation conflict checks elsewhere compare against full SHAs — using the full SHA avoids a spurious `runtime_provenance_conflict`.
- Values must not contain `://`, `?`, `=`, or whitespace, or the resolver will mark them `invalid_env_value_ignored`.
- These are runtime secrets, not build secrets — `add_secret` is the right path.
- No code changes needed. After the secrets are saved, the next analysis run will populate `deployment_provenance_status: resolved` in `RuntimeVerificationTrace.json`. `production_safe_status` stays `blocked` by design (release approval is a separate gate).

## Step

1. Call `secrets--add_secret` for `BUILD_COMMIT_SHA`, `BRANCH_NAME`, `DEPLOYMENT_REVISION` — you enter the values in the secure form.
